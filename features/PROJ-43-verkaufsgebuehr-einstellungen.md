# PROJ-43: Verkaufsgebühr-Einstellungen — Kurzfristige Planung

## Status: Architected
**Created:** 2026-06-01
**Last Updated:** 2026-06-01

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Sales-Plattformen (`kpi_categories` mit `type = 'sales_plattformen'`) und Produkte (`kpi_categories` mit `type = 'produkte'`, `level = 1`) müssen bereits gepflegt sein
- Requires: PROJ-42 (Absatzeinstellungen) — der Bereich „Kurzfristige Planung" inkl. linker Navigation und Dashboard-Kachelseite ist bereits aufgebaut; diese Seite ergänzt ihn um eine weitere Kachel und einen weiteren Nav-Eintrag

## Übersicht

Auf der Seite „Verkaufsgebühr-Einstellungen" pflegt der Nutzer für jede Kombination aus **Sales-Plattform** und **Produkt** die plattformspezifische Verkaufsgebühr als prozentualen Wert. Die Seite ist Teil des Bereichs „Kurzfristige Planung", über die linke Navigation erreichbar und als Kachel auf der Dashboard-Übersichtsseite verlinkt.

Die Einstellungen werden in der Datenbank persistiert und können später in Berechnungen (z. B. Deckungsbeitragsplanung) verwendet werden.

## User Stories

- Als Nutzer möchte ich die Seite „Verkaufsgebühr-Einstellungen" über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können, damit ich schnell dorthin gelange.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite von „Kurzfristige Planung" eine Kachel „Verkaufsgebühr-Einstellungen" sehen, damit ich von dort direkt auf die Seite wechseln kann.
- Als Nutzer möchte ich alle im KPI-Modell gepflegten Sales-Plattformen als Reiter oben auf der Seite sehen, damit ich die Gebühren plattformspezifisch pflegen kann.
- Als Nutzer möchte ich je Reiter alle im KPI-Modell gepflegten Produkte (Ebene-1-Einträge unter `type = 'produkte'`) als Zeilen in einer Tabelle sehen.
- Als Nutzer möchte ich für jedes Produkt und jede Sales-Plattform einen prozentualen Gebührenwert eingeben können, damit die plattformspezifischen Verkaufsgebühren korrekt abgebildet werden.
- Als Nutzer möchte ich, dass meine eingetragenen Werte gespeichert werden und beim nächsten Aufruf noch vorhanden sind.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag „Verkaufsgebühr-Einstellungen" → `/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Verkaufsgebühr-Einstellungen", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Reiter (Sales-Plattformen)

- [ ] Oben auf der Seite werden alle Einträge aus `kpi_categories` mit `type = 'sales_plattformen'` als Tabs dargestellt (sortiert nach `sort_order`)
- [ ] Beim ersten Laden ist der erste Reiter automatisch aktiv
- [ ] Gibt es keine Sales-Plattformen im KPI-Modell, erscheint ein Hinweis mit Link zur KPI-Modell-Seite: „Noch keine Sales-Plattformen gepflegt. Bitte zuerst im KPI-Modell Sales-Plattformen anlegen."

### Tabelle (Produkte pro Plattform)

- [ ] Unterhalb der Reiter wird eine Tabelle mit einer Zeile pro Produkt angezeigt (`kpi_categories` mit `type = 'produkte'`, `level = 1`, sortiert nach `sort_order`)
- [ ] Tabellenspalten:
  - **Produkt** (Name des Produkts — read-only)
  - **Verkaufsgebühr (%)** (Zahlenfeld, editierbar)
- [ ] Gibt es keine Produkte, erscheint ein Hinweis mit Link zur KPI-Modell-Seite: „Noch keine Produkte gepflegt. Bitte zuerst im KPI-Modell Produkte anlegen."

### Verkaufsgebühr-Feld

