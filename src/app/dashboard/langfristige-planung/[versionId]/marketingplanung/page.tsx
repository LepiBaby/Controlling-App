'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeMarketingplanungTabelle } from '@/components/langfristige-marketingplanung-tabelle'

export default function LangfristigeMarketingplanungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Marketing-Planung" fullWidth>
      <LangfristigeMarketingplanungTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
