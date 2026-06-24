'use client'

import { useState, useEffect } from 'react'
import {
  type RaLine,
  type RaBreakdown,
  type RaMonat,
  type RentabilitaetsauswertungResponse,
} from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// PROJ-97: Read-only Umsatzkosten-Auswertung der LANGFRISTIGEN Planung (pro Planversion).
// Schlanke Schwester der Rentabilitätsauswertung (PROJ-95): zeigt NUR die drei Kostenarten
// Produktkosten, Vertriebskosten und Marketingkosten sowie deren Summe „Umsatzkosten
// (Gesamt)". Die Werte stammen aus derselben Server-Route wie PROJ-95/96, damit sie
// bit-identisch zur Rentabilitätsauswertung sind. Zwischensumme, Monat↔Jahr-Bündelung
// und Ansichtsmodi sind clientseitig. Der Brutto-Umsatz wird nur als unsichtbare
// Bezugsgröße für den Prozentual-Modus mitgeführt (KEINE eigene Zeile).

export type UkAnzeigemodus = 'absolut' | 'prozentual' | 'wachstum'
export type UkZeitbasis = 'monat' | 'jahr'

export interface UkColumn { key: string; label: string; sublabel?: string }

// Die elf Kosten-Basiszeilen, die die Route liefert (Teilmenge der RA-Zeilen).
export type UkLineId =
  | 'ware' | 'inspektion' | 'shipping' | 'zoll' | 'einlagerung'
  | 'versand' | 'lagerung' | 'retouren' | 'kulanz' | 'verkaufsgebuehren'
  | 'marketing'

export const UK_LINE_IDS: UkLineId[] = [
  'ware', 'inspektion', 'shipping', 'zoll', 'einlagerung',
  'versand', 'lagerung', 'retouren', 'kulanz', 'verkaufsgebuehren',
  'marketing',
]

const PRODUKT_CHILDREN: UkLineId[] = ['ware', 'inspektion', 'shipping', 'zoll', 'einlagerung']
const VERTRIEB_CHILDREN: UkLineId[] = ['versand', 'lagerung', 'retouren', 'kulanz', 'verkaufsgebuehren']

export interface UkModel {
  columns: UkColumn[]
  lines: Record<UkLineId, RaLine>
  brutto: RaLine            // Brutto-Umsatz je Spalte — nur Bezugsgröße für Prozentual-Modus
  loading: boolean
  error: string | null
  isEmpty: boolean
}

// ─── Feste Kosten-Kaskade ────────────────────────────────────────────────────────

type UkDefKind = 'leaf' | 'group' | 'subtotal'

interface UkRowDef {
  id: string
  label: string
  kind: UkDefKind
  lineId?: UkLineId
  childLineIds?: UkLineId[]
}

const LINE_LABELS: Record<string, string> = {
  ware: 'Ware',
  inspektion: 'Inspektion',
  shipping: 'Shipping',
  zoll: 'Zoll',
  einlagerung: 'Einlagerung',
  versand: 'Versand',
  lagerung: 'Lagerung',
  retouren: 'Retouren',
  kulanz: 'Ersatzteile / Kulanz',
  verkaufsgebuehren: 'Verkaufsgebühren',
}

// Reihenfolge = Anzeige-Reihenfolge der Tabelle (von oben nach unten).
export const UK_CASCADE: UkRowDef[] = [
  { id: 'produktkosten', label: 'Produktkosten', kind: 'group', childLineIds: PRODUKT_CHILDREN },
  { id: 'vertriebskosten', label: 'Vertriebskosten', kind: 'group', childLineIds: VERTRIEB_CHILDREN },
  { id: 'marketing', label: 'Marketingkosten', kind: 'leaf', lineId: 'marketing' },
  { id: 'umsatzkosten_gesamt', label: 'Umsatzkosten (Gesamt)', kind: 'subtotal' },
]

// Im Diagramm gestapelte Kostenarten (Nutzervorgabe: die drei Bereiche bilden zusammen die Gesamtkosten).
export const UK_CHART_AREAS: Array<{ id: string; label: string; color: string }> = [
  { id: 'produktkosten', label: 'Produktkosten', color: 'hsl(221, 83%, 53%)' },
  { id: 'vertriebskosten', label: 'Vertriebskosten', color: 'hsl(38, 92%, 50%)' },
  { id: 'marketing', label: 'Marketingkosten', color: 'hsl(280, 65%, 60%)' },
]

