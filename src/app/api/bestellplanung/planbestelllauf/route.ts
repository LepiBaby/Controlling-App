import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { runPlanbestelllauf } from '@/lib/planbestelllauf-algorithmus'
import type { AlgorithmusInput, ProduktInput, SkuInput, BestehendeBestellungInput } from '@/lib/planbestelllauf-algorithmus'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateOnly(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date { return new Date(d.getTime() + n * 86_400_000) }
function getPeriodDays(art: string): number {
  if (art.endsWith('_7')) return 7; if (art.endsWith('_14')) return 14
  if (art.endsWith('_30')) return 30; if (art.endsWith('_60')) return 60
  if (art.endsWith('_90')) return 90; return 30
}

interface AbsatzEinstellung {
  sales_plattform_id: string; produkt_id: string; berechnungsart: string
  gewichtung_erstes_drittel: number | null; gewichtung_zweites_drittel: number | null
  gewichtung_drittes_drittel: number | null
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

export async function POST() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // ─── 1. Grundeinstellungen ───────────────────────────────────────────────────
  const { data: grundeinstellungen } = await supabase
    .from('grundeinstellungen')
    .select('planungshorizont_wochen')
    .eq('user_id', user!.id)
    .maybeSingle()

  const planungshorizont_wochen = grundeinstellungen?.planungshorizont_wochen ?? 13

  // ─── 2. Products with lieferzeit ─────────────────────────────────────────────
  const { data: lieferzeitRows, error: lzErr } = await supabase
    .from('produktinformationen_lieferzeit')
    .select('produkt_id, pufferzeit_tage, produktionszeit_tage, zwischenzeit_tage, shipping_zeit_tage, entladungszeit_tage')
    .eq('user_id', user!.id)
    .limit(500)

  if (lzErr) return NextResponse.json({ error: lzErr.message }, { status: 500 })
  if (!lieferzeitRows?.length) return NextResponse.json({ aenderungen_bestehende: [], neue_planbestellungen: [] })

  const produktIds = lieferzeitRows.map(r => r.produkt_id)

  // ─── 3. Parallel data fetch ──────────────────────────────────────────────────
  const [
    skusRes, bestandsvRes, moqRes, moqSkuRes, containerRes,
    containerGlobalRes, herstellerRes, einstellungenRes,
    absatzPlanungRes, bestellungenRes,
  ] = await Promise.all([
    supabase.from('kpi_categories').select('id, name, parent_id').in('parent_id', produktIds).eq('type', 'produkte').eq('level', 2).limit(500),
    supabase.from('produktinformationen_bestandsverwaltung').select('produkt_id, sicherheitsbestand, zielreichweite_wochen').eq('user_id', user!.id).limit(500),
    supabase.from('produktinformationen_moq').select('produkt_id, ebene, moq').eq('user_id', user!.id).limit(500),
    supabase.from('produktinformationen_moq_sku').select('sku_id, moq').eq('user_id', user!.id).limit(500),
    supabase.from('produktinformationen_containerkapazitaet').select('produkt_id, laenge_cm, breite_cm, hoehe_cm').eq('user_id', user!.id).limit(500),
    supabase.from('produktinformationen_container_global').select('volumen_20dc, volumen_40hq').eq('user_id', user!.id).maybeSingle(),
    supabase.from('produktinformationen_hersteller_zuordnung').select('produkt_id, hersteller_id').eq('user_id', user!.id).limit(500),
    supabase.from('absatz_einstellungen').select('sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel').eq('user_id', user!.id).neq('berechnungsart', 'keine').limit(500),
    supabase.from('absatz_planung').select('produkt_id, sku_id, kw_year, kw_number, absatz_manuell').eq('user_id', user!.id).not('sku_id', 'is', null).not('absatz_manuell', 'is', null).limit(20000),
    supabase.from('bestellungen').select('id, status, herkunft, bestelldatum, produktionsstart_datum, produktionsende_datum, shippingdatum, ankunftsdatum, ankunftsdatum_ist, verfuegbarkeitsdatum, verfuegbarkeitsdatum_ist').eq('user_id', user!.id).in('status', ['plan', 'laufend']).limit(500),
  ])

  const skusData: Array<{ id: string; name: string; parent_id: string }> = skusRes.data ?? []
  const allSkuIds = skusData.map(s => s.id)

  // ─── 4. Bestand per SKU (most recent closing balance) ─────────────────────────
  const bestandBySkuId = new Map<string, number>()
  if (allSkuIds.length > 0) {
    const { data: bestandRows } = await supabase
      .from('bestand_transaktionen')
      .select('sku_id, datum, anfangsbestand, einlagerungen, anpassungen_positiv, anpassungen_negativ, warenverluste, sendungen_manuell, bestand_sendungen(menge)')
      .in('sku_id', allSkuIds)
      .order('datum', { ascending: false })
      .limit(allSkuIds.length * 10)

    for (const row of (bestandRows ?? []) as Array<Record<string, unknown>>) {
      const skuId = row.sku_id as string
      if (bestandBySkuId.has(skuId)) continue
      const sendungenSum = (row.bestand_sendungen as Array<{ menge: number }> ?? []).reduce((s, x) => s + x.menge, 0)
      const closing = (row.anfangsbestand as number) + (row.einlagerungen as number)
        + (row.anpassungen_positiv as number) - (row.anpassungen_negativ as number)
        - (row.warenverluste as number) - (row.sendungen_manuell as number) - sendungenSum
      bestandBySkuId.set(skuId, Math.max(0, closing))
    }
  }

  // ─── 5. Historical avg absatz per SKU (daily → weekly) ───────────────────────
  const einstellungen: AbsatzEinstellung[] = einstellungenRes.data ?? []
  const avgWochenabsatzBySku = new Map<string, number>()

  if (einstellungen.length > 0 && allSkuIds.length > 0) {
    const ninetyDaysAgo = addDays(today, -90)
    const { data: sendungenRows } = await supabase
      .from('bestand_transaktionen')
      .select('sku_id, datum, bestand_sendungen(plattform_id, menge)')
      .in('sku_id', allSkuIds)
      .gte('datum', toDateOnly(ninetyDaysAgo))
      .lt('datum', toDateOnly(today))
      .limit(10000)

    const dataByKombi = new Map<string, Array<{ datum: string; menge: number }>>()
    for (const t of (sendungenRows ?? []) as Array<{ sku_id: string; datum: string; bestand_sendungen: Array<{ plattform_id: string; menge: number }> }>) {
      for (const s of t.bestand_sendungen ?? []) {
        const key = `${t.sku_id}:${s.plattform_id}`
        if (!dataByKombi.has(key)) dataByKombi.set(key, [])
        dataByKombi.get(key)!.push({ datum: t.datum, menge: s.menge })
      }
    }

    const skusByParent = new Map<string, string[]>()
    for (const s of skusData) {
      if (!skusByParent.has(s.parent_id)) skusByParent.set(s.parent_id, [])
      skusByParent.get(s.parent_id)!.push(s.id)
    }

    for (const e of einstellungen) {
      const skuIds = skusByParent.get(e.produkt_id) ?? []
      const periodDays = getPeriodDays(e.berechnungsart)
      for (const skuId of skuIds) {
        const entries = dataByKombi.get(`${skuId}:${e.sales_plattform_id}`) ?? []
        const td = calcTagesdurchschnitt(entries, periodDays, e, today)
        // Accumulate per SKU across platforms, convert daily → weekly inline
        avgWochenabsatzBySku.set(skuId, (avgWochenabsatzBySku.get(skuId) ?? 0) + td * 7)
      }
    }
  }

  // ─── 6. Absatz planning per SKU per KW (passed through directly, no aggregation) ──
  const absatzplanung = (absatzPlanungRes.data ?? []).map((row: { produkt_id: string; sku_id: string; kw_year: number; kw_number: number; absatz_manuell: number }) => ({
    produkt_id: row.produkt_id,
    sku_id: row.sku_id,
    kw_year: row.kw_year,
    kw_number: row.kw_number,
    menge: row.absatz_manuell ?? 0,
  }))

  // ─── 7. Container max capacities ─────────────────────────────────────────────
  const volumen20dc: number | null = containerGlobalRes.data?.volumen_20dc ?? null
  const volumen40hq: number | null = containerGlobalRes.data?.volumen_40hq ?? null
  const containerByProdukt = new Map((containerRes.data ?? []).map((r: { produkt_id: string; laenge_cm: number | null; breite_cm: number | null; hoehe_cm: number | null }) => [r.produkt_id, r]))

  function computeMax(volM3: number | null, stueckCm3: number | null): number | null {
    if (!volM3 || !stueckCm3 || stueckCm3 <= 0) return null
    return Math.floor((volM3 * 1_000_000) / stueckCm3)
  }

  // ─── 8. Build existing bestellungen input ────────────────────────────────────
  const existingBestellungIds = (bestellungenRes.data ?? []).map((b: { id: string }) => b.id)
  let bestehendeBestellungen: BestehendeBestellungInput[] = []

  if (existingBestellungIds.length > 0) {
    const [prodRes, skuMengenBestRes] = await Promise.all([
      supabase.from('bestellungen_produkte').select('bestellung_id, produkt_id').in('bestellung_id', existingBestellungIds),
      supabase.from('bestellungen_sku_mengen').select('bestellung_id, sku_id, menge_praktisch, menge_theoretisch, menge_nach_moq').in('bestellung_id', existingBestellungIds),
    ])

    const prodByBest = new Map<string, string[]>()
    for (const p of (prodRes.data ?? []) as Array<{ bestellung_id: string; produkt_id: string }>) {
      if (!prodByBest.has(p.bestellung_id)) prodByBest.set(p.bestellung_id, [])
      prodByBest.get(p.bestellung_id)!.push(p.produkt_id)
    }

    const skuByBest = new Map<string, Array<{ sku_id: string; produkt_id: string; menge_praktisch: number; menge_theoretisch: number | null; menge_nach_moq: number | null }>>()
    const skuParentMap = new Map(skusData.map(s => [s.id, s.parent_id]))
    for (const sm of (skuMengenBestRes.data ?? []) as Array<{ bestellung_id: string; sku_id: string; menge_praktisch: number; menge_theoretisch: number | null; menge_nach_moq: number | null }>) {
      if (!skuByBest.has(sm.bestellung_id)) skuByBest.set(sm.bestellung_id, [])
      skuByBest.get(sm.bestellung_id)!.push({
        sku_id: sm.sku_id,
        produkt_id: skuParentMap.get(sm.sku_id) ?? '',
        menge_praktisch: sm.menge_praktisch,
        menge_theoretisch: sm.menge_theoretisch,
        menge_nach_moq: sm.menge_nach_moq,
      })
    }

    bestehendeBestellungen = (bestellungenRes.data ?? []).map((b: { id: string; status: string; herkunft: string | null; bestelldatum: string | null; produktionsstart_datum: string | null; produktionsende_datum: string | null; shippingdatum: string | null; ankunftsdatum: string | null; ankunftsdatum_ist: string | null; verfuegbarkeitsdatum: string | null; verfuegbarkeitsdatum_ist: string | null }) => ({
      bestellung_id: b.id,
      status: b.status as 'plan' | 'laufend',
      herkunft: b.herkunft as 'algorithmus' | 'manuell' | null,
      bestelldatum: b.bestelldatum,
      produktionsstart_datum: b.produktionsstart_datum,
      produktionsende_datum: b.produktionsende_datum,
      shippingdatum: b.shippingdatum,
      ankunftsdatum: b.verfuegbarkeitsdatum_ist ?? b.verfuegbarkeitsdatum ?? b.ankunftsdatum_ist ?? b.ankunftsdatum,
      verfuegbarkeitsdatum: b.verfuegbarkeitsdatum_ist ?? b.verfuegbarkeitsdatum,
      produkt_ids: prodByBest.get(b.id) ?? [],
      sku_mengen: skuByBest.get(b.id) ?? [],
    }))
  }

  // ─── 9. Assemble ProduktInput array ──────────────────────────────────────────
  const lieferzeitMap = new Map((lieferzeitRows ?? []).map(r => [r.produkt_id, r]))
  const bestandsvMap = new Map((bestandsvRes.data ?? []).map((r: { produkt_id: string; sicherheitsbestand: number | null; zielreichweite_wochen: number | null }) => [r.produkt_id, r]))
  const moqMap = new Map((moqRes.data ?? []).map((r: { produkt_id: string; ebene: string; moq: number | null }) => [r.produkt_id, r]))
  const moqSkuMap = new Map((moqSkuRes.data ?? []).map((r: { sku_id: string; moq: number | null }) => [r.sku_id, r.moq]))
  const herstellerMap = new Map((herstellerRes.data ?? []).map((r: { produkt_id: string; hersteller_id: string | null }) => [r.produkt_id, r.hersteller_id]))

  const produktNamesRes = await supabase.from('kpi_categories').select('id, name').in('id', produktIds).limit(500)
  const produktNameMap = new Map(((produktNamesRes.data ?? []) as Array<{ id: string; name: string }>).map(r => [r.id, r.name]))

  const skusByProdukt = new Map<string, typeof skusData>()
  for (const s of skusData) {
    if (!skusByProdukt.has(s.parent_id)) skusByProdukt.set(s.parent_id, [])
    skusByProdukt.get(s.parent_id)!.push(s)
  }

  const produkte: ProduktInput[] = produktIds.map(pid => {
    const lz = lieferzeitMap.get(pid)
    const bv = bestandsvMap.get(pid)
    const moq = moqMap.get(pid)
    const cont = containerByProdukt.get(pid)
    const skus: SkuInput[] = (skusByProdukt.get(pid) ?? []).map(s => ({
      sku_id: s.id,
      sku_name: s.name,
      aktueller_bestand: bestandBySkuId.get(s.id) ?? 0,
      moq_sku: moqSkuMap.get(s.id) ?? null,
      avg_wochenabsatz: avgWochenabsatzBySku.get(s.id) ?? 0,
    }))

    const stueckCm3 = cont?.laenge_cm && cont?.breite_cm && cont?.hoehe_cm
      ? cont.laenge_cm * cont.breite_cm * cont.hoehe_cm
      : null

    return {
      produkt_id: pid,
      produkt_name: produktNameMap.get(pid) ?? pid,
      skus,
      pufferzeit_tage: lz?.pufferzeit_tage ?? 0,
      produktionszeit_tage: lz?.produktionszeit_tage ?? 0,
      zwischenzeit_tage: lz?.zwischenzeit_tage ?? 0,
      shipping_zeit_tage: lz?.shipping_zeit_tage ?? 0,
      entladungszeit_tage: lz?.entladungszeit_tage ?? 0,
      sicherheitsbestand_wochen: bv?.sicherheitsbestand ?? 0,
      zielreichweite_wochen: bv?.zielreichweite_wochen ?? 12,
      moq_ebene: (moq?.ebene as 'produkt' | 'sku') ?? 'produkt',
      moq_gesamt: moq?.moq ?? null,
      hersteller_id: herstellerMap.get(pid) ?? null,
      stueckvolumen_cm3: stueckCm3,
      max_20dc: computeMax(volumen20dc, stueckCm3),
      max_40hq: computeMax(volumen40hq, stueckCm3),
    }
  }).filter(p => p.skus.length > 0)

  // ─── 10. Run algorithm ───────────────────────────────────────────────────────
  const input: AlgorithmusInput = {
    heute: today,
    planungshorizont_wochen,
    produkte,
    absatzplanung,
    bestehendeBestellungen,
  }

  const ergebnis = runPlanbestelllauf(input)

  // ─── 11. Add ProduktStammdaten + ContainerGlobal for Wizard Step 3 ──────────
  const herstellerNamenRes = await supabase
    .from('produktinformationen_hersteller')
    .select('id, name')
    .eq('user_id', user!.id)
    .in('id', [...new Set((herstellerRes.data ?? []).map((r: { hersteller_id: string | null }) => r.hersteller_id).filter(Boolean) as string[])])
    .limit(200)

  const herstellerNameById = new Map(
    ((herstellerNamenRes.data ?? []) as Array<{ id: string; name: string }>).map(c => [c.id, c.name])
  )

  const produkt_stammdaten = produkte.map(p => {
    const cont = containerByProdukt.get(p.produkt_id)
    const stueckCm3 = cont?.laenge_cm && cont?.breite_cm && cont?.hoehe_cm
      ? cont.laenge_cm * cont.breite_cm * cont.hoehe_cm
      : null
    const stueckvolumen_m3 = stueckCm3 !== null ? stueckCm3 / 1_000_000 : null
    const herstellerId = herstellerMap.get(p.produkt_id) ?? null

    return {
      produkt_id: p.produkt_id,
      produkt_name: p.produkt_name,
      hersteller_id: herstellerId,
      hersteller_name: herstellerId ? (herstellerNameById.get(herstellerId) ?? null) : null,
      stueckvolumen_m3,
      max_20dc: p.max_20dc,
      max_40hq: p.max_40hq,
      produktionszeit_tage: p.produktionszeit_tage,
      zwischenzeit_tage: p.zwischenzeit_tage,
      shipping_zeit_tage: p.shipping_zeit_tage,
      entladungszeit_tage: p.entladungszeit_tage,
      pufferzeit_tage: p.pufferzeit_tage,
    }
  })

  const container_global = {
    volumen_20dc: volumen20dc,
    volumen_40hq: volumen40hq,
  }

  return NextResponse.json({ ...ergebnis, produkt_stammdaten, container_global })
}
