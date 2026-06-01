# PROJ-44: Versandausgaben-Einstellungen — Kurzfristige Planung

## Status: In Review
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

### Komponentenstruktur

```
/dashboard/kurzfristige-planung  (bestehende Kachelseite — aus PROJ-42)
+-- Kachelraster  (bereits vorhanden)
    +-- Kachel: "Absatzeinstellungen"  (bereits vorhanden)
    +-- Kachel: "Verkaufsgebühr-Einstellungen"  (bereits vorhanden)
    +-- Kachel: "Versandausgaben-Einstellungen" (NEU) → /dashboard/kurzfristige-planung/versandausgaben-einstellungen

/dashboard/kurzfristige-planung/versandausgaben-einstellungen  (NEUE Seite)
+-- Page-Header (identische Struktur wie andere Seiten)
+-- VersandausgabenEinstellungenTabelle  (NEUE Hauptkomponente)
    +-- Tabs  [shadcn — dynamische Plattform-Tabs + fester "Allgemein"-Tab]
    |   +-- Tab: "Plattform A"
    |   +-- Tab: "Plattform B"
    |   +-- ...
    |   +-- Tab: "Allgemein"  (immer sichtbar, immer am Ende)
    +-- Leerzustand: keine Plattformen → nur "Allgemein"-Tab sichtbar
    +-- (je aktivem Plattform-Tab) Leerzustand B: keine Produkte → Hinweis + Link zu KPI-Modell
    +-- (je aktivem Plattform-Tab) Table  [shadcn]
    |   +-- TableHeader: Produkt | Versandgebühr (€ netto)
    |   +-- TableBody: eine Zeile je Produkt
    |       +-- VersandausgabenEinstellungZeile  (NEUE Zeilen-Komponente)
    |           +-- Produktname  (read-only Text)
    |           +-- Input: Versandgebühr €  (Dezimalzahl ≥ 0, Auto-Save onBlur)
    +-- (bei aktivem "Allgemein"-Tab) VersandausgabenAllgemeinForm  (NEUE Formular-Komponente)
        +-- Feld: Gruppierung  [shadcn Select — 3 Optionen]
        +-- Feld: Zahlungsziel  [shadcn Input type="number", ganzzahlig ≥ 0]
```

### Datenmodell

**Neue Tabelle `versandausgaben_einstellungen`** — eine Zeile pro Plattform-Produkt-Kombination pro Nutzer:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `sales_plattform_id` | UUID FK | Verknüpfung mit `kpi_categories` (type = sales_plattformen) — ON DELETE CASCADE |
| `produkt_id` | UUID FK | Verknüpfung mit `kpi_categories` (type = produkte, level = 1) — ON DELETE CASCADE |
| `versandgebuehr_euro_netto` | NUMERIC(10,2) nullable | Netto-Versandgebühr in Euro (z. B. 4.99); NULL = noch nicht gepflegt |
| `user_id` | UUID FK | Dateneigentümer — RLS: jeder Nutzer sieht nur eigene Einträge |

Unique-Constraint: `(sales_plattform_id, produkt_id, user_id)` — eine Einstellung pro Kombination pro Nutzer.

**Neue Tabelle `versandausgaben_allgemein_einstellungen`** — genau eine Zeile pro Nutzer:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `user_id` | UUID FK | Dateneigentümer — ON DELETE CASCADE; UNIQUE — ein Eintrag pro Nutzer |
| `gruppierung` | TEXT NOT NULL | Einer von: `woechentlich`, `monatlich`, `quartalsweise`; Default: `monatlich` |
| `zahlungsziel_tage` | INTEGER nullable (≥ 0) | Zahlungsziel in Tagen; NULL = noch nicht gepflegt |

### Datenfluss

