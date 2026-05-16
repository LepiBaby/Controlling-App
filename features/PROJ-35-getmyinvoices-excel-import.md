# PROJ-35: GetMyInvoices Excel-Import für Ausgaben & Kosten

## Status: Planned
**Created:** 2026-05-16
**Last Updated:** 2026-05-16

## Dependencies
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen Eingabe) — Import erstellt reguläre Transaktionen in dieser Tabelle
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Pflichtfelder im Review-Dialog hängen vom KPI-Modell ab
- Requires: PROJ-14 (Relevanz-Pflichtfeld) — Relevanz ist im Import ebenfalls Pflichtfeld

## Übersicht
Erweiterung der Ausgaben & Kosten-Seite um einen Excel-Import-Button. Der Nutzer kann eine aus GetMyInvoices exportierte `.xlsx`-Datei hochladen (via Datei-Dialog oder Drag & Drop). Das System parst die Datei automatisch, extrahiert 5 definierte Spalten und öffnet einen Review-Dialog. Dort werden die fehlenden Pflichtfelder (Kategorie, Relevanz, ggf. Gruppe/Untergruppe/Sales Plattform/Produkt) manuell pro Zeile ergänzt. Einzelne Zeilen können entfernt werden. Anschließend werden alle verbleibenden Zeilen als reguläre Transaktionen importiert.

## Bekannte Excel-Struktur (GetMyInvoices Export)

Die Datei enthält folgende Spalten (Auszug aus einem realen Export):

| Excel-Spaltenname | Verwendung | Zielfeld |
|---|---|---|
| `Dokumentendatum` | Datum im Format `DD.MM.YYYY` | Leistungsdatum |
| `Firma/Portal` | Freitext, kann leer sein | Beschreibung |
| `Bruttobetrag` | Deutsches Zahlenformat (`556,73`) | betrag_brutto |
| `Nettobetrag` | Deutsches Zahlenformat — nur zur Plausibilitätsprüfung | (nicht gespeichert) |
| `Steuerbetrag` | Deutsches Zahlenformat (`3,60`) | ust_betrag (Individuell) |
| `Währung` | `EUR`, `USD`, etc. — für Warnhinweis | Anzeige-Info |

Alle anderen Spalten der Excel werden ignoriert.

**USt-Logik beim Import:** USt-Satz wird immer als `individuell` importiert; der `Steuerbetrag` aus der Excel wird direkt als USt-Betrag übernommen. Nettobetrag wird serverseitig berechnet (= Brutto − USt).

## User Stories

- Als Nutzer möchte ich auf der Ausgaben & Kosten-Seite einen "Excel importieren"-Button sehen, damit ich GetMyInvoices-Exporte effizient einlesen kann.
- Als Nutzer möchte ich eine `.xlsx`-Datei per Klick (Datei-Dialog) oder per Drag & Drop hochladen können, damit ich die bevorzugte Methode wählen kann.
- Als Nutzer möchte ich nach dem Hochladen sofort alle geparsten Zeilen in einem übersichtlichen Review-Dialog sehen, damit ich die importierten Daten prüfen kann.
- Als Nutzer möchte ich im Review-Dialog die Pflichtfelder Kategorie und Relevanz (sowie ggf. Gruppe, Untergruppe, Sales Plattform, Produkt je nach KPI-Modell) pro Zeile ausfüllen, damit jede importierte Transaktion korrekt kategorisiert ist.
- Als Nutzer möchte ich im Review-Dialog einzelne Zeilen per Klick entfernen können, damit fehlerhafte oder irrelevante Transaktionen nicht importiert werden.
- Als Nutzer möchte ich bei Transaktionen in Fremdwährung (nicht EUR) einen Warnhinweis sehen, damit ich erkennen kann, dass der Betrag keine €-Gegenwertumrechnung enthält.
- Als Nutzer möchte ich nach dem Ausfüllen aller Pflichtfelder mit einem einzigen Knopf alle verbleibenden Zeilen als Transaktionen importieren.

## Acceptance Criteria

### Upload-Bereich (Schritt 1)

- [ ] Auf der Ausgaben & Kosten-Seite gibt es neben "Neue Transaktion" einen Button **"Excel importieren"**
- [ ] Klick auf "Excel importieren" öffnet einen Upload-Bereich (Modal oder Inline-Bereich)
- [ ] Der Upload-Bereich unterstützt zwei Methoden:
  - [ ] **Klick**: öffnet den nativen Datei-Dialog, gefiltert auf `.xlsx`-Dateien
  - [ ] **Drag & Drop**: Datei kann in den Bereich gezogen und losgelassen werden
- [ ] Während der Datei-Verarbeitung wird ein Lade-Spinner / "Datei wird verarbeitet..." angezeigt
- [ ] Nur `.xlsx`-Dateien werden akzeptiert; bei anderen Dateitypen erscheint eine Fehlermeldung
- [ ] Bei Parse-Fehler (fehlende Pflicht-Spalten, beschädigte Datei) erscheint eine klare Fehlermeldung

