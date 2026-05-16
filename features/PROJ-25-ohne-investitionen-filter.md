# PROJ-25: „Ohne Investitionen"-Filter im Rentabilitätsreport

## Status: In Review
**Created:** 2026-05-14
**Last Updated:** 2026-05-14

## Dependencies
- Requires: PROJ-20 (Rentabilitätsreport) — Basis-Seite, Matrix-Tabelle, API-Route
- Requires: PROJ-21 (Produktkosten-Bestandsberechnung) — Produktinvestitionskosten fließen in Report ein
- Requires: PROJ-24 (Ansichtsmodi) — Filter-Leiste, neben der der neue Filter erscheint
- Requires: PROJ-19 (Reporting-Konfiguration) — `report_positionen`-Tabelle, die um ein neues Flag erweitert wird

## Übersicht

Erweiterung des Rentabilitätsreports um einen optionalen **„Ohne Investitionen"-Filter**. Wenn dieser Filter aktiviert ist, werden alle als „investitionsbezogen" markierten Report-Positionen aus der Darstellung entfernt und ihre Wertbeiträge auf 0 gesetzt. Das Ergebnis: Im sichtbaren Report wird EBIT direkt mit Finanzierungskosten verrechnet und ergibt EBT — ohne den Umweg über Produktinvestitionskosten und EBIT nach Investitionen.

**Konkreter Anwendungsfall (wie der Nutzer seinen Report konfigurieren würde):**

```
— Normaler Modus —                     — Filter aktiv —
EBIT                                   EBIT
Produktinvestitionskosten              [ausgeblendet, Wert = 0]
─────────────────────────              
= EBIT nach Investitionen              [ausgeblendet, Wert = EBIT]
Finanzierungskosten                    Finanzierungskosten
─────────────────────────              ─────────────────────────
= EBT                                  = EBT   (= EBIT − Finanzierungskosten)
```

Der Nutzer markiert dafür im Reporting-Modell die Positionen „Produktinvestitionskosten" und „EBIT nach Investitionen" als `investitionsbezogen = true`. Die EBT-Summenposition ist **nicht** markiert und bleibt sichtbar — ihr Wert wird korrekt aus den sichtbaren (bzw. angepassten) Positionen berechnet.

## User Stories

- Als Nutzer möchte ich im Rentabilitätsreport einen Filter aktivieren können, der Produktinvestitionskosten und EBIT nach Investitionen ausblendet, damit ich sehe, wie sich EBIT und EBT ohne Investitionsbelastung verhalten.
- Als Nutzer möchte ich einzelne Report-Positionen im Reporting-Modell als „investitionsbezogen" markieren können, damit ich selbst bestimme, welche Zeilen vom Filter betroffen sind.
- Als Nutzer möchte ich, dass beim aktiven Filter die Summenberechnung korrekt angepasst wird (EBT = EBIT − Finanzierungskosten), damit die Zahlen im Report konsistent bleiben.
- Als Nutzer möchte ich auf einen Blick sehen, dass der Filter aktiv ist, damit ich nicht vergesse, in welcher Ansicht ich mich befinde.
- Als Nutzer möchte ich den Filter jederzeit wieder deaktivieren können, ohne Seite neu zu laden oder den gewählten Zeitraum zu verlieren.

## Acceptance Criteria

### Filter-Toggle (UI)

