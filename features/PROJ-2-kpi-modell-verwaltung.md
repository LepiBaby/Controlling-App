# PROJ-2: KPI-Modell Verwaltung

## Status: Approved
**Created:** 2026-04-17
**Last Updated:** 2026-04-17

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer können KPI-Modelle pflegen

## Übersicht
Verwaltung der Kategoriehierarchien für alle drei Eingabetabellen. Jede Tabelle (Umsatz, Einnahmen, Ausgaben & Kosten) hat ein eigenes KPI-Modell mit einer 3-stufigen Hierarchie: **Kategorie → Unterkategorie → Unter-Unterkategorie**. Nicht jede Ebene muss befüllt sein — eine Kategorie kann direkt verwendet werden ohne Unterkategorien.

## User Stories
- Als Nutzer möchte ich für jede der drei Tabellen (Umsatz, Einnahmen, Ausgaben & Kosten) ein eigenes KPI-Modell pflegen können, damit die Kategoriestrukturen voneinander unabhängig sind.
- Als Nutzer möchte ich neue Kategorien auf jeder Ebene hinzufügen können (Kategorie, Unterkategorie, Unter-Unterkategorie), damit das Modell meinen Geschäftsanforderungen entspricht.
- Als Nutzer möchte ich Kategorien umbenennen können, ohne dass bestehende Transaktionen verloren gehen.
- Als Nutzer möchte ich Kategorien löschen können, wobei ich gewarnt werde wenn noch Transaktionen damit verknüpft sind.
- Als Nutzer möchte ich die Reihenfolge der Kategorien anpassen können, damit die wichtigsten oben erscheinen.
- Als Nutzer möchte ich das vollständige Kategorie-Baum-Modell auf einen Blick sehen können.
- Als Nutzer möchte ich für Sales Plattformen (z.B. Amazon, Shopify) eine flache Liste von Hauptkategorien pflegen können, ohne Unterkategorien.
- Als Nutzer möchte ich für Produkte eine flache Liste von Hauptkategorien pflegen können, ohne Unterkategorien.

## Acceptance Criteria
- [ ] Separate Verwaltungsseite für KPI-Modelle mit fünf Tabs: "Umsatz", "Einnahmen", "Ausgaben & Kosten", "Sales Plattformen", "Produkte"
- [ ] Jeder Tab zeigt den Kategorie-Baum als übersichtliche, einrückungsbasierte Liste
- [ ] Neue Kategorie (Ebene 1) hinzufügen: Name eingeben → speichern
- [ ] Neue Unterkategorie (Ebene 2) unter einer bestehenden Kategorie hinzufügen
- [ ] Neue Unter-Unterkategorie (Ebene 3) unter einer bestehenden Unterkategorie hinzufügen
- [ ] Kategorie auf jeder Ebene umbenennen (Inline-Bearbeitung)
- [ ] Kategorie löschen — wenn keine Transaktionen verknüpft: sofort löschen; wenn verknüpft: Warnung mit Anzahl der betroffenen Transaktionen
- [ ] Beim Löschen einer Elternkategorie werden alle Kind-Kategorien mit gelöscht (Kaskade), mit entsprechender Warnung
- [ ] Reihenfolge der Kategorien per Drag-and-Drop oder Pfeil-Buttons anpassbar
- [ ] Änderungen am KPI-Modell sind sofort in den Eingabeformularen der Transaktionen sichtbar
- [ ] KPI-Modell kann nicht leer gespeichert werden — mindestens eine Kategorie pro Tabellentyp muss existieren (Pflicht vor erster Transaktion)
- [ ] Tab "Sales Plattformen": Nur Ebene-1-Kategorien (Hauptkategorien) — kein "+" für Unterkategorien, API blockiert level > 1 für diesen Typ
- [ ] Tab "Produkte": Nur Ebene-1-Kategorien (Hauptkategorien) — kein "+" für Unterkategorien, API blockiert level > 1 für diesen Typ
- [ ] Drag-and-Drop in flachen Tabs: nur Reihenfolge-Sortierung (kein Reparenting, da keine Hierarchie)
- [ ] Root-Drop-Zone wird in flachen Tabs nicht angezeigt (nicht relevant)

## Beispiel Kategorie-Baum (Ausgaben & Kosten)
```
Operative Ausgaben
  └── Mobilität & Reisen
        ├── Geschäftsreise
        └── Fahrtkosten
  └── Büro & Infrastruktur
Marketing
  └── Online-Werbung
        ├── Google Ads
        └── Meta Ads
  └── Offline-Werbung
Personal
```
*(Personal hat keine Unterkategorien — valid)*

