'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeAbsatzplanungTabelle } from '@/components/langfristige-absatzplanung-tabelle'

export default function LangfristigeAbsatzplanungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Absatzplanung" fullWidth>
      <LangfristigeAbsatzplanungTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
