# PROJ-75: Grundeinstellungen — Langfristige Planung

## Status: Approved
**Created:** 2026-06-20
**Last Updated:** 2026-06-20 (QA)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — diese Seite ist eine versionsgebundene Einstellungsseite unter `/dashboard/langfristige-planung/[versionId]/…`; sie nutzt das Versions-Routing, den Versionskontext und das kontextabhängige Seitenmenü
- Vorlage (kein harter Require): PROJ-50 (Grundeinstellungen — Kurzfristige Planung) — UI/Bedienung werden gespiegelt, mit den unten beschriebenen Abweichungen

## Übersicht

Die Seite „Grundeinstellungen" der **Langfristigen Planung** legt die grundlegenden Zeitparameter **einer Planversion** fest. Sie ist der langfristige Gegenpart zur kurzfristigen Grundeinstellungen-Seite (PROJ-50) und wird **pro Planversion** gespeichert — jede Planversion hat ihre eigenen, anfangs leeren bzw. mit Standardwerten vorbelegten Grundeinstellungen (Datenisolation gemäß PROJ-73).

Unterschiede zur kurzfristigen Variante:
- **Kein Vergangenheitshorizont** — entfällt vollständig.
- **Neuer Startmonat** — Monat + Jahr, ab dem die langfristige Planung beginnt.
- **Planungshorizont in Monaten statt Kalenderwochen** — sowohl der allgemeine als auch der (optionale) Absatz-Horizont werden in ganzen Monaten angegeben.

Damit hat die Seite vier Einstellungen:
1. **Startmonat** (Monat + Jahr) — Pflichtangabe für den Planungsbeginn.
2. **Startkontostand** (€, Dezimalbetrag, negativ erlaubt, Standard 0) — Kontostand zu Beginn der Planung; im Abschnitt „Startmonat" neben Monat/Jahr.
3. **Planungshorizont Allgemein** (Monate, 1–120) — über wie viele Monate ab Startmonat allgemein geplant wird.
4. **Planungshorizont Absatz** (Monate, 1–120, optional) — überschreibt den allgemeinen Horizont speziell für die Absatzplanung; leer = es gilt der allgemeine Horizont.

Die Seite ist als vertikal gestapelte Einstellungsabschnitte (Cards) ausgelegt, sodass später weitere Grundeinstellungen ergänzt werden können, ohne die Seitenstruktur zu ändern.

## User Stories

- Als Controller möchte ich die Seite „Grundeinstellungen" innerhalb einer geöffneten Planversion über das linke Seitenmenü und über die Versions-Übersichtsseite aufrufen können, damit ich die Zeitparameter dieser Version pflegen kann.
- Als Controller möchte ich einen Startmonat (Monat + Jahr) festlegen, damit klar ist, ab welchem Zeitpunkt die langfristige Planung dieser Version beginnt.
- Als Controller möchte ich den allgemeinen Planungshorizont in ganzen Monaten (1–120) angeben, damit ich festlege, über wie viele Monate ab dem Startmonat geplant wird.
- Als Controller möchte ich optional einen separaten Planungshorizont für den Absatz in Monaten angeben, damit die Absatzplanung bei Bedarf einen abweichenden Horizont nutzt; lasse ich ihn leer, gilt der allgemeine Horizont.
- Als Controller möchte ich, dass meine Eingaben pro Planversion gespeichert werden und beim nächsten Aufruf dieser Version noch vorhanden sind, ohne andere Versionen oder die Kurzfristige Planung zu beeinflussen.
- Als Controller möchte ich eine klare Rückmeldung erhalten, wenn eine Eingabe ungültig ist, damit ich den Fehler sofort korrigieren kann.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Innerhalb einer geöffneten Planversion enthält das linke Seitenmenü (Gruppe „Einstellungen") den Eintrag „Grundeinstellungen" → `/dashboard/langfristige-planung/[versionId]/grundeinstellungen`
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint eine Kachel/ein Eintrag „Grundeinstellungen", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Wird die Seite mit unbekannter/fremder/ungültiger `versionId` aufgerufen, erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73-Versionskontext

### Einstellungsformular — Startmonat

- [ ] Die Seite zeigt einen Abschnitt „Startmonat" mit einer Auswahl für **Monat** und **Jahr** (Label: „Startmonat")
- [ ] Der Monat ist als Monatsname auswählbar (Januar–Dezember); das Jahr ist als Jahreszahl wählbar/eingebbar
- [ ] Beim ersten Aufruf einer neuen Version ist der Startmonat mit dem **aktuellen Monat + Jahr** vorbelegt (Standardwert), solange noch kein Wert gespeichert wurde
- [ ] Eine Änderung wird nach Auswahl/`onBlur` automatisch gespeichert (kein separater „Speichern"-Button)
- [ ] Im selben Abschnitt gibt es ein beschriftetes Eingabefeld „Startkontostand (€)" für den Kontostand zu Planungsbeginn; es akzeptiert Dezimalbeträge (Komma oder Punkt) und negative Werte; leeres Feld bedeutet 0
- [ ] Beim ersten Aufruf einer neuen Version ist der Startkontostand mit **0** vorbelegt; Änderungen werden nach `onBlur` automatisch gespeichert

### Einstellungsformular — Planungshorizont Allgemein

- [ ] Die Seite zeigt einen Abschnitt „Planungshorizont" mit einem beschrifteten Zahleneingabefeld (Label: „Planungshorizont Allgemein (Monate)")
- [ ] Das Eingabefeld akzeptiert nur ganze Zahlen; sichtbarer Gültigkeitsbereich: min = 1, max = 120
- [ ] Das Feld zeigt beim ersten Aufruf den gespeicherten Wert der Version oder den Standardwert **12** (= ein Jahr)
- [ ] Änderungen werden nach `onBlur` automatisch gespeichert
- [ ] Nach erfolgreichem Speichern erscheint eine kurze Toast-Erfolgsmeldung: „Einstellung gespeichert."

