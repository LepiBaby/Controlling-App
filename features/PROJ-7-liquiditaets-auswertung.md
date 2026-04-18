# PROJ-7: Liquiditäts-Auswertung

## Status: Planned
**Created:** 2026-04-17
**Last Updated:** 2026-04-17

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-4 (Einnahmen-Transaktionen) — Datenquelle für Geldzuflüsse
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen) — Datenquelle für Geldabflüsse (Ausgaben-Teil)
- Recommends: PROJ-8 (Ausgaben/Kosten Trennungslogik) — für saubere Ausgaben-Isolierung aus der kombinierten Tabelle

## Übersicht
Tabellarische Gegenüberstellung von Einnahmen und Ausgaben zur Darstellung der Liquiditätssituation des Unternehmens. Die genaue Struktur (Zwischensummen, Gliederungsebenen, Periodenvergleich) wird in einem späteren Sprint spezifiziert — dieser Spec definiert die Grundanforderungen.

## User Stories
- Als Nutzer möchte ich Einnahmen und Ausgaben für einen wählbaren Zeitraum in einer gemeinsamen Tabelle sehen, damit ich die Liquiditätssituation auf einen Blick beurteilen kann.
- Als Nutzer möchte ich die Liquiditäts-Auswertung nach Kategorien gegliedert sehen, damit ich erkennen kann, woher Geld fließt und wohin es geht.
- Als Nutzer möchte ich den Zeitraum frei wählen können (Monat, Quartal, Jahr, custom), damit ich flexible Analysen durchführen kann.

## Acceptance Criteria
- [ ] Dedizierte Auswertungsseite "Liquidität"
- [ ] Zeitraum-Filter: Schnellauswahl (aktueller Monat, letzter Monat, aktuelles Quartal, aktuelles Jahr) + Custom (Von/Bis Datum)
- [ ] Tabellarische Darstellung mit Einnahmen-Summen und Ausgaben-Summen pro Kategorie (Ebene 1)
- [ ] Zwischensummen und Gliederung nach KPI-Kategorien (Detailstruktur TBD in späterem Sprint)
- [ ] Netto-Cashflow (Einnahmen − Ausgaben) wird am Ende der Tabelle angezeigt
- [ ] Positiver Cashflow grün, negativer Cashflow rot hervorgehoben
- [ ] Tabelle ist exportierbar (CSV oder Excel) — nice-to-have für MVP

## Edge Cases
- Keine Transaktionen im gewählten Zeitraum → Leere Tabelle mit Hinweistext
- Ausgaben noch nicht von Kosten getrennt (PROJ-8 noch nicht implementiert) → Alle Ausgaben & Kosten als "Ausgaben" behandelt, mit Hinweis "Trennungslogik noch nicht konfiguriert"

## Offene Punkte (für späteren Sprint)
- Genaue Zwischensummen-Logik und Gliederungstiefe
- Kumulativer Cashflow über Zeit (Chart)
- Vergleich mit Vorperiode
- Export-Format

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