### Parsing-Logik

- [ ] Das System liest die erste Zeile der Excel als Kopfzeile aus
- [ ] Folgende Spalten werden anhand des exakten Spaltennamens gefunden:
  - [ ] `Dokumentendatum` → Leistungsdatum (DD.MM.YYYY → ISO Date)
  - [ ] `Firma/Portal` → Beschreibung (kann leer sein → leeres Textfeld)
  - [ ] `Bruttobetrag` → betrag_brutto (deutsches Format: Komma → Punkt, z.B. `556,73` → `556.73`)
  - [ ] `Steuerbetrag` → ust_betrag (gleiche Formatierung)
  - [ ] `Währung` → für Warnhinweis
- [ ] `Nettobetrag` wird aus der Excel gelesen und ausschließlich zur Plausibilitätsprüfung genutzt (kein gespeichertes Feld)
- [ ] Fehlt eine der Pflicht-Spalten (`Dokumentendatum`, `Bruttobetrag`, `Steuerbetrag`) in der Excel → Fehlermeldung mit Hinweis auf fehlende Spalte
- [ ] Zeilen mit leerem `Dokumentendatum` oder leerem `Bruttobetrag` werden übersprungen (nicht in den Review-Dialog aufgenommen)
- [ ] USt-Satz wird immer als `individuell` gesetzt; `Steuerbetrag` aus Excel = ust_betrag
- [ ] Alle Beträge werden als Dezimalzahl mit 2 Nachkommastellen verarbeitet

### Review-Dialog (Schritt 2)

- [ ] Nach erfolgreichem Parsing öffnet sich ein **Review-Dialog** (Vollbild-Modal mit Scroll)
- [ ] Der Dialog zeigt eine Tabelle mit allen geparsten Zeilen (eine Zeile = eine Transaktion)
- [ ] Header zeigt: "X Transaktionen gefunden — bitte fehlende Pflichtfelder ausfüllen"
- [ ] Jede Zeile enthält folgende Spalten:

  **Aus Excel (vorausgefüllt):**
  - Leistungsdatum (vorausgefüllt, editierbar via Date-Picker)
  - Beschreibung (vorausgefüllt aus Firma/Portal, editierbar, optional)
  - Bruttobetrag (vorausgefüllt, nicht editierbar im Dialog)
  - USt-Betrag (vorausgefüllt = Steuerbetrag aus Excel, nicht editierbar im Dialog)
  - Netto (berechnet = Brutto − USt, nicht editierbar, nur Anzeige)
  - Währungs-Indikator: `!`-Icon neben Bruttobetrag, wenn Währung ≠ EUR; Tooltip: "Betrag aus Fremdwährung ([WÄHRUNG]) — kein Wechselkurs angewandt. Bitte Betrag manuell prüfen."

  **Manuell auszufüllen:**
  - Kategorie (Dropdown, **Pflichtfeld**)
  - Gruppe (Dropdown, **Pflichtfeld** wenn KPI-Modell Ebene-2 hat — sonst ausgeblendet)
  - Untergruppe (Dropdown, **Pflichtfeld** wenn KPI-Modell Ebene-3 hat — sonst ausgeblendet)
  - Sales Plattform (Dropdown, **Pflichtfeld** wenn gewählte Kategorie `sales_plattform_enabled=true` — sonst ausgeblendet)
  - Produkt (Dropdown, **Pflichtfeld** wenn gewählte Kategorie `produkt_enabled=true` — sonst ausgeblendet)
  - Relevanz (Dropdown "Ja" / "Nein", **Pflichtfeld**)

  **Optionale Felder (nicht im Default-Review sichtbar, aber über "Weitere Felder"-Expand zugänglich):**
  - Zahlungsdatum (Date-Picker, optional)
  - Abschreibung (Dropdown 3/5/7/10 Jahre, optional)

- [ ] Kaskadierung der Kategorie-Dropdowns: Gruppe resettet sich bei Kategoriewechsel; Untergruppe resettet sich bei Gruppenwechsel (identisch zu PROJ-5)
- [ ] Jede Zeile hat am rechten Rand einen **Löschen-Button** (Mülleimer-Icon); Klick entfernt die Zeile sofort aus dem Dialog (kein Bestätigungs-Dialog nötig)
- [ ] Oben im Dialog: Zähler zeigt "X von Y Zeilen vollständig ausgefüllt"
- [ ] Der **"Alle importieren"**-Button am unteren Rand ist deaktiviert, solange noch Zeilen mit fehlenden Pflichtfeldern vorhanden sind
- [ ] Wenn alle Zeilen gelöscht wurden, erscheint ein leerer Zustand mit "Keine Transaktionen zum Importieren" und einem "Schließen"-Button
- [ ] "Abbrechen"-Button schließt den Dialog ohne zu importieren

### Import (Schritt 3)