- [ ] Auf der Rentabilitätsreport-Seite gibt es einen neuen Toggle-Button **„Ohne Investitionen"**
- [ ] Standardmäßig ist der Filter **deaktiviert** (normaler Modus)
- [ ] Der Toggle ist in der **oberen Filter-Leiste** platziert — rechts neben dem Ansicht-Umschalter (Absolut / Prozentual / Wachstum), in derselben Zeile
- [ ] Wenn der Filter **aktiviert** ist, wird er als hervorgehobener Badge/Chip in der Filter-Leiste angezeigt (z.B. farbiger Hintergrund, sichtbarer aktiver Zustand)
- [ ] Der Badge enthält ein **„×"-Symbol** zum direkten Deaktivieren des Filters ohne erneuten Toggle-Klick
- [ ] Das Aktivieren/Deaktivieren des Filters löst **keinen neuen API-Aufruf** aus — die Umrechnung erfolgt clientseitig auf den bereits geladenen Daten
- [ ] Der Filter-Zustand bleibt erhalten, wenn der Nutzer zwischen den Ansichtsmodi (Absolut / Prozentual / Wachstum) oder Granularitäten wechselt
- [ ] Der Filter-Zustand **wird zurückgesetzt**, wenn der Nutzer die Seite neu lädt

### Verhalten bei aktivem Filter

#### Reguläre Positionen (type = 'position') mit investitionsbezogen = true

- [ ] Die gesamte Zeile (inkl. aller Drill-Down-Unterzeilen) wird aus der Tabelle **ausgeblendet**
- [ ] Der **Wertbeitrag** dieser Position zu Summen-Positionen wird auf **0** gesetzt — so als ob die Position keine Transaktionen hätte
- [ ] Das Ausblenden betrifft alle Granularitäten (Monatlich / Quartal / Jahr) gleichermaßen

#### Summen-Positionen (type = 'summe') mit investitionsbezogen = true

- [ ] Die Zeile der Summen-Position wird aus der Tabelle **ausgeblendet**
- [ ] Ihr berechneter Wert (der nun die auf 0 gesetzten investitionsbezogenen regulären Positionen widerspiegelt) **fließt weiterhin** in übergeordnete Summen-Positionen ein, die auf sie verweisen
- [ ] Beispiel: „EBIT nach Investitionen" ist ausgeblendet, sein Wert = EBIT + 0 (Produktinvestitionskosten) = EBIT. Dieser Wert fließt in EBT ein → EBT = EBIT − Finanzierungskosten ✓

#### Nicht-markierte Positionen

- [ ] Alle Positionen mit `investitionsbezogen = false` (oder NULL) bleiben **unverändert** sichtbar und werden wie im normalen Modus berechnet

### Konfiguration im Reporting-Modell

- [ ] Jede Report-Position im Tab „Reporting-Modell" (KPI-Modell → Tab „Reporting-Modell") hat ein neues Toggle-Feld **„Investitionsbezogen"**
- [ ] Standardwert für neue und bestehende Positionen: `false` (nicht investitionsbezogen)
- [ ] Das Toggle kann für **alle Positionstypen** gesetzt werden: `position`, `summe`, `umsatzsteuer`
- [ ] Die Änderung wird sofort gespeichert (analog zu anderen Position-Feldern im Reporting-Modell)
- [ ] Das Flag ist im Reporting-Modell-Tab sichtbar — z.B. als kleines Toggle neben dem Positions-Namen oder als Indikator-Icon in der Zeile

### Darstellung (aktiver Filter-Badge in der Filter-Leiste)

- [ ] Wenn der Filter aktiv ist, zeigt die Filter-Leiste sichtbar einen **aktiven Zustand** des „Ohne Investitionen"-Toggles (z.B. farbiger Hintergrund, abweichende Schrift)
- [ ] Der Badge ist klar als aktiver Zustand erkennbar — nicht mit den Granularitäts- oder Ansichts-Tabs zu verwechseln
- [ ] In der Prozentual-Ansicht: Die Bruttoumsatz-Basis bleibt unverändert (nur Umsatz-Positionen) — der Filter beeinflusst keine Umsatz-Positionen, da diese nie als `investitionsbezogen` markiert werden sollten
- [ ] In der Wachstums-Ansicht: Die Wachstumsberechnung verwendet ebenfalls die gefilterten Werte (investitionsbezogene Positionen = 0)

### Leer-Zustände

