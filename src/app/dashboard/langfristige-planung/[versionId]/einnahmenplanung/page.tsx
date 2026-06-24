'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeEinnahmenplanungTabelle } from '@/components/langfristige-einnahmenplanung-tabelle'

export default function LangfristigeEinnahmenplanungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Einnahmenplanung" fullWidth>
      <LangfristigeEinnahmenplanungTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
