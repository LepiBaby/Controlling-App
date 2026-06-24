# PROJ-77: Produktinformationen — Langfristige Planung

## Status: Approved
**Created:** 2026-06-20
**Last Updated:** 2026-06-20 (QA)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — liefert Planversion-Container, versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`) und das kontextabhängige Seitenmenü. Der Nav-Slug `produktinformationen` ist dort bereits vorgesehen.
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert die **Produkte** je Planversion (`langfristige_kpi_kategorien` mit `art = 'lp_produkt'`, `level = 1`), auf die diese Seite verweist.
- Vorlage (kein harter Require): PROJ-59 (Produktinformationen — Kurzfristige Planung) — dient als 1:1-UI-/Bedien-/Datenvorlage. Diese Seite ist die versionsgebundene Schwester von PROJ-59.

## Overview
Im Bereich **Langfristige Planung** wird innerhalb einer geöffneten Planversion die Seite **„Produktinformationen"** ausgebaut (der Nav-Slug ist aus PROJ-73 bereits reserviert). Sie ist **funktional und im Aufbau identisch** mit der Produktinformationen-Seite der Kurzfristigen Planung (PROJ-59) — gleiche 7 Tabs, gleiche Felder, gleiche Auto-Save-Bedienung — mit **genau einem grundlegenden Unterschied**:

> Statt auf die globalen KPI-Produkte (`kpi_categories`) verweist die Seite auf die **Produkte der jeweiligen Planversion** (`langfristige_kpi_kategorien` mit `art = 'lp_produkt'`, `level = 1`, gefiltert nach `versionId`). Sämtliche eingegebenen Daten werden **pro Planversion isoliert** gespeichert.

Daraus folgen zwei strukturelle Anpassungen gegenüber PROJ-59 (beide vom Nutzer am 2026-06-20 bestätigt):

1. **MOQ nur auf Produktebene:** Die Langfristig-Produkte (PROJ-74) sind eine **flache Liste ohne SKUs**. Die Produkt-/SKU-Ebenen-Auswahl des Kurzfristig-MOQ-Tabs entfällt daher; die MOQ wird ausschließlich je Produkt gepflegt.
2. **Globale Einstellungen pro Planversion:** Container-Maximalvolumen und globale Kosten-/Zahlungsziel-Einstellungen werden — anders als in Kurzfristig (pro Nutzer) — **pro Planversion** gehalten (konsistent mit der vollständigen Versionsisolation der Langfristigen Planung).

Die Seite besteht weiterhin aus **7 Tabs**:

1. **Hersteller** — Hersteller je Produkt verwalten
2. **MOQ** — Mindestbestellmenge je Produkt (nur Produktebene)
3. **Containerkapazität** — Paketmaße je Produkt + globale Containervolumen (pro Version) → automatische Kapazitätsberechnung
4. **Lieferzeit** — Zeiten je Produkt → automatische Gesamtzeit
5. **Zahlungskonditionen** — Zahlungsanteile in % und Zahlungsziele in Tagen je Produkt
6. **Produktkosten** — Globale Versand-/Inspektions-/Einlagerungskosten je Containerart (pro Version) + Warenkosten & Zollsatz je Produkt
7. **Bestandsverwaltung** — Sicherheitsbestand und Zielreichweite je Produkt

---

## User Stories

### Allgemein
- Als Controller möchte ich innerhalb einer geöffneten Planversion die Seite „Produktinformationen" über das Seitenmenü („Einstellungen") aufrufen können.
- Als Controller möchte ich auf der Versions-Übersichtsseite eine Kachel „Produktinformationen" sehen, die auf die Seite dieser Version verlinkt.
- Als Controller möchte ich, dass die Seite genau dieselben 7 Tabs und dieselbe Bedienung bietet wie in der Kurzfristigen Planung, damit ich mich nicht umgewöhnen muss.
- Als Controller möchte ich, dass jede Planversion komplett eigene, anfangs leere Produktinformationen-Daten hat, damit sich Szenarien nicht gegenseitig beeinflussen.
- Als Controller möchte ich, dass alle Tabs ausschließlich die Produkte **dieser Planversion** anzeigen (aus dem KPI-Modell der Version).
- Als Controller möchte ich, dass meine Eingaben beim Verlassen eines Feldes automatisch gespeichert werden (kein manueller Speichern-Button).

### Tab Hersteller
- Als Controller möchte ich jedem Produkt einen Hersteller per Dropdown zuordnen können.
- Als Controller möchte ich im Dropdown alle bereits angelegten Hersteller sehen.
- Als Controller möchte ich direkt im Dropdown einen neuen Herstellernamen eingeben und bestätigen können, ohne ein separates Formular aufzurufen.

### Tab MOQ
- Als Controller möchte ich je Produkt ein einzelnes MOQ-Feld (Mindestbestellmenge) befüllen können.

### Tab Containerkapazität
- Als Controller möchte ich das maximale Ladevolumen je Containerart (20DC, 40DC, 40HQ) je Planversion hinterlegen.
- Als Controller möchte ich je Produkt Länge, Breite und Höhe des Pakets in cm eingeben.
- Als Controller möchte ich automatisch das Stückvolumen (berechnet aus L × B × H) angezeigt bekommen.
- Als Controller möchte ich automatisch die Maximalkapazität je Containerart (Einheiten) angezeigt bekommen.

### Tab Lieferzeit
- Als Controller möchte ich je Produkt Produktionszeit, Zwischenzeit, Shipping-Zeit und Entladungszeit in Tagen eingeben.
- Als Controller möchte ich die automatisch berechnete Gesamtlieferzeit angezeigt bekommen.

### Tab Zahlungskonditionen
- Als Controller möchte ich je Produkt definieren, wie viel Prozent der Warenkosten vor Produktion, nach Produktion und nach Ankunft gezahlt werden (Summe = 100 %).
- Als Controller möchte ich, sobald alle drei %-Felder befüllt sind, zusätzliche Felder für das Zahlungsziel in Tagen je Phase sehen.

### Tab Produktkosten
- Als Controller möchte ich globale Netto-Kosten für Shipping, Inspektion und Einlagerung je Containerart sowie das jeweilige Zahlungsziel je Planversion hinterlegen.
- Als Controller möchte ich das Zahlungsziel für Zollkosten je Planversion hinterlegen.
- Als Controller möchte ich je Produkt die Warenkosten und den Zollsatz in % pflegen.

### Tab Bestandsverwaltung
- Als Controller möchte ich je Produkt den Sicherheitsbestand und die Zielreichweite pflegen.

---

## Acceptance Criteria

### Navigation & Einstieg
- [ ] Die Seite ist nur innerhalb eines gültigen Versionskontexts erreichbar: `/dashboard/langfristige-planung/[versionId]/produktinformationen`
- [ ] Die Seite respektiert die Zugriffs-/Versionsprüfung aus PROJ-73 (fremde/unbekannte `versionId` → Redirect zum Dashboard, kein Fremdzugriff; nur eingeloggte Nutzer)
- [ ] Die Seite ist in das bestehende Versions-Gerüst (`LangfristigeVersionShell`) eingebettet (Header, Breadcrumb, Seitenmenü identisch zu den anderen Versionsseiten)
- [ ] Das Seitenmenü-Element „Produktinformationen" (Gruppe „Einstellungen", Slug bereits in PROJ-73 vorhanden) führt auf diese Seite
- [ ] Auf der Versions-Übersichtsseite erscheint eine Kachel „Produktinformationen", die auf die Seite dieser Version verlinkt
- [ ] Die Seite zeigt 7 Tabs: „Hersteller", „MOQ", „Containerkapazität", „Lieferzeit", „Zahlungskonditionen", „Produktkosten", „Bestandsverwaltung"
- [ ] Beim ersten Laden ist der erste Tab „Hersteller" automatisch aktiv

### Produktquelle (gilt für alle Tabs)
- [ ] Alle produktbezogenen Tabellen zeigen eine Zeile pro Produkt der **aktuellen Planversion** (`langfristige_kpi_kategorien` mit `art = 'lp_produkt'`, `level = 1`, gefiltert nach `versionId`, sortiert nach `sort_order`)
- [ ] Gibt es in dieser Planversion keine Produkte, erscheint je Tab ein Hinweis mit Link zur **KPI-Modell-Verwaltung dieser Version** (PROJ-74), nicht zur globalen KPI-Modell-Seite
- [ ] Es werden **keine** globalen KPI-Produkte (`kpi_categories`) und keine Produkte anderer Planversionen angezeigt

---

### Tab 1: Hersteller
- [ ] Tabelle mit einer Zeile pro Produkt der Version; Spalten: **Produkt** (read-only), **Hersteller** (Dropdown)
- [ ] Das Dropdown zeigt alle bereits angelegten Hersteller (alphabetisch sortiert)
- [ ] Ist kein Hersteller zugeordnet, zeigt das Dropdown den Platzhalter „Hersteller wählen oder anlegen"
- [ ] Der Nutzer kann im Suchfeld einen neuen Namen eingeben; ist er noch nicht vorhanden, erscheint „Neu erstellen: [Name]"
- [ ] „Neu erstellen: [Name]" legt den Hersteller an und ordnet ihn sofort zu (kein Formular, kein Reload)
- [ ] Auswahl eines bestehenden Herstellers ordnet diesen sofort zu (Auto-Save)
- [ ] Keine Produkte in der Version → Hinweis mit Link zur KPI-Modell-Verwaltung der Version

---

### Tab 2: MOQ
- [ ] Tabelle mit einer Zeile pro Produkt der Version; Spalten: **Produkt** (read-only), **MOQ** (Ganzzahl ≥ 1)
- [ ] **Keine** Produkt-/SKU-Ebenen-Auswahl, **keine** aufklappbaren SKU-Zeilen (LP-Produkte haben keine SKUs)
- [ ] Das MOQ-Feld wird bei `onBlur` automatisch gespeichert
- [ ] Keine Produkte in der Version → Hinweis mit Link zur KPI-Modell-Verwaltung der Version

---

### Tab 3: Containerkapazität

#### Globale Container-Volumina (oberer Bereich, pro Planversion)
- [ ] Abschnitt „Container-Maximalvolumen" mit drei Feldern: **20DC**, **40DC**, **40HQ** (Dezimalzahl, m³, ≥ 0)
- [ ] Die drei Felder werden bei `onBlur` automatisch gespeichert (1 Eintrag **pro Planversion**, Upsert)

#### Produkt-Paketmaße und berechnete Kapazitäten (unterer Bereich)
- [ ] Tabelle mit einer Zeile pro Produkt der Version; Spalten:
  - **Produkt** (read-only)
  - **Länge (cm)** / **Breite (cm)** / **Höhe (cm)** (editierbar, Dezimalzahl ≥ 0)
  - **Stückvolumen** (read-only, automatisch berechnet aus L × B × H; nur wenn alle 3 Maße vorhanden)
  - **Max. 20DC (Stk.)** / **Max. 40DC (Stk.)** / **Max. 40HQ (Stk.)** (read-only, automatisch berechnet aus Container-Volumen ÷ Stückvolumen, abgerundet; nur wenn alle 3 Maße + Container-Volumen vorhanden)
- [ ] Berechnete Felder sind nicht editierbar; Paketmaße werden bei `onBlur` gespeichert
- [ ] Keine Produkte in der Version → Hinweis mit Link zur KPI-Modell-Verwaltung der Version

---

### Tab 4: Lieferzeit
- [ ] Tabelle mit einer Zeile pro Produkt der Version; Spalten:
  - **Produkt** (read-only)
  - **Produktionszeit (Tage)** / **Zwischenzeit (Tage)** / **Shipping-Zeit (Tage)** / **Entladungszeit (Tage)** (editierbar, Ganzzahl ≥ 0)
  - **Gesamtzeit (Tage)** (read-only, automatisch summiert; angezeigt wenn mindestens ein Wert vorhanden)
- [ ] Editierbare Felder werden bei `onBlur` gespeichert
- [ ] Keine Produkte in der Version → Hinweis mit Link zur KPI-Modell-Verwaltung der Version

---

### Tab 5: Zahlungskonditionen
- [ ] Tabelle mit einer Zeile pro Produkt der Version; Basisspalten (immer sichtbar):
  - **Produkt** (read-only)
  - **Vor Produktion (%)** / **Nach Produktion (%)** / **Nach Ankunft (%)** (editierbar, Dezimalzahl 0–100)
- [ ] Solange die Summe der drei %-Felder ≠ 100, erscheint eine Inline-Fehlermeldung in der Zeile: „Die Summe muss 100 % ergeben (aktuell: X %)"
- [ ] Auto-Save (bei `onBlur`) der %-Felder ist erst möglich, wenn die Summe exakt 100 % beträgt
- [ ] Sind alle drei %-Felder befüllt **und** Summe = 100, erscheinen zusätzliche Spalten:
  - **Zahlungsziel Vor Produktion (Tage)** / **Nach Produktion (Tage)** / **Nach Ankunft (Tage)** (editierbar, Ganzzahl ≥ 0)
- [ ] Die Zahlungsziel-Spalten sind editierbar und werden bei `onBlur` gespeichert
- [ ] Keine Produkte in der Version → Hinweis mit Link zur KPI-Modell-Verwaltung der Version

> Hinweis: Das exakte Anzeigeverhalten der Zahlungsziel-Spalten wird 1:1 von PROJ-59 übernommen (dort: jede ZZ-Spalte erscheint, sobald ihr eigenes %-Feld befüllt ist — siehe PROJ-59 QA-Abweichung).

---

### Tab 6: Produktkosten

#### Globale Kosteneinstellungen (oberer Bereich, pro Planversion)
- [ ] Abschnitt „Globale Kosten- und Zahlungsziel-Einstellungen" mit:
  - **Shippingkosten (Netto):** 20DC / 40DC / 40HQ (€, ≥ 0) + Zahlungsziel Shipping (Tage, ≥ 0)
  - **Inspektionskosten (Netto):** 20DC / 40DC / 40HQ (€, ≥ 0) + Zahlungsziel Inspektion (Tage, ≥ 0)
  - **Einlagerungskosten (Netto):** 20DC / 40DC / 40HQ (€, ≥ 0) + Zahlungsziel Einlagerung (Tage, ≥ 0)
  - **Zollkosten:** Zahlungsziel Zoll (Tage, ≥ 0)
- [ ] Alle globalen Felder werden bei `onBlur` automatisch gespeichert (1 Eintrag **pro Planversion**, Upsert)

#### Produktspezifische Kosten (unterer Bereich)
- [ ] Tabelle mit einer Zeile pro Produkt der Version; Spalten: **Produkt** (read-only), **Warenkosten (€)** (≥ 0), **Zollsatz (%)** (0–100)
- [ ] Felder werden bei `onBlur` gespeichert
- [ ] Keine Produkte in der Version → Hinweis mit Link zur KPI-Modell-Verwaltung der Version

---

### Tab 7: Bestandsverwaltung
- [ ] Tabelle mit einer Zeile pro Produkt der Version; Spalten: **Produkt** (read-only), **Sicherheitsbestand** + **Zielreichweite** (analog zur Kurzfristig-Umsetzung PROJ-59, inkl. dortiger user-beauftragter Abweichung „Sicherheitsbestand in Monaten")
- [ ] Felder werden bei `onBlur` gespeichert
- [ ] Keine Produkte in der Version → Hinweis mit Link zur KPI-Modell-Verwaltung der Version

---

### Datenpersistenz & Versionsisolation (alle Tabs)
- [ ] Alle Änderungen werden automatisch gespeichert (kein globaler „Speichern"-Button)
- [ ] Optimistische Updates: Änderung erscheint sofort in der UI, wird im Hintergrund gespeichert
- [ ] Bei API-Fehler: Toast-Fehlermeldung, Rollback auf vorherigen Wert
- [ ] Beim nächsten Seitenaufruf sind alle gespeicherten Werte vorbelegt
- [ ] Alle Tabs laden und speichern Daten ausschließlich für die aktuelle `versionId` des eingeloggten Nutzers
- [ ] Eine neu angelegte Planversion zeigt auf allen Tabs **leere** Werte (keine Übernahme aus anderen Versionen oder der Kurzfristigen Planung)
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B, andere Versionen oder die Kurzfristige Planung
- [ ] Beim Löschen einer Planversion (PROJ-73) werden alle Produktinformationen-Daten dieser Version kaskadierend mitgelöscht — keine verwaisten Datensätze

---

## Edge Cases

### Allgemein
- **Keine Produkte in der Version:** Jeder Tab zeigt einen Hinweis mit Link zur KPI-Modell-Verwaltung **dieser Version**; keine Tabelle
- **Produkt wird aus dem Versions-KPI-Modell gelöscht:** `ON DELETE CASCADE` (FK zu `langfristige_kpi_kategorien`) entfernt alle zugehörigen Einträge; beim nächsten Seitenaufruf ist die Zeile verschwunden
- **Planversion wird gelöscht:** `ON DELETE CASCADE` (FK zu `langfristige_planversionen`) entfernt alle Produktinformationen-Daten der Version
- **Fremde/unbekannte `versionId`:** Redirect zum Dashboard (PROJ-73-Verhalten); kein Fremdzugriff, kein Absturz
- **API-Fehler beim Auto-Save:** Toast-Fehlermeldung, Rollback auf vorherigen Wert
- **Hersteller versionsübergreifend:** _Offene Frage (siehe unten)_ — Default-Annahme: Hersteller-Stammliste ist pro Planversion getrennt (volle Isolation)

### Tab Hersteller
- **Herstellername bereits vorhanden:** Kein Duplikat; bestehender Hersteller wird angezeigt und ist wählbar
- **Leerer Herstellername:** „Neu erstellen"-Option erscheint nicht; kein API-Aufruf
- **Hersteller anlegen schlägt fehl:** Toast-Fehlermeldung; Dropdown bleibt beim alten Wert

### Tab MOQ
- **MOQ < 1 oder leer:** Leerer Wert wird als „nicht gepflegt" (NULL) behandelt; Werte < 1 werden abgelehnt

### Tab Containerkapazität
- **Nicht alle 3 Maße vorhanden:** Stückvolumen und Kapazitäten werden als „–" angezeigt
- **Container-Volumen (der Version) noch nicht gepflegt:** Kapazitäten zeigen „–"; Hinweis-Tooltip „Bitte zuerst das Container-Maximalvolumen oben eintragen"
- **Stückvolumen = 0:** Division durch 0 vermieden; Kapazität als „–"

### Tab Zahlungskonditionen
- **Summe der 3 %-Felder ≠ 100:** Inline-Fehlermeldung; kein Auto-Save der %-Felder
- **Nur ein/zwei %-Felder befüllt:** Zahlungsziel-Verhalten 1:1 wie PROJ-59
- **Summe = 100, dann geändert → ≠ 100:** Verhalten 1:1 wie PROJ-59

### Tab Produktkosten / Bestandsverwaltung
- **Zollsatz = 0 / Zielreichweite = 0:** Gültige Werte; werden gespeichert

---

## Technical Requirements

- **Authentifizierung:** `requireAuth()` in allen neuen API-Routen
- **Versionsprüfung:** Jeder Zugriff prüft serverseitig, dass die `versionId` dem eingeloggten Nutzer gehört (analog PROJ-74 `ensureVersion`); fremde/unbekannte Version → 404/kein Zugriff
- **RLS:** Row Level Security auf allen neuen Tabellen (`auth.uid() = user_id`)
- **Versionsbindung:** Alle neuen Tabellen tragen `plan_version_id` (FK → `langfristige_planversionen`, `ON DELETE CASCADE`); produktbezogene Tabellen zusätzlich `produkt_id` (FK → `langfristige_kpi_kategorien`, `ON DELETE CASCADE`)
- **Datenmodell:** Spiegelt die 11 PROJ-59-Tabellen, jedoch
  - versionsgebunden (zusätzliche `plan_version_id`-Spalte, FK zu Versions-Produkten statt globalen `kpi_categories`)
  - **ohne** `produktinformationen_moq_sku` (keine SKUs in LP) und ohne `ebene`-Spalte/SKU-Logik in der MOQ-Tabelle
  - globale Tabellen (Container/Kosten) mit `UNIQUE(plan_version_id)` statt `UNIQUE(user_id)`
- **Wiederverwendung:** Die bestehende PROJ-59-UI (`produktinformationen-tabs.tsx`) und die zugehörigen Hooks sollen so weit wie sinnvoll wiederverwendet/parametrisiert werden — der MOQ-Tab wird auf reine Produktebene reduziert; die Produktquelle und alle API-Pfade werden versions-/`versionId`-bewusst gemacht. (Detaillierte Wiederverwendungs- vs. Neubau-Entscheidung trifft `/architecture`.)
- **Validierung:** alle Eingaben serverseitig mit Zod validieren; Zahlungskonditionen-Summen-Regel = 100 % wie PROJ-59
- **Berechnungen** (Stückvolumen, Kapazitäten, Gesamtlieferzeit) erfolgen clientseitig, werden nicht persistiert
- **shadcn/ui first:** Tabs, Table, Input, Command + Popover (Hersteller-Combobox), Card, Toast wiederverwenden (alle bereits installiert; keine neuen Packages)
- **Responsive:** Mobil (375px) und Desktop (1440px)
- **Neue Seite:** `src/app/dashboard/langfristige-planung/[versionId]/produktinformationen/page.tsx`, eingebettet in `LangfristigeVersionShell`
- **Versions-Übersicht:** Kachel „Produktinformationen" (Slug bereits in `src/lib/langfristige-planung-nav.ts` vorhanden — nur Seite + ggf. Kachel-Verdrahtung nötig)
- **API-Präfix:** versions-bewusst, analog PROJ-74, z. B. unter `/api/langfristige-planung/[versionId]/produktinformationen/...`

---

## Open Questions / Follow-ups
- ~~**Hersteller-Stammliste — pro Version oder pro Nutzer geteilt?**~~ **Entschieden (2026-06-20, `/architecture`): pro Planversion getrennt** (volle Isolation, anfangs leer). Die Hersteller-**Zuordnung** Produkt→Hersteller ist ebenfalls versionsgebunden.
- Verwendung der hier gepflegten Produktinformationen in nachgelagerten Planungs-/Auswertungsseiten der Langfristigen Planung (eigene Specs).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee
Diese Seite ist — wie schon im Spec angelegt — die **versionsgebundene Schwester** der Kurzfristig-Seite (PROJ-59). Die gesamte sichtbare Oberfläche (7 Reiter, Tabellen, Felder, Auto-Save, Hersteller-Combobox, berechnete Kapazitäten/Gesamtzeiten) existiert bereits und funktioniert. Der eigentliche Architektur-Aufwand liegt **nicht** in der Optik, sondern in zwei Dingen:

1. **Die Produktliste kommt aus einer anderen Quelle:** statt aus dem globalen KPI-Modell aus den Produkten **dieser Planversion** (PROJ-74).
2. **Jeder gespeicherte Wert hängt an einer Planversion:** alle Daten werden je `versionId` getrennt abgelegt, geladen und beim Löschen der Version automatisch mitentfernt.

Damit folgt diese Seite exakt demselben Muster, das in der Langfristigen Planung bereits etabliert ist (KPI-Modell-Verwaltung PROJ-74, Auszahlungseinstellungen, Grundeinstellungen): eine bestehende Oberfläche wird in das **Versions-Gerüst** eingebettet und gegen **versionsbewusste Endpunkte** verdrahtet.

### A) Seiten- & Navigationsstruktur (Komponenten-Baum)
```
Produktinformationen  (innerhalb einer geöffneten Planversion)
+-- Versions-Gerüst (bestehend: lädt/prüft Version, Header, Breadcrumb, Seitenmenü, Redirect bei fremder Version)
+-- Reiter-Leiste (7 Tabs — identisch zu Kurzfristig)
    +-- Reiter 1 "Hersteller"          -> Tabelle je Produkt + Hersteller-Auswahl (anlegen/zuordnen)
    +-- Reiter 2 "MOQ"                 -> Tabelle je Produkt, EIN MOQ-Feld (keine SKU-Ebene)
    +-- Reiter 3 "Containerkapazität"  -> globale Volumina (je Version) + Paketmaße je Produkt + berechnete Kapazitäten
    +-- Reiter 4 "Lieferzeit"          -> 4 Zeitfelder je Produkt + berechnete Gesamtzeit
    +-- Reiter 5 "Zahlungskonditionen" -> 3 %-Felder (Summe=100) + bedingte Zahlungsziel-Felder
    +-- Reiter 6 "Produktkosten"       -> globale Kosten (je Version) + Warenkosten/Zollsatz je Produkt
    +-- Reiter 7 "Bestandsverwaltung"  -> Sicherheitsbestand + Zielreichweite je Produkt
