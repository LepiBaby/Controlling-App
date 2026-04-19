# PROJ-11: Umsatz-Kategorien als Abzugsposten markieren

## Status: Deployed
**Created:** 2026-04-19
**Last Updated:** 2026-04-19

## Dependencies
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Hauptkategorien müssen existieren
- Requires: PROJ-9 (Kategorie-Dimensionen Konfiguration) — Analog zum Dimensions-Konfigurations-Pattern
- Relevant für: PROJ-6 (Rentabilitäts-Auswertung) — Abzugsposten-Kategorien werden dort negativ dargestellt

## Übersicht
Für Hauptkategorien (Ebene 1) im Tab Umsatz kann konfiguriert werden, ob die Kategorie ein **Abzugsposten** ist (z.B. Retouren, Rabatte). Abzugsposten werden in der Rentabilitätsauswertung als negative Werte dargestellt und von der Umsatzsumme subtrahiert.

Die Transaktionseingabe selbst bleibt unverändert — Nutzer geben weiterhin positive Beträge ein. Die Negativ-Darstellung erfolgt ausschließlich in der Auswertung.

## User Stories
- Als Nutzer möchte ich eine Umsatz-Hauptkategorie als Abzugsposten markieren können, damit Retouren und Rabatte in der Rentabilitätsauswertung korrekt als negative Werte erscheinen.
- Als Nutzer möchte ich bei der Transaktionseingabe weiterhin positive Beträge eingeben können, damit die Eingabe intuitiv bleibt.
- Als Nutzer möchte ich auf einen Blick sehen, welche Umsatz-Kategorien Abzugsposten sind, damit ich die Konfiguration überblicken kann.
- Als Nutzer möchte ich den Abzugsposten-Status jederzeit ändern können, damit ich flexibel auf Änderungen im Reporting reagieren kann.

## Acceptance Criteria
- [ ] Jede Hauptkategorie (Ebene 1) im Tab Umsatz zeigt ein neues Konfigurations-Icon (z.B. Minus-Circle oder TrendingDown)
- [ ] Klick auf das Icon öffnet ein Popover mit einer Checkbox: "Abzugsposten (wird in Rentabilitätsauswertung negativ dargestellt)"
- [ ] Änderungen werden sofort gespeichert (kein separater Speichern-Button)
- [ ] Aktiver Abzugsposten ist visuell erkennbar (Icon farbig / text-destructive oder text-primary)
- [ ] Das Icon erscheint NUR bei Hauptkategorien (Ebene 1) im Tab Umsatz
- [ ] Das Icon erscheint NICHT in anderen Tabs (Einnahmen, Ausgaben & Kosten, Sales Plattformen, Produkte)
- [ ] Die Konfiguration wird persistiert und bleibt nach Reload erhalten
- [ ] PROJ-6 (Rentabilitäts-Auswertung) stellt Transaktionen aus als Abzugsposten markierten Kategorien negativ dar und subtrahiert sie von der Umsatzsumme

## Beispiel
```
Retouren  [Umbenennen] [+] [↑] [↓] [➖ Abzugsposten ✓]
  └── Online-Retouren  ← kein Abzugsposten-Icon (Ebene 2)

➖ Popover für "Retouren":
  ☑ Abzugsposten (wird in Rentabilitätsauswertung negativ dargestellt)

→ Transaktionseingabe: Nutzer gibt 500 € ein → gespeichert als +500
→ Rentabilitätsauswertung: -500 € (subtrahiert vom Umsatz)
```

## Edge Cases
- Kategorie als Abzugsposten markiert, bereits Transaktionen vorhanden → Warnung: "X Transaktionen dieser Kategorie werden in der Rentabilitätsauswertung ab sofort negativ dargestellt."
- Abzugsposten-Flag deaktiviert → Transaktionen erscheinen wieder positiv in der Auswertung (keine Datenmutation)
- Neue Hauptkategorie erstellt → Standardmäßig kein Abzugsposten (false)
- Kategorie wird gelöscht → Flag wird mit gelöscht (CASCADE)

