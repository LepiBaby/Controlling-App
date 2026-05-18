import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('AC-4: GET /api/ausgaben-kosten-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-4: GET /api/ausgaben-kosten-transaktionen?excludeImportSource=sellerboard redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen?excludeImportSource=sellerboard')
  await expect(page).toHaveURL(/\/login/)
})

test('AC-2: POST /api/ausgaben-kosten-transaktionen/batch redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen/batch')
  await expect(page).toHaveURL(/\/login/)
})

// ─── AC-3: Toggle-Button UI ───────────────────────────────────────────────────

test('AC-3: unauthenticated user is redirected from /dashboard/ausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('regression: login page still renders after PROJ-38 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
})

test('regression: /dashboard/ausgaben route still exists and redirects unauthenticated users', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('regression: GET API still returns 401/redirect for unauthenticated requests to existing filter params', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen?von=2026-01-01&bis=2026-12-31&kategorie_ids=abc')
  await expect(page).toHaveURL(/\/login/)
})
