import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

// ─── ISO week helpers ─────────────────────────────────────────────────────────

function getISOWeekMonday(d: Date): Date {
  const day = d.getUTCDay() || 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1)))
}

function getISOWeekInfo(d: Date): { year: number; week: number } {
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (4 - (d.getUTCDay() || 7))))
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: thu.getUTCFullYear(), week }
}

function weekIndex(year: number, week: number): number {
  return year * 54 + week
}

function addISOWeeks(kw: { year: number; week: number }, n: number): { year: number; week: number } {
  const jan4 = new Date(Date.UTC(kw.year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dow - 1) * 86_400_000)
  const base = new Date(monday1.getTime() + (kw.week - 1) * 7 * 86_400_000)
  return getISOWeekInfo(new Date(base.getTime() + n * 7 * 86_400_000))
}

function rhythmusToWeeks(r: string): number {
  if (r === 'alle_vier_wochen') return 4
  if (r === 'alle_drei_wochen') return 3
  if (r === 'alle_zwei_wochen') return 2
  return 1
}

function nextPaymentWeek(
  basisKw: number, basisJahr: number,
  rhythmusWeeks: number,
  currentYear: number, currentWeek: number,
): { year: number; week: number } {
  let kw = { year: basisJahr, week: basisKw }
  while (weekIndex(kw.year, kw.week) <= weekIndex(currentYear, currentWeek)) {
    kw = addISOWeeks(kw, rhythmusWeeks)
  }
  return kw
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuszEinst {
  sales_plattform_id: string
  auszahlungsrhythmus: string
  naechste_auszahlung_basis_kw: number | null
  naechste_auszahlung_basis_jahr: number | null
  verschiebung_wochen: number
  marketing_inkludiert: boolean
}

interface KatRow { id: string; name: string; type: string; level: number; parent_id: string | null }

// Row format returned by /api/sales-plattform-planung/berechnet
// and stored in sales_plattform_planung (manual overrides).
// Note: for marketing rows, sales_plattform_id is the marketing kategorie ID — not a platform ID.
interface SppRow {
  kategorie: string
  produkt_id: string
  sales_plattform_id: string
  kw_year: number
  kw_number: number
  wert: number
}

interface SppManualRow {
  kategorie: string
  produkt_id: string
  sales_plattform_id: string
  kw_year: number
  kw_number: number
  wert_manuell: number | null
}

interface MktGruppeRow {
  sales_plattform_id: string
  kpi_kategorie_id: string
}

// ─── Vorzeichen: positive SPP values × sign = signed contribution to net ─────

const CATEGORY_SIGNS: Record<string, 1 | -1> = {
  bruttoumsatz: 1,
  rabatte: -1,
  rueckerstattungen: -1,
  verkaufsgebuehr: -1,
  retouren: -1,
}
const PRODUCT_CATEGORIES = Object.keys(CATEGORY_SIGNS)

// ─── GET /api/einnahmen-planung/produktverkaeufe-berechnet ────────────────────
//
// Uses the already-computed Sales Plattform Planung values (auto-calc + manual overrides)
// and applies the payment timing per platform (Auszahlungseinstellungen).
//
// Steps:
//   1. Load Auszahlungseinstellungen (payment timing per platform)
//   2. Fetch SPP auto-calculated values from /api/sales-plattform-planung/berechnet
//   3. Load manual SPP overrides from sales_plattform_planung table
//   4. Merge: manual override > auto-calc
//   5. For each platform × revenue KW: net = Brutto − Rabatte − Rückerstattungen − VKGebühr − Retouren
//   6. For each KW: total marketing costs
//   7. Apply payment timing per platform; subtract marketing when marketing_inkludiert = true
//
// Response: { kw_year, kw_number, wert }[]

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  // ── 1. Load grundeinstellungen, kpi_categories, auszahlungseinstellungen ───
  const [grundResult, katsResult, auszResult, mktGruppenResult] = await Promise.all([
    supabase.from('grundeinstellungen')
      .select('planungshorizont_wochen')
      .eq('user_id', user!.id)
      .maybeSingle(),
    supabase.from('kpi_categories')
      .select('id, name, type, level, parent_id')
      .limit(2000),
    supabase.from('auszahlungs_einstellungen')
      .select('sales_plattform_id, auszahlungsrhythmus, naechste_auszahlung_basis_kw, naechste_auszahlung_basis_jahr, verschiebung_wochen, marketing_inkludiert')
      .eq('user_id', user!.id)
      .limit(50),
    supabase.from('auszahlungs_marketing_gruppen')
      .select('sales_plattform_id, kpi_kategorie_id')
      .eq('user_id', user!.id)
      .eq('inkludiert', true)
      .limit(500),
  ])

  if (katsResult.error) return NextResponse.json({ error: katsResult.error.message }, { status: 500 })
  if (auszResult.error) return NextResponse.json({ error: auszResult.error.message }, { status: 500 })

  const planungsHorizont = grundResult.data?.planungshorizont_wochen ?? 13
  const kats = (katsResult.data ?? []) as KatRow[]
  const auszEinst = (auszResult.data ?? []) as AuszEinst[]
  if (auszEinst.length === 0) return NextResponse.json([])

  // ── 2. Compute weeks ────────────────────────────────────────────────────────
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const currentMonday = getISOWeekMonday(today)
  const currentKw = getISOWeekInfo(today)

  const planungswochen: { year: number; week: number }[] = []
  for (let i = 0; i < planungsHorizont; i++) {
    const monday = new Date(currentMonday.getTime() + i * 7 * 86_400_000)
    planungswochen.push(getISOWeekInfo(monday))
  }
  if (planungswochen.length === 0) return NextResponse.json([])

  // Revenue weeks extend backward to cover shift + rhythm windows
  const maxV = Math.max(...auszEinst.map(e => e.verschiebung_wochen ?? 0), 0)
  const maxR = Math.max(...auszEinst.map(e => rhythmusToWeeks(e.auszahlungsrhythmus)), 1)
  const extraBefore = maxV + maxR

  const allRevenueWeeks: { year: number; week: number }[] = []
  for (let i = -(extraBefore - 1); i < planungsHorizont; i++) {
    const monday = new Date(currentMonday.getTime() + i * 7 * 86_400_000)
    allRevenueWeeks.push(getISOWeekInfo(monday))
  }

  // ── 3. Fetch SPP values: historisch (past KWs) + berechnet (current+future KWs)
  //       historisch covers transactions up to (not including) current Monday.
  //       berechnet covers current Monday onwards.
  //       Together they span the full revenue window without overlap.
  const origin = new URL(request.url).origin
  const cookieHeader = request.headers.get('cookie') ?? ''
  const [sppHistRows, sppAutoRows] = await Promise.all([
    fetch(`${origin}/api/sales-plattform-planung/historisch`, {
      headers: { cookie: cookieHeader },
    })
      .then(r => r.ok ? r.json() : [])
      .catch(() => []) as Promise<SppRow[]>,
    fetch(`${origin}/api/sales-plattform-planung/berechnet`, {
      headers: { cookie: cookieHeader },
    })
      .then(r => r.ok ? r.json() : [])
      .catch(() => []) as Promise<SppRow[]>,
  ])

  // ── 4. Load manual SPP overrides for all revenue years ──────────────────────
  const allYears = [...new Set(allRevenueWeeks.map(w => w.year))]
  const manualResult = await supabase
    .from('sales_plattform_planung')
    .select('kategorie, produkt_id, sales_plattform_id, kw_year, kw_number, wert_manuell')
    .eq('user_id', user!.id)
    .in('kw_year', allYears)
    .limit(10000)

  // ── 5. Build effective value map: manual override > berechnet > historisch ───
  // Key: "kategorie:produkt_id:sales_plattform_id:kw_year:kw_number"
  // Priority (lowest to highest): historisch → berechnet → manual override
  // historisch and berechnet naturally don't overlap: historisch ends before
  // currentMonday, berechnet starts at currentMonday.
  const effectiveMap = new Map<string, number>()

  for (const row of sppHistRows) {
    effectiveMap.set(
      `${row.kategorie}:${row.produkt_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`,
      row.wert,
    )
  }
  for (const row of sppAutoRows) {
    effectiveMap.set(
      `${row.kategorie}:${row.produkt_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`,
      row.wert,
    )
  }
  for (const row of (manualResult.data ?? []) as SppManualRow[]) {
    if (row.wert_manuell !== null) {
      effectiveMap.set(
        `${row.kategorie}:${row.produkt_id}:${row.sales_plattform_id}:${row.kw_year}:${row.kw_number}`,
        Number(row.wert_manuell),
      )
    }
  }

  // ── 6. Identify platforms, products, and inkludierte marketing categories ──────
  const plattformen = kats.filter(k => k.type === 'sales_plattformen')
  const produkte = kats.filter(k => k.type === 'produkte' && k.level === 1)

  // Map: plattformId → Set of marketing kpi_kategorie_ids that are inkludiert for that platform
  const mktKatByPlatt = new Map<string, Set<string>>()
  for (const row of (mktGruppenResult.data ?? []) as MktGruppeRow[]) {
    if (!mktKatByPlatt.has(row.sales_plattform_id)) mktKatByPlatt.set(row.sales_plattform_id, new Set())
    mktKatByPlatt.get(row.sales_plattform_id)!.add(row.kpi_kategorie_id)
  }

  // ── 7. Aggregate net per platform per revenue KW + marketing per platform per KW ──
  // Note: netByPlattKw covers allRevenueWeeks (used with shifted revenue window)
  //       marketingByPlattKw covers allRevenueWeeks (summed over R-week rhythm window, no shift)
  const netByPlattKw = new Map<string, number>()

  for (const kw of allRevenueWeeks) {
    for (const plt of plattformen) {
      let net = 0
      for (const prd of produkte) {
        for (const kat of PRODUCT_CATEGORIES) {
          const val = effectiveMap.get(`${kat}:${prd.id}:${plt.id}:${kw.year}:${kw.week}`) ?? 0
          net += val * CATEGORY_SIGNS[kat]
        }
      }
      if (net !== 0) {
        const key = `${plt.id}:${kw.year}:${kw.week}`
        netByPlattKw.set(key, (netByPlattKw.get(key) ?? 0) + net)
      }
    }
  }

  // Marketing sums per platform per week (same range as revenue, no shift applied here)
  // Deduction is then summed over the R-week rhythm window in the payment loop.
  const marketingByPlattKw = new Map<string, number>() // "plattId:year:week" → sum
  for (const kw of allRevenueWeeks) {
    for (const einst of auszEinst) {
      const mktKats = mktKatByPlatt.get(einst.sales_plattform_id)
      if (!mktKats || mktKats.size === 0) continue
      let sum = 0
      for (const prd of produkte) {
        for (const mktKatId of mktKats) {
          sum += effectiveMap.get(`marketing:${prd.id}:${mktKatId}:${kw.year}:${kw.week}`) ?? 0
        }
      }
      if (sum !== 0) {
        const key = `${einst.sales_plattform_id}:${kw.year}:${kw.week}`
        marketingByPlattKw.set(key, (marketingByPlattKw.get(key) ?? 0) + sum)
      }
    }
  }

  // ── 8. Apply payment timing per platform ─────────────────────────────────────
  // paymentByPlattKw: "plattId:year:week" → net payout for that platform in that week
  const paymentByPlattKw = new Map<string, number>()

  for (const einst of auszEinst) {
    if (!einst.naechste_auszahlung_basis_kw || !einst.naechste_auszahlung_basis_jahr) continue
    const V = einst.verschiebung_wochen ?? 0
    const R = rhythmusToWeeks(einst.auszahlungsrhythmus)
    const firstPayment = nextPaymentWeek(
      einst.naechste_auszahlung_basis_kw, einst.naechste_auszahlung_basis_jahr,
      R, currentKw.year, currentKw.week,
    )

    let payKw = firstPayment
    for (let i = 0; i < planungsHorizont + extraBefore; i++) {
      const payIdx = weekIndex(payKw.year, payKw.week)
      const planStart = weekIndex(planungswochen[0].year, planungswochen[0].week)
      const planEnd = weekIndex(planungswochen[planungswochen.length - 1].year, planungswochen[planungswochen.length - 1].week)

      if (payIdx > planEnd) break

      if (payIdx >= planStart) {
        // Sum net revenue from the shifted window (Umsatz, Rabatte, Erstattungen, VKGebühr, Retouren)
        let sum = 0
        for (let wOff = -(V + R - 1); wOff <= -V; wOff++) {
          const revKw = addISOWeeks(payKw, wOff)
          sum += netByPlattKw.get(`${einst.sales_plattform_id}:${revKw.year}:${revKw.week}`) ?? 0
        }
        // Marketing: sum over the R-week rhythm window ending at payKw (no shift).
        // Controlled entirely by auszahlungs_marketing_gruppen (inkludiert=true rows already filtered at query time).
        let mktDeduction = 0
        for (let wOff = -(R - 1); wOff <= 0; wOff++) {
          const mktKw = addISOWeeks(payKw, wOff)
          mktDeduction += marketingByPlattKw.get(`${einst.sales_plattform_id}:${mktKw.year}:${mktKw.week}`) ?? 0
        }
        const plattKwKey = `${einst.sales_plattform_id}:${payKw.year}:${payKw.week}`
        paymentByPlattKw.set(plattKwKey, (paymentByPlattKw.get(plattKwKey) ?? 0) + sum - mktDeduction)
      }

      payKw = addISOWeeks(payKw, R)
    }
  }

  // ── 9. Build response ────────────────────────────────────────────────────────
  const result: { kw_year: number; kw_number: number; sales_plattform_id: string; wert: number }[] = []
  for (const [key, wert] of paymentByPlattKw.entries()) {
    if (wert === 0) continue
    // key format: "plattId:year:week" — UUIDs contain hyphens but no colons, so split by ':' is safe
    const colonIdx1 = key.indexOf(':')
    const colonIdx2 = key.indexOf(':', colonIdx1 + 1)
    const plattId = key.slice(0, colonIdx1)
    const yearStr = key.slice(colonIdx1 + 1, colonIdx2)
    const weekStr = key.slice(colonIdx2 + 1)
    result.push({
      sales_plattform_id: plattId,
      kw_year: Number(yearStr),
      kw_number: Number(weekStr),
      wert: Math.round(wert * 100) / 100,
    })
  }
  result.sort((a, b) => weekIndex(a.kw_year, a.kw_number) - weekIndex(b.kw_year, b.kw_number))
  return NextResponse.json(result)
}