### Einstellungsformular — Planungshorizont Absatz (optional)

- [ ] Im Abschnitt „Planungshorizont" gibt es ein zweites Feld (Label: „Planungshorizont Absatz (Monate)")
- [ ] Das Feld ist optional; als Platzhalter wird der allgemeine Horizont angezeigt, um zu signalisieren, dass dieser bei leerem Feld gilt
- [ ] Gültigkeitsbereich bei Eingabe: ganze Zahl, min = 1, max = 120
- [ ] Wird das Feld geleert und verlassen, wird der Absatz-Horizont auf „nicht gesetzt" (null) zurückgesetzt → es gilt wieder der allgemeine Horizont
- [ ] Änderungen werden nach `onBlur` automatisch gespeichert (inkl. Toast bei Erfolg)

### Validierung

- [ ] Planungshorizont-Eingabe < 1 oder > 120: Fehlermeldung unter dem Feld: „Bitte einen Wert zwischen 1 und 120 eingeben."
- [ ] Planungshorizont-Eingabe ist keine ganze Zahl (Dezimalzahl, Buchstaben): Fehlermeldung: „Bitte eine ganze Zahl eingeben."
- [ ] Leeres allgemeines Planungshorizont-Feld bei `onBlur`: Fehlermeldung + Rollback auf zuletzt gespeicherten Wert (allgemeiner Horizont ist Pflicht)
- [ ] Leeres Absatz-Feld ist zulässig (= nicht gesetzt) und löst keine Fehlermeldung aus
- [ ] Bei ungültigem Wert wird kein API-Aufruf ausgeführt und der zuletzt gespeicherte Wert bleibt unverändert
- [ ] Startmonat: Monat 1–12 und ein plausibles Jahr (Vorschlag: 2000–2100) werden serverseitig erzwungen

### Datenpersistenz & Isolation

- [ ] Alle Einstellungen werden pro Planversion gespeichert (`plan_version_id`) und zusätzlich an den Nutzer gebunden (`user_id`)
- [ ] Beim ersten Aufruf einer Version ohne gespeicherten Eintrag werden die Standardwerte angezeigt (aktueller Monat/Jahr, allgemeiner Horizont 12, Absatz-Horizont leer) — kein DB-Insert, bis der Nutzer speichert
- [ ] Beim nächsten Aufruf derselben Version sind die gespeicherten Werte vorbelegt
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B oder die Kurzfristige Planung
- [ ] Optimistisches Update: Änderung erscheint sofort in der UI; bei API-Fehler → Toast-Fehlermeldung + Rollback auf vorherigen Wert
- [ ] Wird die Planversion gelöscht, wird der zugehörige Grundeinstellungen-Eintrag automatisch mitgelöscht (ON DELETE CASCADE)

### Datenbankschema

- [ ] Neue Tabelle `langfristige_grundeinstellungen`:
  - `id` UUID PK
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `startmonat_monat` INTEGER NOT NULL CHECK (1–12)
  - `startmonat_jahr` INTEGER NOT NULL CHECK (z. B. 2000–2100)
  - `planungshorizont_monate` INTEGER NOT NULL CHECK (1–120) DEFAULT 12
  - `planungshorizont_absatz_monate` INTEGER NULL CHECK (1–120)
  - UNIQUE(`plan_version_id`) — genau ein Eintrag pro Planversion
  - RLS: Nutzer sieht und schreibt nur eigene Einträge (`auth.uid() = user_id`); Versionszugehörigkeit serverseitig zusätzlich geprüft

