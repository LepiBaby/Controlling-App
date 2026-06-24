import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { generiereUndSpeichereLangfristigeBestellkosten } from '../bestellplanung/bestellungen/[id]/kosten/_kosten-utils'
import { ladeVersionsDaten } from '../bestellplanung/_utils'
import { computeLagerbestandVerlauf } from '@/lib/langfristige-bestelllauf-algorithmus'
import {
  RA_LINE_IDS,
  type RaLineId,
  type RaLine,
  type RaBreakdown,
  type RentabilitaetsauswertungResponse,
} from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-95: Rentabilitätsauswertung der LANGFRISTIGEN Planung (pro Planversion).
//
// Diese Route berechnet die monatlichen Basiswerte der festen GuV-Kaskade
// (Brutto-Umsatz … Ergebnis). Das Frontend baut daraus die Zwischensummen und die
// Ansichtsmodi. Investitionskosten sind bewusst NICHT Teil der Kaskade (Nutzerwunsch
// 2026-06-24): keine Investitionszeile, kein „EBIT nach Investitionen", kein Filter.
//
// Zwei Berechnungs-Ebenen (vgl. Tech Design der Feature-Spec):
//   EBENE 1 (Umsatz → DB III): frisch je Produkt/Monat berechnet — NETTO (ohne USt)
//     und auf ACCRUAL-Basis (Monat des Absatzes/Bestands, KEINE Zahlungsverschiebung).
//     Die Quellmodule (Sales-Plattform-Planung, Umsatzausgaben) rechnen demgegenüber
//     BRUTTO + zahlungszeitpunkt-verschoben — daher wird hier neu gerechnet, mit den
//     exakt in der Spec genannten Formeln. Die separate Zeile „Umsatzsteuer" fängt die
//     Ausgangs-USt auf den Netto-Umsatz ab (wie im Reporting-Rentabilitätsreport).
//   EBENE 2 (DB III → Ergebnis): Monatssummen aus den Planungsmodulen übernommen
//     (Operativ [netto], Finanzierung [nur Zinsen, brutto→netto], Steuern [nur Ertragssteuern]).

const DEFAULT_PLANUNGSHORIZONT_MONATE = 12
const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

interface RouteContext {
  params: Promise<{ versionId: string }>
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}
// Ausgangs-USt aus einem BRUTTO-Betrag herausrechnen (Satz in Prozent) — wie Reporting/PROJ-93.
function extractUst(brutto: number, satz: number): number {
  if (satz <= 0 || brutto === 0) return 0
  return brutto * satz / (100 + satz)
}

