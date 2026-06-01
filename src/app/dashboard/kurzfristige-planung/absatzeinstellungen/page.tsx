'use client'

import { NavSheet } from '@/components/nav-sheet'
import { LogoutButton } from '@/components/logout-button'
import { AbsatzeinstellungenTabelle } from '@/components/absatzeinstellungen-tabelle'
import { Toaster } from '@/components/ui/toaster'

export default function AbsatzeinstellungenPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Absatzeinstellungen</h1>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h2 className="text-base font-semibold">Absatzberechnungsmethode je Plattform &amp; Produkt</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Wähle für jede Sales-Plattform und jedes Produkt die Methode zur Absatzberechnung.
              Bei gewichtetem Mittelwert müssen die drei Drittelsgewichtungen zusammen 100 % ergeben.
            </p>
          </div>
          <AbsatzeinstellungenTabelle />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
