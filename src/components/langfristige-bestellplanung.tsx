'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Play, Trash2, PackageX, Loader2, AlertTriangle, Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLangfristigeKpiKategorien } from '@/hooks/use-langfristige-kpi-kategorien'
import { useLangfristigeBestellungen, type LangfristigeBestellung } from '@/hooks/use-langfristige-bestellungen'
import { LangfristigesLagerbestandsdiagramm } from '@/components/langfristiges-lagerbestandsdiagramm'
import { LangfristigerBestellungDetailDialog } from '@/components/langfristiger-bestellung-detail-dialog'
import { LangfristigerBestelllaufDialog } from '@/components/langfristiger-bestelllauf-dialog'
import {
  LangfristigeBestellungFormularDialog,
  type ManuelleBestellungPayload,
} from '@/components/langfristige-bestellung-formular-dialog'
import { useLangfristigeContainerKapazitaet } from '@/hooks/use-langfristige-container-kapazitaet'
import { useToast } from '@/hooks/use-toast'

function fmtDatum(d: string | null): string {
  if (!d) return '—'
  try {
    return format(parseISO(d), 'dd.MM.yyyy', { locale: de })
  } catch {
    return d
  }
}

function containerLabel(b: LangfristigeBestellung): string | null {
  // Bei Konsolidierung den anteiligen Container-Share zeigen (z. B. „0,5× 40HQ"),
  // sonst die eigenen vollen Container-Anzahlen.
  const anteil = b.container_anteil
  if (anteil && Object.keys(anteil).length > 0) {
    const parts = Object.entries(anteil)
      .filter(([, v]) => v > 0)
      .map(([art, v]) => {
        const r = Math.round(v * 100) / 100
        return `${r % 1 === 0 ? r : r.toFixed(2)}× ${art}`
      })
    return parts.length > 0 ? parts.join(' + ') : null
  }
  const parts = [b.anzahl_40hq > 0 && `${b.anzahl_40hq}× 40HQ`, b.anzahl_20dc > 0 && `${b.anzahl_20dc}× 20DC`].filter(
    Boolean,
  )
  return parts.length > 0 ? (parts.join(' + ') as string) : null
}