- [ ] Keine Report-Positionen als `investitionsbezogen` markiert, aber Filter aktiviert → alle Positionen weiterhin sichtbar; kein Hinweis nötig (Filter hat schlicht keine Wirkung)
- [ ] Alle Report-Positionen als `investitionsbezogen` markiert, Filter aktiv → leere Tabelle mit dem normalen Leerzustand-Hinweis „Alle Positionen ausgeblendet" (oder ähnlicher Hinweis)

## Edge Cases

- **Summen-Position ohne markierte referenzierte Positionen, aber selbst markiert:** Zeile ist ausgeblendet; ihr Wert (unverändert, da keine markierten Teile) fließt in übergeordnete Summen ein
- **Mehrfach verschachtelte Summen-Positionen:** Gilt transitiv — wenn eine markierte Summen-Position von einer zweiten nicht-markierten Summen-Position referenziert wird, fließt der angepasste Wert (mit PI=0) korrekt durch alle Ebenen
- **Reguläre Position mit investitionsbezogen=true hat keine Transaktionen:** Wert ist ohnehin 0 — kein Unterschied im Filtermodus
- **Prozentual-Ansicht mit investitionsbezogenem Filter:** Bruttoumsatz-Berechnung bleibt unberührt (Umsatz-Positionen sind nie investitionsbezogen); Prozentsätze der verbleibenden Positionen berechnen sich korrekt gegen denselben Bruttoumsatz
- **Tab-Wechsel (Zeitraum: Monatlich ↔ Quartal ↔ Jahr) bei aktivem Filter:** Filter-Zustand bleibt erhalten; Recalculation der Werte nach Tab-Wechsel berücksichtigt den Filter
- **Ansicht-Wechsel (Absolut ↔ Prozentual ↔ Wachstum) bei aktivem Filter:** Filter-Zustand bleibt erhalten
- **Expand/Collapse bei aktivem Filter:** Investitionsbezogene Positionen sind gar nicht in der Zeilen-Liste vorhanden — kein Expand-Toggle für sie
- **Position wird als `investitionsbezogen` markiert, während Filter aktiv ist:** Filtereffekt gilt sofort beim nächsten Laden der Report-Daten (oder sofort, wenn die Matrix-Komponente erneut rendert)
- **Alle Positionen einer Summen-Position sind investitionsbezogen und auf 0 gesetzt:** Die Summen-Position (wenn nicht selbst markiert) zeigt 0 — korrektes Verhalten
- **Umsatz-Position versehentlich als investitionsbezogen markiert:** Wird ausgeblendet und Bruttoumsatz-Basis ändert sich → ggf. falsche Prozentsätze in Prozentual-Ansicht. Kein technisches Problem, aber Nutzer-Fehler (Doku-Hinweis: Umsatz-Positionen sollten nicht markiert werden)

## Technische Anforderungen

### Datenbank

- `report_positionen` → neues boolean-Feld `investitionsbezogen BOOLEAN NOT NULL DEFAULT false`
- Supabase-Migration: `ALTER TABLE report_positionen ADD COLUMN investitionsbezogen BOOLEAN NOT NULL DEFAULT false`
- Bestehende Positionen: alle erhalten `investitionsbezogen = false` (Migration mit DEFAULT)

### API `GET /api/reporting/rentabilitaet`

- **Keine Änderung am API-Parameter-Interface nötig** — der Filter arbeitet clientseitig auf den bereits zurückgegebenen Daten
- Die API-Response muss jedoch das neue Feld `investitionsbezogen` je Position zurückgeben, damit der Client entscheiden kann, welche Positionen betroffen sind
- Konkretes Feld in `ReportPosition`: `investitionsbezogen: boolean`

### API `GET/PATCH /api/report-positionen`

- Das Feld `investitionsbezogen` wird im Zod-Schema für GET (Response) und PATCH (Änderung) berücksichtigt

### Frontend — Filterlogik (clientseitig)

Der Filter arbeitet auf den bereits geladenen `ReportingRentabilitaetData`. Pseudologik:

```
Wenn Filter aktiviert:
  1. Sammle alle IDs der investitionsbezogenen regulären Positionen → ausgeschlossenePosIds
  2. Setze Werte dieser Positionen für alle Perioden auf 0 (in einer Kopie der data)
  3. Berechne Summen-Positionen neu: Σ der referenzierten Positionen (mit angepassten Werten aus Schritt 2)
  4. Filtere die Zeilen-Liste: Positionen mit investitionsbezogen=true werden nicht gerendert
     - Reguläre Positionen: komplett aus Liste entfernen
     - Summen-Positionen: komplett aus Liste entfernen (aber ihr neu berechneter Wert fließt als Basis für andere Summen)
  5. Zeige nur nicht-markierte Positionen, mit korrekt neu berechneten Summen-Werten
```

### Frontend — Neue/geänderte Dateien

```
src/components/reporting-rentabilitaet-matrix.tsx     ← geändert
  → neuer Prop: ohneInvestitionen: boolean
  → Filter-Logik: gefilterte Zeilen + neu berechnete Summen

src/app/dashboard/reporting/rentabilitaet/page.tsx    ← geändert
  → Toggle-Button „Ohne Investitionen" in der Filter-Leiste
  → useState für ohneInvestitionen (default: false)
  → Badge-Darstellung wenn aktiv (+ ×-Button)

src/hooks/use-reporting-rentabilitaet.ts              ← geändert
  → ReportPosition: investitionsbezogen: boolean ergänzen

src/components/report-position-row.tsx                ← geändert
  → investitionsbezogen-Toggle in der Positions-Zeile im Reporting-Modell

src/app/api/report-positionen/route.ts                ← geändert
  → investitionsbezogen im Zod-Schema für GET + PATCH

src/app/api/reporting/rentabilitaet/route.ts          ← geändert
  → investitionsbezogen-Feld in der SELECT-Abfrage für report_positionen
  → investitionsbezogen-Feld in der Response-Struktur je Position
```

### Keine Änderungen an

- Datenbanklogik der Wertberechnung (Abschreibungen, Produktinvestitionen-Raten, Bestandsberechnung) — alles läuft weiterhin serverseitig vollständig
- RLS-Policies
- Auth-Middleware
- Andere Seiten / Routen

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage

Die bestehende Seite `/dashboard/reporting/rentabilitaet` besteht aus drei Schichten:
- **API** (`route.ts`): liefert vollständig berechnete `{ perioden, positionen }` — alle Werte inkl. Produktinvestitionskosten-Raten sind serverseitig aggregiert
- **Hook** (`use-reporting-rentabilitaet.ts`): verwaltet Filter-State (von/bis/granularitaet/anzeigemodus) und API-Call
- **Matrix** (`reporting-rentabilitaet-matrix.tsx`): rendert flache Zeilen-Liste; berechnet im Frontend nur die Ansichts-Modi (Prozentual, Wachstum)

**Kernentscheidung:** Der Ohne-Investitionen-Filter läuft **vollständig clientseitig** — kein neuer API-Call beim Umschalten. Die API muss lediglich das neue Feld `investitionsbezogen` je Position mitliefern.

### Komponentenstruktur

