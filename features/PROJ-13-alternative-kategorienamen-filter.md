# PROJ-13: Alternative Kategorienamen in Kategorie-Filtern

## Status: Approved
**Created:** 2026-04-19
**Last Updated:** 2026-04-19 (Frontend implementiert)

## Dependencies
- Requires: PROJ-10 (Kategorie-Anzeigebezeichnungen) — `kosten_label` / `ausgaben_label` auf `kpi_categories`
- Erweitert: PROJ-6 (Rentabilitäts-Auswertung) — Kategorie-Filter zeigt `kosten_label`
- Erweitert: PROJ-7 (Liquiditäts-Auswertung) — Kategorie-Filter zeigt `ausgaben_label`

## Übersicht

PROJ-10 hat alternative Anzeigenamen (`kosten_label`, `ausgaben_label`) für Ausgaben & Kosten-Hauptkategorien eingeführt. Diese Namen werden bisher **nur in der Tabellenspalte** der Auswertungen angezeigt. Die **Kategorie-Filter-Dropdowns** in der Rentabilitäts- und Liquiditätsauswertung zeigen weiterhin den internen Kategorienamen.

Diese Erweiterung sorgt dafür, dass auch die Kategorie-Filter-Optionen die konfigurierten alternativen Namen aus dem KPI-Modell verwenden — damit die Bezeichnungen in Filter und Tabellenspalte konsistent sind.

### Konkrete Änderung

| Auswertung | Quelle-Filter | Kategorie-Filter zeigt bisher | Soll zeigen |
|---|---|---|---|
| Rentabilität (PROJ-6) | Kosten | interner Kategoriename | `kosten_label ?? name` |
| Rentabilität (PROJ-6) | Umsatz | interner Kategoriename | `name` (unverändert) |
| Liquidität (PROJ-7) | Ausgaben | interner Kategoriename | `ausgaben_label ?? name` |
| Liquidität (PROJ-7) | Einnahmen | interner Kategoriename | `name` (unverändert) |

## User Stories

- Als Nutzer möchte ich, dass im Kategorie-Filter der Rentabilitätsauswertung bei Quelle = "Kosten" dieselbe Bezeichnung erscheint wie in der Tabellenspalte, damit ich Filteroptionen und Tabellenzeilen zuordnen kann, ohne zwischen internen und angezeigten Namen umzudenken.
- Als Nutzer möchte ich, dass im Kategorie-Filter der Liquiditätsauswertung bei Quelle = "Ausgaben" dieselbe Bezeichnung erscheint wie in der Tabellenspalte, damit die Filter-UI konsistent mit der Tabellen-UI ist.
- Als Nutzer möchte ich, dass bei Quelle = "Umsatz" (Rentabilität) oder "Einnahmen" (Liquidität) der Filter weiterhin den internen Kategorienamen zeigt, da für diese Kategorien keine alternativen Anzeigenamen definiert werden.
- Als Nutzer möchte ich, dass der Fallback (interner Name wenn kein Label konfiguriert) im Filter genauso funktioniert wie in der Tabellenspalte, damit keine Inkonsistenzen entstehen.

## Acceptance Criteria

### Rentabilitäts-Auswertung (PROJ-6 — Erweiterung)

- [ ] **AC-FILTER-09:** Ist Quelle-Filter = "Kosten" gewählt, zeigen die Optionen im Kategorie-Filter-Dropdown den `kosten_label` der jeweiligen Hauptkategorie — falls kein Label konfiguriert, wird der interne Kategoriename als Fallback angezeigt
- [ ] **AC-FILTER-10:** Ist Quelle-Filter = "Umsatz" gewählt, zeigt der Kategorie-Filter weiterhin den internen Kategorienamen (keine Änderung)
- [ ] **AC-FILTER-11:** Der Anzeigetext der gewählten Kategorie-Option im Filter ist konsistent mit dem Anzeigetext in der Tabellenspalte (beide zeigen `kosten_label ?? name` wenn Quelle = "Kosten")
- [ ] **AC-FILTER-12:** Filter-Logik (welche Datenbankzeilen gefiltert werden) bleibt unverändert — nur der angezeigte Label ändert sich, der Filterwert bleibt die `kategorie_id`
- [ ] **AC-FILTER-13:** Gruppe-Filter (Ebene 2) und Untergruppe-Filter (Ebene 3) zeigen weiterhin interne Kategorienamen (alternative Namen sind nur für Hauptkategorien / Ebene 1 definiert)

### Liquiditäts-Auswertung (PROJ-7 — Erweiterung)