## Edge Cases
- Kategorie-Name ist leer → Speichern blockiert, Fehler-Hinweis anzeigen
- Kategorie-Name existiert bereits auf gleicher Ebene im gleichen Modell → Warnung "Name bereits vorhanden"
- Löschen einer Kategorie mit verknüpften Transaktionen → Blocker-Dialog: "X Transaktionen verwenden diese Kategorie. Bitte zuerst Transaktionen umkategorisieren oder löschen."
- Kategorie-Baum ist sehr tief verschachtelt (Ebene 4+) → UI verhindert das Hinzufügen einer 4. Ebene
- Sales Plattformen / Produkte: Nutzer versucht Unterkategorie hinzuzufügen → "+" Button gar nicht erst anzeigen, API gibt 400 zurück wenn level > 1
- Sales Plattformen / Produkte: DnD-Reparenting versucht → ignoriert (kein gültiges Drop-Target für Reparenting vorhanden)
- Nutzer versucht Transaktionseingabe ohne jegliche Kategorie im KPI-Modell → Weiterleitung zur KPI-Modell-Verwaltung mit Hinweis

## Technical Requirements
- Datenmodell: `kpi_categories`-Tabelle mit `type` (umsatz/einnahmen/ausgaben_kosten/sales_plattformen/produkte), `parent_id` (self-referencing), `name`, `level` (1/2/3), `sort_order`
- Für `type = sales_plattformen` und `type = produkte`: API erzwingt `level = 1` und `parent_id = null` (400 wenn verletzt)
- Alle Änderungen sofort persistiert (kein Entwurfsmodus)
- Performance: Baum mit bis zu 200 Kategorien muss flüssig laden

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
/dashboard/kpi-modell  (src/app/dashboard/kpi-modell/page.tsx)
+-- PageHeader ("KPI-Modell Verwaltung")
+-- Tabs (shadcn: Tabs) — "Umsatz" | "Einnahmen" | "Ausgaben & Kosten" | "Sales Plattformen" | "Produkte"
|
+-- CategoryTree (pro Tab)
|   +-- CategoryRow (Ebene 1)
|   |   +-- Expand/Collapse Toggle
|   |   +-- Name (klickbar → Inline-Edit)
|   |   +-- Pfeil-Buttons ↑↓ (Reihenfolge)
|   |   +-- "+" Button (Unterkategorie hinzufügen)
|   |   +-- Löschen-Button
|   |   +-- CategoryRow (Ebene 2, eingerückt)
|   |       +-- [gleiche Buttons]
|   |       +-- CategoryRow (Ebene 3, eingerückt)
|   |           +-- [Name, Pfeile, Löschen — kein "+" mehr]
|   |
+-- AddCategoryForm (Ebene 1 hinzufügen)
|
+-- DeleteConfirmDialog (shadcn: AlertDialog)
    +-- Normalfall: "Kategorie wirklich löschen?"
    +-- Mit Transaktionen: Blocker — "X Transaktionen verknüpft"
    +-- Mit Kindern: Warnung — "Löscht auch Y Unterkategorien"
```

### Datenmodell
```
Tabelle: kpi_categories (Supabase, geteilt zwischen allen Nutzern)

Felder:
- id            UUID, Primärschlüssel
- type          Text: "umsatz" / "einnahmen" / "ausgaben_kosten" / "sales_plattformen" / "produkte"
- parent_id     UUID | null → self-referencing (null = Ebene 1)
- name          Text (max. 100 Zeichen)
- level         Integer: 1, 2 oder 3
- sort_order    Integer (Reihenfolge innerhalb gleicher Elternkategorie)
- created_at    Timestamp