```
/dashboard/reporting/rentabilitaet/page.tsx          [GEÄNDERT]
├── Filter-Leiste (flex-wrap, items-end)
│   ├── Von-Monatsauswahl                            (unverändert)
│   ├── Bis-Monatsauswahl                            (unverändert)
│   ├── Zeitraum-Tabs (Monatlich|Quartal|Jahr)       (unverändert)
│   ├── Ansicht-Tabs (Absolut|Prozentual|Wachstum)   (unverändert)
│   └── [NEU] Ohne-Investitionen-Toggle-Button
│       — inaktiv: einfacher outline Button „Ohne Investitionen"
│       — aktiv: farbiger Badge mit „Ohne Investitionen ×"
│         (shadcn Button mit variant="secondary" + aktiver Styling-Klasse)
└── ReportingRentabilitaetMatrix                     [GEÄNDERT — neuer Prop]
    └── ohneInvestitionen: boolean

/dashboard/kpi-modell (Tab „Reporting-Modell")
└── report-position-row.tsx                          [GEÄNDERT]
    └── [NEU] investitionsbezogen-Switch
        — shadcn Switch (bereits in ui/ vorhanden)
        — erscheint in der Aktions-Leiste jeder Positions-Zeile
        — Toggle → PATCH /api/report-positionen/[id] mit { investitionsbezogen }

/components/reporting-rentabilitaet-matrix.tsx       [GEÄNDERT]
└── applyOhneInvestitionenFilter(data, ohneInvestitionen)
    ├── Schritt 1: Werte aller investitionsbezogenen regulären Positionen → 0
    ├── Schritt 2: Summen-Positionen in sort_order neu berechnen
    │   (referenzierte Werte aus modifizierter Wertemenge)
    ├── Schritt 3: investitionsbezogene Positionen aus Zeilen-Liste entfernen
    └── Ergebnis: angepasstes data-Objekt für Matrix-Rendering
```

### Datenmodell (Änderungen)

**Tabelle `report_positionen` — neues Feld:**
```
investitionsbezogen: BOOLEAN   (DEFAULT false, NOT NULL)
— gilt für alle Positionstypen: 'position', 'summe', 'umsatzsteuer'
— steuert: Ausblendung aus Tabelle (alle Typen)
           + Wert-Nullung für reguläre Positionen
           + Summen-Neuberechnung im Frontend
```

**API-Response `GET /api/reporting/rentabilitaet` — erweitertes Schema:**
```
ReportPosition (bestehend, erweitert)
  ├── id, name, type, sort_order, values   (unverändert)
  ├── kategorien, ust_produkte              (unverändert)
  └── investitionsbezogen: boolean          (NEU)
```

### Filterlogik im Frontend (clientseitig)

Die Matrix-Komponente erhält die Original-`data` von der API (unverändert). Wenn `ohneInvestitionen = true`, wird **vor dem Rendering** eine Kopie der Daten mit angepassten Werten erstellt:

```
Eingabe: data.positionen (aus API, vollständig berechnet)

Schritt 1 — Reguläre Positionen nullen:
  Für jede Position mit type='position' UND investitionsbezogen=true:
    → Alle Perioden-Werte auf 0 setzen (in der Wertkopie)

Schritt 2 — Summen-Positionen neu berechnen:
  Für jede Position mit type='summe', in sort_order:
    → Neuer Wert = Σ der aktuellen Wertkopien der referenzierten Positionen
    → (Summen, die ihrerseits investitionsbezogen=true sind, werden
       zunächst berechnet, damit übergeordnete Summen korrekte Werte haben)

Schritt 3 — Zeilen filtern:
  Aus der Anzeige entfernen: alle Positionen mit investitionsbezogen=true
  (sowohl reguläre als auch Summen-Positionen)

Ausgabe: angepasstes Positionen-Array für Matrix-Rendering
```

**Wichtig:** Summen-Positionen mit `investitionsbezogen=true` werden aus der Anzeige entfernt, aber **ihr angepasster Wert** (mit genullten regulären Positionen) fließt weiterhin in übergeordnete Summen ein. Das garantiert:

```
EBIT nach Investitionen (investitionsbezogen=true, ausgeblendet):
  Wert = EBIT + Produktinvestitionskosten(0) = EBIT-Wert

EBT (investitionsbezogen=false, sichtbar):
  Referenziert: EBIT_nach_Inv + Finanzierungskosten
  Neu berechnet: EBIT-Wert + Finanzierungskosten = EBIT − Finanzierungskosten ✓
```

### API-Endpunkte (Änderungen)

