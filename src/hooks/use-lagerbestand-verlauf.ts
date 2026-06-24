'use client'

import { useState, useEffect, useMemo } from 'react'
import { getISOWeek, getISOWeekYear } from 'date-fns'
import type { KpiCategory } from '@/hooks/use-kpi-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LagerbestandWoche {
  kw: number
  jahr: number
  ist_prognose: boolean
}

export interface LagerbestandPunkt {
  kw: number
  jahr: number
  bestand_vorher: number
  bestand_nachher: number
  absatz: number | null
  ankunft: number
  bestellung_menge: number
  sicherheitsbestand: number | null
  meldebestand: number | null
  kalkulatorischer_bestand: number | null
  ist_prognose: boolean
}

export interface LagerbestandSku {
  sku_id: string
  sku_name: string
  farbe_index: number
  verlauf: LagerbestandPunkt[]
}

export interface LagerbestandVerlaufResponse {
  wochen: LagerbestandWoche[]
  skus: LagerbestandSku[]
}

// Recharts data point: one entry per KW, flat keys per SKU
export type ChartPunkt = {
  label: string
  ist_prognose: boolean
} & Record<string, number | null | boolean | string>

// ─── Color helpers ────────────────────────────────────────────────────────────

export function skuHue(farbe_index: number, total: number): number {
  return total <= 1 ? 0 : Math.round((farbe_index / (total - 1)) * 270)
}

// Extract HSL values from a SKU name by matching color keywords
function hslFromName(name: string): [number, number, number] | null {
  const s = name.toLowerCase()
  if (s.includes('grau') || s.includes('gray') || s.includes('grey')) return [0, 0, 52]
  if (s.includes('beige')) return [35, 42, 66]
  if (s.includes('creme') || s.includes('cream')) return [44, 50, 78]
  if (s.includes('sand')) return [38, 48, 63]
  if (s.includes('grün') || s.includes('gruen') || s.includes('green') || s.includes('mint')) return [142, 68, 40]
  if (s.includes('türkis') || s.includes('turkis') || s.includes('turquoise') || s.includes('cyan')) return [185, 72, 38]
  if (s.includes('marine') || s.includes('navy')) return [213, 70, 28]
  if (s.includes('blau') || s.includes('blue')) return [221, 78, 48]
  if (s.includes('lila') || s.includes('violett') || s.includes('violet') || s.includes('purple')) return [270, 68, 50]
  if (s.includes('rosa') || s.includes('rose') || s.includes('pink')) return [338, 72, 60]
  if (s.includes('bordeaux') || s.includes('weinrot')) return [345, 68, 33]
  if (s.includes('rot') || s.includes('red')) return [0, 80, 48]
  if (s.includes('orange')) return [24, 88, 50]
  if (s.includes('gold')) return [43, 80, 48]
  if (s.includes('gelb') || s.includes('yellow')) return [46, 88, 48]
  if (s.includes('braun') || s.includes('brown')) return [25, 58, 38]
  if (s.includes('schwarz') || s.includes('black')) return [220, 12, 22]
  if (s.includes('weiß') || s.includes('weiss') || s.includes('white')) return [0, 0, 88]
  if (s.includes('silber') || s.includes('silver')) return [0, 0, 68]
  if (s.includes('khaki')) return [54, 38, 52]
  return null
}

export function skuColor(farbe_index: number, total: number, name?: string): string {
  const hsl = name ? hslFromName(name) : null
  if (hsl) return `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`
  return `hsl(${skuHue(farbe_index, total)}, 80%, 45%)`
}

export function skuColorSB(farbe_index: number, total: number, name?: string): string {
  const hsl = name ? hslFromName(name) : null
  if (hsl) return `hsl(${hsl[0]}, ${Math.max(hsl[1] - 22, 12)}%, ${Math.min(hsl[2] + 20, 88)}%)`
  return `hsl(${skuHue(farbe_index, total)}, 55%, 62%)`
}

export function skuColorMB(farbe_index: number, total: number, name?: string): string {
  const hsl = name ? hslFromName(name) : null
  if (hsl) return `hsl(${hsl[0]}, ${Math.max(hsl[1] - 38, 8)}%, ${Math.min(hsl[2] + 30, 90)}%)`
  return `hsl(${skuHue(farbe_index, total)}, 35%, 72%)`
}

