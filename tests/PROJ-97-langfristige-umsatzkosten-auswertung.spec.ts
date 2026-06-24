import { test, expect } from '@playwright/test'

// PROJ-97: Umsatzkosten-Auswertung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/umsatzkosten-auswertung
// Interaktionstests (Zeitbasis Monat/Jahr, Ansichtsmodi, Drill-Down, gestapeltes Diagramm)
// erfordern eine authentifizierte Session + eine angelegte Planversion mit Plandaten und sind
// als manuell geprüft dokumentiert. Die Ableitungslogik ist durch Vitest abgedeckt:
//   - Client-Kaskade/Jahresbündelung: use-langfristige-umsatzkosten-auswertung.test.ts (9 Tests)
//   - Datenquelle ist die bereits getestete PROJ-95-Route (route.test.ts) — keine eigene Route.

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/umsatzkosten-auswertung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Umsatzkosten-Auswertung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Umsatzkosten-Auswertung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Schwesterseiten weiterhin erreichbar ────────────────────────

test('langfristige Umsatzauswertung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/umsatzauswertung`)
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
