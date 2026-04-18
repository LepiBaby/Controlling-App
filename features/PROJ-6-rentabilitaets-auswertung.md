# PROJ-6: Rentabilitäts-Auswertung

## Status: Planned
**Created:** 2026-04-17
**Last Updated:** 2026-04-17

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-3 (Umsatz-Transaktionen) — Datenquelle für Erlöse
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen) — Datenquelle für Kosten
- Recommends: PROJ-8 (Ausgaben/Kosten Trennungslogik) — für saubere Kosten-Isolierung aus der kombinierten Tabelle

## Übersicht
Tabellarische Gegenüberstellung von Umsatz und Kosten zur Darstellung der Rentabilität des Unternehmens. Die genaue Struktur (Zwischensummen, Gliederungsebenen, Zeitraumvergleich) wird in einem späteren Sprint spezifiziert — dieser Spec definiert die Grundanforderungen.

## User Stories
- Als Nutzer möchte ich Umsatz und Kosten für einen wählbaren Zeitraum in einer gemeinsamen Tabelle sehen, damit ich die Rentabilität auf einen Blick beurteilen kann.
- Als Nutzer möchte ich die Rentabilitäts-Auswertung nach Kategorien gegliedert sehen, damit ich erkennen kann, in welchen Bereichen Gewinn oder Verlust entsteht.
- Als Nutzer möchte ich den Zeitraum der Auswertung frei wählen können (Monat, Quartal, Jahr, custom), damit ich flexible Analysen durchführen kann.

## Acceptance Criteria
- [ ] Dedizierte Auswertungsseite "Rentabilität"
- [ ] Zeitraum-Filter: Schnellauswahl (aktueller Monat, letzter Monat, aktuelles Quartal, aktuelles Jahr) + Custom (Von/Bis Datum)
- [ ] Tabellarische Darstellung mit Umsatz-Summen und Kosten-Summen pro Kategorie (Ebene 1)
- [ ] Zwischensummen und Gliederung nach KPI-Kategorien (Detailstruktur TBD in späterem Sprint)
- [ ] Gesamtergebnis (Umsatz − Kosten) wird am Ende der Tabelle angezeigt
- [ ] Positive Werte (Gewinn) grün, negative Werte (Verlust) rot hervorgehoben
- [ ] Tabelle ist exportierbar (CSV oder Excel) — nice-to-have für MVP

## Edge Cases
- Keine Transaktionen im gewählten Zeitraum → Leere Tabelle mit Hinweistext
- Kosten-Transaktionen noch nicht nach Ausgaben/Kosten getrennt (PROJ-8 noch nicht implementiert) → Alle Ausgaben & Kosten als "Kosten" behandelt, mit Hinweis "Trennungslogik noch nicht konfiguriert"

## Offene Punkte (für späteren Sprint)
- Genaue Zwischensummen-Logik und Gliederungstiefe
- Vergleich mit Vorperiode (aktuell vs. Vormonat/Vorjahr)
- Prozentuale Margenberechnung
- Export-Format

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
