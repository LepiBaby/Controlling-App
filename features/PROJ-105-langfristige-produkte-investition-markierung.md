# PROJ-105: Produkte als Investition markieren — Langfristige Planung

## Status: Deployed
**Created:** 2026-07-03
**Last Updated:** 2026-07-03 (deployed)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Daten nutzer- und versionsgebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing, `ensureLangfristigeVersion`
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert den Produkte-Reiter (`art='lp_produkt'`), an dem die neue Markierung gepflegt wird
- Requires: PROJ-92 (Investitionsausgaben Planung — Langfristige Planung) — einzige Seite, auf der die Markierung ausgewertet wird (Zeilenauswahl je Untergruppe)

## Übersicht

Der Nutzer kann in der Langfristigen Planung einzelne **Produkte** als **Investition** markieren. Die Markierung wird **ausschließlich** auf der Seite **„Investitionsausgaben Planung"** (PROJ-92) ausgewertet: Dort erscheinen unter jeder Investitions-Untergruppe **standardmäßig nur** die als Investition markierten Produkte (statt wie bisher alle Produkte der Version). Zusätzlich kann der Nutzer je Untergruppe **manuell weitere Produkte** aus dem KPI-Modell als Zeile ergänzen.

Die Markierung hat **keinerlei** Wirkung an anderer Stelle (KPI-Modell, andere Planungs-/Auswertungsseiten, Kurzfristige Planung, globales KPI-Modell).

