# PROJ-47: Retoureneinstellungen — Kurzfristige Planung

## Status: In Progress
**Created:** 2026-06-02
**Last Updated:** 2026-06-02

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Sales-Plattformen (`kpi_categories` mit `type = 'sales_plattformen'`) und Produkte (`kpi_categories` mit `type = 'produkte'`, `level = 1`) müssen bereits gepflegt sein
- Requires: PROJ-42 (Absatzeinstellungen) — der Bereich „Kurzfristige Planung" inkl. linker Navigation und Dashboard-Kachelseite ist bereits aufgebaut; diese Seite ergänzt ihn um eine weitere Kachel und einen weiteren Nav-Eintrag

## Übersicht

Auf der Seite „Retoureneinstellungen" pflegt der Nutzer für jede Kombination aus **Sales-Plattform** und **Produkt** drei produktspezifische Werte: die Berechnungsart der Retourenquote (Dropdown), die Rückversandkosten (netto) und die Retourenhandling-Kosten (netto). Zusätzlich gibt es je Plattform-Tab einen Plattform-Einstellungen-Bereich oberhalb der Tabelle mit vier Feldern: Gruppierung, Nächste Zahlungswoche (intelligente KW-Berechnung identisch zu PROJ-46), Zahlungsziel (Tage) sowie die Erstattung der Verkaufsgebühr in Prozent (plattformweit, nicht pro Produkt).

Die Seite ist Teil des Bereichs „Kurzfristige Planung", über die linke Navigation erreichbar und als Kachel auf der Dashboard-Übersichtsseite verlinkt.

## User Stories

- Als Nutzer möchte ich die Seite „Retoureneinstellungen" über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können, damit ich schnell dorthin gelange.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite von „Kurzfristige Planung" eine Kachel „Retoureneinstellungen" sehen, damit ich von dort direkt auf die Seite wechseln kann.
- Als Nutzer möchte ich alle im KPI-Modell gepflegten Sales-Plattformen als Reiter oben auf der Seite sehen, damit ich die Retoureneinstellungen plattformspezifisch pflegen kann.
- Als Nutzer möchte ich je Reiter alle im KPI-Modell gepflegten Produkte als Zeilen in einer Tabelle sehen, damit ich pro Produkt die Retourendaten eintragen kann.
- Als Nutzer möchte ich pro Produkt und Plattform die Berechnungsart der Retourenquote aus einem Dropdown wählen können (Mittelwert 14, 30, 60, 90 Tage oder Keine), damit die Retourenquote korrekt berechnet wird.
- Als Nutzer möchte ich pro Produkt und Plattform die Rückversandkosten (netto) in Euro eingeben können, damit die anfallenden Retourenkosten vollständig erfasst sind.
- Als Nutzer möchte ich pro Produkt und Plattform die Retourenhandling-Kosten (netto) in Euro eingeben können, damit alle Kosten rund um die Retourenbearbeitung abgebildet sind.
- Als Nutzer möchte ich pro Plattform die Erstattung der Verkaufsgebühr in Prozent eingeben können (nicht pro Produkt), damit ich den plattformweiten Erstattungssatz hinterlegen kann.
- Als Nutzer möchte ich pro Plattform eine Gruppierung (Zeitraum-Granularität) festlegen können, damit ich die zeitliche Auswertung kontrollieren kann.
- Als Nutzer möchte ich pro Plattform die nächste Zahlungswoche über einen Calendar-Picker eingeben können, der automatisch die nächste zukünftige Woche auf Basis des gespeicherten Ankers und eines Rhythmus berechnet, damit ich keine manuelle Pflege nach jeder Zahlung brauche.
- Als Nutzer möchte ich pro Plattform ein Zahlungsziel in Tagen eintragen können, damit Zahlungsfristen für Retourenabwickler hinterlegt sind.
- Als Nutzer möchte ich, dass meine eingetragenen Werte gespeichert werden und beim nächsten Aufruf noch vorhanden sind.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag „Retoureneinstellungen" → `/dashboard/kurzfristige-planung/retouren-einstellungen`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Retoureneinstellungen", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Reiter-Navigation

