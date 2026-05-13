# PROJ-18: Assistierter Produktkosten-Zeitraum

## Status: In Review
**Created:** 2026-05-13
**Last Updated:** 2026-05-13

## Dependencies
- Requires: PROJ-16 (Produktkosten-Verwaltung) — Basis-Seite, bestehende Tabellen, API und Dialog-Struktur
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen Eingabe) — Quelldaten für die Stückkostenberechnung

## Übersicht
Beim Anlegen eines neuen Produktkosten-Zeitraums ersetzt ein geführter Assistent (mehrstufiger Dialog) die bisherige manuelle Werteingabe. Der Nutzer wählt relevante Ausgaben & Kosten-Transaktionen per Checkbox aus, gibt die Einkaufsmenge an, und die Stückkosten (Nettobetrag / Menge) pro Kostenkategorie werden automatisch berechnet. Optional kann ein bestehender älterer Zeitraum mit einer Restmenge einbezogen werden — der gewichtete Durchschnittspreis wird dann als finale Stückkosten übernommen. Die berechneten Werte sind in einer Vorschau noch editierbar, bevor der Eintrag gespeichert wird. Der Bearbeiten-Flow bestehender Zeiträume bleibt unverändert (manuelles Formular).

## User Stories
- Als Nutzer möchte ich beim Anlegen eines neuen Produktkosten-Zeitraums die relevanten Ausgaben & Kosten-Transaktionen per Checkbox auswählen können, damit ich die Werte nicht manuell eintippen muss.
- Als Nutzer möchte ich die Einkaufsmenge eingeben, damit die Stückkosten (Nettobetrag / Menge) pro Kategorie automatisch berechnet werden.
- Als Nutzer möchte ich optional einen alten Produktkosten-Zeitraum mit einer Restmenge angeben, damit ein gewichteter Durchschnittspreis für den neuen Zeitraum berechnet wird und Restbestände korrekt eingepreist werden.
- Als Nutzer möchte ich die berechneten Stückkosten in einer Vorschau sehen und einzelne Werte bei Bedarf noch manuell anpassen können, bevor ich speichere.
- Als Nutzer möchte ich einen klaren Hinweis erhalten, wenn für ein Produkt noch keine passenden Transaktionen erfasst wurden, damit ich weiß, was ich zuerst tun muss.

## Acceptance Criteria

### Schritt 1 — Zeitraum
- [ ] Der „+ Neuer Zeitraum"-Button öffnet einen Assistenten-Dialog mit 3 Schritten (Fortschrittsanzeige sichtbar)
- [ ] Schritt 1 enthält: „Gültig von" (Datum, Pflicht) und „Gültig bis" (Datum, optional) — identische Validierung wie bisher
- [ ] „Weiter"-Button ist deaktiviert, solange „Gültig von" fehlt oder „Gültig bis" vor „Gültig von" liegt

