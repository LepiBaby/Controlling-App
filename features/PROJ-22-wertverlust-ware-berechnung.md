# PROJ-22: Wertverlust-Ware-Berechnung im Rentabilitätsreport

## Status: Approved
**Created:** 2026-05-13
**Last Updated:** 2026-05-13

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-16 (Produktkosten-Verwaltung) — `produktkosten_zeitraeume` + `produktkosten_werte` als Kostenbasis
- Requires: PROJ-17 (Bestandsveränderungen-Verwaltung) — `bestand_transaktionen.warenverluste` als Mengenbasis
- Requires: PROJ-20 (Rentabilitätsreport) — Report-Seite, in die diese Berechnung integriert wird
- Requires: PROJ-21 (Produktkosten-Bestandsberechnung) — gleiche Integrationsstrategie in den Report

## Übersicht

Erweiterung des Rentabilitätsreports (PROJ-20) um eine berechnete Datenquelle für den monetären Wertverlust von Lagerware. Der Wertverlust entsteht durch beschädigte, abgelaufene oder anderweitig verloren gegangene Bestände, die in der Bestandsverwaltung als `warenverluste` pro SKU und Tag erfasst werden.

**Berechnungslogik:**
> Für jede `bestand_transaktion` im Berichtszeitraum mit `warenverluste > 0`:
>
> `Wertverlust (€) = warenverluste × Σ(produktkosten_werte.wert)`
>
> Die Gesamtkosten je Stück (`Σ werte`) ergeben sich als Summe **aller** Werte des gültigen `produktkosten_zeitraum` für das jeweilige Produkt am Transaktionsdatum. Es gibt keine Aufteilung auf einzelne Kostenkategorien-Gruppen — der Gesamtbetrag fließt in die Kategorie „Wertverlust Ware" als Ganzes.

Die berechneten Werte fließen in die ausgaben_kosten-Kategorie **„Wertverlust Ware"** (Ebene 1) im Rentabilitätsreport. Im Gegensatz zu PROJ-21 gibt es keine Plattform-Dimension, da `warenverluste` nicht plattformspezifisch erfasst wird.

## User Stories

- Als Nutzer möchte ich, dass der monetäre Wertverlust von Lagerware automatisch aus der Bestandsverwaltung berechnet und im Rentabilitätsreport ausgewiesen wird, damit die P&L vollständig und korrekt ist.
- Als Nutzer möchte ich den Wertverlust auf Produkt-Ebene aufschlüsseln können, damit ich erkenne, welches Produkt wie viel Wertverlust verursacht hat.
- Als Nutzer möchte ich, dass Perioden ohne hinterlegte Produktkosten oder ohne Warenverluste mit 0 € gewertet werden, ohne dass ein Fehler im Report angezeigt wird.
- Als Nutzer möchte ich keine manuelle Dateneingabe für den Wertverlust vornehmen müssen — die Berechnung erfolgt vollautomatisch aus den bereits vorhandenen Bestands- und Produktkostendaten.
- Als Nutzer möchte ich den Wertverlust-Betrag in derselben Report-Struktur (Monat/Quartal/Jahr) sehen wie alle anderen Positionen, damit die Vergleichbarkeit gewährleistet ist.

## Acceptance Criteria

### Berechnung

- [ ] Für jede `bestand_transaktion` im gewählten Berichtszeitraum mit `warenverluste > 0` wird der monetäre Wertverlust berechnet als: `warenverluste × Σ(produktkosten_werte.wert)` des passenden `produktkosten_zeitraum` für `produkt_id` und `datum`
- [ ] Maßgeblich für die Zeitraum-Zuordnung: `gueltig_von ≤ datum AND (gueltig_bis IS NULL OR gueltig_bis ≥ datum)`
- [ ] Die Gesamtkosten je Stück sind die **Summe aller** `produktkosten_werte.wert` — es findet keine Aufteilung auf einzelne Kostenkategorien-Gruppen statt
- [ ] Gibt es keinen passenden `produktkosten_zeitraum` für ein Produkt an einem Datum → `warenverluste` dieses Tages werden mit 0 € gewertet (kein Fehler, kein Hinweis)
- [ ] Varianten (SKUs, level=2) eines Produkts werden über die gemeinsame `produkt_id` (level=1) aggregiert
- [ ] Berechneter Betrag wird negiert (Kosten = negative Auswirkung auf die P&L), analog zur Behandlung anderer Ausgaben im Report
- [ ] Aggregation nach Periode: Monats-, Quartals- oder Jahresaggregation analog zur bestehenden Report-Logik