- [ ] Oben auf der Seite werden alle Einträge aus `kpi_categories` mit `type = 'sales_plattformen'` als Tabs dargestellt (sortiert nach `sort_order`)
- [ ] Beim ersten Laden ist der erste Reiter automatisch aktiv
- [ ] Gibt es keine Sales-Plattformen im KPI-Modell, erscheint ein Hinweis: „Noch keine Sales-Plattformen gepflegt. Bitte zuerst im KPI-Modell Sales-Plattformen anlegen." (mit Link zur KPI-Modell-Seite)
- [ ] Sehr viele Plattformen (>5): Reiter-Leiste wird scrollbar (overflow-x: auto)

### Plattform-Einstellungen (oberhalb der Tabelle, pro Plattform-Tab)

Oberhalb der Produkttabelle werden je Plattform-Tab vier Einstellungszeilen angezeigt:

#### Zeile 1: Gruppierung

- [ ] Beschriftung: „Gruppierung"
- [ ] Eingabeelement: Dropdown (shadcn `Select`)
- [ ] Optionen (in dieser Reihenfolge): „Wöchentlich", „Monatlich", „Quartalsweise"
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: „Monatlich"
- [ ] Auto-Save bei `onChange` (kein separater „Speichern"-Button)
- [ ] Einstellung ist pro Plattform unabhängig gespeichert

#### Zeile 2: Nächste Zahlungswoche

- [ ] Beschriftung: „Nächste Zahlungswoche"
- [ ] Eingabeelement: Calendar-Picker-Button (shadcn `Popover` + `Calendar`) — identische UI wie bei PROJ-45 und PROJ-46
- [ ] Das Feld zeigt **nicht** den gespeicherten Basiswert, sondern die **berechnete nächste zukünftige Zahlungswoche**
- [ ] Unter dem Button wird die berechnete KW als Subtitle angezeigt (z. B. „KW 26 / 2026")
- [ ] Nutzer klickt den Button → Kalender öffnet sich; der Kalender zeigt Wochennummern an
- [ ] Nutzer wählt eine Woche → neuer Wert wird als Basis gespeichert; Kalender schließt sich; Display-KW wird neu berechnet
- [ ] „Auswahl löschen"-Button im Kalender setzt `basis_kw = null` und `basis_jahr = null`; Button zeigt Default-Text
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: Button leer (kein KW-Wert angezeigt)

#### Zeile 3: Zahlungsziel

- [ ] Beschriftung: „Zahlungsziel (Tage)"
- [ ] Eingabeelement: `<Input type="number">`, min=0, ganzzahlig
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: leer
- [ ] Auto-Save per `onBlur`
- [ ] Einstellung ist pro Plattform unabhängig gespeichert

#### Zeile 4: Erstattung Verkaufsgebühr

- [ ] Beschriftung: „Erstattung Verkaufsgebühr (%)"
- [ ] Eingabeelement: `<Input type="number">`, min=0, max=100, step=0.01, Dezimalzahl
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: leer
- [ ] Auto-Save per `onBlur`
- [ ] Einstellung ist pro Plattform unabhängig gespeichert (kein Produktbezug)
- [ ] Gültige Werte: 0–100 % (z. B. `50.00` für 50 %)

### Berechnungslogik „Nächste Zahlungswoche"

Die angezeigte Zahlungswoche wird **bei jedem Seitenaufruf im Frontend dynamisch berechnet** — der DB-Wert ändert sich dabei nicht automatisch.

**Algorithmus (identisch zu PROJ-45 und PROJ-46 `calculateNextPayoutWeek`):**

1. Lies `basis_kw` und `basis_jahr` aus der DB
2. Ermittle die aktuelle Kalenderwoche und das aktuelle Jahr via ISO-Wochenberechnung
3. Starte mit `display_kw = basis_kw`, `display_jahr = basis_jahr`
4. Solange `(display_jahr, display_kw) < (aktuelles_jahr, aktuelle_kw)`:
   - Addiere den Rhythmus (entsprechend der Gruppierung: Wöchentlich = 1, Monatlich = 4, Quartalsweise = 13) zur Wochennummer
   - Falls `display_kw` die Anzahl der ISO-Wochen im Jahr überschreitet: Jahresübertrag
5. Zeige berechnete KW als Subtitle an

> ISO-Wochen (Montag = erster Tag). Die `calculateNextPayoutWeek`-Utility aus PROJ-45 kann direkt wiederverwendet werden.

### Produkttabelle (pro Plattform-Tab)

- [ ] Unterhalb des Plattform-Einstellungs-Bereichs wird eine Tabelle mit einer Zeile pro Produkt angezeigt (`kpi_categories` mit `type = 'produkte'`, `level = 1`, sortiert nach `sort_order`)
- [ ] Tabellenspalten:
  - **Produkt** (Name des Produkts — read-only)
  - **Berechnungsart Retourenquote** (Dropdown — editierbar, Auto-Save bei `onChange`)
  - **Rückversandkosten (€ netto)** (Dezimalzahl-Eingabefeld, editierbar, min=0, step=0.01)
  - **Retourenhandling-Kosten (€ netto)** (Dezimalzahl-Eingabefeld, editierbar, min=0, step=0.01)
- [ ] Gibt es keine Produkte, erscheint ein Hinweis: „Noch keine Produkte gepflegt. Bitte zuerst im KPI-Modell Produkte anlegen." (mit Link zur KPI-Modell-Seite)

### Berechnungsart-Dropdown (Produkttabelle)

- [ ] Optionen (in dieser Reihenfolge):
  - „Keine"
  - „Mittelwert 14 Tage"
  - „Mittelwert 30 Tage"
  - „Mittelwert 60 Tage"
  - „Mittelwert 90 Tage"
- [ ] Standardwert bei noch nie gespeicherten Kombinationen: „Keine"
- [ ] Änderungen werden automatisch gespeichert (Auto-Save bei `onChange`)
- [ ] Optimistische Updates: Auswahl erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung, Rollback auf vorherigen Wert

### Kostenfelder (Rückversandkosten & Retourenhandling-Kosten)

- [ ] Die Felder akzeptieren Dezimalzahlen ≥ 0 (z. B. `3.50`)
- [ ] Standardwert bei noch nie gespeicherten Kombinationen: leer (kein Wert angezeigt)
- [ ] Änderungen werden automatisch gespeichert (Auto-Save per `onBlur`)
- [ ] Optimistische Updates: Wert erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung, Rollback auf vorherigen Wert
- [ ] Nutzer leert das Feld und verlässt es (`onBlur`): Upsert mit `null` — Feld wird wieder leer dargestellt

### Datenpersistenz

- [ ] Jede Kombination aus Sales-Plattform-ID und Produkt-ID wird als separater Datensatz gespeichert (UNIQUE `(sales_plattform_id, produkt_id, user_id)`)
- [ ] Die plattformweiten Einstellungen (Gruppierung, Zahlungswoche-Basis, Zahlungsziel, Erstattung Verkaufsgebühr) werden pro Plattform und Nutzer gespeichert (UNIQUE `(sales_plattform_id, user_id)`)
- [ ] Beim Wechsel des Plattform-Reiters werden die Einstellungen des neuen Reiters aus der DB geladen
- [ ] Beim ersten Aufruf einer Plattform ohne vorherige Speicherung zeigen alle Felder Standardwerte

### Datenbankschema

- [ ] Neue Tabelle `retouren_einstellungen`:
  - `id` UUID PK
  - `sales_plattform_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `berechnungsart` TEXT NOT NULL CHECK IN ('keine', 'mittelwert_14', 'mittelwert_30', 'mittelwert_60', 'mittelwert_90') DEFAULT 'keine'
  - `rueckversandkosten_euro_netto` NUMERIC(10,2) — NULL wenn noch nicht gepflegt
  - `retourenhandling_kosten_euro_netto` NUMERIC(10,2) — NULL wenn noch nicht gepflegt
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - UNIQUE(`sales_plattform_id`, `produkt_id`, `user_id`) — ein Eintrag pro Kombination pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

- [ ] Neue Tabelle `retouren_plattform_einstellungen`:
  - `id` UUID PK
  - `sales_plattform_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `gruppierung` TEXT NOT NULL CHECK IN ('woechentlich', 'monatlich', 'quartalsweise') DEFAULT 'monatlich'
  - `naechste_zahlung_basis_kw` INTEGER CHECK (≥ 1 AND ≤ 53) — NULL wenn noch nicht gepflegt
  - `naechste_zahlung_basis_jahr` INTEGER CHECK (≥ 2024) — NULL wenn noch nicht gepflegt
  - `zahlungsziel_tage` INTEGER CHECK (≥ 0) — NULL wenn noch nicht gepflegt
  - `erstattung_verkaufsgebuehr_prozent` NUMERIC(5,2) CHECK (≥ 0 AND ≤ 100) — NULL wenn noch nicht gepflegt
  - CHECK `chk_retouren_kw_jahr_both_or_neither`: KW und Jahr müssen gemeinsam gesetzt oder beide NULL sein
  - UNIQUE(`sales_plattform_id`, `user_id`) — ein Eintrag pro Plattform pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

### API-Routen

- [ ] `GET /api/retouren-einstellungen?plattform_id=<UUID>` — alle Produkteinstellungen des Nutzers für eine Plattform
  - Response: Array von `{ produkt_id, berechnungsart, rueckversandkosten_euro_netto, retourenhandling_kosten_euro_netto }`
- [ ] `PUT /api/retouren-einstellungen` — Upsert einer einzelnen Plattform-Produkt-Kombination
  - Body: `{ sales_plattform_id, produkt_id, berechnungsart?, rueckversandkosten_euro_netto?, retourenhandling_kosten_euro_netto? }`
  - Zod-Validierung: `berechnungsart` ∈ 5 gültige Werte; Kostenfelder Zahl ≥ 0 oder `null`
  - Response 400 bei ungültigen Werten
- [ ] `GET /api/retouren-plattform-einstellungen?plattform_id=<UUID>` — plattformweite Einstellungen des Nutzers
  - Response: `{ gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr, zahlungsziel_tage, erstattung_verkaufsgebuehr_prozent }` oder `null` wenn kein Eintrag
- [ ] `PUT /api/retouren-plattform-einstellungen` — Upsert der plattformweiten Einstellungen
  - Body: `{ sales_plattform_id, gruppierung?, naechste_zahlung_basis_kw?, naechste_zahlung_basis_jahr?, zahlungsziel_tage?, erstattung_verkaufsgebuehr_prozent? }`
  - Zod-Validierung: `gruppierung` ∈ 3 gültige Werte; KW Integer 1–53 oder null; Jahr Integer ≥ 2024 oder null; KW+Jahr gemeinsam oder beide null; `zahlungsziel_tage` Integer ≥ 0 oder null; `erstattung_verkaufsgebuehr_prozent` Dezimalzahl 0–100 oder null
  - Response 400 bei ungültigen Werten

## Edge Cases

- **Keine Sales-Plattformen** im KPI-Modell: Seite zeigt nur Hinweis mit Link zum KPI-Modell; keine Reiter und keine Tabelle
- **Keine Produkte** im KPI-Modell: Plattform-Tab zeigt Hinweis, keine Tabelle
- **Berechnungsart: Standardwert „Keine"** bei noch nicht gespeicherter Kombination — Dropdown zeigt „Keine"; kein expliziter DB-Eintrag nötig vor erster Änderung
- **Nutzer wählt „Keine" im Dropdown**: Upsert mit `berechnungsart = 'keine'` — gültiger Wert, wird korrekt gespeichert
- **Nutzer leert ein Kostenfeld und verlässt es**: Upsert mit `null` — Feld bleibt leer; kein Fehler
- **Nutzer trägt 0 als Kosten ein**: gültiger Wert, wird als `0.00` gespeichert
- **Erstattung Verkaufsgebühr: Wert > 100 eingegeben**: API blockiert mit 400; UI zeigt Validierungsfehler
- **Erstattung Verkaufsgebühr: negativer Wert eingegeben**: API blockiert mit 400; UI zeigt Validierungsfehler
- **Nächste Zahlungswoche: Basis liegt weit in der Vergangenheit**: Algorithmus berechnet korrekt die nächste zukünftige Woche; keine Endlosschleife
- **Nächste Zahlungswoche: Jahresüberlauf**: korrekte ISO-Wochenberechnung für Jahre mit 52 vs. 53 Wochen (analog PROJ-45/46)
- **Plattform aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `retouren_einstellungen` und `retouren_plattform_einstellungen` für diese Plattform; Reiter verschwindet beim nächsten Seitenaufruf
- **Produkt aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `retouren_einstellungen` für dieses Produkt; Zeile verschwindet beim nächsten Seitenaufruf
- **Neue Plattform / neues Produkt hinzugefügt**: erscheint beim nächsten Seitenaufruf mit Standardwerten
- **API-Fehler beim Auto-Save**: Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden.", optimistisches Update wird zurückgerollt
- **Zahlungsziel: negativer Wert**: API blockiert mit 400; UI zeigt Validierungsfehler
- **Sehr viele Produkte** (>20): Tabelle ist scrollbar, keine Paginierung nötig
- **Sehr viele Plattformen** (>5): Reiter-Leiste wird scrollbar (overflow-x: auto)

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen API-Routen
- RLS auf beiden neuen Tabellen
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/retouren-einstellungen/page.tsx`
- Nav-Eintrag in `nav-sheet.tsx`: Eintrag „Retoureneinstellungen" zur bestehenden Gruppe „Kurzfristige Planung" hinzufügen
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx` ergänzen
- shadcn `Tabs`-Komponente für die Reiter-Navigation
- shadcn `Select`-Komponente für Gruppierung-Dropdown und Berechnungsart-Dropdown in der Tabelle
- shadcn `Popover` + `Calendar`-Komponente für den Zahlungswoche-Picker (identisch zu PROJ-45/46)
- shadcn `Input type="number"` für Kostenfelder (min=0, step=0.01), Zahlungsziel (min=0, step=1) und Erstattungsfeld (min=0, max=100, step=0.01)
- `calculateNextPayoutWeek`-Utility aus PROJ-45 kann direkt wiederverwendet werden
- Architektur und Muster analog zu PROJ-46 (Lagerausgaben-Einstellungen): gleiche Hook-Struktur, gleiche Komponenten-Hierarchie, gleicher Calendar-Picker

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung  (bestehende Kachelseite)
+-- Kachelraster  (bereits vorhanden)
    +-- Kachel: "Absatzeinstellungen"              (bereits vorhanden)
    +-- Kachel: "Verkaufsgebühr-Einstellungen"     (bereits vorhanden)
    +-- Kachel: "Versandausgaben-Einstellungen"    (bereits vorhanden)
    +-- Kachel: "Auszahlungseinstellungen"         (bereits vorhanden)
    +-- Kachel: "Lager-Ausgaben-Einstellungen"     (bereits vorhanden)
    +-- Kachel: "Retoureneinstellungen"            (NEU) → /dashboard/kurzfristige-planung/retouren-einstellungen

/dashboard/kurzfristige-planung/retouren-einstellungen  (NEUE Seite)
+-- Page-Header
+-- RetourenEinstellungenTabelle  (NEUE Hauptkomponente)
    +-- Tabs  [shadcn — eine Tab je Sales-Plattform]
    |   +-- Tab: "Plattform A"
    |   +-- Tab: "Plattform B"
    |   +-- ...
    +-- Leerzustand: keine Plattformen → Hinweis + Link zu KPI-Modell
    +-- (je aktivem Tab) PlattformEinstellungenForm
    |   +-- Zeile 1: Gruppierung  [shadcn Select — Wöchentlich/Monatlich/Quartalsweise]
    |   +-- Zeile 2: Nächste Zahlungswoche  [Calendar Popover, identisch zu PROJ-45/46]
    |   |   +-- Button mit berechneter KW-Anzeige
    |   |   +-- Subtitle: „KW XX / YYYY"
    |   |   +-- „Auswahl löschen"-Link
    |   +-- Zeile 3: Zahlungsziel  [shadcn Input, Ganzzahl ≥ 0, in Tagen]
    |   +-- Zeile 4: Erstattung Verkaufsgebühr (%)  [shadcn Input, Dezimalzahl 0–100]
    +-- (je aktivem Tab) ProduktTabelle
        +-- Leerzustand: keine Produkte → Hinweis + Link zu KPI-Modell
        +-- Table  [shadcn]
            +-- TableHeader: Produkt | Berechnungsart | Rückversandkosten (€ netto) | Retourenhandling-Kosten (€ netto)
            +-- TableBody: eine Zeile je Produkt
                +-- RetourenEinstellungZeile  (NEUE Zeilen-Komponente)
                    +-- Produktname  (read-only)
                    +-- Select: Berechnungsart  [Keine/Mittelwert 14/30/60/90 Tage, Auto-Save onChange]
                    +-- Input: Rückversandkosten €  (Dezimalzahl ≥ 0, Auto-Save onBlur)
                    +-- Input: Retourenhandling-Kosten €  (Dezimalzahl ≥ 0, Auto-Save onBlur)
```

### Datenmodell

**Tabelle 1: `retouren_einstellungen`** — Produkt-Level, eine Zeile pro Plattform-Produkt-Kombination pro Nutzer:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `sales_plattform_id` | UUID FK | Verknüpfung mit `kpi_categories` — ON DELETE CASCADE |
| `produkt_id` | UUID FK | Verknüpfung mit `kpi_categories` — ON DELETE CASCADE |
| `berechnungsart` | TEXT NOT NULL | `keine` / `mittelwert_14` / `mittelwert_30` / `mittelwert_60` / `mittelwert_90`; Default: `keine` |
| `rueckversandkosten_euro_netto` | NUMERIC(10,2) nullable | Rückversandkosten netto; NULL = noch nicht gepflegt |
| `retourenhandling_kosten_euro_netto` | NUMERIC(10,2) nullable | Handling-Kosten netto; NULL = noch nicht gepflegt |
| `user_id` | UUID FK | Dateneigentümer — RLS: jeder Nutzer sieht nur eigene Einträge |

Unique-Constraint: `(sales_plattform_id, produkt_id, user_id)`

**Tabelle 2: `retouren_plattform_einstellungen`** — Plattform-Level, eine Zeile pro Plattform pro Nutzer:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `sales_plattform_id` | UUID FK | Verknüpfung mit `kpi_categories` — ON DELETE CASCADE |
| `user_id` | UUID FK | Dateneigentümer — RLS |
| `gruppierung` | TEXT NOT NULL | `woechentlich` / `monatlich` / `quartalsweise`; Default: `monatlich` |
| `naechste_zahlung_basis_kw` | INTEGER (1–53) nullable | Anker-Kalenderwoche; NULL = nicht gepflegt |
| `naechste_zahlung_basis_jahr` | INTEGER (≥ 2024) nullable | Ankerjahr; immer zusammen mit basis_kw |
| `zahlungsziel_tage` | INTEGER (≥ 0) nullable | Zahlungsziel in Tagen |
| `erstattung_verkaufsgebuehr_prozent` | NUMERIC(5,2) (0–100) nullable | Erstattungssatz in %; NULL = nicht gepflegt |

Unique-Constraint: `(sales_plattform_id, user_id)` — CHECK-Constraint verhindert inkonsistenten KW/Jahr-Stand.

### Datenfluss

```
Seite öffnet sich
  → Alle Sales-Plattformen + alle Produkte aus kpi_categories laden
  → Erster Plattform-Tab wird aktiv
  → Hook 1 lädt Produkteinstellungen für aktive Plattform (GET retouren-einstellungen)
  → Hook 2 lädt Plattform-Einstellungen (GET retouren-plattform-einstellungen)
  → Frontend berechnet angezeigte Zahlungswoche aus Basis-KW + Gruppierungs-Rhythmus

Nutzer ändert Gruppierung (onChange)
  → Sofortiger Upsert: PUT /api/retouren-plattform-einstellungen

Nutzer wählt Datum im Calendar-Picker
  → PUT /api/retouren-plattform-einstellungen mit neuer Basis-KW
  → Display-KW wird neu berechnet

Nutzer ändert Zahlungsziel oder Erstattung Verkaufsgebühr und verlässt Feld (onBlur)
  → PUT /api/retouren-plattform-einstellungen

Nutzer ändert Berechnungsart-Dropdown (onChange)
  → Optimistisches Update in der UI
  → PUT /api/retouren-einstellungen (Einzel-Upsert mit berechnungsart + aktuelle Kostenwerte)
  → Bei Fehler: Rollback + Toast

Nutzer ändert Kosten-Feld und verlässt es (onBlur)
  → Optimistisches Update in der UI
  → PUT /api/retouren-einstellungen (Einzel-Upsert mit allen drei Produktfeldern)
  → Bei Fehler: Rollback + Toast
```

### API-Endpunkte

```
GET  /api/retouren-einstellungen?plattform_id=<UUID>
  → Alle Produkteinstellungen des Nutzers für eine Plattform
  → Array: [{ produkt_id, berechnungsart, rueckversandkosten_euro_netto, retourenhandling_kosten_euro_netto }, ...]

PUT  /api/retouren-einstellungen
  → Einzelner Upsert (eine Plattform-Produkt-Kombination)
  → Zod-validiert: berechnungsart ∈ 5 Werte; Kostenfelder ≥ 0 oder null

GET  /api/retouren-plattform-einstellungen?plattform_id=<UUID>
  → Plattform-Einstellungen des Nutzers (oder null wenn kein Eintrag)

PUT  /api/retouren-plattform-einstellungen
  → Upsert: Gruppierung, KW/Jahr-Basis, Zahlungsziel, Erstattung Verkaufsgebühr
  → Zod prüft KW+Jahr gemeinsam oder beide null; Erstattung 0–100 oder null
```

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/retouren-einstellungen/page.tsx` | Neue Seite (Client Component mit Auth-Guard) |
| `src/components/retouren-einstellungen-tabelle.tsx` | Hauptkomponente: Tabs, Plattform-Einstellungen, Produkttabelle |
| `src/hooks/use-retouren-einstellungen.ts` | State für Produktdaten: laden, Einzel-Upsert, optimistisches Update + Rollback |
| `src/hooks/use-retouren-plattform-einstellungen.ts` | State für Plattform-Einstellungen: laden + upsert (Gruppierung, KW/Jahr, Zahlungsziel, Erstattung) |
| `src/app/api/retouren-einstellungen/route.ts` | GET + PUT (Upsert) mit Zod + requireAuth() |
| `src/app/api/retouren-plattform-einstellungen/route.ts` | GET + PUT (Upsert Plattform-Einstellungen) mit Zod + requireAuth() |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Eintrag „Retoureneinstellungen" zur bestehenden Gruppe „Kurzfristige Planung" ergänzen |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Kachel „Retoureneinstellungen" zum bestehenden Kachelraster hinzufügen |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Gesamtmuster | Identisch zu PROJ-46 (Lagerausgaben) | Gleiche Seiten-Struktur und Datenhaltung — Konsistenz, kein neues Muster |
| Calendar-Picker / KW-Berechnung | Wiederverwendet aus PROJ-45 | `calculateNextPayoutWeek`-Utility und Calendar-UI bereits fertig, getestet und im Einsatz |
| Berechnungsart als Select in der Tabelle | shadcn `Select` pro Zeile | Gleiche shadcn-Komponente wie für Gruppierung; sauberere UX als Radio-Buttons in einer Tabellenzelle |
| Einzel-Upsert sendet alle drei Produktfelder gemeinsam | Alle drei Felder im PUT-Body | Vermeidet inkonsistente Teilupdates; ein onBlur oder onChange löst immer einen vollständigen Datensatz-Upsert aus |
| Erstattung Verkaufsgebühr auf Plattform-Level | Teil von `retouren_plattform_einstellungen` | Plattformweit, nicht produktspezifisch — passt strukturell zu Gruppierung und Zahlungsziel |
| Kein Batch-„Alle gleichsetzen" | Nicht implementiert | Nicht in der Spec; bei 3 heterogenen Spalten wäre ein sinnvoller Batch-Wert unklar |
| Zwei getrennte DB-Tabellen | `retouren_einstellungen` + `retouren_plattform_einstellungen` | Unterschiedliche Granularität (Plattform×Produkt vs. nur Plattform) — analog PROJ-46 |
| Neue Packages | Keine | Tabs, Select, Popover, Calendar, Input, Table — alles bereits in shadcn/ui installiert |

## Implementation Notes (Frontend — 2026-06-02)

### Neue Dateien
- `src/hooks/use-retouren-einstellungen.ts` — Typ `RetourenEinstellung`, Konstanten `BERECHNUNGSARTEN` + `BERECHNUNGSART_LABELS`, Hook `useRetourenEinstellungen(plattformId)` mit Laden, optimistischem Einzel-Upsert und Rollback
- `src/hooks/use-retouren-plattform-einstellungen.ts` — Typ `RetourenPlattformEinstellungen`, Konstanten `GRUPPIERUNGEN`, `GRUPPIERUNG_LABELS`, `GRUPPIERUNG_WOCHEN`, Hook `useRetourenPlattformEinstellungen(plattformId)` mit Laden und Upsert
- `src/components/retouren-einstellungen-tabelle.tsx` — Vier Komponenten: `PlattformEinstellungenForm` (Gruppierung Select + Calendar-Popover Zahlungswoche + Zahlungsziel Input + Erstattung Verkaufsgebühr Input), `RetourenEinstellungZeile` (lokaler State für alle 3 Felder, Select onChange + Input onBlur senden immer den vollständigen Zeilendatensatz), `PlattformTabelle` (pro Plattform mit eigenem Hook-Aufruf), `RetourenEinstellungenTabelle` (Export, lädt Plattformen + Produkte, rendert Tabs)
- `src/app/dashboard/kurzfristige-planung/retouren-einstellungen/page.tsx` — Client Component, Page-Header + `RetourenEinstellungenTabelle`

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — Eintrag „Retoureneinstellungen" zur bestehenden Gruppe „Kurzfristige Planung" ergänzt
- `src/app/dashboard/kurzfristige-planung/page.tsx` — Kachel „Retoureneinstellungen" zum Kachelraster hinzugefügt

### Designentscheidungen
- `RetourenEinstellungZeile` hält lokalen State für alle 3 Felder (berechnungsart, rueckversandStr, handlingStr) und sendet bei jeder Änderung (Select onChange oder Input onBlur) immer alle drei Werte gemeinsam an die API — verhindert inkonsistente Teilupdates
- Die `handleSave`-Funktion akzeptiert optionale `overrides` damit der Select-onChange-Handler den neuen Wert einspeisenb kann, bevor der State-Update des React-Rendercycles greift
- Calendar-Picker und `calculateNextPayoutWeek`-Utility werden aus `use-auszahlungs-einstellungen.ts` importiert — gleiche Quelle der Wahrheit wie bei PROJ-45/46
- `PlattformEinstellungenForm` initialisiert `zahlungszielStr` und `erstattungStr` per `useRef`-Guard (`initializedRef`) genau einmal beim ersten vollständigen Laden — verhindert Überschreiben von Nutzereingaben durch verzögerte API-Antworten

### Build
- `npm run build` ✅ — 65 Routen korrekt, `/dashboard/kurzfristige-planung/retouren-einstellungen` in der Route-Liste

## Implementation Notes (Backend — 2026-06-02)

### Datenbankmigrierung
- Migration `proj47_retouren_einstellungen` erfolgreich auf Supabase-Projekt `kdmpghtdoguppfqhdscq` angewendet
- Tabelle `retouren_einstellungen` angelegt mit: UUID-PK, FK zu `kpi_categories` (ON DELETE CASCADE für Plattform + Produkt), `berechnungsart` TEXT mit CHECK-Constraint (5 Werte, DEFAULT 'keine'), NUMERIC(10,2) für Rückversandkosten und Handling-Kosten (beide nullable), FK zu `auth.users` (ON DELETE CASCADE), UNIQUE `(sales_plattform_id, produkt_id, user_id)`
- Tabelle `retouren_plattform_einstellungen` angelegt mit: UUID-PK, FK zu `kpi_categories` (ON DELETE CASCADE), `gruppierung` TEXT mit CHECK-Constraint (3 Werte, DEFAULT 'monatlich'), INTEGER-CHECKs (KW: 1–53, Jahr: ≥ 2024), INTEGER-CHECK (zahlungsziel_tage: ≥ 0), NUMERIC(5,2) mit CHECK (erstattung: 0–100), CONSTRAINT `chk_retouren_kw_jahr_both_or_neither`, UNIQUE `(sales_plattform_id, user_id)`
- RLS aktiviert mit je 4 Policies (SELECT/INSERT/UPDATE/DELETE) auf beiden Tabellen
- Indexes: `idx_re_plattform_user` auf `retouren_einstellungen(sales_plattform_id, user_id)`, `idx_rpe_plattform_user` auf `retouren_plattform_einstellungen(sales_plattform_id, user_id)`

### API-Routen
- `GET /api/retouren-einstellungen?plattform_id=<UUID>` — gibt Array mit `id, sales_plattform_id, produkt_id, berechnungsart, rueckversandkosten_euro_netto, retourenhandling_kosten_euro_netto` zurück
- `PUT /api/retouren-einstellungen` — Upsert via `onConflict: 'sales_plattform_id,produkt_id,user_id'`; Zod validiert berechnungsart ∈ 5 Werte; Kostenfelder als Zahl ≥ 0 oder null; alle drei Felder werden immer gemeinsam gesendet
- `GET /api/retouren-plattform-einstellungen?plattform_id=<UUID>` — `maybeSingle()`, gibt null wenn kein Eintrag
- `PUT /api/retouren-plattform-einstellungen` — Fetch-then-merge-Pattern; `'feld' in body`-Check für explizites null vs. nicht-gesendet; Upsert via `onConflict: 'sales_plattform_id,user_id'`; Zod validiert erstattung 0–100 oder null

### Tests
- `src/app/api/retouren-einstellungen/route.test.ts` — 17 Tests (Vitest): 5 GET, 12 PUT — alle bestanden ✅
- `src/app/api/retouren-plattform-einstellungen/route.test.ts` — 22 Tests (Vitest): 5 GET, 17 PUT — alle bestanden ✅
- **Gesamt: 39/39 Tests bestanden ✅**

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
