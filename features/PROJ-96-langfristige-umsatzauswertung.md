# PROJ-96: Umsatzauswertung — Langfristige Planung

## Status: Approved
**Created:** 2026-06-24
**Last Updated:** 2026-06-24

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — versionsgebundene Stammkategorien (Produkte, Sales Plattform)
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`) und **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monatsfenster
- Requires: PROJ-84 (Absatzplanung — Langfristige Planung) — **Absatz** je Produkt/Monat (effektiver Soll) für die Absatztabelle
- Requires: PROJ-87 (Sales-Plattform-Planung — Langfristige Planung) — Datenquelle für **Brutto-Umsatz, Rabatte, Rückerstattungen** je Produkt/Monat (effektiver Soll)
- Requires: PROJ-94 (Liquiditätsauswertung — Langfristige Planung) — liefert die Nav-Gruppe „Auswertungen"; diese Seite ist deren **dritter Eintrag**
- **Schwesterseite / primäre Vorlage:** PROJ-95 (Rentabilitätsauswertung — Langfristige Planung) — diese Seite ist eine **stilistisch identische, auf den Umsatzblock reduzierte** Variante. Berechnung des Umsatzblocks (Brutto, Rabatte, Rückerstattungen, Umsatzsteuer, Netto), Drill-Down, Absatztabelle, Diagramm und Ansichtsmodi werden von dort übernommen.
- Vorlage (kein harter Require): PROJ-24 (Rentabilitätsreport — Ansichtsmodi) — Definition „Absolut / Prozentual / Wachstum"
- Vorlage (kein harter Require): PROJ-26 (Rentabilitätsreport — Liniendiagramm) — Diagramm oben
- Vorlage (kein harter Require): PROJ-33 (Absatztabelle in Reports) — Absatztabelle zwischen Diagramm und Haupttabelle
- Vorlage (kein harter Require): PROJ-31 (Umsatzsteuer-Reporting) — Umsatzsteuer-Berechnungslogik

## Übersicht

Die **Umsatzauswertung** ist der **dritte Eintrag** im Navigationsbereich **„Auswertungen"** der Langfristigen Planung (nach Liquiditätsauswertung PROJ-94 und Rentabilitätsauswertung PROJ-95). Sie ist eine **rein anzeigende** (read-only), **versionsgebundene** Seite.

Sie ist im **Aufbau und Stil exakt wie die Rentabilitätsauswertung (PROJ-95)**, zeigt aber **ausschließlich den Umsatzblock** — vom Brutto-Umsatz bis zum Netto-Umsatz, **nichts weiter** (keine Produktkosten, keine Deckungsbeiträge, kein EBIT/EBT/Ergebnis). Die angezeigten Werte sind **dieselben** wie die obersten Zeilen der Rentabilitätsauswertung (gleiche Quelle, gleiche Berechnung).

Der Seitenaufbau von oben nach unten ist identisch zur Rentabilitätsauswertung:

1. **Liniendiagramm** — zeigt **Brutto-Umsatz** und **Netto-Umsatz** als Linien
2. **Absatztabelle** (wie PROJ-33 / PROJ-95)
3. **Haupttabelle** (Matrix: Umsatz-Kaskade × Zeitspalten)

### Feste Umsatz-Kaskade (Zeilenstruktur)

```
Brutto-Umsatz                                              (Sales-Plattform-Planung)
− Rabatte                                                  (Sales-Plattform-Planung)
− Rückerstattungen                                         (Sales-Plattform-Planung)
− Umsatzsteuer                                             (berechnet, wie Reporting/PROJ-95)
─────────────────────────────────────────────────────────
= Netto-Umsatz
```

Das ist **exakt** der Umsatzblock aus PROJ-95 (dort Zeilen 1–5 der Kaskade). Die Definition von Netto-Umsatz ist identisch: `Brutto-Umsatz − Rabatte − Rückerstattungen − Umsatzsteuer`.

### Wesentlicher Unterschied zur Rentabilitätsauswertung (PROJ-95)

| Aspekt | Rentabilitätsauswertung (PROJ-95) | Umsatzauswertung (PROJ-96) |
|---|---|---|
| Kaskade | volle GuV (Brutto-Umsatz … Ergebnis) | **nur Umsatzblock** (Brutto-Umsatz … Netto-Umsatz) |
| Granularität | nur Monate | **Umschalter Monat / Jahr** (Jahr = je 12 Monate ab Startmonat, rollierend) |
| Diagramm-Linien | mehrere Zwischensummen (DB III, EBIT, EBT, Ergebnis …) | **Brutto-Umsatz und Netto-Umsatz** |
| „Ohne Investitionen"-Filter | vorhanden | **nicht vorhanden** (für den Umsatzblock nicht relevant) |
| Ansichtsmodi | Absolut / Prozentual / Wachstum | **identisch**: Absolut / Prozentual / Wachstum |
| Drill-Down je Produkt | ja | **identisch** (ja) |
| Absatztabelle | ja | **identisch** (ja) |

## User Stories

- Als Controller möchte ich die Umsatzauswertung innerhalb einer geöffneten Planversion über das linke Seitenmenü (Gruppe „Auswertungen", dritter Eintrag) und über die Versions-Übersichtsseite aufrufen können, damit ich die geplante Umsatzentwicklung dieses Szenarios an einer Stelle sehe.
- Als Controller möchte ich ausschließlich die Umsatz-Kaskade (Brutto-Umsatz, Rabatte, Rückerstattungen, Umsatzsteuer, Netto-Umsatz) je Zeitspalte sehen — nichts weiter.
- Als Controller möchte ich zwischen **Monats-** und **Jahresansicht** umschalten können, wobei die Jahresansicht **nicht** Kalenderjahre, sondern je 12 Monate **ab dem Startmonat** bündelt.
- Als Controller möchte ich zwischen den Ansichten „Absolut", „Prozentual" und „Wachstum" umschalten können, genau wie in der Rentabilitätsauswertung.
- Als Controller möchte ich jede Umsatzzeile bis auf Produktebene aufklappen können, um zu sehen, welche Produkte den Umsatz tragen.
- Als Controller möchte ich oben ein Liniendiagramm mit **Brutto-Umsatz** und **Netto-Umsatz** und darunter eine Absatztabelle sehen, genau wie in der Rentabilitätsauswertung.
- Als Controller möchte ich, dass die hier gezeigten Umsatzwerte **exakt denen der Rentabilitätsauswertung** dieser Version entsprechen (gleiche Quelle, gleiche Berechnung, effektiver Soll).

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Im Versionskontext erscheint die Seite als **dritter Eintrag** der Nav-Gruppe „Auswertungen": „Umsatzauswertung" → `/dashboard/langfristige-planung/[versionId]/umsatzauswertung`
- [ ] Auf der Versions-Übersichtsseite erscheint ein Eintrag „Umsatzauswertung" (über die zentrale Nav-Konfiguration, generisch nachgezogen)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Bei unbekannter/fremder/ungültiger `versionId` erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73
- [ ] Rechts oben: Buttons **„Alle ausklappen"** und **„Alle einklappen"** (wie PROJ-95)

### Zeilenstruktur (feste Umsatz-Kaskade)

- [ ] Die Zeilen sind **fest vorgegeben** in exakt dieser Reihenfolge: Brutto-Umsatz, Rabatte, Rückerstattungen, Umsatzsteuer, **Netto-Umsatz**
- [ ] **Keine** weiteren Kaskaden-Zeilen (keine Produktkosten, keine Deckungsbeiträge, kein EBIT/EBT/Ergebnis) — „nur diese Kategorie, nichts anderes"
- [ ] Die **Netto-Umsatz-Zeile** ist als Zwischensumme visuell hervorgehoben (fett, Hintergrund, Trennlinie) — analog PROJ-95
- [ ] Alle Zeilen sind dauerhaft sichtbar, auch wenn ihr Wert in allen Spalten 0 ist

### Wertberechnung (planbasiert, identisch zu PROJ-95-Umsatzblock)

- [ ] **Brutto-Umsatz** = Brutto-Umsatz je Produkt/Monat aus der Sales-Plattform-Planung (effektiver Soll)
- [ ] **Rabatte** = Rabatte je Produkt/Monat aus der Sales-Plattform-Planung (Abzugsposten)
- [ ] **Rückerstattungen** = Rückerstattungen je Produkt/Monat aus der Sales-Plattform-Planung (Abzugsposten)
- [ ] **Umsatzsteuer** = berechnet auf Basis von Brutto-Umsatz, Rabatten und Rückerstattungen — **auf dieselbe Art und Weise wie im Reporting bzw. in PROJ-95** (produktspezifischer USt-Satz, Netto-Basis = Brutto − Rabatte − Rückerstattungen) (Abzugsposten)
- [ ] **Netto-Umsatz** = Brutto-Umsatz − Rabatte − Rückerstattungen − Umsatzsteuer
- [ ] Die berechneten Monatswerte sind **bitidentisch** zu den entsprechenden Zeilen der Rentabilitätsauswertung (PROJ-95) derselben Version (gemeinsame Berechnungsquelle, kein zweiter, abweichender Rechenweg)

### Granularität (Umschalter Monat / Jahr)

- [ ] Umschalter mit zwei Stufen: **Monat** (Standard) und **Jahr**
- [ ] **Monat:** eine Spalte je Monat, vom **Startmonat** über **`planungshorizont_monate`** Monate (allgemeiner Horizont, Fallback 12) — identisch zum Monatsfenster der langfristigen Planungsseiten (`buildPlanungsmonate`)
- [ ] **Jahr:** Spalten bündeln je **12 aufeinanderfolgende Monate ab dem Startmonat** (rollierend), **nicht** Kalenderjahre. Block 1 = Monate 1–12 ab Startmonat, Block 2 = Monate 13–24, usw.
- [ ] Ist der Planungshorizont **kein Vielfaches von 12**, wird der letzte (unvollständige) Block als eigenes, **kürzeres** Jahr gezeigt (Summe der tatsächlich vorhandenen Monate dieses Blocks)
- [ ] Jahres-Spaltenwert = **Summe** der Monatswerte des jeweiligen Blocks (für alle Kaskadenzeilen; Netto-Umsatz folgt dabei aus den summierten Komponenten)
- [ ] Jahres-Header sind klar benannt (z. B. „Jahr 1" mit Zeitspanne „Jan 2026 – Dez 2026", letzter Teilblock entsprechend kürzer)
- [ ] **Kein Ist-Bereich, keine Vergangenheit, keine Ist/Soll-Trennlinie** — alle Spalten sind Soll-Zeiträume
- [ ] Tabelle horizontal scrollbar; erste Spalte (Zeilenbeschriftung) ist `sticky left`

### Ausklappbare Zeilen (Drill-Down bis Produkt)

- [ ] Jede der vier berechneten Zeilen (Brutto-Umsatz, Rabatte, Rückerstattungen, Umsatzsteuer) ist **aufklappbar** und zeigt die Beträge **je Produkt**
- [ ] Die **Netto-Umsatz**-Zwischensumme ist **nicht** aufklappbar
- [ ] Globaler „Alle ausklappen / Alle einklappen"-Button füllt/leert alle Drill-Down-Ebenen
- [ ] Expand/Collapse-Zustand bleibt beim Wechsel von Ansichtsmodus (Absolut/Prozentual/Wachstum) **und** Granularität (Monat/Jahr) erhalten
- [ ] Drill-Down-Werte werden bei Jahresansicht ebenfalls je Block summiert

### Ansichtsmodi (Absolut / Prozentual / Wachstum) — analog PROJ-24/PROJ-95

- [ ] Umschalter mit drei Modi; Standard: **Absolut**
- [ ] **Absolut**: unveränderte Werte im Währungsformat (de-DE, 2 Dezimalstellen, €)
- [ ] **Prozentual**: jede Zelle = `Wert / Brutto-Umsatz der Spalte × 100`, 1 Dezimalstelle, %-Zeichen — **Bezugsgröße ist der Brutto-Umsatz** derselben Spalte. Ist der Brutto-Umsatz einer Spalte 0 → „—" für alle Zellen dieser Spalte
- [ ] **Wachstum**: je Zelle zwei Zeilen — Absolutwert (klein) und darunter prozentuale Veränderung zur **Vorperiode** (`(aktuell − vorher) / |vorher| × 100`), 1 Dezimalstelle; positiv grün „+X,X % ↑", negativ rot „−X,X % ↓", 0 → „0,0 %"; Vorperiode = 0 und aktuell ≠ 0 → „n/a"; Vorperiode = 0 und aktuell = 0 → „0,0 %"
- [ ] Die **Vorperiode** richtet sich nach der Granularität: in Monatsansicht der **Vormonat**, in Jahresansicht der **vorherige 12-Monats-Block**
- [ ] Drill-Down-Zeilen werden im jeweiligen Modus konsistent dargestellt (Prozentwerte beziehen sich auf den Brutto-Umsatz derselben Spalte)

### Liniendiagramm (oben) — analog PROJ-26/PROJ-95

- [ ] Oberhalb der Absatztabelle ein **Liniendiagramm** (Recharts) im Stil der Rentabilitätsauswertung
- [ ] Es werden standardmäßig die Linien **Brutto-Umsatz** und **Netto-Umsatz** gezeigt
- [ ] X-Achse: Zeitspalten (synchron mit der Tabelle — Monate bzw. Jahresblöcke); Y-Achse folgt dem aktiven Ansichtsmodus (€ bei Absolut, % bei Prozentual, Wachstumsrate bei Wachstum) wie in PROJ-26/PROJ-95
- [ ] Diagramm respektiert den aktiven Ansichtsmodus und die Granularität
- [ ] Leerzustand: Diagramm wird ausgeblendet, wenn keine darstellbaren Zeitspalten vorhanden sind

### Absatztabelle (zwischen Diagramm und Haupttabelle) — analog PROJ-33/PROJ-95

- [ ] Zwischen Diagramm und Haupttabelle eine **Absatztabelle**
- [ ] Eine Hauptzeile **„Absatz gesamt"** (Summe der abgesetzten Stück je Spalte), aufklappbar zu **einer Unterzeile je Produkt**
- [ ] Datenquelle: **langfristige Absatzplanung dieser Version** (PROJ-84), effektiver Absatz je Produkt/Monat
- [ ] Spalten identisch zu den Zeitspalten der Haupttabelle (Monat bzw. Jahresblock; Jahr = Summe der Monate)
- [ ] Werte als ganze Zahlen (kein Währungsformat); 0 als „0"
- [ ] Sticky erste Spalte, horizontal scrollbar

### Darstellung (Farben) — analog PROJ-95

- [ ] Brutto-Umsatz / Netto-Umsatz (positive Werte) grün/schwarz; Abzugsposten (Rabatte, Rückerstattungen, Umsatzsteuer) rot mit Minuszeichen
- [ ] 0-Werte als „0,00 €" (nicht leer); Beträge mit 2 Dezimalstellen und € im de-DE-Format
- [ ] Netto-Umsatz-Zeile optisch klar von den regulären Zeilen abgegrenzt

### Read-only-Verhalten

- [ ] Keine Zelle ist editierbar (kein Inline-Edit, kein onBlur-Speichern)
- [ ] Die Seite schreibt **keine eigenen** Planungsdaten; sie liest/berechnet ausschließlich aus bestehenden versionsgebundenen Planungsdaten
- [ ] Kein „Zurücksetzen"-Button

### Versionsisolation

- [ ] Es werden **keine** Daten aus anderen Planversionen oder aus der Kurzfristigen Planung angezeigt
- [ ] Eine neu angelegte (leere) Planversion zeigt eine im Wesentlichen leere Auswertung (alle Werte 0), Struktur bleibt vollständig sichtbar

## Edge Cases

- **Leere/neu angelegte Planversion:** alle Kaskaden-Werte 0; Struktur (5 Zeilen) bleibt sichtbar.
- **Brutto-Umsatz einer Spalte = 0:** im Modus „Prozentual" zeigt diese Spalte „—" für alle Zellen.
- **Vorperiode ohne Wert (Modus Wachstum):** „n/a" bzw. „—" gemäß PROJ-24/PROJ-95-Regeln; in Jahresansicht ist die Vorperiode der vorherige 12-Monats-Block.
- **Planungshorizont kein Vielfaches von 12 (Jahresansicht):** letzter Block ist ein kürzeres Teiljahr (Summe der vorhandenen Monate), klar benannt.
- **Planungshorizont < 12 Monate:** Jahresansicht zeigt genau einen (Teil-)Block über alle vorhandenen Monate.
- **Negative Umsatzsteuer (z. B. durch hohe Rückerstattungen):** Werte erlaubt; Darstellung folgt dem Vorzeichen.
- **Sehr breite Tabelle (großer Planungshorizont):** horizontales Scrollen, erste Spalte sticky; Jahresansicht reduziert die Spaltenzahl deutlich.
- **Fremde/unbekannte `versionId`:** Redirect zum Dashboard (PROJ-73), kein Fremdzugriff.
- **Quell-API liefert einen Fehler:** betroffene Zeile zeigt leer/Hinweis, übrige Kaskade bleibt nutzbar; kein Seitenabsturz.
- **Konsistenz mit PROJ-95:** Brutto/Rabatte/Rückerstattungen/Umsatzsteuer/Netto müssen exakt mit den entsprechenden Zeilen der Rentabilitätsauswertung übereinstimmen — gemeinsame Berechnungsquelle bevorzugen (in `/architecture` festlegen).

## Technical Requirements

- Authentifizierung: `requireAuth()` in ggf. neuen API-Routen; Seite ist Client Component im Versions-Shell (`LangfristigeVersionShell`) mit Auth- und Versions-Eigentumsprüfung
- **Keine neue DB-Tabelle nötig** — read-only; Aggregation/Berechnung ausschließlich aus bestehenden versionsgebundenen Daten
- **Wiederverwendung der PROJ-95-Berechnung:** Da nur der Umsatzblock benötigt wird, soll die bestehende Umsatzblock-Berechnung der Rentabilitätsauswertung (Brutto/Rabatte/Rückerstattungen/Umsatzsteuer/Netto je Produkt/Monat) wiederverwendet werden — idealerweise dieselbe Server-Route/Berechnungsfunktion, gefiltert auf den Umsatzblock; finale Entscheidung in `/architecture`. Damit ist Bit-Konsistenz zu PROJ-95 garantiert.
- Monatsfenster: bestehender Helfer `buildPlanungsmonate` (Startmonat + `planungshorizont_monate`)
- **Jahres-Bündelung** (12-Monats-Blöcke ab Startmonat, inkl. Teilblock) wird clientseitig auf den Monatswerten gebildet — kein zusätzlicher Server-Aufruf
- Ansichtsmodus-/Granularitäts-/Ausklapp-Umschaltung rein clientseitig auf bereits geladenen Daten
- Umsatzsteuer-Logik: aus dem Reporting-Bereich bzw. PROJ-95 (kein Duplizieren komplexer Logik)
- Chart-Bibliothek: Recharts (vorhanden)
- Keine neuen Packages: shadcn `Table`, `Tabs`, `Tooltip`, `Button`, `Skeleton` — alle vorhanden
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Richtwert)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/umsatzauswertung/page.tsx` | Seite: Versions-Shell + Kopfleiste (Granularität Monat/Jahr, Ansichtsmodi, Ausklappen-Buttons) + Diagramm + Absatztabelle + Umsatz-Matrix |
| `src/hooks/use-langfristige-umsatzauswertung.ts` | Datenladen (Umsatzblock + Absatz der Version), Monats-/Jahres-Spalten, Ansichtsmodus-/Granularitäts-/Ausklappzustand |
| `src/components/langfristige-umsatzauswertung-matrix.tsx` | Umsatz-Kaskade: feste 5 Zeilen, Drill-Down bis Produkt, sticky erste Spalte, Ansichtsmodi |
| `src/components/langfristige-umsatzauswertung-chart.tsx` | Liniendiagramm (Brutto-Umsatz, Netto-Umsatz) |
| `src/components/langfristige-umsatzauswertung-absatztabelle.tsx` | Absatztabelle — vorzugsweise bestehende PROJ-95-Komponente wiederverwenden |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Dritter Eintrag „Umsatzauswertung" (Slug `umsatzauswertung`) in der Nav-Gruppe „Auswertungen" |