```
- Die Produktliste je Reiter stammt aus den **Versions-Produkten** (`art = 'lp_produkt'` der aktuellen `versionId`).
- Ist die Versions-Produktliste leer, zeigt jeder Reiter einen Hinweis mit Link zur **KPI-Modell-Verwaltung dieser Version** (nicht zur globalen Seite).

### B) Navigation
- Der Menüeintrag „Produktinformationen" (Gruppe „Einstellungen") **existiert bereits** in der zentralen Versions-Navigationskonfiguration (PROJ-73, Slug `produktinformationen`). Es ist **keine** Navigationsänderung nötig; es wird lediglich die zugehörige Seite gebaut. Menü, Breadcrumb und die Kachel auf der Versions-Übersicht ziehen automatisch nach.

### C) Datenmodell (in Klartext)
Es entsteht **eine versionsgebundene Datenablage**, die die Kurzfristig-Struktur (PROJ-59) spiegelt — mit drei systematischen Unterschieden:

| Unterschied zu Kurzfristig (PROJ-59) | Wie hier |
|--------------------------------------|----------|
| Bindung an Nutzer | zusätzlich an **Planversion** (jede Zeile kennt ihre Version) |
| Produktbezug zeigt auf globale KPI-Produkte | zeigt auf die **Versions-Produkte** (PROJ-74) |
| „Globale" Einstellungen gelten pro Nutzer | gelten **pro Planversion** (jede Version hat eigene Container-Volumina & globale Kosten) |

**Welche Informationen gespeichert werden (je eigener Bereich, alle pro Version):**
```
- Hersteller-Stammliste     : anlegbare Herstellernamen (je Planversion eigene, anfangs leere Liste)
- Hersteller-Zuordnung      : welches Produkt hat welchen Hersteller
- MOQ                        : Mindestbestellmenge je Produkt (nur Produktebene — KEINE SKU-Tabelle)
- Container-Volumina global  : Maximalvolumen 20DC/40DC/40HQ (1 Eintrag pro Version)
- Container-Paketmaße        : Länge/Breite/Höhe je Produkt
- Lieferzeit                 : Produktions-/Zwischen-/Shipping-/Entladungszeit je Produkt
- Zahlungskonditionen        : 3 Prozentanteile + 3 Zahlungsziele je Produkt
- Kosten global              : Shipping/Inspektion/Einlagerung je Containerart + Zahlungsziele (1 Eintrag pro Version)
- Produktkosten              : Warenkosten + Zollsatz je Produkt
- Bestandsverwaltung         : Sicherheitsbestand + Zielreichweite je Produkt
```
- **Bewusst NICHT enthalten** (im Vergleich zu PROJ-59): die SKU-MOQ-Ablage und das „Ebene"-Feld (Produkt/SKU). Grund: Langfristig-Produkte haben keine SKUs.
- **Berechnete Werte** (Stückvolumen, Max.-Kapazitäten, Gesamtlieferzeit) werden — wie in PROJ-59 — **nicht** gespeichert, sondern im Browser berechnet.

**Isolations- & Löschregeln:**
```
- Jede Zeile hängt an genau einer Planversion und einem Nutzer.
- Löscht man eine Planversion (PROJ-73), werden alle Produktinformationen-Daten dieser Version
  automatisch mitgelöscht (kaskadierend) — keine verwaisten Datensätze.
