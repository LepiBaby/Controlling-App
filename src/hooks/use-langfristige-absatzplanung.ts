'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import {
  DEFAULT_PLANUNGSHORIZONT_MONATE,
} from '@/hooks/use-langfristige-grundeinstellungen'

// PROJ-84: Versionsgebundene Absatzplanung der Langfristigen Planung.
// Lädt Startmonat/Horizont (Grundeinstellungen), Plattformen + Produkte (KPI-Modell
// der Version) und die gespeicherten Absatz-/VK-Werte. Es gibt KEINE historische
// Vorbelegung — leere Zellen bleiben leer. Alle Werte werden manuell eingegeben.

// ─── Typen ──────────────────────────────────────────────────────────────────

export interface PlanungsMonat {
  year: number
  month: number // 1–12
  label: string // z.B. "Apr. 2026"
}

interface AbsatzplanungRecord {
  sales_plattform_id: string
  produkt_id: string
  jahr: number
  monat: number
  absatz: number | null
  effektiver_vk: number | null
}

interface LangfristigeKategorieRecord {
  id: string
  name: string
  sort_order: number
}

// ─── Schlüssel-Helfer ─────────────────────────────────────────────────────────

// Basisschlüssel je Zellkoordinate (ohne Feld-Suffix).
export function zellKey(plattformId: string, produktId: string, year: number, month: number): string {
  return `${plattformId}:${produktId}:${year}:${month}`
}

// Vollständiger Selektions-/Notiz-Schlüssel inkl. Feld.
export function absatzCellKey(plattformId: string, produktId: string, year: number, month: number): string {
  return `${zellKey(plattformId, produktId, year, month)}:absatz`
}

export function vkCellKey(plattformId: string, produktId: string, year: number, month: number): string {
  return `${zellKey(plattformId, produktId, year, month)}:vk`
}

// ─── Monatsfenster berechnen ───────────────────────────────────────────────────

function monatLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
    month: 'short',
    year: 'numeric',
  })
}

