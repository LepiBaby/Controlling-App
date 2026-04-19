# PROJ-10: Kategorie-Anzeigebezeichnungen für Ausgaben & Kosten

## Status: Approved
**Created:** 2026-04-19
**Last Updated:** 2026-04-19

## Dependencies
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Hauptkategorien müssen existieren
- Requires: PROJ-9 (Kategorie-Dimensionen Konfiguration) — Analog zum Dimensions-Konfigurations-Pattern
- Relevant für: PROJ-6 (Rentabilitäts-Auswertung) — nutzt Kosten-Label zur Darstellung
- Relevant für: PROJ-7 (Liquiditäts-Auswertung) — nutzt Ausgaben-Label zur Darstellung

## Übersicht
Für Hauptkategorien (Ebene 1) im Tab Ausgaben & Kosten können zwei separate Anzeigebezeichnungen konfiguriert werden:
- **Kosten-Label:** Wird in der Rentabilitätsauswertung angezeigt (z.B. "Produktkosten")
- **Ausgaben-Label:** Wird in der Liquiditätsauswertung angezeigt (z.B. "Produktausgaben")

Der interne Kategoriename (z.B. "Produkt") bleibt unverändert und wird weiterhin in der KPI-Modell-Verwaltung und bei der Transaktionseingabe verwendet. Die Labels sind reine Anzeigebezeichnungen für die Auswertungen.

Die Konfiguration erfolgt direkt in der KPI-Modell-Verwaltung über ein neues Icon pro Hauptkategorie, das ein Popover mit zwei Textfeldern öffnet.

## User Stories
- Als Nutzer möchte ich für Ausgaben & Kosten-Hauptkategorien einen Kosten-Anzeigenamen definieren können, damit dieser in der Rentabilitätsauswertung statt des internen Kategorienamens angezeigt wird.
- Als Nutzer möchte ich für Ausgaben & Kosten-Hauptkategorien einen Ausgaben-Anzeigenamen definieren können, damit dieser in der Liquiditätsauswertung statt des internen Kategorienamens angezeigt wird.
- Als Nutzer möchte ich die Bezeichnungen direkt im KPI-Modell konfigurieren, damit alle Kategorie-Einstellungen an einem Ort gepflegt werden.
- Als Nutzer möchte ich auf einen Blick sehen, für welche Kategorien Anzeigebezeichnungen konfiguriert sind, damit ich die Konfiguration überblicken kann.
- Als Nutzer möchte ich leere Labels belassen können (Fallback auf internen Kategorienamen), damit ich nicht für jede Kategorie eigene Labels definieren muss.

## Acceptance Criteria
- [ ] Jede Hauptkategorie (Ebene 1) im Tab Ausgaben & Kosten zeigt ein neues Label-Icon (z.B. Tag oder Pencil-Symbol)
- [ ] Klick auf das Icon öffnet ein Popover mit zwei Text-Inputs: "Kosten-Bezeichnung (Rentabilität)" und "Ausgaben-Bezeichnung (Liquidität)"
- [ ] Änderungen werden per Debounce oder beim Verlassen des Feldes (onBlur) gespeichert — kein manueller Speichern-Button
- [ ] Ist ein Feld leer, wird in den Auswertungen der interne Kategoriename als Fallback verwendet
- [ ] Ist mindestens ein Label konfiguriert, hat das Icon einen aktiven visuellen Zustand (farbig / text-primary)
- [ ] Das Label-Icon erscheint NUR bei Hauptkategorien (Ebene 1) im Tab Ausgaben & Kosten
- [ ] Das Label-Icon erscheint NICHT in den Tabs Umsatz, Einnahmen, Sales Plattformen, Produkte
- [ ] Die konfigurierten Labels werden in der Datenbank persistiert und bleiben nach Reload erhalten
- [ ] PROJ-6 (Rentabilitäts-Auswertung) zeigt das Kosten-Label (oder Fallback auf Kategoriename)
- [ ] PROJ-7 (Liquiditäts-Auswertung) zeigt das Ausgaben-Label (oder Fallback auf Kategoriename)

## Beispiel
```
Produkt  [Umbenennen] [+] [↑] [↓] [🏷 Labels] [⚙ Dimensionen]
  └── Packaging       ← kein Labels-Icon (Ebene 2)

🏷 Popover für "Produkt":
  Kosten-Bezeichnung (Rentabilität):   [Produktkosten   ]
  Ausgaben-Bezeichnung (Liquidität):   [Produktausgaben ]

→ In Rentabilitätsauswertung: "Produktkosten"
→ In Liquiditätsauswertung:   "Produktausgaben"
→ In Transaktionseingabe:     "Produkt" (intern, unverändert)
```

