# PROJ-73: Langfristige Planung — Planversionen & Navigation (Foundation)

## Status: In Progress
**Created:** 2026-06-20
**Last Updated:** 2026-06-20

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-41 (Bereichswechsler) — der Bereich „Langfristige Planung" und dessen Root-Route `/dashboard/langfristige-planung` existieren bereits; dieses Feature füllt sie mit Inhalt
- Bezug (kein harter Require): PROJ-42 bis PROJ-65 (Einstellungsseiten der Kurzfristigen Planung) — deren Seiten werden als Vorlage gespiegelt

## Overview
„Langfristige Planung" ist der dritte große Plattform-Bereich (neben Reporting und Kurzfristiger Planung). Er dient der **groben, mehrjährigen Unternehmensplanung** und funktioniert **vollständig abgekapselt** von den anderen Bereichen — es gibt **keinen Rückbezug auf Ist-Daten** und keine Datenübernahme aus der Kurzfristigen Planung.

Das zentrale neue Konzept ist die **Planversion**: Im Gegensatz zur Kurzfristigen Planung (immer genau eine Planung, die überschrieben wird) kann der Nutzer hier **beliebig viele, voneinander unabhängige Planversionen** anlegen. Jede Planversion ist ein **isolierter Daten-Container** — beim Anlegen komplett leer, mit eigenen Daten für jede Seite. Versionen teilen keine Daten.

Dieses Foundation-Feature liefert:
1. Die **Planversionen-Verwaltung** (anlegen, auflisten, umbenennen, löschen) auf der Dashboard-Seite des Bereichs.
2. Das **versionsbasierte Routing** (Versions-ID im Pfad) und die **versionsspezifische Datenisolation** als durchgängiges Muster.
3. Das **kontextabhängige Seitenmenü** (links): leer ohne ausgewählte Version; zeigt die Seiten + den Namen der aktiven Version, sobald eine Version geöffnet ist.
4. Das **Spiegeln aller Einstellungsseiten** der Kurzfristigen Planung in die Langfristige Planung (gleiche Seiten/UI, aber je Planversion eigene, anfangs leere Daten).

## User Stories
- Als Controller möchte ich im Bereich „Langfristige Planung" mehrere benannte Planversionen anlegen können, damit ich verschiedene Szenarien für die nächsten Jahre unabhängig voneinander durchplanen kann.
- Als Controller möchte ich beim Anlegen einer Planversion nur einen Namen vergeben (Daten folgen später), damit der Einstieg schnell und unkompliziert ist.
- Als Controller möchte ich auf dem Langfristige-Planung-Dashboard alle vorhandenen Planversionen mit Namen sehen, damit ich den Überblick behalte.
- Als Controller möchte ich den Namen einer Planversion bearbeiten und eine Planversion löschen können, damit ich meine Szenarien aktuell und aufgeräumt halten kann.
- Als Controller möchte ich eine Planversion per Klick öffnen, damit mir deren Seiten (Einstellungen etc.) zur Bearbeitung angezeigt werden.
- Als Controller möchte ich, dass jede Planversion komplett eigene, anfangs leere Daten hat, damit sich Szenarien nicht gegenseitig beeinflussen.
- Als Controller möchte ich, dass das linke Seitenmenü leer bleibt, solange ich keine Version geöffnet habe, damit ich nicht versehentlich ohne Versionskontext arbeite.
- Als Controller möchte ich im linken Menü jederzeit den Namen der aktuell geöffneten Planversion sehen und per Klick zum Dashboard zurückkehren, damit ich Orientierung behalte und die Version wechseln kann.

## Acceptance Criteria

### Datenmodell — Planversion
- [ ] Eine Planversion gehört genau einem Nutzer (`user_id`) und hat mindestens: `id`, `name`, `created_at`, `updated_at`
- [ ] Der Name ist ein Pflichtfeld (nicht leer, nach Trimmen ≥ 1 Zeichen)
- [ ] Der Name ist **eindeutig pro Nutzer** (case-insensitive Vergleich, getrimmt) — doppelte Namen werden beim Anlegen und Umbenennen abgelehnt
- [ ] Eine sinnvolle Maximallänge für den Namen ist definiert (Vorschlag: 100 Zeichen)

