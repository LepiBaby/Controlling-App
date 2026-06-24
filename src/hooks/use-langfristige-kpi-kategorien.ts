'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  buildTree,
  removeWithDescendants,
  countDescendants,
  type KpiCategory,
} from '@/hooks/use-kpi-categories'

// PROJ-74: Versionsgebundene KPI-Kategorien der Langfristigen Planung.
// Spiegelt useKpiCategories, arbeitet aber gegen die versions-/nutzergesicherten
// Endpunkte und kennt KEINE Zusatzfunktionen (SKU, USt, Dimensionen,
// Anzeigebezeichnungen, Rentabilitäts-Ausschluss). Die Datensätze teilen sich die
// KpiCategory-Form, damit Baum-/Zeilen-Komponente unverändert genutzt werden.

export type LangfristigeArt =
  | 'lp_sales_plattform'
  | 'lp_produkt'
  | 'lp_marketingkanal'
  | 'lp_investition'

// Rohdatensatz aus der API (versionsgebunden).
interface LangfristigeKategorieRecord {
  id: string
  plan_version_id: string
  art: LangfristigeArt
  parent_id: string | null
  name: string
  level: 1 | 2 | 3
  sort_order: number
  is_system?: boolean
}

// Auf die gemeinsame KpiCategory-Form abbilden; ungenutzte Felder defaulten.
function toKpiCategory(r: LangfristigeKategorieRecord): KpiCategory {
  return {
    id: r.id,
    type: r.art,
    parent_id: r.parent_id,
    name: r.name,
    level: r.level,
    sort_order: r.sort_order,
    sku_code: null,
    sales_plattform_enabled: false,
    produkt_enabled: false,
    kosten_label: null,
    ausgaben_label: null,
    ist_abzugsposten: false,
    ust_satz: null,
    exclude_from_rentabilitaet: false,
    is_system: r.is_system ?? false,
  }
}

// Lokaler Helfer: alle Nachfahren-IDs (getAllDescendantIds ist im Basis-Hook nicht
// exportiert). Wird nur für das Verschieben/Umhängen benötigt.
function descendantIds(flat: KpiCategory[], id: string): Set<string> {
  const result = new Set<string>()
  const toCheck = new Set<string>([id])
  let changed = true
  while (changed) {
    changed = false
    flat.forEach(c => {
      if (c.parent_id && toCheck.has(c.parent_id) && !result.has(c.id)) {
        result.add(c.id)
        toCheck.add(c.id)
        changed = true
      }
    })
  }
  return result
}

