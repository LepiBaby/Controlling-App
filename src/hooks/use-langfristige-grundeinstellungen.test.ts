import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useLangfristigeGrundeinstellungen,
  DEFAULT_PLANUNGSHORIZONT_MONATE,
  MIN_HORIZONT_MONATE,
  MAX_HORIZONT_MONATE,
} from './use-langfristige-grundeinstellungen'

const mockFetch = vi.fn()
global.fetch = mockFetch

const VERSION_ID = '11111111-1111-4111-8111-111111111111'

const STORED = {
  startmonat_monat: 3,
  startmonat_jahr: 2027,
  startkontostand: 5000,
  planungshorizont_monate: 24,
  planungshorizont_absatz_monate: 18,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockReset()
})

// ─── Konstanten ──────────────────────────────────────────────────────────────

describe('Konstanten', () => {
  it('default Planungshorizont ist 12', () => {
    expect(DEFAULT_PLANUNGSHORIZONT_MONATE).toBe(12)
  })
  it('Wertebereich ist 1–120', () => {
    expect(MIN_HORIZONT_MONATE).toBe(1)
    expect(MAX_HORIZONT_MONATE).toBe(120)
  })
})

// ─── Initial Load ────────────────────────────────────────────────────────────

describe('useLangfristigeGrundeinstellungen — initial load', () => {
  it('startet mit loading=true und Default-Horizont', () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => STORED })
    const { result } = renderHook(() => useLangfristigeGrundeinstellungen(VERSION_ID))
    expect(result.current.loading).toBe(true)
    expect(result.current.planungshorizont).toBe(DEFAULT_PLANUNGSHORIZONT_MONATE)
    expect(result.current.error).toBeNull()
  })

  it('lädt gespeicherte Werte der Version', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => STORED })
    const { result } = renderHook(() => useLangfristigeGrundeinstellungen(VERSION_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.startmonatMonat).toBe(3)
    expect(result.current.startmonatJahr).toBe(2027)
    expect(result.current.startkontostand).toBe(5000)
    expect(result.current.planungshorizont).toBe(24)
    expect(result.current.planungshorizontAbsatz).toBe(18)
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/langfristige-planung/${VERSION_ID}/grundeinstellungen`,
    )
  })

  it('akzeptiert null als Absatz-Horizont', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...STORED, planungshorizont_absatz_monate: null }),
    })
    const { result } = renderHook(() => useLangfristigeGrundeinstellungen(VERSION_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.planungshorizontAbsatz).toBeNull()
  })

  it('setzt error bei non-ok Antwort', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const { result } = renderHook(() => useLangfristigeGrundeinstellungen(VERSION_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })

  it('setzt error bei Netzwerkfehler', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useLangfristigeGrundeinstellungen(VERSION_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })
})

// ─── savePlanungshorizont ────────────────────────────────────────────────────

describe('savePlanungshorizont', () => {
  async function setup() {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => STORED })
    const hook = renderHook(() => useLangfristigeGrundeinstellungen(VERSION_ID))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('aktualisiert optimistisch vor der API-Antwort', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: true })
    act(() => {
      result.current.savePlanungshorizont(36)
    })
    expect(result.current.planungshorizont).toBe(36)
  })

  it('behält Wert nach erfolgreichem Speichern', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await result.current.savePlanungshorizont(36)
    })
    expect(result.current.planungshorizont).toBe(36)
  })

  it('rollt bei API-Fehler zurück und wirft', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: false })
    await act(async () => {
      await expect(result.current.savePlanungshorizont(36)).rejects.toThrow()
    })
    expect(result.current.planungshorizont).toBe(24)
  })
})

// ─── saveAbsatz ──────────────────────────────────────────────────────────────

describe('saveAbsatz', () => {
  async function setup() {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => STORED })
    const hook = renderHook(() => useLangfristigeGrundeinstellungen(VERSION_ID))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('setzt einen neuen Absatz-Wert', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await result.current.saveAbsatz(30)
    })
    expect(result.current.planungshorizontAbsatz).toBe(30)
  })

  it('setzt den Absatz-Wert auf null (nicht gesetzt)', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await result.current.saveAbsatz(null)
    })
    expect(result.current.planungshorizontAbsatz).toBeNull()
  })

  it('rollt bei API-Fehler zurück', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: false })
    await act(async () => {
      await expect(result.current.saveAbsatz(30)).rejects.toThrow()
    })
    expect(result.current.planungshorizontAbsatz).toBe(18)
  })
})

// ─── saveStartkontostand ─────────────────────────────────────────────────────

describe('saveStartkontostand', () => {
  async function setup() {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => STORED })
    const hook = renderHook(() => useLangfristigeGrundeinstellungen(VERSION_ID))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('aktualisiert den Startkontostand optimistisch', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: true })
    act(() => {
      result.current.saveStartkontostand(-1234.56)
    })
    expect(result.current.startkontostand).toBe(-1234.56)
  })

  it('rollt bei API-Fehler zurück und wirft', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: false })
    await act(async () => {
      await expect(result.current.saveStartkontostand(99)).rejects.toThrow()
    })
    expect(result.current.startkontostand).toBe(5000)
  })
})

// ─── saveStartmonat ──────────────────────────────────────────────────────────

describe('saveStartmonat', () => {
  async function setup() {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => STORED })
    const hook = renderHook(() => useLangfristigeGrundeinstellungen(VERSION_ID))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('aktualisiert Monat und Jahr optimistisch', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: true })
    act(() => {
      result.current.saveStartmonat(1, 2030)
    })
    expect(result.current.startmonatMonat).toBe(1)
    expect(result.current.startmonatJahr).toBe(2030)
  })

  it('rollt Monat und Jahr bei API-Fehler zurück', async () => {
    const { result } = await setup()
    mockFetch.mockResolvedValueOnce({ ok: false })
    await act(async () => {
      await expect(result.current.saveStartmonat(1, 2030)).rejects.toThrow()
    })
    expect(result.current.startmonatMonat).toBe(3)
    expect(result.current.startmonatJahr).toBe(2027)
  })
})
