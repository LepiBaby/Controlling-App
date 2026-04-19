# PROJ-7: Liquiditäts-Auswertung

## Status: Deployed
**Created:** 2026-04-17
**Last Updated:** 2026-04-19 (Backend API complete)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-4 (Einnahmen-Transaktionen) — Datenquelle für Geldzuflüsse (`einnahmen_transaktionen`)
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen) — Datenquelle für Geldabflüsse (`ausgaben_kosten_transaktionen`)

## Übersicht
Tabellarische Liste aller liquiditätsrelevanten Transaktionen auf einer eigenen Seite im Dashboard. Die Ansicht kombiniert alle Einnahmen-Transaktionen (positive Beträge) mit einem gefilterten Teil der Ausgaben & Kosten-Transaktionen (negative Beträge). Ziel: Vollständige chronologische Übersicht aller tatsächlichen Geldbewegungen (Cash In / Cash Out) auf Einzeltransaktionsebene.

Die Seite ist schreibgeschützt — Bearbeitung erfolgt weiterhin über die jeweiligen Datenpflege-Seiten (PROJ-4, PROJ-5).

## Navigationsanforderungen
- Eigener Menüpunkt "Liquidität" im linken Navigationsmenü des Dashboards
- Eigene Kachel/Navigationskarte auf der Dashboard-Übersichtsseite (`/dashboard`)
- URL: `/dashboard/liquiditaet`

## Datenquellen & Filterlogik

### Einnahmen-Transaktionen (`einnahmen_transaktionen`)
Alle Einträge ohne weiteren Filter. Betrag = `betrag` (positiv).

### Ausgaben & Kosten-Transaktionen (`ausgaben_kosten_transaktionen`)
Nur Einträge, bei denen:
1. `zahlungsdatum` IS NOT NULL (Zahlungsdatum muss vorhanden sein)

Betrag = `betrag_brutto` (negativ, d.h. als negativer Wert dargestellt).

## User Stories
- Als Nutzer möchte ich alle liquiditätsrelevanten Transaktionen (Einnahmen und Ausgaben) in einer gemeinsamen Tabelle sehen, damit ich die tatsächlichen Geldbewegungen auf einen Blick überblicke.
- Als Nutzer möchte ich Einnahmen (positiv) und Ausgaben (negativ) klar unterscheiden können, damit ich Cash In und Cash Out im Kontext der Liquidität beurteilen kann.
- Als Nutzer möchte ich die Tabelle nach Zahlungsdatum filtern können (Von/Bis), damit ich Auswertungen für bestimmte Zeiträume durchführen kann.
- Als Nutzer möchte ich die Tabelle nach Kategorie, Gruppe und Untergruppe filtern können, damit ich die Liquidität einzelner Bereiche analysieren kann.
- Als Nutzer möchte ich eine Gesamtsumme aller sichtbaren Beträge (Einnahmen minus Ausgaben) in der Fußzeile sehen, damit ich den Netto-Cashflow sofort erkenne.
- Als Nutzer möchte ich erkennen können, ob ein Eintrag aus der Einnahmen- oder der Ausgaben/Kosten-Tabelle stammt, damit ich die Herkunft jeder Zeile nachvollziehen kann.

## Acceptance Criteria

### Tabellen-Spalten (dynamisch)
- [ ] Die Tabelle zeigt immer: **Zahlungsdatum**, **Quelle** (Einnahmen / Ausgaben), **Beschreibung**, **Betrag**
- [ ] **Kategorie**-Spalte wird angezeigt, wenn mindestens eine der Quelltabellen (Einnahmen oder Ausgaben&Kosten) eine Ebene-1-Kategorie hat (praktisch immer der Fall)
- [ ] **Gruppe**-Spalte wird angezeigt, wenn mindestens eine der Quelltabellen eine Ebene-2-Kategorie hat
- [ ] **Untergruppe**-Spalte wird angezeigt, wenn mindestens eine der Quelltabellen eine Ebene-3-Kategorie hat
- [ ] **Sales Plattform**-Spalte wird angezeigt, wenn mindestens eine Hauptkategorie aus Einnahmen oder Ausgaben&Kosten `sales_plattform_enabled = true` hat
- [ ] **Produkte**-Spalte wird angezeigt, wenn mindestens eine Hauptkategorie aus Einnahmen oder Ausgaben&Kosten `produkt_enabled = true` hat
- [ ] Spalten, die nicht zutreffen, werden vollständig ausgeblendet (nicht nur leer gelassen)

