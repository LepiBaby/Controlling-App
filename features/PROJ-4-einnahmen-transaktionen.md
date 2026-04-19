# PROJ-4: Einnahmen-Transaktionen Eingabe

## Status: Deployed
**Created:** 2026-04-17
**Last Updated:** 2026-04-18

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer können Transaktionen eingeben
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Einnahmen-KPI-Modell muss vor erster Eingabe definiert sein
- Requires: PROJ-9 (Kategorie-Dimensionen) — Sales Plattform / Produkt Flags steuern optionale Spalten

## Übersicht
Manuelle Erfassung und Verwaltung von Einnahmen-Transaktionen (Cash Inflows / tatsächliche Geldzuflüsse). Einnahmen unterscheiden sich von Umsatz: Umsatz ist der wirtschaftliche Erlös (Rentabilität), Einnahmen sind der tatsächliche Geldfluss (Liquidität). Jede Transaktion wird über Dropdown-Felder kategorisiert, deren Ausprägungen direkt aus dem Einnahmen-KPI-Modell stammen.

## User Stories
- Als Nutzer möchte ich eine neue Einnahmen-Transaktion mit Zahlungsdatum, Betrag und Kategorie erfassen können, damit alle Geldzuflüsse vollständig dokumentiert sind.
- Als Nutzer möchte ich Kategorie, Gruppe und Untergruppe über Dropdown-Menüs aus den im KPI-Modell definierten Ausprägungen auswählen können, damit die Transaktion korrekt eingeordnet wird.
- Als Nutzer möchte ich nur die Dropdown-Spalten sehen, die im Einnahmen-KPI-Modell auch tatsächlich befüllt sind, damit die Eingabe übersichtlich bleibt.
- Als Nutzer möchte ich Sales Plattform und/oder Produkt angeben können, wenn diese Dimension für die gewählte Hauptkategorie aktiviert ist.
- Als Nutzer möchte ich alle Einnahmen-Transaktionen in einer Tabelle sehen können, damit ich einen Überblick habe.
- Als Nutzer möchte ich bestehende Transaktionen bearbeiten können, damit Fehler korrigiert werden können.
- Als Nutzer möchte ich Transaktionen löschen können, damit Fehlerfassungen entfernt werden können.
- Als Nutzer möchte ich die Tabelle nach Datum, Betrag und Kategorie filtern/sortieren können.

## Acceptance Criteria

### Tabellen-Spalten (dynamisch)
- [ ] Die Tabelle zeigt immer: **Zahlungsdatum**, **Betrag in €**, **Beschreibung**
- [ ] **Kategorie**-Spalte wird angezeigt, wenn das Einnahmen-KPI-Modell mindestens eine Ebene-1-Kategorie hat (immer der Fall, da KPI-Modell nicht leer sein darf)
- [ ] **Gruppe**-Spalte wird angezeigt, wenn das Einnahmen-KPI-Modell mindestens eine Ebene-2-Kategorie hat
- [ ] **Untergruppe**-Spalte wird angezeigt, wenn das Einnahmen-KPI-Modell mindestens eine Ebene-3-Kategorie hat
- [ ] **Sales Plattform**-Spalte wird angezeigt, wenn mindestens eine Einnahmen-Hauptkategorie `sales_plattform_enabled = true` hat
- [ ] **Produkte**-Spalte wird angezeigt, wenn mindestens eine Einnahmen-Hauptkategorie `produkt_enabled = true` hat
- [ ] Spalten die nicht zutreffen werden vollständig ausgeblendet (nicht nur leer)

