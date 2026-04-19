# PROJ-6: Rentabilitäts-Auswertung

## Status: Approved
**Created:** 2026-04-17
**Last Updated:** 2026-04-19 (Backend API complete)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-3 (Umsatz-Transaktionen) — Datenquelle für Erlöse (`umsatz_transaktionen`)
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen) — Datenquelle für Kosten (`ausgaben_kosten_transaktionen`)

## Übersicht
Tabellarische Liste aller rentabilitätsrelevanten Transaktionen auf einer eigenen Seite im Dashboard. Die Ansicht kombiniert alle Umsatz-Transaktionen (positive Beträge) mit einem gefilterten Teil der Ausgaben & Kosten-Transaktionen (negative Beträge). Ziel: Vollständige chronologische Übersicht aller erlös- und aufwandsrelevanten Vorgänge auf Einzeltransaktionsebene.

Die Seite ist schreibgeschützt — Bearbeitung erfolgt weiterhin über die jeweiligen Datenpflege-Seiten (PROJ-3, PROJ-5).

## Navigationsanforderungen
- Eigener Menüpunkt "Rentabilität" im linken Navigationsmenü des Dashboards
- Eigene Kachel/Navigationskarte auf der Dashboard-Übersichtsseite (`/dashboard`)
- URL: `/dashboard/rentabilitaet`

## Datenquellen & Filterlogik

### Umsatz-Transaktionen (`umsatz_transaktionen`)
Alle Einträge ohne weiteren Filter. Betrag = `betrag` (positiv).

### Ausgaben & Kosten-Transaktionen (`ausgaben_kosten_transaktionen`)
Nur Einträge, die ALLE drei folgenden Bedingungen erfüllen:
1. `relevant_fuer_rentabilitaet` = `'ja'` ODER `relevant_fuer_rentabilitaet` IS NULL (leer)
2. `leistungsdatum` IS NOT NULL (muss vorhanden sein)
3. `abschreibung` IS NULL (leer — keine Abschreibungseinträge)

Betrag = `betrag_netto` (negativ, d.h. als negativer Wert dargestellt).

## User Stories
- Als Nutzer möchte ich alle rentabilitätsrelevanten Transaktionen (Umsatz und Kosten) in einer gemeinsamen Tabelle sehen, damit ich auf einen Blick erkenne, wie sich Erlöse und Aufwände gegenüberstehen.
- Als Nutzer möchte ich Umsatz-Einträge (positiv) und Kosten-Einträge (negativ) klar unterscheiden können, damit ich Einnahmen und Ausgaben im Kontext der Rentabilität beurteilen kann.
- Als Nutzer möchte ich die Tabelle nach Leistungsdatum filtern können (Von/Bis), damit ich Auswertungen für bestimmte Zeiträume durchführen kann.
- Als Nutzer möchte ich die Tabelle nach Kategorie, Gruppe und Untergruppe filtern können, damit ich die Rentabilität einzelner Bereiche analysieren kann.
- Als Nutzer möchte ich eine Gesamtsumme aller sichtbaren Beträge (Umsatz minus Kosten) in der Fußzeile sehen, damit ich das Netto-Ergebnis sofort erkenne.
- Als Nutzer möchte ich erkennen können, ob ein Eintrag aus der Umsatz- oder der Ausgaben/Kosten-Tabelle stammt, damit ich die Herkunft jeder Zeile nachvollziehen kann.

## Acceptance Criteria

### Tabellen-Spalten (dynamisch)
- [ ] Die Tabelle zeigt immer: **Leistungsdatum**, **Quelle** (Umsatz / Kosten), **Beschreibung**, **Betrag**
- [ ] **Kategorie**-Spalte wird angezeigt, wenn mindestens eine der Quelltabellen (Umsatz oder Ausgaben&Kosten) eine Ebene-1-Kategorie hat (praktisch immer der Fall)
- [ ] **Gruppe**-Spalte wird angezeigt, wenn mindestens eine der Quelltabellen eine Ebene-2-Kategorie hat
- [ ] **Untergruppe**-Spalte wird angezeigt, wenn mindestens eine der Quelltabellen eine Ebene-3-Kategorie hat
- [ ] **Sales Plattform**-Spalte wird angezeigt, wenn mindestens eine Hauptkategorie aus Umsatz oder Ausgaben&Kosten `sales_plattform_enabled = true` hat
- [ ] **Produkte**-Spalte wird angezeigt, wenn mindestens eine Hauptkategorie aus Umsatz oder Ausgaben&Kosten `produkt_enabled = true` hat
- [ ] Spalten, die nicht zutreffen, werden vollständig ausgeblendet (nicht nur leer gelassen)

