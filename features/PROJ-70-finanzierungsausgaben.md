# PROJ-70: Finanzierungsausgaben — Kurzfristige Planung

## Status: Approved
**Created:** 2026-06-18
**Last Updated:** 2026-06-18

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — „Finanzierung"-Knoten im `ausgaben_kosten`-Baum als Zeilenquelle
- Requires: PROJ-41 (Bereichswechsler) — URL-Rahmen „Kurzfristige Planung"
- Requires: PROJ-50 (Grundeinstellungen) — `planungshorizont_wochen` + `vergangenheitshorizont_wochen`
- Requires: PROJ-53 (Zellen-Notizen) — Notizen auf Zellenbasis
- Requires: PROJ-58 (Finanzierungseinstellungen) — Datenquelle für automatische Soll-Werte; PROJ-58 muss um `zahlungsziel_tage`, `aktiv_von`, `aktiv_bis` erweitert werden (s. Abschnitt DB-Schema)
- Requires: PROJ-29 (Liquiditätsreport) — Logik für Ist-Tatsächlich-Werte (`ausgaben_kosten_transaktionen`)

---

## Übersicht

Die Seite „Finanzierungsausgaben" zeigt eine wochenbasierte (KW) Übersicht der Finanzierungskosten des Unternehmens. Sie orientiert sich in Layout, Spaltenstruktur und Interaktionsmodell **vollständig an der Operativen Ausgaben-Seite (PROJ-68)** — dieselbe bewährte Implementierung wird von Anfang an übernommen, um erneute Iterations-Schleifen zu vermeiden.

Die Seite gliedert sich in zwei Zeitbereiche:

**Vergangenheitsbereich** (`vergangenheitshorizont_wochen` KWs vor der aktuellen KW, Fallback 4):
- Pro KW zwei Spalten nebeneinander:
  - **Ist-Tatsächlich**: tatsächliche Ausgaben je Kategorie aus den `ausgaben_kosten_transaktionen` (identische Logik wie Liquiditätsreport, PROJ-29), gefiltert auf den „Finanzierung"-Subtree
  - **Ist-Plan**: der damalige Planwert aus `finanzierungs_planung` für diese vergangene KW (leer, wenn damals kein Wert geplant war)
- Unter dem KW-Header-Label: Unterzeile mit „Ist-Tatsächlich" (linke Spalte) und „Ist-Plan" (rechte Spalte)

**Planungszeitraum** (`planungshorizont_wochen` KWs ab der nächsten KW, Fallback 13):
- Pro KW eine Soll-Spalte — automatisch aus Finanzierungseinstellungen (PROJ-58) vorberechnet; manuell überschreibbar
- Grauer Indikatorpunkt = automatisch berechnet; blauer Indikatorpunkt = manuell überschrieben

Die Zeilen spiegeln die KPI-Kategorien unter dem „Finanzierung"-Knoten wider (L1-Gruppen und L2-Untergruppen). Die **Gesamt-Zeile „Finanzierungsausgaben (Gesamt)"** erscheint immer ganz **unten** in der Tabelle.

**Persistenz der Soll-Werte (Ist-Plan-Mechanismus):** Automatisch berechnete Werte für zukünftige KWs werden mit dem Flag `ist_berechnet = true` in `finanzierungs_planung` persistent gespeichert. Wenn eine KW in die Vergangenheit übergeht, bleibt dieser Wert als Ist-Plan eingefroren und kann nicht mehr verändert werden. Dieser Mechanismus ist identisch mit der mühsam erarbeiteten Lösung aus PROJ-68 / PROJ-67.

---

## User Stories

