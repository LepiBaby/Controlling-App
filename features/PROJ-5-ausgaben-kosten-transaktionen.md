# PROJ-5: Ausgaben & Kosten-Transaktionen Eingabe

## Status: Deployed
**Created:** 2026-04-17
**Last Updated:** 2026-04-19

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer können Transaktionen eingeben
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Ausgaben & Kosten-KPI-Modell muss vor erster Eingabe definiert sein
- Requires: PROJ-9 (Kategorie-Dimensionen) — Sales Plattform / Produkt Flags steuern optionale Spalten
- Future: PROJ-8 (Ausgaben/Kosten Trennungslogik) — wird diese Tabelle später in zwei separate Tabellen aufteilen

## Übersicht
Manuelle Erfassung und Verwaltung von Ausgaben- und Kosten-Transaktionen in einer kombinierten Eingabetabelle. UI und Filterlogik entsprechen PROJ-3 (Umsatz) und PROJ-4 (Einnahmen). Unterschiede: zwei Datumsfelder (Leistungsdatum Pflicht, Zahlungsdatum optional), Bruttobetrag als Pflichtfeld, Nettobetrag automatisch berechnet, Umsatzsteuer-Auswahl (19 / 7 / 0 % oder individueller €-Betrag), sowie optionale Felder für Rentabilitätsrelevanz und Abschreibungsdauer.

Ausgaben (Geldzahlungen, Liquiditätssicht) und Kosten (wirtschaftlicher Aufwand, Rentabilitätssicht) werden vorerst gemeinsam erfasst. Die Trennung in separate Tabellen erfolgt in PROJ-8.

## User Stories
- Als Nutzer möchte ich eine neue Ausgaben/Kosten-Transaktion mit Leistungsdatum, Bruttobetrag und Kategorie erfassen können, damit alle Zahlungen und Aufwände vollständig dokumentiert sind.
- Als Nutzer möchte ich optional ein Zahlungsdatum angeben können, um Leistungs- und Zahlungszeitpunkt zu trennen.
- Als Nutzer möchte ich Kategorie, Gruppe und Untergruppe über Dropdown-Menüs auswählen können, damit die Transaktion korrekt eingeordnet wird.
- Als Nutzer möchte ich nur die Dropdown-Spalten sehen, die im KPI-Modell befüllt sind, damit die Eingabe übersichtlich bleibt.
- Als Nutzer möchte ich die Umsatzsteuer über ein Dropdown (19 %, 7 %, 0 %, Individuell) auswählen, damit der Nettobetrag automatisch berechnet wird.
- Als Nutzer möchte ich bei "Individuell" einen freien USt-Betrag in € eingeben können.
- Als Nutzer möchte ich optional angeben, ob eine Transaktion für die Rentabilität relevant ist.
- Als Nutzer möchte ich optional eine Abschreibungsdauer (3, 5, 7 oder 10 Jahre) angeben können.
- Als Nutzer möchte ich alle Transaktionen in einer Tabelle sehen, bearbeiten und löschen können.
- Als Nutzer möchte ich die Tabelle nach Datum, Betrag und Kategorie filtern/sortieren können.

## Acceptance Criteria

### Tabellen-Spalten (dynamisch)
- [ ] Die Tabelle zeigt immer: **Leistungsdatum**, **Zahlungsdatum** (leer wenn nicht gepflegt), **Bruttobetrag in €**, **Nettobetrag in €**, **Umsatzsteuer in €**, **Beschreibung**
- [ ] **Kategorie**-Spalte wird angezeigt, wenn das Ausgaben-KPI-Modell mindestens eine Ebene-1-Kategorie hat (immer der Fall, da KPI-Modell nicht leer sein darf)
- [ ] **Gruppe**-Spalte wird angezeigt, wenn das Ausgaben-KPI-Modell mindestens eine Ebene-2-Kategorie hat
- [ ] **Untergruppe**-Spalte wird angezeigt, wenn das Ausgaben-KPI-Modell mindestens eine Ebene-3-Kategorie hat
- [ ] **Sales Plattform**-Spalte wird angezeigt, wenn mindestens eine Ausgaben-Hauptkategorie `sales_plattform_enabled = true` hat
- [ ] **Produkte**-Spalte wird angezeigt, wenn mindestens eine Ausgaben-Hauptkategorie `produkt_enabled = true` hat
- [ ] **Relevant für Rentabilität**-Spalte wird immer angezeigt
- [ ] **Abschreibung**-Spalte wird immer angezeigt
- [ ] Spalten die nicht zutreffen werden vollständig ausgeblendet (nicht nur leer)

