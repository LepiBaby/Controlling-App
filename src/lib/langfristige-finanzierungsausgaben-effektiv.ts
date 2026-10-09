import { z } from 'zod'
import type { PostgrestError } from '@supabase/supabase-js'
import type { requireAuth } from '@/lib/supabase-server'
import { fetchAllRows } from '@/lib/supabase-paginate'
import { berechneTilgungsplan } from '@/lib/finanzierung-tilgungsplan'

// PROJ-107: Effektive Finanzierungsausgaben einer Planversion = manuell gepflegte
// Werte (langfristige_finanzierungsausgaben_planung) + aus den hinterlegten
// Finanzierungen berechnete Zinsen/Tilgung, summiert je Kategorie × Monat.
// Alle Verbraucher (Auswertungen, Liquidität, Rentabilität, Steuern) lesen hierüber,
// damit Finanzierungen überall wie manuelle Werte auf „Zinsen"/„Tilgung" wirken.

type Supabase = Awaited<ReturnType<typeof requireAuth>>['supabase']

export interface FinanzierungsausgabeRecord {
  kategorie_id: string
  jahr: number
  monat: number
  betrag: number | null
}

export const DARLEHEN_COLS =
  'id, quelle_kbf_id, zinsen_kategorie_id, tilgung_kategorie_id, name, betrag, zinssatz, laufzeit_monate, tilgungsfrei_monate, start_jahr, start_monat, sort_order'

// Eingabe-Schema für POST/PUT der Darlehen-Routen.
export const darlehenSchema = z
  .object({
    quelle_kbf_id: z.string().uuid().nullable().optional(),
    zinsen_kategorie_id: z.string().uuid(),
    tilgung_kategorie_id: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    betrag: z.number().finite().min(0).max(1e12),
    zinssatz: z.number().finite().min(0).max(100),
    laufzeit_monate: z.number().int().min(1).max(1200),
    tilgungsfrei_monate: z.number().int().min(0).max(1199),
    start_jahr: z.number().int().min(2000).max(2100),
    start_monat: z.number().int().min(1).max(12),
  })
  .refine(d => d.tilgungsfrei_monate < d.laufzeit_monate, {
    message: 'Der tilgungsfreie Zeitraum muss kürzer als die Laufzeit sein.',
    path: ['tilgungsfrei_monate'],
  })

export interface DarlehenRow {
  id: string
  quelle_kbf_id: string | null
  zinsen_kategorie_id: string
  tilgung_kategorie_id: string
  name: string
  betrag: number
  zinssatz: number
  laufzeit_monate: number
  tilgungsfrei_monate: number
  start_jahr: number
  start_monat: number
  sort_order: number
}

/** Reine Kombination (unit-testbar): manuelle Werte + Darlehens-Pläne je Kategorie × Monat. */
export function kombiniereFinanzierungsausgaben(
  manuell: FinanzierungsausgabeRecord[],
  darlehen: DarlehenRow[],
): FinanzierungsausgabeRecord[] {
  if (darlehen.length === 0) return manuell
  const map = new Map<string, FinanzierungsausgabeRecord>()
  const add = (kategorie_id: string, jahr: number, monat: number, betrag: number | null) => {
    const k = `${kategorie_id}:${jahr}:${monat}`
    const prev = map.get(k)
    if (!prev) map.set(k, { kategorie_id, jahr, monat, betrag })
    else if (betrag !== null) prev.betrag = Math.round(((prev.betrag ?? 0) + betrag) * 100) / 100
  }
  for (const r of manuell) add(r.kategorie_id, r.jahr, r.monat, r.betrag === null ? null : Number(r.betrag))
  for (const d of darlehen) {
    for (const p of berechneTilgungsplan({
      betrag: Number(d.betrag),
      zinssatz: Number(d.zinssatz),
      laufzeit_monate: d.laufzeit_monate,
      tilgungsfrei_monate: d.tilgungsfrei_monate,
      start_jahr: d.start_jahr,
      start_monat: d.start_monat,
    })) {
      add(d.zinsen_kategorie_id, p.jahr, p.monat, p.zinsen)
      add(d.tilgung_kategorie_id, p.jahr, p.monat, p.tilgung)
    }
  }
  return Array.from(map.values())
}

export async function ladeFinanzierungsausgabenEffektiv(
  supabase: Supabase,
  userId: string,
  versionId: string,
): Promise<{ data: FinanzierungsausgabeRecord[]; error: PostgrestError | null }> {
  const [manuell, darlehen] = await Promise.all([
    fetchAllRows<FinanzierungsausgabeRecord>((from, to) =>
      supabase
        .from('langfristige_finanzierungsausgaben_planung')
        .select('kategorie_id, jahr, monat, betrag')
        .eq('user_id', userId)
        .eq('plan_version_id', versionId)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    supabase
      .from('langfristige_finanzierungsausgaben_darlehen')
      .select(DARLEHEN_COLS)
      .eq('user_id', userId)
      .eq('plan_version_id', versionId)
      .limit(500),
  ])
  if (manuell.error) return { data: [], error: manuell.error }
  if (darlehen.error) return { data: [], error: darlehen.error }
  return {
    data: kombiniereFinanzierungsausgaben(manuell.data ?? [], (darlehen.data ?? []) as DarlehenRow[]),
    error: null,
  }
}
