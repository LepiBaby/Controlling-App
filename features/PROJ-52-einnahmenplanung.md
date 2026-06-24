# PROJ-52: Einnahmenplanung — Kurzfristige Planung (Redesign)

## Status: In Review
**Created:** 2026-06-04
**Last Updated:** 2026-06-14 (Redesign)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Einnahmen-Kategorien als Zeilenquelle
- Requires: PROJ-41 (Bereichswechsler) — URL-Rahmen „Kurzfristige Planung"
- Requires: PROJ-50 (Grundeinstellungen) — `planungshorizont_wochen` + `vergangenheitshorizont_wochen`
- Requires: PROJ-53 (Zellen-Notizen) — Notizen auf Zellenbasis
- Requires: PROJ-66 (Sales Plattform Planung) — Datenquelle für Produktverkäufe-Soll-Berechnung
- Requires: PROJ-45 (Auszahlungseinstellungen) — Zahlungsrhythmus, nächste Auszahlung, Verschiebung, marketing_inkludiert je Plattform
  - **Erweiterung PROJ-45:** neues Feld `verschiebung_wochen` INTEGER (0–12, Default 0) je Plattform
- Requires: PROJ-29 (Liquiditätsreport) — gleiche Datenquellen für Ist-Tatsächlich-Werte

## Übersicht

Die Seite „Einnahmenplanung" zeigt eine wochenbasierte (KW) Übersicht aller Einnahmen-Kategorien. Sie kombiniert:

**Vergangenheitsbereich** (`vergangenheitshorizont_wochen` KWs vor der aktuellen KW):
- Pro KW zwei Spalten nebeneinander:
  - **Ist-Tatsächlich**: tatsächlich gebuchte Einnahmen je Kategorie aus `einnahmen_transaktionen` (gefiltert nach `zahlungsdatum` ≙ Liquiditätslogik aus PROJ-29)
  - **Ist-Plan**: der damals manuell eingetragene Plan aus der Tabelle `einnahmen_planung` für diese KW (leer, wenn damals keine Planung existierte)

**Zukunftsbereich** (`planungshorizont_wochen` KWs ab der nächsten KW):
- Pro KW eine Soll-Spalte, manuell editierbar
- Alle Einnahmen-Kategorien aus dem KPI-Modell, **inklusive Produktverkäufe**
- Produktverkäufe wird automatisch aus der Sales Plattform Planung + Auszahlungseinstellungen vorberechnet (grauer Indikator = automatisch; blauer Indikator = manuell überschrieben)
- Alle anderen Kategorien: manuell einzugeben (wie bisher)

Eine **klare Trennlinie** (visuell) zwischen Vergangenheits- und Zukunftsbereich.

Die **Gesamt-Zeile** erscheint ganz **unten** in der Tabelle.

## User Stories

- Als Nutzer möchte ich auf der Einnahmenplanung sowohl vergangene Ist-Tatsächlich-Werte als auch meine damaligen Planwerte sehen, damit ich Plan-Ist-Vergleiche schnell durchführen kann.
- Als Nutzer möchte ich für jede vergangene KW sowohl Ist-Tatsächlich als auch Ist-Plan nebeneinander sehen, damit ich sofort erkenne, wie nah der Plan an der Realität war.
- Als Nutzer möchte ich im Zukunftsbereich für Produktverkäufe automatisch vorberechnete Werte sehen, die auf meinen Absatz- und Auszahlungseinstellungen basieren, damit ich nicht jeden Wert manuell schätzen muss.
- Als Nutzer möchte ich jeden vorberechneten Wert manuell überschreiben können und auf einen Blick sehen, ob ein Wert automatisch berechnet oder manuell eingegeben wurde (grauer vs. blauer Indikator).
- Als Nutzer möchte ich alle Kategoriegruppen auf- und zuklappen können und mit einem Button alle auf einmal ein- oder ausklappen.
- Als Nutzer möchte ich für einzelne Zellen Notizen hinterlegen können.
- Als Nutzer möchte ich beim Klicken oder Ctrl+Klicken mehrere Zellen auswählen und die Summe rechts unten angezeigt bekommen.
- Als Nutzer möchte ich alle manuellen Werte und Notizen mit einem Zurücksetzen-Button löschen können, sodass Produktverkäufe wieder automatisch berechnet und alle anderen Felder leer angezeigt werden.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag „Einnahmenplanung" → `/dashboard/kurzfristige-planung/einnahmenplanung`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Einnahmenplanung" im Abschnitt „Planung"
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Spaltenstruktur

- [ ] Die Tabelle zeigt zwei Bereiche nebeneinander, mit einer **klaren Trennlinie** (dicker vertikaler Separator oder Hintergrundfarben-Kontrast) dazwischen:
  - **Vergangenheitsbereich**: die letzten N KWs vor der aktuellen KW (N = `vergangenheitshorizont_wochen`, Fallback 4); aktuelle KW nicht angezeigt
  - **Zukunftsbereich**: die nächsten M KWs, beginnend mit der nächsten KW (M = `planungshorizont_wochen`, Fallback 13)
