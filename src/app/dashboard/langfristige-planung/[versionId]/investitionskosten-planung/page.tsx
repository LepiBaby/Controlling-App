'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeInvestitionsausgabenTabelle } from '@/components/langfristige-investitionsausgaben-tabelle'

export default function LangfristigeInvestitionskostenPlanungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Investitionskostenplanung" fullWidth>
      <LangfristigeInvestitionsausgabenTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
