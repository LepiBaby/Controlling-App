import { test, expect } from '@playwright/test'

// PROJ-91: Umsatzausgaben Planung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/umsatzausgaben
// Monatsweise, berechnet aus den Einstellungen dieser Planversion (Liquiditätssicht
// mit monatsbasierter Zahlungsverschiebung), manuell überschreibbar.
// Interaktions-/Berechnungstests (Inline-Edit, Selektion, Notizen, Aggregation,
// grau/blau-Punkte, Zahlungsverschiebung, USt, Bestandssimulation für Lager,
// Erstbestellungs-Ausschluss, Vorlaufmonate) erfordern eine authentifizierte
// Session + Planversion und sind als Code-/manuell geprüft dokumentiert. Abgedeckt durch:
//  - API: umsatzausgaben/route.test.ts + umsatzausgaben/berechnet/route.test.ts
//  - Logik: use-langfristige-umsatzausgaben.test.ts (Monatsfenster + Schlüssel)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/umsatzausgaben`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Umsatzausgaben-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Umsatzausgaben to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: kurzfristige Umsatzausgaben weiterhin erreichbar ─────────────
// Stellt sicher, dass die neue langfristige Seite die bestehende kurzfristige nicht beschädigt.

test('/dashboard/kurzfristige-planung/umsatzausgaben is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/umsatzausgaben')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: langfristige Sales-Plattform-Planung weiterhin erreichbar ────

test('/dashboard/langfristige-planung/[versionId]/sales-plattform-planung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto(`/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/sales-plattform-planung`)
  expect(response?.status()).toBeLessThan(400)
})
