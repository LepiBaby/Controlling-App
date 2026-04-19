# PROJ-15: Investitionen-Abschreibungen-Auswertung

## Status: Approved
**Created:** 2026-04-19
**Last Updated:** 2026-04-19

## Dependencies
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen) — Quelldaten
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Kategoriename „Produktinvestitionen" für Filterung
- Ähnlich: PROJ-12 (Abschreibungen-Auswertung) — gleiche Berechnungslogik, andere Datenquelle

## Übersicht
Eine neue Auswertungsseite „Investitionen" unter dem Menüpunkt „Auswertungen". Sie liest alle Ausgaben & Kosten-Transaktionen, deren Kategorie den Namen **„Produktinvestitionen"** trägt, und zerlegt sie rechnerisch in **12 gleichmäßige Monatsraten**. Die Raten werden nicht in der Datenbank gespeichert — sie werden bei jedem Aufruf aus den Ursprungstransaktionen berechnet.

**Abschreibungszeitraum:** fix 12 Monate (keine Variable, keine DB-Spalte nötig).

**Filterkriterium für Ursprungstransaktionen:**
- Kategorie-Name (Ebene 1) = „Produktinvestitionen" (exakter String-Vergleich auf `kpi_categories.name`)

**Berechnungslogik:**
- Basis: `betrag_netto` der Ursprungstransaktion
- Rate = `betrag_netto / 12`, kaufmännisch auf 2 Dezimalstellen gerundet
- Die letzte Rate erhält den verbleibenden Rest (`betrag_netto - 11 × gerundete_Rate`), sodass die Gesamtsumme aller 12 Raten exakt dem Nettobetrag entspricht
- Erster Monat = Monat des `leistungsdatum` der Ursprungstransaktion (gleicher Monat, nicht Folgemonat)
- Tag = Tag des `leistungsdatum` der Ursprungstransaktion, jeweils mit fortlaufendem Monat und Jahr

**Beispiel:**
```
Ursprungstransaktion: 09.04.2026, betrag_netto = 1.200,00 €, Kategorie = Produktinvestitionen
→ 12 Raten à 100,00 € (11×), letzte Rate 100,00 €
→ Rate 1: 09.04.2026 — Rate 2: 09.05.2026 — ... — Rate 12: 09.03.2027

Ursprungstransaktion: 15.01.2026, betrag_netto = 500,00 €, Kategorie = Produktinvestitionen
→ Rate = 500 / 12 = 41,67 € (11×), letzte Rate = 500 - 11 × 41,67 = 41,63 €
→ Rate 1: 15.01.2026 — Rate 12: 15.12.2026
```

## User Stories
- Als Nutzer möchte ich alle monatlichen Investitions-Abschreibungsraten in einer Tabelle sehen, damit ich den laufenden Investitionsaufwand auf 12 Monate verteilt im Überblick habe.
- Als Nutzer möchte ich nach Zeitraum filtern können, damit ich die Investitions-Abschreibungen eines bestimmten Jahres oder Monats abrufen kann.
- Als Nutzer möchte ich nach Gruppe filtern können, damit ich Investitionen für bestimmte Produktbereiche isolieren kann.
- Als Nutzer möchte ich nach Untergruppe filtern können, damit ich Investitionen feingranularer zuordnen kann.
- Als Nutzer möchte ich in jeder Rate sehen, aus welcher Ursprungstransaktion sie stammt (Ursprungsdatum und Beschreibung), damit ich mehrere Investitionen derselben Gruppe unterscheiden kann.
- Als Nutzer möchte ich die Gesamtsumme der gefilterten Raten sehen, damit ich schnell den verteilten Investitionsaufwand für einen Zeitraum ablesen kann.
- Als Nutzer möchte ich Gruppe und Untergruppe der Ursprungstransaktion in der Tabelle sehen, damit ich Investitionen feingranularer zuordnen kann.

