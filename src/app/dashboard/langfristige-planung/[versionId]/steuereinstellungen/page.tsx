'use client'

import { useParams } from 'next/navigation'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeSteuereinstellungenFormular } from '@/components/steuereinstellungen-formular'

// PROJ-83: Steuereinstellungen einer Planversion. Wiederverwendung der
// Kurzfristig-Oberfläche (PROJ-65), parametrisiert mit der versionId:
// Produktverkäufe/Marketing/Investitionen stammen aus dem KPI-Modell dieser
// Version, alle Daten werden versionsgebunden gespeichert.
export default function LangfristigeSteuereinstellungenPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Steuereinstellungen">
      <LangfristigeSteuereinstellungenFormular versionId={versionId} />
    </LangfristigeVersionShell>
  )
}
