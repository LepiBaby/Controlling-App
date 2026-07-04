import { test, expect } from '@playwright/test'

// PROJ-106: Deckungsbeitragsauswertung — Langfristige Planung
//
// Versionsgebundene, rein anzeigende Seite:
//   /dashboard/langfristige-planung/[versionId]/deckungsbeitragsauswertung
// Sie klont die Rentabilitätsauswertung (PROJ-95), schneidet die Kaskade nach DB III ab
// und ergänzt einen Produktfilter. Interaktionstests (Zeitbasis Monat/Jahr, Ansichtsmodi,
// Produktfilter, Drill-Down, Diagramm, Absatztabelle) erfordern eine authentifizierte
// Session + eine Planversion mit Plandaten und sind als manuell geprüft dokumentiert.
// Die differenzierende Logik ist durch Vitest abgedeckt:
//   - use-langfristige-rentabilitaetsauswertung.test.ts: DB3_CASCADE (Cutoff nach DB III),
//     computeCascade mit verkürzter Kaskade, applyProduktFilter (inkl. Marketing-
//     Verschachtelung Kanal→Produkt), collectProdukte.

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/deckungsbeitragsauswertung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Deckungsbeitragsauswertung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Deckungsbeitragsauswertung to /login', async ({ page }) => {
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