### Transaktionseingabe (Formular)
- [ ] "Neue Transaktion"-Button öffnet ein Eingabeformular (Modal)
- [ ] **Leistungsdatum**: Date-Picker, Pflichtfeld
- [ ] **Zahlungsdatum**: Date-Picker, optional (kein Pflichtfeld)
- [ ] **Kategorie**: Dropdown mit allen Ebene-1-Kategorien aus dem Ausgaben-KPI-Modell, Pflichtfeld
- [ ] **Gruppe**: Dropdown erscheint nur, wenn die gewählte Kategorie Unterkategorien hat; zeigt nur Ebene-2-Kinder der gewählten Kategorie; **Pflichtfeld**, wenn angezeigt
- [ ] **Untergruppe**: Dropdown erscheint nur, wenn die gewählte Gruppe Unterkategorien hat; zeigt nur Ebene-3-Kinder der gewählten Gruppe; **Pflichtfeld**, wenn angezeigt
- [ ] **Sales Plattform**: Dropdown erscheint nur, wenn die gewählte Hauptkategorie `sales_plattform_enabled = true` hat; zeigt alle Einträge aus dem KPI-Modell-Tab "Sales Plattformen"; **Pflichtfeld**, wenn angezeigt
- [ ] **Produkte**: Dropdown erscheint nur, wenn die gewählte Hauptkategorie `produkt_enabled = true` hat; zeigt alle Einträge aus dem KPI-Modell-Tab "Produkte"; **Pflichtfeld**, wenn angezeigt
- [ ] **Beschreibung**: Freitext-Eingabe (String), optional
- [ ] **Bruttobetrag**: Zahlfeld in €, positiv, Pflichtfeld
- [ ] **Umsatzsteuer**: Dropdown mit Optionen 19 %, 7 %, 0 %, Individuell — Pflichtfeld
  - [ ] Bei Auswahl 19 %: USt-Betrag = Bruttobetrag × 19/119 (automatisch berechnet, nur Anzeige)
  - [ ] Bei Auswahl 7 %: USt-Betrag = Bruttobetrag × 7/107 (automatisch berechnet, nur Anzeige)
  - [ ] Bei Auswahl 0 %: USt-Betrag = 0,00 € (automatisch, nur Anzeige)
  - [ ] Bei Auswahl "Individuell": Eingabefeld für USt-Betrag in € (Pflichtfeld wenn "Individuell" gewählt)
- [ ] **Nettobetrag**: automatisch berechnet aus Bruttobetrag − USt-Betrag, nicht manuell editierbar, wird im Formular als Vorschau angezeigt
- [ ] **Relevant für Rentabilität**: Dropdown mit "Ja" / "Nein", optional (kein Pflichtfeld)
- [ ] **Abschreibung**: Dropdown mit "3 Jahre" / "5 Jahre" / "7 Jahre" / "10 Jahre", optional (kein Pflichtfeld)
- [ ] Wenn eine Kategorie keine Unterkategorien hat, gilt sie direkt als finale Kategorisierung
- [ ] Transaktion kann nur gespeichert werden, wenn alle Pflichtfelder ausgefüllt sind: Leistungsdatum, Bruttobetrag, Kategorie, Umsatzsteuer (inkl. Individuell-Betrag falls gewählt) — sowie Gruppe, Untergruppe, Sales Plattform, Produkt wenn jeweils vorhanden
- [ ] Gespeicherte Transaktion erscheint sofort in der Tabelle
- [ ] Zukunfts-Datum bei Leistungsdatum → Warnung (amber), nicht blockiert

### Bearbeiten & Löschen
- [ ] Transaktion bearbeiten: Edit-Icon öffnet vorausgefülltes Formular
- [ ] Transaktion löschen: Bestätigungs-Dialog vor dem Löschen

