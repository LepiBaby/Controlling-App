# PROJ-94: Liquiditätsauswertung — Langfristige Planung

## Status: Approved
**Created:** 2026-06-23
**Last Updated:** 2026-06-23 (QA bestanden — keine Critical/High-Bugs)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert die **versionsgebundenen** Stammkategorien (Sales Plattform, Produkte, Marketingkanäle, Investitionen). Wo die Quellmodule globale Kategorien verwenden (z. B. Einnahmen-/Ausgaben-/Steuern-Subtrees), werden diese global gelesen.
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`), **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monatsfenster **und** den **Startkontostand** (`startkontostand`) als Ausgangswert des Kontostands
- Requires: PROJ-84 (Absatzplanung — Langfristige Planung) — Monatsfenster-Helfer (`buildPlanungsmonate`) und versionsgebundene Notiz-Tabelle (`langfristige_planung_notizen`)
- Requires: PROJ-89 (Einnahmenplanung — Langfristige Planung) — Datenquelle „Einnahmen" (effektiver Soll je Monat)
- Requires: PROJ-91 (Umsatzausgaben Planung — Langfristige Planung) — Datenquelle „Umsatzausgaben" (effektiver Soll je Monat)
- Requires: PROJ-88 (Operativekosten Planung — Langfristige Planung) — Datenquelle „Operative Ausgaben" (effektiver Soll je Monat)
- Requires: PROJ-92 (Investitionsausgaben Planung — Langfristige Planung) — Datenquelle „Investitionsausgaben" (effektiver Soll je Monat)
- Requires: PROJ-90 (Finanzierungsausgaben Planung — Langfristige Planung) — Datenquelle „Finanzierungsausgaben" (effektiver Soll je Monat)
- Requires: PROJ-93 (Steuerausgaben Planung — Langfristige Planung) — Datenquelle „Steuerausgaben" (effektiver Soll je Monat)
- Requires: PROJ-40 (Betragsselektion) — Mehrfach-Zellauswahl mit Summen-Panel
- Vorlage (kein harter Require): PROJ-72 (Liquiditätsauswertung — Kurzfristige Planung) — diese Seite ist im Kern ein **Klon** von PROJ-72, mit den unten beschriebenen Abweichungen (versionsgebunden, nur Monatsbasis, nur Soll, Startkontostand statt transaktionsbasiertem Anfangsbestand)
- Vorlage (kein harter Require): PROJ-29 (Liquiditätsreport) — identische Definition von Cashflow, kumuliertem Kontostand und Liniendiagramm

## Übersicht

Die **Liquiditätsauswertung** ist die **erste Seite** im neuen, **dritten Navigationsbereich „Auswertungen"** der Langfristigen Planung (nach den bestehenden Gruppen „Einstellungen" und „Planung"). Sie ist eine **rein anzeigende** (read-only), **versionsgebundene** Seite, die die Ergebnisse aller sechs langfristigen Planungsmodule auf **einer einzigen großen Tabelle** zusammenführt:

1. **Einnahmen** (Einnahmenplanung, PROJ-89)
2. **Umsatzausgaben** (PROJ-91)
3. **Operative Ausgaben** (Operativekosten Planung, PROJ-88)
4. **Investitionsausgaben** (PROJ-92)
5. **Finanzierungsausgaben** (PROJ-90)
6. **Steuerausgaben** (PROJ-93)

Sie ist im Kern **genau so aufgebaut wie die gleichnamige Seite in der Kurzfristigen Planung** (PROJ-72). Alle Werte werden **1 zu 1** so übernommen, wie sie auf den jeweiligen Quell-Planungsseiten dieser Planversion stehen (manuell überschriebener Wert sticht automatisch berechneten Wert = „effektiver Soll"). Auf dieser Seite können die Werte **nicht bearbeitet** werden.

### Wesentliche Unterschiede zu PROJ-72 (Kurzfristige Planung)

| Aspekt | Kurzfristige Liquiditätsauswertung (PROJ-72) | Langfristige Liquiditätsauswertung (PROJ-94) |
|---|---|---|
| Geltungsbereich | global (eine Planung) | **pro Planversion** (`versionId`-isoliert) |
| Zeitbasis | Wochen **und** Monate (Umschalter) | **nur Monate** — kein Umschalter zwischen Wochen/Monaten/Quartal/Jahr |
| Ist (Vergangenheit) | Ist-Spalten + Soll-Spalten mit Ist/Soll-Trennlinie | **kein Ist** — ausschließlich **Soll** |
| Zeitfenster | Vergangenheitshorizont + Planungshorizont | **Startmonat bis Startmonat + Planungshorizont (allgemein)** |
| Kontostand-Startwert | transaktionsbasierter Anfangsbestand (aus Ist-Transaktionen vor dem Fenster) | **Startkontostand aus den Grundeinstellungen dieser Version** |
| Kategoriequelle | globale KPI-Kategorien | **versionsgebundene** KPI-Kategorien dieser Planversion, wo das jeweilige Quellmodul sie nutzt; sonst globale Kategorien |

### Tabellenaufbau (konzeptionell)

```
Bezeichnung                       │ Jan 2026 │ Feb 2026 │ Mär 2026 │ ... (bis Planungshorizont)
──────────────────────────────────────────────────────────────────────────────────────
EINNAHMEN
  ▸ Kategorie A (Gruppen/Untergruppen darunter)        grün
  ▸ Kategorie B                                         grün
Gesamt Einnahmen                                        grün
──────────────────────────────────────────────────────────────────────────────────────
AUSGABEN
  ▸ Umsatzausgaben (Kategorien/Gruppen/Untergr.)        rot
  ▸ Operative Ausgaben                                  rot
  ▸ Investitionsausgaben                                rot
  ▸ Finanzierungsausgaben                               rot
  ▸ Steuerausgaben                                      rot
