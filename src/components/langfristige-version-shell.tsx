'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { NavSheet } from '@/components/nav-sheet'
import { LogoutButton } from '@/components/logout-button'
import { Toaster } from '@/components/ui/toaster'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { LANGFRISTIGE_PLANUNG_BASE } from '@/lib/langfristige-planung-nav'
import type { Planversion } from '@/hooks/use-planversionen'

interface LangfristigeVersionShellProps {
  /** Untertitel der aktuellen Seite (z.B. "Grundeinstellungen"). */
  seitenTitel?: string
  /** Wenn true, nutzt der Inhalt die volle Seitenbreite (statt max-w-7xl) — z.B. für breite Planungstabellen. */
  fullWidth?: boolean
  children: ReactNode | ((version: Planversion) => ReactNode)
}

type Status = 'loading' | 'ok' | 'notfound'

// Gemeinsames Gerüst für alle Seiten innerhalb einer Planversion.
// Lädt die Version anhand der URL, validiert die Zugehörigkeit (serverseitig per
// API) und leitet bei unbekannter/fremder Version zurück zum Dashboard.
export function LangfristigeVersionShell({ seitenTitel, fullWidth = false, children }: LangfristigeVersionShellProps) {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  const [status, setStatus] = useState<Status>('loading')
  const [version, setVersion] = useState<Planversion | null>(null)

  useEffect(() => {
    if (!versionId) return
    let aktiv = true
    setStatus('loading')
    fetch(`/api/langfristige-planung/planversionen/${versionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then((data: Planversion) => {
        if (!aktiv) return
        setVersion(data)
        setStatus('ok')
      })
      .catch(() => {
        if (!aktiv) return
        setStatus('notfound')
      })
    return () => {
      aktiv = false
    }
  }, [versionId])

  // Bei nicht gefundener/fremder Version zurück zum Dashboard
  useEffect(() => {
    if (status === 'notfound') {
      toast({
        title: 'Planversion nicht gefunden',
        description: 'Die Planversion existiert nicht (mehr). Du wurdest zum Dashboard geleitet.',
        variant: 'destructive',
      })
      router.replace(LANGFRISTIGE_PLANUNG_BASE)
    }
  }, [status, router, toast])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <NavSheet />
            <h1 className="flex min-w-0 items-center gap-1.5 text-lg font-semibold">
              <span className="shrink-0 text-muted-foreground">Langfristige Planung</span>
              {version && (
                <>
                  <span className="shrink-0 text-muted-foreground">/</span>
                  <span className="truncate" title={version.name}>
                    {version.name}
                  </span>
                </>
              )}
              {seitenTitel && (
                <>
                  <span className="shrink-0 text-muted-foreground">/</span>
                  <span className="shrink-0">{seitenTitel}</span>
                </>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className={`mx-auto space-y-8 ${fullWidth ? 'max-w-none' : 'max-w-7xl'}`}>
          {status === 'loading' && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          {status === 'ok' && version && (
            <>{typeof children === 'function' ? children(version) : children}</>
          )}
        </div>
      </main>
      <Toaster />
    </div>
  )
}
