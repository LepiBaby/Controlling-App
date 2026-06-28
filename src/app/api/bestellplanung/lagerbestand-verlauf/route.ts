import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'
import { z } from 'zod'

// ─── ISO week utilities ────────────────────────────────────────────────────────

interface KwRef { week: number; year: number }

function toISOWeek(date: Date): KwRef {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7),
  }
}

function isoWeekStart(kw: KwRef): Date {
  const jan4 = new Date(Date.UTC(kw.year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  return new Date(jan4.getTime() - (dow - 1) * 86_400_000 + (kw.week - 1) * 7 * 86_400_000)
}

function addKw(kw: KwRef, n: number): KwRef {
  const d = isoWeekStart(kw)
  d.setUTCDate(d.getUTCDate() + n * 7)
  return toISOWeek(d)
}

function kwKey(kw: number, jahr: number): string { return `${jahr}:${kw}` }
function kwKeyRef(kw: KwRef): string { return kwKey(kw.week, kw.year) }
function kwKeyCmp(a: string, b: string): number {
  const [ay, aw] = a.split(':').map(Number)
  const [by, bw] = b.split(':').map(Number)
  return ay !== by ? ay - by : aw - bw
}

function toDateOnly(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date { return new Date(d.getTime() + n * 86_400_000) }

function getPeriodDays(art: string): number {
  if (art.endsWith('_7')) return 7; if (art.endsWith('_14')) return 14
  if (art.endsWith('_30')) return 30; if (art.endsWith('_60')) return 60
  if (art.endsWith('_90')) return 90; return 30
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BestandRow {
  sku_id: string
  datum: string
  anfangsbestand: number
  einlagerungen: number
  anpassungen_positiv: number
  anpassungen_negativ: number
  warenverluste: number
  sendungen_manuell: number
  bestand_sendungen: Array<{ menge: number }>
}

interface AbsatzEinstellung {
  sales_plattform_id: string
  produkt_id: string
  berechnungsart: string
  gewichtung_erstes_drittel: number | null
  gewichtung_zweites_drittel: number | null
  gewichtung_drittes_drittel: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function closingBalance(row: BestandRow): number {
  const sendungenSum = (row.bestand_sendungen ?? []).reduce((s, x) => s + x.menge, 0)
  return Math.max(0,
    row.anfangsbestand + row.einlagerungen + row.anpassungen_positiv
    - row.anpassungen_negativ - row.warenverluste - row.sendungen_manuell - sendungenSum
  )
}

function calcTagesdurchschnitt(
  entries: Array<{ datum: string; menge: number }>,
  periodDays: number,
  e: AbsatzEinstellung,
  today: Date,
): number {
  const start = addDays(today, -periodDays)
  const startStr = toDateOnly(start)
  const todayStr = toDateOnly(today)

  if (e.berechnungsart.startsWith('gewichtet_')) {
    const third = periodDays / 3
    const t1 = startStr
    const t2 = toDateOnly(addDays(start, third))
    const t3 = toDateOnly(addDays(start, third * 2))
    const s1 = entries.filter(x => x.datum >= t1 && x.datum < t2).reduce((s, x) => s + x.menge, 0)
    const s2 = entries.filter(x => x.datum >= t2 && x.datum < t3).reduce((s, x) => s + x.menge, 0)
    const s3 = entries.filter(x => x.datum >= t3 && x.datum < todayStr).reduce((s, x) => s + x.menge, 0)
    const w1 = e.gewichtung_erstes_drittel; const w2 = e.gewichtung_zweites_drittel; const w3 = e.gewichtung_drittes_drittel
    if (w1 == null || w2 == null || w3 == null) return Math.round(((s1 + s2 + s3) / periodDays) * 100) / 100
    return Math.round(((w1 * (s1 / third) + w2 * (s2 / third) + w3 * (s3 / third)) / 100) * 100) / 100
  }

  const total = entries.filter(x => x.datum >= startStr && x.datum < todayStr).reduce((s, x) => s + x.menge, 0)
  return Math.round((total / periodDays) * 100) / 100
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const schema = z.object({ produkt_id: z.string().uuid() })
  const parsed = schema.safeParse({ produkt_id: searchParams.get('produkt_id') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'produkt_id (UUID) ist erforderlich' }, { status: 400 })
  }
  const { produkt_id } = parsed.data

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStr = toDateOnly(today)

  // ── 1. KW-Grid aufbauen ──────────────────────────────────────────────────────
  const { data: grundData } = await supabase
    .from('grundeinstellungen')
    .select('planungshorizont_wochen, vergangenheitshorizont_wochen')
    .eq('user_id', user!.id)
    .maybeSingle()
  const horizont = grundData?.planungshorizont_wochen ?? 13
  const historyWeeks = grundData?.vergangenheitshorizont_wochen ?? 13

  const curKW = toISOWeek(today)
  const startKW = addKw(curKW, -historyWeeks)
  const totalWeeks = historyWeeks + horizont

  const allWeeks: Array<{ kw: number; jahr: number; ist_prognose: boolean }> = []
  let w = startKW
  for (let i = 0; i < totalWeeks; i++) {
    const ist_prognose = w.year > curKW.year || (w.year === curKW.year && w.week >= curKW.week)
    allWeeks.push({ kw: w.week, jahr: w.year, ist_prognose })
    w = addKw(w, 1)
  }

  // ── 2. SKUs dieses Produkts laden ────────────────────────────────────────────
  const { data: skusRaw } = await supabase
    .from('kpi_categories')
    .select('id, name')
    .eq('type', 'produkte')
    .eq('level', 2)
    .eq('parent_id', produkt_id)
    .order('sort_order', { ascending: true })
    .limit(100)

  const skus = (skusRaw ?? []) as Array<{ id: string; name: string }>
  if (skus.length === 0) {
    return NextResponse.json({ wochen: allWeeks, skus: [] })
  }

  const skuIds = skus.map(s => s.id)

  // ── 3. Parallel-Fetch ────────────────────────────────────────────────────────
  const [
    bestandRes,
    absatzPlanRes,
    skuMengenRes,
    bestandsvRes,
    lieferzeitRes,
    einstellungenRes,
  ] = await Promise.all([
    // Alle bestand_transaktionen bis heute (kein unteres Limit für historische Rekonstruktion)
    fetchAllRows((from, to) =>
      supabase
        .from('bestand_transaktionen')
        .select('sku_id, datum, anfangsbestand, einlagerungen, anpassungen_positiv, anpassungen_negativ, warenverluste, sendungen_manuell, bestand_sendungen(menge)')
        .in('sku_id', skuIds)
        .lte('datum', todayStr)
        .order('datum', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    ),

    // Absatzplanung für dieses Produkt
    fetchAllRows((from, to) =>
      supabase
        .from('absatz_planung')
        .select('sku_id, kw_year, kw_number, absatz_manuell')
        .eq('user_id', user!.id)
        .eq('produkt_id', produkt_id)
        .not('absatz_manuell', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    ),

    // SKU-Mengen offener Bestellungen (plan + laufend)
    supabase
      .from('bestellungen_sku_mengen')
      .select('sku_id, menge_praktisch, bestellung_id')
      .in('sku_id', skuIds)
      .limit(1000),

    // Sicherheitsbestand-Konfiguration
    supabase
      .from('produktinformationen_bestandsverwaltung')
      .select('sicherheitsbestand, zielreichweite_wochen')
      .eq('user_id', user!.id)
      .eq('produkt_id', produkt_id)
      .maybeSingle(),

    // Lieferzeit-Konfiguration
    supabase
      .from('produktinformationen_lieferzeit')
      .select('pufferzeit_tage, produktionszeit_tage, zwischenzeit_tage, shipping_zeit_tage, entladungszeit_tage')
      .eq('user_id', user!.id)
      .eq('produkt_id', produkt_id)
      .maybeSingle(),

    // Absatz-Einstellungen für avg_wochenabsatz
    supabase
      .from('absatz_einstellungen')
      .select('sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel')
      .eq('user_id', user!.id)
      .eq('produkt_id', produkt_id)
      .neq('berechnungsart', 'keine')
      .limit(50),
  ])

  const bestandRows = (bestandRes.data ?? []) as BestandRow[]
  const absatzPlanRows = (absatzPlanRes.data ?? []) as Array<{ sku_id: string | null; kw_year: number; kw_number: number; absatz_manuell: number }>
  const skuMengenRows = (skuMengenRes.data ?? []) as Array<{ sku_id: string; menge_praktisch: number; bestellung_id: string }>
  const einstellungen = (einstellungenRes.data ?? []) as AbsatzEinstellung[]
  const lieferzeit = lieferzeitRes.data
  const bestandsv = bestandsvRes.data

  // Gesamtlieferzeit in Wochen (aufgerundet)
  const lieferzeitTage = lieferzeit
    ? (lieferzeit.pufferzeit_tage ?? 0) + (lieferzeit.produktionszeit_tage ?? 0)
      + (lieferzeit.zwischenzeit_tage ?? 0) + (lieferzeit.shipping_zeit_tage ?? 0)
      + (lieferzeit.entladungszeit_tage ?? 0)
    : null
  const lieferzeitKW = lieferzeitTage != null ? Math.ceil(lieferzeitTage / 7) : null

  // ── 4. Bestellungen: alle Status laden (plan/laufend/abgeschlossen) ────────────
  const bestellungIds = [...new Set(skuMengenRows.map(s => s.bestellung_id))]
  const bestelldatumByBestellungId = new Map<string, string>()   // plan/laufend → kalk
  const verfuegbarByBestellungId = new Map<string, string>()      // alle → Ankunft-Datum
  const abgeschlosseneIds = new Set<string>()                     // abgeschlossen → nicht für kalk

  if (bestellungIds.length > 0) {
    const { data: bestRows } = await supabase
      .from('bestellungen')
      .select('id, status, bestelldatum, verfuegbarkeitsdatum, verfuegbarkeitsdatum_ist')
      .in('id', bestellungIds)
      .in('status', ['plan', 'laufend', 'abgeschlossen'])
      .limit(500)

    for (const b of (bestRows ?? []) as Array<{ id: string; status: string; bestelldatum: string | null; verfuegbarkeitsdatum: string | null; verfuegbarkeitsdatum_ist: string | null }>) {
      if (b.status === 'abgeschlossen') abgeschlosseneIds.add(b.id)
      // Bestelldatum: für alle Statuse (Anzeige), aber kalk nur für plan/laufend
      if (b.bestelldatum) {
        bestelldatumByBestellungId.set(b.id, b.bestelldatum)
      }
      // Verfügbarkeitsdatum (Ist hat Vorrang) für alle Statuse
      const verfuegbar = b.verfuegbarkeitsdatum_ist ?? b.verfuegbarkeitsdatum
      if (verfuegbar) {
        verfuegbarByBestellungId.set(b.id, verfuegbar)
      }
    }
  }

  // Tatsächlicher Zugang (Prognose): plan/laufend an verfuegbarkeitsdatum-Woche
  const zugangBySku = new Map<string, Map<string, number>>()
  for (const sm of skuMengenRows) {
    if (abgeschlosseneIds.has(sm.bestellung_id)) continue  // abgeschlossen bereits in bestand_transaktionen
    const verfuegbar = verfuegbarByBestellungId.get(sm.bestellung_id)
    if (!verfuegbar) continue
    const vKW = toISOWeek(new Date(verfuegbar + 'T00:00:00Z'))
    const key = kwKeyRef(vKW)
    if (!zugangBySku.has(sm.sku_id)) zugangBySku.set(sm.sku_id, new Map())
    zugangBySku.get(sm.sku_id)!.set(key, (zugangBySku.get(sm.sku_id)!.get(key) ?? 0) + sm.menge_praktisch)
  }

  // Historische Ankunft: alle Bestellungen mit Verfügbarkeitsdatum in der Vergangenheit
  const historischeAnkunftBySku = new Map<string, Map<string, number>>()
  for (const sm of skuMengenRows) {
    const verfuegbar = verfuegbarByBestellungId.get(sm.bestellung_id)
    if (!verfuegbar) continue
    const vKW = toISOWeek(new Date(verfuegbar + 'T00:00:00Z'))
    // Nur historische Wochen (vor curKW)
    if (vKW.year > curKW.year || (vKW.year === curKW.year && vKW.week >= curKW.week)) continue
    const key = kwKeyRef(vKW)
    if (!historischeAnkunftBySku.has(sm.sku_id)) historischeAnkunftBySku.set(sm.sku_id, new Map())
    historischeAnkunftBySku.get(sm.sku_id)!.set(key, (historischeAnkunftBySku.get(sm.sku_id)!.get(key) ?? 0) + sm.menge_praktisch)
  }

  // Bestellmenge-Anzeige + historische Kalk-Basis: ALLE Bestellungen (incl. abgeschlossen)
  const bestellMengeBySku = new Map<string, Map<string, number>>()
  // historische Kalk-Berechnung: alle Statuse (abgeschlossen zählt genauso wie laufend)
  const bestellMengeKalkBySku = new Map<string, Map<string, number>>()
  // Kalk-Zugang (Prognose): nur plan/laufend (abgeschlossen bereits in bestand_transaktionen)
  const kalkZugangBySku = new Map<string, Map<string, number>>()
  // Vergangene plan/laufend Bestellungen → direkt in den Kalk-Startbestand (Prognose)
  const kalkVorperiodeBySku = new Map<string, number>()
  for (const sm of skuMengenRows) {
    const bestellt = bestelldatumByBestellungId.get(sm.bestellung_id)
    if (!bestellt) continue
    const bKW = toISOWeek(new Date(bestellt + 'T00:00:00Z'))
    const key = kwKeyRef(bKW)
    // Anzeige: alle Bestellungen an tatsächlicher bestelldatum-KW
    if (!bestellMengeBySku.has(sm.sku_id)) bestellMengeBySku.set(sm.sku_id, new Map())
    bestellMengeBySku.get(sm.sku_id)!.set(key, (bestellMengeBySku.get(sm.sku_id)!.get(key) ?? 0) + sm.menge_praktisch)
    // Historische Kalk-Basis: alle Statuse (plan + laufend + abgeschlossen)
    if (!bestellMengeKalkBySku.has(sm.sku_id)) bestellMengeKalkBySku.set(sm.sku_id, new Map())
    bestellMengeKalkBySku.get(sm.sku_id)!.set(key, (bestellMengeKalkBySku.get(sm.sku_id)!.get(key) ?? 0) + sm.menge_praktisch)
    // Prognose-Kalk: nur plan/laufend (abgeschlossen bereits in bestand_transaktionen)
    if (abgeschlosseneIds.has(sm.bestellung_id)) continue
    const isPast = bKW.year < curKW.year || (bKW.year === curKW.year && bKW.week < curKW.week)
    if (isPast) {
      kalkVorperiodeBySku.set(sm.sku_id, (kalkVorperiodeBySku.get(sm.sku_id) ?? 0) + sm.menge_praktisch)
    } else {
      if (!kalkZugangBySku.has(sm.sku_id)) kalkZugangBySku.set(sm.sku_id, new Map())
      kalkZugangBySku.get(sm.sku_id)!.set(key, (kalkZugangBySku.get(sm.sku_id)!.get(key) ?? 0) + sm.menge_praktisch)
    }
  }


  // ── 5. Absatz-Planung pro SKU pro KW (Summe über alle Plattformen) ──────────
  const absatzBySkuKW = new Map<string, Map<string, number>>()
  for (const a of absatzPlanRows) {
    if (!a.sku_id) continue
    const kwk = kwKey(a.kw_number, a.kw_year)
    if (!absatzBySkuKW.has(a.sku_id)) absatzBySkuKW.set(a.sku_id, new Map())
    absatzBySkuKW.get(a.sku_id)!.set(kwk, (absatzBySkuKW.get(a.sku_id)!.get(kwk) ?? 0) + (a.absatz_manuell ?? 0))
  }

  // Mirror buildSkuAbsatzMaps: last KW with planning data per SKU (for getAbsatzSkuForMB fallback)
  const skuLastKnownMap = new Map<string, { year: number; week: number; menge: number }>()
  for (const [skuId, kwMap] of absatzBySkuKW) {
    let lastYear = 0, lastWeek = 0, lastMenge = 0
    for (const [kwk, menge] of kwMap) {
      const [y, w] = kwk.split(':').map(Number)
      if (y > lastYear || (y === lastYear && w > lastWeek)) {
        lastYear = y; lastWeek = w; lastMenge = menge
      }
    }
    if (lastYear > 0) skuLastKnownMap.set(skuId, { year: lastYear, week: lastWeek, menge: lastMenge })
  }

  // ── 6. Aktueller Bestand pro SKU (letzter Abschlussbestand) ─────────────────
  const currentBestandBySku = new Map<string, number>()
  for (const row of bestandRows) {
    // Rows sind aufsteigend → letzter Wert = aktuell
    currentBestandBySku.set(row.sku_id, closingBalance(row))
  }

  // ── 7. Avg. Wochenabsatz pro SKU (für Sicherheitsbestand) ───────────────────
  const avgWochenabsatzBySku = new Map<string, number>()

  if (einstellungen.length > 0) {
    const ninetyAgo = addDays(today, -90)
    const { data: sendungenRows } = await fetchAllRows((from, to) =>
      supabase
        .from('bestand_transaktionen')
        .select('sku_id, datum, bestand_sendungen(plattform_id, menge)')
        .in('sku_id', skuIds)
        .gte('datum', toDateOnly(ninetyAgo))
        .lt('datum', todayStr)
        .order('id', { ascending: true })
        .range(from, to),
    )

    const dataByKombi = new Map<string, Array<{ datum: string; menge: number }>>()
    for (const t of (sendungenRows ?? []) as Array<{ sku_id: string; datum: string; bestand_sendungen: Array<{ plattform_id: string; menge: number }> }>) {
      for (const s of t.bestand_sendungen ?? []) {
        const key = `${t.sku_id}:${s.plattform_id}`
        if (!dataByKombi.has(key)) dataByKombi.set(key, [])
        dataByKombi.get(key)!.push({ datum: t.datum, menge: s.menge })
      }
    }

    for (const e of einstellungen) {
      const periodDays = getPeriodDays(e.berechnungsart)
      for (const sku of skus) {
        const entries = dataByKombi.get(`${sku.id}:${e.sales_plattform_id}`) ?? []
        const td = calcTagesdurchschnitt(entries, periodDays, e, today)
        avgWochenabsatzBySku.set(sku.id, (avgWochenabsatzBySku.get(sku.id) ?? 0) + td * 7)
      }
    }
  }

  // ── 8. Sicherheitsbestand pro SKU — exakt wie Algorithmus: avg_wochenabsatz × wochen ──
  const sbWochen = bestandsv?.sicherheitsbestand ?? null  // stored as weeks

  const sbBySku = new Map<string, number | null>()
  for (const sku of skus) {
    if (sbWochen == null) {
      sbBySku.set(sku.id, null)
    } else {
      const avgWk = avgWochenabsatzBySku.get(sku.id) ?? 0
      sbBySku.set(sku.id, Math.round(avgWk * sbWochen))
    }
  }

  // ── 9. Absatz-Forward-Fill pro SKU (für Prognose-Verlauf-Anzeige) ────────────
  const absatzSeqBySku = new Map<string, Map<string, number>>()
  for (const sku of skus) {
    let last = 0
    const seq = new Map<string, number>()
    for (const wk of allWeeks) {
      const kwk = kwKey(wk.kw, wk.jahr)
      const val = absatzBySkuKW.get(sku.id)?.get(kwk)
      if (val !== undefined) last = val
      seq.set(kwk, last)
    }
    absatzSeqBySku.set(sku.id, seq)
  }

  // ── 10. Meldebestand per SKU — exakt wie planbestelllauf-algorithmus ──────────
  // Mirror getAbsatzSku: exact data → use it; beyond last known KW → last known; gaps → 0
  function getAbsatzSkuForMB(skuId: string, kw: number, jahr: number): number {
    const kwMap = absatzBySkuKW.get(skuId)
    if (!kwMap) return 0
    const key = kwKey(kw, jahr)
    if (kwMap.has(key)) return kwMap.get(key)!
    const last = skuLastKnownMap.get(skuId)
    if (!last) return 0
    const isAfterLast = jahr > last.year || (jahr === last.year && kw > last.week)
    return isAfterLast ? last.menge : 0
  }

  // Mirror computeMeldebestandSku: sum absatz over lieferzeit window + SB, Math.ceil
  // Use addKw to step forward — never clamp to allWeeks.length
  function meldebestandForSku(skuId: string, weekIdx: number): number | null {
    if (lieferzeitKW == null || sbWochen == null) return null
    const avgWk = avgWochenabsatzBySku.get(skuId) ?? 0
    const sbRaw = avgWk * sbWochen
    let absatzSum = 0
    let kw: KwRef = { week: allWeeks[weekIdx].kw, year: allWeeks[weekIdx].jahr }
    for (let i = 0; i < lieferzeitKW; i++) {
      absatzSum += getAbsatzSkuForMB(skuId, kw.week, kw.year)
      kw = addKw(kw, 1)
    }
    return Math.ceil(absatzSum + sbRaw)
  }

  // ── 11. Bestand-Rekonstruktion aus bestand_transaktionen ────────────────────
  const bestandRowsBySku = new Map<string, BestandRow[]>()
  for (const row of bestandRows) {
    if (!bestandRowsBySku.has(row.sku_id)) bestandRowsBySku.set(row.sku_id, [])
    bestandRowsBySku.get(row.sku_id)!.push(row)
  }

  function historischerBestand(skuId: string, kw: KwRef): number {
    // Letzter Abschlussbestand am Sonntag der KW
    const sunday = addDays(isoWeekStart(kw), 6)
    const endStr = toDateOnly(sunday)
    const rows = bestandRowsBySku.get(skuId) ?? []
    let best: BestandRow | null = null
    for (const row of rows) {
      if (row.datum <= endStr) best = row
    }
    return best ? closingBalance(best) : 0
  }

  function historischerAbsatz(skuId: string, kw: KwRef): number | null {
    // Tatsächliche Sendungen (Verkäufe) innerhalb der KW summiert
    const monday = isoWeekStart(kw)
    const mondayStr = toDateOnly(monday)
    const sundayStr = toDateOnly(addDays(monday, 6))
    const rows = bestandRowsBySku.get(skuId) ?? []
    let total = 0
    let hasData = false
    for (const row of rows) {
      if (row.datum >= mondayStr && row.datum <= sundayStr) {
        const sendungenSum = (row.bestand_sendungen ?? []).reduce((s, x) => s + x.menge, 0)
        total += sendungenSum + (row.sendungen_manuell ?? 0)
        hasData = true
      }
    }
    return hasData ? total : null
  }

  // ── 12. Verlauf pro SKU berechnen ────────────────────────────────────────────
  const result = skus.map((sku, skuIdx) => {
    let runningBestand = currentBestandBySku.get(sku.id) ?? 0
    // Vergangene Bestellungen bereits aufgegeben → Kalk-Startbestand erhöhen
    let runningKalk = runningBestand + (kalkVorperiodeBySku.get(sku.id) ?? 0)

    const verlauf = allWeeks.map((wk, i) => {
      const key = kwKey(wk.kw, wk.jahr)
      const mbSku = meldebestandForSku(sku.id, i)
      const sb = sbBySku.get(sku.id) ?? null
      const absatzSkuKW = absatzBySkuKW.get(sku.id)?.get(key) ?? null

      if (!wk.ist_prognose) {
        // Historisch: Werte aus bestand_transaktionen rekonstruieren
        const prevRef = i === 0 ? addKw({ week: wk.kw, year: wk.jahr }, -1) : { week: allWeeks[i - 1].kw, year: allWeeks[i - 1].jahr }
        const bestand_vorher = historischerBestand(sku.id, prevRef)
        const bestand_nachher = historischerBestand(sku.id, { week: wk.kw, year: wk.jahr })
        const absatz = historischerAbsatz(sku.id, { week: wk.kw, year: wk.jahr })
        // Bestellmenge an tatsächlicher bestelldatum-KW anzeigen (auch historisch, incl. abgeschlossen)
        const bestellung_menge = bestellMengeBySku.get(sku.id)?.get(key) ?? 0
        // Tatsächliche Einlagerung: aus Bestellungen (laufend + abgeschlossen) an verfuegbarkeitsdatum-KW
        const ankunft = historischeAnkunftBySku.get(sku.id)?.get(key) ?? 0
        // Kalkulatorischer Bestand: bestand_nachher + alle offenen (plan/laufend) Bestellmengen
        // mit bestelldatum ≤ dieser KW — inkl. Bestellungen vor dem sichtbaren Fenster
        let kalkZuschlag = 0
        const bm = bestellMengeKalkBySku.get(sku.id)
        if (bm) {
          for (const [k, menge] of bm) {
            if (kwKeyCmp(k, key) <= 0) kalkZuschlag += menge
          }
        }

        return {
          kw: wk.kw, jahr: wk.jahr,
          bestand_vorher,
          bestand_nachher,
          absatz,
          ankunft,
          bestellung_menge,
          sicherheitsbestand: sb,
          meldebestand: mbSku,
          kalkulatorischer_bestand: kalkZuschlag > 0 ? bestand_nachher + kalkZuschlag : null,
          ist_prognose: false as const,
        }
      } else {
        // Wenn bestand_vorher = 0, kann kein Absatz stattfinden
        const bestand_vorher = Math.round(runningBestand)
        const absatzSku = absatzSkuKW ?? (absatzSeqBySku.get(sku.id)?.get(key) ?? 0)
        // Exakter Dezimalwert aus der Absatzplanung — kein Runden, damit der Algorithmus konsistent bleibt
        const effectiveAbsatz = bestand_vorher === 0 ? 0 : absatzSku
        const ankunft = zugangBySku.get(sku.id)?.get(key) ?? 0
        // runningBestand als Dezimalzahl weiterführen für genaue Kumulation
        const bestand_nachher_raw = Math.max(0, runningBestand + ankunft - effectiveAbsatz)
        const bestand_nachher = Math.round(bestand_nachher_raw)
        runningBestand = bestand_nachher

        // Kalk. Bestand: nur zukünftige Bestellungen an ihrer bestelldatum-KW; vergangene im Startwert
        // Nur tatsächlich verkaufte Menge abziehen (limitiert durch realen Bestand),
        // damit kalk = nachher + ausstehende Lieferungen gilt.
        const kalkZugang = kalkZugangBySku.get(sku.id)?.get(key) ?? 0
        const kalkAbsatz = Math.min(effectiveAbsatz, bestand_vorher)
        const kalkulatorischer_bestand = Math.round(Math.max(0, runningKalk + kalkZugang - kalkAbsatz))
        runningKalk = kalkulatorischer_bestand
        // Bestellmenge an tatsächlicher bestelldatum-KW (auch für Prognose-Wochen mit zukünftigen Bestellungen)
        const bestellung_menge = bestellMengeBySku.get(sku.id)?.get(key) ?? 0

        return {
          kw: wk.kw, jahr: wk.jahr,
          bestand_vorher,
          bestand_nachher,
          absatz: effectiveAbsatz,
          ankunft: Math.round(ankunft),
          bestellung_menge,
          sicherheitsbestand: sb,
          meldebestand: mbSku,
          kalkulatorischer_bestand,
          ist_prognose: true as const,
        }
      }
    })

    return {
      sku_id: sku.id,
      sku_name: sku.name,
      farbe_index: skuIdx,
      verlauf,
    }
  })

  return NextResponse.json({ wochen: allWeeks, skus: result })
}
