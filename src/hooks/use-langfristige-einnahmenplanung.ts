'use client'

import { useState, useEffect, useCallback } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'
import type { PlanungsMonat } from '@/hooks/use-langfristige-absatzplanung'

// PROJ-89: Versionsgebundene Einnahmenplanung der Langfristigen Planung.
// Spiegelt die kurzfristige Einnahmenplanung (PROJ-52), aber:
//   • Monatsspalten ab dem Startmonat (KEIN Vorlauf), über den allgemeinen Horizont.
//   • KEINE Ist-Transaktionen → keine Vergangenheits-/Ist-Spalten.
//   • Produktverkäufe werden pro Sales Channel automatisch berechnet (Zahlungszeitpunkt)
//     und NICHT persistiert. Grauer Punkt = berechnet, blauer Punkt = manuell.
//   • Alle anderen Kategorien sind standardmäßig leer und manuell editierbar.
//   • Einnahmen-Kategorien stammen aus dem GLOBALEN KPI-Modell (type=einnahmen);
//     Sales-Plattformen aus dem KPI-Modell DIESER Planversion (art=lp_sales_plattform).
// Gespeichert wird ausschließlich die manuelle Überschreibung je Zelle.

export type { PlanungsMonat }

// key: "${kategorieId}:${year}:${month}"
export function kategorieMonatKey(kategorieId: string, year: number, month: number): string {
  return `${kategorieId}:${year}:${month}`
}

export function istProduktverkaufe(name: string): boolean {
  return name.trim().toLowerCase() === 'produktverkäufe'
}

function monatLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
}

// Monate ab Startmonat (KEIN Vorlauf-Monat) über den allgemeinen Horizont.
function buildEinnahmenMonate(startMonat: number, startJahr: number, horizont: number): PlanungsMonat[] {
  const months: PlanungsMonat[] = []
  let y = startJahr
  let m = startMonat
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

interface EinnahmenPlanungEntry {
  kategorie_id: string
  jahr: number
  monat: number
  betrag_manuell: number | null
}

interface ProduktverkaeufeBerechnetEntry {
  jahr: number
  monat: number
  sales_plattform_id: string
  wert: number
}

interface LangfristigeKategorieRecord {
  id: string
  name: string
  sort_order: number
}

export function useLangfristigeEinnahmenplanung(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [kategorien, setKategorien] = useState<KpiCategory[]>([])
  const [produktverkaeufenKatId, setProduktverkaeufenKatId] = useState<string | null>(null)
  const [plattformen, setPlattformen] = useState<KpiCategory[]>([])
  const [values, setValues] = useState<Map<string, number>>(new Map())
  const [produktverkaeufeSollMap, setProduktverkaeufeSollMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const manuellPath = `/api/langfristige-planung/${versionId}/einnahmen-planung`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [grundRes, katRes, pltRes, manualRes, calcRes] = await Promise.all([
          fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
          fetch('/api/kpi-categories?type=einnahmen'),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_sales_plattform`),
          fetch(manuellPath),
          fetch(`${manuellPath}/produktverkaeufe-berechnet`),
        ])

        const grund = grundRes.ok ? await grundRes.json() : {}
        const katRaw = katRes.ok ? await katRes.json() : []
        const pltRaw: LangfristigeKategorieRecord[] = pltRes.ok ? await pltRes.json() : []
        const manualRaw = manualRes.ok ? await manualRes.json() : []
        const calcRaw: ProduktverkaeufeBerechnetEntry[] = calcRes.ok ? await calcRes.json() : []
        if (!aktiv) return

        const now = new Date()
        const horizont = grund.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        const startMonat = grund.startmonat_monat ?? now.getMonth() + 1
        const startJahr = grund.startmonat_jahr ?? now.getFullYear()
        setMonate(buildEinnahmenMonate(startMonat, startJahr, horizont))

        // Einnahmen-Kategorien (global), inkl. Produktverkäufe.
        const allKats = (Array.isArray(katRaw) ? katRaw : []) as KpiCategory[]
        const pvKat = allKats.find(k => k.level === 1 && istProduktverkaufe(k.name))
        setProduktverkaeufenKatId(pvKat?.id ?? null)
        setKategorien(allKats.filter(k => k.level === 1 || k.level === 2))

        // Sales-Plattformen dieser Version (für die Produktverkäufe-Aufschlüsselung).
        setPlattformen(
          pltRaw
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(toKpiLike),
        )

        // Manuelle Überschreibungen.
        const entries = (Array.isArray(manualRaw) ? manualRaw : (manualRaw?.data ?? [])) as EinnahmenPlanungEntry[]
        const valueMap = new Map<string, number>()
        for (const e of entries) {
          if (e.betrag_manuell !== null) {
            valueMap.set(kategorieMonatKey(e.kategorie_id, e.jahr, e.monat), e.betrag_manuell)
          }
        }
        setValues(valueMap)

        // Berechnete Produktverkäufe je Sales-Plattform × Auszahlungsmonat (nicht persistiert).
        const pvMap = new Map<string, number>()
        for (const e of Array.isArray(calcRaw) ? calcRaw : []) {
          pvMap.set(`${e.jahr}:${e.monat}:${e.sales_plattform_id}`, e.wert)
        }
        setProduktverkaeufeSollMap(pvMap)

        setLoading(false)
      } catch {
        if (!aktiv) return
        setError('Fehler beim Laden der Einnahmenplanung.')
        setLoading(false)
      }
    }

    load()
    return () => {
      aktiv = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId])

  // ─── Wert-Selektoren ───────────────────────────────────────────────────────

  const getWert = useCallback(
    (kategorieId: string, monat: PlanungsMonat): number | null => {
      const v = values.get(kategorieMonatKey(kategorieId, monat.year, monat.month))
      return v !== undefined ? v : null
    },
    [values],
  )

  // Berechneter Produktverkäufe-Wert: je Plattform oder (ohne plattformId) als Summe über alle Plattformen.
  const getProduktverkaeufeSoll = useCallback(
    (monat: PlanungsMonat, plattformId?: string): number | null => {
      if (plattformId) {
        const v = produktverkaeufeSollMap.get(`${monat.year}:${monat.month}:${plattformId}`)
        return v !== undefined ? v : null
      }
      const prefix = `${monat.year}:${monat.month}:`
      let total = 0
      let found = false
      for (const [key, v] of produktverkaeufeSollMap) {
        if (key.startsWith(prefix)) {
          total += v
          found = true
        }
      }
      return found ? total : null
    },
    [produktverkaeufeSollMap],
  )

  const isManuelleOverride = useCallback(
    (kategorieId: string, monat: PlanungsMonat): boolean =>
      values.has(kategorieMonatKey(kategorieId, monat.year, monat.month)),
    [values],
  )

  // ─── Mutationen ────────────────────────────────────────────────────────────

  const upsertZelle = useCallback(
    async (kategorieId: string, monat: PlanungsMonat, value: number | null): Promise<void> => {
      const key = kategorieMonatKey(kategorieId, monat.year, monat.month)
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
    kategorien,
    plattformen,
    produktverkaeufenKatId,
    values,
    produktverkaeufeSollMap,
    loading,
    error,
    getWert,
    getProduktverkaeufeSoll,
    isManuelleOverride,
    upsertZelle,
    resetAll,
  }
}

// Bildet einen Stammdaten-Datensatz auf das von der Tabelle erwartete Minimal-Shape ab.
function toKpiLike(r: LangfristigeKategorieRecord): KpiCategory {
  return {
    id: r.id,
    type: 'sales_plattformen',
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