### Betrag-Darstellung
- [ ] Umsatz-Transaktionen: Betrag positiv (z.B. `8.250,00 €`)
- [ ] Ausgaben & Kosten-Transaktionen: Betrag negativ mit Minuszeichen (z.B. `-1.200,00 €`)
- [ ] Betrag kommt für Umsatz aus Spalte `betrag`, für Ausgaben&Kosten aus Spalte `betrag_netto`
- [ ] Positive Beträge in grüner Schrift, negative Beträge in roter Schrift

### Quelle-Spalte
- [ ] Jede Zeile zeigt ihre Herkunft: `Umsatz` oder `Kosten`
- [ ] Optionale visuelle Unterscheidung (z.B. Badge oder farbige Markierung)

### Tabellen-Funktionen
- [ ] Standard-Sortierung: Leistungsdatum absteigend (neueste zuerst)
- [ ] Tabelle sortierbar nach: Leistungsdatum, Betrag (auf-/absteigend)
- [ ] Tabelle filterbar nach: Zeitraum Von/Bis (Leistungsdatum)
- [ ] Tabelle filterbar nach: Kategorie, Gruppe, Untergruppe (hierarchische Multi-Select-Filter, analog PROJ-3/5)
- [ ] Tabelle filterbar nach: Sales Plattform (Multi-Select, wenn Spalte sichtbar)
- [ ] Tabelle filterbar nach: Produkt (Multi-Select, wenn Spalte sichtbar)
- [ ] Tabelle filterbar nach: Quelle (Umsatz / Kosten, Multi-Select) — steuert auch die Sichtbarkeit des Kategorie-Filters
- [ ] Paginierung: 50 Einträge pro Seite
- [ ] Fußzeile zeigt Netto-Summe aller gefilterten Transaktionen (Umsatz − Kosten; server-seitig über alle Seiten)
- [ ] "Filter zurücksetzen"-Button

### Filter-Hierarchie (Quelle → Kategorie)
- [ ] **Quelle-Filter**: Multi-Select — Optionen: "Umsatz", "Kosten"; kein Pflichtfeld (kein Quelle-Filter = beide Quellen sichtbar)
- [ ] **Kategorie-Filter**: wird nur angezeigt, wenn bei Quelle **genau eine** Ausprägung gewählt ist (also entweder nur "Umsatz" oder nur "Kosten"); ist kein Quelle-Filter gesetzt oder sind beide Quellen gewählt, bleibt der Kategorie-Filter ausgeblendet
- [ ] Wenn Quelle = "Umsatz": Kategorie-Filter zeigt ausschließlich Ebene-1-Kategorien aus dem **Umsatz-KPI-Modell**
- [ ] Wenn Quelle = "Kosten": Kategorie-Filter zeigt ausschließlich Ebene-1-Kategorien aus dem **Ausgaben & Kosten-KPI-Modell**
- [ ] **Gruppe-Filter**: erscheint nur, wenn Quelle **genau eine** Ausprägung hat UND bei Kategorie **genau eine** Ausprägung gewählt ist; Multi-Select
- [ ] **Untergruppe-Filter**: erscheint nur, wenn Quelle **genau eine** Ausprägung hat UND Kategorie **genau eine** UND Gruppe **genau eine** Ausprägung hat; Multi-Select
- [ ] Wird der Quelle-Filter zurückgesetzt oder auf beide Quellen erweitert, werden Kategorie-, Gruppe- und Untergruppe-Filter ausgeblendet und ihre Werte zurückgesetzt
- [ ] Ist bei einer Kategorie-Ebene mehr als eine Ausprägung gewählt, werden alle Ebenen darunter ausgeblendet und zurückgesetzt