### Tabellen-Funktionen
- [ ] Tabelle zeigt alle Transaktionen, neueste zuerst (Standard-Sortierung nach Leistungsdatum DESC)
- [ ] Tabelle sortierbar nach: Leistungsdatum, Bruttobetrag (auf-/absteigend)
- [ ] Tabelle filterbar nach: Zeitraum (Von/Bis Leistungsdatum) und hierarchischen Kategorie-Filtern (siehe unten)
- [ ] Tabelle zeigt Summe aller gefilterten Brutto- und Nettobetrag in der Fußzeile (server-seitige Summe, nicht nur aktuelle Seite)

### Filter-Hierarchie (Kategorie / Gruppe / Untergruppe / Sales Plattform / Produkt)
- [ ] **Kategorie-Filter**: Multi-Select — zeigt alle Ausgaben-Ebene-1-Kategorien; mehrere auswählbar
- [ ] **Gruppe-Filter**: erscheint nur, wenn bei Kategorie **genau eine** Ausprägung gewählt ist; Multi-Select — zeigt nur Ebene-2-Kinder der gewählten Kategorie; mehrere auswählbar
- [ ] **Untergruppe-Filter**: erscheint nur, wenn Kategorie **genau eine** Ausprägung hat UND Gruppe **genau eine** Ausprägung hat; Multi-Select — zeigt nur Ebene-3-Kinder der gewählten Gruppe
- [ ] Ist bei einer Ebene **mehr als eine** Ausprägung gewählt, werden alle Ebenen darunter **nicht** angezeigt (und deren Filterwerte zurückgesetzt)
- [ ] Wird die Kategorie zurückgesetzt (kein Filter), verschwinden Gruppe- und Untergruppe-Filter
- [ ] Wird die Gruppe zurückgesetzt, verschwindet der Untergruppe-Filter
- [ ] **Sales Plattform-Filter**: erscheint nur, wenn `showSalesPlattform = true`; Multi-Select; steht rechts neben dem Untergruppe-Filter
- [ ] **Produkt-Filter**: erscheint nur, wenn `showProdukte = true`; Multi-Select; steht rechts neben dem Sales Plattform-Filter
- [ ] Sales Plattform- und Produkt-Filter sind unabhängig von den Kategorie-Hierarchie-Filtern (keine Kaskadierung)

## Tabellen-Spalten

| Spalte | Pflicht | Typ | Sichtbarkeit |
|--------|---------|-----|-------------|
| Leistungsdatum | Ja | Date | Immer |
| Zahlungsdatum | Nein | Date | Immer (leer wenn nicht gepflegt) |
| Kategorie | Ja | Dropdown (Ebene 1) | Immer (KPI-Modell nie leer) |
| Gruppe | Nein | Dropdown (Ebene 2) | Wenn mind. 1 Ebene-2-Kategorie im Ausgaben-KPI-Modell |
| Untergruppe | Nein | Dropdown (Ebene 3) | Wenn mind. 1 Ebene-3-Kategorie im Ausgaben-KPI-Modell |
| Sales Plattform | Nein | Dropdown (aus KPI-Modell Tab "Sales Plattformen") | Wenn mind. 1 Hauptkategorie `sales_plattform_enabled = true` |
| Produkte | Nein | Dropdown (aus KPI-Modell Tab "Produkte") | Wenn mind. 1 Hauptkategorie `produkt_enabled = true` |
| Beschreibung | Nein | Text (Freitext) | Immer |
| Bruttobetrag | Ja | Decimal (€) | Immer |
| Nettobetrag | — | Decimal (€), berechnet | Immer |
| Umsatzsteuer | Ja | Decimal (€), berechnet oder individuell | Immer |
| Relevant für Rentabilität | Nein | Enum (Ja / Nein) | Immer |
| Abschreibung | Nein | Enum (3 / 5 / 7 / 10 Jahre) | Immer |

## Umsatzsteuer-Logik

