# PROJ-50: Grundeinstellungen — Kurzfristige Planung

## Status: In Progress
**Created:** 2026-06-03
**Last Updated:** 2026-06-03 (Frontend)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-41 (Bereichswechsler) — der Bereich „Kurzfristige Planung" muss als URL-Rahmen existieren; diese Seite erweitert ihn mit Navigation und einer Kachel

## Übersicht

Auf der Seite „Grundeinstellungen" legt der Nutzer die grundlegenden Parameter für die kurzfristige Planung fest. Zum jetzigen Zeitpunkt gibt es genau eine Einstellung: den **Planungshorizont**, der bestimmt, über wie viele Kalenderwochen geplant werden soll (Eingabe: ganze Zahl, 1–52).

Die Seite ist so konzipiert, dass später weitere Grundeinstellungen ergänzt werden können, ohne die Seitenstruktur zu ändern.

Die Einstellung wird nutzerspezifisch gespeichert — jeder Nutzer hat seinen eigenen Planungshorizont.

## User Stories

- Als Nutzer möchte ich die Seite „Grundeinstellungen" über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können, damit ich schnell dorthin gelange.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite von „Kurzfristige Planung" eine Kachel „Grundeinstellungen" sehen, damit ich von dort direkt auf die Seite wechseln kann.
- Als Nutzer möchte ich den Planungshorizont als ganze Zahl zwischen 1 und 52 eingeben können, damit ich festlege, für wie viele Kalenderwochen die kurzfristige Planung gelten soll.
- Als Nutzer möchte ich, dass mein eingegebener Planungshorizont gespeichert wird und beim nächsten Aufruf noch vorhanden ist.
- Als Nutzer möchte ich eine klare Rückmeldung erhalten, wenn meine Eingabe ungültig ist (z. B. außerhalb 1–52 oder kein ganzzahliger Wert), damit ich den Fehler sofort korrigieren kann.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag „Grundeinstellungen" → `/dashboard/kurzfristige-planung/grundeinstellungen`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Grundeinstellungen" (analog zu den anderen Einstellungs-Kacheln), die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Einstellungsformular

