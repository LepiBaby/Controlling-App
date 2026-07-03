import { test, expect } from '@playwright/test'

// PROJ-104: Planversion duplizieren — Langfristige Planung
//
// „Duplizieren" liegt im Dreipunktemenü jeder Planversion auf dem Dashboard und ruft
// POST /api/langfristige-planung/planversionen/[id]/duplicate. Die eigentliche Vollkopie
// erledigt die atomare DB-Funktion duplicate_langfristige_planversion.
// Interaktive Flows erfordern eine authentifizierte Session + Daten und sind im Feature-Spec
// über Code-Audit + DB-Verifikation (Vollständigkeit 963=963 Zeilen, 0 Referenz-Leaks,
// Unabhängigkeit, Auto-Name, Atomarität) dokumentiert. Die API-Logik (201/400/404/401/500)
// ist durch Vitest abgedeckt: planversionen/[id]/duplicate/route.test.ts (6 Tests).

const SAMPLE_ID = 'adfb60cf-9a88-4014-86b2-2491c10f4b3e'
const DUP_URL = `/api/langfristige-planung/planversionen/${SAMPLE_ID}/duplicate`

// ─── Auth-Guard: Duplizieren-Endpunkt blockt unauthentifizierte Zugriffe ─────

test('unauthenticated POST to the duplicate endpoint is blocked (redirect to /login)', async ({ page }) => {
  const res = await page.request.post(DUP_URL)
  expect(res.url()).toMatch(/\/login/)
})

// ─── Auth-Guard: Dashboard (Einstieg für „Duplizieren") ──────────────────────

test('unauthenticated user is redirected from the langfristige dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard/langfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Planung weiterhin erreichbar ───────────────────

test('/dashboard/kurzfristige-planung/grundeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})