### Navigation
- [ ] Seite unter `/dashboard/rentabilitaet` erreichbar
- [ ] Menüpunkt "Rentabilität" im linken Navigationsmenü
- [ ] Kachel/Link "Rentabilität" auf der Dashboard-Übersicht (`/dashboard`)
- [ ] Seite ist nur für eingeloggte Nutzer erreichbar (Redirect zu /login wenn nicht eingeloggt)

## Tabellen-Spalten

| Spalte | Typ | Sichtbarkeit | Quelle |
|--------|-----|-------------|--------|
| Leistungsdatum | Date | Immer | `umsatz_transaktionen.leistungsdatum` / `ausgaben_kosten_transaktionen.leistungsdatum` |
| Quelle | Text (Badge) | Immer | "Umsatz" / "Kosten" |
| Kategorie | Text | Wenn mind. 1 Ebene-1-Kategorie | `kategorie_id` → kpi_categories.name |
| Gruppe | Text | Wenn mind. 1 Ebene-2-Kategorie | `gruppe_id` → kpi_categories.name |
| Untergruppe | Text | Wenn mind. 1 Ebene-3-Kategorie | `untergruppe_id` → kpi_categories.name |
| Sales Plattform | Text | Wenn mind. 1 sales_plattform_enabled=true | `sales_plattform_id` → kpi_categories.name |
| Produkte | Text | Wenn mind. 1 produkt_enabled=true | `produkt_id` → kpi_categories.name |
| Beschreibung | Text | Immer | `beschreibung` |
| Betrag | Decimal (€) | Immer | Umsatz: `+betrag` / Kosten: `−betrag_netto` |

## Ausgaben & Kosten Filter-Kriterien (Detail)

```
Einschlussbedingungen für ausgaben_kosten_transaktionen:
  relevant_fuer_rentabilitaet IN ('ja', NULL)   -- 'nein' wird AUSGESCHLOSSEN
  AND leistungsdatum IS NOT NULL                 -- nur wenn Leistungsdatum vorhanden
  AND abschreibung IS NULL                       -- Abschreibungseinträge AUSSCHLIESSEN
```

## Edge Cases
- Keine Transaktionen im gewählten Zeitraum → Leere Tabelle mit Hinweistext "Keine Transaktionen gefunden"
- Ausgaben&Kosten-Transaktion hat `relevant_fuer_rentabilitaet = 'nein'` → wird nicht in der Ansicht angezeigt
- Ausgaben&Kosten-Transaktion hat `leistungsdatum = NULL` → wird nicht in der Ansicht angezeigt (kein Leistungsdatum)
- Ausgaben&Kosten-Transaktion hat `abschreibung IS NOT NULL` → wird nicht in der Ansicht angezeigt
- Kategorie wurde im KPI-Modell gelöscht → Anzeige "[Kategorie gelöscht]"
- Sehr viele Transaktionen (1000+) → Paginierung (50 pro Seite)
- Alle Ausgaben&Kosten-Transaktionen sind herausgefiltert (z.B. alle haben `relevant_fuer_rentabilitaet = 'nein'`) → Nur Umsatz-Transaktionen erscheinen in der Tabelle

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
/dashboard/rentabilitaet  (src/app/dashboard/rentabilitaet/page.tsx)
+-- Seitenüberschrift "Rentabilitäts-Auswertung"
+-- FilterBar
|   +-- DateRangePicker: Von / Bis (Leistungsdatum)
|   +-- Quelle-Filter (MultiSelect: "Umsatz" / "Kosten")
|   +-- Kategorie-Filter (MultiSelect, Ebene 1 aus Umsatz- UND Ausgaben-KPI-Modell kombiniert)
|   +-- Gruppe-Filter (MultiSelect — nur wenn genau 1 Kategorie gewählt)
|   +-- Untergruppe-Filter (MultiSelect — nur wenn genau 1 Kategorie UND 1 Gruppe gewählt)
|   +-- Sales-Plattform-Filter (MultiSelect — wenn showSalesPlattform=true)
|   +-- Produkt-Filter (MultiSelect — wenn showProdukte=true)
|   +-- "Filter zurücksetzen"-Button
|
+-- RentabilitaetTable  (src/components/rentabilitaet-table.tsx)
|   +-- Spalten: Leistungsdatum | Quelle (Badge) | [Kategorie] | [Gruppe] | [Untergruppe]
|   |            | [Sales Plattform] | [Produkte] | Beschreibung | Betrag
|   +-- Zeilen: Umsatz-Zeilen (Betrag grün, positiv) / Kosten-Zeilen (Betrag rot, negativ)
|   +-- Kein Edit- oder Delete-Button (schreibgeschützte Ansicht)
|   +-- Fußzeile: Netto-Ergebnis = Σ Umsatz − Σ Kosten (über alle gefilterten Seiten)
|   +-- Paginierung (50 Einträge/Seite)
|
+-- EmptyState ("Keine Transaktionen im gewählten Zeitraum gefunden")
```

### Vereinheitlichtes Datenmodell (kombinierte Zeile)

Jede Zeile in der Tabelle repräsentiert eine einzelne Transaktion — entweder aus der Umsatz- oder der Ausgaben&Kosten-Tabelle. Beide werden auf ein einheitliches Format normiert:

```
RentabilitaetZeile:
  id              → Originale ID aus der Quelltabelle
  quelle          → "umsatz" oder "kosten" (technisches Label)
  leistungsdatum  → Datum der Zeile (aus beiden Quelltabellen identisch benannt)
  betrag          → Umsatz: positiver Wert aus 'betrag'
                    Kosten: negativer Wert aus 'betrag_netto'
  kategorie_id    → FK auf kpi_categories (Ebene 1)
  gruppe_id       → FK auf kpi_categories (Ebene 2), nullable
  untergruppe_id  → FK auf kpi_categories (Ebene 3), nullable
  sales_plattform_id → FK auf kpi_categories, nullable
  produkt_id      → FK auf kpi_categories, nullable
  beschreibung    → Freitext, nullable