export function useLangfristigeKpiKategorien(versionId: string, art: LangfristigeArt) {
  const [categories, setCategories] = useState<KpiCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const basePath = `/api/langfristige-planung/${versionId}/kpi-kategorien`

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setLoading(true)
    fetch(`${basePath}?art=${art}`)
      .then(r => {
        if (!r.ok) throw new Error('load failed')
        return r.json()
      })
      .then((data: LangfristigeKategorieRecord[]) => {
        if (!aktiv) return
        setCategories(data.map(toKpiCategory))
        setLoading(false)
      })
      .catch(() => {
        if (!aktiv) return
        setError('Fehler beim Laden der Kategorien.')
        setLoading(false)
      })
    return () => {
      aktiv = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, art])

  const tree = useMemo(() => buildTree(categories), [categories])

  const addCategory = useCallback(async (name: string, parentId: string | null, level: 1 | 2 | 3) => {
    const siblings = categories.filter(c => c.parent_id === parentId)
    const maxOrder = siblings.length ? Math.max(...siblings.map(c => c.sort_order)) : 0

    const res = await fetch(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ art, name, parent_id: parentId, level, sort_order: maxOrder + 1 }),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler beim Speichern.')
    const newCat: LangfristigeKategorieRecord = await res.json()
    setCategories(prev => [...prev, toKpiCategory(newCat)])
  }, [categories, art, basePath])

  const renameCategory = useCallback(async (id: string, name: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    await fetch(`${basePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }, [basePath])

  const deleteCategory = useCallback(async (id: string) => {
    setCategories(prev => removeWithDescendants(prev, id))
    await fetch(`${basePath}/${id}`, { method: 'DELETE' })
  }, [basePath])

  const moveCategory = useCallback(async (id: string, direction: 'up' | 'down') => {
    const category = categories.find(c => c.id === id)
    if (!category || category.is_system) return

    // Systemgruppen (feste Produktinvestitions-Übergruppen) bleiben fix und werden
    // beim Umsortieren nicht berücksichtigt.
    const siblings = categories
      .filter(c => c.parent_id === category.parent_id && !c.is_system)
      .sort((a, b) => a.sort_order - b.sort_order)

    const index = siblings.findIndex(c => c.id === id)
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === siblings.length - 1) return

    const swapWith = direction === 'up' ? siblings[index - 1] : siblings[index + 1]
    const newOrder = swapWith.sort_order
    const swapOrder = category.sort_order

    setCategories(prev => prev.map(c => {
      if (c.id === id) return { ...c, sort_order: newOrder }
      if (c.id === swapWith.id) return { ...c, sort_order: swapOrder }
      return c
    }))

    await Promise.all([
      fetch(`${basePath}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: newOrder }),
      }),
      fetch(`${basePath}/${swapWith.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: swapOrder }),
      }),
    ])
  }, [categories, basePath])

  // Innerhalb desselben Elternknotens umsortieren: activeId vor/nach overId einfügen.
  const reorderCategory = useCallback(async (activeId: string, overId: string, position: 'before' | 'after') => {
    const active = categories.find(c => c.id === activeId)
    const over = categories.find(c => c.id === overId)
    if (!active || !over || active.parent_id !== over.parent_id) return
    // Systemgruppen sind fix — weder verschiebbar noch als Ankerziel zulässig.
    if (active.is_system || over.is_system) return

    const siblings = categories
      .filter(c => c.parent_id === active.parent_id && !c.is_system)
      .sort((a, b) => a.sort_order - b.sort_order)

    const withoutActive = siblings.filter(c => c.id !== activeId)
    const overIndex = withoutActive.findIndex(c => c.id === overId)
    const insertAt = position === 'before' ? overIndex : overIndex + 1
    withoutActive.splice(insertAt, 0, active)

    // sort_order hinter den festen Systemgruppen fortführen.
    const systemCount = categories.filter(c => c.parent_id === active.parent_id && c.is_system).length
    const updates = withoutActive.map((c, idx) => ({ id: c.id, sort_order: systemCount + idx }))
    setCategories(prev => prev.map(c => {
      const u = updates.find(u => u.id === c.id)
      return u ? { ...c, sort_order: u.sort_order } : c
    }))

    await Promise.all(updates.map(({ id, sort_order }) =>
      fetch(`${basePath}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order }),
      })
    ))
  }, [categories, basePath])

  // Umhängen: activeId (inkl. Nachfahren) unter newParentId verschieben.
  const reparentCategory = useCallback(async (activeId: string, newParentId: string | null, newLevel: 1 | 2 | 3) => {
    const active = categories.find(c => c.id === activeId)
    if (!active || active.is_system) return

    const levelDiff = newLevel - active.level
    const descendants = descendantIds(categories, activeId)

    // Hinter den festen Systemgruppen einreihen; gespiegelte Gruppen bleiben unangetastet.
    const newSiblings = categories.filter(c => c.parent_id === newParentId && !c.is_system)
    const systemCount = categories.filter(c => c.parent_id === newParentId && c.is_system).length
    const newSortOrder = newSiblings.length > 0
      ? Math.max(...newSiblings.map(c => c.sort_order)) + 1
      : systemCount

    setCategories(prev => prev.map(c => {
      if (c.id === activeId) return { ...c, parent_id: newParentId, level: newLevel, sort_order: newSortOrder }
      if (descendants.has(c.id)) return { ...c, level: Math.min(3, c.level + levelDiff) as 1 | 2 | 3 }
      return c
    }))

    await fetch(`${basePath}/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_id: newParentId, level: newLevel, sort_order: newSortOrder }),
    })

    await Promise.all([...descendants].map(descId => {
      const desc = categories.find(c => c.id === descId)!
      const newDescLevel = Math.min(3, desc.level + levelDiff) as 1 | 2 | 3
      return fetch(`${basePath}/${descId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: newDescLevel }),
      })
    }))
  }, [categories, basePath])

  const getDescendantCount = useCallback((id: string) =>
    countDescendants(categories, id), [categories])

  return {
    tree, categories, loading, error,
    addCategory, renameCategory, deleteCategory, moveCategory,
    reorderCategory, reparentCategory, getDescendantCount,
  }
}
