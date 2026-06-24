# PROJ-91: Umsatzausgaben Planung — Langfristige Planung

## Status: Approved
**Created:** 2026-06-22
**Last Updated:** 2026-06-23 (Zahlungsverschiebung: monatlich = Anfallsmonat, quartalsweise = Quartalsbündelung; kein Folgemonat)

## Änderungsnotiz 2026-06-23 — Zahlungsverschiebung ohne Folgemonat (quartalsweise bündelt)
Die Funktion `shiftToPaymentMonth` in `src/app/api/langfristige-planung/[versionId]/umsatzausgaben/berechnet/route.ts` rechnet jetzt:
- **monatlich** → Kosten bleiben im **Anfallsmonat**;
- **quartalsweise** → Kosten des Quartals werden im **letzten Quartalsmonat gebündelt** (Q1→Mär, Q2→Jun, Q3→Sep, Q4→Dez);
- in **beiden** Fällen verschiebt zusätzlich nur das **Zahlungsziel (Tage)** (`ceil(Tage/30)` Monate).

Der bisher in beiden Gruppierungen pauschal addierte **Folgemonat** ist **entfernt**. Die Gruppierung behält damit ihre Bedeutung (monatliche vs. quartalsweise Zahlung), verschiebt aber nicht mehr künstlich um einen Monat nach hinten.

