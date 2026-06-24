'use client'

import { useMemo } from 'react'
import {
  useLangfristigeInvestitionsausgaben,
  type PlanungsMonat,
} from '@/hooks/use-langfristige-investitionsausgaben'

// PROJ-99: Read-only Investitionsauswertung der LANGFRISTIGEN Planung (pro Planversion).
//
// Diese Seite ist die reine Anzeige-Schwester der Eingabeseite "Investitionsausgaben
// Planung" (PROJ-92). Sie lädt KEINE eigenen Daten und hat KEINE eigene API: sie nutzt
// die bestehende PROJ-92-Datenbeschaffung (use-langfristige-investitionsausgaben) und
// zeigt deren EFFEKTIVEN SOLL (manueller Wert sonst berechneter Wert sonst 0) als
// Hierarchie Obergruppe → Untergruppe → Produkt + Gesamt-Zeile an.
//
// Dadurch sind die Zahlen garantiert identisch zur Investitionsausgaben-Planung.

export type IaZeitansicht = 'monatlich' | 'gesamt'

export interface IaColumn {
  key: string
  label: string
  sublabel?: string
}

export type IaNodeKind = 'obergruppe' | 'untergruppe' | 'produkt' | 'gesamt'

export interface IaNode {
  id: string
  label: string
  kind: IaNodeKind
  values: Record<string, number> // je Spalten-Key der effektive Soll
  children?: IaNode[]
}

// Eine Obergruppe als Diagramm-Serie (für die Stapelung).
export interface IaSerie {
  id: string
  label: string
  values: Record<string, number>
}

export interface IaModel {
  columns: IaColumn[]
  tree: IaNode[] // Obergruppen (mit Untergruppen → Produkten)
  gesamt: IaNode // "Investitionen (Gesamt)"
  serien: IaSerie[] // je Obergruppe (Diagramm)
  loading: boolean
  error: string | null
  hasKategorien: boolean
  hasProdukte: boolean
  isEmpty: boolean
}

function colKey(m: PlanungsMonat): string {
  return `${m.year}-${m.month}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Summiert die Spaltenwerte mehrerer Knoten je Spalten-Key.
function sumValues(nodes: { values: Record<string, number> }[], keys: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of keys) {
    let s = 0
    for (const n of nodes) s += n.values[k] ?? 0
    out[k] = round2(s)
  }
  return out
}

/** Alle ausklappbaren Knoten-Ids (Obergruppen + Untergruppen mit Kindern). */
export function collectIaExpandableIds(tree: IaNode[]): string[] {
  const ids: string[] = []
  for (const og of tree) {
    if (og.children && og.children.length > 0) {
      ids.push(og.id)
      for (const ug of og.children) {
        if (ug.children && ug.children.length > 0) ids.push(ug.id)
      }
    }
  }
  return ids
}

// ─── Zeitansicht: Monatlich ↔ Gesamt (eine zeitlose Spalte = Summe aller Monate) ──

function collapseNode(node: IaNode): IaNode {
  const total = Object.values(node.values).reduce((a, b) => a + b, 0)
  return {
    ...node,
    values: { gesamt: round2(total) },
    children: node.children ? node.children.map(collapseNode) : undefined,
  }
}

/**
 * Verdichtet ein Monats-Modell auf eine einzige zeitlose "Gesamt"-Spalte
 * (Summe über alle Monate je Zeile). Bei `zeitansicht === 'monatlich'` unverändert.
 */
export function applyIaZeitansicht(model: IaModel, zeitansicht: IaZeitansicht): IaModel {
  if (zeitansicht === 'monatlich' || model.columns.length === 0) return model
  return {
    ...model,
    columns: [{ key: 'gesamt', label: 'Gesamt' }],
    tree: model.tree.map(collapseNode),
    gesamt: collapseNode(model.gesamt),
    serien: model.serien.map(s => ({
      ...s,
      values: { gesamt: round2(Object.values(s.values).reduce((a, b) => a + b, 0)) },
    })),
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useLangfristigeInvestitionsauswertung(versionId: string): IaModel {
  const {
    monate,
    kategorien,
    produkte,
    loading,
    error,
    getManuellerWert,
    getBerechneterWert,
    isManuelleOverride,
  } = useLangfristigeInvestitionsausgaben(versionId)

  return useMemo<IaModel>(() => {
    const columns: IaColumn[] = monate.map(m => ({ key: colKey(m), label: m.label }))
    const keys = columns.map(c => c.key)

    // Effektiver Soll je (Untergruppe × Produkt × Monat): manuell sonst berechnet sonst 0.
    const effektiv = (untergruppeId: string, produktId: string, m: PlanungsMonat): number => {
      const manuell = getManuellerWert(untergruppeId, produktId, m)
      if (manuell !== null) return manuell
      const berechnet = getBerechneterWert(untergruppeId, produktId, m)
      return berechnet !== null ? berechnet : 0
    }

    // "Daten vorliegen" = es existiert in mindestens einem Monat ein echter Eintrag
    // (manuelle Überschreibung ODER ein berechneter Wert) für (Untergruppe × Produkt).
    const hatDaten = (untergruppeId: string, produktId: string): boolean =>
      monate.some(
        m =>
          isManuelleOverride(untergruppeId, produktId, m) ||
          getBerechneterWert(untergruppeId, produktId, m) !== null,
      )

    const obergruppen = kategorien.filter(k => k.level === 1)
    const untergruppen = kategorien.filter(k => k.level === 2)

    const tree: IaNode[] = obergruppen.map(og => {
      const ugList = untergruppen.filter(ug => ug.parent_id === og.id)

      const ugNodes: IaNode[] = ugList.map(ug => {
        // Nur Produkte auf unterster Ebene, für die auch Daten vorliegen.
        const prodNodes: IaNode[] = produkte
          .filter(p => hatDaten(ug.id, p.id))
          .map(p => {
            const values: Record<string, number> = {}
            for (const m of monate) values[colKey(m)] = round2(effektiv(ug.id, p.id, m))
            return { id: `${ug.id}:${p.id}`, label: p.name, kind: 'produkt' as const, values }
          })
        return {
          id: ug.id,
          label: ug.name,
          kind: 'untergruppe' as const,
          values: sumValues(prodNodes, keys),
          children: prodNodes,
        }
      })

      return {
        id: og.id,
        label: og.name,
        kind: 'obergruppe' as const,
        values: sumValues(ugNodes, keys),
        children: ugNodes,
      }
    })

    const gesamt: IaNode = {
      id: '__gesamt__',
      label: 'Investitionen (Gesamt)',
      kind: 'gesamt',
      values: sumValues(tree, keys),
    }

    const serien: IaSerie[] = tree.map(og => ({ id: og.id, label: og.label, values: og.values }))

    const hasKategorien = obergruppen.length > 0
    const hasProdukte = produkte.length > 0
    const hasAnyValue = keys.some(k => (gesamt.values[k] ?? 0) !== 0)
    const isEmpty = !loading && !error && hasKategorien && !hasAnyValue

    return {
      columns,
      tree,
      gesamt,
      serien,
      loading,
      error,
      hasKategorien,
      hasProdukte,
      isEmpty,
    }
  }, [monate, kategorien, produkte, loading, error, getManuellerWert, getBerechneterWert, isManuelleOverride])
}