### Transaktionseingabe (Formular / Inline)
- [ ] "Neue Transaktion"-Button öffnet ein Eingabeformular (Modal oder Inline-Row)
- [ ] **Zahlungsdatum**: Date-Picker, Pflichtfeld
- [ ] **Betrag**: Zahlfeld in €, positiv, Pflichtfeld; Anzeige mit Tausender-Trennzeichen (z.B. 8.250,00 €)
- [ ] **Kategorie**: Dropdown mit allen Ebene-1-Kategorien aus dem Einnahmen-KPI-Modell, Pflichtfeld
- [ ] **Gruppe**: Dropdown erscheint nur, wenn die gewählte Kategorie Unterkategorien hat; zeigt nur Ebene-2-Kinder der gewählten Kategorie; **Pflichtfeld**, wenn angezeigt
- [ ] **Untergruppe**: Dropdown erscheint nur, wenn die gewählte Gruppe Unterkategorien hat; zeigt nur Ebene-3-Kinder der gewählten Gruppe; **Pflichtfeld**, wenn angezeigt
- [ ] **Sales Plattform**: Dropdown erscheint nur, wenn die gewählte Hauptkategorie `sales_plattform_enabled = true` hat; zeigt alle Einträge aus dem KPI-Modell-Tab "Sales Plattformen"; **Pflichtfeld**, wenn angezeigt
- [ ] **Produkte**: Dropdown erscheint nur, wenn die gewählte Hauptkategorie `produkt_enabled = true` hat; zeigt alle Einträge aus dem KPI-Modell-Tab "Produkte"; **Pflichtfeld**, wenn angezeigt
- [ ] **Beschreibung**: Freitext-Eingabe (String), optional
- [ ] Wenn eine Kategorie keine Unterkategorien hat, gilt sie direkt als finale Kategorisierung (Gruppe bleibt leer/nicht angezeigt)
- [ ] Transaktion kann nur gespeichert werden, wenn alle Pflichtfelder ausgefüllt sind: Zahlungsdatum, Betrag, Kategorie — sowie Gruppe (wenn verfügbar), Untergruppe (wenn verfügbar), Sales Plattform (wenn verfügbar) und Produkt (wenn verfügbar)
- [ ] Gespeicherte Transaktion erscheint sofort in der Tabelle

### Bearbeiten & Löschen
- [ ] Transaktion bearbeiten: Klick auf Zeile oder Edit-Icon öffnet vorausgefülltes Formular
- [ ] Transaktion löschen: Bestätigungs-Dialog vor dem Löschen

### Tabellen-Funktionen
- [ ] Tabelle zeigt alle Transaktionen, neueste zuerst (Standard-Sortierung)
- [ ] Tabelle sortierbar nach: Zahlungsdatum, Betrag (auf-/absteigend)
- [ ] Tabelle filterbar nach: Zeitraum (Von/Bis) und hierarchischen Kategorie-Filtern (siehe unten)
- [ ] Tabelle zeigt Summe aller sichtbaren Transaktionen in der Fußzeile

### Filter-Hierarchie (Kategorie / Gruppe / Untergruppe / Sales Plattform / Produkt)
- [ ] **Kategorie-Filter**: Multi-Select — zeigt alle Einnahmen-Ebene-1-Kategorien; mehrere Auswählbar
- [ ] **Gruppe-Filter**: erscheint nur, wenn bei Kategorie **genau eine** Ausprägung gewählt ist; Multi-Select — zeigt nur Ebene-2-Kinder der gewählten Kategorie; mehrere auswählbar
- [ ] **Untergruppe-Filter**: erscheint nur, wenn Kategorie **genau eine** Ausprägung hat UND Gruppe **genau eine** Ausprägung hat; Multi-Select — zeigt nur Ebene-3-Kinder der gewählten Gruppe
- [ ] Ist bei einer Ebene **mehr als eine** Ausprägung gewählt, werden alle Ebenen darunter **nicht** angezeigt (und deren Filterwerte zurückgesetzt)
- [ ] Wird die Kategorie zurückgesetzt (kein Filter), verschwinden Gruppe- und Untergruppe-Filter
- [ ] Wird die Gruppe zurückgesetzt, verschwindet der Untergruppe-Filter
- [ ] **Sales Plattform-Filter**: erscheint nur, wenn die Sales-Plattform-Spalte sichtbar ist (`showSalesPlattform = true`); Multi-Select — zeigt alle Einträge aus dem KPI-Modell-Tab "Sales Plattformen"; steht rechts neben dem Untergruppe-Filter
- [ ] **Produkt-Filter**: erscheint nur, wenn die Produkte-Spalte sichtbar ist (`showProdukte = true`); Multi-Select — zeigt alle Einträge aus dem KPI-Modell-Tab "Produkte"; steht rechts neben dem Sales Plattform-Filter
- [ ] Sales Plattform- und Produkt-Filter sind unabhängig von den Kategorie-Hierarchie-Filtern (keine Kaskadierung)

