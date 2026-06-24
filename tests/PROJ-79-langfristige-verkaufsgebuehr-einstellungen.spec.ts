import { test, expect } from '@playwright/test'

// PROJ-79: Verkaufsgebühr-Einstellungen — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen
// Interaktionstests (Plattform-Tabs, Auto-Save onBlur, „Alle gleichsetzen", optimistisches
// Update + Rollback) erfordern eine authentifizierte Session + Planversion + KPI-Modell-
// Stammdaten (Sales-Plattformen + Produkte) und sind als manuell geprüft dokumentiert.
// API-Integrationstests (200/400/401/404/500, Versions-/Art-Prüfung) sind durch Vitest in
// route.test.ts (21) und batch/route.test.ts (9) abgedeckt.

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/verkaufsgebuehr-einstellungen`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Verkaufsgebühr-Einstellungen-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Verkaufsgebühr-Einstellungen to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Verkaufsgebühr-Einstellungen weiterhin erreichbar ──

test('/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})
