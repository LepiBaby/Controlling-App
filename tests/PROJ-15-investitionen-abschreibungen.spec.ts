import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/investitionen to /login', async ({ page }) => {
  await page.goto('/dashboard/investitionen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Authentication ──────────────────────────────────────────────────────

test('GET /api/investitionen-abschreibungen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/investitionen-abschreibungen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/investitionen-abschreibungen with von/bis filter redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/investitionen-abschreibungen?von=2026-01-01&bis=2026-12-31')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/investitionen-abschreibungen with gruppe/untergruppe filter redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/investitionen-abschreibungen?gruppe_ids=abc&untergruppe_ids=def')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/investitionen-abschreibungen with produkt filter redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/investitionen-abschreibungen?produkt_ids=abc')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/investitionen-abschreibungen with sort and page params redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/investitionen-abschreibungen?sortColumn=betrag&sortDirection=desc&page=2')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-15 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-15 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('liquiditaet page still redirects unauthenticated after PROJ-15 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/liquiditaet')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-15 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('abschreibungen page still redirects unauthenticated after PROJ-15 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/abschreibungen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
//
// The following acceptance criteria were verified manually against the running app
// (see QA Test Results section in PROJ-15 feature spec):
//
// AC-01: /dashboard/investitionen exists and is reachable via navigation (Auswertungen group)
// AC-02: Table has columns: Datum, Ursprung, Gruppe*, Untergruppe*, Produkt*, Beschreibung, Betrag (* = conditional)
// AC-03: Gruppe column shown only when at least one transaction has gruppe_id
// AC-04: Untergruppe column shown only when at least one transaction has untergruppe_id
// AC-05: Produkt column shown only when at least one transaction has produkt_id
// AC-06: No Kategorie filter — replaced by implicit "Produktinvestitionen" scope
// AC-07: Only transactions with Kategorie-Name = "Produktinvestitionen" (level-1) are included
// AC-08: Each qualified ausgaben transaction generates exactly 12 monthly rates
// AC-09: Rate date = ursprung day + incremented months (starts at same month as leistungsdatum)
// AC-10: Betrag = betrag_netto / 12, rounded; last rate gets remainder (sum = betrag_netto)
// AC-11: Von/Bis filter applies to Ratendatum (not Ursprungsdatum)
// AC-12: Gruppe filter always visible (when groups exist) — no parent category filter
// AC-13: Untergruppe filter appears only when exactly 1 Gruppe selected
// AC-14: Produkt filter is permanent (not conditional) — appears if KPI model has produkte
// AC-15: Gesamtsumme (totalBetrag) shown in table footer
// AC-16: Sortable by Datum and Betrag
// AC-17: Pagination at > 50 entries
// AC-18: Rates not stored in DB — purely computed
// AC-19: Transactions with betrag_netto = 0 generate no rates
// AC-20: Missing "Produktinvestitionen" category shows empty state with link to KPI-Modell
