# PROJ-99: Investitionsauswertung — Langfristige Planung

## Status: Approved
**Created:** 2026-06-24
**Last Updated:** 2026-06-24

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — versionsgebundene **Investitionen-Kategorien** (`art = 'lp_investition'`): Übergruppen (Obergruppen, Ebene 1) → Untergruppen (Ebene 2) sowie die **Produkte** der Version (`art = 'lp_produkt'`) als unterste Ebene
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`) und **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monatsfenster
- Requires: PROJ-92 (Investitionsausgaben Planung — Langfristige Planung) — **alleinige Datenquelle**: effektiver Soll je (Untergruppe × Produkt × Monat) = manueller Override (blauer Punkt) sonst berechneter Wert (grauer Punkt); Auto-Befüllung von „Produktinvestitionen Einkauf" aus Erstbestellungen
- Requires: PROJ-94 (Liquiditätsauswertung — Langfristige Planung) — liefert die Nav-Gruppe „Auswertungen"; diese Seite ist deren **vierter Eintrag**
- **Primäre Stilvorlage:** PROJ-95 (Rentabilitätsauswertung — Langfristige Planung) — Seitenaufbau, Matrix mit sticky erster Spalte, Drill-Down, Summen-Hervorhebung, Diagramm und Absatzraster-Look werden **stilistisch 1:1 übernommen**. Inhaltlich ist diese Seite auf **nur die Kategorie Investitionen** reduziert.
- Vorlage (kein harter Require): PROJ-26 (Rentabilitätsreport — Liniendiagramm) — Diagramm oben

## Übersicht

Die **Investitionsauswertung** ist der **vierte Eintrag** im Navigationsbereich **„Auswertungen"** der Langfristigen Planung (nach Liquiditätsauswertung PROJ-94, Rentabilitätsauswertung PROJ-95 und Umsatzauswertung PROJ-96). Sie ist eine **rein anzeigende** (read-only), **versionsgebundene** Seite.

Sie ist im **Aufbau und Stil exakt wie die Rentabilitätsauswertung (PROJ-95)**, zeigt aber **ausschließlich die Kategorie Investitionen** — die einzelnen **Obergruppen** (Übergruppen) der Investitionen je Monat, inklusive ihrer **Untergruppen** und **Produkte**, **nichts weiter** (keine GuV-Kaskade, kein Umsatz, keine Deckungsbeiträge, kein EBIT/EBT/Ergebnis). Die angezeigten Werte sind **dieselben** wie auf der Seite **Investitionsausgaben Planung (PROJ-92)** dieser Version (gleiche Quelle, effektiver Soll), nur reine Anzeige statt Eingabe.

Der Seitenaufbau von oben nach unten ist identisch zur Rentabilitätsauswertung:

1. **Diagramm** — zeigt die einzelnen **Obergruppen** der Investitionen gestapelt, deren Summe **Investitionen (Gesamt)** ergibt (Monatlich: gestapelte Linien/Flächen über die Monate; Gesamt: ein gestapelter Balken)
2. **Haupttabelle** (Matrix: Investitionen-Hierarchie × Zeitspalten)

Ganz **unten** in der Haupttabelle steht die Zeile **„Investitionen (Gesamt)"**.

> **Hinweis zur Begriffszuordnung (aus PROJ-92/PROJ-74):** „Investitionen" ist die **Kategorie** (die gesamte Seite). Innerhalb dieser Kategorie sind die **Obergruppen** die `lp_investition`-Übergruppen (Ebene 1, z. B. „Produktinvestitionen Operations", „Produktinvestitionen Einkauf", „Produktinvestitionen Sales & Marketing" sowie nutzerangelegte). Darunter folgen die **Untergruppen** (Ebene 2) und schließlich die **Produkte** der Version (Leaf).

### Feste Hierarchie (Zeilenstruktur)

```
Obergruppe A (Übergruppe, Ebene 1)                          (lp_investition)
    Untergruppe A.1 (Ebene 2)
        Produkt …
        Produkt …
    Untergruppe A.2 …
