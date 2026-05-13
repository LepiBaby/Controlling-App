import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kpi-modell to /login', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell redirects to login with ?next param preserved', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fkpi-modell/)
})

// ─── Reporting Navigation ─────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API Security: report-positionen endpoints ────────────────────────────────

test('GET /api/report-positionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/report-positionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/report-positionen/[id] PATCH redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/report-positionen/11111111-1111-1111-a111-111111111111')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/report-positionen/[id]/kategorien redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/report-positionen/11111111-1111-1111-a111-111111111111/kategorien')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/report-positionen/[id]/summe-positionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/report-positionen/11111111-1111-1111-a111-111111111111/summe-positionen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page renders correctly (regression) ────────────────────────────────

test('login page still renders correctly after PROJ-19 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: existing pages still redirect unauthenticated ────────────────

test('dashboard page still redirects unauthenticated after PROJ-19 changes', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-19 changes', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-19 changes', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('umsatz page still redirects unauthenticated after PROJ-19 changes', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('produktkosten page still redirects unauthenticated after PROJ-19 changes', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('investitionen page still redirects unauthenticated after PROJ-19 changes', async ({ page }) => {
  await page.goto('/dashboard/investitionen')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet page still redirects unauthenticated after PROJ-19 changes', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-categories API still redirects unauthenticated after PROJ-19 changes', async ({ page }) => {
  await page.goto('/api/kpi-categories?type=umsatz')
  await expect(page).toHaveURL(/\/login/)
})