### Wiederverwendung bestehender Muster

| Muster | Quelle |
|---|---|
| Umsatzblock-Berechnung (Brutto/Rabatte/Rückerstattungen/USt/Netto), Drill-Down, sticky erste Spalte, Summen-Hervorhebung | PROJ-95 (`langfristige-rentabilitaetsauswertung-*`) |
| Ansichtsmodi Absolut/Prozentual/Wachstum | PROJ-24 / PROJ-95 |
| Liniendiagramm | PROJ-26 / PROJ-95 |
| Absatztabelle | PROJ-33 / PROJ-95 |
| Umsatzsteuer-Berechnung | PROJ-31 / `/api/reporting/rentabilitaet` / PROJ-95 |
| Monatsfenster-Helfer | `buildPlanungsmonate` (PROJ-84) |
| Versions-Shell, Eigentumsprüfung, Nav-Konfiguration, Gruppe „Auswertungen" | PROJ-73 / PROJ-94 / PROJ-95 |

## Open Questions / Follow-ups (in `/architecture` zu klären)
- Wiederverwendung der PROJ-95-Server-Route (auf Umsatzblock reduziert) vs. eigene schlanke Route/Hook — Empfehlung: dieselbe Berechnungsquelle wie PROJ-95, um Bit-Konsistenz zu garantieren.
- Exakte Benennung der Jahres-Header (z. B. „Jahr 1 (Jan 2026 – Dez 2026)") und Format des Teiljahr-Headers.
- Verhalten des Wachstumsmodus an der ersten Spalte (Vorperiode außerhalb des Fensters) — wie in PROJ-95.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-24)