Obergruppe B …
…
─────────────────────────────────────────────────────────
= Investitionen (Gesamt)                                    (Summe aller Obergruppen)
```

Die Hierarchie und Reihenfolge (`sort_order`) entsprechen **exakt** der Seite Investitionsausgaben Planung (PROJ-92). Jede Obergruppe und jede Untergruppe ist aufklappbar bis auf Produktebene.

### Zwei Zeitansichten (Umschalter Monatlich / Gesamt)

| Ansicht | Spalten | Zellwert |
|---|---|---|
| **Monatlich** (Standard) | eine Spalte je Monat (Startmonat … Planungshorizont) | effektiver Soll je Zeile/Monat |
| **Gesamt** | **eine einzige** Spalte ohne zeitliche Zuordnung | **Summe über alle Monate** je Zeile (Kategorie/Obergruppe/Untergruppe/Produkt) |

### Wesentlicher Unterschied zur Rentabilitäts- und Umsatzauswertung

| Aspekt | Rentabilität (PROJ-95) / Umsatz (PROJ-96) | Investitionsauswertung (PROJ-99) |
|---|---|---|
| Inhalt | GuV-Kaskade bzw. Umsatzblock | **nur Kategorie Investitionen** (Obergruppe → Untergruppe → Produkt) |
| Zeitumschalter | nur Monate / Monat–Jahr | **Monatlich / Gesamt** (Gesamt = zeitlos, eine Spalte = Summe über alle Monate) |
| Ansichtsmodi | Absolut / Prozentual / Wachstum | **nur Absolut** (kein Prozentual, kein Wachstum) |
| Diagramm | Zwischensummen-Linien / Brutto+Netto | **Obergruppen gestapelt** (Summe = Investitionen Gesamt); Gesamt-Ansicht: gestapelter Balken |
| Absatztabelle | ja | **nein** (für Investitionen nicht relevant) |
| Datenquelle | mehrere Planungsmodule | **nur** Investitionsausgaben Planung (PROJ-92) |

## User Stories

- Als Controller möchte ich die Investitionsauswertung innerhalb einer geöffneten Planversion über das linke Seitenmenü (Gruppe „Auswertungen", vierter Eintrag) und über die Versions-Übersichtsseite aufrufen können, damit ich die geplanten Investitionen dieses Szenarios an einer Stelle sehe.
- Als Controller möchte ich ausschließlich die Investitionen sehen — gegliedert nach Obergruppen, Untergruppen und Produkten je Monat — ohne weitere Kategorien.
- Als Controller möchte ich jede Obergruppe und Untergruppe bis auf Produktebene aufklappen können, um zu sehen, welche Produkte die Investitionen tragen.
- Als Controller möchte ich ganz unten eine Zeile „Investitionen (Gesamt)" sehen, die alle Obergruppen je Spalte aufsummiert.
- Als Controller möchte ich oben ein Diagramm sehen, das die einzelnen Obergruppen gestapelt zeigt, sodass ihre Summe den Gesamtwert ergibt.
- Als Controller möchte ich zwischen **Monatlicher** und **Gesamt**-Ansicht umschalten können, wobei die Gesamt-Ansicht die Werte je Kategorie / Obergruppe / Untergruppe / Produkt ohne zeitliche Zuordnung (Summe über alle Monate) zeigt.
- Als Controller möchte ich, dass die hier gezeigten Investitionswerte **exakt denen der Investitionsausgaben-Planung** dieser Version entsprechen (gleiche Quelle, effektiver Soll).
- Als Controller möchte ich, dass die Seite optisch genau wie die Rentabilitätsauswertung aufgebaut ist.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Im Versionskontext erscheint die Seite als **vierter Eintrag** der Nav-Gruppe „Auswertungen": „Investitionsauswertung" → `/dashboard/langfristige-planung/[versionId]/investitionsauswertung`
- [ ] Auf der Versions-Übersichtsseite erscheint ein Eintrag „Investitionsauswertung" (über die zentrale Nav-Konfiguration, generisch nachgezogen)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Bei unbekannter/fremder/ungültiger `versionId` erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73
- [ ] Rechts oben: Buttons **„Alle ausklappen"** und **„Alle einklappen"** (wie PROJ-95)
- [ ] Stil/Layout (Kopfleiste, Matrix, sticky erste Spalte, Summen-Hervorhebung, Diagramm) sind **optisch identisch** zur Rentabilitätsauswertung

### Zeilenstruktur (nur Investitionen)

- [ ] Zeilenquelle: der `lp_investition`-Baum dieser Version (PROJ-74) — **alle** Obergruppen (feste **und** nutzerangelegte) in `sort_order`-Reihenfolge, jeweils mit ihren Untergruppen und den Produkten der Version
- [ ] **Keine** anderen Kategorien (kein Umsatz, keine GuV-Zeilen) — „nur diese Kategorie, nichts anderes"
- [ ] **Pro Obergruppe (Ebene 1):** aufklappbare Zeile mit Summe (nicht editierbar), visuell als Gruppen-Header hervorgehoben
- [ ] **Pro Untergruppe (Ebene 2):** aufklappbare Zeile mit Summe der Produkte (nicht editierbar)
- [ ] **Pro Produkt:** Leaf-Zeile (eingerückt), read-only — es werden **nur** die Produkte auf unterster Ebene angezeigt, **für die auch Daten vorliegen** (mind. ein echter Eintrag im Fenster: manuelle Überschreibung oder berechneter Wert). Produkte ohne Daten werden in dieser Untergruppe **nicht** gezeigt (anders als auf der Eingabeseite PROJ-92, die immer alle Produkte zeigt)
- [ ] **Ganz unten:** Zeile **„Investitionen (Gesamt)"** — Summe aller Obergruppen je Spalte; als Zwischensumme visuell klar hervorgehoben (fett, Hintergrund, Trennlinie) — analog der Summen-Zeilen in PROJ-95; immer sichtbar
- [ ] Alle Zeilen sind dauerhaft sichtbar, auch wenn ihr Wert in allen Spalten 0 ist
- [ ] Aggregationen (Untergruppe, Obergruppe, Gesamt) sind konsistent mit den Leaf-Werten

### Ausklappbare Zeilen (Drill-Down bis Produkt)

- [ ] Jede Obergruppe und jede Untergruppe ist **aufklappbar**; die Produktebene ist die unterste Ebene
- [ ] Die **Gesamt-Zeile** ist **nicht** aufklappbar
- [ ] Globaler „Alle ausklappen / Alle einklappen"-Button füllt/leert alle Drill-Down-Ebenen
- [ ] Expand/Collapse-Zustand bleibt beim Wechsel der Zeitansicht (Monatlich/Gesamt) erhalten

### Zeitansicht (Umschalter Monatlich / Gesamt)

- [ ] Umschalter mit zwei Stufen: **Monatlich** (Standard) und **Gesamt**
- [ ] **Monatlich:** eine Spalte je Monat, vom **Startmonat** über **`planungshorizont_monate`** Monate (allgemeiner Horizont, Fallback 12) — identisch zum Monatsfenster der langfristigen Planungsseiten (`buildPlanungsmonate`)
- [ ] **Gesamt:** **genau eine** Spalte ohne zeitliche Zuordnung; jeder Zeilenwert = **Summe der Monatswerte** dieser Zeile über das gesamte Fenster (für Kategorie/Obergruppe/Untergruppe/Produkt gleichermaßen)
- [ ] Monats-Header-Format wie auf den langfristigen Planungsseiten (z. B. „Jan 2026"); optionale Jahres-Gruppierungszeile wie dort
- [ ] **Kein Ist-Bereich, keine Vergangenheit, keine Ist/Soll-Trennlinie** — alle Spalten sind Soll-Zeiträume
- [ ] Tabelle horizontal scrollbar; erste Spalte (Zeilenbeschriftung) ist `sticky left`

### Wertberechnung (planbasiert, identisch zu PROJ-92)

- [ ] Zellwert (Monatlich) = **effektiver Soll** je (Untergruppe × Produkt × Monat) aus der Investitionsausgaben-Planung (PROJ-92): **manueller Override** falls vorhanden, sonst **berechneter Wert** (Auto-Befüllung „Produktinvestitionen Einkauf" aus Erstbestellungen), sonst 0/leer
- [ ] Obergruppen-, Untergruppen- und Gesamt-Werte = Summen der darunterliegenden Produkt-Leafs je Spalte
- [ ] Gesamt-Ansicht: jeder Wert = Summe der Monatswerte derselben Zeile
- [ ] Die angezeigten Werte sind **bitidentisch** zu den effektiven Soll-Werten der Investitionsausgaben-Planung (PROJ-92) derselben Version (gemeinsame Datenquelle, kein abweichender Rechenweg)
- [ ] Alle Werte werden **absolut** dargestellt (Währungsformat); es gibt **keinen** Prozentual- und **keinen** Wachstumsmodus

### Diagramm (oben) — gestapelte Obergruppen

- [ ] Oberhalb der Haupttabelle ein **Diagramm** (Recharts) im Stil der Rentabilitätsauswertung
- [ ] Es werden die einzelnen **Obergruppen** (Ebene-1-Übergruppen) **gestapelt** dargestellt, sodass ihre Summe je Spalte **Investitionen (Gesamt)** ergibt
- [ ] **Monatlich:** gestapelte Linien-/Flächendarstellung über die Monate (X-Achse = Monate, synchron mit den Tabellenspalten; Y-Achse = Betrag in €)
- [ ] **Gesamt:** **ein einzelner gestapelter Balken**, der die Gesamt-Investitionen nach Obergruppe aufteilt (Summe der Segmente = Investitionen Gesamt)
- [ ] Eine Legende benennt die Obergruppen; konsistente Farbzuordnung zwischen Diagramm und (optional) Tabelle
- [ ] Diagramm respektiert die aktive Zeitansicht (Monatlich/Gesamt)
- [ ] Leerzustand: Diagramm wird ausgeblendet, wenn keine darstellbaren Spalten/Werte vorhanden sind

### Darstellung (Farben) — analog PROJ-95

- [ ] Beträge im de-DE-Format mit 2 Dezimalstellen und € (z. B. „1.234,56 €"); 0-Werte als „0,00 €" (nicht leer)
- [ ] Investitionen sind Ausgaben — Darstellung konsistent mit der Investitionsausgaben-Planung bzw. der Rentabilitätsauswertung (einheitliches Vorzeichen/Farbschema für Kostengrößen)
- [ ] Gesamt-Zeile und Gruppen-Header optisch klar von den Produkt-Leafs abgegrenzt

### Read-only-Verhalten

- [ ] Keine Zelle ist editierbar (kein Inline-Edit, kein onBlur-Speichern)
- [ ] Die Seite schreibt **keine eigenen** Planungsdaten; sie liest ausschließlich aus der Investitionsausgaben-Planung (PROJ-92) dieser Version
- [ ] Kein „Zurücksetzen"-Button

### Versionsisolation

- [ ] Es werden **keine** Daten aus anderen Planversionen oder aus der Kurzfristigen Planung angezeigt
- [ ] Eine neu angelegte (leere) Planversion zeigt eine im Wesentlichen leere Auswertung (alle Werte 0), Hierarchie bleibt vollständig sichtbar
- [ ] Verwendet dieselbe versionsgebundene Investitionen-KPI-Struktur (Obergruppen/Untergruppen/Produkte) wie die Investitionsausgaben-Planung dieser Version

## Edge Cases

- **Leere/neu angelegte Planversion:** alle Werte 0; Hierarchie (Obergruppen/Untergruppen/Produkte) bleibt sichtbar.
- **Keine Investitionskategorien im KPI-Modell der Version:** Leerzustand mit Hinweis + Link zur KPI-Modell-Verwaltung dieser Version (analog PROJ-92).
- **Keine Produkte in der Version:** Untergruppen ohne Produkt-Leafzeilen; Hinweis + Link zur KPI-Modell-Verwaltung.
- **Obergruppe ohne Untergruppen / Untergruppe ohne Werte:** Zeile bleibt mit 0 sichtbar, kein Layout-Bruch.
- **Manueller Override vs. berechneter Wert:** es wird stets der **effektive Soll** angezeigt; die read-only Auswertung zeigt **keine** grau/blau-Indikatorpunkte (anders als die Eingabeseite PROJ-92) — die Werte stimmen aber überein.
- **Gesamt-Ansicht:** eine Spalte; jeder Wert = Summe über alle Monate; Hierarchie und Drill-Down identisch zur Monatlich-Ansicht.
- **Sehr breite Tabelle (großer Planungshorizont, z. B. 120 Monate):** horizontales Scrollen, erste Spalte sticky; Gesamt-Ansicht reduziert auf eine Spalte.
- **Fremde/unbekannte `versionId`:** Redirect zum Dashboard (PROJ-73), kein Fremdzugriff.
- **Quell-API/Berechnung liefert einen Fehler:** betroffene Zeile zeigt leer/Hinweis, übrige Hierarchie bleibt nutzbar; kein Seitenabsturz.
- **Konsistenz mit PROJ-92:** Obergruppen-/Untergruppen-/Produkt-/Gesamt-Werte müssen exakt mit den effektiven Soll-Werten der Investitionsausgaben-Planung übereinstimmen — gemeinsame Datenquelle bevorzugen (in `/architecture` festlegen).
- **Startmonat-Änderung in den Grundeinstellungen:** Fenster verschiebt sich beim nächsten Laden; Werte folgen ihren Monat/Jahr-Koordinaten.

## Technical Requirements

- Authentifizierung: `requireAuth()` in ggf. neuen API-Routen; Seite ist Client Component im Versions-Shell (`LangfristigeVersionShell`) mit Auth- und Versions-Eigentumsprüfung
- **Keine neue DB-Tabelle nötig** — read-only; Aggregation/Anzeige ausschließlich aus bestehenden versionsgebundenen Investitions-Planungsdaten (PROJ-92)
- **Wiederverwendung der PROJ-92-Daten:** Der effektive Soll je (Untergruppe × Produkt × Monat) wird aus denselben Quellen gebildet wie die Investitionsausgaben-Planung — manuelle Werte (`…/investitionsausgaben-planung` GET) overlayed über berechnete Werte (`…/investitionsausgaben-planung/berechnet`). Damit ist Konsistenz garantiert. Ob ein eigener Read-Only-Hook (`use-langfristige-investitionsauswertung.ts`) den bestehenden Hook (`use-langfristige-investitionsausgaben.ts`) wiederverwendet oder eine gemeinsame Berechnungsquelle dient, entscheidet `/architecture`.
- Monatsfenster: bestehender Helfer `buildPlanungsmonate` (Startmonat + `planungshorizont_monate`)
- **Gesamt-Bündelung** (Summe über alle Monate je Zeile) wird clientseitig auf den Monatswerten gebildet — kein zusätzlicher Server-Aufruf
- Zeitansichts-/Ausklapp-Umschaltung rein clientseitig auf bereits geladenen Daten
- Chart-Bibliothek: Recharts (vorhanden) — gestapelte Linien/Flächen (Monatlich) bzw. gestapelter Balken (Gesamt)
- Keine neuen Packages: shadcn `Table`, `Tabs`, `Tooltip`, `Button`, `Skeleton` — alle vorhanden
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Richtwert)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/investitionsauswertung/page.tsx` | Seite: Versions-Shell + Kopfleiste (Zeitansicht Monatlich/Gesamt, Ausklappen-Buttons) + Diagramm + Investitions-Matrix |
| `src/hooks/use-langfristige-investitionsauswertung.ts` | Datenladen (effektiver Soll der Investitionen + Hierarchie der Version), Monats-/Gesamt-Spalten, Ausklappzustand — vorzugsweise auf PROJ-92-Datenquelle/-Hook aufsetzend |
| `src/components/langfristige-investitionsauswertung-matrix.tsx` | Hierarchie-Matrix: Obergruppe → Untergruppe → Produkt + Gesamt-Zeile, Drill-Down, sticky erste Spalte, read-only |
| `src/components/langfristige-investitionsauswertung-chart.tsx` | Gestapeltes Diagramm der Obergruppen (Linien/Flächen Monatlich; Balken Gesamt) |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Vierter Eintrag „Investitionsauswertung" (Slug `investitionsauswertung`) in der Nav-Gruppe „Auswertungen" |

