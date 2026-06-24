# PROJ-88: Operativekosten Planung — Langfristige Planung

## Status: Approved
**Created:** 2026-06-22
**Last Updated:** 2026-06-22 (QA bestanden — Production-Ready)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), kontextabhängiges Seitenmenü, serverseitiger Versions-Eigentums-Check (`ensureLangfristigeVersion`)
- Requires: PROJ-2 (KPI-Modell Verwaltung) — liefert den **globalen** „Operativ"-Knoten im `ausgaben_kosten`-Baum (L1-Gruppen + L2-Untergruppen) als Zeilenquelle
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** sowie **allgemeinen Planungshorizont** (`planungshorizont_monate`)
- Vorlage (kein harter Require): PROJ-84 (Absatzplanung — Langfristige Planung) — Monats-Tabelle, rein manuelle Eingabe, Versionsbindung, Bulk-Edit, Betragsselektion, Notizen; UI/Bedienung werden gespiegelt
- Vorlage (kein harter Require): PROJ-68 (Operative Ausgaben — Kurzfristige Planung) — Zeilenhierarchie aus dem „Operativ"-Subtree (Gruppe → Untergruppe → Gesamt)
- Vorlage (kein harter Require): PROJ-40 (Betragsselektion) — „Hover/Klick"-Summenpanel
- Vorlage (kein harter Require): PROJ-53 (Zellen-Notizen) — Notiz-Mechanismus je Zelle

## Übersicht

Die Seite **„Operativekosten Planung"** ist eine weitere Planungsseite im Navigationsbereich **„Planung"** der Langfristigen Planung. Sie ermöglicht dem Nutzer die **monatsweise** Planung der **operativen Kosten** je Untergruppe einer Planversion, summiert auf Gruppen- und Gesamtebene.

Sie orientiert sich stark an der langfristigen Absatzplanung (PROJ-84) hinsichtlich Bedienung und Mechanik (Monatsspalten, rein manuelle Eingabe, Versionsbindung, Bulk-Edit, Betragsselektion, Zellen-Notizen) und an der kurzfristigen Operative-Ausgaben-Seite (PROJ-68) hinsichtlich der Zeilenhierarchie (Gruppe → Untergruppe → Gesamt). Wesentliche Merkmale:

- **Monatsspalten.** Die Tabelle beginnt **exakt mit dem Startmonat** (aus den Grundeinstellungen der Version) und reicht über den **allgemeinen Planungshorizont** (`planungshorizont_monate` Monate ab Startmonat). **Keine Vorlaufmonate.**
- **Zeilen aus dem globalen KPI-Modell.** Die Zeilen spiegeln die **globale** operative Kategorie wider: der „Operativ"-Knoten aus dem globalen `ausgaben_kosten`-Baum mit seinen L1-Gruppen und L2-Untergruppen. Diese Struktur ist **nicht** versionsspezifisch (das langfristige KPI-Modell aus PROJ-74 verwaltet keine operativen Kostenkategorien); sie wird global gelesen.
- **Manuelle Eingabe je Untergruppe.** Der Nutzer gibt die Werte **ausschließlich manuell** je Untergruppe (Leaf) für jeden Monat ein. Diese werden auf **Gruppenebene** und schließlich auf **Kategorie-/Gesamtebene** aufaddiert.
- **Keine historische Vorbelegung / keine Auto-Berechnung.** Es gibt **keine** Ist-Tatsächlich-/Ist-Plan-Spalten, **keine** automatische Vorbelegung aus Fixkosten-Einstellungen, **keine** Manuell-/Auto-Kennzeichnung (keine blauen/grauen Punkte) und **kein** Feld-Reset auf einen Referenzwert.
- **Versionsbindung der Werte.** Während die **Kategoriestruktur global** ist, sind die **eingegebenen Werte und Notizen strikt pro Planversion** isoliert (Datenisolation gemäß PROJ-73): Eine neu angelegte Version startet leer; Änderungen in Version A haben keinerlei Auswirkung auf Version B oder die Kurzfristige Planung.

**Beibehalten** werden: das **Betragsselektion-/Hover-Klick-Summenpanel** (PROJ-40), die **Massen-Anpassung** mehrerer Zellen (Bulk-Edit), die **Zellen-Notizen** (PROJ-53) sowie **„Alle ein-/ausklappen"** — alle versionsgebunden bzw. seitenbezogen.

## User Stories

- Als Controller möchte ich innerhalb einer geöffneten Planversion über die Navigationsgruppe „Planung" die Seite „Operativekosten Planung" aufrufen können, damit ich die operativen Kosten dieses Szenarios planen kann.
- Als Controller möchte ich je operativer Untergruppe für jeden Monat einen Betrag manuell eingeben können, damit ich die operativen Kosten über mehrere Jahre abbilden kann.
- Als Controller möchte ich, dass meine eingegebenen Untergruppen-Werte automatisch auf Gruppenebene und auf einer Gesamtzeile aufsummiert werden, damit ich Zwischensummen und die Gesamtbelastung auf einen Blick sehe.
- Als Controller möchte ich, dass die Tabelle exakt mit dem Startmonat beginnt und über den allgemeinen Planungshorizont reicht, damit ich genau meinen Planungszeitraum sehe.
- Als Controller möchte ich, dass die operativen Gruppen und Untergruppen aus dem globalen KPI-Modell angezeigt werden, damit dieselbe Kategoriestruktur wie überall sonst gilt.
- Als Controller möchte ich mehrere Zellen selektieren und auf einen Schlag anpassen können (%, fester Betrag, Monat-für-Monat-Progression), damit ich nicht jede Zelle einzeln bearbeiten muss.
- Als Controller möchte ich beim Hovern/Anklicken von Feldern eine laufende Summe der selektierten Werte sehen (Betragsselektion), damit ich Teilsummen schnell prüfen kann.
- Als Controller möchte ich zu einer einzelnen Zelle eine Freitext-Notiz hinterlegen können, damit ich Planungsannahmen direkt am Wert dokumentiere.
- Als Controller möchte ich die Gruppen-Sektionen einzeln auf-/zuklappen sowie mit zwei Buttons alle gleichzeitig ein-/ausklappen können, damit ich bei vielen Untergruppen die Übersicht behalte.
- Als Controller möchte ich, dass meine Eingaben pro Planversion gespeichert werden und beim nächsten Aufruf vorhanden sind, ohne andere Versionen zu beeinflussen.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] In der versionsspezifischen Navigation (`src/lib/langfristige-planung-nav.ts`) gibt es in der Gruppe **„Planung"** einen neuen Eintrag **„Operativekosten Planung"** mit Slug `operativekosten-planung`, der auf `/dashboard/langfristige-planung/[versionId]/operativekosten-planung` verlinkt
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint in der Gruppe „Planung" der Eintrag/die Kachel „Operativekosten Planung" (generisches Rendern zieht automatisch nach)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Wird die Seite mit unbekannter/fremder/ungültiger `versionId` aufgerufen, erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73-Versionskontext (über `LangfristigeVersionShell`)
- [ ] Es gibt **keine** Kennzahlen-Kacheln oberhalb der Tabelle

### Tabellenstruktur & Monatsspalten

