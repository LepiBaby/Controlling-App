# PROJ-44: Versandausgaben-Einstellungen — Kurzfristige Planung

## Status: Planned
**Created:** 2026-06-01
**Last Updated:** 2026-06-01

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Sales-Plattformen (`kpi_categories` mit `type = 'sales_plattformen'`) und Produkte (`kpi_categories` mit `type = 'produkte'`, `level = 1`) müssen bereits gepflegt sein
- Requires: PROJ-42 (Absatzeinstellungen) — der Bereich „Kurzfristige Planung" inkl. linker Navigation und Dashboard-Kachelseite ist bereits aufgebaut; diese Seite ergänzt ihn um eine weitere Kachel und einen weiteren Nav-Eintrag

## Übersicht

Auf der Seite „Versandausgaben-Einstellungen" pflegt der Nutzer für jede Kombination aus **Sales-Plattform** und **Produkt** die produktspezifische Versandgebühr als Nettowert in Euro. Zusätzlich gibt es einen plattformübergreifenden Bereich **„Allgemein"**, in dem die Gruppierung (Zeitraum-Granularität) und das Zahlungsziel (in Tagen) festgelegt werden können.

Die Seite ist Teil des Bereichs „Kurzfristige Planung", über die linke Navigation erreichbar und als Kachel auf der Dashboard-Übersichtsseite verlinkt.

## User Stories

- Als Nutzer möchte ich die Seite „Versandausgaben-Einstellungen" über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können, damit ich schnell dorthin gelange.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite von „Kurzfristige Planung" eine Kachel „Versandausgaben-Einstellungen" sehen, damit ich von dort direkt auf die Seite wechseln kann.
- Als Nutzer möchte ich alle im KPI-Modell gepflegten Sales-Plattformen als Reiter oben auf der Seite sehen, damit ich die Versandgebühren plattformspezifisch pflegen kann.
- Als Nutzer möchte ich je Reiter alle im KPI-Modell gepflegten Produkte als Zeilen in einer Tabelle sehen, damit ich pro Produkt die Versandgebühr eintragen kann.
- Als Nutzer möchte ich für jedes Produkt und jede Sales-Plattform einen Netto-Versandgebührenwert in Euro eingeben können, damit die plattform- und produktspezifischen Versandkosten korrekt abgebildet werden.
- Als Nutzer möchte ich im Reiter „Allgemein" eine Gruppierung (wöchentlich, monatlich, quartalsweise) auswählen können, damit ich die zeitliche Granularität für Versandausgaben festlegen kann.
- Als Nutzer möchte ich im Reiter „Allgemein" ein Zahlungsziel in Tagen eintragen können, damit Zahlungsfristen für Versanddienstleister hinterlegt sind.
- Als Nutzer möchte ich, dass meine eingetragenen Werte gespeichert werden und beim nächsten Aufruf noch vorhanden sind.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag „Versandausgaben-Einstellungen" → `/dashboard/kurzfristige-planung/versandausgaben-einstellungen`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Versandausgaben-Einstellungen", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Reiter-Navigation

- [ ] Oben auf der Seite werden alle Einträge aus `kpi_categories` mit `type = 'sales_plattformen'` als Tabs dargestellt (sortiert nach `sort_order`)
- [ ] Zusätzlich gibt es am Ende der Reiter-Leiste einen festen Reiter **„Allgemein"** (immer sichtbar, nicht aus dem KPI-Modell)
- [ ] Beim ersten Laden ist der erste Sales-Plattform-Reiter automatisch aktiv
- [ ] Gibt es keine Sales-Plattformen im KPI-Modell, wird der Reiter „Allgemein" automatisch aktiv und die Plattform-Tabs-Leiste zeigt nur „Allgemein"

### Reiter: Sales-Plattformen — Tabelle (Produkte)

- [ ] Unterhalb des aktiven Plattform-Reiters wird eine Tabelle mit einer Zeile pro Produkt angezeigt (`kpi_categories` mit `type = 'produkte'`, `level = 1`, sortiert nach `sort_order`)
- [ ] Tabellenspalten:
  - **Produkt** (Name des Produkts — read-only)
  - **Versandgebühr (€ netto)** (Zahlenfeld, editierbar)
- [ ] Gibt es keine Sales-Plattformen im KPI-Modell, erscheint ein Hinweis: „Noch keine Sales-Plattformen gepflegt. Bitte zuerst im KPI-Modell Sales-Plattformen anlegen." (mit Link zur KPI-Modell-Seite)
- [ ] Gibt es keine Produkte, erscheint ein Hinweis: „Noch keine Produkte gepflegt. Bitte zuerst im KPI-Modell Produkte anlegen." (mit Link zur KPI-Modell-Seite)

### Versandgebühr-Feld (Plattform-Tabs)