### Dashboard — Planversionen-Verwaltung (`/dashboard/langfristige-planung`)
- [ ] Beim Wechsel in den Bereich „Langfristige Planung" landet der Nutzer auf diesem Dashboard
- [ ] Das Dashboard listet alle Planversionen des Nutzers mit ihrem Namen auf
- [ ] Es gibt eine Aktion „Neue Planversion" (Button), die einen Dialog/Eingabe öffnet, der **nur den Namen** abfragt
- [ ] Nach erfolgreichem Anlegen erscheint die neue Version sofort in der Liste; sie ist datentechnisch komplett leer
- [ ] Jede gelistete Version bietet die Aktionen: **Öffnen** (Klick auf die Version), **Umbenennen**, **Löschen**
- [ ] Umbenennen öffnet eine Eingabe mit dem aktuellen Namen vorausgefüllt; nach Speichern wird der neue Name in der Liste angezeigt
- [ ] Löschen erfordert eine Bestätigung (da alle Daten der Version unwiederbringlich entfernt werden)
- [ ] Empty State: Wenn der Nutzer noch keine Planversion hat, wird ein erklärender Hinweis + „Neue Planversion"-Aktion angezeigt (keine leere weiße Seite)

### Routing & Versionskontext
- [ ] Die aktive Planversion wird über die **Versions-ID im URL-Pfad** abgebildet, z.B. `/dashboard/langfristige-planung/[versionId]/...`
- [ ] Klick auf eine Version öffnet deren Einstiegsseite unter `/dashboard/langfristige-planung/[versionId]/...`
- [ ] Ruft der Nutzer eine Version-URL mit unbekannter/fremder/ungültiger `versionId` auf, wird er sauber behandelt (Hinweis bzw. Redirect zum Dashboard, kein Absturz, kein Fremdzugriff)
- [ ] Alle versionsspezifischen Seiten- und API-Zugriffe sind durch die `versionId` **und** den eingeloggten Nutzer abgesichert

### Linkes Seitenmenü (NavSheet) — kontextabhängig
- [ ] Solange **keine** Planversion ausgewählt ist (Nutzer auf dem Dashboard `/dashboard/langfristige-planung`), zeigt das Seitenmenü **keine** Seiten-Navigationseinträge
- [ ] Sobald eine Planversion geöffnet ist (`/dashboard/langfristige-planung/[versionId]/...`), zeigt das Seitenmenü die Seiten dieser Version an
- [ ] Im Seitenmenü steht unter dem Bereich „Langfristige Planung" der **Name der aktuell geöffneten Planversion**
- [ ] Klick auf den angezeigten Versionsnamen navigiert zurück zum Dashboard (`/dashboard/langfristige-planung`)
- [ ] Ein Versionswechsel ist ausschließlich über das Dashboard möglich (nicht direkt im Seitenmenü)
- [ ] Die Navigationseinträge der Version verlinken auf versionsspezifische Pfade (inkl. `versionId`)

