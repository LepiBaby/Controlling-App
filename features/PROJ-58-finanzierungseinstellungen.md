# PROJ-58: Finanzierungseinstellungen — Kurzfristige Planung

## Status: Approved
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

## Dependencies
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Kategorien unter „Finanzierung" im ausgaben_kosten-Baum werden als Auswahlwerte geladen
- Requires: PROJ-41 (Bereichswechsler) — Seite liegt unter Kurzfristige Planung > Einstellungen
- Requires: PROJ-50 (Grundeinstellungen) — Planungskontext vorhanden
- Analogie: PROJ-55 (Operative Fixkosten-Einstellungen) — identische Struktur, andere Kategoriequelle

## Overview
Eine neue Einstellungsseite unter dem Bereich **Kurzfristige Planung → Einstellungen** mit dem Titel „Finanzierungseinstellungen". Nutzer können wiederkehrende Finanzierungskosten (z. B. Kredite, Leasingverträge, Zinszahlungen) mit Kategorie, Name, Zahlungsfrequenz, Fälligkeitsmonat(en), Zeitpunkt, Nettobetrag, Umsatzsteuer und Aktivitätsstatus anlegen, bearbeiten und löschen. Oberhalb der Tabelle gibt es einen kompakten Auswertungsblock mit der monatlichen Gesamtsumme und einer aufklappbaren Kategorieaufschlüsselung.

---

## User Stories

