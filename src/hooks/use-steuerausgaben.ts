'use client'

import { useState, useEffect, useCallback } from 'react'
import { addWeeks, subWeeks, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'

export type { PlanungsWoche }

// key: "${kategorieId}:${year}:${week}"
export function wertKey(kategorieId: string, year: number, week: number): string {
  return `${kategorieId}:${year}:${week}`
}

function berechneVergangenheitswochen(horizont: number, ref?: Date): PlanungsWoche[] {
  const today = ref ?? new Date()
  const result: PlanungsWoche[] = []
  for (let i = horizont; i >= 1; i--) {
    const d = startOfISOWeek(subWeeks(today, i))
    const week = getISOWeek(d)
    const year = getISOWeekYear(d)
    result.push({ year, week, label: `KW${String(week).padStart(2, '0')} / ${year}` })
  }
  return result
}

function berechneZukunftswochen(horizont: number, ref?: Date): PlanungsWoche[] {
  const today = ref ?? new Date()
  const result: PlanungsWoche[] = []
  for (let i = 0; i < horizont; i++) {
    const d = startOfISOWeek(addWeeks(today, i))
    const week = getISOWeek(d)
    const year = getISOWeekYear(d)
    result.push({ year, week, label: `KW${String(week).padStart(2, '0')} / ${year}` })
  }
  return result
}

interface ManuellerEintrag {
  kategorie_id: string
  kw_year: number
  kw_number: number
  betrag_manuell: number | null
  ist_berechnet: boolean | null
}

interface IstTatsaechlichEintrag {
  kategorie_id: string
  kw_year: number
  kw_number: number
  betrag: number
}

interface BerechneterEintrag {
  kategorie_id: string
  kw_year: number
  kw_number: number
  wert: number
}

interface EinfuhrProduktEintrag {
  produkt_id: string | null
  kw_year: number
  kw_number: number
  wert?: number
  betrag?: number
}

interface UstKomponenteEintrag {
  komponente: 'output' | 'vorsteuer' | 'einfuhr'
  kw_year: number
  kw_number: number
  wert: number
}

export type UstKomponente = 'output' | 'vorsteuer' | 'einfuhr'

const PRODUKT_NONE = '__none__'

// key for product breakdown: "${produktKey}:${year}:${week}"
function produktKey(produktId: string | null): string {
  return produktId ?? PRODUKT_NONE
}

export function useSteuerausgaben(referenceDate?: Date) {
  const [vergangenheitswochen, setVergangenheitswochen] = useState<PlanungsWoche[]>([])
  const [zukunftswochen, setZukunftswochen] = useState<PlanungsWoche[]>([])
  const [kategorien, setKategorien] = useState<KpiCategory[]>([])
  const [values, setValues] = useState<Map<string, number | null>>(new Map())
  const [istTatsaechlichMap, setIstTatsaechlichMap] = useState<Map<string, number>>(new Map())
  const [berechneteWerte, setBerechneteWerte] = useState<Map<string, number>>(new Map())
  // Aufschlüsselungen (Drill-down)
  const [einfuhrProduktBerMap, setEinfuhrProduktBerMap] = useState<Map<string, number>>(new Map())
  const [einfuhrProduktIstMap, setEinfuhrProduktIstMap] = useState<Map<string, number>>(new Map())
  const [ustKomponentenMap, setUstKomponentenMap] = useState<Map<string, number>>(new Map())
  const [produktNamen, setProduktNamen] = useState<Map<string, string>>(new Map())
  const [einfuhrProduktIds, setEinfuhrProduktIds] = useState<string[]>([])
  const [einfuhrKatId, setEinfuhrKatId] = useState<string | null>(null)
  const [umsatzsteuerKatId, setUmsatzsteuerKatId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const grundData = await fetch('/api/grundeinstellungen').then(r =>
          r.ok ? r.json() : {},
        ) as { planungshorizont_wochen?: number; vergangenheitshorizont_wochen?: number } | null

        const planungsHorizont = grundData?.planungshorizont_wochen ?? 13
        const vergangenheitsHorizont = grundData?.vergangenheitshorizont_wochen ?? 4

        const vWochen = berechneVergangenheitswochen(vergangenheitsHorizont, referenceDate)
        const zWochen = berechneZukunftswochen(planungsHorizont, referenceDate)
        setVergangenheitswochen(vWochen)
        setZukunftswochen(zWochen)

        const istParams = vWochen.length > 0
          ? `?von_kw=${vWochen[0].week}&von_jahr=${vWochen[0].year}&bis_kw=${vWochen[vWochen.length - 1].week}&bis_jahr=${vWochen[vWochen.length - 1].year}`
          : null

        // berechnet covers all weeks + erste_zukunftskw so route persists future Soll
        // values with ist_berechnet=true as the Ist-Plan anchor
        const allWochen = [...vWochen, ...zWochen]
        const ersteZukunft = zWochen[0]
        const berParams = allWochen.length > 0
          ? `?von_kw=${allWochen[0].week}&von_jahr=${allWochen[0].year}&bis_kw=${allWochen[allWochen.length - 1].week}&bis_jahr=${allWochen[allWochen.length - 1].year}${ersteZukunft ? `&erste_zukunftskw=${ersteZukunft.week}&erste_zukunftsjahr=${ersteZukunft.year}` : ''}`
          : null

        const [katRaw, istRaw, berRaw, produkteRaw] = await Promise.all([
          fetch('/api/kpi-categories?type=ausgaben_kosten').then(r => r.ok ? r.json() : []),
          istParams
            ? fetch(`/api/steuerausgaben-planung/ist-tatsaechlich${istParams}`).then(r => r.ok ? r.json() : { data: [] })
            : Promise.resolve({ data: [] }),
          berParams
            ? fetch(`/api/steuerausgaben-planung/berechnet${berParams}`).then(r => r.ok ? r.json() : { data: [] })
            : Promise.resolve({ data: [] }),
          fetch('/api/kpi-categories?type=produkte').then(r => r.ok ? r.json() : []),
        ])

        // Load manual values AFTER berechnet persisted future Soll to DB
        const valRaw = await fetch('/api/steuerausgaben-planung').then(r => r.ok ? r.json() : [])

        const allKats = (Array.isArray(katRaw) ? katRaw : []) as KpiCategory[]
        const steuernRoot = allKats.find(k => k.name.trim().toLowerCase() === 'steuern')
        const steuernId = steuernRoot?.id ?? null
        const l1Ids = new Set(
          steuernId
            ? allKats.filter(k => k.parent_id === steuernId).map(k => k.id)
            : [],
        )
        const filtered = allKats.filter(k =>
          (steuernId !== null && k.parent_id === steuernId) ||
          (k.parent_id != null && l1Ids.has(k.parent_id)),
        )
        setKategorien(filtered)

        // Einfuhrumsatzsteuer- und Umsatzsteuer-Kategorien im Steuern-Subtree (für Drill-down)
        const einfuhrCat = filtered.find(k => k.name.trim().toLowerCase() === 'einfuhrumsatzsteuer')
        const ustCat = filtered.find(k => k.name.trim().toLowerCase() === 'umsatzsteuer')
        setEinfuhrKatId(einfuhrCat?.id ?? null)
        setUmsatzsteuerKatId(ustCat?.id ?? null)

        // Produktnamen (für die Einfuhr-Aufschlüsselung je Produkt)
        const produkteKats = (Array.isArray(produkteRaw) ? produkteRaw : []) as KpiCategory[]
        const namenMap = new Map<string, string>()
        for (const p of produkteKats) namenMap.set(p.id, p.name)
        namenMap.set(PRODUKT_NONE, 'Ohne Produktzuordnung')
        setProduktNamen(namenMap)

        const entries = (Array.isArray(valRaw) ? valRaw : (valRaw?.data ?? [])) as ManuellerEintrag[]
        const valueMap = new Map<string, number | null>()
        for (const e of entries) {
          if (e.betrag_manuell !== null) {
            valueMap.set(wertKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag_manuell)
          }
        }

        // Remove future auto-calc entries from valueMap so they show gray (from berechneteWerte).
        // Past auto-calc entries stay → they're the frozen Ist-Plan.
        const futureWeekSet = new Set(zWochen.map(kw => `${kw.year}:${kw.week}`))
        for (const e of entries) {
          if (!futureWeekSet.has(`${e.kw_year}:${e.kw_number}`)) continue
          if (e.ist_berechnet === false) continue  // manually entered → keep as blue
          valueMap.delete(wertKey(e.kategorie_id, e.kw_year, e.kw_number))
        }

        setValues(valueMap)

        const istEntries = (Array.isArray(istRaw) ? istRaw : (istRaw?.data ?? [])) as IstTatsaechlichEintrag[]
        const istMap = new Map<string, number>()
        for (const e of istEntries) {
          istMap.set(wertKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag)
        }
        setIstTatsaechlichMap(istMap)

        const berEntries = (Array.isArray(berRaw) ? berRaw : (berRaw?.data ?? [])) as BerechneterEintrag[]
        const berMap = new Map<string, number>()
        for (const e of berEntries) {
          berMap.set(wertKey(e.kategorie_id, e.kw_year, e.kw_number), e.wert)
        }
        setBerechneteWerte(berMap)

        // ── Aufschlüsselungen (Drill-down) ──────────────────────────────────────
        const produktIdSet = new Set<string>()

        const einfuhrBer = (berRaw?.breakdown?.einfuhr_produkte ?? []) as EinfuhrProduktEintrag[]
        const einfuhrBerMap = new Map<string, number>()
        for (const e of einfuhrBer) {
          const pk = produktKey(e.produkt_id)
          produktIdSet.add(pk)
          einfuhrBerMap.set(wertKey(pk, e.kw_year, e.kw_number), Number(e.wert ?? 0))
        }
        setEinfuhrProduktBerMap(einfuhrBerMap)

        const einfuhrIst = (istRaw?.breakdown?.einfuhr_produkte ?? []) as EinfuhrProduktEintrag[]
        const einfuhrIstMap = new Map<string, number>()
        for (const e of einfuhrIst) {
          const pk = produktKey(e.produkt_id)
          produktIdSet.add(pk)
          einfuhrIstMap.set(wertKey(pk, e.kw_year, e.kw_number), Number(e.betrag ?? 0))
        }
        setEinfuhrProduktIstMap(einfuhrIstMap)

        // Produkt-Reihenfolge: nach Name sortiert, "Ohne Produktzuordnung" ans Ende
        const sortedProduktIds = [...produktIdSet].sort((a, b) => {
          if (a === PRODUKT_NONE) return 1
          if (b === PRODUKT_NONE) return -1
          return (namenMap.get(a) ?? a).localeCompare(namenMap.get(b) ?? b, 'de')
        })
        setEinfuhrProduktIds(sortedProduktIds)

        const ustKomp = (berRaw?.breakdown?.umsatzsteuer_komponenten ?? []) as UstKomponenteEintrag[]
        const ustKompMap = new Map<string, number>()
        for (const e of ustKomp) {
          ustKompMap.set(`${e.komponente}:${e.kw_year}:${e.kw_number}`, Number(e.wert ?? 0))
        }
        setUstKomponentenMap(ustKompMap)
      } catch {
        setError('Fehler beim Laden der Steuerausgaben.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getManuellerWert = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = values.get(wertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [values],
  )

  const getIstTatsaechlich = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = istTatsaechlichMap.get(wertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [istTatsaechlichMap],
  )

  const getBerechneterWert = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null => {
      const v = berechneteWerte.get(wertKey(kategorieId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [berechneteWerte],
  )

  const getEinfuhrProduktIst = useCallback(
    (produktId: string, kw: PlanungsWoche): number | null => {
      const v = einfuhrProduktIstMap.get(wertKey(produktId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [einfuhrProduktIstMap],
  )

  const getEinfuhrProduktBer = useCallback(
    (produktId: string, kw: PlanungsWoche): number | null => {
      const v = einfuhrProduktBerMap.get(wertKey(produktId, kw.year, kw.week))
      return v !== undefined ? v : null
    },
    [einfuhrProduktBerMap],
  )

  const getUstKomponente = useCallback(
    (komponente: UstKomponente, kw: PlanungsWoche): number | null => {
      const v = ustKomponentenMap.get(`${komponente}:${kw.year}:${kw.week}`)
      return v !== undefined ? v : null
    },
    [ustKomponentenMap],
  )

  // For past KW: Ist-Plan = the saved plan from steuerausgaben_planung
  const getIstPlan = useCallback(
    (kategorieId: string, kw: PlanungsWoche): number | null =>
      getManuellerWert(kategorieId, kw),
    [getManuellerWert],
  )

  const upsertZelle = useCallback(
    async (kategorieId: string, kw: PlanungsWoche, value: number | null): Promise<void> => {
      const key = wertKey(kategorieId, kw.year, kw.week)
      const existing = values.get(key)
      setValues(prev => {
        const next = new Map(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      })
      try {
        const res = await fetch('/api/steuerausgaben-planung', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kategorie_id: kategorieId,
            kw_year: kw.year,
            kw_number: kw.week,
            betrag_manuell: value,
          }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setValues(prev => {
          const next = new Map(prev)
          if (existing !== undefined) next.set(key, existing)
          else next.delete(key)
          return next
        })
        throw new Error('Speichern fehlgeschlagen')
      }
    },
    [values],
  )

  const resetAll = useCallback(async (): Promise<void> => {
    const firstFuture = zukunftswochen[0]
    const snapshot = new Map(values)
    setValues(prev => {
      const next = new Map(prev)
      for (const key of next.keys()) {
        const parts = key.split(':')
        const yr = Number(parts[parts.length - 2])
        const wk = Number(parts[parts.length - 1])
        if (!firstFuture || yr > firstFuture.year || (yr === firstFuture.year && wk >= firstFuture.week)) {
          next.delete(key)
        }
      }
      return next
    })
    try {
      const params = firstFuture
        ? `?ab_kw_year=${firstFuture.year}&ab_kw_number=${firstFuture.week}`
        : ''
      const res = await fetch(`/api/steuerausgaben-planung${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setValues(snapshot)
      throw new Error('Zurücksetzen fehlgeschlagen')
    }
    if (vergangenheitswochen.length > 0 || zukunftswochen.length > 0) {
      const allWochen = [...vergangenheitswochen, ...zukunftswochen]
      const ersteZukunft = zukunftswochen[0]
      const berParams = `?von_kw=${allWochen[0].week}&von_jahr=${allWochen[0].year}&bis_kw=${allWochen[allWochen.length - 1].week}&bis_jahr=${allWochen[allWochen.length - 1].year}${ersteZukunft ? `&erste_zukunftskw=${ersteZukunft.week}&erste_zukunftsjahr=${ersteZukunft.year}` : ''}`
      fetch(`/api/steuerausgaben-planung/berechnet${berParams}`)
        .then(r => r.ok ? r.json() : { data: [] })
        .then((raw: unknown) => {
          const r = raw as {
            data?: BerechneterEintrag[]
            breakdown?: {
              einfuhr_produkte?: EinfuhrProduktEintrag[]
              umsatzsteuer_komponenten?: UstKomponenteEintrag[]
            }
          }
          const data = r?.data ?? []
          const berMap = new Map<string, number>()
          for (const e of data) berMap.set(wertKey(e.kategorie_id, e.kw_year, e.kw_number), e.wert)
          setBerechneteWerte(berMap)

          const einfuhrBerMap = new Map<string, number>()
          for (const e of r?.breakdown?.einfuhr_produkte ?? []) {
            einfuhrBerMap.set(wertKey(produktKey(e.produkt_id), e.kw_year, e.kw_number), Number(e.wert ?? 0))
          }
          setEinfuhrProduktBerMap(einfuhrBerMap)

          const ustKompMap = new Map<string, number>()
          for (const e of r?.breakdown?.umsatzsteuer_komponenten ?? []) {
            ustKompMap.set(`${e.komponente}:${e.kw_year}:${e.kw_number}`, Number(e.wert ?? 0))
          }
          setUstKomponentenMap(ustKompMap)
        })
        .catch(() => {})
    }
  }, [values, zukunftswochen, vergangenheitswochen])

  return {
    vergangenheitswochen,
    zukunftswochen,
    kategorien,
    values,
    istTatsaechlichMap,
    berechneteWerte,
    loading,
    error,
    getManuellerWert,
    getIstTatsaechlich,
    getIstPlan,
    getBerechneterWert,
    upsertZelle,
    resetAll,
    // Drill-down
    einfuhrKatId,
    umsatzsteuerKatId,
    einfuhrProduktIds,
    produktNamen,
    hasUstKomponenten: ustKomponentenMap.size > 0,
    getEinfuhrProduktIst,
    getEinfuhrProduktBer,
    getUstKomponente,
  }
}
