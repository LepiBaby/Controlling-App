import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

const PAGE_SIZE = 50

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
    let umsatzQuery = supabase
      .from('umsatz_transaktionen')
      .select('id, leistungsdatum, betrag, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id, beschreibung')

    if (von)                      umsatzQuery = umsatzQuery.gte('leistungsdatum', von)
    if (bis)                      umsatzQuery = umsatzQuery.lte('leistungsdatum', bis)
    if (kategorieIds.length)      umsatzQuery = umsatzQuery.in('kategorie_id', kategorieIds)
    if (gruppeIds.length)         umsatzQuery = umsatzQuery.in('gruppe_id', gruppeIds)
    if (untergruppeIds.length)    umsatzQuery = umsatzQuery.in('untergruppe_id', untergruppeIds)
    if (salesPlattformIds.length) umsatzQuery = umsatzQuery.in('sales_plattform_id', salesPlattformIds)
    if (produktIds.length)        umsatzQuery = umsatzQuery.in('produkt_id', produktIds)

    const { data: umsatzData, error: umsatzError } = await umsatzQuery
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
    //   relevant_fuer_rentabilitaet IS NULL OR = 'ja' (i.e. != 'nein', including NULLs)
    // Note: a plain .neq('relevant_fuer_rentabilitaet', 'nein') excludes NULL rows in
    // PostgREST because (col != 'nein') is NULL for NULL — we use .or() instead.
    let kostenQuery = supabase
      .from('ausgaben_kosten_transaktionen')
      .select('id, leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id, beschreibung, relevant_fuer_rentabilitaet, abschreibung')
      .not('leistungsdatum', 'is', null)
      .is('abschreibung', null)
      .or('relevant_fuer_rentabilitaet.is.null,relevant_fuer_rentabilitaet.eq.ja')

    if (von)                      kostenQuery = kostenQuery.gte('leistungsdatum', von)
    if (bis)                      kostenQuery = kostenQuery.lte('leistungsdatum', bis)
    if (kategorieIds.length)      kostenQuery = kostenQuery.in('kategorie_id', kategorieIds)
    if (gruppeIds.length)         kostenQuery = kostenQuery.in('gruppe_id', gruppeIds)
    if (untergruppeIds.length)    kostenQuery = kostenQuery.in('untergruppe_id', untergruppeIds)
    if (salesPlattformIds.length) kostenQuery = kostenQuery.in('sales_plattform_id', salesPlattformIds)
    if (produktIds.length)        kostenQuery = kostenQuery.in('produkt_id', produktIds)

    const { data: kostenData, error: kostenError } = await kostenQuery
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
  const fromIdx = (page - 1) * PAGE_SIZE
  const toIdx   = fromIdx + PAGE_SIZE
  const paginated = merged.slice(fromIdx, toIdx)

  return NextResponse.json({
    data:       paginated,
    total:      merged.length,
    totalNetto,
  })
}
