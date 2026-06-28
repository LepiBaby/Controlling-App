'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  computeCascade,
  type RaNode,
  type RaColumn,
} from '@/hooks/use-langfristige-rentabilitaetsauswertung'
import type {
  RentabilitaetsauswertungResponse,
  RaLineId,
  RaLine,
} from '@/lib/langfristige-rentabilitaetsauswertung-shared'
import type { ReportingRentabilitaetData, ReportPosition } from '@/hooks/use-reporting-rentabilitaet'

// PROJ-102: Plan-Ist-Vergleich
// Stellt die transaktionsbasierte Rentabilitätsrechnung (Ist, Reporting) der
// plan-basierten Rentabilitätsrechnung (Soll, langfristige Planversion) für genau
// EINEN Monat gegenüber. Es wird nichts neu berechnet — beide bestehenden Quellen
// werden geladen und über Namensgleichheit zur festen GuV-Kaskade zusammengeführt.

export interface PlanVersion {
  id: string
  name: string
}

/** Ein zusammengeführter Vergleichsknoten (Kaskaden-Zeile oder Drill-Down-Unterzeile). */
export interface PivNode {
  id: string
  label: string
  kind: 'zeile' | 'zwischensumme'
  /** Ist-Wert (signiert) oder null, wenn es keine gleichnamige Ist-Position/-Unterzeile gibt. */
  ist: number | null
  /** Soll-Wert (signiert). 0 wenn der Monat außerhalb des Planungsfensters liegt. */
  soll: number | null
  children: PivNode[]
}

export interface PlanIstVergleichModel {
  rows: PivNode[]
  istBrutto: number
  sollBrutto: number
  /** Gewählter Monat liegt außerhalb des Planungshorizonts der Version → Soll = 0. */
  outOfWindow: boolean
  loading: boolean
  istError: string | null
  sollError: string | null
}

// ─── Namens-Normalisierung (für die Zuordnung Ist → Kaskade) ───────────────────

// Synonyme/Schreibvarianten → gemeinsame Kanonform, damit Kaskaden-Zeile und
// gleichbedeutende Reporting-Modell-Position zueinander finden.
const NAME_ALIASES: Record<string, string> = {
  // Deckungsbeitrag-Schreibweisen
  dbi: 'db1', dbii: 'db2', dbiii: 'db3',
  deckungsbeitrag1: 'db1', deckungsbeitrag2: 'db2', deckungsbeitrag3: 'db3',
  deckungsbeitragi: 'db1', deckungsbeitragii: 'db2', deckungsbeitragiii: 'db3',
  // Ergebnis = Überschuss = Jahresüberschuss = Gewinn
  ueberschuss: 'ergebnis', jahresueberschuss: 'ergebnis', gewinn: 'ergebnis',
}

/** Vereinheitlicht einen Namen für den case-insensitiven Abgleich (Umlaute, Leer-/Sonderzeichen, Synonyme). */
export function canonName(s: string): string {
  const n = s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[\s\-_.()]/g, '')
  return NAME_ALIASES[n] ?? n
}

// ─── Roh-Bäume je Seite ────────────────────────────────────────────────────────

interface RawSide {
  id: string
  label: string
  value: number
  children: RawSide[]
}

function sollNodeToRaw(node: RaNode, key: string): RawSide {
  return {
    id: node.id,
    label: node.label,
    value: node.values[key] ?? 0,
    children: (node.children ?? []).map(c => sollNodeToRaw(c, key)),
  }
}

type IstChild = { id: string; name: string; values?: Record<string, number> }
type IstNodeLike = {
  values?: Record<string, number>
} & Partial<Record<string, IstChild[]>>

// Zwischenebenen, die als eigene Zeile angezeigt werden (Kategorie, Gruppe, Untergruppe).
const IST_BRANCH_FIELDS = ['kategorien', 'gruppen', 'untergruppen'] as const
// Produkt-Blatt-Felder, die direkt auf der jeweiligen Ebene erscheinen.
const IST_PRODUCT_FIELDS = ['produkte', 'produkte_pi', 'produkte_wertverlust', 'produkte_manuelle_sendungen', 'ust_produkte'] as const