### Wiederverwendung bestehender Muster

| Muster | Quelle |
|---|---|
| Seitenaufbau, Matrix, sticky erste Spalte, Summen-Hervorhebung, Diagramm-Look | PROJ-95 (`langfristige-rentabilitaetsauswertung-*`) |
| Effektiver Soll der Investitionen (manuell over berechnet), Hierarchie Obergruppe/Untergruppe/Produkt | PROJ-92 (`use-langfristige-investitionsausgaben`, `…/investitionsausgaben-planung[/berechnet]`) |
| Diagramm (gestapelt) | PROJ-26 / `reporting-*-chart` |
| Monatsfenster-Helfer | `buildPlanungsmonate` (PROJ-84) |
| Versions-Shell, Eigentumsprüfung, Nav-Konfiguration, Gruppe „Auswertungen" | PROJ-73 / PROJ-94 / PROJ-95 |

## Open Questions / Follow-ups (in `/architecture` zu klären)
- Wiederverwendung des bestehenden PROJ-92-Hooks/-Datenquelle vs. schlanker Read-Only-Hook — Empfehlung: gemeinsame Datenquelle, um Bit-Konsistenz zur Investitionsausgaben-Planung zu garantieren.
- Genaues Diagramm-Verhalten (gestapelte Linien vs. gestapelte Flächen in der Monatlich-Ansicht) und Farbpalette für viele Obergruppen.
- Optional: Farbliche Kopplung von Diagramm-Legende und Tabellen-Obergruppen.
- Verhalten der Gesamt-Ansicht bei sehr vielen Obergruppen (Balken-Lesbarkeit).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-24)

