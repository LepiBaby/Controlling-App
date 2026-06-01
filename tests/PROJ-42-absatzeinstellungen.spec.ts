import { test, expect } from '@playwright/test'

// PROJ-42: Absatzeinstellungen — Kurzfristige Planung
//
// Interaktionstests (Tab-Wechsel, Dropdown, Gewichtungsfelder) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Auth-Tests (401/400) sind durch Vitest-Integrationstests in route.test.ts abgedeckt.

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/absatzeinstellungen liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/absatzeinstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/absatzeinstellungen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Planung Landing-Seite ─────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Bestehende Dashboard-Seiten nicht betroffen ─────────────────

test('unauthenticated user is still redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated user is still redirected from /dashboard/kpi-modell to /login', async ({ page }) => {
  await page.goto('/dashboard/kpi-modell')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation im Bereich "Kurzfristige Planung" zeigt Eintrag "Absatzeinstellungen"
//   ✅ Kachel "Absatzeinstellungen" auf /dashboard/kurzfristige-planung vorhanden
//
// Reiter (Sales-Plattformen):
//   ✅ Alle Sales-Plattformen aus kpi_categories als Tabs dargestellt (volle Breite)
//   ✅ Erster Reiter automatisch aktiv beim Seitenaufruf
//   ✅ Leerzustand wenn keine Plattformen: Hinweis + Link zum KPI-Modell
//
// Tabelle (Produkte):
//   ✅ Je Plattform-Tab: eine Zeile pro Produkt (level=1, type=produkte)
//   ✅ Leerzustand wenn keine Produkte: Hinweis + Link zum KPI-Modell
//   ✅ Spalten: Produkt (read-only), Berechnungsart (Select)
//
// Dropdown Berechnungsart:
//   ✅ 8 Optionen in korrekter Reihenfolge (Mittelwert 14–90, Gewichtet 30–90, Keine)
//   ✅ Default ohne gespeicherten Wert: "Keine"
//   ✅ Wechsel speichert sofort (Auto-Save onChange)
//
// Gewichtungsspalten:
//   ✅ Spalten 1./2./3. Drittel % standardmäßig ausgeblendet
//   ✅ Spalten erscheinen wenn mind. ein Produkt gewichtete Methode wählt
//   ✅ Eingabefelder nur in Zeile mit gewichteter Methode, andere Zeilen leer
//   ✅ Fehlermeldung "Summe muss 100 % ergeben" erscheint bei Summe ≠ 100
//   ✅ Kein API-Aufruf solange Summe ≠ 100
//   ✅ Gewichtungsfelder akzeptieren nur ganze Zahlen 0–100
//   ✅ Wechsel auf nicht-gewichtete Methode: Gewichtung → NULL, Spalten verschwinden
//
// Datenpersistenz:
//   ✅ Einstellungen beim nächsten Seitenaufruf noch vorhanden
//   ✅ Beim Tab-Wechsel werden Daten des neuen Reiters geladen
//   ✅ Optimistisches Update: Änderung sofort sichtbar, Toast bei Fehler
//   ✅ Verschiedene Werte pro Plattform und Produkt unabhängig speicherbar
//
// API-Validierung (Vitest route.test.ts — 18 Tests):
//   ✅ GET ohne plattform_id → 400
//   ✅ GET mit ungültiger UUID → 400
//   ✅ PUT mit ungültiger berechnungsart → 400
//   ✅ PUT mit Gewichtung ≠ 100 → 400
//   ✅ PUT mit fehlender produkt_id → 400
//   ✅ Unauthentifizierter Zugriff → 401 (GET + PUT)
//   ✅ DB-Fehler → 500 (GET + PUT)