// Baut den Ist-Drill-Down (Kategorie → Gruppe → Untergruppe → Produkt). Die
// Sales-Plattform-Ebene wird NICHT als eigene Zeile dargestellt: die Produkte einer
// Plattform werden direkt auf die Elternebene hochgezogen und je Produktname aggregiert
// (Nutzerwunsch — wie auf der langfristigen Planungsseite, dort ohne Plattform-Ebene).
function istNodeToRawChildren(node: IstNodeLike, key: string): RawSide[] {
  const out: RawSide[] = []

  for (const field of IST_BRANCH_FIELDS) {
    const arr = node[field]
    if (!Array.isArray(arr)) continue
    for (const child of arr) {
      out.push({
        id: child.id,
        label: child.name,
        value: child.values?.[key] ?? 0,
        children: istNodeToRawChildren(child as unknown as IstNodeLike, key),
      })
    }
  }

  // Sales-Plattformen überspringen → deren Produkte hochziehen und je Name aggregieren.
  const plts = node['sales_plattformen']
  if (Array.isArray(plts)) {
    const prodAcc = new Map<string, RawSide>()
    for (const plt of plts) {
      const prods = (plt as unknown as IstNodeLike)['produkte']
      if (!Array.isArray(prods)) continue
      for (const p of prods) {
        const c = canonName(p.name)
        const cur = prodAcc.get(c)
        const v = p.values?.[key] ?? 0
        if (cur) cur.value += v
        else prodAcc.set(c, { id: p.id, label: p.name, value: v, children: [] })
      }
    }
    for (const p of prodAcc.values()) out.push(p)
  }

  // Direkte Produkt-Blätter auf dieser Ebene.
  for (const field of IST_PRODUCT_FIELDS) {
    const arr = node[field]
    if (!Array.isArray(arr)) continue
    for (const child of arr) {
      out.push({ id: child.id, label: child.name, value: child.values?.[key] ?? 0, children: [] })
    }
  }

  return out
}

// Wie der Rentabilitätsreport: bei genau einer Kategorie die Kategorie-Ebene überspringen.
function istPositionChildren(pos: ReportPosition, key: string): RawSide[] {
  if (pos.kategorien && pos.kategorien.length === 1) {
    return istNodeToRawChildren(pos.kategorien[0] as unknown as IstNodeLike, key)
  }
  return istNodeToRawChildren(pos as unknown as IstNodeLike, key)
}

// ─── Zusammenführung beider Seiten per Namensgleichheit ────────────────────────

function mergeSides(soll: RawSide[], ist: RawSide[], idPrefix: string): PivNode[] {
  const result: PivNode[] = []
  const istByName = new Map<string, RawSide>()
  for (const i of ist) {
    const c = canonName(i.label)
    if (!istByName.has(c)) istByName.set(c, i)
  }
  const usedIst = new Set<string>()

  for (const s of soll) {
    const c = canonName(s.label)
    const match = istByName.get(c)
    if (match) usedIst.add(c)
    const id = `${idPrefix}/s:${s.id}`
    result.push({
      id,
      label: s.label,
      kind: 'zeile',
      soll: s.value,
      ist: match ? match.value : null,
      children: mergeSides(s.children, match ? match.children : [], id),
    })
  }

  for (const i of ist) {
    if (usedIst.has(canonName(i.label))) continue
    const id = `${idPrefix}/i:${i.id}`
    result.push({
      id,
      label: i.label,
      kind: 'zeile',
      soll: null,
      ist: i.value,
      children: mergeSides([], i.children, id),
    })
  }

  return result
}

// ─── Datum-Schlüssel-Konvertierung ─────────────────────────────────────────────

/** "2026-06" → Ist-Periodenschlüssel "2026-06" (gepaddet, wie im Rentabilitätsreport). */
function istPeriodKey(month: string): string {
  return month
}

