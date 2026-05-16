import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/deckungsbeitrag to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/deckungsbeitrag')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API Security ─────────────────────────────────────────────────────────────

test('GET /api/reporting/deckungsbeitrag redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/reporting/deckungsbeitrag?von=2026-01&bis=2026-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/report-positionen redirects unauthenticated to login (PROJ-27)', async ({ page }) => {
  await page.goto('/api/report-positionen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page accessible (no regression) ───────────────────────────────────

test('login page is accessible and login form renders after PROJ-27', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Middleware protection: page-level route mock cannot bypass auth ──────────

test('client-side route mock cannot bypass middleware — deckungsbeitrag page remains protected', async ({ page }) => {
  await page.route('/api/reporting/deckungsbeitrag*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ perioden: ['2026-01'], positionen: [] }),
    })
  })
  await page.route('/api/report-positionen*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.goto('/dashboard/reporting/deckungsbeitrag')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: related pages still protected after PROJ-27 ─────────────────

test('dashboard page still redirects unauthenticated after PROJ-27 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-27 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-27 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet still requires auth after PROJ-27 (regression)', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/report-positionen still requires auth after PROJ-27 (regression)', async ({ page }) => {
  await page.goto('/api/report-positionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/bestand-transaktionen still requires auth after PROJ-27 (regression)', async ({ page }) => {
  await page.goto('/api/bestand-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/produktkosten still requires auth after PROJ-27 (regression)', async ({ page }) => {
  await page.goto('/api/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet page still redirects unauthenticated after PROJ-27 (regression)', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})
