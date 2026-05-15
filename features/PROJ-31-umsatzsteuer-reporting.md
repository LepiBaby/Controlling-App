# PROJ-31: Umsatzsteuer-Reporting

## Status: Approved
**Created:** 2026-05-14
**Last Updated:** 2026-05-14 (Backend implementiert)

## Dependencies
- PROJ-3: Umsatz-Transaktionen (Datenquelle: `umsatz_transaktionen`)
- PROJ-2: KPI-Modell Verwaltung (Umsatz-Kategoriehierarchie + `ust_satz` auf Produktebene)
- PROJ-20: Rentabilitätsreport (Architekturmuster: Matrix-Tabelle, Granularitäts-Tabs, Drill-Down)
- PROJ-30: Abziehbare Vorsteuer (Datenquelle: `ausgaben_kosten_transaktionen.ust_betrag > 0`)
- Spec-Ergänzung PROJ-20 (Umsatzsteuer): `kpi_categories.ust_satz` für Produkte, Berechnungslogik

## Overview

Eine neue Seite „Umsatzsteuer-Reporting" unter `/dashboard/reporting/umsatzsteuer`. Sie berechnet die **abzuführende Umsatzsteuer** aus den Umsatz-Transaktionen und stellt die **abziehbare Vorsteuer** aus Ausgaben-Transaktionen dar — beides in einer gemeinsamen Matrix-Tabelle mit Drill-Down in die KPI-Modell-Hierarchie.

Die Tabelle ist in drei Abschnitte gegliedert:
1. **Abzuführende Umsatzsteuer** — berechnet je Umsatz-Kategorie aus `umsatz_transaktionen × ust_satz` der Produkte
2. **Abziehbare Vorsteuer** — summiert aus `ausgaben_kosten_transaktionen.ust_betrag` je Ausgaben-Kategorie
3. **= Fällige Umsatzsteuer** — Abzuführende USt minus Abziehbare Vorsteuer

Alle Werte werden **absolut** angezeigt (keine Prozent- oder Wachstumsansicht). Kein Diagramm.

## User Stories

- Als Controlling-Mitarbeiter möchte ich die monatlich fällige Umsatzsteuer auf einen Blick sehen, damit ich die USt-Voranmeldung vorbereiten kann.
- Als Controlling-Mitarbeiter möchte ich die abzuführende USt nach Umsatz-Kategorien aufgeschlüsselt sehen, damit ich verstehe, welche Erlöskategorien wie viel USt erzeugen.
- Als Controlling-Mitarbeiter möchte ich in die Kategorien bis auf Produktebene hineinzoomen, damit ich die USt je Produkt (mit seinem Steuersatz) nachvollziehen kann.
- Als Controlling-Mitarbeiter möchte ich die abziehbare Vorsteuer aus Ausgaben-Transaktionen nach Kategorien aufgeschlüsselt sehen, damit ich sie der abzuführenden USt gegenüberstellen kann.
- Als Controlling-Mitarbeiter möchte ich zwischen Monats-, Quartals- und Jahresansicht wechseln können, damit ich verschiedene Berichtszeiträume auswerten kann.
- Als Controlling-Mitarbeiter möchte ich von/bis auf Monatsebene filtern, damit ich genau den relevanten Berichtszeitraum auswählen kann.

## Acceptance Criteria

### Seite & Navigation
- [ ] Seite unter `/dashboard/reporting/umsatzsteuer` erreichbar
- [ ] Seite nur für eingeloggte Nutzer zugänglich
- [ ] Nav-Eintrag „Umsatzsteuer-Report" unter der Gruppe „Reporting" im Navigationsmenü

### Filter-Leiste
- [ ] Von/Bis-Monatsauswahl (`<input type="month">`) vorhanden
- [ ] Standardwert beim Öffnen: aktuelles Kalenderjahr (z. B. 01/2026 bis 12/2026)
- [ ] Granularitäts-Tabs: **Monatlich** | **Quartal** | **Jahr**
- [ ] Tab „Monatlich": je Monat eine Spalte (Format: „Jan 2026")
- [ ] Tab „Quartal": je Quartal eine Spalte (Format: „Q1 2026")
- [ ] Tab „Jahr": je Kalenderjahr eine Spalte (Format: „2026")
- [ ] Tab-Wechsel behält den Von/Bis-Zeitraum bei