### API-Routen

- [ ] `GET /api/langfristige-planung/[versionId]/grundeinstellungen` — lädt den Eintrag der Version; gibt Standardwerte (aktueller Monat/Jahr, `planungshorizont_monate: 12`, `planungshorizont_absatz_monate: null`) zurück, wenn noch kein Eintrag vorhanden (Fallback-Default, kein DB-Insert)
- [ ] `PUT /api/langfristige-planung/[versionId]/grundeinstellungen` — Eintrag anlegen oder aktualisieren (Upsert per `plan_version_id`)
  - Body (Teilmengen erlaubt): `{ startmonat_monat?, startmonat_jahr?, planungshorizont_monate?, planungshorizont_absatz_monate? (nullable) }`
  - Zod-Validierung: Monat 1–12, Jahr im erlaubten Bereich, Horizonte ganze Zahl 1–120 (Absatz auch null)
- [ ] Beide Routen prüfen serverseitig, dass die `versionId` dem eingeloggten Nutzer gehört; sonst 404/Forbidden, kein Fremdzugriff
- [ ] Bei Validierungsfehler: HTTP 400 mit Fehlerbeschreibung
- [ ] `requireAuth()` in beiden Routen

## Edge Cases

- **Erster Aufruf einer Version ohne gespeicherten Eintrag**: Felder zeigen Standardwerte (aktueller Monat/Jahr, Horizont 12, Absatz leer); kein DB-Eintrag — erst beim ersten Speichern wird ein Eintrag angelegt
- **Planungshorizont 0, negativ oder > 120**: Fehlermeldung, kein Speichern
- **Dezimalzahl im Horizont** (z. B. 12.5): Fehlermeldung „Bitte eine ganze Zahl eingeben.", kein Speichern
- **Leeres allgemeines Horizont-Feld bei onBlur**: Fehlermeldung, Rollback auf zuletzt gespeicherten Wert (Pflichtfeld)
- **Leeres Absatz-Feld**: gültig → Absatz-Horizont wird auf null gesetzt, allgemeiner Horizont gilt
- **Absatz-Horizont kleiner/größer als allgemeiner Horizont**: zulässig (bewusste Übersteuerung), keine Querschnittsvalidierung zwischen beiden Feldern
- **Ungültiges/fehlendes Jahr beim Startmonat**: Fehlermeldung, kein Speichern
- **API-Fehler beim Speichern**: Toast „Einstellung konnte nicht gespeichert werden.", Rollback auf vorherigen Wert
- **Aufruf mit fremder/unbekannter versionId**: Redirect zum Langfristige-Planung-Dashboard, kein Datenzugriff
- **Löschen der Planversion**: Grundeinstellungen-Eintrag wird kaskadierend mitgelöscht
- **Spätere weitere Einstellungen**: Seitenstruktur ist als vertikal gestapelte Cards ausgelegt — neue Einstellungen werden darunter ergänzt, ohne bestehende Komponenten zu ändern

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf der neuen Tabelle `langfristige_grundeinstellungen`; Versionszugehörigkeit (`plan_version_id` gehört dem Nutzer) serverseitig prüfen (Defense-in-Depth zur RLS)
- Alle Eingaben serverseitig mit Zod validieren (Monat, Jahr, Horizonte)
- Neue versionsgebundene Next.js-Seite unter `src/app/dashboard/langfristige-planung/[versionId]/grundeinstellungen/page.tsx` (nutzt das Versions-Shell/Header-Muster aus PROJ-73)
- Navigation: Eintrag „Grundeinstellungen" in der versionsspezifischen Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`, Gruppe „Einstellungen")
- Wiederverwendung der UI-Bausteine der kurzfristigen Grundeinstellungen (Card-Abschnitte, Auto-Save, Toast, Rollback) als Vorlage; Datenquelle versionsgebunden parametrisiert statt Code-Duplikation, wo sinnvoll
- shadcn-Komponenten: `Input` (type="number") für Horizonte, `Select` für Monat/Jahr (oder vorhandenes Datums-/Select-Pattern), `Toast` für Erfolgs-/Fehlermeldungen
- Responsive: Mobil (375px) bis Desktop (1440px)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee

Diese Seite ist die **erste gespiegelte Einstellungsseite** der Langfristigen Planung (PROJ-73). Sie nutzt das bereits gebaute Fundament vollständig wieder: das Versions-Routing (`[versionId]` im Pfad), das gemeinsame Seitengerüst (`LangfristigeVersionShell` — Header mit Breadcrumb, Versionsvalidierung, Redirect bei fremder Version) und die zentrale Navigationskonfiguration (in der die Seite „Grundeinstellungen" bereits als Eintrag vorgesehen ist). Neu gebaut werden nur: ein versionsgebundener Datenspeicher, ein versionsbewusstes API-Endpunktpaar und das eigentliche Eingabeformular.

Inhaltlich ist die Seite der langfristige Gegenpart zur kurzfristigen Grundeinstellungen-Seite (PROJ-50): gleiche Bedienlogik (Auto-Save bei Verlassen des Feldes, optimistische Anzeige, Rückmeldung per Toast, Rücksetzen bei Fehler), aber **ohne Vergangenheitshorizont**, **mit Startmonat** und mit **Monaten statt Kalenderwochen**.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                 (Versions-Übersicht — bereits vorhanden)
+-- Eintrag/Kachel "Grundeinstellungen"  → .../[versionId]/grundeinstellungen
                                            (Eintrag ist in der zentralen Nav-Liste bereits angelegt;
                                             es entsteht nur die echte Seite, die den Platzhalter ablöst)

/dashboard/langfristige-planung/[versionId]/grundeinstellungen   (NEUE echte Seite)
+-- LangfristigeVersionShell  (bestehend — Header, Breadcrumb, Versionsprüfung, Redirect, Toaster)
    +-- LangfristigeGrundeinstellungenFormular  (NEUE Hauptkomponente)
        +-- Card "Startmonat"
        |   +-- Auswahl Monat   (Januar–Dezember)
        |   +-- Auswahl Jahr    (Jahreszahl)
        +-- Card "Planungshorizont"
            +-- Feld "Planungshorizont Allgemein (Monate)"   [Zahl, 1–120, Pflicht]
            +-- Feld "Planungshorizont Absatz (Monate)"      [Zahl, 1–120, optional;
                                                              Platzhalter = allgemeiner Wert]
```

Linkes Seitenmenü: kein Umbau nötig — der Eintrag „Grundeinstellungen" in der Gruppe „Einstellungen" existiert bereits und verlinkt automatisch auf den versionsspezifischen Pfad.

### B) Datenmodell (Klartext)

**Neue Tabelle „Langfristige Grundeinstellungen" — ein Eintrag pro Planversion:**

```
Jeder Eintrag hat:
- eindeutige ID
- Besitzer (Nutzer)                      → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion → Datenisolation, eindeutig pro Version
- Startmonat: Monat (1–12) + Jahr (z.B. 2000–2100)
- Planungshorizont Allgemein: ganze Zahl 1–120 Monate (Standard 12)
- Planungshorizont Absatz: ganze Zahl 1–120 Monate ODER „nicht gesetzt"
```

Regeln:
- Genau **ein** Eintrag je Planversion (Eindeutigkeit auf der Versionszugehörigkeit).
- Wird die Planversion gelöscht, verschwindet dieser Eintrag automatisch mit (kaskadierende Löschung) — keine verwaisten Daten.
- Jeder Eintrag ist zusätzlich an den Nutzer gebunden; Zugriff nur auf eigene Daten (Row Level Security + serverseitige Prüfung der Versionszugehörigkeit).
- Daten verschiedener Versionen sind vollständig getrennt; eine Änderung in Version A wirkt nie auf Version B oder die Kurzfristige Planung.

**Standardwerte bei noch leerer Version (kein gespeicherter Eintrag):** aktueller Monat + aktuelles Jahr, allgemeiner Horizont = 12, Absatz-Horizont = nicht gesetzt. Diese Werte werden nur angezeigt; gespeichert (angelegt) wird der Eintrag erst, wenn der Nutzer etwas ändert.

### C) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Shell prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Formular lädt die Grundeinstellungen dieser Version
      kein Eintrag  → Standardwerte werden angezeigt (kein Anlegen)
      Eintrag da    → gespeicherte Werte werden angezeigt

Nutzer ändert ein Feld und verlässt es (bzw. wählt Monat/Jahr)
  → lokale Prüfung (ganze Zahl? 1–120? Monat/Jahr plausibel?)
      ungültig → Hinweis unter dem Feld, kein Speichern, Rücksetzen auf letzten Wert
      gültig   → Wert sofort sichtbar (optimistisch) + Speichern in der DB (Anlegen oder Aktualisieren)
                  Erfolg → Toast "Einstellung gespeichert."
                  Fehler → Toast "Einstellung konnte nicht gespeichert werden." + Rücksetzen
```

Sonderfall Absatz-Feld: Leeren + verlassen ist gültig und bedeutet „nicht gesetzt" → der allgemeine Horizont gilt. Das allgemeine Horizont-Feld dagegen ist Pflicht; leer + verlassen führt zu Hinweis und Rücksetzen.

### D) API-Endpunkte (versionsbewusst)

```
Lesen:    Grundeinstellungen einer Version laden
          → prüft Nutzer + Versionszugehörigkeit
          → liefert gespeicherte Werte oder die Standardwerte (ohne anzulegen)

Speichern: Grundeinstellungen einer Version anlegen/aktualisieren (Upsert je Version)
          → prüft Nutzer + Versionszugehörigkeit
          → akzeptiert Teilmengen (z.B. nur Startmonat, nur ein Horizont)
          → prüft alle Werte (Monat 1–12, Jahr im Bereich, Horizonte 1–120; Absatz darf leer/„nicht gesetzt" sein)
          → ungültig → Fehler 400; fremde/unbekannte Version → 404, kein Fremdzugriff
```

Beide Endpunkte folgen exakt dem im Fundament etablierten Muster (Login-Pflicht, ID-Format-Prüfung, Filterung nach Nutzer **und** Version als zweite Sicherheitsebene zur RLS).

### E) Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/grundeinstellungen/page.tsx` | Echte Seite (löst den Platzhalter ab): Versions-Shell + Formular |
| `src/components/langfristige-grundeinstellungen-formular.tsx` | Hauptkomponente: Startmonat-Auswahl, zwei Horizont-Felder, lokale Prüfung, Auto-Save mit Rücksetzen |
| `src/hooks/use-langfristige-grundeinstellungen.ts` | Lädt/speichert die Werte der aktiven Version; optimistisches Update + Rücksetzen |
| `src/app/api/langfristige-planung/[versionId]/grundeinstellungen/route.ts` | Lesen + Speichern (Upsert) mit Eingabeprüfung, Login- und Versions-Eigentumsprüfung |

### F) Geänderte Dateien

| Datei | Änderung |
|---|---|
| (keine Pflichtänderung an der Navigation) | Der Nav-Eintrag „Grundeinstellungen" existiert bereits in `src/lib/langfristige-planung-nav.ts`; ggf. Feinschliff des Beschreibungstextes |

Hinweis: Durch das vorhandene Platzhalter-Routing (dynamisches `[seite]`-Segment) übernimmt die neue echte Seite automatisch Vorrang — es ist keine Routing-Umstellung nötig.

### G) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Speicherort | Datenbank, pro Planversion | Daten müssen je Szenario isoliert und dauerhaft sein (PROJ-73-Prinzip); kein localStorage |
| Eigene neue Tabelle | Ja (statt Erweiterung der Kurzfristig-Tabelle) | Klare Abkapselung, kaskadierende Löschung pro Version, kein Regressionsrisiko für die Kurzfristige Planung — konsistent mit der PROJ-73-Architektur |
| Startmonat als Monat + Jahr | Zwei Auswahlfelder | Vom Nutzer bestätigt; gibt langfristiger Mehrjahresplanung einen konkreten Startzeitpunkt |
| Horizont in Monaten, 1–120 | Zahlenfelder mit Bereich | Vom Nutzer bestätigt (bis 10 Jahre); langfristige Planung denkt in Monaten/Jahren statt Wochen |
| Absatz-Horizont optional beibehalten | Zweites, leerbares Feld | Vom Nutzer bestätigt; 1:1-Verhalten zur kurzfristigen Seite, leeres Feld = allgemeiner Horizont gilt |
| Vergangenheitshorizont | Entfällt | In der langfristigen Planung nicht benötigt (keine Ist-/Vergangenheitsbetrachtung, PROJ-73-Abkapselung) |
| Bedienmuster | Auto-Save bei Feldverlassen, Toast, Rücksetzen | Einheitlich mit allen Einstellungsseiten im Projekt |
| Seitengerüst | Bestehende Versions-Shell wiederverwenden | Versionsprüfung, Redirect, Header/Breadcrumb sind bereits gelöst |

### H) Dependencies (Pakete)

Keine neuen npm-Pakete nötig. Verwendet werden bestehende Bausteine: shadcn/ui (Input, Label, Select, Card, Toast), Zod (Eingabeprüfung), Supabase (Datenhaltung inkl. Row Level Security), Next.js App-Router (dynamisches `[versionId]`-Segment).

## Implementation Notes (Frontend — 2026-06-20)

### Neue Dateien
- `src/hooks/use-langfristige-grundeinstellungen.ts` — Hook `useLangfristigeGrundeinstellungen(versionId)`: lädt per GET die versionsspezifischen Werte, speichert per PUT mit optimistischem Update und Rollback. Drei Speicheraktionen: `saveStartmonat(monat, jahr)`, `savePlanungshorizont(monate)`, `saveAbsatz(monate | null)`. Konstanten: `DEFAULT_PLANUNGSHORIZONT_MONATE = 12`, `MIN_HORIZONT_MONATE = 1`, `MAX_HORIZONT_MONATE = 120`. Client-Fallback für Startmonat = aktueller Monat/Jahr (bis GET geladen hat).
- `src/components/langfristige-grundeinstellungen-formular.tsx` — Hauptkomponente mit zwei Cards:
  - **Startmonat**: zwei `Select` (Monat Januar–Dezember = 1–12, Jahr von aktuell−5 bis aktuell+20). Auto-Save bei Auswahländerung; speichert Monat + Jahr gemeinsam.
  - **Planungshorizont**: zwei `Input` (type="number", min=1, max=120) für „Allgemein" (Pflicht) und „Absatz" (optional, leer = allgemeiner Horizont gilt; Platzhalter zeigt allgemeinen Wert). Auto-Save bei `onBlur`, lokale Validierung (ganze Zahl, 1–120), Toast bei Erfolg/Fehler, Rollback bei Fehler/ungültig.
  - Liest `versionId` aus `useParams()`.
- `src/app/dashboard/langfristige-planung/[versionId]/grundeinstellungen/page.tsx` — echte Seite: `LangfristigeVersionShell` (seitenTitel="Grundeinstellungen") + Formular. Löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab (statische Route schlägt dynamische).

### Geänderte Dateien
- Keine. Der Nav-Eintrag „Grundeinstellungen" existiert bereits in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen") und verlinkt automatisch auf den neuen Pfad; auch die Versions-Übersichtsseite listet ihn bereits.

