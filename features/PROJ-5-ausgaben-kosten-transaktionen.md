# PROJ-5: Ausgaben & Kosten-Transaktionen Eingabe

## Status: Planned
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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