## Tabellen-Spalten

| Spalte | Pflicht | Typ | Sichtbarkeit |
|--------|---------|-----|-------------|
| Zahlungsdatum | Ja | Date | Immer |
| Kategorie | Ja | Dropdown (Ebene 1) | Immer (KPI-Modell nie leer) |
| Gruppe | Nein | Dropdown (Ebene 2) | Wenn mind. 1 Ebene-2-Kategorie im Einnahmen-KPI-Modell |
| Untergruppe | Nein | Dropdown (Ebene 3) | Wenn mind. 1 Ebene-3-Kategorie im Einnahmen-KPI-Modell |
| Sales Plattform | Nein | Dropdown (aus KPI-Modell Tab "Sales Plattformen") | Wenn mind. 1 Hauptkategorie `sales_plattform_enabled = true` |
| Produkte | Nein | Dropdown (aus KPI-Modell Tab "Produkte") | Wenn mind. 1 Hauptkategorie `produkt_enabled = true` |
| Beschreibung | Nein | Text (Freitext) | Immer |
| Betrag | Ja | Decimal (€) | Immer |

## Dropdown-Logik (Kaskadierung)

```
Nutzer wählt Kategorie (Ebene 1)
  → Gruppe-Dropdown zeigt Ebene-2-Kinder dieser Kategorie (falls vorhanden)
    → Untergruppe-Dropdown zeigt Ebene-3-Kinder der gewählten Gruppe (falls vorhanden)

Nutzer wählt eine neue Kategorie
  → Gruppe und Untergruppe werden zurückgesetzt

Nutzer wählt eine neue Gruppe
  → Untergruppe wird zurückgesetzt

Sales Plattform und Produkte:
  → Sichtbarkeit abhängig von gewählter Kategorie (sales_plattform_enabled / produkt_enabled)
  → Inhalt der Dropdowns: alle Einträge aus KPI-Modell-Tabs "Sales Plattformen" / "Produkte"
  → Beim Kategoriewechsel: Werte zurücksetzen, wenn neue Kategorie Dimension nicht hat
```

## Edge Cases
- Kein Einnahmen-KPI-Modell vorhanden → Hinweis "Bitte zuerst KPI-Modell unter Einstellungen definieren" mit Link zur KPI-Verwaltung
- Betrag = 0 oder negativ → Validierungsfehler
- Datum in der Zukunft → Warnung, aber nicht blockiert (Vorauserfassung möglich)
- Kategorie hat keine Unterkategorien → Gruppe-Dropdown nicht angezeigt; Kategorie ist finale Kategorisierung; Speichern ohne Gruppe möglich
- Gruppe hat keine Unterkategorien → Untergruppe-Dropdown nicht angezeigt; Speichern ohne Untergruppe möglich
- Nutzer wechselt Kategorie nach Auswahl einer Gruppe → Gruppe wird zurückgesetzt und muss neu gewählt werden (Pflichtfeld erneut offen)
- Kategorie aus KPI-Modell wird nach Erfassung umbenannt → Gespeicherte ID bleibt erhalten, Anzeige zeigt neuen Namen
- Kategorie aus KPI-Modell wird gelöscht → Transaktion zeigt "[Kategorie gelöscht]" und muss re-kategorisiert werden
- Sales Plattform-Dimension wird nach Erfassung deaktiviert → Bestehende Transaktionen behalten gespeicherten Wert, Spalte bleibt sichtbar solange mind. 1 Kategorie Dimension hat
- Sehr viele Transaktionen (1000+) → Paginierung (50 pro Seite)
- Keine Sales Plattformen im KPI-Modell definiert, aber Dimension ist aktiviert → Dropdown zeigt leere Liste mit Hinweis "Keine Sales Plattformen definiert"

