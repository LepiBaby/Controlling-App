import { test, expect } from '@playwright/test'

// PROJ-78: Vertriebseinstellungen — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/vertriebseinstellungen
// Interaktionstests (4 Reiter, zentrale Plattform, Retouren-Allgemein + Plattform-Reiter, Auto-Save
// Gruppierung/Zahlungsziel/Produktwerte, Lager-Bulk, Rollback) erfordern eine authentifizierte Session
// + Planversion + KPI-Modell-Stammdaten (Produkte/Plattformen) und sind als manuell geprüft dokumentiert.
// API-Integrationstests (200/400/401/404) sind durch Vitest abgedeckt (5 route.test.ts-Dateien, 36 Tests).

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/vertriebseinstellungen`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Vertriebseinstellungen-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Vertriebseinstellungen to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Vertriebseinstellungen weiterhin erreichbar ────

test('/dashboard/kurzfristige-planung/vertriebseinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/vertriebseinstellungen')
  expect(response?.status()).toBeLessThan(400)
})
