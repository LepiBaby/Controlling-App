# PROJ-89: Einnahmenplanung — Langfristige Planung

## Status: Planned
**Created:** 2026-06-22
**Last Updated:** 2026-06-22

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- Requires: PROJ-2 (KPI-Modell Verwaltung — global) — liefert die **Einnahmen-Kategorien** mit Untergruppen (`kpi_categories`, `type = 'einnahmen'`) als Zeilenquelle, **inklusive „Produktverkäufe"**. Hinweis: Das langfristige KPI-Modell (PROJ-74) hat **keinen** Einnahmen-Reiter; die Einnahmen-Kategorien werden — wie in der Kurzfristplanung (PROJ-52) — **global** gelesen.
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert die **Sales-Plattformen** der Version (`langfristige_kpi_kategorien`, `art = 'lp_sales_plattform'`) für die Produktverkäufe-Aufschlüsselung „pro Sales Channel"
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`) und den **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monatsfenster
- Requires: PROJ-76 (Auszahlungseinstellungen — Langfristige Planung) — liefert je Plattform **Auszahlungsrhythmus** (monatlich / alle 2 Monate / quartalsweise), **Ankermonat** (`erster_auszahlung_monat`/`erster_auszahlung_jahr`), **Verschiebung in Monaten** (`verschiebung_monate`) und die **zugeordneten Marketingkanäle** (`langfristige_auszahlungs_marketingkanaele`) — Grundlage der Zahlungszeitpunkt-Berechnung der Produktverkäufe
- Requires: PROJ-87 (Sales-Plattform-Planung — Langfristige Planung) — liefert je (Sales-Plattform, Produkt, Monat) den berechneten **Nettoerlös** (Bruttoumsatz − Rabatte − Rückerstattungen − Verkaufsgebühr − Retourenkosten) und die je Marketingkanal berechneten **Marketingkosten** dieser Version als Eingangsgröße für die Produktverkäufe-Auszahlung
- Requires: PROJ-84 (Absatzplanung — Langfristige Planung) — liefert den Monatsfenster-Helfer (`buildPlanungsmonate`) und die versionsgebundene Notiz-Tabelle (`langfristige_planung_notizen`)
- Integriert: PROJ-40 (Betragsselektion) — Hover/Klick-Summenpanel
- Integriert: PROJ-53-Muster (Zellen-Notizen) — versionsgebunden über `langfristige_planung_notizen`
- Vorlage (kein harter Require): PROJ-52 (Einnahmenplanung — Kurzfristige Planung) — UI, Bedienung und die Produktverkäufe-Zahlungszeitpunkt-Logik werden gespiegelt, mit den unten beschriebenen Abweichungen (Monate statt KW, versionsgebunden, keine Ist-Schicht)

## Übersicht

Die Seite „Einnahmenplanung" ist eine weitere Planungsseite im Navigationsbereich **„Planung"** der Langfristigen Planung (neben Absatzplanung, Marketing-Planung, Bestellplanung und Sales-Plattform-Planung). Sie spiegelt die **Einnahmenseite der Kurzfristplanung** (PROJ-52) — im Kern wird alles genauso bedient und berechnet, nur dass durchgehend die Einstellungen **dieser Planversion** zum Einsatz kommen und die Zeitachse **monatsweise** statt wochenweise ist.

Die Tabelle zeigt eine **monatsbasierte** Übersicht aller Einnahmen-Kategorien als Zeilen:

- **Spalten = Monate**, beginnend mit dem in den Grundeinstellungen hinterlegten **Startmonat**, über den **allgemeinen Planungshorizont in Monaten** (Fallback 12). Es gibt **keine** Vorlauf-Monate und **keine** Ist-/Vergangenheitsspalten — die Langfristige Planung kennt **keine Transaktionen**.
- **Zeilen = Einnahmen-Kategorien** aus dem **globalen** KPI-Modell (`type = 'einnahmen'`) mit ihren Untergruppen, **inklusive „Produktverkäufe"**, sortiert nach `sort_order`.

Die Zeile **„Produktverkäufe"** wird **pro Sales Channel** automatisch vorberechnet — wie in der Kurzfristplanung — aus den Daten der **langfristigen Sales-Plattform-Planung** (PROJ-87) und den **Auszahlungseinstellungen dieser Version** (PROJ-76): Der Nettoerlös je Plattform wird gemäß **Auszahlungsrhythmus, Ankermonat und Verschiebung (Monate)** in den jeweiligen **Auszahlungsmonat** verschoben (Liquiditätssicht). Ist der Plattform in den Auszahlungseinstellungen ein Marketingkanal zugeordnet, werden dessen Marketingkosten abgezogen.

**Alle anderen Kategorien** werden standardmäßig **leer** angezeigt und sind manuell editierbar (Soll-Eingabe).

Automatisch berechnete Produktverkäufe-Werte zeigen einen **grauen Punkt**, manuell überschriebene einen **blauen Punkt**. Manuelle Eingaben in allen Kategorien werden **pro Planversion** isoliert gespeichert (Datenisolation gemäß PROJ-73). Eine neu angelegte Version startet komplett leer (keine manuellen Überschreibungen); Änderungen in Version A haben keine Auswirkung auf Version B oder die Kurzfristige Planung.

## User Stories

- Als Controller möchte ich innerhalb einer geöffneten Planversion über die Navigationsgruppe „Planung" die Seite „Einnahmenplanung" aufrufen können, damit ich die geplanten Einnahmen dieses Szenarios je Monat sehe.
- Als Controller möchte ich die Spalten monatsweise ab dem Startmonat dieser Version über den allgemeinen Planungshorizont sehen, damit der Planungszeitraum klar abgegrenzt ist.
- Als Controller möchte ich alle Einnahmen-Kategorien des KPI-Modells mit ihren Untergruppen als Zeilen sehen, damit ich die vollständige Einnahmenstruktur abbilde.
- Als Controller möchte ich, dass die Zeile „Produktverkäufe" pro Sales Channel automatisch aus der Sales-Plattform-Planung und den Auszahlungseinstellungen dieser Version vorberechnet wird (Zahlungszeitpunkt), damit ich Einnahmen nicht manuell schätzen muss.
- Als Controller möchte ich jeden vorberechneten Produktverkäufe-Wert manuell überschreiben können und auf einen Blick erkennen, ob ein Wert automatisch berechnet (grauer Punkt) oder manuell eingegeben (blauer Punkt) wurde.
- Als Controller möchte ich für alle anderen Kategorien standardmäßig leere, manuell editierbare Zellen haben, damit ich eigene Einnahmen-Annahmen je Monat eintragen kann.
- Als Controller möchte ich alle Kategoriegruppen auf- und zuklappen und mit je einem Button alle auf einmal ein- oder ausklappen können.
- Als Controller möchte ich zu einzelnen Zellen Notizen hinterlegen können, versionsgebunden.
- Als Controller möchte ich mehrere Zellen selektieren (Klick/Ctrl+Klick) und deren Summe rechts unten sehen (Betragsselektion).
- Als Controller möchte ich eine einzelne manuell überschriebene Produktverkäufe-Zelle wieder auf den berechneten Wert zurücksetzen können.
- Als Controller möchte ich mit einem globalen „Zurücksetzen"-Button alle manuellen Werte und zugehörigen Notizen dieser Version löschen, sodass Produktverkäufe wieder automatisch berechnet und alle anderen Felder leer angezeigt werden.
- Als Controller möchte ich, dass meine Eingaben pro Planversion gespeichert werden und andere Versionen nicht beeinflussen.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] In der versionsspezifischen Navigation (`src/lib/langfristige-planung-nav.ts`) erscheint in der Gruppe **„Planung"** der Eintrag „Einnahmenplanung" → `/dashboard/langfristige-planung/[versionId]/einnahmenplanung`
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint in der Gruppe „Planung" eine Kachel/ein Eintrag „Einnahmenplanung"
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Aufruf mit unbekannter/fremder/ungültiger `versionId` → sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) über `LangfristigeVersionShell`

### Monatsspalten

- [ ] Die Spalten sind **Monate** (nicht Kalenderwochen)
- [ ] **Erste Spalte** = Startmonat (`startmonat_monat`/`startmonat_jahr` aus `langfristige_grundeinstellungen`); **keine** Vorlauf-Monate vor dem Startmonat
- [ ] **Letzte Spalte** = Startmonat + (`Planungshorizont Allgemein` − 1) Monate; **Planungshorizont Allgemein** = `planungshorizont_monate`, Fallback 12
- [ ] Gesamtzahl der Monatsspalten = `Planungshorizont Allgemein`
- [ ] Es gibt **keine** Ist-/Vergangenheitsspalten (die Langfristige Planung kennt keine Transaktionen)
- [ ] Spaltenüberschriften zeigen Monat + Jahr (Format z. B. „Apr. 2026")
- [ ] Korrekte Berechnung über Jahresgrenzen hinweg (Wiederverwendung von `buildPlanungsmonate` aus PROJ-84, mit allgemeinem Horizont parametriert)
- [ ] Die Tabelle ist horizontal scrollbar; die erste Spalte (Zeilenbeschriftung) ist beim Scrollen sticky (links fixiert)

### Zeilenhierarchie

- [ ] **Zeilenquelle**: alle Einnahmen-Kategorien aus dem **globalen** KPI-Modell (`kpi_categories`, `type = 'einnahmen'`), **inklusive „Produktverkäufe"**, sortiert nach `sort_order`
- [ ] **Pro Level-1-Kategorie**: einklappbare Sektion (Standard: ausgeklappt):
  - Kategorie-Header-Zeile mit Name + Auf-/Zuklapp-Icon
  - Wenn Sub-Kategorien (L2) vorhanden:
    - Aggregations-Zeile (Summe der Sub-Kategorien), nicht editierbar
    - Pro Level-2-Sub-Kategorie: editierbare Zeile (eingerückt)
  - Wenn keine Sub-Kategorien:
    - Level-1 selbst ist editierbar (Leaf)
- [ ] **Produktverkäufe** wird — analog zur Kurzfristplanung — **pro Sales Channel** aufgeschlüsselt: Hat „Produktverkäufe" im KPI-Modell keine L2-Unterkategorien, erscheint **je Sales-Plattform der Version** (`lp_sales_plattform`) eine Unterzeile (`kategorieId = sales_plattform.id`); die Produktverkäufe-Kopfzeile aggregiert diese Plattform-Unterzeilen
- [ ] **Ganz unten**: Gesamt-Zeile „Einnahmen (Gesamt)" — summiert alle Leaf-Zeilen, nicht editierbar, immer sichtbar (unterste Zeile)
- [ ] Reihenfolge nach `sort_order` im KPI-Modell
- [ ] **Buttons oben rechts:** „Alle ausklappen" / „Alle einklappen" / „Zurücksetzen"

### Produktverkäufe — automatische Berechnung (Zahlungszeitpunkt)

Die Produktverkäufe-Soll-Werte werden **server-seitig** berechnet (Liquiditätssicht) und nur bei manueller Überschreibung persistiert. Berechnung je Sales-Plattform P, je Auszahlungsmonat:

- [ ] **Nettoerlös je Plattform je Monat** stammt aus der langfristigen Sales-Plattform-Planung dieser Version (PROJ-87): `Netto_P_M = Bruttoumsatz − Rabatte − Rückerstattungen − Verkaufsgebühr − Retourenkosten` (Plattformebene = Summe über alle Produkte), **vor** Abzug von Marketing
- [ ] **Zahlungsmonate** je Plattform: ausgehend vom **Ankermonat** (`erster_auszahlung_monat`/`erster_auszahlung_jahr`) im **Rhythmus** (monatlich = 1, alle 2 Monate = 2, quartalsweise = 3) fortlaufend; ist kein Ankermonat gesetzt, trägt die Plattform nichts bei (leer)
- [ ] **Verschiebung**: ein Erlös-Monat W „landet" frühestens im Zahlungsmonat unter Berücksichtigung von `verschiebung_monate` (V); je Zahlungsmonat Z mit Rhythmus R werden die Erlös-Monate des Fensters `[Z − V − R + 1 … Z − V]` summiert (analog zur Kurzfristplanung, Monate statt KW)
- [ ] **Marketing-Abzug**: ist der Plattform in den Auszahlungseinstellungen mindestens ein Marketingkanal zugeordnet (`langfristige_auszahlungs_marketingkanaele`), werden die zu den Erlös-Monaten des Fensters gehörenden Marketingkosten dieser Plattform (aus PROJ-87) abgezogen; ohne Zuordnung kein Abzug
- [ ] **Summierung über alle Plattformen** je Zahlungsmonat: `Produktverkäufe_Z = Σ_P Payment_Z_P`; die Aufschlüsselung je Plattform bleibt für die Plattform-Unterzeilen erhalten
- [ ] Monate, die für eine Plattform keine Zahlungsmonate sind: kein Produktverkäufe-Beitrag dieser Plattform (leer, keine 0-Anzeige)
- [ ] Fehlen Eingangsdaten (keine Sales-Plattform-Planung, kein Ankermonat): betroffene Zelle leer statt 0
- [ ] Zahlungsmonate außerhalb des angezeigten Monatsfensters werden nicht dargestellt
- [ ] Vorberechnete Produktverkäufe-Zellen erhalten einen **grauen Indikatorpunkt** (untere rechte Ecke)

### Manuelle Eingabe & Persistenz (alle Kategorien)

- [ ] Alle Leaf-Zellen (Sub-Kategorien bzw. Leaf-L1 bzw. Produktverkäufe-Plattform-Unterzeilen) sind per Inline-Editing direkt bearbeitbar (Click-to-Edit, `onBlur` speichert automatisch)
- [ ] Eingabe: Dezimalzahl ≥ 0; leeres Feld = kein Wert (NULL)
- [ ] **Alle Kategorien außer Produktverkäufe** sind standardmäßig **leer** und ohne automatische Berechnung
- [ ] Manuell eingegebene Werte werden in der neuen, **versionsgebundenen** Tabelle persistiert (`plan_version_id` + `user_id`)
- [ ] Beim nächsten Seitenladevorgang werden gespeicherte manuelle Werte aus der DB geladen
- [ ] Optimistisches Update: Wert erscheint sofort; bei API-Fehler → Toast-Fehlermeldung + Rollback
- [ ] Aggregationszeilen (category-sum) und die Gesamt-Zeile sind nicht editierbar und summieren ihre Leaf-Kinder je Monatsspalte
- [ ] Aggregations-/Gesamt-Zeilen zeigen „—", wenn alle Kinder NULL sind (kein 0,00)

### Visuelle Indikatorpunkte

| Zustand | Punkt | Gilt für |
|---|---|---|
| Automatisch berechnet | Grauer Punkt | Produktverkäufe-Zellen mit berechnetem Wert |
| Manuell eingegeben | Blauer Punkt | Alle manuell überschriebenen Soll-Zellen |
| Leer (kein Wert) | Kein Punkt | Leere Soll-Zellen ohne Berechnung |
| Aggregation / Gesamt | Kein Punkt | Nicht editierbare Zeilen |

Merksatz: **Ein DB-Eintrag in der versionsgebundenen Tabelle = manuell = blauer Punkt.** Berechnete Produktverkäufe-Werte werden nie persistiert.

### Zurücksetzen (global + einzeln)

- [ ] **Globaler „Zurücksetzen"-Button** (oben rechts): öffnet einen Bestätigungs-Dialog (shadcn `AlertDialog`); Text sinngemäß: „Alle Planungswerte zurücksetzen? Alle manuell eingegebenen Werte und Notizen dieser Version werden gelöscht. Automatisch berechnete Werte (Produktverkäufe) werden wiederhergestellt."
- [ ] Nach Bestätigung: alle manuellen Einträge **und** alle Notizen dieser Seite/Version werden gelöscht; Produktverkäufe zeigen wieder berechnete Werte (grauer Punkt), alle anderen Zellen erscheinen leer
- [ ] **Einzelnes Zurücksetzen**: eine einzelne manuell überschriebene Produktverkäufe-Zelle kann wieder auf den berechneten Wert zurückgesetzt werden (manueller Wert wird gelöscht → grauer Punkt)
- [ ] Globales Zurücksetzen ohne manuelle Einträge ist idempotent (kein Fehler)

### Notizen (versionsgebunden)

- [ ] Notiz-Feature auf allen editierbaren Soll-Zellen, identisch zur Marketing-/Absatz-/Sales-Plattform-Planung der Langfristigen Planung
- [ ] Notiz-Icon erscheint beim Hover (wenn keine Notiz) oder dauerhaft (wenn Notiz vorhanden) mit Tooltip-Vorschau
- [ ] Notizen sind an die **Zellkoordinate** (Kategorie/Plattform + Monat/Jahr) gebunden und hängen am Monat, nicht an der Spaltenposition
- [ ] Wiederverwendung der Tabelle `langfristige_planung_notizen` (PROJ-84) mit `seite = 'einnahmenplanung'`
- [ ] Globales Zurücksetzen löscht auch alle Notizen dieser Seite/Version

### Betragsselektion (Hover/Klick-Summe, wie PROJ-40)

- [ ] Zellwerte durch Klicken / Ctrl+Klicken auswählbar; Summe der selektierten Werte erscheint in einem Panel rechts unten (ab ≥ 1 Selektion)
- [ ] Auch nicht-editierbare Zellen (Aggregationszeilen, Gesamt) sind selektierbar
- [ ] Verhalten identisch mit PROJ-40 / PROJ-84 / PROJ-85 / PROJ-87

### Datenisolation (PROJ-73)

- [ ] Alle Lese-/Schreibzugriffe sind nach `versionId` **und** `user_id` gefiltert
- [ ] Eine neu angelegte Planversion zeigt nur berechnete Produktverkäufe und **keine** manuellen Überschreibungen (keine Übernahme aus anderen Versionen oder der Kurzfristigen Planung); alle anderen Kategorien leer
- [ ] Beim Löschen der Planversion werden alle Einnahmenplanungs- und zugehörigen Notiz-Datensätze kaskadierend mitgelöscht (ON DELETE CASCADE)

### Datenbankschema

- [ ] Neue Tabelle `langfristige_einnahmen_planung` (speichert ausschließlich manuelle Überschreibungen):
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `kategorie_id` UUID NOT NULL — Leaf-Schlüssel: globale Einnahmen-Kategorie-ID (`kpi_categories`) **oder** — für Produktverkäufe-Plattform-Unterzeilen — die Sales-Plattform-ID (`langfristige_kpi_kategorien`, `art = 'lp_sales_plattform'`). (Kein harter FK, da zwei Quell-Tabellen; Gültigkeit serverseitig geprüft.)
  - `jahr` INTEGER NOT NULL, `monat` INTEGER NOT NULL CHECK (1–12)
  - `betrag_manuell` NUMERIC(14,2) NULL — NULL = kein manueller Wert (berechneter/leerer Zustand gilt)
  - UNIQUE(`plan_version_id`, `kategorie_id`, `jahr`, `monat`)
  - RLS: Nutzer sieht und schreibt nur eigene Einträge (4 Policies, `auth.uid() = user_id`); Versionszugehörigkeit serverseitig zusätzlich geprüft
- [ ] Notizen: Wiederverwendung von `langfristige_planung_notizen` mit `seite = 'einnahmenplanung'` — keine neue Tabelle

### API-Routen (versions- & nutzergebunden)

- [ ] `GET /api/langfristige-planung/[versionId]/einnahmen-planung` — alle manuellen Einträge der Version
- [ ] `PUT /api/langfristige-planung/[versionId]/einnahmen-planung` — Upsert eines Eintrags; `betrag_manuell = null` löscht den Eintrag (einzelnes Zurücksetzen)
- [ ] `DELETE /api/langfristige-planung/[versionId]/einnahmen-planung` — alle manuellen Einträge + Notizen der Version löschen (globaler Reset)
- [ ] `GET /api/langfristige-planung/[versionId]/einnahmen-planung/produktverkaeufe-berechnet` — vorberechnete Produktverkäufe-Werte je Sales-Plattform × Auszahlungsmonat (lädt Sales-Plattform-Planung + Auszahlungseinstellungen der Version serverseitig)
- [ ] **Keine** `/ist-tatsaechlich`-Route (keine Ist-Daten)
- [ ] Alle Routen: `requireAuth()`, Zod-Validierung (UUIDs, `monat` 1–12, `jahr` plausibel, NUMERIC oder null), Filter nach `user_id` + `plan_version_id`; fremde/unbekannte `versionId` → 404

## Edge Cases

- **Keine Einnahmen-Kategorien im globalen KPI-Modell außer Produktverkäufe**: Leerzustand mit Hinweis + Link zur globalen KPI-Modell-Verwaltung
- **„Produktverkäufe" hat L2-Unterkategorien im KPI-Modell**: dann erscheinen diese als Leafs; die Plattform-Aufschlüsselung „pro Sales Channel" entfällt zugunsten der Modell-Untergruppen (analog Kurzfristplanung) — die automatische Berechnung greift dann auf der entsprechenden Ebene nicht
- **Keine Sales-Plattformen in der Version**: Produktverkäufe-Zeile zeigt keine Plattform-Unterzeilen; Kopfzeile leer
- **Kein Ankermonat für eine Plattform gesetzt**: Plattform trägt 0/leer zu Produktverkäufe bei (kein Fehler)
- **`verschiebung_monate` = 0**: Erlös-Monat-Fenster `[Z − R + 1 … Z]` (kein zusätzlicher Versatz)
- **Rhythmus quartalsweise/alle 2 Monate**: Fenster der Größe R fasst mehrere Erlös-Monate je Zahlungsmonat zusammen
- **Sales-Plattform-Planung-Daten fehlen** (kein Absatz/VK in PROJ-87 für einen Monat): Produktverkäufe-Beitrag dieser Monate leer (nicht 0)
- **Marketingkanal zugeordnet, aber keine Marketingkosten in der Sales-Plattform-Planung**: kein Abzug, kein Fehler
- **Zahlungsmonat liegt außerhalb des Planungshorizonts**: berechneter Wert wird nicht angezeigt (kein Out-of-Range-Wert)
- **Erlös-Monat liegt vor dem Startmonat** (durch Verschiebung/Rhythmus): trägt nur bei, soweit Sales-Plattform-Planungsdaten existieren; ansonsten leer
- **Jahresgrenze im Monatsfenster oder in der Zahlungsmonat-Reihe**: Monats-/Jahresberechnung korrekt (`buildPlanungsmonate` + Monats-Index-Arithmetik)
- **Sehr langer Horizont (z. B. 120 Monate)**: Tabelle horizontal scrollbar, Label-Spalte sticky, kein Layout-Bruch
- **Globales Zurücksetzen ohne manuelle Einträge**: idempotent, kein Fehler
- **Kategorie/Plattform im KPI-Modell gelöscht**: zugehörige manuelle Einträge/Notizen verschwinden beim nächsten Aufruf (kaskadierend bzw. nicht mehr referenziert)
- **API-Fehler bei der Produktverkäufe-Berechnung**: Produktverkäufe-Zellen leer, kein Absturz, Toast-Hinweis
- **Aufruf mit fremder/unbekannter `versionId`**: Redirect zum Dashboard (PROJ-73), kein Datenzugriff

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen versionsgebundenen Tabelle; Versionszugehörigkeit serverseitig prüfen (Defense-in-Depth zur RLS)
- Alle Eingaben serverseitig mit Zod validieren (UUIDs, Monat 1–12, Jahr, NUMERIC oder null)
- Neue versionsgebundene Next.js-Seite: `src/app/dashboard/langfristige-planung/[versionId]/einnahmenplanung/page.tsx` (nutzt `LangfristigeVersionShell`)
- Navigation: Eintrag „Einnahmenplanung" (Slug `einnahmenplanung`) in der Gruppe „Planung" in `src/lib/langfristige-planung-nav.ts` (NavSheet und Versions-Übersicht ziehen automatisch nach)
- Monatsberechnung: Wiederverwendung von `buildPlanungsmonate` (PROJ-84), mit dem **allgemeinen** Horizont parametriert (ab Startmonat, ohne Vorlauf)
- Produktverkäufe-Zahlungszeitpunkt-Logik 1:1 von der Kurzfristplanung (PROJ-52 `produktverkaeufe-berechnet`) übernehmen und auf **Monate** sowie die versionsgebundenen Eingangsdaten umstellen (Sales-Plattform-Planung aus PROJ-87, Auszahlungseinstellungen aus PROJ-76)
- Wiederverwendung der Tabellen-/Selektions-/Notiz-/Reset-Bausteine aus PROJ-52/PROJ-84/PROJ-85/PROJ-87; Datenquelle versionsgebunden parametriert statt Code-Duplikation, wo sinnvoll
- shadcn/ui first: Table/Input/AlertDialog/Tooltip/Button — alle bereits vorhanden
- Kein neues npm-Paket nötig
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Vorschlag — final in `/architecture`)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/einnahmenplanung/page.tsx` | Echte Seite: Versions-Shell + Tabelle |
| `src/components/langfristige-einnahmenplanung-tabelle.tsx` | Hauptkomponente: Monats-Matrix, einklappbare Kategorien, Produktverkäufe-Plattform-Unterzeilen, Inline-Edit, grauer/blauer Punkt, Betragsselektion, Notizen, Reset-Dialog, Gesamt-Zeile unten |
| `src/hooks/use-langfristige-einnahmenplanung.ts` | Zentraler State: parallele Ladevorgänge (Grundeinstellungen, globale Einnahmen-Kategorien, Sales-Plattformen der Version, manuelle Werte, berechnete Produktverkäufe, Notizen), Monatsfenster, Merge-/Aggregations-Logik, Upsert, einzelnes + globales Reset |
| `src/app/api/langfristige-planung/[versionId]/einnahmen-planung/route.ts` | GET (manuelle Werte), PUT (Upsert/Löschen bei null), DELETE (globaler Reset inkl. Notizen) |
| `src/app/api/langfristige-planung/[versionId]/einnahmen-planung/produktverkaeufe-berechnet/route.ts` | GET: berechnet Produktverkäufe je Sales-Plattform × Auszahlungsmonat (Zahlungszeitpunkt-Logik) |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Einnahmenplanung" (Slug `einnahmenplanung`) in der Gruppe „Planung" ergänzen |

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Übernahme der hier geplanten Einnahmen in eine nachgelagerte langfristige Liquiditätsauswertung (eigene Spec)
- Verhalten, falls „Produktverkäufe" künftig je Plattform **und** Produkt aufgeschlüsselt werden soll (aktuell nur je Sales Channel, analog Kurzfristplanung)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee

Diese Seite ist die **fünfte Planungsseite** der Gruppe „Planung" (nach Absatzplanung, Marketing-Planung, Operativkosten-Planung, Sales-Plattform-Planung und Bestellplanung) und eine **Spiegelung der kurzfristigen Einnahmenplanung** (PROJ-52) — auf die Langfristige Planung umgestellt. Sie verbindet drei bereits fertige Welten:

1. **Versions-Fundament** (PROJ-73): Routing über `[versionId]`, gemeinsames Seitengerüst (`LangfristigeVersionShell` mit Versionsprüfung, Header, Redirect bei fremder Version), zentrale Nav-Konfiguration, serverseitiger Versions-Eigentums-Check.
2. **Daten dieser Version**: Startmonat + allgemeiner Horizont aus den Grundeinstellungen (PROJ-75); die berechneten Nettoerlöse und Marketingkosten je Plattform aus der langfristigen Sales-Plattform-Planung (PROJ-87); Auszahlungsrhythmus, Ankermonat, Verschiebung (Monate) und Marketingkanal-Zuordnung aus den Auszahlungseinstellungen (PROJ-76). Die **Einnahmen-Kategorien als Zeilenquelle** kommen aus dem **globalen** KPI-Modell (PROJ-2), weil das langfristige KPI-Modell (PROJ-74) bewusst keinen Einnahmen-Reiter hat — exakt wie in der Kurzfristplanung.
3. **Bewährtes Bedienkonzept** (aus PROJ-52/PROJ-84/PROJ-85/PROJ-87): einklappbare Kategoriebaum-Tabelle, Inline-Edit mit Auto-Save, grauer/blauer Punkt, Betragsselektion, Zellen-Notizen, globaler + einzelner Reset.

