'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'
import { berechneTilgungsplan } from '@/lib/finanzierung-tilgungsplan'

// PROJ-90: Versionsgebundene Finanzierungsausgaben-Planung der Langfristigen Planung.
// Direkte Spiegelung der Operativekosten-Planung (PROJ-88); einziger Unterschied ist
// der globale Wurzelknoten ("Finanzierung" statt "Operativ"). Lädt Startmonat/Horizont
// (Grundeinstellungen der Version), den GLOBALEN "Finanzierung"-Subtree des KPI-Modells
// (Gruppen + Untergruppen) und die gespeicherten Werte der Version. Es gibt KEINE
// historische Vorbelegung — leere Zellen bleiben leer. Alle Werte werden manuell je
// Untergruppe (bzw. Gruppe ohne Untergruppen) eingegeben; Gruppen- und Gesamtsummen
// werden berechnet, nicht gespeichert.

// ─── Typen ──────────────────────────────────────────────────────────────────

export interface PlanungsMonat {
  year: number
  month: number // 1–12
  label: string // z.B. "Apr. 2026"
}

export interface FinanzierungUntergruppe {
  id: string
  name: string
}

export interface FinanzierungGruppe {
  id: string
  name: string
  // Untergruppen (L2). Leer, wenn die Gruppe selbst ein editierbares Leaf ist.
  untergruppen: FinanzierungUntergruppe[]
  // true, wenn die Gruppe keine Untergruppen hat → die Gruppe selbst ist editierbar.
  istLeaf: boolean
}

interface FinanzierungsausgabenRecord {
  kategorie_id: string
  jahr: number
  monat: number
  betrag: number | null
}

// PROJ-107: Eine hinterlegte Finanzierung (Darlehen) — erzeugt je Monat eine
// Zinsen- und eine Tilgungs-Zeile unterhalb von „Zinsen" bzw. „Tilgung".
export interface FinanzierungDarlehen {
  id: string
  quelle_kbf_id: string | null
  zinsen_kategorie_id: string
  tilgung_kategorie_id: string
  name: string
  betrag: number
  zinssatz: number
  laufzeit_monate: number
  tilgungsfrei_monate: number
  start_jahr: number
  start_monat: number
  sort_order: number
}

