import { test, expect } from '@playwright/test'

// PROJ-87: Sales-Plattform-Planung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/sales-plattform-planung
// Monatsweise, rein berechnete Sales-Plattform-Planung (Bruttoumsatz, Rückerstattungen,
// Verkaufsgebühr, Retourenkosten, Marketing) je Sales-Plattform × Produkt der Planversion,
// mit manuellen Überschreibungen, Betragsselektion, Notizen, einzelnem + globalem Reset.
//
// Interaktionstests (Inline-Edit, Selektion, Notizen, Reset) erfordern eine
// authentifizierte Session + Planversion mit gepflegten Einstellungen und sind als
// Code-/manuell geprüft dokumentiert. Abgedeckt durch:
//  - API: sales-plattform-planung/route.test.ts (15) + berechnet/route.test.ts (12)
//  - Manuelle Verifikation der Berechnung gegen Live-Daten (Testversion1, Juli 2026)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/sales-plattform-planung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Sales-Plattform-Planung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Sales-Plattform-Planung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Auth-Guard auf den API-Routen ───────────────────────────────────────────
// Die Auth-Middleware leitet unauthentifizierte Requests (auch API) per 307 auf
// /login um (Defense-in-Depth zusätzlich zu requireAuth in der Route selbst).

test('GET /api/.../sales-plattform-planung ohne Auth → Redirect zu /login', async ({ request }) => {
  const res = await request.get(
    `/api/langfristige-planung/${SAMPLE_VERSION_ID}/sales-plattform-planung`,
    { maxRedirects: 0 },
  )
  expect(res.status()).toBeGreaterThanOrEqual(300)
  expect(res.status()).toBeLessThan(400)
  expect(res.headers()['location']).toContain('/login')
})

test('GET /api/.../sales-plattform-planung/berechnet ohne Auth → Redirect zu /login', async ({ request }) => {
  const res = await request.get(
    `/api/langfristige-planung/${SAMPLE_VERSION_ID}/sales-plattform-planung/berechnet`,
    { maxRedirects: 0 },
  )
  expect(res.status()).toBeGreaterThanOrEqual(300)
  expect(res.status()).toBeLessThan(400)
  expect(res.headers()['location']).toContain('/login')
})

// ─── Regression: Langfristige Planung Dashboard ──────────────────────────────

test('unauthenticated user is redirected from /dashboard/langfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: kurzfristige Sales-Plattform-Planung weiterhin erreichbar ───
// Stellt sicher, dass die neue langfristige Seite die bestehende kurzfristige nicht beschädigt.

test('/dashboard/kurzfristige-planung/sales-plattform-planung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/sales-plattform-planung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: benachbarte langfristige Planungsseite (Marketing) erreichbar ─

test('langfristige Marketing-Planung weiterhin erreichbar (no 404)', async ({ page }) => {
  const response = await page.goto(
    `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/marketingplanung`,
  )
  expect(response?.status()).toBeLessThan(400)
})
