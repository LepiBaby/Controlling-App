'use client'

import { useState, useEffect } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'
import {
  type RaLine,
  type RaBreakdown,
  type RentabilitaetsauswertungResponse,
} from '@/lib/langfristige-rentabilitaetsauswertung-shared'

// PROJ-100: Read-only Finanzierungsausgaben-Auswertung der LANGFRISTIGEN Planung (pro Planversion).
// Schwester der Operative-Kosten-Auswertung (PROJ-98): zeigt NUR die Finanzierungsausgaben
// dieser Version — alle L1-Gruppen → L2-Untergruppen des globalen „Finanzierung"-Subtrees plus
// eine Gesamtzeile.
//
// WICHTIGER Unterschied zu PROJ-98: Die Werte stammen NICHT aus der Rentabilitätsauswertungs-
// Route (dort erscheint Finanzierung nur als „nur Zinsen" + brutto→netto), sondern DIREKT aus
// der Planungsseite PROJ-90 — exakt so, wie die Planungsseite selbst lädt (gespeicherte Roh-
// Werte + globaler „Finanzierung"-Subtree + Startmonat/Horizont). Damit ist „Finanzierungs-
// ausgaben (Gesamt)" bit-identisch zur Gesamtzeile der Finanzierungsausgaben Planung (PROJ-90).
// Der Brutto-Umsatz (Bezugsgröße des Prozentual-Modus) wird wie bei PROJ-96/98 aus dem leichten
// Modus „?nur=umsatz" der Rentabilitätsauswertungs-Route mitgenommen. Monat↔Jahr-Bündelung und
// die drei Ansichtsmodi werden vollständig clientseitig gerechnet.

export type FaAnzeigemodus = 'absolut' | 'prozentual' | 'wachstum'
export type FaZeitbasis = 'monat' | 'jahr'

export interface FaColumn { key: string; label: string; sublabel?: string }

export interface FaModel {
  columns: FaColumn[]
  /** Finanzierungs-Zeile: Monatssumme + Gruppe→Untergruppe-Aufschlüsselung (positive Magnitude). */
  finanzierung: RaLine
  /** Brutto-Umsatz je Spalte (Bezugsgröße für den Prozentual-Modus). */
  brutto: Record<string, number>
  loading: boolean
  error: string | null
  isEmpty: boolean
}

// Kostenzeilen tragen in der Anzeige ein negatives Vorzeichen (rot) — konsistent mit der
// Operative-Kosten-Auswertung (PROJ-98), wo Kosten ein Abzugsposten sind.
const KOSTEN_SIGN = -1

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// ─── Kaskaden-Berechnung (clientseitig) ────────────────────────────────────────

export type FaNodeKind = 'gruppe' | 'untergruppe' | 'subtotal'

export interface FaNode {
  id: string
  label: string
  kind: FaNodeKind
  values: Record<string, number>   // signiert (Kosten negativ)
  children?: FaNode[]
}

function breakdownToNodes(items: RaBreakdown[], keys: string[], idPrefix: string): FaNode[] {
  return items.map(b => {
    const id = `${idPrefix}:${b.id}`
    const values = Object.fromEntries(keys.map(k => [k, KOSTEN_SIGN * (b.werte[k] ?? 0)]))
    return { id, label: b.label, kind: 'untergruppe' as const, values }
  })
}

/**
 * Baut die Finanzierungs-Kaskade: je L1-Gruppe ein Knoten (aufklappbar zu seinen Untergruppen),
 * ganz unten eine Gesamt-Zeile „Finanzierungsausgaben (Gesamt)". Die Gesamtsumme entspricht der
 * Liniensumme (= bit-identisch zur Gesamtzeile der Finanzierungsausgaben Planung in PROJ-90).
 */
