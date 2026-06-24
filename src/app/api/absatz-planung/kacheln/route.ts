import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

interface AbsatzEinstellung {
  sales_plattform_id: string
  produkt_id: string
  berechnungsart: string
  gewichtung_erstes_drittel: number | null
  gewichtung_zweites_drittel: number | null
  gewichtung_drittes_drittel: number | null
}

interface Sendung { plattform_id: string; menge: number }
interface SkuTransaktion { sku_id: string; datum: string; bestand_sendungen: Sendung[] }
interface SkuCategory { id: string; parent_id: string; sort_order: number }

function getPeriodDays(berechnungsart: string): number {
  if (berechnungsart.endsWith('_7')) return 7
  if (berechnungsart.endsWith('_14')) return 14
  if (berechnungsart.endsWith('_30')) return 30
  if (berechnungsart.endsWith('_60')) return 60
  if (berechnungsart.endsWith('_90')) return 90
  return 30
}

function toDateOnly(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date { return new Date(d.getTime() + n * 86_400_000) }

function calcKonfiguriert(
  entries: { datum: string; menge: number }[],
  e: AbsatzEinstellung,
  today: Date,
): number {
  const days = getPeriodDays(e.berechnungsart)
  const periodStart = addDays(today, -days)

  if (e.berechnungsart.startsWith('gewichtet_')) {
    const third = days / 3
    const t1 = toDateOnly(periodStart)
    const t2 = toDateOnly(addDays(periodStart, third))
    const t3 = toDateOnly(addDays(periodStart, third * 2))
    const end = toDateOnly(today)

    const sum1 = entries.filter(x => x.datum >= t1 && x.datum < t2).reduce((s, x) => s + x.menge, 0)
    const sum2 = entries.filter(x => x.datum >= t2 && x.datum < t3).reduce((s, x) => s + x.menge, 0)
    const sum3 = entries.filter(x => x.datum >= t3 && x.datum < end).reduce((s, x) => s + x.menge, 0)

    const w1 = e.gewichtung_erstes_drittel
    const w2 = e.gewichtung_zweites_drittel
    const w3 = e.gewichtung_drittes_drittel
    if (w1 == null || w2 == null || w3 == null) {
      return Math.round(((sum1 + sum2 + sum3) / days) * 100) / 100
    }
    const result = (w1 * (sum1 / third) + w2 * (sum2 / third) + w3 * (sum3 / third)) / 100
    return Math.round(result * 100) / 100
  }

  const todayStr = toDateOnly(today)
  const startStr = toDateOnly(periodStart)
  const total = entries.filter(e => e.datum >= startStr && e.datum < todayStr).reduce((s, e) => s + e.menge, 0)
  return Math.round((total / days) * 100) / 100
}

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data: einstellungen, error: eErr } = await supabase
    .from('absatz_einstellungen')
    .select(
      'sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel, gewichtung_zweites_drittel, gewichtung_drittes_drittel',
    )
    .eq('user_id', user!.id)
    .neq('berechnungsart', 'keine')
    .limit(500)

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
  if (!einstellungen?.length) return NextResponse.json({ data: [] })

  const productIds = [...new Set((einstellungen as AbsatzEinstellung[]).map(e => e.produkt_id))]

  const { data: skus, error: sErr } = await supabase
    .from('kpi_categories')
    .select('id, parent_id, sort_order')
    .in('parent_id', productIds)
    .eq('type', 'produkte')
    .eq('level', 2)
    .order('sort_order', { ascending: true })
    .limit(500)

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  const skuIds = (skus ?? []).map((s: SkuCategory) => s.id)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const ninetyDaysAgo = addDays(today, -90)

  let transaktionen: SkuTransaktion[] = []
  if (skuIds.length > 0) {
    const { data: txData, error: tErr } = await supabase
      .from('bestand_transaktionen')
      .select('sku_id, datum, bestand_sendungen(plattform_id, menge)')
      .gte('datum', toDateOnly(ninetyDaysAgo))
      .lt('datum', toDateOnly(today))
      .in('sku_id', skuIds)
      .limit(10000)

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
    transaktionen = (txData ?? []) as SkuTransaktion[]
  }

  // Build lookup: "skuId:plattformId" → [{datum, menge}]
  const dataByKombi = new Map<string, { datum: string; menge: number }[]>()
  for (const t of transaktionen) {
    for (const s of t.bestand_sendungen ?? []) {
      const key = `${t.sku_id}:${s.plattform_id}`
      if (!dataByKombi.has(key)) dataByKombi.set(key, [])
      dataByKombi.get(key)!.push({ datum: t.datum, menge: s.menge })
    }
  }

  // Group einstellungen by produkt
  const byProdukt = new Map<string, AbsatzEinstellung[]>()
  for (const e of einstellungen as AbsatzEinstellung[]) {
    if (!byProdukt.has(e.produkt_id)) byProdukt.set(e.produkt_id, [])
    byProdukt.get(e.produkt_id)!.push(e)
  }

  const results = Array.from(byProdukt.entries()).map(([produktId, list]) => {
    const productSkus = (skus ?? []).filter((s: SkuCategory) => s.parent_id === produktId)
    let hauptwert = 0
    // sku_id → total tagesdurchschnitt across all platforms
    const skuTotals = new Map<string, number>()

    const plattformen = list.map(e => {
      let platformHauptwert = 0
      const platformSkus: { sku_id: string; tagesdurchschnitt: number }[] = []

      for (const sku of productSkus as SkuCategory[]) {
        const entries = dataByKombi.get(`${sku.id}:${e.sales_plattform_id}`) ?? []
        const td = Math.round(calcKonfiguriert(entries, e, today) * 100) / 100
        platformSkus.push({ sku_id: sku.id, tagesdurchschnitt: td })
        platformHauptwert += td
        skuTotals.set(sku.id, (skuTotals.get(sku.id) ?? 0) + td)
      }

      hauptwert += platformHauptwert
      return {
        sales_plattform_id: e.sales_plattform_id,
        hauptwert: Math.round(platformHauptwert * 100) / 100,
        berechnungsart: e.berechnungsart,
        skus: platformSkus,
      }
    })

    // Sort SKUs by sort_order for consistent display
    const skusOrdered = (productSkus as SkuCategory[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(sku => ({
        sku_id: sku.id,
        tagesdurchschnitt: Math.round((skuTotals.get(sku.id) ?? 0) * 100) / 100,
      }))

    return {
      produkt_id: produktId,
      hauptwert: Math.round(hauptwert * 100) / 100,
      skus: skusOrdered,
      plattformen,
    }
  })

  return NextResponse.json({ data: results })
}
