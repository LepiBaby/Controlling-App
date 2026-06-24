'use client'

import { useState, useEffect } from 'react'
import {
  type RaLine,
  type RaBreakdown,
  type RaMonat,
  type RentabilitaetsauswertungResponse,
} from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// PROJ-96: Read-only Umsatzauswertung der LANGFRISTIGEN Planung (pro Planversion).
// Schlanke Schwester der Rentabilitätsauswertung (PROJ-95): zeigt NUR den Umsatzblock
// (Brutto-Umsatz → Netto-Umsatz). Die Werte stammen aus derselben Server-Route wie
// PROJ-95 (im leichten „Nur-Umsatz"-Modus), damit sie bit-identisch zur
// Rentabilitätsauswertung sind. Netto-Umsatz wird — wie dort — clientseitig als
// Zwischensumme gebildet. Monat↔Jahr-Bündelung und Ansichtsmodi sind clientseitig.

export type UaAnzeigemodus = 'absolut' | 'prozentual' | 'wachstum'
export type UaZeitbasis = 'monat' | 'jahr'

export interface UaColumn { key: string; label: string; sublabel?: string }

// Die vier Basiszeilen, die die Route liefert (Teilmenge der RA-Zeilen).
export type UaLineId = 'brutto_umsatz' | 'rabatte' | 'rueckerstattungen' | 'umsatzsteuer'
export const UA_LINE_IDS: UaLineId[] = ['brutto_umsatz', 'rabatte', 'rueckerstattungen', 'umsatzsteuer']

export interface UaModel {
  columns: UaColumn[]
  lines: Record<UaLineId, RaLine>
  absatz: { gesamt: Record<string, number>; produkte: RaBreakdown[] }
  loading: boolean
  error: string | null
  isEmpty: boolean
}

// ─── Feste Umsatz-Kaskade ──────────────────────────────────────────────────────

interface UaRowDef {
  id: string
  label: string
  kind: 'leaf' | 'subtotal'
  lineId?: UaLineId
  sign?: -1 | 1        // Beitrag zur Kaskade (Standard: -1 = Abzugsposten)
  isBrutto?: boolean   // Bezugsgröße für den Prozentual-Modus
}

// Reihenfolge = Anzeige-Reihenfolge der Tabelle (von oben nach unten).
export const UA_CASCADE: UaRowDef[] = [
  { id: 'brutto_umsatz', label: 'Brutto-Umsatz', kind: 'leaf', lineId: 'brutto_umsatz', sign: 1, isBrutto: true },
  { id: 'rabatte', label: 'Rabatte', kind: 'leaf', lineId: 'rabatte' },
  { id: 'rueckerstattungen', label: 'Rückerstattungen', kind: 'leaf', lineId: 'rueckerstattungen' },
  { id: 'umsatzsteuer', label: 'Umsatzsteuer', kind: 'leaf', lineId: 'umsatzsteuer' },
  { id: 'netto_umsatz', label: 'Netto-Umsatz', kind: 'subtotal' },
]

// Im Diagramm fest dargestellte Linien (Nutzervorgabe: Brutto-Umsatz + Netto-Umsatz).
export const UA_CHART_LINES: Array<{ id: string; label: string; color: string }> = [
  { id: 'brutto_umsatz', label: 'Brutto-Umsatz', color: 'hsl(142, 71%, 38%)' },
  { id: 'netto_umsatz', label: 'Netto-Umsatz', color: 'hsl(221, 83%, 53%)' },
]

// ─── Kaskaden-Berechnung (clientseitig) ────────────────────────────────────────

export type UaNodeKind = 'leaf' | 'subtotal' | 'produkt'

export interface UaNode {
  id: string
  label: string
  kind: UaNodeKind
  isBrutto?: boolean
  values: Record<string, number>   // signiert (Brutto +, Abzugsposten -)
  children?: UaNode[]
}

// Wandelt die Produkt-Aufschlüsselung einer Zeile in Drill-Down-Knoten um.
function breakdownToNodes(items: RaBreakdown[], sign: number, keys: string[], idPrefix: string): UaNode[] {
  return items.map(b => {
    const id = `${idPrefix}:${b.id}`
    const values = Object.fromEntries(keys.map(k => [k, sign * (b.werte[k] ?? 0)]))
    const kids = b.children && b.children.length ? breakdownToNodes(b.children, sign, keys, id) : undefined
    return { id, label: b.label, kind: 'produkt' as const, values, children: kids }
  })
}

/**
 * Baut die Umsatz-Kaskade als geordnete Knotenliste. Netto-Umsatz ist die kumulierte
 * Summe aller Beitragszeilen darüber (Brutto − Rabatte − Rückerstattungen − Umsatzsteuer).
 */
