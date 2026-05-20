# PROJ-39: Fulfillment Crowd Excel-Import für Bestandsverwaltung

## Status: Planned
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-17 (Bestandsveränderungen-Verwaltung) — importiert Daten in `bestand_transaktionen` und `bestand_sendungen`; Endbestand-Formel identisch
- Requires: PROJ-2 (KPI-Modell Verwaltung) — SKU-Zuordnung via `kpi_categories.sku_code` (type='produkte', level=2); Sales-Plattformen für Channel-Mapping
- Requires: PROJ-35 (GetMyInvoices Excel-Import) — `xlsx`-Library bereits installiert; Wizard-UI-Pattern als Referenz

---

## Übersicht

Erweiterung der Bestandsverwaltung-Seite um einen **„Fulfillment Crowd Excel importieren"**-Button. Über einen 4-schrittigen Wizard werden zwei Fulfillment-Crowd-Reports (Dispatched Orders Review + Stock Movement Report) automatisch in tagesbasierte Bestandsveränderungen pro SKU umgewandelt und in die bestehende `bestand_transaktionen`-Tabelle importiert.

---

## Bekannte Excel-Strukturen

### Dispatched Orders Review (`DispatchedOrderLinesReport`-Sheet)

Kopfzeile in Zeile 3 (vor der Kopfzeile befinden sich Report-Metadaten).

| Spaltenname | Typ | Verwendung |
|---|---|---|
| `Channel` | Text | Channel-Mapping → Sales-Plattform oder `sendungen_manuell` |
| `Dispatched Date` | Datum (DD/MM/YYYY) | Leistungsdatum |
| `Product` | Text (SKU-Code) | Schlüssel für KPI-Modell-Zuordnung |
| `Quantity` | Zahl | Sendungsmenge |

Alle anderen Spalten werden ignoriert.

### Stock Movement Report (`StockMovementReport`-Sheet)

Kopfzeile in Zeile 6 (vor der Kopfzeile befinden sich Report-Metadaten).

| Spaltenname | Typ | Verwendung |
|---|---|---|
| `Date` | Datetime | Leistungsdatum (nur Datumsteil wird verwendet) |
| `Product` | Text (SKU-Code) | Schlüssel für KPI-Modell-Zuordnung |
| `Stage` | Text | Bestimmt Buchungsart (s. Mapping-Tabelle unten) |
| `Store` | Text | Quarantäne-Filter |
| `Quantity` | Zahl | Menge |

Alle anderen Spalten werden ignoriert.

---

## Berechnungsregeln

### Channel-Mapping (Dispatched Orders Review)

| Excel-Channel | Ziel |
|---|---|
| `Manually Entered Order` (case-insensitive) | `sendungen_manuell` |
| Alle anderen Channels | Case-insensitive Teilstring-Suche gegen `kpi_categories.name` (type='sales_plattformen') — erster Treffer wird verwendet |

Beispiel: „Amazon DE" → Plattform „Amazon" (weil „amazon" in „Amazon DE" enthalten).

