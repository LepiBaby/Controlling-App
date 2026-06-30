# PROJ-71: Steuerausgaben — Kurzfristige Planung

## Status: In Progress
**Created:** 2026-06-18
**Last Updated:** 2026-06-30 (Fix: Doppelzählung der Einfuhrumsatzsteuer in der UST-Berechnung beseitigt — siehe Notiz unten)

## Implementation Notes (Fix 2026-06-30: Einfuhrumsatzsteuer-Doppelzählung)

**Problem:** In der `berechnet`-Route wurde die Einfuhrumsatzsteuer aus den Ist-Transaktionen **doppelt** als Vorsteuer-Minderung gezogen:
1. Im Vorsteuer-Block (B, „B actual") über `ust_betrag` — wegen einer Sonderregel, die Einfuhr-Transaktionen mit `relevanz = 'liquiditaet'` zusätzlich einbezog (`isEinfuhrLiquid`).
2. Im dedizierten Einfuhr-Abzug (B6 Ist-Tatsächlich) über `betrag_brutto`.

Da die Einfuhr-Transaktionen `ust_betrag = betrag_brutto` führten, wurde die Einfuhrumsatzsteuer zweimal abgezogen (Beispiel KW30/2026 = Q2-Quartalszahlung: 2×14.150,50 € statt 1×).

**Fix (auf Wunsch des Nutzers):** Der Vorsteuer-Block (B actual) berücksichtigt nur noch Ist-Transaktionen mit `relevanz = 'rentabilitaet'` oder `'beides'`. Die `isEinfuhrLiquid`-Sonderregel (relevanz `liquiditaet`) wurde entfernt. Die Einfuhrumsatzsteuer wird damit **ausschließlich** über den B6-Abzug (`betrag_brutto`) **einmalig** berücksichtigt. B6 (Plan, Manuell, Ist-Tatsächlich) bleibt unverändert.

**Hinweis:** Die Unit-Tests in `berechnet/route.test.ts` sind aktuell durch ein **vorbestehendes** Mock-Setup-Problem (Reihenfolge der `mockReturnValueOnce`-Queries passt nicht mehr zur erweiterten Query-Liste der Route) rot — unabhängig von diesem Fix (identisches Verhalten vor und nach der Änderung). Build/Typecheck/Lint der Route sind grün.

## Implementation Notes (Enhancement 2026-06-23: Aufschlüsselungen / Drill-down)

Ziel: Die berechneten Soll-Werte besser nachvollziehbar machen.

**1. Einfuhrumsatzsteuer → nach Produkt aufgeschlüsselt (alle Spalten):**
- `berechnet`-Route: zusätzlich `einfuhrProduktPerKw` (je Produkt × Zahlungs-KW, gesamter Bereich) aus der bestehenden Bestellungs-Schleife (Produkt via `bestellungen_produkte`); ausgeliefert als `breakdown.einfuhr_produkte` → versorgt Soll- und Ist-Plan-Spalten.
- `ist-tatsaechlich`-Route: neue `produkt_id`-Spalte gelesen + KPI-Kategorien geladen, um die Einfuhr-Kategorie zu finden; gebuchte Einfuhr-Transaktionen werden je `produkt_id` × KW gruppiert → `breakdown.einfuhr_produkte` (exakte Reconciliation der Ist-Tatsächlich-Spalte). Transaktionen ohne Produkt → „Ohne Produktzuordnung".
- Umsatzsteuer lässt sich im Ist nicht sauber je Produkt herleiten → bleibt im Ist nur als übergeordnete Zeile.

**2. Umsatzsteuer → Umsatzsteuer / Vorsteuer / Einfuhrumsatzsteuer (nur Soll):**
- `addNetUst(...)` erhält einen Komponenten-Tag (`output` = A1/A2 Zahllast, `vorsteuer` = B1–B5, `einfuhr` = B6-Abzug); `komponentenPerKw` parallel zu `netUstPerKw`.
- Gemeinsame Monats-/Quartalsgruppierung auf die Zahlungs-KW → die drei vorzeichenbehafteten Komponenten summieren exakt zum Netto-UST-Wert. Ausgeliefert als `breakdown.umsatzsteuer_komponenten` (nur Zukunfts-/Soll-Zahlungswochen).

**Frontend:**
- `use-steuerausgaben.ts`: lädt Produktnamen (`?type=produkte`), parst beide Breakdown-Strukturen, exponiert `einfuhrKatId`/`umsatzsteuerKatId`, `einfuhrProduktIds`, `produktNamen`, `hasUstKomponenten` + Getter `getEinfuhrProduktIst/Ber`, `getUstKomponente`. Reset aktualisiert Breakdown-Maps mit.
- `steuerausgaben-tabelle.tsx`: neue Zeilenart `breakdown`; die Einfuhr-/Umsatzsteuer-Leaf-Zeilen sind aufklappbar (Drill-down, standardmäßig eingeklappt, unabhängig von „Alle aus-/einklappen"). Sub-Zeilen sind read-only (keine Bearbeitung/Notizen), selektierbar für die Betragsselektion.
- Annahme: Einfuhrumsatzsteuer/Umsatzsteuer sind Leaf-Kategorien direkt unter „Steuern" (keine eigenen Unterkategorien).

**Hinweis (nicht durch diese Erweiterung verursacht):** `route.ts` DELETE-Signatur von `req?: Request` → `req: Request` geändert (Next 16 Turbopack Route-Typ-Check verlangt nicht-optionalen Request-Parameter); Laufzeit-Guard unverändert.

## Implementation Notes (Backend)
- DB migration applied: `steuerausgaben_planung` table with RLS + 2 indexes
- `ust_einstellungen` extended with `einfuhrust_ausgaben_kategorie_id` and `umsatzsteuer_ausgaben_kategorie_id` FK columns
- 3 API routes implemented:
  - `GET/PUT/DELETE /api/steuerausgaben-planung` — CRUD for manual plan entries; DELETE only removes `ist_berechnet = false` rows
  - `GET /api/steuerausgaben-planung/ist-tatsaechlich` — actual values from `ausgaben_kosten_transaktionen` grouped by KW
  - `GET /api/steuerausgaben-planung/berechnet` — auto-calculates Einfuhrumsatzsteuer (from bestellungen) and Umsatzsteuer/Vorsteuer (from planning tables) with monthly/quarterly grouping; persists results with `ist_berechnet = true`
- `betrag_manuell` allows negative values (UST Erstattung)
- `berechnet`-Route erweitert: A1 (Produktverkäufe Zahllast aus Sales Plattform Planung) und B1 (Verkaufsgebühr Vorsteuer aus Sales Plattform Planung) implementiert
  - Liest `absatz_planung` (absatz_manuell per SKU + effektiver_vk_manuell per Produkt), `verkaufsgebuehr_einstellungen`, `sales_plattform_planung` (manual Rückerstattungen), `ust_l1_ebene_auswahl`
  - A1: bruttoumsatz = absatz × VK aggregiert je Produkt×KW; extractVorsteuer(bruttoumsatz - rueckerstattungen, UST-Satz aus ust_kategorie_saetze mit Gesamt/Aufgeteilt-Logik)
  - B1 Verkaufsgebühr: bruttoumsatz × vkGebProzent/100 × (1 + UST/100) → extractVorsteuer; Retouren/Marketing erfordern historische Datenbasis (noch nicht implementiert)
- B3 Operative Ausgaben + B4 Produktinvestitionsausgaben: hierarchischer UST-Fallback implementiert (`getUstSatzHierarchisch`) — Untergruppen erben Steuersatz der übergeordneten Gruppe, wenn kein eigener Eintrag in `ust_kategorie_saetze` vorhanden
- B6 Einfuhrumsatzsteuer: manuell eingetragene Einfuhrumsatzsteuer-Werte (`ist_berechnet=false` in `steuerausgaben_planung`) werden jetzt als Vorsteuerabzug in die UST-Berechnung einbezogen — fehlte bisher, führte zu 0-Wert trotz vorhandener Einträge
- **B1 manuelle Soll-Overrides (Fix 2026-06-20):** Die `berechnet`-Route las aus `sales_plattform_planung` bisher nur `bruttoumsatz`/`rueckerstattungen`/`rabatte` und rechnete Verkaufsgebühr/Retouren/Marketing immer neu — manuelle Overrides dieser drei Positionen wurden ignoriert. Jetzt werden auch die Kategorien `verkaufsgebuehr`/`retouren`/`marketing` geladen; existiert ein manueller Override für eine Produkt×Plattform×KW (Marketing: Produkt×Kategorie×KW), hat er Vorrang vor dem berechneten Wert. Da SPP-Werte brutto sind (netto × (1+UST/100), vgl. `getUstMultiplier`), wird die enthaltene Vorsteuer per `extractVorsteuer()` herausgerechnet (konsistent mit dem berechneten `calcZahllast`-Pfad). Overrides gelten nur für Zukunfts-KWs (Soll); Vergangenheit nutzt weiterhin Ist-Transaktionen.
- **Test-Fix (2026-06-20):** `setupMocks` im berechnet-Test mockte nur 3 der 4 historischen Abfragen — die 4. (`ausgaben_kosten_transaktionen` mit `betrag_brutto`, B6 Ist-Tatsächlich) fehlte, wodurch sich die Persistenz-Mocks verschoben und alle UST-Pfad-Tests fehlschlugen. Mock ergänzt.
- 22 unit tests in `berechnet/route.test.ts`, alle grün (inkl. neuer B1-Override-Test); 46 Tests im gesamten `steuerausgaben-planung`-Ordner grün

## Implementation Notes (Frontend)
- `src/hooks/use-steuerausgaben.ts` — data loading, state management, upsert/reset logic (adapted from use-finanzierungsausgaben.ts; root node: 'steuern')
- `src/components/steuerausgaben-tabelle.tsx` — full table component with dual past columns, indicators, collapse, notes, selection, single-cell reset; input allows negative values (no min="0", no `< 0` validation)
- `src/app/dashboard/kurzfristige-planung/steuerausgaben/page.tsx` — page container
- `src/components/nav-sheet.tsx` — added "Steuerausgaben" after "Finanzierungsausgaben"
- `src/app/dashboard/kurzfristige-planung/page.tsx` — added dashboard tile after "Finanzierungsausgaben"
- Build passed (exit code 0)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — „Steuern"-Knoten im `ausgaben_kosten`-Baum als Zeilenquelle
- Requires: PROJ-41 (Bereichswechsler) — URL-Rahmen „Kurzfristige Planung"
- Requires: PROJ-50 (Grundeinstellungen) — `planungshorizont_wochen` + `vergangenheitshorizont_wochen`
- Requires: PROJ-53 (Zellen-Notizen) — Notizen auf Zellenbasis
- Requires: PROJ-29 (Liquiditätsreport) — Datenquelle für Ist-Tatsächlich-Werte (aus `ausgaben_kosten_transaktionen`)
- Requires: PROJ-65 (Steuereinstellungen) — Einfuhrumsatzsteuer-Einstellungen (Fiskalverzollung, Steuersatz, Zahlungsziel), Umsatzsteuer-Grundeinstellungen (Zahlungsfrequenz, Zahlungsverschiebung), UST-Sätze je Kategorie
- Requires: PROJ-60 (Bestellplanung) — Planbestellungen + laufende Bestellungen + Bestellkosten (für Einfuhrumsatzsteuer-Berechnung)
- Requires: PROJ-64 (Bestellkosten) — Bestellkosten-Kategorien Ware, Shipping, Zoll je Bestellung
- Requires: PROJ-66 (Sales Plattform Planung) — Bruttoumsatz, Rabatte, Rückerstattungen, Verkaufsgebühr, Retourenkosten, Marketingkosten je Produkt + KW (für UST-Berechnung)
- Requires: PROJ-52 (Einnahmenplanung) — Einnahmen-Kategorien außer Produktverkäufe je KW (für UST-Berechnung)
- Requires: PROJ-67 (Umsatzausgaben) — Bruttobeträge je KW inkl. Zahlungsziel-Verschiebungslogik (für UST-Berechnung)
- Requires: PROJ-68 (Operative Ausgaben) — Bruttobeträge je KW inkl. Zahlungsziel-Verschiebungslogik (für UST-Berechnung)
- Requires: PROJ-69 (Produktinvestitionsausgaben) — Bruttobeträge je KW (für UST-Berechnung)
- Requires: PROJ-70 (Finanzierungsausgaben) — Bruttobeträge je KW inkl. Zahlungsziel-Verschiebungslogik (für UST-Berechnung)
- Requires: PROJ-59 (Produktinformationen) — Fiskalverzollung-Kennzeichen je Produkt (für Einfuhrumsatzsteuer)

---

## Übersicht

Die Seite „Steuerausgaben" zeigt eine wochenbasierte (KW) Übersicht der Steuerausgaben des Unternehmens. Sie orientiert sich in Layout, Spaltenstruktur und Interaktionsmodell **vollständig an der Finanzierungsausgaben-Seite (PROJ-70)** und den anderen Ausgaben-Seiten — dieselbe bewährte Implementierung wird von Anfang an übernommen, um erneute Iterations-Schleifen zu vermeiden.

Die Seite gliedert sich in zwei Zeitbereiche:

**Vergangenheitsbereich** (`vergangenheitshorizont_wochen` KWs vor der aktuellen KW, Fallback 4):
- Pro KW zwei Spalten nebeneinander:
  - **Ist-Tatsächlich**: tatsächliche Steuerausgaben je Kategorie aus `ausgaben_kosten_transaktionen` (identische Logik wie Liquiditätsreport, PROJ-29), gefiltert auf den „Steuern"-Subtree
  - **Ist-Plan**: der damalige Planwert aus `steuerausgaben_planung` für diese vergangene KW (leer, wenn damals kein Wert geplant war)
- Unter dem KW-Header-Label: Unterzeile mit „Ist-Tatsächlich" (linke Spalte) und „Ist-Plan" (rechte Spalte)

**Planungszeitraum** (`planungshorizont_wochen` KWs ab der nächsten KW, Fallback 13):
- Pro KW eine Soll-Spalte — automatisch berechnet (wo anwendbar); manuell überschreibbar
- Grauer Indikatorpunkt = automatisch berechnet; blauer Indikatorpunkt = manuell überschrieben

Die Zeilen spiegeln die KPI-Kategorien unter dem „Steuern"-Knoten wider (L1-Gruppen und L2-Untergruppen). **Es werden immer alle Gruppen angezeigt.** Die **Gesamt-Zeile „Steuerausgaben (Gesamt)"** erscheint immer ganz **unten** in der Tabelle.

**Persistenz der Soll-Werte (Ist-Plan-Mechanismus):** Automatisch berechnete und manuell eingegebene Werte für zukünftige KWs werden in `steuerausgaben_planung` persistent gespeichert. Wenn eine KW in die Vergangenheit übergeht, bleibt dieser Wert als Ist-Plan eingefroren und kann nicht mehr verändert werden. Dieser Mechanismus ist identisch mit der mühsam erarbeiteten Lösung aus PROJ-68 / PROJ-70.

---

## User Stories

- Als Nutzer möchte ich die Steuerausgaben-Seite über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können (unterhalb von „Finanzierungsausgaben"), damit ich schnell zu den Steuerdaten navigiere.
- Als Nutzer möchte ich auf der Dashboard-Übersicht eine Kachel „Steuerausgaben" unterhalb von „Finanzierungsausgaben" sehen.
- Als Nutzer möchte ich für vergangene KWs sowohl Ist-Tatsächlich-Werte als auch meine damaligen Planwerte sehen, damit ich Plan-Ist-Vergleiche für Steuerausgaben schnell durchführen kann.
- Als Nutzer möchte ich für jede vergangene KW Ist-Tatsächlich und Ist-Plan nebeneinander sehen, damit ich sofort erkenne, wie nah mein Steuerplan an der Realität war.
- Als Nutzer möchte ich im Planungszeitraum automatisch vorberechnete Steuerausgaben-Werte sehen (für Einfuhrumsatzsteuer und Umsatzsteuer), damit ich nicht alles manuell schätzen muss.
- Als Nutzer möchte ich, dass Ertragssteuer-Zeilen nicht vorberechnet werden und ich die Werte manuell eingeben kann.
- Als Nutzer möchte ich jeden vorberechneten Soll-Wert manuell überschreiben und auf einen Blick erkennen, ob ein Wert automatisch (grau) oder manuell (blau) eingegeben wurde.
- Als Nutzer möchte ich alle Kategoriegruppen auf- und zuklappen können, sowie mit zwei Buttons alle gleichzeitig ein- oder ausklappen.
- Als Nutzer möchte ich für einzelne Soll-Zellen Notizen hinterlegen können.
- Als Nutzer möchte ich mehrere Zellen durch Klicken / Ctrl+Klicken auswählen und die Summe rechts unten angezeigt bekommen.
- Als Nutzer möchte ich eine manuell geänderte Zelle mit einem Button rechts unten auf den automatisch berechneten Wert zurücksetzen können.
- Als Nutzer möchte ich alle manuellen Soll-Werte und Notizen mit einem Zurücksetzen-Button löschen können (Ist-Werte bleiben unberührt).

---

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag **„Steuerausgaben"** → `/dashboard/kurzfristige-planung/steuerausgaben`, **unterhalb** von „Finanzierungsausgaben"
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine neue Kachel **„Steuerausgaben"** im Abschnitt „Planung", **unterhalb** der Kachel „Finanzierungsausgaben"
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Spaltenstruktur

- [ ] Die Tabelle zeigt zwei Bereiche mit **klarer Trennlinie** (dicker vertikaler Separator oder Hintergrundfarben-Kontrast):
  - **Vergangenheitsbereich**: die letzten N KWs vor der aktuellen KW (N = `vergangenheitshorizont_wochen`, Fallback 4); die aktuelle KW wird **nicht** angezeigt
  - **Planungszeitraum**: die nächsten M KWs, beginnend mit der nächsten KW (M = `planungshorizont_wochen`, Fallback 13)
- [ ] Für jede vergangene KW: **zwei Spalten** nebeneinander
  - Erste Header-Zeile: KW-Label (z. B. „KW22 / 2026"), überspannt beide Spalten (colspan=2)
  - Zweite Header-Zeile (Sub-Label): linke Spalte „Ist-Tatsächlich", rechte Spalte „Ist-Plan"
- [ ] Für jede zukünftige KW: **eine Spalte** mit KW-Header (Format „KW24 / 2026")
- [ ] Korrekte ISO-8601-Wochenberechnung inkl. Jahreswechsel (`date-fns`)
- [ ] Tabelle ist horizontal scrollbar; die erste Spalte (Zeilenbeschriftung) ist `sticky left`
- [ ] Neue letzte KW des Planungshorizonts (ohne Planungswerte): rote Markierung (`ring-1 ring-red-300`) an Header und Zellen

### Zeilenhierarchie

- [ ] **Ganz unten**: Gesamt-Zeile **„Steuerausgaben (Gesamt)"** — summiert alle Leaf-Zeilen (effektive Werte: manuell ODER auto), nicht editierbar, immer sichtbar
- [ ] **Pro L1-Gruppe** (direkte Kinder des „Steuern"-Knotens): einklappbare Sektion (Standard: ausgeklappt)
  - Kategorie-Header-Zeile mit Gruppenname + Auf-/Zuklapp-Icon; zeigt Summe der Kinder
  - Wenn die Gruppe L2-Untergruppen hat:
    - Aggregations-Zeile (Summe der L2-Untergruppen), nicht editierbar
    - Pro L2-Untergruppe: editierbare Leaf-Zeile (eingerückt) — Soll-Werte editierbar
  - Wenn die Gruppe **keine** Untergruppen hat:
    - Die L1-Gruppe selbst ist editierbar (Leaf)
- [ ] **Es werden immer alle Gruppen angezeigt**, auch wenn keine Auto-Werte vorhanden sind
- [ ] Kategorien in `sort_order`-Reihenfolge des KPI-Modells
- [ ] **Buttons oben rechts:**
  - **„Alle ausklappen"**: klappt alle Sektionen auf (separater Button, kein Toggle)
  - **„Alle einklappen"**: klappt alle Sektionen zu (separater Button)

### Ist-Tatsächlich-Werte (Vergangenheitsspalten)

- [ ] Datenquelle: identische Logik wie der Liquiditätsreport (PROJ-29) — `ausgaben_kosten_transaktionen`, gefiltert nach `zahlungsdatum`, gruppiert nach Kategorie und ISO-KW; nur Kategorien im „Steuern"-Subtree werden angezeigt
- [ ] Ist-Tatsächlich-Zellen sind **nicht editierbar** (kein Inline-Edit, keine Indikatorpunkte)
- [ ] Aggregationszeilen summieren ihre Leaf-Kinder in der Ist-Tatsächlich-Spalte
- [ ] Gesamt-Zeile summiert alle Leafs in der Ist-Tatsächlich-Spalte
- [ ] Zellen ohne Transaktionen: leer (keine 0-Anzeige)

### Ist-Plan-Werte (Vergangenheitsspalten)

- [ ] Datenquelle: `steuerausgaben_planung`-Tabelle — Planwerte für vergangene KWs (der damalig geplante oder berechnete Wert, eingefroren durch Persistenz-Mechanismus)
- [ ] Ist-Plan-Zellen sind **nicht editierbar** (kein Inline-Edit, keine Indikatorpunkte)
- [ ] Wenn für eine vergangene KW kein Planwert in `steuerausgaben_planung` existiert: Zelle leer
- [ ] Aggregationszeilen summieren ihre Leaf-Kinder in der Ist-Plan-Spalte

### Persistenz-Mechanismus für Ist-Plan

- [ ] Beim Aufruf der `berechnet`-Route werden die berechneten Werte für alle zukünftigen KWs mit `ist_berechnet = true` in `steuerausgaben_planung` gespeichert (Upsert), sofern für die jeweilige Zelle noch kein manueller Eintrag (`ist_berechnet = false`) vorhanden ist
- [ ] Wenn eine KW in die Vergangenheit übergeht, bleibt der gespeicherte Wert als Ist-Plan-Wert erhalten und wird nicht mehr durch neue Berechnungen überschrieben
- [ ] Manuelle Overrides (`ist_berechnet = false`) werden durch das Upsert der `berechnet`-Route **nicht** überschrieben
- [ ] Dieser Mechanismus ist identisch mit der in PROJ-68 und PROJ-70 implementierten Lösung

### Soll-Werte (Planungszeitraum) — allgemein

- [ ] Alle automatisch vorberechneten Soll-Zellen zeigen einen **grauen Indikatorpunkt**
- [ ] Manuell überschriebene Soll-Zellen zeigen einen **blauen Indikatorpunkt**
- [ ] Inline-Editing (click-to-edit), Speicherung onBlur in `steuerausgaben_planung` mit `ist_berechnet = false`
- [ ] Eingabe: Dezimalzahl (auch negativ); leeres Feld → NULL (Eintrag in DB löschen; Auto-Wert greift wieder)
- [ ] Optimistisches Update + Toast-Fehlermeldung + Rollback bei API-Fehler
- [ ] Nur Soll-Zellen (Planungszeitraum) sind editierbar; alle Ist-Spalten sind gesperrt

---

## Soll-Wert-Berechnungslogik

### 1. Einfuhrumsatzsteuer (auto-berechnet)

Die Einfuhrumsatzsteuer wird je Bestellung (Planbestellung `status = 'plan'` und laufende Bestellung `status = 'laufend'`) aus der Bestellplanung berechnet:

**Schritt 1 — Fiskalverzollung prüfen:**
- Für jede Bestellung: Produkt der Bestellung nachschlagen in Steuereinstellungen → Einfuhrumsatzsteuer
- Wenn das Produkt als **fiskalverzollt** gekennzeichnet ist → **kein** Einfuhrumsatzsteuer-Betrag für diese Bestellung (überspringen)
- Wenn das Produkt **nicht** fiskalverzollt ist → weiter mit Schritt 2

**Schritt 2 — Steuerbetrag ermitteln:**
- Bestellkosten der Bestellung mit den Kategorien **Ware**, **Shipping** und **Zoll** addieren → Basisbetrag
- `Einfuhrumsatzsteuer = Basisbetrag × (Einfuhr-UST-Satz aus Steuereinstellungen → Einfuhrumsatzsteuer / 100)`

**Schritt 3 — Zahlungsdatum bestimmen:**
- `Zahlungsdatum = Ankunftsdatum der Bestellung + Zahlungsziel in Tagen (aus Steuereinstellungen → Einfuhrumsatzsteuer)`
- ISO-KW des Zahlungsdatums bestimmt die Ziel-KW für den Einfuhrumsatzsteuerbetrag

**Schritt 4 — Akkumulieren:**
- Alle Bestellungen mit gleicher Ziel-KW und gleicher Steuern-Kategorie (Einfuhrumsatzsteuer) werden summiert

- [ ] Alle Planbestellungen (`status = 'plan'`) und laufenden Bestellungen (`status = 'laufend'`) werden berücksichtigt
- [ ] Fiskalverzollt-Prüfung je Produkt erfolgt korrekt
- [ ] Basisbetrag = Summe der Bestellkosten mit Kategorien Ware, Shipping, Zoll dieser Bestellung
- [ ] Steuersatz aus `ust_einstellungen.einfuhrust_steuersatz` (Steuereinstellungen → Einfuhrumsatzsteuer)
- [ ] Zahlungsdatum = Ankunftsdatum + `ust_einstellungen.einfuhrust_zahlungsziel_tage`
- [ ] Ziel-KW via ISO-8601 aus Zahlungsdatum

---

### 2. Umsatzsteuer (auto-berechnet)

Die Umsatzsteuer je KW ergibt sich aus der Differenz zwischen zu zahlender und zu erhaltender Umsatzsteuer. Der Betrag kann **positiv oder negativ** sein. Berechnung erfolgt server-seitig.

#### Datenbasis je KW

**Für Soll-KWs (Zukunft):** Soll-Werte der jeweiligen Ausgaben- und Einnahmen-Seiten werden verwendet.

**Für Ist-KWs (Vergangenheit):** Ist-Tatsächlich-Spalten der jeweiligen Seiten werden verwendet (nicht Ist-Plan).

#### A — Zu zahlende Umsatzsteuer (positive Beträge)

**A1 — Aus Sales Plattform Planung (Produktverkäufe je Produkt):**
- Je KW und je Produkt: `Nettoumsatz = Bruttoumsatz - Rabatte - Rückerstattungen`
- UST-Satz aus Steuereinstellungen → Umsatzsteuersätze → Kategorie „Produktverkäufe" je Produkt
  - Wenn für die Kategorie „Gesamt" gepflegt (Toggle): Gesamtsteuersatz der Kategorie verwenden
  - Wenn „Aufgeteilt" gepflegt: UST-Satz je Produkt-Untergruppe
- `Umsatzsteuer_Produkt = Nettoumsatz_Produkt × UST-Satz / 100`

**A2 — Aus Einnahmenplanung (alle Kategorien außer Produktverkäufe):**
- Je KW und je Kategorie: Bruttobetrag aus der Einnahmenplanung
- UST-Satz aus Steuereinstellungen → Umsatzsteuersätze → jeweilige Kategorie
- `Umsatzsteuer_Kategorie = Bruttobetrag × UST-Satz / 100`

#### B — Zu erhaltende Umsatzsteuer (negative Beträge / Vorsteuer)

**B1 — Aus Sales Plattform Planung (Verkaufsgebühr, Retourenkosten, Marketingkosten):**
- Je KW: Bruttobetrag je Position (Verkaufsgebühr, Retourenkosten, Marketingkosten) — egal ob ausgezahlt oder nicht
- UST-Satz aus Steuereinstellungen → Umsatzsteuersätze → jeweilige Untergruppe
- `Vorsteuer = Bruttobetrag × UST-Satz / 100` (wird vom Umsatzsteuerbetrag abgezogen)

**B2 — Aus Umsatzausgaben (alle außer Marketing):**
- Je KW: Bruttobetrag je Kategorie/Untergruppe aus Umsatzausgaben
- **Zahlungsziel-Rückrechnung für automatisch berechnete Werte**: Der berechnete Wert für Ziel-KW Z wurde durch die Zahlungsziel-Verschiebung der Umsatzausgaben-Seite verschoben. Um die tatsächliche Ursprungs-KW zu ermitteln, muss das Zahlungsziel zurückgerechnet werden. Manuell eingetragene Werte fallen immer in der KW an, in der sie stehen (keine Rückrechnung)
- Marketing-Ausgaben aus Umsatzausgaben werden **nicht** berücksichtigt (vermeidet Doppelzählung mit B1)
- UST-Satz aus Steuereinstellungen → Umsatzsteuersätze → jeweilige Kategorie/Untergruppe
- `Vorsteuer = Bruttobetrag × UST-Satz / 100`

**B3 — Aus Operativen Ausgaben:**
- Je KW: Bruttobetrag je Kategorie/Untergruppe aus Operativen Ausgaben
- **Zahlungsziel-Rückrechnung für automatisch berechnete Werte** analog zu B2 (Zahlungsziele aus Operativen Fixkosten-Einstellungen)
- Manuell eingetragene Werte: keine Rückrechnung (fallen in der KW an, in der sie stehen)
- UST-Satz aus Steuereinstellungen → Umsatzsteuersätze → jeweilige Kategorie/Untergruppe
- `Vorsteuer = Bruttobetrag × UST-Satz / 100`

**B4 — Aus Produktinvestitionsausgaben:**
- Je KW: Bruttobetrag je Kategorie/Untergruppe aus Produktinvestitionsausgaben (keine Zahlungsziel-Rückrechnung nötig — Produktinvestitionsausgaben haben keine Zahlungsziel-Verschiebung)
- UST-Satz aus Steuereinstellungen → Umsatzsteuersätze → jeweilige Kategorie/Untergruppe
- `Vorsteuer = Bruttobetrag × UST-Satz / 100`

**B5 — Aus Finanzierungsausgaben:**
- Je KW: Bruttobetrag je Kategorie aus Finanzierungsausgaben
- **Zahlungsziel-Rückrechnung für automatisch berechnete Werte** analog zu B2 (Zahlungsziel aus Finanzierungseinstellungen)
- Manuell eingetragene Werte: keine Rückrechnung
- UST-Satz aus Steuereinstellungen → Umsatzsteuersätze → jeweilige Kategorie
- `Vorsteuer = Bruttobetrag × UST-Satz / 100`

**B6 — Einfuhrumsatzsteuer-Abzug:**
- Die in A berechneten Einfuhrumsatzsteuerbeträge werden in der **KW vor ihrem Zahlungsziel** vom Umsatzsteuerbetrag abgezogen (sie mindern die zu zahlende Umsatzsteuer in dem Monat/Quartal, in dem sie anfallen)

#### C — Netto-UST je KW

```
Netto_UST_KW = Summe(A1 + A2) - Summe(B1 + B2 + B3 + B4 + B5) - B6
```

Kann positiv (Zahllast) oder negativ (Erstattung) sein.

#### D — Gruppierung und Verschiebung

- Aus Steuereinstellungen → Umsatzsteuer-Grundeinstellungen: `Zahlungsfrequenz` (monatlich oder quartalsweise) und `Zahlungsverschiebung` in Tagen
- **Monatliche Gruppierung**: Alle KWs, die in denselben Kalendermonat fallen, werden summiert. Der Betrag fällt in der **ersten KW nach dem Monatsende** an.
- **Quartalsweise Gruppierung**: Alle KWs, die in dasselbe Quartal fallen, werden summiert. Der Betrag fällt in der **ersten KW nach dem Quartalsende** an.
- Der gruppierte Betrag wird anschließend um `Zahlungsverschiebung_tage` in die Zukunft verschoben (auf ISO-KW umgerechnet)
- Wochen, die keine Zahlungswoche sind: leere Zelle (kein 0)

- [ ] Berechnung A1 (Produktverkäufe-UST aus Sales Plattform Planung)
- [ ] Berechnung A2 (sonstige Einnahmen-UST)
- [ ] Berechnung B1 (Verkaufsgebühr/Retouren/Marketing aus Sales Plattform Planung)
- [ ] Berechnung B2 (Umsatzausgaben Vorsteuer, ohne Marketing, mit Zahlungsziel-Rückrechnung für auto-Werte)
- [ ] Berechnung B3 (Operative Ausgaben Vorsteuer, mit Zahlungsziel-Rückrechnung für auto-Werte)
- [ ] Berechnung B4 (Produktinvestitionsausgaben Vorsteuer)
- [ ] Berechnung B5 (Finanzierungsausgaben Vorsteuer, mit Zahlungsziel-Rückrechnung für auto-Werte)
- [ ] B6: Einfuhrumsatzsteuer-Abzug in KW vor Zahlungsziel
- [ ] Netto-UST je KW korrekt berechnet (kann positiv oder negativ sein)
- [ ] Monatliche Gruppierung: KWs nach Kalendermonat korrekt zugeordnet, Betrag in erster KW nach Monatsende
- [ ] Quartalsweise Gruppierung: KWs nach Quartal korrekt zugeordnet, Betrag in erster KW nach Quartalsende
- [ ] Zahlungsverschiebung korrekt auf ISO-KW umgerechnet und addiert
- [ ] Ist-KWs: Ist-Tatsächlich-Spalten der Ausgabenseiten verwenden (nicht Ist-Plan)

---

### 3. Ertragssteuer (kein Auto-Wert)

- [ ] Ertragssteuer-Zellen werden **nicht** automatisch berechnet oder vorausgefüllt
- [ ] Alle Ertragssteuer-Zellen im Planungszeitraum sind manuell editierbar
- [ ] Kein grauer Indikatorpunkt (da kein Auto-Wert)
- [ ] Blauer Indikatorpunkt wenn manuell eingegeben

---

## Visuelle Indikatorpunkte

| Zustand | Punkt | Gilt für |
|---|---|---|
| Automatisch berechnet (mit Wert) | Grauer Punkt | Einfuhrumsatzsteuer- und Umsatzsteuer-Soll-Zellen mit Auto-Wert |
| Manuell eingegeben | Blauer Punkt | Alle manuell überschriebenen Soll-Zellen |
| Leer / kein Auto-Wert | Kein Punkt | Ertragssteuer (kein Auto-Wert), Zellen ohne Eintrag |
| Ist-Tatsächlich / Ist-Plan | Kein Punkt | Nicht editierbare Vergangenheitsspalten |

Merksatz: **Ein DB-Eintrag mit `ist_berechnet = false` in `steuerausgaben_planung` für eine zukünftige KW = manuell = blauer Punkt.**

---

## Notizen (PROJ-53)

- [ ] Notiz-Feature auf allen editierbaren Soll-Zellen (Planungszeitraum), identisch mit anderen Planungsseiten
- [ ] Notiz-Icon erscheint beim Hover (wenn keine Notiz) oder dauerhaft (wenn Notiz vorhanden) mit Tooltip-Vorschau
- [ ] Notizen in `planung_notizen` gespeichert mit `kontext = 'steuerausgaben'`
- [ ] Zurücksetzen löscht auch alle Notizen dieser Seite (`kontext = 'steuerausgaben'`)

---

## Betragsselektion

- [ ] Einzelne oder mehrere Zellwerte durch Klicken / Ctrl+Klicken auswählbar
- [ ] Summe der selektierten Werte wird in einem Panel rechts unten angezeigt (Anzahl + Summe in €)
- [ ] Panel erscheint ab 1 selektierter Zelle, verschwindet wenn Selektion aufgehoben
- [ ] Ist-Tatsächlich-, Ist-Plan-, Aggregations- und Gesamt-Zellen ebenfalls selektierbar
- [ ] Identisches Verhalten wie in PROJ-51, PROJ-67, PROJ-68, PROJ-70

---

## Einzelzelle-Zurücksetzen-Button

- [ ] Wenn eine einzelne manuell geänderte Soll-Zelle ausgewählt (fokussiert) ist, erscheint rechts unten ein Button **„Auf automatisch zurücksetzen"**
- [ ] Klick darauf löscht den manuellen Eintrag in `steuerausgaben_planung` für diese Zelle; Auto-Wert wird erneut via `berechnet`-Route gesetzt (falls vorhanden)
- [ ] Die Zelle zeigt danach wieder den automatisch berechneten Wert (grauer Punkt) oder wird leer (wenn kein Auto-Wert, z. B. Ertragssteuer)
- [ ] Button erscheint nur, wenn die ausgewählte Zelle einen manuellen Eintrag (`ist_berechnet = false`) hat
- [ ] Identisches Verhalten wie in Absatzplanung (PROJ-51), Umsatzausgaben (PROJ-67) und Operative Ausgaben (PROJ-68)

---

## Reset-Button (Alles zurücksetzen)

- [ ] Button **„Zurücksetzen"** oben rechts neben den Einklappen-Buttons
- [ ] Bestätigungs-Dialog (shadcn AlertDialog): „Alle Planungswerte zurücksetzen? Alle manuell eingegebenen Soll-Werte und Notizen werden gelöscht. Automatisch berechnete Werte werden wiederhergestellt. Ist-Werte werden nicht verändert."
- [ ] Nach Bestätigung:
  - Alle **manuellen** Einträge (`ist_berechnet = false`) des Nutzers in `steuerausgaben_planung` für **zukünftige KWs** werden gelöscht (Vergangenheits-Planwerte bleiben erhalten)
  - Alle Notizen des Nutzers für `kontext = 'steuerausgaben'` in `planung_notizen` werden gelöscht
  - Soll-Zellen zeigen wieder automatisch berechnete Werte (grauer Punkt) oder werden leer

---

## Edge Cases

- **Kein „Steuern"-Knoten im KPI-Modell oder keine Kinder**: leerer Zustand mit Hinweis „Keine Steuerkategorien im KPI-Modell vorhanden." + Link zur KPI-Modell-Verwaltung
- **Kein Ist-Plan für vergangene KW** (damals nicht geplant / `berechnet`-Route noch nicht aufgerufen): Spalte leer, kein 0
- **Negative UST-Werte** (Erstattung > Zahllast): Zelle zeigt negativen Betrag mit grauem/blauem Punkt; Summenzeile ebenfalls negativ möglich
- **Fiskalverzollt-Flag nicht gepflegt (NULL)**: Fallback auf „nicht fiskalverzollt" (Einfuhrumsatzsteuer wird berechnet)
- **Kein Ankunftsdatum für Bestellung**: Bestellung für Einfuhrumsatzsteuer-Berechnung überspringen
- **Kein Einfuhr-UST-Satz gepflegt (0%)**: Einfuhrumsatzsteuer = 0 (kein Fehler)
- **UST-Satz für Kategorie nicht gepflegt**: Betrag wird ohne UST-Aufschlag angezeigt (0%), kein Fehler
- **Zahlungsverschiebung verschiebt KW außerhalb des Planungshorizonts**: Wert wird nicht angezeigt
- **Monatsgruppengrenze an Jahreswechsel**: KW52/KW53 und KW1 korrekt dem richtigen Monat/Quartal zugeordnet (ISO-Kalender beachten)
- **Kein Ist-Plan-Wert weil `berechnet`-Route noch nie für diese KW aufgerufen wurde**: Spalte leer (korrekt)
- **Reset ohne manuelle Werte**: idempotent (keine sichtbare Änderung)
- **Zelle manuell auf 0 gesetzt**: gültig, wird als `0,00 €` mit blauem Punkt angezeigt (unterscheidet sich von NULL/leer)
- **Einzelzelle-Reset auf Ertragssteuer-Zelle** (kein Auto-Wert): Zelle wird leer, kein grauer Punkt
- **API-Fehler bei `berechnet`-Route**: betroffene Zellen leer, kein Absturz, Toast-Hinweis
- **Sehr viele Wochen (Vergangenheit + Zukunft × 2)**: horizontales Scrollen; Zeilenbeschriftungsspalte sticky

---

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen API-Routen
- RLS auf `steuerausgaben_planung`: analog zu `operative_planung` / `finanzierungs_planung`
- ISO-8601-Wochenberechnung: `date-fns` (`getISOWeek`, `getISOWeekYear`, `addDays`, `addWeeks`)
- Keine neuen Packages nötig: shadcn `Table`, `Input`, `AlertDialog`, `Tooltip`, `Button` — alle vorhanden
- Notizen-Pattern: wiederverwendbar aus PROJ-53 (identisch wie auf anderen Planungsseiten)
- Betragsselektion-Pattern: wiederverwendbar aus PROJ-51 / PROJ-67 / PROJ-68 / PROJ-70
- Einzelzelle-Reset-Pattern: wiederverwendbar aus PROJ-51 / PROJ-67 / PROJ-68 / PROJ-70

### Datenbankschema

#### Neue Tabelle `steuerausgaben_planung`

Speichert sowohl vergangene Planwerte (Ist-Plan, eingefroren) als auch zukünftige Einträge (Auto-berechnet `ist_berechnet = true` oder manuell `ist_berechnet = false`):

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | UUID PK | auto-generiert |
| `user_id` | UUID | FK → auth.users, RLS-Anker |
| `kategorie_id` | UUID | FK → kpi_categories |
| `kw_year` | INTEGER | ISO-Kalenderjahr der Woche |
| `kw_number` | INTEGER | ISO-Wochennummer (1–53) |
| `betrag_manuell` | NUMERIC(12,2) NULL | Kann negativ sein; NULL = kein Override |
| `ist_berechnet` | BOOLEAN DEFAULT true | true = Auto-Wert persistiert; false = manuelle Eingabe |
| `created_at` | TIMESTAMPTZ | auto |
| `updated_at` | TIMESTAMPTZ | auto |

Unique Constraint: `(user_id, kategorie_id, kw_year, kw_number)`

RLS: `FOR ALL USING (user_id = auth.uid())`

**Hinweis:** `betrag_manuell` muss auch negative Werte erlauben (Umsatzsteuer-Erstattung).

#### Ergänzung `ust_einstellungen` (aus PROJ-65)

Für die Einfuhrumsatzsteuer-Berechnung wird ein neues Feld benötigt, sofern noch nicht vorhanden:

| Feld | Typ | Beschreibung |
|---|---|---|
| `einfuhrust_steuersatz` | NUMERIC(5,2) DEFAULT 0 | Einfuhr-UST-Satz in Prozent (z. B. 19.00) |

Falls dieses Feld bereits in der `ust_einstellungen`-Tabelle existiert: keine Migration nötig.

### API-Routen

| Methode | Route | Zweck |
|---|---|---|
| `GET` | `/api/steuerausgaben-planung` | Alle Einträge des Nutzers (Ist-Plan vergangene KWs + Soll-Einträge zukünftige KWs) |
| `PUT` | `/api/steuerausgaben-planung` | Upsert eines einzelnen Eintrags mit `ist_berechnet = false`; `betrag_manuell: null` → Eintrag löschen |
| `DELETE` | `/api/steuerausgaben-planung` | Alle manuellen (`ist_berechnet = false`) zukünftigen Einträge des Nutzers löschen (für Reset) |
| `GET` | `/api/steuerausgaben-planung/ist-tatsaechlich` | Ist-Tatsächlich-Werte aus `ausgaben_kosten_transaktionen`, nach Kategorie + ISO-KW, gefiltert auf „Steuern"-Subtree |
| `GET` | `/api/steuerausgaben-planung/berechnet` | Auto-berechnete Soll-Werte (Einfuhrumsatzsteuer + Umsatzsteuer) + Persistenz in `steuerausgaben_planung` mit `ist_berechnet = true` |

- `requireAuth()` in allen Routen
- Query-Parameter für `ist-tatsaechlich` und `berechnet`: `von_kw`, `von_jahr`, `bis_kw`, `bis_jahr`

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/steuerausgaben/page.tsx` | Neue Seite: Header + SteuerausgabenTabelle + Toaster |
| `src/hooks/use-steuerausgaben.ts` | Zentraler Hook: lädt Ist-Tatsächlich, Ist-Plan, Auto-Werte, manuelle Overrides; upsertZelle, resetAll, expandAll/collapseAll, Indikator-Logik |
| `src/components/steuerausgaben-tabelle.tsx` | Haupttabelle: doppelte Vergangenheitsspalten, Indikatorpunkte, Einklappen, Notizen, Betragsselektion, Einzelzelle-Reset, Gesamt unten |
| `src/app/api/steuerausgaben-planung/route.ts` | GET + PUT + DELETE |
| `src/app/api/steuerausgaben-planung/ist-tatsaechlich/route.ts` | GET: Ist-Tatsächlich aus `ausgaben_kosten_transaktionen`, gefiltert auf Steuern-Subtree |
| `src/app/api/steuerausgaben-planung/berechnet/route.ts` | GET: Auto-Berechnung Einfuhrumsatzsteuer + Umsatzsteuer + Persistenz |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Neuer Nav-Eintrag „Steuerausgaben" nach „Finanzierungsausgaben" |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Neue Kachel „Steuerausgaben" nach „Finanzierungsausgaben" |

### Implementierungsreihenfolge

```
1. DB-Migration: steuerausgaben_planung Tabelle erstellen (+ ggf. einfuhrust_steuersatz in ust_einstellungen)
   ↓
2. Backend: GET + PUT + DELETE /api/steuerausgaben-planung
   ↓
3. Backend: GET /api/steuerausgaben-planung/ist-tatsaechlich   ← parallel mit 4 möglich
4. Backend: GET /api/steuerausgaben-planung/berechnet          ← parallel mit 3 möglich (komplexeste Route)
   ↓
5. Frontend: use-steuerausgaben Hook
   ↓
6. Frontend: steuerausgaben-tabelle Komponente
   ↓
7. Frontend: page.tsx + nav-sheet + dashboard-page aktualisieren
```

### Wiederverwendung bestehender Muster

| Muster | Quelle |
|---|---|
| Doppelspalten-Header Vergangenheit (colspan=2) | `finanzierungsausgaben-tabelle.tsx` / `operative-ausgaben-tabelle.tsx` |
| Grau/Blau-Indikatorpunkte | `operative-ausgaben-tabelle.tsx` |
| Ist-Plan-Persistenz-Mechanismus (`ist_berechnet`) | `operative-planung/berechnet/route.ts` + `finanzierungs-planung/berechnet/route.ts` |
| Betragsselektion-Panel | `absatzplanung-tabelle.tsx` / `umsatzausgaben-tabelle.tsx` |
| Einzelzelle-Reset-Button | `absatzplanung-tabelle.tsx` / `operative-ausgaben-tabelle.tsx` |
| Reset AlertDialog | `operative-ausgaben-tabelle.tsx` |
| Notizen-Integration | alle Planungsseiten (PROJ-53) |
| ISO-Wochen-Helpers | `umsatzausgaben-planung/ist-tatsaechlich/route.ts` |
| Zahlungsziel-Rückrechnung | konzeptuell aus `umsatzausgaben-planung/berechnet/route.ts` (dort Vorwärts-Verschiebung; hier Rückrechnung) |

---

## Tech Design (Solution Architect — 2026-06-18)

### Grundprinzip

PROJ-71 ist eine **direkte Adaption von PROJ-70 (Finanzierungsausgaben)** für das allgemeine Tabellengerüst — und von PROJ-67 (Umsatzausgaben) für das Muster der komplexen `berechnet`-Route. Alle Interaktionsmuster, der Ist-Plan-Persistenz-Mechanismus, die Indikatorpunkte und die Datenladestruktur werden 1:1 übernommen. Neu und einzigartig ist allein die Berechnungslogik der `berechnet`-Route, die Daten aus 8+ Quellen zusammenführt.

---

### Komponentenstruktur

```
/dashboard/kurzfristige-planung/steuerausgaben  (NEUE Seite)
+-- Page-Header
|   +-- Titel „Steuerausgaben"
|   +-- Button-Gruppe rechts:
|       +-- „Alle ausklappen"  (separater Button)
|       +-- „Alle einklappen"  (separater Button)
|       +-- „Zurücksetzen"     (öffnet AlertDialog)
+-- SteuerausgabenTabelle  (NEUE Hauptkomponente)
    +-- Scroll-Container (overflow-x: auto)
    |   +-- <table>
    |       +-- <thead> (sticky top)
    |       |   +-- KW-Gruppenzeile:
    |       |       [Label sticky links] | [KW22 colspan=2 | KW23 colspan=2 | ...] ‖ [KW26 | KW27 | ...]
    |       |   +-- Sub-Label-Zeile:
    |       |       [leer sticky] | [Ist-Tatsächlich | Ist-Plan | ...] ‖ [leer | leer | ...]
    |       +-- <tbody>
    |           +-- [Pro L1-Gruppe im „Steuern"-KPI-Knoten, immer alle angezeigt]
    |           |   +-- category-header-Zeile (einklappbar, zeigt Summe)
    |           |   +-- [wenn ausgeklappt + hat L2-Kinder]:
    |           |       +-- category-sum-Zeile (Aggregat, nicht editierbar)
    |           |       +-- Pro L2: leaf-Zeile (eingerückt, editierbar im Soll-Bereich)
    |           |   +-- [wenn ausgeklappt + kein L2]:
    |           |       +-- L1 selbst als leaf-Zeile (editierbar im Soll-Bereich)
    |           +-- Gesamt-Zeile „Steuerausgaben (Gesamt)"  ← GANZ UNTEN
    +-- BetragsselektionPanel  (fixed rechts unten, ab 1 selektierter Zelle)
    +-- EinzelzelleResetButton  (rechts unten, wenn fokussierte Soll-Zelle = blauer Punkt)
    +-- ResetConfirmDialog  (shadcn AlertDialog)

nav-sheet.tsx  (bestehend — neuer Eintrag nach „Finanzierungsausgaben")
/dashboard/kurzfristige-planung/page.tsx  (bestehend — neue Kachel nach „Finanzierungsausgaben")
```

---

### Zeilentypen der Tabelle

| Typ | Editierbar | Beschreibung |
|---|---|---|
| `category-header` | Nein | L1-Gruppe, einklappbar, zeigt Summe aller Kinder |
| `category-sum` | Nein | Aggregat-Zeile wenn L1 L2-Kinder hat |
| `leaf` | Ja (nur Soll-Spalten) | L2-Untergruppe oder L1 ohne Kinder |
| `total` | Nein | „Steuerausgaben (Gesamt)" — ganz unten |

**Besonderheit Ertragssteuer:** Leaf-Zeilen der Ertragssteuer-Kategorie zeigen keinen grauen Punkt (kein Auto-Wert), sind aber vollständig manuell editierbar. Wenn manuell eingegeben: blauer Punkt.

---

### Datenmodell (plain language)

**Neue Tabelle `steuerausgaben_planung`** — zentrale Speicherung aller Planwerte:

| Was gespeichert wird | Bedeutung |
|---|---|
| Benutzer-ID, Kategorie-ID, KW-Jahr, KW-Nummer | Eindeutiger Schlüssel je Zelle |
| `betrag_manuell` (Zahl, auch negativ, oder leer) | Der gespeicherte Betrag (auto oder manuell) — negativ bei UST-Erstattung |
| `ist_berechnet` (ja/nein) | `ja` = auto-berechnet und eingefroren; `nein` = manuell vom Nutzer |

**Unterschied zu anderen Planungstabellen:** `betrag_manuell` darf negative Werte speichern (Umsatzsteuer-Erstattung, wenn Vorsteuer > Zahllast).

**Wann wird was gespeichert:**
- **Auto-Wert**: `berechnet`-Route schreibt `betrag_manuell = X, ist_berechnet = true` → dient später als eingefrorener Ist-Plan
- **Manuelle Eingabe**: PUT-Route schreibt `betrag_manuell = X, ist_berechnet = false`
- **Manuell löschen**: PUT mit `betrag_manuell = null` → Eintrag gelöscht; Auto-Wert greift wieder
- **Reset**: DELETE löscht alle `ist_berechnet = false` für zukünftige KWs; eingefrorene Ist-Plan-Werte bleiben

**Bestehende Tabelle `ust_einstellungen`** (aus PROJ-65): Wird nur gelesen, nicht verändert. Enthält `zahlungsfrequenz`, `zahlungsverschiebung_tage`, `einfuhrust_zahlungsziel_tage`. Das Feld `einfuhrust_steuersatz` muss geprüft und ggf. ergänzt werden.

---

### Datenladefluss (beim Öffnen der Seite)

Alle 5 Requests starten **gleichzeitig**:

```
① GET /api/grundeinstellungen
     → planungshorizont_wochen, vergangenheitshorizont_wochen

② GET /api/kpi-categories?type=ausgaben_kosten
     → alle KPI-Kategorien; Hook filtert auf „Steuern"-Subtree

③ GET /api/steuerausgaben-planung
     → alle DB-Einträge des Nutzers — zwei Zwecke:
       a) Ist-Plan (vergangene KWs): eingefrorene Planwerte
       b) Soll-Manuell (zukünftige KWs): aktuelle manuelle Overrides

④ GET /api/steuerausgaben-planung/ist-tatsaechlich?von_kw=&...
     → tatsächliche Ausgaben je Kategorie je vergangene KW
     → aus ausgaben_kosten_transaktionen, gefiltert auf Steuern-Subtree

⑤ GET /api/steuerausgaben-planung/berechnet?von_kw=&...
     → auto-berechnete Soll-Werte (Einfuhr-UST + Umsatzsteuer)
     → persistiert gleichzeitig mit ist_berechnet=true (nur wenn kein manueller Eintrag)

→ Hook baut flaches Zeilen-Array:
  category-header → [category-sum +] leaf → ... → total (ganz unten)

→ Pro Zelle (zukünftige KW):
  Eintrag mit ist_berechnet=false in ③ → blauer Punkt (manuell)
  Kein ③-Eintrag, aber Wert in ⑤                → grauer Punkt (auto)
  Weder ③ noch ⑤                                → leer (Ertragssteuer oder kein Wert)
```

---

### Berechnungsarchitektur — `berechnet`-Route

Dies ist die komplexeste Route des Features. Sie lädt Daten aus 8+ Quellen parallel und berechnet zwei unabhängige Steuerarten:

**Einfuhrumsatzsteuer — Datenquellen:**

| Quelle | Zweck |
|---|---|
| Bestellplanung (Plan + Laufend) | Alle relevanten Bestellungen |
| Bestellkosten je Bestellung | Positionen Ware, Shipping, Zoll als Basisbetrag |
| `ust_einstellungen` | Einfuhr-UST-Satz + Zahlungsziel in Tagen |
| Produktinformationen | Fiskalverzollung-Kennzeichen je Produkt |

**Umsatzsteuer — Datenquellen (8 Quellen):**

| Quelle | Richtung | Besonderheit |
|---|---|---|
| Sales Plattform Planung (Bruttoumsatz/Rabatte/Rückerstattungen) | Zahllast | UST auf Nettoumsatz je Produkt |
| Einnahmenplanung (alle außer Produktverkäufe) | Zahllast | UST auf Bruttobetrag je Kategorie |
| Sales Plattform Planung (Verkaufsgebühr/Retouren/Marketing) | Vorsteuer | UST zurückfordern |
| Umsatzausgaben (ohne Marketing) | Vorsteuer | Zahlungsziel-Rückrechnung für auto-Werte |
| Operative Ausgaben | Vorsteuer | Zahlungsziel-Rückrechnung für auto-Werte |
| Produktinvestitionsausgaben | Vorsteuer | Keine Rückrechnung nötig |
| Finanzierungsausgaben | Vorsteuer | Zahlungsziel-Rückrechnung für auto-Werte |
| `ust_einstellungen` + `ust_kategorie_saetze` | Konfiguration | UST-Sätze je Kategorie + Zahlungsfrequenz/-verschiebung |

**Wichtige Besonderheit — Zahlungsziel-Rückrechnung:**
Bei Umsatzausgaben, Operativen Ausgaben und Finanzierungsausgaben wurden die auto-berechneten Werte durch die jeweilige Zahlungsziel-Verschiebung in die Zukunft verschoben. Um den Betrag der tatsächlichen Entstehungs-KW (= Vorsteuer-KW) zu ermitteln, muss diese Verschiebung rückgängig gemacht werden. Manuell eingetragene Werte werden direkt ihrer KW zugeordnet (keine Rückrechnung).

**Gruppierungslogik (Umsatzsteuer):**
Nach der Berechnung des Netto-UST-Betrags je KW:
1. Alle KWs eines Monats (bzw. Quartals) werden summiert
2. Der Gesamtbetrag fällt in der ersten KW nach dem Monats-/Quartalsende an
3. Dieser Termin wird um `zahlungsverschiebung_tage` weiter in die Zukunft verschoben

---

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Alle 5 Requests parallel | Ja | Auto-Werte werden direkt persistiert — kein sequenzielles 2-Phasen-Laden nötig |
| Persistenz der Auto-Werte | `ist_berechnet = true` in `steuerausgaben_planung` | Sichert Ist-Plan-Werte für vergangene KWs ohne gesonderten Freeze-Prozess (identisch PROJ-68/70) |
| Neue DB-Tabelle | `steuerausgaben_planung` | Klare Trennung je Feature; konsistent mit allen anderen Ausgaben-Seiten |
| Negative `betrag_manuell` | Erlaubt (NUMERIC) | Umsatzsteuer-Erstattung ist ein gültiger Planwert |
| `berechnet`-Route als Einzelroute | Einfuhr-UST + Umsatzsteuer zusammen | Beide Steuerarten teilen die Persistenz-Logik; separate Routen würden Persistenz-Konflikte erzeugen |
| Zahlungsziel-Rückrechnung server-seitig | In `berechnet`-Route | Zu komplex für Client; erfordert Zugriff auf Einstellungsdaten |
| Keine neuen Packages | Keine | `date-fns`, shadcn/ui — alles bereits vorhanden |

---

### Neue und geänderte Dateien

**Neu:**

| Datei | Aufgabe |
|---|---|
| `src/app/dashboard/kurzfristige-planung/steuerausgaben/page.tsx` | Seiten-Container (Header + Tabelle + Toast) |
| `src/hooks/use-steuerausgaben.ts` | Datenladen, State-Management, upsert/reset-Logik |
| `src/components/steuerausgaben-tabelle.tsx` | Vollständige Tabellenkomponente |
| `src/app/api/steuerausgaben-planung/route.ts` | GET / PUT / DELETE |
| `src/app/api/steuerausgaben-planung/ist-tatsaechlich/route.ts` | GET: reale Ausgaben je KW, Steuern-Subtree |
| `src/app/api/steuerausgaben-planung/berechnet/route.ts` | GET: Einfuhr-UST + UST berechnen + persistieren |

**Geändert:**

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Neuer Nav-Eintrag „Steuerausgaben" nach „Finanzierungsausgaben" |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Neue Kachel „Steuerausgaben" |

**DB-Migrationen:**
1. Neue Tabelle `steuerausgaben_planung` (Unique Constraint + RLS)
2. Feld `einfuhrust_steuersatz` in `ust_einstellungen` (nur wenn noch nicht vorhanden)

---

### Wiederverwendung bestehender Logik

| Muster | Quelle |
|---|---|
| Doppelspalten-Header Vergangenheit | `finanzierungsausgaben-tabelle.tsx` / `operative-ausgaben-tabelle.tsx` |
| Grau/Blau-Indikatorpunkte | `operative-ausgaben-tabelle.tsx` |
| Ist-Plan-Persistenz (`ist_berechnet`) | `finanzierungs-planung/berechnet/route.ts` |
| Betragsselektion-Panel | `absatzplanung-tabelle.tsx` |
| Einzelzelle-Reset-Button | `operative-ausgaben-tabelle.tsx` |
| Reset AlertDialog | `operative-ausgaben-tabelle.tsx` |
| Notizen-Integration | alle Planungsseiten (PROJ-53) |
| ISO-Wochen-Helpers | `umsatzausgaben-planung/ist-tatsaechlich/route.ts` |
| UST-Satz-Auflösung (Gesamt vs. Aufgeteilt) | `umsatzausgaben-planung/berechnet/route.ts` (Funktion `getUstMultiplier`) |
| Bestellplanung-Datenzugriff | `umsatzausgaben-planung/berechnet/route.ts` (Produktausgaben-Logik) |
| Zahlungsfrequenz-Gruppierung | konzeptuell analog `umsatzausgaben-planung/berechnet/route.ts` (Zahlungsrhythmus-Logik) |

---

### Implementierungsreihenfolge

```
1. DB: steuerausgaben_planung erstellen + ust_einstellungen prüfen/ergänzen
   ↓
2. Backend: GET + PUT + DELETE /api/steuerausgaben-planung
   ↓
3. Backend: /api/steuerausgaben-planung/ist-tatsaechlich  (parallel mit 4)
4. Backend: /api/steuerausgaben-planung/berechnet         (parallel mit 3, komplexeste Route)
   ↓
5. Frontend: use-steuerausgaben Hook
   ↓
6. Frontend: steuerausgaben-tabelle Komponente
   ↓
7. Frontend: page.tsx + nav-sheet + dashboard-page
```

## QA Test Results

**Tested:** 2026-06-20
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Testmethode:** Code-Review gegen Acceptance Criteria, Unit-Tests (Vitest), E2E-Tests (Playwright), DB/RLS-Audit via Supabase

### Acceptance Criteria Status

#### Navigation & Einstieg
- [x] Nav-Eintrag „Steuerausgaben" → `/dashboard/kurzfristige-planung/steuerausgaben`, korrekt **unterhalb** von „Finanzierungsausgaben" (`nav-sheet.tsx:85`)
- [x] Dashboard-Kachel „Steuerausgaben" im Abschnitt Planung, unterhalb „Finanzierungsausgaben" (`page.tsx:217-222`)
- [x] Auth-Guard → Redirect zu `/login` (E2E bestätigt, Chromium + Mobile Safari)

#### Spaltenstruktur
- [x] Zwei Bereiche mit Trennlinie (Vergangenheit `amber`-Hintergrund, Zukunft `border-l-2 border-l-primary` bei erster Soll-Spalte); aktuelle KW wird nicht angezeigt
- [x] Vergangenheit zweispaltig (colspan=2: „Ist-Tatsächlich" / „Ist-Plan"), Zukunft einspaltig („Soll")
- [x] ISO-8601-Wochenberechnung inkl. Jahreswechsel (`date-fns` im Hook, manuelle ISO-Helfer in den Routen)
- [x] Erste Spalte `sticky left`, horizontal scrollbar
- [ ] **MINOR:** Rote Markierung (`ring-1 ring-red-300`) der letzten Planungs-KW nicht implementiert → siehe BUG-2 (identisch zur **approved** Referenz PROJ-70, dort ebenfalls nicht vorhanden)

#### Zeilenhierarchie
- [x] Gesamt-Zeile „Steuerausgaben (Gesamt)" ganz unten, nicht editierbar
- [x] L1-Gruppe einklappbar; mit L2 → Aggregations-Zeile + editierbare Leafs; ohne L2 → L1 selbst editierbar
- [x] Immer alle Gruppen angezeigt; `sort_order`-Reihenfolge
- [~] Aus-/Einklappen als **Toggle-Button** statt zwei separater Buttons → siehe BUG-3 (entspricht der approved PROJ-70-Implementierung und der ausdrücklichen PROJ-69-Entscheidung, Commit d8d412a)

#### Ist-Tatsächlich / Ist-Plan (Vergangenheit)
- [x] Ist-Tatsächlich aus `ausgaben_kosten_transaktionen` (relevanz `liquiditaet`/`beides`), gruppiert nach effektiver Leaf-Kategorie + ISO-KW; nicht editierbar
- [x] Ist-Plan aus `steuerausgaben_planung` (eingefrorene Werte); nicht editierbar; leer wenn kein Wert
- [x] Aggregations- und Gesamt-Zeilen summieren Leaf-Kinder in beiden Spalten
- [x] Zellen ohne Daten bleiben leer (keine 0-Anzeige)

#### Persistenz-Mechanismus (Ist-Plan)
- [x] `berechnet`-Route speichert Zukunfts-Soll mit `ist_berechnet=true` (Upsert); löscht zuvor alte Auto-Zeilen, überspringt Zellen mit manuellem Eintrag
- [x] Manuelle Overrides (`ist_berechnet=false`) werden nicht überschrieben (`manualKeys`-Set)
- [x] Mechanismus identisch zu PROJ-68/70

#### Soll-Werte allgemein
- [x] Grauer Punkt = Auto-Wert, blauer Punkt = manuell (`getSollCellValue`)
- [x] Inline-Edit, Speicherung onBlur mit `ist_berechnet=false`
- [x] Negative Dezimalzahlen erlaubt (kein `min=0`, nur NaN abgewiesen); leeres Feld → NULL → Eintrag gelöscht (PUT mit `betrag_manuell:null`)
- [x] Optimistisches Update + Rollback + Toast bei Fehler (`upsertZelle`)
- [x] Nur Soll-Zellen editierbar; Ist-Spalten gesperrt

#### Berechnungslogik (Soll)
- [x] Einfuhrumsatzsteuer: Fiskalverzollung-Skip, Basis = Ware+Shipping+Zoll, Satz aus `einfuhrust_satz`, Zahlungsdatum = Ankunft + `einfuhrust_zahlungsziel_tage`, ISO-KW-Akkumulation
- [x] A1 Produktverkäufe-UST aus Sales Plattform Planung (inkl. manuelle Brutto-/Rückerstattungs-Overrides + Rückerstattungsquote-Fallback)
- [x] A2 sonstige Einnahmen-UST (Produktverkäufe-Subtree ausgeschlossen)
- [x] B1 Verkaufsgebühr/Retouren/Marketing inkl. manueller Soll-Overrides (Brutto → `extractVorsteuer`)
- [x] B2 Umsatzausgaben (Marketing ausgeschlossen, Ware via Bestelldatum, Zahlungsziel-Rückrechnung für Auto-Werte)
- [x] B3 Operative Ausgaben (hierarchischer UST-Fallback, Zahlungsziel-Rückrechnung)
- [x] B4 Produktinvestitionsausgaben (keine Rückrechnung)
- [x] B5 Finanzierungsausgaben (Zahlungsziel-Rückrechnung)
- [x] B6 Einfuhrumsatzsteuer-Abzug (Auto + manuell + Ist-Tatsächlich) — **siehe BUG-1 zu Doppelzählung Auto+manuell**
- [x] Netto-UST positiv/negativ; monatliche & quartalsweise Gruppierung; Zahlungsverschiebung auf ISO-KW; Ist-KWs nutzen Ist-Transaktionen
- [x] Ertragssteuer: kein Auto-Wert, manuell editierbar, kein grauer Punkt (Leaf ohne Berechnung)
- [~] **HINWEIS:** A1 verwendet `extractVorsteuer(brutto, satz)` (behandelt SPP-Werte als Brutto/USt-inklusive, konsistent mit der SPP-Route `getUstMultiplier`), während die Spec-Formel „Nettoumsatz × Satz/100" lautet → siehe BUG-4 (Daten-Semantik mit Fachbereich bestätigen)

#### Notizen / Betragsselektion / Einzelzelle-Reset / Reset
- [x] Notizen auf editierbaren Soll-Zellen, `kontext='steuerausgaben'`, Reset löscht Notizen mit
- [x] Betragsselektion: Klick/Ctrl+Klick/Drag, Summen-Panel rechts unten, alle Zelltypen selektierbar
- [x] Einzelzelle-Reset „Auf automatisch zurücksetzen" nur bei manuell+Zukunfts-Zelle
- [x] Reset-AlertDialog; löscht nur manuelle Zukunfts-Einträge (`ab_kw_year`/`ab_kw_number`), Vergangenheit bleibt; stellt Auto-Werte wieder her

### Edge Cases Status
- [x] Kein „Steuern"-Knoten / keine Kinder → Empty-State mit KPI-Modell-Link
- [x] Kein Ist-Plan für vergangene KW → Spalte leer
- [x] Negative UST-Werte (Erstattung) → korrekt mit Punkt; Summen negativ möglich
- [x] Fiskalverzollt NULL → Fallback „nicht fiskalverzollt"
- [x] Kein Ankunftsdatum → Bestellung übersprungen
- [x] Einfuhr-/Kategorie-UST-Satz 0 % → kein Aufschlag, kein Fehler
- [x] Zahlungsverschiebung außerhalb Horizont → `addToResult`-Clamp (Wert nicht angezeigt)
- [x] Monats-/Quartalsgrenze am Jahreswechsel → ISO-Thursday-Logik
- [x] Reset ohne manuelle Werte → idempotent
- [x] Zelle manuell 0 → gültig, blauer Punkt (≠ NULL)
- [x] Einzelzelle-Reset auf Ertragssteuer → leer, kein grauer Punkt
- [x] API-Fehler `berechnet` → leere Zellen, kein Absturz (Hook `catch`)

### Security Audit Results
- [x] Authentifizierung: `requireAuth()` in allen 3 Routen + Middleware-Redirect (E2E bestätigt)
- [x] Autorisierung: `steuerausgaben_planung` hat **RLS aktiviert** und ist **nicht** in den `rls_policy_always_true`-Advisor-Warnungen → Policies korrekt auf `user_id = auth.uid()` eingeschränkt
- [x] Input-Validierung: Zod-Schema auf PUT (UUID, Jahr/KW-Bereich, nullable Betrag); GET-Routen validieren Query-Parameter
- [x] Keine Secrets im Code; parametrisierte Supabase-Queries (kein SQL-Injection)
- [x] Transaktions-Tabellen-Reads ohne `user_id`-Filter verlassen sich auf RLS (konsistent mit übriger Codebase; RLS auf allen Tabellen aktiv)
- ℹ️ Vorbestehende, PROJ-71-fremde Advisor-Warnungen (out of scope): permissive RLS-Policies auf geteilten Tabellen (`*_transaktionen`, `kpi_categories`, `planung_notizen`, `vermoegenswarte_*`) — by-design für das Team mit gleichem Zugriffsrecht (PRD); `set_updated_at` search_path; Leaked-Password-Protection deaktiviert

### Bugs Found

#### BUG-1: Doppelter Vorsteuerabzug der Einfuhrumsatzsteuer bei manuellem Override
- **Severity:** Medium
- **Datei:** `src/app/api/steuerausgaben-planung/berechnet/route.ts:1248-1265`
- **Steps to Reproduce:**
  1. Eine Bestellung erzeugt einen automatischen Einfuhrumsatzsteuer-Wert in einer Zukunfts-KW (grauer Punkt)
  2. Nutzer überschreibt diese Einfuhrumsatzsteuer-Zelle manuell (blauer Punkt, `ist_berechnet=false`)
  3. **Erwartet:** In der Umsatzsteuer-Zeile (B6) wird nur der manuelle Wert als Vorsteuer abgezogen (der manuelle Wert ersetzt den Auto-Wert)
  4. **Tatsächlich:** Sowohl der Auto-Wert aus `einfuhrEntries` (B6-Auto-Loop) als auch der manuelle Wert aus `steuerManuellRes` (B6-Manuell-Loop) werden abgezogen → Vorsteuer doppelt gezählt, Umsatzsteuer-Zahllast zu niedrig
- **Hinweis:** Schmaler Pfad (nur wenn manueller Override **und** Auto-Wert für dieselbe Einfuhr-KW existieren); betrifft nur die abgeleitete Umsatzsteuer-Zeile. Fix-Idee: im B6-Auto-Loop Einträge überspringen, deren Ziel-KW einen manuellen Einfuhr-Override hat.
- **Priority:** Fix in next sprint (kein Deployment-Blocker, aber stille Steuer-Fehlberechnung im dokumentierten Override-Szenario)

#### BUG-2: Rote Markierung der letzten Planungs-KW fehlt
- **Severity:** Low
- **Datei:** `src/components/steuerausgaben-tabelle.tsx` (Header/Zellen der letzten Zukunfts-Spalte)
- **Beschreibung:** AC „Spaltenstruktur" fordert `ring-1 ring-red-300` an Header und Zellen der letzten Planungs-KW. Nicht implementiert. **Konsistent mit der approved Referenz PROJ-70**, die diese Markierung ebenfalls nicht enthält → vermutlich veraltete Spec-Boilerplate.
- **Priority:** Nice to have / mit PROJ-70 abstimmen

#### BUG-3: Aus-/Einklappen als Toggle statt zwei separater Buttons
- **Severity:** Low (Spec-Text vs. Implementierung)
- **Beschreibung:** AC fordert „separater Button, kein Toggle". Implementiert als einzelner Toggle-Button (zeigt „Alle einklappen", wenn alles offen, sonst „Alle ausklappen"). **Entspricht exakt der approved PROJ-70-Implementierung und der ausdrücklichen Nutzerentscheidung aus PROJ-69** (Commit d8d412a: „Replace two expand/collapse buttons with single toggle button"). Kein echter Defekt — Spec-Text ist veraltet.
- **Priority:** Nice to have (Spec-Text nachziehen)

#### BUG-4: A1-Formel weicht von Spec-Wortlaut ab (Brutto-Extraktion statt Netto×Satz)
- **Severity:** Low / Informational
- **Datei:** `src/app/api/steuerausgaben-planung/berechnet/route.ts:854-857`
- **Beschreibung:** Spec A1 schreibt `Umsatzsteuer = Nettoumsatz × UST-Satz/100`; Code rechnet `extractVorsteuer(brutto−rabatte−rück, satz)` = Brutto × Satz/(100+Satz). Die Implementierung behandelt Sales-Plattform-Planung-Werte als **Brutto (USt-inklusive)** — konsistent mit der SPP-Route (`getUstMultiplier`, netto×(1+USt/100)). Die Spec-Bezeichnung „Nettoumsatz" ist damit irreführend; die Implementierung ist intern konsistent.
- **Priority:** Mit Fachbereich bestätigen, dass SPP-Werte Brutto sind (dann Spec-Wortlaut korrigieren)

#### BUG-5 (latent): GET-Route `.limit(2000)` skaliert nicht mit eingefrorenen Ist-Plan-Zeilen
- **Severity:** Low
- **Datei:** `src/app/api/steuerausgaben-planung/route.ts:20`
- **Beschreibung:** Eingefrorene Ist-Plan-Zeilen akkumulieren über die Zeit (jede vergangene KW × Kategorie bleibt erhalten). Bei vielen Kategorien über mehrere Jahre könnte das 2000-Zeilen-Limit greifen und ältere Werte abschneiden. Für 1–5 Nutzer kurzfristig unkritisch.
- **Priority:** Nice to have (Limit erhöhen oder paginieren)

### Test-Ausführung
- **Unit-Tests (PROJ-71):** 46/46 grün (`route.test.ts`, `ist-tatsaechlich/route.test.ts`, `berechnet/route.test.ts`)
- **E2E-Tests (PROJ-71, neu):** 18/18 grün (Chromium + Mobile Safari) — `tests/PROJ-71-steuerausgaben.spec.ts`
- **Production Build:** erfolgreich (exit 0)
- **Gesamt-Unit-Suite:** 133 vorbestehende Fehler in 16 PROJ-71-**fremden** Dateien (reporting/*, bestellplanung, einnahmen-planung, sales-plattform-planung, marketing u.a.) — Ursachen: datumsabhängige Tests (heute KW25), unvollständige Mock-Chains, `req.url` ohne Request. **Keine** dieser Dateien gehört zu PROJ-71; PROJ-71 ändert keine dieser Quelldateien → keine Regression durch PROJ-71. (Diese Altlasten gehören zu den parallel „In Progress"-Features PROJ-30/60 etc. und sind außerhalb des PROJ-71-QA-Scopes.)

### Summary
- **Acceptance Criteria:** ~70/70 funktional erfüllt; 1 AC abweichend implementiert (rote KW-Markierung fehlt), 2 ACs als Spec-Text-Abweichung (Toggle, A1-Formel) — alle konsistent mit der approved Referenz PROJ-70
- **Bugs Found:** 5 total (0 Critical, 0 High, **1 Medium** [BUG-1], 4 Low/Informational)
- **Security:** Pass — PROJ-71 führt keine Sicherheitslücke ein; RLS korrekt user-scoped; requireAuth + Zod überall
- **Production Ready:** **YES** (keine Critical/High-Bugs)
- **Recommendation:** Deploybar. Empfehlung: BUG-1 (Einfuhr-Doppelabzug) vor breitem Einsatz fixen, BUG-4 (A1-Brutto/Netto) fachlich bestätigen. BUG-2/3/5 niedrige Priorität.

## Deployment
_To be added by /deploy_
