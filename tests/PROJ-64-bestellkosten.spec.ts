import { test, expect } from '@playwright/test'

// PROJ-64: Bestellkosten — Kurzfristige Planung
// Auth-protected API endpoints are tested at unit-test level (vitest).
// E2E tests here cover unauthenticated routing behavior.

// AC: Unauthenticated users are redirected from Bestellplanung page to /login
test('redirects unauthenticated user from Bestellplanung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/bestellplanung')
  await expect(page).toHaveURL(/\/login/)
})

// AC: Unauthenticated users are redirected from all dashboard paths to /login
test('redirects unauthenticated user from dashboard root to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
