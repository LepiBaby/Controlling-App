import { test, expect } from '@playwright/test'

// PROJ-90: Finanzierungsausgaben Planung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/finanzierungsausgaben-planung
// Monatsweise manuelle Planung der Finanzierungsausgaben je Gruppe/Untergruppe (globaler
// "Finanzierung"-Subtree des KPI-Modells), summiert auf Gruppen- und Gesamtebene.
// Direkte Spiegelung der Operativkosten Planung (PROJ-88). Interaktionstests
// (Inline-Edit, Mehrfachselektion, Bulk-Edit, Notizen, Aggregation, Ein-/Ausklappen)
// erfordern eine authentifizierte Session + Planversion und sind als Code-/manuell
// geprüft dokumentiert. Abgedeckt durch:
//  - API: finanzierungsausgaben-planung/route.test.ts (18 Tests)
//  - Logik: use-finanzierungsausgaben-planung.test.ts (Monatsfenster ohne Vorlauf + Schlüssel)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/finanzierungsausgaben-planung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Finanzierungsausgaben-Planung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Finanzierungsausgaben Planung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: langfristige Operativkosten Planung weiterhin erreichbar ─────
// Stellt sicher, dass die neue Seite die bestehende Schwester-Seite nicht beschädigt.

test('/dashboard/langfristige-planung/[versionId]/operativekosten-planung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/operativekosten-planung`)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: kurzfristige Finanzierungsausgaben weiterhin erreichbar ──────

test('/dashboard/kurzfristige-planung/finanzierungsausgaben is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/finanzierungsausgaben')
  expect(response?.status()).toBeLessThan(400)
})
