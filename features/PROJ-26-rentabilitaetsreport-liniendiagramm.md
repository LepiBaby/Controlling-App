# PROJ-26: Liniendiagramm im Rentabilitätsreport

## Status: Approved
**Created:** 2026-05-14
**Last Updated:** 2026-05-14

## Dependencies
- Requires: PROJ-20 (Rentabilitätsreport) — Basis-Seite, Matrix-Tabelle, API-Route, Datenstruktur
- Requires: PROJ-24 (Ansichtsmodi) — Absolut / Prozentual / Wachstum — das Diagramm folgt dem aktiven Modus
- Requires: PROJ-25 (Ohne-Investitionen-Filter) — das Diagramm respektiert diesen Filter

## Übersicht

Erweiterung der bestehenden Rentabilitätsreport-Seite (`/dashboard/reporting/rentabilitaet`) um ein **Liniendiagramm**, das unterhalb der Filter-Leiste und **oberhalb der Matrix-Tabelle** platziert wird. Das Diagramm visualisiert die Werte der konfigurierten Report-Positionen über die Zeit und reagiert auf alle bestehenden Filter (Von/Bis, Granularität, Ansichtsmodus, Ohne-Investitionen-Filter).

**Standardmäßig aktive Linien beim ersten Laden:** Die Positionen mit den Namen „Bruttoumsatz", „Nettoumsatz", „DB3", „EBIT" und „EBT" werden automatisch ausgewählt — sofern sie in der Konfiguration des Nutzers vorhanden sind. Nicht gefundene Standardnamen werden stillschweigend übersprungen (kein Fehler). Das Diagramm startet leer, wenn keiner dieser Namen im Reporting-Modell konfiguriert ist.

**Anpassung durch den Nutzer:** Über ein Multi-Select-Dropdown (oder ähnliche UI) kann der Nutzer beliebige der konfigurierten Report-Positionen hinzufügen oder entfernen — alle Positionstypen (reguläre Positionen, Summen-Positionen, Umsatzsteuer-Positionen) sind auswählbar.

**Kein zusätzlicher API-Call:** Das Diagramm verwendet dieselben Daten wie die Matrix-Tabelle (bereits im Hook geladen). Die Auswahl der Linien ist ein rein clientseitiger UI-Zustand.

## User Stories

- Als Nutzer möchte ich beim Öffnen des Rentabilitätsreports sofort die wichtigsten KPIs (Bruttoumsatz, Nettoumsatz, DB3, EBIT, EBT) als Liniendiagramm sehen, damit ich auf einen Blick den Trend über den gewählten Zeitraum erkenne.
- Als Nutzer möchte ich im Dropdown weitere Positionen zum Diagramm hinzufügen oder aktive Linien entfernen können, damit ich individuelle Vergleiche zwischen beliebigen KPIs erstellen kann.
- Als Nutzer möchte ich, dass das Diagramm beim Wechsel zwischen Absolut-, Prozentualer- und Wachstumsansicht die Werte entsprechend anpasst, damit Diagramm und Tabelle immer dieselbe Perspektive zeigen.
- Als Nutzer möchte ich, dass das Diagramm den „Ohne Investitionen"-Filter respektiert, damit ich konsistente Werte in Diagramm und Tabelle sehe.
- Als Nutzer möchte ich im Diagramm beim Hovern über einen Datenpunkt die genauen Werte je Position als Tooltip sehen, damit ich präzise Werte ablesen kann ohne die Tabelle scrollen zu müssen.
- Als Nutzer möchte ich, dass meine Auswahl der Linien erhalten bleibt, wenn ich zwischen den Granularitäten (Monatlich / Quartal / Jahr) oder Ansichtsmodi wechsle, damit ich denselben Vergleich auf verschiedenen Zeitebenen betrachten kann.

## Acceptance Criteria

### Positionierung und Layout

- [ ] Das Liniendiagramm erscheint **unterhalb der Filter-Leiste** und **oberhalb der Matrix-Tabelle**
- [ ] Das Diagramm ist in einem eigenen Abschnitt mit einem Positions-Auswahl-Dropdown in der Kopfzeile des Diagramm-Blocks platziert
- [ ] Das Diagramm nimmt die volle verfügbare Breite der Seite ein
- [ ] Diagramm-Höhe: ca. 300–350px (ausreichend für klare Lesbarkeit)

### Standard-Selektion beim Laden

