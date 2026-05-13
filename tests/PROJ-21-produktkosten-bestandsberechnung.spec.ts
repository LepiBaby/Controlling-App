import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: dependency APIs still require auth ───────────────────────────

test('GET /api/bestand-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/bestand-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/produktkosten redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page still works ───────────────────────────────────────────────────

test('login page still renders correctly after PROJ-21 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: existing pages still redirect unauthenticated ────────────────

test('dashboard page still redirects unauthenticated after PROJ-21 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('bestandsverwaltung page still redirects unauthenticated after PROJ-21 (regression)', async ({ page }) => {
  await page.goto('/dashboard/bestandsverwaltung')
  await expect(page).toHaveURL(/\/login/)
})

test('produktkosten page still redirects unauthenticated after PROJ-21 (regression)', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet auswertung still redirects unauthenticated after PROJ-21 (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell still redirects unauthenticated after PROJ-21 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})