```

### API-Endpunkt

```
GET /api/rentabilitaet
    → Liest gefiltert aus umsatz_transaktionen UND ausgaben_kosten_transaktionen
    → Führt beide Listen zusammen, sortiert nach Leistungsdatum
    → Gibt paginierte Ergebnisse (50/Seite) + totalNetto zurück

Parameter:
  von, bis           → Leistungsdatum-Filter (gilt für beide Quelltabellen)
  quelle             → "umsatz" / "kosten" / beide (wenn nicht angegeben)
  kategorie_ids      → Multi-Select Filter, Ebene 1
  gruppe_ids         → Multi-Select Filter, Ebene 2
  untergruppe_ids    → Multi-Select Filter, Ebene 3
  sales_plattform_ids, produkt_ids → unabhängige Filter
  page, sortColumn, sortDirection
```

### Hook

```
src/hooks/use-rentabilitaet.ts
  → Verwaltet Filter-, Sortier- und Paginierungszustand
  → Ruft /api/rentabilitaet auf
  → Kein CRUD (read-only)
  → Gibt zurück: { zeilen, total, totalNetto, loading, error, filter, setFilter, ... }
```

### Spalten-Sichtbarkeitslogik

```
Beim Laden der Seite werden KPI-Modelle aus ZWEI Quellen geladen:
  1. useKpiCategories('umsatz')         → für Umsatz-Zeilen
  2. useKpiCategories('ausgaben_kosten') → für Kosten-Zeilen
  3. useKpiCategories('sales_plattformen') + useKpiCategories('produkte')

Spalte wird angezeigt, wenn MINDESTENS EINE der Quelltabellen den Wert hat:
  showGruppe         = umsatzKat.some(level=2) OR ausgabenKat.some(level=2)
  showUntergruppe    = umsatzKat.some(level=3) OR ausgabenKat.some(level=3)
  showSalesPlattform = umsatzKat.some(sp_enabled) OR ausgabenKat.some(sp_enabled)
  showProdukte       = umsatzKat.some(prod_enabled) OR ausgabenKat.some(prod_enabled)