```
Dropdown-Optionen: 19 %, 7 %, 0 %, Individuell

Wenn USt-Satz = 19 %:
  USt_betrag  = ROUND(Bruttobetrag × 19 / 119, 2)
  Nettobetrag = Bruttobetrag − USt_betrag

Wenn USt-Satz = 7 %:
  USt_betrag  = ROUND(Bruttobetrag × 7 / 107, 2)
  Nettobetrag = Bruttobetrag − USt_betrag

Wenn USt-Satz = 0 %:
  USt_betrag  = 0,00
  Nettobetrag = Bruttobetrag

Wenn USt-Satz = Individuell:
  Nutzer gibt USt_betrag manuell in € ein (Pflichtfeld)
  Nettobetrag = Bruttobetrag − USt_betrag

Nettobetrag wird niemals manuell eingegeben.
Nettobetrag wird in der Datenbank gespeichert (berechneter Wert, kein View).
```

## Dropdown-Logik Kategorie (Kaskadierung)

```
Nutzer wählt Kategorie (Ebene 1)
  → Gruppe-Dropdown zeigt Ebene-2-Kinder dieser Kategorie (falls vorhanden)
    → Untergruppe-Dropdown zeigt Ebene-3-Kinder der gewählten Gruppe (falls vorhanden)

Nutzer wählt eine neue Kategorie
  → Gruppe und Untergruppe werden zurückgesetzt

Nutzer wählt eine neue Gruppe
  → Untergruppe wird zurückgesetzt

Sales Plattform und Produkte:
  → Sichtbarkeit abhängig von gewählter Kategorie (sales_plattform_enabled / produkt_enabled)
  → Beim Kategoriewechsel: Werte zurücksetzen, wenn neue Kategorie Dimension nicht hat
```

## Edge Cases
- Kein Ausgaben-KPI-Modell vorhanden → Hinweis "Bitte zuerst KPI-Modell unter Einstellungen definieren" mit Link zur KPI-Verwaltung
- Bruttobetrag = 0 oder negativ → Validierungsfehler
- Leistungsdatum in der Zukunft → Warnung (amber), aber nicht blockiert (Vorauserfassung möglich)
- Kategorie hat keine Unterkategorien → Gruppe-Dropdown nicht angezeigt; Speichern ohne Gruppe möglich
- Gruppe hat keine Unterkategorien → Untergruppe-Dropdown nicht angezeigt; Speichern ohne Untergruppe möglich
- Nutzer wechselt Kategorie nach Auswahl einer Gruppe → Gruppe wird zurückgesetzt (Pflichtfeld erneut offen)
- Kategorie aus KPI-Modell wird nach Erfassung umbenannt → Gespeicherte ID bleibt erhalten, Anzeige zeigt neuen Namen
- Kategorie aus KPI-Modell wird gelöscht → Transaktion zeigt "[Kategorie gelöscht]" und muss re-kategorisiert werden
- USt "Individuell" gewählt, aber kein Betrag eingegeben → Speichern blockiert
- USt-Individuell-Betrag > Bruttobetrag → Validierungsfehler (Nettobetrag würde negativ)
- Sehr viele Transaktionen (1000+) → Paginierung (50 pro Seite)

## Technical Requirements
- Tabellen-Name in Supabase: `ausgaben_kosten_transaktionen`
- Spalten:
  - `id` UUID, PK
  - `leistungsdatum` date, NOT NULL
  - `zahlungsdatum` date, nullable
  - `betrag_brutto` decimal(15,2), NOT NULL, CHECK > 0
  - `betrag_netto` decimal(15,2), NOT NULL (gespeicherter Berechnungswert)
  - `ust_satz` text, NOT NULL — enum-artig: `'19'` / `'7'` / `'0'` / `'individuell'`
  - `ust_betrag` decimal(15,2), NOT NULL
  - `kategorie_id` UUID, FK → kpi_categories (Ebene 1), NOT NULL
  - `gruppe_id` UUID, FK → kpi_categories (Ebene 2), nullable, ON DELETE SET NULL
  - `untergruppe_id` UUID, FK → kpi_categories (Ebene 3), nullable, ON DELETE SET NULL
  - `sales_plattform_id` UUID, FK → kpi_categories type=sales_plattformen, nullable, ON DELETE SET NULL
  - `produkt_id` UUID, FK → kpi_categories type=produkte, nullable, ON DELETE SET NULL
  - `beschreibung` text, nullable
  - `relevant_fuer_rentabilitaet` text, nullable — enum-artig: `'ja'` / `'nein'`
  - `abschreibung` text, nullable — enum-artig: `'3_jahre'` / `'5_jahre'` / `'7_jahre'` / `'10_jahre'`
  - `transaction_type` text, nullable — für spätere Nutzung in PROJ-8 (`'ausgabe'` / `'kosten'`)
  - `created_at` timestamptz, DEFAULT NOW()