Unberührt: **Produktausgaben** (Bestellkosten) sitzen weiterhin am Fälligkeitsdatum ihrer Bestellkosten-Tranche (kein `shiftToPaymentMonth`). Die **USt-eigene** Voranmeldungs-Verschiebung (`shiftUstPayment` in der Steuer-Route PROJ-93) ist **unverändert** (monatlich = Folgemonat). Umfang bewusst nur **langfristige** Umsatzausgaben (kurzfristige PROJ-67 unverändert). Gilt einheitlich für **Vertrieb und Marketing** (gemeinsamer Code). Tests in `…/umsatzausgaben/berechnet/route.test.ts` angepasst (monatlich-bleibt-im-Monat, Zahlungsziel-Versatz, quartalsweise-bündelt-im-Quartalsmonat).

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert **Produkte** (`art = 'lp_produkt'`), **Sales-Plattformen** (`art = 'lp_sales_plattform'`) und **Marketingkanäle** (`art = 'lp_marketingkanal'`) der Planversion. Die Zeilen-Kategorien (Produktausgaben / Vertriebsausgaben / Marketingausgaben) stammen aus dem **globalen** `ausgaben_kosten`-KPI-Baum (wie kurzfristig); nur die Produkte/Plattformen/Kanäle als Berechnungsdimensionen sind versionsgebunden
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`) und **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monatsfenster
- Requires: PROJ-77 (Produktinformationen — Langfristige Planung) — liefert je Produkt der Version das **M³-Volumen** (Containerkapazität, Tab „Containerkapazität") für die Lagerausgaben-Berechnung
- Requires: PROJ-78 (Vertriebseinstellungen — Langfristige Planung) — liefert je Produkt der Version: **Versandgebühren** (Versand-Reiter), **Lagerkosten €/m³/Monat** (Lager-Reiter), **Retourenquote %** + **Retouren-Handlingkosten** (Retouren-Allgemein), **Kulanzquote/Kulanzproduktkosten/Kulanzversandkosten** (Ersatzteile/Kulanz). Außerdem je Reiter die **Gruppierung** (monatlich/quartalsweise) + **Zahlungsziel (Tage)** für die Zahlungsverschiebung
- Requires: PROJ-80 (Marketing-Einstellungen — Langfristige Planung) — liefert je Marketingkanal die **Gruppierung** + **Zahlungsziel (Tage)** sowie die **Sales-Plattform-Zuordnung** (`sales_plattform_id`) für den Marketing-Filter
- Requires: PROJ-76 (Auszahlungseinstellungen — Langfristige Planung) — liefert je Plattform die zugeordneten Marketingkanäle (`langfristige_auszahlungs_marketingkanaele`); nur Kanäle **ohne** Sales-Plattform-Zuordnung erscheinen in den Marketingausgaben dieser Seite
- Requires: PROJ-83 (Steuereinstellungen — Langfristige Planung) — liefert je Kategorie/Ebene die **USt-Sätze** (`langfristige_ust_kategorie_saetze` + Pflegeebene-Auswahl), die als Aufschlag auf die Netto-Werte angewendet werden
- Requires: PROJ-84 (Absatzplanung — Langfristige Planung) — liefert je (Sales-Plattform, Produkt, Monat) **Absatz** und **Effektiver VK**; liefert außerdem den Monatsfenster-Helfer (`buildPlanungsmonate`) und die versionsgebundene Notiz-Tabelle (`langfristige_planung_notizen`)
- Requires: PROJ-85 (Marketing-Planung — Langfristige Planung) — liefert je Marketingkanal × Produkt × Monat den **Marketingkosten-%-Satz** für die Marketingausgaben-Berechnung
- Requires: PROJ-86 (Bestellplanung — Langfristige Planung) — liefert die **Bestellungen** der Version inkl. der zugehörigen **Bestellkosten** (Ware, Versand, Inspektion, Einlagerung etc.) als Quelle der Produktausgaben
- Vorlage (kein harter Require): PROJ-67 (Umsatzausgaben — Kurzfristige Planung) — Zeilenhierarchie, Kategorien und Berechnungslogik werden gespiegelt, mit den unten beschriebenen Abweichungen
- Vorlage (kein harter Require): PROJ-87 (Sales-Plattform-Planung — Langfristige Planung) — Muster für „berechnet + manuell überschreibbar" (grau/blau Punkte, Einzelzelle-Reset, globaler Reset) auf monatsbasierter, versionsgebundener Tabelle
- Integriert: PROJ-40 (Betragsselektion) — „Hover/Klick"-Summenpanel
- Integriert: PROJ-53-Muster (Zellen-Notizen) — versionsgebunden über `langfristige_planung_notizen`

## Übersicht

Die Seite **„Umsatzausgaben"** ist eine weitere Planungsseite im Navigationsbereich **„Planung"** der Langfristigen Planung. Sie spiegelt die gleichnamige Seite der **Kurzfristigen Planung** (PROJ-67) — **im Kern werden alle Kategorien genau so angezeigt und berechnet** — nur dass durchgehend die Einstellungen **dieser Planversion** zum Einsatz kommen und die Zeitachse **monatsweise** statt wochenweise ist.

Die Seite zeigt eine **monatsbasierte** Übersicht der direkt mit dem Umsatz zusammenhängenden Ausgaben, gegliedert nach KPI-Modell in drei Hauptbereiche (identisch zu PROJ-67):

1. **Produktausgaben** — Bestellkosten aus den Bestellungen der Langfristigen Bestellplanung (PROJ-86)
2. **Vertriebsausgaben** — Versandausgaben, Lagerausgaben, Retourenausgaben, Ersatzteile/Kulanz, Verkaufsgebühren
3. **Marketingausgaben** — nur Marketingkanäle ohne Sales-Plattform-Zuordnung

Wesentliche Unterschiede zur kurzfristigen Variante (alle vom Nutzer am 2026-06-22 bestätigt):

- **Monatsspalten statt Kalenderwochen.** Die Tabelle beginnt **exakt mit dem Startmonat** (aus den Grundeinstellungen der Version) und reicht über den **allgemeinen Planungshorizont** (`planungshorizont_monate` Monate ab Startmonat). **Keine Vorlaufmonate.**
- **Keine Vergangenheits-/Ist-Spalten.** Die Langfristige Planung kennt **keine Transaktionen**: Es gibt **keine** „Ist-Tatsächlich"- und **keine** „Ist-Plan"-Spalten. Jede Monatsspalte ist eine **Soll-Spalte** (berechnet, manuell überschreibbar).
- **Liquiditätssicht mit Zahlungsverschiebung.** Der Fälligkeitsmonat folgt aus der **Gruppierung** (PROJ-78/PROJ-80): **monatlich** → Kosten bleiben im **Anfallsmonat**; **quartalsweise** → Kosten des Quartals werden im **letzten Quartalsmonat** gebündelt (Q1→Mär, Q2→Jun, Q3→Sep, Q4→Dez). In beiden Fällen verschiebt zusätzlich nur ein hinterlegtes **Zahlungsziel (Tage)** (Monatsebene: `ceil(Tage/30)`). **Kein** pauschaler Folgemonat. _(Geändert 2026-06-23 — siehe Änderungsnotiz oben.)_
- **Auto-Berechnung + manuelle Überschreibung.** Alle Soll-Zellen werden automatisch berechnet (**grauer Punkt**); der Nutzer kann jeden Wert manuell überschreiben (**blauer Punkt**), eine einzelne Zelle auf den berechneten Wert zurücksetzen und alle manuellen Werte global zurücksetzen — analog PROJ-87.
- **Verkaufsgebühren rein manuell.** Wie in PROJ-67 hat die Verkaufsgebühren-Zeile **keine** Auto-Berechnung; sie ist nur manuell befüllbar (kein grauer Punkt; blauer Punkt bei manueller Eingabe).
- **Versionsbindung der Werte.** Die eingegebenen manuellen Überschreibungen und Notizen sind **strikt pro Planversion** isoliert (Datenisolation gemäß PROJ-73); die globale Kategoriestruktur ist bewusst nicht versionsisoliert.

**Beibehalten** werden: das **Betragsselektion-/Hover-Klick-Summenpanel** (PROJ-40), die **Zellen-Notizen** (PROJ-53, versionsgebunden) sowie **„Alle ein-/ausklappen"**. **Kein** Bulk-Edit (bewusst, da PROJ-67 keines hatte). Die **Gesamt-Zeile** erscheint ganz **unten**.

## Berechnungslogik

Alle Berechnungen erfolgen je **Produkt X × Monat M** (Marketing zusätzlich je Marketingkanal) und entsprechen der kurzfristigen Implementierung (PROJ-67, `…/umsatzausgaben-planung/berechnet`), parametriert mit den Einstellungen **dieser Planversion**. Server-seitig in einer `berechnet`-Route; Aggregationen (Untergruppen-, Gruppen-, Gesamt-Summen) frontend-seitig.

**Gemeinsame Zahlungsverschiebung** (für alle Vertriebsausgaben mit Auto-Berechnung + Marketing):
- Rohwert je Produkt × Quellmonat M berechnen.
- Fälligkeit gemäß Gruppierung des jeweiligen Reiters/Kanals (PROJ-78/PROJ-80): **monatlich** → Anfang Folgemonat; **quartalsweise** → Anfang Folgemonat des Quartals (Q1→April, Q2→Juli, Q3→Oktober, Q4→Januar Folgejahr).
- Zahlungsziel (Tage) verschiebt den Fälligkeitstermin zusätzlich nach hinten (auf Monatsebene gerundet/abgebildet).
- Alle Rohwerte mit demselben Fälligkeitsmonat werden je Produkt summiert.
- USt-Aufschlag gemäß Steuereinstellungen (PROJ-83): Pflegeebene aufgeteilt → je Untergruppe; sonst Gesamtebene der Gruppe; kein Satz gepflegt → 0 %.

**Berechnung je Ausgabentyp** (Absatz aus PROJ-84, plattformübergreifend je Produkt summiert):

| Ausgabentyp | Formel (je Produkt × Monat) | Quellen (langfristig, versionsgebunden) |
|---|---|---|
| Produktausgaben | Bestellkosten je Kategorie direkt aus den Bestellungen | PROJ-86 (Bestellungen + Bestellkosten) |
| Versandausgaben | Versandkosten × Absatz | PROJ-78 (Versand), PROJ-84 (Absatz) |
| Lagerausgaben | Lagerkosten (€/m³/Monat) × **Bestand (Monatsende)** × M³-Volumen | PROJ-78 (Lager), PROJ-77 (M³-Volumen), PROJ-86 (Bestandssimulation) |
| Retourenausgaben | Retourenquote % × Absatz × Retouren-Handlingkosten | PROJ-78 (Retouren-Allgemein), PROJ-84 |
| Ersatzteile/Kulanz | Kulanzquote × Absatz × (Kulanzproduktkosten + Kulanzversandkosten) | PROJ-78 (Kulanz), PROJ-84 |
| Marketingausgaben | Marketingkosten-% × Absatz × Effektiver VK | PROJ-85 (%), PROJ-84 (Absatz, VK), PROJ-80/PROJ-76 (Filter + Zahlungsziel) |
| Verkaufsgebühren | — (nicht berechnet, nur manuell) | — |

**Produktausgaben-Besonderheit:** keine Zahlungsverschiebung; Zeitbezug ist der Liefer-/Bestellmonat der Bestellung (auf ISO-Monat umgerechnet). Alle Bestellkosten-Positionen werden je KPI-Kategorie summiert und dem Produkt zugeordnet.

**Marketing-Filter:** nur Marketingkanäle, die in den Auszahlungseinstellungen (PROJ-76) **keiner** Sales-Plattform zugeordnet sind (die zugeordneten erscheinen in der Sales-Plattform-Planung PROJ-87).

## User Stories

- Als Controller möchte ich innerhalb einer geöffneten Planversion über die Navigationsgruppe „Planung" die Seite „Umsatzausgaben" aufrufen können, damit ich die umsatzbezogenen Ausgaben dieses Szenarios planen kann.
- Als Controller möchte ich, dass alle Kategorien (Produktausgaben, Vertriebsausgaben, Marketingausgaben) genau so angezeigt und berechnet werden wie in der kurzfristigen Planung, nur mit den Einstellungen dieser Planversion.
- Als Controller möchte ich, dass die Tabelle exakt mit dem Startmonat beginnt und über den allgemeinen Planungshorizont reicht, damit ich genau meinen Planungszeitraum sehe.
- Als Controller möchte ich für jeden Monat automatisch vorberechnete Soll-Werte sehen, die auf meinen Versions-Einstellungen basieren, damit ich keine Werte manuell schätzen muss.
- Als Controller möchte ich jeden vorberechneten Wert manuell überschreiben können und auf einen Blick sehen, ob ein Wert automatisch oder manuell ist (grauer vs. blauer Punkt).
- Als Controller möchte ich eine einzelne überschriebene Zelle wieder auf den berechneten Wert zurücksetzen können sowie alle manuellen Werte und Notizen global zurücksetzen können.
- Als Controller möchte ich alle Kategoriegruppen einzeln auf-/zuklappen sowie mit zwei Buttons alle gleichzeitig ein-/ausklappen können.
- Als Controller möchte ich für einzelne Zellen Notizen hinterlegen können (versionsgebunden).
- Als Controller möchte ich mehrere Zellen selektieren und die Summe rechts unten angezeigt bekommen (Betragsselektion).
- Als Controller möchte ich, dass meine manuellen Eingaben und Notizen pro Planversion gespeichert werden, ohne andere Versionen oder die Kurzfristige Planung zu beeinflussen.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] In der versionsspezifischen Navigation (`src/lib/langfristige-planung-nav.ts`) gibt es in der Gruppe **„Planung"** einen neuen Eintrag **„Umsatzausgaben"** mit Slug `umsatzausgaben`, der auf `/dashboard/langfristige-planung/[versionId]/umsatzausgaben` verlinkt
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint in der Gruppe „Planung" der Eintrag/die Kachel „Umsatzausgaben" (generisches Rendern zieht automatisch nach)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Wird die Seite mit unbekannter/fremder/ungültiger `versionId` aufgerufen, erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73-Versionskontext (über `LangfristigeVersionShell`)
- [ ] Es gibt **keine** Kennzahlen-Kacheln oberhalb der Tabelle

### Tabellenstruktur & Monatsspalten

- [ ] Die Spalten sind **Monate** (nicht Kalenderwochen)
- [ ] **Erste Spalte** = **Startmonat** (Startmonat/-jahr aus `langfristige_grundeinstellungen`) — **kein** Vorlaufmonat
- [ ] **Letzte Spalte** = Startmonat + (`Planungshorizont` − 1) Monate
- [ ] **Planungshorizont** = `planungshorizont_monate` (allgemeiner Horizont); Fallback wenn nicht gesetzt: 12
- [ ] Gesamtzahl der Monatsspalten = `Planungshorizont`
- [ ] Jede Monatsspalte ist eine **Soll-Spalte** (berechnet, manuell überschreibbar) — es gibt **keine** Vergangenheits-/Ist-Spalten
- [ ] Spaltenüberschriften zeigen Monat + Jahr (z. B. „Apr 2026"); optionale Jahres-Gruppierungszeile über den Monatsspalten (analog PROJ-84)
- [ ] Korrekte Berechnung über Jahresgrenzen hinweg (mehrjähriger Horizont)
- [ ] Die Tabelle ist horizontal scrollbar; die erste Spalte (Zeilenbeschriftung) ist beim horizontalen Scrollen sticky (links fixiert) mit opakem Hintergrund

### Zeilenhierarchie (gespiegelt aus PROJ-67)

- [ ] Zeilenquelle: globaler `ausgaben_kosten`-KPI-Baum mit den drei Hauptbereichen Produktausgaben, Vertriebsausgaben, Marketingausgaben (identische Filterlogik wie PROJ-67), in `sort_order`-Reihenfolge
- [ ] **Pro Level-1-Kategorie** (Produktausgaben, Vertriebsausgaben, Marketingausgaben): einklappbare Sektion (Standard: ausgeklappt) mit Kategorie-Header (Name + Toggle, zeigt Summe der Untergruppen, nicht editierbar)
- [ ] **Pro Level-2-Untergruppe** (z. B. Versandausgaben, Lagerausgaben, …): einklappbare Sektion (Standard: ausgeklappt) mit Untergruppen-Header (Name + Toggle, zeigt Summe der Produkte, nicht editierbar)
- [ ] **Pro Produkt**: editierbare Leaf-Zeile (eingerückt)
- [ ] **Ganz unten**: Gesamt-Zeile „Umsatzausgaben (Gesamt)" — summiert alle Leaf-Zeilen je Monat, nicht editierbar, immer sichtbar
- [ ] Aggregationen (Untergruppe, Gruppe, Gesamt) sind reaktiv: ändert sich ein Leaf-Wert, aktualisieren sich alle übergeordneten Summen sofort
- [ ] **Buttons oben rechts:** „Alle ausklappen" und „Alle einklappen" (zwei separate Buttons)

### Soll-Werte (berechnet) — allgemein

- [ ] Alle automatisch berechneten Zellen zeigen einen **grauen Indikatorpunkt**
- [ ] Manuell überschriebene Zellen zeigen einen **blauen Indikatorpunkt**
- [ ] Inline-Editing (click-to-edit), Speicherung onBlur in der versionsgebundenen Tabelle
- [ ] Dezimalzahl ≥ 0; negative Werte werden verworfen; leere/auf berechneten Wert zurückgesetzte Zelle = kein manueller Eintrag
- [ ] Optimistisches Update + Rollback bei API-Fehler (Toast)
- [ ] Nur Leaf-Zellen (Produkt-Ebene) sind editierbar; Aggregations- und Gesamt-Zellen sind nicht editierbar

### Produktausgaben (auto-berechnet)

- [ ] Quelle: alle **Bestellungen** der Langfristigen Bestellplanung dieser Version (PROJ-86) mit ihren **Bestellkosten** vollumfänglich
- [ ] Darstellung je Bestellkosten-Kategorie und je Produkt; Zeitbezug = Liefer-/Bestellmonat der Bestellung (auf ISO-Monat umgerechnet)
- [ ] Keine Zahlungsverschiebung für Produktausgaben

### Vertriebsausgaben — Versand/Lager/Retouren/Kulanz (auto-berechnet)

- [ ] **Versandausgaben** = Versandkosten (PROJ-78) × Absatz (PROJ-84)
- [ ] **Lagerausgaben** = Lagerkosten €/m³/Monat (PROJ-78) × **Bestand (Monatsende, nicht Absatz)** × M³-Volumen (PROJ-77); Bestand aus derselben Simulation wie das Lagerbestandsdiagramm (PROJ-86: Startbestand + Bestell-Zugänge − Absatz)
- [ ] **Retourenausgaben** = Retourenquote % (PROJ-78 Retouren-Allgemein) × Absatz × Retouren-Handlingkosten
- [ ] **Ersatzteile/Kulanz** = Kulanzquote × Absatz × (Kulanzproduktkosten + Kulanzversandkosten) (PROJ-78)
- [ ] Für alle vier: **Zahlungsverschiebung** gemäß Gruppierung (monatlich/quartalsweise) + Zahlungsziel (Tage) des jeweiligen Reiters (PROJ-78); **USt-Aufschlag** gemäß PROJ-83 (aufgeteilt → Untergruppe; sonst Gesamtebene Vertrieb)
- [ ] Absatzzahlen werden plattformübergreifend je Produkt summiert (PROJ-84)

### Vertriebsausgaben — Verkaufsgebühren (manuell)

- [ ] Keine automatische Vorberechnung — Zellen sind im Auto-Zustand leer (kein grauer Punkt)
- [ ] Zellen sind manuell editierbar; blauer Indikatorpunkt bei manueller Eingabe

### Marketingausgaben (auto-berechnet, gefiltert)

- [ ] Nur Marketingkanäle, die in den Auszahlungseinstellungen (PROJ-76) **keiner** Sales-Plattform zugeordnet sind, werden angezeigt
- [ ] Berechnung je Kanal × Produkt × Monat: Marketingkosten-% (PROJ-85) × Absatz × Effektiver VK (PROJ-84)
- [ ] **Zahlungsverschiebung** gemäß Gruppierung + Zahlungsziel je Marketingkanal (PROJ-80); **USt-Aufschlag** gemäß PROJ-83 (aufgeteilt → Kanal/Untergruppe; sonst Gesamtebene Marketing)

### Indikatorpunkte

| Zustand | Punkt | Gilt für |
|---|---|---|
| Automatisch berechnet (mit Wert) | Grauer Punkt | Alle auto-berechneten Soll-Zellen mit Wert |
| Manuell eingegeben/überschrieben | Blauer Punkt | Alle manuell überschriebenen Soll-Zellen |
| Leer / keine Berechnung | Kein Punkt | Zellen ohne Auto-Wert und ohne manuelle Eingabe (z. B. Verkaufsgebühren ohne Eingabe) |

### Einzelzelle-Reset & globaler Reset

- [ ] Ist genau **eine** Soll-Zelle selektiert/fokussiert, erscheint rechts unten ein Button „Auf automatisch zurücksetzen"; Klick löscht den manuellen Eintrag → Zelle zeigt wieder den berechneten Wert (grauer Punkt) bzw. wird leer (wenn kein Auto-Wert, z. B. Verkaufsgebühren)
- [ ] Button „Zurücksetzen" oben rechts mit Bestätigungs-Dialog (shadcn AlertDialog): löscht alle manuellen Einträge **dieser Version** + alle Notizen dieser Seite **dieser Version**; Zellen zeigen wieder berechnete Werte bzw. werden leer
- [ ] Verhalten analog PROJ-87 (Sales-Plattform-Planung — Langfristige)

### Zellen-Notizen (wie PROJ-53, versionsgebunden)

- [ ] Ist genau **eine** editierbare Zelle selektiert, erscheint ein Button „Notiz hinzufügen"/„Notiz bearbeiten"; nicht sichtbar bei keiner/mehrfacher/nicht-editierbarer Selektion
- [ ] Overlay mit Zellidentifikation (z. B. „Notiz — Produkt X · Versandausgaben · Apr 2026"), Textarea, „Speichern", „Abbrechen", (bei bestehender Notiz) „Notiz löschen"
- [ ] Zellen mit Notiz zeigen einen Indikator; Hover zeigt den Notiztext
- [ ] Notizen an die Zellkoordinate (Kategorie + Produkt + Monat/Jahr) gebunden; bleiben beim Verschieben des Monatsfensters erhalten
- [ ] Notizen werden **pro Planversion** und Seite (`seite = 'umsatzausgaben'`) über `langfristige_planung_notizen` gespeichert (keine neue Notiz-Tabelle)

### Betragsselektion (Hover/Klick-Summe, wie PROJ-40)

- [ ] Einzelne oder mehrere Zellwerte durch Klicken/Ctrl+Klicken selektierbar; Summe in einem Panel rechts unten (`data-betrag-selektion`)
- [ ] Panel erscheint ab 1 selektierter Zelle; nicht-editierbare Zellen (Aggregationen, Gesamt) ebenfalls selektierbar
- [ ] Verhalten identisch mit der bestehenden Betragsselektion (PROJ-40 / PROJ-87)

### Datenisolation (PROJ-73)

- [ ] Alle Lese-/Schreibzugriffe auf manuelle Werte und Notizen sind nach `versionId` **und** `user_id` gefiltert
- [ ] Eine neu angelegte Planversion zeigt eine vollständig berechnete, aber **ohne** manuelle Überschreibungen vorbelegte Umsatzausgaben-Seite (keine Übernahme manueller Werte aus anderen Versionen oder der Kurzfristigen Planung)
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B oder die Kurzfristige Planung
- [ ] Beim Löschen der Planversion werden alle manuellen Werte- und Notiz-Datensätze kaskadierend mitgelöscht (ON DELETE CASCADE)
- [ ] Die berechneten Werte beziehen ausschließlich Einstellungen/Pläne **dieser** Version (PROJ-75/76/77/78/80/83/84/85/86)

### Datenbankschema

- [ ] Neue Tabelle `langfristige_umsatzausgaben_planung` (nur manuelle Überschreibungen):
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `kategorie_id` UUID NOT NULL — globale KPI-Leaf-Untergruppe (kein FK, analog PROJ-88-Muster)
  - `produkt_id` UUID NOT NULL — Produkt der Version (`langfristige_kpi_kategorien`)
  - `jahr` INTEGER NOT NULL (CHECK 2000–2100), `monat` INTEGER NOT NULL (CHECK 1–12)
  - `betrag_manuell` NUMERIC(12,2) NULL — NULL = kein manueller Eintrag; CHECK ≥ 0 oder NULL
  - `created_at`/`updated_at`
  - UNIQUE(`plan_version_id`, `kategorie_id`, `produkt_id`, `jahr`, `monat`) → Upsert via `onConflict`
  - RLS: nur eigene Einträge (`auth.uid() = user_id`); Versionszugehörigkeit serverseitig zusätzlich geprüft
- [ ] Notizen nutzen die bestehende Tabelle `langfristige_planung_notizen` (`seite = 'umsatzausgaben'`) — keine neue Notiz-Tabelle nötig
- [ ] Auto-berechnete Werte werden **nicht** persistiert (stets server-seitig berechnet)

### API-Routen (versions- & nutzergebunden)

- [ ] `GET /api/langfristige-planung/[versionId]/umsatzausgaben` — alle manuellen Einträge der Version
- [ ] `PUT /api/langfristige-planung/[versionId]/umsatzausgaben` — Upsert je `(plan_version_id, kategorie_id, produkt_id, jahr, monat)`; `betrag_manuell: null` → Eintrag löschen
- [ ] `DELETE /api/langfristige-planung/[versionId]/umsatzausgaben` — alle manuellen Einträge der Version löschen (für globalen Reset)
- [ ] `GET /api/langfristige-planung/[versionId]/umsatzausgaben/berechnet` — alle auto-berechneten Soll-Werte je Kategorie/Untergruppe/Produkt/Monat (server-seitige Berechnung mit den Versions-Einstellungen)
- [ ] Notizen: bestehende Route `GET/PUT/DELETE /api/langfristige-planung/[versionId]/planung-notizen` mit `seite=umsatzausgaben` (keine neue Route)
- [ ] Alle Routen: `requireAuth()` + `ensureLangfristigeVersion()`, Zod-Validierung (UUIDs, `monat` 1–12, `jahr` 2000–2100, Werte ≥ 0 oder null), Filter nach `user_id` + `plan_version_id`; fremde/unbekannte `versionId` → 404

## Edge Cases

- **Keine Produkte/Plattformen/Marketingkanäle im KPI-Modell der Version:** leerer bzw. entsprechend leerer Zustand mit Hinweis + Link zur KPI-Modell-Verwaltung dieser Version
- **Keine Bestellungen in der Langfristigen Bestellplanung:** Produktausgaben-Zellen leer (keine 0)
- **Produkt ohne M³-Volumen (PROJ-77):** Lagerausgaben-Berechnung ergibt leer/0 — klarer Hinweis im Tooltip
- **Retourenquote/Kulanzquote = 0 oder nicht gepflegt:** zugehörige Zelle leer (kein 0)
- **Alle Marketingkanäle einer Plattform zugeordnet:** Marketingausgaben-Sektion leer mit Hinweis
- **Fälligkeitsmonat (nach Verschiebung) außerhalb des Horizonts:** berechneter Wert wird nicht angezeigt
- **Kein Absatz für ein Produkt in einem Monat:** zugehörige Vertriebs-/Marketingausgaben leer
- **USt-Satz nicht gepflegt:** Wert ohne Steuer-Aufschlag, kein Fehler
- **Planungshorizont nicht gesetzt:** Fallback 12 Monate
- **Grundeinstellungen der Version noch nicht gespeichert:** Standard-Startmonat (aktueller Monat/Jahr) + Default-Horizont (analog PROJ-75), kein Absturz
- **Jahresgrenze im Horizont und in der Quartals-Zahlungsverschiebung (Q4 → Januar Folgejahr):** korrekte Monats-/Jahresberechnung
- **Startmonat-Änderung in den Grundeinstellungen:** beim nächsten Laden verschiebt sich das Fenster; manuelle Werte/Notizen bleiben an ihrer Monat/Jahr-Koordinate erhalten und erscheinen nur, wenn die Koordinate im Fenster liegt
- **Einzelzelle-Reset für Verkaufsgebühren-Zelle (kein Auto-Wert):** Zelle wird leer, kein grauer Punkt
- **Globaler Reset ohne manuelle Werte:** idempotent (keine sichtbare Änderung)
- **Kategorie/Produkt im KPI-Modell gelöscht:** zugehörige manuelle Werte/Notizen werden nicht mehr angezeigt (verwaiste Einträge bleiben unschädlich; konsistent mit PROJ-88-Muster)
- **Sehr langer Horizont (z. B. 120 Monate):** horizontal scrollbar, Label-Spalte sticky, kein Layout-Bruch
- **API-Fehler bei Berechnung:** betroffene Zellen leer, kein Absturz, Toast-Hinweis
- **Aufruf mit fremder/unbekannter `versionId`:** Redirect zum Dashboard (PROJ-73), kein Datenzugriff

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen versionsgebundenen Tabelle; Versionszugehörigkeit serverseitig prüfen (`ensureLangfristigeVersion`, Defense-in-Depth zur RLS)
- Alle Eingaben serverseitig mit Zod validieren (UUIDs, Monat 1–12, Jahr 2000–2100, Werte ≥ 0 oder null)
- Neue versionsgebundene Next.js-Seite: `src/app/dashboard/langfristige-planung/[versionId]/umsatzausgaben/page.tsx` (nutzt `LangfristigeVersionShell` mit `seitenTitel="Umsatzausgaben"` und `fullWidth`)
- Navigation: neuer Eintrag „Umsatzausgaben" (Slug `umsatzausgaben`) in der Gruppe „Planung" in `src/lib/langfristige-planung-nav.ts`
- Zeilenquelle: globaler `ausgaben_kosten`-KPI-Baum über `GET /api/kpi-categories?type=ausgaben_kosten`; Filterlogik aus PROJ-67 (`use-umsatzausgaben.ts`) übernehmen
- Monatsfenster: aus Startmonat + Horizont ohne Vorlauf (`date-fns`); Monatsfenster-/Schlüssel-Helfer analog PROJ-88 (`buildOperativekostenMonate` ohne Vorlauf)
- Server-seitige `berechnet`-Route: spiegelt die Berechnungslogik von PROJ-67 (`umsatzausgaben-planung/berechnet`), parametriert mit den Versions-Einstellungen; Zahlungsverschiebung monatsbasiert nach PROJ-78/PROJ-80-Modell statt KW-Rhythmus
- Wiederverwendung: `LangfristigeVersionShell`, `ensureLangfristigeVersion`, Betragsselektion-Muster (`data-betrag-selektion`), `PlanungNotizFormular`, `useLangfristigePlanungNotizen(versionId, 'umsatzausgaben')`; berechnet-/manuell-Overlay-Logik analog PROJ-87
- shadcn/ui first: Table/Input/Dialog/Select/Popover/AlertDialog/Tooltip/Button/Card/Skeleton — alle vorhanden
- Kein neues npm-Paket nötig
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Vorschlag, Verfeinerung in /architecture)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/umsatzausgaben/page.tsx` | Seite: Versions-Shell + Tabelle |
| `src/components/langfristige-umsatzausgaben-tabelle.tsx` | Hauptkomponente: Monats-Matrix, Kategorie/Untergruppe/Produkt/Gesamt, Indikatorpunkte, Notizen, Betragsselektion, Einzelzelle-/globaler Reset, Ein-/Ausklappen |
| `src/hooks/use-langfristige-umsatzausgaben.ts` | Lädt Grundeinstellungen/KPI-Struktur/berechnete Werte/manuelle Overrides der Version; Monatsfenster; upsert/reset; Indikator-Logik |
| `src/app/api/langfristige-planung/[versionId]/umsatzausgaben/route.ts` | GET / PUT / DELETE (manuelle Einträge) |
| `src/app/api/langfristige-planung/[versionId]/umsatzausgaben/berechnet/route.ts` | GET: server-seitige Auto-Berechnung mit Versions-Einstellungen |
| DB-Migration `create_langfristige_umsatzausgaben_planung` | Neue Tabelle + RLS + Indizes |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Umsatzausgaben" (Slug `umsatzausgaben`) in der Gruppe „Planung" |

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Übernahme der hier geplanten Umsatzausgaben in eine spätere Langfristige Liquiditätsauswertung (eigene Spec, analog PROJ-72)
- Optionale Vereinheitlichung der monatsbasierten Zahlungsverschiebungs-Hilfsfunktionen über mehrere langfristige Berechnungs-Routen hinweg

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-22)