Der entscheidende fachliche Unterschied zur kurzfristigen Vorlage: Die Langfristige Planung kennt **keine Ist-Transaktionen**. Deshalb entfällt die gesamte „Vergangenheits-"Datenschicht der kurzfristigen Seite (Ist-Tatsächlich / Ist-Plan, doppelte Spalten, Trennlinie). Es gibt nur **Zukunfts-Monatsspalten ab dem Startmonat** und nur **eine** automatische Wertquelle: die Produktverkäufe-Zahlungszeitpunkt-Berechnung. Grauer Punkt = automatisch berechnet (nur Produktverkäufe), blauer Punkt = manuell überschrieben.

Wie schon bei der langfristigen Sales-Plattform-Planung gilt: **Nur manuelle Überschreibungen werden gespeichert.** Berechnete Produktverkäufe-Werte werden bei jedem Laden neu ermittelt und **nicht** persistiert (Abweichung zur kurzfristigen Umsetzung, die berechnete Werte in die Tabelle schreibt — die saubere PROJ-87-Variante wird hier bewusst übernommen).

Der eigentliche Neubau ist klein und klar umrissen: **eine** neue versionsgebundene Datenablage (manuelle Überschreibungen je Zelle), **ein** Berechnungs-Endpunkt (Produktverkäufe-Zahlungszeitpunkt), **ein** Lese-/Schreib-Endpunkt für die manuellen Werte und **eine** fokussierte Tabellen-Komponente. Alle Hilfs-Bausteine werden übernommen statt nachgebaut.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                 (Versions-Übersicht — bestehend)
+-- Gruppe "Planung": Eintrag/Kachel "Einnahmenplanung"  (erscheint automatisch über die Nav-Konfiguration)