// ─── Kaskaden-Berechnung (clientseitig) ────────────────────────────────────────

export type UkNodeKind = 'leaf' | 'group' | 'subtotal' | 'child' | 'produkt'

export interface UkNode {
  id: string
  label: string
  kind: UkNodeKind
  values: Record<string, number>   // signiert (Kosten -, Summe -)
  children?: UkNode[]
}

function lineSum(lines: Record<UkLineId, RaLine>, ids: UkLineId[], key: string): number {
  let s = 0
  for (const id of ids) s += lines[id]?.werte[key] ?? 0
  return s
}

// Wandelt die (ggf. geschachtelte) Aufschlüsselung einer Zeile in Drill-Down-Knoten um.
function breakdownToNodes(items: RaBreakdown[], sign: number, keys: string[], idPrefix: string): UkNode[] {
  return items.map(b => {
    const id = `${idPrefix}:${b.id}`
    const values = Object.fromEntries(keys.map(k => [k, sign * (b.werte[k] ?? 0)]))
    const kids = b.children && b.children.length ? breakdownToNodes(b.children, sign, keys, id) : undefined
    return { id, label: b.label, kind: 'produkt' as const, values, children: kids }
  })
}

/**
 * Baut die Kosten-Kaskade als geordnete Knotenliste. „Umsatzkosten (Gesamt)" ist die
 * kumulierte Summe der drei Kostenarten (alle als Abzug, Vorzeichen -1).
 */
export function computeCascade(lines: Record<UkLineId, RaLine>, columns: UkColumn[]): UkNode[] {
  const keys = columns.map(c => c.key)
  const nodes: UkNode[] = []
  const cum: Record<string, number> = {}
  for (const k of keys) cum[k] = 0

  const sign = -1
  for (const def of UK_CASCADE) {
    if (def.kind === 'subtotal') {
      nodes.push({ id: def.id, label: def.label, kind: 'subtotal', values: { ...cum } })
      continue
    }

    const values: Record<string, number> = {}

    if (def.kind === 'leaf') {
      const line = lines[def.lineId!]
      for (const k of keys) values[k] = sign * (line?.werte[k] ?? 0)
      const children = breakdownToNodes(line?.produkte ?? [], sign, keys, def.id)
      nodes.push({ id: def.id, label: def.label, kind: 'leaf', values, children: children.length ? children : undefined })
      for (const k of keys) cum[k] += values[k]
    } else {
      // group
      const childIds = def.childLineIds!
      for (const k of keys) values[k] = sign * lineSum(lines, childIds, k)
      const children: UkNode[] = childIds.map(cid => {
        const line = lines[cid]
        const cvals = Object.fromEntries(keys.map(k => [k, sign * (line?.werte[k] ?? 0)]))
        const prod = breakdownToNodes(line?.produkte ?? [], sign, keys, cid)
        return { id: cid, label: LINE_LABELS[cid] ?? cid, kind: 'child' as const, values: cvals, children: prod.length ? prod : undefined }
      })
      nodes.push({ id: def.id, label: def.label, kind: 'group', values, children })
      for (const k of keys) cum[k] += values[k]
    }
  }

  return nodes
}