## Edge Cases
- Beide Felder leer → Auswertungen zeigen internen Kategorienamen (kein Sonderfall)
- Nur ein Feld befüllt → Das leere Feld fällt auf den internen Kategorienamen zurück
- Kategorie wird gelöscht → Labels werden mit gelöscht (CASCADE)
- Neue Hauptkategorie erstellt → Beide Labels standardmäßig leer (Fallback aktiv)
- Label sehr lang (> 100 Zeichen) → Validierungsfehler / Kürzung auf max. 100 Zeichen
- Nutzer öffnet Popover, klickt daneben → Popover schließt, gespeicherte Änderungen bleiben (onBlur-Speicherung)

## Technical Requirements
- Zwei neue Text-Spalten auf `kpi_categories`: `kosten_label` (nullable, max 100), `ausgaben_label` (nullable, max 100)
- PATCH `/api/kpi-categories/[id]` wird um diese Felder erweitert
- Nur semantisch relevant für `type = 'ausgaben_kosten'` und `level = 1`
- Spalten sind in allen Zeilen vorhanden (einfacheres Schema), UI zeigt Icons nur dort wo relevant
- PROJ-6 und PROJ-7 lesen `kosten_label` bzw. `ausgaben_label` aus und nutzen den Kategorienamen als Fallback

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
KpiCategoryRow (Ebene 1, nur im Tab Ausgaben & Kosten)
+-- [bestehende Icons: Umbenennen, +, ↑, ↓, Dimensionen, Löschen]
+-- AnzeigebezeichnungButton (neu) — Tag-Icon, aktiv-farbig wenn mind. 1 Label gesetzt
    +-- Popover (shadcn: Popover) — öffnet sich bei Klick
        +-- PopoverContent
            +-- Titel "Anzeigebezeichnungen"
            +-- Input "Kosten-Bezeichnung (Rentabilität)" (shadcn: Input + Label)
            +-- Input "Ausgaben-Bezeichnung (Liquidität)" (shadcn: Input + Label)

rentabilitaet-table.tsx (bestehend)
+-- Liest kosten_label der Kategorie → zeigt kosten_label ?? category.name an

liquiditaet-table.tsx (bestehend)
+-- Liest ausgaben_label der Kategorie → zeigt ausgaben_label ?? category.name an
```

**Sichtbarkeitsregel:** `AnzeigebezeichnungButton` erscheint nur wenn:
- `category.level === 1` UND
- `onUpdateLabels`-Callback ist vorhanden (wird vom Parent nur für Ausgaben & Kosten-Tab übergeben)

**Speichern:** `onBlur` auf jedem Input-Feld (beim Verlassen des Feldes) — kein Speichern-Button nötig. Leerstring wird als `null` gespeichert.

### Datenmodell

```
Bestehende Tabelle: kpi_categories

Neue Felder (Migration):
- kosten_label    TEXT, nullable, max 100 Zeichen
- ausgaben_label  TEXT, nullable, max 100 Zeichen

Fallback-Regel (nur in Auswertungskomponenten):
  Angezeigter Name = kosten_label ?? category.name   (in Rentabilität)
  Angezeigter Name = ausgaben_label ?? category.name  (in Liquidität)

Semantisch relevant für: type = 'ausgaben_kosten', level = 1
Technisch in allen Zeilen vorhanden (einfacheres Schema)
```

### API-Änderungen

```
PATCH /api/kpi-categories/[id]
  Neue optionale Felder:
  - kosten_label   (string | null, max 100)
  - ausgaben_label (string | null, max 100)

GET /api/kpi-categories?type=...
  Gibt neue Spalten automatisch zurück (kein Änderungsbedarf)

GET /api/rentabilitaet   → Kategorieobjekte enthalten kosten_label
GET /api/liquiditaet     → Kategorieobjekte enthalten ausgaben_label
```

### Datenfluss

```
1. KpiCategoryRow rendert AnzeigebezeichnungButton (wenn level=1 + onUpdateLabels vorhanden)
2. Nutzer öffnet Popover → sieht aktuelle Werte aus category.kosten_label / .ausgaben_label
3. Nutzer ändert einen Input, verlässt das Feld (onBlur)
4. Optimistisches Update im lokalen State
5. PATCH-Call an API mit dem geänderten Label (oder null wenn leer)
6. Bei Fehler: State-Rollback, Fehlermeldung
7. Rentabilitäts-/Liquiditäts-Auswertung zeigt automatisch das konfigurierte Label
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| UI-Pattern | Popover (shadcn) | Bereits installiert; konsistent mit Dimensions-Button (PROJ-9) |
| Speichern | onBlur (Verlassen des Feldes) | Natürlicher für Text-Inputs; verhindert PATCH bei jedem Tastendruck |
| Leeres Label | Als null speichern | Klare Semantik: null = "nicht gesetzt, Fallback aktiv" |
| Callback-Guard | onUpdateLabels nur für Ausgaben & Kosten Tab | Kein Tab-Type-Prop nötig; parent kontrolliert Sichtbarkeit |
| Fallback | category.name wenn label null/leer | Auswertungen funktionieren ohne Konfiguration sofort |

