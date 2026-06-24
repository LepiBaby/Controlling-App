import { test, expect } from '@playwright/test'

// PROJ-89: Einnahmenplanung — Langfristige Planung
//
// Versionsgebundene Seite: /dashboard/langfristige-planung/[versionId]/einnahmenplanung
// Monatsweise Einnahmenplanung ab Startmonat über den allgemeinen Horizont; Produktverkäufe
// werden pro Sales Channel automatisch nach Auszahlungszeitpunkt berechnet (Zahlungsrhythmus,
// Ankermonat, Verschiebung), alle anderen Kategorien leer + manuell editierbar. Inkl.
// Betragsselektion, versionsgebundene Notizen, einzelnes + globales Zurücksetzen.
//
// Interaktionstests (Inline-Edit, Selektion, Notizen, Reset) erfordern eine
// authentifizierte Session + Planversion mit gepflegten Einstellungen und sind als
// Code-/manuell geprüft dokumentiert. Abgedeckt durch:
//  - API: einnahmen-planung/route.test.ts (16) + produktverkaeufe-berechnet/route.test.ts (12)
//  - Manuelle Verifikation der Berechnung gegen Live-Daten (Testversion1, Juni/Juli 2026)

const SAMPLE_VERSION_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_URL = `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/einnahmenplanung`

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('versionsgebundene Einnahmenplanung-Route liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto(PAGE_URL)
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from langfristige Einnahmenplanung to /login', async ({ page }) => {
  await page.goto(PAGE_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Auth-Guard auf den API-Routen ───────────────────────────────────────────

test('GET /api/.../einnahmen-planung ohne Auth → Redirect zu /login', async ({ request }) => {
  const res = await request.get(
    `/api/langfristige-planung/${SAMPLE_VERSION_ID}/einnahmen-planung`,
    { maxRedirects: 0 },
  )
  expect(res.status()).toBeGreaterThanOrEqual(300)
  expect(res.status()).toBeLessThan(400)
  expect(res.headers()['location']).toContain('/login')
})

test('GET /api/.../einnahmen-planung/produktverkaeufe-berechnet ohne Auth → Redirect zu /login', async ({ request }) => {
  const res = await request.get(
    `/api/langfristige-planung/${SAMPLE_VERSION_ID}/einnahmen-planung/produktverkaeufe-berechnet`,
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

// ─── Regression: kurzfristige Einnahmenplanung weiterhin erreichbar ──────────
// Stellt sicher, dass die neue langfristige Seite die bestehende kurzfristige nicht beschädigt.

test('/dashboard/kurzfristige-planung/einnahmenplanung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/einnahmenplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: benachbarte langfristige Planungsseite (Sales-Plattform) erreichbar ─

test('langfristige Sales-Plattform-Planung weiterhin erreichbar (no 404)', async ({ page }) => {
  const response = await page.goto(
    `/dashboard/langfristige-planung/${SAMPLE_VERSION_ID}/sales-plattform-planung`,
  )
  expect(response?.status()).toBeLessThan(400)
})
