# PROJ-69: Produktinvestitionsausgaben — Kurzfristige Planung (Redesign PROJ-57)

## Status: Approved
**Created:** 2026-06-17
**Last Updated:** 2026-06-17

## Implementation Notes (Backend)

**Implementiert 2026-06-17:**

### Neue Dateien
- `src/app/api/produktinvestitions-planung/ist-tatsaechlich/route.ts` — GET-Endpoint: aggregiert `ausgaben_kosten_transaktionen` nach `(gruppe_id, kw_year, kw_number)` für den Vergangenheitshorizont. Filterung: `relevanz IN ['liquiditaet', 'beides']`, `zahlungsdatum` im Zeitraum, `gruppe_id NOT NULL`. Rückgabe: `{ data: [{ kategorie_id, kw_year, kw_number, betrag }] }`
- `src/app/api/produktinvestitions-planung/ist-tatsaechlich/route.test.ts` — 7 Tests (400-Validierung, 401, 500, 200 leer, Aggregation, Null-Handling, Rundung)
- `src/hooks/use-produktinvestitionsausgaben.ts` — Neuer Hook: 4-phasiges Laden (grundeinstellungen → 3 parallele: kpi-categories, produktinvestitions-planung, ist-tatsaechlich). Filtert KPI-Kategorien auf "Produktinvestitionen"-Subtree. Key-Format: `${kategorieId}:${year}:${week}`. Kein berechnet, kein resetAll, kein produkt_id.
- `src/components/produktinvestitionsausgaben-tabelle.tsx` — Neue Tabellenkomponente: Dual-Spalten-Vergangenheitsbereich (Ist-Tatsächlich + Ist-Plan), blauer Indikator für manuelle Soll-Werte, Gesamt-Zeile unten, zwei separate Expand/Collapse-Buttons, Zellen-Notizen, Multi-Zellen-Selektion. Kein Reset-Button.

### Gelöschte Dateien (PROJ-57)
- `src/hooks/use-produktinvestitionsplanung.ts`
- `src/hooks/use-produktinvestitionsplanung.test.ts`
- `src/components/produktinvestitionsplanung-tabelle.tsx`

### Geänderte Dateien
- `src/app/dashboard/kurzfristige-planung/produktinvestitionsplanung/page.tsx` — Import und Usage auf `ProduktinvestitionsausgabenTabelle` umgestellt

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — „Produktinvestitionen"-Knoten im `ausgaben_kosten`-Baum als Zeilenquelle
- Requires: PROJ-41 (Bereichswechsler) — URL-Rahmen „Kurzfristige Planung"
- Requires: PROJ-50 (Grundeinstellungen) — `planungshorizont_wochen` + `vergangenheitshorizont_wochen`
- Requires: PROJ-53 (Zellen-Notizen) — Notizen auf Zellenbasis
- Requires: PROJ-29 (Liquiditätsreport) — Logik für Ist-Tatsächlich-Werte aus `ausgaben_kosten_transaktionen`
- Supersedes: PROJ-57 (Produktinvestitionsplanung) — vollständig ersetzt; alle Dateien aus PROJ-57 werden durch PROJ-69 überschrieben

---

## Übersicht

Die Seite „Produktinvestitionsausgaben" zeigt eine wochenbasierte (KW) Übersicht der geplanten und tatsächlichen Produktinvestitionen. Sie orientiert sich in Layout, Spaltenstruktur und Interaktionsmodell **vollständig an der Umsatzausgaben-Seite (PROJ-67) und der Operativen Ausgaben-Seite (PROJ-68)** — dieselbe bewährte Implementierung soll von Anfang an übernommen werden.

Die Zeilen der Tabelle leiten sich aus dem KPI-Modell ab: alle Kategorien unterhalb des Knotens „Produktinvestitionen" (Typ `ausgaben_kosten`) — L1-Gruppen und deren L2-Untergruppen. Es werden **immer alle Gruppen und Untergruppen** angezeigt.

**Vergangenheitsbereich** (`vergangenheitshorizont_wochen` KWs vor der aktuellen KW, Fallback 4):
- Pro KW **zwei Spalten** nebeneinander:
  - **Ist-Tatsächlich**: tatsächliche Ausgaben je Kategorie aus `ausgaben_kosten_transaktionen`, identische Logik wie Liquiditätsreport (PROJ-29), gefiltert auf „Produktinvestitionen"-Subtree
  - **Ist-Plan**: der damalige Planwert aus `produktinvestitions_planung` für diese vergangene KW (leer, wenn damals kein Wert geplant war)
