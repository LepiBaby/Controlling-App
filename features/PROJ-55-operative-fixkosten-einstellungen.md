# PROJ-55: Operative Fixkosten-Einstellungen — Kurzfristige Planung

## Status: Approved
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

## Dependencies
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Kategorien unter "Operativ" im ausgaben_kosten-Baum werden als Auswahlwerte geladen
- Requires: PROJ-41 (Bereichswechsler) — Seite liegt unter Kurzfristige Planung > Einstellungen
- Requires: PROJ-50 (Grundeinstellungen) — Planungskontext vorhanden

## Overview
Eine neue Einstellungsseite unter dem Bereich **Kurzfristige Planung → Einstellungen** mit dem Titel „Operative Fixkosten". Nutzer können wiederkehrende operative Fixkosteneinträge mit Zahlungsfrequenz, Fälligkeitsmonat(en) und Bruttobetrag anlegen, bearbeiten und löschen. Die Tabelle berechnet automatisch einen monatlichen Vergleichswert für alle Frequenztypen.

---

## User Stories

- Als Controlling-Mitarbeiter möchte ich operative Fixkosteneinträge anlegen können, damit ich wiederkehrende Kosten strukturiert in der kurzfristigen Planung erfassen kann.
- Als Controlling-Mitarbeiter möchte ich die Zahlungsfrequenz (monatlich, quartalsweise, jährlich) und die betroffenen Monate je Eintrag definieren, damit die Planung zeitlich korrekt abgebildet wird.
- Als Controlling-Mitarbeiter möchte ich jeden Fixkosteneintrag einer KPI-Kategorie (Ebene 1 unterhalb „Operativ") zuordnen, damit Kosten im Reporting der richtigen Kostenstelle zugerechnet werden.
- Als Controlling-Mitarbeiter möchte ich bestehende Einträge bearbeiten und löschen können, damit die Daten aktuell bleiben.
- Als Controlling-Mitarbeiter möchte ich die Liste nach Kategorie filtern können, damit ich schnell relevante Einträge finde.
- Als Controlling-Mitarbeiter möchte ich eine berechnete Spalte „Bruttobetrag monatlich" sehen, damit ich die Kostenbelastung pro Monat plattformübergreifend vergleichen kann.
- Als Controlling-Mitarbeiter möchte ich Fixkosten als inaktiv markieren können, damit nicht mehr relevante Einträge erhalten bleiben, aber nicht in die Planung einfließen.

---

## Acceptance Criteria

### Seite & Navigation
- [ ] Die Seite ist unter `/dashboard/kurzfristige-planung/operative-fixkosten-einstellungen` erreichbar.
- [ ] Auf der Übersichtsseite Kurzfristige Planung (`/dashboard/kurzfristige-planung/page.tsx`) erscheint eine neue Karte „Operative Fixkosten-Einstellungen" im Abschnitt „Einstellungen".
- [ ] Der Seitentitel lautet „Operative Fixkosten-Einstellungen".

### Formular — Neuen Eintrag anlegen
- [ ] Ein Button „+ Fixkosten anlegen" öffnet ein Dialog-Formular.
- [ ] **Kategorie (Pflicht):** Dropdown mit allen KPI-Kategorien der Ebene 1, deren parent_id auf die Kategorie mit `type = 'ausgaben_kosten'` und `name = 'Operativ'` (case-insensitive) zeigt. Falls kein solcher Knoten existiert, zeigt die Auswahl einen leeren Zustand mit Hinweis.
- [ ] **Name (Pflicht):** Freitextfeld, min. 1 Zeichen, max. 100 Zeichen.
- [ ] **Zahlungsfrequenz (Pflicht):** Dropdown mit Optionen: `Monatlich`, `Quartalsweise`, `Jährlich`.
- [ ] **Fälligkeitsmonat(e) — nur wenn Frequenz = Jährlich:** Einfach-Auswahl eines Kalendermonats (Januar–Dezember) als Dropdown. Pflichtfeld wenn Frequenz = Jährlich.
- [ ] **Fälligkeitsmonat(e) — nur wenn Frequenz = Quartalsweise:** Auswahl von je einem Monat pro Quartal: Q1 (Jan/Feb/Mär), Q2 (Apr/Mai/Jun), Q3 (Jul/Aug/Sep), Q4 (Okt/Nov/Dez). Alle vier Quartals-Dropdowns sind Pflichtfelder wenn Frequenz = Quartalsweise.
- [ ] **Zeitpunkt im Monat (Pflicht):** Dropdown mit Optionen: `Anfang`, `Mitte`, `Ende`.
- [ ] **Bruttobetrag (Pflicht):** Zahl (€), min. 0,01, max. 10.000.000, zwei Dezimalstellen.
- [ ] **Aktiv:** Schalter (Toggle/Switch), Standard = aktiviert.
- [ ] Alle Pflichtfelder werden client- und serverseitig validiert.
- [ ] Das Formular zeigt bei Validierungsfehlern spezifische Inline-Fehlermeldungen.
- [ ] Nach erfolgreichem Speichern schließt das Formular und der neue Eintrag erscheint sofort in der Tabelle.

### Tabelle
- [ ] Alle Fixkosteneinträge des Nutzers werden tabellarisch angezeigt mit Spalten: **Kategorie**, **Name**, **Frequenz**, **Fälligkeitsmonat(e)**, **Zeitpunkt**, **Bruttobetrag (€)**, **Bruttobetrag monatlich (€)**, **Aktiv**, **Aktionen**.
- [ ] **Spalte „Bruttobetrag monatlich"** berechnet sich wie folgt:
  - Monatlich → Bruttobetrag × 1
  - Quartalsweise → Bruttobetrag / 3
  - Jährlich → Bruttobetrag / 12
- [ ] Die Spalte „Bruttobetrag monatlich" wird auf 2 Dezimalstellen gerundet und als Euro-Betrag formatiert.
- [ ] Die Spalte „Fälligkeitsmonat(e)" zeigt bei monatlicher Frequenz „Alle Monate", bei quartalsweiser die vier gewählten Monatsnamen (z. B. „Feb, Mai, Aug, Nov"), bei jährlicher den gewählten Monatsnamen (z. B. „März").
- [ ] Die Spalte „Aktiv" zeigt einen Badge (Aktiv / Inaktiv).
- [ ] Jede Zeile hat eine Schaltfläche „Bearbeiten" (öffnet das Formular vorausgefüllt) und „Löschen" (mit Bestätigungsdialog).

### Filter
- [ ] Über der Tabelle befindet sich ein Kategorie-Filter (Dropdown mit Mehrfachauswahl oder Einfach-Auswahl), der die Tabelle clientseitig nach der gewählten Kategorie filtert.
- [ ] Eine Option „Alle Kategorien" setzt den Filter zurück.

### Bearbeiten
- [ ] „Bearbeiten" öffnet das Formular mit allen gespeicherten Werten vorausgefüllt.
- [ ] Alle Felder bleiben editierbar, inklusive Frequenz (mit entsprechender Anpassung der Monatsauswahl).
- [ ] Nach dem Speichern aktualisiert sich der Eintrag in der Tabelle sofort.

### Löschen
- [ ] „Löschen" öffnet einen Bestätigungsdialog: „Soll dieser Fixkosteneintrag wirklich gelöscht werden?"
- [ ] Nach Bestätigung wird der Eintrag permanent gelöscht und aus der Tabelle entfernt.
- [ ] Abbrechen schließt den Dialog ohne Änderungen.

### Leerzustand
- [ ] Wenn noch keine Einträge vorhanden sind, zeigt die Seite einen Hinweistext und den Button „+ Fixkosten anlegen".

### Auswertungsblock (oben auf der Seite)
- [ ] Oberhalb der Tabelle wird ein kompakter Auswertungsblock angezeigt.
- [ ] Der Block zeigt eine einzige Kennzahl: **Gesamte Fixkosten monatlich (€)** — die Summe aller monatlichen Bruttobeträge aller aktiven Einträge (Berechnung identisch zur Tabellenspalte „Bruttobetrag monatlich").
- [ ] Inaktive Einträge fließen **nicht** in die Gesamtsumme ein.
- [ ] Neben oder unterhalb der Kennzahl befindet sich ein Button **„Mehr"**, der die Kategorieaufschlüsselung ein- und ausblendet (Toggle).
- [ ] Die Kategorieaufschlüsselung zeigt je aktiver Kategorie eine Zeile mit: Kategoriename und monatlicher Summe aller aktiven Einträge in dieser Kategorie, absteigend nach Betrag sortiert.
- [ ] Die Kategorieaufschlüsselung berücksichtigt denselben Kategoriefilter wie die Tabelle — ist ein Filter aktiv, zeigt die Auswertung nur die gefilterten Einträge.
- [ ] Wenn kein aktiver Eintrag vorhanden ist, zeigt der Block „0,00 €" und der „Mehr"-Button ist ausgeblendet.

---

## Edge Cases

- **Kein „Operativ"-Knoten im KPI-Modell:** Das Kategorie-Dropdown ist leer und zeigt den Text „Keine Kategorien gefunden. Bitte zuerst die Kategorie ‚Operativ' im KPI-Modell anlegen."
- **Frequenzwechsel beim Bearbeiten:** Wechselt der Nutzer die Frequenz (z. B. von Quartalsweise auf Monatlich), werden die Monatsauswahl-Felder ausgeblendet und ihre Werte verworfen/nicht gespeichert.
- **Quartalsmonat-Validierung:** Für jedes Quartal darf nur ein Monat aus den zugehörigen Monaten ausgewählt werden (Q1: Jan/Feb/Mär, Q2: Apr/Mai/Jun, Q3: Jul/Aug/Sep, Q4: Okt/Nov/Dez). Der Server validiert, dass die gespeicherten Monate korrekt auf die Quartale verteilt sind.
- **Gleichnamige Einträge:** Name + Kategorie müssen nicht eindeutig sein (Duplikate sind erlaubt, da gleiche Kosten in unterschiedlichen Kontexten vorkommen können).
- **Inaktiver Eintrag:** Inaktive Einträge erscheinen in der Tabelle (mit Badge „Inaktiv") und werden für spätere Planungsschritte ignoriert, bleiben aber vollständig editierbar.
- **Sehr viele Einträge:** API-Abfrage mit `.limit(500)`, Tabelle scrollt vertikal.
- **Bruttobetrag = 0:** Nicht erlaubt (min. 0,01 €), da ein Fixkosteneintrag ohne Betrag keinen Mehrwert hat.
- **Gleichzeitiges Bearbeiten:** Optimistic-UI; bei Server-Fehler wird die Änderung rückgängig gemacht und eine Toast-Fehlermeldung angezeigt.

---

## Technical Requirements

- **Auth:** Alle API-Endpunkte erfordern eine gültige Sitzung (`requireAuth`). RLS auf Datenbankebene sichert user-spezifischen Datenzugriff.
- **Performance:** Listenabruf < 300 ms; Formularspeicherung < 500 ms.
- **Validierung:** Serverseitig Zod-Schema; clientseitig `react-hook-form` + Zod-Resolver.
- **Komponenten:** shadcn/ui für Dialog, Button, Input, Select, Switch, Badge, Table.
- **DB-Tabelle:** `operative_fixkosten_einstellungen` mit Spalten: `id`, `user_id`, `kategorie_id` (FK auf `kpi_categories`), `name`, `zahlungsfrequenz` (enum: monatlich/quartalsweise/jaehrlich), `faelligkeits_monate` (int[] — Monatsnummern 1–12), `zeitpunkt_im_monat` (enum: anfang/mitte/ende), `bruttobetrag` (numeric), `aktiv` (bool), `created_at`, `updated_at`.
- **API-Routen:** `GET/POST /api/operative-fixkosten-einstellungen` und `PUT/DELETE /api/operative-fixkosten-einstellungen/[id]`.

---

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung/operative-fixkosten-einstellungen/page.tsx
└── OperativeFixkostenSeite          (Client Component, orchestriert alles)
    ├── Auswertungsblock             (inline, kein eigenes File — klein genug)
    │   ├── Kennzahl-Karte           (shadcn Card)
    │   │   ├── "Fixkosten gesamt monatlich: X.XXX,XX €"
    │   │   └── Button "Mehr" / "Weniger"  (shadcn Button, variant=ghost)
    │   └── Kategorieaufschlüsselung (aufklappbar, shadcn Collapsible)
    │       └── Zeile je Kategorie: Name + Monatsbetrag (absteigend sortiert)
    ├── Toolbar
    │   ├── Kategorie-Filter         (shadcn Select)
    │   └── Button "+ Fixkosten anlegen"  (shadcn Button)
    ├── OperativeFixkostenTabelle    (src/components/operative-fixkosten-tabelle.tsx)
    │   ├── shadcn Table
    │   │   └── Zeilen: Kategorie | Name | Frequenz | Monate | Zeitpunkt |
    │   │               Bruttobetrag | Bruttobetrag mtl. | Aktiv | Aktionen
    │   ├── Badge (Aktiv / Inaktiv)
    │   ├── Button "Bearbeiten"  → öffnet Dialog im Edit-Modus
    │   └── Button "Löschen"    → öffnet AlertDialog
    └── OperativeFixkostenFormularDialog  (src/components/operative-fixkosten-formular-dialog.tsx)
        ├── shadcn Dialog
        ├── react-hook-form + Zod-Schema
        ├── Kategorie-Select  (Optionen: Ebene-1-Kinder von "Operativ")
        ├── Name-Input
        ├── Frequenz-Select  (Monatlich / Quartalsweise / Jährlich)
        ├── [konditionell] Monat-Select für Jährlich   (1 Dropdown)
        ├── [konditionell] Quartals-Selects Q1–Q4      (4 Dropdowns)
        ├── Zeitpunkt-Select  (Anfang / Mitte / Ende)
        ├── Bruttobetrag-Input
        └── Aktiv-Switch
```

---

### Datenmodell

**Neue Datenbanktabelle:** `operative_fixkosten_einstellungen`

| Spalte | Typ | Details |
|--------|-----|---------|
| `id` | UUID | Primärschlüssel, auto-generiert |
| `user_id` | UUID | FK auf `auth.users`, RLS-Anker |
| `kategorie_id` | UUID | FK auf `kpi_categories(id)`, ON DELETE RESTRICT |
| `name` | text | max. 100 Zeichen |
| `zahlungsfrequenz` | enum | `monatlich`, `quartalsweise`, `jaehrlich` |
| `faelligkeits_monate` | integer[] | Monatsnummern 1–12; leer bei monatlich, 1 Zahl bei jährlich, 4 Zahlen bei quartalsweise |
| `zeitpunkt_im_monat` | enum | `anfang`, `mitte`, `ende` |
| `bruttobetrag` | numeric(12,2) | Positiv, > 0 |
| `aktiv` | boolean | Standard: true |
| `created_at` | timestamptz | auto |
| `updated_at` | timestamptz | auto, wird bei jedem Update gesetzt |

**Beziehungen:**
- `kategorie_id` → `kpi_categories.id` — stellt sicher, dass nur existierende KPI-Kategorien referenziert werden.
- `user_id` → `auth.users.id` — RLS isoliert Einträge pro Nutzer.

**Neue PostgreSQL-Enum-Typen:**
- `fixkosten_frequenz`: `monatlich`, `quartalsweise`, `jaehrlich`
- `zeitpunkt_im_monat`: `anfang`, `mitte`, `ende`

---

### API-Routen

| Route | Methode | Zweck |
|-------|---------|-------|
| `/api/operative-fixkosten-einstellungen` | GET | Alle Einträge des Nutzers laden (inkl. JOIN auf `kpi_categories` für Kategoriename) |
| `/api/operative-fixkosten-einstellungen` | POST | Neuen Eintrag anlegen |
| `/api/operative-fixkosten-einstellungen/[id]` | PUT | Eintrag bearbeiten |
| `/api/operative-fixkosten-einstellungen/[id]` | DELETE | Eintrag löschen |

Der GET-Endpunkt gibt zusätzlich den Kategorienamen aus dem JOIN zurück, damit der Client nicht separat die KPI-Kategorien laden muss.

---

### Custom Hook: `use-operative-fixkosten.ts`

Kapselt den gesamten Datenzugriff und Zustand:
- Lädt alle Einträge beim Mount
- Stellt Funktionen bereit: `create`, `update`, `remove`
- Hält den lokalen State aktuell (optimistic updates)
- Gibt Lade- und Fehlerzustand zurück

Die **Berechnung von Bruttobetrag monatlich** und die **Aggregation für den Auswertungsblock** erfolgen vollständig clientseitig im Hook via `useMemo` — kein separater API-Aufruf nötig.

---

### Kategorien-Auflösung

Die verfügbaren Kategorien für das Formular werden über den bestehenden Endpunkt `/api/kpi-categories?type=ausgaben_kosten` geladen (bereits in der App vorhanden via `useKpiCategories`-Hook). Clientseitig wird dann gefiltert: nur Einträge mit `level = 2`, deren `parent_id` auf den Knoten mit `name = 'Operativ'` (case-insensitive) zeigt.

---

### Berechnungslogik (clientseitig)

- **Monatlich:** `bruttobetrag × 1`
- **Quartalsweise:** `bruttobetrag ÷ 3`
- **Jährlich:** `bruttobetrag ÷ 12`

Auswertungsblock-Summe = Summe aller `bruttobetrag_monatlich` wo `aktiv = true` (und optional: Kategoriefilter aktiv).

---

### Datenbankänderungen (Migration)

1. Zwei neue Enum-Typen anlegen (`fixkosten_frequenz`, `zeitpunkt_im_monat`)
2. Neue Tabelle `operative_fixkosten_einstellungen` anlegen
3. RLS aktivieren + 4 Policies (SELECT, INSERT, UPDATE, DELETE) — alle an `user_id = auth.uid()` gebunden
4. Index auf `(user_id, kategorie_id)` für schnelle Filterabfragen

---

### Navigationserweiterung

In `src/app/dashboard/kurzfristige-planung/page.tsx` wird im Abschnitt „Einstellungen" eine neue Karte hinzugefügt — analog zu den bestehenden Einstellungskarten (gleicher Style, gleiche Struktur).

---

### Technologiewahl

| Entscheidung | Begründung |
|---|---|
| Enum-Typen in der DB | Sichert Datenkonsistenz auf DB-Ebene; verhindert ungültige Werte ohne App-Code |
| `integer[]` für Monate | Flexibel für 1–4 Monatsnummern; einfache Validierung auf API-Ebene |
| Berechnung clientseitig | Kein zusätzlicher Endpunkt nötig; Daten sind bereits vollständig im Client |
| Auswertung als Collapsible | shadcn `Collapsible` ist bereits installiert; kein Extra-Dialog nötig |
| JOIN im GET-Endpunkt | Spart einen separaten API-Call für Kategorienamen |

## QA Test Results

**QA Date:** 2026-06-04
**Tester:** /qa skill (automated + manual)
**Result: APPROVED — Production-Ready**

### Implementation Notes (deviations from spec)
- Spec specified "Bruttobetrag" as the input field; implementation uses **Nettobetrag + USt-Dropdown** (wie Ausgaben/Kosten), with brutto auto-calculated. This was a user-requested change during development.
- All "monatlich"-Spalten and Auswertungsblock show **Netto monatlich** (not Brutto monatlich).
- Table column order: Brutto → Netto → Netto mtl. (USt column removed per user request).
- Page title and description header removed from the top of the page per user request.

### Automated Tests
| Suite | Tests | Result |
|-------|-------|--------|
| Vitest — API GET/POST `/api/operative-fixkosten-einstellungen` | 11 | ✅ All pass |
| Vitest — API PUT/DELETE `/api/operative-fixkosten-einstellungen/[id]` | 10 | ✅ All pass |
| Vitest — Hook unit tests (`berechneNettoMonatlich`, `formatFaelligkeitsMonate`) | 13 | ✅ All pass |
| Playwright E2E — page exists, auth-guard, regression | 12 (6 chromium + 6 mobile safari) | ✅ All pass |
| **Total** | **46** | **✅ 46/46 passed** |

Note: 100 failures exist in unrelated test files (reporting, ausgaben-kosten-transaktionen) — these are **pre-existing** regressions, not caused by PROJ-55.

### Acceptance Criteria Results
| # | Criterion | Result |
|---|-----------|--------|
| 1 | Seite unter `/dashboard/kurzfristige-planung/operative-fixkosten-einstellungen` erreichbar | ✅ Pass |
| 2 | Kachel auf Übersichtsseite vorhanden | ✅ Pass |
| 3 | Linke Navigation enthält Eintrag | ✅ Pass |
| 4 | "+ Fixkosten anlegen" öffnet Dialog | ✅ Pass |
| 5 | Kategorie-Dropdown zeigt Level-2-Kinder von "Operativ" | ✅ Pass |
| 6 | Name-Feld mit max. 100 Zeichen | ✅ Pass |
| 7 | Zahlungsfrequenz: Monatlich/Quartalsweise/Jährlich | ✅ Pass |
| 8 | Jährlich: 1 Monat-Dropdown erscheint | ✅ Pass |
| 9 | Quartalsweise: 4 Quartals-Dropdowns erscheinen | ✅ Pass |
| 10 | Zeitpunkt im Monat: Anfang/Mitte/Ende | ✅ Pass |
| 11 | Nettobetrag + USt-Dropdown (0%/7%/19%/Individuell) | ✅ Pass (deviation from spec: Netto statt Brutto) |
| 12 | Individuell: zusätzliches Betrag-Feld erscheint | ✅ Pass |
| 13 | Brutto-Vorschau bei Netto > 0 | ✅ Pass |
| 14 | Aktiv-Toggle Standard = aktiv | ✅ Pass |
| 15 | Validierung Pflichtfelder (client + server) | ✅ Pass |
| 16 | Tabelle mit allen Spalten | ✅ Pass |
| 17 | Netto mtl. berechnet korrekt (÷1/÷3/÷12) | ✅ Pass |
| 18 | Fälligkeitsmonat(e): "Alle Monate" / kurze Monatsnamen | ✅ Pass |
| 19 | Badge Aktiv/Inaktiv | ✅ Pass |
| 20 | Kategorie-Filter (Einfachauswahl + "Alle Kategorien") | ✅ Pass |
| 21 | Bearbeiten öffnet vorausgefülltes Formular | ✅ Pass |
| 22 | Optimistisches Update bei Bearbeiten | ✅ Pass |
| 23 | Löschen mit Bestätigungs-Dialog (zeigt Eintragsname) | ✅ Pass |
| 24 | Leerzustand mit Button | ✅ Pass |
| 25 | Auswertungsblock: Gesamte Fixkosten netto monatlich | ✅ Pass |
| 26 | Inaktive Einträge in Auswertung ausgeschlossen | ✅ Pass |
| 27 | "Mehr"-Button klappt Kategorieaufschlüsselung auf | ✅ Pass |
| 28 | Auswertung reagiert auf Kategorie-Filter | ✅ Pass |
| 29 | Kein "Operativ"-Knoten: leeres Dropdown mit Hinweis | ✅ Pass |

### Security Audit
- ✅ Auth-Guard: Unauthentifizierte Nutzer werden zu `/login` weitergeleitet
- ✅ RLS: Alle DB-Policies an `user_id = auth.uid()` gebunden
- ✅ API-Autorisierung: PUT/DELETE filtern auf `user_id` des authentifizierten Nutzers (404 bei fremden Einträgen)
- ✅ Input-Validierung: Zod-Schema auf API-Ebene; netto > 0, max 10M, valide Frequenzwerte, korrekte Monatsverteilung
- ✅ Keine SQL-Injection-Risiken (Supabase parameterisierte Abfragen)
- ✅ Keine sensiblen Daten in API-Responses

### Bugs Found
None — no critical or high bugs identified.

## Deployment
_To be added by /deploy_