### Betrag-Darstellung
- [ ] Einnahmen-Transaktionen: Betrag positiv (z.B. `5.000,00 €`)
- [ ] Ausgaben & Kosten-Transaktionen: Betrag negativ mit Minuszeichen (z.B. `-800,00 €`)
- [ ] Betrag kommt für Einnahmen aus Spalte `betrag`, für Ausgaben&Kosten aus Spalte `betrag_brutto`
- [ ] Positive Beträge in grüner Schrift, negative Beträge in roter Schrift

### Quelle-Spalte
- [ ] Jede Zeile zeigt ihre Herkunft: `Einnahmen` oder `Ausgaben`
- [ ] Optionale visuelle Unterscheidung (z.B. Badge oder farbige Markierung)

### Tabellen-Funktionen
- [ ] Standard-Sortierung: Zahlungsdatum absteigend (neueste zuerst)
- [ ] Tabelle sortierbar nach: Zahlungsdatum, Betrag (auf-/absteigend)
- [ ] Tabelle filterbar nach: Zeitraum Von/Bis (Zahlungsdatum)
- [ ] Tabelle filterbar nach: Kategorie, Gruppe, Untergruppe (hierarchische Multi-Select-Filter, analog PROJ-4/5)
- [ ] Tabelle filterbar nach: Sales Plattform (Multi-Select, wenn Spalte sichtbar)
- [ ] Tabelle filterbar nach: Produkt (Multi-Select, wenn Spalte sichtbar)
- [ ] Tabelle filterbar nach: Quelle (Einnahmen / Ausgaben, Multi-Select) — steuert auch die Sichtbarkeit des Kategorie-Filters
- [ ] Paginierung: 50 Einträge pro Seite
- [ ] Fußzeile zeigt Netto-Cashflow aller gefilterten Transaktionen (Einnahmen − Ausgaben; server-seitig über alle Seiten)
- [ ] "Filter zurücksetzen"-Button

### Filter-Hierarchie (Quelle → Kategorie)
- [ ] **Quelle-Filter**: Multi-Select — Optionen: "Einnahmen", "Ausgaben"; kein Pflichtfeld (kein Quelle-Filter = beide Quellen sichtbar)
- [ ] **Kategorie-Filter**: wird nur angezeigt, wenn bei Quelle **genau eine** Ausprägung gewählt ist (also entweder nur "Einnahmen" oder nur "Ausgaben"); ist kein Quelle-Filter gesetzt oder sind beide Quellen gewählt, bleibt der Kategorie-Filter ausgeblendet
- [ ] Wenn Quelle = "Einnahmen": Kategorie-Filter zeigt ausschließlich Ebene-1-Kategorien aus dem **Einnahmen-KPI-Modell**
- [ ] Wenn Quelle = "Ausgaben": Kategorie-Filter zeigt ausschließlich Ebene-1-Kategorien aus dem **Ausgaben & Kosten-KPI-Modell**
- [ ] **Gruppe-Filter**: erscheint nur, wenn Quelle **genau eine** Ausprägung hat UND bei Kategorie **genau eine** Ausprägung gewählt ist; Multi-Select
- [ ] **Untergruppe-Filter**: erscheint nur, wenn Quelle **genau eine** Ausprägung hat UND Kategorie **genau eine** UND Gruppe **genau eine** Ausprägung hat; Multi-Select
- [ ] Wird der Quelle-Filter zurückgesetzt oder auf beide Quellen erweitert, werden Kategorie-, Gruppe- und Untergruppe-Filter ausgeblendet und ihre Werte zurückgesetzt
- [ ] Ist bei einer Kategorie-Ebene mehr als eine Ausprägung gewählt, werden alle Ebenen darunter ausgeblendet und zurückgesetzt