- [ ] Für jede vergangene KW: **zwei Spalten** nebeneinander
  - Erste Spalte: Label „Ist-Tatsächlich" unter dem KW-Header (z. B. „KW22 / 2026")
  - Zweite Spalte: Label „Ist-Plan" unter demselben KW-Header
  - Der KW-Header überspannt beide Spalten (colspan=2)
- [ ] Für jede zukünftige KW: **eine Spalte** mit KW-Header (Format „KW24 / 2026")
- [ ] Korrekte ISO-8601-Wochenberechnung inkl. Jahreswechsel
- [ ] Die Tabelle ist horizontal scrollbar; die erste Spalte (Zeilenbeschriftung) ist sticky
- [ ] Neue zukünftige KW (letzte Spalte des Horizonts ohne Planungswerte): rote Markierung wie bisher

### Erweiterung PROJ-45 — `verschiebung_wochen`

- [ ] In den Auszahlungseinstellungen (PROJ-45) wird je Sales-Plattform ein neues Feld ergänzt: **„Verschiebung (KW)"** — wie viele Kalenderwochen der Einnahmen-Eingang nach dem Umsatzzeitpunkt verzögert ist
  - Eingabeelement: `Input type="number"`, Integer, min=0, max=12, Default=0
  - Auto-Save bei `onBlur`
  - Gespeichert als `verschiebung_wochen` INTEGER in `auszahlungs_einstellungen`
- [ ] DB-Migration: ALTER TABLE `auszahlungs_einstellungen` ADD COLUMN `verschiebung_wochen` INTEGER NOT NULL DEFAULT 0 CHECK (BETWEEN 0 AND 12)

### Zeilenhierarchie

- [ ] **Ganz unten**: Gesamt-Zeile „Einnahmen (Gesamt)" — summiert alle Leaf-Zeilen, nicht editierbar, immer sichtbar (Position: UNTERSTE Zeile, nicht oben)
- [ ] **Pro Level-1-Kategorie** (alle aus KPI-Modell, jetzt **inkl. Produktverkäufe**): einklappbare Sektion (Standard: ausgeklappt):
  - Kategorie-Header-Zeile mit Name + Auf-/Zuklapp-Icon
  - Wenn Sub-Kategorien vorhanden:
    - Aggregations-Zeile (Summe der Sub-Kategorien), nicht editierbar
    - Pro Level-2-Sub-Kategorie: editierbare Zeile (eingerückt)
  - Wenn keine Sub-Kategorien:
    - Level-1 selbst ist editierbar (Leaf)
- [ ] Reihenfolge nach `sort_order` im KPI-Modell
- [ ] **Buttons oben rechts:**
  - **„Alle ausklappen"**: klappt alle Sektionen auf
  - **„Alle einklappen"**: klappt alle Sektionen zu

### Ist-Tatsächlich-Werte (Vergangenheitsspalten)

- [ ] Datenquelle: `einnahmen_transaktionen` gefiltert nach `zahlungsdatum` (identische Logik wie PROJ-29 Liquiditätsreport), gruppiert nach `kategorie_id` und ISO-Woche des `zahlungsdatum`
- [ ] Für **Produktverkäufe** Ist-Tatsächlich: ebenfalls aus `einnahmen_transaktionen` (kategorie_id = Produktverkäufe und Sub-Kategorien)
- [ ] Ist-Tatsächlich-Zellen sind **nicht editierbar** — keine Indikatorpunkte
- [ ] Aggregationszeilen (category-sum) summieren ihre Leaf-Kinder in der Ist-Tatsächlich-Spalte
- [ ] Gesamt-Zeile summiert alle Leafs in der Ist-Tatsächlich-Spalte
- [ ] Zellen ohne Transaktionen: leer (keine 0-Anzeige)

### Ist-Plan-Werte (Vergangenheitsspalten)

- [ ] Datenquelle: `einnahmen_planung`-Tabelle — manuelle Planwerte, die für die vergangene KW gespeichert wurden (also der ursprüngliche Plan, der nun in der Vergangenheit liegt)
- [ ] Ist-Plan-Zellen sind **nicht editierbar** — keine Indikatorpunkte
- [ ] Wenn für eine vergangene KW kein Planwert existiert (weil damals noch nicht geplant): Zelle leer
- [ ] Aggregationszeilen summieren ihre Leaf-Kinder in der Ist-Plan-Spalte

### Soll-Werte (Zukunftsspalten) — alle Kategorien außer Produktverkäufe

- [ ] Identisch mit der v1-Implementierung: manuell einzugebende Werte
- [ ] Inline-Editing (click-to-edit), Speicherung onBlur in `einnahmen_planung`
- [ ] Dezimalzahl ≥ 0; NULL = leer
- [ ] Optimistisches Update + Rollback bei API-Fehler
- [ ] Kein automatischer Vorschlagswert → keine Indikatorpunkte für manuelle Eingabe (oder grauer Punkt, wenn leer/automatisch = nicht vorhanden, blauer Punkt wenn manuell eingetragen)

### Soll-Werte (Zukunftsspalten) — Produktverkäufe (auto-berechnet)

Die vorberechneten Produktverkäufe-Soll-Werte werden in `einnahmen_planung` als automatische Werte gespeichert (Flag `ist_automatisch = true`) oder nur clientseitig berechnet und nur bei manueller Überschreibung persistiert.

**Berechnungsalgorithmus** (je Sales-Plattform P, je future KW):

Schritt 1 — Nettoerlös je Plattform je KW (aus Sales Plattform Planung, Plattformebene = Summe über alle Produkte):
```
NettoP_KW = Σ_Produkte (Bruttoumsatz - Rabatte - Rückerstattungen - Verkaufsgebühr - Retourenkosten)_KW
```

Schritt 2 — Verschiebung: Revenue-Wert von KW W "landet" in KW W + verschiebung_wochen[P].

Schritt 3 — Bestimmung der Zahlungswochen für Plattform P:
- Erste Zahlungswoche = berechnete nächste Auszahlungswoche (aus PROJ-45-Algorithmus)
- Folgende Zahlungswochen = erste + Auszahlungsrhythmus, + Rhythmus, ...

Schritt 4 — Für jede Zahlungswoche Z mit Rhythmus R und Verschiebung V[P]:
- Revenue-Wochen die zu Z gehören: W in [Z − V[P] − R + 1 … Z − V[P]]
- Beispiel: V=2, R=2, Z=KW28 → W in [KW25, KW26]
- Summe: `Payment_Z_P = Σ_W NettoP_W`

Schritt 5 — Marketingkosten abziehen (wenn `marketing_inkludiert = true` für Plattform P):
- Marketingkosten aus Sales Plattform Planung für Plattform P, Wochen W
- `Payment_Z_P -= Σ_W Marketingkosten_P_W`

Schritt 6 — Summierung über alle Plattformen für jede Zahlungswoche Z:
- `ProduktverkäufeSoll_Z = Σ_P Payment_Z_P`
- Wochen, die keine Zahlungswoche sind: Produktverkäufe = 0 oder leer (keine Auszahlung in dieser KW)

- [ ] Vorberechnete Werte erhalten einen **grauen Indikatorpunkt** (untere rechte Ecke der Zelle)
- [ ] Wenn der Nutzer einen Wert manuell überschreibt: **blauer Indikatorpunkt**, Wert wird in `einnahmen_planung` mit Flag `ist_manuell = true` gespeichert
- [ ] Beim Zurücksetzen: manuelle Überschreibungen werden gelöscht; automatische Berechnung gilt wieder
- [ ] Wenn Eingangsdaten fehlen (kein Absatz, keine Auszahlungseinstellungen): Zelle leer statt 0

### Visuelle Indikatorpunkte

| Zustand | Punkt | Gilt für |
|---|---|---|
| Automatisch berechnet | Grauer Punkt | Produktverkäufe-Soll-Zellen mit berechnetem Wert |
| Manuell eingegeben | Blauer Punkt | Alle manuell überschriebenen Soll-Zellen |
| Leer (kein Wert) | Kein Punkt | Leere Soll-Zellen ohne Berechnung |
| Ist-Tatsächlich / Ist-Plan | Kein Punkt | Nicht editierbare Vergangenheitsspalten |

### Notizen (PROJ-53)

- [ ] Notiz-Feature auf allen editierbaren Soll-Zellen (Zukunftsbereich), identisch mit Marketing-Planung und Sales Plattform Planung
- [ ] Notiz-Icon erscheint beim Hover (wenn keine Notiz) oder dauerhaft (wenn Notiz vorhanden) mit Tooltip-Vorschau
- [ ] Notizen in `planung_notizen` gespeichert
- [ ] Zurücksetzen löscht auch alle Notizen dieser Seite

### Betragsselektion

- [ ] Einzelne oder mehrere Zellwerte durch Klicken / Ctrl+Klicken auswählbar
- [ ] Summe der selektierten Werte wird in einem Panel rechts unten angezeigt
- [ ] Panel erscheint ab 1 selektierter Zelle
- [ ] Nicht-editierbare Zellen (Aggregationszeilen, Ist-Spalten, Gesamt) ebenfalls selektierbar
- [ ] Identisches Verhalten wie in PROJ-51, PROJ-54, PROJ-66

### Reset-Button

- [ ] Button „Zurücksetzen" oben rechts neben den Einklappen-Buttons
- [ ] Bestätigungs-Dialog (shadcn AlertDialog): „Alle Planungswerte zurücksetzen? Alle manuell eingegebenen Werte und Notizen werden gelöscht. Automatisch berechnete Werte (Produktverkäufe) werden wiederhergestellt."
- [ ] Nach Bestätigung:
  - Alle Einträge des Nutzers in `einnahmen_planung` (mit `ist_manuell = true`) werden gelöscht
  - Alle Notizen des Nutzers für diese Seite in `planung_notizen` werden gelöscht
  - Produktverkäufe-Zellen zeigen wieder die automatisch berechneten Werte (grauer Punkt)
  - Alle anderen Soll-Zellen erscheinen leer

### Datenbankschema (Erweiterung zu v1)

- [ ] Tabelle `einnahmen_planung` erhält zwei neue Spalten:
  - `ist_manuell` BOOLEAN NOT NULL DEFAULT true — `true` = manuell vom Nutzer; `false` = automatisch berechnet (optional, nur wenn Auto-Werte persistent gespeichert werden sollen)
  - Alternativ: Auto-Werte werden **nicht** persistiert, nur manuelle Überschreibungen. Dann reicht das vorhandene Schema; der Indikator leitet sich daraus ab, ob ein Eintrag existiert.
  - **Empfehlung**: Kein Persistieren von Auto-Werten — berechnete Werte werden clientseitig berechnet und nur beim manuellen Überschreiben in der DB gespeichert. Ein Eintrag in DB = manuell überschrieben = blauer Punkt.
- [ ] Tabelle `auszahlungs_einstellungen` erhält neues Feld:
  - `verschiebung_wochen` INTEGER NOT NULL DEFAULT 0 CHECK (BETWEEN 0 AND 12)

### API-Routen (Erweiterung zu v1)

Bestehend (bleibt):
- `GET /api/einnahmen-planung` — alle manuellen Einträge des Nutzers
- `PUT /api/einnahmen-planung` — Upsert einzelner Eintrag (null = löschen)
- `DELETE /api/einnahmen-planung` — alle manuellen Einträge des Nutzers löschen

Neu:
- `GET /api/einnahmen-planung/ist-tatsaechlich?von_kw=&von_jahr=&bis_kw=&bis_jahr=` — Ist-Tatsächlich-Werte je Kategorie je KW (aus `einnahmen_transaktionen`, gruppiert nach ISO-Woche des `zahlungsdatum`)
- `GET /api/einnahmen-planung/produktverkaeufe-berechnet?von_kw=&von_jahr=&bis_kw=&bis_jahr=` — Vorberechnete Produktverkäufe-Soll-Werte (lädt Sales-Plattform-Daten + Auszahlungseinstellungen und berechnet server-seitig)
- Erweiterung `PUT /api/auszahlungs-einstellungen` — nimmt jetzt auch `verschiebung_wochen` entgegen

## Edge Cases

- **Keine Einnahmen-Kategorien außer Produktverkäufe**: Leerer Zustand mit Hinweis + Link zur KPI-Verwaltung
- **Produktverkäufe hat keine Sub-Kategorien im KPI-Modell**: erscheint als direktes Leaf (editierbar im Soll-Bereich, Ist-Tatsächlich aus einnahmen_transaktionen für Produktverkäufe-Kategorie)
- **verschiebung_wochen = 0**: Revenue-Woche W landet in Zahlungswoche W — kein Shift
- **Keine Auszahlungseinstellungen für eine Plattform**: Plattform trägt 0 zum Produktverkäufe-Soll bei (kein Fehler)
- **Sales-Plattform-Daten fehlen** (kein Absatzplan): Produktverkäufe-Zelle leer (nicht 0)
- **Zahlungswoche liegt außerhalb des Planungshorizonts**: Berechneter Wert wird nicht angezeigt (kein Out-of-Range-Wert)
- **Plan-Ist-Vergleich bei Wochen die noch nie geplant wurden**: Ist-Plan-Spalte leer (kein 0)
- **Kw-Jahreswechsel**: korrekte ISO-Berechnung über Jahreswechsel hinweg
- **Sehr viele KWs** (vergangenheitshorizont + 2 × planungshorizont Spalten): horizontales Scrollen, sticky Label-Spalte
- **Zurücksetzen ohne manuelle Werte**: idempotent (keine Änderung sichtbar)
- **marketing_inkludiert = false für alle Plattformen**: Marketing wird nicht subtrahiert, kein Fehler
- **Rhythmus = 1 Woche**: jede KW ist Zahlungswoche, Fenster = [Z-V, Z-V] (nur eine Revenue-Woche pro Zahlung)
- **API-Fehler bei Berechnung von Produktverkäufe**: Zellen leer, kein Absturz, Toast-Hinweis

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen API-Routen
- RLS auf `einnahmen_planung` (bestehend)
- DB-Migration: `verschiebung_wochen` zu `auszahlungs_einstellungen`
- ISO-8601-Wochenberechnung: `date-fns` (`getISOWeek`, `getISOWeekYear`, `addWeeks`)
- Keine neuen Packages: alle benötigten Komponenten (shadcn Dialog, Input, Table, AlertDialog, Tooltip) bereits vorhanden
- Seite: `src/app/dashboard/kurzfristige-planung/einnahmenplanung/page.tsx` (bestehend, erweitern)

### Neue/geänderte Dateien (Redesign)

| Datei | Änderung |
|---|---|
| `src/hooks/use-einnahmenplanung.ts` | Komplett überarbeiten: Ist-Tatsächlich laden, Ist-Plan aus DB, Produktverkäufe-Berechnung, Indikatorlogik, resetAll löscht nur manuelle |
| `src/components/einnahmenplanung-tabelle.tsx` | Komplett überarbeiten: doppelte Spalten für Vergangenheit, Trennlinie, Produktverkäufe-Zeile, Indikatorpunkte, Einklappen-Buttons, Total unten |
| `src/app/api/einnahmen-planung/route.ts` | GET/PUT/DELETE bestehend; neue Sub-Routen für Ist-Tatsächlich und Produktverkäufe-Berechnet |
| `src/app/api/auszahlungs-einstellungen/route.ts` | verschiebung_wochen in Zod-Schema + DB-Upsert ergänzen |
| `src/app/dashboard/kurzfristige-planung/auszahlungseinstellungen/page.tsx` | Formular um Feld „Verschiebung (KW)" erweitern |
| DB-Migration | `verschiebung_wochen` in `auszahlungs_einstellungen` |

---

---

## Tech Design (Solution Architect — 2026-06-14)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung/einnahmenplanung  (bestehende Seite — überarbeitet)
+-- Page-Header
|   +-- Titel „Einnahmenplanung"
|   +-- Button-Gruppe rechts:
|       +-- „Alle ausklappen"
|       +-- „Alle einklappen"
|       +-- „Zurücksetzen" (öffnet Bestätigungs-Dialog)
+-- EinnahmenplanungTabelle  (KOMPLETT ÜBERARBEITETE Hauptkomponente)
    +-- Scroll-Container (horizontal scrollbar)
    |   +-- <table>
    |       +-- <thead> (oben fixiert beim Scrollen)
    |       |   +-- KW-Gruppenzeile:
    |       |       [Label sticky links] | [KW20 colspan=2 | KW21 colspan=2 | ...] ‖ [KW24 | KW25 | ...]
    |       |   +-- Sub-Label-Zeile:
    |       |       [leer sticky links] | [Ist-T | Ist-P | Ist-T | Ist-P | ...] ‖ [Soll | Soll | ...]
    |       |   +-- Visuelle Trennlinie zwischen Vergangenheit und Zukunft (dicker Rand / Farbe)
    |       +-- <tbody>  (flache Zeilen-Liste)
    |           +-- [Pro L1-Kategorie, inkl. Produktverkäufe, nach sort_order]
    |           |   +-- category-header-Zeile (Name + Expand/Collapse-Icon)
    |           |   +-- [wenn ausgeklappt + Sub-Kategorien]:
    |           |       +-- category-sum-Zeile (Aggregat, nicht editierbar)
    |           |       +-- Pro L2-Sub-Kategorie: Leaf-Zeile
    |           |   +-- [wenn ausgeklappt + keine Sub-Kategorien]:
    |           |       +-- Level-1 selbst als Leaf-Zeile
    |           +-- Gesamt-Zeile „Einnahmen (Gesamt)"  ← GANZ UNTEN
    +-- BetragsselektionPanel  (fest rechts unten, erscheint bei Selektion)
    +-- ResetConfirmDialog  (shadcn AlertDialog)

/dashboard/kurzfristige-planung/auszahlungseinstellungen  (bestehende Seite — leicht erweitert)
+-- AuszahlungseinstellungenFormular  (Erweiterung: neues Feld „Verschiebung (KW)")

Notizen-Icon (PROJ-53): auf allen editierbaren Soll-Zellen, identisch mit Sales Plattform Planung
```

### Wie die Tabellenspalten aufgebaut sind

Der Tabellenkopf hat **zwei Headerzeilen**:
- Zeile 1: KW-Labels. Jede vergangene KW überspannt 2 Spalten (`colspan=2`). Jede zukünftige KW hat eine Spalte. Zwischen Vergangenheit und Zukunft: vertikaler Separator.
- Zeile 2: Sub-Labels. Unter jeder vergangenen KW: „Ist-T" (links) und „Ist-P" (rechts). Unter jeder zukünftigen KW: „Soll".

Die Label-Spalte ganz links ist beim horizontalen Scrollen fixiert (`sticky left`).

### Datenfluss beim Laden der Seite

```
Seite öffnet sich → Hook lädt PARALLEL:
  ① GET /api/grundeinstellungen
       → planungshorizont_wochen (Zukunftsspalten)
       → vergangenheitshorizont_wochen (Vergangenheitsspalten)

  ② GET /api/kpi-categories?type=einnahmen
       → alle Einnahmen-Kategorien inkl. Produktverkäufe
       → Reihenfolge nach sort_order

  ③ GET /api/einnahmen-planung
       → alle manuellen Einträge des Nutzers
       → Wird für zwei Zwecke genutzt:
         a) Ist-Plan: Einträge für vergangene KWs
         b) Soll-Manuell: Einträge für zukünftige KWs

  ④ GET /api/einnahmen-planung/ist-tatsaechlich
       → tatsächliche Einnahmen je Kategorie je vergangene KW
       → Quelle: einnahmen_transaktionen gefiltert nach zahlungsdatum

  ⑤ GET /api/einnahmen-planung/produktverkaeufe-berechnet
       → vorberechnete Produktverkäufe-Soll-Werte je zukünftige KW
       → Berechnung erfolgt server-seitig (komplex, mit Zahlungstiming)