```
Seite öffnet sich
  → Komponente lädt alle Sales-Plattformen aus kpi_categories (type = sales_plattformen)
  → Komponente lädt alle Produkte aus kpi_categories (type = produkte, level = 1)
  → Erster Plattform-Tab wird aktiv (oder "Allgemein" wenn keine Plattformen)
  → Hook lädt versandausgaben_einstellungen für aktive Plattform per GET

Nutzer wechselt auf Plattform-Tab
  → Hook lädt Einstellungen für neue Plattform (falls noch nicht gecacht)

Nutzer ändert Versandgebühr-Feld und verlässt es (onBlur)
  → Optimistisches Update in der UI (sofort sichtbar)
  → PUT /api/versandausgaben-einstellungen (Upsert)
  → Bei Fehler: Rollback auf vorherigen Wert + Toast-Fehlermeldung

Nutzer wechselt auf "Allgemein"-Tab
  → Hook lädt versandausgaben_allgemein_einstellungen per GET
  → Zeigt Gruppierung (Default: Monatlich wenn kein Eintrag) und Zahlungsziel

Nutzer ändert Gruppierung (onChange)
  → Sofortiger Upsert: PUT /api/versandausgaben-allgemein-einstellungen

Nutzer ändert Zahlungsziel und verlässt Feld (onBlur)
  → Upsert: PUT /api/versandausgaben-allgemein-einstellungen
```

### API-Endpunkte

