import { test, expect } from '@playwright/test'

// PROJ-83: Steuereinstellungen — Langfristige Planung
//
// Die Seite ist versionsgebunden:
//   /dashboard/langfristige-planung/[versionId]/steuereinstellungen
// Interaktionstests (UST-Sätze pflegen, Gesamt/Aufgeteilt-Umschalter, Produktverkäufe/
// Marketing/Investitionen aus dem Versions-KPI-Modell, Fiskalverzollung, Auto-Save,
// Versionsisolation) erfordern eine authentifizierte Session + angelegte Planversion +
// Versions-KPI-Stammdaten und sind als manuell/Code-Review geprüft dokumentiert.
// API-Integrationstests (200/400/401/404) sind durch Vitest in den vier route.test.ts
// abgedeckt (26 Tests).

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/steuereinstellungen`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Steuereinstellungen-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Steuereinstellungen to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Steuereinstellungen weiterhin erreichbar ────────

test('/dashboard/kurzfristige-planung/steuereinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/steuereinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Langfristige Finanzierungseinstellungen weiterhin erreichbar ─

test('langfristige Finanzierungs-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/finanzierungseinstellungen`)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: globales KPI-Modell weiterhin erreichbar ─────────────────────

test('unauthenticated user is redirected from /dashboard/kpi-modell to /login', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})
