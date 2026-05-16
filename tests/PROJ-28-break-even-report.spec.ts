import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/break-even to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/break-even')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect preserves ?next param for /dashboard/reporting/break-even', async ({ page }) => {
  await page.goto('/dashboard/reporting/break-even')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Freporting%2Fbreak-even/)
})

// ─── API Security ─────────────────────────────────────────────────────────────

test('GET /api/reporting/break-even redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/reporting/break-even?produkt_ids=abc')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/break-even without produkt_ids redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/break-even')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/break-even with granularitaet=quartal redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/break-even?produkt_ids=abc&granularitaet=quartal')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/break-even with granularitaet=jahr redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/break-even?produkt_ids=abc&granularitaet=jahr')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Middleware bypass check ───────────────────────────────────────────────────

test('client-side route mock cannot bypass middleware — break-even page remains protected', async ({ page }) => {
  await page.route('/api/reporting/break-even*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ perioden: ['2026-01'], positionen: [] }),
    })
  })
  await page.route('/api/report-positionen*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
  await page.route('/api/kpi-categories*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
  await page.goto('/dashboard/reporting/break-even')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page accessible (no regression) ────────────────────────────────────

test('login page is accessible and login form renders after PROJ-28', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: related pages still protected after PROJ-28 ──────────────────

test('dashboard page still redirects unauthenticated after PROJ-28 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-28 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-28 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('deckungsbeitrag page still redirects unauthenticated after PROJ-28 (regression)', async ({ page }) => {
  await page.goto('/dashboard/reporting/deckungsbeitrag')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet still requires auth after PROJ-28 (regression)', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/report-positionen still requires auth after PROJ-28 (regression)', async ({ page }) => {
  await page.goto('/api/report-positionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/deckungsbeitrag still requires auth after PROJ-28 (regression)', async ({ page }) => {
  await page.goto('/api/reporting/deckungsbeitrag?von=2026-01&bis=2026-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/kpi-categories still requires auth after PROJ-28 (regression)', async ({ page }) => {
  await page.goto('/api/kpi-categories')
  await expect(page).toHaveURL(/\/login/)
})
