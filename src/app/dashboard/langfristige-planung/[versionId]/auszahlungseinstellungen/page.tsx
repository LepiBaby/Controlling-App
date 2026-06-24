'use client'

import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeAuszahlungseinstellungenFormular } from '@/components/langfristige-auszahlungseinstellungen-formular'

export default function LangfristigeAuszahlungseinstellungenPage() {
  return (
    <LangfristigeVersionShell seitenTitel="Auszahlungseinstellungen">
      <LangfristigeAuszahlungseinstellungenFormular />
    </LangfristigeVersionShell>
  )
}
