# PROJ-78: Vertriebseinstellungen — Langfristige Planung

## Status: In Progress
**Created:** 2026-06-20
**Last Updated:** 2026-06-20

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden.
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — diese Seite ist eine versionsgebundene Einstellungsseite unter `/dashboard/langfristige-planung/[versionId]/…`; sie nutzt das Versions-Routing, den Versionskontext (`LangfristigeVersionShell`), den Redirect bei fremder Version und das kontextabhängige linke Seitenmenü. Der Nav-Eintrag „Vertriebseinstellungen" (Slug `vertriebseinstellungen`, Gruppe „Einstellungen") wird dort angelegt bzw. löst den dynamischen `[seite]`-Platzhalter ab.
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert je Planversion die **Produkte** (`art = 'lp_produkt'`, flache Liste) als Tabellenzeilen und die **Sales Plattformen** (`art = 'lp_sales_plattform'`) als Reiter/Quelle, jeweils aus `langfristige_kpi_kategorien`.
- Vorlage (kein harter Require): die kurzfristige **Vertriebseinstellungen**-Seite (`src/app/dashboard/kurzfristige-planung/vertriebseinstellungen/page.tsx`) mit ihren vier Reitern — basierend auf PROJ-44 (Versandausgaben), PROJ-46 (Lager-Ausgaben), PROJ-47 (Retouren) und PROJ-48 (Ersatzteile/Kulanz). UI, Bedienung und Datenfluss werden gespiegelt, mit den unten beschriebenen Abweichungen.

## Übersicht

Die Seite „Vertriebseinstellungen" der **Langfristigen Planung** ist der versionsgebundene Gegenpart zur kurzfristigen Vertriebseinstellungen-Seite. Sie wird **pro Planversion** gespeichert — jede Planversion hat eigene, anfangs leere Daten (Datenisolation gemäß PROJ-73), ohne Verbindung zum globalen KPI-Modell oder zur Kurzfristigen Planung.

Wie in der kurzfristigen Version besteht die Seite aus **vier Reitern**:

1. **Versand-Einstellungen**
2. **Lager-Einstellungen**
3. **Retoureneinstellungen** (mit Unter-Reiter „Allgemein" + je Sales Plattform ein Reiter)
4. **Ersatzteile/Kulanz-Einstellungen**

Alles soll der kurzfristigen Seite entsprechen, **mit folgenden bewussten Abweichungen**:

- **Produkte & Sales Plattformen aus der Version:** Tabellenzeilen (Produkte) und Plattform-Bezüge stammen ausschließlich aus dem **KPI-Modell dieser Planversion** (PROJ-74), nicht aus dem globalen Modell.
- **Gruppierung nur Monatlich oder Quartalsweise:** Die Option **Wöchentlich** entfällt überall.
- **Keine „Nächste Zahlungswoche":** Die Eingabe der nächsten Zahlungswoche (Basis-KW/-Jahr) entfällt vollständig. Der Zahlungszeitpunkt ergibt sich **deterministisch aus der Gruppierung**:
  - **Monatlich:** Die Kosten eines Monats werden auf den **Anfang des Folgemonats** gesetzt.
  - **Quartalsweise:** Die Kosten eines Quartals werden auf den **Anfang des Folgemonats des Quartals** gesetzt (Q1 Jan–Mär → 1. April, Q2 Apr–Jun → 1. Juli, Q3 Jul–Sep → 1. Oktober, Q4 Okt–Dez → 1. Januar des Folgejahres).
- **Zahlungsziel (Tage) bleibt erhalten:** Je Reiter/Plattform bleibt das **Zahlungsziel in Tagen** als zusätzlicher Versatz erhalten (es verschiebt den oben bestimmten Anfangstermin zusätzlich nach hinten).
- **Lagerkosten monatlich gepflegt:** Im Reiter „Lager-Einstellungen" werden die Lagerkosten je Produkt nicht je Woche, sondern **je Monat** gepflegt (Einheit **€/m³/Monat netto** statt €/m³/Woche).
- **Retouren — Allgemein: manuelle Retourenquote statt Berechnungsart:** In der „Allgemein"-Tabelle entfällt die Spalte **Berechnungsart Retourenquote** (die kurzfristigen Werte `keine`, `mittelwert_7/14/30/60/90`). Stattdessen pflegt der Nutzer **je Produkt manuell eine Retourenquote in %**. (Langfristig liegen keine Tages-Verkaufsdaten für gleitende Mittelwerte vor.)
- **Retouren — Plattform-Reiter aus der Version:** Die plattformspezifischen Retouren-Reiter werden aus den **Sales Plattformen dieser Planversion** (KPI-Modell, `art = 'lp_sales_plattform'`) gebildet.

Alle übrigen Felder und Funktionen werden **1:1 aus der kurzfristigen Seite übernommen** (siehe „Reiter im Detail"), nur die Datenquelle ist versionsgebunden und die oben genannten Abweichungen gelten.

## User Stories

- Als Controller möchte ich die Seite „Vertriebseinstellungen" innerhalb einer geöffneten Planversion über das linke Seitenmenü und über die Versions-Übersichtsseite aufrufen können, damit ich die Vertriebs-/Ausgabenparameter dieser Version pflegen kann.
- Als Controller möchte ich in allen vier Reitern die Produkte sehen, die im KPI-Modell **dieser Planversion** hinterlegt sind, damit ich nur die für dieses Szenario relevanten Produkte pflege.
- Als Controller möchte ich je Reiter die Gruppierung nur zwischen **Monatlich** und **Quartalsweise** wählen, ohne Wöchentlich, damit die langfristige Planung in Monaten/Quartalen denkt.
- Als Controller möchte ich, dass der Zahlungszeitpunkt automatisch aus der Gruppierung folgt (Anfang Folgemonat bzw. Anfang Folgemonat des Quartals), ohne eine „nächste Zahlungswoche" pflegen zu müssen.
- Als Controller möchte ich je Reiter weiterhin ein **Zahlungsziel in Tagen** pflegen, damit ich den Zahlungstermin zusätzlich nach hinten verschieben kann.
- Als Controller möchte ich im Reiter „Lager-Einstellungen" die Lagerkosten je Produkt **monatlich** (€/m³/Monat) pflegen, passend zur langfristigen Denkweise.
- Als Controller möchte ich in den Retoureneinstellungen die plattformspezifischen Reiter aus den **Sales Plattformen dieser Planversion** sehen, damit ich Retouren je Plattform pflegen kann.
- Als Controller möchte ich in der Retouren-„Allgemein"-Tabelle je Produkt **manuell eine Retourenquote in %** pflegen, statt eine Berechnungsart auszuwählen.
- Als Controller möchte ich, dass alle Eingaben **pro Planversion** gespeichert werden und beim nächsten Aufruf dieser Version vorhanden sind, ohne andere Versionen oder die Kurzfristige Planung zu beeinflussen.
- Als Controller möchte ich beim Speichern eine klare Rückmeldung erhalten, wenn etwas fehlschlägt, damit ich den Fehler erkenne und der vorherige Wert erhalten bleibt.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Innerhalb einer geöffneten Planversion enthält das linke Seitenmenü (Gruppe „Einstellungen") den Eintrag „Vertriebseinstellungen" → `/dashboard/langfristige-planung/[versionId]/vertriebseinstellungen`
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint eine Kachel/ein Eintrag „Vertriebseinstellungen", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Wird die Seite mit unbekannter/fremder/ungültiger `versionId` aufgerufen, erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73-Versionskontext
- [ ] Die Seite ist in das bestehende Versions-Gerüst (`LangfristigeVersionShell`: Header, Breadcrumb, Seitenmenü, Toaster) eingebettet
- [ ] Die Seite zeigt oben vier Reiter in dieser Reihenfolge: „Versand-Einstellungen", „Lager-Einstellungen", „Retoureneinstellungen", „Ersatzteile/Kulanz-Einstellungen" (erster Reiter aktiv beim Laden)

### Datenquelle (KPI-Modell der Version)

- [ ] Alle Produkt-Tabellenzeilen stammen aus `langfristige_kpi_kategorien` mit `art = 'lp_produkt'` der aktuellen `versionId` (sortiert nach `sort_order`)
- [ ] Alle Plattform-Bezüge (Retouren-Plattform-Reiter und plattformbezogene Einstellungen) stammen aus `langfristige_kpi_kategorien` mit `art = 'lp_sales_plattform'` der aktuellen `versionId` (sortiert nach `sort_order`)
- [ ] Gibt es **keine Produkte** in der Version, zeigt der jeweilige Reiter einen Hinweis: „Keine Produkte definiert. Bitte zuerst in der KPI-Modell Verwaltung Produkte anlegen." mit Link zur KPI-Modell-Verwaltung **dieser Version**
- [ ] Gibt es **keine Sales Plattformen** in der Version, zeigt der Retouren-Reiter (plattformspezifischer Teil) einen entsprechenden Hinweis mit Link zur KPI-Modell-Verwaltung dieser Version

### Gemeinsame Regeln für alle Reiter (Gruppierung & Zahlung)

- [ ] Die Gruppierung bietet **nur** die Optionen „Monatlich" und „Quartalsweise" an — **kein** „Wöchentlich"
- [ ] Standard-Gruppierung bei noch nicht gespeichertem Eintrag: „Monatlich"
- [ ] Es gibt **keine** Eingabe „Nächste Zahlungswoche" / Basis-KW / Basis-Jahr mehr
- [ ] Je Reiter/Plattform bleibt das Feld **Zahlungsziel (Tage)** erhalten (ganze Zahl ≥ 0; leer = kein zusätzliches Ziel)
- [ ] Der abgeleitete Zahlungszeitpunkt ist deterministisch: bei „Monatlich" = Anfang des Folgemonats; bei „Quartalsweise" = Anfang des Folgemonats des Quartals (Q1→April, Q2→Juli, Q3→Oktober, Q4→Januar Folgejahr). Das Zahlungsziel (Tage) verschiebt diesen Termin zusätzlich nach hinten. (Die tatsächliche Verwendung des Termins erfolgt in Folge-Features; hier werden nur die Einstellungen gepflegt.)
- [ ] Auto-Save bei Änderung von Gruppierung und Zahlungsziel (kein separater „Speichern"-Button); optimistisches Update mit Rollback bei Fehler

### Reiter 1: Versand-Einstellungen

- [ ] Produkt-Tabelle (Produkte der Version) mit den Spalten der kurzfristigen Seite: **Versandgebühr Spediteur (€ netto)** und **Versandgebühr 3PL (€ netto)** je Produkt
- [ ] Gruppierung (Monatlich/Quartalsweise) und Zahlungsziel (Tage) wie unter „Gemeinsame Regeln"
- [ ] Auto-Save je Zelle (optimistisch, Rollback bei Fehler)

### Reiter 2: Lager-Einstellungen

- [ ] Produkt-Tabelle (Produkte der Version) mit der Spalte **Lagerkosten** je Produkt in der Einheit **€/m³/Monat netto** (monatlich, nicht wöchentlich)
- [ ] Funktion **„Alle Produkte gleichsetzen"** (Bulk-Eingabe eines Wertes für alle Produkte der Version) bleibt erhalten
- [ ] Gruppierung (Monatlich/Quartalsweise) und Zahlungsziel (Tage) wie unter „Gemeinsame Regeln"
- [ ] Auto-Save je Zelle bzw. Bulk-Speichern (optimistisch, Rollback bei Fehler)

### Reiter 3: Retoureneinstellungen

- [ ] Der Reiter ist zweigeteilt: ein Unter-Reiter **„Allgemein"** plus **je Sales Plattform der Version** ein eigener Unter-Reiter
- [ ] **Allgemein — Kopf:** Gruppierung (Monatlich/Quartalsweise) und Zahlungsziel (Tage) wie unter „Gemeinsame Regeln"
- [ ] **Allgemein — Produkt-Tabelle:** je Produkt der Version
  - [ ] Spalte **Retourenquote (%)** — **manuelle** Eingabe durch den Nutzer (ersetzt die kurzfristige Spalte „Berechnungsart Retourenquote"); die kurzfristigen Berechnungsarten (`keine`, `mittelwert_7/14/30/60/90`) entfallen vollständig
  - [ ] Spalte **Retourenhandling-Kosten (€ netto)** je Produkt (wie kurzfristig)
- [ ] **Plattform-Reiter (je Sales Plattform):** je Produkt der Version
  - [ ] Spalte **Erstattung Verkaufsgebühr (%)** (wie kurzfristig)
  - [ ] Spalte **Rückversandkosten (€ netto)** (wie kurzfristig)
- [ ] Auto-Save je Zelle (optimistisch, Rollback bei Fehler)
- [ ] Wertebereich Retourenquote/Erstattung: 0–100 (%); negative Werte werden abgewiesen/auf 0 geklemmt

### Reiter 4: Ersatzteile/Kulanz-Einstellungen

- [ ] Produkt-Tabelle (Produkte der Version) mit den Spalten der kurzfristigen Seite: **Quote (%)**, **Produktkosten pro Stück (€ netto)**, **Versandkosten pro Stück (€ netto)** je Produkt
- [ ] Gruppierung (Monatlich/Quartalsweise) und Zahlungsziel (Tage) wie unter „Gemeinsame Regeln"
- [ ] Auto-Save je Zelle (optimistisch, Rollback bei Fehler)

### Datenpersistenz & Isolation

- [ ] Alle Einstellungen werden **pro Planversion** und zusätzlich an den Nutzer (`user_id`) gebunden gespeichert; geladen/gespeichert wird ausschließlich für die aktuelle `versionId`
- [ ] Produktbezogene Werte werden je `(plan_version_id, [sales_plattform_id,] produkt_id, user_id)` gespeichert; Gruppierungs-/Zahlungs-Einstellungen je Reiter (bzw. je Plattform, wo plattformbezogen) je `(plan_version_id, [sales_plattform_id,] user_id)`
- [ ] Beim ersten Aufruf ohne vorherige Speicherung zeigen die Tabellen Standard-/Leerwerte — kein DB-Insert, bis der Nutzer etwas ändert
- [ ] Optimistisches Update: Änderung erscheint sofort, wird im Hintergrund gespeichert; bei API-Fehler → Toast „Einstellung konnte nicht gespeichert werden." + Rollback auf den vorherigen Wert
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B, andere Versionen oder die Kurzfristige Planung
- [ ] Wird die Planversion (PROJ-73) gelöscht, werden alle zugehörigen Vertriebseinstellungen kaskadierend mitgelöscht — keine verwaisten Datensätze
- [ ] Wird ein Produkt oder eine Sales Plattform im KPI-Modell der Version gelöscht, werden die zugehörigen Einstellungsdaten kaskadierend mitgelöscht; die entsprechende Zeile/der Reiter verschwindet beim nächsten Aufruf

### Datenbankschema (Richtwert — Feinschliff in /architecture)

Gespiegelt aus den kurzfristigen Tabellen, jeweils mit `langfristige_`-Präfix, `plan_version_id` (FK → `langfristige_planversionen`, ON DELETE CASCADE), `user_id` (FK → `auth.users`, ON DELETE CASCADE), Bezügen auf `langfristige_kpi_kategorien` (ON DELETE CASCADE, mit serverseitiger Art-Prüfung), `created_at`/`updated_at`, RLS (`auth.uid() = user_id`) und passenden UNIQUE-Constraints. Abweichungen gegenüber kurzfristig: **keine** `naechste_zahlung_basis_kw/_jahr`-Felder; `gruppierung` CHECK nur `('monatlich','quartalsweise')`; Lager-Einheit monatlich; Retouren-Allgemein speichert manuelle Quote statt Berechnungsart.

- [ ] `langfristige_versand_einstellungen` — `(plan_version_id, sales_plattform_id, produkt_id, user_id)`: `versandgebuehr_spediteur_euro_netto`, `versandgebuehr_3pl_euro_netto`
- [ ] `langfristige_versand_plattform_einstellungen` — `(plan_version_id, sales_plattform_id, user_id)`: `gruppierung`, `zahlungsziel_tage`
- [ ] `langfristige_lager_einstellungen` — `(plan_version_id, sales_plattform_id, produkt_id, user_id)`: `lagerkosten_euro_m3_monat`
- [ ] `langfristige_lager_plattform_einstellungen` — `(plan_version_id, sales_plattform_id, user_id)`: `gruppierung`, `zahlungsziel_tage`
- [ ] `langfristige_retouren_einstellungen` — `(plan_version_id, sales_plattform_id, produkt_id, user_id)`: `erstattung_verkaufsgebuehr_prozent`, `rueckversandkosten_euro_netto`
- [ ] `langfristige_retouren_allgemein_einstellungen` — `(plan_version_id, user_id)`: `gruppierung`, `zahlungsziel_tage`
- [ ] `langfristige_retouren_allgemein_produkt_einstellungen` — `(plan_version_id, produkt_id, user_id)`: `retourenquote_prozent` (manuell, 0–100), `retourenhandling_kosten_euro_netto`
- [ ] `langfristige_ersatzteile_kulanz_einstellungen` — `(plan_version_id, sales_plattform_id, produkt_id, user_id)`: `quote_prozent`, `produktkosten_pro_stueck_euro_netto`, `versandkosten_pro_stueck_euro_netto`
- [ ] `langfristige_ersatzteile_kulanz_plattform_einstellungen` — `(plan_version_id, sales_plattform_id, user_id)`: `gruppierung`, `zahlungsziel_tage`

> Hinweis: Ob plattformbezogene produktweise Einstellungen (Versand/Lager/Ersatzteile) tatsächlich je Plattform oder zentral je Version gehalten werden, richtet sich nach dem kurzfristigen Vorbild und wird in `/architecture` final festgelegt. Fachlich zählt: Produkte/Plattformen kommen aus der Version, Daten sind versions- & nutzerisoliert, kaskadierend löschbar.

### API-Routen (versions- & nutzergebunden)

- [ ] Versionsbewusste GET/PUT-Endpunkte unter `/api/langfristige-planung/[versionId]/…` für jeden Reiter (Produktwerte + Gruppierung/Zahlungsziel), gespiegelt aus den kurzfristigen Routen (`versandausgaben-einstellungen`, `lagerausgaben-einstellungen` inkl. `batch`, `retouren-einstellungen`, `retouren-allgemein-einstellungen`, `retouren-allgemein-produkt-einstellungen`, `ersatzteile-kulanz-einstellungen` und zugehörige `*-plattform-einstellungen`)
- [ ] Jede Route: `requireAuth()` (401), UUID-Format-Prüfung (400), Filterung zusätzlich nach `user_id` + `plan_version_id` (Defense-in-Depth zur RLS), Validierungsfehler → 400, fremde/unbekannte Version → 404
- [ ] Serverseitige Prüfung: referenzierte `produkt_id`/`sales_plattform_id` gehören zur selben Version und haben die korrekte `art` (`lp_produkt` bzw. `lp_sales_plattform`)
- [ ] Zod-Validierung: `gruppierung ∈ {monatlich, quartalsweise}`; `zahlungsziel_tage` ganze Zahl ≥ 0 oder null; Prozentfelder 0–100; Geldfelder ≥ 0 oder null
- [ ] Bulk-Endpunkt für Lager („Alle Produkte gleichsetzen") analog zum kurzfristigen `lagerausgaben-einstellungen/batch`, versions- & nutzergebunden

## Edge Cases

- **Keine Produkte in der Version:** Jeder produktbasierte Reiter zeigt einen Hinweis mit Link zur KPI-Modell-Verwaltung dieser Version; keine Tabellenzeilen.
- **Keine Sales Plattformen in der Version:** Der plattformspezifische Teil der Retoureneinstellungen zeigt einen Hinweis mit Link zur KPI-Modell-Verwaltung; der „Allgemein"-Teil bleibt nutzbar.
- **Produkt/Plattform im KPI-Modell der Version gelöscht:** Zugehörige Einstellungsdaten werden per `ON DELETE CASCADE` entfernt; Zeile/Reiter verschwindet beim nächsten Aufruf.
- **Neues Produkt/neue Plattform hinzugefügt:** Erscheint beim nächsten Aufruf mit Standard-/Leerwerten (noch kein DB-Eintrag).
- **Gruppierungswechsel monatlich ↔ quartalsweise:** Nur die Gruppierung wird gespeichert; produktbezogene Werte bleiben unverändert. Der abgeleitete Zahlungszeitpunkt ändert sich entsprechend (Anfang Folgemonat ↔ Anfang Folgemonat des Quartals).
- **Versuch, „Wöchentlich" zu setzen:** nicht möglich (Option existiert nicht); serverseitiger CHECK lehnt unzulässige Werte zusätzlich ab.
- **Retourenquote/Erstattung außerhalb 0–100:** wird abgewiesen/auf den gültigen Bereich geklemmt; serverseitiger CHECK als zweite Ebene.
- **Negatives Zahlungsziel:** abgewiesen/auf 0 geklemmt.
- **Leere Geldfelder:** zulässig (entspricht „nicht gepflegt"/0); werden als null gespeichert.
- **Lager-Bulk „Alle Produkte gleichsetzen" bei vielen Produkten:** setzt denselben €/m³/Monat-Wert für alle Produkte der Version; optimistisch, Rollback bei Fehler.
- **Auswahl/Referenz eines Produkts/einer Plattform einer fremden Version:** serverseitig abgelehnt (gehört nicht zur Version/Art) → 400/404, kein Fremdbezug.
- **API-Fehler beim Auto-Save:** Toast-Fehlermeldung, optimistisches Update wird zurückgerollt.
- **Aufruf mit fremder/unbekannter versionId:** Redirect zum Langfristige-Planung-Dashboard, kein Datenzugriff.
- **Parallele Bearbeitung in mehreren Tabs/Versionen:** funktioniert unabhängig, da der Kontext aus der URL (`versionId`) stammt.

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen.
- RLS auf allen neuen `langfristige_*`-Tabellen; Versionszugehörigkeit (`plan_version_id` gehört dem Nutzer) sowie Art-/Versionszugehörigkeit referenzierter Kategorien serverseitig prüfen (Defense-in-Depth zur RLS).
- Alle Eingaben serverseitig mit Zod validieren (Gruppierung, Zahlungsziel, Prozent-/Geldfelder, Produkt-/Plattform-IDs).
- Neue versionsgebundene Next.js-Seite unter `src/app/dashboard/langfristige-planung/[versionId]/vertriebseinstellungen/page.tsx` (nutzt `LangfristigeVersionShell`; löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab).
- Navigation: Eintrag „Vertriebseinstellungen" in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen") anlegen/aktivieren; verlinkt automatisch auch auf der Versions-Übersichtsseite.
- Maximale Wiederverwendung der kurzfristigen UI-/Hook-Bausteine (Tabs, Tabellen, `Select`, `Input`, Auto-Save, optimistisches Update, Rollback, Toast) als Vorlage; Datenquelle versionsgebunden parametrisiert statt Code-Duplikation, wo sinnvoll. Wöchentlich-Option und „Nächste Zahlungswoche"-Logik werden dabei entfernt.
- shadcn-Komponenten: `Tabs` (Haupt- und Retouren-Unter-Reiter), `Table`, `Select` (Gruppierung), `Input type="number"` (Werte/Zahlungsziel), `Button` (Lager-Bulk), `Toast` (Rückmeldungen).
- Responsive: Mobil (375px) bis Desktop (1440px).
- Kein neues npm-Paket nötig (alle Bausteine bereits im Projekt vorhanden).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee

Diese Seite ist die **versionsgebundene Spiegelung** der kurzfristigen Vertriebseinstellungen-Seite. Sie kombiniert drei bereits fertige Fundamente und baut nur die versionsgebundene Datenhaltung + Endpunkte neu:

1. **Versions-Gerüst** (PROJ-73, `LangfristigeVersionShell`): Laden/Prüfen der Planversion, Header, Breadcrumb, linkes Seitenmenü, Redirect bei fremder Version, Toaster. Der Nav-Eintrag „Vertriebseinstellungen" (Slug `vertriebseinstellungen`, Gruppe „Einstellungen") **existiert bereits** in `src/lib/langfristige-planung-nav.ts` und verlinkt automatisch auch die Versions-Übersichtsseite — die neue Seite löst nur den dynamischen Platzhalter ab.
2. **Stammdaten der Version** (PROJ-74): Produkte (`art = 'lp_produkt'`) und Sales Plattformen (`art = 'lp_sales_plattform'`) über den vorhandenen Hook `useLangfristigeKpiKategorien(versionId, art)`.
3. **Bedienmuster der kurzfristigen Seite**: vier Reiter, Produkt-Tabellen, Auto-Save je Zelle, optimistische Anzeige, Rollback bei Fehler, Toast.

Inhaltlich denkt die Seite — anders als die kurzfristige — in **Monaten/Quartalen** statt Kalenderwochen: keine Wöchentlich-Option, keine „Nächste Zahlungswoche", Lagerkosten monatlich, und in den Retouren eine **manuell gepflegte Retourenquote** statt einer aus Verkaufsdaten berechneten Quote.

### Wichtige Architekturentscheidung: „Zentrale Plattform" wird 1:1 gespiegelt

In der kurzfristigen Seite haben **Versand**, **Lager** und **Ersatzteile/Kulanz** *keine* Plattform-Reiter: Produktwerte und Gruppierung/Zahlungsziel werden gegen **eine einzige „zentrale Plattform"** gespeichert — die erste Sales Plattform nach Sortierreihenfolge. Nur **Retouren** hat Reiter („Allgemein" + je Plattform einen Reiter).

→ Die langfristige Seite **übernimmt dieses Muster unverändert**. Das hält die Spiegelung risikoarm und die Tür offen, falls später echte Plattform-Reiter gewünscht werden (die Tabellen tragen bereits eine Plattform-Zuordnung). Konkret: Versand/Lager/Ersatzteile rendern eine Tabelle für die erste Sales Plattform der Version; Retouren rendert „Allgemein" + einen Reiter je Sales Plattform der Version.

### A) Seiten- & Komponentenstruktur (Baum)

```
/dashboard/langfristige-planung/[versionId]                         (Versions-Übersicht — vorhanden)
+-- Kachel "Vertriebseinstellungen"  → .../[versionId]/vertriebseinstellungen

/dashboard/langfristige-planung/[versionId]/vertriebseinstellungen  (NEUE echte Seite)
+-- LangfristigeVersionShell (bestehend: Header, Breadcrumb, Versionsprüfung, Redirect, Toaster)
    +-- LangfristigeVertriebseinstellungen (NEUE Hauptkomponente)
        +-- 4 Haupt-Reiter (Tabs)
            +-- Reiter "Versand-Einstellungen"
            |   +-- Einstellungszeile: Gruppierung [Monatlich/Quartalsweise] · Zahlungsziel (Tage)
            |   +-- Produkt-Tabelle: je Produkt → Versandgebühr Spediteur (€) · 3PL (€) · Summe (Anzeige)
            +-- Reiter "Lager-Einstellungen"
            |   +-- Einstellungszeile: Gruppierung · Zahlungsziel (Tage) · "Alle Produkte gleichsetzen"-Bulk
            |   +-- Produkt-Tabelle: je Produkt → Lagerkosten (€/m³/Monat netto)
            +-- Reiter "Retoureneinstellungen"
            |   +-- Unter-Reiter "Allgemein"
            |   |   +-- Einstellungszeile: Gruppierung · Zahlungsziel (Tage)
            |   |   +-- Produkt-Tabelle: je Produkt → Retourenquote (%) [manuell] · Retourenhandling-Kosten (€)
            |   +-- Unter-Reiter je Sales Plattform
            |       +-- Produkt-Tabelle: je Produkt → Erstattung Verkaufsgebühr (%) · Rückversandkosten (€)
            +-- Reiter "Ersatzteile/Kulanz-Einstellungen"
                +-- Einstellungszeile: Gruppierung · Zahlungsziel (Tage)
                +-- Produkt-Tabelle: je Produkt → Quote (%) · Produktkosten/Stück (€) · Versandkosten/Stück (€)
        +-- Leerzustände: keine Produkte → Hinweis + Link zur KPI-Modell-Verwaltung DIESER Version;
            keine Sales Plattformen → Hinweis im plattformbezogenen Teil
```

Gegenüber der kurzfristigen Vorlage entfällt in jeder Einstellungszeile der **Kalender-Picker „Nächste Zahlungswoche"**, und das Gruppierungs-Dropdown bietet nur noch **zwei** Optionen.

### B) Datenmodell (Klartext)

Acht neue Tabellen mit `langfristige_`-Präfix — gespiegelt aus den kurzfristigen, aber je Eintrag zusätzlich an **eine Planversion** gebunden. Jeder Eintrag trägt: eindeutige ID, Besitzer (Nutzer), Planversion, Zeitstempel; Zugriffsschutz per Row-Level-Security (Nutzer sieht nur Eigenes), kaskadierende Löschung bei Wegfall von Version/Produkt/Plattform.

**Produktwert-Tabellen** (ein Eintrag je Version + Plattform + Produkt + Nutzer):
- **Versand:** Versandgebühr Spediteur (€ netto, optional) · Versandgebühr 3PL (€ netto, optional)
- **Lager:** Lagerkosten (€/m³/**Monat** netto, optional) — bewusst monatlich statt wöchentlich
- **Retouren je Plattform:** Erstattung Verkaufsgebühr (%, 0–100, optional) · Rückversandkosten (€ netto, optional)
- **Retouren Allgemein je Produkt** (ein Eintrag je Version + Produkt + Nutzer, ohne Plattform): **Retourenquote (%, 0–100, manuell)** · Retourenhandling-Kosten (€ netto, optional)
- **Ersatzteile/Kulanz:** Quote (%, optional) · Produktkosten/Stück (€ netto, optional) · Versandkosten/Stück (€ netto, optional)

**Reiter-Einstellungs-Tabellen** (ein Eintrag je Version + Plattform + Nutzer; Retouren-Allgemein: je Version + Nutzer):
- **Versand / Lager / Ersatzteile / Retouren-Allgemein:** Gruppierung (`monatlich` | `quartalsweise`, Standard `monatlich`) · Zahlungsziel in Tagen (ganze Zahl ≥ 0, optional)

**Bewusst NICHT enthalten** (Abweichung zu kurzfristig): jegliche Wochen-Logik, die Felder „Basis-KW/Basis-Jahr" der nächsten Zahlungswoche, und die berechnete Retouren-Berechnungsart (`mittelwert_…`).

**Ableitung des Zahlungszeitpunkts** (nur Logik, nicht gespeichert; wird erst in Folge-Features verwendet): bei `monatlich` → Anfang des Folgemonats; bei `quartalsweise` → Anfang des Folgemonats des Quartals (Q1→1. April, Q2→1. Juli, Q3→1. Oktober, Q4→1. Januar Folgejahr). Das Zahlungsziel (Tage) verschiebt diesen Termin zusätzlich nach hinten.

### C) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Gerüst prüft Versions-Eigentum; fremd/unbekannt → Redirect zum Dashboard
  → Hauptkomponente lädt Produkte + Sales Plattformen DIESER Version (KPI-Modell)
      keine Produkte → Hinweis + Link zur KPI-Modell-Verwaltung der Version
  → Aktiver Reiter lädt seine Einstellungszeile (Gruppierung/Zahlungsziel) + Produktwerte
      (oder Standard-/Leerwerte, falls noch nichts gespeichert — kein DB-Insert vorab)

Nutzer ändert eine Zelle / Gruppierung / Zahlungsziel / Bulk
  → Wert sofort sichtbar (optimistisch) + Anlegen-oder-Aktualisieren im Hintergrund
      Erfolg → still;  Fehler → Toast + Rücksetzen auf vorherigen Wert
```

### D) Server-Schnittstellen (versions- & nutzerbewusst, Klartext)

Alle Endpunkte liegen unter `/api/langfristige-planung/[versionId]/…` und folgen exakt dem etablierten Langfristig-Muster (Login-Pflicht, ID-Format-Prüfung, Filterung zusätzlich nach Nutzer **und** Version als zweite Sicherheitsebene zur RLS, Prüfung dass referenzierte Produkte/Plattformen zur Version **und** zur korrekten Art gehören, Eingabeprüfung per Zod). Empfohlene Bündelung unter einem `vertrieb/`-Segment (genaue Pfadaufteilung entscheidet `/backend`):

| Bereich | Lesen | Speichern |
|---|---|---|
| Versand-Produktwerte | Werte aller Produkte (Plattform) laden | je Produkt anlegen/aktualisieren |
| Versand-Reitereinstellung | Gruppierung + Zahlungsziel laden | upserten |
| Lager-Produktwerte | Werte aller Produkte laden | je Produkt anlegen/aktualisieren |
| Lager-Bulk | — | gleichen €/m³/Monat-Wert für **alle** Produkte der Version setzen |
| Lager-Reitereinstellung | Gruppierung + Zahlungsziel laden | upserten |
| Retouren je Plattform | Erstattung + Rückversand aller Produkte | je Produkt anlegen/aktualisieren |
| Retouren Allgemein (Produkt) | Retourenquote + Handling aller Produkte | je Produkt anlegen/aktualisieren |
| Retouren Allgemein (Reiter) | Gruppierung + Zahlungsziel laden | upserten |
| Ersatzteile-Produktwerte | Werte aller Produkte laden | je Produkt anlegen/aktualisieren |
| Ersatzteile-Reitereinstellung | Gruppierung + Zahlungsziel laden | upserten |

Eingabeprüfung: Gruppierung ∈ {monatlich, quartalsweise}; Zahlungsziel ganze Zahl ≥ 0 oder leer; Prozentfelder 0–100; Geldfelder ≥ 0 oder leer. Ungültig → Fehler; fremde/unbekannte Version → kein Zugriff.

### E) Wiederverwendung im Detail

| Baustein | Status | Anmerkung |
|----------|--------|-----------|
| Versions-Gerüst (Laden/Prüfen, Header, Seitenmenü, Redirect, Toaster) | **unverändert** | `LangfristigeVersionShell` (PROJ-73) |
| Produkt-/Plattform-Listen der Version | **unverändert** | `useLangfristigeKpiKategorien` (PROJ-74), Arten `lp_produkt` / `lp_sales_plattform` |
| Tabs, Table, Select, Input, Button, Toast | **bestehende shadcn/ui-Bausteine** | analog kurzfristig |
| Nav-Eintrag „Vertriebseinstellungen" | **bereits vorhanden** | in `langfristige-planung-nav.ts`; ggf. nur Beschreibungs-Feinschliff |
| Reiter-Komponenten + Daten-Hooks (laden/speichern, optimistisch, Rücksetzen) | **neue, versionsbewusste Variante** | spiegeln kurzfristige Logik; Wochen-Picker entfernt, Gruppierung auf 2 Optionen, Lager monatlich, Retouren manuelle Quote |
| Datentabellen + Endpunkte | **Neubau** | acht versions-/nutzergebundene Tabellen + GET/PUT-Endpunkte (+ Lager-Bulk) |

### F) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Speicherort | Datenbank, pro Planversion | Daten müssen je Szenario isoliert und dauerhaft sein (PROJ-73-Prinzip) |
| Eigene neue Tabellen | Ja (statt Erweiterung der Kurzfristig-Tabellen) | Klare Abkapselung, kaskadierende Löschung pro Version, kein Regressionsrisiko für die kurzfristige Seite |
| „Zentrale Plattform" für Versand/Lager/Ersatzteile | Beibehalten | Spiegelt die kurzfristige Seite 1:1, risikoarm, zukunftsoffen für echte Plattform-Reiter |
| Gruppierung nur Monatlich/Quartalsweise | Wöchentlich entfällt | Vom Nutzer bestätigt; langfristige Planung denkt in Monaten/Quartalen |
| Keine „Nächste Zahlungswoche" | Zahlungszeitpunkt aus Gruppierung abgeleitet | Vom Nutzer bestätigt; deterministisch (Folgemonat / Folgemonat des Quartals) |
| Zahlungsziel (Tage) bleibt | Beibehalten | Vom Nutzer bestätigt; zusätzlicher Versatz |
| Lagerkosten monatlich | Einheit €/m³/Monat | Vom Nutzer bestätigt |
| Retouren: manuelle Retourenquote | Manuelles %-Feld statt Berechnungsart | Vom Nutzer bestätigt; langfristig keine Tages-Verkaufsdaten für gleitende Mittelwerte |
| Quelle der Stammdaten | KPI-Modell der Version (PROJ-74) | Vollständige Abkapselung vom globalen Modell / Kurzfristiger Planung |
| Bedienmuster | Auto-Save, optimistisch, Toast, Rücksetzen | Einheitlich mit allen Einstellungsseiten im Projekt |

### G) Dependencies (Pakete)

Keine neuen npm-Pakete nötig. Verwendet werden ausschließlich bestehende Bausteine: shadcn/ui (Tabs, Table, Select, Input, Button, Label, Toast), das Versions-Gerüst und die Navigations-Konfiguration (PROJ-73), der versionsgebundene KPI-Kategorien-Hook (PROJ-74), Zod (Eingabeprüfung) und Supabase (Datenhaltung inkl. Row-Level-Security).

### H) Umsetzungsreihenfolge (empfohlen)

1. Acht neue versionsgebundene Tabellen (fünf Produktwert-, drei Reiter-Einstellungs-Tabellen für Versand/Lager/Ersatzteile/Retouren-Allgemein; Retouren-Allgemein-Produkt separat), nutzer- & versionsgesichert, mit RLS und kaskadierender Löschung.
2. Versionsbewusste GET/PUT-Endpunkte je Bereich + Lager-Bulk, mit serverseitiger Prüfung von Versions-/Art-Zugehörigkeit.
3. Versionsbewusste Daten-Hooks (analog kurzfristig; Monate statt Wochen; Gruppierung auf 2 Optionen; Lager monatlich; Retouren manuelle Quote).
4. Neue Seite mit 4 Reitern + Retouren-Unter-Reitern, eingebettet ins Versions-Gerüst (überwiegend Verdrahtung bestehender Bausteine; Wochen-Picker entfällt).
5. Bei Bedarf Feinschliff des Nav-Beschreibungstextes.

> Hinweis: Da UI-Bausteine, Versions-Gerüst und Stammdaten-Hooks bereits existieren, liegt der eigentliche Aufwand in Schritt 1–2 (Datenhaltung/Endpunkte); Schritt 3–5 sind überwiegend Anpassung der kurzfristigen Vorlage.

## Implementation Notes (Frontend — 2026-06-20)

Die UI und Verdrahtung sind gebaut; die Datenhaltung/API folgt mit `/backend`. Bis dahin zeigt jeder Reiter sauber den Lade-Fehlerzustand (kein Absturz). Das Versions-Gerüst und die Stammdaten-Listen (Produkte, Sales Plattformen) laden bereits korrekt über die bestehenden PROJ-73/PROJ-74-APIs.

**Maximale Wiederverwendung:** Die vier kurzfristigen Vertriebs-Komponenten dienten als Vorlage. Versions-Gerüst (`LangfristigeVersionShell`) und der versionsgebundene KPI-Kategorien-Hook (`useLangfristigeKpiKategorien`) wurden **unverändert** wiederverwendet. Das „Zentrale-Plattform"-Muster (erste Sales Plattform der Version) wurde 1:1 übernommen; nur Retouren hat „Allgemein" + je Plattform einen Reiter.

### Neue Dateien — Hooks
- `src/hooks/use-langfristige-vertrieb-gruppierung.ts` — generischer Hook für Gruppierung + Zahlungsziel je Bereich. Nur `monatlich`/`quartalsweise` (kein Wöchentlich), **keine** „Nächste Zahlungswoche". Unterstützt plattformgebunden (Versand/Lager/Ersatzteile) und versionsweit (Retouren-Allgemein) über denselben Hook. Exportiert `GRUPPIERUNGEN`, `GRUPPIERUNG_LABELS`, Typ `LangfristigeGruppierung`.
- `src/hooks/use-langfristige-vertrieb-produkt-einstellungen.ts` — generischer, typsicherer Hook für plattformgebundene, produktweise Werte (Versand, Ersatzteile, Retouren-je-Plattform): Liste laden, `getEinstellung`, optimistischer `upsert` je Produkt mit Rollback.
- `src/hooks/use-langfristige-lager-einstellungen.ts` — eigener Hook (wegen Batch); Feld `lagerkosten_euro_m3_monat` (monatlich) + `batchUpsert` für „Alle Produkte gleichsetzen".
- `src/hooks/use-langfristige-retouren-allgemein-produkt-einstellungen.ts` — versionsweiter Hook für die manuelle `retourenquote_prozent` + `retourenhandling_kosten_euro_netto` je Produkt.

### Neue Dateien — Komponenten
- `src/components/langfristige-gruppierung-form.tsx` — gemeinsame Einstellungszeile (Gruppierung-`Select` + Zahlungsziel-`Input`), ohne Kalender-Picker.
- `src/components/langfristige-versand-einstellungen-tabelle.tsx` — Spediteur/3PL + Summenanzeige.
- `src/components/langfristige-lager-einstellungen-tabelle.tsx` — €/m³/Monat + „Alle Produkte gleichsetzen".
- `src/components/langfristige-retouren-einstellungen-tabelle.tsx` — Unter-Reiter „Allgemein" (manuelle Retourenquote % + Handling) + je Plattform (Erstattung % + Rückversand).
- `src/components/langfristige-ersatzteile-kulanz-einstellungen-tabelle.tsx` — Quote % + Produkt-/Versandkosten pro Stück.
- `src/components/langfristige-vertriebseinstellungen.tsx` — Hauptkomponente: liest `versionId`, lädt Produkte + Plattformen der Version, rendert die 4 Reiter; Leerzustände mit Link zur versionsgebundenen KPI-Modell-Verwaltung.
- `src/app/dashboard/langfristige-planung/[versionId]/vertriebseinstellungen/page.tsx` — echte Seite (Shell + Hauptkomponente). Löst den dynamischen `[seite]`-Platzhalter ab.

### Geänderte Dateien
- Keine. Der Nav-Eintrag „Vertriebseinstellungen" existiert bereits in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen") und verlinkt automatisch; die Versions-Übersichtsseite listet ihn ebenfalls.

### Erwartete API (für `/backend`) — alle unter `/api/langfristige-planung/[versionId]/vertrieb/…`, je `requireAuth` + Versions-/Art-Prüfung
- `versand-einstellungen` (GET `?plattform_id=`, PUT je Produkt) → `versandgebuehr_spediteur_euro_netto`, `versandgebuehr_3pl_euro_netto`
- `versand-plattform-einstellungen` (GET `?plattform_id=`, PUT) → `gruppierung` ∈ {monatlich, quartalsweise}, `zahlungsziel_tage`
- `lager-einstellungen` (GET/PUT) → `lagerkosten_euro_m3_monat`; plus `lager-einstellungen/batch` (PUT `{ sales_plattform_id, lagerkosten_euro_m3_monat }` → setzt alle Produkte, liefert Liste zurück)
- `lager-plattform-einstellungen` (GET/PUT) → Gruppierung + Zahlungsziel
- `retouren-einstellungen` (GET `?plattform_id=`, PUT je Produkt) → `erstattung_verkaufsgebuehr_prozent`, `rueckversandkosten_euro_netto`
- `retouren-allgemein-einstellungen` (GET/PUT, **versionsweit**, kein `plattform_id`) → Gruppierung + Zahlungsziel
- `retouren-allgemein-produkt-einstellungen` (GET/PUT, **versionsweit**, je Produkt) → `retourenquote_prozent` (0–100), `retourenhandling_kosten_euro_netto`
- `ersatzteile-kulanz-einstellungen` (GET `?plattform_id=`, PUT je Produkt) → `quote_prozent`, `produktkosten_pro_stueck_euro_netto`, `versandkosten_pro_stueck_euro_netto`
- `ersatzteile-kulanz-plattform-einstellungen` (GET/PUT) → Gruppierung + Zahlungsziel

GET ohne Eintrag liefert `null` (Gruppierung-Endpunkte → Standardwerte) bzw. `[]` (Produkt-Listen). PUT ist Upsert. Prozentfelder 0–100; Geldfelder ≥ 0 oder null; `zahlungsziel_tage` ganze Zahl ≥ 0 oder null.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen Dateien.
- `npm run lint`: sauber (keine Errors/Warnings).

## Implementation Notes (Backend — 2026-06-20)

Datenhaltung und APIs sind gebaut und an die bestehende Frontend-Verdrahtung angeschlossen (Frontend rief diese Endpunkte bereits auf — keine Frontend-Änderung nötig, der Kontrakt passt 1:1).

### Datenbank (Supabase-Migration `proj78_langfristige_vertriebseinstellungen`)
9 neue Tabellen, je Eintrag an `plan_version_id` (FK → `langfristige_planversionen`, ON DELETE CASCADE) und `user_id` (FK → `auth.users`, ON DELETE CASCADE) gebunden; Plattform-/Produktbezüge → `langfristige_kpi_kategorien` (ON DELETE CASCADE). Alle mit `created_at`/`updated_at`, passenden UNIQUE-Constraints (für Upsert), Lookup-Index `(plan_version_id, [sales_plattform_id,] user_id)` und RLS (je 4 Policies `auth.uid() = user_id`):

- `langfristige_versand_einstellungen` — UNIQUE(plan_version_id, sales_plattform_id, produkt_id, user_id): `versandgebuehr_spediteur_euro_netto`, `versandgebuehr_3pl_euro_netto` (NUMERIC ≥ 0)
- `langfristige_versand_plattform_einstellungen` — UNIQUE(plan_version_id, sales_plattform_id, user_id): `gruppierung` CHECK IN ('monatlich','quartalsweise') DEFAULT 'monatlich', `zahlungsziel_tage` INT ≥ 0
- `langfristige_lager_einstellungen` — `lagerkosten_euro_m3_monat` (NUMERIC ≥ 0)
- `langfristige_lager_plattform_einstellungen` — Gruppierung + Zahlungsziel
- `langfristige_retouren_einstellungen` — `erstattung_verkaufsgebuehr_prozent` (0–100), `rueckversandkosten_euro_netto` (≥ 0)
- `langfristige_retouren_allgemein_einstellungen` — UNIQUE(plan_version_id, user_id): Gruppierung + Zahlungsziel (versionsweit)
- `langfristige_retouren_allgemein_produkt_einstellungen` — UNIQUE(plan_version_id, produkt_id, user_id): `retourenquote_prozent` (0–100, manuell), `retourenhandling_kosten_euro_netto` (≥ 0)
- `langfristige_ersatzteile_kulanz_einstellungen` — `quote_prozent` (0–100), `produktkosten_pro_stueck_euro_netto`, `versandkosten_pro_stueck_euro_netto` (≥ 0)
- `langfristige_ersatzteile_kulanz_plattform_einstellungen` — Gruppierung + Zahlungsziel

Security-Advisor nach der Migration: keine neuen Findings auf den PROJ-78-Tabellen (sie nutzen `auth.uid() = user_id`, kein `USING (true)`).

### API-Routen (alle unter `src/app/api/langfristige-planung/[versionId]/vertrieb/`)
Gemeinsame Bausteine in `_utils.ts` (Fabriken) halten die zehn Routen schlank: `ensureVersion` (Login + Versions-Eigentum, 400/404), `kategorieGehoert` (Produkt/Plattform gehört zur Version & Art), sowie vier Fabriken — plattformgebundene Produktwerte, plattformgebundene Gruppierung (Merge-then-Upsert), versionsweite Gruppierung, versionsweite Produktwerte. Geld-/Prozent-Felder als Zod-Bausteine (`geldFeld` ≥ 0, `prozentFeld` 0–100).

- `versand-einstellungen`, `lager-einstellungen`, `retouren-einstellungen`, `ersatzteile-kulanz-einstellungen` (GET `?plattform_id=` → Array; PUT je Produkt)
- `versand-plattform-einstellungen`, `lager-plattform-einstellungen`, `ersatzteile-kulanz-plattform-einstellungen` (GET `?plattform_id=` → `null`/Objekt; PUT Merge-Upsert)
- `retouren-allgemein-einstellungen` (versionsweit, GET/PUT Gruppierung)
- `retouren-allgemein-produkt-einstellungen` (versionsweit, GET Array / PUT je Produkt, manuelle Quote)
- `lager-einstellungen/batch` (PUT „Alle Produkte gleichsetzen": lädt alle `lp_produkt` der Version, Upsert aller Zeilen)

Jede Route: `requireAuth()` (401), UUID-/Versionsprüfung (400/404), Zod-Validierung (400), serverseitige Art-/Versionsprüfung der referenzierten Kategorien (400 bei fremder Plattform/Produkt), Defense-in-Depth-Filter nach `user_id` + `plan_version_id`.

### Tests
5 neue Vitest-Integrationstests (je eine repräsentative Route pro Handler-Form; die übrigen Routen sind dünne Re-Exports derselben Fabriken): **36 Tests, alle grün**. Abgedeckt: Happy-Path, Validierungsfehler (negativ/> 100/„woechentlich"/leerer Patch), 401 (unauth), 404 (fremde Version), 400 (fremde Plattform/Produkt), Batch (alle Produkte / keine Produkte).

### Verifikation
- Migration erfolgreich angewandt (Supabase, Projekt Controlling-App).
- `npx tsc --noEmit`: keine Fehler in den PROJ-78-Dateien.
- `npm run lint`: sauber.
- `npx vitest run …/vertrieb`: 5 Dateien, 36 Tests grün.

## QA Test Results

**Getestet:** 2026-06-20 · **Methode:** Code-Audit gegen alle Acceptance Criteria, Vitest-Integrationstests (API), empirischer Render-Test (Hook/Form-Timing), Playwright-E2E (Route/Auth/Regression), Red-Team-Sicherheitsaudit, Supabase-Advisor.

### Zusammenfassung
- **Acceptance Criteria:** 42 von 43 bestanden · 1 teilweise (fehlender Hinweis)
- **Bugs:** 0 Critical · 0 High · **1 Medium (behoben)** · **1 Low (offen)**
- **Sicherheit:** keine Findings (RLS + serverseitige Versions-/Art-Prüfung + Defense-in-Depth)
- **Regression:** unkritisch — nur neue Dateien + 1 Migration; kurzfristige Vertriebseinstellungen unverändert erreichbar
- **Automatisierte Tests:** 36 Vitest-API-Tests grün · 8 Playwright-E2E grün (4 × 2 Browser) · 232 Tests der gesamten Langfristig-API-Suite grün

### Acceptance Criteria — Ergebnis

| Bereich | Ergebnis |
|---|---|
| Navigation & Einstieg (Nav-Eintrag, Übersichtskachel, Auth-Guard, Redirect fremde Version, Shell, 4 Reiter) | ✅ Pass |
| Datenquelle aus KPI-Modell der Version (Produkte `lp_produkt`, Plattformen `lp_sales_plattform`, Leerzustand Produkte) | ✅ Pass |
| Gemeinsame Regeln: nur Monatlich/Quartalsweise, kein Wöchentlich, keine „Nächste Zahlungswoche", Standard monatlich, Auto-Save Gruppierung | ✅ Pass |
| Gemeinsame Regeln: **Zahlungsziel (Tage) bleibt erhalten** — Anzeige des gespeicherten Werts beim Laden | ✅ Pass (nach Fix Bug #1) |
| Reiter 1 Versand (Spediteur/3PL + Summe) | ✅ Pass |
| Reiter 2 Lager (€/m³/**Monat**, „Alle Produkte gleichsetzen"-Bulk) | ✅ Pass |
| Reiter 3 Retouren Allgemein (manuelle **Retourenquote %** statt Berechnungsart + Handling) | ✅ Pass |
| Reiter 3 Retouren je Plattform (Erstattung % + Rückversand), Plattform-Reiter aus Version | ✅ Pass |
| Reiter 3: Hinweis bei **keiner Sales Plattform** im plattformspezifischen Teil | ⚠️ Teilweise (Bug #2) |
| Reiter 4 Ersatzteile/Kulanz (Quote %, Produkt-/Versandkosten pro Stück) | ✅ Pass |
| Datenpersistenz & Isolation (pro Version + Nutzer, kein DB-Insert vorab, Optimistik + Rollback, Kaskade) | ✅ Pass |
| Datenbankschema (9 Tabellen, FK-Kaskade, UNIQUE, RLS, Indizes) | ✅ Pass |
| API-Routen (Auth, UUID/Version, Zod, Art-/Versionsprüfung, Bulk) | ✅ Pass |

### Bugs

**Bug #1 — Medium — ✅ BEHOBEN (2026-06-20) — Gespeichertes „Zahlungsziel (Tage)" wurde beim Laden nicht angezeigt**
- **Betroffen:** alle vier Gruppierungs-Formulare (Versand, Lager, Ersatzteile, Retouren-Allgemein) — gemeinsame Komponente `langfristige-gruppierung-form.tsx` + Hook `use-langfristige-vertrieb-gruppierung.ts`.
- **Reproduktion:** Zahlungsziel z.B. auf 14 setzen (wird korrekt gespeichert) → Seite neu laden → das Eingabefeld ist **leer**, obwohl 14 in der DB steht. Die Gruppierung wird dagegen korrekt angezeigt.
- **Ursache:** Der Hook startet mit `useState(false)` für `loading`. Die „einmalige" Initialisierung des lokalen Eingabe-Strings (`initializedRef`) läuft dadurch schon im ersten Render (loading=false) **bevor** der Fetch die Daten liefert, und sperrt sich danach. Der kurzfristige Vorlage-Hook vermeidet das durch `useState(!!plattformId)` (Start = `true`).
- **Empirisch bestätigt:** Render-Test mit gemocktem GET (`zahlungsziel_tage: 14`) ergab Eingabewert `''` statt `'14'`.
- **Auswirkung:** Wert geht **nicht verloren** (DB-Persistenz + erneutes Speichern funktionieren; nach Remount sichtbar) — aber irreführende Anzeige; Nutzer könnte den Wert für ungesetzt halten. Widerspricht dem AC „Zahlungsziel bleibt erhalten".
- **Fix (umgesetzt):** In `use-langfristige-vertrieb-gruppierung.ts` startet `loading` jetzt als `true`, solange ein Fetch ansteht (`wirdLaden = !!versionId && (versionWeit || !!plattformId)`). Dadurch greift die Einmal-Initialisierung im Formular erst nach abgeschlossenem Laden mit den echten Daten. Regression abgesichert durch `src/components/langfristige-gruppierung-form.test.tsx` (3 Tests: versionsweit, plattformgebunden, leer) — grün.

**Bug #2 — Low — Kein Hinweis im Retouren-Plattformteil, wenn die Version keine Sales Plattform hat**
- **Betroffen:** `langfristige-retouren-einstellungen-tabelle.tsx` / `langfristige-vertriebseinstellungen.tsx`.
- **Verhalten:** Ohne Sales Plattform zeigt der Retouren-Reiter nur „Allgemein" (voll funktionsfähig) und **keine** Plattform-Reiter — aber auch keinen Hinweis mit Link zur KPI-Modell-Verwaltung, wie im AC vorgesehen.
- **Auswirkung:** rein hinweisend/kosmetisch; keine Fehlfunktion. (Versand/Lager/Ersatzteile zeigen den Plattform-Hinweis korrekt.)
- **Fix-Hinweis:** im Retouren-Reiter einen Hinweis einblenden, wenn `plattformen.length === 0`.

### Sicherheitsaudit (Red Team) — keine Findings
- **AuthZ/Isolation:** Jede Route `requireAuth()` (401) → `ensureVersion` (Eigentum, 404 bei fremder/unbekannter Version) → `kategorieGehoert` (referenzierte Plattform/Produkt gehört zur Version **und** zur korrekten Art, 400) → zusätzlicher Filter `user_id` + `plan_version_id` (Defense-in-Depth) → RLS `auth.uid() = user_id`. Fremdzugriff über manipulierte `versionId`/`plattform_id`/`produkt_id` wird abgewiesen (per Test belegt).
- **Injection:** Supabase parametrisiert; Tabellennamen/`selectCols` sind hartkodierte Literale (kein User-Input). Kein SQL-/XSS-Vektor über die Eingaben.
- **Datensparsamkeit:** Antworten enthalten nur die eigenen, versionsgebundenen Felder. Keine Secrets exponiert.
- **Limits:** Listen `.limit(1000)`, Bulk auf die Produkte der Version begrenzt.
- **Supabase-Advisor (security) nach Migration:** keine Findings auf den 9 PROJ-78-Tabellen (alle `auth.uid() = user_id`, kein `USING (true)`).

### Regression — bestanden
- Nur neue Dateien + 1 Migration; keine gemeinsam genutzte Datei geändert (Nav-Eintrag existierte bereits).
- Kurzfristige Vertriebseinstellungen weiter erreichbar (E2E), Langfristig-Dashboard-Redirect intakt (E2E).
- Gesamte Langfristig-API-Vitest-Suite: 25 Dateien / 232 Tests grün.

### Automatisierte Tests
- **Vitest (API):** `…/vertrieb/**/route.test.ts` — 5 Dateien, 36 Tests (Happy-Path, Validierung, 401/404/400 AuthZ, Batch mit/ohne Produkte) — grün.
- **Playwright (E2E):** `tests/PROJ-78-langfristige-vertriebseinstellungen.spec.ts` — Route-Existenz, Auth-Guard, Regression (kurzfristig + Dashboard) — 8 grün (4 × 2 Browser).
- Interaktive Flows (4 Reiter, Auto-Save, Lager-Bulk, Retouren-Unter-Reiter, Rollback) erfordern authentifizierte Session + geseedete Planversion und sind als manuell/per Code-Audit geprüft dokumentiert (Muster wie PROJ-76).

### Produktionsreife-Empfehlung
**Bug #1 (Medium) ist behoben und per Regressionstest abgesichert.** Es verbleibt nur **Bug #2 (Low, optional, rein hinweisend)**. Keine Critical/High/Medium-Bugs offen → **produktionsreif (Approved)**. Bug #2 kann separat oder zusammen mit weiteren Langfristig-Reitern nachgezogen werden.

## Deployment
_To be added by /deploy_
</content>
</invoke>
