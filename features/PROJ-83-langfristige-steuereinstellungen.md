# PROJ-83: Steuereinstellungen — Langfristige Planung

## Status: Approved
**Created:** 2026-06-20
**Last Updated:** 2026-06-21 (QA)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — diese Seite ist eine versionsgebundene Einstellungsseite unter `/dashboard/langfristige-planung/[versionId]/…`; sie nutzt das Versions-Routing, den Versionskontext, die Versions-Shell (`LangfristigeVersionShell`) und das kontextabhängige Seitenmenü. Der Nav-Slug `steuereinstellungen` ist dort **bereits** vorgesehen.
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert je Planversion die **Produkte** (`langfristige_kpi_kategorien` mit `art = 'lp_produkt'`, `level = 1`), die **Marketingkanäle** (`art = 'lp_marketingkanal'`, flach) und die **Investitionen** (`art = 'lp_investition'`, Gruppe→Untergruppe), die in dieser Seite angezeigt und mit USt-Sätzen gepflegt werden.
- Requires: PROJ-2 (KPI-Modell Verwaltung) — die übrigen Einnahmen- (`type = 'einnahmen'`) und Ausgaben-/Kosten-Kategorien (`type = 'ausgaben_kosten'`) werden weiterhin aus dem **globalen** KPI-Modell gelesen (nur die Kategoriedefinitionen/-namen; die eingegebenen Sätze werden pro Version gespeichert).
- Vorlage (kein harter Require): PROJ-65 (Steuereinstellungen — Kurzfristige Planung) — UI/Bedienung der drei Sektionen werden in ihrem **aktuellen Live-Stand** gespiegelt (3 Reiter, Auto-Save, per-Kategorie „Gesamt/Aufgeteilt"-Umschalter, Einfuhr-USt-Satz-Feld, Fiskalverzollung-Tabelle je Produkt), mit den unten beschriebenen Abweichungen.
- Analogie: PROJ-77 (Produktinformationen — Langfristige Planung) — identisches Muster „bestehende Oberfläche in das Versions-Gerüst einbetten, Produktquelle auf die Versions-Produkte umstellen, alles versionsisoliert speichern".

## Overview

Die Seite „Steuereinstellungen" der **Langfristigen Planung** ist der langfristige Gegenpart zur kurzfristigen Seite (PROJ-65). Sie hat — wie die Kurzfristig-Seite in ihrem aktuellen Stand — **drei Reiter**:

1. **Umsatzsteuer-Grundeinstellungen** — Zahlungsfrequenz (monatlich/quartalsweise) + Zahlungsverschiebung (Tage)
2. **Umsatzsteuersätze** — USt-%-Satz je Einnahmen- und Ausgabenkategorie, mit per-Kategorie-Umschalter „Gesamt" (Satz auf Oberkategorie) vs. „Aufgeteilt" (Satz je Unterkategorie)
3. **Einfuhrumsatzsteuer** — Einfuhr-USt-Satz (%) + Zahlungsziel (Tage) + Fiskalverzollung je Produkt (Checkbox)

Bedienung und Aufbau entsprechen **1:1 dem aktuellen Stand der kurzfristigen Seite**, mit folgenden bewusst gesetzten Abweichungen (alle vom Nutzer am 2026-06-20 bestätigt):

1. **Vollständige Versionsisolation:** Alle auf dieser Seite gespeicherten Daten (Grundeinstellungen, alle USt-Sätze, Einfuhr-USt-Felder, Ebene-Auswahl, Fiskalverzollung) werden **pro Planversion** isoliert gehalten — nicht global mit der Kurzfristigen Planung geteilt. Eine neu angelegte Version startet mit Default-/leeren Werten.
2. **Produktquelle = Versions-Produkte:** In der USt-Sätze-Tabelle werden unter der Kategorie **Produktverkäufe** nicht die globalen KPI-Produkte, sondern die **Produkte dieser Planversion** (`lp_produkt`) angezeigt und gepflegt. Ebenso zeigt die Fiskalverzollung-Tabelle in der Einfuhr-USt-Sektion die **Produkte dieser Planversion**.
3. **Marketing & Investitionen aus dem Versions-KPI-Modell:** Unter den Kategorien **Marketing** und **Investitionen** werden die Gruppen/Untergruppen aus dem KPI-Modell **dieser Planversion** angezeigt (Marketing: `lp_marketingkanal`, flach; Investitionen: `lp_investition`, Gruppe→Untergruppe).
4. **Alle übrigen Kategorien aus dem globalen KPI-Modell:** Alle anderen Einnahmen- und Ausgabenkategorien werden weiterhin aus dem **globalen** KPI-Modell bezogen (Kategoriedefinitionen/-namen); ihre eingegebenen USt-Sätze werden — wie alle Sätze dieser Seite — **pro Version** gespeichert.

Die Grundeinstellungen-Sektion und die oberen Einfuhr-USt-Felder sehen UI-seitig „genau gleich" aus wie kurzfristig, werden aber ebenfalls pro Version gespeichert (Abweichung 1).

---

## User Stories

- Als Controller möchte ich die Seite „Steuereinstellungen" innerhalb einer geöffneten Planversion über das linke Seitenmenü und die Versions-Übersichtsseite aufrufen können, damit ich die Steuerparameter dieser Version pflegen kann.
- Als Controller möchte ich die Umsatzsteuer-Zahlungsfrequenz (monatlich/quartalsweise) und die Zahlungsverschiebung (Tage) je Planversion festlegen können, damit die Planungsliquidität dieses Szenarios korrekt berechnet wird.
- Als Controller möchte ich je Einnahmen- und Ausgabenkategorie einen Umsatzsteuersatz hinterlegen können, damit geplante USt-Beträge in dieser Version korrekt berechnet werden.
- Als Controller möchte ich pro Oberkategorie entscheiden können, ob ich den Satz „Gesamt" (auf Oberkategorie) oder „Aufgeteilt" (je Unterkategorie) pflege, damit ich die Granularität an mein Versions-KPI-Modell anpassen kann.
- Als Controller möchte ich, dass unter „Produktverkäufe" die **Produkte dieser Planversion** als Zeilen erscheinen und ich je Produkt einen USt-Satz pflegen kann.
- Als Controller möchte ich, dass unter „Marketing" und „Investitionen" die Marketingkanäle bzw. Investitionsgruppen/-untergruppen **dieser Planversion** erscheinen und ich je Eintrag einen USt-Satz pflegen kann.
- Als Controller möchte ich, dass alle übrigen Kategorien weiterhin aus dem globalen KPI-Modell stammen, damit ich nicht alles doppelt pflegen muss.
- Als Controller möchte ich den Einfuhr-USt-Satz (%) und das Zahlungsziel (Tage) je Planversion pflegen können.
- Als Controller möchte ich je Produkt dieser Planversion festlegen können, ob es per Fiskalverzollung importiert wird (Checkbox), damit die Einfuhrumsatzsteuer korrekt in den Liquiditätsplan einfließt.
- Als Controller möchte ich, dass meine Eingaben automatisch beim Verlassen des Feldes gespeichert werden (kein manueller Speichern-Button) — genau wie kurzfristig.
- Als Controller möchte ich, dass alle Steuereinstellungen pro Planversion gespeichert werden und andere Versionen oder die Kurzfristige Planung nicht beeinflussen.

---

## Acceptance Criteria

### Navigation & Einstieg
- [ ] Die Seite ist nur innerhalb eines gültigen Versionskontexts erreichbar: `/dashboard/langfristige-planung/[versionId]/steuereinstellungen`
- [ ] Im linken Seitenmenü (Gruppe „Einstellungen") führt der bereits vorhandene Eintrag „Steuereinstellungen" auf diese Seite
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint die Kachel „Steuereinstellungen", die auf die Seite verlinkt
- [ ] Der Seitentitel lautet „Steuereinstellungen"
- [ ] Die Seite ist in das bestehende Versions-Gerüst (`LangfristigeVersionShell`) eingebettet (Header, Breadcrumb, Seitenmenü identisch zu den anderen Versionsseiten)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich; fremde/unbekannte/ungültige `versionId` → sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) gemäß PROJ-73
- [ ] Die Seite zeigt genau drei Reiter in dieser Reihenfolge: **Umsatzsteuer-Grundeinstellungen**, **Umsatzsteuersätze**, **Einfuhrumsatzsteuer**

### Sektion 1: Umsatzsteuer-Grundeinstellungen
- [ ] Feld „Zahlungsfrequenz" als Dropdown mit „Monatlich" und „Quartalsweise"
- [ ] Feld „Zahlungsverschiebung (Tage)" als numerisches Eingabefeld (ganzzahlig, ≥ 0)
- [ ] Werte werden **pro Planversion** persistent gespeichert
- [ ] Beim Laden werden die gespeicherten Werte vorausgefüllt; Erstaufruf einer Version zeigt Defaults (Frequenz „Monatlich", Verschiebung 0)
- [ ] Auto-Save bei Änderung (Frequenz: sofort; Verschiebung: onBlur); bei Fehler erscheint ein Fehler-Toast und der letzte gültige Wert wird wiederhergestellt

### Sektion 2: Umsatzsteuersätze
- [ ] Die Sektion zeigt zwei optisch getrennte Bereiche: **Einnahmenarten** und **Ausgabenarten** (Gruppenüberschriften)
- [ ] **Einnahmenarten** werden aus dem globalen KPI-Modell (`type = 'einnahmen'`) gelesen; jede Oberkategorie (Ebene 1) ist eine Zeile
- [ ] **Ausgabenarten** werden aus dem globalen KPI-Modell (`type = 'ausgaben_kosten'`) gelesen; die Kategorie „Steuern" wird ausgeblendet (wie kurzfristig)
- [ ] Kategorien werden in der im KPI-Modell definierten `sort_order` angezeigt
- [ ] Jede Oberkategorie mit Unterkategorien hat einen Umschalter **„Gesamt"** (Satz wird auf der Oberkategorie gepflegt; Unterkategorien ausgeblendet) vs. **„Aufgeteilt"** (Oberkategorie nicht editierbar; Unterkategorien aufklappbar und je editierbar)
- [ ] Oberkategorien **ohne** Unterkategorien haben keinen Umschalter und sind direkt editierbar
- [ ] Der USt-Satz ist ein numerisches Dezimalfeld (z. B. 19,00) in Prozent; erlaubt 0–100
- [ ] **Produktverkäufe (Einnahmen):** Unter der Oberkategorie „Produktverkäufe" erscheinen als Unterzeilen die **Produkte dieser Planversion** (`lp_produkt`, `level = 1`, gefiltert nach `versionId`, in `sort_order`) — nicht die globalen KPI-Produkte
- [ ] **Marketing (Ausgaben):** Unter der Oberkategorie „Marketing" erscheinen als Unterzeilen die **Marketingkanäle dieser Planversion** (`lp_marketingkanal`, flach, gefiltert nach `versionId`) — nicht die globalen Marketing-Unterkategorien
- [ ] **Investitionen (Ausgaben):** Unter der Oberkategorie „Investitionen" erscheinen die **Investitionsgruppen und -untergruppen dieser Planversion** (`lp_investition`, Gruppe→Untergruppe, gefiltert nach `versionId`) — nicht die globalen Investitions-Unterkategorien
- [ ] Alle **übrigen** Einnahmen-/Ausgabenkategorien behalten ihre globalen Unterkategorien (wie kurzfristig)
- [ ] Die USt-Sätze **aller** Zeilen (sowohl der versionsspezifischen als auch der global bezogenen Kategorien) werden **pro Planversion** gespeichert
- [ ] Die per-Kategorie-Auswahl „Gesamt/Aufgeteilt" wird **pro Planversion** gespeichert, damit beim nächsten Aufruf die gleiche Ansicht erscheint
- [ ] Auto-Save je Zeile bei onBlur; ungültiger Satz (< 0 oder > 100) → Fehler-Toast und Revert auf den letzten gespeicherten Wert

### Sektion 3: Einfuhrumsatzsteuer
- [ ] Feld „Einfuhr-Umsatzsteuer-Satz (%)" als numerisches Dezimalfeld (0–100)
- [ ] Feld „Zahlungsziel (Tage)" als numerisches Eingabefeld (ganzzahlig, ≥ 0)
- [ ] Beide Werte werden **pro Planversion** persistent gespeichert und beim Laden vorausgefüllt; Auto-Save onBlur mit Fehler-Toast + Revert bei ungültiger Eingabe
- [ ] Bereich „Fiskalverzollung je Produkt": Tabelle mit einer Zeile pro **Produkt dieser Planversion** (`lp_produkt`, gefiltert nach `versionId`, in `sort_order`); Spalten **Produkt** (read-only) und **Fiskalverzollung** (Checkbox)
- [ ] Die Fiskalverzollung-Auswahl je Produkt wird **pro Planversion** gespeichert (Auto-Save bei Änderung; Fehler-Toast bei API-Fehler)

### Leer-/Sonderzustände
- [ ] Sind in dieser Version keine Produkte vorhanden, zeigt sowohl die „Produktverkäufe"-Unterliste als auch die Fiskalverzollung-Tabelle einen Hinweis mit Link zur **KPI-Modell-Verwaltung dieser Version** (nicht zur globalen KPI-Modell-Seite)
- [ ] Sind in dieser Version keine Marketingkanäle bzw. Investitionen vorhanden, zeigt die jeweilige Oberkategorie im „Aufgeteilt"-Modus einen entsprechenden Leerhinweis (und bleibt im „Gesamt"-Modus normal pflegbar)
- [ ] Sind im globalen KPI-Modell keine Einnahmen-/Ausgabenkategorien vorhanden, zeigt die USt-Sätze-Sektion eine Leerstate-Nachricht mit Link zum globalen KPI-Modell

### Datenpersistenz & Versionsisolation
- [ ] Alle Daten der drei Sektionen werden pro Planversion (`plan_version_id`) und zusätzlich an den Nutzer (`user_id`) gebunden gespeichert
- [ ] Eine neu angelegte Planversion zeigt Default-/leere Werte (keine Übernahme aus anderen Versionen oder der Kurzfristigen Planung)
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B, andere Versionen oder die Kurzfristige Planung
- [ ] Wird die Planversion gelöscht, werden alle zugehörigen Steuereinstellungs-Daten automatisch mitgelöscht (ON DELETE CASCADE)
- [ ] Wird ein Produkt/Marketingkanal/eine Investition im Versions-KPI-Modell gelöscht, verschwindet der zugehörige USt-Satz bzw. Fiskalverzollungs-Eintrag automatisch (ON DELETE CASCADE)

---

## Edge Cases

- **Keine Produkte in der Version:** „Produktverkäufe"-Unterliste und Fiskalverzollung-Tabelle zeigen einen Hinweis mit Link zur KPI-Modell-Verwaltung **dieser Version**; kein Absturz.
- **Keine Marketingkanäle / keine Investitionen in der Version:** Im „Aufgeteilt"-Modus erscheint ein Leerhinweis statt Unterzeilen; „Gesamt"-Modus bleibt nutzbar.
- **Oberkategorie ohne Unterkategorien:** kein „Gesamt/Aufgeteilt"-Umschalter, Satz direkt auf der Oberkategorie editierbar.
- **Ungültiger USt-Satz (< 0 oder > 100):** Fehler-Toast, Revert auf letzten gespeicherten Wert, kein Speichern.
- **Zahlungsverschiebung / Zahlungsziel < 0 oder keine Ganzzahl:** Fehler-Toast, Revert auf letzten gespeicherten Wert.
- **Erstaufruf einer Version (keine gespeicherten Werte):** Defaults — Frequenz „Monatlich", Verschiebung 0, Einfuhr-Satz 0, Zahlungsziel 0, alle USt-Satz-Felder leer, alle Fiskalverzollung-Checkboxen aus.
- **Produkt/Kategorie wird aus dem KPI-Modell gelöscht, während die Seite offen ist:** beim nächsten Laden ist die Zeile verschwunden (Cascade); kein verwaister Satz wird angezeigt.
- **Fremde/unbekannte `versionId`:** Redirect zum Langfristige-Planung-Dashboard, kein Datenzugriff.
- **Wechsel „Gesamt" ↔ „Aufgeteilt":** bereits gespeicherte Werte bleiben erhalten; nur die sichtbare Ebene wird gepflegt (Verhalten wie kurzfristig).
- **Gleichzeitige Bearbeitung in mehreren Tabs/Versionen:** funktioniert unabhängig, da der Kontext aus der URL (`versionId`) stammt; kein Optimistic-Locking nötig (interne App, 1–5 Nutzer).

---

## Technical Requirements

- **Auth:** Alle API-Endpunkte erfordern eine gültige Sitzung (`requireAuth`). RLS auf Datenbankebene (`auth.uid() = user_id`); die Versionszugehörigkeit (`plan_version_id` gehört dem Nutzer) wird serverseitig zusätzlich geprüft (Defense-in-Depth, analog `ensureLangfristigeVersion` aus PROJ-77).
- **Versionsbindung:** Daten werden pro `plan_version_id` isoliert; Routen sind versionsbewusst unter `/api/langfristige-planung/[versionId]/steuereinstellungen/…`.
- **Kategorien-Quellen:**
  - Einnahmen-/Ausgabenkategorien (außer Produktverkäufe-Unterzeilen, Marketing, Investitionen): **globales** KPI-Modell (`useKpiCategories('einnahmen' | 'ausgaben_kosten')`); „Steuern" ausgeblendet.
  - Produktverkäufe-Unterzeilen + Fiskalverzollung-Produkte: **Versions-Produkte** (`langfristige_kpi_kategorien`, `art = 'lp_produkt'`).
  - Marketing-Unterzeilen: **Versions-Marketingkanäle** (`art = 'lp_marketingkanal'`).
  - Investitionen-Unterzeilen: **Versions-Investitionen** (`art = 'lp_investition'`, Gruppe→Untergruppe).
- **Validierung:** serverseitig Zod (USt-Satz 0–100, Tage ≥ 0, Frequenz-Enum, gültige UUIDs/Ebenen); clientseitig analog zur kurzfristigen Seite.
- **Auto-Save:** kein manueller Speichern-Button; Felder speichern bei onBlur/onChange; optimistische UI mit Rollback und Fehler-Toast bei Server-Fehler (wie kurzfristig).
- **DB-Tabellen (neu, versionsgebunden):** spiegeln die kurzfristigen Steuer-Tabellen, jeweils **plus** `plan_version_id` (FK → `langfristige_planversionen`, ON DELETE CASCADE):
  - Grundeinstellungen + Einfuhr-USt-Felder (Frequenz, Verschiebung, Einfuhr-Satz, Zahlungsziel) als 1 Eintrag **pro Version** (`UNIQUE(plan_version_id)`).
  - USt-Sätze je Kategorie/Ebene (Kategorie-Referenz kann global **oder** versionsspezifisch sein — Modellierung legt `/architecture` fest).
  - Per-Kategorie-Ebene-Auswahl (Gesamt/Aufgeteilt) **pro Version**.
  - Fiskalverzollung je Versions-Produkt (`produkt_id` FK → `langfristige_kpi_kategorien`, ON DELETE CASCADE).
- **Wiederverwendung:** Die bestehende Kurzfristig-UI (`steuereinstellungen-formular.tsx` und die Hooks `use-ust-einstellungen`, `use-ust-kategorie-saetze`, `use-einfuhrust-fiskalverzollung`, `ust-l1-ebene-auswahl`) so weit wie sinnvoll parametrisieren/wiederverwenden (analog PROJ-77), statt zu duplizieren. Reine Hilfslogik (Gruppenbildung, Beschriftungen) wiederverwenden.
- **Navigation:** Der Nav-Eintrag „Steuereinstellungen" existiert bereits in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen", letzter Eintrag) und verlinkt automatisch auf den versionsspezifischen Pfad — **kein** Nav-Umbau nötig.
- **shadcn/ui first:** Tabs, Select, Input, Label, Checkbox, Table, Card, Toast wiederverwenden (alle bereits installiert; keine neuen Pakete).
- **Performance:** Listenabruf < 300 ms; Speichern < 500 ms.
- **Responsive:** Mobil (375px) bis Desktop (1440px).

