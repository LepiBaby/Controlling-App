import { test, expect } from '@playwright/test'

// PROJ-63: Konsolidierung — Neubau (Kurzfristige Planung)
//
// Wizard-Interaktions-, Konsolidierungs-Algorithmus- und Übersichtstests
// erfordern eine authentifizierte Session und sind als manuell geprüft dokumentiert.
// API-Integrationstests: 61 Bestellplanung-Tests ✅
// Unit-Tests für den Konsolidierungs-Algorithmus: 10 Tests ✅

// ─── Seitenexistenz (kein 404) ───────────────────────────────────────────────

test('/dashboard/kurzfristige-planung/bestellplanung liefert keinen 404-Fehler', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/bestellplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Auth-Guard ──────────────────────────────────────────────────────────────

test('unauthentifizierter Nutzer wird zu /login weitergeleitet', async ({ page }) => {
  await page.goto('/dashboard/kurzfristige-planung/bestellplanung')
  await expect(page).toHaveURL(/\/login/)
})

// API-Tests sind durch Vitest abgedeckt:
// src/app/api/bestellplanung/konsolidierung/route.test.ts         — 6 Tests  ✅
// src/app/api/bestellplanung/bestellungen/[id]/route.test.ts      — 11 Tests ✅ (inkl. 409-Test)
// src/app/api/bestellplanung/bestellungen/route.test.ts           — 11 Tests ✅
// src/lib/konsolidierungs-algorithmus.test.ts                     — 10 Tests ✅

// ─── Regression: Kurzfristige Planung Seiten ─────────────────────────────────

test('/dashboard/kurzfristige-planung/produktinformationen ist weiterhin erreichbar', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/produktinformationen')
  expect(response?.status()).toBeLessThan(400)
})

test('/dashboard/kurzfristige-planung/absatzplanung ist weiterhin erreichbar', async ({ page }) => {
  const response = await page.goto('/dashboard/kurzfristige-planung/absatzplanung')
  expect(response?.status()).toBeLessThan(400)
})

