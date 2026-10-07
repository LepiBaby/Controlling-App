'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  FolderOpen,
  Folder,
  FolderPlus,
  FolderInput,
  FolderMinus,
  FileText,
  Copy,
  Layers,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { usePlanversionen, type Planversion } from '@/hooks/use-planversionen'
import { usePlanversionOrdner, type PlanversionOrdner } from '@/hooks/use-planversion-ordner'
import { PlanversionDialog } from '@/components/planversion-dialog'
import { buildVersionsHref, VERSIONS_NAV_GRUPPEN } from '@/lib/langfristige-planung-nav'

// Einstiegsseite einer geöffneten Version: erste Seite der ersten Gruppe.
const EINSTIEGS_SLUG = VERSIONS_NAV_GRUPPEN[0].items[0].slug

const ORDNER_DIALOG_TEXTS = {
  createTitle: 'Neuer Ordner',
  renameTitle: 'Ordner umbenennen',
  createDescription: 'Vergib einen Namen für den Ordner, um zusammengehörige Planversionen zu bündeln.',
  renameDescription: 'Ändere den Namen dieses Ordners.',
  placeholder: 'z.B. Szenarien 2027',
}

export function PlanversionenVerwaltung() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    planversionen,
    loading: versionenLoading,
    error: versionenError,
    create,
    rename,
    remove,
    move,
    duplicate,
  } = usePlanversionen()
  const {
    ordner,
    loading: ordnerLoading,
    error: ordnerError,
    create: createOrdner,
    rename: renameOrdner,
    remove: removeOrdner,
  } = usePlanversionOrdner()

  // Ordner-Aufklappzustand: standardmäßig offen; hier merken wir zugeklappte.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Version-Dialoge
  const [createVersionOpen, setCreateVersionOpen] = useState(false)
  const [createVersionOrdnerId, setCreateVersionOrdnerId] = useState<string | null>(null)
  const [renameVersionTarget, setRenameVersionTarget] = useState<Planversion | null>(null)
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<Planversion | null>(null)
  const [deletingVersion, setDeletingVersion] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  // Ordner-Dialoge
  const [createOrdnerOpen, setCreateOrdnerOpen] = useState(false)
  const [renameOrdnerTarget, setRenameOrdnerTarget] = useState<PlanversionOrdner | null>(null)

  const loading = versionenLoading || ordnerLoading
  const error = versionenError || ordnerError

  const freieVersionen = planversionen.filter((v) => v.ordner_id === null)
  const versionenIn = (ordnerId: string) => planversionen.filter((v) => v.ordner_id === ordnerId)

  function oeffnen(version: Planversion) {
    router.push(buildVersionsHref(version.id, EINSTIEGS_SLUG))
  }

  function toggleOrdner(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function neueVersionInOrdner(ordnerId: string | null) {
    setCreateVersionOrdnerId(ordnerId)
    setCreateVersionOpen(true)
  }

  async function handleMove(version: Planversion, ordnerId: string | null) {
    try {
      await move(version.id, ordnerId)
      const zielName =
        ordnerId === null ? 'Grundseite' : ordner.find((o) => o.id === ordnerId)?.name ?? 'Ordner'
      toast({ title: 'Verschoben', description: `„${version.name}" liegt jetzt in: ${zielName}.` })
    } catch (e) {
      toast({
        title: 'Fehler',
        description: e instanceof Error ? e.message : 'Verschieben fehlgeschlagen.',
        variant: 'destructive',
      })
    }
  }

  async function handleDuplicate(version: Planversion) {
    if (duplicatingId) return
    setDuplicatingId(version.id)
    try {
      const created = await duplicate(version.id)
      toast({ title: 'Dupliziert', description: `„${created.name}" wurde als Kopie angelegt.` })
    } catch (e) {
      toast({
        title: 'Fehler',
        description: e instanceof Error ? e.message : 'Duplizieren fehlgeschlagen.',
        variant: 'destructive',
      })
    } finally {
      setDuplicatingId(null)
    }
  }

  async function handleDeleteVersion() {
    if (!deleteVersionTarget) return
    setDeletingVersion(true)
    try {
      await remove(deleteVersionTarget.id)
      toast({ title: 'Gelöscht', description: `Planversion „${deleteVersionTarget.name}" wurde gelöscht.` })
      setDeleteVersionTarget(null)
    } catch (e) {
      toast({
        title: 'Fehler',
        description: e instanceof Error ? e.message : 'Löschen fehlgeschlagen.',
        variant: 'destructive',
      })
    } finally {
      setDeletingVersion(false)
    }
  }

  async function handleDeleteOrdner(o: PlanversionOrdner) {
    const anzahl = versionenIn(o.id).length
    if (anzahl > 0) {
      toast({
        title: 'Ordner nicht leer',
        description: `„${o.name}" enthält ${anzahl} Planversion${anzahl === 1 ? '' : 'en'}. Verschiebe oder lösche sie zuerst.`,
        variant: 'destructive',
      })
      return
    }
    try {
      await removeOrdner(o.id)
      toast({ title: 'Gelöscht', description: `Ordner „${o.name}" wurde gelöscht.` })
    } catch (e) {
      toast({
        title: 'Fehler',
        description: e instanceof Error ? e.message : 'Löschen fehlgeschlagen.',
        variant: 'destructive',
      })
    }
  }

  // Eine Planversion als Karte (in Ordner oder frei auf der Grundseite).
  function renderVersion(version: Planversion) {
    const andereOrdner = ordner.filter((o) => o.id !== version.ordner_id)
    const wirdDupliziert = duplicatingId === version.id
    return (
      <div
        key={version.id}
        className="group flex items-start justify-between gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
      >
        <button
          onClick={() => oeffnen(version)}
          disabled={wirdDupliziert}
          className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:opacity-60"
        >
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate font-medium" title={version.name}>
              {version.name}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {wirdDupliziert ? 'Wird dupliziert…' : 'Öffnen'}
            </span>
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Aktionen für {version.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRenameVersionTarget(version)}>
              <Pencil className="mr-2 h-4 w-4" />
              Umbenennen
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleDuplicate(version)}
              disabled={duplicatingId !== null}
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplizieren
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="mr-2 h-4 w-4" />
                In Ordner verschieben
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {andereOrdner.length === 0 ? (
                  <DropdownMenuItem disabled>Keine weiteren Ordner</DropdownMenuItem>
                ) : (
                  andereOrdner.map((o) => (
                    <DropdownMenuItem key={o.id} onClick={() => handleMove(version, o.id)}>
                      <Folder className="mr-2 h-4 w-4" />
                      <span className="truncate">{o.name}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {version.ordner_id !== null && (
              <DropdownMenuItem onClick={() => handleMove(version, null)}>
                <FolderMinus className="mr-2 h-4 w-4" />
                Aus Ordner entfernen
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteVersionTarget(version)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  const nichtsVorhanden = ordner.length === 0 && planversionen.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Planversionen
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Erstelle mehrere unabhängige Planversionen. Ordne sie bei Bedarf in Ordnern.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setCreateOrdnerOpen(true)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Neuer Ordner
          </Button>
          <Button onClick={() => neueVersionInOrdner(null)}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Planversion
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : nichtsVorhanden ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/60" />
          <p className="mt-4 font-medium">Noch keine Planversion vorhanden</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Lege deine erste Planversion an, um mit der strategischen Planung zu starten.
          </p>
          <Button className="mt-4" onClick={() => neueVersionInOrdner(null)}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Planversion
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Ordner */}
          {ordner.map((o) => {
            const inhalt = versionenIn(o.id)
            const offen = !collapsed.has(o.id)
            return (
              <Collapsible key={o.id} open={offen} onOpenChange={() => toggleOrdner(o.id)}>
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-2 p-3">
                    <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          offen && 'rotate-90',
                        )}
                      />
                      {offen ? (
                        <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Folder className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-medium" title={o.name}>
                        {o.name}
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {inhalt.length}
                      </span>
                    </CollapsibleTrigger>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Aktionen für Ordner {o.name}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => neueVersionInOrdner(o.id)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Neue Planversion
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRenameOrdnerTarget(o)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Umbenennen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteOrdner(o)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CollapsibleContent>
                    <div className="border-t p-3">
                      {inhalt.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-8 text-center">
                          <p className="text-sm text-muted-foreground">
                            Dieser Ordner ist noch leer.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => neueVersionInOrdner(o.id)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Neue Planversion hier anlegen
                          </Button>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {inhalt.map(renderVersion)}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}

          {/* Freie Planversionen */}
          {freieVersionen.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {freieVersionen.map(renderVersion)}
            </div>
          )}
        </div>
      )}

      {/* Version erstellen */}
      <PlanversionDialog
        open={createVersionOpen}
        onOpenChange={setCreateVersionOpen}
        mode="create"
        onSubmit={async (name) => {
          const created = await create(name, createVersionOrdnerId)
          toast({ title: 'Erstellt', description: `Planversion „${created.name}" wurde angelegt.` })
        }}
      />

      {/* Version umbenennen */}
      <PlanversionDialog
        open={renameVersionTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameVersionTarget(null)
        }}
        mode="rename"
        initialName={renameVersionTarget?.name ?? ''}
        onSubmit={async (name) => {
          if (!renameVersionTarget) return
          await rename(renameVersionTarget.id, name)
          toast({ title: 'Gespeichert', description: 'Der Name wurde aktualisiert.' })
        }}
      />

      {/* Ordner erstellen */}
      <PlanversionDialog
        open={createOrdnerOpen}
        onOpenChange={setCreateOrdnerOpen}
        mode="create"
        texts={ORDNER_DIALOG_TEXTS}
        onSubmit={async (name) => {
          const created = await createOrdner(name)
          toast({ title: 'Erstellt', description: `Ordner „${created.name}" wurde angelegt.` })
        }}
      />

      {/* Ordner umbenennen */}
      <PlanversionDialog
        open={renameOrdnerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameOrdnerTarget(null)
        }}
        mode="rename"
        texts={ORDNER_DIALOG_TEXTS}
        initialName={renameOrdnerTarget?.name ?? ''}
        onSubmit={async (name) => {
          if (!renameOrdnerTarget) return
          await renameOrdner(renameOrdnerTarget.id, name)
          toast({ title: 'Gespeichert', description: 'Der Name wurde aktualisiert.' })
        }}
      />

      {/* Version löschen bestätigen */}
      <AlertDialog
        open={deleteVersionTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deletingVersion) setDeleteVersionTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planversion löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Planversion „{deleteVersionTarget?.name}" und <strong>alle</strong> darin
              gepflegten Daten werden unwiderruflich gelöscht. Dieser Vorgang kann nicht rückgängig
              gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingVersion}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteVersion()
              }}
              disabled={deletingVersion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingVersion ? 'Löschen…' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