### Übernahme der Einstellungsseiten (gespiegelt aus Kurzfristiger Planung)
- [ ] Alle Einstellungsseiten der Kurzfristigen Planung (Gruppe „Einstellungen": Grundeinstellungen, Auszahlungseinstellungen, Absatzeinstellungen, Produktinformationen, Vertriebseinstellungen, Verkaufsgebühr-Einstellungen, Marketing-Einstellungen, Operative Fixkosten-Einstellungen, Finanzierungseinstellungen, Steuereinstellungen) existieren als gleichwertige Seiten unter der Langfristigen Planung, versionsspezifisch geroutet
- [ ] Die UI/Bedienung dieser Seiten entspricht 1:1 den Kurzfristige-Planung-Vorlagen (keine neue Funktionalität, nur gespiegelt)
- [ ] Die Daten jeder dieser Seiten werden **pro Planversion** gespeichert und geladen (Isolation über `versionId` + `user_id`)
- [ ] Eine neu angelegte Planversion zeigt auf allen Einstellungsseiten **leere** Daten (keine Übernahme aus Kurzfristiger Planung oder anderen Versionen)
- [ ] Änderungen an Daten in Version A haben keinerlei Auswirkung auf Version B oder die Kurzfristige Planung

### Abkapselung
- [ ] Die Langfristige Planung greift auf **keine** Ist-Daten und auf **keine** Daten der Kurzfristigen Planung zu
- [ ] Es werden keine Daten zwischen Bereichen synchronisiert oder geteilt

## Edge Cases
- **Doppelter Name beim Anlegen/Umbenennen:** Eindeutige, verständliche Fehlermeldung; die Version wird nicht angelegt/umbenannt.
- **Leerer oder nur aus Leerzeichen bestehender Name:** Wird abgelehnt mit Hinweis.
- **Löschen einer Version mit vielen Daten:** Alle zugehörigen versionsspezifischen Daten werden mitgelöscht (kaskadierend); keine verwaisten Datensätze bleiben zurück.
- **Löschen der gerade geöffneten Version (z.B. in zweitem Tab):** Beim nächsten Zugriff sauberer Redirect zum Dashboard mit Hinweis, kein Absturz.
- **Direkter Aufruf einer Version-URL ohne vorherige Auswahl (Bookmark):** Version lädt korrekt, sofern sie dem Nutzer gehört; sonst Redirect zum Dashboard.
- **Aufruf einer `versionId`, die einem anderen Nutzer gehört:** Kein Zugriff (behandelt wie nicht vorhanden), Redirect zum Dashboard.
- **Keine Planversionen vorhanden:** Dashboard zeigt Empty State; Seitenmenü bleibt ohne Seiteneinträge.
- **Sehr langer Versionsname:** Wird auf Maximallänge begrenzt; Anzeige im Seitenmenü/Liste wird sauber abgeschnitten (Ellipsis), bricht das Layout nicht.
- **Mehrere Tabs mit unterschiedlichen Versionen:** Funktioniert unabhängig, da der Kontext aus der URL (Versions-ID) stammt.

## Technical Requirements
- **Backend nötig:** neue Tabelle für Planversionen sowie versionsspezifische Datentabellen/Spalten für die gespiegelten Einstellungsseiten (jeweils mit `plan_version_id`-Bezug und Foreign Key mit `ON DELETE CASCADE`)
- **RLS:** Row Level Security auf allen neuen Tabellen; Zugriff nur auf eigene Daten des Nutzers; Versionszugehörigkeit serverseitig prüfen
- **Validierung:** alle Eingaben (Name, IDs) serverseitig mit Zod validieren; Eindeutigkeit des Namens serverseitig durchsetzen (nicht nur Client)
- **Routing:** dynamisches Segment `[versionId]` unter `/dashboard/langfristige-planung/`
- **Aktiver Versionskontext** aus dem URL-Pfad (`usePathname`) ableiten — Versionsname für die Anzeige im Seitenmenü laden
- **shadcn/ui first:** Dialog (Anlegen/Umbenennen), AlertDialog (Löschbestätigung), Button, Input, Card o.ä. wiederverwenden — keine Eigenbauten
- **Wiederverwendung:** bestehende Einstellungsseiten-Komponenten der Kurzfristigen Planung als Vorlage; gemeinsame Logik möglichst teilen statt duplizieren, wo sinnvoll
- **Responsive:** Dashboard und Dialoge funktionieren auf Mobil (375px) und Desktop (1440px)

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Planungshorizont (Startjahr / Anzahl Jahre) als Versionseigenschaft — bewusst ausgelagert (beim Anlegen wird vorerst nur der Name abgefragt)
- Spätere langfristige Planungs- und Auswertungsseiten (über die Einstellungen hinaus) folgen in eigenen Specs
- Optional später: Planversion duplizieren/„als Kopie anlegen"

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee
Die Langfristige Planung wird als eigenständiger Bereich gebaut, der das bestehende globale **KPI-Kategoriemodell** (Umsatz-, Einnahmen-, Ausgaben/Kosten-Struktur) **mitliest**, aber alle eigentlichen Planungsdaten **strikt pro Planversion** in **neuen, separaten Tabellen** ablegt. Plattformen und Produkte sind **nicht** global, sondern werden **pro Planversion** in einer eigenen Verwaltungsseite gepflegt (Produkte ohne SKU-Ebene). So bedeutet „abgekapselt": die Kategorie-Struktur wird einmal global gepflegt und überall verwendet; sämtliche Werte, Plattformen und Produkte einer Planung sind voneinander und von der Kurzfristigen Planung vollständig getrennt.

### Was wird global wiederverwendet vs. pro Version gepflegt
```
Global (einmal, aus bestehendem KPI-Modell — NUR gelesen):
  - Umsatz-Kategorien / -Gruppen / -Untergruppen
  - Einnahmen-Kategorien / -Gruppen / -Untergruppen
  - Ausgaben/Kosten-Kategorien / -Gruppen / -Untergruppen

Pro Planversion (vom Nutzer in der Langfristigen Planung gepflegt):
  - Sales-Plattformen (flache Liste)
  - Produkte (OHNE SKUs)
  - alle Einstellungswerte jeder Einstellungsseite
```

### A) Seiten- & Navigationsstruktur (Komponenten-Baum)
```
Langfristige Planung
+-- Dashboard  (/dashboard/langfristige-planung)
|   +-- Bereichswechsler (bestehend)
|   +-- "Neue Planversion"-Button  -> Dialog (nur Name)
|   +-- Liste der Planversionen (Karten)
|   |   +-- je Karte: Name (-> öffnen), Umbenennen, Löschen (mit Bestätigung)
|   +-- Empty State (wenn keine Version vorhanden)
|
+-- Versionskontext  (/dashboard/langfristige-planung/[versionId]/...)
    +-- Linkes Seitenmenü (NavSheet)
    |   +-- Bereich "Langfristige Planung"
    |   +-- aktiver Versionsname (-> zurück zum Dashboard)
    |   +-- Gruppe "Stammdaten"
    |   |   +-- Plattformen & Produkte   <-- NEU, pro Version
    |   +-- Gruppe "Einstellungen"
    |       +-- Grundeinstellungen, Auszahlungseinstellungen, Absatzeinstellungen,
    |           Produktinformationen, Vertriebseinstellungen, Verkaufsgebühr-,
    |           Marketing-, Operative Fixkosten-, Finanzierungs-, Steuereinstellungen
    +-- jede Seite = gespiegelte Kurzfristig-Seite, aber versionsgebunden
```
Hinweis: Eine **neue Seite „Plattformen & Produkte"** kommt hinzu, weil Plattformen/Produkte hier nicht aus dem globalen Modell stammen, sondern pro Version gepflegt werden. Sie orientiert sich an der globalen KPI-Modell-Seite, lässt aber die SKU-Ebene weg.

### B) Datenmodell (in Klartext)

**Planversion (neuer zentraler Container)**
```
Jede Planversion hat:
- eindeutige ID
- Besitzer (Nutzer)
- Name (Pflicht, 1–100 Zeichen, eindeutig pro Nutzer, Groß-/Kleinschreibung ignoriert)
- Erstellt-/Geändert-Zeitstempel
```

**Plattformen & Produkte (neu, pro Version)**
```
Je Eintrag:
- eindeutige ID
- Zugehörigkeit zu genau EINER Planversion
- Art: "Plattform" oder "Produkt"
- Name, Sortierreihenfolge
(keine SKUs; Produkte sind eine flache Liste pro Version)
```

**Einstellungsdaten je Seite (neu, pro Version — separate Spiegeltabellen)**
```
Für jede gespiegelte Einstellungsseite entsteht eine eigene neue Tabelle nach
demselben Bauplan wie die Kurzfristig-Vorlage, ergänzt um:
- Zugehörigkeit zu genau EINER Planversion (Pflichtbezug)
Verweise auf Plattform/Produkt zeigen auf die VERSIONS-EIGENEN Plattformen/Produkte
(oben), NICHT auf das globale KPI-Modell.
Verweise auf Umsatz-/Einnahmen-/Ausgaben-Kategorien zeigen weiterhin auf das GLOBALE
KPI-Modell (nur lesend).
```

**Lösch- & Isolationsregeln**
```
- Löscht man eine Planversion, werden alle zugehörigen Daten (Plattformen, Produkte,
  alle Einstellungswerte) automatisch mitgelöscht (kaskadierend) — keine Datenreste.
- Daten verschiedener Versionen sind vollständig getrennt; eine Änderung in Version A
  wirkt nie auf Version B oder die Kurzfristige Planung.
- Jeder Datensatz ist zusätzlich an den Nutzer gebunden (Zugriffsschutz).
```

### C) Routing & Versionskontext
- Neues dynamisches Pfadsegment: `/dashboard/langfristige-planung/[versionId]/<seite>`.
- Der aktive Versionskontext wird ausschließlich aus der URL gelesen (`versionId`) — kein globaler Zustand, dadurch mehrere Browser-Tabs mit verschiedenen Versionen möglich und Bookmarks funktionieren.
- Jeder Zugriff (Seite + Datenabruf) prüft serverseitig: gehört die `versionId` dem eingeloggten Nutzer? Falls nein/unbekannt → sauberer Hinweis bzw. Rücksprung zum Dashboard, niemals Fremdzugriff.

### D) Navigation (NavSheet) — kontextabhängig
- Das bestehende NavSheet wird erweitert: Für den Bereich „Langfristige Planung" werden die Navigationsgruppen nur dann gezeigt, wenn die URL eine `versionId` enthält.
- Ohne Version (auf dem Dashboard): keine Seiteneinträge.
- Mit Version: oben der Versionsname (klickbar → Dashboard), darunter „Stammdaten" und „Einstellungen". Alle Links enthalten die `versionId`.
- Der Versionsname wird zur Anzeige anhand der `versionId` nachgeladen.

### E) Wiederverwendung der bestehenden Einstellungsseiten
- Die UI/Bedienlogik der Kurzfristig-Seiten dient als Vorlage. Wo sinnvoll, werden die vorhandenen Tabellen-/Formularkomponenten so verallgemeinert, dass sie ihre Datenquelle (Kurzfristig-API vs. versionsgebundene Langfristig-API) als Parameter erhalten — statt den Code zu duplizieren.
- Die zugehörigen API-Endpunkte werden als versionsbewusste Varianten unter der Langfristig-Struktur neu angelegt (lesen/schreiben immer gefiltert nach `versionId` + Nutzer).

### F) Tech-Entscheidungen (Begründung)
- **Versions-ID im Pfad** (statt globalem Zustand): bookmarkbar, Multi-Tab-fähig, eindeutiger Kontext pro Seite, robust gegen Verwechslung der aktiven Version. (Vom Nutzer bestätigt.)
- **Separate neue Tabellen mit `plan_version_id`** (statt Erweiterung der Kurzfristig-Tabellen): klare Abkapselung, kein Regressionsrisiko für bestehende Kurzfristig-Daten, einfache kaskadierende Löschung pro Version. (Vom Nutzer bestätigt.)
- **Globale Kategorien mitlesen, Plattformen/Produkte pro Version pflegen** (Hybrid): vermeidet Doppelpflege des großen Kategoriemodells, erlaubt aber je Szenario unterschiedliche Plattform-/Produkt-Welten. (Vom Nutzer bestätigt.)
- **Eindeutigkeit des Versionsnamens serverseitig**: verlässlicher Schutz vor Duplikaten, unabhängig vom Client.

### G) Abhängigkeiten (Pakete)
- Keine neuen npm-Pakete nötig. Es werden bestehende Bausteine verwendet: shadcn/ui (Dialog, AlertDialog, Button, Input, Card), Zod (Validierung), Supabase (Datenhaltung inkl. RLS), Next.js App-Router (dynamisches `[versionId]`-Segment).

### H) Umsetzungsreihenfolge (empfohlen)
1. Planversion-Container + Dashboard (anlegen/auflisten/umbenennen/löschen) + Routing-Gerüst `[versionId]`.
2. NavSheet-Erweiterung (kontextabhängige Anzeige + Versionsname).
3. Seite „Plattformen & Produkte" (pro Version) — Grundlage für alle weiteren Seiten.
4. Schrittweises Spiegeln der Einstellungsseiten (je Seite: neue versionsgebundene Tabelle + API + UI-Anbindung).

> Hinweis zum Zuschnitt: Schritte 1–3 bilden das tragfähige Fundament und könnten als erste lauffähige Einheit ausgeliefert werden; das Spiegeln der einzelnen Einstellungsseiten (Schritt 4) ist mechanisch wiederholend und ggf. in Folge-Iterationen sinnvoll aufteilbar.

## Implementation Notes

### Frontend (Fundament — Schritte 1–3 des Designs), 2026-06-20
Umgesetzt wurde das tragfähige Fundament: Planversionen-Verwaltung, versionsbasiertes Routing und das kontextabhängige Seitenmenü. Die einzelnen Einstellungsseiten und die Seite „Plattformen & Produkte" (echte Inhalte) folgen in nächsten Iterationen.

**Neue Dateien:**
- `src/lib/langfristige-planung-nav.ts` — gemeinsame Nav-Konfiguration der Versionsseiten (Gruppen „Stammdaten" + „Einstellungen"), Helfer `buildVersionsHref`, `getVersionIdFromPath`. Single Source of Truth für NavSheet + Übersichtsseite.
- `src/hooks/use-planversionen.ts` — CRUD-Hook gegen die (noch zu bauende) API; optimistische Listenpflege, `PlanversionError` mit Statuscode für 409-Behandlung (Duplikate).
- `src/components/planversion-dialog.tsx` — shadcn `Dialog` für Erstellen/Umbenennen (nur Name, max. 100 Zeichen, Enter-to-submit, Inline-Fehler).
- `src/components/planversionen-verwaltung.tsx` — Dashboard-Inhalt: Karten-Liste, Aktionen (Öffnen/Umbenennen/Löschen via `DropdownMenu`), Lösch-Bestätigung via `AlertDialog`, Empty State, Loading-Skeleton, Toaster-Feedback.
- `src/components/langfristige-version-shell.tsx` — gemeinsames Seitengerüst innerhalb einer Version: Header mit Breadcrumb (Bereich / Versionsname / Seitentitel), NavSheet, lädt/validiert die Version per API, Redirect zum Dashboard bei unbekannter/fremder Version.
- `src/app/dashboard/langfristige-planung/[versionId]/page.tsx` — Versions-Übersicht (Karten aller Versionsseiten).
- `src/app/dashboard/langfristige-planung/[versionId]/[seite]/page.tsx` — Platzhalterseite für noch nicht gebaute Unterseiten (verhindert 404; echte statische Routen übernehmen später automatisch Vorrang vor dem dynamischen `[seite]`-Segment).

**Geänderte Dateien:**
- `src/app/dashboard/langfristige-planung/page.tsx` — Dashboard zeigt jetzt die Planversionen-Verwaltung statt des Platzhalters.
- `src/components/nav-sheet.tsx` — kontextabhängig: in der Langfristigen Planung ohne Version keine Seiteneinträge; mit Version Anzeige des Versionsnamens (klickbar → Dashboard) und versionsspezifische Nav-Links.

**Erwartete API (für `/backend`):**
- `GET /api/langfristige-planung/planversionen` → `Planversion[]`
- `POST /api/langfristige-planung/planversionen` `{name}` → `Planversion` (409 bei Duplikat, Fehlertext in `{error}`)
- `GET /api/langfristige-planung/planversionen/[id]` → `Planversion` (404 wenn nicht vorhanden/fremd)
- `PATCH /api/langfristige-planung/planversionen/[id]` `{name}` → `Planversion` (409 bei Duplikat)
- `DELETE /api/langfristige-planung/planversionen/[id]` → `{success:true}` (kaskadierende Löschung aller Versionsdaten)

`Planversion` = `{ id, name, created_at, updated_at }`. Eindeutigkeit des Namens (case-insensitive, getrimmt, pro Nutzer) muss serverseitig erzwungen werden; Fehlermeldungen kommen als `{ error: string }` zurück und werden im Dialog angezeigt.

**Hinweis:** Build/Lint/Typecheck sauber für die neuen Dateien.

### Backend (Planversionen-API + Schema), 2026-06-20
Die für das Fundament benötigte Datenhaltung und API ist implementiert.

**Datenbank (Supabase-Projekt „Controlling-App", Migration `create_langfristige_planversionen`):**
- Neue Tabelle `langfristige_planversionen` (`id`, `user_id` → `auth.users` ON DELETE CASCADE, `name`, `created_at`, `updated_at`).
- CHECK auf `name`: 1–100 Zeichen nach Trimmen.
- Unique-Index `langfristige_planversionen_user_name_unique` auf `(user_id, lower(btrim(name)))` → Name eindeutig pro Nutzer, case-insensitive & getrimmt (serverseitig erzwungen).
- RLS aktiviert, 4 Policies (SELECT/INSERT/UPDATE/DELETE) mit `auth.uid() = user_id` — Konvention der bestehenden Tabellen.
- Versionsspezifische Datentabellen je Einstellungsseite folgen in späteren Iterationen (jeweils `plan_version_id` → `langfristige_planversionen` ON DELETE CASCADE → kaskadierende Löschung).

**API-Routen:**
- `src/app/api/langfristige-planung/planversionen/route.ts` — `GET` (Liste, nach Name sortiert) + `POST` (anlegen; 400 bei leerem Name, 409 bei Duplikat via PG-Code 23505).
- `src/app/api/langfristige-planung/planversionen/[id]/route.ts` — `GET` (einzeln; 404 bei fremd/unbekannt), `PATCH` (umbenennen; 400/404/409), `DELETE` (Existenz-/Eigentumsprüfung → 404, sonst kaskadierende Löschung).
- Alle Routen: `requireAuth` (401 unautorisiert), Zod-Validierung, Queries zusätzlich nach `user_id` gefiltert (Defense-in-Depth zur RLS), Fehler als `{ error: string }`.

**Tests:** `src/app/api/langfristige-planung/planversionen/route.test.ts` + `[id]/route.test.ts` — **21/21 grün** (Happy Path, 400/401/404/409, DB-Fehler). Typecheck sauber.

**Frontend-Anbindung:** Keine Änderungen nötig — der bereits gebaute Hook/Shell ruft exakt diese Endpunkte und Fehlerformate auf. Das Fundament ist damit im Browser lauffähig.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