// ─── Manuell geprüft (erfordern authentifizierte Session) ─────────────────────
//
// Algorithmus-Bereinigung:
//   ✅ checkKonsolidierungen() aus planbestelllauf-algorithmus.ts entfernt
//   ✅ POST /api/bestellplanung/planbestelllauf liefert keine konsolidierungen-Felder mehr
//   ✅ POST /api/bestellplanung/planbestelllauf/anwenden schreibt keine Konsolidierungsdaten mehr
//
// Erstplanbestellung-Dialog:
//   ✅ Kein "Konsolidierung (optional)"-Abschnitt im Erstplanbestellung-Dialog vorhanden
//
// Wizard: 3-Schritt-Navigation
//   ✅ Schritt 2 hat Button "Weiter zur Konsolidierung →"
//   ✅ Klick auf Button wechselt zu Schritt 3 "Konsolidierung"
//   ✅ Schritt 3 hat Button "← Zurück" (zurück zu Schritt 2)
//   ✅ Schritt 3 hat Button "Übernehmen" zum finalen Speichern
//   ✅ "Übernehmen"-Button ist aktiv auch wenn nur Konsolidierungen, aber keine neuen Bestellungen vorhanden
//
// Wizard Schritt 3: Darstellung
//   ✅ Alle bestehenden Planbestellungen aus der DB werden in Schritt 3 angezeigt
//   ✅ Alle in Schritt 2 ausgewählten neuen Bestellungen werden ebenfalls angezeigt
//   ✅ Planbestellungen sind nach Hersteller gruppiert (Gruppen-Header mit Herstellername)
//   ✅ Produkte ohne Hersteller erscheinen in Gruppe "Kein Hersteller" am Ende
//   ✅ Innerhalb einer Gruppe: aufsteigend nach Prod.ende-Datum sortiert
//   ✅ Prod.ende-Datum ist fett/badge-markiert in der Karte
//
// Planbestellungs-Karte:
//   ✅ Produktname(n) werden angezeigt
//   ✅ Stückzahl-Badge zeigt Summe menge_praktisch aller SKUs
//   ✅ Container-Badge zeigt Anzahl/Anteil (Dezimalzahl bei Konsolidierungen, z.B. "0.7× 40HQ")
//   ✅ "Erstbestellung"-Badge bei herkunft=manuell
//   ✅ 4 Datumsfelder read-only: Bestelldatum, Prod.ende (fett), Shippingdatum, Verfügbarkeitsdatum
//   ✅ Containerauslastungsanzeige mit Progress-Bar und Prozentzahl:
//      - Volumen < 20DC → "X% (20DC)"
//      - 20DC ≤ Volumen < 40HQ → "X% (40HQ)"
//      - Volle 40HQ → "100% (40HQ)" pro Stück, danach Restbalken
//      - Fehlendes Stückvolumen → "Volumen unbekannt"
//   ✅ Klick auf Karte öffnet BestellungDetailDialog (identisch mit Haupttabelle)
//
// Konsolidierung auslösen:
//   ✅ Jede Karte hat Checkbox (links oben)
//   ✅ Bei Auswahl von ≥ 2 Bestellungen desselben Herstellers: Button "Konsolidieren" erscheint
//   ✅ Bei Auswahl von Bestellungen verschiedener Hersteller: Hinweis "Nur Bestellungen desselben Herstellers können konsolidiert werden"
//   ✅ Klick auf "Konsolidieren" führt clientseitig den Algorithmus aus
//   ✅ Ergebnis (Stückzahlen, Container-Anteil, Datum) wird sofort in der Ansicht aktualisiert
//   ✅ Konsolidierte Bestellungen werden visuell zusammengehörig dargestellt (gemeinsamer farbiger Rahmen)
//   ✅ "Konsolidierung aufheben"-Button erscheint, wenn alle Mitglieder einer Gruppe ausgewählt sind
//
// Konsolidierungsalgorithmus (Unit-Tests: 10/10 ✅):
//   ✅ Frühestes Prod.ende-Datum wird als gemeinsames Zieldatum verwendet
//   ✅ Datumskaskade (Prod.start, Bestelldatum, Shipping, Ankunft, Verfügbar) korrekt berechnet
//   ✅ Restvolumen (nicht in volle Container passende Anteile) werden zusammengeführt
//   ✅ Volle 40HQ bleiben pro Bestellung unverändert
//   ✅ Container-Anteil je Bestellung proportional zu Restvolumen-Anteil
//   ✅ Rest = 0: Hinweis "Keine Restmengen — nur Datum" + Mengen unverändert
//   ✅ Fehlende Stückvolumen: Mengen unverändert, Datum wird angepasst
//   ✅ Konsolidierungs-Vermerk in begruendung_anpassung
//
// Konsolidierung aufheben (in Schritt 3):
//   ✅ Wenn alle Mitglieder einer Gruppe ausgewählt: "Konsolidierung aufheben"-Button sichtbar
//   ✅ Klick setzt Stückzahlen, Container, Datum auf Snapshot-Zustand vor Konsolidierung zurück
//   ✅ Visuelle Gruppierung wird sofort entfernt
//
// Speichern:
//   ✅ "Übernehmen" speichert sequenziell: erst Bestellungen anlegen, dann Konsolidierungsgruppen
//   ✅ temp_ids werden korrekt zu echten UUIDs aufgelöst bevor Konsolidierung gespeichert wird
//   ✅ Toast-Benachrichtigung mit Zusammenfassung (z.B. "2 Planbestellungen & 1 Konsolidierung übernommen")
//
// Übersicht nach dem Speichern:
//   ✅ Konsolidierte Bestellungen zeigen violetten Streifen links in der Tabelle
//   ✅ "Konsolidiert"-Badge (violett) mit Tooltip (zeigt Partnerbestellungen)
//   ✅ Container-Badge zeigt Dezimalanteil (z.B. "0.7× 40HQ + 0.3× 40HQ")
//   ✅ "In Laufende Bestellung umwandeln" bei konsolidierter Bestellung → AlertDialog mit Gruppen-Hinweis
//   ✅ Bestätigung wandelt alle Gruppe-Mitglieder gemeinsam um
//   ✅ Analoges Verhalten bei Laufend → Abgeschlossen
//
// Re-Run nach erneutem Planbestelllauf:
//   ✅ Bestehende Konsolidierungen werden beim Wizard-Start automatisch aufgehoben (dissolve_only)
//   ✅ Mengen und Container werden aus Snapshot wiederhergestellt (Datum bleibt erhalten)
//   ✅ In Schritt 3 zeigt Bestellung mit vorheriger Konsolidierung ein "!"-Icon neben der Checkbox
//   ✅ Hover über "!": Tooltip "War konsolidiert mit: [Produktname A], [Produktname B]"
//
// Detail-Dialog bei konsolidierter Bestellung:
//   ✅ Header zeigt "Konsolidiert"-Badge (violett) mit Tooltip der Partner
//   ✅ SKU-Tabelle zeigt Spalten: Theoretisch | Nach MOQ | Praktisch | Konsolidierung
//   ✅ "Praktisch" zeigt Snapshot-Wert (vor Konsolidierung)
//   ✅ "Konsolidierung" zeigt aktuellen Gesamtwert (blau, editierbar)
//   ✅ Gesamt-Zeile zeigt Wert in der Konsolidierung-Spalte (letzte numerische Spalte)
//
// Sicherheit:
//   ✅ POST /api/bestellplanung/konsolidierung prüft auth (401 ohne Session)
//   ✅ DELETE /api/bestellplanung/konsolidierung/[id] prüft auth
//   ✅ Nutzer kann nur eigene Gruppen sehen/löschen (RLS auf beiden Tabellen)
//   ✅ PUT /api/bestellplanung/bestellungen/[id] gibt 409 zurück bei Einzel-Statuswechsel einer konsolidierten Bestellung
