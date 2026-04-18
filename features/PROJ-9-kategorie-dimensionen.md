# PROJ-9: Kategorie-Dimensionen Konfiguration

## Status: Architected
**Created:** 2026-04-18
**Last Updated:** 2026-04-18

## Dependencies
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Hauptkategorien müssen existieren
- Ermöglicht: PROJ-3, PROJ-4, PROJ-5 — Transaktionseingabe nutzt diese Konfiguration für optionale Felder

## Übersicht
Für Hauptkategorien (Ebene 1) in den Tabs Umsatz, Einnahmen und Ausgaben & Kosten kann konfiguriert werden, ob bei der späteren Transaktionseingabe zusätzlich eine **Sales Plattform** und/oder ein **Produkt** ausgewählt werden muss. Diese Konfiguration erfolgt direkt in der KPI-Modell-Verwaltung über ein neues Icon pro Hauptkategorie, das ein Popover mit zwei Checkboxen öffnet.

## User Stories
- Als Nutzer möchte ich pro Hauptkategorie festlegen können, ob eine Sales Plattform angegeben werden muss, damit ich bei umsatzrelevanten Kategorien den Verkaufskanal tracken kann.
- Als Nutzer möchte ich pro Hauptkategorie festlegen können, ob ein Produkt angegeben werden muss, damit ich produktbezogene Umsätze und Kosten separat auswerten kann.
- Als Nutzer möchte ich die Dimension-Konfiguration direkt im KPI-Modell vornehmen können, damit alles an einem Ort gepflegt wird.
- Als Nutzer möchte ich sofort sehen, welche Hauptkategorien Sales Plattform oder Produkt-Dimensionen haben, damit ich die Konfiguration auf einen Blick überblicken kann.
- Als Nutzer möchte ich Dimensionen jederzeit an- und abschalten können, damit ich die Konfiguration flexibel anpassen kann.

## Acceptance Criteria
- [ ] Jede Hauptkategorie (Ebene 1) in den Tabs Umsatz, Einnahmen, Ausgaben & Kosten zeigt ein neues Konfigurations-Icon (z.B. Sliders oder Settings)
- [ ] Klick auf das Icon öffnet ein Popover mit zwei Checkboxen: "Sales Plattform" und "Produkt"
- [ ] Jede Checkbox kann unabhängig voneinander aktiviert/deaktiviert werden
- [ ] Änderungen werden sofort gespeichert (kein separater Speichern-Button im Popover)
- [ ] Aktivierte Dimensionen sind visuell erkennbar (Icon hat einen aktiven Zustand / Badge)
- [ ] Das Konfigurations-Icon erscheint NUR bei Hauptkategorien (Ebene 1), nicht bei Unter- oder Unter-Unterkategorien
- [ ] Das Konfigurations-Icon erscheint NUR in den Tabs Umsatz, Einnahmen, Ausgaben & Kosten — nicht in Sales Plattformen / Produkte Tabs
- [ ] Die Konfiguration wird in der Datenbank persistiert und bleibt nach Reload erhalten

## Beispiel
```
Operative Ausgaben  [Umbenennen] [+] [↑] [↓] [⚙ Dimensionen]
  └── Mobilität & Reisen         ← kein ⚙-Icon (Ebene 2)

⚙ Popover für "Operative Ausgaben":
  ☑ Sales Plattform
  ☐ Produkt
```

## Edge Cases
- Dimension wird deaktiviert, obwohl bereits Transaktionen mit dieser Dimension existieren → Warnung anzeigen: "X Transaktionen verwenden diese Dimension. Deaktivieren entfernt das Feld aus neuen Transaktionen, bestehende Daten bleiben erhalten."
- Nutzer öffnet Popover, klickt daneben → Popover schließt, keine ungespeicherten Änderungen (da jede Änderung sofort persistiert)
- Beide Dimensionen deaktiviert → normales Verhalten, kein Sonderfall
- Kategorie wird gelöscht → Dimensions-Konfiguration wird mit gelöscht (CASCADE)
- Neue Hauptkategorie erstellt → Standardmäßig beide Dimensionen deaktiviert

