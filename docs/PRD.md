# Product Requirements Document

## Vision
Eine interne Controlling-Plattform für das Finanzreporting eines E-Commerce Unternehmens. Sie ermöglicht die manuelle, kategorisierte Erfassung von Umsätzen, Einnahmen, Ausgaben und Kosten auf Basis eines flexiblen, selbst definierbaren KPI-Modells — und stellt diese Daten in strukturierten Auswertungen (Rentabilität & Liquidität) dar.

## Target Users
**Interne Controlling-/Finanzteam** (1–5 Personen):
- Haben keinen technischen Hintergrund, benötigen eine übersichtliche, einfache Oberfläche
- Pflegen Finanzdaten manuell (kein automatischer Bankimport)
- Müssen Kategoriestrukturen selbst definieren und anpassen können
- Benötigen schnellen Zugriff auf aktuelle Finanzübersichten

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | PROJ-1: Authentifizierung & Nutzerzugang | Planned |
| P0 (MVP) | PROJ-2: KPI-Modell Verwaltung | Planned |
| P0 (MVP) | PROJ-3: Umsatz-Transaktionen Eingabe | Planned |
| P0 (MVP) | PROJ-4: Einnahmen-Transaktionen Eingabe | Planned |
| P0 (MVP) | PROJ-5: Ausgaben & Kosten-Transaktionen Eingabe | Planned |
| P1 | PROJ-6: Rentabilitäts-Auswertung | Planned |
| P1 | PROJ-7: Liquiditäts-Auswertung | Planned |
| P2 | PROJ-8: Ausgaben/Kosten Trennungslogik | Planned |
| P1 | PROJ-10: Kategorie-Anzeigebezeichnungen (Ausgaben & Kosten) | Planned |
| P1 | PROJ-11: Umsatz-Kategorien als Abzugsposten markieren | Planned |
| P1 | PROJ-12: Abschreibungen-Auswertung | Planned |
| P1 | PROJ-13: Alternative Kategorienamen in Kategorie-Filtern | Planned |
| P1 | PROJ-14: Relevanz-Pflichtfeld für Ausgaben & Kosten-Transaktionen | Planned |
| P1 | PROJ-15: Investitionen-Abschreibungen-Auswertung | Planned |
| P1 | PROJ-16: Produktkosten-Verwaltung | Planned |

## Success Metrics
- Alle Finanzdaten werden in einer zentralen Plattform erfasst (kein Excel-Chaos)
- Neue Transaktion in unter 30 Sekunden erfasst
- KPI-Modell kann ohne Entwickler-Hilfe angepasst werden
- Rentabilitäts- und Liquiditätsübersicht auf Knopfdruck abrufbar

## Constraints
- Interner Zugriff only — keine öffentliche Registrierung
- Manuelle Dateneingabe (kein Bankimport, keine API-Anbindung an Buchhaltungssoftware)
- Kleines Team (1–5 Nutzer), alle mit gleichem Zugriffsrecht
- Spalten der Eingabetabellen werden iterativ verfeinert (TBD in späteren Sprints)

## Non-Goals
- Automatische Bankintegration oder Buchungsimport
- Mobile App (nur Web)
- Öffentlicher Zugang / externe Nutzer
- Buchhaltungs-Compliance / DATEV-Export (vorerst)
- Unterschiedliche Benutzerrollen / Berechtigungsstufen (vorerst alle gleich)
- Ausgaben/Kosten-Trennung (Phase 2: PROJ-8)

---

Use `/requirements` to create detailed feature specifications for each item in the roadmap above.
