'use client'

import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'
import type { PlanungsMonat } from '@/hooks/use-langfristige-absatzplanung'

export type { PlanungsMonat }

// PROJ-92: Versionsgebundene Investitionsausgaben-Planung der Langfristigen Planung.
// Schwester von PROJ-91 (Umsatzausgaben), aber:
//   • Zeilenquelle = Investitionen-KPI-Modell DIESER Version (lp_investition):
//     Übergruppe (Ebene 1) → Untergruppe (Ebene 2) → Produkt (Leaf).
//   • Auto-berechnet wird NUR "Produktinvestitionen Einkauf" (aus Erstbestellungen +
//     deren Bestellkosten, nach Zahlungszeitpunkt). Alle anderen Kategorien sind rein
//     manuell. Unter JEDER Untergruppe erscheinen immer alle Produkte (alle pflegbar).
//   • Monatsspalten ab Startmonat (kein Vorlauf) über den allgemeinen Horizont; keine
//     Ist-/Vergangenheitsspalten (die Langfristige Planung kennt keine Transaktionen).
// Gespeichert wird ausschließlich die manuelle Überschreibung je Zelle; ein
// vorhandener Eintrag = manuell = blauer Punkt. Auto-Werte werden nie persistiert.

// ─── Schlüssel-Helfer ─────────────────────────────────────────────────────────

// key: "${kategorieId}:${produktId}:${year}:${month}"  (kategorieId = L2-Untergruppe)
export function wertKey(kategorieId: string, produktId: string, year: number, month: number): string {
  return `${kategorieId}:${produktId}:${year}:${month}`
}

// ─── Monatsfenster (kein Vorlauf — Start exakt im Startmonat) ───────────────────

function monatLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
}