## Technical Requirements
- Tabellen-Name in Supabase: `einnahmen_transaktionen`
- Spalten: `id`, `zahlungsdatum` (date), `betrag` (decimal 15,2), `kategorie_id` (FK → kpi_categories, Ebene 1), `gruppe_id` (FK → kpi_categories, Ebene 2, nullable), `untergruppe_id` (FK → kpi_categories, Ebene 3, nullable), `sales_plattform_id` (FK → kpi_categories type=sales_plattformen, nullable), `produkt_id` (FK → kpi_categories type=produkte, nullable), `beschreibung` (text, nullable), `created_at`
- Sichtbarkeit der Spalten wird client-seitig anhand der KPI-Modell-Daten berechnet (kein separater API-Call)
- RLS: Nur eingeloggte Nutzer können lesen/schreiben
- Beträge als `decimal(15,2)` gespeichert

## Filter-Datenmodell

```
EinnahmenFilter:
  von?:                  string (YYYY-MM-DD)
  bis?:                  string (YYYY-MM-DD)
  kategorie_ids?:        string[]   ← Array (Multi-Select, Ebene 1)
  gruppe_ids?:           string[]   ← Array (Multi-Select, Ebene 2) — nur relevant wenn kategorie_ids.length === 1
  untergruppe_ids?:      string[]   ← Array (Multi-Select, Ebene 3) — nur relevant wenn kategorie_ids.length === 1 UND gruppe_ids.length === 1
  sales_plattform_ids?:  string[]   ← Array (Multi-Select, unabhängig) — nur sichtbar wenn showSalesPlattform
  produkt_ids?:          string[]   ← Array (Multi-Select, unabhängig) — nur sichtbar wenn showProdukte

Filter-Sichtbarkeitslogik (UI):
  showGruppeFilter          = kategorie_ids?.length === 1
  showUntergruppeFilter     = kategorie_ids?.length === 1 && gruppe_ids?.length === 1
  showSalesPlattformFilter  = showSalesPlattform (mind. 1 Kategorie mit sales_plattform_enabled=true)
  showProduktFilter         = showProdukte (mind. 1 Kategorie mit produkt_enabled=true)

API-Filterung (GET /api/einnahmen-transaktionen):
  kategorie_ids       → WHERE kategorie_id IN (...)
  gruppe_ids          → WHERE gruppe_id IN (...)           (nur wenn kategorie_ids.length === 1)
  untergruppe_ids     → WHERE untergruppe_id IN (...)      (nur wenn beide übergeordneten Filter === 1)
  sales_plattform_ids → WHERE sales_plattform_id IN (...)  (unabhängig)
  produkt_ids         → WHERE produkt_id IN (...)          (unabhängig)
```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
/dashboard/einnahmen  (src/app/dashboard/einnahmen/page.tsx)
+-- PageHeader ("Einnahmen")
+-- FilterBar
|   +-- DateRangePicker (Von / Bis)
|   +-- KategorieFilter (Select, Ebene-1-Kategorien)
+-- "Neue Transaktion"-Button
|
+-- EinnahmenTable  (src/components/einnahmen-table.tsx)
|   +-- Dynamische Spalten-Header (Zahlungsdatum | Kategorie | [Gruppe] | [Untergruppe] | [Sales Plattform] | [Produkte] | Beschreibung | Betrag)
|   +-- EinnahmenTableRow (pro Transaktion)
|   |   +-- Edit-Icon → öffnet EinnahmenFormDialog vorausgefüllt
|   |   +-- Delete-Icon → öffnet DeleteConfirmDialog
|   +-- Tabellen-Fußzeile (Summe sichtbarer Transaktionen)
|   +-- Pagination (shadcn: Pagination, 50 pro Seite)
|
+-- EinnahmenFormDialog  (src/components/einnahmen-form-dialog.tsx)
|   +-- shadcn Dialog
|   +-- Zahlungsdatum (Input type=date, Pflichtfeld)
|   +-- Betrag in € (Input type=number, Pflichtfeld)
|   +-- Kategorie (Select, Ebene-1, Pflichtfeld)
|   +-- [Gruppe] (Select, Ebene-2-Kinder der gewählten Kategorie — nur wenn vorhanden)
|   +-- [Untergruppe] (Select, Ebene-3-Kinder der gewählten Gruppe — nur wenn vorhanden)
|   +-- [Sales Plattform] (Select — nur wenn gewählte Kategorie sales_plattform_enabled=true)
|   +-- [Produkte] (Select — nur wenn gewählte Kategorie produkt_enabled=true)
|   +-- Beschreibung (Textarea, optional)
|   +-- Speichern / Abbrechen Buttons
|
+-- DeleteConfirmDialog (shadcn: AlertDialog — bereits vorhanden)
+-- EmptyState ("Noch keine Einnahmen erfasst. Klicken Sie auf Neue Transaktion.")
+-- NoKpiModelState ("Kein KPI-Modell definiert. → Link zur KPI-Verwaltung")
```

### Datenmodell

```
Neue Tabelle: einnahmen_transaktionen