Unbekannte Channels (keine Übereinstimmung und nicht „Manually Entered Order") → Import wird blockiert, Fehlermeldung zeigt betroffene Channel-Namen.

### Stage-Mapping (Stock Movement Report)

| Stage (enthält / exakt) | Store-Filter | Buchungsart |
|---|---|---|
| `Dispatched` (exakt) | — | Sendungen gesamt (Validierung, wird nicht einzeln gespeichert) |
| `Transfer Complete` (exakt) | Store enthält NICHT „Quarantine" | Einlagerungen |
| `Positive Stock Adjustments` (exakt) | Store enthält NICHT „Quarantine" | Bestandsanpassungen Positiv |
| `Restocking Adjustments` (exakt) | Store enthält NICHT „Quarantine" | Bestandsanpassungen Negativ |
| `Transfer Complete` (exakt) | Store enthält „Quarantine" | Warenverluste |
| Alle anderen Stages (z.B. `Cancelled Requires Restock`) | — | Ignoriert |

### Aggregation

Alle Werte werden **pro Datum × SKU** aggregiert (Summe aller Einzel-Zeilen).

- Datum aus Dispatched Orders = `Dispatched Date` (Datumsteil)
- Datum aus Stock Movement = `Date` (Datumsteil, Uhrzeit wird verworfen)

### Anfangsbestand

- = Endbestand des jüngsten DB-Eintrags dieser SKU (aus `bestand_transaktionen`)
- Wenn kein DB-Eintrag vorhanden: Anfangsbestand = 0 (editierbar)
- Bei mehreren Importtagen in Folge: Anfangsbestand des folgenden Tages = berechneter Endbestand des Vortages (innerhalb des Imports verkettet)

### Endbestand-Formel

`Endbestand = Anfangsbestand − Σ(Sendungen je Plattform) − Sendungen Manuell + Einlagerungen + Anp.+ − Anp.− − Warenverluste`

Identisch mit der Formel in PROJ-17 (`calcEndbestand()`).

---

## User Stories

- Als Nutzer möchte ich auf der Bestandsverwaltung-Seite einen „Fulfillment Crowd Excel importieren"-Button sehen, damit ich Fulfillment-Crowd-Exporte direkt importieren kann.
- Als Nutzer möchte ich im ersten Schritt beide Excel-Dateien auswählen, damit ich sie gemeinsam verarbeiten lassen kann.
- Als Nutzer möchte ich nach dem Upload eine Fortschrittsanzeige sehen, damit ich weiß, dass die Verarbeitung läuft.
- Als Nutzer möchte ich nach der Verarbeitung pro SKU die berechneten Tageswerte in editierbaren Tabellen sehen, damit ich Fehler korrigieren kann, bevor ich importiere.
- Als Nutzer möchte ich, dass sich der Endbestand in der Review-Tabelle automatisch aktualisiert, wenn ich einen Wert ändere, damit ich die Plausibilität direkt prüfen kann.
- Als Nutzer möchte ich vor dem endgültigen Import über Duplikate informiert werden und pro Duplikat entscheiden können, ob der alte oder neue Eintrag behalten wird.
- Als Nutzer möchte ich nach dem Import eine klare Erfolgsmeldung sehen, wie viele Einträge importiert und wie viele übersprungen wurden.
- Als Nutzer möchte ich bei einem Fehler (unbekannte SKU oder unbekannter Channel) eine verständliche Fehlermeldung erhalten, die mir sagt, was das Problem ist.

---

## Acceptance Criteria

### Schritt 1: Datei-Upload

- [ ] Button „Fulfillment Crowd Excel importieren" ist auf der Bestandsverwaltung-Seite (`/dashboard/bestandsverwaltung`) sichtbar — als Sekundär-Button neben oder unterhalb des vorhandenen „+ Neue Transaktion"-Buttons
- [ ] Klick öffnet einen Dialog / Wizard mit 4 Schritten
- [ ] Schritt 1 zeigt zwei separate Upload-Bereiche: „Dispatched Orders Review" und „Stock Movement Report"
- [ ] Datei-Auswahl akzeptiert nur `.xlsx`-Dateien
- [ ] „Weiter"-Button ist deaktiviert, solange nicht beide Dateien ausgewählt sind
- [ ] Bereits ausgewählte Datei kann durch erneutes Klicken ersetzt werden

### Schritt 2: Verarbeitung & Review

- [ ] Nach Klick auf „Weiter" in Schritt 1 startet die Verarbeitung mit einem Lade-Indikator
- [ ] **Fehler-Validierung (blockierend):** Falls ein SKU-Code aus einer der Excel-Dateien nicht als `kpi_categories.sku_code` (type='produkte', level=2) gefunden wird → Fehlermeldung mit Liste der unbekannten SKU-Codes; Import abgebrochen
- [ ] **Fehler-Validierung (blockierend):** Falls ein Channel (außer „Manually Entered Order") keiner Sales-Plattform zugeordnet werden kann → Fehlermeldung mit den nicht zuordenbaren Channel-Namen; Import abgebrochen
- [ ] Nach erfolgreicher Verarbeitung werden die Ergebnisse pro SKU als aufklappbare/aufgelistete Bereiche angezeigt, alphabetisch nach SKU-Code sortiert
- [ ] Pro SKU wird der SKU-Code und Produktname als Überschrift angezeigt
- [ ] Pro SKU-Bereich: Tabelle mit einer Zeile pro berechnetem Tag, aufsteigend nach Datum sortiert
- [ ] Tabellenspalten: Datum | Anfangsbestand | [je eine Spalte pro Sales-Plattform aus dem Import] | Sendungen Manuell | Einlagerungen | Anp.+ | Anp.− | Warenverluste | Endbestand
- [ ] Alle Felder (außer Datum und Endbestand) sind editierbar (inline oder per Input-Feld)
- [ ] Endbestand-Spalte wird automatisch neu berechnet, wenn ein Feld in der Zeile geändert wird
- [ ] Endbestand-Formel: identisch zu PROJ-17
- [ ] Anfangsbestand des ersten Tages je SKU: aus letztem DB-Eintrag vorausgefüllt (0 wenn kein DB-Eintrag)
- [ ] Anfangsbestand Folgetag (im Import): = Endbestand des Vortags (automatisch verkettet, nicht editierbar; der Endbestand-Wert ändert sich entsprechend, wenn ein Wert im Vortag geändert wird)
- [ ] Negative Endbestände werden farblich hervorgehoben (z. B. `text-destructive`)
- [ ] „Weiter"-Button führt zu Schritt 3

### Schritt 3: Duplikat-Check

- [ ] System prüft für alle zu importierenden (Datum × SKU)-Kombinationen, ob bereits ein Eintrag in `bestand_transaktionen` existiert
- [ ] Falls keine Duplikate vorhanden: Schritt 3 wird übersprungen, direkt zu Schritt 4 (Bestätigung)
- [ ] Falls Duplikate vorhanden: Übersicht aller Konflikte als Tabelle
- [ ] Duplikat-Tabelle zeigt: SKU | Datum | Bestehende Werte (Endbestand) | Neue Werte (Endbestand)
- [ ] Pro Duplikat: Radio-Button „Alten Eintrag behalten" (Vorauswahl) vs. „Neuen Eintrag übernehmen"
- [ ] Globaler „Alle behalten" / „Alle übernehmen"-Toggle für Massenauswahl
- [ ] „Importieren"-Button startet den eigentlichen Import

### Schritt 4: Import & Abschluss

- [ ] Nicht-duplizierte Einträge werden als neue Transaktionen in `bestand_transaktionen` + `bestand_sendungen` inseriert
- [ ] Einträge mit Entscheidung „Neuen übernehmen" ersetzen den bestehenden DB-Eintrag (UPDATE)
- [ ] Einträge mit Entscheidung „Alten behalten" werden übersprungen
- [ ] Erfolgsmeldung nach Import: „X Einträge importiert, Y aktualisiert, Z übersprungen"
- [ ] Dialog schließt sich nach Bestätigung; Bestandsverwaltung-Seite aktualisiert die Tabelle für die aktuell gewählte SKU

---

## Edge Cases

- Beide Excel-Dateien leer oder ohne Datenzeilen → Fehlermeldung „Keine Daten in der Datei gefunden"
- Stock Movement Report hat keine Zeilen für einen Tag, aber Dispatched Orders hat Einträge für diesen Tag → Zeile wird trotzdem erstellt (Dispatched = aus Dispatched Orders, alle anderen Felder = 0)
- Umgekehrtes Szenario: Stock Movement hat Einträge, Dispatched Orders nicht → Sendungen = 0, restliche Felder aus Stock Movement
- SKU erscheint in einer Datei, aber nicht in der anderen → kein Fehler; fehlende Werte = 0
- SKU aus Excel nicht im KPI-Modell → Import komplett blockiert, alle unbekannten SKUs in Fehlermeldung aufgelistet
- Channel nicht zuordenbar → Import komplett blockiert, alle unbekannten Channels in Fehlermeldung aufgelistet
- Mehrere Plattformen mit ähnlichem Namen (z. B. „Amazon" und „Amazon FBA") → erster alphabetischer Treffer wird verwendet; im Review-Schritt für den Nutzer sichtbar
- Dispatched Date im Dispatched Orders vs. Date im Stock Movement stimmen nicht überein (z. B. kleine Zeitverzögerungen) → es werden beide nach Datumsteil (ohne Uhrzeit) aggregiert, keine Querprüfung zwischen den Summen
- Anfangsbestand-Verkettung: Wenn Nutzer im Review einen Zwischentag ändert → alle Folgetage dieser SKU aktualisieren ihren Anfangsbestand und Endbestand automatisch
- Sehr viele SKUs / Tage (z. B. 15 SKUs × 30 Tage) → Verarbeitung läuft vollständig im Browser (kein API-Aufruf für Verarbeitung), Review-Seite muss scrollbar und performant bleiben
- Alle Werte für einen Tag = 0 → Zeile wird trotzdem angezeigt und importiert (Anfangsbestand = Endbestand)
- Negative Endbestände sind zulässig (kein Fehler, aber farbliche Hervorhebung)
- Nutzer schließt Dialog mitten im Wizard → kein teilweiser Import, keine Daten werden gespeichert

---

## Technical Requirements

- Excel-Parsing: `xlsx`-Library (bereits installiert via PROJ-35)
- Verarbeitung vollständig im Browser (kein Upload auf Server)
- Kein neuer API-Endpunkt für Verarbeitung; Import nutzt bestehende `POST /api/bestand-transaktionen` und `PATCH /api/bestand-transaktionen/[id]`
- Auth required (wie alle anderen Datenpflege-Seiten)
- Keine neuen DB-Tabellen — Import schreibt in bestehende `bestand_transaktionen` und `bestand_sendungen`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
