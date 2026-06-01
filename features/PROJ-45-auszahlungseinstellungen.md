# PROJ-45: Auszahlungseinstellungen — Kurzfristige Planung

## Status: In Progress
**Created:** 2026-06-01
**Last Updated:** 2026-06-01

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Sales-Plattformen (`kpi_categories` mit `type = 'sales_plattformen'`) müssen bereits gepflegt sein
- Requires: PROJ-42 (Absatzeinstellungen) — der Bereich „Kurzfristige Planung" inkl. linker Navigation und Dashboard-Kachelseite ist bereits aufgebaut; diese Seite ergänzt ihn um eine weitere Kachel und einen weiteren Nav-Eintrag

## Übersicht

Auf der Seite „Auszahlungseinstellungen" pflegt der Nutzer für jede **Sales-Plattform** den Auszahlungsrhythmus, die nächste Auszahlungswoche sowie zwei Inklusionskennzeichen (Retouren, Marketing). Im Gegensatz zu den anderen Einstellungsseiten wird hier keine Produkt-Tabelle angezeigt — die Einstellungen gelten auf Plattformebene.

Die angezeigte „nächste Auszahlungswoche" wird bei jedem Seitenaufruf dynamisch aus der gespeicherten Basis-Kalenderwoche und dem Auszahlungsrhythmus berechnet: Sie zeigt immer die nächste zukünftige Auszahlungswoche, ohne dass der Nutzer die Basis manuell anpassen muss.

Die Seite ist Teil des Bereichs „Kurzfristige Planung", über die linke Navigation erreichbar und als Kachel auf der Dashboard-Übersichtsseite verlinkt.

## User Stories

- Als Nutzer möchte ich die Seite „Auszahlungseinstellungen" über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können, damit ich schnell dorthin gelange.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite von „Kurzfristige Planung" eine Kachel „Auszahlungseinstellungen" sehen, damit ich von dort direkt auf die Seite wechseln kann.
- Als Nutzer möchte ich alle im KPI-Modell gepflegten Sales-Plattformen als Reiter oben auf der Seite sehen, damit ich die Auszahlungseinstellungen plattformspezifisch pflegen kann.
- Als Nutzer möchte ich für jede Plattform den Auszahlungsrhythmus über ein Dropdown festlegen können (wöchentlich, alle 2, 3 oder 4 Wochen), damit das Auszahlungsmodell korrekt abgebildet wird.
- Als Nutzer möchte ich für jede Plattform eine Basis-Kalenderwoche (KW + Jahr) eingeben können, anhand derer die nächste Auszahlung berechnet wird, damit ich nicht nach jeder Auszahlung manuell einen neuen Wert eintragen muss.
- Als Nutzer möchte ich, dass mir beim Seitenaufruf immer die nächste zukünftige Auszahlungswoche angezeigt wird — automatisch fortgeschrieben aus dem Rhythmus —, damit ich den Überblick behalte ohne manuelle Pflege.
- Als Nutzer möchte ich per Checkbox festlegen können, ob Retourenausgaben für diese Plattform inkludiert sind, damit die Plattformdaten korrekt berechnet werden.
- Als Nutzer möchte ich per Checkbox festlegen können, ob Marketingausgaben für diese Plattform inkludiert sind, damit die Plattformdaten korrekt berechnet werden.
- Als Nutzer möchte ich, dass meine eingetragenen Werte gespeichert werden und beim nächsten Aufruf noch vorhanden sind.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag „Auszahlungseinstellungen" → `/dashboard/kurzfristige-planung/auszahlungseinstellungen`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Auszahlungseinstellungen", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Reiter-Navigation (Sales-Plattformen)

- [ ] Oben auf der Seite werden alle Einträge aus `kpi_categories` mit `type = 'sales_plattformen'` als Tabs dargestellt (sortiert nach `sort_order`)
- [ ] Beim ersten Laden ist der erste Reiter automatisch aktiv
- [ ] Gibt es keine Sales-Plattformen im KPI-Modell, erscheint ein Hinweis: „Noch keine Sales-Plattformen gepflegt. Bitte zuerst im KPI-Modell Sales-Plattformen anlegen." (mit Link zur KPI-Modell-Seite)