- [ ] Klick auf "Alle importieren" sendet alle verbleibenden Zeilen als Batch an die API
- [ ] Jede Zeile wird als reguläre Transaktion gespeichert (gleiche Felder wie manuell erstellte Transaktionen in PROJ-5)
- [ ] Felder, die nicht im Review-Dialog ausgefüllt wurden, werden mit `null` gespeichert (z.B. Zahlungsdatum, Abschreibung)
- [ ] Nach erfolgreichem Import:
  - Dialog schließt sich
  - Ausgaben & Kosten-Tabelle wird neu geladen und zeigt die importierten Transaktionen
  - Toast-Nachricht: "X Transaktionen erfolgreich importiert"
- [ ] Bei Teil-Fehler (eine oder mehrere Zeilen schlagen fehl): Toast mit "X von Y Transaktionen importiert — Y Fehler aufgetreten" und Details welche Zeilen fehlschlugen
- [ ] Bei Netzwerkfehler: Fehlermeldung im Dialog, Dialog bleibt offen (Nutzer kann es erneut versuchen)

## Tabellen-Spalten im Review-Dialog

| Spalte | Quelle | Pflicht | Editierbar |
|--------|--------|---------|------------|
| Leistungsdatum | Excel: Dokumentendatum | Ja (aus Excel) | Ja (Date-Picker) |
| Beschreibung | Excel: Firma/Portal | Nein | Ja (Freitext) |
| Bruttobetrag | Excel: Bruttobetrag | Ja (aus Excel) | Nein |
| USt-Betrag | Excel: Steuerbetrag | Ja (aus Excel) | Nein |
| Netto | Berechnet: Brutto − USt | — | Nein (Anzeige) |
| Währungswarnung | Excel: Währung ≠ EUR | — | Nein (Info) |
| Kategorie | Manuell | Pflicht | Ja (Dropdown) |
| Gruppe | Manuell | Pflicht (wenn sichtbar) | Ja (Dropdown) |
| Untergruppe | Manuell | Pflicht (wenn sichtbar) | Ja (Dropdown) |
| Sales Plattform | Manuell | Pflicht (wenn sichtbar) | Ja (Dropdown) |
| Produkt | Manuell | Pflicht (wenn sichtbar) | Ja (Dropdown) |
| Relevanz | Manuell | Pflicht | Ja (Dropdown) |
| Löschen | — | — | Button |

## Edge Cases

- **Falscher Dateityp** (z.B. `.csv`, `.pdf`): Fehlermeldung "Bitte eine `.xlsx`-Datei hochladen"
- **Leere Excel** (nur Kopfzeile, keine Datenzeilen): Fehlermeldung "Die Datei enthält keine Transaktionen"
- **Fehlende Pflicht-Spalte** (z.B. kein `Dokumentendatum`): Fehlermeldung "Spalte 'Dokumentendatum' nicht gefunden — bitte eine GetMyInvoices-Excel hochladen"
- **Ungültiges Datum** in einer Zeile (z.B. kein Datum, falsches Format): Zeile wird übersprungen mit Hinweis
- **Bruttobetrag = 0 oder negativ**: Zeile wird in den Review-Dialog aufgenommen, aber rot markiert; Import dieser Zeile blockiert
- **Steuerbetrag > Bruttobetrag**: Zeile rot markiert, Import blockiert (Nettobetrag würde negativ)
- **Fremdwährung** (nicht EUR): Zeile wird normal importiert, aber Bruttobetrag-Zelle zeigt `!`-Icon mit Tooltip
- **Sehr große Datei** (100+ Zeilen): Review-Dialog mit Pagination (50 Zeilen pro Seite) oder virtualisierter Liste
- **Doppelter Import** (gleiche Datei erneut hochgeladen): Kein automatischer Duplikat-Check — der Nutzer ist verantwortlich
- **KPI-Modell nicht vorhanden**: Review-Dialog zeigt Hinweis "Kein Ausgaben-KPI-Modell definiert" mit Link zu Einstellungen; Import-Button bleibt deaktiviert

## Technical Requirements

- **Client-seitiges Parsing**: Excel-Datei wird im Browser geparst (kein Upload auf Server) — Bibliothek `xlsx` (SheetJS) oder ähnlich
- **Batch-Import**: Neuer API-Endpunkt `POST /api/ausgaben-kosten-transaktionen/batch` — nimmt ein Array von Transaktionsobjekten entgegen; gibt Erfolgs-/Fehlerarray zurück
- **Keine neue Tabelle**: Alle importierten Datensätze landen in der bestehenden `ausgaben_kosten_transaktionen`-Tabelle (PROJ-5)
- **USt-Satz**: wird immer als `'individuell'` gespeichert; Nettobetrag serverseitig berechnet
- **Deutsches Zahlenformat**: Parser muss `,` → `.` für Dezimalzahlen und `.` als Tausender-Trenner ignorieren (z.B. `1.234,56` → `1234.56`)
- **Datumsformat**: `DD.MM.YYYY` → ISO `YYYY-MM-DD`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
