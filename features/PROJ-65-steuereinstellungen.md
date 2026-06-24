# PROJ-65: Steuereinstellungen — Kurzfristige Planung

## Status: Approved
**Created:** 2026-06-13
**Last Updated:** 2026-06-13

## Implementation Notes
- Frontend (Hooks, Komponente, Page, Nav, Dashboard) vollständig implementiert
- Backend (Supabase-Tabellen + API-Routen + Tests) vollständig implementiert
- 30/30 Unit-Tests bestanden
- Supabase-Migration: `create_ust_einstellungen_tables`

## Dependencies
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Einnahmen- und Ausgabenkategorien werden dynamisch aus dem KPI-Modell gelesen
- Requires: PROJ-50 (Grundeinstellungen) — als Referenzimplementierung für einfache globale Einstellungsseiten
- Requires: PROJ-59 (Produktinformationen) — als Referenzimplementierung für tabellarische Einstellungsseiten mit KPI-Kategorien

## User Stories

- Als Controlling-Mitarbeiter möchte ich die Zahlungsfrequenz der Umsatzsteuer (monatlich oder quartalsweise) zentral konfigurieren können, damit die Planungsliquidität korrekt berechnet wird.
- Als Controlling-Mitarbeiter möchte ich die Zahlungsverschiebung der Umsatzsteuer in Tagen festlegen können, damit der tatsächliche Zahlungszeitpunkt im Liquiditätsplan abgebildet wird.
- Als Controlling-Mitarbeiter möchte ich für jede im KPI-Modell hinterlegte Einnahmen- und Ausgabenkategorie einen Umsatzsteuerprozentsatz hinterlegen können, damit geplante Umsatzsteuerbeträge korrekt berechnet werden.
- Als Controlling-Mitarbeiter möchte ich selbst entscheiden, ob ich die UST-Sätze auf der ersten oder zweiten Kategorieebene pflege, damit ich die Granularität an mein KPI-Modell anpassen kann.
- Als Controlling-Mitarbeiter möchte ich das Zahlungsziel der Einfuhrumsatzsteuer in Tagen pflegen können, damit Importzölle korrekt in den Liquiditätsplan einfließen.

## Acceptance Criteria

### Allgemein
- [ ] Die Seite ist unter `/dashboard/kurzfristige-planung/steuereinstellungen` erreichbar
- [ ] Im Navigationsmenü (Kurzfristige Planung → Einstellungen) erscheint „Steuereinstellungen" als letzter Eintrag
- [ ] Auf der Dashboard-Übersichtsseite (`/dashboard/kurzfristige-planung`) erscheint die Karte „Steuereinstellungen" als letzter Eintrag im Einstellungen-Grid
- [ ] Die Seite gliedert sich in drei klar abgegrenzte Sektionen mit eigenem Titel und Speichern-Button

### Sektion 1: Umsatzsteuer-Grundeinstellungen
- [ ] Feld „Zahlungsfrequenz" als Dropdown mit den Optionen „monatlich" und „quartalsweise"
- [ ] Feld „Zahlungsverschiebung" als numerisches Eingabefeld in Tagen (ganzzahlig, ≥ 0)
- [ ] Einstellungen werden persistent gespeichert (Supabase-Tabelle)
- [ ] Beim Laden der Seite werden die gespeicherten Werte vorausgefüllt
- [ ] Speichern zeigt eine Erfolgsmeldung (Toast); Fehler werden als Fehlermeldung angezeigt

### Sektion 2: Umsatzsteuersätze
- [ ] Die Sektion zeigt einen globalen Toggle: „Ebene 1 pflegen" vs. „Ebene 2 pflegen"
- [ ] Bei **Ebene 1**: Jede Level-1-Kategorie der Einnahmenarten (`type = 'umsatz'`) und Ausgabenarten (`type = 'ausgaben_kosten'`) erscheint als eigene Zeile mit einem UST-%-Eingabefeld
- [ ] Bei **Ebene 2**: Jede Level-2-Kategorie (Gruppe) aller Einnahmen- und Ausgabenkategorien erscheint als Zeile; Level-1-Kategorien ohne Level-2-Kinder erscheinen trotzdem als eigene Zeile
- [ ] UST-Satz ist ein numerisches Dezimalfeld (z. B. 19,00) in Prozent; erlaubt 0–100
- [ ] Eine tiefere Pflege als Ebene 2 ist nicht möglich
- [ ] Einnahmenarten und Ausgabenarten sind optisch getrennt (z. B. durch Gruppenüberschriften oder Trennlinie)
- [ ] Kategorien werden in der im KPI-Modell definierten `sort_order` angezeigt
- [ ] Beim Wechsel zwischen Ebene 1 und Ebene 2 bleiben bereits gespeicherte Werte erhalten (nur die Ansicht ändert sich; beim Speichern werden nur die aktuell sichtbaren Ebenen-Werte überschrieben)
- [ ] Speichern persistiert alle sichtbaren Zeilen in einem Batch-Request
- [ ] Speichern zeigt eine Erfolgsmeldung (Toast); Fehler werden als Fehlermeldung angezeigt

