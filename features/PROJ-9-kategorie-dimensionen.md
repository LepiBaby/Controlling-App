# PROJ-9: Kategorie-Dimensionen Konfiguration

## Status: Planned
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
- Zwei neue Booleam-Spalten auf `kpi_categories`: `sales_plattform_enabled` (default false), `produkt_enabled` (default false)
- PATCH `/api/kpi-categories/[id]` wird um diese Felder erweitert
- Nur relevant für `type IN ('umsatz', 'einnahmen', 'ausgaben_kosten')` und `level = 1`
- Die Konfiguration wird von PROJ-3/4/5 ausgelesen, um Pflichtfelder bei der Transaktionseingabe zu steuern
