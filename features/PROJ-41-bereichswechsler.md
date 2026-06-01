# PROJ-41: Bereichswechsler — Plattform-Navigation

## Status: Approved
**Created:** 2026-06-01
**Last Updated:** 2026-06-01

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — Bereichswechsler ist nur im eingeloggten Bereich sichtbar

## Overview
Die Plattform besteht aus drei übergeordneten Bereichen: **Reporting** (bereits vorhanden), **Kurzfristige Planung** (neu, vorerst leer) und **Langfristige Planung** (neu, vorerst leer). Der Bereichswechsler ermöglicht das Navigieren zwischen diesen Bereichen — sowohl über das linke Navigationsmenü als auch über die Dashboard-Seite.

## User Stories
- Als Nutzer möchte ich über ein Dropdown im Navigationsmenü zwischen den drei Plattform-Bereichen wechseln können, damit ich schnell in den gewünschten Bereich gelange.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite den aktuellen Bereich erkennen und wechseln können, damit mir die richtige Inhaltsübersicht angezeigt wird.
- Als Nutzer möchte ich beim Navigieren innerhalb eines Bereichs (z.B. eine Unterseite im Reporting) im Dropdown immer den aktiven Bereich hervorgehoben sehen, damit ich die Orientierung behalte.
- Als Nutzer möchte ich, dass beim Bereichswechsel die Navigationseinträge im Menü zum neuen Bereich passen, damit ich nicht irrelevante Links sehe.
- Als Nutzer möchte ich die neuen Bereiche ("Kurzfristige Planung", "Langfristige Planung") öffnen können, auch wenn sie noch keine Inhalte haben, damit ich die Struktur der Plattform verstehe.

## Acceptance Criteria

### Bereichswechsler-Komponente
- [ ] Eine `BereichsSwitcher`-Komponente existiert, die ein Dropdown (shadcn `Select` oder ähnlich) rendert
- [ ] Das Dropdown zeigt drei Einträge: "Reporting", "Kurzfristige Planung", "Langfristige Planung"
- [ ] Der aktuell aktive Bereich wird automatisch anhand des URL-Pfads erkannt und vorausgewählt angezeigt
- [ ] Beim Auswählen eines Bereichs navigiert die App zur Root-URL des Bereichs (kein Neuladen der Seite nötig, Next.js Router)

### URL-Struktur
- [ ] Bereich "Reporting": alle Seiten unter `/dashboard/*` (bestehend, kein Umbau nötig)
- [ ] Bereich "Kurzfristige Planung": neue Seite `/dashboard/kurzfristige-planung`
- [ ] Bereich "Langfristige Planung": neue Seite `/dashboard/langfristige-planung`
- [ ] Die neuen Seiten zeigen eine leere Placeholder-Ansicht (keine Fehlermeldung, keine 404)

### Platzierung im Navigationsmenü (NavSheet)
- [ ] Der Bereichswechsler erscheint ganz oben im Slide-in-Menü (NavSheet), oberhalb aller Navigationsgruppen
- [ ] Unterhalb des Bereichswechslers werden nur die Navigationsgruppen des aktiven Bereichs angezeigt
- [ ] Für "Reporting": bestehende Gruppen "Datenpflege", "Auswertungen", "Reporting" (unverändert)
- [ ] Für "Kurzfristige Planung" und "Langfristige Planung": keine Navigationseinträge (leere Nav)

### Platzierung auf der Dashboard-Seite
- [ ] Auf `/dashboard` ist der Bereichswechsler prominent sichtbar (z.B. im Header-Bereich oder als oberster Block im Content)
- [ ] Unterhalb zeigt das Dashboard die Inhalte des aktiven Bereichs:
  - Reporting: bestehende Kacheln (Datenpflege, Auswertungen, Reporting)
  - Kurzfristige Planung: Placeholder-Nachricht ("Dieser Bereich wird in Kürze verfügbar sein.")
  - Langfristige Planung: Placeholder-Nachricht ("Dieser Bereich wird in Kürze verfügbar sein.")
- [ ] Der Bereichswechsler auf dem Dashboard erkennt den aktiven Bereich über die URL (Pathname-Präfix)

### Aktiver Bereich — URL-Erkennung
- [ ] Alle Pfade beginnend mit `/dashboard/kurzfristige-planung` → Bereich "Kurzfristige Planung" aktiv
- [ ] Alle Pfade beginnend mit `/dashboard/langfristige-planung` → Bereich "Langfristige Planung" aktiv
- [ ] Alle anderen `/dashboard/*`-Pfade → Bereich "Reporting" aktiv

