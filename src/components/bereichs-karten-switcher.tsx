'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAktivesBereich } from '@/components/bereichs-switcher'

const BEREICHE = [
  {
    value: 'reporting',
    label: 'Reporting',
    description: 'Auswertungen, Reports & Datenpflege',
    href: '/dashboard',
  },
  {
    value: 'kurzfristige-planung',
    label: 'Kurzfristige Planung',
    description: 'Kommt in Kürze',
    href: '/dashboard/kurzfristige-planung',
  },
  {
    value: 'langfristige-planung',
    label: 'Langfristige Planung',
    description: 'Kommt in Kürze',
    href: '/dashboard/langfristige-planung',
  },
]

export function BereichsKartenSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  const aktiv = getAktivesBereich(pathname)

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bereich</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {BEREICHE.map((bereich) => {
          const isAktiv = bereich.value === aktiv
          return (
            <button
              key={bereich.value}
              onClick={() => router.push(bereich.href)}
              className={cn(
                'rounded-lg p-4 text-left transition-colors',
                isAktiv
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'border border-border bg-card hover:bg-muted/50'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={cn('font-semibold text-sm', isAktiv ? 'text-foreground' : 'text-muted-foreground')}>
                  {bereich.label}
                </p>
                {isAktiv && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{bereich.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
