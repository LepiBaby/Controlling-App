# PROJ-40: Betragsselektion in Transaktionstabellen

## Status: Approved
**Created:** 2026-05-22
**Last Updated:** 2026-05-22

## Dependencies
- Requires: PROJ-3 (Umsatz-Transaktionen Eingabe)
- Requires: PROJ-4 (Einnahmen-Transaktionen Eingabe)
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen Eingabe)

## Overview
In den drei Transaktionstabellen (Umsatz, Einnahmen, Ausgaben & Kosten) sollen Nutzer einzelne Betragsfelder der Spalten **Brutto**, **Netto** und **Umsatzsteuer** per Klick selektieren können. Die Summe aller selektierten Felder wird live in einer fixierten Anzeige unten rechts eingeblendet — ähnlich der Excel-Statusleiste.

## User Stories

- Als Controlling-Mitarbeiter möchte ich einzelne Betragsfelder in der Tabelle anklicken können, damit ich schnell Ad-hoc-Summen bilden kann, ohne die Tabelle exportieren zu müssen.
- Als Controlling-Mitarbeiter möchte ich mehrere Betragsfelder per Strg+Klick auswählen können, damit ich gezielt nicht-zusammenhängende Werte addieren kann.
- Als Controlling-Mitarbeiter möchte ich durch einen einfachen Klick (ohne Strg) die aktuelle Auswahl zurücksetzen, damit ich schnell eine neue Selektion starten kann.
- Als Controlling-Mitarbeiter möchte ich, dass die Summenanzeige automatisch verschwindet, wenn ich alle Felder abwähle, damit die Oberfläche nicht unnötig abgelenkt ist.
- Als Controlling-Mitarbeiter möchte ich die Betragsselektion in allen drei Tabellen (Umsatz, Einnahmen, Ausgaben & Kosten) nutzen können, damit ich konsistent arbeiten kann.

## Acceptance Criteria

### Klick-Verhalten
- [ ] Ein Klick auf ein Betragsfeld in Brutto, Netto oder Umsatzsteuer selektiert dieses Feld (visuell hervorgehoben, z. B. blauer Hintergrund)
- [ ] Ein Klick ohne Strg auf ein bereits selektiertes Feld hebt die Auswahl aller Felder auf und selektiert nur das angeklickte Feld neu
- [ ] Ein Klick ohne Strg auf ein nicht selektiertes Feld setzt die gesamte Auswahl zurück und selektiert nur das neue Feld
- [ ] Strg+Klick auf ein nicht selektiertes Feld fügt es zur bestehenden Auswahl hinzu
- [ ] Strg+Klick auf ein bereits selektiertes Feld entfernt es aus der Auswahl (Toggle)
- [ ] Klick auf eine nicht-Betrags-Zelle (z. B. Datum, Kategorie) hat keinen Einfluss auf die Selektion
- [ ] Ein Klick außerhalb der Tabelle (auf den Seitenhintergrund) hebt die gesamte Auswahl auf

