# PROJ-103: Planversionen-Ordner — Langfristige Planung

## Status: Deployed
**Created:** 2026-07-03
**Last Updated:** 2026-07-03

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — Ordner sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — dieses Feature erweitert die Planversionen-Verwaltung auf dem Dashboard `/dashboard/langfristige-planung` um eine Ordnerstruktur

## Overview
Auf dem Dashboard der Langfristigen Planung können aktuell beliebig viele Planversionen als flache Liste angelegt werden (PROJ-73). Mit wachsender Anzahl wird diese Liste unübersichtlich. Dieses Feature führt **Ordner** als reines Ordnungs-/Sortierungswerkzeug ein: Der Nutzer kann Ordner anlegen, die mehrere zusammengehörige Planversionen bündeln.

Ordner sind bewusst **einfach und einstufig**: Es gibt genau **eine Ordnerebene** — innerhalb eines Ordners können **keine** weiteren Ordner angelegt werden. Eine Planversion liegt entweder **auf der Grundseite** (außerhalb jedes Ordners) oder **in genau einem Ordner**. Ordner tragen keine eigenen Planungsdaten; sie sind nur Container zur Organisation.

## User Stories
- Als Controller möchte ich auf dem Langfristige-Planung-Dashboard Ordner anlegen können, damit ich zusammengehörige Planversionen (z.B. „Szenario 2027", „Investoren-Runde") gebündelt und ordentlich ablegen kann.
- Als Controller möchte ich eine neue Planversion wahlweise direkt auf der Grundseite oder innerhalb eines Ordners anlegen können, damit sie von Anfang an am richtigen Ort liegt.
- Als Controller möchte ich einen Ordner öffnen und schließen (auf-/zuklappen), um die enthaltenen Planversionen zu sehen bzw. auszublenden, damit ich den Überblick behalte.
- Als Controller möchte ich einen Ordner umbenennen und löschen können, damit ich meine Struktur aktuell halten kann.
- Als Controller möchte ich bestehende Planversionen nachträglich in einen Ordner verschieben oder aus einem Ordner auf die Grundseite zurückholen können, damit ich meine Ablage jederzeit umsortieren kann.

## Acceptance Criteria

### Datenmodell — Ordner
- [ ] Ein Ordner gehört genau einem Nutzer (`user_id`) und hat mindestens: `id`, `name`, `created_at`, `updated_at`
- [ ] Der Name ist ein Pflichtfeld (nach Trimmen ≥ 1 Zeichen) mit einer sinnvollen Maximallänge (Vorschlag: 100 Zeichen, analog Planversion)
- [ ] Der Ordnername ist **eindeutig pro Nutzer** (case-insensitive, getrimmt) — Duplikate werden beim Anlegen und Umbenennen serverseitig abgelehnt
- [ ] Eine Planversion referenziert **optional genau einen** Ordner (`folder_id` nullable): `null` = liegt auf der Grundseite, gesetzt = liegt in diesem Ordner
- [ ] Es gibt **keine** Ordner-in-Ordner-Beziehung (Ordner haben kein eigenes `folder_id`); die Struktur ist fest einstufig

### Dashboard — Ordner-Verwaltung (`/dashboard/langfristige-planung`)
- [ ] Es gibt eine Aktion „Neuer Ordner" (Button), die einen Dialog öffnet, der **nur den Namen** abfragt
- [ ] Nach erfolgreichem Anlegen erscheint der Ordner sofort auf dem Dashboard (leer, ohne Planversionen)
- [ ] Ordner werden auf der Grundseite gemeinsam mit den ordnerlosen Planversionen dargestellt; Ordner sind optisch klar als Container erkennbar (z.B. Ordner-Icon, aufklappbar) und von einzelnen Planversionen unterscheidbar
- [ ] Ein Ordner ist auf-/zuklappbar; aufgeklappt zeigt er die enthaltenen Planversionen, zugeklappt nur seinen Namen (und optional die Anzahl enthaltener Versionen)
- [ ] Jeder Ordner bietet die Aktionen **Umbenennen** und **Löschen** (z.B. über ein Dreipunktemenü am Ordner)
- [ ] Umbenennen öffnet eine Eingabe mit dem aktuellen Namen vorausgefüllt; nach Speichern wird der neue Name angezeigt

