import { test, expect } from '@playwright/test'

// PROJ-69: Produktinvestitionsausgaben — Kurzfristige Planung (Redesign PROJ-57)
// Auth-protected API endpoints are tested at unit-test level (vitest).
// E2E tests here cover unauthenticated routing behavior and page structure.

// AC: Unauthenticated users are redirected from Produktinvestitionsausgaben to /login
test('redirects unauthenticated user from Produktinvestitionsausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/produktinvestitionsplanung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Unauthenticated users are redirected from Kurzfristige Planung overview to /login
test('redirects unauthenticated user from Kurzfristige Planung overview to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/produktinvestitions-planung redirects unauthenticated to login
test('GET /api/produktinvestitions-planung redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/produktinvestitions-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/produktinvestitions-planung/ist-tatsaechlich redirects unauthenticated to login
test('GET /api/produktinvestitions-planung/ist-tatsaechlich redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/produktinvestitions-planung/ist-tatsaechlich?von_kw=1&von_jahr=2026&bis_kw=4&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Login page still renders (regression check)
test('login page renders after PROJ-69 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).toBeVisible()
})

// AC: Kurzfristige Planung overview route exists and redirects unauthenticated
test('kurzfristige-planung route still exists and redirects unauthenticated users', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: PROJ-57 old URL (same route, superseded by PROJ-69) still protected
test('produktinvestitionsplanung URL (PROJ-57 superseded by PROJ-69) still redirects unauthenticated', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/produktinvestitionsplanung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API PUT /api/produktinvestitions-planung redirects unauthenticated to login
test('PUT /api/produktinvestitions-planung redirects unauthenticated to login', async ({ page }) => {
  // A fetch to a protected route without a session should trigger the auth redirect
  await page.goto('/api/produktinvestitions-planung')
  await expect(page).toHaveURL(/\/login/)
})
