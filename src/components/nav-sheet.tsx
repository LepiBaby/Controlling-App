'use client'

import { useState } from 'react'
import { Menu, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { usePathname } from 'next/navigation'
import { BereichsSwitcher, getAktivesBereich } from '@/components/bereichs-switcher'

const REPORTING_NAV_GROUPS = [
  {
    label: 'Datenpflege',
    items: [
      { href: '/dashboard/kpi-modell', label: 'KPI-Modell Verwaltung' },
      { href: '/dashboard/einnahmen', label: 'Einnahmen' },
      { href: '/dashboard/umsatz', label: 'Umsatz' },
      { href: '/dashboard/ausgaben', label: 'Ausgaben & Kosten' },
      { href: '/dashboard/produktkosten', label: 'Produktkosten' },
      { href: '/dashboard/bestandsverwaltung', label: 'Bestandsverwaltung' },
      { href: '/dashboard/vermoegenswerte', label: 'Vermögenswerte' },
    ],
  },
  {
    label: 'Auswertungen',
    items: [
      { href: '/dashboard/rentabilitaet', label: 'Rentabilität' },
      { href: '/dashboard/liquiditaet', label: 'Liquidität' },
      { href: '/dashboard/abschreibungen', label: 'Abschreibungen' },
      { href: '/dashboard/investitionen', label: 'Investitionen' },
      { href: '/dashboard/vorsteuer', label: 'Abziehbare Vorsteuer' },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { href: '/dashboard/reporting/rentabilitaet', label: 'Rentabilitätsreport' },
      { href: '/dashboard/reporting/deckungsbeitrag', label: 'Deckungsbeitragsreport' },
      { href: '/dashboard/reporting/break-even', label: 'Break-Even-Report' },
      { href: '/dashboard/reporting/liquiditaet', label: 'Liquiditätsreport' },
      { href: '/dashboard/reporting/umsatzsteuer', label: 'Umsatzsteuer-Report' },
      { href: '/dashboard/reporting/vermoegen', label: 'Vermögensbericht' },
    ],
  },
]

const KURZFRISTIGE_PLANUNG_NAV_GROUPS = [
  {
    label: 'Kurzfristige Planung',
    items: [
      { href: '/dashboard/kurzfristige-planung/absatzeinstellungen', label: 'Absatzeinstellungen' },
      { href: '/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen', label: 'Verkaufsgebühr-Einstellungen' },
      { href: '/dashboard/kurzfristige-planung/versandausgaben-einstellungen', label: 'Versandausgaben-Einstellungen' },
      { href: '/dashboard/kurzfristige-planung/auszahlungseinstellungen', label: 'Auszahlungseinstellungen' },
    ],
  },
]

const NAV_GROUPS_BY_AREA: Record<string, typeof REPORTING_NAV_GROUPS> = {
  reporting: REPORTING_NAV_GROUPS,
  'kurzfristige-planung': KURZFRISTIGE_PLANUNG_NAV_GROUPS,
  'langfristige-planung': [],
}

export function NavSheet() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const pathname = usePathname()
  const aktiv = getAktivesBereich(pathname)
  const navGroups = NAV_GROUPS_BY_AREA[aktiv] ?? []

  function toggleGroup(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Navigation öffnen</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>
            <a href="/dashboard" onClick={() => setOpen(false)} className="hover:opacity-80">
              Controlling App
            </a>
          </SheetTitle>
        </SheetHeader>
        <div className="border-b px-3 py-3">
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bereich
          </p>
          <BereichsSwitcher className="w-full" />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-4">
            {navGroups.map((group) => {
              const isCollapsed = collapsed[group.label] ?? false
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {group.label}
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {!isCollapsed && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                              isActive
                                ? 'bg-muted text-foreground'
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {item.label}
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
