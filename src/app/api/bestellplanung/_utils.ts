import type { createSupabaseServerClient } from '@/lib/supabase-server'
import { generiereBestellkosten } from '@/lib/bestellkosten-generierung'
import type { BestellungDaten, ProduktKosten, Zahlungskonditionen, KostenGlobal, KpiKategorie } from '@/lib/bestellkosten-generierung'

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

export interface KonsolidierungsPartner {
  bestellung_id: string
  produkt_namen: string[]
}

export interface FullBestellung {
  id: string
  status: string
  herkunft: string | null
  containerart: string | null
  anzahl_40hq: number
  anzahl_20dc: number
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  produktionsstart_datum_ist: string | null
  produktionsende_datum_ist: string | null
  shippingdatum_ist: string | null
  ankunftsdatum_ist: string | null
  verfuegbarkeitsdatum_ist: string | null
  abgeschlossen_am: string | null
  notizen: string | null
  created_at: string
  updated_at: string
  produkte: Array<{ id: string; produkt_id: string; produkt_name: string }>
  sku_mengen: Array<{
    id: string
    sku_id: string
    sku_name: string
    menge_theoretisch: number | null
    menge_nach_moq: number | null
    menge_praktisch: number
    begruendung_anpassung: string | null
    is_trigger: boolean
  }>
  konsolidierungsgruppe_id: string | null
  konsolidierungspartner: KonsolidierungsPartner[]
  container_anteil: Record<string, number> | null
}

type BaseRow = Omit<FullBestellung, 'produkte' | 'sku_mengen' | 'konsolidierungsgruppe_id' | 'konsolidierungspartner' | 'container_anteil'>