Jede Transaktion speichert:
- id                UUID, Primärschlüssel
- zahlungsdatum     Datum des Geldeingangs
- betrag            Geldbetrag in EUR (15 Stellen, 2 Nachkommastellen)
- kategorie_id      Pflicht-Verweis auf eine Ebene-1-Kategorie im Einnahmen-KPI-Modell
- gruppe_id         Optionaler Verweis auf Ebene-2-Kind der gewählten Kategorie
- untergruppe_id    Optionaler Verweis auf Ebene-3-Kind der gewählten Gruppe
- sales_plattform_id  Optionaler Verweis auf KPI-Kategorie vom Typ "Sales Plattformen"
- produkt_id        Optionaler Verweis auf KPI-Kategorie vom Typ "Produkte"
- beschreibung      Freitext-Notiz (optional)
- created_at        Erstellungszeitpunkt (automatisch)

Alle Kategorie-Verweise zeigen auf die bestehende kpi_categories-Tabelle.
Wird eine Kategorie gelöscht: FK wird auf NULL gesetzt (SET NULL), Anzeige zeigt "[Kategorie gelöscht]"
```

### API-Routen

```
GET    /api/einnahmen-transaktionen               → Alle Transaktionen (gefiltert + paginiert)
POST   /api/einnahmen-transaktionen               → Neue Transaktion anlegen
PATCH  /api/einnahmen-transaktionen/[id]          → Transaktion bearbeiten
DELETE /api/einnahmen-transaktionen/[id]          → Transaktion löschen
```

### Datenfluss: Dynamische Spalten-Sichtbarkeit

```
Beim Laden der Seite:
1. KPI-Kategorien für "einnahmen" werden geladen (bestehender Hook use-kpi-categories)
2. KPI-Kategorien für "sales_plattformen" und "produkte" werden ebenfalls geladen
3. Client berechnet Spalten-Flags:
   - showGruppe          = mind. 1 Einnahmen-Kategorie auf Ebene 2 vorhanden
   - showUntergruppe     = mind. 1 Einnahmen-Kategorie auf Ebene 3 vorhanden
   - showSalesPlattform  = mind. 1 Ebene-1-Einnahmen-Kategorie mit sales_plattform_enabled=true
   - showProdukte        = mind. 1 Ebene-1-Einnahmen-Kategorie mit produkt_enabled=true
4. Tabelle und Formular nutzen diese Flags — kein Extra-API-Call nötig
```

### Datenfluss: Kaskadierungs-Logik im Formular

```
Nutzer wählt Kategorie (Ebene 1)
  → Gruppe-Dropdown zeigt nur Kinder dieser Kategorie
  → Untergruppe wird zurückgesetzt
  → Sales Plattform: Dropdown erscheint / verschwindet je nach sales_plattform_enabled
  → Produkte: Dropdown erscheint / verschwindet je nach produkt_enabled

Nutzer wählt Gruppe (Ebene 2)
  → Untergruppe-Dropdown zeigt nur Kinder dieser Gruppe
  → Untergruppe wird zurückgesetzt

