# PROJ-3: Umsatz-Transaktionen Eingabe

## Status: In Progress
**Created:** 2026-04-17
**Last Updated:** 2026-04-19

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer können Transaktionen eingeben
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Umsatz-KPI-Modell muss vor erster Eingabe definiert sein
- Requires: PROJ-9 (Kategorie-Dimensionen) — Sales Plattform / Produkt Flags steuern optionale Spalten

## Übersicht
Manuelle Erfassung und Verwaltung von Umsatz-Transaktionen (Erlöse / wirtschaftliche Leistungen). Umsatz unterscheidet sich von Einnahmen: Umsatz ist der wirtschaftliche Erlös (Rentabilität), Einnahmen sind der tatsächliche Geldfluss (Liquidität). Jede Transaktion wird über Dropdown-Felder kategorisiert, deren Ausprägungen direkt aus dem Umsatz-KPI-Modell stammen. UI und Logik entsprechen PROJ-4 (Einnahmen-Transaktionen) — einziger Unterschied: das Datum heißt **Leistungsdatum** statt Zahlungsdatum.

## User Stories
- Als Nutzer möchte ich eine neue Umsatz-Transaktion mit Leistungsdatum, Betrag und Kategorie erfassen können, damit alle Erlöse vollständig dokumentiert sind.
- Als Nutzer möchte ich Kategorie, Gruppe und Untergruppe über Dropdown-Menüs aus den im KPI-Modell definierten Ausprägungen auswählen können, damit die Transaktion korrekt eingeordnet wird.
- Als Nutzer möchte ich nur die Dropdown-Spalten sehen, die im Umsatz-KPI-Modell auch tatsächlich befüllt sind, damit die Eingabe übersichtlich bleibt.
- Als Nutzer möchte ich Sales Plattform und/oder Produkt angeben können, wenn diese Dimension für die gewählte Hauptkategorie aktiviert ist.
- Als Nutzer möchte ich alle Umsatz-Transaktionen in einer Tabelle sehen können, damit ich einen Überblick habe.
- Als Nutzer möchte ich bestehende Transaktionen bearbeiten können, damit Fehler korrigiert werden können.
- Als Nutzer möchte ich Transaktionen löschen können, damit Fehlerfassungen entfernt werden können.
- Als Nutzer möchte ich die Tabelle nach Datum, Betrag und Kategorie filtern/sortieren können.

## Acceptance Criteria

### Tabellen-Spalten (dynamisch)
- [ ] Die Tabelle zeigt immer: **Leistungsdatum**, **Betrag in €**, **Beschreibung**
- [ ] **Kategorie**-Spalte wird angezeigt, wenn das Umsatz-KPI-Modell mindestens eine Ebene-1-Kategorie hat (immer der Fall, da KPI-Modell nicht leer sein darf)
- [ ] **Gruppe**-Spalte wird angezeigt, wenn das Umsatz-KPI-Modell mindestens eine Ebene-2-Kategorie hat
- [ ] **Untergruppe**-Spalte wird angezeigt, wenn das Umsatz-KPI-Modell mindestens eine Ebene-3-Kategorie hat
- [ ] **Sales Plattform**-Spalte wird angezeigt, wenn mindestens eine Umsatz-Hauptkategorie `sales_plattform_enabled = true` hat
- [ ] **Produkte**-Spalte wird angezeigt, wenn mindestens eine Umsatz-Hauptkategorie `produkt_enabled = true` hat
- [ ] Spalten die nicht zutreffen werden vollständig ausgeblendet (nicht nur leer)

### Transaktionseingabe (Formular)
- [ ] "Neue Transaktion"-Button öffnet ein Eingabeformular (Modal)
- [ ] **Leistungsdatum**: Date-Picker, Pflichtfeld
- [ ] **Betrag**: Zahlfeld in €, positiv, Pflichtfeld; Anzeige mit Tausender-Trennzeichen (z.B. 8.250,00 €)
- [ ] **Kategorie**: Dropdown mit allen Ebene-1-Kategorien aus dem Umsatz-KPI-Modell, Pflichtfeld
- [ ] **Gruppe**: Dropdown erscheint nur, wenn die gewählte Kategorie Unterkategorien hat; zeigt nur Ebene-2-Kinder der gewählten Kategorie; **Pflichtfeld**, wenn angezeigt
- [ ] **Untergruppe**: Dropdown erscheint nur, wenn die gewählte Gruppe Unterkategorien hat; zeigt nur Ebene-3-Kinder der gewählten Gruppe; **Pflichtfeld**, wenn angezeigt
- [ ] **Sales Plattform**: Dropdown erscheint nur, wenn die gewählte Hauptkategorie `sales_plattform_enabled = true` hat; zeigt alle Einträge aus dem KPI-Modell-Tab "Sales Plattformen"; **Pflichtfeld**, wenn angezeigt
- [ ] **Produkte**: Dropdown erscheint nur, wenn die gewählte Hauptkategorie `produkt_enabled = true` hat; zeigt alle Einträge aus dem KPI-Modell-Tab "Produkte"; **Pflichtfeld**, wenn angezeigt
- [ ] **Beschreibung**: Freitext-Eingabe (String), optional
- [ ] Wenn eine Kategorie keine Unterkategorien hat, gilt sie direkt als finale Kategorisierung (Gruppe bleibt leer/nicht angezeigt)
- [ ] Transaktion kann nur gespeichert werden, wenn alle Pflichtfelder ausgefüllt sind: Leistungsdatum, Betrag, Kategorie — sowie Gruppe (wenn verfügbar), Untergruppe (wenn verfügbar), Sales Plattform (wenn verfügbar) und Produkt (wenn verfügbar)
- [ ] Gespeicherte Transaktion erscheint sofort in der Tabelle