export async function enrichBestellungen(
  supabase: SupabaseClient,
  baseRows: BaseRow[],
): Promise<FullBestellung[]> {
  if (baseRows.length === 0) return []

  const ids = baseRows.map(b => b.id)

  const [produkteRes, skuMengenRes, mitgliederRes] = await Promise.all([
    supabase.from('bestellungen_produkte').select('id, bestellung_id, produkt_id').in('bestellung_id', ids),
    supabase.from('bestellungen_sku_mengen')
      .select('id, bestellung_id, sku_id, menge_theoretisch, menge_nach_moq, menge_praktisch, begruendung_anpassung, is_trigger')
      .in('bestellung_id', ids),
    supabase.from('bestellungen_konsolidierungsmitglieder')
      .select('bestellung_id, gruppe_id, container_anteil')
      .in('bestellung_id', ids),
  ])

  const produkteRaw: Array<{ id: string; bestellung_id: string; produkt_id: string }> = produkteRes.data ?? []
  const skuMengenRaw: Array<{
    id: string; bestellung_id: string; sku_id: string
    menge_theoretisch: number | null; menge_nach_moq: number | null; menge_praktisch: number
    begruendung_anpassung: string | null; is_trigger: boolean
  }> = skuMengenRes.data ?? []
  const mitgliederRaw: Array<{ bestellung_id: string; gruppe_id: string; container_anteil: Record<string, number> | null }> =
    (mitgliederRes.data ?? []) as Array<{ bestellung_id: string; gruppe_id: string; container_anteil: Record<string, number> | null }>

  // Build gruppe_id → [bestellung_id, ...] mapping for partner lookup
  const gruppeIds = [...new Set(mitgliederRaw.map(m => m.gruppe_id))]
  let alleMitgliederInGruppen: Array<{ gruppe_id: string; bestellung_id: string }> = []
  if (gruppeIds.length > 0) {
    const { data } = await supabase
      .from('bestellungen_konsolidierungsmitglieder')
      .select('gruppe_id, bestellung_id')
      .in('gruppe_id', gruppeIds)
    alleMitgliederInGruppen = (data ?? []) as Array<{ gruppe_id: string; bestellung_id: string }>
  }

  // Build map: gruppe_id → all member bestellung_ids in that group
  const gruppeToMitglieder = new Map<string, string[]>()
  for (const m of alleMitgliederInGruppen) {
    if (!gruppeToMitglieder.has(m.gruppe_id)) gruppeToMitglieder.set(m.gruppe_id, [])
    gruppeToMitglieder.get(m.gruppe_id)!.push(m.bestellung_id)
  }

  // Load produkt names for partner bestellungen
  const idsSet = new Set(ids)
  const partnerIds = [...new Set(alleMitgliederInGruppen.map(m => m.bestellung_id).filter(id => !idsSet.has(id)))]

  let partnerProdukteRaw: Array<{ bestellung_id: string; produkt_id: string }> = []
  if (partnerIds.length > 0) {
    const { data } = await supabase
      .from('bestellungen_produkte')
      .select('bestellung_id, produkt_id')
      .in('bestellung_id', partnerIds)
    partnerProdukteRaw = (data ?? []) as Array<{ bestellung_id: string; produkt_id: string }>
  }

  // Collect all kategorie IDs for name lookup
  const allCatIds = new Set<string>()
  for (const p of produkteRaw) allCatIds.add(p.produkt_id)
  for (const s of skuMengenRaw) allCatIds.add(s.sku_id)
  for (const p of partnerProdukteRaw) allCatIds.add(p.produkt_id)

  const { data: cats } = await supabase
    .from('kpi_categories')
    .select('id, name')
    .in('id', [...allCatIds])
    .limit(1000)

  const nameById = new Map(((cats ?? []) as Array<{ id: string; name: string }>).map(c => [c.id, c.name]))

  // Build partner produkt_namen per bestellung_id
  const partnerNamenByBestId = new Map<string, string[]>()
  for (const p of partnerProdukteRaw) {
    if (!partnerNamenByBestId.has(p.bestellung_id)) partnerNamenByBestId.set(p.bestellung_id, [])
    partnerNamenByBestId.get(p.bestellung_id)!.push(nameById.get(p.produkt_id) ?? '')
  }

  // Build per-bestellung: gruppe_id, konsolidierungspartner, container_anteil
  const gruppeIdByBestId = new Map<string, string>()
  const containerAnteilByBestId = new Map<string, Record<string, number> | null>()
  for (const m of mitgliederRaw) {
    gruppeIdByBestId.set(m.bestellung_id, m.gruppe_id)
    containerAnteilByBestId.set(m.bestellung_id, m.container_anteil)
  }

  const partnerByBestId = new Map<string, KonsolidierungsPartner[]>()
  for (const [bestId, gruppeId] of gruppeIdByBestId) {
    const allMitglieder = gruppeToMitglieder.get(gruppeId) ?? []
    const partner: KonsolidierungsPartner[] = allMitglieder
      .filter(mid => mid !== bestId)
      .map(mid => ({
        bestellung_id: mid,
        produkt_namen: partnerNamenByBestId.get(mid) ?? [],
      }))
    partnerByBestId.set(bestId, partner)
  }

  // Build produkte and sku_mengen per bestellung
  const produkteByBest = new Map<string, FullBestellung['produkte']>()
  for (const p of produkteRaw) {
    if (!produkteByBest.has(p.bestellung_id)) produkteByBest.set(p.bestellung_id, [])
    produkteByBest.get(p.bestellung_id)!.push({
      id: p.id, produkt_id: p.produkt_id, produkt_name: nameById.get(p.produkt_id) ?? '',
    })
  }

  const skuMengenByBest = new Map<string, FullBestellung['sku_mengen']>()
  for (const s of skuMengenRaw) {
    if (!skuMengenByBest.has(s.bestellung_id)) skuMengenByBest.set(s.bestellung_id, [])
    skuMengenByBest.get(s.bestellung_id)!.push({
      id: s.id, sku_id: s.sku_id, sku_name: nameById.get(s.sku_id) ?? '',
      menge_theoretisch: s.menge_theoretisch, menge_nach_moq: s.menge_nach_moq,
      menge_praktisch: s.menge_praktisch, begruendung_anpassung: s.begruendung_anpassung,
      is_trigger: s.is_trigger,
    })
  }

  return baseRows.map(b => ({
    ...b,
    produkte: produkteByBest.get(b.id) ?? [],
    sku_mengen: skuMengenByBest.get(b.id) ?? [],
    konsolidierungsgruppe_id: gruppeIdByBestId.get(b.id) ?? null,
    konsolidierungspartner: partnerByBestId.get(b.id) ?? [],
    container_anteil: containerAnteilByBestId.get(b.id) ?? null,
  }))
}

// ─── Bestellkosten-Generierung ────────────────────────────────────────────────