/dashboard/langfristige-planung/[versionId]/einnahmenplanung   (NEUE Seite)
+-- LangfristigeVersionShell  (bestehend — prüft Version, Header/Breadcrumb, Redirect, Toaster)
    +-- Seiten-Kopf
    |   +-- Titel "Einnahmenplanung"
    |   +-- Button-Gruppe rechts: "Alle ausklappen" | "Alle einklappen" | "Zurücksetzen"
    +-- LangfristigeEinnahmenplanungTabelle  (NEUE Hauptkomponente)
        +-- Leer-Zustand (keine Einnahmen-Kategorien außer Produktverkäufe → Hinweis + Link zur globalen KPI-Modell-Verwaltung)
        +-- Scroll-Container (horizontal, Label-Spalte sticky links)
        |   +-- Kopfzeile: [Label] | [Startmonat] | [Folgemonate ...]
        |   +-- [Pro L1-Einnahmen-Kategorie, nach sort_order]
        |   |   +-- Kategorie-Header-Zeile (Name + Auf-/Zuklapp-Icon)
        |   |   +-- [wenn Sub-Kategorien]: Aggregations-Zeile + je L2 eine editierbare Leaf-Zeile
        |   |   +-- [wenn keine Sub-Kategorien]: L1 selbst als editierbare Leaf-Zeile
        |   |   +-- [Sonderfall Produktverkäufe ohne L2]: je Sales-Plattform der Version eine Unterzeile (auto grau/blau)
        |   +-- Gesamt-Zeile "Einnahmen (Gesamt)"  ← GANZ UNTEN (nicht editierbar)
        +-- Betragsselektion-Summenpanel (WIEDERVERWENDETES Muster, rechts unten)
        +-- Notiz-Overlay (WIEDERVERWENDET — versionsgebunden, seite="einnahmenplanung")
        +-- Zurücksetzen-Bestätigungs-Dialog (AlertDialog)
```

Das linke Seitenmenü und die Versions-Übersicht rendern die Nav-Gruppen generisch — der neue Eintrag erscheint allein durch die Ergänzung in der zentralen Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`).

### B) Datenmodell (Klartext)

Es entsteht **genau eine** neue, versionsgebundene Tabelle, die ausschließlich **manuelle Überschreibungen** speichert. Berechnete Produktverkäufe werden nie gespeichert — sie sind immer aus den Versions-Daten ableitbar.

**Neue Tabelle „Langfristige Einnahmenplanung" (ein Eintrag je überschriebener Zelle):**
```
Jeder Eintrag hat:
- eindeutige ID
- Besitzer (Nutzer)                         → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion  → Datenisolation
- Kategorie-/Zeilen-Schlüssel: entweder eine globale Einnahmen-Kategorie-ID
  (für normale Kategorien und die Produktverkäufe-Kopfzeile) ODER eine
  Sales-Plattform-ID der Version (für die Produktverkäufe-Plattform-Unterzeilen)
- Monat (1–12) + Jahr
- manueller Wert (Betrag, oder "leer")
Eindeutigkeit: je (Planversion, Zeilen-Schlüssel, Jahr, Monat) genau ein Eintrag.
```

