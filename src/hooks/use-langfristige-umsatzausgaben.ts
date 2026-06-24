'use client'

import { useState, useEffect, useCallback } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'
import type { PlanungsMonat } from '@/hooks/use-langfristige-absatzplanung'

export type { PlanungsMonat }

// PROJ-91: Versionsgebundene Umsatzausgaben-Planung der Langfristigen Planung.
// Spiegelt die kurzfristige Umsatzausgaben-Seite (PROJ-67) in Kategorie- und
// Berechnungslogik, aber:
//   • Monatsspalten ab Startmonat (kein Vorlauf) über den allgemeinen Horizont.
//   • KEINE Ist-/Vergangenheitsspalten — die Langfristige Planung kennt keine
//     Transaktionen. Jede Spalte ist eine Soll-Spalte (berechnet + manuell).
//   • Alle Einstellungen/Pläne stammen aus DIESER Planversion.
// Gespeichert wird ausschließlich die manuelle Überschreibung je Zelle; ein
// vorhandener Eintrag = manuell = blauer Punkt. Auto-Werte werden nie persistiert.

// ─── Schlüssel-Helfer ─────────────────────────────────────────────────────────

// key: "${kategorieId}:${produktId}:${year}:${month}"
export function wertKey(kategorieId: string, produktId: string, year: number, month: number): string {
  return `${kategorieId}:${produktId}:${year}:${month}`
}

// ─── Monatsfenster (kein Vorlauf — Start exakt im Startmonat) ───────────────────

function monatLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
}

export function buildUmsatzausgabenMonate(
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

interface LangfristigeKategorieRecord {
  id: string
  name: string
  sort_order: number
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
  unassigned_marketing_kat_ids?: string[]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLangfristigeUmsatzausgaben(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [kategorien, setKategorien] = useState<KpiCategory[]>([])
  const [produkte, setProdukte] = useState<KpiCategory[]>([])
  // Marketingkanal-ID → Name (Marketing-Untergruppen sind versionsgebundene Kanäle)
  const [marketingKanalNamen, setMarketingKanalNamen] = useState<Map<string, string>>(new Map())
  const [values, setValues] = useState<Map<string, number>>(new Map())
  const [berechneteWerte, setBerechneteWerte] = useState<Map<string, number>>(new Map())
  // L2-Kategorie-IDs, die berechnete Daten haben (→ Produkte darunter anzeigen)
  const [katIdsWithProducts, setKatIdsWithProducts] = useState<Set<string>>(new Set())
  // Marketingkanal-IDs OHNE Sales-Plattform-Zuordnung (nur diese hier anzeigen)
  const [unassignedMarketingL2Ids, setUnassignedMarketingL2Ids] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const manuellPath = `/api/langfristige-planung/${versionId}/umsatzausgaben`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [grundRes, katRes, prodRes, kanalRes, manualRes, calcRes] = await Promise.all([
          fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
          fetch('/api/kpi-categories?type=ausgaben_kosten'),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_produkt`),
          fetch(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_marketingkanal`),
          fetch(manuellPath),
          fetch(`${manuellPath}/berechnet`),
        ])

        const grund = grundRes.ok ? await grundRes.json() : {}
        const katData: KpiCategory[] = katRes.ok ? await katRes.json() : []
        const prodData: LangfristigeKategorieRecord[] = prodRes.ok ? await prodRes.json() : []
        const kanalData: LangfristigeKategorieRecord[] = kanalRes.ok ? await kanalRes.json() : []
        const manualData: ManuellerEintrag[] = manualRes.ok ? await manualRes.json() : []
        const calcRaw: BerechnetResponse | BerechneterEintrag[] = calcRes.ok
          ? await calcRes.json()
          : { data: [] }
        if (!aktiv) return

        const horizont = grund.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        setMonate(buildUmsatzausgabenMonate(grund.startmonat_monat, grund.startmonat_jahr, horizont))

        setKategorien(Array.isArray(katData) ? katData : [])
        setProdukte(
          prodData
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(toKpiLike),
        )

        const kanalNamen = new Map<string, string>()
        for (const k of kanalData) kanalNamen.set(k.id, k.name)
        setMarketingKanalNamen(kanalNamen)

        const valueMap = new Map<string, number>()
        for (const e of manualData) {
          if (e.betrag_manuell !== null) {
            valueMap.set(wertKey(e.kategorie_id, e.produkt_id, e.jahr, e.monat), e.betrag_manuell)
          }
        }
        setValues(valueMap)

        const calcEntries = Array.isArray(calcRaw) ? calcRaw : (calcRaw.data ?? [])
        const berMap = new Map<string, number>()
        const withProducts = new Set<string>()
        for (const e of calcEntries) {
          berMap.set(wertKey(e.kategorie_id, e.produkt_id, e.jahr, e.monat), e.wert)
          withProducts.add(e.kategorie_id)
        }
        // Auch L2s mit manuellen Werten zeigen Produkte (z.B. Verkaufsgebühren)
        for (const e of manualData) withProducts.add(e.kategorie_id)
        setBerechneteWerte(berMap)
        setKatIdsWithProducts(withProducts)
        setUnassignedMarketingL2Ids(
          new Set<string>(
            (Array.isArray(calcRaw) ? [] : (calcRaw.unassigned_marketing_kat_ids ?? [])) as string[],
          ),
        )

        setLoading(false)
      } catch {
        if (!aktiv) return
        setError('Fehler beim Laden der Umsatzausgaben.')
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

  return {
    monate,
    kategorien,
    produkte,
    marketingKanalNamen,
    values,
    berechneteWerte,
    katIdsWithProducts,
    unassignedMarketingL2Ids,
    loading,
    error,
    getManuellerWert,
    getBerechneterWert,
    isManuelleOverride,
    upsertZelle,
    resetAll,
  }
}

// Bildet einen Versions-Stammdatensatz auf das von der Tabelle erwartete Shape ab.
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
