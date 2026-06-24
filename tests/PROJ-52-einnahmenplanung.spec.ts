import { test, expect } from '@playwright/test'

// PROJ-52: Einnahmenplanung — Kurzfristige Planung
//
// Interaktionstests (Zellbearbeitung, Aggregation, neue Woche) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests (GET/PUT/DELETE) sind durch Vitest abgedeckt (16 Tests).
// Hook-Tests (Kategorie-Filter, isNewWeek, upsertZelle, Rollback) sind durch Vitest abgedeckt (27 Tests).

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/einnahmenplanung liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/einnahmenplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/einnahmenplanung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/einnahmenplanung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Kurzfristige Planung Landing-Seite ──────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Absatzplanung-Seite weiterhin erreichbar ────────────────────

test('/dashboard/kurzfristige-planung/absatzplanung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Einstellungsseiten weiterhin erreichbar ─────────────────────

test('/dashboard/kurzfristige-planung/grundeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/marketing-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/marketing-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation im Bereich "Kurzfristige Planung" zeigt Eintrag "Einnahmenplanung"
//   ✅ Kachel "Einnahmenplanung" auf /dashboard/kurzfristige-planung im Abschnitt "Planung" vorhanden
//   ✅ Auth-Guard: Weiterleitung zu /login für unauthentifizierte Nutzer
//
// Tabellenstruktur & Spalten:
//   ✅ Spaltenüberschriften zeigen Monatsgruppenzeile + KW-Zeile (KWxx / yyyy Format)
//   ✅ Anzahl Spalten = planungshorizont_wochen aus Grundeinstellungen (Fallback: 13)
//   ✅ Spalten beginnen mit nächster Kalenderwoche (nicht aktueller KW)
//   ✅ Tabelle ist horizontal scrollbar
//   ✅ Erste Spalte (Zeilenbeschriftung) ist sticky links beim horizontalen Scrollen
//
// Zeilenhierarchie:
//   ✅ Ganz oben: Gesamt-Zeile "Einnahmen (Gesamt)" — nicht editierbar, aggregiert alle Leaf-Zeilen
//   ✅ L1-Kategorien mit Sub-Kategorien erscheinen als einklappbare Sektion mit Chevron-Icon
//   ✅ L1-Kategorien ohne Sub-Kategorien erscheinen direkt als editierbare Zeile (kein extra Header)
//   ✅ L2-Sub-Kategorien erscheinen eingerückt unter ihrer L1-Gruppe (indent=1)
//   ✅ "Produktverkäufe"-Kategorie und deren Sub-Kategorien nicht sichtbar
//   ✅ Kategorienreihenfolge entspricht sort_order aus dem KPI-Modell
//   ✅ Auf-/Zuklappen: Klick auf L1-Header klappt Sub-Kategorien ein/aus
//   ✅ BUG FIX VERIFIZIERT: Keine redundante Sub-Kategorie mit gleichem Namen wie L1-Header mehr
//
// Neue Woche Markierung:
//   ✅ Letzte Spalte des Horizonts wird rot markiert, wenn noch kein Wert eingetragen wurde
//   ✅ Tooltip "Neue Woche — Bitte Werte prüfen" auf rotem Spaltenheader
//   ✅ Rote Markierung verschwindet, sobald mindestens eine Zelle in dieser Woche befüllt wurde
//
// Leerer Zustand:
//   ✅ Wenn keine Einnahmen-Kategorien (außer Produktverkäufe) im KPI-Modell: Hinweistext + Link
//
// Manuelle Eingabe & Persistenz:
//   ✅ Klick auf editierbare Zelle öffnet Inline-Eingabefeld
//   ✅ Eingabe von Dezimalzahl ≥ 0 wird gespeichert (onBlur)
//   ✅ Zelle geleert → Wert wird als NULL gespeichert (Zelle erscheint leer mit — Symbol)
//   ✅ Betrag = 0 gültig, wird als 0,00 angezeigt
//   ✅ Leere Zellen zeigen — (Dash) statt leer
//   ✅ Aggregationszeilen zeigen Summe ihrer Leaf-Kinder; — wenn alle NULL
//   ✅ Category-Header-Zeilen zeigen Aggregatwerte (nicht leer) — BUG FIX VERIFIZIERT
//   ✅ Optimistisches Update: Wert erscheint sofort; bei API-Fehler Rollback + Toast
//
// Betragsselektion:
//   ✅ Ctrl+Klick auf Zellen wählt diese aus
//   ✅ Panel unten rechts zeigt Anzahl Felder + Summe der selektierten Werte
//   ✅ Panel verschwindet, wenn Selektion aufgehoben wird
//   ✅ Nicht-editierbare Zellen (Aggregation, Gesamt) ebenfalls selektierbar
//
// Entfernte Features (bewusst nicht implementiert):
//   ➖ Reset-Button: wurde auf Nutzerwunsch entfernt
//   ➖ Massen-Anpassung (Bulk-Edit): wurde auf Nutzerwunsch entfernt