**Bewusst NICHT gespeichert:** die berechneten Produktverkäufe-Werte (sie kommen jederzeit frisch aus dem Berechnungs-Endpunkt) sowie die Gesamt-/Aggregationswerte (frontend-seitig gebildet).

**Hinweis zum Zeilen-Schlüssel:** Er verweist je nach Zeile auf zwei verschiedene Stammdaten-Quellen (globale Einnahmen-Kategorie **oder** versionsgebundene Sales-Plattform). Deshalb wird kein harter Fremdschlüssel auf eine einzelne Tabelle gesetzt; die Gültigkeit (gehört die ID zur korrekten Quelle/Version) wird **serverseitig** geprüft. Sales-Plattform-IDs und Kategorie-IDs kollidieren nicht (verschiedene UUIDs).

**Notizen:** Wiederverwendung der bereits seitenübergreifend ausgelegten Tabelle `langfristige_planung_notizen` (PROJ-84) mit Seite „einnahmenplanung". Keine neue Tabelle.

**Regeln:**
```
- Jeder Datensatz ist an Nutzer + Planversion gebunden; Zugriff nur auf eigene Daten
  (Row Level Security + serverseitige Prüfung der Versionszugehörigkeit).
- Wird die Planversion gelöscht, verschwinden alle Einträge automatisch mit (kaskadierend).
- Keine Überschreibung vorhanden:
    • Produktverkäufe-Zelle → zeigt den berechneten Wert (grauer Punkt)
    • alle anderen Zellen    → bleiben leer (kein Punkt)
```

### C) Welche Spalten (Monate) werden gezeigt?

```
Aus den Grundeinstellungen der Version (PROJ-75):
  Startmonat (Monat + Jahr) und Planungshorizont ALLGEMEIN (Monate). Fallback: 12.

Erste Spalte  = Startmonat (KEIN Vorlauf-Monat)
Letzte Spalte = Startmonat + (Allgemeiner Horizont − 1) Monate
Spaltenanzahl = Allgemeiner Horizont
Keine Ist-/Vergangenheitsspalten (keine Transaktionen).
```

Die Monatsabfolge (inkl. Jahresgrenzen) wird mit demselben, bereits getesteten Helfer wie in der Absatz-/Sales-Plattform-Planung gebildet (`buildPlanungsmonate`), nur **ohne** die dort verwendeten zwei Vorlauf-Monate.

### D) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Shell prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Die Tabelle lädt parallel:
     ① Grundeinstellungen der Version    → Startmonat + allgemeiner Horizont (Monatsfenster)
     ② globale Einnahmen-Kategorien (KPI-Modell, mit Untergruppen, inkl. Produktverkäufe)
     ③ Sales-Plattformen der Version (KPI-Modell) → Unterzeilen für Produktverkäufe
     ④ gespeicherte manuelle Überschreibungen der Version
     ⑤ berechnete Produktverkäufe-Werte der Version (Berechnungs-Endpunkt, siehe E)
     ⑥ gespeicherte Notizen der Version  (Seite "einnahmenplanung")
  → Zusammenführung je Zelle:
     • Manuelle Überschreibung vorhanden → dieser Wert + blauer Punkt
     • Sonst, wenn Produktverkäufe-Zelle → berechneter Wert + grauer Punkt
     • Sonst                             → leer, kein Punkt
  → Aggregation (frontend, reaktiv):
     Aggregations-Zeile = Summe ihrer Leaf-Kinder; Gesamt-Zeile = Summe aller Leafs (je Monat)

Nutzer bearbeitet eine Leaf-Zelle (onBlur)
  → optimistische Anzeige + Speichern der einen Zelle (anlegen/aktualisieren) → blauer Punkt
  → Fehler → Toast + Rücksetzen

Nutzer setzt eine einzelne Produktverkäufe-Zelle zurück
  → die Überschreibung wird gelöscht → die Zelle zeigt wieder den berechneten Wert (grauer Punkt)

Nutzer klickt "Zurücksetzen" (global)
  → Bestätigungs-Dialog → nach Bestätigung: alle Überschreibungen + alle Notizen der Version löschen
  → Produktverkäufe zeigen wieder berechnete Werte, alle anderen Zellen leer

Betragsselektion: Klick/Ctrl+Klick auf Werte → laufende Summe rechts unten
```

### E) Wie werden die Produktverkäufe berechnet? (Klartext — Logik gespiegelt von PROJ-52, monatsweise)

Der Berechnungs-Endpunkt erzeugt die Produktverkäufe-Werte je Sales-Plattform und Auszahlungsmonat. Er nutzt dieselbe Zahlungszeitpunkt-Logik wie die kurzfristige Einnahmenplanung, nur mit **Monaten** statt Kalenderwochen und mit den Daten **dieser Version**:

```
1. Nettoerlös je Plattform je Monat (Eingangsgröße):
   Aus der langfristigen Sales-Plattform-Planung dieser Version (PROJ-87) wird je
   Plattform und Monat der Nettoerlös gebildet:
     Netto = Bruttoumsatz − Rabatte − Rückerstattungen − Verkaufsgebühr − Retourenkosten
   (Summe über alle Produkte; berechnete Werte + manuelle Überschreibungen jener Seite,
    Marketing hier noch NICHT abgezogen).

2. Zahlungsmonate je Plattform:
   Ausgehend vom Ankermonat (erster Auszahlungsmonat) im Rhythmus fortschreiten:
     monatlich = jeder Monat, alle 2 Monate = jeder 2., quartalsweise = jeder 3. Monat.
   Kein Ankermonat gesetzt → Plattform trägt nichts bei.

3. Verschiebung & Rhythmusfenster:
   Ein Zahlungsmonat Z bündelt die Erlös-Monate des Fensters [Z − V − R + 1 … Z − V]
   (V = Verschiebung in Monaten, R = Rhythmus in Monaten). Deren Nettoerlöse werden summiert.

4. Marketing-Abzug (bedingt):
   Ist der Plattform in den Auszahlungseinstellungen mindestens ein Marketingkanal
   zugeordnet, werden die zu diesen Erlös-Monaten gehörenden Marketingkosten der
   Plattform (aus der Sales-Plattform-Planung) abgezogen. Ohne Zuordnung kein Abzug.

5. Ergebnis:
   Je Plattform × Zahlungsmonat ein Wert. Die Frontend-Aggregation summiert die
   Plattform-Unterzeilen zur Produktverkäufe-Kopfzeile und in die Gesamt-Zeile.

Zahlungsmonate außerhalb des angezeigten Fensters werden nicht ausgegeben.
Fehlen Eingangsdaten (keine Sales-Plattform-Planung, kein Ankermonat), bleibt die Zelle leer.
```

Die Berechnung erfolgt **server-seitig**, weil sie Sales-Plattform-Planungsdaten, Auszahlungseinstellungen und Marketing-Zuordnung kombiniert — zu viel Logik für den Client. Anders als die kurzfristige Variante **schreibt** dieser Endpunkt die Werte **nicht** zurück in die Datenablage (reine Berechnung).

### F) Indikator-Logik (grau vs. blau)

| Zeilentyp | Zelle hat manuellen Eintrag | Zelle hat keinen manuellen Eintrag |
|---|---|---|
| Produktverkäufe (Plattform-Unterzeile / Leaf) | Blauer Punkt (manuell) | Grauer Punkt (automatisch berechnet) |
| Andere Kategorien (Leaf) | Blauer Punkt (manuell) | Kein Punkt (leer) |
| Aggregations-/Gesamt-Zeile | — | Kein Punkt (nicht editierbar) |

Merksatz: **Ein Eintrag in der Einnahmenplanungs-Tabelle = manuell = blauer Punkt.** Auto-Werte gibt es nur für Produktverkäufe und sie werden nie persistiert.

### G) Server-Schnittstellen (versions- & nutzergebunden)

Alle neuen Endpunkte folgen exakt dem etablierten Langfristig-Muster (Login-Pflicht, Versions-Eigentums-Prüfung über den gemeinsamen Helfer, Filterung nach Nutzer **und** Version als zweite Sicherheitsebene zur RLS, Eingabeprüfung). Fremde/unbekannte Version → kein Zugriff.

```
Manuelle Überschreibungen (NEU):
  Lesen     – alle gespeicherten Überschreibungen der Version
  Speichern – eine Zelle anlegen/aktualisieren (Zeilen-Schlüssel, Jahr, Monat, Wert);
              "leer" entfernt die Überschreibung (= einzelnes Zurücksetzen)
  Löschen   – alle Überschreibungen + Notizen der Version (= globaler Reset)