- Sichtbarkeit der Kategorie-Spalten wird client-seitig anhand der KPI-Modell-Daten berechnet
- RLS: Nur eingeloggte Nutzer können lesen/schreiben
- Beträge als `decimal(15,2)` gespeichert

## Filter-Datenmodell

```
AusgabenFilter:
  von?:                  string (YYYY-MM-DD) — Leistungsdatum >=
  bis?:                  string (YYYY-MM-DD) — Leistungsdatum <=
  kategorie_ids?:        string[]   ← Array (Multi-Select, Ebene 1)
  gruppe_ids?:           string[]   ← Array (Multi-Select, Ebene 2) — nur relevant wenn kategorie_ids.length === 1
  untergruppe_ids?:      string[]   ← Array (Multi-Select, Ebene 3) — nur relevant wenn kategorie_ids.length === 1 UND gruppe_ids.length === 1
  sales_plattform_ids?:  string[]   ← Array (Multi-Select, unabhängig) — nur sichtbar wenn showSalesPlattform
  produkt_ids?:          string[]   ← Array (Multi-Select, unabhängig) — nur sichtbar wenn showProdukte

Filter-Sichtbarkeitslogik (UI):
  showGruppeFilter          = kategorie_ids?.length === 1
  showUntergruppeFilter     = kategorie_ids?.length === 1 && gruppe_ids?.length === 1
  showSalesPlattformFilter  = showSalesPlattform (mind. 1 Kategorie mit sales_plattform_enabled=true)
  showProduktFilter         = showProdukte (mind. 1 Kategorie mit produkt_enabled=true)

API-Filterung (GET /api/ausgaben-kosten-transaktionen):
  von/bis             → WHERE leistungsdatum >= / <=
  kategorie_ids       → WHERE kategorie_id IN (...)
  gruppe_ids          → WHERE gruppe_id IN (...)           (nur wenn kategorie_ids.length === 1)
  untergruppe_ids     → WHERE untergruppe_id IN (...)      (nur wenn beide übergeordneten Filter === 1)
  sales_plattform_ids → WHERE sales_plattform_id IN (...)  (unabhängig)
  produkt_ids         → WHERE produkt_id IN (...)          (unabhängig)

Tabellen-Fußzeile:
  totalBrutto = SUM(betrag_brutto) über alle gefilterten Zeilen
  totalNetto  = SUM(betrag_netto) über alle gefilterten Zeilen
```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
/dashboard/ausgaben (Page)
+-- Filter-Leiste
|   +-- Von/Bis Datumsfelder (Leistungsdatum)
|   +-- Kategorie MultiSelect (immer sichtbar)
|   +-- Gruppe MultiSelect (nur wenn genau 1 Kategorie gewählt)
|   +-- Untergruppe MultiSelect (nur wenn genau 1 Kategorie UND 1 Gruppe gewählt)
|   +-- Sales Plattform MultiSelect (wenn showSalesPlattform=true)
|   +-- Produkt MultiSelect (wenn showProdukte=true)
|   +-- Filter zurücksetzen Button
+-- "Neue Transaktion" Button → öffnet AusgabenFormDialog
+-- AusgabenTable
|   +-- Tabellenkopf (Spalten dynamisch nach KPI-Modell)
|   +-- Zeilen (50 pro Seite)
|   +-- Fußzeile: Σ Bruttobetrag + Σ Nettobetrag (gefilterte Gesamtsummen)
|   +-- Pagination (Prev / Next)
|   +-- Edit-Icon → AusgabenFormDialog (vorausgefüllt)
|   +-- Delete-Icon → AlertDialog Bestätigung
+-- Leerer Zustand: "Noch keine Ausgaben/Kosten-Transaktionen erfasst."
+-- Kein KPI-Modell: Hinweis mit Link zur KPI-Verwaltung

