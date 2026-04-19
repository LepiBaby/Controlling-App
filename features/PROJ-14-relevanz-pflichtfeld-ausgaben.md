# PROJ-14: Relevanz-Pflichtfeld für Ausgaben & Kosten-Transaktionen

## Status: Deployed
**Created:** 2026-04-19
**Last Updated:** 2026-04-19

## Dependencies
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen) — ersetzt das Feld `relevant_fuer_rentabilitaet`
- Requires: PROJ-6 (Rentabilitäts-Auswertung) — Filterlogik wird angepasst
- Requires: PROJ-7 (Liquiditäts-Auswertung) — Filterlogik wird erweitert

## Übersicht
Das bisherige optionale Feld "Relevant für Rentabilität" (Ja/Nein) in der Ausgaben & Kosten-Erfassung wird durch ein Pflichtfeld "Relevanz" mit drei Ausprägungen ersetzt: **Rentabilität**, **Liquidität**, **Beides**. Damit steuert jede Transaktion explizit, in welchen Auswertungen sie erscheint. Bestehende Transaktionen werden migriert. Die Filterlogik in PROJ-6 und PROJ-7 wird entsprechend angepasst.

## Motivation
Bisher erschienen in PROJ-7 (Liquidität) alle Ausgaben-Transaktionen mit Zahlungsdatum — unabhängig vom Rentabilitätsfeld. Das neue Relevanz-Feld gibt dem Nutzer vollständige Kontrolle darüber, welche Transaktionen in welcher Auswertung auftauchen, und macht die Filterlogik konsistent und explizit.

## User Stories
- Als Nutzer möchte ich beim Erfassen einer Ausgaben/Kosten-Transaktion angeben, ob sie für die Rentabilität, die Liquidität oder beides relevant ist, damit sie in der richtigen(en) Auswertung erscheint.
- Als Nutzer möchte ich nicht vergessen können, die Relevanz anzugeben, weil das Feld ein Pflichtfeld ist.
- Als Nutzer möchte ich in der Ausgaben/Kosten-Tabelle sehen, welche Relevanz jede Transaktion hat, damit ich auf einen Blick erkenne, wo sie berücksichtigt wird.
- Als Nutzer möchte ich in der Rentabilitäts-Auswertung nur Ausgaben sehen, die explizit als rentabilitäts- oder beides-relevant markiert sind.
- Als Nutzer möchte ich in der Liquiditäts-Auswertung nur Ausgaben sehen, die explizit als liquiditäts- oder beides-relevant markiert sind und ein Zahlungsdatum haben.

## Acceptance Criteria

### Datenbankschema (Migration)
- [ ] Spalte `relevant_fuer_rentabilitaet` wird durch `relevanz` ersetzt (oder umbenannt und typisiert)
- [ ] `relevanz` ist NOT NULL mit CHECK-Constraint: erlaubte Werte `'rentabilitaet'` / `'liquiditaet'` / `'beides'`
- [ ] Datenmigration:
  - [ ] Alle Zeilen mit `relevant_fuer_rentabilitaet = 'nein'` → `relevanz = 'liquiditaet'`
  - [ ] Alle Zeilen mit `relevant_fuer_rentabilitaet = 'ja'` → `relevanz = 'beides'`
  - [ ] Alle Zeilen mit `relevant_fuer_rentabilitaet IS NULL` → `relevanz = 'beides'`

### PROJ-5: Formular (Eingabe / Bearbeitung)
- [ ] Das Dropdown "Relevant für Rentabilität" (Ja/Nein, optional) wird durch "Relevanz" (Pflichtfeld) ersetzt
- [ ] Dropdown-Optionen: **Rentabilität** / **Liquidität** / **Beides**
- [ ] Speichern ist blockiert, wenn kein Wert ausgewählt wurde (Pflichtfeld-Validierung)
- [ ] Im Edit-Formular wird der gespeicherte Wert vorausgefüllt
- [ ] Das Dropdown zeigt keinen "Leer"-Zustand als wählbare Option

### PROJ-5: Tabelle
- [ ] Die Spalte "Relevant für Rentabilität" wird umbenannt zu **"Relevanz"**
- [ ] Die Spalte zeigt die deutschen Labels: **Rentabilität** / **Liquidität** / **Beides**
- [ ] Die Spalte ist weiterhin immer sichtbar