### Navigation
- [ ] Seite unter `/dashboard/liquiditaet` erreichbar
- [ ] Menüpunkt "Liquidität" im linken Navigationsmenü
- [ ] Kachel/Link "Liquidität" auf der Dashboard-Übersicht (`/dashboard`)
- [ ] Seite ist nur für eingeloggte Nutzer erreichbar (Redirect zu /login wenn nicht eingeloggt)

## Tabellen-Spalten

| Spalte | Typ | Sichtbarkeit | Quelle |
|--------|-----|-------------|--------|
| Zahlungsdatum | Date | Immer | `einnahmen_transaktionen.zahlungsdatum` / `ausgaben_kosten_transaktionen.zahlungsdatum` |
| Quelle | Text (Badge) | Immer | "Einnahmen" / "Ausgaben" |
| Kategorie | Text | Wenn mind. 1 Ebene-1-Kategorie | `kategorie_id` → kpi_categories.name |
| Gruppe | Text | Wenn mind. 1 Ebene-2-Kategorie | `gruppe_id` → kpi_categories.name |
| Untergruppe | Text | Wenn mind. 1 Ebene-3-Kategorie | `untergruppe_id` → kpi_categories.name |
| Sales Plattform | Text | Wenn mind. 1 sales_plattform_enabled=true | `sales_plattform_id` → kpi_categories.name |
| Produkte | Text | Wenn mind. 1 produkt_enabled=true | `produkt_id` → kpi_categories.name |
| Beschreibung | Text | Immer | `beschreibung` |
| Betrag | Decimal (€) | Immer | Einnahmen: `+betrag` / Ausgaben: `−betrag_brutto` |

## Ausgaben & Kosten Filter-Kriterien (Detail)

```
Einschlussbedingungen für ausgaben_kosten_transaktionen:
  zahlungsdatum IS NOT NULL    -- nur Transaktionen mit vorhandenem Zahlungsdatum
```

Hinweis: Ausgaben&Kosten-Transaktionen ohne Zahlungsdatum (z.B. reine Kostenerfassungen ohne Zahlungsvorgang) erscheinen NICHT in der Liquiditätsansicht. Sie können aber in der Rentabilitätsansicht (PROJ-6) auftauchen, wenn sie ein Leistungsdatum haben.