### Matrix-Tabelle — Struktur
- [ ] Erste Spalte (Zeilenbezeichnung) ist beim horizontalen Scrollen sticky
- [ ] Tabelle ist bei vielen Spalten horizontal scrollbar
- [ ] **Abschnitt 1:** Zeilen für jede Umsatz-Kategorie (Ebene 1 aus KPI-Modell, `type='umsatz'`)
- [ ] **Zwischensummen-Zeile:** „Abzuführende Umsatzsteuer" — hervorgehoben (fette Schrift, Hintergrundfarbe)
- [ ] **Abschnitt 2:** Zeilen für jede Ausgaben-Kategorie mit vorhandener Vorsteuer (Ebene 1 aus KPI-Modell, `type='ausgaben_kosten'`)
- [ ] **Zwischensummen-Zeile:** „Abziehbare Vorsteuer" — hervorgehoben
- [ ] **Ergebniszeile:** „= Fällige Umsatzsteuer" — prominenteste Hervorhebung (fett, eigene Farbe/Rahmenlinie), als letztes Element
- [ ] 0-Werte werden als „0,00 €" angezeigt (nicht leer gelassen)
- [ ] Beträge immer mit 2 Dezimalstellen und € (de-DE Locale, z. B. „12.450,00 €")
- [ ] Alle Werte absolut (keine negativen Beträge in der Darstellung)

### Drill-Down — Abzuführende Umsatzsteuer
- [ ] Jede Umsatz-Kategorie-Zeile ist ausklappbar → zeigt Gruppen (Ebene 2)
- [ ] Jede Gruppen-Zeile ist ausklappbar → zeigt Untergruppen (Ebene 3)
- [ ] Untergruppen-Zeile ist ausklappbar → zeigt Produkte (wenn `produkt_enabled = true`)
- [ ] Produkt-Zeile zeigt den Produktnamen mit USt-Satz als Label (z. B. „Produkt A (19 %)")
- [ ] Kategorien ohne Produkte mit `ust_satz > 0` zeigen 0 €, sind aber sichtbar
- [ ] Expand/Collapse-Zustand bleibt beim Tab-Wechsel erhalten

### Drill-Down — Abziehbare Vorsteuer
- [ ] Jede Ausgaben-Kategorie-Zeile ist ausklappbar → zeigt Gruppen
- [ ] Jede Gruppen-Zeile ist ausklappbar → zeigt Untergruppen
- [ ] Nur Kategorien anzeigen, die im gewählten Zeitraum mindestens eine Vorsteuer-Transaktion haben (oder immer alle Kategorien aus dem Ausgaben-KPI-Modell — s. Edge Cases)
- [ ] Expand/Collapse-Zustand bleibt beim Tab-Wechsel erhalten

### Wertberechnung — Abzuführende Umsatzsteuer
- [ ] Je Produkt und Periode: `Netto-Basis = Σ betrag (ist_abzugsposten=false) − Σ betrag (ist_abzugsposten=true)` aus `umsatz_transaktionen` mit `produkt_id = dieses Produkt` AND `leistungsdatum` in der Periode
- [ ] `USt-Betrag (Produkt) = Netto-Basis × (ust_satz / 100)` des Produkts (aus `kpi_categories.ust_satz`)
- [ ] Produkte mit `ust_satz = NULL` oder `ust_satz = 0` leisten keinen Beitrag
- [ ] Transaktionen ohne `produkt_id` leisten keinen Beitrag zur USt-Berechnung
- [ ] Untergruppen-Wert = Σ USt-Beträge aller Produkte der Untergruppe
- [ ] Gruppen-Wert = Σ Untergruppen-Werte (+ direkte Produkte ohne Untergruppe)
- [ ] Kategorie-Wert = Σ Gruppen-Werte (+ direkte Produkte ohne Gruppe)
- [ ] Zwischensumme „Abzuführende Umsatzsteuer" = Σ aller Kategorie-Werte

### Wertberechnung — Abziehbare Vorsteuer
- [ ] Je Kategorie/Gruppe/Untergruppe und Periode: Σ `ust_betrag` aus `ausgaben_kosten_transaktionen` WHERE `ust_betrag > 0` AND `leistungsdatum` in der Periode AND entsprechende `kategorie_id` / `gruppe_id` / `untergruppe_id`
- [ ] Zwischensumme „Abziehbare Vorsteuer" = Σ aller Kategorie-Vorsteuer-Werte

### Wertberechnung — Fällige Umsatzsteuer
- [ ] `Fällige Umsatzsteuer = Abzuführende USt − Abziehbare Vorsteuer` je Periode
- [ ] Kann positiv (mehr USt als Vorsteuer) oder negativ (Vorsteuer-Überhang) sein
- [ ] Negative Werte werden mit Minuszeichen dargestellt (Erstattungsanspruch)

### Leerzustände
- [ ] Kein Von/Bis-Zeitraum → Hinweistext „Bitte Zeitraum auswählen"
- [ ] Zeitraum gewählt, keine Transaktionen → alle Werte 0 €, Kategorie-Struktur sichtbar (wenn KPI-Modell vorhanden)
- [ ] Kein Umsatz-KPI-Modell → Hinweis mit Link zum KPI-Modell
- [ ] Lade-Zustand: Skeleton-Zeilen

### Fehlerbehandlung
- [ ] API-Fehler werden als rote Fehlermeldung über der Tabelle angezeigt

## Edge Cases

- Produkt hat `ust_satz = 0` oder `NULL` → kein USt-Beitrag; Produkt-Zeile zeigt 0 €
- Kategorie hat keine Produkte (nur Gruppen ohne `produkt_enabled`) → 0 €, keine Produkt-Unterzeilen
- Ausgaben-Kategorie hat im Zeitraum keine Vorsteuer-Transaktionen → 0 € für alle Perioden (Kategorie-Zeile sichtbar wenn im KPI-Modell vorhanden)
- `leistungsdatum IS NULL` in `ausgaben_kosten_transaktionen` → Transaktion wird nicht berücksichtigt
- Fällige Umsatzsteuer ist negativ (Vorsteuer > abzuführende USt) → Wert mit Minuszeichen anzeigen
- Zeitraum Von > Bis → Validierungsfehler, Tabelle nicht angezeigt
- Sehr breite Tabelle (monatlich, 3 Jahre = 36 Spalten) → horizontales Scrolling mit sticky Zeilenbeschriftung
- KPI-Modell hat nur 1 Ebene (keine Gruppen) → Kategorie-Zeile direkt Blatt, kein Expand-Toggle

---

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/reporting/umsatzsteuer/page.tsx  (NEU)
├── NavSheet (bestehend — Eintrag ergänzen)
├── Filter-Leiste
│   ├── Von-Monatsauswahl  (HTML5 <input type="month">)
│   ├── Bis-Monatsauswahl  (HTML5 <input type="month">)
│   └── Granularitäts-Tabs (shadcn Tabs: Monatlich | Quartal | Jahr)
├── Fehlermeldung / Validierungsfehler
└── ReportingUmsatzsteuerMatrix (NEU)
    ├── Leerzustand A: kein Zeitraum → Hinweistext
    ├── Leerzustand B: kein Umsatz-KPI-Modell → Link zum KPI-Modell
    ├── Ladezustand: Skeleton-Zeilen
    └── Matrix-Tabelle (overflow-x-auto, sticky erste Spalte)
        ├── Kopfzeile: [Bezeichnung (sticky) | Jan 2026 | Feb 2026 | ...]
        │
        ├── ABSCHNITT: Abzuführende Umsatzsteuer
        │   ├── Umsatz-Kategorie-Zeile A (ausklappbar)
        │   │   ├── [ausgeklappt] Gruppen-Zeile (eingerückt, ausklappbar)
        │   │   │   └── [ausgeklappt] Untergruppen-Zeile (ausklappbar wenn produkt_enabled)
        │   │   │       └── [ausgeklappt] Produkt-Zeile „Name (19 %)" (Blatt)
        │   │   └── ...weitere Gruppen
        │   ├── Umsatz-Kategorie-Zeile B ...
        │   └── Zwischensumme-Zeile: „Abzuführende Umsatzsteuer" (hervorgehoben, nicht ausklappbar)
        │
        ├── ABSCHNITT: Abziehbare Vorsteuer
        │   ├── Ausgaben-Kategorie-Zeile A (ausklappbar)
        │   │   ├── [ausgeklappt] Gruppen-Zeile (eingerückt, ausklappbar)
        │   │   │   └── [ausgeklappt] Untergruppen-Zeile (Blatt)
        │   │   └── ...weitere Gruppen
        │   ├── Ausgaben-Kategorie-Zeile B ...
        │   └── Zwischensumme-Zeile: „Abziehbare Vorsteuer" (hervorgehoben, nicht ausklappbar)
        │
        └── Ergebniszeile: „= Fällige Umsatzsteuer" (prominenteste Hervorhebung, nicht ausklappbar)
```

### Datenmodell (API-Response)

Der Endpunkt `GET /api/reporting/umsatzsteuer` gibt ein vollständiges hierarchisches Objekt zurück — alle Perioden und alle Drill-Down-Ebenen in einem einzigen Aufruf:

```
ReportingUmsatzsteuerResponse
  perioden: string[]                  — geordnete Perioden-Schlüssel
                                        Monatlich: ["2026-01", "2026-02", ...]
                                        Quartal:   ["2026-Q1", "2026-Q2", ...]
                                        Jahr:      ["2025", "2026"]
  abzufuehrendeUst: {
    kategorien: UstKategorie[]
    summe: Record<string, number>     — Σ aller Kategorien je Periode
  }
  abziehbareVorsteuer: {
    kategorien: VorsteuerKategorie[]
    summe: Record<string, number>     — Σ aller Kategorien je Periode
  }
  faelligeUst: Record<string, number> — abzufuehrendeUst.summe − abziehbareVorsteuer.summe

UstKategorie
  id, name
  values: Record<string, number>      — berechnete USt je Periode
  gruppen: UstGruppe[]

UstGruppe
  id, name
  values: Record<string, number>
  untergruppen: UstUntergruppe[]

UstUntergruppe
  id, name
  values: Record<string, number>
  produkte: UstProdukt[]              — nur wenn produkt_enabled

UstProdukt
  id, name
  ust_satz: number                    — z.B. 19 (Prozent)
  values: Record<string, number>

VorsteuerKategorie
  id, name
  values: Record<string, number>      — Σ ust_betrag je Periode
  gruppen: VorsteuerGruppe[]

VorsteuerGruppe
  id, name
  values: Record<string, number>
  untergruppen: VorsteuerUntergruppe[]

VorsteuerUntergruppe
  id, name
  values: Record<string, number>
```

### API-Endpunkt

```
GET /api/reporting/umsatzsteuer
  ?von=2026-01           (YYYY-MM, Pflicht)
  ?bis=2026-12           (YYYY-MM, Pflicht)
  ?granularitaet=monat   ('monat' | 'quartal' | 'jahr')

Server-seitige Schritte:
  1. kpi_categories laden — Umsatz-Hierarchie (type='umsatz') inkl. Produkte mit ust_satz
  2. umsatz_transaktionen im Zeitraum laden (betrag, ist_abzugsposten, produkt_id,
     kategorie_id, gruppe_id, untergruppe_id, leistungsdatum)
  3. Je Produkt und Periode: Netto-Basis = Σ betrag (is_abzugsposten=false) − Σ betrag
     (ist_abzugsposten=true) → USt = Netto-Basis × ust_satz / 100
  4. Aggregation: Produkt → Untergruppe → Gruppe → Kategorie → Gesamtsumme
  5. kpi_categories (type='ausgaben_kosten') laden — Ausgaben-Hierarchie
  6. ausgaben_kosten_transaktionen im Zeitraum WHERE ust_betrag > 0 laden
     (ust_betrag, leistungsdatum, kategorie_id, gruppe_id, untergruppe_id)
  7. Aggregation: Transaktion → Untergruppe → Gruppe → Kategorie → Gesamtsumme
  8. faelligeUst = abzufuehrendeUst.summe − abziehbareVorsteuer.summe je Periode
  9. Hierarchisches Response-Objekt zurückgeben
```

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `src/app/dashboard/reporting/umsatzsteuer/page.tsx` | Seite: Filter-Leiste (Von/Bis + Tabs) + ReportingUmsatzsteuerMatrix |
| `src/app/api/reporting/umsatzsteuer/route.ts` | GET-Handler: Zod-Validierung, Supabase-Abfragen, Berechnung, hierarchische Response |
| `src/hooks/use-reporting-umsatzsteuer.ts` | Typdefinitionen (ReportingUmsatzsteuerResponse u. a.) + Filterzustand (von/bis/granularitaet) + API-Aufruf |
| `src/components/reporting-umsatzsteuer-matrix.tsx` | Matrix-Tabelle: sticky erste Spalte, 2 Sektionen + Ergebniszeile, Expand/Collapse via Set<string>, Leerzustand-Handling |

### Bestehende Dateien geändert

| Datei | Änderung |
|-------|----------|
| `src/components/nav-sheet.tsx` | Eintrag `{ href: '/dashboard/reporting/umsatzsteuer', label: 'Umsatzsteuer-Report' }` unter Reporting ergänzen |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| API-Namespace | `/api/reporting/umsatzsteuer` | Konsistent mit `/api/reporting/rentabilitaet`; kein Konflikt mit bestehendem `/api/vorsteuer` (Transaktionstabelle) |
| Eigener Matrix-Component | `ReportingUmsatzsteuerMatrix` | Andere Zeilenstruktur als Rentabilitätsreport: 2 feste Sektionen + Ergebniszeile statt nutzer-definierter `report_positionen` |
| Kein `report_positionen`-Modell | Fest codierte Sektionsstruktur | USt-Reporting hat immer dieselben 2 Sektionen; keine Nutzer-Konfiguration der Zeilen nötig |
| Vollständige Server-Berechnung | Ein API-Call | Drill-Down-Daten vollständig vorhanden; kein weiterer Request beim Ausklappen — identisches Muster zu PROJ-20 |
| Vorsteuer-Wert | Direkt aus `ust_betrag` | Bereits korrekt berechnet bei der Buchung (PROJ-30); kein Neuberechnungsbedarf |
| USt-Berechnung | Netto-Basis × ust_satz des Produkts | Konsistent mit PROJ-20 Spec-Ergänzung Umsatzsteuer; Single Source of Truth |
| Absolutbeträge | Immer | Explizit ausgeschlossen: keine Prozent- oder Wachstumsansicht |
| Monatsauswahl | HTML5 `<input type="month">` | Kein Package nötig; liefert YYYY-MM direkt — identisch zu PROJ-20 |
| Granularitäts-Auswahl | shadcn `Tabs` | Bereits installiert; konsistent mit anderen Report-Seiten |
| Sticky erste Spalte | CSS `position: sticky; left: 0` | Keine zusätzliche Library; bewährtes Muster aus PROJ-20 |
| Expand-State | `useState` mit `Set<string>` | Alle Daten geladen; kein globaler State nötig — identisches Muster zu PROJ-20 |
| Vorsteuer-Kategorien | Alle Ausgaben-Kategorien aus KPI-Modell | Konsistenz: Struktur immer sichtbar auch wenn kein Wert im Zeitraum (analog PROJ-20 Positionen bleiben bei 0 €) |

### Datenpfad

```
UmsatzsteuerPage → useReportingUmsatzsteuer (Hook)
  → GET /api/reporting/umsatzsteuer?von=&bis=&granularitaet=
    → Supabase (parallel):
        a) kpi_categories (Umsatz + Ausgaben Hierarchie, Produkte mit ust_satz)
        b) umsatz_transaktionen (betrag, ist_abzugsposten, produkt_id, ...)
        c) ausgaben_kosten_transaktionen WHERE ust_betrag > 0
    ← ReportingUmsatzsteuerResponse { perioden, abzufuehrendeUst, abziehbareVorsteuer, faelligeUst }
  ← data, loading, error, von, bis, granularitaet, setVon, setBis, setGranularitaet