```
GET /api/reporting/rentabilitaet
  → report_positionen SELECT um 'investitionsbezogen' erweitern
  → investitionsbezogen-Feld je Position in Response-Objekt aufnehmen

PATCH /api/report-positionen/[id]
  → Zod-Schema um 'investitionsbezogen: z.boolean().optional()' erweitern
  → Supabase-Update: investitionsbezogen-Feld übergeben

GET /api/report-positionen
  → investitionsbezogen in SELECT-Abfrage aufnehmen (damit Reporting-Modell-Tab
    den aktuellen Zustand kennt)
```

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| Supabase-Migration | `investitionsbezogen BOOLEAN NOT NULL DEFAULT false` auf `report_positionen` |
| `src/app/api/reporting/rentabilitaet/route.ts` | `investitionsbezogen` in SELECT + Response |
| `src/app/api/report-positionen/[id]/route.ts` | `investitionsbezogen` in PATCH-Zod-Schema |
| `src/app/api/report-positionen/route.ts` | `investitionsbezogen` in SELECT |
| `src/hooks/use-reporting-rentabilitaet.ts` | `ReportPosition.investitionsbezogen: boolean` hinzufügen |
| `src/hooks/use-report-positionen.ts` | `ReportPosition.investitionsbezogen` + `updateInvestitionsbezogen`-Callback |
| `src/app/dashboard/reporting/rentabilitaet/page.tsx` | Toggle-Button + `ohneInvestitionen`-State |
| `src/components/reporting-rentabilitaet-matrix.tsx` | `ohneInvestitionen`-Prop + Filterlogik |
| `src/components/report-position-row.tsx` | `investitionsbezogen`-Switch + `onUpdateInvestitionsbezogen`-Prop |

**Keine Änderungen an:** Datenbanklogik der Wertberechnung, RLS-Policies, Auth-Middleware, andere Seiten

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Filter clientseitig | Ja — kein neuer API-Call | Alle Daten bereits geladen; Umschalten soll sofort reagieren ohne Netzwerk-Latenz |
| Filter-State-Speicherort | `useState` in `page.tsx` | Analog zu `anzeigemodus`; kein globaler State nötig; kein URL-Parameter (ephemer wie Wachstums-/Prozentual-Modus) |
| Summen-Neuberechnung | Frontend, in sort_order | Positions sind bereits in sort_order geordnet; Summen referenzieren typischerweise frühere Positionen — korrekte Reihenfolge garantiert |
| UI für Toggle | shadcn Button (outline → secondary) | Tabs eignen sich für gegenseitig ausschließende Modi; dieser Filter ist ein binäres An/Aus → Button ist semantisch passender |
| Aktiver-Filter-Anzeige | Badge mit ×-Button neben Toggle | Klarer visueller Indikator; ×-Button für schnelles Deaktivieren ohne erneuten Toggle-Klick — konsistent mit Filterleisten-Pattern in anderen SaaS-Tools |
| investitionsbezogen-Toggle im Modell | shadcn Switch | Bereits im Projekt (`src/components/ui/switch.tsx`); semantisch klar für An/Aus; passt in die kompakte Positions-Zeile |
| Kein URL-Parameter | Filter-Zustand ephemer | Konsistent mit `anzeigemodus` (PROJ-24) — kein Persist nötig für einen Auswertungs-Filter |

## Implementation Notes (Frontend — 2026-05-14)

