import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

function toISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7),
  }
}

export interface SkuBestandSnapshot {
  sku_id: string
  aktueller_bestand: number
  ankunft_per_week: Record<string, number> // key: "year:week"
}

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const rawIds = searchParams.get('produkt_ids') ?? ''
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const produktIds = rawIds.split(',').map(s => s.trim()).filter(s => uuidRegex.test(s))

  if (produktIds.length === 0) return NextResponse.json([])

  // 1. SKUs dieser Produkte laden
  const { data: skusRaw } = await supabase
    .from('kpi_categories')
    .select('id, parent_id')
    .eq('type', 'produkte')
    .eq('level', 2)
    .in('parent_id', produktIds)
    .limit(500)

  const skus = (skusRaw ?? []) as Array<{ id: string; parent_id: string }>
  const skuIds = skus.map(s => s.id)
  if (skuIds.length === 0) return NextResponse.json([])

  const todayStr = new Date().toISOString().slice(0, 10)

  // 2. Aktueller Bestand pro SKU (letzter Abschlussbestand bis heute)
  const { data: bestandRows } = await fetchAllRows((from, to) =>
    supabase
      .from('bestand_transaktionen')
      .select('sku_id, anfangsbestand, einlagerungen, anpassungen_positiv, anpassungen_negativ, warenverluste, sendungen_manuell, bestand_sendungen(menge)')
      .in('sku_id', skuIds)
      .lte('datum', todayStr)
      .order('datum', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  )

  const currentBestandBySku = new Map<string, number>()
  for (const row of (bestandRows ?? []) as Array<{
    sku_id: string
    anfangsbestand: number
    einlagerungen: number
    anpassungen_positiv: number
    anpassungen_negativ: number
    warenverluste: number
    sendungen_manuell: number
    bestand_sendungen: Array<{ menge: number }>
  }>) {
    const sendungenSum = (row.bestand_sendungen ?? []).reduce((s, x) => s + x.menge, 0)
    const closing = Math.max(
      0,
      row.anfangsbestand + row.einlagerungen + row.anpassungen_positiv
        - row.anpassungen_negativ - row.warenverluste - row.sendungen_manuell - sendungenSum,
    )
    currentBestandBySku.set(row.sku_id, closing)
  }

  // 3. Geplante Zugänge: SKU-Mengen offener Bestellungen (plan/laufend)
  const { data: skuMengenRows } = await supabase
    .from('bestellungen_sku_mengen')
    .select('sku_id, menge_praktisch, bestellung_id')
    .in('sku_id', skuIds)
    .limit(1000)

  const bestellungIds = [...new Set((skuMengenRows ?? []).map((s: { bestellung_id: string }) => s.bestellung_id))]
  const ankunftBySku = new Map<string, Record<string, number>>()

  if (bestellungIds.length > 0) {
    const { data: bestRows } = await supabase
      .from('bestellungen')
      .select('id, verfuegbarkeitsdatum, verfuegbarkeitsdatum_ist')
      .in('id', bestellungIds)
      .in('status', ['plan', 'laufend'])
      .limit(500)

    const verfuegbarById = new Map<string, string>()
    for (const b of (bestRows ?? []) as Array<{ id: string; verfuegbarkeitsdatum: string | null; verfuegbarkeitsdatum_ist: string | null }>) {
      const v = b.verfuegbarkeitsdatum_ist ?? b.verfuegbarkeitsdatum
      if (v) verfuegbarById.set(b.id, v)
    }

    for (const sm of (skuMengenRows ?? []) as Array<{ sku_id: string; menge_praktisch: number; bestellung_id: string }>) {
      const v = verfuegbarById.get(sm.bestellung_id)
      if (!v) continue
      const kw = toISOWeek(new Date(v + 'T00:00:00Z'))
      const kwk = `${kw.year}:${kw.week}`
      if (!ankunftBySku.has(sm.sku_id)) ankunftBySku.set(sm.sku_id, {})
      const entry = ankunftBySku.get(sm.sku_id)!
      entry[kwk] = (entry[kwk] ?? 0) + sm.menge_praktisch
    }
  }

  const result: SkuBestandSnapshot[] = skuIds.map(skuId => ({
    sku_id: skuId,
    aktueller_bestand: currentBestandBySku.get(skuId) ?? 0,
    ankunft_per_week: ankunftBySku.get(skuId) ?? {},
  }))

  return NextResponse.json(result)
}
