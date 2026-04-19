# PROJ-16: Produktkosten-Verwaltung

## Status: Deployed
**Created:** 2026-04-19
**Last Updated:** 2026-04-19

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Produkte (`type='produkte'`) und Kostenkategorien aus Ausgaben & Kosten (`type='ausgaben_kosten'`, Ebene 2 unter der Kategorie „Produkt")

## Übersicht
Eine neue Datenpflege-Seite zur Verwaltung von Produktkosten. Für jedes im KPI-Modell gepflegte Produkt können historische Kostenzeiträume angelegt werden. Die Kostenstruktur (Kostenkategorien) ergibt sich aus den **Unterkategorien der Ebene-1-Kategorie „Produkt"** im Ausgaben & Kosten KPI-Modell — mit Ausnahme der Unterkategorie **„Wertverlust Ware"**, die explizit ausgeschlossen ist. Alle Werte sind €-Beträge. Jeder Zeitraum wird über ein Formular angelegt und hat ein Anfangsdatum (Pflicht) sowie ein optionales Enddatum — überlappende Zeiträume für dasselbe Produkt sind nicht erlaubt.

## User Stories
- Als Nutzer möchte ich für jedes Produkt historische Produktkosten mit einem Anfangsdatum (und optionalem Enddatum) anlegen können, damit ich saisonale oder veränderte Kostenstrukturen korrekt abbilden kann.
- Als Nutzer möchte ich für jeden Produktkosten-Zeitraum einen €-Wert pro Kostenkategorie eingeben können, damit alle relevanten Kostenbestandteile erfasst sind.
- Als Nutzer möchte ich die Gesamtkosten automatisch summiert sehen, ohne sie manuell berechnen oder eingeben zu müssen.
- Als Nutzer möchte ich bestehende Produktkosten-Zeiträume bearbeiten können, damit Fehler nachträglich korrigiert werden können.
- Als Nutzer möchte ich bestehende Produktkosten-Zeiträume löschen können, um fehlerhafte Einträge zu entfernen.
- Als Nutzer möchte ich alle Kostenzeiträume eines Produkts in der gleichen Reihenfolge sehen, wie die Produkte im KPI-Modell sortiert sind.
- Als Nutzer möchte ich per Tab zwischen verschiedenen Produkten wechseln, damit die Übersicht übersichtlich bleibt.

## Acceptance Criteria
- [ ] Neue Seite unter `/dashboard/produktkosten` mit Navigationseintrag „Produktkosten" unter Datenpflege
- [ ] Die Seite zeigt je ein Tab pro Produkt in der **Reihenfolge des KPI-Modells** (`sort_order` aus `kpi_categories`)
- [ ] Jeder Tab zeigt eine Tabelle aller Kostenzeiträume des Produkts mit Spalten: Gültig von, Gültig bis, [je eine Spalte pro Kostenkategorie in €], **Gesamt** (Summe aller Kostenwerte, automatisch berechnet), Aktionen (Bearbeiten, Löschen)
- [ ] Die Gesamt-Spalte wird im Frontend aus den Einzelwerten summiert — kein eigenes Eingabefeld im Formular
- [ ] Button „Neuer Zeitraum" öffnet ein Formular/Dialog mit Feldern: Gültig von (Datum, Pflicht), Gültig bis (Datum, **optional**), + je ein €-Zahlenfeld pro Kostenkategorie
- [ ] Die Kostenkategorien im Formular entsprechen den Ebene-2-Unterkategorien der Ausgaben & Kosten Kategorie mit dem Namen „Produkt" — **ausgenommen die Unterkategorie mit dem Namen „Wertverlust Ware"** — dynamisch geladen
- [ ] Die Kostenkategorien werden im Formular und in der Tabelle in der **Reihenfolge des KPI-Modells** (`sort_order`) angezeigt
- [ ] Alle Kostenwerte sind €-Beträge und werden entsprechend formatiert (z.B. „5,50 €")
- [ ] Pflichtfelder: Gültig von, alle Kostenkategorien müssen einen Wert ≥ 0 haben
- [ ] Validierung: Wenn Gültig bis angegeben, muss es nach Gültig von liegen
- [ ] Validierung: Zeitraum darf sich für dasselbe Produkt nicht mit einem bestehenden Zeitraum überlappen — Fehlermeldung bei Verstoß (serverseitig)
- [ ] Bearbeiten-Button öffnet das Formular vorausgefüllt mit den bestehenden Werten
- [ ] Löschen-Button zeigt Bestätigungs-Dialog vor dem endgültigen Löschen
- [ ] Wenn keine Produkte im KPI-Modell gepflegt sind: Hinweismeldung mit Link zur KPI-Modell-Verwaltung
- [ ] Wenn keine Kostenkategorien unter „Produkt" in Ausgaben & Kosten vorhanden sind (nach Ausschluss von „Wertverlust Ware"): Hinweis mit Link zur KPI-Modell-Verwaltung
- [ ] Änderungen werden sofort in der Tabelle sichtbar (Re-Fetch)

## Edge Cases
- Keine Produkte vorhanden → leerer Zustand mit Hinweis „Bitte zuerst Produkte im KPI-Modell anlegen"
- Keine Kostenkategorien nach Ausschluss von „Wertverlust Ware" → leerer Zustand mit Hinweis zur KPI-Modell-Verwaltung
- Kategorie „Produkt" in Ausgaben & Kosten existiert nicht → gleicher Hinweis
- Gültig bis nicht angegeben (open-ended): Der Zeitraum gilt ab Gültig von unbegrenzt
- Überlappungsprüfung bei optionalem Gültig bis:
  - Beide Zeiträume ohne Ende: immer Überlappung, wenn `new.von >= e.von` oder `new.von < e.von` und kein Ende
  - Formel: `(e.gueltig_bis IS NULL OR new.von ≤ e.gueltig_bis) AND (new.gueltig_bis IS NULL OR new.gueltig_bis ≥ e.von)`
- Zeitraum-Überlappung mit Datum: Neuer Zeitraum 01.03.–30.06. wenn bereits 01.01.–30.04. existiert → Fehler „Dieser Zeitraum überschneidet sich mit einem bestehenden Eintrag"
- Gültig bis vor Gültig von → Validierungsfehler im Formular
- Wert ist negativ → Validierungsfehler (Kosten müssen ≥ 0 sein)
- Alle Kostenwerte = 0 → Gesamt-Spalte zeigt „0,00 €" (valid, kein Fehler)
- Kostenkategorien ändern sich im KPI-Modell nachträglich → bestehende Werte bleiben erhalten (per `kategorie_id`), gelöschte Kategorien erscheinen nicht mehr im Formular; Gesamt-Spalte summiert nur noch die vorhandenen Kategorien
- Produkt wird im KPI-Modell gelöscht → zugehörige Kostenzeiträume bleiben in der DB; gelöschte Produkte erscheinen nicht im Tab
- Sehr viele Kostenkategorien (10+) → Formular scrollbar, Tabelle horizontal scrollbar, kein Layout-Bruch
- Reihenfolge der Produkt-Tabs entspricht `sort_order` aus `kpi_categories` — auch nach Umbenennung oder Umsortierung im KPI-Modell

## Technical Requirements
- Neue DB-Tabellen: `produktkosten_zeitraeume` (Kopfdaten) + `produktkosten_werte` (Einzelwerte pro Kategorie)
- `produkt_id` → FK auf `kpi_categories.id` (type='produkte')
- `kategorie_id` → FK auf `kpi_categories.id` (type='ausgaben_kosten', level=2, parent = Kategorie „Produkt")
- `gueltig_bis` ist **nullable** (kein DB-NOT NULL Constraint) — open-ended Zeiträume erlaubt
- Überlappungsprüfung serverseitig mit angepasster Formel für nullable gueltig_bis (s. Edge Cases)
- Ausschluss „Wertverlust Ware": Frontend filtert Kostenkategorien nach `name !== 'Wertverlust Ware'` beim Laden
- Tab-Reihenfolge: Produkte nach `sort_order` aus `kpi_categories` sortiert (nicht alphabetisch)
- Kostenkategorien-Reihenfolge: nach `sort_order` aus `kpi_categories`
- Gesamt-Spalte: clientseitig berechnete Summe aller Kostenwerte des Zeitraums — nicht in DB gespeichert
- Alle Kostenwerte als `NUMERIC(12,2)`, €-Formatierung im Frontend
- Auth required (wie alle anderen Datenpflege-Seiten)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur
```
/dashboard/produktkosten
+-- PageHeader „Produktkosten"
+-- Tabs (shadcn Tabs) — ein Tab pro Produkt (alphabetisch)
|
+-- [Pro Produkt-Tab]
|   +-- Button „Neuer Zeitraum"
|   +-- ProduktkostenTable
|   |   +-- Spalten: Gültig von | Gültig bis | [Kostenkategorie 1..N] | Aktionen
|   |   +-- ProduktkostenRow
|   |       +-- Bearbeiten-Button → ProduktkostenFormDialog (vorausgefüllt)
|   |       +-- Löschen-Button → AlertDialog
|   +-- EmptyState (keine Zeiträume für dieses Produkt)
|
+-- ProduktkostenFormDialog (shadcn Dialog)
|   +-- Gültig von (DateInput)
|   +-- Gültig bis (DateInput)
|   +-- [Zahlenfeld pro Kostenkategorie] — dynamisch geladen
|   +-- Fehlermeldung bei Überlappung
|
+-- DeleteConfirmDialog (shadcn AlertDialog)
|
+-- EmptyState (keine Produkte oder keine Kostenkategorien konfiguriert)
    +-- Link zur KPI-Modell-Verwaltung
```

### Datenmodell

**Tabelle: `produktkosten_zeitraeume`**
- id — UUID, Primärschlüssel
- produkt_id — UUID, FK → kpi_categories.id (type='produkte')
- gueltig_von — Datum
- gueltig_bis — Datum
- created_at — Timestamp

**Tabelle: `produktkosten_werte`**
- id — UUID, Primärschlüssel
- zeitraum_id — UUID, FK → produktkosten_zeitraeume.id (CASCADE DELETE)
- kategorie_id — UUID, FK → kpi_categories.id (Kostenkategorie aus ausgaben_kosten, level=2)
- wert — Decimal(12,2), ≥ 0

**Kostenkategorien-Herkunft:** `kpi_categories` mit `type='ausgaben_kosten'`, `level=2`, deren Elternkategorie (level=1) den Namen „Produkt" trägt. Werden per bestehender API `GET /api/kpi-categories?type=ausgaben_kosten` geladen.

### API-Routen
```
GET    /api/produktkosten?produkt_id=xxx   → Alle Zeiträume + Werte eines Produkts
POST   /api/produktkosten                  → Neuen Zeitraum + Werte anlegen (Überlappungsprüfung)
PATCH  /api/produktkosten/[id]             → Zeitraum + Werte aktualisieren (Überlappungsprüfung exkl. eigener ID)
DELETE /api/produktkosten/[id]             → Zeitraum löschen (Werte per CASCADE)
```
Kostenkategorien: bestehende Route `GET /api/kpi-categories?type=ausgaben_kosten` — keine neue Route nötig.

### Neue Dateien
```
src/app/dashboard/produktkosten/page.tsx          — Hauptseite mit Tabs
src/components/produktkosten-form-dialog.tsx      — Formular (neu/bearbeiten)
src/components/produktkosten-table.tsx            — Tabelle mit Zeiträumen
src/hooks/use-produktkosten.ts                    — API-Calls + State-Management
src/app/api/produktkosten/route.ts                — GET + POST
src/app/api/produktkosten/[id]/route.ts           — PATCH + DELETE
src/app/api/produktkosten/route.test.ts
src/app/api/produktkosten/[id]/route.test.ts
```

**Geänderte Dateien:**
- `src/components/nav-sheet.tsx` — neuer Eintrag „Produktkosten" unter Datenpflege

### Tech-Entscheidungen
| Entscheidung | Gewählt | Warum |
|---|---|---|
| URL | `/dashboard/produktkosten` | Konsistent mit allen anderen Seiten (kein `/datenpflege/` Unterordner vorhanden) |
| Tabs | shadcn `Tabs` | Bereits installiert, identisches Muster wie KPI-Modell-Seite |
| Formular | shadcn `Dialog` | Gleiche Pattern wie `ausgaben-form-dialog.tsx` |
| Kostenkategorien | Dynamisch per API | Flexible KPI-Struktur bleibt anpassbar ohne Code-Änderungen |
| Zeitraum-Überlappung | Serverseitige Prüfung | Datenkonsistenz auch bei gleichzeitigen Zugriffen |
| Werte-Speicherung | Separate `produktkosten_werte` Tabelle | Normalisiert; Werte bleiben erhalten bei Umbenennung von Kategorien |

### Dependencies
Keine neuen Packages — alle benötigten shadcn/ui-Komponenten bereits installiert.

## Implementation Notes (Frontend)
- `src/hooks/use-produktkosten.ts` — Hook mit `useProduktkostenZeitraeume(produktId)`: lädt Zeiträume per GET, addZeitraum/updateZeitraum/deleteZeitraum via API
- `src/components/produktkosten-table.tsx` — Tabelle mit dynamischen Spalten pro Kostenkategorie; sortiert nach gueltig_von
- `src/components/produktkosten-form-dialog.tsx` — Dialog für Neu/Bearbeiten: Datumsfelder + dynamische Zahlenfelder pro Kostenkategorie; client-seitige Validierung (Datum, ≥ 0)
- `src/app/dashboard/produktkosten/page.tsx` — Seite mit Tabs pro Produkt; findet Kostenkategorien via `name.toLowerCase() === 'produkt'` in ausgaben_kosten Level-1; Empty States für keine Produkte / keine Kategorien
- `src/components/nav-sheet.tsx` — Navigationseintrag „Produktkosten" unter Datenpflege ergänzt
- URL: `/dashboard/produktkosten` (konsistent mit bestehenden Seiten)
- Build: ✅ fehlerfrei (TypeScript + Next.js Production Build)

## Implementation Notes (Backend)
- DB-Migration: `create_produktkosten_tables` — zwei neue Tabellen mit RLS (4 Policies je), FK-Constraints, CHECK auf wert ≥ 0, Unique(zeitraum_id, kategorie_id)
- `src/app/api/produktkosten/route.ts` — GET (by produkt_id, nested join via `werte:produktkosten_werte(*)`), POST (Overlap-Check → 409, dann Insert Zeitraum + Werte)
- `src/app/api/produktkosten/[id]/route.ts` — PATCH (Fetch current → Overlap-Check exkl. Self → Update + Werte ersetzen), DELETE (Cascade via DB)
- Zod-Validierung: Datumsformat, UUID-Checks, wert ≥ 0, gueltig_bis ≥ gueltig_von (refine)
- Overlap-Formel: `existing.gueltig_von ≤ new.gueltig_bis AND existing.gueltig_bis ≥ new.gueltig_von`
- Unit-Tests: 18/18 ✅ (GET ×3, POST ×6, PATCH ×5, DELETE ×2)

## QA Test Results

**Tested:** 2026-04-19
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-01: Neue Seite `/dashboard/produktkosten` mit Navigationseintrag
- [x] Seite existiert und ist über „Produktkosten" unter Datenpflege erreichbar
- [x] Unauthentifizierter Zugriff wird zu `/login` weitergeleitet

#### AC-02: Tabs in KPI-Modell-Reihenfolge (sort_order)
- [x] Produkt-Tabs werden nach `sort_order` aus `kpi_categories` sortiert (nicht alphabetisch)

#### AC-03: Tabelle mit korrekten Spalten
- [x] Spalten: Gültig von | Gültig bis | [Kostenkategorien] | Gesamt | Aktionen (Bearbeiten, Löschen)

#### AC-04: Gesamt-Spalte automatisch berechnet
- [x] Gesamt = Summe aller Kostenwerte; kein Gesamt-Eingabefeld im Formular

#### AC-05: „+ Neuer Zeitraum"-Button öffnet Formular
- [x] Dialog mit Feldern: Gültig von, Gültig bis (optional), €-Felder pro Kostenkategorie

#### AC-06: Kostenkategorien exkl. „Wertverlust Ware"
- [x] Nur Ebene-2-Unterkategorien von „Produkt" (ausgaben_kosten); „Wertverlust Ware" ausgeschlossen

#### AC-07: Kostenkategorien nach sort_order
- [x] Reihenfolge im Formular und in der Tabelle entspricht `sort_order` aus KPI-Modell

#### AC-08: €-Formatierung
- [x] Alle Werte mit deutschem Zahlenformat und „€"-Symbol (z.B. „5,50 €")

#### AC-09: Pflichtfelder und Validierung ≥ 0
- [x] Gültig von ist Pflichtfeld; Speichern-Button deaktiviert solange ungültig
- [x] Alle Kostenwerte müssen ≥ 0 sein; negative Werte zeigen Fehlermeldung

#### AC-10: Gültig bis ist optional; Validierung wenn angegeben
- [x] Gültig bis kann leer bleiben (open-ended)
- [x] Wenn angegeben: muss nach Gültig von liegen, sonst Fehlermeldung

#### AC-11: Überlappungsprüfung serverseitig
- [x] 409-Fehler mit Meldung „überschneidet sich" wird im Formular angezeigt

#### AC-12: Bearbeiten-Button öffnet vorausgefülltes Formular
- [x] Alle bestehenden Werte korrekt vorgeladen

#### AC-13: Löschen-Button mit Bestätigungs-Dialog
- [x] AlertDialog erscheint; Abbrechen bricht ab; Bestätigen löscht Eintrag

#### AC-14: Keine Produkte → Hinweismeldung
- [x] Leerstate mit Hinweistext und Link zur KPI-Modell-Verwaltung

#### AC-15: Keine Kostenkategorien → Hinweismeldung
- [x] Leerstate mit Hinweistext und Link zur KPI-Modell-Verwaltung

#### AC-16: Sofortige Aktualisierung nach Änderung
- [x] Re-Fetch nach Speichern, Bearbeiten und Löschen; Daten sofort sichtbar

### Edge Cases Status

#### EC-01: Gültig bis nicht angegeben (open-ended)
- [x] Tabelle zeigt „—" statt Datum; Überlappungsprüfung berücksichtigt NULL korrekt

#### EC-02: Gültig bis vor Gültig von
- [x] Formular zeigt Validierungsfehler; Speichern blockiert

#### EC-03: Wert negativ
- [x] Formular zeigt Fehlermeldung; Speichern blockiert

#### EC-04: Alle Kostenwerte = 0
- [x] Gesamt-Spalte zeigt „0,00 €" (kein Fehler)

#### EC-05: Beide Zeiträume ohne Enddatum → immer Überlappung
- [x] Serverseitige Prüfung mit `.or('gueltig_bis.gte.X,gueltig_bis.is.null')` behandelt diesen Fall

#### EC-06: Reihenfolge nach sort_order auch nach Umbenennung
- [x] Tabs nutzen `sort_order`, nicht den Namen → stabil bei Umbenennungen

### Security Audit Results
- [x] Authentifizierung: Alle Routen (GET /api/produktkosten, GET /dashboard/produktkosten) leiten ohne Login zu `/login` weiter
- [x] Autorisierung: RLS-Policies auf `produktkosten_zeitraeume` und `produktkosten_werte` aktiv
- [x] Input-Validierung: Zod-Schemas auf allen POST/PATCH-Endpunkten (UUID-Check, Datumsformat, wert ≥ 0)
- [x] SQL-Injection: Supabase-Client mit parametrisierten Queries
- [x] Keine Secrets im Browser sichtbar

### Bugs Found

Keine Bugs gefunden.

### Summary
- **Acceptance Criteria:** 16/16 bestanden
- **Edge Cases:** 6/6 bestanden
- **Bugs Found:** 0 (0 critical, 0 high, 0 medium, 0 low)
- **Security:** Bestanden
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment

**Deployed:** 2026-04-19
**Production URL:** https://controlling-app-five.vercel.app
**Git Tag:** v1.16.0-PROJ-16
**Platform:** Vercel (auto-deploy from main branch)
**DB Migration:** `make_produktkosten_gueltig_bis_nullable` — applied via Supabase MCP
