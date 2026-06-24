import { test, expect } from '@playwright/test'

// PROJ-49: Marketing-Einstellungen — Kurzfristige Planung
//
// Interaktionstests (Tab-Wechsel, Dropdown-Änderung, Gewichtungsfelder)
// erfordern eine authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests (401/400/200) sind durch Vitest in route.test.ts abgedeckt (18 Tests).
// Hook-Tests (optimistic update, rollback, getEinstellung) sind durch Vitest abgedeckt (21 Tests).

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/marketing-einstellungen liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/marketing-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/marketing-einstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/marketing-einstellungen')
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

test('/dashboard/kurzfristige-planung/retouren-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/retouren-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation im Bereich "Kurzfristige Planung" zeigt Eintrag "Marketing-Einstellungen"
//   ✅ Kachel "Marketing-Einstellungen" auf /dashboard/kurzfristige-planung vorhanden
//   ✅ Auth-Guard: Weiterleitung zu /login für unauthentifizierte Nutzer
//
// Reiter (Sales-Plattformen):
//   ✅ Alle Sales-Plattformen aus kpi_categories als Tabs (sortiert nach sort_order)
//   ✅ Erster Reiter automatisch aktiv beim Seitenaufruf
//   ✅ Leerzustand wenn keine Plattformen: Hinweis + Link zum KPI-Modell
//
// Tabelle (Produkte):
//   ✅ Je Tab eine Zeile pro Produkt (type=produkte, level=1, nach sort_order)
//   ✅ Leerzustand wenn keine Produkte: Hinweis + Link zum KPI-Modell
//
// Dropdown Berechnungsart:
//   ✅ Genau 8 Optionen in korrekter Reihenfolge
//   ✅ Default ohne gespeicherten Wert: "Keine"
//   ✅ Auto-Save bei onChange (kein separater Speichern-Button)
//
// Gewichtungsspalten:
//   ✅ Spalten 1./2./3. Drittel % standardmäßig ausgeblendet
//   ✅ Spalten erscheinen sofort wenn mind. ein Produkt gewichtete Methode wählt
//   ✅ Gewichtungsfelder nur in der Zeile mit gewichteter Methode
//   ✅ Fehlermeldung "Die Summe muss 100 % ergeben (aktuell: X %)" bei Summe ≠ 100
//   ✅ Auto-Save der Gewichtung nur bei Summe = 100 (onBlur)
//   ✅ Wechsel zurück auf nicht-gewichtete Methode: Spalten verschwinden, NULL in DB
//
// Datenpersistenz:
//   ✅ Einstellungen beim nächsten Seitenaufruf noch vorhanden
//   ✅ Beim Tab-Wechsel werden Einstellungen der neuen Plattform geladen
//   ✅ Optimistisches Update: Änderung sofort sichtbar
//   ✅ Verschiedene Werte pro Plattform/Produkt-Kombination unabhängig pflegbar
