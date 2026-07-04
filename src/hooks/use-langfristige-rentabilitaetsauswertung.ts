'use client'

import { useState, useEffect } from 'react'
import {
  RA_LINE_IDS,
  type RaLineId,
  type RaLine,
  type RaMonat,
  type RaBreakdown,
  type RentabilitaetsauswertungResponse,
} from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// PROJ-95: Read-only Rentabilitätsauswertung der LANGFRISTIGEN Planung (pro Planversion).
// Der Hook lädt die Basiswerte (eine Server-Route) und stellt sie bereit. Die feste
// GuV-Kaskade, die Zwischensummen, der „Ohne Investitionen"-Filter und die
// Ansichtsmodi werden clientseitig aus diesen Basiswerten gerechnet (computeCascade).

export type RaAnzeigemodus = 'absolut' | 'prozentual' | 'wachstum'
export type RaZeitbasis = 'monat' | 'jahr'

export interface RaColumn { key: string; label: string; sublabel?: string }

export interface RaModel {
  columns: RaColumn[]
  lines: Record<RaLineId, RaLine>
  absatz: { gesamt: Record<string, number>; produkte: RaBreakdown[] }
  loading: boolean
  error: string | null
  isEmpty: boolean
}

// ─── Feste Kaskaden-Definition ────────────────────────────────────────────────

type RaDefKind = 'leaf' | 'group' | 'subtotal'

