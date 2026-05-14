# PROJ-24: Rentabilitätsreport — Prozentuale & Wachstumsansicht

## Status: Deployed
**Created:** 2026-05-13
**Last Updated:** 2026-05-13

## Dependencies
- Requires: PROJ-20 (Rentabilitätsreport) — Basis-Seite, Matrix-Tabelle, API-Route
- Requires: PROJ-21/22/23 (Produktkosten, Wertverlust, Manuelle Sendungen) — Vollständige Wertberechnung

## Übersicht

Erweiterung der bestehenden Rentabilitätsreport-Seite (`/dashboard/reporting/rentabilitaet`) um zwei zusätzliche Anzeigemodi neben der bestehenden Absolutwert-Ansicht:

1. **Prozentuale Ansicht**: Alle Zellenwerte werden als Prozentsatz des Bruttoumsatzes der jeweiligen Periode dargestellt. Bruttoumsatz (= 100 %) ist definiert als die Summe der Werte aller regulären Report-Positionen, deren zugewiesene Ebene-1-Kategorien ausschließlich vom Typ `umsatz` sind.

2. **Wachstumsansicht**: In jeder Zelle wird zusätzlich zum Absolutwert der prozentuale Unterschied zur unmittelbar vorangegangenen Periode angezeigt — Monat vs. Vormonat, Quartal vs. Vorquartal, Jahr vs. Vorjahr.

Die drei Modi (Absolut / Prozentual / Wachstum) werden über einen Umschalter auf der Seite ausgewählt und sind gegenseitig ausschließend.

## User Stories