Berechnete Produktverkäufe (NEU):
  Lesen     – berechnete Werte je Sales-Plattform × Auszahlungsmonat (Zahlungszeitpunkt-Logik aus E)

Stützdaten & Notizen (WIEDERVERWENDUNG bestehender Routen/Hooks):
  Einnahmen-Kategorien (mit Untergruppen)   – globale KPI-Kategorien-Route (PROJ-2), Typ "einnahmen"
  Sales-Plattformen der Version             – versionsgebundener KPI-Kategorien-Hook (PROJ-74)
  Grundeinstellungen                        – Grundeinstellungen-Route der Version (PROJ-75)
  Notizen                                   – Notiz-Hook/-Route (PROJ-84), Seite "einnahmenplanung"

Sales-Plattform-Planung (berechnet + manuell) und Auszahlungseinstellungen liest der
Produktverkäufe-Endpunkt serverseitig direkt aus den Versions-Quellen (PROJ-87/PROJ-76).
```

### H) Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/einnahmenplanung/page.tsx` | Echte Seite: Versions-Shell + Tabelle |
| `src/components/langfristige-einnahmenplanung-tabelle.tsx` | Hauptkomponente: Monats-Matrix, einklappbare Kategorien, Produktverkäufe-Plattform-Unterzeilen, Inline-Edit, grauer/blauer Punkt, Betragsselektion, Notizen, Reset-Dialog, Gesamt-Zeile unten |
| `src/hooks/use-langfristige-einnahmenplanung.ts` | Zentraler State: parallele Ladevorgänge ①–⑥, Monatsfenster, Merge (berechnet ↔ manuell), Aggregation, Auto-Save, einzelnes + globales Reset |
| `src/app/api/langfristige-planung/[versionId]/einnahmen-planung/route.ts` | Lesen + Speichern (Upsert/leer = löschen) der manuellen Überschreibungen; globaler Reset (inkl. Notizen) |
| `src/app/api/langfristige-planung/[versionId]/einnahmen-planung/produktverkaeufe-berechnet/route.ts` | Berechnet Produktverkäufe je Plattform × Auszahlungsmonat (Logik von PROJ-52, monatsweise, auf Versions-Daten, ohne Persistierung) |

### I) Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Einnahmenplanung" (Slug `einnahmenplanung`) in der Gruppe „Planung" ergänzen |

### J) Wiederverwendung im Detail

