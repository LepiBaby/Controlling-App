# PROJ-21: Produktkosten-Bestandsberechnung im Rentabilitätsreport

## Status: Planned
**Created:** 2026-05-13
**Last Updated:** 2026-05-13

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-16 (Produktkosten-Verwaltung) — `produktkosten_zeitraeume` + `produktkosten_werte` als Kostenbasis
- Requires: PROJ-17 (Bestandsveränderungen-Verwaltung) — `bestand_transaktionen` + `bestand_sendungen` als Mengenbasis
- Requires: PROJ-20 (Rentabilitätsreport) — Report-Seite, in die diese Berechnung integriert wird

## Übersicht

Erweiterung des Rentabilitätsreports (PROJ-20) um eine zweite Datenquelle für Produktkosten. Bisher kommen Produktkosten ausschließlich aus direkten Buchungen in `ausgaben_kosten_transaktionen`. Neu kommt eine **berechnete Quelle** hinzu, die sich aus der Bestandsverwaltung ableitet:

**Berechnungslogik:**
> Für jede Plattform-Sendung aus `bestand_sendungen` im Berichtszeitraum:
> `Produktkosten = Sendungsmenge × Gesamtkosten je Stück`
>
> Die Gesamtkosten je Stück ergeben sich als Summe aller Werte (`produktkosten_werte.wert`) des gültigen `produktkosten_zeitraum` für das jeweilige Produkt (Ebene 1) am Transaktionsdatum.

Beide Quellen (Direktbuchungen + Bestandsberechnung) werden **addiert** und gemeinsam in derselben Report-Position angezeigt. Es gibt keine getrennte Darstellung der beiden Quellen im Report.

**Manuelle Sendungen** (`sendungen_manuell` aus `bestand_transaktionen`) fließen **nicht** in die Berechnung ein.

## User Stories

- Als Nutzer möchte ich, dass die Produktkosten im Rentabilitätsreport sowohl aus direkten Ausgaben-Buchungen als auch aus der Bestandsverwaltung berechnet werden, damit die P&L vollständig und korrekt ist.
- Als Nutzer möchte ich die berechneten Produktkosten auf Produkt-Ebene aufschlüsseln können, damit ich erkenne, welches Produkt wie viel Kostenanteil erzeugt hat.
- Als Nutzer möchte ich innerhalb eines Produkts die Produktkosten je Sales-Plattform sehen können, damit ich kanalspezifische Kosten analysieren kann.
- Als Nutzer möchte ich, dass Perioden ohne hinterlegte Produktkosten mit 0 € gewertet werden, ohne dass ein Fehler im Report angezeigt wird.
- Als Nutzer möchte ich keine Unterscheidung zwischen Berechnungsquellen sehen müssen — der Report zeigt nur den Gesamtbetrag je Position.

## Acceptance Criteria

### Berechnung

- [ ] Für jede `bestand_sendung` (Plattform-Sendung) im gewählten Berichtszeitraum wird der Kostenbetrag berechnet als: `menge × Σ(produktkosten_werte.wert)` des passenden `produktkosten_zeitraum` für `produkt_id` und `datum`
- [ ] Maßgeblich für die Zeitraum-Zuordnung: `gueltig_von ≤ datum AND (gueltig_bis IS NULL OR gueltig_bis ≥ datum)`
- [ ] Gibt es mehrere gültige `produktkosten_zeitraeume` für dasselbe Produkt am selben Datum (darf laut PROJ-16 nicht vorkommen, Überlappungsschutz) → erster gefundener Zeitraum wird verwendet
- [ ] `sendungen_manuell` aus `bestand_transaktionen` fließt **nicht** in die Berechnung ein
- [ ] Varianten (SKUs, level=2) eines Produkts werden über die gemeinsame `produkt_id` (level=1) aggregiert — d.h. alle SKU-Transaktionen desselben Produkts werden auf Produktebene summiert
- [ ] Berechneter Betrag wird negiert (Kosten = negative Auswirkung auf die P&L), analog zur Behandlung anderer Ausgaben-Positionen im Report
- [ ] Aggregation nach Periode: Monats-, Quartals- oder Jahresaggregation analog zur bestehenden Report-Logik

### Integration in den Rentabilitätsreport

- [ ] Die berechneten Produktkosten werden zur bestehenden Ausgaben-&-Kosten-Quelle addiert
- [ ] Die Addition erfolgt für alle Report-Positionen, die die ausgaben_kosten Kategorie „Produkt" (Ebene 1) enthalten
- [ ] Im Report ist keine separate Zeile oder Quellen-Kennzeichnung sichtbar — es gibt nur den kombinierten Gesamtbetrag
- [ ] Die Zeilen-Struktur des Reports (Positionen, Summen-Positionen) ändert sich nicht