- [ ] Die Seite zeigt einen Abschnitt „Planungshorizont" mit:
  - Einem beschrifteten Zahleneingabefeld (Label: „Planungshorizont (Kalenderwochen)")
  - Einem Hilfstext: „Anzahl der Kalenderwochen, die in der kurzfristigen Planung berücksichtigt werden sollen."
- [ ] Das Eingabefeld akzeptiert nur ganze Zahlen
- [ ] Sichtbarer Gültigkeitsbereich: min = 1, max = 52
- [ ] Das Feld zeigt beim ersten Aufruf den gespeicherten Wert des Nutzers (falls vorhanden) oder den Standardwert 13 (= ca. ein Quartal)
- [ ] Änderungen werden nach `onBlur` automatisch gespeichert (kein separater „Speichern"-Button nötig)
- [ ] Nach erfolgreichem Speichern erscheint eine kurze Toast-Erfolgsmeldung: „Einstellung gespeichert."

### Validierung

- [ ] Eingabe < 1 oder > 52: Fehlermeldung unter dem Feld: „Bitte einen Wert zwischen 1 und 52 eingeben."
- [ ] Eingabe ist keine ganze Zahl (Dezimalzahl, Buchstaben, leer): Fehlermeldung: „Bitte eine ganze Zahl eingeben."
- [ ] Bei ungültigem Wert wird kein API-Aufruf ausgeführt
- [ ] Bei ungültigem Wert bleibt der zuletzt gespeicherte Wert in der DB unverändert

### Datenpersistenz

- [ ] Die Einstellung wird pro Nutzer gespeichert (`user_id`)
- [ ] Beim ersten Aufruf ohne vorhandenen Eintrag wird der Standardwert 13 angezeigt (kein DB-Eintrag nötig, bis der Nutzer speichert)
- [ ] Beim nächsten Aufruf der Seite ist der gespeicherte Wert vorbelegt
- [ ] Optimistisches Update: Änderung erscheint sofort in der UI; bei API-Fehler → Toast-Fehlermeldung, Rollback auf vorherigen Wert

### Datenbankschema

- [ ] Neue Tabelle `grundeinstellungen`:
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `planungshorizont_wochen` INTEGER NOT NULL CHECK (1–52) DEFAULT 13
  - UNIQUE(`user_id`) — genau ein Eintrag pro Nutzer
  - RLS: Nutzer sieht und schreibt nur eigenen Eintrag

### API-Routen

- [ ] `GET /api/grundeinstellungen` — lädt den Eintrag des eingeloggten Nutzers; gibt `{ planungshorizont_wochen: 13 }` zurück wenn noch kein Eintrag vorhanden (Fallback-Default, kein DB-Insert)
- [ ] `PUT /api/grundeinstellungen` — Eintrag anlegen oder aktualisieren (Upsert per `user_id`)
  - Body: `{ planungshorizont_wochen: number }`
  - Zod-Validierung: ganze Zahl, min 1, max 52
- [ ] Bei Validierungsfehler: HTTP 400 mit Fehlerbeschreibung
- [ ] `requireAuth()` in beiden Routen

## Edge Cases

- **Erster Aufruf ohne gespeicherten Wert**: Feld zeigt Standardwert 13; kein DB-Eintrag vorhanden — erst beim ersten Speichern wird ein Eintrag angelegt
- **Eingabe von 0 oder negativem Wert**: Fehlermeldung, kein Speichern
- **Eingabe > 52**: Fehlermeldung, kein Speichern
- **Dezimalzahl eingegeben** (z. B. 4.5): Fehlermeldung „Bitte eine ganze Zahl eingeben.", kein Speichern
- **Leeres Feld bei onBlur**: Fehlermeldung, Rollback auf zuletzt gespeicherten Wert
- **API-Fehler beim Speichern**: Toast „Einstellung konnte nicht gespeichert werden.", Rollback auf vorherigen Wert im Feld
- **Spätere weitere Einstellungen**: Die Seitenstruktur ist als vertikal gestapelte Einstellungsabschnitte ausgelegt — neue Einstellungen werden darunter hinzugefügt, ohne bestehende Komponenten zu ändern

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen Tabelle `grundeinstellungen`
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/grundeinstellungen/page.tsx`
- Navigation erweitert: Eintrag „Grundeinstellungen" in der Navigationsgruppe „Kurzfristige Planung" in `nav-sheet.tsx`
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx`
- shadcn `Input` (type="number") für das Zahleneingabefeld
- shadcn `Toast` für Erfolgs- und Fehlermeldungen

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung  (Landing-Seite — bereits vorhanden)
+-- Kachelraster (bereits vorhanden)
    +-- Kachel "Grundeinstellungen" (NEU) → /dashboard/kurzfristige-planung/grundeinstellungen

/dashboard/kurzfristige-planung/grundeinstellungen  (NEUE Seite)
+-- Header (NavSheet + Seitentitel "Grundeinstellungen" + LogoutButton — identisch mit anderen Seiten)
+-- GrundeinstellungenFormular  (NEUE Hauptkomponente)
    +-- Abschnitt "Planungshorizont"  (Card-Container)
        +-- Abschnittsüberschrift "Planungshorizont"
        +-- Label: "Planungshorizont (Kalenderwochen)"
        +-- Input  [shadcn — type="number", min=1, max=52]
        +-- Hilfstext: "Anzahl der Kalenderwochen…"
        +-- Fehlermeldung  (konditionell — nur bei ungültiger Eingabe)
+-- Toaster  [shadcn — für Erfolgs-/Fehlermeldungen]
```

### Datenmodell

**Neue Tabelle `grundeinstellungen`:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primärschlüssel |
| `user_id` | UUID FK → auth.users | Dateneigentümer — UNIQUE, ON DELETE CASCADE |
| `planungshorizont_wochen` | Integer (1–52) | Anzahl der zu planenden Kalenderwochen, Default 13 |

- UNIQUE-Constraint auf `user_id` — genau ein Eintrag pro Nutzer
- RLS: Nutzer sieht und schreibt ausschließlich eigenen Eintrag

### Datenfluss

```
Seite öffnet sich
  → Hook lädt GET /api/grundeinstellungen
  → Kein Eintrag in DB → Standardwert 13 wird angezeigt (kein DB-Insert)
  → Eintrag vorhanden → gespeicherter Wert wird angezeigt

Nutzer ändert Wert im Eingabefeld
  → Lokale Validierung prüft: ganze Zahl? Zwischen 1 und 52?
  → Ungültig → Fehlermeldung unter Feld, kein API-Aufruf
  → Gültig + onBlur → Optimistisches Update + PUT /api/grundeinstellungen
  → API-Erfolg → Toast "Einstellung gespeichert."
  → API-Fehler → Toast "Einstellung konnte nicht gespeichert werden.", Rollback auf vorherigen Wert
```

### API-Endpunkte

```
GET  /api/grundeinstellungen
  → Eingeloggter Nutzer wird identifiziert (requireAuth)
  → Kein DB-Eintrag → gibt { planungshorizont_wochen: 13 } zurück (Fallback, kein Insert)
  → DB-Eintrag vorhanden → gibt { planungshorizont_wochen: <Wert> } zurück

PUT  /api/grundeinstellungen
  → Upsert per user_id (anlegen oder aktualisieren)
  → Body: { planungshorizont_wochen: number }
  → Zod-Validierung: ganze Zahl, min 1, max 52
  → Fehler: HTTP 400 wenn Wert ungültig
```

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/grundeinstellungen/page.tsx` | Neue Seite (Client Component mit NavSheet + Header-Struktur analog allen anderen Einstellungsseiten) |
| `src/components/grundeinstellungen-formular.tsx` | Hauptkomponente: Eingabefeld, lokale Validierung, Auto-Save mit Rollback |
| `src/hooks/use-grundeinstellungen.ts` | State-Management: Laden, Upsert, optimistisches Update, Rollback |
| `src/app/api/grundeinstellungen/route.ts` | GET + PUT (Upsert) mit Zod + requireAuth() |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | `KURZFRISTIGE_PLANUNG_NAV_GROUPS`: Eintrag „Grundeinstellungen" → `/dashboard/kurzfristige-planung/grundeinstellungen` ergänzen |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Neue Kachel „Grundeinstellungen" im Kachelraster ergänzen |

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Komponentenstruktur | Einzelnes Formular (keine Tabs) | Kein Plattform- oder Produktbezug — eine globale Einstellung pro Nutzer |
| Speichern | Auto-Save bei onBlur | Einheitlich mit allen anderen Einstellungsseiten im Projekt |
| Erweiterbarkeit | Card-Container je Einstellungsabschnitt | Neue Grundeinstellungen können als weitere Cards darunter ergänzt werden |
| Neue Packages | Keine | Input, Label, Toast — alles bereits in shadcn/ui installiert |

## Implementation Notes (Frontend — 2026-06-03)

### Neue Dateien
- `src/hooks/use-grundeinstellungen.ts` — Hook mit `useGrundeinstellungen()`: Laden per GET, Upsert per PUT mit optimistischem Update und Rollback; Konstante `DEFAULT_PLANUNGSHORIZONT = 13`
- `src/components/grundeinstellungen-formular.tsx` — Formular mit Input (type="number", min=1, max=52), lokaler Validierung (ganze Zahl, Wertebereich), Auto-Save bei onBlur, Toast-Rückmeldung und Rollback bei API-Fehler
- `src/app/dashboard/kurzfristige-planung/grundeinstellungen/page.tsx` — Client Component, Header + GrundeinstellungenFormular + Toaster (identische Struktur wie alle anderen Einstellungsseiten)

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — Eintrag „Grundeinstellungen" → `/dashboard/kurzfristige-planung/grundeinstellungen` in `KURZFRISTIGE_PLANUNG_NAV_GROUPS` ergänzt
- `src/app/dashboard/kurzfristige-planung/page.tsx` — Kachel „Grundeinstellungen" im Kachelraster ergänzt

### Build
- `npm run build` ✅ — Route `/dashboard/kurzfristige-planung/grundeinstellungen` korrekt in der Build-Ausgabe

## Implementation Notes (Backend — 2026-06-03)

### Datenbankmigrierung
- Migration `proj50_grundeinstellungen` erfolgreich auf Supabase-Projekt `kdmpghtdoguppfqhdscq` angewendet
- Tabelle `grundeinstellungen` angelegt mit: UUID-PK, FK zu `auth.users` (ON DELETE CASCADE), INTEGER CHECK (1–52), UNIQUE-Constraint auf `user_id`
- RLS aktiviert mit 4 Policies: SELECT/INSERT/UPDATE/DELETE — jeder Nutzer sieht und schreibt nur eigenen Eintrag

### API-Routen
- `GET /api/grundeinstellungen` — lädt den Eintrag des eingeloggten Nutzers via `.maybeSingle()`; gibt `{ planungshorizont_wochen: 13 }` zurück wenn noch kein Eintrag vorhanden (Fallback-Default, kein DB-Insert)
- `PUT /api/grundeinstellungen` — Upsert via Supabase `onConflict: 'user_id'`; Zod-Schema validiert: ganze Zahl, min 1, max 52

### Tests
- `src/app/api/grundeinstellungen/route.test.ts` — 14 Tests (Vitest): 4 für GET, 10 für PUT
- Alle 14 Tests bestehen ✅

## QA Test Results (2026-06-03)

### Testergebnis-Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| Akzeptanzkriterien | ⚠️ 17/18 bestanden (1 absichtlich entfernt) |
| Unit-Tests Hooks (Vitest) | ✅ 10/10 bestanden |
| API-Integrationstests (Vitest) | ✅ 14/14 bestanden |
| E2E-Tests (Playwright) | ✅ 10/10 bestanden |
| Sicherheitsaudit | ✅ Keine Findings |
| Regression | ✅ Keine Regressionen |
| Bugs gefunden | ⚠️ 1 Medium-Bug |

### Akzeptanzkriterien — Manuell geprüft

**Navigation & Einstieg**
- ✅ Linke Navigation im Bereich „Kurzfristige Planung" zeigt „Grundeinstellungen"
- ✅ Kachel „Grundeinstellungen" auf der Dashboard-Übersichtsseite vorhanden
- ✅ Auth-Guard: Weiterleitung zu /login für unauthentifizierte Nutzer (E2E bestätigt)

**Einstellungsformular**
- ⚪ ~~Hilfstext „Anzahl der Kalenderwochen…"~~ — **absichtlich entfernt** auf Nutzeranforderung
- ✅ Eingabefeld mit Label „Planungshorizont (Kalenderwochen)" vorhanden
- ✅ Eingabefeld akzeptiert nur Zahlen (type="number")
- ✅ Sichtbarer Gültigkeitsbereich min=1, max=52 gesetzt
- ✅ Standardwert 13 bei erstem Aufruf (API gibt Default zurück wenn kein Eintrag)
- ✅ Auto-Save bei onBlur (kein Speichern-Button)
- ✅ Toast „Einstellung gespeichert." bei Erfolg

**Validierung**
- ⚠️ Fehlermeldung bei Wert < 1 oder > 52 — **Bug (Medium)**: Meldung wird nicht angezeigt, Feld rollt lautlos zurück (siehe Bug #1)
- ⚠️ Fehlermeldung bei Dezimalzahl/leer — **Bug (Medium)**: gleicher Defekt
- ✅ Kein API-Aufruf bei ungültigem Wert
- ✅ DB-Wert bleibt bei ungültiger Eingabe unverändert

**Datenpersistenz**
- ✅ Einstellung wird pro Nutzer gespeichert
- ✅ Standardwert 13 bei fehlendem DB-Eintrag (kein Insert)
- ✅ Gespeicherter Wert beim nächsten Aufruf vorbelegt
- ✅ Optimistisches Update: Änderung sofort sichtbar
- ✅ Rollback auf vorherigen Wert bei API-Fehler

**Datenbankschema**
- ✅ Tabelle `grundeinstellungen` mit korrektem Schema und RLS

**API-Routen**
- ✅ `GET /api/grundeinstellungen` gibt Default 13 zurück wenn kein Eintrag
- ✅ `PUT /api/grundeinstellungen` Upsert mit Zod-Validierung
- ✅ HTTP 400 bei ungültigem Wert
- ✅ `requireAuth()` in beiden Routen

### Bugs gefunden

#### Bug #1 — Medium: Validierungsfehlermeldung wird nicht angezeigt

**Betroffene Datei:** `src/components/grundeinstellungen-formular.tsx`, Zeilen 39–41

**Ursache:** In `handleBlur` werden `setValidationError(result.message)` und `setValidationError(null)` im selben synchronen Block aufgerufen. React 18 batcht alle State-Updates in einer Handler-Funktion zusammen; die letzte `setValidationError(null)`-Anweisung überschreibt die Fehlermeldung — die Meldung wird nie gerendert.

**Schritte zur Reproduktion:**
1. Seite `/dashboard/kurzfristige-planung/grundeinstellungen` öffnen
2. Wert auf `100` setzen (außerhalb 1–52)
3. Aus dem Feld klicken (onBlur)
4. **Erwartet:** Fehlermeldung „Bitte einen Wert zwischen 1 und 52 eingeben." erscheint
5. **Tatsächlich:** Feld setzt lautlos auf den gespeicherten Wert zurück, keine Fehlermeldung

**Fix:** `setValidationError(null)` in der `!result.valid`-Verzweigung von `handleBlur` entfernen (Zeile 41).

### Automatisierte Tests

**Hook-Unit-Tests (Vitest) — 10 Tests** `src/hooks/use-grundeinstellungen.test.ts`
- `DEFAULT_PLANUNGSHORIZONT`: 1 Test
- Initial Load: 5 Tests (Ladezustand, Erfolg, Default, Fehler, Netzwerkfehler)
- `save` / Rollback: 4 Tests (optimistisches Update, Erfolg, Rollback, Fehler-Throw)

**API-Integrationstests (Vitest) — 14 Tests** `src/app/api/grundeinstellungen/route.test.ts`
- GET: 4 Tests (Default, gespeicherter Wert, 401, 500)
- PUT: 10 Tests (gültig, Grenzwerte 1 und 52, ungültige Werte 0/53/Dezimal, fehlendes Feld, kein JSON, 401, 500)

**E2E-Tests (Playwright) — 10 Tests** `tests/PROJ-50-grundeinstellungen.spec.ts`
- Seitenexistenz (kein 404): 2 Tests (Chromium + Mobile Safari)
- Auth-Guard: 2 Tests
- Regression Kurzfristige Planung Landing: 2 Tests
- Regression andere Einstellungsseiten: 4 Tests

### Sicherheitsaudit

- ✅ Auth via `requireAuth()` in GET und PUT
- ✅ RLS-Policies: Nutzer sieht/schreibt ausschließlich eigenen Eintrag
- ✅ Alle Inputs per Zod validiert (Integer, min 1, max 52)
- ✅ Kein XSS-Risiko: Eingaben werden als Number-Werte behandelt
- ✅ ON DELETE CASCADE: Eintrag wird automatisch bereinigt wenn Nutzer gelöscht

### Produktionsbereitschaft

**⚠️ FAST PRODUCTION-READY** — 1 Medium-Bug (Validierungsfehlermeldung wird nicht angezeigt). Kernfunktionalität (Speichern, Rollback, Auth) funktioniert korrekt. Nach Fix des Bugs ist das Feature bereit für Deployment.

## Deployment
_To be added by /deploy_
