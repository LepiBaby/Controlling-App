# PROJ-8: Ausgaben/Kosten Trennungslogik

## Status: Won't Do
**Created:** 2026-04-17
**Last Updated:** 2026-04-19

## Dependencies
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Kategorien müssen als "Ausgabe" oder "Kosten" klassifiziert werden können
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen) — kombinierte Tabelle wird getrennt
- Requires: PROJ-6 (Rentabilitäts-Auswertung) — muss Kosten-Isolierung nutzen
- Requires: PROJ-7 (Liquiditäts-Auswertung) — muss Ausgaben-Isolierung nutzen

## Übersicht
Regelbasierte Trennung der kombinierten Ausgaben & Kosten-Tabelle in zwei logisch getrennte Gruppen: **Ausgaben** (Geldabflüsse für die Liquiditätssicht) und **Kosten** (wirtschaftlicher Aufwand für die Rentabilitätssicht). Die Trennung erfolgt über die Kategoriezuordnung im KPI-Modell — jede Kategorie wird einmalig als "Ausgabe" oder "Kosten" klassifiziert.

> **Hintergrund:** Ausgaben und Kosten unterscheiden sich betriebswirtschaftlich (z.B. ist eine Abschreibung eine Kosten aber keine Ausgabe; eine Anzahlung ist eine Ausgabe aber keine Kosten). Die genaue Trennungslogik wird in diesem Sprint zusammen mit dem Nutzer definiert.

## User Stories
- Als Nutzer möchte ich im KPI-Modell für jede Ausgaben/Kosten-Kategorie festlegen können ob sie eine "Ausgabe", eine "Kosten" oder "beides" ist, damit die automatische Trennung korrekt funktioniert.
- Als Nutzer möchte ich eine Übersicht sehen welche Kategorien als Ausgabe/Kosten/beides klassifiziert sind, damit ich die Konfiguration nachvollziehen kann.
- Als System sollen alle bestehenden Transaktionen anhand ihrer Kategorie-Klassifizierung automatisch dem richtigen Typ zugeordnet werden.
- Als Nutzer möchte ich einzelne Transaktionen manuell überschreiben können (Ausgabe → Kosten oder umgekehrt), wenn die Regel nicht passt.

## Acceptance Criteria
- [ ] Im KPI-Modell (PROJ-2) erhält jede Ausgaben & Kosten-Kategorie ein neues Pflichtfeld: Typ (Ausgabe / Kosten / Beides)
- [ ] Alle bestehenden Transaktionen erhalten automatisch einen `transaction_type` basierend auf ihrer Kategorie-Klassifizierung
- [ ] Neue Transaktionen erben den Typ automatisch von ihrer Kategorie
- [ ] Manuelle Überschreibung des Typs pro Transaktion ist möglich (für Sonderfälle)
- [ ] Rentabilitäts-Auswertung (PROJ-6) nutzt nur Transaktionen mit `type = kosten`
- [ ] Liquiditäts-Auswertung (PROJ-7) nutzt nur Transaktionen mit `type = ausgabe`
- [ ] Transaktionen mit `type = beides` erscheinen in beiden Auswertungen
- [ ] Migrations-Assistent: Nutzer kann alle unkategorisierten Transaktionen in einem Schritt zuweisen

## Edge Cases
- Kategorie erhält nachträglich anderen Typ → Nur zukünftige Transaktionen erben neuen Typ; bestehende bleiben unverändert (keine automatische Rückwirkung, aber Hinweis mit Option zur Massenaktualisierung)
- Transaktion hat Kategorie die noch nicht klassifiziert ist → Transaktion erscheint in keiner Auswertung, ist mit Hinweis "[Typ nicht definiert]" markiert
- Kategorie ist "Beides" → Betrag erscheint in beiden Auswertungen; in der Auswertung klar als "Doppelzählung" markiert falls relevant

## Offene Punkte (für Sprint-Planung)
- Exakte betriebswirtschaftliche Regeln für Ausgabe vs. Kosten-Unterscheidung mit dem Nutzer abzustimmen
- Ob "Beides" wirklich notwendig ist oder ob sauberere Trennung reicht

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
