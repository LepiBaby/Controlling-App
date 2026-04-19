# PROJ-15: Investitionen-Abschreibungen-Auswertung

## Status: In Progress
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
- [ ] Die Tabelle enthält die Spalten: Datum (der Rate), Ursprung (Leistungsdatum der Ausgabentransaktion), Gruppe*, Untergruppe*, Beschreibung (aus Ursprungstransaktion), Betrag
- [ ] Gruppe-Spalte wird nur angezeigt, wenn mindestens eine Transaktion eine `gruppe_id` hat
- [ ] Untergruppe-Spalte wird nur angezeigt, wenn mindestens eine Transaktion eine `untergruppe_id` hat
- [ ] Kein Kategorie-Filter (alle Einträge sind bereits „Produktinvestitionen") — stattdessen Hinweistext in der Filterleiste
- [ ] Nur Transaktionen mit Kategorie-Name = „Produktinvestitionen" (Ebene-1-Kategorie) werden berücksichtigt
- [ ] Jede qualifizierte Ausgaben-Transaktion erzeugt exakt 12 monatliche Raten
- [ ] Das Datum der Rate übernimmt den Tag des Ursprungs-Leistungsdatums mit fortlaufendem Monat/Jahr, beginnend im selben Monat wie das Leistungsdatum
- [ ] Betrag-Berechnung: `betrag_netto / 12`, kaufmännisch gerundet — die letzte Rate enthält den Rundungsrest (Gesamtsumme exakt = betrag_netto)
- [ ] Filterbar nach Zeitraum (Von / Bis auf das Ratendatum)
- [ ] Filterbar nach Gruppe (Ebene 2) — alle Gruppen von „Produktinvestitionen" zur Auswahl
- [ ] Filterbar nach Untergruppe (Ebene 3) — erscheint nur wenn genau eine Gruppe ausgewählt ist
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

  Ablauf serverseitig:
    1. Ermittle ID der Kategorie "Produktinvestitionen" (Ebene 1) aus kpi_categories
    2. Lade alle ausgaben_kosten_transaktionen WHERE kategorie_id = [ermittelte ID]
    3. Berechne 12 Monatsraten für jede Transaktion (Datumsarithmetik + Rundung)
    4. Filtere Raten nach von/bis, gruppe_ids, untergruppe_ids
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
- `npm test`: 14 Test-Files, 200 Tests (inkl. 16 neue für Investitionen) — alle grün
- `npm run build`: erfolgreich, `/api/investitionen-abschreibungen` erscheint in der Route-Liste

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