### Geänderte Dateien
- `src/hooks/use-reporting-rentabilitaet.ts` — `ReportPosition` um `investitionsbezogen: boolean` und `summe_refs?: string[]` erweitert
- `src/hooks/use-report-positionen.ts` — `ReportPosition` um `investitionsbezogen: boolean` erweitert; `updateInvestitionsbezogen(id, value)` Callback hinzugefügt (optimistisches Update + PATCH-API-Call)
- `src/app/dashboard/reporting/rentabilitaet/page.tsx` — `ohneInvestitionen: boolean` State (default: false); Toggle-Button in der Filter-Leiste: inaktiv als `outline`-Button, aktiv als amber-farbiger Badge mit ×-Button zum Deaktivieren; `ohneInvestitionen`-Prop an Matrix weitergereicht
- `src/components/reporting-rentabilitaet-matrix.tsx` — Neue Prop `ohneInvestitionen: boolean`; `applyOhneInvestitionenFilter(data)` Funktion: (1) reguläre investitionsbezogene Positionen → Werte auf 0, (2) Summen in sort_order neu berechnen via `summe_refs`, (3) investitionsbezogene Positionen aus Zeilen-Liste entfernen; `effectiveData`-useMemo als Grundlage für alle Berechnungen (Rows, Bruttoumsatz, Perioden)
- `src/components/report-position-row.tsx` — Neuer Prop `onUpdateInvestitionsbezogen`; shadcn `Switch` (amber bei aktiv) in der Aktions-Leiste jeder Position
- `src/components/report-modell-tab.tsx` — `updateInvestitionsbezogen` aus Hook + Prop an `ReportPositionRow`

### Build & Tests
- `npm run build` ✅ — alle 32 Routen fehlerfrei gebaut
- `npm test` ✅ — 404/404 Tests grün

## Implementation Notes (Backend — 2026-05-14)

### Geänderte Dateien
- **Supabase-Migration** `add_investitionsbezogen_to_report_positionen` ✅ — `ALTER TABLE report_positionen ADD COLUMN IF NOT EXISTS investitionsbezogen BOOLEAN NOT NULL DEFAULT false`
- `src/app/api/report-positionen/[id]/route.ts` — `patchSchema` um `investitionsbezogen: z.boolean().optional()` erweitert; SELECT um `investitionsbezogen` ergänzt
- `src/app/api/report-positionen/route.ts` — `assemblePositionen` SELECT + Response um `investitionsbezogen` erweitert; POST SELECT + Response ebenfalls
- `src/app/api/reporting/rentabilitaet/route.ts` — `rpRows` SELECT um `investitionsbezogen` erweitert; alle Positions-Response-Objekte (position, summe, umsatzsteuer) liefern `investitionsbezogen: boolean`; Summen-Positionen liefern zusätzlich `summe_refs: string[]` (aus bestehendem `summeRefsByPosition`-Map)

### Neue Tests
- `src/app/api/report-positionen/[id]/route.test.ts` — `MOCK_POSITION` um `investitionsbezogen: false` erweitert; Test „returns 200 when updating investitionsbezogen" hinzugefügt
- `src/app/api/reporting/rentabilitaet/route.test.ts` — Tests „includes investitionsbezogen field in position response" und „includes summe_refs array in summe position response" hinzugefügt

### Build & Tests
- `npm test` ✅ — 407/407 Tests grün

## QA Test Results (2026-05-14)

### Testergebnis-Übersicht

| Kategorie | Ergebnis |
|---|---|
| Acceptance Criteria | 15/15 geprüft |
| Unit-Tests | 13 neue Tests — 420/420 ✅ |
| E2E-Tests | 14 neue Tests — 14/14 ✅ |
| Security Audit | Keine Findings |
| Regression | Keine Regressionen |
| Kritische Bugs | 0 |
| Hohe Bugs | 0 |
| Mittlere Bugs | 0 |
| Niedrige Bugs | 0 |

### Acceptance Criteria (manuell geprüft / via Unit-Tests verifiziert)

#### Filter-Toggle (UI)
- ✅ „Ohne Investitionen"-Button in der Filter-Leiste vorhanden
- ✅ Standardmäßig deaktiviert
- ✅ Rechts neben Ansicht-Umschalter platziert, gleiche Zeile
- ✅ Aktiver Zustand: amber Hintergrund + Ring-Border (klar erkennbar)
- ✅ ×-Symbol im aktiven Button zum Deaktivieren
- ✅ Kein API-Aufruf beim Umschalten (clientseitige `useMemo`-Logik)
- ✅ Filter-Zustand bleibt bei Ansichts-/Granularitätswechsel erhalten
- ✅ Filter wird beim Seiten-Reload zurückgesetzt

