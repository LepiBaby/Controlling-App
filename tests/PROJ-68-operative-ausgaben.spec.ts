import { test, expect } from '@playwright/test'

// PROJ-68: Operative Ausgaben — Kurzfristige Planung
// Auth-protected API endpoints are tested at unit-test level (vitest).
// E2E tests here cover unauthenticated routing behavior and page structure.

// AC: Unauthenticated users are redirected from Operative Ausgaben to /login
test('redirects unauthenticated user from Operative Ausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/operative-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Unauthenticated users are redirected from Kurzfristige Planung overview to /login
test('redirects unauthenticated user from Kurzfristige Planung overview to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/operative-planung redirects unauthenticated to login
test('GET /api/operative-planung redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/operative-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/operative-planung/ist-tatsaechlich redirects unauthenticated to login
test('GET /api/operative-planung/ist-tatsaechlich redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/operative-planung/ist-tatsaechlich?von_kw=1&von_jahr=2026&bis_kw=4&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/operative-planung/berechnet redirects unauthenticated to login
test('GET /api/operative-planung/berechnet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/operative-planung/berechnet?von_kw=1&von_jahr=2026&bis_kw=4&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Login page still renders (regression check)
test('login page renders after PROJ-68 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).toBeVisible()
})

// AC: Kurzfristige Planung overview route exists and redirects unauthenticated
test('kurzfristige-planung route still exists and redirects unauthenticated users', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: PROJ-56 old URL (same route) still protected
test('operative-planung URL (PROJ-56 superseded by PROJ-68) still redirects unauthenticated', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/operative-planung')
  await expect(page).toHaveURL(/\/login/)
})