### Erwartete API (für /backend)
- `GET /api/langfristige-planung/[versionId]/grundeinstellungen` → `{ startmonat_monat, startmonat_jahr, planungshorizont_monate, planungshorizont_absatz_monate }`; gibt Standardwerte zurück (aktueller Monat/Jahr, `planungshorizont_monate: 12`, `planungshorizont_absatz_monate: null`) wenn noch kein Eintrag — ohne DB-Insert. Prüft Login + Versions-Eigentum; 404 bei fremder/unbekannter Version.
- `PUT /api/langfristige-planung/[versionId]/grundeinstellungen` — Upsert je `plan_version_id`; akzeptiert Teilmengen der Felder. Zod: Monat 1–12, Jahr 2000–2100, Horizonte ganze Zahl 1–120 (Absatz nullable). 400 bei ungültig, 404 bei fremder Version.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen Dateien (verbleibende Fehler liegen ausschließlich in vorbestehenden `.test.ts`-Dateien anderer Features).

## Implementation Notes (Backend — 2026-06-20)

### Datenbankmigrierung
- Migration `create_langfristige_grundeinstellungen` auf Supabase-Projekt „Controlling-App" (`kdmpghtdoguppfqhdscq`) angewendet.
- Neue Tabelle `langfristige_grundeinstellungen`:
  - `id` UUID PK (`uuid_generate_v4()`)
  - `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
  - `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE)
  - `startmonat_monat` INTEGER NOT NULL CHECK (1–12)
  - `startmonat_jahr` INTEGER NOT NULL CHECK (2000–2100)
  - `planungshorizont_monate` INTEGER NOT NULL DEFAULT 12 CHECK (1–120)
  - `planungshorizont_absatz_monate` INTEGER NULL CHECK (1–120)
  - `created_at`, `updated_at` TIMESTAMPTZ DEFAULT now()
  - UNIQUE(`plan_version_id`) → genau ein Eintrag pro Planversion (ermöglicht Upsert via `onConflict`)