### Planversion anlegen — mit Ort
- [ ] Beim Anlegen einer neuen Planversion **auf der Grundseite** wird sie ordnerlos (`folder_id = null`) erstellt
- [ ] Innerhalb eines geöffneten Ordners gibt es eine Aktion „Neue Planversion" (bzw. in den Ordner hinein anlegen), die die Version direkt diesem Ordner zuordnet
- [ ] Die bestehenden Regeln für Planversionsnamen (Pflicht, eindeutig pro Nutzer, Länge — siehe PROJ-73) bleiben unverändert; die Eindeutigkeit gilt weiterhin **pro Nutzer**, nicht pro Ordner

### Verschieben von Planversionen
- [ ] Über das Dreipunktemenü einer Planversion gibt es die Aktion **„In Ordner verschieben"** mit Auswahl eines Zielordners
- [ ] Über das Dreipunktemenü einer Planversion in einem Ordner gibt es die Aktion **„Aus Ordner entfernen"** (verschiebt sie zurück auf die Grundseite, `folder_id = null`)
- [ ] Nach dem Verschieben erscheint die Planversion sofort am neuen Ort; sie verschwindet vom alten Ort
- [ ] Verschieben ändert **ausschließlich** die Ordnerzuordnung — alle Planungsdaten der Version bleiben unverändert erhalten

### Ordner löschen
- [ ] Ein Ordner kann nur gelöscht werden, wenn er **leer** ist (keine Planversionen enthält)
- [ ] Der Versuch, einen **nicht leeren** Ordner zu löschen, wird mit einer verständlichen Meldung abgelehnt (Hinweis: erst Versionen verschieben oder löschen); es werden **keine** Planversionen mitgelöscht
- [ ] Das Löschen eines leeren Ordners erfordert keine schwere Bestätigung (da keine Daten verloren gehen), entfernt den Ordner sofort von der Ansicht

### Isolation & Abgrenzung
- [ ] Ordner enthalten **keine** eigenen Planungsdaten und ändern die Datenisolation der Planversionen nicht — das Öffnen/Bearbeiten einer Version funktioniert identisch, unabhängig davon, ob sie in einem Ordner liegt
- [ ] Alle Ordner- und Zuordnungs-Operationen sind durch den eingeloggten Nutzer abgesichert (kein Zugriff auf fremde Ordner/Versionen)

## Edge Cases
- **Doppelter Ordnername beim Anlegen/Umbenennen:** Verständliche Fehlermeldung; Ordner wird nicht angelegt/umbenannt.
- **Leerer / nur aus Leerzeichen bestehender Ordnername:** Wird abgelehnt mit Hinweis.
- **Löschen eines nicht leeren Ordners:** Blockiert mit Hinweis; keine Version geht verloren.
- **Verschieben in einen Ordner, der zwischenzeitlich (anderer Tab) gelöscht wurde:** Sauberer Fehler-Hinweis, kein Absturz; die Version bleibt an ihrem bisherigen Ort.
- **Version, deren Ziel-/Quellordner nicht dem Nutzer gehört:** Kein Zugriff (behandelt wie nicht vorhanden).
- **Sehr langer Ordnername:** Auf Maximallänge begrenzt; Anzeige wird sauber abgeschnitten (Ellipsis), bricht das Layout nicht.
- **Keine Ordner vorhanden:** Dashboard zeigt weiterhin nur die (ordnerlosen) Planversionen — kein leerer/kaputter Zustand; „Neuer Ordner" bleibt verfügbar.
- **Leerer Ordner:** Aufgeklappt zeigt er einen Hinweis, dass noch keine Planversion enthalten ist, plus die Aktion, direkt darin eine anzulegen.
- **Mehrere Tabs:** Ordnerstruktur bleibt konsistent, da sie serverseitig gehalten wird; nach Reload spiegelt die Ansicht den aktuellen Stand.