### Einstellungsformular pro Plattform

Unterhalb der Reiter wird für die aktive Plattform ein Formular mit genau vier Einstellungszeilen angezeigt (kein Tabellen-Layout mit Produkten):

#### Zeile 1: Auszahlungsrhythmus

- [ ] Beschriftung: „Auszahlungsrhythmus"
- [ ] Eingabeelement: Dropdown (shadcn `Select`)
- [ ] Optionen (in dieser Reihenfolge):
  1. Wöchentlich
  2. Alle 2 Wochen
  3. Alle 3 Wochen
  4. Alle 4 Wochen
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: „Wöchentlich"
- [ ] Auto-Save bei `onChange` (kein separater „Speichern"-Button)

#### Zeile 2: Nächste Auszahlungswoche

- [ ] Beschriftung: „Nächste Auszahlungswoche"
- [ ] Zwei separate Eingabefelder nebeneinander:
  - **KW** (`<Input type="number">`, min=1, max=53, ganzzahlig)
  - **Jahr** (`<Input type="number">`, min=2024, ganzzahlig, 4-stellig)
- [ ] Das Feld zeigt **nicht** die gespeicherte Basis, sondern die berechnete nächste Auszahlungswoche (siehe Berechnungslogik unten)
- [ ] Auto-Save per `onBlur` auf jedem der beiden Felder: gespeichert wird der aktuell angezeigte (berechnete oder manuell geänderte) Wert als neue Basis
- [ ] Wenn der Nutzer einen neuen KW/Jahr-Wert einträgt und das Feld verlässt, wird dieser Wert direkt als neue Basis gespeichert (Override)
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: beide Felder leer

#### Zeile 3: Retouren inkludiert

- [ ] Beschriftung: „Retouren"
- [ ] Eingabeelement: Checkbox (shadcn `Checkbox`)
- [ ] Standardwert: nicht angehakt (false)
- [ ] Auto-Save bei `onChange`

#### Zeile 4: Marketing inkludiert

- [ ] Beschriftung: „Marketing"
- [ ] Eingabeelement: Checkbox (shadcn `Checkbox`)
- [ ] Standardwert: nicht angehakt (false)
- [ ] Auto-Save bei `onChange`

### Berechnungslogik „Nächste Auszahlungswoche"

Die angezeigte Auszahlungswoche wird **bei jedem Seitenaufruf im Frontend dynamisch berechnet** — der DB-Wert ändert sich dabei nicht automatisch.

**Algorithmus:**

1. Lies `basis_kw` und `basis_jahr` aus der DB (gespeicherte Basis)
2. Ermittle die aktuelle Kalenderwoche (`current_kw`) und das aktuelle Jahr (`current_jahr`) via JavaScript (`date-fns` oder nativer ISO-Week-Berechnung)
3. Starte mit `display_kw = basis_kw`, `display_jahr = basis_jahr`
4. Solange `(display_jahr, display_kw) < (current_jahr, current_kw)`:
   - Addiere den Rhythmus (1, 2, 3 oder 4 Wochen) zur Wochennummer
   - Falls `display_kw` die Anzahl der ISO-Wochen im aktuellen Jahr überschreitet: `display_kw -= weeksInYear(display_jahr)`, `display_jahr += 1`
5. Zeige `KW {display_kw} / {display_jahr}` in den Eingabefeldern an

**Beispiel:**
- Basis: KW 24 / 2026, Rhythmus: alle 2 Wochen
- Aktuell: KW 25 / 2026
- KW 24 < KW 25 → advance: KW 24 + 2 = KW 26
- KW 26 ≥ KW 25 → **Anzeige: KW 26 / 2026**

**Beispiel Jahreswechsel:**
- Basis: KW 50 / 2026, Rhythmus: alle 4 Wochen
- Aktuell: KW 2 / 2027
- KW 50/2026 < KW 2/2027 → advance: KW 54/2026 → KW 2/2027 (52 Wochen in 2026) → KW 2/2027 ≥ KW 2/2027 → weiter (gleich oder früher): KW 2 + 4 = KW 6/2027
- **Anzeige: KW 6 / 2027**

> Hinweis: ISO-Wochen (Montag = erster Tag; KW 1 = Woche mit dem ersten Donnerstag des Jahres). 2026 hat 52 ISO-Wochen; manche Jahre haben 53.

### Datenpersistenz

- [ ] Für jede Plattform wird ein separater Datensatz pro Nutzer gespeichert (UNIQUE auf `sales_plattform_id + user_id`)
- [ ] Beim Wechsel des Plattform-Reiters werden die Einstellungen des neuen Reiters aus der DB geladen
- [ ] Beim ersten Aufruf einer Plattform ohne vorherige Speicherung zeigt das Formular die Standardwerte (Rhythmus: Wöchentlich; KW/Jahr: leer; Checkboxen: nicht angehakt)
- [ ] Änderungen werden automatisch gespeichert (kein manueller „Speichern"-Button)
- [ ] Optimistische Updates: Änderung erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung, Rollback auf vorherigen Wert

### Datenbankschema

- [ ] Neue Tabelle `auszahlungs_einstellungen`:
  - `id` UUID PK
  - `sales_plattform_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
  - `auszahlungsrhythmus` TEXT NOT NULL CHECK IN ('woechentlich', 'alle_zwei_wochen', 'alle_drei_wochen', 'alle_vier_wochen') DEFAULT 'woechentlich'
  - `naechste_auszahlung_basis_kw` INTEGER CHECK (≥ 1 AND ≤ 53) — NULL wenn noch nicht gepflegt
  - `naechste_auszahlung_basis_jahr` INTEGER CHECK (≥ 2024) — NULL wenn noch nicht gepflegt
  - `retouren_inkludiert` BOOLEAN NOT NULL DEFAULT false
  - `marketing_inkludiert` BOOLEAN NOT NULL DEFAULT false
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - UNIQUE(`sales_plattform_id`, `user_id`) — ein Eintrag pro Plattform pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

### API-Routen

- [ ] `GET /api/auszahlungs-einstellungen?plattform_id=<UUID>` — Einstellung des Nutzers für eine Plattform laden
  - Response: `{ auszahlungsrhythmus, naechste_auszahlung_basis_kw, naechste_auszahlung_basis_jahr, retouren_inkludiert, marketing_inkludiert }` oder `null` wenn kein Eintrag
- [ ] `PUT /api/auszahlungs-einstellungen` — Upsert der Einstellungen für eine Plattform
  - Body: `{ sales_plattform_id, auszahlungsrhythmus?, naechste_auszahlung_basis_kw?, naechste_auszahlung_basis_jahr?, retouren_inkludiert?, marketing_inkludiert? }`
  - Zod-Validierung:
    - `auszahlungsrhythmus` muss einer der 4 gültigen Werte sein (wenn angegeben)
    - `naechste_auszahlung_basis_kw` muss Integer 1–53 oder `null` sein
    - `naechste_auszahlung_basis_jahr` muss Integer ≥ 2024 oder `null` sein
    - Wenn `basis_kw` angegeben, muss `basis_jahr` ebenfalls angegeben sein (und umgekehrt)
  - Response 400 bei ungültigen Werten
  - Response 200 bei Erfolg

## Edge Cases

- **Keine Sales-Plattformen** im KPI-Modell: Seite zeigt Hinweis mit Link zum KPI-Modell; keine Reiter und kein Formular
- **KW und Jahr nicht zusammen befüllt**: UI erlaubt kein `onBlur`-Speichern, wenn nur eines der beiden Felder befüllt ist — beide müssen ausgefüllt oder beide leer sein; ein Validierungshinweis erscheint bei inkonsistenter Eingabe
- **Nutzer leert beide Felder (KW und Jahr)**: Upsert mit `naechste_auszahlung_basis_kw = null` und `naechste_auszahlung_basis_jahr = null`; Felder bleiben leer angezeigt
- **Basis-KW liegt weit in der Vergangenheit**: Algorithmus berechnet trotzdem korrekt die nächste zukünftige Woche (ggf. mehrere Rhythmus-Schritte); keine Endlosschleife, da Rhythmus immer ≥ 1 Woche
- **Jahresüberlauf beim Auszahlungsrhythmus**: Korrekte ISO-Wochenberechnung unter Berücksichtigung von Jahren mit 52 vs. 53 ISO-Wochen
- **Plattform aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt den Datensatz; Reiter verschwindet beim nächsten Seitenaufruf
- **Neue Plattform hinzugefügt**: erscheint beim nächsten Seitenaufruf mit Standardwerten (noch kein DB-Eintrag)
- **API-Fehler beim Auto-Save**: Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden.", optimistisches Update wird zurückgerollt
- **Sehr viele Plattformen** (>5): Reiter-Leiste wird scrollbar (overflow-x: auto)
- **Basis-KW = 53 in einem Jahr mit nur 52 Wochen**: UI sollte diesen Fall validieren und den Nutzer hinweisen (KW 53 existiert nicht in jedem Jahr)

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen API-Routen
- RLS auf der neuen Tabelle `auszahlungs_einstellungen`
- ISO-Wochenberechnung im Frontend: `date-fns` (bereits im Projekt oder lightweight native Implementierung) für `getISOWeek(date)` und `getISOWeeksInYear(year)`
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/auszahlungseinstellungen/page.tsx`
- Nav-Eintrag in `nav-sheet.tsx`: Eintrag „Auszahlungseinstellungen" zur bestehenden Gruppe „Kurzfristige Planung" hinzufügen
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx` ergänzen
- shadcn `Tabs`-Komponente für die Reiter-Navigation
- shadcn `Select`-Komponente für das Rhythmus-Dropdown
- shadcn `Input type="number"` für KW- und Jahr-Feld
- shadcn `Checkbox`-Komponente für Retouren und Marketing
- Architektur und Muster analog zu PROJ-43 (Verkaufsgebühr-Einstellungen): gleiche Hook-Struktur, gleiche Komponenten-Hierarchie — jedoch ohne Produkt-Tabelle

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung  (bestehende Kachelseite)
+-- Kachelraster  (bereits vorhanden)
    +-- Kachel: "Absatzeinstellungen"  (bereits vorhanden)
    +-- Kachel: "Verkaufsgebühr-Einstellungen"  (bereits vorhanden)
    +-- Kachel: "Versandausgaben-Einstellungen"  (bereits vorhanden)
    +-- Kachel: "Auszahlungseinstellungen" (NEU) → /dashboard/kurzfristige-planung/auszahlungseinstellungen

/dashboard/kurzfristige-planung/auszahlungseinstellungen  (NEUE Seite)
+-- Page-Header (identische Struktur wie andere Seiten)
+-- AuszahlungseinstellungenFormular  (NEUE Hauptkomponente)
    +-- Tabs  [shadcn — eine Tab je Sales-Plattform aus KPI-Modell]
    |   +-- Tab: "Plattform A"
    |   +-- Tab: "Plattform B"
    |   +-- ...
    +-- Leerzustand: keine Plattformen → Hinweis + Link zu KPI-Modell
    +-- (je aktivem Tab) AuszahlungseinstellungenPlatformForm  (NEUE Formular-Komponente)
        +-- Zeile 1: Auszahlungsrhythmus  [shadcn Select — 4 Optionen]
        +-- Zeile 2: Nächste Auszahlungswoche
        |   +-- Input: KW  [shadcn Input type="number", min=1 max=53]
        |   +-- Input: Jahr  [shadcn Input type="number", min=2024]
        |   +-- Validierungshinweis: "KW und Jahr müssen gemeinsam befüllt oder leer sein"
        +-- Zeile 3: Retouren  [shadcn Checkbox]
        +-- Zeile 4: Marketing  [shadcn Checkbox]
```

### Datenmodell

**Neue Tabelle `auszahlungs_einstellungen`** — eine Zeile pro Plattform pro Nutzer:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `sales_plattform_id` | UUID FK | Verknüpfung mit `kpi_categories` (type = sales_plattformen) — ON DELETE CASCADE |
| `auszahlungsrhythmus` | TEXT NOT NULL | Einer von: `woechentlich`, `alle_zwei_wochen`, `alle_drei_wochen`, `alle_vier_wochen`; Default: `woechentlich` |
| `naechste_auszahlung_basis_kw` | INTEGER nullable (1–53) | Anker-Kalenderwoche; NULL wenn noch nicht gepflegt |
| `naechste_auszahlung_basis_jahr` | INTEGER nullable (≥ 2024) | Ankerjahr; NULL wenn noch nicht gepflegt (immer zusammen mit basis_kw) |
| `retouren_inkludiert` | BOOLEAN NOT NULL | Default: false |
| `marketing_inkludiert` | BOOLEAN NOT NULL | Default: false |
| `user_id` | UUID FK | Dateneigentümer — RLS: jeder Nutzer sieht nur eigene Einträge; ON DELETE CASCADE |

Unique-Constraint: `(sales_plattform_id, user_id)` — eine Einstellung pro Plattform pro Nutzer.

**Wichtiger Unterschied zu PROJ-42/43/44:** Kein Produkt-Bezug — die Einstellungen gelten auf Plattformebene. Daher kein `produkt_id`-Feld und keine Tabelle mit Produktzeilen.

### Datenfluss & Berechnungslogik

```
Seite öffnet sich
  → Komponente lädt alle Sales-Plattformen aus kpi_categories (type = sales_plattformen)
  → Erster Plattform-Tab wird aktiv
  → Hook lädt auszahlungs_einstellungen für aktive Plattform per GET
  → Frontend berechnet die angezeigte KW:
      calculateNextPayoutWeek(basis_kw, basis_jahr, rhythmus_wochen, aktuelle_kw, aktuelles_jahr)
  → KW/Jahr-Felder zeigen das berechnete Ergebnis an (nicht den rohen DB-Wert)

Nutzer wechselt Plattform-Tab
  → Hook lädt Einstellungen der neuen Plattform (falls noch nicht gecacht)

Nutzer ändert Rhythmus-Dropdown (onChange)
  → Optimistisches Update in der UI
  → PUT /api/auszahlungs-einstellungen (Upsert)
  → Bei Fehler: Rollback + Toast

Nutzer bearbeitet KW oder Jahr und verlässt das Feld (onBlur)
  → Validierung: KW und Jahr müssen beide befüllt oder beide leer sein
  → Bei ungültiger Kombination: Validierungshinweis, kein API-Aufruf
  → Bei gültiger Eingabe: eingegebener Wert wird als neue Basis gespeichert
    PUT /api/auszahlungs-einstellungen mit neuen basis_kw und basis_jahr
  → Anzeige neu berechnen auf Basis des neuen Ankers

Nutzer ändert Checkbox Retouren oder Marketing (onChange)
  → Optimistisches Update in der UI
  → PUT /api/auszahlungs-einstellungen (Upsert)
  → Bei Fehler: Rollback + Toast
```

**Berechnungslogik `calculateNextPayoutWeek` (Frontend-Utility, kein DB-Aufruf):**

Die Funktion nimmt Anker-KW, Ankerjahr, Rhythmus (in Wochen) und die aktuelle KW/Jahr und gibt die nächste zukünftige Auszahlungswoche zurück. Sie rückt den Anker-Zeitpunkt um den Rhythmus vor, bis sie eine Woche ≥ aktueller Woche erreicht. Jahresgrenzen (52 oder 53 ISO-Wochen) werden korrekt behandelt — analog zur bestehenden `isoWeekKey`-Logik in der Liquiditäts-API. Keine externe Bibliothek nötig; eine kleine Pure-Function reicht.

### API-Endpunkte

```
GET  /api/auszahlungs-einstellungen?plattform_id=<UUID>
  → Einstellungen des eingeloggten Nutzers für eine Plattform
  → Response: { auszahlungsrhythmus, naechste_auszahlung_basis_kw,
                naechste_auszahlung_basis_jahr, retouren_inkludiert,
                marketing_inkludiert } oder null wenn noch kein Eintrag

PUT  /api/auszahlungs-einstellungen
  → Upsert (anlegen oder aktualisieren) einer Plattform-Einstellung
  → Body: { sales_plattform_id, auszahlungsrhythmus?, naechste_auszahlung_basis_kw?,
             naechste_auszahlung_basis_jahr?, retouren_inkludiert?, marketing_inkludiert? }
  → Zod-Validierung:
      auszahlungsrhythmus ∈ 4 erlaubter Werte
      basis_kw: Integer 1–53 oder null
      basis_jahr: Integer ≥ 2024 oder null
      basis_kw und basis_jahr müssen gemeinsam gesetzt oder gemeinsam null sein
  → Response 400 bei ungültigen Werten
```

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/auszahlungseinstellungen/page.tsx` | Neue Seite (Client Component mit Auth-Guard) |
| `src/components/auszahlungseinstellungen-formular.tsx` | Hauptkomponente: Tabs (Plattformen), Formular mit 4 Zeilen, KW-Berechnungslogik |
| `src/hooks/use-auszahlungs-einstellungen.ts` | State-Management: laden, upsert, optimistisches Update, Rollback; enthält `calculateNextPayoutWeek`-Utility |
| `src/app/api/auszahlungs-einstellungen/route.ts` | GET + PUT (Upsert) mit Zod + requireAuth() |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Eintrag „Auszahlungseinstellungen" zur bestehenden Gruppe „Kurzfristige Planung" ergänzen |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Kachel „Auszahlungseinstellungen" zum bestehenden Kachelraster hinzufügen |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Muster | Identisch zu PROJ-43 (Hook + Hauptkomponente) | Gleiche Seiten-Infrastruktur — Konsistenz, weniger neue Komplexität |
| Kein Produkt-Bezug | Plattform-Level-Einstellungen | Auszahlungsrhythmus gilt für die ganze Plattform, nicht pro Produkt |
| KW-Berechnung | Frontend-Only (kein DB-Update) | DB speichert nur den Anker; die Anzeige wird bei jedem Laden neu berechnet — kein Hintergrundjob nötig |
| ISO-Wochen | Native JS Pure-Function (kein date-fns) | date-fns ist nicht im Projekt; die Berechnung ist in 10–15 Zeilen native JS lösbar (analog zu liquiditaet/route.ts) |
| KW + Jahr getrennt | Zwei INTEGER-Spalten | Explizit und einfach; kein DATE-Typ nötig, kein Timezone-Risiko |
| Speichern | Auto-Save (onChange für Dropdown+Checkboxen, onBlur für KW/Jahr) | Einheitlich mit allen anderen Einstellungsseiten im Projekt |
| Neue Packages | Keine | Tabs, Select, Input, Checkbox — alles bereits in shadcn/ui installiert |

## Implementation Notes (Frontend — 2026-06-01)

### Neue Dateien
- `src/hooks/use-auszahlungs-einstellungen.ts` — Typen (`Rhythmus`, `AuszahlungsEinstellung`), Konstanten (`RHYTHMUS_WOCHEN`, `RHYTHMUS_LABELS`, `RHYTHMUS_VALUES`), ISO-Week-Utilities (`getISOWeeksInYear`, `getCurrentISOWeekAndYear`, `calculateNextPayoutWeek`), Hook `useAuszahlungsEinstellungen(plattformId)` mit optimistischem Upsert und Rollback
- `src/components/auszahlungseinstellungen-formular.tsx` — Zwei Komponenten: `AuszahlungseinstellungenPlatformForm` (Formular je Plattform mit 4 Zeilen, KW-Berechnung, Container-Blur-Handling für KW/Jahr-Felder) und `AuszahlungseinstellungenFormular` (Export, lädt Plattformen, rendert Tabs)
- `src/app/dashboard/kurzfristige-planung/auszahlungseinstellungen/page.tsx` — Client Component, max-w-3xl (schmaler als andere Seiten, da kein Tabellen-Layout)
- `src/app/api/auszahlungs-einstellungen/route.ts` — GET (maybeSingle, gibt null wenn noch kein Eintrag) + PUT (Upsert mit `onConflict: 'sales_plattform_id,user_id'`) mit Zod + requireAuth(); `superRefine` prüft KW+Jahr gemeinsam gesetzt oder beide null

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — Eintrag „Auszahlungseinstellungen" zur Gruppe „Kurzfristige Planung" ergänzt
- `src/app/dashboard/kurzfristige-planung/page.tsx` — Kachel „Auszahlungseinstellungen" zum Kachelraster hinzugefügt (grid wird jetzt 4 Kacheln)

### Designentscheidungen
- **KW/Jahr Sync via containerFocusedRef**: Ein `useRef` auf dem Container-div der KW/Jahr-Felder verhindert, dass der `useEffect` (der `localKw`/`localJahr` aus `displayedKw` synct) die User-Eingabe überschreibt, solange der Nutzer die Felder bearbeitet. `onFocus` setzt `containerFocusedRef.current = true`, `onBlur` prüft `e.currentTarget.contains(e.relatedTarget)` um Tab-Wechsel zwischen KW und Jahr-Feld korrekt zu behandeln.
- **`calculateNextPayoutWeek` pure function**: Verschiebt den Anker-Zeitpunkt um den Rhythmus vorwärts, bis er ≥ aktueller KW ist. Jahresgrenzen werden korrekt behandelt (getISOWeeksInYear). Keine externe Bibliothek nötig.
- **GET mit maybeSingle**: Gibt `null` zurück wenn noch kein Eintrag — unterscheidet sich von den Array-Returns der anderen Einstellungsseiten, da es nur einen Datensatz pro Plattform+Nutzer gibt.
- **max-w-3xl**: Da kein Tabellen-Layout mit Produkten, reicht eine schmalere Breite für das Formular.

### Build
- `npm run build` ✅ — alle 58 Routen korrekt, `/dashboard/kurzfristige-planung/auszahlungseinstellungen` und `/api/auszahlungs-einstellungen` in Route-Liste

### Hinweis Backend
- DB-Tabelle `auszahlungs_einstellungen` noch nicht migriert → `/backend` muss die Migration durchführen, bevor die API produktiv funktioniert

## Implementation Notes (Backend — 2026-06-01)

### Datenbankmigrierung
- Migration `proj45_auszahlungs_einstellungen` erfolgreich auf Supabase-Projekt `kdmpghtdoguppfqhdscq` angewendet
- Tabelle `auszahlungs_einstellungen` angelegt mit: UUID-PK, FK zu `kpi_categories` (ON DELETE CASCADE), CHECK-Constraint auf `auszahlungsrhythmus` (4 Werte), INTEGER-CHECK (KW: 1–53, Jahr: ≥ 2024), BOOLEAN-Defaults für `retouren_inkludiert`/`marketing_inkludiert`, FK zu `auth.users` (ON DELETE CASCADE)
- CHECK-Constraint `chk_kw_jahr_both_or_neither`: KW und Jahr müssen gemeinsam gesetzt oder beide NULL sein — DB-seitige Durchsetzung der Spec-Anforderung
- UNIQUE-Constraint `(sales_plattform_id, user_id)` — ein Eintrag pro Plattform pro Nutzer
- RLS aktiviert mit 4 Policies (SELECT / INSERT / UPDATE / DELETE) — Nutzer sieht und schreibt nur eigene Einträge
- Index `idx_auszahlungs_einstellungen_plattform_user` auf `(sales_plattform_id, user_id)` für performante GET-Abfragen

### API-Route
- `GET /api/auszahlungs-einstellungen?plattform_id=<UUID>`: `maybeSingle()` — gibt `null` zurück wenn kein Eintrag (unterscheidet sich von anderen Einstellungsseiten, die Arrays zurückgeben)
- `PUT /api/auszahlungs-einstellungen`: Upsert via `onConflict: 'sales_plattform_id,user_id'`; `superRefine` in Zod prüft KW+Jahr beide gesetzt oder beide null

### Tests
- `src/app/api/auszahlungs-einstellungen/route.test.ts` — 19 Tests (Vitest): 6 für GET, 13 für PUT
- Alle 19 Tests bestehen ✅

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
