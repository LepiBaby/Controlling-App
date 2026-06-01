import { NavSheet } from '@/components/nav-sheet'
import { BereichsKartenSwitcher } from '@/components/bereichs-karten-switcher'
import { LogoutButton } from '@/components/logout-button'

export default function LangfristigePlanungPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Controlling App</h1>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      <BereichsKartenSwitcher />

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-lg font-medium text-muted-foreground">Langfristige Planung</p>
            <p className="mt-2 text-sm text-muted-foreground">Dieser Bereich wird in Kürze verfügbar sein.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
