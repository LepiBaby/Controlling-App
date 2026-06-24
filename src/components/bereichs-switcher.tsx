'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const BEREICHE = [
  { value: 'reporting', label: 'Reporting', href: '/dashboard' },
  { value: 'kurzfristige-planung', label: 'Kurzfristige Planung', href: '/dashboard/kurzfristige-planung' },
  { value: 'langfristige-planung', label: 'Langfristige Planung', href: '/dashboard/langfristige-planung' },
] as const

export function getAktivesBereich(pathname: string): string {
  if (pathname.startsWith('/dashboard/kurzfristige-planung')) return 'kurzfristige-planung'
  if (pathname.startsWith('/dashboard/langfristige-planung')) return 'langfristige-planung'
  return 'reporting'
}

export function BereichsSwitcher({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const aktiv = getAktivesBereich(pathname)

  return (
    <Select
      value={aktiv}
      onValueChange={(value) => {
        const bereich = BEREICHE.find((b) => b.value === value)
        if (bereich) router.push(bereich.href)
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BEREICHE.map((b) => (
          <SelectItem key={b.value} value={b.value}>
            {b.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
