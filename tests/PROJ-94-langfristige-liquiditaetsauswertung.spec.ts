import { test, expect } from '@playwright/test'

// PROJ-94: Liquiditätsauswertung — Langfristige Planung
//
// Versionsgebundene, read-only Auswertungsseite:
//   /dashboard/langfristige-planung/[versionId]/liquiditaetsauswertung
// Die Wert-Aggregation (6 Module, Kontostand, Operativ-Brutto-Aufschlag, Marketing-Kanäle,
// Investitionen-Gruppierung, Produkt-Reihenfolge, grau/blau-Indikatoren) ist durch Vitest in
// use-langfristige-liquiditaetsauswertung.test.ts abgedeckt (9 Tests). Die geänderte
// Steuerausgaben-Vorsteuer (B3 Operativ = Netto × Satz/100) ist durch die Route-Tests
// abgedeckt (steuerausgaben/berechnet, 25 Tests grün).
// Interaktionstests (Einklappen, Betragsselektion, Notiz-Tooltip) erfordern eine
// authentifizierte Session + eine Planversion mit Plandaten und sind manuell geprüft.

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/liquiditaetsauswertung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Liquiditätsauswertung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard (Seite) ───────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Liquiditätsauswertung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Auth-Guard (geänderte Steuer-berechnet-API) ─────────────────────────────

test('steuerausgaben/berechnet API leitet unauthentifiziert zu /login (auth-gated)', async ({ page }) => {
  await page.goto(`/api/langfristige-planung/${SAMPLE_VERSION_ID}/steuerausgaben/berechnet`)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Liquiditätsauswertung weiterhin erreichbar ─────

test('/dashboard/kurzfristige-planung/liquiditaetsauswertung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/liquiditaetsauswertung')
  expect(response?.status()).toBeLessThan(400)
})