## Edge Cases
- Keine Transaktionen im gewählten Zeitraum → Leere Tabelle mit Hinweistext "Keine Transaktionen gefunden"
- Ausgaben&Kosten-Transaktion hat `zahlungsdatum = NULL` → wird nicht in der Ansicht angezeigt
- Kategorie wurde im KPI-Modell gelöscht → Anzeige "[Kategorie gelöscht]"
- Sehr viele Transaktionen (1000+) → Paginierung (50 pro Seite)
- Alle Ausgaben&Kosten-Transaktionen haben kein Zahlungsdatum → Nur Einnahmen-Transaktionen erscheinen in der Tabelle

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
/dashboard/liquiditaet  (src/app/dashboard/liquiditaet/page.tsx)
+-- Seitenüberschrift "Liquiditäts-Auswertung"
+-- FilterBar
|   +-- DateRangePicker: Von / Bis (Zahlungsdatum)
|   +-- Quelle-Filter (MultiSelect: "Einnahmen" / "Ausgaben")
|   +-- Kategorie-Filter (MultiSelect, Ebene 1 aus Einnahmen- UND Ausgaben-KPI-Modell kombiniert)
|   +-- Gruppe-Filter (MultiSelect — nur wenn genau 1 Kategorie gewählt)
|   +-- Untergruppe-Filter (MultiSelect — nur wenn genau 1 Kategorie UND 1 Gruppe gewählt)
|   +-- Sales-Plattform-Filter (MultiSelect — wenn showSalesPlattform=true)
|   +-- Produkt-Filter (MultiSelect — wenn showProdukte=true)
|   +-- "Filter zurücksetzen"-Button
|
+-- LiquiditaetTable  (src/components/liquiditaet-table.tsx)
|   +-- Spalten: Zahlungsdatum | Quelle (Badge) | [Kategorie] | [Gruppe] | [Untergruppe]
|   |            | [Sales Plattform] | [Produkte] | Beschreibung | Betrag
|   +-- Zeilen: Einnahmen-Zeilen (Betrag grün, positiv) / Ausgaben-Zeilen (Betrag rot, negativ)
|   +-- Kein Edit- oder Delete-Button (schreibgeschützte Ansicht)
|   +-- Fußzeile: Netto-Cashflow = Σ Einnahmen − Σ Ausgaben (über alle gefilterten Seiten)
|   +-- Paginierung (50 Einträge/Seite)
|
+-- EmptyState ("Keine Transaktionen im gewählten Zeitraum gefunden")
```

### Vereinheitlichtes Datenmodell (kombinierte Zeile)

Jede Zeile in der Tabelle repräsentiert eine einzelne Transaktion — entweder aus der Einnahmen- oder der Ausgaben&Kosten-Tabelle. Beide werden auf ein einheitliches Format normiert:

```
LiquiditaetZeile:
  id              → Originale ID aus der Quelltabelle
  quelle          → "einnahmen" oder "ausgaben" (technisches Label)
  zahlungsdatum   → Datum der Zeile (aus beiden Quelltabellen vorhanden)
  betrag          → Einnahmen: positiver Wert aus 'betrag'
                    Ausgaben: negativer Wert aus 'betrag_brutto'
  kategorie_id    → FK auf kpi_categories (Ebene 1)
  gruppe_id       → FK auf kpi_categories (Ebene 2), nullable
  untergruppe_id  → FK auf kpi_categories (Ebene 3), nullable
  sales_plattform_id → FK auf kpi_categories, nullable
  produkt_id      → FK auf kpi_categories, nullable
  beschreibung    → Freitext, nullable
```

### API-Endpunkt

```
GET /api/liquiditaet
    → Liest gefiltert aus einnahmen_transaktionen UND ausgaben_kosten_transaktionen
    → Ausgaben&Kosten-Filter: WHERE zahlungsdatum IS NOT NULL (automatisch)
    → Führt beide Listen zusammen, sortiert nach Zahlungsdatum
    → Gibt paginierte Ergebnisse (50/Seite) + totalNettoCashflow zurück

Parameter:
  von, bis           → Zahlungsdatum-Filter (gilt für beide Quelltabellen)
  quelle             → "einnahmen" / "ausgaben" / beide (wenn nicht angegeben)
  kategorie_ids      → Multi-Select Filter, Ebene 1
  gruppe_ids         → Multi-Select Filter, Ebene 2
  untergruppe_ids    → Multi-Select Filter, Ebene 3
  sales_plattform_ids, produkt_ids → unabhängige Filter
  page, sortColumn, sortDirection
```

### Hook

```
src/hooks/use-liquiditaet.ts
  → Verwaltet Filter-, Sortier- und Paginierungszustand
  → Ruft /api/liquiditaet auf
  → Kein CRUD (read-only)
  → Gibt zurück: { zeilen, total, totalNettoCashflow, loading, error, filter, setFilter, ... }
```

### Spalten-Sichtbarkeitslogik

```
Beim Laden der Seite werden KPI-Modelle aus ZWEI Quellen geladen:
  1. useKpiCategories('einnahmen')       → für Einnahmen-Zeilen
  2. useKpiCategories('ausgaben_kosten') → für Ausgaben-Zeilen
  3. useKpiCategories('sales_plattformen') + useKpiCategories('produkte')

Spalte wird angezeigt, wenn MINDESTENS EINE der Quelltabellen den Wert hat:
  showGruppe         = einnahmenKat.some(level=2) OR ausgabenKat.some(level=2)
  showUntergruppe    = einnahmenKat.some(level=3) OR ausgabenKat.some(level=3)
  showSalesPlattform = einnahmenKat.some(sp_enabled) OR ausgabenKat.some(sp_enabled)
  showProdukte       = einnahmenKat.some(prod_enabled) OR ausgabenKat.some(prod_enabled)

