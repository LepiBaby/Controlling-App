import { test, expect } from '@playwright/test'

// PROJ-72: Liquiditätsauswertung — Kurzfristige Planung
// Neue read-only Seite /dashboard/kurzfristige-planung/liquiditaetsauswertung,
// die alle 6 Planungsmodule zusammenführt, + neue API GET /api/liquiditaetsauswertung/anfangsbestand.
// Diese Suite verifiziert:
//   1. Auth-Redirect für Seite und Anfangsbestand-API
//   2. API antwortet nicht ohne Auth (Middleware-Redirect, auch gegen Client-Mock)
//   3. Regression: bestehende Quell-Seiten + Dependency-APIs bleiben geschützt

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/liquiditaetsauswertung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/liquiditaetsauswertung')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect preserves ?next param for /dashboard/kurzfristige-planung/liquiditaetsauswertung', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/liquiditaetsauswertung')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fkurzfristige-planung%2Fliquiditaetsauswertung/)
})

// ─── API Security ─────────────────────────────────────────────────────────────

test('GET /api/liquiditaetsauswertung/anfangsbestand redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/liquiditaetsauswertung/anfangsbestand?vor_jahr=2026&vor_kw=10')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/liquiditaetsauswertung/anfangsbestand without params redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/liquiditaetsauswertung/anfangsbestand')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Client-side mock bypass check ─────────────────────────────────────────────

test('client-side API mock does NOT bypass middleware redirect for anfangsbestand endpoint', async ({ page }) => {
  await page.route('/api/liquiditaetsauswertung/anfangsbestand*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ anfangsbestand: 99999, stichtag: '2026-03-02' }),
    })
  })

  await page.goto('/dashboard/kurzfristige-planung/liquiditaetsauswertung')
  // Middleware-Redirect verhindert, dass die Seite (und damit der Mock) geladen wird
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: source pages still redirect unauthenticated ──────────────────

test('einnahmenplanung page still redirects unauthenticated after PROJ-72 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/einnahmenplanung')
  await expect(page).toHaveURL(/\/login/)
})

test('umsatzausgaben page still redirects unauthenticated after PROJ-72 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/umsatzausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('steuerausgaben page still redirects unauthenticated after PROJ-72 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/steuerausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaetsreport page still redirects unauthenticated after PROJ-72 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: dependency APIs still require auth ───────────────────────────

test('GET /api/steuerausgaben-planung/berechnet still redirects unauthenticated after PROJ-72', async ({ page }) => {
  await page.goto('/api/steuerausgaben-planung/berechnet?von_kw=1&von_jahr=2026&bis_kw=13&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/einnahmen-planung/produktverkaeufe-berechnet still redirects unauthenticated after PROJ-72', async ({ page }) => {
  await page.goto('/api/einnahmen-planung/produktverkaeufe-berechnet?vergangenheit_horizont=13')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/grundeinstellungen still redirects unauthenticated after PROJ-72', async ({ page }) => {
  await page.goto('/api/grundeinstellungen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page still works ───────────────────────────────────────────────────

test('login page still renders correctly after PROJ-72 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})
