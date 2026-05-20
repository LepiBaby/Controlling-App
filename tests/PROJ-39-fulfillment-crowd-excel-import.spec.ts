import { test, expect } from '@playwright/test'

// ─── AC-1: Auth & Route Protection ───────────────────────────────────────────

test('AC-1: unauthenticated user is redirected from /dashboard/bestandsverwaltung to /login', async ({ page }) => {
  await page.goto('/dashboard/bestandsverwaltung')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-1: GET /api/bestand-transaktionen redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/api/bestand-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Security: API Input Validation ──────────────────────────────────────────

test('security: POST /api/bestand-transaktionen rejects unauthenticated requests', async ({ request }) => {
  const res = await request.post('/api/bestand-transaktionen', {
    data: {
      sku_id: 'test',
      produkt_id: 'test',
      datum: '2026-05-01',
      anfangsbestand: 0,
      einlagerungen: 0,
      anpassungen_positiv: 0,
      anpassungen_negativ: 0,
      warenverluste: 0,
      sendungen_manuell: 0,
      sendungen: [],
    },
  })
  expect(res.url()).toMatch(/login/)
})

test('security: PATCH /api/bestand-transaktionen/[id] rejects unauthenticated requests', async ({ request }) => {
  const res = await request.patch('/api/bestand-transaktionen/test-id', {
    data: { anfangsbestand: 0 },
  })
  expect(res.url()).toMatch(/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('regression: /dashboard/bestandsverwaltung route is protected', async ({ page }) => {
  await page.goto('/dashboard/bestandsverwaltung')
  await expect(page).toHaveURL(/\/login/)
})

test('regression: /dashboard still works (not broken by import wizard)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('regression: login page still renders correctly', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
})

test('regression: /dashboard/ausgaben still redirects (import wizard not accidentally placed there)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('regression: /api/bestand-transaktionen endpoint protected after wizard integration', async ({ page }) => {
  await page.goto('/api/bestand-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})
