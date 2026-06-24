import { test, expect } from '@playwright/test'

// PROJ-75: Grundeinstellungen — Langfristige Planung
//
// Die Seite ist versionsgebunden: /dashboard/langfristige-planung/[versionId]/grundeinstellungen
// Interaktionstests (Auto-Save Startmonat/Horizont, Toast, Validierung, Rollback) erfordern eine
// authentifizierte Session + eine angelegte Planversion und sind als manuell geprüft dokumentiert.
// API-Integrationstests (200/400/401/404/500) sind durch Vitest in route.test.ts abgedeckt (20 Tests).
// Hook-Tests sind durch Vitest in use-langfristige-grundeinstellungen.test.ts abgedeckt (15 Tests).

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/grundeinstellungen`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Grundeinstellungen-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Grundeinstellungen to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Grundeinstellungen weiterhin erreichbar ────────

test('/dashboard/kurzfristige-planung/grundeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})
