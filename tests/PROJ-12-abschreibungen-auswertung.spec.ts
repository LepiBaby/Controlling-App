import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/abschreibungen to /login', async ({ page }) => {
  await page.goto('/dashboard/abschreibungen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Authentication ──────────────────────────────────────────────────────

test('GET /api/abschreibungen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/abschreibungen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/abschreibungen with von/bis filter redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/abschreibungen?von=2024-01-01&bis=2024-12-31')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/abschreibungen with kategorie_ids filter redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/abschreibungen?kategorie_ids=abc&gruppe_ids=def&untergruppe_ids=ghi')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/abschreibungen with sort and page params redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/abschreibungen?sortColumn=betrag&sortDirection=desc&page=2')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-12 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-12 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet page still redirects unauthenticated after PROJ-12 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-12 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
//
// The following acceptance criteria were verified manually against the running app
// (see QA Test Results section in PROJ-12 feature spec):
//
// AC-01: /dashboard/abschreibungen exists and is reachable via navigation (Auswertungen group)
// AC-02: Table has columns: Datum, Ursprung, Kategorie, Gruppe*, Untergruppe*, Beschreibung, Betrag (* = conditional)
// AC-03: Gruppe column shown only when KPI model has level-2 categories
// AC-04: Untergruppe column shown only when KPI model has level-3 categories
// AC-05: Each ausgaben transaction with abschreibung IS NOT NULL generates correct number of rates
// AC-06: Rate date = ursprung day + incremented months (same month as leistungsdatum)
// AC-07: Betrag = betrag_netto / monate, rounded; last rate gets remainder (sum = betrag_netto)
// AC-08: Von/Bis filter applies to Ratendatum (not Ursprungsdatum)
// AC-09: Kategorie filter (Ebene 1 only) works
// AC-10: Gruppe filter appears only when exactly 1 Kategorie selected
// AC-11: Untergruppe filter appears only when exactly 1 Gruppe selected
// AC-12: Gesamtsumme (totalBetrag) shown in table footer
// AC-13: Sortable by Datum and Betrag
// AC-14: Pagination at > 50 entries
// AC-15: Rates not stored in DB — purely computed
// AC-16: Transactions without abschreibung do not appear
