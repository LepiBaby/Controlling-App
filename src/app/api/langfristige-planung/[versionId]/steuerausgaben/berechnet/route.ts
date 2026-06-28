import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { GET as salesBerechnetGET } from '../../sales-plattform-planung/berechnet/route'
import { GET as umsatzausgabenBerechnetGET } from '../../umsatzausgaben/berechnet/route'
import { GET as investitionsausgabenBerechnetGET } from '../../investitionsausgaben-planung/berechnet/route'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-93: Berechnete Soll-Werte der Steuerausgaben-Planung (Langfristige Planung).
// Spiegelt die kurzfristige /steuerausgaben-planung/berechnet-Logik (PROJ-71), aber:
//   • monatsbasiert (Start exakt im Startmonat, allgemeiner Horizont) statt KW,
//   • KEINE Ist-Daten — alle Quellen sind Soll-Werte DIESER Planversion,
//   • Zahlungsverschiebung monatsbasiert (Folgemonat / Folgemonat des Quartals +
//     Zahlungsverschiebung-Tage) gemäß PROJ-83.
// Es wird nichts persistiert (rein berechnet).
// Antwort: { data: { kategorie_id, jahr, monat, wert }[] }
//
// Reuse-Strategie: Die rechenintensiven Quell-Soll-Werte (Sales-Plattform-Planung,
// Umsatzausgaben, Investitionsausgaben) werden über die bestehenden berechnet-Route-
// Handler IN-PROCESS aufgerufen (kein HTTP, keine Logik-Duplikation). Manuelle
// Overrides der jeweiligen Quelle werden zusätzlich eingelesen und überlagern den
// berechneten Wert (effektiver Soll = manuell ?? berechnet).
//
// USt-Semantik je Quelle (dokumentiert für QA — vgl. PROJ-71):
// USt-Satz-Auflösung exakt wie kurzfristig (findL1Ancestor / getUstSatz /
// getUstSatzForProdukt / getUstSatzHierarchisch); alle Beträge sind BRUTTO inkl. USt
// → extractVorsteuer(betrag, satz). Pro Quelle:
//   A1 Produktverkäufe: getUstSatzForProdukt; Netto = Bruttoumsatz − Rückerstattungen → extractVorsteuer
//   A2 sonstige Einnahmen: getUstSatz → extractVorsteuer
//   B1 Verkaufsgebühr/Retouren/Marketing (SPP): getUstSatz/Marketing-Kanal → extractVorsteuer
//   B2 Umsatzausgaben: getUstSatz → extractVorsteuer; Marketing ausgeschlossen (Doppelzählung mit B1)
//   B3 Operativkosten: NETTO → Vorsteuer = Netto × Satz/100 (getUstSatzHierarchisch, 3-stufig)
//   B4 Investitionsausgaben: getUstSatzHierarchisch → extractVorsteuer
//   B5 Finanzierungsausgaben: getUstSatz → extractVorsteuer
//   B6 Einfuhrumsatzsteuer: mindert die zu zahlende USt im Monat ihres Anfalls
// Zahlungsziel-Rückrechnung (PROJ-93, analog kurzfristig PROJ-71): Der USt-/Vorsteuer-
// Anfall hängt am Rechnungs-/Leistungsmonat, nicht am Zahlungsmonat. Umgesetzt für:
//   • Vertrieb (Versand/Lager/Retouren/Kulanz) + Marketing — MONATSWEISE (umsatzEff ist
//     bereits monats-aggregiert; der Vorwärts-Shift war ceil(Tage/30) Monate → exakt invers).
//   • Produktkosten Shipping/Inspektion/Einlagerung/Zoll — BERECHNETER Anteil TAGESGENAU
//     aus den Roh-Bestellkosten (datum = Basisdatum + Zahlungsziel; monatsweise Näherung wäre
//     bei kleinen Zielen falsch); MANUELL überschriebene Zellen über umsatzEff (monatsweise)
//     + Dedup gegen die Roh-Bestellkosten (QA-1).
//   • Ware — am BESTELLDATUM verbucht (wie kurzfristig): die Vorsteuer entsteht mit der
//     Bestellung/Rechnung, nicht mit den Zahlungstranchen (Zahlungskonditionen).
// Noch NICHT rückgerechnet: B3 Operativkosten, B5 Finanzierung — am Quell-/Anfallsmonat.

const DEFAULT_PLANUNGSHORIZONT_MONATE = 12

interface RouteContext {
  params: Promise<{ versionId: string }>
}

interface KatRow { id: string; name: string; parent_id: string | null; type: string; level: number }
interface UstSatzRow { kategorie_id: string; ebene: number; ust_satz: number | null }
interface Monat { jahr: number; monat: number }

function round2(x: number): number {
  return Math.round(x * 100) / 100
}
function monthIndex(jahr: number, monat: number): number {
  return jahr * 12 + (monat - 1)
}
function fromIndex(idx: number): Monat {
  return { jahr: Math.floor(idx / 12), monat: (idx % 12) + 1 }
}
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

// Vorsteueranteil aus einem BRUTTO-Betrag (USt herausrechnen). ustSatz in Prozent.
// Exakt wie kurzfristig (steuerausgaben-planung/berechnet).
function extractVorsteuer(brutto: number, ustSatz: number): number {
  if (ustSatz <= 0 || brutto === 0) return 0
  return brutto * ustSatz / (100 + ustSatz)
}

// Monatsbasierte Zahlungsverschiebung der UST-Zahllast (PROJ-83):
//   monatlich     → Folgemonat
//   quartalsweise → Folgemonat des Quartals (Q1→Apr, Q2→Jul, Q3→Okt, Q4→Jan FJ)
// Zahlungsverschiebung (Tage) verschiebt zusätzlich (auf Monatsebene: ceil(Tage/30)).
function shiftUstPayment(
  jahr: number,
  monat: number,
  frequenz: 'monatlich' | 'quartalsweise',
  verschiebungTage: number,
): Monat {
  let dueIdx: number
  if (frequenz === 'quartalsweise') {
    const q = Math.floor((monat - 1) / 3)
    const quartalsEndeMonat = q * 3 + 3
    dueIdx = monthIndex(jahr, quartalsEndeMonat) + 1
  } else {
    dueIdx = monthIndex(jahr, monat) + 1
  }
  const zielMonate = Math.ceil(Math.max(0, verschiebungTage) / 30)
  return fromIndex(dueIdx + zielMonate)
}

