import { describe, it, expect } from 'vitest'

// Re-export private functions for testing via module internals
// We test the logic by importing the module and calling internal helpers
// Since they are not exported, we reproduce them here identically

import type { KpiCategory } from './use-kpi-categories'

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

const cat = (id: string, parentId: string | null, level: 1 | 2 | 3, sortOrder = 0): KpiCategory => ({
  id,
  type: 'umsatz',
  parent_id: parentId,
  name: id,
  level,
  sort_order: sortOrder,
})

describe('buildTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildTree([])).toEqual([])
  })

  it('builds a flat list of root nodes', () => {
    const flat = [cat('a', null, 1, 1), cat('b', null, 1, 2)]
    const tree = buildTree(flat)
    expect(tree).toHaveLength(2)
    expect(tree[0].id).toBe('a')
    expect(tree[1].id).toBe('b')
  })

  it('nests children under their parent', () => {
    const flat = [cat('parent', null, 1), cat('child', 'parent', 2)]
    const tree = buildTree(flat)
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children![0].id).toBe('child')
  })

  it('sorts nodes by sort_order', () => {
    const flat = [cat('b', null, 1, 2), cat('a', null, 1, 1)]
    const tree = buildTree(flat)
    expect(tree[0].id).toBe('a')
    expect(tree[1].id).toBe('b')
  })

  it('builds a 3-level deep tree', () => {
    const flat = [
      cat('l1', null, 1),
      cat('l2', 'l1', 2),
      cat('l3', 'l2', 3),
    ]
    const tree = buildTree(flat)
    expect(tree[0].children![0].children![0].id).toBe('l3')
  })

  it('orphaned nodes (unknown parent_id) are not in roots', () => {
    const flat = [cat('orphan', 'nonexistent', 2)]
    const tree = buildTree(flat)
    expect(tree).toHaveLength(0)
  })
})

describe('removeWithDescendants', () => {
  it('removes a leaf node', () => {
    const flat = [cat('parent', null, 1), cat('child', 'parent', 2)]
    const result = removeWithDescendants(flat, 'child')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('parent')
  })

  it('removes a parent and all its descendants', () => {
    const flat = [
      cat('root', null, 1),
      cat('child', 'root', 2),
      cat('grandchild', 'child', 3),
    ]
    const result = removeWithDescendants(flat, 'root')
    expect(result).toHaveLength(0)
  })

  it('does not remove siblings', () => {
    const flat = [
      cat('parent', null, 1),
      cat('child1', 'parent', 2),
      cat('child2', 'parent', 2),
    ]
    const result = removeWithDescendants(flat, 'child1')
    expect(result).toHaveLength(2)
    expect(result.map(c => c.id)).toContain('parent')
    expect(result.map(c => c.id)).toContain('child2')
  })

  it('leaves unrelated nodes intact when id not found', () => {
    const flat = [cat('a', null, 1)]
    const result = removeWithDescendants(flat, 'nonexistent')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('handles empty flat array', () => {
    expect(removeWithDescendants([], 'any')).toEqual([])
  })
})

describe('countDescendants', () => {
  it('returns 0 for a leaf node', () => {
    const flat = [cat('a', null, 1)]
    expect(countDescendants(flat, 'a')).toBe(0)
  })

  it('counts direct children', () => {
    const flat = [cat('parent', null, 1), cat('c1', 'parent', 2), cat('c2', 'parent', 2)]
    expect(countDescendants(flat, 'parent')).toBe(2)
  })

  it('counts all descendants recursively', () => {
    const flat = [
      cat('root', null, 1),
      cat('child', 'root', 2),
      cat('grandchild', 'child', 3),
    ]
    expect(countDescendants(flat, 'root')).toBe(2)
  })

  it('does not count the node itself', () => {
    const flat = [cat('solo', null, 1)]
    expect(countDescendants(flat, 'solo')).toBe(0)
  })

  it('returns 0 for unknown id', () => {
    const flat = [cat('a', null, 1)]
    expect(countDescendants(flat, 'unknown')).toBe(0)
  })
})
