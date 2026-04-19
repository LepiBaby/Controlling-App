import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/liquiditaet to /login', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Authentication ──────────────────────────────────────────────────────

test('GET /api/liquiditaet redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/liquiditaet with filter params redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/liquiditaet?quelle=einnahmen&von=2024-01-01&bis=2024-12-31')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/liquiditaet with kategorie filter redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/liquiditaet?kategorie_ids=abc&gruppe_ids=def')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-7 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('einnahmen page still redirects unauthenticated after PROJ-7 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/einnahmen')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-7 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-7 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
//
// The following acceptance criteria were verified manually against the running app
// (see QA Test Results section in PROJ-7 feature spec):
//
// AC-UI-01: Table shows Zahlungsdatum, Quelle, Beschreibung, Betrag columns always
// AC-UI-02: Kategorie column shown when KPI model has level-1 categories
// AC-UI-03: Gruppe column shown when KPI model has level-2 categories
// AC-UI-04: Untergruppe column shown when KPI model has level-3 categories
// AC-UI-05: Sales Plattform column shown when sales_plattform_enabled = true
// AC-UI-06: Produkte column shown when produkt_enabled = true
// AC-BETRAG-01: Einnahmen rows show positive amount in green text
// AC-BETRAG-02: Ausgaben rows show negative amount (with minus sign) in red text
// AC-BETRAG-03: Betrag uses betrag_brutto for Ausgaben&Kosten rows (not betrag_netto)
// AC-QUELLE-01: Quelle badge shows "Einnahmen" / "Ausgaben" per row
// AC-FILTER-01: Von/Bis date filters apply to Zahlungsdatum
// AC-FILTER-02: Quelle filter (Einnahmen/Ausgaben multi-select) works
// AC-FILTER-03: Kategorie filter hidden when no Quelle or both Quellen selected
// AC-FILTER-04: Kategorie filter shows only Einnahmen categories when Quelle=Einnahmen
// AC-FILTER-05: Kategorie filter shows only Ausgaben categories when Quelle=Ausgaben
// AC-FILTER-06: Gruppe filter visible only when exactly 1 Kategorie selected
// AC-FILTER-07: Untergruppe filter visible only when exactly 1 Gruppe selected
// AC-FILTER-08: Changing Quelle resets Kategorie, Gruppe, Untergruppe
// AC-SORT-01: Default sort is Zahlungsdatum descending (newest first)
// AC-SORT-02: Clickable sort on Zahlungsdatum and Betrag columns
// AC-FOOTER-01: Footer shows Netto-Cashflow summed over all filtered rows (not just current page)
// AC-FOOTER-02: Positive Netto-Cashflow in green, negative in red
// AC-PAGINATION-01: 50 rows per page, pagination controls present
// AC-RESET-01: "Filter zurücksetzen" button clears all filter values
// AC-EMPTY-01: Empty state message shown when no transactions match filters
// AC-DATA-01: Ausgaben&Kosten rows without Zahlungsdatum do NOT appear in this view
// AC-NAV-01: Liquidität link visible in nav under "Auswertungen" group
// AC-NAV-02: Liquidität card visible on /dashboard overview