- [ ] **AC-FILTER-09:** Ist Quelle-Filter = "Ausgaben" gewählt, zeigen die Optionen im Kategorie-Filter-Dropdown den `ausgaben_label` der jeweiligen Hauptkategorie — falls kein Label konfiguriert, wird der interne Kategoriename als Fallback angezeigt
- [ ] **AC-FILTER-10:** Ist Quelle-Filter = "Einnahmen" gewählt, zeigt der Kategorie-Filter weiterhin den internen Kategorienamen (keine Änderung)
- [ ] **AC-FILTER-11:** Der Anzeigetext der gewählten Kategorie-Option im Filter ist konsistent mit dem Anzeigetext in der Tabellenspalte (beide zeigen `ausgaben_label ?? name` wenn Quelle = "Ausgaben")
- [ ] **AC-FILTER-12:** Filter-Logik bleibt unverändert — Filterwert ist weiterhin die `kategorie_id`
- [ ] **AC-FILTER-13:** Gruppe-Filter und Untergruppe-Filter zeigen weiterhin interne Kategorienamen

### Allgemein

- [ ] Ist kein Quelle-Filter gesetzt oder sind beide Quellen gewählt, bleibt der Kategorie-Filter ausgeblendet (unveränderte Logik aus PROJ-6/PROJ-7)
- [ ] Das "Filter zurücksetzen"-Verhalten ist unverändert
- [ ] Keine Regression in der Tabellendarstellung (`kosten_label` / `ausgaben_label` in Tabellenspalten bleibt funktional)

## Edge Cases

- Kategorie hat `kosten_label = null` → Kategorie-Filter zeigt internen Namen (Fallback, identisch zur Tabellenspalte)
- Kategorie hat `kosten_label = ""` (leerer String) → Fallback auf internen Namen (konsistent mit PROJ-10-Logik: Leerstring wird als `null` gespeichert)
- Zwei Kategorien haben denselben `kosten_label` → beide erscheinen als separate Optionen (Filterung erfolgt über `kategorie_id`, nicht über den Anzeigetext)
- Nutzer wechselt Quelle von "Kosten" zu "Umsatz" → Kategorie-Filter wird zurückgesetzt (bestehende Logik aus PROJ-6), Neuanzeige zeigt interne Namen
- `kosten_label` wird im KPI-Modell nachträglich geändert → Filter zeigt beim nächsten Seitenaufruf den neuen Namen (kein Cache-Problem, da Labels über KPI-API geladen werden)
- Kategorie existiert in `kpi_categories`, hat aber `type ≠ ausgaben_kosten` → kein `kosten_label`/`ausgaben_label` vorhanden; interner Name wird angezeigt (Standardfall für Umsatz/Einnahmen-Kategorien)

## Änderungsumfang (kein Backend nötig)

Da `kosten_label` / `ausgaben_label` bereits über `GET /api/kpi-categories` zurückgegeben werden und die Auswertungsseiten die KPI-Kategorien ohnehin beim Laden abrufen, ist **keine Backend-Änderung** erforderlich. Die Änderung betrifft ausschließlich die Filter-Optionen auf den zwei Seiten:

- `src/app/dashboard/rentabilitaet/page.tsx` — Kategorie-Filter-Optionen: Anzeigetext = `cat.kosten_label ?? cat.name` wenn Quelle = "Kosten"
- `src/app/dashboard/liquiditaet/page.tsx` — Kategorie-Filter-Optionen: Anzeigetext = `cat.ausgaben_label ?? cat.name` wenn Quelle = "Ausgaben"

## Implementation Notes (Frontend)

**Implementiert:** 2026-04-19

Rein frontend-seitige Änderung — kein Backend nötig, da `kosten_label`/`ausgaben_label` bereits über `GET /api/kpi-categories` mitgeliefert werden.

### Geänderte Dateien

- `src/app/dashboard/rentabilitaet/page.tsx` — Neues `useMemo` `level1KategorienForFilter`: mappt `level1Kategorien` auf `{ id, name: cat.kosten_label ?? cat.name }` wenn `singleQuelle === 'kosten'`, sonst `cat.name`. Das `MultiSelect` für Kategorie nutzt `level1KategorienForFilter` statt `level1Kategorien`.
- `src/app/dashboard/liquiditaet/page.tsx` — Analog: `level1KategorienForFilter` mit `cat.ausgaben_label ?? cat.name` wenn `singleQuelle === 'ausgaben'`.

### Keine neuen Packages, keine Backend-Änderungen

---

## QA Test Results

**QA-Datum:** 2026-04-19
**QA-Status:** Approved — Keine kritischen oder hohen Bugs gefunden

### Automatisierte Tests

- **Vitest Unit-Tests:** 180/180 bestanden (gesamte Suite, keine Regressions)
- **Playwright E2E-Tests:** 100/100 bestanden (`tests/PROJ-13-alternative-kategorienamen-filter.spec.ts` + gesamte bestehende Suite)

