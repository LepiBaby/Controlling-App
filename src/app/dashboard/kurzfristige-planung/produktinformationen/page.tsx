'use client'

import { NavSheet } from '@/components/nav-sheet'
import { LogoutButton } from '@/components/logout-button'
import { ProduktinformationenTabs } from '@/components/produktinformationen-tabs'
import { Toaster } from '@/components/ui/toaster'

export default function ProduktinformationenPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Controlling App</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Produktinformationen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Produktstammdaten für die kurzfristige Planung pflegen
            </p>
          </div>

          <ProduktinformationenTabs />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
