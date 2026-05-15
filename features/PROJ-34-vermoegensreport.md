# PROJ-34: Vermögensreport

## Status: Planned
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-32 (Vermögenswerte-Verwaltung) — Datengrundlage (Snapshots mit Lager-, Transit-, Verbindlichkeits-, Forderungs-, Cash- und Anlagevermögensdaten)
- Requires: PROJ-17 (Bestandsverwaltung) — Sendungsdaten je Produkt für Lagerreichweite-Berechnung
- Requires: PROJ-16 (Produktkosten-Verwaltung) — Produktkosten je Produkt für Lagerreichweite-Berechnung

## Übersicht

Ein neuer Report „Vermögensbericht" unter `/dashboard/reporting/vermoegen` im Reporting-Bereich. Der Report nutzt die periodischen Stichtagssnapshots aus der Vermögenswerte-Verwaltung (PROJ-32) als Datengrundlage und berechnet daraus betriebswirtschaftliche Kennzahlen in drei Bereichen:

- **Waren-KPIs** — Warenkapital, Lageranteil, Warenkapitalbindung, Warenbindungsquote, Lagerreichweite
- **Liquiditäts-KPIs** — Working Capital, Liquiditätsgrade (Cash Ratio, Quick Ratio, Current Ratio)
- **Vermögens-KPIs** — Eigenkapital, Fremdkapital, Gesamtvermögen, EK-/FK-/Cash-Quote

Der Report zeigt primär die KPIs des neuesten Snapshots (aktuelle Lage), ergänzt durch Zeitreihen-Liniendiagramme für ausgewählte KPIs über alle verfügbaren Snapshots.

## Berechnungsgrundlagen

### Basisgrößen je Snapshot (aus PROJ-32 Tabellen)

| Variable | Quelle | Berechnung |
|----------|--------|------------|
| Lager | `vermoegenswarte_lagerwerte` | Σ `lagerwert` aller Produkte dieses Snapshots |
| Transit | `vermoegenswarte_transitwerte` | Σ `transitwert` aller Produkte dieses Snapshots |
| Warenkapital | — | Lager + Transit |
| Gesamt-Forderungen | `vermoegenswarte_forderungen` | Σ `betrag` aller Einträge dieses Snapshots |
| VerbLL | `vermoegenswarte_snapshots.verbindlichkeiten_llv` | direkt |
| VerbSonstige | `vermoegenswarte_snapshots.verbindlichkeiten_sonstige` | direkt |
| Darlehen | `vermoegenswarte_snapshots.darlehensvb` | direkt |
| Cash | `vermoegenswarte_snapshots.cash_bestand` | direkt |
| Anlagevermögen | `vermoegenswarte_snapshots.anlagevermoegen` | direkt |

### Waren-KPI-Formeln

| KPI | Formel |
|-----|--------|
| Warenkapital | Lager + Transit |
| Lager-Anteil | Lager / Warenkapital |
| Warenkapitalbindung | Warenkapital − VerbLL |
| Warenbindungsquote | Warenkapitalbindung / (Warenkapital + Gesamt-Forderungen + Cash − VerbLL − VerbSonstige) |
| Lagerreichweite | Warenkapital / Σ(Ø-Monatssendungen_Produkt × Produktkosten_Produkt) |

**Lagerreichweite — Detailberechnung (serverseitig):**
- Für jeden Snapshot-Stichtag: Sendungen je Produkt in den 3 Kalendermonaten vor dem Stichtag aus `bestand_sendungen` + `bestand_transaktionen`
- Ø-Monatssendungen_Produkt = Σ(Sendungen je Produkt in 3 Monaten) / 3 (in Stück)
- Produktkosten zum Stichtag: gültiger Zeitraum aus `produktkosten_zeitraeume` (`gueltig_von ≤ Stichtag` UND `gueltig_bis ≥ Stichtag` ODER `gueltig_bis IS NULL`); Summe aller `produktkosten_werte.wert` dieses Zeitraums
- Lagerreichweite = Warenkapital / Σ(Ø-Monatssendungen_Produkt × Produktkosten_Produkt)
- Wenn ein Produkt keine Produktkosten hat: wird im Nenner mit 0 gewertet (ignoriert)
- Einheit: Monate (numerisch, 1 Dezimalstelle)