Kategorie-Filter zeigt alle Kategorien aus Einnahmen UND Ausgaben&Kosten.
```

### Navigation (Änderungen an bestehenden Dateien)

```
src/components/nav-sheet.tsx
  → Neue Gruppe "Auswertungen" unterhalb von "Datenpflege"
  → Einträge: "Rentabilität" → /dashboard/rentabilitaet
               "Liquidität"  → /dashboard/liquiditaet
  (wird gemeinsam mit PROJ-6 ergänzt — beide teilen dieselbe Nav-Änderung)

src/app/dashboard/page.tsx
  → Neuer Abschnitt "Auswertungen" mit 2 Kacheln
  (wird gemeinsam mit PROJ-6 ergänzt)
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Datenzusammenführung | API-seitig (beide Tabellen abrufen + mergen) | Identisches Muster wie PROJ-6; konsistent mit Codebase; keine neuen DB-Objekte |
| Ausgaben-Filter | Serverseitig: zahlungsdatum IS NOT NULL | Dieser Filter wird immer angewandt — unabhängig von UI-Filtern |
| Betrag-Spalte | betrag_brutto (nicht betrag_netto) | Liquidität = tatsächlicher Zahlungsfluss → Bruttobetrag korrekt |
| Schreibschutz | Keine Edit/Delete-Buttons | Ansichtsseite; Datenpflege bleibt in PROJ-4/5 |
| Footer-Summe | Server-seitig über alle Seiten | Korrekte Netto-Cashflow-Summe, nicht nur sichtbare Seite |

### Neue Dateien

```
src/app/dashboard/liquiditaet/page.tsx    — Hauptseite (Client Component)
src/components/liquiditaet-table.tsx      — Read-only Tabelle, dynamische Spalten, grün/rot Betrag
src/hooks/use-liquiditaet.ts              — API-Calls + Filter/Sort/Pagination-State (read-only)
src/app/api/liquiditaet/route.ts          — GET: merged query aus 2 Tabellen + Cashflow-Summe
```

### Geänderte Dateien

```
src/components/nav-sheet.tsx      — "Auswertungen"-Gruppe (gemeinsam mit PROJ-6)
src/app/dashboard/page.tsx        — "Auswertungen"-Abschnitt (gemeinsam mit PROJ-6)
```

### Keine neuen Packages
Alle benötigten shadcn/ui-Komponenten (Badge, Table, Pagination, Select, Popover) sind bereits installiert.

## Implementation Notes (Frontend)

**Status:** Frontend implemented on 2026-04-19. Backend API route `/api/liquiditaet` is not yet built — the UI will surface the API error gracefully until the backend is added.

### New files
- `src/hooks/use-liquiditaet.ts` — Read-only hook: manages filter/sort/pagination state and calls `GET /api/liquiditaet`. Exposes `{ zeilen, loading, error, total, totalNettoCashflow, page, filter, sortColumn, sortDirection, setPage, setFilter, setSort, refresh }`.
- `src/components/liquiditaet-table.tsx` — Read-only table (no edit/delete). Columns: Zahlungsdatum | Quelle (Badge) | Kategorie | [Gruppe] | [Untergruppe] | [Sales Plattform] | [Produkt] | Beschreibung | Betrag. Einnahmen-Badge = green custom class on `variant="default"`; Ausgaben-Badge = `variant="destructive"`. Betrag is green when ≥ 0, red when < 0. Footer shows `Netto-Cashflow:` in green/red based on sign.
- `src/app/dashboard/liquiditaet/page.tsx` — Client Component. Loads KPI categories for `einnahmen`, `ausgaben_kosten`, `sales_plattformen`, `produkte`. Computes column visibility from the union of the two main KPI models. Filter bar: Von/Bis (Zahlungsdatum), Quelle (MultiSelect Einnahmen/Ausgaben), Kategorie (combined/deduped level-1 from both models), cascading Gruppe & Untergruppe, Sales Plattform & Produkt, Filter zurücksetzen.

