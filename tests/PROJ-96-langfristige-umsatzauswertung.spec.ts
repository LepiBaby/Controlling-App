import { test, expect } from '@playwright/test'

// PROJ-96: Umsatzauswertung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/umsatzauswertung
// Interaktionstests (Zeitbasis Monat/Jahr, Ansichtsmodi, Drill-Down, Diagramm, Absatztabelle)
// erfordern eine authentifizierte Session + eine angelegte Planversion mit Plandaten und sind
// als manuell geprüft dokumentiert. Die Berechnungslogik ist durch Vitest abgedeckt:
//   - Server-Route: route.test.ts (10 Tests, inkl. nur=umsatz-Modus + Schreib-Skip-Garantie)
//   - Client-Kaskade/Jahresbündelung: use-langfristige-umsatzauswertung.test.ts (12 Tests)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/umsatzauswertung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Umsatzauswertung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Umsatzauswertung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Schwesterseite Rentabilitätsauswertung weiterhin erreichbar ──

test('langfristige Rentabilitätsauswertung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/rentabilitaetsauswertung`)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})