### Liquiditäts-KPI-Formeln

| KPI | Formel |
|-----|--------|
| Working Capital | Warenkapital + Cash + Gesamt-Forderungen − VerbLL − VerbSonstige |
| Cash Ratio (Grad 1) | Cash / (VerbLL + VerbSonstige) |
| Quick Ratio (Grad 2) | (Cash + Gesamt-Forderungen) / (VerbLL + VerbSonstige) |
| Current Ratio (Grad 3) | (Cash + Gesamt-Forderungen + Warenkapital) / (VerbLL + VerbSonstige) |

**Ampel-Richtwerte (international anerkannte Benchmarks):**
| KPI | Grün | Gelb | Rot |
|-----|------|------|-----|
| Cash Ratio | ≥ 0,20 | 0,10 – 0,19 | < 0,10 |
| Quick Ratio | ≥ 1,00 | 0,70 – 0,99 | < 0,70 |
| Current Ratio | ≥ 2,00 | 1,00 – 1,99 | < 1,00 |

### Vermögens-KPI-Formeln

| KPI | Formel |
|-----|--------|
| Eigenkapital (EK) | Warenkapital + Gesamt-Forderungen + Cash + Anlagevermögen |
| Fremdkapital (FK) | VerbLL + VerbSonstige + Darlehen |
| Gesamtvermögen | EK + FK |
| EK-Quote | EK / Gesamtvermögen |
| FK-Quote | FK / Gesamtvermögen |
| Cash-Quote | Cash / Gesamtvermögen |

**Ampel-Richtwert EK-Quote:** ≥ 30% grün / 15–29% gelb / < 15% rot

## User Stories

- Als Controlling-Mitarbeiter möchte ich auf einen Blick sehen, wie hoch unser aktuelles Warenkapital und unsere Lagerreichweite sind, damit ich sofort erkennen kann, ob ausreichend Ware im System ist.
- Als Controlling-Mitarbeiter möchte ich die Liquiditätsgrade (Cash Ratio, Quick Ratio, Current Ratio) mit Ampel-Bewertungen sehen, damit ich ohne Fachkenntnisse einschätzen kann, ob die Liquiditätslage kritisch ist.
- Als Controlling-Mitarbeiter möchte ich das Verhältnis von Eigen- zu Fremdkapital als Prozentwerte sehen, damit ich die Finanzierungsstruktur des Unternehmens auf Knopfdruck verstehe.
- Als Controlling-Mitarbeiter möchte ich die Entwicklung der Liquiditätsgrade über alle erfassten Stichtage als Liniendiagramm sehen, damit ich Trends frühzeitig erkenne.
- Als Controlling-Mitarbeiter möchte ich die Entwicklung von Eigen- und Fremdkapital über die Zeit als Liniendiagramm sehen, damit ich die Finanzierungsstruktur im Zeitverlauf nachvollziehen kann.
- Als Controlling-Mitarbeiter möchte ich klare Benchmark-Richtwerte (Ampel-System) für die Liquiditätsgrade sehen, damit ich ohne Fachwissen beurteilen kann, ob ein Wert gut oder kritisch ist.
- Als Controlling-Mitarbeiter möchte ich zwischen den drei KPI-Bereichen (Waren, Liquidität, Vermögen) über Tabs wechseln können, damit die Oberfläche übersichtlich bleibt.
- Als Controlling-Mitarbeiter möchte ich bei fehlendem Snapshot einen klaren Hinweis erhalten, damit ich weiß, dass ich zuerst einen Vermögenswert-Snapshot anlegen muss.

## Acceptance Criteria

### Seite & Navigation