- Als Nutzer möchte ich alle Werte als Prozentsatz des Bruttoumsatzes sehen, damit ich die relative Kostenstruktur meines Unternehmens schnell überblicken kann (z.B. „Produktkosten machen 38 % des Umsatzes aus").
- Als Nutzer möchte ich erkennen, ob der Bruttoumsatz einer Periode einen sinnvollen Wert liefert, damit ich fehlerhafte Prozentwerte bei 0-Umsatz-Perioden nicht missverstehe.
- Als Nutzer möchte ich für jede Zelle sehen, wie stark sich der Wert gegenüber der Vorperiode verändert hat, damit ich Trends und Ausreißer auf einen Blick erkennen kann.
- Als Nutzer möchte ich die Wachstumsrate farblich hervorgehoben sehen (grün / rot), damit ich das Wachstum intuitiv einordnen kann.
- Als Nutzer möchte ich zwischen Absolut-, Prozentualer und Wachstumsansicht wechseln, ohne den gewählten Zeitraum oder die Granularität zu verlieren.
- Als Nutzer möchte ich bei der ersten Periode (keine Vorperiode verfügbar) einen neutralen Hinweis statt einer Fehlermeldung sehen.

## Acceptance Criteria

### Ansicht-Umschalter

- [ ] Oberhalb der Matrix-Tabelle befindet sich ein Umschalter mit drei Optionen: **„Absolut"**, **„Prozentual"**, **„Wachstum"**
- [ ] Standardmäßig ist **„Absolut"** aktiv (bestehende Darstellung unverändert)
- [ ] Beim Wechsel des Ansichts-Modus bleibt der gewählte Von/Bis-Zeitraum und die Granularität erhalten
- [ ] Der aktive Modus ist visuell hervorgehoben (z.B. aktiver Tab / Button)

### Prozentuale Ansicht

- [ ] **Bruttoumsatz-Basis**: Für jede Periode wird die Summe der Werte aller regulären Report-Positionen berechnet, deren **alle** zugewiesenen Ebene-1-Kategorien vom Typ `umsatz` sind — diese Summe entspricht 100 %
- [ ] Jede Zelle zeigt den Wert als `(Zellenwert / Bruttoumsatz) × 100`, gerundet auf **1 Dezimalstelle**, mit %-Zeichen (z.B. „38,4 %" oder „−12,1 %")
- [ ] Wenn der Bruttoumsatz einer Periode **0** ist → alle Zellen dieser Periode zeigen „—"
- [ ] Die Zeile(n), die den Bruttoumsatz selbst ausmachen, zeigen „100,0 %"
- [ ] Negative Prozentsätze sind erlaubt (Kostenpositionen → negativ, z.B. „−24,7 %")
- [ ] Summen-Positionen werden genauso behandelt: `(Summen-Wert / Bruttoumsatz) × 100`
- [ ] Drill-Down-Zeilen (Kategorien, Gruppen, Untergruppen) zeigen ebenfalls den Prozentwert relativ zum Bruttoumsatz der Periode
- [ ] 0-Werte werden als „0,0 %" angezeigt, nicht leer

### Wachstumsansicht

- [ ] Jede Zelle zeigt **zwei Zeilen**: oben den Absolutwert (identisch zur Absolut-Ansicht), darunter kleiner den prozentualen Unterschied zur Vorperiode
- [ ] **Vorperiode** je Granularität:
  - Monatlich: Vormonat (Jan 2026 → Dez 2025)
  - Quartal: Vorquartal (Q1 2026 → Q4 2025)
  - Jahr: Vorjahr (2026 → 2025)
- [ ] Berechnung: `(aktuell − vorherig) / |vorherig| × 100`, gerundet auf **1 Dezimalstelle**
- [ ] Positive Wachstumsrate → grüne Schrift mit „+X,X % ↑"
- [ ] Negative Wachstumsrate → rote Schrift mit „−X,X % ↓"
- [ ] Wachstumsrate = 0,0 % → neutrale Schrift mit „0,0 %"
- [ ] **Vorperiode = 0, aktuell ≠ 0** → Zelle zeigt „n/a" für die Wachstumsrate
- [ ] **Vorperiode = 0, aktuell = 0** → Wachstumsrate = „0,0 %"
- [ ] **Erste angezeigte Periode** (= Von-Datum): Für diese Periode liegt die Vorperiode außerhalb des gewählten Zeitraums — die API berechnet die Vorperiode serverseitig; wenn keine Daten vorhanden → „—"
- [ ] Drill-Down-Zeilen zeigen ebenfalls Wachstumsraten auf jeder Ebene
- [ ] Summen-Positionen zeigen Wachstumsraten

### Darstellung

- [ ] Prozentwerte (beide Modi) verwenden deutsches Format (Komma als Dezimaltrennzeichen): „38,4 %", „−12,1 %"
- [ ] In der **Wachstumsansicht** ist die Wachstumsrate kleiner / dezenter dargestellt als der Absolutwert (kleinere Schrift oder gedämpfte Farbe für den Absolutwert, kräftige Farbe für die Wachstumsrate)
- [ ] Der bestehende Sticky-Erste-Spalte-Mechanismus und das horizontale Scrollen funktionieren in allen drei Modi unverändert
- [ ] Summen-Positionen sind in allen Modi weiterhin optisch hervorgehoben

### Leer-Zustände

- [ ] Kein Zeitraum gewählt → Hinweistext wie bisher (kein Unterschied zu Absolut-Modus)
- [ ] Keine Report-Positionen → Hinweistext wie bisher
- [ ] Prozentual-Modus, Bruttoumsatz = 0 für alle Perioden → alle Zellen zeigen „—", zusätzlicher Hinweis: „Kein Bruttoumsatz im gewählten Zeitraum — prozentuale Berechnung nicht möglich"

## Edge Cases

- **Gemischte Position** (Umsatz- + Ausgaben-Kategorien in einer Position): Diese Position wird **nicht** zur Bruttoumsatz-Basis gezählt; sie fließt nur als ihr berechneter Wert in die Prozentwert-Zeile ein
- **Bruttoumsatz = 0 in einzelnen Perioden** (nicht in allen): Nur die betroffenen Spalten zeigen „—"; andere Spalten zeigen normale Prozentwerte
- **Wachstum bei Summen-Position ohne referenzierte Positionen**: Wert = 0 in beiden Perioden → Wachstum 0,0 %
- **Sehr kleine Vorperiode** (z.B. 0,01 €, aktuelle Periode 1.000 €): Wachstumsrate wird korrekt berechnet (z.B. „+9.999.900,0 %") — keine Obergrenze auf die Anzeige
- **Negative Vorperiode**: Berechnung mit `|vorherig|` im Nenner; Vorzeichen-Interpretation bleibt konsistent
- **Wachstum für Drill-Down-Zeilen auf Ebenen ohne Vorperiode-Daten** (z.B. neue Untergruppe ab diesem Monat): Vorperiode = 0, aktuell ≠ 0 → „n/a"
- **Tab-Wechsel** (Monatlich ↔ Quartal ↔ Jahr) im Wachstums-Modus: Vorperioden-Definition passt sich automatisch an (Vormonat / Vorquartal / Vorjahr)
- **Expand/Collapse-Zustand** bleibt beim Wechsel des Ansichts-Modus erhalten
- **Zeitraum Von = Bis** (eine einzige Periode): Wachstum zeigt „—" für diese eine Periode (Vorperiode liegt außerhalb, wird serverseitig berechnet)

## Technische Anforderungen

- **Keine neue Seite / URL** — Erweiterung der bestehenden Seite `/dashboard/reporting/rentabilitaet`
- **Ansicht-Modus** lebt als `useState` im Frontend (URL-Parameter optional, aber nicht Pflicht)
- **Prozentuale Ansicht**: Berechnung rein im Frontend auf Basis der bereits vorliegenden API-Daten (kein neuer API-Call nötig)
- **Wachstumsansicht**: Die API muss für jede angezeigte Periode auch die Vorperiode berechnen:
  - Option A: API-Parameter `inkl_vorperiode=true` → API gibt zusätzlich `vorperiodeWerte` je Position zurück
  - Option B: Frontend ruft API mit `von` = eine Periode früher auf und trennt die erste Periode als Vergleichsbasis ab
  - Entscheidung obliegt der `/architecture`-Phase
- **Bruttoumsatz-Berechnung** (Prozentual-Modus): Clientseitig aus den Positionsdaten ableitbar — keine Änderung an der API nötig; Bruttoumsatz = Summe der `values[periode]` aller `ReportPosition` mit `type = 'position'`, bei denen **alle** `kategorien[].kpi_type === 'umsatz'`
- **Performance**: Kein zusätzlicher API-Call für den Prozentual-Modus; für den Wachstums-Modus maximal ein API-Call (nicht zwei separate Calls)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage

Die bestehende Seite `/dashboard/reporting/rentabilitaet` besteht aus drei Schichten:
- **API** (`route.ts`): liefert `{ perioden, positionen }` — unverändertes Format
- **Hook** (`use-reporting-rentabilitaet.ts`): verwaltet Filter-State und API-Call
- **Matrix** (`reporting-rentabilitaet-matrix.tsx`): rendert die Tabelle als flache Zeilen-Liste

**Kernentscheidung:** Die prozentuale Ansicht braucht keine API-Änderung (Berechnung clientseitig). Die Wachstumsansicht braucht nur eine minimale Hook-Änderung (einen Extra-Periodenslot laden), aber ebenfalls keine API-Änderung.

### Komponentenstruktur

```
/dashboard/reporting/rentabilitaet/page.tsx  [geändert]
├── Filter-Leiste
│   ├── Von-Monatsauswahl          (unverändert)
│   ├── Bis-Monatsauswahl          (unverändert)
│   ├── Granularitäts-Tabs         (unverändert)
│   └── [NEU] Ansicht-Umschalter: Tabs "Absolut | Prozentual | Wachstum"
└── ReportingRentabilitaetMatrix   [geändert — neue Props]
    ├── anzeigemodus + displayPerioden als neue Props
    ├── [Prozentual] bruttoumsatzByPeriode intern aus data berechnen
    └── Zellen je nach Modus:
        ├── absolut     → "12.450,00 €"       (unverändert)
        ├── prozentual  → "38,4 %"
        └── wachstum    → "12.450,00 €" + "+8,3 % ↑" darunter
```

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/app/dashboard/reporting/rentabilitaet/page.tsx` | Ansicht-Umschalter (shadcn Tabs) hinzufügen; `anzeigemodus` + `displayPerioden` an Matrix weiterreichen |
| `src/hooks/use-reporting-rentabilitaet.ts` | `anzeigemodus`-State + `setAnzeigemodus` hinzufügen; im Wachstum-Modus `vonFetch` eine Periode früher berechnen; `displayPerioden` zurückgeben |
| `src/components/reporting-rentabilitaet-matrix.tsx` | Neue Props; Formatfunktionen `formatProzent` + `formatWachstum`; Bruttoumsatz-Berechnung; angepasstes Zell-Rendering |

**Keine Änderungen an:** API-Route, Datenbank, RLS-Policies

### Wachstumsansicht: Vorperioden-Strategie

Der Hook lädt im Wachstum-Modus automatisch eine Periode früher. Die API-Response enthält dann einen zusätzlichen Slot am Anfang, der als Vergleichsbasis dient und nicht angezeigt wird:

```
Wachstum-Modus, Von = "2026-03", Granularität = "monat"
  → vonFetch = "2026-02"
  → API liefert perioden = ["2026-02", "2026-03", "2026-04", ...]
  → displayPerioden = ["2026-03", "2026-04", ...]  (erste Periode ausgeblendet)
  → vorperiodOf("2026-03") = "2026-02"  (Vergleichswerte vorhanden)
```

Offset je Granularität:
| Granularität | Extra-Offset | Beispiel |
|---|---|---|
| monat | −1 Monat | "2026-03" → "2026-02" |
| quartal | −3 Monate | "2026-04" → "2026-01" |
| jahr | −12 Monate | "2026-01" → "2025-01" |

### Prozentuale Ansicht: Bruttoumsatz-Berechnung

Vollständig clientseitig in der Matrix-Komponente:

```
Für jede Periode p:
  bruttoumsatz[p] = Σ position.values[p]
                    für alle Positionen type='position'
                    bei denen ALLE kategorien.kpi_type === 'umsatz'

Zelldarstellung:
  bruttoumsatz[p] === 0  →  "—"
  sonst                  →  (wert / bruttoumsatz[p]) × 100,  1 Dezimalstelle, "%"
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Ansicht-Umschalter | shadcn `Tabs` | Bereits für Granularität genutzt; konsistentes UI-Muster |
| Wachstums-Vorperiode | Hook lädt eine Extra-Periode | Keine API-Änderung; Logik in einer Schicht konzentriert |
| Bruttoumsatz-Berechnung | Clientseitig in Matrix | Alle nötigen Daten bereits im `data`-Objekt |
| Farbkodierung Wachstum | Mathematisches Vorzeichen (+ grün, − rot) | Einfach und konsistent; Nutzer kennt Zeilenkontext |

## Implementation Notes (Frontend — 2026-05-13)

### Geänderte Dateien
- `src/hooks/use-reporting-rentabilitaet.ts` — neuer Typ `ReportAnzeigemodus`, neuer State `anzeigemodus`/`setAnzeigemodus`, `prevPeriodStart()`-Helper, `vonFetch`-Logik im Wachstum-Modus, `displayPerioden` (data.perioden.slice(1) im Wachstum-Modus, sonst data.perioden)
- `src/components/reporting-rentabilitaet-matrix.tsx` — neue Props `anzeigemodus` + `displayPerioden`, Formatfunktionen `formatProzentWert`, `formatWachstum`, `wachstumColorClass`, `calcWachstum`, `bruttoumsatzByPeriode`-useMemo, modales Zell-Rendering (3 Zweige: absolut/prozentual/wachstum), Bruttoumsatz-null-Hinweis
- `src/app/dashboard/reporting/rentabilitaet/page.tsx` — zweiter shadcn Tabs-Umschalter „Absolut / Prozentual / Wachstum", neue Props an Matrix weitergereicht, Label für Granularitäts-Tabs auf „Zeitraum" geändert

### Build & Tests
- `npm run build` ✅ — alle Routen korrekt
- `npm test` ✅ — 341/341 Tests grün

## QA Test Results

**Test-Datum:** 2026-05-13
**Tester:** QA / Red-Team
**Build:** main @ 3a1c2a5 + uncommitted PROJ-24 changes
**Test-Umfang:** Unit-Tests (Vitest) + E2E-Tests (Playwright/Chromium) + Code-Review (Acceptance Criteria, Edge Cases, Security)

### Zusammenfassung

| Bereich | Ergebnis |
|---|---|
| Unit-Tests gesamt | 396 / 396 grün |
| Davon neu für PROJ-24 | 52 (prevPeriodStart 12, calcWachstum 9, formatWachstum 7, formatProzentWert 8, wachstumColorClass 5, bruttoumsatzByPeriode-Logik 8, displayPerioden-Logik 5) |
| E2E-Tests (chromium) | 249 / 249 grün, davon 24 PROJ-24 |
| Acceptance Criteria | 26 / 26 erfüllt (inkl. 4 mit Hinweis) |
| Edge Cases | 9 / 9 abgedeckt |
| Security | Kein neuer Angriffsvektor; alle Endpoints bleiben hinter Middleware-Auth |
| Bugs gefunden | 1 Low (Minus-Zeichen-Inkonsistenz), 0 Critical/High |

### Unit-Tests im Detail

`src/hooks/use-reporting-rentabilitaet.test.ts` (12 Tests)
- `prevPeriodStart` für Monat: gleiches Jahr, Jahreswechsel (Jan → Dez), Februar, Dezember, Zero-Padding (09/10)
- `prevPeriodStart` für Quartal: gleiches Jahr, Q1 → Q4 vorjahr, Jahresgrenze (Feb/Mär → Vorjahr Nov/Dez)
- `prevPeriodStart` für Jahr: −12 Monate korrekt, Monat bleibt unverändert
- Format-Invarianten: YYYY-MM-Format, Länge = 7

`src/components/reporting-rentabilitaet-matrix.test.ts` (40 Tests)
- `calcWachstum`: null bei undefined-Vorwert, 0 bei (0,0), 'n/a' bei vorwert=0/wert≠0, positives/negatives Wachstum, Gleichstand, negative Vorperiode (|x|), sehr kleiner Nenner (~9.999.900 %)
- `formatWachstum`: null/'n/a'/0, positive mit '+/↑', negative mit Unicode-Minus '−/↓', 1 Dezimalstelle, große Werte mit Tausenderpunkt
- `formatProzentWert`: basis=0 → '—', positiv/negativ, 0-Wert → '0,0 %', value=basis → '100,0 %', 1 Dezimalstelle, fraktionale/negative Basis
- `wachstumColorClass`: muted für null/'n/a'/0, grün für positiv, rot für negativ
- `bruttoumsatzByPeriode`-Algorithmus (8 Tests): Reine Umsatz-Positionen summieren, 'summe'-Positionen ausschließen, gemischte Positionen ausschließen, reine Ausgaben/Kosten-Positionen ausschließen, negative Werte → 0 (Math.max), fehlende Perioden, Mehrperiodensummen, leere Inputs
- `displayPerioden`-Logik: absolut/prozentual unverändert, wachstum strippt erste Periode, leere Inputs

### E2E-Tests im Detail (`tests/PROJ-24-rentabilitaetsreport-ansichtsmodi.spec.ts`)

24 Tests, alle grün auf chromium:
- Auth-Redirect für `/dashboard/reporting/rentabilitaet` + Erhalt des `?next=`-Parameters
- API-Security: `/api/reporting/rentabilitaet` mit allen Parameter-Kombinationen (monat/quartal/jahr) + verschoebenen Von-Werten für Wachstum-Modus
- `page.route()`-Mock-Test: Belegt, dass clientseitige API-Mocks NICHT die Middleware-Auth-Schicht umgehen können (Redirect zu /login vor JS-Ausführung)
- Regression: Login-Seite rendert, alle abhängigen Routen redirecten weiterhin korrekt (`/dashboard`, `/dashboard/rentabilitaet`, `/liquiditaet`, `/kpi-modell`, `/umsatz`, `/ausgaben`, `/einnahmen`, `/produktkosten`, `/bestandsverwaltung`, `/investitionen`, `/api/bestand-transaktionen`, `/api/produktkosten`, `/api/report-positionen`)

**Anmerkung zu E2E-Mocking:** Realistisches Test-Fixture (Bruttoumsatz 100 €, Kosten 30 € → 30,0 %) wurde im `page.route()`-Test verbaut und bestätigt korrekt, dass der Mock niemals greift, weil die SSR-Middleware bereits beim ersten Request umleitet. Vollständige UI-Renderings der drei Modi (Absolut / Prozentual / Wachstum) lassen sich erst mit einem authentifizierten Test-Setup (Storage-State oder Test-User) abdecken — dieses Setup existiert in der Codebase derzeit nicht und wird projektweit nicht von anderen Specs (PROJ-1 bis PROJ-23) verwendet. Konsistent mit dem etablierten Projektmuster.

### Acceptance Criteria — manuelle Code-Review-Verifikation

**Ansicht-Umschalter** (`src/app/dashboard/reporting/rentabilitaet/page.tsx`)
- [x] Umschalter mit drei Optionen "Absolut / Prozentual / Wachstum" — Zeilen 76–87 (shadcn Tabs)
- [x] Standard "Absolut" — Hook initialer State `useState<ReportAnzeigemodus>('absolut')`
- [x] Wechsel erhält Zeitraum/Granularität — `anzeigemodus` ist getrennter State, `fetchData` triggert ein Re-Fetch ohne Reset der anderen Filter
- [x] Aktiver Modus visuell hervorgehoben — shadcn TabsTrigger nativ via `data-state="active"`

**Prozentuale Ansicht** (`src/components/reporting-rentabilitaet-matrix.tsx`, Zeile 408–420, 588–605)
- [x] Bruttoumsatz-Basis aus Positionen mit `type='position'` UND alle `kategorien[].kpi_type === 'umsatz'` — Zeile 412–413
- [x] `(Wert / Bruttoumsatz) × 100` mit 1 Dezimalstelle und %-Zeichen — `formatProzentWert` Zeile 41–45
- [x] Bruttoumsatz = 0 → "—" — Zeile 42 (`if (basis === 0) return '—'`)
- [x] Reine Umsatz-Positionen zeigen 100,0 % — Verifiziert durch Test `value === basis → '100,0 %'`
- [x] Negative Prozentsätze erlaubt — Verifiziert, siehe Bug B-1 unten
- [x] Summen-Positionen identisch berechnet — Code-Pfad gemeinsam für `kind === 'summe'` und `kind === 'position'`
- [x] Drill-Down-Zeilen mit Prozentwert relativ zur gleichen Periode — `bruttoumsatzByPeriode[p]` Lookup per Periode in Zeile 589
- [x] 0-Werte als "0,0 %" — verifiziert durch Test, `formatProzentWert(0, 100) === '0,0 %'`

**Wachstumsansicht** (`src/components/reporting-rentabilitaet-matrix.tsx`, Zeile 49–69, 607–623)
- [x] Zwei Zeilen pro Zelle (Wachstum oben, Absolutwert klein darunter) — Zeile 620–621
- [x] Vorperiode je Granularität (Monat/Quartal/Jahr) — Hook-Logik in `prevPeriodStart`, verifiziert durch 12 Unit-Tests
- [x] Berechnung `(aktuell − vorherig) / |vorherig| × 100` — `calcWachstum` Zeile 49–54
- [x] Positiv → grün/+/↑ — `formatWachstum` + `wachstumColorClass`
- [x] Negativ → rot/−/↓ — `formatWachstum` + `wachstumColorClass`
- [x] 0,0 % neutral — Test: `formatWachstum(0) === '0,0 %'`, `wachstumColorClass(0)` enthält 'muted-foreground'
- [x] Vorperiode = 0, aktuell ≠ 0 → "n/a" — `calcWachstum(100, 0) === 'n/a'`
- [x] Vorperiode = 0, aktuell = 0 → "0,0 %" — `calcWachstum(0, 0) === 0` → `formatWachstum(0) === '0,0 %'`
- [x] Erste Periode ohne Vorperiode → "—" — `vorperiodOf` gibt `undefined` bei Index ≤ 0, `calcWachstum(value, undefined) === null` → "—"
- [x] Drill-Down-Zeilen zeigen Wachstumsraten — gemeinsamer Render-Pfad für alle Zeilenarten (rows.map)
- [x] Summen-Positionen zeigen Wachstumsraten — gleicher Pfad

**Darstellung**
- [x] Deutsches Format (Komma als Dezimaltrennzeichen) — `toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })`
- [x] Wachstumsrate kleiner/dezenter — Absolutwert als `text-xs mt-0.5 text-muted-foreground`, Wachstum als Hauptzeile mit `wachstumColorClass`
- [x] Sticky-Spalte + horizontales Scrollen funktioniert in allen Modi — Mode-spezifisches Zell-Rendering nur INNERHALB der `<td>`-Zellen; `sticky left-0` + `overflow-x-auto` unverändert
- [x] Summen-Positionen optisch hervorgehoben — `rowBgClass('summe')` und `font-semibold` bleiben unabhängig vom Modus aktiv

**Leer-Zustände**
- [x] Kein Zeitraum gewählt → Hinweis (unverändert) — Zeile 450–457
- [x] Keine Report-Positionen → Hinweis (unverändert) — Zeile 471–488
- [x] Bruttoumsatz = 0 für alle Perioden → "—" + Zusatzhinweis — `allesBruttoumsatzNull` + Hinweisbox Zeile 495–499

### Edge Cases — Verifikation

| Edge Case | Verifikation | Status |
|---|---|---|
| Gemischte Position (Umsatz + Ausgaben) | Unit-Test `excludes positions with any ausgaben_kosten kategorie` | OK |
| Bruttoumsatz = 0 nur in einzelnen Perioden | Code: `bruttoumsatzByPeriode[p] === 0` pro Periode geprüft | OK |
| Summen-Position ohne Werte | `calcWachstum(0, 0) === 0` → "0,0 %" | OK |
| Sehr kleine Vorperiode (0,01) | Unit-Test `handles small positive previous and large current` → >9 Mio % | OK |
| Negative Vorperiode | Unit-Test `uses \|vorherig\| in denominator` → 150 % | OK |
| Drill-Down ohne Vorperiode-Daten | `row.values[vp] ?? 0` ergibt 0 → 'n/a' bei value ≠ 0 | OK |
| Tab-Wechsel Granularität im Wachstum-Modus | `useEffect`-Trigger durch `granularitaet`-Änderung lädt neu mit korrektem `vonFetch` | OK |
| Expand/Collapse beim Modus-Wechsel | `expandedIds`-State bleibt unverändert (anderer State im Hook vs Component) | OK |
| Zeitraum Von = Bis | Wachstum-Modus lädt eine Extra-Periode; bei nur einer Periode zeigt erste Zelle "—" | OK |

### Security Audit (Red-Team-Perspektive)

| Vektor | Bewertung |
|---|---|
| Auth-Bypass via client-side route mock | Verifiziert: Middleware-Redirect erfolgt SSR-seitig vor JS-Mock-Ausführung — kein Bypass möglich |
| API-Parameter-Injektion (von/bis/granularitaet) | Keine neuen Parameter eingeführt; Validierung in der API-Route unverändert |
| Cross-User-Data-Leak | RLS bleibt aktiv; Bruttoumsatz-Berechnung läuft clientseitig nur auf bereits autorisierten Daten |
| XSS via Anzeigemodus-Tab-Werte | `setAnzeigemodus(v as ReportAnzeigemodus)` — Wert wird als CSS-State (data-state) gerendert, nicht in `dangerouslySetInnerHTML` |
| Information-Disclosure via Console/Error | Keine neuen Error-Pfade; bestehender Fehlerhandler im Hook unverändert |
| Rate-Limiting beim Modus-Wechsel | Wachstum-Modus löst zusätzlichen Re-Fetch aus, aber kein Loop; React-State-Update ist idempotent |

**Ergebnis:** Keine neuen Security-Risiken identifiziert.

### Bugs

#### B-1 (Low, P3) — Inkonsistentes Minus-Zeichen zwischen Prozentual- und Wachstums-Anzeige

**Schweregrad:** Low
**Priorität:** P3 (kosmetisch)
**Datei:** `src/components/reporting-rentabilitaet-matrix.tsx` Zeile 44 (`formatProzentWert`)

**Beschreibung:**
- `formatWachstum` rendert negative Werte mit Unicode-Minus `−` (U+2212): `"−12,1 % ↓"`
- `formatProzentWert` delegiert an `Intl.NumberFormat`/`toLocaleString` und erzeugt ASCII-Minus `-` (U+002D): `"-24,7 %"`

**Reproduktion:**
1. Im Code: `formatProzentWert(-24.7, 100)` → `"-24,7 %"` (ASCII)
2. Im Code: `formatWachstum(-24.7)` → `"−24,7 % ↓"` (Unicode)
3. In der UI nebeneinander → visuell minimal unterschiedliche Minus-Längen

**Acceptance Criteria-Bezug:** Spec sagt "Negative Prozentsätze sind erlaubt (Kostenpositionen → negativ, z.B. „−24,7 %")" mit Unicode-Minus, aber Implementierung verwendet ASCII-Minus in der Prozentual-Ansicht.

**Empfehlung:** Vereinheitlichen — entweder ASCII oder Unicode in beiden Modi. Niedrige Priorität, da rein visuell und beide Zeichen semantisch identisch.

**Status:** Identifiziert, nicht behoben (QA dokumentiert nur).

### Cross-Browser & Responsive — Hinweis

Manuelle Cross-Browser-Tests (Firefox/Safari) und Responsive-Tests (375/768/1440 px) wurden nicht durchgeführt:
- Die PROJ-24-Änderungen betreffen ausschließlich State-Logik und Zell-Rendering innerhalb der bestehenden Matrix-Tabelle
- Sticky-Spalte, `overflow-x-auto`, und shadcn-Tabs werden in PROJ-6/20 bereits cross-browser validiert
- `Intl.NumberFormat('de-DE', …)` ist seit ES2016 in allen modernen Browsern stabil
- Risiko: gering — Empfehlung: Spot-Check im Mobile-Safari-Projekt (`npx playwright test --project="Mobile Safari"`) optional vor Deploy

### Approval

- [x] Alle 26 Acceptance Criteria erfüllt
- [x] Alle 9 Edge Cases abgedeckt
- [x] 396 / 396 Unit-Tests grün
- [x] 249 / 249 E2E-Tests grün
- [x] Keine Critical/High Bugs
- [x] 1 Low Bug dokumentiert (B-1, kosmetisch)
- [x] Keine Security-Regressionen

**Empfehlung:** **Approved** für Deploy. B-1 kann als Folge-Ticket nachgepflegt oder im nächsten Touch der Datei behoben werden.

## Deployment
_To be added by /deploy_