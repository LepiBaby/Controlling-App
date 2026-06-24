import { test, expect } from '@playwright/test'

// PROJ-85: Marketing-Planung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/marketingplanung
// Monatsweise Planung der Marketingkosten (%) je Marketingkanal × Produkt der Planversion;
// Plattform-Aggregation oben, Absatz/VK/Brutto-Umsatz als Stützwerte aus der Absatzplanung,
// Marketingbudget = Brutto-Umsatz × %. Interaktionstests (Inline-Edit, Mehrfachselektion,
// Bulk-Edit, Notizen, Aggregation) erfordern eine authentifizierte Session + Planversion mit
// KPI-Modell-/Absatz-Daten und sind als Code-/manuell geprüft dokumentiert. Abgedeckt durch:
//  - API: marketingplanung/route.test.ts (19 Tests)
//  - Logik: use-langfristige-marketingplanung.test.ts (Budget-/Schlüssel-Helfer, 9 Tests)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/marketingplanung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Marketing-Planung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Marketing-Planung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: kurzfristige Marketing-Planung weiterhin erreichbar ─────────
// Stellt sicher, dass die neue langfristige Seite die bestehende kurzfristige nicht beschädigt.

test('/dashboard/kurzfristige-planung/marketingplanung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/marketingplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: langfristige Absatzplanung (Datenquelle) weiterhin erreichbar ─

test('/dashboard/langfristige-planung/[versionId]/absatzplanung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/absatzplanung`)
  expect(response?.status()).toBeLessThan(400)
})
