import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// ─── Schema ───────────────────────────────────────────────────────────────────

const querySchema = z.object({
  vor_jahr: z.coerce.number().int().min(2000).max(2100),
  vor_kw: z.coerce.number().int().min(1).max(53),
})

// Monday (start) of the given ISO week, as YYYY-MM-DD (UTC).
function mondayOfISOWeek(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dow - 1) * 86_400_000)
  const monday = new Date(monday1.getTime() + (week - 1) * 7 * 86_400_000)
  return monday.toISOString().slice(0, 10)
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── GET Handler ────────────────────────────────────────────────────────────
//
// Computes the opening account balance ("Anfangsbestand") for the
// Liquiditätsauswertung: the sum of all actual income transactions minus all
// liquidity-relevant actual expense transactions whose Zahlungsdatum lies
// BEFORE the start (Monday) of the first displayed past week.
//
// Identical accounting logic to PROJ-29 (/api/reporting/liquiditaet).

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    vor_jahr: searchParams.get('vor_jahr'),
    vor_kw: searchParams.get('vor_kw'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const cutoff = mondayOfISOWeek(parsed.data.vor_jahr, parsed.data.vor_kw)

  // Sum all income before the window start
  const einnahmenRes = await (async (): Promise<{ sum: number; error: unknown }> => {
    const PAGE = 1000
    let sum = 0
    let from = 0
    for (;;) {
      const { data, error: dbErr } = await supabase
        .from('einnahmen_transaktionen')
        .select('betrag')
        .lt('zahlungsdatum', cutoff)
        .range(from, from + PAGE - 1)
      if (dbErr) return { sum: 0, error: dbErr }
      for (const r of data ?? []) sum += Number((r as { betrag: number }).betrag)
      if (!data || data.length < PAGE) return { sum, error: null }
      from += PAGE
    }
  })()
  if (einnahmenRes.error) {
    return NextResponse.json({ error: (einnahmenRes.error as { message?: string }).message ?? 'DB-Fehler' }, { status: 500 })
  }

  // Sum all liquidity-relevant expenses before the window start
  const ausgabenRes = await (async (): Promise<{ sum: number; error: unknown }> => {
    const PAGE = 1000
    let sum = 0
    let from = 0
    for (;;) {
      const { data, error: dbErr } = await supabase
        .from('ausgaben_kosten_transaktionen')
        .select('betrag_brutto')
        .not('zahlungsdatum', 'is', null)
        .in('relevanz', ['liquiditaet', 'beides'])
        .lt('zahlungsdatum', cutoff)
        .range(from, from + PAGE - 1)
      if (dbErr) return { sum: 0, error: dbErr }
      for (const r of data ?? []) sum += Number((r as { betrag_brutto: number }).betrag_brutto)
      if (!data || data.length < PAGE) return { sum, error: null }
      from += PAGE
    }
  })()
  if (ausgabenRes.error) {
    return NextResponse.json({ error: (ausgabenRes.error as { message?: string }).message ?? 'DB-Fehler' }, { status: 500 })
  }

  const anfangsbestand = roundTo2(einnahmenRes.sum - ausgabenRes.sum)

  return NextResponse.json({ anfangsbestand, stichtag: cutoff })
}
