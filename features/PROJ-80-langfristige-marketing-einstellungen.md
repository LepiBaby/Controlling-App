# PROJ-80: Marketing-Einstellungen — Langfristige Planung

## Status: Approved
**Created:** 2026-06-20
**Last Updated:** 2026-06-20 (QA bestanden — Production-Ready)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — diese Seite ist eine versionsgebundene Einstellungsseite unter `/dashboard/langfristige-planung/[versionId]/…`; sie nutzt das Versions-Routing, den Versionskontext (`LangfristigeVersionShell`), den Redirect bei fremder/unbekannter Version und das kontextabhängige Seitenmenü. Der Nav-Eintrag „Marketing-Einstellungen" (Slug `marketing-einstellungen`, Gruppe „Einstellungen") existiert bereits in `src/lib/langfristige-planung-nav.ts` und löst diese echte Seite ab.
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert je Planversion die **Marketingkanäle** (`art = 'lp_marketingkanal'`, flache Liste) als Reiter und die **Sales Plattformen** (`art = 'lp_sales_plattform'`) als Dropdown-Optionen aus `langfristige_kpi_kategorien`.
- Vorlage (kein harter Require): PROJ-49 (Marketing-Einstellungen — Kurzfristige Planung) — UI und Bedienung des oberen „Kanal-Einstellungs"-Formulars (Sales Plattform, Gruppierung, Zahlungsziel) werden gespiegelt, **ohne** die kurzfristige Produkt-Tabelle (Berechnungsart pro Produkt) und **ohne** die „Nächste Zahlungswoche"-Anzeige.

## Übersicht

Die Seite „Marketing-Einstellungen" der **Langfristigen Planung** ist der versionsgebundene Gegenpart zur kurzfristigen Marketing-Einstellungen-Seite (PROJ-49). Sie wird **pro Planversion** gespeichert — jede Planversion hat eigene, anfangs leere Daten (Datenisolation gemäß PROJ-73).

Oben werden die im **KPI-Modell dieser Planversion** gepflegten **Marketingkanäle** (`art = 'lp_marketingkanal'`) als **Reiter** dargestellt. Je Marketingkanal pflegt der Nutzer ein kompaktes Einstellungsformular mit genau drei Feldern:

1. **Sales Plattform** — Dropdown; auswählbar sind die im KPI-Modell **dieser** Planversion gepflegten Sales Plattformen (`art = 'lp_sales_plattform'`). Optional (kein Pflichtfeld); Standard „Keine".
2. **Gruppierung** — Dropdown mit nur zwei Optionen: **Monatlich** oder **Quartalsweise**.
3. **Zahlungsziel (Tage)** — Zahlenfeld (ganze Zahl ≥ 0), optional.

Wesentliche Unterschiede zur kurzfristigen Variante:

- **Keine Produkt-Tabelle / keine „Berechnungsart pro Produkt"** — die gesamte untere Tabelle der kurzfristigen Seite entfällt vollständig. Es bleibt nur das obere Kanal-Formular je Marketingkanal.
- **Gruppierung nur Monatlich / Quartalsweise** — die kurzfristige Option „Wöchentlich" entfällt (langfristige Planung denkt in Monaten/Quartalen).
- **Keine „Nächste Zahlungswoche" und kein Ankermonat** — entfällt vollständig. Die Zuordnung ergibt sich fest aus der Gruppierung: bei **Monatlich** wird immer am **Anfang des Folgemonats** gerechnet, bei **Quartalsweise** am **Anfang des Monats nach dem Quartal**. Es ist daher kein Datums-/KW-Picker und kein Anker nötig.
- **Versionsgebundene Datenhaltung** — Plattformen und Marketingkanäle stammen aus dem KPI-Modell der jeweiligen Planversion (PROJ-74), nicht aus dem globalen Modell.

## User Stories