export type FinanzierungDarlehenInput = Omit<FinanzierungDarlehen, 'id' | 'sort_order'>

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
export function buildFinanzierungsausgabenMonate(
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

export interface FinanzierungsausgabenBatchCell {
  kategorieId: string
  monat: PlanungsMonat
  value: number | null
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useFinanzierungsausgabenPlanung(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [gruppen, setGruppen] = useState<FinanzierungGruppe[]>([])
  // Werte-Map, keyed mit betragCellKey(...)
  const [betragMap, setBetragMap] = useState<Map<string, number>>(new Map())
  const [darlehen, setDarlehen] = useState<FinanzierungDarlehen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const valuesPath = `/api/langfristige-planung/${versionId}/finanzierungsausgaben-planung`
  const darlehenPath = `/api/langfristige-planung/${versionId}/finanzierungsausgaben-darlehen`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        // Nur die manuell gepflegten Werte — Finanzierungen werden separat geladen
        // und hier clientseitig als eigene Zeilen dargestellt (PROJ-107).
        const [grundRes, katRes, valuesRes, darlehenRes] = await Promise.all([
          fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
          fetch('/api/kpi-categories?type=ausgaben_kosten'),
          fetch(`${valuesPath}?nur_manuell=1`),
          fetch(darlehenPath),
        ])

        if (!grundRes.ok || !katRes.ok || !valuesRes.ok || !darlehenRes.ok) {
          throw new Error('load failed')
        }

        const grund = await grundRes.json()
        const katData: KpiCategory[] = await katRes.json()
        const valuesData: FinanzierungsausgabenRecord[] = await valuesRes.json()
        const darlehenData: FinanzierungDarlehen[] = await darlehenRes.json()
        if (!aktiv) return
        setDarlehen(darlehenData.map(normalizeDarlehen))

        const horizont = grund.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        setMonate(buildFinanzierungsausgabenMonate(grund.startmonat_monat, grund.startmonat_jahr, horizont))

        // Globalen "Finanzierung"-Subtree aufbauen: Root → L1-Gruppen → L2-Untergruppen.
        const allKats = Array.isArray(katData) ? katData : []
        const finanzRoot = allKats.find(k => k.name.trim().toLowerCase() === 'finanzierung')
        const finanzId = finanzRoot?.id ?? null
        const byOrder = (a: KpiCategory, b: KpiCategory) => a.sort_order - b.sort_order

        const l1 = finanzId
          ? allKats.filter(k => k.parent_id === finanzId).slice().sort(byOrder)
          : []
        const built: FinanzierungGruppe[] = l1.map(g => {
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
        setError('Fehler beim Laden der Finanzierungsausgaben-Planung.')
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

  async function putCells(cells: FinanzierungsausgabenRecord[]): Promise<void> {
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
    async (cells: FinanzierungsausgabenBatchCell[]): Promise<void> => {
      if (cells.length === 0) return
      const snapshot = new Map(betragMap)

      const records: FinanzierungsausgabenRecord[] = cells.map(c => {
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

  // ─── Finanzierungen (PROJ-107) ───────────────────────────────────────────────

  // Kategorie-IDs der L1-Gruppen „Zinsen" und „Tilgung" (Ziel der Finanzierungs-Zeilen).
  const zinsenKategorieId = useMemo(
    () => gruppen.find(g => g.name.trim().toLowerCase() === 'zinsen')?.id ?? null,
    [gruppen],
  )
  const tilgungKategorieId = useMemo(
    () => gruppen.find(g => g.name.trim().toLowerCase() === 'tilgung')?.id ?? null,
    [gruppen],
  )

  // Tilgungsplan je Finanzierung, keyed `${jahr}:${monat}`.
  const darlehenPlaene = useMemo(() => {
    const m = new Map<string, Map<string, { zinsen: number; tilgung: number }>>()
    for (const d of darlehen) {
      const plan = new Map<string, { zinsen: number; tilgung: number }>()
      for (const p of berechneTilgungsplan(d)) plan.set(`${p.jahr}:${p.monat}`, { zinsen: p.zinsen, tilgung: p.tilgung })
      m.set(d.id, plan)
    }
    return m
  }, [darlehen])

  /** Betrag einer Finanzierung in der gegebenen Kategorie (Zinsen- oder Tilgungs-Gruppe). */
  const getDarlehenBetrag = useCallback(
    (d: FinanzierungDarlehen, kategorieId: string, monat: PlanungsMonat): number => {
      const v = darlehenPlaene.get(d.id)?.get(`${monat.year}:${monat.month}`)
      if (!v) return 0
      if (kategorieId === d.zinsen_kategorie_id) return v.zinsen
      if (kategorieId === d.tilgung_kategorie_id) return v.tilgung
      return 0
    },
    [darlehenPlaene],
  )

  /** Alle Finanzierungen, die in der Gruppe `kategorieId` eine eigene Zeile erzeugen. */
  const darlehenFuerKategorie = useCallback(
    (kategorieId: string) =>
      darlehen.filter(d => d.zinsen_kategorie_id === kategorieId || d.tilgung_kategorie_id === kategorieId),
    [darlehen],
  )

  async function darlehenRequest(url: string, method: string, body?: unknown): Promise<unknown> {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? 'Speichern fehlgeschlagen')
    return data
  }

  const addDarlehen = useCallback(
    async (input: FinanzierungDarlehenInput): Promise<void> => {
      const created = (await darlehenRequest(darlehenPath, 'POST', input)) as FinanzierungDarlehen
      setDarlehen(prev => [...prev, normalizeDarlehen(created)])
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [darlehenPath],
  )

  const updateDarlehen = useCallback(
    async (id: string, input: FinanzierungDarlehenInput): Promise<void> => {
      const updated = (await darlehenRequest(`${darlehenPath}/${id}`, 'PUT', input)) as FinanzierungDarlehen
      setDarlehen(prev => prev.map(d => (d.id === id ? normalizeDarlehen(updated) : d)))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [darlehenPath],
  )

  const removeDarlehen = useCallback(
    async (id: string): Promise<void> => {
      await darlehenRequest(`${darlehenPath}/${id}`, 'DELETE')
      setDarlehen(prev => prev.filter(d => d.id !== id))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [darlehenPath],
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
    darlehen,
    zinsenKategorieId,
    tilgungKategorieId,
    getDarlehenBetrag,
    darlehenFuerKategorie,
    addDarlehen,
    updateDarlehen,
    removeDarlehen,
  }
}

// NUMERIC-Spalten kommen von PostgREST ggf. als String.
function normalizeDarlehen(d: FinanzierungDarlehen): FinanzierungDarlehen {
  return {
    ...d,
    betrag: Number(d.betrag),
    zinssatz: Number(d.zinssatz),
    laufzeit_monate: Number(d.laufzeit_monate),
    tilgungsfrei_monate: Number(d.tilgungsfrei_monate),
    start_jahr: Number(d.start_jahr),
    start_monat: Number(d.start_monat),
  }
}
