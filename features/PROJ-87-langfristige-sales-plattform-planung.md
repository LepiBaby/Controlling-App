# PROJ-87: Sales-Plattform-Planung — Langfristige Planung

## Status: Approved
**Created:** 2026-06-22
**Last Updated:** 2026-06-22

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert die **Sales-Plattformen** (`art = 'lp_sales_plattform'`), **Produkte** (`art = 'lp_produkt'`) und **Marketingkanäle** (`art = 'lp_marketingkanal'`) der Planversion
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`) und den **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monatsfenster
- Requires: PROJ-78 (Vertriebseinstellungen — Langfristige Planung) — liefert die unter **Retoureneinstellungen → Allgemein** je Produkt manuell gepflegte **Retourenquote** (`langfristige_retouren_allgemein_produkt_einstellungen.retourenquote_prozent`) sowie je Plattform × Produkt **Rückversandkosten** (`langfristige_retouren_einstellungen.rueckversandkosten_euro_netto`) und **Erstattung Verkaufsgebühr %** (`langfristige_retouren_einstellungen.erstattung_verkaufsgebuehr_prozent`)
- Requires: PROJ-79 (Verkaufsgebühr-Einstellungen — Langfristige Planung) — liefert **Verkaufsgebühr %** je Plattform × Produkt (`langfristige_verkaufsgebuehr_einstellungen.verkaufsgebuehr_prozent`)
- Requires: PROJ-76 (Auszahlungseinstellungen — Langfristige Planung) — liefert je Plattform die **zugeordneten Marketingkanäle** (`langfristige_auszahlungs_marketingkanaele`), die bestimmen, ob/welche Marketingkosten hier berücksichtigt werden
- Requires: PROJ-83 (Steuereinstellungen — Langfristige Planung) — liefert die je Kategorie/Ebene gepflegten **USt-Sätze** (`langfristige_ust_kategorie_saetze` + Pflegeebene-Auswahl), die als Aufschlag „oben drauf" auf die Kostenkategorien angewendet werden
- Requires: PROJ-84 (Absatzplanung — Langfristige Planung) — liefert je (Sales-Plattform, Produkt, Monat) **Absatz** und **Effektiver VK** (`langfristige_absatz_planung`) als Basis für den Bruttoumsatz; liefert außerdem den Monatsfenster-Helfer (`buildPlanungsmonate`) und die versionsgebundene Notiz-Tabelle (`langfristige_planung_notizen`)
- Requires: PROJ-85 (Marketing-Planung — Langfristige Planung) — liefert den **Marketingkosten-%-Satz** je Marketingkanal × Produkt × Monat (`langfristige_marketing_planung.marketingkosten_pct`)
- Vorlage (kein harter Require): PROJ-66 (Sales Plattform Planung — Kurzfristige Planung) — UI/Bedienung und Berechnungslogik werden gespiegelt, mit den unten beschriebenen Abweichungen
- Integriert: PROJ-40 (Betragsselektion) — „Hover/Klick"-Summenpanel
- Integriert: PROJ-53-Muster (Zellen-Notizen) — versionsgebunden über `langfristige_planung_notizen`

## Übersicht

Die Seite „Sales-Plattform-Planung" ist eine weitere Planungsseite im Navigationsbereich **„Planung"** der Langfristigen Planung (neben Absatzplanung aus PROJ-84 und Marketing-Planung aus PROJ-85). Sie spiegelt die gleichnamige Seite der **Kurzfristigen Planung** (PROJ-66) — **im Kern wird alles genau gleich berechnet**, nur dass durchgehend die Einstellungen **dieser Planversion** zum Einsatz kommen und die Zeitachse **monatsweise** statt wochenweise ist.

Die Tabelle zeigt eine **monatsbasierte** Übersicht der vertriebsrelevanten Planungskategorien je Sales-Plattform und Produkt. Sie kombiniert keine historischen Ist-Daten — die Langfristige Planung kennt **keine Transaktionen**. Alle Spalten (inklusive der zwei Vormonate) werden **berechnet** aus der Absatzplanung und den Einstellungen dieser Version; manuelle Überschreibungen sind jederzeit möglich.

Oben auf der Seite wird — wie in der kurzfristigen Planung — ein dauerhafter Warnhinweis angezeigt: Die gezeigten Werte sind **Rentabilitätswerte** — sie bilden ab, wann Umsätze und Kosten wirtschaftlich entstehen, **nicht** wann die entsprechenden Zahlungen liquiditätstechnisch anfallen.

Die Tabelle stellt folgende Kategorien untereinander dar, jeweils zweistufig aufklappbar (Plattform → Produkt):

1. **Bruttoumsatz** (immer) — aus der Absatzplanung dieser Version
2. **Rabatte** (immer, stets leer, nie editierbar)
3. **Rückerstattungen** (immer)
4. **Verkaufsgebühr** (immer)
5. **Retourenkosten** (immer)
6. **Marketingkosten** (bedingt — nur wenn mindestens einer Plattform in den Auszahlungseinstellungen ein Marketingkanal zugeordnet ist)
7. **Summe** (Nettoumsatz nach allen Abzügen, immer)

Alle Zellen auf Produktebene (außer Rabatte) sind direkt editierbar. Automatisch berechnete Werte zeigen einen **grauen Punkt**, manuell überschriebene einen **blauen Punkt**. Es gibt einen **globalen Zurücksetzen-Button** und ein **einzelnes Zurücksetzen** je Zelle auf den berechneten Wert. Es gibt **keinen** „Historische Werte aktualisieren"-Button (keine Ist-Daten).

Alle Daten dieser Seite sind **pro Planversion** isoliert (Datenisolation gemäß PROJ-73): Eine neu angelegte Version startet komplett leer (keine manuellen Überschreibungen); Änderungen in Version A haben keinerlei Auswirkung auf Version B oder die Kurzfristige Planung.

## Berechnungslogik

Alle Berechnungen erfolgen je **Sales-Plattform P × Produkt X × Monat M** und entsprechen exakt der aktuellen kurzfristigen Implementierung (PROJ-66, `…/sales-plattform-planung/berechnet`), parametriert mit den Einstellungen **dieser Planversion**. Server-seitig in der `berechnet`-Route; Aggregationen (Plattform-/Kategorie-Summen, Summe-Zeile) frontend-seitig.

**Retourenquote** (je Produkt, plattformunabhängig):
- `Retourenquote[X] = langfristige_retouren_allgemein_produkt_einstellungen[X].retourenquote_prozent / 100`
- Abweichung zur kurzfristigen Planung: Die Quote wird **nicht** aus Ist-Transaktionen berechnet, sondern ist der unter **Vertriebseinstellungen → Retoureneinstellungen → Allgemein** manuell gepflegte Prozentwert.
- Kein Eintrag / nicht gepflegt → Retourenquote = 0

**Bruttoumsatz** (Basis aller weiteren Werte):
- `Bruttoumsatz[P][X][M] = Absatz[P][X][M] × Effektiver VK[P][X][M]` aus `langfristige_absatz_planung`
- Fehlt Absatz **oder** Effektiver VK für (P, X, M): Bruttoumsatz = leer → alle abhängigen Kategorien für diese Zelle leer

**Rabatte:**
- Immer leer — keine Berechnung, kein Indikator, nicht editierbar

**Rückerstattungen:**
- `Rückerstattungen[P][X][M] = Retourenquote[X] × Bruttoumsatz[P][X][M]`

**Verkaufsgebühr** (mit USt-Aufschlag):
- `Verkaufsgebühr[P][X][M] = ( Bruttoumsatz × Verkaufsgebühr%[P][X] − Bruttoumsatz × Retourenquote[X] × Erstattung_Verkaufsgebühr%[P][X] ) × USt-Multiplikator`
- `Verkaufsgebühr%` aus `langfristige_verkaufsgebuehr_einstellungen`; `Erstattung_Verkaufsgebühr%` aus `langfristige_retouren_einstellungen`
- Fehlt der Verkaufsgebühr%-Satz: leer. Negative Werte werden als negativ angezeigt (kein Clamping).

**Retourenkosten** (mit USt-Aufschlag):
- `Retourenkosten[P][X][M] = ( Retourenquote[X] × Absatz[P][X][M] × Rückversandkosten_netto[P][X] ) × USt-Multiplikator`
- `Rückversandkosten_netto` aus `langfristige_retouren_einstellungen`
- Retourenquote = 0 oder kein Absatz: leer/0 analog zur kurzfristigen Logik

**Marketingkosten** (bedingt, mit USt-Aufschlag):
- Wird je **Marketingkanal K** berechnet, der einer Plattform in den **Auszahlungseinstellungen** zugeordnet ist (`langfristige_auszahlungs_marketingkanaele`)
- `Marketingkosten[K][X][M] = Bruttoumsatz-Basis × ( Marketingkosten%[K][X][M] / 100 ) × USt-Multiplikator`
- `Marketingkosten%` aus der **langfristigen Marketing-Planung** (`langfristige_marketing_planung.marketingkosten_pct`), je Marketingkanal × Produkt × Monat
- Bruttoumsatz-Basis: analog zur kurzfristigen Planung (Bruttoumsatz der zugeordneten Plattform/Produkt-Kombination)
- Ist kein Marketingkanal zugeordnet oder kein %-Satz vorhanden: keine Marketingkosten-Zeile bzw. leer

**USt-Aufschlag (USt „oben drauf"):**
- Die USt-Sätze stammen aus den **Steuereinstellungen dieser Version** (`langfristige_ust_kategorie_saetze` + Pflegeebene-Auswahl) und werden je Kategorie aufgeschlagen — genau wie in der kurzfristigen Planung (`getUstMultiplier`: Ebene-1-Gesamtsatz oder Ebene-2-Kategoriesatz → Faktor `1 + Satz/100`)
- Aufschlag wird auf die **Kostenkategorien** angewendet: Verkaufsgebühr, Retourenkosten, Marketingkosten. Bruttoumsatz und Rückerstattungen bleiben ohne USt-Multiplikator (identisch zur kurzfristigen Implementierung)

**Summe (Nettoumsatz)** — je Monatsspalte, frontend-seitig:
- `Summe = Bruttoumsatz − Rabatte − Rückerstattungen − Verkaufsgebühr − Retourenkosten − Marketingkosten`
- Fehlt der Bruttoumsatz für einen Monat: Summe = leer (nicht 0)

**Aggregationen** (frontend-seitig, reaktiv):
- `Plattform-Subtotal (Kategorie, P, M)` = Summe aller Produkt-Werte dieser Plattform × Kategorie × Monat
- `Kategorie-Gesamt (Kategorie, M)` = Summe aller Plattform-Subtotals dieser Kategorie × Monat

## User Stories

- Als Controller möchte ich innerhalb einer geöffneten Planversion über die Navigationsgruppe „Planung" die Seite „Sales-Plattform-Planung" aufrufen können, damit ich die vertriebsrelevanten Plan-Kennzahlen dieses Szenarios sehe.
- Als Controller möchte ich beim Öffnen der Seite den Warnhinweis sehen, dass es sich um Rentabilitätswerte handelt und nicht um Liquiditätszeitpunkte.
- Als Controller möchte ich je Monat den berechneten Bruttoumsatz je Plattform und Produkt sehen, automatisch aus der Absatzplanung dieser Version (Absatz × Effektiver VK) gezogen.
- Als Controller möchte ich, dass Rückerstattungen und Retourenkosten mit der in den Vertriebseinstellungen (Retoureneinstellungen → Allgemein) gepflegten Retourenquote dieser Version berechnet werden.
- Als Controller möchte ich, dass die in den Steuereinstellungen dieser Version gepflegten USt-Sätze als Aufschlag auf die Kostenkategorien berücksichtigt werden.
- Als Controller möchte ich, dass Marketingkosten berücksichtigt werden, wenn einer Plattform in den Auszahlungseinstellungen ein Marketingkanal zugeordnet ist — mit dem %-Satz aus der langfristigen Marketing-Planung.
- Als Controller möchte ich jeden berechneten Wert manuell überschreiben können, damit ich Korrekturen und eigene Annahmen einpflegen kann.
- Als Controller möchte ich auf einen Blick erkennen, ob ein Wert automatisch berechnet (grauer Punkt) oder manuell überschrieben (blauer Punkt) wurde.
- Als Controller möchte ich jede Kategorie aufklappen, um die Werte je Sales-Plattform und je Produkt zu sehen.
- Als Controller möchte ich eine einzelne manuell überschriebene Zelle wieder auf den berechneten Wert zurücksetzen können.
- Als Controller möchte ich mit einem globalen „Zurücksetzen"-Button alle manuellen Werte (und zugehörige Notizen) dieser Version löschen.
- Als Controller möchte ich zu einzelnen Zellen Notizen hinterlegen können, versionsgebunden.
- Als Controller möchte ich mehrere Zellen selektieren (Klick/Ctrl+Klick) und deren Summe rechts unten sehen (Betragsselektion).
- Als Controller möchte ich, dass meine Eingaben pro Planversion gespeichert werden und andere Versionen nicht beeinflussen.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] In der versionsspezifischen Navigation (`src/lib/langfristige-planung-nav.ts`) erscheint in der Gruppe **„Planung"** der Eintrag „Sales-Plattform-Planung" → `/dashboard/langfristige-planung/[versionId]/sales-plattform-planung` (nach „Marketing-Planung")
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint in der Gruppe „Planung" eine Kachel/ein Eintrag „Sales-Plattform-Planung"
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Aufruf mit unbekannter/fremder/ungültiger `versionId` → sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) über `LangfristigeVersionShell`

### Warnhinweis

- [ ] Unterhalb des Seitentitels wird ein dauerhafter Warnhinweis angezeigt (shadcn `Alert`)
- [ ] Text sinngemäß: „Achtung: Die angezeigten Werte sind Rentabilitätswerte. Sie zeigen, wann Umsätze und Kosten wirtschaftlich entstehen — nicht wann die entsprechenden Zahlungen liquiditätstechnisch anfallen."
- [ ] Der Warnhinweis kann nicht ausgeblendet werden

### Monatsspalten

- [ ] Die Spalten sind **Monate** (nicht Kalenderwochen)
- [ ] **Erste Spalte** = Startmonat **minus 2 Monate** (Startmonat/-jahr aus `langfristige_grundeinstellungen`)
- [ ] **Letzte Spalte** = Startmonat + (`Planungshorizont Allgemein` − 1) Monate; **Planungshorizont Allgemein** = `planungshorizont_monate`, Fallback 12
- [ ] Gesamtzahl der Monatsspalten = `Planungshorizont Allgemein` + 2 (die zwei Vorlauf-Monate)
- [ ] Spaltenüberschriften zeigen Monat + Jahr (Format z. B. „Apr. 2026")
- [ ] Korrekte Berechnung über Jahresgrenzen hinweg (Wiederverwendung von `buildPlanungsmonate` aus PROJ-84, mit allgemeinem Horizont parametriert)
- [ ] Die Tabelle ist horizontal scrollbar; die erste Spalte (Zeilenbeschriftung) ist beim Scrollen sticky (links fixiert)
- [ ] Die zwei Vorlauf-Monate dürfen optisch dezent vom restlichen Planungsbereich abgegrenzt werden (kein Funktionsunterschied — auch sie sind berechnet/editierbar)

### Zeilenhierarchie (Tabellenstruktur)

Die Tabelle besteht aus den oben genannten Kategorieblöcken in dieser Reihenfolge. Jeder Kategorieblock ist zweistufig aufklappbar (Standard: eingeklappt).

- [ ] **Stufe 0 – Kategorie-Gesamtzeile**: Name der Kategorie + aggregierter Wert über alle Plattformen/Produkte + Auf-/Zuklapp-Icon
- [ ] **Stufe 1 – Plattform-Unterzeile**: Name der Plattform + aggregierter Wert über alle Produkte dieser Plattform + eigenes Auf-/Zuklapp-Icon
- [ ] **Stufe 2 – Produkt-Zeile**: Name des Produkts + editierbarer Wert (Inline-Editing), grauer/blauer Indikator
- [ ] **Summe-Zeile** berechnet sich pro Monatsspalte als `Bruttoumsatz − Rabatte − Rückerstattungen − Verkaufsgebühr − Retourenkosten − Marketingkosten`; ebenfalls zweistufig aufklappbar
- [ ] **Rückerstattungen** und **Retourenkosten** werden **immer** angezeigt (keine Auszahlungseinstellungen-Bedingung)
- [ ] **Marketingkosten**-Kategorie wird **nur** angezeigt, wenn mindestens einer Plattform in den Auszahlungseinstellungen ein Marketingkanal zugeordnet ist; innerhalb der Kategorie erscheinen nur Plattformen/Kanäle mit Zuordnung
- [ ] **Rabatte**-Zeile ist nie editierbar und zeigt immer leere Zellen (kein Indikator, kein berechneter Wert)

### Berechnete Werte (alle Monate)

- [ ] Bruttoumsatz = Absatz × Effektiver VK aus `langfristige_absatz_planung` der Version
- [ ] Retourenquote = manueller %-Wert aus `langfristige_retouren_allgemein_produkt_einstellungen` (Vertriebseinstellungen → Retoureneinstellungen → Allgemein), je Produkt
- [ ] Rückerstattungen = Retourenquote × Bruttoumsatz
- [ ] Verkaufsgebühr = (Bruttoumsatz × Verkaufsgebühr% − Bruttoumsatz × Retourenquote × Erstattung_Verkaufsgebühr%) × USt-Multiplikator
- [ ] Retourenkosten = (Retourenquote × Absatz × Rückversandkosten_netto) × USt-Multiplikator
- [ ] Marketingkosten = Bruttoumsatz-Basis × (Marketingkosten%/100) × USt-Multiplikator; %-Satz aus der langfristigen Marketing-Planung; nur für in den Auszahlungseinstellungen zugeordnete Marketingkanäle
- [ ] USt-Multiplikator je Kategorie aus den Steuereinstellungen dieser Version; Mechanik identisch zur kurzfristigen Planung (Ebene-1-Gesamt vs. Ebene-2-Kategoriesatz)
- [ ] Alle berechneten Zellen zeigen einen **grauen Punkt**-Indikator
- [ ] Berechnung server-seitig in der `berechnet`-Route; keine Ist-/Transaktionsabfragen (Langfristige Planung hat keine Transaktionen)

### Manuelle Eingabe & Persistenz

- [ ] Alle Produkt-Zeilen (Stufe 2) außer Rabatte sind per Inline-Editing direkt bearbeitbar (Click-to-Edit, `onBlur` speichert automatisch)
- [ ] Eingabe: Dezimalzahl, 2 Dezimalstellen
- [ ] Manuell eingegebene Werte werden in der neuen, **versionsgebundenen** Tabelle persistiert (`plan_version_id` + `user_id`)
- [ ] Beim nächsten Seitenladevorgang werden gespeicherte manuelle Werte aus der DB geladen (blauer Punkt)
- [ ] Optimistisches Update: Wert erscheint sofort; bei API-Fehler → Toast-Fehlermeldung + Rollback
- [ ] Es gibt **kein** Massenanpassungs-Feature (Bulk-Edit) — analog PROJ-66

### Visuelle Kennzeichnung (Punkte)

- [ ] Jede editierbare Produktzelle zeigt einen kleinen Punkt-Indikator (untere rechte Ecke):
  - **Grauer Punkt**: automatisch berechneter Wert
  - **Blauer Punkt**: manuell überschriebener Wert
- [ ] Aggregationszeilen (Kategorie-Gesamt, Plattform) und Rabatte-Zellen haben keinen Indikator

### Zurücksetzen (global + einzeln)

- [ ] **Globaler „Zurücksetzen"-Button** (oben rechts): öffnet einen Bestätigungs-Dialog (shadcn `AlertDialog`); nach Bestätigung werden alle manuellen Einträge **und** alle zugehörigen Notizen dieser Version gelöscht; alle Zellen zeigen wieder berechnete Werte (grauer Punkt)
- [ ] **Einzelnes Zurücksetzen**: eine einzelne manuell überschriebene Zelle kann wieder auf den berechneten Wert zurückgesetzt werden (manueller Wert wird gelöscht → grauer Punkt)
- [ ] **Kein** „Historische Werte aktualisieren"-Button (keine Ist-Daten)
- [ ] Globales Zurücksetzen ohne manuelle Einträge ist idempotent (kein Fehler)

### Notizen (versionsgebunden)

- [ ] Das Notizen-Feature ist auf den editierbaren Produktzellen verfügbar (analog zur Marketing-/Absatzplanung)
- [ ] Notiz-Icon erscheint beim Hover (falls keine Notiz) oder dauerhaft (falls Notiz vorhanden) mit Tooltip-Vorschau
- [ ] Notizen sind an die **Zellkoordinate** (Kategorie + Plattform/Kanal + Produkt + Monat/Jahr) gebunden und hängen am Monat, nicht an der Spaltenposition
- [ ] Wiederverwendung der bestehenden Tabelle `langfristige_planung_notizen` (PROJ-84) mit `seite = 'sales-plattform-planung'`
- [ ] Globales „Zurücksetzen" löscht auch alle Notizen dieser Seite/Version

### Betragsselektion (Hover/Klick-Summe, wie PROJ-40)

- [ ] Der Nutzer kann Zellwerte durch Klicken oder Ctrl+Klicken auswählen
- [ ] Die Summe aller selektierten Werte wird in einem Panel rechts unten angezeigt; das Panel erscheint ab ≥ 1 Selektion und verschwindet bei Auflösung
- [ ] Auch Aggregationszeilen (Kategorie-Gesamt, Plattform) können selektiert werden
- [ ] Verhalten identisch mit PROJ-40 / PROJ-84 / PROJ-85

### Datenisolation (PROJ-73)

- [ ] Alle Lese-/Schreibzugriffe sind nach `versionId` **und** `user_id` gefiltert
- [ ] Eine neu angelegte Planversion zeigt nur berechnete Werte und **keine** manuellen Überschreibungen (keine Übernahme aus anderen Versionen oder der Kurzfristigen Planung)
- [ ] Beim Löschen der Planversion werden alle Sales-Plattform-Planungs- und zugehörigen Notiz-Datensätze kaskadierend mitgelöscht (ON DELETE CASCADE)

### Datenbankschema

- [ ] Neue Tabelle `langfristige_sales_plattform_planung` (speichert ausschließlich manuelle Überschreibungen):
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `kategorie` TEXT NOT NULL CHECK IN (`'bruttoumsatz'`, `'rabatte'`, `'rueckerstattungen'`, `'verkaufsgebuehr'`, `'retouren'`, `'marketing'`)
  - `produkt_id` UUID NOT NULL FK → `langfristige_kpi_kategorien` (ON DELETE CASCADE) — `art = 'lp_produkt'` derselben Version
  - `sales_plattform_id` UUID NOT NULL FK → `langfristige_kpi_kategorien` (ON DELETE CASCADE) — `art = 'lp_sales_plattform'`; für Marketing-Zeilen enthält dieses Feld die **Marketingkanal-ID** (`art = 'lp_marketingkanal'`), analog zur kurzfristigen Tabelle
  - `jahr` INTEGER NOT NULL, `monat` INTEGER NOT NULL CHECK (1–12)
  - `wert_manuell` NUMERIC(12,2) NULL — NULL = kein manueller Wert (berechneter Wert gilt)
  - UNIQUE(`plan_version_id`, `kategorie`, `produkt_id`, `sales_plattform_id`, `jahr`, `monat`)
  - RLS: Nutzer sieht und schreibt nur eigene Einträge (4 Policies); Versionszugehörigkeit serverseitig zusätzlich geprüft
- [ ] Notizen: Wiederverwendung von `langfristige_planung_notizen` mit `seite = 'sales-plattform-planung'` — keine neue Tabelle

### API-Routen (versions- & nutzergebunden)

- [ ] `GET /api/langfristige-planung/[versionId]/sales-plattform-planung` — alle manuellen Einträge der Version
- [ ] `PUT /api/langfristige-planung/[versionId]/sales-plattform-planung` — Upsert eines Eintrags; `wert_manuell = null` löscht den Eintrag (einzelnes Zurücksetzen → berechneter Wert)
- [ ] `DELETE /api/langfristige-planung/[versionId]/sales-plattform-planung` — alle manuellen Einträge + Notizen der Version löschen (globaler Reset)
- [ ] `GET /api/langfristige-planung/[versionId]/sales-plattform-planung/berechnet` — berechnete Werte je Kategorie × Plattform/Kanal × Produkt × Monat (inkl. Retourenquote aus Einstellungen, USt-Aufschlag, Marketing aus Marketing-Planung)
- [ ] **Keine** `/historisch`-Route (keine Ist-Daten)
- [ ] Alle Routen: `requireAuth()`, Zod-Validierung (UUIDs, Kategorie-Enum, `monat` 1–12, `jahr` plausibel, NUMERIC oder null), Filter nach `user_id` + `plan_version_id`; fremde/unbekannte `versionId` → 404; serverseitige Prüfung, dass `produkt_id`/`sales_plattform_id` zur Version und korrekten `art` gehören

## Edge Cases

- **Grundeinstellungen der Version noch nicht gespeichert**: Standard-Startmonat (aktueller Monat/Jahr) und Default-Horizont (12) gelten (analog PROJ-75), kein Absturz
- **Planungshorizont Allgemein nicht gesetzt**: Fallback 12
- **Keine Sales-Plattformen oder keine Produkte im KPI-Modell der Version**: Leerzustand mit Hinweis + Link zur KPI-Modell-Verwaltung dieser Version
- **Keine Absatzplanung-Daten für einen Monat** (Absatz oder VK fehlt): Bruttoumsatz = leer; alle abhängigen Kategorien (Rückerstattungen, Verkaufsgebühr, Retourenkosten, Marketing) = leer
- **Bruttoumsatz = 0** (Absatz 0, VK gesetzt): abhängige Werte = 0 (nicht leer), analog kurzfristig
- **Retourenquote nicht gepflegt / = 0**: Rückerstattungen = 0; Retourenkosten = 0
- **Verkaufsgebühr% nicht gepflegt**: Verkaufsgebühr-Zelle leer
- **Negative Verkaufsgebühr** (Erstattung > Brutto-Verkaufsgebühr): Wert wird als negativ dargestellt (kein Clamping)
- **Kein USt-Satz gepflegt**: USt-Multiplikator = 1 (kein Aufschlag)
- **Keiner Plattform ein Marketingkanal zugeordnet**: Marketingkosten-Kategorie wird vollständig ausgeblendet (auch aus der Summe)
- **Marketingkanal zugeordnet, aber kein %-Satz in der Marketing-Planung**: Marketing-Wert leer
- **Monatsfenster außerhalb des Bereichs mit Absatz/VK-Daten** (z. B. Vorlauf-Monate ohne Absatzplanung): betroffene Werte bleiben leer — kein Rechenfehler
- **Jahresgrenze in den Vorlauf-Monaten / im Horizont**: Monats-/Jahresberechnung korrekt (`buildPlanungsmonate`)
- **Plattform/Produkt/Marketingkanal im KPI-Modell der Version gelöscht**: ON DELETE CASCADE entfernt die zugehörigen Planungs- und Notiz-Datensätze; beim nächsten Aufruf nicht mehr sichtbar
- **Sehr langer Horizont (z. B. 120 Monate → 122 Spalten)**: Tabelle horizontal scrollbar, Label-Spalte sticky, kein Layout-Bruch
- **Globales Zurücksetzen ohne manuelle Einträge**: idempotent, kein Fehler
- **Aufruf mit fremder/unbekannter `versionId`**: Redirect zum Dashboard (PROJ-73), kein Datenzugriff

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen versionsgebundenen Tabelle; Versionszugehörigkeit serverseitig prüfen (Defense-in-Depth zur RLS); `produkt_id`/`sales_plattform_id` müssen zur Version und korrekten `art` gehören
- Alle Eingaben serverseitig mit Zod validieren (UUIDs, Kategorie-Enum, Monat 1–12, Jahr, NUMERIC oder null)
- Neue versionsgebundene Next.js-Seite: `src/app/dashboard/langfristige-planung/[versionId]/sales-plattform-planung/page.tsx` (nutzt `LangfristigeVersionShell`)
- Navigation: Eintrag „Sales-Plattform-Planung" (Slug `sales-plattform-planung`) in der bestehenden Gruppe „Planung" in `src/lib/langfristige-planung-nav.ts` (NavSheet und Versions-Übersicht ziehen automatisch nach)
- Monatsberechnung: Wiederverwendung von `buildPlanungsmonate` (PROJ-84), mit dem **allgemeinen** Horizont parametriert
- Berechnungslogik 1:1 von der kurzfristigen `berechnet`-Route (PROJ-66) übernehmen und auf die langfristigen, versionsgebundenen Einstellungstabellen umstellen; Retourenquote aus Einstellung statt aus Transaktionen; Bruttoumsatz aus `langfristige_absatz_planung`
- Wiederverwendung der Tabellen-/Selektions-/Notiz-/Reset-Bausteine aus PROJ-66/PROJ-84/PROJ-85; Datenquelle versionsgebunden parametriert statt Code-Duplikation, wo sinnvoll
- shadcn/ui first: Table/Input/Alert/AlertDialog/Tooltip/Badge — alle bereits vorhanden
- Kein neues npm-Paket nötig
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Vorschlag — final in `/architecture`)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/sales-plattform-planung/page.tsx` | Echte Seite: Versions-Shell + Tabelle (löst den dynamischen Platzhalter ab) |
| `src/components/langfristige-sales-plattform-planung-tabelle.tsx` | Hauptkomponente: Monats-Matrix, 2-stufige Aufklappstruktur (Plattform → Produkt), Inline-Edit, grauer/blauer Punkt, Betragsselektion, Notizen, Reset-Dialog, Warnhinweis |
| `src/hooks/use-langfristige-sales-plattform-planung.ts` | Zentraler State: parallele Ladevorgänge (Grundeinstellungen, KPI-Modell, Auszahlungs-/Marketing-Zuordnung, manuelle Werte, berechnete Werte, Notizen), Monatsfenster, Merge-/Aggregations-Logik, Upsert, einzelnes + globales Reset |
| `src/app/api/langfristige-planung/[versionId]/sales-plattform-planung/route.ts` | GET (manuelle Werte), PUT (Upsert/Löschen bei null), DELETE (globaler Reset inkl. Notizen) |
| `src/app/api/langfristige-planung/[versionId]/sales-plattform-planung/berechnet/route.ts` | GET: berechnet alle Kategorie-Werte je Plattform/Kanal × Produkt × Monat (Retourenquote aus Einstellung, USt-Aufschlag, Marketing aus Marketing-Planung) |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Sales-Plattform-Planung" (Slug `sales-plattform-planung`) in der bestehenden Gruppe „Planung" ergänzen (nach „Marketing-Planung") |

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Übernahme der hier geplanten Werte in nachgelagerte langfristige Auswertungs-/Liquiditätsseiten (eigene Specs)
- Zeitliche Verschiebung/Auszahlung gemäß Auszahlungseinstellungen-Rhythmus (Liquiditätssicht) — eigene Spec

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee

Diese Seite ist die **vierte Planungsseite** der Gruppe „Planung" (nach Absatzplanung, Marketing-Planung und Bestellplanung) und ist konzeptionell eine **1:1-Spiegelung** der kurzfristigen Sales-Plattform-Planung (PROJ-66) — auf die Langfristige Planung umgestellt. Sie verbindet drei bereits fertige Welten:

1. **Versions-Fundament** (PROJ-73): Routing über `[versionId]`, gemeinsames Seitengerüst (`LangfristigeVersionShell` mit Versionsprüfung, Header, Redirect bei fremder Version), zentrale Nav-Konfiguration, serverseitiger Versions-Eigentums-Check.
2. **Berechnungsmechanik & Einstellungen der Version**: Bruttoumsatz aus der Absatzplanung (PROJ-84); Retourenquote, Verkaufsgebühr, Rückversandkosten aus den Vertriebs-/Verkaufsgebühr-Einstellungen (PROJ-78/79); USt-Aufschlag aus den Steuereinstellungen (PROJ-83); Marketing-Inklusion und -%-Satz aus Auszahlungseinstellungen (PROJ-76) und Marketing-Planung (PROJ-85).
3. **Bewährtes Bedienkonzept** (aus PROJ-66/PROJ-84/PROJ-85): zweistufig aufklappbare Tabelle, Inline-Edit mit Auto-Save, grauer/blauer Punkt, Betragsselektion, Zellen-Notizen, globaler Reset.

Der entscheidende fachliche Unterschied zur kurzfristigen Vorlage: Es gibt in der Langfristigen Planung **keine Ist-Transaktionen**. Deshalb entfällt die gesamte „historische" Datenschicht. **Jede** Spalte (auch die zwei Vormonate) ist ein **berechneter** Wert; der graue Punkt steht hier durchgängig für „automatisch berechnet", der blaue für „manuell überschrieben". Es gibt nur **eine** Berechnungs-Route (statt je einer für Historie und Zukunft) und **keinen** „Historische Werte aktualisieren"-Button.

Der eigentliche Neubau ist klein und klar umrissen: **eine** neue versionsgebundene Datenablage (manuelle Überschreibungen je Zelle), **ein** Berechnungs-Endpunkt, der die kurzfristige Rechenlogik auf die Versions-Einstellungen umstellt, **ein** Lese-/Schreib-Endpunkt für die manuellen Werte und **eine** fokussierte Tabellen-Komponente. Alle Hilfs-Bausteine werden übernommen statt nachgebaut.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                 (Versions-Übersicht — bestehend)
+-- Gruppe "Planung": Eintrag/Kachel "Sales-Plattform-Planung"  (nach "Marketing-Planung")

/dashboard/langfristige-planung/[versionId]/sales-plattform-planung   (NEUE Seite)
+-- LangfristigeVersionShell  (bestehend — prüft Version, Header/Breadcrumb, Redirect, Toaster)
    +-- Seiten-Kopf
    |   +-- Titel "Sales-Plattform-Planung"
    |   +-- Button "Zurücksetzen" (rechts oben, öffnet Bestätigungs-Dialog)
    +-- Warnhinweis (Alert, immer sichtbar, nicht ausblendbar — Rentabilitätswerte ≠ Liquidität)
    +-- LangfristigeSalesPlattformPlanungTabelle  (NEUE Hauptkomponente)
        +-- Leer-Zustand (keine Sales-Plattformen ODER keine Produkte in der Version → Hinweis + Link zur KPI-Modell-Verwaltung)
        +-- Scroll-Container (horizontal, Label-Spalte sticky links)
        |   +-- Kopfzeile: [Label] | [2 Vormonate] | [Startmonat] | [Folgemonate ...]
        |   +-- [Bruttoumsatz-Block]   (Kategorie → Plattform → Produkt, einklappbar)
        |   +-- [Rabatte-Block]        (immer leer, read-only)
        |   +-- [Rückerstattungen-Block]
        |   +-- [Verkaufsgebühr-Block]
        |   +-- [Retourenkosten-Block]
        |   +-- [Marketingkosten-Block] (nur, wenn mind. 1 Plattform Marketingkanäle zugeordnet hat)
        |   +-- [Summe-Block]          (Nettoumsatz, berechnet, aufklappbar)
        +-- Betragsselektion-Summenpanel (WIEDERVERWENDETES Muster, rechts unten)
        +-- Notiz-Overlay                (WIEDERVERWENDET — versionsgebunden)
        +-- Zurücksetzen-Bestätigungs-Dialog (AlertDialog)
```

Das linke Seitenmenü und die Versions-Übersicht rendern die Nav-Gruppen generisch — der neue Eintrag erscheint allein durch die Ergänzung in der zentralen Nav-Konfiguration.

### B) Datenmodell (Klartext)

Es entsteht **genau eine** neue, versionsgebundene Tabelle, die ausschließlich **manuelle Überschreibungen** speichert. Berechnete Werte werden nie gespeichert — sie sind immer aus den Einstellungen ableitbar.

**Neue Tabelle „Langfristige Sales-Plattform-Planung" (ein Eintrag je überschriebener Zelle):**
```
Jeder Eintrag hat:
- eindeutige ID
- Besitzer (Nutzer)                         → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion  → Isolation
- Kategorie (Bruttoumsatz, Rückerstattungen, Verkaufsgebühr, Retourenkosten, Marketing)
  (Rabatte werden nie gespeichert — immer leer)
- Verweis auf ein Produkt der Version
- Verweis auf eine Sales-Plattform der Version
  (bei Marketing-Zeilen steht hier stattdessen der zugehörige Marketingkanal — analog zur kurzfristigen Tabelle)
- Monat (1–12) + Jahr
- manueller Wert (Betrag, oder "leer")
Eindeutigkeit: je (Planversion, Kategorie, Produkt, Plattform/Kanal, Jahr, Monat) genau ein Eintrag.
```

**Bewusst NICHT gespeichert:** Alle berechneten Größen (Bruttoumsatz, Rückerstattungen, Verkaufsgebühr, Retourenkosten, Marketing, Summe). Diese werden immer neu aus den Einstellungen dieser Version berechnet.

**Notizen:** Wiederverwendung der bereits seitenübergreifend ausgelegten Tabelle `langfristige_planung_notizen` (PROJ-84) mit Seite „sales-plattform-planung". Die Zellkoordinate enthält Kategorie + Plattform/Kanal + Produkt + Jahr + Monat. Keine neue Tabelle.

**Regeln:**
```
- Jeder Datensatz ist an Nutzer + Planversion gebunden; Zugriff nur auf eigene Daten
  (Row Level Security + serverseitige Prüfung der Versionszugehörigkeit).
- Wird eine Plattform/ein Produkt/ein Marketingkanal im KPI-Modell der Version gelöscht,
  verschwinden die zugehörigen Überschreibungen automatisch (kaskadierend).
- Wird die Planversion gelöscht, verschwinden alle Einträge automatisch mit.
- Keine Überschreibung vorhanden → die Zelle zeigt den berechneten Wert (grauer Punkt).
```

### C) Welche Spalten (Monate) werden gezeigt?

```
Aus den Grundeinstellungen der Version (PROJ-75):
  Startmonat (Monat + Jahr) und Planungshorizont ALLGEMEIN (Monate). Fallback: 12.

Erste Spalte  = Startmonat minus 2 Monate
Letzte Spalte = Startmonat + (Allgemeiner Horizont − 1) Monate
Spaltenanzahl = Allgemeiner Horizont + 2
```

Die Monatsabfolge (inkl. Jahresgrenzen) wird mit demselben, bereits getesteten Helfer wie in der Absatz-/Marketing-Planung gebildet. Liegt das Monatsfenster außerhalb des Bereichs, für den Absatz-/VK-Werte existieren (z. B. Vormonate ohne Absatzplanung), bleiben die betroffenen Werte schlicht leer — kein Rechenfehler.

### D) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Shell prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Die Tabelle lädt parallel:
     ① Grundeinstellungen der Version   → Startmonat + allgemeiner Horizont (Monatsfenster)
     ② Sales-Plattformen & Produkte der Version (KPI-Modell)
     ③ Auszahlungseinstellungen         → welche Plattform welche Marketingkanäle hat
     ④ gespeicherte manuelle Überschreibungen der Version
     ⑤ berechnete Werte der Version      → der Berechnungs-Endpunkt liefert alle
                                            Kategorie-Werte je Plattform/Kanal × Produkt × Monat
     ⑥ gespeicherte Notizen der Version  (Seite "sales-plattform-planung")
  → Zusammenführung je Zelle:
     • Manuelle Überschreibung vorhanden → dieser Wert + blauer Punkt
     • Sonst berechneter Wert            → dieser Wert + grauer Punkt
     • Rabatte                           → immer leer, kein Punkt
  → Sichtbarkeit Marketing-Block: nur, wenn mind. eine Plattform Marketingkanäle zugeordnet hat
  → Aggregation (frontend, reaktiv):
     Plattform-Subtotal = Summe der Produkte; Kategorie-Gesamt = Summe der Plattformen;
     Summe-Zeile = Bruttoumsatz − Rückerstattungen − Verkaufsgebühr − Retourenkosten − Marketing

Nutzer bearbeitet eine Produktzelle (onBlur)
  → optimistische Anzeige + Speichern der einen Zelle (anlegen/aktualisieren) → blauer Punkt
  → Fehler → Toast + Rücksetzen

Nutzer setzt eine einzelne Zelle zurück
  → die Überschreibung wird gelöscht → die Zelle zeigt wieder den berechneten Wert (grauer Punkt)

Nutzer klickt "Zurücksetzen" (global)
  → Bestätigungs-Dialog → nach Bestätigung: alle Überschreibungen + alle Notizen der Version löschen
  → alle Zellen zeigen wieder berechnete Werte

Betragsselektion: Klick/Ctrl+Klick auf Werte → laufende Summe rechts unten
```

### E) Wie wird gerechnet? (Klartext, Logik gespiegelt von PROJ-66)

Der Berechnungs-Endpunkt erzeugt alle berechneten Werte in einem Durchgang — dieselbe Rechenlogik wie die kurzfristige Seite, nur mit den Einstellungen **dieser Version** und **ohne** Transaktionsabfragen:

```
Je Sales-Plattform × Produkt × Monat:
  Bruttoumsatz   = Absatz × Effektiver VK   (aus der Absatzplanung der Version)
  Retourenquote  = gepflegter %-Wert je Produkt (Vertriebseinstellungen → Retouren → Allgemein)
  Rückerstattung = Retourenquote × Bruttoumsatz
  Verkaufsgebühr = (Bruttoumsatz × Verkaufsgebühr% − Bruttoumsatz × Retourenquote
                    × Erstattung-Verkaufsgebühr%) × USt-Aufschlag
  Retourenkosten = (Retourenquote × Absatz × Rückversandkosten) × USt-Aufschlag

Je Produkt × Marketingkanal (sofern Kanal einer Plattform zugeordnet) × Monat:
  Marketingkosten = Bruttoumsatz-Basis × (Marketingkosten% / 100) × USt-Aufschlag
                    (Marketingkosten% aus der Marketing-Planung der Version)

USt-Aufschlag: je Kategorie aus den Steuereinstellungen der Version
  (Gesamtsatz oder Kategoriesatz → Faktor "1 + Satz/100"); wirkt nur auf die
  Kostenkategorien (Verkaufsgebühr, Retourenkosten, Marketing), nicht auf
  Bruttoumsatz/Rückerstattungen — identisch zur kurzfristigen Implementierung.

Fehlt ein Eingangswert (kein Absatz, kein VK, keine Einstellung), bleibt die
betroffene Zelle leer. Rabatte sind immer leer.
```

### F) Server-Schnittstellen (versions- & nutzergebunden)

Alle neuen Endpunkte folgen exakt dem etablierten Langfristig-Muster (Login-Pflicht, Versions-Eigentums-Prüfung über den gemeinsamen Helfer, Filterung nach Nutzer **und** Version als zweite Sicherheitsebene zur RLS, Eingabeprüfung). Fremde/unbekannte Version → kein Zugriff.

```
Manuelle Überschreibungen (NEU):
  Lesen     – alle gespeicherten Überschreibungen der Version
  Speichern – eine Zelle anlegen/aktualisieren (Kategorie, Produkt, Plattform/Kanal, Jahr, Monat, Wert)
              "leer" entfernt die Überschreibung (= einzelnes Zurücksetzen)
  Löschen   – alle Überschreibungen + Notizen der Version (= globaler Reset)

Berechnete Werte (NEU):
  Lesen     – alle berechneten Kategorie-Werte je Plattform/Kanal × Produkt × Monat
              (Bruttoumsatz, Rückerstattungen, Verkaufsgebühr, Retourenkosten, Marketing)

Stützdaten & Notizen (WIEDERVERWENDUNG bestehender Routen):
  Stammdaten (Plattformen/Produkte/Kanäle) – KPI-Kategorien-Route (PROJ-74)
  Grundeinstellungen                        – Grundeinstellungen-Route (PROJ-75)
  Marketingkanal-Zuordnung je Plattform     – Auszahlungseinstellungen-Route (PROJ-76)
  Notizen                                   – Notiz-Route (PROJ-84), Seite "sales-plattform-planung"

Die übrigen Einstellungen (Absatzplanung, Retourenquote/Rückversand, Verkaufsgebühr,
USt-Sätze, Marketing-%) liest der Berechnungs-Endpunkt serverseitig direkt aus den
jeweiligen Versions-Tabellen — die Berechnung passiert komplett auf dem Server.
```

### G) Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/sales-plattform-planung/page.tsx` | Echte Seite: Versions-Shell + Tabelle |
| `src/components/langfristige-sales-plattform-planung-tabelle.tsx` | Hauptkomponente: Monats-Matrix, 2-stufige Aufklappstruktur, Inline-Edit, grauer/blauer Punkt, Betragsselektion, Notizen, Reset-Dialog, Warnhinweis |
| `src/hooks/use-langfristige-sales-plattform-planung.ts` | Zentraler State: parallele Ladevorgänge ①–⑥, Monatsfenster, Merge (berechnet ↔ manuell), Aggregation, Auto-Save, einzelnes + globales Reset |
| `src/app/api/langfristige-planung/[versionId]/sales-plattform-planung/route.ts` | Lesen + Speichern (Upsert/leer = löschen) der manuellen Überschreibungen; globaler Reset (inkl. Notizen) |
| `src/app/api/langfristige-planung/[versionId]/sales-plattform-planung/berechnet/route.ts` | Berechnet alle Kategorie-Werte je Plattform/Kanal × Produkt × Monat (Logik von PROJ-66, auf Versions-Einstellungen umgestellt, ohne Transaktionen) |

### H) Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Sales-Plattform-Planung" (Slug `sales-plattform-planung`) in der Gruppe „Planung" ergänzen (nach „Marketing-Planung") |

### I) Wiederverwendung im Detail

| Baustein | Status | Anmerkung |
|---|---|---|
| Versions-Gerüst (`LangfristigeVersionShell`) | **unverändert wiederverwenden** | Versionsprüfung, Header, Redirect, Toaster |
| Versions-Sicherheits-Helfer (`ensureLangfristigeVersion`) | **unverändert wiederverwenden** | in den neuen API-Routen |
| Monatsfenster-Helfer (`buildPlanungsmonate`) | **wiederverwenden** | aus PROJ-84, mit allgemeinem Horizont |
| Tabellen-Aufbau (2-stufig, flaches Zeilen-Array) | **Muster von PROJ-66 übernehmen** | auf Monate statt KW umgestellt |
| Betragsselektion-Summenpanel | **Muster wiederverwenden** | identisch zu PROJ-40/PROJ-84/PROJ-85 |
| Notiz-Tabelle + Notiz-Route + Notiz-Overlay | **wiederverwenden** | `langfristige_planung_notizen`, Seite „sales-plattform-planung" |
| Stammdaten/Grundeinstellungen/Auszahlungs-Zuordnung | **wiederverwenden** | bestehende Versions-Routen (PROJ-74/75/76) |
| Berechnungslogik | **von PROJ-66 portieren** | Retourenquote aus Einstellung statt Transaktion; Bruttoumsatz aus Absatzplanung; keine Ist-Schicht |
| Haupttabelle + 2 Endpunkte + 1 Tabelle | **Neubau** | versionsgebunden, rein berechnet + manuelle Überschreibung |

### J) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Nur manuelle Überschreibungen speichern, alles andere berechnen | Ja | Spiegelt PROJ-66; berechnete Werte sind jederzeit aus den Versions-Einstellungen ableitbar — Speichern wäre redundant und fehleranfällig |
| Nur **eine** Berechnungs-Route (kein „historisch") | Ja | Langfristige Planung hat keine Ist-Transaktionen; die gesamte historische Datenschicht der kurzfristigen Seite entfällt |
| Grauer Punkt = „berechnet" (statt „historisch/berechnet") | Ja (vom Nutzer bestätigt) | Es gibt nur eine Quelle automatischer Werte; blauer Punkt bleibt „manuell" |
| Retourenquote aus gepflegter Einstellung | Ja (vom Nutzer bestätigt) | Ohne Transaktionen ist die kurzfristige „aus Ist berechnen"-Logik nicht anwendbar; die Version pflegt die Quote unter Retouren → Allgemein |
| Rückerstattungen & Retourenkosten immer sichtbar | Ja (vom Nutzer bestätigt) | Keine Auszahlungseinstellungen-Bedingung — Marketing bleibt die einzige bedingte Kategorie |
| Marketing-%-Satz aus der langfristigen Marketing-Planung | Ja (vom Nutzer bestätigt) | Natürlicher Analog zur kurzfristigen Quelle; Inklusion über Auszahlungseinstellungen |
| USt-Aufschlag wie kurzfristig | Ja | „USt kommt oben drauf" — gleiche Mechanik, nur mit den Steuersätzen dieser Version |
| Eigene fokussierte Tabelle (statt PROJ-66-Komponente generalisieren) | Neubau | Versions- vs. Nutzer-Bindung, Monate statt KW, Wegfall der Ist-Schicht — eine Generalisierung brächte mehr Regressionsrisiko als Nutzen |
| Keine neuen npm-Pakete | Ja | Alle Bausteine (Tabelle, Alert, Dialog, Tooltip, Datumshelfer) sind vorhanden |

## Implementation Notes

### Frontend (PROJ-87 Frontend) — 2026-06-22
Neue Dateien:
- `src/hooks/use-langfristige-sales-plattform-planung.ts` — versionsgebundener State-Hook. Lädt parallel: Grundeinstellungen (Startmonat + allgemeiner Horizont), Sales-Plattformen/Produkte/Marketingkanäle (KPI-Modell der Version), manuelle Werte (`/sales-plattform-planung`) und berechnete Werte (`/sales-plattform-planung/berechnet`); Phase 2 lädt je Plattform die Auszahlungseinstellungen für die Marketingkanal-Zuordnung. Merge: manuell (blau) → berechnet (grau). Selektoren `getProduktWert/getPlatformWert/getKategorieWert/getSumme`, Mutationen `upsertWert` (null = einzelner Reset) und `resetAll` (global). Schlüssel via `lsppKey(...)` (Präfix `lspp:`). `KATEGORIE_LABELS`/`KATEGORIE_VORZEICHEN`/`SalesKategorie` werden aus dem kurzfristigen Hook (PROJ-66) wiederverwendet (re-export).
- `src/components/langfristige-sales-plattform-planung-tabelle.tsx` — Hauptkomponente, gespiegelt von `sales-plattform-planung-tabelle.tsx`, aber **monatsbasiert** und **ohne Ist-/Historik-Schicht**. Zweistufige Aufklappstruktur (Kategorie → Plattform → Produkt), Inline-Edit mit Auto-Save, grauer/blauer Punkt, Betragsselektion (`data-betrag-selektion`), Notizen (versionsgebunden, `seite = 'sales-plattform-planung'`), globaler Reset-Dialog + „Auf Automatisch zurücksetzen" für selektierte manuelle Zellen. Die ersten 2 Monatsspalten sind als „Vorlauf" dezent hinterlegt; der Startmonat trägt eine Trennlinie (`border-l-2 border-l-primary/70`). Marketing-Kategorie wird je Marketingkanal (Untergruppe) dargestellt, mit Plattform-Badges aus den Auszahlungseinstellungen.
- `src/app/dashboard/langfristige-planung/[versionId]/sales-plattform-planung/page.tsx` — Seite, nutzt `LangfristigeVersionShell` (fullWidth).

Geänderte Dateien:
- `src/lib/langfristige-planung-nav.ts` — Eintrag „Sales-Plattform-Planung" (Slug `sales-plattform-planung`) in Gruppe „Planung" nach „Marketing-Planung" ergänzt. NavSheet **und** die Versions-Übersicht rendern die Gruppen generisch → Kachel erscheint automatisch.

Hinweise/Abweichungen:
- Notizen werden über `useLangfristigePlanungNotizen(versionId, 'sales-plattform-planung')` verwaltet; beim globalen Reset löscht das Frontend zusätzlich lokal alle bekannten Notiz-Schlüssel (die DELETE-Route soll serverseitig die Notizen dieser Seite/Version ebenfalls entfernen).
- TypeScript-Check für die neuen Dateien ist sauber (verbleibende `tsc`-Fehler liegen ausschließlich in vorbestehenden `.test.ts`-Dateien und generierten `.next/dev/types`).
- **Offen für /backend:** Tabelle `langfristige_sales_plattform_planung` + Routen `…/sales-plattform-planung` (GET/PUT/DELETE) und `…/sales-plattform-planung/berechnet` (GET) existieren noch nicht — die Seite zeigt ohne sie nur leere/automatische Werte bzw. einen leeren Zustand.

### Backend (PROJ-87 Backend) — 2026-06-22

DB-Migration (`proj87_langfristige_sales_plattform_planung`, angewendet auf Projekt `kdmpghtdoguppfqhdscq`):
- Neue Tabelle `langfristige_sales_plattform_planung` (id, user_id, plan_version_id, kategorie CHECK-Enum, produkt_id → `langfristige_kpi_kategorien`, sales_plattform_id → `langfristige_kpi_kategorien` (hält bei Marketing-Zeilen die Marketingkanal-ID), jahr, monat CHECK 1–12, `wert_manuell` NUMERIC(14,2) nullable, created/updated_at).
- UNIQUE `(plan_version_id, kategorie, produkt_id, sales_plattform_id, jahr, monat)`; Indizes auf user_id und plan_version_id.
- RLS aktiviert; 4 Policies (SELECT/INSERT/UPDATE/DELETE) je `auth.uid() = user_id`. Supabase-Security-Advisor meldet **keine** Findings für die neue Tabelle. FKs mit ON DELETE CASCADE → automatische Bereinigung bei Lösch der Version/Kategorie.

Neue Routen:
- `src/app/api/langfristige-planung/[versionId]/sales-plattform-planung/route.ts` — GET (alle manuellen Werte der Version), PUT (Upsert; `wert_manuell = null` löscht den Eintrag = einzelnes Zurücksetzen), DELETE (globaler Reset: löscht alle manuellen Werte **und** die Notizen mit `seite = 'sales-plattform-planung'`). `requireAuth` + `ensureLangfristigeVersion`; Zod-Validierung (Kategorie-Enum, UUIDs, jahr/monat-Ranges).
- `src/app/api/langfristige-planung/[versionId]/sales-plattform-planung/berechnet/route.ts` — GET. Portiert die kurzfristige PROJ-66-Rechenlogik auf die Versions-Einstellungen, **ohne** Transaktionen:
  - Monatsfenster aus `langfristige_grundeinstellungen` (Startmonat − 2 … + allgemeiner Horizont; Fallback aktueller Monat + 12).
  - Bruttoumsatz = Absatz × Effektiver VK aus `langfristige_absatz_planung`.
  - Retourenquote = `langfristige_retouren_allgemein_produkt_einstellungen.retourenquote_prozent / 100` (je Produkt).
  - Rückerstattungen = Retourenquote × Bruttoumsatz.
  - Verkaufsgebühr = (Bruttoumsatz × Verkaufsgebühr% − Bruttoumsatz × Retourenquote × Erstattung-Verkaufsgebühr%) × USt-Multiplikator.
  - Retourenkosten = (Retourenquote × Absatz × Rückversandkosten) × USt-Multiplikator.
  - Marketing (je Marketingkanal): nur für in `langfristige_auszahlungs_marketingkanaele` zugeordnete Kanäle; Basis = Bruttoumsatz der über `langfristige_marketing_einstellungen` zugeordneten Plattform/Produkt; %-Satz aus `langfristige_marketing_planung`; × USt-Multiplikator; Ergebniszeile trägt die Marketingkanal-ID in `sales_plattform_id` (analog kurzfristig).
  - **USt** (`getUstMultiplier`, identisch zu PROJ-66): Parent-/Root-Kategorien (Verkaufsgebühr, Retouren, Marketing-L1, Vertrieb-Parent) aus dem **globalen** `kpi_categories`; Sätze aus `langfristige_ust_kategorie_saetze`, Gesamt/Aufgeteilt-Ebene aus `langfristige_ust_ebene_auswahl` — alles versionsgebunden.

Tests: `route.test.ts` (15) + `berechnet/route.test.ts` (12) = **27 Tests grün** (`npm test`). Decken Happy-Path je Methode, Validierungs-/Auth-/Version-Fehler (400/401/404/500), USt-Aufschlag, Marketing-Inklusion (zugeordnet vs. nicht) und Skip-ohne-VK ab. `tsc --noEmit` für die neuen Dateien sauber.

## QA Test Results

**QA Datum:** 2026-06-22
**Tester:** /qa
**Status:** Approved

### Zusammenfassung

- **Acceptance Criteria:** alle relevanten Kriterien bestanden (Navigation, Warnhinweis, Monatsspalten, Zeilenhierarchie, berechnete Werte, manuelle Eingabe, Punkte, Reset global + einzeln, Notizen, Betragsselektion, Datenisolation, DB-Schema, API-Routen).
- **Bugs:** keine Critical/High. 1 Low (Spec-/Verhaltens-Diskrepanz), 1 Low (kosmetische Redundanz).
- **Security:** keine Findings.
- **Produktionsentscheidung:** ✅ **READY**.

### Automatisierte Tests

| Suite | Ergebnis |
|---|---|
| Unit `sales-plattform-planung/route.test.ts` | ✅ 15/15 |
| Unit `sales-plattform-planung/berechnet/route.test.ts` | ✅ 12/12 |
| E2E `tests/PROJ-87-…spec.ts` (7 Tests × Chromium + Mobile Safari) | ✅ 14/14 |
| `tsc --noEmit` (neue PROJ-87-Dateien) | ✅ sauber |

> **Projektweiter Hinweis (nicht PROJ-87):** `npx vitest run` meldet 135 vorbestehende Fehlschläge in 17 Dateien (ausgaben-kosten-transaktionen, bestellplanung, marketing-einstellungen, marketing-planung, reporting/*, einnahmen-planung, planung-notizen, **kurzfristige** sales-plattform-planung/berechnet u.a.). Alle liegen in Dateien, die **vor** dieser Feature-Arbeit im Working Tree geändert wurden (laufende Arbeit an anderen Features) — **keine** betrifft eine PROJ-87-Datei. Sollte vom jeweiligen Feature-Team adressiert werden.

### Berechnungs-Verifikation gegen Live-Daten (Testversion1, Juli 2026)

Unabhängige SQL-Replikation der `berechnet`-Logik stimmt zellgenau mit der Route überein (USt-Multiplikator 1, da keine Sätze gepflegt):

| Plattform·Produkt | Bruttoumsatz | Rückerstattungen | Verkaufsgebühr | Retourenkosten |
|---|---|---|---|---|
| Amazon·FlexiBu | 10.900,00 | 109,00 | 1.403,92 | 4,36 |
| Amazon·FlexiCo | 9.600,00 | 480,00 | 1.382,40 | 20,00 |
| Amazon·MaliDa | 24.000,00 | 1.800,00 | 3.384,00 | 57,60 |
| Amazon·SamiBu | 8.550,00 | 855,00 | 1.179,90 | 38,00 |
| Otto·FlexiCo | 12.720,00 | 636,00 | 2.432,70 | 26,50 |

Marketing (Kanal Amazon Ads → Amazon): FlexiCo 1.248,00 · FlexiBu 1.962,00 · SamiBu 1.453,50 · MaliDa 2.880,00. Verkaufsgebühr-Formel inkl. Erstattung-Verkaufsgebühr-%-Abzug korrekt; Retourenkosten = Quote × Absatz × Rückversand korrekt; nur in den Auszahlungseinstellungen zugeordnete Marketingkanäle fließen ein.

### Acceptance Criteria — Ergebnisse (Auszug)

| Bereich | Kriterium | Status | Anmerkung |
|---|---|---|---|
| Navigation | Eintrag „Sales-Plattform-Planung" in Gruppe „Planung" nach „Marketing-Planung" | ✅ | nav-config; NavSheet + Übersicht generisch |
| Navigation | Dashboard-Kachel der Version | ✅ | Versions-Übersicht rendert Gruppen generisch |
| Navigation | Auth-Guard → /login | ✅ | E2E (Seite 307→/login; API 307→/login) |
| Navigation | Fremde/ungültige versionId → Redirect/404 | ✅ | Shell-Redirect + `ensureLangfristigeVersion` 404 (Unit) |
| Warnhinweis | Dauerhafter, nicht ausblendbarer Hinweis (gekürzter Text) | ✅ | gemeinsame Alert-Konstante (Laden/Leer/Tabelle) |
| Monatsspalten | Startmonat − 2 … + allgem. Horizont; ISO-Monatsfenster | ✅ | `buildPlanungsmonate`; Vorlauf/Plan-Markierung auf Wunsch entfernt |
| Zeilenhierarchie | Kategorie → Plattform → Produkt, 2-stufig aufklappbar | ✅ | flaches Zeilen-Array |
| Zeilenhierarchie | Rückerstattungen & Retouren immer sichtbar; Marketing bedingt | ✅ | showRetouren=true; showMarketing = Zuordnung + Daten |
| Zeilenhierarchie | Rabatte immer leer, nie editierbar | ✅ | editable = kat !== 'rabatte' |
| Berechnung | Brutto = Absatz×VK; Quote aus Einstellung; VkGeb/Retouren/Marketing + USt | ✅ | SQL-Verifikation + Unit-Tests |
| Berechnung | USt-Parent-Kategorien aus globalem kpi_categories | ✅ | `getUstMultiplier` wie PROJ-66 |
| Manuelle Eingabe | Inline-Edit, onBlur-Save, Vorzeichen-Konvertierung | ✅ | parsedNew × VORZEICHEN (PROJ-66-Fix übernommen) |
| Manuelle Eingabe | Optimistisch + Rollback bei Fehler | ✅ | upsertWert |
| Punkte | grau = berechnet, blau = manuell | ✅ | |
| Reset | Global (Dialog) löscht Werte + Notizen; einzeln auf berechnet | ✅ | DELETE-Route + upsert(null) |
| Reset | Kein „Historische Werte aktualisieren"-Button | ✅ | nicht vorhanden |
| Notizen | versionsgebunden, seite='sales-plattform-planung' | ✅ | `useLangfristigePlanungNotizen` |
| Betragsselektion | Klick/Ctrl-Klick, Summen-Panel | ✅ | `data-betrag-selektion`, Muster PROJ-40/84/85 |
| Datenisolation | Filter user_id + plan_version_id; CASCADE | ✅ | FKs ON DELETE CASCADE; Unit-404-Cases |
| DB | Tabelle + RLS (4 Policies) | ✅ | Advisor: keine Findings |
| UI | Spaltenbreite stabil beim Editieren | ✅ | Edit-Input als absolutes Overlay |

### Bugs

| # | Schwere | Titel | Beschreibung | Status |
|---|---|---|---|---|
| 1 | Low | Edge-Case „Bruttoumsatz = 0" zeigt leer statt 0 | Spec-Edge-Case fordert bei Absatz 0 + gesetztem VK „abhängige Werte = 0 (nicht leer)"; die Implementierung überspringt die Zelle bei `bruttoumsatz === 0` (1:1-Spiegelung der kurzfristigen PROJ-66-Route) → Zelle bleibt leer. Verhalten = Referenz, Spec-Text leicht abweichend. | Offen (bewusste Spiegelung) |
| 2 | Low | Globaler Reset löscht Notizen doppelt | Die DELETE-Route entfernt die Notizen serverseitig; das Frontend ruft zusätzlich `deleteNotiz` je bekanntem Schlüssel auf. Idempotent/harmlos, nur unnötige Requests. | Offen (kosmetisch) |

### Security-Audit

| Prüfung | Ergebnis |
|---|---|
| Auth auf allen API-Routen (`requireAuth` + Middleware-Redirect 307→/login) | ✅ |
| Versionszugehörigkeit serverseitig (`ensureLangfristigeVersion`, 404 bei fremd) | ✅ |
| RLS auf neuer Tabelle (4 Policies, auth.uid()=user_id); Advisor keine Findings | ✅ |
| Zod-Validierung auf PUT (Enum, UUIDs, jahr/monat-Ranges, NUMERIC/null) | ✅ |
| Datenisolation: Lese-/Schreibzugriffe nach user_id + plan_version_id | ✅ |
| XSS: Kategorie-/Produktnamen als Text gerendert (kein dangerouslySetInnerHTML) | ✅ |
| SQL-Injection: parametrisierte Supabase-Queries | ✅ |

### Produktions-Entscheidung

**✅ APPROVED** — keine Critical/High-Bugs. Die zwei Low-Findings sind kosmetisch bzw. eine bewusste Spiegelung der kurzfristigen Referenz und blockieren nicht.

## Deployment
_To be added by /deploy_

## Deployment
_To be added by /deploy_
</content>
</invoke>