- [ ] Die Spalten sind **Monate** (nicht Kalenderwochen)
- [ ] **Erste Spalte** = **Startmonat** (Startmonat/-jahr aus `langfristige_grundeinstellungen`) — **kein** Vorlaufmonat
- [ ] **Letzte Spalte** = Startmonat + (`Planungshorizont` − 1) Monate
- [ ] **Planungshorizont** = `planungshorizont_monate` (allgemeiner Horizont); Fallback wenn nicht gesetzt: 12
- [ ] Gesamtzahl der Monatsspalten = `Planungshorizont`
- [ ] Spaltenüberschriften zeigen Monat + Jahr (Format z. B. „Apr 2026" / „04 / 2026"); optionale Jahres-Gruppierungszeile über den Monatsspalten (analog PROJ-84)
- [ ] Korrekte Berechnung über Jahresgrenzen hinweg (mehrjähriger Horizont)
- [ ] Die Tabelle ist horizontal scrollbar, wenn die Spalten die Bildschirmbreite überschreiten
- [ ] Die erste Spalte (Zeilenbeschriftung) ist beim horizontalen Scrollen sticky (links fixiert), mit opakem Hintergrund (keine durchscheinenden Werte)

### Zeilenhierarchie (aus dem globalen „Operativ"-Subtree)