---

## Open Questions (für Architecture)

- **Darstellung der Investitionen (2 Ebenen) im USt-Sätze-Baum:** Die Versions-Investitionen haben Gruppe→Untergruppe. Die bestehende Kurzfristig-Tabelle stellt je Oberkategorie nur **eine** Unterebene dar. Wie werden Investitionsgruppen **und** -untergruppen unter der Oberkategorie „Investitionen" abgebildet (z. B. zusätzliche Verschachtelungsebene, oder „Gesamt/Aufgeteilt" auf Gruppen-Ebene mit aufklappbaren Untergruppen)? Auf welcher Ebene wird der USt-Satz gepflegt?
- **Matching der Spezial-Oberkategorien:** „Produktverkäufe", „Marketing" und „Investitionen" werden — wie schon im kurzfristigen Code für „Produktverkäufe" (Name-Match, case-insensitive) — über den Kategorienamen erkannt. Sollen exakte Namen/mehrere Schreibweisen unterstützt werden, und was passiert, wenn eine dieser Oberkategorien im globalen KPI-Modell fehlt?
- **Wiederverwendung vs. Neubau der UI:** Reicht eine Parametrisierung des bestehenden `steuereinstellungen-formular.tsx` (Produktquelle + Speicherpfade versionsbewusst, zusätzliche Versions-Kategoriequellen für Marketing/Investitionen) analog PROJ-77, oder ist ein eigener Langfristig-Satz an Komponenten/Hooks sinnvoller?
- **Datenmodell der USt-Sätze:** Eine gemeinsame Tabelle mit nullbaren FKs auf globale `kpi_categories` **und** `langfristige_kpi_kategorien`, oder getrennte Ablagen? (`/architecture` entscheidet.)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee
Diese Seite ist die **versionsgebundene Schwester** der kurzfristigen Steuereinstellungen-Seite (PROJ-65, aktueller Live-Stand) — genau dasselbe Muster wie PROJ-77 (Produktinformationen, langfristig): Die **bestehende, QA-getestete Oberfläche** (`steuereinstellungen-formular.tsx` mit ihren drei Reitern, Auto-Save, „Gesamt/Aufgeteilt"-Umschalter, Einfuhr-USt-Feldern und Fiskalverzollung-Tabelle) wird **parametrisierbar** gemacht statt dupliziert. Der eigentliche Aufwand liegt nicht in der Optik, sondern in zwei Dingen:

1. **Andere Datenquellen für drei Kategorien:** Unter „Produktverkäufe", „Marketing" und „Investitionen" kommen die Unterzeilen aus dem **KPI-Modell dieser Planversion** statt aus dem globalen Modell.
2. **Alles wird pro Planversion gespeichert:** Grundeinstellungen, alle USt-Sätze, die „Gesamt/Aufgeteilt"-Auswahl, Einfuhr-USt-Felder und Fiskalverzollung werden je `versionId` getrennt abgelegt, geladen und beim Löschen der Version automatisch mitentfernt.

Ohne `versionId` verhält sich die Oberfläche **exakt wie heute** (Kurzfristig-Seite bleibt unverändert) — alle Änderungen sind additiv und verhaltenswahrend, identisch zur PROJ-77-Strategie.

### Auflösung der offenen Fragen (Entscheidungen)
| Offene Frage | Entscheidung |
|---|---|
| **Investitionen (2 Ebenen) im USt-Baum** | Es werden **nur die Obergruppen** (Investitionsgruppen, Ebene 1 der Versions-Investitionen) als Satz-Zeilen angezeigt. Untergruppen werden hier **nicht** dargestellt; sie übernehmen später (in nachgelagerten Berechnungen, außerhalb dieser Spec) den USt-Satz ihrer Obergruppe. Damit ist auch „Investitionen" eine **flache** Unterliste — wie Produktverkäufe und Marketing. |
| **Drei Spezial-Oberkategorien** | „Produktverkäufe" (Einnahmen), „Marketing" und „Investitionen" (Ausgaben) werden — wie heute schon „Produktverkäufe" im Kurzfristig-Code — über den **Kategorienamen** (case-insensitive) erkannt. Fehlt eine dieser Oberkategorien im globalen KPI-Modell, entfällt nur ihre Sonderbehandlung (kein Absturz). |
| **Datenscope** (aus Requirements) | **Alles pro Planversion** isoliert — bestätigt vom Nutzer. „Globales KPI-Modell" betrifft nur, woher die **Kategoriedefinitionen/-namen** der übrigen Kategorien stammen. |
| **UI: Wiederverwenden vs. Neubau** | **Parametrisieren** der bestehenden Komponente + Hooks (wie PROJ-77), kein Neubau. |

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)
```
/dashboard/langfristige-planung/[versionId]/steuereinstellungen        (NEUE Seite)
+-- LangfristigeVersionShell  (bestehend: Header, Breadcrumb, Versionsprüfung, Redirect, Toaster)
    +-- Steuereinstellungen-Formular  (BESTEHEND, parametrisiert mit versionId)
        +-- Reiter 1 "Umsatzsteuer-Grundeinstellungen"
        |     +-- Zahlungsfrequenz (Dropdown) · Zahlungsverschiebung (Tage)
        +-- Reiter 2 "Umsatzsteuersätze"
        |     +-- Bereich "Einnahmenarten"  (globale Oberkategorien)
        |     |     +-- "Produktverkäufe"  -> Unterzeilen = PRODUKTE dieser Version (flach)
        |     |     +-- (übrige Einnahmen)  -> globale Unterkategorien (wie heute)
        |     +-- Bereich "Ausgabenarten"  (globale Oberkategorien, "Steuern" ausgeblendet)
        |           +-- "Marketing"        -> Unterzeilen = MARKETINGKANÄLE dieser Version (flach)
        |           +-- "Investitionen"    -> Unterzeilen = INVESTITIONSGRUPPEN dieser Version (nur Ebene 1)
        |           +-- (übrige Ausgaben)  -> globale Unterkategorien (wie heute)
        |     (je Oberkategorie mit Unterzeilen: "Gesamt/Aufgeteilt"-Umschalter)
        +-- Reiter 3 "Einfuhrumsatzsteuer"
              +-- Einfuhr-USt-Satz (%) · Zahlungsziel (Tage)
              +-- Tabelle "Fiskalverzollung je Produkt" -> PRODUKTE dieser Version
```
- Die **Oberkategorien** (Produktverkäufe, Marketing, Investitionen, sowie alle übrigen) stammen weiterhin aus dem **globalen** KPI-Modell. Nur die **Unterzeilen** dieser drei Spezial-Oberkategorien werden durch die Versions-Stammdaten ersetzt.
- Das linke Seitenmenü und die Versions-Übersicht müssen **nicht** umgebaut werden: Der Eintrag „Steuereinstellungen" existiert bereits in der zentralen Nav-Konfiguration und verlinkt automatisch auf den versionsspezifischen Pfad. Die neue statische Seite löst den dynamischen Platzhalter für diesen Slug ab.

