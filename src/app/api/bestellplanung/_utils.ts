import type { createSupabaseServerClient } from '@/lib/supabase-server'

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

export interface FullBestellung {
  id: string
  status: string
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
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
    menge_praktisch: number
    begruendung_anpassung: string | null
  }>
  konsolidierungen: Array<{
    id: string
    bestellung_id_1: string
    bestellung_id_2: string
    containerart: string
    andere_produkte: string[]
  }>
}

type BaseRow = Omit<FullBestellung, 'produkte' | 'sku_mengen' | 'konsolidierungen'>

export async function enrichBestellungen(
  supabase: SupabaseClient,
  baseRows: BaseRow[],
): Promise<FullBestellung[]> {
  if (baseRows.length === 0) return []

  const ids = baseRows.map(b => b.id)
  const idList = ids.join(',')

  const [produkteRes, skuMengenRes, konsRes] = await Promise.all([
    supabase.from('bestellungen_produkte').select('id, bestellung_id, produkt_id').in('bestellung_id', ids),
    supabase.from('bestellungen_sku_mengen')
      .select('id, bestellung_id, sku_id, menge_theoretisch, menge_praktisch, begruendung_anpassung')
      .in('bestellung_id', ids),
    supabase.from('bestellungen_konsolidierungen')
      .select('id, bestellung_id_1, bestellung_id_2, containerart')
      .or(`bestellung_id_1.in.(${idList}),bestellung_id_2.in.(${idList})`),
  ])

  const produkteRaw: Array<{ id: string; bestellung_id: string; produkt_id: string }> = produkteRes.data ?? []
  const skuMengenRaw: Array<{
    id: string; bestellung_id: string; sku_id: string
    menge_theoretisch: number | null; menge_praktisch: number; begruendung_anpassung: string | null
  }> = skuMengenRes.data ?? []
  const konsRaw: Array<{ id: string; bestellung_id_1: string; bestellung_id_2: string; containerart: string }> =
    konsRes.data ?? []

  const allCatIds = new Set<string>()
  for (const p of produkteRaw) allCatIds.add(p.produkt_id)
  for (const s of skuMengenRaw) allCatIds.add(s.sku_id)

  const idsSet = new Set(ids)
  const otherKonsIds = [...new Set(
    konsRaw.flatMap(k => [k.bestellung_id_1, k.bestellung_id_2]).filter(id => !idsSet.has(id))
  )]

  let otherProdRaw: Array<{ bestellung_id: string; produkt_id: string }> = []
  if (otherKonsIds.length > 0) {
    const { data } = await supabase
      .from('bestellungen_produkte')
      .select('bestellung_id, produkt_id')
      .in('bestellung_id', otherKonsIds)
    otherProdRaw = data ?? []
    for (const p of otherProdRaw) allCatIds.add(p.produkt_id)
  }

  const { data: cats } = await supabase
    .from('kpi_categories')
    .select('id, name')
    .in('id', [...allCatIds])
    .limit(1000)

  const nameById = new Map(((cats ?? []) as Array<{ id: string; name: string }>).map(c => [c.id, c.name]))

  const otherProdByBestId = new Map<string, string[]>()
  for (const p of otherProdRaw) {
    if (!otherProdByBestId.has(p.bestellung_id)) otherProdByBestId.set(p.bestellung_id, [])
    otherProdByBestId.get(p.bestellung_id)!.push(nameById.get(p.produkt_id) ?? '')
  }

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
      menge_theoretisch: s.menge_theoretisch, menge_praktisch: s.menge_praktisch,
      begruendung_anpassung: s.begruendung_anpassung,
    })
  }

  const konsByBest = new Map<string, FullBestellung['konsolidierungen']>()
  for (const k of konsRaw) {
    for (const myId of ids) {
      if (k.bestellung_id_1 === myId || k.bestellung_id_2 === myId) {
        if (!konsByBest.has(myId)) konsByBest.set(myId, [])
        const otherId = k.bestellung_id_1 === myId ? k.bestellung_id_2 : k.bestellung_id_1
        konsByBest.get(myId)!.push({
          id: k.id, bestellung_id_1: k.bestellung_id_1, bestellung_id_2: k.bestellung_id_2,
          containerart: k.containerart, andere_produkte: otherProdByBestId.get(otherId) ?? [],
        })
      }
    }
  }

  return baseRows.map(b => ({
    ...b,
    produkte: produkteByBest.get(b.id) ?? [],
    sku_mengen: skuMengenByBest.get(b.id) ?? [],
    konsolidierungen: konsByBest.get(b.id) ?? [],
  }))
}