- Löscht man ein Produkt im Versions-KPI-Modell, verschwinden dessen Produktinformationen automatisch.
- Daten verschiedener Versionen sind vollständig getrennt; eine neue Version startet überall leer.
```

### D) Server-Schnittstellen (Endpunkte, versions- & nutzergebunden)
Es entsteht ein neuer Endpunkt-Satz unter der Langfristig-Struktur (analog zu den bestehenden Versions-Endpunkten), gruppiert nach Reiter-Thema (wie in PROJ-59). Jeder Endpunkt:
- **liest/speichert** ausschließlich Daten der übergebenen `versionId` des eingeloggten Nutzers,
- prüft serverseitig, dass die Planversion dem Nutzer gehört (sonst kein Zugriff — gleiches Muster wie PROJ-74),
- validiert alle Eingaben (u. a. Zahlungskonditionen-Summe = 100 %).

Thematische Endpunkt-Gruppen (lesen + speichern je Thema): Hersteller-Stammliste, Hersteller-Zuordnung, MOQ, Container-Volumina (global/Version), Container-Paketmaße, Lieferzeit, Zahlungskonditionen, Kosten (global/Version), Produktkosten, Bestandsverwaltung. Die **Produktliste** selbst wird über die **bereits existierenden** KPI-Kategorien-Endpunkte der Version (`art = 'lp_produkt'`) gelesen — hier ist kein neuer Endpunkt nötig.

### E) Wiederverwendung im Detail
| Baustein | Status | Anmerkung |
|----------|--------|-----------|
| Versions-Gerüst (Laden/Prüfen der Version, Header, Seitenmenü, Redirect) | **unverändert wiederverwenden** | aus PROJ-73; wie bei allen Versionsseiten |
| Reiter-Optik, Tabellen, Felder, Auto-Save, Hersteller-Combobox, berechnete Kapazitäten/Gesamtzeit | **wiederverwenden** (PROJ-59-Tabs als Basis) | jeder Reiter bekommt die Produktliste bereits als Eingabe; die Optik bleibt gleich |
| MOQ-Reiter | **vereinfachte Variante** | Produkt-/SKU-Umschalter und SKU-Zeilen entfallen; nur ein MOQ-Feld je Produkt |
| Produktquelle | **umgestellt** | statt globalem KPI-Modell die Versions-Produkte (`art = 'lp_produkt'`, gefiltert nach `versionId`) |
| Daten-Lade-/Speicher-Logik (die Reiter-Hooks) | **versionsbewusste Variante** | wie die PROJ-59-Hooks, aber gegen die versionsgebundenen Endpunkte (jeder Aufruf trägt die `versionId`) |
| Empty-State-Link | **umgestellt** | zeigt auf die KPI-Modell-Verwaltung **dieser Version**, nicht auf die globale Seite |
| Datenablage + Endpunkte | **Neubau** | versions-/nutzergebunden, ohne SKU-MOQ, globale Werte je Version |
| shadcn/ui-Bausteine (Tabs, Table, Input, Card, Command+Popover, Toast) | **bestehend** | bereits installiert; keine neuen Pakete |

### F) Tech-Entscheidungen (Begründung)
- **Bestehende Oberfläche maximal wiederverwenden:** Die 7 Reiter sind bereits gebaut und QA-getestet (PROJ-59). Indem wir nur die Datenquelle (Produkte) und die Speicher-Endpunkte (versionsbewusst) austauschen, erhalten wir „dasselbe Erlebnis" ohne Doppelarbeit und ohne Regressionsrisiko für die Kurzfristig-Seite.
- **MOQ ohne SKU-Ebene:** Die Versions-Produkte haben keine SKUs (PROJ-74). Den toten SKU-Pfad wegzulassen ist ehrlicher und einfacher als ihn mit einem „Keine SKUs"-Hinweis zu zeigen (vom Nutzer am 2026-06-20 bestätigt).
- **Globale Werte pro Version:** Container-Volumina und globale Kosten gehören in der Langfristigen Planung zum Szenario. Versionsweise Ablage hält die strikte Isolation konsistent durch (vom Nutzer am 2026-06-20 bestätigt).
- **Hersteller-Liste pro Version:** vollständige Abkapselung, anfangs leer — konsistent mit allen anderen Versions-Stammdaten (vom Nutzer am 2026-06-20 bestätigt). Bequemlichkeit (versionsübergreifend) wurde zugunsten klarer Trennung verworfen.
- **Eigene versionsgebundene Datenablage statt Erweiterung der Kurzfristig-Tabellen:** erfüllt die in PROJ-73 festgelegte vollständige Trennung zwischen Kurzfristiger und Langfristiger Planung; keine Vermischung von Daten.
- **Zugriffsschutz doppelt** (Versionseigentum serverseitig geprüft + nutzergebundene Zeilen mit Row Level Security): identisch zum bewährten Muster aus PROJ-74.

### G) Abhängigkeiten (Pakete)
- **Keine neuen npm-Pakete.** Wiederverwendet werden: die bestehende Produktinformationen-Oberfläche (PROJ-59), das Versions-Gerüst und die Versions-Navigationskonfiguration (PROJ-73), die Versions-KPI-Kategorien-Endpunkte (PROJ-74), shadcn/ui (Tabs, Table, Input, Card, Command, Popover, Toast), Zod (Validierung) und Supabase (Datenhaltung inkl. Row Level Security).

### H) Umsetzungsreihenfolge (empfohlen)
1. **Datenablage + versionsbewusste Endpunkte** je Reiter-Thema anlegen (nutzer- & versionsgesichert, ohne SKU-MOQ, globale Werte je Version) — der eigentliche Aufwand.
2. **Versionsbewusste Reiter-Hooks** (analog zu den PROJ-59-Hooks, aber jeder Aufruf trägt die `versionId`).
3. **Neue Seite** unter `…/[versionId]/produktinformationen` ins Versions-Gerüst einbetten; die 7 Reiter wiederverwenden, Produktliste aus den Versions-Produkten speisen, MOQ-Reiter auf reine Produktebene reduzieren, Empty-State-Link auf die Versions-KPI-Modell-Seite zeigen.
4. **Kachel-Verdrahtung** auf der Versions-Übersicht prüfen (Slug existiert bereits; ggf. nur sicherstellen, dass die Kachel verlinkt).

> Schwerpunkt liegt in Schritt 1–2 (Datenhaltung/Endpunkte). Schritt 3–4 sind überwiegend Verdrahtung, da Oberfläche und Gerüst bereits existieren.

## Implementation Notes

### Frontend (max. Wiederverwendung der PROJ-59-Reiter), 2026-06-20
Die Seite ist gebaut und verdrahtet; die versionsgebundene API folgt mit `/backend`. Bis dahin zeigt jeder Reiter sauber den Lade-Fehlerzustand (die Versions-Endpunkte existieren noch nicht) — kein Absturz; das Versions-Gerüst (PROJ-73) lädt korrekt.

**Leitidee der Umsetzung:** Die bestehende, QA-getestete Kurzfristig-Oberfläche (`produktinformationen-tabs.tsx`, PROJ-59) wurde **parametrisierbar** gemacht statt dupliziert. Alle Änderungen sind **additiv und verhaltenswahrend**: ohne `versionId` verhält sich alles exakt wie zuvor (Kurzfristig-Seite unverändert).

**Neue Dateien:**
- `src/lib/produktinformationen-api.ts` — Helfer `produktinformationenBasis(versionId?)`: ohne `versionId` → `/api/produktinformationen` (global), mit → `/api/langfristige-planung/[versionId]/produktinformationen` (versionsgebunden).
- `src/app/dashboard/langfristige-planung/[versionId]/produktinformationen/page.tsx` — neue Seite, eingebettet ins `LangfristigeVersionShell`, rendert `LangfristigeProduktinformationenTabs`.

**Geänderte Dateien:**
- `src/hooks/use-produktinformationen-*.ts` (alle 7) — jeweils optionaler `versionId`-Parameter; alle Fetch-Pfade laufen über `produktinformationenBasis(versionId)`; `versionId` in den `useEffect`-/`useCallback`-Deps. `useProduktinformationenMoq(versionId?, withSku=true)` zusätzlich: `withSku=false` überspringt den SKU-Abruf (Langfristig kennt keine SKUs → kein `moq-sku`-Endpunkt nötig).
- `src/components/produktinformationen-tabs.tsx` — in drei Teile gegliedert:
  - `ProduktinformationenTabsInner` (präsentational): rendert die 7 Reiter, reicht `versionId`/`kpiHref`/`simpleMoq` durch.
  - `ProduktinformationenTabs` (Export, global/Kurzfristig): unverändertes Verhalten; lädt Produkte aus dem globalen KPI-Modell (`useKpiCategories('produkte')`), `kpiHref=/dashboard/kpi-modell`.
  - `LangfristigeProduktinformationenTabs({ versionId })` (Export, neu): lädt Produkte der Version via `useLangfristigeKpiKategorien(versionId, 'lp_produkt')` (flach, keine SKUs), `kpiHref` → KPI-Modell-Verwaltung der Version, `simpleMoq` aktiv.
  - `EmptyHinweis` nimmt jetzt `kpiHref` (Empty-State-Link zeigt im Langfristig-Modus auf die KPI-Modell-Verwaltung der Version).
  - **MOQ-Reiter vereinfacht** (`simple`-Modus, neue `MoqSimpleZeile`): nur Spalten **Produkt** + **MOQ**, keine Ebene-Auswahl, keine SKU-Zeilen.
  - Globale Reiter (Container/Produktkosten) speichern im Langfristig-Modus automatisch pro Version (über den versionsgebundenen Basis-Pfad).

**Navigation/Kachel:** Keine Änderung nötig — Slug `produktinformationen` existiert bereits in `src/lib/langfristige-planung-nav.ts` (PROJ-73). NavSheet und Versions-Übersichtskachel rendern generisch und verlinken automatisch.

**Qualität:** `tsc --noEmit` ohne neue Fehler (verbleibende Fehler nur in vorbestehenden Testdateien anderer Features); `next lint` sauber für die geänderten/neuen Dateien; `next build` erfolgreich — Route `/dashboard/langfristige-planung/[versionId]/produktinformationen` in der Build-Ausgabe.

**Erwartete API (für `/backend`)** — versions- & nutzergesichert, fremde/unbekannte `versionId` → kein Zugriff. Alle unter `/api/langfristige-planung/[versionId]/produktinformationen/`, Datensätze zusätzlich mit `plan_version_id`-Filter; Produktbezug via `produkt_id` → `langfristige_kpi_kategorien` (`art='lp_produkt'`):
- `hersteller` (GET/POST), `hersteller/[id]` (PATCH/DELETE) — Hersteller-Stammliste **pro Version**
- `hersteller-zuordnung` (GET/PUT)
- `moq` (GET/PUT) — Body `{ produkt_id, ebene:'produkt', moq }`; **kein** `moq-sku`-Endpunkt (Frontend ruft ihn nicht)
- `container-global` (GET/PUT) — 1 Eintrag **pro Version** (`UNIQUE(plan_version_id)`)
- `containerkapazitaet` (GET/PUT)
- `lieferzeit` (GET/PUT)
- `zahlungskonditionen` (GET/PUT) — Summen-Regel = 100 % wie PROJ-59
- `kosten-global` (GET/PUT) — 1 Eintrag **pro Version** (`UNIQUE(plan_version_id)`)
- `produktkosten` (GET/PUT)
- `bestandsverwaltung` (GET/PUT)

Feld-Schema je Tabelle = wie PROJ-59 (`src/app/api/produktinformationen/*`), zusätzlich `plan_version_id` (FK → `langfristige_planversionen` `ON DELETE CASCADE`); produktbezogene Tabellen `produkt_id` (FK → `langfristige_kpi_kategorien` `ON DELETE CASCADE`); MOQ-Tabelle ohne SKU-Tabelle/`ebene`-Logik; globale Tabellen `UNIQUE(plan_version_id)` statt `UNIQUE(user_id)`. RLS `auth.uid()=user_id`.

### Backend (Tabellen + versionsgebundene API), 2026-06-20
Datenhaltung und API sind implementiert; das Frontend ruft exakt diese Endpunkte (im Frontend-Schritt verdrahtet) — keine weiteren Frontend-Änderungen nötig.

**Datenbank (Supabase-Projekt „Controlling-App", Migration `create_langfristige_produktinformationen`):**
10 neue Tabellen mit Präfix `langfristige_produktinformationen_*` (spiegeln die PROJ-59-Tabellen):
- `…_hersteller` — Hersteller-Stammliste **pro Version**, `UNIQUE(plan_version_id, name)`, `name` CHECK 1–100 Zeichen (getrimmt)
- `…_hersteller_zuordnung` — Produkt→Hersteller, `hersteller_id` FK → `…_hersteller` `ON DELETE SET NULL`, `UNIQUE(plan_version_id, produkt_id)`
- `…_moq` — MOQ je Produkt (`ebene` immer `'produkt'`, `moq` CHECK ≥ 1), **keine** SKU-Tabelle, `UNIQUE(plan_version_id, produkt_id)`
- `…_container_global` — Container-Volumina, `UNIQUE(plan_version_id)`
- `…_containerkapazitaet` — Paketmaße je Produkt, `UNIQUE(plan_version_id, produkt_id)`
- `…_lieferzeit` — 5 Zeitfelder je Produkt, `UNIQUE(plan_version_id, produkt_id)`
- `…_zahlungskonditionen` — 3 %- + 3 ZZ-Felder je Produkt, `UNIQUE(plan_version_id, produkt_id)`
- `…_kosten_global` — globale Kosten, `UNIQUE(plan_version_id)`
- `…_produktkosten` — Warenkosten/Zollsatz je Produkt, `UNIQUE(plan_version_id, produkt_id)`
- `…_bestandsverwaltung` — Sicherheitsbestand/Zielreichweite je Produkt, `UNIQUE(plan_version_id, produkt_id)`

Alle Tabellen: `user_id` → `auth.users` (`ON DELETE CASCADE`), `plan_version_id` → `langfristige_planversionen` (`ON DELETE CASCADE` → kaskadierende Löschung pro Planversion); produktbezogene Tabellen `produkt_id` → `langfristige_kpi_kategorien` (`ON DELETE CASCADE` → Zeile verschwindet, wenn Produkt im Versions-KPI-Modell gelöscht wird). CHECK-Constraints für Wertebereiche (≥ 0, %-Felder 0–100). RLS aktiviert, je Tabelle eine `FOR ALL`-Policy `auth.uid() = user_id` (zweite Verteidigungslinie zur serverseitigen Versionsprüfung). Indizes auf `(plan_version_id)`, `(produkt_id)`, `(user_id)`. `get_advisors` (security): **keine** neue Warnung für die 10 Tabellen.

**API-Routen (versions- & nutzergesichert):** 11 Routen unter `src/app/api/langfristige-planung/[versionId]/produktinformationen/`:
- `hersteller/route.ts` (GET/POST, 409 bei Duplikat), `hersteller/[id]/route.ts` (PATCH/DELETE, 404 wenn fremd/unbekannt)
- `hersteller-zuordnung`, `moq`, `containerkapazitaet`, `lieferzeit`, `zahlungskonditionen`, `produktkosten`, `bestandsverwaltung` (je GET/PUT-Upsert, `onConflict: plan_version_id,produkt_id`)
- `container-global`, `kosten-global` (GET/PUT-Upsert, `onConflict: plan_version_id`)
- `zahlungskonditionen` zusätzlich: serverseitige Summen-Prüfung (alle drei %-Werte gesetzt → Summe = 100, sonst 400) — Defense-in-Depth zur Frontend-Validierung.

Muster je Route: `requireAuth` (401) → neuer gemeinsamer Helfer `ensureLangfristigeVersion` (`src/lib/langfristige-version.ts`: 400 bei ungültiger UUID, 404 bei fremder/unbekannter `versionId`) → Queries zusätzlich nach `user_id` **und** `plan_version_id` gefiltert → Zod-Validierung → Upsert. Fehler als `{ error }`.

**Tests:** 11 neue Testdateien (`…/produktinformationen/**/route.test.ts`) — **61/61 grün** (Happy Path GET/POST/PUT/PATCH/DELETE, 400 ungültige Eingabe/UUID, 401 unauth, 404 fremde Version, 409 Duplikat, 400 Zahlungskonditionen-Summe ≠ 100). Gesamte Produktinformationen- + Langfristig-Suite (global PROJ-59 + PROJ-74 + neu): **261/261 grün** → keine Regression. `tsc --noEmit` ohne neue Fehler; `next build` erfolgreich (alle 11 Endpunkte registriert).

## QA Test Results

**Getestet:** 2026-06-20 · **Methode:** Code-Audit aller Akzeptanzkriterien + Vitest (API/Logik) + Playwright (Route/Auth/Regression) + DB-Introspektion (FK-Cascade, RLS, UNIQUE). Interaktionen (Auto-Save je Tab, Versionsisolation, Cascade-Löschung) sind code-/DB-geprüft — analog zum Vorgehen bei PROJ-74/75 (versionsgebundene Seiten ohne automatisierte Login-Session in E2E).

### Akzeptanzkriterien — bestanden

| Bereich | Ergebnis | Beleg |
|---------|----------|-------|
| Route nur im Versionskontext, in `LangfristigeVersionShell` eingebettet, Redirect bei fremder/unbekannter Version | ✅ | `page.tsx` in Shell; `ensureLangfristigeVersion` → 404; E2E Auth-Redirect |
| Nav-Eintrag „Produktinformationen" (Gruppe Einstellungen) + Versions-Übersichtskachel | ✅ | Slug in `langfristige-planung-nav.ts` (PROJ-73); generisches Rendering |
| 7 Reiter, erster (Hersteller) aktiv | ✅ | `ProduktinformationenTabsInner` `defaultValue="hersteller"` |
| Produktquelle = Versions-Produkte (`art='lp_produkt'`, level 1), keine globalen/fremden | ✅ | `LangfristigeProduktinformationenTabs` via `useLangfristigeKpiKategorien(versionId,'lp_produkt')` |
| Empty-State-Link → KPI-Modell-Verwaltung **dieser Version** | ✅ | `kpiHref` = `…/[versionId]/kpi-modell-verwaltung` |
| Tab MOQ: nur Produktebene, keine Ebene-Auswahl/SKU-Zeilen | ✅ | `simpleMoq` → `MoqSimpleZeile` (Spalten Produkt + MOQ) |
| Tabs Hersteller/Container/Lieferzeit/Zahlungskonditionen/Produktkosten/Bestand: 1:1 PROJ-59 | ✅ | wiederverwendete Reiter, `versionId` durchgereicht |
| Globale Werte (Container-Volumen, globale Kosten) **pro Version** | ✅ | Tabellen `UNIQUE(plan_version_id)`; Upsert `onConflict: plan_version_id` |
| Auto-Save, optimistisches Update + Rollback bei Fehler | ✅ | wiederverwendete PROJ-59-Hooks (versionsbewusst) |
| Versionsisolation: laden/speichern je `versionId`+Nutzer; neue Version leer; A≠B | ✅ | API-Filter `user_id`+`plan_version_id`; keine Seeding-Logik |
| Cascade-Löschung beim Löschen der Planversion / des Produkts | ✅ | FK `ON DELETE CASCADE` (DB-Introspektion bestätigt) |

### Automatisierte Tests
- **Vitest (PROJ-77 API):** 11 Routen-Testdateien — **61/61 grün** (GET/POST/PUT/PATCH/DELETE, 400 Eingabe/UUID, 401 unauth, 404 fremde Version, 409 Duplikat, 400 Zahlungskonditionen-Summe ≠ 100).
- **Vitest (Regression Produktinformationen global + Langfristig + KPI):** **261/261 grün** → Parametrisierung (optionaler `versionId`) hat die Kurzfristig-Routen/-Hooks nicht beschädigt.
- **Playwright (`PROJ-77-…spec.ts`):** **8/8 grün** (chromium + Mobile Safari) — Route ohne 404, Auth-Redirect, Dashboard-Redirect, globale Kurzfristig-Produktinformationen weiterhin erreichbar.
- `tsc --noEmit` ohne neue Fehler; `next build` erfolgreich (alle 11 Endpunkte + Seite registriert).

### Security-Audit (Red Team) — keine Befunde
- **AuthN/AuthZ:** Jede der 11 Routen `requireAuth` (401) + `ensureLangfristigeVersion` (400 ungültige UUID, 404 fremde/unbekannte `versionId`) + Query-Filter nach `user_id` **und** `plan_version_id`. RLS auf allen 10 Tabellen mit `USING/WITH CHECK = (auth.uid() = user_id)` (per DB-Introspektion verifiziert — **kein** permissives `true`). Kein Cross-User-/Cross-Version-Zugriff möglich.
- **Eingabevalidierung:** Zod auf allen PUT/POST (UUIDs, Wertebereiche, %-Felder 0–100, Tage/MOQ ≥ 0/1); Zahlungskonditionen-Summe = 100 serverseitig erzwungen; DB-CHECK-Constraints als zweite Linie.
- **XSS/Injection:** Namen werden als Text gerendert (React-Escaping, kein `dangerouslySetInnerHTML`); Supabase nutzt parametrisierte Queries.
- **Advisors:** `get_advisors` (security) meldet **keine** neue Warnung für die 10 neuen Tabellen.

### Bugs
Keine Critical/High/Medium gefunden.

**Low / Beobachtungen (kein Blocker):**
- **L1 (Defense-in-Depth, konsistent mit PROJ-59):** Die produktbezogenen Routen prüfen nicht zusätzlich, dass `produkt_id` zur selben Planversion gehört (sie verlassen sich auf FK → `langfristige_kpi_kategorien` + RLS auf `user_id`). Kein Cross-User-Risiko (RLS); das Frontend sendet ausschließlich Produkte der aktuellen Version. Worst Case: ein Nutzer könnte per direktem API-Aufruf einen eigenen Produkt-`id` aus einer anderen eigenen Version referenzieren → harmlose, nicht angezeigte Waisenzeile. Identisches Verhalten wie die Kurzfristig-Routen (PROJ-59).
- **L2 (kosmetisch, geerbt von PROJ-59):** Auf Mobil (375px) kann die 7-Reiter-Leiste in zwei Reihen umbrechen — funktional, kein Overflow.

### Hinweis zur Gesamt-Testsuite
Ein vollständiger `vitest run` zeigt Fehlschläge in **unbeteiligten** Dateien anderer, laufender Features (z. B. marketing-einstellungen, einnahmen-planung, bestellplanung) — bereits vor dieser Session unkommittiert im Arbeitsbaum, importieren **keine** PROJ-77-Dateien und liegen außerhalb dieses QA-Scopes. Der PROJ-77-Scope (61 API-Tests + 8 E2E + 261 Regression im Produktinformationen-/Langfristig-Bereich) ist vollständig grün.

### Production-Ready: **JA**
Keine Critical/High-Bugs. PROJ-77 ist freigegeben.

## Deployment
_To be added by /deploy_
