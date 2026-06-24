import { test, expect } from '@playwright/test'

// PROJ-76: Auszahlungseinstellungen — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/auszahlungseinstellungen
// Interaktionstests (Plattform-Tabs, Auto-Save Rhythmus/Ankermonat/Verschiebung, Marketing-
// Mehrfachauswahl, Rollback) erfordern eine authentifizierte Session + Planversion + KPI-Modell-
// Stammdaten und sind als manuell geprüft dokumentiert.
// API-Integrationstests (200/400/401/404/500) sind durch Vitest in route.test.ts abgedeckt (22 Tests).
// Hook-/Berechnungstests sind durch Vitest in use-langfristige-auszahlungs-einstellungen.test.ts abgedeckt.

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/auszahlungseinstellungen`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Auszahlungseinstellungen-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Auszahlungseinstellungen to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Auszahlungseinstellungen weiterhin erreichbar ──

test('/dashboard/kurzfristige-planung/auszahlungseinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/auszahlungseinstellungen')
  expect(response?.status()).toBeLessThan(400)
})
