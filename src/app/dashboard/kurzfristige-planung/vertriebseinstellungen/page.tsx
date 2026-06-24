'use client'

import { NavSheet } from '@/components/nav-sheet'
import { LogoutButton } from '@/components/logout-button'
import { VersandausgabenEinstellungenTabelle } from '@/components/versandausgaben-einstellungen-tabelle'
import { LagerausgabenEinstellungenTabelle } from '@/components/lagerausgaben-einstellungen-tabelle'
import { RetourenEinstellungenTabelle } from '@/components/retouren-einstellungen-tabelle'
import { ErsatzteileKulanzEinstellungenTabelle } from '@/components/ersatzteile-kulanz-einstellungen-tabelle'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'

export default function VertriebseinstellungenPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NavSheet />
            <h1 className="text-lg font-semibold">Vertriebseinstellungen</h1>
          </div>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl">
          <Tabs defaultValue="versand" className="space-y-6">
            <TabsList className="w-full h-auto">
              <TabsTrigger value="versand" className="flex-1">Versand-Einstellungen</TabsTrigger>
              <TabsTrigger value="lager" className="flex-1">Lager-Einstellungen</TabsTrigger>
              <TabsTrigger value="retouren" className="flex-1">Retoureneinstellungen</TabsTrigger>
              <TabsTrigger value="ersatzteile" className="flex-1">Ersatzteile/Kulanz-Einstellungen</TabsTrigger>
            </TabsList>

            <TabsContent value="versand" className="mt-0">
              <VersandausgabenEinstellungenTabelle />
            </TabsContent>

            <TabsContent value="lager" className="mt-0">
              <LagerausgabenEinstellungenTabelle />
            </TabsContent>

            <TabsContent value="retouren" className="mt-0">
              <RetourenEinstellungenTabelle />
            </TabsContent>

            <TabsContent value="ersatzteile" className="mt-0">
              <ErsatzteileKulanzEinstellungenTabelle />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Toaster />
    </div>
  )
}
