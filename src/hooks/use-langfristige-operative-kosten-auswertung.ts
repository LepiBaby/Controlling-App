'use client'

import { useState, useEffect } from 'react'
import {
  type RaLine,
  type RaBreakdown,
  type RaMonat,
  type RentabilitaetsauswertungResponse,
} from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// PROJ-98: Read-only Operative-Kosten-Auswertung der LANGFRISTIGEN Planung (pro Planversion).
// Schwester der Umsatzauswertung (PROJ-96): zeigt NUR den Operativ-Block der
// Rentabilitätsauswertung (PROJ-95) — die operativen Kosten je L1-Gruppe → L2-Untergruppe
// plus eine Gesamtzeile. Die Werte stammen aus derselben Server-Route wie PROJ-95
// (leichter Modus „?nur=operativ"), damit „Operative Kosten (Gesamt)" bit-identisch zur
// „Operative Kosten"-Zeile der Rentabilitätsauswertung ist. Monat↔Jahr-Bündelung und die
// drei Ansichtsmodi werden vollständig clientseitig gerechnet.

export type OkAnzeigemodus = 'absolut' | 'prozentual' | 'wachstum'
export type OkZeitbasis = 'monat' | 'jahr'

export interface OkColumn { key: string; label: string; sublabel?: string }

export interface OkModel {
  columns: OkColumn[]
  /** Operativ-Zeile der Route: Monatssumme + Gruppe→Untergruppe-Aufschlüsselung (positive Magnitude). */
  operativ: RaLine
  /** Brutto-Umsatz je Spalte (Bezugsgröße für den Prozentual-Modus). */
  brutto: Record<string, number>
  loading: boolean
  error: string | null
  isEmpty: boolean
}

// Kostenzeilen tragen in der Anzeige ein negatives Vorzeichen (rot) — konsistent mit der
// Rentabilitätsauswertung (PROJ-95), wo „Operative Kosten" ein Abzugsposten ist.
const KOSTEN_SIGN = -1

// ─── Kaskaden-Berechnung (clientseitig) ────────────────────────────────────────

export type OkNodeKind = 'gruppe' | 'untergruppe' | 'subtotal'

export interface OkNode {
  id: string
  label: string
  kind: OkNodeKind
  values: Record<string, number>   // signiert (Kosten negativ)
  children?: OkNode[]
}

function breakdownToNodes(items: RaBreakdown[], keys: string[], idPrefix: string): OkNode[] {
  return items.map(b => {
    const id = `${idPrefix}:${b.id}`
    const values = Object.fromEntries(keys.map(k => [k, KOSTEN_SIGN * (b.werte[k] ?? 0)]))
    return { id, label: b.label, kind: 'untergruppe' as const, values }
  })
}

/**
 * Baut die Operativ-Kaskade: je L1-Gruppe ein Knoten (aufklappbar zu seinen Untergruppen),
 * ganz unten eine Gesamt-Zeile „Operative Kosten (Gesamt)". Die Gesamtsumme entspricht der
 * Liniensumme der Route (= bit-identisch zur „Operative Kosten"-Zeile in PROJ-95).
 */
export function computeCascade(operativ: RaLine, columns: OkColumn[]): OkNode[] {
  const keys = columns.map(c => c.key)
  const nodes: OkNode[] = []
  for (const g of operativ.produkte ?? []) {
    const values = Object.fromEntries(keys.map(k => [k, KOSTEN_SIGN * (g.werte[k] ?? 0)]))
    const children = g.children && g.children.length ? breakdownToNodes(g.children, keys, g.id) : undefined
    nodes.push({ id: g.id, label: g.label, kind: 'gruppe', values, children })
  }
  const gesamt = Object.fromEntries(keys.map(k => [k, KOSTEN_SIGN * (operativ.werte[k] ?? 0)]))
  nodes.push({ id: 'operative_kosten_gesamt', label: 'Operative Kosten (Gesamt)', kind: 'subtotal', values: gesamt })
  return nodes
}

/** Alle ausklappbaren Knoten-Ids (L1-Gruppen mit Untergruppen). */
export function collectExpandableIds(nodes: OkNode[]): string[] {
  const ids: string[] = []
  for (const n of nodes) if (n.children && n.children.length > 0) ids.push(n.id)
  return ids
}

/** Nur die L1-Gruppen-Knoten (Datenreihen des gestapelten Diagramms). */
export function gruppenNodes(nodes: OkNode[]): OkNode[] {
  return nodes.filter(n => n.kind === 'gruppe')
}

/** Brutto-Umsatz je Spalte (Bezugsgröße für den Prozentual-Modus). */
export function bruttoByColumn(brutto: Record<string, number>, columns: OkColumn[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of columns) out[c.key] = brutto[c.key] ?? 0
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
export function applyZeitbasis(model: OkModel, zeitbasis: OkZeitbasis): OkModel {
  if (zeitbasis === 'monat' || model.columns.length === 0) return model
  const cols = model.columns
  const yearCols: OkColumn[] = []
  const monthToYear: Record<string, string> = {}
  for (let i = 0; i < cols.length; i += 12) {
    const bucket = cols.slice(i, i + 12)
    const n = Math.floor(i / 12) + 1
    const yk = `J${n}`
    const sub = bucket.length > 1 ? `${bucket[0].label} – ${bucket[bucket.length - 1].label}` : bucket[0].label
    yearCols.push({ key: yk, label: `Jahr ${n}`, sublabel: sub })
    for (const c of bucket) monthToYear[c.key] = yk
  }
  return {
    ...model,
    columns: yearCols,
    operativ: {
      werte: aggregateRecord(model.operativ.werte, monthToYear),
      produkte: aggregateBreakdowns(model.operativ.produkte, monthToYear),
    },
    brutto: aggregateRecord(model.brutto, monthToYear),
  }
}

// ─── Fetch-Hook ─────────────────────────────────────────────────────────────────

const EMPTY_LINE: RaLine = { werte: {}, produkte: [] }

export function useLangfristigeOperativeKostenAuswertung(versionId: string): OkModel {
  const [columns, setColumns] = useState<OkColumn[]>([])
  const [operativ, setOperativ] = useState<RaLine>(EMPTY_LINE)
  const [brutto, setBrutto] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!versionId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // „nur=operativ" zielt auf einen leichten Modus der gemeinsamen Auswertungs-Route
        // (überspringt die schweren GuV-Schritte). Bis der Modus existiert, liefert die Route
        // die vollständige Antwort — wir nutzen nur die Zeilen „operativ" und „brutto_umsatz".
        const r = await fetch(`/api/langfristige-planung/${versionId}/rentabilitaetsauswertung?nur=operativ`)
        if (!r.ok) throw new Error('load failed')
        const data = (await r.json()) as RentabilitaetsauswertungResponse
        if (cancelled) return
        const cols: OkColumn[] = (data.monate as RaMonat[]).map(m => ({ key: m.key, label: m.label }))
        setColumns(cols)
        setOperativ(data.lines?.operativ ?? EMPTY_LINE)
        setBrutto(data.lines?.brutto_umsatz?.werte ?? {})
      } catch {
        if (!cancelled) setError('Fehler beim Laden der Operative-Kosten-Auswertung.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [versionId])

  const hasAnyValue =
    Object.keys(operativ.werte ?? {}).length > 0 || (operativ.produkte ?? []).length > 0
  const isEmpty = !loading && !error && !hasAnyValue

  return { columns, operativ, brutto, loading, error, isEmpty }
}
