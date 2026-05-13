import { test, expect } from '@playwright/test'

// ─── Auth & Access ────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/produktkosten to /login', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

// ─── API: Authentication ──────────────────────────────────────────────────────

test('GET /api/ausgaben-kosten-transaktionen redirects unauthenticated to login', async ({ page }) => {
  await page.goto('/api/ausgaben-kosten-transaktionen?produkt_ids=00000000-0000-0000-0000-000000000001')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression ───────────────────────────────────────────────────────────────

test('login page still renders correctly after PROJ-18 changes', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: /Magic Link senden/i })).toBeVisible()
})

test('dashboard redirects unauthenticated user to login (regression)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('produktkosten page still redirects unauthenticated after PROJ-18 changes', async ({ page }) => {
  await page.goto('/dashboard/produktkosten')
  await expect(page).toHaveURL(/\/login/)
})

test('ausgaben page still redirects unauthenticated after PROJ-18 changes', async ({ page }) => {
  await page.goto('/dashboard/ausgaben')
  await expect(page).toHaveURL(/\/login/)
})

test('rentabilitaet page still redirects unauthenticated after PROJ-18 changes', async ({ page }) => {
  await page.goto('/dashboard/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Functional tests (authenticated — documented as manually verified) ───────
//
// The following acceptance criteria were verified manually against the running app
// (see QA Test Results section in PROJ-18 feature spec):
//
// AC-01: „+ Neuer Zeitraum" öffnet 3-Schritt-Assistenten (nicht altes Formular)
// AC-02: Schritt 1 — Datumseingabe: Gültig von (Pflicht), Gültig bis (optional); Weiter deaktiviert wenn leer
// AC-03: Schritt 2 — Transaktionsliste zeigt alle Ausgaben & Kosten mit Produktkategorie für das gewählte Produkt
// AC-04: Schritt 2 — Transaktionen per Checkbox auswählbar; Menge-Eingabe vorhanden
// AC-05: Schritt 2 — Weiter deaktiviert wenn 0 Transaktionen ausgewählt oder Menge fehlt
// AC-06: Schritt 2 — „Alter Zeitraum einbeziehen" ist standardmäßig ausgeklappt
// AC-07: Schritt 2 — Alter Zeitraum + Restmenge auswählbar für gewichteten Durchschnitt
// AC-08: Schritt 3 — Berechnete Stückkosten vorausgefüllt und bearbeitbar
// AC-09: Schritt 3 — Berechnungsgrundlage (Anzahl Transaktionen, Menge) sichtbar
// AC-10: Schritt 3 — Gesamt-Zeile = Summe aller Stückkosten
// AC-11: Schritt 3 — Speichern sendet Daten und schließt Dialog; Tabelle aktualisiert sich
// AC-12: Keine Transaktionen → Hinweismeldung + Link zu Ausgaben & Kosten
// AC-13: Bearbeiten-Button öffnet Assistenten direkt bei Schritt 3 mit bestehenden Werten
// AC-14: Im Bearbeitungsmodus werden gespeicherte Transaktions-IDs + Menge in Schritt 2 vorausgefüllt (nach „Zurück")
// AC-15: Im Bearbeitungsmodus zeigt Schritt 3 die Berechnungsgrundlage (Transaktionen + Menge)
// AC-16: Überlappungsfehler (409) wird dem Nutzer in Schritt 3 angezeigt
// AC-17: „Zurück"-Button erlaubt Navigation zwischen Schritten
// AC-18: Validierung: Gültig bis muss nach Gültig von liegen
