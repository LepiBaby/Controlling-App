import { test, expect } from '@playwright/test'

// PROJ-54: Marketing-Planung — Kurzfristige Planung
//
// Interaktionstests (Inline-Editing, Bulk-Edit, Reset, Notizen) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Auth-Tests (401/400/200) sind durch Vitest-Integrationstests in route.test.ts abgedeckt.
// Berechnungslogik (historische Vorbelegung, Gewichtung) ist durch Unit-Tests in historisch/route.test.ts abgedeckt.

// ─── Seitenexistenz & Auth-Guard ─────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/marketingplanung liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/marketingplanung')
  expect(response?.status()).toBeLessThan(400)
})

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/marketingplanung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/marketingplanung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Kurzfristige-Planung Landing-Seite ──────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Bestehende Planungsseiten nicht betroffen ───────────────────

test('unauthenticated user is still redirected from /dashboard/kurzfristige-planung/absatzplanung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is still redirected from /dashboard/kurzfristige-planung/einnahmenplanung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/einnahmenplanung')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is still redirected from /dashboard/kurzfristige-planung/marketing-einstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/marketing-einstellungen')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is still redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})
