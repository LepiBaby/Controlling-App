'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeSalesPlattformPlanungTabelle } from '@/components/langfristige-sales-plattform-planung-tabelle'

export default function LangfristigeSalesPlattformPlanungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Sales-Plattform-Planung" fullWidth>
      <LangfristigeSalesPlattformPlanungTabelle versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