### Drill-Down: Produkt-Ebene

- [ ] Unter einer Position, die die Kategorie „Produkt" (ausgaben_kosten, Ebene 1) enthält, sind die zugehörigen Produkte (aus `kpi_categories`, `type='produkte'`, level=1) als ausklappbare Unterzeilen verfügbar
- [ ] Jede Produkt-Unterzeile zeigt den Gesamtbetrag der Bestandsberechnung für dieses Produkt pro Periode (summiert über alle SKUs)
- [ ] Direktbuchungen, die keinem Produkt zugeordnet werden können, werden im bisherigen Kategorie-Drill-Down (Ebene-2-Kostenkategorien) gezeigt und **nicht** im Produkt-Drill-Down

### Drill-Down: Plattform-Ebene

- [ ] Jede Produkt-Unterzeile ist weiter ausklappbar und zeigt je eine Unterzeile pro Sales-Plattform (`kpi_categories`, `type='sales_plattformen'`, level=1)
- [ ] Der Plattform-Wert entspricht: `Σ(bestand_sendungen.menge × unit_cost)` für diese Plattform und dieses Produkt im Zeitraum
- [ ] Es werden nur Plattformen angezeigt, für die im Zeitraum tatsächlich Sendungen mit Kostenbasis vorhanden sind (0-Wert-Plattformen werden ausgeblendet)
- [ ] Expand/Collapse der Produkt-Unterzeilen bleibt beim Tab-Wechsel (Monatlich / Quartal / Jahr) erhalten

### Fehlende Daten

- [ ] Kein passender `produktkosten_zeitraum` für ein Produkt an einem Datum → die Sendungen dieses Tages werden mit Kosten 0 € gewertet (kein Fehler, kein Hinweis im Report)
- [ ] Produkt hat keine Sendungen im Zeitraum → erscheint nicht als Produkt-Unterzeile
- [ ] Keine `bestand_sendungen`-Einträge im Zeitraum insgesamt → bestehende Report-Werte bleiben unverändert (Berechnung trägt 0 bei)

## Edge Cases

- **Überlappende Zeiträume in produktkosten_zeitraeume**: Sollte durch PROJ-16-Validierung nicht vorkommen; falls doch, wird der erste gefundene Zeitraum verwendet, kein Fehler
- **Produktkosten-Wert = 0 €**: Erlaubt, Sendung trägt 0 € bei — kein Fehler
- **Sendung auf gelöschte/nicht mehr existierende Plattform**: Sendungseintrag in `bestand_sendungen` bleibt erhalten, aber `plattform_id` verweist auf nicht mehr vorhandene Kategorie — diese Sendung wird für die Summe berücksichtigt, aber nicht im Plattform-Drill-Down angezeigt
- **SKU ohne Produkt-Zuordnung** (`produkt_id = NULL`): Diese Transaktionen werden in der Bestandsberechnung ignoriert
- **Produkt nicht im Ausgaben-Kosten-Modell vorhanden**: Kein Fehler — die berechneten Kosten fließen in die Position ein, die die übergeordnete „Produkt"-Kategorie enthält
- **Zeitraum sehr groß (z.B. 3 Jahre monatlich)**: Performance muss gewährleistet bleiben; alle Berechnungen serverseitig
- **Dasselbe Produkt in mehreren Report-Positionen** (ungewöhnlich, aber möglich): Die Produktkosten werden in jede betroffene Position separat eingerechnet

## Technical Requirements

- Berechnung vollständig **serverseitig** in `GET /api/reporting/rentabilitaet`
- Neue Datenquellen: `bestand_transaktionen`, `bestand_sendungen`, `produktkosten_zeitraeume`, `produktkosten_werte`
- Abfragen parallelisierbar mit den bestehenden Datenbankabfragen in Stage 3 (s. PROJ-20 Tech Design)
- Aggregation: `bestand_sendungen.menge × unit_cost` → pro `produkt_id` + `plattform_id` + Periode akkumulieren
- Ermittlung der zugehörigen Report-Position via `produkt_id` → Mapping auf ausgaben_kosten Kategorie „Produkt" (Ebene 1, `type='ausgaben_kosten'`, `name = 'Produkt'`)
- Kein neues DB-Schema notwendig — alle benötigten Tabellen bereits vorhanden
- Auth required (erbt von PROJ-20)
- API-Response-Erweiterung: `ReportKategorie` erhält neues Feld `produkte: ReportProdukt[]` für den Produkt-Drill-Down

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Übersicht der Änderungen