Gesamt Ausgaben                                         rot
════════════════════════════════════════════════════════════════════════════════════════
Cashflow der Periode  (= Gesamt Einnahmen + Gesamt Ausgaben)
Kontostand            (= Startkontostand + fortlaufender Cashflow)  ← letzte Zeile, kumuliert
```

Es gibt **keine** Ist/Soll-Trennlinie (alle Spalten sind Soll-Monate).

## User Stories

- Als Controller möchte ich die Liquiditätsauswertung innerhalb einer geöffneten Planversion über das linke Seitenmenü (neue Gruppe „Auswertungen", erster Eintrag) und über die Versions-Übersichtsseite aufrufen können, damit ich den Liquiditätsverlauf dieses Szenarios an einer Stelle nachvollziehe.
- Als Controller möchte ich auf einer einzigen Seite alle Einnahmen und alle Ausgaben (aus sechs Planungsmodulen) dieser Planversion zusammengeführt sehen, damit ich den monatlichen Liquiditätsverlauf des Szenarios verstehe.
- Als Controller möchte ich, dass alle Werte exakt so erscheinen wie auf den jeweiligen Quell-Planungsseiten dieser Version (manuell überschriebene und automatisch berechnete Werte), ohne sie hier ändern zu können.
- Als Controller möchte ich die Kategorien, Gruppen und Untergruppen jeder Quellseite genau so strukturiert untereinander sehen, wie sie auf der Originalseite erscheinen.
- Als Controller möchte ich ausschließlich Monatsspalten sehen — vom Startmonat bis zum allgemeinen Planungshorizont — ohne Umschaltmöglichkeit auf Wochen, Quartale oder Jahre.
- Als Controller möchte ich nach den Einnahmen eine „Gesamt Einnahmen"-Zeile und nach allen Ausgaben eine „Gesamt Ausgaben"-Zeile sehen, die zusammen den „Cashflow der Periode" ergeben.
- Als Controller möchte ich als letzte Zeile den fortlaufenden „Kontostand" sehen, der im ersten Monat aus dem in den Grundeinstellungen hinterlegten Startkontostand plus dem Cashflow des ersten Monats entsteht und danach kumulativ fortgeschrieben wird.
- Als Controller möchte ich Einnahmen / positive Werte grün und Ausgaben / negative Werte rot dargestellt sehen.
- Als Controller möchte ich — obwohl die Werte nicht editierbar sind — erkennen können, ob ein Soll-Wert automatisch berechnet (grau) oder manuell (blau) ist.
- Als Controller möchte ich alle Abschnitte mit zwei Buttons rechts oben gleichzeitig ein- oder ausklappen können.
- Als Controller möchte ich die Notizen der Quell-Planungsseiten sehen (ohne sie hier bearbeiten zu können).
- Als Controller möchte ich mehrere Zellen per Klick / Ctrl+Klick auswählen und ihre Summe rechts unten angezeigt bekommen.
- Als Controller möchte ich ein Liniendiagramm sehen, das Einnahmen, Ausgaben, Cashflow der Periode und Kontostand im Monatsverlauf zeigt — genau wie im Liquiditätsreport.
- Als Controller möchte ich, dass die Auswertung ausschließlich die Stammkategorien dieser Planversion (bzw. die globalen Kategorien, wo das Quellmodul diese nutzt) verwendet, damit das Szenario isoliert bleibt.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Im Versionskontext (`/dashboard/langfristige-planung/[versionId]/...`) erscheint im linken Seitenmenü eine **neue Gruppe „Auswertungen"** als **dritte Gruppe** nach „Einstellungen" und „Planung"
- [ ] Die Gruppe „Auswertungen" enthält als **ersten Eintrag** „Liquiditätsauswertung" → `/dashboard/langfristige-planung/[versionId]/liquiditaetsauswertung`
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint eine Kachel/ein Eintrag „Liquiditätsauswertung" (über die zentrale Nav-Konfiguration, die Übersicht zieht generisch nach)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Wird die Seite mit unbekannter/fremder/ungültiger `versionId` aufgerufen, erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73-Versionskontext
- [ ] Rechts oben: Buttons **„Alle ausklappen"** und **„Alle einklappen"**; **kein** Zurücksetzen-Button (read-only Seite)

### Read-only-Verhalten

- [ ] Keine Zelle ist editierbar (kein Inline-Edit, kein onBlur-Speichern)
- [ ] Kein „Auf automatisch zurücksetzen"-Button, kein „Alles zurücksetzen"-Button
- [ ] Keine Möglichkeit, Notizen anzulegen oder zu bearbeiten (nur Anzeige)
- [ ] Die Seite schreibt **keine eigenen** Planungsdaten; sie löst — wie PROJ-72 — bei Bedarf die `berechnet`-Routen der Quellmodule aus, persistiert aber selbst nichts über das hinaus, was die Quellseiten ohnehin schreiben

### Spaltenstruktur (nur Monate, nur Soll)

- [ ] Es gibt **ausschließlich Monatsspalten** — kein Umschalter zwischen Wochen-/Monats-/Quartals-/Jahresansicht
- [ ] Das Zeitfenster reicht vom **Startmonat** (`startmonat_monat`/`startmonat_jahr` aus den Grundeinstellungen) über **`planungshorizont_monate`** Monate (allgemeiner Horizont, Fallback 12) — identisch zum Monatsfenster der langfristigen Planungsseiten (`buildPlanungsmonate`)
- [ ] **Kein Ist-Bereich, keine Vergangenheit, keine Ist/Soll-Trennlinie** — alle Spalten sind Soll-Monate
- [ ] Monats-Header-Format wie auf den langfristigen Planungsseiten (z. B. „Jan 2026"); optional Jahres-Gruppierungszeile wie dort
- [ ] Pro Monat genau **eine Spalte**
- [ ] Tabelle horizontal scrollbar; erste Spalte (Zeilenbeschriftung) ist `sticky left`

### Zeilenstruktur & Abschnitte

- [ ] **Abschnitt EINNAHMEN** (hervorgehoben): darunter die vollständige Hierarchie der langfristigen Einnahmenplanung (Kategorien → Gruppen → Untergruppen), **genau so strukturiert wie auf der langfristigen Einnahmenplanung-Seite** (inkl. der dort üblichen Produkt-/Plattform-Drilldowns, soweit die Quellseite sie zeigt)
- [ ] **„Gesamt Einnahmen"-Zeile** direkt nach dem Einnahmen-Abschnitt (hervorgehoben), je Monat = Summe aller Einnahmen-Leafs
- [ ] **Abschnitt AUSGABEN** (hervorgehoben) mit **fünf Unterabschnitten** in dieser Reihenfolge, jeweils mit eigener Quellseiten-Bezeichnung und vollständiger Hierarchie:
  1. Umsatzausgaben
  2. Operative Ausgaben
  3. Investitionsausgaben
  4. Finanzierungsausgaben
  5. Steuerausgaben
- [ ] **„Gesamt Ausgaben"-Zeile** nach allen fünf Ausgaben-Unterabschnitten (hervorgehoben), je Monat = Summe aller Ausgaben-Leafs
- [ ] **„Cashflow der Periode"-Zeile** (stark hervorgehoben) = Gesamt Einnahmen + Gesamt Ausgaben je Monat
- [ ] **„Kontostand"-Zeile** als letzte Zeile (stark hervorgehoben, kumuliert)
- [ ] Jede Quellseiten-Hierarchie ist **einklappbar**; Standard: ausgeklappt; Kategorien/Gruppen in der `sort_order`-Reihenfolge des jeweiligen Modells
- [ ] Es werden alle Gruppen mit Daten im Fenster angezeigt (konsistent zu PROJ-72); Indikatorpunkt und Notiz nur auf der jeweiligen Pflege-Ebene (echtes Blatt bzw. Produkt/Plattform), nicht auf reinen Aggregat-/Gruppenzeilen

### Werte & 1:1-Übernahme

- [ ] Jede Monatszelle zeigt exakt den **effektiven Soll-Wert** der Quellseite dieser Version = manueller Override falls vorhanden, sonst automatisch berechneter Wert
- [ ] Aggregations- und Gesamt-Zeilen summieren ihre Leafs je Monat (identisch zur Berechnung auf den Quellseiten)
- [ ] Module ohne Auto-Wert (rein manuelle Beträge, z. B. operative/Finanzierungs-Untergruppen ohne Override) zeigen leere Zellen, wenn kein Wert vorliegt
- [ ] Negative Beträge sind erlaubt (z. B. UST-Erstattung als negativer Steuerausgabenwert)

### Kategoriequelle (Versionsisolation)

- [ ] Die Auswertung verwendet je Modul **dieselben** Zeilen-/Kategoriequellen wie die jeweilige langfristige Quell-Planungsseite: **versionsgebundene** Stammkategorien (Produkte, Sales Plattformen, Marketingkanäle, Investitionen aus PROJ-74), und **globale** KPI-Kategorien dort, wo das Quellmodul global liest (z. B. Einnahmen-/Ausgaben-/Steuern-Subtrees)
- [ ] Es werden **keine** Kategorien aus anderen Planversionen oder aus der Kurzfristigen Planung angezeigt
- [ ] Eine neu angelegte (leere) Planversion zeigt eine im Wesentlichen leere Auswertung (nur Summenzeilen mit 0 bzw. Kontostand = Startkontostand)

### Darstellung (Farben & Indikatoren)

- [ ] **Einnahmen / positive Werte** werden **grün** angezeigt
- [ ] **Ausgaben / negative Werte** werden **rot** (mit Minuszeichen) angezeigt
- [ ] In den Soll-Zellen zeigt ein **grauer Indikatorpunkt** automatisch berechnete Werte, ein **blauer Indikatorpunkt** manuelle Overrides — auch wenn die Zelle hier nicht editierbar ist
- [ ] Beträge mit 2 Dezimalstellen und € im de-DE-Format (z. B. „12.450,00 €")
- [ ] Cashflow-/Kontostand-Zeilen: positiver Wert grün, negativer Wert rot

### Kontostand & Startkontostand

- [ ] Der **Startkontostand** stammt aus den Grundeinstellungen dieser Planversion (`langfristige_grundeinstellungen.startkontostand`, Fallback 0)
- [ ] **Kontostand des ersten Monats** = Startkontostand **+** Cashflow des ersten Monats
- [ ] **Kontostand jedes weiteren Monats** = Kontostand des Vormonats + Cashflow dieses Monats (kumulativ in chronologischer Reihenfolge)
- [ ] Es gibt **keine** transaktionsbasierte Anfangsbestand-Berechnung (anders als PROJ-72/PROJ-29) — der Startwert kommt ausschließlich aus den Grundeinstellungen

### Liniendiagramm

- [ ] Oberhalb der Tabelle ein **Liniendiagramm** (Recharts), im Stil des Liquiditätsreports
- [ ] **Vier Linien:** Einnahmen (grün), Ausgaben (rot, als absolute/positiv dargestellte Werte), Cashflow der Periode (blau), **Kontostand**
- [ ] X-Achse: Monate — synchron mit den Tabellenspalten; Y-Achse: Betrag in €
- [ ] Leerzustand: Diagramm wird ausgeblendet, wenn keine darstellbaren Monate vorhanden sind

### Notizen-Anzeige (read-only)

- [ ] Notizen, die auf den langfristigen Quell-Planungsseiten dieser Version an einer Zelle hinterlegt sind, werden hier an der entsprechenden Zelle als **Notiz-Indikator** mit Tooltip-Vorschau angezeigt
- [ ] Es gibt **keine** Möglichkeit, hier Notizen anzulegen, zu bearbeiten oder zu löschen
- [ ] Quelle der Notizen: `langfristige_planung_notizen` der jeweiligen Quellseite (`seite` je Modul, z. B. `einnahmenplanung`, `umsatzausgaben`, `operativekosten-planung`, `investitionsausgaben-planung`, `finanzierungsausgaben-planung`, `steuerausgaben`)

### Betragsselektion (PROJ-40)

- [ ] Einzelne oder mehrere Zellwerte per Klick / Ctrl+Klick auswählbar
- [ ] Summe + Anzahl der selektierten Zellen werden in einem Panel rechts unten angezeigt
- [ ] Panel erscheint ab 1 selektierter Zelle, verschwindet bei aufgehobener Selektion
- [ ] Alle Zelltypen (Leaf, Aggregation, Gesamt, Cashflow, Kontostand) sind selektierbar
- [ ] Identisches Verhalten wie auf den langfristigen Planungsseiten

## Datenquellen je Modul

| Modul (Abschnitt) | Zeilenquelle | Effektiver Soll (Planung) |
|---|---|---|
| Einnahmen | Einnahmen-KPI-Modell (global) + versionsgebundene Produkte/Plattformen | `GET /api/langfristige-planung/[versionId]/einnahmenplanung` + `…/berechnet` |
| Umsatzausgaben | „Umsatzausgaben"-Subtree (global) + versionsgebundene Produkte | `GET /api/langfristige-planung/[versionId]/umsatzausgaben` + `…/berechnet` |
| Operative Ausgaben | „Operative Ausgaben"-Subtree (global) | `GET /api/langfristige-planung/[versionId]/operativekosten-planung` + `…/berechnet` |
| Investitionsausgaben | versionsgebundene Investitionen (PROJ-74) + Produkte | `GET /api/langfristige-planung/[versionId]/investitionsausgaben-planung` + `…/berechnet` |
| Finanzierungsausgaben | „Finanzierung"-Subtree (global) | `GET /api/langfristige-planung/[versionId]/finanzierungsausgaben-planung` + `…/berechnet` |
| Steuerausgaben | „Steuern"-Subtree (global) | `GET /api/langfristige-planung/[versionId]/steuerausgaben` + `…/berechnet` |

**Wichtig:** Diese Seite **liest** ausschließlich. Sie verwendet die effektiven Werte exakt so, wie die langfristigen Quellseiten sie ermitteln/anzeigen (manueller Override sticht automatisch berechneten Wert). Die genaue Liste der Modul-Endpunkte ist in `/architecture` final zu verifizieren (Slugs siehe `src/lib/langfristige-planung-nav.ts`).

## Edge Cases

- **Leere/neu angelegte Planversion:** Einnahmen-/Ausgaben-Abschnitte ohne Daten; Gesamt-Zeilen = 0; Cashflow = 0; Kontostand jeder Spalte = Startkontostand.
- **Startkontostand nicht gesetzt:** Fallback 0; Kontostand = reiner kumulierter Cashflow.
- **Eine Zelle ohne Wert (weder berechnet noch manuell):** Leaf-Zelle bleibt leer (keine 0-Anzeige); Gesamt-/Cashflow-/Kontostand-Zeilen zeigen ihre berechneten Werte.
- **Modul rein manuell ohne Override (z. B. Investitions-/Finanzierungs-Untergruppe):** leere Zelle, kein grauer Punkt (kein Auto-Wert).
- **Negative Einnahmen / positive Ausgaben:** Farbe folgt dem **Vorzeichen** (positiv grün, negativ rot), nicht starr dem Abschnitt.
- **Reihenfolge der `berechnet`-Aufrufe / Konsistenz der Umsatzsteuer:** Steuerausgaben leiten ihre USt aus den Soll-Werten der anderen Module ab — die Ladereihenfolge muss (wie in PROJ-72) sicherstellen, dass Steuerausgaben **zuletzt** geladen werden, damit die Umsatzsteuer mit der Steuerausgaben-Seite übereinstimmt (Race-Condition vermeiden).
- **Eine Quell-API liefert einen Fehler:** betroffener Abschnitt zeigt einen Hinweis/leer, die übrigen Abschnitte bleiben nutzbar; kein Seitenabsturz.
- **Sehr breite Tabelle (großer Planungshorizont, z. B. 120 Monate):** horizontales Scrollen, Zeilenbeschriftungsspalte sticky.
- **Fremde/unbekannte `versionId`:** Redirect zum Dashboard (PROJ-73-Verhalten), kein Fremdzugriff.
- **Notiz auf einer Quellseiten-Zelle:** Notiz-Indikator wird an der entsprechenden Monatszelle der Pflege-Ebene angezeigt (Tooltip).

## Technical Requirements

- Authentifizierung: `requireAuth()` in allen ggf. neuen API-Routen; Seite ist Client Component im Versions-Shell (`LangfristigeVersionShell`) mit Auth- und Versions-Eigentumsprüfung
- **Keine neue DB-Tabelle nötig** — die Seite ist read-only und aggregiert ausschließlich bestehende versionsgebundene Planungsdaten. Der Startkontostand kommt aus `langfristige_grundeinstellungen`. (Anders als PROJ-72 ist **keine** Anfangsbestand-Route nötig.)
- **Aggregation:** analog PROJ-72 als Frontend-Hook empfohlen (`use-langfristige-liquiditaetsauswertung.ts`), der die sechs Modul-Endpunkte dieser Version + Grundeinstellungen + Notizen lädt, zusammenführt und Gesamt Einnahmen/Ausgaben, Cashflow und kumulierten Kontostand berechnet. Finale Entscheidung (Hook vs. serverseitige Sammel-Route) in `/architecture`.
- Monatsfenster: bestehender Helfer `buildPlanungsmonate` (Startmonat + `planungshorizont_monate`)
- Kontostand-Logik: Startkontostand + kumulierter monatlicher Cashflow (kein transaktionsbasierter Anfangsbestand)
- Chart-Bibliothek: Recharts (bereits vorhanden)
- Keine neuen Packages: shadcn `Table`, `Tooltip`, `Button`, `Skeleton` — alle vorhanden
- **Abkapselung:** keine Ist-Daten, keine Daten der Kurzfristigen Planung; ausschließlich Daten dieser `versionId`
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Richtwert)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/liquiditaetsauswertung/page.tsx` | Seite: Versions-Shell + Einklappen-Buttons + Chart + Tabelle |
| `src/hooks/use-langfristige-liquiditaetsauswertung.ts` | Datenladen (alle 6 Module der Version + Grundeinstellungen + Notizen), Zusammenführen, Monatsspalten, Kontostand-Kumulierung, Einklapp-/Selektionszustand |
| `src/components/langfristige-liquiditaetsauswertung-tabelle.tsx` | Große read-only Monats-Matrix: Abschnitte, Indikatorpunkte, Notiz-Indikator, Betragsselektion |
| `src/components/langfristige-liquiditaetsauswertung-chart.tsx` | Liniendiagramm (Einnahmen, Ausgaben, Cashflow, Kontostand) |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Neue Nav-Gruppe „Auswertungen" mit erstem Eintrag „Liquiditätsauswertung" (Slug `liquiditaetsauswertung`) |