## Edge Cases
- Nutzer navigiert direkt auf eine Reporting-Unterseite (z.B. `/dashboard/reporting/rentabilitaet`): Bereichswechsler zeigt "Reporting" korrekt als aktiv an.
- Nutzer öffnet die Nav und wechselt den Bereich: Das Sheet schließt sich nach der Navigation automatisch (bestehende Logik bleibt erhalten).
- Browser-Zurück-Button nach Bereichswechsel: Navigiert korrekt zurück zum vorherigen Bereich (URL-basiertes Routing).
- Nutzer bookmarkt `/dashboard/kurzfristige-planung`: Seite lädt korrekt mit Placeholder-Inhalt, kein Absturz.
- Der Bereichswechsler auf dem Dashboard und im NavSheet sind zwei separate Instanzen derselben Komponente und zeigen denselben aktiven Zustand.

## Technical Requirements
- Rein Frontend — kein Backend, kein Datenbankzugriff
- Aktiver Bereich über `usePathname()` (Next.js) ermitteln — kein globaler State nötig
- Neue Seiten (`/dashboard/kurzfristige-planung`, `/dashboard/langfristige-planung`) als einfache Server Components
- Responsive: Bereichswechsler funktioniert auf Mobilgeräten (375px) und Desktop (1440px)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

**Datum:** 2026-06-01
**Tester:** QA Engineer (automatisiert + manuell)
**Ergebnis: APPROVED — produktionsbereit**

### Automatisierte Tests

**Unit-Tests (`src/components/bereichs-switcher.test.ts`):** 9/9 ✅
- `getAktivesBereich('/dashboard')` → `'reporting'` ✅
- `getAktivesBereich('/dashboard/kpi-modell')` → `'reporting'` ✅
- `getAktivesBereich('/dashboard/reporting/rentabilitaet')` → `'reporting'` ✅
- `getAktivesBereich('/dashboard/ausgaben')` → `'reporting'` ✅
- `getAktivesBereich('/dashboard/kurzfristige-planung')` → `'kurzfristige-planung'` ✅
- `getAktivesBereich('/dashboard/kurzfristige-planung/sub')` → `'kurzfristige-planung'` ✅
- `getAktivesBereich('/dashboard/langfristige-planung')` → `'langfristige-planung'` ✅
- `getAktivesBereich('/dashboard/langfristige-planung/sub')` → `'langfristige-planung'` ✅
- Kein False Match bei ähnlichen Pfaden ✅

**E2E-Tests (`tests/PROJ-41-bereichswechsler.spec.ts`):** 14/14 ✅ (Chromium + Mobile Safari)
- Neue Seiten liefern kein 404 ✅
- Auth-Guard: `/dashboard/kurzfristige-planung` → `/login` ✅
- Auth-Guard: `/dashboard/langfristige-planung` → `/login` ✅
- Regression: `/dashboard` → `/login` ✅
- Regression: `/dashboard/kpi-modell` → `/login` ✅
- Regression: `/dashboard/reporting/rentabilitaet` → `/login` ✅

### Manuell geprüft (erfordern Auth)

| Akzeptanzkriterium | Ergebnis |
|---|---|
| BereichsKartenSwitcher: 3 prominente Karten sichtbar | ✅ Pass |
| Aktiver Bereich (Reporting) hervorgehoben (primäre Farbe, vergrößert) | ✅ Pass |
| NavSheet: Bereichswechsler-Dropdown ganz oben | ✅ Pass |
| NavSheet: 3 Optionen im Dropdown (Reporting, Kurzfr., Langfr.) | ✅ Pass |
| Klick auf "Kurzfristige Planung"-Karte → `/dashboard/kurzfristige-planung` | ✅ Pass |
| Placeholder-Text auf Kurzfristige-Planung-Seite sichtbar | ✅ Pass |
| Klick auf "Langfristige Planung"-Karte → `/dashboard/langfristige-planung` | ✅ Pass |
| Placeholder-Text auf Langfristige-Planung-Seite sichtbar | ✅ Pass |
| Nav-Einträge verschwinden bei Nicht-Reporting-Bereichen | ✅ Pass |
| Browser-Zurück navigiert zurück zum vorherigen Bereich | ✅ Pass |
| Responsive: Mobile (375px) funktioniert korrekt | ✅ Pass |

### Security Audit
- Kein Backend, kein Datenbankzugriff → kein Angriffspotenzial durch dieses Feature
- Auth-Guard für neue Seiten korrekt in Kraft (Redirect zu `/login`) ✅
- Kein XSS-Risiko (keine User-Inputs, keine dangerouslySetInnerHTML) ✅

### Gefundene Bugs
Keine kritischen oder hohen Bugs gefunden.

## Deployment
_To be added by /deploy_