| Baustein | Status | Anmerkung |
|---|---|---|
| Versions-Gerüst (`LangfristigeVersionShell`) | **unverändert wiederverwenden** | Versionsprüfung, Header, Redirect, Toaster |
| Versions-Sicherheits-Helfer (`ensureLangfristigeVersion`) | **unverändert wiederverwenden** | in den neuen API-Routen |
| Monatsfenster-Helfer (`buildPlanungsmonate`) | **wiederverwenden** | aus PROJ-84, ohne Vorlauf-Monate, allgemeiner Horizont |
| Globale Einnahmen-Kategorien (Hook/Route) | **wiederverwenden** | wie PROJ-52 (Typ „einnahmen", inkl. Untergruppen + Produktverkäufe) |
| Versionsgebundene Sales-Plattformen (`useLangfristigeKpiKategorien`) | **wiederverwenden** | Unterzeilen für Produktverkäufe |
| Produktverkäufe-Zahlungszeitpunkt-Logik | **von PROJ-52 portieren** | Monate statt KW; Eingangsdaten aus PROJ-87/PROJ-76; ohne Persistierung |
| Tabellen-Aufbau (einklappbarer Kategoriebaum, flaches Zeilen-Array) | **Muster von PROJ-52/PROJ-87 übernehmen** | auf Monate + Versionsbindung umgestellt |
| Betragsselektion-Summenpanel | **Muster wiederverwenden** | identisch zu PROJ-40/PROJ-84/PROJ-85/PROJ-87 |
| Notiz-Tabelle + Notiz-Hook + Notiz-Overlay | **wiederverwenden** | `langfristige_planung_notizen`, Seite „einnahmenplanung" |
| Haupttabelle + 2 Endpunkte + 1 Hook | **Neubau** | versionsgebunden, rein berechnet (PV) + manuelle Überschreibung |

### K) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Spalten ab Startmonat, keine Vorlauf-Monate, keine Ist-Spalten | Ja (vom Nutzer bestätigt) | Langfristige Planung kennt keine Transaktionen; der Nutzer wünscht den Beginn exakt beim Startmonat |
| Produktverkäufe nach **Zahlungszeitpunkt** (Liquidität) | Ja (vom Nutzer bestätigt) | „wie in der Kurzfristplanung … anhand der Einstellungen dieser Planversion" → Auszahlungsrhythmus/Ankermonat/Verschiebung anwenden |
| Einnahmen-Kategorien aus dem **globalen** KPI-Modell | Ja | Das langfristige KPI-Modell hat keinen Einnahmen-Reiter; identisch zur Kurzfristplanung |
| Nur manuelle Überschreibungen speichern, Produktverkäufe nur berechnen | Ja | Spiegelt die saubere PROJ-87-Variante; berechnete Werte sind jederzeit ableitbar — Speichern wäre redundant |
| Berechnung **nicht** zurückschreiben (Abweichung zu PROJ-52) | Ja | Vermeidet Persistenz-/Konsistenz-Altlasten der kurzfristigen Umsetzung; grau/blau leitet sich allein aus „Eintrag vorhanden?" ab |
| Zeilen-Schlüssel ohne harten Fremdschlüssel (zwei Quellen) | Ja | Leaf-Zeilen verweisen entweder auf eine globale Kategorie oder eine Versions-Plattform; Gültigkeit serverseitig geprüft (analog kurzfristiger Plattform-Aufschlüsselung) |
| Eigene fokussierte Tabelle (statt PROJ-52-Komponente generalisieren) | Neubau | Versions- statt Nutzer-Bindung, Monate statt KW, Wegfall der Ist-Schicht — Generalisierung brächte mehr Regressionsrisiko als Nutzen |
| Keine neuen npm-Pakete | Ja | Alle Bausteine (Tabelle, Dialog, Tooltip, Datumshelfer) sind vorhanden |

### L) Umsetzungsreihenfolge (empfohlen)

```
1. Neue versionsgebundene Tabelle (manuelle Überschreibungen), nutzer-/versionsgesichert (RLS, ON DELETE CASCADE)
   ↓
2. Endpunkt: manuelle Werte (Lesen / Speichern / globaler Reset inkl. Notizen)
3. Endpunkt: Produktverkäufe-berechnet (Zahlungszeitpunkt; Eingangsdaten aus PROJ-87/PROJ-76)  ← kann parallel zu 2
   ↓
4. Hook: use-langfristige-einnahmenplanung (Ladevorgänge ①–⑥, Merge, Aggregation, Auto-Save, Reset)
   ↓
5. Tabelle: langfristige-einnahmenplanung-tabelle (Monats-Matrix, Kategorien, PV-Unterzeilen, Indikatoren, Notizen, Selektion)
   ↓
6. Seite + Nav-Eintrag „Einnahmenplanung" (Gruppe „Planung")
```

> Hinweis: Da Versions-Gerüst, Stammdaten-Hooks, Notiz-/Selektions-Bausteine und das Monatsfenster bereits existieren, liegt der eigentliche Aufwand in Schritt 1–3 (Datenhaltung/Endpunkte) und Schritt 5 (Tabelle); der Rest ist überwiegend Verdrahtung der kurzfristigen Vorlage.

## Implementation Notes

### Frontend (PROJ-89 Frontend) — 2026-06-22

Maximale Wiederverwendung der kurzfristigen Einnahmenplanung (PROJ-52) und der langfristigen Sales-Plattform-Planung (PROJ-87) als Vorlagen. Versions-Shell (`LangfristigeVersionShell`), Monatsfenster-Idee, Notiz-Hook (`useLangfristigePlanungNotizen`) und das Notiz-Formular (`PlanungNotizFormular`) **unverändert** wiederverwendet.

**Neue Dateien:**
- `src/hooks/use-langfristige-einnahmenplanung.ts` — versionsgebundener State-Hook `useLangfristigeEinnahmenplanung(versionId)`. Lädt parallel: Grundeinstellungen (Startmonat + allgemeiner Horizont), globale Einnahmen-Kategorien (`/api/kpi-categories?type=einnahmen`, inkl. Untergruppen + Produktverkäufe), Sales-Plattformen der Version (`/api/langfristige-planung/[versionId]/kpi-kategorien?art=lp_sales_plattform`), manuelle Werte (`…/einnahmen-planung`) und berechnete Produktverkäufe (`…/einnahmen-planung/produktverkaeufe-berechnet`). Eigener Monats-Builder `buildEinnahmenMonate` (ab Startmonat, **kein** Vorlauf — `buildPlanungsmonate` aus PROJ-84 erzeugt 2 Vorlauf-Monate und ist daher hier nicht nutzbar). Schlüssel via `kategorieMonatKey(kategorieId, year, month)`. Selektoren `getWert`, `getProduktverkaeufeSoll` (je Plattform oder Summe), `isManuelleOverride`; Mutationen `upsertZelle` (null = einzelner Reset, optimistisch + Rollback) und `resetAll` (global). Merge: manuell (blau) → berechnet/grau (nur Produktverkäufe) → leer.
- `src/components/langfristige-einnahmenplanung-tabelle.tsx` — Hauptkomponente, gespiegelt von `einnahmenplanung-tabelle.tsx`, aber **monatsbasiert** und **ohne Ist-/Vergangenheits-Schicht** (keine doppelten Spalten, keine Trennlinie, kein monthGroups). Einklappbarer Kategoriebaum (total / category-header / leaf), Produktverkäufe-Plattform-Unterzeilen (wenn PV im KPI-Modell keine L2-Kinder hat), Inline-Edit mit Auto-Save, grauer/blauer Punkt, Betragsselektion (`data-betrag-selektion`), versionsgebundene Notizen (`seite = 'einnahmenplanung'`), globaler Reset-Dialog + „Auf automatisch zurücksetzen" für selektierte manuelle Produktverkäufe-Zellen, Gesamt-Zeile „Einnahmen (Gesamt)" unten. Einmalige Header-Zeile mit Monatslabels; sticky Label-Spalte; horizontales Scrollen.
- `src/app/dashboard/langfristige-planung/[versionId]/einnahmenplanung/page.tsx` — Seite, nutzt `LangfristigeVersionShell` (fullWidth). Löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab.

**Geänderte Dateien:**
- `src/lib/langfristige-planung-nav.ts` — Eintrag „Einnahmenplanung" (Slug `einnahmenplanung`) in der Gruppe „Planung" nach „Sales-Plattform-Planung" ergänzt. NavSheet **und** Versions-Übersicht rendern die Gruppen generisch → Eintrag/Kachel erscheint automatisch.

**Hinweise/Abweichungen:**
- Einnahmen-Kategorien stammen aus dem **globalen** KPI-Modell (das langfristige KPI-Modell hat keinen Einnahmen-Reiter) — identisch zur Kurzfristplanung. Leerzustand verlinkt auf `/dashboard/kpi-modell`.
- Berechnete Produktverkäufe werden **nicht** persistiert; grau/blau leitet sich allein aus „manueller Eintrag vorhanden?" ab. Daher entfällt die in PROJ-52 nötige Logik zum Entfernen auto-gespeicherter Einträge aus der Werte-Map.
- `npx tsc --noEmit` und `npm run lint` für die neuen/geänderten Dateien sauber.
- **Offen für /backend:** Tabelle `langfristige_einnahmen_planung` + Routen `…/einnahmen-planung` (GET/PUT/DELETE) und `…/einnahmen-planung/produktverkaeufe-berechnet` (GET) existieren noch nicht — bis dahin lädt die Seite ohne Absturz, zeigt aber leere Produktverkäufe (kein berechneter Wert) und kann keine manuellen Werte speichern.

### Backend (PROJ-89 Backend) — 2026-06-22

DB-Migration (`proj89_langfristige_einnahmen_planung`, angewendet auf Projekt `kdmpghtdoguppfqhdscq`):
- Neue Tabelle `langfristige_einnahmen_planung` (id, user_id → `auth.users` ON DELETE CASCADE, plan_version_id → `langfristige_planversionen` ON DELETE CASCADE, `kategorie_id` UUID (kein harter FK — verweist je Zeile auf eine globale Einnahmen-Kategorie **oder** eine Sales-Plattform der Version), jahr, monat CHECK 1–12, `betrag_manuell` NUMERIC(14,2) nullable, created/updated_at).
- UNIQUE `(plan_version_id, kategorie_id, jahr, monat)`; Indizes auf user_id und plan_version_id.
- RLS aktiviert; 4 Policies (SELECT/INSERT/UPDATE/DELETE) je `auth.uid() = user_id`. Supabase-Security-Advisor meldet **keine** Findings für die neue Tabelle.

Neue Routen:
- `src/app/api/langfristige-planung/[versionId]/einnahmen-planung/route.ts` — GET (alle manuellen Werte der Version), PUT (Upsert; `betrag_manuell = null` löscht den Eintrag = einzelnes Zurücksetzen), DELETE (globaler Reset: löscht alle manuellen Werte **und** die Notizen mit `seite = 'einnahmenplanung'`). `requireAuth` + `ensureLangfristigeVersion`; Zod-Validierung (UUID, jahr 2000–2100, monat 1–12, betrag nullable). Validierung läuft im PUT vor der Versions-Prüfung.
- `src/app/api/langfristige-planung/[versionId]/einnahmen-planung/produktverkaeufe-berechnet/route.ts` — GET. Portiert die kurzfristige PROJ-52-Zahlungszeitpunkt-Logik auf Monate + Versions-Daten, **ohne Persistierung**:
  - Monatsfenster aus `langfristige_grundeinstellungen` (ab Startmonat, allgemeiner Horizont; Fallback aktueller Monat + 12).
  - Nettoerlös je Plattform je Monat aus der langfristigen Sales-Plattform-Planung: interner Fetch der `…/sales-plattform-planung/berechnet`-Route (DRY, dieselben Werte wie die SPP-Seite) gemerged mit den manuellen Überschreibungen aus `langfristige_sales_plattform_planung`; `net = bruttoumsatz − rabatte − rueckerstattungen − verkaufsgebuehr − retouren`.
  - Zahlungsmonate ab Ankermonat (`erster_auszahlung_monat`/`-jahr`) im Rhythmus (monatlich=1 / alle_zwei_monate=2 / quartalsweise=3); kein Ankermonat → Plattform trägt nichts bei.
  - Erlös-Fenster je Zahlungsmonat Z: `[Z − V − R + 1 … Z − V]` (V = `verschiebung_monate`). Marketing-Abzug für zugeordnete Marketingkanäle (`langfristige_auszahlungs_marketingkanaele`) wird **NICHT** mit V verschoben, sondern am Auszahlungsmonat ausgerichtet — Fenster `[Z − R + 1 … Z]`, identisch zur Kurzfristplanung (PROJ-52). (Nutzer-Entscheidung 2026-06-22: Marketingkosten sollen nicht verschoben werden.)
  - Ankermonat ist ein Planungs-Eingabewert (NICHT heute-relativ fortgeschrieben → vermeidet PROJ-76-BUG-4). Antwort: `{ jahr, monat, sales_plattform_id, wert }[]`, nach Monat sortiert.

Frontend-Anbindung: keine Änderungen nötig — der Hook `useLangfristigeEinnahmenplanung` ruft exakt diese Endpunkte und das erwartete Datenformat.

Tests: `einnahmen-planung/route.test.ts` (16) + `einnahmen-planung/produktverkaeufe-berechnet/route.test.ts` (11) = **27 Tests grün**. Decken ab: GET/PUT/DELETE Happy-Path, Validierungs-/Auth-/Version-Fehler (400/401/404/500), einzelnes Zurücksetzen (null), sowie die Zahlungszeitpunkt-Berechnung (monatliche Auszahlung, Marketing-Abzug bei zugeordnetem Kanal, V=2-Monatsverschiebung, Sortierung, Skip-ohne-Ankermonat). Regression: Sales-Plattform-Planung-Suite (27) weiterhin grün. `tsc --noEmit` für die neuen Routen sauber (vorbestehende Fehler nur in der untracked kurzfristigen `einnahmen-planung/route.test.ts`).

## QA Test Results (2026-06-22)

### Testergebnis-Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| Akzeptanzkriterien | ✅ Alle erfüllt (Code-Review + Tests + Live-Datenverifikation) |
| API-Integrationstests (Vitest) | ✅ 28/28 (16 CRUD + 12 Berechnung) |
| Verwandte Suiten (Regression) | ✅ 68/68 (einnahmen-planung + sales-plattform-planung + planung-notizen) |
| E2E-Tests (Playwright, Chromium) | ✅ 7/7 |
| Live-Berechnung gegen echte Daten | ✅ Verifiziert (Testversion1, Juni/Juli 2026) |
| Sicherheitsaudit | ✅ Keine Findings (Advisor + Red-Team) |
| Bugs gefunden | 2 (beide **behoben**): 1 Low (UI) · 1 Design-Korrektur |
| **Produktionsbereitschaft** | ✅ **READY** |

### Akzeptanzkriterien — geprüft

**Navigation & Einstieg** — ✅ Nav-Eintrag „Einnahmenplanung" (Gruppe „Planung") in `langfristige-planung-nav.ts`; Seite existiert (E2E kein 404); Auth-Guard → Redirect `/login` (E2E); fremde/ungültige `versionId` → `ensureLangfristigeVersion` liefert 400/404 (API-Tests), Shell-Redirect.