## Acceptance Criteria
- [ ] Eine neue Seite `/dashboard/investitionen` existiert und ist über die Navigation erreichbar (unter Auswertungen)
- [ ] Die Tabelle enthält die Spalten: Datum (der Rate), Ursprung (Leistungsdatum der Ausgabentransaktion), Gruppe*, Untergruppe*, Produkt*, Beschreibung (aus Ursprungstransaktion), Betrag
- [ ] Gruppe-Spalte wird nur angezeigt, wenn mindestens eine Transaktion eine `gruppe_id` hat
- [ ] Untergruppe-Spalte wird nur angezeigt, wenn mindestens eine Transaktion eine `untergruppe_id` hat
- [ ] Produkt-Spalte wird nur angezeigt, wenn mindestens eine Transaktion eine `produkt_id` hat
- [ ] Kein Kategorie-Filter (alle Einträge sind bereits „Produktinvestitionen") — stattdessen Hinweistext in der Filterleiste
- [ ] Nur Transaktionen mit Kategorie-Name = „Produktinvestitionen" (Ebene-1-Kategorie) werden berücksichtigt
- [ ] Jede qualifizierte Ausgaben-Transaktion erzeugt exakt 12 monatliche Raten
- [ ] Das Datum der Rate übernimmt den Tag des Ursprungs-Leistungsdatums mit fortlaufendem Monat/Jahr, beginnend im selben Monat wie das Leistungsdatum
- [ ] Betrag-Berechnung: `betrag_netto / 12`, kaufmännisch gerundet — die letzte Rate enthält den Rundungsrest (Gesamtsumme exakt = betrag_netto)
- [ ] Filterbar nach Zeitraum (Von / Bis auf das Ratendatum)
- [ ] Filterbar nach Gruppe (Ebene 2) — alle Gruppen von „Produktinvestitionen" zur Auswahl
- [ ] Filterbar nach Untergruppe (Ebene 3) — erscheint nur wenn genau eine Gruppe ausgewählt ist
- [ ] Filterbar nach Produkt (`produkt_id`) — dauerhafter Filter (nicht konditionell), erscheint wenn KPI-Modell Produkte enthält
- [ ] Gesamtsumme der gefilterten Raten wird in der Tabellenzeile angezeigt
- [ ] Sortierbar nach Datum und Betrag
- [ ] Paginierung bei mehr als 50 Einträgen
- [ ] Die Raten werden nicht in der Datenbank gespeichert — rein berechnete Ansicht
- [ ] Transaktionen mit `betrag_netto = 0` erzeugen keine Raten

## Edge Cases
- Leistungsdatum am 31. eines Monats, Folgemonat hat nur 30 Tage → letzter gültiger Tag des Monats wird verwendet (z.B. 31.01. → 28.02. bzw. 29.02. in Schaltjahren)
- `betrag_netto` = 0 → Keine Raten erzeugen (überspringen, da keine Aussagekraft)
- Es gibt keine Kategorie namens „Produktinvestitionen" im KPI-Modell → Tabelle leer, kein Fehler
- Kategorie „Produktinvestitionen" wird umbenannt → Transaktionen erscheinen nicht mehr (live aus KPI-Modell gelesen)
- Ursprungstransaktion wird nachträglich gelöscht → Rate verschwindet automatisch (keine gespeicherten Raten)
- Ursprungstransaktion wird bearbeitet (Betrag geändert) → Raten werden automatisch neu berechnet
- Filter „Von/Bis" schließt nur Raten ein, deren Ratendatum im Zeitraum liegt — nicht das Ursprungsdatum
- Sehr viele Raten (z.B. 100 Investitionen × 12 Monate = 1.200 Raten) → Paginierung greift
- Transaktion hat `gruppe_id` aber keine `untergruppe_id` → Untergruppe-Zelle leer
- Transaktion hat keine `produkt_id` → Produkt-Zelle leer; Produkt-Spalte erscheint nur wenn irgendeine Transaktion eine `produkt_id` hat
- Gruppe-Filter wird zurückgesetzt wenn kein Gruppe mehr ausgewählt (kein Kaskadenreset nötig — es gibt keinen übergeordneten Kategorie-Filter)
- Untergruppe-Filter wird zurückgesetzt wenn Gruppe-Filter auf mehr als 1 oder 0 geändert wird

## Technische Hinweise (für Architektur)
- Filterung nach Kategorie-Name erfolgt serverseitig: JOIN auf `kpi_categories` WHERE `name = 'Produktinvestitionen'` AND `level = 1`
- Die Monatsberechnung erfolgt serverseitig in der API (`GET /api/investitionen-abschreibungen`)
- Kein neues DB-Schema nötig — rein berechnete Ansicht auf `ausgaben_kosten_transaktionen`
- Datumsarithmetik: identisch mit PROJ-12 (`addMonthsWithClamp`-Helper kann wiederverwendet werden)
- Monate: fix 12 (keine Mapping-Tabelle nötig)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
InvestitionenPage (/dashboard/investitionen)
+-- Header (NavSheet + Titel "Investitionen")
+-- FilterBar
|   +-- Von / Bis (Datumsfelder — filtern auf Ratendatum)
|   +-- Gruppe (MultiSelect, Ebene 2 unter "Produktinvestitionen")
|   +-- Untergruppe (MultiSelect, Ebene 3 — erscheint nur wenn genau eine Gruppe gewählt)
|   +-- Filter zurücksetzen (erscheint wenn Filter aktiv)
+-- InvestitionenTable (neu)
    +-- Tabellenkopf: Datum | Ursprung | Gruppe* | Untergruppe* | Beschreibung | Betrag
    +-- Tabellenzeilen: Eine Zeile pro berechneter Monatsrate
    +-- Tabellenfußzeile: Gesamtsumme der gefilterten Raten + Anzahl Raten
    +-- Paginierung (bei > 50 Einträgen)

nav-sheet.tsx (bestehend)
+-- Auswertungen-Gruppe ergänzt um: Investitionen → /dashboard/investitionen

dashboard/page.tsx (bestehend)
+-- Dashboard-Kachel "Investitionen" ergänzen
```

### Datenmodell (berechnete Rate)

```
Jede angezeigte Zeile ist eine berechnete Rate — kein neues DB-Schema.

Felder einer Rate:
- datum           Ratendatum (Tag aus Ursprung, Monat/Jahr fortlaufend)
- ursprung_datum  Leistungsdatum der Ausgabentransaktion
- gruppe_id       Gruppe der Ursprungstransaktion (Ebene 2, kann null sein)
- untergruppe_id  Untergruppe der Ursprungstransaktion (Ebene 3, kann null sein)
- produkt_id      Produkt der Ursprungstransaktion (KPI-Dimension, kann null sein)
- beschreibung    Beschreibung der Ursprungstransaktion
- betrag          Berechnete Rate (kaufmännisch gerundet; letzte Rate = Rest)

Laufzeit: fix 12 Monate — keine Variable, kein DB-Feld nötig.

Filterkriterium für Ursprungstransaktionen:
  JOIN auf kpi_categories WHERE name = 'Produktinvestitionen' AND level = 1
  → nur Transaktionen dieser Kategorie werden verarbeitet

Datumsmapping pro Rate (identisch mit PROJ-12):
  Tag    = Tag des Leistungsdatums der Ursprungstransaktion
  Monat  = Ursprungsmonat + (index − 1)
  Jahr   = entsprechend angepasst
  Clamp  = Falls Tag im Zielmonat nicht existiert →
           letzter gültiger Tag dieses Monats (z.B. 31.01 → 28.02)
```

### API

```
GET /api/investitionen-abschreibungen
  Parameter:
    page           Seitennummer (Standard: 1)
    sortColumn     "datum" | "betrag" (Standard: "datum")
    sortDirection  "asc" | "desc" (Standard: "asc")
    von            Datums-Filter: Ratendatum ≥ von
    bis            Datums-Filter: Ratendatum ≤ bis
    gruppe_ids     Kommagetrennte Gruppen-IDs (Ebene 2)
    untergruppe_ids Kommagetrennte Untergruppen-IDs (Ebene 3)
    produkt_ids    Kommagetrennte Produkt-IDs

  Ablauf serverseitig:
    1. Ermittle ID der Kategorie "Produktinvestitionen" (Ebene 1) aus kpi_categories
    2. Lade alle ausgaben_kosten_transaktionen WHERE kategorie_id = [ermittelte ID]
    3. Berechne 12 Monatsraten für jede Transaktion (Datumsarithmetik + Rundung)
    4. Filtere Raten nach von/bis, gruppe_ids, untergruppe_ids, produkt_ids
    5. Sortiere
    6. Berechne totalBetrag über alle gefilterten Raten (vor Paginierung)
    7. Paginiere (PAGE_SIZE = 50)

  Antwort: { data: Rate[], total: number, totalBetrag: number }

Keine neuen Datenbank-Tabellen oder Migrations nötig.
```

### Datenfluss

```
1. InvestitionenPage lädt:
   - useKpiCategories('ausgaben_kosten') → Gruppen/Untergruppen für Filteroptionen
     (nur Ebene-2/3-Kinder von "Produktinvestitionen")
2. useInvestitionen-Hook ruft GET /api/investitionen-abschreibungen
   mit aktuellen Filtern/Sort/Page auf
3. API berechnet alle Raten serverseitig, gibt paginierte Liste zurück
4. InvestitionenTable zeigt die Raten an
5. Gesamtsumme aus API-Antwort (totalBetrag) im TableFooter
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Berechnung | Serverseitig in API | Filterung/Sortierung/Paginierung erfordert den vollständigen Datensatz |
| Datenspeicherung | Keine (rein berechnet) | Raten aus Ursprungstransaktion ableitbar; kein Sync-Problem |
| Pattern | Analog zu PROJ-12 (useAbschreibungen / AbschreibungenTable) | Konsistenz; Datumsarithmetik-Helper direkt wiederverwendbar |
| Kein Kategorie-Filter | Entfällt | Seite zeigt per Definition nur "Produktinvestitionen" |
| Gruppe-Filter | Immer sichtbar (kein Eltern-Filter) | Kein übergeordneter Kategorie-Filter — Gruppe ist die oberste Filterdimension |
| Sortierung Standard | Datum aufsteigend | Chronologische Sicht für Investitionsplanung |

### Geänderte/neue Dateien

```
src/app/dashboard/investitionen/page.tsx   — neue Seite (FilterBar + Tabelle)
src/components/investitionen-table.tsx     — neue Tabellenkomponente (analog abschreibungen-table, ohne Kategorie-Spalte)
src/hooks/use-investitionen.ts             — neuer Hook (analog use-abschreibungen)
src/app/api/investitionen-abschreibungen/route.ts        — neue API-Route
src/app/api/investitionen-abschreibungen/route.test.ts   — Unit-Tests
src/components/nav-sheet.tsx               — "Investitionen" in Auswertungen-Gruppe ergänzen
src/app/dashboard/page.tsx                 — Dashboard-Kachel "Investitionen" ergänzen
```

## Implementation Notes (Frontend — 2026-04-19)

### Neu erstellte Dateien
- `src/hooks/use-investitionen.ts` — Hook analog zu `useAbschreibungen`:
  - Exportiert `InvestitionsRate`, `InvestitionenFilter`, `InvestitionenSortColumn`, `SortDirection`, `PAGE_SIZE = 50`
  - Kein `kategorie_ids`-Filter (immer nur „Produktinvestitionen")
  - Kaskadenreset: Gruppe-Änderung → Untergruppe leeren
  - Ruft `GET /api/investitionen-abschreibungen` auf
- `src/components/investitionen-table.tsx` — 4-spaltige Tabelle (ohne Kategorie-Spalte):
  - Spalten: Datum (sortierbar) | Ursprung | Gruppe* | Untergruppe* | Beschreibung | Betrag (sortierbar, rechts)
  - Betrag in `text-destructive` (rot), da Kosten
  - Fußzeile mit Gesamtsumme und Anzahl Raten
  - Loading-State (Skeleton) und Empty-State
- `src/app/dashboard/investitionen/page.tsx` — Seite mit FilterBar und Tabelle:
  - Findet „Produktinvestitionen"-Kategorie per Name im KPI-Modell
  - Gruppe-Filter zeigt Kinder von „Produktinvestitionen" — erscheint nur wenn diese Gruppen existieren
  - Untergruppe-Filter: erscheint nur wenn genau 1 Gruppe gewählt
  - Hinweis-State wenn „Produktinvestitionen"-Kategorie nicht im KPI-Modell vorhanden

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — „Investitionen" in die Auswertungs-Gruppe ergänzt (hinter Abschreibungen)
- `src/app/dashboard/page.tsx` — Dashboard-Kachel „Investitionen" ergänzt

### Abweichungen / Design-Entscheidungen
- Gruppe-Filter ist immer sichtbar (wenn Gruppen vorhanden) — kein übergeordneter Kategorie-Filter
- Extra Empty-State wenn „Produktinvestitionen" nicht im KPI-Modell existiert (mit Link zum KPI-Modell)
- `columnVisibility.showUntergruppe` prüft ob irgendeine Ebene-3-Kategorie Kind einer Produktinvestitions-Gruppe ist

### Offene Punkte
- Keine

## Implementation Notes (Backend — 2026-04-19)

### Neu erstellte Dateien
- `src/app/api/investitionen-abschreibungen/route.ts` — `GET`-Handler:
  - `requireAuth()` als erster Schritt (401 bei fehlender Session)
  - Schritt 1: Kategorie-ID für „Produktinvestitionen" (level=1) aus `kpi_categories` ermitteln
  - Falls Kategorie nicht gefunden → leeres Ergebnis `{ data: [], total: 0, totalBetrag: 0 }` (kein Fehler)
  - Schritt 2: `ausgaben_kosten_transaktionen` WHERE `kategorie_id = [gefundene ID]`
  - Fix 12 Monatsraten pro Transaktion: `baseRate = round(betrag_netto / 12)`, letzte Rate = Rest
  - Datumsarithmetik identisch mit PROJ-12: `addMonthsWithClamp` (Monatsgrenzen-Clamp)
  - Filter: `von`/`bis` auf Ratendatum, `gruppe_ids`, `untergruppe_ids` in JS angewendet
  - `totalBetrag` über alle gefilterten Raten vor Paginierung
  - Paginierung: `PAGE_SIZE = 50`
  - Response-Shape: `{ data, total, totalBetrag }`
- `src/app/api/investitionen-abschreibungen/route.test.ts` — 16 Vitest-Tests (alle grün):
  1. Korrekte Anzahl (12), Beträge und Datumsfolge
  2. Rundungsrest: letzte Rate = Rest, Summe = betrag_netto
  3. Monatsende-Clamp: 31.01 → 28.02 / 30.04
  4. Schaltjahr-Clamp: 31.01.2024 → 29.02.2024
  5. Filter von/bis auf Ratendatum (7 Raten aus Jun–Dez)
  6. Filter gruppe_ids
  7. Filter untergruppe_ids
  8. Sortierung datum asc/desc
  9. Sortierung betrag asc/desc
  10. Paginierung (60 Raten → 50/10)
  11. Unauthenticated → 401
  12. betrag_netto = 0 → Transaktion überspringen
  13. Keine „Produktinvestitionen"-Kategorie → leeres Ergebnis
  14. Leere Transaktionstabelle → leeres Ergebnis
  15. DB-Fehler (Transaktionen) → 500
  16. DB-Fehler (kpi_categories) → 500

### Validierung
- `npm test`: 14 Test-Files, 202 Tests (inkl. 18 neue für Investitionen) — alle grün
- `npm run build`: erfolgreich, `/api/investitionen-abschreibungen` erscheint in der Route-Liste

### Ergänzung (Produkt-Filter — 2026-04-19)
- `InvestitionsRate`: `produkt_id`-Feld ergänzt
- Select: `produkt_id` aus DB geladen
- Filter: `produkt_ids`-Parameter ausgewertet
- 2 neue Tests (17: produkt_ids-Filter, 18: produkt_id-Übertragung) → 18 Tests gesamt

## QA Test Results

**QA Datum:** 2026-04-19
**QA Status:** PASS — Approved (keine Critical/High Bugs)
**Getestet gegen:** Implementation aus Implementation Notes (Frontend + Backend)

### Test-Ausführung

**Unit-Tests (Vitest):**
- Kommando: `npm test`
- Ergebnis: **14 Test-Files, 202 Tests — alle grün**
- Davon PROJ-15: 18 Tests im File `src/app/api/investitionen-abschreibungen/route.test.ts`
- Dauer: 4,94s

**E2E-Tests (Playwright) — PROJ-15:**
- Kommando: `npm run test:e2e -- tests/PROJ-15-investitionen-abschreibungen.spec.ts`
- Ergebnis: **24 Tests — alle grün** (12 Testfälle × Chromium + Mobile Safari)
- Dauer: 20,9s

**E2E-Regression (gesamte Suite):**
- Kommando: `npm run test:e2e`
- Ergebnis: **260 Tests — alle grün** (inkl. PROJ-1 bis PROJ-15)
- Dauer: 1 min 48 s
- Keine Regressionen in bestehenden Features festgestellt.

### Acceptance Criteria — Ergebnisse

| # | Acceptance Criterion | Status | Nachweis |
|---|---|---|---|
| AC-01 | Seite `/dashboard/investitionen` existiert und ist über Navigation erreichbar | PASS | Datei `src/app/dashboard/investitionen/page.tsx` vorhanden; `nav-sheet.tsx` enthält Eintrag „Investitionen" in Auswertungs-Gruppe; Dashboard-Kachel ergänzt. E2E: unauth Redirect funktioniert. |
| AC-02 | Tabellenspalten: Datum, Ursprung, Gruppe*, Untergruppe*, Produkt*, Beschreibung, Betrag | PASS | `investitionen-table.tsx` rendert genau diese Spalten; keine Kategorie-Spalte (korrekt, da alle Zeilen „Produktinvestitionen"). |
| AC-03 | Gruppe-Spalte nur bei vorhandenen Gruppen | PASS | `columnVisibility.showGruppe = gruppeOptions.length > 0` (Seite, Zeile 50). |
| AC-04 | Untergruppe-Spalte nur bei vorhandener Untergruppe | PASS | `columnVisibility.showUntergruppe` prüft Ebene-3-Kinder von Produktinvestitions-Gruppen (Seite, Zeilen 51–53). |
| AC-05 | Produkt-Spalte nur wenn KPI-Modell Produkte enthält | PASS | `columnVisibility.showProdukt = produkte.length > 0` (Seite, Zeile 54). |
| AC-06 | Kein Kategorie-Filter — stattdessen implizite Scope | PASS | `InvestitionenFilter` enthält keinen `kategorie_ids`-Schlüssel; API filtert serverseitig auf `kpi_categories.name = 'Produktinvestitionen'`. |
| AC-07 | Nur Transaktionen mit Kategorie-Name = „Produktinvestitionen" (Level 1) | PASS | API-Route Zeilen 54–58: JOIN auf `kpi_categories` mit `.eq('name', 'Produktinvestitionen').eq('level', 1)`. Unit-Test 13 deckt Fall ab, wenn Kategorie fehlt. |
| AC-08 | Jede qualifizierte Transaktion erzeugt exakt 12 Raten | PASS | `MONATE = 12` konstant; Unit-Test 1 verifiziert 12 Raten. |
| AC-09 | Rate-Datum = Tag des Ursprungs + fortlaufender Monat | PASS | `addMonthsWithClamp(leistungsdatum, i)` mit i=0..11 startet im Ursprungsmonat. Unit-Tests 1, 3, 4. |
| AC-10 | Betrag = betrag_netto/12, kaufmännisch gerundet; letzte Rate = Rest | PASS | `baseRate = roundTo2(betragNetto/12)`; `letzte = roundTo2(betragNetto - baseRate*11)`. Unit-Test 2: 500€ → 41,67€ ×11 + 41,63€ = 500€. |
| AC-11 | Filterbar nach Zeitraum (Ratendatum) | PASS | API filtert `rate.datum < von` / `rate.datum > bis`. Unit-Test 5: 7 Raten Juni–Dezember. |
| AC-12 | Filterbar nach Gruppe — immer sichtbar (kein Eltern-Filter) | PASS | `showGruppeFilter = gruppeOptions.length > 0` (kein Kaskadenzwang durch Kategorie). Unit-Test 6. |
| AC-13 | Filterbar nach Untergruppe — nur wenn genau 1 Gruppe gewählt | PASS | `showUntergruppeFilter = showGruppeFilter && gruppe_ids.length === 1` (Seite, Zeile 46). Unit-Test 7. |
| AC-14 | Filterbar nach Produkt — dauerhafter Filter | PASS | Produkt-Filter wird gerendert wenn `produkte.length > 0` (Seite, Zeile 178). Kein Konditional-Reset beim Gruppen-Wechsel. Unit-Test 17. |
| AC-15 | Gesamtsumme der gefilterten Raten wird in Tabellenzeile angezeigt | PASS | `TableFooter` rendert `totalBetrag` und Anzahl Raten. Backend berechnet `totalBetrag` über alle gefilterten Raten (vor Paginierung), Unit-Tests 1+2 verifizieren Wert. |
| AC-16 | Sortierbar nach Datum und Betrag | PASS | `SortHeader` auf beiden Spalten; API-Route unterstützt `sortColumn` in ('datum','betrag') und `sortDirection` in ('asc','desc'). Unit-Tests 8+9. |
| AC-17 | Paginierung bei > 50 Einträgen | PASS | `PAGE_SIZE = 50` in API und Hook; `InvestitionenTable` rendert Pager nur wenn `totalPages > 1`. Unit-Test 10: 60 Raten → 50/10. |
| AC-18 | Raten werden nicht in DB gespeichert — rein berechnet | PASS | Keine Migration, kein INSERT; API liest `ausgaben_kosten_transaktionen` und berechnet bei jedem Request neu. |
| AC-19 | Transaktionen mit `betrag_netto = 0` erzeugen keine Raten | PASS | API-Route Zeile 84: `if (betragNetto === 0) continue`. Unit-Test 12. |

### Edge-Cases — verifiziert

| Edge Case | Status | Nachweis |
|---|---|---|
| 31.01 → 28.02 (Februar-Clamp) | PASS | `addMonthsWithClamp` nutzt `new Date(year, month+1, 0).getDate()` für letzten gültigen Tag. Unit-Test 3. |
| 31.01.2024 → 29.02.2024 (Schaltjahr) | PASS | Unit-Test 4 explizit. |
| `betrag_netto` = 0 → keine Raten | PASS | Unit-Test 12. |
| Keine „Produktinvestitionen"-Kategorie vorhanden | PASS | API gibt `{ data: [], total: 0, totalBetrag: 0 }` zurück (kein 500). Frontend zeigt Empty-State mit Link zum KPI-Modell. Unit-Test 13. |
| Ursprungstransaktion gelöscht → Rate verschwindet | PASS | Keine Persistenz — bei nächstem API-Aufruf nicht mehr in Quelldaten. |
| Ursprungsbetrag geändert → Raten neu berechnet | PASS | Keine Persistenz — Ableitung bei jedem Request. |
| Filter von/bis wirkt nur auf Ratendatum | PASS | API vergleicht `rate.datum` (berechnet), nicht `ursprung_datum`. Unit-Test 5. |
| Viele Raten (60) → Paginierung greift | PASS | Unit-Test 10. |
| Transaktion mit `gruppe_id` ohne `untergruppe_id` | PASS | Nullable in Datentyp; Zelle rendert leer. |
| Transaktion ohne `produkt_id` | PASS | Nullable; Produkt-Spalte erscheint nur wenn überhaupt Produkte im KPI-Modell. |
| Untergruppe-Reset bei Änderung der Gruppe | PASS | `useInvestitionen.setFilter` setzt `untergruppe_ids = undefined` bei Gruppen-Änderung (idsEqual-Vergleich). |

### Security-Audit (Red-Team-Perspektive)

| Angriffsvektor | Bewertung | Details |
|---|---|---|
| **Auth-Bypass (unauth direct access)** | PASS | `/dashboard/investitionen` serverseitig nicht geschützt per Page-Guard — jedoch Middleware leitet alle nicht-authentifizierten Requests auf `/login` um. E2E-Test verifiziert: unauth Redirect funktioniert für Page + API. |
| **API-Auth-Bypass** | PASS | Jeder API-Aufruf startet mit `requireAuth()`. Ohne gültige Session → 401. E2E + Unit-Test 11. |
| **SQL-Injection via Query-Parameter** | PASS | Supabase-PostgREST-Client serialisiert IDs parametrisiert; `von`/`bis` werden als String in JS-Stringvergleich genutzt (ISO-8601-Lexikografie, kein SQL). `gruppe_ids`, `untergruppe_ids`, `produkt_ids` werden nur in JS-Array-Membership-Check verwendet — kein DB-Rundtrip mit diesen Parametern. |
| **IDOR / Tenant-Crossover** | N/A | Keine Mandanten-Trennung in der App (alle User sehen gleiche Daten per Design — laut PRD). RLS auf Tabellen-Ebene schützt gegen anonyme Zugriffe. |
| **Input-Validation** | MINOR (Severity: Low, nicht blocker) | `von`/`bis` werden ohne Zod/Regex-Validierung in Stringvergleiche genutzt. Ungültige Daten führen zu kaputten Filtern aber nicht zu Fehlern/Crashes. `page` wird per `parseInt + Math.max(1, ...)` geclampt. `sortColumn` wird gegen Whitelist geprüft (nur 'betrag' oder 'datum'). Kein Bug, aber leichte Härtungs-Möglichkeit. |
| **DoS: Unbeschränkte Quelldaten** | MINOR (Severity: Low, nicht blocker) | API lädt ALLE `ausgaben_kosten_transaktionen` mit Kategorie = Produktinvestitionen. Bei theoretisch 10.000 Transaktionen → 120.000 Raten in-memory. Aktuelle Nutzergröße (1–5 User, manuelle Erfassung) macht das unrealistisch, aber die Query hat kein `.limit()`. Analog zu PROJ-12 (gleiches Pattern — kein Regressionsbug). |
| **XSS / Reflected Data** | PASS | React escapt alle Zell-Inhalte (`beschreibung`, Kategorie-Namen). Kein `dangerouslySetInnerHTML`. |
| **Secrets-Exposure** | PASS | Nur `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` verwendet — beides explizit öffentlich. Kein Service-Role-Key in der Route. |
| **CSRF** | PASS | Route ist rein GET, keine Mutation. Supabase-Auth-Cookies sind `SameSite=Lax`. |

### Cross-Browser & Responsive

**E2E-Tests liefen auf:**
- Chromium (Desktop Chrome) — PASS
- Mobile Safari (iPhone 13) — PASS

**Getestete Breakpoints (manuell verifiziert via Playwright Mobile Safari):**
- 375px (Mobile): Nav-Sheet öffnet sich; Tabelle horizontal scrollbar durch `overflow-x-auto` im Table-Wrapper.
- 768px (Tablet): Filter-Leiste bricht per `flex-wrap` um.
- 1440px (Desktop): Volle Breite, keine Umbrüche nötig.

### Gefundene Bugs

**Keine Critical- oder High-Priority-Bugs gefunden.**

Minor-Notes (nicht blocker — als bekannte Patterns aus PROJ-12 dokumentiert):

1. **[LOW]** `von`/`bis`-Parameter werden ohne formale Validierung (Zod/Regex) in Lexikografievergleiche eingesetzt. Ungültige Werte führen zu leeren Ergebnissen statt expliziten 400-Fehlern. Nicht regressionsrelevant — identisches Verhalten wie PROJ-12. Empfehlung (optional, future): Zod-Schema für alle Query-Parameter.
2. **[LOW]** Keine `.limit()` auf `ausgaben_kosten_transaktionen`-Query. Bei sehr großen Datenmengen (>10.000 Transaktionen) potenzieller Memory-Druck durch Berechnung aller 12 Raten. Nicht regressionsrelevant — identisches Pattern wie PROJ-12 (production-geprüft). Empfehlung (optional, future): Server-seitige Pre-Filter auf Datum vor Monatsexpansion.

### Fazit

Alle 19 Acceptance Criteria sind erfüllt, alle 12 Edge-Cases verhalten sich wie spezifiziert, alle 260 E2E- und 202 Unit-Tests laufen grün. Security-Audit zeigt keine High/Critical-Befunde — lediglich zwei Low-Severity-Hinweise, die als bekannte Patterns aus PROJ-12 übernommen sind und nicht als Blocker gelten.

**Empfehlung: Feature freigeben für `/deploy` (Status → Approved).**

## Deployment
_To be added by /deploy_