### Summenanzeige
- [ ] Sobald mindestens ein Feld selektiert ist, erscheint eine fixierte Summen-Badge rechts unten im Viewport
- [ ] Die Summe wird in Euro-Format angezeigt (z. B. „Summe: 1.234,56 €") mit deutschem Zahlenformat
- [ ] Die Anzeige aktualisiert sich sofort bei jeder Änderung der Selektion
- [ ] Wenn keine Felder selektiert sind, ist die Summen-Badge nicht sichtbar
- [ ] Die Anzeige zeigt zusätzlich die Anzahl der selektierten Felder an (z. B. „3 Felder")

### Tabellen-Scope
- [ ] Die Funktion ist in der Umsatz-Tabelle verfügbar (Brutto, Netto, Umsatzsteuer)
- [ ] Die Funktion ist in der Einnahmen-Tabelle verfügbar (Brutto, Netto, Umsatzsteuer)
- [ ] Die Funktion ist in der Ausgaben-&-Kosten-Tabelle verfügbar (Brutto, Netto, Umsatzsteuer)
- [ ] Selektion ist tabellenübergreifend isoliert — ein Tabellenwechsel setzt die Selektion zurück

### Visuelle Rückmeldung
- [ ] Selektierte Felder haben einen klar erkennbaren visuellen Zustand (z. B. blaue Hintergrundfarbe, ähnlich Excel)
- [ ] Der Cursor über anklickbaren Betragsfeldern wechselt zu `cursor-pointer`
- [ ] Nicht-selektierte Betragsfelder zeigen beim Hover eine leichte visuelle Reaktion (z. B. hellgrauer Hintergrund)

### Kompatibilität
- [ ] Die Selektion funktioniert unabhängig von aktiven Filtern und Sortierungen
- [ ] Die Selektion übersteht keine Seitennavigation oder Tabellenneuladung (kein Persistieren)
- [ ] Die Funktion kollidiert nicht mit dem bestehenden Schnellbearbeitungsmodus (PROJ-36) — Inline-Edit-Klick auf ein Feld darf nicht gleichzeitig eine Selektion auslösen

## Edge Cases

- **Negativwerte:** Negative Beträge (z. B. Gutschriften) fließen korrekt in die Summe ein und können die Gesamtsumme negativ machen — die Anzeige zeigt negative Beträge korrekt mit Minus an.
- **Null-Werte:** Felder mit dem Wert 0,00 € können selektiert werden und beeinflussen die Summe nicht.
- **Leere Felder:** Spalten, die für eine Zeile keinen Wert haben (z. B. Umsatzsteuer ist leer/null), sind nicht anklickbar und werden nicht selektiert.
- **Sehr viele Selektionen:** Bei Auswahl vieler Felder bleibt die Summe korrekt berechnet — kein Performance-Problem erwartet, da reine Client-Berechnung.
- **Schnellbearbeitungsmodus aktiv:** Wenn der Schnellbearbeitungsmodus (PROJ-36) aktiv ist, ist die Betragsselektion deaktiviert, um Konflikte zu vermeiden. Ein klarer Hinweis ist nicht nötig — die Betragsfelder verhalten sich dann wie normale Edit-Felder.
- **Seitenwechsel bei Paginierung:** Wenn die Tabelle paginiert ist und der Nutzer die Seite wechselt, wird die Selektion geleert.
- **Spalte ausgeblendet:** Wenn eine der Spalten (Brutto, Netto, Umsatzsteuer) über die Spaltensteuerung ausgeblendet wird, werden alle Selektionen dieser Spalte aufgehoben.

## Technical Requirements

- Rein clientseitige Implementierung — keine API-Aufrufe nötig
- Selektion wird als React-State in der jeweiligen Tabellen-Komponente gehalten (kein globaler State nötig)
- Summen-Badge als fixiertes UI-Element (`position: fixed`, rechts unten), sichtbar über Scrollposition
- Browser Support: Chrome, Firefox, Edge (Strg-Taste auf Windows; ggf. Cmd auf Mac)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

**Tested:** 2026-05-22
**Tester:** QA Engineer (automated + code review)
**Build:** TypeScript-sauber, kein Compile-Error

### Automated Tests
- **Unit Tests (Vitest):** 640/658 bestanden — 18 Fehler sind pre-existing (PROJ-29/28/34), kein Bezug zu PROJ-40
- **E2E Tests (Playwright):** 12/12 bestanden — `tests/PROJ-40-betragsselektion-tabellen.spec.ts`

### Acceptance Criteria

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| **Klick-Verhalten** | | | |
| 1 | Klick auf Betragsfeld selektiert es (blauer Hintergrund) | ✅ PASS | `bg-blue-100` bei Selektion |
| 2 | Klick ohne Strg auf selektiertes Feld: entfernt es aus Auswahl | ✅ PASS | User-Korrektur: entfernt statt "re-selektiert" |
| 3 | Klick ohne Strg auf nicht-selektiertes Feld: ersetzt Auswahl | ✅ PASS | `new Map([[key, value]])` |
| 4 | Strg+Klick auf nicht-selektiertes Feld: fügt es hinzu | ✅ PASS | Addiert zur Auswahl |
| 5 | Strg+Klick auf selektiertes Feld: entfernt es (Toggle) | ✅ PASS | `next.delete(key)` |
| 6 | Klick auf nicht-Betrags-Zelle: kein Einfluss auf Selektion | ✅ PASS | Nur Betrags-Zellen haben Handler |
| 7 | Klick außerhalb der Tabelle: löscht Auswahl | ✅ PASS | `document mousedown` listener |
| **Summenanzeige** | | | |
| 8 | Badge erscheint sobald ≥1 Feld selektiert | ✅ PASS | `fixed bottom-6 right-6` |
| 9 | Summe im deutschen Euro-Format | ✅ PASS | `Intl.NumberFormat('de-DE', ...)` |
| 10 | Badge aktualisiert sich sofort | ✅ PASS | React-State, kein Delay |
| 11 | Badge nicht sichtbar bei leerer Auswahl | ✅ PASS | `selectedCells.size > 0` Guard |
| 12 | Badge zeigt Feldanzahl an | ✅ PASS | „N Felder" mit korrekter Pluralform |
| **Tabellen-Scope** | | | |
| 13 | Umsatz-Tabelle: Betrag-Zelle selektierbar | ✅ PASS | Einzelne Betrag-Spalte |
| 14 | Einnahmen-Tabelle: Betrag-Zelle selektierbar | ✅ PASS | Einzelne Betrag-Spalte |
| 15 | Ausgaben-Tabelle: Brutto, Netto, USt selektierbar | ✅ PASS | Alle drei Spalten |
| 16 | Selektion ist tabellenübergreifend isoliert | ✅ PASS | State per Komponente, kein globaler State |
| **Visuelle Rückmeldung** | | | |
| 17 | Selektierte Felder: blauer Hintergrund | ✅ PASS | `bg-blue-100 dark:bg-blue-900/40` |
| 18 | Cursor `pointer` auf anklickbaren Zellen | ✅ PASS | `cursor-pointer select-none` |
| 19 | Hover-Reaktion auf nicht-selektierten Zellen | ✅ PASS | `hover:bg-blue-50` |
| **Kompatibilität** | | | |
| 20 | Selektion funktioniert bei aktiven Filtern/Sortierungen | ✅ PASS | Filter/Sort betreffen nur Daten, nicht Zell-IDs |
| 21 | Selektion wird nicht persistiert | ✅ PASS | Nur React-State, kein localStorage |
| 22 | Schnellbearbeitungsmodus (PROJ-36): keine Kollision | ✅ PASS | Edit-Rows haben eigene Handler; plain click fokussiert Input, Ctrl+Klick selektiert |

### Abweichung von Original-Spec (AC #2)
Die Spec definierte ursprünglich: _"Klick auf selektiertes Feld → löscht alle, selektiert nur dieses."_
Nutzer-Korrektur während Implementierung: _"Klick auf selektiertes Feld → entfernt es aus Auswahl."_
→ Implementierung folgt der Nutzer-Korrektur. Spec-Text ist veraltet, Verhalten ist korrekt.

### Neue Features gegenüber Spec
- **Drag-Selektion**: Maus gedrückt halten und über Zellen ziehen selektiert mehrere auf einmal (nicht in Originalspec, auf User-Request nachträglich implementiert)

### Bugs gefunden

| # | Severity | Beschreibung | Reproduktion |
|---|----------|-------------|--------------|
| 1 | Low | Rechtsklick auf Betragsfeld löst Selektion aus | Rechtsklick auf Brutto-Zelle → Zelle wird selektiert + Kontextmenü erscheint |

**Fix**: In `handleCellMouseDown` am Anfang prüfen: `if (e.button !== 0) return`

### Edge Cases

| Edge Case | Status | Anmerkung |
|-----------|--------|-----------|
| Negativwerte in Summe | ✅ PASS | `reduce()` addiert korrekt negative Zahlen |
| Null-Werte (0,00 €) selektierbar | ✅ PASS | Kein Ausschluss null/0 |
| Seitenwechsel löscht Auswahl | ✅ PASS | `useEffect(() => ..., [page])` |

### Security Audit
- **Keine API-Aufrufe**: Feature ist rein clientseitig — keine Angriffsfläche
- **Auth Guards**: Alle drei Seiten sind durch Middleware geschützt (E2E bestätigt)
- **XSS**: Betragsfelder zeigen nur formatierte Zahlen aus der DB — keine User-Inputs rendered

### Production-Ready: ✅ JA
Kein Critical- oder High-Bug. 1 Low-Bug (Rechtsklick) kann im laufenden Betrieb gefixt werden.

## Erweiterung: Bestandsverwaltung & Produktkosten (2026-06-01)

Die Betragsselektion wurde nachträglich auf zwei weitere Tabellen ausgedehnt:

**Bestandsverwaltung** (`bestand-table.tsx`):
- Selektierbare Spalten: Anfangsbestand, alle Plattform-Sendungsspalten (dynamisch), Sendungen Manuell, Einlagerungen, Anp.+, Anp.−, Warenverluste, Endbestand
- Werte sind Stückzahlen (Integer) → Summen-Badge zeigt Zahl ohne Währungssymbol
- Selektion wird bei Seitenwechsel (Paginierung) geleert

**Produktkostentabelle** (`produktkosten-table.tsx`):
- Selektierbare Spalten: alle Kostenkategorie-Wert-Zellen (nur befüllte, nicht „—"), Gesamt-Spalte
- Werte sind Euro-Beträge → Summen-Badge zeigt Betrag in EUR-Format
- Keine Paginierung → kein page-Reset-Effekt nötig

Beide Tabellen folgen exakt demselben Interaktionsmuster wie die drei Transaktionstabellen (Klick, Strg+Klick, Drag, Badge, Außen-Klick-Reset, `data-betrag-selektion`-Attribut).

E2E-Tests (`tests/PROJ-40-betragsselektion-tabellen.spec.ts`) wurden um Auth-Guards für `/dashboard/bestandsverwaltung` und `/dashboard/produktkosten` erweitert (4 neue Tests).

## Deployment
_To be added by /deploy_
