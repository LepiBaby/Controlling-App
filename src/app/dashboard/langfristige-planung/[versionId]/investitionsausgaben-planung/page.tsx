'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeInvestitionsausgabenTabelle } from '@/components/langfristige-investitionsausgaben-tabelle'

export default function LangfristigeInvestitionsausgabenPlanungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Investitionsausgaben Planung" fullWidth>
      <LangfristigeInvestitionsausgabenTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
