import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { fetchAllRows } from '@/lib/supabase-paginate'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-92: Berechnete Soll-Werte der Investitionsausgaben-Planung (Langfristige
// Planung). Es wird AUSSCHLIESSLICH die feste Übergruppe "Produktinvestitionen
// Einkauf" automatisch befüllt — aus den als ERSTBESTELLUNG markierten Bestellungen
// (PROJ-86) und deren Bestellkosten.
//   • Zuordnung Untergruppe: Bestellkosten-Position (globale ausgaben_kosten-Kategorie:
//     Ware/Inspektion/Shipping/Zoll/Einlagerung) → gleichnamige Einkauf-Untergruppe
//     der Version (Namens-Abgleich; Snapshot aus PROJ-74).
//   • Zuordnung Produkt: das Produkt der Bestellung.
//   • Zeitliche Zuordnung "Nach Zahlungszeitpunkt": der Monat des Fälligkeitsdatums
//     (datum) der Bestellkosten-Position — diese sind bereits in Zahlungstranchen
//     materialisiert (PROJ-64), daher keine erneute Zahlungskonditionen-Berechnung.
//   • Beträge sind NETTO (exkl. USt): die Investitionskostenplanung ist eine Kosten-
//     (Netto-)Sicht. Der USt-Aufschlag erfolgt erst downstream — Brutto in der
//     Liquiditätsauswertung (Cash-Out = Netto × (1 + Satz/100)), Vorsteuer in der
//     Steuerausgaben-Berechnung (Netto × Satz/100).
// Es wird nichts persistiert (rein berechnet).
// Antwort: { data: { kategorie_id, produkt_id, jahr, monat, wert }[] }  (kategorie_id = L2-Untergruppe)

const DEFAULT_PLANUNGSHORIZONT_MONATE = 12
const EINKAUF_UEBERGRUPPE = 'Produktinvestitionen Einkauf'

interface RouteContext {
  params: Promise<{ versionId: string }>
}

interface InvestKatRow { id: string; name: string; parent_id: string | null; level: number }
interface GlobalKatRow { id: string; name: string; parent_id: string | null }
interface BestellungRow { id: string; produkt_id: string; ist_erstbestellung: boolean }
interface BestellKostRow { bestellung_id: string; kpi_kategorie_id: string | null; datum: string | null; nettobetrag: number }

interface Monat { jahr: number; monat: number }

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

// Monatsfenster: Start exakt im Startmonat, insgesamt `horizont` Monate (kein Vorlauf).
function buildMonate(startMonat: number, startJahr: number, horizont: number): Monat[] {
  let y = startJahr
  let m = startMonat
  const months: Monat[] = []
  for (let i = 0; i < horizont; i++) {
    months.push({ jahr: y, monat: m })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return months
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  // 1. Grundeinstellungen (Monatsfenster) + Investitions-Kategorien der Version +
  //    globale Kategorie-Namen (für den Bestellkosten-Namensabgleich) — parallel.
  const [grundResult, investResult, globalKatResult] = await Promise.all([
    supabase
      .from('langfristige_grundeinstellungen')
      .select('startmonat_monat, startmonat_jahr, planungshorizont_monate')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
    fetchAllRows((from, to) =>
      supabase
        .from('langfristige_kpi_kategorien')
        .select('id, name, parent_id, level')
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .eq('art', 'lp_investition')
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows((from, to) => supabase.from('kpi_categories').select('id, name, parent_id').order('id', { ascending: true }).range(from, to)),
  ])

  if (investResult.error) return NextResponse.json({ error: investResult.error.message }, { status: 500 })
  if (globalKatResult.error) return NextResponse.json({ error: globalKatResult.error.message }, { status: 500 })

  const grund = grundResult.data
  const now = new Date()
  const startMonat = grund?.startmonat_monat ?? now.getMonth() + 1
  const startJahr = grund?.startmonat_jahr ?? now.getFullYear()
  const horizont = grund?.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
  const monate = buildMonate(startMonat, startJahr, horizont)
  const monatSet = new Set(monate.map(m => `${m.jahr}:${m.monat}`))

  // Einkauf-Untergruppen der Version: Name (normalisiert) → Untergruppen-ID.
  const investKats = (investResult.data ?? []) as InvestKatRow[]
  const einkaufUebergruppe = investKats.find(k => k.level === 1 && norm(k.name) === norm(EINKAUF_UEBERGRUPPE))
  const einkaufUntergruppeByName = new Map<string, string>()
  if (einkaufUebergruppe) {
    for (const k of investKats) {
      if (k.level === 2 && k.parent_id === einkaufUebergruppe.id) {
        einkaufUntergruppeByName.set(norm(k.name), k.id)
      }
    }
  }

  // Ohne Einkauf-Untergruppen gibt es nichts zu berechnen.
  if (einkaufUntergruppeByName.size === 0) {
    return NextResponse.json({ data: [] })
  }

  // Globale Kategorie-Namen (zum Übersetzen der Bestellkosten-Kategorie auf die
  // gleichnamige Einkauf-Untergruppe der Version).
  const globalNameById = new Map<string, string>()
  for (const k of (globalKatResult.data ?? []) as GlobalKatRow[]) {
    globalNameById.set(k.id, k.name)
  }

  // 2. Erstbestellungen + deren Bestellkosten der Version (parallel).
  const [bestellungenResult, bestellKostResult] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('langfristige_bestellungen')
        .select('id, produkt_id, ist_erstbestellung')
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .eq('ist_erstbestellung', true)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('langfristige_bestellungen_kosten')
        .select('bestellung_id, kpi_kategorie_id, datum, nettobetrag')
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .order('id', { ascending: true })
        .range(from, to)
    ),
  ])

  if (bestellungenResult.error) return NextResponse.json({ error: bestellungenResult.error.message }, { status: 500 })
  if (bestellKostResult.error) return NextResponse.json({ error: bestellKostResult.error.message }, { status: 500 })

  // Erstbestellung-ID → Produkt der Version.
  const produktByBestellung = new Map<string, string>()
  for (const b of (bestellungenResult.data ?? []) as BestellungRow[]) {
    produktByBestellung.set(b.id, b.produkt_id)
  }

  if (produktByBestellung.size === 0) {
    return NextResponse.json({ data: [] })
  }

  // 3. Bestellkosten je (Einkauf-Untergruppe × Produkt × Fälligkeitsmonat) summieren.
  // key: `${untergruppeId}:${produktId}:${jahr}:${monat}` → Netto-Summe
  const resultMap = new Map<string, number>()
  for (const k of (bestellKostResult.data ?? []) as BestellKostRow[]) {
    const produktId = produktByBestellung.get(k.bestellung_id)
    if (!produktId) continue // nur Erstbestellungen
    if (!k.kpi_kategorie_id || !k.datum) continue
    const globalName = globalNameById.get(k.kpi_kategorie_id)
    if (!globalName) continue
    const untergruppeId = einkaufUntergruppeByName.get(norm(globalName))
    if (!untergruppeId) continue // z.B. "Wertverlust Ware" hat keine Bestellkosten-Quelle

    const d = new Date(k.datum + 'T00:00:00Z')
    const jahr = d.getUTCFullYear()
    const monat = d.getUTCMonth() + 1
    if (!monatSet.has(`${jahr}:${monat}`)) continue // außerhalb des Planungsfensters

    const netto = Number(k.nettobetrag)
    if (!(netto > 0)) continue

    // NETTO (Kostensicht) — kein USt-Aufschlag; dieser erfolgt downstream (Liquidität/Steuer).
    const key = `${untergruppeId}:${produktId}:${jahr}:${monat}`
    resultMap.set(key, (resultMap.get(key) ?? 0) + netto)
  }

  const data = []
  for (const [key, wert] of resultMap) {
    const [katId, prodId, jahrStr, monatStr] = key.split(':')
    data.push({
      kategorie_id: katId,
      produkt_id: prodId,
      jahr: parseInt(jahrStr, 10),
      monat: parseInt(monatStr, 10),
      wert: round2(wert),
    })
  }

  return NextResponse.json({ data })
}
