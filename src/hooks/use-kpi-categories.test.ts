import { describe, it, expect } from 'vitest'
import {
  buildTree,
  removeWithDescendants,
  countDescendants,
  getSubtreeDepth,
  isDescendantOf,
} from './use-kpi-categories'
import type { KpiCategory } from './use-kpi-categories'

const cat = (id: string, parentId: string | null, level: 1 | 2 | 3, sortOrder = 0): KpiCategory => ({
  id,
  type: 'umsatz',
  parent_id: parentId,
  name: id,
  level,
  sort_order: sortOrder,
  sales_plattform_enabled: false,
  produkt_enabled: false,
})

// ─── buildTree ────────────────────────────────────────────────────────────────

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

// ─── removeWithDescendants ────────────────────────────────────────────────────

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

// ─── countDescendants ────────────────────────────────────────────────────────

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

// ─── getSubtreeDepth ─────────────────────────────────────────────────────────

describe('getSubtreeDepth', () => {
  it('returns 0 for a leaf node', () => {
    const flat = [cat('a', null, 1)]
    expect(getSubtreeDepth(flat, 'a')).toBe(0)
  })

  it('returns 1 for a node with direct children only', () => {
    const flat = [cat('p', null, 1), cat('c', 'p', 2)]
    expect(getSubtreeDepth(flat, 'p')).toBe(1)
  })

  it('returns 2 for a node with grandchildren', () => {
    const flat = [cat('p', null, 1), cat('c', 'p', 2), cat('gc', 'c', 3)]
    expect(getSubtreeDepth(flat, 'p')).toBe(2)
  })

  it('returns 0 for unknown id', () => {
    const flat = [cat('a', null, 1)]
    expect(getSubtreeDepth(flat, 'unknown')).toBe(0)
  })

  it('counts depth relative to the node level, not absolute', () => {
    // A level-2 node with a level-3 child → depth = 1
    const flat = [
      cat('root', null, 1),
      cat('mid', 'root', 2),
      cat('leaf', 'mid', 3),
    ]
    expect(getSubtreeDepth(flat, 'mid')).toBe(1)
  })
})

// ─── isDescendantOf ───────────────────────────────────────────────────────────

describe('isDescendantOf', () => {
  it('returns true for a direct child', () => {
    const flat = [cat('parent', null, 1), cat('child', 'parent', 2)]
    expect(isDescendantOf(flat, 'child', 'parent')).toBe(true)
  })

  it('returns true for a grandchild', () => {
    const flat = [cat('p', null, 1), cat('c', 'p', 2), cat('gc', 'c', 3)]
    expect(isDescendantOf(flat, 'gc', 'p')).toBe(true)
  })

  it('returns false for a sibling', () => {
    const flat = [
      cat('p', null, 1),
      cat('c1', 'p', 2),
      cat('c2', 'p', 2),
    ]
    expect(isDescendantOf(flat, 'c1', 'c2')).toBe(false)
  })

  it('returns false for the node itself', () => {
    const flat = [cat('a', null, 1)]
    expect(isDescendantOf(flat, 'a', 'a')).toBe(false)
  })

  it('returns false for unrelated nodes', () => {
    const flat = [cat('a', null, 1), cat('b', null, 1)]
    expect(isDescendantOf(flat, 'a', 'b')).toBe(false)
  })

  it('returns false when ancestor does not exist', () => {
    const flat = [cat('a', null, 1)]
    expect(isDescendantOf(flat, 'a', 'nonexistent')).toBe(false)
  })
})

// ─── DnD validation logic (reparent constraints) ──────────────────────────────

describe('reparent validation logic', () => {
  // Mirrors the constraint: newLevel + activeDepth <= 3
  // newLevel = target.level + 1

  it('leaf into level-1 target → valid (newLevel=2, depth=0, 2+0=2 ≤ 3)', () => {
    const flat = [cat('target', null, 1), cat('active', null, 1)]
    const activeDepth = getSubtreeDepth(flat, 'active')
    const newLevel = 2 // target.level(1) + 1
    expect(newLevel + activeDepth).toBeLessThanOrEqual(3)
  })

  it('node with 1 child level into level-1 target → valid (newLevel=2, depth=1, 2+1=3 ≤ 3)', () => {
    const flat = [cat('target', null, 1), cat('active', null, 1), cat('child', 'active', 2)]
    const activeDepth = getSubtreeDepth(flat, 'active')
    const newLevel = 2
    expect(newLevel + activeDepth).toBeLessThanOrEqual(3)
  })

  it('node with grandchild into level-1 target → INVALID (newLevel=2, depth=2, 2+2=4 > 3)', () => {
    const flat = [
      cat('target', null, 1),
      cat('active', null, 1),
      cat('child', 'active', 2),
      cat('grandchild', 'child', 3),
    ]
    const activeDepth = getSubtreeDepth(flat, 'active')
    const newLevel = 2
    expect(newLevel + activeDepth).toBeGreaterThan(3)
  })

  it('leaf into level-2 target → valid (newLevel=3, depth=0, 3+0=3 ≤ 3)', () => {
    const flat = [cat('root', null, 1), cat('target', 'root', 2), cat('active', null, 1)]
    const activeDepth = getSubtreeDepth(flat, 'active')
    const newLevel = 3
    expect(newLevel + activeDepth).toBeLessThanOrEqual(3)
  })

  it('any node into level-3 target → INVALID (newLevel=4 > 3)', () => {
    const newLevel = 4 // target.level(3) + 1
    expect(newLevel).toBeGreaterThan(3)
  })

  it('cannot reparent into own descendant', () => {
    const flat = [cat('active', null, 1), cat('child', 'active', 2)]
    expect(isDescendantOf(flat, 'child', 'active')).toBe(true)
  })
})