### Bearbeiten & Löschen
- [ ] Transaktion bearbeiten: Edit-Icon öffnet vorausgefülltes Formular
- [ ] Transaktion löschen: Bestätigungs-Dialog vor dem Löschen

### Tabellen-Funktionen
- [ ] Tabelle zeigt alle Transaktionen, neueste zuerst (Standard-Sortierung nach Leistungsdatum DESC)
- [ ] Tabelle sortierbar nach: Leistungsdatum, Betrag (auf-/absteigend)
- [ ] Tabelle filterbar nach: Zeitraum (Von/Bis) und hierarchischen Kategorie-Filtern (siehe unten)
- [ ] Tabelle zeigt Summe aller gefilterten Transaktionen in der Fußzeile (server-seitige Summe, nicht nur aktuelle Seite)

### Filter-Hierarchie (Kategorie / Gruppe / Untergruppe / Sales Plattform / Produkt)
- [ ] **Kategorie-Filter**: Multi-Select — zeigt alle Umsatz-Ebene-1-Kategorien; mehrere auswählbar
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
| Leistungsdatum | Ja | Date | Immer |
| Kategorie | Ja | Dropdown (Ebene 1) | Immer (KPI-Modell nie leer) |
| Gruppe | Nein | Dropdown (Ebene 2) | Wenn mind. 1 Ebene-2-Kategorie im Umsatz-KPI-Modell |
| Untergruppe | Nein | Dropdown (Ebene 3) | Wenn mind. 1 Ebene-3-Kategorie im Umsatz-KPI-Modell |
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
- Kein Umsatz-KPI-Modell vorhanden → Hinweis "Bitte zuerst KPI-Modell unter Einstellungen definieren" mit Link zur KPI-Verwaltung
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
- Tabellen-Name in Supabase: `umsatz_transaktionen`
- Spalten: `id`, `leistungsdatum` (date), `betrag` (decimal 15,2), `kategorie_id` (FK → kpi_categories, Ebene 1), `gruppe_id` (FK → kpi_categories, Ebene 2, nullable), `untergruppe_id` (FK → kpi_categories, Ebene 3, nullable), `sales_plattform_id` (FK → kpi_categories type=sales_plattformen, nullable), `produkt_id` (FK → kpi_categories type=produkte, nullable), `beschreibung` (text, nullable), `created_at`
- Sichtbarkeit der Spalten wird client-seitig anhand der KPI-Modell-Daten berechnet (kein separater API-Call)
- RLS: Nur eingeloggte Nutzer können lesen/schreiben
- Beträge als `decimal(15,2)` gespeichert

## Filter-Datenmodell