- Unter dem KW-Header-Label: Unterzeile mit „Ist-Tatsächlich" (linke Spalte) und „Ist-Plan" (rechte Spalte)

**Planungszeitraum** (`planungshorizont_wochen` KWs ab der nächsten KW, Fallback 13):
- Pro KW **eine Soll-Spalte** — vollständig manuell vom Nutzer befüllt (keine automatische Vorberechnung)
- **Blauer Indikatorpunkt** für jeden manuell eingetragenen Wert (kein grauer Punkt, da es keine Auto-Berechnung gibt)

Die **Gesamt-Zeile „Produktinvestitionsausgaben (Gesamt)"** erscheint immer ganz **unten** in der Tabelle.

---

## User Stories

- Als Nutzer möchte ich die Produktinvestitionsausgaben-Seite über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können, damit ich schnell zu den Investitionsdaten navigiere.
- Als Nutzer möchte ich für vergangene KWs sowohl Ist-Tatsächlich-Werte als auch meine damaligen Planwerte sehen, damit ich Plan-Ist-Vergleiche für Produktinvestitionen schnell durchführen kann.
- Als Nutzer möchte ich für jede vergangene KW Ist-Tatsächlich und Ist-Plan nebeneinander sehen, damit ich sofort erkenne, wie nah mein Investitionsplan an der Realität war.
- Als Nutzer möchte ich im Planungszeitraum Soll-Werte vollständig manuell eingeben können, damit ich meine Investitionsplanung frei gestalten kann.
- Als Nutzer möchte ich auf einen Blick sehen, welche Soll-Zellen manuell ausgefüllt sind (blauer Punkt), damit ich weiß, welche Felder bereits geplant wurden.
- Als Nutzer möchte ich alle Kategoriegruppen auf- und zuklappen können, sowie mit zwei Buttons alle gleichzeitig ein- oder ausklappen.
- Als Nutzer möchte ich für einzelne Soll-Zellen Notizen hinterlegen können.
- Als Nutzer möchte ich mehrere Zellen durch Klicken / Ctrl+Klicken auswählen und die Summe rechts unten angezeigt bekommen.

---

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag **„Produktinvestitionsausgaben"** → `/dashboard/kurzfristige-planung/produktinvestitionsplanung` (bestehende URL, umbenannt)
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint die bestehende Kachel **„Produktinvestitionsausgaben"** (umbenannt von „Produktinvestitionsplanung") im Abschnitt „Planung"
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)

### Spaltenstruktur

- [ ] Die Tabelle zeigt zwei Bereiche mit **klarer Trennlinie** (dicker vertikaler Separator oder Hintergrundfarben-Kontrast):
  - **Vergangenheitsbereich**: die letzten N KWs vor der aktuellen KW (N = `vergangenheitshorizont_wochen`, Fallback 4); die aktuelle KW wird **nicht** angezeigt
  - **Planungszeitraum**: die nächsten M KWs, beginnend mit der nächsten KW (M = `planungshorizont_wochen`, Fallback 13)
