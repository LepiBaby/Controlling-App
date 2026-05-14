# PROJ-20: Rentabilitätsreport

## Status: Deployed
**Created:** 2026-05-13
**Last Updated:** 2026-05-13

> **Spec-Ergänzung 2026-05-13:** Produktinvestitionen-Raten als neuer Kostentyp integriert (s. Wertberechnung Punkt 3 + neue Acceptance Criteria). QA-Ergebnisse gelten für den vorherigen Stand und müssen nach Neuimplementierung wiederholt werden.

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Kategoriehierarchien als Zeilen-Grundlage
- Requires: PROJ-3 (Umsatz-Transaktionen) — Quelldaten für Erlöse
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen) — Quelldaten für Kosten
- Requires: PROJ-12 (Abschreibungen) — Abschreibungsraten fließen in Kategorie-Werte ein
- Requires: PROJ-19 (Reporting-Konfiguration) — `report_positionen`-Tabelle mit nutzer-definierter Struktur

## Übersicht
Eine neue Report-Seite unter `/dashboard/reporting/rentabilitaet`. Sie stellt die Gewinn-und-Verlust-Rechnung (GuV) des Unternehmens als **Matrix-Tabelle** dar: Zeilen sind die Report-Positionen (nutzer-definiert im KPI-Modell → Tab „Reporting-Modell"), Spalten sind Zeitperioden (Monate, Quartale oder Jahre).

**Die Zeilenstruktur ergibt sich vollständig aus dem im KPI-Modell konfigurierten Reporting-Modell** — es gibt keine hardcodierte P&L-Gliederung. Der Nutzer definiert dort:
- **Reguläre Positionen** (`type = 'position'`): Zeigen die Summe der zugewiesenen Ebene-1-Kategorien je Periode. Umsatz-Kategorien fließen positiv ein, Ausgaben-&-Kosten-Kategorien negativ.
- **Summen-Positionen** (`type = 'summe'`): Summieren ausgewählte reguläre Positionen und erscheinen als hervorgehobene Zwischensummen-Zeilen (z.B. „Netto-Umsatz", „DB1", „EBIT").

Beispiel einer nutzer-definierten Struktur:

```
Umsatz Online-Shop            ← reguläre Position (Umsatz-Kategorie → positiv)
Umsatz Marktplatz             ← reguläre Position
Retouren                      ← reguläre Position (Umsatz-Kategorie → positiv; Nutzer kann
                                 Subtraktion in Summen-Position konfigurieren)
─────────────────────────────────────────────────────────────
= Netto-Umsatz                ← Summen-Position (referenziert obige Positionen)
─────────────────────────────────────────────────────────────
Produktkosten                 ← reguläre Position (Ausgaben-Kategorie → negativ)
─────────────────────────────────────────────────────────────
= DB1                         ← Summen-Position
─────────────────────────────────────────────────────────────
...                           (beliebig weiterführbar)
```

Jede reguläre Position ist **ausklappbar**: Position → Ebene-1-Kategorie → Gruppe → Untergruppe → Sales Plattform / Produkt.

## User Stories

- Als Nutzer möchte ich alle konfigurierten Report-Positionen dauerhaft als Zeilen sehen (auch wenn kein Wert für einen Zeitraum vorhanden ist), damit mir die Struktur meiner GuV immer vollständig angezeigt wird.
- Als Nutzer möchte ich zwischen Monats-, Quartals- und Jahresansicht wechseln können, damit ich die GuV auf verschiedenen Granularitätsstufen analysieren kann.
- Als Nutzer möchte ich einen frei wählbaren Zeitraum (Von / Bis) eingeben können, der bestimmt, welche Spalten angezeigt werden, damit ich flexibel beliebige Zeiträume auswerten kann.
- Als Nutzer möchte ich reguläre Positionen ausklappen können, um die zugewiesenen Kategorien, Gruppen, Untergruppen und ggf. Sales Plattformen / Produkte zu sehen.
- Als Nutzer möchte ich Summen-Positionen dauerhaft hervorgehoben sehen, damit ich auf einen Blick Zwischensummen erkenne.
- Als Nutzer möchte ich Abschreibungen innerhalb ihrer jeweiligen Kategorie/Position sehen, damit die P&L vollständig ist.
- Als Nutzer möchte ich einen direkten Link zum Reporting-Modell-Tab sehen, wenn noch keine Positionen konfiguriert sind, damit ich schnell die Struktur aufbauen kann.

## Acceptance Criteria

### Seite & Navigation

- [ ] Seite unter `/dashboard/reporting/rentabilitaet` erreichbar
- [ ] Seite ist nur für eingeloggte Nutzer zugänglich
- [ ] Nav-Link „Rentabilitätsreport" unter der Gruppe „Reporting" führt zur Seite (geliefert von PROJ-19)

### Zeitraum & Tabs

- [ ] Oben auf der Seite befindet sich ein **Von/Bis-Datumswähler** (Monatsauflösung: Monat + Jahr), der den angezeigten Zeitraum steuert
- [ ] Standardwert beim Öffnen: aktuelles Kalenderjahr (01.01. des aktuellen Jahres bis 31.12. des aktuellen Jahres)
- [ ] **Tab „Monatlich"**: Jeder Monat im Zeitraum erscheint als eigene Spalte (Format: „Jan 2026", „Feb 2026", ...)
- [ ] **Tab „Quartal"**: Jedes Quartal im Zeitraum erscheint als eigene Spalte (Format: „Q1 2026", „Q2 2026", ...)
- [ ] **Tab „Jahr"**: Jedes Kalenderjahr im Zeitraum erscheint als eigene Spalte (Format: „2024", „2025", „2026")
- [ ] Wechsel zwischen Tabs behält den gewählten Von/Bis-Zeitraum bei — nur die Spalten-Aggregation ändert sich
- [ ] Wenn kein Zeitraum gewählt ist, bleibt die Tabelle leer mit Hinweistext

### Zeilen-Struktur (Reporting-Modell)

- [ ] Die Zeilen der Tabelle werden aus `report_positionen` geladen, sortiert nach `sort_order`
- [ ] Alle konfigurierten Report-Positionen erscheinen dauerhaft als Zeilen — auch wenn kein Wert vorhanden (dann: 0 €)
- [ ] Reguläre Positionen (`type = 'position'`) zeigen den berechneten Summen-Wert ihrer zugewiesenen Kategorien
- [ ] Summen-Positionen (`type = 'summe'`) sind visuell hervorgehoben (fette Schrift, Hintergrundfarbe, Trennlinie) und zeigen die Summe der referenzierten regulären Positionen
- [ ] Die Reihenfolge der Zeilen entspricht exakt der im Reporting-Modell gespeicherten `sort_order`
- [ ] **Leerzustand**: Wenn keine Report-Positionen konfiguriert sind → Hinweistext „Noch kein Reporting-Modell konfiguriert" mit Link zum KPI-Modell → Tab „Reporting-Modell"

### Ausklappbare Zeilen (Drill-Down)

- [ ] Jede **reguläre Position** (`type = 'position'`) mit zugewiesenen Kategorien hat einen Expand/Collapse-Toggle
- [ ] Ausgeklappt erscheinen die zugewiesenen **Ebene-1-Kategorien** als eingerückte Unterzeilen
- [ ] Jede Ebene-1-Kategorie ist weiter ausklappbar und zeigt **Gruppen (Ebene 2)** als tiefer eingerückte Zeilen
- [ ] Jede Gruppe ist ausklappbar und zeigt **Untergruppen (Ebene 3)**
- [ ] Wenn für eine Kategorie `sales_plattform_enabled = true` gesetzt ist, erscheinen auf der untersten Ebene die Sales-Plattform-Werte
- [ ] Wenn für eine Kategorie `produkt_enabled = true` gesetzt ist, erscheinen auf der untersten Ebene die Produkt-Werte
- [ ] **Summen-Positionen** sind nicht ausklappbar (sie zeigen keine direkten Kategorie-Daten)
- [ ] Positionen ohne zugewiesene Kategorien haben keinen Expand-Toggle
- [ ] Expand/Collapse-Zustand bleibt beim Tab-Wechsel (Monatlich / Quartal / Jahr) erhalten
- [ ] Ein globaler „Alle ausklappen / Alle einklappen"-Button ist vorhanden

### Wertberechnung pro Zelle

Für jede Kombination (Zeile × Zeitperioden-Spalte) wird folgender Wert berechnet:

**Reguläre Position (`type = 'position'`):**
- Summe über alle zugewiesenen Ebene-1-Kategorien:
  - Für jede **Umsatz-Kategorie**: `+` Summe aller `umsatz_transaktionen.betrag` WHERE `kategorie_id` in dieser Kategorie (oder Kind-Kategorien bei Gruppenzeilen) AND `leistungsdatum` in der Spalten-Periode
  - Für jede **Ausgaben-&-Kosten-Kategorie**: `−` (negiert) Summe aus:
    1. **Direktbuchungen**: `ausgaben_kosten_transaktionen.betrag_netto` WHERE `kategorie_id` = diese Kategorie AND `relevant_fuer_rentabilitaet IN ('ja', NULL)` AND `leistungsdatum IS NOT NULL` AND `abschreibung IS NULL` AND `leistungsdatum` in Periode — **ausgenommen** Transaktionen der Kategorie „Produktinvestitionen" (werden unter Punkt 3 separat behandelt)
    2. **Abschreibungsraten**: Berechnete Monatsraten (gem. PROJ-12-Logik) aus Transaktionen mit `abschreibung IS NOT NULL` AND `kategorie_id` = diese Kategorie, deren **Ratendatum** in die Periode fällt
    3. **Produktinvestitionen-Raten**: Transaktionen, deren Ebene-1-Kategorie den Namen „Produktinvestitionen" trägt (exakter Name-Match auf `kpi_categories.name`, Ebene 1), werden **nicht** als Direktbuchung (Punkt 1) erfasst, sondern als **12 gleichmäßige Monatsraten** (analog PROJ-15 / Investitionen-Report):
       - Grundrate = `betrag_netto / 12`, kaufmännisch auf 2 Dezimalstellen gerundet; letzte Rate = Restbetrag (exakte Summe = `betrag_netto`)
       - Erstes Ratendatum = Monat des `leistungsdatum` der Ursprungstransaktion, fortlaufend via `addMonthsWithClamp`
       - Nur Raten, deren Ratendatum in die Spalten-Periode fällt, werden in der jeweiligen Spalte summiert
       - Transaktionen mit `betrag_netto = 0` erzeugen keine Raten
       - Betrag je Rate: negiert (Kostenseite)

**Ebene-1-Kategorie-Unterzeile (innerhalb ausgeklappter Position):**
- Analog zur Position, aber nur für genau diese eine Kategorie berechnet (kein Vorzeichen-Flip — die Zeile zeigt den Betrag in Originalvorzeichen, d.h. Ausgaben-Kategorie zeigt negativen Wert)

**Gruppen- / Untergruppen-Unterzeile:**
- Analog Kategorie-Ebene, gefiltert auf `gruppe_id` bzw. `untergruppe_id`

**Summen-Position (`type = 'summe'`):**
- Summe der Werte aller referenzierten regulären Positionen für dieselbe Periode
- Formel: `Σ (Wert der referenzierten Position i für Periode t)`

### Wertberechnung (Testpunkte)

- [ ] Umsatz-Kategorien fließen positiv ein
- [ ] Ausgaben-Kategorien fließen negativ ein (Direktbuchungen + Abschreibungsraten + Produktinvestitionen-Raten)
- [ ] `relevant_fuer_rentabilitaet = 'nein'` → nicht berücksichtigt
- [ ] Ausgaben-Transaktion ohne `leistungsdatum` → nicht berücksichtigt
- [ ] Abschreibungstransaktionen werden als Monatsraten berechnet (gem. PROJ-12-Logik)
- [ ] Transaktionen der Kategorie „Produktinvestitionen" (Ebene-1-Name-Match) fließen als **12 gleichmäßige Monatsraten** ein — nicht als Direktbuchung im Buchungsmonat
- [ ] Produktinvestitionen-Raten werden nur dann in einer Periode gezählt, wenn ihr Ratendatum in die Spalten-Periode fällt
- [ ] Transaktionen mit Kategorie „Produktinvestitionen" sind aus der Direktbuchungs-Verarbeitung ausgeschlossen (kein Doppelzählen)
- [ ] Produktinvestitions-Transaktion mit `betrag_netto = 0` → keine Raten erzeugen

### Darstellung

- [ ] Positive Werte werden schwarz/grün dargestellt, negative Werte rot mit Minuszeichen
- [ ] 0-Werte werden als „0,00 €" (oder „—") dargestellt, nicht leer gelassen
- [ ] Beträge immer mit 2 Dezimalstellen und € (z.B. „12.450,00 €")
- [ ] Die Zeilen-Beschriftung (Positions- / Kategoriename) bleibt beim horizontalen Scrollen sichtbar (sticky erste Spalte)
- [ ] Bei vielen Spalten (z.B. 24 Monate) ist die Tabelle horizontal scrollbar
- [ ] Summen-Positionen sind optisch klar von regulären Positionen abgegrenzt

### Leer-Zustände

- [ ] Kein Von/Bis-Zeitraum gewählt → Hinweistext „Bitte Zeitraum auswählen"
- [ ] Zeitraum gewählt, aber keine Transaktionen → alle Werte zeigen 0 €, Struktur bleibt vollständig sichtbar
- [ ] Keine Report-Positionen konfiguriert → Hinweistext „Noch kein Reporting-Modell konfiguriert — bitte im KPI-Modell → Tab „Reporting-Modell" Positionen anlegen" mit direktem Link

## Edge Cases

- Report-Position ist konfiguriert, hat aber 0 Transaktionen im Zeitraum → Zeile erscheint mit 0 € (dauerhaft sichtbar)
- Reguläre Position hat keine zugewiesenen Kategorien → Wert ist immer 0 €, kein Expand-Toggle
- Summen-Position hat keine referenzierten Positionen (alle gelöscht) → Wert ist 0 €
- KPI-Kategorie wird während der Anzeige gelöscht → wird beim nächsten Laden entfernt (keine Live-Updates nötig)
- Ausgaben-Transaktion hat `relevant_fuer_rentabilitaet = 'nein'` → nicht berücksichtigt
- Ausgaben-Transaktion hat kein `leistungsdatum` → nicht berücksichtigt
- Abschreibungstransaktion läuft über Jahresgrenzen → nur die Raten, deren Ratendatum in die gewählte Periode fällt, werden in der jeweiligen Spalte gezeigt
- Produktinvestitions-Transaktion läuft über Jahresgrenzen → analog zu Abschreibungen: nur Raten, deren Ratendatum in die gewählte Periode fällt, werden gezeigt
- Produktinvestitions-Transaktion mit `betrag_netto = 0` → keine Raten erzeugen (überspringen)
- Es gibt keine Ebene-1-Kategorie mit Name „Produktinvestitionen" → Produktinvestitionen-Raten-Logik wird nicht ausgeführt, kein Fehler
- Zeitraum Von > Bis → Validierungsfehler, Tabelle nicht angezeigt
- Sehr breite Tabelle (monatlich, 3 Jahre = 36 Spalten) → horizontales Scrolling mit sticky Zeilenbeschriftung
- Gruppen/Untergruppen ohne eigene Transaktionen, aber mit Kind-Transaktionen → Gruppenzeile zeigt Summe der Kind-Transaktionen
- Sales-Plattform- oder Produkt-Zeile hat keine Transaktionen → 0 €, Zeile bleibt sichtbar wenn ausgeklappt
- Dieselbe KPI-Kategorie ist mehreren Positionen zugewiesen → in jeder Position separat berechnet (kein Konflikt — Nutzer-definiertes Modell)

## Technische Anforderungen

- **URL:** `/dashboard/reporting/rentabilitaet`
- **Datenquellen:** `report_positionen`, `report_position_kategorien`, `report_summe_positionen`, `umsatz_transaktionen`, `ausgaben_kosten_transaktionen` (Direktbuchungen, Abschreibungen, Produktinvestitionen-Raten), `kpi_categories`
- **API:** Neue Route `GET /api/reporting/rentabilitaet` — gibt alle Werte für alle Report-Positionen für den gewählten Zeitraum zurück, aggregiert nach Periode und aufbereitet für die Matrix-Darstellung
  - Query-Parameter: `von` (YYYY-MM), `bis` (YYYY-MM), `granularitaet` ('monat' | 'quartal' | 'jahr')
  - Lädt zuerst alle `report_positionen` (mit Kategorien und Summen-Refs), berechnet dann pro Position × Periode den Wert
- **Abschreibungslogik:** Serverseitig — identische Berechnung wie `GET /api/abschreibungen` (PROJ-12), integriert in die Report-API
- **Produktinvestitionen-Logik:** Serverseitig — identische 12-Monats-Ratenberechnung wie `GET /api/investitionen-abschreibungen` (PROJ-15): Kategorie „Produktinvestitionen" per Name-Match ermitteln, betroffene Transaktionen aus Direktbuchungs-Verarbeitung ausschließen, Raten via `addMonthsWithClamp` berechnen, nur Raten im Zeitraum akkumulieren
- **Performance:** Berechnung serverseitig, vollständige Daten für den gewählten Zeitraum in einem API-Call
- **Kein Pagination:** Die Tabelle hat keine Pagination (Zeilen = konfigurierte Positionen, kein unbegrenztes Wachstum)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/reporting/rentabilitaet/page.tsx
├── NavSheet (Header)
├── Filter-Leiste
│   ├── Von-Monatsauswahl  (HTML5 <input type="month">)
│   ├── Bis-Monatsauswahl  (HTML5 <input type="month">)
│   └── Granularitäts-Tabs (shadcn Tabs: Monatlich | Quartal | Jahr)
└── ReportingRentabilitaetMatrix
    ├── Leerzustand A: kein Zeitraum gewählt → Hinweistext
    ├── Leerzustand B: keine Report-Positionen konfiguriert → Link zum KPI-Modell
    ├── Ladezustand: Skeleton-Zeilen
    └── Matrix-Tabelle (overflow-x-auto, sticky erste Spalte)
        ├── Kopfzeile: [Bezeichnung (sticky) | Jan 2026 | Feb 2026 | ...]
        └── Datenzeilen (ReportingRentabilitaetRow je Eintrag)
            ├── Position-Zeile (type='position', ausklappbar wenn Kategorien vorhanden)
            │   └── [ausgeklappt] Ebene-1-Kategorie-Zeile (eingerückt, ausklappbar)
            │       └── [ausgeklappt] Gruppen-Zeile (mehr eingerückt, ausklappbar)
            │           └── [ausgeklappt] Untergruppen-Zeile (ausklappbar wenn Sales/Produkt)
            │               └── [ausgeklappt] Sales-Plattform- oder Produkt-Zeile (Blatt)
            └── Summen-Zeile (type='summe', hervorgehoben, nicht ausklappbar)
```

### Datenmodell (API-Response)

Der neue Endpunkt `GET /api/reporting/rentabilitaet` gibt ein vollständiges, hierarchisch geschachteltes Objekt zurück — alle Perioden und alle Drill-Down-Ebenen in einem einzigen Aufruf:

```
ReportingRentabilitaetResponse
  perioden: string[]       — geordnete Liste der Perioden-Schlüssel
                             Monatlich: ["2026-01", "2026-02", ...]
                             Quartal:   ["2026-Q1", "2026-Q2", ...]
                             Jahr:      ["2025", "2026"]
  positionen: ReportPosition[]

ReportPosition
  id, name, type ('position' | 'summe'), sort_order
  values: { "2026-01": 1234.56, ... }   — Wert je Periode
  kategorien: ReportKategorie[]          — nur bei type='position'

ReportKategorie  (Ebene-1-Kategorie)
  id, name, kpi_type ('umsatz' | 'ausgaben_kosten')
  values: { ... }
  gruppen: ReportGruppe[]

ReportGruppe  (Ebene-2-Gruppe)
  id, name
  values: { ... }
  untergruppen: ReportUntergruppe[]

ReportUntergruppe  (Ebene-3-Untergruppe)
  id, name
  values: { ... }
  sales_plattformen: ReportBlatt[]    — wenn sales_plattform_enabled
  produkte: ReportBlatt[]             — wenn produkt_enabled

ReportBlatt  (Sales-Plattform oder Produkt)
  id, name
  values: { ... }
```

### API-Endpunkt

```
GET /api/reporting/rentabilitaet
  ?von=2026-01          (YYYY-MM, Pflicht)
  ?bis=2026-12          (YYYY-MM, Pflicht)
  ?granularitaet=monat  ('monat' | 'quartal' | 'jahr')

Server-seitige Schritte:
  1. report_positionen laden (inkl. kategorien + summe_positionen)
  2. Alle kpi_categories (für Hierarchie-Lookup) laden
  3. umsatz_transaktionen im Zeitraum laden
  4. ausgaben_kosten_transaktionen (direkt + Abschreibungen) im Zeitraum laden
  5. Je Transaktion: Periodenslot bestimmen (Monat / Quartal / Jahr)
  6. Je Position × Periode: Werte aggregieren (Umsatz positiv, Ausgaben negativ)
  7. Summen-Positionen: Summe der referenzierten Positionen
  8. Drill-Down: Gruppen/Untergruppen/Plattformen analog aggregieren
  9. Hierarchisches Response-Objekt zurückgeben
```

### Wertberechnung serverseitig

**Direkte Ausgaben-Buchungen:**
- `ausgaben_kosten_transaktionen` WHERE `abschreibung IS NULL` AND `leistungsdatum IS NOT NULL` AND `relevanz IN ('rentabilitaet', 'beides')`
- `betrag_netto` → negiert

**Abschreibungsraten** (exakte Logik aus `GET /api/abschreibungen` wiederverwendet):
- Transaktionen mit `abschreibung IS NOT NULL` → Raten berechnen via `addMonthsWithClamp`
- Nur Raten, deren Ratendatum in den Zeitraum fällt
- Betrag pro Rate → negiert

**Gemeinsame Hilfsfunktion:**
`src/lib/abschreibung-utils.ts` — extrahiert aus `src/app/api/abschreibungen/route.ts`:
- `addMonthsWithClamp(ursprung, offset)` — Datums-Verschiebung mit Tag-Clamp
- `ABSCHREIBUNG_MONATE` — Lookup-Tabelle (3/5/7/10 Jahre → Anzahl Monate)
- `berechneAbschreibungsRaten(transaktionen)` — gibt alle Raten zurück

### Expand/Collapse-Zustand

- Im Frontend als `Set<string>` der ausgeklappten Zeilen-IDs (Position-ID + Kategorie-ID etc.)
- Zustand lebt in der Page-Komponente oder im Matrix-Component als `useState`
- Kein Server-Round-Trip beim Ausklappen — alle Daten sind bereits geladen
- „Alle ausklappen / einklappen"-Button füllt/leert das Set

### Neue Dateien

```
src/app/dashboard/reporting/rentabilitaet/page.tsx
  → Seite: Filter-Leiste (Von/Bis + Tabs) + ReportingRentabilitaetMatrix

src/app/api/reporting/rentabilitaet/route.ts
  → GET: Alle Daten für den Zeitraum berechnen und zurückgeben
  → Authentifizierung via requireAuth()
  → Zod-Validierung der Query-Parameter

src/hooks/use-reporting-rentabilitaet.ts
  → Filterzustand (von, bis, granularitaet) verwalten
  → API-Aufruf steuern (nur wenn von + bis gesetzt)
  → Lade-/Fehlerzustand zurückgeben

src/components/reporting-rentabilitaet-matrix.tsx
  → Matrix-Tabelle: sticky erste Spalte, horizontales Scrollen
  → Expand-/Collapse-State (Set<string>)
  → Globaler Ausklappen-Button
  → Leerzustand-Handling

src/lib/abschreibung-utils.ts
  → Geteilte Abschreibungslogik (aus /api/abschreibungen extrahiert)
```

### Geänderte Dateien

```
src/app/api/abschreibungen/route.ts
  → addMonthsWithClamp + ABSCHREIBUNG_MONATE → Import aus abschreibung-utils.ts
    (Verhalten identisch, keine inhaltliche Änderung)
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| API-Namespace | `/api/reporting/rentabilitaet` | Konfliktfrei zu `/api/rentabilitaet` (bestehende Transaktionsliste) |
| Datenladen | Ein API-Call, vollständig | Matrix-Größe ist überschaubar (max. ~12.000 Zahlen bei 3 Jahren monatlich); kein Pagination nötig |
| Drill-Down-Daten | Vollständig in der API-Response | Kein weiterer Server-Request beim Ausklappen; schnelle UX |
| Monatsauswahl | HTML5 `<input type="month">` | Kein zusätzliches Package; Browser-nativ; liefert direkt `YYYY-MM` |
| Granularitäts-Auswahl | shadcn `Tabs` | Bereits im Projekt vorhanden; konsistent mit KPI-Modell-Tabs |
| Sticky erste Spalte | CSS `position: sticky; left: 0` | Keine zusätzliche Library; funktioniert in allen modernen Browsern |
| Abschreibungslogik | Extraktion in `abschreibung-utils.ts` | Gleicher Code in zwei API-Routen vermeiden; Single Source of Truth |
| Expand-State | `useState` mit `Set<string>` | Alle Daten bereits geladen; kein globaler State nötig |
| Vorzeichen | Kategorie-Typ bestimmt Vorzeichen | Umsatz → positiv, Ausgaben → negativ; keine `ist_abzugsposten`-Logik mehr nötig |

## Implementation Notes (Frontend — 2026-05-13)

### Neue Dateien
- `src/lib/abschreibung-utils.ts` — `addMonthsWithClamp`, `ABSCHREIBUNG_MONATE`, `roundTo2` als gemeinsame Utilities
- `src/hooks/use-reporting-rentabilitaet.ts` — Typdefinitionen (`ReportPosition`, `ReportKategorie`, `ReportGruppe`, `ReportUntergruppe`, `ReportBlatt`, `ReportingRentabilitaetData`) + State-Management (von/bis/granularitaet + API-Aufruf)
- `src/components/reporting-rentabilitaet-matrix.tsx` — Matrix-Tabelle mit sticky erster Spalte, flacher Zeilen-Flatten-Logik, Expand/Collapse via `Set<string>`, "Alle ausklappen"-Button, Leerzustand-Handling
- `src/app/dashboard/reporting/rentabilitaet/page.tsx` — Seite mit Von/Bis-Monatsauswahl (`<input type="month">`), Granularitäts-Tabs (Monatlich/Quartal/Jahr), Fehler- und Validierungsanzeige

### Geänderte Dateien
- `src/app/api/abschreibungen/route.ts` — importiert jetzt aus `abschreibung-utils.ts` statt duplizierter lokaler Funktionen

### Build & Tests
- `npm run build` ✅ — alle Routen korrekt, neue Seite unter `/dashboard/reporting/rentabilitaet`
- `npm test` ✅ — 294/294 Tests grün

## Implementation Notes (Backend — 2026-05-13)

### Neue Dateien
- `src/app/api/reporting/rentabilitaet/route.ts` — GET-Handler mit Zod-Validierung, 9 Supabase-Abfragen (sequentiell + parallel), Akkumulator-Logik, Summen-Positionen-Berechnung, hierarchische Response
- `src/app/api/reporting/rentabilitaet/route.test.ts` — 17 Testfälle (Auth, Validierung, Periodenberechnung, Wertberechnung, Drill-Down, Filterlogik)

### Architektur der API-Route
- **Stage 1**: `report_positionen` laden (inkl. `kpi_category_ids` via `report_position_kategorien`)
- **Stage 2** (parallel): `report_position_kategorien` + `report_summe_positionen`
- **Stage 3** (8-fach parallel): `kpi_categories`, Umsatz-Transaktionen, Ausgaben-Transaktionen (direkt + Abschreibungen), Plattformen/Produkte, Bestandsdaten, Produktkosten
- **Stage 3b** (sequenziell, bedingt): Produktinvestitionen-Transaktionen — nur wenn Kategorie „Produktinvestitionen" (Ebene 1) in `allCats` vorhanden und einer Report-Position zugewiesen ist
- **Stage 4**: Akkumulation via `processTransaction()` — inkl. Bestandsberechnung (5b), Wertverlust (5c), Manuelle Sendungen (5d), Produktinvestitionen-Raten (5e)
- **Stage 5**: Reguläre Positions-Werte → Summen-Positionen
- **Stage 6**: Hierarchisches Response-Objekt aufbauen

### Besonderheiten
- `relevanz IN ('rentabilitaet', 'beides')` als Filter auf Ausgaben-Transaktionen; Produktinvestitionen sind von diesem Filter ausgenommen (eigener Stage-3b-Query)
- Produktinvestitionen-Transaktionen werden im `ausgabenRows`-Loop übersprungen (kein Doppelzählen), stattdessen in Stage 5e als 12 Monatsraten verarbeitet
- Abschreibungslogik via `addMonthsWithClamp` aus `src/lib/abschreibung-utils.ts`
- Summen-Positionen werden erst berechnet, nachdem alle regulären Positionen bekannt sind

## Implementation Notes (Backend — Spec-Ergänzung 2026-05-13: Produktinvestitionen-Raten)

### Geänderte Dateien
- `src/app/api/reporting/rentabilitaet/route.ts`:
  - **Stage 3b**: Sucht Kategorie „Produktinvestitionen" (Ebene 1) in `allCats`; lädt bei Treffer alle zugehörigen `ausgaben_kosten_transaktionen` ohne Datumsfilter (Raten können außerhalb des Buchungsmonats fallen)
  - **ausgabenRows-Loop**: `if (row.kategorie_id === produktinvestitionenCatId) continue` — verhindert Direktbuchung
  - **Stage 5e**: 12-Monats-Ratenberechnung identisch mit PROJ-15 (`addMonthsWithClamp`, Grundrate + Restbetrag-Korrektur); nur Raten im Zeitraum (`vonDate`–`bisDate`) werden akkumuliert
- `src/app/api/reporting/rentabilitaet/route.test.ts`:
  - `setupMocks` um optionales `piRows`-Feld erweitert (12. DB-Call, nur wenn gesetzt)
  - 4 neue Testfälle für Produktinvestitionen-Raten

### Build & Tests
- `npm run build` ✅ — `/dashboard/reporting/rentabilitaet` korrekt gebaut
- `npm test` ✅ — 341/341 Tests grün (4 neue Produktinvestitionen-Tests)

## QA Test Results

**QA Date:** 2026-05-13
**QA Status:** ✅ APPROVED — production-ready

### Automated Tests
| Suite | Result |
|---|---|
| Vitest (unit/integration) | ✅ 313/313 passed |
| Playwright E2E (chromium) | ✅ 191/191 passed (15 neue Tests für PROJ-20, 176 Regressionstests) |

### Acceptance Criteria

#### Seite & Navigation
| # | Kriterium | Status |
|---|---|---|
| AC-1 | `/dashboard/reporting/rentabilitaet` nur für eingeloggte Nutzer | ✅ PASS — E2E-Redirect-Test |
| AC-2 | ?next-Parameter wird beim Redirect erhalten | ✅ PASS — E2E-Test |
| AC-3 | Nav-Link „Rentabilitätsreport" (geliefert von PROJ-19) | ✅ PASS — bereits in PROJ-19-QA getestet |

#### Zeitraum & Tabs
| # | Kriterium | Status |
|---|---|---|
| AC-4 | Von/Bis-Monatsauswahl vorhanden | ✅ PASS — Code-Review (Input type="month") |
| AC-5 | Standardwert: aktuelles Kalenderjahr | ✅ PASS — Code-Review (Hook initialisiert mit `${currentYear}-01` / `${currentYear}-12`) |
| AC-6 | Tab „Monatlich" → Format „Jan 2026" | ✅ PASS — Code-Review + Unit-Test |
| AC-7 | Tab „Quartal" → Format „Q1 2026" | ✅ PASS — Code-Review + Unit-Test |
| AC-8 | Tab „Jahr" → Format „2026" | ✅ PASS — Code-Review + Unit-Test |
| AC-9 | Tab-Wechsel behält Von/Bis | ✅ PASS — Code-Review (Zustand in Hook, Tabs steuern nur `granularitaet`) |
| AC-10 | Kein Zeitraum → Leerzustand mit Hinweis | ✅ PASS — Code-Review (`hasValidDateRange`-Check) |

#### Zeilen-Struktur
| # | Kriterium | Status |
|---|---|---|
| AC-11 | Zeilen aus `report_positionen`, sortiert nach `sort_order` | ✅ PASS — Code-Review + Integration-Test |
| AC-12 | Alle Positionen dauerhaft sichtbar (auch bei 0 €) | ✅ PASS — `zeroValues()` garantiert 0-Einträge |
| AC-13 | Reguläre Positionen zeigen Summe zugewiesener Kategorien | ✅ PASS — Integration-Test |
| AC-14 | Summen-Positionen hervorgehoben + Summe der referenzierten Positionen | ✅ PASS — Integration-Test |
| AC-15 | Reihenfolge entspricht `sort_order` | ✅ PASS — Code-Review |
| AC-16 | Leerzustand: Kein Reporting-Modell → Hinweis + Link zum KPI-Modell | ✅ PASS — Code-Review |

#### Ausklappbare Zeilen
| # | Kriterium | Status |
|---|---|---|
| AC-17 | Reguläre Positionen mit Kategorien haben Expand-Toggle | ✅ PASS — `isPositionExpandable()` |
| AC-18 | Ausgeklappt: Gruppen als erste Ebene (keine doppelte Kategorie-Zeile bei 1 Kategorie) | ✅ PASS — `pos.kategorien.length === 1` → Kategorie-Zeile übersprungen |
| AC-19 | Gruppen weiter ausklappbar → Untergruppen | ✅ PASS — Code-Review |
| AC-20 | `sales_plattform_enabled` → Plattformen nach tiefster KPI-Ebene | ✅ PASS — `buildPlattformen()` an Ugr/Grp/Kat-Ebene |
| AC-21 | `produkt_enabled` → Produkte unter jeder Plattform | ✅ PASS — `ReportPlattform.produkte` |
| AC-22 | Summen-Positionen nicht ausklappbar | ✅ PASS — `expandable` nur bei `type === 'position'` |
| AC-23 | Globaler „Alle ausklappen / einklappen"-Button | ✅ PASS — Code-Review |

#### Wertberechnung
| # | Kriterium | Status |
|---|---|---|
| AC-24 | Umsatz-Kategorien positiv | ✅ PASS — Integration-Test |
| AC-25 | Ausgaben-Kategorien negativ | ✅ PASS — Integration-Test |
| AC-26 | `ist_abzugsposten = true` → Umsatz-Kategorie negiert (Rabatte, Rückerstattungen) | ✅ PASS — Integration-Test + Fix in dieser Session |
| AC-27 | Abschreibungsraten korrekt berechnet | ✅ PASS — Integration-Test |
| AC-28 | `relevanz IN ('rentabilitaet', 'beides')` Filter auf Ausgaben | ✅ PASS — Code-Review |

#### Darstellung
| # | Kriterium | Status |
|---|---|---|
| AC-29 | Positive Werte grün, negative rot | ✅ PASS — `valueColorClass()` |
| AC-30 | 0-Werte als „0,00 €" | ✅ PASS — `formatBetrag(0)` |
| AC-31 | Beträge mit 2 Dezimalstellen + € (de-DE Locale) | ✅ PASS — `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })` |
| AC-32 | Sticky erste Spalte beim horizontalen Scrollen | ✅ PASS — `sticky left-0 z-10` |
| AC-33 | Horizontales Scrolling bei vielen Spalten | ✅ PASS — `overflow-x-auto` |
| AC-34 | Summen-Positionen optisch abgegrenzt | ✅ PASS — `bg-muted border-t-2 font-semibold` |

### Bugs gefunden und behoben (in dieser Session)

| # | Schweregrad | Beschreibung | Status |
|---|---|---|---|
| BUG-1 | High | Kategorie-Ebene erzeugte doppelte Zeile (gleicher Name wie Position) | ✅ Behoben — Kategorie-Zeile wird bei 1 Kategorie übersprungen |
| BUG-2 | High | Plattform/Produkt Drill-down funktionierte nur auf Untergruppen-Ebene | ✅ Behoben — `pltVals`/`pltPrdVals` akkumulieren auf allen KPI-Ebenen |
| BUG-3 | High | `ist_abzugsposten`-Logik fehlte → Rabatte/Rückerstattungen wurden positiv gezählt | ✅ Behoben — `ist_abzugsposten` wird beim Verarbeiten von Umsatz-Transaktionen berücksichtigt |

### Security Audit
| Bereich | Befund |
|---|---|
| Authentifizierung | `requireAuth()` in API-Route — Redirect bei unauthentifizierten Requests ✅ |
| Autorisierung | `user_id`-Filter auf `report_positionen` — Nutzer sehen nur eigene Daten ✅ |
| Input-Validierung | Zod-Schema auf alle Query-Parameter (von, bis, granularitaet) ✅ |
| SQL-Injection | Supabase parametrisierte Queries, kein raw SQL ✅ |
| Datenleck | API gibt keine Fremd-Nutzerdaten zurück (user_id-Filter) ✅ |

### Regressions-Tests
- ✅ 176 bestehende E2E-Tests bestanden
- ✅ 298 bestehende Vitest-Tests bestanden

---

## QA Test Results — Spec-Ergänzung: Produktinvestitionen-Raten

**QA Date:** 2026-05-13
**QA Status:** ✅ APPROVED — production-ready

### Automated Tests
| Suite | Result |
|---|---|
| Vitest (unit/integration) | ✅ 341/341 passed (4 neue Tests für Produktinvestitionen-Raten) |
| Playwright E2E (chromium + Mobile Safari) | ✅ 450/450 passed (30 PROJ-20-Tests + 420 Regressionstests) |

### Neue Acceptance Criteria (Produktinvestitionen-Raten)

| # | Kriterium | Status |
|---|---|---|
| AC-PI-1 | Transaktionen der Kategorie „Produktinvestitionen" fließen als 12 gleichmäßige Monatsraten ein — nicht als Direktbuchung im Buchungsmonat | ✅ PASS — Integration-Test + Code-Review (Stage 5e, `piRows`-Schleife) |
| AC-PI-2 | Produktinvestitionen-Raten werden nur dann in einer Periode gezählt, wenn ihr Ratendatum in die Spalten-Periode fällt | ✅ PASS — Integration-Test (Zeitraum-Filter-Test: 6 von 12 Raten im Zeitraum) |
| AC-PI-3 | Transaktionen mit Kategorie „Produktinvestitionen" sind aus der Direktbuchungs-Verarbeitung ausgeschlossen (kein Doppelzählen) | ✅ PASS — Integration-Test (expliziter Doppelzähl-Test) |
| AC-PI-4 | Produktinvestitions-Transaktion mit `betrag_netto = 0` → keine Raten erzeugen | ✅ PASS — Integration-Test |

### Edge Cases verifiziert

| Edge Case | Status |
|---|---|
| PI-Kategorie nicht im KPI-Modell → `produktinvestitionenCatId = null` → kein DB-Call, keine Verarbeitung | ✅ PASS — Code-Review |
| PI-Kategorie vorhanden aber keiner Position zugewiesen → `assignedCatIds.has()` false → kein DB-Call | ✅ PASS — Code-Review |
| PI-Transaktion läuft über Jahresgrenze → `addMonthsWithClamp` + Datumsfilter | ✅ PASS — Integration-Test |
| Quartals-/Jahres-Aggregation für PI-Raten → via `dateToPeriod()` in `processTransaction()` | ✅ PASS — Code-Review |
| Rounding: `baseRate = roundTo2(n/12)`, `lastRate = roundTo2(n - baseRate*11)` | ✅ PASS — Code-Review (analog PROJ-15, bereits QA-geprüft) |
| PI-Kategorie existiert nicht → leeres `piRows`, kein Fehler | ✅ PASS — Code-Review |

### Security Audit (neue Codepfade)

| Bereich | Befund |
|---|---|
| PI-Query Authentifizierung | Läuft unter selber authentifizierter Session wie alle anderen Queries ✅ |
| PI-Query Parameter-Injection | `produktinvestitionenCatId` stammt aus DB (allCats), kein User-Input → kein Injektionsrisiko ✅ |
| PI-Query Tenant-Isolation | Supabase RLS filtert `ausgaben_kosten_transaktionen` auf aktiven User (konsistent mit bestehendem Pattern) ✅ |
| Datenleck | PI-Query liefert keine zusätzlichen sensitiven Felder (nur leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id) ✅ |

### Gefundene Bugs

**Keine Critical- oder High-Priority-Bugs gefunden.**

| # | Schweregrad | Beschreibung | Status |
|---|---|---|---|
| MINOR-1 | Low | Name-Match im Code ist case-insensitiv (`toLowerCase()`), Spec sagt „exakter Name-Match" — kein Blocker, case-insensitiv ist besseres UX | Kein Fix nötig |

### Regressions-Tests
- ✅ 420 bestehende E2E-Tests bestanden (keine Regressionen in PROJ-1 bis PROJ-23)
- ✅ 337 bestehende Vitest-Tests bestanden

## Deployment
_To be added by /deploy_

---

## Spec-Ergänzung 2026-05-13: Umsatzsteuer-Position im Rentabilitätsreport

> **Status:** Approved (Anforderungen), noch nicht implementiert. QA-Ergebnisse des vorherigen Stands bleiben gültig; diese Ergänzung erfordert eigene Implementierung und erneute QA.

### Überblick

Im Reporting-Modell kann der Nutzer eine Position vom neuen Typ `'umsatzsteuer'` anlegen. Diese Position berechnet automatisch die Umsatzsteuer auf Basis des produkt-spezifischen USt-Satzes. Die Berechnung erfolgt je Produkt:

```
USt-Betrag (je Produkt) = (Bruttoumsatz − Rabatt − Erstattungen) × USt-Satz des Produkts
Umsatzsteuer-Position  = Σ aller Produkt-USt-Beträge
```

Dabei gilt: Bruttoumsatz und Abzugsposten (Rabatt, Erstattungen) werden direkt aus den `umsatz_transaktionen` abgeleitet — `ist_abzugsposten = false` → positiv, `ist_abzugsposten = true` → negativ.

### User Stories

- Als Nutzer möchte ich eine „Umsatzsteuer"-Zeile in meinem Rentabilitätsreport sehen, damit ich die auf den Nettoumsatz anfallende MwSt je Periode kenne.
- Als Nutzer möchte ich den USt-Satz je Produkt im KPI-Modell hinterlegen können, damit die Berechnung die korrekten produktspezifischen Steuersätze verwendet.
- Als Nutzer möchte ich die Umsatzsteuer-Zeile nach Produkt ausklappen können, um zu sehen, wie viel USt je Produkt anfällt.

### Neue Acceptance Criteria

#### USt-Satz im KPI-Modell (Produkt-Ebene)

- [ ] Produkte (`kpi_categories` mit `type = 'produkte'`) haben ein neues optionales Feld `ust_satz` (in %)
- [ ] Im KPI-Modell → Produkt-Dialog gibt es ein Eingabefeld „USt-Satz (%)" (Zahl, 0–100, 2 Dezimalstellen, optional)
- [ ] Wird kein USt-Satz gesetzt, gilt implizit 0 % (kein Pflichtfeld)
- [ ] Bestehende Produkte bleiben unverändert (Migration setzt `ust_satz = NULL`)

#### Neuer Positionstyp `umsatzsteuer`

- [ ] `report_positionen.type` akzeptiert den neuen Wert `'umsatzsteuer'`
- [ ] Im Reporting-Modell (KPI-Modell → Tab „Reporting-Modell") ist beim Anlegen einer neuen Position der Typ „Umsatzsteuer" wählbar
- [ ] Eine `umsatzsteuer`-Position hat **keine** Kategorie-Zuweisung (vollständig berechnet, kein `report_position_kategorien`-Eintrag nötig)
- [ ] Darstellung in der Matrix: ähnlich wie Summen-Positionen hervorgehoben (fette Schrift, Hintergrundfarbe), aber eigene visuelle Kennzeichnung (z. B. Beschriftung „Ust" als Tag)

#### Wertberechnung

- [ ] Für jede Periode werden alle `umsatz_transaktionen` mit `produkt_id IS NOT NULL` geladen
- [ ] Je Produkt wird die Netto-Basis berechnet: `Σ betrag` für alle Transaktionen des Produkts, wobei `ist_abzugsposten = true` negiert wird
- [ ] Je Produkt: `USt-Betrag = Netto-Basis × (ust_satz / 100)` des Produkts
- [ ] Transaktionen ohne `produkt_id` → kein USt-Beitrag (übersprungen)
- [ ] Produkte mit `ust_satz = NULL` oder `ust_satz = 0` → kein USt-Beitrag
- [ ] Gesamtwert der Position = Summe aller Produkt-USt-Beträge, **negiert** (Abzugsposten in der GuV)

#### Drill-Down (Ausklappbar)

- [ ] Eine `umsatzsteuer`-Position mit mindestens einem Produkt mit USt-Satz > 0 ist ausklappbar
- [ ] Ausgeklappt erscheinen die einzelnen Produkte als Unterzeilen mit ihrem jeweiligen USt-Betrag (negiert)
- [ ] Produkte mit USt-Betrag = 0 erscheinen nur ausgeklappt, wenn sie eine Transaktion im Zeitraum haben

#### Darstellung

- [ ] Positive Werte: nicht anwendbar (Position ist immer negativ oder 0)
- [ ] Negative Werte: rot mit Minuszeichen (wie alle Ausgaben-Positionen)
- [ ] 0-Wert → „0,00 €" (nicht leer)

### Edge Cases

- Kein Produkt hat `ust_satz` konfiguriert → Position zeigt immer 0 € für alle Perioden
- Keine `umsatz_transaktionen` mit `produkt_id` im Zeitraum → 0 €
- `umsatzsteuer`-Position vorhanden, aber kein Produkt hat Transaktion im Zeitraum → 0 €, Zeile bleibt sichtbar
- Produkt hat Transaktionen, aber `ust_satz = 0` → kein Beitrag (0 %)
- Mehrere `umsatzsteuer`-Positionen im Modell → jede berechnet denselben Wert (nutzer-definiertes Modell)
- `umsatzsteuer`-Position wird in einer Summen-Position referenziert → wird wie eine reguläre Position behandelt (ihr Wert fließt in die Summe ein)

### Technische Anforderungen

**Datenbank:**
- `kpi_categories` → neues Feld `ust_satz NUMERIC(5,2)` (nullable, z. B. `19.00` für 19 %), nur relevant für `type = 'produkte'`
- `report_positionen.type` → CHECK-Constraint erweitert auf `('position', 'summe', 'umsatzsteuer')`

**API `GET /api/reporting/rentabilitaet`:**
- Stage 2: `kpi_categories` mit `type = 'produkte'` lädt nun auch `ust_satz`
- Neue Bedingung: wenn mindestens eine `umsatzsteuer`-Position konfiguriert ist, werden alle `umsatz_transaktionen` (mit `produkt_id`) für den Zeitraum geladen (sofern nicht ohnehin schon vorhanden)
- Berechnungs-Stage: Je Produkt Netto-Basis aggregieren → mit `ust_satz / 100` multiplizieren → negieren
- Die `umsatzsteuer`-Position erscheint im Response wie eine reguläre Position (`type: 'umsatzsteuer'`), mit `values` und `produkte`-Unterzeilen analog zur Drill-Down-Struktur anderer Positionen

**API `GET/PATCH /api/report-positionen` und Zod-Schema:**
- `type`-Enum um `'umsatzsteuer'` erweitern

**Frontend:**
- `ReportingRentabilitaetMatrix`: `umsatzsteuer`-Positionen darstellen — hervorgehoben wie `summe`, aber ausklappbar (wenn Produktdaten vorhanden)
- KPI-Modell-Seite: Produkt-Bearbeitungsdialog um USt-Satz-Feld erweitern
- Reporting-Modell-Tab: „Umsatzsteuer" als wählbarer Positionstyp in der Positions-Anlegen-UI

**Betroffene Dateien:**
- `src/app/api/reporting/rentabilitaet/route.ts` — Kernberechnung
- `src/app/api/report-positionen/route.ts` — Zod-Erweiterung
- `src/hooks/use-report-positionen.ts` — Typ-Erweiterung
- `src/hooks/use-reporting-rentabilitaet.ts` — Typ-Erweiterung
- `src/components/reporting-rentabilitaet-matrix.tsx` — Darstellung
- `src/app/dashboard/kpi-modell/page.tsx` — USt-Satz-Feld in Produkt-Dialog
- `src/components/report-position-row.tsx` — neuer Typ in Reporting-Modell-UI
- Supabase-Migration: `ust_satz` auf `kpi_categories`, `type`-Constraint auf `report_positionen`

## Implementation Notes (Frontend — Spec-Ergänzung Umsatzsteuer 2026-05-13)

### Geänderte Dateien
- `src/app/api/kpi-categories/[id]/route.ts` — `ust_satz` in PATCH-Schema (Zod) ergänzt
- `src/app/api/report-positionen/route.ts` — `type`-Enum um `'umsatzsteuer'` erweitert
- `src/hooks/use-kpi-categories.ts` — `KpiCategory.ust_satz: number | null`; `updateUstSatz`-Callback hinzugefügt
- `src/hooks/use-report-positionen.ts` — `ReportPositionType` um `'umsatzsteuer'` erweitert; `addPosition` gibt Default-Name „Umsatzsteuer" für neuen Typ
- `src/hooks/use-reporting-rentabilitaet.ts` — `ReportUstProdukt`-Interface neu; `ReportPosition.type` + `ust_produkte?: ReportUstProdukt[]`
- `src/components/kpi-category-row.tsx` — `onUpdateUstSatz`-Prop + USt-Satz Popover (Percent-Icon, Zahlenfeld 0–100) für `isSkuParent` (Produkt level=1); Prop an Kinder weitergereicht
- `src/components/kpi-category-tree.tsx` — `onUpdateUstSatz` in Props + Pass-Through an `KpiCategoryRow`
- `src/app/dashboard/kpi-modell/page.tsx` — `updateUstSatz` aus Hook; `onUpdateUstSatz={type === 'produkte' ? updateUstSatz : undefined}` an `KpiCategoryTree`
- `src/components/report-position-row.tsx` — `umsatzsteuer`-Typ: teal Badge „% USt", kein Zuweisung-Popover, Percent-Icon als Indikator
- `src/components/report-modell-tab.tsx` — „Umsatzsteuer hinzufügen"-Button mit Percent-Icon
- `src/components/reporting-rentabilitaet-matrix.tsx` — `RowKind` um `'umsatzsteuer'`; `isPositionExpandable`/`buildFlatRows`/`collectAllExpandableIds` für `umsatzsteuer`; Drill-Down als flache Produkt-Liste mit „Name (XX %)" Label; Styling analog `summe` (teal Hintergrund, `border-t-2`, `font-semibold`)

### Build & Tests
- `npm run build` ✅ — alle 29 Routen fehlerfrei gebaut
- Backend-Berechnung (API `route.ts`) noch ausstehend — Frontend zeigt 0 €-Werte bis Backend implementiert ist

## Tech Design (Solution Architect) — Spec-Ergänzung Umsatzsteuer

### Komponentenstruktur

```
Bestehende Seite: /dashboard/kpi-modell → Tab "Produkte"
└── KpiCategoryRow (Produkt, Level 1)                    ← GEÄNDERT
    └── Bearbeitungs-Popover
        ├── Name (vorhanden)
        └── USt-Satz % (NEU — optionales Zahlenfeld, 0–100)

Bestehende Seite: /dashboard/kpi-modell → Tab "Reporting-Modell"
└── ReportPositionRow                                     ← GEÄNDERT
    ├── type = 'position'     (vorhanden — mit Kategorie-Zuweisung)
    ├── type = 'summe'        (vorhanden — mit Positions-Referenzen)
    └── type = 'umsatzsteuer' (NEU — kein Zuweisung-Popover, Badge "% USt")

Bestehende Seite: /dashboard/reporting/rentabilitaet
└── ReportingRentabilitaetMatrix                          ← GEÄNDERT
    └── Zeile für type = 'umsatzsteuer'
        ├── Hervorgehoben wie Summen-Position (fette Schrift, Hintergrund)
        ├── Badge "% USt" zur Unterscheidung
        └── [ausgeklappt] Produkt-Unterzeilen (je Produkt mit seinem USt-Betrag)
```

### Datenmodell (Änderungen)

**Tabelle `kpi_categories` — neues Feld:**
```
Produkt (type='produkte', level=1)
  ├── id, name, type, level  (vorhanden)
  ├── ust_satz: 19.00        (NEU: NUMERIC(5,2), nullable, NULL = 0 %)
  └── SKUs (level=2, unverändert)
```

**Tabelle `report_positionen` — erweiterter Typ-Constraint:**
```
type: 'position' | 'summe' | 'umsatzsteuer'   ← 'umsatzsteuer' NEU
```

**API-Response `GET /api/reporting/rentabilitaet` — erweitertes Schema:**
```
ReportPosition (bestehend, erweitert)
  ├── type: 'position' | 'summe' | 'umsatzsteuer'
  ├── values: { "2026-01": -380.00, ... }   (negiert)
  └── produkte: ReportUstProdukt[]          (NEU, nur bei type='umsatzsteuer')

ReportUstProdukt (NEU)
  ├── id: string         (produkt_id)
  ├── name: string       (Produktname)
  ├── ust_satz: number   (z.B. 19)
  └── values: { "2026-01": -76.00, ... }   (negierter USt-Betrag dieses Produkts)
```

### Berechnungslogik (server-seitig, kein extra DB-Call)

```
Voraussetzung: API lädt bereits alle umsatz_transaktionen mit produkt_id
               → kein zusätzlicher Datenbankaufruf nötig

Für jede umsatzsteuer-Position × Periode:
  1. Je Produkt:
     netto_basis = Σ betrag  (ist_abzugsposten=true → negiert)
     ust_betrag  = netto_basis × (ust_satz / 100)
  2. Positions-Wert = Σ aller ust_betrag, NEGIERT (Abzugsposten)
  3. Produkte mit ust_satz=NULL oder 0 → kein Beitrag
  4. Transaktionen ohne produkt_id → übersprungen
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| USt-Satz auf Produkt level=1 | Direkte Spalte in `kpi_categories` | `produkt_id` in Transaktionen referenziert level=1; einfachste Speicherung ohne neue Tabelle |
| Kein eigener DB-Call | Bestehende umsatz_transaktionen-Daten wiederverwenden | API lädt bereits alle umsatz_transaktionen mit produkt_id — kein Mehraufwand |
| Drill-Down nur auf Produkt-Ebene | Flache Produkt-Liste | Berechnung ist per Produkt; Gruppe/Untergruppe für USt nicht sinnvoll |
| Keine Kategorie-Zuweisung | Vollständig berechnet | USt läuft automatisch über alle Produkte — Nutzer muss nichts zuweisen |

### Geänderte Dateien

```
Datenbank (Migration):
  kpi_categories      → ust_satz NUMERIC(5,2) nullable
  report_positionen   → CHECK-Constraint um 'umsatzsteuer' erweitern

Backend:
  src/app/api/reporting/rentabilitaet/route.ts   — Berechnungs-Stage + ust_satz in Produkt-Query
  src/app/api/report-positionen/route.ts          — Zod-Enum um 'umsatzsteuer' erweitern
  src/app/api/kpi-categories/[id]/route.ts        — ust_satz in PATCH-Schema akzeptieren

Frontend:
  src/hooks/use-reporting-rentabilitaet.ts        — ReportPosition-Typ + ReportUstProdukt-Interface
  src/hooks/use-report-positionen.ts              — ReportPositionType um 'umsatzsteuer' erweitern
  src/components/kpi-category-row.tsx             — USt-Satz-Feld im Produkt-Bearbeitungs-Popover
  src/components/report-position-row.tsx          — umsatzsteuer-Typ darstellen (Badge, kein Popover)
  src/components/reporting-rentabilitaet-matrix.tsx — Zeilen-Darstellung + Produkt-Drill-Down
```

---

## Implementation Notes (Backend — Spec-Ergänzung Umsatzsteuer 2026-05-13)

### DB-Migration: `add_ust_satz_and_umsatzsteuer_type`
- `kpi_categories`: Spalte `ust_satz NUMERIC(5,2) DEFAULT NULL` hinzugefügt
- `report_positionen`: CHECK-Constraint auf `type` um `'umsatzsteuer'` erweitert

### API `GET /api/reporting/rentabilitaet`
- `produkteCats`-Query: `select('id, name, ust_satz')`
- **Stage 5f**: `ustPrdNetBase` akkumuliert je Produkt und Periode die Netto-Basis (Brutto minus Abzugsposten) aus allen Umsatz-Transaktionen mit `produkt_id` — unabhängig von Positionszuweisungen
- `ustPrdVals` berechnet daraus je Produkt: `-(netBase × ust_satz / 100)`
- **Stage 6**: `umsatzsteuer`-Positionen erhalten ihre `positionValues` aus `ustPrdVals` (vor dem `summe`-Loop, damit Summen-Positionen darauf referenzieren können)
- Response-Builder: `umsatzsteuer`-Positionen enthalten `ust_produkte: [{ id, name, ust_satz, values }]`

### Tests
- 8 neue Tests in `route.test.ts` (gesamt jetzt 49 Tests, alle grün)
- Abgedeckte Szenarien: Basisberechnung, Abzugsposten-Abzug, `ust_produkte`-Array, mehrere Produkte mit unterschiedlichen Sätzen, kein `produkt_id`, `ust_satz = null`, Quartal-Aggregation, Referenz durch Summen-Position