export function kwLabel(kw: number, jahr: number): string {
  return `KW${String(kw).padStart(2, '0')} / ${String(jahr).slice(2)}`
}

export function kwStartStr(kw: number, jahr: number): string {
  const jan4 = new Date(Date.UTC(jahr, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const monday = new Date(jan4.getTime() - (dow - 1) * 86_400_000 + (kw - 1) * 7 * 86_400_000)
  return `${String(monday.getUTCDate()).padStart(2, '0')}.${String(monday.getUTCMonth() + 1).padStart(2, '0')}.`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLagerbestandVerlauf() {
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  const [selectedProduktId, setSelectedProduktId] = useState<string | null>(null)
  const [aktiveSKUIds, setAktiveSKUIds] = useState<Set<string>>(new Set())
  const [data, setData] = useState<LagerbestandVerlaufResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load products on mount
  useEffect(() => {
    fetch('/api/kpi-categories?type=produkte')
      .then(r => (r.ok ? r.json() : []))
      .then((raw: unknown) => {
        const list = Array.isArray(raw) ? (raw as KpiCategory[]) : []
        setProdukte(list.filter(c => c.level === 1).sort((a, b) => a.sort_order - b.sort_order))
      })
      .catch(() => {/* noop */})
  }, [])

  // Load verlauf when product changes
  useEffect(() => {
    if (!selectedProduktId) {
      setData(null)
      setAktiveSKUIds(new Set())
      return
    }
    setIsLoading(true)
    setError(null)
    fetch(`/api/bestellplanung/lagerbestand-verlauf?produkt_id=${selectedProduktId}`)
      .then(r => {
        if (!r.ok) throw new Error(`Fehler beim Laden (${r.status})`)
        return r.json() as Promise<LagerbestandVerlaufResponse>
      })
      .then(d => {
        setData(d)
        setAktiveSKUIds(new Set(d.skus.map(s => s.sku_id)))
      })
      .catch(e => setError(String(e.message ?? e)))
      .finally(() => setIsLoading(false))
  }, [selectedProduktId])

  function selectProdukt(id: string | null) {
    setSelectedProduktId(id)
  }

  function toggleSku(skuId: string) {
    setAktiveSKUIds(prev => {
      if (prev.has(skuId) && prev.size <= 1) return prev
      const next = new Set(prev)
      if (next.has(skuId)) next.delete(skuId)
      else next.add(skuId)
      return next
    })
  }

  const currentKWLabel = useMemo(() => {
    const today = new Date()
    return kwLabel(getISOWeek(today), getISOWeekYear(today))
  }, [])

  // Active SKUs in order
  const activeSkus = useMemo(
    () => (data?.skus ?? []).filter(s => aktiveSKUIds.has(s.sku_id)),
    [data, aktiveSKUIds],
  )

  // Recharts-compatible flat data array (one entry per KW)
  const chartData = useMemo((): ChartPunkt[] => {
    if (!data) return []
    return data.wochen.map(w => {
      const punkt: ChartPunkt = {
        label: kwLabel(w.kw, w.jahr),
        start_date: kwStartStr(w.kw, w.jahr),
        ist_prognose: w.ist_prognose,
      }
      for (const sku of data.skus) {
        if (!aktiveSKUIds.has(sku.sku_id)) continue
        const v = sku.verlauf.find(p => p.kw === w.kw && p.jahr === w.jahr)
        if (v) {
          punkt[`bestand_${sku.sku_id}`] = v.bestand_nachher
          punkt[`sb_${sku.sku_id}`] = v.sicherheitsbestand
          punkt[`mb_${sku.sku_id}`] = v.meldebestand
          punkt[`absatz_${sku.sku_id}`] = v.absatz
          punkt[`kalk_${sku.sku_id}`] = v.kalkulatorischer_bestand
          punkt[`bst_${sku.sku_id}`] = v.bestellung_menge
          punkt[`ankunft_${sku.sku_id}`] = v.ankunft
        }
      }
      return punkt
    })
  }, [data, aktiveSKUIds])

  return {
    produkte,
    selectedProduktId,
    selectProdukt,
    aktiveSKUIds,
    toggleSku,
    data,
    isLoading,
    error,
    currentKWLabel,
    activeSkus,
    chartData,
  }
}