## Technical Requirements
- **Backend nötig:** neue Tabelle für Ordner (`user_id`, `name`, Zeitstempel) sowie eine nullable Spalte `folder_id` (Foreign Key auf die Ordner-Tabelle, `ON DELETE`-Verhalten so gewählt, dass Löschen nicht leerer Ordner ohnehin blockiert wird — z.B. `RESTRICT`, ergänzt um serverseitige Prüfung) auf der bestehenden Planversionen-Tabelle
- **RLS:** Row Level Security auf der neuen Ordner-Tabelle; Zugriff nur auf eigene Daten; Zuordnung serverseitig prüfen (Zielordner muss dem Nutzer gehören)
- **Validierung:** alle Eingaben (Name, IDs) serverseitig mit Zod validieren; Eindeutigkeit des Ordnernamens serverseitig durchsetzen; „nur leere Ordner löschbar" serverseitig erzwingen
- **shadcn/ui first:** Dialog (Anlegen/Umbenennen), DropdownMenu (Aktionen), Button, Input, ggf. Collapsible/Accordion für das Auf-/Zuklappen — keine Eigenbauten
- **Wiederverwendung:** bestehende `PlanversionenVerwaltung`, `PlanversionDialog` und `use-planversionen`-Hook erweitern statt duplizieren
- **Responsive:** Dashboard mit Ordnern funktioniert auf Mobil (375px) und Desktop (1440px)

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Sortierung/manuelle Reihenfolge von Ordnern und Versionen (aktuell alphabetisch/nach Anlage) — bei Bedarf spätere Spec
- Verschachtelte Ordner (mehrstufig) — bewusst ausgeschlossen
- Farb-/Icon-Markierung von Ordnern — nicht Teil des MVP

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee
Ordner sind ein **reines Ordnungswerkzeug** und werden so einfach wie möglich gebaut. Ein Ordner ist ein leerer Behälter, der einen Namen trägt und keine Planungsdaten enthält. Die Zugehörigkeit einer Planversion zu einem Ordner ist eine **einzelne, optionale Markierung** an der Planversion selbst („liegt in Ordner X" oder „liegt frei auf der Grundseite"). Dadurch bleibt das gesamte bestehende Planversions- und Datenmodell (PROJ-73) unberührt — Öffnen, Bearbeiten und Löschen einer Version funktionieren exakt wie bisher, egal ob sie in einem Ordner liegt oder nicht.

### A) Seiten- & Komponentenstruktur (Dashboard)
```
Dashboard „Langfristige Planung"  (/dashboard/langfristige-planung)
+-- Kopfzeile
|   +-- Button „Neue Planversion"   (legt auf Grundseite an)
|   +-- Button „Neuer Ordner"       (NEU)
+-- Inhaltsbereich (gemischte Liste)
|   +-- Ordner (aufklappbar)                                 <-- NEU
|   |   +-- Ordner-Kopf: Name, Anzahl Versionen, Auf-/Zuklappen
|   |   +-- Dreipunktemenü: Umbenennen, Löschen (nur wenn leer)
|   |   +-- (aufgeklappt) Planversionen dieses Ordners
|   |   |   +-- je Version: Öffnen + Dreipunktemenü
|   |   |       (Umbenennen, „Aus Ordner entfernen", Löschen)
|   |   +-- (aufgeklappt, leer) Hinweis + „Neue Planversion hier anlegen"
|   +-- Freie Planversionen (ohne Ordner, wie bisher)
|       +-- je Version: Öffnen + Dreipunktemenü
|           (Umbenennen, „In Ordner verschieben", Löschen)
+-- Empty State (weder Ordner noch Versionen)
```
Es wird **eine** neue kleine Dialog-Nutzung für Ordner (Anlegen/Umbenennen) gebraucht — der bestehende `PlanversionDialog` liefert die Vorlage. Für das Verschieben genügt ein Auswahl-Menü (Zielordner) im bestehenden Dreipunktemenü der Version.