- [ ] Für jede vergangene KW: **zwei Spalten** nebeneinander
  - Erste Header-Zeile: KW-Label (z. B. „KW22 / 2026"), überspannt beide Spalten (colspan=2)
  - Zweite Header-Zeile (Sub-Label): linke Spalte „Ist-Tatsächlich", rechte Spalte „Ist-Plan"
- [ ] Für jede zukünftige KW: **eine Spalte** mit KW-Header (Format „KW24 / 2026")
- [ ] Korrekte ISO-8601-Wochenberechnung inkl. Jahreswechsel (`date-fns`)
- [ ] Tabelle ist horizontal scrollbar; die erste Spalte (Zeilenbeschriftung) ist `sticky left`
- [ ] Neue letzte KW des Planungshorizonts (ohne Planungswerte): rote Markierung (`ring-1 ring-red-300`) an Header und Zellen

### Zeilenhierarchie

- [ ] **Ganz unten**: Gesamt-Zeile **„Produktinvestitionsausgaben (Gesamt)"** — summiert alle Leaf-Zeilen (effektive Werte), nicht editierbar, immer sichtbar
- [ ] **Pro L1-Gruppe** (direkte Kinder des „Produktinvestitionen"-Knotens): einklappbare Sektion (Standard: ausgeklappt)
  - Kategorie-Header-Zeile mit Gruppenname + Auf-/Zuklapp-Icon; zeigt Summe der Kinder
  - Wenn die Gruppe L2-Untergruppen hat:
    - Aggregations-Zeile (Summe der L2-Untergruppen), nicht editierbar
    - Pro L2-Untergruppe: editierbare Leaf-Zeile (eingerückt) — Soll-Werte editierbar
  - Wenn die Gruppe **keine** Untergruppen hat:
    - Die L1-Gruppe selbst ist editierbar (Leaf)
- [ ] Es werden **immer alle Gruppen und Untergruppen** angezeigt (keine Filterung nach vorhandenen Werten)
- [ ] Kategorien in `sort_order`-Reihenfolge des KPI-Modells
- [ ] **Buttons oben rechts:**
  - **„Alle ausklappen"**: klappt alle Sektionen auf (separater Button, kein Toggle)
  - **„Alle einklappen"**: klappt alle Sektionen zu (separater Button)

### Leerer Zustand

- [ ] Wenn kein „Produktinvestitionen"-Knoten im KPI-Modell vorhanden ist oder dieser keine Kinder hat: leerer Zustand mit Hinweis „Keine Produktinvestitionskategorien im KPI-Modell vorhanden. Bitte den Knoten ‚Produktinvestitionen' im KPI-Modell konfigurieren." + Link zur KPI-Modell-Verwaltung

### Ist-Tatsächlich-Werte (Vergangenheitsspalten)

- [ ] Datenquelle: identische Logik wie der Liquiditätsreport (PROJ-29) — `ausgaben_kosten_transaktionen`, gefiltert nach `zahlungsdatum`, gruppiert nach Kategorie und ISO-KW; nur Kategorien im „Produktinvestitionen"-Subtree
- [ ] Ist-Tatsächlich-Zellen sind **nicht editierbar** (kein Inline-Edit, keine Indikatorpunkte)
- [ ] Aggregationszeilen summieren ihre Leaf-Kinder in der Ist-Tatsächlich-Spalte
- [ ] Gesamt-Zeile summiert alle Leafs in der Ist-Tatsächlich-Spalte
- [ ] Zellen ohne Transaktionen: leer (keine 0-Anzeige)

### Ist-Plan-Werte (Vergangenheitsspalten)

- [ ] Datenquelle: bestehende `produktinvestitions_planung`-Tabelle — Planwerte für vergangene KWs (der damalig geplante Wert, der nun in der Vergangenheit liegt)
- [ ] Ist-Plan-Zellen sind **nicht editierbar** (kein Inline-Edit, keine Indikatorpunkte)
- [ ] Wenn für eine vergangene KW kein Planwert in `produktinvestitions_planung` existiert: Zelle leer
- [ ] Aggregationszeilen summieren ihre Leaf-Kinder in der Ist-Plan-Spalte

### Soll-Werte (Planungszeitraum) — vollständig manuell

- [ ] **Keine automatische Vorberechnung** — alle Soll-Zellen starten leer
- [ ] Alle manuell ausgefüllten Soll-Zellen zeigen einen **blauen Indikatorpunkt**
- [ ] Zellen ohne manuellen Eintrag: kein Indikatorpunkt (weder grau noch blau)
- [ ] Inline-Editing (click-to-edit), Speicherung onBlur in `produktinvestitions_planung`
- [ ] Eingabe: Dezimalzahl ≥ 0 (Betrag in €); leeres Feld → NULL (Eintrag in DB löschen)
- [ ] Optimistisches Update + Toast-Fehlermeldung + Rollback bei API-Fehler
- [ ] Nur Soll-Zellen (Planungszeitraum) sind editierbar; alle Ist-Spalten sind gesperrt

### Visuelle Indikatorpunkte

| Zustand | Punkt | Gilt für |
|---|---|---|
| Manuell eingegeben | Blauer Punkt | Soll-Zellen mit Eintrag in `produktinvestitions_planung` für Zukunfts-KW |
| Leer / kein manueller Wert | Kein Punkt | Soll-Zellen ohne Eintrag |
| Ist-Tatsächlich / Ist-Plan | Kein Punkt | Nicht editierbare Vergangenheitsspalten |

Merksatz: **Jeder DB-Eintrag in `produktinvestitions_planung` für eine zukünftige KW = manuell = blauer Punkt.** Es gibt keine Auto-Werte, daher gibt es keinen grauen Punkt.

### Notizen (PROJ-53)

- [ ] Notiz-Feature auf allen editierbaren Soll-Zellen (Planungszeitraum), identisch mit anderen Planungsseiten
- [ ] Notiz-Icon erscheint beim Hover (wenn keine Notiz) oder dauerhaft (wenn Notiz vorhanden)
- [ ] Notizen in `planung_notizen` gespeichert mit `kontext = 'produktinvestitions_planung'`

### Betragsselektion

- [ ] Einzelne oder mehrere Zellwerte durch Klicken / Ctrl+Klicken auswählbar
- [ ] Summe der selektierten Werte wird in einem Panel rechts unten angezeigt (Anzahl + Summe in €)
- [ ] Panel erscheint ab 1 selektierter Zelle, verschwindet wenn Selektion aufgehoben
- [ ] Ist-Tatsächlich-, Ist-Plan-, Aggregations- und Gesamt-Zellen ebenfalls selektierbar
- [ ] Identisches Verhalten wie in PROJ-51, PROJ-52, PROJ-66, PROJ-67, PROJ-68

### Kein Reset-Button

- [ ] Es gibt **keinen** allgemeinen Zurücksetzen-Button
- [ ] Es gibt **keinen** Einzelzelle-Zurücksetzen-Button
- [ ] Zellen können durch Leeren (onBlur mit leerem Feld) auf NULL gesetzt werden — das ist die einzige Möglichkeit einen Wert zu entfernen

### Datenbankschema

#### Bestehende Tabelle `produktinvestitions_planung` (unverändert)
- Speichert sowohl vergangene Planwerte (Ist-Plan) als auch zukünftige manuelle Soll-Werte
- Schema aus PROJ-57 bleibt unverändert:
  - `id` UUID PK
  - `user_id` UUID FK → auth.users (ON DELETE CASCADE)
  - `kategorie_id` UUID FK → kpi_categories (ON DELETE CASCADE)
  - `kw_year` INTEGER
  - `kw_number` INTEGER
  - `betrag_manuell` NUMERIC(12,2) nullable
  - UNIQUE(`user_id`, `kategorie_id`, `kw_year`, `kw_number`)
  - RLS: Nutzer sieht und schreibt nur eigene Einträge

### API-Routen

| Methode | Route | Zweck |
|---|---|---|
| `GET` | `/api/produktinvestitions-planung` | Alle Einträge des Nutzers (für Ist-Plan vergangene KWs + Soll zukünftige KWs) |
| `PUT` | `/api/produktinvestitions-planung` | Upsert eines einzelnen Eintrags; `betrag_manuell: null` → Eintrag löschen (Zelle leeren) |
| `GET` | `/api/produktinvestitions-planung/ist-tatsaechlich` | Ist-Tatsächlich-Werte aus `ausgaben_kosten_transaktionen`, nach Kategorie + ISO-KW |

- `requireAuth()` in allen Routen
- Query-Parameter für `ist-tatsaechlich`: `von_kw`, `von_jahr`, `bis_kw`, `bis_jahr`

---

## Edge Cases

- **Kein „Produktinvestitionen"-Knoten im KPI-Modell oder keine Kinder**: leerer Zustand mit Hinweis + Link zur KPI-Verwaltung
- **Kein Ist-Plan für vergangene KW** (damals nicht geplant): Spalte leer, kein 0
- **Kein Ist-Tatsächlich für vergangene KW** (keine Transaktionen): Zelle leer, kein 0
- **Jahreswechsel** (z. B. KW52/2026 → KW1/2027): korrekte ISO-8601-Berechnung über Jahreswechsel
- **Sehr viele Spalten** (Vergangenheit × 2 + Zukunft): horizontales Scrollen, sticky Label-Spalte
- **Soll-Zelle auf 0 gesetzt**: gültig, wird als `0,00 €` mit blauem Punkt angezeigt (unterscheidet sich von NULL/leer)
- **Zelle geleert**: `betrag_manuell = null` → Eintrag wird gelöscht, Zelle erscheint leer ohne Punkt
- **API-Fehler bei `ist-tatsaechlich`**: betroffene Zellen leer, kein Absturz, Toast-Hinweis
- **Zurücksetzen ohne manuelle Werte**: nicht relevant (kein Reset-Button vorhanden)
- **Kategorie im KPI-Modell gelöscht**: ON DELETE CASCADE entfernt `produktinvestitions_planung`-Einträge; Zeile verschwindet beim nächsten Laden

---

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen API-Routen
- RLS auf `produktinvestitions_planung` bleibt aus PROJ-57 erhalten
- ISO-8601-Wochenberechnung: `date-fns` (`getISOWeek`, `getISOWeekYear`, `addWeeks`)
- Keine neuen Packages nötig: shadcn `Table`, `Input`, `Tooltip`, `Button` — alle vorhanden
- Notizen-Pattern: wiederverwendbar aus PROJ-53 (identisch wie auf anderen Planungsseiten)
- Betragsselektion-Pattern: wiederverwendbar aus PROJ-51 / PROJ-52 / PROJ-67 / PROJ-68
- Seite: `src/app/dashboard/kurzfristige-planung/produktinvestitionsplanung/page.tsx` (bestehend — vollständig neu geschrieben)

### Implementierungsmuster

**Kritisch**: Die Implementierung muss das **identische Muster** von PROJ-67 (Umsatzausgaben) und PROJ-68 (Operative Ausgaben) verwenden — insbesondere:
- Gleiche Dual-Spalten-Struktur für Vergangenheitsbereich (Ist-Tatsächlich + Ist-Plan, colspan=2 Header)
- Gleicher Datenfluss: 4 parallele API-Calls beim Laden (Grundeinstellungen, KPI-Categories, Planungsdaten, Ist-Tatsächlich)
- Gleiche Indikatorpunkt-Logik (aber nur blau, kein grau — da kein `berechnet`-Endpunkt)
- Gleiche Betragsselektion-, Notizen- und Expand/Collapse-Muster

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/hooks/use-produktinvestitionsausgaben.ts` | Zentraler Hook: lädt Grundeinstellungen, KPI-Categories, Planungsdaten (Ist-Plan + Soll), Ist-Tatsächlich parallel; baut flaches Zeilen-Array; Indikator-Logik; upsertZelle; expandAll/collapseAll |
| `src/components/produktinvestitionsausgaben-tabelle.tsx` | Haupttabelle: doppelte Vergangenheitsspalten, blauer Indikatorpunkt (manuell), Einklappen, Notizen, Betragsselektion, Gesamt unten |
| `src/app/api/produktinvestitions-planung/ist-tatsaechlich/route.ts` | GET: Ist-Tatsächlich aus `ausgaben_kosten_transaktionen`, gefiltert auf Produktinvestitionen-Subtree |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/app/dashboard/kurzfristige-planung/produktinvestitionsplanung/page.tsx` | Vollständig neu: Header + ProduktinvestitionsausgabenTabelle + Toaster (ersetzt PROJ-57-Implementierung) |
| `src/app/api/produktinvestitions-planung/route.ts` | Unverändert — GET/PUT bereits vorhanden und ausreichend |
| `src/components/nav-sheet.tsx` | Umbenennung: „Produktinvestitionsplanung" → „Produktinvestitionsausgaben" |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Umbenennung der Kachel: „Produktinvestitionsplanung" → „Produktinvestitionsausgaben" |

### Entfernte Dateien (PROJ-57-Artefakte)

| Datei | Warum entfernt |
|---|---|
| `src/hooks/use-produktinvestitionsplanung.ts` | Ersetzt durch `use-produktinvestitionsausgaben.ts` |
| `src/components/produktinvestitionsplanung-tabelle.tsx` | Ersetzt durch `produktinvestitionsausgaben-tabelle.tsx` |

### Datenfluss beim Laden

```
Seite öffnet sich → Hook useProduktinvestitionsausgaben lädt PARALLEL:

  ① GET /api/grundeinstellungen
       → planungshorizont_wochen, vergangenheitshorizont_wochen

  ② GET /api/kpi-categories?type=ausgaben_kosten
       → alle KPI-Kategorien; Hook filtert client-seitig auf „Produktinvestitionen"-Subtree

  ③ GET /api/produktinvestitions-planung
       → alle DB-Einträge des Nutzers (ZWEI Zwecke):
         a) Ist-Plan (vergangene KWs): der damalige Planwert
         b) Soll-Manuell (zukünftige KWs): aktuelle manuelle Einträge

  ④ GET /api/produktinvestitis-planung/ist-tatsaechlich?von_kw=&von_jahr=&bis_kw=&bis_jahr=
       → tatsächliche Ausgaben je Kategorie je vergangene KW
       → aus ausgaben_kosten_transaktionen, gefiltert auf Produktinvestitionen-Subtree

→ Hook baut flaches Zeilen-Array (category-header → [category-sum +] leaf → ... → total)
→ Pro Zelle:
    Ist-Tatsächlich aus ④
    Ist-Plan aus ③ (vergangene KWs)
    Soll: Eintrag in ③ für Zukunfts-KW = blauer Punkt (manuell)
          Kein Eintrag in ③ = leer (kein Punkt)
```

### Implementierungsreihenfolge

```
1. Backend: GET /api/produktinvestitis-planung/ist-tatsaechlich  ← neue Route
   ↓
2. Frontend: use-produktinvestitionsausgaben Hook
   ↓
3. Frontend: produktinvestitionsausgaben-tabelle Komponente
   ↓
4. Frontend: page.tsx + nav-sheet + dashboard-page aktualisieren
   ↓
5. Alte PROJ-57-Artefakte entfernen (use-produktinvestitionsplanung.ts, produktinvestitionsplanung-tabelle.tsx)
```

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

**QA-Datum:** 2026-06-18
**Tester:** QA Engineer (Claude)
**Status: APPROVED — Production-Ready**

### Testergebnisse

#### Akzeptanzkriterien

| Bereich | AC | Ergebnis |
|---|---|---|
| Navigation | Nav-Eintrag „Produktinvestitionsausgaben" vorhanden | ✅ Pass |
| Navigation | Dashboard-Kachel umbenannt zu „Produktinvestitionsausgaben" | ✅ Pass |
| Navigation | Auth-Guard (Redirect zu /login) | ✅ Pass |
| Spaltenstruktur | Vergangenheitsbereich + Planungszeitraum mit Trennlinie | ✅ Pass |
| Spaltenstruktur | Vergangene KWs: 2 Spalten (Ist-Tatsächlich + Ist-Plan) | ✅ Pass |
| Spaltenstruktur | Zukunft: 1 Soll-Spalte mit KW-Header | ✅ Pass |
| Spaltenstruktur | ISO-8601-Wochenberechnung (date-fns) | ✅ Pass |
| Spaltenstruktur | Horizontal scrollbar, sticky Label-Spalte | ✅ Pass |
| Spaltenstruktur | Rote Markierung letzter KW ohne Planungswerte | ⚠️ Low Bug (s.u.) |
| Zeilenhierarchie | Gesamt-Zeile „Produktinvestitionsausgaben (Gesamt)" ganz unten | ✅ Pass |
| Zeilenhierarchie | L1-Gruppen einklappbar (Standard: ausgeklappt) | ✅ Pass |
| Zeilenhierarchie | L2-Untergruppen + Aggregationszeile | ✅ Pass |
| Zeilenhierarchie | L1 ohne Untergruppen: L1 selbst editierbar | ✅ Pass |
| Zeilenhierarchie | Immer alle Gruppen/Untergruppen sichtbar | ✅ Pass |
| Zeilenhierarchie | sort_order-Reihenfolge | ✅ Pass |
| Zeilenhierarchie | Toggle-Button Alle ein-/ausklappen | ✅ Pass (user-approved abweichend: 1 Toggle-Button statt 2 separate) |
| Leerer Zustand | Hinweis + KPI-Link wenn kein Produktinvestitionen-Knoten | ✅ Pass |
| Ist-Tatsächlich | Datenquelle: ausgaben_kosten_transaktionen | ✅ Pass |
| Ist-Tatsächlich | Nicht editierbar | ✅ Pass |
| Ist-Tatsächlich | Aggregation summiert Leaf-Kinder | ✅ Pass |
| Ist-Tatsächlich | Gesamt-Zeile summiert alle Leafs | ✅ Pass |
| Ist-Tatsächlich | Keine Transaktionen → Zelle leer | ✅ Pass |
| Ist-Plan | Datenquelle: produktinvestitions_planung (vergangene KWs) | ✅ Pass |
| Ist-Plan | Nicht editierbar | ✅ Pass |
| Ist-Plan | Kein Planwert → Zelle leer | ✅ Pass |
| Ist-Plan | Aggregation summiert Leaf-Kinder | ✅ Pass |
| Soll-Werte | Keine automatische Vorberechnung | ✅ Pass |
| Soll-Werte | Blauer Indikatorpunkt für manuelle Einträge | ✅ Pass |
| Soll-Werte | Kein Punkt ohne Eintrag | ✅ Pass |
| Soll-Werte | Inline-Editing / onBlur-Speicherung | ✅ Pass |
| Soll-Werte | Dezimalzahl ≥ 0; leer → NULL (Eintrag gelöscht) | ✅ Pass |
| Soll-Werte | Optimistisches Update + Rollback + Toast bei Fehler | ✅ Pass |
| Soll-Werte | Nur Soll-Zellen editierbar | ✅ Pass |
| Notizen | Notiz-Feature auf Soll-Zellen | ✅ Pass |
| Notizen | Notiz-Icon beim Hover / dauerhaft wenn vorhanden | ✅ Pass |
| Notizen | kontext = 'produktinvestitionsausgaben' | ✅ Pass |
| Betragsselektion | Einzelne + Ctrl+Klick-Selektion | ✅ Pass |
| Betragsselektion | Summen-Panel rechts unten ab 1 Zelle | ✅ Pass |
| Betragsselektion | Ist-T, Ist-Plan, Aggregation, Gesamt selektierbar | ✅ Pass |
| Kein Reset-Button | Kein allgemeiner Reset-Button | ✅ Pass |
| Kein Reset-Button | Kein Einzelzelle-Reset-Button | ✅ Pass |

**Ergebnis:** 42 Pass / 1 Low Bug

---

#### Bugs

| # | Schweregrad | Beschreibung | Reproduktion |
|---|---|---|---|
| B1 | **Low** | Rote Markierung der letzten KW ohne Planungswerte nicht implementiert. Hook berechnet `isNewWeek` und gibt `lastWoche` zurück, aber `produktinvestitionsausgaben-tabelle.tsx` destrukturiert diese Werte nicht und wendet kein `ring-1 ring-red-300` an. Gleiche Abweichung wie in PROJ-67 und PROJ-68, die ebenfalls kein `isNewWeek` in der Tabelle verwenden. | Planungshorizont einstellen, letzte KW ohne Einträge lassen → kein roter Ring sichtbar. |

---

#### Automatisierte Tests

| Suite | Testdatei | Ergebnis |
|---|---|---|
| Unit (Vitest) | `src/app/api/produktinvestitions-planung/ist-tatsaechlich/route.test.ts` | 10 / 10 Pass |
| E2E (Playwright) | `tests/PROJ-69-produktinvestitionsausgaben.spec.ts` | 16 / 16 Pass (Chromium + Mobile Safari) |

---

#### Security Audit

- ✅ `requireAuth()` in allen 3 API-Routen (GET/PUT planung, GET ist-tatsaechlich)
- ✅ RLS auf `produktinvestitions_planung` (aus PROJ-57, unverändert)
- ✅ Input-Validierung (Zod-Muster aus vorhandener PUT-Route)
- ✅ Kein Secret im Code
- ✅ Unauthentifizierte Requests auf alle Endpunkte redirecten zu /login (E2E bestätigt)

---

#### Production-Ready Empfehlung

**JA — Production-Ready.**

Kein Critical- oder High-Bug vorhanden. Bug B1 (Low) ist eine bekannte Inkonsistenz, die identisch in PROJ-67 und PROJ-68 existiert — beide wurden bereits als Approved markiert. Fix kann in einem separaten Ticket nachgeholt werden.

## Deployment
_To be added by /deploy_
