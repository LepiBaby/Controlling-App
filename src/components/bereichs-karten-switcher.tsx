'use client'

import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, CalendarClock, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAktivesBereich } from '@/components/bereichs-switcher'

const BEREICHE = [
  {
    value: 'reporting',
    label: 'Reporting',
    description: 'Auswertungen, Reports & Datenpflege',
    icon: BarChart3,
    href: '/dashboard',
  },
  {
    value: 'kurzfristige-planung',
    label: 'Kurzfristige Planung',
    description: 'Absatz-, Einnahmen-, Ausgaben- & Bestellplanung',
    icon: CalendarClock,
    href: '/dashboard/kurzfristige-planung',
  },
  {
    value: 'langfristige-planung',
    label: 'Langfristige Planung',
    description: 'Strategische Mehrjahresplanung & Szenarien',
    icon: Target,
    href: '/dashboard/langfristige-planung',
  },
]

export function BereichsKartenSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  const aktiv = getAktivesBereich(pathname)

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {BEREICHE.map((bereich) => {
        const Icon = bereich.icon
        const isAktiv = bereich.value === aktiv
        return (
          <button
            key={bereich.value}
            onClick={() => router.push(bereich.href)}
            className={cn(
              'rounded-xl p-6 text-left transition-all',
              isAktiv
                ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                : 'bg-muted/60 border border-border hover:bg-muted hover:border-muted-foreground/30'
            )}
          >
            <Icon
              className={cn(
                'h-7 w-7 mb-3',
                isAktiv ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}
            />
            <p className={cn('text-base font-semibold', isAktiv ? 'text-primary-foreground' : 'text-foreground')}>
              {bereich.label}
            </p>
            <p className={cn('mt-1 text-sm', isAktiv ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
              {bereich.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}
