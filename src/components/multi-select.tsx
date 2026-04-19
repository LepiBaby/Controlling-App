'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'

interface Option {
  id: string
  name: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({ options, selected, onChange, placeholder = 'Alle', className }: MultiSelectProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find(o => o.id === selected[0])?.name ?? placeholder)
      : `${selected.length} ausgewählt`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 justify-between gap-2 text-sm font-normal ${className ?? 'w-44'} ${selected.length > 0 ? '' : 'text-muted-foreground'}`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Keine Optionen</p>
        ) : (
          <ul className="space-y-0.5">
            {options.map(opt => (
              <li key={opt.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
                  <Checkbox
                    checked={selected.includes(opt.id)}
                    onCheckedChange={() => toggle(opt.id)}
                  />
                  <span className="text-sm leading-none">{opt.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
