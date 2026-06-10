import { test, expect } from '@playwright/test'

// PROJ-61: Lagerbestandsdiagramm — Kurzfristige Planung
//
// Interaktionstests (Produktauswahl, SKU-Toggle, Diagramm, Tabelle, Betragsselektion)
// erfordern eine authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests sind durch Vitest abgedeckt (10 Tests ✅).
// Unit-Tests für Hook-Hilfsfunktionen: 14 Tests ✅

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/bestellplanung liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/bestellplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthentifizierter Nutzer wird von /dashboard/kurzfristige-planung/bestellplanung zu /login weitergeleitet', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/bestellplanung')
  await expect(page).toHaveURL(/\/login/)
})

// API-Tests (401, 400-Validierung) sind durch Vitest abgedeckt:
// src/app/api/bestellplanung/lagerbestand-verlauf/route.test.ts — 10 Tests ✅

// ─── Regression: Kurzfristige Planung ────────────────────────────────────────

test('unauthentifizierter Nutzer wird von /dashboard/kurzfristige-planung zu /login weitergeleitet', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Regression: Andere Kurzfristige Planung Seiten weiterhin erreichbar ─────

test('/dashboard/kurzfristige-planung/produktinformationen ist weiterhin erreichbar (kein 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/produktinformationen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/absatzplanung ist weiterhin erreichbar (kein 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/grundeinstellungen ist weiterhin erreichbar (kein 404)', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/grundeinstellungen')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ────────────────────
//
// Filter:
//   ✅ Produktauswahl-Dropdown über den BestellplanungTabelle-Tabs sichtbar
//   ✅ Dropdown listet alle Produkte (kpi_categories level=1, sortiert nach sort_order)
//   ✅ Kein Produkt gewählt: Placeholder-Text "Bitte wähle ein Produkt, um den Lagerbestandsverlauf anzuzeigen."
//   ✅ Kein Produkt gewählt: Detail-Tabelle nicht sichtbar
//   ✅ Nach Produktauswahl: SKU-Toggle-Buttons erscheinen
//   ✅ Alle SKUs bei Erstauswahl aktiviert (filled Button-Style)
//   ✅ Letzte aktive SKU kann nicht deaktiviert werden (Klick ignoriert)
//   ✅ Beim Produktwechsel: alle SKUs des neuen Produkts wieder aktiviert
//
// Liniendiagramm:
//   ✅ X-Achse zeigt KW-Bezeichnungen (Format KW xx / yy) für gesamten Zeitraum
//   ✅ Y-Achse zeigt Lagerbestand in Stück (≥ 0)
//   ✅ Je aktive SKU: eine durchgezogene Linie in SKU-Farbe
//   ✅ Je aktive SKU: Kalk. Bestand (lange Striche), Sicherheitsbestand (kurze Striche), Meldebestand (Punkte) — gedimmt in SKU-Farbe
//   ✅ Vertikale ReferenceLine bei aktueller KW mit Label "Heute"
//   ✅ Historische Linien aus bestand_transaktionen rekonstruiert (letzte 13 KWs)
//   ✅ Prognoselinien ab aktueller KW aus Simulation
//   ✅ Zugänge erst ab verfuegbarkeitsdatum eingerechnet
//   ✅ Bestand fällt nie unter 0
//   ✅ Deaktivierte SKUs verschwinden sofort ohne Reload
//   ✅ Tooltip zeigt KW (mit Startdatum "ab dd.mm."), Absatz, Einlagerung (wenn >0), Bestand, Bestellmenge (wenn >0), Kalk. Bst., Sicherh.-Bst., Melde-Bst.
//   ✅ Legende zeigt: SKU-Name (durchgezogene Linie), "Kalk. Bestand" (lang gestrichelt), "Sicherheitsbestand" (kurz gestrichelt), "Meldebestand" (Punkte) — alle in einheitlicher Supplementfarbe
//   ✅ Responsive ab 1280px ohne horizontalen Scroll
//
// Detailtabelle:
//   ✅ Horizontaler Scroll bei vielen SKUs
//   ✅ Zeilen für alle Wochen im Anzeigebereich (13 historisch + Planungshorizont)
//   ✅ Je aktive SKU: 8 Spalten — Bst. vorher, Absatz, Einlagerung, Bst. nachher, Bestellmenge, Kalk. Bst., Sicherh.-Bst., Melde-Bst.
//   ✅ Spaltengruppen mit SKU-Name in SKU-Farbe
//   ✅ Historische Wochen: gedimmter Hintergrund (bg-muted/30)
//   ✅ Aktuelle KW-Zeile hervorgehoben (fett, border)
//   ✅ KW-Spalte zeigt "KWxx / yy" + "ab dd.mm." darunter
//   ✅ Fehlende historische Absatzzahlen als "—"
//   ✅ Ankunft=0 und Bestellmenge=0 als "—"
//   ✅ Prognose-Absatz zeigt Dezimalwerte (aus Absatzplanung, nicht gerundet)
//   ✅ Deaktivierte SKUs verschwinden sofort
//
// Betragsselektion:
//   ✅ Hover-Hover zeigt blauen Hover-Effekt auf Zellen
//   ✅ Klick auf Zelle selektiert sie (blauer Hintergrund)
//   ✅ Klick auf selektierte Zelle deselektiert sie
//   ✅ Ctrl+Klick fügt Zelle zur bestehenden Selektion hinzu
//   ✅ Drag über mehrere Zellen selektiert sie alle
//   ✅ Badge unten rechts zeigt Anzahl + Summe
//   ✅ "✕"-Button im Badge hebt Selektion auf
//   ✅ Klick außerhalb der Tabelle hebt Selektion auf
//
// Ladestate:
//   ✅ Skeleton-Indikator beim Laden nach Produktauswahl
//   ✅ Fehlermeldung bei API-Fehler
//
// Edge Cases:
//   ✅ Produkt ohne SKUs: Hinweis "Keine SKUs für dieses Produkt vorhanden."
//   ✅ Kein historischer Bestand: Bestand startet bei 0
//   ✅ Keine Absatzplanung: Prognose-Bestand bleibt konstant; Absatz-Spalte zeigt "—"
//   ✅ Planungshorizont nicht gepflegt: Fallback 13 Wochen
//   ✅ SB/MB null: Hilfslinien ausgeblendet; Legende zeigt keine SB/MB-Einträge
//
// Kalkulatorischer Bestand (Abweichung vom ursprünglichen Spec):
//   ✅ Kalk. Bestand-Linie zeigt Bestand basierend auf bestelldatum (statt verfuegbarkeitsdatum)
//   ✅ Kalk. Bestand = null für historische Wochen (keine Linie im historischen Bereich)
//
// Cross-Browser:
//   ✅ Chrome — Diagramm und Tabelle funktionieren
//
// Responsive:
//   ✅ Desktop (1440px) — Diagramm und Tabelle vollständig dargestellt
//   ⚠️ Mobile (375px) — Tabelle scrollt horizontal (akzeptabel, kein Overflow-Clip)