### Leitidee

Diese Seite ist die **Liquiditäts-Schwester** zweier bereits gebauter Seiten:

1. Sie übernimmt die **Kategorie- und Berechnungslogik** der kurzfristigen Umsatzausgaben-Seite (PROJ-67): dieselben drei Bereiche (Produktausgaben, Vertriebsausgaben, Marketingausgaben), dieselben Formeln, dieselbe Zahlungsverschiebung — nur monatsbasiert und mit den Einstellungen **dieser** Planversion.
2. Sie übernimmt das **Bedien- und Anzeigemodell** der langfristigen Sales-Plattform-Planung (PROJ-87): eine monatsbasierte, versionsgebundene Tabelle, in der jede Zelle automatisch **berechnet** (grauer Punkt) und **manuell überschreibbar** (blauer Punkt) ist, mit Einzelzelle-Reset, globalem Reset, Betragsselektion und Zellen-Notizen.

Der Kniff ist, dass es — anders als kurzfristig — **keine Ist-Daten** gibt (die Langfristige Planung kennt keine Transaktionen). Es entfallen daher die Vergangenheits-/Ist-Spalten vollständig; jede Monatsspalte ist eine reine **Soll-Spalte**. Gespeichert wird ausschließlich die **manuelle Überschreibung** je Zelle; alle automatischen Werte werden bei jedem Laden frisch berechnet.

