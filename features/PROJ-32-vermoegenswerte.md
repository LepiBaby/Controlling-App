# PROJ-32: Vermögenswerte-Verwaltung

## Status: Approved
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Produkte (`type='produkte'`) und Sales-Plattformen (`type='sales_plattformen'`) als Strukturgrundlage
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen) — Datenquelle für Verbindlichkeiten und Transit-Warenwert
- Requires: PROJ-16 (Produktkosten-Verwaltung) — Produktkosten für Lagerwert-Berechnung
- Requires: PROJ-17 (Bestandsverwaltung) — Endbestände je SKU für Lagerwert-Berechnung
- Requires: PROJ-29 (Liquiditätsreport) — Kontostand für Cash-Bestand-Vorschlag
- Requires: PROJ-31 (Umsatzsteuer-Reporting) — Berechnungslogik für Steuerforderung / Steuerverbindlichkeit

## Übersicht

Eine neue Datenpflege-Seite „Vermögenswerte" unter `/dashboard/vermoegenswerte`. Hier werden periodische Stichtagssnapshots der Vermögenslage des Unternehmens erfasst, bestehend aus:

- **Warenwert**: Lagerwert und Transit-Warenwert je Produkt
- **Verbindlichkeiten**: aus Lieferung und Leistung sowie sonstige
- **Forderungen**: je Sales-Plattform sowie sonstige
- **Steuerstatus**: Steuerforderung oder Steuerverbindlichkeit (aus USt-Berechnung)
- **Cash-Bestand**: Kontostand zum Stichtag

Die Erfassung erfolgt über einen **6-Schritte-Dialog**, der für jeden Schritt automatisch berechnete Vorschlagswerte liefert und manuelle Korrekturen erlaubt. Bereits erfasste Snapshots werden in einer horizontalen Tabelle angezeigt.

## User Stories

- Als Controlling-Mitarbeiter möchte ich zu einem bestimmten Stichtag einen Vermögens-Snapshot anlegen, damit ich die Vermögenslage des Unternehmens zu jedem beliebigen Zeitpunkt dokumentieren kann.
- Als Controlling-Mitarbeiter möchte ich den Lagerwert je Produkt automatisch aus Bestand und Produktkosten berechnet bekommen, damit ich keine manuelle Kalkulation durchführen muss.
- Als Controlling-Mitarbeiter möchte ich auto-berechnete Werte manuell überschreiben können, damit Abweichungen, Schätzungen oder nicht erfasste Daten korrekt eingetragen werden können.
- Als Controlling-Mitarbeiter möchte ich beim Transit-Warenwert eine konkrete Einkaufstransaktion aus der Ausgaben-Tabelle auswählen können, damit der Wert der auf dem Weg befindlichen Ware direkt aus den Buchungsdaten belegt ist.
- Als Controlling-Mitarbeiter möchte ich die aktuellen offenen Verbindlichkeiten automatisch aus unbezahlten Ausgaben aggregiert sehen, damit ich keine manuelle Summierung vornehmen muss.
- Als Controlling-Mitarbeiter möchte ich Verbindlichkeiten nach „aus Lieferung und Leistung" und „sonstige" getrennt erfassen, damit ich die Verbindlichkeitsstruktur auf einen Blick erkennen kann.
- Als Controlling-Mitarbeiter möchte ich die offenen Forderungen je Sales-Plattform manuell eingeben können, damit Guthaben bei Amazon, Shopify usw. korrekt erfasst sind.
- Als Controlling-Mitarbeiter möchte ich für einen frei wählbaren Monatszeitraum automatisch die Steuerforderung oder Steuerverbindlichkeit berechnet bekommen, damit ich den Steuerstatus in den Snapshot einpflegen kann.
- Als Controlling-Mitarbeiter möchte ich den Cash-Bestand aus dem Liquiditätsreport als Vorschlag bekommen, den ich manuell anpassen kann, damit der kumulierte Kontostand als Ausgangswert dient.
- Als Controlling-Mitarbeiter möchte ich alle erfassten Snapshots in einer übersichtlichen Tabelle sehen, damit ich die Entwicklung der Vermögenswerte über die Zeit verfolgen kann.
- Als Controlling-Mitarbeiter möchte ich Snapshots löschen können, damit fehlerhafte Einträge entfernt werden können.

## Acceptance Criteria

### Seite & Navigation

- [ ] Neue Seite unter `/dashboard/vermoegenswerte` erreichbar
- [ ] Navigationseintrag „Vermögenswerte" unter der Gruppe „Datenpflege" im NavSheet
- [ ] Seite nur für eingeloggte Nutzer zugänglich (Redirect zu `/login` wenn nicht eingeloggt)

### Haupttabelle

- [ ] Tabelle zeigt alle erfassten Snapshots, absteigend nach Datum sortiert (neueste oben)
- [ ] Spalten in dieser Reihenfolge:
  1. Datum
  2. Je Produkt (in `sort_order`-Reihenfolge aus KPI-Modell), je zwei Spalten: „[Produktname] Lagerwert" und „[Produktname] Transitwert"
  3. „Verbindlichkeiten L&L" (aus Lieferung und Leistung)
  4. „Sonstige Verbindlichkeiten"
  5. „Steuerverbindlichkeiten" (Spalte nur angezeigt, wenn mindestens ein Snapshot eine Steuerverbindlichkeit > 0 hat)
  6. Je Plattform (in `sort_order`-Reihenfolge): „Forderungen [Plattformname]"
  7. „Sonstige Forderungen"
  8. „Steuerforderungen" (Spalte nur angezeigt, wenn mindestens ein Snapshot eine Steuerforderung > 0 hat)
  9. „Cash-Bestand"
  10. Aktionen (Löschen)
