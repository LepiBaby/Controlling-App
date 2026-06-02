import { test, expect } from '@playwright/test'

// PROJ-46: Lager-Ausgaben-Einstellungen — Kurzfristige Planung
//
// Interaktionstests (Tab-Wechsel, Lagerkosten-Eingabe, Batch-Upsert, Calendar Picker)
// erfordern eine authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests (401/400/200) sind durch Vitest in route.test.ts abgedeckt.
// Batch-Logik und optimistisches Update sind durch Vitest in use-lagerausgaben-einstellungen.test.ts abgedeckt.

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/lagerausgaben-einstellungen liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/lagerausgaben-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/lagerausgaben-einstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/lagerausgaben-einstellungen')
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

test('/dashboard/kurzfristige-planung/versandausgaben-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/versandausgaben-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/auszahlungseinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/auszahlungseinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('unauthenticated user is still redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation im Bereich "Kurzfristige Planung" zeigt Eintrag "Lager-Ausgaben"
//   ✅ Kachel "Lager-Ausgaben-Einstellungen" auf /dashboard/kurzfristige-planung vorhanden
//   ✅ Kacheln der anderen Einstellungsseiten weiterhin vorhanden (Regression)
//
// Reiter (Sales-Plattformen):
//   ✅ Alle Sales-Plattformen aus kpi_categories als Tabs dargestellt (sortiert nach sort_order)
//   ✅ Erster Reiter automatisch aktiv beim Seitenaufruf
//   ✅ Leerzustand wenn keine Plattformen: Hinweis + Link zum KPI-Modell
//
// Plattform-Einstellungen (oberhalb der Tabelle):
//   ✅ Gruppierung-Dropdown vorhanden (Wöchentlich / Monatlich / Quartalsweise)
//   ✅ Standardwert Gruppierung: "Monatlich" wenn noch nicht gespeichert
//   ✅ Gruppierung-Änderung wird sofort gespeichert (kein Button nötig)
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
// „Alle gleichsetzen"-Bereich:
//   ✅ Input-Feld „€/m³ für alle Produkte" vorhanden
//   ✅ „Übernehmen"-Button deaktiviert wenn Feld leer
//   ✅ „Übernehmen"-Button deaktiviert wenn keine Produkte vorhanden
//   ✅ Wert eingeben + „Übernehmen" → alle Produktzeilen werden sofort aktualisiert
//   ✅ Nach Erfolg: „Alle gleichsetzen"-Feld wird geleert
//   ✅ Wert 0 wird akzeptiert und gesetzt
//
// Produkttabelle:
//   ✅ Spalten: Produkt (read-only) | Lagerkosten (€/m³) (editierbar)
//   ✅ Je Plattform-Tab eine Zeile pro Produkt (level=1, type=produkte)
//   ✅ Leerzustand wenn keine Produkte: Hinweis + Link zum KPI-Modell
//   ✅ Leerfeld + onBlur → Wert wird auf null gesetzt, Feld bleibt leer
//   ✅ Wert 0 wird akzeptiert und gespeichert
//
// Datenpersistenz:
//   ✅ Nach Seitenneuladen sind alle Werte noch vorhanden (Plattform-Einstellungen + Produktwerte)
//   ✅ Tab-Wechsel lädt Einstellungen der neuen Plattform korrekt
//   ✅ Verschiedene Plattformen haben unabhängige Lagerkosten-Werte
//
// Optimistisches Update (Einzel + Batch):
//   ✅ Einzel-Änderung erscheint sofort in der UI
//   ✅ Batch-Änderung erscheint sofort in allen Produktzeilen