### B) Datenmodell (in Klartext)

**Ordner (neuer, kleiner Container)**
```
Jeder Ordner hat:
- eindeutige ID
- Besitzer (Nutzer)
- Name (Pflicht, 1–100 Zeichen, eindeutig pro Nutzer, Groß-/Kleinschreibung ignoriert)
- Erstellt-/Geändert-Zeitstempel
Ein Ordner enthält KEINE Planungsdaten und KEINEN Verweis auf andere Ordner
(feste Einstufigkeit — keine Ordner-in-Ordner).
```

**Planversion (bestehend, um eine Markierung ergänzt)**
```
Die Planversion bekommt EIN neues, optionales Feld:
- Ordner-Zugehörigkeit (leer = liegt frei auf der Grundseite;
  gesetzt = liegt in genau diesem Ordner)
Sonst bleibt die Planversion unverändert.
```

**Zusammenhang & Regeln**
```
- Grundseite zeigt: alle Ordner + alle Versionen ohne Ordner-Zugehörigkeit.
- Ordner (aufgeklappt) zeigt: alle Versionen mit genau dieser Ordner-Zugehörigkeit.
- „Verschieben" ändert ausschließlich die Ordner-Markierung der Version —
  kein einziger Planungsdatensatz wird angefasst.
- „Ordner löschen" ist nur erlaubt, wenn KEINE Version auf ihn zeigt.
  Der Versuch, einen gefüllten Ordner zu löschen, wird serverseitig abgelehnt
  (kein Mitlöschen von Versionen). Zusätzlich verhindert die Datenbank das
  Löschen eines noch referenzierten Ordners technisch.
```

### C) Backend (was entsteht)
- **Eine neue Tabelle** für Ordner (mit Row Level Security, Zugriff nur auf eigene Ordner; Name-Eindeutigkeit pro Nutzer serverseitig erzwungen — analog zur Planversionen-Tabelle aus PROJ-73).
- **Ein neues optionales Feld** an der bestehenden Planversionen-Tabelle für die Ordner-Zugehörigkeit; die Datenbankbeziehung ist so gewählt, dass das Löschen eines noch belegten Ordners technisch blockiert wird (zusätzlich zur fachlichen Server-Prüfung).
- **Neue API-Endpunkte**: Ordner auflisten/anlegen/umbenennen/löschen; sowie das Setzen/Entfernen der Ordner-Zugehörigkeit einer Version (Verschieben). Die bestehende „Version anlegen"-Funktion wird um die optionale Angabe „in welchem Ordner" erweitert.
- Alle Endpunkte prüfen Eigentum (Nutzer) und validieren Eingaben serverseitig.

### D) Frontend (was sich ändert)
- Erweiterung der bestehenden Dashboard-Komponente (`PlanversionenVerwaltung`) um die Ordner-Darstellung (aufklappbare Container) und die neuen Aktionen; Wiederverwendung von `PlanversionDialog`, `DropdownMenu`, `AlertDialog`.
- Erweiterung des Daten-Hooks (`use-planversionen`) bzw. ein kleiner zusätzlicher Hook für Ordner (laden/anlegen/umbenennen/löschen/verschieben) im gleichen Muster wie bisher (optimistische Aktualisierung, Fehler-Toasts, 409 bei Namensdubletten).