- [ ] Zeilenquelle: der **globale** „Operativ"-Knoten aus `GET /api/kpi-categories?type=ausgaben_kosten`; gefiltert werden die L1-Gruppen (direkte Kinder von „Operativ") und deren L2-Untergruppen (identische Filterlogik wie PROJ-68)
- [ ] **Pro L1-Gruppe** (direkte Kinder des „Operativ"-Knotens): einklappbare Sektion (Standard: ausgeklappt)
  - Gruppen-Header-Zeile mit Gruppenname + Auf-/Zuklapp-Icon; zeigt die Summe der Untergruppen, nicht editierbar
  - Wenn die Gruppe L2-Untergruppen hat:
    - Pro L2-Untergruppe: editierbare Leaf-Zeile (eingerückt) — Monatswerte editierbar
    - Die Gruppen-Header-Zeile ist die Aggregations-/Summenzeile der Untergruppen
  - Wenn die Gruppe **keine** Untergruppen hat:
    - Die L1-Gruppe selbst ist die editierbare Leaf-Zeile (Monatswerte editierbar)
- [ ] **Ganz unten**: Gesamt-Zeile **„Operativekosten (Gesamt)"** — summiert alle Leaf-Zeilen je Monat, nicht editierbar, immer sichtbar
- [ ] Kategorien in `sort_order`-Reihenfolge des KPI-Modells
- [ ] Aggregationen (Gruppe, Gesamt) sind reaktiv: ändert sich ein Leaf-Wert, aktualisieren sich Gruppen- und Gesamtsumme sofort
- [ ] **Buttons oben rechts:**
  - **„Alle ausklappen"**: klappt alle Sektionen auf (separater Button)
  - **„Alle einklappen"**: klappt alle Sektionen zu (separater Button)

### Manuelle Eingabe & Persistenz

- [ ] Der Nutzer kann jede einzelne Leaf-Zelle (Untergruppe bzw. L1-Gruppe ohne Untergruppen) direkt in der Tabelle bearbeiten (Inline-Editing)
- [ ] Eingabe: Dezimalzahl ≥ 0 (Betrag in €), auf 2 Dezimalstellen gerundet
- [ ] Negative Werte werden verworfen
- [ ] Leeres Feld → NULL (kein Eintrag); eine explizit auf `0` gesetzte Zelle wird als `0,00 €` gespeichert (unterscheidet sich von leer)
- [ ] Beim Verlassen einer Zelle (onBlur) wird der Wert automatisch gespeichert (kein separater Speichern-Button)
- [ ] Werte werden in einer neuen, **versionsgebundenen** Tabelle persistiert (`plan_version_id` + `user_id`)
- [ ] Beim nächsten Seitenladevorgang werden gespeicherte Werte aus der DB geladen und angezeigt
- [ ] Optimistisches Update: Wert erscheint sofort; bei API-Fehler → Toast-Fehlermeldung + Rollback
- [ ] Es gibt **keine** historische Vorbelegung — leere Zellen bleiben leer
- [ ] Es gibt **keine** visuelle Manuell-/Auto-Kennzeichnung (keine blauen/grauen Punkte)
- [ ] Es gibt **keine** automatische Vorbelegung aus Fixkosten-Einstellungen
- [ ] Es gibt **kein** Zurücksetzen einer einzelnen Zelle auf einen Referenzwert (es existiert kein Referenzwert)
- [ ] Aggregations- (Gruppen-) und Gesamt-Zellen sind **nicht** editierbar

### Betragsselektion (Hover/Klick-Summe, wie PROJ-40)

- [ ] Der Nutzer kann einzelne Zellwerte durch Klicken oder Ctrl+Klicken auswählen
- [ ] Die Summe aller selektierten Werte (Anzahl + Summe in €) wird in einem Panel rechts unten angezeigt
- [ ] Das Panel erscheint ab mindestens einer selektierten Zelle und verschwindet, wenn die Selektion aufgehoben wird
- [ ] Nicht-editierbare Zellen (Gruppen-/Gesamt-Aggregation) können ebenfalls zur reinen Summenanzeige selektiert werden
- [ ] Verhalten identisch mit der bestehenden Betragsselektion (PROJ-40 / PROJ-84)

### Massen-Anpassung (Bulk-Edit, wie PROJ-84)

- [ ] Der Nutzer kann mehrere editierbare (Leaf-)Zellen gleichzeitig selektieren (Multi-Selektion via Ctrl+Klick)
- [ ] Sobald ≥ 2 editierbare Zellen selektiert sind, erscheint ein „X Felder anpassen"-Button/Badge
- [ ] Klick öffnet ein Modal/Popover mit Dropdown „Methode" + Zahlenfeld „Wert" + „Anwenden" + „Abbrechen" mit folgenden Methoden:
  1. „Auf festen Betrag setzen"
  2. „Alle um X % erhöhen"
  3. „Alle um X % senken"
  4. „Alle um festen Betrag erhöhen"
  5. „Alle um festen Betrag senken"
  6. „Monat für Monat um X % steigen"
  7. „Monat für Monat um X % sinken"
  8. „Monat für Monat um festen Betrag steigen"
  9. „Monat für Monat um festen Betrag sinken"
- [ ] Methoden 1–5 verändern jede selektierte Zelle unabhängig ausgehend vom aktuellen Wert
- [ ] Progressive Methoden (6–9): die selektierten Zellen werden je (Untergruppe) nach Monat sortiert; der erste Monat behält seinen aktuellen Wert; jeder folgende Monat verändert den Wert des Vormonats um X % / X
- [ ] Ergebniswerte < 0 werden auf 0 gesetzt
- [ ] Nach Anwenden werden alle betroffenen Zellen gespeichert (gebündelter Request); Modal schließt; Selektion wird aufgehoben
- [ ] Verhalten identisch zur langfristigen Absatzplanung (PROJ-84), nur auf eine Wertart (Betrag) bezogen

### Zellen-Notizen (wie PROJ-53, versionsgebunden)

- [ ] Ist **genau eine** editierbare Zelle selektiert, erscheint ein Button „Notiz hinzufügen" (bzw. „Notiz bearbeiten", wenn bereits eine Notiz existiert)
- [ ] Der Button ist nicht sichtbar bei keiner, mehrfacher oder nicht-editierbarer Selektion
- [ ] Ein Klick öffnet ein Overlay mit Zellidentifikation (z. B. „Notiz — Untergruppe X · Gruppe Y · Apr 2026"), Textarea, „Speichern", „Abbrechen" und (bei bestehender Notiz) „Notiz löschen"
- [ ] Zellen mit Notiz zeigen einen sichtbaren Indikator; Hover zeigt den Notiztext
- [ ] Notizen sind an die **Zellkoordinate** (Kategorie + Monat/Jahr) gebunden und bleiben beim Verschieben des Monatsfensters erhalten (sie hängen am Monat, nicht an der Spaltenposition)
- [ ] Notizen werden **pro Planversion** und Seite (`seite = 'operativekosten-planung'`) gespeichert und geladen (Wiederverwendung von `langfristige_planung_notizen`)

### Datenisolation (PROJ-73)

- [ ] Alle Lese-/Schreibzugriffe auf Werte und Notizen sind nach `versionId` **und** `user_id` gefiltert
- [ ] Eine neu angelegte Planversion zeigt eine **leere** Operativekosten Planung (keine Übernahme aus anderen Versionen oder der Kurzfristigen Planung)
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B oder die Kurzfristige Planung
- [ ] Beim Löschen der Planversion werden alle Werte- und Notiz-Datensätze kaskadierend mitgelöscht (ON DELETE CASCADE) — keine verwaisten Datensätze
- [ ] Die **globale** Kategoriestruktur (Operativ-Subtree) ist bewusst nicht versionsisoliert; nur die eingegebenen Werte/Notizen sind versionsgebunden

### Datenbankschema

- [ ] Neue Tabelle `langfristige_operativekosten_planung`:
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `kategorie_id` UUID NOT NULL — Verweis auf die globale KPI-Leaf-Kategorie (Untergruppe bzw. L1-Gruppe ohne Untergruppen); kein FK auf die globale KPI-Tabelle nötig (analog Notiz-`zellen_schluessel`-Muster), Konsistenz wird über Anzeige sichergestellt
  - `jahr` INTEGER NOT NULL (CHECK 2000–2100), `monat` INTEGER NOT NULL CHECK (1–12)
  - `betrag` NUMERIC(12,2) NULL — NULL = kein Wert; CHECK ≥ 0 oder NULL
  - `created_at`/`updated_at`
  - UNIQUE(`plan_version_id`, `kategorie_id`, `jahr`, `monat`) → ermöglicht Upsert via `onConflict`
  - RLS: Nutzer sieht und schreibt nur eigene Einträge (`auth.uid() = user_id`); Versionszugehörigkeit serverseitig zusätzlich geprüft
- [ ] Notizen nutzen die bestehende Tabelle `langfristige_planung_notizen` (Feld `seite = 'operativekosten-planung'`, `zellen_schluessel = '${kategorie_id}:${jahr}:${monat}'`) — keine neue Notiz-Tabelle nötig

### API-Routen (versions- & nutzergebunden)

- [ ] `GET /api/langfristige-planung/[versionId]/operativekosten-planung` — alle gespeicherten Werte der Version
- [ ] `PUT /api/langfristige-planung/[versionId]/operativekosten-planung` — akzeptiert **zwei Formen**:
  - Einzelzelle: `{ kategorie_id, jahr, monat, betrag? }`
  - Bündel (Massen-Anpassung): `{ cells: Array<obige Form> }`
  - Upsert je `(plan_version_id, kategorie_id, jahr, monat)`; `betrag: null` setzt das Feld auf NULL
- [ ] Notizen: bestehende Route `GET/PUT/DELETE /api/langfristige-planung/[versionId]/planung-notizen` mit `seite=operativekosten-planung` (keine neue Route nötig)
- [ ] Alle Routen: `requireAuth()` + `ensureLangfristigeVersion()`, Zod-Validierung (UUIDs, `monat` 1–12, `jahr` plausibel, Werte ≥ 0 oder null; Bündel max. sinnvolle Obergrenze), Filter nach `user_id` + `plan_version_id`; fremde/unbekannte `versionId` → 404 (kein Fremdzugriff)

## Edge Cases

- **Kein „Operativ"-Knoten im globalen KPI-Modell oder dieser hat keine Kinder:** leerer Zustand mit Hinweis „Keine operativen Kostenkategorien im KPI-Modell vorhanden. Bitte den Knoten ‚Operativ' im KPI-Modell konfigurieren." + Link zur KPI-Modell-Verwaltung
- **L1-Gruppe ohne Untergruppen:** die L1-Gruppe selbst ist editierbar (Leaf), keine zusätzliche Aggregationszeile
- **L1-Gruppe mit Untergruppen:** L1-Header ist nur Summenzeile (nicht editierbar); Eingabe ausschließlich auf L2-Ebene
- **Planungshorizont nicht gesetzt:** Fallback 12 Monate
- **Grundeinstellungen der Version noch nicht gespeichert:** Standard-Startmonat (aktueller Monat/Jahr) und Default-Horizont gelten (analog PROJ-75-Default), kein Absturz
- **Jahresgrenze im Horizont** (mehrjähriger Zeitraum): korrekte fortlaufende Monatsspalten über Jahreswechsel hinweg
- **Startmonat-Änderung in den Grundeinstellungen:** beim nächsten Seitenladen verschiebt sich das Monatsfenster; gespeicherte Werte bleiben an ihrer Monat/Jahr-Koordinate erhalten und erscheinen nur, wenn die Koordinate im neuen Fenster liegt
- **Zelle manuell auf 0 gesetzt:** gültig, wird als `0,00 €` gespeichert (unterscheidet sich von NULL/leer)
- **Massen-Anpassung mit Wert = 0:** erlaubt; Zellen werden mit 0 überschrieben (bzw. „auf festen Betrag setzen" = 0)
- **Progressive Methode mit nur einer selektierten Zelle:** erlaubt (Ergebnis = einfache Anpassung der einen Zelle)
- **Kategorie wird im globalen KPI-Modell gelöscht/umbenannt:** Werte mit dieser `kategorie_id` werden nicht mehr angezeigt (Kategorie erscheint nicht mehr); Datensätze bleiben als „verwaiste" Einträge bestehen, beeinflussen die Anzeige nicht (konsistent mit Notiz-`zellen_schluessel`-Muster)
- **Sehr langer Horizont** (z. B. 120 Monate): Tabelle horizontal scrollbar, Label-Spalte sticky, kein Layout-Bruch
- **Sehr viele Untergruppen:** Zeilen nicht paginiert; Sektionen einklappbar; vertikales Scrollen
- **Aufruf mit fremder/unbekannter `versionId`:** Redirect zum Dashboard (PROJ-73), kein Datenzugriff
- **API-Fehler beim Laden:** Lade-Fehlerzustand, kein Absturz; Toast-Hinweis

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen versionsgebundenen Tabelle; Versionszugehörigkeit serverseitig prüfen (`ensureLangfristigeVersion`, Defense-in-Depth zur RLS)
- Alle Eingaben serverseitig mit Zod validieren (UUIDs, Monat 1–12, Jahr, numerische Werte ≥ 0 oder null)
- Neue versionsgebundene Next.js-Seite: `src/app/dashboard/langfristige-planung/[versionId]/operativekosten-planung/page.tsx` (nutzt `LangfristigeVersionShell` mit `seitenTitel="Operativekosten Planung"` und `fullWidth`)
- Navigation: neuer Eintrag „Operativekosten Planung" (Slug `operativekosten-planung`) in der Gruppe „Planung" in `src/lib/langfristige-planung-nav.ts` (NavSheet + Versions-Übersicht ziehen automatisch nach)
- Zeilenquelle: globaler „Operativ"-Subtree über `GET /api/kpi-categories?type=ausgaben_kosten`; Filterlogik 1:1 aus PROJ-68 (`use-operativeausgaben.ts`) übernehmen (Root „Operativ" finden, L1-Gruppen + L2-Untergruppen)
- Monatsberechnung: `date-fns` (bereits installiert) — `addMonths`, `getMonth`, `getYear`; Monatsfenster aus Startmonat + Horizont abgeleitet (ohne Vorlauf)
- Wiederverwendung der Bausteine: `LangfristigeVersionShell`, `ensureLangfristigeVersion`, Betragsselektion-Muster (`data-betrag-selektion`), `PlanungNotizFormular`, `useLangfristigePlanungNotizen(versionId, 'operativekosten-planung')`; Bulk-Edit-Dialog analog `LangfristigeAbsatzplanungBulkEditDialog` (auf eine Wertart „Betrag" reduziert)
- shadcn/ui first: Table/Input/Dialog/Select/Popover/AlertDialog/Tooltip/Button/Card/Skeleton — alle vorhanden
- Kein neues npm-Paket nötig
- Responsive: Mobil (375px) bis Desktop (1440px)

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Übernahme der hier geplanten operativen Kosten in nachgelagerte langfristige Auswertungsseiten (z. B. Liquiditäts-/Rentabilitätsauswertung der Langfristigen Planung) — eigene Specs
- Optionale automatische Vorbelegung aus langfristigen Fixkosten-Einstellungen (PROJ-81 wurde entfernt; derzeit bewusst rein manuell)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-22)

### Leitidee

Diese Seite ist die **operative Schwester der langfristigen Absatzplanung (PROJ-84)**. Sie verbindet zwei bereits gebaute Welten:

1. das **Versions-Fundament** (PROJ-73): Routing über die Planversion, das gemeinsame Seitengerüst (Versionsprüfung, Header, Redirect bei fremder Version), die zentrale Navigations-Konfiguration und der serverseitige Versions-Eigentums-Check;
2. die **bewährte Planungs-Mechanik** der langfristigen Absatzplanung (PROJ-84): monatsbasierte Tabelle, Inline-Bearbeitung mit automatischem Speichern, Mehrfachselektion, Massen-Anpassung, Betragsselektion-Summenpanel und Zellen-Notizen.

Der Kniff: Wir **übernehmen das Bedienkonzept 1:1** und tauschen nur drei Dinge aus:

- **Zeilen statt Plattform×Produkt = operative Kategorie-Hierarchie** (Gruppe → Untergruppe → Gesamt) aus dem **globalen** KPI-Modell (wie auf der kurzfristigen Operative-Ausgaben-Seite PROJ-68);
- **eine Wertart statt zwei** (nur „Betrag" je Zelle, kein Absatz + VK);
- **Start exakt im Startmonat ohne Vorlaufmonate** (PROJ-84 zeigt 2 Vorlaufmonate, diese Seite nicht).

Bewusst **kein** Umbau bestehender Seiten und **kein** Neuerfinden: Die in sich geschlossenen Bausteine (Versions-Gerüst, Versions-Sicherheits-Helfer, Notiz-Overlay + versionsbewusster Notiz-Mechanismus, Betragsselektion-Muster) werden direkt mitgenutzt; der Massen-Anpassungs-Dialog wird als auf eine Wertart reduzierte Variante des Absatzplanungs-Dialogs erstellt.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                 (Versions-Übersicht — bestehend)
+-- Gruppe "Planung" erhält Eintrag/Kachel "Operativekosten Planung"  (zieht generisch nach)

/dashboard/langfristige-planung/[versionId]/operativekosten-planung   (NEUE Seite)
+-- LangfristigeVersionShell  (bestehend — prüft Version, Header/Breadcrumb, Redirect, Toaster; fullWidth)
    +-- OperativekostenPlanungTabelle  (NEUE Hauptkomponente)
        +-- Leer-Zustand (wenn kein "Operativ"-Knoten / keine Kinder im globalen KPI-Modell)
        +-- Kopfbereich rechts: Buttons "Alle ausklappen" / "Alle einklappen"
        +-- Scroll-Container (horizontal, Label-Spalte sticky links, opak)
        |   +-- Kopfzeile: [Label] | [Jan 2026] | [Feb 2026] | ...  (Monate; optionale Jahres-Gruppierungszeile)
        |   +-- [Pro L1-Gruppe des "Operativ"-Knotens]
        |   |   +-- Gruppen-Header (einklappbar; zeigt Summe der Untergruppen, nicht editierbar)
        |   |   +-- [wenn ausgeklappt + hat Untergruppen, pro Untergruppe]
        |   |   |   +-- Zeile "[Untergruppe]"  (editierbar je Monat)
        |   |   +-- [wenn Gruppe KEINE Untergruppen hat]
        |   |       +-- Gruppe selbst als editierbare Leaf-Zeile (je Monat)
        |   +-- Gesamt-Zeile "Operativekosten (Gesamt)"   ← GANZ UNTEN (Summe aller Leafs, nicht editierbar)
        +-- OperativekostenPlanungBulkEditDialog   (NEU — auf eine Wertart reduziert)
        +-- PlanungNotizFormular                   (WIEDERVERWENDET — Notiz-Overlay)
        +-- Betragsselektion-Summenpanel           (WIEDERVERWENDETES Muster, rechts unten)
        +-- Einzel-Notiz-Button                    (rechts unten, wenn genau 1 editierbare Zelle selektiert)
```

Das linke Seitenmenü und die Versions-Übersichtsseite rendern die Nav-Gruppen generisch — der neue „Planung"-Eintrag erscheint allein durch die Ergänzung in der zentralen Nav-Konfiguration.

### B) Datenmodell (Klartext)

Es entsteht **eine neue, versionsgebundene Tabelle** für die Werte. Notizen nutzen die **bereits bestehende** versionsgebundene Notiz-Tabelle mit (siehe unten).

**Neue Tabelle — „Langfristige Operativekosten-Planung" (ein Eintrag je Zellkoordinate):**
```
Jeder Eintrag hat:
- eindeutige ID
- Besitzer (Nutzer)                        → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion → Isolation
- Verweis auf eine operative Leaf-Kategorie (Untergruppe, bzw. Gruppe ohne Untergruppen)
  aus dem GLOBALEN KPI-Modell
- Monat (1–12) + Jahr
- Betrag (Dezimalzahl ≥ 0, oder "leer")
Eindeutigkeit: je (Planversion, Kategorie, Jahr, Monat) genau ein Eintrag.
```

Wichtiger, bewusster Unterschied zu PROJ-84: Der Kategorie-Verweis zeigt auf das **globale** KPI-Modell (die operative Kostenstruktur ist nicht versionsspezifisch), während **die Werte selbst versionsgebunden** sind. Es wird — wie beim Notiz-Muster — **kein** harter Fremdschlüssel auf die KPI-Tabelle gesetzt; verschwindet eine Kategorie im KPI-Modell, wird ihr (nicht mehr anzeigbarer) Wert einfach nicht mehr dargestellt. Gruppen- und Gesamtsummen werden **nicht gespeichert**, sondern stets aus den Untergruppen-Werten berechnet.

**Notizen — bestehende Tabelle „Langfristige Planungs-Notizen" (wiederverwendet):**
```
Bestehende seitenübergreifende Notiz-Tabelle (eingeführt mit PROJ-84):
- Besitzer + Planversion (Isolation, kaskadierende Löschung)
- Seitenkennung           → hier: "operativekosten-planung"
- Zellkoordinate          → Kategorie + Jahr + Monat
- Notiztext (Freitext)
Eindeutigkeit: je (Planversion, Seite, Zellkoordinate) genau eine Notiz.
```
Da diese Tabelle bereits über ein Seitenkennungs-Feld seitenübergreifend ausgelegt ist, ist **keine neue Notiz-Tabelle nötig** — die Operativekosten Planung tritt nur als zusätzliche „Seite" hinzu.

**Regeln (für beide):**
```
- Jeder Datensatz ist an Nutzer + Planversion gebunden; Zugriff nur auf eigene Daten
  (Row Level Security + serverseitige Prüfung der Versionszugehörigkeit).
- Wird die Planversion gelöscht, verschwinden alle Werte- und Notiz-Einträge automatisch mit.
- Keine historische Vorbelegung: fehlt ein Eintrag, ist die Zelle schlicht leer.
- Die globale Kategoriestruktur ist absichtlich NICHT versionsisoliert.
```

### C) Welche Spalten (Monate) werden gezeigt?

```
Aus den Grundeinstellungen der Version (PROJ-75) kommen:
  Startmonat (Monat + Jahr) und allgemeiner Planungshorizont (Monate); fehlt er → 12.

Erste Spalte  = Startmonat            (KEIN Vorlauf)
Letzte Spalte = Startmonat + (Planungshorizont − 1) Monate
Spaltenanzahl = Planungshorizont
```
Die Monatsabfolge wird sauber über Jahresgrenzen hinweg gebildet. Gespeicherte Werte hängen an ihrer Monat/Jahr-Koordinate; verschiebt der Nutzer später den Startmonat, erscheinen nur die Werte, deren Koordinate im neuen Fenster liegt (die übrigen bleiben gespeichert, sind aber außerhalb des Fensters nicht sichtbar).

### D) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Shell prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Die Tabelle lädt parallel:
     ① Grundeinstellungen der Version  → Startmonat + Planungshorizont (Monatsfenster)
     ② globales KPI-Modell (ausgaben_kosten) → "Operativ"-Subtree: Gruppen + Untergruppen
     ③ gespeicherte Operativekosten-Werte der Version
     ④ gespeicherte Notizen der Version (Seite "operativekosten-planung")
  → Aufbau der Zeilen: pro Gruppe (Summenzeile) → Untergruppen (editierbar) → Gesamt (unten)
  → Aggregation (frontend, reaktiv): Gruppen-/Gesamtsummen aus den Untergruppen-Werten

Nutzer bearbeitet eine Zelle (onBlur)
  → optimistische Anzeige + Speichern der einen Zelle; Fehler → Toast + Rücksetzen

Nutzer selektiert mehrere editierbare Zellen → "X Felder anpassen"
  → Massen-Anpassungs-Dialog berechnet neue Werte
  → betroffene Zellen werden gebündelt gespeichert, Selektion wird aufgehoben

Nutzer selektiert genau eine editierbare Zelle → "Notiz hinzufügen/bearbeiten"
  → Notiz-Overlay; Speichern/Löschen schreibt in die bestehende Notiz-Tabelle

Betragsselektion: Klick/Ctrl+Klick auf Werte → laufende Summe rechts unten
```

### E) Server-Schnittstellen (versions- & nutzergebunden)

Alle Endpunkte liegen unter der Langfristig-Struktur und folgen exakt dem etablierten Muster (Login-Pflicht, Versions-Eigentums-Prüfung über den gemeinsamen Helfer, Filterung nach Nutzer **und** Version als zweite Sicherheitsebene zur RLS, Eingabeprüfung). Fremde/unbekannte Version → kein Zugriff (404).

```
Operativekosten-Werte (NEU):
  Lesen     – alle gespeicherten Werte der Version
  Speichern – eine Zelle anlegen/aktualisieren (Kategorie, Jahr, Monat, Betrag)
  Speichern (Bündel) – mehrere Zellen in einem Aufruf (für die Massen-Anpassung)

Notizen (BESTEHENDE Route wiederverwenden, nur mit Seite "operativekosten-planung"):
  Lesen / Speichern / Löschen – je Zelle
```

### F) Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/operativekosten-planung/page.tsx` | Echte Seite: Versions-Shell + Tabelle |
| `src/components/operativekosten-planung-tabelle.tsx` | Hauptkomponente: Monats-Matrix, Gruppen/Untergruppen/Gesamt, Inline-Edit, Auf-/Zuklappen, Selektion, Aggregation, Einbindung von Bulk-Edit/Notiz/Betragsselektion |
| `src/components/operativekosten-planung-bulk-edit-dialog.tsx` | Massen-Anpassungs-Dialog auf Monatsebene, auf eine Wertart „Betrag" reduziert (Vorlage: Absatzplanungs-Dialog) |
| `src/hooks/use-operativekosten-planung.ts` | Lädt Grundeinstellungen/globalen Operativ-Subtree/Werte der Version, berechnet das Monatsfenster, Auto-Save (einzeln + gebündelt), optimistisch + Rücksetzen |
| `src/app/api/langfristige-planung/[versionId]/operativekosten-planung/route.ts` | Lesen + Speichern (einzeln/gebündelt) der Operativekosten-Werte |

### G) Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Operativekosten Planung" (Slug `operativekosten-planung`) in der bestehenden Gruppe „Planung" — Menü und Übersichtsseite ziehen automatisch nach |

### H) Wiederverwendung im Detail

| Baustein | Status | Anmerkung |
|---|---|---|
| Versions-Gerüst (`LangfristigeVersionShell`) | **unverändert wiederverwenden** | Versionsprüfung, Header, Redirect, Toaster, `fullWidth` |
| Versions-Sicherheits-Helfer (`ensureLangfristigeVersion`) | **unverändert wiederverwenden** | in der neuen API-Route |
| Notiz-Overlay (`PlanungNotizFormular`) | **unverändert wiederverwenden** | nur an die versionsbewusste Notiz-Quelle angebunden |
| Versionsbewusster Notiz-Hook (`useLangfristigePlanungNotizen`) | **wiederverwenden** | mit Seite `operativekosten-planung` |
| Notiz-Route + Notiz-Tabelle | **unverändert wiederverwenden** | seitenübergreifend; keine neue Tabelle/Route |
| Betragsselektion-Summenpanel | **Muster wiederverwenden** | identisch zu PROJ-40/PROJ-84 (`data-betrag-selektion`) |
| Operativ-Subtree-Filter (Root „Operativ", Gruppen + Untergruppen) | **Logik aus PROJ-68 übernehmen** | aus `use-operativeausgaben.ts` |
| Grundeinstellungen der Version (Startmonat/Horizont) | **wiederverwenden** | aus PROJ-75 lesen |
| Massen-Anpassungs-Dialog | **Neubau (Vorlage PROJ-84)** | auf eine Wertart reduziert |
| Haupttabelle + Werte-Endpunkt + 1 Tabelle | **Neubau** | monatsbasiert, kategorie-hierarchisch, rein manuell, versionsgebunden |

### I) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Eigene Tabelle/Hook statt Generalisierung der Absatzplanung | Fokussierter Neubau (gespiegelt) | Andere Zeilenquelle (Kategorie-Hierarchie statt Plattform×Produkt), eine Wertart, kein Vorlauf — eine Verallgemeinerung brächte mehr Regressionsrisiko als Nutzen |
| Bulk-Edit-Dialog als reduzierte Variante neu bauen | Ja | Bestehender Dialog ist auf zwei Wertarten (Absatz/VK) zugeschnitten; eine schlanke 1-Wertart-Variante ist klarer als Parametrisierung |
| Notiz-Tabelle & -Route wiederverwenden | Ja | Bereits seitenübergreifend ausgelegt (Seitenkennung) — kein Doppelbau, automatisch versions-isoliert |
| Globale Kategoriestruktur, versionsgebundene Werte | Ja (laut Anforderung) | Operative Kostenkategorien sind im langfristigen KPI-Modell (PROJ-74) nicht enthalten; einheitliche Struktur wie überall, nur Werte je Szenario isoliert |
| Summen berechnen statt speichern | Ja | Gruppen-/Gesamtsumme ist immer die Summe der Untergruppen — Speichern wäre redundant und fehleranfällig |
| Gebündeltes Speichern für Massen-Anpassung | Ja | Eine Massen-Anpassung betrifft viele Zellen; ein Sammel-Aufruf vermeidet viele Einzel-Requests |
| Start exakt im Startmonat (kein Vorlauf) | Ja (vom Nutzer bestätigt) | Entspricht dem genannten Planungszeitraum; Abweichung von PROJ-84 ist gewollt |
| Gesamt-Zeile unten | Ja (vom Nutzer bestätigt) | Konsistent mit der kurzfristigen Operative-Ausgaben-Seite (PROJ-68) |
| Datenhaltung in der Datenbank, pro Version | Ja | Szenario-Isolation und Dauerhaftigkeit (PROJ-73-Prinzip); kein localStorage |

### J) Dependencies (Pakete)

Keine neuen npm-Pakete nötig. Verwendet werden bestehende Bausteine: `date-fns` (Monatsrechnung, bereits installiert), shadcn/ui (Table, Input, Select, Dialog, AlertDialog, Popover, Tooltip, Button, Card, Skeleton), Zod (Eingabeprüfung), Supabase (Datenhaltung inkl. Row Level Security), Next.js App-Router (dynamisches Versions-Segment) sowie die wiederverwendeten Projekt-Komponenten (Versions-Shell, Notiz-Overlay, versionsbewusster Notiz-Hook, Betragsselektion-Muster).

### K) Umsetzungsreihenfolge (empfohlen)

1. Nav-Eintrag „Operativekosten Planung" in der zentralen Nav-Konfiguration (macht Seite/Übersicht sichtbar).
2. Neue versionsgebundene Werte-Tabelle + Werte-Endpunkt (nutzer-/versionsgesichert, einzeln + gebündelt).
3. Daten-Hook: Monatsfenster aus Grundeinstellungen, globaler Operativ-Subtree + Werte laden, Auto-Save (einzeln/gebündelt); versionsbewusster Notiz-Hook anbinden.
4. Haupttabelle (Monats-Matrix, Gruppen/Untergruppen/Gesamt, Aggregation, Selektion) + Bulk-Edit-Dialog + Notiz-Overlay + Betragsselektion; Seite ins Versions-Gerüst einbetten.

> Hinweis: Da die Notiz-Infrastruktur (Tabelle + Route + Overlay + Hook) bereits existiert, beschränkt sich der Notiz-Teil auf das Anbinden mit der neuen Seitenkennung.

## Implementation Notes (Frontend — 2026-06-22)

### Neue Dateien
- `src/hooks/use-operativekosten-planung.ts` — versionsbewusster Daten-Hook. Lädt parallel: Grundeinstellungen (Startmonat + allgemeiner `planungshorizont_monate`, Fallback 12), den **globalen** „Operativ"-Subtree (`/api/kpi-categories?type=ausgaben_kosten`, Root „operativ" → L1-Gruppen → L2-Untergruppen, `sort_order`-sortiert) sowie die gespeicherten Werte der Version. Monatsfenster `buildOperativekostenMonate`: erste Spalte = **exakt Startmonat, kein Vorlauf**, insgesamt `horizont` Monate, Jahresgrenzen korrekt. Gruppen ohne Untergruppen werden als editierbares Leaf (`istLeaf=true`) markiert. Selektor `getBetrag`, abgeleitete `leafKategorieIds` (für Gesamtsumme), Auto-Save `upsertCell` (optimistisch + Rollback) und `upsertBatch` (gebündelt). Schlüssel-Helfer `betragCellKey` = `${kategorieId}:${jahr}:${monat}`. Keine historische Vorbelegung — leere Zellen bleiben leer.
- `src/components/operativekosten-planung-bulk-edit-dialog.tsx` — Massen-Anpassungs-Dialog, auf **eine Wertart (Betrag in €)** reduziert. 9 Methoden inkl. „Monat für Monat …"-Progression (kumulativ, je Kategorie gruppiert). Ergebnis < 0 → 0, auf 2 Dezimalstellen gerundet.
- `src/components/operativekosten-planung-tabelle.tsx` — Hauptkomponente. Flache Zeilenliste: pro L1-Gruppe entweder `group-header` (einklappbar, Summe der Untergruppen, nicht editierbar) + `subgroup`-Zeilen (editierbar, eingerückt) oder — bei fehlenden Untergruppen — `group-leaf` (editierbar). **Gesamt-Zeile „Operativekosten (Gesamt)" ganz unten** (Summe aller Leafs, nicht editierbar). Toolbar mit Zeitraum-Hinweis + Buttons **„Alle ausklappen"/„Alle einklappen"**. Inline-Editing mit onBlur-Auto-Save, Mehrfachselektion (Ctrl+Klick), **Betragsselektion-Summenpanel** (`data-betrag-selektion`), **Bulk-Edit**-Panel (ab ≥ 2 editierbaren Zellen), **Notiz**-Overlay + Zellindikator (Tooltip). Jahres-Gruppierungszeile über den Monatsspalten; Label-Spalte sticky mit opakem Hintergrund. **Kein** Vorlauf, **keine** historische Vorbelegung, **keine** Manuell/Auto-Punkte, **kein** Feld-Reset.
- `src/app/dashboard/langfristige-planung/[versionId]/operativekosten-planung/page.tsx` — echte Seite: `LangfristigeVersionShell` (`seitenTitel="Operativekosten Planung"`, `fullWidth`) + Tabelle.

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — neuer Eintrag „Operativekosten Planung" (Slug `operativekosten-planung`) in der Gruppe „Planung" (nach „Marketing-Planung"). NavSheet + Versions-Übersicht ziehen generisch nach.

### Wiederverwendet (unverändert)
- `LangfristigeVersionShell` (Versionsprüfung/Header/Redirect/Toaster), `PlanungNotizFormular` (Notiz-Overlay), `useLangfristigePlanungNotizen(versionId, 'operativekosten-planung')` (versionsgebundene Notizen, bestehende Tabelle/Route, Seitenfeld), Betragsselektion-Muster, shadcn/ui-Primitives. Operativ-Subtree-Filterlogik gespiegelt aus `use-operativeausgaben.ts` (PROJ-68).

### Erwartete API (für /backend)
Alle Endpunkte versions- & nutzergesichert (`requireAuth` + `ensureLangfristigeVersion`); fremde/unbekannte `versionId` → 404.
- `GET /api/langfristige-planung/[versionId]/operativekosten-planung` → `Array<{ kategorie_id, jahr, monat, betrag }>` (alle gespeicherten Werte der Version).
- `PUT /api/langfristige-planung/[versionId]/operativekosten-planung` — akzeptiert **zwei Formen**:
  - Einzelzelle: `{ kategorie_id, jahr, monat, betrag? }`
  - Bündel (Massen-Anpassung): `{ cells: Array<obige Form> }`
  - Upsert je `(plan_version_id, kategorie_id, jahr, monat)`; `betrag: null` setzt das Feld auf NULL. Zod: `kategorie_id` UUID, `jahr` plausibel (z. B. 2000–2100), `monat` 1–12, `betrag` ≥ 0 oder null.
- Notizen: bestehende Route `GET/PUT/DELETE /api/langfristige-planung/[versionId]/planung-notizen` mit `seite=operativekosten-planung` (keine neue Route nötig).

Vorgeschlagene Tabelle: `langfristige_operativekosten_planung` (`id`, `user_id`, `plan_version_id` → `langfristige_planversionen` ON DELETE CASCADE, `kategorie_id` UUID ohne FK, `jahr`, `monat` CHECK 1–12, `betrag` NUMERIC(12,2) nullable CHECK ≥ 0, Zeitstempel), UNIQUE `(plan_version_id, kategorie_id, jahr, monat)`, RLS analog `langfristige_absatz_planung`.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen/geänderten Dateien (verbleibende tsc-Fehler sind vorbestehend: stale `.next`-Artefakte zu entfernten PROJ-81/82-Seiten + bestehende `.test.ts`-Typprobleme).
- Hinweis: Bis die API-Route (`/backend`) existiert, zeigt die Tabelle den Lade-Fehlerzustand (kein Absturz); das Versions-Gerüst lädt über die bestehende PROJ-73-API.

## Implementation Notes (Backend — 2026-06-22)

### Datenbank (Supabase-Projekt „Controlling-App", Migration `create_langfristige_operativekosten_planung`)
- Neue Tabelle **`langfristige_operativekosten_planung`**: `id` (uuid PK), `user_id` → `auth.users` (ON DELETE CASCADE), `plan_version_id` → `langfristige_planversionen` (ON DELETE CASCADE → Versions-Löschung räumt Werte mit auf), `kategorie_id` (uuid, **kein FK** — verweist auf das globale KPI-Modell, analog dem Notiz-`zellen_schluessel`-Muster), `jahr` (CHECK 2000–2100), `monat` (CHECK 1–12), `betrag` NUMERIC(12,2) nullable (CHECK ≥ 0 oder NULL), `created_at`/`updated_at`. UNIQUE `(plan_version_id, kategorie_id, jahr, monat)` → ermöglicht Upsert via `onConflict`.
- RLS aktiviert mit 4 Policies (`auth.uid() = user_id` für SELECT/INSERT/UPDATE/DELETE) — strenger als das ältere `USING(true)`-Muster. Indizes: `(user_id)`, `(plan_version_id)`, `(plan_version_id, kategorie_id)`.
- `get_advisors` (security): **keine** neue Warnung für die neue Tabelle (verbleibende Warnungen betreffen ausschließlich vorbestehende Tabellen + die globale Auth-Einstellung).

### API-Route (versions- & nutzergesichert; fremde/unbekannte `versionId` → 404 via `ensureLangfristigeVersion`)
- `src/app/api/langfristige-planung/[versionId]/operativekosten-planung/route.ts` — `GET` (alle Werte der Version, max 20000) + `PUT`. PUT akzeptiert **Einzelzelle** ODER **Bündel** `{ cells: [...] }` (max 2000) via `z.union`; Upsert über den UNIQUE-Konflikt. Zod: `kategorie_id` UUID, `jahr` 2000–2100, `monat` 1–12, `betrag` ≥ 0 oder null. `requireAuth` (401), Validierungsfehler → 400, DB-Fehler → 500. `export const dynamic = 'force-dynamic'` (Next-16-Static-Path-Pass übersprungen).
- Queries zusätzlich nach `user_id` + `plan_version_id` gefiltert (Defense-in-Depth zur RLS).
- **Notizen:** keine neue Route — die bestehende `…/planung-notizen`-Route wird mit `seite=operativekosten-planung` mitgenutzt (Tabelle `langfristige_planung_notizen`).

### Tests
- `…/operativekosten-planung/route.test.ts` — **18 Tests** (GET 200/[]/404/400/401/500; PUT Einzel/Bündel/null/0/400-Fälle für fehlende ID, negativer Betrag, ungültiger Monat, Nicht-UUID, leeres Bündel/404/401/500). **18/18 grün.**
- Gesamte `langfristige-planung`-API-Suite: **424/424 grün** (45 Dateien, keine Regression).

### Frontend-Anbindung
- Keine Änderungen nötig: Der Hook `useOperativekostenPlanung` ruft exakt diese Endpunkte und Datenformate auf. Das Feature ist damit im Browser lauffähig.

## QA Test Results

**Getestet:** 2026-06-22 · **Methode:** Code-Audit aller Akzeptanzkriterien + Vitest (API + reine Logik) + Playwright (Route/Auth/Regression). Interaktionen (Inline-Edit, Mehrfachselektion, Bulk-Edit, Notizen, Aggregation, Ein-/Ausklappen) sind code-/manuell geprüft — analog zum Vorgehen bei PROJ-84/74 (versionsgebundene Seiten ohne automatisierte Login-Session in E2E).

### Testergebnis-Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| Akzeptanzkriterien | ✅ Alle erfüllt (Code-Review + automatisiert) |
| API-Integrationstests (Vitest) | ✅ 18/18 (`operativekosten-planung/route.test.ts`) |
| Logik-Unit-Tests (Vitest) | ✅ 8/8 (`use-operativekosten-planung.test.ts` — Monatsfenster ohne Vorlauf + Schlüssel) |
| E2E-Tests (Playwright) | ✅ 10/10 (5 × Chromium + Mobile Safari) |
| Sicherheitsaudit (Red Team) | ✅ Keine Findings |
| Regression | ✅ Keine durch PROJ-88 verursacht (langfristige-API-Suite 432/432) |
| Bugs | ✅ Keine Critical/High/Medium |

### Akzeptanzkriterien — geprüft

**Navigation & Einstieg**
- ✅ Neuer Eintrag „Operativkosten Planung" (Slug `operativekosten-planung`) in Nav-Gruppe „Planung" (`langfristige-planung-nav.ts`); NavSheet + Versions-Übersicht ziehen generisch nach
- ✅ Auth-Guard: Redirect zu `/login` (E2E, Chromium + Mobile Safari)
- ✅ Fremde/unbekannte `versionId` → Redirect zum Dashboard (via `LangfristigeVersionShell` + API 404)
- ✅ Keine Kennzahlen-Kacheln oberhalb der Tabelle

**Tabellenstruktur & Monatsspalten**
- ✅ Spalten sind Monate; **erste Spalte = exakt Startmonat (kein Vorlauf)**; Gesamtzahl = Planungshorizont (Unit-Tests `buildOperativekostenMonate`)
- ✅ Horizont = `planungshorizont_monate` ?? 12 (Hook)
- ✅ Jahresgrenzen korrekt (Start im Dezember, mehrjähriger Horizont — Unit-Tests)
- ✅ Spaltenüberschriften Monat + Jahr + Jahres-Gruppierungszeile
- ✅ Horizontal scrollbar, Label-Spalte sticky mit opakem Hintergrund

**Zeilenhierarchie (globaler „Operativ"-Subtree)**
- ✅ Zeilenquelle: globaler `?type=ausgaben_kosten`, Root „operativ" → L1-Gruppen → L2-Untergruppen (Filterlogik gespiegelt aus PROJ-68), `sort_order`-Reihenfolge
- ✅ L1-Gruppe mit Untergruppen: einklappbar (Standard offen), Header = Summe (nicht editierbar); L2 editierbar, eingerückt
- ✅ L1-Gruppe ohne Untergruppen: selbst editierbar (`group-leaf`); **visuell wie übrige L1-Kategorien dargestellt** (gleicher Hintergrund, fette Beschriftung — nach Review angepasst)
- ✅ Gesamt-Zeile „Operativkosten (Gesamt)" **ganz unten**, Summe aller Leafs, nicht editierbar
- ✅ Aggregation reaktiv (Gruppen-/Gesamtsumme aktualisiert sich bei Leaf-Änderung)
- ✅ Toggle-Button „Alle ein-/ausklappen" (einheitliches Muster wie übrige Planungsseiten — nach Review angepasst)

**Manuelle Eingabe & Persistenz**
- ✅ Inline-Edit je Leaf-Zelle, onBlur-Auto-Save; negative Werte verworfen; ≥ 0 akzeptiert; leer → NULL; explizit 0 wird gespeichert
- ✅ Optimistisches Update + Rollback + Toast bei Fehler (Hook)
- ✅ Persistenz in `langfristige_operativekosten_planung` (`plan_version_id` + `user_id`); Reload lädt Werte
- ✅ Keine historische Vorbelegung, keine Manuell/Auto-Punkte, keine Auto-Berechnung, kein Feld-Reset; Aggregations-/Gesamt-Zellen nicht editierbar

**Betragsselektion / Bulk-Edit / Notizen**
- ✅ Klick/Ctrl+Klick-Selektion, Summenpanel rechts unten (`data-betrag-selektion`); nicht-editierbare Zellen selektierbar
- ✅ Bulk-Edit ab ≥ 2 editierbaren Zellen; Dialog mit 9 Methoden (auf eine Wertart „Betrag" reduziert), Monat-für-Monat-Progression je Kategorie, Ergebnis < 0 → 0; gebündeltes Speichern. Gemischte editierbar/nicht-editierbar-Selektion blendet Bulk-Edit aus (Safety, wie PROJ-84)
- ✅ Notiz-Button bei genau 1 editierbarer Zelle; Overlay mit Zell-Label (Kategorie · Gruppe · Monat); Indikator + Hover-Tooltip; versionsgebunden über `langfristige_planung_notizen` (`seite=operativekosten-planung`)

**Datenisolation & Schema & API**
- ✅ Lese-/Schreibzugriffe nach `versionId` + `user_id` gefiltert; Cascade über `plan_version_id` FK
- ✅ Tabelle `langfristige_operativekosten_planung`, RLS (4 Policies `auth.uid()=user_id`), 3 Indizes; `kategorie_id` ohne FK (globales KPI-Modell); `get_advisors` ohne neue Warnung
- ✅ Route: `requireAuth` + `ensureLangfristigeVersion` (404 bei fremd), Zod-Validierung, Einzel- + Bündel-Upsert

### Edge Cases — geprüft
- ✅ Kein „Operativ"-Knoten / keine Kinder → Leerzustand mit Hinweis + Link zum globalen KPI-Modell (`gruppen.length === 0`)
- ✅ L1 ohne/mit Untergruppen korrekt behandelt (Leaf editierbar vs. Header = Summe)
- ✅ Planungshorizont nicht gesetzt → Fallback 12
- ✅ Jahresgrenze im Horizont (Unit-Test Start Dezember + 30-Monats-Lauf)
- ✅ Zelle explizit 0 vs. leer (NULL) unterschieden (API-Test `betrag=0`)
- ✅ Progressive Bulk-Methode mit 1 Zelle erlaubt; Ergebnis < 0 → 0
- ✅ Bündel-Obergrenze (max 2000) serverseitig; leeres Bündel → 400

### Sicherheitsaudit (Red Team) — keine Findings
- ✅ **Auth:** `requireAuth` in der Route (401 ohne Session)
- ✅ **Authorization / IDOR:** `ensureLangfristigeVersion` prüft Versionseigentum (404 bei fremder Version); Queries zusätzlich nach `user_id` + `plan_version_id`; RLS (`auth.uid() = user_id`) als zweite Ebene. Kein Cross-User-/Cross-Version-Zugriff
- ✅ **Eingabevalidierung:** Zod (`kategorie_id` UUID, `jahr` 2000–2100, `monat` 1–12, `betrag` ≥ 0 oder null; Bündel max 2000)
- ✅ **Mass Assignment:** `user_id` aus Session erzwungen, nicht aus Body
- ✅ **XSS/Injection:** Werte numerisch, Namen als Text (React-Escaping); Supabase parametrisiert. Keine Secrets in Antworten

### Bugs / Beobachtungen
**Keine Critical/High/Medium-Bugs.**

- **L1 (Low, dokumentiert):** `kategorie_id` ist ohne FK an das globale KPI-Modell gebunden (bewusst, da global vs. versionsgebunden). Wird eine Operativ-Kategorie global gelöscht, bleiben evtl. Wert-Datensätze als „verwaiste" Zeilen zurück; sie werden nie angezeigt (Kategorie erscheint nicht mehr). Versions-Kaskade (Version löschen → Werte weg) greift über `plan_version_id` FK. Konsistent mit dem Notiz-`zellen_schluessel`-Muster (PROJ-84).

### Produktionsbereitschaft
**✅ PRODUCTION-READY** — keine Critical/High/Medium-Bugs, Sicherheitsaudit ohne Findings, alle Akzeptanzkriterien erfüllt. Die eine Low-Beobachtung ist eine dokumentierte, bewusste Designentscheidung ohne Funktionsrisiko.

## Deployment
_To be added by /deploy_
