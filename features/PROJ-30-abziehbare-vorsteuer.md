# PROJ-30: Abziehbare Vorsteuer

## Status: Planned
**Created:** 2026-05-14
**Last Updated:** 2026-05-14

## Dependencies
- PROJ-5: Ausgaben & Kosten-Transaktionen Eingabe (Datenquelle: `ausgaben_kosten_transaktionen` mit Feld `ust_betrag`)
- PROJ-2: KPI-Modell Verwaltung (Kategorie-Filter basiert auf KPI-Modell `ausgaben_kosten`)

## Overview
Eine neue Auswertungsseite im Bereich **Auswertungen** mit dem Titel „Abziehbare Vorsteuer". Sie filtert automatisch alle Ausgaben & Kosten-Transaktionen heraus, bei denen `ust_betrag > 0` (d. h. Umsatzsteuer wurde erhoben und ist als Vorsteuer abziehbar). Die restliche Filterstruktur ist identisch zur Ausgaben & Kosten-Seite.

## User Stories
- Als Controlling-Mitarbeiter möchte ich eine Übersicht aller Transaktionen mit abziehbarer Vorsteuer sehen, damit ich die Vorsteuersumme für die Umsatzsteuer-Voranmeldung schnell ermitteln kann.
- Als Controlling-Mitarbeiter möchte ich die Vorsteuer-Transaktionen nach Zeitraum (Von/Bis) filtern, damit ich den relevanten Berichtszeitraum eingrenzen kann.
- Als Controlling-Mitarbeiter möchte ich die Transaktionen nach Kategorie, Gruppe und Untergruppe filtern, damit ich Vorsteuer-Beträge je Kostenstelle analysieren kann.
- Als Controlling-Mitarbeiter möchte ich die Tabelle nach Leistungsdatum und Bruttobetrag sortieren können, damit ich die Daten in der gewünschten Reihenfolge sehe.
- Als Controlling-Mitarbeiter möchte ich durch mehrere Seiten blättern können (Paginierung), damit auch große Datenmengen handhabbar bleiben.

## Acceptance Criteria

### Filter-Leiste
- [ ] Von/Bis-Datumsfilter (Typ `date`, Bezugsdatum: `leistungsdatum`) vorhanden
- [ ] Kategorie-Filter (MultiSelect, Level-1-Kategorien aus KPI-Modell `ausgaben_kosten`)
- [ ] Gruppe-Filter erscheint nur, wenn genau 1 Kategorie ausgewählt ist (Kaskade)
- [ ] Untergruppe-Filter erscheint nur, wenn zusätzlich genau 1 Gruppe ausgewählt ist (Kaskade)
- [ ] „Filter zurücksetzen"-Button erscheint, sobald mindestens ein Filter aktiv ist
- [ ] Alle Filter sind identisch zur Abschreibungen-Auswertungsseite (PROJ-12)

### Datenbankfilter (automatisch, nicht durch Nutzer steuerbar)
- [ ] Es werden ausschließlich Transaktionen angezeigt, bei denen `ust_betrag > 0`
- [ ] Transaktionen mit `ust_betrag = 0` oder `ust_betrag IS NULL` werden nie angezeigt

### Tabelle
- [ ] Spalten: Leistungsdatum, Kategorie, Gruppe (wenn vorhanden), Untergruppe (wenn vorhanden), Betrag Brutto, Betrag Netto, USt-Satz (%), USt-Betrag (€)
- [ ] Spalten Gruppe/Untergruppe werden nur angezeigt, wenn im KPI-Modell entsprechende Ebenen vorhanden sind (analog zur Abschreibungen-Tabelle)
- [ ] Sortierung nach Leistungsdatum (Standard: absteigend) und Bruttobetrag möglich
- [ ] Paginierung: 50 Einträge pro Seite
- [ ] Leer-Zustand: hilfreiche Meldung wenn keine Transaktionen gefunden (z. B. „Keine Transaktionen mit Vorsteuer für diesen Zeitraum")
- [ ] Lade-Zustand: Skeleton/Spinner während Datenabruf

### Keine Summierung
- [ ] Es gibt keine Summenzeile in der Tabelle

### Navigation
- [ ] Seite ist unter dem Bereich **Auswertungen** im Navigationsmenü erreichbar
- [ ] Seitentitel im Header: „Abziehbare Vorsteuer"
- [ ] Route: `/dashboard/vorsteuer`

### Fehlerbehandlung
- [ ] API-Fehler werden als rote Fehlermeldung über der Tabelle angezeigt
- [ ] Wenn kein KPI-Modell für `ausgaben_kosten` vorhanden: Hinweismeldung mit Link zum KPI-Modell (analog zu anderen Auswertungsseiten)

## Edge Cases
- Wenn `ust_betrag` in der DB als `0` gespeichert ist (nicht NULL): Transaktion wird korrekt ausgeschlossen
- Wenn `ust_satz` einen Prozentwert wie `"19%"` als String enthält: wird direkt als Text ausgegeben, keine Berechnung nötig
- Wenn das KPI-Modell nur 1 Ebene hat: Gruppe- und Untergruppe-Spalten werden ausgeblendet, Kaskaden-Filter erscheinen nicht
- Wenn Sales-Plattform- oder Produkt-Filter im KPI-Modell aktiviert sind: Diese Filter werden auf der Vorsteuer-Seite NICHT angezeigt (da nicht relevant für Vorsteuer-Analyse)
- Keine Transaktionen nach Filter: Leerer Zustand statt Fehler
- Sehr viele Transaktionen: Paginierung greift, Performance-kritisch bei > 1000 Einträgen

## Technical Requirements
- Neuer API-Endpunkt: `GET /api/vorsteuer-transaktionen` (oder bestehenden `/api/ausgaben-kosten-transaktionen`-Endpunkt mit zusätzlichem `nur_mit_ust=true`-Parameter erweitern)
- Authentifizierung: Supabase-Session erforderlich
- Performance: API-Response < 500ms für 50 Einträge
- Neuer Custom Hook: `useVorsteuerTransaktionen` (analog zu `useAbschreibungen`)
- Neue Tabellenkomponente: `VorsteuerTable` (analog zu `AbschreibungenTable`)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
