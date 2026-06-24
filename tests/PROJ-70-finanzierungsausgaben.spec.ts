import { test, expect } from '@playwright/test'

// PROJ-70: Finanzierungsausgaben — Kurzfristige Planung
// Auth-protected API endpoints are tested at unit-test level (vitest).
// E2E tests here cover unauthenticated routing behavior and page structure.

// AC: Unauthenticated users are redirected from Finanzierungsausgaben to /login
test('redirects unauthenticated user from Finanzierungsausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/finanzierungsausgaben')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Unauthenticated users are redirected from Kurzfristige Planung overview to /login
test('redirects unauthenticated user from Kurzfristige Planung overview to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/finanzierungs-planung redirects unauthenticated to login
test('GET /api/finanzierungs-planung redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/finanzierungs-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/finanzierungs-planung/ist-tatsaechlich redirects unauthenticated to login
test('GET /api/finanzierungs-planung/ist-tatsaechlich redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/finanzierungs-planung/ist-tatsaechlich?von_kw=1&von_jahr=2026&bis_kw=4&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API GET /api/finanzierungs-planung/berechnet redirects unauthenticated to login
test('GET /api/finanzierungs-planung/berechnet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/finanzierungs-planung/berechnet?von_kw=1&von_jahr=2026&bis_kw=4&bis_jahr=2026')
  await expect(page).toHaveURL(/\/login/)
})

// AC: API PUT /api/finanzierungs-planung redirects unauthenticated to login
test('PUT /api/finanzierungs-planung redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/finanzierungs-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Login page still renders (regression check)
test('login page renders after PROJ-70 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('body')).toBeVisible()
})

// AC: Kurzfristige Planung overview route still exists and redirects unauthenticated
test('kurzfristige-planung route still exists and redirects unauthenticated users', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Operative Ausgaben route (PROJ-68) still protected — regression check
test('operative-planung URL still redirects unauthenticated (PROJ-68 regression)', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/operative-planung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Produktinvestitionsausgaben route (PROJ-69) still protected — regression check
test('produktinvestitionsplanung URL still redirects unauthenticated (PROJ-69 regression)', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/produktinvestitionsplanung')
  await expect(page).toHaveURL(/\/login/)
})
