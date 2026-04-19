import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

const PAGE_SIZE = 50
const MONATE = 12

interface InvestitionsRate {
  datum: string          // YYYY-MM-DD, berechnetes Ratendatum
  ursprung_datum: string // YYYY-MM-DD, Leistungsdatum der Ursprungstransaktion
  gruppe_id: string | null
  untergruppe_id: string | null
  beschreibung: string | null
  betrag: number
}

function addMonthsWithClamp(ursprung: string, offset: number): string {
  const [yStr, mStr, dStr] = ursprung.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10) - 1 // 0-basiert
  const d = parseInt(dStr, 10)

  const zielJahr = y + Math.floor((m + offset) / 12)
  const zielMonat = ((m + offset) % 12 + 12) % 12 // 0-basiert

  const letzterTag = new Date(zielJahr, zielMonat + 1, 0).getDate()
  const tag = Math.min(d, letzterTag)

  const mm = String(zielMonat + 1).padStart(2, '0')
  const dd = String(tag).padStart(2, '0')
  return `${zielJahr}-${mm}-${dd}`
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page         = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const sortColumn   = searchParams.get('sortColumn') === 'betrag' ? 'betrag' : 'datum'
  const sortAsc      = (searchParams.get('sortDirection') ?? 'asc') === 'asc'

  const von           = searchParams.get('von')
  const bis           = searchParams.get('bis')
  const gruppeIds     = searchParams.get('gruppe_ids')?.split(',').filter(Boolean) ?? []
  const untergruppeIds = searchParams.get('untergruppe_ids')?.split(',').filter(Boolean) ?? []

  // ─── Kategorie-ID für "Produktinvestitionen" ermitteln ───────────────────
  const { data: katData, error: katError } = await supabase
    .from('kpi_categories')
    .select('id')
    .eq('name', 'Produktinvestitionen')
    .eq('level', 1)

  if (katError) return NextResponse.json({ error: katError.message }, { status: 500 })

  const produktinvestitionenId = (katData as Array<{ id: string }>)?.[0]?.id ?? null

  if (!produktinvestitionenId) {
    return NextResponse.json({ data: [], total: 0, totalBetrag: 0 })
  }

  // ─── Transaktionen dieser Kategorie laden ────────────────────────────────
  const { data: transaktionen, error: dbError } = await supabase
    .from('ausgaben_kosten_transaktionen')
    .select('id, leistungsdatum, betrag_netto, gruppe_id, untergruppe_id, beschreibung')
    .eq('kategorie_id', produktinvestitionenId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // ─── 12 Monatsraten pro Transaktion berechnen ────────────────────────────
  const alleRaten: InvestitionsRate[] = []

  for (const row of transaktionen ?? []) {
    const leistungsdatum = row.leistungsdatum as string | null
    if (!leistungsdatum) continue

    const betragNetto = Number(row.betrag_netto ?? 0)
    if (betragNetto === 0) continue

    const baseRate = roundTo2(betragNetto / MONATE)
    const letzte   = roundTo2(betragNetto - baseRate * (MONATE - 1))

    for (let i = 0; i < MONATE; i++) {
      alleRaten.push({
        datum:          addMonthsWithClamp(leistungsdatum, i),
        ursprung_datum: leistungsdatum,
        gruppe_id:      row.gruppe_id ?? null,
        untergruppe_id: row.untergruppe_id ?? null,
        beschreibung:   row.beschreibung ?? null,
        betrag:         i === MONATE - 1 ? letzte : baseRate,
      })
    }
  }

  // ─── Filtern nach von/bis und Gruppen-Kaskade ────────────────────────────
  const gefiltert = alleRaten.filter(rate => {
    if (von && rate.datum < von) return false
    if (bis && rate.datum > bis) return false
    if (gruppeIds.length > 0) {
      if (!rate.gruppe_id || !gruppeIds.includes(rate.gruppe_id)) return false
    }
    if (untergruppeIds.length > 0) {
      if (!rate.untergruppe_id || !untergruppeIds.includes(rate.untergruppe_id)) return false
    }
    return true
  })

  // ─── totalBetrag über alle gefilterten Raten (vor Paginierung) ───────────
  const totalBetrag = roundTo2(gefiltert.reduce((acc, r) => acc + r.betrag, 0))

  // ─── Sortieren ───────────────────────────────────────────────────────────
  gefiltert.sort((a, b) => {
    let cmp = 0
    if (sortColumn === 'betrag') {
      cmp = a.betrag - b.betrag
    } else {
      if (a.datum < b.datum) cmp = -1
      else if (a.datum > b.datum) cmp = 1
    }
    return sortAsc ? cmp : -cmp
  })

  // ─── Paginieren ──────────────────────────────────────────────────────────
  const fromIdx   = (page - 1) * PAGE_SIZE
  const paginated = gefiltert.slice(fromIdx, fromIdx + PAGE_SIZE)

  return NextResponse.json({
    data:        paginated,
    total:       gefiltert.length,
    totalBetrag,
  })
}
