'use client'

import { useState, useMemo } from 'react'
import { NavSheet } from '@/components/nav-sheet'
import { LogoutButton } from '@/components/logout-button'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useKpiCategories } from '@/hooks/use-kpi-categories'
import {
  useOperativeFixkosten,
  berechneNettoMonatlich,
  type OperativeFixkostenEintrag,
} from '@/hooks/use-operative-fixkosten'
import { OperativeFixkostenTabelle } from '@/components/operative-fixkosten-tabelle'
import { OperativeFixkostenFormularDialog } from '@/components/operative-fixkosten-formular-dialog'

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export default function OperativeFixkostenEinstellungenPage() {
  const { categories, loading: katLoading } = useKpiCategories('ausgaben_kosten')
  const { eintraege, loading, error, create, update, remove } = useOperativeFixkosten()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [eintragToEdit, setEintragToEdit] = useState<OperativeFixkostenEintrag | null>(null)
  const [kategorieFilter, setKategorieFilter] = useState<string>('alle')
  const [auswertungOffen, setAuswertungOffen] = useState(false)

  // Ebene-1-Kinder von "Operativ" im ausgaben_kosten-Baum
  const operativKnoten = useMemo(
    () => categories.find(c => c.level === 1 && c.name.toLowerCase() === 'operativ'),
    [categories],
  )
  const operativKategorien = useMemo(
    () => operativKnoten
      ? categories.filter(c => c.parent_id === operativKnoten.id && c.level === 2)
      : [],
    [categories, operativKnoten],
  )

  // Gefilterte Einträge
  const gefilterteEintraege = useMemo(() => {
    if (kategorieFilter === 'alle') return eintraege
    return eintraege.filter(e => e.kategorie_id === kategorieFilter)
  }, [eintraege, kategorieFilter])

  // Auswertungsblock — netto monatlich, filterbewusst
  const gesamtNettoMonatlichGefiltert = useMemo(
    () => gefilterteEintraege
      .filter(e => e.aktiv)
      .reduce((sum, e) => sum + berechneNettoMonatlich(e.betrag_netto, e.zahlungsfrequenz), 0),
    [gefilterteEintraege],
  )

  const kategorieAufschluesselung = useMemo(() => {
    const map = new Map<string, { name: string; summe: number }>()
    gefilterteEintraege
      .filter(e => e.aktiv)
      .forEach(e => {
        const existing = map.get(e.kategorie_id)
        const betrag = berechneNettoMonatlich(e.betrag_netto, e.zahlungsfrequenz)
        if (existing) existing.summe += betrag
        else map.set(e.kategorie_id, { name: e.kategorie_name, summe: betrag })
      })
    return [...map.values()].sort((a, b) => b.summe - a.summe)
  }, [gefilterteEintraege])

  const hatAktiveEintraege = gefilterteEintraege.some(e => e.aktiv)

  function handleNeuAnlegen() {
    setEintragToEdit(null)
    setDialogOpen(true)
  }

  function handleBearbeiten(eintrag: OperativeFixkostenEintrag) {
    setEintragToEdit(eintrag)
    setDialogOpen(true)
  }

  async function handleSave(input: Parameters<typeof create>[0]) {
    if (eintragToEdit) {
      await update(eintragToEdit.id, input)
    } else {
      await create(input)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Operative Fixkosten-Einstellungen</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Auswertungsblock */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                    Fixkosten gesamt netto monatlich
                    {kategorieFilter !== 'alle' && ' (gefiltert)'}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    {EUR.format(gesamtNettoMonatlichGefiltert)}
                  </p>
                </div>
                {hatAktiveEintraege && (
                  <Collapsible open={auswertungOffen} onOpenChange={setAuswertungOffen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1">
                        {auswertungOffen
                          ? <>Weniger <ChevronUp className="h-4 w-4" /></>
                          : <>Mehr <ChevronDown className="h-4 w-4" /></>}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent />
                  </Collapsible>
                )}
              </div>

              {auswertungOffen && hatAktiveEintraege && (
                <div className="mt-4 border-t pt-4 space-y-1.5">
                  {kategorieAufschluesselung.map(k => (
                    <div key={k.name} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{k.name}</span>
                      <span className="tabular-nums font-medium">{EUR.format(k.summe)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <Select value={kategorieFilter} onValueChange={setKategorieFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Alle Kategorien" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Kategorien</SelectItem>
                {operativKategorien.map(k => (
                  <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleNeuAnlegen} className="ml-auto">
              + Fixkosten anlegen
            </Button>
          </div>

          {/* Tabelle / Zustände */}
          {loading || katLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Lädt…</p>
          ) : error ? (
            <p className="text-sm text-destructive py-8 text-center">{error}</p>
          ) : eintraege.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground">Noch keine Fixkosten angelegt.</p>
              <Button onClick={handleNeuAnlegen}>+ Fixkosten anlegen</Button>
            </div>
          ) : (
            <OperativeFixkostenTabelle
              eintraege={gefilterteEintraege}
              onEdit={handleBearbeiten}
              onDelete={remove}
            />
          )}
        </div>
      </main>

      <OperativeFixkostenFormularDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eintragToEdit={eintragToEdit}
        gruppen={operativKategorien}
        allKategorien={categories}
        onSave={handleSave}
      />
    </div>
  )
}