→ Frontend baut flaches Zeilen-Array aus Kategorie-Baum
→ Pro Zelle wird der richtige Wert aus ①–⑤ zusammengesetzt
```

### Server-seitige Produktverkäufe-Berechnung (Route ⑤)

Diese Route ist das Herzstück des Redesigns. Sie lädt selbstständig alle nötigen Eingangsdaten und berechnet den Einnahmen-Zeitpunkt:

```
Für jede Sales-Plattform P:

  1. Lade berechnete Sales-Plattform-Planung (je Produkt × KW):
     Netto_P_KW = Σ(Bruttoumsatz − Rabatte − Rückerstattungen
                   − Verkaufsgebühr − Retourenkosten) über alle Produkte

  2. Lade Auszahlungseinstellungen für P:
     - verschiebung_wochen V  (neues Feld: wie viele KWs Zahlungsverzug)
     - auszahlungsrhythmus R  (1 / 2 / 3 / 4 Wochen)
     - nächste Auszahlungswoche Z_0 (berechnet wie in PROJ-45)
     - marketing_inkludiert   (ja/nein)

  3. Bestimme alle Zahlungswochen: Z_0, Z_0 + R, Z_0 + 2R, ...
     (für den gesamten Planungshorizont)

  4. Für jede Zahlungswoche Z:
     Revenue-Wochen W ∈ [Z − V − R + 1 … Z − V]
     (Fenster der Größe R, um V Wochen in der Vergangenheit des Zahlungsdatums)

     Beispiel: V=2, R=2, Z=KW28 → W ∈ [KW25, KW26]

     Summe = Σ_W Netto_P_W
     Falls marketing_inkludiert:
       Summe -= Σ_W Marketingkosten_P_W (aus sales_plattform_planung)

  5. Summiere über alle Plattformen P → Produktverkäufe_Gesamt_Z

