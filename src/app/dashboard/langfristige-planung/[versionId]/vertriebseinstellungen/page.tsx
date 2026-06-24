'use client'

import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeVertriebseinstellungen } from '@/components/langfristige-vertriebseinstellungen'

export default function LangfristigeVertriebseinstellungenPage() {
  return (
    <LangfristigeVersionShell seitenTitel="Vertriebseinstellungen">
      <LangfristigeVertriebseinstellungen />
    </LangfristigeVersionShell>
  )
}
