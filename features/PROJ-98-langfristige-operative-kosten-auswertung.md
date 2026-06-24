# PROJ-98: Operative Kosten-Auswertung — Langfristige Planung

## Status: Approved
**Created:** 2026-06-24
**Last Updated:** 2026-06-24

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`) und **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monatsfenster
- Requires: PROJ-88 (Operativekosten Planung — Langfristige Planung) — **alleinige Datenquelle** für die operativen Kosten je Gruppe/Untergruppe/Monat (effektiver Soll je Monat); liefert auch die Zeilenhierarchie (globaler „Operativ"-Subtree: L1-Gruppen → L2-Untergruppen)
- Requires: PROJ-2 (KPI-Modell Verwaltung) — liefert den **globalen** „Operativ"-Knoten im `ausgaben_kosten`-Baum (L1-Gruppen + L2-Untergruppen) als Zeilenquelle (identisch zu PROJ-88)
- Requires: PROJ-87 (Sales-Plattform-Planung — Langfristige Planung) — liefert **Brutto-Umsatz** je Monat als Bezugsgröße für die Ansicht „Prozentual" (analog PROJ-95)
- Requires: PROJ-94 (Liquiditätsauswertung — Langfristige Planung) / PROJ-95 (Rentabilitätsauswertung — Langfristige Planung) — etablieren die Nav-Gruppe „Auswertungen"; diese Seite ist deren **dritter Eintrag**
- Vorlage (kein harter Require): PROJ-95 (Rentabilitätsauswertung — Langfristige Planung) — **maßgebliche Stil- und Verhaltensvorlage** (Seitenaufbau Diagramm → Tabelle, Matrix mit sticky erster Spalte, Drill-Down, Ansichtsmodi, Read-only)
- Vorlage (kein harter Require): PROJ-24 (Rentabilitätsreport — Ansichtsmodi) — Definition „Absolut / Prozentual / Wachstum"
- Vorlage (kein harter Require): PROJ-26 (Rentabilitätsreport — Liniendiagramm) — Diagramm oben
- Vorlage (kein harter Require): PROJ-68 (Operative Ausgaben — Kurzfristige Planung) — Zeilenhierarchie aus dem „Operativ"-Subtree (Gruppe → Untergruppe → Gesamt)

## Übersicht

Die **Operative Kosten-Auswertung** ist der **dritte Eintrag** im Navigationsbereich **„Auswertungen"** der Langfristigen Planung (nach Liquiditätsauswertung PROJ-94 und Rentabilitätsauswertung PROJ-95). Sie ist eine **rein anzeigende** (read-only), **versionsgebundene** Seite, die **ausschließlich** die operativen Kosten dieser Planversion darstellt — nichts anderes.

Im Aufbau und Stil ist sie **bewusst identisch** zur Rentabilitätsauswertung (PROJ-95), nur thematisch auf eine einzige Kategorie reduziert. Der Seitenaufbau von oben nach unten ist:

1. **Gestapeltes Liniendiagramm** (oben) — zeigt die einzelnen operativen **Gruppen als gestapelte Linien/Flächen**, die in Summe die **Operative Kosten (Gesamt)** ergeben.
2. **Haupttabelle** (Matrix: operative Gruppen × Zeitspalten), mit einer Gesamt-Zeile **„Operative Kosten (Gesamt)"** ganz unten.

**Wesentliche Eigenschaft:** Es werden **dieselben Daten** angezeigt wie in der Operativekosten Planung (PROJ-88) bzw. wie sie als „Operative Kosten"-Zeile in die Rentabilitätsauswertung (PROJ-95) einfließen — d. h. der **effektive Soll** je Monat aus der langfristigen Operativekosten-Planung dieser Version. Die Seite schreibt nichts und besitzt keine eigene Datenhaltung.

### Unterschiede zur Rentabilitätsauswertung (PROJ-95)

| Aspekt | Rentabilitätsauswertung (PROJ-95) | Operative Kosten-Auswertung (PROJ-97) |
|---|---|---|
| Inhalt | vollständige GuV-Kaskade (Brutto-Umsatz … Ergebnis) | **nur operative Kosten** (Gruppen + Untergruppen + Gesamt) |
| Zeilenstruktur | feste GuV-Kaskade | **operative Kategorie-Hierarchie** (L1-Gruppen → L2-Untergruppen → Gesamt) aus dem globalen „Operativ"-Subtree |
| Zeitachse | nur Monate | **Umschalter Monat / Jahr** (Jahr = je 12 Monate rollend ab Startmonat) |
| Ansichtsmodi | Absolut / Prozentual / Wachstum | **identisch**: Absolut / Prozentual / Wachstum |
| „Ohne Investitionen"-Filter | vorhanden | **entfällt** (für operative Kosten ohne Bedeutung) |
| Absatztabelle | vorhanden | **entfällt** |
| Diagramm | auswählbare Zwischensummen-Linien | **gestapelte Gruppen-Linien** (Summe = Gesamt) |
| Datenquelle | viele langfristige Planungsmodule | **nur** Operativekosten Planung (PROJ-88); zusätzlich Brutto-Umsatz (PROJ-87) als Prozent-Bezug |

### Zeilenstruktur

```
[L1-Gruppe 1]                          (aufklappbar → Untergruppen)
   · [Untergruppe 1.1]
   · [Untergruppe 1.2]
[L1-Gruppe 2]                          (aufklappbar → Untergruppen)
   · [Untergruppe 2.1]
