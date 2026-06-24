import type { requireAuth } from '@/lib/supabase-server'

// PROJ-101: Lazy-Seeding der drei FESTEN Kapitalbedarf-Zeilen je Planversion.
// Beim ersten Öffnen einer Version werden „Investitionen", „Betriebsmittelbedarf"
// und „Liquiditätsreserve" einmalig materialisiert (is_system=true). Dadurch lassen
// sie sich frei zwischen den manuellen Zeilen verschieben und tragen ihren eigenen
// Override-/Reihenfolge-Zustand — ohne Sonderbehandlung beim Sortieren. Idempotent:
// fehlende feste Zeilen werden ergänzt, vorhandene bleiben unberührt.
//
// Die AUTO-Werte selbst (Gesamtinvestition, negativster Kontostand) werden NICHT
// gespeichert — `betrag` ist hier ein optionaler Override (NULL = Auto-Wert nutzen).

type AuthedSupabase = Awaited<ReturnType<typeof requireAuth>>['supabase']

export type FesteZeilenArt = 'investitionen' | 'betriebsmittelbedarf' | 'liquiditaetsreserve'

// Reihenfolge + Code-Bezeichnung der drei festen Zeilen (sort_order 0,1,2).
export const FESTE_KAPITALBEDARF_ZEILEN: { zeilen_art: FesteZeilenArt; bezeichnung: string }[] = [
  { zeilen_art: 'investitionen', bezeichnung: 'Investitionen' },
  { zeilen_art: 'betriebsmittelbedarf', bezeichnung: 'Betriebsmittelbedarf' },
  { zeilen_art: 'liquiditaetsreserve', bezeichnung: 'Liquiditätsreserve' },
]

/**
 * Stellt sicher, dass die drei festen Kapitalbedarf-Zeilen für die angegebene
 * Version existieren. Idempotent — fehlende werden ergänzt, vorhandene bleiben.
 */
export async function ensureKapitalbedarfFinanzierungSeed(
  supabase: AuthedSupabase,
  userId: string,
  versionId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('langfristige_kapitalbedarf_finanzierung')
    .select('zeilen_art')
    .eq('user_id', userId)
    .eq('plan_version_id', versionId)
    .eq('bereich', 'kapitalbedarf')
    .neq('zeilen_art', 'manuell')
    .limit(10)

  const vorhanden = new Set((existing ?? []).map(r => r.zeilen_art as string))
  const fehlend = FESTE_KAPITALBEDARF_ZEILEN.filter(z => !vorhanden.has(z.zeilen_art))
  if (fehlend.length === 0) return

  const rows = fehlend.map(z => ({
    user_id: userId,
    plan_version_id: versionId,
    bereich: 'kapitalbedarf',
    zeilen_art: z.zeilen_art,
    bezeichnung: z.bezeichnung,
    betrag: null,
    sort_order: FESTE_KAPITALBEDARF_ZEILEN.findIndex(f => f.zeilen_art === z.zeilen_art),
    is_system: true,
  }))

  // Plain insert der fehlenden festen Zeilen. Der partielle Unique-Index
  // (plan_version_id, zeilen_art WHERE zeilen_art <> 'manuell') schützt vor echten
  // Duplikaten; eine seltene Race-Bedingung paralleler Erstaufrufe würde dort einen
  // Duplicate-Key-Fehler erzeugen, der hier bewusst ignoriert wird (Zeile existiert dann bereits).
  await supabase.from('langfristige_kapitalbedarf_finanzierung').insert(rows)
}