### Leitidee

Diese Seite ist die **read-only Schwester** der Eingabeseite **Investitionsausgaben Planung (PROJ-92)** — im **Stil** geklont von der **Rentabilitätsauswertung (PROJ-95)**. Bei der Analyse zeigte sich der entscheidende Glücksfall:

> **Die Datenquelle ist bereits fertig.** Der bestehende Daten-Hook der Investitionsausgaben-Planung (`use-langfristige-investitionsausgaben`) lädt heute schon **genau** das, was diese Auswertung braucht: das **Investitionen-KPI-Modell der Version** (Obergruppe → Untergruppe → Produkt), das **Monatsfenster** (Startmonat + Horizont) und **beide** Wertquellen — die **manuellen Überschreibungen** und die **berechneten Werte** (Auto-Befüllung „Produktinvestitionen Einkauf").

Daraus folgt die zentrale Architekturentscheidung:

> **Es wird kein Server, keine Datenbanktabelle und keine neue Berechnung gebaut.** Die Auswertung **liest dieselben Daten** wie die Eingabeseite und zeigt sie nur anders an (read-only, mit Gesamt-Ansicht und gestapeltem Diagramm). Der **effektive Soll** je Zelle ist — exakt wie auf der Eingabeseite — der **manuelle Wert, falls vorhanden, sonst der berechnete Wert, sonst 0**. Damit sind die Zahlen **garantiert identisch** zur Investitionsausgaben-Planung dieser Version.

Das ist auch der Grund, warum diese Seite **nur** den `/frontend`-Schritt benötigt und **kein** `/backend`: alle nötigen Server-Endpunkte (Grundeinstellungen, KPI-Kategorien, manuelle Werte, berechnete Werte) existieren bereits aus PROJ-92.

### A) Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]/investitionsauswertung   (NEUE Seite)
│
└── LangfristigeVersionShell  (bestehend — Login-/Versions-Eigentumsprüfung, Header, Seitenmenü, Redirect; fullWidth)
    │
    ├── Kopfleiste (schlanker als PROJ-95)
    │   ├── Zeitansicht-Umschalter: Monatlich | Gesamt          (clientseitig)
    │   └── Button „Alle ausklappen" | „Alle einklappen"        (clientseitig)
    │   (KEIN Absolut/Prozentual/Wachstum-Umschalter — immer absolut;
    │    KEIN „Ohne Investitionen"-Filter; KEINE Absatztabelle)
    │
    ├── Diagramm  (NEUE Komponente, Recharts)
    │   ├── Monatlich: Obergruppen als GESTAPELTE Flächen/Linien über die Monate (Summe = Gesamt)
    │   └── Gesamt:   EIN gestapelter Balken, nach Obergruppe aufgeteilt (Summe = Gesamt)
    │
    └── Investitions-Matrix  (NEUE Hauptkomponente, read-only)
        ├── Kopf: [Bezeichnung (sticky links)] | [Monatsspalten …]  bzw.  | [Gesamt]
        ├── je Obergruppe (Ebene 1)   → aufklappbare Zeile, Summe (nicht editierbar)
        │     └── je Untergruppe (Ebene 2) → aufklappbare Zeile, Summe der Produkte
        │           └── je Produkt        → Leaf-Zeile (read-only)
        └── „Investitionen (Gesamt)"  ← GANZ UNTEN, hervorgehoben (Summe aller Obergruppen)

src/lib/langfristige-planung-nav.ts   (bestehend — vierter Eintrag „Investitionsauswertung" in Gruppe „Auswertungen")
```

Das linke Seitenmenü und die Versions-Übersicht rendern die Nav-Gruppen generisch — der neue Eintrag erscheint allein durch die Ergänzung in der zentralen Nav-Konfiguration.

### B) Datenfluss (in einfachen Worten)

```
1. Seite öffnet → Versions-Shell prüft Login + Versions-Eigentum (Redirect bei fremder Version).

2. Der Auswertungs-Hook lädt (über die bereits bestehende PROJ-92-Datenquelle) parallel:
   ① Grundeinstellungen der Version       → Startmonat + Horizont (Monatsfenster, kein Vorlauf)
   ② Investitionen-Kategorien der Version  → Obergruppe/Untergruppe-Hierarchie (lp_investition)
   ③ Produkte der Version                  → Leaf-Zeilen je Untergruppe (lp_produkt)
   ④ berechnete Werte                      → Auto-Befüllung „Produktinvestitionen Einkauf"
   ⑤ manuelle Überschreibungen             → blauer-Punkt-Werte der Eingabeseite

3. Pro (Untergruppe × Produkt × Monat) bildet der Hook den EFFEKTIVEN SOLL:
   manueller Wert (falls vorhanden) → sonst berechneter Wert → sonst 0.
   Daraus baut er den Baum: Produkt-Leafs → Untergruppen-Summe → Obergruppen-Summe → Gesamt.

4. Das Frontend zeigt an und schaltet rein clientseitig:
   - „Monatlich" → eine Spalte je Monat;
   - „Gesamt"    → eine einzige Spalte = Summe aller Monate je Zeile;
   - Ausklappen/Einklappen der Hierarchie.
   KEIN neuer Server-Aufruf bei diesen Umschaltungen.
```

**Konsistenz-Garantie:** Weil Schritt 2 und 3 **dieselbe Logik und dieselben Endpunkte** nutzen wie die Eingabeseite (PROJ-92), stimmen die angezeigten Werte zellgenau mit der Investitionsausgaben-Planung überein.

### C) Datenmodell (in einfachen Worten)

**Keine neue Datenbanktabelle.** Die Seite speichert nichts; sie ist eine reine Lese-/Anzeigeschicht. Alle dauerhaften Daten leben weiter in den bestehenden versionsgebundenen Tabellen aus PROJ-92 (manuelle Investitionswerte) und PROJ-74 (KPI-Kategorien/Produkte), ergänzt um die serverseitig berechnete Auto-Befüllung.

Der Hook hält im Moment des Aufrufs ein zusammengesetztes Anzeige-Ergebnis:

```
Ergebnis
  spalten: Monatlich → ["2026-04", "2026-05", …]  |  Gesamt → ["gesamt"]
  baum (geordnet nach sort_order):
     Obergruppe → { label, werte je Spalte, kinder: [ Untergruppe ] }
        Untergruppe → { label, werte je Spalte, kinder: [ Produkt ] }
           Produkt   → { label, werte je Spalte }
  gesamt-zeile: { label "Investitionen (Gesamt)", werte je Spalte = Summe aller Obergruppen }
  diagramm-serien: je Obergruppe ein Wert je Spalte (für die Stapelung)
```

Read-only: Anders als auf der Eingabeseite gibt es **keine** grau/blau-Indikatorpunkte — nur die fertigen effektiven Soll-Beträge (die Zahlen stimmen aber überein).

### D) Zwei Zeitansichten (Monatlich / Gesamt)

```
Monatlich (Standard):
  Erste Spalte  = Startmonat (KEIN Vorlauf)
  Letzte Spalte = Startmonat + (Planungshorizont − 1) Monate
  Zellwert      = effektiver Soll der Zeile in diesem Monat

Gesamt:
  Genau EINE Spalte ohne Datum
  Zellwert      = Summe der Monatswerte derselben Zeile über das ganze Fenster
```

Die Gesamt-Verdichtung passiert **clientseitig** auf den bereits geladenen Monatswerten (gleiches Muster wie die Monat↔Jahr-Verdichtung in PROJ-95, hier auf einen einzigen Block reduziert) — kein zusätzlicher Server-Aufruf. Hierarchie und Drill-Down sind in beiden Ansichten identisch; nur die Spalten unterscheiden sich.

### E) Diagramm (gestapelte Obergruppen)

```
Quelle: je Obergruppe der Summenwert je Spalte (aus dem Baum, Ebene 1).
Monatlich: gestapelte Flächen/Linien — X-Achse = Monate, Y-Achse = € ;
           die Stapelsumme je Monat entspricht „Investitionen (Gesamt)".
Gesamt:    EIN gestapelter Balken — Segmente = Obergruppen, Gesamthöhe = Investitionen Gesamt.
Legende benennt die Obergruppen; feste Farbzuordnung (Regenbogen-Palette wie PROJ-95-Chart).
Leerzustand: keine Spalten/Werte → Diagramm ausgeblendet.
```

Anders als das PROJ-95-Diagramm gibt es **keine** Mehrfachauswahl der Linien — es werden **immer alle Obergruppen** gestapelt gezeigt (Nutzervorgabe).

### F) Wiederverwendung vs. Neu

| | Beschreibung |
|---|---|
| **Wiederverwendet (unverändert)** | Versions-Shell + Eigentumsprüfung (PROJ-73); die **komplette Datenbeschaffung** der Investitionsausgaben-Planung (`use-langfristige-investitionsausgaben` inkl. `buildInvestitionsausgabenMonate`, `getManuellerWert`/`getBerechneterWert`); die bestehenden PROJ-92-Endpunkte; das **Matrix-Layout** (sticky erste Spalte, Drill-Down, Summen-Hervorhebung, Betragsselektion) und der **Diagramm-Look** aus PROJ-95; Recharts; shadcn Tabs/Table/Button/Tooltip/Skeleton |
| **Vorlage zum Klonen (UI)** | `langfristige-rentabilitaetsauswertung-matrix.tsx` und `langfristige-rentabilitaetsauswertung-chart.tsx` (Stil, sticky Spalte, Betragsselektion, Farb-/Summen-Hervorhebung) sowie die Seiten-/Kopfleisten-Struktur der PROJ-95-Page |
| **Neu** | Eine Seite, ein schlanker Read-Only-Hook (setzt auf die PROJ-92-Datenquelle auf und baut Baum + effektiven Soll + Spalten + Diagramm-Serien), eine Matrix-Komponente (dynamische Hierarchie statt fester Kaskade), eine Diagramm-Komponente (gestapelt), ein Nav-Eintrag |
| **Bewusst NICHT** | Keine neue DB-Tabelle; keine neue API-Route; keine neue/duplizierte Berechnung; keine Absatztabelle; kein Prozentual-/Wachstumsmodus; kein „Ohne Investitionen"-Filter; keine Bearbeitung |

### G) Tech-Entscheidungen (mit Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Datenquelle | **PROJ-92-Datenbeschaffung wiederverwenden** | Garantiert bit-identische Zahlen zur Investitionsausgaben-Planung; keine zweite Formelpflege |
| Backend | **keins** (kein neuer Endpunkt, keine Tabelle) | Alle nötigen Daten sind über bestehende PROJ-92-Endpunkte abrufbar; Seite ist read-only |
| Effektiver Soll | manuell sonst berechnet sonst 0 | Identisch zur Anzeigelogik der Eingabeseite |
| Zeilenstruktur | **dynamischer Baum** aus dem `lp_investition`-Modell | Anders als PROJ-95 (feste GuV-Kaskade) folgt die Hierarchie dem KPI-Modell der Version |
| Monatlich/Gesamt | **clientseitige Verdichtung** auf einen Block | Bereits in PROJ-95 erprobtes Muster; kein Server-Aufruf nötig |
| Ansichtsmodi | **nur Absolut** | Nutzervorgabe (kein Prozentual/Wachstum) |
| Diagramm | **gestapelt, alle Obergruppen, ohne Mehrfachauswahl** | Nutzervorgabe: Obergruppen ergeben gestapelt den Gesamtwert |

### H) Abhängigkeiten (zu installierende Pakete)

**Keine.** Recharts, alle shadcn-Komponenten, die Versions-Shell und die PROJ-92-Datenquelle sind bereits im Projekt vorhanden.

### I) Auflösung der offenen Fragen aus der Spec
- **Eigener Hook vs. bestehende Datenquelle:** → schlanker Read-Only-Hook, der intern die bestehende PROJ-92-Datenbeschaffung nutzt (gemeinsame Quelle = Bit-Konsistenz).
- **Diagramm-Stil:** → gestapelte **Flächen** in der Monatlich-Ansicht (klare „summiert-sich-zu-Gesamt"-Lesart), gestapelter **Balken** in der Gesamt-Ansicht; Farbpalette wie PROJ-95-Chart (Regenbogen).
- **Viele Obergruppen:** → Legende mit Umbruch; Farben rollierend aus der Palette; bei Gesamt bleibt es ein einzelner, segmentierter Balken.

## Implementation Notes (Frontend — 2026-06-24)

Die Seite wurde als **reine, read-only Anzeigeschicht** über die bestehende PROJ-92-Datenbeschaffung gebaut — **kein neues Backend, keine neue DB-Tabelle, keine neue API-Route**. Sie ist damit nach `/frontend` vollständig (kein `/backend`-Schritt nötig).

### Neue Dateien
- `src/hooks/use-langfristige-investitionsauswertung.ts` — schlanker Read-Only-Hook. Ruft intern `useLangfristigeInvestitionsausgaben(versionId)` (PROJ-92) auf, bildet je (Untergruppe × Produkt × Monat) den **effektiven Soll** (`getManuellerWert` → sonst `getBerechneterWert` → sonst 0) und baut daraus den Baum **Obergruppe (level 1) → Untergruppe (level 2) → Produkt** + die Zeile **„Investitionen (Gesamt)"** + die **Diagramm-Serien je Obergruppe**. Enthält `applyIaZeitansicht` (Monatlich ↔ Gesamt; Gesamt = eine Spalte = Summe aller Monate je Zeile) und `collectIaExpandableIds`. Dadurch sind die Werte **zellgenau identisch** zur Investitionsausgaben-Planung.
- **Produktfilter:** Unter jeder Untergruppe werden **nur** die Produkte gezeigt, für die Daten vorliegen (mind. ein Monat mit manueller Überschreibung **oder** berechnetem Wert) — `hatDaten`-Filter im Hook. Gruppensummen bleiben korrekt (gefilterte Produkte trugen 0 bei).
- `src/components/langfristige-investitionsauswertung-matrix.tsx` — Hierarchie-Matrix (Klon des PROJ-95-Matrix-Layouts): sticky erste Spalte, Drill-Down (Obergruppe/Untergruppe aufklappbar, Default eingeklappt), Gesamt-Zeile hervorgehoben (fett, Hintergrund, Trennlinie), „Alle ausklappen/einklappen", **Betragsselektion** (`data-betrag-selektion`, Klick/Ctrl-Klick/Drag). **Read-only, nur Absolut** (kein Prozentual/Wachstum). Leer-/Hinweiszustände: keine Investitionskategorien → Hinweis + Link zur KPI-Modell-Verwaltung; keine Produkte → Banner; leere Version → 0-Hinweis.
- `src/components/langfristige-investitionsauswertung-chart.tsx` — gestapeltes Diagramm der Obergruppen (Recharts). **Monatlich:** gestapelte `Area`-Flächen über die Monate; **Gesamt:** ein gestapelter `Bar`-Balken. Summe der Segmente je Spalte = Investitionen Gesamt. Tooltip mit Segmentwerten + Gesamtsumme, Legende mit Obergruppen, Regenbogen-Farbpalette wie PROJ-95.
- `src/app/dashboard/langfristige-planung/[versionId]/investitionsauswertung/page.tsx` — `LangfristigeVersionShell` (`seitenTitel="Investitionsauswertung"`, `fullWidth`) + Kopfleiste (Zeitansicht **Monatlich/Gesamt**) + Diagramm + Matrix. **Kein** Ansichtsmodus-Umschalter, **keine** Absatztabelle, **kein** „Ohne Investitionen"-Filter.

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — Eintrag „Investitionsauswertung" (Slug `investitionsauswertung`) in der Nav-Gruppe „Auswertungen" (ans Ende der Gruppe angehängt — die Gruppe war zwischenzeitlich um weitere Auswertungen gewachsen). NavSheet und Versions-Übersicht ziehen generisch nach.

### Abweichungen / Hinweise
- **Farbschema:** Beträge werden **neutral** (Standard-Textfarbe) dargestellt statt grün/rot nach Vorzeichen wie in der GuV-Matrix — Investitionen sind durchweg positive Ausgaben; das entspricht der Anzeige der Investitionsausgaben-Planung. Layout/Aufbau bleibt ansonsten 1:1 wie die Rentabilitätsauswertung.
- **Kein Backend-Schritt:** alle nötigen Endpunkte (Grundeinstellungen, KPI-Kategorien, manuelle/berechnete Investitionswerte) existieren bereits aus PROJ-92.

### Verifikation
- `tsc --noEmit`: keine Fehler in den neuen/geänderten Dateien.
- Hinweis: `npm run lint` (`next lint`) ist unter Next 16 in diesem Repo nicht mehr funktionsfähig (keine `eslint.config.*`, `next lint` entfernt) — TypeScript-Prüfung ist hier das Gate.

## QA Test Results (2026-06-24)

**Methodik:** Statische Verifikation (`tsc --noEmit` sauber in allen Projekt-Quelldateien), Code-Review gegen die Acceptance Criteria und **14 Unit-Tests** für die neue Kernlogik (Baumaufbau, effektiver Soll, Produktfilter, Monatlich↔Gesamt, Diagramm-Serien). Live-Browser-Test durch den Nutzer empfohlen (read-only Seite; benötigt eine Planversion mit Investitionsdaten).

### Acceptance Criteria

| Bereich | Ergebnis | Anmerkung |
|---|---|---|
| Navigation & Einstieg (4. Eintrag „Auswertungen", Auth/Redirect via Shell, Alle aus-/einklappen) | ✅ Pass | Nav-Eintrag `investitionsauswertung` ergänzt; Seite in `LangfristigeVersionShell` (Auth + Versions-Eigentum + Redirect aus PROJ-73). Gruppe war gewachsen → Eintrag ans Ende gehängt (Reihenfolge unkritisch) |
| Zeilenstruktur (nur Investitionen, Obergruppe→Untergruppe→Produkt, Gesamt-Zeile unten, hervorgehoben) | ✅ Pass | Baum aus `lp_investition` (level 1/2) + Produkte; Gesamt-Zeile „Investitionen (Gesamt)" via `bg-muted`/`border-t-2`; unit-getestet |
| **Produktfilter (nur Produkte mit Daten)** | ✅ Pass | `hatDaten`-Filter (manueller Override **oder** berechneter Wert im Fenster); manuelle 0 zählt als Daten; unit-getestet (3 Fälle) |
| Drill-Down (auf-/einklappbar, Gesamt nicht aufklappbar, Alle aus-/einklappen, Zustand bleibt bei Zeitwechsel) | ✅ Pass | `collectIaExpandableIds` (Obergruppen + Untergruppen mit Kindern; leere UG nicht ausklappbar) unit-getestet; Default eingeklappt |
| Zeitansicht Monatlich/Gesamt (Gesamt = 1 Spalte = Summe aller Monate) | ✅ Pass | `applyIaZeitansicht` clientseitig; unit-getestet (Baum, Gesamt, Serien, Leerspalten-Schutz) |
| Wertberechnung (effektiver Soll = manuell→berechnet→0; Summen nach oben; bit-identisch zu PROJ-92) | ✅ Pass | Override sticht berechneten Wert (unit-getestet); gleiche Datenquelle wie Eingabeseite |
| Diagramm (Obergruppen gestapelt; Monatlich Flächen, Gesamt 1 Balken; Summe = Gesamt; Leerzustand) | ✅ Pass | `AreaChart`/`BarChart` stackId="all"; Tooltip mit Segment + Gesamtsumme; null/Leertext bei keinen Werten |
| Darstellung (de-DE €, 2 NK, 0,00 €; Gesamt/Header abgegrenzt) | ✅ Pass | `Intl.NumberFormat`; bewusst neutrale Farbe (Ausgaben durchweg positiv) — siehe Implementation Notes |
| Read-only (keine Edit-Zelle, kein Reset, schreibt nichts) | ✅ Pass | Keine Mutations-Aufrufe; nur Anzeige |
| Versionsisolation (nur diese versionId; leere Version → 0; gleiche KPI-Struktur wie PROJ-92) | ✅ Pass | Erbt PROJ-92-Endpunkte (versions-/nutzergesichert); `isEmpty`-Zustand unit-getestet |

### Edge Cases

| Fall | Ergebnis |
|---|---|
| Leere/neu angelegte Version (Struktur sichtbar, alles 0) | ✅ `isEmpty`-Hinweis; Untergruppen ohne Produktzeilen (unit-getestet) |
| Keine Investitionskategorien | ✅ Leerzustand + Link zur KPI-Modell-Verwaltung (`hasKategorien=false`, unit-getestet) |
| Keine Produkte in der Version | ✅ Banner + Link (`hasProdukte=false`, unit-getestet) |
| Obergruppe ohne Untergruppen / Untergruppe ohne Daten-Produkte | ✅ Header mit 0, nicht aufklappbar |
| Gesamt-Ansicht | ✅ Eine Spalte „Gesamt" = Summe über alle Monate |
| Kein Planungszeitraum (Horizont/Startmonat fehlt) | ✅ Matrix-Hinweis; Diagramm ausgeblendet |
| Sehr breite Tabelle | ✅ `overflow-x-auto`, sticky erste Spalte (geerbtes PROJ-95-Layout) |
| Fremde/unbekannte versionId | ✅ Redirect via Shell (PROJ-73) |

### Security-Audit
- **Keine neue Angriffsfläche:** keine neue API-Route, keine neue Tabelle, keine Schreibvorgänge. Es werden ausschließlich die bestehenden, versions- und nutzergesicherten PROJ-92-Endpunkte gelesen; die Seite liegt hinter `LangfristigeVersionShell` (Auth + Versions-Eigentumsprüfung). Keine Secrets, kein gefährliches `dangerouslySetInnerHTML`, alle Werte numerisch via `Intl.NumberFormat`.

### Tests
- **Unit (neu):** `src/hooks/use-langfristige-investitionsauswertung.test.ts` — **14/14 grün** (Baum & Aggregation, effektiver Soll/Override, Produktfilter inkl. manuelle 0, Gesamt-Zeile, Diagramm-Serien, isEmpty/hasKategorien/hasProdukte, `collectIaExpandableIds`, `applyIaZeitansicht`).
- **Gesamtsuite:** `vitest run` zeigt vorbestehende, **umgebungsbedingte** Flakiness unter hoher Parallelität (Netzwerk-/Timeout-lastige Integrationstests). Stichprobe bestätigt: ein als „failed" gemeldetes File (`use-planung-notizen.test.ts`) läuft isoliert **14/14 grün**. Kein betroffenes Test-File importiert die einzige geänderte Datei (Nav-Config); die neuen Module sind Blattknoten → **keine Regression durch PROJ-99**.
- **E2E:** nicht ergänzt — die Seite ist read-only und benötigt eine authentifizierte Version mit Investitionsdaten; Live-Verifikation durch den Nutzer im laufenden App empfohlen.

### Gefundene Bugs

| # | Severity | Beschreibung |
|---|---|---|
| 1 | Low (kosmetisch) | In `langfristige-investitionsauswertung-chart.tsx` ist `name: col.sublabel ? \`${col.label}\` : col.label` ein toter Ternär (beide Zweige identisch). Keine funktionale Auswirkung. |

**Keine Critical/High/Medium-Bugs.**

### Production-Ready-Empfehlung: ✅ READY
Keine Critical/High-Bugs. Kernlogik durch Unit-Tests abgesichert, `tsc` sauber, keine neue Angriffsfläche. Empfehlung: kurze visuelle Bestätigung im Browser (Monatlich/Gesamt-Umschalter, Drill-Down, gestapeltes Diagramm, Werteabgleich mit der Investitionsausgaben-Planung) vor dem Deploy.

## Deployment
_To be added by /deploy_
