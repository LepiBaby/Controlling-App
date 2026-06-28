import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

// ─── Types ────────────────────────────────────────────────────────────────────

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
interface SkuCategory { id: string; parent_id: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function calcTagesdurchschnitt(
  entries: { datum: string; menge: number }[],
  periodDays: number,
  einstellung: AbsatzEinstellung,
  today: Date,
): number {
  const periodStart = addDays(today, -periodDays)

  if (einstellung.berechnungsart.startsWith('gewichtet_')) {
    const thirdLength = periodDays / 3
    const t1Start = toDateOnly(periodStart)
    const t2Start = toDateOnly(addDays(periodStart, thirdLength))
    const t3Start = toDateOnly(addDays(periodStart, thirdLength * 2))
    const todayStr = toDateOnly(today)

    const sum1 = entries.filter(e => e.datum >= t1Start && e.datum < t2Start).reduce((s, e) => s + e.menge, 0)
    const sum2 = entries.filter(e => e.datum >= t2Start && e.datum < t3Start).reduce((s, e) => s + e.menge, 0)
    const sum3 = entries.filter(e => e.datum >= t3Start && e.datum < todayStr).reduce((s, e) => s + e.menge, 0)

    const w1 = einstellung.gewichtung_erstes_drittel
    const w2 = einstellung.gewichtung_zweites_drittel
    const w3 = einstellung.gewichtung_drittes_drittel

    if (w1 == null || w2 == null || w3 == null) {
      return Math.round(((sum1 + sum2 + sum3) / periodDays) * 100) / 100
    }
    const result = (w1 * (sum1 / thirdLength) + w2 * (sum2 / thirdLength) + w3 * (sum3 / thirdLength)) / 100
    return Math.round(result * 100) / 100
  }

  const total = entries
    .filter(e => e.datum >= toDateOnly(periodStart) && e.datum < toDateOnly(today))
    .reduce((sum, e) => sum + e.menge, 0)
  return Math.round((total / periodDays) * 100) / 100
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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
    .select('id, parent_id')
    .in('parent_id', productIds)
    .eq('type', 'produkte')
    .eq('level', 2)
    .order('sort_order', { ascending: true })
    .limit(500)

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
  if (!skus?.length) return NextResponse.json({ data: [] })

  const skuIds = (skus as SkuCategory[]).map(s => s.id)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const ninetyDaysAgo = addDays(today, -90)

  const { data: transaktionen, error: tErr } = await fetchAllRows((from, to) =>
    supabase
      .from('bestand_transaktionen')
      .select('sku_id, datum, bestand_sendungen(plattform_id, menge)')
      .gte('datum', toDateOnly(ninetyDaysAgo))
      .lt('datum', toDateOnly(today))
      .in('sku_id', skuIds)
      .order('id', { ascending: true })
      .range(from, to))

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  // Build lookup: "skuId:plattformId" → [{datum, menge}]
  const dataByKombi = new Map<string, { datum: string; menge: number }[]>()
  for (const t of (transaktionen ?? []) as SkuTransaktion[]) {
    for (const s of t.bestand_sendungen ?? []) {
      const key = `${t.sku_id}:${s.plattform_id}`
      if (!dataByKombi.has(key)) dataByKombi.set(key, [])
      dataByKombi.get(key)!.push({ datum: t.datum, menge: s.menge })
    }
  }

  const results = []
  for (const e of einstellungen as AbsatzEinstellung[]) {
    const productSkus = (skus as SkuCategory[]).filter(s => s.parent_id === e.produkt_id)
    const periodDays = getPeriodDays(e.berechnungsart)
    for (const sku of productSkus) {
      const entries = dataByKombi.get(`${sku.id}:${e.sales_plattform_id}`) ?? []
      const tagesdurchschnitt = calcTagesdurchschnitt(entries, periodDays, e, today)
      results.push({
        sku_id: sku.id,
        produkt_id: e.produkt_id,
        sales_plattform_id: e.sales_plattform_id,
        tagesdurchschnitt,
        berechnungsart: e.berechnungsart,
      })
    }
  }

  return NextResponse.json({ data: results })
}
