import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'

type Quelle = 'umsatz' | 'kosten'

interface RentabilitaetZeile {
  id: string
  quelle: Quelle
  leistungsdatum: string
  betrag: number
  kategorie_id: string | null
  gruppe_id: string | null
  untergruppe_id: string | null
  sales_plattform_id: string | null
  produkt_id: string | null
  beschreibung: string | null
}

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page          = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSizeParam  = parseInt(searchParams.get('pageSize') ?? '50', 10)
  const pageSize       = pageSizeParam > 0 ? pageSizeParam : 0
  const sortColumn    = searchParams.get('sortColumn') === 'betrag' ? 'betrag' : 'leistungsdatum'
  const sortAsc       = searchParams.get('sortDirection') === 'asc'

  const von               = searchParams.get('von')
  const bis               = searchParams.get('bis')
  const quelleParam       = searchParams.get('quelle')?.split(',').filter(Boolean) ?? []
  const kategorieIds      = searchParams.get('kategorie_ids')?.split(',').filter(Boolean) ?? []
  const gruppeIds         = searchParams.get('gruppe_ids')?.split(',').filter(Boolean) ?? []
  const untergruppeIds    = searchParams.get('untergruppe_ids')?.split(',').filter(Boolean) ?? []
  const salesPlattformIds = searchParams.get('sales_plattform_ids')?.split(',').filter(Boolean) ?? []
  const produktIds        = searchParams.get('produkt_ids')?.split(',').filter(Boolean) ?? []

  const includeUmsatz = quelleParam.length === 0 || quelleParam.includes('umsatz')
  const includeKosten = quelleParam.length === 0 || quelleParam.includes('kosten')

  const merged: RentabilitaetZeile[] = []

  // ─── Abzugsposten-Kategorien laden (für Umsatz-Vorzeichen-Logik) ─────────
  const abzugspostenIds = new Set<string>()
  if (includeUmsatz) {
    const { data: abzugsCats } = await supabase
      .from('kpi_categories')
      .select('id')
      .eq('type', 'umsatz')
      .eq('ist_abzugsposten', true)
      .eq('level', 1)
    for (const c of abzugsCats ?? []) abzugspostenIds.add(c.id)
  }

  // ─── Umsatz-Transaktionen ────────────────────────────────────────────────
  if (includeUmsatz) {
    const { data: umsatzData, error: umsatzError } = await fetchAllRows((from, to) => {
      let q = supabase
        .from('umsatz_transaktionen')
        .select('id, leistungsdatum, betrag, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id, beschreibung')
      if (von)                      q = q.gte('leistungsdatum', von)
      if (bis)                      q = q.lte('leistungsdatum', bis)
      if (kategorieIds.length)      q = q.in('kategorie_id', kategorieIds)
      if (gruppeIds.length)         q = q.in('gruppe_id', gruppeIds)
      if (untergruppeIds.length)    q = q.in('untergruppe_id', untergruppeIds)
      if (salesPlattformIds.length) q = q.in('sales_plattform_id', salesPlattformIds)
      if (produktIds.length)        q = q.in('produkt_id', produktIds)
      return q.order('id', { ascending: true }).range(from, to)
    })
    if (umsatzError) return NextResponse.json({ error: umsatzError.message }, { status: 500 })

    for (const row of umsatzData ?? []) {
      const isAbzug = row.kategorie_id ? abzugspostenIds.has(row.kategorie_id) : false
      merged.push({
        id:                 row.id,
        quelle:             'umsatz',
        leistungsdatum:     row.leistungsdatum,
        betrag:             isAbzug ? -Number(row.betrag) : Number(row.betrag),
        kategorie_id:       row.kategorie_id ?? null,
        gruppe_id:          row.gruppe_id ?? null,
        untergruppe_id:     row.untergruppe_id ?? null,
        sales_plattform_id: row.sales_plattform_id ?? null,
        produkt_id:         row.produkt_id ?? null,
        beschreibung:       row.beschreibung ?? null,
      })
    }
  }

  // ─── Ausgaben & Kosten-Transaktionen ─────────────────────────────────────
  if (includeKosten) {
    // Always apply:
    //   leistungsdatum IS NOT NULL
    //   abschreibung IS NULL
    //   relevanz IN ('rentabilitaet', 'beides')
    const { data: kostenData, error: kostenError } = await fetchAllRows((from, to) => {
      let q = supabase
        .from('ausgaben_kosten_transaktionen')
        .select('id, leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id, beschreibung, abschreibung')
        .not('leistungsdatum', 'is', null)
        .is('abschreibung', null)
        .in('relevanz', ['rentabilitaet', 'beides'])
      if (von)                      q = q.gte('leistungsdatum', von)
      if (bis)                      q = q.lte('leistungsdatum', bis)
      if (kategorieIds.length)      q = q.in('kategorie_id', kategorieIds)
      if (gruppeIds.length)         q = q.in('gruppe_id', gruppeIds)
      if (untergruppeIds.length)    q = q.in('untergruppe_id', untergruppeIds)
      if (salesPlattformIds.length) q = q.in('sales_plattform_id', salesPlattformIds)
      if (produktIds.length)        q = q.in('produkt_id', produktIds)
      return q.order('id', { ascending: true }).range(from, to)
    })
    if (kostenError) return NextResponse.json({ error: kostenError.message }, { status: 500 })

    for (const row of kostenData ?? []) {
      merged.push({
        id:                 row.id,
        quelle:             'kosten',
        leistungsdatum:     row.leistungsdatum,
        betrag:             -Number(row.betrag_netto),
        kategorie_id:       row.kategorie_id ?? null,
        gruppe_id:          row.gruppe_id ?? null,
        untergruppe_id:     row.untergruppe_id ?? null,
        sales_plattform_id: row.sales_plattform_id ?? null,
        produkt_id:         row.produkt_id ?? null,
        beschreibung:       row.beschreibung ?? null,
      })
    }
  }

  // ─── Sort merged rows ────────────────────────────────────────────────────
  merged.sort((a, b) => {
    let cmp = 0
    if (sortColumn === 'betrag') {
      cmp = a.betrag - b.betrag
    } else {
      // leistungsdatum (ISO date string YYYY-MM-DD → lexical sort == chronological)
      if (a.leistungsdatum < b.leistungsdatum) cmp = -1
      else if (a.leistungsdatum > b.leistungsdatum) cmp = 1
      else cmp = 0
    }
    return sortAsc ? cmp : -cmp
  })

  // ─── totalNetto across ALL merged rows (before pagination) ───────────────
  const totalNetto = Math.round(
    merged.reduce((acc, row) => acc + row.betrag, 0) * 100
  ) / 100

  // ─── Paginate the sorted merged array ────────────────────────────────────
  const fromIdx   = pageSize > 0 ? (page - 1) * pageSize : 0
  const paginated = pageSize > 0 ? merged.slice(fromIdx, fromIdx + pageSize) : merged

  return NextResponse.json({
    data:       paginated,
    total:      merged.length,
    totalNetto,
  })
}
