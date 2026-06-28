import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'
import { generiereUndSpeichereLangfristigeBestellkosten } from '../../bestellplanung/bestellungen/[id]/kosten/_kosten-utils'
import { ladeVersionsDaten } from '../../bestellplanung/_utils'
import { computeLagerbestandVerlauf } from '@/lib/langfristige-bestelllauf-algorithmus'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-91: Berechnete Soll-Werte der Umsatzausgaben-Planung (Langfristige Planung).
// Spiegelt die kurzfristige /umsatzausgaben-planung/berechnet-Logik (PROJ-67), aber:
//   • monatsbasiert (Start exakt im Startmonat, allgemeiner Horizont) statt KW,
//   • KEINE Ist-Transaktionen — Absatz/VK kommen aus der Absatzplanung der Version,
//     Retourenquote ist der manuell gepflegte Vertriebs-Wert (kein Transaktions-Mittel),
//   • alle Einstellungen/Pläne stammen aus DIESER Planversion,
//   • Zahlungsverschiebung monatsbasiert: monatlich → Anfallsmonat; quartalsweise →
//     Bündelung im letzten Quartalsmonat; je zzgl. Zahlungsziel-Tage gemäß PROJ-78/
//     PROJ-80 (KEIN Folgemonat), NICHT KW-Rhythmus.
// Es wird nichts persistiert (rein berechnet).
// Antwort: { data: { kategorie_id, produkt_id, jahr, monat, wert }[], unassigned_marketing_kat_ids }

const DEFAULT_PLANUNGSHORIZONT_MONATE = 12

interface RouteContext {
  params: Promise<{ versionId: string }>
}

type Gruppierung = 'monatlich' | 'quartalsweise'

interface KatRow { id: string; name: string; parent_id: string | null; type: string; level: number }
interface KpiKat { id: string }
interface AbsatzRow { sales_plattform_id: string; produkt_id: string; jahr: number; monat: number; absatz: number | null; effektiver_vk: number | null }
interface VersandRow { produkt_id: string; versandgebuehr_spediteur_euro_netto: number | null; versandgebuehr_3pl_euro_netto: number | null }
interface LagerRow { produkt_id: string; lagerkosten_euro_m3_monat: number | null }
interface KulanzRow { produkt_id: string; quote_prozent: number | null; produktkosten_pro_stueck_euro_netto: number | null; versandkosten_pro_stueck_euro_netto: number | null }
interface RetourenAllgProdRow { produkt_id: string; retourenquote_prozent: number | null; retourenhandling_kosten_euro_netto: number | null }
interface GruppierungRow { gruppierung: Gruppierung | null; zahlungsziel_tage: number | null }
interface ContainerRow { produkt_id: string; laenge_cm: number | null; breite_cm: number | null; hoehe_cm: number | null }
interface MktPlanRow { marketingkanal_id: string; produkt_id: string; jahr: number; monat: number; marketingkosten_pct: number | null }
interface MktEinstRow { marketingkanal_id: string; sales_plattform_id: string | null; gruppierung: Gruppierung | null; zahlungsziel_tage: number | null }
interface AuszKanalRow { marketingkanal_id: string }
interface UstSatzRow { kategorie_id: string; ebene: number; ust_satz: number | null }
interface BestellungRow {
  id: string
  produkt_id: string
  menge_praktisch: number
  bestelldatum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  anzahl_20dc: number | null
  anzahl_40hq: number | null
  container_anteil: Record<string, number> | null
  ist_erstbestellung: boolean | null
}
interface BestellKostRow { bestellung_id: string; kpi_kategorie_id: string | null; datum: string | null; nettobetrag: number }

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

