# PROJ-53: Zellen-Notizen in der Kurzfristigen Planung

## Status: In Progress
**Created:** 2026-06-04
**Last Updated:** 2026-06-04 (Frontend + Backend implementiert)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-41 (Bereichswechsler) — URL-Rahmen „Kurzfristige Planung"
- Requires: PROJ-51 (Absatzplanung) — erste Planungsseite, auf der Notizen erscheinen
- Requires: PROJ-52 (Einnahmenplanung) — zweite Planungsseite, auf der Notizen erscheinen

## Übersicht

Nutzer können in den Planungstabellen der Kurzfristigen Planung (Absatzplanung, Einnahmenplanung und künftige Planungsseiten) zu einzelnen editierbaren Zellen eine Freitext-Notiz hinterlegen. Das ermöglicht das Dokumentieren von Annahmen, Begründungen oder Hinweisen direkt am Planungswert.

Notizen sind immer einer **konkreten Datenzelle** zugeordnet — d.h. der Kombination aus Zeile (z.B. Produkt + Plattform) und Kalenderwoche. Sie verschieben sich automatisch mit, wenn der Planungshorizont eine Woche vorwärts rückt, weil die Wochenspalten neu berechnet werden (die Notiz bleibt an der KW hängen, nicht an der Spaltenposition).

## Planungsseiten im Scope

- `/dashboard/kurzfristige-planung/absatzplanung`
- `/dashboard/kurzfristige-planung/einnahmenplanung`
- Alle künftigen Planungsseiten in `kurzfristige-planung` sollen denselben Notiz-Mechanismus nutzen

## User Stories

- Als Nutzer möchte ich zu einer einzelnen Planungszelle eine Freitext-Notiz hinzufügen können, damit ich meine Planungsannahme direkt an der Zelle dokumentieren kann.
- Als Nutzer möchte ich auf einen Blick erkennen, welche Zellen bereits eine Notiz haben, damit ich schnell relevante Kommentare wiederfinde.
- Als Nutzer möchte ich beim Hovern über das Notiz-Symbol den Text sofort lesen können, ohne ein Formular öffnen zu müssen.
- Als Nutzer möchte ich eine bestehende Notiz bearbeiten oder löschen können, wenn sich die Planung ändert.
- Als Nutzer möchte ich, dass Notizen an ihrer Kalenderwoche hängen (nicht an einer Spaltenposition), damit sie beim Vorrücken des Planungshorizonts nicht verloren gehen.
- Als Nutzer möchte ich nur für eine einzeln selektierte Zelle eine Notiz anlegen können, damit es keine Mehrdeutigkeit bei Mehrfachselektion gibt.

## Acceptance Criteria

### Notiz-Button — Sichtbarkeit

- [ ] Der Button „Notiz hinzufügen" erscheint im rechten unteren Bereich der Seite (über dem Summenfeld / Betragsselektion-Bereich), wenn **genau eine** editierbare Zelle ausgewählt ist
- [ ] Der Button ist **nicht** sichtbar, wenn keine Zelle ausgewählt ist
- [ ] Der Button ist **nicht** sichtbar, wenn mehrere Zellen gleichzeitig ausgewählt sind (Mehrfachselektion)
- [ ] Der Button ist **nicht** sichtbar, wenn eine nicht-editierbare Zelle ausgewählt ist (Aggregations-/Summen-Zeilen)
- [ ] Existiert für die selektierte Zelle bereits eine Notiz, lautet der Button **„Notiz bearbeiten"** (statt „Notiz hinzufügen")

### Notiz-Formular (Overlay)

