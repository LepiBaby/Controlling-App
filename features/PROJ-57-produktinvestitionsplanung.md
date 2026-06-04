# PROJ-57: Produktinvestitionsplanung — Kurzfristige Planung

## Status: Planned
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Kategorien unter „Produktinvestitionen" (ausgaben_kosten) als Zeilenquelle
- Requires: PROJ-41 (Bereichswechsler) — URL-Rahmen „Kurzfristige Planung"
- Requires: PROJ-50 (Grundeinstellungen) — Planungshorizont aus `grundeinstellungen.planungshorizont_wochen`
- Integrates: PROJ-53 (Zellen-Notizen) — Notizen-Feature nutzbar, sobald deployed

## Übersicht

Die Seite „Produktinvestitionsplanung" ermöglicht dem Nutzer die wochenweise manuelle Eingabe von geplanten **Produktinvestitionsbeträgen** (in €) für den in den Grundeinstellungen konfigurierten Planungshorizont. Die Wochen starten immer mit der **nächsten Kalenderwoche** relativ zum heutigen Datum.

Die Zeilen der Tabelle leiten sich aus den im KPI-Modell hinterlegten Kategorien unterhalb des Knotens „Produktinvestitionen" (Typ `ausgaben_kosten`) ab — L1-Gruppen (direkte Kinder des „Produktinvestitionen"-Knotens) und deren L2-Untergruppen. Die Kategorien sind immer fix vorhanden und richten sich nach dem aktuellen Stand des KPI-Modells.

Es gibt **keine historische Vorbelegung** und **keine Massen-Anpassung** — alle Werte werden vollständig manuell eingegeben. Die Seite ist vom Design und Aufbau identisch zur Operativen Planung (PROJ-56), ergänzt um das Notizen-Feature (PROJ-53).

## User Stories

- Als Nutzer möchte ich die Produktinvestitionsplanung über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite von „Kurzfristige Planung" eine Kachel „Produktinvestitionsplanung" sehen, damit ich von dort direkt auf die Seite wechseln kann.
- Als Nutzer möchte ich pro Produktinvestitionskategorie und Kalenderwoche einen Betrag manuell eingeben können, damit ich die geplanten Produktinvestitionen für den Planungshorizont erfassen kann.
- Als Nutzer möchte ich sofort sehen, wie sich meine Einzelwerte auf die übergeordneten Gruppen und die Gesamtsumme auswirken, damit ich einen schnellen Überblick habe.
- Als Nutzer möchte ich beim Hovern oder Klicken auf Felder eine laufende Summe der selektierten Werte sehen (Betragsselektion), damit ich Zwischensummen schnell ablesen kann.
- Als Nutzer möchte ich die Kategoriegruppen auf- und zuklappen können, damit ich die Übersicht behalte.
- Als Nutzer möchte ich für einzelne Zellen eine Notiz hinterlegen können (PROJ-53), damit ich Begründungen oder Kommentare zu Planungswerten festhalten kann.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag „Produktinvestitionsplanung" → `/dashboard/kurzfristige-planung/produktinvestitionsplanung`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Produktinvestitionsplanung" im Abschnitt „Planung", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Tabellenstruktur & Spalten

- [ ] Kalenderwochen-Spalten starten immer mit der **nächsten Kalenderwoche** basierend auf dem aktuellen Datum (ISO 8601: Woche beginnt Montag). Beispiel: ist heute Mittwoch KW23, beginnen die Spalten bei KW24.
- [ ] Anzahl der Spalten = `planungshorizont_wochen` aus `grundeinstellungen` (Fallback: 13 wenn kein Eintrag)
- [ ] Spaltenüberschriften zeigen Kalenderwoche und Jahr im Format „KW24 / 2026"
- [ ] Die Tabelle ist horizontal scrollbar, wenn die Spalten die Bildschirmbreite überschreiten
- [ ] Die erste Spalte (Zeilenbeschriftung) ist beim horizontalen Scrollen sticky (links fixiert)

### Zeilenhierarchie

