'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'

// PROJ-93: Versionsgebundene Steuerausgaben-Planung der Langfristigen Planung.
// Spiegelt die kurzfristige Steuerausgaben-Seite (PROJ-71) in Kategorie- und
// Berechnungslogik (Einfuhrumsatzsteuer + Umsatzsteuer vorausgefüllt), aber:
//   • Monatsspalten ab Startmonat (kein Vorlauf) über den allgemeinen Horizont.
//   • KEINE Ist-/Vergangenheitsspalten — die Langfristige Planung kennt keine
//     Transaktionen. Jede Spalte ist eine Soll-Spalte (berechnet + manuell).
//   • Zeilen = Gruppen unter dem globalen "Steuern"-Knoten (KEINE Produktebene).
//   • Beträge dürfen NEGATIV sein (Umsatzsteuer-Erstattung).
//   • Alle Einstellungen/Pläne stammen aus DIESER Planversion.
// Gespeichert wird ausschließlich die manuelle Überschreibung je Zelle; ein
// vorhandener Eintrag = manuell = blauer Punkt. Auto-Werte werden nie persistiert.

// ─── Typen ──────────────────────────────────────────────────────────────────

export interface PlanungsMonat {
  year: number
  month: number // 1–12
  label: string // z.B. "Apr. 2026"
}

export interface SteuerUntergruppe {
  id: string
  name: string
}

export interface SteuerGruppe {
  id: string
  name: string
  // Untergruppen (L2). Leer, wenn die Gruppe selbst ein editierbares Leaf ist.
  untergruppen: SteuerUntergruppe[]
  // true, wenn die Gruppe keine Untergruppen hat → die Gruppe selbst ist editierbar.
  istLeaf: boolean
}

interface ManuellerEintrag {
  kategorie_id: string
  jahr: number
  monat: number
  betrag_manuell: number | null
}

interface BerechneterEintrag {
  kategorie_id: string
  jahr: number
  monat: number
  wert: number
}

interface EinfuhrProduktEintrag {
  produkt_id: string | null
  produkt_name?: string
  jahr: number
  monat: number
  wert: number
}

interface UstKomponenteEintrag {
  komponente: 'output' | 'vorsteuer' | 'einfuhr'
  jahr: number
  monat: number
  wert: number
}

export type UstKomponente = 'output' | 'vorsteuer' | 'einfuhr'

const PRODUKT_NONE = '__none__'

function produktKey(produktId: string | null): string {
  return produktId ?? PRODUKT_NONE
}

interface BerechnetResponse {
  data?: BerechneterEintrag[]
  breakdown?: {
    einfuhr_produkte?: EinfuhrProduktEintrag[]
    umsatzsteuer_komponenten?: UstKomponenteEintrag[]
  }
}

// ─── Schlüssel-Helfer ─────────────────────────────────────────────────────────

// Werte-/Selektions-/Notiz-Schlüssel je Zellkoordinate (Kategorie × Monat).
export function betragCellKey(kategorieId: string, year: number, month: number): string {
  return `${kategorieId}:${year}:${month}`
}

// ─── Monatsfenster (kein Vorlauf — Start exakt im Startmonat) ───────────────────

function monatLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
    month: 'short',
    year: 'numeric',
  })
}

