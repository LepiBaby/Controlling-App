import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

// ─── ISO week helpers ─────────────────────────────────────────────────────────

function getISOWeekMonday(d: Date): Date {
  const day = d.getUTCDay() || 7 // Sun = 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1)))
}

function getISOWeekInfo(d: Date): { year: number; week: number } {
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (4 - (d.getUTCDay() || 7))))
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: thu.getUTCFullYear(), week }
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  // 1. Load vergangenheitshorizont
  const { data: grundData } = await supabase
    .from('grundeinstellungen')
    .select('vergangenheitshorizont_wochen')
    .eq('user_id', user!.id)
    .maybeSingle()

  const horizont = grundData?.vergangenheitshorizont_wochen ?? 13

  // 2. Date range: Monday of (horizont) weeks ago → Monday of current week (exclusive)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const currentMonday = getISOWeekMonday(today)
  const startMonday = new Date(currentMonday.getTime() - horizont * 7 * 86400000)
  const startStr = toDateOnly(startMonday)
  const endStr = toDateOnly(currentMonday)

  // 3. Load kpi_categories to classify transaction categories into buckets
  const { data: allKats, error: katErr } = await supabase
    .from('kpi_categories')
    .select('id, name, parent_id, type, ist_abzugsposten, level')
    .limit(2000)

  if (katErr) return NextResponse.json({ error: katErr.message }, { status: 500 })

  type KatRow = { id: string; name: string; parent_id: string | null; type: string; ist_abzugsposten: boolean; level: number }
  const kats = (allKats ?? []) as KatRow[]

  // Build parent → children map for descendant lookup
  const childrenMap = new Map<string, string[]>()
  for (const k of kats) {
    if (k.parent_id) {
      if (!childrenMap.has(k.parent_id)) childrenMap.set(k.parent_id, [])
      childrenMap.get(k.parent_id)!.push(k.id)
    }
  }

  function getDescendants(rootId: string): Set<string> {
    const result = new Set<string>([rootId])
    const queue = [rootId]
    while (queue.length > 0) {
      const curr = queue.shift()!
      for (const child of childrenMap.get(curr) ?? []) {
        result.add(child)
        queue.push(child)
      }
    }
    return result
  }

  // Bruttoumsatz: umsatz type, not abzugsposten, level 1 (+ descendants)
  const bruttoIds = new Set<string>()
  for (const k of kats) {
    if (k.type === 'umsatz' && !k.ist_abzugsposten && k.level === 1) {
      for (const id of getDescendants(k.id)) bruttoIds.add(id)
    }
  }

  // Rabatte: umsatz type, abzugsposten, name contains 'rabatt'
  const rabatteIds = new Set<string>()
  for (const k of kats) {
    if (k.type === 'umsatz' && k.ist_abzugsposten && k.name.toLowerCase().includes('rabatt')) {
      for (const id of getDescendants(k.id)) rabatteIds.add(id)
    }
  }

  // Rückerstattungen: umsatz type, abzugsposten, name contains 'rückerstattung'
  const rueckIds = new Set<string>()
  for (const k of kats) {
    if (k.type === 'umsatz' && k.ist_abzugsposten && k.name.toLowerCase().includes('rückerstattung')) {
      for (const id of getDescendants(k.id)) rueckIds.add(id)
    }
  }

  // Verkaufsgebühr: ausgaben_kosten, name contains 'verkaufsgebühr' (+ descendants)
  const vkGebIds = new Set<string>()
  for (const k of kats) {
    if (k.type === 'ausgaben_kosten') {
      const n = k.name.toLowerCase()
      if (n.includes('verkaufsgebühr') || n.includes('verkaufsgebuehr')) {
        for (const id of getDescendants(k.id)) vkGebIds.add(id)
      }
    }
  }

  // Retouren: ausgaben_kosten, name == 'retouren' (+ descendants)
  const retourenIds = new Set<string>()
  for (const k of kats) {
    if (k.type === 'ausgaben_kosten' && k.name.toLowerCase() === 'retouren') {
      for (const id of getDescendants(k.id)) retourenIds.add(id)
    }
  }

  // Marketing: ausgaben_kosten, name == 'marketing', level 1 (+ descendants)
  const marketingIds = new Set<string>()
  const marketingLevel1Ids = new Set<string>()
  for (const k of kats) {
    if (k.type === 'ausgaben_kosten' && k.name.toLowerCase() === 'marketing' && k.level === 1) {
      marketingLevel1Ids.add(k.id)
      for (const id of getDescendants(k.id)) marketingIds.add(id)
    }
  }

  // Build map: any marketing-descendant ID → its level-2 Untergruppe ID (for grouping)
  const marketingUntergruppIds = new Set<string>()
  for (const k of kats) {
    if (k.parent_id && marketingLevel1Ids.has(k.parent_id)) marketingUntergruppIds.add(k.id)
  }
  const toUntergruppe = new Map<string, string>()
  for (const ugId of marketingUntergruppIds) {
    for (const childId of getDescendants(ugId)) toUntergruppe.set(childId, ugId)
  }
  // Also map level-1 marketing itself → keep as-is (edge case: transaction tagged at level 1)
  for (const id of marketingLevel1Ids) if (!toUntergruppe.has(id)) toUntergruppe.set(id, id)

  // 4. Load transactions in parallel
  const ausgKatIds = [...vkGebIds, ...retourenIds, ...marketingIds]

  const [umsatzResult, ausgabenResult] = await Promise.all([
    supabase
      .from('umsatz_transaktionen')
      .select('produkt_id, sales_plattform_id, leistungsdatum, betrag, kategorie_id')
      .gte('leistungsdatum', startStr)
      .lt('leistungsdatum', endStr)
      .not('produkt_id', 'is', null)
      .not('sales_plattform_id', 'is', null)
      .limit(50000),
    ausgKatIds.length > 0
      ? supabase
          .from('ausgaben_kosten_transaktionen')
          .select('produkt_id, sales_plattform_id, leistungsdatum, betrag_brutto, kategorie_id, gruppe_id, relevanz')
          .gte('leistungsdatum', startStr)
          .lt('leistungsdatum', endStr)
          .not('produkt_id', 'is', null)
          .or(`kategorie_id.in.(${ausgKatIds.join(',')}),gruppe_id.in.(${ausgKatIds.join(',')})`)
          .in('relevanz', ['rentabilitaet', 'beides'])
          .limit(50000)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (umsatzResult.error) return NextResponse.json({ error: umsatzResult.error.message }, { status: 500 })
  if (ausgabenResult.error) return NextResponse.json({ error: ausgabenResult.error.message }, { status: 500 })

  // 5. Aggregate by (bucket, produkt_id, sales_plattform_id, kw_year, kw_number)
  const aggMap = new Map<string, number>()

  function addValue(bucket: string, prodId: string, pltId: string, dateStr: string, value: number) {
    const d = new Date(dateStr + 'T00:00:00Z')
    const { year, week } = getISOWeekInfo(d)
    const key = `${bucket}:${prodId}:${pltId}:${year}:${week}`
    aggMap.set(key, (aggMap.get(key) ?? 0) + value)
  }

  type UmsatzRow = { produkt_id: string; sales_plattform_id: string; leistungsdatum: string; betrag: number; kategorie_id: string }
  type AusgabenRow = { produkt_id: string; sales_plattform_id: string; leistungsdatum: string; betrag_brutto: number; kategorie_id: string; gruppe_id: string | null; relevanz: string }

  for (const row of (umsatzResult.data ?? []) as UmsatzRow[]) {
    if (!row.produkt_id || !row.sales_plattform_id) continue
    if (bruttoIds.has(row.kategorie_id)) {
      addValue('bruttoumsatz', row.produkt_id, row.sales_plattform_id, row.leistungsdatum, Number(row.betrag))
    } else if (rabatteIds.has(row.kategorie_id)) {
      addValue('rabatte', row.produkt_id, row.sales_plattform_id, row.leistungsdatum, Number(row.betrag))
    } else if (rueckIds.has(row.kategorie_id)) {
      addValue('rueckerstattungen', row.produkt_id, row.sales_plattform_id, row.leistungsdatum, Number(row.betrag))
    }
  }

  for (const row of (ausgabenResult.data ?? []) as AusgabenRow[]) {
    if (!row.produkt_id) continue
    const gruppeId = row.gruppe_id ?? ''
    const isMkt = marketingIds.has(row.kategorie_id) || marketingIds.has(gruppeId)
    if (!row.sales_plattform_id && !isMkt) continue
    if (vkGebIds.has(row.kategorie_id) || vkGebIds.has(gruppeId)) {
      addValue('verkaufsgebuehr', row.produkt_id, row.sales_plattform_id!, row.leistungsdatum, Number(row.betrag_brutto))
    } else if (retourenIds.has(row.kategorie_id) || retourenIds.has(gruppeId)) {
      if (row.relevanz === 'rentabilitaet') {
        addValue('retouren', row.produkt_id, row.sales_plattform_id!, row.leistungsdatum, Number(row.betrag_brutto))
      }
    } else if (isMkt) {
      // Group marketing by Untergruppe (level-2 category), not by sales platform
      const rawId = marketingIds.has(gruppeId) ? gruppeId : row.kategorie_id
      const mktKatId = toUntergruppe.get(rawId) ?? rawId
      addValue('marketing', row.produkt_id, mktKatId, row.leistungsdatum, Number(row.betrag_brutto))
    }
  }

  // 6. Flatten to array
  const results = []
  for (const [key, wert] of aggMap) {
    const [kategorie, produkt_id, sales_plattform_id, kw_year_str, kw_number_str] = key.split(':')
    results.push({
      kategorie,
      produkt_id,
      sales_plattform_id,
      kw_year: parseInt(kw_year_str),
      kw_number: parseInt(kw_number_str),
      wert: Math.round(wert * 100) / 100,
    })
  }

  return NextResponse.json(results)
}