// Erste Spalte = Startmonat − 3 Monate; insgesamt (horizont + 3) Monate.
export function buildPlanungsmonate(
  startMonat: number,
  startJahr: number,
  horizont: number,
): PlanungsMonat[] {
  const total = horizont + 3
  let y = startJahr
  let m = startMonat - 3
  while (m <= 0) {
    m += 12
    y -= 1
  }
  const months: PlanungsMonat[] = []
  for (let i = 0; i < total; i++) {
    months.push({ year: y, month: m, label: monatLabel(y, m) })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return months
}

// ─── Batch-Eintrag (für Massen-Anpassung) ──────────────────────────────────────

export interface AbsatzplanungBatchCell {
  plattformId: string
  produktId: string
  monat: PlanungsMonat
  field: 'absatz' | 'vk'
  value: number | null
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLangfristigeAbsatzplanung(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [plattformen, setPlattformen] = useState<KpiCategory[]>([])
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  // Werte-Maps, keyed mit zellKey(...)
  const [absatzMap, setAbsatzMap] = useState<Map<string, number>>(new Map())
  const [vkMap, setVkMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const valuesPath = `/api/langfristige-planung/${versionId}/absatzplanung`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [grundRes, plattformRes, produktRes, valuesRes] = await Promise.all([
          fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_sales_plattform`),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_produkt`),
          fetch(valuesPath),
        ])

        if (!grundRes.ok || !plattformRes.ok || !produktRes.ok || !valuesRes.ok) {
          throw new Error('load failed')
        }

        const grund = await grundRes.json()
        const plattformData: LangfristigeKategorieRecord[] = await plattformRes.json()
        const produktData: LangfristigeKategorieRecord[] = await produktRes.json()
        const valuesData: AbsatzplanungRecord[] = await valuesRes.json()
        if (!aktiv) return

        const horizont =
          grund.planungshorizont_absatz_monate ??
          grund.planungshorizont_monate ??
          DEFAULT_PLANUNGSHORIZONT_MONATE
        setMonate(buildPlanungsmonate(grund.startmonat_monat, grund.startmonat_jahr, horizont))

        const sortByOrder = (a: LangfristigeKategorieRecord, b: LangfristigeKategorieRecord) =>
          a.sort_order - b.sort_order
        setPlattformen(plattformData.slice().sort(sortByOrder).map(toKpiLike))
        setProdukte(produktData.slice().sort(sortByOrder).map(toKpiLike))

        const aMap = new Map<string, number>()
        const vMap = new Map<string, number>()
        for (const r of valuesData) {
          const k = zellKey(r.sales_plattform_id, r.produkt_id, r.jahr, r.monat)
          if (r.absatz !== null && r.absatz !== undefined) aMap.set(k, r.absatz)
          if (r.effektiver_vk !== null && r.effektiver_vk !== undefined) vMap.set(k, r.effektiver_vk)
        }
        setAbsatzMap(aMap)
        setVkMap(vMap)
        setLoading(false)
      } catch {
        if (!aktiv) return
        setError('Fehler beim Laden der Absatzplanung.')
        setLoading(false)
      }
    }

    load()
    return () => {
      aktiv = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId])

  // ─── Selektoren ──────────────────────────────────────────────────────────────

  const getAbsatz = useCallback(
    (plattformId: string, produktId: string, monat: PlanungsMonat): number | null => {
      const v = absatzMap.get(zellKey(plattformId, produktId, monat.year, monat.month))
      return v ?? null
    },
    [absatzMap],
  )

  const getVK = useCallback(
    (plattformId: string, produktId: string, monat: PlanungsMonat): number | null => {
      const v = vkMap.get(zellKey(plattformId, produktId, monat.year, monat.month))
      return v ?? null
    },
    [vkMap],
  )

  // ─── Persistenz ──────────────────────────────────────────────────────────────

  async function putCells(cells: AbsatzplanungRecord[]): Promise<void> {
    const res = await fetch(valuesPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cells.length === 1 ? cells[0] : { cells }),
    })
    if (!res.ok) throw new Error('Speichern fehlgeschlagen')
  }

  const applyLocal = useCallback(
    (plattformId: string, produktId: string, monat: PlanungsMonat, field: 'absatz' | 'vk', value: number | null) => {
      const k = zellKey(plattformId, produktId, monat.year, monat.month)
      const setter = field === 'absatz' ? setAbsatzMap : setVkMap
      setter(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(k)
        else next.set(k, value)
        return next
      })
    },
    [],
  )

  const upsertCell = useCallback(
    async (
      plattformId: string,
      produktId: string,
      monat: PlanungsMonat,
      field: 'absatz' | 'vk',
      value: number | null,
    ): Promise<void> => {
      const k = zellKey(plattformId, produktId, monat.year, monat.month)
      const prevA = absatzMap.get(k)
      const prevV = vkMap.get(k)
      applyLocal(plattformId, produktId, monat, field, value)
      try {
        await putCells([
          {
            sales_plattform_id: plattformId,
            produkt_id: produktId,
            jahr: monat.year,
            monat: monat.month,
            absatz: field === 'absatz' ? value : (prevA ?? null),
            effektiver_vk: field === 'vk' ? value : (prevV ?? null),
          },
        ])
      } catch (e) {
        // Rollback
        setAbsatzMap(prev => {
          const next = new Map(prev)
          if (prevA === undefined) next.delete(k)
          else next.set(k, prevA)
          return next
        })
        setVkMap(prev => {
          const next = new Map(prev)
          if (prevV === undefined) next.delete(k)
          else next.set(k, prevV)
          return next
        })
        throw e
      }
    },
    [absatzMap, vkMap, applyLocal],
  )

  const upsertBatch = useCallback(
    async (cells: AbsatzplanungBatchCell[]): Promise<void> => {
      if (cells.length === 0) return
      // Snapshot für Rollback
      const snapshotA = new Map(absatzMap)
      const snapshotV = new Map(vkMap)

      // Lokales optimistisches Update
      const records: AbsatzplanungRecord[] = cells.map(c => {
        const k = zellKey(c.plattformId, c.produktId, c.monat.year, c.monat.month)
        applyLocal(c.plattformId, c.produktId, c.monat, c.field, c.value)
        return {
          sales_plattform_id: c.plattformId,
          produkt_id: c.produktId,
          jahr: c.monat.year,
          monat: c.monat.month,
          absatz: c.field === 'absatz' ? c.value : (snapshotA.get(k) ?? null),
          effektiver_vk: c.field === 'vk' ? c.value : (snapshotV.get(k) ?? null),
        }
      })

      try {
        await putCells(records)
      } catch (e) {
        setAbsatzMap(snapshotA)
        setVkMap(snapshotV)
        throw e
      }
    },
    [absatzMap, vkMap, applyLocal],
  )

  // Sortierte Plattformen/Produkte (für stabile Anzeige)
  const sortedPlattformen = useMemo(() => plattformen, [plattformen])
  const sortedProdukte = useMemo(() => produkte, [produkte])

  return {
    monate,
    plattformen: sortedPlattformen,
    produkte: sortedProdukte,
    loading,
    error,
    getAbsatz,
    getVK,
    upsertCell,
    upsertBatch,
  }
}

// Bildet einen Stammdaten-Datensatz auf das von der Tabelle erwartete Minimal-Shape ab.
function toKpiLike(r: LangfristigeKategorieRecord): KpiCategory {
  return {
    id: r.id,
    type: 'lp_produkt',
    parent_id: null,
    name: r.name,
    level: 1,
    sort_order: r.sort_order,
    sku_code: null,
    sales_plattform_enabled: false,
    produkt_enabled: false,
    kosten_label: null,
    ausgaben_label: null,
    ist_abzugsposten: false,
    ust_satz: null,
    exclude_from_rentabilitaet: false,
  }
}
