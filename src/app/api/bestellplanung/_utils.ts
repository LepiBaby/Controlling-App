import type { createSupabaseServerClient } from '@/lib/supabase-server'

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
