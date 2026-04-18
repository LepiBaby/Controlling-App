'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

interface KpiAddCategoryFormProps {
  placeholder?: string
  onAdd: (name: string) => Promise<void>
}

export function KpiAddCategoryForm({ placeholder = 'Neue Kategorie...', onAdd }: KpiAddCategoryFormProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Name darf nicht leer sein.'); return }
    setError('')
    setLoading(true)
    try {
      await onAdd(trimmed)
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          placeholder={placeholder}
          className="h-8 text-sm"
          disabled={loading}
        />
        <Button type="submit" size="sm" disabled={loading || !name.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}
