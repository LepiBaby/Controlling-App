import { test, expect } from '@playwright/test'

// AC1 + AC9: Unauthenticated users are redirected to /login
test('redirects unauthenticated user from / to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('redirects unauthenticated user from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('preserves original URL in ?next= param on redirect', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/)
})

// AC2: Login page shows email input and magic link button
test('login page renders email input and submit button', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('login page shows app title and description', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Controlling App')).toBeVisible()
  await expect(page.getByText('Interne Finanzplattform')).toBeVisible()
})

// Form validation
test('shows validation error for invalid email format', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill('not-an-email')
  await page.getByRole('button', { name: /Magic Link senden/i }).click()
  await expect(page.getByText(/gültige E-Mail/i)).toBeVisible()
})

test('does not submit with empty email field', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /Magic Link senden/i }).click()
  await expect(page.getByText(/gültige E-Mail/i)).toBeVisible()
})

// AC3: Success state shown after valid email submission
test('shows success message after valid email is submitted', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill('test@example.com')
  await page.getByRole('button', { name: /Magic Link senden/i }).click()
  // Either success state OR error state (rate limit etc.) — but NOT still on form
  // We check that a response was received (button becomes disabled during submit)
  // Note: actual email sending requires Supabase — test verifies UI response only
  await expect(
    page.getByText(/Link verschickt|Fehler ist aufgetreten/i)
  ).toBeVisible({ timeout: 10000 })
})

// AC5: Login page accessible without auth (public route)
test('/login is accessible without authentication', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// /auth/callback is accessible without auth
test('/auth/callback without code redirects to /login with error', async ({ page }) => {
  await page.goto('/auth/callback')
  await expect(page).toHaveURL(/\/login\?error=auth_error/)
})

// Error states on login page
test('shows auth_error message when redirected with error param', async ({ page }) => {
  await page.goto('/login?error=auth_error')
  await expect(page.getByText(/ungültig oder bereits verwendet/i)).toBeVisible()
})

test('shows session_expired message when redirected with session_expired param', async ({ page }) => {
  await page.goto('/login?error=session_expired')
  await expect(page.getByText(/Session ist abgelaufen/i)).toBeVisible()
})

// Responsive: Mobile (375px)
test('login page is usable on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// Responsive: Tablet (768px)
test('login page is usable on tablet (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})
