'use client'

import { KpiCategoryRow } from '@/components/kpi-category-row'
import { KpiAddCategoryForm } from '@/components/kpi-add-category-form'
import { Skeleton } from '@/components/ui/skeleton'
import { FolderTree } from 'lucide-react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'

interface KpiCategoryTreeProps {
  tree: KpiCategory[]
  loading: boolean
  error: string | null
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (category: KpiCategory) => void
  onAddCategory: (name: string) => Promise<void>
  onAddChild: (name: string, parentId: string, level: 1 | 2 | 3) => Promise<void>
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export function KpiCategoryTree({
  tree,
  loading,
  error,
  onRename,
  onDelete,
  onAddCategory,
  onAddChild,
  onMoveUp,
  onMoveDown,
}: KpiCategoryTreeProps) {
  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-7 w-full" />)}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive p-2">{error}</p>
  }

  return (
    <div className="space-y-3">
      {tree.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <FolderTree className="h-8 w-8" />
          <p className="text-sm">Noch keine Kategorien vorhanden.</p>
        </div>
      ) : (
        <div className="rounded-md border bg-card p-2">
          {tree.map((cat, i) => (
            <KpiCategoryRow
              key={cat.id}
              category={cat}
              isFirst={i === 0}
              isLast={i === tree.length - 1}
              onRename={onRename}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
            />
          ))}
        </div>
      )}

      <KpiAddCategoryForm
        placeholder="Neue Hauptkategorie hinzufügen..."
        onAdd={onAddCategory}
      />
    </div>
  )
}