```
GET  /api/versandausgaben-einstellungen?plattform_id=<UUID>
  → Alle Einstellungen des Nutzers für eine Plattform
  → Response: Array von { produkt_id, versandgebuehr_euro_netto }

PUT  /api/versandausgaben-einstellungen
  → Upsert einer Plattform-Produkt-Kombination
  → Body: { sales_plattform_id, produkt_id, versandgebuehr_euro_netto }
  → Validierung: versandgebuehr_euro_netto muss Zahl ≥ 0 oder null sein
  → Response 400 bei ungültigen Werten

GET  /api/versandausgaben-allgemein-einstellungen
  → Allgemein-Einstellungen des eingeloggten Nutzers
  → Response: { gruppierung, zahlungsziel_tage } (oder null wenn noch kein Eintrag)

PUT  /api/versandausgaben-allgemein-einstellungen
  → Upsert der Allgemein-Einstellungen des Nutzers
  → Body: { gruppierung?, zahlungsziel_tage? }
  → Validierung: gruppierung ∈ {'woechentlich','monatlich','quartalsweise'};
    zahlungsziel_tage muss Integer ≥ 0 oder null sein
  → Response 400 bei ungültigen Werten
```

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/versandausgaben-einstellungen/page.tsx` | Neue Seite (Client Component mit Auth-Guard) |
| `src/components/versandausgaben-einstellungen-tabelle.tsx` | Hauptkomponente: Tabs (Plattform + Allgemein), Tabelle, Formular, Auto-Save-Logik |
| `src/hooks/use-versandausgaben-einstellungen.ts` | State-Management Plattform-Tab: laden, upsert, optimistic update, rollback |
| `src/hooks/use-versandausgaben-allgemein-einstellungen.ts` | State-Management Allgemein-Tab: laden + upsert der globalen Felder |
| `src/app/api/versandausgaben-einstellungen/route.ts` | GET + PUT (Upsert) für Plattform-Produkt-Einstellungen mit Zod + requireAuth() |
| `src/app/api/versandausgaben-allgemein-einstellungen/route.ts` | GET + PUT (Upsert) für Allgemein-Einstellungen mit Zod + requireAuth() |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Eintrag „Versandausgaben-Einstellungen" zur bestehenden Gruppe „Kurzfristige Planung" ergänzen |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Kachel „Versandausgaben-Einstellungen" zum bestehenden Kachelraster hinzufügen |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Muster | Identisch zu PROJ-43 | Gleiche Seiten-Struktur und Datenhaltung — Konsistenz, weniger neue Komplexität |
| „Allgemein"-Tab | Fester Tab am Ende der Tab-Leiste | Klare Trennung: plattformspezifische Daten vs. globale Einstellungen; Tab-UI ist für Nutzer bereits vertraut |
| Allgemein-Daten | Separate Tabelle + separater Hook/API | Anderer Datentyp (1:1 pro Nutzer vs. N:M Plattform × Produkt) — Mischen würde das Schema verkomplizieren |
| Speichern | Auto-Save (onBlur / onChange je Feld) | Kein globaler Submit-Button — einheitlich mit allen anderen Einstellungsseiten im Projekt |
| Dezimalzahl (Versandgebühr) | NUMERIC(10,2) | Erlaubt Werte wie 4.99 €; 10 Stellen inkl. 2 Nachkommastellen reichen für Versandgebühren |
| Neue Packages | Keine | Tabs, Select, Table, Input — alles bereits in shadcn/ui installiert |

## Implementation Notes (Frontend — 2026-06-01)

### Neue Dateien
- `src/hooks/use-versandausgaben-einstellungen.ts` — Typ `VersandausgabenEinstellung`, Hook `useVersandausgabenEinstellungen(plattformId)` mit Laden, optimistischem Upsert und Rollback
- `src/hooks/use-versandausgaben-allgemein-einstellungen.ts` — Typ `VersandausgabenAllgemeinEinstellungen`, Konstanten `GRUPPIERUNGEN` und `GRUPPIERUNG_LABELS`, Hook `useVersandausgabenAllgemeinEinstellungen()` mit Laden und Upsert
- `src/components/versandausgaben-einstellungen-tabelle.tsx` — Vier Komponenten: `VersandausgabenEinstellungZeile` (lokaler State, Auto-Save onBlur), `PlattformTabelle` (pro Plattform mit eigenem Hook-Aufruf), `AllgemeinForm` (Gruppierung Select + Zahlungsziel Input, useRef für Initialisierung), `VersandausgabenEinstellungenTabelle` (Export, lädt Plattformen + Produkte, rendert Tabs inkl. festem Allgemein-Tab)
- `src/app/dashboard/kurzfristige-planung/versandausgaben-einstellungen/page.tsx` — Client Component, Page-Header + `VersandausgabenEinstellungenTabelle`

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — Eintrag „Versandausgaben-Einstellungen" zur bestehenden Gruppe „Kurzfristige Planung" ergänzt
- `src/app/dashboard/kurzfristige-planung/page.tsx` — Kachel „Versandausgaben-Einstellungen" zum Kachelraster hinzugefügt

### Designentscheidungen
- `AllgemeinForm` nutzt einen `useRef`-Guard (`initializedRef`) um den lokalen `zahlungszielStr`-State genau einmal beim ersten vollständigen Laden zu initialisieren — verhindert Überschreiben von Nutzereingaben durch verzögerte API-Antworten
- Zahlungsziel-Wert wird auf `Math.round()` gerundet damit Dezimalzahlen korrekt auf Integer gemappt werden
- „Allgemein"-Tab ist immer der letzte Tab; `defaultValue="allgemein"` wenn keine Plattformen im KPI-Modell gepflegt sind

### Build
- `npm run build` ✅ — alle 54 Routen korrekt, `/dashboard/kurzfristige-planung/versandausgaben-einstellungen` in der Route-Liste

## Implementation Notes (Backend — 2026-06-01, v1)

### Datenbankmigrierung (v1)
- Migration `proj44_versandausgaben_einstellungen` erfolgreich auf Supabase-Projekt `kdmpghtdoguppfqhdscq` angewendet
- Tabelle `versandausgaben_einstellungen` angelegt (mit `versandgebuehr_euro_netto`, NUMERIC(10,2))
- Tabelle `versandausgaben_allgemein_einstellungen` angelegt (Gruppierung + Zahlungsziel, pro Nutzer)
- RLS, Indexes, Constraints — siehe v2-Notes unten für aktuellen Stand

### Abweichungen von der Spec (v1 → v2 Redesign)
Auf Wunsch des Nutzers wurde das Design nach der v1-Implementierung komplett restrukturiert:

1. **Kein „Allgemein"-Tab mehr** — `versandausgaben_allgemein_einstellungen`-Tabelle und alle zugehörigen Dateien wurden entfernt
2. **Gruppierung + Zahlungsziel jetzt pro Sales-Plattform** — neue Tabelle `versandausgaben_plattform_einstellungen`; die zwei Felder erscheinen oben in jedem Plattform-Tab
3. **Versandgebühr-Spalte aufgeteilt** — aus einer Spalte `versandgebuehr_euro_netto` wurden drei: `versandgebuehr_spediteur` (editierbar), `versandgebuehr_3pl` (editierbar), Summe (read-only, automatisch berechnet)

## Implementation Notes (Backend — 2026-06-01, v2 Redesign)

### Datenbankmigrierung (v2)
- Migration `proj44_versandausgaben_v2_restructure` auf Supabase angewendet:
  - Alte Tabellen `versandausgaben_einstellungen` und `versandausgaben_allgemein_einstellungen` gedroppt
  - Neue Tabelle `versandausgaben_einstellungen` angelegt mit `versandgebuehr_spediteur` NUMERIC(10,4) und `versandgebuehr_3pl` NUMERIC(10,4) (beide nullable), UNIQUE `(sales_plattform_id, produkt_id, user_id)`
  - Neue Tabelle `versandausgaben_plattform_einstellungen` angelegt mit `gruppierung` TEXT (DEFAULT 'monatlich', CHECK auf 3 Werte) und `zahlungsziel_tage` INTEGER (CHECK ≥ 0), UNIQUE `(sales_plattform_id, user_id)`
  - RLS mit je 4 Policies (SELECT/INSERT/UPDATE/DELETE) auf beiden Tabellen
  - Indexes: `idx_ve_plattform_user` auf `versandausgaben_einstellungen(sales_plattform_id, user_id)`, `idx_vpe_plattform_user` auf `versandausgaben_plattform_einstellungen(sales_plattform_id, user_id)`

### API-Routen (v2)
- `GET /api/versandausgaben-einstellungen?plattform_id=<UUID>` — gibt Array mit `id, sales_plattform_id, produkt_id, versandgebuehr_spediteur, versandgebuehr_3pl` zurück
- `PUT /api/versandausgaben-einstellungen` — Upsert via `onConflict: 'sales_plattform_id,produkt_id,user_id'`; Zod validiert beide Gebührenfelder als Zahl ≥ 0 oder null; beide Felder werden immer zusammen gesendet (blur eines Felds sendet aktuellen Wert des anderen mit)
- `GET /api/versandausgaben-plattform-einstellungen?plattform_id=<UUID>` — gibt `{ gruppierung, zahlungsziel_tage }` oder null zurück
- `PUT /api/versandausgaben-plattform-einstellungen` — Fetch-then-merge-Pattern; `'zahlungsziel_tage' in body`-Check für explizites null vs. nicht-gesendet; Upsert via `onConflict: 'sales_plattform_id,user_id'`

### Gelöschte Dateien (v1 → v2)
- `src/hooks/use-versandausgaben-allgemein-einstellungen.ts` — ersetzt durch `use-versandausgaben-plattform-einstellungen.ts`
- `src/app/api/versandausgaben-allgemein-einstellungen/route.ts` — ersetzt durch `versandausgaben-plattform-einstellungen/route.ts`

### Tests (v2)
- `src/app/api/versandausgaben-einstellungen/route.test.ts` — 24 Tests (Vitest): 5 GET, 10 PUT — alle bestanden ✅
- `src/app/api/versandausgaben-plattform-einstellungen/route.test.ts` — 15 Tests (Vitest): 5 GET, 10 PUT — alle bestanden ✅

### Build (v2)
- `npm run build` ✅ — 58 Routen, TypeScript-Fehler: keine, `/dashboard/kurzfristige-planung/versandausgaben-einstellungen` in der Route-Liste

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