### PROJ-6: Rentabilitäts-Auswertung — neue Filterlogik
- [ ] Ausgaben & Kosten-Transaktionen werden nur in die Auswertung aufgenommen, wenn:
  - `relevanz IN ('rentabilitaet', 'beides')`
  - UND `leistungsdatum IS NOT NULL`
  - UND `abschreibung IS NULL`
- [ ] Die bisherige Logik `relevant_fuer_rentabilitaet IN ('ja', NULL)` entfällt vollständig
- [ ] Transaktionen mit `relevanz = 'liquiditaet'` erscheinen NICHT in der Rentabilitäts-Auswertung

### PROJ-7: Liquiditäts-Auswertung — neue Filterlogik
- [ ] Ausgaben & Kosten-Transaktionen werden nur in die Auswertung aufgenommen, wenn:
  - `zahlungsdatum IS NOT NULL`
  - UND `relevanz IN ('liquiditaet', 'beides')`
- [ ] Die bisherige Logik (nur `zahlungsdatum IS NOT NULL`, kein Relevanz-Filter) entfällt
- [ ] Transaktionen mit `relevanz = 'rentabilitaet'` erscheinen NICHT in der Liquiditäts-Auswertung

### API-Validierung
- [ ] POST `/api/ausgaben-kosten-transaktionen`: `relevanz` ist Pflichtfeld — fehlt es, gibt die API 400 zurück
- [ ] PATCH `/api/ausgaben-kosten-transaktionen/[id]`: `relevanz` darf nicht auf NULL oder ungültigen Wert gesetzt werden
- [ ] Ungültige `relevanz`-Werte (alles außer `'rentabilitaet'` / `'liquiditaet'` / `'beides'`) → 400

## Tabellen-Spalte

| Spalte | Pflicht | Typ | Werte |
|--------|---------|-----|-------|
| Relevanz | **Ja** (Pflichtfeld) | Enum | `rentabilitaet` / `liquiditaet` / `beides` |

Anzeigelabels im UI:
| DB-Wert | Anzeigetext |
|---------|------------|
| `rentabilitaet` | Rentabilität |
| `liquiditaet` | Liquidität |
| `beides` | Beides |

## Filterlogik-Vergleich (Alt vs. Neu)

### PROJ-6 (Rentabilität)

**Alt:**
```
relevant_fuer_rentabilitaet IN ('ja', NULL)
AND leistungsdatum IS NOT NULL
AND abschreibung IS NULL
```

**Neu:**
```
relevanz IN ('rentabilitaet', 'beides')
AND leistungsdatum IS NOT NULL
AND abschreibung IS NULL
```

### PROJ-7 (Liquidität)

**Alt:**
```
zahlungsdatum IS NOT NULL
```

**Neu:**
```
zahlungsdatum IS NOT NULL
AND relevanz IN ('liquiditaet', 'beides')
```

## Datenmigration (Detail)

```sql
-- Schritt 1: Spalte umbenennen und Typ anpassen
ALTER TABLE ausgaben_kosten_transaktionen
  RENAME COLUMN relevant_fuer_rentabilitaet TO relevanz;

-- Schritt 2: Bestehende Werte migrieren
UPDATE ausgaben_kosten_transaktionen
  SET relevanz = 'liquiditaet'
  WHERE relevanz = 'nein';

UPDATE ausgaben_kosten_transaktionen
  SET relevanz = 'beides'
  WHERE relevanz = 'ja' OR relevanz IS NULL;

-- Schritt 3: NOT NULL + CHECK-Constraint setzen
ALTER TABLE ausgaben_kosten_transaktionen
  ALTER COLUMN relevanz SET NOT NULL;

ALTER TABLE ausgaben_kosten_transaktionen
  ADD CONSTRAINT relevanz_check
  CHECK (relevanz IN ('rentabilitaet', 'liquiditaet', 'beides'));
```

## Edge Cases
- Neue Transaktion ohne Relevanz-Auswahl → Speichern blockiert (Client + Server-seitige Validierung)
- Edit einer alten Transaktion: Formular zeigt migrierten Wert vorausgefüllt (kein leerer Zustand)
- PATCH-Request ohne `relevanz`-Feld → bestehender Wert bleibt unverändert (Partial Update)
- PATCH-Request mit `relevanz: null` → API gibt 400 zurück
- Nach Migration: keine Transaktion hat `relevanz = NULL` → NOT NULL-Constraint ist erfüllt
- Transaktion mit `relevanz = 'rentabilitaet'` hat Zahlungsdatum → erscheint trotzdem NICHT in PROJ-7
- Transaktion mit `relevanz = 'liquiditaet'` hat Leistungsdatum → erscheint trotzdem NICHT in PROJ-6