/** Alle ausklappbaren Knoten-Ids (Gruppen + Blätter/Kinder mit Aufschlüsselung). */
export function collectExpandableIds(nodes: UkNode[]): string[] {
  const ids: string[] = []
  function walk(list: UkNode[]) {
    for (const n of list) {
      if (n.children && n.children.length > 0) {
        ids.push(n.id)
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return ids
}

/** Bruttoumsatz je Spalte (unsichtbare Bezugsgröße für den Prozentual-Modus). */
export function bruttoByColumn(model: UkModel, columns: UkColumn[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of columns) out[c.key] = model.brutto?.werte[c.key] ?? 0
  return out
}

// ─── Zeitbasis: Monat ↔ rollierendes Jahr (12 Monate ab Startmonat) ─────────────

function aggregateRecord(werte: Record<string, number>, monthToYear: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [mk, v] of Object.entries(werte)) {
    const yk = monthToYear[mk]
    if (yk === undefined) continue
    out[yk] = (out[yk] ?? 0) + v
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100
  return out
}

function aggregateBreakdowns(items: RaBreakdown[], monthToYear: Record<string, string>): RaBreakdown[] {
  return items.map(b => (
    b.children
      ? { id: b.id, label: b.label, werte: aggregateRecord(b.werte, monthToYear), children: aggregateBreakdowns(b.children, monthToYear) }
      : { id: b.id, label: b.label, werte: aggregateRecord(b.werte, monthToYear) }
  ))
}

function aggregateLine(l: RaLine | undefined, monthToYear: Record<string, string>): RaLine {
  return l
    ? { werte: aggregateRecord(l.werte, monthToYear), produkte: aggregateBreakdowns(l.produkte, monthToYear) }
    : { werte: {}, produkte: [] }
}

/**
 * Verdichtet ein Monats-Modell auf rollierende 12-Monats-Blöcke ab dem Startmonat
 * (KEINE Kalenderjahre). Ist der Horizont kein Vielfaches von 12, bleibt der letzte
 * Block kürzer (Summe der vorhandenen Monate). Bei `zeitbasis === 'monat'` unverändert.
 */
export function applyZeitbasis(model: UkModel, zeitbasis: UkZeitbasis): UkModel {
  if (zeitbasis === 'monat' || model.columns.length === 0) return model
  const cols = model.columns
  const yearCols: UkColumn[] = []
  const monthToYear: Record<string, string> = {}
  for (let i = 0; i < cols.length; i += 12) {
    const bucket = cols.slice(i, i + 12)
    const n = Math.floor(i / 12) + 1
    const yk = `J${n}`
    const sub = bucket.length > 1 ? `${bucket[0].label} – ${bucket[bucket.length - 1].label}` : bucket[0].label
    yearCols.push({ key: yk, label: `Jahr ${n}`, sublabel: sub })
    for (const c of bucket) monthToYear[c.key] = yk
  }
  const lines = {} as Record<UkLineId, RaLine>
  for (const id of UK_LINE_IDS) lines[id] = aggregateLine(model.lines[id], monthToYear)
  return {
    ...model,
    columns: yearCols,
    lines,
    brutto: aggregateLine(model.brutto, monthToYear),
  }
}

// ─── Fetch-Hook ─────────────────────────────────────────────────────────────────

const EMPTY_LINE: RaLine = { werte: {}, produkte: [] }
function emptyLines(): Record<UkLineId, RaLine> {
  const o = {} as Record<UkLineId, RaLine>
  for (const id of UK_LINE_IDS) o[id] = { werte: {}, produkte: [] }
  return o
}

export function useLangfristigeUmsatzkostenAuswertung(versionId: string): UkModel {
  const [columns, setColumns] = useState<UkColumn[]>([])
  const [lines, setLines] = useState<Record<UkLineId, RaLine>>(emptyLines)
  const [brutto, setBrutto] = useState<RaLine>(EMPTY_LINE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!versionId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Dieselbe Route wie PROJ-95/96 — sie liefert alle Kostenzeilen und den
        // Brutto-Umsatz bereits fertig. Wir picken nur die benötigten Zeilen heraus.
        const r = await fetch(`/api/langfristige-planung/${versionId}/rentabilitaetsauswertung`)
        if (!r.ok) throw new Error('load failed')
        const data = (await r.json()) as RentabilitaetsauswertungResponse
        if (cancelled) return
        const cols: UkColumn[] = (data.monate as RaMonat[]).map(m => ({ key: m.key, label: m.label }))
        const nextLines = {} as Record<UkLineId, RaLine>
        for (const id of UK_LINE_IDS) nextLines[id] = data.lines?.[id] ?? { werte: {}, produkte: [] }
        setColumns(cols)
        setLines(nextLines)
        setBrutto(data.lines?.brutto_umsatz ?? EMPTY_LINE)
      } catch {
        if (!cancelled) setError('Fehler beim Laden der Umsatzkosten-Auswertung.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [versionId])

  const hasAnyValue =
    Object.values(lines).some(l => Object.keys(l.werte ?? {}).length > 0) ||
    Object.keys(brutto.werte ?? {}).length > 0
  const isEmpty = !loading && !error && !hasAnyValue

  return { columns, lines, brutto, loading, error, isEmpty }
}
