'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { VERSIONS_NAV_GRUPPEN, buildVersionsHref } from '@/lib/langfristige-planung-nav'

export default function PlanversionUebersichtPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell>
      <div className="space-y-8">
        {VERSIONS_NAV_GRUPPEN.map((gruppe) => (
          <div key={gruppe.label} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {gruppe.label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gruppe.items.map((seite) => (
                <a
                  key={seite.slug}
                  href={buildVersionsHref(versionId, seite.slug)}
                  className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <p className="font-medium">{seite.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{seite.description}</p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </LangfristigeVersionShell>
  )
}