## Technical Requirements

### Datenbankänderungen
- Tabelle: `ausgaben_kosten_transaktionen`
- Migration: `relevant_fuer_rentabilitaet` → `relevanz` (rename + type change + NOT NULL + CHECK)
- Migrationsstrategie: `'nein'` → `'liquiditaet'`; `'ja'` und `NULL` → `'beides'`

### Geänderte Dateien (voraussichtlich)
| Datei | Änderung |
|-------|---------|
| `src/app/api/ausgaben-kosten-transaktionen/route.ts` | Zod-Schema: `relevanz` als required enum |
| `src/app/api/ausgaben-kosten-transaktionen/[id]/route.ts` | PATCH-Schema: `relevanz` enum, kein null |
| `src/components/ausgaben-form-dialog.tsx` | Dropdown Pflichtfeld, neue Labels |
| `src/components/ausgaben-table.tsx` | Spaltenname + Labels |
| `src/hooks/use-ausgaben-kosten-transaktionen.ts` | Typdefinition: `relevanz` required |
| `src/app/api/rentabilitaet/route.ts` | Filter: `relevanz IN (...)` statt `relevant_fuer_rentabilitaet` |
| `src/app/api/liquiditaet/route.ts` | Filter: `relevanz IN (...)` hinzufügen |
| Supabase Migration | SQL-Migration für Datenbankänderung |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Übersicht der Änderungen

PROJ-14 ist eine **reine Änderung an bestehenden Dateien** — keine neuen Seiten, keine neuen Komponenten. Es werden 7 bestehende Dateien angepasst sowie eine Datenbank-Migration durchgeführt.

### Komponenten-Struktur

Keine neuen Komponenten. Folgende bestehende Teile werden verändert:

```
AusgabenFormDialog (src/components/ausgaben-form-dialog.tsx)
  └── Feld "Relevant für Rentabilität" (optional, Ja/Nein)
      → ersetzt durch "Relevanz" (Pflichtfeld: Rentabilität / Liquidität / Beides)
      → Speichern-Button bleibt deaktiviert solange kein Wert gewählt

AusgabenTable (src/components/ausgaben-table.tsx)
  └── Spaltenheader "Relevant für Rentabilität"
      → umbenannt zu "Relevanz"
  └── Zellinhalt "Ja" / "Nein" / leer
      → ersetzt durch "Rentabilität" / "Liquidität" / "Beides"
```

### Datenmodell

**Datenbankänderung in Supabase:**

```
Tabelle: ausgaben_kosten_transaktionen

Alt:
  relevant_fuer_rentabilitaet  text, nullable ('ja' / 'nein' / NULL)

Neu:
  relevanz  text, NOT NULL ('rentabilitaet' / 'liquiditaet' / 'beides')
```

Die Migration läuft in einem einzigen SQL-Schritt (Rename → Daten-Update → Constraint setzen). Da alle bestehenden Zeilen vor dem NOT-NULL-Constraint einen Wert bekommen, gibt es keinen Datenverlust.

**TypeScript-Typen (Hook):**

```
Alt:
  relevant_fuer_rentabilitaet: string | null   ← optional, beliebiger Wert

Neu:
  relevanz: 'rentabilitaet' | 'liquiditaet' | 'beides'   ← required, strikt typisiert
```

### API-Änderungen

**POST + PATCH `/api/ausgaben-kosten-transaktionen`:**
- `relevanz` wird als Pflichtfeld im Zod-Validierungsschema ergänzt
- Erlaubte Werte: `'rentabilitaet'` / `'liquiditaet'` / `'beides'`
- Fehlt das Feld oder hat es einen ungültigen Wert → HTTP 400

**GET `/api/rentabilitaet`:**
- Bisheriger Filter auf `relevant_fuer_rentabilitaet` wird durch Filter auf `relevanz` ersetzt
- Neue Bedingung: `relevanz IN ('rentabilitaet', 'beides')`

**GET `/api/liquiditaet`:**
- Neuer zusätzlicher Filter: `relevanz IN ('liquiditaet', 'beides')`
- Bestehender Filter `zahlungsdatum IS NOT NULL` bleibt unverändert

### Filterlogik-Überblick (visuell)