Response: { kw_year, kw_number, wert }[] — eine Zeile pro Zahlungswoche
```

Die Berechnung erfolgt **server-seitig**, weil sie Sales-Plattform-Daten, Auszahlungseinstellungen und Marketing-Daten kombiniert — zu viel Logik für den Client.

### Indikator-Logik (grau vs. blau)

| Spaltentyp | Zelle hat DB-Eintrag | Zelle hat keinen DB-Eintrag |
|---|---|---|
| Soll (Produktverkäufe) | Blauer Punkt (manuell) | Grauer Punkt (automatisch berechnet) |
| Soll (andere Kategorien) | Blauer Punkt (manuell) | Kein Punkt (leer) |
| Ist-Tatsächlich | Kein Punkt (nicht editierbar) | Kein Punkt |
| Ist-Plan | Kein Punkt (nicht editierbar) | Kein Punkt |

Merksatz: **Ein DB-Eintrag in `einnahmen_planung` = manuell = blauer Punkt.** Auto-Werte werden nie persistiert.

### Erweiterung Auszahlungseinstellungen (PROJ-45)

Das bestehende Formular (`auszahlungseinstellungen-formular.tsx`) bekommt eine neue Zeile:

```
Zeile 5: Verschiebung (KW)
- Beschriftung: „Verschiebung (KW)"
- Eingabe: Zahlenfeld, 0–12 Wochen, ganzzahlig
- Erklärungstext: „Wie viele Wochen nach dem Umsatzzeitpunkt geht die Zahlung ein"
- Auto-Save bei onBlur
- Gespeichert als verschiebung_wochen INTEGER in auszahlungs_einstellungen
```

### Neue und geänderte Dateien

**Neue Dateien:**

| Datei | Zweck |
|---|---|
| `src/app/api/einnahmen-planung/ist-tatsaechlich/route.ts` | GET-Route: aggregiert einnahmen_transaktionen nach zahlungsdatum-ISO-Woche je Kategorie; Parameter: von_kw, von_jahr, bis_kw, bis_jahr |
| `src/app/api/einnahmen-planung/produktverkaeufe-berechnet/route.ts` | GET-Route: komplexe server-seitige Produktverkäufe-Berechnung (lädt Sales-Plattform-Daten + Auszahlungseinstellungen + Marketingdaten); Parameter: von_kw, von_jahr, bis_kw, bis_jahr |
| DB-Migration | ALTER TABLE auszahlungs_einstellungen ADD COLUMN verschiebung_wochen INTEGER NOT NULL DEFAULT 0 |

**Geänderte Dateien:**

| Datei | Was ändert sich |
|---|---|
| `src/hooks/use-einnahmenplanung.ts` | Komplett überarbeiten: 5 parallele Datenlader, getIstTatsaechlich, getIstPlan, getSollManuell, getSollBerechnet, expandAll/collapseAll, resetAll (löscht nur manuelle Einträge) |
| `src/components/einnahmenplanung-tabelle.tsx` | Komplett überarbeiten: doppelte Spalten für Vergangenheit, Trennlinie, Produktverkäufe inkl. Indikatorpunkte, Einklappen-Buttons, Gesamt-Zeile unten |
| `src/app/api/auszahlungs-einstellungen/route.ts` | verschiebung_wochen im Zod-Schema ergänzen; in DB lesen und schreiben |
| `src/hooks/use-auszahlungs-einstellungen.ts` | verschiebung_wochen in State und API-Aufruf ergänzen |
| `src/components/auszahlungseinstellungen-formular.tsx` | Neues Eingabefeld „Verschiebung (KW)" ergänzen |

**Bestehende Dateien, die nicht geändert werden:**

| Datei | Warum unverändert |
|---|---|
| `src/app/api/einnahmen-planung/route.ts` | GET/PUT/DELETE bleibt unverändert; Ist-Plan und Soll-Manuell kommen weiterhin aus dieser Route |
| `src/app/dashboard/kurzfristige-planung/einnahmenplanung/page.tsx` | Nur minimale Änderung: Einklappen-Buttons in Header; Kernarbeit liegt in der Tabellen-Komponente |
| `src/components/nav-sheet.tsx` | Kein neuer Navigationseintrag nötig |

### Keine neuen Packages nötig

Alle benötigten Bausteine sind bereits im Projekt vorhanden:
- `date-fns` für ISO-Wochenberechnung
- shadcn `Table`, `Input`, `AlertDialog`, `Tooltip`, `Button` — alle vorhanden
- Notizen-Pattern (PROJ-53): bereits in Marketing-Planung und Sales Plattform Planung umgesetzt
- Betragsselektion-Pattern: bereits in mehreren Planungsseiten umgesetzt

### Abhängigkeiten zwischen den Implementierungsschritten

```
1. DB-Migration (verschiebung_wochen)
   ↓