export function buildInvestitionsausgabenMonate(
  startMonat: number | undefined,
  startJahr: number | undefined,
  horizont: number,
): PlanungsMonat[] {
  const now = new Date()
  let m = startMonat ?? now.getMonth() + 1
  let y = startJahr ?? now.getFullYear()
  const months: PlanungsMonat[] = []
  for (let i = 0; i < horizont; i++) {
    months.push({ year: y, month: m, label: monatLabel(y, m) })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return months
}

// ─── Typen ──────────────────────────────────────────────────────────────────

// Eine Investitions-Kategorie der Version (Übergruppe oder Untergruppe).
export interface InvestKategorie {
  id: string
  name: string
  parent_id: string | null
  level: number
  sort_order: number
}

// Ein Produkt der Version (Leaf-Dimension).
export interface InvestProdukt {
  id: string
  name: string
  sort_order: number
  // PROJ-105: true = im KPI-Modell als Investition markiert → standardmäßig als Zeile sichtbar.
  ist_investition: boolean
}

interface KategorieRecord {
  id: string
  name: string
  parent_id: string | null
  level: number
  sort_order: number
  ist_investition?: boolean
}

// PROJ-105: manuell hinzugefügte Produktzeile je (Untergruppe, Produkt).
interface ProduktzeileEintrag {
  kategorie_id: string
  produkt_id: string
}

interface ManuellerEintrag {
  kategorie_id: string
  produkt_id: string
  jahr: number
  monat: number
  betrag_manuell: number | null
}

interface BerechneterEintrag {
  kategorie_id: string
  produkt_id: string
  jahr: number
  monat: number
  wert: number
}

interface BerechnetResponse {
  data?: BerechneterEintrag[]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLangfristigeInvestitionsausgaben(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [kategorien, setKategorien] = useState<InvestKategorie[]>([])
  const [produkte, setProdukte] = useState<InvestProdukt[]>([])
  const [values, setValues] = useState<Map<string, number>>(new Map())
  const [berechneteWerte, setBerechneteWerte] = useState<Map<string, number>>(new Map())
  // PROJ-105: manuell ergänzte Produktzeilen je Untergruppe (kategorieId → Set<produktId>).
  const [extraProduktzeilen, setExtraProduktzeilen] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const manuellPath = `/api/langfristige-planung/${versionId}/investitionsausgaben-planung`
  const produktzeilenPath = `${manuellPath}/produktzeilen`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [grundRes, katRes, prodRes, manualRes, calcRes, zeilenRes] = await Promise.all([
          fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_investition`),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_produkt`),
          fetch(manuellPath),
          fetch(`${manuellPath}/berechnet`),
          fetch(produktzeilenPath),
        ])

        const grund = grundRes.ok ? await grundRes.json() : {}
        const katData: KategorieRecord[] = katRes.ok ? await katRes.json() : []
        const prodData: KategorieRecord[] = prodRes.ok ? await prodRes.json() : []
        const manualData: ManuellerEintrag[] = manualRes.ok ? await manualRes.json() : []
        const calcRaw: BerechnetResponse | BerechneterEintrag[] = calcRes.ok
          ? await calcRes.json()
          : { data: [] }
        const zeilenData: ProduktzeileEintrag[] = zeilenRes.ok ? await zeilenRes.json() : []
        if (!aktiv) return

        const horizont = grund.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        setMonate(buildInvestitionsausgabenMonate(grund.startmonat_monat, grund.startmonat_jahr, horizont))

        setKategorien(
          (Array.isArray(katData) ? katData : [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(k => ({
              id: k.id,
              name: k.name,
              parent_id: k.parent_id,
              level: k.level,
              sort_order: k.sort_order,
            })),
        )

        setProdukte(
          (Array.isArray(prodData) ? prodData : [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(p => ({ id: p.id, name: p.name, sort_order: p.sort_order, ist_investition: p.ist_investition ?? false })),
        )

        const zeilenMap = new Map<string, Set<string>>()
        for (const z of Array.isArray(zeilenData) ? zeilenData : []) {
          if (!zeilenMap.has(z.kategorie_id)) zeilenMap.set(z.kategorie_id, new Set())
          zeilenMap.get(z.kategorie_id)!.add(z.produkt_id)
        }
        setExtraProduktzeilen(zeilenMap)

        const valueMap = new Map<string, number>()
        for (const e of manualData) {
          if (e.betrag_manuell !== null) {
            valueMap.set(wertKey(e.kategorie_id, e.produkt_id, e.jahr, e.monat), e.betrag_manuell)
          }
        }
        setValues(valueMap)

        const calcEntries = Array.isArray(calcRaw) ? calcRaw : (calcRaw.data ?? [])
        const berMap = new Map<string, number>()
        for (const e of calcEntries) {
          berMap.set(wertKey(e.kategorie_id, e.produkt_id, e.jahr, e.monat), e.wert)
        }
        setBerechneteWerte(berMap)

        setLoading(false)
      } catch {
        if (!aktiv) return
        setError('Fehler beim Laden der Investitionsausgaben.')
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
    (kategorieId: string, produktId: string, monat: PlanungsMonat): number | null => {
      const v = values.get(wertKey(kategorieId, produktId, monat.year, monat.month))
      return v !== undefined ? v : null
    },
    [values],
  )

  const getBerechneterWert = useCallback(
    (kategorieId: string, produktId: string, monat: PlanungsMonat): number | null => {
      const v = berechneteWerte.get(wertKey(kategorieId, produktId, monat.year, monat.month))
      return v !== undefined ? v : null
    },
    [berechneteWerte],
  )

  const isManuelleOverride = useCallback(
    (kategorieId: string, produktId: string, monat: PlanungsMonat): boolean =>
      values.has(wertKey(kategorieId, produktId, monat.year, monat.month)),
    [values],
  )

  // ─── Mutationen ─────────────────────────────────────────────────────────────

  const upsertZelle = useCallback(
    async (kategorieId: string, produktId: string, monat: PlanungsMonat, value: number | null): Promise<void> => {
      const key = wertKey(kategorieId, produktId, monat.year, monat.month)
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
            produkt_id: produktId,
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

  // ─── Produktzeilen je Untergruppe (PROJ-105) ────────────────────────────────

  // Angezeigte Produkte einer Untergruppe: als Investition markierte Produkte plus
  // die für DIESE Untergruppe manuell ergänzten. Reihenfolge = produkte (sort_order).
  const getUntergruppeProdukte = useCallback(
    (kategorieId: string): InvestProdukt[] => {
      const extra = extraProduktzeilen.get(kategorieId)
      return produkte.filter(p => p.ist_investition || (extra?.has(p.id) ?? false))
    },
    [produkte, extraProduktzeilen],
  )

  // Produkte, die in dieser Untergruppe noch NICHT als Zeile erscheinen (für den Picker).
  const getAddbareProdukte = useCallback(
    (kategorieId: string): InvestProdukt[] => {
      const extra = extraProduktzeilen.get(kategorieId)
      return produkte.filter(p => !p.ist_investition && !(extra?.has(p.id) ?? false))
    },
    [produkte, extraProduktzeilen],
  )

  // Entfernbar ist eine Zeile nur, wenn sie manuell ergänzt und NICHT (auch) als
  // Investition markiert ist (markierte erscheinen ohnehin in jeder Untergruppe).
  const isEntfernbareZeile = useCallback(
    (kategorieId: string, produktId: string): boolean => {
      const extra = extraProduktzeilen.get(kategorieId)
      if (!extra?.has(produktId)) return false
      const prod = produkte.find(p => p.id === produktId)
      return prod ? !prod.ist_investition : true
    },
    [produkte, extraProduktzeilen],
  )

  const addProduktzeile = useCallback(
    async (kategorieId: string, produktId: string): Promise<void> => {
      setExtraProduktzeilen(prev => {
        const next = new Map(prev)
        const set = new Set(next.get(kategorieId) ?? [])
        set.add(produktId)
        next.set(kategorieId, set)
        return next
      })
      try {
        const res = await fetch(produktzeilenPath, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kategorie_id: kategorieId, produkt_id: produktId }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setExtraProduktzeilen(prev => {
          const next = new Map(prev)
          const set = new Set(next.get(kategorieId) ?? [])
          set.delete(produktId)
          if (set.size === 0) next.delete(kategorieId)
          else next.set(kategorieId, set)
          return next
        })
        throw new Error('Produkt konnte nicht hinzugefügt werden.')
      }
    },
    [produktzeilenPath],
  )

  const removeProduktzeile = useCallback(
    async (kategorieId: string, produktId: string): Promise<void> => {
      const wasPresent = extraProduktzeilen.get(kategorieId)?.has(produktId) ?? false
      setExtraProduktzeilen(prev => {
        const next = new Map(prev)
        const set = new Set(next.get(kategorieId) ?? [])
        set.delete(produktId)
        if (set.size === 0) next.delete(kategorieId)
        else next.set(kategorieId, set)
        return next
      })
      try {
        const res = await fetch(produktzeilenPath, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kategorie_id: kategorieId, produkt_id: produktId }),
        })
        if (!res.ok) throw new Error()
      } catch {
        if (wasPresent) {
          setExtraProduktzeilen(prev => {
            const next = new Map(prev)
            const set = new Set(next.get(kategorieId) ?? [])
            set.add(produktId)
            next.set(kategorieId, set)
            return next
          })
        }
        throw new Error('Produkt konnte nicht entfernt werden.')
      }
    },
    [produktzeilenPath, extraProduktzeilen],
  )

  return {
    monate,
    kategorien,
    produkte,
    values,
    berechneteWerte,
    loading,
    error,
    getManuellerWert,
    getBerechneterWert,
    isManuelleOverride,
    upsertZelle,
    resetAll,
    getUntergruppeProdukte,
    getAddbareProdukte,
    isEntfernbareZeile,
    addProduktzeile,
    removeProduktzeile,
  }
}