## User Stories
- Als Controller möchte ich in der KPI-Modell-Verwaltung (Reiter „Produkte") einzelne Produkte per Button als Investition markieren/entmarkieren.
- Als Controller möchte ich auf der Investitionsausgaben-Planung standardmäßig nur die als Investition markierten Produkte als Zeilen sehen, damit die Tabelle übersichtlich bleibt.
- Als Controller möchte ich je Untergruppe zusätzlich einzelne, nicht markierte Produkte als Zeile ergänzen und wieder entfernen können.

## Acceptance Criteria

### KPI-Modell Verwaltung — Reiter „Produkte"
- [x] Jede Produktzeile hat (bei Hover) einen Toggle-Button „Als Investition markieren"; aktiv = farblich hervorgehoben (Sparschwein-Icon)
- [x] Markierte Produkte zeigen das Icon auch **ohne** Hover dauerhaft (kein Text-Badge)
- [x] Der Toggle erscheint **nur** im Produkte-Reiter der Langfristigen Planung — nicht in Sales Plattform / Marketingkanäle / Investitionen und **nicht** im globalen KPI-Modell
- [x] Umschalten speichert optimistisch (Rollback bei Fehler)
- [x] Markierung ist pro Planversion und Nutzer isoliert

### Investitionsausgaben Planung (Auswertung)
- [x] Unter jeder Untergruppe erscheinen standardmäßig **nur** als Investition markierte Produkte
- [x] Je Untergruppe gibt es eine Zeile „Produkt hinzufügen" (Combobox mit Suche), die alle noch nicht angezeigten Produkte der Version anbietet
- [x] Manuell ergänzte Zeilen sind je Untergruppe entfernbar (X bei Hover); markierte (Standard-)Produkte sind nicht per Zeile entfernbar
- [x] Manuell ergänzte Zeilen sind **pro (Version, Untergruppe)** gespeichert und bleiben nach Reload erhalten
- [x] Aggregationen (Untergruppe, Übergruppe, Gesamt) summieren nur die **angezeigten** Produktzeilen
- [x] Auto-Berechnung „Produktinvestitionen Einkauf" (PROJ-92) und die manuelle-Werte-Logik bleiben unverändert; Werte-Zellen orphaner (nicht mehr angezeigter) Produkte werden weder angezeigt noch summiert

### Keine Nebenwirkungen
- [x] Die Markierung wird an keiner anderen Stelle als der Investitionsausgaben-Planung verwendet

## Datenbankschema (Supabase „Controlling-App", Migration `proj_105_investition_produkte`)
- Neue Spalte `langfristige_kpi_kategorien.ist_investition BOOLEAN NOT NULL DEFAULT false` (nur für `art='lp_produkt'` relevant)
- Neue Tabelle `langfristige_investitionsausgaben_produktzeilen`:
  - `id` UUID PK, `user_id` → `auth.users` (ON DELETE CASCADE), `plan_version_id` → `langfristige_planversionen` (ON DELETE CASCADE)
  - `kategorie_id` UUID (lp_investition-Untergruppe, kein harter FK), `produkt_id` UUID (lp_produkt, kein harter FK)
  - `created_at`; UNIQUE(`plan_version_id`, `kategorie_id`, `produkt_id`)
  - RLS aktiviert, 4 Policies (`auth.uid() = user_id`); Indizes auf `(user_id)`, `(plan_version_id)`, `(plan_version_id, kategorie_id)`

## API-Routen
- `PATCH /api/langfristige-planung/[versionId]/kpi-kategorien/[id]` — akzeptiert nun `ist_investition` (nur wirksam für `art='lp_produkt'`); GET/PATCH liefern das Feld
- `GET/PUT/DELETE /api/langfristige-planung/[versionId]/investitionsausgaben-planung/produktzeilen` — manuell ergänzte Produktzeilen (PUT idempotent via `onConflict`+`ignoreDuplicates`; DELETE per `{kategorie_id, produkt_id}`); `requireAuth` + `ensureLangfristigeVersion`, Zod, `dynamic='force-dynamic'`

## Implementation Notes (2026-07-03)

**Geänderte Dateien:**
- `src/hooks/use-kpi-categories.ts` — `KpiCategory.ist_investition?: boolean`
- `src/hooks/use-langfristige-kpi-kategorien.ts` — Feld gemappt + `toggleInvestition(id, value)` (optimistisch)
- `src/components/kpi-category-row.tsx` + `kpi-category-tree.tsx` — optionaler `onToggleInvestition`; Toggle-Button + dauerhaftes Icon bei markierten Produkten (nur wenn Callback verdrahtet)
- `src/app/dashboard/langfristige-planung/[versionId]/kpi-modell-verwaltung/page.tsx` — `onToggleInvestition` nur für `art==='lp_produkt'`
- `src/app/api/langfristige-planung/[versionId]/kpi-kategorien/route.ts` + `[id]/route.ts` — `ist_investition` in SELECT/PATCH
- `src/hooks/use-langfristige-investitionsausgaben.ts` — Produkte tragen `ist_investition`; neue Produktzeilen-State + `getUntergruppeProdukte`/`getAddbareProdukte`/`isEntfernbareZeile`/`addProduktzeile`/`removeProduktzeile`
- `src/components/langfristige-investitionsausgaben-tabelle.tsx` — Leafs je Untergruppe = markierte ∪ ergänzte Produkte; „Produkt hinzufügen"-Combobox (Popover+Command) je Untergruppe; Entfernen-Button auf ergänzten Zeilen

**Neue Dateien:**
- `src/app/api/langfristige-planung/[versionId]/investitionsausgaben-planung/produktzeilen/route.ts`
- DB-Migration `proj_105_investition_produkte`

**Bewusste Entscheidung:** Der globale „Zurücksetzen"-Button auf der Investitionsausgaben-Planung löscht weiterhin nur manuelle Werte + Notizen; die strukturellen Produktzeilen bleiben erhalten.

**Qualität:** `tsc --noEmit` ohne neue Fehler in den geänderten Nicht-Test-Dateien. (`next lint` ist im Template unter Next 16 nicht lauffähig.)

---

## QA Test Results

**Tested:** 2026-07-03
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Methodik:** Code-Audit gegen alle Akzeptanzkriterien + DB-Verifikation (Supabase) + Vitest (API-Route & Hook-Logik) + Playwright (Auth-Guards). Interaktive UI-Flows benötigen eine authentifizierte Session mit Daten (kein CI-Login) — funktionale Abdeckung daher über Vitest + Audit, konsistent mit PROJ-92/PROJ-104.

### Acceptance Criteria Status

#### AC-1: KPI-Modell Verwaltung — Reiter „Produkte"
- [x] Toggle-Button (Sparschwein-Icon) pro Produktzeile bei Hover; aktiv farblich hervorgehoben — `kpi-category-row.tsx` (`showInvestition = !!onToggleInvestition`)
- [x] Markierte Produkte zeigen das Icon dauerhaft, ohne Hover (kein Text-Badge) — persistentes Icon `showInvestition && category.ist_investition && !editing`
- [x] Toggle nur im Produkte-Reiter der Langfristigen Planung; **nicht** bei anderen Arten und **nicht** im globalen KPI-Modell — `page.tsx` verdrahtet `onToggleInvestition` nur für `art==='lp_produkt'`; globales Modell übergibt den Callback nie
- [x] Optimistisches Speichern mit Rollback bei Fehler — `toggleInvestition` in `use-langfristige-kpi-kategorien.ts`
- [x] Pro Planversion + Nutzer isoliert — PATCH filtert `user_id`+`plan_version_id`; RLS `auth.uid()=user_id`

#### AC-2: Investitionsausgaben Planung (Auswertung)
- [x] Standardmäßig nur markierte Produkte je Untergruppe — `getUntergruppeProdukte` (Vitest bestätigt: A→[p1,p2], B→[p1])
- [x] „Produkt hinzufügen"-Combobox mit Suche, nur noch nicht angezeigte Produkte — `getAddbareProdukte` (Vitest: A→[p3], B→[p2,p3])
- [x] Ergänzte Zeilen entfernbar (X bei Hover); markierte Standard-Produkte nicht entfernbar — `isEntfernbareZeile` (Vitest: p2/kat-a→true, p1→false, p2/kat-b→false)
- [x] Ergänzte Zeilen pro (Version, Untergruppe) gespeichert, bleiben nach Reload — DB-Tabelle + Load-Fetch
- [x] Aggregationen summieren nur angezeigte Zeilen — `flatRows`/`childLeafs` aus `getUntergruppeProdukte` je L2
- [x] Auto-Berechnung/manuelle-Werte-Logik unverändert; orphane Werte nicht angezeigt/summiert — `berechnet`-Route unangetastet; nicht angezeigte Leafs werden nicht referenziert
- [x] Kein blauer „manuell"-Punkt mehr (Nutzerwunsch 2026-07-03) — `getCellValue` liefert für manuelle Werte `indicator: null`; grauer Auto-Punkt bleibt

#### AC-3: Keine Nebenwirkungen
- [x] Markierung nur auf der Investitionsausgaben-Planung verwendet — Grep bestätigt: `ist_investition` wird ausschließlich in `use-langfristige-investitionsausgaben.ts` (Auswertung), im geteilten Row/Tree (nur wenn verdrahtet) und in KPI-Hook/Route gelesen

### Datenbank-Verifikation (Supabase „Controlling-App")
- [x] Spalte `langfristige_kpi_kategorien.ist_investition` = `boolean`, NOT NULL DEFAULT false
- [x] Tabelle `langfristige_investitionsausgaben_produktzeilen` existiert; RLS aktiv; 4 Policies; 5 Indizes (PK + Unique + 3 explizite)
- [x] `get_advisors(security)`: **keine** neue Warnung für die neue Tabelle (bestehende Warnungen betreffen nur ältere `USING(true)`-Tabellen)

### Edge Cases Status
- [x] Keine Produkte im KPI-Modell → Hinweis + kein Add-Row (`getAddbareProdukte=0`)
- [x] Produkte vorhanden, aber keins markiert → jede Untergruppe zeigt nur den Add-Row; L1/L2/Gesamt = „—"
- [x] Alle Produkte markiert → kein Add-Row (nichts mehr addbar), alle als Standardzeilen
- [x] Produkt später entmarkiert, das zuvor ergänzt wurde → erscheint wieder als entfernbare Zeile (konsistent)
- [x] Ergänztes Produkt entfernt → dessen manuelle Werte bleiben verwaist, werden aber weder angezeigt noch summiert
- [x] Fremde/unbekannte `versionId` → 404 (`ensureLangfristigeVersion`); ungültige UUID → 400
- [x] `PUT` doppelte Zeile → idempotent (`onConflict`+`ignoreDuplicates`, Antwort-Payload trotzdem gesetzt)

### Security Audit Results
- [x] Authentifizierung: alle neuen/erweiterten Endpunkte via `requireAuth` (unauth → Redirect /login, E2E bestätigt)
- [x] Autorisierung: Filter nach `user_id` **und** `plan_version_id` + `ensureLangfristigeVersion` (Defense-in-Depth) + RLS `auth.uid()=user_id`; fremde Version → 404, kein Cross-User-Zugriff
- [x] Input-Validierung: Zod (UUIDs für kategorie_id/produkt_id; `ist_investition` boolean); ungültige Eingaben → 400
- [x] Kein Datenleck: arbiträre `produkt_id`/`kategorie_id` landen unter eigenem user_id/version; nicht zur Version gehörende IDs werden clientseitig nie angezeigt (Filter über eigene Produkte)
- [x] `ist_investition` nur für `art='lp_produkt'` wirksam (Server ignoriert es für andere Arten)

### Automatisierte Tests
- **Neu:** `investitionsausgaben-planung/produktzeilen/route.test.ts` — 18/18 grün (GET/PUT/DELETE: Happy Path, 400/401/404/500, Idempotenz)
- **Neu:** `use-langfristige-investitionsausgaben.produktzeilen.test.ts` — 4/4 grün (Auswahllogik je Untergruppe)
- **Neu:** `tests/PROJ-105-…spec.ts` — 7/7 grün (Auth-Guards der Endpunkte + Seiten, Regression Kurzfristig)
- **Regression:** `kpi-kategorien` Routen 27/27 grün; `use-kpi-categories` 33/33 grün; bestehender `use-langfristige-investitionsausgaben.test.ts` 7/7 grün

### Bugs Found
Keine (Critical/High/Medium/Low = 0).

### Vorbestehende, NICHT durch PROJ-105 verursachte Beobachtungen
- `investitionsausgaben-planung/route.test.ts` (3 GET-Fälle) und `…/berechnet/route.test.ts` (6 Fälle) sind **rot** — Mock-Desync: die Test-`chain()` implementiert `.order()`/`.range()` nicht, obwohl die Routen seit der PostgREST-Pagination (`fetchAllRows`) diese nutzen. Beide Routen sind von PROJ-105 **unverändert** (leeres `git diff`). Empfehlung: separates Fix-Ticket (Test-Mocks nachziehen) — nicht Teil dieser Spec.

### Summary
- **Acceptance Criteria:** 3/3 Gruppen vollständig bestanden (alle Sub-Kriterien grün)
- **Bugs Found:** 0 (0 critical, 0 high, 0 medium, 0 low)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy — vorher optional das vorbestehende Test-Mock-Desync-Ticket einplanen (unabhängig von PROJ-105)

---

## Deployment

**Deployed:** 2026-07-03
**Pipeline:** Push auf `main` → Vercel Auto-Deploy (GitHub: LepiBaby/controlling-app)
**DB-Migration:** `proj_105_investition_produkte` bereits auf dem Remote-Projekt „Controlling-App" angewendet (kein weiterer Schritt nötig)
**Build:** `npm run build` erfolgreich (154/154 Seiten, keine Fehler)

**Nachträgliche Erweiterung (nach QA, auf Nutzerwunsch mit-deployt):** Die Investitions**auswertung** (PROJ-99, `use-langfristige-investitionsauswertung.ts` + `langfristige-investitionsauswertung-matrix.tsx`) wurde zusätzlich so umgebaut, dass die oberste Ebene die als Investition markierten **Produkte** (`ist_investition`) sind, darunter je Produkt der Investitions-Kategoriebaum. Damit gilt AC-3 („Markierung wird nur auf der Investitionsausgaben-Planung verwendet") **nicht mehr uneingeschränkt** — die Markierung wird bewusst auch in der Auswertung genutzt. Diese Erweiterung war **nicht** Teil des QA-Durchlaufs oben; funktionale Prüfung erfolgte nur über den erfolgreichen Build. Empfehlung: bei Bedarf separat per `/qa` nachziehen.