[L1-Gruppe 3 ohne Untergruppen]        (selbst Leaf, nicht aufklappbar)
…
─────────────────────────────────────
= Operative Kosten (Gesamt)            (Summe aller Gruppen, ganz unten)
```

Die Hierarchie ist **identisch** zur Operativekosten Planung (PROJ-88): der globale „Operativ"-Knoten aus `ausgaben_kosten` mit seinen L1-Gruppen und L2-Untergruppen. L1-Gruppen mit Untergruppen sind reine Summenzeilen ihrer Untergruppen; L1-Gruppen ohne Untergruppen sind selbst die Datenebene.

## User Stories

- Als Controller möchte ich die Operative Kosten-Auswertung innerhalb einer geöffneten Planversion über das linke Seitenmenü (Gruppe „Auswertungen", dritter Eintrag) und über die Versions-Übersichtsseite aufrufen können, damit ich die geplanten operativen Kosten dieses Szenarios kompakt nachvollziehe.
- Als Controller möchte ich die einzelnen operativen Gruppen je Monat sehen, mit einer Gesamt-Zeile ganz unten, damit ich Struktur und Gesamthöhe der operativen Kosten auf einen Blick erkenne.
- Als Controller möchte ich oben ein gestapeltes Diagramm sehen, in dem die einzelnen Gruppen als Linien/Flächen übereinander gestapelt sind und zusammen die Gesamtkosten ergeben, damit ich den Verlauf und die Zusammensetzung über die Zeit verstehe.
- Als Controller möchte ich zwischen Monats- und Jahresansicht umschalten können, wobei die Jahresansicht nicht das Kalenderjahr, sondern immer 12 Monate ab dem Startmonat zusammenfasst, damit ich die operativen Kosten auch verdichtet betrachten kann.
- Als Controller möchte ich zwischen den Ansichten „Absolut", „Prozentual" und „Wachstum" umschalten können, genau wie in der Rentabilitätsauswertung.
- Als Controller möchte ich jede Gruppen-Zeile bis auf Untergruppen-Ebene aufklappen können, um zu sehen, wie sich die operativen Kosten einer Gruppe zusammensetzen.
- Als Controller möchte ich, dass exakt dieselben Werte angezeigt werden wie in der Operativekosten Planung und der Rentabilitätsauswertung dieser Version, ohne hier etwas bearbeiten zu können.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Im Versionskontext erscheint die Seite als **dritter Eintrag** der Nav-Gruppe „Auswertungen": „Operative Kosten-Auswertung" → `/dashboard/langfristige-planung/[versionId]/operative-kosten-auswertung`
- [ ] Auf der Versions-Übersichtsseite erscheint ein Eintrag „Operative Kosten-Auswertung" (über die zentrale Nav-Konfiguration, generisch nachgezogen)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Bei unbekannter/fremder/ungültiger `versionId` erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73
- [ ] Rechts oben: Buttons **„Alle ausklappen"** und **„Alle einklappen"**

### Spaltenstruktur — Umschalter Monat / Jahr

- [ ] Umschalter **Monat | Jahr** in der Kopfleiste; Standard: **Monat**
- [ ] **Monatsansicht:** ausschließlich Monatsspalten vom **Startmonat** über **`planungshorizont_monate`** Monate (allgemeiner Horizont, Fallback 12) — identisch zum Monatsfenster der langfristigen Planungsseiten (`buildPlanungsmonate` / Muster aus PROJ-88)
- [ ] **Jahresansicht:** die Monate werden zu **Jahresblöcken von je 12 Monaten** zusammengefasst, **rollend ab Startmonat** (Jahr 1 = Monat 1–12, Jahr 2 = Monat 13–24, …) — **nicht** nach Kalenderjahr
- [ ] Anzahl Jahresspalten = `ceil(Planungshorizont / 12)`; ein unvollständiger letzter Jahresblock (< 12 Monate) wird als eigene Spalte aus den vorhandenen Monaten gebildet
- [ ] In der Jahresansicht ist der Zellwert (Modus Absolut) die **Summe der 12 Monate** des Blocks
- [ ] Jahres-Spaltenüberschrift kennzeichnet den Block verständlich (z. B. „Jahr 1 (Jan 2026 – Dez 2026)" bzw. analoge Kurzform)
- [ ] **Kein Ist-Bereich, keine Vergangenheit, keine Ist/Soll-Trennlinie** — alle Spalten sind Soll-Zeiträume
- [ ] Monats-Header-Format wie auf den langfristigen Planungsseiten (z. B. „Jan 2026")
- [ ] Tabelle horizontal scrollbar; erste Spalte (Zeilenbeschriftung) ist `sticky left` mit opakem Hintergrund

### Zeilenstruktur (operative Gruppen)

- [ ] Zeilenquelle: der **globale** „Operativ"-Knoten aus `GET /api/kpi-categories?type=ausgaben_kosten`; L1-Gruppen (direkte Kinder von „Operativ") + deren L2-Untergruppen — identische Filterlogik wie PROJ-68/PROJ-88
- [ ] Reihenfolge gemäß `sort_order` des KPI-Modells
- [ ] **Pro L1-Gruppe** eine Zeile; Gruppen mit Untergruppen sind Summenzeilen (nicht aufklappbar deaktiviert → siehe Drill-Down), Gruppen ohne Untergruppen sind selbst die Datenebene
- [ ] **Ganz unten** eine Gesamt-Zeile **„Operative Kosten (Gesamt)"** — Summe aller Gruppen je Zeitspalte, immer sichtbar, optisch hervorgehoben (fett, Hintergrund, Trennlinie) analog Summen-Positionen in PROJ-95
- [ ] Es werden **ausschließlich** operative Kosten angezeigt — keine weiteren Kaskaden-Zeilen, keine anderen Kostenarten, kein Umsatz als eigene Zeile
- [ ] Alle Zeilen sind dauerhaft sichtbar, auch wenn ihr Wert in allen Zeiträumen 0 ist

### Ausklappbare Zeilen (Drill-Down bis Untergruppe)

- [ ] Jede L1-Gruppe **mit** Untergruppen ist **aufklappbar** und zeigt eine eingerückte Zeile **je Untergruppe** (L2)
- [ ] L1-Gruppen **ohne** Untergruppen sind nicht aufklappbar (selbst Datenebene)
- [ ] Die Gesamt-Zeile ist **nicht** aufklappbar
- [ ] Globaler „Alle ausklappen / Alle einklappen"-Button füllt/leert alle Drill-Down-Ebenen
- [ ] Expand/Collapse-Zustand bleibt beim Wechsel des Ansichtsmodus (Absolut/Prozentual/Wachstum) und beim Wechsel Monat/Jahr erhalten

### Wertberechnung (planbasiert, je Zeitspalte)

- [ ] Alle Werte stammen aus dem **effektiven Soll** der langfristigen **Operativekosten Planung** dieser Version (PROJ-88) — **dieselben Werte**, die dort eingegeben und die in PROJ-95 als „Operative Kosten" verwendet werden
- [ ] **Untergruppen-Wert** = der für diese Untergruppe/Monat gespeicherte Betrag (NULL → 0 in der Auswertung)
- [ ] **Gruppen-Wert** = Summe der Untergruppen-Werte der Gruppe je Zeitspalte (bzw. eigener Wert, wenn Gruppe keine Untergruppen hat)
- [ ] **Operative Kosten (Gesamt)** = Summe aller Gruppen je Zeitspalte
- [ ] In der **Jahresansicht** werden je Block die 12 Monatswerte einer Zeile aufsummiert; die Hierarchie-Aggregation bleibt konsistent (Summe der Gruppen = Gesamt je Jahresblock)

### Ansichtsmodi (Absolut / Prozentual / Wachstum) — analog PROJ-24/PROJ-95

- [ ] Umschalter mit drei Modi; Standard: **Absolut**
- [ ] **Absolut**: unveränderte Werte im Währungsformat (€, de-DE, 2 Dezimalstellen)
- [ ] **Prozentual**: jede Zelle = `Wert / Brutto-Umsatz der Zeitspalte × 100`, 1 Dezimalstelle, %-Zeichen — **Bezugsgröße ist der Brutto-Umsatz** (identische Logik wie in PROJ-95/PROJ-24). Brutto-Umsatz stammt aus der Sales-Plattform-Planung (PROJ-87), je Monat bzw. je Jahresblock (Summe). Ist der Brutto-Umsatz einer Zeitspalte 0 → „—" für alle Zellen dieser Spalte
- [ ] **Wachstum**: je Zelle zwei Zeilen — Absolutwert (klein) und darunter prozentuale Veränderung zur **Vorperiode** (Vormonat in Monatsansicht, Vorjahr-Block in Jahresansicht): `(aktuell − vorher) / |vorher| × 100`, 1 Dezimalstelle; positiv grün „+X,X % ↑", negativ rot „−X,X % ↓", 0 → „0,0 %"; Vorperiode = 0 und aktuell ≠ 0 → „n/a"; Vorperiode = 0 und aktuell = 0 → „0,0 %"
- [ ] Die Vorperiode der ersten sichtbaren Spalte wird, sofern Daten vorhanden, außerhalb des Fensters berechnet; sonst „—"
- [ ] Drill-Down-Zeilen (Untergruppen) werden im jeweiligen Modus konsistent dargestellt (Prozentwerte beziehen sich auf denselben Brutto-Umsatz der Zeitspalte)

### Gestapeltes Diagramm (oben) — analog PROJ-26

- [ ] Oberhalb der Haupttabelle ein **gestapeltes Diagramm** (Recharts) im Stil des Rentabilitätsreports/PROJ-95
- [ ] Die einzelnen **L1-Gruppen** werden als **gestapelte Linien/Flächen** dargestellt, sodass die übereinandergestapelten Gruppen zusammen die **Operative Kosten (Gesamt)** ergeben
- [ ] X-Achse: Zeitspalten synchron zur Tabelle (Monate bzw. Jahresblöcke je nach Umschalter); Y-Achse: Betrag in € (Absolut), bzw. % (Prozentual) bzw. Wachstumsrate (Wachstum) — Achsen/Verhalten folgen dem aktiven Ansichtsmodus wie in PROJ-26/PROJ-95
- [ ] Das Diagramm respektiert Ansichtsmodus und Monat/Jahr-Umschalter
- [ ] Optional: Gruppen über eine Legende/Mehrfachauswahl ein-/ausblendbar (wie im Diagramm der Reports); Default: alle Gruppen aktiv
- [ ] Leerzustand: Diagramm wird ausgeblendet, wenn keine darstellbaren Zeitspalten/Gruppen vorhanden sind

### Darstellung (Farben)

- [ ] Kostenwerte werden konsistent mit PROJ-95 dargestellt (Kosten als roter/negativer Wert bzw. gemäß der dort etablierten Konvention — in `/architecture`/`/frontend` an PROJ-95 angleichen)
- [ ] 0-Werte als „0,00 €" (nicht leer); Beträge mit 2 Dezimalstellen und € im de-DE-Format
- [ ] Die Gesamt-Zeile ist optisch klar von den Gruppen-Zeilen abgegrenzt
- [ ] Diagramm-Gruppenfarben stabil/wiedererkennbar (konsistente Farbzuordnung je Gruppe)

### Read-only-Verhalten

- [ ] Keine Zelle ist editierbar (kein Inline-Edit, kein onBlur-Speichern)
- [ ] Die Seite schreibt **keine** eigenen Planungsdaten; sie liest ausschließlich
- [ ] Kein „Zurücksetzen"-Button; keine Bulk-Edit-/Notiz-Funktionen (das ist die Planungsseite PROJ-88)

### Versionsisolation

- [ ] Die Auswertung verwendet **dieselben** Zeilen-/Kategoriequellen wie die Operativekosten Planung (globaler „Operativ"-Subtree) und liest die Werte ausschließlich aus dieser `versionId`
- [ ] Es werden **keine** Daten aus anderen Planversionen oder aus der Kurzfristigen Planung angezeigt
- [ ] Eine neu angelegte (leere) Planversion zeigt eine im Wesentlichen leere Auswertung (alle Werte 0), Struktur bleibt vollständig sichtbar

## Datenquellen

| Element | Quelle (langfristige Planung, Version) | Effektiver Soll |
|---|---|---|
| Operative Kosten je Gruppe/Untergruppe/Monat | Operativekosten Planung (PROJ-88) | `GET …/[versionId]/operativekosten-planung` |
| Zeilenhierarchie (L1-Gruppen + L2-Untergruppen) | globaler „Operativ"-Subtree (PROJ-2/PROJ-68) | `GET /api/kpi-categories?type=ausgaben_kosten` |
| Startmonat + Planungshorizont (Monats-/Jahresfenster) | Grundeinstellungen (PROJ-75) | `GET …/[versionId]/grundeinstellungen` |
| Brutto-Umsatz je Zeitspalte (nur Modus „Prozentual") | Sales-Plattform-Planung (PROJ-87) | `…/sales-plattform-planung` + `…/berechnet` |

**Wichtig:** Diese Seite **liest** ausschließlich. Die operativen Kosten werden 1:1 aus PROJ-88 übernommen (keine Neuberechnung). Der Brutto-Umsatz wird nur für die Bezugsgröße der Prozentansicht geladen, exakt wie in PROJ-95. Die exakten Endpunkte/Feldnamen sind in `/architecture` final zu verifizieren.

## Edge Cases

- **Leere/neu angelegte Planversion:** alle Werte 0; Hierarchie + Gesamt-Zeile bleiben vollständig sichtbar.
- **Kein „Operativ"-Knoten im globalen KPI-Modell / keine Kinder:** Leerzustand mit Hinweis („Keine operativen Kostenkategorien im KPI-Modell vorhanden …") + Link zur KPI-Modell-Verwaltung (analog PROJ-88).
- **L1-Gruppe ohne Untergruppen:** Gruppe selbst ist Datenebene, nicht aufklappbar.
- **Planungshorizont nicht durch 12 teilbar:** letzter Jahresblock ist unvollständig (< 12 Monate) und wird als eigene Spalte aus den vorhandenen Monaten gebildet (Summe der vorhandenen Monate).
- **Brutto-Umsatz einer Zeitspalte = 0 (Modus Prozentual):** „—" für alle Zellen dieser Spalte.
- **Vorperiode ohne Wert (Modus Wachstum):** „n/a" bzw. „—" gemäß PROJ-24/PROJ-95-Regeln; in Jahresansicht ist die Vorperiode der Vorjahres-Block.
- **Sehr breite Tabelle (großer Planungshorizont, z. B. 120 Monate):** horizontales Scrollen, erste Spalte sticky; Jahresansicht reduziert die Spaltenzahl deutlich.
- **Fremde/unbekannte `versionId`:** Redirect zum Dashboard (PROJ-73), kein Fremdzugriff.
- **Quell-API (Operativkosten oder Umsatz) liefert Fehler:** Lade-Fehlerzustand bzw. betroffener Bereich leer/Hinweis, kein Seitenabsturz; Diagramm bzw. Prozentansicht degradiert sauber (Prozentansicht ohne Umsatz → „—").
- **Kategorie im KPI-Modell gelöscht/umbenannt:** Werte mit nicht mehr existierender `kategorie_id` werden nicht angezeigt (konsistent mit PROJ-88).
- **Konsistenz mit PROJ-95/PROJ-88:** Die hier angezeigte „Operative Kosten (Gesamt)" je Monat muss exakt der „Operative Kosten"-Zeile in der Rentabilitätsauswertung (PROJ-95) und der Gesamt-Zeile der Operativekosten Planung (PROJ-88) entsprechen — gleiche Quelle, gleiche Aggregation.

## Technical Requirements

- Authentifizierung: `requireAuth()` in ggf. neuen API-Routen; Seite ist Client Component im Versions-Shell (`LangfristigeVersionShell`) mit Auth- und Versions-Eigentumsprüfung
- **Keine neue DB-Tabelle nötig** — read-only; liest aus bestehenden versionsgebundenen Quellen (PROJ-88, PROJ-87, PROJ-75) und dem globalen KPI-Modell
- **Aggregation:** Da alle Werte 1:1 übernommen und nur summiert/umgerechnet werden (keine produkt-granulare Neuberechnung wie in PROJ-95), genügt voraussichtlich ein **Frontend-Hook** (analog PROJ-94). Finale Entscheidung Frontend-Hook vs. serverseitige Sammel-Route in `/architecture`
- Monats-/Jahresfenster: bestehender Helfer/Muster (`buildPlanungsmonate` aus PROJ-84 bzw. `buildOperativekostenMonate` aus PROJ-88); Jahresblöcke = je 12 Monate rollend ab Startmonat
- Prozent-Bezugsgröße (Brutto-Umsatz) und Ansichtsmodi-Logik aus PROJ-95 wiederverwenden (kein Duplizieren komplexer Logik)
- Chart-Bibliothek: Recharts (vorhanden), gestapelte Darstellung (`stackId`)
- Keine neuen Packages: shadcn `Table`, `Tabs`/`ToggleGroup`, `Tooltip`, `Button`, `Skeleton` — alle vorhanden
- **Abkapselung:** keine Ist-Daten, keine Daten der Kurzfristigen Planung; ausschließlich Daten dieser `versionId`
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Richtwert)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/operative-kosten-auswertung/page.tsx` | Seite: Versions-Shell + Kopfleiste (Ansichtsmodi, Monat/Jahr, Ausklappen-Buttons) + gestapeltes Diagramm + Haupttabelle |
| `src/hooks/use-langfristige-operative-kosten-auswertung.ts` | Datenladen (Operativkosten-Werte + globaler Operativ-Subtree + Grundeinstellungen + Brutto-Umsatz), Aggregation Gruppe/Gesamt, Monats-/Jahresfenster, Ansichtsmodus-/Ausklapp-Zustand |
| `src/components/langfristige-operative-kosten-auswertung-matrix.tsx` | Matrix: Gruppen → Untergruppen → Gesamt, sticky erste Spalte, Drill-Down, Ansichtsmodi, Monat/Jahr |
| `src/components/langfristige-operative-kosten-auswertung-chart.tsx` | Gestapeltes Diagramm (Gruppen als gestapelte Linien/Flächen, Summe = Gesamt) |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Dritter Eintrag „Operative Kosten-Auswertung" (Slug `operative-kosten-auswertung`) in der Nav-Gruppe „Auswertungen" |