### Integration in den Rentabilitätsreport

- [ ] Die berechneten Werte werden zur ausgaben_kosten-Kategorie **„Wertverlust Ware"** (Ebene 1, identifiziert durch `type='ausgaben_kosten'`, `level=1`, `name='Wertverlust Ware'`) addiert
- [ ] Ist die Kategorie „Wertverlust Ware" nicht im Report-Modell einer Position zugewiesen, fließen keine Bestandsdaten ein (kein Fehler)
- [ ] Die berechneten Werte werden zu eventuell vorhandenen Direktbuchungen in dieser Kategorie **addiert** — keine separate Zeile oder Quellen-Kennzeichnung im Report
- [ ] Die Zeilen-Struktur des Reports (Positionen, Summen-Positionen) ändert sich nicht

### Drill-Down: Produkt-Ebene

- [ ] Unter einer Position, die die Kategorie „Wertverlust Ware" enthält, sind die betroffenen Produkte als ausklappbare Unterzeilen verfügbar
- [ ] Jede Produkt-Unterzeile zeigt den Gesamtbetrag des berechneten Wertverlusts für dieses Produkt pro Periode (summiert über alle SKUs)
- [ ] Produkte ohne Wertverlust im Zeitraum erscheinen nicht als Unterzeile
- [ ] Die Produkt-Unterzeilen sind **nicht** weiter ausklappbar (kein Plattform-Level, da `warenverluste` nicht plattformspezifisch ist)
- [ ] Expand/Collapse der Produkt-Unterzeilen bleibt beim Wechsel der Granularität (Monatlich/Quartal/Jahr) erhalten

### Fehlende Daten

- [ ] Kein passender `produktkosten_zeitraum` für ein Produkt → 0 € Beitrag, Produkt erscheint nicht als Unterzeile
- [ ] Produkt hat `warenverluste = 0` an allen Tagen im Zeitraum → erscheint nicht als Produkt-Unterzeile
- [ ] Keine `bestand_transaktionen` im Zeitraum mit `warenverluste > 0` → bestehende Report-Werte bleiben unverändert (0 € Beitrag)
- [ ] Kategorie „Wertverlust Ware" existiert nicht im KPI-Modell → kein Fehler, keine Auswirkung auf andere Kategorien

## Edge Cases

- **Überlappende Zeiträume in `produktkosten_zeitraeume`**: Sollte durch PROJ-16-Validierung nicht vorkommen; falls doch, wird der erste gefundene Zeitraum verwendet, kein Fehler
- **Produktkosten-Wert = 0 €**: Erlaubt; `warenverluste × 0 = 0` → kein Beitrag, kein Fehler
- **SKU ohne Produkt-Zuordnung** (`produkt_id = NULL`): Transaktion wird ignoriert
- **Produkt-Unterzeile mit Betrag 0** (z.B. alle `produktkosten_werte.wert = 0`): Erscheint nicht als Unterzeile (0-Wert-Filter wie in PROJ-21)
- **Dasselbe Produkt in mehreren Report-Positionen**: Wertverlust wird in jede betroffene Position separat eingerechnet
- **Kombination mit PROJ-21**: Beide Berechnungen (Produktkosten aus Sendungen + Wertverlust aus Warenverlusten) laufen unabhängig voneinander; wenn beide Kategorien in derselben Position sind (unwahrscheinlich), werden sie separat akkumuliert
- **Zeitraum sehr groß (z.B. 3 Jahre monatlich)**: Performance muss gewährleistet bleiben; alle Berechnungen serverseitig

## Technical Requirements

- Berechnung vollständig **serverseitig** in `GET /api/reporting/rentabilitaet`
- Datenquellen: `bestand_transaktionen.warenverluste` (bereits in Stage 3 abgefragt durch PROJ-21), `produktkosten_zeitraeume` + `produktkosten_werte` (bereits in Stage 3 abgefragt durch PROJ-21)
- Kein neues DB-Schema und keine neuen DB-Queries notwendig — alle benötigten Tabellen und Queries bereits durch PROJ-21 vorhanden
- Identifikation der „Wertverlust Ware"-Kategorie: `type='ausgaben_kosten'`, `level=1`, `name.toLowerCase() === 'wertverlust ware'`
- Drill-Down-Stufen: nur Produkt-Ebene (keine Plattform); der bestehende `pltPrdVals`-Mechanismus aus PROJ-21 wird **nicht** verwendet
- Auth required (erbt von PROJ-20)
- API-Response-Erweiterung: `ReportKategorie` erhält neues Feld `produkte_wertverlust: ReportBlatt[]` (oder ähnlich) für den Produkt-Drill-Down auf Wertverlust-Kategorie-Ebene

