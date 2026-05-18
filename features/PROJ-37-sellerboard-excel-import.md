# PROJ-37: Sellerboard Excel-Import für Umsatz & Ausgaben

## Status: Planned
**Created:** 2026-05-18
**Last Updated:** 2026-05-18

## Dependencies
- Requires: PROJ-3 (Umsatz-Transaktionen Eingabe) — importiert Brutto-Umsatz, Rabatte, Rückerstattungen in `umsatz_transaktionen`
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen Eingabe) — importiert Amazon Ads, Verkaufsgebühr, Retourenkosten in `ausgaben_kosten_transaktionen`
- Requires: PROJ-2 (KPI-Modell Verwaltung) — SKU-Zuordnung zu Produkten, Kategorie-IDs für Ausgaben
- Requires: PROJ-35 (GetMyInvoices Excel-Import) — UI-Flow als Referenz; `xlsx`-Library bereits installiert; Batch-API `POST /api/ausgaben-kosten-transaktionen/batch` wird wiederverwendet
- Requires: PROJ-36 (Schnellbearbeitungsmodus) — Schritt 3 nutzt den Quick-Edit-Tabellen-Stil

## Übersicht

Erweiterung der Ausgaben & Kosten-Seite um einen **„Sellerboard Excel importieren"**-Button. Über einen 4-schrittigen Wizard werden Sellerboard-Dashboard-Exporte (nach Produkt und Tag) automatisch in Umsatz- und Ausgaben-Einträge umgewandelt.

- **Umsatz-Tabelle:** Brutto-Umsatz, Rabatte, Rückerstattungen
- **Ausgaben-Tabelle:** Amazon Ads, Verkaufsgebühren, Retourenkosten
- **Schritt 4** erkennt automatisch Konflikte mit bestehenden Transaktionen (gleiches Datum + gleiche Kategorie + gleiche Produkt-Kombi) und lässt den Nutzer entscheiden, welche Version beibehalten wird.

---

## Bekannte Excel-Struktur (Sellerboard Dashboard-Export)

Die Datei enthält eine Kopfzeile und eine Datenzeile pro Datum × SKU:

| Spaltenname | Typ | Verwendung |
|---|---|---|
| `Date` | Datum (DD.MM.YYYY) | Leistungsdatum + Fälligkeitsdatum |
| `SKU` | Text | Schlüssel für KPI-Modell-Produktzuordnung |
| `SalesOrganic` | Zahl (positiv) | → Brutto-Umsatz |
| `SalesPPC` | Zahl (positiv) | → Brutto-Umsatz |
| `SalesSponsoredProducts` | Zahl (positiv) | → Brutto-Umsatz |
| `SalesSponsoredDisplay` | Zahl (positiv) | → Brutto-Umsatz |
| `UnitsOrganic` | Zahl | → Retourenkosten-Berechnung |
| `UnitsPPC` | Zahl | → Retourenkosten-Berechnung |
| `UnitsSponsoredProducts` | Zahl | → Retourenkosten-Berechnung |
| `UnitsSponsoredDisplay` | Zahl | → Retourenkosten-Berechnung |
| `PromoValue` | Zahl (negativ) | → Rabatte (Absolutwert) |
| `SponsoredProducts` | Zahl (negativ) | → Amazon Ads |
| `SponsoredDisplay` | Zahl (negativ) | → Amazon Ads |
| `SponsoredBrands` | Zahl (negativ) | → Amazon Ads |
| `SponsoredBrandsVideo` | Zahl (negativ) | → Amazon Ads |
| `Shipping` | Zahl (negativ) | → Retourenkosten-Basis |
| `Refund Commission` | Zahl (negativ) | → Verkaufsgebühr |
| `Refund Principal` | Zahl (negativ) | → Rückerstattungen (Absolutwert) |
| `Refund RefundCommission` | Zahl (negativ) | → Verkaufsgebühr |
| `Commission` | Zahl (negativ) | → Verkaufsgebühr |