interface Monat { jahr: number; monat: number; key: string; label: string }
function buildMonate(startMonat: number, startJahr: number, horizont: number): Monat[] {
  let y = startJahr
  let m = startMonat
  const out: Monat[] = []
  for (let i = 0; i < horizont; i++) {
    out.push({ jahr: y, monat: m, key: `${y}-${m}`, label: `${MONTH_LABELS[m - 1]} ${y}` })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

interface KatRow { id: string; name: string; parent_id: string | null; type: string; level: number; sort_order: number | null }
interface KpiKatRow { id: string; name: string; sort_order: number | null }

export async function GET(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError
  const uid = user!.id

  // PROJ-96: leichter Modus für die Umsatzauswertung. Liefert NUR den Umsatzblock
  // (Brutto-Umsatz, Rabatte, Rückerstattungen, Umsatzsteuer) + Absatztabelle und
  // überspringt die schweren GuV-Schritte (Produktkosten, Bestellkosten-Generierung
  // INKL. Schreibvorgängen, Lagerbestands-Simulation, Investitions-Unteraufruf,
  // Operativ/Finanzierung/Steuer). Gleicher Code-Pfad → bit-identische Umsatzzahlen.
  // PROJ-98: leichter Modus für die Operative-Kosten-Auswertung. Liefert NUR die
  // Operativ-Zeile (Drill Gruppe→Untergruppe) + Brutto-Umsatz (Prozent-Bezugsgröße) und
  // überspringt dieselben schweren Schritte. Gleicher Code-Pfad → bit-identische Werte.
  const nurParam = new URL(request.url).searchParams.get('nur')
  const nurUmsatz = nurParam === 'umsatz'
  const nurOperativ = nurParam === 'operativ'

  // ── 1. Monatsfenster + globales KPI-Modell ──────────────────────────────────
  const [grundResult, katsResult, produkteResult] = await Promise.all([
    supabase.from('langfristige_grundeinstellungen').select('startmonat_monat, startmonat_jahr, planungshorizont_monate').eq('user_id', uid).eq('plan_version_id', versionId).maybeSingle(),
    supabase.from('kpi_categories').select('id, name, parent_id, type, level, sort_order').limit(3000),
    supabase.from('langfristige_kpi_kategorien').select('id, name, sort_order').eq('user_id', uid).eq('plan_version_id', versionId).eq('art', 'lp_produkt').limit(500),
  ])
  if (katsResult.error) return NextResponse.json({ error: katsResult.error.message }, { status: 500 })

  const grund = grundResult.data
  const now = new Date()
  const startMonat = grund?.startmonat_monat ?? now.getMonth() + 1
  const startJahr = grund?.startmonat_jahr ?? now.getFullYear()
  const horizont = grund?.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
  const monate = buildMonate(startMonat, startJahr, horizont)
  const monatKeySet = new Set(monate.map(m => m.key))
  const planJahre = [...new Set(monate.map(m => m.jahr))]

  const produkteSorted = ((produkteResult.data ?? []) as KpiKatRow[]).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  // Akkumulatoren: Baum je Zeile. Jeder Knoten hält Werte/Monat (= Summe seiner Kinder).
  interface DrillNode { id: string; label: string; werte: Map<string, number>; children: Map<string, DrillNode> }
  const lineTree: Record<RaLineId, Map<string, DrillNode>> = {} as Record<RaLineId, Map<string, DrillNode>>
  for (const id of RA_LINE_IDS) lineTree[id] = new Map()
  const absatzAcc = new Map<string, Map<string, number>>() // prodId → monthKey → Stück

  const labelMap = new Map<string, string>()
  const orderMap = new Map<string, number>()
  produkteSorted.forEach((p, i) => { labelMap.set(p.id, p.name); orderMap.set(p.id, i) })

  // Fügt einen Wert entlang eines Drill-Pfads ein (jede Ebene bekommt den Betrag aufaddiert,
  // sodass eine Elternzeile stets die Summe ihrer Kinder zeigt).
  function addPath(line: RaLineId, path: Array<{ id: string; label: string; order?: number }>, key: string, val: number) {
    if (!monatKeySet.has(key) || val === 0 || path.length === 0) return
    let level = lineTree[line]
    for (const seg of path) {
      let node = level.get(seg.id)
      if (!node) { node = { id: seg.id, label: seg.label, werte: new Map(), children: new Map() }; level.set(seg.id, node) }
      if (seg.order !== undefined && !orderMap.has(seg.id)) orderMap.set(seg.id, seg.order)
      node.werte.set(key, (node.werte.get(key) ?? 0) + val)
      level = node.children
    }
  }
  // Einstufige Aufschlüsselung (Produkt/Kategorie) — Label aus labelMap.
  function addLine(line: RaLineId, drillId: string, key: string, val: number) {
    addPath(line, [{ id: drillId, label: labelMap.get(drillId) ?? drillId }], key, val)
  }
  function addAbsatz(prodId: string, key: string, menge: number) {
    if (!monatKeySet.has(key) || menge === 0) return
    let pm = absatzAcc.get(prodId)
    if (!pm) { pm = new Map(); absatzAcc.set(prodId, pm) }
    pm.set(key, (pm.get(key) ?? 0) + menge)
  }

  // Leere Version (keine Produkte) → strukturelle Null-Antwort.
  const emptyResponse = (): RentabilitaetsauswertungResponse => {
    const lines = {} as Record<RaLineId, RaLine>
    for (const id of RA_LINE_IDS) lines[id] = { werte: {}, produkte: [] }
    return { monate: monate.map(m => ({ key: m.key, label: m.label })), lines, absatz: { gesamt: {}, produkte: [] } }
  }
  if (produkteSorted.length === 0) return NextResponse.json(emptyResponse())

  const kats = (katsResult.data ?? []) as KatRow[]
  const parentMap = new Map<string, string>()
  const catById = new Map<string, KatRow>()
  for (const k of kats) { catById.set(k.id, k); if (k.parent_id) parentMap.set(k.id, k.parent_id) }

  // Operativ-Drill-Pfad: Gruppe (L2) → … → Blatt, ohne die L1-Wurzel; Reihenfolge wie im Modell.
  function operativPath(leafId: string): Array<{ id: string; label: string; order: number }> {
    const chain: KatRow[] = []
    let cur: KatRow | undefined = catById.get(leafId)
    while (cur && cur.level > 1) { chain.push(cur); cur = cur.parent_id ? catById.get(cur.parent_id) : undefined }
    chain.reverse()
    return chain.map(c => ({ id: c.id, label: c.name, order: c.sort_order ?? 0 }))
  }

  // Bestellkosten-Kategorien (Inspektion/Shipping/Zoll/Einlagerung) im globalen „Produkt"-Subtree.
  const produktParent = kats.find(k => k.type === 'ausgaben_kosten' && k.level === 1 && k.name.trim().toLowerCase() === 'produkt')
  const bestellkostenKatId: Record<'inspektion' | 'shipping' | 'zoll' | 'einlagerung', string | null> = {
    inspektion: null, shipping: null, zoll: null, einlagerung: null,
  }
  if (produktParent) {
    for (const k of kats) {
      if (k.parent_id !== produktParent.id) continue
      const n = k.name.trim().toLowerCase()
      if (n === 'inspektion') bestellkostenKatId.inspektion = k.id
      else if (n === 'shipping') bestellkostenKatId.shipping = k.id
      else if (n === 'zoll') bestellkostenKatId.zoll = k.id
      else if (n === 'einlagerung') bestellkostenKatId.einlagerung = k.id
    }
  }

  // ── 2. Versions-Stammdaten + Planung laden ──────────────────────────────────
  const [
    absatzResult,
    produktkostenResult, versandResult, lagerResult, containerResult,
    kulanzResult, retourenProdResult, retourenResult, vkGebResult,
    rabatteResult, mktPlanResult, mktEinstResult, marketingkanaeleResult,
    ustSatzResult, ustEbeneResult,
    operativResult, finanzResult, steuerManualResult,
    bestellungenResult,
  ] = await Promise.all([
    supabase.from('langfristige_absatz_planung').select('sales_plattform_id, produkt_id, jahr, monat, absatz, effektiver_vk').eq('user_id', uid).eq('plan_version_id', versionId).in('jahr', planJahre).limit(20000),
    supabase.from('langfristige_produktinformationen_produktkosten').select('produkt_id, warenkosten').eq('user_id', uid).eq('plan_version_id', versionId).limit(500),
    supabase.from('langfristige_versand_einstellungen').select('produkt_id, versandgebuehr_spediteur_euro_netto, versandgebuehr_3pl_euro_netto').eq('user_id', uid).eq('plan_version_id', versionId).limit(2000),
    supabase.from('langfristige_lager_einstellungen').select('produkt_id, lagerkosten_euro_m3_monat').eq('user_id', uid).eq('plan_version_id', versionId).limit(2000),
    supabase.from('langfristige_produktinformationen_containerkapazitaet').select('produkt_id, laenge_cm, breite_cm, hoehe_cm').eq('user_id', uid).eq('plan_version_id', versionId).limit(500),
    supabase.from('langfristige_ersatzteile_kulanz_einstellungen').select('produkt_id, quote_prozent, produktkosten_pro_stueck_euro_netto, versandkosten_pro_stueck_euro_netto').eq('user_id', uid).eq('plan_version_id', versionId).limit(2000),
    supabase.from('langfristige_retouren_allgemein_produkt_einstellungen').select('produkt_id, retourenquote_prozent, retourenhandling_kosten_euro_netto').eq('user_id', uid).eq('plan_version_id', versionId).limit(500),
    supabase.from('langfristige_retouren_einstellungen').select('sales_plattform_id, produkt_id, erstattung_verkaufsgebuehr_prozent, rueckversandkosten_euro_netto').eq('user_id', uid).eq('plan_version_id', versionId).limit(2000),
    supabase.from('langfristige_verkaufsgebuehr_einstellungen').select('sales_plattform_id, produkt_id, verkaufsgebuehr_prozent').eq('user_id', uid).eq('plan_version_id', versionId).limit(2000),
    supabase.from('langfristige_sales_plattform_planung').select('kategorie, produkt_id, jahr, monat, wert_manuell').eq('user_id', uid).eq('plan_version_id', versionId).eq('kategorie', 'rabatte').limit(20000),
    supabase.from('langfristige_marketing_planung').select('marketingkanal_id, produkt_id, jahr, monat, marketingkosten_pct').eq('user_id', uid).eq('plan_version_id', versionId).in('jahr', planJahre).limit(20000),
    supabase.from('langfristige_marketing_einstellungen').select('marketingkanal_id, sales_plattform_id').eq('user_id', uid).eq('plan_version_id', versionId).limit(500),
    supabase.from('langfristige_kpi_kategorien').select('id, name, sort_order').eq('user_id', uid).eq('plan_version_id', versionId).eq('art', 'lp_marketingkanal').limit(500),
    supabase.from('langfristige_ust_kategorie_saetze').select('kategorie_id, ebene, ust_satz').eq('user_id', uid).eq('plan_version_id', versionId).limit(2000),
    supabase.from('langfristige_ust_ebene_auswahl').select('kategorie_id, ebene').eq('user_id', uid).eq('plan_version_id', versionId).limit(1000),
    supabase.from('langfristige_operativekosten_planung').select('kategorie_id, jahr, monat, betrag').eq('user_id', uid).eq('plan_version_id', versionId).limit(20000),
    supabase.from('langfristige_finanzierungsausgaben_planung').select('kategorie_id, jahr, monat, betrag').eq('user_id', uid).eq('plan_version_id', versionId).limit(20000),
    supabase.from('langfristige_steuerausgaben_planung').select('kategorie_id, jahr, monat, betrag_manuell').eq('user_id', uid).eq('plan_version_id', versionId).limit(20000),
    supabase.from('langfristige_bestellungen').select('id, produkt_id, menge_praktisch, bestelldatum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, anzahl_20dc, anzahl_40hq, container_anteil, ist_erstbestellung').eq('user_id', uid).eq('plan_version_id', versionId).limit(2000),
  ])

  // ── 3. Lookup-Maps ──────────────────────────────────────────────────────────
  interface AbsatzRow { sales_plattform_id: string; produkt_id: string; jahr: number; monat: number; absatz: number | null; effektiver_vk: number | null }
  const absatzRows = (absatzResult.data ?? []) as AbsatzRow[]

  const warenkostenByProd = new Map<string, number>()
  for (const r of (produktkostenResult.data ?? []) as Array<{ produkt_id: string; warenkosten: number | null }>) {
    if (!warenkostenByProd.has(r.produkt_id)) warenkostenByProd.set(r.produkt_id, Number(r.warenkosten ?? 0))
  }
  const versandByProd = new Map<string, number>()
  for (const r of (versandResult.data ?? []) as Array<{ produkt_id: string; versandgebuehr_spediteur_euro_netto: number | null; versandgebuehr_3pl_euro_netto: number | null }>) {
    if (!versandByProd.has(r.produkt_id)) versandByProd.set(r.produkt_id, Number(r.versandgebuehr_spediteur_euro_netto ?? 0) + Number(r.versandgebuehr_3pl_euro_netto ?? 0))
  }
  const lagerByProd = new Map<string, number>()
  for (const r of (lagerResult.data ?? []) as Array<{ produkt_id: string; lagerkosten_euro_m3_monat: number | null }>) {
    if (!lagerByProd.has(r.produkt_id)) lagerByProd.set(r.produkt_id, Number(r.lagerkosten_euro_m3_monat ?? 0))
  }
  const m3ByProd = new Map<string, number>()
  for (const r of (containerResult.data ?? []) as Array<{ produkt_id: string; laenge_cm: number | null; breite_cm: number | null; hoehe_cm: number | null }>) {
    const l = Number(r.laenge_cm ?? 0), b = Number(r.breite_cm ?? 0), h = Number(r.hoehe_cm ?? 0)
    if (l > 0 && b > 0 && h > 0) m3ByProd.set(r.produkt_id, (l * b * h) / 1_000_000)
  }
  const kulanzByProd = new Map<string, { quote: number; kosten: number }>()
  for (const r of (kulanzResult.data ?? []) as Array<{ produkt_id: string; quote_prozent: number | null; produktkosten_pro_stueck_euro_netto: number | null; versandkosten_pro_stueck_euro_netto: number | null }>) {
    if (!kulanzByProd.has(r.produkt_id)) kulanzByProd.set(r.produkt_id, { quote: Number(r.quote_prozent ?? 0) / 100, kosten: Number(r.produktkosten_pro_stueck_euro_netto ?? 0) + Number(r.versandkosten_pro_stueck_euro_netto ?? 0) })
  }
  const retourenByProd = new Map<string, { quote: number; handling: number }>()
  for (const r of (retourenProdResult.data ?? []) as Array<{ produkt_id: string; retourenquote_prozent: number | null; retourenhandling_kosten_euro_netto: number | null }>) {
    retourenByProd.set(r.produkt_id, { quote: Number(r.retourenquote_prozent ?? 0) / 100, handling: Number(r.retourenhandling_kosten_euro_netto ?? 0) })
  }
  const rueckversandByProdPlt = new Map<string, number>()
  const erstattungByProdPlt = new Map<string, number>()
  for (const r of (retourenResult.data ?? []) as Array<{ sales_plattform_id: string; produkt_id: string; erstattung_verkaufsgebuehr_prozent: number | null; rueckversandkosten_euro_netto: number | null }>) {
    rueckversandByProdPlt.set(`${r.produkt_id}:${r.sales_plattform_id}`, Number(r.rueckversandkosten_euro_netto ?? 0))
    erstattungByProdPlt.set(`${r.produkt_id}:${r.sales_plattform_id}`, r.erstattung_verkaufsgebuehr_prozent != null ? Number(r.erstattung_verkaufsgebuehr_prozent) / 100 : 0)
  }
  const vkGebByProdPlt = new Map<string, number>()
  for (const r of (vkGebResult.data ?? []) as Array<{ sales_plattform_id: string; produkt_id: string; verkaufsgebuehr_prozent: number | null }>) {
    if (r.verkaufsgebuehr_prozent != null) vkGebByProdPlt.set(`${r.produkt_id}:${r.sales_plattform_id}`, Number(r.verkaufsgebuehr_prozent))
  }

  // USt-Sätze (für die Umsatzsteuer-Zeile) — Produktverkäufe-Satz wie PROJ-93.
  const ustRateMap = new Map<string, number>()
  for (const r of (ustSatzResult.data ?? []) as Array<{ kategorie_id: string; ebene: number; ust_satz: number | null }>) {
    if (r.ust_satz != null) ustRateMap.set(`${r.kategorie_id}:${r.ebene}`, Number(r.ust_satz))
  }
  const ustEbeneMap = new Map<string, number>()
  for (const r of (ustEbeneResult.data ?? []) as Array<{ kategorie_id: string; ebene: number }>) {
    ustEbeneMap.set(r.kategorie_id, r.ebene)
  }
  const produktverkaeufeKatId = kats.find(k =>
    (k.type === 'einnahmen' || k.type === 'umsatz') &&
    (k.name.toLowerCase().includes('produktverkäufe') || k.name.toLowerCase().includes('produktverkaeufe')),
  )?.id ?? null
  function getUstSatzForProdukt(produktId: string): number {
    if (!produktverkaeufeKatId) return 0
    const ebene = ustEbeneMap.get(produktverkaeufeKatId) ?? 1
    if (ebene === 1) return ustRateMap.get(`${produktverkaeufeKatId}:1`) ?? 0
    return ustRateMap.get(`${produktId}:1`) ?? ustRateMap.get(`${produktId}:2`) ?? 0
  }
  // USt-Satz-Auflösung für die Finanzierungs-Zeile — exakt wie steuerausgaben/berechnet (PROJ-93).
  // Finanzierungswerte sind BRUTTO inkl. USt und werden mit dem gepflegten Kategorie-Satz
  // auf NETTO umgerechnet (= brutto × 100/(100+satz)). (Operativ ist bereits netto.)
  function findL1Ancestor(katId: string): string {
    let id = katId
    while (parentMap.has(id)) id = parentMap.get(id)!
    return id
  }
  function getUstSatz(katId: string): number {
    const l1Id = findL1Ancestor(katId)
    const ebene = ustEbeneMap.get(l1Id) ?? 1
    if (ebene === 1) return ustRateMap.get(`${l1Id}:1`) ?? 0
    return ustRateMap.get(`${katId}:2`) ?? 0
  }
  function nettoFromBrutto(brutto: number, satz: number): number {
    return satz > 0 ? brutto * 100 / (100 + satz) : brutto
  }

  // ── 4. EBENE 1 — Umsatzblock + Vertriebsgebühren je Plattform×Produkt×Monat ──
  // Netto-Basis (Brutto − Rabatte − Rückerstattungen) je Produkt×Monat → für USt.
  const bruttoByProdMonat = new Map<string, number>()        // `${prod}:${key}`
  const rueckByProdMonat = new Map<string, number>()
  const rabatteByProdMonat = new Map<string, number>()

  for (const r of absatzRows) {
    const key = `${r.jahr}-${r.monat}`
    if (!monatKeySet.has(key)) continue
    const absatz = r.absatz != null ? Number(r.absatz) : 0
    if (absatz !== 0) addAbsatz(r.produkt_id, key, absatz)

    const vk = r.effektiver_vk != null ? Number(r.effektiver_vk) : null
    if (vk == null || vk === 0 || absatz === 0) continue
    const brutto = round2(absatz * vk)
    if (brutto === 0) continue

    addLine('brutto_umsatz', r.produkt_id, key, brutto)
    bruttoByProdMonat.set(`${r.produkt_id}:${key}`, (bruttoByProdMonat.get(`${r.produkt_id}:${key}`) ?? 0) + brutto)

    const ret = retourenByProd.get(r.produkt_id)
    const quote = ret?.quote ?? 0

    // Rückerstattungen = Retourenquote × Brutto (netto, wie SPP berechnet)
    if (quote > 0) {
      const rueck = round2(quote * brutto)
      addLine('rueckerstattungen', r.produkt_id, key, rueck)
      rueckByProdMonat.set(`${r.produkt_id}:${key}`, (rueckByProdMonat.get(`${r.produkt_id}:${key}`) ?? 0) + rueck)
    }

    // Verkaufsgebühren = Brutto × Gebühr% − Brutto × Quote × erstattete Gebühr% (netto)
    const vkGebPct = vkGebByProdPlt.get(`${r.produkt_id}:${r.sales_plattform_id}`)
    if (vkGebPct != null && vkGebPct > 0) {
      const erstattung = erstattungByProdPlt.get(`${r.produkt_id}:${r.sales_plattform_id}`) ?? 0
      const vkGeb = brutto * (vkGebPct / 100) - brutto * quote * erstattung
      if (vkGeb !== 0) addLine('verkaufsgebuehren', r.produkt_id, key, round2(vkGeb))
    }

    // Retouren = Quote × Absatz × (Retourenhandling + Rückversand) (netto)
    if (quote > 0) {
      const handling = ret?.handling ?? 0
      const rueckversand = rueckversandByProdPlt.get(`${r.produkt_id}:${r.sales_plattform_id}`) ?? 0
      const retKosten = quote * absatz * (handling + rueckversand)
      if (retKosten !== 0) addLine('retouren', r.produkt_id, key, round2(retKosten))
    }
  }

  // Rabatte (rein manuell aus der Sales-Plattform-Planung)
  for (const r of (rabatteResult.data ?? []) as Array<{ produkt_id: string; jahr: number; monat: number; wert_manuell: number | null }>) {
    if (r.wert_manuell == null) continue
    const key = `${r.jahr}-${r.monat}`
    addLine('rabatte', r.produkt_id, key, Number(r.wert_manuell))
    rabatteByProdMonat.set(`${r.produkt_id}:${key}`, (rabatteByProdMonat.get(`${r.produkt_id}:${key}`) ?? 0) + Number(r.wert_manuell))
  }

  // Umsatzsteuer = Ausgangs-USt auf (Brutto − Rabatte − Rückerstattungen) je Produkt×Monat
  for (const [pk, brutto] of bruttoByProdMonat) {
    const sep = pk.lastIndexOf(':')
    const prodId = pk.slice(0, sep)
    const key = pk.slice(sep + 1)
    const nettoBasis = brutto - (rabatteByProdMonat.get(pk) ?? 0) - (rueckByProdMonat.get(pk) ?? 0)
    const ust = extractUst(nettoBasis, getUstSatzForProdukt(prodId))
    if (ust !== 0) addLine('umsatzsteuer', prodId, key, round2(ust))
  }

  // PROJ-96: Im leichten Modus ist der Umsatzblock jetzt vollständig (Brutto, Rabatte,
  // Rückerstattungen, Umsatzsteuer + Absatz). Wir überspringen die schweren Schritte
  // (Produktkosten/Bestellkosten-Generierung mit Schreibvorgängen, Lagerung, Marketing,
  // Ebene 2) und antworten direkt — gleiche Werte wie die volle Auswertung.
  if (nurUmsatz) return NextResponse.json(buildResponse())

  // PROJ-98: Operativ-Block (Ebene 2) für den leichten Modus VORZIEHEN und antworten.
  // Brutto-Umsatz ist bereits gefüllt (oben); die operativen Kosten sind eine reine
  // Monatssummierung der gespeicherten Werte (keine teuren Schritte). Alle übrigen
  // Kostenzeilen bleiben leer und werden vom Frontend ignoriert.
  if (nurOperativ) {
    for (const r of (operativResult.data ?? []) as Array<{ kategorie_id: string; jahr: number; monat: number; betrag: number | null }>) {
      if (r.betrag == null) continue
      const key = `${r.jahr}-${r.monat}`
      // Operativkosten sind in der Quelle bereits NETTO. Drill: Gruppe → Untergruppe (Modell-Reihenfolge).
      const path = operativPath(r.kategorie_id)
      addPath('operativ', path.length > 0 ? path : [{ id: r.kategorie_id, label: katLabel(r.kategorie_id) }], key, Number(r.betrag))
    }
    return NextResponse.json(buildResponse())
  }

  // ── 5. EBENE 1 — Produktkosten (Ware + Bestellkosten-Umlage) & sonstige Vertriebskosten ──
  // Gesamtabsatz je Produkt×Monat (für absatzbasierte Kostenzeilen).
  const totalAbsatzByProdMonat = new Map<string, number>()
  for (const [prodId, pm] of absatzAcc) for (const [key, menge] of pm) totalAbsatzByProdMonat.set(`${prodId}:${key}`, menge)

  // Ware = Absatz × Warenkosten
  for (const [pk, menge] of totalAbsatzByProdMonat) {
    const sep = pk.lastIndexOf(':'); const prodId = pk.slice(0, sep); const key = pk.slice(sep + 1)
    const wk = warenkostenByProd.get(prodId) ?? 0
    if (wk > 0) addLine('ware', prodId, key, round2(menge * wk))
    // Versand = Versandkosten × Absatz
    const versand = versandByProd.get(prodId) ?? 0
    if (versand > 0) addLine('versand', prodId, key, round2(menge * versand))
    // Ersatzteile/Kulanz = Quote × Absatz × Kulanzkosten
    const kul = kulanzByProd.get(prodId)
    if (kul && kul.quote > 0 && kul.kosten > 0) addLine('kulanz', prodId, key, round2(kul.quote * menge * kul.kosten))
  }

  // Bestellkosten-Umlage (Inspektion/Shipping/Zoll/Einlagerung): Stückkosten je Produkt =
  // Σ Bestellkosten der Kategorie über ALLE Bestellungen ÷ Σ aller Bestellmengen, × Absatz.
  interface BestellungRow {
    id: string; produkt_id: string; menge_praktisch: number | null
    bestelldatum: string | null; produktionsende_datum: string | null; shippingdatum: string | null
    ankunftsdatum: string | null; verfuegbarkeitsdatum: string | null
    anzahl_20dc: number | null; anzahl_40hq: number | null; container_anteil: Record<string, number> | null
    ist_erstbestellung: boolean | null
  }
  const bestellungen = (bestellungenResult.data ?? []) as BestellungRow[]
  if (bestellungen.length > 0) {
    // Bestellkosten lazy generieren (wie Umsatzausgaben/Investitionsausgaben), damit die
    // Umlage auch ohne manuelles Öffnen jeder Bestellung verfügbar ist.
    try {
      await generiereUndSpeichereLangfristigeBestellkosten(supabase, uid, versionId, bestellungen.map(b => ({
        id: b.id, produkt_id: b.produkt_id, menge_praktisch: b.menge_praktisch ?? 0,
        bestelldatum: b.bestelldatum, produktionsende_datum: b.produktionsende_datum, shippingdatum: b.shippingdatum,
        ankunftsdatum: b.ankunftsdatum, verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
        anzahl_40hq: b.anzahl_40hq ?? 0, anzahl_20dc: b.anzahl_20dc ?? 0, container_anteil: b.container_anteil,
      })))
    } catch { /* Generierung fehlgeschlagen → vorhandene Kosten verwenden */ }

    const { data: kostData } = await supabase
      .from('langfristige_bestellungen_kosten')
      .select('bestellung_id, kpi_kategorie_id, nettobetrag')
      .eq('user_id', uid).eq('plan_version_id', versionId).limit(20000)

    const bestellByProd = new Map<string, string>() // bestellung_id → produkt_id
    const mengeByProd = new Map<string, number>()    // produkt_id → Σ menge_praktisch
    for (const b of bestellungen) {
      bestellByProd.set(b.id, b.produkt_id)
      mengeByProd.set(b.produkt_id, (mengeByProd.get(b.produkt_id) ?? 0) + Number(b.menge_praktisch ?? 0))
    }
    // Σ Bestellkosten je (Produkt, Kategorie)
    const kostByProdKat = new Map<string, number>() // `${prod}:${katId}`
    for (const k of (kostData ?? []) as Array<{ bestellung_id: string; kpi_kategorie_id: string | null; nettobetrag: number }>) {
      if (!k.kpi_kategorie_id) continue
      const prodId = bestellByProd.get(k.bestellung_id)
      if (!prodId) continue
      const mk = `${prodId}:${k.kpi_kategorie_id}`
      kostByProdKat.set(mk, (kostByProdKat.get(mk) ?? 0) + Number(k.nettobetrag))
    }
    const catLine: Array<['inspektion' | 'shipping' | 'zoll' | 'einlagerung', string | null]> = [
      ['inspektion', bestellkostenKatId.inspektion], ['shipping', bestellkostenKatId.shipping],
      ['zoll', bestellkostenKatId.zoll], ['einlagerung', bestellkostenKatId.einlagerung],
    ]
    for (const [pk, menge] of totalAbsatzByProdMonat) {
      const sep = pk.lastIndexOf(':'); const prodId = pk.slice(0, sep); const key = pk.slice(sep + 1)
      const gesamtMenge = mengeByProd.get(prodId) ?? 0
      if (gesamtMenge <= 0) continue
      for (const [line, katId] of catLine) {
        if (!katId) continue
        const summe = kostByProdKat.get(`${prodId}:${katId}`) ?? 0
        if (summe === 0) continue
        const stueckkosten = summe / gesamtMenge
        addLine(line as RaLineId, prodId, key, round2(stueckkosten * menge))
      }
    }
  }

  // Lagerung = Istbestand des Monats (Bestellplanung-Projektion) × Lagerkosten/Monat (€/m³ × m³)
  try {
    const { startMonat: lagerStart, horizontMonate: lagerHorizont, produkte: lagerProdukte, bestehende } =
      await ladeVersionsDaten(supabase, uid, versionId)
    for (const lp of lagerProdukte) {
      const lagerKosten = lagerByProd.get(lp.produkt_id) ?? 0
      const m3 = m3ByProd.get(lp.produkt_id) ?? 0
      if (lagerKosten <= 0 || m3 <= 0) continue
      const absMap = new Map<string, number>()
      const pm = absatzAcc.get(lp.produkt_id)
      if (pm) for (const [key, menge] of pm) { const [j, mo] = key.split('-'); absMap.set(`${j}-${mo}`, menge) }
      const { monate: verlauf } = computeLagerbestandVerlauf(lp, bestehende, lagerStart, lagerHorizont, absMap)
      for (const v of verlauf) {
        const key = `${v.jahr}-${v.monat}`
        const bestand = Math.max(0, v.bestand_nachher)
        if (bestand > 0) addLine('lagerung', lp.produkt_id, key, round2(bestand * lagerKosten * m3))
      }
    }
  } catch { /* Bestandssimulation fehlgeschlagen → Lagerung bleibt 0 */ }

  // ── 6. EBENE 1 — Marketing (= Marketingplanung: Brutto × % je Kanal, netto) ──
  // Drill-Down nach Marketingkanal (KPI-Modell-Reihenfolge), nicht nach Produkt.
  const kanalPlattform = new Map<string, string | null>()
  for (const r of (mktEinstResult.data ?? []) as Array<{ marketingkanal_id: string; sales_plattform_id: string | null }>) {
    kanalPlattform.set(r.marketingkanal_id, r.sales_plattform_id ?? null)
  }
  const kanaeleSorted = ((marketingkanaeleResult.data ?? []) as KpiKatRow[]).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  kanaeleSorted.forEach((k, i) => { if (!labelMap.has(k.id)) { labelMap.set(k.id, k.name); orderMap.set(k.id, 500 + i) } })
  // Brutto je Produkt×Plattform×Monat (Marketing-Basis)
  const bruttoByProdPlattMonat = new Map<string, number>()
  for (const r of absatzRows) {
    const key = `${r.jahr}-${r.monat}`
    if (!monatKeySet.has(key)) continue
    const vk = r.effektiver_vk != null ? Number(r.effektiver_vk) : null
    const absatz = r.absatz != null ? Number(r.absatz) : 0
    if (vk == null || vk === 0 || absatz === 0) continue
    bruttoByProdPlattMonat.set(`${r.produkt_id}:${r.sales_plattform_id}:${key}`, round2(absatz * vk))
  }
  for (const r of (mktPlanResult.data ?? []) as Array<{ marketingkanal_id: string; produkt_id: string; jahr: number; monat: number; marketingkosten_pct: number | null }>) {
    if (r.marketingkosten_pct == null || r.marketingkosten_pct <= 0) continue
    const key = `${r.jahr}-${r.monat}`
    if (!monatKeySet.has(key)) continue
    const plattformId = kanalPlattform.get(r.marketingkanal_id) ?? null
    let base = 0
    if (plattformId) base = bruttoByProdPlattMonat.get(`${r.produkt_id}:${plattformId}:${key}`) ?? 0
    else base = bruttoByProdMonat.get(`${r.produkt_id}:${key}`) ?? 0
    if (base <= 0) continue
    // Drill: Marketingkanal → Produkt
    addPath('marketing', [
      { id: r.marketingkanal_id, label: labelMap.get(r.marketingkanal_id) ?? r.marketingkanal_id },
      { id: r.produkt_id, label: labelMap.get(r.produkt_id) ?? r.produkt_id },
    ], key, round2(base * (r.marketingkosten_pct / 100)))
  }

  // ── 7. EBENE 2 — Modul-Monatssummen (1:1 aus den Planungsmodulen) ───────────
  // Operative Kosten (rein manuell) — Drill nach Kategorie.
  function katLabel(katId: string): string {
    return kats.find(k => k.id === katId)?.name ?? katId
  }
  for (const r of (operativResult.data ?? []) as Array<{ kategorie_id: string; jahr: number; monat: number; betrag: number | null }>) {
    if (r.betrag == null) continue
    const key = `${r.jahr}-${r.monat}`
    // Operativkosten sind in der Quelle bereits NETTO — keine USt herausrechnen.
    // Drill: Gruppe → Untergruppe (Modell-Reihenfolge).
    const betrag = Number(r.betrag)
    const path = operativPath(r.kategorie_id)
    addPath('operativ', path.length > 0 ? path : [{ id: r.kategorie_id, label: katLabel(r.kategorie_id) }], key, betrag)
  }

  // Finanzierungskosten — nur Zinsen-Kategorien (Name-Match).
  const finanzKats = new Set(kats.filter(k => k.type === 'ausgaben_kosten' && k.name.toLowerCase().includes('zins')).map(k => k.id))
  for (const r of (finanzResult.data ?? []) as Array<{ kategorie_id: string; jahr: number; monat: number; betrag: number | null }>) {
    if (r.betrag == null || !finanzKats.has(r.kategorie_id)) continue
    const key = `${r.jahr}-${r.monat}`
    if (!labelMap.has(r.kategorie_id)) { labelMap.set(r.kategorie_id, katLabel(r.kategorie_id)); orderMap.set(r.kategorie_id, 1000 + orderMap.size) }
    // Brutto → Netto (USt herausrechnen, Kategorie-Satz wie auf der Steuerseite).
    addLine('finanzierung_zinsen', r.kategorie_id, key, round2(nettoFromBrutto(Number(r.betrag), getUstSatz(r.kategorie_id))))
  }

  // Steuern — nur Ertragssteuern (Name-Match: ertrag/körperschaft/gewerbe/einkommen), USt/Einfuhr ausgeschlossen.
  function istErtragssteuer(name: string): boolean {
    const n = name.toLowerCase()
    if (n.includes('umsatz') || n.includes('einfuhr') || n.includes('vorsteuer')) return false
    return n.includes('ertrag') || n.includes('körperschaft') || n.includes('koerperschaft') || n.includes('gewerbe') || n.includes('einkommen')
  }
  const ertragKats = new Set(kats.filter(k => k.type === 'ausgaben_kosten' && istErtragssteuer(k.name)).map(k => k.id))
  for (const r of (steuerManualResult.data ?? []) as Array<{ kategorie_id: string; jahr: number; monat: number; betrag_manuell: number | null }>) {
    if (r.betrag_manuell == null || !ertragKats.has(r.kategorie_id)) continue
    const key = `${r.jahr}-${r.monat}`
    if (!labelMap.has(r.kategorie_id)) { labelMap.set(r.kategorie_id, katLabel(r.kategorie_id)); orderMap.set(r.kategorie_id, 1000 + orderMap.size) }
    addLine('steuern_ertrag', r.kategorie_id, key, Number(r.betrag_manuell))
  }

  // Hinweis: Investitionskosten werden in der Rentabilitätsauswertung bewusst NICHT
  // dargestellt (Nutzerentscheidung 2026-06-24) — keine Investitionszeile, kein
  // „EBIT nach Investitionen", kein „Ohne Investitionen"-Filter.

  // ── 8. Antwort bauen ────────────────────────────────────────────────────────
  function buildBreakdowns(level: Map<string, DrillNode>): RaBreakdown[] {
    const nodes = [...level.values()].sort((a, b) => (orderMap.get(a.id) ?? 9_999_999) - (orderMap.get(b.id) ?? 9_999_999))
    const out: RaBreakdown[] = []
    for (const n of nodes) {
      const w: Record<string, number> = {}
      let any = false
      for (const [k, v] of n.werte) { const rv = round2(v); w[k] = rv; if (rv !== 0) any = true }
      const kids = n.children.size > 0 ? buildBreakdowns(n.children) : undefined
      if (any || (kids && kids.length > 0)) {
        out.push(kids && kids.length > 0 ? { id: n.id, label: n.label, werte: w, children: kids } : { id: n.id, label: n.label, werte: w })
      }
    }
    return out
  }
  function buildLine(line: RaLineId): RaLine {
    const top = lineTree[line]
    const werte: Record<string, number> = {}
    for (const node of top.values()) for (const [k, v] of node.werte) werte[k] = round2((werte[k] ?? 0) + v)
    return { werte, produkte: buildBreakdowns(top) }
  }

  function buildResponse(): RentabilitaetsauswertungResponse {
    const lines = {} as Record<RaLineId, RaLine>
    for (const id of RA_LINE_IDS) lines[id] = buildLine(id)

    // Absatztabelle
    const absatzGesamt: Record<string, number> = {}
    const absatzProdukte: RaBreakdown[] = []
    for (const p of produkteSorted) {
      const pm = absatzAcc.get(p.id)
      if (!pm) continue
      const pWerte: Record<string, number> = {}
      let any = false
      for (const [k, v] of pm) { pWerte[k] = v; absatzGesamt[k] = (absatzGesamt[k] ?? 0) + v; if (v !== 0) any = true }
      if (any) absatzProdukte.push({ id: p.id, label: p.name, werte: pWerte })
    }

    return {
      monate: monate.map(m => ({ key: m.key, label: m.label })),
      lines,
      absatz: { gesamt: absatzGesamt, produkte: absatzProdukte },
    }
  }
  return NextResponse.json(buildResponse())
}
