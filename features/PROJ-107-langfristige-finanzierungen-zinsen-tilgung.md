# PROJ-107: Finanzierungen in der Finanzierungsausgaben Planung (Zinsen & Tilgung) — Langfristige Planung

## Status: In Review
**Created:** 2026-10-09
**Last Updated:** 2026-10-09

## Dependencies
- Erweitert: PROJ-90 (Finanzierungsausgaben Planung — Langfristige Planung)
- Nutzt: PROJ-101 (Kapitalbedarf & Finanzierung) — Fremdkapital-Positionen als Vorlage (Dropdown)
- Wirkt auf: PROJ-94 (Liquidität), PROJ-95 (Rentabilität), PROJ-100 (Finanzierungsausgaben-Auswertung), Steuerausgaben (berechnet)
- Kompatibel mit: PROJ-104 (Planversion duplizieren — generische Kopie aller Tabellen mit `plan_version_id`)

## Übersicht
Auf der Seite **Finanzierungsausgaben Planung** gibt es rechts oben den Button **„Finanzierung hinzufügen"**. Im Dialog wählt der Nutzer entweder eine **Fremdkapital-Position aus „Kapitalbedarf & Finanzierung"** (Werte werden vorbelegt und bleiben anpassbar) oder legt die Finanzierung **manuell** an. Eine Finanzierung besteht aus:

- Name
- Finanzierungssumme
- Zinssatz (% p. a.)
- Laufzeit (Monate)
- tilgungsfreier Zeitraum (Monate)
- Startmonat (Vorbelegung: Startmonat der Planversion)

Aus jeder Finanzierung wird monatlich berechnet:
- **Tilgung:** Finanzierungssumme gleichmäßig auf die Monate nach dem tilgungsfreien Zeitraum verteilt (Ratendarlehen; letzte Rate gleicht Rundung aus).
- **Zinsen:** offenes Finanzierungsvolumen zum Monatsanfang × Zinssatz p. a. / 12.

## Darstellung
- Ohne Finanzierungen bleiben „Zinsen" und „Tilgung" wie bisher direkt editierbare Zeilen (bestehende Werte unverändert).
- Sobald eine Finanzierung existiert, werden „Zinsen" und „Tilgung" zu **einklappbaren Summenzeilen** mit Unterzeilen:
  - **„Manuelle Eingabe"** — die bisherigen bzw. weiterhin manuell gepflegten Werte (editierbar, Bulk-Edit, Notizen wie bisher)
  - **je Finanzierung eine Zeile** (berechnet, nicht editierbar; Hover zeigt die Parameter, Stift = bearbeiten, Papierkorb = löschen)
- Summenzeile = Manuelle Eingabe + Σ Finanzierungen; „Finanzierungsausgaben (Gesamt)" summiert alles.

## Acceptance Criteria
- [x] Button „Finanzierung hinzufügen" rechts oben (deaktiviert mit Hinweis, wenn „Zinsen"/„Tilgung" im KPI-Modell fehlen)
- [x] Dropdown mit allen Fremdkapital-Positionen aus „Kapitalbedarf & Finanzierung" + Option „Manuell anlegen"; Auswahl belegt Name, Summe, Zinssatz, Laufzeit/Tilgungsfrei (Jahre × 12) vor
- [x] Validierung: Name Pflicht, Summe > 0, Zinssatz 0–100 %, Laufzeit 1–1200 Monate, tilgungsfrei < Laufzeit
- [x] Vorschau im Dialog: monatliche Tilgungsrate, Zinsen im 1. Monat, Zinsen gesamt
- [x] Je Finanzierung eine Zeile unter „Zinsen" und eine unter „Tilgung"; Summen reaktiv
- [x] Bestehende manuelle Werte bleiben erhalten und weiterhin editierbar
- [x] Finanzierungen bearbeiten und löschen (mit Bestätigung)
- [x] Alle Auswertungen sehen dieselben effektiven Werte (manuell + Finanzierungen)
- [x] Versionsgebunden; Planversion duplizieren kopiert die Finanzierungen mit

## Edge Cases
- Startmonat vor/nach dem Planungshorizont: nur die Monate innerhalb des Horizonts erscheinen in der Tabelle; der Plan läuft trotzdem korrekt (Zinsen auf Restschuld).
- Fremdkapital-Position in „Kapitalbedarf & Finanzierung" wird später geändert/gelöscht: die Finanzierung ist eine **Kopie** (Snapshot) und bleibt unverändert; beim Bearbeiten erscheint die Quelle dann als „Manuell anlegen".
- Die Auszahlung (Zufluss) des Darlehens wird hier **nicht** gebucht — nur Zinsen und Tilgung als Ausgaben.

## Tech Design
- **DB:** neue Tabelle `langfristige_finanzierungsausgaben_darlehen` (Migrationen `proj102_finanzierungsausgaben_darlehen`, `proj107_darlehen_drop_kbf_fk`): `name`, `betrag`, `zinssatz`, `laufzeit_monate`, `tilgungsfrei_monate` (CHECK < Laufzeit), `start_jahr/monat`, `zinsen_kategorie_id`/`tilgung_kategorie_id` (globale KPI-Kategorien, ohne FK), `quelle_kbf_id` (ohne FK, damit die generische Versions-Duplizierung reihenfolgeunabhängig funktioniert), `sort_order`. RLS mit 4 Owner-Policies.
- **Rechenkern:** `src/lib/finanzierung-tilgungsplan.ts` (`berechneTilgungsplan`) — von Client und Server gemeinsam genutzt.
- **Effektive Werte:** `src/lib/langfristige-finanzierungsausgaben-effektiv.ts` (`ladeFinanzierungsausgabenEffektiv`, `kombiniereFinanzierungsausgaben`).
  - `GET …/finanzierungsausgaben-planung` liefert jetzt standardmäßig **effektive** Werte (Liquidität + Finanzierungsausgaben-Auswertung ziehen automatisch nach); `?nur_manuell=1` liefert nur die manuellen Zellen (Planungsseite).
  - Rentabilitäts- und Steuerausgaben-Route lesen über `ladeFinanzierungsausgabenEffektiv`.
- **API:** `…/finanzierungsausgaben-darlehen` (GET/POST), `…/finanzierungsausgaben-darlehen/[id]` (PUT/DELETE) — `requireAuth` + `ensureLangfristigeVersion`, Zod.
- **UI:** `src/components/finanzierung-hinzufuegen-dialog.tsx` (neu), `finanzierungsausgaben-planung-tabelle.tsx` + `use-finanzierungsausgaben-planung.ts` erweitert.

## Tests
- `src/lib/finanzierung-tilgungsplan.test.ts` (3), `…/finanzierungsausgaben-darlehen/route.test.ts` (7), `…/finanzierungsausgaben-planung/route.test.ts` (+2: effektive Werte, `nur_manuell`; Mock um `order`/`range` ergänzt).
- Hinweis: Die Test-Mocks von Rentabilitäts- und Steuerausgaben-Route schlugen bereits vorher fehl (`.order is not a function` seit Umstellung auf `fetchAllRows`) — unverändert.
- Browser-Test durch den Nutzer ausstehend.

## Deployment
_To be added by /deploy_