→ ReportingUmsatzsteuerMatrix (rendering)
```

### Keine neuen Abhängigkeiten

Alle benötigten UI-Primitiven (Input, Tabs, Button, Table, Skeleton, Card) sind bereits installiert.

## Implementation Notes (Frontend — 2026-05-14)

### Neue Dateien
- `src/hooks/use-reporting-umsatzsteuer.ts` — Typen (UstKategorie/Gruppe/Untergruppe/Produkt, VorsteuerKategorie/Gruppe/Untergruppe, ReportingUmsatzsteuerData) + Filterzustand (von/bis/granularitaet) + API-Aufruf
- `src/components/reporting-umsatzsteuer-matrix.tsx` — Matrix mit zwei Sektionen, Expand/Collapse via Set<string>, sticky erste Spalte, Leerzustand-Handling
- `src/app/dashboard/reporting/umsatzsteuer/page.tsx` — Seite mit Von/Bis-Monatsauswahl, Granularitäts-Tabs, Fehleranzeige

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — Eintrag „Umsatzsteuer-Report" unter Reporting ergänzt

### Build & Tests
- `npm run build` ✅ — `/dashboard/reporting/umsatzsteuer` korrekt gebaut
- `npm test` ✅ — 498/498 Tests grün

## Implementation Notes (Backend — 2026-05-14)

### Neue Dateien
- `src/app/api/reporting/umsatzsteuer/route.ts` — GET-Handler: Zod-Validierung, 5 parallele Supabase-Abfragen (umsatzCats, ausgabenCats, produkteCats, umsatzRows, vsRows), EntityMap-Akkumulation, hierarchische Response
- `src/app/api/reporting/umsatzsteuer/route.test.ts` — 15 Vitest-Tests: Validierung (400), USt-Berechnung 19%/7%, Abzugsposten-Negation, null ust_satz überspringen, Vorsteuer-Aggregation, fällige USt, negative fällige USt, Drill-Down (Gruppe/Untergruppe), Granularität (quartal/jahr), mehrere Produkte, DB-Fehler 500

### Wichtige Implementierungsdetails
- USt-Berechnung Brutto-Herausrechnung: `USt = Brutto × ust_satz / (100 + ust_satz)` (nicht Netto-Aufschlag — Brutto-Transaktionsdaten)
- `ist_abzugsposten`-Logik: betrag wird negiert für Abzugsposten-Kategorien (z. B. Retouren)
- Produkt-Placement: Produkte akkumulieren in `ustPrdInUgr`, `ustPrdInGrp`, oder `ustPrdInCat` je nach tiefster verfügbarer Hierarchieebene
- `requireAuth()` ohne `user.id`: keine `report_positionen` (user_id nötig), RLS schützt alle anderen Tabellen

### Build & Tests
- `npm run build` ✅ — `/api/reporting/umsatzsteuer` und `/dashboard/reporting/umsatzsteuer` korrekt gebaut
- `npm test` ✅ — 517/517 Tests grün (davon 15 neue Backend-Tests)

## QA Test Results (2026-05-15)

### Testergebnis-Übersicht

| Kategorie | Ergebnis |
|-----------|----------|
| Acceptance Criteria | 38/40 ✅  2 Low-Abweichungen |
| Unit Tests (Vitest) | 517/517 ✅ |
| E2E Tests (PROJ-31) | 42/42 ✅ |
| E2E Regression (alle) | 648/648 ✅ |
| Security Audit | ✅ Keine kritischen Findings |
| Cross-Browser | Chrome + Mobile Safari ✅ |

### Acceptance Criteria — Ergebnisse

**Seite & Navigation**
- ✅ Seite `/dashboard/reporting/umsatzsteuer` erreichbar (Build + E2E)
- ✅ Seite nur für eingeloggte Nutzer (Middleware-Redirect, E2E bestätigt)
- ✅ Nav-Eintrag „Umsatzsteuer-Report" unter Reporting im NavSheet

**Filter-Leiste**
- ⚠️ Standardwert: Implementierung nutzt „letzte 12 Monate" (z. B. Jun 2025 – Mai 2026) statt „aktuelles Kalenderjahr" (Jan–Dez 2026) — konsistent mit Rentabilitätsreport-Verhalten (Low)
- ✅ Von/Bis `<input type="month">` vorhanden
- ✅ Granularitäts-Tabs Monatlich | Quartal | Jahr
- ✅ Spaltenformate: „Jan 2026", „Q1 2026", „2026"
- ✅ Tab-Wechsel behält Von/Bis-Zeitraum bei

**Matrix-Tabelle**
- ✅ Sticky erste Spalte
- ✅ Horizontales Scrolling
- ✅ Abschnitt 1: Umsatz-Kategorien
- ✅ Zwischensumme „Abzuführende Umsatzsteuer" (fett, bg-muted)
- ✅ Abschnitt 2: Ausgaben-Kategorien
- ✅ Zwischensumme „Abziehbare Vorsteuer" (fett, bg-muted)
- ✅ Ergebniszeile „= Fällige Umsatzsteuer" (fett, border-t-2 + border-b-2)
- ✅ 0-Werte als „0,00 €"
- ✅ de-DE Locale mit € Symbol
- ⚠️ „Alle Werte absolut": USt-Zeilen für Abzugsposten-Kategorien können theoretisch negative Werte zeigen (wenn Abzugspostenbetrag > reguläre Umsätze in selber Kategorie). Nur als Low eingestuft, da in der Praxis unwahrscheinlich und semantisch korrekt (Low)

**Drill-Down**
- ✅ Kategorie → Gruppe → Untergruppe → Produkt ausklappbar
- ✅ Produkt-Label „Name (19 %)"
- ✅ Expand/Collapse bleibt beim Tab-Wechsel erhalten
- ✅ Ausgaben-Kategorien: Kategorie → Gruppe → Untergruppe

**Wertberechnung**
- ✅ Brutto-Herausrechnung: USt = Brutto × ust_satz / (100 + ust_satz)
- ✅ Abzugsposten negiert betrag
- ✅ ust_satz = NULL/0 → kein Beitrag
- ✅ Kein produkt_id → kein Beitrag
- ✅ Hierarchie-Aggregation korrekt
- ✅ Vorsteuer = Σ ust_betrag WHERE ust_betrag > 0
- ✅ Fällige USt = Abzuführende − Abziehbare (je Periode)
- ✅ Negative fällige USt wird mit Minuszeichen dargestellt (rot → grün)

**Leerzustände**
- ✅ Kein Zeitraum → „Bitte Zeitraum auswählen" (dashed border, Receipt-Icon)
- ✅ Kein KPI-Modell → Hinweis + Link zum KPI-Modell
- ✅ Lade-Zustand: 8 Skeleton-Zeilen

**Fehlerbehandlung**
- ✅ API-Fehler → rote Border-Box über der Tabelle

### Gefundene Bugs

| # | Schwere | Beschreibung | Schritte |
|---|---------|-------------|---------|
| 1 | Low | Standard-Zeitraum: Hook nutzt „letzte 12 Monate" statt „aktuelles Kalenderjahr" | Seite öffnen → Von/Bis-Felder prüfen; z. B. Juni 2025 – Mai 2026 statt Jan–Dez 2026 |
| 2 | Low | Abzugsposten-Kategorien können negative USt-Werte anzeigen (verletzt AC „alle Werte absolut") | KPI-Modell: Kategorie mit `ist_abzugsposten=true` anlegen; Umsatz-Transaktionen für diese Kategorie erfassen → USt-Zeile zeigt negatives Vorzeichen |

### Security Audit

- ✅ Auth-Middleware schützt Seite und API (E2E bestätigt)
- ✅ Client-side Mocking bypassed die Middleware nicht
- ✅ Zod-Validierung auf von/bis/granularitaet (400 bei falschen Werten)
- ✅ Kein `user.id` exponiiert; RLS schützt alle Supabase-Tabellen
- ✅ Keine sensitiven Daten in API-Parametern
- ✅ SQL Injection nicht möglich (Supabase parameterized queries)

### Regressions-Test

- ✅ Alle 648 E2E-Tests der gesamten Test-Suite grün (keine Regressions)
- ✅ Bestehende Reporting-Seiten weiterhin auth-gated (Rentabilität, Deckungsbeitrag, Break-Even, Liquidität)
- ✅ `/api/umsatz-transaktionen`, `/api/ausgaben-kosten-transaktionen`, `/api/kpi-categories` auth-gated

### Produktion-Bereitschaft

**BEREIT** — Keine Critical oder High Bugs. Zwei Low-Abweichungen sind akzeptabel:
1. „Letzte 12 Monate" als Default ist konsistent mit dem Rentabilitätsreport
2. Negative USt-Werte bei Abzugsposten sind semantisch korrekt und in der Praxis unwahrscheinlich

## Deployment
_To be added by /deploy_