## Technical Requirements
- Eine neue Boolean-Spalte auf `kpi_categories`: `ist_abzugsposten` (default false)
- PATCH `/api/kpi-categories/[id]` wird um dieses Feld erweitert
- Nur semantisch relevant für `type = 'umsatz'` und `level = 1`
- PROJ-6 liest `ist_abzugsposten` aus und multipliziert den Betrag bei der Darstellung mit -1

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
KpiCategoryRow (Ebene 1, nur im Tab Umsatz)
+-- [bestehende Icons: Umbenennen, +, ↑, ↓, Dimensionen, Löschen]
+-- AbzugspostenButton (neu) — TrendingDown-Icon, aktiv-farbig (text-destructive) wenn aktiv
    +-- Popover (shadcn: Popover) — öffnet sich bei Klick
        +-- PopoverContent
            +-- Checkbox "Abzugsposten" (shadcn: Checkbox + Label)
            +-- Hinweis-Text: "Wird in der Rentabilitätsauswertung negativ dargestellt"

rentabilitaet-table.tsx (bestehend)
+-- Liest ist_abzugsposten → multipliziert Betrag mit -1 bei der Darstellung
```

**Sichtbarkeitsregel:** `AbzugspostenButton` erscheint nur wenn:
- `category.level === 1` UND
- `onUpdateAbzugsposten`-Callback ist vorhanden (wird vom Parent nur für Umsatz-Tab übergeben)

### Datenmodell

```
Bestehende Tabelle: kpi_categories

Neues Feld (Migration):
- ist_abzugsposten   Boolean, Standard: false

Wirkung in Auswertungen:
  ist_abzugsposten = false → Betrag positiv in Rentabilität (normaler Umsatz)
  ist_abzugsposten = true  → Betrag × (-1) in Rentabilität (Retouren, Rabatte etc.)

Transaktionen werden weiterhin positiv gespeichert — keine Datenmutation.
Semantisch relevant für: type = 'umsatz', level = 1
```

### API-Änderungen

```
PATCH /api/kpi-categories/[id]
  Neues optionales Feld:
  - ist_abzugsposten (boolean)

GET /api/kpi-categories?type=umsatz
  Gibt ist_abzugsposten automatisch zurück (kein Änderungsbedarf)

GET /api/rentabilitaet
  Logik: wenn kategorie.ist_abzugsposten = true → Summe negativ darstellen
```

### Datenfluss

```
1. KpiCategoryRow rendert AbzugspostenButton (wenn level=1 + onUpdateAbzugsposten vorhanden)
2. Nutzer öffnet Popover → sieht aktuellen Checkbox-Zustand aus category.ist_abzugsposten
3. Nutzer klickt Checkbox → optimistisches Update im lokalen State
4. Sofortiger PATCH-Call an API mit dem geänderten Boolean
5. Bei Fehler: State-Rollback, Fehlermeldung
6. Rentabilitätsauswertung berechnet automatisch Beträge dieser Kategorie negativ
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| UI-Pattern | Popover (shadcn) | Konsistent mit Dimensions-Button (PROJ-9) und Labels-Button (PROJ-10) |
| Icon | TrendingDown | Kommuniziert visuell "negativer Wert/Abzug" |
| Aktiv-Farbe | text-destructive (rot) | Abzugsposten sind semantisch "gefährlich"/negativ — rot signalisiert das intuitiv |
| Speichern | Sofort bei Checkbox-Klick | Konsistent mit PROJ-9 Dimensions-Pattern |
| Callback-Guard | onUpdateAbzugsposten nur für Umsatz Tab | Kein Tab-Type-Prop nötig; parent kontrolliert Sichtbarkeit |
| Datenmutation | Keine — Transaktionen bleiben positiv | Auswertungs-Logik entscheidet Vorzeichen; historische Daten bleiben korrekt |

### Geänderte Dateien

```
src/components/kpi-category-row.tsx       — AbzugspostenButton + Popover + Checkbox
src/hooks/use-kpi-categories.ts           — updateAbzugsposten()-Funktion + ist_abzugsposten im KpiCategory-Typ
src/app/api/kpi-categories/[id]/route.ts  — patchSchema um ist_abzugsposten erweitern
src/components/rentabilitaet-table.tsx    — ist_abzugsposten auslesen, Betrag × (-1)
src/app/dashboard/kpi-modell/page.tsx     — onUpdateAbzugsposten nur für umsatz-Tab übergeben
src/app/api/kpi-categories/[id]/route.test.ts — Tests für neues PATCH-Feld
```