Bewusst **kein Umbau** bestehender Seiten und **kein Neuerfinden**: Das Versions-Gerüst, der Versions-Sicherheits-Helfer, das Notiz-Overlay samt versionsbewusstem Notiz-Mechanismus und das Betragsselektion-Muster werden direkt mitgenutzt. Neu gebaut werden die Seite selbst, ihre Tabelle, ihr Daten-Hook, die zwei API-Routen (manuelle Werte + Berechnung) und eine Datenbanktabelle für die manuellen Werte.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                 (Versions-Übersicht — bestehend)
+-- Gruppe "Planung" erhält Eintrag/Kachel "Umsatzausgaben"  (zieht generisch nach)

/dashboard/langfristige-planung/[versionId]/umsatzausgaben   (NEUE Seite)
+-- LangfristigeVersionShell  (bestehend — prüft Version, Header/Redirect, Toaster; fullWidth)
    +-- LangfristigeUmsatzausgabenTabelle  (NEUE Hauptkomponente)
        +-- Leer-Zustand (wenn keine Produkte / keine Ausgaben-Kategorien)
        +-- Kopfbereich rechts: Buttons "Alle ausklappen" / "Alle einklappen" / "Zurücksetzen"
        +-- Scroll-Container (horizontal, Label-Spalte sticky links, opak)
        |   +-- Kopfzeile: [Label] | [Jan 2026] | [Feb 2026] | ...  (Monate; Jahres-Gruppierungszeile)
        |   +-- [Pro L1-Kategorie: Produktausgaben / Vertriebsausgaben / Marketingausgaben]
        |   |   +-- Kategorie-Header (einklappbar; Summe der Untergruppen, nicht editierbar)
        |   |   +-- [wenn ausgeklappt, pro L2-Untergruppe]
        |   |       +-- Untergruppen-Header (einklappbar; Summe der Produkte, nicht editierbar)
        |   |       +-- [pro Produkt] editierbare Leaf-Zeile (grau/blau Punkt)
        |   +-- Gesamt-Zeile "Umsatzausgaben (Gesamt)"   ← GANZ UNTEN (Summe aller Leafs)
        +-- PlanungNotizFormular            (WIEDERVERWENDET — Notiz-Overlay)
        +-- Betragsselektion-Summenpanel    (WIEDERVERWENDETES Muster, rechts unten)
        +-- Einzelzelle-Reset-Button        (rechts unten, wenn genau 1 manuell überschriebene Zelle fokussiert)
        +-- Zurücksetzen-Bestätigungsdialog (shadcn AlertDialog)
```

Das linke Seitenmenü und die Versions-Übersichtsseite rendern die Nav-Gruppen generisch — der neue Eintrag erscheint allein durch die Ergänzung in der zentralen Nav-Konfiguration.

### B) Datenmodell (Klartext)

Es entsteht **eine neue, versionsgebundene Tabelle** für die manuellen Überschreibungen. Notizen nutzen die **bereits bestehende** versionsgebundene Notiz-Tabelle (eingeführt mit PROJ-84) über das Feld „Seite".

**Neue Tabelle — „Langfristige Umsatzausgaben-Planung" (ein Eintrag je manuell überschriebener Zelle):**
```
Jeder Eintrag hat:
- eindeutige ID
- Besitzer (Nutzer)                        → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion → Isolation
- Verweis auf eine Ausgaben-Untergruppe (globales KPI-Modell, ohne harten Fremdschlüssel)
- Verweis auf ein Produkt der Version
- Monat (1–12) + Jahr
- Manueller Betrag (Dezimalzahl ≥ 0)
Eindeutigkeit: je (Planversion, Kategorie, Produkt, Jahr, Monat) genau ein Eintrag.
```

Wichtige, bewusste Eigenschaften (konsistent mit PROJ-87/88):
- **Nur manuelle Werte werden gespeichert.** Automatische Werte werden nie persistiert — ein vorhandener Eintrag bedeutet immer „manuell überschrieben" (blauer Punkt).
- Der Kategorie-Verweis zeigt auf das **globale** KPI-Modell (die Ausgaben-Kategoriestruktur ist nicht versionsspezifisch), ohne harten Fremdschlüssel; verschwindet eine Kategorie, wird ihr verwaister Wert einfach nicht mehr angezeigt.
- Der Produkt-Verweis zeigt auf die **versionseigenen** Produkte (KPI-Modell der Version).

**Notizen — bestehende Tabelle „Langfristige Planungs-Notizen" (wiederverwendet):** zusätzliche „Seite" = `umsatzausgaben`; Zellkoordinate = Kategorie + Produkt + Jahr + Monat. Keine neue Notiz-Tabelle, keine neue Notiz-Route.

**Regeln:** Jeder Datensatz ist an Nutzer + Planversion gebunden (Row Level Security + serverseitige Versionsprüfung). Beim Löschen der Planversion verschwinden alle manuellen Werte- und Notiz-Einträge automatisch mit. Fehlt ein manueller Eintrag, zeigt die Zelle den berechneten Wert (oder ist leer).

### C) Welche Spalten (Monate) werden gezeigt?

```
Aus den Grundeinstellungen der Version (PROJ-75):
  Startmonat (Monat + Jahr) und allgemeiner Planungshorizont (Monate); fehlt er → 12.

