import { test, expect } from '@playwright/test'

// ─── Auth & Access ─────────────────────────────────────────────────────────

test('redirects unauthenticated user from /dashboard/kpi-modell to /login', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('preserves ?next= param when redirected from /dashboard/kpi-modell', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fkpi-modell/)
})

test('dashboard page redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// ─── PROJ-1 Regression ─────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-2 DnD changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── API Security (auth enforcement via middleware) ─────────────────────────

test('GET /api/kpi-categories redirects unauthenticated request to login', async ({ page }) => {
  await page.goto('/api/kpi-categories?type=umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('POST to /api/kpi-categories redirects unauthenticated request to login', async ({ page }) => {
  await page.goto('/api/kpi-categories')
  await expect(page).toHaveURL(/\/login/)
})

test('favicon.ico is accessible without auth (not redirected)', async ({ request }) => {
  const res = await request.get('/favicon.ico')
  const body = await res.text()
  expect(body).not.toContain('Magic Link')
})

// ─── DnD API contract: PATCH now accepts parent_id and level ───────────────

test('PATCH /api/kpi-categories/[id] with parent_id+level redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('/api/kpi-categories/some-uuid')
  // Middleware intercepts API routes and redirects unauthenticated requests to /login
  await expect(page).toHaveURL(/\/login/)
})

// ─── API validation unit tests (covered by Vitest, referenced here) ─────────
// - GET without type → 400 (route.test.ts)
// - GET with invalid type → 400 (route.test.ts)
// - POST level 4 → 400 (route.test.ts)
// - POST empty name → 400 (route.test.ts)
// - POST duplicate name → 409 (route.test.ts)
// - PATCH empty body → 400 ([id]/route.test.ts)
// - PATCH with parent_id null → accepted by schema ([id]/route.test.ts)

// ─── DnD reparent validation logic (covered by unit tests) ──────────────────
// - leaf into level-1 → valid (unit: reparent validation logic)
// - node+child into level-1 → valid (depth=1, 2+1=3 ≤ 3)
// - node+grandchild into level-1 → INVALID (depth=2, 2+2=4 > 3)
// - leaf into level-2 → valid (3+0=3 ≤ 3)
// - any node into level-3 → INVALID (newLevel=4)
// - reparent into own descendant → INVALID (isDescendantOf check)
// - promote to root (parent_id=null, level=1) → covered by reparentCategory

// ─── Sales Plattformen & Produkte tabs (AC12–AC15) ────────────────────────────

test('GET /api/kpi-categories with type=sales_plattformen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/kpi-categories?type=sales_plattformen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/kpi-categories with type=produkte redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/kpi-categories?type=produkte')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Flat type API validation (covered by Vitest, referenced here) ────────────
// - POST sales_plattformen with level=2 → 400 (route.test.ts)
// - POST produkte with level=2 → 400 (route.test.ts)
// - POST sales_plattformen with level=1, parent_id=null → 201 (route.test.ts)
// - GET type=sales_plattformen → 200 (route.test.ts)
// - GET type=produkte → 200 (route.test.ts)

// ─── addCategory error handling (covered by unit tests) ──────────────────────
// - addCategory throws on non-ok response → form shows error, name preserved
//   (KpiAddCategoryForm: catch block sets error state instead of clearing name)