### Acceptance Criteria — Ergebnis

| # | Kriterium | Ergebnis | Beleg |
|---|-----------|----------|-------|
| AC-FILTER-09 (Rentabilität) | Quelle = "Kosten" → Kategorie-Filter zeigt `kosten_label ?? name` | PASS (manuell) | `rentabilitaet/page.tsx` — `level1KategorienForFilter` mit `cat.kosten_label ?? cat.name` |
| AC-FILTER-10 (Rentabilität) | Quelle = "Umsatz" → Kategorie-Filter zeigt internen Namen | PASS (manuell) | `level1KategorienForFilter` gibt `cat.name` wenn `singleQuelle !== 'kosten'` |
| AC-FILTER-11 (Rentabilität) | Anzeigetext im Filter konsistent mit Tabellenspalte | PASS (manuell) | Beide nutzen `kosten_label ?? name` |
| AC-FILTER-12 (Rentabilität) | Filterwert bleibt `kategorie_id`, Filterlogik unverändert | PASS (Code-Review) | `options` ändert nur `name`, nicht `id`; `selected` enthält weiterhin IDs |
| AC-FILTER-13 (Rentabilität) | Gruppe/Untergruppe-Filter zeigen interne Namen | PASS (manuell) | `gruppeOptions` / `untergruppeOptions` nicht geändert |
| AC-FILTER-09 (Liquidität) | Quelle = "Ausgaben" → Kategorie-Filter zeigt `ausgaben_label ?? name` | PASS (manuell) | `liquiditaet/page.tsx` — analog zu Rentabilität |
| AC-FILTER-10 (Liquidität) | Quelle = "Einnahmen" → Kategorie-Filter zeigt internen Namen | PASS (manuell) | `singleQuelle !== 'ausgaben'` → `cat.name` |
| AC-FILTER-11 (Liquidität) | Anzeigetext im Filter konsistent mit Tabellenspalte | PASS (manuell) | Beide nutzen `ausgaben_label ?? name` |
| AC-FILTER-12 (Liquidität) | Filterwert bleibt `kategorie_id` | PASS (Code-Review) | Gleiche Logik wie Rentabilität |
| AC-FILTER-13 (Liquidität) | Gruppe/Untergruppe-Filter zeigen interne Namen | PASS (manuell) | `gruppeOptions` / `untergruppeOptions` unverändert |
| AC-GENERAL-01 | Kein Quelle-Filter → Kategorie-Filter ausgeblendet | PASS (manuell) | Unveränderte `showKategorieFilter`-Logik |
| AC-GENERAL-02 | Beide Quellen → Kategorie-Filter ausgeblendet | PASS (manuell) | `singleQuelle = null` wenn `filter.quelle?.length !== 1` |
| AC-GENERAL-03 | "Filter zurücksetzen" leert alle Filter | PASS (manuell) | `setFilter({})` unverändert |
| AC-GENERAL-04 | Tabellenspalten zeigen weiterhin `kosten_label`/`ausgaben_label` (Regression PROJ-10) | PASS (manuell) | `rentabilitaet-table.tsx` / `liquiditaet-table.tsx` nicht geändert |

**Bestanden: 14/14**

### Edge Cases — verifiziert

- `kosten_label = null` → Filter zeigt internen Kategorienamen (`cat.kosten_label ?? cat.name` — Nullish-Coalescing greift)
- Quelle von "Kosten" auf "Umsatz" wechseln → Kategorie-Filter wird zurückgesetzt + zeigt interne Namen beim nächsten Öffnen
- Zwei Kategorien mit gleichem `kosten_label` → beide als separate Optionen sichtbar (Filterung läuft über `id`, nicht über `name`)
- `ausgaben_label = null` bei Liquidität → analoges Fallback-Verhalten

### Sicherheits-Audit

- Keine neuen Angriffsvektoren — rein client-seitige Anzeigelogik
- `kosten_label`/`ausgaben_label` sind lesende Daten aus bereits auth-geschützter API (`/api/kpi-categories`)
- Keine XSS-Gefahr: React escaped Textausgabe standardmäßig

### Regressions-Check

- Alle 180 Vitest Unit-Tests bestanden
- Alle 100 Playwright E2E-Tests bestanden (gesamte PROJ-1 bis PROJ-13 Suite)
- Tabellenspalten-Darstellung in Rentabilität und Liquidität unverändert funktional

### Gefundene Bugs

**Keine.**

### Production-Ready-Entscheidung

**READY** — Alle 14 Acceptance Criteria bestanden, keine Bugs, Sicherheits-Audit sauber, keine Regressions.
