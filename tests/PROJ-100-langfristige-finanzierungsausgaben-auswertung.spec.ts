import { test, expect } from '@playwright/test'

// PROJ-100: Finanzierungsausgaben-Auswertung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/finanzierungsausgaben-auswertung
// Interaktionstests (Zeitbasis Monat/Jahr, Ansichtsmodi Absolut/Prozentual/Wachstum, Drill-Down,
// gestapeltes Diagramm) erfordern eine authentifizierte Session + eine Planversion mit
// Finanzierungswerten und sind als manuell/code-geprüft dokumentiert. Die Berechnungslogik ist
// durch Vitest abgedeckt:
//   - Client-Kaskade/Jahresbündelung/Roh-Werte-Aufbau: use-langfristige-finanzierungsausgaben-auswertung.test.ts

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/finanzierungsausgaben-auswertung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Finanzierungsausgaben-Auswertung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Finanzierungsausgaben-Auswertung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Schwesterseiten weiterhin erreichbar ─────────────────────────

test('langfristige Operative-Kosten-Auswertung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/operative-kosten-auswertung`)
  expect(response?.status()).toBeLessThan(400)
})

test('langfristige Finanzierungsausgaben Planung (PROJ-90) is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/finanzierungsausgaben-planung`)
  expect(response?.status()).toBeLessThan(400)
})

test('langfristige Rentabilitätsauswertung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/rentabilitaetsauswertung`)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})