## Technical Requirements
- Zwei neue Boolean-Spalten auf `kpi_categories`: `sales_plattform_enabled` (default false), `produkt_enabled` (default false)
- PATCH `/api/kpi-categories/[id]` wird um diese Felder erweitert
- Nur relevant für `type IN ('umsatz', 'einnahmen', 'ausgaben_kosten')` und `level = 1`
- Die Konfiguration wird von PROJ-3/4/5 ausgelesen, um Pflichtfelder bei der Transaktionseingabe zu steuern

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
KpiCategoryRow (Ebene 1, nur in Umsatz/Einnahmen/Ausgaben & Kosten)
+-- [bestehende Icons: Umbenennen, +, ↑, ↓, Löschen]
+-- DimensionenButton (neu) — Sliders-Icon, aktiv-Badge wenn mind. 1 Dimension an
    +-- Popover (shadcn: Popover) — öffnet sich bei Klick
        +-- PopoverContent
            +-- Titel "Dimensionen"
            +-- Checkbox "Sales Plattform" (shadcn: Checkbox + Label)
            +-- Checkbox "Produkt" (shadcn: Checkbox + Label)
```

**Sichtbarkeitsregel:** `DimensionenButton` erscheint nur wenn:
- `category.level === 1` UND
- `maxLevel === 3` (also nicht in den flachen Sales Plattformen / Produkte Tabs)

### Datenmodell

```
Bestehende Tabelle: kpi_categories

Neue Felder (Migration):
- sales_plattform_enabled   Boolean, Standard: false
- produkt_enabled           Boolean, Standard: false

Nur semantisch relevant für type = umsatz / einnahmen / ausgaben_kosten, level = 1.
Technisch in allen Zeilen vorhanden (einfacheres Schema), aber UI zeigt es nur dort.
```

### API-Änderungen

```
PATCH /api/kpi-categories/[id]
  Bestehende Felder: name, sort_order, parent_id, level
  Neue Felder (optional): sales_plattform_enabled (boolean), produkt_enabled (boolean)

GET /api/kpi-categories?type=...
  Gibt bereits alle Spalten zurück — neue Felder kommen automatisch mit.
```

### Datenfluss

```
1. KpiCategoryRow rendert DimensionenButton (wenn level=1 + hierarchischer Tab)
2. Nutzer öffnet Popover → sieht aktuelle Checkbox-Zustände aus category.sales_plattform_enabled / .produkt_enabled
3. Nutzer klickt Checkbox → optimistisches Update im lokalen State
4. Sofortiger PATCH-Call an API mit dem geänderten Boolean
5. Bei Fehler: State wird zurückgesetzt (rollback)
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| UI-Pattern | Popover (shadcn) | Bereits installiert; öffnet sich on-click, schließt beim Klick außerhalb |
| Speichern | Sofort bei Checkbox-Klick | Kein "Speichern"-Button nötig → konsistent mit Inline-Edit im Rest der UI |
| Datenhaltung | Zwei Boolean-Spalten direkt auf kpi_categories | Einfachstes Schema; keine Extra-Tabelle nötig für 2 Flags |
| Rollback | Optimistic update + revert bei Fehler | UI bleibt schnell, Fehlerfall korrekt behandelt |
| Aktiv-Indikator | Farbiger Icon (text-primary) wenn mind. 1 aktiv | Sofortige visuelle Rückmeldung ohne extra Badge-Komponente |

### Keine neuen Packages
Popover und Checkbox sind bereits in `src/components/ui/` installiert.

### Geänderte Dateien
```
src/components/kpi-category-row.tsx     — DimensionenButton + Popover hinzufügen
src/hooks/use-kpi-categories.ts         — updateDimensions()-Funktion + neue Felder im KpiCategory-Typ
src/app/api/kpi-categories/[id]/route.ts — PATCH-Schema um boolean-Felder erweitern
src/app/api/kpi-categories/[id]/route.test.ts — Tests für neue PATCH-Felder
```
