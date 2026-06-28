import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { fetchAllRows } from '@/lib/supabase-paginate'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-89: Berechnete Produktverkäufe der Einnahmenplanung (Langfristige Planung).
// Spiegelt die kurzfristige /einnahmen-planung/produktverkaeufe-berechnet-Logik
// (PROJ-52), aber:
//   • monatsbasiert (ab Startmonat, allgemeiner Horizont) statt Kalenderwochen,
//   • Eingangsdaten aus DIESER Planversion: der Nettoerlös je Plattform stammt aus
//     der langfristigen Sales-Plattform-Planung (PROJ-87, /berechnet + manuelle
//     Überschreibungen), die Zahlungslogik aus den Auszahlungseinstellungen (PROJ-76),
//   • es wird NICHT persistiert (rein berechnet).
//
// Pro Sales-Plattform werden die Nettoerlöse gemäß Auszahlungsrhythmus, Ankermonat
// und Verschiebung in den jeweiligen Auszahlungsmonat verschoben. Ist der Plattform
// in den Auszahlungseinstellungen ein Marketingkanal zugeordnet, werden dessen
// Marketingkosten abgezogen — diese werden jedoch NICHT mit der Verschiebung (V)
// verschoben, sondern am Auszahlungsmonat ausgerichtet (Fenster [Z − R + 1 … Z]),
// identisch zur Kurzfristplanung (PROJ-52).
// Antwort: { jahr, monat, sales_plattform_id, wert }[]

const DEFAULT_PLANUNGSHORIZONT_MONATE = 12

interface RouteContext {
  params: Promise<{ versionId: string }>
}

interface AuszEinstRow {
  sales_plattform_id: string
  auszahlungsrhythmus: string
  erster_auszahlung_monat: number | null
  erster_auszahlung_jahr: number | null
  verschiebung_monate: number | null
}
interface MktKanalRow { sales_plattform_id: string; marketingkanal_id: string }
interface SppRow { kategorie: string; produkt_id: string; sales_plattform_id: string; jahr: number; monat: number; wert: number }
interface SppManualRow { kategorie: string; produkt_id: string; sales_plattform_id: string; jahr: number; monat: number; wert_manuell: number | null }

// Vorzeichen: positiver SPP-Wert × sign = vorzeichenbehafteter Beitrag zum Nettoerlös.
// Marketing wird separat (über die Auszahlungs-Zuordnung) behandelt.
const NET_SIGNS: Record<string, 1 | -1> = {
  bruttoumsatz: 1,
  rabatte: -1,
  rueckerstattungen: -1,
  verkaufsgebuehr: -1,
  retouren: -1,
}

function rhythmusToMonths(r: string): number {
  if (r === 'quartalsweise') return 3
  if (r === 'alle_zwei_monate') return 2
  return 1
}
function monthIndex(jahr: number, monat: number): number {
  return jahr * 12 + (monat - 1)
}
function fromIndex(idx: number): { jahr: number; monat: number } {
  return { jahr: Math.floor(idx / 12), monat: (idx % 12) + 1 }
}
function round2(x: number): number {
  return Math.round(x * 100) / 100
}