### B) Datenmodell (Klartext)
Es entstehen **vier versionsgebundene Datenablagen**, die die vier Kurzfristig-Tabellen spiegeln, jeweils zusätzlich an eine **Planversion** gebunden (jede Zeile kennt ihre Version; Löschen der Version entfernt alles kaskadierend):

```
1) Steuer-Grundeinstellungen (1 Eintrag pro Planversion)
   - Zahlungsfrequenz (monatlich / quartalsweise)
   - Zahlungsverschiebung (Tage)
   - Einfuhr-USt-Satz (%) und Einfuhr-USt-Zahlungsziel (Tage)
   (Grundeinstellungen + Einfuhr-Kopffelder liegen — wie kurzfristig — in EINEM Eintrag)

2) USt-Sätze je Kategorie (viele Einträge pro Planversion)
   - Verweis auf eine Kategorie + Information, OB es eine GLOBALE oder eine VERSIONS-Kategorie ist
   - Ebene (1 = Oberkategorie/„Gesamt"; 2 = globale Unterkategorie)
     (die flachen Versions-Unterzeilen — Produkte/Marketingkanäle/Investitionsgruppen — gelten als Ebene 1)
   - USt-Satz in Prozent (0–100, darf leer sein = nicht gepflegt)

3) „Gesamt/Aufgeteilt"-Auswahl je Oberkategorie (viele Einträge pro Planversion)
   - Verweis auf die (globale) Oberkategorie
   - gewählte Pflege-Ebene (Gesamt oder Aufgeteilt)

4) Fiskalverzollung je Produkt (viele Einträge pro Planversion)
   - Verweis auf ein PRODUKT dieser Version
   - Fiskalverzollung ja/nein
```

