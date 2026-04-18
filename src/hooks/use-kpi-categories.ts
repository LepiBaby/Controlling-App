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

function buildTree(flat: KpiCategory[]): KpiCategory[] {
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

function removeWithDescendants(flat: KpiCategory[], id: string): KpiCategory[] {
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

function countDescendants(flat: KpiCategory[], id: string): number {
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

  const getDescendantCount = useCallback((id: string) =>
    countDescendants(categories, id), [categories])

  return { tree, categories, loading, error, addCategory, renameCategory, deleteCategory, moveCategory, getDescendantCount }
}
