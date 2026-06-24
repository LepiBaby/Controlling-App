# PROJ-92: Investitionsausgaben Planung — Langfristige Planung

## Status: Approved
**Created:** 2026-06-22
**Last Updated:** 2026-06-23 (QA bestanden — Production-Ready)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`), Datenisolation je Planversion
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert die **Investitionen**-Kategorien der Version (`art = 'lp_investition'`): die festen Übergruppen **Produktinvestitionen Operations**, **Produktinvestitionen Einkauf** (gespiegelte Untergruppen: Ware, Inspektion, Shipping, Zoll, Einlagerung, Wertverlust Ware), **Produktinvestitionen Sales & Marketing** sowie alle vom Nutzer angelegten Übergruppen/Untergruppen. Liefert außerdem die **Produkte** der Version (`art = 'lp_produkt'`) als Berechnungs-/Pflegedimension je Untergruppe
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`) und **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monatsfenster
- Requires: PROJ-86 (Bestellplanung — Langfristige Planung) — liefert die **Bestellungen** der Version inkl. der **Erstbestellungs-Markierung** (`ist_erstbestellung`) und der zugehörigen **Bestellkosten** (`langfristige_bestellungen_kosten` mit `kpi_kategorie_id`, Betrag und Zahlungskonditionen/Zahlungszielen) als Quelle der Auto-Befüllung
- Vorlage (kein harter Require): PROJ-91 (Umsatzausgaben — Langfristige Planung) — monatsbasierte, versionsgebundene Tabelle mit „berechnet (grauer Punkt) + manuell überschreibbar (blauer Punkt)", Einzelzelle-Reset, globalem Reset, Betragsselektion und Zellen-Notizen; Zeilenstruktur Kategorie → Untergruppe → Produkt
- Vorlage (kein harter Require): PROJ-87 (Sales-Plattform-Planung — Langfristige Planung) — Muster „berechnet + manuell überschreibbar" (grau/blau Punkte, Einzelzelle-Reset, globaler Reset)
- Vorlage (kein harter Require): PROJ-69 (Produktinvestitionsausgaben — Kurzfristige Planung) — kurzfristiges Pendant der Investitionsplanung
- Integriert: PROJ-40 (Betragsselektion) — „Hover/Klick"-Summenpanel
- Integriert: PROJ-53-Muster (Zellen-Notizen) — versionsgebunden über `langfristige_planung_notizen`

## Übersicht

Die Seite **„Investitionsausgaben Planung"** ist eine weitere Planungsseite im Navigationsbereich **„Planung"** der Langfristigen Planung. Sie zeigt eine **monatsbasierte** Übersicht der geplanten Investitionsausgaben dieser Planversion, gegliedert nach dem **Investitionen-KPI-Modell der Version** (PROJ-74).

Wesentliche Eigenschaften:

- **Monatsspalten ohne Vorlauf.** Die Tabelle beginnt **exakt mit dem Startmonat** (aus den Grundeinstellungen der Version) und reicht über den **allgemeinen Planungshorizont** (`planungshorizont_monate` Monate ab Startmonat). **Keine** Vorlauf-/Vergangenheits-/Ist-Spalten — die Langfristige Planung kennt keine Transaktionen. Jede Monatsspalte ist eine **Soll-Spalte**.
- **Zeilenquelle = Investitionen-KPI-Modell der Version.** Angezeigt werden **alle** Übergruppen (Kategorien) und ihre Untergruppen aus dem `lp_investition`-Baum dieser Version (die drei festen Übergruppen **und** alle vom Nutzer angelegten). **Jede Untergruppe** wird zusätzlich **auf Produktebene** (Produkte der Version) heruntergebrochen und dort gepflegt.
- **Auto-Befüllung nur für „Produktinvestitionen Einkauf".** Die Untergruppen der festen Übergruppe **„Produktinvestitionen Einkauf"** werden **automatisch** aus den **Erstbestellungen** der Langfristigen Bestellplanung (PROJ-86) und deren **Bestellkosten** befüllt. Diese Zellen zeigen einen **grauen Punkt** und sind **manuell überschreibbar** (blauer Punkt) mit Einzelzelle-Reset (vom Nutzer am 2026-06-22 bestätigt).
- **Alle anderen Kategorien rein manuell.** Übergruppen wie „Produktinvestitionen Operations", „Produktinvestitionen Sales & Marketing" und alle vom Nutzer angelegten Übergruppen sind **nur manuell** befüllbar (kein grauer Punkt; blauer Punkt bei Eingabe).
- **Untergruppen ohne passende Bestellkosten-Position bleiben manuell.** Einkauf-Untergruppen, für die es keine entsprechende Bestellkosten-Kategorie gibt (z. B. **„Wertverlust Ware"**), werden **nicht** auto-befüllt und bleiben rein manuell (vom Nutzer am 2026-06-22 bestätigt).
- **Übliche Funktionen:** Hover-/Klick-Summen (PROJ-40), Zellen-Notizen (PROJ-53, versionsgebunden), Ein-/Ausklappen je Sektion + „Alle ein-/ausklappen", Einzelzelle-Reset auf den berechneten Wert sowie der globale **„Zurücksetzen"-Button oben rechts**.
- **Versionsbindung.** Manuelle Überschreibungen und Notizen sind **strikt pro Planversion** isoliert (PROJ-73); die KPI-Investitionsstruktur ist bereits versionsgebunden (PROJ-74).

Die **Gesamt-Zeile** „Investitionsausgaben (Gesamt)" erscheint ganz **unten**.

## Berechnungslogik (Auto-Befüllung „Produktinvestitionen Einkauf")

Quelle sind ausschließlich die als **Erstbestellung** markierten Bestellungen (`ist_erstbestellung = true`) der Langfristigen Bestellplanung dieser Version (PROJ-86) und ihre **Bestellkosten** (`langfristige_bestellungen_kosten`). Andere Bestellungen werden für die Auto-Befüllung ignoriert.

**Zuordnung Untergruppe:** Jede Bestellkosten-Position trägt eine `kpi_kategorie_id` (globale `ausgaben_kosten`-Unterkategorien von „Produkt": Ware, Inspektion, Shipping, Zoll, Einlagerung). Diese wird über den **Namen** der entsprechenden gespiegelten Einkauf-Untergruppe (Snapshot aus PROJ-74) zugeordnet. Untergruppen ohne passende Position (z. B. „Wertverlust Ware") bleiben rein manuell.

**Zuordnung Produkt:** Jede Bestellung gehört zu genau einem Produkt der Version; die Bestellkosten-Positionen werden diesem Produkt zugeordnet (Produktebene-Leaf).

**Zeitliche Zuordnung (vom Nutzer am 2026-06-22 bestätigt: „Nach Zahlungszeitpunkt"):** Jede Bestellkosten-Position wird gemäß ihren **Zahlungskonditionen** (Anzahlung-%/Zahlungsziel + Restzahlung-Zahlungsziel) in **eine oder mehrere Zahlungstranchen** zerlegt; jede Tranche landet im **Monat ihrer Fälligkeit**. Alle Tranchen mit demselben Fälligkeitsmonat werden je (Untergruppe × Produkt) summiert.

- Die in den Bestellkosten gespeicherten **Netto**-Beträge werden um die **USt aus den Steuereinstellungen dieser Planversion** (PROJ-83) aufgeschlagen — je Position über ihre globale `kpi_kategorie_id`, mit derselben Gesamt-/Aufgeteilt-Logik wie bei den Umsatzausgaben (PROJ-91). Ohne hinterlegten Satz bleibt der Wert netto (Faktor 1).
- Eine Tranche, deren Fälligkeitsmonat **außerhalb** des Planungsfensters liegt, wird **nicht** angezeigt.
- Server-seitige Berechnung in einer `berechnet`-Route; Aggregationen (Untergruppen-, Übergruppen-, Gesamt-Summen) frontend-seitig.

## User Stories

- Als Controller möchte ich innerhalb einer geöffneten Planversion über die Navigationsgruppe „Planung" die Seite „Investitionsausgaben Planung" aufrufen können, damit ich die Investitionsausgaben dieses Szenarios planen kann.
- Als Controller möchte ich, dass die Zeilen exakt den Investitionskategorien und -untergruppen aus dem KPI-Modell dieser Planversion entsprechen, damit meine Investitionsstruktur abgebildet wird.
- Als Controller möchte ich, dass jede Untergruppe zusätzlich auf Produktebene aufgeschlüsselt ist, damit ich Investitionsausgaben je Produkt planen und pflegen kann.
- Als Controller möchte ich, dass die Untergruppen von „Produktinvestitionen Einkauf" automatisch aus meinen Erstbestellungen und deren Bestellkosten befüllt werden, damit ich diese Werte nicht manuell schätzen muss.
- Als Controller möchte ich automatisch befüllte Einkauf-Werte manuell überschreiben und auf einen Blick erkennen, ob ein Wert automatisch (grauer Punkt) oder manuell (blauer Punkt) ist.
- Als Controller möchte ich alle anderen Kategorien rein manuell befüllen können, damit ich Investitionen ohne Bestellbezug frei planen kann.
- Als Controller möchte ich eine einzelne überschriebene Zelle wieder auf den berechneten Wert zurücksetzen sowie über einen „Zurücksetzen"-Button alle manuellen Werte und Notizen dieser Seite global zurücksetzen können.
- Als Controller möchte ich alle Kategoriegruppen einzeln auf-/zuklappen sowie alle gleichzeitig ein-/ausklappen können.
- Als Controller möchte ich für einzelne Zellen Notizen hinterlegen können (versionsgebunden).
- Als Controller möchte ich mehrere Zellen selektieren und die Summe angezeigt bekommen (Betragsselektion).
- Als Controller möchte ich, dass meine Eingaben und Notizen pro Planversion gespeichert werden, ohne andere Versionen oder die Kurzfristige Planung zu beeinflussen.

## Acceptance Criteria

### Navigation & Einstieg
- [ ] In der versionsspezifischen Navigation (`src/lib/langfristige-planung-nav.ts`) gibt es in der Gruppe **„Planung"** einen neuen Eintrag **„Investitionsausgaben Planung"** mit Slug `investitionsausgaben-planung`, der auf `/dashboard/langfristige-planung/[versionId]/investitionsausgaben-planung` verlinkt
- [ ] Auf der Versions-Übersichtsseite erscheint in der Gruppe „Planung" der Eintrag/die Kachel „Investitionsausgaben Planung" (generisches Rendern zieht automatisch nach)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Aufruf mit unbekannter/fremder/ungültiger `versionId` → sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff), via `LangfristigeVersionShell`
- [ ] Es gibt **keine** Kennzahlen-Kacheln oberhalb der Tabelle

### Tabellenstruktur & Monatsspalten
- [ ] Die Spalten sind **Monate** (keine Kalenderwochen)
- [ ] **Erste Spalte** = Startmonat (aus `langfristige_grundeinstellungen`) — **kein** Vorlaufmonat
- [ ] **Letzte Spalte** = Startmonat + (`Planungshorizont` − 1) Monate
- [ ] **Planungshorizont** = `planungshorizont_monate` (Fallback 12); Gesamtzahl Monatsspalten = `Planungshorizont`
- [ ] Jede Monatsspalte ist eine **Soll-Spalte** — keine Vergangenheits-/Ist-Spalten
- [ ] Spaltenüberschriften zeigen Monat + Jahr (z. B. „Apr 2026"); optionale Jahres-Gruppierungszeile (analog PROJ-84)
- [ ] Korrekte Berechnung über Jahresgrenzen hinweg (mehrjähriger Horizont)
- [ ] Tabelle horizontal scrollbar; erste Spalte (Zeilenbeschriftung) beim horizontalen Scrollen sticky (links fixiert, opaker Hintergrund)

### Zeilenhierarchie (aus dem Investitionen-KPI-Modell der Version)
- [ ] Zeilenquelle: der `lp_investition`-Baum dieser Version (PROJ-74) — **alle** Übergruppen (feste **und** nutzerangelegte) in `sort_order`-Reihenfolge
- [ ] **Pro Übergruppe (Kategorie, Ebene 1):** einklappbare Sektion (Standard: ausgeklappt) mit Header (Name + Toggle, zeigt Summe, nicht editierbar)
- [ ] **Pro Untergruppe (Ebene 2):** einklappbare Sektion (Standard: ausgeklappt) mit Header (Name + Toggle, zeigt Summe der Produkte, nicht editierbar)
- [ ] **Pro Produkt:** editierbare Leaf-Zeile (eingerückt) — **für alle** Untergruppen aller Kategorien
- [ ] **Ganz unten:** Gesamt-Zeile „Investitionsausgaben (Gesamt)" — summiert alle Leaf-Zeilen je Monat, nicht editierbar, immer sichtbar
- [ ] Aggregationen (Untergruppe, Übergruppe, Gesamt) sind reaktiv: Änderung eines Leaf-Werts aktualisiert alle übergeordneten Summen sofort
- [ ] **Buttons oben rechts:** „Alle ausklappen" und „Alle einklappen" (zwei separate Buttons) sowie „Zurücksetzen"
- [ ] Übergruppen ohne Untergruppen bzw. Versionen ohne Produkte: sinnvoller Leer-/Teilzustand (siehe Edge Cases)

### Produktinvestitionen Einkauf (auto-berechnet + überschreibbar)
- [ ] Quelle: **nur** als `ist_erstbestellung = true` markierte Bestellungen dieser Version (PROJ-86) und deren Bestellkosten
- [ ] Bestellkosten-Positionen werden über den **Namen** der gespiegelten Einkauf-Untergruppe zugeordnet (Ware, Inspektion, Shipping, Zoll, Einlagerung)
- [ ] Zeitliche Zuordnung **nach Zahlungszeitpunkt**: Position gemäß Zahlungskonditionen in Tranchen zerlegt; jede Tranche im Fälligkeitsmonat; gleicher Fälligkeitsmonat je (Untergruppe × Produkt) summiert
- [ ] Beträge um die USt aus den Steuereinstellungen der Version aufgeschlagen (PROJ-83, Gesamt/Aufgeteilt je Kategorie; ohne Satz → netto)
- [ ] Auto-Werte mit Wert zeigen **grauen Indikatorpunkt**; Zellen sind **manuell überschreibbar** → **blauer Punkt**
- [ ] Tranche mit Fälligkeitsmonat außerhalb des Fensters wird nicht angezeigt
- [ ] Einkauf-Untergruppe **„Wertverlust Ware"** (und jede Untergruppe ohne passende Bestellkosten-Kategorie) wird **nicht** auto-befüllt → rein manuell (kein grauer Punkt)

### Alle anderen Kategorien (rein manuell)
- [ ] „Produktinvestitionen Operations", „Produktinvestitionen Sales & Marketing" und alle nutzerangelegten Übergruppen: **keine** Auto-Berechnung
- [ ] Zellen im Auto-Zustand leer (kein grauer Punkt); blauer Punkt nur bei manueller Eingabe

### Soll-Werte (Eingabe) — allgemein
- [ ] Inline-Editing (click-to-edit), Speicherung onBlur in der versionsgebundenen Tabelle
- [ ] Eingabe: Dezimalzahl ≥ 0; negative Werte verworfen; leere/auf berechneten Wert zurückgesetzte Zelle = kein manueller Eintrag
- [ ] Optimistisches Update + Rollback bei API-Fehler (Toast)
- [ ] Nur Produkt-Leaf-Zellen editierbar; Aggregations- und Gesamt-Zellen nicht editierbar

### Indikatorpunkte
| Zustand | Punkt | Gilt für |
|---|---|---|
| Automatisch berechnet (mit Wert) | Grauer Punkt | Auto-befüllte Einkauf-Zellen mit Wert |
| Manuell eingegeben/überschrieben | Blauer Punkt | Jede manuell befüllte/überschriebene Zelle |
| Leer / keine Berechnung | Kein Punkt | Zellen ohne Auto-Wert und ohne manuelle Eingabe |

### Einzelzelle-Reset & globaler Reset
- [ ] Bei genau **einer** überschriebenen Zelle: Button „Auf automatisch zurücksetzen" (rechts unten) → löscht den manuellen Eintrag → Zelle zeigt wieder den berechneten Wert (grauer Punkt) bzw. wird leer (wenn kein Auto-Wert)
- [ ] Button **„Zurücksetzen" oben rechts** mit Bestätigungs-Dialog (shadcn AlertDialog): löscht alle manuellen Einträge **dieser Version** + alle Notizen dieser Seite **dieser Version**; Zellen zeigen wieder berechnete Werte bzw. werden leer
- [ ] Verhalten analog PROJ-91/PROJ-87

### Zellen-Notizen (wie PROJ-53, versionsgebunden)
- [ ] Bei genau **einer** editierbaren Zelle: Button „Notiz hinzufügen"/„Notiz bearbeiten"; nicht sichtbar bei keiner/mehrfacher/nicht-editierbarer Selektion
- [ ] Overlay mit Zellidentifikation (z. B. „Notiz — Produkt X · Ware · Apr 2026"), Textarea, „Speichern", „Abbrechen", ggf. „Notiz löschen"
- [ ] Zellen mit Notiz zeigen Indikator; Hover zeigt Notiztext
- [ ] Notiz an Zellkoordinate (Untergruppe + Produkt + Monat/Jahr) gebunden; bleibt beim Verschieben des Fensters erhalten
- [ ] Speicherung **pro Planversion** und Seite (`seite = 'investitionsausgaben-planung'`) über `langfristige_planung_notizen` (keine neue Notiz-Tabelle)

### Betragsselektion (Hover/Klick-Summe, wie PROJ-40)
- [ ] Einzelne/mehrere Zellwerte per Klick/Ctrl+Klick selektierbar; Summe im Panel rechts unten (`data-betrag-selektion`)
- [ ] Panel erscheint ab 1 selektierter Zelle; nicht-editierbare Zellen (Aggregationen, Gesamt) ebenfalls selektierbar
- [ ] Verhalten identisch mit bestehender Betragsselektion (PROJ-40 / PROJ-91)

### Datenisolation (PROJ-73)
- [ ] Alle Lese-/Schreibzugriffe auf manuelle Werte und Notizen nach `versionId` **und** `user_id` gefiltert
- [ ] Neu angelegte Planversion: vollständig berechnete (sofern Erstbestellungen existieren), aber **ohne** manuelle Überschreibungen vorbelegte Seite
- [ ] Änderungen in Version A ohne Auswirkung auf Version B oder die Kurzfristige Planung
- [ ] Beim Löschen der Planversion werden alle manuellen Werte- und Notiz-Datensätze kaskadierend mitgelöscht (ON DELETE CASCADE)
- [ ] Berechnete Werte beziehen ausschließlich Bestellungen/Bestellkosten **dieser** Version (PROJ-86) und das Monatsfenster aus PROJ-75

### Datenbankschema
- [ ] Neue Tabelle `langfristige_investitionsausgaben_planung` (nur manuelle Überschreibungen):
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `kategorie_id` UUID NOT NULL — Investitions-**Untergruppe** (`langfristige_kpi_kategorien`, `art = 'lp_investition'`, Ebene 2; kein harter FK, analog PROJ-91-Muster)
  - `produkt_id` UUID NOT NULL — Produkt der Version (`langfristige_kpi_kategorien`, `art = 'lp_produkt'`)
  - `jahr` INTEGER NOT NULL (CHECK 2000–2100), `monat` INTEGER NOT NULL (CHECK 1–12)
  - `betrag_manuell` NUMERIC(12,2) NULL — NULL = kein manueller Eintrag; CHECK ≥ 0 oder NULL
  - `created_at`/`updated_at`
  - UNIQUE(`plan_version_id`, `kategorie_id`, `produkt_id`, `jahr`, `monat`) → Upsert via `onConflict`
  - RLS: nur eigene Einträge (`auth.uid() = user_id`); Versionszugehörigkeit serverseitig zusätzlich geprüft
- [ ] Notizen nutzen die bestehende Tabelle `langfristige_planung_notizen` (`seite = 'investitionsausgaben-planung'`)
- [ ] Auto-berechnete Werte werden **nicht** persistiert (stets server-seitig berechnet)

### API-Routen (versions- & nutzergebunden)
- [ ] `GET /api/langfristige-planung/[versionId]/investitionsausgaben-planung` — alle manuellen Einträge der Version
- [ ] `PUT /api/langfristige-planung/[versionId]/investitionsausgaben-planung` — Upsert je `(plan_version_id, kategorie_id, produkt_id, jahr, monat)`; `betrag_manuell: null` → Eintrag löschen
- [ ] `DELETE /api/langfristige-planung/[versionId]/investitionsausgaben-planung` — alle manuellen Einträge der Version löschen (globaler Reset)
- [ ] `GET /api/langfristige-planung/[versionId]/investitionsausgaben-planung/berechnet` — Auto-Werte je (Einkauf-Untergruppe × Produkt × Monat) aus Erstbestellungen + Bestellkosten
- [ ] Notizen: bestehende Route `GET/PUT/DELETE /api/langfristige-planung/[versionId]/planung-notizen` mit `seite=investitionsausgaben-planung`
- [ ] Alle Routen: `requireAuth()` + `ensureLangfristigeVersion()`, Zod-Validierung (UUIDs, `monat` 1–12, `jahr` 2000–2100, Werte ≥ 0 oder null), Filter nach `user_id` + `plan_version_id`; fremde/unbekannte `versionId` → 404

## Edge Cases
- **Keine Investitionskategorien im KPI-Modell der Version:** Leerzustand mit Hinweis + Link zur KPI-Modell-Verwaltung dieser Version
- **Keine Produkte in der Version:** Untergruppen-Header ohne Produkt-Leafzeilen; Hinweis + Link zur KPI-Modell-Verwaltung
- **Keine Erstbestellungen vorhanden:** Einkauf-Zellen leer (kein 0), keine grauen Punkte
- **Bestellung ohne markierte Erstbestellung:** wird bei der Auto-Befüllung ignoriert (auch wenn Bestellkosten existieren)
- **Bestellkosten-Position ohne `kpi_kategorie_id` oder ohne passende Einkauf-Untergruppe:** wird der Auto-Befüllung nicht zugeordnet (kein Absturz)
- **Einkauf-Untergruppe „Wertverlust Ware" (keine Bestellkosten-Quelle):** rein manuell, kein grauer Punkt
- **Zahlungstranche fällt außerhalb des Planungsfensters:** Betrag wird nicht angezeigt
- **Bestellkosten ohne gepflegte Zahlungskonditionen:** gesamte Position fällt in einen sinnvollen Stichmonat (z. B. Liefer-/Bestellmonat) statt Aufteilung — Verhalten in `/architecture` präzisieren
- **Manueller Wert auf 0 gesetzt:** gültig, `0,00 €` mit blauem Punkt (≠ NULL/leer)
- **Einzelzelle-Reset einer rein manuellen Zelle (kein Auto-Wert):** Zelle wird leer, kein grauer Punkt
- **Globaler Reset ohne manuelle Werte:** idempotent (keine sichtbare Änderung)
- **Startmonat-Änderung in den Grundeinstellungen:** Fenster verschiebt sich beim nächsten Laden; manuelle Werte/Notizen bleiben an ihrer Monat/Jahr-Koordinate und erscheinen nur, wenn die Koordinate im Fenster liegt
- **Kategorie/Untergruppe/Produkt im KPI-Modell gelöscht:** zugehörige manuelle Werte/Notizen werden nicht mehr angezeigt (verwaiste Einträge unschädlich; konsistent mit PROJ-91-Muster)
- **Sehr langer Horizont (z. B. 120 Monate):** horizontal scrollbar, Label-Spalte sticky, kein Layout-Bruch
- **Jahresgrenze im Horizont und in der Zahlungsverschiebung:** korrekte Monats-/Jahresberechnung
- **Planungshorizont nicht gesetzt:** Fallback 12 Monate
- **Grundeinstellungen der Version noch nicht gespeichert:** Standard-Startmonat + Default-Horizont (analog PROJ-75), kein Absturz
- **API-Fehler bei Berechnung:** betroffene Zellen leer, kein Absturz, Toast-Hinweis
- **Aufruf mit fremder/unbekannter `versionId`:** Redirect zum Dashboard (PROJ-73), kein Datenzugriff

## Technical Requirements
- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen versionsgebundenen Tabelle; Versionszugehörigkeit serverseitig prüfen (`ensureLangfristigeVersion`, Defense-in-Depth zur RLS)
- Alle Eingaben serverseitig mit Zod validieren (UUIDs, Monat 1–12, Jahr 2000–2100, Werte ≥ 0 oder null)
- Neue versionsgebundene Next.js-Seite: `src/app/dashboard/langfristige-planung/[versionId]/investitionsausgaben-planung/page.tsx` (nutzt `LangfristigeVersionShell` mit `seitenTitel="Investitionsausgaben Planung"` und `fullWidth`)
- Navigation: neuer Eintrag „Investitionsausgaben Planung" (Slug `investitionsausgaben-planung`) in der Gruppe „Planung" in `src/lib/langfristige-planung-nav.ts`
- Zeilenquelle: `lp_investition`-Kategorien der Version über die bestehende Langfristig-KPI-API (PROJ-74); Produkte über `art=lp_produkt`
- Monatsfenster: aus Startmonat + Horizont ohne Vorlauf (`date-fns`); Helfer analog PROJ-91 (`buildPlanungsmonate` ohne Vorlauf)
- Server-seitige `berechnet`-Route: lädt Erstbestellungen + `langfristige_bestellungen_kosten` der Version, ordnet je Position Untergruppe (Namens-Match) + Produkt + Fälligkeitsmonat (Zahlungskonditionen) zu
- Wiederverwendung: `LangfristigeVersionShell`, `ensureLangfristigeVersion`, Betragsselektion-Muster (`data-betrag-selektion`), `PlanungNotizFormular`, `useLangfristigePlanungNotizen(versionId, 'investitionsausgaben-planung')`; berechnet-/manuell-Overlay-Logik analog PROJ-91/PROJ-87
- shadcn/ui first: Table/Input/Dialog/Select/Popover/AlertDialog/Tooltip/Button/Card/Skeleton — alle vorhanden
- Kein neues npm-Paket nötig
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Vorschlag, Verfeinerung in /architecture)
| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/investitionsausgaben-planung/page.tsx` | Seite: Versions-Shell + Tabelle |
| `src/components/langfristige-investitionsausgaben-tabelle.tsx` | Hauptkomponente: Monats-Matrix, Übergruppe/Untergruppe/Produkt/Gesamt, Indikatorpunkte, Notizen, Betragsselektion, Einzelzelle-/globaler Reset, Ein-/Ausklappen |
| `src/hooks/use-langfristige-investitionsausgaben.ts` | Lädt Grundeinstellungen/Investitions-KPI-Struktur/Produkte/berechnete Werte/manuelle Overrides; Monatsfenster; upsert/reset; Indikator-Logik |
| `src/app/api/langfristige-planung/[versionId]/investitionsausgaben-planung/route.ts` | GET / PUT / DELETE (manuelle Einträge) |
| `src/app/api/langfristige-planung/[versionId]/investitionsausgaben-planung/berechnet/route.ts` | GET: Auto-Berechnung aus Erstbestellungen + Bestellkosten |
| DB-Migration `create_langfristige_investitionsausgaben_planung` | Neue Tabelle + RLS + Indizes |

### Geänderte Dateien
| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Investitionsausgaben Planung" (Slug `investitionsausgaben-planung`) in der Gruppe „Planung" |

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Übernahme der hier geplanten Investitionsausgaben in eine spätere Langfristige Liquiditätsauswertung (eigene Spec, analog PROJ-72)
- Verhalten, falls Bestellkosten-Positionen künftig zusätzliche Investitions-Untergruppen (über die fünf gespiegelten hinaus) bedienen sollen
- Optionale Vereinheitlichung der monatsbasierten Zahlungsverschiebungs-Helfer über mehrere langfristige Berechnungs-Routen hinweg

## Implementation Notes

### Frontend (UI + versionsgebundener Daten-Hook), 2026-06-22
Die Seite, der Daten-Hook und die Tabelle sind gebaut. Die eigentliche Datenhaltung/API (manuelle-Werte-Tabelle + `berechnet`-Route) folgt mit `/backend`; bis dahin zeigt die Seite sauber den Lade-/Leerzustand (kein Absturz). Maximale Wiederverwendung des PROJ-91-Musters.

**Neue Dateien:**
- `src/hooks/use-langfristige-investitionsausgaben.ts` — versionsgebundener Hook (Variante von `use-langfristige-umsatzausgaben`). Lädt parallel: Grundeinstellungen (Monatsfenster ohne Vorlauf), Investitions-Kategorien (`?art=lp_investition`), Produkte (`?art=lp_produkt`), manuelle Werte (`/investitionsausgaben-planung`) und berechnete Werte (`/investitionsausgaben-planung/berechnet`). Schlüssel `${kategorieId}:${produktId}:${jahr}:${monat}` (kategorieId = L2-Untergruppe). Bietet `getManuellerWert`/`getBerechneterWert`/`isManuelleOverride`/`upsertZelle` (optimistisch + Rollback)/`resetAll`. Kein Marketing-/Unassigned-Zweig (anders als PROJ-91).
- `src/components/langfristige-investitionsausgaben-tabelle.tsx` — Haupttabelle: 3-Ebenen-Hierarchie **Übergruppe (L1) → Untergruppe (L2) → Produkt (Leaf)**, Monatsspalten, grauer Punkt (berechnet, nur Einkauf liefert Werte) / blauer Punkt (manuell), Inline-Edit onBlur, Einzelzelle-Reset & globaler Reset (AlertDialog), Zellen-Notizen (`seite='investitionsausgaben-planung'`), Betragsselektion (`data-betrag-selektion`), „Alle ein-/ausklappen". **Unter jeder Untergruppe werden immer alle Produkte gezeigt** (anders als PROJ-91, wo nur Kategorien mit Werten Produkte zeigen). Gesamt-Zeile „Investitionsausgaben (Gesamt)" unten. Leerzustand bei fehlenden Investitionskategorien + Hinweisbanner bei fehlenden Produkten, jeweils mit Link zur KPI-Modell-Verwaltung der Version.
- `src/app/dashboard/langfristige-planung/[versionId]/investitionsausgaben-planung/page.tsx` — `LangfristigeVersionShell` (`seitenTitel="Investitionsausgaben Planung"`, `fullWidth`) + Tabelle.

**Geänderte Dateien:**
- `src/lib/langfristige-planung-nav.ts` — neuer Eintrag „Investitionsausgaben Planung" (Slug `investitionsausgaben-planung`) in der Gruppe „Planung" (nach „Umsatzausgaben"). NavSheet und Versions-Übersicht ziehen generisch nach.

**Erwartete API (für `/backend`):** versions- & nutzergesichert; fremde/unbekannte `versionId` → 404.
- `GET /api/langfristige-planung/[versionId]/investitionsausgaben-planung` → `{ kategorie_id, produkt_id, jahr, monat, betrag_manuell }[]`
- `PUT …/investitionsausgaben-planung` `{ kategorie_id, produkt_id, jahr, monat, betrag_manuell }` (Upsert; `betrag_manuell: null` → Eintrag löschen)
- `DELETE …/investitionsausgaben-planung` → alle manuellen Werte + Notizen (`seite='investitionsausgaben-planung'`) der Version löschen
- `GET …/investitionsausgaben-planung/berechnet` → `{ data: { kategorie_id, produkt_id, jahr, monat, wert }[] }` (kategorie_id = lp_investition-L2-Untergruppe der Version; nur „Produktinvestitionen Einkauf")

**Qualität:** `tsc --noEmit` ohne neue Fehler in den neuen/geänderten Dateien.

### Backend (Tabelle + versionsgebundene API + Berechnung), 2026-06-22
Datenhaltung, manuelle-Werte-API und die `berechnet`-Route sind implementiert. Die Frontend-Anbindung erfolgte bereits im Frontend-Schritt (ruft exakt diese Endpunkte/Datensatzform), daher keine weiteren Frontend-Änderungen.

**Datenbank (Supabase-Projekt „Controlling-App", Migration `create_langfristige_investitionsausgaben_planung`):**
- Neue Tabelle `langfristige_investitionsausgaben_planung` — strukturgleich zu `langfristige_umsatzausgaben_planung` (PROJ-91): `id`, `user_id` → `auth.users` (ON DELETE CASCADE), `plan_version_id` → `langfristige_planversionen` (ON DELETE CASCADE), `kategorie_id` (lp_investition-Untergruppe, kein harter FK), `produkt_id` (lp_produkt, kein harter FK), `jahr` (CHECK 2000–2100), `monat` (CHECK 1–12), `betrag_manuell` NUMERIC(12,2) (CHECK ≥ 0 oder NULL), `created_at`/`updated_at`. UNIQUE(`plan_version_id`, `kategorie_id`, `produkt_id`, `jahr`, `monat`).
- RLS aktiviert, 4 Policies (SELECT/INSERT/UPDATE/DELETE) mit `auth.uid() = user_id`.
- Indizes: `(user_id)`, `(plan_version_id)`, `(plan_version_id, kategorie_id, produkt_id)`.
- `get_advisors` (security): **keine neue Warnung** für die Tabelle (bestehende Warnungen betreffen ausschließlich ältere `USING(true)`-Tabellen).

**API-Routen (versions- & nutzergesichert; fremde/unbekannte `versionId` → 404, `dynamic='force-dynamic'`):**
- `src/app/api/langfristige-planung/[versionId]/investitionsausgaben-planung/route.ts` — `GET` (alle manuellen Werte), `PUT` (Upsert einer Zelle; `betrag_manuell: null` → Löschen), `DELETE` (alle manuellen Werte + Notizen `seite='investitionsausgaben-planung'` der Version). 1:1-Spiegelung des PROJ-91-Musters (`requireAuth` + `ensureLangfristigeVersion`, Zod, Filter nach `user_id` + `plan_version_id`).
- `src/app/api/langfristige-planung/[versionId]/investitionsausgaben-planung/berechnet/route.ts` — `GET`: lädt parallel Grundeinstellungen (Monatsfenster ohne Vorlauf), `lp_investition`-Kategorien (Einkauf-Übergruppe + Untergruppen) und globale `kpi_categories` (Namen); dann **nur** `langfristige_bestellungen` mit `ist_erstbestellung=true` + deren `langfristige_bestellungen_kosten`. Je Kostenposition: globale Kategorie-ID → Name → gleichnamige Einkauf-Untergruppe (normalisierter Namens-Abgleich); Produkt = Produkt der Bestellung; Monat = Monat des Fälligkeitsdatums (`datum`); Summe je (Untergruppe × Produkt × Monat), Netto × USt-Multiplikator aus den Steuereinstellungen der Version (`langfristige_ust_kategorie_saetze` + `langfristige_ust_ebene_auswahl`, geladen über die globale `kpi_kategorie_id` der Position; gleiche `getUstMultiplier`-Logik wie PROJ-91). Positionen ohne passende Untergruppe (z. B. „Wertverlust Ware") oder außerhalb des Fensters werden übersprungen. Antwort `{ data: { kategorie_id, produkt_id, jahr, monat, wert }[] }`.

**Bestätigte Datenquellen (DB-verifiziert):** `langfristige_bestellungen.ist_erstbestellung` (boolean, NOT NULL) + `produkt_id` (uuid). `langfristige_bestellungen_kosten`: `bestellung_id`, `kpi_kategorie_id` (nullable), `datum` (date NOT NULL, bereits in Zahlungstranchen materialisiert), `nettobetrag`. Damit ist „Nach Zahlungszeitpunkt" reine Gruppierung nach `datum`-Monat — kein neuer Zahlungsverschiebungs-Helfer nötig (wie im Tech Design vorhergesagt).

**Tests:** `route.test.ts` (GET/PUT/DELETE, 20 Fälle: Happy Path, 400/401/404/500, Null-Löschung, 0-Wert, Validierung) + `berechnet/route.test.ts` (9 Fälle: Auth/Version, leere Einkauf-Struktur, Berechnung + Monatsgruppierung, Ignorieren von Nicht-Erstbestellungen, Überspringen unpassender Kategorien, Fenster-Filter, DB-Fehler) — **29/29 grün**. `tsc --noEmit` ohne neue Fehler.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-22)

### Leitidee

Diese Seite ist die **Investitions-Schwester** der bereits gebauten Umsatzausgaben-Seite der Langfristigen Planung (PROJ-91). Sie übernimmt deren komplettes **Bedien- und Anzeigemodell** — eine monatsbasierte, versionsgebundene Tabelle, in der jede Produkt-Zelle automatisch **berechnet** (grauer Punkt) und/oder **manuell überschrieben** (blauer Punkt) sein kann, mit Einzelzelle-Reset, globalem Reset, Betragsselektion und Zellen-Notizen — und ändert nur drei Dinge:

1. **Andere Zeilenquelle.** Statt des globalen Ausgaben-KPI-Baums sind die Zeilen die **Investitionen-Kategorien dieser Planversion** (`lp_investition` aus PROJ-74): Übergruppe → Untergruppe → Produkt.
2. **Nur eine auto-befüllte Kategorie.** Ausschließlich die feste Übergruppe **„Produktinvestitionen Einkauf"** wird automatisch befüllt — aus den als **Erstbestellung** markierten Bestellungen (PROJ-86) und deren bereits gespeicherten **Bestellkosten**. Alle anderen Kategorien (Operations, Sales & Marketing, nutzerangelegte) sind rein manuell.
3. **Zahlungszeitpunkt steht schon fest.** Die in der Spec offene Frage nach einem „Zahlungstranchen-Helfer" entfällt: Jede gespeicherte Bestellkosten-Position trägt **bereits ein Fälligkeitsdatum** (`datum`). Der Bestellkosten-Generator (PROJ-64) zerlegt z. B. die Warenkosten schon heute in bis zu drei Zahlungsphasen (Vor Produktion / Nach Produktion / Nach Ankunft), jede mit eigenem Fälligkeitsdatum. Die Auto-Befüllung muss diese Positionen daher nur **nach dem Monat ihres `datum` gruppieren** — keine Neuberechnung von Zahlungskonditionen nötig.

Bewusst **kein Umbau** bestehender Seiten und **kein Neuerfinden**: Versions-Gerüst, Versions-Sicherheits-Helfer, Notiz-Overlay/-Mechanismus und Betragsselektion werden direkt mitgenutzt. Neu gebaut werden die Seite, ihre Tabelle, ihr Daten-Hook, zwei API-Routen (manuelle Werte + Berechnung) und eine Datenbanktabelle für die manuellen Werte.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                       (Versions-Übersicht — bestehend)
+-- Gruppe "Planung" erhält Eintrag/Kachel "Investitionsausgaben Planung"  (zieht generisch nach)

/dashboard/langfristige-planung/[versionId]/investitionsausgaben-planung   (NEUE Seite)
+-- LangfristigeVersionShell  (bestehend — prüft Version, Header/Redirect, Toaster; fullWidth)
    +-- LangfristigeInvestitionsausgabenTabelle  (NEUE Hauptkomponente)
        +-- Leer-Zustand (keine Investitionskategorien / keine Produkte → Hinweis + Link zur KPI-Modell-Verwaltung)
        +-- Kopfbereich rechts: Buttons "Alle ausklappen" / "Alle einklappen" / "Zurücksetzen"
        +-- Scroll-Container (horizontal, Label-Spalte sticky links, opak)
        |   +-- Kopfzeile: [Label] | [Jan 2026] | [Feb 2026] | ...  (Monate; Jahres-Gruppierungszeile)
        |   +-- [Pro Übergruppe (Ebene 1): Operations / Einkauf / Sales & Marketing / nutzerangelegte]
        |   |   +-- Übergruppen-Header (einklappbar; Summe; nicht editierbar)
        |   |   +-- [wenn ausgeklappt, pro Untergruppe (Ebene 2)]
        |   |       +-- Untergruppen-Header (einklappbar; Summe der Produkte; nicht editierbar)
        |   |       +-- [pro Produkt] editierbare Leaf-Zeile (grau bei Auto-Einkauf / blau bei manuell)
        |   +-- Gesamt-Zeile "Investitionsausgaben (Gesamt)"   ← GANZ UNTEN (Summe aller Leafs)
        +-- PlanungNotizFormular            (WIEDERVERWENDET — Notiz-Overlay)
        +-- Betragsselektion-Summenpanel    (WIEDERVERWENDETES Muster, rechts unten)
        +-- Einzelzelle-Reset-Button        (rechts unten, wenn genau 1 manuell überschriebene Zelle fokussiert)
        +-- Zurücksetzen-Bestätigungsdialog (shadcn AlertDialog)
```

Das linke Seitenmenü und die Versions-Übersicht rendern die Nav-Gruppen generisch — der neue Eintrag erscheint allein durch die Ergänzung in der zentralen Nav-Konfiguration.

### B) Datenmodell (Klartext)

Es entsteht **eine neue, versionsgebundene Tabelle** für die manuellen Überschreibungen — strukturgleich zur Umsatzausgaben-Tabelle aus PROJ-91. Notizen nutzen die **bereits bestehende** versionsgebundene Notiz-Tabelle.

**Neue Tabelle — „Langfristige Investitionsausgaben-Planung" (ein Eintrag je manuell überschriebener Zelle):**
```
Jeder Eintrag hat:
- eindeutige ID
- Besitzer (Nutzer)                          → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion   → Isolation
- Verweis auf eine Investitions-Untergruppe (Ebene 2 der lp_investition-Kategorien der Version)
- Verweis auf ein Produkt der Version
- Monat (1–12) + Jahr
- Manueller Betrag (Dezimalzahl ≥ 0)
Eindeutigkeit: je (Planversion, Untergruppe, Produkt, Jahr, Monat) genau ein Eintrag.
```

Bewusste Eigenschaften (konsistent mit PROJ-91):
- **Nur manuelle Werte werden gespeichert.** Automatische Werte werden nie persistiert — ein vorhandener Eintrag bedeutet immer „manuell überschrieben" (blauer Punkt).
- Der Kategorie-Verweis (Untergruppe) zeigt auf die **versionseigenen** Investitions-Kategorien (kein harter Fremdschlüssel, analog PROJ-91); verschwindet eine Untergruppe, wird ihr verwaister Wert einfach nicht mehr angezeigt.
- Der Produkt-Verweis zeigt auf die **versionseigenen** Produkte (`lp_produkt`).

**Notizen — bestehende Tabelle „Langfristige Planungs-Notizen" (wiederverwendet):** zusätzliche „Seite" = `investitionsausgaben-planung`; Zellkoordinate = Untergruppe + Produkt + Jahr + Monat. Keine neue Notiz-Tabelle, keine neue Notiz-Route.

**Regeln:** Jeder Datensatz ist an Nutzer + Planversion gebunden (Row Level Security + serverseitige Versionsprüfung). Beim Löschen der Planversion verschwinden alle manuellen Werte- und Notiz-Einträge automatisch mit (kaskadierend). Fehlt ein manueller Eintrag, zeigt die Zelle den berechneten Wert (oder ist leer).

### C) Welche Spalten (Monate) werden gezeigt?

```
Aus den Grundeinstellungen der Version (PROJ-75):
  Startmonat (Monat + Jahr) und allgemeiner Planungshorizont (Monate); fehlt er → 12.

Erste Spalte  = Startmonat            (KEIN Vorlauf)
Letzte Spalte = Startmonat + (Planungshorizont − 1) Monate
Spaltenanzahl = Planungshorizont
```
Die Monatsabfolge wird sauber über Jahresgrenzen hinweg gebildet — exakt mit demselben Helfer-Stil wie PROJ-91 (`buildUmsatzausgabenMonate`, ohne Vorlauf). Manuelle Werte/Notizen hängen an ihrer Monat/Jahr-Koordinate; verschiebt der Nutzer später den Startmonat, erscheinen nur die Einträge, deren Koordinate im neuen Fenster liegt.

### D) Zeilen: das Investitionen-Modell der Version

```
Quelle: die lp_investition-Kategorien DIESER Version (PROJ-74), gelesen über die
        bestehende Langfristig-KPI-API (art=lp_investition); Produkte über art=lp_produkt.

Ebene 1 (Übergruppe)   → einklappbarer Header, zeigt Summe, nicht editierbar
  Ebene 2 (Untergruppe) → einklappbarer Header, zeigt Summe der Produkte, nicht editierbar
    Produkt (Leaf)       → editierbare Zelle je Monat — für ALLE Untergruppen aller Kategorien
Gesamt-Zeile             → ganz unten, Summe aller Produkt-Leafs je Monat
```

Anders als PROJ-91 (wo nur Kategorien mit Berechnungs- oder manuellen Werten Produkte zeigen) werden hier **unter jeder Untergruppe immer alle Produkte** angezeigt, weil jede Untergruppe manuell pflegbar ist. Reihenfolge nach `sort_order` des Modells.

### E) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Shell prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Die Tabelle lädt parallel:
     ① Grundeinstellungen der Version          → Startmonat + Horizont (Monatsfenster)
     ② Investitions-Kategorien der Version      → Übergruppe/Untergruppe-Hierarchie (lp_investition)
     ③ Produkte der Version                     → Leaf-Zeilen je Untergruppe (lp_produkt)
     ④ berechnete Soll-Werte der Version        → /investitionsausgaben-planung/berechnet (nur Einkauf)
     ⑤ gespeicherte manuelle Überschreibungen   → /investitionsausgaben-planung (GET)
     ⑥ gespeicherte Notizen der Version (Seite "investitionsausgaben-planung")
  → Anzeigewert je Zelle: manueller Wert (blauer Punkt) ELSE berechneter Wert (grauer Punkt) ELSE leer
  → Aggregation (frontend, reaktiv): Untergruppen-, Übergruppen- und Gesamtsummen aus den Anzeigewerten

Nutzer bearbeitet eine Zelle (onBlur)
  → optimistische Anzeige + Speichern der einen manuellen Überschreibung; Fehler → Toast + Rücksetzen
Nutzer fokussiert genau 1 überschriebene Zelle → "Auf automatisch zurücksetzen"
  → manueller Eintrag wird gelöscht → Zelle zeigt wieder den berechneten Wert (oder leer)
Nutzer klickt "Zurücksetzen" (global) → Bestätigungsdialog
  → alle manuellen Werte + alle Notizen dieser Seite/Version werden gelöscht
Nutzer selektiert genau 1 editierbare Zelle → "Notiz hinzufügen/bearbeiten"
Betragsselektion: Klick/Ctrl+Klick auf Werte → laufende Summe rechts unten
```

### F) Server-seitige Berechnung — Route `/investitionsausgaben-planung/berechnet`

Dies ist der einzige inhaltlich neue Berechnungsteil und deutlich **einfacher** als die Umsatzausgaben-Berechnung. Sie liefert pro (Einkauf-Untergruppe × Produkt × Monat) einen Netto-Wert.

**Eingangsdaten (alle der Version, parallel geladen):**
```
- Grundeinstellungen            → Monatsfenster (PROJ-75)
- Investitions-Kategorien        → die feste Übergruppe "Produktinvestitionen Einkauf"
  der Version (lp_investition)     und ihre Untergruppen (Ware, Inspektion, Shipping, Zoll, Einlagerung, …)
- globales KPI-Modell            → Namen der Bestellkosten-Kategorien (zum Namens-Abgleich)
- Bestellungen der Version        → NUR die als Erstbestellung markierten (ist_erstbestellung = true)
- Bestellkosten der Bestellungen → kpi_kategorie_id, Fälligkeitsdatum (datum), Nettobetrag
```

**Berechnung (Klartext):**
```
1. Bestimme die Untergruppen der Übergruppe "Produktinvestitionen Einkauf" der Version
   und baue eine Zuordnung NAME → Untergruppen-ID (Ware→…, Inspektion→…, Shipping→…, Zoll→…, Einlagerung→…).
2. Für jede Bestellkosten-Position einer ERSTBESTELLUNG:
   - Übersetze ihre globale Kategorie-ID in deren Namen → finde die gleichnamige Einkauf-Untergruppe.
     Kein Treffer (z. B. "Wertverlust Ware" hat keine Bestellkosten-Quelle) → Position überspringen.
   - Produkt = das Produkt der Bestellung.
   - Monat = Monat des Fälligkeitsdatums (datum) der Position  → "Nach Zahlungszeitpunkt".
   - Liegt der Monat außerhalb des Planungsfensters → überspringen.
   - Summiere den Nettobetrag je (Untergruppe, Produkt, Jahr, Monat).
3. Beträge werden um die USt aus den Steuereinstellungen der Version aufgeschlagen (PROJ-83; ohne hinterlegten Satz → netto).
```

**Antwortformat (Klartext):** eine Liste von Einträgen mit Untergruppe (Kategorie-ID der Version), Produkt, Jahr, Monat und Wert — exakt das Shape, das der Frontend-Hook aus PROJ-91 schon verarbeitet. Aggregationen (Untergruppe/Übergruppe/Gesamt) macht das Frontend.

> **Architektur-Hinweis (Korrektur zur Spec-Open-Question):** Ein eigener „monatsbasierter Zahlungsverschiebungs-Helfer" wird **nicht** benötigt. Die Zahlungszeitpunkte sind bereits beim Speichern der Bestellkosten als `datum` materialisiert (PROJ-64/PROJ-86). Die Route gruppiert nur nach dem Monat dieses Datums. Das ist robuster und konsistent mit dem, was der Nutzer im Bestellkosten-Dialog sieht.

### G) Server-Schnittstellen (versions- & nutzergebunden)

Alle Endpunkte folgen exakt dem etablierten Muster (Login-Pflicht via `requireAuth`, Versions-Eigentums-Prüfung via `ensureLangfristigeVersion`, Filterung nach Nutzer **und** Version als zweite Sicherheitsebene zur RLS, Zod-Eingabeprüfung, `dynamic = 'force-dynamic'`). Fremde/unbekannte Version → 404. Identisches Muster wie die PROJ-91-Routen.
```
Manuelle Werte (NEU):
  Lesen     – alle manuellen Überschreibungen der Version
  Speichern – eine Zelle anlegen/aktualisieren (Untergruppe, Produkt, Jahr, Monat, Betrag);
              Betrag = null löscht den Eintrag (= einzelnes Zurücksetzen)
  Löschen   – alle manuellen Werte der Version + alle Notizen dieser Seite (globaler Reset)
Berechnung (NEU):
  Lesen     – berechnete Einkauf-Soll-Werte je (Untergruppe × Produkt × Monat)
Notizen (BESTEHEND, wiederverwendet):
  GET/PUT/DELETE der bestehenden Notiz-Route mit Seite = "investitionsausgaben-planung"
```

### H) Tech-Entscheidungen (Begründung)

- **PROJ-91 als Blaupause statt Neubau:** Hook, Tabelle, Indikator-/Reset-/Notiz-/Betragsselektion-Logik sind dort bereits gelöst. Wir kopieren das Muster und tauschen Zeilenquelle und Berechnung — minimales Regressionsrisiko, schnelle Umsetzung.
- **Zeilenquelle = versionseigene Investitionskategorien:** erfüllt die Anforderung „Kategorien & Untergruppen des KPI-Modells dieser Version" und hält die Seite vollständig versionsisoliert (PROJ-73/74).
- **Auto-Befüllung über das bereits gespeicherte `datum`:** kein Nachbau der Zahlungskonditionen-Logik; die Liquiditätssicht („Nach Zahlungszeitpunkt") ergibt sich direkt aus den vorhandenen Bestellkosten-Daten.
- **Namens-Abgleich Bestellkosten ↔ Einkauf-Untergruppen:** Die gespiegelten Einkauf-Untergruppen sind beim Anlegen der Version als Namens-Snapshot aus dem globalen Modell entstanden (PROJ-74). Da die Bestellkosten dieselben globalen Kategorien (Ware/Inspektion/Shipping/Zoll/Einlagerung) verwenden, ist der Abgleich über den Namen die natürliche, stabile Brücke (es existiert kein gespeicherter ID-Link). „Wertverlust Ware" hat bewusst keine Bestellkosten-Quelle → bleibt manuell.
- **Nur manuelle Werte persistiert:** identisch zu PROJ-87/88/91; Auto-Werte werden bei jedem Laden frisch berechnet, eine gespeicherte Zeile heißt immer „manuell überschrieben".
- **Zugriffsschutz doppelt** (Versionseigentum serverseitig + nutzergebundene Zeilen + RLS): konsistentes Sicherheitsmuster der Langfristig-Tabellen.

### I) Abhängigkeiten (Pakete)

Keine neuen npm-Pakete. Wiederverwendet werden: `LangfristigeVersionShell`, `ensureLangfristigeVersion`, der Notiz-Hook/-Overlay (`useLangfristigePlanungNotizen` / `PlanungNotizFormular`), das Betragsselektion-Muster, der Monatsfenster-Helfer-Stil aus PROJ-91, die bestehende Langfristig-KPI-API (PROJ-74) sowie die Bestelldaten/Bestellkosten der Version (PROJ-86). shadcn/ui: Table, Input, Button, Tooltip, Popover, AlertDialog, Card, Skeleton (alle vorhanden).

### J) Umsetzungsreihenfolge (empfohlen)

```
1. DB-Migration: Tabelle "langfristige_investitionsausgaben_planung" + RLS + Indizes
2. API: /investitionsausgaben-planung (GET/PUT/DELETE)  — Kopie des PROJ-91-Musters
3. API: /investitionsausgaben-planung/berechnet (GET)   — Erstbestellungen + Bestellkosten, Namens-Mapping, datum-Monat
4. Hook: use-langfristige-investitionsausgaben  — Variante von use-langfristige-umsatzausgaben, Zeilenquelle lp_investition
5. Komponente: langfristige-investitionsausgaben-tabelle  — Variante der Umsatzausgaben-Tabelle (3 Ebenen, immer Produkte)
6. Seite + Nav-Eintrag "Investitionsausgaben Planung" (Slug investitionsausgaben-planung) in der Gruppe "Planung"
```

## QA Test Results

**Getestet:** 2026-06-23 · **Tester:** QA Engineer (Claude)
**Methode:** Code-Audit aller Akzeptanzkriterien + Vitest (API/Berechnung/Hook-Logik) + Playwright (Route/Auth/Regression). Interaktive Tests (Inline-Edit, Selektion, Notizen, Aggregation, grau/blau-Punkte) erfordern eine authentifizierte Session + Planversion und sind code-/manuell geprüft — analog zum etablierten Vorgehen bei PROJ-74/75/89/90/91 (versionsgebundene Seiten ohne automatisierte Login-Session in E2E).
**Status: APPROVED — Production-Ready**

### Akzeptanzkriterien

| Bereich | AC | Ergebnis | Beleg |
|---|---|---|---|
| Navigation | Nav-Eintrag „Investitionsausgaben Planung" (Slug `investitionsausgaben-planung`) in Gruppe „Planung" | ✅ Pass | `langfristige-planung-nav.ts` |
| Navigation | Versions-Übersicht zieht Eintrag/Kachel generisch nach | ✅ Pass | generisches Rendern aus PROJ-73 |
| Navigation | Auth-Guard → Redirect /login | ✅ Pass | E2E (2 Tests) |
| Navigation | Fremde/unbekannte `versionId` → Redirect/404 | ✅ Pass | `ensureLangfristigeVersion` (400/404) in allen Routen + Shell |
| Navigation | Keine Kennzahlen-Kacheln oberhalb der Tabelle | ✅ Pass | Komponente |
| Monatsspalten | Monate (keine KW); Start exakt Startmonat, kein Vorlauf; Anzahl = Horizont (Fallback 12) | ✅ Pass | `buildInvestitionsausgabenMonate` + Unit-Test (5 Fälle) |
| Monatsspalten | Jede Spalte Soll, keine Ist-/Vergangenheitsspalten | ✅ Pass | Komponente (nur Soll) |
| Monatsspalten | Korrekte Berechnung über Jahresgrenzen | ✅ Pass | Unit-Test (Dez-Start, 30-Monats-Horizont) |
| Monatsspalten | Horizontal scrollbar, Label-Spalte sticky links opak | ✅ Pass | `overflow-x-auto` + `sticky left-0` |
| Zeilenhierarchie | Quelle = `lp_investition`-Baum der Version, alle Übergruppen in `sort_order` | ✅ Pass | Hook lädt `?art=lp_investition` |
| Zeilenhierarchie | Übergruppe (L1) → Untergruppe (L2) → Produkt (Leaf), einklappbar | ✅ Pass | `flatRows` 3 Ebenen |
| Zeilenhierarchie | Unter JEDER Untergruppe alle Produkte | ✅ Pass | `leafProdukte = produkte` für jede L2 |
| Zeilenhierarchie | Gesamt-Zeile „Investitionsausgaben (Gesamt)" ganz unten, nicht editierbar | ✅ Pass | `total`-Row |
| Zeilenhierarchie | Aggregationen reaktiv | ✅ Pass | `getCellValue` summiert `childLeafs` live |
| Zeilenhierarchie | Buttons „Alle ausklappen"/„Alle einklappen" + „Zurücksetzen" oben rechts | ✅ Pass | Toolbar |
| Einkauf (auto) | Quelle nur `ist_erstbestellung=true` + deren Bestellkosten | ✅ Pass | berechnet-Route `.eq('ist_erstbestellung', true)` + Test |
| Einkauf (auto) | Namens-Abgleich Bestellkosten-Kategorie → Einkauf-Untergruppe | ✅ Pass | `norm()`-Map + Test |
| Einkauf (auto) | Zeitliche Zuordnung nach Zahlungszeitpunkt (`datum`-Monat), Summe je Untergruppe×Produkt | ✅ Pass | berechnet-Route + Test (2 Tranchen → 1 Monat summiert) |
| Einkauf (auto) | Netto × USt-Satz der Version (PROJ-83) | ✅ Pass | berechnet-Route (getUstMultiplier) |
| Einkauf (auto) | Tranche außerhalb Fenster nicht angezeigt | ✅ Pass | `monatSet`-Filter + Test |
| Einkauf (auto) | „Wertverlust Ware" / Untergruppen ohne Quelle → kein grauer Punkt | ✅ Pass | kein Cost-Row mit dieser Kategorie + Test (skip ohne Match) |
| Andere Kat. (manuell) | Operations/Sales&Marketing/Nutzer-Übergruppen: keine Auto-Berechnung, leer ohne grauen Punkt | ✅ Pass | berechnet liefert nur Einkauf; grau nur bei Auto-Wert |
| Soll-Werte | Inline-Edit onBlur, Dezimal ≥0, negative verworfen, leer = kein Eintrag | ✅ Pass | `handleCellBlur` + PUT-Validierung |
| Soll-Werte | Optimistisches Update + Rollback + Toast | ✅ Pass | `upsertZelle` |
| Soll-Werte | Nur Produkt-Leaf editierbar; Aggregat/Gesamt nicht | ✅ Pass | `isEditable` nur Leaf |
| Indikatorpunkte | Grau = Auto-Wert, Blau = manuell, kein Punkt = leer | ✅ Pass | `getCellValue` |
| Reset | Einzelzelle-Reset (1 manuelle Zelle) → zurück auf Auto/leer | ✅ Pass | `handleResetToAuto` (PUT null) |
| Reset | Globaler „Zurücksetzen" mit AlertDialog → manuelle Werte + Notizen der Version löschen | ✅ Pass | `resetAll` (DELETE) + Notiz-Löschung |
| Notizen | Notiz auf einzelner editierbarer Zelle, `seite='investitionsausgaben-planung'` | ✅ Pass | `useLangfristigePlanungNotizen` |
| Betragsselektion | Klick/Ctrl+Klick, Summenpanel rechts unten, auch nicht-editierbare Zellen | ✅ Pass | `data-betrag-selektion` |
| Datenisolation | Lese-/Schreibzugriff nach `versionId` + `user_id`; A≠B; Cascade-Löschung | ✅ Pass | Routen-Filter + FK ON DELETE CASCADE |
| DB-Schema | Tabelle + RLS (4 Policies) + Indizes wie spezifiziert | ✅ Pass | DB-verifiziert (rls=true, 4 Policies, 5 Indizes) |
| API | GET/PUT/DELETE + berechnet, alle versions-/nutzergesichert | ✅ Pass | route.test.ts + berechnet/route.test.ts |

**Ergebnis: 33/33 Akzeptanzkriterien bestanden.**

### Edge Cases (geprüft)

| Edge Case | Ergebnis |
|---|---|
| Keine Investitionskategorien → Leerzustand + KPI-Link | ✅ (Hinweis: durch Snapshot-Seeding praktisch immer ≥3 Übergruppen) |
| Keine Produkte → Hinweisbanner + Link, keine Leaf-Zeilen | ✅ Pass |
| Keine Erstbestellungen → Einkauf leer (kein 0) | ✅ Pass (Test: `{data:[]}`) |
| Bestellung ohne Erstbestellungs-Markierung → ignoriert | ✅ Pass (Test) |
| Bestellkosten ohne `kpi_kategorie_id`/ohne passende Untergruppe → übersprungen | ✅ Pass (Test) |
| Zahlungstranche außerhalb Fenster → nicht angezeigt | ✅ Pass (Test) |
| Manueller Wert 0 → gültig (blauer Punkt) | ✅ Pass (Test) |
| Zelle geleert → Eintrag gelöscht | ✅ Pass (Test PUT null) |
| Globaler Reset ohne manuelle Werte → idempotent | ✅ Pass |
| Jahresgrenze im Horizont | ✅ Pass (Unit-Test) |
| Planungshorizont nicht gesetzt → Fallback 12 | ✅ Pass (berechnet-Route + Hook) |
| Grundeinstellungen noch nicht gespeichert → Standard-Startmonat, kein Absturz | ✅ Pass |
| Fremde/unbekannte `versionId` → 404, kein Datenzugriff | ✅ Pass (Test) |
| `nettobetrag` ≤ 0 → übersprungen (kein 0-Eintrag) | ✅ Pass (Guard `betrag > 0`) |

### Automatisierte Tests

| Suite | Datei | Ergebnis |
|---|---|---|
| Unit (API, manuelle Werte) | `…/investitionsausgaben-planung/route.test.ts` | 20/20 ✅ |
| Unit (API, Berechnung) | `…/investitionsausgaben-planung/berechnet/route.test.ts` | 9/9 ✅ |
| Unit (Hook-Logik) | `src/hooks/use-langfristige-investitionsausgaben.test.ts` | 7/7 ✅ |
| E2E (Route/Auth/Regression) | `tests/PROJ-92-langfristige-investitionsausgaben-planung.spec.ts` | 5/5 ✅ (Chromium) |
| Regression (related langfristige) | umsatzausgaben + kpi-kategorien + investitionsausgaben | 93/93 ✅ |

`tsc --noEmit` ohne neue Fehler in den neuen/geänderten Dateien.

### Security-Audit (Red Team) — keine Befunde

- **AuthN/AuthZ:** Alle 4 Endpunkte (`GET`/`PUT`/`DELETE` manuelle Werte, `GET` berechnet) erfordern `requireAuth` (401) und prüfen Versionseigentum via `ensureLangfristigeVersion` (400 bei ungültiger UUID, 404 bei fremder/unbekannter Version). Jede Query zusätzlich nach `user_id` **und** `plan_version_id` gefiltert; RLS (`auth.uid() = user_id`) als zweite Verteidigungslinie. Kein Cross-User-/Cross-Version-Zugriff möglich.
- **Mass Assignment:** PUT-Upsert setzt `user_id`/`plan_version_id` ausschließlich aus Session/URL, nie aus dem Request-Body — Spoofing ausgeschlossen.
- **Eingabevalidierung:** Zod (UUIDs, `jahr` 2000–2100, `monat` 1–12, `betrag_manuell` ≥0 oder null). Negative/ungültige Werte → 400.
- **Injection/XSS:** Supabase parametrisiert; Kategorie-/Produktnamen werden als React-Text gerendert (kein `dangerouslySetInnerHTML`).
- **Globale `kpi_categories`-Lesezugriff** in der berechnet-Route betrifft nur nicht-sensible Referenz-Kategorienamen (projektweit ohnehin lesbar) — kein Datenleck.
- **Secrets:** keine im Code; `get_advisors` (security) meldet **keine neue Warnung** für `langfristige_investitionsausgaben_planung` (bestehende Warnungen betreffen ausschließlich ältere `USING(true)`-Tabellen).

### Bugs

Keine Critical/High/Medium gefunden.

**Low / Beobachtungen (kein Blocker):**
- **L1 (by design):** Der Bestellkosten↔Einkauf-Untergruppen-Abgleich erfolgt über den **Namen** (Snapshot bei Versionsanlage). Wird eine globale „Produkt"-Unterkategorie nach dem Snapshot umbenannt, divergieren die Namen und die Auto-Befüllung der betroffenen Untergruppe greift still nicht mehr. Im Tech Design bewusst akzeptiert (kein gespeicherter ID-Link); als Folge-Spec notiert.
- **L2 (kosmetisch/unerreichbar):** Der „keine Investitionskategorien"-Leerzustand ist für reguläre Versionen praktisch nicht erreichbar, da das Snapshot-Seeding (PROJ-74) beim ersten `GET ?art=lp_investition` automatisch 3 feste Übergruppen anlegt. Funktional korrekt (defensiver Fallback).
- **L3 (konsistent mit PROJ-91):** Keine Jahres-Gruppierungszeile über den Monatsspalten (in der Spec als „optional" markiert); das Jahr steht im Monatslabel („Apr 2026").

### Hinweis zur Gesamt-Testsuite
Ein vollständiger `vitest run` zeigt vorbestehende Fehlschläge in **unbeteiligten** Bereichen (laufende Arbeit anderer Features, bereits vor dieser Session unkommittiert). Diese importieren **keine** PROJ-92-Dateien und liegen außerhalb dieses QA-Scopes. Alle PROJ-92- und direkt verwandten Suiten sind grün (93/93).

### Production-Ready: **JA**
Keine Critical/High-Bugs. PROJ-92 ist freigegeben.

## Deployment
_To be added by /deploy_
