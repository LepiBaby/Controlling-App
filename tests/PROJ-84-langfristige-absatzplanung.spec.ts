import { test, expect } from '@playwright/test'

// PROJ-84: Absatzplanung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/absatzplanung
// Monatsweise Planung von Absatz und Effektivem VK je Sales-Plattform × Produkt der
// Planversion. Interaktionstests (Inline-Edit, Mehrfachselektion, Bulk-Edit, Notizen,
// Aggregation) erfordern eine authentifizierte Session + Planversion mit KPI-Modell-Daten
// und sind als Code-/manuell geprüft dokumentiert. Abgedeckt durch:
//  - API: absatzplanung/route.test.ts + planung-notizen/route.test.ts (29 Tests)
//  - Logik: use-langfristige-absatzplanung.test.ts (Monatsfenster + Schlüssel, 8 Tests)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/absatzplanung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Absatzplanung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Absatzplanung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: kurzfristige Absatzplanung weiterhin erreichbar ─────────────
// Stellt sicher, dass die neue langfristige Seite die bestehende kurzfristige nicht beschädigt.

test('/dashboard/kurzfristige-planung/absatzplanung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  expect(response?.status()).toBeLessThan(400)
})
