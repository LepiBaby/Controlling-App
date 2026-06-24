import { describe, it, expect, vi } from 'vitest'
import { ensureInvestitionenSnapshot } from './langfristige-investitionen-snapshot'

// Flexibler Query-Builder, der pro from()-Aufruf ein hinterlegtes Ergebnis auflöst
// und insert()-Payloads zur Inspektion sammelt.
function makeSupabase(seq: unknown[], inserts: unknown[][]) {
  let i = 0
  function chain(result: unknown) {
    const c: Record<string, unknown> = { then: (resolve: (v: unknown) => unknown) => resolve(result) }
    for (const m of ['select', 'eq', 'is', 'order', 'limit', 'single', 'maybeSingle']) c[m] = () => c
    c.insert = (rows: unknown[]) => { inserts.push(rows); return c }
    return c
  }
  return { from: () => chain(seq[i++]) } as never
}

const AK = [
  { id: 'pi', name: 'Produktinvestitionen', parent_id: null, level: 1, sort_order: 5 },
  { id: 'prod', name: 'Produkt', parent_id: null, level: 1, sort_order: 1 },
  { id: 'op', name: 'Operations', parent_id: 'pi', level: 2, sort_order: 0 },
  { id: 'sm', name: 'Sales & Marketing', parent_id: 'pi', level: 2, sort_order: 1 },
  { id: 'c1', name: 'Produktentwicklung', parent_id: 'op', level: 3, sort_order: 0 },
  { id: 'c2', name: 'Bewertungen', parent_id: 'sm', level: 3, sort_order: 0 },
  { id: 'e1', name: 'Ware', parent_id: 'prod', level: 2, sort_order: 0 },
]
const INSERTED_L1 = [
  { id: 'op-id', name: 'Produktinvestitionen Operations' },
  { id: 'ein-id', name: 'Produktinvestitionen Einkauf' },
  { id: 'sm-id', name: 'Produktinvestitionen Sales & Marketing' },
]

describe('ensureInvestitionenSnapshot', () => {
  it('does nothing when already seeded (idempotent)', async () => {
    const inserts: unknown[][] = []
    const supabase = makeSupabase([{ data: [{ id: 'existing' }], error: null }], inserts)
    await ensureInvestitionenSnapshot(supabase, 'user-1', 'ver-1')
    expect(inserts).toHaveLength(0)
  })

  it('seeds 3 fixed Übergruppen and mirrored groups on first run', async () => {
    const inserts: unknown[][] = []
    const supabase = makeSupabase(
      [
        { data: [], error: null },          // existing check → empty
        { data: AK, error: null },          // ausgaben_kosten
        { data: INSERTED_L1, error: null }, // insert L1 → returns ids
        { data: null, error: null },        // insert L2
      ],
      inserts,
    )
    await ensureInvestitionenSnapshot(supabase, 'user-1', 'ver-1')

    // L1: drei feste Übergruppen, alle is_system
    const l1 = inserts[0] as Array<Record<string, unknown>>
    expect(l1.map(r => r.name)).toEqual([
      'Produktinvestitionen Operations',
      'Produktinvestitionen Einkauf',
      'Produktinvestitionen Sales & Marketing',
    ])
    expect(l1.every(r => r.is_system === true && r.level === 1)).toBe(true)

    // L2: gespiegelte Gruppen je Übergruppe mit korrektem Eltern-Bezug
    const l2 = inserts[1] as Array<Record<string, unknown>>
    expect(l2.every(r => r.is_system === true && r.level === 2)).toBe(true)
    const byName = new Map(l2.map(r => [r.name as string, r.parent_id]))
    expect(byName.get('Produktentwicklung')).toBe('op-id') // Operations
    expect(byName.get('Ware')).toBe('ein-id')              // Einkauf ← globale L1 „Produkt"
    expect(byName.get('Bewertungen')).toBe('sm-id')        // Sales & Marketing
  })
})