Alle Dropdown-Daten kommen aus dem bereits geladenen KPI-Modell (kein Extra-Call)
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Spalten-Sichtbarkeit | Client-seitig berechnet | KPI-Daten sind ohnehin für Dropdowns nötig — kein Extra-API-Call |
| Formular-Pattern | Modal (shadcn Dialog) | Konsistent mit dem Rest der App; kein Seitenwechsel |
| Kategorie-Kaskadierung | Gefilterter Client-State | Alle KPI-Daten sind bereits geladen; keine Server-Roundtrips beim Tippen |
| FK bei Kategorie-Löschen | SET NULL (kein CASCADE) | Transaktionsdaten bleiben erhalten; UI zeigt "[Kategorie gelöscht]" |
| Paginierung | 50 pro Seite (shadcn Pagination) | Bereits installiert; einfachste Lösung für 1000+ Zeilen |
| Betrag-Format | Lokalisiert: 8.250,00 € | Tojs `Intl.NumberFormat` ohne Extra-Package |
| Sortierung | Server-seitig (Query-Parameter) | Einfacher als client-seitiges Sortieren bei paginierter Tabelle |

### Neue Dateien

```
src/app/dashboard/einnahmen/page.tsx             — Hauptseite (Client Component)
src/components/einnahmen-table.tsx               — Tabelle mit dynamischen Spalten
src/components/einnahmen-form-dialog.tsx         — Formular für Anlegen + Bearbeiten
src/hooks/use-einnahmen-transaktionen.ts         — API-Calls + State-Management
src/app/api/einnahmen-transaktionen/route.ts     — GET + POST
src/app/api/einnahmen-transaktionen/[id]/route.ts — PATCH + DELETE
```

### Geänderte Dateien

```
src/app/dashboard/page.tsx    — Link zur neuen Einnahmen-Seite ergänzen
```

### Keine neuen Packages
Alle benötigten shadcn/ui-Komponenten sind bereits installiert:
Select, Dialog, AlertDialog, Table, Input, Textarea, Button, Pagination, Popover

## Implementation Notes (Frontend)
- `src/hooks/use-einnahmen-transaktionen.ts` — Hook mit EinnahmenTransaktion-Typen, Filter/Sort/Pagination-State, CRUD-Methoden (addTransaktion, updateTransaktion, deleteTransaktion); refetch-basiert (kein optimistisches Update, da totalBetrag vom Server kommt)
- `src/components/einnahmen-form-dialog.tsx` — Modal-Formular für Anlegen + Bearbeiten; kaskadierende Dropdowns (Kategorie → Gruppe → Untergruppe); Sales Plattform + Produkte erscheinen nur wenn gewählte Kategorie-Flags `sales_plattform_enabled`/`produkt_enabled` aktiv; Zukunfts-Datum-Warnung; Validierung vor Save
- `src/components/einnahmen-table.tsx` — Tabelle mit dynamischen Spalten (Gruppe/Untergruppe/Sales Plattform/Produkt conditional via ColumnVisibility); sortierbare Header (Zahlungsdatum, Betrag); Footer mit Gesamtsumme; Pagination (50/Seite); Category-Name-Lookup aus flacher KPI-Kategorien-Liste
- `src/app/dashboard/einnahmen/page.tsx` — Client Component; lädt 3x useKpiCategories ('einnahmen', 'sales_plattformen', 'produkte'); berechnet ColumnVisibility client-seitig; hierarchische MultiSelect-Filter (Kategorie/Gruppe/Untergruppe) mit kaskadierende Sichtbarkeitslogik; "Kein KPI-Modell"-State mit Link; koordiniert FormDialog + DeleteConfirmDialog
- `src/components/multi-select.tsx` — Wiederverwendbare Multi-Select-Komponente (Popover + Checkbox); zeigt Anzahl der Auswahlen oder einzelnen Namen im Label
- `src/app/dashboard/page.tsx` — "Einnahmen"-Navigationskarte ergänzt