- [ ] Das Feld akzeptiert Dezimalzahlen ≥ 0 (z. B. `4.99`)
- [ ] Standardwert bei noch nie gespeicherten Kombinationen: leer (kein Wert angezeigt)
- [ ] Änderungen werden automatisch gespeichert (Auto-Save per `onBlur` — kein separater „Speichern"-Button)
- [ ] Optimistische Updates: Wert erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung, Rollback auf vorherigen Wert
- [ ] Nutzer leert das Feld und verlässt es (`onBlur`): Upsert mit `versandgebuehr_euro_netto = null` — Feld wird wieder leer dargestellt

### Reiter: Allgemein

- [ ] Der Reiter „Allgemein" enthält zwei Einstellungsfelder (kein Tabellen-Layout — einfaches Formular oder Karten-Layout):
  - **Gruppierung** (Dropdown-Auswahl):
    - Optionen: „Wöchentlich", „Monatlich", „Quartalsweise" (in dieser Reihenfolge)
    - Standardwert bei noch nicht gespeichertem Eintrag: „Monatlich"
    - Änderung wird automatisch gespeichert (Auto-Save per `onChange`)
  - **Zahlungsziel** (Zahlenfeld):
    - Ganzzahl ≥ 0, in Tagen
    - Standardwert bei noch nicht gespeichertem Eintrag: leer
    - Änderung wird automatisch gespeichert (Auto-Save per `onBlur`)
- [ ] Die Allgemein-Einstellungen sind pro Nutzer gespeichert (nicht pro Plattform/Produkt)

### Datenpersistenz

- [ ] Jede Kombination aus Sales-Plattform-ID und Produkt-ID wird als separater Datensatz gespeichert
- [ ] Beim Wechsel des Plattform-Reiters werden die Einstellungen des neuen Reiters aus der DB geladen
- [ ] Die Allgemein-Einstellungen (Gruppierung, Zahlungsziel) werden als einzelner Datensatz pro Nutzer gespeichert
- [ ] Beim ersten Aufruf einer Plattform-Produkt-Kombination existiert noch kein DB-Eintrag — das Feld ist leer
- [ ] Beim ersten Aufruf von „Allgemein" ohne vorherige Speicherung zeigt Gruppierung „Monatlich" und Zahlungsziel ist leer

### Datenbankschema

- [ ] Neue Tabelle `versandausgaben_einstellungen`:
  - `id` UUID PK
  - `sales_plattform_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `versandgebuehr_euro_netto` NUMERIC(10,2) — NULL wenn noch nicht gepflegt
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - UNIQUE(`sales_plattform_id`, `produkt_id`, `user_id`) — ein Eintrag pro Kombination pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

- [ ] Neue Tabelle `versandausgaben_allgemein_einstellungen`:
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `gruppierung` TEXT NOT NULL CHECK IN ('woechentlich', 'monatlich', 'quartalsweise') DEFAULT 'monatlich'
  - `zahlungsziel_tage` INTEGER CHECK (≥ 0) — NULL wenn noch nicht gepflegt
  - UNIQUE(`user_id`) — genau ein Eintrag pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

### API-Routen

- [ ] `GET /api/versandausgaben-einstellungen?plattform_id=<UUID>` — alle Einstellungen des Nutzers für eine Plattform
- [ ] `PUT /api/versandausgaben-einstellungen` — Upsert einer Plattform-Produkt-Kombination
  - Body: `{ sales_plattform_id, produkt_id, versandgebuehr_euro_netto }`
  - Zod-Validierung: `versandgebuehr_euro_netto` muss Zahl ≥ 0 oder `null` sein
  - Response 400 bei ungültigen Werten
- [ ] `GET /api/versandausgaben-allgemein-einstellungen` — Allgemein-Einstellungen des Nutzers laden
- [ ] `PUT /api/versandausgaben-allgemein-einstellungen` — Allgemein-Einstellungen upserten
  - Body: `{ gruppierung?, zahlungsziel_tage? }`
  - Zod-Validierung: `gruppierung` muss einer der 3 gültigen Werte sein; `zahlungsziel_tage` muss Integer ≥ 0 oder `null` sein
  - Response 400 bei ungültigen Werten

## Edge Cases

- **Keine Sales-Plattformen** im KPI-Modell: Plattform-Tabs fehlen; nur Reiter „Allgemein" sichtbar und automatisch aktiv
- **Keine Produkte** im KPI-Modell: Plattform-Tab zeigt Hinweis, keine Zeilen
- **Nutzer leert Versandgebühr-Feld und verlässt es**: Upsert mit `null` — Feld bleibt leer; kein Fehler
- **Nutzer trägt 0 als Versandgebühr ein**: gültiger Wert, wird als `0.00` gespeichert
- **Plattform aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `versandausgaben_einstellungen` für diese Plattform; Reiter verschwindet beim nächsten Seitenaufruf
- **Produkt aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle `versandausgaben_einstellungen` für dieses Produkt; Zeile verschwindet beim nächsten Seitenaufruf
- **Neue Plattform / neues Produkt hinzugefügt**: erscheint beim nächsten Seitenaufruf mit leerem Feld
- **API-Fehler beim Auto-Save**: Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden.", optimistisches Update wird zurückgerollt
- **Zahlungsziel: Nutzer trägt Dezimalzahl ein**: Eingabe wird auf ganze Zahl gerundet (oder Eingabe wird auf `integer` validiert/blockiert)
- **Zahlungsziel: Nutzer trägt negativen Wert ein**: API blockiert mit 400; UI zeigt Validierungsfehler
- **Sehr viele Produkte** (>20): Tabelle ist scrollbar, keine Paginierung nötig
- **Sehr viele Plattformen** (>5): Reiter-Leiste wird scrollbar (overflow-x: auto); Reiter „Allgemein" bleibt immer am Ende sichtbar

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen API-Routen
- RLS auf beiden neuen Tabellen
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/versandausgaben-einstellungen/page.tsx`
- Nav-Eintrag in `nav-sheet.tsx`: Eintrag „Versandausgaben-Einstellungen" zur bestehenden Gruppe „Kurzfristige Planung" hinzufügen
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx` ergänzen
- shadcn `Tabs`-Komponente für die Reiter-Navigation (inkl. festem „Allgemein"-Tab)
- shadcn `Select`-Komponente für das Gruppierung-Dropdown
- shadcn `Input type="number"` für Versandgebühr-Feld (min=0, step=0.01) und Zahlungsziel-Feld (min=0, step=1)
- Architektur und Muster analog zu PROJ-43 (Verkaufsgebühr-Einstellungen): gleiche Hook-Struktur, gleiche Komponenten-Hierarchie

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