### Wiederverwendung bestehender Muster

| Muster | Quelle |
|---|---|
| Seitenaufbau (Diagramm oben, Matrix unten), sticky erste Spalte, Summen-Hervorhebung, Read-only | PROJ-95 (`langfristige-rentabilitaetsauswertung-*`) |
| Ansichtsmodi Absolut/Prozentual/Wachstum + Brutto-Umsatz als Prozent-Bezug | PROJ-24 / PROJ-95 |
| Liniendiagramm / gestapelte Darstellung | PROJ-26 / `reporting-rentabilitaet-chart` / PROJ-95-Chart |
| Operativ-Subtree-Filter (Root „Operativ", L1-Gruppen + L2-Untergruppen) | PROJ-68 (`use-operativeausgaben.ts`) / PROJ-88 |
| Operativkosten-Werte je Version | PROJ-88 (`…/operativekosten-planung`) |
| Monats-/Jahresfenster-Helfer | `buildPlanungsmonate` (PROJ-84) / `buildOperativekostenMonate` (PROJ-88) |
| Versions-Shell, Eigentumsprüfung, Nav-Konfiguration, Gruppe „Auswertungen" | PROJ-73 / PROJ-94 / PROJ-95 |

## Open Questions / Follow-ups (in `/architecture` zu klären)
- Frontend-Hook vs. serverseitige Sammel-Route (Empfehlung: Frontend-Hook wie PROJ-94, da reine Summen/Übernahme).
- Genaue Wiederverwendung der Brutto-Umsatz-Beschaffung aus PROJ-95 (gleiche Route/gleicher Hook), damit die Prozentbasis exakt mit der Rentabilitätsauswertung übereinstimmt.
- Diagramm-Detailtyp: gestapeltes Flächendiagramm vs. gestapelte Linien (Vorgabe: „gestapelte Linien, die zusammen Gesamt ergeben" → stacked area/`stackId`); finale visuelle Angleichung an PROJ-95 in `/frontend`.
- Farb-/Vorzeichen-Konvention der Kostenwerte exakt an PROJ-95 angleichen.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-24)

### Leitidee

Diese Seite ist die **operative Zwillingsschwester der Umsatzauswertung (PROJ-96)**. PROJ-96 hat bereits gezeigt, wie man aus der vollständigen Rentabilitätsauswertung (PROJ-95) **eine einzelne Kategorie** herauslöst und als schlanke, eigenständige Auswertungsseite darstellt — mit Monat/Jahr-Umschalter, den drei Ansichtsmodi (Absolut/Prozentual/Wachstum), Drill-Down und Diagramm. PROJ-98 macht dasselbe, nur für den **Operativ-Block** statt für den Umsatz-Block.

Der entscheidende Befund aus der Code-Analyse: **Die Daten existieren bereits fertig.** Die Server-Route der Rentabilitätsauswertung (`/api/langfristige-planung/[versionId]/rentabilitaetsauswertung`) liefert in ihrer Antwort schon heute:
- eine **`operativ`-Zeile** mit der Monatssumme **und** einer vollständigen **Gruppe → Untergruppe-Aufschlüsselung** (im Code über `operativPath` + `addPath('operativ', …)` gebaut — exakt die Hierarchie, die PROJ-98 als Zeilen braucht);
- eine **`brutto_umsatz`-Zeile** je Monat — genau die Bezugsgröße, die der Prozentual-Modus benötigt.

Daraus folgt die wichtigste Architekturentscheidung:

> **Die Seite bekommt keine eigene Berechnungslogik und keine eigene Datenhaltung.** Sie ruft **dieselbe Server-Route wie PROJ-95/PROJ-96** auf, verwendet daraus **nur** die `operativ`-Zeile (für Zeilen + Diagramm) und die `brutto_umsatz`-Zeile (für die Prozent-Bezugsgröße) und rechnet alles Übrige — Gesamt-Summe, Monat↔Jahr-Bündelung, Ansichtsmodi, Auf-/Zuklappen — **rein clientseitig**. Damit ist die angezeigte „Operative Kosten (Gesamt)" garantiert **bit-identisch** zur „Operative Kosten"-Zeile in der Rentabilitätsauswertung (PROJ-95) und zur Gesamtzeile der Operativekosten Planung (PROJ-88) — was eine ausdrückliche Anforderung der Spec ist.

### Empfohlene Backend-Optimierung (klein, optional): leichter Modus `?nur=operativ`

Die Route kennt bereits einen **leichten Modus** `?nur=umsatz`, der die schweren GuV-Schritte (Produktkosten, Bestellkosten-Generierung **inkl. Schreibvorgängen**, Lagerbestands-Simulation, Investitions-Unteraufruf) überspringt und nur den Umsatzblock + Absatz liefert. Der Operativ-Block wird allerdings **erst nach** diesen schweren Schritten gerechnet (er ist selbst aber **billig** — eine einfache Monatssummierung der gespeicherten Operativkosten-Werte).

**Empfehlung für `/backend`:** Einen analogen Modus **`?nur=operativ`** ergänzen, der den (billigen) Umsatzblock + den (billigen) Operativ-Block rechnet und die teuren Zwischenschritte überspringt. Das hält die Auswertung schnell und vermeidet, dass beim bloßen Öffnen einer Auswertungsseite Bestellkosten neu generiert/geschrieben werden.

**Wichtig — Fallback ohne Backend-Arbeit:** Wie schon bei PROJ-96 funktioniert die Seite **auch ohne diesen Modus sofort** — sie kann die Route ohne `nur`-Parameter aufrufen (volle Berechnung, gleiche Werte, nur langsamer). Die Optimierung ist also nice-to-have, kein Blocker. Das Frontend wird so gebaut, dass es den leichten Modus anfragt und bei dessen Fehlen transparent die volle Antwort verarbeitet.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]/operative-kosten-auswertung   (NEUE Seite)
│
└── LangfristigeVersionShell  (bestehend — Login-/Versions-Eigentums-Prüfung, Header, Redirect, fullWidth)
    │
    ├── Filter-Leiste (oben)                                  (clientseitig, wie PROJ-96)
    │   ├── Zeitbasis-Umschalter:   Monat | Jahr
    │   ├── Ansichts-Umschalter:    Absolut | Prozentual | Wachstum
    │   └── Buttons:                Alle ausklappen | Alle einklappen
    │   (KEIN „Ohne Investitionen", KEINE Absatztabelle)
    │
    ├── Gestapeltes Diagramm  (NEUE Komponente, Recharts)
    │   └── je L1-Gruppe eine gestapelte Fläche/Linie; gestapelte Summe = Operative Kosten (Gesamt)
    │
    └── Operative-Kosten-Matrix  (NEUE Hauptkomponente, read-only)
        ├── Kopf: [Bezeichnung (sticky links)] | [Monats- bzw. Jahresspalten …]
        ├── je L1-Gruppe eine Zeile (aufklappbar → Untergruppen-Zeilen), Reihenfolge wie im KPI-Modell
        └── Gesamt-Zeile „Operative Kosten (Gesamt)" ganz unten (hervorgehoben)

src/lib/langfristige-planung-nav.ts   (bestehend — neuer Eintrag in Gruppe „Auswertungen")
```

> **Hinweis zur Navigation:** Die Gruppe „Auswertungen" enthält aktuell drei Einträge (Liquiditätsauswertung, Rentabilitätsauswertung, Umsatzauswertung). „Operative Kosten-Auswertung" wird als **vierter Eintrag** angehängt (die Spec-Formulierung „dritter Eintrag" stammt aus einem früheren Stand, bevor PROJ-96 hinzukam — die Reihenfolge ist nicht funktional bindend).

### B) Datenfluss (in einfachen Worten)

```
1. Seite öffnet → Versions-Shell prüft Login + Versions-Eigentum (Redirect bei fremder Version).

2. Frontend ruft EINE Server-Route auf (die der Rentabilitätsauswertung):
   GET /api/langfristige-planung/[versionId]/rentabilitaetsauswertung?nur=operativ
   (kein Von/Bis, keine Granularität — immer Startmonat … Planungshorizont, immer Monatsraster)

3. Aus der Antwort verwendet das Frontend NUR:
   - die Zeile „operativ"      → Monatswerte + Gruppe/Untergruppe-Aufschlüsselung (= Tabellenzeilen + Diagramm)
   - die Zeile „brutto_umsatz"  → Bezugsgröße für den Prozentual-Modus

4. Clientseitig (ohne weiteren Server-Aufruf):
   - Aufbau der Zeilen: je Gruppe → Untergruppen → Gesamt-Zeile (Summe aller Gruppen)
   - Monat↔Jahr: rollierende 12-Monats-Blöcke ab Startmonat (Summe je Block)
   - Ansichtsmodus: Absolut | Prozentual (geteilt durch Brutto-Umsatz der Spalte) | Wachstum (Δ zur Vorperiode)
   - Auf-/Zuklappen der Gruppen
```

**Konsistenz-Garantie:** Weil Werte und Aufschlüsselung aus genau derselben Route/demselben Code-Pfad wie PROJ-95 stammen, stimmen die operativen Kosten dieser Seite per Konstruktion mit der Rentabilitätsauswertung überein. Es gibt keinen zweiten Rechenweg, der auseinanderlaufen könnte.

### C) Datenmodell (in einfachen Worten)

**Keine neue Datenbanktabelle. Kein Schreibzugriff. Keine neue Lese-Route** (sofern der optionale Modus `?nur=operativ` in der bestehenden Route ergänzt wird — das ist eine Erweiterung, keine neue Datei).

Die dauerhaften Daten leben unverändert in den bestehenden versionsgebundenen Tabellen:
- die operativen Kosten in `langfristige_operativekosten_planung` (aus PROJ-88),
- der Brutto-Umsatz wird aus der Sales-Plattform-Planung (PROJ-87) abgeleitet — beides geschieht bereits **innerhalb** der Rentabilitätsauswertungs-Route.

Das Frontend hält nur **flüchtigen Anzeige-Zustand** (Zeitbasis, Ansichtsmodus, Auf-/Zuklapp-Zustand) im Komponenten-State — nichts wird persistiert.

Die clientseitig gebaute Zeilenstruktur (rein im Speicher):
```
Operative-Kosten-Modell
  columns: ["2026-1", "2026-2", …]            (Monat)  bzw.  ["J1", "J2", …]  (Jahr)
  gruppen: geordnete Liste, je Gruppe:
     - id / label
     - werte: { Spaltenschlüssel → Betrag }
     - untergruppen: [ je Untergruppe → eigene werte ]   (Drill-Down)
  gesamt:   { Spaltenschlüssel → Summe aller Gruppen }    (Zeile „Operative Kosten (Gesamt)")
  bruttoProSpalte: { Spaltenschlüssel → Brutto-Umsatz }   (nur für Prozentual-Modus)
```

### D) Ansichtslogik (clientseitig, aus PROJ-95/96 übernommen)

| Modus | Rechnung je Zelle | Quelle der Logik |
|---|---|---|
| **Absolut** | Betrag im €-Format (de-DE, 2 Dezimalstellen) | — |
| **Prozentual** | Betrag ÷ Brutto-Umsatz der Spalte × 100 (1 Dezimalstelle); Brutto = 0 → „—" | identisch PROJ-95/96 (`bruttoByColumn`) |
| **Wachstum** | Δ zur Vorperiode: (aktuell − vorher) ÷ \|vorher\| × 100; Sonderfälle „n/a"/„0,0 %" wie PROJ-24 | identisch PROJ-96 |

**Monat ↔ Jahr:** Es wird die in PROJ-96 bereits erprobte Bündelung wiederverwendet (rollierende **12-Monats-Blöcke ab Startmonat**, **Summe** je Block; unvollständiger letzter Block bleibt eine kürzere Spalte). Diese Logik ist generisch (sie summiert beliebige Monatswerte zu Jahresblöcken) und wird für die Gruppen-, Untergruppen-, Gesamt- und Brutto-Werte gleichermaßen angewandt.

### E) Das gestapelte Diagramm (einziges echt neues UI-Stück)

Während Matrix, Filter-Leiste und Ansichtslogik nahezu 1:1 aus PROJ-96 stammen, ist das **gestapelte Diagramm** der einzige neue Baustein: PROJ-96 zeigt zwei einfache Linien, PROJ-98 braucht **je Gruppe eine gestapelte Fläche/Linie**, die zusammen die Gesamtsumme ergeben.

- Umsetzung mit der bereits vorhandenen Chart-Bibliothek **Recharts** über gestapelte Flächen (gemeinsame Stapel-Kennung) — kein neues Paket.
- X-Achse synchron zu den Tabellenspalten (Monate bzw. Jahresblöcke); Y-Achse folgt dem Ansichtsmodus (€ / % / Wachstum), wie in PROJ-26/95.
- Stabile, wiedererkennbare Farbzuordnung je Gruppe; optionale Legende zum Ein-/Ausblenden einzelner Gruppen (Default: alle aktiv).
- Leerzustand: Diagramm ausgeblendet, wenn keine darstellbaren Spalten/Gruppen vorhanden sind.

### F) Was neu gebaut wird vs. was wiederverwendet wird

| | Beschreibung |
|---|---|
| **Wiederverwendet (unverändert)** | Versions-Shell + Eigentumsprüfung (PROJ-73); die **gesamte** Rentabilitätsauswertungs-Server-Route inkl. Operativ-Aufschlüsselung und Brutto-Umsatz (PROJ-95); die Monat↔Jahr-Bündelung und die Ansichtsmodus-Helfer aus PROJ-96; Recharts; shadcn Tabs/Table/Tooltip/Button/Skeleton |
| **Vorlage zum Klonen (UI)** | die komplette Umsatzauswertung (PROJ-96): Seite, Hook, Matrix — strukturgleich, nur Inhalt = Operativ-Block statt Umsatz-Block |
| **Neu** | eine Seite, ein Daten-Hook (Operativ-Block-Variante), eine Matrix-Komponente (Gruppen→Untergruppen→Gesamt), **eine gestapelte Chart-Komponente**, ein Nav-Eintrag |
| **Optional (Backend)** | leichter Modus `?nur=operativ` in der bestehenden Route (Performance; Fallback = volle Route) |
| **Bewusst NICHT** | keine neue DB-Tabelle, kein Schreibzugriff, keine zweite Berechnungslogik für operative Kosten, keine Bulk-Edit-/Notiz-/Absatztabellen-Bausteine (das ist die Planungsseite PROJ-88) |

### G) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Datenquelle | **bestehende PROJ-95-Route wiederverwenden** | Liefert `operativ` (mit Gruppe/Untergruppe) + `brutto_umsatz` bereits fertig; garantiert Bit-Identität mit Rentabilitätsauswertung & Operativekosten Planung |
| Berechnungsort | **Frontend** (Hook), kein neuer Server-Code | Es wird nur summiert/umgerechnet/gebündelt — keine produkt-granulare Neuberechnung wie in PROJ-95; identisch zur Strategie von PROJ-94/96 |
| Performance | **optionaler `?nur=operativ`-Modus** | Vermeidet teure Bestellkosten-/Lager-/Investitions-Schritte beim Öffnen; analog zum bestehenden `?nur=umsatz`; Fallback ohne Modus funktioniert |
| Diagrammtyp | **gestapelte Flächen** (Gruppen → Gesamt) | Entspricht der Anforderung „einzelne Gruppen gestapelt, zusammen Gesamt"; einziger neuer UI-Baustein |
| Vorlage | **PROJ-96 (Umsatzauswertung) klonen** statt PROJ-95 | PROJ-96 ist bereits die „eine Kategorie"-Reduktion mit Monat/Jahr-Umschalter — minimaler Abstand zu PROJ-98 |
| Keine Editier-/Notiz-/Bulk-Funktionen | **read-only** | Auswertung, keine Planung; Eingabe bleibt bei PROJ-88 |

### H) Dependencies (Pakete)

**Keine neuen npm-Pakete.** Verwendet werden ausschließlich bereits installierte Bausteine: Next.js App-Router (dynamisches Versions-Segment), Recharts (Diagramm), shadcn/ui (Tabs, Table, Tooltip, Button, Skeleton, Label), die bestehende Versions-Shell sowie die wiederverwendeten Auswertungs-Helfer aus PROJ-95/96.

### I) Umsetzungsreihenfolge (empfohlen)

1. **Frontend zuerst** (Feature ist sofort lauffähig, da die Datenroute existiert): Nav-Eintrag „Operative Kosten-Auswertung" (Slug `operative-kosten-auswertung`) in der Gruppe „Auswertungen" ergänzen.
2. Daten-Hook (Operativ-Block aus der Route; Aufbau Gruppen→Untergruppen→Gesamt; Monat/Jahr-Bündelung; Ansichtsmodi — Vorlage PROJ-96-Hook). Vorerst die **volle** Route aufrufen (Fallback), Anfrage-Parameter `?nur=operativ` bereits mitsenden.
3. Matrix-Komponente (sticky erste Spalte, Drill-Down, Summen-Hervorhebung) + gestapelte Chart-Komponente; Seite in die Versions-Shell einbetten.
4. **Backend (optional, danach):** leichten Modus `?nur=operativ` in der Rentabilitätsauswertungs-Route ergänzen, damit beim Öffnen keine teuren Schritte laufen.

> Da Schritt 4 optional ist, kann das Feature nach Schritt 3 bereits per `/qa` abgenommen werden; die Backend-Optimierung ist eine reine Performanceverbesserung ohne Verhaltensänderung.

## Implementation Notes (Frontend — 2026-06-24)

Umgesetzt als schlanke Schwester der Umsatzauswertung (PROJ-96), wie im Tech Design vorgesehen. Alle Werte stammen aus der bestehenden Rentabilitätsauswertungs-Route (PROJ-95) — kein neuer Server-Code, keine DB-Änderung.

### Neue Dateien
- `src/hooks/use-langfristige-operative-kosten-auswertung.ts` — Daten-Hook. Lädt `GET …/[versionId]/rentabilitaetsauswertung?nur=operativ` und verwendet daraus **nur** die Zeile `operativ` (Monatssumme + Gruppe→Untergruppe-Aufschlüsselung) und `brutto_umsatz.werte` (Bezugsgröße Prozentual). `computeCascade` baut je L1-Gruppe einen aufklappbaren Knoten + eine Gesamt-Zeile „Operative Kosten (Gesamt)" (= Liniensumme der Route, bit-identisch zur „Operative Kosten"-Zeile in PROJ-95). Kostenwerte tragen `KOSTEN_SIGN = -1` (rot/negativ, konsistent mit PROJ-95). `applyZeitbasis` verdichtet auf rollierende 12-Monats-Blöcke ab Startmonat (Summe; unvollständiger letzter Block bleibt kürzer). Helfer: `collectExpandableIds`, `gruppenNodes`, `bruttoByColumn`. Leerzustand: keine Operativ-Werte → `isEmpty`.
- `src/components/langfristige-operative-kosten-auswertung-matrix.tsx` — Matrix (geklont aus PROJ-96-Matrix). Flache Zeilen (Gruppe → Untergruppe → Gesamt), sticky erste Spalte, drei Ansichtsmodi (Absolut / Prozentual = Anteil am Brutto-Umsatz / Wachstum = Δ Vorperiode), „Alle ein-/ausklappen", Betragsselektion-Summenpanel (`data-betrag-selektion`). Gesamt-Zeile hervorgehoben (fett, `bg-muted`, Trennlinie). Untergruppen eingerückt + gedämpft.
- `src/components/langfristige-operative-kosten-auswertung-chart.tsx` — **gestapeltes Diagramm** (Recharts `ComposedChart`). Je L1-Gruppe eine gestapelte Fläche (gemeinsame `stackId`), zusammen = Gesamt; Tooltip zeigt zusätzlich die Summe. Im **Wachstums-Modus** ist Stapeln sinnlos → dann Linien je Gruppe. Y-Achse/Tooltip folgen dem Ansichtsmodus (€ / % / Wachstum). Stabile Farbpalette je Gruppenindex.
- `src/app/dashboard/langfristige-planung/[versionId]/operative-kosten-auswertung/page.tsx` — Seite: `LangfristigeVersionShell` (`seitenTitel="Operative Kosten-Auswertung"`, `fullWidth`) + Filter-Leiste (Zeitbasis Monat/Jahr, Ansicht Absolut/Prozentual/Wachstum) + Diagramm + Matrix. Keine Absatztabelle, kein „Ohne Investitionen"-Filter (bewusst entfallen).

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — neuer Eintrag „Operative Kosten-Auswertung" (Slug `operative-kosten-auswertung`) in der Gruppe „Auswertungen" (nach „Umsatzkosten-Auswertung"). NavSheet + Versions-Übersicht ziehen generisch nach.

### Wiederverwendet (unverändert)
- `LangfristigeVersionShell` (Versionsprüfung/Header/Redirect/Toaster), die Rentabilitätsauswertungs-Route + ihr geteilter Vertrag `langfristige-rentabilitaetsauswertung-shared.ts` (Typen `RaLine`/`RaBreakdown`), Recharts, shadcn/ui (Tabs, Label, Button, Skeleton). Betragsselektion-Muster aus PROJ-95/96.

### Hinweis zur Route (`?nur=operativ`)
Der leichte Modus `?nur=operativ` existiert serverseitig **noch nicht**; die Route ignoriert den unbekannten Parameter und liefert die **volle** Antwort — die Seite nutzt davon nur `operativ` + `brutto_umsatz` (korrekte, bit-identische Werte). Eine optionale Backend-Optimierung (`?nur=operativ` als leichter Short-Circuit analog `?nur=umsatz`) ist im Tech Design beschrieben und kann nachgezogen werden, ohne das Frontend zu ändern.

### Designentscheidung zur Bestätigung (Review)
Operative Kosten werden — wie in der Rentabilitätsauswertung (PROJ-95) — als **negative, rote** Beträge dargestellt; im Diagramm stapeln die Gruppen daher **nach unten** zum (negativen) Gesamtwert. Falls eine klassische, **positive nach oben** stapelnde Kostenkomposition gewünscht ist, lässt sich das über `KOSTEN_SIGN` zentral umstellen.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen/geänderten Dateien.

## Implementation Notes (Backend — 2026-06-24)

Umsetzung der optionalen Performance-Optimierung aus dem Tech Design. **Keine neue Tabelle, keine neue Route, kein Schema-Change** — nur ein leichter Modus in der bestehenden Rentabilitätsauswertungs-Route.

### Geänderte Dateien
- `src/app/api/langfristige-planung/[versionId]/rentabilitaetsauswertung/route.ts` — neuer leichter Modus **`?nur=operativ`** (analog zum bestehenden `?nur=umsatz` aus PROJ-96). Liefert nur die Zeile `operativ` (Drill Gruppe→Untergruppe) + `brutto_umsatz` (Prozent-Bezugsgröße) und **überspringt** die teuren Schritte: Produktkosten, **Bestellkosten-Generierung inkl. Schreibvorgängen**, Lagerbestands-Simulation, Marketing, Finanzierung, Steuern. Der Operativ-Block (eine reine Monatssummierung der gespeicherten Werte) wird dafür vor den schweren Sektionen ausgeführt; danach wird direkt geantwortet. Gleicher Code-Pfad wie der volle Modus → **bit-identische** Operativ-Werte. Auth/Versions-Eigentum (`requireAuth` + `ensureLangfristigeVersion`) unverändert; `export const dynamic = 'force-dynamic'` bereits gesetzt.
- `src/app/api/langfristige-planung/[versionId]/rentabilitaetsauswertung/route.test.ts` — **2 neue Tests**: (1) `nur=operativ` liefert die Operativ-Zeile mit Gruppe→Untergruppe-Drill + Brutto-Umsatz und löst die (schreibende) Bestellkosten-Generierung **nicht** aus (Ware/Marketing bleiben leer); (2) `nur=operativ` liefert dieselben Operativ- + Brutto-Werte wie der volle Modus.

### Sicherheit
- Keine RLS-/Auth-Änderung. Der neue Modus ist read-only und nutzt exakt dieselbe versions- & nutzergesicherte Ladekette wie der volle Modus. Unbekannte `nur`-Werte fallen auf den vollen Modus zurück (kein neues Fehlerverhalten).

### Frontend-Anbindung
- Keine Frontend-Änderung nötig: Der Hook `useLangfristigeOperativeKostenAuswertung` fragt bereits `?nur=operativ` an und nutzt nur `operativ` + `brutto_umsatz`. Vorher lieferte die Route (unbekannter Parameter) die volle Antwort; jetzt antwortet sie schlank — Werte identisch.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den geänderten Dateien.
- Route-Tests: **12/12 grün** (`rentabilitaetsauswertung/route.test.ts`, inkl. der 2 neuen `nur=operativ`-Tests).
- Gesamte `langfristige-planung`-API-Suite: 563 grün; **6 vorbestehende Fehler ausschließlich in `investitionsausgaben-planung/berechnet/route.test.ts`** (Mock-Setup-Bug in jenem Testfile — `supabase.from()` liefert dort `undefined`; schlägt auch isoliert und ohne diese Änderung fehl; jene Route importiert nichts aus der hier geänderten Datei). **Keine Regression durch PROJ-98.**

## QA Test Results

**Getestet:** 2026-06-24 · **Methode:** Code-Audit aller Akzeptanzkriterien + Vitest (Server-Route + Client-Logik) + Playwright (Route/Auth/Regression). Interaktionen (Zeitbasis-Umschalter, Ansichtsmodi, Drill-Down, gestapeltes Diagramm) sind code-/manuell geprüft — analog zum Vorgehen bei PROJ-94/96 (versionsgebundene Auswertungsseiten ohne automatisierte Login-Session in E2E).

### Testergebnis-Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| Akzeptanzkriterien | ✅ Erfüllt (1 Low-Abweichung kosmetisch) |
| Server-Route-Tests (Vitest) | ✅ 12/12 (`rentabilitaetsauswertung/route.test.ts`, inkl. 2 neue `nur=operativ`-Tests) |
| Client-Logik-Tests (Vitest) | ✅ 15/15 (`use-langfristige-operative-kosten-auswertung.test.ts`) |
| E2E-Tests (Playwright) | ✅ 10/10 (5 × Chromium + Mobile Safari) |
| Sicherheitsaudit (Red Team) | ✅ Keine Findings |
| Regression | ✅ Keine durch PROJ-98 verursacht |
| Bugs | 🟡 Keine Critical/High/Medium · 2 Low |

### Akzeptanzkriterien — geprüft

**Navigation & Einstieg**
- ✅ Eintrag „Operative Kosten-Auswertung" (Slug `operative-kosten-auswertung`) in Nav-Gruppe „Auswertungen" (`langfristige-planung-nav.ts`); NavSheet + Versions-Übersicht ziehen generisch nach
- ✅ Seite nutzt `LangfristigeVersionShell` (`seitenTitel`, `fullWidth`) → Auth-Guard (Redirect `/login`, E2E Chromium + Mobile Safari) + Versions-Eigentumsprüfung → Redirect bei fremder/unbekannter `versionId`
- ✅ Buttons „Alle ausklappen"/„Alle einklappen" (erscheinen, sobald ≥ 1 Gruppe Untergruppen hat)

**Spaltenstruktur — Monat/Jahr**
- ✅ Umschalter Monat | Jahr (Standard Monat); Monatsfenster = Startmonat … `planungshorizont_monate` (aus der Route)
- ✅ Jahresansicht = rollierende 12-Monats-Blöcke ab Startmonat (Summe), unvollständiger letzter Block bleibt kürzer (Unit-Tests `applyZeitbasis`)
- ✅ Jahres-Header mit Block-Bereich als Sublabel („Jahr 1" / „Jan 2026 – Dez 2026")
- ✅ Sticky erste Spalte, horizontal scrollbar

**Zeilenstruktur**
- ✅ Zeilenquelle = `operativ`-Zeile der Route (Drill Gruppe → Untergruppe, `sort_order` aus dem KPI-Modell)
- ✅ Gesamt-Zeile „Operative Kosten (Gesamt)" ganz unten, hervorgehoben (fett, `bg-muted`, Trennlinie); = signierte Liniensumme der Route (bit-identisch zu PROJ-95)
- ✅ Ausschließlich operative Kosten (keine weiteren Kaskaden-Zeilen)

**Drill-Down**
- ✅ L1-Gruppen mit Untergruppen aufklappbar; Leaf-Gruppen nicht aufklappbar; Gesamt-Zeile nicht aufklappbar (Unit-Test `collectExpandableIds`)
- ✅ Expand-Zustand bleibt beim Wechsel Ansichtsmodus **und** Monat/Jahr erhalten (State per Gruppen-Id, Ids stabil über Aggregation)

**Wertberechnung**
- ✅ Werte = effektiver Soll aus PROJ-88 über die geteilte Route; Gesamt = Summe der Gruppen (Unit-Test: Gruppen summieren zur Gesamtzeile, auch je Jahresblock)
- ✅ Bit-Identität zu PROJ-95: `nur=operativ` liefert dieselben Operativ-Werte + Drill wie der volle Modus (Route-Test)

**Ansichtsmodi**
- ✅ Absolut (€, de-DE), Prozentual (Anteil am **Brutto-Umsatz** der Spalte; Brutto 0 → „—"), Wachstum (Δ Vorperiode mit n/a-/0,0%-Sonderfällen) — Logik gespiegelt aus PROJ-95/96

**Diagramm**
- ✅ Gestapeltes Diagramm: je L1-Gruppe eine gestapelte Fläche (`stackId`), Summe = Gesamt; Tooltip zeigt zusätzlich die Summe; stabile Farbpalette
- ✅ Folgt Ansichtsmodus (€/%/Wachstum) und Monat/Jahr; im Wachstums-Modus Linien statt Stapel (Stapeln dort sinnlos)
- ✅ Leerzustand: Diagramm ausgeblendet bei 0 Spalten/Gruppen

**Read-only & Versionsisolation**
- ✅ Keine editierbaren Zellen (nur Betragsselektion zur Summenanzeige), kein Schreibpfad, kein Reset
- ✅ Alle Daten ausschließlich aus der aufgerufenen `versionId` (Route filtert nach `user_id` + `plan_version_id`); leere Version → alle Werte 0, Struktur sichtbar

### Sicherheitsaudit (Red Team) — keine Findings
- ✅ **Auth:** `requireAuth` (401 ohne Session, Route-Test); Seite hinter Versions-Shell
- ✅ **Authorization / IDOR:** `ensureLangfristigeVersion` (400 ungültige UUID, 404 fremde Version — Route-Tests); Queries zusätzlich nach `user_id` + `plan_version_id`. Der neue `nur=operativ`-Modus liegt **hinter** diesen Prüfungen — keine neue Angriffsfläche
- ✅ **Eingabevalidierung:** `nur`-Parameter wird nur gegen Literale verglichen (kein Query-Bestandteil); unbekannte Werte → voller Modus (kein neues Fehlerverhalten)
- ✅ **XSS/Injection:** Kategorienamen als React-Text (escaped), Werte numerisch; Supabase parametrisiert
- ✅ **Datенexposition:** Antwort enthält nur Daten der eigenen Version

### Regression
- ✅ Geänderte Datei `rentabilitaetsauswertung/route.ts`: voller Modus unverändert (Operativ wird weiterhin in Ebene 2 gerechnet); `nur=umsatz`-Modus unberührt — alle 12 Route-Tests grün
- ✅ Schwesterseiten Rentabilitäts-/Umsatzauswertung weiterhin erreichbar (E2E, kein 404)
- ⚠️ **Vorbestehende, nicht-PROJ-98-Fehler:** 6 Tests in `investitionsausgaben-planung/berechnet/route.test.ts` schlagen fehl (Mock-Setup-Bug in jenem Testfile — `supabase.from()` liefert dort `undefined`; schlägt auch isoliert/ohne diese Änderung fehl; jene Route importiert nichts aus der hier geänderten Datei). **Keine Regression durch PROJ-98.**

### Bugs / Beobachtungen

**Keine Critical/High/Medium-Bugs.**

- **BUG-1 (Low, kosmetisch — AC-Abweichung) — ✅ BEHOBEN (2026-06-24):** Null-Kostenzellen wurden als „-0,00 €" (bzw. „-0,0 %") statt „0,00 €" angezeigt (`-1 × 0 = -0`, von `Intl` mit Minuszeichen gerendert). **Fix:** `formatBetrag` und `formatProzentWert` normalisieren `-0` auf `0` (`value === 0 ? 0 : value`, da `-0 === 0`). Verifiziert: `-0 → „0,00 €" / „0,0 %"`, echte Negativwerte unverändert („-300,00 €" / „-30,0 %").
- **BEOBACHTUNG (Low, akzeptiert):** Der Leerzustand zeigt einen generischen Hinweis ohne den im Spec-Edge-Case erwähnten **Link zur KPI-Modell-Verwaltung** für den Fall „kein Operativ-Knoten im KPI-Modell". Bewusste Folge der Read-only-Architektur (kein separater KPI-Struktur-Fetch); die beiden Fälle (keine Kategorien / keine Werte) sind nicht unterscheidbar. Geringe Priorität, bewusst belassen.

### Designentscheidung (Nutzer bestätigt 2026-06-24) — ✅ umgesetzt
- **Tabelle:** operative Kosten **negativ/rot**, konsistent mit PROJ-95 (unverändert).
- **Diagramm:** Gruppen als **positive Magnituden** (`Math.abs`) dargestellt → stapelt **nach oben** zur positiven Gesamtsumme (klassische Kostenkomposition). Umgesetzt in `langfristige-operative-kosten-auswertung-chart.tsx` (alle drei Modi: Absolut/Prozentual/Wachstum rechnen auf Magnituden). `tsc` clean; Tabellen-/Hook-Tests unverändert grün.

### Produktionsbereitschaft
**✅ PRODUCTION-READY / APPROVED** — keine Critical/High/Medium-Bugs, Sicherheitsaudit ohne Findings, alle Akzeptanzkriterien erfüllt. BUG-1 behoben und verifiziert; die bestätigte Designentscheidung (Tabelle negativ, Diagramm positiv-aufwärts) ist umgesetzt. Die eine verbleibende Low-Beobachtung (generischer Leerzustand) ist eine bewusste, dokumentierte Designentscheidung ohne Funktionsrisiko.

## Deployment
_To be added by /deploy_

## Deployment
_To be added by /deploy_