/** "2026-06" → Soll-Monatsschlüssel "2026-6" (ungepaddet, wie in der langfristigen Auswertung). */
function sollMonthKey(month: string): string {
  const [y, m] = month.split('-')
  return `${y}-${Number(m)}`
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

const EMPTY_LINES = {} as Record<RaLineId, RaLine>

// Soll- und Ist-Quelle sind beide `force-dynamic`-Routen. Werden sie gleichzeitig
// angestoßen, überlastet das im Dev den auf `cpus=1` begrenzten Next-Worker-Pool
// ("Jest worker … exceeding retry limit"). Daher werden alle schweren Requests
// SERIALISIERT (nur einer gleichzeitig) und identische, parallel angeforderte
// Requests dedupliziert (StrictMode feuert Effekte im Dev doppelt).
const inflight = new Map<string, Promise<unknown>>()
let chain: Promise<unknown> = Promise.resolve()

async function fetchJsonOnce<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    let msg = `HTTP ${r.status}`
    try {
      const j = JSON.parse(text)
      if (j?.error) msg = j.error
    } catch {
      const snippet = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      if (snippet) msg = `HTTP ${r.status}: ${snippet}`
    }
    const err = new Error(msg) as Error & { status?: number }
    err.status = r.status
    throw err
  }
  return (await r.json()) as T
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

// Robust gegen transiente Server-/Worker-Fehler (5xx): die schweren dynamischen
// Routen können im Dev (cpus:1, Windows-EPIPE) sporadisch 500 liefern; der Worker
// respawnt aber, sodass ein erneuter Versuch nach kurzer Pause i. d. R. durchläuft.
async function fetchJson<T>(url: string, retries = 2): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchJsonOnce<T>(url)
    } catch (e) {
      lastErr = e
      const status = (e as { status?: number })?.status
      const retryable = status === undefined || status >= 500
      if (!retryable || attempt === retries) break
      await sleep(400 * (attempt + 1))
    }
  }
  throw lastErr
}

function sharedFetchJson<T>(url: string): Promise<T> {
  const existing = inflight.get(url)
  if (existing) return existing as Promise<T>
  // An die globale Kette anhängen → sequentielle Ausführung
  const p = chain.then(() => fetchJson<T>(url))
  chain = p.then(() => undefined, () => undefined)
  inflight.set(url, p)
  p.finally(() => { inflight.delete(url) }).catch(() => {})
  return p
}

