import { test, expect } from '@playwright/test'

// PROJ-67: Umsatzausgaben — Kurzfristige Planung
// Auth-protected API endpoints are tested at unit-test level (vitest).
// E2E tests here cover unauthenticated routing behavior and page structure.

// AC: Unauthenticated users are redirected from Umsatzausgaben to /login
test('redirects unauthenticated user from Umsatzausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/umsatzausgaben')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Unauthenticated users are redirected from Kurzfristige Planung overview to /login
test('redirects unauthenticated user from Kurzfristige Planung overview to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/umsatzausgaben-planung redirects unauthenticated to login
test('GET /api/umsatzausgaben-planung redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/umsatzausgaben-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/umsatzausgaben-planung/ist-tatsaechlich redirects unauthenticated to login
test('GET /api/umsatzausgaben-planung/ist-tatsaechlich redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/umsatzausgaben-planung/ist-tatsaechlich?von_kw=1&von_jahr=2026&bis_kw=4&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/umsatzausgaben-planung/berechnet redirects unauthenticated to login
test('GET /api/umsatzausgaben-planung/berechnet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/umsatzausgaben-planung/berechnet?von_kw=1&von_jahr=2026&bis_kw=4&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Login page still renders (regression check)
test('login page renders after PROJ-67 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).toBeVisible()
})

// AC: Kurzfristige Planung overview route exists and redirects unauthenticated
test('kurzfristige-planung route still exists and redirects unauthenticated users', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})