Beziehungen:
- Elternkategorie löschen → alle Kinder automatisch mitgelöscht (CASCADE)
- Verknüpfung zu transactions-Tabellen (PROJ-3/4/5): Prüfung vor Löschen
```

### API-Routen
```
GET    /api/kpi-categories?type=umsatz   → Alle Kategorien eines Typs
POST   /api/kpi-categories               → Neue Kategorie anlegen
PATCH  /api/kpi-categories/[id]          → Umbenennen oder Reihenfolge
DELETE /api/kpi-categories/[id]          → Löschen (mit Transaktions-Check)
```

### Neue Dateien
```
src/app/dashboard/kpi-modell/page.tsx       — Hauptseite mit Tabs
src/components/kpi-category-tree.tsx        — Rekursiver Baum
src/components/kpi-category-row.tsx         — Einzelzeile (Name, Buttons)
src/components/kpi-add-category-form.tsx    — Formular neue Kategorie
src/hooks/use-kpi-categories.ts             — API-Calls + State
src/app/api/kpi-categories/route.ts         — GET + POST
src/app/api/kpi-categories/[id]/route.ts    — PATCH + DELETE
```

### Flache Tabs (Sales Plattformen & Produkte)
- `KpiCategoryTree` erhält neues optionales Prop `maxLevel: 1 | 3` (default: 3)
- Bei `maxLevel=1`: kein "+" für Unterkategorien in `KpiCategoryRow`, Root-Drop-Zone ausgeblendet, Reparenting-Logik in `handleDragMove` deaktiviert
- API: `POST /api/kpi-categories` prüft `type` und gibt 400 wenn `level > 1` für `sales_plattformen` oder `produkte`
- `CategoryType` Enum erweitert: `'umsatz' | 'einnahmen' | 'ausgaben_kosten' | 'sales_plattformen' | 'produkte'`

### Tech-Entscheidungen
| Entscheidung | Gewählt | Warum |
|---|---|---|
| Reordering | Pfeil-Buttons ↑↓ | Kein extra Package, einfach zu bedienen |
| Inline-Edit | Click-to-edit Input | Schneller als separater Dialog |
| Delete-Warning | shadcn AlertDialog | Bereits installiert, verhindert Datenverlust |
| State | Custom Hook useKpiCategories | Kapselt API-Calls + Tree-State |
| Tree-Rendering | Rekursive Komponente | Natürlich für max. 3-stufige Hierarchie |
| Flache Tabs | `maxLevel=1` Prop | Minimale Änderung, bestehende Komponenten wiederverwendet |

### Dependencies
Keine neuen Packages — alle benötigten shadcn/ui-Komponenten bereits installiert.

## Implementation Notes
- `src/hooks/use-kpi-categories.ts` — Hook mit buildTree, optimistischen Updates, API-Calls; `CategoryType` um `sales_plattformen` + `produkte` erweitert
- `src/components/kpi-category-row.tsx` — Zeile mit Inline-Edit, ↑↓ Buttons, "+"-Child-Form, Löschen; `maxLevel` Prop: kein "+" wenn `maxLevel=1`
- `src/components/kpi-category-tree.tsx` — Rekursiver Baum + leerer Zustand + AddCategoryForm; `maxLevel` Prop: kein Reparenting + keine Root-Drop-Zone wenn `maxLevel=1`
- `src/components/kpi-add-category-form.tsx` — Einfaches Formular für neue Kategorien
- `src/app/dashboard/kpi-modell/page.tsx` — Client Component: 5 Tabs (3 hierarchisch + 2 flach); `maxLevel=1` für Sales Plattformen + Produkte
- Dashboard (`/dashboard`) verlinkt zur KPI-Modell-Seite
**Backend:**
- `kpi_categories`-Tabelle in Supabase (eu-central-1) mit RLS auf allen 4 Operationen
- `src/lib/supabase-server.ts` — `createSupabaseServerClient` + `requireAuth` Helper
- `src/app/api/kpi-categories/route.ts` — GET (mit type-Filter) + POST (mit Duplikat-Prüfung)
- `src/app/api/kpi-categories/[id]/route.ts` — PATCH (name/sort_order) + DELETE (mit CASCADE)
- 21 Unit-Tests (route.ts) + 35 Unit-Tests (hook + DnD) gesamt — alle grün
- `FLAT_TYPES = ['sales_plattformen', 'produkte']`: POST gibt 400 wenn `level > 1` oder `parent_id != null`
- Duplikat-Check: gleicher Name auf gleicher Ebene → 409 Conflict
- Transaktions-Check: Placeholder für PROJ-3/4/5 (derzeit immer 0)

## QA Test Results

**QA Date:** 2026-04-18 (initial) / 2026-04-18 (DnD-Erweiterung) / 2026-04-18 (Sales Plattformen & Produkte)
**Tester:** /qa skill
**Status: APPROVED ✅**

### Test Suite Results
| Suite | Tests | Result |
|---|---|---|
| Vitest Unit (API routes inkl. flat types) | 21 | ✅ all pass |
| Vitest Unit (hook logic inkl. DnD + dimensions) | 38 | ✅ all pass |
| Playwright E2E (chromium) | 29 | ✅ all pass |
| **Total** | **88** | **✅ 88/88 pass** |

### Acceptance Criteria
| # | Kriterium | Status |
|---|---|---|
| AC1 | Separate Seite mit 5 Tabs (Umsatz/Einnahmen/Ausgaben & Kosten/Sales Plattformen/Produkte) | ✅ PASS |
| AC2 | Kategorie-Baum als einrückungsbasierte Liste | ✅ PASS |
| AC3 | Neue Kategorie (Ebene 1) hinzufügen | ✅ PASS |
| AC4 | Neue Unterkategorie (Ebene 2) hinzufügen | ✅ PASS |
| AC5 | Neue Unter-Unterkategorie (Ebene 3) hinzufügen | ✅ PASS |
| AC6 | Inline-Umbenennung auf jeder Ebene | ✅ PASS |
| AC7 | Löschen mit Warnung (kein "+" auf Ebene 3) | ✅ PASS |
| AC8 | Kaskaden-Löschen mit Warnung über Unterkategorie-Anzahl | ✅ PASS |
| AC9 | Reihenfolge per Pfeil-Buttons ↑↓ | ✅ PASS |
| AC10 | Änderungen sofort sichtbar (optimistische Updates) | ✅ PASS |
| AC11 | KPI-Modell kann nicht leer sein (vor erster Transaktion) | ⏳ DEFERRED — wird in PROJ-3/4/5 erzwungen |
| AC12 | Sales Plattformen: nur Ebene-1, kein "+", API blockiert level>1 | ✅ PASS |
| AC13 | Produkte: nur Ebene-1, kein "+", API blockiert level>1 | ✅ PASS |
| AC14 | DnD in flachen Tabs: nur Sortierung, kein Reparenting | ✅ PASS |
| AC15 | Root-Drop-Zone nicht in flachen Tabs | ✅ PASS |

### Bugs Found
| # | Schwere | Beschreibung | Status |
|---|---|---|---|
| — | — | Keine Critical oder High Bugs | |
| B1 | Medium | AC11: Kein UI-Schutz gegen leeres KPI-Modell. Absicherung folgt in PROJ-3/4/5. | Open (deferred) |
| B2 | Low | API-Routen geben bei unauthentifiziertem Zugriff kein 401 zurück (Middleware→/login). Funktional korrekt für Web-App. | Accepted |
| B3 | Low | Kein Rate-Limiting. Für 1–5 interne Nutzer akzeptabel. | Accepted |
| B4 | Medium | DnD: Reparenting von gleichstufigen Root-Kategorien funktionierte nicht (parent=null = als Geschwister erkannt). | **Fixed** |
| B5 | High | Sales Plattformen/Produkte: Kategorien konnten nicht hinzugefügt werden — DB CHECK-Constraint erlaubte nur 3 Original-Typen. | **Fixed** |
| B6 | Medium | addCategory schluckte API-Fehler still — Name verschwand ohne Fehlermeldung. | **Fixed** |

### Security Audit
- **XSS:** Kein Risiko — Kategorienamen werden als React-Text-Nodes gerendert (kein `dangerouslySetInnerHTML`) ✅
- **SQL Injection:** Kein Risiko — Supabase parametrisierte Queries, alle Inputs durch Zod validiert ✅
- **Auth Bypass:** Doppelter Schutz: Middleware (`proxy.ts`) + `requireAuth()` in jeder API-Route ✅
- **Horizontal Access Control:** Alle authentifizierten Nutzer haben gleichen Zugriff (by design, PRD) ✅
- **Input Validation:** Name: max 100 Zeichen, min 1; Type: Enum; Level: 1/2/3 via Zod ✅
- **Duplicate Check:** Server-seitiger 409-Conflict bei Doppelname auf gleicher Ebene ✅
- **Cascade Delete:** DB-seitiges CASCADE verhindert Waisen-Kategorien ✅

### Regression (PROJ-1)
Alle 14 PROJ-1 E2E-Tests bestehen weiterhin. Kein Regressionsrisiko. ✅

## Deployment

**Deployed:** 2026-04-18 (initial) / 2026-04-18 (DnD-Erweiterung)
**Production URL:** https://controlling-app-five.vercel.app/dashboard/kpi-modell
**Deploy Method:** Git push to main → Vercel auto-deploy

**DnD-Updates (2026-04-18):**
- Drag & Drop Sortierung innerhalb gleicher Ebene
- Drag & Drop Reparenting (Kategorie in andere verschieben)
- Root-Drop-Zone zum Hochstufen auf Hauptkategorie-Ebene
- Bugfix: Reparenting zwischen Root-Kategorien (parent_id=null)