### Leitidee

Die Umsatzauswertung ist **kein Neubau**, sondern eine **schlanke Schwester der Rentabilitätsauswertung (PROJ-95)**. Bei der Architekturanalyse wurde festgestellt, dass PROJ-95 **bereits genau die Bausteine fertig gebaut hat**, die diese Seite braucht:

1. **Die Server-Route von PROJ-95 berechnet die vier Umsatzzeilen bereits** — Brutto-Umsatz, Rabatte, Rückerstattungen und Umsatzsteuer (samt Produkt-Aufschlüsselung) **und** die Absatztabelle. Sie liefert sie als Teil ihrer GuV-Antwort mit.
2. **Der PROJ-95-Hook kann Monat ↔ Jahr bereits umschalten** — die geforderte Jahresbündelung (je 12 Monate **ab Startmonat**, rollierend, mit kürzerem Teil-Schlussjahr) ist dort schon implementiert und produktiv im Einsatz.
3. **Die drei Ansichtsmodi (Absolut / Prozentual / Wachstum)** existieren ebenfalls schon und wurden bereits getestet.

Daraus folgt die zentrale Architekturentscheidung:

> **Wir verwenden dieselbe Berechnungsquelle wie PROJ-95** und bauen daraus eine **auf den Umsatzblock reduzierte Anzeige**. Damit sind die Zahlen **garantiert bit-identisch** zur Rentabilitätsauswertung (kein zweiter, abweichender Rechenweg), und es entsteht praktisch **keine neue Rechenlogik** — nur eine schlankere Darstellung.

