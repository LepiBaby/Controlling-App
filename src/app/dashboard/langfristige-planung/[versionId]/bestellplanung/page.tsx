'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeBestellplanung } from '@/components/langfristige-bestellplanung'

export default function LangfristigeBestellplanungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Bestellplanung">
      <LangfristigeBestellplanung versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