- [ ] **Ganz oben**: Gesamtergebnis-Zeile „Produktinvestitionen (Gesamt)" — summiert alle sichtbaren Leaf-Zeilen, nicht editierbar, immer sichtbar
- [ ] **Pro L1-Gruppe** (direkte Kinder des „Produktinvestitionen"-Knotens): eine einklappbare Sektion (Standard: ausgeklappt):
  - Kategorie-Header-Zeile mit Gruppenname + Auf-/Zuklapp-Icon
  - Wenn die Gruppe L2-Untergruppen hat:
    - Aggregations-Zeile für diese L1-Gruppe (Summe aller L2-Untergruppen), nicht editierbar
    - Pro L2-Untergruppe: editierbare Zeile (innerhalb der Sektion, eingerückt)
  - Wenn die Gruppe **keine** Untergruppen hat:
    - Die L1-Gruppe selbst ist direkt editierbar (Leaf)
- [ ] Die Kategorien erscheinen in der Reihenfolge, die im KPI-Modell per `sort_order` definiert ist
- [ ] Der „Produktinvestitionen"-Knoten selbst wird **nicht** als Zeile angezeigt (nur seine Kinder und Enkel)

### Rollierender Planungshorizont (Wochenwechsel)

- [ ] Der Planungshorizont rollt automatisch mit: Die angezeigten Spalten ergeben sich immer aus dem **aktuellen Datum** zum Zeitpunkt des Seitenladens — es wird keine feste Startseite gespeichert
- [ ] **Herausfallende (alte) Woche**: Sobald eine Woche zur aktuellen oder vergangenen Woche wird, verschwindet sie aus der Tabelle. Die in der DB gespeicherten Planungswerte bleiben erhalten, sind aber auf der Seite nicht mehr sichtbar. Es gibt keine Benachrichtigung oder Warnung.
- [ ] **Neu hinzukommende Woche** (am Ende des Horizonts): Die Woche, die durch den Wochenwechsel neu am Ende erscheint, wird visuell hervorgehoben:
  - Der Spaltenheader wird mit **roter Hintergrundfarbe** markiert
  - Alle editierbaren Zellen dieser Spalte erhalten einen roten Rahmen oder eine leichte rote Hinterfärbung
  - Tooltip oder kleiner Hinweistext am Header: „Neue Woche — Bitte Werte prüfen"
  - Die Markierung gilt als „neu", solange der Nutzer noch keinen manuellen Wert in mindestens eine Zelle dieser Woche eingetragen hat
  - Sobald der Nutzer in dieser Woche mindestens eine Zelle manuell bearbeitet hat, verschwindet die rote Markierung für die gesamte Spalte

### Leerer Zustand

- [ ] Wenn kein „Produktinvestitionen"-Knoten im KPI-Modell vorhanden ist oder dieser keine Kinder hat: leerer Zustand mit Hinweis „Keine Produktinvestitionskategorien im KPI-Modell vorhanden. Bitte den Knoten ‚Produktinvestitionen' im KPI-Modell konfigurieren." + Link zur KPI-Modell-Verwaltung

### Manuelle Eingabe & Persistenz

- [ ] Der Nutzer kann jede editierbare Zelle direkt in der Tabelle bearbeiten (Inline-Editing)
- [ ] Eingabe: Dezimalzahl ≥ 0 (Betrag in €), gerundet auf 2 Dezimalstellen
- [ ] Leere Eingabe (Feld geleert): Wert wird als NULL gespeichert (= kein Wert)
- [ ] Beim Verlassen einer Zelle (onBlur) wird der Wert automatisch gespeichert (kein separater Speichern-Button)
- [ ] Werte werden in der Tabelle `produktinvestitions_planung` in der Datenbank persistiert
- [ ] Beim nächsten Seitenladevorgang werden gespeicherte Werte aus der DB geladen und angezeigt
- [ ] Optimistisches Update: Wert erscheint sofort; bei API-Fehler → Toast-Fehlermeldung + Rollback
- [ ] Zellen ohne Wert (NULL) werden leer angezeigt (keine 0-Anzeige)
- [ ] Aggregationszeilen zeigen die Summe der Leaf-Zeilen in ihrer Sektion; Zellen ohne Wert zählen als 0 bei der Aggregation

### Betragsselektion (Hover-Summierung)

- [ ] Der Nutzer kann einzelne Zellwerte durch Klicken oder Ctrl+Klicken auswählen
- [ ] Die Summe aller selektierten Werte wird in einem Panel rechts unten auf der Seite angezeigt
- [ ] Das Panel erscheint, sobald mindestens ein Wert selektiert ist, und verschwindet, wenn die Selektion aufgehoben wird
- [ ] Nicht-editierbare Zellen (Aggregationszeilen, Gesamtzeile) können ebenfalls zur Selektion hinzugefügt werden
- [ ] Das Verhalten ist identisch mit der bestehenden Betragsselektion (PROJ-40 / PROJ-52 / PROJ-56)

### Notizen (PROJ-53)

- [ ] Der Nutzer kann für jede editierbare Zelle eine Notiz hinterlegen (identisches Verhalten wie in anderen Planungsseiten mit PROJ-53-Integration)
- [ ] Zellen mit Notiz zeigen ein visuelles Indikator-Icon
- [ ] Notizen werden über den gemeinsamen `planung_notizen`-Mechanismus (PROJ-53) gespeichert mit `kontext = 'produktinvestitions_planung'`

### Datenbankschema

- [ ] Neue Tabelle `produktinvestitions_planung`:
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `kategorie_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `kw_year` INTEGER NOT NULL (Jahr der Kalenderwoche, z. B. 2026)
  - `kw_number` INTEGER NOT NULL (Kalenderwoche 1–53)
  - `betrag_manuell` NUMERIC(12,2) NULL — NULL = kein Wert eingetragen
  - UNIQUE(`user_id`, `kategorie_id`, `kw_year`, `kw_number`)
  - CHECK: `kw_year` >= 2020, `kw_number` BETWEEN 1 AND 53
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

### API-Routen

- [ ] `GET /api/produktinvestitions-planung` — alle Einträge des Nutzers (ohne KW-Filter, analog zur Operativen Planung)
- [ ] `PUT /api/produktinvestitions-planung` — Upsert eines einzelnen Eintrags
  - Body: `{ kategorie_id, kw_year, kw_number, betrag_manuell? }`
  - `betrag_manuell: null` → Eintrag wird gelöscht (Zelle geleert)
  - Zod-Validierung: UUID, Integer für KW/Jahr, NUMERIC ≥ 0 oder null
- [ ] `requireAuth()` in allen Routen

## Edge Cases

- **Planungshorizont = 0 oder nicht gesetzt**: Fallback auf 13 Wochen
- **Kein „Produktinvestitionen"-Knoten im KPI-Modell oder ohne Kinder**: leerer Zustand mit Hinweis + Link zur KPI-Verwaltung
- **L1-Gruppe hat sowohl L1 als auch L2-Einträge**: nur L2-Zeilen sind editierbar; L1-Zeile aggregiert
- **Kategorie wird im KPI-Modell gelöscht**: ON DELETE CASCADE entfernt `produktinvestitions_planung`-Einträge; beim nächsten Seitenaufruf ist die Zeile nicht mehr sichtbar
- **Kw-Jahreswechsel** (z. B. KW52/2026 → KW1/2027): korrekte Spaltenberechnung über den Jahreswechsel hinweg
- **Leeres Feld bei onBlur (Feld wurde geleert)**: Wert auf NULL setzen (Eintrag löschen), Zelle erscheint leer
- **Betrag = 0 eingegeben**: gültig, wird als `0,00` gespeichert und angezeigt (unterscheidet sich von NULL/leer)
- **Sehr viele Kategorien**: Tabelle ist vertikal scrollbar; kein Layout-Bruch
- **Sehr viele Wochen** (z. B. 52 Spalten): horizontales Scrollen; Zeilenbeschriftungsspalte bleibt sticky
- **Neue Woche bereits mit Werten** (Nutzer hat vorausschauend gefüllt): rote Markierung erscheint nicht
- **API-Fehler bei onBlur**: Rollback auf den vorherigen Wert + Toast „Wert konnte nicht gespeichert werden."
- **„Produktinvestitionen"-Knoten ist mehrfach vorhanden**: Es werden alle Kategorien verwendet, die einen Elternknoten mit `name = 'Produktinvestitionen'` (case-insensitiv) und `type = 'ausgaben_kosten'` haben; bei Duplikaten werden alle berücksichtigt

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen Tabelle `produktinvestitions_planung`
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/produktinvestitionsplanung/page.tsx`
- Navigation: Eintrag „Produktinvestitionsplanung" in der Navigationsgruppe „Planung" in `nav-sheet.tsx`
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx` im Abschnitt „Planung"
- Wochenberechnung: ISO 8601 (Montag = Erster Tag der Woche); `date-fns` bereits vorhanden (`getISOWeek`, `getISOWeekYear`, `addWeeks`)
- Keine neuen Packages nötig: date-fns, shadcn/ui Table, Input, Dialog, Select, AlertDialog, Tooltip — alle bereits vorhanden
- Notizen-Integration analog zur Operativen Planung (PROJ-56)
- Implementierungsmuster: direkt von `src/components/operativeplanung-tabelle.tsx` und `src/hooks/use-operativeplanung.ts` ableiten — nur Knotenname, Tabelle, Route und Texte ersetzen

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/produktinvestitionsplanung/page.tsx` | Neue Seite — Client Component mit NavSheet, LogoutButton, Toaster |
| `src/components/produktinvestitionsplanung-tabelle.tsx` | Hauptkomponente analog zu `operativeplanung-tabelle.tsx` |
| `src/hooks/use-produktinvestitionsplanung.ts` | Hook analog zu `use-operativeplanung.ts`; filtert auf „Produktinvestitionen"-Subtree |
| `src/app/api/produktinvestitions-planung/route.ts` | GET (alle Werte), PUT (Upsert / Löschen bei null) |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Eintrag „Produktinvestitionsplanung" in der Navigationsgruppe „Planung" |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Kachel „Produktinvestitionsplanung" im Abschnitt „Planung" |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung/produktinvestitionsplanung  (NEUE Seite)
+-- Page-Header (Seitentitel „Produktinvestitionsplanung")
+-- ProduktinvestitionsPlanungTabelle  (NEUE Hauptkomponente — Client Component)
    +-- Leer-Zustand (wenn kein „Produktinvestitionen"-Knoten oder keine Kinder im KPI-Modell)
    +-- Scroll-Container (overflow-x: auto)
    |   +-- <table>
    |       +-- <thead>  (sticky top)
    |       |   +-- KW-Header-Zeile: [Label-Spalte sticky left] | [KW24/2026] | [KW25/2026] | ...
    |       +-- <tbody>  (flache Zeilen-Liste)
    |           +-- Gesamt-Zeile „Produktinvestitionen (Gesamt)" — immer sichtbar, nicht editierbar
    |           +-- [Pro L1-Gruppe]
    |               +-- Kategorie-Header-Zeile (einklappbar, Auf-/Zuklapp-Icon)
    |               +-- [wenn ausgeklappt + hat L2-Untergruppen]:
    |               |   +-- Aggregations-Zeile (Summe der L2-Zeilen, nicht editierbar)
    |               |   +-- Pro L2-Untergruppe: editierbare Zeile (eingerückt)
    |               +-- [wenn ausgeklappt + keine Untergruppen]:
    |                   +-- L1-Gruppe selbst: editierbare Zeile (Leaf)
    +-- BetragsselektionPanel  (fixed rechts unten — erscheint bei Selektion)

/dashboard/kurzfristige-planung  (bestehende Seite — geändert)
+-- Kachelraster → Abschnitt „Planung"
    +-- Kachel „Produktinvestitionsplanung" (NEU) → /dashboard/kurzfristige-planung/produktinvestitionsplanung
```

### Datenmodell

**Neue Tabelle `produktinvestitions_planung`** — identisches Schema wie `operative_planung`:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `user_id` | UUID FK → auth.users | Dateneigentümer — ON DELETE CASCADE |
| `kategorie_id` | UUID FK → kpi_categories | Produktinvestitionskategorie (Leaf-Ebene) — ON DELETE CASCADE |
| `kw_year` | INTEGER | Jahr der Kalenderwoche (z. B. 2026) |
| `kw_number` | INTEGER | ISO-Kalenderwoche (1–53) |
| `betrag_manuell` | NUMERIC(12,2) nullable | Eingegebener Betrag in €; NULL = Zelle leer |

UNIQUE-Constraint: `(user_id, kategorie_id, kw_year, kw_number)`.
Kein Datensatz = leere Zelle. Kein historischer Fallback.

### Zeilen-Typen (flaches Array)

Identisches Muster wie Operative Planung (PROJ-56):

| Typ | Editierbar | Beschreibung |
|---|---|---|
| `total` | Nein | „Produktinvestitionen (Gesamt)" — Summe aller Leaf-Zeilen |
| `category-header` | Nein | L1-Gruppe — Sektion mit Auf-/Zuklapp-Icon |
| `category-sum` | Nein | Aggregat-Zeile einer L1-Gruppe mit Kindern |
| `leaf` | Ja | Editierbare Zeile (L1 ohne Kinder oder L2) |

### Datenfluss

```
Seite öffnet sich
  → Hook lädt PARALLEL:
    ① GET /api/grundeinstellungen                → planungshorizont_wochen (N)
    ② GET /api/kpi-categories?type=ausgaben_kosten → alle Kategorien; Filter: Subtree unter „Produktinvestitionen"-Knoten
    ③ GET /api/produktinvestitions-planung        → alle manuellen Einträge des Nutzers

  → Frontend filtert: Kategorien deren parent_id auf den „Produktinvestitionen"-Knoten zeigt (L1)
    + deren Kinder (L2) — analog zur Kategorien-Auflösung in PROJ-56
  → Frontend berechnet anzuzeigende Wochen:
    Erste KW = ISO-Woche(heute) + 1 | Letzte KW = Erste KW + N − 1
  → Flaches Zeilen-Array: total → category-header (L1) → [category-sum + leafs (L2)] oder [leaf (L1)]
  → Merge pro Zelle: Eintrag in valueMap vorhanden → betrag_manuell; kein Eintrag → leer
  → Aggregation (frontend-seitig, reaktiv):
    category-sum KWn = Σ betrag_manuell aller L2-Kinder (NULL → 0)
    total KWn        = Σ betrag_manuell aller Leafs gesamt (NULL → 0)
  → Neuwoche-Prüfung: letzte KW ohne Einträge in valueMap → isNewWeek = true → rote Spaltenmarkierung

Nutzer bearbeitet Zelle (onBlur)
  → Optimistisches Update im lokalen State
  → Feld geleert → PUT /api/produktinvestitions-planung mit betrag_manuell: null (→ Eintrag gelöscht)
  → Feld mit Wert → PUT /api/produktinvestitions-planung mit betrag_manuell: <Wert>
  → Erfolg: valueMap aktualisiert | Fehler: Rollback + Toast

Notizen (PROJ-53)
  → Bestehender planung_notizen-Mechanismus
  → kontext = 'produktinvestitions_planung', zellenKey = '{kategorie_id}_{kw_year}_{kw_number}'
```

### API-Endpunkte

| Methode | Route | Zweck |
|---|---|---|
| `GET` | `/api/produktinvestitions-planung` | Alle Einträge des Nutzers (kein KW-Filter, max 2000) |
| `PUT` | `/api/produktinvestitions-planung` | Upsert einer Zelle; `betrag_manuell: null` → Eintrag löschen |

### Neue Dateien

| Datei | Vorlage | Zweck |
|---|---|---|
| `src/app/dashboard/kurzfristige-planung/produktinvestitionsplanung/page.tsx` | `operative-planung/page.tsx` | Neue Seite — Client Component mit NavSheet, LogoutButton, Toaster |
| `src/components/produktinvestitionsplanung-tabelle.tsx` | `operativeplanung-tabelle.tsx` | Hauptkomponente: flaches Zeilen-Array, Expand/Collapse, Inline-Edit, Betragsselektion, Notizen, rote Neuwoche-Markierung |
| `src/hooks/use-produktinvestitionsplanung.ts` | `use-operativeplanung.ts` | Zentraler State: Kategorien laden + „Produktinvestitionen"-Filter, valueMap, Wochenberechnung, upsertZelle |
| `src/app/api/produktinvestitions-planung/route.ts` | `operative-planung/route.ts` | GET (alle Werte), PUT (Upsert / Löschen bei null) |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Eintrag „Produktinvestitionsplanung" in der Navigationsgruppe „Planung" |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Kachel „Produktinvestitionsplanung" im Abschnitt „Planung" |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Direkte Adaption von PROJ-56 | Alle 4 Dateien aus Operativer Planung ableiten | Identisches Muster; nur KPI-Knotenname, Tabellen-/Routenname und Texte müssen ersetzt werden — keine neue Architektur nötig |
| KPI-Knoten-Filter: client-seitig | „Produktinvestitionen"-Knoten-Suche im Frontend | Bestehende KPI-Categories-API gibt alle Kategorien zurück; Client-Filter bereits in PROJ-55 und PROJ-56 bewährt |
| Kategorien-Typ: ausgaben_kosten | Wie Operativ (PROJ-56) | Produktinvestitionen liegen im KPI-Modell als `ausgaben_kosten`-Kategorie vor |
| Keine neuen Packages | Keine | date-fns, shadcn/ui Table, Input, Tooltip — alle bereits vorhanden |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
