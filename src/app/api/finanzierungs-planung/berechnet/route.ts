import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

// ─── ISO week helpers ──────────────────────────────────────────────────────────

function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000)
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000)
}

function getISOWeekInfo(d: Date): { year: number; week: number } {
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (4 - (d.getUTCDay() || 7))))
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: thu.getUTCFullYear(), week }
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000)
}

function skipWeekend(d: Date): Date {
  const day = d.getUTCDay()
  if (day === 6) return addDays(d, 2)
  if (day === 0) return addDays(d, 1)
  return d
}

function getBaseDay(zeitpunkt: string): number {
  if (zeitpunkt === 'anfang') return 4
  if (zeitpunkt === 'mitte') return 15
  return 26 // 'ende'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vonKw = parseInt(searchParams.get('von_kw') ?? '', 10)
  const vonJahr = parseInt(searchParams.get('von_jahr') ?? '', 10)
  const bisKw = parseInt(searchParams.get('bis_kw') ?? '', 10)
  const bisJahr = parseInt(searchParams.get('bis_jahr') ?? '', 10)
  const ersteZukunftKw = parseInt(searchParams.get('erste_zukunftskw') ?? '', 10)
  const ersteZukunftJahr = parseInt(searchParams.get('erste_zukunftsjahr') ?? '', 10)
  const hatZukunftsgrenze = !isNaN(ersteZukunftKw) && !isNaN(ersteZukunftJahr)
  const zukunftsGrenzeIdx = hatZukunftsgrenze ? ersteZukunftJahr * 54 + ersteZukunftKw : 0

  if ([vonKw, vonJahr, bisKw, bisJahr].some(n => isNaN(n))) {
    return NextResponse.json(
      { error: 'von_kw, von_jahr, bis_kw, bis_jahr sind erforderlich' },
      { status: 400 },
    )
  }

  const { data: einstellungen, error: dbErr } = await supabase
    .from('finanzierungs_einstellungen')
    .select(
      'kategorie_id, zahlungsfrequenz, faelligkeits_monate, zeitpunkt_im_monat, bruttobetrag, aktiv_von, aktiv_bis, zahlungsziel_tage',
    )
    .eq('user_id', user!.id)
    .eq('aktiv', true)
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const firstMonday = getISOWeekMonday(vonJahr, vonKw)
  const lastMonday = getISOWeekMonday(bisJahr, bisKw)

  const result = new Map<
    string,
    { kategorie_id: string; kw_year: number; kw_number: number; wert: number }
  >()

  for (const eintrag of einstellungen ?? []) {
    const kategorie_id = eintrag.kategorie_id as string
    const zahlungszielTage = (eintrag.zahlungsziel_tage as number | null) ?? 0
    const bruttobetrag = Number(eintrag.bruttobetrag)
    const baseDay = getBaseDay(eintrag.zeitpunkt_im_monat as string)

    const paymentMonths: number[] =
      (eintrag.zahlungsfrequenz as string) === 'monatlich'
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : ((eintrag.faelligkeits_monate as number[]) ?? [])

    for (let year = vonJahr - 1; year <= bisJahr + 1; year++) {
      for (const month of paymentMonths) {
        const baseDate = new Date(Date.UTC(year, month - 1, baseDay))

        if (eintrag.aktiv_von && baseDate < new Date(eintrag.aktiv_von as string)) continue
        if (eintrag.aktiv_bis && baseDate > new Date(eintrag.aktiv_bis as string)) continue

        const paymentDate = skipWeekend(addDays(baseDate, zahlungszielTage))
        const { year: kwYear, week: kwNumber } = getISOWeekInfo(paymentDate)

        const paymentMonday = getISOWeekMonday(kwYear, kwNumber)
        if (paymentMonday < firstMonday || paymentMonday > lastMonday) continue

        const key = `${kategorie_id}:${kwYear}:${kwNumber}`
        if (!result.has(key)) {
          result.set(key, { kategorie_id, kw_year: kwYear, kw_number: kwNumber, wert: 0 })
        }
        result.get(key)!.wert += bruttobetrag
      }
    }
  }

  const data = [...result.values()].map(r => ({
    kategorie_id: r.kategorie_id,
    kw_year: r.kw_year,
    kw_number: r.kw_number,
    wert: Math.round(r.wert * 100) / 100,
  }))

  // Persist future-week Soll values as ist_berechnet=true (Ist-Plan anchor)
  if (hatZukunftsgrenze) {
    const now = new Date().toISOString()
    const saveRows: Array<{
      user_id: string; kategorie_id: string; kw_year: number; kw_number: number
      betrag_manuell: number; ist_berechnet: boolean; updated_at: string
    }> = []

    for (const r of result.values()) {
      if (r.kw_year * 54 + r.kw_number < zukunftsGrenzeIdx) continue
      saveRows.push({
        user_id: user!.id,
        kategorie_id: r.kategorie_id,
        kw_year: r.kw_year,
        kw_number: r.kw_number,
        betrag_manuell: Math.round(r.wert * 100) / 100,
        ist_berechnet: true,
        updated_at: now,
      })
    }

    const { data: existingRows } = await supabase
      .from('finanzierungs_planung')
      .select('kategorie_id, kw_year, kw_number, ist_berechnet')
      .eq('user_id', user!.id)
      .or(`kw_year.gt.${ersteZukunftJahr},and(kw_year.eq.${ersteZukunftJahr},kw_number.gte.${ersteZukunftKw})`)
      .limit(5000)

    const manualKeys = new Set<string>()
    for (const r of existingRows ?? []) {
      if (r.ist_berechnet === false) {
        manualKeys.add(`${r.kategorie_id}:${r.kw_year}:${r.kw_number}`)
      }
    }

    // Delete stale auto-calc future rows, then insert fresh ones
    await supabase.from('finanzierungs_planung')
      .delete()
      .eq('user_id', user!.id)
      .eq('ist_berechnet', true)
      .or(`kw_year.gt.${ersteZukunftJahr},and(kw_year.eq.${ersteZukunftJahr},kw_number.gte.${ersteZukunftKw})`)

    const toUpsert = saveRows.filter(
      r => !manualKeys.has(`${r.kategorie_id}:${r.kw_year}:${r.kw_number}`)
    )
    if (toUpsert.length > 0) {
      await supabase.from('finanzierungs_planung').upsert(toUpsert, {
        onConflict: 'user_id,kategorie_id,kw_year,kw_number',
        ignoreDuplicates: false,
      })
    }
  }

  return NextResponse.json({ data })
}