- Als Controlling-Mitarbeiter möchte ich Finanzierungseinträge anlegen können, damit ich wiederkehrende Finanzierungskosten strukturiert in der kurzfristigen Planung erfassen kann.
- Als Controlling-Mitarbeiter möchte ich die Zahlungsfrequenz (monatlich, quartalsweise, jährlich) und die betroffenen Monate je Eintrag definieren, damit die Planung zeitlich korrekt abgebildet wird.
- Als Controlling-Mitarbeiter möchte ich jeden Finanzierungseintrag einer KPI-Kategorie (Ebene 1 unterhalb „Finanzierung") zuordnen, damit Kosten im Reporting der richtigen Kostenstelle zugerechnet werden.
- Als Controlling-Mitarbeiter möchte ich Nettobetrag und Umsatzsteuer getrennt eingeben, damit Brutto- und Nettobeträge automatisch berechnet und korrekt ausgewiesen werden.
- Als Controlling-Mitarbeiter möchte ich bestehende Einträge bearbeiten und löschen können, damit die Daten aktuell bleiben.
- Als Controlling-Mitarbeiter möchte ich die Liste nach Kategorie filtern können, damit ich schnell relevante Einträge finde.
- Als Controlling-Mitarbeiter möchte ich eine berechnete Spalte „Netto monatlich" sehen, damit ich die monatliche Kostenbelastung je Finanzierungsposition vergleichen kann.
- Als Controlling-Mitarbeiter möchte ich Finanzierungseinträge als inaktiv markieren können, damit nicht mehr relevante Einträge erhalten bleiben, aber nicht in die Planung einfließen.

---

## Acceptance Criteria

### Seite & Navigation
- [ ] Die Seite ist unter `/dashboard/kurzfristige-planung/finanzierungseinstellungen` erreichbar.
- [ ] Auf der Übersichtsseite Kurzfristige Planung (`/dashboard/kurzfristige-planung/page.tsx`) erscheint eine neue Karte „Finanzierungseinstellungen" im Abschnitt „Einstellungen".
- [ ] Die linke Navigation enthält einen Eintrag „Finanzierungseinstellungen" unter Kurzfristige Planung.

### Formular — Neuen Eintrag anlegen
- [ ] Ein Button „+ Finanzierung anlegen" öffnet ein Dialog-Formular.
- [ ] **Kategorie (Pflicht):** Dropdown mit allen KPI-Kategorien der Ebene 1, deren `parent_id` auf die Kategorie mit `type = 'ausgaben_kosten'` und `name = 'Finanzierung'` (case-insensitive) zeigt. Falls kein solcher Knoten existiert, zeigt die Auswahl einen leeren Zustand mit Hinweis.
- [ ] **Name (Pflicht):** Freitextfeld, min. 1 Zeichen, max. 100 Zeichen.
- [ ] **Zahlungsfrequenz (Pflicht):** Dropdown mit Optionen: `Monatlich`, `Quartalsweise`, `Jährlich`.
- [ ] **Fälligkeitsmonat — nur wenn Frequenz = Jährlich:** Einfach-Auswahl eines Kalendermonats (Januar–Dezember) als Dropdown. Pflichtfeld wenn Frequenz = Jährlich.
- [ ] **Fälligkeitsmonat(e) — nur wenn Frequenz = Quartalsweise:** Auswahl von je einem Monat pro Quartal: Q1 (Jan/Feb/Mär), Q2 (Apr/Mai/Jun), Q3 (Jul/Aug/Sep), Q4 (Okt/Nov/Dez). Alle vier Quartals-Dropdowns sind Pflichtfelder wenn Frequenz = Quartalsweise.
- [ ] **Zeitpunkt im Monat (Pflicht):** Dropdown mit Optionen: `Anfang`, `Mitte`, `Ende`.
- [ ] **Nettobetrag (Pflicht):** Zahl (€), min. 0,01, max. 10.000.000, zwei Dezimalstellen.
- [ ] **USt (Pflicht):** Dropdown mit Optionen: `0 %`, `7 %`, `19 %`, `Individuell`. Standard: `0 %`.
- [ ] **Individueller USt-Betrag:** Nur sichtbar wenn USt = `Individuell`. Numerisches Eingabefeld (€), min. 0, zwei Dezimalstellen.
- [ ] **Brutto-Vorschau:** Unterhalb des Nettobetrag-Feldes wird der berechnete Bruttobetrag (Netto + USt) angezeigt, sobald Nettobetrag > 0.
- [ ] **Aktiv:** Schalter (Toggle/Switch), Standard = aktiviert.
- [ ] Alle Pflichtfelder werden client- und serverseitig validiert.
- [ ] Das Formular zeigt bei Validierungsfehlern spezifische Inline-Fehlermeldungen.
- [ ] Nach erfolgreichem Speichern schließt das Formular und der neue Eintrag erscheint sofort in der Tabelle.

### Tabelle
- [ ] Alle Finanzierungseinträge des Nutzers werden tabellarisch angezeigt mit Spalten: **Kategorie**, **Name**, **Frequenz**, **Fälligkeitsmonat(e)**, **Zeitpunkt**, **Nettobetrag (€)**, **Bruttobetrag (€)**, **Netto monatlich (€)**, **Aktiv**, **Aktionen**.
- [ ] **Spalte „Netto monatlich"** berechnet sich wie folgt:
  - Monatlich → Nettobetrag × 1
  - Quartalsweise → Nettobetrag ÷ 3
  - Jährlich → Nettobetrag ÷ 12
- [ ] Die Spalte „Netto monatlich" wird auf 2 Dezimalstellen gerundet und als Euro-Betrag formatiert.
- [ ] Die Spalte „Fälligkeitsmonat(e)" zeigt bei monatlicher Frequenz „Alle Monate", bei quartalsweiser die vier gewählten Monatsnamen (z. B. „Feb, Mai, Aug, Nov"), bei jährlicher den gewählten Monatsnamen (z. B. „März").
- [ ] Die Spalte „Aktiv" zeigt einen Badge (Aktiv / Inaktiv).
- [ ] Jede Zeile hat eine Schaltfläche „Bearbeiten" (öffnet das Formular vorausgefüllt) und „Löschen" (mit Bestätigungsdialog).

### Filter
- [ ] Über der Tabelle befindet sich ein Kategorie-Filter (Einfach-Auswahl), der die Tabelle clientseitig nach der gewählten Kategorie filtert.
- [ ] Eine Option „Alle Kategorien" setzt den Filter zurück.

### Bearbeiten
- [ ] „Bearbeiten" öffnet das Formular mit allen gespeicherten Werten vorausgefüllt.
- [ ] Alle Felder bleiben editierbar, inklusive Frequenz (mit entsprechender Anpassung der Monatsauswahl).
- [ ] Nach dem Speichern aktualisiert sich der Eintrag in der Tabelle sofort.

### Löschen
- [ ] „Löschen" öffnet einen Bestätigungsdialog mit dem Eintragsname: „Soll dieser Finanzierungseintrag wirklich gelöscht werden?"
- [ ] Nach Bestätigung wird der Eintrag permanent gelöscht und aus der Tabelle entfernt.
- [ ] Abbrechen schließt den Dialog ohne Änderungen.

### Leerzustand
- [ ] Wenn noch keine Einträge vorhanden sind, zeigt die Seite einen Hinweistext und den Button „+ Finanzierung anlegen".

### Auswertungsblock (oben auf der Seite)
- [ ] Oberhalb der Tabelle wird ein kompakter Auswertungsblock angezeigt.
- [ ] Der Block zeigt eine einzige Kennzahl: **Gesamte Finanzierungskosten netto monatlich (€)** — die Summe aller monatlichen Nettobeträge aller aktiven Einträge.
- [ ] Inaktive Einträge fließen **nicht** in die Gesamtsumme ein.
- [ ] Neben oder unterhalb der Kennzahl befindet sich ein Button **„Mehr"**, der die Kategorieaufschlüsselung ein- und ausblendet (Toggle).
- [ ] Die Kategorieaufschlüsselung zeigt je aktiver Kategorie eine Zeile mit: Kategoriename und monatlicher Netto-Summe aller aktiven Einträge in dieser Kategorie, absteigend nach Betrag sortiert.
- [ ] Die Kategorieaufschlüsselung berücksichtigt denselben Kategoriefilter wie die Tabelle.
- [ ] Wenn kein aktiver Eintrag vorhanden ist, zeigt der Block „0,00 €" und der „Mehr"-Button ist ausgeblendet.

---

## Edge Cases

- **Kein „Finanzierung"-Knoten im KPI-Modell:** Das Kategorie-Dropdown ist leer und zeigt den Text „Keine Kategorien gefunden. Bitte zuerst die Kategorie ‚Finanzierung' im KPI-Modell anlegen."
- **Frequenzwechsel beim Bearbeiten:** Wechselt der Nutzer die Frequenz (z. B. von Quartalsweise auf Monatlich), werden die Monatsauswahl-Felder ausgeblendet und ihre Werte verworfen.
- **Quartalsmonat-Validierung:** Für jedes Quartal darf nur ein Monat aus den zugehörigen Monaten ausgewählt werden (Q1: Jan/Feb/Mär, Q2: Apr/Mai/Jun, Q3: Jul/Aug/Sep, Q4: Okt/Nov/Dez). Der Server validiert, dass die gespeicherten Monate korrekt auf die Quartale verteilt sind.
- **USt = Individuell:** Wenn der individuelle USt-Betrag leer bleibt, wird 0 € angenommen; die Brutto-Vorschau zeigt entsprechend Netto = Brutto.
- **Gleichnamige Einträge:** Name + Kategorie müssen nicht eindeutig sein (Duplikate sind erlaubt).
- **Inaktiver Eintrag:** Inaktive Einträge erscheinen in der Tabelle (mit Badge „Inaktiv") und werden für spätere Planungsschritte ignoriert, bleiben aber vollständig editierbar.
- **Sehr viele Einträge:** API-Abfrage mit `.limit(500)`, Tabelle scrollt vertikal.
- **Nettobetrag = 0:** Nicht erlaubt (min. 0,01 €).
- **Gleichzeitiges Bearbeiten:** Optimistic-UI; bei Server-Fehler wird die Änderung rückgängig gemacht und eine Toast-Fehlermeldung angezeigt.

---

## Technical Requirements

- **Auth:** Alle API-Endpunkte erfordern eine gültige Sitzung (`requireAuth`). RLS auf Datenbankebene sichert user-spezifischen Datenzugriff.
- **Performance:** Listenabruf < 300 ms; Formularspeicherung < 500 ms.
- **Validierung:** Serverseitig Zod-Schema; clientseitig `react-hook-form` + Zod-Resolver.
- **Komponenten:** shadcn/ui für Dialog, Button, Input, Select, Switch, Badge, Table — analog zu PROJ-55.
- **DB-Tabelle:** `finanzierungs_einstellungen` mit Spalten: `id`, `user_id`, `kategorie_id` (FK auf `kpi_categories`), `name`, `zahlungsfrequenz` (enum: monatlich/quartalsweise/jaehrlich), `faelligkeits_monate` (int[]), `zeitpunkt_im_monat` (enum: anfang/mitte/ende), `nettobetrag` (numeric), `ust_betrag` (numeric), `aktiv` (bool), `created_at`, `updated_at`.
- **API-Routen:** `GET/POST /api/finanzierungseinstellungen` und `PUT/DELETE /api/finanzierungseinstellungen/[id]`.
- **Enum-Typen:** Bestehende Enums `fixkosten_frequenz` und `zeitpunkt_im_monat` aus PROJ-55 werden wiederverwendet — keine neuen Enum-Typen nötig.

---

## Tech Design (Solution Architect)

### Implementierungsnotizen

**Abweichungen / Entscheidungen:**
- DB-Spaltentypen: TEXT mit CHECK-Constraints (statt PostgreSQL-Enum-Typen), analog zur tatsächlichen Implementierung von PROJ-55
- USt-Standard im Frontend: `0 %` (typisch für Finanzierungskosten wie Kredite/Zinsen)
- Enum-Typen aus PROJ-55 nicht wiederverwendet — stattdessen Text-Constraints für Konsistenz

### Komponentenstruktur

```
/dashboard/kurzfristige-planung/finanzierungseinstellungen/page.tsx
└── FinanzierungseinstellungenPage (Client Component)
    ├── Auswertungsblock (Card + Collapsible)
    ├── Toolbar (Select-Filter + Button)
    ├── FinanzierungsEinstellungenTabelle (src/components/finanzierungs-einstellungen-tabelle.tsx)
    └── FinanzierungsEinstellungenFormularDialog (src/components/finanzierungs-einstellungen-formular-dialog.tsx)
```

### Datenmodell

**Tabelle:** `finanzierungs_einstellungen`

| Spalte | Typ | Details |
|--------|-----|---------|
| `id` | UUID | PK, auto-generiert |
| `user_id` | UUID | FK → auth.users, RLS-Anker |
| `kategorie_id` | UUID | FK → kpi_categories, ON DELETE RESTRICT |
| `name` | text | 1–100 Zeichen |
| `zahlungsfrequenz` | text | CHECK IN ('monatlich','quartalsweise','jaehrlich') |
| `faelligkeits_monate` | integer[] | leer bei monatlich, 1 Zahl bei jährlich, 4 bei quartalsweise |
| `zeitpunkt_im_monat` | text | CHECK IN ('anfang','mitte','ende') |
| `betrag_netto` | numeric(12,2) | > 0 |
| `ust_satz` | text | CHECK IN ('0','7','19','individuell'), Default '0' |
| `ust_betrag` | numeric(12,2) | ≥ 0 |
| `bruttobetrag` | numeric(12,2) | ≥ 0 |
| `aktiv` | boolean | Default true |
| `created_at` | timestamptz | auto |
| `updated_at` | timestamptz | auto, bei Update gesetzt |

### API-Routen

| Route | Methode | Zweck |
|-------|---------|-------|
| `/api/finanzierungseinstellungen` | GET | Alle Einträge des Nutzers (inkl. JOIN kpi_categories) |
| `/api/finanzierungseinstellungen` | POST | Neuen Eintrag anlegen |
| `/api/finanzierungseinstellungen/[id]` | PUT | Eintrag bearbeiten |
| `/api/finanzierungseinstellungen/[id]` | DELETE | Eintrag löschen |

### Custom Hook

`src/hooks/use-finanzierungs-einstellungen.ts` — analog zu use-operative-fixkosten.ts

## QA Test Results

**QA Date:** 2026-06-04
**Tester:** /qa skill (automated + manual)
**Result: APPROVED — Production-Ready**

### Implementation Notes (deviations from spec)
- Spec mentioned `nettobetrag` als Spaltenname in der DB-Tabelle; tatsächliche Implementierung nutzt `betrag_netto` (analog zu PROJ-55)
- USt-Standard im Formular: `0 %` statt `19 %` (da Finanzierungskosten typischerweise 0 % USt haben)
- DB nutzt TEXT+CHECK-Constraints statt PostgreSQL-Enum-Typen (Konsistenz mit PROJ-55)

### Automated Tests
| Suite | Tests | Result |
|-------|-------|--------|
| Vitest — API GET/POST `/api/finanzierungseinstellungen` | 11 | ✅ All pass |
| Vitest — API PUT/DELETE `/api/finanzierungseinstellungen/[id]` | 10 | ✅ All pass |
| Vitest — Hook unit tests (`berechneNettoMonatlich`, `formatFaelligkeitsMonate`) | 15 | ✅ All pass |
| Playwright E2E — page exists, auth-guard, regression | 12 (6 chromium + 6 mobile safari) | ✅ All pass |
| **Total** | **48** | **✅ 48/48 passed** |

### Acceptance Criteria Results
| # | Criterion | Result |
|---|-----------|--------|
| 1 | Seite unter `/dashboard/kurzfristige-planung/finanzierungseinstellungen` erreichbar | ✅ Pass |
| 2 | Kachel auf Übersichtsseite vorhanden | ✅ Pass |
| 3 | Linke Navigation enthält Eintrag | ✅ Pass |
| 4 | "+ Finanzierung anlegen" öffnet Dialog | ✅ Pass |
| 5 | Kategorie-Dropdown zeigt Level-2-Kinder von "Finanzierung" | ✅ Pass |
| 6 | Name-Feld mit max. 100 Zeichen | ✅ Pass |
| 7 | Zahlungsfrequenz: Monatlich/Quartalsweise/Jährlich | ✅ Pass |
| 8 | Jährlich: 1 Monat-Dropdown erscheint | ✅ Pass |
| 9 | Quartalsweise: 4 Quartals-Dropdowns erscheinen | ✅ Pass |
| 10 | Zeitpunkt im Monat: Anfang/Mitte/Ende | ✅ Pass |
| 11 | Nettobetrag + USt-Dropdown (0%/7%/19%/Individuell) — Standard 0% | ✅ Pass (deviation from spec: default 0% statt 19%) |
| 12 | Individuell: zusätzliches Betrag-Feld erscheint | ✅ Pass |
| 13 | Brutto-Vorschau bei Netto > 0 | ✅ Pass |
| 14 | Aktiv-Toggle Standard = aktiv | ✅ Pass |
| 15 | Validierung Pflichtfelder (client + server) | ✅ Pass |
| 16 | Tabelle mit allen Spalten (inkl. Netto/Brutto/Netto mtl.) | ✅ Pass |
| 17 | Netto mtl. berechnet korrekt (÷1/÷3/÷12) | ✅ Pass |
| 18 | Fälligkeitsmonat(e): "Alle Monate" / kurze Monatsnamen | ✅ Pass |
| 19 | Badge Aktiv/Inaktiv | ✅ Pass |
| 20 | Kategorie-Filter (Einfachauswahl + "Alle Kategorien") | ✅ Pass |
| 21 | Bearbeiten öffnet vorausgefülltes Formular | ✅ Pass |
| 22 | Optimistisches Update bei Bearbeiten | ✅ Pass |
| 23 | Löschen mit Bestätigungs-Dialog (zeigt Eintragsname) | ✅ Pass |
| 24 | Leerzustand mit Button | ✅ Pass |
| 25 | Auswertungsblock: Gesamte Finanzierungskosten netto monatlich | ✅ Pass |
| 26 | Inaktive Einträge in Auswertung ausgeschlossen | ✅ Pass |
| 27 | "Mehr"-Button klappt Kategorieaufschlüsselung auf | ✅ Pass |
| 28 | Auswertung reagiert auf Kategorie-Filter | ✅ Pass |
| 29 | Kein "Finanzierung"-Knoten: leeres Dropdown mit Hinweis | ✅ Pass |

### Security Audit
- ✅ Auth-Guard: Unauthentifizierte Nutzer werden zu `/login` weitergeleitet
- ✅ RLS: Alle DB-Policies an `user_id = auth.uid()` gebunden (FOR ALL Policy)
- ✅ API-Autorisierung: PUT/DELETE filtern auf `user_id` des authentifizierten Nutzers (404 bei fremden Einträgen)
- ✅ Input-Validierung: Zod-Schema auf API-Ebene; netto > 0, max 10M, valide Frequenzwerte, korrekte Monatsverteilung
- ✅ Keine SQL-Injection-Risiken (Supabase parameterisierte Abfragen)
- ✅ Keine sensiblen Daten in API-Responses

### Bugs Found
None — no critical or high bugs identified.

## Deployment
_To be added by /deploy_