Erste Spalte  = Startmonat            (KEIN Vorlauf)
Letzte Spalte = Startmonat + (Planungshorizont − 1) Monate
Spaltenanzahl = Planungshorizont
```
Die Monatsabfolge wird sauber über Jahresgrenzen hinweg gebildet (gleicher Helfer-Stil wie die langfristige Operativekosten-Planung PROJ-88, die ebenfalls ohne Vorlauf startet). Manuelle Werte/Notizen hängen an ihrer Monat/Jahr-Koordinate; verschiebt der Nutzer später den Startmonat, erscheinen nur die Einträge, deren Koordinate im neuen Fenster liegt.

### D) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Shell prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Die Tabelle lädt parallel:
     ① Grundeinstellungen der Version          → Startmonat + Horizont (Monatsfenster)
     ② globales KPI-Modell (ausgaben_kosten)    → Kategorie-Hierarchie (3 Bereiche, Untergruppen)
     ③ Produkte der Version                     → Leaf-Zeilen je Untergruppe
     ④ berechnete Soll-Werte der Version        → /umsatzausgaben/berechnet (server-seitig)
     ⑤ gespeicherte manuelle Überschreibungen   → /umsatzausgaben (GET)
     ⑥ gespeicherte Notizen der Version (Seite "umsatzausgaben")
  → Anzeigewert je Zelle: manueller Wert (blauer Punkt) ELSE berechneter Wert (grauer Punkt) ELSE leer
  → Aggregation (frontend, reaktiv): Untergruppen-, Gruppen- und Gesamtsummen aus den Anzeigewerten

Nutzer bearbeitet eine Zelle (onBlur)
  → optimistische Anzeige + Speichern der einen manuellen Überschreibung; Fehler → Toast + Rücksetzen

Nutzer fokussiert genau 1 überschriebene Zelle → "Auf automatisch zurücksetzen"
  → manueller Eintrag wird gelöscht → Zelle zeigt wieder den berechneten Wert (oder leer)

Nutzer klickt "Zurücksetzen" (global) → Bestätigungsdialog
  → alle manuellen Werte + alle Notizen dieser Seite/Version werden gelöscht

Nutzer selektiert genau 1 editierbare Zelle → "Notiz hinzufügen/bearbeiten"
  → Notiz-Overlay; Speichern/Löschen schreibt in die bestehende Notiz-Tabelle

Betragsselektion: Klick/Ctrl+Klick auf Werte → laufende Summe rechts unten
```

### E) Server-seitige Berechnung — Route `/umsatzausgaben/berechnet`

Dies ist das Herzstück und die komplexeste Route. Sie spiegelt die kurzfristige `umsatzausgaben-planung/berechnet`-Logik (PROJ-67), parametriert mit den Einstellungen **dieser** Planversion, und liefert pro Kategorie/Untergruppe/Produkt/Monat einen Brutto-Wert (inkl. USt).

**Eingangsdaten (alle der Version, parallel geladen):**
```
- Grundeinstellungen        → Monatsfenster (PROJ-75)
- Absatz + Effektiver VK    → Mengen-/Preisbasis (PROJ-84)
- Vertriebseinstellungen    → Versand-, Lager-, Retouren-, Kulanz-Werte je Produkt
                              + je Bereich Gruppierung & Zahlungsziel (PROJ-78)
- Produktinformationen      → M³-Volumen je Produkt (PROJ-77)
- Marketing-Planung (%)     → Marketingkosten-% je Kanal × Produkt × Monat (PROJ-85)
- Marketing-Einstellungen   → Gruppierung & Zahlungsziel & Plattform-Zuordnung je Kanal (PROJ-80)
- Auszahlungseinstellungen  → Kanal→Plattform-Zuordnung für den Marketing-Filter (PROJ-76)
- Steuereinstellungen       → USt-Sätze + Pflegeebene (PROJ-83)
- Bestellplanung            → Bestellungen + Bestellkosten je Produkt (PROJ-86)
```

**Berechnung je Ausgabentyp** (je Produkt × Monat; Absatz plattformübergreifend summiert):
```
Versand    = Versandkosten × Absatz
Lager      = Lagerkosten(€/m³/Monat) × Bestand(Monatsende) × M³-Volumen
Retouren   = Retourenquote% × Absatz × Retouren-Handlingkosten
Kulanz     = Kulanzquote × Absatz × (Kulanzproduktkosten + Kulanzversandkosten)
Marketing  = Marketingkosten% × Absatz × Effektiver VK     (nur Kanäle OHNE Plattform-Zuordnung)
Produktausgaben = Bestellkosten je Kategorie direkt aus den Bestellungen
Verkaufsgebühren = — (nicht berechnet; nur manuell)
```

**Gemeinsame Zahlungsverschiebung (NEU, monatsbasiert) — gilt für alle Vertriebsausgaben + Marketing:**
```
1. Rohwert je Produkt × Quellmonat berechnen.
2. Fälligkeitsmonat aus der Gruppierung des Bereichs/Kanals (PROJ-78/80):
     monatlich      → Anfang des Folgemonats
     quartalsweise  → Anfang des Folgemonats des Quartals (Q1→Apr, Q2→Jul, Q3→Okt, Q4→Jan Folgejahr)
   Das Zahlungsziel (Tage) verschiebt diesen Termin zusätzlich nach hinten (auf Monatsebene abgebildet).
3. Alle Rohwerte mit gleichem Fälligkeitsmonat je Produkt summieren.
4. USt aufschlagen: Pflegeebene "aufgeteilt" → Satz je Untergruppe; sonst Gesamtebene der Gruppe;
   kein Satz gepflegt → 0 %.
Fälligkeitsmonat außerhalb des Horizonts → Wert wird nicht ausgewiesen.
```
**Produktausgaben-Sonderfall:** keine Verschiebung; Zeitbezug = Liefer-/Bestellmonat der Bestellung. Jede Bestellkosten-Position wird ihrer KPI-Kategorie und ihrem Produkt zugeordnet.

> **Wichtige Architektur-Entscheidung:** Die monatsbasierte „Folgemonat/Quartal + Zahlungsziel-Tage"-Verschiebung ist **bislang in keiner Route implementiert** (PROJ-89 nutzt das andere Auszahlungs-Modell mit Rhythmus + Ankermonat). PROJ-91 ist der **erste Konsument** der in PROJ-78/80 gepflegten Gruppierung+Zahlungsziel. Diese Verschiebung wird daher als **kleiner, gut testbarer Helfer** gebaut (Eingabe: Quellmonat, Gruppierung, Zahlungsziel-Tage → Fälligkeitsmonat) und kann später von weiteren Liquiditäts-Routen mitgenutzt werden.

**Antwortformat (Klartext):** eine Liste von Einträgen mit Typ/Untergruppe-Kategorie, Produkt, Jahr, Monat und Brutto-Wert. Aggregationen (Untergruppe/Gruppe/Gesamt) macht das Frontend.

### F) Server-Schnittstellen (versions- & nutzergebunden)

Alle Endpunkte folgen exakt dem etablierten Muster (Login-Pflicht via `requireAuth`, Versions-Eigentums-Prüfung via `ensureLangfristigeVersion`, Filterung nach Nutzer **und** Version als zweite Sicherheitsebene zur RLS, Zod-Eingabeprüfung, `dynamic = 'force-dynamic'`). Fremde/unbekannte Version → 404.
```
Manuelle Werte (NEU):
  Lesen     – alle manuellen Überschreibungen der Version
  Speichern – eine Zelle anlegen/aktualisieren (Kategorie, Produkt, Jahr, Monat, Betrag);
              Betrag = null löscht den Eintrag (= einzelnes Zurücksetzen)
  Löschen   – alle manuellen Werte der Version + alle Notizen dieser Seite (globaler Reset)

Berechnung (NEU, nur Lesen):
  Lesen     – alle automatisch berechneten Soll-Werte der Version

Notizen (BESTEHENDE Route wiederverwenden, Seite "umsatzausgaben"):
  Lesen / Speichern / Löschen – je Zelle
```
Diese GET/PUT/DELETE-Struktur ist 1:1 das Muster der Sales-Plattform-Planungs-Route (PROJ-87), nur ohne `sales_plattform_id` und mit `kategorie_id`/`produkt_id` als Koordinaten.

### G) Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/umsatzausgaben/page.tsx` | Seite: Versions-Shell + Tabelle |
| `src/components/langfristige-umsatzausgaben-tabelle.tsx` | Hauptkomponente: Monats-Matrix, Kategorie/Untergruppe/Produkt/Gesamt, grau/blau-Punkte, Notizen, Betragsselektion, Einzelzelle-/globaler Reset, Ein-/Ausklappen |
| `src/hooks/use-langfristige-umsatzausgaben.ts` | Lädt Grundeinstellungen/KPI-Struktur/Produkte/berechnete Werte/manuelle Werte/Notizen; Monatsfenster; Anzeige-/Indikator-Logik; upsert/Einzelreset/globaler Reset |
| `src/app/api/langfristige-planung/[versionId]/umsatzausgaben/route.ts` | GET / PUT / DELETE (manuelle Werte; Muster aus PROJ-87) |
| `src/app/api/langfristige-planung/[versionId]/umsatzausgaben/berechnet/route.ts` | GET: server-seitige Auto-Berechnung mit Versions-Einstellungen (inkl. monatsbasierter Zahlungsverschiebung) |
| DB-Migration `create_langfristige_umsatzausgaben_planung` | Neue Tabelle + RLS (4 Policies) + Indizes |

### H) Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Umsatzausgaben" (Slug `umsatzausgaben`) in der Gruppe „Planung" |

### I) Wiederverwendung im Detail

| Baustein | Status | Anmerkung |
|---|---|---|
| Versions-Gerüst (`LangfristigeVersionShell`) | **unverändert wiederverwenden** | Versionsprüfung, Header, Redirect, Toaster, `fullWidth` |
| Versions-Sicherheits-Helfer (`ensureLangfristigeVersion`) | **unverändert wiederverwenden** | in beiden neuen Routen |
| Manuelle-Werte-Route-Muster (GET/PUT/DELETE) | **spiegeln von PROJ-87** | `…/sales-plattform-planung/route.ts` als Vorlage |
| berechnet+manuell-Overlay-/Indikator-Logik | **spiegeln von PROJ-87** | Hook `use-langfristige-sales-plattform-planung.ts` |
| Kategorie-Filter (3 Ausgaben-Bereiche, Untergruppen) | **Logik aus PROJ-67 übernehmen** | aus `use-umsatzausgaben.ts` |
| Berechnungsformeln je Ausgabentyp + USt-Auflösung | **Logik aus PROJ-67 übernehmen** | aus `umsatzausgaben-planung/berechnet` |
| Monatsfenster ohne Vorlauf | **Muster aus PROJ-88** | `buildOperativekostenMonate`-Stil |
| Monatsbasierte Zahlungsverschiebung (Folgemonat/Quartal + Zahlungsziel) | **NEU (kleiner Helfer)** | erster Konsument von PROJ-78/80; testbar, später wiederverwendbar |
| Notiz-Overlay + versionsbewusster Notiz-Hook + Notiz-Route/-Tabelle | **unverändert wiederverwenden** | `useLangfristigePlanungNotizen(versionId, 'umsatzausgaben')` |
| Betragsselektion-Summenpanel | **Muster wiederverwenden** | identisch zu PROJ-40/87 (`data-betrag-selektion`) |
| Haupttabelle + 2 Routen + 1 Tabelle | **Neubau** | monatsbasiert, kategorie-hierarchisch, berechnet+manuell, versionsgebunden |