function BestellungZeile({
  bestellung,
  onClick,
  onDelete,
  onToggleErstbestellung,
}: {
  bestellung: LangfristigeBestellung
  onClick: () => void
  onDelete: () => void
  onToggleErstbestellung: () => void
}) {
  const container = containerLabel(bestellung)
  const istKonsolidiert = bestellung.konsolidiert_mit.length > 0

  return (
    <tr className="cursor-pointer border-b hover:bg-muted/40" onClick={onClick}>
      <td className="px-4 py-3 text-sm font-medium">{fmtDatum(bestellung.bestelldatum)}</td>
      <td className="max-w-[280px] px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate">{bestellung.produkt_name}</span>
          {bestellung.ist_erstbestellung && (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-200 bg-amber-50 text-xs font-normal text-amber-700"
            >
              Erstbestellung
            </Badge>
          )}
          {bestellung.herkunft === 'manuell' && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              Manuell
            </Badge>
          )}
          {istKonsolidiert && (
            <Badge
              variant="outline"
              className="shrink-0 border-violet-200 bg-violet-50 text-xs font-normal text-violet-600"
              title={`Konsolidiert mit: ${bestellung.konsolidiert_mit.map((k) => k.produkt_name).join(', ')}`}
            >
              Konsolidiert
            </Badge>
          )}
          {container && (
            <Badge variant="outline" className="shrink-0 font-mono text-xs font-normal">
              {container}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">
        {bestellung.menge_praktisch > 0 ? bestellung.menge_praktisch.toLocaleString('de-DE') : '—'}
      </td>
      <td className="px-4 py-3 text-sm">{fmtDatum(bestellung.verfuegbarkeitsdatum)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="outline"
            size="sm"
            className={
              bestellung.ist_erstbestellung
                ? 'h-7 border-amber-300 bg-amber-50 px-2 text-xs font-normal text-amber-700 hover:bg-amber-100'
                : 'h-7 px-2 text-xs font-normal text-muted-foreground'
            }
            title={
              bestellung.ist_erstbestellung
                ? 'Erstbestellungs-Markierung entfernen'
                : 'Als Erstbestellung dieses Produktes markieren'
            }
            onClick={(e) => {
              e.stopPropagation()
              onToggleErstbestellung()
            }}
          >
            {bestellung.ist_erstbestellung ? 'Erstbestellung ✓' : 'Erstbestellung'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
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
                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  )
}

export function LangfristigeBestellplanung({ versionId }: { versionId: string }) {
  const { categories: produkte, loading: produkteLoading } = useLangfristigeKpiKategorien(
    versionId,
    'lp_produkt',
  )
  const { bestellungen, loading, error, reload, create, update, remove } =
    useLangfristigeBestellungen(versionId)
  const { getKapazitaet } = useLangfristigeContainerKapazitaet(versionId)
  const { toast } = useToast()

  const [selectedProduktId, setSelectedProduktId] = useState<string | null>(null)
  const [bestelllaufOffen, setBestelllaufOffen] = useState(false)
  const [manuellOffen, setManuellOffen] = useState(false)
  const [detailBestellung, setDetailBestellung] = useState<LangfristigeBestellung | null>(null)
  const [detailOffen, setDetailOffen] = useState(false)
  const [checkLaeuft, setCheckLaeuft] = useState(false)
  const [fehlerOffen, setFehlerOffen] = useState(false)
  const [fehlerListe, setFehlerListe] = useState<string[]>([])

  // Vor dem Bestelllauf prüfen, ob für ALLE Produkte alle benötigten Daten da sind.
  async function handleBestelllaufClick() {
    setCheckLaeuft(true)
    try {
      const res = await fetch(
        `/api/langfristige-planung/${versionId}/bestellplanung/stammdaten-check`,
      )
      const data: { ok: boolean; fehler: string[] } = await res.json()
      if (data.ok) {
        setBestelllaufOffen(true)
      } else {
        setFehlerListe(data.fehler ?? [])
        setFehlerOffen(true)
      }
    } catch {
      // Im Fehlerfall (z. B. Netzwerk) den Lauf nicht blockieren.
      setBestelllaufOffen(true)
    } finally {
      setCheckLaeuft(false)
    }
  }

  const produktOptionen = useMemo(
    () => produkte.map((p) => ({ id: p.id, name: p.name })),
    [produkte],
  )

  const sortierteBestellungen = useMemo(
    () =>
      [...bestellungen].sort((a, b) => {
        const da = a.bestelldatum ?? ''
        const db = b.bestelldatum ?? ''
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return da.localeCompare(db)
      }),
    [bestellungen],
  )

  async function handleDelete(id: string) {
    try {
      await remove(id)
      toast({ title: 'Bestellung gelöscht' })
    } catch (err) {
      toast({
        title: 'Fehler beim Löschen',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function handleManuellAnlegen(payload: ManuelleBestellungPayload) {
    await create(payload)
    toast({ title: 'Bestellung hinzugefügt' })
  }

  async function handleToggleErstbestellung(b: LangfristigeBestellung) {
    try {
      await update(b.id, { ist_erstbestellung: !b.ist_erstbestellung })
      toast({
        title: b.ist_erstbestellung ? 'Erstbestellungs-Markierung entfernt' : 'Als Erstbestellung markiert',
      })
    } catch (err) {
      toast({
        title: 'Fehler beim Speichern',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  // Empty state: no products in the version
  if (!produkteLoading && produkte.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
        <PackageX className="h-8 w-8" />
        <p className="text-sm">
          Diese Planversion hat noch keine Produkte. Bitte lege zuerst Produkte in der{' '}
          <a
            href={`/dashboard/langfristige-planung/${versionId}/kpi-modell-verwaltung`}
            className="text-primary underline"
          >
            KPI-Modell-Verwaltung
          </a>{' '}
          dieser Version an.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Chart + Monatsdetails (Produkt-Auswahl oben links) */}
      <LangfristigesLagerbestandsdiagramm
        versionId={versionId}
        produkte={produktOptionen}
        selectedProduktId={selectedProduktId}
        onSelectProdukt={setSelectedProduktId}
      />

      {/* Aktionen */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setManuellOffen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Laufende Bestellung hinzufügen
        </Button>
        <Button onClick={handleBestelllaufClick} disabled={checkLaeuft} className="gap-2">
          {checkLaeuft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Bestelllauf durchführen
        </Button>
      </div>

      {/* Fehlende Stammdaten — je Produkt */}
      <AlertDialog open={fehlerOffen} onOpenChange={setFehlerOffen}>
        <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Fehlende Daten für den Bestelllauf</AlertDialogTitle>
            <AlertDialogDescription>
              Der Bestelllauf kann erst gestartet werden, wenn für alle Produkte des KPI-Modells
              alle benötigten Daten hinterlegt sind. Bitte ergänze:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-1.5 px-1 py-2">
            {fehlerListe.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setFehlerOffen(false)}>Verstanden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bestelltabelle (alle Bestellungen gemeinsam, ohne Status) */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Fehler beim Laden: {error}
        </div>
      ) : sortierteBestellungen.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <p className="text-sm">Noch keine Bestellungen vorhanden. Führe einen Bestelllauf durch.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bestelldatum
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Produkt
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Menge
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Verfügbar ab
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sortierteBestellungen.map((b) => (
                <BestellungZeile
                  key={b.id}
                  bestellung={b}
                  onClick={() => {
                    setDetailBestellung(b)
                    setDetailOffen(true)
                  }}
                  onDelete={() => handleDelete(b.id)}
                  onToggleErstbestellung={() => handleToggleErstbestellung(b)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialoge */}
      <LangfristigerBestelllaufDialog
        versionId={versionId}
        open={bestelllaufOffen}
        onOpenChange={setBestelllaufOffen}
        onComplete={reload}
      />

      <LangfristigeBestellungFormularDialog
        open={manuellOffen}
        onOpenChange={setManuellOffen}
        produkte={produktOptionen}
        onSubmit={handleManuellAnlegen}
      />

      {detailBestellung && (
        <LangfristigerBestellungDetailDialog
          bestellung={detailBestellung}
          open={detailOffen}
          onOpenChange={(open) => {
            setDetailOffen(open)
            if (!open) setDetailBestellung(null)
          }}
          onDelete={handleDelete}
          maxKapazitaet={getKapazitaet(detailBestellung.produkt_id)}
          versionId={versionId}
        />
      )}
    </div>
  )
}
