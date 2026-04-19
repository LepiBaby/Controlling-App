import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

const PAGE_SIZE = 50

type Quelle = 'einnahmen' | 'ausgaben'

interface LiquiditaetZeile {
  id: string
  quelle: Quelle
  zahlungsdatum: string
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
  const sortColumn    = searchParams.get('sortColumn') === 'betrag' ? 'betrag' : 'zahlungsdatum'
  const sortAsc       = searchParams.get('sortDirection') === 'asc'

  const von               = searchParams.get('von')
  const bis               = searchParams.get('bis')
  const quelleParam       = searchParams.get('quelle')?.split(',').filter(Boolean) ?? []
  const kategorieIds      = searchParams.get('kategorie_ids')?.split(',').filter(Boolean) ?? []
  const gruppeIds         = searchParams.get('gruppe_ids')?.split(',').filter(Boolean) ?? []
  const untergruppeIds    = searchParams.get('untergruppe_ids')?.split(',').filter(Boolean) ?? []
  const salesPlattformIds = searchParams.get('sales_plattform_ids')?.split(',').filter(Boolean) ?? []
  const produktIds        = searchParams.get('produkt_ids')?.split(',').filter(Boolean) ?? []

  const includeEinnahmen = quelleParam.length === 0 || quelleParam.includes('einnahmen')
  const includeAusgaben  = quelleParam.length === 0 || quelleParam.includes('ausgaben')

  const merged: LiquiditaetZeile[] = []

  // ─── Einnahmen-Transaktionen ─────────────────────────────────────────────
  if (includeEinnahmen) {
    let einnahmenQuery = supabase
      .from('einnahmen_transaktionen')
      .select('id, zahlungsdatum, betrag, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id, beschreibung')

    if (von)                      einnahmenQuery = einnahmenQuery.gte('zahlungsdatum', von)
    if (bis)                      einnahmenQuery = einnahmenQuery.lte('zahlungsdatum', bis)
    if (kategorieIds.length)      einnahmenQuery = einnahmenQuery.in('kategorie_id', kategorieIds)
    if (gruppeIds.length)         einnahmenQuery = einnahmenQuery.in('gruppe_id', gruppeIds)
    if (untergruppeIds.length)    einnahmenQuery = einnahmenQuery.in('untergruppe_id', untergruppeIds)
    if (salesPlattformIds.length) einnahmenQuery = einnahmenQuery.in('sales_plattform_id', salesPlattformIds)
    if (produktIds.length)        einnahmenQuery = einnahmenQuery.in('produkt_id', produktIds)

    const { data: einnahmenData, error: einnahmenError } = await einnahmenQuery
    if (einnahmenError) return NextResponse.json({ error: einnahmenError.message }, { status: 500 })

    for (const row of einnahmenData ?? []) {
      merged.push({
        id:                 row.id,
        quelle:             'einnahmen',
        zahlungsdatum:      row.zahlungsdatum,
        betrag:             Number(row.betrag),
        kategorie_id:       row.kategorie_id ?? null,
        gruppe_id:          row.gruppe_id ?? null,
        untergruppe_id:     row.untergruppe_id ?? null,
        sales_plattform_id: row.sales_plattform_id ?? null,
        produkt_id:         row.produkt_id ?? null,
        beschreibung:       row.beschreibung ?? null,
      })
    }
  }

  // ─── Ausgaben & Kosten-Transaktionen (only those with zahlungsdatum) ─────
  if (includeAusgaben) {
    let ausgabenQuery = supabase
      .from('ausgaben_kosten_transaktionen')
      .select('id, zahlungsdatum, betrag_brutto, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id, beschreibung')
      .not('zahlungsdatum', 'is', null)

    if (von)                      ausgabenQuery = ausgabenQuery.gte('zahlungsdatum', von)
    if (bis)                      ausgabenQuery = ausgabenQuery.lte('zahlungsdatum', bis)
    if (kategorieIds.length)      ausgabenQuery = ausgabenQuery.in('kategorie_id', kategorieIds)
    if (gruppeIds.length)         ausgabenQuery = ausgabenQuery.in('gruppe_id', gruppeIds)
    if (untergruppeIds.length)    ausgabenQuery = ausgabenQuery.in('untergruppe_id', untergruppeIds)
    if (salesPlattformIds.length) ausgabenQuery = ausgabenQuery.in('sales_plattform_id', salesPlattformIds)
    if (produktIds.length)        ausgabenQuery = ausgabenQuery.in('produkt_id', produktIds)

    const { data: ausgabenData, error: ausgabenError } = await ausgabenQuery
    if (ausgabenError) return NextResponse.json({ error: ausgabenError.message }, { status: 500 })

    for (const row of ausgabenData ?? []) {
      merged.push({
        id:                 row.id,
        quelle:             'ausgaben',
        zahlungsdatum:      row.zahlungsdatum,
        betrag:             -Number(row.betrag_brutto),
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
      if (a.zahlungsdatum < b.zahlungsdatum) cmp = -1
      else if (a.zahlungsdatum > b.zahlungsdatum) cmp = 1
      else cmp = 0
    }
    return sortAsc ? cmp : -cmp
  })

  // ─── totalNettoCashflow across ALL merged rows (before pagination) ──────
  const totalNettoCashflow = Math.round(
    merged.reduce((acc, row) => acc + row.betrag, 0) * 100
  ) / 100

  // ─── Paginate the sorted merged array ────────────────────────────────────
  const fromIdx = (page - 1) * PAGE_SIZE
  const toIdx   = fromIdx + PAGE_SIZE
  const paginated = merged.slice(fromIdx, toIdx)

  return NextResponse.json({
    data:                paginated,
    total:               merged.length,
    totalNettoCashflow,
  })
}
