import { test, expect } from '@playwright/test'

// PROJ-66: Sales Plattform Planung — Kurzfristige Planung
// Auth-protected API endpoints are tested at unit-test level (vitest).
// E2E tests here cover unauthenticated routing behavior and page structure.

// AC: Unauthenticated users are redirected from Sales Plattform Planung to /login
test('redirects unauthenticated user from Sales Plattform Planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/sales-plattform-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Unauthenticated users are redirected from Kurzfristige Planung overview to /login
test('redirects unauthenticated user from Kurzfristige Planung overview to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/sales-plattform-planung redirects unauthenticated to login
test('GET /api/sales-plattform-planung redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/sales-plattform-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/sales-plattform-planung/historisch redirects unauthenticated to login
test('GET /api/sales-plattform-planung/historisch redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/sales-plattform-planung/historisch')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/sales-plattform-planung/berechnet redirects unauthenticated to login
test('GET /api/sales-plattform-planung/berechnet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/sales-plattform-planung/berechnet')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Login page still renders (regression check)
test('login page renders after PROJ-66 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).toBeVisible()
})

// AC: Kurzfristige Planung overview route exists and redirects unauthenticated
test('kurzfristige-planung route still exists and redirects unauthenticated users', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})
