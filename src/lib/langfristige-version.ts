import { NextResponse } from 'next/server'
import type { requireAuth } from '@/lib/supabase-server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Prüft, dass die Planversion existiert UND dem eingeloggten Nutzer gehört.
// Liefert eine fertige Fehler-Response (400/404/500) oder null (= ok).
// Gemeinsame Variante des in PROJ-74/76 lokal definierten Helfers, damit die
// versionsgebundenen Produktinformationen-Routen (PROJ-77) sie teilen.
export async function ensureLangfristigeVersion(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  userId: string,
  versionId: string,
): Promise<Response | null> {
  if (!UUID_REGEX.test(versionId)) {
    return NextResponse.json({ error: 'Ungültige Versions-ID' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('langfristige_planversionen')
    .select('id')
    .eq('user_id', userId)
    .eq('id', versionId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Planversion nicht gefunden' }, { status: 404 })
  return null
}