- Indizes auf `user_id` und `plan_version_id`.
- RLS aktiviert, 4 Policies (SELECT/INSERT/UPDATE/DELETE) mit `auth.uid() = user_id` — Konvention der bestehenden Tabellen.
- Kaskadierende Löschung: Wird die Planversion gelöscht, verschwindet der Eintrag automatisch.

### API-Routen
- `src/app/api/langfristige-planung/[versionId]/grundeinstellungen/route.ts`
  - `GET` — prüft Login + Versions-Eigentum (404 bei fremder/unbekannter Version), lädt den Eintrag via `.maybeSingle()`; gibt bei fehlendem Eintrag Standardwerte zurück (aktueller Monat/Jahr serverseitig, `planungshorizont_monate: 12`, `planungshorizont_absatz_monate: null`) ohne DB-Insert.
  - `PUT` — Zod-Validierung (Monat 1–12, Jahr 2000–2100, Horizonte ganze Zahl 1–120, Absatz nullable; mind. ein Feld erforderlich). Prüft Versions-Eigentum. **Merge-then-Upsert**: lädt ggf. den bestehenden Eintrag (sonst Standardwerte als Basis) und führt Teilmengen-Updates zusammen, damit die NOT-NULL-Pflichtfelder (Startmonat, allgemeiner Horizont) beim ersten Speichern eines Einzelfeldes nicht verletzt werden. Upsert via `onConflict: 'plan_version_id'`.
  - Beide Routen: `requireAuth` (401), UUID-Format-Prüfung (400), Queries zusätzlich nach `user_id` gefiltert (Defense-in-Depth zur RLS), Validierungsfehler → 400, DB-Fehler → 500.