```
UmsatzFilter:
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

API-Filterung (GET /api/umsatz-transaktionen):
  von/bis             → WHERE leistungsdatum >= / <=
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
/dashboard/umsatz  (src/app/dashboard/umsatz/page.tsx)
+-- PageHeader ("Umsatz")
+-- FilterBar
|   +-- DateRangePicker (Von / Bis)
|   +-- KategorieFilter (MultiSelect, Ebene-1-Kategorien)
|   +-- [GruppeFilter]  (MultiSelect — nur wenn genau 1 Kategorie gewählt)
|   +-- [UntergruppeFilter]  (MultiSelect — nur wenn genau 1 Gruppe gewählt)
|   +-- [SalesPlattformFilter]  (MultiSelect — wenn showSalesPlattform=true)
|   +-- [ProduktFilter]  (MultiSelect — wenn showProdukte=true)
|   +-- Filter zurücksetzen (Button)
+-- "Neue Transaktion"-Button
|
+-- UmsatzTable  (src/components/umsatz-table.tsx)
|   +-- Dynamische Spalten-Header (Leistungsdatum | Kategorie | [Gruppe] | [Untergruppe] | [Sales Plattform] | [Produkte] | Beschreibung | Betrag)
|   +-- UmsatzTableRow (pro Transaktion)
|   |   +-- Edit-Icon → öffnet UmsatzFormDialog vorausgefüllt
|   |   +-- Delete-Icon → öffnet DeleteConfirmDialog
|   +-- Tabellen-Fußzeile (Summe aller gefilterten Transaktionen)
|   +-- Pagination (shadcn: Pagination, 50 pro Seite)
|
+-- UmsatzFormDialog  (src/components/umsatz-form-dialog.tsx)
|   +-- shadcn Dialog
|   +-- Leistungsdatum (Input type=date, Pflichtfeld)
|   +-- Betrag in € (Input type=number, Pflichtfeld)
|   +-- Kategorie (Select, Ebene-1, Pflichtfeld)
|   +-- [Gruppe] (Select, Ebene-2-Kinder der gewählten Kategorie — nur wenn vorhanden, Pflichtfeld)
|   +-- [Untergruppe] (Select, Ebene-3-Kinder der gewählten Gruppe — nur wenn vorhanden, Pflichtfeld)
|   +-- [Sales Plattform] (Select — nur wenn gewählte Kategorie sales_plattform_enabled=true, Pflichtfeld)
|   +-- [Produkte] (Select — nur wenn gewählte Kategorie produkt_enabled=true, Pflichtfeld)
|   +-- Beschreibung (Textarea, optional)
|   +-- Speichern / Abbrechen Buttons
|
+-- DeleteConfirmDialog (shadcn: AlertDialog — bereits vorhanden)
+-- EmptyState ("Noch keine Umsatz-Transaktionen erfasst. Klicken Sie auf Neue Transaktion.")
+-- NoKpiModelState ("Kein Umsatz-KPI-Modell definiert. → Link zur KPI-Verwaltung")
```

### Datenmodell

```
Neue Tabelle: umsatz_transaktionen

Jede Transaktion speichert:
- id                  UUID, Primärschlüssel
- leistungsdatum      Datum der wirtschaftlichen Leistungserbringung
- betrag              Erlösbetrag in EUR (15 Stellen, 2 Nachkommastellen)
- kategorie_id        Pflicht-Verweis auf eine Ebene-1-Kategorie im Umsatz-KPI-Modell
- gruppe_id           Optionaler Verweis auf Ebene-2-Kind der gewählten Kategorie
- untergruppe_id      Optionaler Verweis auf Ebene-3-Kind der gewählten Gruppe
- sales_plattform_id  Optionaler Verweis auf KPI-Kategorie vom Typ "Sales Plattformen"
- produkt_id          Optionaler Verweis auf KPI-Kategorie vom Typ "Produkte"
- beschreibung        Freitext-Notiz (optional)
- created_at          Erstellungszeitpunkt (automatisch)

Alle Kategorie-Verweise zeigen auf die bestehende kpi_categories-Tabelle.
Wird eine Kategorie gelöscht: FK wird auf NULL gesetzt (SET NULL), Anzeige zeigt "[Kategorie gelöscht]"
```

### API-Routen

```
GET    /api/umsatz-transaktionen               → Alle Transaktionen (gefiltert + paginiert)
POST   /api/umsatz-transaktionen               → Neue Transaktion anlegen
PATCH  /api/umsatz-transaktionen/[id]          → Transaktion bearbeiten
DELETE /api/umsatz-transaktionen/[id]          → Transaktion löschen
```

### Datenfluss: Dynamische Spalten-Sichtbarkeit

```
Beim Laden der Seite:
1. KPI-Kategorien für "umsatz" werden geladen (bestehender Hook use-kpi-categories)
2. KPI-Kategorien für "sales_plattformen" und "produkte" werden ebenfalls geladen
3. Client berechnet Spalten-Flags:
   - showGruppe          = mind. 1 Umsatz-Kategorie auf Ebene 2 vorhanden
   - showUntergruppe     = mind. 1 Umsatz-Kategorie auf Ebene 3 vorhanden
   - showSalesPlattform  = mind. 1 Ebene-1-Umsatz-Kategorie mit sales_plattform_enabled=true
   - showProdukte        = mind. 1 Ebene-1-Umsatz-Kategorie mit produkt_enabled=true
4. Tabelle und Formular nutzen diese Flags — kein Extra-API-Call nötig
```

### Datenfluss: Kaskadierungs-Logik im Formular

