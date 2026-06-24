import { NavSheet } from '@/components/nav-sheet'
import { BereichsKartenSwitcher } from '@/components/bereichs-karten-switcher'
import { LogoutButton } from '@/components/logout-button'
import { PlanversionenVerwaltung } from '@/components/planversionen-verwaltung'
import { Toaster } from '@/components/ui/toaster'

export default function LangfristigePlanungPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Langfristige Planung</h1>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-8">
          <BereichsKartenSwitcher />
          <PlanversionenVerwaltung />
        </div>
      </main>
      <Toaster />
    </div>
  )
}
