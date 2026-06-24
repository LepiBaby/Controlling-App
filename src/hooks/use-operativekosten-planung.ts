'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'

// PROJ-88: Versionsgebundene Operativekosten-Planung der Langfristigen Planung.
// Lädt Startmonat/Horizont (Grundeinstellungen der Version), den GLOBALEN
// "Operativ"-Subtree des KPI-Modells (Gruppen + Untergruppen) und die gespeicherten
// Werte der Version. Es gibt KEINE historische Vorbelegung — leere Zellen bleiben
// leer. Alle Werte werden manuell je Untergruppe (bzw. Gruppe ohne Untergruppen)
// eingegeben; Gruppen- und Gesamtsummen werden berechnet, nicht gespeichert.

// ─── Typen ──────────────────────────────────────────────────────────────────

export interface PlanungsMonat {
  year: number
  month: number // 1–12
  label: string // z.B. "Apr. 2026"
}

export interface OperativUntergruppe {
  id: string
  name: string
}

export interface OperativGruppe {
  id: string
  name: string
  // Untergruppen (L2). Leer, wenn die Gruppe selbst ein editierbares Leaf ist.
  untergruppen: OperativUntergruppe[]
  // true, wenn die Gruppe keine Untergruppen hat → die Gruppe selbst ist editierbar.
  istLeaf: boolean
}

interface OperativekostenRecord {
  kategorie_id: string
  jahr: number
  monat: number
  betrag: number | null
}

// ─── Schlüssel-Helfer ─────────────────────────────────────────────────────────

// Werte-/Selektions-/Notiz-Schlüssel je editierbare Zellkoordinate.
export function betragCellKey(kategorieId: string, year: number, month: number): string {
  return `${kategorieId}:${year}:${month}`
}

// ─── Monatsfenster berechnen ───────────────────────────────────────────────────

function monatLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
    month: 'short',
    year: 'numeric',
  })
}

// Erste Spalte = exakt der Startmonat (KEIN Vorlauf); insgesamt `horizont` Monate.
export function buildOperativekostenMonate(
  startMonat: number,
  startJahr: number,
  horizont: number,
): PlanungsMonat[] {
  const total = Math.max(1, horizont)
  let y = startJahr
  let m = startMonat
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

export interface OperativekostenBatchCell {
  kategorieId: string
  monat: PlanungsMonat
  value: number | null
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useOperativekostenPlanung(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [gruppen, setGruppen] = useState<OperativGruppe[]>([])
  // Werte-Map, keyed mit betragCellKey(...)
  const [betragMap, setBetragMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const valuesPath = `/api/langfristige-planung/${versionId}/operativekosten-planung`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [grundRes, katRes, valuesRes] = await Promise.all([
          fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
          fetch('/api/kpi-categories?type=ausgaben_kosten'),
          fetch(valuesPath),
        ])

        if (!grundRes.ok || !katRes.ok || !valuesRes.ok) {
          throw new Error('load failed')
        }

        const grund = await grundRes.json()
        const katData: KpiCategory[] = await katRes.json()
        const valuesData: OperativekostenRecord[] = await valuesRes.json()
        if (!aktiv) return

        const horizont = grund.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        setMonate(buildOperativekostenMonate(grund.startmonat_monat, grund.startmonat_jahr, horizont))

        // Globalen "Operativ"-Subtree aufbauen: Root → L1-Gruppen → L2-Untergruppen.
        const allKats = Array.isArray(katData) ? katData : []
        const operativRoot = allKats.find(k => k.name.trim().toLowerCase() === 'operativ')
        const operativId = operativRoot?.id ?? null
        const byOrder = (a: KpiCategory, b: KpiCategory) => a.sort_order - b.sort_order

        const l1 = operativId
          ? allKats.filter(k => k.parent_id === operativId).slice().sort(byOrder)
          : []
        const built: OperativGruppe[] = l1.map(g => {
          const untergruppen = allKats
            .filter(k => k.parent_id === g.id)
            .slice()
            .sort(byOrder)
            .map(u => ({ id: u.id, name: u.name }))
          return {
            id: g.id,
            name: g.name,
            untergruppen,
            istLeaf: untergruppen.length === 0,
          }
        })
        setGruppen(built)

        const bMap = new Map<string, number>()
        for (const r of valuesData) {
          if (r.betrag !== null && r.betrag !== undefined) {
            bMap.set(betragCellKey(r.kategorie_id, r.jahr, r.monat), r.betrag)
          }
        }
        setBetragMap(bMap)
        setLoading(false)
      } catch {
        if (!aktiv) return
        setError('Fehler beim Laden der Operativekosten-Planung.')
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

  const getBetrag = useCallback(
    (kategorieId: string, monat: PlanungsMonat): number | null => {
      const v = betragMap.get(betragCellKey(kategorieId, monat.year, monat.month))
      return v ?? null
    },
    [betragMap],
  )

  // Alle editierbaren Leaf-Kategorie-IDs (Untergruppen + Gruppen ohne Untergruppen).
  const leafKategorieIds = useMemo(() => {
    const ids: string[] = []
    for (const g of gruppen) {
      if (g.istLeaf) ids.push(g.id)
      else for (const u of g.untergruppen) ids.push(u.id)
    }
    return ids
  }, [gruppen])

  // ─── Persistenz ──────────────────────────────────────────────────────────────

  async function putCells(cells: OperativekostenRecord[]): Promise<void> {
    const res = await fetch(valuesPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cells.length === 1 ? cells[0] : { cells }),
    })
    if (!res.ok) throw new Error('Speichern fehlgeschlagen')
  }

  const applyLocal = useCallback(
    (kategorieId: string, monat: PlanungsMonat, value: number | null) => {
      const k = betragCellKey(kategorieId, monat.year, monat.month)
      setBetragMap(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(k)
        else next.set(k, value)
        return next
      })
    },
    [],
  )

  const upsertCell = useCallback(
    async (kategorieId: string, monat: PlanungsMonat, value: number | null): Promise<void> => {
      const k = betragCellKey(kategorieId, monat.year, monat.month)
      const prev = betragMap.get(k)
      applyLocal(kategorieId, monat, value)
      try {
        await putCells([
          { kategorie_id: kategorieId, jahr: monat.year, monat: monat.month, betrag: value },
        ])
      } catch (e) {
        // Rollback
        setBetragMap(p => {
          const next = new Map(p)
          if (prev === undefined) next.delete(k)
          else next.set(k, prev)
          return next
        })
        throw e
      }
    },
    [betragMap, applyLocal],
  )

  const upsertBatch = useCallback(
    async (cells: OperativekostenBatchCell[]): Promise<void> => {
      if (cells.length === 0) return
      const snapshot = new Map(betragMap)

      const records: OperativekostenRecord[] = cells.map(c => {
        applyLocal(c.kategorieId, c.monat, c.value)
        return { kategorie_id: c.kategorieId, jahr: c.monat.year, monat: c.monat.month, betrag: c.value }
      })

      try {
        await putCells(records)
      } catch (e) {
        setBetragMap(snapshot)
        throw e
      }
    },
    [betragMap, applyLocal],
  )

  return {
    monate,
    gruppen,
    leafKategorieIds,
    loading,
    error,
    getBetrag,
    upsertCell,
    upsertBatch,
  }
}
