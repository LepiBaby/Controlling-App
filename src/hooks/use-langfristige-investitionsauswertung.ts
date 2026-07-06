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
// zeigt deren EFFEKTIVEN SOLL (manueller Wert sonst berechneter Wert sonst 0).
//
// Zwei Aufschlüsselungen (umschaltbar auf der Seite):
//   • 'produkt'   (Standard) — OBERSTE Ebene = die als Investition markierten PRODUKTE
//     (PROJ-105, ist_investition). Darunter je Produkt der VOLLSTÄNDIGE Investitions-
//     Kategoriebaum: Obergruppe → Untergruppe (Leaf). Diagramm stapelt je Produkt.
//   • 'kategorie' — OBERSTE Ebene = die Investitions-Kategorien: Obergruppe →
//     Untergruppe → Produkt (Leaf; nur Produkte, für die Daten vorliegen). Diagramm
//     stapelt je Obergruppe. So war die Auswertung ursprünglich aufgebaut.
//
// In beiden Fällen ist der Zellwert der effektive Soll (manuell → berechnet → 0) und
// damit je (Untergruppe × Produkt) identisch zur Eingabeseite. Ganz unten steht die
// Zeile "Investitionen (Gesamt)".

export type IaZeitansicht = 'monatlich' | 'gesamt'
export type IaAufschluesselung = 'produkt' | 'kategorie'

export interface IaColumn {
  key: string
  label: string
  sublabel?: string
}

export type IaNodeKind = 'produkt' | 'obergruppe' | 'untergruppe' | 'gesamt'

export interface IaNode {
  id: string
  label: string
  kind: IaNodeKind
  values: Record<string, number> // je Spalten-Key der effektive Soll
  children?: IaNode[]
}

// Ein Produkt als Diagramm-Serie (für die Stapelung).
export interface IaSerie {
  id: string
  label: string
  values: Record<string, number>
}

export interface IaModel {
  aufschluesselung: IaAufschluesselung
  columns: IaColumn[]
  tree: IaNode[] // je nach Aufschlüsselung: Produkt- oder Obergruppen-Wurzel
  gesamt: IaNode // "Investitionen (Gesamt)"
  serien: IaSerie[] // je Diagramm-Serie (Produkt bzw. Obergruppe)
  loading: boolean
  error: string | null
  hasKategorien: boolean
  hasProdukte: boolean // 'produkt': mind. ein markiertes Produkt; 'kategorie': mind. ein Produkt
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

/** Alle ausklappbaren Knoten-Ids (jeder Knoten mit Kindern, beliebige Tiefe). */
export function collectIaExpandableIds(tree: IaNode[]): string[] {
  const ids: string[] = []
  const walk = (nodes: IaNode[]) => {
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        ids.push(n.id)
        walk(n.children)
      }
    }
  }
  walk(tree)
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

export function useLangfristigeInvestitionsauswertung(
  versionId: string,
  aufschluesselung: IaAufschluesselung = 'produkt',
): IaModel {
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

    const obergruppen = kategorien.filter(k => k.level === 1)
    const untergruppen = kategorien.filter(k => k.level === 2)
    // Oberste Ebene der Produkt-Aufschlüsselung: nur markierte Produkte (PROJ-105).
    const investProdukte = produkte.filter(p => p.ist_investition)

    const untergruppeWerte = (ugId: string, prodId: string): Record<string, number> => {
      const values: Record<string, number> = {}
      for (const m of monate) values[colKey(m)] = round2(effektiv(ugId, prodId, m))
      return values
    }

    // "Daten vorliegen" für (Untergruppe × Produkt): mind. ein Monat mit manueller
    // Überschreibung ODER berechnetem Wert (nur relevant in der Kategorie-Ansicht).
    const hatDaten = (ugId: string, prodId: string): boolean =>
      monate.some(m => isManuelleOverride(ugId, prodId, m) || getBerechneterWert(ugId, prodId, m) !== null)

    let tree: IaNode[]
    let serien: IaSerie[]
    let hasProdukte: boolean

    if (aufschluesselung === 'kategorie') {
      // Obergruppe → Untergruppe → Produkt (Leaf; nur Produkte mit Daten).
      tree = obergruppen.map(og => {
        const ugNodes: IaNode[] = untergruppen
          .filter(ug => ug.parent_id === og.id)
          .map(ug => {
            const prodNodes: IaNode[] = produkte
              .filter(p => hatDaten(ug.id, p.id))
              .map(p => ({
                id: `${og.id}:${ug.id}:${p.id}`,
                label: p.name,
                kind: 'produkt' as const,
                values: untergruppeWerte(ug.id, p.id),
              }))
            return {
              id: `${og.id}:${ug.id}`,
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
      // Diagramm-Serien: je Obergruppe eine gestapelte Serie (Summe = Gesamt).
      serien = tree.map(og => ({ id: og.id, label: og.label, values: og.values }))
      hasProdukte = produkte.length > 0
    } else {
      // Produkt → Obergruppe → Untergruppe (Leaf, Wert = effektiver Soll dieses Produkts).
      tree = investProdukte.map(prod => {
        const ogNodes: IaNode[] = obergruppen.map(og => {
          const ugNodes: IaNode[] = untergruppen
            .filter(ug => ug.parent_id === og.id)
            .map(ug => ({
              id: `${prod.id}:${og.id}:${ug.id}`,
              label: ug.name,
              kind: 'untergruppe' as const,
              values: untergruppeWerte(ug.id, prod.id),
            }))
          return {
            id: `${prod.id}:${og.id}`,
            label: og.name,
            kind: 'obergruppe' as const,
            values: sumValues(ugNodes, keys),
            children: ugNodes,
          }
        })
        return {
          id: prod.id,
          label: prod.name,
          kind: 'produkt' as const,
          values: sumValues(ogNodes, keys),
          children: ogNodes,
        }
      })
      // Diagramm-Serien: je markiertem Produkt eine gestapelte Serie (Summe = Gesamt).
      serien = tree.map(prod => ({ id: prod.id, label: prod.label, values: prod.values }))
      hasProdukte = investProdukte.length > 0
    }

    const gesamt: IaNode = {
      id: '__gesamt__',
      label: 'Investitionen (Gesamt)',
      kind: 'gesamt',
      values: sumValues(tree, keys),
    }

    const hasKategorien = obergruppen.length > 0
    const hasAnyValue = keys.some(k => (gesamt.values[k] ?? 0) !== 0)
    // Produkt-Ansicht braucht ein markiertes Produkt; Kategorie-Ansicht nicht.
    const emptyBasis = aufschluesselung === 'kategorie' ? hasKategorien : hasKategorien && hasProdukte
    const isEmpty = !loading && !error && emptyBasis && !hasAnyValue

    return {
      aufschluesselung,
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
  }, [aufschluesselung, monate, kategorien, produkte, loading, error, getManuellerWert, getBerechneterWert, isManuelleOverride])
}
