import { test, expect } from '@playwright/test'

// PROJ-103: Planversionen-Ordner — Langfristige Planung
//
// Die Ordner-Verwaltung liegt auf dem Dashboard /dashboard/langfristige-planung und ist
// vollständig auth- und nutzergebunden. Interaktive Flows (Ordner anlegen/umbenennen/löschen,
// Version verschieben, Anlegen in Ordner) erfordern eine authentifizierte Session + Daten und
// sind im Feature-Spec als manuell/über Code-Audit geprüft dokumentiert.
// Die API-Logik (200/400/401/404/409, Anlegen-in-Ordner, Verschieben, „nur leere Ordner löschbar")
// ist durch Vitest abgedeckt: planversion-ordner/route.test.ts + [id]/route.test.ts und die
// erweiterten planversionen-Tests (46 Tests gesamt).

const DASHBOARD_URL = '/dashboard/langfristige-planung'

// ─── Auth-Guard: Dashboard mit Ordner-Verwaltung ─────────────────────────────

test('unauthenticated user is redirected from the langfristige dashboard to /login', async ({ page }) => {
  await page.goto(DASHBOARD_URL)
  await expect(page).toHaveURL(/\/login/)
})

// ─── Auth-Guard: Ordner-API blockt unauthentifizierte Zugriffe ───────────────

test('unauthenticated GET on the ordner API does not return data (redirect to /login)', async ({ page }) => {
  const res = await page.request.get('/api/langfristige-planung/planversion-ordner')
  // Folgt dem 307-Redirect auf /login → landet nicht bei einer 200-JSON-Liste.
  expect(res.url()).toMatch(/\/login/)
})

test('unauthenticated DELETE on a folder is blocked (no data mutation)', async ({ page }) => {
  const res = await page.request.delete(
    '/api/langfristige-planung/planversion-ordner/fbffeef1-3330-420d-b40c-9c2e0c65c982',
  )
  expect(res.url()).toMatch(/\/login/)
})

// ─── Regression: Kurzfristige Planung weiterhin erreichbar ───────────────────

test('/dashboard/kurzfristige-planung/grundeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})