interface BestellungForKosten {
  id: string
  bestelldatum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  anzahl_40hq: number
  anzahl_20dc: number
  produkt_ids: string[]
  sku_mengen: Array<{ sku_id: string; menge_praktisch: number; produkt_id?: string }>
}

export async function generiereUndSpeichereBestellkosten(
  supabase: SupabaseClient,
  userId: string,
  bestellungen: BestellungForKosten[],
): Promise<void> {
  if (bestellungen.length === 0) return

  // Delete existing auto-generated entries before regenerating (runs even when no products)
  await supabase
    .from('bestellungen_kosten')
    .delete()
    .eq('user_id', userId)
    .eq('ist_automatisch', true)
    .in('bestellung_id', bestellungen.map(b => b.id))

  const allProduktIds = [...new Set(bestellungen.flatMap(b => b.produkt_ids))]
  if (allProduktIds.length === 0) return

  // Load all stammdaten in parallel
  const [pkRes, zkRes, kgRes, catRes] = await Promise.all([
    supabase
      .from('produktinformationen_produktkosten')
      .select('produkt_id, warenkosten, zollsatz_prozent')
      .eq('user_id', userId)
      .in('produkt_id', allProduktIds),
    supabase
      .from('produktinformationen_zahlungskonditionen')
      .select('produkt_id, vor_produktion_prozent, nach_produktion_prozent, nach_ankunft_prozent, zahlungsziel_vor_produktion_tage, zahlungsziel_nach_produktion_tage, zahlungsziel_nach_ankunft_tage')
      .eq('user_id', userId)
      .in('produkt_id', allProduktIds),
    supabase
      .from('produktinformationen_kosten_global')
      .select('shipping_kosten_20dc, shipping_kosten_40hq, shipping_zahlungsziel_tage, inspektion_kosten_20dc, inspektion_kosten_40hq, inspektion_zahlungsziel_tage, einlagerung_kosten_20dc, einlagerung_kosten_40hq, einlagerung_zahlungsziel_tage, zoll_zahlungsziel_tage')
      .eq('user_id', userId)
      .maybeSingle(),
    // Find "Produkt" parent category and its children
    supabase
      .from('kpi_categories')
      .select('id, name, parent_id, level')
      .eq('user_id', userId)
      .in('level', [1, 2]),
  ])

  const produktkostenListe: ProduktKosten[] = (pkRes.data ?? []) as ProduktKosten[]
  const zahlungskonditionenListe: Zahlungskonditionen[] = (zkRes.data ?? []) as Zahlungskonditionen[]
  const kostenGlobal: KostenGlobal | null = kgRes.data as KostenGlobal | null

  // Find "Produkt" parent and its direct children (Unterkategorien)
  const allCats = (catRes.data ?? []) as Array<{ id: string; name: string; parent_id: string | null; level: number }>
  const produktParent = allCats.find(c => c.level === 1 && c.name.toLowerCase().trim() === 'produkt')
  const produktUnterkategorien: KpiKategorie[] = produktParent
    ? allCats.filter(c => c.parent_id === produktParent.id)
    : []

  // Build sku → produkt_id map from bestellungen_produkte + bestellungen_sku_mengen
  // We need to know which SKU belongs to which product for multi-product orders
  const allBestellungIds = bestellungen.map(b => b.id)
  const { data: skuMengenRows } = await supabase
    .from('bestellungen_sku_mengen')
    .select('bestellung_id, sku_id, menge_praktisch')
    .in('bestellung_id', allBestellungIds)

  const { data: produkteRows } = await supabase
    .from('bestellungen_produkte')
    .select('bestellung_id, produkt_id')
    .in('bestellung_id', allBestellungIds)

  // Build: bestellung_id → [{ produkt_id, sku_ids }]
  // We need to map skus to their parent product
  const { data: skuCats } = await supabase
    .from('kpi_categories')
    .select('id, parent_id')
    .in('id', (skuMengenRows ?? []).map((s: { sku_id: string }) => s.sku_id))

  const skuParentMap = new Map<string, string>()
  for (const c of (skuCats ?? []) as Array<{ id: string; parent_id: string | null }>) {
    if (c.parent_id) skuParentMap.set(c.id, c.parent_id)
  }

  // Generate and insert costs for each bestellung
  const allInserts: Array<{
    bestellung_id: string
    user_id: string
    kpi_kategorie_id: string | null
    datum: string
    nettobetrag: number
    begruendung: string
    ist_automatisch: boolean
  }> = []

  for (const b of bestellungen) {
    // Build per-product sku_mengen
    const bestSkuMengen = (skuMengenRows ?? []).filter((s: { bestellung_id: string }) => s.bestellung_id === b.id) as Array<{ sku_id: string; menge_praktisch: number }>
    const bestProduktIds = (produkteRows ?? [])
      .filter((p: { bestellung_id: string }) => p.bestellung_id === b.id)
      .map((p: { produkt_id: string }) => p.produkt_id)

    // Group SKUs by their parent product
    const produktSkuMap = new Map<string, Array<{ menge_praktisch: number }>>()
    for (const pid of bestProduktIds) {
      produktSkuMap.set(pid, [])
    }
    for (const sm of bestSkuMengen) {
      const parentId = skuParentMap.get(sm.sku_id)
      if (parentId && produktSkuMap.has(parentId)) {
        produktSkuMap.get(parentId)!.push({ menge_praktisch: sm.menge_praktisch })
      }
    }

    const bestellungDaten: BestellungDaten = {
      bestelldatum: b.bestelldatum,
      produktionsende_datum: b.produktionsende_datum,
      shippingdatum: b.shippingdatum,
      ankunftsdatum: b.ankunftsdatum,
      verfuegbarkeitsdatum: b.verfuegbarkeitsdatum,
      anzahl_40hq: b.anzahl_40hq,
      anzahl_20dc: b.anzahl_20dc,
      produkte: bestProduktIds.map(pid => ({
        produkt_id: pid,
        sku_mengen: produktSkuMap.get(pid) ?? [],
      })),
    }

    const generierte = generiereBestellkosten(
      bestellungDaten,
      produktkostenListe.filter(pk => bestProduktIds.includes(pk.produkt_id)),
      zahlungskonditionenListe.filter(zk => bestProduktIds.includes(zk.produkt_id)),
      kostenGlobal,
      produktUnterkategorien,
    )

    for (const eintrag of generierte) {
      allInserts.push({
        bestellung_id: b.id,
        user_id: userId,
        kpi_kategorie_id: eintrag.kpi_kategorie_id,
        datum: eintrag.datum,
        nettobetrag: eintrag.nettobetrag,
        begruendung: eintrag.begruendung,
        ist_automatisch: true,
      })
    }
  }

  if (allInserts.length > 0) {
    await supabase.from('bestellungen_kosten').insert(allInserts)
  }
}