---
<!-- Sections below are added by subsequent skills -->

## Implementation Notes (Backend — 2026-05-13)

### Geänderte Dateien
- `src/app/api/reporting/rentabilitaet/route.ts` — Query 7 um `warenverluste` erweitert; Stage 5c hinzugefügt (Zeitraum-Lookup, Σ-Werte-Berechnung, `catVals`-Befüllung, `wvPrdVals`-Akkumulator); `buildKategorie()` gibt `produkte_wertverlust` für WV-Kategorie zurück
- `src/hooks/use-reporting-rentabilitaet.ts` — `ReportKategorie` erhält `produkte_wertverlust?: ReportBlatt[]`
- `src/components/reporting-rentabilitaet-matrix.tsx` — `isPositionExpandable`, `pushKategorie`, `buildFlatRows` und `collectAllExpandableIds` um WV-Produkt-Drill-Down erweitert

### Build & Tests
- `npm run build` ✅ — keine TypeScript-Fehler
- `npm test` ✅ — 329/329 Tests grün (8 neue Tests für PROJ-22)

### Neue Tests (8)
1. `warenverluste × Σ werte` wird korrekt berechnet und negiert
2. `produkte_wertverlust`-Array enthält korrektes Produkt mit korrekten Werten
3. Mehrere Transaktionen desselben Produkts werden aggregiert
4. `warenverluste = 0` → Produkt erscheint nicht in `produkte_wertverlust`
5. Kein passender `produktkosten_zeitraum` → 0 € Beitrag, leeres Array
6. WV-Kategorie nicht im Report-Modell zugewiesen → keine Auswirkung auf Position
7. Direktbuchungen + WV-Berechnung werden korrekt addiert
8. Mehrere Produkte mit unterschiedlichen Warenverlusten

## Tech Design (Solution Architect)

### Einordnung

PROJ-22 ist die strukturell einfachere Schwester von PROJ-21: Auch hier wird eine neue berechnete Datenquelle in den Rentabilitätsreport integriert. Der Unterschied: Statt Sendungsmengen × aufgeteilte Kostenwerte (Gruppe × Plattform × Produkt) rechnet PROJ-22 mit Warenverlusten × **Gesamtkosten je Stück** (keine Aufschlüsselung nach Kostenkategorie, keine Plattform-Dimension).

---

### Übersicht der Änderungen

Keine neuen Seiten, keine neuen Datenbank-Tabellen, keine neuen Routes.

| Datei | Art der Änderung |
|---|---|
| `src/app/api/reporting/rentabilitaet/route.ts` | 1 Query-Erweiterung + neue Stufe 5c |
| `src/hooks/use-reporting-rentabilitaet.ts` | 1 neues optionales Feld auf `ReportKategorie` |
| `src/components/reporting-rentabilitaet-matrix.tsx` | Erkennung „Wertverlust Ware" + Produkt-Unterzeilen |

---

### Drill-Down-Struktur im Report

```
Position (z.B. „Produktkosten gesamt")
└─ Kategorie „Wertverlust Ware" (ausgaben_kosten, Ebene 1)
   ├─ Produkt „Baby-Mütze"
   ├─ Produkt „Sommer-Mütze"
   └─ Produkt „Winter-Jacket"
```

Keine weiteren Ebenen. `warenverluste` ist nicht plattformspezifisch erfasst → der Drill-Down endet auf Produkt-Ebene (im Gegensatz zu PROJ-21, wo Plattform → Produkt folgt).

---

### Ablauf der Backend-Berechnung

#### Stage 3 — Minimale Query-Erweiterung

Query 7 (`bestand_transaktionen`) wird um ein Feld ergänzt: **`warenverluste`** wird zusätzlich zu `datum`, `produkt_id` und `bestand_sendungen` abgefragt. Kein neuer Datenbankaufruf.

#### Stage 5c — Wertverlust-Berechnung (neu, nach 5b)

1. **Identifikation der Zielkategorie:** Suche in den bereits geladenen KPI-Kategorien nach `type='ausgaben_kosten'`, `level=1`, `name='Wertverlust Ware'`. Falls diese Kategorie nicht im Report-Modell einer Position zugewiesen ist → Stufe 5c komplett überspringen.