2. Backend: API-Erweiterung auszahlungs-einstellungen (verschiebung_wochen)
   ↓
3. Backend: neue Route /ist-tatsaechlich
4. Backend: neue Route /produktverkaeufe-berechnet  ← kann parallel zu 3 erfolgen
   ↓
5. Frontend: use-einnahmenplanung (Hook überarbeiten)
   ↓
6. Frontend: einnahmenplanung-tabelle (Tabelle überarbeiten)
   ↓
7. Frontend: auszahlungseinstellungen-formular (Feld ergänzen)
```

---

## v1 Implementation Notes (2026-06-04 — als Referenz behalten)

### Neue Dateien (v1)
- `src/hooks/use-einnahmenplanung.ts` — Hook mit `useEinnahmenplanung()`: Kategorien laden (type=einnahmen, „Produktverkäufe" gefiltert), valueMap aufbauen, `getWert`, `upsertZelle`, `upsertBatch`, `resetAll` mit optimistischem Update + Rollback; `berechnePlanungswochen` und `PlanungsWoche` aus `use-absatzplanung` importiert; `isNewWeek`-Erkennung via Suffix-Check auf valueMap-Keys
- `src/components/einnahmenplanung-bulk-edit-dialog.tsx` — Modal mit 8 Methoden (kein absatz/vk-Typswitch da nur ein Werttyp), progressive Methoden gruppieren nach `kategorieId`, Unit-Label "%" oder "€"
- `src/components/einnahmenplanung-tabelle.tsx` — Hauptkomponente: flaches Zeilen-Array (4 Typen: total, category-header, category-sum, leaf), Expand/Collapse pro L1-Kategorie, Inline-Editing (click-to-edit), Betragsselektion (identisch Absatzplanung-Muster), Bulk-Edit-Toolbar für ≥ 2 editierbare Zellen, roter Spalten-Highlight für neue Woche, Reset-Dialog (shadcn AlertDialog), Aggregation (category-sum + total zeigen „—" wenn alle Kinder NULL)
- `src/app/dashboard/kurzfristige-planung/einnahmenplanung/page.tsx` — Client Component, Header + EinnahmenplanungTabelle + Toaster

### Geänderte Dateien (v1)
- `src/components/nav-sheet.tsx` — Eintrag „Einnahmenplanung" in der Gruppe „Planung"
- `src/app/dashboard/kurzfristige-planung/page.tsx` — Kachel „Einnahmenplanung" im Abschnitt „Planung"

### Abweichungen von der v1-Spec
- L1-Kategorien ohne Sub-Kategorien haben ebenfalls eine einklappbare Header-Zeile; das direkt editierbare Leaf erscheint bei indent=1 darunter (Spec-konform)
- Betragsselektion für Aggregationszeilen zeigt „—" wenn alle Kinder NULL sind (kein 0,00)
- Kein `category-header`-Wertanzeige (bewusst leer, nur Label + Toggle)
- Reset-Button und Bulk-Edit auf Nutzerwunsch in v1 nicht implementiert

### Build (v1)
- `npm run build` ✅ — Route `/dashboard/kurzfristige-planung/einnahmenplanung` korrekt in Build-Ausgabe

## Datenbankmigrierung (v1 — 2026-06-04)
- Migration `proj52_einnahmen_planung` erfolgreich auf Supabase angewendet
- Tabelle `einnahmen_planung` angelegt mit UUID-PK, FKs (auth.users + kpi_categories ON DELETE CASCADE), `betrag_manuell NUMERIC(12,2) NULL`, UNIQUE auf `(user_id, kategorie_id, kw_year, kw_number)`, RLS (4 Policies), 3 Indexes
- API-Routen: GET (max 2000), PUT (Upsert/null=delete, Zod), DELETE (Reset) — alle mit requireAuth()
- Tests (v1): 16 API-Tests ✅, 27 Hook-Tests ✅, 12 E2E-Tests ✅

## Frontend-Implementierung (Redesign — 2026-06-14)

### Geänderte Dateien
- `src/hooks/use-einnahmenplanung.ts` — Komplett neu geschrieben: lädt 5 Datenquellen (grundeinstellungen, kpi-categories, einnahmen-planung, ist-tatsaechlich, produktverkaeufe-berechnet). Produktverkäufe ist jetzt in `kategorien` enthalten. Neue Exporte: `vergangenheitswochen`, `zukunftswochen`, `istTatsaechlichMap`, `produktverkaeufeSollMap`, `getIstTatsaechlich`, `getIstPlan`, `getProduktverkaeufeSoll`, `isManuelleOverride`.
- `src/components/einnahmenplanung-tabelle.tsx` — Komplett neu geschrieben: Zwei Header-Zeilen (KW-Gruppen + Sub-Labels Ist-T/Ist-P/Soll), amber-farbener Vergangenheitsbereich, starke Trennlinie (border-l-4) zum Zukunftsbereich, grauer/blauer Indikatorpunkt für Produktverkäufe, Gesamt-Zeile unten, Reset-Button mit AlertDialog, Betragsselektion, Notizen.
- `src/app/dashboard/kurzfristige-planung/einnahmenplanung/page.tsx` — Titel aktualisiert auf „Einnahmenplanung".
- `src/hooks/use-einnahmenplanung.test.ts` — 2 Tests für Produktverkäufe-Filter-Verhalten angepasst, 1 neuer Test für `produktverkaeufenKatId`. 28 Tests ✅

### Build
- `npm run build` ✅ — Routes `/dashboard/kurzfristige-planung/einnahmenplanung`, `/api/einnahmen-planung/ist-tatsaechlich`, `/api/einnahmen-planung/produktverkaeufe-berechnet` alle korrekt in Build-Ausgabe.
- 86 Tests in `einnahmen*`-Dateien alle grün ✅

## Backend-Implementierung (Redesign — 2026-06-14)

### Neue API-Routen
- `src/app/api/einnahmen-planung/ist-tatsaechlich/route.ts` — GET mit Params `von_kw`, `von_jahr`, `bis_kw`, `bis_jahr`. Aggregiert `einnahmen_transaktionen` nach ISO-Woche (via `zahlungsdatum`). Leaf = `gruppe_id ?? kategorie_id`. Tests: 11 ✅
- `src/app/api/einnahmen-planung/produktverkaeufe-berechnet/route.ts` — GET (keine Params, lädt Planungshorizont aus Grundeinstellungen). Berechnet Payment-Timing mit Shift + Rhythmus per Plattform. Subtrahiert Marketing wenn `marketing_inkludiert = true`. Tests: 9 ✅

### Bestehende Routen unverändert
- `src/app/api/einnahmen-planung/route.ts` — GET/PUT/DELETE unverändert
- `src/app/api/auszahlungs-einstellungen/route.ts` — `verschiebung_wochen` war bereits vorhanden (DB-Spalte + Zod-Schema)
- `src/components/auszahlungseinstellungen-formular.tsx` — Feld `verschiebung_wochen` war bereits eingebaut
- `src/hooks/use-auszahlungs-einstellungen.ts` — `verschiebung_wochen` bereits typisiert

### Testlauf
- 36 Tests in `einnahmen-planung/` alle grün ✅ (npm test einnahmen-planung)

## Bugfix (2026-06-20) — Ist-Tatsächlich Plattform-Aufschlüsselung bei Produktverkäufe

**Symptom:** In der Vergangenheitsspalte „Ist-Tatsächlich" zeigte die Produktverkäufe-Kopfzeile den Gesamtwert, aber die Ebene darunter (Plattform-Unterzeilen Amazon/Otto/…) blieb leer — obwohl die Quelldaten vorlagen.

**Ursache:** Wenn Produktverkäufe im KPI-Modell keine L2-Unterkategorien hat, rendert die Tabelle Plattform-Unterzeilen (`kategorieId = sales_plattform.id`). Die Ist-Tatsächlich-Werte werden über `getIstTatsaechlich(plt.id, kw)` abgefragt, aber `/api/einnahmen-planung/ist-tatsaechlich` aggregierte nur nach `gruppe_id ?? kategorie_id` — nie nach `sales_plattform_id`. Plattform-Lookups lieferten daher immer `null`, obwohl `einnahmen_transaktionen.sales_plattform_id` die Daten enthält.

**Fix:** `ist-tatsaechlich/route.ts` aggregiert jede Transaktion mit `sales_plattform_id` zusätzlich unter einem Plattform-ID-Schlüssel. Plattform-UUIDs kollidieren nie mit Kategorie-UUIDs und werden nur von den PV-Plattform-Zeilen abgefragt; für alle anderen Zeilen sind die Extra-Einträge inert (auch wenn PV doch L2-Kinder hätte). Test ergänzt (12 Tests grün).

## Deployment
_To be added by /deploy_
