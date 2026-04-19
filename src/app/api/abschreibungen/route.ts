import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

const PAGE_SIZE = 50

// Abschreibungszeitraum → Anzahl Monatsraten
const ABSCHREIBUNG_MONATE: Record<string, number> = {
  '3_jahre': 36,
  '5_jahre': 60,
  '7_jahre': 84,
  '10_jahre': 120,
}

interface AbschreibungsRate {
  datum: string          // YYYY-MM-DD, berechnetes Ratendatum
  ursprung_datum: string // YYYY-MM-DD, Leistungsdatum der Ursprungstransaktion
  kategorie_id: string | null
  gruppe_id: string | null
  untergruppe_id: string | null
  beschreibung: string | null
  betrag: number
}

/**
 * Berechnet das Ratendatum für den gegebenen Monats-Offset ab dem Ursprungsdatum.
 * Monatsgrenzen-Clamp: Falls der Tag im Zielmonat nicht existiert (z.B. 31.01 → 28.02),
 * wird der letzte gültige Tag des Zielmonats verwendet.
 */
function addMonthsWithClamp(ursprung: string, offset: number): string {
  const [yStr, mStr, dStr] = ursprung.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10) - 1 // 0-basiert
  const d = parseInt(dStr, 10)

  // Zielmonat berechnen (Jahr-Overflow wird von Date automatisch behandelt)
  const zielJahr = y + Math.floor((m + offset) / 12)
  const zielMonat = ((m + offset) % 12 + 12) % 12 // 0-basiert, immer positiv

  // Letzter Tag des Zielmonats: new Date(y, m+1, 0) gibt letzten Tag von Monat m
  const letzterTag = new Date(zielJahr, zielMonat + 1, 0).getDate()
  const tag = Math.min(d, letzterTag)

  const mm = String(zielMonat + 1).padStart(2, '0')
  const dd = String(tag).padStart(2, '0')
  return `${zielJahr}-${mm}-${dd}`
}

/**
 * Rundet kaufmännisch auf 2 Dezimalstellen.
 */
function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page          = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const sortColumn    = searchParams.get('sortColumn') === 'betrag' ? 'betrag' : 'datum'
  const sortAsc       = (searchParams.get('sortDirection') ?? 'asc') === 'asc'

  const von             = searchParams.get('von')
  const bis             = searchParams.get('bis')
  const kategorieIds    = searchParams.get('kategorie_ids')?.split(',').filter(Boolean) ?? []
  const gruppeIds       = searchParams.get('gruppe_ids')?.split(',').filter(Boolean) ?? []
  const untergruppeIds  = searchParams.get('untergruppe_ids')?.split(',').filter(Boolean) ?? []

  // ─── Ursprungstransaktionen mit Abschreibung laden ───────────────────────
  const { data: transaktionen, error: dbError } = await supabase
    .from('ausgaben_kosten_transaktionen')
    .select('id, leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id, beschreibung, abschreibung')
    .not('abschreibung', 'is', null)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // ─── Alle Raten berechnen ────────────────────────────────────────────────
  const alleRaten: AbschreibungsRate[] = []

  for (const row of transaktionen ?? []) {
    const abschreibung = row.abschreibung as string | null
    if (!abschreibung) continue

    const monate = ABSCHREIBUNG_MONATE[abschreibung]
    if (!monate) continue

    const leistungsdatum = row.leistungsdatum as string | null
    if (!leistungsdatum) continue

    const betragNetto = Number(row.betrag_netto ?? 0)
    // Edge Case: betrag_netto = 0 → keine Raten erzeugen (keine Aussagekraft)
    if (betragNetto === 0) continue

    const baseRate  = roundTo2(betragNetto / monate)
    const letzte    = roundTo2(betragNetto - baseRate * (monate - 1))

    for (let i = 0; i < monate; i++) {
      const betrag = i === monate - 1 ? letzte : baseRate
      alleRaten.push({
        datum:            addMonthsWithClamp(leistungsdatum, i),
        ursprung_datum:   leistungsdatum,
        kategorie_id:     row.kategorie_id ?? null,
        gruppe_id:        row.gruppe_id ?? null,
        untergruppe_id:   row.untergruppe_id ?? null,
        beschreibung:     row.beschreibung ?? null,
        betrag,
      })
    }
  }

  // ─── Filtern nach von/bis (Ratendatum) und Kategorien-Kaskade ────────────
  const gefiltert = alleRaten.filter(rate => {
    if (von && rate.datum < von) return false
    if (bis && rate.datum > bis) return false
    if (kategorieIds.length > 0) {
      if (!rate.kategorie_id || !kategorieIds.includes(rate.kategorie_id)) return false
    }
    if (gruppeIds.length > 0) {
      if (!rate.gruppe_id || !gruppeIds.includes(rate.gruppe_id)) return false
    }
    if (untergruppeIds.length > 0) {
      if (!rate.untergruppe_id || !untergruppeIds.includes(rate.untergruppe_id)) return false
    }
    return true
  })

  // ─── totalBetrag über alle gefilterten Raten (vor Paginierung) ───────────
  const totalBetrag = roundTo2(
    gefiltert.reduce((acc, r) => acc + r.betrag, 0)
  )

  // ─── Sortieren ───────────────────────────────────────────────────────────
  gefiltert.sort((a, b) => {
    let cmp = 0
    if (sortColumn === 'betrag') {
      cmp = a.betrag - b.betrag
    } else {
      // datum (ISO-String YYYY-MM-DD → lexikografische Sortierung = chronologisch)
      if (a.datum < b.datum) cmp = -1
      else if (a.datum > b.datum) cmp = 1
      else cmp = 0
    }
    return sortAsc ? cmp : -cmp
  })

  // ─── Paginieren ──────────────────────────────────────────────────────────
  const fromIdx   = (page - 1) * PAGE_SIZE
  const toIdx     = fromIdx + PAGE_SIZE
  const paginated = gefiltert.slice(fromIdx, toIdx)

  return NextResponse.json({
    data:        paginated,
    total:       gefiltert.length,
    totalBetrag,
  })
}
