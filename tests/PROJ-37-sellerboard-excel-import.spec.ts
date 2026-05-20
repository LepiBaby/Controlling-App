import { test, expect } from '@playwright/test'

// ─── AC-1: Button & Route Access ─────────────────────────────────────────────

test('AC-1: unauthenticated user is redirected from /dashboard/umsatz to /login', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-1: POST /api/umsatz-transaktionen/batch redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/api/umsatz-transaktionen/batch')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-1: GET /api/umsatz-transaktionen redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/api/umsatz-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Security: Batch API Input Validation ────────────────────────────────────

test('security: POST /api/umsatz-transaktionen/batch redirects unauthenticated to login (follows redirect)', async ({ request }) => {
  const res = await request.post('/api/umsatz-transaktionen/batch', {
    data: [{ leistungsdatum: '2026-05-01', betrag: 100, kategorie_id: 'abc' }],
  })
  // Playwright follows redirect — final URL should be the login page
  expect(res.url()).toMatch(/login/)
})

test('security: POST /api/ausgaben-kosten-transaktionen/batch redirects unauthenticated to login (follows redirect)', async ({ request }) => {
  const res = await request.post('/api/ausgaben-kosten-transaktionen/batch', {
    data: [{ leistungsdatum: '2026-05-01', betrag_brutto: 100, ust_satz: '19', ust_betrag: 19, kategorie_id: 'abc', relevanz: 'rentabilitaet' }],
  })
  expect(res.url()).toMatch(/login/)
})

// ─── Regression ──────────────────────────────────────────────────────────────

test('regression: /dashboard/umsatz route still exists and redirects unauthenticated users', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('regression: /dashboard/ausgaben route still redirects unauthenticated users (not broken by wizard move)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('regression: login page still renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
})

test('regression: /api/ausgaben-kosten-transaktionen still protected after wizard integration', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})