```
Transaktion mit relevanz = 'rentabilitaet'
  → erscheint in PROJ-6 (Rentabilität)?  JA  (+ leistungsdatum vorhanden + kein abschreibung)
  → erscheint in PROJ-7 (Liquidität)?    NEIN

Transaktion mit relevanz = 'liquiditaet'
  → erscheint in PROJ-6 (Rentabilität)?  NEIN
  → erscheint in PROJ-7 (Liquidität)?    JA  (+ zahlungsdatum vorhanden)

Transaktion mit relevanz = 'beides'
  → erscheint in PROJ-6 (Rentabilität)?  JA  (+ leistungsdatum vorhanden + kein abschreibung)
  → erscheint in PROJ-7 (Liquidität)?    JA  (+ zahlungsdatum vorhanden)
```

### Geänderte Dateien (final)

| Datei | Art der Änderung |
|-------|----------------|
| Supabase SQL-Migration | Rename + Daten-Update + NOT NULL + CHECK Constraint |
| `src/hooks/use-ausgaben-kosten-transaktionen.ts` | Typ: `relevant_fuer_rentabilitaet` → `relevanz` (required enum) |
| `src/app/api/ausgaben-kosten-transaktionen/route.ts` | Zod POST-Schema: `relevanz` required enum |
| `src/app/api/ausgaben-kosten-transaktionen/[id]/route.ts` | Zod PATCH-Schema: `relevanz` optional enum (kein null) |
| `src/components/ausgaben-form-dialog.tsx` | Dropdown: Ja/Nein optional → Rentabilität/Liquidität/Beides Pflichtfeld |
| `src/components/ausgaben-table.tsx` | Spaltenheader + Anzeigelabels aktualisieren |
| `src/app/api/rentabilitaet/route.ts` | Filter-Bedingung auf `relevanz` umschreiben |
| `src/app/api/liquiditaet/route.ts` | Relevanz-Filter hinzufügen |

### Keine neuen Packages

Alle benötigten Komponenten (shadcn Select, Form-Validierung via Zod) sind bereits vorhanden.

## QA Test Results

**QA Date:** 2026-04-19
**Tester:** QA Engineer (automated)
**Status:** APPROVED — Keine Critical oder High Bugs gefunden

### Test Summary

| Kategorie | Ergebnis |
|-----------|---------|
| Unit tests (Vitest) | 183/183 bestanden |
| E2E tests (Playwright, Chromium + Mobile Safari) | 16/16 bestanden |
| TypeScript Build | Keine Fehler |
| Security Audit | Keine Probleme gefunden |
| Regressionen | Keine — alle bestehenden Features unverändert |

### Acceptance Criteria Ergebnisse

**Datenbankschema (Migration)**
- [x] `relevant_fuer_rentabilitaet` → `relevanz` umbenannt
- [x] NOT NULL + CHECK-Constraint (`'rentabilitaet'`/`'liquiditaet'`/`'beides'`) gesetzt
- [x] `'nein'` → `'liquiditaet'` migriert
- [x] `'ja'` und `NULL` → `'beides'` migriert
- [x] Alte CHECK-Constraint gedroppt (war Blocker bei erster Migration)

**PROJ-5: Formular**
- [x] Dropdown "Relevanz *" ersetzt "Relevant für Rentabilität"
- [x] Optionen: Rentabilität / Liquidität / Beides
- [x] Speichern blockiert ohne Auswahl (`!!relevanz` in `isValid`)
- [x] Edit-Formular füllt gespeicherten Wert vor
- [x] Kein leerer Zustand als wählbare Option

**PROJ-5: Tabelle**
- [x] Spaltenheader "Relevanz" (war "Rentabilität")
- [x] Labels: "Rentabilität" / "Liquidität" / "Beides"

**API-Validierung (Vitest)**
- [x] POST ohne `relevanz` → 400
- [x] POST mit `relevanz: 'ja'` (alter Wert) → 400
- [x] POST mit `relevanz: 'nein'` (alter Wert) → 400
- [x] PATCH mit `relevanz: 'ja'` → 400
- [x] PATCH mit `relevanz: 'rentabilitaet'` → 200

**PROJ-6: Rentabilität Filterlogik**
- [x] Filter: `relevanz IN ('rentabilitaet', 'beides')` ersetzt `.or('relevant_fuer_rentabilitaet...')`
- [x] `'liquiditaet'`-Transaktionen erscheinen NICHT in Rentabilität

