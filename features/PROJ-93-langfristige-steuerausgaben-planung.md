# PROJ-93: Steuerausgaben Planung — Langfristige Planung

## Status: In Review
**Created:** 2026-06-22
**Last Updated:** 2026-06-24 (QA: USt-Berechnung + Zahlungsziel-Rückrechnung/Invest-Satz-Fixes geprüft; 25/25 bestehende Tests grün; 6 Befunde dokumentiert — siehe „QA Test Results"; Status → In Review)

## Implementation Notes (Enhancement 2026-06-23: Aufschlüsselungen / Drill-down)

Portierung der PROJ-71-Erweiterung auf die langfristige (monatsbasierte, reine Soll-)Planung.

**Backend (`berechnet/route.ts`):**
- **Einfuhrumsatzsteuer → je Produkt:** In der Bestellungs-Schleife wird der Einfuhr-USt-Betrag zusätzlich je `(produkt_id, Zielmonat)` in `einfuhrProduktByMonth` gebucht (nur innerhalb des Horizonts, mirror von `addResult`). Produktnamen aus `langfristige_kpi_kategorien` (art=`lp_produkt`, level 1). Ausgeliefert als `breakdown.einfuhr_produkte` (`{produkt_id, produkt_name, jahr, monat, wert}`). Bestellungen ohne Produkt → „Ohne Produktzuordnung".
- **Umsatzsteuer → Komponenten:** `addUst(...)` erhält einen Komponenten-Tag (`output` = A1/A2 Zahllast, `vorsteuer` = B1–B5, `einfuhr` = B6); `komponentenByMonth` parallel zu `ustNetByMonth`. In der Gruppierung werden Netto und Komponenten gemeinsam auf den Fälligkeitsmonat verschoben (`netByDue`/`kompByDue`) → die drei vorzeichenbehafteten Komponenten summieren exakt zum Umsatzsteuer-Wert. Ausgeliefert als `breakdown.umsatzsteuer_komponenten` (nur Monate, in denen die Umsatzsteuer-Zeile einen Wert hat).
- Antwort jetzt `{ data, breakdown: { einfuhr_produkte, umsatzsteuer_komponenten } }`.
- (Im selben Zug wurde die USt-Satz-Auflösung der Route auf prozentbasiert umgestellt — `getUstSatz`/`getUstSatzForProdukt`/`getUstSatzHierarchisch`/`getSppSatz` analog kurzfristig; die Aufschlüsselung splittet lediglich die bestehenden Beiträge und ist davon unabhängig.)

**Frontend:**
- `use-langfristige-steuerausgaben.ts`: parst beide Breakdown-Strukturen, exponiert `einfuhrKatId`/`umsatzsteuerKatId` (über die Leaf-Kategorien erkannt), `einfuhrProduktIds`, `produktNamen`, `hasUstKomponenten` + Getter `getEinfuhrProduktBer`, `getUstKomponente`.
- `langfristige-steuerausgaben-tabelle.tsx`: neue Zeilenart `breakdown`; Einfuhr-/Umsatzsteuer-Leaf-Zeilen aufklappbar (Drill-down, standardmäßig eingeklappt, unabhängig von „Alle aus-/einklappen"). Sub-Zeilen read-only (keine Bearbeitung/Notizen), selektierbar für die Betragsselektion. Keine Ist-Spalten in der LP → die Aufschlüsselung erscheint in jeder (Soll-)Monatsspalte.
- Annahme: Einfuhrumsatzsteuer/Umsatzsteuer sind Leaf-Kategorien unter „Steuern".

## Implementation Notes (Backend)
- **DB-Migration angewandt** (Supabase Remote `kdmpghtdoguppfqhdscq`, `create_langfristige_steuerausgaben_planung`): Tabelle `langfristige_steuerausgaben_planung` (`id`, `user_id` FK auth.users ON DELETE CASCADE, `plan_version_id` FK langfristige_planversionen ON DELETE CASCADE, `kategorie_id`, `jahr` CHECK 2000–2100, `monat` CHECK 1–12, `betrag_manuell NUMERIC(12,2)` **NULLABLE, ohne Vorzeichen-CHECK → negative Werte erlaubt**, `created_at`, `updated_at`). UNIQUE(plan_version_id, kategorie_id, jahr, monat). RLS aktiv mit 4 nutzergebundenen Policies (SELECT/INSERT/UPDATE/DELETE, `auth.uid() = user_id`) — konsistent mit `langfristige_finanzierungsausgaben_planung`. 3 zusätzliche Indizes (user, version, version+kategorie). Security-Advisor: keine Warnung für die neue Tabelle.
- `src/app/api/langfristige-planung/[versionId]/steuerausgaben/route.ts` — GET/PUT/DELETE für manuelle Überschreibungen. PUT validiert per Zod (UUID, jahr 2000–2100, monat 1–12, `betrag_manuell` Zahl **oder null, negativ erlaubt** — `z.number().nullable()` ohne `min`); `betrag_manuell: null` löscht den Eintrag. DELETE löscht alle manuellen Werte der Version **und** die Notizen (`seite='steuerausgaben'`). `requireAuth()` + `ensureLangfristigeVersion()` in allen Methoden. Spiegelt das einnahmen-planung-Route-Muster.
- `src/app/api/langfristige-planung/[versionId]/steuerausgaben/berechnet/route.ts` — Auto-Berechnung (Einfuhr-USt + Umsatzsteuer), nichts persistiert. Antwort `{ data: { kategorie_id, jahr, monat, wert }[] }`.
  - **Reuse-Strategie:** Die rechenintensiven Quell-Soll-Werte werden über die bestehenden berechnet-Route-Handler **in-process importiert und aufgerufen** (Sales-Plattform-Planung, Umsatzausgaben, Investitionsausgaben) — kein HTTP, keine Logik-Duplikation, kein Refactoring bestehender Features. Manuelle Overrides jeder Quelle werden zusätzlich gelesen und überlagern den berechneten Wert (effektiver Soll = manuell ?? berechnet).
  - **Einfuhr-USt:** vollständig eigenständig aus `langfristige_bestellungen` + `langfristige_bestellungen_kosten` (Basis Ware/Versand/Zoll) + `langfristige_einfuhrust_fiskalverzollung` (Skip fiskalverzollter Produkte) + Einfuhr-Satz/Zahlungsziel aus `langfristige_ust_einstellungen`. Zielmonat = Ankunftsmonat + ceil(Zahlungsziel/30).
  - **Umsatzsteuer:** A1 (Produktverkäufe-Zahllast aus SPP netto = brutto − rückerstattungen), A2 (sonstige Einnahmen-Zahllast aus `langfristige_einnahmen_planung`), B1 (SPP Gebühr/Retouren/Marketing-Vorsteuer), B2 (Umsatzausgaben-Vorsteuer ohne Marketing), B3 (Operativkosten-Vorsteuer), B4 (Investitionsausgaben-Vorsteuer), B5 (Finanzierungsausgaben-Vorsteuer), B6 (Einfuhr-USt-Abzug). Netto je Monat → Gruppierung (monatlich/quartalsweise) + Zahlungsverschiebung (PROJ-83) → Fälligkeitsmonat. Negative Netto-USt (Erstattung) möglich.
  - **Dokumentierte USt-Semantik je Quelle (für QA, im Routen-Kopf):** SPP-Gebühr/Retouren/Marketing & Umsatzausgaben & Operativkosten & Finanzierungsausgaben = **Brutto inkl. USt → extractVorsteuer**; Investitionsausgaben = **Netto** (Quelle summiert Bestellkosten-Netto) → Vorsteuer = Netto × Satz; Einnahmen = Netto-Basis → Zahllast = Betrag × Satz; Produktverkäufe-Satz je Produkt via Pflegeebene (Gesamt/Aufgeteilt).
  - **Zahlungsziel-Rückrechnung (Fix 2026-06-23, siehe unten):** Ursprünglich bewusste Vereinfachung ggü. PROJ-71 (kein Rückrechnen). Für **Vertrieb (Versand/Lager/Retouren/Kulanz) + Marketing** wird das Zahlungsziel nun — wie kurzfristig — vom Zahlungsmonat abgezogen, sodass der USt-/Vorsteuer-Anfall am Rechnungs-/Leistungsmonat hängt. B2-Produktkosten, B3 Operativkosten und B5 Finanzierung bleiben (vorerst) am Quell-/Anfallsmonat.
- **Tests:** `route.test.ts` (16 Tests: GET/PUT/DELETE inkl. negativer Betrag, null=löschen, 400/401/404/500) + `berechnet/route.test.ts` (5 Smoke-Tests: leerer Happy-Path, 400/401/404/500; Quell-Handler gestubbt). **25/25 grün.** `tsc --noEmit` ohne neue Fehler.
- **Hinweis für QA:** Die Umsatzsteuer-Mathematik (Mehrquellen-Zusammenführung, Brutto/Netto-Semantik je Quelle, Gruppierung/Verschiebung) ist der komplexeste Teil und sollte mit konkreten Versions-Plandaten gegen die kurzfristige PROJ-71-Logik plausibilisiert werden.
- **Fixes (2026-06-23, nach erstem Test):** (1) Einfuhr-USt-Basis nutzt jetzt exakte Kategorienamen (`ware`/`versand`/`shipping`/`zoll`) statt Substring — verhinderte fälschliche Mitzählung von „Wertverlust Ware". (2) Zielmonat der Einfuhr-USt = exaktes Zahlungsdatum (Ankunft + Zahlungsziel-Tage) statt `ceil(Tage/30)`-Monatsnäherung (faithful zu PROJ-71). **Diagnose-Hinweis:** Die langfristigen Steuereinstellungen (`langfristige_ust_einstellungen`) sind versionsisoliert und starten bei Einfuhr-USt-Satz 0 % — ohne gesetzten Satz je Version bleibt die Einfuhr-USt korrekterweise leer (nicht vom kurzfristigen 19 %-Satz vererbt).

## Fix (2026-06-23): Zahlungsziel-Rückrechnung für Vertrieb + Marketing (B2)

**Problem:** Die Langfrist-USt-Route hat die Vorsteuer am **Zahlungsmonat** der Umsatzausgaben-Quelle gebucht (= Anfallsmonat + Zahlungsziel), statt am **Rechnungs-/Leistungsmonat**. Bei monatlicher USt (z. B. Versand, Zahlungsziel 30 T) erscheint die Vorsteuer dadurch **ein Zahlungsziel zu früh** in der USt-Zeile — Abweichung von der kurzfristigen Referenz PROJ-71 ([steuerausgaben-planung/berechnet/route.ts:1165-1171], die das Zahlungsziel via `addDays(..., -zt)` zurückrechnet).

**Fix (`berechnet/route.ts`, B2-Schleife):** Vor der USt-Fälligkeitsverschiebung wird für Vertrieb + Marketing das Zahlungsziel monatsweise abgezogen (`Quellmonat = Zahlungsmonat − ceil(Zahlungsziel/30)`), dann erst greift die +1-Monats-Fälligkeit.
- Neu aufgelöst: globale L2-Kategorien Versand/Lager/Retouren/Kulanz (identische Resolver-Logik wie PROJ-91, damit die IDs zu `umsatzEff` passen).
- Neu geladen: `langfristige_versand_/lager_/ersatzteile_kulanz_plattform_einstellungen` (+ `retouren_allgemein_einstellungen`) → Zahlungsziel je Vertriebs-L2; `langfristige_marketing_einstellungen` → Zahlungsziel je Marketingkanal-ID.
- `zahlungszielByKat`-Map; in der B2-Schleife `addUst` am rückgerechneten Monat.
- **Bewusst NICHT im Scope:** B2-Produktkosten (Ware/Shipping/Zoll/Einlagerung/Inspektion), B3 Operativkosten, B5 Finanzierung — diese bleiben am Quell-/Anfallsmonat (mögliche Folgearbeit).

### Nachtrag (2026-06-23): Produktkosten-Zahlungsziel **tagesgenau** rückgerechnet
**Problem:** Auch Bestellkosten (Shipping/Inspektion/Einlagerung/Zoll) tragen ein Zahlungsziel — das `datum` der Bestellkosten ist bereits `Basisdatum + Zahlungsziel` (vgl. `bestellkosten-generierung.ts`). Für die USt muss es zurückgerechnet werden (so auch PROJ-71).
**Wichtige Feinheit:** Eine monatsweise `ceil(Tage/30)`-Rückrechnung wäre hier **falsch** (z. B. Einlagerung 7 T → würde fälschlich einen ganzen Monat zurückspringen). Daher werden diese 4 Kategorien **nicht** über das monats-aggregierte `umsatzEff` verbucht, sondern **tagesgenau** aus den Roh-`langfristige_bestellungen_kosten` (`Rechnungsdatum = datum − Zahlungsziel_Tage`, je Kostenart aus `langfristige_produktinformationen_kosten_global`). Frische Bestellkosten werden in einem separaten `await` nach dem Haupt-`Promise.all` gelesen (umsatzausgabenBerechnetGET regeneriert sie). Nur Nicht-Erstbestellungen (Erstbestellungen → B4). 
**Ware (Nachtrag 2026-06-23):** Ware hat KEIN einzelnes Zahlungsziel, sondern Zahlungskonditionen/Tranchen (vor Produktion / nach Produktion / nach Ankunft). Wie kurzfristig ([steuerausgaben-planung/berechnet/route.ts:1174-1191]) wird Ware daher **am Bestelldatum** verbucht: voller Ware-Netto je Bestellung × Ware-Satz am Bestelldatum-Monat, nur Nicht-Erstbestellungen, aus `umsatzEff` ausgeschlossen. (In Testversion1 Ware = 0 % → numerisch 0, aber jetzt korrekt für Sätze > 0.)
**Nicht abgedeckt:** **manuelle Overrides** auf Produktkosten/Ware (reine Auto-/Soll-Werte) sowie **B3 Operativkosten** und **B5 Finanzierung** (noch am Anfallsmonat). `tsc --noEmit` ohne neue Fehler.
- Output (A1/A2), B4, B6 unberührt (kein Zahlungsziel bzw. eigene Logik). `tsc --noEmit` ohne neue Fehler in der Route.

### Fix (2026-06-23): USt-Satz-Auflösung für Investitionsausgaben (B4)
**Problem:** B4 nutzte `getUstSatzHierarchisch`, das den L1-Vorfahren über den **globalen** KPI-Baum sucht. Die Invest-Kategorien sind aber **versions-eigen** (`lp_investition`) → der Vorfahre wird nie gefunden → Satz immer 0 %. Folge: Der für „Produktinvestitionen Sales & Marketing" gepflegte 19 %-Satz wurde ignoriert (B4 = 0).
**Fix:** Neuer `getUstSatzInvest`-Resolver — respektiert die Gesamt/Aufgeteilt-Auswahl der **globalen** „Produktinvestitionen"-L1 (`langfristige_ust_ebene_auswahl`): **Gesamt** → deren L1-Satz; **Aufgeteilt** → vom Invest-Eintrag im **Versions-Invest-Baum** nach oben den ersten gepflegten Satz (Versions-Gruppe, ebene 1 — analog zum Produktverkäufe-Resolver). Dafür wird der `lp_investition`-Parent-Baum geladen. Die übrigen Domänen (Vertrieb/Produkt/Operativ/Finanz/Einnahmen über den globalen Baum; Produktverkäufe/Marketing über ihre Sonder-Resolver) respektierten Gesamt/Aufgeteilt bereits korrekt — nur Invest war betroffen. `tsc --noEmit` ohne neue Fehler.
**Offen:** Für BERECHNETE Invest-Werte (Einkauf aus Erstbestellungen) wendet die Invest-Berechnet-Route den USt-Aufschlag noch über die globale Bestellkosten-Kategorie an (Ware/Einlagerung/…), während B4 jetzt den Invest-Gruppensatz extrahiert — bei nicht-0 %-Einkauf-Sätzen wäre das inkonsistent (in Testversion1 ist Einkauf 0 % → unkritisch). Manuelle Invest-Werte (der Normalfall) sind davon nicht betroffen.

## Implementation Notes (Frontend)
- `src/hooks/use-langfristige-steuerausgaben.ts` — versionsgebundener Hook. Lädt parallel Grundeinstellungen (Startmonat + `planungshorizont_monate`, Fallback 12), den globalen `ausgaben_kosten`-KPI-Baum (Filter auf „Steuern"-Subtree → L1-Gruppen + L2-Untergruppen, `istLeaf` wenn keine Untergruppen), die manuellen Overrides (`GET /steuerausgaben`) und die Auto-Werte (`GET /steuerausgaben/berechnet`). Monatsfenster ohne Vorlauf (`buildSteuerausgabenMonate`). Zell-Schlüssel `kategorieId:jahr:monat` (KEINE Produktdimension). `getEffektiverWert` = manuell ?? berechnet (für Aggregation). `upsertZelle` (optimistisch + Rollback, `null` → löschen), `resetAll` (DELETE). **Negative Beträge erlaubt.**
- `src/components/langfristige-steuerausgaben-tabelle.tsx` — kategoriebasierte Monatstabelle (group-header / group-leaf / subgroup / total). Strukturbasis = `finanzierungsausgaben-planung-tabelle`; Feature-Set (grau/blau Indikatorpunkte, Einzelzelle-„Auf automatisch zurücksetzen", globaler Reset mit AlertDialog, Notizen, Betragsselektion/Hoverklick, Jahres-Gruppierungszeile, sticky Label-Spalte) = `langfristige-umsatzausgaben-tabelle`. Gesamt-Zeile „Steuerausgaben (Gesamt)" ganz unten. **Kein Bulk-Edit** (bewusst, wie PROJ-71/91). Inline-Input erlaubt negative Werte (kein `min`, keine `< 0`-Validierung). Leerer Zustand bei fehlendem „Steuern"-Knoten.
- `src/app/dashboard/langfristige-planung/[versionId]/steuerausgaben/page.tsx` — Seite via `LangfristigeVersionShell` (`seitenTitel="Steuerausgabenplanung"`, `fullWidth`).
- `src/lib/langfristige-planung-nav.ts` — neuer Eintrag „Steuerausgabenplanung" (Slug `steuerausgaben`) in der Gruppe „Planung", unterhalb „Finanzierungsausgaben Planung" (Nav + Versions-Übersicht ziehen generisch nach).
- Notizen über `useLangfristigePlanungNotizen(versionId, 'steuerausgaben')` (bestehende Tabelle/Route, keine neue).
- TypeScript: `tsc --noEmit` ohne neue Fehler (bestehende Fehler nur in Test-/generierten `.next`-Dateien).
- **Backend noch nicht vorhanden:** Bis die Routen `GET/PUT/DELETE /api/langfristige-planung/[versionId]/steuerausgaben` und `GET …/steuerausgaben/berechnet` + DB-Tabelle existieren, lädt die Seite leer (Hook fängt fehlende Routen ab → keine Auto-/Manuell-Werte).

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert die **Produkte** der Version (`art = 'lp_produkt'`) als Berechnungsdimension der Umsatzsteuer. Die **Zeilen-Kategorien** (Gruppen unter „Steuern") stammen aus dem **globalen** `ausgaben_kosten`-KPI-Baum (wie kurzfristig); nur die Produkte als Berechnungsdimension sind versionsgebunden
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`) und **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monatsfenster
- Requires: PROJ-83 (Steuereinstellungen — Langfristige Planung) — versionsisolierte Steuereinstellungen: **Umsatzsteuer-Grundeinstellungen** (Zahlungsfrequenz monatlich/quartalsweise + Zahlungsverschiebung Tage), **USt-Sätze je Kategorie** inkl. Pflegeebene („Gesamt/Aufgeteilt"), **Einfuhrumsatzsteuer** (Einfuhr-USt-Satz %, Zahlungsziel Tage, Fiskalverzollung je Produkt)
- Requires: PROJ-86 (Bestellplanung — Langfristige Planung) — Bestellungen der Version + Bestellkosten (Ware/Versand/Zoll) + Ankunfts-/Liefermonat für die Einfuhrumsatzsteuer-Berechnung
- Requires: PROJ-87 (Sales-Plattform-Planung — Langfristige Planung) — Bruttoumsatz, Rabatte, Rückerstattungen, Verkaufsgebühr, Retourenkosten, Marketingkosten je Produkt × Monat (für die USt-Berechnung A1 + B1)
- Requires: PROJ-89 (Einnahmenplanung — Langfristige Planung) — Einnahmen-Kategorien außer Produktverkäufe je Monat (für USt-Berechnung A2)
- Requires: PROJ-91 (Umsatzausgaben Planung — Langfristige Planung) — Soll-Beträge je Monat inkl. Zahlungsziel-Logik (für USt-Vorsteuer B2)
- Requires: PROJ-88 (Operativekosten Planung — Langfristige Planung) — Soll-Beträge je Monat (für USt-Vorsteuer B3)
- Requires: PROJ-92 (Investitionsausgaben Planung — Langfristige Planung) — Soll-Beträge je Monat (für USt-Vorsteuer B4)
- Requires: PROJ-90 (Finanzierungsausgaben Planung — Langfristige Planung) — Soll-Beträge je Monat (für USt-Vorsteuer B5)
- Requires: PROJ-84 (Absatzplanung — Langfristige Planung) — liefert den Monatsfenster-Helfer (`buildPlanungsmonate`) und die versionsgebundene Notiz-Tabelle (`langfristige_planung_notizen`)
- Vorlage (kein harter Require): PROJ-71 (Steuerausgaben — Kurzfristige Planung) — Zeilenhierarchie, Kategorien, Indikatorpunkte und Berechnungsmethode (Einfuhr-USt + Umsatzsteuer) werden gespiegelt, mit den unten beschriebenen Abweichungen (monatsbasiert, versionsgebunden, keine Ist-Spalten)
- Vorlage (kein harter Require): PROJ-91 (Umsatzausgaben Planung — Langfristige Planung) — Bedien- und Anzeigemodell „berechnet + manuell überschreibbar" (grau/blau Punkte, Einzelzelle-Reset, globaler Reset) auf monatsbasierter, versionsgebundener Tabelle ohne Ist-Daten
- Integriert: PROJ-40 (Betragsselektion) — „Hover/Klick"-Summenpanel
- Integriert: PROJ-53-Muster (Zellen-Notizen) — versionsgebunden über `langfristige_planung_notizen`

## Übersicht

Die Seite **„Steuerausgaben"** ist eine weitere Planungsseite im Navigationsbereich der Langfristigen Planung. Sie spiegelt die gleichnamige Seite der **Kurzfristigen Planung (PROJ-71)** — **die Gruppen unter der KPI-Kategorie „Steuern" werden genau so angezeigt** und die Steuerarten **Einfuhrumsatzsteuer** und **Umsatzsteuer** werden mit **derselben Berechnungsmethode** vorausgefüllt — nur dass durchgehend die **Einstellungen und Plandaten dieser Planversion** zum Einsatz kommen und die Zeitachse **monatsweise** statt wochenweise ist.

Wesentliche Unterschiede zur kurzfristigen Variante (alle vom Nutzer am 2026-06-22 bestätigt):

- **Monatsspalten statt Kalenderwochen.** Die Tabelle beginnt **exakt mit dem Startmonat** (aus den Grundeinstellungen der Version) und reicht über den **allgemeinen Planungshorizont** (`planungshorizont_monate` Monate ab Startmonat, Fallback 12). **Keine Vorlaufmonate.**
- **Keine Vergangenheits-/Ist-Spalten.** Die Langfristige Planung kennt **keine Transaktionen**: Es gibt **keine** „Ist-Tatsächlich"- und **keine** „Ist-Plan"-Spalten und **keinen** Einfrier-Mechanismus. Jede Monatsspalte ist eine reine **Soll-Spalte** (berechnet, manuell überschreibbar).
- **Datenbasis = Soll-Werte dieser Version.** Die Umsatzsteuer-Berechnung verwendet ausschließlich die Soll-Werte der langfristigen Planungsseiten dieser Version (Sales-Plattform-Planung, Einnahmenplanung, Umsatzausgaben, Operativekosten, Investitionsausgaben, Finanzierungsausgaben) und die Bestellungen der langfristigen Bestellplanung; USt-Sätze und Frequenzen aus den langfristigen Steuereinstellungen (PROJ-83).
- **Nur manuelle Überschreibungen werden gespeichert.** Auto-Werte werden bei jedem Laden frisch server-seitig berechnet und **nie** persistiert (konsistent mit PROJ-87/88/90/91). Ein DB-Eintrag bedeutet immer „manuell überschrieben" (blauer Punkt).
- **Auto-Berechnung + manuelle Überschreibung.** Einfuhrumsatzsteuer- und Umsatzsteuer-Zellen werden automatisch berechnet (**grauer Punkt**); der Nutzer kann jeden Wert manuell überschreiben (**blauer Punkt**), eine einzelne Zelle auf den berechneten Wert zurücksetzen und alle manuellen Werte global zurücksetzen.
- **Übrige Steuergruppen rein manuell.** Wie in PROJ-71 werden Gruppen ohne Auto-Berechnung (z. B. Ertragssteuer) **nicht** vorausgefüllt — kein grauer Punkt, nur manuell befüllbar (blauer Punkt bei Eingabe).
- **Negative Werte erlaubt.** Die Umsatzsteuer kann pro Monat negativ sein (Vorsteuer-Überhang / Erstattung).
- **Versionsbindung der Werte.** Manuelle Überschreibungen und Notizen sind **strikt pro Planversion** isoliert (PROJ-73); die globale Kategoriestruktur ist bewusst nicht versionsisoliert.

**Beibehalten** werden: das **Betragsselektion-/Hover-Klick-Summenpanel** (PROJ-40), die **Zellen-Notizen** (PROJ-53, versionsgebunden) sowie **„Alle ein-/ausklappen"**. Die **Gesamt-Zeile „Steuerausgaben (Gesamt)"** erscheint immer ganz **unten**.

## Berechnungslogik

Die Berechnung spiegelt die kurzfristige `steuerausgaben-planung/berechnet`-Logik (PROJ-71), parametriert mit den Einstellungen und Plandaten **dieser** Planversion. Sie erfolgt server-seitig in einer `berechnet`-Route; Aggregationen (Gruppen-, Untergruppen-, Gesamt-Summen) frontend-seitig. Es werden zwei unabhängige Steuerarten vorausgefüllt:

### 1. Einfuhrumsatzsteuer (auto-berechnet)

Je Bestellung der langfristigen Bestellplanung (PROJ-86):
- **Fiskalverzollung prüfen:** Ist das Produkt der Bestellung in den langfristigen Steuereinstellungen (PROJ-83) als **fiskalverzollt** gekennzeichnet → kein Einfuhrumsatzsteuer-Betrag (überspringen). Andernfalls weiter.
- **Steuerbetrag:** `Einfuhrumsatzsteuer = (Summe Bestellkosten Ware + Versand + Zoll) × (Einfuhr-USt-Satz aus PROJ-83 / 100)`
- **Zielmonat:** `Zahlungsdatum = Ankunfts-/Liefermonat der Bestellung + Zahlungsziel (Tage, PROJ-83)`; auf ISO-Monat umgerechnet bestimmt den Zielmonat.
- **Akkumulieren:** Alle Bestellungen mit gleichem Zielmonat werden in der Einfuhrumsatzsteuer-Gruppe summiert.

### 2. Umsatzsteuer (auto-berechnet, kann negativ sein)

Netto-USt je Monat = zu zahlende USt − zu erhaltende USt (Vorsteuer). Alle Quellen sind **Soll-Werte dieser Version** (keine Ist-Daten):

**A — Zu zahlende Umsatzsteuer (positiv):**
- **A1** Sales-Plattform-Planung (PROJ-87), Produktverkäufe je Produkt × Monat: `Nettoumsatz = Bruttoumsatz − Rabatte − Rückerstattungen`; USt-Satz aus PROJ-83 (Kategorie „Produktverkäufe", Pflegeebene Gesamt/Aufgeteilt je Produkt); `USt = Nettoumsatz × Satz/100`
- **A2** Einnahmenplanung (PROJ-89), alle Kategorien außer Produktverkäufe: `USt = Bruttobetrag × Satz/100`

**B — Zu erhaltende Umsatzsteuer / Vorsteuer (negativ):**
- **B1** Sales-Plattform-Planung (PROJ-87): Verkaufsgebühr, Retourenkosten, Marketingkosten → Vorsteuer je Position
- **B2** Umsatzausgaben (PROJ-91) ohne Marketing (Vermeidung Doppelzählung mit B1)
- **B3** Operativekosten (PROJ-88)
- **B4** Investitionsausgaben (PROJ-92)
- **B5** Finanzierungsausgaben (PROJ-90)
- **B6** Einfuhrumsatzsteuer-Abzug: die in 1. berechneten Einfuhrumsatzsteuerbeträge mindern die zu zahlende USt im Monat ihres Anfalls
- Für jede Position: `Vorsteuer = Bruttobetrag × (USt-Satz der jeweiligen Kategorie/Untergruppe aus PROJ-83 / 100)`

**C — Netto-USt je Monat:** `Netto = (A1 + A2) − (B1 + B2 + B3 + B4 + B5) − B6` (positiv = Zahllast, negativ = Erstattung)

**D — Gruppierung & Verschiebung (PROJ-83):**
- **Monatlich:** alle Monatswerte werden je Kalendermonat summiert; der Betrag fällt im **Folgemonat** an.
- **Quartalsweise:** Werte je Quartal summiert; der Betrag fällt im **Folgemonat des Quartals** an (Q1→Apr, Q2→Jul, Q3→Okt, Q4→Jan Folgejahr).
- Der gruppierte Betrag wird zusätzlich um `Zahlungsverschiebung_tage` (PROJ-83) nach hinten verschoben (auf Monatsebene abgebildet).
- Monate außerhalb des Horizonts nach Verschiebung: nicht angezeigt. Nicht-Fälligkeitsmonate: leere Zelle (kein 0).

### 3. Übrige Steuergruppen (kein Auto-Wert)

Alle Gruppen unter „Steuern", die weder Einfuhrumsatzsteuer noch Umsatzsteuer sind (z. B. Ertragssteuer), werden **nicht** vorausgefüllt — kein grauer Punkt; vollständig manuell editierbar; blauer Punkt bei Eingabe.

## User Stories

- Als Controller möchte ich innerhalb einer geöffneten Planversion über die Navigation die Seite „Steuerausgaben" aufrufen können, damit ich die Steuerausgaben dieses Szenarios planen kann.
- Als Controller möchte ich, dass die Gruppen unter der KPI-Kategorie „Steuern" genau so angezeigt werden wie in der kurzfristigen Planung, mit Monatsspalten ab dem Startmonat bis zum allgemeinen Horizont.
- Als Controller möchte ich, dass die Einfuhrumsatzsteuer automatisch vorausgefüllt wird — mit derselben Methode wie kurzfristig, aber auf Basis der Bestellungen und Steuereinstellungen dieser Planversion.
- Als Controller möchte ich, dass die Umsatzsteuer automatisch vorausgefüllt wird — mit derselben Berechnungsmethode wie kurzfristig, aber auf Basis der Soll-Plandaten und Einstellungen dieser Planversion.
- Als Controller möchte ich, dass übrige Steuergruppen (z. B. Ertragssteuer) nicht vorberechnet werden und ich die Werte manuell eingeben kann.
- Als Controller möchte ich jeden vorberechneten Wert manuell überschreiben und auf einen Blick erkennen, ob ein Wert automatisch (grau) oder manuell (blau) ist.
- Als Controller möchte ich eine einzelne überschriebene Zelle wieder auf den berechneten Wert zurücksetzen sowie alle manuellen Werte und Notizen global zurücksetzen können.
- Als Controller möchte ich alle Kategoriegruppen einzeln auf-/zuklappen sowie mit zwei Buttons alle gleichzeitig ein-/ausklappen können.
- Als Controller möchte ich für einzelne Zellen Notizen hinterlegen können (versionsgebunden).
- Als Controller möchte ich mehrere Zellen selektieren („Hoverklicken") und die Summe rechts unten angezeigt bekommen.
- Als Controller möchte ich, dass meine manuellen Eingaben und Notizen pro Planversion gespeichert werden, ohne andere Versionen oder die Kurzfristige Planung zu beeinflussen.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] In der versionsspezifischen Navigation (`src/lib/langfristige-planung-nav.ts`) gibt es in der passenden Gruppe (Planung, analog zur Einordnung der übrigen Ausgaben-Planungsseiten) einen neuen Eintrag **„Steuerausgaben"** mit Slug `steuerausgaben`, der auf `/dashboard/langfristige-planung/[versionId]/steuerausgaben` verlinkt
- [ ] Auf der Versions-Übersichtsseite erscheint der Eintrag/die Kachel „Steuerausgaben" (generisches Rendern zieht automatisch nach)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Aufruf mit unbekannter/fremder/ungültiger `versionId` → sauberer Redirect zum Langfristige-Planung-Dashboard (über `LangfristigeVersionShell`, kein Absturz, kein Fremdzugriff)
- [ ] Keine Kennzahlen-Kacheln oberhalb der Tabelle

### Tabellenstruktur & Monatsspalten

- [ ] Die Spalten sind **Monate** (nicht Kalenderwochen)
- [ ] **Erste Spalte** = **Startmonat** (aus `langfristige_grundeinstellungen`) — **kein** Vorlaufmonat
- [ ] **Letzte Spalte** = Startmonat + (`planungshorizont_monate` − 1) Monate; Fallback Horizont 12
- [ ] Jede Monatsspalte ist eine **Soll-Spalte** — es gibt **keine** Vergangenheits-/Ist-Spalten und **keinen** Einfrier-Mechanismus
- [ ] Spaltenüberschriften zeigen Monat + Jahr (z. B. „Apr 2026"); optionale Jahres-Gruppierungszeile (analog PROJ-84/91)
- [ ] Korrekte Berechnung über Jahresgrenzen hinweg (mehrjähriger Horizont)
- [ ] Tabelle horizontal scrollbar; erste Spalte (Zeilenbeschriftung) ist `sticky left` mit opakem Hintergrund

### Zeilenhierarchie (gespiegelt aus PROJ-71)

- [ ] Zeilenquelle: globaler `ausgaben_kosten`-KPI-Baum, gefiltert auf den **„Steuern"-Subtree** (L1-Gruppen + L2-Untergruppen), in `sort_order`-Reihenfolge
- [ ] **Es werden immer alle Gruppen unter „Steuern" angezeigt**, auch ohne Auto-Werte
- [ ] **Pro L1-Gruppe**: einklappbare Sektion (Standard: ausgeklappt) mit Kategorie-Header (Name + Toggle, zeigt Summe der Kinder, nicht editierbar)
  - Hat die Gruppe L2-Untergruppen: Aggregations-Zeile (Summe, nicht editierbar) + pro L2 eine editierbare Leaf-Zeile (eingerückt)
  - Hat die Gruppe keine Untergruppen: die L1-Gruppe selbst ist die editierbare Leaf-Zeile
- [ ] **Ganz unten**: Gesamt-Zeile **„Steuerausgaben (Gesamt)"** — summiert alle Leaf-Zeilen je Monat (effektive Werte: manuell ODER auto), nicht editierbar, immer sichtbar
- [ ] Aggregationen sind reaktiv (Leaf-Änderung aktualisiert alle übergeordneten Summen sofort)
- [ ] **Buttons oben rechts:** „Alle ausklappen" und „Alle einklappen" (zwei separate Buttons)

### Soll-Werte (berechnet) — allgemein

- [ ] Automatisch berechnete Zellen mit Wert zeigen einen **grauen Indikatorpunkt**
- [ ] Manuell überschriebene Zellen zeigen einen **blauen Indikatorpunkt**
- [ ] Zellen ohne Auto-Wert und ohne manuelle Eingabe: kein Punkt (z. B. übrige Steuergruppen)
- [ ] Inline-Editing (click-to-edit), Speicherung onBlur in der versionsgebundenen Tabelle mit Anzeige eines manuellen Eintrags
- [ ] Eingabe: Dezimalzahl, **auch negativ** (Umsatzsteuer-Erstattung); leeres Feld / Rücksetzen auf berechneten Wert → kein manueller Eintrag
- [ ] Optimistisches Update + Rollback bei API-Fehler (Toast)
- [ ] Nur Leaf-Zellen sind editierbar; Aggregations- und Gesamt-Zellen nicht

### Einfuhrumsatzsteuer (auto-berechnet)

- [ ] Quelle: alle Bestellungen der langfristigen Bestellplanung dieser Version (PROJ-86) inkl. Bestellkosten
- [ ] Fiskalverzollte Produkte (PROJ-83) werden übersprungen (kein Einfuhr-USt-Betrag)
- [ ] Basisbetrag = Summe der Bestellkosten Ware + Versand + Zoll der Bestellung
- [ ] Steuersatz = Einfuhr-USt-Satz aus PROJ-83 (versionsisoliert)
- [ ] Zielmonat = Ankunfts-/Liefermonat + Zahlungsziel (Tage, PROJ-83), auf ISO-Monat umgerechnet
- [ ] Beträge mit gleichem Zielmonat werden summiert

### Umsatzsteuer (auto-berechnet)

- [ ] A1: Produktverkäufe-USt aus Sales-Plattform-Planung (PROJ-87), Netto = Brutto − Rabatte − Rückerstattungen, USt-Satz je Produkt (PROJ-83, Gesamt/Aufgeteilt)
- [ ] A2: sonstige Einnahmen-USt aus Einnahmenplanung (PROJ-89)
- [ ] B1: Verkaufsgebühr/Retouren/Marketing-Vorsteuer aus Sales-Plattform-Planung (PROJ-87)
- [ ] B2: Umsatzausgaben-Vorsteuer (PROJ-91) ohne Marketing
- [ ] B3: Operativekosten-Vorsteuer (PROJ-88)
- [ ] B4: Investitionsausgaben-Vorsteuer (PROJ-92)
- [ ] B5: Finanzierungsausgaben-Vorsteuer (PROJ-90)
- [ ] B6: Einfuhrumsatzsteuer-Abzug
- [ ] Netto-USt je Monat korrekt berechnet (kann positiv oder negativ sein)
- [ ] Gruppierung monatlich/quartalsweise gemäß PROJ-83; Betrag im Folgemonat (bzw. Folgemonat des Quartals)
- [ ] Zahlungsverschiebung (Tage, PROJ-83) korrekt auf Monatsebene addiert
- [ ] Alle Quellen sind **Soll-Werte dieser Version** (keine Ist-Daten)

### Übrige Steuergruppen (kein Auto-Wert)

- [ ] Werden **nicht** automatisch berechnet oder vorausgefüllt; kein grauer Punkt
- [ ] Vollständig manuell editierbar; blauer Punkt bei manueller Eingabe

### Einzelzelle-Reset & globaler Reset

- [ ] Ist genau **eine** Soll-Zelle selektiert/fokussiert und manuell überschrieben, erscheint rechts unten „Auf automatisch zurücksetzen"; Klick löscht den manuellen Eintrag → Zelle zeigt wieder den berechneten Wert (grauer Punkt) bzw. wird leer (wenn kein Auto-Wert)
- [ ] Button „Zurücksetzen" oben rechts mit Bestätigungs-Dialog (shadcn AlertDialog): löscht alle manuellen Einträge **dieser Version** + alle Notizen dieser Seite **dieser Version**; Zellen zeigen wieder berechnete Werte bzw. werden leer; idempotent ohne manuelle Werte
- [ ] Verhalten analog PROJ-87/91

### Zellen-Notizen (wie PROJ-53, versionsgebunden)

- [ ] Ist genau **eine** editierbare Zelle selektiert, erscheint „Notiz hinzufügen"/„Notiz bearbeiten"; nicht bei keiner/mehrfacher/nicht-editierbarer Selektion
- [ ] Overlay mit Zellidentifikation, Textarea, „Speichern"/„Abbrechen"/(bei bestehender Notiz) „Notiz löschen"
- [ ] Zellen mit Notiz zeigen einen Indikator; Hover zeigt den Notiztext
- [ ] Notizen an die Zellkoordinate (Kategorie + Monat/Jahr) gebunden; bleiben beim Verschieben des Monatsfensters erhalten
- [ ] Notizen werden pro Planversion und Seite (`seite = 'steuerausgaben'`) über `langfristige_planung_notizen` gespeichert (keine neue Notiz-Tabelle)

### Betragsselektion (Hover/Klick-Summe, wie PROJ-40)

- [ ] Einzelne oder mehrere Zellwerte durch Klicken/Ctrl+Klicken selektierbar; Summe in einem Panel rechts unten (`data-betrag-selektion`)
- [ ] Panel erscheint ab 1 selektierter Zelle; nicht-editierbare Zellen (Aggregationen, Gesamt) ebenfalls selektierbar
- [ ] Verhalten identisch mit der bestehenden Betragsselektion (PROJ-40 / PROJ-87 / PROJ-91)

### Datenisolation (PROJ-73)

- [ ] Alle Lese-/Schreibzugriffe auf manuelle Werte und Notizen sind nach `versionId` **und** `user_id` gefiltert
- [ ] Eine neu angelegte Version zeigt eine vollständig berechnete, aber ohne manuelle Überschreibungen vorbelegte Seite
- [ ] Änderungen in Version A wirken sich nicht auf Version B oder die Kurzfristige Planung aus
- [ ] Beim Löschen der Planversion werden alle manuellen Werte- und Notiz-Datensätze kaskadierend mitgelöscht (ON DELETE CASCADE)
- [ ] Berechnete Werte beziehen ausschließlich Einstellungen/Pläne **dieser** Version (PROJ-75/83/86/87/88/89/90/91/92)

### Datenbankschema

- [ ] Neue Tabelle `langfristige_steuerausgaben_planung` (nur manuelle Überschreibungen):
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `kategorie_id` UUID NOT NULL — globale KPI-Leaf-Kategorie unter „Steuern" (kein FK, analog PROJ-88/91-Muster)
  - `jahr` INTEGER NOT NULL (CHECK 2000–2100), `monat` INTEGER NOT NULL (CHECK 1–12)
  - `betrag_manuell` NUMERIC(12,2) NULL — NULL = kein manueller Eintrag; **darf negativ sein** (USt-Erstattung)
  - `created_at`/`updated_at`
  - UNIQUE(`plan_version_id`, `kategorie_id`, `jahr`, `monat`) → Upsert via `onConflict`
  - RLS: nur eigene Einträge (`auth.uid() = user_id`); Versionszugehörigkeit serverseitig zusätzlich geprüft
- [ ] Notizen nutzen die bestehende Tabelle `langfristige_planung_notizen` (`seite = 'steuerausgaben'`)
- [ ] Auto-berechnete Werte werden **nicht** persistiert (stets server-seitig berechnet)

### API-Routen (versions- & nutzergebunden)

- [ ] `GET /api/langfristige-planung/[versionId]/steuerausgaben` — alle manuellen Einträge der Version
- [ ] `PUT /api/langfristige-planung/[versionId]/steuerausgaben` — Upsert je `(plan_version_id, kategorie_id, jahr, monat)`; `betrag_manuell: null` → Eintrag löschen
- [ ] `DELETE /api/langfristige-planung/[versionId]/steuerausgaben` — alle manuellen Einträge der Version löschen (globaler Reset)
- [ ] `GET /api/langfristige-planung/[versionId]/steuerausgaben/berechnet` — auto-berechnete Soll-Werte (Einfuhr-USt + Umsatzsteuer) je Kategorie/Monat (server-seitig mit den Versions-Einstellungen)
- [ ] Notizen: bestehende Route `GET/PUT/DELETE /api/langfristige-planung/[versionId]/planung-notizen` mit `seite=steuerausgaben`
- [ ] Alle Routen: `requireAuth()` + `ensureLangfristigeVersion()`, Zod-Validierung (UUIDs, `monat` 1–12, `jahr` 2000–2100, Betrag Dezimal **oder null**, negativ erlaubt), Filter nach `user_id` + `plan_version_id`; fremde/unbekannte `versionId` → 404

## Edge Cases

- **Kein „Steuern"-Knoten im KPI-Modell oder keine Kinder:** leerer Zustand mit Hinweis „Keine Steuerkategorien im KPI-Modell vorhanden." + Link zur KPI-Modell-Verwaltung
- **Keine Bestellungen in der langfristigen Bestellplanung:** Einfuhrumsatzsteuer-Zellen leer (keine 0)
- **Fiskalverzollung-Flag nicht gepflegt:** Fallback „nicht fiskalverzollt" (Einfuhr-USt wird berechnet)
- **Kein Ankunfts-/Liefermonat für eine Bestellung:** Bestellung für Einfuhr-USt überspringen
- **Einfuhr-USt-Satz oder Kategorie-USt-Satz = 0 / nicht gepflegt:** Betrag ohne USt-Aufschlag (0 %), kein Fehler
- **Negative Netto-USt (Vorsteuer > Zahllast):** Zelle zeigt negativen Betrag mit grauem/blauem Punkt; Summenzeilen ebenfalls negativ möglich
- **Fälligkeitsmonat (nach Gruppierung + Verschiebung) außerhalb des Horizonts:** Wert wird nicht angezeigt
- **Jahresgrenze in der Quartals-Gruppierung (Q4 → Januar Folgejahr):** korrekte Monats-/Jahresberechnung
- **Planungshorizont nicht gesetzt:** Fallback 12 Monate
- **Grundeinstellungen der Version noch nicht gespeichert:** Standard-Startmonat (aktueller Monat/Jahr) + Default-Horizont (analog PROJ-75), kein Absturz
- **Startmonat-Änderung in den Grundeinstellungen:** Fenster verschiebt sich beim nächsten Laden; manuelle Werte/Notizen bleiben an ihrer Monat/Jahr-Koordinate und erscheinen nur, wenn die Koordinate im Fenster liegt
- **Einzelzelle-Reset auf einer Zelle ohne Auto-Wert (übrige Steuergruppe):** Zelle wird leer, kein grauer Punkt
- **Zelle manuell auf 0 gesetzt:** gültig, `0,00 €` mit blauem Punkt (unterscheidet sich von NULL/leer)
- **Globaler Reset ohne manuelle Werte:** idempotent
- **Kategorie im KPI-Modell gelöscht:** verwaiste manuelle Werte/Notizen werden nicht mehr angezeigt (unschädlich, konsistent mit PROJ-88/91-Muster)
- **Sehr langer Horizont (z. B. 120 Monate):** horizontal scrollbar, Label-Spalte sticky, kein Layout-Bruch
- **API-Fehler bei Berechnung:** betroffene Zellen leer, kein Absturz, Toast-Hinweis
- **Aufruf mit fremder/unbekannter `versionId`:** Redirect zum Dashboard (PROJ-73), kein Datenzugriff

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen versionsgebundenen Tabelle; Versionszugehörigkeit serverseitig prüfen (`ensureLangfristigeVersion`, Defense-in-Depth zur RLS)
- Alle Eingaben serverseitig mit Zod validieren (UUIDs, Monat 1–12, Jahr 2000–2100, Betrag Dezimal oder null — **negativ erlaubt**)
- Neue versionsgebundene Next.js-Seite: `src/app/dashboard/langfristige-planung/[versionId]/steuerausgaben/page.tsx` (nutzt `LangfristigeVersionShell` mit `seitenTitel="Steuerausgaben"` und `fullWidth`)
- Navigation: neuer Eintrag „Steuerausgaben" (Slug `steuerausgaben`) in der Gruppe „Planung" in `src/lib/langfristige-planung-nav.ts`
- Zeilenquelle: globaler `ausgaben_kosten`-KPI-Baum über `GET /api/kpi-categories?type=ausgaben_kosten`; Filter auf „Steuern"-Subtree aus PROJ-71 (`use-steuerausgaben.ts`) übernehmen
- Monatsfenster: aus Startmonat + Horizont ohne Vorlauf (`date-fns`); Helfer analog PROJ-84/88/91 (`buildPlanungsmonate` / monatsbasierter Schlüssel-Helfer)
- Server-seitige `berechnet`-Route: spiegelt PROJ-71-Berechnung (Einfuhr-USt + Umsatzsteuer mit Gruppierung/Verschiebung), parametriert mit den Versions-Einstellungen; Zahlungsverschiebung monatsbasiert statt KW-Rhythmus
- Wiederverwendung: `LangfristigeVersionShell`, `ensureLangfristigeVersion`, Betragsselektion-Muster (`data-betrag-selektion`), `PlanungNotizFormular`, `useLangfristigePlanungNotizen(versionId, 'steuerausgaben')`; berechnet-/manuell-Overlay-Logik analog PROJ-87/91
- shadcn/ui first: Table/Input/Dialog/AlertDialog/Tooltip/Button/Card/Skeleton — alle vorhanden
- Kein neues npm-Paket nötig
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Vorschlag, Verfeinerung in /architecture)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/steuerausgaben/page.tsx` | Seite: Versions-Shell + Tabelle |
| `src/components/langfristige-steuerausgaben-tabelle.tsx` | Hauptkomponente: Monats-Matrix, Gruppen/Untergruppen/Gesamt, Indikatorpunkte, Notizen, Betragsselektion, Einzelzelle-/globaler Reset, Ein-/Ausklappen |
| `src/hooks/use-langfristige-steuerausgaben.ts` | Lädt Grundeinstellungen/KPI-Struktur (Steuern-Subtree)/berechnete Werte/manuelle Overrides der Version; Monatsfenster; upsert/reset; Indikator-Logik |
| `src/app/api/langfristige-planung/[versionId]/steuerausgaben/route.ts` | GET / PUT / DELETE (manuelle Einträge) |
| `src/app/api/langfristige-planung/[versionId]/steuerausgaben/berechnet/route.ts` | GET: server-seitige Auto-Berechnung (Einfuhr-USt + Umsatzsteuer) mit Versions-Einstellungen |
| DB-Migration `create_langfristige_steuerausgaben_planung` | Neue Tabelle + RLS + Indizes |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Steuerausgaben" (Slug `steuerausgaben`) in der Gruppe „Planung" |

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Übernahme der hier geplanten Steuerausgaben in eine spätere Langfristige Liquiditätsauswertung (eigene Spec, analog PROJ-72)
- Optionale Vereinheitlichung der monatsbasierten Zahlungsverschiebungs-/Gruppierungs-Hilfsfunktionen über mehrere langfristige Berechnungs-Routen hinweg

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-22)

### Leitidee

Diese Seite ist die **Schnittmenge zweier bereits gebauter Bauarten**:

1. **Bauart & Bedienung** kommen von den langfristigen Ausgaben-Planungsseiten **ohne Produktdimension** — den nächsten Zwillingen **Operativekosten-Planung (PROJ-88)** und **Finanzierungsausgaben-Planung (PROJ-90)**: eine monatsbasierte, versionsgebundene Tabelle, deren Zeilen die **KPI-Gruppen unter „Steuern"** sind (Gruppe → Untergruppe → Gesamt, **kein** Produkt je Zeile). Jede Zelle ist automatisch **berechnet** (grauer Punkt) und **manuell überschreibbar** (blauer Punkt), mit Einzelzelle-Reset, globalem Reset, Betragsselektion und Zellen-Notizen.
2. **Die Rechen-Schwerarbeit** kommt von der kurzfristigen **Steuerausgaben-Seite (PROJ-71)** und dem Muster der langfristigen **Umsatzausgaben-Berechnung (PROJ-91)**: die `berechnet`-Route führt Daten aus vielen Planungsbereichen zusammen und ermittelt zwei Steuerarten — Einfuhrumsatzsteuer und Umsatzsteuer.

Bewusst **kein** Umbau bestehender Seiten und **kein** Neuerfinden: Versions-Gerüst, Versions-Sicherheitsprüfung, Notiz-Overlay und Betragsselektion werden direkt mitgenutzt. Neu gebaut werden die Seite, ihre Tabelle, ihr Daten-Hook, zwei API-Routen (manuelle Werte + Berechnung) und eine kleine Datenbanktabelle für die manuellen Werte.

Der wesentliche Unterschied zur kurzfristigen Variante: Es gibt **keine Ist-Daten** (die Langfristige Planung kennt keine Transaktionen). Damit entfallen alle Vergangenheits-/Ist-Spalten und der Einfrier-Mechanismus vollständig — jede Monatsspalte ist eine reine Soll-Spalte. Gespeichert wird **nur** die manuelle Überschreibung; alle automatischen Werte werden bei jedem Laden frisch berechnet.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                 (Versions-Übersicht — bestehend)
+-- Gruppe "Planung" erhält Eintrag/Kachel "Steuerausgaben"  (zieht generisch nach)

/dashboard/langfristige-planung/[versionId]/steuerausgaben   (NEUE Seite)
+-- LangfristigeVersionShell  (bestehend — prüft Version, Header/Redirect, Toaster; fullWidth)
    +-- LangfristigeSteuerausgabenTabelle  (NEUE Hauptkomponente)
        +-- Leer-Zustand (wenn kein "Steuern"-Knoten / keine Untergruppen)
        +-- Kopfbereich rechts: "Alle ausklappen" / "Alle einklappen" / "Zurücksetzen"
        +-- Scroll-Container (horizontal, Label-Spalte sticky links, opak)
        |   +-- Kopfzeile: [Label] | [Apr 2026] | [Mai 2026] | ...  (Monate; Jahres-Gruppierungszeile)
        |   +-- [Pro L1-Gruppe unter "Steuern" (immer alle angezeigt)]
        |   |   +-- Gruppen-Header (einklappbar; Summe der Kinder; nicht editierbar)
        |   |   +-- [wenn ausgeklappt UND L2-Untergruppen vorhanden]
        |   |   |     +-- Aggregations-Zeile (Summe; nicht editierbar)
        |   |   |     +-- [pro L2-Untergruppe] editierbare Leaf-Zeile (grau/blau Punkt)
        |   |   +-- [wenn ausgeklappt UND keine Untergruppen]
        |   |         +-- L1-Gruppe selbst als editierbare Leaf-Zeile
        |   +-- Gesamt-Zeile "Steuerausgaben (Gesamt)"   ← GANZ UNTEN (Summe aller Leafs je Monat)
        +-- PlanungNotizFormular            (WIEDERVERWENDET — Notiz-Overlay)
        +-- Betragsselektion-Summenpanel    (WIEDERVERWENDETES Muster, rechts unten)
        +-- Einzelzelle-Reset-Button        (rechts unten, wenn genau 1 manuell überschriebene Zelle fokussiert)
        +-- Zurücksetzen-Bestätigungsdialog (shadcn AlertDialog)
```

Linkes Seitenmenü und Versions-Übersicht rendern die Nav-Gruppen generisch — der neue Eintrag erscheint allein durch die Ergänzung in der zentralen Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`).

**Wichtig — Strukturwahl:** Die Tabelle ist **kategoriebasiert ohne Produktdimension** und folgt damit `operativekosten-planung-tabelle` / `finanzierungsausgaben-planung-tabelle`, **nicht** `langfristige-umsatzausgaben-tabelle` (die eine zusätzliche Produktebene hat). Nur die `berechnet`-Logik orientiert sich an Umsatzausgaben.

### B) Datenmodell (Klartext)

Es entsteht **eine neue, versionsgebundene Tabelle** für die manuellen Überschreibungen. Notizen nutzen die **bereits bestehende** versionsgebundene Notiz-Tabelle (`langfristige_planung_notizen`) über das Feld „Seite".

**Neue Tabelle — „Langfristige Steuerausgaben-Planung" (ein Eintrag je manuell überschriebener Zelle):**
```
Jeder Eintrag hat:
- eindeutige ID
- Besitzer (Nutzer)                        → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion → Isolation
- Verweis auf eine Steuer-Kategorie (globales KPI-Modell, ohne harten Fremdschlüssel)
- Monat (1–12) + Jahr
- Manueller Betrag (Dezimalzahl, DARF NEGATIV sein → USt-Erstattung)
Eindeutigkeit: je (Planversion, Kategorie, Jahr, Monat) genau ein Eintrag.
```

Bewusste, mit PROJ-88/90/91 konsistente Eigenschaften:
- **Nur manuelle Werte werden gespeichert.** Automatische Werte werden nie persistiert — ein vorhandener Eintrag bedeutet immer „manuell überschrieben" (blauer Punkt).
- Der Kategorie-Verweis zeigt auf das **globale** KPI-Modell (die Steuer-Kategoriestruktur ist nicht versionsspezifisch), ohne harten Fremdschlüssel; verschwindet eine Kategorie, wird ihr verwaister Wert einfach nicht mehr angezeigt.
- **Kein Produkt-Verweis** (anders als Umsatzausgaben) — Steuerzeilen sind reine Kategorien.
- **Abweichung zu den Schwester-Tabellen:** Der Betrag darf **negativ** sein (Umsatzsteuer-Erstattung). Bei Operativekosten/Finanzierungsausgaben war er ≥ 0; hier entfällt diese Beschränkung bewusst.

**Notizen — bestehende Tabelle (wiederverwendet):** zusätzliche „Seite" = `steuerausgaben`; Zellkoordinate = Kategorie + Jahr + Monat. Keine neue Notiz-Tabelle, keine neue Notiz-Route.

**Regeln:** Jeder Datensatz ist an Nutzer + Planversion gebunden (Row Level Security + serverseitige Versionsprüfung). Beim Löschen der Planversion verschwinden alle manuellen Werte- und Notiz-Einträge automatisch mit. Fehlt ein manueller Eintrag, zeigt die Zelle den berechneten Wert (oder ist leer).

### C) Welche Spalten (Monate) werden gezeigt?

```
Aus den Grundeinstellungen der Version (PROJ-75):
  Startmonat (Monat + Jahr) und allgemeiner Planungshorizont (Monate); fehlt er → 12.

Erste Spalte  = Startmonat            (KEIN Vorlauf)
Letzte Spalte = Startmonat + (Planungshorizont − 1) Monate
Spaltenanzahl = Planungshorizont
```
Die Monatsabfolge wird sauber über Jahresgrenzen gebildet (gleicher Helfer-Stil wie Operativekosten-/Umsatzausgaben-Planung, die ebenfalls ohne Vorlauf starten). Manuelle Werte/Notizen hängen an ihrer Monat/Jahr-Koordinate; verschiebt der Nutzer später den Startmonat, erscheinen nur die Einträge, deren Koordinate im neuen Fenster liegt.

### D) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Shell prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Die Tabelle lädt parallel:
     ① Grundeinstellungen der Version          → Startmonat + Horizont (Monatsfenster)
     ② globales KPI-Modell (ausgaben_kosten)    → "Steuern"-Subtree (Gruppen + Untergruppen)
     ③ berechnete Soll-Werte der Version        → /steuerausgaben/berechnet (server-seitig)
     ④ gespeicherte manuelle Überschreibungen   → /steuerausgaben (GET)
     ⑤ gespeicherte Notizen der Version (Seite "steuerausgaben")
  → Anzeigewert je Zelle: manueller Wert (blauer Punkt) ELSE berechneter Wert (grauer Punkt) ELSE leer
  → Aggregation (frontend, reaktiv): Untergruppen-, Gruppen- und Gesamtsummen aus den Anzeigewerten

Nutzer bearbeitet eine Zelle (onBlur)
  → optimistische Anzeige + Speichern der einen manuellen Überschreibung; Fehler → Toast + Rücksetzen

Nutzer fokussiert genau 1 überschriebene Zelle → "Auf automatisch zurücksetzen"
  → manueller Eintrag wird gelöscht → Zelle zeigt wieder den berechneten Wert (oder leer)

Nutzer klickt "Zurücksetzen" (global) → Bestätigungsdialog
  → alle manuellen Werte + alle Notizen dieser Seite/Version werden gelöscht

Nutzer selektiert genau 1 editierbare Zelle → "Notiz hinzufügen/bearbeiten"
Betragsselektion: Klick/Ctrl+Klick auf Werte → laufende Summe rechts unten
```

### E) Server-seitige Berechnung — Route `/steuerausgaben/berechnet` (das Herzstück)

Dies ist die komplexeste Route des Features. Sie spiegelt die kurzfristige PROJ-71-Logik, parametriert mit den Einstellungen und Plandaten **dieser** Version, und liefert je Steuer-Kategorie × Monat einen Wert.

**Einfuhrumsatzsteuer — Eingangsdaten (alle der Version):**
```
- Bestellungen + Bestellkosten (PROJ-86)  → Basisbetrag (Ware + Versand + Zoll) je Bestellung; Ankunfts-/Liefermonat
- Steuereinstellungen (PROJ-83)           → Einfuhr-USt-Satz, Zahlungsziel (Tage), Fiskalverzollung je Produkt
Ablauf: fiskalverzollte Produkte überspringen → Basisbetrag × Satz → in Zielmonat
        (Ankunftsmonat + Zahlungsziel) einsortieren → je Zielmonat summieren.
```

**Umsatzsteuer — Eingangsdaten (alle der Version, alle als Soll-Werte):**
```
zu zahlen (A):  Sales-Plattform-Planung (PROJ-87)  → Produktverkäufe (A1)
                Einnahmenplanung (PROJ-89)          → übrige Einnahmen (A2)
abzuziehen (B): Sales-Plattform-Planung (PROJ-87)  → Verkaufsgebühr/Retouren/Marketing (B1)
                Umsatzausgaben (PROJ-91, ohne Mkt.) → Vorsteuer (B2)
                Operativekosten (PROJ-88)           → Vorsteuer (B3)
                Investitionsausgaben (PROJ-92)      → Vorsteuer (B4)
                Finanzierungsausgaben (PROJ-90)     → Vorsteuer (B5)
                Einfuhr-USt (oben berechnet)        → Abzug (B6)
USt-Sätze:      Steuereinstellungen (PROJ-83)       → je Kategorie/Untergruppe, Gesamt/Aufgeteilt
Netto je Monat = (A1+A2) − (B1+B2+B3+B4+B5) − B6   (kann negativ sein)
Gruppierung & Verschiebung (PROJ-83): monatlich → Folgemonat; quartalsweise → Folgemonat des Quartals;
                                      plus Zahlungsverschiebung (Tage), auf Monatsebene abgebildet.
```

**Zentrale Architektur-Entscheidung — woher kommen die „Soll-Werte" der 6 Quellbereiche?**
Da langfristig **keine** Auto-Werte persistiert werden, kann die Steuer-Route die Soll-Werte der Quellseiten nicht einfach aus deren Tabellen lesen. Sie muss die **effektiven Soll-Werte** je Quellbereich **neu ermitteln** = berechneter Wert ODER (falls vorhanden) manuelle Überschreibung dieser Quelle. Empfohlene Bauweise (Detail in `/backend`):
- Die Quell-Berechnungen werden als **wiederverwendbare serverseitige Rechenbausteine** angesprochen (dieselbe Logik, die die `…/berechnet`-Routen von PROJ-87/89/91/88/92/90 nutzen), **plus** das Einlesen der jeweiligen manuellen Overrides je Quelle.
- **Nicht empfohlen:** die fremden `berechnet`-HTTP-Routen intern aufrufen (fragil, langsam). Stattdessen die Rechenlogik in gemeinsam nutzbare Module heben/wiederverwenden.
- Dies ist der **größte Build-Aufwand und das Hauptrisiko** des Features. `/backend` sollte zuerst prüfen, wie weit die bestehenden langfristigen `berechnet`-Routen bereits in wiederverwendbare Funktionen ausgelagert sind, und ggf. behutsam refaktorieren (ohne Verhaltensänderung der bestehenden Seiten).

**Vereinfachung gegenüber kurzfristig (bewusst):** Die kurzfristige PROJ-71 rechnet für B2/B3/B5 die Zahlungsziel-Verschiebung *zurück*, um die Ursprungs-KW der USt zu finden. Langfristig wird der USt-Anfall am **Monat des Brutto-Wertes** der jeweiligen Quellseite festgemacht (die Quellseiten bilden ihre Zahlungsverschiebung bereits monatsbasiert ab). `/backend` entscheidet final, ob eine Rückrechnung nötig ist oder die Brutto-Monatswerte direkt verwendet werden — Letzteres ist die schlankere, konsistente Variante und wird empfohlen.

### F) Tech-Entscheidungen (für PM begründet)

| Entscheidung | Warum |
|---|---|
| Eigene kleine DB-Tabelle nur für manuelle Werte (keine Auto-Werte speichern) | Konsistent mit allen langfristigen Planungsseiten; hält Versionen sauber isoliert; Auto-Werte sind immer „frisch", wenn sich Quell-Pläne ändern |
| Kategoriebasierte Tabelle (kein Produkt je Zeile) | Steuern werden nicht je Produkt geplant; spiegelt PROJ-71 und die Schwester-Seiten Operativekosten/Finanzierungsausgaben |
| Negativ-Beträge erlaubt | Umsatzsteuer kann eine Erstattung sein (Vorsteuer > Zahllast) — fachlich erforderlich |
| Rechenlogik server-seitig in einer `berechnet`-Route bündeln | Steuerberechnung ist datenintensiv (7 Quellen); im Browser unpraktikabel; serverseitig sicher und cache-fähig |
| Wiederverwendung von Quell-Rechenbausteinen statt Duplikat | Vermeidet Logik-Drift: ändert sich z. B. die Umsatzausgaben-Berechnung, zieht die Steuer-USt automatisch nach |
| Notizen über bestehende Versions-Notiz-Tabelle | Kein neues Schema, kein neues Overlay — sofort konsistent mit allen anderen Versions-Seiten |

### G) Abhängigkeiten (Pakete)

Keine neuen npm-Pakete. Verwendet werden ausschließlich bereits vorhandene Bausteine: shadcn/ui (Table, Input, AlertDialog, Tooltip, Button, Card, Skeleton), `date-fns` (Monatsfenster, ISO-Datum), Supabase (DB + RLS), Zod (Validierung) sowie die bestehenden Versions-Bausteine (`LangfristigeVersionShell`, `ensureLangfristigeVersion`, `useLangfristigePlanungNotizen`, Betragsselektion-Muster).

### H) Build-Reihenfolge (Empfehlung für /backend & /frontend)

```
1. DB-Migration: langfristige_steuerausgaben_planung (RLS, Indizes, Negativ-Betrag erlaubt, Cascade)
   ↓
2. Backend: GET/PUT/DELETE /steuerausgaben (manuelle Werte) — schlank, Zwilling zu finanzierungsausgaben-planung
   ↓
3. Backend: /steuerausgaben/berechnet — Einfuhr-USt zuerst (eigenständig, einfacher),
            dann Umsatzsteuer (7 Quellen) inkl. Klärung der Quell-Rechenbaustein-Wiederverwendung
   ↓
4. Frontend: use-langfristige-steuerausgaben Hook (Laden, Indikator-Logik, Monatsfenster, upsert/reset)
   ↓
5. Frontend: langfristige-steuerausgaben-tabelle (adaptiert von operativekosten-/finanzierungsausgaben-planung-tabelle;
            Negativ-Eingabe zulassen; Notizen, Betragsselektion, Resets)
   ↓
6. Frontend: page.tsx + Nav-Eintrag in langfristige-planung-nav.ts
```

### I) Wiederverwendung bestehender Muster

| Muster | Quelle |
|---|---|
| Versions-Shell, Sicherheits-/Redirect-Logik | `langfristige-version-shell.tsx`, `ensureLangfristigeVersion` |
| Kategoriebasierte Monats-Tabelle (Gruppe/Untergruppe/Gesamt) | `operativekosten-planung-tabelle.tsx` / `finanzierungsausgaben-planung-tabelle.tsx` |
| Manuelle-Werte-Route (GET/PUT/DELETE, Upsert, null=löschen) | `…/operativekosten-planung/route.ts` / `…/finanzierungsausgaben-planung/route.ts` |
| Komplexe Mehrquellen-`berechnet`-Route | `…/umsatzausgaben/berechnet/route.ts` (PROJ-91) + kurzfristig `steuerausgaben-planung/berechnet` (PROJ-71) |
| Grau/Blau-Indikatorpunkte, Einzelzelle-Reset, globaler Reset | `langfristige-umsatzausgaben-tabelle.tsx` / `langfristige-sales-plattform-planung-tabelle.tsx` |
| Betragsselektion (`data-betrag-selektion`) | bestehende langfristige Tabellen (PROJ-87/91) |
| Notizen (versionsgebunden) | `useLangfristigePlanungNotizen`, `planung-notizen/route.ts` |
| Monatsfenster-Helfer ohne Vorlauf | `use-langfristige-operativekosten-planung` / `use-langfristige-umsatzausgaben` |
| Steuereinstellungen lesen (USt-Sätze, Frequenz, Einfuhr, Fiskalverzollung) | `…/steuereinstellungen/*` (PROJ-83) |

## QA Test Results (2026-06-24)

**Scope:** Fokus auf die USt-Berechnungs-Route `…/steuerausgaben/berechnet/route.ts` und die jüngsten Fixes (Zahlungsziel-Rückrechnung Vertrieb/Marketing monatsweise, Produktkosten tagesgenau, Ware am Bestelldatum, versions-bewusster Invest-Satz, Gesamt/Aufgeteilt-Auflösung). Geprüft per: bestehender Vitest-Suite, statischem Code-Audit und **datengetriebener Nachrechnung** gegen den Live-DB-Stand (Planversion „Testversion1", Monat Nov 2026).
**Einschränkung:** Kein interaktiver Browser-/E2E-Test der laufenden App möglich (lokal nur anon-Key, keine Auth-Session) → Frontend-Tabelle/Drill-down nicht live getestet.

### Automatisierte Tests
- `steuerausgaben/route.test.ts` + `steuerausgaben/berechnet/route.test.ts`: **25/25 grün** (GET/PUT/DELETE + Smoke 200/400/401/404/500). Die neuen Queries (Plattform-Einstellungen, Kosten-Global, Roh-Bestellkosten, `lp_investition`) brechen die Smoke-Tests nicht.
- `tsc --noEmit`: keine neuen Fehler in der Route.
- **Bekannte Lücke:** Die eigentliche USt-Mathematik (Mehrquellen-Zusammenführung, Gruppierung, Rückrechnung) ist von den Tests **nicht** abgedeckt (nur Smoke) → siehe QA-5.

### Befunde

| # | Schwere | Befund |
|---|---|---|
| QA-1 | ✅ **Behoben (2026-06-24)** | ~~Manuelle Overrides auf Produktkosten (Shipping/Inspektion/Einlagerung/Zoll) UND Ware werden in der USt ignoriert.~~ **Fix:** Manuell überschriebene Zellen dieser 5 Kategorien werden wieder über `umsatzEff` verbucht (Produktkosten monatsweise rückgerechnet, Ware ohne Rückrechnung), und der berechnete Roh-Bestellkosten-Pfad dedupliziert gegen diese manuellen Keys `(Kategorie, Produkt, Zahlungsmonat)` → keine Doppelzählung, keine verlorenen Eingaben. In Testversion1 numerisch unverändert (einziger Override „Inspektion" @ 0 %). 25/25 Tests grün, `tsc` sauber. |
| QA-2 | **Medium** | **Inkonsistenz bei BERECHNETEN Invest-Werten:** Die Invest-Berechnet-Route schlägt USt über die globale Bestellkosten-Kategorie auf (Ware/Einlagerung …), B4 extrahiert jetzt aber den Invest-Gruppensatz. Bei nicht-0 %-Einkauf-Satz → Aufschlag ≠ Extraktion. In Testversion1 unkritisch (Einkauf 0 %, kein berechneter Okt-Invest). Manuelle Invest-Werte (Normalfall) korrekt. |
| QA-3 | **Medium** | **B3 Operativkosten + B5 Finanzierung ohne Zahlungsziel-Rückrechnung**, während die kurzfristige Referenz (PROJ-71) das für `ist_berechnet`-Zeilen tut. Zu verifizieren, ob die langfristigen Operativ-/Finanz-Planwerte am Anfalls- oder am Zahlungsmonat liegen — falls am Zahlungsmonat, fehlt die Rückrechnung. |
| QA-4 | **Low (Daten)** | **SamiBu ohne Produktverkäufe-USt-Satz** → SamiBu-Umsatz erzeugt 0 € Output-USt. Kein Code-Bug, aber wahrscheinlich Datenpflege-Lücke in Testversion1. |
| QA-5 | **Info / High-Risk** | **Keine automatisierten Tests für die USt-Mathematik.** Empfehlung: Integrationstest mit gestubbten Quell-Handlern (sales/umsatz/invest) + realistischen Sätzen, der A1/A2/B1–B6 inkl. Rückrechnung gegen erwartete Werte prüft. |
| QA-6 | **Pre-existing (nicht PROJ-93)** | `investitionsausgaben-planung/berechnet/route.test.ts`: **6 Tests rot** (`TypeError: …reading 'select'` → unvollständiger Test-Mock, **kein** Laufzeit-Bug). Route von PROJ-93 nicht berührt; gehört zu PROJ-92. |

### Nachgerechnete Korrektheit (DB-Reproduktion, Nov 2026, Testversion1)
Die Fixes ergeben ein konsistentes, plausibles Bild: A1 +9.125,99; A2 +4,95; B1 −2.012,53; B2 −1.309,29 (inkl. monatlich gewordenem Lager/Kulanz); B3 −1.185,46; B4 −799,44 (Invest-19 % greift nach Fix); B5 −177,39 (Finanzierung→Aufgeteilt/Zinsen 19 %); B6 −12.121,14; **Netto ≈ −8.474,31 €**. Die Gesamt/Aufgeteilt-Auflösung greift nach dem Fix für alle Domänen.

### Security-Audit (Red-Team)
- **Auth:** `requireAuth()` + `ensureLangfristigeVersion()` — 401/404/400 durch Tests bestätigt. ✓
- **Datenisolierung:** Alle Queries filtern `user_id` + `plan_version_id`; RLS als zweite Linie. ✓
- **Injection:** Ausschließlich Supabase-Query-Builder (parametrisiert), kein roher SQL mit Nutzereingaben. ✓
- **Secrets:** keine im Code/Response. ✓
- **Seiteneffekt:** GET stößt via in-process `umsatzausgabenBerechnetGET` eine Bestellkosten-(Re-)Generierung an (Write bei GET) — **vorbestehendes** Design (PROJ-91), idempotent, auth-geschützt. Durch PROJ-93-Änderungen kein neues Risiko.

### Production-Ready-Einschätzung
**Keine Critical/High-Bugs in der geänderten Logik.** Die Fixes erhöhen die Korrektheit und sind durch Reproduktion plausibilisiert. **QA-1 ist behoben (2026-06-24).** Offen als Folgearbeit: QA-5 (Mathematik-Tests, größter Risikopunkt), QA-2 (berechnet-Invest Aufschlag≠Extraktion), QA-3 (B3/B5-Rückrechnung verifizieren). QA-2/QA-3 sind in Testversion1 unkritisch. Status bleibt **In Review**, bis QA-5 (automatisierte Mathematik-Tests) ergänzt ist.