**Monatsspalten** — ✅ `buildEinnahmenMonate` startet exakt am Startmonat, **kein** Vorlauf, `planungshorizont_monate` Monate (Fallback 12); Label „Apr. 2026"; Jahreswechsel via Monatsüberlauf; **keine** Ist-/Vergangenheitsspalten; horizontal scrollbar, Label-Spalte sticky.

**Zeilenhierarchie** — ✅ globale Einnahmen-Kategorien (`type=einnahmen`) mit L2-Untergruppen; Produktverkäufe per Name erkannt; Plattform-Unterzeilen je Sales Channel, wenn PV keine L2-Kinder hat; Gesamt-Zeile „Einnahmen (Gesamt)" unten; `sort_order`; „Alle aus-/einklappen" + „Zurücksetzen".

**Produktverkäufe (Zahlungszeitpunkt)** — ✅ server-seitig je Plattform × Auszahlungsmonat; Nettoerlös aus SPP-`berechnet` + manuelle Overrides; Zahlungsmonate ab Ankermonat im Rhythmus; Erlös-Fenster `[Z−V−R+1 … Z−V]`; Marketing-Abzug am Auszahlungsmonat `[Z−R+1 … Z]` (ohne V, Nutzer-Entscheidung); grauer Punkt. **Live verifiziert** an Testversion1.

**Manuelle Eingabe/Persistenz** — ✅ Inline-Edit, Auto-Save onBlur, ≥0 (Frontend), NULL=leer, versionsgebundene Tabelle, optimistisch + Rollback; Aggregations-/Gesamtzeilen nicht editierbar, „—" wenn alle Kinder NULL.

**Indikatoren / Reset / Notizen / Betragsselektion / Datenisolation / DB / API** — ✅ grau/blau korrekt; globaler Reset (Werte + Notizen) und einzelnes Zurücksetzen von PV-Zellen; Notizen versionsgebunden `seite='einnahmenplanung'`; Betragsselektion (Klick/Ctrl); Filter nach `user_id` + `plan_version_id` + RLS; Tabelle `langfristige_einnahmen_planung` (UNIQUE, Indizes, 4 RLS-Policies); GET/PUT/DELETE + `produktverkaeufe-berechnet`, `requireAuth` + Zod; **keine** `/ist-tatsaechlich`-Route.

### Live-Berechnungsverifikation (Testversion1)
Manuell gegen die Datenbank durchgerechnet und gegen die Routenlogik abgeglichen:
- **Juni 2026:** Amazon = leer (alle-2-Monate-Raster ab März → Juni kein Auszahlungsmonat); Otto = Netto Mai 8.811,98 €; Shop leer.
- **Juli 2026:** Amazon = Netto (Mai+Juni) 78.962,64 − Marketing (Juni+Juli, ohne V) 17.726,84 = **61.235,80 €**; Otto = Netto Juni 8.984,77 €.
- USt-Aufschlag (Verkaufsgebühr/Retouren/Marketing) 19 % korrekt angewandt.

### Automatisierte Tests
- **API** `einnahmen-planung/route.test.ts` (16): GET (200/[]/404/400/401/500), PUT (Upsert, null=einzelner Reset, 400 ungültiger Monat/UUID, 404, 401, 500), DELETE (Werte+Notizen, 404, 401, 500).
- **API** `produktverkaeufe-berechnet/route.test.ts` (12): 401/400/404, leer ohne Auszahlungseinstellungen, 500, Skip ohne Ankermonat, monatliche Auszahlung, Marketing-Abzug, **Marketing NICHT mit V verschoben** (Regressions-Test), V=2-Verschiebung, Sortierung/Felder.
- **E2E** `tests/PROJ-89-…spec.ts` (7, Chromium): Seitenexistenz, Auth-Guard (Seite + beide API-Routen), Dashboard-Redirect, Regression kurzfristige Einnahmenplanung + langfristige Sales-Plattform-Planung erreichbar.

### Sicherheitsaudit (Red Team)
- ✅ **Auth:** `requireAuth()` in allen Routen (401); Middleware-Redirect auf API (E2E).
- ✅ **Authorization/IDOR:** `ensureLangfristigeVersion` (404 bei fremder Version); alle Queries zusätzlich nach `user_id` + `plan_version_id` gefiltert; RLS (`auth.uid() = user_id`) als zweite Ebene.
- ✅ **Input-Validierung:** Zod (UUID, jahr 2000–2100, monat 1–12, NUMERIC/null); DB-CHECK auf monat.
- ✅ **Mass Assignment:** nur explizite Felder; `user_id` aus Session.
- ✅ **XSS/Injection:** nur Zahlen/UUIDs; Supabase parametrisiert; kein `dangerouslySetInnerHTML`.
- ✅ **Advisor:** keine Findings für `langfristige_einnahmen_planung`.

### Bugs / Hinweise

**BUG-1 (Low) — ✅ BEHOBEN — Zelle wird beim Editieren breiter.** Beim Klick in eine Zelle dehnte das in-flow gerenderte Number-`<input>` (inkl. Spinner) die Spalte auf. Fix: Input absolut über die Zelle (`absolute inset-0`), `size={1}` + `min-w-0`, Spinner ausgeblendet — gleiches Muster wie Sales-Plattform-Planung. Spaltenbreite bleibt jetzt konstant.

**BUG-2 (Design-Korrektur) — ✅ BEHOBEN — Verschiebung wurde auf Marketingkosten angewandt.** Ursprünglich folgte das Marketing-Abzugsfenster dem Erlös-Fenster (`[Z−V−R+1 … Z−V]`, also mit V). Auf Nutzer-Entscheidung umgestellt auf payout-ausgerichtetes Fenster `[Z−R+1 … Z]` (ohne V), konsistent mit der Kurzfristplanung. Regressions-Test ergänzt.

**Hinweis (Low, nicht blockierend):** Negative Beträge werden serverseitig nicht abgelehnt (nur das Frontend blockt < 0) — konsistent mit der bestehenden langfristigen Sales-Plattform-Route; für die manuelle PV-Korrektur sogar nützlich.

**Hinweis (Low):** Der Produktverkäufe-Endpunkt zieht die SPP-Werte per internem Fetch der `sales-plattform-planung/berechnet`-Route (Cookie-Forwarding) — bewusst zur Vermeidung von Logik-Duplikat, identisch zum kurzfristigen Muster.

### Produktionsbereitschaft
✅ **READY** — alle Akzeptanzkriterien erfüllt, keine Critical/High/Medium-Bugs (die 2 gefundenen Punkte sind behoben), Sicherheitsaudit ohne Findings, Live-Berechnung verifiziert, keine Regressionen.

> Hinweis: Die in dieser Session vorgenommenen Änderungen (Backend-Routen, Frontend, Marketing-Fenster-Korrektur, UI-Fix, Tests) sind noch **nicht committet**.

## Deployment
_To be added by /deploy_