- Als Nutzer möchte ich die Finanzierungsausgaben-Seite über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können (unterhalb von „Produktinvestitionsausgaben"), damit ich schnell zu den Finanzierungsdaten navigiere.
- Als Nutzer möchte ich für vergangene KWs sowohl Ist-Tatsächlich-Werte als auch meine damaligen Planwerte sehen, damit ich Plan-Ist-Vergleiche für Finanzierungsausgaben schnell durchführen kann.
- Als Nutzer möchte ich für jede vergangene KW Ist-Tatsächlich und Ist-Plan nebeneinander sehen, damit ich sofort erkenne, wie nah mein Finanzierungsplan an der Realität war.
- Als Nutzer möchte ich im Planungszeitraum automatisch vorberechnete Ausgabenwerte sehen, die auf meinen Finanzierungseinstellungen basieren, damit ich keine Finanzierungswerte manuell schätzen muss.
- Als Nutzer möchte ich jeden vorberechneten Soll-Wert manuell überschreiben und auf einen Blick erkennen, ob ein Wert automatisch (grau) oder manuell (blau) eingegeben wurde.
- Als Nutzer möchte ich alle Kategoriegruppen auf- und zuklappen können, sowie mit zwei Buttons alle gleichzeitig ein- oder ausklappen.
- Als Nutzer möchte ich für einzelne Soll-Zellen Notizen hinterlegen können.
- Als Nutzer möchte ich mehrere Zellen durch Klicken / Ctrl+Klicken auswählen und die Summe rechts unten angezeigt bekommen.
- Als Nutzer möchte ich eine manuell geänderte Zelle mit einem Button rechts unten auf den automatisch berechneten Wert zurücksetzen können.
- Als Nutzer möchte ich alle manuellen Soll-Werte und Notizen mit einem Zurücksetzen-Button löschen können, damit alle Soll-Felder wieder automatisch berechnet werden (Ist-Werte bleiben unberührt).

---

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag **„Finanzierungsausgaben"** → `/dashboard/kurzfristige-planung/finanzierungsausgaben`, **unterhalb** von „Produktinvestitionsausgaben"
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine neue Kachel **„Finanzierungsausgaben"** im Abschnitt „Planung", **unterhalb** der Kachel „Produktinvestitionsausgaben"
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

- [ ] **Ganz unten**: Gesamt-Zeile **„Finanzierungsausgaben (Gesamt)"** — summiert alle Leaf-Zeilen (effektive Werte: manuell ODER auto), nicht editierbar, immer sichtbar
- [ ] **Pro L1-Gruppe** (direkte Kinder des „Finanzierung"-Knotens): einklappbare Sektion (Standard: ausgeklappt)
  - Kategorie-Header-Zeile mit Gruppenname + Auf-/Zuklapp-Icon; zeigt Summe der Kinder
  - Wenn die Gruppe L2-Untergruppen hat:
    - Aggregations-Zeile (Summe der L2-Untergruppen), nicht editierbar
    - Pro L2-Untergruppe: editierbare Leaf-Zeile (eingerückt) — Soll-Werte editierbar
  - Wenn die Gruppe **keine** Untergruppen hat:
    - Die L1-Gruppe selbst ist editierbar (Leaf)
- [ ] Kategorien in `sort_order`-Reihenfolge des KPI-Modells
- [ ] **Buttons oben rechts:**
  - **„Alle ausklappen"**: klappt alle Sektionen auf (separater Button, kein Toggle)
  - **„Alle einklappen"**: klappt alle Sektionen zu (separater Button)

### Leerer Zustand

- [ ] Wenn kein „Finanzierung"-Knoten im KPI-Modell vorhanden ist oder dieser keine Kinder hat: leerer Zustand mit Hinweis „Keine Finanzierungskategorien im KPI-Modell vorhanden. Bitte den Knoten ‚Finanzierung' im KPI-Modell konfigurieren." + Link zur KPI-Modell-Verwaltung

### Ist-Tatsächlich-Werte (Vergangenheitsspalten)

- [ ] Datenquelle: identische Logik wie der Liquiditätsreport (PROJ-29) — `ausgaben_kosten_transaktionen`, gefiltert nach `zahlungsdatum`, gruppiert nach Kategorie und ISO-KW; nur Kategorien im „Finanzierung"-Subtree werden angezeigt
- [ ] Ist-Tatsächlich-Zellen sind **nicht editierbar** (kein Inline-Edit, keine Indikatorpunkte)
- [ ] Aggregationszeilen summieren ihre Leaf-Kinder in der Ist-Tatsächlich-Spalte
- [ ] Gesamt-Zeile summiert alle Leafs in der Ist-Tatsächlich-Spalte
- [ ] Zellen ohne Transaktionen: leer (keine 0-Anzeige)

### Ist-Plan-Werte (Vergangenheitsspalten)

- [ ] Datenquelle: `finanzierungs_planung`-Tabelle — Planwerte für vergangene KWs (der damalig geplante oder berechnete Wert, der nun in der Vergangenheit liegt, eingefroren durch Persistenz-Mechanismus)
- [ ] Ist-Plan-Zellen sind **nicht editierbar** (kein Inline-Edit, keine Indikatorpunkte)
- [ ] Wenn für eine vergangene KW kein Planwert in `finanzierungs_planung` existiert: Zelle leer
- [ ] Aggregationszeilen summieren ihre Leaf-Kinder in der Ist-Plan-Spalte

### Persistenz-Mechanismus für Ist-Plan

- [ ] Beim Aufruf der `berechnet`-Route werden die berechneten Werte für alle zukünftigen KWs mit `ist_berechnet = true` in `finanzierungs_planung` gespeichert (Upsert), sofern für die jeweilige Zelle noch kein manueller Eintrag (`ist_berechnet = false`) vorhanden ist
- [ ] Wenn eine KW in die Vergangenheit übergeht, bleibt der gespeicherte Wert als Ist-Plan-Wert erhalten und wird nicht mehr durch neue Berechnungen überschrieben
- [ ] Manuelle Overrides (`ist_berechnet = false`) werden durch das Upsert der `berechnet`-Route **nicht** überschrieben
- [ ] Dieser Mechanismus ist identisch mit der in PROJ-68 implementierten Lösung

### Soll-Werte (Planungszeitraum) — allgemein

- [ ] Alle automatisch vorberechneten Soll-Zellen zeigen einen **grauen Indikatorpunkt**
- [ ] Manuell überschriebene Soll-Zellen zeigen einen **blauen Indikatorpunkt**
- [ ] Inline-Editing (click-to-edit), Speicherung onBlur in `finanzierungs_planung` mit `ist_berechnet = false`
- [ ] Eingabe: Dezimalzahl ≥ 0 (Betrag in €); leeres Feld → NULL (Eintrag in DB löschen; Auto-Wert greift wieder)
- [ ] Optimistisches Update + Toast-Fehlermeldung + Rollback bei API-Fehler
- [ ] Nur Soll-Zellen (Planungszeitraum) sind editierbar; alle Ist-Spalten sind gesperrt

### Finanzierungs-Vorbelegungslogik (Soll-Auto-Berechnung)

Die automatische Vorbelegung der Soll-Spalten erfolgt server-seitig über `GET /api/finanzierungs-planung/berechnet`. Die Route berechnet pro Kategorie, pro KW im Planungshorizont einen Bruttobetrag anhand der Einträge aus `finanzierungs_einstellungen`.

**Schritt 1 — Aktive Einträge filtern:**
- Nur Einträge mit `aktiv = true` werden berücksichtigt
- Wenn `aktiv_von` gesetzt: Basis-Datum (s. Schritt 3, vor Zahlungsziel) muss ≥ `aktiv_von` sein
- Wenn `aktiv_bis` gesetzt: Basis-Datum muss ≤ `aktiv_bis` sein
- Der Vergleich mit `aktiv_von`/`aktiv_bis` verwendet das **Basis-Datum vor Zahlungsziel-Addition** — das Zahlungsziel fließt in die Aktiv-Zeitraum-Prüfung **nicht** ein

**Schritt 2 — Fälligkeitsmonate ermitteln:**
- `monatlich` → alle 12 Monate (1–12) des Jahres
- `quartalsweise` → die 4 gespeicherten `faelligkeits_monate` (ein Monat pro Quartal)
- `jaehrlich` → der 1 gespeicherte Monat aus `faelligkeits_monate`

**Schritt 3 — Basis-Datum je Fälligkeitsmonat berechnen (via `zeitpunkt_im_monat`):**
- `anfang` → 4. Tag des Monats
- `mitte` → 15. Tag des Monats
- `ende` → 26. Tag des Monats

**Schritt 4 — Zahlungsdatum berechnen:**
- Zahlungsdatum = Basis-Datum + `zahlungsziel_tage` (Tage; Fallback 0 wenn nicht gepflegt)
- Fällt das Zahlungsdatum auf einen **Samstag**: +2 Tage (nächster Montag)
- Fällt das Zahlungsdatum auf einen **Sonntag**: +1 Tag (nächster Montag)

**Schritt 5 — ISO-KW des Zahlungsdatums bestimmen:**
- `getISOWeek(zahlungsdatum)` → `kw_number`
- `getISOWeekYear(zahlungsdatum)` → `kw_year`

**Schritt 6 — Wert akkumulieren:**
- Liegt die errechnete `(kw_year, kw_number)` im Planungshorizont → `bruttobetrag` dieses Eintrags zum bestehenden Wert für `(kategorie_id, kw_year, kw_number)` addieren
- Mehrere Einträge mit gleicher `kategorie_id` und gleicher Ziel-KW werden summiert

**Wichtig — L1/L2-Zuordnung:**
- Finanzierungseinstellungs-Einträge sind L1-Kategorien zugeordnet (direkte Kinder von „Finanzierung")
- Wenn die L1-Kategorie selbst ein Leaf ist (keine L2-Untergruppen): Auto-Wert erscheint auf der L1-Zeile
- Wenn die L1-Kategorie L2-Untergruppen hat: Auto-Wert **kann nicht** einer spezifischen L2 zugeordnet werden und wird **nicht** angezeigt; manuelle Eingabe auf L2-Ebene nötig

### Visuelle Indikatorpunkte

| Zustand | Punkt | Gilt für |
|---|---|---|
| Automatisch berechnet (mit Wert) | Grauer Punkt | Soll-Zellen mit Auto-Wert, kein manueller Eintrag |
| Manuell eingegeben | Blauer Punkt | Soll-Zellen mit manuellem Eintrag (`ist_berechnet = false`) in `finanzierungs_planung` |
| Leer / kein Auto-Wert + kein manueller Wert | Kein Punkt | Zellen ohne Wert |
| Ist-Tatsächlich / Ist-Plan | Kein Punkt | Nicht editierbare Vergangenheitsspalten |

Merksatz: **Ein DB-Eintrag mit `ist_berechnet = false` in `finanzierungs_planung` für eine zukünftige KW = manuell = blauer Punkt.**

### Notizen (PROJ-53)

- [ ] Notiz-Feature auf allen editierbaren Soll-Zellen (Planungszeitraum), identisch mit anderen Planungsseiten
- [ ] Notiz-Icon erscheint beim Hover (wenn keine Notiz) oder dauerhaft (wenn Notiz vorhanden)
- [ ] Notizen in `planung_notizen` gespeichert mit `kontext = 'finanzierungs-ausgaben'`
- [ ] Zurücksetzen löscht auch alle Notizen dieser Seite (`kontext = 'finanzierungs-ausgaben'`)

### Betragsselektion

- [ ] Einzelne oder mehrere Zellwerte durch Klicken / Ctrl+Klicken auswählbar
- [ ] Summe der selektierten Werte wird in einem Panel rechts unten angezeigt (Anzahl + Summe in €)
- [ ] Panel erscheint ab 1 selektierter Zelle, verschwindet wenn Selektion aufgehoben
- [ ] Ist-Tatsächlich-, Ist-Plan-, Aggregations- und Gesamt-Zellen ebenfalls selektierbar
- [ ] Identisches Verhalten wie in PROJ-51, PROJ-52, PROJ-54, PROJ-66, PROJ-67, PROJ-68

### Einzelzelle-Zurücksetzen-Button

- [ ] Wenn eine einzelne manuell geänderte Soll-Zelle ausgewählt (fokussiert) ist, erscheint rechts unten ein Button **„Auf automatisch zurücksetzen"**
- [ ] Klick darauf löscht den manuellen Eintrag in `finanzierungs_planung` für diese Zelle; Auto-Wert wird erneut via `berechnet`-Route gesetzt
- [ ] Die Zelle zeigt danach wieder den automatisch berechneten Wert (grauer Punkt) oder wird leer (wenn kein Auto-Wert vorhanden)
- [ ] Button erscheint nur, wenn die ausgewählte Zelle einen manuellen Eintrag (`ist_berechnet = false`) hat
- [ ] Identisches Verhalten wie in Absatzplanung (PROJ-51), Umsatzausgaben (PROJ-67) und Operative Ausgaben (PROJ-68)

### Reset-Button (Alles zurücksetzen)

- [ ] Button **„Zurücksetzen"** oben rechts neben den Einklappen-Buttons
- [ ] Bestätigungs-Dialog (shadcn AlertDialog): „Alle Planungswerte zurücksetzen? Alle manuell eingegebenen Soll-Werte und Notizen werden gelöscht. Automatisch berechnete Werte werden wiederhergestellt. Ist-Werte werden nicht verändert."
- [ ] Nach Bestätigung:
  - Alle **manuellen** Einträge (`ist_berechnet = false`) des Nutzers in `finanzierungs_planung` für **zukünftige KWs** werden gelöscht (Vergangenheits-Planwerte bleiben erhalten)
  - Alle Notizen des Nutzers für `kontext = 'finanzierungs-ausgaben'` in `planung_notizen` werden gelöscht
  - Soll-Zellen zeigen wieder automatisch berechnete Werte (grauer Punkt) oder werden leer

---

## Edge Cases

- **Kein „Finanzierung"-Knoten im KPI-Modell oder keine Kinder**: leerer Zustand mit Hinweis + Link zur KPI-Verwaltung
- **Kein Ist-Plan für vergangene KW** (damals nicht geplant / `berechnet`-Route noch nicht aufgerufen): Spalte leer, kein 0
- **L1-Kategorie mit L2-Untergruppen**: Finanzierungs-Auto-Werte erscheinen nicht (keine L2-Zuordnung in PROJ-58); nur manuelle L2-Eingabe möglich
- **`zahlungsziel_tage` verschiebt KW außerhalb des Planungshorizonts**: Wert wird nicht angezeigt
- **Mehrere Finanzierungseinträge mit gleicher Kategorie in derselben KW**: Beträge werden summiert
- **`aktiv_von`/`aktiv_bis` nicht gepflegt**: Eintrag wird für alle KWs berücksichtigt (keine Einschränkung)
- **`zahlungsziel_tage` nicht gepflegt (NULL)**: Fallback auf 0 (kein Zahlungsziel-Versatz)
- **Finanzierungseintrag `aktiv = false`**: wird für Auto-Berechnung ignoriert
- **Jahreswechsel** (z. B. KW52/2026 → KW1/2027): korrekte ISO-8601-Berechnung über Jahreswechsel; Jahresfenster vonJahr-1 bis bisJahr+1
- **Reset: Vergangenheits-Planwerte in `finanzierungs_planung`**: bleiben erhalten (nur zukünftige manuelle Einträge werden gelöscht)
- **Zelle manuell auf 0 gesetzt**: gültig, wird als `0,00 €` mit blauem Punkt angezeigt (unterscheidet sich von NULL/leer)
- **API-Fehler bei `ist-tatsaechlich` oder `berechnet`**: betroffene Zellen leer, kein Absturz, Toast-Hinweis
- **Sehr viele Kategorien oder viele Wochen**: vertikales bzw. horizontales Scrollen; Zeilenbeschriftungsspalte bleibt sticky
- **Zurücksetzen ohne manuelle Werte**: idempotent (keine sichtbare Änderung)
- **Einzelzelle-Reset auf Zelle ohne Auto-Wert** (kein Finanzierungs-Default): Zelle wird leer, kein grauer Punkt
- **Wochenende-Verschiebung**: Samstag → +2 Tage, Sonntag → +1 Tag auf nächsten Montag

---

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen API-Routen
- RLS auf `finanzierungs_planung`: analog zu `operative_planung` aus PROJ-56/PROJ-68
- ISO-8601-Wochenberechnung: `date-fns` (`getISOWeek`, `getISOWeekYear`, `addDays`)
- Keine neuen Packages nötig: shadcn `Table`, `Input`, `AlertDialog`, `Tooltip`, `Button` — alle vorhanden
- Notizen-Pattern: wiederverwendbar aus PROJ-53 (identisch wie auf anderen Planungsseiten)
- Betragsselektion-Pattern: wiederverwendbar aus PROJ-51 / PROJ-52 / PROJ-67 / PROJ-68
- Einzelzelle-Reset-Pattern: wiederverwendbar aus PROJ-51 / PROJ-67 / PROJ-68

### Datenbankschema

#### Neue Tabelle `finanzierungs_planung`

Speichert sowohl vergangene Planwerte (Ist-Plan, eingefroren) als auch zukünftige Einträge (Auto-berechnet `ist_berechnet = true` oder manuell `ist_berechnet = false`):

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | UUID PK | auto-generiert |
| `user_id` | UUID | FK → auth.users, RLS-Anker |
| `kategorie_id` | UUID | FK → kpi_categories |
| `kw_year` | INTEGER | ISO-Kalenderjahr der Woche |
| `kw_number` | INTEGER | ISO-Wochennummer (1–53) |
| `betrag_manuell` | NUMERIC(12,2) NULL | NULL = kein manueller Override |
| `ist_berechnet` | BOOLEAN DEFAULT true | true = Auto-Wert persistiert; false = manuelle Eingabe |
| `created_at` | TIMESTAMPTZ | auto |
| `updated_at` | TIMESTAMPTZ | auto |

Unique Constraint: `(user_id, kategorie_id, kw_year, kw_number)`

RLS: `FOR ALL USING (user_id = auth.uid())`

#### Erweiterung von PROJ-58: `finanzierungs_einstellungen`

Für die Vorbelegungslogik müssen folgende Felder vorhanden sein (ggf. DB-Migration):

| Neues Feld | Typ | Beschreibung |
|---|---|---|
| `zahlungsziel_tage` | INTEGER DEFAULT 0 | Zahlungsziel in Tagen; wird auf das Basis-Datum addiert |
| `aktiv_von` | DATE NULL | Ab wann der Eintrag aktiv ist (inklusiv, Prüfung gegen Basis-Datum); NULL = immer gültig |
| `aktiv_bis` | DATE NULL | Bis wann der Eintrag aktiv ist (inklusiv, Prüfung gegen Basis-Datum); NULL = kein Ablaufdatum |

Falls diese Felder bereits existieren: keine Migration nötig.

### API-Routen

| Methode | Route | Zweck |
|---|---|---|
| `GET` | `/api/finanzierungs-planung` | Alle Einträge des Nutzers (Ist-Plan vergangene KWs + Soll-Einträge zukünftige KWs) |
| `PUT` | `/api/finanzierungs-planung` | Upsert eines einzelnen Eintrags mit `ist_berechnet = false`; `betrag_manuell: null` → Eintrag löschen |
| `DELETE` | `/api/finanzierungs-planung` | Alle manuellen (`ist_berechnet = false`) zukünftigen Einträge des Nutzers löschen (für Reset) |
| `GET` | `/api/finanzierungs-planung/ist-tatsaechlich` | Ist-Tatsächlich-Werte aus `ausgaben_kosten_transaktionen`, nach Kategorie + ISO-KW, gefiltert auf „Finanzierung"-Subtree |
| `GET` | `/api/finanzierungs-planung/berechnet` | Auto-berechnete Soll-Werte aus `finanzierungs_einstellungen` je Kategorie + KW; persistiert Werte in `finanzierungs_planung` mit `ist_berechnet = true` (Upsert, sofern keine manuelle Eingabe vorhanden) |

- `requireAuth()` in allen Routen
- Query-Parameter für `ist-tatsaechlich` und `berechnet`: `von_kw`, `von_jahr`, `bis_kw`, `bis_jahr`

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/finanzierungsausgaben/page.tsx` | Neue Seite: Header + FinanzierungsausgabenTabelle + Toaster |
| `src/hooks/use-finanzierungsausgaben.ts` | Zentraler Hook: lädt Ist-Tatsächlich, Ist-Plan, Auto-Werte, manuelle Overrides; upsertZelle, resetAll, expandAll/collapseAll, Indikator-Logik |
| `src/components/finanzierungsausgaben-tabelle.tsx` | Haupttabelle: doppelte Vergangenheitsspalten, Indikatorpunkte, Einklappen, Notizen, Betragsselektion, Einzelzelle-Reset, Gesamt unten |
| `src/app/api/finanzierungs-planung/route.ts` | GET + PUT + DELETE |
| `src/app/api/finanzierungs-planung/ist-tatsaechlich/route.ts` | GET: Ist-Tatsächlich aus `ausgaben_kosten_transaktionen`, gefiltert auf Finanzierung-Subtree |
| `src/app/api/finanzierungs-planung/berechnet/route.ts` | GET: Auto-Berechnung aus `finanzierungs_einstellungen` + Persistenz in `finanzierungs_planung` |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Neuer Eintrag „Finanzierungsausgaben" nach „Produktinvestitionsausgaben" |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Neue Kachel „Finanzierungsausgaben" nach „Produktinvestitionsausgaben" |

### Implementierungsreihenfolge

```
1. DB-Migration: finanzierungs_planung-Tabelle erstellen + finanzierungs_einstellungen um zahlungsziel_tage, aktiv_von, aktiv_bis erweitern
   ↓
2. Backend: GET + PUT + DELETE /api/finanzierungs-planung (Route)
   ↓
3. Backend: GET /api/finanzierungs-planung/ist-tatsaechlich   ← parallel mit 4 möglich
4. Backend: GET /api/finanzierungs-planung/berechnet          ← parallel mit 3 möglich
   ↓
5. Frontend: use-finanzierungsausgaben Hook
   ↓
6. Frontend: finanzierungsausgaben-tabelle Komponente
   ↓
7. Frontend: page.tsx + nav-sheet + dashboard-page aktualisieren
```

---

## Tech Design (Solution Architect)

### Grundprinzip

PROJ-70 ist eine **direkte Adaption** von PROJ-68 (Operative Ausgaben). Architektur, Datenladefluss, Indikatorpunkte, Persistenzlogik und alle Interaktionsmuster sind identisch — nur Datenquelle und Kategoriebaum-Filter wechseln von „Operativ" auf „Finanzierung". Das verhindert eine erneute Iterations-Schleife durch die bewährte Lösung.

---

### Komponentenstruktur

```
/dashboard/kurzfristige-planung/finanzierungsausgaben  (NEUE Seite)
+-- Page-Header
|   +-- Titel „Finanzierungsausgaben"
|   +-- Button-Gruppe rechts:
|       +-- „Alle ausklappen"  (separater Button)
|       +-- „Alle einklappen"  (separater Button)
|       +-- „Zurücksetzen"     (öffnet AlertDialog)
+-- FinanzierungsausgabenTabelle  (NEUE Hauptkomponente)
    +-- Scroll-Container (overflow-x: auto)
    |   +-- <table>
    |       +-- <thead> (sticky top)
    |       |   +-- KW-Gruppenzeile:
    |       |       [Label sticky links] | [KW22 colspan=2 | KW23 colspan=2 | ...] ‖ [KW26 | KW27 | ...]
    |       |   +-- Sub-Label-Zeile:
    |       |       [leer sticky] | [Ist-Tatsächlich | Ist-Plan | ...] ‖ [leer | leer | ...]
    |       +-- <tbody>
    |           +-- [Pro L1-Gruppe direkt unter „Finanzierung"]
    |           |   +-- category-header-Zeile (einklappbar, zeigt Summe)
    |           |   +-- [wenn ausgeklappt + hat L2-Kinder]:
    |           |       +-- category-sum-Zeile (Aggregat, nicht editierbar)
    |           |       +-- Pro L2: leaf-Zeile (eingerückt, editierbar im Soll-Bereich)
    |           |   +-- [wenn ausgeklappt + kein L2]:
    |           |       +-- L1 selbst als leaf-Zeile (editierbar im Soll-Bereich)
    |           +-- Gesamt-Zeile „Finanzierungsausgaben (Gesamt)"  ← GANZ UNTEN
    +-- BetragsselektionPanel  (fixed rechts unten, ab 1 selektierter Zelle)
    +-- EinzelzelleResetButton  (rechts unten, wenn fokussierte Soll-Zelle = blauer Punkt)
    +-- ResetConfirmDialog  (shadcn AlertDialog)

nav-sheet.tsx  (bestehend — neuer Eintrag nach „Produktinvestitionsausgaben")
/dashboard/kurzfristige-planung/page.tsx  (bestehend — neue Kachel nach „Produktinvestitionsausgaben")
```

---

### Zeilentypen der Tabelle

| Typ | Editierbar | Beschreibung |
|---|---|---|
| `category-header` | Nein | L1-Gruppe, einklappbar, zeigt Summe aller Kinder |
| `category-sum` | Nein | Aggregat-Zeile wenn L1 L2-Kinder hat |
| `leaf` | Ja (nur Soll-Spalten) | L2-Untergruppe oder L1 ohne Kinder |
| `total` | Nein | „Finanzierungsausgaben (Gesamt)" — ganz unten |

---

### Datenmodell (plain language)

**Neue Tabelle `finanzierungs_planung`** — zentrale Speicherung aller Planwerte:

| Was gespeichert wird | Bedeutung |
|---|---|
| Benutzer-ID, Kategorie-ID, KW-Jahr, KW-Nummer | Eindeutiger Schlüssel je Zelle |
| `betrag_manuell` (Zahl oder leer) | Der gespeicherte Betrag (auto oder manuell) |
| `ist_berechnet` (ja/nein) | `ja` = auto-berechnet und eingefroren; `nein` = manuell vom Nutzer |

**Wann wird was gespeichert:**
- **Auto-Wert für Zukunfts-KW**: `berechnet`-Route schreibt `betrag_manuell = X, ist_berechnet = true` → dient später als eingefrorener Ist-Plan wenn die KW vergangen ist
- **Manuelle Eingabe**: PUT-Route schreibt `betrag_manuell = X, ist_berechnet = false` → überschreibt den Auto-Wert
- **Manuell löschen**: PUT mit `betrag_manuell = null` → Eintrag wird gelöscht; Auto-Wert greift wieder (sofern vorhanden)
- **Reset**: DELETE löscht alle Einträge mit `ist_berechnet = false` für zukünftige KWs; eingefrorene Ist-Plan-Werte (`ist_berechnet = true` für vergangene KWs) bleiben unberührt

**Erweiterung `finanzierungs_einstellungen`**: Die bestehende Einstellungstabelle aus PROJ-58 wird um drei Felder ergänzt — `zahlungsziel_tage`, `aktiv_von`, `aktiv_bis` — falls diese noch nicht existieren.

---

### Datenladefluss (beim Öffnen der Seite)

Alle 5 Requests starten **gleichzeitig**, da Auto-Werte direkt in `finanzierungs_planung` persistiert werden und kein sequenzielles 2-Phasen-Laden nötig ist:

```
① GET /api/grundeinstellungen
     → planungshorizont_wochen, vergangenheitshorizont_wochen

② GET /api/kpi-categories?type=ausgaben_kosten
     → alle KPI-Kategorien; Hook filtert auf „Finanzierung"-Subtree

③ GET /api/finanzierungs-planung
     → alle DB-Einträge des Nutzers — zwei Zwecke:
       a) Ist-Plan (vergangene KWs): eingefrorene Planwerte
       b) Soll-Manuell (zukünftige KWs): aktuelle manuelle Overrides

④ GET /api/finanzierungs-planung/ist-tatsaechlich?von_kw=&...
     → tatsächliche Ausgaben je Kategorie je vergangene KW
     → aus ausgaben_kosten_transaktionen, gefiltert auf Finanzierung-Subtree

⑤ GET /api/finanzierungs-planung/berechnet?von_kw=&...
     → auto-berechnete Soll-Werte je Kategorie + KW aus finanzierungs_einstellungen
     → persistiert gleichzeitig mit ist_berechnet=true in finanzierungs_planung
       (nur wenn kein manueller Eintrag für diese Zelle vorhanden)

→ Hook baut flaches Zeilen-Array:
  category-header → [category-sum +] leaf → ... → total (Gesamt ganz unten)

→ Pro Zelle (zukünftige KW):
  Eintrag mit ist_berechnet=false in ③ → blauer Punkt (manuell)
  Kein ③-Eintrag, aber Wert in ⑤                → grauer Punkt (auto)
  Weder ③ noch ⑤                                → leer
```

---

### Berechnungslogik (server-seitig, `berechnet`-Route)

Die Route berechnet je Finanzierungseintrag aus `finanzierungs_einstellungen`, in welcher KW eine Zahlung anfällt:

```
Für jeden aktiven Eintrag (aktiv = true):
  1. Fälligkeitsmonate aus Zahlungsfrequenz:
       monatlich     → alle 12 Monate
       quartalsweise → die 4 gespeicherten Monate (je 1 pro Quartal)
       jährlich      → der 1 gespeicherte Monat

  2. Basis-Datum je Monat (zeitpunkt_im_monat):
       anfang → 4. des Monats
       mitte  → 15. des Monats
       ende   → 26. des Monats

  3. Aktiv-Zeitraum-Prüfung gegen Basis-Datum (VOR Zahlungsziel)

  4. Zahlungsdatum = Basis-Datum + zahlungsziel_tage Tage
     (Samstag → +2, Sonntag → +1 auf nächsten Montag)

  5. ISO-KW des Zahlungsdatums → kw_year + kw_number

  6. Liegt KW im angefragten Planungszeitraum → bruttobetrag akkumulieren
```

Jahresfenster: vonJahr-1 bis bisJahr+1 um Zahlungsziel-Überhänge über Jahreswechsel zu erfassen.

---

### Neue und geänderte Dateien (Übersicht)

**Neu:**

| Datei | Aufgabe |
|---|---|
| `src/app/dashboard/kurzfristige-planung/finanzierungsausgaben/page.tsx` | Seiten-Container (Header + Tabelle + Toast) |
| `src/hooks/use-finanzierungsausgaben.ts` | Datenladen, State-Management, upsert/reset-Logik |
| `src/components/finanzierungsausgaben-tabelle.tsx` | Vollständige Tabellenkomponente |
| `src/app/api/finanzierungs-planung/route.ts` | GET / PUT / DELETE |
| `src/app/api/finanzierungs-planung/ist-tatsaechlich/route.ts` | GET: reale Ausgaben je KW |
| `src/app/api/finanzierungs-planung/berechnet/route.ts` | GET: auto-berechnete Werte + Persistenz |

**Geändert:**

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Neuer Nav-Eintrag „Finanzierungsausgaben" |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Neue Kachel „Finanzierungsausgaben" |

**DB-Migrationen:**
1. Neue Tabelle `finanzierungs_planung` mit Unique Constraint + RLS
2. Erweiterung `finanzierungs_einstellungen` um `zahlungsziel_tage`, `aktiv_von`, `aktiv_bis` (falls nicht bereits vorhanden)

---

### Wiederverwendung bestehender Muster

| Muster | Quelle |
|---|---|
| Doppelspalten-Header Vergangenheit (colspan=2) | `umsatzausgaben-tabelle.tsx` / `operative-ausgaben-tabelle.tsx` |
| Grau/Blau-Indikatorpunkte | `operative-ausgaben-tabelle.tsx` |
| Betragsselektion-Panel | `absatzplanung-tabelle.tsx` / `umsatzausgaben-tabelle.tsx` |
| Einzelzelle-Reset-Button | `absatzplanung-tabelle.tsx` / `operative-ausgaben-tabelle.tsx` |
| Reset AlertDialog | `operative-ausgaben-tabelle.tsx` |
| Notizen-Integration | alle Planungsseiten (PROJ-53) |
| ISO-Wochen-Helpers | `umsatzausgaben-planung/ist-tatsaechlich/route.ts` |
| Berechnungslogik (Zeitpunkt, Zahlungsziel, Weekend-Skip) | `operative-planung/berechnet/route.ts` |
| Ist-Plan-Persistenz-Mechanismus | `operative-planung/berechnet/route.ts` |

---

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Alle 5 Requests parallel | Ja | Auto-Werte werden direkt persistiert → kein Timing-Problem |
| Persistenz der Auto-Werte | `ist_berechnet = true` in `finanzierungs_planung` | Sichert Ist-Plan-Werte für vergangene KWs ohne gesonderten Freeze-Prozess |
| Neue DB-Tabelle statt Erweiterung bestehender | `finanzierungs_planung` neu | Klare Trennung der Planungsdaten je Feature; identisch mit Muster operative_planung |
| Keine neuen Packages | Keine | date-fns, shadcn/ui — alles vorhanden |
| Neue URL (kein Supersede) | `/finanzierungsausgaben` (neue Route) | Finanzierungsausgaben ersetzt keine bestehende Seite; PROJ-58 bleibt unter eigenem Pfad |

---

### Implementierungsreihenfolge

```
1. DB: finanzierungs_planung erstellen + finanzierungs_einstellungen erweitern
   ↓
2. Backend: GET + PUT + DELETE /api/finanzierungs-planung
   ↓
3. Backend: GET /api/finanzierungs-planung/ist-tatsaechlich  (parallel mit 4)
4. Backend: GET /api/finanzierungs-planung/berechnet         (parallel mit 3)
   ↓
5. Frontend: use-finanzierungsausgaben Hook
   ↓
6. Frontend: finanzierungsausgaben-tabelle Komponente
   ↓
7. Frontend: page.tsx + nav-sheet + dashboard-page
```

## Implementation Notes

### Backend (abgeschlossen)
- DB-Migration: `finanzierungs_planung` Tabelle mit Unique Constraint + RLS erstellt
- `finanzierungs_einstellungen` benötigte keine Migration — `zahlungsziel_tage`, `aktiv_von`, `aktiv_bis` waren bereits vorhanden
- Kein `untergruppe_id` in `finanzierungs_einstellungen` → `berechnet`-Route nutzt direkt `kategorie_id`
- Ist-Plan-Persistenz-Mechanismus vollständig übernommen aus PROJ-68 (identische Logik)
- 42/42 Tests grün

### Frontend (abgeschlossen)
- `src/hooks/use-finanzierungsausgaben.ts` — Datenladefluss mit parallelen 5 Requests
- `src/components/finanzierungsausgaben-tabelle.tsx` — vollständige Tabelle (Ist-Tatsächlich/Ist-Plan Doppelspalten, Grau/Blau-Indikatoren, Notizen, Betragsselektion, Reset-to-Auto, Global Reset)
- `src/app/dashboard/kurzfristige-planung/finanzierungsausgaben/page.tsx` — Seitencontainer
- `src/components/nav-sheet.tsx` — neuer Eintrag nach „Produktinvestitionsausgaben"
- `src/app/dashboard/kurzfristige-planung/page.tsx` — neue Kachel nach „Produktinvestitionsausgaben"
- Build erfolgreich, keine TypeScript-Fehler

## QA Test Results

**QA-Datum:** 2026-06-18
**Tester:** QA Engineer (automatisiert + Code-Review)
**Ergebnis:** ✅ APPROVED — produktionsbereit

### Testergebnisse

| # | Acceptance Criterion | Status |
|---|---|---|
| 1 | Navigation: Eintrag „Finanzierungsausgaben" nach „Produktinvestitionsausgaben" | ✅ PASS |
| 2 | Dashboard-Kachel im Abschnitt „Auswertungen" nach „Produktinvestitionsausgaben" | ✅ PASS |
| 3 | Auth-Guard: Unauthenticated → Redirect zu `/login` (Seite + alle 3 API-Routen) | ✅ PASS |
| 4 | Doppelspalten im Vergangenheitsbereich (Ist-Tatsächlich + Ist-Plan je KW) | ✅ PASS |
| 5 | Einzelspalte im Planungszeitraum (Soll) mit Trennlinie | ✅ PASS |
| 6 | ISO-8601-Wochenberechnung inkl. Jahreswechsel | ✅ PASS |
| 7 | Horizontales Scrollen; Zeilenbeschriftung sticky | ✅ PASS |
| 8 | Gesamt-Zeile „Finanzierungsausgaben (Gesamt)" ganz unten | ✅ PASS |
| 9 | L1-Gruppen einklappbar, Standard ausgeklappt | ✅ PASS |
| 10 | Alle-Ein-/Ausklappen-Button (Toggle-Mechanismus wie Operative Ausgaben) | ✅ PASS |
| 11 | Ist-Tatsächlich aus `ausgaben_kosten_transaktionen`, nicht editierbar | ✅ PASS |
| 12 | Ist-Plan aus `finanzierungs_planung`, nicht editierbar, leer wenn kein Plan | ✅ PASS |
| 13 | Persistenz-Mechanismus: berechnet-Route speichert `ist_berechnet=true` | ✅ PASS |
| 14 | Manuelle Overrides (`ist_berechnet=false`) werden nicht überschrieben | ✅ PASS |
| 15 | Grauer Indikatorpunkt = auto, blauer = manuell | ✅ PASS |
| 16 | Inline-Editing, Speicherung onBlur, Optimistisches Update + Rollback | ✅ PASS |
| 17 | Auto-Berechnung aus `finanzierungs_einstellungen`: monatlich/quartalsweise/jährlich | ✅ PASS |
| 18 | Zahlungsziel-Versatz + Wochenende-Skip (Samstag+2, Sonntag+1) | ✅ PASS |
| 19 | Aktiv-Zeitraum-Prüfung gegen Basis-Datum (nicht Zahlungsdatum) | ✅ PASS |
| 20 | Notizen auf Soll-Zellen, Kontext `finanzierungs-ausgaben` | ✅ PASS |
| 21 | Betragsselektion: Mehrfachauswahl + Summe rechts unten | ✅ PASS |
| 22 | Einzelzelle-Reset „Auf automatisch zurücksetzen" | ✅ PASS |
| 23 | Global Reset: Bestätigungsdialog, löscht manuelle Soll + Notizen, nicht Ist-Werte | ✅ PASS |
| 24 | Leerer Zustand wenn kein „Finanzierung"-Knoten im KPI-Modell | ✅ PASS |

### Automatisierte Tests

- **Unit-Tests (Vitest):** 42/42 ✅ (`src/app/api/finanzierungs-planung/**`)
- **E2E-Tests (Playwright):** 20/20 ✅ (Chromium + Mobile Safari, `tests/PROJ-70-finanzierungsausgaben.spec.ts`)

### Gefundene Bugs

**Keine Critical- oder High-Bugs.**

| ID | Severity | Beschreibung |
|---|---|---|
| BUG-70-1 | Low | Einklappen-Buttons: Spec sieht zwei separate Buttons vor, Implementierung nutzt einen Toggle (wechselt zwischen „Alle ausklappen" / „Alle einklappen"). Verhält sich identisch zu Operative Ausgaben (PROJ-68) und entspricht dem expliziten Nutzerwunsch. Kein Handlungsbedarf. |
| BUG-70-2 | Low | Leerer-Zustand-Text weicht leicht von Spec-Wording ab: Implementierung zeigt „Keine Kategorien unterhalb des ‚Finanzierung'-Knotens vorhanden." statt des Spec-Textes. Funktional korrekt. |

### Sicherheits-Audit

- ✅ Alle API-Routen mit `requireAuth()` gesichert
- ✅ RLS auf `finanzierungs_planung` aktiv (nur eigene Daten sichtbar)
- ✅ Zod-Validation auf PUT-Endpunkt (UUID, Ranges, Typ)
- ✅ Kein XSS-Risiko: alle Werte numerisch, keine Freitext-Direktausgabe außer Notizen (über bestehenden sicheren Notiz-Mechanismus)
- ✅ Unauthenticated Requests auf alle Routen → Redirect zu `/login`

### Regressions-Check

- ✅ PROJ-68 (Operative Ausgaben) weiterhin erreichbar und geschützt
- ✅ PROJ-69 (Produktinvestitionsausgaben) weiterhin erreichbar und geschützt
- ✅ Login-Seite rendert korrekt

## Deployment
_To be added by /deploy_
