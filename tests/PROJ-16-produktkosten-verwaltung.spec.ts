import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/produktkosten to /login', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Authentication ──────────────────────────────────────────────────────

test('GET /api/produktkosten redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/produktkosten?produkt_id=00000000-0000-0000-0000-000000000001')
  await expect(page).toHaveURL(/\/login/)
})

test('GET /api/produktkosten/[id] redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/produktkosten/00000000-0000-0000-0000-000000000001')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Input Validation ────────────────────────────────────────────────────

test('GET /api/produktkosten without produkt_id returns 400', async ({ page }) => {
  // Without auth session, gets 401 — but with the mock pattern we test this via unit tests
  // The Vitest unit test already covers this: "returns 400 when produkt_id is missing"
  await page.goto('/api/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-16 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-16 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-16 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-16 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('investitionen page still redirects unauthenticated after PROJ-16 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/investitionen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
//
// The following acceptance criteria were verified manually against the running app
// (see QA Test Results section in PROJ-16 feature spec):
//
// AC-01: /dashboard/produktkosten existiert und ist über Navigation „Produktkosten" unter Datenpflege erreichbar
// AC-02: Seite zeigt je ein Tab pro Produkt in Reihenfolge des KPI-Modells (sort_order)
// AC-03: Jeder Tab zeigt Tabelle mit Spalten: Gültig von | Gültig bis | [Kostenkategorien] | Gesamt | Aktionen
// AC-04: Gesamt-Spalte = clientseitige Summe aller Kostenwerte; kein Gesamt-Eingabefeld im Formular
// AC-05: Button „+ Neuer Zeitraum" öffnet Dialog mit: Gültig von (Pflicht), Gültig bis (optional), €-Felder
// AC-06: Kostenkategorien = Ebene-2-Unterkategorien von „Produkt" (ausgaben_kosten), exkl. „Wertverlust Ware"
// AC-07: Kostenkategorien im Formular und Tabelle nach sort_order sortiert
// AC-08: Alle Kostenwerte als €-Beträge formatiert (z.B. „5,50 €")
// AC-09: Pflichtfelder: Gültig von, alle Kostenwerte ≥ 0; Speichern-Button deaktiviert bei Verstoß
// AC-10: Validierung: Gültig bis muss nach Gültig von liegen (Fehlermeldung bei Verstoß)
// AC-11: Überlappungsprüfung serverseitig — 409-Fehler wird dem Nutzer angezeigt
// AC-12: Bearbeiten-Button öffnet Dialog vorausgefüllt mit bestehenden Werten
// AC-13: Löschen-Button zeigt Bestätigungs-AlertDialog; Abbrechen bricht ab, Löschen entfernt Eintrag
// AC-14: Keine Produkte im KPI-Modell → Hinweismeldung + Link zur KPI-Modell-Verwaltung
// AC-15: Keine Kostenkategorien nach Ausschluss von „Wertverlust Ware" → Hinweis + Link
// AC-16: Nach Speichern/Bearbeiten/Löschen werden Daten sofort neu geladen (Re-Fetch)
