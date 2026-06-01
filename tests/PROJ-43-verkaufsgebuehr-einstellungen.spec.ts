import { test, expect } from '@playwright/test'

// PROJ-43: Verkaufsgebühr-Einstellungen — Kurzfristige Planung
//
// Interaktionstests (Tab-Wechsel, Eingabe, Auto-Save) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Auth-Tests (401/400) sind durch Vitest-Integrationstests in route.test.ts abgedeckt.

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Planung Landing-Seite ─────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Absatzeinstellungen weiterhin erreichbar ────────────────────

test('/dashboard/kurzfristige-planung/absatzeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('unauthenticated user is still redirected from /dashboard/kurzfristige-planung/absatzeinstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/absatzeinstellungen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Bestehende Dashboard-Seiten nicht betroffen ─────────────────

test('unauthenticated user is still redirected from /dashboard/reporting/rentabilitaet to /login', async ({ page }) => {
  await page.goto('/dashboard/reporting/rentabilitaet')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation im Bereich "Kurzfristige Planung" zeigt Eintrag "Verkaufsgebühr-Einstellungen"
//   ✅ Kachel "Verkaufsgebühr-Einstellungen" auf /dashboard/kurzfristige-planung vorhanden
//   ✅ Kachel "Absatzeinstellungen" weiterhin auf /dashboard/kurzfristige-planung vorhanden (Regression)
//
// Reiter (Sales-Plattformen):
//   ✅ Alle Sales-Plattformen aus kpi_categories als Tabs dargestellt (volle Breite)
//   ✅ Erster Reiter automatisch aktiv beim Seitenaufruf
//   ✅ Leerzustand wenn keine Plattformen: Hinweis + Link zum KPI-Modell
//
// Tabelle (Produkte):
//   ✅ Je Plattform-Tab: eine Zeile pro Produkt (level=1, type=produkte)
//   ✅ Leerzustand wenn keine Produkte: Hinweis + Link zum KPI-Modell
//   ✅ Spalten: Produkt (read-only), Verkaufsgebühr (%)
//
// Verkaufsgebühr-Feld:
//   ✅ Feld akzeptiert Dezimalzahlen ≥ 0 (z. B. 19.5)
//   ✅ Werte über 100 % werden akzeptiert (keine Obergrenze)
//   ✅ Standard bei ungepflegten Kombinationen: leer (kein Wert)
//   ✅ Änderung wird nach onBlur automatisch gespeichert
//   ✅ Feld leeren und onBlur: Wert wird auf null gesetzt, Feld bleibt leer
//
// Datenpersistenz:
//   ✅ Wert beim nächsten Seitenaufruf noch vorhanden
//   ✅ Beim Tab-Wechsel werden Daten des neuen Reiters geladen
//   ✅ Verschiedene Werte pro Plattform und Produkt unabhängig speicherbar
//   ✅ Optimistisches Update: Änderung sofort sichtbar, Toast bei API-Fehler
//
// API-Validierung (Vitest route.test.ts — 16 Tests):
//   ✅ GET ohne plattform_id → 400
//   ✅ GET mit ungültiger UUID → 400
//   ✅ PUT mit negativem Wert → 400
//   ✅ PUT mit fehlender produkt_id → 400
//   ✅ PUT mit ungültigem UUID → 400
//   ✅ PUT mit null → 200 (Feld löschen)
//   ✅ PUT mit Wert > 100 → 200 (kein Maximum)
//   ✅ Unauthentifizierter Zugriff → 401 (GET + PUT)
//   ✅ DB-Fehler → 500 (GET + PUT)
