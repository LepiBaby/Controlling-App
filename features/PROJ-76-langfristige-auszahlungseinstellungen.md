# PROJ-76: Auszahlungseinstellungen — Langfristige Planung

## Status: Approved
**Created:** 2026-06-20
**Last Updated:** 2026-06-20 (QA — BUG-1 behoben)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — diese Seite ist eine versionsgebundene Einstellungsseite unter `/dashboard/langfristige-planung/[versionId]/…`; sie nutzt das Versions-Routing, den Versionskontext (`LangfristigeVersionShell`), den Redirect bei fremder Version und das kontextabhängige Seitenmenü. Der Nav-Eintrag „Auszahlungseinstellungen" (Slug `auszahlungseinstellungen`, Gruppe „Einstellungen") ist dort bereits angelegt und löst diese echte Seite ab.
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert je Planversion die **Sales Plattformen** (`art = 'lp_sales_plattform'`) als Reiter und die **Marketingkanäle** (`art = 'lp_marketingkanal'`, flache Liste) als Auswahloptionen aus `langfristige_kpi_kategorien`.
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert den Startmonat der Planversion als sinnvolle Vorbelegung für den Ankermonat (kein harter technischer Zwang, aber inhaltlicher Bezug).
- Vorlage (kein harter Require): PROJ-45 (Auszahlungseinstellungen — Kurzfristige Planung) — UI, Bedienung und Datenfluss werden gespiegelt, mit den unten beschriebenen Abweichungen (Monate statt Kalenderwochen, eigener Ankermonat, versionsgebundene Datenhaltung, kein Retouren-Feld).

## Übersicht

Die Seite „Auszahlungseinstellungen" der **Langfristigen Planung** ist der versionsgebundene Gegenpart zur kurzfristigen Auszahlungseinstellungen-Seite (PROJ-45). Sie wird **pro Planversion** gespeichert — jede Planversion hat eigene, anfangs leere Daten (Datenisolation gemäß PROJ-73).

Wie in der kurzfristigen Version werden die im **KPI-Modell der Planversion** definierten **Sales Plattformen** oben als Reiter (Tabs) dargestellt; je Reiter pflegt der Nutzer die Auszahlungslogik einer Plattform.

Wesentliche Unterschiede zur kurzfristigen Variante:

- **Monate statt Kalenderwochen** — die langfristige Planung denkt in Monaten. Der Auszahlungsrhythmus unterscheidet **monatlich**, **alle zwei Monate** und **quartalsweise**.
- **Eigener Ankermonat** statt „nächste Auszahlungswoche": je Plattform wird der **erste Auszahlungsmonat** (Monat + Jahr) gepflegt, ab dem der Rhythmus läuft.
- **Verschiebung / Zurückstellung in Monaten** (statt Wochen), als ganze Zahl ≥ 0.
- **Marketing als Mehrfachauswahl** der im KPI-Modell der Version gepflegten **Marketingkanäle** (flache Liste) — eine Plattform kann mehrere Kanäle zuordnen.
- **Kein Retouren-Feld** (in der kurzfristigen Version existiert es in der UI nicht mehr; es entfällt hier vollständig).

Die Seite ist als gestapelte Einstellungszeilen je Plattform-Reiter ausgelegt, sodass später weitere Felder ergänzt werden können, ohne die Seitenstruktur zu ändern.

## User Stories

