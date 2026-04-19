import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Authentication ──────────────────────────────────────────────────────

test('GET /api/rentabilitaet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/rentabilitaet with filter params redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/rentabilitaet?quelle=umsatz&von=2024-01-01&bis=2024-12-31')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/rentabilitaet with kategorie filter redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/rentabilitaet?kategorie_ids=abc&gruppe_ids=def')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-6 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('umsatz page still redirects unauthenticated after PROJ-6 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-6 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet page still redirects unauthenticated after PROJ-6 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
//
// The following acceptance criteria were verified manually against the running app
// (see QA Test Results section in PROJ-6 feature spec):
//
// AC-UI-01: Table shows Leistungsdatum, Quelle, Beschreibung, Betrag columns always
// AC-UI-02: Kategorie column shown when KPI model has level-1 categories
// AC-UI-03: Gruppe column shown when KPI model has level-2 categories
// AC-UI-04: Untergruppe column shown when KPI model has level-3 categories
// AC-UI-05: Sales Plattform column shown when sales_plattform_enabled = true
// AC-UI-06: Produkte column shown when produkt_enabled = true
// AC-BETRAG-01: Umsatz rows show positive amount in green text
// AC-BETRAG-02: Kosten rows show negative amount (with minus sign) in red text
// AC-QUELLE-01: Quelle badge shows "Umsatz" / "Kosten" per row
// AC-FILTER-01: Von/Bis date filters apply to Leistungsdatum
// AC-FILTER-02: Quelle filter (Umsatz/Kosten multi-select) works
// AC-FILTER-03: Kategorie filter hidden when no Quelle or both Quellen selected
// AC-FILTER-04: Kategorie filter shows only Umsatz categories when Quelle=Umsatz
// AC-FILTER-05: Kategorie filter shows only Kosten categories when Quelle=Kosten
// AC-FILTER-06: Gruppe filter visible only when exactly 1 Kategorie selected
// AC-FILTER-07: Untergruppe filter visible only when exactly 1 Gruppe selected
// AC-FILTER-08: Changing Quelle resets Kategorie, Gruppe, Untergruppe
// AC-SORT-01: Default sort is Leistungsdatum descending (newest first)
// AC-SORT-02: Clickable sort on Leistungsdatum and Betrag columns
// AC-FOOTER-01: Footer shows Netto-Ergebnis summed over all filtered rows (not just current page)
// AC-FOOTER-02: Positive Netto-Ergebnis in green, negative in red
// AC-PAGINATION-01: 50 rows per page, pagination controls present
// AC-RESET-01: "Filter zurücksetzen" button clears all filter values
// AC-EMPTY-01: Empty state message shown when no transactions match filters
// AC-NAV-01: Rentabilität link visible in nav under "Auswertungen" group
// AC-NAV-02: Rentabilität card visible on /dashboard overview
