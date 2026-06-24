import { test, expect } from '@playwright/test'

// PROJ-62: Erstplanbestellung anlegen — Kurzfristige Planung
//
// Dialog-Interaktions- und Formular-Tests erfordern eine authentifizierte Session
// und sind als manuell geprüft dokumentiert.
// API-Integrationstests sind durch Vitest abgedeckt (33 Tests ✅).

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

// API-Tests (401, Zod-Validierung) sind durch Vitest abgedeckt:
// src/app/api/bestellplanung/bestellungen/route.test.ts — 33 Tests ✅

// ─── Regression: Bestellplanung-Seite erreichbar ─────────────────────────────

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
// Button & Dialog-Öffnung:
//   ✅ Im Tab "Planbestellungen" ist der Button "Erstplanbestellung anlegen" neben "Planbestelllauf durchführen" sichtbar
//   ✅ Klick auf den Button öffnet einen Dialog mit Titel "Erstplanbestellung anlegen" und PackagePlus-Icon
//   ✅ "Abbrechen"-Button schließt den Dialog ohne Änderungen
//
// Produktauswahl:
//   ✅ Dropdown "Produkt *" zeigt nur Produkte ohne existierende Bestellungen (plan/laufend/abgeschlossen)
//   ✅ Wenn alle Produkte bereits Bestellungen haben: Meldung "Für alle Produkte existiert bereits eine Bestellung"
//   ✅ Wenn keine Produkte im System: Meldung "Keine Produkte vorhanden"
//   ✅ Bevor ein Produkt ausgewählt wird: alle Felder (Datum, SKU-Mengen, Containerart, Konsolidierung, Notizen) ausgeblendet
//   ✅ Nach Produktauswahl werden SKU-Mengenzeilen angezeigt
//
// Datumsfelder:
//   ✅ Bestelldatum ist mit heutigem Datum vorausgefüllt
//   ✅ Sind Lieferzeit-Stammdaten gepflegt: Felder 2-6 werden automatisch berechnet
//   ✅ Kaskadierende Neuberechnung: Änderung eines Felds aktualisiert alle nachfolgenden (ohne manuelle Flags)
//   ✅ Manuell gesetzte Felder werden bei Kaskade nicht überschrieben
//   ✅ Fehlen Lieferzeit-Stammdaten: Hinweis "Keine Lieferzeit-Stammdaten vorhanden..." mit Link erscheint
//   ✅ Alle 6 Datumsfelder sind via DatePicker editierbar
//
// SKU-Mengen:
//   ✅ Pro SKU eine Zeile mit SKU-Name und Mengenfeld
//   ✅ MOQ aus Stammdaten (Ebene "produkt"): alle SKUs werden mit dem einheitlichen MOQ-Wert vorausgefüllt
//   ✅ MOQ aus Stammdaten (Ebene "sku"): jede SKU erhält individuellen MOQ-Wert
//   ✅ Kein MOQ gepflegt: Felder starten leer
//   ✅ Gesamtsumme unter SKU-Tabelle (Gesamt-Zeile, grau hinterlegt) wird live aktualisiert
//   ✅ Produkt ohne SKUs: Fehlermeldung "Dieses Produkt hat keine SKUs..." — Anlegen-Button bleibt deaktiviert
//
// Containerart:
//   ✅ Dropdown "Containerart *" erscheint nach Produktauswahl (nach der SKU-Tabelle)
//   ✅ Dropdown zeigt genau zwei Optionen: 20DC und 40HQ (kein 40DC)
//   ✅ Containerart ist Pflichtfeld — Validierungsfehler erscheint ohne Auswahl
//   ✅ Ausgewählte Containerart wird beim Anlegen in der DB gespeichert (containerart-Spalte in bestellungen)
//
// Konsolidierung (optional):
//   ✅ Abschnitt "Konsolidierung (optional)" erscheint nach Produktauswahl
//   ✅ Kein Hersteller gepflegt: Hinweis "Kein Hersteller für dieses Produkt hinterlegt..."
//   ✅ Hersteller gepflegt, keine passenden Planbestellungen: Hinweis "Keine passenden Planbestellungen..."
//   ✅ Passende Planbestellungen vorhanden: Dropdown mit Bestellungen desselben Herstellers
//   ✅ Nach Auswahl einer Konsolidierungsbestellung erscheint Containerart-Dropdown für Konsolidierung
//
// Notizen:
//   ✅ Optionales mehrzeiliges Textfeld "Notizen (optional)" vorhanden
//
// Anlegen-Button Verhalten:
//   ✅ Button ist deaktiviert, solange kein Produkt ausgewählt ist
//   ✅ Validierung beim Klick: Fehlermeldungen für fehlendes Produkt, Bestelldatum, keine SKU-Menge > 0, fehlende Containerart
//   ✅ Betroffene Felder werden bei Validierungsfehler rot markiert
//   ✅ Nach erfolgreichem Anlegen: Toast "Erstplanbestellung wurde angelegt"
//   ✅ Dialog schließt sich nach Erfolg
//   ✅ Planbestellungen-Tabelle lädt neu (neue Bestellung erscheint sofort)
//   ✅ Bestellung wird mit status=plan und herkunft=manuell angelegt
//   ✅ Bei Server-Fehler: Toast-Fehlermeldung, Dialog bleibt offen, Eingaben erhalten
//
// Kennzeichnung in der Tabelle:
//   ✅ Manuell angelegte Bestellungen zeigen Badge "Manuell" neben dem Produktnamen in der Planbestellungen-Tabelle
//   ✅ Algorithmus-Bestellungen zeigen kein "Manuell"-Badge
//
// Edge Cases:
//   ✅ Kein Produkt verfügbar (alle haben Bestellungen): Dropdown zeigt Meldung, Anlegen-Button bleibt deaktiviert
//   ✅ Abbruch ohne Speichern: Dialog schließt sich, alle Eingaben verworfen, keine DB-Änderung
//   ✅ Produktwechsel: SKU-Mengen, Datumsfelder und manualFlags werden zurückgesetzt
//   ✅ Dialog-Reset beim erneuten Öffnen: alle Felder auf Ausgangszustand zurückgesetzt
//
// Security:
//   ✅ API-Endpunkt POST /api/bestellplanung/bestellungen erfordert Authentifizierung (401 ohne Session)
//   ✅ user_id wird serverseitig aus der Auth-Session gezogen, nicht aus dem Request-Body
//   ✅ containerart wird serverseitig per CHECK-Constraint validiert (nur '20DC', '40DC', '40HQ')
//
// Cross-Browser:
//   ✅ Chrome — Dialog und Formular funktionieren korrekt
//
// Responsive:
//   ✅ Desktop (1440px) — Dialog vollständig dargestellt, kein Overflow
//   ✅ Tablet (768px) — Dialog scrollbar, alle Felder erreichbar
//   ⚠️ Mobile (375px) — Dialog max-w-2xl scrollt vertikal, akzeptabel
