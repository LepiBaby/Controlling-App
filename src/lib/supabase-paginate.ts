import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Lädt ALLE Zeilen einer Supabase-Abfrage seitenweise.
 *
 * Hintergrund: PostgREST (Supabase) kappt JEDE Antwort hart bei `max-rows`
 * (in diesem Projekt 1000). Ein `.limit(10000)` wird dabei stillschweigend
 * ignoriert — überzählige Zeilen fehlen ohne Fehlermeldung, und ohne explizite
 * Sortierung sind es die zuletzt eingefügten. Das verfälscht jede Auswertung,
 * deren Tabelle größer als 1000 Zeilen werden kann.
 *
 * Nutzung — `makeQuery` muss die Abfrage MIT stabiler Sortierung (z. B.
 * `.order('id')`) und `.range(from, to)` zurückgeben:
 *
 *   const { data, error } = await fetchAllRows<MeineZeile>((from, to) =>
 *     supabase.from('tabelle').select('...').eq('user_id', uid).order('id').range(from, to)
 *   )
 *
 * Bei Tabellen unter `pageSize` Zeilen entsteht genau EIN Request — also kein
 * Mehraufwand gegenüber einer einfachen `.limit()`-Abfrage.
 */
export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1)
    if (error) return { data: all, error }
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < pageSize) break
  }
  return { data: all, error: null }
}
