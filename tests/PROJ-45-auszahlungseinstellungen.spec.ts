import { test, expect } from '@playwright/test'

// PROJ-45: Auszahlungseinstellungen — Kurzfristige Planung
//
// Interaktionstests (Tab-Wechsel, Kalender, Checkboxen, Auto-Save) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests (401/400/200) sind durch Vitest in route.test.ts abgedeckt.
// Berechnungslogik-Tests sind durch Vitest in use-auszahlungs-einstellungen.test.ts abgedeckt.

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/auszahlungseinstellungen liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/auszahlungseinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/auszahlungseinstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/auszahlungseinstellungen')
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

test('unauthenticated user is still redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation im Bereich "Kurzfristige Planung" zeigt Eintrag "Auszahlungseinstellungen"
//   ✅ Kachel "Auszahlungseinstellungen" auf /dashboard/kurzfristige-planung vorhanden
//   ✅ Kacheln der anderen Einstellungsseiten weiterhin vorhanden (Regression)
//
// Reiter (Sales-Plattformen):
//   ✅ Alle Sales-Plattformen aus kpi_categories als Tabs dargestellt (sortiert nach sort_order)
//   ✅ Erster Reiter automatisch aktiv beim Seitenaufruf
//   ✅ Leerzustand wenn keine Plattformen: Hinweis + Link zum KPI-Modell
//
// Formular pro Plattform:
//   ✅ Zeile "Auszahlungsrhythmus" mit Dropdown (Wöchentlich / Alle 2/3/4 Wochen)
//   ✅ Standardwert des Dropdowns: "Wöchentlich" (wenn noch nicht gespeichert)
//   ✅ Zeile "Nächste Auszahlungswoche" mit Datepicker-Button (Popover)
//   ✅ KW-Subtitle unter dem Label zeigt berechnete KW (z. B. "KW 23 / 2026")
//   ✅ Kalender zeigt Wochennummern an
//   ✅ Zeile "Retouren" mit Checkbox
//   ✅ Zeile "Marketing" mit Checkbox
//   ✅ Standardwerte: Checkboxen nicht angehakt
//
// Datepicker-Verhalten:
//   ✅ Klick auf Datepicker öffnet Kalender-Popover
//   ✅ Datum wählen → Kalender schließt, Button zeigt ausgewähltes Datum
//   ✅ KW-Subtitle aktualisiert sich nach Auswahl
//   ✅ "Auswahl löschen" Button erscheint wenn Datum gesetzt, löscht die Basis
//   ✅ Button zeigt "Datum wählen" wenn keine Basis gesetzt
//
// Berechnungslogik (manuell geprüft):
//   ✅ Angezeigter Datepicker-Button zeigt nächste berechnete Auszahlungswoche
//   ✅ Basis in der Vergangenheit → wird vorgerückt entsprechend Rhythmus
//   ✅ KW-Subtitle stimmt mit dem Datepicker-Button überein
//
// Auto-Save:
//   ✅ Rhythmus-Änderung → sofortiges Speichern (kein separater Button)
//   ✅ Datum-Auswahl im Kalender → sofortiges Speichern
//   ✅ "Auswahl löschen" → sofortiges Speichern (null)
//   ✅ Checkbox-Änderung → sofortiges Speichern
//
// Datenpersistenz:
//   ✅ Nach Seitenneuladen sind alle Werte noch vorhanden
//   ✅ Tab-Wechsel lädt Einstellungen der neuen Plattform korrekt
//
// Optimistisches Update:
//   ✅ Änderung erscheint sofort in der UI
