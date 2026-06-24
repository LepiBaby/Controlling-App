'use client'

import { NavSheet } from '@/components/nav-sheet'
import { LogoutButton } from '@/components/logout-button'
import { MarketingplanungKacheln } from '@/components/marketingplanung-kacheln'
import { MarketingplanungTabelle } from '@/components/marketingplanung-tabelle'
import { Toaster } from '@/components/ui/toaster'

export default function MarketingplanungPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Marketing-Planung</h1>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        <div className="mx-auto max-w-full">
          <MarketingplanungKacheln />
        </div>
        <div className="mx-auto max-w-full">
          <MarketingplanungTabelle />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
