'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, MoreVertical, Pencil, Trash2, FolderOpen, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
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
import { useToast } from '@/hooks/use-toast'
import { usePlanversionen, type Planversion } from '@/hooks/use-planversionen'
import { PlanversionDialog } from '@/components/planversion-dialog'
import { buildVersionsHref, VERSIONS_NAV_GRUPPEN } from '@/lib/langfristige-planung-nav'

// Einstiegsseite einer geöffneten Version: erste Seite der ersten Gruppe.
const EINSTIEGS_SLUG = VERSIONS_NAV_GRUPPEN[0].items[0].slug

export function PlanversionenVerwaltung() {
  const router = useRouter()
  const { toast } = useToast()
  const { planversionen, loading, error, create, rename, remove } = usePlanversionen()

  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Planversion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Planversion | null>(null)
  const [deleting, setDeleting] = useState(false)

  function oeffnen(version: Planversion) {
    router.push(buildVersionsHref(version.id, EINSTIEGS_SLUG))
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await remove(deleteTarget.id)
      toast({ title: 'Gelöscht', description: `Planversion „${deleteTarget.name}" wurde gelöscht.` })
      setDeleteTarget(null)
    } catch (e) {
      toast({
        title: 'Fehler',
        description: e instanceof Error ? e.message : 'Löschen fehlgeschlagen.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Planversionen
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Erstelle mehrere unabhängige Planversionen. Jede Version hat eigene Daten.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Neue Planversion
        </Button>
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
      ) : planversionen.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/60" />
          <p className="mt-4 font-medium">Noch keine Planversion vorhanden</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Lege deine erste Planversion an, um mit der langfristigen Planung zu starten.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Planversion
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {planversionen.map((version) => (
            <div
              key={version.id}
              className="group flex items-start justify-between gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <button
                onClick={() => oeffnen(version)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium" title={version.name}>
                    {version.name}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">Öffnen</span>
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
                  <DropdownMenuItem onClick={() => setRenameTarget(version)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Umbenennen
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(version)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Erstellen */}
      <PlanversionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={async (name) => {
          const created = await create(name)
          toast({ title: 'Erstellt', description: `Planversion „${created.name}" wurde angelegt.` })
        }}
      />

      {/* Umbenennen */}
      <PlanversionDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        mode="rename"
        initialName={renameTarget?.name ?? ''}
        onSubmit={async (name) => {
          if (!renameTarget) return
          await rename(renameTarget.id, name)
          toast({ title: 'Gespeichert', description: 'Der Name wurde aktualisiert.' })
        }}
      />

      {/* Löschen bestätigen */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planversion löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Planversion „{deleteTarget?.name}" und <strong>alle</strong> darin gepflegten Daten
              werden unwiderruflich gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Löschen…' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
