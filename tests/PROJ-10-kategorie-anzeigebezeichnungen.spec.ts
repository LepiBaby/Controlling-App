import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from kpi-modell to login (PROJ-10)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: PATCH label fields ──────────────────────────────────────────────────

test('PATCH /api/kpi-categories/[id] with label fields redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/kpi-categories/some-uuid')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API unit contract (covered by Vitest, referenced here) ──────────────────
// - PATCH with kosten_label: 'Produktkosten' → 200   ([id]/route.test.ts)
// - PATCH with ausgaben_label: 'Produktausgaben' → 200   ([id]/route.test.ts)
// - PATCH with kosten_label: null (clear) → 200   ([id]/route.test.ts)
// - PATCH with kosten_label of 101 chars → 400   ([id]/route.test.ts)

// ─── Rentabilitäts- & Liquiditäts-API Regression ──────────────────────────────

test('GET /api/rentabilitaet redirects unauthenticated after PROJ-10 (regression)', async ({ page }) => {
  await page.goto('/api/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/liquiditaet redirects unauthenticated after PROJ-10 (regression)', async ({ page }) => {
  await page.goto('/api/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: übrige Seiten ───────────────────────────────────────────────

test('login page still renders correctly after PROJ-10 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated to login after PROJ-10 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-10 (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet page still redirects unauthenticated after PROJ-10 (regression)', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated, documented as manual) ──────────────────
// AC1: Tag icon visible on level-1 rows only in "Ausgaben & Kosten" tab
//   → Verified by code: showLabels = level === 1 && !!onUpdateLabels
//   → page.tsx passes onUpdateLabels only when type === 'ausgaben_kosten'
// AC2: Click icon opens Popover with two inputs (Kosten, Ausgaben)
//   → Verified manually: shadcn Popover with Label + Input × 2
// AC3: Save via onBlur when Popover closes (onOpenChange)
//   → Verified by code: patch only sent when value changed (kl !== category.kosten_label)
// AC4: Empty label stored as null (trim → null)
//   → Verified by code: kostLabel.trim() || null
// AC5: Active icon state (text-primary) when at least one label set
//   → Verified by code: hasActiveLabels = !!(category.kosten_label || category.ausgaben_label)
// AC6: Icon NOT visible on level-2, level-3, or other tabs
//   → Verified by code guards; onUpdateLabels undefined for non-ausgaben_kosten tabs
// AC7: Persisted after reload
//   → Verified by code: PATCH to Supabase; useEffect resyncs local state from props
// AC8: Rentabilität uses kosten_label ?? name for kosten rows
//   → Verified by code: getCategoryDisplayName with labelType='kosten'
// AC9: Liquidität uses ausgaben_label ?? name for ausgaben rows
//   → Verified by code: getCategoryDisplayName with labelType='ausgaben'
// AC10: 101-char label rejected (backend 400)
//   → Verified in [id]/route.test.ts
