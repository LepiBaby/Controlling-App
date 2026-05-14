'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const NAV_GROUPS = [
  {
    label: 'Datenpflege',
    items: [
      { href: '/dashboard/kpi-modell', label: 'KPI-Modell Verwaltung' },
      { href: '/dashboard/einnahmen', label: 'Einnahmen' },
      { href: '/dashboard/umsatz', label: 'Umsatz' },
      { href: '/dashboard/ausgaben', label: 'Ausgaben & Kosten' },
      { href: '/dashboard/produktkosten', label: 'Produktkosten' },
      { href: '/dashboard/bestandsverwaltung', label: 'Bestandsverwaltung' },
    ],
  },
  {
    label: 'Auswertungen',
    items: [
      { href: '/dashboard/rentabilitaet', label: 'Rentabilität' },
      { href: '/dashboard/liquiditaet', label: 'Liquidität' },
      { href: '/dashboard/abschreibungen', label: 'Abschreibungen' },
      { href: '/dashboard/investitionen', label: 'Investitionen' },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { href: '/dashboard/reporting/rentabilitaet', label: 'Rentabilitätsreport' },
    ],
  },
]

export function NavSheet() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Navigation öffnen</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>
            <a href="/dashboard" onClick={() => setOpen(false)} className="hover:opacity-80">
              Controlling App
            </a>
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