export function buildSteuerausgabenMonate(
  startMonat: number | undefined,
  startJahr: number | undefined,
  horizont: number,
): PlanungsMonat[] {
  const now = new Date()
  let m = startMonat ?? now.getMonth() + 1
  let y = startJahr ?? now.getFullYear()
  const total = Math.max(1, horizont)
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

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLangfristigeSteuerausgaben(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [gruppen, setGruppen] = useState<SteuerGruppe[]>([])
  // Manuelle Überschreibungen, keyed mit betragCellKey(...)
  const [values, setValues] = useState<Map<string, number>>(new Map())
  // Auto-berechnete Werte (Einfuhr-USt + Umsatzsteuer), keyed mit betragCellKey(...)
  const [berechneteWerte, setBerechneteWerte] = useState<Map<string, number>>(new Map())
  // Aufschlüsselungen (Drill-down)
  const [einfuhrProduktBerMap, setEinfuhrProduktBerMap] = useState<Map<string, number>>(new Map())
  const [ustKomponentenMap, setUstKomponentenMap] = useState<Map<string, number>>(new Map())
  const [produktNamen, setProduktNamen] = useState<Map<string, string>>(new Map())
  const [einfuhrProduktIds, setEinfuhrProduktIds] = useState<string[]>([])
  const [einfuhrKatId, setEinfuhrKatId] = useState<string | null>(null)
  const [umsatzsteuerKatId, setUmsatzsteuerKatId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const manuellPath = `/api/langfristige-planung/${versionId}/steuerausgaben`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [grundRes, katRes, manualRes, calcRes] = await Promise.all([
          fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
          fetch('/api/kpi-categories?type=ausgaben_kosten'),
          fetch(manuellPath),
          fetch(`${manuellPath}/berechnet`),
        ])

        const grund = grundRes.ok ? await grundRes.json() : {}
        const katData: KpiCategory[] = katRes.ok ? await katRes.json() : []
        const manualData: ManuellerEintrag[] = manualRes.ok ? await manualRes.json() : []
        const calcRaw: BerechnetResponse | BerechneterEintrag[] = calcRes.ok
          ? await calcRes.json()
          : { data: [] }
        if (!aktiv) return

        const horizont = grund.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        setMonate(buildSteuerausgabenMonate(grund.startmonat_monat, grund.startmonat_jahr, horizont))

        // Globalen "Steuern"-Subtree aufbauen: Root → L1-Gruppen → L2-Untergruppen.
        const allKats = Array.isArray(katData) ? katData : []
        const steuerRoot = allKats.find(k => k.name.trim().toLowerCase() === 'steuern')
        const steuerId = steuerRoot?.id ?? null
        const byOrder = (a: KpiCategory, b: KpiCategory) => a.sort_order - b.sort_order

        const l1 = steuerId
          ? allKats.filter(k => k.parent_id === steuerId).slice().sort(byOrder)
          : []
        const built: SteuerGruppe[] = l1.map(g => {
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

        // Einfuhr-/Umsatzsteuer-Leaf erkennen (für Drill-down). Über die tatsächlichen
        // editierbaren Leaf-Kategorien (group-leaf oder subgroup) suchen.
        let einfuhrId: string | null = null
        let ustId: string | null = null
        const consider = (id: string, name: string) => {
          const n = name.toLowerCase()
          if (n.includes('einfuhr') && einfuhrId === null) einfuhrId = id
          else if (n.includes('umsatzsteuer') && !n.includes('einfuhr') && ustId === null) ustId = id
        }
        for (const g of built) {
          if (g.istLeaf) consider(g.id, g.name)
          else for (const u of g.untergruppen) consider(u.id, u.name)
        }
        setEinfuhrKatId(einfuhrId)
        setUmsatzsteuerKatId(ustId)

        const valueMap = new Map<string, number>()
        for (const e of manualData) {
          if (e.betrag_manuell !== null && e.betrag_manuell !== undefined) {
            valueMap.set(betragCellKey(e.kategorie_id, e.jahr, e.monat), e.betrag_manuell)
          }
        }
        setValues(valueMap)

        const calcEntries = Array.isArray(calcRaw) ? calcRaw : (calcRaw.data ?? [])
        const berMap = new Map<string, number>()
        for (const e of calcEntries) {
          berMap.set(betragCellKey(e.kategorie_id, e.jahr, e.monat), e.wert)
        }
        setBerechneteWerte(berMap)

        // ── Aufschlüsselungen (Drill-down) ──────────────────────────────────────
        const breakdown = Array.isArray(calcRaw) ? undefined : calcRaw.breakdown
        const produktIdSet = new Set<string>()
        const namenMap = new Map<string, string>()
        namenMap.set(PRODUKT_NONE, 'Ohne Produktzuordnung')

        const einfuhrBerMap = new Map<string, number>()
        for (const e of breakdown?.einfuhr_produkte ?? []) {
          const pk = produktKey(e.produkt_id)
          produktIdSet.add(pk)
          if (e.produkt_name) namenMap.set(pk, e.produkt_name)
          einfuhrBerMap.set(betragCellKey(pk, e.jahr, e.monat), Number(e.wert ?? 0))
        }
        setEinfuhrProduktBerMap(einfuhrBerMap)
        setProduktNamen(namenMap)
        setEinfuhrProduktIds(
          [...produktIdSet].sort((a, b) => {
            if (a === PRODUKT_NONE) return 1
            if (b === PRODUKT_NONE) return -1
            return (namenMap.get(a) ?? a).localeCompare(namenMap.get(b) ?? b, 'de')
          }),
        )

        const ustKompMap = new Map<string, number>()
        for (const e of breakdown?.umsatzsteuer_komponenten ?? []) {
          ustKompMap.set(`${e.komponente}:${e.jahr}:${e.monat}`, Number(e.wert ?? 0))
        }
        setUstKomponentenMap(ustKompMap)

        setLoading(false)
      } catch {
        if (!aktiv) return
        setError('Fehler beim Laden der Steuerausgaben-Planung.')
        setLoading(false)
      }
    }

    load()
    return () => {
      aktiv = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId])

  // ─── Wert-Selektoren ────────────────────────────────────────────────────────

  const getManuellerWert = useCallback(
    (kategorieId: string, monat: PlanungsMonat): number | null => {
      const v = values.get(betragCellKey(kategorieId, monat.year, monat.month))
      return v !== undefined ? v : null
    },
    [values],
  )

  const getBerechneterWert = useCallback(
    (kategorieId: string, monat: PlanungsMonat): number | null => {
      const v = berechneteWerte.get(betragCellKey(kategorieId, monat.year, monat.month))
      return v !== undefined ? v : null
    },
    [berechneteWerte],
  )

  // Effektiver Soll-Wert je Leaf: manueller Wert hat Vorrang, sonst berechneter Wert.
  const getEffektiverWert = useCallback(
    (kategorieId: string, monat: PlanungsMonat): number | null => {
      const m = getManuellerWert(kategorieId, monat)
      if (m !== null) return m
      return getBerechneterWert(kategorieId, monat)
    },
    [getManuellerWert, getBerechneterWert],
  )

  const getEinfuhrProduktBer = useCallback(
    (produktId: string, monat: PlanungsMonat): number | null => {
      const v = einfuhrProduktBerMap.get(betragCellKey(produktId, monat.year, monat.month))
      return v !== undefined ? v : null
    },
    [einfuhrProduktBerMap],
  )

  const getUstKomponente = useCallback(
    (komponente: UstKomponente, monat: PlanungsMonat): number | null => {
      const v = ustKomponentenMap.get(`${komponente}:${monat.year}:${monat.month}`)
      return v !== undefined ? v : null
    },
    [ustKomponentenMap],
  )

  const isManuelleOverride = useCallback(
    (kategorieId: string, monat: PlanungsMonat): boolean =>
      values.has(betragCellKey(kategorieId, monat.year, monat.month)),
    [values],
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

  // ─── Mutationen ─────────────────────────────────────────────────────────────

  const upsertZelle = useCallback(
    async (kategorieId: string, monat: PlanungsMonat, value: number | null): Promise<void> => {
      const key = betragCellKey(kategorieId, monat.year, monat.month)
      const previous = values.get(key)
      setValues(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      })
      try {
        const res = await fetch(manuellPath, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kategorie_id: kategorieId,
            jahr: monat.year,
            monat: monat.month,
            betrag_manuell: value,
          }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setValues(prev => {
          const next = new Map(prev)
          if (previous !== undefined) next.set(key, previous)
          else next.delete(key)
          return next
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [values, manuellPath],
  )

  const resetAll = useCallback(async (): Promise<void> => {
    const snapshot = new Map(values)
    setValues(new Map())
    try {
      const res = await fetch(manuellPath, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setValues(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
  }, [values, manuellPath])

  return {
    monate,
    gruppen,
    leafKategorieIds,
    values,
    berechneteWerte,
    loading,
    error,
    getManuellerWert,
    getBerechneterWert,
    getEffektiverWert,
    isManuelleOverride,
    upsertZelle,
    resetAll,
    // Drill-down
    einfuhrKatId,
    umsatzsteuerKatId,
    einfuhrProduktIds,
    produktNamen,
    hasUstKomponenten: ustKomponentenMap.size > 0,
    getEinfuhrProduktBer,
    getUstKomponente,
  }
}
