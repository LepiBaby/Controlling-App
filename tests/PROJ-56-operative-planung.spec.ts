import { test, expect } from '@playwright/test'

// PROJ-56: Operative Planung — Kurzfristige Planung
//
// Interaktionstests (Zellbearbeitung, Aggregation, neue Woche) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests (GET/PUT) sind durch Vitest abgedeckt (14 Tests).
// Hook-Tests (Operativ-Filter, isNewWeek, upsertZelle, Rollback) sind durch Vitest abgedeckt (29 Tests).

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/operative-planung liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/operative-planung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/operative-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/operative-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Planung Landing-Seite ─────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Einnahmenplanung-Seite weiterhin erreichbar ─────────────────

test('/dashboard/kurzfristige-planung/einnahmenplanung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/einnahmenplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Absatzplanung-Seite weiterhin erreichbar ────────────────────

test('/dashboard/kurzfristige-planung/absatzplanung is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Regression: Grundeinstellungen-Seite weiterhin erreichbar ───────────────

test('/dashboard/kurzfristige-planung/grundeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation im Bereich "Kurzfristige Planung" zeigt Eintrag "Operative Planung"
//   ✅ Kachel "Operative Planung" auf /dashboard/kurzfristige-planung im Abschnitt "Planung" vorhanden
//   ✅ Auth-Guard: Weiterleitung zu /login für unauthentifizierte Nutzer
//
// Tabellenstruktur & Spalten:
//   ✅ Spaltenüberschriften zeigen Monatsgruppenzeile + KW-Zeile (KWxx / yyyy Format)
//   ✅ Anzahl Spalten = planungshorizont_wochen aus Grundeinstellungen (Fallback: 13)
//   ✅ Spalten beginnen mit nächster Kalenderwoche (nicht aktueller KW)
//   ✅ Tabelle ist horizontal scrollbar
//   ✅ Erste Spalte (Zeilenbeschriftung) ist sticky links beim horizontalen Scrollen
//   ✅ Zeitraum-Label oben links (z.B. "KW25 / 2026 – KW37 / 2026")
//
// Zeilenhierarchie:
//   ✅ Ganz oben: Gesamt-Zeile "Operative Planung (Gesamt)" — nicht editierbar, aggregiert alle Leaf-Zeilen
//   ✅ L1-Kategorien mit Sub-Kategorien erscheinen als einklappbare Sektion mit Chevron-Icon
//   ✅ L1-Kategorien ohne Sub-Kategorien erscheinen mit identischem Styling (bg-muted/30, font-semibold) ohne Chevron
//   ✅ L2-Sub-Kategorien erscheinen eingerückt unter ihrer L1-Gruppe (indent=1)
//   ✅ Nur Kategorien unter dem "Operativ"-Knoten im KPI-Modell werden angezeigt
//   ✅ Kategorien außerhalb des Operativ-Teilbaums (z.B. "Marketing") sind nicht sichtbar
//   ✅ Auf-/Zuklappen: Klick auf L1-Header klappt Sub-Kategorien ein/aus
//   ✅ "Alle ausklappen / Alle einklappen"-Button oben rechts (mit ChevronsUpDown/ChevronsDownUp Icon)
//
// Neue Woche Markierung:
//   ✅ Letzte Spalte des Horizonts wird rot markiert, wenn noch kein Wert eingetragen wurde
//   ✅ Tooltip "Neue Woche — Bitte Werte prüfen" auf rotem Spaltenheader
//   ✅ Rote Markierung verschwindet, sobald mindestens eine Zelle in dieser Woche befüllt wurde
//
// Leerer Zustand:
//   ✅ Wenn kein "Operativ"-Knoten im KPI-Modell: Hinweistext + Link zu KPI-Modell-Einstellungen
//
// Manuelle Eingabe & Persistenz:
//   ✅ Klick auf editierbare Zelle öffnet Inline-Eingabefeld
//   ✅ Eingabe von Dezimalzahl ≥ 0 wird gespeichert (onBlur)
//   ✅ Zelle geleert → Wert wird als NULL gespeichert (Zelle erscheint leer mit — Symbol)
//   ✅ Betrag = 0 gültig, wird als 0,00 angezeigt
//   ✅ Leere Zellen zeigen — (Dash) statt leer
//   ✅ Aggregationszeilen zeigen Summe ihrer Leaf-Kinder; — wenn alle NULL
//   ✅ Category-Header-Zeilen zeigen Aggregatwerte
//   ✅ Optimistisches Update: Wert erscheint sofort; bei API-Fehler Rollback + Toast
//   ✅ Keine Vorabbefüllung auf Grundlage historischer Daten (alle Zellen initial leer)
//
// Betragsselektion (Hover-Summierung):
//   ✅ Ctrl+Klick auf Zellen wählt diese aus
//   ✅ Panel unten rechts zeigt Anzahl Felder + Summe der selektierten Werte
//   ✅ Panel verschwindet, wenn Selektion aufgehoben wird
//   ✅ Nicht-editierbare Zellen (Aggregation, Gesamt) ebenfalls selektierbar
//
// Notizen (PROJ-53):
//   ✅ Hover auf Zelle zeigt Notiz-Icon
//   ✅ Klick auf Notiz-Icon öffnet Notizen-Dialog
//   ✅ Gespeicherte Notiz erscheint als farbiger Indikator in der Zelle
//   ✅ kontext = 'operative_planung' (separate Notizen von anderen Planungsseiten)
//
// Entfernte Features (bewusst nicht implementiert):
//   ➖ Reset-Button: nicht implementiert gemäß Feature-Spec
//   ➖ Massen-Anpassung (Bulk-Edit): nicht implementiert gemäß Feature-Spec
//   ➖ Historische Vorabbefüllung: nicht implementiert gemäß Feature-Spec