export function computeCascade(finanzierung: RaLine, columns: FaColumn[]): FaNode[] {
  const keys = columns.map(c => c.key)
  const nodes: FaNode[] = []
  for (const g of finanzierung.produkte ?? []) {
    const values = Object.fromEntries(keys.map(k => [k, KOSTEN_SIGN * (g.werte[k] ?? 0)]))
    const children = g.children && g.children.length ? breakdownToNodes(g.children, keys, g.id) : undefined
    nodes.push({ id: g.id, label: g.label, kind: 'gruppe', values, children })
  }
  const gesamt = Object.fromEntries(keys.map(k => [k, KOSTEN_SIGN * (finanzierung.werte[k] ?? 0)]))
  nodes.push({ id: 'finanzierungsausgaben_gesamt', label: 'Finanzierungsausgaben (Gesamt)', kind: 'subtotal', values: gesamt })
  return nodes
}

/** Alle ausklappbaren Knoten-Ids (L1-Gruppen mit Untergruppen). */
export function collectExpandableIds(nodes: FaNode[]): string[] {
  const ids: string[] = []
  for (const n of nodes) if (n.children && n.children.length > 0) ids.push(n.id)
  return ids
}

/** Nur die L1-Gruppen-Knoten (Datenreihen des gestapelten Diagramms). */
export function gruppenNodes(nodes: FaNode[]): FaNode[] {
  return nodes.filter(n => n.kind === 'gruppe')
}

/** Brutto-Umsatz je Spalte (Bezugsgröße für den Prozentual-Modus). */
export function bruttoByColumn(brutto: Record<string, number>, columns: FaColumn[]): Record<string, number> {
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
export function applyZeitbasis(model: FaModel, zeitbasis: FaZeitbasis): FaModel {
  if (zeitbasis === 'monat' || model.columns.length === 0) return model
  const cols = model.columns
  const yearCols: FaColumn[] = []
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
    finanzierung: {
      werte: aggregateRecord(model.finanzierung.werte, monthToYear),
      produkte: aggregateBreakdowns(model.finanzierung.produkte, monthToYear),
    },
    brutto: aggregateRecord(model.brutto, monthToYear),
  }
}

// ─── Aufbau der Finanzierungs-Zeile aus den PROJ-90-Rohdaten ─────────────────────