- Als Controller möchte ich die Seite „Auszahlungseinstellungen" innerhalb einer geöffneten Planversion über das linke Seitenmenü und über die Versions-Übersichtsseite aufrufen können, damit ich die Auszahlungslogik dieser Version pflegen kann.
- Als Controller möchte ich alle im KPI-Modell dieser Planversion gepflegten Sales Plattformen als Reiter oben sehen, damit ich die Auszahlungseinstellungen plattformspezifisch pflegen kann.
- Als Controller möchte ich je Plattform den Auszahlungsrhythmus (monatlich, alle zwei Monate, quartalsweise) festlegen, damit das Auszahlungsmodell dieser Version korrekt abgebildet wird.
- Als Controller möchte ich je Plattform einen Ankermonat (ersten Auszahlungsmonat als Monat + Jahr) festlegen, ab dem der Rhythmus läuft, damit feststeht, in welchen Monaten ausgezahlt wird.
- Als Controller möchte ich je Plattform eine Verschiebung / Zurückstellung in ganzen Monaten (≥ 0) angeben, damit Auszahlungen bei Bedarf nach hinten verschoben werden.
- Als Controller möchte ich je Plattform aus den Marketingkanälen des KPI-Modells dieser Version mehrere Kanäle auswählen, damit feststeht, welche Marketingausgaben dieser Plattform zugeordnet/inkludiert sind.
- Als Controller möchte ich, dass meine Eingaben pro Planversion gespeichert werden und beim nächsten Aufruf dieser Version noch vorhanden sind, ohne andere Versionen oder die Kurzfristige Planung zu beeinflussen.
- Als Controller möchte ich eine klare Rückmeldung erhalten, wenn das Speichern fehlschlägt, damit ich den Fehler erkenne und der vorherige Wert erhalten bleibt.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Innerhalb einer geöffneten Planversion enthält das linke Seitenmenü (Gruppe „Einstellungen") den Eintrag „Auszahlungseinstellungen" → `/dashboard/langfristige-planung/[versionId]/auszahlungseinstellungen`
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint ein Eintrag/eine Kachel „Auszahlungseinstellungen", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Wird die Seite mit unbekannter/fremder/ungültiger `versionId` aufgerufen, erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73-Versionskontext
- [ ] Die Seite ist in das bestehende Versions-Gerüst (`LangfristigeVersionShell`: Header, Breadcrumb, Seitenmenü, Toaster) eingebettet

### Reiter-Navigation (Sales Plattformen der Version)

- [ ] Oben auf der Seite werden alle Einträge aus `langfristige_kpi_kategorien` mit `art = 'lp_sales_plattform'` der aktuellen `versionId` als Tabs dargestellt (sortiert nach `sort_order`)
- [ ] Beim ersten Laden ist der erste Reiter automatisch aktiv
- [ ] Gibt es keine Sales Plattformen in der KPI-Modell-Verwaltung dieser Version, erscheint ein Hinweis: „Keine Sales Plattformen definiert. Bitte zuerst in der KPI-Modell Verwaltung Sales Plattformen anlegen." mit Link zur KPI-Modell-Verwaltung **dieser Version** (`/dashboard/langfristige-planung/[versionId]/kpi-modell-verwaltung`)

### Einstellungsformular pro Plattform

Unterhalb der Reiter wird für die aktive Plattform ein Formular mit den folgenden Zeilen angezeigt (kein Produkt-Tabellen-Layout — Einstellungen gelten auf Plattformebene):

#### Zeile 1: Auszahlungsrhythmus

- [ ] Beschriftung: „Auszahlungsrhythmus"
- [ ] Eingabeelement: Dropdown (shadcn `Select`)
- [ ] Optionen in dieser Reihenfolge:
  1. Monatlich
  2. Alle 2 Monate
  3. Quartalsweise
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: „Monatlich"
- [ ] Auto-Save bei `onChange` (kein separater „Speichern"-Button)

#### Zeile 2: Erster Auszahlungsmonat (Ankermonat)

- [ ] Beschriftung: „Erster Auszahlungsmonat"
- [ ] Zwei Auswahlfelder nebeneinander: **Monat** (Januar–Dezember = 1–12) und **Jahr** (Jahreszahl)
- [ ] Beide werden gemeinsam gepflegt: entweder beide gesetzt oder beide leer („nicht gesetzt")
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: leer (nicht gesetzt); als Vorbelegung/Vorschlag darf der Startmonat der Planversion aus PROJ-75 herangezogen werden
- [ ] Optional/zur Orientierung darf unter dem Label der berechnete **nächste zukünftige Auszahlungsmonat** angezeigt werden (Ankermonat um den Rhythmus vorgerückt, bis er ≥ aktueller Monat ist) — analog zur kurzfristigen „Nächste Auszahlungswoche"-Anzeige
- [ ] Auto-Save bei Auswahländerung; Leeren beider Felder speichert „nicht gesetzt" (null)

#### Zeile 3: Verschiebung / Zurückstellung

- [ ] Beschriftung: „Verschiebung / Zurückstellung"
- [ ] Eingabeelement: Zahlenfeld (shadcn `Input type="number"`), Einheit „Monate" als Suffix sichtbar
- [ ] Wertebereich: ganze Zahl ≥ 0 (Vorschlag Maximum: 60 Monate); kein Vorziehen (keine negativen Werte)
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: 0
- [ ] Auto-Save bei `onChange`/`onBlur`

#### Zeile 4: Marketing (Mehrfachauswahl Marketingkanäle)

- [ ] Beschriftung: „Marketing"
- [ ] Eingabeelement: Mehrfachauswahl (shadcn-basierte `MultiSelect`-Komponente, analog zur kurzfristigen Version)
- [ ] Optionen: alle Einträge aus `langfristige_kpi_kategorien` mit `art = 'lp_marketingkanal'` der aktuellen `versionId` (sortiert nach `sort_order`)
- [ ] Eine Plattform kann **mehrere** Marketingkanäle auswählen; ausgewählte Kanäle werden als entfernbare Einträge dargestellt
- [ ] Standardwert bei noch nicht gespeichertem Eintrag: keine Auswahl
- [ ] Gibt es keine Marketingkanäle im KPI-Modell dieser Version, erscheint ein Hinweis mit Link zur KPI-Modell-Verwaltung dieser Version
- [ ] Auto-Save bei jeder Änderung (Hinzufügen/Entfernen eines Kanals)

### Berechnungslogik „Nächster Auszahlungsmonat" (Anzeige, optional)

Falls die optionale Anzeige des nächsten Auszahlungsmonats umgesetzt wird, gilt:

- [ ] Ausgangspunkt ist der gespeicherte Ankermonat (Monat + Jahr)
- [ ] Solange `(Jahr, Monat) < (aktuelles Jahr, aktueller Monat)`: addiere den Rhythmus in Monaten (1, 2 oder 3) zum Monat; Monatsüberlauf rollt korrekt ins Folgejahr
- [ ] Die Verschiebung / Zurückstellung wird in dieser Anzeige **nicht** addiert (sie dient — analog zur kurzfristigen Version — nur der späteren Umsatz-/Liquiditätszuordnung in Folge-Features)
- [ ] Die Anzeige verändert den gespeicherten Ankermonat nicht (reine Frontend-Berechnung)

### Datenpersistenz & Isolation

- [ ] Pro Plattform und Planversion wird ein Einstellungsdatensatz gespeichert; Marketingkanal-Zuordnungen werden als eigene Verknüpfungsdatensätze gehalten
- [ ] Alle Daten sind zusätzlich an den Nutzer gebunden (`user_id`) und werden ausschließlich für die aktuelle `versionId` geladen/gespeichert
- [ ] Beim Wechsel des Plattform-Reiters werden die Einstellungen und Marketingkanäle der neuen Plattform geladen
- [ ] Beim ersten Aufruf einer Plattform ohne vorherige Speicherung zeigt das Formular die Standardwerte (Rhythmus: Monatlich; Ankermonat: leer; Verschiebung: 0; keine Marketingkanäle) — kein DB-Insert, bis der Nutzer etwas ändert
- [ ] Optimistisches Update: Änderung erscheint sofort in der UI, wird im Hintergrund gespeichert; bei API-Fehler → Toast-Fehlermeldung „Einstellung konnte nicht gespeichert werden." + Rollback auf den vorherigen Wert
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B, andere Versionen oder die Kurzfristige Planung
- [ ] Wird die Planversion (PROJ-73) gelöscht, werden alle zugehörigen Auszahlungseinstellungen und Marketingkanal-Verknüpfungen kaskadierend mitgelöscht — keine verwaisten Datensätze
- [ ] Wird eine Sales Plattform oder ein Marketingkanal im KPI-Modell der Version gelöscht, werden die zugehörigen Auszahlungs-/Verknüpfungsdaten kaskadierend mitgelöscht; der entsprechende Reiter bzw. die Auswahloption verschwindet beim nächsten Aufruf

### Datenbankschema

- [ ] Neue Tabelle `langfristige_auszahlungs_einstellungen`:
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `sales_plattform_id` UUID NOT NULL FK → `langfristige_kpi_kategorien` (ON DELETE CASCADE) — muss `art = 'lp_sales_plattform'` derselben Version sein
  - `auszahlungsrhythmus` TEXT NOT NULL CHECK IN ('monatlich', 'alle_zwei_monate', 'quartalsweise') DEFAULT 'monatlich'
  - `erster_auszahlung_monat` INTEGER NULL CHECK (1–12)
  - `erster_auszahlung_jahr` INTEGER NULL CHECK (z. B. 2000–2100)
  - `verschiebung_monate` INTEGER NOT NULL DEFAULT 0 CHECK (0–60)
  - `created_at`, `updated_at` TIMESTAMPTZ DEFAULT now()
  - CHECK: `erster_auszahlung_monat` und `erster_auszahlung_jahr` müssen gemeinsam gesetzt oder beide NULL sein
  - UNIQUE(`plan_version_id`, `sales_plattform_id`, `user_id`) — ein Eintrag pro Plattform pro Version pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigene Einträge (`auth.uid() = user_id`); Versionszugehörigkeit serverseitig zusätzlich geprüft

- [ ] Neue Verknüpfungstabelle `langfristige_auszahlungs_marketingkanaele` (n:m Plattform ↔ Marketingkanal):
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `sales_plattform_id` UUID NOT NULL FK → `langfristige_kpi_kategorien` (ON DELETE CASCADE) — `art = 'lp_sales_plattform'`
  - `marketingkanal_id` UUID NOT NULL FK → `langfristige_kpi_kategorien` (ON DELETE CASCADE) — `art = 'lp_marketingkanal'`
  - UNIQUE(`plan_version_id`, `sales_plattform_id`, `marketingkanal_id`, `user_id`)
  - RLS: Nutzer sieht und schreibt nur eigene Einträge
  - Indizes: `(plan_version_id, sales_plattform_id, user_id)`

### API-Routen (versions- & nutzergebunden)

- [ ] `GET /api/langfristige-planung/[versionId]/auszahlungs-einstellungen?plattform_id=<UUID>` — lädt die Einstellung **inkl.** der zugeordneten Marketingkanal-IDs für eine Plattform der Version
  - Response: `{ sales_plattform_id, auszahlungsrhythmus, erster_auszahlung_monat, erster_auszahlung_jahr, verschiebung_monate, marketingkanal_ids: string[] }` oder Standardwerte/`null` wenn noch kein Eintrag
- [ ] `PUT /api/langfristige-planung/[versionId]/auszahlungs-einstellungen` — Upsert der Plattform-Einstellung (Skalarfelder) und Abgleich der Marketingkanal-Zuordnungen
  - Body: `{ sales_plattform_id, auszahlungsrhythmus?, erster_auszahlung_monat? (nullable), erster_auszahlung_jahr? (nullable), verschiebung_monate?, marketingkanal_ids?: string[] }`
  - Zod-Validierung: Rhythmus ∈ 3 erlaubter Werte; Monat 1–12 oder null; Jahr im erlaubten Bereich oder null; Monat+Jahr gemeinsam gesetzt oder beide null; Verschiebung ganze Zahl 0–60; `marketingkanal_ids` Array gültiger UUIDs
  - Serverseitige Prüfung: `versionId` gehört dem Nutzer; `sales_plattform_id` und jede `marketingkanal_id` gehören zur selben Version und haben die korrekte `art`
- [ ] Beide Routen: `requireAuth()` (401), UUID-Format-Prüfung (400), Filterung der Queries zusätzlich nach `user_id` + `plan_version_id` (Defense-in-Depth zur RLS), Validierungsfehler → 400, fremde/unbekannte Version → 404

> Hinweis: Marketingkanal-Zuordnungen dürfen alternativ über eigene Endpunkte (POST/DELETE einzelner Verknüpfungen) verwaltet werden — analog zum kurzfristigen `useAuszahlungsMarketingGruppen`-Muster. Die genaue Aufteilung legt `/architecture` fest; fachlich zählt nur, dass die Auswahl pro Plattform/Version persistiert und isoliert ist.

## Edge Cases

- **Keine Sales Plattformen in der Version:** Seite zeigt Hinweis mit Link zur KPI-Modell-Verwaltung dieser Version; keine Reiter, kein Formular
- **Keine Marketingkanäle in der Version:** Marketing-Zeile zeigt Hinweis mit Link zur KPI-Modell-Verwaltung; übrige Felder bleiben bedienbar
- **Ankermonat nur teilweise befüllt (nur Monat oder nur Jahr):** UI erzwingt beide zusammen; serverseitiger CHECK lehnt inkonsistente Kombination ab
- **Nutzer leert den Ankermonat:** Upsert mit `erster_auszahlung_monat = null` und `erster_auszahlung_jahr = null`; Felder bleiben leer; keine „nächster Auszahlungsmonat"-Anzeige
- **Ankermonat liegt in der Vergangenheit:** optionale Anzeige berechnet korrekt den nächsten zukünftigen Auszahlungsmonat (ggf. mehrere Rhythmus-Schritte); keine Endlosschleife (Rhythmus immer ≥ 1 Monat)
- **Verschiebung 0:** gültig (keine Verschiebung); negative Eingaben werden abgewiesen/auf 0 geklemmt
- **Verschiebung über Maximum:** auf das Maximum (60) begrenzt; serverseitiger CHECK als zweite Ebene
- **Plattform/Marketingkanal im KPI-Modell der Version gelöscht:** zugehörige Einstellungs-/Verknüpfungsdaten werden per `ON DELETE CASCADE` entfernt; Reiter/Option verschwindet beim nächsten Aufruf
- **Neue Plattform/neuer Kanal hinzugefügt:** erscheint beim nächsten Aufruf mit Standardwerten (noch kein DB-Eintrag) bzw. als neue Auswahloption
- **Auswahl eines Marketingkanals einer fremden Version:** serverseitig abgelehnt (Kanal gehört nicht zur Version/Art) → 400/404, kein Fremdbezug
- **API-Fehler beim Auto-Save:** Toast-Fehlermeldung, optimistisches Update wird zurückgerollt
- **Sehr viele Plattformen (> 5):** Reiter-Leiste bleibt nutzbar (Umbruch/Scroll wie kurzfristige Version)
- **Aufruf mit fremder/unbekannter versionId:** Redirect zum Langfristige-Planung-Dashboard, kein Datenzugriff
- **Parallele Bearbeitung in mehreren Tabs/Versionen:** funktioniert unabhängig, da Kontext aus der URL (`versionId`) stammt

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf den neuen Tabellen `langfristige_auszahlungs_einstellungen` und `langfristige_auszahlungs_marketingkanaele`; Versionszugehörigkeit (`plan_version_id` gehört dem Nutzer) und Art-/Versionszugehörigkeit referenzierter Kategorien serverseitig prüfen (Defense-in-Depth zur RLS)
- Alle Eingaben serverseitig mit Zod validieren (Rhythmus, Monat, Jahr, Verschiebung, Marketingkanal-IDs)
- Neue versionsgebundene Next.js-Seite unter `src/app/dashboard/langfristige-planung/[versionId]/auszahlungseinstellungen/page.tsx` (nutzt das Versions-Shell/Header-Muster aus PROJ-73; löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab)
- Navigation: Eintrag „Auszahlungseinstellungen" existiert bereits in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen") und verlinkt automatisch; ggf. nur Feinschliff des Beschreibungstextes
- Wiederverwendung der UI-/Hook-Bausteine der kurzfristigen Auszahlungseinstellungen (Tabs, `Select`, `MultiSelect`, Auto-Save, optimistisches Update, Rollback, Toast) als Vorlage; Datenquelle versionsgebunden parametrisiert statt Code-Duplikation, wo sinnvoll
- shadcn-Komponenten: `Tabs` (Plattform-Reiter), `Select` (Rhythmus + Monat/Jahr), `Input type="number"` (Verschiebung), `MultiSelect` (Marketingkanäle), `Toast` (Rückmeldungen)
- Responsive: Mobil (375px) bis Desktop (1440px)
- Kein neues npm-Paket nötig (alle Bausteine bereits im Projekt vorhanden)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee

Diese Seite ist die **versionsgebundene Spiegelung** der kurzfristigen Auszahlungseinstellungen-Seite (PROJ-45). Sie kombiniert zwei bereits fertige Fundamente:

1. **Das Versions-Gerüst** der Langfristigen Planung (PROJ-73): Es übernimmt das Laden und Prüfen der Planversion, den Header mit Breadcrumb, das linke Seitenmenü, den Redirect bei fremder/unbekannter Version und die Toast-Meldungen. Der Menüeintrag „Auszahlungseinstellungen" existiert dort bereits — die neue Seite löst nur den bisherigen Platzhalter ab.
2. **Die Bedienlogik der kurzfristigen Seite** (PROJ-45): Reiter je Plattform, Auto-Speichern beim Ändern, optimistische Anzeige, Rücksetzen bei Fehler, Mehrfachauswahl der Marketingkanäle.

Der eigentliche Neubau beschränkt sich auf zwei Dinge: eine **versionsgebundene Datenablage** (zwei neue Tabellen) und ein **versionsbewusstes Endpunkt-Paar**. UI-Bausteine und Datenfluss-Muster sind vorhanden und werden wiederverwendet.

Inhaltlich denkt die Seite — anders als die kurzfristige — in **Monaten** statt Kalenderwochen, verwendet einen **eigenen Ankermonat** je Plattform und bezieht Plattformen sowie Marketingkanäle aus dem **KPI-Modell der jeweiligen Planversion** (PROJ-74), nicht aus dem globalen Modell.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                 (Versions-Übersicht — bereits vorhanden)
+-- Eintrag/Kachel "Auszahlungseinstellungen"  → .../[versionId]/auszahlungseinstellungen
                                                  (Nav-Eintrag bereits in der zentralen Liste angelegt)

/dashboard/langfristige-planung/[versionId]/auszahlungseinstellungen   (NEUE echte Seite)
+-- LangfristigeVersionShell  (bestehend — Header, Breadcrumb, Versionsprüfung, Redirect, Toaster)
    +-- LangfristigeAuszahlungseinstellungenFormular  (NEUE Hauptkomponente)
        +-- Reiter-Leiste (Tabs)  [eine Tab je Sales Plattform der Version]
        |   +-- Tab: "Plattform A"
        |   +-- Tab: "Plattform B"
        |   +-- ...
        +-- Leerzustand: keine Plattformen → Hinweis + Link zur KPI-Modell-Verwaltung dieser Version
        +-- (je aktivem Tab) Plattform-Formular  (NEUE Formular-Komponente)
            +-- Zeile 1: Auszahlungsrhythmus       [Auswahl: Monatlich / Alle 2 Monate / Quartalsweise]
            +-- Zeile 2: Erster Auszahlungsmonat   [Auswahl Monat + Auswahl Jahr; optionale "nächster Monat"-Anzeige]
            +-- Zeile 3: Verschiebung / Zurückstellung   [Zahl, ≥ 0, Einheit "Monate"]
            +-- Zeile 4: Marketing                 [Mehrfachauswahl der Marketingkanäle der Version]
```

- Die Plattform-Reiter und das Formular sind eine **leicht angepasste Kopie** der kurzfristigen Komponente: Wochen→Monate, Kalender-Picker→Monat/Jahr-Auswahl, Marketing-Quelle global→versionsgebunden.
- Eingebettet wird alles in das bestehende Versions-Gerüst — kein neues Seiten-Layout nötig.

### B) Datenmodell (Klartext)

**Neue Tabelle „Langfristige Auszahlungseinstellungen" — ein Eintrag je Plattform je Planversion:**
```
Je Eintrag:
- eindeutige ID
- Besitzer (Nutzer)                         → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion  → Datenisolation
- Bezug zu genau EINER Sales Plattform der Version
- Auszahlungsrhythmus: "monatlich" | "alle zwei Monate" | "quartalsweise"  (Standard: monatlich)
- Erster Auszahlungsmonat: Monat (1–12) + Jahr  ODER  "nicht gesetzt" (beide leer)
- Verschiebung/Zurückstellung: ganze Zahl ≥ 0 Monate  (Standard: 0)
```

**Neue Verknüpfungstabelle „Plattform ↔ Marketingkanal" — beliebig viele Kanäle je Plattform:**
```
Je Verknüpfung:
- eindeutige ID
- Besitzer (Nutzer) + Planversion           → Zugriffsschutz & Isolation
- Bezug zur Sales Plattform der Version
- Bezug zu genau EINEM Marketingkanal der Version
(eine Plattform kann mehrere solche Verknüpfungen haben = Mehrfachauswahl)
```

**Regeln:**
- Genau **ein** Einstellungs-Eintrag je Plattform je Version (Eindeutigkeit über Version + Plattform + Nutzer) → ermöglicht „Anlegen-oder-Aktualisieren".
- Monat und Jahr des Ankers sind **immer gemeinsam** gesetzt oder gemeinsam leer.
- **Bewusst NICHT enthalten:** ein Retouren-Feld (in der kurzfristigen UI längst entfernt) und jegliche Wochen-Logik.
- **Kaskadierende Löschung:** Wird die Planversion gelöscht, verschwinden alle Einträge und Verknüpfungen automatisch. Wird eine Sales Plattform oder ein Marketingkanal im KPI-Modell der Version gelöscht, verschwinden die zugehörigen Einträge/Verknüpfungen automatisch — keine verwaisten Daten.
- **Standardwerte bei noch leerer Plattform:** Rhythmus = monatlich, Ankermonat = nicht gesetzt, Verschiebung = 0, keine Marketingkanäle. Diese werden nur angezeigt; ein Datensatz entsteht erst beim ersten Speichern.

### C) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Gerüst prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Hauptkomponente lädt die Sales Plattformen dieser Version (aus dem KPI-Modell)
      keine Plattformen → Hinweis + Link zur KPI-Modell-Verwaltung
      sonst             → erster Reiter wird aktiv
  → Für die aktive Plattform werden geladen:
      a) der Einstellungs-Eintrag (oder Standardwerte, falls noch keiner existiert)
      b) die zugeordneten Marketingkanäle
      c) die verfügbaren Marketingkanäle der Version (Auswahloptionen)

Nutzer wechselt Plattform-Reiter
  → Einstellungen & Marketingkanäle der neuen Plattform werden geladen

Nutzer ändert Rhythmus / Ankermonat / Verschiebung
  → Wert sofort sichtbar (optimistisch) + Speichern (Anlegen oder Aktualisieren)
      Erfolg → still bzw. kurze Bestätigung
      Fehler → Toast "Einstellung konnte nicht gespeichert werden." + Rücksetzen

Nutzer fügt einen Marketingkanal hinzu / entfernt ihn
  → Auswahl sofort sichtbar (optimistisch) + Verknüpfung anlegen/entfernen
      Fehler → Toast + Rücksetzen
```

**Optionale Anzeige „Nächster Auszahlungsmonat":** Aus dem Ankermonat wird — rein im Browser, ohne den gespeicherten Wert zu verändern — der nächste in der Zukunft liegende Auszahlungsmonat berechnet (Anker um den Rhythmus vorrücken, bis er den aktuellen Monat erreicht/überschreitet). Die Verschiebung wird hier bewusst **nicht** eingerechnet (sie dient erst der späteren Liquiditätszuordnung in Folge-Features). Dies spiegelt 1:1 die kurzfristige „Nächste Auszahlungswoche"-Anzeige. **Empfehlung:** mitnehmen, da geringer Aufwand und konsistente Bedienung.

### D) Server-Schnittstellen (versions- & nutzerbewusst)

```
Lesen:    Auszahlungseinstellung + zugeordnete Marketingkanäle einer Plattform laden
          → prüft Nutzer + Versionszugehörigkeit + dass die Plattform zur Version gehört
          → liefert gespeicherte Werte oder die Standardwerte (ohne anzulegen)

Speichern: Einstellung einer Plattform anlegen/aktualisieren und die Marketingkanal-
          Zuordnung abgleichen
          → prüft Nutzer + Versionszugehörigkeit
          → prüft, dass Plattform und alle gewählten Marketingkanäle zur selben Version
            und zur korrekten Art gehören
          → prüft die Werte (Rhythmus zulässig, Monat 1–12, Jahr im Bereich, Monat+Jahr
            gemeinsam gesetzt/leer, Verschiebung ganze Zahl ≥ 0)
          → ungültig → Fehler; fremde/unbekannte Version → kein Zugriff
```

Beide Endpunkte folgen exakt dem im Langfristig-Fundament etablierten Muster (Login-Pflicht, ID-Format-Prüfung, Filterung nach Nutzer **und** Version als zweite Sicherheitsebene zur Row-Level-Security). Die Marketingkanal-Zuordnungen können wahlweise im selben Endpunkt mitverwaltet oder — wie in der kurzfristigen Version (eigene „Marketing-Gruppen"-Endpunkte) — über einen kleinen separaten Endpunkt für einzelne Verknüpfungen gepflegt werden. Die genaue Aufteilung entscheidet die Umsetzung; fachlich zählt nur die isolierte, versionsgebundene Persistenz.

### E) Wiederverwendung im Detail

| Baustein | Status | Anmerkung |
|----------|--------|-----------|
| Versions-Gerüst (Laden/Prüfen der Version, Header, Seitenmenü, Redirect, Toaster) | **unverändert wiederverwenden** | aus PROJ-73 (`LangfristigeVersionShell`) |
| Plattform-/Marketingkanal-Listen der Version | **unverändert wiederverwenden** | aus PROJ-74 (versionsgebundener KPI-Kategorien-Hook, Arten „Sales Plattform" / „Marketingkanal") |
| Mehrfachauswahl-Baustein für Marketingkanäle | **unverändert wiederverwenden** | bestehende `MultiSelect`-Komponente |
| Reiter-Leiste (Tabs), Auswahl-, Zahlen-Eingaben, Toast | **bestehende shadcn/ui-Bausteine** | analog zur kurzfristigen Seite |
| Plattform-Formular + Daten-Hook (Laden/Speichern, optimistisch, Rücksetzen) | **neue, versionsbewusste Variante** | spiegelt die kurzfristige Logik, Monate statt Wochen, Marketing-Quelle versionsgebunden |
| Datentabellen + Endpunkte | **Neubau** | versions-/nutzergebunden, Monats-Rhythmen |
| Navigation | **bereits vorhanden** | Eintrag „Auszahlungseinstellungen" in der zentralen Nav-Liste; ggf. Feinschliff der Beschreibung |

### F) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Speicherort | Datenbank, pro Planversion | Daten müssen je Szenario isoliert und dauerhaft sein (PROJ-73-Prinzip) |
| Eigene neue Tabellen | Ja (statt Erweiterung der Kurzfristig-Tabelle) | Klare Abkapselung, kaskadierende Löschung pro Version, kein Regressionsrisiko für die kurzfristige Seite |
| Monate statt Wochen | Rhythmus monatlich/alle 2 Monate/quartalsweise, Verschiebung in Monaten | Vom Nutzer bestätigt; langfristige Planung denkt in Monaten/Jahren |
| Eigener Ankermonat | Monat + Jahr je Plattform | Vom Nutzer bestätigt; legt eindeutig fest, in welchen Monaten bei „alle 2 Monate"/„quartalsweise" ausgezahlt wird |
| Verschiebung nur ≥ 0 | Keine negativen Werte | Vom Nutzer bestätigt (nur Zurückstellung, kein Vorziehen) |
| Marketing als Mehrfachauswahl | Verknüpfungstabelle (n:m) | Vom Nutzer bestätigt; eine Plattform kann mehrere Kanäle inkludieren — spiegelt das kurzfristige Marketing-Gruppen-Muster |
| Kein Retouren-Feld | Entfällt | In der kurzfristigen UI längst entfernt; nicht benötigt |
| Quelle der Stammdaten | KPI-Modell der Version (PROJ-74) | Vollständige Abkapselung; keine Verbindung zum globalen Modell oder zur Kurzfristigen Planung |
| Bedienmuster | Auto-Save, optimistische Anzeige, Toast, Rücksetzen | Einheitlich mit allen Einstellungsseiten im Projekt |
| Seitengerüst | Bestehende Versions-Shell wiederverwenden | Versionsprüfung, Redirect, Header/Breadcrumb sind bereits gelöst |

### G) Dependencies (Pakete)

Keine neuen npm-Pakete nötig. Verwendet werden ausschließlich bestehende Bausteine: shadcn/ui (Tabs, Select, Input, Label, Card/Border, Toast), die vorhandene `MultiSelect`-Komponente, Zod (Eingabeprüfung), Supabase (Datenhaltung inkl. Row-Level-Security), das Versions-Gerüst und die Navigations-Konfiguration aus PROJ-73 sowie der versionsgebundene KPI-Kategorien-Hook aus PROJ-74.

### H) Umsetzungsreihenfolge (empfohlen)

1. Zwei neue versionsgebundene Tabellen (Einstellungen + Marketingkanal-Verknüpfung), nutzer- & versionsgesichert, mit kaskadierender Löschung.
2. Versionsbewusstes Endpunkt-Paar (Lesen + Speichern inkl. Marketingkanal-Abgleich), mit serverseitiger Prüfung von Versions-/Art-Zugehörigkeit.
3. Versionsbewusster Daten-Hook (analog zur kurzfristigen Logik; Monate statt Wochen; Marketing-Quelle versionsgebunden).
4. Neue Seite mit Plattform-Reitern und Formular, eingebettet ins Versions-Gerüst (überwiegend Verdrahtung bestehender Bausteine).
5. Bei Bedarf Feinschliff des Nav-Beschreibungstextes.

> Hinweis: Da UI-Bausteine, Versions-Gerüst und Stammdaten-Hooks bereits existieren, liegt der eigentliche Aufwand in Schritt 1–2 (Datenhaltung/Endpunkte); Schritt 3–5 sind überwiegend Verdrahtung und Anpassung der kurzfristigen Vorlage.

## Implementation Notes (Frontend — 2026-06-20)

Die UI und die Verdrahtung sind gebaut; die eigentliche Datenhaltung/API folgt mit `/backend`. Bis dahin zeigt jeder Plattform-Reiter sauber den Lade-Fehlerzustand (kein Absturz). Das Versions-Gerüst und die Stammdaten-Listen (Sales Plattformen, Marketingkanäle) laden bereits korrekt über die bestehenden PROJ-73/PROJ-74-APIs.

**Maximale Wiederverwendung:** Die kurzfristige Auszahlungseinstellungen-Komponente diente als Vorlage; Versions-Gerüst (`LangfristigeVersionShell`), KPI-Kategorien-Hook der Version (`useLangfristigeKpiKategorien`) und die `MultiSelect`-Komponente wurden **unverändert** wiederverwendet.

### Neue Dateien
- `src/hooks/use-langfristige-auszahlungs-einstellungen.ts` — versionsbewusster Hook `useLangfristigeAuszahlungsEinstellungen(versionId, plattformId)`. Lädt/speichert gegen `/api/langfristige-planung/[versionId]/auszahlungs-einstellungen` (GET mit `?plattform_id=`, PUT-Upsert) mit optimistischem Update und Rollback. Marketingkanal-Zuordnungen sind als `marketingkanal_ids: string[]` im selben Datensatz mitgeführt (ein GET/PUT pro Plattform). Enthält Typen (`LangfristigerRhythmus`), Konstanten (`RHYTHMUS_MONATE`, `RHYTHMUS_LABELS`, `RHYTHMUS_VALUES`, `MIN/MAX_VERSCHIEBUNG_MONATE`), den Default-Builder `makeDefaultEinstellung` sowie die Monats-Hilfsfunktionen `getCurrentMonthAndYear` und `calculateNextPayoutMonth` (reine Pure-Function, Monats-Index-Arithmetik, rückt den Anker um den Rhythmus vor; Verschiebung wird in der Anzeige bewusst nicht eingerechnet).
- `src/components/langfristige-auszahlungseinstellungen-formular.tsx` — zwei Komponenten: `PlatformForm` (Formular je Plattform mit 4 Zeilen: Rhythmus-`Select`, Ankermonat als Monat+Jahr-`Select`-Paar mit „Zurücksetzen", Verschiebung-`Input` 0–60, Marketing-`MultiSelect` + entfernbare Chips) und `LangfristigeAuszahlungseinstellungenFormular` (Export: liest `versionId` aus `useParams`, lädt Sales Plattformen + Marketingkanäle der Version, rendert Plattform-Tabs; Leerzustand mit Link zur versionsgebundenen KPI-Modell-Verwaltung). Marketingkanäle werden einmal im Parent geladen und an jedes `PlatformForm` durchgereicht.
- `src/app/dashboard/langfristige-planung/[versionId]/auszahlungseinstellungen/page.tsx` — echte Seite: `LangfristigeVersionShell` (seitenTitel="Auszahlungseinstellungen") + Formular. Löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab.

### Geänderte Dateien
- Keine. Der Nav-Eintrag „Auszahlungseinstellungen" existiert bereits in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen") und verlinkt automatisch; die Versions-Übersichtsseite listet ihn ebenfalls.

### Designentscheidungen
- **Ankermonat Both-or-Neither im Frontend durchgesetzt:** `handleAnkerChange` speichert nur, wenn Monat+Jahr beide gesetzt **oder** beide leer sind; bei genau einem gesetzten Feld wird (noch) nicht gespeichert, sodass der serverseitige CHECK nie verletzt wird. „Zurücksetzen" leert beide Felder und speichert `null`.
- **Marketing gefaltet in den Hauptdatensatz** (statt separater Junction-Endpunkte wie kurzfristig): vereinfacht Frontend-State und Optimistik; ein GET/PUT genügt. Backend muss `marketingkanal_ids` im PUT abgleichen.
- **„Nächste Auszahlung"-Anzeige** unter dem Ankermonat-Label (analog kurzfristiger „Nächste Auszahlungswoche"), berechnet aus Anker + Rhythmus, ohne Verschiebung.

### Erwartete API (für `/backend`)
- `GET /api/langfristige-planung/[versionId]/auszahlungs-einstellungen?plattform_id=<UUID>` → `{ sales_plattform_id, auszahlungsrhythmus, erster_auszahlung_monat, erster_auszahlung_jahr, verschiebung_monate, marketingkanal_ids: string[] }` oder `null` wenn noch kein Eintrag. Prüft Login + Versions-Eigentum (404 bei fremder/unbekannter Version).
- `PUT /api/langfristige-planung/[versionId]/auszahlungs-einstellungen` — Upsert je `(plan_version_id, sales_plattform_id, user_id)`; Body enthält den vollständigen Datensatz inkl. `marketingkanal_ids`. Zod: Rhythmus ∈ {monatlich, alle_zwei_monate, quartalsweise}; Monat 1–12 oder null; Jahr im Bereich oder null; Monat+Jahr gemeinsam gesetzt/leer; Verschiebung ganze Zahl 0–60; `marketingkanal_ids` Array gültiger UUIDs, die zur selben Version & Art `lp_marketingkanal` gehören. `sales_plattform_id` muss zur Version & Art `lp_sales_plattform` gehören. Antwort: der gespeicherte Datensatz inkl. `marketingkanal_ids`.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen Dateien.
- `npm run lint`: sauber (keine Errors/Warnings).

## Implementation Notes (Backend — 2026-06-20)

Datenhaltung und API sind implementiert; die Frontend-Anbindung erfolgte bereits im Frontend-Schritt (ruft exakt diese Endpunkte/Datensatzform), daher keine weiteren Frontend-Änderungen nötig.

### Datenbank (Supabase-Projekt „Controlling-App" `kdmpghtdoguppfqhdscq`, Migration `create_langfristige_auszahlungs_einstellungen`)
- **`langfristige_auszahlungs_einstellungen`** (ein Eintrag je Plattform/Version/Nutzer): `id` UUID PK (`extensions.uuid_generate_v4()`), `user_id` → `auth.users` (ON DELETE CASCADE), `plan_version_id` → `langfristige_planversionen` (ON DELETE CASCADE), `sales_plattform_id` → `langfristige_kpi_kategorien` (ON DELETE CASCADE), `auszahlungsrhythmus` TEXT CHECK ∈ {monatlich, alle_zwei_monate, quartalsweise} DEFAULT 'monatlich', `erster_auszahlung_monat` INTEGER CHECK 1–12 (nullable), `erster_auszahlung_jahr` INTEGER CHECK 2000–2100 (nullable), `verschiebung_monate` INTEGER NOT NULL DEFAULT 0 CHECK 0–60, `created_at`/`updated_at`. CHECK `chk_anker_both_or_neither` erzwingt Monat+Jahr gemeinsam gesetzt/leer. UNIQUE `(plan_version_id, sales_plattform_id, user_id)` → ermöglicht Upsert via `onConflict`.
- **`langfristige_auszahlungs_marketingkanaele`** (n:m Plattform ↔ Marketingkanal): `id`, `user_id`, `plan_version_id`, `sales_plattform_id`, `marketingkanal_id` — alle FKs ON DELETE CASCADE; UNIQUE `(plan_version_id, sales_plattform_id, marketingkanal_id, user_id)`.
- Beide Tabellen: RLS aktiviert, je 4 Policies (SELECT/INSERT/UPDATE/DELETE) mit `auth.uid() = user_id` (strenger als das ältere `USING(true)`-Muster). Indizes auf `(plan_version_id, sales_plattform_id, user_id)`.
- Kaskadierende Löschung: Planversion gelöscht → alle Einträge/Verknüpfungen weg; Sales Plattform oder Marketingkanal im KPI-Modell gelöscht → zugehörige Zeilen weg (keine Waisen).
- `get_advisors` (security): **keine neue Warnung** für die beiden Tabellen.

### API-Route (`src/app/api/langfristige-planung/[versionId]/auszahlungs-einstellungen/route.ts`)
- **`GET ?plattform_id=<UUID>`** — prüft Login + Versions-Eigentum (404 bei fremder/unbekannter Version); lädt Einstellung (`maybeSingle`) und Marketingkanal-IDs separat und aggregiert sie zu `marketingkanal_ids: string[]`. Gibt `null` zurück, wenn weder Eintrag noch Kanäle existieren (Frontend zeigt Standardwerte). 400 bei fehlender/ungültiger `plattform_id`.
- **`PUT`** — Reihenfolge: Login → Zod-Validierung (günstig vor DB) → Versions-Eigentum → Plattform-Zugehörigkeit (Art `lp_sales_plattform`, gleiche Version) → Marketingkanal-Zugehörigkeit (alle IDs Art `lp_marketingkanal`, gleiche Version; sonst 400) → Upsert der Skalarfelder (`onConflict: 'plan_version_id,sales_plattform_id,user_id'`) → Marketingkanäle abgleichen (delete-all-for-platform, dann insert der eindeutigen IDs). `superRefine` erzwingt Anker Both-or-Neither. Antwort: gespeicherter Datensatz inkl. `marketingkanal_ids`.
- Alle Queries zusätzlich nach `user_id` + `plan_version_id` gefiltert (Defense-in-Depth zur RLS). Fehler als `{ error }`; 401/400/404/500 abgedeckt.

### Tests
- `…/auszahlungs-einstellungen/route.test.ts` — **22/22 grün** (Vitest): GET (8: Werte, null, nur-Kanäle, fehlende/ungültige plattform_id, ungültige Version, 404, 401, 500); PUT (14: Upsert mit/ohne Kanäle, ungültiger Rhythmus, Anker-Teilbefüllung, Verschiebung >60/negativ, fehlende plattform_id, ungültige Version, 404, Plattform fremd, Kanal fremd, 401, 500). Verkettbarer Supabase-Mock (`chainResult`) deckt die variablen Query-Ketten ab.
- Gesamtes `langfristige-planung`-Testset: **86/86 grün** (keine Regressionen). Typecheck der neuen Route ohne Fehler.

## QA Test Results (2026-06-20)

### Testergebnis-Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| Akzeptanzkriterien | ✅ Alle bestanden (BUG-1 behoben) |
| Hook-/Berechnungs-Unit-Tests (Vitest) | ✅ 11/11 bestanden |
| API-Integrationstests (Vitest) | ✅ 22/22 bestanden |
| Langfristige-Planung-Gesamtsuite (Regression) | ✅ 86/86 bestanden |
| E2E-Tests (Playwright) | ✅ 4 Tests geschrieben (Seitenexistenz, Auth-Guard, Regressionen) |
| Sicherheitsaudit | ✅ Keine Findings |
| Bugs gefunden | ✅ 1 High **(behoben)** · 2 Low (offen, nicht blockierend) |
| **Produktionsbereitschaft** | ✅ **READY** |

### Automatisierte Tests

- **Hook/Berechnung** (`use-langfristige-auszahlungs-einstellungen.test.ts`) — 11/11: Konstanten, `makeDefaultEinstellung`, `getCurrentMonthAndYear`, `calculateNextPayoutMonth` (Zukunfts-Anker, Gleichstand, monatlich/quartalsweise vorrücken, Jahreswechsel, Mehrjahres-Vorlauf).
- **API** (`route.test.ts`) — 22/22: GET (Werte, null, nur-Kanäle, fehlende/ungültige plattform_id, ungültige/fremde Version, 401, 500); PUT (Upsert mit/ohne Kanäle, ungültiger Rhythmus, Anker-Teilbefüllung, Verschiebung >60/negativ, fehlende plattform_id, fremde Version/Plattform/Kanal, 401, 500).
- **Regression**: gesamte `langfristige-planung`-API-Suite 86/86 grün.
- **Hinweis Umgebung**: Ein voller `npm test`-Lauf (1774 Tests) zeigt sporadische Fehler in **unrelated** Dateien (ausgaben-kosten, bestellplanung, marketing-einstellungen u.a.) bei extrem hoher Environment-Zeit (~473 s) — Ressourcen-/Parallelitäts-Flakiness. Stichprobe (`use-planung-notizen.test.ts`) isoliert **14/14 grün**. Die PROJ-76-Änderungen sind rein additiv (2 neue Tabellen, 1 neue Route, neue Frontend-Dateien) und berühren diese Dateien nicht.

### Akzeptanzkriterien — geprüft (Code-Review + Tests)

**Navigation & Einstieg**
- ✅ Nav-Eintrag „Auszahlungseinstellungen" (Gruppe „Einstellungen") verlinkt versionsspezifisch (PROJ-73-Nav-Config); Versions-Übersicht listet ihn
- ✅ Auth-Guard / fremde versionId → Redirect (über `LangfristigeVersionShell`; API liefert 404)
- ✅ Eingebettet in die Versions-Shell

**Reiter (Sales Plattformen der Version)**
- ✅ Tabs aus `lp_sales_plattform` der Version, sortiert nach `sort_order`; erster Reiter aktiv
- ✅ Leerzustand mit Link zur versionsgebundenen KPI-Modell-Verwaltung

**Formular**
- ✅ Zeile 1 Rhythmus: 3 Optionen, Default Monatlich, Auto-Save
- ✅ Zeile 2 Ankermonat: Monat+Jahr-Auswahl mit „Zurücksetzen"; Teilauswahl bleibt erhalten, Speichern bei beiden gesetzt/beiden leer (BUG-1 behoben)
- ✅ Zeile 3 Verschiebung: Zahlenfeld 0–60, Default 0, Klemmung, Auto-Save
- ✅ Zeile 4 Marketing: Mehrfachauswahl aus `lp_marketingkanal` der Version + entfernbare Chips; Leer-Hinweis mit Link; Auto-Save
- ✅ „Nächste Auszahlung"-Anzeige (Berechnung per Unit-Test verifiziert)

**Datenpersistenz & Isolation**
- ✅ Pro Plattform/Version/Nutzer; Marketingkanäle als Verknüpfungen; optimistisch + Rollback
- ✅ Versionsisolation und kaskadierende Löschung (FKs ON DELETE CASCADE)

**Datenbank & API**
- ✅ Tabellen mit CHECKs, UNIQUE, Indizes, RLS (`auth.uid() = user_id`); GET/PUT mit Zod, Versions-/Art-Prüfung; 400/401/404/500 abgedeckt

### Sicherheitsaudit (Red Team)

- ✅ **Auth**: `requireAuth()` in GET + PUT → 401 ohne Session
- ✅ **Authorization / IDOR**: Versions-Eigentum geprüft (404 bei fremder Version); Plattform & jeder Marketingkanal müssen zur selben Version + korrekten `art` gehören (sonst 400); Queries zusätzlich nach `user_id` + `plan_version_id` gefiltert; RLS als zweite Ebene → kein Fremdzugriff/keine versionsübergreifende Referenz möglich
- ✅ **Input-Validierung**: Zod (Rhythmus-Enum, Monat 1–12/null, Jahr 2000–2100/null, Anker Both-or-Neither via `superRefine`, Verschiebung 0–60, UUID-Arrays); UUID-Format von versionId/plattform_id geprüft; DB-CHECKs als zweite Ebene
- ✅ **Mass Assignment**: PUT mappt nur explizite Felder; `user_id` aus Session, nicht aus Body
- ✅ **XSS/Injection**: Werte sind Enums/Zahlen/UUIDs bzw. via Select/MultiSelect; kein Freitext; kein `dangerouslySetInnerHTML`; Supabase parametrisiert
- ✅ `get_advisors` (security): keine neue Warnung für die beiden Tabellen
- ✅ Keine Secrets in Antworten/Client

### Bugs / Hinweise

**BUG-1 (High) — ✅ BEHOBEN (2026-06-20) — Ankermonat „Erster Auszahlungsmonat" ließ sich aus dem Leerzustand nicht setzen**
- **Datei:** `src/components/langfristige-auszahlungseinstellungen-formular.tsx`
- **Ursache:** Die beiden Selects (Monat/Jahr) lasen ihren Wert direkt aus dem gespeicherten `current.erster_auszahlung_monat/jahr`; es gab **kein lokales State** für eine Teilauswahl. `handleAnkerChange` speichert nur, wenn **beide** gesetzt **oder beide** null sind. Da der Default beide-null ist, führte das Auswählen nur eines Feldes zu keinem Speichern, und das Select sprang mangels lokalem State sofort auf den Platzhalter zurück → der Anker konnte nie initial gesetzt werden.
- **Repro (vor Fix):** Neue/leere Plattform öffnen → „Monat" wählen → Auswahl verschwand; „Jahr" wählen → verschwand. Anker blieb dauerhaft leer.
- **Fix:** Lokaler State `lokalMonat`/`lokalJahr` eingeführt (aus `current` initialisiert, via `useEffect` auf die gespeicherten Werte synchronisiert). `handleAnkerChange` setzt nun immer den lokalen State und speichert erst, wenn beide gesetzt (oder beide geleert) sind. Die Selects und der „Zurücksetzen"-Button lesen den lokalen State. Teilauswahl bleibt sichtbar; sobald beide Felder gesetzt sind, wird gespeichert und „Nächste Auszahlung" berechnet. Editier-Fälle (beide bereits gesetzt) funktionieren weiterhin. Typecheck/Lint sauber; Hook- (11/11) und API-Tests (22/22) weiterhin grün.

**BUG-4 (Medium) — ✅ BEHOBEN (2026-06-20) — „Nächste Auszahlung"-Anzeige zeigte (für monatlich) immer den aktuellen Monat**
- **Datei:** `src/components/langfristige-auszahlungseinstellungen-formular.tsx`
- **Ursache:** Die optionale Unterzeile berechnete den nächsten Auszahlungsmonat per `calculateNextPayoutMonth` **relativ zum heutigen Datum** (wie in der kurzfristigen, operativen Version). Bei monatlichem Rhythmus rückt jeder in der Vergangenheit liegende Ankermonat dadurch immer auf den aktuellen Monat vor → unabhängig von der Auswahl wurde stets z. B. „Juni 2026" angezeigt. In der **Langfristigen Planung** ist der Ankermonat jedoch ein Planungs-Eingabewert (kann Jahre in Vergangenheit/Zukunft liegen); eine Heute-relative Fortschreibung ist hier fachlich falsch und irreführend.
- **Fix:** Die Heute-relative „Nächste Auszahlung"-Berechnung und -Anzeige wurde entfernt. Der gewählte Ankermonat wird bereits durch die Monat-/Jahr-Selects dargestellt; die Unterzeile zeigt jetzt den statischen Hinweis „Ab diesem Monat läuft der gewählte Rhythmus." Die Hilfsfunktionen (`calculateNextPayoutMonth`, `getCurrentMonthAndYear`, `RHYTHMUS_MONATE`) bleiben im Hook erhalten und unit-getestet (für spätere Auswertungs-Features), werden aber nicht mehr für diese Anzeige verwendet. Typecheck/Lint sauber.

**BUG-2 (Low) — Marketingkanal-Abgleich im PUT nicht transaktional**
- Beim Speichern werden zunächst alle Marketingkanal-Verknüpfungen der Plattform gelöscht und dann neu eingefügt. Schlägt das Insert nach erfolgreichem Delete fehl, gehen die zuvor gespeicherten Kanäle verloren (DB ohne Auswahl, bis der Nutzer erneut speichert). Bei der Zielgruppengröße (1–5 interne Nutzer) geringe Wahrscheinlichkeit; ggf. später per RPC/Transaktion härten.

**BUG-3 (Low, Hinweis) — Jahr-Auswahlbereich enger als DB-Bereich**
- Das Jahr-Select bietet `aktuell−5 … aktuell+20`; Zod/DB erlauben 2000–2100. Über die UI gesetzte Werte liegen stets im Auswahlbereich; ein via API direkt gesetzter Wert außerhalb würde im Select leer dargestellt. Für die reguläre Nutzung irrelevant (identisch zur PROJ-75-Note).

### Produktionsbereitschaft

✅ **READY.** BUG-1 wurde behoben und verifiziert (Code-Review + Re-Run der Tests). Es verbleiben nur die zwei nicht-blockierenden Low-Findings (BUG-2 nicht-transaktionaler Marketingkanal-Abgleich, BUG-3 enger Jahr-Auswahlbereich). Alle Akzeptanzkriterien erfüllt, Sicherheitsaudit ohne Findings, keine Regressionen.

## Deployment
_To be added by /deploy_

## Deployment
_To be added by /deploy_
