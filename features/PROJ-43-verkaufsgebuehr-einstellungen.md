# PROJ-43: Verkaufsgebühr-Einstellungen — Kurzfristige Planung

## Status: Planned
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
_To be added by /architecture_

## Implementation Notes
_To be added by /frontend and /backend_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
