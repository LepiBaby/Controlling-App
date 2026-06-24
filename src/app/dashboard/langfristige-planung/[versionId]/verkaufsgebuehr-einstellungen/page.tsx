'use client'

import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeVerkaufsgebuehrEinstellungenTabelle } from '@/components/langfristige-verkaufsgebuehr-einstellungen-tabelle'

export default function LangfristigeVerkaufsgebuehrEinstellungenPage() {
  return (
    <LangfristigeVersionShell seitenTitel="Verkaufsgebühr-Einstellungen">
      <LangfristigeVerkaufsgebuehrEinstellungenTabelle />
    </LangfristigeVersionShell>
  )
}
