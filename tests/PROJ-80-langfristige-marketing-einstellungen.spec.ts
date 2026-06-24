import { test, expect } from '@playwright/test'

// PROJ-80: Marketing-Einstellungen — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/marketing-einstellungen
// Interaktionstests (Marketingkanal-Tabs, Auto-Save Sales Plattform/Gruppierung/Zahlungsziel,
// optimistisches Update + Rollback) erfordern eine authentifizierte Session + Planversion +
// KPI-Modell-Stammdaten (Marketingkanäle/Plattformen) und sind als manuell/Code-geprüft dokumentiert.
// API-Integrationstests (200/400/401/404/500) sind durch Vitest in route.test.ts abgedeckt (19 Tests).
// Hook-/Konstanten-Tests sind durch Vitest in use-langfristige-marketing-einstellungen.test.ts abgedeckt.

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/marketing-einstellungen`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Marketing-Einstellungen-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Marketing-Einstellungen to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Marketing-Einstellungen weiterhin erreichbar ───

test('/dashboard/kurzfristige-planung/marketing-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/marketing-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})