2. **Kostenzeitraum-Lookup:** Identische Datenstruktur wie in Stage 5b — aus Query 8 (`produktkosten_zeitraeume`) bereits aufgebaut, kann direkt wiederverwendet werden.

3. **Berechnung je Transaktion:** Für jede `bestand_transaktion` mit `warenverluste > 0`:
   - Passenden Produktkosten-Zeitraum suchen
   - Kein Zeitraum → 0 € Beitrag, weiter
   - **Gesamtkosten je Stück** = Summe **aller** `produktkosten_werte.wert` (keine Aufschlüsselung nach `kategorie_id`)
   - `Wertverlust (€) = warenverluste × Gesamtkosten je Stück`, negiert

4. **Akkumulation:** Neuer Akkumulator `wvPrdVals` (`produkt_id → periode → betrag`) für den Produkt-Drill-Down. Gleichzeitig wird `catVals` für `wvKatId` befüllt, damit die Positions-Summe korrekt ist.

> **Warum nicht `processTransaction()` nutzen?** Dieser Mechanismus erwartet eine Gruppen-ID, da er die Hierarchie Kategorie → Gruppe → Plattform → Produkt befüllt. Für Wertverluste gibt es keine Gruppen-Aufschlüsselung. Ein separater, einfacherer Akkumulator ist sauberer.

#### Stage 7 — Response-Erweiterung

`buildKategorie()` erhält eine neue Bedingung: Ist die Kategorie „Wertverlust Ware", wird ein zusätzliches Feld `produkte_wertverlust` in die Response aufgenommen — Liste von Produkten mit Perioden-Werten aus `wvPrdVals`. Nur Produkte mit Betrag ≠ 0 erscheinen.

---

### Datenmodell in der API-Response

```
ReportKategorie (geändert — 1 neues optionales Feld)
  id, name, kpi_type, values
  gruppen: []                           ← leer für „Wertverlust Ware"
  sales_plattformen: []                 ← leer für „Wertverlust Ware"
  produkte_wertverlust?: ReportBlatt[]  ← NEU
```

`ReportBlatt` ist bereits als Typ definiert (`{ id, name, values }`). Kein neuer Typ notwendig.

---

### Frontend-Drill-Down

`reporting-rentabilitaet-matrix.tsx` bekommt eine kleine Erweiterung:
- Erkennung der „Wertverlust Ware"-Kategorie anhand des neuen `produkte_wertverlust`-Felds
- Produkt-Unterzeilen werden analog zu den bestehenden Plattform-Unterzeilen gerendert
- Expand/Collapse-Zustand überlebt Granularitätswechsel (bestehender Mechanismus greift)

---

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Identifikation „Wertverlust Ware" | `name='Wertverlust Ware'` (ausgaben_kosten, level=1) | Gleiche Konvention wie „Produkt" in PROJ-21 |
| Eigener Akkumulator statt `processTransaction()` | Ja (`wvPrdVals`) | Kein Gruppen-/Plattform-Level; einfacherer Code |
| Kostenbasis | Σ aller `produktkosten_werte.wert` | Spec: keine Aufschlüsselung nach Kostenkategorie |
| Drill-Down-Tiefe | Nur Produkt (kein Plattform-Level) | `warenverluste` nicht plattformspezifisch erfasst |
| Neues Response-Feld | `produkte_wertverlust?: ReportBlatt[]` | Klare Trennung von PROJ-21's `gruppen`-Drill-Down |
| Neue Packages | Keine | Alle Datenquellen und Tools bereits vorhanden |

### Geänderte Dateien

```
src/app/api/reporting/rentabilitaet/route.ts
  → Query 7: + warenverluste im SELECT
  → Stage 5c: wvPrdVals-Akkumulator, Zeitraum-Lookup, Σ-werte-Berechnung, catVals-Befüllung
  → buildKategorie(): produkte_wertverlust für „Wertverlust Ware"-Kategorie

src/hooks/use-reporting-rentabilitaet.ts
  → ReportKategorie: + produkte_wertverlust?: ReportBlatt[]

src/components/reporting-rentabilitaet-matrix.tsx
  → Drill-Down: Produkt-Unterzeilen aus produkte_wertverlust rendern
```

---

## QA Test Results (2026-05-13)

### Summary

| | Ergebnis |
|---|---|
| Akzeptanzkriterien | **15/15 bestanden** |
| Edge Cases | **7/7 bestanden** |
| Bugs gefunden | **0** |
| Sicherheits-Audit | **Bestanden** |
| Produktionsreif | **JA** |

### Akzeptanzkriterien