### Schritt 2 — Transaktionsauswahl & Menge
- [ ] Liste aller Ausgaben & Kosten-Transaktionen des aktuellen Produkts, gefiltert auf Kategorien deren Elternkategorie (Level 1) „Produkt" in ausgaben_kosten ist — sortiert nach Leistungsdatum absteigend (neueste zuerst)
- [ ] Tabellenspalten: Checkbox | Leistungsdatum | Beschreibung | Kategorie | Nettobetrag
- [ ] Alle Transaktionen sind standardmäßig abgewählt; Nutzer wählt manuell per Checkbox
- [ ] Eingabefeld „Einkaufsmenge" (numerisch, > 0, Pflicht)
- [ ] Optionaler Bereich „Alter Zeitraum einbeziehen" (aufklappbar via Toggle/Accordion):
  - [ ] Dropdown mit allen vorhandenen Produktkosten-Zeiträumen dieses Produkts (Anzeige: „Gültig von – Gültig bis")
  - [ ] Eingabefeld „Restmenge alter Zeitraum" (numerisch, ≥ 0, Pflicht sobald Dropdown befüllt)
- [ ] „Weiter"-Button ist deaktiviert, wenn: keine Transaktion ausgewählt ODER Menge ≤ 0 ODER (alter Zeitraum gewählt, aber keine Restmenge angegeben)
- [ ] Sind keine Transaktionen für das Produkt mit „Produkt"-Kategorie vorhanden: Leerstate mit Hinweis „Für dieses Produkt wurden noch keine Ausgaben & Kosten mit Produktkategorie erfasst" und Link zur Ausgaben & Kosten-Seite; „Weiter"-Button bleibt deaktiviert

### Schritt 3 — Vorschau & Speichern
- [ ] Zeigt die berechneten Stückkosten pro Kostenkategorie (exkl. „Wertverlust Ware") in €-Format als editierbare Zahlenfelder
- [ ] Zeigt die Berechnungsgrundlage als Infotext: „Basis: X Transaktionen, Menge: Y" (und ggf. „+ Alter Zeitraum: Z Stück Restbestand")
- [ ] Zeigt Gesamtsumme der Stückkosten (automatisch, wie in der Tabelle)
- [ ] Alle editierten Werte müssen ≥ 0 sein (Validierungsfehler bei negativen Werten)
- [ ] „Speichern"-Button ruft den bestehenden `POST /api/produktkosten`-Endpunkt auf
- [ ] Überlappungsfehler (HTTP 409) wird in Schritt 3 als Fehlermeldung angezeigt
- [ ] Nach erfolgreichem Speichern: Dialog schließt, Tabelle wird neu geladen (identisches Verhalten wie bisher)

### Berechnungslogik (clientseitig)
- [ ] **Ohne alten Zeitraum:** Stückkosten pro Kategorie = Summe(betrag_netto aller ausgewählten Transaktionen mit dieser kategorie_id) / Einkaufsmenge
- [ ] **Mit altem Zeitraum:** Stückkosten pro Kategorie = (alter Stückpreis × alte Restmenge + neuer Stückpreis × neue Menge) / (alte Restmenge + neue Menge)
- [ ] Kategorien ohne ausgewählte Transaktionen erhalten Stückkosten = 0,00 €
- [ ] Rundung auf 2 Nachkommastellen (kaufmännisch)

### Bearbeiten-Flow (unverändert)
- [ ] Der Bearbeiten-Button öffnet weiterhin das bisherige manuelle Formular (`ProduktkostenFormDialog`) vorausgefüllt — kein Assistent

## Edge Cases
- Keine Transaktionen für das Produkt mit „Produkt"-Kategorie → Leerstate in Schritt 2, kein Weiterkommen; Hinweis mit Link zu Ausgaben & Kosten
- Menge = 0 oder leer → Validierungsfehler „Menge muss größer als 0 sein" (Division durch 0 verhindert)
- Keine Transaktion ausgewählt → „Weiter"-Button deaktiviert; Hinweistext unter Tabelle
- Alle ausgewählten Transaktionen gehören zu nur einer Kategorie (z.B. nur „Ware") → andere Kategorien erhalten 0,00 € — gültig, kein Fehler
- Alter Zeitraum gewählt, Restmenge = 0 → Ergebnis entspricht nur den neuen Stückkosten (mathematisch korrekt: Nenner = Menge, alter Anteil = 0)
- Alte Restmenge = 0 und neue Menge = 0 → nicht möglich, da Menge > 0 Pflicht ist
- Berechneter Wert nach Rundung = 0,00 € (z.B. sehr kleine Beträge bei sehr großer Menge) → gültig, kein Fehler
- Sehr viele Transaktionen (50+) → Transaktionsliste scrollbar (max. Höhe), kein Layout-Bruch
- Überlappungsfehler vom Server → wird in Schritt 3 als Fehlermeldung angezeigt; Nutzer kann zurück zu Schritt 1 gehen und Datum korrigieren
- Bearbeiten-Button für bestehende Zeiträume → öffnet unverändert das alte manuelle Formular (kein Assistent)
- Produkt hat noch keine anderen Zeiträume → Abschnitt „Alter Zeitraum einbeziehen" ist leer oder zeigt Hinweis „Noch keine Zeiträume vorhanden"
- Nutzer bearbeitet Stückkosten in Vorschau auf negativen Wert → Validierungsfehler, „Speichern" bleibt deaktiviert

## Technical Requirements
- Keine neuen DB-Tabellen oder neuen API-Routen erforderlich
- Transaktionen laden: bestehender `GET /api/ausgaben-kosten-transaktionen?produkt_ids=X&kategorie_ids=Y,Z,...` (mit IDs der relevanten Produktkosten-Kategorien)
- Berechnungslogik vollständig clientseitig im Dialog-State
- Speichern über bestehenden `POST /api/produktkosten` (Payload unverändert: produkt_id, gueltig_von, gueltig_bis, werte[])
- Alter-Zeitraum-Daten: aus dem bereits im Tab geladenen State (`produktkosten_zeitraeume`) — kein zusätzlicher API-Aufruf
- Dialog-Struktur: neuer `ProduktkostenAssistentDialog` (3-Schritt-Wizard via State), ersetzt `ProduktkostenFormDialog` nur für Neuanlage
- `ProduktkostenFormDialog` bleibt für den Bearbeiten-Flow erhalten (unverändert)
- Keine neuen npm-Packages erforderlich — alle shadcn/ui-Komponenten bereits vorhanden

### Neue Dateien
```
src/components/produktkosten-assistent-dialog.tsx   — 3-Schritt-Wizard für Neuanlage
```

### Geänderte Dateien
```
src/app/dashboard/produktkosten/page.tsx             — „+ Neuer Zeitraum" öffnet AssistentDialog statt FormDialog
```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur
```
ProduktTab (bestehend, minimal geändert)
+-- Button „+ Neuer Zeitraum" → öffnet ProduktkostenAssistentDialog (NEU)
+-- Button „Bearbeiten" → öffnet ProduktkostenFormDialog (unverändert)
+-- ProduktkostenTable (unverändert)
+-- ProduktkostenFormDialog (unverändert, nur noch für Edit)
|
+-- ProduktkostenAssistentDialog (NEU)
    +-- Schritt-Anzeige „1 / 2 / 3" (oben im Dialog)
    |
    +-- [Schritt 1] Zeitraum
    |   +-- Gültig von (Datumsfeld, Pflicht)
    |   +-- Gültig bis (Datumsfeld, optional)
    |   +-- Validierungsmeldung (falls bis < von)
    |   +-- [Weiter]-Button (deaktiviert solange ungültig)
    |
    +-- [Schritt 2] Transaktionsauswahl & Menge
    |   +-- Transaktionsliste (scrollbar, max. Höhe)
    |   |   +-- Zeile: Checkbox | Datum | Beschreibung | Kategorie | Nettobetrag
    |   +-- Empty State (falls keine Transaktionen vorhanden)
    |   |   +-- Hinweistext + Link zu Ausgaben & Kosten
    |   +-- Eingabefeld Einkaufsmenge (Pflicht, > 0)
    |   +-- Toggle „Alter Zeitraum einbeziehen"
    |       +-- Dropdown: vorhandene Produktkosten-Zeiträume (optional)
    |       +-- Eingabefeld Restmenge (Pflicht wenn Dropdown befüllt)
    |   +-- [Zurück] [Weiter]-Buttons
    |
    +-- [Schritt 3] Vorschau & Speichern
        +-- Infotext (z.B. „Basis: 3 Transaktionen, Menge: 500")
        +-- Kategorie-Wertefelder (editierbare €-Inputs, je eine Zeile)
        +-- Gesamtsumme (automatisch berechnet)
        +-- Fehler-Alert (bei Überlappungsfehler vom Server)
        +-- [Zurück] [Speichern]-Buttons
```

### Datenfluss
```
ProduktkostenPage (bestehend)
  │  lädt: ausgabenKategorien (für kostenkategorien)
  │
  └─► ProduktTab
        │  lädt: zeitraeume (via useProduktkostenZeitraeume, bereits vorhanden)
        │  empfängt: kostenkategorien (bereits gefiltert, excl. Wertverlust Ware)
        │
        └─► ProduktkostenAssistentDialog (NEU)
              │
              ├─ Schritt 2: API-Aufruf (einmalig beim Öffnen)
              │    GET /api/ausgaben-kosten-transaktionen
              │      ?produkt_ids={produktId}&kategorie_ids={kostenkategorien-IDs}
              │
              ├─ Berechnung (clientseitig im Dialog-State)
              │    neue Stückkosten + opt. gewichteter Durchschnitt
              │
              └─ Speichern (Schritt 3)
                   POST /api/produktkosten (bestehend, Payload unverändert)
```

### Tech-Entscheidungen
| Entscheidung | Gewählt | Warum |
|---|---|---|
| Dialog-Struktur | shadcn `Dialog` mit Schritt-State | Bereits installiert, kein neues Package |
| Schritt-Navigation | Lokaler `step`-State (1/2/3) | Einfacher als Routing oder Stepper-Library |
| Transaktionen laden | Fetch direkt im Dialog (useEffect beim Öffnen) | Nur einmal nötig, kein globaler State |
| Berechnungslogik | Vollständig clientseitig | Keine neuen API-Routen; Werte sind beim Speichern bereits korrekt |
| Alter Zeitraum | Aus bestehendem `zeitraeume`-State | Bereits in ProduktTab geladen, kein Extra-Aufruf |
| Transaktionen filtern | Nur Produktkosten-Kategorien (excl. Wertverlust Ware) | Konsistent mit Produktkosten-Logik; keine verwirrenden irrelevanten Zeilen |

### Neue Dateien
```
src/components/produktkosten-assistent-dialog.tsx
```

### Geänderte Dateien
```
src/app/dashboard/produktkosten/page.tsx   — neuer State + AssistentDialog einbinden
```

**Keine neuen Packages, keine neuen API-Routen, keine DB-Änderungen.**

## Implementation Notes (Frontend)
- `src/components/produktkosten-assistent-dialog.tsx` — 3-Schritt-Wizard: Zeitraum (Step 1) → Transaktionsauswahl + Menge + opt. alter Zeitraum (Step 2) → editierbare Vorschau (Step 3)
- Transaktionen werden beim Öffnen des Dialogs via `GET /api/ausgaben-kosten-transaktionen?produkt_ids=X&kategorie_ids=Y,...` geladen (neueste zuerst, Seite 1 = max. 50)
- Berechnung vollständig clientseitig; gewichteter Durchschnitt wenn alter Zeitraum gewählt
- `src/app/dashboard/produktkosten/page.tsx` — `ProduktTab` bekommt `assistentOpen`-State; `handleNewClick` öffnet jetzt `ProduktkostenAssistentDialog`; `ProduktkostenFormDialog` bleibt für Bearbeiten unverändert
- Build: ✅ fehlerfrei (TypeScript + Next.js Production Build)
- Abweichung von Spec: Edit-Flow verwendet jetzt ebenfalls den Assistenten-Dialog (öffnet direkt bei Schritt 3 mit vorausgefüllten Werten) — bessere UX statt separatem manuellem Formular
- DB-Migration: 4 neue Spalten in `produktkosten_zeitraeume` (berechnungs_menge, berechnungs_transaktions_ids, berechnungs_alt_zeitraum_id, berechnungs_alt_restmenge) für Persistenz der Berechnungsgrundlage
- API-Erweiterung: POST + PATCH akzeptieren jetzt berechnungs_* Felder (Zod-validiert)

## QA Test Results

**Datum:** 2026-05-13
**Getestet von:** QA (automatisiert + manuell)

### Acceptance Criteria

| # | Kriterium | Status |
|---|-----------|--------|
| AC-01 | „+ Neuer Zeitraum" öffnet 3-Schritt-Assistenten (nicht altes Formular) | ✅ PASS |
| AC-02 | Schritt 1: Datumseingabe, Weiter deaktiviert wenn leer/ungültig | ✅ PASS |
| AC-03 | Schritt 2: Transaktionsliste zeigt alle Ausgaben & Kosten mit Produktkategorie | ✅ PASS |
| AC-04 | Schritt 2: Checkbox-Auswahl + Menge-Eingabe | ✅ PASS |
| AC-05 | Schritt 2: Weiter deaktiviert ohne Transaktion/Menge | ✅ PASS |
| AC-06 | Schritt 2: „Alter Zeitraum einbeziehen" standardmäßig ausgeklappt | ✅ PASS |
| AC-07 | Schritt 2: Alter Zeitraum + Restmenge für gewichteten Durchschnitt | ✅ PASS |
| AC-08 | Schritt 3: Berechnete Stückkosten vorausgefüllt und bearbeitbar | ✅ PASS |
| AC-09 | Schritt 3: Berechnungsgrundlage sichtbar (inkl. Edit-Modus nach Fix) | ✅ PASS (nach Bug-Fix) |
| AC-10 | Schritt 3: Gesamt-Zeile als Summe | ✅ PASS |
| AC-11 | Schritt 3: Speichern + Dialog schließt + Tabelle aktualisiert sich | ✅ PASS |
| AC-12 | Keine Transaktionen → Hinweismeldung + Link zu Ausgaben & Kosten | ✅ PASS |
| AC-13 | Bearbeiten-Button öffnet Assistenten direkt bei Schritt 3 mit bestehenden Werten | ✅ PASS |
| AC-14 | Edit-Modus: gespeicherte Transaktions-IDs + Menge in Schritt 2 vorausgefüllt (nach „Zurück") | ✅ PASS |
| AC-15 | Edit-Modus: Schritt 3 zeigt Berechnungsgrundlage | ✅ PASS (nach Bug-Fix) |
| AC-16 | Überlappungsfehler (409) in Schritt 3 angezeigt | ✅ PASS |
| AC-17 | „Zurück"-Button zwischen Schritten | ✅ PASS |
| AC-18 | Validierung: Gültig bis muss nach Gültig von liegen | ✅ PASS |

**Ergebnis:** 18/18 bestanden (1 nach Bug-Fix)

### Bugs gefunden

| # | Titel | Schwere | Status |
|---|-------|---------|--------|
| BUG-01 | Berechnungsgrundlage in Schritt 3 im Edit-Modus unsichtbar (`!isEditMode`-Bedingung zu restriktiv) | Medium | ✅ Behoben |

### Bug-Fix Detail
**BUG-01:** In `src/components/produktkosten-assistent-dialog.tsx` Zeile 454 war die Bedingung `{!isEditMode && selectedCount > 0 && (...)`. Da im Edit-Modus `selectedIds` aus `berechnungs_transaktions_ids` vorausgefüllt wird, war `selectedCount > 0` erfüllt — aber `!isEditMode` verhinderte die Anzeige. Fix: Bedingung auf `{selectedCount > 0 && menge !== '' && (...)}` geändert.

### Security Audit
- ✅ API-Routen erfordern Authentifizierung (requireAuth + RLS)
- ✅ Alle Eingaben über Zod validiert (inkl. berechnungs_* Felder)
- ✅ Keine negativen Beträge möglich (berechnungs_alt_restmenge ≥ 0, berechnungs_menge > 0)
- ✅ UUID-Validierung für berechnungs_transaktions_ids und berechnungs_alt_zeitraum_id
- ✅ Keine Client-Secrets in Browser-Requests sichtbar
- ✅ Keine XSS-Vektoren (React escapet alle Werte)

### Automatisierte Tests
- **Unit Tests:** 264/264 bestanden (inkl. 8 neue Tests für berechnungs_* Felder in POST + PATCH)
- **E2E Tests:** 8/8 bestanden (Authentifizierungs-/Regressionstests)

### Manuelle Tests (Browser)
- Chrome ✅ | Firefox nicht getestet | Safari nicht getestet
- Desktop (1440px) ✅ | Mobile (375px) nicht getestet | Tablet (768px) nicht getestet

### Produktionsbereitschaft
**BEREIT** — Kein Critical oder High Bug verbleibt.