// Loads all plan Bestellungen and regenerates their costs from current Stammdaten.
// Called after every Planbestelllauf so container/product changes are reflected.
export async function ladeUndRegenerierePlanBestellkosten(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: rows } = await supabase
    .from('bestellungen')
    .select('id, bestelldatum, produktionsende_datum, shippingdatum, ankunftsdatum, verfuegbarkeitsdatum, anzahl_40hq, anzahl_20dc')
    .eq('user_id', userId)
    .eq('status', 'plan')
    .limit(500)

  if (!rows || rows.length === 0) return

  const ids = (rows as Array<{ id: string }>).map(b => b.id)
  const { data: produkteRows } = await supabase
    .from('bestellungen_produkte')
    .select('bestellung_id, produkt_id')
    .in('bestellung_id', ids)

  const produkteByBest = new Map<string, string[]>()
  for (const p of (produkteRows ?? []) as Array<{ bestellung_id: string; produkt_id: string }>) {
    if (!produkteByBest.has(p.bestellung_id)) produkteByBest.set(p.bestellung_id, [])
    produkteByBest.get(p.bestellung_id)!.push(p.produkt_id)
  }

  const bestellungenForKosten = (rows as Array<{
    id: string
    bestelldatum: string | null
    produktionsende_datum: string | null
    shippingdatum: string | null
    ankunftsdatum: string | null
    verfuegbarkeitsdatum: string | null
    anzahl_40hq: number
    anzahl_20dc: number
  }>).map(b => ({
    ...b,
    produkt_ids: produkteByBest.get(b.id) ?? [],
    sku_mengen: [] as Array<{ sku_id: string; menge_praktisch: number }>,
  }))

  await generiereUndSpeichereBestellkosten(supabase, userId, bestellungenForKosten)
}
