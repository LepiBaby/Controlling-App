import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/rentabilitaet to /login (PROJ-33)', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is redirected from /dashboard/reporting/deckungsbeitrag to /login (PROJ-33)', async ({ page }) => {
  await page.goto('/dashboard/reporting/deckungsbeitrag')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API Security ─────────────────────────────────────────────────────────────

test('GET /api/reporting/absatz redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/reporting/absatz?von=2026-01&bis=2026-03&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/absatz without params redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/reporting/absatz')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page regression ────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-33', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Middleware bypass test ───────────────────────────────────────────────────

test('mocking absatz API cannot bypass middleware on rentabilitaet page', async ({ page }) => {
  await page.route('/api/reporting/absatz*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ perioden: ['2026-01'], gesamt: { '2026-01': 100 }, produkte: [] }),
    })
  })
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('mocking absatz API cannot bypass middleware on deckungsbeitrag page', async ({ page }) => {
  await page.route('/api/reporting/absatz*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ perioden: ['2026-01'], gesamt: { '2026-01': 100 }, produkte: [] }),
    })
  })
  await page.goto('/dashboard/reporting/deckungsbeitrag')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: related pages still protected ───────────────────────────────

test('dashboard still redirects unauthenticated after PROJ-33 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects after PROJ-33 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('bestandsverwaltung page still redirects after PROJ-33 (regression)', async ({ page }) => {
  await page.goto('/dashboard/bestandsverwaltung')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet still requires auth after PROJ-33 (regression)', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/deckungsbeitrag still requires auth after PROJ-33 (regression)', async ({ page }) => {
  await page.goto('/api/reporting/deckungsbeitrag?von=2026-01&bis=2026-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/bestand-transaktionen still requires auth after PROJ-33 (regression)', async ({ page }) => {
  await page.goto('/api/bestand-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})