### Sektion 3: Einfuhrumsatzsteuer
- [ ] Feld „Zahlungsziel" als numerisches Eingabefeld in Tagen (ganzzahlig, ≥ 0)
- [ ] Einstellung wird persistent gespeichert (Supabase-Tabelle)
- [ ] Beim Laden der Seite wird der gespeicherte Wert vorausgefüllt
- [ ] Speichern zeigt eine Erfolgsmeldung (Toast); Fehler werden als Fehlermeldung angezeigt

## Edge Cases

- **Leere KPI-Kategorien**: Wenn keine Einnahmen- oder Ausgabenkategorien im KPI-Modell hinterlegt sind, zeigt die UST-Sätze-Sektion eine Leerstate-Nachricht (z. B. „Keine Kategorien im KPI-Modell gefunden").
- **Ebene-2-Wechsel ohne Kinder**: Wenn eine Level-1-Kategorie keine Level-2-Kinder hat und Ebene 2 ausgewählt ist, wird die Level-1-Kategorie direkt als Zeile angezeigt (kein Verlust der Einstellmöglichkeit).
- **Ungültige Eingaben**: UST-Satz < 0 oder > 100 wird validiert und verhindert das Speichern; Zahlungsverschiebung/Zahlungsziel < 0 wird validiert.
- **Keine gespeicherten Einstellungen (Erstaufruf)**: Zahlungsfrequenz ist vorbelegt mit „monatlich", alle numerischen Felder mit 0, alle UST-Sätze mit leerem Feld (kein Default-Wert angenommen).
- **Gleichzeitige Bearbeitung**: Kein Optimistic-Locking erforderlich (interne App, 1–5 Nutzer).
- **Ebene-Toggle-Persistenz**: Der zuletzt gewählte Ebene-Toggle (1 oder 2) wird ebenfalls gespeichert, damit beim nächsten Seitenaufruf die richtige Ansicht gezeigt wird.

## Technical Requirements
- Authentication required (alle API-Routen hinter `requireAuth`)
- RLS auf allen neuen Tabellen
- Zod-Validierung aller Eingaben serverseitig
- Keine Pagination erforderlich (Anzahl der Kategorien im KPI-Modell ist überschaubar)

## Open Questions (für Architecture)
- Werden die UST-Einstellungen in einer eigenen Tabelle `steuer_einstellungen` (Global-Settings-Pattern) gespeichert, oder werden sie als Spalten auf `kpi_categories` ergänzt?
- Wird der Ebene-Toggle (1 vs. 2) serverseitig oder nur client-seitig gespeichert?

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Neue Datenbanktabellen

**`ust_einstellungen`** — globale Singleton-Settings pro User
- `id` UUID PK
- `user_id` UUID FK (RLS)
- `zahlungsfrequenz` text enum (`monatlich` | `quartalsweise`)
- `zahlungsverschiebung_tage` integer ≥ 0
- `einfuhrust_zahlungsziel_tage` integer ≥ 0
- `ust_satz_pflegeebene` integer (1 oder 2)

**`ust_kategorie_saetze`** — UST-% je Kategorie und Ebene
- `id` UUID PK
- `user_id` UUID FK (RLS)
- `kategorie_id` UUID FK → `kpi_categories`
- `ebene` integer (1 oder 2)
- `ust_satz` decimal 0–100

Beide Tabellen mit RLS.

### Neue API-Routen
- `src/app/api/ust-einstellungen/route.ts` — GET + PUT (partial upsert)
- `src/app/api/ust-kategorie-saetze/route.ts` — GET + POST (Batch-Upsert)

### Neue Hooks
- `src/hooks/use-ust-einstellungen.ts`
- `src/hooks/use-ust-kategorie-saetze.ts`

### Neue Komponenten & Pages
- `src/components/steuereinstellungen-formular.tsx`
- `src/app/dashboard/kurzfristige-planung/steuereinstellungen/page.tsx`

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — Menüeintrag „Steuereinstellungen" (letzter Eintrag Einstellungen-Gruppe)
- `src/app/dashboard/kurzfristige-planung/page.tsx` — Dashboard-Karte (letzter Eintrag Einstellungen-Grid)

## QA Test Results

**Datum:** 2026-06-13
**Tester:** QA Engineer (automated + code review)
**Tests:** 30/30 Unit-Tests ✅ | 2/2 E2E-Tests ✅

### Implementierungsabweichungen vom ursprünglichen Spec

| Spec | Implementiert | Begründung |
|------|---------------|------------|
| Globaler Ebene-Toggle (1 vs 2) | Per-Kategorie „Gesamt"/„Aufgeteilt"-Toggle | User-Feedback: granulare Kontrolle pro Oberkategorie |
| Einnahmenarten (`umsatz`-Typ) | `einnahmen`-Typ | User-Feedback: korrekter KPI-Kategorie-Typ |
| „Steuern"-Kategorie sichtbar | Ausgefiltert | User-Feedback: Steuern-Kategorie nicht relevant |
| Speichern-Button + Erfolgs-Toast | Auto-Save (onBlur/onValueChange) + nur Fehler-Toast | User-Feedback: kein manuelles Speichern |

### Akzeptanzkriterien

#### Allgemein
| # | Kriterium | Status |
|---|-----------|--------|
| AC-1 | Seite unter `/dashboard/kurzfristige-planung/steuereinstellungen` erreichbar | ✅ PASS |
| AC-2 | Navigationsmenü: „Steuereinstellungen" als letzter Einstellungen-Eintrag | ✅ PASS |
| AC-3 | Dashboard-Karte als letzter Eintrag im Einstellungen-Grid | ✅ PASS |
| AC-4 | 3 Sektionen als Tabs mit eigenem Titel | ✅ PASS |

#### Sektion 1: Umsatzsteuer-Grundeinstellungen
| # | Kriterium | Status |
|---|-----------|--------|
| AC-5 | Dropdown Zahlungsfrequenz (monatlich / quartalsweise) | ✅ PASS |
| AC-6 | Zahlungsverschiebung als Ganzzahl ≥ 0 | ✅ PASS |
| AC-7 | Persistenz über Supabase (ust_einstellungen) | ✅ PASS |
| AC-8 | Gespeicherte Werte werden vorausgefüllt | ✅ PASS |
| AC-9 | Auto-Save bei Änderung; Fehler-Toast bei API-Fehler | ✅ PASS |

#### Sektion 2: Umsatzsteuersätze
| # | Kriterium | Status |
|---|-----------|--------|
| AC-10 | Per-Kategorie Toggle „Gesamt"/„Aufgeteilt" für Oberkategorien mit Unterkategorien | ✅ PASS |
| AC-11 | Einnahmenarten (`einnahmen`-Typ) angezeigt | ✅ PASS |
| AC-12 | Ausgabenarten (`ausgaben_kosten`-Typ) angezeigt; „Steuern" ausgeblendet | ✅ PASS |
| AC-13 | „Aufgeteilt": Unterkategorien aufklappbar; Oberkategorie nicht editierbar | ✅ PASS |
| AC-14 | „Gesamt": Oberkategorie editierbar; Unterkategorien nicht sichtbar | ✅ PASS |
| AC-15 | UST-Satz: 0–100, Validierung clientseitig + serverseitig | ✅ PASS |
| AC-16 | Einnahmenarten und Ausgabenarten optisch getrennt (Gruppenüberschriften) | ✅ PASS |
| AC-17 | Kategorien in sort_order sortiert | ✅ PASS |
| AC-18 | Gesamt/Aufgeteilt-Wahl in localStorage gespeichert | ✅ PASS |
| AC-19 | Auto-Save per Zeile bei onBlur; Ebene-Toggle sofort gespeichert | ✅ PASS |

#### Sektion 3: Einfuhrumsatzsteuer
| # | Kriterium | Status |
|---|-----------|--------|
| AC-20 | Zahlungsziel als Ganzzahl ≥ 0 | ✅ PASS |
| AC-21 | Persistenz über Supabase (ust_einstellungen) | ✅ PASS |
| AC-22 | Gespeicherter Wert wird vorausgefüllt | ✅ PASS |

#### Edge Cases
| # | Kriterium | Status |
|---|-----------|--------|
| EC-1 | Keine KPI-Kategorien: Leerstate mit Link „Zum KPI-Modell" | ✅ PASS |
| EC-2 | Oberkategorie ohne Unterkategorien: kein Toggle, direkt editierbar | ✅ PASS |
| EC-3 | UST-Satz < 0 oder > 100: Fehler-Toast, Revert auf letzten gespeicherten Wert | ✅ PASS |
| EC-4 | Erstaufruf (keine gespeicherten Werte): Defaults (monatlich, 0, 0) | ✅ PASS |
| EC-5 | Toggle-Persistenz: Nach Seitenneuladen gleiche Gesamt/Aufgeteilt-Ansicht | ✅ PASS |

### Security Audit
| Prüfpunkt | Ergebnis |
|-----------|----------|
| Auth-Guard auf API-Routen (`requireAuth`) | ✅ Implementiert |
| RLS auf `ust_einstellungen` + `ust_kategorie_saetze` | ✅ Implementiert |
| Zod-Validierung serverseitig (alle Felder) | ✅ Implementiert |
| Unauthenticated-Redirect → /login (E2E) | ✅ Bestätigt |
| SQL-Injection: Supabase parametrized queries | ✅ Sicher |
| XSS: kein `dangerouslySetInnerHTML` | ✅ Sicher |

### Bugs

Keine Bugs gefunden.

### Testergebnisse

| Suite | Ergebnis |
|-------|----------|
| Unit-Tests (Vitest): `ust-einstellungen` | 15/15 ✅ |
| Unit-Tests (Vitest): `ust-kategorie-saetze` | 15/15 ✅ |
| E2E-Tests (Playwright): `PROJ-65-steuereinstellungen.spec.ts` | 2/2 ✅ |

**Gesamtbewertung: PRODUCTION READY ✅**
Keine Critical/High-Bugs. 22/22 Akzeptanzkriterien bestanden.

## Deployment
_To be added by /deploy_