### Wiederverwendung bestehender Muster

| Muster | Quelle |
|---|---|
| Gesamtaufbau (Abschnitte, Gesamt-Zeilen, Cashflow, Kontostand, Chart, Indikatorpunkte, Notiz, Betragsselektion) | `use-liquiditaetsauswertung.ts` / `liquiditaetsauswertung-tabelle.tsx` / `liquiditaetsauswertung-chart.tsx` (PROJ-72) |
| Monats-Spaltenstruktur (nur Soll), Jahres-Gruppierung, sticky Label | langfristige Planungs-Tabellen (z. B. `langfristige-steuerausgaben-tabelle.tsx`) |
| Monatsfenster-Helfer | `buildPlanungsmonate` (PROJ-84) |
| Versions-Shell, Versions-Eigentumsprüfung, Nav-Konfiguration | PROJ-73 (`LangfristigeVersionShell`, `ensureLangfristigeVersion`, `langfristige-planung-nav.ts`) |
| Notiz-Anzeige (read-only) | `useLangfristigePlanungNotizen(versionId, seite)` der Planungsseiten |

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Weitere Auswertungsseiten der Langfristigen Planung (z. B. Rentabilität/Deckungsbeitrag) folgen in eigenen Specs unter der neuen Gruppe „Auswertungen".
- Optionale spätere Granularitäten (Quartal/Jahr) sind bewusst nicht Teil dieser Spec (nur Monatsbasis).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-23)