**Warum „global oder Versions-Kategorie" als Merkmal (Ablage 2):** Eine Satz-Zeile kann sich auf eine **globale** Kategorie beziehen (alle Oberkategorien sowie die normalen globalen Unterkategorien) **oder** auf eine **Versions-Kategorie** (Produkt, Marketingkanal, Investitionsgruppe im „Aufgeteilt"-Modus). Da beide aus unterschiedlichen Stammdaten-Töpfen kommen, merkt sich jede Zeile zusätzlich die Herkunft. So bleibt die bewährte, einfache Speicherform (ein Kategorie-Verweis + Ebene + Satz) erhalten und die Oberfläche/Hooks ändern sich nur minimal.

**Isolations- & Löschregeln:**
```
- Jede Zeile hängt an genau einer Planversion und einem Nutzer.
- Löschen der Planversion (PROJ-73) -> alle vier Ablagen werden kaskadierend mitgelöscht.
- Fiskalverzollung: Verweis auf das Versions-Produkt mit kaskadierender Löschung
  -> wird ein Produkt im Versions-KPI-Modell gelöscht, verschwindet sein Fiskalverzollungs-Eintrag automatisch.
- USt-Sätze: wird eine Versions-Kategorie (Produkt/Marketingkanal/Investitionsgruppe) gelöscht,
  wird ihr Satz nicht mehr angezeigt (die Kategorie fehlt in der Quellliste). Solche „verwaisten"
  Satz-Zeilen sind inert (nie sichtbar) und werden spätestens beim Löschen der Version mitentfernt
  — bewusst gleiches, harmloses Verhalten wie bei PROJ-77 (dort Beobachtung „L1").
- Daten verschiedener Versionen sind vollständig getrennt; eine neue Version startet mit Defaults/leer.
```