- [ ] Ein Klick auf „Notiz hinzufügen" / „Notiz bearbeiten" öffnet ein schwebendes Formular (Overlay/Panel) über dem restlichen Inhalt
- [ ] Das Formular enthält:
  - Eine Überschrift mit der Zellenidentifikation (z.B. „Notiz — Produkt X · KW24 / 2026")
  - Ein mehrzeiliges Freitext-Eingabefeld (Textarea)
  - Einen Button „Speichern"
  - Einen Button „Abbrechen" (schließt ohne Änderungen)
  - Bei bearbeitbarer Notiz zusätzlich einen Button „Notiz löschen"
- [ ] Das Formular ist beim Öffnen mit dem bestehenden Notiztext vorausgefüllt (bei „Notiz bearbeiten")
- [ ] Das Formular schließt sich nach erfolgreichem Speichern
- [ ] Das Formular kann auch mit der Escape-Taste geschlossen werden (ohne Speichern)
- [ ] Ein Klick außerhalb des Formulars schließt es (ohne Speichern)
- [ ] Das Textarea hat keinen Zeichenlimit, aber ist auf mindestens 4 Zeilen Höhe ausgelegt

### Zellen-Indikator (Symbol)

- [ ] Editierbare Zellen mit einer gespeicherten Notiz zeigen ein kleines Symbol (z.B. kleines Notiz- oder Kommentar-Icon) in der **oberen rechten Ecke** der Zelle
- [ ] Das Symbol ist subtil, stört aber die Lesbarkeit des Zellwerts nicht
- [ ] Beim **Hovern** über das Symbol erscheint ein Tooltip mit dem vollständigen Notiztext
- [ ] Das Symbol ist **nicht** klickbar — das Notiz-Formular wird über die Zellen-Selektion + „Notiz bearbeiten"-Button geöffnet, nicht direkt über das Symbol

### Notiz-Persistenz & Wochenbezug

- [ ] Jede Notiz ist eindeutig einer **Zellen-ID** zugeordnet, bestehend aus: Seite (z.B. `absatzplanung`), Zeilen-Schlüssel (z.B. `{plattform_id}_{produkt_id}_{typ}` oder `{kategorie_id}`), Kalenderwoche (ISO-Woche) und Jahr
- [ ] Notizen werden in der Datenbank persistiert und sind nach Seitenneuladen noch vorhanden
- [ ] Wenn der Planungshorizont um eine Woche vorrückt (neuer Montag / neue KW), werden Notizen **nicht** verschoben — sie bleiben an ihrer gespeicherten KW hängen. Liegt die KW nicht mehr im aktuellen Planungshorizont, ist die Notiz nicht sichtbar, aber bleibt in der DB erhalten
- [ ] Notizen verschiedener Nutzer-Sessions sind für alle Nutzer der App sichtbar (kein nutzerspezifischer Filter — alle Nutzer haben gleiche Rechte wie im restlichen System)

### Löschen

- [ ] Beim Klicken auf „Notiz löschen" erscheint eine Bestätigungsaufforderung (z.B. kleiner Inline-Confirm-Text oder Confirm-Dialog)
- [ ] Nach Bestätigung wird die Notiz aus der DB gelöscht und das Symbol auf der Zelle verschwindet sofort

### Alle Planungsseiten

- [ ] Der Notiz-Mechanismus funktioniert auf der Absatzplanung-Seite für alle editierbaren Zellen (Absatz-Felder und VK-Felder)
- [ ] Der Notiz-Mechanismus funktioniert auf der Einnahmenplanung-Seite für alle editierbaren Zellen (Betrags-Felder der Leaf-Kategorien)

## Edge Cases

- **Mehrfachselektion aktiv:** Der „Notiz hinzufügen/bearbeiten"-Button ist ausgeblendet. Beim Reduzieren auf eine Zelle erscheint er sofort wieder.
- **Aggregations-Zeile selektiert:** Kein Notiz-Button — nur für editierbare Leaf-Zellen.
- **Leerer Notiztext beim Speichern:** Wird wie „Löschen" behandelt — die Notiz-Einheit wird aus der DB entfernt, das Symbol verschwindet.
- **Notiz außerhalb des Planungshorizonts:** Bleibt in der DB erhalten, aber wird nicht angezeigt. Wenn die KW wieder in den Horizont fällt (z.B. durch Änderung des `planungshorizont_wochen`-Werts), erscheint sie wieder.
- **Sehr langer Notiztext:** Tooltip im Hover-Zustand kürzt bei > ~300 Zeichen mit „…" ab; vollständiger Text ist nur im geöffneten Formular sichtbar.
- **Gleichzeitige Bearbeitung (zwei Browser-Tabs):** Kein Echtzeit-Sync nötig — beim nächsten Seitenaufruf / Neuladen wird der aktuelle DB-Stand geladen.
- **Reset der Planungswerte (Absatzplanung):** Ein Reset der Planungswerte löscht **keine** Notizen — Notizen sind unabhängig von den Planungswerten gespeichert.
- **Produkt / Kategorie wird aus dem KPI-Modell entfernt:** Die zugehörigen Notizen bleiben in der DB, sind aber nicht mehr sichtbar (da die Zeile nicht mehr gerendert wird). Kein automatisches Löschen.

## Technical Requirements

- Neue Tabelle in Supabase: `planung_notizen` mit Spalten: `id`, `seite`, `zeilen_schluessel`, `kw` (int), `jahr` (int), `notiz_text`, `created_at`, `updated_at`
- API-Endpunkt: `GET/POST/PUT/DELETE /api/planung-notizen`
- RLS: Alle eingeloggten Nutzer dürfen lesen und schreiben (wie im restlichen System)
- Performance: Notizen werden beim Laden der Planungsseite einmalig als Bulk geladen (alle Notizen für die aktuelle Seite und den aktuellen Planungshorizont) — kein Einzelabruf pro Zelle
- Das Notiz-Overlay soll keine eigene Route/URL haben — es ist ein UI-State auf der Planungsseite

---

## Tech Design (Solution Architect)

### Übersicht

Das Feature wird als **wiederverwendbare Schicht** auf alle Planungsseiten aufgesetzt — d.h. Hook, Komponenten und API sind seitenunabhängig. Jede Planungsseite übergibt nur ihren `seite`-Bezeichner (z.B. `"absatzplanung"`) und die zellspezifischen Keys, die bereits existieren.

---

### Komponenten-Struktur

```
Planungsseite (z.B. AbsatzplanungTabelle)
├── Planungstabelle (bestehend)
│   └── Pro editierbare Zelle
│       └── PlanungNotizIndikator  [NEU]
│           (kleines Icon oben rechts, sichtbar wenn Notiz vorhanden)
│           (Tooltip mit Notiztext beim Hover)
└── Betragsselektion-Bereich (bestehend, unten rechts)
    └── PlanungNotizButton  [NEU]
        (erscheint nur bei genau 1 editierbarer selektierter Zelle)
        → öffnet PlanungNotizFormular

PlanungNotizFormular  [NEU]  (shadcn Dialog — Overlay)
├── Überschrift mit Zellen-Label (z.B. "Notiz — Produkt X · KW24 / 2026")
├── Textarea (mehrzeilig, vorausgefüllt wenn Notiz existiert)
├── Button "Speichern"
├── Button "Abbrechen"
└── Button "Notiz löschen" (nur sichtbar wenn Notiz bereits existiert)
    └── Inline-Bestätigung vor dem Löschen
```

---

### Datenmodell

**Neue Tabelle: `planung_notizen`**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID (PK) | Automatisch generiert |
| `seite` | Text | Planungsseite, z.B. `"absatzplanung"`, `"einnahmenplanung"` |
| `zellen_schluessel` | Text | Eindeutiger Zell-Key (enthält bereits KW + Jahr, s.u.) |
| `notiz_text` | Text | Freier Notiztext |
| `created_at` | Timestamp | Automatisch |
| `updated_at` | Timestamp | Automatisch bei Änderung |

**Unique Constraint:** `(seite, zellen_schluessel)` — pro Zelle nur eine Notiz.

**Zell-Key-Format** (wiederverwendet das bestehende Key-System):
- Absatz-Zellen: `sku:{skuId}:{plattformId}:{year}:{week}:absatz`
- VK-Zellen: `vk:{produktId}:{plattformId}:{year}:{week}:vk`
- Einnahmen-Zellen: `einnahmen:{kategorieId}:{year}:{week}`

Durch das Einbauen von KW + Jahr **direkt im Key** bleibt die Notiz automatisch an der konkreten Woche — kein eigenes `kw`/`jahr`-Feld nötig. Liegt eine KW nicht mehr im Planungshorizont, wird die Notiz schlicht nicht geladen.

---

### API-Endpunkt

**`/api/planung-notizen`**

| Methode | Zweck |
|---------|-------|
| `GET ?seite=absatzplanung&zellen_schluessel=sku:…:24:…,vk:…` | Alle Notizen für eine Seite + Schlüsselliste laden (Bulk) |
| `PUT` | Notiz upserten (Erstellen oder Überschreiben) |
| `DELETE ?seite=…&zellen_schluessel=…` | Notiz löschen |

Kein POST-Endpunkt nötig — PUT übernimmt Erstellen und Aktualisieren (Upsert via `ON CONFLICT`).

---

### Custom Hook: `usePlanungNotizen`

Wird von jeder Planungsseite eingebunden:

```
usePlanungNotizen(seite: string, zellenSchluessel: string[])
→ gibt zurück:
  - notizen: Map<cellKey, string>       (alle geladenen Notizen)
  - upsertNotiz(key, text)              (speichern/überschreiben)
  - deleteNotiz(key)                    (löschen)
  - loading: boolean
```

**Lade-Strategie:** Alle Notizen für die Seite und den aktuellen Planungshorizont werden **einmalig beim Mount** per Bulk-Request geladen. Keine Einzel-Abfragen pro Zelle. Updates werden **optimistisch** sofort im lokalen State reflektiert und async in der DB persistiert.

---

### Integration in bestehende Tabellen

**Selektions-Check** (bestehende `selectedCells: Map<string, number>`):
- `selectedCells.size === 1` → genau eine Zelle selektiert → Notiz-Button anzeigen
- Die ausgewählte Cell-Key wird aus `selectedCells.keys().next().value` gelesen
- Nur editierbare Zellen können selektiert werden (Aggregate-Rows haben keine Cell-Keys im selectedCells-Map) → kein extra Filter nötig

**Notiz-Indikator in der Zelle:**
- Jede Zelle bekommt `position: relative`
- `PlanungNotizIndikator` wird als absolut positioniertes Element oben rechts eingebettet
- Prüft: `notizen.has(cellKey)` → falls ja, Icon anzeigen
- shadcn `Tooltip` für den Hover-Text (bereits installiert)

---

### Shadcn-Komponenten (alle bereits vorhanden)

| Komponente | Verwendung |
|------------|------------|
| `Dialog` | Notiz-Formular Overlay |
| `Textarea` | Freitext-Eingabefeld |
| `Button` | Speichern / Abbrechen / Löschen |
| `Tooltip` | Notiztext beim Hover über das Icon |

Keine neuen Pakete notwendig. Das Icon (z.B. `MessageSquare` oder `StickyNote`) kommt aus `lucide-react` (bereits installiert).

---

### RLS (Row Level Security)

Gleiche Regel wie im restlichen System: Alle eingeloggten Nutzer dürfen lesen, schreiben und löschen. Keine Nutzer-spezifischen Filter.

---

### Nicht im Scope (bewusste Abgrenzung)

- Kein Echtzeit-Sync zwischen Browser-Tabs (Supabase Realtime)
- Keine Versionierung / History von Notizen
- Kein automatisches Löschen bei entfernten Produkten/Kategorien

## QA Test Results

**QA Date:** 2026-06-04
**Result:** APPROVED — keine Critical/High Bugs

### Automated Tests

| Suite | Tests | Ergebnis |
|-------|-------|----------|
| Vitest — API Route (`route.test.ts`) | 18 | ✅ alle bestanden |
| Vitest — Hook (`use-planung-notizen.test.ts`) | 14 | ✅ alle bestanden |
| Playwright E2E (`PROJ-53-zellen-notizen-planung.spec.ts`) | 12 | ✅ alle bestanden |

### Acceptance Criteria

#### Notiz-Button — Sichtbarkeit
- [x] Button erscheint bei genau einer editierbaren Zelle ausgewählt
- [x] Button ist nicht sichtbar wenn keine Zelle ausgewählt
- [x] Button ist nicht sichtbar bei Mehrfachselektion
- [x] Button ist nicht sichtbar bei Aggregations-/Summen-Zeilen
- [x] Button-Label "Notiz bearbeiten" wenn Notiz existiert, "Notiz hinzufügen" sonst
- [x] Notiz-Button als eigenständige Karte — separat vom Summenfeld (über dem Sum-Panel)

#### Notiz-Formular (Overlay)
- [x] shadcn Dialog öffnet sich per Klick auf Button
- [x] Überschrift mit Zellenidentifikation (Produkt-Name · KWxx / yyyy)
- [x] Mehrzeiliges Textarea (4 Zeilen, resize-none)
- [x] Button "Speichern" schließt Formular
- [x] Button "Abbrechen" schließt ohne Änderungen
- [x] Button "Notiz löschen" nur bei bestehender Notiz sichtbar
- [x] Textarea vorausgefüllt bei Bearbeiten
- [x] Textarea autoFocus beim Öffnen
- [x] Escape schließt Formular (via onKeyDown-Handler)
- [x] Außenklick schließt (shadcn Dialog-Standard)

#### Zellen-Indikator (Symbol)
- [x] Kleines StickyNote-Icon (amber, h-2 w-2) in oberer rechter Ecke der Zelle
- [x] Tooltip mit Notiztext beim Hover (max 300 Zeichen, dann "…")
- [x] Icon nicht klickbar (stopPropagation verhindert Formularzugriff über Icon)

#### Notiz-Persistenz & Wochenbezug
- [x] Eindeutige Zellen-ID mit KW+Jahr direkt im Key
- [x] Supabase-Persistenz mit Unique Constraint (seite, zellen_schluessel)
- [x] Notizen bleiben bei KW-Vorrücken an ihrer gespeicherten KW
- [x] Für alle eingeloggten Nutzer sichtbar (RLS: authenticated → all)

#### Löschen mit Bestätigung
- [x] Inline Confirm ("Wirklich löschen?" + "Ja, löschen" + "Abbrechen")
- [x] Löschen entfernt Symbol sofort (optimistic update)

#### Alle Planungsseiten
- [x] Absatzplanung: Notizen auf Absatz-Felder (sku:) und VK-Felder (vk:)
- [x] Einnahmenplanung: Notizen auf Leaf-Kategorie-Zellen (kein row:-Prefix)

#### Edge Cases
- [x] Leerer/Whitespace-Text → behandelt als Löschen
- [x] Tooltip kürzt bei > 300 Zeichen mit "…"

### Bugs

#### Low — Unhandled Promise Rejection bei Netzwerkfehler
- **Beschreibung:** `usePlanungNotizen` hat keinen `catch`-Block in der `load()`-Funktion. Bei einem Netzwerkfehler (fetch throws) propagiert die Exception als unhandled promise rejection in der Browser-Konsole. Der UI-Zustand bleibt korrekt (loading=false, leere Map), aber die Konsole zeigt einen Fehler.
- **Reproduzieren:** Netzwerkverbindung trennen und Seite neu laden
- **Auswirkung:** Nur Entwickler-Konsole betroffen, kein UI-Problem — Low Severity

### Security Audit
- ✅ Alle 3 API-Methoden hinter `requireAuth()` (401 für unauthentifizierte)
- ✅ Zod-Validierung auf PUT-Endpoint (min/max Längen)
- ✅ Parameterized Queries via Supabase (keine SQL-Injection möglich)
- ✅ XSS-sicher: React escaped Notiztext automatisch
- ✅ RLS-Policies auf `planung_notizen`-Tabelle (alle 4 Operationen)
- ✅ API gibt nur `zellen_schluessel` und `notiz_text` zurück (keine sensiblen Felder)

### Regression
- ✅ Bestehende Betragsselektion (Summenfeld) unverändert funktionsfähig
- ✅ Absatzplanung-Tabelle rendert korrekt
- ✅ Einnahmenplanung-Tabelle rendert korrekt
- ✅ Andere Planungsseiten weiterhin erreichbar

## Deployment
_To be added by /deploy_