## Implementation Notes (Backend)
- DB-Migration: `einnahmen_transaktionen`-Tabelle mit `DECIMAL(15,2) CHECK (betrag > 0)`, 5 nullable FK-Spalten auf `kpi_categories` mit `ON DELETE SET NULL`, RLS für alle 4 Operationen (authenticated users), Indizes auf `zahlungsdatum`, `betrag`, `kategorie_id`
- `GET /api/einnahmen-transaktionen`: Filter (von/bis/kategorie_ids[]/gruppe_ids[]/untergruppe_ids[] als komma-separierte Query-Parameter, `.in()` statt `.eq()`), Sortierung (zahlungsdatum/betrag + asc/desc), Pagination (50/Seite), gibt `{ data, total, totalBetrag }` zurück — `totalBetrag` als Summe über alle gefilterten Zeilen (nicht nur aktuelle Seite)
- `POST /api/einnahmen-transaktionen`: Zod-Validierung (zahlungsdatum-Regex, betrag > 0, kategorie_id UUID); alle FK-Felder nullable; gibt 201 zurück
- `PATCH /api/einnahmen-transaktionen/[id]`: Partial-Update mit patchSchema; gibt 400 bei leerem Body; gibt 404 wenn nicht gefunden
- `DELETE /api/einnahmen-transaktionen/[id]`: Löscht Transaktion; gibt 204 zurück
- Bugfix Zod v4: Tests verwenden gültige UUIDs (Zod v4 lehnt alle-Null-UUIDs ab)
- Vitest Unit-Tests: 18 neue Tests (GET/POST/PATCH/DELETE) — alle 81 Tests grün

## QA Test Results

**Date:** 2026-04-19
**Tester:** /qa skill
**Build:** All 81 unit tests ✅ | All 39 E2E tests ✅

### Acceptance Criteria Results

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Tabelle zeigt immer: Zahlungsdatum, Betrag, Beschreibung | ✅ Pass |
| 2 | Gruppe-Spalte erscheint wenn mind. 1 Ebene-2-Kategorie | ✅ Pass (verified by code: `showGruppe = einnahmenKategorien.some(c => c.level === 2)`) |
| 3 | Untergruppe-Spalte erscheint wenn mind. 1 Ebene-3-Kategorie | ✅ Pass |
| 4 | Sales Plattform-Spalte erscheint wenn mind. 1 Kategorie `sales_plattform_enabled=true` | ✅ Pass |
| 5 | Produkte-Spalte erscheint wenn mind. 1 Kategorie `produkt_enabled=true` | ✅ Pass |
| 6 | Nicht zutreffende Spalten vollständig ausgeblendet | ✅ Pass (conditional rendering in einnahmen-table.tsx) |
| 7 | "Neue Transaktion"-Button öffnet Modal | ✅ Pass |
| 8 | Zahlungsdatum: Pflichtfeld | ✅ Pass |
| 9 | Betrag: positiv, Pflichtfeld | ✅ Pass |
| 10 | Kategorie: Dropdown Ebene-1, Pflichtfeld | ✅ Pass |
| 11 | Gruppe: erscheint nur wenn Kategorie Kinder hat; Pflichtfeld wenn angezeigt | ✅ Pass |
| 12 | Untergruppe: erscheint nur wenn Gruppe Kinder hat; Pflichtfeld wenn angezeigt | ✅ Pass |
| 13 | Sales Plattform: erscheint wenn `sales_plattform_enabled=true`; Pflichtfeld wenn angezeigt | ✅ Pass |
| 14 | Produkte: erscheint wenn `produkt_enabled=true`; Pflichtfeld wenn angezeigt | ✅ Pass |
| 15 | Beschreibung: optional | ✅ Pass |
| 16 | Speichern nur möglich wenn alle Pflichtfelder ausgefüllt | ✅ Pass (isValid guard in form) |
| 17 | Transaktion bearbeiten: vorausgefülltes Formular | ✅ Pass (manually verified) |
| 18 | Transaktion löschen: Bestätigungs-Dialog | ✅ Pass (manually verified) |
| 19 | Standard-Sortierung: neueste zuerst (zahlungsdatum DESC) | ✅ Pass |
| 20 | Tabelle sortierbar nach Zahlungsdatum, Betrag | ✅ Pass |
| 21 | Tabelle filterbar nach Zeitraum und Kategorie-Filtern | ✅ Pass |
| 22 | Footer zeigt Summe aller gefilterten Transaktionen | ✅ Pass (server-side sum query) |
| 23 | Kategorie-Filter: Multi-Select, alle Ebene-1-Kategorien | ✅ Pass |
| 24 | Gruppe-Filter: erscheint nur bei genau 1 Kategorie-Auswahl | ✅ Pass |
| 25 | Untergruppe-Filter: erscheint nur bei genau 1 Kategorie + 1 Gruppe | ✅ Pass |
| 26 | >1 Auswahl auf Elternebene → Kindfilter ausgeblendet und zurückgesetzt | ✅ Pass |
| 27 | Kategorie zurückgesetzt → Gruppe- und Untergruppe-Filter verschwinden | ✅ Pass |
| 28 | Sales Plattform-Filter: Multi-Select, erscheint wenn `showSalesPlattform=true` | ✅ Pass |
| 29 | Produkt-Filter: Multi-Select, erscheint wenn `showProdukte=true` | ✅ Pass |
| 30 | Sales Plattform- und Produkt-Filter unabhängig von Kategorie-Hierarchie | ✅ Pass |

