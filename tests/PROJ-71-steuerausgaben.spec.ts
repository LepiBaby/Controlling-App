import { test, expect } from '@playwright/test'

// PROJ-71: Steuerausgaben — Kurzfristige Planung
// Auth-protected API endpoints + tax calculation logic are tested at unit-test level (vitest:
// 46 tests in src/app/api/steuerausgaben-planung/**). E2E tests here cover unauthenticated
// routing behavior (Auth-Guard AC) and regression of sibling planning routes.

// AC: Unauthenticated users are redirected from Steuerausgaben to /login
test('redirects unauthenticated user from Steuerausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/steuerausgaben')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Unauthenticated users are redirected from Kurzfristige Planung overview to /login
test('redirects unauthenticated user from Kurzfristige Planung overview to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/steuerausgaben-planung redirects unauthenticated to login
test('GET /api/steuerausgaben-planung redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/steuerausgaben-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/steuerausgaben-planung/ist-tatsaechlich redirects unauthenticated to login
test('GET /api/steuerausgaben-planung/ist-tatsaechlich redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/steuerausgaben-planung/ist-tatsaechlich?von_kw=1&von_jahr=2026&bis_kw=4&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/steuerausgaben-planung/berechnet redirects unauthenticated to login
test('GET /api/steuerausgaben-planung/berechnet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/steuerausgaben-planung/berechnet?von_kw=1&von_jahr=2026&bis_kw=4&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API PUT route is auth-protected (navigating triggers GET → redirect)
test('PUT /api/steuerausgaben-planung route redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/steuerausgaben-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Login page still renders (regression check)
test('login page renders after PROJ-71 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).toBeVisible()
})

// AC: Finanzierungsausgaben route (PROJ-70) still protected — regression check
test('finanzierungsausgaben URL still redirects unauthenticated (PROJ-70 regression)', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/finanzierungsausgaben')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Produktinvestitionsausgaben route (PROJ-69) still protected — regression check
test('produktinvestitionsplanung URL still redirects unauthenticated (PROJ-69 regression)', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/produktinvestitionsplanung')
  await expect(page).toHaveURL(/\/login/)
})