Alle anderen Spalten werden ignoriert. Spaltenreihenfolge ist irrelevant — Zuordnung erfolgt anhand des exakten Spaltennamens.

---

## Berechnungsformeln

### Schritt 1: SKU-Gruppierung

Vor allen Berechnungen werden die Zeilen pro (Datum × Produkt) aggregiert. Die Zuordnung von SKU zu Produkt erfolgt über das KPI-Modell (`useKpiCategories('produkte')`): jede SKU ist ein level-2-Eintrag mit `sku_code`; das zugehörige Produkt ist der level-1-Elterneintrag.

Summiert werden pro (Datum × Produkt): alle numerischen Spalten (Sales, Units, PromoValue, Amazon Ads-Spalten, Shipping, Commission-Spalten, Refund-Spalten).

### Schritt 2: Berechnete Transaktionen

**Umsatz-Einträge** (landen in `umsatz_transaktionen`, Feld: `betrag`):

| KPI-Typ | Formel | Kategorie (Umsatz-KPI-Modell) |
|---|---|---|
| **Brutto-Umsatz** | SalesOrganic + SalesPPC + SalesSponsoredProducts + SalesSponsoredDisplay | TBD — wird in `/architecture` definiert |
| **Rabatte** | \|PromoValue\| (Absolutwert, Abzugsposten) | TBD — Abzugsposten-Kategorie |
| **Rückerstattungen** | \|Refund Principal\| (Absolutwert) | TBD — wird in `/architecture` definiert |

**Ausgaben-Einträge** (landen in `ausgaben_kosten_transaktionen`, Nettobetrag als Basis):

| KPI-Typ | Formel (Netto) | Kategorie → Gruppe |
|---|---|---|
| **Amazon Ads** | \|SponsoredProducts + SponsoredDisplay + SponsoredBrands + SponsoredBrandsVideo\| | Marketing → Amazon Ads |
| **Verkaufsgebühr** | \|Commission + Refund RefundCommission + Refund Commission\| | Vertrieb → Verkaufsgebühren |
| **Retourenkosten** | \|Shipping\| − (UnitsOrganic + UnitsPPC + UnitsSponsoredProducts + UnitsSponsoredDisplay) × Versandkosten_pro_Einheit | Vertrieb → Retouren |

**Globaler Eintrag** (einmalig, optional, vom Nutzer in Schritt 2 eingegeben):

| KPI-Typ | Kategorie → Gruppe |
|---|---|
| **Produktunabhängige Amazongebühren** (Nettobetrag) | Sales & Marketing → Plattformgebühren |

### USt-Berechnung für alle Ausgaben-Einträge

- USt-Satz: **19 %** (fest)
- Bruttobetrag = Nettobetrag × 1,19
- USt-Betrag = Nettobetrag × 0,19

### Auto-Felder für alle Einträge

| Feld | Wert |
|---|---|
| Leistungsdatum | Datum aus Excel |
| Fälligkeitsdatum | Datum aus Excel |
| Sales Plattform | Amazon (aus KPI-Modell, sofern vorhanden) |
| Produkt | Aus KPI-Modell (level-1-Elterneintrag der SKU) |
| Relevanz | Rentabilität (fest) |
| Abschreibung | leer |
| Beschreibung | Auto-generiert: „[KPI-Typ] – [Produktname] – [Datum]" |

---

## User Stories

- Als Controlling-Mitarbeiter möchte ich auf der Ausgaben & Kosten-Seite einen „Sellerboard Excel importieren"-Button sehen, damit ich Amazon-Verkaufsdaten aus Sellerboard mit wenigen Klicks einlesen kann.
- Als Controlling-Mitarbeiter möchte ich in Schritt 2 die Versandkosten pro Einheit je Produkt manuell eingeben, damit die Retourenkosten korrekt berechnet werden.
- Als Controlling-Mitarbeiter möchte ich optional produktunabhängige Amazongebühren als Nettobetrag erfassen, damit diese als separate Ausgaben-Zeile (Plattformgebühren) importiert werden.
- Als Controlling-Mitarbeiter möchte ich in Schritt 3 alle berechneten Einträge — Umsatz und Ausgaben — in einer gemeinsamen Tabelle im Schnellbearbeitungsmodus sehen und vor dem Import korrigieren können.
- Als Controlling-Mitarbeiter möchte ich in Schritt 4 sehen, welche berechneten Einträge bereits im System existieren, und je Eintrag entscheiden können, ob die bestehende oder die neue Version (oder beide) beibehalten werden soll.
- Als Controlling-Mitarbeiter möchte ich nach dem Import eine Zusammenfassung erhalten (X Umsatz-Einträge, Y Ausgaben-Einträge importiert).