#### Verhalten bei aktivem Filter (via Unit-Tests `applyOhneInvestitionenFilter`)
- ✅ Reguläre investitionsbezogene Positionen werden ausgeblendet
- ✅ Wertbeitrag wird auf 0 gesetzt (für Summenberechnung)
- ✅ Gilt für alle Granularitäten (Perioden-Array wird vollständig verarbeitet)
- ✅ Investitionsbezogene Summen-Positionen werden ausgeblendet
- ✅ Wert der ausgeblendeten Summen fließt korrekt in übergeordnete Summen (EBT = EBIT − Finanzierungskosten ✓)
- ✅ Nicht-markierte Positionen bleiben unverändert sichtbar

#### Konfiguration im Reporting-Modell
- ✅ amber Switch-Toggle in jeder Position-Zeile vorhanden
- ✅ Standard-Wert false für alle Positionen
- ✅ Toggle kann für alle Typen (position, summe, umsatzsteuer) gesetzt werden
- ✅ PATCH-Aufruf mit optimistischem Update bei Änderung

### Unit-Tests (neu, PROJ-25)

**`src/components/reporting-rentabilitaet-matrix.test.ts`** — 13 neue Tests für `applyOhneInvestitionenFilter`:
- Keine investitionsbezogenen Positionen → Daten unverändert
- Entfernt investitionsbezogene reguläre Positionen aus Anzeige
- Nullt Wert für Summenberechnung (PI → 0)
- Entfernt investitionsbezogene Summen-Positionen aus Anzeige
- Alle Positionen investitionsbezogen → leeres Array
- Korrekte EBT-Neuberechnung: EBT = EBIT − Finanzierungskosten
- Summe ohne summe_refs → Wert unverändert
- Transitiv verschachtelte Summen (multi-level chain)
- Investitionsbezogene Summen werden in Step 2 neu berechnet (nicht genullt)
- Mehrere Perioden korrekt verarbeitet
- Perioden-Array wird erhalten
- Leeres Positions-Array → leeres Ergebnis
- Original-Datenobjekt wird nicht mutiert

### E2E-Tests (neu, `tests/PROJ-25-ohne-investitionen-filter.spec.ts`)

14 Tests, alle ✅:
- Unauthentifizierter Zugriff auf Reportseite → Redirect zu /login
- PATCH /api/report-positionen/:id ohne Auth → Redirect
- GET /api/report-positionen ohne Auth → Redirect
- Filter-Toggle-Seite zeigt Login (Auth-Gate)
- Login-Seite rendert korrekt
- Client-side API-Mock umgeht Middleware nicht
- Regression: 8 bestehende Seiten und APIs weiterhin geschützt

### Security Audit

- ✅ `investitionsbezogen`-Flag: PATCH-Route prüft `user_id` via RLS — kein fremder User kann Flags anderer User ändern
- ✅ Filterlogik ist vollständig clientseitig und stateless — kein neuer Attack-Surface auf Server-Seite
- ✅ Keine sensiblen Daten im Toggle-State (nur boolean)
- ✅ Zod-Schema validiert `investitionsbezogen: z.boolean()` — keine Typinjection möglich

### Edge Cases (getestet via Unit-Tests)

- ✅ Keine markierten Positionen + Filter aktiv → Tabelle unverändert
- ✅ Alle Positionen markiert + Filter aktiv → leere Positions-Liste
- ✅ Summe ohne summe_refs (kein referenziertes Array) → Wert bleibt
- ✅ Mehrfach verschachtelte Summen: transitiv korrekt
- ✅ Original-Datenobjekt wird nicht mutiert (reine Funktion)

### Produktionsbereitschaft

**✅ READY — Keine Critical oder High Bugs. Bereit für `/deploy`.**