// Liest den JSON-Body eines in-process aufgerufenen Route-Handlers (oder null).
async function readHandler<T>(res: Response): Promise<T | null> {
  try {
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  // ── 1. Grundeinstellungen + globales KPI-Modell ───────────────────────────────
  const [grundResult, katsResult, ustEinstResult] = await Promise.all([
    supabase
      .from('langfristige_grundeinstellungen')
      .select('startmonat_monat, startmonat_jahr, planungshorizont_monate')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
    fetchAllRows((from, to) => supabase.from('kpi_categories').select('id, name, parent_id, type, level').order('id', { ascending: true }).range(from, to)),
    supabase
      .from('langfristige_ust_einstellungen')
      .select('zahlungsfrequenz, zahlungsverschiebung_tage, einfuhrust_satz, einfuhrust_zahlungsziel_tage')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
  ])
  if (katsResult.error) return NextResponse.json({ error: katsResult.error.message }, { status: 500 })

  const grund = grundResult.data
  const now = new Date()
  const startMonat = grund?.startmonat_monat ?? now.getMonth() + 1
  const startJahr = grund?.startmonat_jahr ?? now.getFullYear()
  const horizont = grund?.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
  const monate = buildMonate(startMonat, startJahr, horizont)
  const monatSet = new Set(monate.map(m => `${m.jahr}:${m.monat}`))

  const ustEinst = ustEinstResult.data
  const frequenz: 'monatlich' | 'quartalsweise' = ustEinst?.zahlungsfrequenz === 'quartalsweise' ? 'quartalsweise' : 'monatlich'
  const verschiebungTage = Number(ustEinst?.zahlungsverschiebung_tage ?? 0)
  const einfuhrSatz = Number(ustEinst?.einfuhrust_satz ?? 0)
  const einfuhrZielTage = Number(ustEinst?.einfuhrust_zahlungsziel_tage ?? 0)

  // ── 2. Kategorie-Struktur auflösen ────────────────────────────────────────────
  const kats = (katsResult.data ?? []) as KatRow[]
  const parentMap = new Map<string, string>()
  const katById = new Map<string, KatRow>()
  for (const k of kats) {
    katById.set(k.id, k)
    if (k.parent_id) parentMap.set(k.id, k.parent_id)
  }

  // „Steuern"-Subtree: Einfuhrumsatzsteuer- + Umsatzsteuer-Leaf-Kategorien.
  const steuerRoot = kats.find(k => k.type === 'ausgaben_kosten' && k.name.trim().toLowerCase() === 'steuern')
  let einfuhrLeafId: string | null = null
  let umsatzsteuerLeafId: string | null = null
  if (steuerRoot) {
    // Leaf-Kandidaten = direkte Kinder oder Enkel unter „Steuern".
    const steuerDescendants = kats.filter(k => {
      let pid: string | undefined = k.parent_id ?? undefined
      let depth = 0
      while (pid && depth < 5) {
        if (pid === steuerRoot.id) return true
        pid = parentMap.get(pid)
        depth++
      }
      return false
    })
    for (const k of steuerDescendants) {
      const n = k.name.toLowerCase()
      if (n.includes('einfuhr') && einfuhrLeafId === null) einfuhrLeafId = k.id
      else if (n.includes('umsatzsteuer') && !n.includes('einfuhr') && umsatzsteuerLeafId === null) umsatzsteuerLeafId = k.id
    }
  }

  // Bestellkosten-Basis-Kategorien (Ware/Versand/Zoll) unter „Produkt" für Einfuhr-USt.
  // Exakte Namen, damit z. B. „Wertverlust Ware" oder „Einlagerung" NICHT mitzählen.
  const EINFUHR_BASIS_NAMEN = new Set(['ware', 'versand', 'shipping', 'zoll'])
  const produktParent = kats.find(k => k.type === 'ausgaben_kosten' && k.level === 1 && k.name.trim().toLowerCase() === 'produkt')
  const einfuhrBasisKatIds = new Set<string>()
  if (produktParent) {
    for (const k of kats) {
      if (k.parent_id !== produktParent.id) continue
      if (EINFUHR_BASIS_NAMEN.has(k.name.trim().toLowerCase())) {
        einfuhrBasisKatIds.add(k.id)
      }
    }
  }

  // Produktkosten-L2-Kategorien (Shipping/Inspektion/Einlagerung/Zoll) unter „Produkt"
  // für die TAGESGENAUE B2-Zahlungsziel-Rückrechnung (PROJ-93). Exakte Namen. Ware bleibt
  // außen vor (eigene Zahlungskonditionen-Logik, kein einzelnes Zahlungsziel).
  // Ware (2c1f…) wird separat über das Bestelldatum verbucht (Zahlungskonditionen statt
  // einzelnem Zahlungsziel) — wie kurzfristig.
  const PRODUKTKOSTEN_ZT_NAMEN = new Set(['shipping', 'inspektion', 'einlagerung', 'zoll'])
  const produktkostenKatByName = new Map<string, string>()
  let wareKatId: string | null = null
  if (produktParent) {
    for (const k of kats) {
      if (k.parent_id !== produktParent.id) continue
      const n = k.name.trim().toLowerCase()
      if (PRODUKTKOSTEN_ZT_NAMEN.has(n)) produktkostenKatByName.set(n, k.id)
      else if (n === 'ware') wareKatId = k.id
    }
  }

  // Einnahmen-„Produktverkäufe"-Kategorie (für A1-Satz) + Marketing-L1 (für B2-Filter).
  const produktverkaeufeKatId = kats.find(k =>
    (k.type === 'einnahmen' || k.type === 'umsatz') &&
    (k.name.toLowerCase().includes('produktverkäufe') || k.name.toLowerCase().includes('produktverkaeufe')),
  )?.id ?? null
  const einnahmenKatIds = new Set(kats.filter(k => k.type === 'einnahmen' || k.type === 'umsatz').map(k => k.id))

  // ── 3. USt-Sätze + Pflegeebene → satz-basierte Auflösung (wie kurzfristig) ──────
  const [ustSatzResult, ustEbeneResult, investKatResult] = await Promise.all([
    fetchAllRows((from, to) => supabase.from('langfristige_ust_kategorie_saetze').select('kategorie_id, ebene, ust_satz').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
    supabase.from('langfristige_ust_ebene_auswahl').select('kategorie_id, ebene').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(1000),
    fetchAllRows((from, to) => supabase.from('langfristige_kpi_kategorien').select('id, parent_id').eq('user_id', user!.id).eq('plan_version_id', versionId).eq('art', 'lp_investition').order('id', { ascending: true }).range(from, to)),
  ])
  const ustRateMap = new Map<string, number>()
  for (const r of (ustSatzResult.data ?? []) as UstSatzRow[]) {
    if (r.ust_satz != null) ustRateMap.set(`${r.kategorie_id}:${r.ebene}`, Number(r.ust_satz))
  }
  const ustEbeneMap = new Map<string, 1 | 2>()
  for (const r of (ustEbeneResult.data ?? []) as { kategorie_id: string; ebene: number }[]) {
    ustEbeneMap.set(r.kategorie_id, r.ebene as 1 | 2)
  }
  // Versions-Investitionsbaum (lp_investition) für die Invest-Satz-Auflösung (B4): Die
  // Ebenen-Auswahl liegt auf der GLOBALEN „Produktinvestitionen"-L1, die Aufgeteilt-Sätze
  // auf den VERSIONS-Gruppen (ebene 1) — analog zum Produktverkäufe-Muster.
  const investParentMap = new Map<string, string>()
  for (const r of (investKatResult.data ?? []) as { id: string; parent_id: string | null }[]) {
    if (r.parent_id) investParentMap.set(r.id, r.parent_id)
  }
  const produktinvestitionenL1Id = kats.find(k => k.type === 'ausgaben_kosten' && k.level === 1 && k.name.trim().toLowerCase() === 'produktinvestitionen')?.id ?? null

  // ── USt-Satz-Auflösung — exakt wie kurzfristig (steuerausgaben-planung/berechnet) ──
  // Gibt PROZENT-Sätze zurück (nicht Multiplikatoren). Respektiert die Gesamt/Aufgeteilt-
  // Auswahl (ebene 1 = Gesamt → L1-Satz; ebene 2 = Aufgeteilt → Untergruppen-Satz).

  // L1-Vorfahre einer Kategorie über den globalen Parent-Baum.
  function findL1Ancestor(katId: string): string {
    let id = katId
    while (parentMap.has(id)) id = parentMap.get(id)!
    return id
  }

  // Satz für eine beliebige Einnahmen-/Ausgaben-Kategorie (Gesamt → L1; Aufgeteilt → katId:2).
  function getUstSatz(katId: string): number {
    const l1Id = findL1Ancestor(katId)
    const selectedEbene = ustEbeneMap.get(l1Id) ?? 1
    if (selectedEbene === 1) return ustRateMap.get(`${l1Id}:1`) ?? 0
    return ustRateMap.get(`${katId}:2`) ?? 0
  }

  // Satz für ein Produktverkäufe-Produkt (Gesamt → L1; Aufgeteilt → Produkt-Satz).
  function getUstSatzForProdukt(produktId: string): number {
    if (!produktverkaeufeKatId) return 0
    const ebene = ustEbeneMap.get(produktverkaeufeKatId) ?? 1
    if (ebene === 1) return ustRateMap.get(`${produktverkaeufeKatId}:1`) ?? 0
    return ustRateMap.get(`${produktId}:1`) ?? ustRateMap.get(`${produktId}:2`) ?? 0
  }

  // Hierarchische Suche (für mehrstufige Bäume): Aufgeteilt → von katId nach oben den
  // ersten ebene-2-Satz finden. Für Operativkosten/Investitionsausgaben (3-stufig).
  function getUstSatzHierarchisch(katId: string): number {
    const l1Id = findL1Ancestor(katId)
    const selectedEbene = ustEbeneMap.get(l1Id) ?? 1
    if (selectedEbene === 1) return ustRateMap.get(`${l1Id}:1`) ?? 0
    let id: string | undefined = katId
    while (id) {
      const rate = ustRateMap.get(`${id}:2`)
      if (rate != null) return rate
      id = parentMap.get(id)
    }
    return 0
  }

  // Satz für eine Investitionsausgaben-Kategorie (VERSIONS-Baum). Respektiert die
  // Gesamt/Aufgeteilt-Auswahl der globalen „Produktinvestitionen"-L1: Gesamt → deren
  // L1-Satz; Aufgeteilt → vom Eintrag im Versions-Invest-Baum nach oben den ersten
  // gepflegten Satz (Versions-Gruppe, ebene 1 — analog Produkt). Nötig, weil die Invest-
  // Kategorien versions-eigen sind und getUstSatzHierarchisch (globaler Baum) sie sonst
  // auf 0 auflöst.
  function getUstSatzInvest(katId: string): number {
    if (!produktinvestitionenL1Id) return getUstSatzHierarchisch(katId)
    const selectedEbene = ustEbeneMap.get(produktinvestitionenL1Id) ?? 1
    if (selectedEbene === 1) return ustRateMap.get(`${produktinvestitionenL1Id}:1`) ?? 0
    let id: string | undefined = katId
    let depth = 0
    while (id && depth < 6) {
      const rate = ustRateMap.get(`${id}:1`) ?? ustRateMap.get(`${id}:2`)
      if (rate != null) return rate
      id = investParentMap.get(id)
      depth++
    }
    return 0
  }

  // Satz für die SPP-Posten (Verkaufsgebühr/Retouren/Marketing) anhand ihrer globalen
  // Steuer-Kategorie. Marketing: per Kanal (Aufgeteilt) bzw. Marketing-L1 (Gesamt).
  const vkGebKatId = kats.find(k => k.type === 'ausgaben_kosten' && (k.name.toLowerCase().includes('verkaufsgebühr') || k.name.toLowerCase().includes('verkaufsgebuehr')))?.id ?? null
  const retourenKatId = kats.find(k => k.type === 'ausgaben_kosten' && k.name.trim().toLowerCase() === 'retouren')?.id ?? null
  const marketingL1Id = kats.find(k => k.type === 'ausgaben_kosten' && k.level === 1 && k.name.toLowerCase() === 'marketing')?.id ?? null

  // Vertriebs-L2-Kategorien (Versand/Lager/Retouren/Kulanz) für die Zahlungsziel-
  // Rückrechnung der B2-Vorsteuer — exakt wie in der Umsatzausgaben-Route (PROJ-91)
  // aufgelöst, damit die IDs zu den umsatzEff-Schlüsseln passen.
  let versandL2: string | null = null
  let lagerL2: string | null = null
  let retourenL2: string | null = null
  let kulanzL2: string | null = null
  for (const k of kats) {
    if (k.type !== 'ausgaben_kosten' || k.level !== 2) continue
    const n = k.name.toLowerCase()
    if (n.includes('versand') && versandL2 === null) versandL2 = k.id
    if (n.includes('lager') && lagerL2 === null) lagerL2 = k.id
    if (n.includes('retouren') && retourenL2 === null) retourenL2 = k.id
    if ((n.includes('ersatz') || n.includes('kulanz')) && kulanzL2 === null) kulanzL2 = k.id
  }

  function getSppSatz(kategorie: string, zweitId: string): number {
    if (kategorie === 'verkaufsgebuehr') return vkGebKatId ? getUstSatz(vkGebKatId) : 0
    if (kategorie === 'retouren') return retourenKatId ? getUstSatz(retourenKatId) : 0
    // marketing
    if (marketingL1Id && (ustEbeneMap.get(marketingL1Id) ?? 1) === 2) {
      return ustRateMap.get(`${zweitId}:2`) ?? ustRateMap.get(`${zweitId}:1`) ?? ustRateMap.get(`${marketingL1Id}:1`) ?? 0
    }
    return marketingL1Id ? (ustRateMap.get(`${marketingL1Id}:1`) ?? 0) : 0
  }

  // ── 4. Akkumulatoren ──────────────────────────────────────────────────────────
  // Auto-Werte je (kategorie_id × Monat) → wert. Nur Einfuhr-USt + Umsatzsteuer.
  const resultMap = new Map<string, number>()
  function addResult(katId: string | null, due: Monat, val: number) {
    if (!katId || !monatSet.has(`${due.jahr}:${due.monat}`)) return
    const key = `${katId}:${due.jahr}:${due.monat}`
    resultMap.set(key, (resultMap.get(key) ?? 0) + val)
  }

  // Netto-USt je Quellmonat (vor Gruppierung/Verschiebung). idx → Betrag.
  const ustNetByMonth = new Map<number, number>()
  // Komponenten je Quellmonat für die Aufschlüsselung: output (Umsatzsteuer/Zahllast,
  // positiv), vorsteuer (B1–B5, negativ), einfuhr (B6-Abzug, negativ). Summe = netto.
  type UstKomponente = 'output' | 'vorsteuer' | 'einfuhr'
  const komponentenByMonth = new Map<number, { output: number; vorsteuer: number; einfuhr: number }>()
  function addUst(jahr: number, monat: number, val: number, komponente: UstKomponente) {
    const idx = monthIndex(jahr, monat)
    ustNetByMonth.set(idx, (ustNetByMonth.get(idx) ?? 0) + val)
    let comp = komponentenByMonth.get(idx)
    if (!comp) { comp = { output: 0, vorsteuer: 0, einfuhr: 0 }; komponentenByMonth.set(idx, comp) }
    comp[komponente] += val
  }
  // Einfuhr-USt je Anfalls-Monat (für B6-Abzug).
  const einfuhrByMonth = new Map<number, number>()
  // Einfuhr-USt je Produkt × Zielmonat (für die Aufschlüsselung „nach Produkt").
  // key: `${produktId|'__none__'}:${jahr}:${monat}`
  const einfuhrProduktByMonth = new Map<string, number>()
  const einfuhrProduktNamen = new Map<string, string>()
  // Aufschlüsselung der Umsatzsteuer (nur Soll — die LP kennt ohnehin nur Soll).
  const umsatzsteuerKomponentenBreakdown: Array<{
    komponente: UstKomponente; jahr: number; monat: number; wert: number
  }> = []

  // Dummy-Kontext für in-process Handler-Aufrufe.
  const innerCtx: RouteContext = { params: Promise.resolve({ versionId }) }
  const innerReq = () => new Request('http://internal/steuerausgaben-berechnet')

  // ── 5. Einfuhrumsatzsteuer ────────────────────────────────────────────────────
  // Quelle: Bestellungen + Bestellkosten der Version. Fiskalverzollte Produkte werden
  // übersprungen. Basis = Ware + Versand + Zoll. Zielmonat = Ankunftsmonat + Zahlungsziel.
  if (einfuhrLeafId && einfuhrSatz > 0) {
    const [bestellResult, fiskalResult, produktNamenResult] = await Promise.all([
      fetchAllRows((from, to) => supabase.from('langfristige_bestellungen').select('id, produkt_id, ankunftsdatum, verfuegbarkeitsdatum, bestelldatum').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
      supabase.from('langfristige_einfuhrust_fiskalverzollung').select('produkt_id, fiskalverzollung').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
      supabase.from('langfristige_kpi_kategorien').select('id, name').eq('user_id', user!.id).eq('plan_version_id', versionId).eq('art', 'lp_produkt').eq('level', 1).limit(500),
    ])
    for (const p of (produktNamenResult.data ?? []) as Array<{ id: string; name: string }>) {
      einfuhrProduktNamen.set(p.id, p.name)
    }
    const bestellungen = (bestellResult.data ?? []) as Array<{ id: string; produkt_id: string; ankunftsdatum: string | null; verfuegbarkeitsdatum: string | null; bestelldatum: string | null }>
    const fiskalSet = new Set<string>(((fiskalResult.data ?? []) as Array<{ produkt_id: string; fiskalverzollung: boolean }>).filter(r => r.fiskalverzollung).map(r => r.produkt_id))

    const bestellById = new Map(bestellungen.map(b => [b.id, b]))
    const relevantIds = bestellungen.filter(b => !fiskalSet.has(b.produkt_id)).map(b => b.id)

    if (relevantIds.length > 0 && einfuhrBasisKatIds.size > 0) {
      const { data: kostData } = await fetchAllRows((from, to) => supabase
        .from('langfristige_bestellungen_kosten')
        .select('bestellung_id, kpi_kategorie_id, nettobetrag')
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .in('bestellung_id', relevantIds)
        .order('id', { ascending: true }).range(from, to))

      // Basis je Bestellung (nur Ware/Versand/Zoll).
      const basisByBestellung = new Map<string, number>()
      for (const k of (kostData ?? []) as Array<{ bestellung_id: string; kpi_kategorie_id: string | null; nettobetrag: number }>) {
        if (!k.kpi_kategorie_id || !einfuhrBasisKatIds.has(k.kpi_kategorie_id)) continue
        basisByBestellung.set(k.bestellung_id, (basisByBestellung.get(k.bestellung_id) ?? 0) + Number(k.nettobetrag))
      }
      for (const [bestellungId, basis] of basisByBestellung) {
        if (basis <= 0) continue
        const best = bestellById.get(bestellungId)
        const datumStr = best?.ankunftsdatum ?? best?.verfuegbarkeitsdatum ?? best?.bestelldatum
        if (!datumStr) continue
        // Zahlungsdatum = Ankunftsdatum + Zahlungsziel (Tage); dessen Kalendermonat
        // ist der Zielmonat (faithful zu PROJ-71 — keine ceil(Tage/30)-Näherung).
        const d = new Date(datumStr + 'T00:00:00Z')
        const zahlDatum = new Date(d.getTime() + Math.max(0, einfuhrZielTage) * 86400000)
        const ziel = { jahr: zahlDatum.getUTCFullYear(), monat: zahlDatum.getUTCMonth() + 1 }
        const zielIdx = monthIndex(ziel.jahr, ziel.monat)
        const betrag = round2(basis * einfuhrSatz / 100)
        addResult(einfuhrLeafId, ziel, betrag)
        einfuhrByMonth.set(zielIdx, (einfuhrByMonth.get(zielIdx) ?? 0) + betrag)
        // Produkt-Aufschlüsselung (nur innerhalb des Horizonts, mirror von addResult)
        if (monatSet.has(`${ziel.jahr}:${ziel.monat}`)) {
          const pk = `${best?.produkt_id ?? '__none__'}:${ziel.jahr}:${ziel.monat}`
          einfuhrProduktByMonth.set(pk, (einfuhrProduktByMonth.get(pk) ?? 0) + betrag)
        }
      }
    }
  }

  // ── 6. Umsatzsteuer ───────────────────────────────────────────────────────────
  if (umsatzsteuerLeafId) {
    // Quell-Soll-Werte parallel laden (berechnet-Handler + manuelle Tabellen).
    const [
      salesRes, umsatzRes, investRes,
      salesManualRes, umsatzManualRes, investManualRes,
      einnahmenManualRes, operativManualRes, finanzManualRes,
      versandPlattRes, lagerPlattRes, kulanzPlattRes, retourenAllgRes, marketingEinstRes,
    ] = await Promise.all([
      salesBerechnetGET(innerReq(), innerCtx).then(r => readHandler<Array<{ kategorie: string; produkt_id: string; sales_plattform_id: string; jahr: number; monat: number; wert: number }>>(r)),
      umsatzausgabenBerechnetGET(innerReq(), innerCtx).then(r => readHandler<{ data: Array<{ kategorie_id: string; produkt_id: string; jahr: number; monat: number; wert: number }>; unassigned_marketing_kat_ids?: string[] }>(r)),
      investitionsausgabenBerechnetGET(innerReq(), innerCtx).then(r => readHandler<{ data: Array<{ kategorie_id: string; produkt_id: string; jahr: number; monat: number; wert: number }> }>(r)),
      fetchAllRows((from, to) => supabase.from('langfristige_sales_plattform_planung').select('kategorie, produkt_id, sales_plattform_id, jahr, monat, wert_manuell').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
      fetchAllRows((from, to) => supabase.from('langfristige_umsatzausgaben_planung').select('kategorie_id, produkt_id, jahr, monat, betrag_manuell').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
      fetchAllRows((from, to) => supabase.from('langfristige_investitionsausgaben_planung').select('kategorie_id, produkt_id, jahr, monat, betrag_manuell').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
      fetchAllRows((from, to) => supabase.from('langfristige_einnahmen_planung').select('kategorie_id, jahr, monat, betrag_manuell').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
      fetchAllRows((from, to) => supabase.from('langfristige_operativekosten_planung').select('kategorie_id, jahr, monat, betrag').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
      fetchAllRows((from, to) => supabase.from('langfristige_finanzierungsausgaben_planung').select('kategorie_id, jahr, monat, betrag').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
      // Zahlungsziele für die B2-Rückrechnung (Vertrieb + Marketing).
      supabase.from('langfristige_versand_plattform_einstellungen').select('zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(100),
      supabase.from('langfristige_lager_plattform_einstellungen').select('zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(100),
      supabase.from('langfristige_ersatzteile_kulanz_plattform_einstellungen').select('zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(100),
      supabase.from('langfristige_retouren_allgemein_einstellungen').select('zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).maybeSingle(),
      supabase.from('langfristige_marketing_einstellungen').select('marketingkanal_id, zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
    ])

    // Produktkosten-Zahlungsziele + Roh-Bestellkosten (für die tagesgenaue B2-Rückrechnung).
    // SEPARAT nach dem Haupt-Promise.all, damit die von umsatzausgabenBerechnetGET frisch
    // (re-)generierten langfristige_bestellungen_kosten gelesen werden (kein Race).
    const [kostenGlobalRes, bestellungenFlagRes, bestellKostenAllRes] = await Promise.all([
      supabase.from('langfristige_produktinformationen_kosten_global').select('shipping_zahlungsziel_tage, inspektion_zahlungsziel_tage, einlagerung_zahlungsziel_tage, zoll_zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).maybeSingle(),
      fetchAllRows((from, to) => supabase.from('langfristige_bestellungen').select('id, produkt_id, ist_erstbestellung, bestelldatum').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
      fetchAllRows((from, to) => supabase.from('langfristige_bestellungen_kosten').select('bestellung_id, kpi_kategorie_id, datum, nettobetrag').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
    ])

    // — Sales-Plattform-Planung (A1 + B1): effektiv = manuell ?? berechnet —
    type SalesKey = string // `${kategorie}:${produkt}:${plattform}:${jahr}:${monat}`
    const salesEff = new Map<SalesKey, number>()
    for (const r of (salesRes ?? [])) {
      salesEff.set(`${r.kategorie}:${r.produkt_id}:${r.sales_plattform_id}:${r.jahr}:${r.monat}`, Number(r.wert))
    }
    for (const r of ((salesManualRes.data ?? []) as Array<{ kategorie: string; produkt_id: string; sales_plattform_id: string; jahr: number; monat: number; wert_manuell: number | null }>)) {
      if (r.wert_manuell != null) salesEff.set(`${r.kategorie}:${r.produkt_id}:${r.sales_plattform_id}:${r.jahr}:${r.monat}`, Number(r.wert_manuell))
    }

    // A1: Produktverkäufe-Zahllast je Produkt×Plattform×Monat aus Netto = Brutto − Rückerstattungen.
    // B1: Verkaufsgebühr/Retouren/Marketing-Vorsteuer (Brutto inkl. USt) extrahieren.
    for (const [key, wert] of salesEff) {
      const [kategorie, , zweitId, jahrStr, monatStr] = key.split(':')
      const jahr = Number(jahrStr), monat = Number(monatStr)
      if (kategorie === 'bruttoumsatz' || kategorie === 'rueckerstattungen') continue // im Netto verarbeitet
      if (kategorie === 'verkaufsgebuehr' || kategorie === 'retouren' || kategorie === 'marketing') {
        // B1 — Brutto inkl. USt → Vorsteuer herausrechnen. Satz aus der globalen Steuer-
        // Kategorie (zweitId = sales_plattform_id bzw. bei Marketing der Kanal).
        const satz = getSppSatz(kategorie, zweitId)
        addUst(jahr, monat, -extractVorsteuer(Number(wert), satz), 'vorsteuer')
      }
    }
    // A1: Netto = Brutto − Rückerstattungen je Produkt×Plattform×Monat.
    {
      const bruttoBy = new Map<string, number>() // `${produkt}:${plattform}:${jahr}:${monat}`
      const erstattBy = new Map<string, number>()
      for (const [key, wert] of salesEff) {
        const [kategorie, produktId, plattformId, jahrStr, monatStr] = key.split(':')
        const coord = `${produktId}:${plattformId}:${jahrStr}:${monatStr}`
        if (kategorie === 'bruttoumsatz') bruttoBy.set(coord, (bruttoBy.get(coord) ?? 0) + Number(wert))
        else if (kategorie === 'rueckerstattungen') erstattBy.set(coord, (erstattBy.get(coord) ?? 0) + Number(wert))
      }
      for (const [coord, brutto] of bruttoBy) {
        const [produktId, , jahrStr, monatStr] = coord.split(':')
        const netto = brutto - (erstattBy.get(coord) ?? 0)
        if (netto === 0) continue
        // Bruttoumsatz enthält USt → Zahllast herausrechnen (wie kurzfristig).
        const satz = getUstSatzForProdukt(produktId)
        addUst(Number(jahrStr), Number(monatStr), extractVorsteuer(netto, satz), 'output') // Zahllast (positiv)
      }
    }

    // — Umsatzausgaben (B2): effektiv = manuell ?? berechnet (Brutto inkl. USt) → extractVorsteuer —
    // Die berechnet-Quelle liefert Marketing NUR für nicht zugeordnete Kanäle (zugeordnete
    // laufen über die Sales-Plattform-Planung = B1). Es gibt also KEINE Doppelzählung →
    // alle gelieferten Zeilen (inkl. dieser Marketingkanäle) gehören in B2.
    const marketingChannelIds = new Set<string>((umsatzRes?.unassigned_marketing_kat_ids ?? []))
    const umsatzEff = new Map<string, number>() // `${kat}:${prod}:${jahr}:${monat}`
    for (const r of (umsatzRes?.data ?? [])) {
      umsatzEff.set(`${r.kategorie_id}:${r.produkt_id}:${r.jahr}:${r.monat}`, Number(r.wert))
    }
    const umsatzManualKeys = new Set<string>()
    for (const r of ((umsatzManualRes.data ?? []) as Array<{ kategorie_id: string; produkt_id: string; jahr: number; monat: number; betrag_manuell: number | null }>)) {
      if (r.betrag_manuell != null) {
        const mk = `${r.kategorie_id}:${r.produkt_id}:${r.jahr}:${r.monat}`
        umsatzEff.set(mk, Number(r.betrag_manuell))
        umsatzManualKeys.add(mk)
      }
    }
    // ── Zahlungsziel-Rückrechnung für B2 (Vertrieb + Marketing) — PROJ-93-Fix ──────
    // Analog zur kurzfristigen Route (PROJ-71): Die Vorsteuer folgt dem Rechnungs-/
    // Leistungsmonat, nicht dem Zahlungsmonat. Die Umsatzausgaben-Quelle datiert ihre
    // Werte am Zahlungsmonat (Anfallsmonat + Zahlungsziel); für den USt-Anfall wird das
    // Zahlungsziel monatsweise wieder abgezogen (ceil(Tage/30)), BEVOR die USt-Fälligkeit
    // (+1 Monat) greift. Nur Vertrieb (Versand/Lager/Retouren/Kulanz) + Marketingkanäle;
    // Produktkosten/Operativ/Finanz bleiben (vorerst) am Quell-Monat.
    const firstZt = (rows: { zahlungsziel_tage: number | null }[] | null | undefined) =>
      Number((rows ?? []).find(r => r.zahlungsziel_tage != null)?.zahlungsziel_tage ?? 0)
    const zahlungszielByKat = new Map<string, number>()
    if (versandL2) zahlungszielByKat.set(versandL2, firstZt(versandPlattRes.data as { zahlungsziel_tage: number | null }[] | null))
    if (lagerL2) zahlungszielByKat.set(lagerL2, firstZt(lagerPlattRes.data as { zahlungsziel_tage: number | null }[] | null))
    if (kulanzL2) zahlungszielByKat.set(kulanzL2, firstZt(kulanzPlattRes.data as { zahlungsziel_tage: number | null }[] | null))
    if (retourenL2) zahlungszielByKat.set(retourenL2, Number((retourenAllgRes.data as { zahlungsziel_tage: number | null } | null)?.zahlungsziel_tage ?? 0))
    for (const e of ((marketingEinstRes.data ?? []) as { marketingkanal_id: string; zahlungsziel_tage: number | null }[])) {
      zahlungszielByKat.set(e.marketingkanal_id, Number(e.zahlungsziel_tage ?? 0))
    }

    // Produktkosten-Zahlungsziele (Shipping/Inspektion/Einlagerung/Zoll). Der BERECHNETE
    // Anteil wird weiter unten TAGESGENAU aus den Roh-Bestellkosten verbucht (Bestellkosten-
    // `datum` = Basisdatum + Zahlungsziel; eine monatsweise ceil(Tage/30)-Rückrechnung wäre
    // bei kleinen Zielen wie Einlagerung 7 T falsch). MANUELL überschriebene Zellen dagegen
    // werden hier über umsatzEff verbucht (monatsweise Rückrechnung) und unten gegen die
    // Roh-Bestellkosten dedupliziert (QA-1-Fix) — sonst gingen manuelle Overrides verloren.
    const kg = kostenGlobalRes.data as { shipping_zahlungsziel_tage: number | null; inspektion_zahlungsziel_tage: number | null; einlagerung_zahlungsziel_tage: number | null; zoll_zahlungsziel_tage: number | null } | null
    const produktkostenZtByKat = new Map<string, number>()
    {
      const setPk = (name: string, zt: number) => { const id = produktkostenKatByName.get(name); if (id) produktkostenZtByKat.set(id, zt) }
      setPk('shipping', Number(kg?.shipping_zahlungsziel_tage ?? 0))
      setPk('inspektion', Number(kg?.inspektion_zahlungsziel_tage ?? 0))
      setPk('einlagerung', Number(kg?.einlagerung_zahlungsziel_tage ?? 0))
      setPk('zoll', Number(kg?.zoll_zahlungsziel_tage ?? 0))
    }

    for (const [key, wert] of umsatzEff) {
      const [katId, , jahrStr, monatStr] = key.split(':')
      if (produktkostenZtByKat.has(katId) || katId === wareKatId) {
        // Produktkosten/Ware: NUR manuell überschriebene Zellen hier verbuchen (QA-1) — der
        // berechnete Anteil läuft tagesgenau über die Roh-Bestellkosten (unten) und wird dort
        // gegen diese manuellen Keys dedupliziert. Manuelle Werte haben keinen Tagesbezug →
        // monatsweise Rückrechnung mit dem Produktkosten-Zahlungsziel (Ware: keines).
        if (!umsatzManualKeys.has(key)) continue
        let mjahr = Number(jahrStr)
        let mmonat = Number(monatStr)
        const mzt = produktkostenZtByKat.get(katId) ?? 0
        if (mzt > 0) {
          const src = fromIndex(monthIndex(mjahr, mmonat) - Math.ceil(mzt / 30))
          mjahr = src.jahr
          mmonat = src.monat
        }
        addUst(mjahr, mmonat, -extractVorsteuer(Number(wert), getUstSatz(katId)), 'vorsteuer')
        continue
      }
      // Marketingkanäle (Versions-Entitäten) über den Marketing-Resolver, sonst Standard.
      const satz = marketingChannelIds.has(katId) ? getSppSatz('marketing', katId) : getUstSatz(katId)
      // Zahlungsziel-Rückrechnung: Zahlungsmonat − ceil(Zahlungsziel/30) = Rechnungsmonat.
      let jahr = Number(jahrStr)
      let monat = Number(monatStr)
      const zt = zahlungszielByKat.get(katId) ?? 0
      if (zt > 0) {
        const src = fromIndex(monthIndex(jahr, monat) - Math.ceil(zt / 30))
        jahr = src.jahr
        monat = src.monat
      }
      addUst(jahr, monat, -extractVorsteuer(Number(wert), satz), 'vorsteuer')
    }

    // Bestellung → Produkt (für die Dedup manueller Produktkosten-/Ware-Overrides, QA-1).
    const produktByBestellung = new Map<string, string>()
    for (const b of ((bestellungenFlagRes.data ?? []) as { id: string; produkt_id: string | null }[])) {
      if (b.produkt_id) produktByBestellung.set(b.id, b.produkt_id)
    }

    // — B2-Produktkosten (Shipping/Inspektion/Einlagerung/Zoll) TAGESGENAU aus den Roh-
    //   Bestellkosten: Rechnungsmonat = datum − Zahlungsziel (Tage). Nur Nicht-Erst-
    //   bestellungen (Erstbestellungen laufen über die Investitionsausgaben/B4). Manuell
    //   überschriebene Zellen werden übersprungen (oben über umsatzEff verbucht). Danach
    //   greift wie üblich die USt-Fälligkeit (+1 Monat) in der Gruppierung. —
    {
      const erstSet = new Set<string>(
        ((bestellungenFlagRes.data ?? []) as { id: string; ist_erstbestellung: boolean | null }[])
          .filter(b => b.ist_erstbestellung).map(b => b.id),
      )
      for (const k of ((bestellKostenAllRes.data ?? []) as { bestellung_id: string; kpi_kategorie_id: string | null; datum: string | null; nettobetrag: number }[])) {
        if (!k.kpi_kategorie_id || !k.datum) continue
        const zt = produktkostenZtByKat.get(k.kpi_kategorie_id)
        if (zt === undefined) continue // nur Shipping/Inspektion/Einlagerung/Zoll
        if (erstSet.has(k.bestellung_id)) continue // Erstbestellung → B4, nicht B2
        const satz = getUstSatz(k.kpi_kategorie_id)
        if (satz <= 0) continue
        const d = new Date(k.datum + 'T00:00:00Z')
        // Dedup (QA-1): ist die Zelle (Kategorie, Produkt, Zahlungsmonat) manuell überschrieben,
        // wurde sie bereits oben über umsatzEff verbucht → hier überspringen.
        const prod = produktByBestellung.get(k.bestellung_id)
        if (prod && umsatzManualKeys.has(`${k.kpi_kategorie_id}:${prod}:${d.getUTCFullYear()}:${d.getUTCMonth() + 1}`)) continue
        d.setUTCDate(d.getUTCDate() - Math.max(0, zt)) // Rechnungsdatum = Zahlungsdatum − Zahlungsziel
        addUst(d.getUTCFullYear(), d.getUTCMonth() + 1, -(Number(k.nettobetrag) * satz / 100), 'vorsteuer')
      }
    }

    // — B2-Ware via BESTELLDATUM (wie kurzfristig PROJ-71): Die Vorsteuer auf den Waren-
    //   einkauf entsteht mit der Bestellung/Rechnung, nicht mit den Zahlungstranchen
    //   (Zahlungskonditionen). Voller Ware-Netto je Bestellung am Bestelldatum-Monat;
    //   nur Nicht-Erstbestellungen (Erstbestellungen → Investitionsausgaben/B4). —
    if (wareKatId) {
      const wareSatz = getUstSatz(wareKatId)
      if (wareSatz > 0) {
        const bestelldatumById = new Map<string, string>()
        for (const b of ((bestellungenFlagRes.data ?? []) as { id: string; ist_erstbestellung: boolean | null; bestelldatum: string | null }[])) {
          if (!b.ist_erstbestellung && b.bestelldatum) bestelldatumById.set(b.id, b.bestelldatum)
        }
        for (const k of ((bestellKostenAllRes.data ?? []) as { bestellung_id: string; kpi_kategorie_id: string | null; datum: string | null; nettobetrag: number }[])) {
          if (k.kpi_kategorie_id !== wareKatId) continue
          const bestelldatum = bestelldatumById.get(k.bestellung_id)
          if (!bestelldatum) continue // nur Nicht-Erstbestellungen
          const netto = Number(k.nettobetrag)
          if (!(netto > 0)) continue
          // Dedup (QA-1): manuell überschriebene Ware-Tranche (Ware, Produkt, Zahlungsmonat) → skip.
          const prod = produktByBestellung.get(k.bestellung_id)
          if (prod && k.datum) {
            const pd = new Date(k.datum + 'T00:00:00Z')
            if (umsatzManualKeys.has(`${wareKatId}:${prod}:${pd.getUTCFullYear()}:${pd.getUTCMonth() + 1}`)) continue
          }
          const d = new Date(bestelldatum + 'T00:00:00Z')
          addUst(d.getUTCFullYear(), d.getUTCMonth() + 1, -(netto * wareSatz / 100), 'vorsteuer')
        }
      }
    }

    // — Investitionsausgaben (B4): effektiv = manuell ?? berechnet (Brutto inkl. USt) → extractVorsteuer —
    // Satz über den VERSIONS-Invest-Resolver (getUstSatzInvest), der die Gesamt/Aufgeteilt-
    // Auswahl der globalen „Produktinvestitionen"-L1 respektiert — die Invest-Kategorien
    // sind versions-eigen und werden vom globalen Hierarchie-Resolver nicht aufgelöst.
    const investEff = new Map<string, number>()
    for (const r of (investRes?.data ?? [])) {
      investEff.set(`${r.kategorie_id}:${r.produkt_id}:${r.jahr}:${r.monat}`, Number(r.wert))
    }
    for (const r of ((investManualRes.data ?? []) as Array<{ kategorie_id: string; produkt_id: string; jahr: number; monat: number; betrag_manuell: number | null }>)) {
      if (r.betrag_manuell != null) investEff.set(`${r.kategorie_id}:${r.produkt_id}:${r.jahr}:${r.monat}`, Number(r.betrag_manuell))
    }
    for (const [key, wert] of investEff) {
      const [katId, , jahrStr, monatStr] = key.split(':')
      const satz = getUstSatzInvest(katId)
      addUst(Number(jahrStr), Number(monatStr), -extractVorsteuer(Number(wert), satz), 'vorsteuer')
    }

    // — A2: sonstige Einnahmen (nicht Produktverkäufe, nicht Plattform-Unterzeilen) —
    for (const r of ((einnahmenManualRes.data ?? []) as Array<{ kategorie_id: string; jahr: number; monat: number; betrag_manuell: number | null }>)) {
      if (r.betrag_manuell == null) continue
      if (!einnahmenKatIds.has(r.kategorie_id)) continue // Plattform-Unterzeilen (Produktverkäufe) ausschließen
      if (r.kategorie_id === produktverkaeufeKatId) continue
      const satz = getUstSatz(r.kategorie_id)
      addUst(r.jahr, r.monat, extractVorsteuer(Number(r.betrag_manuell), satz), 'output') // Zahllast
    }

    // — B3: Operativkosten sind NETTO (exkl. USt) → Vorsteuer = Netto × Satz/100
    //   (hierarchischer Satz: 3-stufig). NICHT extractVorsteuer, da kein Brutto.
    //   So gleicht sich die Vorsteuer exakt mit dem Brutto-Aufschlag der Liquiditäts-
    //   auswertung (Operativkosten Cash-Out = Netto × (1 + Satz/100)) aus.
    for (const r of ((operativManualRes.data ?? []) as Array<{ kategorie_id: string; jahr: number; monat: number; betrag: number | null }>)) {
      if (r.betrag == null) continue
      const satz = getUstSatzHierarchisch(r.kategorie_id)
      addUst(r.jahr, r.monat, -(Number(r.betrag) * satz / 100), 'vorsteuer')
    }

    // — B5: Finanzierungsausgaben (Brutto inkl. USt) → extractVorsteuer —
    for (const r of ((finanzManualRes.data ?? []) as Array<{ kategorie_id: string; jahr: number; monat: number; betrag: number | null }>)) {
      if (r.betrag == null) continue
      const satz = getUstSatz(r.kategorie_id)
      addUst(r.jahr, r.monat, -extractVorsteuer(Number(r.betrag), satz), 'vorsteuer')
    }

    // — B6: Einfuhrumsatzsteuer-Abzug im Monat ihres Anfalls —
    for (const [idx, betrag] of einfuhrByMonth) {
      const m = fromIndex(idx)
      addUst(m.jahr, m.monat, -betrag, 'einfuhr')
    }

    // — Gruppierung (monatlich/quartalsweise) + Verschiebung → Fälligkeitsmonat —
    // Netto und Komponenten teilen denselben Quellmonat → gemeinsame Verschiebung,
    // damit die Aufschlüsselung exakt zum Netto-Wert des Fälligkeitsmonats aufsummiert.
    const netByDue = new Map<string, number>()
    const kompByDue = new Map<string, { output: number; vorsteuer: number; einfuhr: number }>()
    for (const [idx, net] of ustNetByMonth) {
      const m = fromIndex(idx)
      const due = shiftUstPayment(m.jahr, m.monat, frequenz, verschiebungTage)
      const dueKey = `${due.jahr}:${due.monat}`
      netByDue.set(dueKey, (netByDue.get(dueKey) ?? 0) + net)
      const comp = komponentenByMonth.get(idx)
      if (comp) {
        let agg = kompByDue.get(dueKey)
        if (!agg) { agg = { output: 0, vorsteuer: 0, einfuhr: 0 }; kompByDue.set(dueKey, agg) }
        agg.output += comp.output
        agg.vorsteuer += comp.vorsteuer
        agg.einfuhr += comp.einfuhr
      }
    }
    for (const [dueKey, net] of netByDue) {
      if (net === 0) continue
      const [jahr, monat] = dueKey.split(':').map(Number)
      addResult(umsatzsteuerLeafId, { jahr, monat }, net)
      // Komponenten-Aufschlüsselung nur dort, wo der Umsatzsteuer-Wert sichtbar ist.
      if (!monatSet.has(dueKey)) continue
      const agg = kompByDue.get(dueKey)
      if (!agg) continue
      const push = (komponente: UstKomponente, wert: number) => {
        if (Math.abs(wert) < 0.005) return
        umsatzsteuerKomponentenBreakdown.push({ komponente, jahr, monat, wert: round2(wert) })
      }
      push('output', agg.output)
      push('vorsteuer', agg.vorsteuer)
      push('einfuhr', agg.einfuhr)
    }
  }

  // ── 7. Antwort ────────────────────────────────────────────────────────────────
  const data = []
  for (const [key, wert] of resultMap) {
    const [katId, jahrStr, monatStr] = key.split(':')
    data.push({
      kategorie_id: katId,
      jahr: parseInt(jahrStr, 10),
      monat: parseInt(monatStr, 10),
      wert: round2(wert),
    })
  }

  // Einfuhrumsatzsteuer-Aufschlüsselung je Produkt (Soll)
  const einfuhrProdukteBreakdown = [...einfuhrProduktByMonth.entries()]
    .map(([key, wert]) => {
      const lastColon = key.lastIndexOf(':')
      const secondLast = key.lastIndexOf(':', lastColon - 1)
      const produktRaw = key.slice(0, secondLast)
      return {
        produkt_id: produktRaw === '__none__' ? null : produktRaw,
        produkt_name: produktRaw === '__none__'
          ? 'Ohne Produktzuordnung'
          : (einfuhrProduktNamen.get(produktRaw) ?? 'Unbekanntes Produkt'),
        jahr: Number(key.slice(secondLast + 1, lastColon)),
        monat: Number(key.slice(lastColon + 1)),
        wert: round2(wert),
      }
    })
    .filter(e => e.wert !== 0)

  return NextResponse.json({
    data,
    breakdown: {
      einfuhr_produkte: einfuhrProdukteBreakdown,
      umsatzsteuer_komponenten: umsatzsteuerKomponentenBreakdown,
    },
  })
}
