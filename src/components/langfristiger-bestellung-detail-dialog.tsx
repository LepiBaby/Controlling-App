'use client'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Trash2, CalendarIcon } from 'lucide-react'
import { perContainerMengen } from '@/hooks/use-produktinformationen-container'
import { LangfristigeBestellkostenTabelle } from '@/components/langfristige-bestellkosten-tabelle'
import type { LangfristigeBestellung } from '@/hooks/use-langfristige-bestellungen'

const DATUM_FELDER: Array<{ key: keyof LangfristigeBestellung; label: string }> = [
  { key: 'bestelldatum', label: 'Bestelldatum' },
  { key: 'produktionsstart_datum', label: 'Produktionsstart' },
  { key: 'produktionsende_datum', label: 'Produktionsende' },
  { key: 'shippingdatum', label: 'Shippingdatum' },
  { key: 'ankunftsdatum', label: 'Ankunftsdatum' },
  { key: 'verfuegbarkeitsdatum', label: 'Verfügbarkeitsdatum' },
]

function fmtDatum(d: string | null): string {
  if (!d) return '–'
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('de-DE')
  } catch {
    return d
  }
}

// Read-only Datums-Feld im Stil des DatePickers der kurzfristigen Planung.
function DatumReadonly({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex h-9 w-full items-center rounded-md border bg-muted/40 px-3 text-sm">
        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
        {value ? (
          fmtDatum(value)
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </div>
    </div>
  )
}

// Detailansicht einer angelegten Bestellung — dargestellt wie eine Planbestellung
// der kurzfristigen Planung, jedoch vollständig READ-ONLY (Produktebene).
export function LangfristigerBestellungDetailDialog({
  bestellung: b,
  open,
  onOpenChange,
  onDelete,
  maxKapazitaet,
  versionId,
}: {
  bestellung: LangfristigeBestellung
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => Promise<void>
  maxKapazitaet?: { max_20dc: number | null; max_40hq: number | null }
  versionId: string
}) {
  const anteil = b.container_anteil
  const istKonsolidiertContainer = !!(anteil && Object.keys(anteil).length > 0)
  const round2 = (n: number) => Math.round(n * 100) / 100
  const fmtAnzahl = (n: number) => {
    const r = round2(n)
    return r % 1 === 0 ? String(r) : r.toFixed(2)
  }
  // Container-Anzeige: bei Konsolidierung anteiliger Share aus container_anteil,
  // sonst die eigene Anzahl.
  const eff40hq = round2(istKonsolidiertContainer ? anteil!['40HQ'] ?? 0 : b.anzahl_40hq ?? 0)
  const eff20dc = round2(istKonsolidiertContainer ? anteil!['20DC'] ?? 0 : b.anzahl_20dc ?? 0)

  const containerBadge = (() => {
    if (istKonsolidiertContainer) {
      const parts = Object.entries(anteil!)
        .filter(([, v]) => v > 0)
        .map(([art, v]) => `${fmtAnzahl(v)}× ${art}`)
        .join(' + ')
      return parts || null
    }
    const hq = b.anzahl_40hq ?? 0
    const dc = b.anzahl_20dc ?? 0
    if (hq === 0 && dc === 0) return null
    return [hq > 0 && `${hq}× 40HQ`, dc > 0 && `${dc}× 20DC`].filter(Boolean).join(' + ')
  })()
  const istKonsolidiert = b.konsolidiert_mit.length > 0
  const gesamtContainer = eff40hq + eff20dc

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
            <span>Bestellung</span>
            <span className="font-normal text-muted-foreground">—</span>
            <span className="text-sm font-normal text-muted-foreground">{b.produkt_name}</span>
            {b.herkunft === 'manuell' && (
              <Badge variant="outline" className="shrink-0 text-xs font-normal">
                Manuell
              </Badge>
            )}
            {istKonsolidiert && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-violet-200 bg-violet-50 text-xs font-normal text-violet-600"
                    >
                      Konsolidiert
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    <p className="mb-1 font-medium">Konsolidiert mit:</p>
                    {b.konsolidiert_mit.map((k) => (
                      <p key={k.bestellung_id}>{k.produkt_name || 'Weitere Bestellung'}</p>
                    ))}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {containerBadge && (
              <Badge variant="outline" className="shrink-0 font-mono text-xs font-normal">
                {containerBadge}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Datumsfelder (read-only) */}
          <div>
            <p className="mb-3 text-sm font-medium">Datumsfelder</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {DATUM_FELDER.map((f) => (
                <DatumReadonly key={f.key} label={f.label} value={(b[f.key] as string | null) ?? null} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Bestellmenge (read-only, Produktebene = eine Zeile) */}
          {(() => {
            // Bei Konsolidierung: „Praktisch" = Wert vor der Konsolidierung,
            // „Konsolidierung" = finale (konsolidierte) Menge — analog kurzfristig.
            const istKonsolidiertMenge = b.menge_vor_konsolidierung != null
            const praktischAnzeige = istKonsolidiertMenge ? b.menge_vor_konsolidierung! : b.menge_praktisch
            return (
              <div>
                <p className="mb-3 text-sm font-medium">Bestellmenge</p>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full table-auto text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Produkt</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">Theoretisch</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">Nach MOQ</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">Praktisch</th>
                        {istKonsolidiertMenge && (
                          <th className="px-3 py-2 text-right font-medium text-blue-600">Konsolidierung</th>
                        )}
                        {b.begruendung && (
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Begründung</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2">{b.produkt_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {b.menge_theoretisch != null ? b.menge_theoretisch.toLocaleString('de-DE') : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {b.menge_nach_moq != null ? b.menge_nach_moq.toLocaleString('de-DE') : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {praktischAnzeige.toLocaleString('de-DE')}
                        </td>
                        {istKonsolidiertMenge && (
                          <td className="px-3 py-2 text-right font-medium tabular-nums text-blue-600">
                            {b.menge_praktisch.toLocaleString('de-DE')}
                          </td>
                        )}
                        {b.begruendung && (
                          <td className="px-3 py-2 text-xs text-muted-foreground">{b.begruendung}</td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Container (read-only) — mit Per-Container-Aufschlüsselung wie kurzfristig */}
          {gesamtContainer > 0 &&
            (() => {
              const max40hq = maxKapazitaet?.max_40hq ?? null
              const max20dc = maxKapazitaet?.max_20dc ?? null
              // Physische Container für die Aufschlüsselung: bei Konsolidierung
              // den (anteiligen) Wert aufrunden, sonst die eigene Anzahl.
              const phys40hq = istKonsolidiertContainer ? Math.ceil(eff40hq) : b.anzahl_40hq ?? 0
              const phys20dc = istKonsolidiertContainer ? Math.ceil(eff20dc) : b.anzahl_20dc ?? 0
              const { hqAmounts, dcAmounts } = perContainerMengen(
                b.menge_praktisch,
                phys40hq,
                phys20dc,
                max40hq,
                max20dc,
              )
              return (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Container</p>
                    <div className="flex flex-wrap gap-6">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Anzahl 40HQ{max40hq !== null ? ` (max. ${max40hq.toLocaleString('de-DE')} Stk.)` : ''}
                        </Label>
                        <p className="text-sm font-medium tabular-nums">{fmtAnzahl(eff40hq)}</p>
                        {hqAmounts.map((a, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            Container {i + 1}: {a.toLocaleString('de-DE')} Stk.
                            {max40hq ? ` (${Math.round((a / max40hq) * 100)} %)` : ''}
                          </p>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Anzahl 20DC{max20dc !== null ? ` (max. ${max20dc.toLocaleString('de-DE')} Stk.)` : ''}
                        </Label>
                        <p className="text-sm font-medium tabular-nums">{fmtAnzahl(eff20dc)}</p>
                        {dcAmounts.map((a, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            Container {i + 1}: {a.toLocaleString('de-DE')} Stk.
                            {max20dc ? ` (${Math.round((a / max20dc) * 100)} %)` : ''}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}

          {/* Konsolidiert mit (read-only) — Zeilen-Stil wie kurzfristig */}
          {istKonsolidiert && (
            <>
              <Separator />
              <div>
                <p className="mb-3 text-sm font-medium">Konsolidiert mit</p>
                <div className="space-y-2">
                  {b.konsolidiert_mit.map((k) => {
                    // Container-Label des Partners aus seinem container_anteil (Fallback:
                    // volle Anzahlen) — exakt wie kurzfristig.
                    const anteil = k.container_anteil
                    let containerLabel = ''
                    if (anteil && Object.keys(anteil).length > 0) {
                      containerLabel = Object.entries(anteil)
                        .filter(([, v]) => v > 0)
                        .map(([art, v]) => {
                          const r = Math.round(v * 100) / 100
                          return `${r % 1 === 0 ? r : r.toFixed(2)}× ${art}`
                        })
                        .join(' + ')
                    } else {
                      containerLabel = [
                        k.anzahl_40hq > 0 && `${k.anzahl_40hq}× 40HQ`,
                        k.anzahl_20dc > 0 && `${k.anzahl_20dc}× 20DC`,
                      ]
                        .filter(Boolean)
                        .join(' + ')
                    }
                    return (
                      <div
                        key={k.bestellung_id}
                        className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-2.5"
                      >
                        <span className="text-sm font-medium">{k.produkt_name || 'Weitere Bestellung'}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          {k.bestelldatum && (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {new Date(k.bestelldatum + 'T00:00:00').toLocaleDateString('de-DE')}
                            </span>
                          )}
                          {containerLabel && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {containerLabel}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Bestellkosten — wie kurzfristig: Auto-Kosten + manuelle Einträge, editierbar */}
          <LangfristigeBestellkostenTabelle versionId={versionId} bestellungId={b.id} />

          {/* Notizen (read-only) */}
          {b.notizen && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-sm font-medium">Notizen</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{b.notizen}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                Löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bestellung löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Diese Bestellung wird endgültig gelöscht. Diese Aktion kann nicht rückgängig
                  gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    onDelete(b.id)
                      .then(() => onOpenChange(false))
                      .catch(() => {})
                  }}
                >
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
