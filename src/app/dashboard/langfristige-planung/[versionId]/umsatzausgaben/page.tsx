'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeUmsatzausgabenTabelle } from '@/components/langfristige-umsatzausgaben-tabelle'

export default function LangfristigeUmsatzausgabenPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Umsatzausgabenplanung" fullWidth>
      <LangfristigeUmsatzausgabenTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