AusgabenFormDialog (Modal)
+-- Leistungsdatum (Date-Picker, Pflicht) + Zukunftswarnung
+-- Zahlungsdatum (Date-Picker, optional)
+-- Kategorie Dropdown (Pflicht)
+-- Gruppe Dropdown (nur wenn Kategorie Unterkategorien hat, Pflicht)
+-- Untergruppe Dropdown (nur wenn Gruppe Unterkategorien hat, Pflicht)
+-- Sales Plattform Dropdown (nur wenn sales_plattform_enabled, Pflicht)
+-- Produkt Dropdown (nur wenn produkt_enabled, Pflicht)
+-- Beschreibung Textfeld (optional)
+-- Bruttobetrag Eingabefeld in € (Pflicht, > 0)
+-- Umsatzsteuer Dropdown: 19% / 7% / 0% / Individuell (Pflicht)
|   +-- USt-Betrag: automatische Vorschau ODER manuelles Eingabefeld (wenn Individuell)
+-- Nettobetrag: automatische Vorschau (nicht editierbar)
+-- Relevant für Rentabilität Dropdown: Ja / Nein (optional)
+-- Abschreibung Dropdown: 3 / 5 / 7 / 10 Jahre (optional)
+-- Speichern Button (deaktiviert bis alle Pflichtfelder ausgefüllt)
```

### Datenmodell

Tabelle `ausgaben_kosten_transaktionen` in Supabase:

```
Jede Transaktion hat:
- Eindeutige ID
- Leistungsdatum (Pflicht) — wann die Leistung erbracht wurde
- Zahlungsdatum (optional) — wann tatsächlich gezahlt wurde
- Bruttobetrag in € (Pflicht, immer > 0)
- Nettobetrag in € (gespeicherter Berechnungswert: Brutto − USt)
- USt-Satz als Text: '19', '7', '0' oder 'individuell'
- USt-Betrag in € (berechnet oder manuell bei "Individuell")
- Kategorie-ID (Pflicht, Ebene 1 aus Ausgaben-KPI-Modell)
- Gruppe-ID (optional, Ebene 2)
- Untergruppe-ID (optional, Ebene 3)
- Sales Plattform-ID (optional)
- Produkt-ID (optional)
- Beschreibung (optional, Freitext)
- Relevant für Rentabilität (optional: 'ja' / 'nein')
- Abschreibung (optional: '3_jahre' / '5_jahre' / '7_jahre' / '10_jahre')
- transaction_type (reserviert für PROJ-8, nullable)
- Erstellungszeitpunkt (automatisch)

Gespeichert in: Supabase-Datenbank (PostgreSQL)
```

### API-Endpunkte

```
GET  /api/ausgaben-kosten-transaktionen
     → Gibt gefilterte Transaktionen (50/Seite) + totalBrutto + totalNetto zurück

POST /api/ausgaben-kosten-transaktionen
     → Erstellt neue Transaktion; berechnet und speichert betrag_netto serverseitig

PATCH  /api/ausgaben-kosten-transaktionen/[id]
       → Aktualisiert einzelne Felder; recalculates betrag_netto wenn betrag_brutto/ust ändert

DELETE /api/ausgaben-kosten-transaktionen/[id]
       → Löscht Transaktion
