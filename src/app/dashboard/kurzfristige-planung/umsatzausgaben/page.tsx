'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { NavSheet } from '@/components/nav-sheet'
import { LogoutButton } from '@/components/logout-button'
import { Toaster } from '@/components/ui/toaster'
import { UmsatzausgabenTabelle } from '@/components/umsatzausgaben-tabelle'

function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const week1Mon = new Date(jan4.getTime() - (jan4Day - 1) * 86400000)
  return new Date(week1Mon.getTime() + (week - 1) * 7 * 86400000)
}

function UmsatzausgabenContent() {
  const params = useSearchParams()
  const refKw = params.get('ref_kw')
  const refJahr = params.get('ref_jahr')

  let referenceDate: Date | undefined
  if (refKw && refJahr) {
    const kw = parseInt(refKw, 10)
    const jahr = parseInt(refJahr, 10)
    if (!isNaN(kw) && !isNaN(jahr)) {
      referenceDate = getISOWeekMonday(jahr, kw)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">
              Umsatzausgaben
              {referenceDate && (
                <span className="ml-2 text-sm font-normal text-amber-600">
                  (Simulation KW{refKw} / {refJahr})
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-full space-y-4">
          <UmsatzausgabenTabelle referenceDate={referenceDate} />
        </div>
      </main>

      <Toaster />
    </div>
  )
}

export default function UmsatzausgabenPage() {
  return (
    <Suspense>
      <UmsatzausgabenContent />
    </Suspense>
  )
}