**All 30 acceptance criteria: PASSED**

### Edge Cases

| Edge Case | Status |
|-----------|--------|
| Kein KPI-Modell → Hinweis mit Link | ✅ Pass |
| Betrag = 0 → Save blockiert | ✅ Pass |
| Datum in der Zukunft → Warnung, nicht blockiert | ✅ Pass |
| Kategorie ohne Unterkategorien → Gruppe nicht angezeigt, Speichern möglich | ✅ Pass |
| Gruppe ohne Unterkategorien → Untergruppe nicht angezeigt | ✅ Pass |
| Kategoriewechsel → Gruppe/Untergruppe/SalesPlattform/Produkt zurückgesetzt | ✅ Pass |

### Security Audit

| Check | Status |
|-------|--------|
| `/dashboard/einnahmen` → Redirect zu /login wenn nicht eingeloggt | ✅ Pass (E2E test) |
| GET /api/einnahmen-transaktionen → 401 wenn unauthenticated | ✅ Pass (unit test + E2E) |
| POST /api/einnahmen-transaktionen → 401 wenn unauthenticated | ✅ Pass (unit test + E2E) |
| PATCH /api/einnahmen-transaktionen/[id] → 401 wenn unauthenticated | ✅ Pass (unit test + E2E) |
| DELETE /api/einnahmen-transaktionen/[id] → 401 wenn unauthenticated | ✅ Pass (unit test + E2E) |
| Zod-Validierung auf alle POST/PATCH Inputs | ✅ Pass |
| RLS: Supabase-seitige Absicherung (zweite Schutzebene) | ✅ Pass (Migration verifiziert) |
| Keine Secrets im Client-Code | ✅ Pass |

### Bugs Found

| # | Severity | Description |
|---|----------|-------------|
| 1 | Low | `const NONE = '__none__'` in `einnahmen-form-dialog.tsx` ist ungenutzt (wurde nach Refactoring zu Pflichtfeldern nicht entfernt) |

### Automated Tests

- **Vitest unit tests:** 81 passed (18 new for PROJ-4 GET/POST/PATCH/DELETE)
- **E2E tests new:** 9 passed (`tests/PROJ-4-einnahmen-transaktionen.spec.ts`)
- **E2E tests total:** 39 passed (0 regressions)

### Production-Ready Decision

✅ **READY** — Alle Acceptance Criteria erfüllt. Kein Critical/High Bug. 1 Low-Bug (ungenutzter Import) kann vor oder nach Deployment behoben werden.

## Deployment

**Deployed:** 2026-04-19
**Commit:** 7bddf6d
**Branch:** main → Vercel auto-deploy
**Tag:** v1.4.0-PROJ-4
