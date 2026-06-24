import { test, expect } from '@playwright/test'

// PROJ-65: Steuereinstellungen — Kurzfristige Planung
// Auth-protected API endpoints are tested at unit-test level (vitest).
// E2E tests here cover unauthenticated routing behavior.

// AC: Unauthenticated users are redirected from Steuereinstellungen to /login
test('redirects unauthenticated user from Steuereinstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/steuereinstellungen')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Unauthenticated users are redirected from dashboard root to /login
test('redirects unauthenticated user from dashboard root to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
