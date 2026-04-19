import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'
import { NavSheet } from '@/components/nav-sheet'

export default async function DashboardPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
              <NavSheet />
              <h1 className="text-lg font-semibold">Controlling App</h1>
            </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Datenpflege</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="/dashboard/kpi-modell"
              className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
            >
              <p className="font-medium">KPI-Modell Verwaltung</p>
              <p className="text-sm text-muted-foreground mt-1">Kategorie-Hierarchien pflegen</p>
            </a>
            <a
              href="/dashboard/einnahmen"
              className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
            >
              <p className="font-medium">Einnahmen</p>
              <p className="text-sm text-muted-foreground mt-1">Zahlungseingänge erfassen</p>
            </a>
            <a
              href="/dashboard/umsatz"
              className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
            >
              <p className="font-medium">Umsatz</p>
              <p className="text-sm text-muted-foreground mt-1">Erlöse / Leistungen erfassen</p>
            </a>
            <a
              href="/dashboard/ausgaben"
              className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
            >
              <p className="font-medium">Ausgaben & Kosten</p>
              <p className="text-sm text-muted-foreground mt-1">Ausgaben und Kosten erfassen</p>
            </a>
          </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Auswertungen</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="/dashboard/rentabilitaet"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Rentabilität</p>
                <p className="text-sm text-muted-foreground mt-1">Umsatz &amp; Kosten Übersicht</p>
              </a>
              <a
                href="/dashboard/liquiditaet"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Liquidität</p>
                <p className="text-sm text-muted-foreground mt-1">Einnahmen &amp; Ausgaben Übersicht</p>
              </a>
              <a
                href="/dashboard/abschreibungen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Abschreibungen</p>
                <p className="text-sm text-muted-foreground mt-1">Monatliche Abschreibungsraten</p>
              </a>
              <a
                href="/dashboard/investitionen"
                className="rounded-lg border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">Investitionen</p>
                <p className="text-sm text-muted-foreground mt-1">Produktinvestitionen auf 12 Monate verteilt</p>
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
