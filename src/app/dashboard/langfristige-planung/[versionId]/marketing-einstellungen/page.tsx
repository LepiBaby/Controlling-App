'use client'

import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeMarketingEinstellungenFormular } from '@/components/langfristige-marketing-einstellungen-formular'

export default function LangfristigeMarketingEinstellungenPage() {
  return (
    <LangfristigeVersionShell seitenTitel="Marketing-Einstellungen">
      <LangfristigeMarketingEinstellungenFormular />
    </LangfristigeVersionShell>
  )
}
