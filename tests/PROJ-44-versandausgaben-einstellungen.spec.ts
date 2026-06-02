import { test, expect } from '@playwright/test'

// PROJ-44: Versandausgaben-Einstellungen — Kurzfristige Planung
//
// Interaktionstests (Tab-Wechsel, Tabelleneingabe, Auto-Save) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Auth-Tests (401/400) sind durch Vitest-Integrationstests in route.test.ts abgedeckt.
// Hook-Logik (getEinstellung, optimistic update, rollback) ist durch Vitest-Unit-Tests abgedeckt.

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/versand-einstellungen liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/versand-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/versand-einstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/versand-einstellungen')
  await expect(page).toHaveURL(/\/login/)
})

// Note: API auth/validation tests (401, 400) are covered by Vitest route.test.ts (34 tests).
// Playwright's request fixture shares browser cookie state which makes isolated API auth testing unreliable.

// ─── Regression: Kurzfristige Planung ────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

test('/dashboard/kurzfristige-planung/absatzeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Bestehende Dashboard-Seiten nicht betroffen ─────────────────

test('unauthenticated user is still redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation enthält Eintrag „Versandausgaben-Einstellungen"
//   ✅ Kachel „Versandausgaben-Einstellungen" auf /dashboard/kurzfristige-planung vorhanden
//   ✅ Kachel „Verkaufsgebühr-Einstellungen" weiterhin vorhanden (Regression)
//   ✅ Kachel „Absatzeinstellungen" weiterhin vorhanden (Regression)
//
// Reiter (Sales-Plattformen):
//   ✅ Alle Sales-Plattformen aus kpi_categories als Tabs dargestellt
//   ✅ Erster Reiter automatisch aktiv beim Seitenaufruf
//   ✅ Leerzustand wenn keine Plattformen: Hinweis + Link zum KPI-Modell
//
// Plattform-Einstellungen (je Tab, über der Tabelle):
//   ✅ Gruppierung-Dropdown vorhanden (Wöchentlich / Monatlich / Quartalsweise)
//   ✅ Standardwert: Monatlich bei erstem Aufruf
//   ✅ Änderung der Gruppierung wird automatisch gespeichert (onChange)
//   ✅ Zahlungsziel-Feld vorhanden (Integer ≥ 0, Tage)
//   ✅ Änderung des Zahlungsziels wird nach onBlur automatisch gespeichert
//   ✅ Einstellungen sind pro Plattform gespeichert (nicht global)
//
// Tabelle (Produkte):
//   ✅ Je Plattform-Tab: eine Zeile pro Produkt (level=1, type=produkte)
//   ✅ Leerzustand wenn keine Produkte: Hinweis + Link zum KPI-Modell
//   ✅ Spalten: Produkt (read-only) | Spediteur (€ netto) | 3PL (€ netto) | Versandausgaben (€ netto, read-only Summe)
//
// Versandgebühr-Felder (Spediteur + 3PL):
//   ✅ Beide Felder akzeptieren Dezimalzahlen ≥ 0
//   ✅ Standard bei ungepflegten Kombinationen: leer (kein Wert)
//   ✅ Änderung wird nach onBlur automatisch gespeichert
//   ✅ Feld leeren und onBlur: Wert wird auf null gesetzt, Feld bleibt leer
//
// Summen-Spalte:
//   ✅ Wenn beide Felder leer (null): Summe zeigt „—"
//   ✅ Wenn ein Feld befüllt, anderes leer: Summe = befüllter Wert
//   ✅ Wenn beide Felder befüllt: Summe = Spediteur + 3PL korrekt
//   ✅ Summen-Spalte ist read-only (nicht editierbar)
//
// Datenpersistenz:
//   ✅ Werte beim nächsten Seitenaufruf noch vorhanden
//   ✅ Beim Tab-Wechsel werden Daten des neuen Reiters geladen
//   ✅ Verschiedene Werte pro Plattform und Produkt unabhängig speicherbar
//   ✅ Gruppierung + Zahlungsziel pro Plattform unabhängig speicherbar
//   ✅ Optimistisches Update: Änderung sofort sichtbar, Toast bei API-Fehler
//
// API-Validierung (Vitest route.test.ts — 34 Tests):
//   ✅ GET ohne plattform_id → 400
//   ✅ GET mit ungültiger UUID → 400
//   ✅ PUT mit negativem Spediteur-Wert → 400
//   ✅ PUT mit negativem 3PL-Wert → 400
//   ✅ PUT ohne required fields → 400
//   ✅ PUT mit null → 200 (Felder löschen)
//   ✅ PUT Plattform-Einstellungen: Gruppierung-only → 200 (Zahlungsziel bleibt erhalten)
//   ✅ PUT Plattform-Einstellungen: Zahlungsziel-only → 200 (Gruppierung bleibt erhalten)
//   ✅ PUT Plattform-Einstellungen: ungültige Gruppierung → 400
//   ✅ PUT Plattform-Einstellungen: negativer Zahlungsziel-Wert → 400
//   ✅ PUT Plattform-Einstellungen: kein Patch-Feld → 400
//   ✅ Unauthentifizierter Zugriff → 401 (alle Routen)
//   ✅ DB-Fehler → 500
//
// Hook-Logik (Vitest unit tests — 8 Tests):
//   ✅ getEinstellung: gefundener Eintrag wird zurückgegeben
//   ✅ getEinstellung: Default mit null-Feldern wenn Produkt nicht in State
//   ✅ getEinstellung: Default mit leerem sales_plattform_id wenn kein plattformId
//   ✅ Optimistic update: Wert sofort sichtbar
//   ✅ Rollback bei API-Fehler: Originalwert wiederhergestellt