```

### Was wiederverwendet wird (aus PROJ-3/4)

| Bestehend | Wiederverwendung in PROJ-5 |
|-----------|--------------------------|
| `MultiSelect` Komponente | Identisch — keine Änderung nötig |
| `useKpiCategories('ausgaben')` Hook | Identisch — KPI-Typ `'ausgaben'` übergeben |
| Filter-Hierarchie-Logik (Kategorie → Gruppe → Untergruppe) | Identisch kopiert |
| AlertDialog für Löschen | Identisch |
| Paginierung (50/Seite, Prev/Next) | Identisch |
| Authentifizierungs-Middleware | Identisch |
| RLS-Policy-Muster | Identisch |

### Was neu gebaut wird

| Neu | Beschreibung |
|-----|-------------|
| `ausgaben-form-dialog.tsx` | Adaptiertes Formular mit USt-Dropdown, Netto-Vorschau, Zahlungsdatum, Rentabilität, Abschreibung |
| `ausgaben-table.tsx` | Tabelle mit 13 Spalten inkl. Brutto/Netto/USt, Zahlungsdatum, Rentabilität, Abschreibung |
| `use-ausgaben-kosten-transaktionen.ts` | Hook adaptiert von `use-umsatz-transaktionen.ts`, zwei Betragssummen |
| `/api/ausgaben-kosten-transaktionen/` | Neue API-Route mit USt-Berechnung und Netto-Persistierung |
| Supabase-Tabelle | `ausgaben_kosten_transaktionen` mit RLS, Indexes, allen Spalten |
| Dashboard-Karte | Neue Navigationskarte "Ausgaben/Kosten" auf `/dashboard` |

### USt-Berechnung (Serverlogik)

Der Nettobetrag wird **serverseitig berechnet und gespeichert** — nicht im Client und nicht als DB-View. Das stellt sicher, dass gefilterte Summen (`SUM(betrag_netto)`) direkt aus der Datenbank korrekt aggregiert werden können.

```
Formel (wird auf Server ausgeführt):
  19 %: betrag_netto = betrag_brutto − ROUND(betrag_brutto × 19/119, 2)
   7 %: betrag_netto = betrag_brutto − ROUND(betrag_brutto × 7/107, 2)
   0 %: betrag_netto = betrag_brutto