export function computeCascade(lines: Record<UaLineId, RaLine>, columns: UaColumn[]): UaNode[] {
  const keys = columns.map(c => c.key)
  const nodes: UaNode[] = []
  const cum: Record<string, number> = {}
  for (const k of keys) cum[k] = 0

  for (const def of UA_CASCADE) {
    if (def.kind === 'subtotal') {
      nodes.push({ id: def.id, label: def.label, kind: 'subtotal', values: { ...cum } })
      continue
    }
    const sign = def.sign ?? -1
    const line = lines[def.lineId!]
    const values: Record<string, number> = {}
    for (const k of keys) values[k] = sign * (line?.werte[k] ?? 0)
    const children = breakdownToNodes(line?.produkte ?? [], sign, keys, def.id)
    nodes.push({
      id: def.id, label: def.label, kind: 'leaf', isBrutto: def.isBrutto,
      values, children: children.length ? children : undefined,
    })
    for (const k of keys) cum[k] += values[k]
  }
  return nodes
}

/** Alle ausklappbaren Knoten-Ids (Zeilen mit Produkt-Aufschlüsselung). */
export function collectExpandableIds(nodes: UaNode[]): string[] {
  const ids: string[] = []
  function walk(list: UaNode[]) {
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

/** Bruttoumsatz je Spalte (Bezugsgröße für den Prozentual-Modus). */
export function bruttoByColumn(nodes: UaNode[], columns: UaColumn[]): Record<string, number> {
  const brutto = nodes.find(n => n.isBrutto)
  const out: Record<string, number> = {}
  for (const c of columns) out[c.key] = brutto?.values[c.key] ?? 0
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

/**
 * Verdichtet ein Monats-Modell auf rollierende 12-Monats-Blöcke ab dem Startmonat
 * (KEINE Kalenderjahre). Ist der Horizont kein Vielfaches von 12, bleibt der letzte
 * Block kürzer (Summe der vorhandenen Monate). Bei `zeitbasis === 'monat'` unverändert.
 */
export function applyZeitbasis(model: UaModel, zeitbasis: UaZeitbasis): UaModel {
  if (zeitbasis === 'monat' || model.columns.length === 0) return model
  const cols = model.columns
  const yearCols: UaColumn[] = []
  const monthToYear: Record<string, string> = {}
  for (let i = 0; i < cols.length; i += 12) {
    const bucket = cols.slice(i, i + 12)
    const n = Math.floor(i / 12) + 1
    const yk = `J${n}`
    const sub = bucket.length > 1 ? `${bucket[0].label} – ${bucket[bucket.length - 1].label}` : bucket[0].label
    yearCols.push({ key: yk, label: `Jahr ${n}`, sublabel: sub })
    for (const c of bucket) monthToYear[c.key] = yk
  }
  const lines = {} as Record<UaLineId, RaLine>
  for (const id of UA_LINE_IDS) {
    const l = model.lines[id]
    lines[id] = l
      ? { werte: aggregateRecord(l.werte, monthToYear), produkte: aggregateBreakdowns(l.produkte, monthToYear) }
      : { werte: {}, produkte: [] }
  }
  return {
    ...model,
    columns: yearCols,
    lines,
    absatz: {
      gesamt: aggregateRecord(model.absatz.gesamt, monthToYear),
      produkte: aggregateBreakdowns(model.absatz.produkte, monthToYear),
    },
  }
}

// ─── Fetch-Hook ─────────────────────────────────────────────────────────────────

const EMPTY_LINES = {} as Record<UaLineId, RaLine>

export function useLangfristigeUmsatzauswertung(versionId: string): UaModel {
  const [columns, setColumns] = useState<UaColumn[]>([])
  const [lines, setLines] = useState<Record<UaLineId, RaLine>>(EMPTY_LINES)
  const [absatz, setAbsatz] = useState<UaModel['absatz']>({ gesamt: {}, produkte: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!versionId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // „nur=umsatz" aktiviert den leichten Modus der gemeinsamen Auswertungs-Route
        // (überspringt die schweren GuV-Schritte). Bis der Modus existiert, liefert die
        // Route die vollständige Antwort — die nicht benötigten Zeilen werden ignoriert.
        const r = await fetch(`/api/langfristige-planung/${versionId}/rentabilitaetsauswertung?nur=umsatz`)
        if (!r.ok) throw new Error('load failed')
        const data = (await r.json()) as RentabilitaetsauswertungResponse
        if (cancelled) return
        const cols: UaColumn[] = (data.monate as RaMonat[]).map(m => ({ key: m.key, label: m.label }))
        const nextLines = {} as Record<UaLineId, RaLine>
        for (const id of UA_LINE_IDS) nextLines[id] = data.lines?.[id] ?? { werte: {}, produkte: [] }
        setColumns(cols)
        setLines(nextLines)
        setAbsatz(data.absatz ?? { gesamt: {}, produkte: [] })
      } catch {
        if (!cancelled) setError('Fehler beim Laden der Umsatzauswertung.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [versionId])

  const hasAnyValue =
    Object.values(lines).some(l => Object.keys(l.werte ?? {}).length > 0) ||
    Object.keys(absatz.gesamt ?? {}).length > 0
  const isEmpty = !loading && !error && !hasAnyValue

  return { columns, lines, absatz, loading, error, isEmpty }
}
