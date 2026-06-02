# PROJ-48: Ersatzteile/Kulanz-Einstellungen — Kurzfristige Planung

## Status: In Progress
**Created:** 2026-06-02
**Last Updated:** 2026-06-02 (Frontend)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Sales-Plattformen (`kpi_categories` mit `type = 'sales_plattformen'`) und Produkte (`kpi_categories` mit `type = 'produkte'`, `level = 1`) müssen bereits gepflegt sein
- Requires: PROJ-42 (Absatzeinstellungen) — der Bereich „Kurzfristige Planung" inkl. linker Navigation und Dashboard-Kachelseite ist bereits aufgebaut; diese Seite ergänzt ihn um eine weitere Kachel und einen weiteren Nav-Eintrag

## Übersicht

Auf der Seite „Ersatzteile/Kulanz-Einstellungen" pflegt der Nutzer für jede Kombination aus **Sales-Plattform** und **Produkt** zwei produktspezifische Werte: die Ersatzteile/Kulanz-Quote in Prozent sowie die Ersatzteile/Kulanzkosten pro Stück als Nettowert in Euro. Zusätzlich gibt es je Plattform-Tab einen Plattform-Einstellungen-Bereich oberhalb der Tabelle mit drei Feldern: Gruppierung (Rhythmus), Nächste Zahlungswoche (intelligente KW-Berechnung identisch zu PROJ-45–47) sowie Zahlungsziel in Tagen.

Die Seite ist Teil des Bereichs „Kurzfristige Planung", über die linke Navigation erreichbar und als Kachel auf der Dashboard-Übersichtsseite verlinkt.

## User Stories

- Als Nutzer möchte ich die Seite „Ersatzteile/Kulanz-Einstellungen" über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können, damit ich schnell dorthin gelange.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite von „Kurzfristige Planung" eine Kachel „Ersatzteile/Kulanz-Einstellungen" sehen, damit ich von dort direkt auf die Seite wechseln kann.
- Als Nutzer möchte ich alle im KPI-Modell gepflegten Sales-Plattformen als Reiter oben auf der Seite sehen, damit ich die Einstellungen plattformspezifisch pflegen kann.
- Als Nutzer möchte ich je Reiter alle im KPI-Modell gepflegten Produkte als Zeilen in einer Tabelle sehen, damit ich pro Produkt die Ersatzteile/Kulanz-Daten eintragen kann.
- Als Nutzer möchte ich pro Produkt und Plattform die Ersatzteile/Kulanz-Quote in Prozent eingeben können, damit die anfallende Quote korrekt hinterlegt ist.
- Als Nutzer möchte ich pro Produkt und Plattform die Ersatzteile/Kulanzkosten pro Stück (netto) in Euro eingeben können, damit die Kosten je Einheit vollständig erfasst sind.
- Als Nutzer möchte ich pro Plattform eine Gruppierung (Zeitraum-Granularität) festlegen können, damit ich die zeitliche Auswertung kontrollieren kann.
- Als Nutzer möchte ich pro Plattform die nächste Zahlungswoche über einen Calendar-Picker eingeben können, der automatisch die nächste zukünftige Woche auf Basis des gespeicherten Ankers und des Rhythmus berechnet, damit ich keine manuelle Pflege nach jeder Zahlung brauche.
- Als Nutzer möchte ich pro Plattform ein Zahlungsziel in Tagen eintragen können, damit Zahlungsfristen hinterlegt sind.
- Als Nutzer möchte ich, dass meine eingetragenen Werte gespeichert werden und beim nächsten Aufruf noch vorhanden sind.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag „Ersatzteile/Kulanz-Einstellungen" → `/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Ersatzteile/Kulanz-Einstellungen", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Reiter-Navigation