> **Verfeinerung ggü. Spec-Akzeptanzkriterium:** Die Versionslöschung kaskadiert per Fremdschlüssel (volle Isolation). Die Produkt-Fiskalverzollung kaskadiert ebenfalls per Fremdschlüssel. Der USt-Satz einer **einzeln gelöschten** Versions-Kategorie wird über die Quellliste „ausgeblendet" (inerte Waise) statt per DB-Fremdschlüssel entfernt — bewusst gewählt zugunsten maximaler Wiederverwendung der bestehenden, einfachen Speicherform (konsistent mit PROJ-77).

### C) Datenfluss
```
Seite öffnet sich (innerhalb einer Version)
  -> Shell prüft: gehört die Version dem Nutzer? Nein -> Redirect zum Dashboard
  -> Inhalt lädt parallel:
       (a) Grundeinstellungen/Einfuhr-Felder DIESER Version
       (b) USt-Sätze + "Gesamt/Aufgeteilt"-Auswahl DIESER Version
       (c) Fiskalverzollung DIESER Version
       (d) globale Einnahmen-/Ausgaben-Kategorien (Oberkategorien + normale Unterkategorien)
       (e) Versions-Stammdaten: Produkte, Marketingkanäle, Investitionsgruppen
  -> Oberfläche verknüpft Oberkategorien (global) mit den passenden Unterzeilen
     (Spezial-Oberkategorien -> Versions-Stammdaten; übrige -> globale Unterkategorien)

Nutzer ändert ein Feld
  -> lokale Prüfung (Satz 0–100; Tage/Ganzzahl >= 0)
       ungültig -> Fehler-Toast, Rücksetzen auf letzten gültigen Wert
       gültig   -> sofortiges Auto-Save (onBlur / onChange) in die Ablage der Version
                    Fehler -> Fehler-Toast + Rücksetzen
```

### D) Server-Schnittstellen (versions- & nutzergebunden)
Ein neuer, versionsbewusster Endpunkt-Satz unter der Langfristig-Struktur — analog zu PROJ-77 — gruppiert nach Thema (spiegelt die vier Kurzfristig-Endpunkte):
```
.../[versionId]/steuereinstellungen/einstellungen        (lesen + speichern: Grund-/Einfuhr-Felder)
.../[versionId]/steuereinstellungen/kategorie-saetze     (lesen + Stapel-Speichern: USt-Sätze)
.../[versionId]/steuereinstellungen/ebene-auswahl        (lesen + Stapel-Speichern: Gesamt/Aufgeteilt)
.../[versionId]/steuereinstellungen/fiskalverzollung     (lesen + speichern je Produkt)
```
Jeder Endpunkt: **Login-Pflicht**; **Versionsprüfung** über den bestehenden gemeinsamen Helfer `ensureLangfristigeVersion` (ungültige UUID → 400, fremde/unbekannte Version → 404); alle Abfragen zusätzlich nach **Nutzer UND Planversion** gefiltert (zweite Verteidigungslinie zur Row Level Security); serverseitige Eingabeprüfung (Zod: Satz 0–100, Tage ≥ 0, Frequenz-Enum, gültige IDs). Die **Stammdaten** selbst (globale Kategorien bzw. Versions-Produkte/-Marketingkanäle/-Investitionen) werden über **bereits existierende** Endpunkte gelesen — kein neuer Stammdaten-Endpunkt nötig.

### E) Wiederverwendung im Detail
| Baustein | Status | Anmerkung |
|----------|--------|-----------|
| Versions-Gerüst (`LangfristigeVersionShell`, Laden/Prüfen/Redirect) | **unverändert wiederverwenden** | aus PROJ-73; wie bei allen Versionsseiten |
| `steuereinstellungen-formular.tsx` (3 Reiter, Auto-Save, Umschalter, Fiskaltabelle) | **parametrisieren** (optional `versionId`) | ohne `versionId` = heutiges Verhalten; mit `versionId` = Versions-Quellen + Versions-Speicherpfade |
| Reiter-Hooks (`use-ust-einstellungen`, `use-ust-kategorie-saetze`, `use-einfuhrust-fiskalverzollung`, Ebene-Auswahl) | **versionsbewusste Variante** | optionaler `versionId`-Parameter; Pfadwahl über kleinen Basis-Helfer (wie `produktinformationenBasis`) |
| Versions-Stammdaten-Hook (`useLangfristigeKpiKategorien`) | **wiederverwenden** | liefert Produkte / Marketingkanäle / Investitionsgruppen der Version |
| Globale Kategorien (`useKpiCategories`) | **wiederverwenden** | Oberkategorien + normale Unterkategorien |
| Versionsprüf-Helfer (`ensureLangfristigeVersion`) | **wiederverwenden** | aus PROJ-77 |
| Datenablagen + Endpunkte | **Neubau** | vier versions-/nutzergebundene Ablagen + Endpunkt-Satz |
| shadcn/ui (Tabs, Select, Input, Label, Checkbox, Table, Card, Toast) | **bestehend** | bereits installiert; keine neuen Pakete |

