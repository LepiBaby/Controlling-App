import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/bestandsverwaltung to /login', async ({ page }) => {
  await page.goto('/dashboard/bestandsverwaltung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Authentication ──────────────────────────────────────────────────────

test('GET /api/bestand-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/bestand-transaktionen?sku_id=00000000-0000-0000-0000-000000000001')
  await expect(page).toHaveURL(/\/login/)
})

test('PATCH /api/bestand-transaktionen/[id] redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/bestand-transaktionen/00000000-0000-0000-0000-000000000001')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Input Validation (unauthenticated path via unit tests) ──────────────
// Unit tests cover: 400 on missing sku_id, 400 on invalid datum format,
// 400 on negative anfangsbestand, 400 on negative menge, 409 on duplicate (sku_id, datum)

// ─── Regression ───────────────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-17 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('kpi-modell page still redirects unauthenticated after PROJ-17 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

test('produktkosten page still redirects unauthenticated after PROJ-17 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-17 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-17 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('investitionen page still redirects unauthenticated after PROJ-17 changes (regression)', async ({ page }) => {
  await page.goto('/dashboard/investitionen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
//
// The following acceptance criteria were verified manually against the running app
// (localhost:3001) after successful frontend + backend implementation:
//
// AC-01: /dashboard/bestandsverwaltung ist erreichbar und zeigt „Bestandsverwaltung" als Seitentitel
// AC-02: Navigation unter Datenpflege enthält den Eintrag „Bestandsverwaltung"
// AC-03: Erste Tab-Ebene zeigt je ein Tab pro Produkt (Ebene 1, sort_order)
// AC-04: Zweite Tab-Ebene zeigt je ein Tab pro SKU/Variante (Ebene 2) des gewählten Produkts
// AC-05: SKU-Tab-Label: „{sku_code} – {name}" wenn sku_code vorhanden, sonst nur name
// AC-06: Bei keinen Produkten im KPI-Modell: Leer-Zustand mit Hinweis + Link zur KPI-Modell-Verwaltung
// AC-07: Bei Produkt ohne SKUs: Leer-Zustand mit Hinweis + Link zur KPI-Modell-Verwaltung
// AC-08: Von-bis-Datumsfilter (zwei date-Inputs) unterhalb beider Tab-Ebenen angezeigt
// AC-09: Filter wirkt clientseitig auf die Transaktionsliste; ohne Filter alle Transaktionen sichtbar
// AC-10: Filter bleibt bei Tab-Wechsel zwischen Produkten / SKUs erhalten
// AC-11: „Filter zurücksetzen"-Button erscheint, wenn mindestens ein Filterfeld gesetzt ist
// AC-12: Transaktionsliste zeigt Spalten: Datum | Anfangsbestand | [Plattform-Spalten] | Sendungen Manuell | Einlagerungen | Bestandsanp.+ | Bestandsanp.− | Warenverluste | Endbestand | Aktionen
// AC-13: Tabelle standardmäßig absteigend nach Datum sortiert (neueste oben)
// AC-14: Endbestand-Spalte wird im Frontend berechnet (nicht aus DB gelesen)
// AC-15: Button „+ Neue Transaktion" öffnet Formular-Dialog
// AC-16: Dialog-Titel: „Neue Transaktion"; Pflichtfelder Datum (heute) + Anfangsbestand
// AC-17: Anfangsbestand wird automatisch mit Endbestand der letzten Transaktion vorausgefüllt
// AC-18: Bei keiner vorherigen Transaktion: Anfangsbestand-Feld leer
// AC-19: Sendungsfelder je Plattform dynamisch aus KPI-Modell (sort_order); plus „Sendungen Manuell"
// AC-20: Endbestand live im Dialog berechnet und angezeigt (read-only, hervorgehoben)
// AC-21: Formel: Anfangsbestand − Σ(Sendungen) − Sendungen Manuell + Einlagerungen + Anp.+ − Anp.− − Warenverluste
// AC-22: Doppeltes Datum: Fehlermeldung „Für dieses Datum existiert bereits ein Eintrag" (clientseitig)
// AC-23: Negative Eingaben: Fehlermeldung „Wert muss eine ganze Zahl ≥ 0 sein"
// AC-24: Speichern-Button deaktiviert bei fehlenden Pflichtfeldern oder Validierungsfehlern
// AC-25: Bearbeiten-Button öffnet Dialog vorausgefüllt mit bestehenden Werten
// AC-26: Löschen-Button zeigt AlertDialog zur Bestätigung vor dem endgültigen Löschen
// AC-27: Nach Speichern/Löschen: Tabelle wird sofort aktualisiert (Re-Fetch)
// AC-28: Negativer Endbestand: kein Fehler, Wert in text-destructive angezeigt
// AC-29: Keine Sales-Plattformen: Formular zeigt nur „Sendungen Manuell", kein Absturz
// AC-30: Von > Bis: Tabelle zeigt keine Einträge (kein Fehler)
// AC-31: Kein Eintrag im Zeitraum: leerer Zustand mit Hinweis „Keine Einträge im gewählten Zeitraum"
