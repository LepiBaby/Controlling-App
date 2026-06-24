'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeSteuerausgabenTabelle } from '@/components/langfristige-steuerausgaben-tabelle'

export default function LangfristigeSteuerausgabenPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Steuerausgabenplanung" fullWidth>
      <LangfristigeSteuerausgabenTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
