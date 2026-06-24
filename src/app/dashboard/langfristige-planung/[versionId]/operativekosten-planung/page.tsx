'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { OperativekostenPlanungTabelle } from '@/components/operativekosten-planung-tabelle'

export default function OperativekostenPlanungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Operativkosten Planung" fullWidth>
      <OperativekostenPlanungTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
