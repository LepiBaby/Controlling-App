import { test, expect } from '@playwright/test'

// PROJ-88: Operativkosten Planung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/operativekosten-planung
// Monatsweise manuelle Planung der operativen Kosten je Gruppe/Untergruppe (globaler
// "Operativ"-Subtree des KPI-Modells), summiert auf Gruppen- und Gesamtebene.
// Interaktionstests (Inline-Edit, Mehrfachselektion, Bulk-Edit, Notizen, Aggregation,
// Ein-/Ausklappen) erfordern eine authentifizierte Session + Planversion und sind als
// Code-/manuell geprüft dokumentiert. Abgedeckt durch:
//  - API: operativekosten-planung/route.test.ts (18 Tests)
//  - Logik: use-operativekosten-planung.test.ts (Monatsfenster ohne Vorlauf + Schlüssel)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/operativekosten-planung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Operativkosten-Planung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Operativkosten Planung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: kurzfristige Operative Ausgaben weiterhin erreichbar ─────────
// Stellt sicher, dass die neue langfristige Seite die bestehende kurzfristige nicht beschädigt.

test('/dashboard/kurzfristige-planung/operative-planung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/operative-planung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: langfristige Absatzplanung weiterhin erreichbar ─────────────

test('/dashboard/langfristige-planung/[versionId]/absatzplanung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/absatzplanung`)
  expect(response?.status()).toBeLessThan(400)
})