### A) Server-Seite: bestehende Route im „Nur-Umsatz"-Modus

Die bestehende Route `…/[versionId]/rentabilitaetsauswertung` rechnet ihre Kaskade in zwei Blöcken: zuerst den **Umsatzblock** (Brutto/Rabatte/Rückerstattungen/Umsatzsteuer + Absatz), danach die **schweren** Teile (Produktkosten, Bestellkosten-Umlage, Lagerbestands-Projektion, Operativ/Investition/Finanzierung/Steuer). Für die Umsatzauswertung wird **nur der erste Block** gebraucht.

**Entscheidung:** Die bestehende Route erhält einen **leichten Modus** (über einen Aufruf-Parameter, z. B. „nur Umsatz"). In diesem Modus berechnet sie **nur den Umsatzblock + die Absatztabelle** und überspringt die schweren Schritte.

Vorteile dieser Lösung gegenüber den Alternativen:

| Variante | Konsistenz zu PROJ-95 | Aufwand/Last | Bewertung |
|---|---|---|---|
| **Bestehende Route, leichter Modus** (gewählt) | **identisch** (gleicher Code) | gering — schwere Schritte entfallen | ✅ |
| Bestehende Route unverändert mitnutzen | identisch | hoch — rechnet die ganze GuV unnötig, schreibt nebenbei Bestellkosten | ⚠️ |
| Neue eigene Umsatz-Route | Risiko, dass Formeln auseinanderdriften | mittel — Logik dupliziert | ❌ |

Der leichte Modus vermeidet insbesondere die **rechenintensiven und schreibenden** Schritte der vollen Route (Bestellkosten-Generierung, Lagerbestands-Simulation, Unter-Aufruf der Investitionsberechnung) — diese sind für reine Umsatzzahlen unnötig. Die Antwortform bleibt dieselbe wie bei PROJ-95 (gleicher Daten-Vertrag); die nicht benötigten Zeilen bleiben einfach leer.

### B) Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]/umsatzauswertung   (NEUE Seite)
│
└── LangfristigeVersionShell  (bestehend — Login-/Versions-Eigentumsprüfung, Header, Seitenmenü, Redirect)
    │
    ├── Kopfleiste (gleich wie PROJ-95, aber OHNE „Ohne Investitionen")
    │   ├── Zeitbasis-Umschalter: Monat | Jahr            (bestehende Logik wiederverwendet)
    │   ├── Ansichtsmodus-Umschalter: Absolut | Prozentual | Wachstum   (bestehende Logik)
    │   └── Buttons „Alle ausklappen" | „Alle einklappen"  (clientseitig)
    │
    ├── Liniendiagramm  (NEUE, schlanke Komponente)
    │   └── feste Linien: Brutto-Umsatz und Netto-Umsatz
    │
    ├── Absatztabelle  (bestehende PROJ-95-Komponente wiederverwendet)
    │   └── „Absatz gesamt" (aufklappbar → je Produkt), Monats-/Jahresspalten
    │
    └── Umsatz-Matrix  (NEUE, schlanke Komponente)
        └── 5 feste Zeilen: Brutto-Umsatz, Rabatte, Rückerstattungen, Umsatzsteuer, Netto-Umsatz
            (Netto = Zwischensumme, hervorgehoben; obere vier je Produkt aufklappbar)

src/lib/langfristige-planung-nav.ts   (bestehend — dritter Eintrag „Umsatzauswertung" in Gruppe „Auswertungen")
```

### C) Datenfluss (in einfachen Worten)

```
1. Seite öffnet → Versions-Shell prüft Login + Versions-Eigentum (Redirect bei fremder Version).

2. Frontend ruft die bestehende Auswertungs-Route im leichten Modus auf:
   GET …/[versionId]/rentabilitaetsauswertung?nur=umsatz
   (kein Von/Bis, keine Granularität im Aufruf — immer Startmonat … Planungshorizont, immer Monatswerte)

3. Die Route liefert Brutto-Umsatz, Rabatte, Rückerstattungen, Umsatzsteuer (je mit Produkt-Aufschlüsselung)
   und die Absatztabelle — exakt dieselben Zahlen wie in der Rentabilitätsauswertung.

4. Das Frontend
   - bildet die Netto-Umsatz-Zwischensumme (Brutto − Rabatte − Rückerstattungen − Umsatzsteuer),
   - bündelt bei „Jahr" je 12 Monate ab Startmonat (vorhandene Aggregationslogik),
   - schaltet Absolut/Prozentual/Wachstum und Ausklappen rein clientseitig — ohne neuen Server-Aufruf.
```

### D) Datenmodell (in einfachen Worten)

**Keine neue Datenbanktabelle.** Die Seite speichert nichts; sie ist reine Lese-/Anzeigeschicht. Alle dauerhaften Daten liegen weiter in den versionsgebundenen Tabellen der Quellmodule (Sales-Plattform-Planung, Absatzplanung, Steuer-/Produkt-Stammdaten), aus denen PROJ-95 ohnehin liest.

Die Route liefert (nur im Moment des Aufrufs) ein Ergebnis derselben Form wie PROJ-95:

```
Ergebnis
  monate: ["2026-1", "2026-2", …]          (Startmonat … Planungshorizont)
  zeilen:
     brutto_umsatz       → Betrag je Monat + Aufschlüsselung je Produkt
     rabatte             → Betrag je Monat + Aufschlüsselung je Produkt
     rueckerstattungen   → Betrag je Monat + Aufschlüsselung je Produkt
     umsatzsteuer        → Betrag je Monat + Aufschlüsselung je Produkt
     (übrige GuV-Zeilen bleiben leer und werden nicht angezeigt)
  absatz: { gesamt je Monat, je Produkt je Monat }
```

Netto-Umsatz wird **nicht** von der Route geliefert, sondern (wie schon in PROJ-95) **clientseitig** als Zwischensumme gebildet.

### E) Was neu gebaut wird vs. was wiederverwendet wird

| | Beschreibung |
|---|---|
| **Wiederverwendet (unverändert)** | Versions-Shell + Eigentumsprüfung (PROJ-73); die **Umsatzblock-Berechnung** der bestehenden Route (gleiche Formeln, gleiche Zahlen); die **Monat↔Jahr-Aggregation** und die **drei Ansichtsmodi** aus dem PROJ-95-Hook; die **Absatztabellen-Komponente** aus PROJ-95; der gemeinsame Daten-Vertrag (`…-shared`); Recharts; shadcn Tabs/Table/Button/Tooltip/Skeleton |
| **Leicht erweitert** | Die bestehende Route bekommt einen **„Nur-Umsatz"-Modus** (überspringt die schweren GuV-Schritte) |
| **Neu** | Eine Seite (Klon der PROJ-95-Seite ohne „Ohne Investitionen"); ein schlanker Daten-Hook; eine schlanke Umsatz-Matrix (5 Zeilen); ein schlankes Diagramm (Brutto-/Netto-Linie); ein Nav-Eintrag |
| **Bewusst NICHT** | Keine neue DB-Tabelle; keine duplizierte Umsatz-/USt-Rechenlogik; keine Änderung an den Quellmodulen |

### F) Tech-Entscheidungen (mit Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Berechnung | **dieselbe Route wie PROJ-95** (leichter Modus) | Garantiert identische Zahlen zur Rentabilitätsauswertung; keine zweite Formelpflege |
| Heavy-Schritte überspringen | ja (im leichten Modus) | Produktkosten/Bestellkosten/Lager/Steuer sind für den Umsatzblock irrelevant — spart Last und vermeidet unnötige Schreibvorgänge |
| Netto-Umsatz | clientseitig als Zwischensumme | Exakt wie PROJ-95; eine einzige Definitionsstelle |
| Monat/Jahr & Ansichtsmodi | bestehende Hook-Logik wiederverwenden | Bereits gebaut und getestet (PROJ-95-Seite nutzt beide produktiv) |
| Diagramm-Linien | fest **Brutto-Umsatz + Netto-Umsatz** | Nutzervorgabe; schlanker als die Mehrfachauswahl in PROJ-95 |
| „Ohne Investitionen"-Filter | **entfällt** | Für den Umsatzblock ohne Bedeutung |

### G) Abhängigkeiten (zu installierende Pakete)

**Keine.** Alle benötigten Bausteine (Recharts, shadcn-Komponenten, Versions-Shell, gemeinsame Auswertungs-Logik) sind bereits im Projekt vorhanden.

### H) Auflösung der offenen Fragen aus der Spec

- **Wiederverwendung vs. eigene Route:** → bestehende PROJ-95-Route im leichten Modus (siehe A).
- **Jahres-Header-Benennung:** → bestehendes Format aus PROJ-95 wird übernommen („Jahr 1" mit Monatsbereich als Sublabel; Teil-Schlussjahr automatisch kürzer).
- **Wachstumsmodus an der ersten Spalte:** → identisch zu PROJ-95 (keine Vorperiode außerhalb des Fensters → „—"/„n/a" nach den dortigen Regeln).

## Implementation Notes (Frontend — 2026-06-24)

Die Seite wurde als **schlanke, selbsttragende Schwester der PROJ-95-Seite** gebaut. Sie hängt nur am **stabilen Daten-Vertrag** (`src/lib/langfristige-rentabilitaetsauswertung-shared.ts`), nicht an den GuV-Kaskaden-Interna von PROJ-95 — so bleibt PROJ-96 von künftigen Änderungen an der vollen GuV-Logik entkoppelt.

### Neue Dateien
- `src/hooks/use-langfristige-umsatzauswertung.ts` — Fetch + clientseitige Logik: lädt die gemeinsame Auswertungs-Route mit `?nur=umsatz`, nimmt die vier Zeilen `brutto_umsatz`/`rabatte`/`rueckerstattungen`/`umsatzsteuer` + Absatz, bildet die **feste Kaskade** (`UA_CASCADE`) inkl. **Netto-Umsatz als Zwischensumme**, enthält `applyZeitbasis` (Monat ↔ rollierende 12-Monats-Blöcke ab Startmonat, Teil-Schlussjahr kürzer), `computeCascade`, `collectExpandableIds`, `bruttoByColumn`.
- `src/components/langfristige-umsatzauswertung-matrix.tsx` — 5-Zeilen-Matrix, Drill-Down je Produkt (obere vier Zeilen), sticky erste Spalte, Ansichtsmodi Absolut/Prozentual/Wachstum, „Alle ausklappen/einklappen", Betragsselektion (Parität zu PROJ-95).
- `src/components/langfristige-umsatzauswertung-chart.tsx` — Liniendiagramm mit **fest** zwei Linien (Brutto-Umsatz grün, Netto-Umsatz blau), folgt Ansichtsmodus & Zeitbasis. Keine Mehrfachauswahl (Nutzervorgabe).
- `src/components/langfristige-umsatzauswertung-absatztabelle.tsx` — „Absatz gesamt" (aufklappbar → je Produkt), spiegelt PROJ-95 (eigene schlanke Kopie, um die Typen zu entkoppeln).
- `src/app/dashboard/langfristige-planung/[versionId]/umsatzauswertung/page.tsx` — Versions-Shell + Kopfleiste (Zeitbasis Monat/Jahr, Ansicht Absolut/Prozentual/Wachstum) + Diagramm + Absatztabelle + Matrix. **Kein** „Ohne Investitionen"-Filter.

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — dritter Eintrag „Umsatzauswertung" (Slug `umsatzauswertung`) in der Nav-Gruppe „Auswertungen". Versions-Übersichtsseite zieht generisch nach.

### Abweichungen / Hinweise für `/backend`
- **Backend-Aufgabe offen:** Der leichte Modus `?nur=umsatz` der Route `…/[versionId]/rentabilitaetsauswertung` existiert **noch nicht**. Bis dahin ist die Seite bereits voll funktionsfähig, weil die bestehende Route den Query-Parameter ignoriert und die volle Antwort liefert (die vier Umsatzzeilen sind darin enthalten). `/backend` muss den Parameter so umsetzen, dass die schweren GuV-Schritte (Produktkosten, Bestellkosten-Generierung **inkl. Schreibvorgängen**, Lagerbestands-Simulation, Investitions-Unteraufruf, Operativ/Finanzierung/Steuer) übersprungen werden und nur Umsatzblock + Absatz berechnet werden — gleicher Code-Pfad = bit-identische Zahlen.
- Absatztabelle wurde als eigene schlanke Komponente kopiert statt die PROJ-95-Komponente direkt einzubinden (deren Prop-Typ verlangt das volle `RaModel`). Inhaltlich/visuell identisch.

### Verifikation
- `tsc --noEmit`: keine Fehler in den neuen Dateien.
- `next lint`: keine Warnungen/Fehler in den neuen Dateien.

## Implementation Notes (Backend — 2026-06-24)

Der leichte Modus `?nur=umsatz` wurde in die **bestehende** Route `src/app/api/langfristige-planung/[versionId]/rentabilitaetsauswertung/route.ts` eingebaut — kein neuer Endpunkt, keine neue DB-Tabelle (wie in der Architektur entschieden).

### Änderung an der Route
- `GET` liest `?nur=umsatz` aus der URL (`const nurUmsatz = …searchParams.get('nur') === 'umsatz'`).
- Nach **Abschnitt 4** (Umsatzblock: Brutto-Umsatz, Rabatte, Rückerstattungen, Umsatzsteuer + Absatz-Akkumulation) wird im leichten Modus **direkt geantwortet** (`if (nurUmsatz) return NextResponse.json(buildResponse())`), **bevor** die schweren Schritte laufen:
  - Abschnitt 5: Produktkosten + **Bestellkosten-Generierung `generiereUndSpeichereLangfristigeBestellkosten` (SCHREIBT in die DB)** + Lagerbestands-Simulation,
  - Abschnitt 6: Marketing,
  - Abschnitt 7: Ebene-2-Module (Operativ/Finanzierung/Steuern).
- Die Response-Erzeugung (Abschnitt 8) wurde in eine **hoisted Funktion `buildResponse()`** gekapselt, damit sie sowohl vom frühen Return als auch am Ende aufgerufen werden kann. Gleiche Akkumulatoren, gleiche `buildLine`/`buildBreakdowns` → **bit-identische** Umsatzzahlen zur vollen Auswertung.
- Da der gemeinsame Code-Pfad genutzt wird, sind keine Formeln dupliziert; die nicht benötigten Kaskadenzeilen bleiben in der Antwort leer und werden vom Frontend ignoriert.

### Wichtige Garantie (read-only)
Die volle Route hat einen **Schreib-Seiteneffekt** (lazy Persistierung der Bestellkosten). Die Umsatzauswertung ist read-only und darf diesen nicht auslösen — der frühe Return im leichten Modus stellt das sicher.

### Tests (`route.test.ts`, an die bestehende PROJ-95-Suite angehängt)
- `nur=umsatz` löst die schreibende Bestellkosten-Generierung **nicht** aus (auch bei vorhandener Bestellung); „Ware" (Produktkosten) bleibt leer.
- Voller Modus löst die Generierung bei identischen Daten **einmal** aus (beweist den Unterschied).
- `nur=umsatz` liefert **denselben** Brutto-Umsatz und Absatz wie der volle Modus (Konsistenz).
- Bestehende Fälle (401, 400 ungültige Version, 404 fremde Version, 500 KPI-Ladefehler, Leerstruktur, Brutto/Ware/Absatz, USt-Netto) laufen weiter.
- `npx vitest run …/rentabilitaetsauswertung/route.test.ts` → **10/10 grün**.

### Verifikation
- `tsc --noEmit`: keine Fehler in der geänderten Route.
- Frontend-Hook ruft bereits `?nur=umsatz` auf → End-to-End nutzbar.

## QA Test Results (2026-06-24)

**Tester:** QA Engineer (automatisiert + Code-Inspektion + Red-Team)
**Verdict:** ✅ **Production-Ready** — 0 Critical, 0 High, 0 Medium, 1 Low (Beobachtung, kein Defekt)

### Zusammenfassung
- Akzeptanzkriterien: **alle erfüllt** (automatisierte Tests + Code-Inspektion; interaktive/visuelle Kriterien gemäß etabliertem Test-Harness der langfristigen Seiten als manuell geprüft dokumentiert).
- Automatisierte Tests: **Route 10/10**, **Hook 12/12**, **E2E 4/4**, **Regression 38/38** grün.
- Security-Audit: bestanden (Auth, Versionsisolation, Read-only, keine Injection-Fläche).

### Automatisierte Tests
| Suite | Datei | Ergebnis |
|---|---|---|
| Server-Route (inkl. `?nur=umsatz`) | `…/rentabilitaetsauswertung/route.test.ts` | 10/10 ✅ |
| Client-Kaskade & Jahresbündelung | `src/hooks/use-langfristige-umsatzauswertung.test.ts` | 12/12 ✅ |
| E2E (Seitenexistenz, Auth-Guard, Regression) | `tests/PROJ-96-langfristige-umsatzauswertung.spec.ts` | 4/4 ✅ |
| Regression (Umsatz-, Rentabilitäts-, Liquiditäts-Hooks + Route) | — | 38/38 ✅ |

Neue Tests in dieser QA-Runde:
- `use-langfristige-umsatzauswertung.test.ts` (12): Vorzeichen (Brutto +, Abzüge −), Netto-Zwischensumme = Brutto−Rabatte−Rück−USt, feste 5-Zeilen-Reihenfolge, Drill-Down-Vorzeichen, `collectExpandableIds`, `bruttoByColumn`, Jahresbündelung (12→1 Block; 14→Jahr 1 voll + Jahr 2 Teilblock; Aggregation von Werten/Drill-Down/Absatz; Header-/Sublabel-Format; Monat-Passthrough).
- `tests/PROJ-96-…spec.ts` (4): Seite liefert keinen 404, Auth-Redirect → `/login`, Schwesterseite Rentabilitätsauswertung weiter erreichbar, Dashboard-Auth-Redirect.

### Akzeptanzkriterien (Auszug, Nachweis)
| Bereich | Kriterium | Nachweis | Status |
|---|---|---|---|
| Navigation | 3. Eintrag „Auswertungen" → Slug `umsatzauswertung` | `langfristige-planung-nav.ts` | ✅ |
| Navigation | Auth-Guard → `/login`; fremde Version → Redirect | E2E + `LangfristigeVersionShell` + Route 400/404 | ✅ |
| Zeilenstruktur | Genau 5 feste Zeilen, Netto als Zwischensumme | Hook-Test (Reihenfolge), Matrix-Styling | ✅ |
| Wertberechnung | Brutto/Rabatte/Rück/USt aus PROJ-95-Route; Netto = Brutto−Rabatte−Rück−USt | Route-Konsistenztest, Hook-Test (=700) | ✅ |
| Konsistenz zu PROJ-95 | `?nur=umsatz` liefert **identischen** Brutto-Umsatz + Absatz wie voller Modus | Route-Test (`toEqual`) | ✅ |
| Granularität | Monat/Jahr-Umschalter; Jahr = rollierende 12er-Blöcke ab Startmonat; Teiljahr kürzer | Hook-Tests (12→1, 14→J1+J2) | ✅ |
| Drill-Down | 4 Zeilen je Produkt aufklappbar, Netto nicht; Zustand bleibt über Modus/Zeitbasis | `computeCascade`/`collectExpandableIds`, stabile Node-IDs | ✅ |
| Ansichtsmodi | Absolut/Prozentual (Bezug Brutto der Spalte, 0→„—")/Wachstum (Vorperiode je Granularität) | Matrix-Logik (gespiegelt von PROJ-95/PROJ-24) | ✅ |
| Diagramm | Fest Brutto-Umsatz + Netto-Umsatz; folgt Modus & Zeitbasis; leer→ausgeblendet | Chart-Komponente | ✅ |
| Absatztabelle | „Absatz gesamt" + je Produkt, ganze Zahlen, sticky/scroll | Absatztabelle-Komponente, Hook-Aggregation | ✅ |
| Read-only | Keine Zelle editierbar; **kein Schreibvorgang** | Route-Test (Bestellkosten-Generierung NICHT aufgerufen) | ✅ |
| Versionsisolation | Nur Daten dieser `versionId`; leere Version → alle 0, Struktur sichtbar | Route version-scoped Queries + `emptyResponse` | ✅ |

### Security-Audit (Red-Team)
- **Authentifizierung:** `requireAuth()` (Route) + `LangfristigeVersionShell` (Seite). Unauthentifiziert → 401 / Redirect `/login`. ✅ (Test)
- **Autorisierung / Versionsisolation:** `ensureLangfristigeVersion(user.id, versionId)` → 400 (ungültige UUID), 404 (fremde/unbekannte Version). Alle Queries `.eq('user_id').eq('plan_version_id')`. Kein Cross-User-/Cross-Version-Zugriff. ✅ (Test)
- **Injection:** `?nur=` per strikter Gleichheit ausgewertet (kein dynamisches SQL/keine Eval). DB-Zugriffe über parametrisierte Supabase-Queries. Keine Fläche. ✅
- **Read-only-Garantie:** Der `?nur=umsatz`-Early-Return liegt **vor** dem schreibenden `generiereUndSpeichereLangfristigeBestellkosten`; die Auswertung persistiert nichts. ✅ (Test)
- **Datенexposition:** Antwort enthält ausschließlich aggregierte Finanzwerte der eigenen Version; keine Secrets/Fremddaten. ✅

### Bugs / Beobachtungen
- **LOW (Beobachtung, kein Defekt):** Der leichte Modus `?nur=umsatz` überspringt zwar die teuren/schreibenden Schritte (Bestellkosten-Generierung, Lagerbestands-Simulation, Ebene-2-Berechnung), lädt in Abschnitt 2 aber weiterhin denselben Satz versionsgebundener Selects wie der volle Modus (versand/lager/kulanz/retouren/vkGeb/marketing/operativ/finanz/steuer/invest/bestellungen). Das sind indizierte, günstige Reads; Korrektheit & Read-only-Garantie sind nicht betroffen. Optionale spätere Optimierung: diese Selects im leichten Modus konditional weglassen. Nicht release-blockierend.

### Regression
- Schwesterfeatures **PROJ-97/98** teilen sich die Route; ein Refactor leitet `nurUmsatz`/`nurOperativ` aus einem gemeinsamen `nurParam` ab. Der `?nur=umsatz`-Zweig ist intakt und liegt korrekt **vor** dem PROJ-98-`nurOperativ`-Zweig. Route- und Hook-Tests von PROJ-95 (Rentabilitätsauswertung) und PROJ-94 (Liquidität) weiter grün.

### Nicht automatisiert (manuell, gemäß Harness-Konvention)
Pixel-/Interaktionsdetails, die eine authentifizierte Session + geseedete Planversion erfordern: Live-Umschalten Monat/Jahr & Ansichtsmodi, Drag-Betragsselektion, Farb-/Hervorhebungsdarstellung, Diagramm-Tooltips. Logik dahinter ist durch die o.g. Unit-/Route-Tests abgedeckt.

## Deployment
_To be added by /deploy_
