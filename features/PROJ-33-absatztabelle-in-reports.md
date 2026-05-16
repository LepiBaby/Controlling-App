# PROJ-33: Absatztabelle in Rentabilitäts- und Deckungsbeitragsreport

## Status: Approved
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-17 (Bestandsveränderungen-Verwaltung) — Quelldaten (`bestand_transaktionen`, `bestand_sendungen`)
- Requires: PROJ-20 (Rentabilitätsreport) — Seite, Filterstruktur und Periodenlogik werden um die Tabelle erweitert
- Requires: PROJ-26 (Liniendiagramm) — legt die Position zwischen Chart und Matrix fest
- Requires: PROJ-27 (Deckungsbeitragsreport) — Seite, Filterstruktur und Produkt-/Plattform-Filter werden berücksichtigt

## Übersicht

Zwischen dem Liniendiagramm und der großen Matrix-Tabelle wird auf zwei Report-Seiten eine **kleine Absatztabelle** eingefügt:

- `/dashboard/reporting/rentabilitaet`
- `/dashboard/reporting/deckungsbeitrag`

Die Tabelle zeigt die **Anzahl der Sendungen** (= Absatz) aggregiert je Periode — mit denselben Spalten (Monate / Quartale / Jahre) wie der aktive Report-Filter. Eine Gesamtzeile kann per Expand-Toggle aufgeklappt werden, um die Werte nach einzelnen Produkten aufzuschlüsseln.

**Sendungen-Definition:** Gesamtabsatz je Periode = `Σ(bestand_sendungen.menge aller Plattformen) + sendungen_manuell` — aggregiert aus allen `bestand_transaktionen`, deren `datum` in die jeweilige Periode fällt.

Die Produktebene entspricht **Ebene 1** aus `kpi_categories` (`type = 'produkte'`).

## User Stories

- Als Nutzer möchte ich im Rentabilitätsreport zwischen dem Diagramm und der Matrix eine kompakte Absatztabelle sehen, damit ich die Sendungsmenge im gleichen Zeitraum direkt ablesen kann, ohne die Seite zu wechseln.
- Als Nutzer möchte ich im Deckungsbeitragsreport dieselbe Absatztabelle sehen, damit ich Deckungsbeiträge und Absatz im selben Blick vergleichen kann.
- Als Nutzer möchte ich die Gesamtzeile aufklappen können, um die Sendungen je Produkt zu sehen, damit ich erkennen kann, welches Produkt wie viel zum Absatz beigetragen hat.
- Als Nutzer möchte ich, dass die Absatztabelle automatisch die gleiche Zeitraumund Granularitäts-Einstellung nutzt wie der Rest des Reports, damit alle Tabellen konsistent sind.
- Als Nutzer möchte ich, dass aktive Produkt-/Plattform-Filter im Deckungsbeitragsreport auch die Absatztabelle einschränken, damit ich einen konsistenten gefilterten Blick bekomme.

## Acceptance Criteria

### Allgemeine Anforderungen (beide Reports)