---

## Acceptance Criteria

### AC-1: Schritt 1 — Upload

- [ ] Auf der Ausgaben & Kosten-Seite gibt es neben „Excel importieren" einen neuen Button **„Sellerboard Excel importieren"**
- [ ] Klick öffnet einen Upload-Dialog (Modal) — identisch zur GMI-Upload-Maske (Drag & Drop + Datei-Dialog)
- [ ] Nur `.xlsx`-Dateien werden akzeptiert; andere Dateitypen zeigen eine Fehlermeldung
- [ ] Fehlt eine Pflicht-Spalte (z.B. `Date`, `SKU`, `SalesOrganic`): klare Fehlermeldung mit Spaltenname
- [ ] Während der Verarbeitung wird ein Lade-Spinner angezeigt
- [ ] Leere Datei (nur Kopfzeile, keine Daten): Fehlermeldung „Die Datei enthält keine Transaktionen"

### AC-2: Schritt 2 — Konfiguration

- [ ] Nach erfolgreichem Upload öffnet sich Schritt 2 als nächste Wizard-Seite
- [ ] Das System zeigt alle erkannten Produkte (aus SKU → KPI-Modell) als Liste
- [ ] Pro Produkt: Eingabefeld **„Versandkosten pro Einheit (€ Netto)"** — Pflicht, wenn für das Produkt verkaufte Units > 0 im Zeitraum vorhanden
- [ ] SKUs, die im KPI-Modell keinem Produkt zugeordnet werden können, werden mit einer Warnung angezeigt: „SKU '[SKU]' nicht im KPI-Modell gefunden — wird ignoriert"
- [ ] Gemeinsames optionales Eingabefeld: **„Produktunabhängige Amazongebühren (€ Netto)"** — erzeugt in Schritt 3 eine zusätzliche Ausgaben-Zeile (Sales & Marketing → Plattformgebühren), wenn ausgefüllt
- [ ] „Weiter"-Button deaktiviert, solange Pflicht-Versandkosten fehlen
- [ ] „Zurück"-Button ermöglicht Rückkehr zu Schritt 1 (neuer Upload)

### AC-3: Schritt 3 — Vorschau & Schnellbearbeitung

