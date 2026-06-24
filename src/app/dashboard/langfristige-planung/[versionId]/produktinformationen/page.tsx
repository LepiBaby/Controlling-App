'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeProduktinformationenTabs } from '@/components/produktinformationen-tabs'

// PROJ-77: Produktinformationen einer Planversion. Wiederverwendung der
// Kurzfristig-Reiter (PROJ-59), gespeist mit den Produkten dieser Planversion
// (art = 'lp_produkt') und versionsgebundenen Endpunkten.
export default function LangfristigeProduktinformationenPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Produktinformationen">
      <LangfristigeProduktinformationenTabs versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
