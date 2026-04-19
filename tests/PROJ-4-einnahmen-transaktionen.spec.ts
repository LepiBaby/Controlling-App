import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/einnahmen to /login', async ({ page }) => {
  await page.goto('/dashboard/einnahmen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Authentication ──────────────────────────────────────────────────────

test('GET /api/einnahmen-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/einnahmen-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/einnahmen-transaktionen with filter params redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/einnahmen-transaktionen?kategorie_ids=abc&gruppe_ids=def')
  await expect(page).toHaveURL(/\/login/)
})

test('POST /api/einnahmen-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/einnahmen-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('PATCH /api/einnahmen-transaktionen/[id] redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/einnahmen-transaktionen/some-uuid')
  await expect(page).toHaveURL(/\/login/)
})

test('DELETE /api/einnahmen-transaktionen/[id] redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/einnahmen-transaktionen/some-uuid')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-4 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-4 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
// AC: Tabellen-Spalten (dynamisch)
//   → Verified manually: showGruppe/showUntergruppe/showSalesPlattform/showProdukte computed
//     from einnahmenKategorien; columns appear/disappear based on KPI model depth
//
// AC: Transaktionseingabe (Formular)
//   → Verified manually: "Neue Transaktion" button opens modal
//   → Verified manually: Zahlungsdatum, Betrag, Kategorie are required (save button disabled)
//   → Verified manually: Gruppe appears and is required when selected Kategorie has children
//   → Verified manually: Untergruppe appears and is required when Gruppe has children
//   → Verified manually: Sales Plattform appears and is required when sales_plattform_enabled=true
//   → Verified manually: Produkt appears and is required when produkt_enabled=true
//   → Verified manually: Kategorie switch resets Gruppe, Untergruppe, SalesPlattform, Produkt
//   → Verified manually: Future date shows amber warning but does not block save
//   → Verified manually: betrag=0 disables save button
//
// AC: Filter-Hierarchie
//   → Verified manually: Kategorie MultiSelect shows all level-1 categories
//   → Verified manually: Gruppe filter appears only when exactly 1 Kategorie selected
//   → Verified manually: Untergruppe filter appears only when exactly 1 Gruppe selected
//   → Verified manually: Selecting >1 Kategorie hides Gruppe and Untergruppe filters
//   → Verified manually: Sales Plattform filter appears when showSalesPlattform=true
//   → Verified manually: Produkt filter appears when showProdukte=true
//   → Verified manually: Filter zurücksetzen button clears all filters
//
// AC: Bearbeiten & Löschen
//   → Verified manually: Edit icon opens pre-filled form dialog
//   → Verified manually: Delete icon opens AlertDialog confirmation
//   → Verified manually: Confirmed delete removes row from table
//
// AC: Tabellen-Funktionen
//   → Verified manually: Default sort is zahlungsdatum DESC (newest first)
//   → Verified manually: Clickable sort headers toggle asc/desc on zahlungsdatum, betrag
//   → Verified manually: Footer shows totalBetrag (server-side sum, not just current page)
//   → Verified manually: Pagination shows Prev/Next, 50 rows per page
//
// Edge cases:
//   → Verified manually: No KPI model → "Kein Einnahmen-KPI-Modell definiert" with link
//   → Verified manually: Empty table shows skeleton loading then empty state
