'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

export type CategoryType = 'umsatz' | 'einnahmen' | 'ausgaben_kosten'

export interface KpiCategory {
  id: string
  type: CategoryType
  parent_id: string | null
  name: string
  level: 1 | 2 | 3
  sort_order: number
  children?: KpiCategory[]
}

export function buildTree(flat: KpiCategory[]): KpiCategory[] {
  const map = new Map<string, KpiCategory>()
  const roots: KpiCategory[] = []

  const sorted = [...flat].sort((a, b) => a.sort_order - b.sort_order)
  sorted.forEach(cat => map.set(cat.id, { ...cat, children: [] }))

  sorted.forEach(cat => {
    if (cat.parent_id === null) {
      roots.push(map.get(cat.id)!)
    } else {
      const parent = map.get(cat.parent_id)
      if (parent) parent.children!.push(map.get(cat.id)!)
    }
  })

  return roots
}

export function removeWithDescendants(flat: KpiCategory[], id: string): KpiCategory[] {
  const toRemove = new Set<string>([id])
  let changed = true
  while (changed) {
    changed = false
    flat.forEach(c => {
      if (c.parent_id && toRemove.has(c.parent_id) && !toRemove.has(c.id)) {
        toRemove.add(c.id)
        changed = true
      }
    })
  }
  return flat.filter(c => !toRemove.has(c.id))
}

export function countDescendants(flat: KpiCategory[], id: string): number {
  const descendants = new Set<string>()
  let changed = true
  const toCheck = new Set<string>([id])
  while (changed) {
    changed = false
    flat.forEach(c => {
      if (c.parent_id && toCheck.has(c.parent_id) && !descendants.has(c.id)) {
        descendants.add(c.id)
        toCheck.add(c.id)
        changed = true
      }
    })
  }
  return descendants.size
}

function getAllDescendantIds(flat: KpiCategory[], id: string): Set<string> {
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

export function getSubtreeDepth(flat: KpiCategory[], id: string): number {
  const cat = flat.find(c => c.id === id)
  if (!cat) return 0
  const descendants = [...getAllDescendantIds(flat, id)]
  if (descendants.length === 0) return 0
  const maxDescLevel = Math.max(...descendants.map(d => flat.find(c => c.id === d)!.level))
  return maxDescLevel - cat.level
}

export function isDescendantOf(flat: KpiCategory[], childId: string, ancestorId: string): boolean {
  return getAllDescendantIds(flat, ancestorId).has(childId)
}

export function useKpiCategories(type: CategoryType) {
  const [categories, setCategories] = useState<KpiCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/kpi-categories?type=${type}`)
      .then(r => r.json())
      .then(data => { setCategories(data); setLoading(false) })
      .catch(() => { setError('Fehler beim Laden der Kategorien.'); setLoading(false) })
  }, [type])

  const tree = useMemo(() => buildTree(categories), [categories])

  const addCategory = useCallback(async (name: string, parentId: string | null, level: 1 | 2 | 3) => {
    const siblings = categories.filter(c =>
      c.parent_id === parentId && c.type === type
    )
    const maxOrder = siblings.length ? Math.max(...siblings.map(c => c.sort_order)) : 0

    const res = await fetch('/api/kpi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, parent_id: parentId, level, sort_order: maxOrder + 1 }),
    })
    const newCat: KpiCategory = await res.json()
    setCategories(prev => [...prev, newCat])
  }, [categories, type])

  const renameCategory = useCallback(async (id: string, name: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    await fetch(`/api/kpi-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }, [])

  const deleteCategory = useCallback(async (id: string) => {
    setCategories(prev => removeWithDescendants(prev, id))
    await fetch(`/api/kpi-categories/${id}`, { method: 'DELETE' })
  }, [])

  const moveCategory = useCallback(async (id: string, direction: 'up' | 'down') => {
    const category = categories.find(c => c.id === id)
    if (!category) return

    const siblings = categories
      .filter(c => c.parent_id === category.parent_id && c.type === category.type)
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
      fetch(`/api/kpi-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: newOrder }),
      }),
      fetch(`/api/kpi-categories/${swapWith.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: swapOrder }),
      }),
    ])
  }, [categories])

  // Reorder within same parent: insert activeId before/after overId
  const reorderCategory = useCallback(async (activeId: string, overId: string, position: 'before' | 'after') => {
    const active = categories.find(c => c.id === activeId)
    const over = categories.find(c => c.id === overId)
    if (!active || !over || active.parent_id !== over.parent_id) return

    const siblings = categories
      .filter(c => c.parent_id === active.parent_id && c.type === active.type)
      .sort((a, b) => a.sort_order - b.sort_order)

    const withoutActive = siblings.filter(c => c.id !== activeId)
    const overIndex = withoutActive.findIndex(c => c.id === overId)
    const insertAt = position === 'before' ? overIndex : overIndex + 1
    withoutActive.splice(insertAt, 0, active)

    const updates = withoutActive.map((c, idx) => ({ id: c.id, sort_order: idx }))
    setCategories(prev => prev.map(c => {
      const u = updates.find(u => u.id === c.id)
      return u ? { ...c, sort_order: u.sort_order } : c
    }))

    await Promise.all(updates.map(({ id, sort_order }) =>
      fetch(`/api/kpi-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order }),
      })
    ))
  }, [categories])

  // Reparent: move activeId (with all descendants) under newParentId
  const reparentCategory = useCallback(async (activeId: string, newParentId: string, newLevel: 1 | 2 | 3) => {
    const active = categories.find(c => c.id === activeId)
    if (!active) return

    const levelDiff = newLevel - active.level
    const descendants = getAllDescendantIds(categories, activeId)

    const newSiblings = categories.filter(c => c.parent_id === newParentId && c.type === active.type)
    const newSortOrder = newSiblings.length > 0
      ? Math.max(...newSiblings.map(c => c.sort_order)) + 1
      : 0

    setCategories(prev => prev.map(c => {
      if (c.id === activeId) return { ...c, parent_id: newParentId, level: newLevel, sort_order: newSortOrder }
      if (descendants.has(c.id)) return { ...c, level: Math.min(3, c.level + levelDiff) as 1 | 2 | 3 }
      return c
    }))

    await fetch(`/api/kpi-categories/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_id: newParentId, level: newLevel, sort_order: newSortOrder }),
    })

    await Promise.all([...descendants].map(descId => {
      const desc = categories.find(c => c.id === descId)!
      const newDescLevel = Math.min(3, desc.level + levelDiff) as 1 | 2 | 3
      return fetch(`/api/kpi-categories/${descId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: newDescLevel }),
      })
    }))
  }, [categories])

  const getDescendantCount = useCallback((id: string) =>
    countDescendants(categories, id), [categories])

  const getSubtreeDepthForId = useCallback((id: string) =>
    getSubtreeDepth(categories, id), [categories])

  const isDescendantOfId = useCallback((childId: string, ancestorId: string) =>
    isDescendantOf(categories, childId, ancestorId), [categories])

  return {
    tree, categories, loading, error,
    addCategory, renameCategory, deleteCategory, moveCategory,
    reorderCategory, reparentCategory,
    getDescendantCount, getSubtreeDepthForId, isDescendantOfId,
  }
}