PROJ-21 erfordert **keine neuen Seiten und keine neue Datenbank-Tabellen**. Es handelt sich ausschließlich um die Erweiterung von zwei bestehenden Dateien:

| Datei | Art der Änderung |
|---|---|
| `src/app/api/reporting/rentabilitaet/route.ts` | 2 neue DB-Queries + neue Berechnungsstufe + erweiterter Response |
| `src/hooks/use-reporting-rentabilitaet.ts` | 1 neuer Typ + Erweiterung von `ReportKategorie` |
| `src/components/reporting-rentabilitaet-matrix.tsx` | Neuer Drill-Down-Ast: Produkt → Plattform unter der „Produkt"-Kategorie |

---

### Datenmodell (Neu in der API-Response)

Die API-Response wird um einen neuen Typ erweitert, der an `ReportKategorie` angehängt wird:

```
ReportProdukt  (neu)
  id           — produkt_id (aus kpi_categories, type='produkte', level=1)
  name         — Produktname
  values       — Bestandsberechneter Kostenbetrag je Periode (negiert)
  plattformen  — ReportPlattform[] (bestehender Typ, produkte-Array leer)
```

`ReportKategorie` erhält ein neues optionales Feld:

```
ReportKategorie (bestehend — ergänzt)
  ...bisherige Felder...
  produkte: ReportProdukt[]   ← NEU (leer für alle Kategorien außer „Produkt")
```

---

### Ablauf der Backend-Berechnung (Erweiterung der bestehenden Stages)

Die bestehende Route läuft in 7 Stages. PROJ-21 erweitert Stage 3 und fügt eine neue Zwischenstufe (Stage 3b) ein:

#### Stage 3 — Erweiterung (2 neue parallele DB-Queries)

Neben den bisherigen 6 parallelen Queries kommen 2 neue hinzu:

**Query 7:** Alle `bestand_sendungen` im Berichtszeitraum, mit Join auf `bestand_transaktionen`
- Felder: `menge`, `plattform_id`, `transaktion.datum`, `transaktion.produkt_id`
- Filter: `datum >= vonDate AND datum <= bisDate`
- Nur Zeilen mit gesetztem `produkt_id` (SKUs ohne Produkt werden ignoriert)

**Query 8:** Alle `produktkosten_zeitraeume` die den Berichtszeitraum berühren, mit verschachtelten `produktkosten_werte`
- Filter: `gueltig_von <= bisDate AND (gueltig_bis IS NULL OR gueltig_bis >= vonDate)`
- Felder: `id`, `produkt_id`, `gueltig_von`, `gueltig_bis`, `werte: { wert }`

#### Stage 3b — Bestandsberechnung

1. **Stückkosten-Lookup aufbauen:** Eine Map `(produkt_id → Liste der Zeiträume mit Gesamtkosten)` aus Query 8. Gesamtkosten je Zeitraum = Σ aller `produktkosten_werte.wert`.

2. **Kostenzuordnung je Sendung:** Für jede Bestandssendung aus Query 7:
   - Suche passenden Zeitraum: `gueltig_von ≤ datum AND (gueltig_bis IS NULL OR gueltig_bis ≥ datum)`
   - `unit_cost` = Gesamtkosten des Zeitraums (0 wenn kein Zeitraum gefunden)
   - `cost = menge × unit_cost`
   - Periode bestimmen (wie bestehende `dateToPeriod`-Funktion)

3. **Akkumulation in 3 neue EntityMaps:**
   - `bestandPrdVals` — Schlüssel: `produkt_id` — Gesamtkosten je Produkt je Periode
   - `bestandPltVals` — Schlüssel: `"produkt_id:plattform_id"` — Kosten je Produkt+Plattform je Periode
   - `bestandKatTotal` — Die Summe über alle Produkte, die der „Produkt"-Ausgaben-Kategorie zugerechnet wird

4. **Identifikation der „Produkt"-Ausgaben-Kategorie:** Suche in `allCats` nach `type='ausgaben_kosten'`, `level=1`, `name='Produkt'` (gleiche Konvention wie PROJ-16). Wenn gefunden: Füge `bestandKatTotal`-Werte zu `catVals[produktKatId]` hinzu, damit Position- und Kategorie-Gesamtsummen beide Quellen enthalten.

#### Stage 7 — Response-Erweiterung