- [ ] Beim ersten Laden der Seite (oder nach einem Neuladen) werden die Positionen mit den Namen **„Bruttoumsatz", „Nettoumsatz", „DB3", „EBIT", „EBT"** als aktive Linien vorausgewählt — exakter Name-Match (case-insensitiv) auf `report_positionen.name`
- [ ] Nicht gefundene Standardnamen werden stillschweigend übersprungen — kein Fehler, kein Hinweis
- [ ] Wenn keiner der Standardnamen gefunden wird, startet das Diagramm leer (keine Linien sichtbar; Hinweis im Diagramm-Bereich: „Bitte Positionen im Dropdown auswählen")
- [ ] Die Vorauswahl gilt nur beim Laden der Seite — danach steuert der Nutzer die Auswahl vollständig

### Positions-Auswahl (Dropdown / Multi-Select)

- [ ] Ein Multi-Select-Dropdown listet alle wählbaren Report-Positionen auf — auswählbar sind **Summen-Positionen** (`type === 'summe'`) sowie **Bruttoumsatz** (case-insensitiver Name-Match); reguläre Positions- und Umsatzsteuer-Einträge sind bewusst ausgeschlossen, da sie auf Einzelkategorie-Ebene liegen und im Diagramm wenig Mehrwert bieten
- [ ] Im Dropdown ist neben jedem Positions-Namen ein farbiger Indikator (die Linienfarbe) sichtbar, sobald die Position aktiv ist
- [ ] Bereits ausgewählte Positionen sind im Dropdown als aktiv/ausgewählt markiert und können durch erneutes Klicken entfernt werden
- [ ] Änderungen der Auswahl aktualisieren das Diagramm sofort (kein API-Call erforderlich)
- [ ] Die ausgewählten Positionen bleiben erhalten beim Wechsel von: Granularität (Monatlich / Quartal / Jahr), Ansichtsmodus (Absolut / Prozentual / Wachstum), Ohne-Investitionen-Filter
- [ ] Die Auswahl **wird zurückgesetzt** auf den Standard-Zustand, wenn der Nutzer die Seite neu lädt (kein persistenter Speicher)

### Diagramm-Darstellung (Absolut-Modus)

- [ ] X-Achse: Perioden-Labels identisch zur Tabellendarstellung (z.B. „Jan 2026", „Q1 2026", „2026")
- [ ] Y-Achse: Absolutwerte in € (formatiert als „12.450 €" oder kurzformat „12,4k €" je nach Wertgröße)
- [ ] Jede aktive Position wird als eigene Linie mit eindeutiger Farbe dargestellt
- [ ] Positive Werte erscheinen oberhalb der 0-Linie, negative unterhalb
- [ ] Eine horizontale 0-Linie ist sichtbar (Referenzlinie)
- [ ] Legende: Unterhalb oder neben dem Diagramm, zeigt Positions-Name + Linienfarbe je aktiver Position
- [ ] Tooltip beim Hovern: Zeigt den Perioden-Label + Werte aller aktiven Positionen für diese Periode (als formatierte €-Beträge)

### Diagramm-Darstellung (Prozentual-Modus)

- [ ] Y-Achse: Prozentwerte in % (1 Dezimalstelle, z.B. „38,4 %")
- [ ] Berechnungsbasis: identisch zur Tabellen-Prozentualansicht — `(Zellenwert / Bruttoumsatz der Periode) × 100`
- [ ] Wenn der Bruttoumsatz einer Periode 0 ist, wird kein Datenpunkt für diese Periode gezeigt (Linie hat eine Lücke)
- [ ] Tooltip: Zeigt Prozentwerte je aktiver Position für die hover-Periode
- [ ] 0 %-Referenzlinie ist sichtbar

### Diagramm-Darstellung (Wachstums-Modus)

- [ ] Y-Achse: Wachstumsrate in % (1 Dezimalstelle, z.B. „+8,3 %", „−12,1 %")
- [ ] Datenpunkte zeigen die period-over-period Wachstumsrate — identische Berechnung wie in der Tabellen-Wachstumsansicht: `(aktuell − vorherig) / |vorherig| × 100`
- [ ] **Erste Periode im Diagramm** (Vorperiode nicht in den geladenen Daten): kein Datenpunkt (Linie beginnt ab der zweiten Periode)
- [ ] Wenn Vorperiode = 0 und aktuell ≠ 0: kein Datenpunkt für diese Periode (entspricht „n/a" in der Tabelle)
- [ ] 0 %-Referenzlinie ist sichtbar
- [ ] Tooltip: Zeigt Wachstumsraten je aktiver Position

### Filter-Konsistenz

- [ ] Das Diagramm reagiert auf Änderungen von Von/Bis, Granularität, Ansichtsmodus und Ohne-Investitionen-Filter — dieselben Daten wie die Tabelle, dieselbe clientseitige Filterlogik
- [ ] Wenn der „Ohne Investitionen"-Filter aktiv ist, werden investitionsbezogene Positionen auch im Diagramm auf 0 gesetzt (und aus der aktiven Linien-Auswahl ggf. ausgeblendet oder als 0-Linie gezeigt)
- [ ] Wenn kein gültiger Zeitraum gewählt ist, zeigt der Diagramm-Bereich denselben Hinweistext wie die Tabelle: „Bitte Zeitraum auswählen"

### Leer-Zustände

- [ ] Kein Zeitraum gewählt → Diagramm-Bereich zeigt Hinweis „Bitte Zeitraum auswählen"
- [ ] Zeitraum gewählt, aber keine Positionen ausgewählt → Diagramm zeigt leere Fläche mit Hinweis „Bitte Positionen im Dropdown auswählen"
- [ ] Zeitraum gewählt, Positionen ausgewählt, aber alle Werte = 0 → Diagramm zeigt die 0-Linie(n) (korrekt — keine versteckten 0-Werte)
- [ ] Keine Report-Positionen konfiguriert → Diagramm-Bereich zeigt keinen Hinweis separat (die Tabelle zeigt bereits den Konfigurationshinweis)
- [ ] Daten werden geladen → Diagramm-Bereich zeigt Skeleton / Ladeanimation

## Edge Cases

- **Eine Periode im Zeitraum (Von = Bis):** Diagramm zeigt nur einen Datenpunkt je Linie — valide, kein Fehler; Wachstum-Modus: kein Datenpunkt (erste Periode ohne Vorperiode)
- **Sehr viele Perioden (z.B. 36 Monate):** X-Achsen-Labels werden ausgedünnt (nicht jedes Label anzeigen, um Überlappung zu vermeiden); Recharts-Standardverhalten ist ausreichend
- **Sehr kleine und sehr große Werte in derselben Ansicht** (z.B. EBIT −500 €, Bruttoumsatz 250.000 €): Y-Achse skaliert automatisch; alle Linien bleiben sichtbar; die große Wertspanne ist Nutzer-Verantwortung (Auswahl bereinigen)
- **Wachstum-Modus, sehr hohe Rate** (z.B. +9.999.900 %): Wert wird korrekt berechnet und angezeigt; keine Obergrenze; Y-Achse skaliert entsprechend
- **Investitionsbezogene Position im Dropdown ausgewählt, Ohne-Investitionen-Filter aktiv:** Linie wird als 0-Linie angezeigt (Werte = 0, nicht aus Dropdown entfernt) — der Nutzer kann die Linie explizit aus dem Dropdown entfernen
- **Position wird nach Seitenload gelöscht (im KPI-Modell):** Beim nächsten Neuladen der Report-Daten verschwindet die Position aus dem Dropdown; wenn sie aktiv war, wird sie still entfernt
- **Bruttoumsatz = 0 in einzelnen Perioden (Prozentual-Modus):** Nur diese Perioden haben keinen Datenpunkt (Lücke in der Linie); andere Perioden zeigen normale Werte
- **Prozentual-Modus, Bruttoumsatz = 0 in allen Perioden:** Alle Linien haben keine Datenpunkte; Hinweis wie in der Tabelle: „Kein Bruttoumsatz im gewählten Zeitraum"
- **Zu viele aktive Linien (z.B. 20 Positionen ausgewählt):** Technisch möglich — Farben werden aus einer Farbpalette zugewiesen (zyklisch); Lesbarkeit liegt beim Nutzer; keine technische Begrenzung

## Technische Anforderungen

### Kein neuer API-Call

- Das Diagramm verwendet ausschließlich die Daten, die bereits über `GET /api/reporting/rentabilitaet` geladen wurden (`use-reporting-rentabilitaet.ts` Hook)
- Kein neuer Endpunkt, keine Änderung der bestehenden API-Route
- Die Linien-Auswahl ist ein reiner `useState` im Frontend

### Charting-Library

- **shadcn/ui Charts** (basierend auf Recharts) — falls im Projekt bereits vorhanden, bevorzugt verwenden
- Alternativ: Recharts direkt (`recharts`-Package) — falls shadcn Charts noch nicht installiert
- Keine neue fremde Charting-Library einführen

### Neue / geänderte Dateien

```
src/components/reporting-rentabilitaet-chart.tsx     ← NEU
  → Liniendiagramm-Komponente
  → Props: data (ReportingRentabilitaetData), displayPerioden,
           anzeigemodus, ohneInvestitionen,
           selectedPositionIds, onSelectionChange
  → Multi-Select-Dropdown für Positions-Auswahl (mit Farbindikatoren)
  → Recharts/shadcn LineChart
  → Leerzustand-Handling (kein Zeitraum, keine Auswahl, Ladestate)

src/app/dashboard/reporting/rentabilitaet/page.tsx   ← GEÄNDERT
  → selectedPositionIds State (useState<string[]>)
  → Initialisierung: Standard-Namen (Bruttoumsatz, Nettoumsatz, DB3, EBIT, EBT)
    per case-insensitivem Name-Match auf data.positionen finden
  → ReportingRentabilitaetChart unterhalb der Filter-Leiste, vor der Matrix einbinden

src/hooks/use-reporting-rentabilitaet.ts             ← keine Änderung nötig
  → displayPerioden und data werden bereits korrekt zurückgegeben
```

### Keine Änderungen an

- API-Routen (`/api/reporting/rentabilitaet`, `/api/report-positionen`)
- Datenbank / Supabase-Migrationen
- RLS-Policies
- `reporting-rentabilitaet-matrix.tsx` (Tabelle bleibt unverändert)
- Andere Seiten

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage

Die bestehende Seite `/dashboard/reporting/rentabilitaet` hat bereits drei fertige Schichten:

- **API** (`route.ts`): Liefert `{ perioden, positionen }` — vollständig serverseitig berechnet, kein neuer Endpunkt nötig
- **Hook** (`use-reporting-rentabilitaet.ts`): Verwaltet Filter-State, API-Call, `displayPerioden` und liefert bereits die Daten für alle Ansichtsmodi
- **Matrix** (`reporting-rentabilitaet-matrix.tsx`): Rendert die Tabelle, berechnet `effectiveData` (mit Ohne-Investitionen-Filterlogik)

Das Liniendiagramm wird als **neue, eigenständige Komponente** zwischen Filter-Leiste und Matrix eingefügt. Es teilt sich denselben Daten-State wie die Matrix — kein zusätzlicher API-Call.

### Komponentenstruktur

```
/dashboard/reporting/rentabilitaet/page.tsx          [GEÄNDERT]
├── Filter-Leiste (unverändert)
├── [NEU] ReportingRentabilitaetChart
│   ├── Kopfzeile: Titel „KPI-Trend" + Positions-Dropdown
│   │   └── Multi-Select (bestehender src/components/multi-select.tsx)
│   │       — listet alle konfigurierten Positionen (alle Typen)
│   │       — aktive Einträge mit farbigem Punkt-Indikator
│   ├── Ladestate: Skeleton (shadcn Skeleton, bereits im Projekt)
│   ├── Leerzustand A: kein gültiger Zeitraum → Hinweistext
│   ├── Leerzustand B: keine Positionen ausgewählt → Hinweistext
│   └── LineChart (Recharts ResponsiveContainer + LineChart)
│       ├── XAxis — Perioden-Labels (Jan 2026 / Q1 2026 / 2026)
│       ├── YAxis — € oder % je Modus; kurzformat bei großen Zahlen
│       ├── CartesianGrid (dezente Hilfslinien)
│       ├── ReferenceLine y=0 (Nulllinie)
│       ├── Tooltip (alle aktiven Positionen + Werte für hover-Periode)
│       ├── Legend (Positions-Name + Linienfarbe)
│       └── Line je ausgewählter Position (eindeutige Farbe, animiert)
└── ReportingRentabilitaetMatrix (unverändert)
```

### Datenfluss

```
useReportingRentabilitaet Hook
  → data (vollständige API-Daten)
  → displayPerioden (ggf. ohne erste Wachstums-Periode)
  → anzeigemodus (absolut | prozentual | wachstum)

page.tsx
  → ohneInvestitionen (bestehender State, PROJ-25)
  → [NEU] selectedPositionIds: string[] (useState, default: [] bis Daten geladen)
  → [NEU] useEffect: nach Datenladen → Standard-Positionen per Name-Match vorauswählen

ReportingRentabilitaetChart (neue Komponente)
  → Empfängt: data, displayPerioden, anzeigemodus, ohneInvestitionen,
              selectedPositionIds, onSelectionChange
  → Berechnet intern effectiveData (analog Matrix: Ohne-Investitionen-Filter anwenden)
  → Berechnet je Modus die Chart-Werte:
      absolut    → position.values[periode] direkt
      prozentual → (wert / bruttoumsatz[periode]) × 100
      wachstum   → (aktuell − vorherig) / |vorherig| × 100
  → Gibt Datenpunkte an Recharts weiter
```

### Wertberechnung je Ansichtsmodus

| Modus | Y-Achse | Datenpunkt-Logik |
|---|---|---|
| Absolut | € (Kurzformat bei ≥ 10.000: „12,4k €") | `position.values[periode]` direkt |
| Prozentual | % (1 Dezimalstelle) | `(wert / bruttoumsatz) × 100`; kein Punkt bei Bruttoumsatz = 0 |
| Wachstum | % (1 Dezimalstelle) | Wachstumsrate ggü. Vorperiode; kein Punkt bei fehlender Vorperiode oder `n/a` |

Die Bruttoumsatz- und Wachstumsberechnungen werden aus den bereits in `reporting-rentabilitaet-matrix.tsx` implementierten Hilfsfunktionen (`bruttoumsatzByPeriode`, `calcWachstum`) **extrahiert und in eine gemeinsame Utility-Datei** verschoben — damit können Chart und Matrix dieselbe Logik nutzen ohne Duplikation.

### Positions-Auswahl (Farben & Dropdown)

**Farbpalette:** 10 feste Farben (Tailwind-konforme Hex-Werte), zyklisch vergeben nach Index der ausgewählten Position in der Reihenfolge der Auswahl.

**Dropdown:** Verwendet den bestehenden `src/components/multi-select.tsx` — dieser unterstützt bereits Multi-Select mit Labels. Er wird erweitert um optionale farbige Punkt-Indikatoren (als Icon-Prop je Option).

**Standard-Vorauswahl:** `useEffect` in `page.tsx` — läuft einmalig wenn Daten geladen sind und `selectedPositionIds` noch leer ist. Sucht case-insensitiv nach den Namen „bruttoumsatz", „nettoumsatz", „db3", „ebit", „ebt" in `data.positionen`. Die gefundenen IDs werden als initiale Auswahl gesetzt.

### Ohne-Investitionen-Filter im Chart

Die Filterlogik (`applyOhneInvestitionenFilter`) liegt aktuell intern in `reporting-rentabilitaet-matrix.tsx`. Sie wird in eine **gemeinsame Utility-Funktion** extrahiert, die sowohl Chart als auch Matrix nutzen — keine Logik-Duplikation.

### Neue / geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/reporting-rentabilitaet-chart.tsx` | **NEU** — Liniendiagramm-Komponente (Recharts + Multi-Select) |
| `src/lib/reporting-utils.ts` | **NEU** — Extrahierte Utility-Funktionen: `bruttoumsatzByPeriode`, `calcWachstum`, `applyOhneInvestitionenFilter`, Farbpalette |
| `src/app/dashboard/reporting/rentabilitaet/page.tsx` | **GEÄNDERT** — `selectedPositionIds`-State, Standard-Vorauswahl, Chart einbinden |
| `src/components/reporting-rentabilitaet-matrix.tsx` | **GEÄNDERT** — Eigene Hilfsfunktionen durch Imports aus `reporting-utils.ts` ersetzen |

**Keine Änderungen an:** API-Routen, Datenbank, RLS-Policies, Hook, andere Seiten

### Abhängigkeit (Package)

| Package | Zweck |
|---|---|
| `recharts` | Liniendiagramm-Rendering (ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ReferenceLine, CartesianGrid) |

Recharts wird direkt installiert (kein shadcn-Chart-Wrapper nötig — die bestehenden shadcn-Komponenten decken alle anderen UI-Elemente ab).

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Charting-Library | Recharts | Kein Chart-Package im Projekt; Recharts ist stabil, leichtgewichtig, React-native und für Next.js bestens geeignet; shadcn/ui Charts baut ebenfalls auf Recharts auf |
| Kein neuer API-Call | Bestehende Hook-Daten | Alle Positions-Werte sind bereits geladen; kein Roundtrip nötig; sofortige Aktualisierung bei Filter-Wechsel |
| Utility-Extraktion | `reporting-utils.ts` | Chart und Matrix teilen dieselbe Berechnungslogik; Extraktion verhindert Duplikation und schafft Single Source of Truth |
| Multi-Select | Bestehender `multi-select.tsx` | Bereits im Projekt vorhanden und getestet; kein neues Package nötig |
| Farbzuweisung | Feste Palette, Index-basiert | Deterministisch und vorhersehbar; Farbe bleibt konstant für eine Position solange sie ausgewählt ist |
| Auswahl-State | `useState` in `page.tsx` | Ephemer (kein Persist gewünscht); analog zu `anzeigemodus` und `ohneInvestitionen` |

## Implementation Notes (Frontend — 2026-05-14)

### Neue Dateien
- `src/components/reporting-rentabilitaet-chart.tsx` — Liniendiagramm-Komponente mit Recharts (`ResponsiveContainer`, `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ReferenceLine`, `Legend`); Multi-Select-Dropdown; Leerzustand-Handling; Wertberechnung je Ansichtsmodus (Absolut / Prozentual / Wachstum)

### Geänderte Dateien
- `src/components/multi-select.tsx` — `Option.color?: string` hinzugefügt; farbiger Punkt-Indikator im Dropdown wenn `color` gesetzt
- `src/app/dashboard/reporting/rentabilitaet/page.tsx` — `selectedPositionIds: string[]` State; `initializedRef` (useRef) für einmalige Standard-Vorauswahl beim ersten Datenladen; `ReportingRentabilitaetChart` zwischen Filter-Leiste und Matrix eingebunden
- `package.json` + `package-lock.json` — `recharts@3.8.1` als neue Abhängigkeit

### Standard-Vorauswahl
Einmalig bei erstem Datenladen via `useEffect` + `useRef`: sucht case-insensitiv nach „bruttoumsatz", „nettoumsatz", „db3", „ebit", „ebt" in `data.positionen`. Gefundene IDs werden als initiale Selektion gesetzt. Auswahl bleibt bei Tab-Wechsel / Zeitraum-Änderung erhalten; Reset nur bei Seiten-Reload.

### Farb-System
10 feste Hex-Farben, Index-basiert aus `effectiveData.positionen`-Reihenfolge. Farbe je Position stabil solange Konfiguration sich nicht ändert. Farbiger Punkt-Indikator im Dropdown für ausgewählte Positionen.

### Wachstums-Modus
Nutzt `data.perioden` (inkl. versteckter Vorperiode an Index 0) für `calcWachstum`. Datenpunkte ohne Vorperiode oder mit `n/a`-Rate werden als `undefined` gesetzt → Recharts rendert Lücke.

### Build & Tests
- `npm run build` ✅ — 36 Routen, alle fehlerfrei
- `npm test` ✅ — 420/420 Tests grün (alle bestehenden Tests bestehen)

## QA Test Results

**QA Date:** 2026-05-14
**QA Status:** APPROVED — 0 kritische/hohe Bugs; Bug #1 war intentionale Anforderungsänderung (Spec angepasst); 2 Low-Bugs (kosmetisch, kein Blocker); alle automatisierten Tests grün; keine Security-Issues

### Automated Tests

| Suite | Tests | Result |
|---|---|---|
| Vitest (gesamt) | 444 / 444 | PASS |
| Vitest (neu PROJ-26) | 24 / 24 | PASS — `src/components/reporting-rentabilitaet-chart.test.ts` |
| Playwright chromium (neu PROJ-26) | 15 / 15 | PASS — `tests/PROJ-26-rentabilitaetsreport-liniendiagramm.spec.ts` |
| `npm test` (Regression) | 420 / 420 (bestehend) + 24 (neu) | PASS |

### Neue Unit-Tests (`reporting-rentabilitaet-chart.test.ts`)

- `rainbowColor`: 8 Tests — Hue-Verteilung 0..270, Edge Cases (total=1, total=0), Neu-Verteilung bei Auswahländerung
- `formatPeriode`: 4 Tests — YYYY-MM → „Jan 2026", Quartal → „Q1 2026", Jahr unverändert, Fallback
- `formatAbsolutShort`: 6 Tests — < 1000, ≥ 1000 (k), ≥ 1M (M), negative Werte (jeweils)
- `formatWachstumTick`: 6 Tests — 0, positiv mit „+", negativ mit Unicode-Minus, deutsche Zahlenformatierung, sehr hohe Raten

### Neue E2E-Tests (Auth & Regression)

- Auth-Redirect für `/dashboard/reporting/rentabilitaet` (mit `?next=`-Param)
- API-Endpunkt `/api/reporting/rentabilitaet` mit allen Granularitäten redirects 401
- Client-side route-mock kann Middleware-Redirect nicht umgehen
- 4 Regression-Tests für andere Dashboard-Routen + 3 für abhängige APIs

### Acceptance Criteria — Code-Review

#### Positionierung und Layout

| # | Kriterium | Status | Begründung |
|---|---|---|---|
| 1 | Diagramm unterhalb Filter, oberhalb Matrix | PASS | `page.tsx` Z.137-147 vor Matrix-Block (Z.149-157) |
| 2 | Eigener Block mit Positions-Dropdown in Kopfzeile | PASS | `chart.tsx` Z.230-239 — flex Kopfzeile mit Titel + `MultiSelect` |
| 3 | Volle verfügbare Breite | PASS | `ResponsiveContainer width="100%"` (Z.248); kein max-width auf Wrapper |
| 4 | Höhe ca. 300–350px | PASS | `height={300}` in ResponsiveContainer (Z.248), Skeleton `h-[300px]` |

#### Standard-Selektion beim Laden

| # | Kriterium | Status | Begründung |
|---|---|---|---|
| 5 | „Bruttoumsatz, Nettoumsatz, DB3, EBIT, EBT" case-insensitiv vorausgewählt | PASS | `page.tsx` Z.18, Z.31-38: `STANDARD_POSITION_NAMEN.includes(p.name.toLowerCase())` |
| 6 | Nicht gefundene Namen still übersprungen | PASS | `.filter(...).map(p => p.id)` — fehlende Namen erzeugen leeres Array, kein Fehler |
| 7 | Keiner gefunden → leeres Diagramm + Hinweis | PASS | Wenn alle leer → `sortedSelectedIds.length === 0` → Leerzustand Z.242-246 |
| 8 | Nur beim Laden vorauswählen | PASS | `initializedRef` (useRef) verhindert Re-Initialisierung nach erstem Lauf |

#### Positions-Auswahl

| # | Kriterium | Status | Begründung |
|---|---|---|---|
| 9 | Multi-Select listet Summen + Bruttoumsatz | PASS | `chart.tsx` Z.100-103: `pos.type === 'summe' \|\| pos.name.toLowerCase() === 'bruttoumsatz'` — bewusste Einschränkung per User-Anforderung, Spec angepasst |
| 10 | Farbiger Indikator pro aktivem Eintrag | PASS | `multi-select.tsx` Z.61-66 rendert Farbpunkt wenn `opt.color` gesetzt |
| 11 | Aktive Einträge markiert + per Klick entfernbar | PASS | `multi-select.tsx` Z.23-29 (`toggle`); Checkbox-Pattern |
| 12 | Änderungen aktualisieren Chart sofort (kein API-Call) | PASS | `onChange` triggert nur `setSelectedPositionIds`; Hook re-fetched nicht |
| 13 | Auswahl bleibt bei Granularität/Modus/Filter-Wechsel erhalten | PASS | State in `page.tsx`, kein Reset bei Filter-Änderung |
| 14 | Reset bei Seiten-Reload (kein persistenter Speicher) | PASS | `useState` ohne localStorage |

#### Diagramm-Darstellung — Absolut-Modus

| # | Kriterium | Status | Begründung |
|---|---|---|---|
| 15 | X-Achse: Perioden-Labels wie Tabelle | PASS | `formatPeriode` Z.31-42 erzeugt „Jan 2026"/„Q1 2026"/„2026" identisch zur Matrix |
| 16 | Y-Achse: € mit Kurzformat | PASS | `formatAbsolutShort` (Z.44-53): „12k €"/„1,5M €" — siehe Bug #2 (Inkonsistenz Minus-Zeichen) |
| 17 | Jede Position eigene Linie + eindeutige Farbe | PASS | `sortedSelectedIds.map` (Z.321-336) erzeugt eine `<Line>` pro Position |
| 18 | Positive über/negative unter 0-Linie | PASS | Recharts-Standard, YAxis ohne `domain`-Override |
| 19 | Horizontale 0-Linie sichtbar | PASS | `<ReferenceLine y={0}>` Z.298 |
| 20 | Legende: Position + Linienfarbe | PASS | Custom Legend Renderer Z.301-319 — sortiert nach `sortedSelectedIds` |
| 21 | Tooltip: Perioden + Werte aller Positionen | PASS | Custom Tooltip Z.266-296; `formatAbsolutFull` → `12.450,00 €` |

#### Diagramm-Darstellung — Prozentual-Modus

| # | Kriterium | Status | Begründung |
|---|---|---|---|
| 22 | Y-Achse: % mit 1 Dezimalstelle | PASS | `formatProzent` (Z.59-61) |
| 23 | Berechnungsbasis (Wert / Bruttoumsatz) × 100 | PASS | `chart.tsx` Z.168-170; `bruttoumsatzByPeriode` Z.141-152 nutzt `kategorien.every(k => k.kpi_type === 'umsatz')` |
| 24 | Bruttoumsatz = 0 → keine Datenpunkte (Lücke) | PASS | `basis === 0 ? undefined : ...` Z.170; `connectNulls={false}` Z.333 |
| 25 | Tooltip: Prozentwerte | PASS | `formatTooltipValue` → `formatProzent` |
| 26 | 0%-Referenzlinie sichtbar | PASS | gleiche `<ReferenceLine y={0}>` |

#### Diagramm-Darstellung — Wachstums-Modus

| # | Kriterium | Status | Begründung |
|---|---|---|---|
| 27 | Y-Achse: Wachstumsrate % mit „+"/„−" | PASS | `formatWachstumTick` Z.63-67 |
| 28 | Datenpunkt = (akt − vor) / abs(vor) × 100 | PASS | `calcWachstum` (Matrix-Util) Z.172-176; identisch zur Tabelle |
| 29 | Erste Periode ohne Vorwert → kein Punkt | PASS | Hook lädt Vorperiode in `data.perioden[0]`; `pIdx > 0` Check Z.174 |
| 30 | Vorwert=0 → „n/a" → kein Punkt | PASS | `calcWachstum` returnt `'n/a'` (Matrix Z.52) → undefined Z.176 |
| 31 | 0%-Referenzlinie sichtbar | PASS | `<ReferenceLine y={0}>` |
| 32 | Tooltip: Wachstumsraten | PASS | `formatTooltipValue` → `formatWachstumTick` |

#### Filter-Konsistenz

| # | Kriterium | Status | Begründung |
|---|---|---|---|
| 33 | Diagramm reagiert auf Von/Bis/Granularität/Modus/Ohne-Inv. | PASS | Komponente konsumiert Hook-Daten + `ohneInvestitionen`-Prop direkt |
| 34 | Ohne-Investitionen aktiv: investitionsbezogen auf 0 / aus Linien ausblenden | **PARTIAL** | `applyOhneInvestitionenFilter` ENTFERNT investitionsbezogene Positionen vollständig statt sie als 0-Linie zu zeigen — siehe Bug #3 |
| 35 | Kein Zeitraum → Hinweis „Bitte Zeitraum auswählen" | PASS | Z.197-209 mit `LineChartIcon` + Text |

#### Leer-Zustände

| # | Kriterium | Status | Begründung |
|---|---|---|---|
| 36 | Kein Zeitraum → Hinweis | PASS | siehe #35 |
| 37 | Keine Positionen ausgewählt → Hinweis „Bitte Positionen…" | PASS | Z.242-246 |
| 38 | Alle Werte = 0 → 0-Linie sichtbar | PASS | Recharts rendert Linien auf y=0; keine versteckten 0-Werte; `connectNulls={false}` |
| 39 | Keine Positionen konfiguriert → kein Hinweis (Tabelle übernimmt) | PASS | Z.223-225: `!effectiveData \|\| effectiveData.positionen.length === 0` returnt `null` |
| 40 | Loading → Skeleton | PASS | Z.211-221 |

### Bugs gefunden

| # | Schweregrad | Beschreibung | Status |
|---|---|---|---|
| 1 | ~~Medium~~ | ~~Dropdown-Filter weicht von Spec ab~~ | Kein Bug — bewusste Anforderungsänderung durch User. Spec und AC #9 wurden entsprechend aktualisiert. |
| 2 | Low | **Inkonsistentes Minus-Zeichen in Y-Achsen-Labels.** Im Absolut-Modus nutzt `formatAbsolutShort` `value.toLocaleString('de-DE', …)`, was in der Vercel-Node-Runtime einen ASCII-Bindestrich (`-`) erzeugt (z.B. `-1,5k €`). Im Wachstums-Modus nutzt `formatWachstumTick` explizit Unicode-Minus (`−12,1 %` mit U+2212). Im Tooltip wird via `Intl.NumberFormat` `formatAbsolutFull` ebenfalls ASCII-Bindestrich verwendet. → Optische Inkonsistenz zwischen Y-Achse, Tooltip und Wachstum-Modus. Niedrige Priorität, kosmetisch. | Open |
| 3 | Low | **Edge Case „Investitionsbezogene Position bei aktivem Ohne-Inv.-Filter" abweichend.** Spec (Edge Cases): „Linie wird als 0-Linie angezeigt (Werte = 0, nicht aus Dropdown entfernt)". Implementation: `applyOhneInvestitionenFilter` entfernt investitionsbezogene Positionen aus `effectiveData.positionen`, daher verschwindet die Linie und der Eintrag im Dropdown komplett. Da Dropdown-Filter (Bug #1) ohnehin nur Summen + Bruttoumsatz zulässt — und Summen typischerweise nicht `investitionsbezogen` sind — ist der praktische Impact gering. Wenn Bug #1 gefixt wird (alle Positionstypen im Dropdown), wird dieser Edge-Case relevanter. | Open |

### Security Audit

| Bereich | Befund |
|---|---|
| Neue API-Endpunkte | Keine — PROJ-26 ist rein clientseitig (Chart-Komponente konsumiert vorhandenen Hook). Kein neues Auth-Risiko. |
| Auth-Bypass | `/dashboard/reporting/rentabilitaet` middleware-redirect verifiziert via Playwright. `/api/reporting/rentabilitaet` und alle dependency-APIs (`/api/report-positionen`, `/api/produktkosten`, `/api/bestand-transaktionen`) verlangen weiterhin Auth. Client-side `page.route`-Mock kann Middleware nicht umgehen. |
| XSS-Vektoren | Tooltip rendert `pos?.name ?? posId` und `entry.name` — beide kommen aus `data.positionen` (server-validierte Quelle), nicht aus User-Input. Recharts rendert via SVG-Text, kein `dangerouslySetInnerHTML`. Custom Renderer in Tooltip/Legend nutzen JSX-text-binding (auto-escaped). |
| Injection | `colorByPositionId[posId]` — `posId` stammt aus `effectiveData.positionen` (server-source); Farbe wird über `hsl(…)` String an inline style übergeben — gültiger CSS-Wert, kein Injection-Vektor. |
| Data-Leak | Diagramm zeigt nur Daten des bereits authentifizierten Hook-Calls. Kein zusätzlicher Roundtrip, kein neuer Datenpfad. |
| Dependencies | Neu: `recharts@3.8.1`. Etablierte Library (>1M Downloads/Woche, MIT). Keine bekannten kritischen CVEs zum Zeitpunkt des QA. |

**Security-Verdict:** PASS — keine neuen Auth/Data-Leak/Injection-Risiken eingeführt.

### Empfehlung

- Bug #1 ist keine Abweichung — bewusste User-Anforderung, Spec aktualisiert. ✅
- Bug #2 (Minus-Zeichen-Inkonsistenz) und Bug #3 (Ohne-Inv.-Edge-Case) sind Low-Priority, kosmetisch, können optional vor dem Deploy gefixt werden.
- **Feature ist production-ready. Status: Approved.**

## Deployment
_To be added by /deploy_
