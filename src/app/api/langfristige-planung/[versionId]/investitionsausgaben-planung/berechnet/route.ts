import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

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
//   • Beträge werden um die USt aus den Steuereinstellungen DIESER Planversion
//     (PROJ-83: langfristige_ust_kategorie_saetze + langfristige_ust_ebene_auswahl)
//     aufgeschlagen — je Bestellkosten-Position über ihre globale kpi_kategorie_id
//     (gleiche Gesamt/Aufgeteilt-Logik wie Umsatzausgaben PROJ-91).
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
interface UstSatzRow { kategorie_id: string; ebene: number; ust_satz: number | null }

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
  const [grundResult, investResult, globalKatResult, ustSatzResult, ustEbeneResult] = await Promise.all([
    supabase
      .from('langfristige_grundeinstellungen')
      .select('startmonat_monat, startmonat_jahr, planungshorizont_monate')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
    supabase
      .from('langfristige_kpi_kategorien')
      .select('id, name, parent_id, level')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('art', 'lp_investition')
      .limit(2000),
    supabase.from('kpi_categories').select('id, name, parent_id').limit(2000),
    supabase.from('langfristige_ust_kategorie_saetze').select('kategorie_id, ebene, ust_satz').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(1000),
    supabase.from('langfristige_ust_ebene_auswahl').select('kategorie_id, ebene').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
  ])

  if (investResult.error) return NextResponse.json({ error: investResult.error.message }, { status: 500 })
  if (globalKatResult.error) return NextResponse.json({ error: globalKatResult.error.message }, { status: 500 })
  if (ustSatzResult.error) return NextResponse.json({ error: ustSatzResult.error.message }, { status: 500 })
  if (ustEbeneResult.error) return NextResponse.json({ error: ustEbeneResult.error.message }, { status: 500 })

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

  // Globale Kategorie-Namen + Parent-Struktur (zum Übersetzen der Bestellkosten-Kategorie
  // und für die USt-Ebenenzuordnung).
  const globalNameById = new Map<string, string>()
  const parentMap = new Map<string, string>()
  for (const k of (globalKatResult.data ?? []) as GlobalKatRow[]) {
    globalNameById.set(k.id, k.name)
    if (k.parent_id) parentMap.set(k.id, k.parent_id)
  }

  // USt-Sätze + Ebenen-Auswahl dieser Version (PROJ-83) — identische Gesamt/Aufgeteilt-
  // Logik wie Umsatzausgaben (PROJ-91): Satz wird je globaler Kategorie aufgeschlagen.
  const ustRateMap = new Map<string, number>()
  for (const r of (ustSatzResult.data ?? []) as UstSatzRow[]) {
    if (r.ust_satz != null) ustRateMap.set(`${r.kategorie_id}:${r.ebene}`, Number(r.ust_satz))
  }
  const ustEbeneMap = new Map<string, 1 | 2>()
  for (const r of (ustEbeneResult.data ?? []) as { kategorie_id: string; ebene: number }[]) {
    ustEbeneMap.set(r.kategorie_id, r.ebene as 1 | 2)
  }
  function getUstMultiplier(specificId: string | null, parentId: string | null): number {
    if (parentId) {
      const ebene = ustEbeneMap.get(parentId) ?? 1 // default: Gesamt
      if (ebene === 1) {
        const r = ustRateMap.get(`${parentId}:1`)
        if (r != null) return 1 + r / 100
      } else if (specificId) {
        const r = ustRateMap.get(`${specificId}:2`)
        if (r != null) return 1 + r / 100
      }
    }
    if (specificId) {
      const r2 = ustRateMap.get(`${specificId}:2`)
      if (r2 != null) return 1 + r2 / 100
      const r1 = ustRateMap.get(`${specificId}:1`)
      if (r1 != null) return 1 + r1 / 100
    }
    return 1
  }

  // 2. Erstbestellungen + deren Bestellkosten der Version (parallel).
  const [bestellungenResult, bestellKostResult] = await Promise.all([
    supabase
      .from('langfristige_bestellungen')
      .select('id, produkt_id, ist_erstbestellung')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('ist_erstbestellung', true)
      .limit(2000),
    supabase
      .from('langfristige_bestellungen_kosten')
      .select('bestellung_id, kpi_kategorie_id, datum, nettobetrag')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .limit(20000),
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

    // USt-Aufschlag gemäß Steuereinstellungen der Version (Gesamt/Aufgeteilt je Kategorie).
    const ust = getUstMultiplier(k.kpi_kategorie_id, parentMap.get(k.kpi_kategorie_id) ?? null)
    const betrag = netto * ust

    const key = `${untergruppeId}:${produktId}:${jahr}:${monat}`
    resultMap.set(key, (resultMap.get(key) ?? 0) + betrag)
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
