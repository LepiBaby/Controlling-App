# PROJ-5: Ausgaben & Kosten-Transaktionen Eingabe

## Status: Planned
**Created:** 2026-04-17
**Last Updated:** 2026-04-17

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer können Transaktionen eingeben
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Ausgaben & Kosten-KPI-Modell muss vor erster Eingabe definiert sein
- Future: PROJ-8 (Ausgaben/Kosten Trennungslogik) — wird diese Tabelle später in zwei separate Tabellen aufteilen

## Übersicht
Manuelle Erfassung und Verwaltung von Ausgaben- und Kosten-Transaktionen in einer kombinierten Eingabetabelle. Ausgaben (Geldzahlungen, Liquiditätssicht) und Kosten (wirtschaftlicher Aufwand, Rentabilitätssicht) werden vorerst gemeinsam erfasst. Die Trennung in separate Tabellen erfolgt in PROJ-8. Das Datenmodell wird von Anfang an so gestaltet, dass die spätere Trennung ohne Datenverlust möglich ist.

## User Stories
- Als Nutzer möchte ich eine neue Ausgaben/Kosten-Transaktion mit Datum, Betrag und Kategorie erfassen können, damit alle Zahlungen und Aufwände vollständig dokumentiert sind.
- Als Nutzer möchte ich beim Kategorisieren durch die Kategorie-Hierarchie navigieren können (Kategorie → Unterkategorie → Unter-Unterkategorie), damit die Transaktion korrekt eingeordnet wird.
- Als Nutzer möchte ich alle Ausgaben & Kosten-Transaktionen in einer Tabelle sehen können, damit ich einen Überblick habe.
- Als Nutzer möchte ich bestehende Transaktionen bearbeiten können, damit Fehler korrigiert werden können.
- Als Nutzer möchte ich Transaktionen löschen können, damit Fehlerfassungen entfernt werden können.
- Als Nutzer möchte ich die Tabelle nach Datum, Betrag und Kategorie filtern/sortieren können.

## Acceptance Criteria
- [ ] Ausgaben & Kosten-Seite zeigt eine Tabelle aller Transaktionen (neueste zuerst)
- [ ] "Neue Transaktion"-Button öffnet ein Eingabeformular (Modal oder Inline)
- [ ] Pflichtfelder: Datum (Date-Picker), Betrag (Zahl, positiv, mit Währungssymbol), Kategorie (Pflichtfeld)
- [ ] Kategorie-Auswahl: Dropdown zeigt zunächst Ebene-1-Kategorien aus dem Ausgaben & Kosten-KPI-Modell; nach Auswahl erscheint Ebene-2-Dropdown (falls vorhanden); analog für Ebene 3
- [ ] Wenn eine Kategorie keine Unterkategorien hat, kann sie direkt als finale Kategorie gewählt werden
- [ ] Transaktion kann nur gespeichert werden wenn alle Pflichtfelder ausgefüllt sind
- [ ] Gespeicherte Transaktion erscheint sofort in der Tabelle
- [ ] Transaktion bearbeiten: Klick auf Zeile oder Edit-Icon öffnet vorausgefülltes Formular
- [ ] Transaktion löschen: Bestätigungs-Dialog vor dem Löschen
- [ ] Tabelle sortierbar nach: Datum, Betrag (auf-/absteigend)
- [ ] Tabelle filterbar nach: Zeitraum (Von/Bis), Kategorie
- [ ] Betrag-Anzeige in EUR mit Tausender-Trennzeichen (z.B. 3.750,00 €)
- [ ] Tabelle zeigt Summe aller sichtbaren Transaktionen in der Fußzeile

## Tabellen-Spalten (MVP — erweiterbar)
| Spalte | Pflicht | Typ | Beschreibung |
|--------|---------|-----|-------------|
| Datum | Ja | Date | Datum der Zahlung / des Aufwands |
| Betrag | Ja | Decimal | Betrag in EUR |
| Kategorie | Ja | KPI-Hierarchie | Aus Ausgaben & Kosten-KPI-Modell (max. 3 Ebenen) |
| Beschreibung | Nein | Text | Freitext-Notiz |
| *weitere TBD* | | | Werden in späterem Sprint ergänzt |

## Vorbereitung für PROJ-8 (Trennungslogik)
Das Datenmodell enthält bereits ein optionales Feld `transaction_type` (enum: `ausgabe` / `kosten` / `null`), das in PROJ-8 genutzt wird. In der MVP-Phase ist dieses Feld nicht sichtbar und nicht ausfüllbar — es wird durch PROJ-8 automatisch oder regelbasiert befüllt.

## Edge Cases
- Kein Ausgaben & Kosten-KPI-Modell vorhanden → Eingabeformular zeigt Hinweis "Bitte zuerst KPI-Modell unter Einstellungen definieren" mit Link
- Betrag = 0 oder negativ → Validierungsfehler
- Datum in der Zukunft → Warnung, aber nicht blockiert (Vorauserfassung möglich)
- Kategorie aus KPI-Modell wird nach Erfassung umbenannt → Gespeicherte Kategorie-ID bleibt erhalten, Anzeige zeigt neuen Namen
- Kategorie aus KPI-Modell wird gelöscht → Transaktion zeigt "[Kategorie gelöscht]" und muss re-kategorisiert werden
- Sehr viele Transaktionen (1000+) → Paginierung (50 pro Seite) oder virtuelles Scrolling

## Technical Requirements
- Tabellen-Name in Supabase: `ausgaben_kosten_transaktionen`
- Fremdschlüssel auf `kpi_categories` für Kategorie-Zuordnung (alle drei Ebenen)
- Feld `transaction_type` (nullable enum) für spätere Trennung vorbereiten
- Beträge als `decimal(15,2)` gespeichert
- RLS: Nur eingeloggte Nutzer können lesen/schreiben

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
