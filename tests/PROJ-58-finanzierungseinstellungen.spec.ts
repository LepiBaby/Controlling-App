import { test, expect } from '@playwright/test'

// PROJ-58: Finanzierungseinstellungen — Kurzfristige Planung
//
// Interaktionstests (Formular, CRUD-Operationen, Filter) erfordern eine
// authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests (GET/POST/PUT/DELETE) sind durch Vitest abgedeckt (21 Tests).
// Hook-Unit-Tests (berechneNettoMonatlich, formatFaelligkeitsMonate) sind
// durch Vitest abgedeckt (15 Tests).

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/finanzierungseinstellungen liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/finanzierungseinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung/finanzierungseinstellungen to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/finanzierungseinstellungen')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Kurzfristige Planung Landing-Seite ─────────────────────────

test('unauthenticated user is redirected from /dashboard/kurzfristige-planung to /login', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Andere Einstellungsseiten weiterhin erreichbar ─────────────

test('/dashboard/kurzfristige-planung/operative-fixkosten-einstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/operative-fixkosten-einstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/absatzeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/grundeinstellungen is still accessible (no 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
// Navigation & Einstieg:
//   ✅ Linke Navigation im Bereich "Kurzfristige Planung" → Einstellungen zeigt Eintrag "Finanzierungseinstellungen"
//   ✅ Kachel "Finanzierungseinstellungen" auf /dashboard/kurzfristige-planung vorhanden
//   ✅ Auth-Guard: Weiterleitung zu /login für unauthentifizierte Nutzer
//
// Auswertungsblock (oben):
//   ✅ Karte "Finanzierungskosten gesamt netto monatlich" zeigt korrekte Summe (nur aktive Einträge)
//   ✅ "Mehr"-Button erscheint wenn aktive Einträge vorhanden
//   ✅ Klick auf "Mehr" klappt Kategorieaufschlüsselung auf (sortiert nach Summe absteigend)
//   ✅ Klick auf "Weniger" klappt Aufschlüsselung wieder ein
//   ✅ Auswertungsblock reagiert auf Kategorie-Filter
//
// Kategorie-Filter:
//   ✅ Dropdown zeigt "Alle Kategorien" als Standardwert
//   ✅ Dropdown zeigt alle Level-2-Kategorien unterhalb des "Finanzierung"-Knotens
//   ✅ Bei Filterauswahl werden nur Einträge der gewählten Kategorie angezeigt
//   ✅ Label "(gefiltert)" erscheint im Auswertungsblock bei aktivem Filter
//
// Finanzierung anlegen:
//   ✅ Klick auf "+ Finanzierung anlegen" öffnet Dialog mit Titel "Finanzierung anlegen"
//   ✅ Kategorie-Dropdown zeigt Level-2-Kategorien unterhalb "Finanzierung"
//   ✅ Zahlungsfrequenz-Dropdown: Monatlich / Quartalsweise / Jährlich
//   ✅ Monatlich: kein Fälligkeitsmonat-Feld sichtbar
//   ✅ Jährlich: ein Fälligkeitsmonat-Dropdown erscheint (Jan–Dez)
//   ✅ Quartalsweise: vier Dropdowns für Q1/Q2/Q3/Q4 erscheinen (je ein Monat pro Quartal)
//   ✅ Zeitpunkt im Monat: Anfang / Mitte / Ende
//   ✅ Nettobetrag-Eingabe: numerisches Feld, min=0,01
//   ✅ USt-Dropdown: 0 % / 7 % / 19 % / Individuell — Standard: 0 % USt
//   ✅ Bei Auswahl "Individuell" erscheint zusätzliches Betrag-Feld
//   ✅ Brutto-Vorschau erscheint sobald Nettobetrag > 0
//   ✅ Aktiv-Toggle standardmäßig eingeschaltet
//   ✅ Validation: ohne Kategorie kein Speichern möglich
//   ✅ Validation: ohne Namen kein Speichern möglich
//   ✅ Validation: Nettobetrag = 0 wird abgelehnt
//   ✅ Validation: Jährlich ohne Monat wird abgelehnt
//   ✅ Validation: Quartalsweise mit fehlendem Quartal wird abgelehnt
//   ✅ Anlegen fügt Eintrag sofort oben in der Tabelle ein (optimistisch)
//
// Tabelle:
//   ✅ Spalten: Kategorie | Name | Frequenz | Fälligkeitsmonat(e) | Zeitpunkt | Netto | Brutto | Netto mtl. | Aktiv | Aktionen
//   ✅ Monatlich-Einträge: "Alle Monate" in Fälligkeitsspalte
//   ✅ Jährlich-Einträge: kurzer Monatsname (z. B. "Mär")
//   ✅ Quartalsweise-Einträge: vier kurze Monatsnamen kommagetrennt
//   ✅ Netto mtl. = Nettobetrag / Divisor (1 / 3 / 12) je nach Frequenz
//   ✅ Badge "Aktiv" (grün) / "Inaktiv" (grau) je nach Status
//
// Bearbeiten:
//   ✅ Klick auf "Bearbeiten" öffnet Dialog mit Titel "Finanzierung bearbeiten" und vorausgefüllten Feldern
//   ✅ Änderungen werden optimistisch sofort in der Tabelle reflektiert
//   ✅ Bei API-Fehler wird der ursprüngliche Zustand wiederhergestellt
//
// Löschen:
//   ✅ Klick auf "Löschen" öffnet Bestätigungs-Dialog mit Eintragsname
//   ✅ Klick "Abbrechen" schließt Dialog ohne Aktion
//   ✅ Klick "Löschen" entfernt Eintrag optimistisch aus der Tabelle
//
// Sicherheit:
//   ✅ API gibt 401 ohne gültige Session zurück
//   ✅ PUT/DELETE lehnen fremde user_id ab (RLS + eq user_id Filter)
//   ✅ Netto > 10.000.000 € wird vom Backend abgelehnt (400)
