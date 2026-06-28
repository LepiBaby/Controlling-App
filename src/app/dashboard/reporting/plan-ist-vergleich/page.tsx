'use client'

import { NavSheet } from '@/components/nav-sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlanIstVergleichMatrix } from '@/components/plan-ist-vergleich-matrix'
import { usePlanIstVergleich } from '@/hooks/use-plan-ist-vergleich'

export default function PlanIstVergleichPage() {
  const {
    versions,
    versionsLoading,
    selectedVersionId,
    selectedMonth,
    setVersion,
    setMonth,
    model,
  } = usePlanIstVergleich()

  const hasSelection = !!selectedVersionId && !!selectedMonth

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <NavSheet />
          <h1 className="text-lg font-semibold">Plan-Ist-Vergleich</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-6xl space-y-6">

          {/* Auswahl-Leiste */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Planversion (Soll)</Label>
              <Select
                value={selectedVersionId}
                onValueChange={setVersion}
                disabled={versionsLoading || versions.length === 0}
              >
                <SelectTrigger className="h-8 w-64 text-sm">
                  <SelectValue placeholder={versionsLoading ? 'Lädt …' : 'Planversion wählen'} />
                </SelectTrigger>
                <SelectContent>
                  {versions.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Monat (Ist &amp; Soll)</Label>
              <Input
                type="month"
                className="h-8 w-40 text-sm"
                value={selectedMonth}
                onChange={e => setMonth(e.target.value || '')}
              />
            </div>
          </div>

          {/* Keine Planversionen vorhanden */}
          {!versionsLoading && versions.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              <p className="font-medium">Keine Planversionen vorhanden</p>
              <p className="mt-1">
                Lege zuerst eine Planversion in der{' '}
                <a href="/dashboard/langfristige-planung" className="underline underline-offset-2 hover:text-foreground">
                  Langfristigen Planung
                </a>{' '}
                an, um sie hier als Soll zu vergleichen.
              </p>
            </div>
          )}

          {/* Hinweis: Monat außerhalb des Planungshorizonts */}
          {hasSelection && model.outOfWindow && !model.loading && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              Der gewählte Monat liegt außerhalb des Planungshorizonts dieser Planversion — alle Soll-Werte werden als 0 dargestellt.
            </p>
          )}

          {/* Fehler */}
          {model.sollError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {model.sollError}
            </div>
          )}
          {model.istError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {model.istError}
            </div>
          )}

          {/* Vergleichs-Matrix */}
          {versions.length > 0 && (
            <PlanIstVergleichMatrix model={model} hasSelection={hasSelection} />
          )}

        </div>
      </main>
    </div>
  )
}
