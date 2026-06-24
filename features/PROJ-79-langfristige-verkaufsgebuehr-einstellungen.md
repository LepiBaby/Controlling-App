# PROJ-79: Verkaufsgebühr-Einstellungen — Langfristige Planung

## Status: Approved
**Created:** 2026-06-20
**Last Updated:** 2026-06-20

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden.
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — diese Seite ist eine versionsgebundene Einstellungsseite unter `/dashboard/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen`; sie nutzt das Versions-Routing, den Versionskontext (`LangfristigeVersionShell`), den Redirect bei fremder Version und das kontextabhängige linke Seitenmenü. Der Nav-Eintrag „Verkaufsgebühr-Einstellungen" (Slug `verkaufsgebuehr-einstellungen`, Gruppe „Einstellungen") ist in `src/lib/langfristige-planung-nav.ts` **bereits vorhanden** und rendert derzeit den `[seite]`-Platzhalter; diese echte Seite löst den Platzhalter ab.
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert je Planversion die **Sales Plattformen** (`langfristige_kpi_kategorien` mit `art = 'lp_sales_plattform'`) als Reiter und die **Produkte** (`art = 'lp_produkt'`, flache Liste, `level = 1`) als Tabellenzeilen.
- Vorlage (kein harter Require): die kurzfristige **Verkaufsgebühr-Einstellungen**-Seite (PROJ-43, `src/app/dashboard/kurzfristige-planung/verkaufsgebuehr-einstellungen/page.tsx`). UI, Bedienung und Datenfluss werden **1:1 gespiegelt**; einzige Abweichung ist die versionsgebundene Datenquelle.

## Übersicht

Die Seite „Verkaufsgebühr-Einstellungen" der **Langfristigen Planung** ist der versionsgebundene Gegenpart zur kurzfristigen Verkaufsgebühr-Einstellungen-Seite (PROJ-43). Der Nutzer pflegt für jede Kombination aus **Sales-Plattform** und **Produkt** die plattformspezifische Verkaufsgebühr als prozentualen Wert.

Die Seite ist **1:1 wie PROJ-43 aufgebaut** — gleiche Reiter-Struktur (Sales-Plattformen oben als Tabs), gleiche Tabelle (Produkte als Zeilen), genau **ein** editierbares Feld „Verkaufsgebühr (%)" pro Plattform/Produkt, gleiches Auto-Save-Verhalten (onBlur, optimistisches Update, Rollback bei Fehler). **Keine** Gruppierung, **kein** Zahlungsziel — exakt wie kurzfristig.

Die **einzige** bewusste Abweichung: Plattformen und Produkte stammen ausschließlich aus dem **KPI-Modell dieser Planversion** (PROJ-74), nicht aus dem globalen KPI-Modell. Alle Eingaben werden **pro Planversion** gespeichert — jede Planversion hat eigene, anfangs leere Daten (Datenisolation gemäß PROJ-73), ohne Verbindung zum globalen KPI-Modell oder zur Kurzfristigen Planung.

## User Stories

