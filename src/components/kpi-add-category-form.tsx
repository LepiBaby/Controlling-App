'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

interface KpiAddCategoryFormProps {
  placeholder?: string
  skuMode?: boolean
  onAdd: (name: string, skuCode?: string) => Promise<void>
}

export function KpiAddCategoryForm({ placeholder = 'Neue Kategorie...', skuMode = false, onAdd }: KpiAddCategoryFormProps) {
  const [name, setName] = useState('')
  const [skuCode, setSkuCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedSku = skuCode.trim()
    if (!trimmedName) { setError('Name darf nicht leer sein.'); return }
    if (skuMode && !trimmedSku) { setError('SKU-Code darf nicht leer sein.'); return }
    setError('')
    setLoading(true)
    try {
      await onAdd(trimmedName, skuMode ? trimmedSku : undefined)
      setName('')
      setSkuCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = skuMode ? (name.trim() && skuCode.trim()) : name.trim()

  if (skuMode) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-1">
        <div className="flex gap-2">
          <Input
            value={skuCode}
            onChange={e => { setSkuCode(e.target.value); setError('') }}
            placeholder="SKU-Code..."
            className="h-8 text-sm w-28 shrink-0 font-mono"
            disabled={loading}
          />
          <Input
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder="Anzeigename..."
            className="h-8 text-sm flex-1"
            disabled={loading}
          />
          <Button type="submit" size="sm" disabled={loading || !canSubmit}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    )
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