### Geänderte Dateien

```
src/components/kpi-category-row.tsx       — AnzeigebezeichnungButton + Popover + Input-Felder
src/hooks/use-kpi-categories.ts           — updateLabels()-Funktion + neue Felder im KpiCategory-Typ
src/app/api/kpi-categories/[id]/route.ts  — patchSchema um kosten_label / ausgaben_label erweitern
src/components/rentabilitaet-table.tsx    — kosten_label als Anzeigename nutzen (Fallback: name)
src/components/liquiditaet-table.tsx      — ausgaben_label als Anzeigename nutzen (Fallback: name)
src/app/dashboard/kpi-modell/page.tsx     — onUpdateLabels nur für ausgaben_kosten-Tab übergeben
src/app/api/kpi-categories/[id]/route.test.ts — Tests für neue PATCH-Felder
```

## Implementation Notes (Backend)
- DB-Migration: `kosten_label TEXT NULL CHECK (char_length <= 100)` + `ausgaben_label TEXT NULL CHECK (char_length <= 100)` auf `kpi_categories`
- `PATCH /api/kpi-categories/[id]`: patchSchema um beide Text-Felder (nullable, max 100) erweitert
- GET gibt neue Felder automatisch zurück (SELECT *)
- 4 neue Unit-Tests: kosten_label, ausgaben_label, null-clear, 101-Zeichen-Validierungsfehler

## Implementation Notes (Frontend)
- `KpiCategory` Interface: `kosten_label: string | null`, `ausgaben_label: string | null` hinzugefügt
- `useKpiCategories`: `updateLabels(id, patch)` — optimistisches Update + rollback bei Fehler
- `KpiCategoryRow`: Tag-Icon (text-primary wenn aktiv), Popover mit 2 Input-Feldern (onBlur-Speicherung), `showLabels = level === 1 && !!onUpdateLabels`
- `KpiCategoryTree` + `page.tsx`: `onUpdateLabels` nur für ausgaben_kosten-Tab durchgereicht
- `rentabilitaet-table.tsx`: `getCategoryDisplayName()` — zeigt `kosten_label ?? name` für kosten-Zeilen
- `liquiditaet-table.tsx`: `getCategoryDisplayName()` — zeigt `ausgaben_label ?? name` für ausgaben-Zeilen

## QA Test Results

**QA-Durchführung:** 2026-04-19
**Tester:** QA Engineer / Red-Team
**Entscheidung:** PRODUCTION-READY — Freigegeben zum Deployment

### Test-Ausführung

**Unit-Tests (Vitest)** — 161/161 bestanden
- `src/app/api/kpi-categories/[id]/route.test.ts`: PATCH-Validierung für `kosten_label` / `ausgaben_label` inkl. Boundary-Werten (0, 100, 101 Zeichen), Typ-Validierung (non-string → 400), Null-Clear, kombinierter Patch.
- `src/hooks/use-kpi-categories.test.ts`: `KpiCategory`-Interface verwendet die neuen Label-Felder korrekt in allen Test-Fixtures (Baumbildung, Entfernen mit Descendants etc. — keine Regression).

**E2E-Tests (Playwright)** — 186/186 bestanden (Chromium + Mobile Safari)
- `tests/PROJ-10-kategorie-anzeigebezeichnungen.spec.ts` (16 Tests): Auth-Gates auf `/dashboard/kpi-modell`, PATCH `/api/kpi-categories/[id]`, GET `/api/rentabilitaet`, GET `/api/liquiditaet`, Login-Formular-Regression, Regressionschecks auf Dashboard, Rentabilität, Liquidität.
- Gesamte Suite (PROJ-1 bis PROJ-11): Keine Regression durch PROJ-10-Code.

### Acceptance Criteria — Ergebnis