### J) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Eigene Seite/Tabelle/Hook statt Generalisierung | Fokussierter Neubau (gespiegelt) | Andere Zeitachse (Monate), keine Ist-Spalten, andere Zeilenquelle als PROJ-87 — Verallgemeinerung brächte mehr Regressionsrisiko als Nutzen |
| Nur manuelle Werte speichern, Auto-Werte stets berechnen | Ja (wie PROJ-87) | „Eintrag vorhanden = manuell überschrieben" hält die Indikator-Logik einfach und vermeidet veraltete persistierte Berechnungen |
| Keine Ist-/Vergangenheitsspalten | Ja (laut Anforderung) | Langfristige Planung kennt keine Transaktionen; jede Spalte ist Soll |
| Liquiditätssicht mit Zahlungsverschiebung | Ja (vom Nutzer bestätigt) | Spiegelt PROJ-67; nutzt die in PROJ-78/80 gepflegte monats-/quartalsbasierte Zahlungslogik |
| Monats-Zahlungsverschiebung als eigener Helfer | Ja | Erster Konsument dieser Logik; klein, testbar, später für weitere Liquiditäts-Routen nutzbar |
| Verkaufsgebühren rein manuell | Ja (vom Nutzer bestätigt) | 1:1 zu PROJ-67; die berechnete Verkaufsgebühr lebt in der Sales-Plattform-Planung (PROJ-87) |
| Kein Bulk-Edit | Ja (vom Nutzer bestätigt) | PROJ-67 hatte keines; Betragsselektion + Notizen genügen |
| Globale Kategoriestruktur, versionsgebundene Werte | Ja | Ausgaben-Kategorien sind nicht versionsspezifisch; nur Werte/Notizen je Szenario isoliert (konsistent mit PROJ-88) |
| Notiz-Tabelle & -Route wiederverwenden | Ja | Bereits seitenübergreifend ausgelegt; kein Doppelbau, automatisch versions-isoliert |
| Datenhaltung in der Datenbank, pro Version | Ja | Szenario-Isolation und Dauerhaftigkeit (PROJ-73-Prinzip); kein localStorage |

### K) Dependencies (Pakete)

Keine neuen npm-Pakete nötig. Verwendet werden bestehende Bausteine: `date-fns` (Monatsrechnung, bereits installiert), shadcn/ui (Table, Input, Select, Dialog, AlertDialog, Popover, Tooltip, Button, Card, Skeleton — alle vorhanden), Zod (Eingabeprüfung), Supabase (Datenhaltung inkl. Row Level Security), Next.js App-Router (dynamisches Versions-Segment) sowie die wiederverwendeten Projekt-Komponenten (Versions-Shell, Notiz-Overlay, versionsbewusster Notiz-Hook, Betragsselektion-Muster).

### L) Umsetzungsreihenfolge (empfohlen)

1. Nav-Eintrag „Umsatzausgaben" in der zentralen Nav-Konfiguration (macht Seite/Übersicht sichtbar).
2. Neue versionsgebundene Werte-Tabelle + manuelle-Werte-Route (GET/PUT/DELETE; Muster aus PROJ-87).
3. Berechnungs-Route (`berechnet`) inkl. monatsbasiertem Zahlungsverschiebungs-Helfer; spiegelt die PROJ-67-Formeln mit Versions-Einstellungen.
4. Daten-Hook: Monatsfenster + KPI-Struktur + Produkte + berechnete/manuelle Werte + Notizen laden, Anzeige-/Indikator-Logik, Auto-Save/Reset.
5. Haupttabelle (Monats-Matrix, Aggregation, Selektion, grau/blau-Punkte) + Notiz-Overlay + Betragsselektion; Seite ins Versions-Gerüst einbetten.

> Hinweis: Schritt 3 ist der aufwändigste (komplexe Berechnung + neuer Verschiebungs-Helfer). Schritte 1–2 liefern Navigation und Datenfundament; Schritte 4–5 verdrahten überwiegend vorhandene Bausteine mit der neuen Monats-/Kategorie-Logik.

## Implementation Notes (Frontend — 2026-06-22)