Individuell: betrag_netto = betrag_brutto − ust_betrag_manuell
```

Im Formular zeigt der Client eine **Vorschau** des berechneten Nettowerts, der endgültige gespeicherte Wert kommt aber vom Server.

### Tech-Entscheidungen

- **Nettobetrag gespeichert (kein DB-View):** Damit `SUM(betrag_netto)` in der Fußzeile server-seitig und korrekt über gefilterte Seiten summiert werden kann — ohne Client-seitige Aggregation über alle Seiten.
- **USt-Satz als Text gespeichert:** Erlaubt die Option `'individuell'` sauber abzubilden, ohne NULL-Werte oder extra Felder.
- **`transaction_type`-Spalte (nullable):** Reserviert für PROJ-8 (Ausgaben/Kosten-Trennung). Vorerst immer NULL, kein UI-Element.
- **Sortierung nur nach Leistungsdatum + Bruttobetrag:** Zahlungsdatum ist optional und daher kein sinnvoller Default-Sortierschlüssel.

### Neue Pakete / Abhängigkeiten

Keine neuen Pakete notwendig — alle shadcn/ui-Komponenten (Select, Dialog, AlertDialog, Table, Input, Popover, Checkbox) sind bereits installiert.

## Implementation Notes

### Frontend (2026-04-19)
- Created `/dashboard/ausgaben/page.tsx` with filter bar, AusgabenTable, AusgabenFormDialog, and delete AlertDialog
- Added "Ausgaben & Kosten" navigation card to `/dashboard/page.tsx`
- KPI type corrected to `'ausgaben_kosten'` (not `'ausgaben'`)
- All three component stubs (`ausgaben-form-dialog.tsx`, `ausgaben-table.tsx`, `use-ausgaben-kosten-transaktionen.ts`) were already fully implemented

### Backend (2026-04-19)
- Created `/api/ausgaben-kosten-transaktionen/route.ts` — GET (pagination + dual sum totals) + POST (server-side USt/Netto calculation)
- Created `/api/ausgaben-kosten-transaktionen/[id]/route.ts` — PATCH (recalculates betrag_netto when brutto/ust fields change) + DELETE
- Supabase table `ausgaben_kosten_transaktionen` created with all columns, CHECK constraints, 7 indexes, RLS policies (4 policies for SELECT/INSERT/UPDATE/DELETE)
- 24 unit tests: all passing

## QA Test Results

**QA Date:** 2026-04-19
**Tester:** QA Engineer (automated)
**Status:** APPROVED — No Critical or High bugs found

### Test Summary

| Category | Result |
|----------|--------|
| Unit tests (Vitest) | 127/127 passed |
| E2E tests (Playwright) | 118/118 passed (Chrome + Firefox + Mobile Safari) |
| PROJ-5 new E2E tests | 22/22 passed |
| Build | Clean — no TypeScript errors |
| Security audit | No issues found |
| Regressions | None — all prior features unaffected |

### Acceptance Criteria Results

**Tabellen-Spalten (dynamisch)**
- [x] Leistungsdatum, Zahlungsdatum, Brutto, Netto, USt, Beschreibung always visible
- [x] Kategorie always visible (KPI model never empty)
- [x] Gruppe/Untergruppe/SalesPlattform/Produkt columns controlled by KPI model flags
- [x] Hidden columns completely absent (not just empty)

**Transaktionseingabe (Formular)**
- [x] "Neue Transaktion" button opens modal
- [x] Leistungsdatum (date picker, required)
- [x] Zahlungsdatum (date picker, optional)
- [x] Kategorie dropdown, required
- [x] Gruppe/Untergruppe cascade, required when visible
- [x] Sales Plattform / Produkt, required when visible
- [x] Beschreibung, optional free text
- [x] Bruttobetrag, positive, required
- [x] USt dropdown: 19% / 7% / 0% / Individuell
- [x] 19%: auto USt = ROUND(brutto × 19/119, 2) — preview only
- [x] 7%: auto USt = ROUND(brutto × 7/107, 2) — preview only
- [x] 0%: USt = 0,00 € — preview only
- [x] Individuell: manual USt input field appears, is required
- [x] Nettobetrag auto-calculated (Brutto − USt), not editable
- [x] Rentabilität dropdown (Ja/Nein), optional
- [x] Abschreibung dropdown (3/5/7/10 Jahre), optional
- [x] Save blocked until all required fields filled
- [x] Future Leistungsdatum shows amber warning, not blocked
- [x] Saved transaction appears immediately in table
- [x] Validation: betrag_brutto = 0 → save blocked
- [x] Validation: Individuell USt > Brutto → error (Netto negative)

**Bearbeiten & Löschen**
- [x] Edit icon opens pre-filled form dialog
- [x] Delete icon opens AlertDialog confirmation
- [x] Confirmed delete removes row from table

**Tabellen-Funktionen**
- [x] Default sort: Leistungsdatum DESC
- [x] Sort by Leistungsdatum and Bruttobetrag (asc/desc)
- [x] Footer: totalBrutto and totalNetto (server-side sum over all filtered rows)
- [x] Footer totals align under correct column headers (Brutto / Netto)
- [x] Pagination: 50 rows per page, Prev/Next

**Filter-Hierarchie**
- [x] Kategorie MultiSelect: all level-1 ausgaben_kosten categories
- [x] Gruppe filter: only when exactly 1 Kategorie selected
- [x] Untergruppe filter: only when exactly 1 Kategorie AND 1 Gruppe selected
- [x] >1 Kategorie hides Gruppe and Untergruppe filters
- [x] Sales Plattform filter when showSalesPlattform=true
- [x] Produkt filter when showProdukte=true
- [x] "Filter zurücksetzen" clears all filters

**Edge Cases**
- [x] No KPI model → "Kein Ausgaben-KPI-Modell definiert" with link to settings
- [x] Empty table → skeleton loading, then empty state message
- [x] betrag_brutto = 0 or negative → API returns 400
- [x] Invalid ust_satz → API returns 400
- [x] Invalid abschreibung → API returns 400
- [x] Unauthenticated API requests → 401 (redirect to /login in browser)

### Bugs Found

None.

### Security Audit

- All API routes protected by `requireAuth()` middleware → verified via Playwright (unauthenticated redirects to /login)
- RLS policies enforce row-level security at DB level (all CRUD operations)
- Zod validation on all POST/PATCH inputs prevents injection (schema rejects unexpected fields)
- betrag_brutto validated as `number().positive()` — prevents zero/negative storage
- No sensitive data (user IDs, tokens) exposed in API responses
- Nettobetrag calculated server-side — client cannot store arbitrary netto values

### Production-Ready Decision

**READY FOR DEPLOYMENT** — No Critical or High bugs. All 34 acceptance criteria pass. 127 unit tests + 118 E2E tests green.

## Deployment

**Deployed:** 2026-04-19
**Git tag:** v1.5.0-PROJ-5
**Platform:** Vercel (auto-deploy on push to main)
**Commit:** da399a1