// Monatsbasierte Zahlungsverschiebung (PROJ-78/80):
//   monatlich     → derselbe Monat, in dem die Kosten anfallen (KEIN Folgemonat)
//   quartalsweise → Kosten des Quartals werden im LETZTEN Quartalsmonat gebündelt
//                   (Q1→Mär, Q2→Jun, Q3→Sep, Q4→Dez), KEIN Folgemonat
// Das Zahlungsziel (Tage) verschiebt den Termin in beiden Fällen zusätzlich nach
// hinten (auf Monatsebene: ceil(Tage/30)).
function shiftToPaymentMonth(
  jahr: number,
  monat: number,
  gruppierung: Gruppierung | null,
  zahlungszielTage: number | null,
): Monat {
  let dueIdx: number
  if (gruppierung === 'quartalsweise') {
    const q = Math.floor((monat - 1) / 3) // 0..3
    const quartalsEndeMonat = q * 3 + 3 // 3,6,9,12 → letzter Monat des Quartals
    dueIdx = monthIndex(jahr, quartalsEndeMonat)
  } else {
    // monatlich → Anfallsmonat (kein Folgemonat)
    dueIdx = monthIndex(jahr, monat)
  }
  const zielMonate = Math.ceil(Math.max(0, zahlungszielTage ?? 0) / 30)
  return fromIndex(dueIdx + zielMonate)
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  // 1. Grundeinstellungen + globales KPI-Modell (für Kategorie-IDs nach Name)
  const [grundResult, katsResult] = await Promise.all([
    supabase
      .from('langfristige_grundeinstellungen')
      .select('startmonat_monat, startmonat_jahr, planungshorizont_monate')
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .maybeSingle(),
    fetchAllRows((from, to) => supabase.from('kpi_categories').select('id, name, parent_id, type, level').order('id', { ascending: true }).range(from, to)),
  ])

  if (katsResult.error) return NextResponse.json({ error: katsResult.error.message }, { status: 500 })

  const grund = grundResult.data
  const now = new Date()
  const startMonat = grund?.startmonat_monat ?? now.getMonth() + 1
  const startJahr = grund?.startmonat_jahr ?? now.getFullYear()
  const horizont = grund?.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
  const monate = buildMonate(startMonat, startJahr, horizont)
  const monatSet = new Set(monate.map(m => `${m.jahr}:${m.monat}`))

  // Globale Kategorie-Struktur: Parent-Map + relevante L1/L2-IDs nach Name (wie PROJ-67)
  const kats = (katsResult.data ?? []) as KatRow[]
  const parentMap = new Map<string, string>()
  for (const k of kats) if (k.parent_id) parentMap.set(k.id, k.parent_id)

  let vertriebL1Id: string | null = null
  let marketingL1Id: string | null = null
  let versandL2: string | null = null
  let lagerL2: string | null = null
  let retourenL2: string | null = null
  let kulanzL2: string | null = null
  for (const k of kats) {
    if (k.type !== 'ausgaben_kosten') continue
    const n = k.name.toLowerCase()
    if (k.level === 1 && n.includes('vertrieb')) vertriebL1Id = k.id
    if (k.level === 1 && n === 'marketing') marketingL1Id = k.id
    if (k.level === 2 && n.includes('versand') && versandL2 === null) versandL2 = k.id
    if (k.level === 2 && n.includes('lager') && lagerL2 === null) lagerL2 = k.id
    if (k.level === 2 && n.includes('retouren') && retourenL2 === null) retourenL2 = k.id
    if (k.level === 2 && (n.includes('ersatz') || n.includes('kulanz')) && kulanzL2 === null) kulanzL2 = k.id
  }

  // 2. Stammdaten + Einstellungen + Pläne dieser Version (parallel)
  const [
    prodResult, kanalResult,
    absatzResult,
    versandResult, versandGrpResult,
    lagerResult, lagerGrpResult,
    kulanzResult, kulanzGrpResult,
    retourenProdResult, retourenGrpResult,
    containerResult,
    mktPlanResult, mktEinstResult, auszKanalResult,
    ustSatzResult, ustEbeneResult,
    bestellungenResult,
  ] = await Promise.all([
    supabase.from('langfristige_kpi_kategorien').select('id').eq('user_id', user!.id).eq('plan_version_id', versionId).eq('art', 'lp_produkt').limit(500),
    supabase.from('langfristige_kpi_kategorien').select('id').eq('user_id', user!.id).eq('plan_version_id', versionId).eq('art', 'lp_marketingkanal').limit(500),
    fetchAllRows((from, to) => supabase.from('langfristige_absatz_planung').select('sales_plattform_id, produkt_id, jahr, monat, absatz, effektiver_vk').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
    fetchAllRows((from, to) => supabase.from('langfristige_versand_einstellungen').select('produkt_id, versandgebuehr_spediteur_euro_netto, versandgebuehr_3pl_euro_netto').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
    supabase.from('langfristige_versand_plattform_einstellungen').select('gruppierung, zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(100),
    fetchAllRows((from, to) => supabase.from('langfristige_lager_einstellungen').select('produkt_id, lagerkosten_euro_m3_monat').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
    supabase.from('langfristige_lager_plattform_einstellungen').select('gruppierung, zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(100),
    fetchAllRows((from, to) => supabase.from('langfristige_ersatzteile_kulanz_einstellungen').select('produkt_id, quote_prozent, produktkosten_pro_stueck_euro_netto, versandkosten_pro_stueck_euro_netto').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
    supabase.from('langfristige_ersatzteile_kulanz_plattform_einstellungen').select('gruppierung, zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(100),
    supabase.from('langfristige_retouren_allgemein_produkt_einstellungen').select('produkt_id, retourenquote_prozent, retourenhandling_kosten_euro_netto').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
    supabase.from('langfristige_retouren_allgemein_einstellungen').select('gruppierung, zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).maybeSingle(),
    supabase.from('langfristige_produktinformationen_containerkapazitaet').select('produkt_id, laenge_cm, breite_cm, hoehe_cm').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
    fetchAllRows((from, to) => supabase.from('langfristige_marketing_planung').select('marketingkanal_id, produkt_id, jahr, monat, marketingkosten_pct').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
    supabase.from('langfristige_marketing_einstellungen').select('marketingkanal_id, sales_plattform_id, gruppierung, zahlungsziel_tage').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
    supabase.from('langfristige_auszahlungs_marketingkanaele').select('marketingkanal_id').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(1000),
    supabase.from('langfristige_ust_kategorie_saetze').select('kategorie_id, ebene, ust_satz').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(1000),
    supabase.from('langfristige_ust_ebene_auswahl').select('kategorie_id, ebene').eq('user_id', user!.id).eq('plan_version_id', versionId).limit(500),
    fetchAllRows((from, to) => supabase.from('langfristige_bestellungen').select('id, produkt_id, menge_praktisch, bestelldatum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, anzahl_20dc, anzahl_40hq, container_anteil, ist_erstbestellung').eq('user_id', user!.id).eq('plan_version_id', versionId).order('id', { ascending: true }).range(from, to)),
  ])

  for (const r of [prodResult, kanalResult, absatzResult, versandResult, versandGrpResult, lagerResult, lagerGrpResult, kulanzResult, kulanzGrpResult, retourenProdResult, containerResult, mktPlanResult, mktEinstResult, auszKanalResult, ustSatzResult, ustEbeneResult, bestellungenResult]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
  }

  const produkte = (prodResult.data ?? []) as KpiKat[]
  const kanaele = (kanalResult.data ?? []) as KpiKat[]

  // ── Unassigned Marketing-Kanäle: nicht in den Auszahlungseinstellungen geführt ──
  const assignedKanalIds = new Set<string>(((auszKanalResult.data ?? []) as AuszKanalRow[]).map(r => r.marketingkanal_id))
  const unassignedMarketingKatIds = kanaele.map(k => k.id).filter(id => !assignedKanalIds.has(id))

  if (produkte.length === 0) {
    return NextResponse.json({ data: [], unassigned_marketing_kat_ids: unassignedMarketingKatIds })
  }

  // ── Absatz/VK je Plattform×Produkt×Monat + Gesamtabsatz je Produkt×Monat ──────
  const absatzMap = new Map<string, { absatz: number; vk: number | null }>()
  const totalAbsatzMap = new Map<string, number>() // `${produkt}:${jahr}:${monat}` → Summe Absatz
  for (const r of (absatzResult.data ?? []) as AbsatzRow[]) {
    const absatz = r.absatz != null ? Number(r.absatz) : 0
    absatzMap.set(`${r.sales_plattform_id}:${r.produkt_id}:${r.jahr}:${r.monat}`, {
      absatz,
      vk: r.effektiver_vk != null ? Number(r.effektiver_vk) : null,
    })
    const tk = `${r.produkt_id}:${r.jahr}:${r.monat}`
    totalAbsatzMap.set(tk, (totalAbsatzMap.get(tk) ?? 0) + absatz)
  }

  // ── Vertriebs-Produktwerte (plattformübergreifend: erster Eintrag je Produkt) ──
  const versandByProd = new Map<string, number>()
  for (const r of (versandResult.data ?? []) as VersandRow[]) {
    if (!versandByProd.has(r.produkt_id)) {
      versandByProd.set(r.produkt_id, Number(r.versandgebuehr_spediteur_euro_netto ?? 0) + Number(r.versandgebuehr_3pl_euro_netto ?? 0))
    }
  }
  const lagerByProd = new Map<string, number>()
  for (const r of (lagerResult.data ?? []) as LagerRow[]) {
    if (!lagerByProd.has(r.produkt_id)) lagerByProd.set(r.produkt_id, Number(r.lagerkosten_euro_m3_monat ?? 0))
  }
  const kulanzByProd = new Map<string, { quote: number; kosten: number }>()
  for (const r of (kulanzResult.data ?? []) as KulanzRow[]) {
    if (!kulanzByProd.has(r.produkt_id)) {
      kulanzByProd.set(r.produkt_id, {
        quote: Number(r.quote_prozent ?? 0) / 100,
        kosten: Number(r.produktkosten_pro_stueck_euro_netto ?? 0) + Number(r.versandkosten_pro_stueck_euro_netto ?? 0),
      })
    }
  }
  const retourenByProd = new Map<string, { quote: number; handling: number }>()
  for (const r of (retourenProdResult.data ?? []) as RetourenAllgProdRow[]) {
    retourenByProd.set(r.produkt_id, {
      quote: Number(r.retourenquote_prozent ?? 0) / 100,
      handling: Number(r.retourenhandling_kosten_euro_netto ?? 0),
    })
  }

  // Gruppierung+Zahlungsziel je Bereich (versand/lager/kulanz: erster Eintrag; retouren: versionsweit)
  const firstGrp = (rows: unknown[] | null): GruppierungRow => (rows?.[0] as GruppierungRow) ?? { gruppierung: 'monatlich', zahlungsziel_tage: null }
  const versandGrp = firstGrp(versandGrpResult.data as unknown[] | null)
  const lagerGrp = firstGrp(lagerGrpResult.data as unknown[] | null)
  const kulanzGrp = firstGrp(kulanzGrpResult.data as unknown[] | null)
  const retourenGrp = (retourenGrpResult.data as GruppierungRow | null) ?? { gruppierung: 'monatlich', zahlungsziel_tage: null }

  // M³-Volumen je Produkt
  const m3ByProd = new Map<string, number>()
  for (const r of (containerResult.data ?? []) as ContainerRow[]) {
    const l = Number(r.laenge_cm ?? 0), b = Number(r.breite_cm ?? 0), h = Number(r.hoehe_cm ?? 0)
    if (l > 0 && b > 0 && h > 0) m3ByProd.set(r.produkt_id, (l * b * h) / 1_000_000)
  }

  // Marketing-%-Sätze + Kanal-Einstellungen
  const mktPctMap = new Map<string, number>()
  for (const r of (mktPlanResult.data ?? []) as MktPlanRow[]) {
    if (r.marketingkosten_pct != null) mktPctMap.set(`${r.marketingkanal_id}:${r.produkt_id}:${r.jahr}:${r.monat}`, Number(r.marketingkosten_pct))
  }
  const mktEinstMap = new Map<string, MktEinstRow>()
  for (const r of (mktEinstResult.data ?? []) as MktEinstRow[]) mktEinstMap.set(r.marketingkanal_id, r)

  // USt-Sätze + Ebenen-Auswahl
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

  // ── Vorlaufmonate (Quellmonate vor dem Startmonat) ────────────────────────────
  // Wegen der Zahlungsverschiebung speist sich der Startmonat aus Kosten früherer
  // Monate. Damit der Startmonat nicht leer bleibt, betrachten wir Quellmonate so
  // weit vor dem Startmonat, wie die maximale Verschiebung reicht. Es werden nur
  // Fälligkeiten INNERHALB des Fensters ausgewiesen (addWert prüft monatSet).
  // Lookback: Zahlungsziel + Quartalsbündelung (quartalsweise kann bis zu 2 Monate
  // vor das Quartalsende zurückreichen → großzügiger Puffer, Überhang wird gefiltert).
  function spanMonths(g: Gruppierung | null, ziel: number | null): number {
    const zielM = Math.ceil(Math.max(0, ziel ?? 0) / 30)
    return (g === 'quartalsweise' ? 3 : 1) + zielM
  }
  let lookback = 1
  for (const g of [versandGrp, lagerGrp, kulanzGrp, retourenGrp]) {
    lookback = Math.max(lookback, spanMonths(g.gruppierung, g.zahlungsziel_tage))
  }
  for (const e of mktEinstMap.values()) {
    lookback = Math.max(lookback, spanMonths(e.gruppierung ?? null, e.zahlungsziel_tage ?? null))
  }
  lookback = Math.min(lookback, 12)

  const startIdx = monthIndex(startJahr, startMonat)
  const quellStartIdx = startIdx - lookback
  const endIdx = monthIndex(monate[monate.length - 1].jahr, monate[monate.length - 1].monat)
  const quellMonate: Monat[] = []
  for (let idx = quellStartIdx; idx <= endIdx; idx++) quellMonate.push(fromIndex(idx))

  // ── Akkumulator ───────────────────────────────────────────────────────────────
  // key: `${kategorie_id}:${produkt_id}:${jahr}:${monat}` → wert (Brutto inkl. USt)
  const resultMap = new Map<string, number>()
  function addWert(katId: string | null, prodId: string, due: Monat, val: number) {
    if (!katId || val <= 0) return
    if (!monatSet.has(`${due.jahr}:${due.monat}`)) return
    const key = `${katId}:${prodId}:${due.jahr}:${due.monat}`
    resultMap.set(key, (resultMap.get(key) ?? 0) + val)
  }

  // ── Produktausgaben (Bestellkosten — keine Verschiebung) ──────────────────────
  // Bestellkosten dieser Version frisch generieren (lazy, wie die Bestellkosten-Route),
  // damit Produktausgaben auch ohne manuelles Öffnen jeder Bestellung erscheinen.
  // Erstbestellungen (ist_erstbestellung = true) werden hier NICHT berücksichtigt.
  const bestellungen = ((bestellungenResult.data ?? []) as BestellungRow[]).filter(b => !b.ist_erstbestellung)
  const bestellungMap = new Map<string, BestellungRow>()
  for (const r of bestellungen) bestellungMap.set(r.id, r)

  if (bestellungen.length > 0) {
    try {
      await generiereUndSpeichereLangfristigeBestellkosten(
        supabase,
        user!.id,
        versionId,
        bestellungen.map(b => ({
          id: b.id,
          produkt_id: b.produkt_id,
          menge_praktisch: b.menge_praktisch ?? 0,
          bestelldatum: b.bestelldatum,
          produktionsende_datum: b.produktionsende_datum,
          shippingdatum: b.shippingdatum,
          ankunftsdatum: b.ankunftsdatum,
          verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
          anzahl_40hq: b.anzahl_40hq ?? 0,
          anzahl_20dc: b.anzahl_20dc ?? 0,
          container_anteil: b.container_anteil,
        })),
      )
    } catch {
      // Generierung fehlgeschlagen → vorhandene (ggf. leere) Kosten verwenden, kein Absturz.
    }
  }

  const { data: bestellKostData } = await fetchAllRows((from, to) => supabase
    .from('langfristige_bestellungen_kosten')
    .select('bestellung_id, kpi_kategorie_id, datum, nettobetrag')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .order('id', { ascending: true }).range(from, to))

  for (const k of (bestellKostData ?? []) as BestellKostRow[]) {
    const best = bestellungMap.get(k.bestellung_id)
    if (!best) continue
    const datumStr = k.datum ?? best.ankunftsdatum ?? best.verfuegbarkeitsdatum ?? best.bestelldatum
    if (!datumStr) continue
    const d = new Date(datumStr + 'T00:00:00Z')
    const due: Monat = { jahr: d.getUTCFullYear(), monat: d.getUTCMonth() + 1 }
    const ust = getUstMultiplier(k.kpi_kategorie_id, k.kpi_kategorie_id ? parentMap.get(k.kpi_kategorie_id) ?? null : null)
    addWert(k.kpi_kategorie_id, best.produkt_id, due, Number(k.nettobetrag) * ust)
  }

  // ── Geplanter Bestand je Produkt × Monat (für Lagerausgaben) ──────────────────
  // Lagerkosten hängen am gelagerten Bestand, nicht am Absatz. Wir nutzen dieselbe
  // Bestandssimulation wie das Lagerbestandsdiagramm (Startbestand + Zugänge aus
  // Bestellungen − Absatz, Monatsende-Bestand). Quelle: bestehende Bestellungen
  // inkl. Erstbestellungen (sie erhöhen real den Lagerbestand).
  // key: `${produkt_id}:${jahr}:${monat}` → Monatsende-Bestand
  const bestandByProdMonat = new Map<string, number>()
  try {
    const { startMonat: lagerStart, horizontMonate: lagerHorizont, produkte: lagerProdukte, bestehende } =
      await ladeVersionsDaten(supabase, user!.id, versionId)
    for (const lp of lagerProdukte) {
      // Monatsabsatz-Map (`${jahr}-${monat}`) aus den bereits geladenen Absatzdaten.
      const absMap = new Map<string, number>()
      for (const [key, abs] of totalAbsatzMap) {
        const [pid, jahrStr, monatStr] = key.split(':')
        if (pid === lp.produkt_id) absMap.set(`${jahrStr}-${monatStr}`, abs)
      }
      // In-Fenster (ab Startmonat): unveränderte Vorwärtssimulation wie das Diagramm.
      const { monate: verlauf } = computeLagerbestandVerlauf(lp, bestehende, lagerStart, lagerHorizont, absMap)
      for (const v of verlauf) {
        bestandByProdMonat.set(`${lp.produkt_id}:${v.jahr}:${v.monat}`, v.bestand_nachher)
      }
      // Vorlaufmonate (rückprojiziert): Monatsende-Bestand des Vormonats = Opening
      // des Startmonats = aktueller_bestand; Monat für Monat rückwärts mit Absatz/Zugang.
      const zugangByIdx = new Map<number, number>()
      for (const b of bestehende) {
        if (b.produkt_id !== lp.produkt_id) continue
        const vdat = b.verfuegbarkeitsdatum ?? b.ankunftsdatum
        if (!vdat) continue
        const d = new Date(vdat + 'T00:00:00Z')
        const idx = d.getUTCFullYear() * 12 + d.getUTCMonth()
        zugangByIdx.set(idx, (zugangByIdx.get(idx) ?? 0) + (b.menge_praktisch ?? 0))
      }
      let stockEnd = lp.aktueller_bestand ?? 0
      for (let idx = startIdx - 1; idx >= quellStartIdx; idx--) {
        const m = fromIndex(idx)
        bestandByProdMonat.set(`${lp.produkt_id}:${m.jahr}:${m.monat}`, Math.max(0, stockEnd))
        const absatz = absMap.get(`${m.jahr}-${m.monat}`) ?? 0
        const zugang = zugangByIdx.get(idx) ?? 0
        stockEnd = Math.max(0, stockEnd + absatz - zugang)
      }
    }
  } catch {
    // Bestandssimulation fehlgeschlagen → Lagerausgaben bleiben leer, kein Absturz.
  }

  // ── Vertriebsausgaben + Marketing (je Produkt × Monat, mit Verschiebung) ──────
  for (const prod of produkte) {
    const versandKosten = versandByProd.get(prod.id) ?? 0
    const lagerKosten = lagerByProd.get(prod.id) ?? 0
    const m3 = m3ByProd.get(prod.id) ?? 0
    const kulanz = kulanzByProd.get(prod.id)
    const retouren = retourenByProd.get(prod.id)
    const versandUst = getUstMultiplier(versandL2, vertriebL1Id)
    const lagerUst = getUstMultiplier(lagerL2, vertriebL1Id)
    const kulanzUst = getUstMultiplier(kulanzL2, vertriebL1Id)
    const retourenUst = getUstMultiplier(retourenL2, vertriebL1Id)

    for (const mon of quellMonate) {
      // Lager (Lagerkosten €/m³/Monat × Bestand × M³-Volumen) — bestandbasiert,
      // unabhängig vom Absatz dieses Monats.
      if (lagerL2 && lagerKosten > 0 && m3 > 0) {
        const bestand = bestandByProdMonat.get(`${prod.id}:${mon.jahr}:${mon.monat}`) ?? 0
        if (bestand > 0) {
          const due = shiftToPaymentMonth(mon.jahr, mon.monat, lagerGrp.gruppierung, lagerGrp.zahlungsziel_tage)
          addWert(lagerL2, prod.id, due, bestand * lagerKosten * m3 * lagerUst)
        }
      }

      const totalAbsatz = totalAbsatzMap.get(`${prod.id}:${mon.jahr}:${mon.monat}`) ?? 0
      if (totalAbsatz <= 0) continue

      // Versand
      if (versandL2 && versandKosten > 0) {
        const due = shiftToPaymentMonth(mon.jahr, mon.monat, versandGrp.gruppierung, versandGrp.zahlungsziel_tage)
        addWert(versandL2, prod.id, due, totalAbsatz * versandKosten * versandUst)
      }
      // Retouren (manuelle Quote × Absatz × Handlingkosten)
      if (retourenL2 && retouren && retouren.quote > 0 && retouren.handling > 0) {
        const due = shiftToPaymentMonth(mon.jahr, mon.monat, retourenGrp.gruppierung, retourenGrp.zahlungsziel_tage)
        addWert(retourenL2, prod.id, due, retouren.quote * totalAbsatz * retouren.handling * retourenUst)
      }
      // Ersatzteile/Kulanz
      if (kulanzL2 && kulanz && kulanz.quote > 0 && kulanz.kosten > 0) {
        const due = shiftToPaymentMonth(mon.jahr, mon.monat, kulanzGrp.gruppierung, kulanzGrp.zahlungsziel_tage)
        addWert(kulanzL2, prod.id, due, kulanz.quote * totalAbsatz * kulanz.kosten * kulanzUst)
      }
    }
  }

  // ── Marketingausgaben (nur Kanäle ohne Plattform-Zuordnung) ───────────────────
  for (const kanalId of unassignedMarketingKatIds) {
    const einst = mktEinstMap.get(kanalId)
    const assignedPlattformId = einst?.sales_plattform_id ?? null
    const mktUst = getUstMultiplier(kanalId, marketingL1Id)
    for (const prod of produkte) {
      for (const mon of quellMonate) {
        const pct = mktPctMap.get(`${kanalId}:${prod.id}:${mon.jahr}:${mon.monat}`) ?? 0
        if (pct <= 0) continue

        // Basis = Bruttoumsatz (Absatz × VK): zugeordnete Plattform oder Summe aller
        let base = 0
        if (assignedPlattformId) {
          const ap = absatzMap.get(`${assignedPlattformId}:${prod.id}:${mon.jahr}:${mon.monat}`)
          if (ap?.vk != null) base = ap.absatz * ap.vk
        } else {
          for (const [key, ap] of absatzMap) {
            if (!key.endsWith(`:${prod.id}:${mon.jahr}:${mon.monat}`)) continue
            if (ap.vk != null) base += ap.absatz * ap.vk
          }
        }
        if (base <= 0) continue

        const due = shiftToPaymentMonth(mon.jahr, mon.monat, einst?.gruppierung ?? null, einst?.zahlungsziel_tage ?? null)
        addWert(kanalId, prod.id, due, (pct / 100) * base * mktUst)
      }
    }
  }

  // ── Antwort ─────────────────────────────────────────────────────────────────
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

  return NextResponse.json({ data, unassigned_marketing_kat_ids: unassignedMarketingKatIds })
}