- [ ] Die Absatztabelle erscheint auf `/dashboard/reporting/rentabilitaet` und `/dashboard/reporting/deckungsbeitrag` zwischen dem Liniendiagramm und der Matrix-Tabelle
- [ ] Die Tabelle ist nur sichtbar, wenn ein gültiger Von/Bis-Zeitraum gewählt ist (andernfalls kein Abschnitt angezeigt)
- [ ] Die Spaltenstruktur der Tabelle entspricht exakt den Perioden-Spalten des Reports (Monate, Quartale oder Jahre — je nach gewähltem Tab)
- [ ] Die erste Spalte (Zeilenbeschriftung) ist sticky beim horizontalen Scrollen
- [ ] Werte werden als **ganzzahlige Stückzahl** ohne Einheit angezeigt (z.B. „342", nicht „342 Stück" oder „342,00 €")
- [ ] 0-Werte werden als „0" dargestellt, nicht als leere Zelle

### Zeilenstruktur

- [ ] Es gibt genau **eine Gesamtzeile** mit der Beschriftung „Absatz gesamt"
- [ ] Die Gesamtzeile zeigt pro Periode: `Σ(bestand_sendungen.menge aller Plattformen) + sendungen_manuell` aus allen `bestand_transaktionen`, deren `datum` in die Periode fällt
- [ ] Die Gesamtzeile hat einen **Expand-Toggle** (aufklappbar), wenn mindestens ein Produkt Sendungen im Zeitraum hat
- [ ] Ausgeklappt erscheinen unterhalb der Gesamtzeile **eine Unterzeile pro Produkt** (Ebene 1, `kpi_categories.type = 'produkte'`), sortiert nach `sort_order`
- [ ] Jede Produkt-Unterzeile zeigt pro Periode: `Σ(bestand_sendungen.menge aller Plattformen) + sendungen_manuell` aus allen `bestand_transaktionen` dieser SKUs (alle SKUs des Produkts), gefiltert auf die Periode
- [ ] Produkte ohne Transaktionen im gesamten Zeitraum erscheinen **nicht** als Unterzeile (nur Produkte mit mindestens einem Eintrag)
- [ ] Expand-/Collapse-Zustand bleibt beim Wechsel zwischen Granularitäts-Tabs (Monatlich / Quartal / Jahr) erhalten

### Periodenberechnung

- [ ] **Tab „Monatlich"**: Summe aller Sendungen aus `bestand_transaktionen` mit `datum` im jeweiligen Kalendermonat
- [ ] **Tab „Quartal"**: Summe aller Sendungen aus `bestand_transaktionen` mit `datum` im jeweiligen Quartal
- [ ] **Tab „Jahr"**: Summe aller Sendungen aus `bestand_transaktionen` mit `datum` im jeweiligen Kalenderjahr
- [ ] Der Von/Bis-Zeitraum aus dem Monatsfilter des Reports begrenzt die angezeigten Perioden (keine Perioden außerhalb des Zeitraums)

### Deckungsbeitragsreport — Filterlogik

- [ ] Wenn der **Produkt-Filter** aktiv ist (≥ 1 Produkt ausgewählt): nur `bestand_transaktionen` mit `produkt_id IN (ausgewählte IDs)` werden gezählt
- [ ] Wenn der **Plattform-Filter** aktiv ist (≥ 1 Plattform ausgewählt): nur `bestand_sendungen.menge` für `plattform_id IN (ausgewählte IDs)` wird summiert; `sendungen_manuell` wird weiterhin vollständig addiert (nicht plattformgebunden)
- [ ] Beide Filter können gleichzeitig aktiv sein (UND-Logik)
- [ ] Die Absatztabelle im Rentabilitätsreport hat keine eigenen Filter (zeigt immer alle Sendungen)

### Leerzustand

- [ ] Kein Von/Bis-Zeitraum gewählt → Absatztabelle wird nicht angezeigt (keine leere Tabelle)
- [ ] Zeitraum gewählt, aber keine `bestand_transaktionen` im Zeitraum → Gesamtzeile zeigt überall „0"; kein Expand-Toggle
- [ ] Keine Produkte im KPI-Modell vorhanden → Gesamtzeile zeigt überall „0"; keine Unterzeilen

## Edge Cases

- **Keine `bestand_transaktionen` vorhanden:** Gesamtzeile zeigt „0" für alle Perioden; kein Expand-Toggle
- **`bestand_sendungen` leer für eine Transaktion, aber `sendungen_manuell > 0`:** nur der Manuell-Wert fließt in die Summe ein
- **Produkt hat mehrere SKUs:** alle SKU-Transaktionen des Produkts werden für die Produkt-Unterzeile summiert
- **SKU ohne Produkt-Zuordnung (`produkt_id = NULL`):** Sendungen dieser Transaktion fließen in die Gesamtzeile ein, aber nicht in eine Produkt-Unterzeile
- **Plattform-Filter aktiv, Transaktion hat nur `sendungen_manuell`:** `sendungen_manuell` wird gezählt (nicht plattformgebunden), plattformgebundene Sendungen = 0 für diese Transaktion
- **Produkt-Filter aktiv, ausgeklappte Unterzeilen:** es erscheinen nur Unterzeilen für die gefilterten Produkte
- **Granularitätswechsel (Monatlich → Quartal):** Expand-Zustand bleibt erhalten, Spaltenwerte werden neu aggregiert
- **Zeitraum sehr groß (z. B. 3 Jahre monatlich, 36 Spalten):** horizontales Scrollen mit sticky erster Spalte, kein Layout-Bruch
- **`datum` einer `bestand_transaktion` liegt außerhalb des gewählten Von/Bis-Zeitraums:** wird nicht gezählt

## Technische Anforderungen

### Datenquellen

- `bestand_transaktionen` — `datum`, `produkt_id`, `sendungen_manuell`
- `bestand_sendungen` — `transaktion_id`, `plattform_id`, `menge`
- `kpi_categories` — Produktliste (`type = 'produkte'`, `level = 1`) mit `sort_order`

### API-Integration

Zwei Optionen (Entscheidung durch `/architecture`):

**Option A — Erweiterte bestehende Report-API:**  
`GET /api/reporting/rentabilitaet` und `GET /api/reporting/deckungsbeitrag` geben zusätzlich ein `absatz`-Objekt in der Response zurück.

**Option B — Neue eigene API-Route:**  
`GET /api/reporting/absatz` mit Query-Parametern `von`, `bis`, `granularitaet`, optional `produkt_ids`, `plattform_ids` — ein separater Aufruf pro Report-Seite.

### Berechnung

Für jede Periode:
```
gesamt_sendungen =
  Σ(bestand_sendungen.menge)        -- alle Plattformen (gefiltert wenn Plattform-Filter aktiv)
  + Σ(bestand_transaktionen.sendungen_manuell)   -- immer vollständig
WHERE bestand_transaktionen.datum IN Periode
  AND (kein Produkt-Filter ODER produkt_id IN ausgewählte_ids)
```

Je Produkt-Unterzeile: analog, aber gefiltert auf `produkt_id = produkt.id` (alle SKUs des Produkts, da `produkt_id` denormalisiert auf `bestand_transaktionen` gespeichert ist).

### Darstellung

- Tabelle mit identischer Spaltenstruktur wie die Matrix (sticky erste Spalte, `overflow-x-auto`)
- Gesamtzeile: visuell leicht hervorgehoben (z.B. `font-medium`), Expand-Icon links
- Produkt-Unterzeilen: eingerückt, normale Schrift
- Keine €-Formatierung — reine Integer-Werte
- Überschrift der Tabelle: „Absatz (Sendungen)" als Abschnittsbeschriftung

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Grundsatz: Isolierte API, wiederverwendbare Komponente

Die Absatzdaten sind fachlich unabhängig von den Finanzdaten. Deshalb erhält diese Funktion eine **eigene API-Route**, die von beiden Report-Seiten aufgerufen wird. Die neue Tabellen-Komponente `AbsatzTable` wird einmal gebaut und auf beiden Seiten eingebunden.

### Komponentenstruktur

```
/dashboard/reporting/rentabilitaet/page.tsx          [GEÄNDERT]
├── Filter-Leiste                                     (unverändert)
├── ReportingRentabilitaetChart                       (unverändert)
├── AbsatzTable  [NEU]                                ← NEUE POSITION
│   ├── Ladezustand: Skeleton-Zeile
│   ├── Leerzustand: ausgeblendet (kein Zeitraum gewählt)
│   ├── „Absatz gesamt"-Zeile
│   │   ├── Sticky erste Spalte + Expand-Toggle-Icon
│   │   └── Je Periodenpalte: Ganzzahl-Summe
│   └── [ausgeklappt] Produkt-Unterzeilen (eingerückt)
│       └── je eine Zeile pro Produkt mit Sendungsmenge
└── ReportingRentabilitaetMatrix                      (unverändert)

/dashboard/reporting/deckungsbeitrag/page.tsx         [GEÄNDERT]
├── Filter-Leiste (inkl. Produkt-/Plattform-Filter)   (unverändert)
├── ReportingRentabilitaetChart                       (unverändert)
├── AbsatzTable  [NEU]                                ← NEUE POSITION
│   (erhält aktive produkt_ids + plattform_ids als Props)
└── ReportingRentabilitaetMatrix                      (unverändert)
```

### Datenmodell (API-Response)

Die Route `GET /api/reporting/absatz` gibt folgendes zurück:

```
AbsatzData
  perioden: string[]           — geordnete Perioden-Schlüssel
                                 Monatlich: ["2026-01", "2026-02", ...]
                                 Quartal:   ["2026-Q1", "2026-Q2", ...]
                                 Jahr:      ["2025", "2026"]

  gesamt: { "2026-01": 342, "2026-02": 511, ... }
             — Summe aller Sendungen (Plattform + Manuell) je Periode

  produkte: AbsatzProdukt[]    — nur Produkte mit ≥ 1 Sendung im Zeitraum

AbsatzProdukt
  id: string                   — produkt_id (Ebene-1-kpi_category)
  name: string                 — Produktname
  sort_order: number
  values: { "2026-01": 180, "2026-02": 200, ... }
```

### API-Endpunkt

```
GET /api/reporting/absatz
  ?von=2026-01          (YYYY-MM, Pflicht)
  ?bis=2026-12          (YYYY-MM, Pflicht)
  ?granularitaet=monat  ('monat' | 'quartal' | 'jahr')
  ?produkt_ids=         (optional, kommagetrennte IDs — aus DB-Report)
  ?plattform_ids=       (optional, kommagetrennte IDs — aus DB-Report)

Server-seitige Schritte:
  1. Produkte (Ebene 1) aus kpi_categories laden (type='produkte', level=1)
  2. bestand_transaktionen im Zeitraum laden
     — wenn produkt_ids gesetzt: nur die gefilterten Produkte
  3. bestand_sendungen zu diesen Transaktionen laden
     — wenn plattform_ids gesetzt: nur die gefilterten Plattformen
  4. Je Transaktion: Periodenslot bestimmen (Monat / Quartal / Jahr)
  5. Sendungen je Periode akkumulieren:
     — Gesamt: alle Transaktionen + Sendungen
     — Je Produkt: aufgeteilt nach produkt_id
  6. Response aufbauen: perioden + gesamt + produkte (nur mit Daten)
```

### Neue / geänderte Dateien

| Datei | Art | Beschreibung |
|---|---|---|
| `src/app/api/reporting/absatz/route.ts` | NEU | API-Route: Bestandsdaten laden, je Periode aggregieren |
| `src/app/api/reporting/absatz/route.test.ts` | NEU | Unit-Tests: Periodenberechnung, Filter-Logik, Leerzustände |
| `src/components/absatz-table.tsx` | NEU | Tabelle: Gesamtzeile + aufklappbare Produkt-Unterzeilen |
| `src/hooks/use-reporting-absatz.ts` | NEU | State-Management: API-Aufruf, Lade-/Fehlerzustand |
| `src/app/dashboard/reporting/rentabilitaet/page.tsx` | GEÄNDERT | `AbsatzTable` zwischen Chart und Matrix einfügen |
| `src/app/dashboard/reporting/deckungsbeitrag/page.tsx` | GEÄNDERT | `AbsatzTable` zwischen Chart und Matrix einfügen (mit Filter-Props) |

### Datenfluss

```
Seitenaufruf (Rentabilitätsreport)
  → use-reporting-absatz Hook: von + bis + granularitaet übernehmen
  → API-Call: GET /api/reporting/absatz?von=...&bis=...&granularitaet=...
  → AbsatzTable rendert mit den Daten

Filter-Änderung (von / bis / granularitaet)
  → neuer API-Call (automatisch durch Hook-Abhängigkeit)
  → AbsatzTable aktualisiert sich

Deckungsbeitragsreport — Produkt-/Plattform-Filter geändert
  → neuer API-Call mit aktualisierten produkt_ids / plattform_ids
  → AbsatzTable zeigt gefilterte Sendungsmengen

Expand/Collapse-Toggle
  → kein API-Call — alle Produktdaten sind bereits in der Response
  → lokaler boolean-State in AbsatzTable
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Eigene API-Route statt Erweiterung bestehender | `GET /api/reporting/absatz` | Bestehende Report-Routen sind bereits sehr komplex (9+ parallele Queries); Trennung hält jede Route fokussiert und unabhängig testbar |
| Eine Route für beide Reports | Ja — gemeinsame Route mit optionalen Filtern | DB-Report gibt einfach produkt_ids/plattform_ids mit; Rentabilitätsreport ruft ohne Filter auf; kein duplizierter Code |
| Expand-State | Lokaler `useState(false)` in AbsatzTable | Nur ein Toggle (Gesamt-Zeile); kein globaler State nötig |
| Produkte in API-Response nur wenn Daten | Ja — leere Produkte werden ausgelassen | Saubere Response; kein unnötiges Rendering leerer Zeilen |
| Periodenlogik | Dieselbe `dateToPeriod()`-Utility wie in rentabilitaet/route.ts | Single Source of Truth; konsistente Perioden-Schlüssel über alle Reports |

## Implementation Notes (Frontend — 2026-05-15)

### Neue Dateien
- `src/hooks/use-reporting-absatz.ts` — Hook mit `AbsatzProdukt`- und `AbsatzData`-Interfaces; API-Call an `/api/reporting/absatz`; optionale `produkt_ids` und `plattform_ids` als kommagetrennte Query-Parameter; Re-fetch bei Änderung von von/bis/granularitaet/Filter
- `src/components/absatz-table.tsx` — Tabelle mit overflow-x-auto + sticky erster Spalte; `formatPeriode()`-Funktion identisch zur Matrix; lokaler `expanded: boolean`-State für den Gesamtzeilen-Toggle; Expand-Button deaktiviert wenn keine Produkte vorhanden; Skeleton bei Ladezustand; kein Rendering wenn `!hasDateRange`

### Geänderte Dateien
- `src/app/dashboard/reporting/rentabilitaet/page.tsx` — `useReportingAbsatz` Hook (ohne Filter) + `AbsatzTable` zwischen Chart und Matrix eingefügt
- `src/app/dashboard/reporting/deckungsbeitrag/page.tsx` — `useReportingAbsatz` Hook (mit `selectedProduktIds`, `selectedPlattformIds`) + `AbsatzTable` zwischen Chart und Matrix eingefügt

### Build & Tests
- `npm run build` ✅ — alle Routen fehlerfrei gebaut
- `npm test` ✅ — 534/535 bestehende Tests grün; 1 vorher existierender Fehler in `break-even/route.test.ts` (unrelated to PROJ-33)

## Implementation Notes (Backend — 2026-05-15)

### Neue Dateien
- `src/app/api/reporting/absatz/route.ts` — GET-Handler: Zod-Validierung (`von`, `bis`, `granularitaet`, optionale `produkt_ids`, `plattform_ids`); 2 serielle Supabase-Abfragen (bestand_transaktionen mit nested bestand_sendungen, kpi_categories Produkte Ebene 1); JS-seitige Aggregation per Periode und per Produkt; Plattform-Filter wird auf bestand_sendungen-Ebene in JS angewendet
- `src/app/api/reporting/absatz/route.test.ts` — 17 Tests: Auth (1), Validierung (5), Perioden (3), Basisberechnung (3), Produkt-Filter (1), Plattform-Filter (1), kombinierter Filter (1), Quartal-Aggregation (1), Produkte-ohne-Daten (1)

### Architektur der Route
- **Stage 1**: `bestand_transaktionen` mit nested `bestand_sendungen(plattform_id, menge)` laden (Datum-Range + optionalem `.in('produkt_id', ...)`)
- **Stage 2**: `kpi_categories` Produkte Ebene 1 laden (für Namen + sort_order)
- **Stage 3**: JS-Aggregation — `dateToPeriod()` identisch zur rentabilitaet-Route; Plattform-Filter per Array-Filter auf `sendungen`; Gesamtmenge = gefilterte Plattform-Sendungen + `sendungen_manuell`; Produkte ohne Daten werden aus Response ausgelassen

### Build & Tests
- `npm run build` ✅ — `/api/reporting/absatz` korrekt registriert
- `npm test` ✅ — 17 neue Tests grün, 551/552 Gesamt (1 vorher existierender Fehler in break-even/route.test.ts)

## QA Test Results

**QA Date:** 2026-05-15
**QA Engineer:** /qa skill
**Result: APPROVED — no Critical or High bugs found**

### Acceptance Criteria

| # | Kriterium | Ergebnis |
|---|-----------|----------|
| AC-1 | Absatztabelle erscheint auf rentabilitaet und deckungsbeitrag zwischen Chart und Matrix | ✅ Pass — Code review bestätigt korrekte Platzierung in beiden Pages |
| AC-2 | Tabelle nur sichtbar bei gültigem Von/Bis-Zeitraum | ✅ Pass — `if (!hasDateRange) return null` in Komponente |
| AC-3 | Spaltenstruktur entspricht Perioden-Spalten des Reports (Monate/Quartale/Jahre) | ✅ Pass — `displayPerioden` aus Report-Hook weitergegeben |
| AC-4 | Erste Spalte sticky beim horizontalen Scrollen | ✅ Pass — `sticky left-0 z-10` auf allen Zeilenzellen |
| AC-5 | Werte als ganzzahlige Stückzahl ohne Einheit | ✅ Pass — keine Formatierungsfunktion angewendet, Rohdaten aus API |
| AC-6 | 0-Werte als „0" dargestellt | ✅ Pass — `?? 0` Fallback in allen Wertausgaben |
| AC-7 | Genau eine Gesamtzeile „Absatz gesamt" | ✅ Pass — eine Zeile mit `font-medium` |
| AC-8 | Gesamtzeile zeigt Σ(sendungen.menge) + sendungen_manuell | ✅ Pass — 19/19 Unit-Tests grün, inkl. Aggregationstest |
| AC-9 | Expand-Toggle wenn ≥ 1 Produkt Sendungen hat | ✅ Pass — `isExpandable` Guard + ChevronRight/Down |
| AC-10 | Ausgeklappt: eine Unterzeile pro Produkt, sortiert nach sort_order | ✅ Pass — API gibt sortierte Produkte zurück (order by sort_order) |
| AC-11 | Produkt-Unterzeile zeigt Σ(sendungen.menge + manuell) für dieses Produkt | ✅ Pass — Unit-Test `aggregates multiple transactions across periods` |
| AC-12 | Produkte ohne Transaktionen erscheinen nicht | ✅ Pass — API filtert via `.filter(k => produktAcc.has(k.id))` |
| AC-13 | Expand-Zustand bleibt bei Granularitätswechsel | ✅ Pass — State liegt in AbsatzTable, nicht im Hook |
| AC-14 | Tab „Monatlich": Summe je Kalendermonat | ✅ Pass — `dateToPeriod()` Unit-Tests |
| AC-15 | Tab „Quartal": Summe je Quartal | ✅ Pass — `aggregates correctly by quarter` Unit-Test |
| AC-16 | Tab „Jahr": Summe je Kalenderjahr | ✅ Pass — `returns correct yearly perioden` Unit-Test |
| AC-17 | Von/Bis begrenzt angezeigte Perioden | ✅ Pass — `generatePerioden()` mit Von/Bis-Grenzen |
| AC-18 | Deckungsbeitrag Produkt-Filter: nur gefilterte Produkte gezählt | ✅ Pass — Unit-Test `applies produkt_ids filter` |
| AC-19 | Deckungsbeitrag Plattform-Filter: nur gefilterte Plattform-Mengen | ✅ Pass — Unit-Test `applies plattform_ids filter` |
| AC-20 | Beide Filter gleichzeitig (UND-Logik) | ✅ Pass — Unit-Test `combined filter: produkt + plattform` |
| AC-21 | Rentabilitätsreport hat keine eigenen Filter | ✅ Pass — Hook ohne produkt_ids/plattform_ids aufgerufen |
| AC-22 | Kein Zeitraum → Tabelle nicht angezeigt | ✅ Pass — `if (!hasDateRange) return null` |
| AC-23 | Zeitraum gewählt, keine Transaktionen → Gesamtzeile „0", kein Toggle | ✅ Pass — Unit-Test `returns gesamt=0 and empty produkte` |
| AC-24 | Neue Hierarchieebene: Produkt → Plattformen + Manuell (zwei Expand-Level) | ✅ Pass — `gesamtExpanded` + `expandedProduktIds: Set<string>` implementiert |

**Alle 24 Acceptance Criteria: 24 ✅ Pass, 0 ❌ Fail**

### Bugs gefunden

Keine.

### Security Audit

- **Auth-Bypass:** 4 E2E-Tests bestätigen, dass `/api/reporting/absatz` und beide Report-Seiten unauthentifizierte Anfragen an `/login` weiterleiten. API-Mocking im Browser umgeht Middleware nicht.
- **Eingabe-Validierung:** Zod-Schema auf API validiert `von`, `bis` (Format YYYY-MM), `granularitaet` (Enum), `von ≤ bis`. 5 Unit-Tests für Validierungsfehler grün.
- **Injection:** Keine SQL-Interpolation — alle Datenbankabfragen über Supabase-Client-Methoden.
- **Datenleck:** API gibt nur aggregierte Zähldaten zurück (keine Rohdaten, keine Preise).

### Automatisierte Tests

| Suite | Ergebnis |
|-------|----------|
| Vitest Unit/Integration (`npm test`) | 19 neue Tests ✅, 553/554 Gesamt (1 pre-existing Fehler in break-even, unrelated) |
| Playwright E2E (`PROJ-33-absatztabelle-in-reports.spec.ts`) | 26/26 ✅ — Chromium + Mobile Safari |

### Regressionen

Keine Regression auf verwandten Features (rentabilitaet, deckungsbeitrag, bestandsverwaltung, kpi-modell, dashboard).

### Entscheidung

**PRODUCTION READY ✅** — Keine Critical oder High Bugs. Feature kann deployed werden.

## Deployment
_To be added by /deploy_