Beim Aufbau der `kategorien`-Liste für jede Position: Wenn eine Kategorie die „Produkt"-Ausgaben-Kategorie ist, wird zusätzlich ein `produkte`-Array gebaut:

```
Für jede produkt_id mit Einträgen in bestandPrdVals:
  → ReportProdukt mit values aus bestandPrdVals
  → plattformen: Für jede plattform_id mit Einträgen in bestandPltVals[prdId:*]
      → ReportPlattform mit values aus bestandPltVals (produkte: [] — kein weiteres Nesting)
```

Alle anderen Kategorien erhalten `produkte: []`.

---

### Frontend-Drill-Down (Erweiterung der Matrix)

Die bestehende Drill-Down-Logik in `reporting-rentabilitaet-matrix.tsx` wird um einen neuen Ast erweitert.

#### Bestehende Baumstruktur (unverändert)
```
Position
└─ Kategorie (z.B. „Produkt" ausgaben_kosten)
   └─ Gruppe (Ebene-2-Kostenkategorie, z.B. „Einkaufspreis")
      └─ Untergruppe
         └─ Plattform → Produkt
```

#### Neuer Drill-Down-Ast (parallel zu Gruppen)
```
Position
└─ Kategorie „Produkt" (ausgaben_kosten) — kombinierter Gesamtbetrag
   ├─ [bestehend] Gruppe (Direktbuchungen)
   │   └─ Untergruppe → ...
   └─ [NEU] Produkt-Zeile (z.B. „Baby-Mütze") — Bestandsberechnung
      └─ Plattform-Zeile (z.B. „Amazon") — Bestandsberechnung
```

#### Visuelle Unterscheidung
- Produkt-Zeilen (aus Bestandsberechnung) erscheinen auf gleicher Einrückungsebene wie Gruppen
- Produkt-Zeilen erhalten die bestehende `kind: 'produkt'`-Darstellung (dezenter Text)
- Plattform-Zeilen darunter erhalten die bestehende `kind: 'plattform'`-Darstellung
- Die Kombination ist konsistent mit dem bestehenden Design

#### `pushKategorie`-Erweiterung
Die Funktion `pushKategorie` prüft zusätzlich ob `kat.produkte.length > 0`. Falls ja:
- Kategorie wird als `expandable: true` markiert (auch wenn keine Gruppen)
- Beim Ausklappen: erst Gruppen-Zeilen (wie bisher), dann Produkt-Zeilen (neu)
- Jede Produkt-Zeile ist wiederum ausklappbar wenn `plattformen.length > 0`

---

### Neue Dateien

Keine neuen Dateien.

### Geänderte Dateien

```
src/app/api/reporting/rentabilitaet/route.ts
  → Stage 3: 2 neue parallele Queries (bestand_sendungen, produktkosten_zeitraeume)
  → Stage 3b: Stückkosten-Lookup + Akkumulation in 3 neue EntityMaps
  → Stage 4: bestandKatTotal → catVals addieren
  → Stage 7: produkte-Feld in buildKategorie() befüllen

src/hooks/use-reporting-rentabilitaet.ts
  → Neuer Typ ReportProdukt (id, name, values, plattformen: ReportPlattform[])
  → ReportKategorie erhält: produkte: ReportProdukt[]

src/components/reporting-rentabilitaet-matrix.tsx
  → pushKategorie(): neuer Produkt-Ast nach den Gruppen
  → Neue Hilfsfunktion pushProdukt() analog zu pushPlattform()
  → collectAllExpandableIds(): Produkt-Zeilen berücksichtigen
```

---

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Identifikation „Produkt"-Kategorie | `name='Produkt'` in ausgaben_kosten (level=1) | Gleiche Konvention wie PROJ-16; kein neues Schema-Feld nötig |
| Bestandskosten zur catVals addieren | Ja, vor Stage 7 | Position- und Kategorie-Gesamtsumme enthält automatisch beide Quellen |
| Gruppen und Produkt-Zeilen nebeneinander | Ja (parallele Äste) | Kein Quellen-Split sichtbar; beide Drill-Down-Pfade vorhanden |
| Neuer Typ ReportProdukt vs. ReportBlatt wiederverwenden | Neuer Typ | Benötigt plattformen-Feld; ReportBlatt hat das nicht |
| Keine neuen Seiten | Korrekt | Reine Erweiterung bestehender Route + Komponente |
| Keine neuen DB-Tabellen | Korrekt | Alle Datenquellen (bestand_*, produktkosten_*) bereits vorhanden |

### Dependencies

Keine neuen Packages.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