- Als Controller möchte ich die Seite „Marketing-Einstellungen" innerhalb einer geöffneten Planversion über das linke Seitenmenü und die Versions-Übersichtsseite aufrufen können, damit ich die Marketing-Logik dieser Version pflegen kann.
- Als Controller möchte ich alle im KPI-Modell dieser Planversion gepflegten Marketingkanäle als Reiter oben sehen, damit ich die Einstellungen kanalspezifisch pflegen kann.
- Als Controller möchte ich je Marketingkanal eine Sales Plattform aus den im KPI-Modell dieser Version gepflegten Plattformen auswählen können, damit feststeht, welcher Plattform dieser Kanal zugeordnet ist.
- Als Controller möchte ich je Marketingkanal die Gruppierung (Monatlich oder Quartalsweise) festlegen, damit die zeitliche Zuordnung der Marketingausgaben korrekt abgebildet wird.
- Als Controller möchte ich je Marketingkanal ein Zahlungsziel in Tagen angeben können, damit der Zahlungsversatz später korrekt berücksichtigt wird.
- Als Controller möchte ich, dass meine Eingaben pro Planversion gespeichert werden und beim nächsten Aufruf dieser Version noch vorhanden sind, ohne andere Versionen oder die Kurzfristige Planung zu beeinflussen.
- Als Controller möchte ich eine klare Rückmeldung erhalten, wenn das Speichern fehlschlägt, damit ich den Fehler erkenne und der vorherige Wert erhalten bleibt.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Innerhalb einer geöffneten Planversion enthält das linke Seitenmenü (Gruppe „Einstellungen") den Eintrag „Marketing-Einstellungen" → `/dashboard/langfristige-planung/[versionId]/marketing-einstellungen`
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint ein Eintrag/eine Kachel „Marketing-Einstellungen", die auf die Seite verlinkt
- [ ] Der Beschreibungstext des Nav-Eintrags wird angepasst, sodass er das neue Verhalten beschreibt (z. B. „Sales Plattform, Gruppierung und Zahlungsziel je Marketingkanal pflegen") und nicht mehr die alte „Berechnungsmethode je Plattform & Produkt"-Beschreibung trägt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Wird die Seite mit unbekannter/fremder/ungültiger `versionId` aufgerufen, erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73-Versionskontext
- [ ] Die Seite ist in das bestehende Versions-Gerüst (`LangfristigeVersionShell`: Header, Breadcrumb, Seitenmenü, Toaster) eingebettet

### Reiter-Navigation (Marketingkanäle der Version)

- [ ] Oben auf der Seite werden alle Einträge aus `langfristige_kpi_kategorien` mit `art = 'lp_marketingkanal'` der aktuellen `versionId` als Tabs dargestellt (sortiert nach `sort_order`)
- [ ] Beim ersten Laden ist der erste Reiter automatisch aktiv
- [ ] Gibt es keine Marketingkanäle in der KPI-Modell-Verwaltung dieser Version, erscheint ein Hinweis: „Keine Marketingkanäle definiert. Bitte zuerst in der KPI-Modell Verwaltung Marketingkanäle anlegen." mit Link zur KPI-Modell-Verwaltung **dieser Version** (`/dashboard/langfristige-planung/[versionId]/kpi-modell-verwaltung`)

### Einstellungsformular pro Marketingkanal

Unterhalb der Reiter wird für den aktiven Marketingkanal ein kompaktes Formular mit genau drei Feldern angezeigt (es gibt **keine** Produkt-Tabelle und **keine** „Berechnungsart"-Auswahl):

#### Feld 1: Sales Plattform

- [ ] Beschriftung: „Sales Plattform"
- [ ] Eingabeelement: Dropdown (shadcn `Select`)
- [ ] Optionen: „Keine" (Standardwert) **plus** alle Einträge aus `langfristige_kpi_kategorien` mit `art = 'lp_sales_plattform'` der aktuellen `versionId` (sortiert nach `sort_order`)
- [ ] Kein Pflichtfeld — „Keine" ist ein gültiger Zustand und der Standard
- [ ] Gibt es keine Sales Plattformen im KPI-Modell dieser Version, bleibt nur „Keine" wählbar (das Feld bleibt bedienbar; optional Hinweis mit Link zur KPI-Modell-Verwaltung)
- [ ] Auto-Save bei `onChange`

#### Feld 2: Gruppierung

- [ ] Beschriftung: „Gruppierung"
- [ ] Eingabeelement: Dropdown (shadcn `Select`)
- [ ] Optionen in dieser Reihenfolge: **Monatlich**, **Quartalsweise** (keine Option „Wöchentlich")
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: **Monatlich**
- [ ] Optional darf unter dem Feld eine erläuternde Zeile stehen, die die feste Berechnungsregel zeigt (Monatlich → „Berechnung am Anfang des Folgemonats"; Quartalsweise → „Berechnung am Anfang des Monats nach dem Quartal")
- [ ] Auto-Save bei `onChange`

#### Feld 3: Zahlungsziel (Tage)

- [ ] Beschriftung: „Zahlungsziel (Tage)"
- [ ] Eingabeelement: Zahlenfeld (shadcn `Input type="number"`), `min=0`, `step=1`
- [ ] Wertebereich: ganze Zahl ≥ 0; leer = „nicht gesetzt" (`null`)
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: leer (`null`)
- [ ] Auto-Save bei `onBlur`

> **Bewusst NICHT enthalten:** die kurzfristige Produkt-Tabelle inkl. „Berechnungsart pro Produkt" und gewichteter Mittelwert; ein Datums-/Kalenderwochen-Picker; eine „Nächste Zahlungswoche"-Anzeige; ein Ankermonat.

### Datenpersistenz & Isolation

- [ ] Pro Marketingkanal und Planversion wird genau ein Einstellungsdatensatz gespeichert (Sales Plattform, Gruppierung, Zahlungsziel)
- [ ] Alle Daten sind zusätzlich an den Nutzer gebunden (`user_id`) und werden ausschließlich für die aktuelle `versionId` geladen/gespeichert
- [ ] Beim Wechsel des Marketingkanal-Reiters werden die Einstellungen des neuen Kanals geladen
- [ ] Beim ersten Aufruf eines Kanals ohne vorherige Speicherung zeigt das Formular die Standardwerte (Sales Plattform: Keine; Gruppierung: Monatlich; Zahlungsziel: leer) — kein DB-Insert, bis der Nutzer etwas ändert
- [ ] Optimistisches Update: Änderung erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden." + Rollback auf den vorherigen Wert
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B, andere Versionen oder die Kurzfristige Planung
- [ ] Wird die Planversion (PROJ-73) gelöscht, werden alle zugehörigen Marketing-Einstellungen kaskadierend mitgelöscht — keine verwaisten Datensätze
- [ ] Wird ein Marketingkanal im KPI-Modell der Version gelöscht, werden die zugehörigen Marketing-Einstellungen kaskadierend mitgelöscht; der entsprechende Reiter verschwindet beim nächsten Aufruf
- [ ] Wird die referenzierte Sales Plattform im KPI-Modell der Version gelöscht, wird die Plattform-Referenz des betroffenen Datensatzes geleert (`sales_plattform_id` → `NULL`); der Datensatz bleibt erhalten und zeigt wieder „Keine"

### Datenbankschema

- [ ] Neue Tabelle `langfristige_marketing_einstellungen`:
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `marketingkanal_id` UUID NOT NULL FK → `langfristige_kpi_kategorien` (ON DELETE CASCADE) — muss `art = 'lp_marketingkanal'` derselben Version sein
  - `sales_plattform_id` UUID NULL FK → `langfristige_kpi_kategorien` (ON DELETE SET NULL) — wenn gesetzt: `art = 'lp_sales_plattform'` derselben Version
  - `gruppierung` TEXT NOT NULL CHECK IN ('monatlich', 'quartalsweise') DEFAULT 'monatlich'
  - `zahlungsziel_tage` INTEGER NULL CHECK (`zahlungsziel_tage >= 0`)
  - `created_at`, `updated_at` TIMESTAMPTZ DEFAULT now()
  - UNIQUE(`plan_version_id`, `marketingkanal_id`, `user_id`) — ein Eintrag pro Marketingkanal pro Version pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigene Einträge (`auth.uid() = user_id`); Versionszugehörigkeit serverseitig zusätzlich geprüft
  - Index auf `(plan_version_id, marketingkanal_id, user_id)`

### API-Routen (versions- & nutzergebunden)

- [ ] `GET /api/langfristige-planung/[versionId]/marketing-einstellungen?marketingkanal_id=<UUID>` — lädt die Einstellung eines Marketingkanals der Version
  - Response: `{ marketingkanal_id, sales_plattform_id, gruppierung, zahlungsziel_tage }` oder `null` wenn noch kein Eintrag (Frontend zeigt Standardwerte)
- [ ] `PUT /api/langfristige-planung/[versionId]/marketing-einstellungen` — Upsert der Marketingkanal-Einstellung
  - Body: `{ marketingkanal_id, sales_plattform_id? (nullable), gruppierung?, zahlungsziel_tage? (nullable) }`
  - Zod-Validierung: `gruppierung ∈ { monatlich, quartalsweise }`; `zahlungsziel_tage` ganze Zahl ≥ 0 oder null; `sales_plattform_id` gültige UUID oder null; `marketingkanal_id` gültige UUID
  - Serverseitige Prüfung: `versionId` gehört dem Nutzer; `marketingkanal_id` gehört zur selben Version und hat `art = 'lp_marketingkanal'`; falls `sales_plattform_id` gesetzt, gehört sie zur selben Version und hat `art = 'lp_sales_plattform'`
- [ ] Beide Routen: `requireAuth()` (401), UUID-Format-Prüfung (400), Filterung der Queries zusätzlich nach `user_id` + `plan_version_id` (Defense-in-Depth zur RLS), Validierungsfehler → 400, fremde/unbekannte Version → 404

## Edge Cases

- **Keine Marketingkanäle in der Version:** Seite zeigt Hinweis mit Link zur KPI-Modell-Verwaltung dieser Version; keine Reiter, kein Formular
- **Keine Sales Plattformen in der Version:** Sales-Plattform-Dropdown zeigt nur „Keine"; übrige Felder bleiben bedienbar (optional Hinweis mit Link zur KPI-Modell-Verwaltung)
- **Nutzer wählt „Keine" Plattform:** gültiger Zustand; `sales_plattform_id = null` wird gespeichert
- **Zahlungsziel leer gelassen:** gültig; speichert `null`
- **Zahlungsziel negativ:** wird abgewiesen/auf 0 geklemmt (UI `min=0`; serverseitiger CHECK als zweite Ebene)
- **Marketingkanal im KPI-Modell der Version gelöscht:** zugehörige Einstellung wird per `ON DELETE CASCADE` entfernt; Reiter verschwindet beim nächsten Aufruf
- **Referenzierte Sales Plattform im KPI-Modell der Version gelöscht:** `sales_plattform_id` wird auf `NULL` gesetzt (`ON DELETE SET NULL`); Datensatz bleibt, Feld zeigt wieder „Keine"
- **Neuer Marketingkanal / neue Plattform hinzugefügt:** erscheint beim nächsten Aufruf (Marketingkanal als neuer Reiter mit Standardwerten; Plattform als neue Dropdown-Option) — kein Live-Update nötig
- **Auswahl einer Plattform/eines Kanals einer fremden Version:** serverseitig abgelehnt (gehört nicht zur Version/Art) → 400/404, kein Fremdbezug
- **API-Fehler beim Auto-Save:** Toast-Fehlermeldung, optimistisches Update wird zurückgerollt
- **Sehr viele Marketingkanäle (> 5):** Reiter-Leiste bleibt nutzbar (Umbruch/Scroll wie kurzfristige Version)
- **Aufruf mit fremder/unbekannter versionId:** Redirect zum Langfristige-Planung-Dashboard, kein Datenzugriff
- **Parallele Bearbeitung in mehreren Tabs/Versionen:** funktioniert unabhängig, da Kontext aus der URL (`versionId`) stammt

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen Tabelle `langfristige_marketing_einstellungen`; Versionszugehörigkeit (`plan_version_id` gehört dem Nutzer) und Art-/Versionszugehörigkeit referenzierter Kategorien serverseitig prüfen (Defense-in-Depth zur RLS)
- Alle Eingaben serverseitig mit Zod validieren (Gruppierung, Zahlungsziel, Plattform-ID, Marketingkanal-ID)
- Neue versionsgebundene Next.js-Seite unter `src/app/dashboard/langfristige-planung/[versionId]/marketing-einstellungen/page.tsx` (nutzt das Versions-Shell/Header-Muster aus PROJ-73; löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab)
- Navigation: Eintrag „Marketing-Einstellungen" existiert bereits in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen"); nur der Beschreibungstext wird angepasst
- Wiederverwendung der UI-/Hook-Bausteine der kurzfristigen Marketing-Einstellungen (Kanal-Formular: `Select`, `Input`, Auto-Save, optimistisches Update, Rollback, Toast) als Vorlage; Datenquelle versionsgebunden parametrisiert. **Ohne** die kurzfristige Produkt-Tabelle, **ohne** Datums-/KW-Picker, **ohne** „Nächste Zahlungswoche"
- shadcn-Komponenten: `Tabs` (Marketingkanal-Reiter), `Select` (Sales Plattform + Gruppierung), `Input type="number"` (Zahlungsziel), `Toast` (Rückmeldungen)
- Responsive: Mobil (375px) bis Desktop (1440px)
- Kein neues npm-Paket nötig (alle Bausteine bereits im Projekt vorhanden)

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/marketing-einstellungen/page.tsx` | Neue Seite (Versions-Shell + Formular), löst den `[seite]`-Platzhalter für diesen Slug ab |
| `src/components/langfristige-marketing-einstellungen-formular.tsx` | Hauptkomponente: Marketingkanal-Reiter (Tabs) + Kanal-Formular (Sales Plattform, Gruppierung, Zahlungsziel), Auto-Save-Logik |
| `src/hooks/use-langfristige-marketing-einstellungen.ts` | Versionsbewusster Hook: laden, upsert, optimistic update, rollback; Typen/Konstanten (`Gruppierung`, Defaults) |
| `src/app/api/langfristige-planung/[versionId]/marketing-einstellungen/route.ts` | GET + PUT (Upsert) mit Zod + `requireAuth()` + Versions-/Art-Prüfung |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Beschreibungstext des bestehenden Eintrags „Marketing-Einstellungen" anpassen (Sales Plattform, Gruppierung, Zahlungsziel je Marketingkanal) |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee

Diese Seite ist die **versionsgebundene, abgespeckte Spiegelung** der kurzfristigen Marketing-Einstellungen-Seite (PROJ-49). Sie kombiniert zwei bereits fertige Fundamente:

1. **Das Versions-Gerüst** der Langfristigen Planung (PROJ-73): Es übernimmt das Laden und Prüfen der Planversion, den Header mit Breadcrumb, das linke Seitenmenü, den Redirect bei fremder/unbekannter Version und die Toast-Meldungen. Der Menüeintrag „Marketing-Einstellungen" existiert dort bereits — die neue Seite löst nur den bisherigen Platzhalter ab.
2. **Das obere Kanal-Formular der kurzfristigen Seite** (PROJ-49): Sales Plattform, Gruppierung und Zahlungsziel, mit Auto-Speichern beim Ändern, optimistischer Anzeige und Rücksetzen bei Fehler.

Bewusst **weggelassen** gegenüber der kurzfristigen Vorlage: die gesamte untere Produkt-Tabelle (Berechnungsart pro Produkt inkl. gewichtetem Mittelwert), der Kalender-/Kalenderwochen-Picker und die „Nächste Zahlungswoche"-Anzeige. Übrig bleibt pro Marketingkanal ein kompaktes Formular mit drei Feldern.

Der eigentliche Neubau beschränkt sich auf zwei Dinge: eine **versionsgebundene Datenablage** (eine neue Tabelle) und ein **versionsbewusstes Endpunkt-Paar**. UI-Bausteine, Versions-Gerüst und die Stammdaten-Quellen sind vorhanden und werden wiederverwendet.

Inhaltlich denkt die Seite — anders als die kurzfristige — in **Monaten/Quartalen** statt Kalenderwochen und bezieht Marketingkanäle sowie Sales Plattformen aus dem **KPI-Modell der jeweiligen Planversion** (PROJ-74), nicht aus dem globalen Modell.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                 (Versions-Übersicht — bereits vorhanden)
+-- Eintrag/Kachel "Marketing-Einstellungen"  → .../[versionId]/marketing-einstellungen
                                                 (Nav-Eintrag bereits in der zentralen Liste angelegt)

/dashboard/langfristige-planung/[versionId]/marketing-einstellungen   (NEUE echte Seite)
+-- LangfristigeVersionShell  (bestehend — Header, Breadcrumb, Versionsprüfung, Redirect, Toaster)
    +-- LangfristigeMarketingEinstellungenFormular  (NEUE Hauptkomponente)
        +-- Reiter-Leiste (Tabs)  [eine Tab je Marketingkanal der Version]
        |   +-- Tab: "Marketingkanal A"
        |   +-- Tab: "Marketingkanal B"
        |   +-- ...
        +-- Leerzustand: keine Marketingkanäle → Hinweis + Link zur KPI-Modell-Verwaltung dieser Version
        +-- (je aktivem Tab) Kanal-Formular  (NEUE Formular-Komponente)
            +-- Feld 1: Sales Plattform   [Auswahl: "Keine" + Plattformen der Version]
            +-- Feld 2: Gruppierung       [Auswahl: Monatlich / Quartalsweise]
            +-- Feld 3: Zahlungsziel      [Zahl in Tagen, ≥ 0, optional]
```

- Die Reiter und das Formular sind eine **leicht angepasste Kopie** der kurzfristigen Komponente: nur das obere Kanal-Formular bleibt, die Produkt-Tabelle und der Datums-Picker fallen weg, die Gruppierung kennt nur noch zwei Optionen, und die Quellen (Marketingkanäle, Plattformen) sind versionsgebunden.
- Eingebettet wird alles in das bestehende Versions-Gerüst — kein neues Seiten-Layout nötig.

### B) Datenmodell (Klartext)

**Neue Tabelle „Langfristige Marketing-Einstellungen" — ein Eintrag je Marketingkanal je Planversion:**
```
Je Eintrag:
- eindeutige ID
- Besitzer (Nutzer)                         → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion  → Datenisolation
- Bezug zu genau EINEM Marketingkanal der Version
- Sales Plattform der Version  ODER  "Keine" (optional, darf leer sein)
- Gruppierung: "monatlich" | "quartalsweise"   (Standard: monatlich)
- Zahlungsziel in Tagen: ganze Zahl ≥ 0  ODER  "nicht gesetzt"  (Standard: nicht gesetzt)
```

**Regeln:**
- Genau **ein** Eintrag je Marketingkanal je Version (Eindeutigkeit über Version + Marketingkanal + Nutzer) → ermöglicht „Anlegen-oder-Aktualisieren".
- Die Sales Plattform ist **kein Pflichtfeld**: „Keine" ist ein gültiger, gespeicherter Zustand.
- **Bewusst NICHT enthalten:** jegliche Produkt-Berechnungsart, gewichtete Mittelwerte, Kalenderwochen-Anker oder eine „nächste Zahlung"-Spalte. Die zeitliche Zuordnung ergibt sich fest aus der Gruppierung (monatlich → Anfang Folgemonat; quartalsweise → Anfang Monat nach Quartal) und wird erst in Folge-Features ausgewertet.
- **Kaskadierende Löschung:** Wird die Planversion gelöscht, verschwinden alle Einträge automatisch. Wird ein Marketingkanal im KPI-Modell der Version gelöscht, verschwindet sein Eintrag automatisch. Wird die referenzierte Sales Plattform gelöscht, wird **nur die Plattform-Referenz geleert** (zurück auf „Keine") — der Eintrag bleibt erhalten.
- **Standardwerte bei noch leerem Kanal:** Plattform = Keine, Gruppierung = monatlich, Zahlungsziel = nicht gesetzt. Diese werden nur angezeigt; ein Datensatz entsteht erst beim ersten Speichern.

### C) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Gerüst prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Hauptkomponente lädt die Marketingkanäle dieser Version (aus dem KPI-Modell)
      keine Kanäle → Hinweis + Link zur KPI-Modell-Verwaltung
      sonst        → erster Reiter wird aktiv
  → Außerdem werden die Sales Plattformen der Version geladen (Dropdown-Optionen)
  → Für den aktiven Kanal wird der Einstellungs-Eintrag geladen
      (oder Standardwerte, falls noch keiner existiert)

Nutzer wechselt Marketingkanal-Reiter
  → Einstellung des neuen Kanals wird geladen

Nutzer ändert Sales Plattform / Gruppierung / Zahlungsziel
  → Wert sofort sichtbar (optimistisch) + Speichern (Anlegen oder Aktualisieren)
      Erfolg → still
      Fehler → Toast "Einstellung konnte nicht gespeichert werden." + Rücksetzen
```

### D) Server-Schnittstellen (versions- & nutzerbewusst)

```
Lesen:    Marketing-Einstellung eines Marketingkanals laden
          → prüft Nutzer + Versionszugehörigkeit + dass der Kanal zur Version gehört
          → liefert gespeicherte Werte oder die Standardwerte (ohne anzulegen)

Speichern: Einstellung eines Marketingkanals anlegen/aktualisieren
          → prüft Nutzer + Versionszugehörigkeit
          → prüft, dass Marketingkanal (und ggf. gewählte Sales Plattform) zur selben
            Version und zur korrekten Art gehören
          → prüft die Werte (Gruppierung zulässig, Zahlungsziel ganze Zahl ≥ 0 oder leer)
          → ungültig → Fehler; fremde/unbekannte Version → kein Zugriff
```

Beide Endpunkte folgen exakt dem im Langfristig-Fundament etablierten Muster (Login-Pflicht, ID-Format-Prüfung, Filterung nach Nutzer **und** Version als zweite Sicherheitsebene zur Row-Level-Security) — wie bereits bei PROJ-74/PROJ-76 umgesetzt.

### E) Wiederverwendung im Detail

| Baustein | Status | Anmerkung |
|----------|--------|-----------|
| Versions-Gerüst (Laden/Prüfen der Version, Header, Seitenmenü, Redirect, Toaster) | **unverändert wiederverwenden** | aus PROJ-73 (`LangfristigeVersionShell`) |
| Marketingkanal-/Plattform-Listen der Version | **unverändert wiederverwenden** | aus PROJ-74 (versionsgebundener KPI-Kategorien-Hook, Arten „Marketingkanal" / „Sales Plattform") |
| Reiter-Leiste (Tabs), Auswahl- und Zahlen-Eingaben, Toast | **bestehende shadcn/ui-Bausteine** | analog zur kurzfristigen Seite |
| Oberes Kanal-Formular (Sales Plattform, Gruppierung, Zahlungsziel) | **als Vorlage, gekürzt** | aus PROJ-49; ohne Datums-Picker, ohne „Nächste Zahlungswoche", Gruppierung nur 2 Optionen |
| Kurzfristige Produkt-Tabelle (Berechnungsart pro Produkt) | **entfällt vollständig** | nicht Teil dieser Seite |
| Daten-Hook (Laden/Speichern, optimistisch, Rücksetzen) | **neue, versionsbewusste Variante** | spiegelt die kurzfristige Logik, versionsgebundene Quelle |
| Datentabelle + Endpunkte | **Neubau** | versions-/nutzergebunden |
| Navigation | **bereits vorhanden** | Eintrag „Marketing-Einstellungen" in der zentralen Nav-Liste; nur Beschreibungstext anpassen |

### F) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Speicherort | Datenbank, pro Planversion | Daten müssen je Szenario isoliert und dauerhaft sein (PROJ-73-Prinzip) |
| Eigene neue Tabelle | Ja (statt Erweiterung der Kurzfristig-Tabellen) | Klare Abkapselung, kaskadierende Löschung pro Version, kein Regressionsrisiko für die kurzfristige Seite |
| Reiter je Marketingkanal | Tabs (statt gestapelter Karten) | Vom Nutzer bestätigt; einheitlich mit der kurzfristigen Bedienung |
| Keine Produkt-Tabelle | Entfällt | Vom Nutzer bestätigt; in der Langfristplanung nicht benötigt |
| Gruppierung nur 2 Optionen | Monatlich / Quartalsweise | Vom Nutzer bestätigt; langfristige Planung denkt in Monaten/Quartalen, „Wöchentlich" entfällt |
| Keine „Nächste Zahlungswoche"/kein Anker | Entfällt | Vom Nutzer bestätigt; Berechnung ergibt sich fest aus der Gruppierung (Anfang Folgemonat bzw. Anfang Monat nach Quartal) |
| Sales Plattform optional | „Keine" als gültiger Standard | Vom Nutzer bestätigt; kein Pflichtfeld, es wird ohnehin erst beim Ändern gespeichert |
| Zahlungsziel-Einheit | Tage | Vom Nutzer bestätigt; konsistent mit der kurzfristigen Seite |
| Plattform-Löschung | Referenz leeren (statt Eintrag löschen) | Der Kanal-Eintrag soll erhalten bleiben; nur die Plattform-Zuordnung fällt auf „Keine" zurück |
| Quelle der Stammdaten | KPI-Modell der Version (PROJ-74) | Vollständige Abkapselung; keine Verbindung zum globalen Modell oder zur Kurzfristigen Planung |
| Bedienmuster | Auto-Save, optimistische Anzeige, Toast, Rücksetzen | Einheitlich mit allen Einstellungsseiten im Projekt |
| Seitengerüst | Bestehende Versions-Shell wiederverwenden | Versionsprüfung, Redirect, Header/Breadcrumb sind bereits gelöst |

### G) Dependencies (Pakete)

Keine neuen npm-Pakete nötig. Verwendet werden ausschließlich bestehende Bausteine: shadcn/ui (Tabs, Select, Input, Label, Card/Border, Toast), Zod (Eingabeprüfung), Supabase (Datenhaltung inkl. Row-Level-Security), das Versions-Gerüst (`LangfristigeVersionShell`) und die Navigations-Konfiguration aus PROJ-73 sowie der versionsgebundene KPI-Kategorien-Hook aus PROJ-74.

### H) Umsetzungsreihenfolge (empfohlen)

1. Eine neue versionsgebundene Tabelle „Langfristige Marketing-Einstellungen", nutzer- & versionsgesichert, mit kaskadierender Löschung (Plattform-Referenz nur leeren).
2. Versionsbewusstes Endpunkt-Paar (Lesen + Speichern), mit serverseitiger Prüfung von Versions-/Art-Zugehörigkeit.
3. Versionsbewusster Daten-Hook (analog zur kurzfristigen Logik; nur die drei Kanal-Felder; versionsgebundene Quelle).
4. Neue Seite mit Marketingkanal-Reitern und Kanal-Formular, eingebettet ins Versions-Gerüst (überwiegend Verdrahtung bestehender Bausteine).
5. Beschreibungstext des Nav-Eintrags anpassen.

> Hinweis: Da UI-Bausteine, Versions-Gerüst und Stammdaten-Hooks bereits existieren, liegt der eigentliche Aufwand in Schritt 1–2 (Datenhaltung/Endpunkte); Schritt 3–5 sind überwiegend Verdrahtung und Kürzung der kurzfristigen Vorlage.

## Implementation Notes (Frontend — 2026-06-20)

Die UI und die Verdrahtung sind gebaut; die eigentliche Datenhaltung/API folgt mit `/backend`. Bis dahin zeigt jeder Marketingkanal-Reiter sauber den Lade-Fehlerzustand (kein Absturz). Das Versions-Gerüst und die Stammdaten-Listen (Marketingkanäle, Sales Plattformen) laden bereits korrekt über die bestehenden PROJ-73/PROJ-74-APIs.

**Maximale Wiederverwendung:** Die langfristige Auszahlungseinstellungen-Komponente (PROJ-76) und das obere Kanal-Formular der kurzfristigen Marketing-Einstellungen (PROJ-49) dienten als Vorlage; Versions-Gerüst (`LangfristigeVersionShell`) und der KPI-Kategorien-Hook der Version (`useLangfristigeKpiKategorien`) wurden **unverändert** wiederverwendet. Die kurzfristige Produkt-Tabelle, der Datums-/KW-Picker und „Nächste Zahlungswoche" entfallen — wie in der Spec festgelegt.

### Neue Dateien
- `src/hooks/use-langfristige-marketing-einstellungen.ts` — versionsbewusster Hook `useLangfristigeMarketingEinstellungen(versionId, marketingkanalId)`. Lädt/speichert gegen `/api/langfristige-planung/[versionId]/marketing-einstellungen` (GET mit `?marketingkanal_id=`, PUT-Upsert) mit optimistischem Update und Rollback. Enthält Typ `Gruppierung` (`'monatlich' | 'quartalsweise'`), Konstanten (`GRUPPIERUNG_VALUES`, `GRUPPIERUNG_LABELS`, `GRUPPIERUNG_HINWEISE`) und den Default-Builder `makeDefaultEinstellung`.
- `src/components/langfristige-marketing-einstellungen-formular.tsx` — zwei Komponenten: `KanalForm` (Formular je Marketingkanal mit 3 Feldern: Sales-Plattform-`Select` mit „Keine"-Option, Gruppierung-`Select` mit Hinweiszeile zur festen Berechnungsregel, Zahlungsziel-`Input` in Tagen mit `onBlur`-Auto-Save) und `LangfristigeMarketingEinstellungenFormular` (Export: liest `versionId` aus `useParams`, lädt Marketingkanäle + Sales Plattformen der Version, rendert Marketingkanal-Tabs; Leerzustand mit Link zur versionsgebundenen KPI-Modell-Verwaltung). Plattformen werden einmal im Parent geladen und an jedes `KanalForm` durchgereicht.
- `src/app/dashboard/langfristige-planung/[versionId]/marketing-einstellungen/page.tsx` — echte Seite: `LangfristigeVersionShell` (seitenTitel="Marketing-Einstellungen") + Formular. Löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab.

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — Beschreibungstext des bestehenden Eintrags „Marketing-Einstellungen" von „Marketing-Berechnungsmethode je Plattform & Produkt konfigurieren" auf **„Sales Plattform, Gruppierung und Zahlungsziel je Marketingkanal pflegen"** angepasst. Slug/Label unverändert; Menü, Breadcrumb und Übersichtskarte ziehen automatisch nach.

### Designentscheidungen
- **Sales Plattform optional über Sentinel-Wert „keine":** das `Select` nutzt intern den Wert `keine` (shadcn `Select` erlaubt keinen leeren `SelectItem`-Wert); beim Speichern wird daraus `null`. „Keine" ist Standard und ein gültiger gespeicherter Zustand.
- **Gruppierungs-Hinweis als reine Anzeige:** unter dem Gruppierungs-`Select` steht die feste Berechnungsregel (Monatlich → „Berechnung am Anfang des Folgemonats"; Quartalsweise → „Berechnung am Anfang des Monats nach dem Quartal"). Es gibt bewusst keinen Ankermonat und keine „nächste Zahlung"-Anzeige.
- **Zahlungsziel mit lokalem String-State + `onBlur`-Save:** verhindert Speichern bei jedem Tastendruck; ungültige Eingaben (negativ/NaN) werden verworfen und auf den gespeicherten Wert zurückgesetzt; leeres Feld speichert `null`.

### Erwartete API (für `/backend`)
- `GET /api/langfristige-planung/[versionId]/marketing-einstellungen?marketingkanal_id=<UUID>` → `{ marketingkanal_id, sales_plattform_id, gruppierung, zahlungsziel_tage }` oder `null` wenn noch kein Eintrag. Prüft Login + Versions-Eigentum (404 bei fremder/unbekannter Version); 400 bei fehlender/ungültiger `marketingkanal_id`.
- `PUT /api/langfristige-planung/[versionId]/marketing-einstellungen` — Upsert je `(plan_version_id, marketingkanal_id, user_id)`; Body enthält den vollständigen Datensatz. Zod: `gruppierung ∈ {monatlich, quartalsweise}`; `zahlungsziel_tage` ganze Zahl ≥ 0 oder null; `sales_plattform_id` gültige UUID oder null; `marketingkanal_id` gültige UUID. `marketingkanal_id` muss zur Version & Art `lp_marketingkanal` gehören; falls gesetzt, muss `sales_plattform_id` zur Version & Art `lp_sales_plattform` gehören. Antwort: der gespeicherte Datensatz.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen Dateien.
- `npx next lint`: keine Findings für die neuen/geänderten Dateien.

## Implementation Notes (Backend — 2026-06-20)

Datenhaltung und API sind implementiert; die Frontend-Anbindung erfolgte bereits im Frontend-Schritt (ruft exakt diese Endpunkte/Datensatzform), daher keine weiteren Frontend-Änderungen nötig.

### Datenbank (Supabase-Projekt „Controlling-App" `kdmpghtdoguppfqhdscq`, Migration `create_langfristige_marketing_einstellungen`)
- **`langfristige_marketing_einstellungen`** (ein Eintrag je Marketingkanal/Version/Nutzer): `id` UUID PK (`extensions.uuid_generate_v4()`), `user_id` → `auth.users` (ON DELETE CASCADE), `plan_version_id` → `langfristige_planversionen` (ON DELETE CASCADE), `marketingkanal_id` → `langfristige_kpi_kategorien` (ON DELETE CASCADE), `sales_plattform_id` → `langfristige_kpi_kategorien` (**ON DELETE SET NULL** — Eintrag bleibt, Plattform fällt auf „Keine" zurück), `gruppierung` TEXT CHECK ∈ {monatlich, quartalsweise} DEFAULT 'monatlich', `zahlungsziel_tage` INTEGER CHECK ≥ 0 (nullable), `created_at`/`updated_at`. UNIQUE `(plan_version_id, marketingkanal_id, user_id)` → ermöglicht Upsert via `onConflict`.
- RLS aktiviert, 4 Policies (SELECT/INSERT/UPDATE/DELETE) mit `auth.uid() = user_id`. Index `idx_lang_marketing_einstellungen_lookup` auf `(plan_version_id, marketingkanal_id, user_id)`.
- Kaskadierende Löschung: Planversion gelöscht → alle Einträge weg; Marketingkanal gelöscht → zugehöriger Eintrag weg; Sales Plattform gelöscht → nur `sales_plattform_id` auf NULL (kein Waisen-Eintrag, Datensatz bleibt).
- `get_advisors` (security): **keine neue Warnung** für die Tabelle (bestehende Warnungen betreffen ausschließlich andere, ältere Tabellen mit `USING(true)`-Policies).

### API-Route (`src/app/api/langfristige-planung/[versionId]/marketing-einstellungen/route.ts`)
- **`GET ?marketingkanal_id=<UUID>`** — prüft Login + Versions-Eigentum (404 bei fremder/unbekannter Version, 400 bei ungültiger Versions-ID); lädt Einstellung (`maybeSingle`). Gibt `null` zurück, wenn kein Eintrag existiert (Frontend zeigt Standardwerte). 400 bei fehlender/ungültiger `marketingkanal_id`.
- **`PUT`** — Reihenfolge: Login → Zod-Validierung (günstig vor DB) → Versions-Eigentum → Marketingkanal-Zugehörigkeit (Art `lp_marketingkanal`, gleiche Version; sonst 400) → falls `sales_plattform_id` gesetzt: Plattform-Zugehörigkeit (Art `lp_sales_plattform`, gleiche Version; sonst 400) → Upsert (`onConflict: 'plan_version_id,marketingkanal_id,user_id'`). Antwort: gespeicherter Datensatz. Zod: `gruppierung ∈ {monatlich, quartalsweise}`; `zahlungsziel_tage` ganze Zahl ≥ 0 oder null; `sales_plattform_id` UUID oder null; `marketingkanal_id` UUID.
- Alle Queries zusätzlich nach `user_id` + `plan_version_id` gefiltert (Defense-in-Depth zur RLS). Fehler als `{ error }`; 400/401/404/500 abgedeckt.

### Tests
- `…/marketing-einstellungen/route.test.ts` — **19/19 grün** (Vitest): GET (8: Werte, null, fehlende/ungültige marketingkanal_id, ungültige Version, 404, 401, 500); PUT (11: Upsert mit/ohne Plattform, ungültige Gruppierung, negatives Zahlungsziel, fehlende marketingkanal_id, ungültige Version, 404, Kanal fremd, Plattform fremd, 401, 500). Verkettbarer Supabase-Mock (`chainResult`) wie bei PROJ-76.
- Gesamtes `langfristige-planung`-API-Testset: **232/232 grün** (keine Regressionen). Typecheck der neuen Route ohne Fehler.

## QA Test Results (2026-06-20)

**Methode:** Code-Audit aller Akzeptanzkriterien + Vitest (API/Hook-Logik) + Playwright (Route/Auth/Regression). Interaktionen (Tab-Wechsel, Auto-Save, optimistisches Update/Rollback) sind code-/manuell geprüft — analog zum Vorgehen bei PROJ-74/75/76 (versionsgebundene Seiten ohne automatisierte Login-Session in E2E).

### Testergebnis-Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| Akzeptanzkriterien | ✅ Alle bestanden |
| Hook-/Konstanten-Unit-Tests (Vitest) | ✅ 8/8 bestanden |
| API-Integrationstests (Vitest) | ✅ 19/19 bestanden |
| Langfristige-Planung-API-Gesamtsuite (Regression) | ✅ 232/232 bestanden |
| E2E-Tests (Playwright) | ✅ 8/8 bestanden (4 Tests × 2 Browser) |
| Sicherheitsaudit | ✅ Keine Findings |
| Bugs gefunden | 0 Critical · 0 High · 0 Medium · 2 Low (offen, nicht blockierend) |
| **Produktionsbereitschaft** | ✅ **READY** |

### Automatisierte Tests

- **Hook/Konstanten** (`use-langfristige-marketing-einstellungen.test.ts`) — 8/8: `GRUPPIERUNG_VALUES` (genau `monatlich`/`quartalsweise`, kein `woechentlich`), Labels, Berechnungsregel-Hinweise, `makeDefaultEinstellung` (Defaults: Plattform null, Gruppierung monatlich, Zahlungsziel null).
- **API** (`route.test.ts`) — 19/19: GET (Werte, null, fehlende/ungültige marketingkanal_id, ungültige/fremde Version, 401, 500); PUT (Upsert mit/ohne Plattform, ungültige Gruppierung, negatives Zahlungsziel, fehlende marketingkanal_id, ungültige/fremde Version, fremder Kanal, fremde Plattform, 401, 500).
- **Regression**: gesamte `langfristige-planung`-API-Suite 232/232 grün.
- **E2E** (`PROJ-80-…spec.ts`) — 8/8: Seitenexistenz (kein 404), Auth-Redirect zur `/login`, Dashboard-Redirect, kurzfristige Marketing-Einstellungen weiterhin erreichbar.

### Akzeptanzkriterien — geprüft (Code-Review + Tests)

**Navigation & Einstieg**
- ✅ Nav-Eintrag „Marketing-Einstellungen" (Gruppe „Einstellungen", Slug `marketing-einstellungen`) verlinkt versionsspezifisch; Versions-Übersicht listet ihn (generisches Rendering aus `VERSIONS_NAV_GRUPPEN`)
- ✅ Beschreibungstext angepasst auf „Sales Plattform, Gruppierung und Zahlungsziel je Marketingkanal pflegen" (nicht mehr die alte Produkt-Beschreibung)
- ✅ Auth-Guard / fremde versionId → Redirect (über `LangfristigeVersionShell`; API liefert 404/400)
- ✅ Eingebettet in die Versions-Shell (`seitenTitel="Marketing-Einstellungen"`)

**Reiter (Marketingkanäle der Version)**
- ✅ Tabs aus `lp_marketingkanal` der Version, sortiert nach `sort_order`; erster Reiter aktiv (`defaultValue={sortedKanaele[0]?.id}`)
- ✅ Leerzustand „Keine Marketingkanäle definiert" mit Link zur versionsgebundenen KPI-Modell-Verwaltung

**Einstellungsformular pro Marketingkanal**
- ✅ Feld 1 Sales Plattform: `Select` mit „Keine" (Default) + `lp_sales_plattform` der Version; kein Pflichtfeld; Hinweis+Link wenn keine Plattformen; Auto-Save onChange
- ✅ Feld 2 Gruppierung: `Select` mit genau Monatlich/Quartalsweise, Default Monatlich, Hinweiszeile zur festen Berechnungsregel; Auto-Save onChange
- ✅ Feld 3 Zahlungsziel (Tage): `Input type=number` min=0 step=1, leer=null, Auto-Save onBlur
- ✅ Keine Produkt-Tabelle, kein Datums-/KW-Picker, keine „Nächste Zahlungswoche" — wie spezifiziert

**Datenpersistenz & Isolation**
- ✅ Ein Datensatz je `(plan_version_id, marketingkanal_id, user_id)`; Standardwerte ohne DB-Insert bis zur ersten Änderung
- ✅ Optimistisches Update + Rollback + Toast bei API-Fehler (Hook `upsert`)
- ✅ Versionsisolation (API-Filter `user_id` + `plan_version_id`); kaskadierende Löschung (FK ON DELETE CASCADE für Version/Kanal); Plattform-Löschung → `sales_plattform_id` NULL (ON DELETE SET NULL), Eintrag bleibt

**Datenbank & API**
- ✅ Tabelle mit CHECKs (gruppierung-Enum, zahlungsziel ≥ 0), UNIQUE, Index, RLS (`auth.uid() = user_id`)
- ✅ GET/PUT mit Zod, Versions-/Art-Prüfung (Kanal & Plattform müssen zur Version & korrekten Art gehören); 400/401/404/500 abgedeckt

### Edge Cases — geprüft

- ✅ Keine Marketingkanäle → Hinweis + Link, keine Reiter
- ✅ Keine Sales Plattformen → Dropdown zeigt nur „Keine" + Hinweis-Link; übrige Felder bedienbar
- ✅ „Keine" Plattform gespeichert als `sales_plattform_id = null`
- ✅ Zahlungsziel leer = null; negativ via UI (`min=0`) verhindert, serverseitiger CHECK + Zod als zweite Ebene (Test: 400)
- ✅ Fremder Kanal/fremde Plattform → 400 (Tests vorhanden); fremde/unbekannte Version → 404
- ✅ Plattform/Kanal im KPI-Modell gelöscht → Cascade bzw. SET NULL (FK-Verhalten)

### Sicherheitsaudit (Red Team) — keine Befunde

- ✅ **Auth**: `requireAuth()` in GET + PUT → 401 ohne Session
- ✅ **Authorization / IDOR**: Versions-Eigentum geprüft (`ensureVersion` → 404 bei fremder Version); Marketingkanal & ggf. Sales Plattform müssen zur selben Version + korrekten `art` gehören (sonst 400); Queries zusätzlich nach `user_id` + `plan_version_id` gefiltert; RLS als zweite Ebene → kein Cross-User-/Cross-Version-Zugriff
- ✅ **Input-Validierung**: Zod (Gruppierung-Enum, Zahlungsziel int ≥ 0/null, UUID-Felder); UUID-Format von versionId/marketingkanal_id geprüft; DB-CHECKs als zweite Ebene
- ✅ **Mass Assignment**: PUT mappt nur explizite Felder; `user_id` aus Session, nicht aus Body
- ✅ **XSS/Injection**: Werte sind Enums/Zahlen/UUIDs bzw. via Select/Input; kein Freitext-Rendering, kein `dangerouslySetInnerHTML`; Supabase parametrisiert
- ✅ `get_advisors` (security): **keine neue Warnung** für `langfristige_marketing_einstellungen` (bestehende Warnungen betreffen ausschließlich ältere Tabellen mit `USING(true)`)
- ✅ Keine Secrets in Antworten/Client

### Bugs / Hinweise

**Keine Critical/High/Medium gefunden.**

**Low / Beobachtungen (kein Blocker):**
- **L1 (kosmetisch):** Dezimaleingabe im Zahlungsziel (z. B. „30,5") wird per `Math.round` auf eine ganze Zahl gerundet statt abgelehnt. Da das Feld `step=1`/`min=0` ist und der Wert fachlich Tage abbildet, ist die Rundung unkritisch; serverseitig erzwingt Zod `int`.
- **L2 (by design):** Beim Speichern ist die Operation nicht „dirty-checked" über alle Felder — jedes `Select`/`Input`-Event löst einen Upsert des vollständigen Datensatzes aus (optimistisch). Bei 1–5 internen Nutzern unkritisch; konsistent mit allen anderen Einstellungsseiten.

### Produktionsbereitschaft

✅ **READY.** Keine Critical/High-Bugs. Datenhaltung, API und UI sind spec-konform; Sicherheitsaudit bestanden; Automatisierte Tests (27 Vitest + 8 Playwright) grün, keine Regressionen in der langfristige-planung-Suite (232/232).

## Deployment
_To be added by /deploy_

## Deployment
_To be added by /deploy_