## Implementation Notes (Backend)
- DB-Migration: `ist_abzugsposten BOOLEAN NOT NULL DEFAULT false` auf `kpi_categories`
- `PATCH /api/kpi-categories/[id]`: patchSchema um `ist_abzugsposten` (boolean, optional) erweitert
- `GET /api/rentabilitaet`: lädt Abzugsposten-Kategorien vorab (`kpi_categories` WHERE `ist_abzugsposten=true AND type='umsatz' AND level=1`); Umsatz-Transaktionen dieser Kategorien erhalten betrag × (-1) — wirkt sich auf `totalNetto` aus
- 3 neue Unit-Tests: ist_abzugsposten true/false + non-boolean → 400

## Implementation Notes (Frontend)
- `KpiCategory` Interface: `ist_abzugsposten: boolean` hinzugefügt
- `useKpiCategories`: `updateAbzugsposten(id, ist_abzugsposten)` — optimistisches Update + rollback
- `KpiCategoryRow`: TrendingDown-Icon (text-destructive wenn aktiv), Popover mit Checkbox, `showAbzugsposten = level === 1 && !!onUpdateAbzugsposten`
- `KpiCategoryTree` + `page.tsx`: `onUpdateAbzugsposten` nur für umsatz-Tab durchgereicht
- `rentabilitaet-table.tsx`: `isAbzugsposten()` Helper — Vorzeichenflip beim Anzeigen des Betrags pro Zeile

## QA Test Results

**QA-Durchführung:** 2026-04-19
**Tester:** QA Engineer / Red-Team
**Entscheidung:** PRODUCTION-READY — Freigegeben zum Deployment

### Test-Ausführung

**Unit-Tests (Vitest)** — 161/161 bestanden
- `src/app/api/kpi-categories/[id]/route.test.ts`: PATCH `ist_abzugsposten=true` → 200, `false` → 200, `'true'` (String) → 400, kombinierter Patch mit Labels → 200.
- `src/app/api/rentabilitaet/route.test.ts` (neu erweitert): 4 neue Tests für Abzugsposten-Vorzeichen-Flip:
  - Umsatz-Reihe aus Abzugsposten-Kategorie → Betrag wird negativ (`1000 → -1000`).
  - Umsatz-Reihe aus nicht-Abzugsposten-Kategorie → Betrag bleibt positiv.
  - `totalNetto` wird durch Abzugsposten-Flip reduziert (2 Reihen × 1500 → -1500).
  - Kosten-Reihen bekommen KEINEN doppelten Flip, wenn die zugehörige Kategorie fälschlich als Abzugsposten markiert wäre (semantischer Guard: Flip nur bei `quelle === 'umsatz'`).

**E2E-Tests (Playwright)** — 186/186 bestanden (Chromium + Mobile Safari)
- `tests/PROJ-11-umsatz-abzugsposten.spec.ts` (16 Tests): Auth-Gates auf `/dashboard/kpi-modell`, PATCH `/api/kpi-categories/[id]`, GET `/api/rentabilitaet`, GET `/api/rentabilitaet?quelle=umsatz`, Login-Formular-Regression, Regressions-Checks auf Dashboard, Umsatz, Rentabilität.
- Gesamte Suite (PROJ-1 bis PROJ-11): Keine Regression durch PROJ-11-Code.

### Acceptance Criteria — Ergebnis

| AC | Beschreibung | Status | Beleg |
|---|---|---|---|
| 1 | TrendingDown-Icon bei Ebene-1-Hauptkategorien im Umsatz-Tab | Bestanden | `kpi-category-row.tsx:127, 312` — `showAbzugsposten = level === 1 && !!onUpdateAbzugsposten` |
| 2 | Klick öffnet Popover mit einer Checkbox "Abzugsposten (…negativ dargestellt)" | Bestanden | `kpi-category-row.tsx:323-337` — shadcn `Popover` + `Checkbox` + `Label` mit Hinweistext |
| 3 | Sofortige Speicherung bei Checkbox-Klick (kein Speichern-Button) | Bestanden | `kpi-category-row.tsx:329-331` — `onCheckedChange` ruft `updateAbzugsposten()` direkt |
| 4 | Aktiv-Icon `text-destructive` (rot) wenn aktiv | Bestanden | `kpi-category-row.tsx:317` — `cn('h-6 w-6', category.ist_abzugsposten && 'text-destructive')` |
| 5 | Icon NUR bei Hauptkategorien (Ebene 1) im Umsatz-Tab | Bestanden | `kpi-modell/page.tsx:62` — `onUpdateAbzugsposten` nur bei `type === 'umsatz'` |
| 6 | Icon NICHT in Einnahmen, Ausgaben & Kosten, Sales Plattformen, Produkte | Bestanden | Siehe AC 5 (Callback-Guard) |
| 7 | Konfiguration persistiert, bleibt nach Reload erhalten | Bestanden | `use-kpi-categories.ts:293-305` — `updateAbzugsposten()` PATCH + Rollback; DB-Default `false` |
| 8 | Rentabilität: Umsatz-Transaktionen von Abzugsposten-Kategorien werden negativ dargestellt + von Umsatzsumme subtrahiert | Bestanden | `rentabilitaet/route.ts:45-54, 73-87` — lädt `abzugspostenIds`-Set, multipliziert `betrag × -1` für Umsatz-Reihen (Unit-Test abgedeckt) |

