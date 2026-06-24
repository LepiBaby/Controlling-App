import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // In Next.js route handlers, cookie setting can fail when called
            // from within a Supabase token-refresh callback. Swallow the error
            // so the handler can continue with the (still-valid) session.
          }
        },
      },
    }
  )
}

export async function requireAuth() {
  const supabase = await createSupabaseServerClient()
  // getClaims() verifiziert das ES256-JWT lokal (per WebCrypto, JWKS gecacht) statt
  // bei jedem Request einen GoTrue-Netzwerk-Call (getUser) zu machen → deutlich
  // schneller. getClaims() refresht intern via getSession() ein abgelaufenes Token,
  // loggt also niemanden vorzeitig aus. Die eigentliche Datenisolierung erfolgt
  // ohnehin per RLS in der Datenbank (zweite Verteidigungslinie).
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || !userId) {
    return { user: null, supabase, error: new Response('Unauthorized', { status: 401 }) }
  }
  return { user: { id: userId as string }, supabase, error: null }
}