- [ ] Neue Seite unter `/dashboard/reporting/vermoegen` erreichbar
- [ ] Navigationseintrag „Vermögensbericht" unter der Gruppe „Reporting" im NavSheet
- [ ] Seite nur für eingeloggte Nutzer zugänglich (Redirect zu `/login` wenn nicht eingeloggt)

### Allgemeines Layout

- [ ] Seite zeigt im Header: Titel „Vermögensbericht" und Stichtagsanzeige des neuesten Snapshots (z. B. „Stand: 15.05.2026")
- [ ] Drei Tabs: „Waren-KPIs", „Liquiditäts-KPIs", „Vermögens-KPIs"
- [ ] Kein Snapshot vorhanden: Leerzustand mit Hinweistext „Noch kein Snapshot vorhanden. Erfassen Sie zuerst Vermögenswerte." und Link zu `/dashboard/vermoegenswerte`
- [ ] Alle KPI-Berechnungen basieren auf dem neuesten Snapshot (nach `datum DESC LIMIT 1`)
- [ ] Für Zeitreihendiagramme werden alle verfügbaren Snapshots verwendet (nach `datum ASC`)
- [ ] Kennzahlen-Kacheln: einheitliches Layout (Titel, Hauptwert, Unterzeile mit Kontextinfo)

### Tab 1 — Waren-KPIs

#### Kennzahlen-Kacheln

- [ ] **Warenkapital**: Lager + Transit. Format: € (de-DE). Kachel zeigt Hauptwert (Warenkapital) und darunter zwei Zeilen „Lager: X €" und „Transit: X €"
- [ ] **Lager-Anteil**: Lager / Warenkapital. Format: %, 1 Dezimalstelle. Wenn Warenkapital = 0: „—"
- [ ] **Warenkapitalbindung**: Warenkapital − VerbLL. Format: € (de-DE). Wert negativ → rote Darstellung (`text-destructive`)
- [ ] **Warenbindungsquote**: Warenkapitalbindung / (Warenkapital + Gesamt-Forderungen + Cash − VerbLL − VerbSonstige). Format: %, 1 Dezimalstelle. Wenn Nenner = 0: „—"
- [ ] **Lagerreichweite**: Warenkapital / Σ(Ø-Monatssendungen_Produkt × Produktkosten_Produkt). Format: „X,X Monate". Wenn keine Bestandsdaten oder Nenner = 0: „—"

#### Zeitreihen-Diagramme

- [ ] Diagramm „Warenkapital-Entwicklung": drei Linien (Lager, Transit, Warenkapital gesamt) je Stichtag. Y-Achse: €, X-Achse: Datum. Tooltip bei Hover: Datum + alle drei Werte
- [ ] Diagramm „Warenbindungsquote-Entwicklung": eine Linie (Quote in %). Y-Achse: %, X-Achse: Datum
- [ ] Weniger als 2 Snapshots: beide Diagramme ausgeblendet, Hinweis „Für Zeitreihen sind mindestens 2 Snapshots erforderlich"

### Tab 2 — Liquiditäts-KPIs

#### Kennzahlen-Kacheln