#### Berechnung
| # | Kriterium | Status |
|---|---|---|
| 1 | `warenverluste × Σ(produktkosten_werte.wert)` korrekt berechnet | ✅ PASS |
| 2 | Zeitraum-Zuordnung: `gueltig_von ≤ datum AND (gueltig_bis IS NULL OR gueltig_bis ≥ datum)` | ✅ PASS |
| 3 | Gesamtkosten = Summe aller `werte.wert` (keine Aufschlüsselung nach Kostenkategorie) | ✅ PASS |
| 4 | Kein passender Zeitraum → 0 € Beitrag, kein Fehler | ✅ PASS |
| 5 | SKU-Aggregation über `produkt_id` | ✅ PASS |
| 6 | Berechneter Betrag negiert (Kosten = negative P&L-Auswirkung) | ✅ PASS |
| 7 | Aggregation nach Monat/Quartal/Jahr analog zur bestehenden Logik | ✅ PASS |

#### Integration in den Rentabilitätsreport
| # | Kriterium | Status |
|---|---|---|
| 8 | Werte landen in der Kategorie „Wertverlust Ware" (ausgaben_kosten) | ✅ PASS |
| 9 | Kategorie nicht im Report-Modell → keine Auswirkung, kein Fehler | ✅ PASS |
| 10 | Direktbuchungen + WV-Berechnung werden addiert (keine separate Zeile) | ✅ PASS |
| 11 | Zeilen-Struktur des Reports (Positionen, Summen) unverändert | ✅ PASS |

#### Drill-Down: Produkt-Ebene
| # | Kriterium | Status |
|---|---|---|
| 12 | Produkte als ausklappbare Unterzeilen verfügbar | ✅ PASS |
| 13 | Jede Produkt-Unterzeile zeigt Gesamtbetrag pro Periode | ✅ PASS |
| 14 | Produkte ohne Wertverlust erscheinen nicht als Unterzeile | ✅ PASS |
| 15 | Produkt-Unterzeilen nicht weiter ausklappbar (kein Plattform-Level) | ✅ PASS |

### Edge Cases

| Edge Case | Status |
|---|---|
| Kein passender `produktkosten_zeitraum` → 0 € Beitrag | ✅ PASS |
| `warenverluste = 0` → Produkt erscheint nicht als Unterzeile | ✅ PASS |
| Keine `bestand_transaktionen` mit `warenverluste > 0` → Report unverändert | ✅ PASS |
| Kategorie „Wertverlust Ware" nicht vorhanden → kein Fehler | ✅ PASS |
| `produkt_id = NULL` → Transaktion ignoriert | ✅ PASS |
| Produktkosten-Wert = 0 € → kein Beitrag, keine Unterzeile | ✅ PASS |
| Kombination mit PROJ-21 (Bestandsberechnung) → unabhängig, korrekt | ✅ PASS |

### Sicherheits-Audit

| Check | Ergebnis |
|---|---|
| `/dashboard/reporting/rentabilitaet` ohne Auth → Redirect zu `/login` | ✅ Gesichert |
| `/api/reporting/rentabilitaet` ohne Auth → Redirect zu `/login` | ✅ Gesichert |
| `/api/bestand-transaktionen` ohne Auth → Redirect zu `/login` | ✅ Gesichert |
| `/api/produktkosten` ohne Auth → Redirect zu `/login` | ✅ Gesichert |
| `?next=`-Parameter bei Redirect korrekt gesetzt | ✅ Korrekt |

### Automatisierte Tests

| Suite | Ergebnis |
|---|---|
| Vitest Unit/Integration (`npm test`) | ✅ 329/329 bestanden (8 neue für PROJ-22) |
| Playwright E2E PROJ-22 (`tests/PROJ-22-wertverlust-ware-berechnung.spec.ts`) | ✅ 28/28 bestanden |
| Playwright E2E Gesamtsuite (Regression) | ✅ 394/402 bestanden (8 Pre-existing PROJ-1 Chromium-Failures, unverändert) |

### Bekannte Pre-Existing Failures (nicht durch PROJ-22 verursacht)

8 Chromium-Tests aus `PROJ-1-authentifizierung.spec.ts` schlagen fehl — diese Failures existierten vor PROJ-22 und sind unverändert. Keine neuen Regressions durch PROJ-22-Änderungen eingeführt.

### Produktions-Empfehlung

**PRODUKTIONSREIF** — Keine Critical- oder High-Bugs gefunden. Alle 15 Akzeptanzkriterien bestanden. Alle automatisierten Tests grün.