- [ ] Das Feld akzeptiert Dezimalzahlen ≥ 0 (z. B. `19.5`)
- [ ] Es gibt keine implizite Obergrenze — Werte über 100 % sind erlaubt (manche Plattformgebühren können addiert > 100 sein)
- [ ] Standardwert bei noch nie gespeicherten Kombinationen: leer (kein Wert angezeigt)
- [ ] Änderungen werden automatisch gespeichert (Auto-Save per `onBlur` — kein separater „Speichern"-Button)
- [ ] Optimistische Updates: Wert erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung, Rollback auf vorherigen Wert

### Datenpersistenz

- [ ] Jede Kombination aus Sales-Plattform-ID und Produkt-ID wird als separater Datensatz gespeichert
- [ ] Beim Wechsel des Reiters werden die Einstellungen des neuen Reiters aus der DB geladen
- [ ] Beim ersten Aufruf einer Plattform-Produkt-Kombination existiert noch kein DB-Eintrag — das Feld ist leer

### Datenbankschema

- [ ] Neue Tabelle `verkaufsgebuehr_einstellungen`:
  - `id` UUID PK
  - `sales_plattform_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `verkaufsgebuehr_prozent` NUMERIC(6,2) — NULL wenn noch nicht gepflegt
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - UNIQUE(`sales_plattform_id`, `produkt_id`, `user_id`) — ein Eintrag pro Kombination pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

### API-Routen

- [ ] `GET /api/verkaufsgebuehr-einstellungen?plattform_id=<UUID>` — alle Einstellungen des Nutzers für eine Plattform
- [ ] `PUT /api/verkaufsgebuehr-einstellungen` — Eintrag anlegen oder aktualisieren (Upsert)
  - Body: `{ sales_plattform_id, produkt_id, verkaufsgebuehr_prozent }`
  - Zod-Validierung: `verkaufsgebuehr_prozent` muss eine Zahl ≥ 0 sein (oder `null` zum Löschen)
  - Response 400 bei ungültigen Werten

## Edge Cases

- **Keine Sales-Plattformen** im KPI-Modell: Seite zeigt Hinweis mit Link zum KPI-Modell, keine Tabelle
- **Keine Produkte** im KPI-Modell: Tabelle zeigt Hinweis, keine Zeilen
- **Nutzer löscht Wert aus Feld und verlässt es (`onBlur`)**: Upsert mit `verkaufsgebuehr_prozent = null` — Feld wird wieder leer dargestellt
- **Plattform aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `verkaufsgebuehr_einstellungen` für diese Plattform; Reiter verschwindet beim nächsten Seitenaufruf
- **Produkt aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `verkaufsgebuehr_einstellungen` für dieses Produkt; Zeile verschwindet beim nächsten Seitenaufruf
- **Neue Plattform / neues Produkt hinzugefügt**: erscheint beim nächsten Seitenaufruf mit leerem Feld
- **API-Fehler beim Auto-Save**: Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden.", optimistisches Update wird zurückgerollt
- **Sehr viele Produkte** (>20): Tabelle ist scrollbar, keine Paginierung nötig
- **Sehr viele Plattformen** (>5): Reiter-Leiste wird scrollbar (overflow-x: auto)

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen API-Routen
- RLS auf der neuen Tabelle `verkaufsgebuehr_einstellungen`
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen/page.tsx`
- Nav-Eintrag in `nav-sheet.tsx`: Eintrag „Verkaufsgebühr-Einstellungen" zur bestehenden Gruppe „Kurzfristige Planung" hinzufügen
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx` ergänzen
- shadcn `Tabs`-Komponente für die Reiter-Navigation
- shadcn `Input type="number"` für das Prozent-Feld (min=0, step=0.01)
- Architektur und Muster analog zu PROJ-42 (Absatzeinstellungen): gleiche Hook-Struktur, gleiche Komponenten-Hierarchie

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung  (bestehende Kachelseite — aus PROJ-42)
+-- Kachelraster  (bereits vorhanden)
    +-- Kachel: "Absatzeinstellungen"  (bereits vorhanden)
    +-- Kachel: "Verkaufsgebühr-Einstellungen" (NEU) → /dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen

/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen  (NEUE Seite)
+-- Page-Header (identische Struktur wie andere Seiten)
+-- VerkaufsgebuehrEinstellungenTabelle  (NEUE Hauptkomponente)
    +-- Tabs  [shadcn — eine Tab je Sales-Plattform aus KPI-Modell]
    |   +-- Tab: "Plattform A"
    |   +-- Tab: "Plattform B"
    |   +-- ...
    +-- Leerzustand A: keine Plattformen → Hinweis + Link zu KPI-Modell
    +-- (je aktivem Tab) Leerzustand B: keine Produkte → Hinweis + Link zu KPI-Modell
    +-- (je aktivem Tab) Table  [shadcn]
        +-- TableHeader: Produkt | Verkaufsgebühr (%)
        +-- TableBody: eine Zeile je Produkt
            +-- VerkaufsgebuehrEinstellungZeile  (NEUE Zeilen-Komponente)
                +-- Produktname  (read-only Text)
                +-- Input: Verkaufsgebühr %  (Dezimalzahl ≥ 0, Auto-Save onBlur)
```

### Datenmodell

**Neue Tabelle `verkaufsgebuehr_einstellungen`:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `sales_plattform_id` | UUID FK | Verknüpfung mit `kpi_categories` (type = sales_plattformen) — ON DELETE CASCADE |
| `produkt_id` | UUID FK | Verknüpfung mit `kpi_categories` (type = produkte, level = 1) — ON DELETE CASCADE |
| `verkaufsgebuehr_prozent` | NUMERIC(6,2) nullable | Prozentualer Gebührenwert (z. B. 15.00); NULL = noch nicht gepflegt |
| `user_id` | UUID FK | Dateneigentümer — RLS: jeder Nutzer sieht nur eigene Einträge |

Unique-Constraint: `(sales_plattform_id, produkt_id, user_id)` — eine Einstellung pro Kombination pro Nutzer.

### Datenfluss

```
Seite öffnet sich
  → Hook lädt alle Sales-Plattformen aus kpi_categories (type = sales_plattformen)
  → Hook lädt alle Produkte aus kpi_categories (type = produkte, level = 1)
  → Erster Plattform-Tab wird automatisch aktiviert
  → Hook lädt verkaufsgebuehr_einstellungen für aktive Plattform per GET

Nutzer wechselt Tab
  → Hook lädt Einstellungen für neue Plattform (falls noch nicht gecacht)

Nutzer ändert Gebühren-Feld und verlässt es (onBlur)
  → Optimistisches Update in der UI (sofort sichtbar)
  → PUT /api/verkaufsgebuehr-einstellungen (Upsert)
  → Bei Fehler: Rollback auf vorherigen Wert + Toast-Fehlermeldung

Nutzer löscht Feld und verlässt es (onBlur)
  → Upsert mit verkaufsgebuehr_prozent = null
  → Feld wird leer dargestellt
```

### API-Endpunkte

```
GET  /api/verkaufsgebuehr-einstellungen?plattform_id=<UUID>
  → Alle Einstellungen des Nutzers für eine Plattform
  → Response: Array von { produkt_id, verkaufsgebuehr_prozent }

PUT  /api/verkaufsgebuehr-einstellungen
  → Upsert einer Plattform-Produkt-Kombination
  → Body: { sales_plattform_id, produkt_id, verkaufsgebuehr_prozent }
  → Zod-Validierung: verkaufsgebuehr_prozent muss Zahl ≥ 0 oder null sein
  → Response 400 bei ungültigen Werten
```

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen/page.tsx` | Neue Seite (Client Component mit Auth-Guard) |
| `src/components/verkaufsgebuehr-einstellungen-tabelle.tsx` | Hauptkomponente: Tabs, Tabelle, Zeilen, Auto-Save-Logik |
| `src/hooks/use-verkaufsgebuehr-einstellungen.ts` | State-Management: laden, upsert, optimistic update, rollback |
| `src/app/api/verkaufsgebuehr-einstellungen/route.ts` | GET + PUT (Upsert) mit Zod + requireAuth() |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Eintrag „Verkaufsgebühr-Einstellungen" zur bestehenden Gruppe „Kurzfristige Planung" ergänzen |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Kachel „Verkaufsgebühr-Einstellungen" zum bestehenden Kachelraster hinzufügen |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Muster | Identisch zu PROJ-42 | Gleiche Seite, gleiche Datenhaltung — Konsistenz spart Entwicklungszeit |
| Speichern | Auto-Save (onBlur) | Kein globaler Submit-Button — einheitlich mit allen anderen Einstellungsseiten |
| Dezimalzahl | NUMERIC(6,2) | Erlaubt Werte wie 15.75 %; 6 Stellen inkl. 2 Nachkommastellen reichen für Gebühren |
| Obergrenze | Keine | Addierte Plattformgebühren können > 100 % sein; UI-Validierung wäre hier irreführend |
| Neue Packages | Keine | Tabs, Table, Input — alles bereits in shadcn/ui installiert |

## Implementation Notes
_To be added by /frontend and /backend_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