export interface RaRowDef {
  id: string
  label: string
  kind: RaDefKind
  lineId?: RaLineId
  childLineIds?: RaLineId[]
  sign?: -1 | 1            // Beitrag zur Kaskade (Standard: -1 = Kosten)
  isBrutto?: boolean       // Bezugsgröße für den Prozentual-Modus
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
export const RA_CASCADE: RaRowDef[] = [
  { id: 'brutto_umsatz', label: 'Brutto-Umsatz', kind: 'leaf', lineId: 'brutto_umsatz', sign: 1, isBrutto: true },
  { id: 'rabatte', label: 'Rabatte', kind: 'leaf', lineId: 'rabatte' },
  { id: 'rueckerstattungen', label: 'Rückerstattungen', kind: 'leaf', lineId: 'rueckerstattungen' },
  { id: 'umsatzsteuer', label: 'Umsatzsteuer', kind: 'leaf', lineId: 'umsatzsteuer' },
  { id: 'netto_umsatz', label: 'Netto-Umsatz', kind: 'subtotal' },
  { id: 'produktkosten', label: 'Produktkosten', kind: 'group', childLineIds: ['ware', 'inspektion', 'shipping', 'zoll', 'einlagerung'] },
  { id: 'db1', label: 'DB I', kind: 'subtotal' },
  { id: 'vertriebskosten', label: 'Vertriebskosten', kind: 'group', childLineIds: ['versand', 'lagerung', 'retouren', 'kulanz', 'verkaufsgebuehren'] },
  { id: 'db2', label: 'DB II', kind: 'subtotal' },
  { id: 'marketing', label: 'Marketingkosten', kind: 'leaf', lineId: 'marketing' },
  { id: 'db3', label: 'DB III', kind: 'subtotal' },
  { id: 'operativ', label: 'Operative Kosten', kind: 'leaf', lineId: 'operativ' },
  { id: 'ebit', label: 'EBIT', kind: 'subtotal' },
  { id: 'finanzierung_zinsen', label: 'Finanzierungskosten', kind: 'leaf', lineId: 'finanzierung_zinsen' },
  { id: 'ebt', label: 'EBT', kind: 'subtotal' },
  { id: 'steuern_ertrag', label: 'Steuern', kind: 'leaf', lineId: 'steuern_ertrag' },
  { id: 'ergebnis', label: 'Ergebnis', kind: 'subtotal' },
]

// Standardmäßig im Diagramm ausgewählte Linien.
export const RA_DEFAULT_CHART_IDS = ['brutto_umsatz', 'netto_umsatz', 'db3', 'ebit', 'ebt', 'ergebnis']

// PROJ-106: Deckungsbeitragsauswertung — dieselbe Kaskade, aber nach DB III abgeschnitten.
// Alle Zeilen unterhalb DB III (Operativ/EBIT/…/Ergebnis) entfallen ersatzlos.
const DB3_END_INDEX = RA_CASCADE.findIndex(r => r.id === 'db3')
export const DB3_CASCADE: RaRowDef[] = RA_CASCADE.slice(0, DB3_END_INDEX + 1)

// Standardlinien für das Diagramm der Deckungsbeitragsauswertung (nur existierende Zeilen).
export const DB3_DEFAULT_CHART_IDS = ['brutto_umsatz', 'netto_umsatz', 'db1', 'db2', 'db3']

// ─── Kaskaden-Berechnung (clientseitig) ───────────────────────────────────────

export type RaNodeKind = 'leaf' | 'group' | 'subtotal' | 'child' | 'produkt'

export interface RaNode {
  id: string
  label: string
  kind: RaNodeKind
  isBrutto?: boolean
  values: Record<string, number>   // signiert (Brutto +, Kosten -)
  children?: RaNode[]
}

function lineSum(lines: Record<RaLineId, RaLine>, ids: RaLineId[], key: string): number {
  let s = 0
  for (const id of ids) s += lines[id]?.werte[key] ?? 0
  return s
}

// Wandelt die (ggf. geschachtelte) Aufschlüsselung einer Zeile in Drill-Down-Knoten um.
function breakdownToNodes(items: RaBreakdown[], sign: number, keys: string[], idPrefix: string): RaNode[] {
  return items.map(b => {
    const id = `${idPrefix}:${b.id}`
    const values = Object.fromEntries(keys.map(k => [k, sign * (b.werte[k] ?? 0)]))
    const kids = b.children && b.children.length ? breakdownToNodes(b.children, sign, keys, id) : undefined
    return { id, label: b.label, kind: 'produkt' as const, values, children: kids }
  })
}

/**
 * Baut die GuV-Kaskade als geordnete Knotenliste. Zwischensummen sind kumulierte
 * Summen aller Beitragszeilen darüber.
 */
export function computeCascade(
  lines: Record<RaLineId, RaLine>,
  columns: RaColumn[],
  cascade: RaRowDef[] = RA_CASCADE,
): RaNode[] {
  const keys = columns.map(c => c.key)
  const nodes: RaNode[] = []
  const cum: Record<string, number> = {}
  for (const k of keys) cum[k] = 0

  for (const def of cascade) {
    if (def.kind === 'subtotal') {
      nodes.push({ id: def.id, label: def.label, kind: 'subtotal', values: { ...cum } })
      continue
    }

    const sign = def.sign ?? -1
    const values: Record<string, number> = {}

    if (def.kind === 'leaf') {
      const line = lines[def.lineId!]
      for (const k of keys) values[k] = sign * (line?.werte[k] ?? 0)
      const children = breakdownToNodes(line?.produkte ?? [], sign, keys, def.id)
      nodes.push({
        id: def.id, label: def.label, kind: 'leaf', isBrutto: def.isBrutto,
        values, children: children.length ? children : undefined,
      })
      for (const k of keys) cum[k] += values[k]
    } else {
      // group
      const childIds = def.childLineIds!
      for (const k of keys) values[k] = sign * lineSum(lines, childIds, k)
      const children: RaNode[] = childIds.map(cid => {
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
export function collectExpandableIds(nodes: RaNode[]): string[] {
  const ids: string[] = []
  function walk(list: RaNode[]) {
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

// ─── Zeitbasis: Monat ↔ rollierendes Jahr (12 Monate ab Startmonat) ────────────

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
 * (KEINE Kalenderjahre). Spalten heißen „Jahr 1/2/…", mit Monatsbereich als Sublabel.
 * Bei `zeitbasis === 'monat'` unverändert.
 */
export function applyZeitbasis(model: RaModel, zeitbasis: RaZeitbasis): RaModel {
  if (zeitbasis === 'monat' || model.columns.length === 0) return model
  const cols = model.columns
  const yearCols: RaColumn[] = []
  const monthToYear: Record<string, string> = {}
  for (let i = 0; i < cols.length; i += 12) {
    const bucket = cols.slice(i, i + 12)
    const n = Math.floor(i / 12) + 1
    const yk = `J${n}`
    const sub = bucket.length > 1 ? `${bucket[0].label} – ${bucket[bucket.length - 1].label}` : bucket[0].label
    yearCols.push({ key: yk, label: `Jahr ${n}`, sublabel: sub })
    for (const c of bucket) monthToYear[c.key] = yk
  }
  const lines = {} as Record<RaLineId, RaLine>
  for (const id of RA_LINE_IDS) {
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

/** Bruttoumsatz je Monat (Bezugsgröße für den Prozentual-Modus). */
export function bruttoByMonth(nodes: RaNode[], columns: RaColumn[]): Record<string, number> {
  const brutto = nodes.find(n => n.isBrutto)
  const out: Record<string, number> = {}
  for (const c of columns) out[c.key] = brutto?.values[c.key] ?? 0
  return out
}

// ─── Produktfilter (clientseitig, nur ausgewählte Produkte) — PROJ-106 ─────────

// Prunt eine (ggf. geschachtelte) Aufschlüsselung auf die ausgewählten Produkte.
// Blätter sind Produkte (bei Marketing: Kanal → Produkt) → Blatt behalten, wenn
// ausgewählt; Elternknoten behalten, wenn er behaltene Kinder hat (Werte = Summe).
function filterBreakdowns(items: RaBreakdown[], selected: Set<string>): RaBreakdown[] {
  const out: RaBreakdown[] = []
  for (const b of items) {
    if (b.children && b.children.length > 0) {
      const kids = filterBreakdowns(b.children, selected)
      if (kids.length === 0) continue
      const werte: Record<string, number> = {}
      for (const k of kids) for (const [mk, v] of Object.entries(k.werte)) werte[mk] = Math.round(((werte[mk] ?? 0) + v) * 100) / 100
      out.push({ id: b.id, label: b.label, werte, children: kids })
    } else if (selected.has(b.id)) {
      out.push(b)
    }
  }
  return out
}

/**
 * Reduziert ein Modell auf die ausgewählten Produkte. Jede produktgranulare Zeile
 * wird aus ihrer (gefilterten) Aufschlüsselung neu summiert; die Absatztabelle ebenso.
 * Leere Auswahl → Modell unverändert (identisch zur ungefilterten Auswertung).
 * Nicht-produktgranulare Zeilen (Operativ/Finanzierung/Steuern) werden auf der
 * Deckungsbeitragsauswertung nicht dargestellt und sind daher irrelevant.
 */
export function applyProduktFilter(model: RaModel, selectedIds: string[]): RaModel {
  if (selectedIds.length === 0) return model
  const selected = new Set(selectedIds)
  const lines = {} as Record<RaLineId, RaLine>
  for (const id of RA_LINE_IDS) {
    const l = model.lines[id]
    if (!l) { lines[id] = { werte: {}, produkte: [] }; continue }
    const produkte = filterBreakdowns(l.produkte, selected)
    const werte: Record<string, number> = {}
    for (const p of produkte) for (const [mk, v] of Object.entries(p.werte)) werte[mk] = Math.round(((werte[mk] ?? 0) + v) * 100) / 100
    lines[id] = { werte, produkte }
  }
  const absatzProdukte = model.absatz.produkte.filter(p => selected.has(p.id))
  const absatzGesamt: Record<string, number> = {}
  for (const p of absatzProdukte) for (const [mk, v] of Object.entries(p.werte)) absatzGesamt[mk] = (absatzGesamt[mk] ?? 0) + v
  return { ...model, lines, absatz: { gesamt: absatzGesamt, produkte: absatzProdukte } }
}

/** Produkte für den Filter (aus der Absatztabelle des Modells, in Produkt-Reihenfolge). */
export function collectProdukte(model: RaModel): { id: string; label: string }[] {
  return model.absatz.produkte.map(p => ({ id: p.id, label: p.label }))
}

// ─── Fetch-Hook ───────────────────────────────────────────────────────────────

const EMPTY_LINES = {} as Record<RaLineId, RaLine>

export function useLangfristigeRentabilitaetsauswertung(versionId: string): RaModel {
  const [columns, setColumns] = useState<RaColumn[]>([])
  const [lines, setLines] = useState<Record<RaLineId, RaLine>>(EMPTY_LINES)
  const [absatz, setAbsatz] = useState<RaModel['absatz']>({ gesamt: {}, produkte: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!versionId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/langfristige-planung/${versionId}/rentabilitaetsauswertung`)
        if (!r.ok) throw new Error('load failed')
        const data = (await r.json()) as RentabilitaetsauswertungResponse
        if (cancelled) return
        const cols: RaColumn[] = (data.monate as RaMonat[]).map(m => ({ key: m.key, label: m.label }))
        setColumns(cols)
        setLines(data.lines ?? EMPTY_LINES)
        setAbsatz(data.absatz ?? { gesamt: {}, produkte: [] })
      } catch {
        if (!cancelled) setError('Fehler beim Laden der Rentabilitätsauswertung.')
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
