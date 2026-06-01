# PROJ-41: Bereichswechsler — Plattform-Navigation

## Status: In Progress
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
_To be added by /qa_

## Deployment
_To be added by /deploy_