### Neue Dateien
- `src/hooks/use-langfristige-umsatzausgaben.ts` — versionsbewusster Daten-Hook. Lädt parallel: Grundeinstellungen (Startmonat + allgemeiner `planungshorizont_monate`, Fallback 12), das **globale** `ausgaben_kosten`-KPI-Modell (`/api/kpi-categories?type=ausgaben_kosten`), die **Produkte der Version** (`/api/langfristige-planung/[versionId]/kpi-kategorien?art=lp_produkt`), die gespeicherten **manuellen Werte** (`…/umsatzausgaben`) und die **berechneten Soll-Werte** (`…/umsatzausgaben/berechnet`). Monatsfenster `buildUmsatzausgabenMonate`: erste Spalte = **exakt Startmonat, kein Vorlauf**, insgesamt `horizont` Monate, Jahresgrenzen korrekt. Selektoren `getManuellerWert`/`getBerechneterWert`/`isManuelleOverride`, Auto-Save `upsertZelle` (optimistisch + Rollback), `resetAll`. `katIdsWithProducts` (L2s mit berechneten/manuellen Daten) und `unassignedMarketingL2Ids` (aus `berechnet`-Antwort) steuern die Anzeige. Schlüssel `wertKey` = `${kategorieId}:${produktId}:${jahr}:${monat}`. **Keine** Persistenz von Auto-Werten — ein Eintrag = manuell = blauer Punkt.
- `src/components/langfristige-umsatzausgaben-tabelle.tsx` — Hauptkomponente. Flache Zeilenliste: L1-Kategorie-Header (einklappbar, Summe der Leafs) → L2-Untergruppen-Header (einklappbar, Summe der Produkte) → Produkt-Leaf (editierbar, grau/blau-Punkt) → **Gesamt-Zeile „Umsatzausgaben (Gesamt)" ganz unten**. Marketing-Filter über `unassignedMarketingL2Ids` (nur Untergruppen ohne Plattform-Zuordnung). **Vollständige Matrix:** unter jeder Untergruppe erscheint **jedes** Produkt der Version (so sind auch rein manuelle Zeilen wie Verkaufsgebühren editierbar — **kein „Produkt hinzufügen"-Button** auf Nutzerwunsch entfernt). Monatsspalten als Soll, Inline-Editing mit onBlur-Auto-Save, Mehrfachselektion (Ctrl+Klick), **Betragsselektion-Summenpanel** (`data-betrag-selektion`), **Einzelzelle-Reset** („Auf automatisch zurücksetzen" für selektierte manuelle Zellen), **globaler Reset** (AlertDialog), **Notiz-Overlay** + Zellindikator, **„Alle ein-/ausklappen"**. Label-Spalte sticky mit opakem Hintergrund. **Kein** Vorlauf, **keine** Ist-/Vergangenheitsspalten, **kein** Bulk-Edit.
- `src/app/dashboard/langfristige-planung/[versionId]/umsatzausgaben/page.tsx` — echte Seite: `LangfristigeVersionShell` (`seitenTitel="Umsatzausgaben"`, `fullWidth`) + Tabelle.

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — neuer Eintrag „Umsatzausgaben" (Slug `umsatzausgaben`) in der Gruppe „Planung" (nach „Einnahmenplanung", analog der PROJ-67-Platzierung). NavSheet + Versions-Übersicht ziehen generisch nach.

### Wiederverwendet (unverändert)
- `LangfristigeVersionShell` (Versionsprüfung/Header/Redirect/Toaster), `PlanungNotizFormular` (Notiz-Overlay), `useLangfristigePlanungNotizen(versionId, 'umsatzausgaben')` (versionsgebundene Notizen, bestehende Tabelle/Route, Seitenfeld), Betragsselektion-Muster, shadcn/ui-Primitives. Kategorie-Hierarchie-/Filterlogik gespiegelt aus `use-umsatzausgaben.ts` + `umsatzausgaben-tabelle.tsx` (PROJ-67); berechnet/manuell-Bedienmodell gespiegelt aus der langfristigen Sales-Plattform-Planung (PROJ-87).

### Erwartete API (für /backend)
Alle Endpunkte versions- & nutzergesichert (`requireAuth` + `ensureLangfristigeVersion`); fremde/unbekannte `versionId` → 404. Muster 1:1 aus `…/sales-plattform-planung/route.ts`.
- `GET /api/langfristige-planung/[versionId]/umsatzausgaben` → `Array<{ kategorie_id, produkt_id, jahr, monat, betrag_manuell }>` (alle manuellen Einträge der Version).
- `PUT /api/langfristige-planung/[versionId]/umsatzausgaben` `{ kategorie_id, produkt_id, jahr, monat, betrag_manuell? }` — Upsert je `(plan_version_id, kategorie_id, produkt_id, jahr, monat)`; `betrag_manuell: null` löscht den Eintrag (= Einzelzelle-Reset). Zod: UUIDs, `jahr` 2000–2100, `monat` 1–12, Betrag ≥ 0 oder null.
- `DELETE /api/langfristige-planung/[versionId]/umsatzausgaben` — alle manuellen Einträge der Version löschen (globaler Reset); zusätzlich Notizen `seite='umsatzausgaben'` mitlöschen (serverseitig, wie PROJ-87).
- `GET /api/langfristige-planung/[versionId]/umsatzausgaben/berechnet` → `{ data: Array<{ kategorie_id, produkt_id, jahr, monat, wert }>, unassigned_marketing_kat_ids: string[] }`. Server-seitige Auto-Berechnung mit den Versions-Einstellungen (PROJ-75/76/77/78/80/83/84/85/86), inkl. **monatsbasierter Zahlungsverschiebung** (Folgemonat/Quartal + Zahlungsziel-Tage). Akzeptiert auch eine reine Array-Antwort (dann ohne Marketing-Filter). Mirror der kurzfristigen `umsatzausgaben-planung/berechnet`-Formeln.

Vorgeschlagene Tabelle: `langfristige_umsatzausgaben_planung` (`id`, `user_id`, `plan_version_id` → `langfristige_planversionen` ON DELETE CASCADE, `kategorie_id` UUID **ohne FK** (globales KPI-Modell), `produkt_id` UUID, `jahr`, `monat` CHECK 1–12, `betrag_manuell` NUMERIC(12,2) nullable CHECK ≥ 0, Zeitstempel), UNIQUE `(plan_version_id, kategorie_id, produkt_id, jahr, monat)`, RLS analog `langfristige_sales_plattform_planung`.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen/geänderten Dateien.
- Hinweis: Bis die API-Routen (`/backend`) existieren, zeigt die Tabelle den leeren Zustand bzw. Lade-Fehlerzustand (kein Absturz); das Versions-Gerüst lädt über die bestehende PROJ-73-API.

### Anpassung nach Backend-Klärung (Marketing-Dimension)
- Die langfristige Marketing-Planung ist je **versionsgebundenem Marketingkanal** (`lp_marketingkanal`) gekeyt, nicht je globaler Marketing-L2-Kategorie. Daher rendert die Tabelle die Marketing-Untergruppen aus den **Versions-Marketingkanälen** (gefiltert auf die ohne Sales-Plattform-Zuordnung), während Produktausgaben + Vertriebsausgaben weiterhin aus dem globalen KPI-Baum kommen. Hook lädt dafür zusätzlich `?art=lp_marketingkanal` (→ `marketingKanalNamen`); die Tabelle nutzt einen `getSubgroups(l1)`-Helfer (Marketing → Kanäle, sonst globale L2s).

## Implementation Notes (Backend — 2026-06-22)

### Datenbank (Supabase-Projekt „Controlling-App", Migration `create_langfristige_umsatzausgaben_planung`)
- Neue Tabelle **`langfristige_umsatzausgaben_planung`** (nur manuelle Überschreibungen): `id`, `user_id` → `auth.users` (ON DELETE CASCADE), `plan_version_id` → `langfristige_planversionen` (ON DELETE CASCADE), `kategorie_id` UUID **ohne FK** (globale Ausgaben-L2 ODER versionsgebundener Marketingkanal — analog Notiz-/PROJ-88-Muster), `produkt_id` UUID, `jahr` (CHECK 2000–2100), `monat` (CHECK 1–12), `betrag_manuell` NUMERIC(12,2) nullable (CHECK ≥ 0 oder NULL), Zeitstempel. UNIQUE `(plan_version_id, kategorie_id, produkt_id, jahr, monat)` → Upsert via `onConflict`.
- RLS aktiviert mit 4 Policies (`auth.uid() = user_id` für SELECT/INSERT/UPDATE/DELETE). Indizes: `(user_id)`, `(plan_version_id)`, `(plan_version_id, kategorie_id, produkt_id)`.
- `get_advisors` (security): **keine** neue Warnung für die neue Tabelle (verbleibende Warnungen betreffen ausschließlich vorbestehende Tabellen + die globale Auth-Einstellung).

### API-Routen (versions- & nutzergesichert; fremde/unbekannte `versionId` → 404 via `ensureLangfristigeVersion`)
- `src/app/api/langfristige-planung/[versionId]/umsatzausgaben/route.ts` — `GET` (alle manuellen Werte, max 20000) / `PUT` (Einzelzelle-Upsert; `betrag_manuell=null` löscht → Einzelzelle-Reset) / `DELETE` (alle manuellen Werte + Notizen `seite='umsatzausgaben'` → globaler Reset). Muster 1:1 aus PROJ-87. Zod: UUIDs, `jahr` 2000–2100, `monat` 1–12, Betrag ≥ 0 oder null. `dynamic = 'force-dynamic'`.
- `src/app/api/langfristige-planung/[versionId]/umsatzausgaben/berechnet/route.ts` — `GET`: server-seitige Auto-Berechnung. Lädt parallel Grundeinstellungen + globales KPI-Modell, dann 19 Versions-Tabellen (Produkte, Marketingkanäle, Absatz, Versand/Lager/Kulanz-Werte + deren Gruppierung, Retouren-Allgemein, Containerkapazität/M³, Marketing-Planung/-Einstellungen, Auszahlungs-Marketingkanäle, USt-Sätze/-Ebene, Bestellungen + Bestellkosten). Spiegelt die PROJ-67-Formeln (Versand/Lager/Retouren/Kulanz/Marketing/Produktausgaben) mit Versions-Einstellungen. Antwort `{ data: [{kategorie_id, produkt_id, jahr, monat, wert}], unassigned_marketing_kat_ids }`.

### Neuer Zahlungsverschiebungs-Helfer (monatsbasiert)
- `shiftToPaymentMonth(jahr, monat, gruppierung, zahlungsziel_tage)` — **monatlich** → Folgemonat; **quartalsweise** → Anfang Folgemonat des Quartals (Q1→Apr, Q2→Jul, Q3→Okt, Q4→Jan FJ); Zahlungsziel (Tage) zusätzlich `ceil(Tage/30)` Monate. Werte mit Fälligkeitsmonat außerhalb des Horizonts werden verworfen. Erster Konsument von PROJ-78/80; bewusst lokal gehalten (später extrahierbar).

### Bewusste Design-Entscheidungen
- **Gruppierung Vertrieb (versand/lager/kulanz)** ist in PROJ-78 plattformgebunden; die Umsatzausgaben-Zeile ist jedoch plattformübergreifend je Produkt. Es wird deterministisch der **erste** vorhandene Gruppierungs-Eintrag je Bereich verwendet (Default `monatlich`). Retouren-Allgemein ist versionsweit (eindeutig).
- **Lager** = `Lagerkosten(€/m³/Monat) × Bestand(Monatsende) × M³-Volumen`. Der Bestand stammt aus derselben Simulation wie das Lagerbestandsdiagramm: `computeLagerbestandVerlauf` (PROJ-86) mit `ladeVersionsDaten` (Startbestand + Bestell-Zugänge) und dem Monatsabsatz; verwendet wird `bestand_nachher` (Monatsende). **Nicht** absatzbasiert. Die Lager-Berechnung läuft unabhängig vom Monatsabsatz (auch in Monaten ohne Absatz). Korrektur 2026-06-22 nach Nutzerhinweis.

### Vorlaufmonate als Quelle (Startmonat-Befüllung, 2026-06-22)
- **Problem:** Durch die Zahlungsverschiebung speist sich jeder Fälligkeitsmonat aus einem früheren Quellmonat. Der **Startmonat** blieb daher bei den verschobenen Kategorien (Versand/Lager/Retouren/Kulanz/Marketing) leer, weil sein Quellmonat vor dem Planungsstart liegt.
- **Fix (vom Nutzer gewählt):** Der Rechenlauf betrachtet nun **Quellmonate vor dem Startmonat** — so weit die maximale Verschiebung reicht. `lookback = max` über alle Bereiche/Kanäle von `(quartalsweise ? 3 : 1) + ceil(Zahlungsziel_Tage/30)` Monaten (gedeckelt auf 12). Iteriert werden Quellmonate `[Startmonat − lookback … Fensterende]`; ausgewiesen werden nur Fälligkeiten **innerhalb** des Fensters (`addWert` prüft `monatSet`).
- **Datenladung:** Absatz- und Marketing-Planung werden ohne Jahresfilter geladen (Vorlaufjahre inklusive).
- **Bestand für Vorlaufmonate:** Die In-Fenster-Bestände bleiben unverändert (Vorwärtssimulation ab Startmonat). Für die Vorlaufmonate wird der Bestand **rückprojiziert** (Monatsende-Bestand des Vormonats = Opening des Startmonats = `aktueller_bestand`; Monat für Monat rückwärts mit Absatz/Zugang), sodass die bereits validierten In-Fenster-Werte nicht verändert werden.
- Display: Es gibt weiterhin **keine** Vorlauf-Spalten; nur die Berechnung blickt zurück.
- **Retourenquote** = manuell gepflegter Vertriebs-Wert (PROJ-78), nicht aus Transaktionen.
- **Marketing** = nur Kanäle ohne Eintrag in `langfristige_auszahlungs_marketingkanaele`; Basis = Bruttoumsatz (Absatz × VK) der zugeordneten Plattform bzw. Summe aller Plattformen.
- **Produktausgaben** aus `langfristige_bestellungen_kosten` (je Bestellung → `produkt_id` direkt; Zeitbezug `datum ?? ankunftsdatum ?? verfuegbarkeitsdatum ?? bestelldatum`); keine Verschiebung. **Die berechnet-Route generiert die Bestellkosten der Version vorab selbst** (`generiereUndSpeichereLangfristigeBestellkosten`, wie die Bestellkosten-Route), damit die Gruppe „Produkt"/Produktausgaben auch erscheint, ohne dass der Nutzer zuvor jede Bestellung-Kosten-Ansicht öffnen musste. Fehlschlag der Generierung wird abgefangen (kein Absturz; vorhandene Kosten werden genutzt).
- **Erstbestellungen ausgeschlossen:** Bestellungen mit `ist_erstbestellung = true` werden in den Umsatzausgaben **nicht** berücksichtigt (weder Kostengenerierung noch Summierung) — sie gehören in die Investitionsausgaben Planung („Produktinvestitionen Einkauf"). Filterung beim Laden der Bestellungen; deren Bestellkosten werden beim Aufsummieren übersprungen (Bestellung nicht in der Map).
- **Sichtbarkeit „Produkt":** Die L1-Kategorie heißt im KPI-Modell **„Produkt"** (Untergruppen Ware, Inspektion, Shipping, Zoll, Einlagerung, Wertverlust Ware) und wird — wie kurzfristig — nur eingeblendet, wenn mindestens eine ihrer Untergruppen berechnete Bestellkosten-Daten hat (Vertrieb/Marketing sind immer sichtbar).
- USt-Aufschlag identisch zu PROJ-67/87 (`getUstMultiplier`: Ebene aufgeteilt → L2, sonst Gesamtebene L1).

### Tests
- `…/umsatzausgaben/route.test.ts` — **15 Tests** (GET/PUT/DELETE: 200/[]/404/400/401/500, Einzel-Upsert, null=löschen, betrag=0, Validierungsfälle).
- `…/umsatzausgaben/berechnet/route.test.ts` — **7 Tests** (401/400/404/500, leeres Ergebnis + unassigned channels, Versand mit Monatsverschiebung Jan→Feb, Produktausgaben aus Bestellkosten ohne Verschiebung).
- **22/22 grün.** Gesamte `langfristige-planung`-API-Suite: **497/497 grün** (50 Dateien, keine Regression). `npx tsc --noEmit`: keine Fehler in neuen/geänderten Dateien.

### Frontend-Anbindung
- Keine weiteren Änderungen nötig: Hook `useLangfristigeUmsatzausgaben` ruft exakt diese Endpunkte/Datenformate auf. Das Feature ist im Browser lauffähig (sofern Stammdaten/Einstellungen der Version gepflegt sind).

## QA Test Results

**Getestet:** 2026-06-22 · **Methode:** Code-Audit aller Akzeptanzkriterien + Vitest (API + reine Logik) + Playwright (Route/Auth/Regression) + Datenabgleich gegen die Live-Version „Testversion1". Berechnungs-/Interaktionsdetails (Zahlungsverschiebung, USt, Bestandssimulation, Erstbestellungs-Ausschluss, Vorlaufmonate, Inline-Edit, Selektion, Notizen, grau/blau-Punkte) sind code- + datengeprüft — analog zum Vorgehen bei PROJ-84/87/88 (versionsgebundene Seiten ohne automatisierte Login-Session in E2E).

### Testergebnis-Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| Akzeptanzkriterien | ✅ Alle erfüllt (Code-Review + automatisiert + Datenabgleich) |
| API-Integrationstests (Vitest) | ✅ 30/30 (`umsatzausgaben/route.test.ts` 20 + `berechnet/route.test.ts` 10) |
| Logik-Unit-Tests (Vitest) | ✅ 8/8 (`use-langfristige-umsatzausgaben.test.ts` — Monatsfenster + Schlüssel) |
| E2E-Tests (Playwright) | ✅ 10/10 (5 × Chromium + Mobile Safari) |
| Sicherheitsaudit (Red Team) | ✅ Keine Findings |
| Regression | ✅ Keine durch PROJ-91 verursacht (langfristige-API-Suite vollständig grün) |
| Bugs | ✅ Keine Critical/High/Medium · 4 Low-Beobachtungen |

### Akzeptanzkriterien — geprüft

**Navigation & Einstieg**
- ✅ Nav-Eintrag „Umsatzausgaben" (Slug `umsatzausgaben`) in Gruppe „Planung" (`langfristige-planung-nav.ts`); NavSheet + Versions-Übersicht ziehen generisch nach
- ✅ Auth-Guard → Redirect `/login` (E2E, Chromium + Mobile Safari)
- ✅ Fremde/unbekannte `versionId` → 404 (`ensureLangfristigeVersion`) bzw. Redirect via Shell
- ✅ Keine Kennzahlen-Kacheln; Seite in `LangfristigeVersionShell` (`fullWidth`)

**Tabellenstruktur & Monatsspalten**
- ✅ Monatsspalten, Start exakt im Startmonat, Gesamtzahl = Planungshorizont (Unit-Tests `buildUmsatzausgabenMonate`), Fallback 12
- ✅ Jahresgrenzen korrekt; Jahres-Gruppierung; horizontal scrollbar; Label-Spalte sticky/opak
- ✅ Jede Spalte = Soll (berechnet + manuell); keine Ist-/Vergangenheitsspalten

**Zeilenhierarchie**
- ✅ L1 (Produkt/Vertrieb/Marketing) → L2 → Produkt-Leaf → Gesamt-Zeile „Umsatzausgaben (Gesamt)" unten; `sort_order`; reaktive Aggregation
- ✅ Vollständige Matrix (jedes Produkt unter jeder Untergruppe); kein „Produkt hinzufügen" (entfernt)
- ✅ Marketing-Untergruppen = versionsgebundene Marketingkanäle **ohne** Sales-Plattform-Zuordnung (gegen Live-Daten bestätigt: „Amazon Ads" ist zugeordnet → korrekt ausgeblendet)
- ✅ „Alle ein-/ausklappen"

**Berechnung (Datenabgleich Testversion1, FlexiCo)**
- ✅ Versand = Versandkosten × Absatz; Retouren = Quote% × Absatz × Handling; Kulanz = Quote × Absatz × (Produkt+Versand); je + Zahlungsverschiebung + USt
- ✅ **Lager = Lagerkosten(€/m³/Monat) × Bestand(Monatsende) × M³** (Bestandssimulation wie Lagerbestandsdiagramm) — Korrektur nach Nutzerhinweis, verifiziert (Juli 1.196 × 0,625 = 747,50 €)
- ✅ Produktausgaben aus Bestellkosten (Liefer-/Bestellmonat, keine Verschiebung); **Erstbestellungen ausgeschlossen** (Live: FlexiBu-Erstbestellung korrekt ignoriert)
- ✅ Marketing = %-Satz × Absatz × VK (nur nicht-zugeordnete Kanäle) + Verschiebung + USt
- ✅ Monatsbasierte Zahlungsverschiebung (monatlich → Folgemonat; quartalsweise → Folgemonat des Quartals; + Zahlungsziel-Tage)
- ✅ USt-Aufschlag aus `langfristige_ust_kategorie_saetze` + `…_ebene_auswahl` (aufgeteilt → L2-Satz, sonst Gesamt-L1; kein Satz → 0 %) — gegen Live-Daten bestätigt
- ✅ **Vorlaufmonate als Quelle**: Startmonat wird befüllt (Unit-Test „fills the start month from a pre-window source"); In-Fenster-Bestände durch Rückprojektion unverändert

**Überschreiben / Reset / Notizen / Betragsselektion**
- ✅ grau (berechnet) / blau (manuell); Inline-Edit onBlur (≥ 0); optimistisch + Rollback
- ✅ Einzelzelle-Reset (manuelle Zelle → null) + globaler Reset (alle manuellen Werte + Notizen der Version)
- ✅ Notizen versionsgebunden (`langfristige_planung_notizen`, `seite='umsatzausgaben'`); Betragsselektion-Panel (`data-betrag-selektion`)

**Datenisolation & Schema & API**
- ✅ Lese-/Schreibzugriffe nach `versionId` + `user_id`; Cascade über `plan_version_id` FK
- ✅ Tabelle `langfristige_umsatzausgaben_planung`, RLS (4 Policies `auth.uid()=user_id`), 3 Indizes; `get_advisors` ohne neue Warnung
- ✅ Routen: `requireAuth` + `ensureLangfristigeVersion` (404 bei fremd), Zod, `force-dynamic`; GET/PUT/DELETE + berechnet

### Sicherheitsaudit (Red Team) — keine Findings
- ✅ **Auth:** `requireAuth` in allen Handlern beider Routen (401 ohne Session)
- ✅ **Authorization/IDOR:** `ensureLangfristigeVersion` (404 bei fremder Version) + Query-Filter `user_id` + `plan_version_id`; RLS als zweite Ebene
- ✅ **Mass Assignment:** `user_id` aus Session erzwungen, nicht aus Body
- ✅ **Eingabevalidierung:** Zod (UUIDs, `jahr` 2000–2100, `monat` 1–12, Betrag ≥ 0 oder null)
- ✅ **XSS/Injection:** Werte numerisch, Namen via React-Escaping; Supabase parametrisiert; keine Secrets in Antworten

### Bugs / Beobachtungen
**Keine Critical/High/Medium-Bugs.**

- **L1 (Low, bewusst):** Die `berechnet`-GET-Route hat Schreib-Seiteneffekte — sie generiert die Auto-Bestellkosten der Version neu (`generiereUndSpeichereLangfristigeBestellkosten`), damit Produktausgaben ohne manuelles Öffnen jeder Bestellung erscheinen. Idempotent; konsistent mit dem PROJ-86-Bestellkosten-Routenmuster.
- **L2 (Low, dokumentiert):** Bestand der Vorlaufmonate wird rückprojiziert und je Monat bei 0 gekappt (`Math.max(0, …)`); in Randfällen, in denen der Bestand historisch 0 war, ist die Rückprojektion eine Näherung. In-Fenster-Werte sind davon unberührt.
- **L3 (Low, datenbedingt — kein Code-Fehler):** In „Testversion1" zeigen Versand/Lager/Kulanz/Produkt 0 % USt, weil „Vertrieb"/„Produkt" auf „aufgeteilt" stehen und für diese Untergruppen kein USt-Satz gepflegt ist (nur Retouren/Verkaufsgebühren 19 %). Pflege je Untergruppe oder Ebene „Gesamt" behebt das.
- **L4 (Low, bewusst):** `kategorie_id`/`produkt_id` ohne harten FK auf das KPI-Modell (analog PROJ-88/Notiz-Muster). Beim Löschen einer Kategorie/eines Produkts bleiben evtl. verwaiste manuelle Werte zurück; sie werden nie angezeigt. Versions-Kaskade greift über `plan_version_id` FK.

### Hinweis zur Gesamt-Testsuite
`src/hooks/use-absatzplanung.test.ts` (PROJ-51, **nicht** Teil von PROJ-91) hat einen vorbestehenden, kalender-/datumsabhängigen Fehlschlag (`berechnePlanungswochen`, „next ISO week", `expected 26 to be 27`). Datei von PROJ-91 nicht angefasst — keine PROJ-91-Regression (gleiche Beobachtung wie in PROJ-84-QA).

### Produktionsbereitschaft
**✅ PRODUCTION-READY** — keine Critical/High/Medium-Bugs, Sicherheitsaudit ohne Findings, alle Akzeptanzkriterien erfüllt (inkl. der nachträglichen Korrekturen: Bestand statt Absatz bei Lager, Erstbestellungs-Ausschluss, Vorlaufmonate). Die vier Low-Beobachtungen sind dokumentierte, bewusste Entscheidungen bzw. datenbedingt — kein Funktionsrisiko.