### E) Tech-Entscheidungen (Begründung)
- **Ordner-Zugehörigkeit als Feld an der Version** (statt Verknüpfungstabelle): Eine Version liegt in höchstens einem Ordner — ein einzelnes optionales Feld ist der einfachste, robusteste Weg und hält das bestehende Modell stabil.
- **Feste Einstufigkeit** (kein Ordner-Verweis auf Ordner): entspricht der Anforderung, hält UI und Navigation simpel, vermeidet Rekursionslogik.
- **Löschen nur leerer Ordner** (statt Kaskade): schützt vor versehentlichem Datenverlust; deckt sich mit der Produktentscheidung. Fachliche Prüfung im Server **und** technische Sperre in der Datenbank (Gürtel-und-Hosenträger).
- **Kein Eingriff in Planungsdaten beim Verschieben**: Ordner sind reine Ablage; Datenisolation der Versionen bleibt unverändert.

### F) Abhängigkeiten (Pakete)
Keine neuen npm-Pakete. Verwendet werden bestehende Bausteine: shadcn/ui (Dialog, DropdownMenu, AlertDialog, Button, Input, Collapsible), Zod (Validierung), Supabase (Datenhaltung inkl. RLS), Next.js App-Router.

### G) Umsetzungsreihenfolge (empfohlen)
1. Backend: Ordner-Tabelle + Ordner-Feld an der Version + Endpunkte (CRUD + Verschieben + „nur leere löschbar").
2. Frontend: Ordner im Dashboard darstellen (anlegen, auflisten, auf-/zuklappen, umbenennen, löschen).
3. Frontend: Versionen in/aus Ordner verschieben + Version direkt in einem Ordner anlegen.

## Implementation Notes

### Frontend, 2026-07-03
Das Dashboard der Langfristigen Planung wurde um die Ordnerstruktur erweitert. Die Ordner-Daten werden über eine noch zu bauende API geladen (siehe „Erwartete API" unten) — Backend ist der nächste Schritt.

**Neue Dateien:**
- `src/hooks/use-planversion-ordner.ts` — CRUD-Hook für Ordner (laden/anlegen/umbenennen/löschen), gleiches Muster wie `use-planversionen` (optimistische Listenpflege, `PlanversionError` mit Statuscode für 409-Behandlung bei Namensdubletten und beim Löschen nicht-leerer Ordner).

**Geänderte Dateien:**
- `src/components/planversion-dialog.tsx` — generalisiert: optionale `texts`-Prop (Titel/Beschreibung/Placeholder), damit derselbe Namens-Dialog auch für Ordner genutzt wird. Standardtexte unverändert → bestehende Aufrufe bleiben gleich.
- `src/hooks/use-planversionen.ts` — `Planversion` um `ordner_id: string | null` ergänzt; `create(name, ordnerId?)` akzeptiert jetzt einen Zielordner; neue `move(id, ordnerId | null)`-Aktion (PATCH `{ ordner_id }`) zum Verschieben in einen Ordner bzw. auf die Grundseite.
- `src/components/planversionen-verwaltung.tsx` — komplette Überarbeitung: aufklappbare Ordner (shadcn `Collapsible`) mit Version-Anzahl, Ordner-Dreipunktemenü (Neue Planversion, Umbenennen, Löschen), freie Planversionen darunter. Version-Dreipunktemenü erweitert um „In Ordner verschieben" (Untermenü via `DropdownMenuSub` mit Zielordner-Liste) und „Aus Ordner entfernen". „Neuer Ordner"-Button in der Kopfzeile. Neue Planversion kann auf der Grundseite oder direkt in einem Ordner angelegt werden. Ordner löschen: nur wenn leer — bei belegtem Ordner erscheint ein erklärender Toast (kein Löschen); zusätzlich erzwingt der Server die Regel. Empty State greift nur, wenn weder Ordner noch Versionen existieren.

**Design-Entscheidungen:**
- Ordner sind standardmäßig aufgeklappt (zugeklappte werden in einem lokalen `Set` gemerkt).
- „Ordner löschen" nutzt bewusst **keinen** schweren Bestätigungsdialog (leerer Ordner = kein Datenverlust); Versionslöschung behält den `AlertDialog`.
- Verschieben erfolgt über ein Untermenü statt Drag&Drop (einfacher, mobiltauglich, barrierearm).

**Erwartete API (für `/backend`):**
- `GET /api/langfristige-planung/planversion-ordner` → `PlanversionOrdner[]` (nach Name sortiert)
- `POST /api/langfristige-planung/planversion-ordner` `{name}` → `PlanversionOrdner` (400 leer, 409 Duplikat)
- `PATCH /api/langfristige-planung/planversion-ordner/[id]` `{name}` → `PlanversionOrdner` (400/404/409)
- `DELETE /api/langfristige-planung/planversion-ordner/[id]` → `{success:true}`; **409**, wenn der Ordner noch Planversionen enthält (Fehlertext in `{error}`)
- Bestehende Planversionen-Route erweitern:
  - `GET`/`POST`/`PATCH` liefern/akzeptieren zusätzlich `ordner_id: string | null`
  - `POST /api/langfristige-planung/planversionen` akzeptiert optional `ordner_id` (Zielordner muss dem Nutzer gehören, sonst Fehler)
  - `PATCH /api/langfristige-planung/planversionen/[id]` akzeptiert `{ ordner_id }` zum Verschieben (null = Grundseite); Zielordner-Eigentum serverseitig prüfen

`PlanversionOrdner` = `{ id, name, created_at, updated_at }`. Name eindeutig pro Nutzer (case-insensitive, getrimmt) serverseitig erzwingen. Fehler als `{ error: string }`.

**Hinweis:** Typecheck sauber für alle geänderten/neuen Dateien. `next lint` ist in diesem Next-16-Projekt nicht ausführbar (Subcommand entfernt, keine ESLint-Flat-Config) — Verifikation daher via `tsc`. Bis die Ordner-API existiert, zeigt das Dashboard einen Ladefehler (der Ordner-Endpunkt fehlt noch) — das löst sich mit dem `/backend`-Schritt.

### Backend (Ordner-API + Schema), 2026-07-03
Datenhaltung und API für Ordner sind implementiert; die vom Frontend erwarteten Endpunkte existieren jetzt.

**Datenbank (Supabase-Projekt „Controlling-App", Migration `create_langfristige_planversion_ordner`):**
- Neue Tabelle `langfristige_planversion_ordner` (`id`, `user_id` → `auth.users` ON DELETE CASCADE, `name`, `created_at`, `updated_at`).
- CHECK auf `name`: 1–100 Zeichen nach Trimmen.
- Unique-Index `langfristige_planversion_ordner_user_name_unique` auf `(user_id, lower(btrim(name)))` → Name eindeutig pro Nutzer, case-insensitive & getrimmt.
- RLS aktiviert, 4 Policies (SELECT/INSERT/UPDATE/DELETE) mit `auth.uid() = user_id`.
- Neue Spalte `ordner_id uuid` an `langfristige_planversionen`, FK → `langfristige_planversion_ordner(id)` **ON DELETE RESTRICT** (technische Sperre gegen Löschen belegter Ordner), nullable (NULL = Grundseite), plus Index.
- Security-Advisor nach der Migration: keine neuen Warnungen für die neue Tabelle.

**API-Routen:**
- `src/app/api/langfristige-planung/planversion-ordner/route.ts` — `GET` (Liste, nach Name sortiert, `.limit(500)`) + `POST` (anlegen; 400 leer, 409 Duplikat via 23505).
- `src/app/api/langfristige-planung/planversion-ordner/[id]/route.ts` — `PATCH` (umbenennen; 400/404/409) + `DELETE` (Existenz-/Eigentumsprüfung → 404; **Count der enthaltenen Versionen → 409, wenn nicht leer**; sonst löschen; FK-Verletzung 23503 als Backstop ebenfalls → 409).
- Erweiterte Planversionen-Routen:
  - `planversionen/route.ts` — `SELECT_COLS` um `ordner_id` ergänzt; `POST` akzeptiert optional `ordner_id` und prüft Zielordner-Eigentum (fremd/unbekannt → 400) vor dem Insert.
  - `planversionen/[id]/route.ts` — `SELECT_COLS` um `ordner_id` ergänzt; `PATCH` unterstützt jetzt Umbenennen **und/oder** Verschieben: flexibles Zod-Schema (beide Felder optional, mindestens eines nötig), Zielordner-Eigentumsprüfung bei `ordner_id != null`, `ordner_id: null` verschiebt auf die Grundseite.
- Alle Routen: `requireAuth` (401), Zod-Validierung, Queries zusätzlich nach `user_id` gefiltert (Defense-in-Depth zur RLS), Fehler als `{ error: string }`.

**Tests:** `planversion-ordner/route.test.ts` (6) + `planversion-ordner/[id]/route.test.ts` (11, inkl. „409 wenn Ordner nicht leer") sowie erweiterte Planversionen-Tests (Anlegen in Ordner, Verschieben in Ordner/auf Grundseite, ungültiger Zielordner, „keine Änderung"). **46/46 grün** in den betroffenen Suites. Typecheck sauber für alle neuen/geänderten Backend-Dateien.

**Frontend-Anbindung:** Keine Änderungen nötig — der in der Frontend-Iteration gebaute Hook (`use-planversion-ordner`) und die erweiterten Planversionen-Aufrufe (`create` mit `ordner_id`, `move`) treffen exakt diese Endpunkte und Fehlerformate. Das Dashboard ist damit im Browser lauffähig.

## QA Test Results

**Getestet:** 2026-07-03 · **Methode:** Code-Audit gegen alle AC, Vitest-Integrationstests, DB-Verifikation (Supabase), E2E-Auth/Regression (Playwright), Red-Team-Security-Audit.

### Zusammenfassung
- **Acceptance Criteria:** alle bestanden (kein AC offen/fehlgeschlagen).
- **Automatisierte Tests:** 46/46 Route-Tests grün (`planversion-ordner` + erweiterte `planversionen`); 4/4 E2E grün (Auth-Guard + Regression). Typecheck sauber für alle Feature-Dateien.
- **Bugs:** 0 Critical · 0 High · 0 Medium · 2 Low (siehe unten).
- **Production-Ready:** **JA** (keine Critical/High-Bugs).

### Acceptance Criteria (Auswahl, alle ✅)
| Bereich | Ergebnis | Nachweis |
|---|---|---|
| Ordner-Datenmodell (id/user_id/name/timestamps, 1–100, eindeutig pro Nutzer, einstufig) | ✅ | Migration verifiziert (CHECK, Unique-Index, RLS); `ordner_id` nullable FK |
| Ordner anlegen (nur Name) / sofort sichtbar | ✅ | Route-Tests 201/400/409; optimistische Liste |
| Ordner aufklappbar, Umbenennen/Löschen via Menü | ✅ | Code-Audit `Collapsible` + `DropdownMenu`; Rename vorausgefüllt |
| Version anlegen auf Grundseite **oder** in Ordner | ✅ | POST akzeptiert `ordner_id` + Eigentumsprüfung; Test „201 in owned folder" |
| Verschieben in Ordner / auf Grundseite | ✅ | PATCH-Tests (in Ordner, auf Grundseite null, ungültiger Zielordner 400); DB-Move beidseitig verifiziert |
| Ordner löschen **nur wenn leer** | ✅ | Frontend-Guard + Backend-Count (409) + DB `ON DELETE RESTRICT`; Test „409 wenn nicht leer" |
| Verschieben ändert nur Zuordnung, keine Planungsdaten | ✅ | PATCH setzt ausschließlich `ordner_id`/`updated_at` |
| Empty States (keine Ordner / leerer Ordner / gar nichts) | ✅ | Code-Audit der drei Zustände |

### Edge Cases (alle ✅)
Doppelter Ordnername → 409 · leerer/Whitespace-Name → 400 · Löschen belegter Ordner → 409, keine Version geht verloren · Verschieben in zwischenzeitlich gelöschten/fremden Ordner → „Zielordner nicht gefunden" (400) · sehr langer Name → `maxLength=100` + `truncate`/Ellipsis · leerer Ordner → Hinweis + „Neue Planversion hier anlegen".

### Security-Audit (Red Team)
- **Auth-Guard:** unauth GET/POST/DELETE auf Ordner- & Versions-API → 307 Redirect `/login`, keine Datenänderung (live geprüft). ✅
- **Authorization:** alle Queries zusätzlich nach `user_id` gefiltert (Defense-in-Depth zur RLS); fremde Version/Ordner → 404; Verschieben/Anlegen prüft Zielordner-Eigentum → sonst 400 (kein Zuweisen an fremde Ordner). ✅
- **Injection/XSS:** Ordner-/Versionsnamen werden über React gerendert (auto-escaped), kein `dangerouslySetInnerHTML`; Eingaben serverseitig via Zod + DB-CHECK validiert. ✅
- **Löschschutz mehrschichtig:** „nur leere Ordner" an 3 Stellen (Frontend-Guard, Backend-Count-409, DB-RESTRICT-Backstop). ✅
- **Security-Advisor:** keine neuen Warnungen für die neue Tabelle.

### Regression
- Bestehende `planversionen`-Route-Tests weiterhin grün (im 46er-Lauf enthalten). Umbenennen/Löschen von Versionen unverändert.
- `langfristige-version-shell` (nutzt `Planversion`-Typ mit neuem `ordner_id`) typet sauber; NavSheet unverändert funktionsfähig.
- Kurzfristige Planung weiterhin erreichbar (E2E).

### Gefundene Bugs
- **Low #1 — Menütext bei 0 Ordnern:** Bei einer freien Version ohne existierende Ordner zeigt „In Ordner verschieben" den deaktivierten Eintrag „Keine weiteren Ordner". Wording impliziert fälschlich, es gäbe bereits welche — besser „Keine Ordner vorhanden". Rein kosmetisch, keine Funktionsauswirkung.
- **Low #2 — Ordner-Symbol an aktiver Version im NavSheet (Bestandsverhalten aus PROJ-73):** Das linke Seitenmenü zeigt die aktive Planversion mit einem `FolderOpen`-Icon (`src/components/nav-sheet.tsx:182`). Das widerspricht der Nutzerpräferenz „Planversionen sollen kein Ordner-Symbol tragen", die im Dashboard bereits umgesetzt wurde. Nicht Teil des PROJ-103-Scopes; zur Entscheidung vorgelegt, ob das NavSheet-Icon angeglichen werden soll.

### Manuell/nicht automatisiert
Interaktive Ende-zu-Ende-Flows mit echter Session (Ordner anlegen/umbenennen/löschen im Browser, Drag-freies Verschieben per Menü, Anlegen in Ordner) sind über Code-Audit + DB-Verifikation + Route-Tests abgedeckt; vollständige UI-Automatisierung erfordert eine authentifizierte Session (projektweite Konvention, analog PROJ-74–101).

## Deployment
**Deployed:** 2026-07-03 · **Tag:** `v1.103.0-PROJ-103` · **Commit:** `c74a3ce`
- Vercel Auto-Deploy via Push auf `main` (GitHub: LepiBaby/Controlling-App).
- DB-Migration `create_langfristige_planversion_ordner` bereits im Supabase-Projekt „Controlling-App" angewandt.
- Production-Build lokal grün (`npm run build`, Exit 0); alle neuen Routen kompiliert.
- Zusammen mit PROJ-104 in einem Commit ausgeliefert (geteilte Dateien).
