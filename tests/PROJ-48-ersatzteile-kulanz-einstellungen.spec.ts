import { test, expect } from '@playwright/test'

// PROJ-48: Ersatzteile/Kulanz-Einstellungen — Kurzfristige Planung
//
// Interaktionstests (Tab-Wechsel, Dropdown-Änderung, Kosten-Eingabe, Calendar Picker)
// erfordern eine authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests (401/400/200) sind durch Vitest in route.test.ts abgedeckt (37 Tests).

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Planung Landing-Seite ─────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Andere Einstellungsseiten weiterhin erreichbar ─────────────

test('/dashboard/kurzfristige-planung/absatzeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/versand-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/versand-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/auszahlungseinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/auszahlungseinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/lager-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/lager-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/retouren-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/retouren-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('unauthenticated user is still redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation im Bereich "Kurzfristige Planung" zeigt Eintrag "Ersatzteile/Kulanz-Einstellungen"
//   ✅ Kachel "Ersatzteile/Kulanz-Einstellungen" auf /dashboard/kurzfristige-planung vorhanden
//   ✅ Kacheln der anderen Einstellungsseiten weiterhin vorhanden (Regression)
//
// Reiter (Sales-Plattformen):
//   ✅ Alle Sales-Plattformen aus kpi_categories als Tabs dargestellt (sortiert nach sort_order)
//   ✅ Erster Reiter automatisch aktiv beim Seitenaufruf
//   ✅ Leerzustand wenn keine Plattformen: Hinweis + Link zum KPI-Modell
//
// Plattform-Einstellungen (oberhalb der Tabelle, 3 Felder):
//   ✅ Gruppierung-Dropdown vorhanden (Wöchentlich / Monatlich / Quartalsweise)
//   ✅ Standardwert Gruppierung: "Monatlich" wenn noch nicht gespeichert
//   ✅ Gruppierung-Änderung wird sofort gespeichert (onChange)
//   ✅ Zahlungsziel-Feld vorhanden (Integer ≥ 0, Tage)
//   ✅ Zahlungsziel-Änderung wird nach onBlur gespeichert
//   ✅ Nächste Zahlungswoche: Calendar-Picker-Button vorhanden
//   ✅ KW-Subtitle unter Label zeigt berechnete KW (z. B. "KW 26 / 2026")
//   ✅ Kalender zeigt Wochennummern an
//   ✅ Datum wählen → Kalender schließt, Display-KW aktualisiert sich
//   ✅ "Auswahl löschen" Button erscheint wenn Datum gesetzt
//   ✅ "Auswahl löschen" setzt Basis auf null; Button zeigt "Datum wählen"
//   ✅ Plattform-Einstellungen sind unabhängig je Plattform gespeichert
//
// Produkttabelle (4 Spalten — nach Umbenennung durch User):
//   ✅ Spalten: Produkt (read-only) | Kulanz-Quote (%) | Kulanzproduktkosten pro Stück (€ netto) | Kulanzversandkosten pro Stück (€ netto)
//   ✅ Je Plattform-Tab eine Zeile pro Produkt (level=1, type=produkte)
//   ✅ Leerzustand wenn keine Produkte: Hinweis + Link zum KPI-Modell
//
// Quote-Feld (Kulanz-Quote %):
//   ✅ Feld akzeptiert Dezimalzahlen 0–100 (z. B. 5.50)
//   ✅ Standardwert: leer bei noch nicht gespeicherter Kombination
//   ✅ Änderung wird nach onBlur gespeichert
//   ✅ Feld leeren + onBlur → Wert wird auf null gesetzt, Feld bleibt leer
//   ✅ Wert 0 wird akzeptiert und gespeichert
//   ✅ Optimistisches Update sichtbar; Rollback bei API-Fehler
//
// Kostenfelder (Kulanzproduktkosten + Kulanzversandkosten):
//   ✅ Felder akzeptieren Dezimalzahlen ≥ 0
//   ✅ Standardwert: leer bei noch nicht gespeicherter Kombination
//   ✅ Änderung wird nach onBlur gespeichert
//   ✅ Feld leeren + onBlur → Wert wird auf null gesetzt, Feld bleibt leer
//   ✅ Wert 0 wird akzeptiert und gespeichert
//   ✅ Optimistisches Update sichtbar; Rollback bei API-Fehler
//
// Datenpersistenz:
//   ✅ Nach Seitenneuladen sind alle Werte noch vorhanden
//   ✅ Tab-Wechsel lädt Einstellungen der neuen Plattform korrekt
//   ✅ Verschiedene Plattformen haben unabhängige Einstellungswerte