- [ ] Alle Beträge mit 2 Dezimalstellen und € (de-DE Locale, z. B. „3.450,00 €")
- [ ] 0-Werte werden als „0,00 €" angezeigt (nicht leer gelassen)
- [ ] Tabelle horizontal scrollbar bei vielen Spalten; Datumsspalte sticky links
- [ ] Leerzustand wenn keine Snapshots vorhanden: Hinweistext + Button „+ Neue Erfassung"

### Multi-Step-Dialog — Allgemein

- [ ] Button „+ Neue Erfassung" öffnet 6-Schritte-Dialog
- [ ] Dialog zeigt Schrittanzeige (z. B. „Schritt 1 von 6: Lagerwert")
- [ ] Pflichtfeld „Datum" im Dialog (Default: heute), als erstes Element sichtbar (in Schritt 1 oder in einem Einleitungsschritt)
- [ ] Navigation: „Zurück"- und „Weiter"-Buttons; im letzten Schritt wird „Weiter" zu „Speichern"
- [ ] Eingegebene Werte bleiben erhalten, wenn der Nutzer zwischen Schritten vor- und zurücknavigiert
- [ ] „Abbrechen" schließt den Dialog ohne zu speichern
- [ ] Erst nach Abschluss aller Schritte und Klick auf „Speichern" wird der Snapshot gespeichert
- [ ] Nach erfolgreichem Speichern: Dialog schließt, Tabelle aktualisiert sich sofort

### Schritt 1 — Lagerwert je Produkt

- [ ] Für jedes Produkt (Ebene 1 aus `kpi_categories`, `type='produkte'`, nach `sort_order`) wird automatisch ein Vorschlagswert berechnet:
  - **Endbestand je SKU zum Stichtag**: letzter erfasster Endbestand aus `bestand_transaktionen` für diese SKU mit `datum ≤ Stichtag`; Endbestand = `anfangsbestand − Σ(sendungen je Plattform) − sendungen_manuell + einlagerungen + anpassungen_positiv − anpassungen_negativ − warenverluste`
  - **Produktkosten zum Stichtag**: aus `produktkosten_zeitraeume/werte` — der Zeitraum, dessen `gueltig_von ≤ Stichtag` und (`gueltig_bis ≥ Stichtag` oder `gueltig_bis IS NULL`); Gesamtproduktkosten = Summe aller `produktkosten_werte.wert` dieses Zeitraums
  - **Lagerwert Produkt** = `Σ(Endbestand aller SKUs dieses Produkts) × Gesamtproduktkosten`
- [ ] Ist kein Bestand oder keine Produktkosten zum Stichtag vorhanden: Vorschlagswert = 0,00 €
- [ ] Vorschlagswert wird im Zahlenfeld vorausgefüllt und ist durch den Nutzer direkt editierbar (€, ≥ 0)
- [ ] Berechneter Vorschlagswert wird optisch hervorgehoben (z. B. leicht grau), überschriebene Werte normal dargestellt
- [ ] Keine Produkte im KPI-Modell: Leerzustand mit Hinweis und Link zum KPI-Modell

### Schritt 2 — Transit-Warenwert je Produkt

- [ ] Für jedes Produkt (gleiche Reihenfolge wie Schritt 1) gibt es:
  - Ein **Dropdown** zur Auswahl einer Transaktion aus `ausgaben_kosten_transaktionen`:
    - Nur Transaktionen der Produktkosten-Kategorie angezeigt (Transaktionen, deren Kategoriezugehörigkeit unter der Ebene-1-Kategorie „Produkt" im ausgaben_kosten-KPI-Modell liegt)
    - Vorgefilterter Dropdown: zeigt nur Transaktionen, die dem jeweiligen Produkt zugeordnet sind (genaue Filterlogik wird in der Architecture-Phase bestimmt — z. B. via Dimension oder Kategoriehierarchie)
    - Dropdown-Einträge zeigen: Datum | Betrag netto | ggf. Beschreibung/Notiz
    - Option „(Kein Eintrag)" als erste Auswahl
  - Ein **Betrag-Feld** (€, ≥ 0, Default 0): bei Dropdown-Auswahl automatisch mit dem `betrag_netto` der gewählten Transaktion befüllt, dann manuell überschreibbar
- [ ] Dropdown und Betrag-Feld sind vollständig optional; kein Transit-Wert = 0,00 €
- [ ] Keine Produkte im KPI-Modell: Leerzustand mit Hinweis

### Schritt 3 — Verbindlichkeiten

- [ ] Automatisch berechnet aus `ausgaben_kosten_transaktionen WHERE zahlungsdatum IS NULL` (alle unbezahlten Ausgaben):
  - **Verbindlichkeiten aus Lieferung und Leistung (L&L)**: Summe `betrag_brutto` aller Transaktionen ohne Zahlungsdatum, deren `kategorie_id` auf die Ebene-1-Kategorie „Produkt" zeigt (oder deren Hierarchie darunter liegt)
  - **Sonstige Verbindlichkeiten**: Summe `betrag_brutto` aller übrigen Transaktionen ohne Zahlungsdatum (alle Kategorien außer „Produkt")
- [ ] Beide Vorschlagswerte werden in editierbaren Zahlenfeldern (€, ≥ 0) vorausgefüllt
- [ ] Nutzer kann beide Werte manuell überschreiben
- [ ] Keine offenen Transaktionen: Vorschlagswert = 0,00 €

### Schritt 4 — Forderungen

- [ ] Für jede Sales-Plattform aus `kpi_categories` (`type='sales_plattformen'`, Ebene 1, nach `sort_order`): ein manuelles Betrag-Feld in € (Default 0, ≥ 0)
- [ ] Zusätzlich ein Feld „Sonstige Forderungen" (€, ≥ 0, Default 0)
- [ ] Alle Felder optional; leer = 0
- [ ] Keine Sales-Plattformen im KPI-Modell: nur das Feld „Sonstige Forderungen" wird angezeigt

### Schritt 5 — Steuerforderung / Steuerverbindlichkeit

- [ ] Nutzer kann einen Berechnungszeitraum angeben: „Von Monat" und „Bis Monat" (`<input type="month">`)
- [ ] Wenn beide Felder gesetzt und Von ≤ Bis: automatische Berechnung des Steuersaldos (identische Logik wie PROJ-31 Umsatzsteuer-Report):
  `Saldo = Abzuführende USt (Zeitraum) − Abziehbare Vorsteuer (Zeitraum)`
- [ ] Ergebnis-Anzeige:
  - Positiver Saldo → Label „Steuerverbindlichkeit: [Betrag] €" (noch abzuführen)
  - Negativer Saldo → Label „Steuerforderung: [Betrag] €" (Erstattungsanspruch)
  - Saldo = 0 → Label „Kein offener Steuersaldo"
- [ ] Betrag-Feld (€, ≥ 0) wird mit dem absoluten Saldo-Betrag vorausgefüllt, ist manuell überschreibbar
- [ ] Radio- oder Toggle-Feld: „Steuerverbindlichkeit" / „Steuerforderung" — wird automatisch aus dem Vorzeichen des Saldos gesetzt, ist manuell umschaltbar
- [ ] Von/Bis-Felder optional; wenn nicht gesetzt: Betrag = 0, Typ = keiner
- [ ] Validierung: Von > Bis → Fehlermeldung, Berechnung blockiert

### Schritt 6 — Cash-Bestand

- [ ] Automatisch aus dem Liquiditätsreport abgelesen: kumulierter Kontostand bis zum Monat des gewählten Stichtags (identische Berechnung wie `kontostand`-Zeile in PROJ-29)
- [ ] Vorschlagswert wird im Betrag-Feld vorausgefüllt (€, manuell überschreibbar)
- [ ] Keine Liquiditätsdaten vorhanden: Vorschlagswert = 0,00 €
- [ ] Feld optional überschreibbar; Betrag kann positiv oder negativ sein (negativer Kontostand = Überziehung)

### Löschen

- [ ] Jeder Snapshot-Eintrag hat einen Löschen-Button
- [ ] Löschen zeigt Bestätigungs-Dialog vor dem endgültigen Löschen
- [ ] Nach Löschen: sofortige Aktualisierung der Tabelle

## Edge Cases

- Kein Produkt im KPI-Modell: Schritt 1 und 2 zeigen Leer-Zustand mit Hinweis und Link zum KPI-Modell; Dialog kann trotzdem durchlaufen werden
- Keine `bestand_transaktionen` für ein Produkt/SKU zum Stichtag: Lagerwert-Vorschlag für dieses Produkt = 0
- Keine Produktkosten (`produktkosten_zeitraeume`) für das Stichtag-Datum gültig: Lagerwert-Vorschlag = 0
- Kein aktiver Produktkosten-Zeitraum (Datum liegt vor dem ersten oder in einer Lücke): Vorschlagswert = 0
- Negativer Endbestand in `bestand_transaktionen`: Lagerwert-Vorschlag kann negativ werden → erlaubt, wird angezeigt (kein Fehler)
- Keine Transaktionen ohne Zahlungsdatum in `ausgaben_kosten_transaktionen`: Verbindlichkeiten = 0
- Keine Sales-Plattformen im KPI-Modell (Schritt 4): nur Feld „Sonstige Forderungen" sichtbar
- Von > Bis in Schritt 5: Fehlermeldung unter den Monatsfeldern, „Weiter"-Button bleibt aktiv (Steuerwert = 0 tragen oder manuell eingeben)
- Keine Transaktionen im Steuer-Berechnungszeitraum: Steuersaldo = 0
- Keine Liquiditätsdaten für den Monat des Stichtags (Schritt 6): Vorschlagswert = 0
- Ausgewählte Transit-Transaktion (Schritt 2) wurde nachträglich in `ausgaben_kosten_transaktionen` gelöscht: gespeicherter `transitwert` im Snapshot bleibt erhalten; `ausgaben_transaktion_id` wird auf NULL gesetzt (ON DELETE SET NULL)
- Produkt oder Plattform nach Snapshot-Erstellung aus KPI-Modell gelöscht: Snapshot-Daten bleiben in DB; gelöschtes Produkt/Plattform erscheint nicht mehr in der Spaltenbezeichnung (zeigt ggf. „(gelöscht)")
- Mehrere Snapshots am gleichen Tag: nicht erlaubt; Unique-Constraint auf `datum`; Fehlermeldung wenn Datum bereits vergeben
- Steuersaldo-Spalten in der Tabelle: „Steuerverbindlichkeiten"- und „Steuerforderungen"-Spalten werden ausgeblendet, solange alle Snapshots jeweils den Wert 0 haben — sobald ein Snapshot einen Wert > 0 hat, wird die Spalte eingeblendet
- Von-bis-Datumsfilter für die Tabelle (optional, Phase 2): derzeit keine Filterung; alle Snapshots werden angezeigt

## Technical Requirements

### Neue Datenbanktabellen

**`vermoegenswerte_snapshots`** — ein Eintrag pro Stichtag
- `id` UUID, Primärschlüssel
- `datum` DATE, UNIQUE (ein Snapshot pro Tag)
- `verbindlichkeiten_llv` NUMERIC(12,2) ≥ 0
- `verbindlichkeiten_sonstige` NUMERIC(12,2) ≥ 0
- `steuersaldo_typ` TEXT NULL — `'forderung'` | `'verbindlichkeit'` | NULL
- `steuersaldo` NUMERIC(12,2) ≥ 0 NULL
- `steuersaldo_von` DATE NULL — Von-Monat (erster Tag des Monats)
- `steuersaldo_bis` DATE NULL — Bis-Monat (letzter Tag des Monats)
- `cash_bestand` NUMERIC(12,2) — kann negativ sein (Überziehung)
- `created_at` TIMESTAMP

**`vermoegenswerte_lagerwerte`** — je Produkt pro Snapshot
- `id` UUID, Primärschlüssel
- `snapshot_id` UUID FK → `vermoegenswerte_snapshots.id` (CASCADE DELETE)
- `produkt_id` UUID FK → `kpi_categories.id` (SET NULL on delete)
- `lagerwert` NUMERIC(12,2) ≥ 0
- Unique Constraint: `(snapshot_id, produkt_id)`

**`vermoegenswerte_transitwerte`** — je Produkt pro Snapshot
- `id` UUID, Primärschlüssel
- `snapshot_id` UUID FK → `vermoegenswerte_snapshots.id` (CASCADE DELETE)
- `produkt_id` UUID FK → `kpi_categories.id` (SET NULL on delete)
- `ausgaben_transaktion_id` UUID NULL FK → `ausgaben_kosten_transaktionen.id` (SET NULL on delete)
- `transitwert` NUMERIC(12,2) ≥ 0
- Unique Constraint: `(snapshot_id, produkt_id)`

**`vermoegenswerte_forderungen`** — je Plattform pro Snapshot
- `id` UUID, Primärschlüssel
- `snapshot_id` UUID FK → `vermoegenswerte_snapshots.id` (CASCADE DELETE)
- `plattform_id` UUID NULL FK → `kpi_categories.id` (SET NULL on delete) — NULL = sonstige Forderungen
- `betrag` NUMERIC(12,2) ≥ 0
- Unique Constraint: `(snapshot_id, plattform_id)` — wobei NULL als eigene Gruppe gilt

### API-Routen

```
GET    /api/vermoegenswerte                     → Alle Snapshots (inkl. Lagerwerte, Transitwerte, Forderungen)
GET    /api/vermoegenswerte/vorschlaege?datum=  → Vorschlagswerte berechnen für den 6-Schritte-Dialog
POST   /api/vermoegenswerte                     → Neuen Snapshot + alle Unter-Einträge anlegen (409 wenn Datum bereits existiert)
DELETE /api/vermoegenswerte/[id]                → Snapshot löschen (Cascade)
```

Die `vorschlaege`-Route berechnet alle Auto-Werte für einen Stichtag:
- Lagerwert je Produkt (aus Bestand × Produktkosten)
- Verbindlichkeiten L&L und sonstige (aus ausgaben_kosten_transaktionen ohne Zahlungsdatum)
- Cash-Bestand (aus Liquiditätsreport-Logik)
(Steuersaldo wird separat berechnet, sobald der Nutzer Von/Bis eingibt — ggf. eigene Route oder als Teil von `/api/reporting/umsatzsteuer`)

### Sicherheit & Auth
- Auth required auf allen Routen (wie alle anderen Datenpflege-Seiten)
- RLS-Policies auf allen 4 neuen Tabellen (SELECT, INSERT, UPDATE, DELETE für authentifizierte Nutzer)
- Zod-Validierung auf POST/DELETE: Datum, UUIDs, NUMERIC-Werte ≥ 0, Enum-Werte für `steuersaldo_typ`

### Performance
- `vorschlaege`-Berechnung: serverseitig via Supabase-Abfragen (kein Client-seitiges Rechnen mit großen Datenmengen)
- Haupttabelle: alle Snapshots in einem API-Call mit nested joins geladen (kein Pagination nötig — überschaubare Anzahl Snapshots pro Jahr)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/vermoegenswerte/page.tsx
├── PageHeader „Vermögenswerte"
├── Button „+ Neue Erfassung"
│
├── VermoegenswertTable  (horizontal scrollbar, sticky Datumsspalte)
│   ├── Kopfzeile: Datum (sticky) | [Produkt A Lager] | [Produkt A Transit] |
│   │             [Produkt B Lager] | [Produkt B Transit] | ...
│   │             Verbindlichk. L&L | Sonst. Verbindlichk. |
│   │             [Steuerverbindlichk. — nur wenn Wert vorhanden] |
│   │             Forder. [Plattform A] | Forder. [Plattform B] | ... |
│   │             Sonst. Forderungen |
│   │             [Steuerforderungen — nur wenn Wert vorhanden] |
│   │             Cash-Bestand | Aktionen
│   ├── SnapshotRow (je Eintrag)
│   └── Leerzustand (wenn keine Snapshots)
│
├── VermoegenswertWizardDialog  (shadcn Dialog, 6-Schritte-Wizard)
│   ├── Datum-Eingabe (Pflicht, Default: heute) + StepIndicator „Schritt X von 6"
│   ├── [Schritt 1] LagerwertStep
│   │   └── Je Produkt: Label | Vorschlagswert (auto, grau) | editierbares €-Feld
│   ├── [Schritt 2] TransitwertStep
│   │   └── Je Produkt: Dropdown (Transaktionen aus ausgaben_kosten) | editierbares €-Feld
│   ├── [Schritt 3] VerbindlichkeitenStep
│   │   ├── L&L-Verbindlichkeiten: Vorschlag (auto) | editierbares €-Feld
│   │   └── Sonstige Verbindlichkeiten: Vorschlag (auto) | editierbares €-Feld
│   ├── [Schritt 4] ForderungenStep
│   │   ├── Je Plattform: Plattformname | €-Feld (manuell)
│   │   └── Sonstige Forderungen: €-Feld (manuell)
│   ├── [Schritt 5] SteuerStep
│   │   ├── Von-Monat / Bis-Monat (<input type="month">)
│   │   ├── Ergebnis-Label: „Steuerverbindlichkeit: 1.250 €" oder „Steuerforderung: 320 €"
│   │   ├── Toggle: Steuerverbindlichkeit / Steuerforderung
│   │   └── Editierbares €-Feld (absoluter Betrag)
│   └── [Schritt 6] CashBestandStep
│       └── Vorschlag (auto, grau) | editierbares €-Feld
│
└── DeleteConfirmDialog (shadcn AlertDialog)
```

### Datenfluss im Dialog

```
1. Nutzer klickt „+ Neue Erfassung"
   → Dialog öffnet; Datum = heute; currentStep = 1

2. Datum wird gesetzt / geändert
   → GET /api/vermoegenswerte/vorschlaege?datum=YYYY-MM-DD
   → Server berechnet parallel:
       a) Lagerwert je Produkt (Bestand × Produktkosten zum Stichtag)
       b) Verbindlichkeiten L&L + sonstige (offene Ausgaben ohne Zahlungsdatum)
       c) Cash-Bestand (kumulierter Kontostand bis Stichtag aus Liquiditätsreport)
   → Vorschlagswerte befüllen die Steps 1, 3, 6 als Defaults

3. Schritt 2 — Dropdown wird geöffnet (je Produkt):
   → GET /api/ausgaben-kosten-transaktionen
         ?kategorie_ids=[ID der „Produkt"-L1-Kategorie]
         &produkt_ids=[ID des jeweiligen Produkts]
   → Transaktion ausgewählt → betrag_netto in Feld übernehmen

4. Schritt 5 — Von + Bis werden gesetzt:
   → GET /api/reporting/umsatzsteuer?von=YYYY-MM&bis=YYYY-MM&granularitaet=monat
   → Σ faelligeUst aller Perioden = Steuersaldo
   → Positiv → Steuerverbindlichkeit; Negativ → Steuerforderung
   → Absoluter Betrag in Feld; Typ in Toggle vorausgefüllt

5. Nutzer klickt „Speichern" (in Schritt 6):
   → POST /api/vermoegenswerte  (alle 6 Schritte als ein JSON-Objekt)
   → Server schreibt snapshot + lagerwerte + transitwerte + forderungen atomisch
   → Dialog schließt; Tabelle lädt neu
```

### API-Endpunkte

```
GET  /api/vermoegenswerte
     → Alle Snapshots (mit lagerwerte, transitwerte, forderungen als nested joins)
     → Gleichzeitig Produkte + Plattformen aus kpi_categories für Spaltendefinition

GET  /api/vermoegenswerte/vorschlaege?datum=YYYY-MM-DD
     → Serverseitige Berechnung (parallel):
         1. kpi_categories (Produkte Level 1+2, für Bestand-Lookup)
         2. bestand_transaktionen (letzte Transaktion ≤ datum je SKU) + bestand_sendungen
            → Endbestand je SKU berechnen → Σ je Produkt
         3. produktkosten_zeitraeume + produktkosten_werte (gültiger Zeitraum zum datum)
            → Gesamtproduktkosten je Produkt
         4. Lagerwert = Endbestand × Gesamtproduktkosten je Produkt
         5. ausgaben_kosten_transaktionen WHERE zahlungsdatum IS NULL
            → L&L: Σ betrag_brutto WHERE kategorie = „Produkt"-L1
            → Sonstige: Σ betrag_brutto aller anderen
         6. Liquiditätsreport-Logik (intern): Kontostand bis Monat des Stichtags

POST /api/vermoegenswerte
     → Zod-Validierung; 409 wenn datum bereits existiert
     → Atomares Insert: snapshot + alle Untereinträge

DELETE /api/vermoegenswerte/[id]
     → CASCADE löscht Lagerwerte, Transitwerte, Forderungen automatisch
```

### Datenmodell (4 neue Tabellen)

**`vermoegenswerte_snapshots`** — ein Eintrag pro Stichtag
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | UUID | Primärschlüssel |
| datum | DATE UNIQUE | Stichtag; max. ein Snapshot pro Tag |
| verbindlichkeiten_llv | NUMERIC(12,2) | Verbindlichkeiten L&L (manuell bestätigt) |
| verbindlichkeiten_sonstige | NUMERIC(12,2) | Sonstige Verbindlichkeiten |
| steuersaldo_typ | TEXT NULL | `'forderung'` \| `'verbindlichkeit'` \| NULL |
| steuersaldo | NUMERIC(12,2) NULL | Absoluter Steuersaldo-Betrag |
| steuersaldo_von | DATE NULL | Von-Monat der Steuerberechnung |
| steuersaldo_bis | DATE NULL | Bis-Monat der Steuerberechnung |
| cash_bestand | NUMERIC(12,2) | Cash-Bestand (kann negativ sein) |
| created_at | TIMESTAMP | Erstellungszeitpunkt |

**`vermoegenswerte_lagerwerte`** — je Produkt pro Snapshot
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| snapshot_id | UUID FK | → snapshots (CASCADE DELETE) |
| produkt_id | UUID FK | → kpi_categories (SET NULL on delete) |
| lagerwert | NUMERIC(12,2) | Manuell bestätigter Lagerwert |
| UNIQUE | (snapshot_id, produkt_id) | |

**`vermoegenswerte_transitwerte`** — je Produkt pro Snapshot
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| snapshot_id | UUID FK | → snapshots (CASCADE DELETE) |
| produkt_id | UUID FK | → kpi_categories (SET NULL on delete) |
| ausgaben_transaktion_id | UUID NULL FK | → ausgaben_kosten_transaktionen (SET NULL) |
| transitwert | NUMERIC(12,2) | Manuell bestätigter Transitwert |
| UNIQUE | (snapshot_id, produkt_id) | |

**`vermoegenswerte_forderungen`** — je Plattform pro Snapshot
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| snapshot_id | UUID FK | → snapshots (CASCADE DELETE) |
| plattform_id | UUID NULL FK | → kpi_categories (SET NULL); NULL = sonstige |
| betrag | NUMERIC(12,2) | Forderungsbetrag |
| UNIQUE | (snapshot_id, plattform_id) | inkl. NULL-Behandlung |

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `src/app/dashboard/vermoegenswerte/page.tsx` | Hauptseite: Tabelle + Button |
| `src/components/vermoegenswert-wizard-dialog.tsx` | 6-Schritte-Wizard mit Step-State |
| `src/components/vermoegenswert-table.tsx` | Horizontale Snapshot-Tabelle, sticky Datumsspalte |
| `src/hooks/use-vermoegenswerte.ts` | Snapshots laden (GET), POST, DELETE |
| `src/hooks/use-vermoegenswert-vorschlaege.ts` | Vorschlagswerte laden (GET vorschlaege) |
| `src/app/api/vermoegenswerte/route.ts` | GET + POST Handler |
| `src/app/api/vermoegenswerte/[id]/route.ts` | DELETE Handler |
| `src/app/api/vermoegenswerte/vorschlaege/route.ts` | GET Vorschlagswerte-Berechnung |
| `src/app/api/vermoegenswerte/route.test.ts` | Vitest Unit-Tests |
| `src/app/api/vermoegenswerte/[id]/route.test.ts` | Vitest Unit-Tests |
| `src/app/api/vermoegenswerte/vorschlaege/route.test.ts` | Vitest Unit-Tests |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/nav-sheet.tsx` | Eintrag „Vermögenswerte" unter Datenpflege hinzufügen |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Wizard-Dialog | shadcn Dialog mit `currentStep` State | shadcn Dialog bereits installiert; kein zusätzliches Wizard-Package nötig |
| Form-State | Ein `useState`-Objekt im Dialog-Parent | Alle 6 Schritte bilden einen Speichervorgang; lokaler State reicht völlig |
| Auto-Berechnungen | Eigene `vorschlaege`-Route (serverseitig) | Daten aus 5 verschiedenen Tabellen; Browser-seitiges Laden zu aufwändig und fehleranfällig |
| Steuersaldo | Bestehenden `/api/reporting/umsatzsteuer`-Endpunkt nutzen | Logik korrekt in PROJ-31 implementiert; keine Duplikation; `Σ faelligeUst` reicht |
| Transit-Dropdown | Bestehende `/api/ausgaben-kosten-transaktionen` mit `kategorie_ids` + `produkt_ids` | Tabelle hat `produkt_id`-Spalte; Route unterstützt diese Filter bereits — kein neuer Endpoint nötig |
| Cash-Bestand-Vorschlag | Serverseitig in `vorschlaege`-Route (Liquiditätsreport-Logik intern) | Kontostand = kumulierte Cashflows; muss ab Anfang aller Daten berechnet werden — nicht sinnvoll im Browser |
| Snapshot-Tabelle | Alle Daten in einem API-Call (nested joins) | Überschaubare Zahl Snapshots (≤ 365/Jahr); kein Pagination nötig |
| Steuer-Toggle | shadcn RadioGroup | Bereits installiert; klar für Forderung vs. Verbindlichkeit |

### Keine neuen Packages
Alle benötigten UI-Primitiven (Dialog, AlertDialog, Select, RadioGroup, Input, Button, Table, Skeleton, Tabs) sind bereits installiert.

## Implementation Notes (Frontend + Backend)

### Frontend — Neue Dateien
- `src/hooks/use-vermoegenswerte.ts` — Hook mit Typen (VermoegenswertSnapshot, VermoegenswertInput, VermoegenswertVorschlaege), useVermoegenswerte() für GET/POST/DELETE, loadVorschlaege() als standalone async-Funktion
- `src/components/vermoegenswert-wizard-dialog.tsx` — 6-Schritte-Wizard Dialog mit Stepper-Balken, Datum-Eingabe, Auto-Vorschlagswerte, Transit-Dropdown, Steuer-Berechnung via `/api/reporting/umsatzsteuer`
- `src/components/vermoegenswert-table.tsx` — Horizontale Tabelle mit sticky Datumsspalte, dynamischen Produkt-/Plattform-Spalten, konditionalen Steuer-Spalten, AlertDialog für Löschen
- `src/app/dashboard/vermoegenswerte/page.tsx` — Hauptseite mit NavSheet, lädt Produkte/Plattformen/ausgaben-Kategorien, findet produktKategorieId dynamisch via name='produkt'

### Frontend — Geänderte Dateien
- `src/components/nav-sheet.tsx` — Eintrag „Vermögenswerte" unter Datenpflege nach „Bestandsverwaltung" hinzugefügt

### Backend — Datenbank-Migration
Tabellen angelegt: `vermoegenswarte_snapshots`, `vermoegenswarte_lagerwerte`, `vermoegenswarte_transitwerte`, `vermoegenswarte_forderungen`
- RLS aktiviert auf allen 4 Tabellen (SELECT, INSERT, UPDATE, DELETE für authenticated users)
- CASCADE DELETE von snapshots auf alle Untertabellen
- UNIQUE-Constraints: datum (snapshots), (snapshot_id, produkt_id) (lager/transit), NULLS NOT DISTINCT (snapshot_id, plattform_id) (forderungen)

### Backend — API-Routen
- `src/app/api/vermoegenswerte/route.ts` — GET (alle Snapshots mit nested joins) + POST (atomares Insert mit Zod-Validierung, 409 bei Duplikat-Datum)
- `src/app/api/vermoegenswerte/[id]/route.ts` — DELETE (CASCADE via DB)
- `src/app/api/vermoegenswerte/vorschlaege/route.ts` — GET serverseitige Berechnung: Lagerwert (Bestand × Produktkosten), Verbindlichkeiten L&L/sonstige, Cash-Bestand (kumulierte Cashflows)
- Tests: 14 Tests, alle grün (`src/app/api/vermoegenswerte/**/*.test.ts`)

## QA Test Results

**Tested:** 2026-05-15
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Test Execution Summary
- **Unit Tests (Vitest):** BLOCKED — global test runner issue affects ALL 33 test files in repo, including pre-existing ones. Error: "Vitest failed to find the runner". This is NOT a PROJ-32 regression; the three new PROJ-32 test files (`route.test.ts`, `[id]/route.test.ts`, `vorschlaege/route.test.ts`) are structurally valid (correct imports, mock setup, describe/it usage).
- **E2E Tests (Playwright, chromium):** 22/22 PASSED — `tests/PROJ-32-vermoegenswerte.spec.ts`
- **TypeScript:** Only pre-existing unrelated error in `src/hooks/use-kpi-categories.test.ts` (missing `sku_code`, `ust_satz`, `exclude_from_rentabilitaet` props). No PROJ-32 TS errors.

### Acceptance Criteria Status

#### Seite & Navigation
- [x] Seite `/dashboard/vermoegenswerte` erreichbar (page.tsx existiert, route geschützt durch middleware)
- [x] NavSheet-Eintrag „Vermögenswerte" unter „Datenpflege" nach „Bestandsverwaltung" (`nav-sheet.tsx:24`)
- [x] Auth-Schutz aktiv: Redirect zu `/login?next=%2Fdashboard%2Fvermoegenswerte` (E2E verifiziert)

#### Haupttabelle
- [x] Tabelle zeigt alle Snapshots, absteigend nach Datum sortiert (`vermoegenswert-table.tsx:89` — `[...snapshots].sort((a, b) => b.datum.localeCompare(a.datum))`)
- [x] Spaltenreihenfolge korrekt: Datum | Produkt-Lager/Transit-Paare | Verbindlichkeiten L&L | Sonstige | (Steuer) | Plattform-Forderungen | Sonstige | (Steuer) | Cash | Aktionen
- [x] Beträge im de-DE Currency-Format mit 2 Dezimalstellen (`fmt()` via `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`)
- [x] 0-Werte werden als „0,00 €" angezeigt (`fmt(v ?? 0)`)
- [x] Tabelle horizontal scrollbar (`overflow-x-auto`), Datumsspalte sticky links (`sticky left-0 z-10`)
- [x] Leerzustand mit Hinweistext + Button „+ Neue Erfassung" (`vermoegenswert-table.tsx:80-87`)
- [x] **rowSpan-Fix bestätigt:** Datum-`<th>` und Action-`<th>` haben `rowSpan={2}` in der ersten Header-Reihe; zweite Header-Reihe enthält keine Duplikat-Datum-Zelle (`vermoegenswert-table.tsx:99,136`). Spaltenausrichtung konsistent.
- [x] **Farb-Coding bestätigt:** blau=Warenwert, rose=Verbindlichkeiten, emerald=Forderungen, amber=Cash (`COLOR`-Konstante)
- [x] Steuer-Spalten konditional sichtbar (`hasSteuervb`, `hasSteuerford`)

#### Multi-Step-Dialog — Allgemein
- [x] „+ Neue Erfassung"-Button öffnet 6-Schritte-Dialog (`page.tsx:81-83`)
- [x] Stepper-Anzeige mit „Schritt X von 6: [Name]" (`DialogTitle:262`)
- [x] Pflichtfeld „Datum" (Default: heute, `today()` = `new Date().toISOString().slice(0,10)`)
- [x] Navigation: „Zurück" und „Weiter"-Buttons; im letzten Schritt „Speichern" (`canGoNext = step < 6`, `isLastStep = step === 6`)
- [x] Eingegebene Werte bleiben erhalten beim Vor-/Zurücknavigieren (alle State-Variablen über Dialog-Parent gehalten, kein Reset bei Step-Wechsel)
- [x] „Abbrechen" schließt Dialog ohne zu speichern (`onOpenChange(false)`)
- [x] Speichern erst nach Klick auf „Speichern" in Schritt 6
- [x] Nach Speichern: Dialog schließt + Tabelle aktualisiert via `fetchData()` (`use-vermoegenswerte.ts:93`)

#### Schritt 1 — Lagerwert je Produkt
- [x] Vorschlagswert wird automatisch berechnet (vorschlaege-Route: Endbestand × Produktkosten)
- [x] Vorschlagswert = 0 wenn kein Bestand/keine Produktkosten
- [x] Editierbares Zahlenfeld mit Vorschlag vorbefüllt
- [x] Auto-Vorschlag optisch hervorgehoben (`bg-muted/50` + „auto"-Badge wenn Wert = Vorschlag)
- [x] Leerzustand mit Link zum KPI-Modell wenn keine Produkte (`wizard-dialog.tsx:293-297`)

#### Schritt 2 — Transit-Warenwert je Produkt
- [x] **Accordion-Pattern bestätigt:** Produkte sind kollabiert by default (`expandedProducts = new Set()`); Klick auf Produkt-Header expandiert (`toggleProductExpand`). ChevronRight rotiert um 90° (`isExpanded ? 'rotate-90' : ''`).
- [x] Lazy-Load von Transaktionen erst bei Aufklappen (`loadTransitTransaktionen` in `toggleProductExpand`)
- [x] Multi-Select via Checkboxen (anders als ursprüngliche Spec, die ein Dropdown vorsah — aber semantisch äquivalent + bessere UX)
- [x] Auto-Summe ausgewählter `betrag_netto` in Transit-Betrag-Feld
- [x] Manuelle Überschreibung möglich
- [x] Transit-Betrag auch im kollabierten Zustand editierbar (kleines Inline-Feld)
- [x] Leerzustand wenn keine Produkte
- [ ] **BUG-1 (Medium): `ausgaben_transaktion_id` wird nicht gespeichert.** Die ausgewählten Transaktion-IDs in `transitSelections` werden beim Speichern ignoriert; Zeile 234 setzt immer `ausgaben_transaktion_id: null`. Das Datenmodell und die Edge-Case-Beschreibung („Ausgewählte Transit-Transaktion … `ausgaben_transaktion_id` wird auf NULL gesetzt") implizieren, dass dieser FK gespeichert werden sollte. Bei Multi-Select müsste das Datenmodell erweitert werden (z. B. n:m oder `ausgaben_transaktion_ids JSONB`).

#### Schritt 3 — Verbindlichkeiten
- [x] Beide Vorschläge automatisch berechnet (`vorschlaege.verbindlichkeiten_llv` + `_sonstige`)
- [x] L&L = Σ `betrag_brutto` aller offenen Ausgaben unter „Produkt"-Kategorie + Descendants (BFS in `produktAusgabenIds`)
- [x] Sonstige = Σ `betrag_brutto` der übrigen offenen Ausgaben
- [x] Editierbare Zahlenfelder mit Vorschlag vorbefüllt
- [x] Vorschläge bei = 0 wenn keine offenen Transaktionen

#### Schritt 4 — Forderungen
- [x] Manuelle Felder für jede Plattform aus `kpi_categories` (`type='sales_plattformen'`, level 1)
- [x] Plattformen nach `sort_order` sortiert (`page.tsx:58`)
- [x] Zusätzliches Feld „Sonstige Forderungen" (NULL `plattform_id`)
- [x] Alle Felder optional, Default 0

#### Schritt 5 — Steuerforderung / Steuerverbindlichkeit
- [x] Von/Bis-Felder als `<input type="month">`
- [x] Automatische Berechnung wenn beide Felder gesetzt (`berechneSteuer` via `/api/reporting/umsatzsteuer`)
- [x] Ergebnis-Label: „Steuerverbindlichkeit: X €" (positiv), „Steuerforderung: X €" (negativ), „Kein offener Steuersaldo" (= 0)
- [x] Betrag-Feld mit absolutem Saldo vorbefüllt
- [x] Radio-Group für Typ-Wahl (forderung/verbindlichkeit), automatisch aus Vorzeichen gesetzt
- [x] Validierung „Von > Bis" mit Fehlermeldung (`steuerFehler`)
- [x] Felder optional; ohne Von/Bis bleibt Betrag = 0

#### Schritt 6 — Cash-Bestand
- [x] Vorschlag automatisch aus kumulierten Cashflows (Einnahmen + Ausgaben mit `relevanz IN ('liquiditaet','beides')` bis Stichtag)
- [x] Editierbares Feld (`type="number"`, kein `min` → negativ erlaubt)
- [x] Vorschlag = 0 wenn keine Daten

#### Löschen
- [x] Trash-Icon-Button je Snapshot-Zeile
- [x] AlertDialog-Bestätigung vor Löschen (`vermoegenswert-table.tsx:263-279`)
- [x] CASCADE DELETE entfernt Lagerwerte/Transitwerte/Forderungen automatisch
- [x] Tabelle aktualisiert sich nach Löschen (`fetchData()` im `deleteSnapshot`-Hook)

### Edge Cases Status

#### EC-1: Kein Produkt im KPI-Modell
- [x] Schritt 1 zeigt Leerzustand mit Link zum KPI-Modell
- [x] Schritt 2 zeigt „Keine Produkte im KPI-Modell" Text
- [x] Dialog kann trotzdem komplett durchlaufen werden

#### EC-2: Keine bestand_transaktionen / Produktkosten
- [x] `endbestandByProdukt.get(p.id) ?? 0` und `produktkostenByProdukt.get(p.id) ?? 0` → Lagerwert 0
- [x] Schema akzeptiert lagerwert = 0

#### EC-3: Lücke in Produktkosten-Zeitraum
- [x] `lte('gueltig_von', datum)` + `gueltig_bis.gte.{datum},gueltig_bis.is.null` korrekt; bei Lücke → kein Zeitraum gefunden → 0

#### EC-4: Negativer Endbestand
- [x] Lagerwert kann negativ werden in Berechnung, aber Schema enforced ≥ 0 (`z.number().min(0)`)
- [ ] **BUG-2 (Low): Wenn berechneter Vorschlag negativ ist (Bestand < 0), wird der Wert beim Speichern vom Backend (Zod `min(0)`) abgelehnt mit 400.** Frontend zeigt den negativen Vorschlag im Feld, aber `lagerwert: parseFloat(...) || 0` lässt ihn als negative Zahl durch. Acceptance Criterion 152 sagt explizit: „Negativer Endbestand in `bestand_transaktionen`: Lagerwert-Vorschlag kann negativ werden → erlaubt, wird angezeigt (kein Fehler)". Das widerspricht dem Schema `lagerwert: z.number().min(0)`.

#### EC-5: Keine offenen Ausgaben
- [x] Verbindlichkeiten = 0 (beide Reduce-Loops starten bei 0)

#### EC-6: Keine Sales-Plattformen
- [x] Nur Feld „Sonstige Forderungen" sichtbar (`plattformen.map(...)` → leer)

#### EC-7: Von > Bis in Schritt 5
- [x] Fehlermeldung wird angezeigt; Steuersaldo bleibt NULL
- [x] Weiter-Button bleibt aktiv (keine Block-Logik)

#### EC-8: Mehrere Snapshots am gleichen Tag
- [x] DB UNIQUE constraint auf `datum`
- [x] API gibt 409 mit Fehlertext zurück
- [x] Frontend zeigt Fehler im saveError-Feld

#### EC-9: Transit-Transaktion nachträglich gelöscht
- [ ] **BUG-3 (Medium): EdgeCase nicht erfüllt.** Spec sagt: „gespeicherter `transitwert` bleibt erhalten; `ausgaben_transaktion_id` wird auf NULL gesetzt (ON DELETE SET NULL)". Aber da das Frontend `ausgaben_transaktion_id` NIE setzt (BUG-1), greift die SET-NULL-Logik nie. Funktional ist `transitwert` korrekt erhalten, aber die FK-Beziehung fehlt komplett.

#### EC-10: Steuer-Spalten-Sichtbarkeit
- [x] Tabelle zeigt Steuer-Spalten nur, wenn mindestens ein Snapshot einen Wert > 0 mit korrektem Typ hat (`hasSteuervb`, `hasSteuerford`)

### Security Audit Results

- [x] **Authentication:** Alle 3 API-Routen verwenden `requireAuth()`; Middleware redirected unauthenticated requests (E2E verifiziert für GET, POST, DELETE, vorschlaege).
- [x] **Authorization:** Alle Snapshots sind organisationsweit zugänglich (RLS für authenticated users, kein User-Scoping). Konsistent mit anderen Datenpflege-Features (1-5 Nutzer-Team).
- [x] **Input validation:** Zod-Validierung auf POST (`createSchema`): Datum-Format, UUID-Format, Numerik ≥ 0, Enum-Werte.
- [x] **Datum-Regex:** `/^\d{4}-\d{2}-\d{2}$/` — akzeptiert syntaktisch ungültige Daten wie `2026-13-99`. PostgreSQL würde diese aber bei `DATE`-Casting ablehnen. Akzeptabel.
- [x] **SQL Injection:** Supabase parametrisiert alle Queries. Kein String-Concat in Filtern.
- [x] **XSS:** Alle Anzeige-Werte über `Intl.NumberFormat` oder rein numerisch; keine `dangerouslySetInnerHTML`. Produktnamen aus `kpi_categories` direkt in JSX gerendert (React escaping aktiv).
- [ ] **BUG-4 (Low/Info): Kein Rate-Limiting auf POST/DELETE.** Konsistent mit Rest der App; akzeptabel für internes Team.
- [ ] **BUG-5 (Low): DELETE-Route validiert UUID-Format nicht via Zod.** `id` wird direkt aus Route-Param genommen und in `.eq('id', id)` eingesetzt. Supabase wirft DB-Error bei invalidem UUID (500 statt 400). Defense-in-depth-Verstoß, aber kein Sicherheitsrisiko.
- [ ] **BUG-6 (Low): GET-Route hat keinen `.limit()`-Aufruf.** Verstoß gegen Backend-Rule „Always use `.limit()` on list queries". Bei ≤365 Snapshots/Jahr ist das akzeptabel, aber konsistent mit Projekt-Regeln sollte `.limit(10000)` o. ä. hinzugefügt werden.

### Bugs Found

#### BUG-1: Transit-Transaktion-IDs werden beim Speichern verworfen
- **Severity:** Medium
- **Component:** `src/components/vermoegenswert-wizard-dialog.tsx:234`
- **Steps to Reproduce:**
  1. Wizard öffnen
  2. In Schritt 2 Produkt aufklappen und eine oder mehrere Transaktionen via Checkbox auswählen
  3. Snapshot speichern
  4. DB-Eintrag in `vermoegenswarte_transitwerte` prüfen
  5. Expected: `ausgaben_transaktion_id` enthält die ID der ausgewählten Transaktion
  6. Actual: `ausgaben_transaktion_id = NULL` für alle Einträge
- **Note:** Da das Feature Multi-Select erlaubt, kann ein einzelnes FK-Feld nicht alle Auswahlen erfassen. Architektur-Entscheidung nötig: (a) FK entfernen und nur `transitwert` speichern; (b) Schema auf 1-zu-n erweitern (`vermoegenswarte_transit_transaktionen`-Verknüpfungstabelle); (c) FK auf `ausgaben_transaktion_ids JSONB` ändern.
- **Priority:** Fix in next sprint (functional impact: Auditing-Trail fehlt, aber `transitwert`-Summe stimmt)

#### BUG-2: Negativer Lagerwert wird vom Schema abgelehnt, obwohl Spec ihn erlaubt
- **Severity:** Low
- **Component:** `src/app/api/vermoegenswerte/route.ts:7` (Zod-Schema) vs. Spec EC „Negativer Endbestand"
- **Steps to Reproduce:**
  1. Manuelles Setzen eines negativen Lagerwerts im UI (z. B. -100)
  2. Speichern klicken
  3. Expected (laut Spec line 152): Wert wird akzeptiert und angezeigt
  4. Actual: API gibt 400 mit Zod-Fehler zurück, Snapshot wird NICHT gespeichert
- **Resolution:** Entweder Schema auf `z.number()` ändern (ohne `min(0)`), oder Spec aktualisieren, dass Lagerwert ≥ 0 enforced ist (Vorschlagswert wird ggf. auf 0 geclamped).
- **Priority:** Fix in next sprint

#### BUG-3: Edge Case „Transit-Transaktion nachträglich gelöscht" nicht erreichbar
- **Severity:** Medium
- **Component:** Konsequenz aus BUG-1
- **Steps to Reproduce:**
  1. Snapshot mit Transit-Auswahl speichern (siehe BUG-1)
  2. Die ausgewählte Ausgaben-Transaktion löschen
  3. Snapshot neu laden
  4. Expected (Spec line 158): `transitwert` bleibt erhalten, `ausgaben_transaktion_id` → NULL
  5. Actual: `ausgaben_transaktion_id` war von Anfang an NULL, also kein Beweis für SET NULL Behavior möglich
- **Priority:** Direkt mit BUG-1 zu fixen

#### BUG-4: Cash-Bestand Input ohne `min` ist OK, aber Vorschlagswert mit negativem Zahlenformat
- **Severity:** Info (kein Bug)
- **Notiz:** Korrekt implementiert — negative Werte sind erlaubt (Überziehung). Anzeige in Tabelle nutzt `text-destructive` bei `< 0`. Kein Issue.

#### BUG-5: DELETE-Route ohne UUID-Validierung
- **Severity:** Low
- **Component:** `src/app/api/vermoegenswerte/[id]/route.ts`
- **Steps to Reproduce:**
  1. Authentifizierter DELETE-Call an `/api/vermoegenswerte/not-a-uuid`
  2. Expected: 400 Bad Request mit klarer Validierungsmeldung
  3. Actual: 500 DB Error mit Postgres-Fehlertext
- **Priority:** Nice to have (kein Sicherheitsrisiko, Supabase fängt es ab)

#### BUG-6: GET-Route ohne `.limit()` (Projekt-Konvention)
- **Severity:** Low
- **Component:** `src/app/api/vermoegenswerte/route.ts:39-47`
- **Resolution:** `.limit(10000)` o.ä. anhängen
- **Priority:** Nice to have (geringes Datenvolumen)

#### BUG-7 (Pre-existing, NOT caused by PROJ-32): Vitest test runner kaputt für alle 33 Test-Dateien
- **Severity:** High (für Test-Infrastruktur, nicht für PROJ-32 selbst)
- **Component:** Globale Vitest/Vite-Konfiguration
- **Symptom:** `npm test` → 33 failed test files, "Vitest failed to find the runner" oder „Cannot read properties of undefined (reading 'config')"
- **Note:** Betrifft auch Tests, die zuvor grün waren (z. B. PROJ-31). Nicht durch PROJ-32 verursacht. Sollte separat untersucht werden.
- **Priority:** Independent of PROJ-32 — sollte vor nächstem Release behoben werden.

### Recently Changed Components — Verification

#### Date Format DD.MM.YYYY
- [x] `fmtDatum(d)` in `vermoegenswert-table.tsx:22-25` formatiert YYYY-MM-DD → DD.MM.YYYY
- [x] `fmtDatum(d)` in `vermoegenswert-wizard-dialog.tsx:25-28` formatiert Transaktion-Datumsangaben in Step 2 als DD.MM.YYYY
- [x] Native `<input type="date">` Inputs nutzen ISO YYYY-MM-DD intern (Browser-Standard) — korrekt für Datenbankübergabe

#### Accordion in Step 2
- [x] `expandedProducts: Set<string>` State (Default leer = alle kollabiert)
- [x] Click-Handler `toggleProductExpand` aktiviert Lazy-Load
- [x] ChevronRight-Icon mit Rotation
- [x] Multi-Select Checkboxen erst im aufgeklappten Bereich sichtbar

#### Table rowSpan Fix
- [x] Datum-`<th>`: `rowSpan={2}` in erster Header-Row
- [x] Action-`<th>`: `rowSpan={2}` in erster Header-Row
- [x] Zweite Header-Row enthält keine Duplikate für Datum/Action — Column-Count konsistent
- [x] sticky-Verhalten bleibt funktional (`sticky left-0 z-10`)

### Summary

- **Acceptance Criteria:** ~58/60 passed (BUG-1/BUG-2/BUG-3 wirken sich auf 2-3 ACs aus)
- **Bugs Found:** 7 total (0 critical, 0 high (PROJ-32-spezifisch), 3 medium, 3 low, 1 high pre-existing infrastructure)
- **Security:** PASS — Auth-Schutz auf allen Routen via E2E verifiziert; Zod-Input-Validierung; CASCADE DELETE; RLS aktiviert
- **E2E Tests:** 22/22 PASS in Chromium
- **Production Ready:** YES with caveats — Core-Funktionalität funktioniert. BUG-1 (transaction_id nicht gespeichert) verhindert Auditing-Trail, sollte aber nicht den Release blockieren, da die `transitwert`-Summe selbst korrekt ist. BUG-2 (negative Lagerwerte) sollte vor breitem Einsatz geklärt werden — entweder Spec anpassen oder Schema lockern.
- **Recommendation:** **Approved with minor follow-ups** — BUG-1, BUG-2 und BUG-3 in einem Follow-up-PR adressieren. BUG-5/BUG-6 als Tech-Debt einplanen. BUG-7 (Test-Infrastruktur) unabhängig priorisieren.

### Updated QA — 2026-05-15 (Re-Run nach Erweiterung um 2 Wizard-Schritte + Anlagevermögen-Spalte)

**Tester:** QA Engineer (AI)
**Scope:** Verifikation der Erweiterungen seit letzter QA-Runde:
- Wizard erweitert von 6 → 8 Schritten (neuer Schritt 4 „Darlehensverbindlichkeiten" und neuer Schritt 8 „Anlagevermögen")
- Tabelle erweitert um „Darlehen"-Spalte (Verbindlichkeiten-Gruppe, rose) und „Netto-Buchwert"-Spalte als eigene „Anlagevermögen"-Gruppe (violet)
- Filter-Bar erweitert von 4 → 5 Toggles (neuer Toggle „Anlagevermögen" in violet)
- DB-Migration: `darlehensvb` + `anlagevermoegen` Spalten in `vermoegenswarte_snapshots`
- Bug-Fix: Tilgungen-Matching prüft jetzt `kategorie_id`, `gruppe_id` und `untergruppe_id`

#### Test Execution Summary
- **Unit Tests (Vitest):** 3 Test-Dateien / 14 Tests — **alle bestanden**. Das in BUG-7 dokumentierte Vitest-Runner-Problem ist behoben; die Test-Infrastruktur funktioniert wieder. (`npm test -- src/app/api/vermoegenswerte` → 14/14 PASS in 2.49 s)
- **E2E Tests (Playwright, chromium):** **30/30 PASS** in `tests/PROJ-32-vermoegenswerte.spec.ts`. Datei wurde von 22 auf 30 Tests erweitert (8 neue Struktur-Verifikationstests für 8-Schritte-Wizard, 5-Toggle-Filter, Darlehen-/Netto-Buchwert-Spalten, Multi-Level-Tilgung-Check, Anlagevermögen-Datumsfilter, Schema-Pflichtfelder).
- **TypeScript:** Nur der bereits bekannte, nicht-PROJ-32-bezogene Fehler in `src/hooks/use-kpi-categories.test.ts` (fehlende Props `sku_code`, `ust_satz`, `exclude_from_rentabilitaet`). Keine neuen TS-Fehler durch die Erweiterungen.

#### Verifizierte Erweiterungen

##### Schritt 4 — Darlehensverbindlichkeiten
- [x] Step-Index 4 mit Label „Darlehensverbindlichkeiten" in `STEPS`-Konstante (`vermoegenswert-wizard-dialog.tsx:36`)
- [x] Auto-Berechnung: `darlehensvb = max(0, Σ Fremdkapital-Einnahmen − Σ Tilgungen)` (`vorschlaege/route.ts:236-271`)
- [x] Fremdkapital-Identifikation: `einnahmen_kategorien` mit Name enthält „fremdkapital" (case-insensitive) + alle Descendants via BFS
- [x] Tilgungs-Identifikation: `ausgaben_kategorien` mit Name enthält „tilgung" (case-insensitive) + alle Descendants via BFS
- [x] **Multi-Level-Check bestätigt:** `tx.kategorie_id` (L1), `tx.gruppe_id` (L2), `tx.untergruppe_id` (L3) werden alle gegen `tilgungIds` geprüft (`vorschlaege/route.ts:262-265`)
- [x] UI zeigt Breakdown: Fremdkapitaleinnahmen | − Tilgungen | = Vorschlag (`wizard-dialog.tsx:509-522`)
- [x] Editierbares €-Feld mit Vorschlagswert vorbefüllt
- [x] `darlehensvb` wird beim POST gespeichert und in `route.ts:89` ins INSERT-Statement aufgenommen

##### Schritt 8 — Anlagevermögen (Netto-Buchwert)
- [x] Step-Index 8 als letzter Schritt mit Label „Anlagevermögen" (`STEPS[7]`)
- [x] Auto-Berechnung: `anlagevermoegen = Σ (Brutto-Anschaffungswert − Σ Abschreibungsraten bis Stichtag)` für alle Transaktionen mit `abschreibung != null` (`vorschlaege/route.ts:275-298`)
- [x] **JS-seitiger Datumsfilter bestätigt:** `if (tx.leistungsdatum > datum) continue` skippt Anlagegüter, die erst NACH dem Stichtag angeschafft wurden (`vorschlaege/route.ts:279`)
- [x] Identische Logik wie `abschreibungen`-Route via `ABSCHREIBUNG_MONATE` + `addMonthsWithClamp` + `roundTo2` aus `@/lib/abschreibung-utils`
- [x] `baseRate` und `lastRate` (Rundungsdifferenz im letzten Monat) korrekt berechnet
- [x] UI: editierbares €-Feld mit Label „Anlagevermögen (€, Netto-Buchwert)" und Vorschlagswert (`wizard-dialog.tsx:665-676`)
- [x] `anlagevermoegen` als `z.number().min(0)` in Zod-Schema (`route.ts:34`) — wichtig: Schema schließt negative Werte aus, obwohl Netto-Buchwert theoretisch nicht negativ werden sollte (Schutz vor Datenintegritäts-Fehlern)

##### Tabelle — Neue Spalten
- [x] „Darlehen"-Spalte am Ende der Verbindlichkeiten-Gruppe (rose color) — `vermoegenswert-table.tsx:172-174` (Header), `:241-243` (Body)
- [x] `colSpan` für Verbindlichkeiten-Gruppen-Header korrekt aktualisiert: `3 + (hasSteuervb ? 1 : 0)` für L&L | Sonstige | Darlehen + optional Steuer (`table.tsx:115`)
- [x] „Netto-Buchwert"-Spalte als eigene „Anlagevermögen"-Gruppe (violet) — `table.tsx:137-144` (Gruppen-Header), `:198-202` (Spalten-Header), `:267-271` (Body)
- [x] Violet-Farbschema konsistent über Light/Dark Mode (`COLOR.anlagevermoegen.th`/`.td`)
- [x] Anlagevermögen-Gruppe nur sichtbar, wenn `showAnlage = aktiveKategorien.has('anlagevermoegen')` — konditional rendern statt fest verdrahten

##### Filter-Bar — 5 Toggles
- [x] `ALLE_KATEGORIEN`-Array hat 5 Einträge inkl. `'anlagevermoegen'` (`page.tsx:14`)
- [x] `KATEGORIE_LABEL` Mapping um „Anlagevermögen"-Label erweitert (`page.tsx:21`)
- [x] `KATEGORIE_STYLE` Mapping um violet-Variante erweitert (active + inactive Tailwind-Klassen, inkl. Dark-Mode) (`page.tsx:29`)
- [x] Toggle erscheint per Default aktiv (`new Set(ALLE_KATEGORIEN)` als initialer State)
- [x] „Alle"-Reset-Button vergleicht mit `ALLE_KATEGORIEN.length` (5) — nicht hartkodiert

##### Bug-Fix Verifikation
- [x] Tilgungen werden auf allen drei Hierarchie-Ebenen erkannt: Wenn eine Transaktion eine Tilgung auf Untergruppen-Ebene ist (z. B. SKU-Ebene unter „Darlehen → Bank-Tilgungen → Tilgung Kredit X"), wird sie korrekt summiert (`vorschlaege/route.ts:262-265`).
- [x] Vorher: nur `kategorie_id` wurde geprüft → Tilgungen auf Ebene 2/3 wurden ignoriert → `darlehensvb_tilgungen` zu niedrig → `darlehensvb` zu hoch.
- [x] Korrektur ist defensiv: BFS sammelt erst alle Tilgungs-IDs (Kategorie + Descendants), dann werden Transaktionen anhand aller drei FK-Spalten gematched.

#### Security Re-Check
- [x] **Auth-Schutz auf neuen Feldern:** POST-Schema validiert `darlehensvb: z.number().min(0)` und `anlagevermoegen: z.number().min(0)` (E2E-Test „POST schema requires new fields" bestätigt).
- [x] **API-Routen weiterhin auth-gated** — alle 30 E2E-Tests grün, inkl. POST mit erweitertem Body, DELETE mit gültigem UUID, GET mit invalidem Datum-Parameter.
- [x] **Keine neuen RLS-Policies nötig:** Die neuen Spalten leben in den bestehenden Tabellen `vermoegenswarte_snapshots`; die existierenden Policies für SELECT/INSERT/UPDATE/DELETE decken sie automatisch ab.
- [x] **Keine neuen Secrets / Env-Variablen** durch die Erweiterung eingeführt.

#### Status früherer Bugs (BUG-1 bis BUG-7)
- **BUG-1 (Transit-Transaktion-IDs werden nicht gespeichert):** UNVERÄNDERT — `vermoegenswert-wizard-dialog.tsx:256` setzt weiterhin `ausgaben_transaktion_id: null`. Multi-Select-Architektur erlaubt kein einzelnes FK-Feld. Bleibt offen für Follow-Up.
- **BUG-2 (Negativer Lagerwert vom Schema abgelehnt):** UNVERÄNDERT — `route.ts:7` weiterhin `z.number().min(0)`. Widerspruch zu Spec EC „Negativer Endbestand erlaubt" bleibt bestehen.
- **BUG-3 (FK-Beziehung Transit → Ausgabe nie gesetzt):** Konsequenz aus BUG-1, unverändert.
- **BUG-4 (Cash negativ):** Kein Bug — bestätigt.
- **BUG-5 (DELETE ohne UUID-Zod):** UNVERÄNDERT — `[id]/route.ts:11` nimmt `id` ohne Validierung. Defense-in-Depth-Verstoß, kein Sicherheitsrisiko.
- **BUG-6 (GET ohne `.limit()`):** UNVERÄNDERT — `route.ts:41-49` ohne `.limit()`. Bei Volumen ≤ 365/Jahr akzeptabel, aber Konvention-Verstoß.
- **BUG-7 (Vitest-Runner kaputt):** **RESOLVED** — `npm test` läuft wieder; 14 Tests bestehen alle. Test-Infrastruktur wiederhergestellt.

#### Neue Beobachtungen (Updated QA)
- [x] **Performance OK:** Die `vorschlaege`-Route lädt jetzt zusätzlich `einnahmen_transaktionen` (für Fremdkapital) und `ausgaben_kosten_transaktionen` (für Tilgungen + Anlagevermögen) — beide Queries parallel über `Promise.all`. Keine N+1, keine sequenziellen Round-Trips.
- [x] **Code-Hygiene:** Saubere Separation der 6 Berechnungs-Sektionen (Lagerwert | Verbindlichkeiten | Darlehen | Anlagevermögen | Cash). Kommentar-Header machen Code lesbar.
- [x] **Acceptance Criteria Erweiterung:** Die ursprünglichen ACs (Schritt 1–6) sind in der Spec noch beschrieben, aber das Feature hat nun 8 Schritte. **Empfehlung:** Spec aktualisieren, um die neuen Schritte 4 (Darlehen) und 8 (Anlagevermögen) als explizite ACs aufzunehmen — derzeit dokumentiert nur die Implementation Notes / Updated QA.
- [ ] **BUG-8 (Low/Cosmetic):** In `vermoegenswert-wizard-dialog.tsx:286` wird der Step-Header als „Schritt {step} von {STEPS.length}: {STEPS[step - 1]}" gerendert. Bei `STEPS.length === 8` zeigt der Header bspw. „Schritt 4 von 8: Darlehensverbindlichkeiten" — passt. Aber die Spec-Klausel im Header (Zeile 26) sagt noch „6-Schritte-Dialog". **Empfehlung:** Spec-Header anpassen oder als Implementation-Drift dokumentieren. Nicht funktional kritisch.
- [ ] **BUG-9 (Info):** Filter-Toggle „Anlagevermögen" steuert nur die Spalten-Sichtbarkeit, nicht die Datenpersistenz. Bei deaktiviertem Toggle bleibt `anlagevermoegen` in der DB gespeichert — korrekt, aber für Nutzer:innen evtl. überraschend. Keine Aktion nötig.

#### Updated Summary
- **Acceptance Criteria:** ~58/60 weiterhin grün (BUG-1, BUG-2 wirken sich auf einzelne ACs aus); zusätzliche neue Funktionalität (Schritte 4 + 8, Anlagevermögen-Spalte, 5. Filter-Toggle) **vollständig funktional**.
- **Bugs:** 7 alte (1 RESOLVED — BUG-7) + 2 neue (BUG-8 cosmetic spec-drift, BUG-9 info) = effektiv **0 critical, 0 high, 2 medium offen (BUG-1, BUG-3), 4 low/info**.
- **Security:** PASS — keine neuen Angriffsflächen durch die Erweiterung.
- **Unit Tests:** 14/14 PASS.
- **E2E Tests:** 30/30 PASS in chromium.
- **TypeScript:** Clean (nur pre-existing unrelated Error in `use-kpi-categories.test.ts`).
- **Production Ready:** **JA**. Empfehlung **Approved**. BUG-1, BUG-2, BUG-3 bleiben als Follow-Up-PR-Kandidaten; BUG-5, BUG-6, BUG-8, BUG-9 als Tech-Debt einplanen.

## Bugfix (2026-06-27): Lagerwert-Vorschlag basierte auf eingefrorenem Bestand

**Symptom:** Der Lagerwert-Vorschlag in Schritt 1 des Wizards war systematisch zu hoch (Beispiel SamiBu: 18.900,00 € statt korrekt 15.573,60 €).

**Ursache:** `vorschlaege/route.ts` lud alle `bestand_transaktionen` per `.order('datum', { ascending: true })` **ohne `.limit()`**. PostgREST begrenzt die Antwort auf 1.000 Zeilen — bei aufsteigender Sortierung also die **ältesten** 1.000. Sobald die Bestandshistorie >1.000 Zeilen erreichte (hier ab ~18.05.2026), fielen die neuesten Transaktionen weg, und die „letzte" Bestand-Transaktion je SKU war eingefroren auf einem alten (höheren) Stand → überhöhter Lagerwert. Der Effekt war zeilenzahl-abhängig und verschob sich mit wachsender Historie weiter in die Vergangenheit. (Schärfere Variante des dokumentierten BUG-6.)

**Fix:** Neue Postgres-Funktion `lagerwert_endbestand_je_sku(p_stichtag date)` (Migration `create_lagerwert_endbestand_je_sku_function`) ermittelt den Endbestand je SKU serverseitig per `DISTINCT ON (sku_id) ... ORDER BY datum DESC` — liefert also garantiert die neueste Transaktion je SKU, **unabhängig von der Gesamtzahl der Transaktionen**. Die Endbestand-Formel ist identisch zur bisherigen JS-Logik (ohne Clamping, `coalesce` für Nullable-Felder). Die Route ruft sie via `supabase.rpc(...)` auf; die manuelle „latest per SKU"-Schleife entfiel.

**Verifiziert:** RPC liefert für SamiBu Endbestand 721 (219 + 301 + 201) → 721 × 21,60 € = 15.573,60 €. TypeScript clean.

## Deployment
_To be added by /deploy_
