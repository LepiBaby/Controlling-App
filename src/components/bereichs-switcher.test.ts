import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}))

vi.mock('@/components/ui/select', () => ({
  Select: vi.fn(),
  SelectContent: vi.fn(),
  SelectItem: vi.fn(),
  SelectTrigger: vi.fn(),
  SelectValue: vi.fn(),
}))

import { getAktivesBereich } from '@/components/bereichs-switcher'

describe('getAktivesBereich', () => {
  it('returns "reporting" for /dashboard root', () => {
    expect(getAktivesBereich('/dashboard')).toBe('reporting')
  })

  it('returns "reporting" for a Datenpflege sub-page', () => {
    expect(getAktivesBereich('/dashboard/kpi-modell')).toBe('reporting')
  })

  it('returns "reporting" for a deep Reporting sub-page', () => {
    expect(getAktivesBereich('/dashboard/reporting/rentabilitaet')).toBe('reporting')
  })

  it('returns "reporting" for /dashboard/ausgaben', () => {
    expect(getAktivesBereich('/dashboard/ausgaben')).toBe('reporting')
  })

  it('returns "kurzfristige-planung" for exact match', () => {
    expect(getAktivesBereich('/dashboard/kurzfristige-planung')).toBe('kurzfristige-planung')
  })

  it('returns "kurzfristige-planung" for a nested sub-path', () => {
    expect(getAktivesBereich('/dashboard/kurzfristige-planung/some-page')).toBe('kurzfristige-planung')
  })

  it('returns "langfristige-planung" for exact match', () => {
    expect(getAktivesBereich('/dashboard/langfristige-planung')).toBe('langfristige-planung')
  })

  it('returns "langfristige-planung" for a nested sub-path', () => {
    expect(getAktivesBereich('/dashboard/langfristige-planung/some-page')).toBe('langfristige-planung')
  })

  it('does not confuse "kurzfristige-planung" with an unrelated path starting similarly', () => {
    expect(getAktivesBereich('/dashboard/kurzfristige-planung-extra')).toBe('kurzfristige-planung')
  })
})
