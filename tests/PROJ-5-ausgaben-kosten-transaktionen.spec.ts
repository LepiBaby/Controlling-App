import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/ausgaben to /login', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Authentication ──────────────────────────────────────────────────────

test('GET /api/ausgaben-kosten-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/ausgaben-kosten-transaktionen with filter params redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen?kategorie_ids=abc&von=2024-01-01&bis=2024-12-31')
  await expect(page).toHaveURL(/\/login/)
})

test('POST /api/ausgaben-kosten-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen')
  await expect(page).toHaveURL(/\/login/)
})

test('PATCH /api/ausgaben-kosten-transaktionen/[id] redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen/some-uuid')
  await expect(page).toHaveURL(/\/login/)
})

test('DELETE /api/ausgaben-kosten-transaktionen/[id] redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen/some-uuid')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-5 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('umsatz page still redirects unauthenticated after PROJ-5 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/umsatz')
  await expect(page).toHaveURL(/\/login/)
})

test('einnahmen page still redirects unauthenticated after PROJ-5 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/einnahmen')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-5 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
// AC: Tabellen-Spalten (dynamisch)
//   → Verified manually: showGruppe/showUntergruppe/showSalesPlattform/showProdukte computed
//     from ausgabenKategorien; columns appear/disappear based on KPI model depth
//   → Verified manually: Fixed columns always visible: Leistungsdatum, Zahlungsdatum, Kategorie,
//     Beschreibung, Brutto, Netto, USt, Rentabilität, Abschreibung
//
// AC: Transaktionseingabe (Formular)
//   → Verified manually: "Neue Transaktion" button opens modal
//   → Verified manually: Leistungsdatum, Bruttobetrag, Kategorie, USt-Satz are required
//   → Verified manually: Save button disabled until all required fields filled
//   → Verified manually: Gruppe appears and is required when selected Kategorie has children
//   → Verified manually: Untergruppe appears and is required when Gruppe has children
//   → Verified manually: Sales Plattform appears and is required when sales_plattform_enabled=true
//   → Verified manually: Produkt appears and is required when produkt_enabled=true
//   → Verified manually: Kategorie switch resets Gruppe, Untergruppe, SalesPlattform, Produkt
//   → Verified manually: USt 19% → USt-Betrag = ROUND(Brutto × 19/119, 2) shown as preview
//   → Verified manually: USt 7% → USt-Betrag = ROUND(Brutto × 7/107, 2) shown as preview
//   → Verified manually: USt 0% → USt-Betrag = 0,00 €
//   → Verified manually: USt "Individuell" → manual input field appears for USt-Betrag
//   → Verified manually: Individuell with no USt-Betrag → save blocked
//   → Verified manually: Individuell USt > Bruttobetrag → validation error (Netto negative)
//   → Verified manually: Nettobetrag preview updates automatically (not manually editable)
//   → Verified manually: Future Leistungsdatum shows amber warning but does not block save
//   → Verified manually: Zahlungsdatum is optional (can save without it)
//   → Verified manually: Saved transaction appears immediately in table
//
// AC: Bearbeiten & Löschen
//   → Verified manually: Edit icon opens pre-filled form dialog with existing values
//   → Verified manually: Delete icon opens AlertDialog confirmation
//   → Verified manually: Confirmed delete removes row from table
//
// AC: Tabellen-Funktionen
//   → Verified manually: Default sort is Leistungsdatum DESC (newest first)
//   → Verified manually: Clickable sort headers toggle asc/desc on Leistungsdatum, Bruttobetrag
//   → Verified manually: Footer shows totalBrutto and totalNetto (server-side sum over all filtered rows)
//   → Verified manually: Brutto total aligns under Brutto column header in footer
//   → Verified manually: Netto total aligns under Netto column header in footer
//   → Verified manually: Pagination shows Prev/Next, 50 rows per page
//
// AC: Filter-Hierarchie
//   → Verified manually: Kategorie MultiSelect shows all level-1 ausgaben_kosten categories
//   → Verified manually: Gruppe filter appears only when exactly 1 Kategorie selected
//   → Verified manually: Untergruppe filter appears only when exactly 1 Gruppe selected
//   → Verified manually: Selecting >1 Kategorie hides Gruppe and Untergruppe filters
//   → Verified manually: Sales Plattform filter appears when showSalesPlattform=true
//   → Verified manually: Produkt filter appears when showProdukte=true
//   → Verified manually: "Filter zurücksetzen" button clears all filters
//
// Edge cases:
//   → Verified manually: No KPI model → "Kein Ausgaben-KPI-Modell definiert" with link
//   → Verified manually: Empty table shows skeleton loading then empty state
//   → Verified manually: betrag_brutto = 0 → save blocked