- [ ] Oben auf der Seite werden alle Einträge aus `kpi_categories` mit `type = 'sales_plattformen'` als Tabs dargestellt (sortiert nach `sort_order`)
- [ ] Beim ersten Laden ist der erste Reiter automatisch aktiv
- [ ] Gibt es keine Sales-Plattformen im KPI-Modell, erscheint ein Hinweis: „Noch keine Sales-Plattformen gepflegt. Bitte zuerst im KPI-Modell Sales-Plattformen anlegen." (mit Link zur KPI-Modell-Seite)
- [ ] Sehr viele Plattformen (>5): Reiter-Leiste wird scrollbar (overflow-x: auto)

### Plattform-Einstellungen (oberhalb der Tabelle, pro Plattform-Tab)

Oberhalb der Produkttabelle werden je Plattform-Tab drei Einstellungszeilen angezeigt:

#### Zeile 1: Gruppierung

- [ ] Beschriftung: „Gruppierung"
- [ ] Eingabeelement: Dropdown (shadcn `Select`)
- [ ] Optionen (in dieser Reihenfolge): „Wöchentlich", „Monatlich", „Quartalsweise"
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: „Monatlich"
- [ ] Auto-Save bei `onChange` (kein separater „Speichern"-Button)
- [ ] Einstellung ist pro Plattform unabhängig gespeichert

#### Zeile 2: Nächste Zahlungswoche

- [ ] Beschriftung: „Nächste Zahlungswoche"
- [ ] Eingabeelement: Calendar-Picker-Button (shadcn `Popover` + `Calendar`) — identische UI wie bei PROJ-45, PROJ-46 und PROJ-47
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

### Berechnungslogik „Nächste Zahlungswoche"

Die angezeigte Zahlungswoche wird **bei jedem Seitenaufruf im Frontend dynamisch berechnet** — der DB-Wert ändert sich dabei nicht automatisch.

**Algorithmus (identisch zu PROJ-45, PROJ-46 und PROJ-47 `calculateNextPayoutWeek`):**

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
  - **Ersatzteile/Kulanz-Quote (%)** (Dezimalzahl-Eingabefeld, editierbar, min=0, max=100, step=0.01)
  - **Ersatzteile/Kulanzkosten pro Stück (€ netto)** (Dezimalzahl-Eingabefeld, editierbar, min=0, step=0.01)
- [ ] Gibt es keine Produkte, erscheint ein Hinweis: „Noch keine Produkte gepflegt. Bitte zuerst im KPI-Modell Produkte anlegen." (mit Link zur KPI-Modell-Seite)

### Quote-Feld (Ersatzteile/Kulanz-Quote %)

- [ ] Das Feld akzeptiert Dezimalzahlen von 0 bis 100 (z. B. `5.50` für 5,50 %)
- [ ] Standardwert bei noch nie gespeicherter Kombination: leer (kein Wert angezeigt)
- [ ] Änderungen werden automatisch gespeichert (Auto-Save per `onBlur`)
- [ ] Optimistische Updates: Wert erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung, Rollback auf vorherigen Wert
- [ ] Nutzer leert das Feld und verlässt es (`onBlur`): Upsert mit `null` — Feld wird wieder leer dargestellt
- [ ] Werte außerhalb 0–100: API blockiert mit 400; UI zeigt Validierungsfehler

### Kostenfeld (Ersatzteile/Kulanzkosten pro Stück € netto)

- [ ] Das Feld akzeptiert Dezimalzahlen ≥ 0 (z. B. `4.99`)
- [ ] Standardwert bei noch nie gespeicherter Kombination: leer (kein Wert angezeigt)
- [ ] Änderungen werden automatisch gespeichert (Auto-Save per `onBlur`)
- [ ] Optimistische Updates: Wert erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung, Rollback auf vorherigen Wert
- [ ] Nutzer leert das Feld und verlässt es (`onBlur`): Upsert mit `null` — Feld wird wieder leer dargestellt
- [ ] Negative Werte: API blockiert mit 400; UI zeigt Validierungsfehler

### Datenpersistenz

- [ ] Jede Kombination aus Sales-Plattform-ID und Produkt-ID wird als separater Datensatz gespeichert (UNIQUE `(sales_plattform_id, produkt_id, user_id)`)
- [ ] Die plattformweiten Einstellungen (Gruppierung, Zahlungswoche-Basis, Zahlungsziel) werden pro Plattform und Nutzer gespeichert (UNIQUE `(sales_plattform_id, user_id)`)
- [ ] Beim Wechsel des Plattform-Reiters werden die Einstellungen des neuen Reiters aus der DB geladen
- [ ] Beim ersten Aufruf einer Plattform ohne vorherige Speicherung zeigen alle Felder Standardwerte

### Datenbankschema

- [ ] Neue Tabelle `ersatzteile_kulanz_einstellungen`:
  - `id` UUID PK
  - `sales_plattform_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `quote_prozent` NUMERIC(5,2) CHECK (≥ 0 AND ≤ 100) — NULL wenn noch nicht gepflegt
  - `kosten_pro_stueck_euro_netto` NUMERIC(10,2) CHECK (≥ 0) — NULL wenn noch nicht gepflegt
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - UNIQUE(`sales_plattform_id`, `produkt_id`, `user_id`)
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

- [ ] Neue Tabelle `ersatzteile_kulanz_plattform_einstellungen`:
  - `id` UUID PK
  - `sales_plattform_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `gruppierung` TEXT NOT NULL CHECK IN ('woechentlich', 'monatlich', 'quartalsweise') DEFAULT 'monatlich'
  - `naechste_zahlung_basis_kw` INTEGER CHECK (≥ 1 AND ≤ 53) — NULL wenn noch nicht gepflegt
  - `naechste_zahlung_basis_jahr` INTEGER CHECK (≥ 2024) — NULL wenn noch nicht gepflegt
  - `zahlungsziel_tage` INTEGER CHECK (≥ 0) — NULL wenn noch nicht gepflegt
  - CHECK `chk_eke_kw_jahr_both_or_neither`: KW und Jahr müssen gemeinsam gesetzt oder beide NULL sein
  - UNIQUE(`sales_plattform_id`, `user_id`)
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

### API-Routen

- [ ] `GET /api/ersatzteile-kulanz-einstellungen?plattform_id=<UUID>` — alle Produkteinstellungen des Nutzers für eine Plattform
  - Response: Array von `{ produkt_id, quote_prozent, kosten_pro_stueck_euro_netto }`
- [ ] `PUT /api/ersatzteile-kulanz-einstellungen` — Upsert einer einzelnen Plattform-Produkt-Kombination
  - Body: `{ sales_plattform_id, produkt_id, quote_prozent?, kosten_pro_stueck_euro_netto? }`
  - Zod-Validierung: `quote_prozent` Dezimalzahl 0–100 oder null; `kosten_pro_stueck_euro_netto` Zahl ≥ 0 oder null
  - Response 400 bei ungültigen Werten
- [ ] `GET /api/ersatzteile-kulanz-plattform-einstellungen?plattform_id=<UUID>` — plattformweite Einstellungen des Nutzers
  - Response: `{ gruppierung, naechste_zahlung_basis_kw, naechste_zahlung_basis_jahr, zahlungsziel_tage }` oder `null` wenn kein Eintrag
- [ ] `PUT /api/ersatzteile-kulanz-plattform-einstellungen` — Upsert der plattformweiten Einstellungen
  - Body: `{ sales_plattform_id, gruppierung?, naechste_zahlung_basis_kw?, naechste_zahlung_basis_jahr?, zahlungsziel_tage? }`
  - Zod-Validierung: `gruppierung` ∈ 3 gültige Werte; KW Integer 1–53 oder null; Jahr Integer ≥ 2024 oder null; KW+Jahr gemeinsam oder beide null; `zahlungsziel_tage` Integer ≥ 0 oder null
  - Response 400 bei ungültigen Werten

## Edge Cases

- **Keine Sales-Plattformen** im KPI-Modell: Seite zeigt nur Hinweis mit Link zum KPI-Modell; keine Reiter und keine Tabelle
- **Keine Produkte** im KPI-Modell: Plattform-Tab zeigt Hinweis, keine Tabelle
- **Quote > 100 eingegeben**: API blockiert mit 400; UI zeigt Validierungsfehler
- **Negative Quote eingegeben**: API blockiert mit 400; UI zeigt Validierungsfehler
- **Negative Kosten eingegeben**: API blockiert mit 400; UI zeigt Validierungsfehler
- **Nutzer trägt 0 in Quote- oder Kostenfeld ein**: gültiger Wert, wird als `0.00` gespeichert
- **Nutzer leert ein Feld und verlässt es**: Upsert mit `null` — Feld bleibt leer; kein Fehler
- **Nächste Zahlungswoche: Basis liegt weit in der Vergangenheit**: Algorithmus berechnet korrekt die nächste zukünftige Woche; keine Endlosschleife
- **Nächste Zahlungswoche: Jahresüberlauf**: korrekte ISO-Wochenberechnung für Jahre mit 52 vs. 53 Wochen (analog PROJ-45/46/47)
- **Plattform aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `ersatzteile_kulanz_einstellungen` und `ersatzteile_kulanz_plattform_einstellungen` für diese Plattform; Reiter verschwindet beim nächsten Seitenaufruf
- **Produkt aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `ersatzteile_kulanz_einstellungen` für dieses Produkt; Zeile verschwindet beim nächsten Seitenaufruf
- **Neue Plattform / neues Produkt hinzugefügt**: erscheint beim nächsten Seitenaufruf mit Standardwerten (leere Felder)
- **API-Fehler beim Auto-Save**: Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden.", optimistisches Update wird zurückgerollt
- **Zahlungsziel: negativer Wert**: API blockiert mit 400; UI zeigt Validierungsfehler
- **Sehr viele Produkte** (>20): Tabelle ist scrollbar, keine Paginierung nötig
- **Sehr viele Plattformen** (>5): Reiter-Leiste wird scrollbar (overflow-x: auto)

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen API-Routen
- RLS auf beiden neuen Tabellen
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen/page.tsx`
- Nav-Eintrag in `nav-sheet.tsx`: Eintrag „Ersatzteile/Kulanz-Einstellungen" zur bestehenden Gruppe „Kurzfristige Planung" hinzufügen
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx` ergänzen
- shadcn `Tabs`-Komponente für die Reiter-Navigation
- shadcn `Select`-Komponente für Gruppierung-Dropdown
- shadcn `Popover` + `Calendar`-Komponente für den Zahlungswoche-Picker (identisch zu PROJ-45/46/47)
- shadcn `Input type="number"` für Quote (min=0, max=100, step=0.01), Kosten (min=0, step=0.01) und Zahlungsziel (min=0, step=1)
- `calculateNextPayoutWeek`-Utility aus PROJ-45 kann direkt wiederverwendet werden
- Architektur und Muster analog zu PROJ-47 (Retoureneinstellungen): gleiche Hook-Struktur, gleiche Komponenten-Hierarchie, gleicher Calendar-Picker

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung  (bestehende Kachelseite)
+-- Kachelraster  (bereits vorhanden)
    +-- Kachel: "Absatzeinstellungen"                  (bereits vorhanden)
    +-- Kachel: "Verkaufsgebühr-Einstellungen"         (bereits vorhanden)
    +-- Kachel: "Versandausgaben-Einstellungen"        (bereits vorhanden)
    +-- Kachel: "Auszahlungseinstellungen"             (bereits vorhanden)
    +-- Kachel: "Lager-Ausgaben-Einstellungen"         (bereits vorhanden)
    +-- Kachel: "Retoureneinstellungen"                (bereits vorhanden)
    +-- Kachel: "Ersatzteile/Kulanz-Einstellungen"     (NEU) → /dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen

/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen  (NEUE Seite)
+-- Page-Header
+-- ErsatzteileKulanzEinstellungenTabelle  (NEUE Hauptkomponente)
    +-- Tabs  [shadcn — eine Tab je Sales-Plattform]
    |   +-- Tab: "Plattform A"
    |   +-- Tab: "Plattform B"
    |   +-- ...
    +-- Leerzustand: keine Plattformen → Hinweis + Link zu KPI-Modell
    +-- (je aktivem Tab) PlattformEinstellungenForm
    |   +-- Zeile 1: Gruppierung  [shadcn Select — Wöchentlich/Monatlich/Quartalsweise]
    |   +-- Zeile 2: Nächste Zahlungswoche  [Calendar Popover, identisch zu PROJ-45/46/47]
    |   |   +-- Button mit berechneter KW-Anzeige
    |   |   +-- Subtitle: „KW XX / YYYY"
    |   |   +-- „Auswahl löschen"-Link
    |   +-- Zeile 3: Zahlungsziel  [shadcn Input, Ganzzahl ≥ 0, in Tagen]
    +-- (je aktivem Tab) ProduktTabelle
        +-- Leerzustand: keine Produkte → Hinweis + Link zu KPI-Modell
        +-- Table  [shadcn]
            +-- TableHeader: Produkt | Ersatzteile/Kulanz-Quote (%) | Ersatzteile/Kulanzkosten pro Stück (€ netto)
            +-- TableBody: eine Zeile je Produkt
                +-- ErsatzteileKulanzEinstellungZeile  (NEUE Zeilen-Komponente)
                    +-- Produktname  (read-only)
                    +-- Input: Quote %  (Dezimalzahl 0–100, Auto-Save onBlur)
                    +-- Input: Kosten € netto  (Dezimalzahl ≥ 0, Auto-Save onBlur)
```

### Datenmodell

**Tabelle 1: `ersatzteile_kulanz_einstellungen`** — Produkt-Level, eine Zeile pro Plattform-Produkt-Kombination pro Nutzer:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `sales_plattform_id` | UUID FK | Verknüpfung mit `kpi_categories` — ON DELETE CASCADE |
| `produkt_id` | UUID FK | Verknüpfung mit `kpi_categories` — ON DELETE CASCADE |
| `quote_prozent` | NUMERIC(5,2) nullable | Ersatzteile/Kulanz-Quote in %; 0–100; NULL = noch nicht gepflegt |
| `kosten_pro_stueck_euro_netto` | NUMERIC(10,2) nullable | Kosten pro Stück netto; ≥ 0; NULL = noch nicht gepflegt |
| `user_id` | UUID FK | Dateneigentümer — RLS: jeder Nutzer sieht nur eigene Einträge |

Unique-Constraint: `(sales_plattform_id, produkt_id, user_id)`

**Tabelle 2: `ersatzteile_kulanz_plattform_einstellungen`** — Plattform-Level, eine Zeile pro Plattform pro Nutzer:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `sales_plattform_id` | UUID FK | Verknüpfung mit `kpi_categories` — ON DELETE CASCADE |
| `user_id` | UUID FK | Dateneigentümer — RLS |
| `gruppierung` | TEXT NOT NULL | `woechentlich` / `monatlich` / `quartalsweise`; Default: `monatlich` |
| `naechste_zahlung_basis_kw` | INTEGER (1–53) nullable | Anker-Kalenderwoche; NULL = nicht gepflegt |
| `naechste_zahlung_basis_jahr` | INTEGER (≥ 2024) nullable | Ankerjahr; immer zusammen mit basis_kw |
| `zahlungsziel_tage` | INTEGER (≥ 0) nullable | Zahlungsziel in Tagen |

Unique-Constraint: `(sales_plattform_id, user_id)` — CHECK-Constraint verhindert inkonsistenten KW/Jahr-Stand.

### Datenfluss

```
Seite öffnet sich
  → Alle Sales-Plattformen + alle Produkte aus kpi_categories laden
  → Erster Plattform-Tab wird aktiv
  → Hook 1 lädt Produkteinstellungen für aktive Plattform (GET ersatzteile-kulanz-einstellungen)
  → Hook 2 lädt Plattform-Einstellungen (GET ersatzteile-kulanz-plattform-einstellungen)
  → Frontend berechnet angezeigte Zahlungswoche aus Basis-KW + Gruppierungs-Rhythmus

Nutzer ändert Gruppierung (onChange)
  → Sofortiger Upsert: PUT /api/ersatzteile-kulanz-plattform-einstellungen

Nutzer wählt Datum im Calendar-Picker
  → PUT /api/ersatzteile-kulanz-plattform-einstellungen mit neuer Basis-KW
  → Display-KW wird neu berechnet

Nutzer ändert Zahlungsziel und verlässt Feld (onBlur)
  → PUT /api/ersatzteile-kulanz-plattform-einstellungen

Nutzer ändert Quote- oder Kostenfeld und verlässt es (onBlur)
  → Optimistisches Update in der UI
  → PUT /api/ersatzteile-kulanz-einstellungen (Einzel-Upsert mit beiden Produktfeldern)
  → Bei Fehler: Rollback + Toast
```

### API-Endpunkte

```
GET  /api/ersatzteile-kulanz-einstellungen?plattform_id=<UUID>
  → Alle Produkteinstellungen des Nutzers für eine Plattform
  → Array: [{ produkt_id, quote_prozent, kosten_pro_stueck_euro_netto }, ...]

PUT  /api/ersatzteile-kulanz-einstellungen
  → Einzelner Upsert (eine Plattform-Produkt-Kombination)
  → Zod-validiert: quote_prozent 0–100 oder null; kosten ≥ 0 oder null

GET  /api/ersatzteile-kulanz-plattform-einstellungen?plattform_id=<UUID>
  → Plattform-Einstellungen des Nutzers (oder null wenn kein Eintrag)

PUT  /api/ersatzteile-kulanz-plattform-einstellungen
  → Upsert: Gruppierung, KW/Jahr-Basis, Zahlungsziel
  → Zod prüft KW+Jahr gemeinsam oder beide null; Zahlungsziel ≥ 0 oder null
```

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen/page.tsx` | Neue Seite (Client Component mit Auth-Guard) |
| `src/components/ersatzteile-kulanz-einstellungen-tabelle.tsx` | Hauptkomponente: Tabs, Plattform-Einstellungen, Produkttabelle |
| `src/hooks/use-ersatzteile-kulanz-einstellungen.ts` | State für Produktdaten: laden, Einzel-Upsert, optimistisches Update + Rollback |
| `src/hooks/use-ersatzteile-kulanz-plattform-einstellungen.ts` | State für Plattform-Einstellungen: laden + upsert (Gruppierung, KW/Jahr, Zahlungsziel) |
| `src/app/api/ersatzteile-kulanz-einstellungen/route.ts` | GET + PUT (Upsert) mit Zod + requireAuth() |
| `src/app/api/ersatzteile-kulanz-plattform-einstellungen/route.ts` | GET + PUT (Upsert Plattform-Einstellungen) mit Zod + requireAuth() |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Eintrag „Ersatzteile/Kulanz-Einstellungen" zur bestehenden Gruppe „Kurzfristige Planung" ergänzen |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Kachel „Ersatzteile/Kulanz-Einstellungen" zum bestehenden Kachelraster hinzufügen |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Gesamtmuster | Identisch zu PROJ-47 (Retoureneinstellungen) | Gleiche Seiten-Struktur und Datenhaltung — Konsistenz, kein neues Muster |
| Calendar-Picker / KW-Berechnung | Wiederverwendet aus PROJ-45 | `calculateNextPayoutWeek`-Utility und Calendar-UI bereits fertig, getestet und im Einsatz |
| Produkttabelle: nur 2 Felder (Quote + Kosten) | Beide als Input onBlur | Kein Dropdown nötig (keine Berechnungsart), einfacheres Muster als PROJ-47 |
| Einzel-Upsert sendet beide Produktfelder gemeinsam | Beide Felder im PUT-Body | Vermeidet inkonsistente Teilupdates; ein onBlur löst immer einen vollständigen Datensatz-Upsert aus |
| Zwei getrennte DB-Tabellen | `ersatzteile_kulanz_einstellungen` + `ersatzteile_kulanz_plattform_einstellungen` | Unterschiedliche Granularität (Plattform×Produkt vs. nur Plattform) — analog PROJ-46/47 |
| Keine „Erstattung Verkaufsgebühr" | Nicht in der Spec | Im Gegensatz zu PROJ-47 gibt es dieses Feld bei Ersatzteile/Kulanz nicht — bewusst weggelassen |
| Neue Packages | Keine | Tabs, Select, Popover, Calendar, Input, Table — alles bereits in shadcn/ui installiert |

## Implementation Notes (Frontend — 2026-06-02)

### Neue Dateien
- `src/hooks/use-ersatzteile-kulanz-einstellungen.ts` — Typ `ErsatzteileKulanzEinstellung`, Hook `useErsatzteileKulanzEinstellungen(plattformId)` mit Laden, optimistischem Einzel-Upsert und Rollback
- `src/hooks/use-ersatzteile-kulanz-plattform-einstellungen.ts` — Typ `ErsatzteileKulanzPlattformEinstellungen`, re-exportiert `Gruppierung`, `GRUPPIERUNGEN`, `GRUPPIERUNG_LABELS`, `GRUPPIERUNG_WOCHEN` aus `use-retouren-plattform-einstellungen`, Hook `useErsatzteileKulanzPlattformEinstellungen(plattformId)` mit Laden und Upsert
- `src/components/ersatzteile-kulanz-einstellungen-tabelle.tsx` — Vier Komponenten: `PlattformEinstellungenForm` (Gruppierung Select + Calendar-Popover Zahlungswoche + Zahlungsziel Input — 3 Felder, kein Erstattungsfeld), `ErsatzteileKulanzEinstellungZeile` (lokaler State für Quote + Kosten, beide Input onBlur senden immer vollständigen Datensatz), `PlattformTabelle` (pro Plattform mit eigenem Hook-Aufruf), `ErsatzteileKulanzEinstellungenTabelle` (Export, lädt Plattformen + Produkte, rendert Tabs)
- `src/app/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen/page.tsx` — Client Component, Page-Header + `ErsatzteileKulanzEinstellungenTabelle`

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — Eintrag „Ersatzteile/Kulanz-Einstellungen" zur bestehenden Gruppe „Kurzfristige Planung" ergänzt
- `src/app/dashboard/kurzfristige-planung/page.tsx` — Kachel „Ersatzteile/Kulanz-Einstellungen" zum Kachelraster hinzugefügt

### Designentscheidungen
- `Gruppierung`-Typ und Konstanten (`GRUPPIERUNGEN`, `GRUPPIERUNG_LABELS`, `GRUPPIERUNG_WOCHEN`) werden aus `use-retouren-plattform-einstellungen` importiert und re-exportiert — eine Quelle der Wahrheit, kein Duplikat
- `PlattformEinstellungenForm` hat nur 3 Felder (kein Erstattungsfeld) — entspricht der Spec, die für Ersatzteile/Kulanz keine plattformweite Erstattungsquote vorsieht
- Kein Berechnungsart-Dropdown in der Produkttabelle — einfachere Struktur als PROJ-47, da nur zwei numerische Felder (Quote + Kosten) gepflegt werden
- `calculateNextPayoutWeek`-Utility aus `use-auszahlungs-einstellungen` wiederverwendet — identisch zu PROJ-45/46/47

### Build
- `npm run build` ✅ — 66 Routen korrekt, `/dashboard/kurzfristige-planung/ersatzteile-kulanz-einstellungen` in der Route-Liste

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_