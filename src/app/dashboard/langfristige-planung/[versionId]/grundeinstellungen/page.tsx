'use client'

import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeGrundeinstellungenFormular } from '@/components/langfristige-grundeinstellungen-formular'

export default function LangfristigeGrundeinstellungenPage() {
  return (
    <LangfristigeVersionShell seitenTitel="Grundeinstellungen">
      <LangfristigeGrundeinstellungenFormular />
    </LangfristigeVersionShell>
  )
}