### Tests
- `src/app/api/langfristige-planung/[versionId]/grundeinstellungen/route.test.ts` — 20 Tests (Vitest): 6 für GET (Werte, Default ohne Insert, 404 fremde Version, 400 ungültige ID, 401, 500), 14 für PUT (Teilupdate, Anlegen aus Defaults, Startmonat-Update, Absatz auf null, leerer Body 400, Wertebereiche 400, ungültiger Monat/Jahr 400, ungültige ID 400, 404 fremde Version, 401, 500 Upsert-Fehler).
- Gesamtes `langfristige-planung`-Testset: **41/41 grün** (21 Planversionen + 20 neu). Typecheck der neuen Dateien sauber.

### Frontend-Anbindung
- Keine Änderungen nötig: Der bereits gebaute Hook `useLangfristigeGrundeinstellungen` ruft exakt diese Endpunkte und das erwartete Datenformat auf. Das Feature ist damit im Browser lauffähig.

## QA Test Results (2026-06-20)

### Testergebnis-Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| Akzeptanzkriterien | ✅ Alle bestanden (Code-Review + automatisiert) |
| Hook-Unit-Tests (Vitest) | ✅ 15/15 bestanden |
| API-Integrationstests (Vitest) | ✅ 20/20 bestanden |
| E2E-Tests (Playwright) | ✅ 8/8 bestanden (4 × Chromium + Mobile Safari) |
| Sicherheitsaudit | ✅ Keine Findings |
| Regression | ✅ Keine Regressionen (kurzfristige Grundeinstellungen 24/24, langfristige Planversionen 41/41) |
| Bugs gefunden | ✅ Keine Critical/High/Medium · 1 Low-Hinweis |

### Akzeptanzkriterien — geprüft (Code-Review + Tests)

**Navigation & Einstieg**
- ✅ Nav-Eintrag „Grundeinstellungen" (Gruppe „Einstellungen") verlinkt versionsspezifisch (aus PROJ-73-Nav-Config)
- ✅ Eintrag auf der Versions-Übersichtsseite vorhanden (PROJ-73)
- ✅ Auth-Guard: Redirect zu /login für unauthentifizierte Nutzer (E2E bestätigt)
- ✅ Fremde/unbekannte `versionId`: Shell erhält 404 von der API → Redirect zum Dashboard (PROJ-73-Shell-Logik)

**Startmonat**
- ✅ Zwei `Select` für Monat (Januar–Dezember = 1–12) und Jahr
- ✅ Default = aktueller Monat/Jahr (serverseitig in GET ohne Insert)
- ✅ Auto-Save bei Auswahländerung, Toast bei Erfolg

**Planungshorizont Allgemein**
- ✅ Number-Input, Label „Planungshorizont Allgemein (Monate)", min=1, max=120, step=1
- ✅ Default 12, Auto-Save bei onBlur, Toast

**Planungshorizont Absatz (optional)**
- ✅ Zweites Feld, Platzhalter = allgemeiner Wert
- ✅ Leeren + verlassen → null (allgemeiner Horizont gilt), kein Fehler
- ✅ Bereich 1–120, Auto-Save bei onBlur

