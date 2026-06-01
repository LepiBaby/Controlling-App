'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getAktivesBereich } from '@/components/bereichs-switcher'

const BEREICHE = [
  { value: 'reporting', label: 'Reporting', href: '/dashboard' },
  { value: 'kurzfristige-planung', label: 'Kurzfristige Planung', href: '/dashboard/kurzfristige-planung' },
  { value: 'langfristige-planung', label: 'Langfristige Planung', href: '/dashboard/langfristige-planung' },
]

export function BereichsKartenSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  const aktiv = getAktivesBereich(pathname)

  return (
    <div className="border-b bg-muted/20">
      <div className="mx-auto max-w-7xl px-6">
        <nav className="flex overflow-x-auto">
          {BEREICHE.map((bereich) => {
            const isAktiv = bereich.value === aktiv
            return (
              <button
                key={bereich.value}
                onClick={() => router.push(bereich.href)}
                className={cn(
                  'shrink-0 px-5 py-3.5 text-sm transition-colors border-b-2 -mb-px',
                  isAktiv
                    ? 'border-primary font-semibold text-foreground'
                    : 'border-transparent font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                )}
              >
                {bereich.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
