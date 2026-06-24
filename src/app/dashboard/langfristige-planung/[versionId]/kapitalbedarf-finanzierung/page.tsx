'use client'

import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { LangfristigeVersionShell } from '@/components/langfristige-version-shell'
import { LangfristigeKapitalbedarfTabelle } from '@/components/langfristige-kapitalbedarf-tabelle'
import { LangfristigeFinanzierungTabelle } from '@/components/langfristige-finanzierung-tabelle'
import { useLangfristigeKapitalbedarfFinanzierung } from '@/hooks/use-langfristige-kapitalbedarf-finanzierung'

function KapitalbedarfFinanzierungInhalt({ versionId }: { versionId: string }) {
  const model = useLangfristigeKapitalbedarfFinanzierung(versionId)

  return (
    <div className="space-y-8">
      {model.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {model.error}
        </div>
      )}

      {model.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : (
        <>
          <LangfristigeKapitalbedarfTabelle model={model} />
          <LangfristigeFinanzierungTabelle model={model} />
        </>
      )}
    </div>
  )
}

export default function LangfristigeKapitalbedarfFinanzierungPage() {
  const params = useParams()
  const versionId = typeof params.versionId === 'string' ? params.versionId : ''

  return (
    <LangfristigeVersionShell seitenTitel="Kapitalbedarf & Finanzierung">
      <div className="mx-auto max-w-4xl">
        <KapitalbedarfFinanzierungInhalt versionId={versionId} />
      </div>
    </LangfristigeVersionShell>
  )
}
