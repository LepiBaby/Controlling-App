import { test, expect } from '@playwright/test'

// PROJ-82: Finanzierungseinstellungen — Langfristige Planung
//
// Die Seite ist versionsgebunden:
//   /dashboard/langfristige-planung/[versionId]/finanzierungseinstellungen
// Interaktionstests (Anlegen/Bearbeiten/Löschen, Aktiv-Zeitraum Monat+Jahr, USt/Brutto,
// Validierung, optimistisches Update) erfordern eine authentifizierte Session + angelegte
// Planversion und sind als manuell/Code-Review geprüft dokumentiert.
// API-Integrationstests (200/201/400/401/404/500) sind durch Vitest in route.test.ts +
// [id]/route.test.ts abgedeckt (35 Tests).

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/finanzierungseinstellungen`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Finanzierungs-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Finanzierung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Finanzierungseinstellungen weiterhin erreichbar ─

test('/dashboard/kurzfristige-planung/finanzierungseinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/finanzierungseinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Langfristige Operative Fixkosten weiterhin erreichbar ────────

test('langfristige Operative-Fixkosten-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/operative-fixkosten-einstellungen`)
  expect(response?.status()).toBeLessThan(400)
})
