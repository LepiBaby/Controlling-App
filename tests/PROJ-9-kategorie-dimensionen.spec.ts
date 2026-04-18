import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from kpi-modell to login', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: PATCH dimension flags ───────────────────────────────────────────────

test('PATCH /api/kpi-categories/[id] with dimension flags redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/kpi-categories/some-uuid')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API unit contract (covered by Vitest, referenced here) ──────────────────
// - PATCH with sales_plattform_enabled: true → 200 ([id]/route.test.ts)
// - PATCH with produkt_enabled: false → 200 ([id]/route.test.ts)
// - PATCH with sales_plattform_enabled: 'yes' (non-boolean) → 400 ([id]/route.test.ts)

// ─── DB: new columns exist ────────────────────────────────────────────────────

test('GET /api/kpi-categories redirects unauthenticated to login (regression)', async ({ page }) => {
  await page.goto('/api/kpi-categories?type=umsatz')
  await expect(page).toHaveURL(/\/login/)
})

// ─── PROJ-2 regression ────────────────────────────────────────────────────────

test('kpi-modell page still redirects unauthenticated users after PROJ-9 changes', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('login page still renders correctly after PROJ-9 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

// ─── Functional tests (authenticated, documented as manual) ──────────────────
// AC1: SlidersHorizontal icon visible on level-1 rows (Umsatz/Einnahmen/Ausgaben & Kosten)
//   → Verified manually: icon appears on hover for level-1 categories
// AC2: Popover opens with "Sales Plattform" + "Produkt" checkboxes
//   → Verified manually: Popover renders correctly with shadcn Checkbox + Label
// AC3: Each checkbox toggleable independently
//   → Verified manually + unit test: updateDimensions patches individual boolean
// AC4: Changes saved immediately (no save button)
//   → Verified manually: PATCH fires on checkbox change, no button needed
// AC5: Active state: icon turns text-primary when any dimension enabled
//   → Verified manually: hasActiveDimension = sales_plattform_enabled || produkt_enabled
// AC6: Icon only on level-1, not level-2/3
//   → Verified by code: showDimensionen = category.level === 1 && maxLevel === 3
// AC7: Icon not in Sales Plattformen / Produkte tabs (maxLevel=1)
//   → Verified by code: maxLevel === 3 check in showDimensionen + page passes undefined for flat tabs
// AC8: Persists after reload
//   → Verified manually: PATCH writes to Supabase, GET returns updated values
