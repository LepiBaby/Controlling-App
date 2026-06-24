'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { FinanzierungsausgabenPlanungTabelle } from '@/components/finanzierungsausgaben-planung-tabelle'

export default function FinanzierungsausgabenPlanungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Finanzierungsausgaben Planung" fullWidth>
      <FinanzierungsausgabenPlanungTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