**PROJ-7: Liquidität Filterlogik**
- [x] Filter: `relevanz IN ('liquiditaet', 'beides')` hinzugefügt
- [x] `'rentabilitaet'`-Transaktionen erscheinen NICHT in Liquidität

### Security Audit
- API-Routen durch `requireAuth()` geschützt — unauth. Zugriff → Redirect zu /login (E2E bestätigt)
- Zod-Validierung verwirft alle ungültigen `relevanz`-Werte serverseitig
- DB-seitiger CHECK-Constraint als zweite Verteidigungslinie
- Keine sensiblen Daten in API-Responses exponiert

### Gefundene Bugs

**Bug (Medium, behoben):** Erste Migration schlug fehl weil die alte CHECK-Constraint `ausgaben_kosten_transaktionen_relevant_fuer_rentabilitaet_check` den UPDATE auf `'liquiditaet'` blockierte. Fix: Constraint vor Umbenennung gedroppt.

### Production-Ready Decision

**READY FOR DEPLOYMENT** — Keine Critical oder High Bugs. Alle Acceptance Criteria erfüllt. 183 Unit-Tests + 16 E2E-Tests grün.

## Implementation Notes (Backend)

**Status:** Backend implemented 2026-04-19

### Datenbankm­igration
- Alte CHECK-Constraint `ausgaben_kosten_transaktionen_relevant_fuer_rentabilitaet_check` gedroppt
- Spalte `relevant_fuer_rentabilitaet` umbenannt zu `relevanz`
- Datenmigration: `'nein'` → `'liquiditaet'`; `'ja'` und `NULL` → `'beides'`
- NOT NULL + neue CHECK-Constraint `relevanz_check` gesetzt

### Geänderte API-Dateien
- `src/app/api/ausgaben-kosten-transaktionen/route.ts` — Zod: `relevanz` als required enum; insert nutzt `relevanz`
- `src/app/api/ausgaben-kosten-transaktionen/[id]/route.ts` — Zod PATCH: `relevanz` optional enum (kein null)
- `src/app/api/rentabilitaet/route.ts` — Filter: `.or('relevant_fuer_rentabilitaet...')` → `.in('relevanz', ['rentabilitaet', 'beides'])`
- `src/app/api/liquiditaet/route.ts` — Neuer Filter: `.in('relevanz', ['liquiditaet', 'beides'])`

### Tests
- `route.test.ts` — `VALID_TRANSAKTION` und `MOCK_ROW` auf `relevanz: 'beides'` aktualisiert; Test für ungültigen Wert + fehlendes Pflichtfeld ergänzt
- `rentabilitaet/route.test.ts` — `KOSTEN_ROW_1` auf `relevanz: 'beides'` aktualisiert
- 181/181 Tests bestanden

## Implementation Notes (Frontend)

**Status:** Frontend implemented 2026-04-19

### Geänderte Dateien
- `src/hooks/use-ausgaben-kosten-transaktionen.ts` — `relevant_fuer_rentabilitaet: string | null` → `relevanz: 'rentabilitaet' | 'liquiditaet' | 'beides'` (required, in beiden Interfaces)
- `src/components/ausgaben-form-dialog.tsx` — State `rentabilitaet` → `relevanz`; Dropdown "Relevant für Rentabilität" (Ja/Nein, optional) → "Relevanz *" (Rentabilität/Liquidität/Beides, Pflichtfeld); `isValid` prüft nun auch `!!relevanz`; `onSave` sendet `relevanz` statt `relevant_fuer_rentabilitaet`
- `src/components/ausgaben-table.tsx` — `RELEVANZ_LABEL`-Map hinzugefügt; Spaltenheader "Rentabilität" → "Relevanz"; Zellinhalt nutzt `RELEVANZ_LABEL[t.relevanz]`

## Deployment

**Deployed:** 2026-04-19
**Git tag:** v1.14.0-PROJ-14
**Platform:** Vercel (auto-deploy on push to main)
**Commit:** e223e1a

### Deployment checklist
- [x] `npm run build` passed locally
- [x] QA approved (0 bugs, alle AC erfüllt)
- [x] 183/183 unit tests passing
- [x] 16/16 E2E tests passing
- [x] Code committed and pushed to main
- [x] Git tag v1.14.0-PROJ-14 created and pushed
- [x] Supabase migration applied (proj14_relevanz_pflichtfeld)