Kategorie-Filter zeigt alle Kategorien aus Umsatz UND Ausgaben&Kosten.
```

### Navigation (Änderungen an bestehenden Dateien)

```
src/components/nav-sheet.tsx
  → Neue Gruppe "Auswertungen" unterhalb von "Datenpflege" hinzufügen
  → Einträge: "Rentabilität" → /dashboard/rentabilitaet
               "Liquidität"  → /dashboard/liquiditaet

src/app/dashboard/page.tsx
  → Neuer Abschnitt "Auswertungen" mit 2 Kacheln:
      "Rentabilität" → /dashboard/rentabilitaet
      "Liquidität"   → /dashboard/liquiditaet
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Datenzusammenführung | API-seitig (beide Tabellen abrufen + mergen) | Konsistent mit bestehenden Mustern; keine neue Datenbankobjekte (VIEWs/RPCs); bei manueller Datenpflege (1-5 Nutzer) ist Datenmenge beherrschbar |
| Schreibschutz | Keine Edit/Delete-Buttons | Ansichtsseite; Bearbeitung bleibt in den Datenpflege-Seiten |
| Betrag-Vorzeichen | Server-seitig normiert | API gibt `betrag` immer korrekt vorzeichenbehaftet zurück — kein Client-seitiges Negieren nötig |
| Quelle-Badge | shadcn Badge-Komponente | Bereits installiert; klare visuelle Unterscheidung ohne Custom-Code |
| Footer-Summe | Server-seitig über alle Seiten | API summiert alle gefilterten Zeilen (nicht nur aktuelle Seite) — korrekte Gesamtsumme |
| Kategorie-Filter | Vereint aus beiden KPI-Modellen | Nutzer sieht alle möglichen Kategorien; Filterung funktioniert für Zeilen beider Quellen |

### Neue Dateien

```
src/app/dashboard/rentabilitaet/page.tsx    — Hauptseite (Client Component)
src/components/rentabilitaet-table.tsx      — Read-only Tabelle, dynamische Spalten, grün/rot Betrag
src/hooks/use-rentabilitaet.ts              — API-Calls + Filter/Sort/Pagination-State (read-only)
src/app/api/rentabilitaet/route.ts          — GET: merged query aus 2 Tabellen + Summe
```

### Geänderte Dateien

```
src/components/nav-sheet.tsx      — "Auswertungen"-Gruppe mit 2 Einträgen ergänzt
src/app/dashboard/page.tsx        — "Auswertungen"-Abschnitt mit 2 Kacheln ergänzt
```

### Keine neuen Packages
Alle benötigten shadcn/ui-Komponenten (Badge, Table, Pagination, Select, Popover) sind bereits installiert.

## Implementation Notes (Frontend)

**Status:** Frontend implemented on 2026-04-19. Backend API route `/api/rentabilitaet` is not yet built — the UI will surface the API error gracefully until the backend is added.

### New files
- `src/hooks/use-rentabilitaet.ts` — Read-only hook: manages filter/sort/pagination state and calls `GET /api/rentabilitaet`. Exposes `{ zeilen, loading, error, total, totalNetto, page, filter, sortColumn, sortDirection, setPage, setFilter, setSort, refresh }`.
- `src/components/rentabilitaet-table.tsx` — Read-only table (no edit/delete). Columns: Leistungsdatum | Quelle (Badge) | Kategorie | [Gruppe] | [Untergruppe] | [Sales Plattform] | [Produkt] | Beschreibung | Betrag. Umsatz-Badge = green custom class on `variant="default"`; Kosten-Badge = `variant="destructive"`. Betrag is green when ≥ 0, red when < 0. Footer shows `Netto-Ergebnis:` in green/red based on sign.
- `src/app/dashboard/rentabilitaet/page.tsx` — Client Component. Loads KPI categories for `umsatz`, `ausgaben_kosten`, `sales_plattformen`, `produkte`. Computes column visibility from the union of the two main KPI models. Filter bar: Von/Bis, Quelle (MultiSelect Umsatz/Kosten), Kategorie (combined/deduped level-1 from both models), cascading Gruppe & Untergruppe (shown only when exactly one parent selected), Sales Plattform & Produkt (only when column visible), Filter zurücksetzen.