export async function GET(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  // 1. Grundeinstellungen + Auszahlungslogik + SPP-Überschreibungen dieser Version
  const [grundResult, auszResult, mktKanalResult, sppManualResult] = await Promise.all([
    supabase
      .from('langfristige_grundeinstellungen')
      .select('startmonat_monat, startmonat_jahr, planungshorizont_monate')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
    supabase
      .from('langfristige_auszahlungs_einstellungen')
      .select('sales_plattform_id, auszahlungsrhythmus, erster_auszahlung_monat, erster_auszahlung_jahr, verschiebung_monate')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .limit(500),
    fetchAllRows((from, to) =>
      supabase
        .from('langfristige_auszahlungs_marketingkanaele')
        .select('sales_plattform_id, marketingkanal_id')
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('langfristige_sales_plattform_planung')
        .select('kategorie, produkt_id, sales_plattform_id, jahr, monat, wert_manuell')
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ])

  if (auszResult.error) return NextResponse.json({ error: auszResult.error.message }, { status: 500 })
  if (mktKanalResult.error) return NextResponse.json({ error: mktKanalResult.error.message }, { status: 500 })
  if (sppManualResult.error) return NextResponse.json({ error: sppManualResult.error.message }, { status: 500 })

  const auszEinst = (auszResult.data ?? []) as AuszEinstRow[]
  // Ohne Auszahlungseinstellungen gibt es keine Produktverkäufe-Auszahlung.
  if (auszEinst.length === 0) return NextResponse.json([])

  const grund = grundResult.data
  const now = new Date()
  const startMonat = grund?.startmonat_monat ?? now.getMonth() + 1
  const startJahr = grund?.startmonat_jahr ?? now.getFullYear()
  const horizont = grund?.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
  const startIdx = monthIndex(startJahr, startMonat)
  const endIdx = startIdx + horizont - 1

  // 2. Sales-Plattform-Planung (berechnet) per internem Fetch — dieselben Netto-/
  //    Marketing-Werte wie die Sales-Plattform-Planungs-Seite, ohne Logik-Duplikat.
  const origin = new URL(request.url).origin
  const cookieHeader = request.headers.get('cookie') ?? ''
  const sppAutoRows = (await fetch(
    `${origin}/api/langfristige-planung/${versionId}/sales-plattform-planung/berechnet`,
    { headers: { cookie: cookieHeader } },
  )
    .then(r => (r.ok ? r.json() : []))
    .catch(() => [])) as SppRow[]

  // 3. Effektive Werte: berechnet → manuelle Überschreibung.
  // Key: "kategorie:produkt_id:sales_plattform_id:jahr:monat"
  const effectiveMap = new Map<string, number>()
  for (const r of Array.isArray(sppAutoRows) ? sppAutoRows : []) {
    effectiveMap.set(`${r.kategorie}:${r.produkt_id}:${r.sales_plattform_id}:${r.jahr}:${r.monat}`, Number(r.wert))
  }
  for (const r of (sppManualResult.data ?? []) as SppManualRow[]) {
    if (r.wert_manuell !== null) {
      effectiveMap.set(`${r.kategorie}:${r.produkt_id}:${r.sales_plattform_id}:${r.jahr}:${r.monat}`, Number(r.wert_manuell))
    }
  }

  // 4. Plattform → zugeordnete Marketingkanäle (= "Marketing inkludiert").
  const kanaeleByPlatt = new Map<string, Set<string>>()
  for (const r of (mktKanalResult.data ?? []) as MktKanalRow[]) {
    if (!kanaeleByPlatt.has(r.sales_plattform_id)) kanaeleByPlatt.set(r.sales_plattform_id, new Set())
    kanaeleByPlatt.get(r.sales_plattform_id)!.add(r.marketingkanal_id)
  }

  // 5. Nettoerlös je Plattform je Monat + Marketingkosten je Plattform je Monat.
  // Marketing-Zeilen tragen die Marketingkanal-ID im sales_plattform_id-Feld (analog PROJ-66/87).
  const netByPlattMonth = new Map<string, number>()       // "plattId:monthIdx"
  const marketingByPlattMonth = new Map<string, number>() // "plattId:monthIdx"
  for (const [key, val] of effectiveMap) {
    const parts = key.split(':') // kategorie : produkt : spId : jahr : monat
    const kategorie = parts[0]
    const spId = parts[2]
    const idx = monthIndex(Number(parts[3]), Number(parts[4]))
    if (kategorie === 'marketing') {
      for (const [plattId, kanaele] of kanaeleByPlatt) {
        if (kanaele.has(spId)) {
          const k = `${plattId}:${idx}`
          marketingByPlattMonth.set(k, (marketingByPlattMonth.get(k) ?? 0) + val)
        }
      }
    } else if (NET_SIGNS[kategorie] !== undefined) {
      const k = `${spId}:${idx}`
      netByPlattMonth.set(k, (netByPlattMonth.get(k) ?? 0) + val * NET_SIGNS[kategorie])
    }
  }

  // 6. Zahlungszeitpunkt je Plattform anwenden.
  const paymentByPlattMonth = new Map<string, number>() // "plattId:monthIdx" → Auszahlung

  for (const einst of auszEinst) {
    if (einst.erster_auszahlung_monat == null || einst.erster_auszahlung_jahr == null) continue
    const V = einst.verschiebung_monate ?? 0
    const R = rhythmusToMonths(einst.auszahlungsrhythmus)
    const anchorIdx = monthIndex(einst.erster_auszahlung_jahr, einst.erster_auszahlung_monat)

    // Erster Zahlungsmonat auf dem Rhythmus-Raster ab Anker, der ≥ Startmonat liegt.
    let payIdx = anchorIdx
    if (payIdx < startIdx) {
      const steps = Math.ceil((startIdx - anchorIdx) / R)
      payIdx = anchorIdx + steps * R
    }

    for (; payIdx <= endIdx; payIdx += R) {
      // Erlös-Fenster [Z − V − R + 1 … Z − V]
      let net = 0
      for (let rev = payIdx - V - R + 1; rev <= payIdx - V; rev++) {
        net += netByPlattMonth.get(`${einst.sales_plattform_id}:${rev}`) ?? 0
      }
      // Marketing wird NICHT mit der Verschiebung verschoben: das Fenster ist am
      // Auszahlungsmonat ausgerichtet (R Monate bis einschließlich Z, ohne V) —
      // wie in der Kurzfristplanung (PROJ-52).
      let mkt = 0
      for (let mi = payIdx - R + 1; mi <= payIdx; mi++) {
        mkt += marketingByPlattMonth.get(`${einst.sales_plattform_id}:${mi}`) ?? 0
      }
      const k = `${einst.sales_plattform_id}:${payIdx}`
      paymentByPlattMonth.set(k, (paymentByPlattMonth.get(k) ?? 0) + net - mkt)
    }
  }

  // 7. Antwort aufbauen.
  const result: { jahr: number; monat: number; sales_plattform_id: string; wert: number }[] = []
  for (const [key, wert] of paymentByPlattMonth) {
    if (wert === 0) continue
    const sep = key.lastIndexOf(':')
    const plattId = key.slice(0, sep)
    const { jahr, monat } = fromIndex(Number(key.slice(sep + 1)))
    result.push({ sales_plattform_id: plattId, jahr, monat, wert: round2(wert) })
  }
  result.sort((a, b) => monthIndex(a.jahr, a.monat) - monthIndex(b.jahr, b.monat))

  return NextResponse.json(result)
}
