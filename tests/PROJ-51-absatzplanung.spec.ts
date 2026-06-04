import { test, expect } from '@playwright/test'

// PROJ-51: Absatzplanung — Kurzfristige Planung
//
// Interaktionstests (Inline-Editing, Bulk-Edit, Reset) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Auth-Tests (401/400/200) sind durch Vitest-Integrationstests in route.test.ts abgedeckt.
// Hook-Logik (berechnePlanungswochen, key-Funktionen) ist durch Unit-Tests in use-absatzplanung.test.ts abgedeckt.

// ─── Seitenexistenz & Auth-Guard ─────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/absatzplanung liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  expect(response?.status()).toBeLessThan(400)
})

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/absatzplanung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Kurzfristige-Planung Landing-Seite ──────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Bestehende Dashboard-Seiten nicht betroffen ─────────────────

test('unauthenticated user is still redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is still redirected from /dashboard/kpi-modell to /login', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is still redirected from /dashboard/kurzfristige-planung/absatzeinstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/absatzeinstellungen')
  await expect(page).toHaveURL(/\/login/)
})