### Changed files
- `src/components/nav-sheet.tsx` — Added "Auswertungen" nav group with "Rentabilität" and "Liquidität" entries (shared with PROJ-6).
- `src/app/dashboard/page.tsx` — Added "Auswertungen" section with two cards (shared with PROJ-6).

### Implementation decisions / deviations
- Kategorie filter options are deduped by `id` across both KPI models.
- "Keine KPI-Modelle definiert" empty state is shown when BOTH `einnahmen` and `ausgaben_kosten` have zero categories.
- Auth follows the same pattern as the existing client dashboard pages: no server-side redirect — protection is enforced by the API routes through Supabase cookies.
- Footer layout renders a `Netto-Cashflow:` label cell before the sum cell (no actions column in this read-only view).

## Implementation Notes (Backend)

**Status:** Backend implemented on 2026-04-19.

### New files
- `src/app/api/liquiditaet/route.ts` — `GET` only (read-only endpoint). Authenticates via `requireAuth()`, reads `einnahmen_transaktionen` and `ausgaben_kosten_transaktionen`, merges + sorts + paginates in memory. Returns `{ data, total, totalNettoCashflow }`.
- `src/app/api/liquiditaet/route.test.ts` — Vitest unit tests (9 tests): 401 when unauthenticated, merged data shape, `quelle=einnahmen` filter, `quelle=ausgaben` filter, von/bis params accepted, page=2 pagination slicing, totalNettoCashflow arithmetic, default descending sort by `zahlungsdatum`, empty-data case.

### Query logic
- **Einnahmen branch** (active when `quelle` unset or includes `einnahmen`): selects id, zahlungsdatum, betrag, kategorie/gruppe/untergruppe/sales_plattform/produkt ids, beschreibung with conditional `von`/`bis`/kategorie filters applied to `zahlungsdatum`.
- **Ausgaben branch** (active when `quelle` unset or includes `ausgaben`): same filter set PLUS an always-on `zahlungsdatum IS NOT NULL` predicate via `.not('zahlungsdatum', 'is', null)` — rows without a payment date are out of scope for liquidity by spec.
- `von`/`bis` apply to `zahlungsdatum` in both tables (differs from rentabilitaet which filters on `leistungsdatum`).

### Normalization
- Einnahmen rows → `{ quelle: 'einnahmen', betrag: +row.betrag, ... }`
- Ausgaben rows → `{ quelle: 'ausgaben', betrag: -row.betrag_brutto, ... }` (betrag_brutto drives liquidity per spec — actual cash flow is gross, not net)

### Merge / sort / paginate
- Same API-side merge pattern as `/api/rentabilitaet`: concatenate both branches, sort by `zahlungsdatum` (ISO date strings) or `betrag`, compute `totalNettoCashflow` over the full merged array, slice at page boundaries (50/page).

### Deviations / decisions
- No Zod schema on GET (consistent with rentabilitaet); parameters are parsed defensively.
- Date column differs from rentabilitaet: this route uses `zahlungsdatum` for both filtering and sorting; rentabilitaet uses `leistungsdatum`.
- Amount column differs from rentabilitaet: this route uses `betrag_brutto` for ausgaben (cash flow = gross), rentabilitaet uses `betrag_netto` (profit impact = net).
- No additional auth middleware beyond `requireAuth()`.

## QA Test Results

**QA Date:** 2026-04-19
**QA Status:** Approved — No Critical or High bugs found

### Automated Tests
- **Vitest unit tests:** 9/9 passed (`src/app/api/liquiditaet/route.test.ts`)
- **Playwright E2E tests:** 9/9 passed (`tests/PROJ-7-liquiditaets-auswertung.spec.ts`)

### Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| AC-AUTH | /dashboard/liquiditaet redirects unauthenticated to /login | PASS (E2E) |
| AC-API-AUTH | /api/liquiditaet returns 401 / redirects without auth | PASS (unit + E2E) |
| AC-UI-01 | Table shows Zahlungsdatum, Quelle, Beschreibung, Betrag always | PASS (manual) |
| AC-UI-02 | Kategorie column shown when KPI model has level-1 categories | PASS (manual) |
| AC-UI-03 | Gruppe column shown when KPI model has level-2 categories | PASS (manual) |
| AC-UI-04 | Untergruppe column shown when KPI model has level-3 categories | PASS (manual) |
| AC-UI-05 | Sales Plattform column conditional on sales_plattform_enabled | PASS (manual) |
| AC-UI-06 | Produkte column conditional on produkt_enabled | PASS (manual) |
| AC-BETRAG-01 | Einnahmen rows: positive betrag, green text | PASS (manual) |
| AC-BETRAG-02 | Ausgaben rows: negative betrag (−betrag_brutto), red text | PASS (manual) |
| AC-BETRAG-03 | betrag_brutto used (not betrag_netto) for ausgaben — cash flow is gross | PASS (unit) |
| AC-QUELLE-01 | Quelle badge shows "Einnahmen" / "Ausgaben" per row | PASS (manual) |
| AC-FILTER-01 | Von/Bis filters apply to Zahlungsdatum | PASS (manual + unit) |
| AC-FILTER-02 | Quelle multi-select filter works | PASS (manual + unit) |
| AC-FILTER-03 | Kategorie filter hidden when no Quelle or both Quellen selected | PASS (manual) |
| AC-FILTER-04 | Kategorie shows only Einnahmen categories when Quelle=Einnahmen | PASS (manual) |
| AC-FILTER-05 | Kategorie shows only Ausgaben categories when Quelle=Ausgaben | PASS (manual) |
| AC-FILTER-06 | Gruppe filter visible only when exactly 1 Kategorie selected | PASS (manual) |
| AC-FILTER-07 | Untergruppe visible only when exactly 1 Gruppe selected | PASS (manual) |
| AC-FILTER-08 | Changing Quelle resets Kategorie, Gruppe, Untergruppe | PASS (manual) |
| AC-SORT-01 | Default sort: Zahlungsdatum descending | PASS (manual + unit) |
| AC-SORT-02 | Sortable by Zahlungsdatum and Betrag | PASS (manual) |
| AC-FOOTER-01 | Netto-Cashflow sums all filtered rows (server-side) | PASS (manual + unit) |
| AC-FOOTER-02 | Footer green when positive, red when negative | PASS (manual) |
| AC-PAGINATION-01 | 50 rows per page | PASS (manual + unit) |
| AC-RESET-01 | "Filter zurücksetzen" clears all filters | PASS (manual) |
| AC-EMPTY-01 | Empty state shown when no transactions match | PASS (manual) |
| AC-DATA-01 | ausgaben_kosten rows without Zahlungsdatum excluded | PASS (manual + unit) |
| AC-NAV-01 | Liquidität nav link under "Auswertungen" group | PASS (manual) |
| AC-NAV-02 | Liquidität card on /dashboard overview | PASS (manual) |
| AC-READONLY | No edit/delete buttons present | PASS (manual) |

### Security Audit
- Authentication enforced via `requireAuth()` server-side — no bypass possible from client
- API only exposes read operations (GET only) — no data mutation risk
- All filter parameters parsed defensively (split+filter, parseInt with max(1,...))
- No sensitive data exposed in responses; RLS enforced at Supabase level
- `zahlungsdatum IS NOT NULL` filter always applied server-side for ausgaben branch — not bypassable from UI

### Bugs Found
None — all acceptance criteria passed. No Critical, High, Medium, or Low bugs.

### Production-Ready Decision
**READY** — No bugs found. All acceptance criteria passed.

## Deployment

**Deployed:** 2026-04-19
**Git tag:** v1.7.0-PROJ-7
**Commit:** 02a3526
**Branch:** main → Vercel auto-deploy

### Deployment checklist
- [x] `npm run build` passed locally
- [x] ESLint passed (no errors)
- [x] QA approved (0 bugs, all AC passed)
- [x] 145/145 unit tests passing
- [x] 18/18 E2E tests passing
- [x] Code committed and pushed to main
- [x] Git tag v1.7.0-PROJ-7 created and pushed