- [ ] **Working Capital**: Warenkapital + Cash + Gesamt-Forderungen − VerbLL − VerbSonstige. Format: € (de-DE). Wert negativ → rote Darstellung
- [ ] **Cash Ratio (Grad 1)**: Cash / (VerbLL + VerbSonstige). Format: Ratio mit 2 Dezimalstellen (z. B. „0,23"). Ampel-Badge (grün/gelb/rot) nach obiger Tabelle. Richtwert-Unterzeile: „Richtwert: ≥ 0,20". Wenn Nenner = 0: „—"
- [ ] **Quick Ratio (Grad 2)**: (Cash + Gesamt-Forderungen) / (VerbLL + VerbSonstige). Format: 2 Dezimalstellen. Ampel-Badge. Richtwert: „Richtwert: ≥ 1,00". Wenn Nenner = 0: „—"
- [ ] **Current Ratio (Grad 3)**: (Cash + Gesamt-Forderungen + Warenkapital) / (VerbLL + VerbSonstige). Format: 2 Dezimalstellen. Ampel-Badge. Richtwert: „Richtwert: ≥ 2,00". Wenn Nenner = 0: „—"
- [ ] Ampel wird als farbiger Badge neben oder unter dem Hauptwert angezeigt (grün = „Gut", gelb = „Akzeptabel", rot = „Kritisch")

#### Zeitreihen-Diagramme

- [ ] Diagramm „Liquiditätsgrade-Entwicklung": drei Linien (Cash Ratio, Quick Ratio, Current Ratio) je Stichtag. Gestrichelte Referenzlinien: Cash Ratio bei 0,20; Quick Ratio bei 1,00; Current Ratio bei 2,00. Tooltip: alle drei Werte + Datum
- [ ] Diagramm „Working Capital-Entwicklung": eine Linie (€) je Stichtag
- [ ] Weniger als 2 Snapshots: Hinweis wie Tab 1

### Tab 3 — Vermögens-KPIs

#### Kennzahlen-Kacheln

- [ ] **Eigenkapital (EK)**: Warenkapital + Gesamt-Forderungen + Cash + Anlagevermögen. Format: € (de-DE)
- [ ] **Fremdkapital (FK)**: VerbLL + VerbSonstige + Darlehen. Format: € (de-DE)
- [ ] **Gesamtvermögen**: EK + FK. Format: € (de-DE)
- [ ] **EK-Quote**: EK / Gesamtvermögen. Format: %, 1 Dezimalstelle. Ampel-Badge nach obiger Tabelle. Richtwert-Unterzeile: „Richtwert: ≥ 30%". Wenn Gesamtvermögen = 0: „—"
- [ ] **FK-Quote**: FK / Gesamtvermögen. Format: %, 1 Dezimalstelle. Kein Ampel-Badge
- [ ] **Cash-Quote**: Cash / Gesamtvermögen. Format: %, 1 Dezimalstelle. Kein Ampel-Badge
- [ ] Visueller EK/FK-Progress-Bar: horizontaler Balken (EK-Anteil grün, FK-Anteil rot), Legende „EK X% | FK Y%"

#### Zeitreihen-Diagramme

- [ ] Diagramm „Vermögensentwicklung": zwei Linien (EK und FK) je Stichtag in €. Tooltip: EK, FK, Gesamtvermögen, EK-Quote
- [ ] Diagramm „EK-Quote-Entwicklung": eine Linie (%) je Stichtag. Gestrichelte Referenzlinie bei 30%
- [ ] Weniger als 2 Snapshots: Hinweis wie Tab 1

## Edge Cases

- Kein Snapshot vorhanden: Leerzustand mit Hinweistext und Link zur Vermögenswerte-Seite — keine KPI-Kacheln angezeigt
- Nur ein Snapshot vorhanden: KPI-Kacheln werden angezeigt, Zeitreihendiagramme zeigen Hinweis „Mindestens 2 Snapshots für Zeitreihe erforderlich"
- Warenkapital = 0: Lager-Anteil, Warenbindungsquote und Lagerreichweite → „—"; Working Capital und andere KPIs weiterhin berechnet
- VerbLL + VerbSonstige = 0: Alle drei Liquiditätsgrade → „—" (Division durch Null)
- Gesamtvermögen = 0: EK-Quote, FK-Quote, Cash-Quote → „—"; Progress-Bar ausgeblendet
- Keine Sendungsdaten für letzten 3 Monate vor Stichtag: Lagerreichweite → „—" (Tooltip: „Keine Sendungsdaten der letzten 3 Monate vorhanden")
- Keine Produktkosten zum Stichtag: Lagerreichweite → „—"
- Produkt ohne Produktkosten bei mehreren Produkten: dieses Produkt im Lagerreichweite-Nenner ignoriert (kein Fehler); Rest der Berechnung normal
- Cash-Bestand negativ (Kontoüberziehung): fließt mit negativem Vorzeichen in alle Formeln ein; Cash-Wert in Kachel rot dargestellt
- Working Capital negativ: Wert angezeigt, rot markiert
- Sehr viele Snapshots (> 24): Zeitreihendiagramme zeigen alle Snapshots; X-Achsen-Labels ggf. rotiert oder ausgedünnt

## Technical Requirements

### API-Route

```
GET /api/reporting/vermoegen
```

Antwort-Shape:
```typescript
{
  latest: VermoegenKPIs | null,  // null wenn kein Snapshot vorhanden
  series: VermoegenKPIs[]         // alle Snapshots, aufsteigend nach datum
}

type VermoegenKPIs = {
  datum: string                   // YYYY-MM-DD
  lager: number
  transit: number
  warenkapital: number
  gesamt_forderungen: number
  verb_ll: number
  verb_sonstige: number
  darlehen: number
  cash: number
  anlagevermoegen: number
  // Waren-KPIs
  lager_anteil: number | null
  warenkapitalbindung: number
  warenbindungsquote: number | null
  lagerreichweite: number | null
  // Liquiditäts-KPIs
  working_capital: number
  cash_ratio: number | null
  quick_ratio: number | null
  current_ratio: number | null
  // Vermögens-KPIs
  eigenkapital: number
  fremdkapital: number
  gesamtvermoegen: number
  ek_quote: number | null
  fk_quote: number | null
  cash_quote: number | null
}
```

### Berechnungen (serverseitig)

Alle Basis-Aggregationen via Supabase-Joins:
- `vermoegenswarte_snapshots` JOIN `vermoegenswarte_lagerwerte` (GROUP BY snapshot: Σ lagerwert)
- `vermoegenswarte_snapshots` JOIN `vermoegenswarte_transitwerte` (GROUP BY snapshot: Σ transitwert)
- `vermoegenswarte_snapshots` JOIN `vermoegenswarte_forderungen` (GROUP BY snapshot: Σ betrag)

Für Lagerreichweite (serverseitig, parallele Queries):
- `bestand_transaktionen` + `bestand_sendungen`: Sendungen je Produkt in 3 Monaten vor Stichtag
- `produktkosten_zeitraeume` + `produktkosten_werte`: gültige Produktkosten zum Stichtag

Alle abgeleiteten KPIs werden in der API-Route aus den Basisgrößen berechnet (keine clientseitige Berechnung).

### Sicherheit & Auth

- `requireAuth()` auf der Route (identisch zu anderen Reporting-Routen)
- Keine neuen Datenbanktabellen oder Migrations nötig — ausschließlich lesende Queries auf bestehende Tabellen
- Keine Zod-Input-Validierung nötig (kein Query-Parameter, rein lesend)

### Performance

- Alle Snapshot-Daten in einem API-Call laden (parallel Queries via `Promise.all`)
- Lagerreichweite-Berechnung: alle relevanten Monate für alle Snapshots in möglichst wenigen Queries (nicht N+1 je Snapshot)

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `src/app/dashboard/reporting/vermoegen/page.tsx` | Hauptseite mit Tab-Navigation |
| `src/components/reporting-vermoegen-waren.tsx` | Tab 1: Waren-KPI-Kacheln + Diagramme |
| `src/components/reporting-vermoegen-liquiditaet.tsx` | Tab 2: Liquiditäts-KPI-Kacheln + Diagramme |
| `src/components/reporting-vermoegen-bilanzkennzahlen.tsx` | Tab 3: Vermögens-KPI-Kacheln + Diagramme |
| `src/hooks/use-reporting-vermoegen.ts` | Hook: GET /api/reporting/vermoegen |
| `src/app/api/reporting/vermoegen/route.ts` | API-Handler + Berechnungslogik |
| `src/app/api/reporting/vermoegen/route.test.ts` | Vitest Unit-Tests |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/nav-sheet.tsx` | Eintrag „Vermögensbericht" unter Reporting-Gruppe hinzufügen |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