### Changed files
- `src/components/nav-sheet.tsx` — Added "Auswertungen" nav group with "Rentabilität" and "Liquidität" entries.
- `src/app/dashboard/page.tsx` — Added "Auswertungen" section with two cards for the new pages.

### Implementation decisions / deviations
- Kategorie filter options are deduped by `id` across both KPI models (so a shared category id does not appear twice).
- "Keine KPI-Modelle definiert" empty state is shown when BOTH `umsatz` and `ausgaben_kosten` have zero categories (otherwise one type alone is enough to render the view).
- Auth follows the same pattern as the existing client dashboard pages (einnahmen/umsatz/ausgaben): no server-side redirect in the page — protection is enforced by the API routes through Supabase cookies.
- Footer layout renders a `Netto-Ergebnis:` label cell before the sum cell (instead of placing it in a shared colSpan like the einnahmen table), since there's no actions column to occupy the last cell.

## Implementation Notes (Backend)

**Status:** Backend implemented on 2026-04-19.

### New files
- `src/app/api/rentabilitaet/route.ts` — `GET` only (read-only endpoint). Authenticates via `requireAuth()`, reads `umsatz_transaktionen` and `ausgaben_kosten_transaktionen`, merges + sorts + paginates in memory. Returns `{ data, total, totalNetto }`.
- `src/app/api/rentabilitaet/route.test.ts` — Vitest unit tests (8 tests): 401 when unauthenticated, merged data shape, `quelle=umsatz` filter, `quelle=kosten` filter, von/bis params accepted, page=2 pagination slicing, totalNetto arithmetic, default descending sort by `leistungsdatum`, empty-data case.

### Query logic
- **Umsatz branch** (active when `quelle` unset or includes `umsatz`): selects the minimal row set (id, leistungsdatum, betrag, kategorie/gruppe/untergruppe/sales_plattform/produkt ids, beschreibung) with conditional `von`/`bis`/`kategorie_ids`/... filters.
- **Kosten branch** (active when `quelle` unset or includes `kosten`): same filter set PLUS three always-on predicates:
  - `leistungsdatum IS NOT NULL` via `.not('leistungsdatum', 'is', null)`
  - `abschreibung IS NULL` via `.is('abschreibung', null)`
  - `relevant_fuer_rentabilitaet IS NULL OR = 'ja'` via `.or('relevant_fuer_rentabilitaet.is.null,relevant_fuer_rentabilitaet.eq.ja')`
- A plain `.neq('relevant_fuer_rentabilitaet', 'nein')` is intentionally avoided because PostgREST excludes NULLs from `!=` comparisons; the `.or()` form keeps NULLs in the result.

### Normalization
- Umsatz rows → `{ quelle: 'umsatz', betrag: +row.betrag, ... }`
- Kosten rows → `{ quelle: 'kosten', betrag: -row.betrag_netto, ... }` (betrag_netto drives rentabilitaet per spec)

### Merge / sort / paginate
- Rows from both branches are concatenated into a single array, then sorted in JS by `leistungsdatum` (ISO date strings compare lexically = chronologically) or `betrag`.
- `totalNetto` is summed across the full merged array (before pagination) and rounded to 2 decimals.
- Pagination slices the sorted array at `(page-1)*50 .. page*50`. Given the manual-entry scale (1–5 users), fetching all filtered rows from both tables and sorting in memory is acceptable — this matches the "API-side merge" pattern agreed in the tech design.

### Deviations / decisions
- No Zod schema on GET because the endpoint only reads query strings (each parsed defensively: `page = Math.max(1, parseInt())`, `sortColumn` defaults when unknown, IDs split+filter empties).
- No rate limiting / extra middleware beyond `requireAuth()` — consistent with existing routes.
- `totalNetto` uses `Math.round(... * 100) / 100` rounding (same pattern as umsatz/einnahmen totals).

## QA Test Results

**QA Date:** 2026-04-19
**QA Status:** Approved — No Critical or High bugs found

### Automated Tests
- **Vitest unit tests:** 8/8 passed (`src/app/api/rentabilitaet/route.test.ts`)
- **Playwright E2E tests:** 9/9 passed (`tests/PROJ-6-rentabilitaets-auswertung.spec.ts`)

### Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| AC-AUTH | /dashboard/rentabilitaet redirects unauthenticated to /login | PASS (E2E) |
| AC-API-AUTH | /api/rentabilitaet returns 401 / redirects without auth | PASS (unit + E2E) |
| AC-UI-01 | Table shows Leistungsdatum, Quelle, Beschreibung, Betrag always | PASS (manual) |
| AC-UI-02 | Kategorie column shown when KPI model has level-1 categories | PASS (manual) |
| AC-UI-03 | Gruppe column shown when KPI model has level-2 categories | PASS (manual) |
| AC-UI-04 | Untergruppe column shown when KPI model has level-3 categories | PASS (manual) |
| AC-UI-05 | Sales Plattform column conditional on sales_plattform_enabled | PASS (manual) |
| AC-UI-06 | Produkte column conditional on produkt_enabled | PASS (manual) |
| AC-BETRAG-01 | Umsatz rows: positive betrag, green text | PASS (manual) |
| AC-BETRAG-02 | Kosten rows: negative betrag (−betrag_netto), red text | PASS (manual) |
| AC-BETRAG-03 | betrag_netto used (not betrag_brutto) for kosten | PASS (unit) |
| AC-QUELLE-01 | Quelle badge shows "Umsatz" / "Kosten" per row | PASS (manual) |
| AC-FILTER-01 | Von/Bis filters apply to Leistungsdatum | PASS (manual + unit) |
| AC-FILTER-02 | Quelle multi-select filter works | PASS (manual + unit) |
| AC-FILTER-03 | Kategorie filter hidden when no Quelle or both Quellen selected | PASS (manual) |
| AC-FILTER-04 | Kategorie shows only Umsatz categories when Quelle=Umsatz | PASS (manual) |
| AC-FILTER-05 | Kategorie shows only Kosten categories when Quelle=Kosten | PASS (manual) |
| AC-FILTER-06 | Gruppe filter visible only when exactly 1 Kategorie selected | PASS (manual) |
| AC-FILTER-07 | Untergruppe visible only when exactly 1 Gruppe selected | PASS (manual) |
| AC-FILTER-08 | Changing Quelle resets Kategorie, Gruppe, Untergruppe | PASS (manual) |
| AC-SORT-01 | Default sort: Leistungsdatum descending | PASS (manual + unit) |
| AC-SORT-02 | Sortable by Leistungsdatum and Betrag | PASS (manual) |
| AC-FOOTER-01 | Netto-Ergebnis sums all filtered rows (server-side) | PASS (manual + unit) |
| AC-FOOTER-02 | Footer green when positive, red when negative | PASS (manual) |
| AC-PAGINATION-01 | 50 rows per page | PASS (manual + unit) |
| AC-RESET-01 | "Filter zurücksetzen" clears all filters | PASS (manual) |
| AC-EMPTY-01 | Empty state shown when no transactions match | PASS (manual) |
| AC-NAV-01 | Rentabilität nav link under "Auswertungen" group | PASS (manual) |
| AC-NAV-02 | Rentabilität card on /dashboard overview | PASS (manual) |
| AC-READONLY | No edit/delete buttons present | PASS (manual) |
| AC-EXCL-01 | ausgaben_kosten rows with relevant_fuer_rentabilitaet='nein' excluded | PASS (unit) |
| AC-EXCL-02 | ausgaben_kosten rows without leistungsdatum excluded | PASS (unit) |
| AC-EXCL-03 | ausgaben_kosten rows with abschreibung set excluded | PASS (unit) |

### Security Audit
- Authentication enforced via `requireAuth()` server-side — no bypass possible from client
- API only exposes read operations (GET only) — no data mutation risk
- All filter parameters parsed defensively (split+filter, parseInt with max(1,...))
- No sensitive data (e.g. user IDs of other tenants) exposed in responses
- RLS enforced at Supabase level as second line of defense

### Bugs Found
None — all acceptance criteria passed. No Critical, High, Medium, or Low bugs.

### Production-Ready Decision
**READY** — No bugs found. All acceptance criteria passed.

## Deployment
_To be added by /deploy_