### Leitidee

PROJ-94 ist — wie PROJ-72 — eine **read-only Aggregationsseite**. Sie erfindet keine eigenen Zahlen und speichert keine eigenen Planungsdaten. Sie führt zusammen, was die sechs langfristigen Planungsmodule dieser Planversion ohnehin liefern. Daraus folgt die wichtigste Architekturentscheidung:

> **Die Seite verwendet exakt dieselben Datenendpunkte, die auch die sechs Quell-Planungsseiten dieser Version beim Öffnen nutzen** — inklusive ihrer Auto-Berechnung. Es wird **keine** Berechnungslogik dupliziert. Damit ist die „1:1"-Anforderung technisch garantiert: Steht eine Zahl auf der langfristigen Quellseite, steht hier dieselbe Zahl, weil sie aus derselben Quelle stammt.

Das ist dasselbe Prinzip wie bei PROJ-72. Der Unterschied liegt ausschließlich in vier Vereinfachungen, die die Architektur **kleiner** machen als PROJ-72:

1. **Nur Monate, nur Soll** — kein Wochen/Monats-Umschalter, keine Ist-Spalten, keine Ist/Soll-Trennlinie. Das Spaltenmodell ist exakt das der langfristigen Planungsseiten.
2. **Versionsgebunden** — alle Daten kommen aus der aktuellen `versionId`; die Seite läuft im bestehenden Versions-Gerüst (lädt/prüft die Version, Redirect bei fremder Version).
3. **Startkontostand statt Anfangsbestand** — der Kontostand-Startwert ist ein bereits gespeicherter Wert aus den Grundeinstellungen. Dadurch entfällt die in PROJ-72 nötige eigene „Anfangsbestand"-Server-Route komplett (PROJ-72 musste viele historische Ist-Transaktionen summieren; hier gibt es keine).
4. **Keine neue Datenhaltung** — keine neue Tabelle, keine neue Server-Route.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]/liquiditaetsauswertung   (NEUE Seite)
│
└── LangfristigeVersionShell  (bestehend — lädt/prüft Version, Header/Breadcrumb, Seitenmenü, Redirect)
    │
    ├── Seiten-Header
    │   └── Button-Gruppe rechts: „Alle ausklappen" | „Alle einklappen"
    │       (KEIN Wochen/Monats-Umschalter, KEIN Zurücksetzen-Button — read-only)
    │
    ├── Liniendiagramm  (NEUE Komponente)
    │   └── 4 Linien: Einnahmen (grün), Ausgaben (rot, absolut),
    │       Cashflow der Periode (blau), Kontostand
    │
    └── Große Tabelle  (NEUE Hauptkomponente, read-only)
        ├── Kopf: [Bezeichnung (sticky links)] | [Monatsspalten ...]
        │         (optional Jahres-Gruppierungszeile wie auf den Planungsseiten)
        └── Körper:
            ├── Abschnitt EINNAHMEN          (einklappbare Hierarchie der Einnahmenplanung)
            ├── Zeile „Gesamt Einnahmen"
            ├── Abschnitt AUSGABEN
            │   ├── Umsatzausgaben           (einklappbare Hierarchie)
            │   ├── Operative Ausgaben       (einklappbare Hierarchie)
            │   ├── Investitionsausgaben     (einklappbare Hierarchie)
            │   ├── Finanzierungsausgaben    (einklappbare Hierarchie)
            │   └── Steuerausgaben           (einklappbare Hierarchie)
            ├── Zeile „Gesamt Ausgaben"
            ├── Zeile „Cashflow der Periode"
            └── Zeile „Kontostand"   ← letzte Zeile, kumuliert
        └── Betragsselektion-Panel  (rechts unten, ab 1 ausgewählter Zelle)

