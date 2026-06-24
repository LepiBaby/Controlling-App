'use client'

import { NavSheet } from '@/components/nav-sheet'
import { LogoutButton } from '@/components/logout-button'
import { LiquiditaetsauswertungTabelle } from '@/components/liquiditaetsauswertung-tabelle'
import { LiquiditaetsauswertungChart } from '@/components/liquiditaetsauswertung-chart'
import { useLiquiditaetsauswertung } from '@/hooks/use-liquiditaetsauswertung'

export default function LiquiditaetsauswertungPage() {
  const data = useLiquiditaetsauswertung()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Liquiditätsauswertung</h1>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-full space-y-4">
          {!data.error && !data.isEmpty && (
            <LiquiditaetsauswertungChart columns={data.columns} rows={data.rows} loading={data.loading} />
          )}
          <LiquiditaetsauswertungTabelle data={data} />
        </div>
      </main>
    </div>
  )
}