export function usePlanIstVergleich() {
  const [versions, setVersions] = useState<PlanVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(true)
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')

  const [sollResp, setSollResp] = useState<RentabilitaetsauswertungResponse | null>(null)
  const [sollLoading, setSollLoading] = useState(false)
  const [sollError, setSollError] = useState<string | null>(null)

  const [istResp, setIstResp] = useState<ReportingRentabilitaetData | null>(null)
  const [istLoading, setIstLoading] = useState(false)
  const [istError, setIstError] = useState<string | null>(null)

  // Versionsliste einmal laden, erste Version vorauswählen
  useEffect(() => {
    let cancelled = false
    fetch('/api/langfristige-planung/planversionen')
      .then(r => (r.ok ? r.json() : []))
      .then((data: PlanVersion[]) => {
        if (cancelled) return
        setVersions(data)
      })
      .catch(() => { if (!cancelled) setVersions([]) })
      .finally(() => { if (!cancelled) setVersionsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Soll: ganze langfristige Rentabilitätsauswertung der Version laden (alle Monate)
  useEffect(() => {
    if (!selectedVersionId) { setSollResp(null); return }
    let cancelled = false
    setSollLoading(true)
    setSollError(null)
    sharedFetchJson<RentabilitaetsauswertungResponse>(`/api/langfristige-planung/${selectedVersionId}/rentabilitaetsauswertung`)
      .then(data => { if (!cancelled) setSollResp(data) })
      .catch(e => { if (!cancelled) { setSollResp(null); setSollError(`Fehler beim Laden der Soll-Werte (Planversion): ${e instanceof Error ? e.message : 'unbekannt'}`) } })
      .finally(() => { if (!cancelled) setSollLoading(false) })
    return () => { cancelled = true }
  }, [selectedVersionId])

  // Ist: Rentabilitätsreport für genau den gewählten Monat laden
  useEffect(() => {
    if (!selectedMonth) { setIstResp(null); return }
    let cancelled = false
    setIstLoading(true)
    setIstError(null)
    const params = new URLSearchParams({ von: selectedMonth, bis: selectedMonth, granularitaet: 'monat' })
    sharedFetchJson<ReportingRentabilitaetData>(`/api/reporting/rentabilitaet?${params}`)
      .then(data => { if (!cancelled) setIstResp(data) })
      .catch(e => { if (!cancelled) { setIstResp(null); setIstError(e instanceof Error ? e.message : 'Fehler beim Laden der Ist-Werte (Reporting).') } })
      .finally(() => { if (!cancelled) setIstLoading(false) })
    return () => { cancelled = true }
  }, [selectedMonth])

  const model: PlanIstVergleichModel = useMemo(() => {
    const istKey = istPeriodKey(selectedMonth)
    const sollKey = sollMonthKey(selectedMonth)

    // Soll-Kaskade (feste GuV-Struktur) aus den Basiswerten der Version berechnen
    const cols: RaColumn[] = (sollResp?.monate ?? []).map(m => ({ key: m.key, label: m.label }))
    const cascade: RaNode[] = sollResp ? computeCascade(sollResp.lines ?? EMPTY_LINES, cols) : []
    const outOfWindow = !!sollResp && !cols.some(c => c.key === sollKey)

    // Ist-Positionen nach Namen indizieren
    const istByName = new Map<string, ReportPosition>()
    for (const pos of istResp?.positionen ?? []) {
      const c = canonName(pos.name)
      if (!istByName.has(c)) istByName.set(c, pos)
    }

    const rows: PivNode[] = cascade.map(node => {
      const isSub = node.kind === 'subtotal'
      const istPos = istByName.get(canonName(node.label))
      const sollVal = outOfWindow ? 0 : (node.values[sollKey] ?? 0)
      const istVal = istPos ? (istPos.values[istKey] ?? 0) : null

      // Drill-Down wie in den Reports (Kategorie → Gruppe → Untergruppe → Produkt),
      // jedoch ohne die Sales-Plattform-Ebene (siehe istNodeToRawChildren).
      const sollChildren = (!isSub && !outOfWindow)
        ? (node.children ?? []).map(c => sollNodeToRaw(c, sollKey))
        : []
      const istChildren = (!isSub && istPos) ? istPositionChildren(istPos, istKey) : []

      return {
        id: node.id,
        label: node.label,
        kind: isSub ? 'zwischensumme' : 'zeile',
        soll: sollVal,
        ist: istVal,
        children: mergeSides(sollChildren, istChildren, node.id),
      }
    })

    const bruttoNode = cascade.find(n => n.isBrutto)
    const sollBrutto = outOfWindow ? 0 : (bruttoNode?.values[sollKey] ?? 0)
    const istBruttoPos = bruttoNode ? istByName.get(canonName(bruttoNode.label)) : undefined
    const istBrutto = istBruttoPos ? (istBruttoPos.values[istKey] ?? 0) : 0

    return {
      rows,
      istBrutto,
      sollBrutto,
      outOfWindow,
      loading: (!!selectedVersionId && sollLoading) || istLoading,
      istError,
      sollError,
    }
  }, [sollResp, istResp, selectedMonth, selectedVersionId, sollLoading, istLoading, istError, sollError])

  const setVersion = useCallback((id: string) => setSelectedVersionId(id), [])
  const setMonth = useCallback((m: string) => setSelectedMonth(m), [])

  return {
    versions,
    versionsLoading,
    selectedVersionId,
    selectedMonth,
    setVersion,
    setMonth,
    model,
  }
}