export function buildColumns(startMonat: number, startJahr: number, horizont: number): FaColumn[] {
  const total = Math.max(1, horizont)
  let y = startJahr
  let m = startMonat
  const cols: FaColumn[] = []
  for (let i = 0; i < total; i++) {
    cols.push({ key: `${y}-${m}`, label: `${MONTH_LABELS[m - 1]} ${y}` })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return cols
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Baut aus dem globalen „Finanzierung"-Subtree (L1-Gruppen + L2-Untergruppen) und den
 * gespeicherten Roh-Werten (PROJ-90) eine RaLine-Struktur (positive Magnituden):
 * - je L1-Gruppe ein `produkte`-Eintrag; bei Untergruppen `children` + Summe als Gruppenwert,
 *   sonst eigener Wert (Gruppe = Leaf).
 * - `werte` der RaLine = Summe aller Gruppen je Monat (= Gesamtzeile).
 */
export function buildFinanzierungLine(
  kategorien: KpiCategory[],
  betragMap: Map<string, number>,
  columns: FaColumn[],
): RaLine {
  const byOrder = (a: KpiCategory, b: KpiCategory) => a.sort_order - b.sort_order
  const finanzRoot = kategorien.find(k => k.name.trim().toLowerCase() === 'finanzierung')
  const finanzId = finanzRoot?.id ?? null
  const l1 = finanzId ? kategorien.filter(k => k.parent_id === finanzId).slice().sort(byOrder) : []

  // Wert einer einzelnen Kategorie je Spalte (Spalten-Key "2026-1" → Betrag, 0 wenn leer).
  const werteFuer = (katId: string): Record<string, number> => {
    const w: Record<string, number> = {}
    for (const c of columns) {
      // Spalten-Key "JAHR-MONAT" → betragMap-Key "KATID:JAHR:MONAT"
      const dash = c.key.indexOf('-')
      const jahr = c.key.slice(0, dash)
      const monat = c.key.slice(dash + 1)
      w[c.key] = betragMap.get(`${katId}:${jahr}:${monat}`) ?? 0
    }
    return w
  }

  const produkte: RaBreakdown[] = []
  const gesamt: Record<string, number> = Object.fromEntries(columns.map(c => [c.key, 0]))

  for (const g of l1) {
    const untergruppen = kategorien.filter(k => k.parent_id === g.id).slice().sort(byOrder)
    let groupWerte: Record<string, number>
    let children: RaBreakdown[] | undefined

    if (untergruppen.length > 0) {
      children = untergruppen.map(u => ({ id: u.id, label: u.name, werte: werteFuer(u.id) }))
      groupWerte = Object.fromEntries(columns.map(c => [
        c.key,
        round2(children!.reduce((s, u) => s + (u.werte[c.key] ?? 0), 0)),
      ]))
    } else {
      groupWerte = werteFuer(g.id)
    }

    produkte.push(children ? { id: g.id, label: g.name, werte: groupWerte, children } : { id: g.id, label: g.name, werte: groupWerte })
    for (const c of columns) gesamt[c.key] = round2((gesamt[c.key] ?? 0) + (groupWerte[c.key] ?? 0))
  }

  return { werte: gesamt, produkte }
}

// ─── Fetch-Hook ─────────────────────────────────────────────────────────────────

const EMPTY_LINE: RaLine = { werte: {}, produkte: [] }

interface FinanzierungsRecord { kategorie_id: string; jahr: number; monat: number; betrag: number | null }

export function useLangfristigeFinanzierungsausgabenAuswertung(versionId: string): FaModel {
  const [columns, setColumns] = useState<FaColumn[]>([])
  const [finanzierung, setFinanzierung] = useState<RaLine>(EMPTY_LINE)
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
        // Die drei Pflicht-Routen (wie der PROJ-90-Planungs-Hook).
        const [grundRes, katRes, valuesRes] = await Promise.all([
          fetch(`/api/langfristige-planung/${versionId}/grundeinstellungen`),
          fetch('/api/kpi-categories?type=ausgaben_kosten'),
          fetch(`/api/langfristige-planung/${versionId}/finanzierungsausgaben-planung`),
        ])
        if (!grundRes.ok || !katRes.ok || !valuesRes.ok) throw new Error('load failed')

        const grund = await grundRes.json()
        const katData = (await katRes.json()) as KpiCategory[]
        const valuesData = (await valuesRes.json()) as FinanzierungsRecord[]
        if (cancelled) return

        const horizont = grund?.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        const cols = buildColumns(grund?.startmonat_monat, grund?.startmonat_jahr, horizont)

        const bMap = new Map<string, number>()
        for (const r of valuesData) {
          if (r.betrag !== null && r.betrag !== undefined) {
            bMap.set(`${r.kategorie_id}:${r.jahr}:${r.monat}`, Number(r.betrag))
          }
        }
        const line = buildFinanzierungLine(Array.isArray(katData) ? katData : [], bMap, cols)

        setColumns(cols)
        setFinanzierung(line)

        // Brutto-Umsatz (nur Prozent-Bezug) — fehlertolerant: schlägt dieser Aufruf fehl,
        // bleibt der Prozentual-Modus auf „—", Absolut/Wachstum funktionieren weiter.
        try {
          const umsatzRes = await fetch(`/api/langfristige-planung/${versionId}/rentabilitaetsauswertung?nur=umsatz`)
          if (umsatzRes.ok) {
            const data = (await umsatzRes.json()) as RentabilitaetsauswertungResponse
            if (!cancelled) setBrutto(data.lines?.brutto_umsatz?.werte ?? {})
          }
        } catch {
          /* Brutto bleibt leer → Prozentual zeigt „—" */
        }
      } catch {
        if (!cancelled) setError('Fehler beim Laden der Finanzierungsausgaben-Auswertung.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [versionId])

  const hasAnyValue = Object.values(finanzierung.werte ?? {}).some(v => v !== 0)
  const isEmpty = !loading && !error && !hasAnyValue

  return { columns, finanzierung, brutto, loading, error, isEmpty }
}