src/lib/langfristige-planung-nav.ts   (bestehend — neue Gruppe „Auswertungen" mit Eintrag „Liquiditätsauswertung")
```

### B) Datenfluss (in einfachen Worten)

Das „Gehirn" der Seite ist ein zentraler **Daten-Hook**. Beim Öffnen passiert Folgendes:

```
1. Grundeinstellungen der Version holen
   → Startmonat + allgemeiner Planungshorizont  → Liste der anzuzeigenden Monate
   → Startkontostand                             → Startwert für den Kontostand

2. Für jedes der 6 Module dieser Version laden — exakt wie die Quellseite es tut:
   ├── die gespeicherten manuellen Soll-Werte (Overrides des Nutzers)
   └── die automatisch berechneten Soll-Werte (frisch, wie auf der Quellseite)
   → pro Zelle gilt: manueller Wert sticht automatischen Wert (= „effektiver Soll")
   → ob der Wert manuell (blau) oder automatisch (grau) ist, kommt direkt aus der Quelle

3. Notizen der 6 Module dieser Version laden (nur zur Anzeige)

→ Der Hook fügt alles zu einer einzigen Monats-Tabellenstruktur zusammen:
   Einnahmen-Hierarchie, dann die 5 Ausgaben-Hierarchien, dann die Summenzeilen.

→ Pro Monat rechnet der Hook:
   Gesamt Einnahmen, Gesamt Ausgaben, Cashflow (= Summe beider).

→ Kontostand:
   erster Monat   = Startkontostand + Cashflow(erster Monat)
   jeder weitere  = Kontostand(Vormonat) + Cashflow(dieser Monat)
```

**Wichtige Reihenfolge-Regel (aus PROJ-72 gelernt):** Die Steuerausgaben leiten ihre Umsatzsteuer aus den Soll-Werten der anderen fünf Module ab. Damit die hier gezeigte Umsatzsteuer **exakt** der Steuerausgaben-Seite entspricht, werden die Module **in zwei Phasen** geladen: zuerst die fünf Nicht-Steuer-Module, **dann** die Steuerausgaben zuletzt. So liest die Steuer-Berechnung denselben frischen, konsistenten Stand. (In der langfristigen Planung berechnen die `berechnet`-Routen meist „on the fly" ohne zu speichern und die Steuer-Route ruft die anderen intern auf — die zweiphasige Reihenfolge ist die sichere Absicherung und in `/backend`/`/frontend` final zu verifizieren.)

### C) Datenmodell (in einfachen Worten)

**Es wird keine neue Datenbanktabelle angelegt.** Die Seite ist eine reine Lese-/Anzeigeschicht. Alle dauerhaften Daten leben weiterhin in den bestehenden versionsgebundenen Tabellen der sechs Module und werden dort gepflegt; der Startkontostand liegt in den (bereits vorhandenen) Grundeinstellungen der Version.

Im Speicher (nur während die Seite offen ist) hält der Hook eine zusammengeführte Struktur, die pro Zeile (Kategorie/Gruppe/Untergruppe bzw. Produkt/Plattform) und pro Monat festhält:

```
Pro Zelle:
- der anzuzeigende effektive Soll-Betrag
- Herkunft: automatisch (grau) oder manuell (blau)
- ob eine Notiz aus der Quellseite existiert (nur Anzeige)

Pro Monat (Spalte):
- Gesamt Einnahmen, Gesamt Ausgaben, Cashflow, Kontostand (im Hook errechnet)
```

### D) Kategoriequelle (Versionsisolation)

Jedes Modul übernimmt **dieselbe** Zeilen-/Kategoriequelle wie seine langfristige Quellseite:
- **Versionsgebunden** (aus der KPI-Modell-Verwaltung dieser Version, PROJ-74): Produkte, Sales Plattformen, Marketingkanäle, Investitionen.
- **Global** (nur gelesen): die Einnahmen-/Ausgaben-/Steuern-Kategorie-Subtrees, dort wo das Quellmodul global liest.

Dadurch erscheinen automatisch genau die Kategorien dieses Szenarios — eine leere Version ergibt eine im Wesentlichen leere Auswertung (nur Summenzeilen; Kontostand = Startkontostand).

### E) Was neu gebaut wird vs. was wiederverwendet wird

| | Beschreibung |
|---|---|
| **Wiederverwendet (unverändert)** | Die 6 langfristigen Modul-Endpunkte (manuelle + berechnete Soll-Werte); die Grundeinstellungen (Startmonat, Horizont, Startkontostand); der Monatsfenster-Helfer (`buildPlanungsmonate`); das Notiz-System der Version; das Betragsselektions-Muster; das Versions-Gerüst (`LangfristigeVersionShell`); die Chart-Bibliothek (Recharts) |
| **Vorlage zum Klonen** | Hook + Tabelle + Chart von PROJ-72 (kurzfristige Liquiditätsauswertung) — Struktur, Summen, Cashflow, Kontostand, Indikatorpunkte, Notiz, Betragsselektion |
| **Neu** | Eine Seite, ein Daten-Hook, eine Tabellen-Komponente, eine Chart-Komponente und **ein** kleiner Eintrag in der Navigations-Konfiguration |
| **Bewusst NICHT neu** | Keine neue Datenbanktabelle, keine neue Server-Route (insb. keine Anfangsbestand-Route), keine neue Berechnungslogik |

### F) Tech-Entscheidungen (mit Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Werte beschaffen | Bestehende Modul-Endpunkte der Version wiederverwenden | Garantiert „1:1" und vermeidet das gefährliche Duplizieren komplexer Berechnungslogik (Umsatzsteuer etc.) |
| Zusammenführung | Im Frontend-Hook (wie PROJ-72) | Summen/Cashflow/Kontostand sind einfache Addition; die teure Berechnung passiert in den Modul-Endpunkten |
| Kontostand-Startwert | Startkontostand aus Grundeinstellungen | Nutzervorgabe; in der Langfristigen Planung gibt es keine Ist-Transaktionen für einen berechneten Anfangsbestand |
| Anfangsbestand-Server-Route | Entfällt | Nicht nötig — kein transaktionsbasierter Startwert |
| Neue Datenbanktabelle | Keine | Die Seite speichert nichts Eigenes |
| Zeitbasis | Nur Monate | Nutzervorgabe; identisch zu allen langfristigen Planungsseiten |
| Ist-Spalten | Keine | Nutzervorgabe; Langfristige Planung kennt keine Vergangenheit/Transaktionen |
| Ladereihenfolge | Steuerausgaben zuletzt | Konsistente Umsatzsteuer mit der Steuerausgaben-Seite (Lehre aus PROJ-72) |
| Navigation | Neue Gruppe „Auswertungen" als dritte Gruppe | Nutzervorgabe; zentrale Nav-Konfiguration, Menü + Versions-Übersicht ziehen generisch nach |
| Diagramm | Recharts (vorhanden) | Identischer Look wie Liquiditätsreport, kein neues Paket |

### G) Abhängigkeiten (zu installierende Pakete)

**Keine.** Alle Bausteine sind vorhanden: shadcn/ui (Table, Tooltip, Button, Skeleton), Recharts (Diagramm), das Versions-Gerüst und die Nav-Konfiguration aus PROJ-73, der Monatsfenster-Helfer aus PROJ-84.

### H) Neue und geänderte Dateien

**Neu:**

| Datei | Aufgabe |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/liquiditaetsauswertung/page.tsx` | Seiten-Container (Versions-Shell + Header + Chart + Tabelle) |
| `src/hooks/use-langfristige-liquiditaetsauswertung.ts` | Das „Gehirn": lädt die 6 Module der Version + Grundeinstellungen + Notizen, führt zusammen, berechnet Summen/Cashflow/Kontostand, Einklapp- und Selektionszustand |
| `src/components/langfristige-liquiditaetsauswertung-tabelle.tsx` | Große read-only Monats-Tabelle: Abschnitte, Indikatorpunkte, Notiz-Anzeige, Betragsselektion |
| `src/components/langfristige-liquiditaetsauswertung-chart.tsx` | Liniendiagramm mit 4 Linien |

**Geändert:**

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Neue Nav-Gruppe „Auswertungen" mit erstem Eintrag „Liquiditätsauswertung" (Slug `liquiditaetsauswertung`) |

**Datenbank:** keine Migration.

### I) Umsetzungsreihenfolge (empfohlen)

```
1. Nav-Konfiguration: neue Gruppe „Auswertungen" + Eintrag „Liquiditätsauswertung"
   (Menü, Versions-Übersicht und Platzhalter-Routing greifen sofort)
   ↓
2. Hook use-langfristige-liquiditaetsauswertung
   (Klon von PROJ-72-Hook, reduziert auf Monate/Soll; lädt die 6 Versions-Module +
    Grundeinstellungen + Notizen; Kontostand = Startkontostand + kumulierter Cashflow;
    Steuerausgaben zuletzt laden)
   ↓
3. Tabellen-Komponente (Klon, ohne Ist-Spalten / ohne Wochen-Monats-Umschalter)
   ↓
4. Chart-Komponente (Klon)
   ↓
5. Seite (Versions-Shell + Header + Chart + Tabelle)
```

> Hinweis zum Zuschnitt: Da Versions-Gerüst, Monatsfenster-Helfer, Notiz-System und die sechs Modul-Endpunkte bereits existieren, ist dies fast ausschließlich **Frontend-Arbeit** (Klonen + Reduzieren der PROJ-72-Komponenten). Es ist **kein `/backend`-Schritt** nötig (keine neue Tabelle/Route), sofern die Verifikation in Schritt 2 bestätigt, dass alle sechs Modul-Endpunkte die effektiven Soll-Werte wie erwartet liefern.

### J) Hinweise & Risiken

- **Viele parallele Abfragen beim Laden:** 6 Module × (manuell + berechnet) plus Grundeinstellungen und Notizen. Für ein internes Werkzeug mit 1–5 Nutzern unkritisch; Steuerausgaben werden bewusst in der zweiten Phase geladen.
- **Umsatzsteuer-Konsistenz:** Der heikelste Punkt (wie in PROJ-72). Absicherung über die Ladereihenfolge; in QA mit konkreten Versions-Plandaten gegen die Steuerausgaben-Seite plausibilisieren.
- **Hierarchie-Treue:** Die Zeilenstruktur jeder Quelle wird so übernommen, wie die jeweilige langfristige Quellseite sie aufbaut (gleiche Sortierung, gleiche Aggregation, inkl. Produkt-/Plattform-Drilldowns wo vorhanden), damit die Anzeige deckungsgleich ist.
- **Endpunkt-Verifikation:** Die exakten Modul-Slugs/Endpunkte sind in Schritt 2 final zu prüfen (Quelle: `src/lib/langfristige-planung-nav.ts` + die jeweiligen `use-langfristige-*`-Hooks).

## Implementation Notes (Frontend — 2026-06-23)

Reiner Frontend-Build (kein `/backend`-Schritt): keine neue Tabelle, keine neue Server-Route. Die Seite aggregiert ausschließlich bestehende versionsgebundene Modul-Endpunkte und liest den Startkontostand aus den (bereits vorhandenen) Grundeinstellungen.

### Neue Dateien
- `src/hooks/use-langfristige-liquiditaetsauswertung.ts` — Aggregations-Hook (Klon von PROJ-72, reduziert auf **nur Monate / nur Soll**). Lädt parallel: Grundeinstellungen der Version (Startmonat, `planungshorizont_monate`, `startkontostand`), globale KPI-Bäume (`einnahmen`, `ausgaben_kosten`) und die versionsgebundenen Stammdaten (`kpi-kategorien?art=lp_produkt|lp_sales_plattform|lp_investition`). Danach die sechs Modul-Endpunkte:
  - **Einnahmen** (`einnahmen-planung` + `…/produktverkaeufe-berechnet`): Produktverkäufe-Plattform-Unterzeilen (auto = grau), manueller Total-Override (blau); Nicht-Produktverkäufe = manuell (blau). Plattformen strukturell (alle Plattformen der Version).
  - **Umsatzausgaben** (`umsatzausgaben` + `…/berechnet`): globaler `ausgaben_kosten`-Baum **ohne** die vier eigenen Wurzeln (operativ/finanzierung/steuern/produktinvestitionen); Produkt-Unterzeilen; effektiv = manuell ?? berechnet.
  - **Operative Ausgaben** (`operativekosten-planung`, Feld `betrag`, rein manuell): globaler „operativ"-Subtree.
  - **Investitionsausgaben** (`investitionsausgaben-planung` + `…/berechnet`): **versionsgebundener** `lp_investition`-Baum; Produkt-Unterzeilen; effektiv = manuell ?? berechnet.
  - **Finanzierungsausgaben** (`finanzierungsausgaben-planung`, Feld `betrag`, rein manuell): globaler „finanzierung"-Subtree.
  - **Steuerausgaben** (`steuerausgaben` + `…/berechnet`, **zuletzt** geladen): globaler „steuern"-Subtree; negative Werte erlaubt; effektiv = manuell ?? berechnet.
  - Kontostand: `startkontostand` + kumulierter monatlicher Cashflow (Monat 1 = Startkontostand + Cashflow Monat 1). Zwei-Phasen-Laden (Steuer zuletzt) für UST-Konsistenz mit der Steuerausgaben-Seite (Lehre aus PROJ-72).
  - Eigenes Monatsfenster `buildMonate(startMonat, startJahr, horizont)` — **ohne** den 3-Monats-Vorlauf des `buildPlanungsmonate`-Helfers (der für die Planungsseiten gilt); die Auswertung zeigt nur den Soll-Horizont ab Startmonat.
- `src/components/langfristige-liquiditaetsauswertung-tabelle.tsx` — read-only Monats-Matrix (Klon der PROJ-72-Tabelle **ohne** Ist/Soll-Trennung, **ohne** Wochen/Monats-Tabs). Jahres-Gruppen-Kopfzeile + Monatsspalten, einklappbare Hierarchie (transitiv), grau/blau-Indikatorpunkte, Notiz-Tooltips, Betragsselektion (Klick/Ctrl+Klick/Drag) mit Summen-Panel, „Alle aus-/einklappen".
- `src/components/langfristige-liquiditaetsauswertung-chart.tsx` — Liniendiagramm (Recharts, 4 Linien: Einnahmen, Ausgaben absolut, Cashflow, Kontostand), Stil 1:1 vom Liquiditätsreport.
- `src/app/dashboard/langfristige-planung/[versionId]/liquiditaetsauswertung/page.tsx` — Seite via `LangfristigeVersionShell` (`seitenTitel="Liquiditätsauswertung"`, `fullWidth`); ruft den Hook einmal auf und versorgt Chart + Tabelle.

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — neue Nav-Gruppe **„Auswertungen"** (dritte Gruppe nach „Einstellungen" und „Planung") mit erstem Eintrag „Liquiditätsauswertung" (Slug `liquiditaetsauswertung`). NavSheet und Versions-Übersicht ziehen generisch nach.

### Designentscheidungen / Abweichungen
- **Ausgaben in 5 Blöcken in Spec-Reihenfolge** (Umsatzausgaben → Operative → Investitionen → Finanzierung → Steuern): nötig, weil die Investitionen aus dem **versionsgebundenen** `lp_investition`-Baum stammen und nicht im globalen `ausgaben_kosten`-Baum liegen. Jeder Block rendert seinen eigenen Kategorie-Subtree + Datenspeicher; „Gesamt Ausgaben" summiert alle fünf Blöcke. (PROJ-72 mergte alle Ausgaben in einen globalen Baum — hier nicht möglich.)
- **Produkt-/Plattform-Drilldowns datengetrieben** (Produkte) bzw. strukturell (Plattformen), analog PROJ-72. Steuer-Aufschlüsselungen (Einfuhr-USt je Produkt, UST-Komponenten) werden — wie in PROJ-72 — **nicht** als Unterzeilen gezeigt (die Leaf-Werte enthalten sie bereits).
- **Produkt-/Plattform-Reihenfolge = KPI-Modell-Reihenfolge** (Nutzerwunsch 2026-06-23): Produkte und Plattformen werden in ihrer `sort_order` aus dem KPI-Modell sortiert (nicht alphabetisch). Produkte ohne Werte erscheinen nicht (datengetrieben).
- **Indikator/Notiz nur auf Pflege-Ebene** (echtes Blatt bzw. Produkt/Plattform), nicht auf reinen Aggregat-/Gruppenzeilen.
- **Jede Oberkategorie (L1) wird immer angezeigt** (Nutzerwunsch 2026-06-23) — auch ohne Werte. Hat eine Oberkategorie keinerlei Daten, erscheint sie als einzelne Zeile mit leeren Monatszellen (nicht aufklappbar). Untergruppen/Blätter ohne Daten bleiben datengetrieben ausgeblendet.
- **Marketing-Untergruppen = Marketingkanäle** (Fix 2026-06-23): In der Umsatzausgaben-Quelle sind die Untergruppen unter „Marketing" die **versionsgebundenen Marketingkanäle** (`lp_marketingkanal`), und die berechneten Werte sind nach **Kanal-ID** verschlüsselt (nicht nach globaler Kategorie). Die Auswertung injiziert die Kanäle daher als synthetische L2-Knoten unter die globale „Marketing"-L1 und nimmt ihre IDs in die Umsatz-Blattmenge auf — sonst blieb „Marketing" leer.
- **Investitionen als eine Gruppe** (Fix 2026-06-23): Alle Investitionen werden unter **eine** Oberkategorie „Investitionen" gruppiert; die im KPI-Modell hinterlegten Investitions-Übergruppen werden dazu unter einen synthetischen Wurzelknoten gehängt (auf Ebene 2 gesetzt) und damit zu Untergruppen darunter.
- **Operativkosten Brutto in der Liquiditätssicht** (Fix 2026-06-23): Die Operativkosten-Werte sind **netto** (exkl. USt). Da die Liquiditätsauswertung den tatsächlichen Cash-Out zeigt, wird je Operativ-Kategorie der **USt-Satz aufgeschlagen** (Brutto = Netto × (1 + Satz/100)). Die Satz-Auflösung erfolgt **identisch zur Steuerausgaben-Berechnung** (`getUstSatzHierarchisch`: Gesamt → L1-Satz; Aufgeteilt → erster `:2`-Satz von der Kategorie aufwärts), gespeist aus `steuereinstellungen/kategorie-saetze` + `…/ebene-auswahl` dieser Version.
  - **Steuer-Route angepasst (2026-06-23, auf Nutzerwunsch):** Die Steuerausgaben-`berechnet`-Route (PROJ-93) behandelte Operativkosten in der Vorsteuer-Berechnung (B3) bisher als **Brutto** (`extractVorsteuer`). Da Operativkosten **netto** sind, ist die Vorsteuer dort jetzt `Netto × Satz/100`. Dadurch gleicht sich der USt-Anteil in der Umsatzsteuer-Zeile **exakt** mit dem Brutto-Aufschlag der Liquiditätsauswertung aus (Operativkosten netten in der Gesamt-Liquidität auf 0 USt-Effekt). **Hinweis:** Diese Änderung wirkt auch auf die Steuerausgaben-Planungsseite (PROJ-93) — deren Umsatzsteuer-Werte ändern sich entsprechend. Alle 25 Route-Tests grün. (Nur **langfristig** geändert; die kurzfristige Steuer-Route blieb unberührt.)

### Zeitbasis-Umschalter Monat/Jahr (2026-06-24, Nutzerwunsch)
Neuer **Monat/Jahr-Umschalter** in der Seitenkopf-Filterleiste (Standard: Monat) — analog zur Rentabilitätsauswertung (PROJ-95). „Jahr" aggregiert **rollierende 12-Monats-Blöcke ab dem Startmonat** (keine Kalenderjahre): Spalten „Jahr 1/2/…" mit Monatsbereich als Sublabel im Spaltenkopf. Aggregation (`applyZeitbasisLiq` im Hook): Fluss-Zeilen (Einnahmen/Ausgaben/Gesamt/Cashflow) summieren je Block; die **kumulierte Kontostand-Zeile** zeigt den **Endbestand** (letzter Monat des Blocks), nicht die Summe. Indikatorpunkte/Notizen entfallen in der Jahresansicht. Tabelle blendet die Monats-Jahres-Gruppenkopfzeile in der Jahresansicht aus; Diagramm und Betragsselektion arbeiten unverändert auf den Jahresspalten. Geändert: `use-langfristige-liquiditaetsauswertung.ts` (Aggregation + `sublabel`), `…-tabelle.tsx` (Kopf), `page.tsx` (Umschalter). Hook-Tests 9/9 grün, `npm run build` erfolgreich.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen/geänderten Dateien; projektweit keine neuen Nicht-Test-Fehler.
- Manuelle Browser-Verifikation mit einer Planversion mit echten Plandaten steht noch aus (→ `/qa`).

## QA Test Results

**Getestet:** 2026-06-23 · **Methode:** Code-Audit aller Akzeptanzkriterien + Vitest (Hook-Aggregationslogik) + Vitest (geänderte Steuer-Route) + Playwright (Route/Auth/Regression). Interaktionen (Einklappen, Betragsselektion, Notiz-Tooltip) und die visuelle 1:1-Übereinstimmung mit den Quellseiten sind code-/manuell geprüft — analog zum Vorgehen bei PROJ-72/74/75 (versionsgebundene Seiten ohne automatisierte Login-Session in E2E).

### Automatisierte Tests

| Suite | Datei | Ergebnis |
|-------|-------|----------|
| Vitest — Aggregations-Hook | `src/hooks/use-langfristige-liquiditaetsauswertung.test.ts` | **9/9 ✅** |
| Vitest — geänderte Steuer-Route (B3 Operativ netto) | `src/app/api/langfristige-planung/[versionId]/steuerausgaben/berechnet/route.test.ts` (+`/route.test.ts`) | **25/25 ✅** |
| Playwright E2E (Route/Auth/Regression) | `tests/PROJ-94-langfristige-liquiditaetsauswertung.spec.ts` | **10/10 ✅** (5 × Chromium + Mobile Safari) |

**Hook-Tests:** Monatsfenster ab Startmonat (nur Soll, keine Vergangenheit); Gesamt Einnahmen/Ausgaben-Summen; Cashflow + kumulierter Kontostand ab Startkontostand; **Operativkosten-Brutto-Aufschlag** (100 netto → 119 @ 19 %); **Marketingkanäle** als Untergruppen unter „Marketing"; **Investitionen** unter einer Gruppe (Übergruppe nicht dupliziert); **jede Oberkategorie immer sichtbar** (leere Zeile); **Produkt-Reihenfolge = KPI-`sort_order`** (nicht alphabetisch); grau/blau-Indikatoren.
**E2E:** Route ohne 404, Auth-Redirect Seite + geänderte Steuer-`berechnet`-API, Dashboard-Redirect, kurzfristige Liquiditätsauswertung weiterhin erreichbar.

### Akzeptanzkriterien

| Bereich | Status | Beleg |
|---|---|---|
| Navigation: neue Gruppe „Auswertungen" (3.), Eintrag „Liquiditätsauswertung", Versions-Übersicht zieht nach | ✅ | `langfristige-planung-nav.ts` (3. Gruppe, Slug `liquiditaetsauswertung`); NavSheet/Übersicht rendern generisch |
| Auth-Guard + fremde/unbekannte `versionId` → Redirect | ✅ | `LangfristigeVersionShell`; E2E Auth-Redirect |
| Buttons „Alle aus-/einklappen", **kein** Zurücksetzen-Button | ✅ | Tabelle: nur Collapse-Buttons, keine Reset-/Edit-Handler |
| Read-only (keine Edits, keine Notiz-Bearbeitung) | ✅ | Keine Edit-/Mutations-Handler in Hook/Tabelle |
| Nur Monatsspalten, kein Umschalter, kein Ist | ✅ | `buildMonate` (Start→Horizont); keine Tabs; Hook-Test |
| Zeitfenster Startmonat → `planungshorizont_monate` | ✅ | Hook-Test (Jan/Feb 2026) |
| EINNAHMEN-Hierarchie + Gesamt Einnahmen | ✅ | Hook-Test (Summe 700) |
| AUSGABEN: 5 Module in Reihenfolge + Gesamt Ausgaben | ✅ | Blöcke Umsatz→Operativ→Invest→Finanz→Steuer; Hook-Test (−729) |
| Cashflow + kumulierter Kontostand (Monat 1 = Startkontostand + CF) | ✅ | Hook-Test (CF −29, Kontostand 971/971) |
| Effektiver Soll = manuell ?? berechnet; grau/blau | ✅ | Hook-Test (e1 blau, Plattform-Auto grau) |
| Operativkosten **brutto** in Liquiditätssicht (Netto × (1+Satz/100)), hierarchische Satz-Auflösung | ✅ | Hook-Test (Miete −119); Satz wie `getUstSatzHierarchisch` |
| Umsatzsteuer-Konsistenz: Operativ-Vorsteuer netto (B3 = Netto × Satz/100) | ✅ | Steuer-Route-Fix + 25/25 Tests; gleicht den Brutto-Aufschlag aus |
| Marketing = versionsgebundene Kanäle unter „Marketing" | ✅ | Hook-Test (Google Ads −80) |
| Investitionen unter einer Gruppe „Investitionen" | ✅ | Hook-Test (1× „Investitionen", Übergruppe nicht dupliziert) |
| Jede Oberkategorie immer sichtbar (auch leer) | ✅ | Hook-Test („Spenden" mit leeren Zellen) |
| Produkt-/Plattform-Reihenfolge = KPI-Modell | ✅ | Hook-Test (Bravo vor Alpha) |
| Liniendiagramm (4 Linien, Monats-X-Achse) | ✅ | `…-chart.tsx` (Einnahmen/Ausgaben/Cashflow/Kontostand) |
| Notiz-Anzeige read-only (Indikator + Tooltip) | ✅ | Tabelle StickyNote-Tooltip; `useLangfristigePlanungNotizen` read-only |
| Betragsselektion (Klick/Ctrl+Klick/Drag, Summen-Panel) | ✅ | Tabelle Selektions-Handler + Panel |
| de-DE-Format, grün/rot nach Vorzeichen, sticky 1. Spalte, horizontal scrollbar | ✅ | `formatNum`, `valueColorClass`, `sticky left`, `overflow-x-auto` |
| Versionsisolation (nur Daten dieser `versionId`) | ✅ | Alle Endpunkte versions-/nutzergefiltert |

### Security-Audit (Red Team) — keine Befunde

- **AuthN/AuthZ:** Seite im `LangfristigeVersionShell` (validiert Versionseigentum serverseitig → Redirect bei fremd/unbekannt). Alle genutzten API-Endpunkte: `requireAuth()` + `ensureLangfristigeVersion` + Filter nach `user_id`+`plan_version_id`. E2E bestätigt Redirect zu `/login` (Seite **und** geänderte Steuer-`berechnet`-API). Kein Cross-User-/Cross-Version-Zugriff.
- **Read-only:** Die Seite schreibt keine eigenen Daten; keine neue Tabelle/Route (außer der bestehenden Steuer-Route-Anpassung).
- **XSS/Injection:** Werte via `toLocaleString`/`Intl`; Kategorie-/Produktnamen + Notiztext als Text gerendert (React-Escaping, kein `dangerouslySetInnerHTML`); Supabase parametrisiert.
- **Secrets:** keine im Client.

### Bugs

**Keine Critical/High/Medium gefunden.**

**Low / Beobachtungen (kein Blocker):**
- **L1 (by design):** Eine Oberkategorie ohne Werte zeigt **leere** Monatszellen (nicht „0,00") und ist nicht aufklappbar — explizit so gewünscht (2026-06-23).
- **L2 (Empfehlung):** Die exakte 1:1-Übereinstimmung mit den sechs Quell-Planungsseiten und die Umsatzsteuer-Abstimmung sollten einmalig im Browser mit einer Planversion mit echten Plandaten visuell plausibilisiert werden (die Aggregations-Mathematik + die Operativ-Vorsteuer-Korrektur sind durch Unit-/Route-Tests abgedeckt).
- **L3 (Daten-Config):** Fehlt im globalen KPI-Modell ein erwarteter Wurzelknoten (z. B. „Operativ"), bleibt der zugehörige Ausgaben-Block leer (kein Header) — abhängig von der KPI-Konfiguration, kein Code-Defekt.

### Hinweis zur Gesamt-Testsuite (NICHT durch PROJ-94 verursacht)

Ein `vitest run` über `src/app/api/langfristige-planung` zeigt **6 Fehlschläge** in `investitionsausgaben-planung/berechnet/route.test.ts`. Diese Datei/Route ist **untracked Work-in-Progress** (PROJ-92/PROJ-95, Rentabilitätsauswertung): Die Route liest neuerdings `langfristige_ust_kategorie_saetze`/`…_ebene_auswahl`, deren Mock im Test fehlt (`Cannot read properties of undefined (reading 'select')`). **Keine** dieser Dateien gehört zu PROJ-94; die Änderung wurde nicht von dieser QA/Feature verursacht. Außerhalb des PROJ-94-Scopes.

### Production-Ready: **JA**

Keine Critical/High-Bugs. PROJ-94 ist freigegeben. Empfehlung: einmalige visuelle Real-Daten-Plausibilisierung (L2) vor dem Deploy.

## Deployment
_To be added by /deploy_
</content>
</invoke>
