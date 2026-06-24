import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LangfristigeGruppierungForm } from './langfristige-gruppierung-form'

// PROJ-78 Bug #1 (Regression): Das gespeicherte „Zahlungsziel (Tage)" muss beim
// Laden im Eingabefeld erscheinen. Zuvor sperrte die Einmal-Initialisierung den
// leeren Wert, weil der Hook mit loading=false startete.

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

beforeEach(() => {
  vi.restoreAllMocks()
})

function mockGet(value: { gruppierung: string; zahlungsziel_tage: number | null } | null) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => value,
  }) as unknown as typeof fetch
}

describe('LangfristigeGruppierungForm', () => {
  it('zeigt das gespeicherte Zahlungsziel (versionsweit) beim Laden an', async () => {
    mockGet({ gruppierung: 'quartalsweise', zahlungsziel_tage: 14 })
    render(
      <LangfristigeGruppierungForm versionId="v1" endpointSuffix="retouren-allgemein-einstellungen" />,
    )
    await waitFor(() => {
      const input = screen.getByLabelText(/Zahlungsziel/i) as HTMLInputElement
      expect(input.value).toBe('14')
    })
  })

  it('zeigt das gespeicherte Zahlungsziel (plattformgebunden) beim Laden an', async () => {
    mockGet({ gruppierung: 'monatlich', zahlungsziel_tage: 30 })
    render(
      <LangfristigeGruppierungForm
        versionId="v1"
        endpointSuffix="versand-plattform-einstellungen"
        plattformId="p1"
      />,
    )
    await waitFor(() => {
      const input = screen.getByLabelText(/Zahlungsziel/i) as HTMLInputElement
      expect(input.value).toBe('30')
    })
  })

  it('bleibt leer, wenn noch kein Zahlungsziel gespeichert ist', async () => {
    mockGet(null)
    render(
      <LangfristigeGruppierungForm versionId="v1" endpointSuffix="lager-plattform-einstellungen" plattformId="p1" />,
    )
    await waitFor(() => {
      const input = screen.getByLabelText(/Zahlungsziel/i) as HTMLInputElement
      expect(input.value).toBe('')
    })
  })
})