```
Nutzer wählt Kategorie (Ebene 1)
  → Gruppe-Dropdown zeigt nur Kinder dieser Kategorie (falls vorhanden)
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
| Formular-Pattern | Modal (shadcn Dialog) | Konsistent mit Einnahmen-Seite und restlicher App |
| Kategorie-Kaskadierung | Gefilterter Client-State | Alle KPI-Daten sind bereits geladen; keine Server-Roundtrips |
| FK bei Kategorie-Löschen | SET NULL (kein CASCADE) | Transaktionsdaten bleiben erhalten; UI zeigt "[Kategorie gelöscht]" |
| Paginierung | 50 pro Seite (shadcn Pagination) | Konsistent mit Einnahmen; bereits installiert |
| Betrag-Format | Lokalisiert: 8.250,00 € | `Intl.NumberFormat` ohne Extra-Package |
| Sortierung | Server-seitig (Query-Parameter) | Konsistent mit Einnahmen; korrekt bei Pagination |
| Wiederverwendung | multi-select.tsx, useKpiCategories | Bereits vorhanden — keine Neuimplementierung nötig |

### Neue Dateien

```
src/app/dashboard/umsatz/page.tsx             — Hauptseite (Client Component)
src/components/umsatz-table.tsx               — Tabelle mit dynamischen Spalten
src/components/umsatz-form-dialog.tsx         — Formular für Anlegen + Bearbeiten
src/hooks/use-umsatz-transaktionen.ts         — API-Calls + State-Management
src/app/api/umsatz-transaktionen/route.ts     — GET + POST
src/app/api/umsatz-transaktionen/[id]/route.ts — PATCH + DELETE
```

### Geänderte Dateien

```
src/app/dashboard/page.tsx    — Link zur neuen Umsatz-Seite ergänzen
```

### Keine neuen Packages
Alle benötigten shadcn/ui-Komponenten sind bereits installiert:
Select, Dialog, AlertDialog, Table, Input, Textarea, Button, Pagination, Popover, Checkbox

### Wiederverwendung aus PROJ-4
PROJ-3 ist strukturell identisch mit PROJ-4 (Einnahmen-Transaktionen). Die folgenden Dateien werden direkt adaptiert:

| PROJ-4 Datei | PROJ-3 Äquivalent | Änderungen |
|---|---|---|
| `einnahmen-form-dialog.tsx` | `umsatz-form-dialog.tsx` | "zahlungsdatum" → "leistungsdatum"; Props/Types umbenennen |
| `einnahmen-table.tsx` | `umsatz-table.tsx` | "zahlungsdatum" → "leistungsdatum"; Types umbenennen |
| `use-einnahmen-transaktionen.ts` | `use-umsatz-transaktionen.ts` | Endpoint `/api/umsatz-transaktionen`; Types umbenennen |
| `einnahmen/page.tsx` | `umsatz/page.tsx` | KPI-Typ "umsatz" statt "einnahmen"; Label-Texte anpassen |
| API `einnahmen-transaktionen/` | API `umsatz-transaktionen/` | Tabelle `umsatz_transaktionen`; Spalte `leistungsdatum` |

`multi-select.tsx` und `use-kpi-categories.ts` werden unverändert wiederverwendet.

## Implementation Notes (Backend)
- DB-Migration: `umsatz_transaktionen`-Tabelle mit `DECIMAL(15,2) CHECK (betrag > 0)`, 5 FK-Spalten auf `kpi_categories` (`kategorie_id` mit `ON DELETE RESTRICT`, alle anderen mit `ON DELETE SET NULL`), RLS für alle 4 Operationen (authenticated users), Indizes auf `leistungsdatum`, `betrag`, `kategorie_id`
- `GET /api/umsatz-transaktionen`: Filter (von/bis/kategorie_ids[]/gruppe_ids[]/untergruppe_ids[]/sales_plattform_ids[]/produkt_ids[] als komma-separierte Query-Parameter, `.in()` statt `.eq()`), Sortierung (leistungsdatum/betrag + asc/desc), Pagination (50/Seite), gibt `{ data, total, totalBetrag }` zurück — `totalBetrag` als Summe über alle gefilterten Zeilen (nicht nur aktuelle Seite)
- `POST /api/umsatz-transaktionen`: Zod-Validierung (leistungsdatum-Regex, betrag > 0, kategorie_id UUID); alle FK-Felder nullable; gibt 201 zurück
- `PATCH /api/umsatz-transaktionen/[id]`: Partial-Update mit patchSchema; gibt 400 bei leerem Body; gibt 404 wenn nicht gefunden
- `DELETE /api/umsatz-transaktionen/[id]`: Löscht Transaktion; gibt 204 zurück
- Vitest Unit-Tests: 22 neue Tests (GET/POST/PATCH/DELETE) — alle 103 Tests grün

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