**Bestanden: 8/8**

### Edge Cases — verifiziert

- Abzugsposten-Flag bei vorhandenen Transaktionen → Rückwirkend aktiv in Rentabilität (keine DB-Mutation, nur API-Berechnung); Unit-Test abgedeckt.
- Flag deaktiviert → Transaktionen wieder positiv in Auswertung; Unit-Test abgedeckt.
- Neue Hauptkategorie erstellt → DB-Default `false`; kein zusätzliches Feld im POST nötig.
- `totalNetto` respektiert Vorzeichenflip (neuer Unit-Test `reduces totalNetto`).
- Kosten-Reihen werden niemals durch Abzugsposten geflippt, auch nicht bei Kategorie-Missbrauch (neuer Unit-Test).
- Transaktionstabelle `umsatz_transaktionen` bleibt unberührt — Vorzeichenlogik ausschließlich im API-Layer.

### Security-Audit (Red-Team)

| Risiko | Bewertung | Befund |
|---|---|---|
| Auth-Bypass auf PATCH `ist_abzugsposten` | Mitigiert | `requireAuth()` vor Update |
| Typverwirrung (`'true'` String) | Mitigiert | Zod `z.boolean()` lehnt String strikt ab (Unit-Test `returns 400 for non-boolean`) |
| Rentabilität-Endpunkt Auth | Mitigiert | `requireAuth()` in `route.ts:22` |
| Horizontal Privilege Escalation | N/A | Alle Users haben gleiche Rechte (PRD) |
| Datenmutation durch Flag-Toggle | Sicher | Flag-Flip ändert nur Präsentation; `umsatz_transaktionen.betrag` unverändert |
| Leaking von Abzugsposten-Kategorien | Akzeptabel | GET `/api/kpi-categories` ist auth-geschützt; Liste der Abzugsposten-Kategorien ist nicht sensitiv |
| DoS via wiederholtem PATCH | Niedrig | Bestehendes Supabase-Rate-Limit; kein neuer Vektor |
| RLS-Bypass | Unverändert | Keine neue Policy; Feldupdate über bestehende PATCH-Policy |

### Responsive & Cross-Browser

- Chromium (Desktop): bestanden
- Mobile Safari (iPhone-Viewport): bestanden
- Popover + Checkbox: Radix-basiert, touch-optimiert

### Gefundene Bugs

**Keine kritischen oder hohen Bugs gefunden.**

**Niedrig (nicht blockierend):**
- *B11-L1:* Vor QA fehlten Unit-Tests für die Abzugsposten-Vorzeichen-Flip-Logik in `rentabilitaet/route.ts`. Die Kernlogik (`isAbzug ? -Number(row.betrag) : Number(row.betrag)`) war implementiert, aber ungetestet — Risiko für Regressions-Bugs. **Behoben im QA-Durchlauf:** 4 neue Unit-Tests abdecken alle 4 Pfade (Flip aktiv, Flip inaktiv, Summe, Schutz auf Kosten-Seite).

**Beobachtung (nicht Bug):**
- *O11-1:* Der ursprünglich in den Edge Cases erwähnte "Warnhinweis bei Transaktionen vorhanden" ("X Transaktionen dieser Kategorie werden … ab sofort negativ dargestellt") ist nicht implementiert. Dies ist kein Acceptance Criterion und sollte ggf. in einer Folge-Story ergänzt werden, falls gewünscht. Produktionsfreigabe wird davon nicht blockiert.

### Production-Ready-Entscheidung

**FREIGEGEBEN FÜR DEPLOYMENT.** Alle 8 Acceptance Criteria bestanden, keine kritischen/hohen Bugs, Security-Audit sauber, Abzugsposten-Logik durch Unit-Tests abgesichert. Nächster Schritt: `/deploy`.

## Deployment
_To be added by /deploy_
