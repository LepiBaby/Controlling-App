import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('redirect preserves ?next param for /dashboard/reporting/rentabilitaet', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Freporting%2Frentabilitaet/)
})

// ─── API Security ─────────────────────────────────────────────────────────────

test('GET /api/reporting/rentabilitaet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet with von/bis params redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=monat')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet with quartal granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2026-01&bis=2026-12&granularitaet=quartal')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/reporting/rentabilitaet with jahr granularitaet redirects unauthenticated', async ({ page }) => {
  await page.goto('/api/reporting/rentabilitaet?von=2025-01&bis=2026-12&granularitaet=jahr')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Login page still works ───────────────────────────────────────────────────

test('login page still renders correctly after PROJ-20 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Regression: existing pages still redirect unauthenticated ────────────────

test('dashboard page still redirects unauthenticated after PROJ-20 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet auswertung still redirects unauthenticated after PROJ-20 (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell still redirects unauthenticated after PROJ-20 (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('umsatz page still redirects unauthenticated after PROJ-20 (regression)', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-20 (regression)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet page still redirects unauthenticated after PROJ-20 (regression)', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('produktkosten page still redirects unauthenticated after PROJ-20 (regression)', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('old api/rentabilitaet still redirects unauthenticated after PROJ-20 (regression)', async ({ page }) => {
  await page.goto('/api/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})