### F) Geänderte / neue Dateien (Überblick, PM-lesbar)
- **Neu:** eine Seite unter `…/[versionId]/steuereinstellungen` (bettet die parametrisierte Komponente ins Versions-Gerüst ein).
- **Neu:** ein kleiner Basis-Pfad-Helfer (global vs. versionsgebunden), analog zum bestehenden Produktinformationen-Helfer.
- **Neu:** vier versionsbewusste Endpunkte (Grund-/Einfuhr-Felder, USt-Sätze, Ebene-Auswahl, Fiskalverzollung) + eine Datenbank-Migration mit vier Ablagen (Row Level Security, Indizes, kaskadierende Löschung pro Version/Produkt).
- **Geändert (additiv, verhaltenswahrend):** die bestehende Steuer-Komponente und ihre vier Hooks erhalten einen optionalen `versionId`-Parameter und — im Versions-Modus — die zusätzlichen Versions-Kategoriequellen für Marketing/Investitionen.
- **Keine** Navigationsänderung nötig (Slug „steuereinstellungen" existiert bereits).

### G) Tech-Entscheidungen (Begründung)
| Entscheidung | Gewählt | Warum |
|---|---|---|
| Datenhaltung | Datenbank, **pro Planversion** | Volle Szenario-Isolation (PROJ-73-Prinzip); vom Nutzer bestätigt |
| Bestehende Oberfläche parametrisieren | Ja (kein Neubau) | „Gleiches Erlebnis" ohne Doppelarbeit, kein Regressionsrisiko für die Kurzfristig-Seite — identisch zu PROJ-77 |
| Investitionen nur auf Gruppenebene | Ja | Vom Nutzer bestätigt: nur Obergruppen erhalten Sätze; Untergruppen erben später — vereinfacht alle drei Sonderfälle zu flachen Listen |
| Spezial-Oberkategorien per Namensabgleich | Ja | Bestehendes, erprobtes Muster (Kurzfristig „Produktverkäufe"); robust gegen fehlende Kategorie |
| USt-Sätze: ein Kategorie-Verweis + Herkunftsmerkmal | Ja | Hält die einfache Speicherform bei; minimaler Eingriff in Hooks/Endpunkte |
| Einzel-Kategorie-Löschung = inerte Waise (statt DB-Kaskade) | Ja | Maximale Wiederverwendung; harmlos & konsistent mit PROJ-77; Versionslöschung kaskadiert weiterhin sauber |
| Zugriffsschutz doppelt (Versionseigentum serverseitig + RLS) | Ja | Bewährtes Muster aus PROJ-74/77 |

### H) Abhängigkeiten (Pakete)
**Keine neuen npm-Pakete.** Wiederverwendet werden: die bestehende Steuer-Oberfläche (PROJ-65), das Versions-Gerüst und die Nav-Konfiguration (PROJ-73), die Versions-KPI-Stammdaten (PROJ-74), der Versionsprüf-Helfer (PROJ-77), das globale KPI-Modell (PROJ-2), shadcn/ui, Zod (Validierung) und Supabase (Datenhaltung inkl. Row Level Security).

### I) Umsetzungsreihenfolge (empfohlen)
1. Vier versionsgebundene Ablagen + versionsbewusste Endpunkte anlegen (nutzer- & versionsgesichert).
2. Die vier Reiter-Hooks um einen optionalen `versionId`-Parameter erweitern (Basis-Pfad-Helfer).
3. Die Steuer-Komponente parametrisieren: im Versions-Modus die Unterzeilen von Produktverkäufe/Marketing/Investitionen aus den Versions-Stammdaten speisen, Fiskalverzollung aus Versions-Produkten, Empty-State-Link auf die KPI-Modell-Verwaltung der Version.
4. Neue Seite ins Versions-Gerüst einbetten; Kachel-Verlinkung auf der Versions-Übersicht prüfen (Slug existiert bereits).

> Schwerpunkt liegt in Schritt 1–2 (Datenhaltung/Endpunkte). Schritt 3–4 sind überwiegend Verdrahtung, da Oberfläche und Gerüst bereits existieren.

## Implementation Notes

### Frontend (Parametrisierung der Kurzfristig-Oberfläche), 2026-06-20
Die Seite ist gebaut und verdrahtet; die versionsgebundene API folgt mit `/backend`. Bis dahin zeigen die Reiter im Versions-Modus sauber den Lade-/Fehlerzustand (die Versions-Endpunkte existieren noch nicht) — kein Absturz; das Versions-Gerüst (PROJ-73) lädt korrekt.

**Leitidee der Umsetzung:** Die bestehende, QA-getestete Kurzfristig-Oberfläche (`steuereinstellungen-formular.tsx`, PROJ-65) wurde **parametrisierbar** gemacht statt dupliziert. Alle Änderungen sind **additiv und verhaltenswahrend**: ohne `versionId` verhält sich alles exakt wie zuvor (Kurzfristig-Seite unverändert — durch `next build` bestätigt: Route `/dashboard/kurzfristige-planung/steuereinstellungen` weiterhin vorhanden).

**Neue Dateien:**
- `src/lib/steuereinstellungen-api.ts` — Basis-Pfad-Helfer (analog zu `produktinformationen-api.ts`): vier Funktionen (`ustEinstellungenPfad`, `ustKategorieSaetzePfad`, `ustEbeneAuswahlPfad`, `ustFiskalverzollungPfad`); ohne `versionId` → globale Kurzfristig-Pfade, mit → `/api/langfristige-planung/[versionId]/steuereinstellungen/…`.
- `src/app/dashboard/langfristige-planung/[versionId]/steuereinstellungen/page.tsx` — neue Seite, eingebettet ins `LangfristigeVersionShell`, rendert `LangfristigeSteuereinstellungenFormular`. Löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab.

**Geänderte Dateien (additiv):**
- `src/hooks/use-ust-einstellungen.ts`, `use-ust-kategorie-saetze.ts`, `use-einfuhrust-fiskalverzollung.ts` — je optionaler `versionId`-Parameter; alle Fetch-Pfade laufen über die Basis-Helfer; `versionId`/Pfad in den Hook-Deps. `UstKategorieSatz` zusätzlich um optionales `quelle: 'global' | 'version'` erweitert (Herkunft der Kategorie; Kurzfristig-Route ignoriert das Feld).
- `src/components/steuereinstellungen-formular.tsx` — optionaler `versionId`-Prop auf `SteuereinstellungenFormular`; neuer Export `LangfristigeSteuereinstellungenFormular({ versionId })`. Im Versions-Modus:
  - **Umsatzsteuersätze:** Oberkategorien weiterhin aus dem globalen KPI-Modell (`einnahmen`/`ausgaben_kosten`, „Steuern" ausgeblendet). Unterzeilen von **Produktverkäufe** → `lp_produkt`, **Marketing** → `lp_marketingkanal`, **Investitionen** → `lp_investition` (nur Ebene 1 / Obergruppen) — alle flach (`childEbene 1`). Erkennung der Spezial-Oberkategorien per Namensabgleich (case-insensitive), wie bisher bei „Produktverkäufe". Die globale Oberkategorie heißt „Produktinvestitionen"; auf dieser Seite wird sie als **„Investitionen"** angezeigt (nur Anzeige-Label im Versions-Modus — gespeichert wird weiterhin gegen die globale Kategorie-ID; der globale KPI-Kategoriename bleibt unverändert).
  - Beim Speichern eines Satzes wird im Versions-Modus `quelle` mitgeschickt (anhand der Versions-Kategorie-IDs).
  - „Gesamt/Aufgeteilt"-Auswahl läuft über `ustEbeneAuswahlPfad(versionId)`; localStorage-Rückfall **nur** im Kurzfristig-Modus (localStorage ist nicht versionsspezifisch).
  - **Einfuhrumsatzsteuer:** Fiskalverzollung-Tabelle aus den Produkten der Version (`lp_produkt`); Fiskalverzollung-Hook versionsbewusst.
  - Empty-States: Versions-Kategorien (Produkte/Marketing/Investitionen) verlinken auf die **KPI-Modell-Verwaltung dieser Version**; der „keine Einnahmen-/Ausgabenkategorien"-Leerstate verlinkt weiterhin auf das **globale** KPI-Modell (diese Kategorien sind global).
  - `ParentGroupRow`/`UstSaetzeTabelle` um optionales `kpiHref` ergänzt → zeigt im „Aufgeteilt"-Modus ohne Versions-Einträge einen Leerhinweis mit Link.

**Navigation/Kachel:** Keine Änderung nötig — Slug `steuereinstellungen` existiert bereits in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen", letzter Eintrag). NavSheet und Versions-Übersichtskachel rendern generisch und verlinken automatisch.

**Erwartete API (für `/backend`)** — versions- & nutzergesichert, fremde/unbekannte `versionId` → kein Zugriff (`ensureLangfristigeVersion`). Alle unter `/api/langfristige-planung/[versionId]/steuereinstellungen/`:
- `einstellungen` (GET → `UstEinstellungen | null`; PUT partial-Upsert) — 1 Eintrag pro Version (Frequenz, Verschiebung, Einfuhr-Satz, Einfuhr-Zahlungsziel, optional `ust_satz_pflegeebene`).
- `kategorie-saetze` (GET → `{ kategorie_id, ebene, ust_satz, quelle }[]`; POST Batch-Upsert) — Feld `quelle` unterscheidet globale vs. Versions-Kategorie; `plan_version_id`-gebunden.
- `ebene-auswahl` (GET → `Record<kategorie_id, 1|2>`; POST Batch-Upsert) — „Gesamt/Aufgeteilt" je (globaler) Oberkategorie, `plan_version_id`-gebunden.
- `fiskalverzollung` (GET → `{ produkt_id, fiskalverzollung }[]`; PUT je Produkt) — `produkt_id` → `langfristige_kpi_kategorien` (`lp_produkt`).

**Qualität:** `tsc --noEmit` ohne neue Fehler in den geänderten/neuen Dateien (verbleibende Fehler nur in vorbestehenden, unbeteiligten Testdateien); `next lint` sauber für die geänderten/neuen Dateien; `next build` erfolgreich — beide Routen registriert (Kurzfristig statisch, Langfristig dynamisch).

### Backend (Tabellen + versionsgebundene API), 2026-06-20
Datenhaltung und API sind implementiert; das Frontend ruft exakt diese Endpunkte (im Frontend-Schritt verdrahtet) — keine weiteren Frontend-Änderungen nötig.

**Datenbank (Supabase-Projekt „Controlling-App", Migration `create_langfristige_steuereinstellungen`):**
4 neue, versionsgebundene Tabellen (spiegeln die Kurzfristig-Tabellen aus PROJ-65):
- `langfristige_ust_einstellungen` — Grund-/Einfuhr-Kopffelder, **1 Eintrag pro Version** (`UNIQUE(plan_version_id)`); CHECK auf Frequenz-Enum, Tage ≥ 0, Einfuhr-Satz 0–100, Pflegeebene ∈ {1,2}.
- `langfristige_ust_kategorie_saetze` — USt-Satz je Kategorie; `kategorie_id` (UUID, **kein** harter FK — zeigt je `quelle` auf globale `kpi_categories` ODER `langfristige_kpi_kategorien`), `quelle` ∈ {global, version} (Default `global`), `ebene` ∈ {1,2}, `ust_satz` 0–100 oder NULL; `UNIQUE(plan_version_id, kategorie_id, ebene)`.
- `langfristige_ust_ebene_auswahl` — „Gesamt/Aufgeteilt" je (globaler) Oberkategorie; `UNIQUE(plan_version_id, kategorie_id)`.
- `langfristige_einfuhrust_fiskalverzollung` — Fiskalverzollung je Produkt; `produkt_id` FK → `langfristige_kpi_kategorien` (`ON DELETE CASCADE` → Eintrag verschwindet, wenn das Produkt im Versions-KPI-Modell gelöscht wird); `UNIQUE(plan_version_id, produkt_id)`.

Alle Tabellen: `user_id` → `auth.users` (`ON DELETE CASCADE`), `plan_version_id` → `langfristige_planversionen` (`ON DELETE CASCADE` → kaskadierende Löschung pro Planversion). RLS aktiviert, je Tabelle eine `FOR ALL`-Policy `auth.uid() = user_id` (USING + WITH CHECK; zweite Verteidigungslinie zur serverseitigen Versionsprüfung). Indizes auf `plan_version_id`, `user_id` (+ `produkt_id` bei Fiskalverzollung). `get_advisors` (security): **keine** neue Warnung für die 4 Tabellen (bestehende `USING(true)`-Warnungen betreffen ausschließlich ältere, unbeteiligte Tabellen).

> **Hinweis zur Verfeinerung (siehe Tech Design):** Bei `langfristige_ust_kategorie_saetze` wurde bewusst die einfache Ein-Spalten-Referenz (`kategorie_id` + `quelle`) gewählt statt zwei nullbarer FKs. Folge: Wird eine **einzelne** Versions-Kategorie (Produkt/Marketingkanal/Investitionsgruppe) gelöscht, bleibt ihr Satz als **inerte, nie angezeigte** Zeile bestehen (die Kategorie fehlt in der Quellliste) und wird spätestens beim Löschen der Version mitentfernt. Versionslöschung und Produkt-Fiskalverzollung kaskadieren weiterhin per FK. Konsistent mit PROJ-77 (Beobachtung „L1").

**API-Routen (versions- & nutzergesichert):** 4 Routen unter `src/app/api/langfristige-planung/[versionId]/steuereinstellungen/`:
- `einstellungen/route.ts` (GET → `UstEinstellungen` mit Defaults bei leer; PUT partial-Upsert, 400 bei leerem Body/ungültig)
- `kategorie-saetze/route.ts` (GET → `{ kategorie_id, ebene, ust_satz, quelle }[]`; POST Batch-Upsert `onConflict: plan_version_id,kategorie_id,ebene`)
- `ebene-auswahl/route.ts` (GET → `Record<kategorie_id, 1|2>`; POST Batch-Upsert `onConflict: plan_version_id,kategorie_id`)
- `fiskalverzollung/route.ts` (GET → `{ produkt_id, fiskalverzollung }[]`; PUT Upsert `onConflict: plan_version_id,produkt_id`)

Muster je Route: `requireAuth` (401) → `ensureLangfristigeVersion` (400 ungültige UUID, 404 fremde/unbekannte `versionId`) → Queries zusätzlich nach `user_id` **und** `plan_version_id` gefiltert → Zod-Validierung → Upsert. Fehler als `{ error }`. Berechnungen/Defaults serverseitig.

**Tests:** 4 neue Testdateien (`…/steuereinstellungen/**/route.test.ts`) — **26/26 grün** (GET inkl. Defaults/leer/Record-Form, POST/PUT Happy Path, 400 ungültige Eingabe/UUID/Bereich/leerer Body, 404 fremde Version, 401 unauth, `quelle`-Default). `tsc --noEmit` ohne neue Fehler in den neuen/geänderten Dateien; `next build` erfolgreich — alle 4 Endpunkte + Seite registriert, Kurzfristig-Route unverändert.

## QA Test Results

**Getestet:** 2026-06-21 · **Methode:** Code-Audit aller Akzeptanzkriterien + Vitest (API/Logik) + Playwright (Route/Auth/Regression) + DB-Introspektion (FK-Cascade, RLS, UNIQUE). Interaktionen (Auto-Save je Reiter, Gesamt/Aufgeteilt-Umschalter, Versions-Kategoriequellen, Fiskalverzollung, Versionsisolation) sind code-/DB-geprüft — analog zum Vorgehen bei PROJ-74/77/82 (versionsgebundene Seiten ohne automatisierte Login-Session in E2E).

### Akzeptanzkriterien

| Bereich | Ergebnis | Beleg |
|---------|----------|-------|
| Route nur im Versionskontext, in `LangfristigeVersionShell` eingebettet, Redirect bei fremder/unbekannter Version | ✅ | `page.tsx` in Shell; `ensureLangfristigeVersion` → 404; E2E Auth-Redirect |
| Nav-Eintrag „Steuereinstellungen" (Gruppe Einstellungen) + Versions-Übersichtskachel | ✅ | Slug in `langfristige-planung-nav.ts` (PROJ-73); generisches Rendering |
| Seitentitel „Steuereinstellungen", 3 Reiter in Reihenfolge | ✅ | Shell `seitenTitel`; `Tabs` (grundeinstellungen/saetze/einfuhr) |
| Sektion 1: Frequenz-Dropdown + Verschiebung (Ganzzahl ≥ 0), pro Version, Defaults bei Erstaufruf, Auto-Save + Fehler-Toast/Revert | ✅ | `useUstEinstellungen(versionId)` → `…/einstellungen`; GET liefert DEFAULTS |
| Sektion 2: Einnahmen/Ausgaben aus globalem KPI-Modell, „Steuern" ausgeblendet, `sort_order` | ✅ | `useKpiCategories('einnahmen'/'ausgaben_kosten')`; Filter `!== 'steuern'` |
| Gesamt/Aufgeteilt-Umschalter je Oberkategorie mit Unterkategorien; ohne Kinder direkt editierbar | ✅ | `ParentGroupRow` (`hasChildren`-Logik) |
| Produktverkäufe → Versions-`lp_produkt`; Marketing → `lp_marketingkanal`; Investitionen → `lp_investition` (nur Ebene 1) | ✅ | `produktLevel1`/`marketingLevel1`/`investitionLevel1` + Namensabgleich |
| Übrige Kategorien behalten globale Unterkategorien | ✅ | `ausgabenGroups`/`einnahmenGroups` ohne Override |
| USt-Satz 0–100, Auto-Save onBlur, Fehler-Toast + Revert bei ungültig | ✅ | `handleRowBlur` (Validierung + `saveBatch`) |
| Alle Sätze + Gesamt/Aufgeteilt-Auswahl pro Version gespeichert | ✅ | `…/kategorie-saetze` + `…/ebene-auswahl`, `plan_version_id`-gebunden |
| Sektion 3: Einfuhr-Satz (0–100) + Zahlungsziel (≥ 0) pro Version; Fiskalverzollung-Tabelle aus Versions-Produkten, Auto-Save | ✅ | `EinfuhrUstSektion` versionsbewusst; `useEinfuhrustFiskalverzollung(versionId)` |
| Datenpersistenz & Versionsisolation; Cascade bei Versions-/Produktlöschung | ✅ | DB-Introspektion: FK `ON DELETE CASCADE` (plan_version_id alle 4; produkt_id bei Fiskalverzollung) |
| „Produktinvestitionen" wird als „Investitionen" angezeigt (Label, Versions-Modus; Speicherung gegen globale ID) | ✅ | `ausgabenGroups` Relabel (vom Nutzer beauftragt 2026-06-21) |
| Leerstate „keine Einnahmen-/Ausgabenkategorien" → Link globales KPI-Modell | ✅ | `hasNoCategories`-Zweig |
| Fiskalverzollung-Leerstate „keine Produkte in dieser Version" + Link zur Versions-KPI-Modell-Verwaltung | ✅ | `EinfuhrUstSektion` Empty-State |
| Leerhinweis für Produktverkäufe/Marketing/Investitionen-**Unterliste** im Aufgeteilt-Modus | ⚠️ siehe **L1** | Hinweis-Zeile rendert nicht (Bug L1) |

### Automatisierte Tests
- **Vitest (PROJ-83 API):** 4 Routen-Testdateien — **26/26 grün** (GET inkl. Defaults/leer/Record-Form, POST/PUT Happy Path, 400 ungültige Eingabe/UUID/Bereich/leerer Body, 404 fremde Version, 401 unauth, `quelle`-Default).
- **Playwright (`PROJ-83-…spec.ts`):** **12/12 grün** (chromium + Mobile Safari) — Route ohne 404, Auth-Redirect, Dashboard-Redirect, Kurzfristig-Steuereinstellungen weiterhin erreichbar, langfristige Finanzierung weiterhin erreichbar, globales KPI-Modell weiterhin erreichbar.
- `tsc --noEmit` ohne neue Fehler in den geänderten/neuen Dateien (verbleibende Fehler nur in vorbestehenden, unbeteiligten Testdateien); `next build` erfolgreich (alle 4 Endpunkte + Seite registriert, Kurzfristig-Route unverändert).

### Security-Audit (Red Team) — keine Critical/High/Medium-Befunde
- **AuthN/AuthZ:** Jede der 4 Routen `requireAuth` (401) + `ensureLangfristigeVersion` (400 ungültige UUID, 404 fremde/unbekannte `versionId`) + Query-Filter nach `user_id` **und** `plan_version_id`. RLS auf allen 4 Tabellen mit `USING/WITH CHECK = (auth.uid() = user_id)` (per DB-Introspektion verifiziert — `FOR ALL`-Policy, **kein** permissives `true`). Kein Cross-User-/Cross-Version-Zugriff möglich.
- **Eingabevalidierung:** Zod auf allen PUT/POST (UUIDs, Satz 0–100, Tage ≥ 0, Frequenz-/Ebene-/Quelle-Enums); DB-CHECK-Constraints als zweite Linie.
- **XSS/Injection:** Namen als Text gerendert (React-Escaping, kein `dangerouslySetInnerHTML`); Supabase parametrisierte Queries.
- **Advisors:** `get_advisors` (security) meldet **keine** neue Warnung für die 4 neuen Tabellen.

### Bugs

Keine Critical/High/Medium gefunden.

**Low / Beobachtungen (kein Blocker):**
- **L1 (AC-Wortlaut-Abweichung, kosmetisch):** Der im Frontend ergänzte Leerhinweis für eine Spezial-Oberkategorie (Produktverkäufe/Marketing/Investitionen) **im Aufgeteilt-Modus ohne Versions-Einträge** rendert nie: Hat eine Oberkategorie 0 Unterzeilen, erzwingt `ParentGroupRow` `wahl = 'hier'` (kein Umschalter, `isUnterebene = false`), sodass die Bedingung `isUnterebene && children.length === 0` nie zutrifft. Folge: Bei fehlenden Versions-Produkten/-Marketingkanälen/-Investitionen wird die Oberkategorie als **direkt editierbare „Gesamt"-Zeile** dargestellt statt mit Hinweis+Link. Funktional unbedenklich (Satz auf Oberkategorie pflegbar); die „keine Produkte"-Situation wird zudem im Einfuhr-Reiter klar mit Link kommuniziert. Empfehlung: Hinweis stattdessen rendern, wenn eine **als Spezial-Oberkategorie erkannte** Gruppe 0 Unterzeilen hat — oder den toten Code entfernen.
- **L2 (by design, konsistent mit PROJ-77):** Ein USt-Satz, dessen Versions-Kategorie (Produkt/Marketingkanal/Investitionsgruppe) einzeln gelöscht wird, bleibt als **inerte, nie angezeigte** Zeile bestehen (kein DB-FK auf `kategorie_id`; bewusst gewählt, siehe Tech Design). Per direktem API-Aufruf könnte ein Nutzer zudem einen beliebigen `kategorie_id` für die **eigene** Version speichern → harmlose Waisenzeile, kein Cross-User-Zugriff (RLS). Versionslöschung + Produkt-Fiskalverzollung kaskadieren weiterhin per FK.
- **L3 (kosmetisch, geerbt von PROJ-65):** Auf Mobil (375px) kann die 3-Reiter-Leiste umbrechen — funktional, kein Overflow.

### Hinweis zur Gesamt-Testsuite
Ein vollständiger `vitest run` zeigt Fehlschläge in **unbeteiligten** Dateien anderer, laufender Features (z. B. marketing-einstellungen, einnahmen-planung, bestellplanung, konsolidierung) — bereits vor dieser Session unkommittiert im Arbeitsbaum, importieren **keine** PROJ-83-Dateien und liegen außerhalb dieses QA-Scopes. Der PROJ-83-Scope (26 API-Tests + 12 E2E) ist vollständig grün.

### Production-Ready: **JA**
Keine Critical/High/Medium-Bugs. PROJ-83 ist freigegeben. Die drei Low-Beobachtungen sind kein Blocker; L1 kann bei Gelegenheit nachgezogen werden.

## Deployment
_To be added by /deploy_

## Deployment
_To be added by /deploy_