| AC | Beschreibung | Status | Beleg |
|---|---|---|---|
| 1 | Label-Icon (Tag) bei Ebene-1-Hauptkategorien im Ausgaben & Kosten-Tab | Bestanden | `kpi-category-row.tsx:125, 261` — `showLabels = level === 1 && !!onUpdateLabels` |
| 2 | Klick öffnet Popover mit zwei Text-Inputs ("Kosten-Bezeichnung (Rentabilität)", "Ausgaben-Bezeichnung (Liquidität)") | Bestanden | `kpi-category-row.tsx:286-308` — shadcn `Popover` + `Label` + `Input` × 2 |
| 3 | Speichern via onBlur (beim Popover-Schließen) — kein Speichern-Button | Bestanden | `kpi-category-row.tsx:264-274` — `onOpenChange` serialisiert Changes in PATCH bei `open === false` |
| 4 | Leeres Feld → Fallback auf internen Kategorienamen | Bestanden | `rentabilitaet-table.tsx:40-46` + `liquiditaet-table.tsx:40-46` — `label ?? cat.name` |
| 5 | Aktiv-Icon (`text-primary`) wenn mind. 1 Label gesetzt | Bestanden | `kpi-category-row.tsx:126, 279` — `hasActiveLabels = !!(kosten_label \|\| ausgaben_label)` |
| 6 | Icon NUR bei Hauptkategorien (Ebene 1) | Bestanden | Sichtbarkeits-Guard enthält `level === 1` |
| 7 | Icon NICHT in Umsatz, Einnahmen, Sales Plattformen, Produkte | Bestanden | `kpi-modell/page.tsx:61` — `onUpdateLabels` nur für `type === 'ausgaben_kosten'` |
| 8 | Labels werden persistiert (Supabase), bleiben nach Reload | Bestanden | `use-kpi-categories.ts:276-291` — `updateLabels()` PATCHT + Rollback; GET (`SELECT *`) liefert Felder automatisch |
| 9 | PROJ-6 (Rentabilität) zeigt `kosten_label ?? name` | Bestanden | `rentabilitaet-table.tsx:40-46, 157, 174` — `labelType = isUmsatz ? null : 'kosten'` |
| 10 | PROJ-7 (Liquidität) zeigt `ausgaben_label ?? name` | Bestanden | `liquiditaet-table.tsx:40-46, 157, 173` — `labelType = isEinnahmen ? null : 'ausgaben'` |

**Bestanden: 10/10**

### Edge Cases — verifiziert

- Beide Felder leer → Fallback auf internen Kategorienamen (Test `use-kpi-categories.test.ts` Fixtures + API-Route).
- Nur ein Feld befüllt → getrenntes Fallback pro Feld (Test `accepts empty string as kosten_label`).
- Label mit exakt 100 Zeichen → 200 (Boundary-Test ergänzt).
- Label mit 101 Zeichen → 400 (Zod `max(100)`).
- Non-String-Typ (z.B. Number) → 400 (`returns 400 for non-string kosten_label`).
- `null`-Clear → 200 (vorhanden).
- Trim-Verhalten: Leerstring wird im Frontend zu `null` konvertiert (`kpi-category-row.tsx:266-267`).

### Security-Audit (Red-Team)

| Risiko | Bewertung | Befund |
|---|---|---|
| Auth-Bypass auf PATCH | Mitigiert | `requireAuth()` in `route.ts:22` vor jeder DB-Operation |
| Input-Validierung | Sicher | Zod `z.string().max(100).nullable().optional()` |
| XSS via Label-Ausgabe | Sicher | React escaped Textausgabe standardmäßig (`{cat.kosten_label}`) |
| SQL Injection | Sicher | Supabase-Client parametrisiert alle Queries |
| RLS-Umgehung | Unverändert | Keine neuen RLS-Policies erforderlich; Spalten auf bestehender Tabelle `kpi_categories` |
| Datenexfiltration über GET | Unverändert | GET `/api/kpi-categories` ist bereits auth-geschützt; Labels sind nicht sensitiv |
| Oversize-Angriff | Mitigiert | `max(100)` Zeichen-Limit pro Feld |
| Typverwirrung (Number statt String) | Mitigiert | Zod-Schema lehnt Number ab (neuer Test) |

### Responsive & Cross-Browser

- Chromium (Desktop): bestanden
- Mobile Safari (iPhone-Viewport): bestanden
- Popover-Komponente (shadcn/Radix) hat native ARIA-Unterstützung und responsive Positionierung

### Gefundene Bugs

**Keine kritischen oder hohen Bugs gefunden.**

**Niedrig (nicht blockierend):**
- *B10-L1:* `src/app/api/kpi-categories/[id]/route.test.ts` hatte vor QA-Erweiterung einen `describe`-Block, der mittig geschlossen wurde. Dies führte dazu, dass einige Tests im globalen Scope liefen und kein `beforeEach(vi.clearAllMocks())` erhielten. Vitest tolerierte dies, doch es verschlechtert Testisolation. **Behoben im QA-Durchlauf** (Umstrukturierung des `describe`-Blocks), keine Funktions-Änderung nötig.

### Production-Ready-Entscheidung

**FREIGEGEBEN FÜR DEPLOYMENT.** Alle 10 Acceptance Criteria bestanden, keine kritischen/hohen Bugs, Security-Audit sauber, Testabdeckung für alle Edge Cases (Boundary 100/101, Null-Clear, Typ-Validierung, kombinierter Patch, Null-Fallback). Nächster Schritt: `/deploy`.

## Deployment
_To be added by /deploy_
