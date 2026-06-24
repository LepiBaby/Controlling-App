'use client'

import { useParams } from 'next/navigation'
import { Construction } from 'lucide-react'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { VERSIONS_NAV_GRUPPEN } from '@/lib/langfristige-planung-nav'

// Platzhalter für versionsgebundene Seiten, die noch nicht implementiert sind.
// Sobald eine echte Seite unter [versionId]/<slug>/page.tsx existiert, übernimmt
// diese automatisch den Vorrang (statisches Segment schlägt dynamisches [seite]).
export default function VersionsSeitePlatzhalter() {
  const params = useParams()
  const slug = typeof params.seite === 'string' ? params.seite : ''

  const seite = VERSIONS_NAV_GRUPPEN.flatMap((g) => g.items).find((i) => i.slug === slug)

  return (
    <LangfristigeVersionShell seitenTitel={seite?.label}>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <Construction className="h-10 w-10 text-muted-foreground/60" />
        <p className="mt-4 font-medium">{seite?.label ?? 'Seite'}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Diese Seite wird in Kürze verfügbar sein. Die Daten werden dann ausschließlich für diese
          Planversion gespeichert.
        </p>
      </div>
    </LangfristigeVersionShell>
  )
}