- Als Controller möchte ich die Seite „Verkaufsgebühr-Einstellungen" innerhalb einer geöffneten Planversion über das linke Seitenmenü und über die Versions-Übersichtsseite aufrufen können, damit ich die Verkaufsgebühren dieser Version pflegen kann.
- Als Controller möchte ich oben alle Sales-Plattformen sehen, die im KPI-Modell **dieser Planversion** hinterlegt sind, als Reiter, damit ich die Gebühren plattformspezifisch pflegen kann.
- Als Controller möchte ich je Reiter alle Produkte sehen, die im KPI-Modell **dieser Planversion** hinterlegt sind, als Zeilen einer Tabelle.
- Als Controller möchte ich für jedes Produkt und jede Sales-Plattform einen prozentualen Gebührenwert eingeben können, damit die plattformspezifischen Verkaufsgebühren korrekt abgebildet werden.
- Als Controller möchte ich, dass alle Eingaben **pro Planversion** gespeichert werden und beim nächsten Aufruf dieser Version vorhanden sind, ohne andere Versionen oder die Kurzfristige Planung zu beeinflussen.
- Als Controller möchte ich beim Speichern eine klare Rückmeldung erhalten, wenn etwas fehlschlägt, damit ich den Fehler erkenne und der vorherige Wert erhalten bleibt.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Innerhalb einer geöffneten Planversion enthält das linke Seitenmenü (Gruppe „Einstellungen") den bereits vorhandenen Eintrag „Verkaufsgebühr-Einstellungen" → `/dashboard/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen`
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint der Eintrag/die Kachel „Verkaufsgebühr-Einstellungen" (wird automatisch aus `VERSIONS_NAV_GRUPPEN` erzeugt) und verlinkt auf die Seite
- [ ] Die echte Seite löst den bisherigen `[seite]`-Platzhalter (Construction-Stub) für diesen Slug ab
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Wird die Seite mit unbekannter/fremder/ungültiger `versionId` aufgerufen, erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73-Versionskontext
- [ ] Die Seite ist in das bestehende Versions-Gerüst (`LangfristigeVersionShell`: Header, Breadcrumb, Seitenmenü, Toaster) eingebettet

### Reiter (Sales-Plattformen der Version)

- [ ] Oben auf der Seite werden alle Einträge aus `langfristige_kpi_kategorien` mit `art = 'lp_sales_plattform'` der aktuellen `versionId` als Tabs dargestellt (sortiert nach `sort_order`)
- [ ] Beim ersten Laden ist der erste Reiter automatisch aktiv
- [ ] Gibt es **keine** Sales-Plattformen in der Version, erscheint ein Hinweis mit Link zur KPI-Modell-Verwaltung **dieser Version**: „Noch keine Sales-Plattformen gepflegt. Bitte zuerst in der KPI-Modell Verwaltung Sales-Plattformen anlegen."

### Tabelle (Produkte der Version pro Plattform)

- [ ] Unterhalb der Reiter wird eine Tabelle mit einer Zeile pro Produkt angezeigt (`langfristige_kpi_kategorien` mit `art = 'lp_produkt'`, `level = 1`, sortiert nach `sort_order`)
- [ ] Tabellenspalten:
  - **Produkt** (Name des Produkts — read-only)
  - **Verkaufsgebühr (%)** (Zahlenfeld, editierbar)
- [ ] Gibt es **keine** Produkte in der Version, erscheint ein Hinweis mit Link zur KPI-Modell-Verwaltung dieser Version: „Noch keine Produkte gepflegt. Bitte zuerst in der KPI-Modell Verwaltung Produkte anlegen."

### Verkaufsgebühr-Feld (identisch zu PROJ-43)

- [ ] Das Feld akzeptiert Dezimalzahlen ≥ 0 (z. B. `19.5`)
- [ ] Es gibt keine implizite Obergrenze — Werte über 100 % sind erlaubt (manche Plattformgebühren können addiert > 100 sein)
- [ ] Standardwert bei noch nie gespeicherten Kombinationen: leer (kein Wert angezeigt)
- [ ] Änderungen werden automatisch gespeichert (Auto-Save per `onBlur` — kein separater „Speichern"-Button)
- [ ] Optimistische Updates: Wert erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden.", Rollback auf vorherigen Wert
- [ ] **Keine** zusätzlichen Felder (keine Gruppierung, kein Zahlungsziel) — exakt wie PROJ-43

### Datenpersistenz & Isolation

- [ ] Jede Kombination aus `(plan_version_id, sales_plattform_id, produkt_id, user_id)` wird als separater Datensatz gespeichert
- [ ] Geladen/gespeichert wird ausschließlich für die aktuelle `versionId`
- [ ] Beim Wechsel des Reiters werden die Einstellungen des neuen Reiters aus der DB geladen
- [ ] Beim ersten Aufruf einer Plattform-Produkt-Kombination existiert noch kein DB-Eintrag — das Feld ist leer; kein DB-Insert, bis der Nutzer etwas ändert
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B, andere Versionen oder die Kurzfristige Planung
- [ ] Wird die Planversion (PROJ-73) gelöscht, werden alle zugehörigen Verkaufsgebühr-Einstellungen kaskadierend mitgelöscht — keine verwaisten Datensätze
- [ ] Wird ein Produkt oder eine Sales-Plattform im KPI-Modell der Version gelöscht, werden die zugehörigen Einstellungsdaten kaskadierend mitgelöscht; die entsprechende Zeile/der Reiter verschwindet beim nächsten Aufruf

### Datenbankschema (Richtwert — Feinschliff in /architecture)

Gespiegelt aus der kurzfristigen Tabelle `verkaufsgebuehr_einstellungen` (PROJ-43), erweitert um `plan_version_id`:

- [ ] Neue Tabelle `langfristige_verkaufsgebuehr_einstellungen`:
  - `id` UUID PK
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `sales_plattform_id` UUID NOT NULL FK → `langfristige_kpi_kategorien` (ON DELETE CASCADE)
  - `produkt_id` UUID NOT NULL FK → `langfristige_kpi_kategorien` (ON DELETE CASCADE)
  - `verkaufsgebuehr_prozent` NUMERIC(6,2) — NULL wenn noch nicht gepflegt
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `created_at` / `updated_at`
  - UNIQUE(`plan_version_id`, `sales_plattform_id`, `produkt_id`, `user_id`) — ein Eintrag pro Kombination pro Version pro Nutzer
  - Index auf (`plan_version_id`, `sales_plattform_id`, `user_id`) für performante GET-Abfragen
  - RLS (`auth.uid() = user_id`): Nutzer sieht und schreibt nur eigene Einträge

### API-Routen (versions- & nutzergebunden)

- [ ] `GET /api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen?plattform_id=<UUID>` — alle Einstellungen des Nutzers für eine Plattform in dieser Version
- [ ] `PUT /api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen` — Eintrag anlegen oder aktualisieren (Upsert)
  - Body: `{ sales_plattform_id, produkt_id, verkaufsgebuehr_prozent }`
  - Zod-Validierung: `verkaufsgebuehr_prozent` muss eine Zahl ≥ 0 sein (oder `null` zum Löschen)
- [ ] Jede Route: `requireAuth()` (401); UUID-Format-Prüfung (400); Versionsprüfung (Version gehört dem Nutzer, sonst 404); Filterung zusätzlich nach `user_id` + `plan_version_id` (Defense-in-Depth zur RLS)
- [ ] Serverseitige Prüfung: referenzierte `produkt_id` (`art = 'lp_produkt'`) und `sales_plattform_id` (`art = 'lp_sales_plattform'`) gehören zur selben Version und haben die korrekte `art`
- [ ] Response 400 bei ungültigen Werten

## Edge Cases

- **Keine Sales-Plattformen in der Version:** Seite zeigt Hinweis mit Link zur KPI-Modell-Verwaltung dieser Version, keine Tabelle.
- **Keine Produkte in der Version:** Tabelle zeigt Hinweis mit Link zur KPI-Modell-Verwaltung dieser Version, keine Zeilen.
- **Nutzer löscht Wert aus Feld und verlässt es (`onBlur`):** Upsert mit `verkaufsgebuehr_prozent = null` — Feld wird wieder leer dargestellt.
- **Plattform aus KPI-Modell der Version gelöscht:** `ON DELETE CASCADE` entfernt alle zugehörigen Einträge; Reiter verschwindet beim nächsten Seitenaufruf.
- **Produkt aus KPI-Modell der Version gelöscht:** `ON DELETE CASCADE` entfernt alle zugehörigen Einträge; Zeile verschwindet beim nächsten Seitenaufruf.
- **Neue Plattform / neues Produkt in der Version hinzugefügt:** erscheint beim nächsten Seitenaufruf mit leerem Feld.
- **Referenz eines Produkts/einer Plattform einer fremden Version:** serverseitig abgelehnt (gehört nicht zur Version/Art) → 400/404, kein Fremdbezug.
- **API-Fehler beim Auto-Save:** Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden.", optimistisches Update wird zurückgerollt.
- **Aufruf mit fremder/unbekannter versionId:** Redirect zum Langfristige-Planung-Dashboard, kein Datenzugriff.
- **Planversion gelöscht:** alle zugehörigen Verkaufsgebühr-Einstellungen werden kaskadierend mitgelöscht.
- **Sehr viele Produkte (>20):** Tabelle ist scrollbar, keine Paginierung nötig.
- **Sehr viele Plattformen (>5):** Reiter-Leiste wird scrollbar (overflow-x: auto).
- **Parallele Bearbeitung in mehreren Tabs/Versionen:** funktioniert unabhängig, da der Kontext aus der URL (`versionId`) stammt.

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen.
- RLS auf der neuen Tabelle `langfristige_verkaufsgebuehr_einstellungen`; Versionszugehörigkeit (`plan_version_id` gehört dem Nutzer) sowie Art-/Versionszugehörigkeit referenzierter Kategorien serverseitig prüfen (Defense-in-Depth zur RLS).
- Alle Eingaben serverseitig mit Zod validieren (`verkaufsgebuehr_prozent`, Produkt-/Plattform-IDs).
- Neue versionsgebundene Next.js-Seite unter `src/app/dashboard/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen/page.tsx` (nutzt `LangfristigeVersionShell`; löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab).
- Navigation: Nav-Eintrag „Verkaufsgebühr-Einstellungen" (Slug `verkaufsgebuehr-einstellungen`, Gruppe „Einstellungen") in `src/lib/langfristige-planung-nav.ts` ist **bereits vorhanden** — kein neuer Nav-Eintrag nötig; verlinkt automatisch auch auf der Versions-Übersichtsseite.
- Maximale Wiederverwendung der kurzfristigen UI-/Hook-Bausteine aus PROJ-43 (Tabs, Table, `Input type="number"`, Auto-Save onBlur, optimistisches Update, Rollback, Toast) als Vorlage; Datenquelle versionsgebunden parametrisiert.
- shadcn-Komponenten: `Tabs` (Plattform-Reiter), `Table` (Produktzeilen), `Input type="number"` (Verkaufsgebühr %, min=0, step=0.01), `Toast` (Rückmeldungen).
- Responsive: Mobil (375px) bis Desktop (1440px).
- Kein neues npm-Paket nötig (alle Bausteine bereits im Projekt vorhanden).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee

Diese Seite ist ein **versionsgebundener Klon** der bereits gebauten kurzfristigen Verkaufsgebühr-Einstellungen-Seite. Wir spiegeln deren bewährtes Muster (Plattform-Reiter → Produkt-Tabelle → ein Prozentfeld + „Alle gleichsetzen") 1:1 und tauschen ausschließlich die **Datenquelle** aus: statt des globalen KPI-Modells kommen Plattformen und Produkte aus dem KPI-Modell **dieser Planversion**, und alle Werte werden **pro Planversion** gespeichert. Technisch lehnen wir uns dabei an die bereits existierende langfristige **Auszahlungseinstellungen**-Seite (PROJ-76) an, die exakt dieses Versions-Muster bereits umsetzt.

> **Hinweis zur Spec-Erweiterung:** Die reale kurzfristige Seite enthält zusätzlich zur reinen Prozentspalte eine Funktion **„Alle Produkte gleichsetzen"** (ein Wert für alle Produkte der Plattform auf einmal). Weil die Vorgabe „1:1 wie die kurzfristige Seite" lautet, wird diese Funktion hier mit übernommen (in der Spec oben war nur das Einzelfeld beschrieben).

### Komponentenstruktur (visueller Baum)

```
/dashboard/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen  (NEUE echte Seite)
  → ersetzt den bisherigen [seite]-Platzhalter (Construction-Stub) für diesen Slug
+-- LangfristigeVersionShell  (bestehendes Gerüst: Header, Breadcrumb, linkes Seitenmenü, Toaster, Auth/Versions-Guard)
    +-- LangfristigeVerkaufsgebuehrEinstellungenTabelle  (NEUE Hauptkomponente)
        +-- liest versionId aus der URL
        +-- lädt Sales-Plattformen + Produkte aus dem KPI-Modell DIESER Version
        +-- Leerzustand A: keine Plattformen → Hinweis + Link zur KPI-Modell-Verwaltung dieser Version
        +-- Tabs  [shadcn — ein Reiter je Sales-Plattform der Version]
        |   +-- Reiter: "Plattform A"
        |   +-- Reiter: "Plattform B"
        |   +-- ...
        +-- (je aktivem Reiter) LangfristigePlattformTabelle  (NEUE Teilkomponente)
            +-- Leerzustand B: keine Produkte → Hinweis + Link zur KPI-Modell-Verwaltung dieser Version
            +-- "Alle Produkte gleichsetzen"-Bereich  (ein Wert für alle Produkte, Button "Übernehmen")
            +-- Table  [shadcn]
                +-- Kopf: Produkt | Verkaufsgebühr (%)
                +-- je Produkt eine Zeile: Produktname (read-only) + Prozent-Eingabe (Auto-Save onBlur)
```

### Datenmodell (in einfacher Sprache)

**Neue Tabelle `langfristige_verkaufsgebuehr_einstellungen`** — speichert je Planversion und Nutzer einen Gebührenwert pro Plattform-Produkt-Kombination:

| Information | Bedeutung |
|---|---|
| ID | Eindeutige Kennung des Eintrags |
| Planversion | Zu welcher Planversion der Eintrag gehört (wird mitgelöscht, wenn die Version gelöscht wird) |
| Sales-Plattform | Verweis auf eine Plattform aus dem KPI-Modell dieser Version (wird mitgelöscht, wenn die Plattform gelöscht wird) |
| Produkt | Verweis auf ein Produkt aus dem KPI-Modell dieser Version (wird mitgelöscht, wenn das Produkt gelöscht wird) |
| Verkaufsgebühr (%) | Prozentualer Wert (z. B. 15,00); leer/„nicht gepflegt" möglich |
| Nutzer | Dateneigentümer — jeder Nutzer sieht nur eigene Einträge |
| Erstellt / Geändert | Zeitstempel |

**Eindeutigkeit:** je Kombination aus Planversion + Plattform + Produkt + Nutzer genau ein Eintrag.
**Schutz:** Row Level Security (jeder Nutzer nur eigene Daten) + zusätzlicher Such-Index für schnelles Laden je Plattform.
**Speicherort:** Supabase/PostgreSQL (kein localStorage — Daten müssen versionsgebunden und geräteübergreifend erhalten bleiben).

### Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Shell prüft Login + ob die Version dem Nutzer gehört (sonst Redirect)
  → Hook lädt Sales-Plattformen der Version (art = lp_sales_plattform)
  → Hook lädt Produkte der Version (art = lp_produkt, Ebene 1)
  → Erster Plattform-Reiter wird automatisch aktiv
  → Hook lädt die gespeicherten Gebühren für die aktive Plattform (nur diese Version)

Nutzer wechselt Reiter
  → Gebühren der neuen Plattform werden geladen

Nutzer ändert ein Gebühren-Feld und verlässt es (onBlur)
  → Wert erscheint sofort (optimistisch) → im Hintergrund gespeichert
  → bei Fehler: Rückrollen auf alten Wert + Fehler-Toast

Nutzer nutzt "Alle Produkte gleichsetzen"
  → ein Wert wird für alle Produkte der aktiven Plattform gesetzt (optimistisch, im Hintergrund gespeichert)

Nutzer leert ein Feld und verlässt es
  → Wert wird als „nicht gepflegt" (leer) gespeichert
```

### Schnittstellen (API)

Versions- und nutzergebunden, gespiegelt aus der kurzfristigen Route, jedoch unter dem Versionspfad und mit Versions-/Art-Prüfung (wie bei der langfristigen Auszahlungseinstellungen-Route):

- **Laden** der Gebühren einer Plattform für die aktuelle Version → liefert die Liste der gepflegten Produkt-Werte.
- **Speichern** eines einzelnen Produkt-Werts (Anlegen oder Aktualisieren), inkl. „leeren" (= nicht gepflegt).
- **Alle gleichsetzen**: setzt denselben Wert für alle Produkte der Plattform in dieser Version.

Jeder Aufruf prüft: angemeldet? gehört die Version dem Nutzer? sind die referenzierten Plattform/Produkt-Einträge tatsächlich Teil **dieser** Version und von der korrekten Art? Werte werden serverseitig validiert (Zahl ≥ 0 oder leer). Fehler führen zu klaren Statuscodes (401/400/404/500).

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen/page.tsx` | Dünne Seite: rendert die Hauptkomponente in der Versions-Shell |
| `src/components/langfristige-verkaufsgebuehr-einstellungen-tabelle.tsx` | Hauptkomponente: Reiter, Tabelle, „Alle gleichsetzen", Auto-Save-Logik |
| `src/hooks/use-langfristige-verkaufsgebuehr-einstellungen.ts` | Lade-/Speicher-Logik je Version & Plattform (optimistisches Update, Rollback, Batch) |
| `src/app/api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen/route.ts` | Laden + Speichern eines Werts (versions- & nutzergebunden, Zod, requireAuth) |
| `src/app/api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen/batch/route.ts` | „Alle Produkte gleichsetzen" für eine Plattform der Version |
| Datenbank-Migration | Neue Tabelle `langfristige_verkaufsgebuehr_einstellungen` inkl. RLS, Index, Fremdschlüssel mit Kaskadenlöschung |

### Wiederverwendete bestehende Bausteine (keine Änderung nötig)

| Baustein | Rolle |
|---|---|
| `LangfristigeVersionShell` | Seitengerüst inkl. Login-/Versions-Guard und Redirect bei fremder Version |
| `useLangfristigeKpiKategorien(versionId, art)` | Lädt Plattformen bzw. Produkte der Version |
| `src/lib/langfristige-planung-nav.ts` | Nav-Eintrag „Verkaufsgebühr-Einstellungen" ist **bereits vorhanden** → keine Nav-Änderung; Versions-Übersichtskachel entsteht automatisch |
| shadcn `Tabs`, `Table`, `Input`, `Button`, `Label`, Toast | UI-Primitive (bereits installiert) |

### Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Muster | Klon der kurzfristigen Seite, Versions-Variante analog PROJ-76 | Bewährtes, getestetes Muster — minimiert Risiko und Aufwand |
| Datenquelle | KPI-Modell der Version (`langfristige_kpi_kategorien`) | Anforderung: nur Plattformen/Produkte dieser Planversion |
| Speicherung | Eigene `langfristige_*`-Tabelle mit `plan_version_id` | Strikte Datenisolation je Version (PROJ-73) — keine Vermischung mit Kurzfristplanung |
| „Alle gleichsetzen" | Übernommen aus der realen kurzfristigen Seite | Vorgabe „1:1 wie kurzfristig"; spart Nutzern Tipparbeit |
| Speichern | Auto-Save (onBlur) statt Submit-Button | Einheitlich mit allen anderen Einstellungsseiten |
| Sicherheit | RLS + serverseitige Versions-/Art-Prüfung (Defense-in-Depth) | Verhindert Fremdzugriff und Querbezüge zwischen Versionen |
| Neue Packages | Keine | Alle UI-Bausteine und Hooks bereits im Projekt vorhanden |

### Dependencies (zu installierende Pakete)

Keine. Alle benötigten Bausteine (shadcn-Komponenten, Versions-Shell, KPI-Hook, Toast) sind bereits im Projekt vorhanden.

## Implementation Notes (Frontend — 2026-06-20)

### Neue Dateien
- `src/hooks/use-langfristige-verkaufsgebuehr-einstellungen.ts` — Typ `LangfristigeVerkaufsgebuehrEinstellung`, Hook `useLangfristigeVerkaufsgebuehrEinstellungen(versionId, plattformId)` mit Laden je Plattform, optimistischem `upsert` (Rollback bei Fehler) und `batchUpsert` („Alle gleichsetzen"). Gegen die versionsgebundene API `/api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen` (+ `/batch`).
- `src/components/langfristige-verkaufsgebuehr-einstellungen-tabelle.tsx` — Hauptkomponente `LangfristigeVerkaufsgebuehrEinstellungenTabelle`: liest `versionId` via `useParams`, lädt Plattformen (`lp_sales_plattform`) und Produkte (`lp_produkt`, Ebene 1) über `useLangfristigeKpiKategorien`, rendert Plattform-Tabs; je Tab `PlattformTabelle` (eigener Hook-Aufruf), `AlleGleichsetzenBereich` und `VerkaufsgebuehrEinstellungZeile` (lokaler State, Auto-Save onBlur). Leerzustände verlinken auf die KPI-Modell-Verwaltung **dieser Version**.
- `src/app/dashboard/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen/page.tsx` — dünne Client-Seite, rendert die Hauptkomponente in `LangfristigeVersionShell` (Titel „Verkaufsgebühr-Einstellungen"). Löst den `[seite]`-Platzhalter für diesen Slug ab.

### Geänderte Dateien
- Keine. Der Nav-Eintrag „Verkaufsgebühr-Einstellungen" war bereits in `src/lib/langfristige-planung-nav.ts` vorhanden; die Versions-Übersichtskachel entsteht automatisch daraus.

### Abweichung gegenüber Spec-Text
- „Alle Produkte gleichsetzen" (Bulk) wurde mit übernommen, da die reale kurzfristige Seite diese Funktion enthält („1:1 wie kurzfristig"). Sie nutzt den noch zu bauenden `/batch`-Endpunkt.

### Build
- `npm run build` ✅ — neue Route `/dashboard/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen` erscheint in der Route-Liste, Kompilierung fehlerfrei.

### Offen (Backend)
- API-Routen `route.ts` (GET + PUT) und `batch/route.ts` (PUT) unter `src/app/api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen/` sowie die Tabelle `langfristige_verkaufsgebuehr_einstellungen` (Migration, RLS) werden in `/backend` erstellt.

## Implementation Notes (Backend — 2026-06-20)

### Datenbankmigration
- Migration `proj79_langfristige_verkaufsgebuehr_einstellungen` auf Supabase-Projekt `kdmpghtdoguppfqhdscq` angewendet.
- Tabelle `langfristige_verkaufsgebuehr_einstellungen`: UUID-PK, FKs `user_id` → `auth.users`, `plan_version_id` → `langfristige_planversionen`, `sales_plattform_id`/`produkt_id` → `langfristige_kpi_kategorien` (alle ON DELETE CASCADE), `verkaufsgebuehr_prozent` NUMERIC(6,2) nullable, `created_at`/`updated_at`.
- UNIQUE `uq_lvge_version_plattform_produkt_user (plan_version_id, sales_plattform_id, produkt_id, user_id)`.
- RLS aktiviert mit 4 Policies (`lvge_select_own`/`insert_own`/`update_own`/`delete_own`, jeweils `auth.uid() = user_id`).
- Index `idx_lvge_version_plattform_user (plan_version_id, sales_plattform_id, user_id)` für performante GET-Abfragen.
- Security-Advisor nach DDL: keine Findings für die neue Tabelle (vorhandene Warnungen betreffen andere, ältere Tabellen).

### API-Routen
- `GET /api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen?plattform_id=<UUID>` — alle gepflegten Produkt-Werte einer Plattform in dieser Version; `requireAuth()`, Versions-Eigentumsprüfung (`ensureVersion`), UUID-Regex, Filter nach `user_id` + `plan_version_id`, `.limit(1000)`.
- `PUT /api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen` — Upsert eines Plattform-Produkt-Werts via `onConflict: 'plan_version_id,sales_plattform_id,produkt_id,user_id'`; Zod (`verkaufsgebuehr_prozent` Zahl ≥ 0 oder null); serverseitige Prüfung, dass Plattform (`lp_sales_plattform`) und Produkt (`lp_produkt`) zur Version gehören → sonst 400.
- `PUT /api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen/batch` — „Alle Produkte gleichsetzen": setzt einen Wert für alle Produkte (`lp_produkt`, Ebene 1) der Version; gleiche Auth-/Versions-/Art-Prüfungen.

### Tests
- `…/verkaufsgebuehr-einstellungen/route.test.ts` — 21 Tests (GET + PUT)
- `…/verkaufsgebuehr-einstellungen/batch/route.test.ts` — 9 Tests
- Alle 30 Tests bestehen ✅ (Vitest). Build `npm run build` ✅, beide Routen registriert.

## QA Test Results (2026-06-20)

### Zusammenfassung
- **Acceptance Criteria:** alle relevanten bestanden ✅
- **Edge Cases:** geprüft ✅
- **Bugs gefunden:** 0 Critical / 0 High / 0 Medium / 1 Low (vererbt, kein Regress)
- **Security-Audit:** keine Findings
- **Production-ready:** JA

### Automatisierte Tests

| Suite | Tests | Ergebnis |
|---|---|---|
| Vitest API `route.test.ts` (GET + PUT) | 21 | ✅ alle bestanden |
| Vitest API `batch/route.test.ts` (PUT) | 9 | ✅ alle bestanden |
| Playwright E2E `PROJ-79-…spec.ts` (Chromium + Mobile Safari) | 8 | ✅ alle bestanden |

### Acceptance Criteria — Prüfprotokoll

**Navigation & Einstieg**
- [x] Nav-Eintrag „Verkaufsgebühr-Einstellungen" (Gruppe „Einstellungen") vorhanden → versionsgebundener Pfad ✅ (`langfristige-planung-nav.ts`)
- [x] Versions-Übersichtskachel entsteht automatisch aus `VERSIONS_NAV_GRUPPEN` ✅
- [x] Echte Seite löst `[seite]`-Platzhalter ab (statisches Segment schlägt dynamisches) ✅ (Build-Routenliste)
- [x] Auth-Guard → Redirect zu `/login` ✅ (E2E)
- [x] Fremde/unbekannte/ungültige `versionId` → Redirect zum Dashboard ✅ (`LangfristigeVersionShell` + planversionen-API 404)
- [x] Einbettung in `LangfristigeVersionShell` (Header/Breadcrumb/Nav/Toaster) ✅

**Reiter (Sales-Plattformen der Version)**
- [x] Tabs aus `langfristige_kpi_kategorien` `art='lp_sales_plattform'` der Version, nach `sort_order` ✅
- [x] Erster Reiter automatisch aktiv ✅
- [x] Leerzustand bei keinen Plattformen → Hinweis + Link zur KPI-Modell-Verwaltung dieser Version ✅

**Tabelle (Produkte der Version)**
- [x] Zeile pro Produkt (`art='lp_produkt'`, `level=1`), nach `sort_order` ✅
- [x] Spalten: Produkt (read-only) + Verkaufsgebühr (%) ✅
- [x] Leerzustand bei keinen Produkten → Hinweis + Link zur KPI-Modell-Verwaltung dieser Version ✅

**Verkaufsgebühr-Feld**
- [x] Dezimalzahlen ≥ 0 ✅ (API-Test)
- [x] Keine Obergrenze — Werte > 100 erlaubt ✅ (API-Test: 120)
- [x] Standard bei ungepflegt: leer ✅
- [x] Auto-Save per onBlur ✅; optimistisch + Rollback bei Fehler ✅ (Code-Review)
- [x] „Alle Produkte gleichsetzen" (1:1 wie kurzfristig) ✅ (API-Test batch)

**Datenpersistenz & Isolation**
- [x] Separater Datensatz je `(plan_version_id, sales_plattform_id, produkt_id, user_id)` ✅ (UNIQUE verifiziert)
- [x] Laden/Speichern nur für aktuelle `versionId` ✅ (Filter + ensureVersion)
- [x] Version A ↛ Version B / Kurzfristige Planung (eigene Tabelle, eigener `plan_version_id`) ✅
- [x] Cascade bei Löschung von Version/Plattform/Produkt ✅ (4 ON DELETE CASCADE FKs verifiziert)

**API**
- [x] GET/PUT + batch unter `/api/langfristige-planung/[versionId]/verkaufsgebuehr-einstellungen` ✅
- [x] requireAuth (401), UUID-Prüfung (400), Versions-Eigentum (404), Art-/Versionsprüfung referenzierter IDs (400) ✅
- [x] Zod: Wert ≥ 0 oder null; negativ → 400; DB-Fehler → 500 ✅

### Edge Cases — Prüfprotokoll
- [x] Keine Plattformen / keine Produkte → Hinweis-Zustände ✅
- [x] Feld leeren + onBlur → null gespeichert, Feld bleibt leer ✅ (API akzeptiert null)
- [x] Plattform/Produkt der Version gelöscht → Cascade entfernt Einträge ✅
- [x] Referenz fremder/anderer Version → 400 (Art-/Versionsprüfung) ✅
- [x] Fremde versionId → Redirect, kein Datenzugriff ✅
- [x] API-Fehler beim Auto-Save → Toast + Rollback ✅ (Code-Review)

### Security-Audit (Red Team)
- **Auth-Bypass:** 401 für unauthentifizierte Requests ✅
- **IDOR (fremde Version):** `ensureVersion` filtert nach `user_id` → 404; zusätzlich RLS (`auth.uid() = user_id`) ✅
- **Querbezug fremder Plattform/Produkt:** serverseitige Art-/Versionsprüfung → 400 ✅
- **Input-Validierung:** Zod serverseitig; parametrisierte Supabase-Queries ✅
- **Supabase Security-Advisor:** keine Findings für die neue Tabelle ✅

### Bugs

| # | Severity | Beschreibung |
|---|---|---|
| 1 | Low | `verkaufsgebuehr_prozent` ist `NUMERIC(6,2)` → Werte ≥ 10000 % würden einen DB-Fehler (500) auslösen. Identisch zur kurzfristigen Tabelle (PROJ-43), praktisch irrelevant für Gebührenwerte; kein Regress. |

### Regressionstest
- [x] Kurzfristige Verkaufsgebühr-Einstellungen weiterhin erreichbar ✅ (E2E)
- [x] Langfristige-Planung-Dashboard Auth-Guard weiterhin aktiv ✅ (E2E)
- [x] Rein additive Änderung (neue Dateien + neue Tabelle, keine bestehenden Dateien geändert) → minimales Regressionsrisiko ✅

### Production-Ready: **JA** (keine Critical/High/Medium Bugs)

## Deployment
_To be added by /deploy_
