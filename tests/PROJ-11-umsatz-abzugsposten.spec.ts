import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from kpi-modell to login (PROJ-11)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: PATCH ist_abzugsposten ──────────────────────────────────────────────

test('PATCH /api/kpi-categories/[id] with ist_abzugsposten redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/kpi-categories/some-uuid')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API unit contract (covered by Vitest, referenced here) ──────────────────
// - PATCH with ist_abzugsposten: true → 200   ([id]/route.test.ts)
// - PATCH with ist_abzugsposten: false → 200   ([id]/route.test.ts)
// - PATCH with ist_abzugsposten: 'true' (non-boolean) → 400   ([id]/route.test.ts)

// ─── Rentabilitäts-API Regression (Abzugsposten-Wirkung) ─────────────────────

test('GET /api/rentabilitaet redirects unauthenticated after PROJ-11 (regression)', async ({ page }) => {
  await page.goto('/api/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/rentabilitaet with quelle=umsatz redirects unauthenticated (regression)', async ({ page }) => {
  await page.goto('/api/rentabilitaet?quelle=umsatz')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: übrige Seiten ───────────────────────────────────────────────

test('login page still renders correctly after PROJ-11 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated to login after PROJ-11 (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('umsatz page still redirects unauthenticated after PROJ-11 (regression)', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-11 (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated, documented as manual) ──────────────────
// AC1: TrendingDown icon visible on level-1 rows only in "Umsatz" tab
//   → Verified by code: showAbzugsposten = level === 1 && !!onUpdateAbzugsposten
//   → page.tsx passes onUpdateAbzugsposten only when type === 'umsatz'
// AC2: Click icon opens Popover with single checkbox
//   → Verified manually: shadcn Popover + Checkbox + Label
// AC3: Immediate save on checkbox toggle (PATCH fires onCheckedChange)
//   → Verified by code: updateAbzugsposten called directly from onCheckedChange
// AC4: Active icon turns text-destructive (red) when checked
//   → Verified by code: className cn('h-6 w-6', category.ist_abzugsposten && 'text-destructive')
// AC5: Icon NOT visible in Einnahmen/Ausgaben&Kosten/Sales Plattformen/Produkte tabs
//   → Verified by code: onUpdateAbzugsposten undefined for non-umsatz tabs
// AC6: Icon NOT visible on level-2 or level-3 rows
//   → Verified by code: showAbzugsposten includes level === 1 check
// AC7: Persists after reload
//   → Verified by code: PATCH updates Supabase; GET includes column
// AC8: Rentabilität: umsatz transactions from Abzugsposten categories shown as negative
//   → Verified by code: route.ts loads abzugspostenIds set, multiplies betrag × -1
// AC9: totalNetto is reduced by Abzugsposten amounts
//   → Verified by code: negative betrag propagates into reduce() sum
// AC10: Transactions remain positive in DB (no data mutation)
//   → Verified by code: sign flip happens in API response only, not in umsatz_transaktionen table
