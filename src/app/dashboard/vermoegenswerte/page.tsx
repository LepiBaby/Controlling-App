'use client'

import { useState, useMemo } from 'react'
import { NavSheet } from '@/components/nav-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useKpiCategories } from '@/hooks/use-kpi-categories'
import { useVermoegenswerte } from '@/hooks/use-vermoegenswerte'
import { VermoegenswertTable, type KategorieSichtbar } from '@/components/vermoegenswert-table'
import { VermoegenswertWizardDialog } from '@/components/vermoegenswert-wizard-dialog'

const ALLE_KATEGORIEN: KategorieSichtbar[] = ['warenwert', 'verbindlichkeiten', 'forderungen', 'cash', 'anlagevermoegen']

const KATEGORIE_LABEL: Record<KategorieSichtbar, string> = {
  warenwert:         'Warenwert',
  verbindlichkeiten: 'Verbindlichkeiten',
  forderungen:       'Forderungen',
  cash:              'Cash',
  anlagevermoegen:   'Anlagevermögen',
}

const KATEGORIE_STYLE: Record<KategorieSichtbar, { active: string; inactive: string }> = {
  warenwert:         { active: 'bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-200',     inactive: 'border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400' },
  verbindlichkeiten: { active: 'bg-rose-100 border-rose-400 text-rose-800 dark:bg-rose-900/40 dark:border-rose-600 dark:text-rose-200',     inactive: 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400' },
  forderungen:       { active: 'bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-200', inactive: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400' },
  cash:              { active: 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-200', inactive: 'border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400' },
  anlagevermoegen:   { active: 'bg-violet-100 border-violet-400 text-violet-800 dark:bg-violet-900/40 dark:border-violet-600 dark:text-violet-200', inactive: 'border-violet-200 text-violet-600 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400' },
}

export default function VermoegenswertePage() {
  const [wizardOpen, setWizardOpen] = useState(false)

  // ── Filter-State ─────────────────────────────────────────────────────────
  const [filterVon, setFilterVon] = useState('')
  const [filterBis, setFilterBis] = useState('')
  const [aktiveKategorien, setAktiveKategorien] = useState<Set<KategorieSichtbar>>(
    new Set(ALLE_KATEGORIEN)
  )

  const toggleKategorie = (k: KategorieSichtbar) => {
    setAktiveKategorien((prev) => {
      const next = new Set(prev)
      if (next.has(k)) { next.delete(k) } else { next.add(k) }
      return next
    })
  }

  // ── Daten ─────────────────────────────────────────────────────────────────
  const { categories: produkteAll, loading: produkteLaden } = useKpiCategories('produkte')
  const { categories: plattformenAll, loading: plattformenLaden } = useKpiCategories('sales_plattformen')
  const { categories: ausgabenAll, loading: ausgabenLaden } = useKpiCategories('ausgaben_kosten')
  const { snapshots, loading: snapshotsLaden, error, addSnapshot, deleteSnapshot } = useVermoegenswerte()

  const produkte = useMemo(
    () => [...produkteAll].filter((c) => c.level === 1).sort((a, b) => a.sort_order - b.sort_order),
    [produkteAll]
  )
  const plattformen = useMemo(
    () => [...plattformenAll].filter((c) => c.level === 1).sort((a, b) => a.sort_order - b.sort_order),
    [plattformenAll]
  )
  const produktKategorieId = useMemo(() => {
    return ausgabenAll.find((c) => c.level === 1 && c.name.toLowerCase() === 'produkt')?.id ?? null
  }, [ausgabenAll])

  const gefilterteSnapshots = useMemo(() => {
    return snapshots.filter((s) => {
      if (filterVon && s.datum < filterVon) return false
      if (filterBis && s.datum > filterBis) return false
      return true
    })
  }, [snapshots, filterVon, filterBis])

  const isLoading = produkteLaden || plattformenLaden || ausgabenLaden || snapshotsLaden

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <NavSheet />
        <h1 className="text-lg font-semibold">Vermögenswerte</h1>
        <div className="ml-auto">
          <Button onClick={() => setWizardOpen(true)}>+ Neue Erfassung</Button>
        </div>
      </header>

      {/* Filter-Leiste */}
      <div className="border-b bg-muted/20 px-4 py-3 flex flex-wrap items-end gap-4">
        {/* Datumsfilter */}
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="filter-von" className="text-xs text-muted-foreground">Von</Label>
            <Input
              id="filter-von"
              type="date"
              value={filterVon}
              onChange={(e) => setFilterVon(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-bis" className="text-xs text-muted-foreground">Bis</Label>
            <Input
              id="filter-bis"
              type="date"
              value={filterBis}
              onChange={(e) => setFilterBis(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
          {(filterVon || filterBis) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setFilterVon(''); setFilterBis('') }}
            >
              Zurücksetzen
            </Button>
          )}
        </div>

        {/* Kategorie-Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">Spalten:</span>
          {ALLE_KATEGORIEN.map((k) => {
            const isActive = aktiveKategorien.has(k)
            const style = KATEGORIE_STYLE[k]
            return (
              <button
                key={k}
                onClick={() => toggleKategorie(k)}
                className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${isActive ? style.active : style.inactive}`}
              >
                {KATEGORIE_LABEL[k]}
              </button>
            )
          })}
          {aktiveKategorien.size < ALLE_KATEGORIEN.length && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setAktiveKategorien(new Set(ALLE_KATEGORIEN))}
            >
              Alle
            </Button>
          )}
        </div>
      </div>

      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <VermoegenswertTable
            snapshots={gefilterteSnapshots}
            produkte={produkte}
            plattformen={plattformen}
            aktiveKategorien={aktiveKategorien}
            onDelete={deleteSnapshot}
            onNeuErfassung={() => setWizardOpen(true)}
          />
        )}
      </main>

      <VermoegenswertWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        produkte={produkte}
        plattformen={plattformen}
        produktKategorieId={produktKategorieId}
        onSave={addSnapshot}
      />
    </div>
  )
}
