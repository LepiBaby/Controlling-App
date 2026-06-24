import { test, expect } from '@playwright/test'

// PROJ-98: Operative Kosten-Auswertung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/operative-kosten-auswertung
// Interaktionstests (Zeitbasis Monat/Jahr, Ansichtsmodi Absolut/Prozentual/Wachstum, Drill-Down,
// gestapeltes Diagramm) erfordern eine authentifizierte Session + eine Planversion mit operativen
// Kostenwerten und sind als manuell/code-geprüft dokumentiert. Die Berechnungslogik ist durch
// Vitest abgedeckt:
//   - Server-Route (?nur=operativ-Modus + Schreib-Skip-Garantie): rentabilitaetsauswertung/route.test.ts (12 Tests)
//   - Client-Kaskade/Jahresbündelung: use-langfristige-operative-kosten-auswertung.test.ts (15 Tests)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/operative-kosten-auswertung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Operative-Kosten-Auswertung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Operative-Kosten-Auswertung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Schwesterseiten weiterhin erreichbar ─────────────────────────

test('langfristige Rentabilitätsauswertung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/rentabilitaetsauswertung`)
  expect(response?.status()).toBeLessThan(400)
})

test('langfristige Umsatzauswertung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/umsatzauswertung`)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})