- [ ] Schritt 3 zeigt eine kombinierte Tabelle aller berechneten Einträge im Schnellbearbeitungsmodus
- [ ] Tabellenzeilen sind sortiert nach: Datum aufsteigend, dann Produkt, dann KPI-Typ
- [ ] **Spalten in der Tabelle:**
  - **Typ** (nicht editierbar): Umsatz / Ausgaben (farbliche Unterscheidung)
  - **KPI-Typ** (nicht editierbar): Brutto-Umsatz / Rabatte / Rückerstattungen / Amazon Ads / Verkaufsgebühr / Retourenkosten / Plattformgebühren
  - **Leistungsdatum** (editierbar, Date-Picker)
  - **Fälligkeitsdatum** (editierbar, Date-Picker)
  - **Kategorie → Gruppe → Untergruppe** (nicht editierbar, fest aus Berechnungsformel)
  - **Produkt** (editierbar, Dropdown)
  - **Sales Plattform** (editierbar, Dropdown)
  - **Beschreibung** (editierbar, Freitext)
  - **Nettobetrag** (editierbar; für Umsatz: = betrag)
  - **Bruttobetrag** (für Ausgaben: auto-berechnet Netto × 1,19, editierbar; für Umsatz: = betrag)
  - **USt-Betrag** (für Ausgaben: auto-berechnet Netto × 0,19; für Umsatz: nicht vorhanden)
  - **Relevanz** (nicht editierbar, immer „Rentabilität")
  - **Löschen** (Button: entfernt Zeile sofort)
- [ ] Zeilen mit berechnetem Betrag = 0 werden **standardmäßig ausgeblendet** mit Hinweis: „X Zeilen mit Betrag 0 ausgeblendet — [Einblenden]"
- [ ] Änderungen am Nettobetrag aktualisieren Brutto- und USt-Betrag live
- [ ] Retourenkosten < 0 (Outbound-Anteil übersteigt Shipping): Betrag wird auf 0 gesetzt, Zeile wird gelb markiert mit Hinweis „Versandkosten übersteigen Amazon-Shipping-Betrag — wird als 0 importiert"
- [ ] Ungültige Felder (leeres Datum, Betrag < 0) werden rot markiert
- [ ] Footer: „X Umsatz-Zeilen | Y Ausgaben-Zeilen"
- [ ] „Weiter zu Schritt 4"-Button startet Konfliktprüfung

### AC-4: Schritt 4 — Konfliktprüfung & Import

- [ ] Das System prüft für jede Zeile: Existiert in der Datenbank bereits eine Transaktion mit identischem **Datum + Kategorie + Gruppe + Untergruppe + Produkt**?
- [ ] Prüfung erfolgt **separat** für Umsatz-Tabelle und Ausgaben-Tabelle
- [ ] **Kein Konflikt:** Schritt 4 zeigt Zusammenfassung (z.B. „Bereit: 42 Zeilen, keine Konflikte") + „Jetzt importieren"-Button
- [ ] **Konflikte vorhanden:** Schritt 4 zeigt pro Konflikttransaktion eine Vergleichsansicht:
  - Bestehende Transaktion (grau hinterlegt)
  - Neue Transaktion aus Sellerboard (blau hinterlegt)
  - Auswahl-Radio: „Bestehende behalten" / „Neue übernehmen" / „Beide behalten"
- [ ] Globale Schnellauswahl: „Alle neuen übernehmen" / „Alle bestehenden behalten"
- [ ] „Jetzt importieren"-Button deaktiviert, solange Konflikte ohne Entscheidung vorhanden sind
- [ ] Nach Import:
  - Dialog schließt sich
  - Toast: „[X] Umsatz-Einträge und [Y] Ausgaben-Einträge erfolgreich importiert"
  - Ausgaben & Kosten-Tabelle wird neu geladen
- [ ] Bei Netzwerkfehler: Fehlermeldung im Dialog, Dialog bleibt offen (Nutzer kann es erneut versuchen)
- [ ] „Zurück"-Button ermöglicht Rückkehr zu Schritt 3 zur Anpassung

---

## Tabelle: Transaktionsfelder im Import

| Feld | Umsatz | Ausgaben | Quelle |
|---|---|---|---|
| `leistungsdatum` | Datum aus Excel | Datum aus Excel | Auto |
| `zahlungsdatum` | — | Datum aus Excel | Auto |
| `betrag` | Berechnet | — | Auto |
| `betrag_brutto` | — | Netto × 1,19 | Auto |
| `ust_betrag` | — | Netto × 0,19 | Auto |
| `ust_satz` | — | `'19%'` (fest) | Auto |
| `kategorie_id` | Aus KPI-Modell | Fest (s. Formel) | Auto |
| `gruppe_id` | Aus KPI-Modell | Fest (s. Formel) | Auto |
| `untergruppe_id` | Aus KPI-Modell | Fest (s. Formel) | Auto |
| `sales_plattform_id` | Amazon (KPI) | Amazon (KPI) | Auto |
| `produkt_id` | Aus KPI-Modell (SKU-Mapping) | Aus KPI-Modell (SKU-Mapping) | Auto |
| `beschreibung` | Auto-generiert | Auto-generiert | Auto |
| `relevanz` | — | `'rentabilitaet'` (fest) | Auto |
| `abschreibung` | — | `null` (fest) | Auto |

---

## Edge Cases

- **SKU nicht im KPI-Modell**: Warnung in Schritt 2, alle Zeilen dieser SKU werden ignoriert und nicht in Schritt 3 angezeigt
- **Betrag = 0 nach Summierung** (z.B. kein Umsatz für ein Produkt an einem Tag): Zeile in Schritt 3 ausgeblendet (filterbar per „Einblenden"-Link)
- **Retourenkosten < 0** (Shipping-Absolutwert kleiner als Outbound-Kosten): Betrag wird auf 0 gesetzt, gelbe Warnung in Zeile
- **Mehrere SKUs eines Produkts**: Alle numerischen Werte werden vor der Darstellung summiert (pro Datum × Produkt)
- **Doppelter Import** (gleiche Datei ein zweites Mal): Konfliktprüfung in Schritt 4 erkennt alle Duplikate
- **Produktunabhängige Amazongebühren = 0 oder leer**: Keine zusätzliche Zeile wird generiert
- **Amazon nicht als Sales Plattform im KPI-Modell**: `sales_plattform_id = null`; Nutzer kann Zeile in Schritt 3 manuell befüllen
- **Umsatz-Kategorie für einen KPI-Typ nicht im KPI-Modell gefunden**: Zeile rot markiert in Schritt 3; Import dieser Zeile blockiert bis korrigiert
- **Falscher Dateityp** (z.B. `.csv`): Fehlermeldung in Schritt 1
- **Leere Datei** (nur Kopfzeile): Fehlermeldung „Datei enthält keine Transaktionen"
- **Alle Umsatz-Felder 0 und alle Kosten-Felder 0 für ein Produkt** (z.B. Produkt nur mit Impressionen, ohne Umsatz/Kosten): Keine Zeilen werden generiert; Nutzer in Schritt 3 informiert

---

## Technical Requirements

- **Client-seitiges Excel-Parsing**: SheetJS (`xlsx`) — bereits durch PROJ-35 installiert; Spalten-Lookup anhand exakter Header-Namen
- **4-schrittiger Wizard**: Eigenes Modal (4 Steps: Upload → Konfiguration → Vorschau → Konflikt/Import); Step-State als lokaler React-State
- **SKU → Produkt-Mapping**: Client-seitig über `useKpiCategories('produkte')` — `sku_code` auf level-2-Einträgen, zugehöriges Produkt = level-1-Elterneintrag
- **Batch-Import Ausgaben**: Bestehender Endpoint `POST /api/ausgaben-kosten-transaktionen/batch` (PROJ-35) — kein neues Backend nötig
- **Batch-Import Umsatz**: Neuer Endpoint `POST /api/umsatz-transaktionen/batch` — analog zum Ausgaben-Batch-Endpoint
- **Konfliktprüfung**: Neuer Endpoint `POST /api/sellerboard-import/check-conflicts` — nimmt Array von `{datum, kategorie_id, gruppe_id, untergruppe_id, produkt_id, tabellentyp}` entgegen und gibt bestehende Transaktionen zurück
- **Keine neue Datenbank-Tabelle**: Alle Daten in `umsatz_transaktionen` und `ausgaben_kosten_transaktionen`
- **Kategorie-IDs für Ausgaben**: Werden zur Laufzeit aus dem KPI-Modell aufgelöst (Marketing → Amazon Ads; Vertrieb → Verkaufsgebühren; Vertrieb → Retouren; Sales & Marketing → Plattformgebühren) — Lookup anhand Pfad-Match (name-basiert)

---

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
/dashboard/ausgaben (bestehende Seite — minimal erweitert)
+-- Button-Zeile (bestehend + neu)
|   +-- "Neue Transaktion"-Button (unverändert)
|   +-- "Excel importieren"-Button (unverändert, GMI)
|   +-- "Sellerboard Excel importieren"-Button (NEU)
+-- SellerboardImportWizard (NEU — Multi-Step-Dialog, 4 Schritte in einer Komponente)
    +-- Schritt 1: Upload
    |   +-- Drag & Drop Zone (UI analog ExcelUploadDialog, neue Parsing-Logik)
    |   +-- Lade-Spinner / Fehlermeldung
    +-- Schritt 2: Konfiguration
    |   +-- Produktliste (erkannte Produkte aus SKU-Mapping)
    |   |   +-- Pro Produkt: Versandkosten-Eingabe (€ Netto, Pflicht)
    |   |   +-- Unbekannte SKUs: Warnhinweis
    |   +-- Produktunabhängige Amazongebühren (€ Netto, optional)
    |   +-- Navigation: Zurück | Weiter
    +-- Schritt 3: Vorschau im Schnellbearbeitungsmodus
    |   +-- Kombinierte Tabelle (Umsatz-Zeilen + Ausgaben-Zeilen)
    |   |   +-- Farbliche Typ-Unterscheidung (Umsatz / Ausgaben)
    |   |   +-- Pro Zeile: alle editierbaren Felder (Date-Picker, Dropdowns, Betrags-Inputs)
    |   |   +-- Warnzeilen (gelb, Retourenkosten < 0)
    |   |   +-- Fehlerzeilen (rot, kein Betrag / kein Datum)
    |   |   +-- Löschen-Button pro Zeile
    |   +-- Filter: "X Zeilen mit Betrag 0 ausgeblendet — Einblenden"
    |   +-- Footer: "X Umsatz-Zeilen | Y Ausgaben-Zeilen"
    |   +-- Navigation: Zurück | Weiter zu Schritt 4
    +-- Schritt 4: Konfliktprüfung & Import
        +-- Lade-Zustand (Transaktionen werden geladen und verglichen)
        +-- Kein-Konflikt-Ansicht: Zusammenfassung + "Jetzt importieren"-Button
        +-- Konflikt-Ansicht:
        |   +-- Globale Schnellauswahl ("Alle neuen" / "Alle bestehenden")
        |   +-- Pro Konflikt: Bestehende vs. Neue (farbig), Radio-Auswahl
        +-- Navigation: Zurück | Jetzt importieren
```

### Datenfluss durch den Wizard

```
Schritt 1: Excel-Datei → Browser-Parser
    ↓
SellerboardRawRows[] (eine Zeile pro SKU × Tag aus Excel)
    ↓ SKU → Produkt-Mapping (useKpiCategories('produkte'))
SellerboardAggregatedRows[] (eine Zeile pro Produkt × Tag, Werte summiert)
    ↓ wird in Wizard-State gespeichert → Schritt 2 angezeigt

Schritt 2: Nutzer gibt Versandkosten ein
    ↓ Nutzer klickt "Weiter"
Berechnung aller 6-7 KPI-Typen × Produkte × Tage
    ↓
SellerboardImportRow[] (berechnet, noch im Browser)
    ↓ wird editierbar in Schritt 3 angezeigt

Schritt 3: Nutzer prüft und korrigiert
    ↓ Nutzer klickt "Weiter zu Schritt 4"
Client lädt bestehende Transaktionen für den Importzeitraum (GET mit von/bis)
    ↓ Client-seitiger Abgleich: datum + kategorie_id + gruppe_id + untergruppe_id + produkt_id
ConflictResult[] → Schritt 4 angezeigt

Schritt 4: Nutzer entscheidet pro Konflikt
    ↓ Nutzer klickt "Jetzt importieren"
POST /api/umsatz-transaktionen/batch (Umsatz-Zeilen)
POST /api/ausgaben-kosten-transaktionen/batch (Ausgaben-Zeilen)
    ↓ Ergebnis → Toast + Dialog schließen
```

### Browser-State (SellerboardImportRow — eine Zeile in der Tabelle Schritt 3)

Jede Zeile repräsentiert einen KPI-Eintrag (kein Datenbankmodell — nur im Browser):

```
SellerboardImportRow:
- _id: string (React-Key, z.B. "umsatz-brutto-ProduktA-2026-05-11")
- rowType: "umsatz" | "ausgaben"
- kpiType: "brutto_umsatz" | "rabatte" | "rueckerstattungen" |
           "amazon_ads" | "verkaufsgebuehr" | "retourenkosten" | "plattformgebuehren"
- leistungsdatum: string (ISO YYYY-MM-DD, editierbar)
- zahlungsdatum: string (= leistungsdatum für Ausgaben)
- kategorieId: string (fest, aus KPI-Modell-Lookup)
- gruppeId: string | null (fest)
- untergruppeId: string | null (fest)
- salesPlattformId: string | null (Amazon aus KPI-Modell, editierbar)
- produktId: string | null (aus SKU-Mapping, editierbar)
- beschreibung: string (auto-generiert, editierbar)
- betragNetto: number (berechnet / editierbar)
- betragBrutto: number (= Netto × 1,19 für Ausgaben; = betragNetto für Umsatz)
- ustBetrag: number (= Netto × 0,19 für Ausgaben; 0 für Umsatz)
- istAusgeblendet: boolean (true wenn betragNetto = 0 und Nutzer nicht "Einblenden" geklickt)
- hatWarnung: boolean (z.B. Retourenkosten < 0 → auf 0 gesetzt)
- warnungText: string | null
- hatFehler: boolean (leeres Datum, kein kategorie_id etc.)
```

### Kategorie-Lookup-Logik (client-seitig)

**Ausgaben:** Kategorie-IDs werden anhand des Namens-Pfades gesucht:
- Amazon Ads → level-1 mit Name "Marketing" → level-2 mit Name "Amazon Ads"
- Verkaufsgebühr → level-1 "Vertrieb" → level-2 "Verkaufsgebühren"
- Retourenkosten → level-1 "Vertrieb" → level-2 "Retouren"
- Plattformgebühren → level-1 "Sales & Marketing" → level-2 "Plattformgebühren"

**Umsatz:** Kategorie-IDs werden anhand des KPI-Typs gesucht (Name-Match im Umsatz-KPI-Modell):
- Brutto-Umsatz → level-1 Umsatz-Kategorie mit Name "Brutto-Umsatz" (oder ähnlich)
- Rabatte → level-1 Umsatz-Kategorie mit Name "Rabatte"
- Rückerstattungen → level-1 Umsatz-Kategorie mit Name "Rückerstattungen"

Lookup-Strategie: Exact-Match zuerst, dann Case-Insensitive. Falls nicht gefunden → `kategorieId = null`, Zeile rot markiert.

### Konfliktprüfung (client-seitig)

Nach Schritt 3: Lade alle bestehenden Transaktionen für den Importzeitraum per GET:
- `GET /api/umsatz-transaktionen?von=YYYY-MM-DD&bis=YYYY-MM-DD&page=1` (alle Seiten)
- `GET /api/ausgaben-kosten-transaktionen?von=YYYY-MM-DD&bis=YYYY-MM-DD&page=1` (alle Seiten)

Client-seitiger Abgleich pro Import-Zeile: Gibt es eine bestehende Transaktion mit identischen Werten für `(datum, kategorie_id, gruppe_id, untergruppe_id, produkt_id)`? Wenn ja → Konflikt.

> Anmerkung: Bei sehr vielen bestehenden Transaktionen (hunderte) könnte das Laden mehrerer Seiten etwas Zeit benötigen — ist für diesen Use Case (tägliche Sellerboard-Reports, überschaubarer Zeitraum) kein Problem.

### Was neu gebaut wird

| Neu | Beschreibung |
|-----|-------------|
| `sellerboard-import-wizard.tsx` | Haupt-Wizard-Komponente (4-Step-Dialog); orchestriert State, Navigation und API-Calls |
| `src/lib/sellerboard-parser.ts` | Parst Sellerboard Excel (SheetJS), gruppiert SKUs pro Produkt/Tag, gibt `SellerboardAggregatedRow[]` zurück |
| `src/lib/sellerboard-calculator.ts` | Berechnet `SellerboardImportRow[]` aus aggregierten Daten + Versandkosten + KPI-Kategorien |
| `POST /api/umsatz-transaktionen/batch` | Neuer Endpunkt: Array von Umsatz-Transaktionen validieren und speichern; analog zu PROJ-35-Batch-API |

### Was wiederverwendet wird (keine Änderung nötig)

| Bestehend | Wiederverwendung |
|-----------|-----------------|
| `xlsx` (SheetJS) | Client-seitiges Parsen — bereits installiert (PROJ-35) |
| `POST /api/ausgaben-kosten-transaktionen/batch` | Import der Ausgaben-Zeilen — unverändert nutzbar |
| `GET /api/umsatz-transaktionen` + `GET /api/ausgaben-kosten-transaktionen` | Konfliktprüfung: vorhandene Transaktionen für Zeitraum laden |
| `useKpiCategories('produkte')` | SKU-Mapping (level-2 `sku_code` → level-1 Produkt) |
| `useKpiCategories('umsatz')` | Kategorie-Lookup für Umsatz-KPI-Typen |
| `useKpiCategories('ausgaben_kosten')` | Kategorie-Lookup für Ausgaben-KPI-Typen |
| `useKpiCategories('sales_plattformen')` | Amazon-Plattform-ID-Lookup |
| `ausgaben/page.tsx` | Erhält neuen Button + neuen Wizard-Dialog |
| `shadcn/ui`: Dialog, Input, Select, Badge, Alert, Button, Radio-Group, Tooltip | Alle installiert |

### Tech-Entscheidungen

**Ein einziger Wizard statt 4 separater Dialoge:**
Der State fließt von Schritt 1 bis Schritt 4 durch (Excel-Daten → Konfiguration → berechnete Zeilen → Konflikte). Alles in einer Komponente hält den State einfach und vermeidet Prop-Drilling oder Kontext. Die bestehenden PROJ-35-Dialoge sind flacher (2 Schritte) — dieser Wizard ist komplexer, aber immer noch gut in einer Komponente handhabbar.

**Eigene Parser-Datei (`sellerboard-parser.ts`) statt Erweiterung von `excel-parser.ts`:**
Der GMI-Parser (`parseGetMyInvoicesExcel`) hat eine völlig andere Spaltenstruktur und gibt ein anderes Format zurück. Eine separate Datei hält beide Parser sauber getrennt und verhindert eine gemeinsame komplexe Funktion.

**Eigene Calculator-Datei (`sellerboard-calculator.ts`):**
Die Berechnungslogik (6 KPI-Typen, USt, SKU-Aggregation, Retourenkosten-Formel) ist ausreichend komplex, um sie von der Parsing-Logik zu trennen. Das erlaubt auch isoliertes Unit-Testing der Berechnungen.

**Client-seitige Konfliktprüfung (statt neuem API-Endpunkt):**
Für den täglichen Import-Zeitraum (typisch 7–30 Tage) ist die Anzahl bestehender Transaktionen überschaubar. Ein extra API-Endpunkt wäre Overhead; das Laden mit dem bestehenden GET-Endpoint + client-seitiger Abgleich ist ausreichend schnell und spart Backend-Aufwand.

**Kein neues Datenbankschema:**
Alle Import-Daten landen in den bestehenden Tabellen `umsatz_transaktionen` und `ausgaben_kosten_transaktionen`. Keine neue Tabelle, keine Migrationskomplexität.

### Neue Backend-Abhängigkeiten

| Endpunkt | Typ | Beschreibung |
|----------|-----|-------------|
| `POST /api/umsatz-transaktionen/batch` | Neu | Array von Umsatz-Transaktionen; max. 500 Items; HTTP 201 / 207 / 400 / 500 |

### Keine neuen npm-Pakete

`xlsx` (SheetJS) ist bereits durch PROJ-35 installiert. Alle anderen benötigten Bibliotheken (shadcn/ui-Komponenten, React, Zod) sind bereits im Projekt.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