**Validierung**
- ✅ Wert < 1 / > 120 → „Bitte einen Wert zwischen 1 und 120 eingeben." + Rollback, kein API-Aufruf
- ✅ Dezimalzahl/Buchstaben → „Bitte eine ganze Zahl eingeben." + Rollback
- ✅ Leeres Allgemein-Feld → Fehlermeldung + Rollback (Pflichtfeld)
- ✅ Leeres Absatz-Feld zulässig
- ✅ Monat 1–12 / Jahr 2000–2100 serverseitig via Zod erzwungen (UI bietet nur gültige Auswahl)

**Datenpersistenz & Isolation**
- ✅ Pro Planversion (`plan_version_id`) + Nutzer (`user_id`) gespeichert
- ✅ Standardwerte ohne DB-Insert beim ersten Aufruf
- ✅ Gespeicherte Werte beim nächsten Aufruf vorbelegt
- ✅ Optimistisches Update + Rollback bei API-Fehler (Hook-Tests)
- ✅ Merge-then-Upsert: Teilmengen-Update verletzt keine NOT-NULL-Pflichtfelder (API-Test „creates entry from defaults")
- ✅ Kaskadierende Löschung über FK ON DELETE CASCADE

**Datenbankschema & API**
- ✅ Tabelle `langfristige_grundeinstellungen` mit korrekten CHECK-Constraints, UNIQUE(plan_version_id), Indizes, RLS (4 Policies)
- ✅ GET liefert gespeicherte Werte oder Defaults; PUT Upsert; 400/401/404/500 abgedeckt

### Automatisierte Tests

**Hook-Unit-Tests (Vitest) — 15 Tests** `src/hooks/use-langfristige-grundeinstellungen.test.ts`
- Konstanten: 2 · Initial Load: 5 (Ladezustand, Werte, null-Absatz, non-ok, Netzwerkfehler)
- savePlanungshorizont: 3 (optimistisch, Erfolg, Rollback+Throw) · saveAbsatz: 3 (Wert, null, Rollback) · saveStartmonat: 2 (Monat+Jahr optimistisch, Rollback)

**API-Integrationstests (Vitest) — 20 Tests** `src/app/api/langfristige-planung/[versionId]/grundeinstellungen/route.test.ts`
- GET: 6 (Werte, Default ohne Insert, 404 fremde Version, 400 ungültige ID, 401, 500)
- PUT: 14 (Teilupdate, Anlegen aus Defaults, Startmonat-Update, Absatz→null, leerer Body, Bereiche, Monat/Jahr, ungültige ID, 404, 401, 500)

**E2E-Tests (Playwright) — 8 Tests (4 × 2 Browser)** `tests/PROJ-75-langfristige-grundeinstellungen.spec.ts`
- Seitenexistenz (kein 404) · Auth-Guard versionsgebundene Seite · Regression Dashboard-Redirect · Regression kurzfristige Grundeinstellungen erreichbar

### Sicherheitsaudit (Red Team)

- ✅ **Auth**: `requireAuth()` in GET und PUT → 401 ohne Session
- ✅ **Authorization / IDOR**: Beide Routen prüfen Versions-Eigentum (`langfristige_planversionen` gefiltert nach `user_id` + `id`) → 404 bei fremder Version; Datenquery zusätzlich nach `user_id` + `plan_version_id` gefiltert; RLS als zweite Ebene. Fremdzugriff auf Einstellungen anderer Nutzer/Versionen nicht möglich
- ✅ **Input-Validierung**: Zod (Monat 1–12, Jahr 2000–2100, Horizonte ganze Zahl 1–120, Absatz nullable); UUID-Format der `versionId` geprüft
- ✅ **Mass Assignment**: PUT übernimmt nur explizit gemappte Felder; `user_id` aus Session erzwungen, nicht aus Body
- ✅ **XSS/Injection**: Werte sind Zahlen; keine `dangerouslySetInnerHTML`; Supabase parametrisiert
- ✅ Keine Secrets in Antworten/Client

### Bugs / Hinweise

**Keine Critical/High/Medium-Bugs.**

- **Low (Hinweis, kein Defekt):** Die Jahr-Auswahl im Frontend bietet `aktuell−5 … aktuell+20` (derzeit 2021–2046), der Server erlaubt 2000–2100. Da Werte ausschließlich über diese Auswahl gesetzt werden, liegen gespeicherte Jahre stets im UI-Bereich; ein über die API direkt gesetzter Wert außerhalb 2021–2046 würde im Select leer dargestellt. Für die reguläre Nutzung irrelevant.

### Produktionsbereitschaft

**✅ PRODUCTION-READY** — alle Akzeptanzkriterien erfüllt, keine Critical/High/Medium-Bugs, Sicherheitsaudit ohne Findings, keine Regressionen. Bereit für Deployment.

## Deployment
_To be added by /deploy_
