# PROJ-42: Absatzeinstellungen — Kurzfristige Planung

## Status: Planned
**Created:** 2026-06-01
**Last Updated:** 2026-06-01

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Sales-Plattformen (`kpi_categories` mit `type = 'sales_plattformen'`) und Produkte (`kpi_categories` mit `type = 'produkte'`, `level = 1`) müssen bereits gepflegt sein
- Requires: PROJ-41 (Bereichswechsler) — der Bereich "Kurzfristige Planung" muss als URL-Rahmen existieren; diese Seite erweitert ihn mit Navigation und einer Kachel

## Übersicht

Auf der Seite „Absatzeinstellungen" legt der Nutzer für jede Kombination aus **Sales-Plattform** und **Produkt** die Methode fest, mit der später der Absatz (Verkaufsmenge) berechnet werden soll. Die Seite ist Teil des Bereichs „Kurzfristige Planung" und ist über die linke Navigation sowie als Kachel auf der Dashboard-Übersichtsseite dieses Bereichs erreichbar.

Die Einstellungen werden in der Datenbank persistiert, da sie später in der Absatzberechnung weiterverarbeitet werden.

## User Stories

- Als Nutzer möchte ich die Seite „Absatzeinstellungen" über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können, damit ich schnell dorthin gelange.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite von „Kurzfristige Planung" eine Kachel „Absatzeinstellungen" sehen, damit ich von dort direkt auf die Seite wechseln kann.
- Als Nutzer möchte ich alle im KPI-Modell gepflegten Sales-Plattformen als Reiter oben auf der Seite sehen, damit ich die Einstellungen plattformspezifisch pflegen kann.
- Als Nutzer möchte ich je Reiter alle im KPI-Modell gepflegten Produkte (Ebene-1-Einträge unter `type = 'produkte'`) als Zeilen in einer Tabelle sehen, damit ich pro Produkt eine Einstellung wählen kann.
- Als Nutzer möchte ich für jedes Produkt individuell die Absatzberechnungsmethode wählen können (Mittelwert oder gewichteter Mittelwert über verschiedene Zeiträume, oder „keine"), damit ich die Methode an den Produkttyp anpassen kann.
- Als Nutzer möchte ich beim gewichteten Mittelwert drei Gewichtungsfelder (Erstes, Zweites, Drittes Drittel in %) eingeben können, deren Summe immer genau 100 % ergibt, damit die Gewichtung mathematisch korrekt ist.
- Als Nutzer möchte ich für jede Sales-Plattform und jedes Produkt unabhängig voneinander unterschiedliche Einstellungen pflegen können, damit die Plattformdaten realistisch abgebildet werden.
- Als Nutzer möchte ich, dass meine Einstellungen gespeichert werden und beim nächsten Aufruf noch vorhanden sind.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält eine Navigationsgruppe „Kurzfristige Planung" mit dem Eintrag „Absatzeinstellungen" → `/dashboard/kurzfristige-planung/absatzeinstellungen`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Absatzeinstellungen" (analog zu den Reporting-Kacheln), die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Reiter (Sales-Plattformen)

- [ ] Oben auf der Seite werden alle Einträge aus `kpi_categories` mit `type = 'sales_plattformen'` als Tabs dargestellt (in der in der DB gespeicherten `sort_order`)
- [ ] Beim ersten Laden ist der erste Reiter automatisch aktiv
- [ ] Gibt es keine Sales-Plattformen im KPI-Modell, erscheint ein Hinweis mit Link zur KPI-Modell-Seite: „Noch keine Sales-Plattformen gepflegt. Bitte zuerst im KPI-Modell Sales-Plattformen anlegen."

### Tabelle (Produkte pro Plattform)

- [ ] Unterhalb der Reiter wird eine Tabelle mit einer Zeile pro Produkt angezeigt (`kpi_categories` mit `type = 'produkte'`, `level = 1`, sortiert nach `sort_order`)
- [ ] Tabellenspalten (Basis):
  - **Produkt** (Name des Produkts — read-only)
  - **Berechnungsart** (Dropdown-Auswahl, pflichtmäßig)
- [ ] Gibt es keine Produkte, erscheint ein Hinweis mit Link zur KPI-Modell-Seite: „Noch keine Produkte gepflegt. Bitte zuerst im KPI-Modell Produkte anlegen."

### Dropdown: Berechnungsart

- [ ] Das Dropdown enthält genau diese 8 Optionen (in dieser Reihenfolge):
  1. Mittelwert 14 Tage
  2. Mittelwert 30 Tage
  3. Mittelwert 60 Tage
  4. Mittelwert 90 Tage
  5. Gewichteter Mittelwert 30 Tage
  6. Gewichteter Mittelwert 60 Tage
  7. Gewichteter Mittelwert 90 Tage
  8. Keine
- [ ] Standardwert bei neuen Einträgen (noch nie gespeichert): „Keine"
- [ ] Beim Ändern des Dropdowns wird die Auswahl sofort gespeichert (kein separater „Speichern"-Button nötig — Auto-Save per `onBlur` oder `onChange`)

### Gewichtungsspalten (konditionell)

- [ ] Wählt der Nutzer „Gewichteter Mittelwert 30 Tage", „Gewichteter Mittelwert 60 Tage" **oder** „Gewichteter Mittelwert 90 Tage", erscheinen in derselben Zeile drei zusätzliche Spalten:
  - **1. Drittel %** (Zahlenfeld, 0–100)
  - **2. Drittel %** (Zahlenfeld, 0–100)
  - **3. Drittel %** (Zahlenfeld, 0–100)
- [ ] Die drei Felder erscheinen **nur** bei gewichtetem Mittelwert — bei allen anderen Optionen bleiben diese Spalten leer/ausgeblendet
- [ ] Alle anderen Zeilen (die keine gewichtete Methode verwenden) zeigen in den drei Spalten keinen Inhalt
- [ ] Die Summe der drei Felder muss exakt **100 %** ergeben:
  - Solange die Summe ≠ 100, wird unter den Feldern eine Fehlermeldung angezeigt: „Die Summe muss 100 % ergeben (aktuell: X %)"
  - Speichern ist erst möglich, wenn die Summe 100 % beträgt (bei Auto-Save: Speichern wird verzögert bis Validierung erfüllt)
- [ ] Jedes Gewichtungsfeld akzeptiert nur ganze Zahlen von 0 bis 100
- [ ] Die Spaltenüberschriften „1. Drittel %", „2. Drittel %" und „3. Drittel %" sind **immer** in der Tabellenkopfzeile sichtbar, aber die Felder erscheinen nur in den Zeilen, die eine gewichtete Methode verwenden
- [ ] Wechselt der Nutzer von einer gewichteten Methode zurück auf eine nicht-gewichtete, werden die Gewichtungswerte in der DB auf `NULL` gesetzt

### Datenpersistenz

- [ ] Jede Kombination aus Sales-Plattform-ID und Produkt-ID wird als separater Datensatz gespeichert
- [ ] Beim Wechsel des Reiters werden die Einstellungen des neuen Reiters aus der DB geladen
- [ ] Beim ersten Aufruf einer Plattform-Produkt-Kombination existiert noch kein DB-Eintrag — die Zeile zeigt „Keine" als Standardwert
- [ ] Änderungen werden automatisch gespeichert (kein manueller „Speichern"-Button auf Seitenebene)
- [ ] Optimistische Updates: Änderung erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung, Rollback auf vorherigen Wert

### Datenbankschema

- [ ] Neue Tabelle `absatz_einstellungen`:
  - `id` UUID PK
  - `sales_plattform_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `berechnungsart` TEXT NOT NULL CHECK IN ('mittelwert_14', 'mittelwert_30', 'mittelwert_60', 'mittelwert_90', 'gewichtet_30', 'gewichtet_60', 'gewichtet_90', 'keine') DEFAULT 'keine'
  - `gewichtung_erstes_drittel` INTEGER CHECK (0–100) — NULL wenn nicht gewichtet
  - `gewichtung_zweites_drittel` INTEGER CHECK (0–100) — NULL wenn nicht gewichtet
  - `gewichtung_drittes_drittel` INTEGER CHECK (0–100) — NULL wenn nicht gewichtet
  - `user_id` UUID NOT NULL FK → `auth.users`
  - UNIQUE(`sales_plattform_id`, `produkt_id`, `user_id`) — ein Eintrag pro Kombination pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

### API-Routen

- [ ] `GET /api/absatz-einstellungen?plattform_id=<UUID>` — alle Einstellungen des Nutzers für eine Plattform
- [ ] `PUT /api/absatz-einstellungen` — Eintrag anlegen oder aktualisieren (Upsert per `sales_plattform_id + produkt_id + user_id`)
  - Body: `{ sales_plattform_id, produkt_id, berechnungsart, gewichtung_erstes_drittel?, gewichtung_zweites_drittel?, gewichtung_drittes_drittel? }`
- [ ] Zod-Validierung:
  - `berechnungsart` muss einer der 8 gültigen Werte sein
  - Bei gewichteter Methode: alle drei Gewichtungsfelder müssen vorhanden und integer 0–100 sein; Summe muss 100 ergeben (serverseitig validiert)
  - Bei nicht-gewichteter Methode: Gewichtungsfelder werden auf `NULL` gesetzt (ignoriert wenn mitgesendet)

## Edge Cases

- **Keine Sales-Plattformen** im KPI-Modell: Seite zeigt Hinweis mit Link zum KPI-Modell, keine Tabelle
- **Keine Produkte** im KPI-Modell: Tabelle zeigt Hinweis mit Link zum KPI-Modell, keine Zeilen
- **Nutzer wählt gewichtete Methode ohne Gewichtungswerte** einzutragen: Felder erscheinen leer mit Validierungshinweis, Auto-Save wird zurückgehalten bis Validierung bestanden
- **Summe ≠ 100** bei gewichteter Methode: Fehlermeldung in Zeile, API blockiert den Speicherversuch mit 422
- **Plattform wird aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `absatz_einstellungen` für diese Plattform automatisch; beim nächsten Seitenaufruf ist der Reiter verschwunden
- **Produkt wird aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `absatz_einstellungen` für dieses Produkt; Zeile verschwindet aus der Tabelle
- **Neue Plattform oder neues Produkt hinzugefügt**: erscheint beim nächsten Seitenaufruf (kein Live-Update nötig); Eintrag hat noch keine `absatz_einstellungen` → „Keine" als Default
- **API-Fehler beim Auto-Save**: Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden.", optimistisches Update wird zurückgerollt
- **Sehr viele Produkte** (>20): Tabelle ist scrollbar; keine Paginierung nötig
- **Sehr viele Plattformen** (>5): Reiter-Leiste wird scrollbar (overflow-x: auto)

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen Tabelle `absatz_einstellungen`
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/absatzeinstellungen/page.tsx`
- Navigation erweitert: Gruppe „Kurzfristige Planung" mit Eintrag „Absatzeinstellungen" in `nav-sheet.tsx` (nur sichtbar wenn aktiver Bereich = `kurzfristige-planung`)
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx` hinzufügen (Placeholder-Seite aus PROJ-41 ersetzen durch echte Kachelansicht)
- shadcn `Tabs`-Komponente für die Reiter-Navigation
- shadcn `Select`-Komponente für die Berechnungsart-Dropdown
- Zahlenfelder als `<Input type="number">` mit min=0, max=100, step=1
- Kein Drag-and-Drop nötig (read-only Reihenfolge aus KPI-Modell)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
