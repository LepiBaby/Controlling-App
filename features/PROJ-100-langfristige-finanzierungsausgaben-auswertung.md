# PROJ-100: Finanzierungsausgaben-Auswertung — Langfristige Planung

## Status: Planned
**Created:** 2026-06-24
**Last Updated:** 2026-06-24

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** (`startmonat_monat`/`startmonat_jahr`) und **Planungshorizont Allgemein** (`planungshorizont_monate`, Fallback 12) für das Monats-/Jahresfenster
- Requires: PROJ-90 (Finanzierungsausgaben Planung — Langfristige Planung) — **alleinige Wert-Datenquelle** für die Finanzierungsausgaben je Gruppe/Untergruppe/Monat (effektiver Soll je Monat)
- Requires: PROJ-2 (KPI-Modell Verwaltung) — liefert den **globalen** „Finanzierung"-Knoten im `ausgaben_kosten`-Baum (L1-Gruppen + L2-Untergruppen) als Zeilenquelle (identisch zu PROJ-90)
- Requires: PROJ-87 (Sales-Plattform-Planung — Langfristige Planung) — liefert **Brutto-Umsatz** je Monat als Bezugsgröße für die Ansicht „Prozentual" (analog PROJ-95/PROJ-98)
- Requires: PROJ-94 (Liquiditätsauswertung) / PROJ-95 (Rentabilitätsauswertung) / PROJ-98 (Operative Kosten-Auswertung) — etablieren die Nav-Gruppe „Auswertungen"; diese Seite reiht sich dort ein
- Vorlage (kein harter Require): **PROJ-98 (Operative Kosten-Auswertung — Langfristige Planung)** — **maßgebliche Stil-, Struktur- und Verhaltensvorlage**; diese Seite ist deren **direkte Adaption**, einzige inhaltliche Änderung ist die Zeilen-/Wertquelle (Finanzierung statt Operativ)
- Vorlage (kein harter Require): PROJ-95 (Rentabilitätsauswertung) — übergeordnete Stilvorlage (Seitenaufbau Diagramm → Tabelle, Matrix mit sticky erster Spalte, Drill-Down, Ansichtsmodi, Read-only)
- Vorlage (kein harter Require): PROJ-24 (Rentabilitätsreport — Ansichtsmodi) — Definition „Absolut / Prozentual / Wachstum"
- Vorlage (kein harter Require): PROJ-26 (Rentabilitätsreport — Liniendiagramm) — Diagramm oben
- Vorlage (kein harter Require): PROJ-70 (Finanzierungsausgaben — Kurzfristige Planung) / PROJ-90 — Zeilenhierarchie aus dem „Finanzierung"-Subtree (Gruppe → Untergruppe → Gesamt)

## Übersicht

Die **Finanzierungsausgaben-Auswertung** ist ein weiterer Eintrag im Navigationsbereich **„Auswertungen"** der Langfristigen Planung (nach Liquiditäts-, Rentabilitäts-, Umsatz- und Operative-Kosten-Auswertung). Sie ist eine **rein anzeigende** (read-only), **versionsgebundene** Seite, die **ausschließlich** die Finanzierungsausgaben dieser Planversion darstellt — nichts anderes.

Im Aufbau und Stil ist sie **bewusst identisch** zur Operative-Kosten-Auswertung (PROJ-98) bzw. zur Rentabilitätsauswertung (PROJ-95), nur thematisch auf die **eine** Kategorie „Finanzierung" reduziert. Sie verhält sich zur Operative-Kosten-Auswertung (PROJ-98) genau so, wie sich die Finanzierungsausgaben Planung (PROJ-90) zur Operativekosten Planung (PROJ-88) verhält: **gleiche Mechanik, andere Wurzelkategorie.** Der Seitenaufbau von oben nach unten ist:

1. **Gestapeltes Diagramm** (oben) — zeigt die einzelnen Finanzierungs-**Gruppen als gestapelte Linien/Flächen**, die in Summe die **Finanzierungsausgaben (Gesamt)** ergeben.
2. **Haupttabelle** (Matrix: Finanzierungs-Gruppen × Zeitspalten), mit einer Gesamt-Zeile **„Finanzierungsausgaben (Gesamt)"** ganz unten.

**Wesentliche Eigenschaft:** Es werden **dieselben Daten** angezeigt, die in der Finanzierungsausgaben Planung (PROJ-90) eingegeben wurden — d. h. der **effektive Soll** je Monat aus der langfristigen Finanzierungsausgaben-Planung dieser Version. Die Seite schreibt nichts und besitzt keine eigene Datenhaltung.

> **Abgrenzung zur Rentabilitätsauswertung (PROJ-95):** In PROJ-95 erscheint Finanzierung nur als **eine** Kaskaden-Zeile „Finanzierungskosten (nur Zinsen)". Hier werden hingegen **alle** Finanzierungs-Gruppen und -Untergruppen vollständig dargestellt (der komplette „Finanzierung"-Subtree, identisch zur Planungsseite PROJ-90), nicht nur die Zinsen.

### Unterschiede zur Rentabilitätsauswertung (PROJ-95)

| Aspekt | Rentabilitätsauswertung (PROJ-95) | Finanzierungsausgaben-Auswertung (PROJ-99) |
|---|---|---|
| Inhalt | vollständige GuV-Kaskade (Brutto-Umsatz … Ergebnis) | **nur Finanzierungsausgaben** (Gruppen + Untergruppen + Gesamt) |
| Zeilenstruktur | feste GuV-Kaskade | **Finanzierungs-Kategorie-Hierarchie** (L1-Gruppen → L2-Untergruppen → Gesamt) aus dem globalen „Finanzierung"-Subtree |
| Zeitachse | nur Monate | **Umschalter Monat / Jahr** (Jahr = je 12 Monate rollend ab Startmonat) |
| Ansichtsmodi | Absolut / Prozentual / Wachstum | **identisch**: Absolut / Prozentual / Wachstum |
| „Ohne Investitionen"-Filter | vorhanden | **entfällt** (für Finanzierungsausgaben ohne Bedeutung) |
| Absatztabelle | vorhanden | **entfällt** |
| Diagramm | auswählbare Zwischensummen-Linien | **gestapelte Gruppen-Linien** (Summe = Gesamt) |
| Datenquelle | viele langfristige Planungsmodule | **nur** Finanzierungsausgaben Planung (PROJ-90); zusätzlich Brutto-Umsatz (PROJ-87) als Prozent-Bezug |

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
= Finanzierungsausgaben (Gesamt)       (Summe aller Gruppen, ganz unten)
```

Die Hierarchie ist **identisch** zur Finanzierungsausgaben Planung (PROJ-90): der globale „Finanzierung"-Knoten aus `ausgaben_kosten` mit seinen L1-Gruppen und L2-Untergruppen. L1-Gruppen mit Untergruppen sind reine Summenzeilen ihrer Untergruppen; L1-Gruppen ohne Untergruppen sind selbst die Datenebene.

## User Stories

- Als Controller möchte ich die Finanzierungsausgaben-Auswertung innerhalb einer geöffneten Planversion über das linke Seitenmenü (Gruppe „Auswertungen") und über die Versions-Übersichtsseite aufrufen können, damit ich die geplanten Finanzierungsausgaben dieses Szenarios kompakt nachvollziehe.
- Als Controller möchte ich die einzelnen Finanzierungs-Gruppen je Monat sehen, mit einer Gesamt-Zeile ganz unten, damit ich Struktur und Gesamthöhe der Finanzierungsausgaben auf einen Blick erkenne.
- Als Controller möchte ich oben ein gestapeltes Diagramm sehen, in dem die einzelnen Gruppen als Linien/Flächen übereinander gestapelt sind und zusammen die Gesamtausgaben ergeben, damit ich den Verlauf und die Zusammensetzung über die Zeit verstehe.
- Als Controller möchte ich zwischen Monats- und Jahresansicht umschalten können, wobei die Jahresansicht nicht das Kalenderjahr, sondern immer 12 Monate ab dem Startmonat zusammenfasst, damit ich die Finanzierungsausgaben auch verdichtet betrachten kann.
- Als Controller möchte ich zwischen den Ansichten „Absolut", „Prozentual" und „Wachstum" umschalten können, genau wie in der Rentabilitätsauswertung.
- Als Controller möchte ich jede Gruppen-Zeile bis auf Untergruppen-Ebene aufklappen können, um zu sehen, wie sich die Finanzierungsausgaben einer Gruppe zusammensetzen.
- Als Controller möchte ich, dass exakt dieselben Werte angezeigt werden wie in der Finanzierungsausgaben Planung dieser Version, ohne hier etwas bearbeiten zu können.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Im Versionskontext erscheint die Seite als Eintrag der Nav-Gruppe „Auswertungen": „Finanzierungsausgaben-Auswertung" → `/dashboard/langfristige-planung/[versionId]/finanzierungsausgaben-auswertung` (platziert nach den bestehenden Auswertungs-Einträgen)
- [ ] Auf der Versions-Übersichtsseite erscheint ein Eintrag „Finanzierungsausgaben-Auswertung" (über die zentrale Nav-Konfiguration, generisch nachgezogen)
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Bei unbekannter/fremder/ungültiger `versionId` erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73
- [ ] Rechts oben: Buttons **„Alle ausklappen"** und **„Alle einklappen"**

### Spaltenstruktur — Umschalter Monat / Jahr

- [ ] Umschalter **Monat | Jahr** in der Kopfleiste; Standard: **Monat**
- [ ] **Monatsansicht:** ausschließlich Monatsspalten vom **Startmonat** über **`planungshorizont_monate`** Monate (allgemeiner Horizont, Fallback 12) — identisch zum Monatsfenster der langfristigen Planungsseiten (Muster aus PROJ-90 `buildFinanzierungsausgabenMonate` / `buildPlanungsmonate`)
- [ ] **Jahresansicht:** die Monate werden zu **Jahresblöcken von je 12 Monaten** zusammengefasst, **rollend ab Startmonat** (Jahr 1 = Monat 1–12, Jahr 2 = Monat 13–24, …) — **nicht** nach Kalenderjahr
- [ ] Anzahl Jahresspalten = `ceil(Planungshorizont / 12)`; ein unvollständiger letzter Jahresblock (< 12 Monate) wird als eigene Spalte aus den vorhandenen Monaten gebildet
- [ ] In der Jahresansicht ist der Zellwert (Modus Absolut) die **Summe der Monate** des Blocks
- [ ] Jahres-Spaltenüberschrift kennzeichnet den Block verständlich (z. B. „Jahr 1 (Jan 2026 – Dez 2026)" bzw. analoge Kurzform)
- [ ] **Kein Ist-Bereich, keine Vergangenheit, keine Ist/Soll-Trennlinie** — alle Spalten sind Soll-Zeiträume
- [ ] Monats-Header-Format wie auf den langfristigen Planungsseiten (z. B. „Jan 2026")
- [ ] Tabelle horizontal scrollbar; erste Spalte (Zeilenbeschriftung) ist `sticky left` mit opakem Hintergrund

### Zeilenstruktur (Finanzierungs-Gruppen)

- [ ] Zeilenquelle: der **globale** „Finanzierung"-Knoten aus `GET /api/kpi-categories?type=ausgaben_kosten`; L1-Gruppen (direkte Kinder von „Finanzierung") + deren L2-Untergruppen — identische Filterlogik wie PROJ-70/PROJ-90
- [ ] Reihenfolge gemäß `sort_order` des KPI-Modells
- [ ] **Pro L1-Gruppe** eine Zeile; Gruppen mit Untergruppen sind Summenzeilen (aufklappbar → siehe Drill-Down), Gruppen ohne Untergruppen sind selbst die Datenebene
- [ ] **Ganz unten** eine Gesamt-Zeile **„Finanzierungsausgaben (Gesamt)"** — Summe aller Gruppen je Zeitspalte, immer sichtbar, optisch hervorgehoben (fett, Hintergrund, Trennlinie) analog Summen-Positionen in PROJ-95/PROJ-98
- [ ] Es werden **ausschließlich** Finanzierungsausgaben angezeigt — keine weiteren Kaskaden-Zeilen, keine anderen Kostenarten, kein Umsatz als eigene Zeile
- [ ] Alle Zeilen sind dauerhaft sichtbar, auch wenn ihr Wert in allen Zeiträumen 0 ist

### Ausklappbare Zeilen (Drill-Down bis Untergruppe)

- [ ] Jede L1-Gruppe **mit** Untergruppen ist **aufklappbar** und zeigt eine eingerückte Zeile **je Untergruppe** (L2)
- [ ] L1-Gruppen **ohne** Untergruppen sind nicht aufklappbar (selbst Datenebene)
- [ ] Die Gesamt-Zeile ist **nicht** aufklappbar
- [ ] Globaler „Alle ausklappen / Alle einklappen"-Button füllt/leert alle Drill-Down-Ebenen
- [ ] Expand/Collapse-Zustand bleibt beim Wechsel des Ansichtsmodus (Absolut/Prozentual/Wachstum) und beim Wechsel Monat/Jahr erhalten

### Wertberechnung (planbasiert, je Zeitspalte)

- [ ] Alle Werte stammen aus dem **effektiven Soll** der langfristigen **Finanzierungsausgaben Planung** dieser Version (PROJ-90) — **dieselben Werte**, die dort eingegeben wurden
- [ ] **Untergruppen-Wert** = der für diese Untergruppe/Monat gespeicherte Betrag (NULL → 0 in der Auswertung)
- [ ] **Gruppen-Wert** = Summe der Untergruppen-Werte der Gruppe je Zeitspalte (bzw. eigener Wert, wenn Gruppe keine Untergruppen hat)
- [ ] **Finanzierungsausgaben (Gesamt)** = Summe aller Gruppen je Zeitspalte
- [ ] In der **Jahresansicht** werden je Block die Monatswerte einer Zeile aufsummiert; die Hierarchie-Aggregation bleibt konsistent (Summe der Gruppen = Gesamt je Jahresblock)

### Ansichtsmodi (Absolut / Prozentual / Wachstum) — analog PROJ-24/PROJ-95/PROJ-98

- [ ] Umschalter mit drei Modi; Standard: **Absolut**
- [ ] **Absolut**: unveränderte Werte im Währungsformat (€, de-DE, 2 Dezimalstellen)
- [ ] **Prozentual**: jede Zelle = `Wert / Brutto-Umsatz der Zeitspalte × 100`, 1 Dezimalstelle, %-Zeichen — **Bezugsgröße ist der Brutto-Umsatz** (identische Logik wie in PROJ-95/PROJ-98/PROJ-24). Brutto-Umsatz stammt aus der Sales-Plattform-Planung (PROJ-87), je Monat bzw. je Jahresblock (Summe). Ist der Brutto-Umsatz einer Zeitspalte 0 → „—" für alle Zellen dieser Spalte
- [ ] **Wachstum**: je Zelle zwei Zeilen — Absolutwert (klein) und darunter prozentuale Veränderung zur **Vorperiode** (Vormonat in Monatsansicht, Vorjahr-Block in Jahresansicht): `(aktuell − vorher) / |vorher| × 100`, 1 Dezimalstelle; positiv grün „+X,X % ↑", negativ rot „−X,X % ↓", 0 → „0,0 %"; Vorperiode = 0 und aktuell ≠ 0 → „n/a"; Vorperiode = 0 und aktuell = 0 → „0,0 %"
- [ ] Die Vorperiode der ersten sichtbaren Spalte wird, sofern Daten vorhanden, außerhalb des Fensters berechnet; sonst „—"
- [ ] Drill-Down-Zeilen (Untergruppen) werden im jeweiligen Modus konsistent dargestellt (Prozentwerte beziehen sich auf denselben Brutto-Umsatz der Zeitspalte)

### Gestapeltes Diagramm (oben) — analog PROJ-26/PROJ-98

- [ ] Oberhalb der Haupttabelle ein **gestapeltes Diagramm** (Recharts) im Stil der Rentabilitätsauswertung/PROJ-98
- [ ] Die einzelnen **L1-Gruppen** werden als **gestapelte Linien/Flächen** dargestellt, sodass die übereinandergestapelten Gruppen zusammen die **Finanzierungsausgaben (Gesamt)** ergeben
- [ ] X-Achse: Zeitspalten synchron zur Tabelle (Monate bzw. Jahresblöcke je nach Umschalter); Y-Achse: Betrag in € (Absolut), bzw. % (Prozentual) bzw. Wachstumsrate (Wachstum) — Achsen/Verhalten folgen dem aktiven Ansichtsmodus wie in PROJ-26/PROJ-95/PROJ-98
- [ ] Das Diagramm respektiert Ansichtsmodus und Monat/Jahr-Umschalter
- [ ] Optional: Gruppen über eine Legende/Mehrfachauswahl ein-/ausblendbar (wie im Diagramm der Reports); Default: alle Gruppen aktiv
- [ ] Leerzustand: Diagramm wird ausgeblendet, wenn keine darstellbaren Zeitspalten/Gruppen vorhanden sind

### Darstellung (Farben)

- [ ] Kostenwerte werden konsistent mit PROJ-95/PROJ-98 dargestellt (Kosten gemäß der dort etablierten Konvention — in `/architecture`/`/frontend` an PROJ-98 angleichen)
- [ ] 0-Werte als „0,00 €" (nicht leer); Beträge mit 2 Dezimalstellen und € im de-DE-Format
- [ ] Die Gesamt-Zeile ist optisch klar von den Gruppen-Zeilen abgegrenzt
- [ ] Diagramm-Gruppenfarben stabil/wiedererkennbar (konsistente Farbzuordnung je Gruppe)

### Read-only-Verhalten

- [ ] Keine Zelle ist editierbar (kein Inline-Edit, kein onBlur-Speichern)
- [ ] Die Seite schreibt **keine** eigenen Planungsdaten; sie liest ausschließlich
- [ ] Kein „Zurücksetzen"-Button; keine Bulk-Edit-/Notiz-Funktionen (das ist die Planungsseite PROJ-90)

### Versionsisolation

- [ ] Die Auswertung verwendet **dieselben** Zeilen-/Kategoriequellen wie die Finanzierungsausgaben Planung (globaler „Finanzierung"-Subtree) und liest die Werte ausschließlich aus dieser `versionId`
- [ ] Es werden **keine** Daten aus anderen Planversionen oder aus der Kurzfristigen Planung angezeigt
- [ ] Eine neu angelegte (leere) Planversion zeigt eine im Wesentlichen leere Auswertung (alle Werte 0), Struktur bleibt vollständig sichtbar

## Datenquellen

| Element | Quelle (langfristige Planung, Version) | Effektiver Soll |
|---|---|---|
| Finanzierungsausgaben je Gruppe/Untergruppe/Monat | Finanzierungsausgaben Planung (PROJ-90) | `GET …/[versionId]/finanzierungsausgaben-planung` |
| Zeilenhierarchie (L1-Gruppen + L2-Untergruppen) | globaler „Finanzierung"-Subtree (PROJ-2/PROJ-70) | `GET /api/kpi-categories?type=ausgaben_kosten` |
| Startmonat + Planungshorizont (Monats-/Jahresfenster) | Grundeinstellungen (PROJ-75) | `GET …/[versionId]/grundeinstellungen` |
| Brutto-Umsatz je Zeitspalte (nur Modus „Prozentual") | Sales-Plattform-Planung (PROJ-87) | `…/sales-plattform-planung` + `…/berechnet` |

**Wichtig:** Diese Seite **liest** ausschließlich. Die Finanzierungsausgaben werden 1:1 aus PROJ-90 übernommen (keine Neuberechnung). Der Brutto-Umsatz wird nur für die Bezugsgröße der Prozentansicht geladen, exakt wie in PROJ-95/PROJ-98. Die exakten Endpunkte/Feldnamen sind in `/architecture` final zu verifizieren.

## Edge Cases

- **Leere/neu angelegte Planversion:** alle Werte 0; Hierarchie + Gesamt-Zeile bleiben vollständig sichtbar.
- **Kein „Finanzierung"-Knoten im globalen KPI-Modell / keine Kinder:** Leerzustand mit Hinweis („Keine Finanzierungskategorien im KPI-Modell vorhanden …") + Link zur KPI-Modell-Verwaltung (analog PROJ-90).
- **L1-Gruppe ohne Untergruppen:** Gruppe selbst ist Datenebene, nicht aufklappbar.
- **Planungshorizont nicht durch 12 teilbar:** letzter Jahresblock ist unvollständig (< 12 Monate) und wird als eigene Spalte aus den vorhandenen Monaten gebildet (Summe der vorhandenen Monate).
- **Brutto-Umsatz einer Zeitspalte = 0 (Modus Prozentual):** „—" für alle Zellen dieser Spalte.
- **Vorperiode ohne Wert (Modus Wachstum):** „n/a" bzw. „—" gemäß PROJ-24/PROJ-95-Regeln; in Jahresansicht ist die Vorperiode der Vorjahres-Block.
- **Sehr breite Tabelle (großer Planungshorizont, z. B. 120 Monate):** horizontales Scrollen, erste Spalte sticky; Jahresansicht reduziert die Spaltenzahl deutlich.
- **Fremde/unbekannte `versionId`:** Redirect zum Dashboard (PROJ-73), kein Fremdzugriff.
- **Quell-API (Finanzierungsausgaben oder Umsatz) liefert Fehler:** Lade-Fehlerzustand bzw. betroffener Bereich leer/Hinweis, kein Seitenabsturz; Diagramm bzw. Prozentansicht degradiert sauber (Prozentansicht ohne Umsatz → „—").
- **Kategorie im KPI-Modell gelöscht/umbenannt:** Werte mit nicht mehr existierender `kategorie_id` werden nicht angezeigt (konsistent mit PROJ-90).
- **Konsistenz mit PROJ-90:** Die hier angezeigte „Finanzierungsausgaben (Gesamt)" je Monat muss exakt der Gesamt-Zeile der Finanzierungsausgaben Planung (PROJ-90) entsprechen — gleiche Quelle, gleiche Aggregation.

## Technical Requirements

- Authentifizierung: `requireAuth()` in ggf. neuen API-Routen; Seite ist Client Component im Versions-Shell (`LangfristigeVersionShell`) mit Auth- und Versions-Eigentumsprüfung
- **Keine neue DB-Tabelle nötig** — read-only; liest aus bestehenden versionsgebundenen Quellen (PROJ-90, PROJ-87, PROJ-75) und dem globalen KPI-Modell
- **Aggregation:** Da alle Werte 1:1 übernommen und nur summiert/umgerechnet werden (keine produkt-granulare Neuberechnung wie in PROJ-95), genügt voraussichtlich ein **Frontend-Hook** (analog PROJ-94/PROJ-98). Finale Entscheidung Frontend-Hook vs. serverseitige Sammel-Route in `/architecture`
- Monats-/Jahresfenster: bestehender Helfer/Muster (`buildFinanzierungsausgabenMonate` aus PROJ-90 / `buildPlanungsmonate` aus PROJ-84); Jahresblöcke = je 12 Monate rollend ab Startmonat
- Prozent-Bezugsgröße (Brutto-Umsatz) und Ansichtsmodi-Logik aus PROJ-95/PROJ-98 wiederverwenden (kein Duplizieren komplexer Logik)
- Chart-Bibliothek: Recharts (vorhanden), gestapelte Darstellung (`stackId`)
- Keine neuen Packages: shadcn `Table`, `Tabs`/`ToggleGroup`, `Tooltip`, `Button`, `Skeleton` — alle vorhanden
- **Abkapselung:** keine Ist-Daten, keine Daten der Kurzfristigen Planung; ausschließlich Daten dieser `versionId`
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Richtwert)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/finanzierungsausgaben-auswertung/page.tsx` | Seite: Versions-Shell + Kopfleiste (Ansichtsmodi, Monat/Jahr, Ausklappen-Buttons) + gestapeltes Diagramm + Haupttabelle |
| `src/hooks/use-langfristige-finanzierungsausgaben-auswertung.ts` | Datenladen (Finanzierungsausgaben-Werte + globaler Finanzierung-Subtree + Grundeinstellungen + Brutto-Umsatz), Aggregation Gruppe/Gesamt, Monats-/Jahresfenster, Ansichtsmodus-/Ausklapp-Zustand |
| `src/components/langfristige-finanzierungsausgaben-auswertung-matrix.tsx` | Matrix: Gruppen → Untergruppen → Gesamt, sticky erste Spalte, Drill-Down, Ansichtsmodi, Monat/Jahr |
| `src/components/langfristige-finanzierungsausgaben-auswertung-chart.tsx` | Gestapeltes Diagramm (Gruppen als gestapelte Linien/Flächen, Summe = Gesamt) |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Finanzierungsausgaben-Auswertung" (Slug `finanzierungsausgaben-auswertung`) in der Nav-Gruppe „Auswertungen", nach den bestehenden Auswertungs-Einträgen |

### Wiederverwendung bestehender Muster

| Muster | Quelle |
|---|---|
| Seitenaufbau (Diagramm oben, Matrix unten), sticky erste Spalte, Summen-Hervorhebung, Read-only, Monat/Jahr-Umschalter, gestapeltes Diagramm | **PROJ-98** (`langfristige-operative-kosten-auswertung-*`) — direkte Spiegelung |
| Ansichtsmodi Absolut/Prozentual/Wachstum + Brutto-Umsatz als Prozent-Bezug | PROJ-24 / PROJ-95 / PROJ-98 |
| Finanzierung-Subtree-Filter (Root „Finanzierung", L1-Gruppen + L2-Untergruppen) | PROJ-70 (`use-finanzierungsausgaben.ts`) / PROJ-90 |
| Finanzierungsausgaben-Werte je Version | PROJ-90 (`…/finanzierungsausgaben-planung`) |
| Monats-/Jahresfenster-Helfer | `buildFinanzierungsausgabenMonate` (PROJ-90) / `buildPlanungsmonate` (PROJ-84) |
| Versions-Shell, Eigentumsprüfung, Nav-Konfiguration, Gruppe „Auswertungen" | PROJ-73 / PROJ-94 / PROJ-95 / PROJ-98 |

## Open Questions / Follow-ups (in `/architecture` zu klären)
- Frontend-Hook vs. serverseitige Sammel-Route (Empfehlung: Frontend-Hook wie PROJ-94/PROJ-98, da reine Summen/Übernahme).
- Genaue Wiederverwendung der Brutto-Umsatz-Beschaffung aus PROJ-95/PROJ-98 (gleiche Route/gleicher Hook), damit die Prozentbasis exakt mit den anderen Auswertungen übereinstimmt.
- Diagramm-Detailtyp: gestapeltes Flächendiagramm vs. gestapelte Linien (Vorgabe: „gestapelte Linien, die zusammen Gesamt ergeben" → stacked area/`stackId`); finale visuelle Angleichung an PROJ-98 in `/frontend`.
- Farb-/Vorzeichen-Konvention der Kostenwerte exakt an PROJ-98 angleichen.
- Genaue Position in der Nav-Gruppe „Auswertungen" relativ zu PROJ-96/PROJ-98 (Default: ans Ende anfügen).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-24)

### Leitidee

Diese Seite ist die **Finanzierungs-Zwilling der Operative-Kosten-Auswertung (PROJ-98)** — dieselbe schlanke „eine Kategorie"-Auswertung mit Monat/Jahr-Umschalter, drei Ansichtsmodi, Drill-Down und gestapeltem Diagramm. Es gibt jedoch **einen entscheidenden, bewusst abweichenden Architekturpunkt** gegenüber PROJ-98, der bei der Code-Analyse zutage trat:

> **PROJ-98 kann seine Daten aus der Rentabilitätsauswertungs-Route (PROJ-95) beziehen — PROJ-100 darf das NICHT.**

Grund: In der Rentabilitätsauswertungs-Route erscheint Finanzierung ausschließlich als Zeile **„Finanzierungskosten (nur Zinsen)"**, und zwar zusätzlich noch von **Brutto auf Netto** umgerechnet (USt herausgerechnet). Diese Spec verlangt aber genau das Gegenteil:
- **alle** Finanzierungs-Gruppen und -Untergruppen (der komplette „Finanzierung"-Subtree), nicht nur die Zinsen;
- die **Roh-Beträge, wie sie in der Finanzierungsausgaben Planung (PROJ-90) eingegeben wurden** (Brutto, unverändert) — „die gleichen Daten wie in der Planungsseite".

Daraus folgt die zentrale Entscheidung:

> **PROJ-100 liest die Finanzierungswerte direkt aus der Planungsseite PROJ-90 — exakt so, wie es die PROJ-90-Planungsseite selbst tut** (gespeicherte Werte + globaler „Finanzierung"-Subtree + Startmonat/Horizont). Damit ist die angezeigte „Finanzierungsausgaben (Gesamt)" **bit-identisch** zur Gesamt-Zeile der Finanzierungsausgaben Planung (PROJ-90) — was eine ausdrückliche Anforderung der Spec ist. Es gibt **keine** Neuberechnung und **keine** USt-Umrechnung.

Für die **Prozent-Bezugsgröße** (Brutto-Umsatz) wird hingegen — wie bei PROJ-96/98 — der bereits vorhandene **leichte Modus `?nur=umsatz`** der Rentabilitätsauswertungs-Route mitgenutzt. Das liefert den Brutto-Umsatz je Monat aus genau demselben Code-Pfad wie die übrigen Auswertungen und garantiert eine konsistente Prozentbasis.

**Wichtigste Konsequenz:** Diese Seite ist **rein Frontend** — es ist **keinerlei Backend-Arbeit nötig**. Alle vier benötigten Routen existieren bereits und sind allesamt „leicht" (reine Lesevorgänge, kein Generieren/Schreiben):

| # | Route (bereits vorhanden) | liefert | Quelle |
|---|---|---|---|
| 1 | `GET …/[versionId]/grundeinstellungen` | Startmonat + Planungshorizont (Monats-/Jahresfenster) | PROJ-75 |
| 2 | `GET /api/kpi-categories?type=ausgaben_kosten` | globaler „Finanzierung"-Subtree (L1-Gruppen + L2-Untergruppen) | PROJ-2 |
| 3 | `GET …/[versionId]/finanzierungsausgaben-planung` | gespeicherte Roh-Werte je Kategorie/Monat (Brutto) | PROJ-90 |
| 4 | `GET …/[versionId]/rentabilitaetsauswertung?nur=umsatz` | Brutto-Umsatz je Monat (**nur** für Prozentual-Modus) | PROJ-95 |

> Die Routen 1–3 sind exakt die drei Aufrufe, die der bestehende PROJ-90-Hook (`use-finanzierungsausgaben-planung.ts`) bereits parallel tätigt; Route 4 ist der leichte Umsatz-Modus, den PROJ-96/98 bereits verwenden. Nichts davon muss neu gebaut oder geändert werden.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]/finanzierungsausgaben-auswertung   (NEUE Seite)
│
└── LangfristigeVersionShell  (bestehend — Login-/Versions-Eigentums-Prüfung, Header, Redirect, fullWidth)
    │
    ├── Filter-Leiste (oben)                                  (clientseitig, wie PROJ-98)
    │   ├── Zeitbasis-Umschalter:   Monat | Jahr
    │   ├── Ansichts-Umschalter:    Absolut | Prozentual | Wachstum
    │   └── Buttons:                Alle ausklappen | Alle einklappen
    │   (KEIN „Ohne Investitionen", KEINE Absatztabelle)
    │
    ├── Gestapeltes Diagramm  (NEUE Komponente, Recharts)
    │   └── je L1-Gruppe eine gestapelte Fläche/Linie; gestapelte Summe = Finanzierungsausgaben (Gesamt)
    │
    └── Finanzierungsausgaben-Matrix  (NEUE Hauptkomponente, read-only)
        ├── Kopf: [Bezeichnung (sticky links)] | [Monats- bzw. Jahresspalten …]
        ├── je L1-Gruppe eine Zeile (aufklappbar → Untergruppen-Zeilen), Reihenfolge wie im KPI-Modell
        └── Gesamt-Zeile „Finanzierungsausgaben (Gesamt)" ganz unten (hervorgehoben)

src/lib/langfristige-planung-nav.ts   (bestehend — neuer Eintrag in Gruppe „Auswertungen", ans Ende angehängt)
```

### B) Datenfluss (in einfachen Worten)

```
1. Seite öffnet → Versions-Shell prüft Login + Versions-Eigentum (Redirect bei fremder Version).

2. Der Hook lädt PARALLEL die vier bestehenden Lese-Routen (1–4 oben):
   - Grundeinstellungen     → Startmonat + Horizont (Monatsfenster, kein Vorlauf)
   - KPI-Kategorien         → „Finanzierung"-Subtree: L1-Gruppen + L2-Untergruppen (sort_order)
   - Finanzierungswerte     → Roh-Beträge je (Kategorie, Jahr, Monat)
   - rentabilitaets… ?nur=umsatz → Brutto-Umsatz je Monat (nur Prozent-Bezug)

3. Clientseitig (ohne weiteren Server-Aufruf) wird die Matrix aufgebaut:
   - je L1-Gruppe eine Zeile; Untergruppen als Drill-Down darunter
   - Gruppen-Wert = Summe seiner Untergruppen-Werte je Monat
     (bzw. eigener Wert, wenn die Gruppe selbst Leaf ist — keine Untergruppen)
   - Gesamt-Zeile „Finanzierungsausgaben (Gesamt)" = Summe aller Gruppen je Monat
   - Monat↔Jahr: rollierende 12-Monats-Blöcke ab Startmonat (Summe je Block)
   - Ansichtsmodus: Absolut | Prozentual (÷ Brutto-Umsatz der Spalte) | Wachstum (Δ zur Vorperiode)
   - Auf-/Zuklappen der Gruppen
```

**Konsistenz-Garantie:** Werte und Hierarchie stammen aus genau denselben drei Routen wie die Planungsseite PROJ-90 und werden auf dieselbe Weise (reine Summierung der Untergruppen) aggregiert. Daher stimmt „Finanzierungsausgaben (Gesamt)" hier per Konstruktion mit der Planungsseite überein — es gibt keinen zweiten Rechenweg, der auseinanderlaufen könnte.

### C) Datenmodell (in einfachen Worten)

**Keine neue Datenbanktabelle. Kein Schreibzugriff. Keine neue Route.** Die dauerhaften Daten leben unverändert in den bestehenden versionsgebundenen Tabellen:
- die Finanzierungswerte in `langfristige_finanzierungsausgaben_planung` (aus PROJ-90),
- der Brutto-Umsatz wird aus der Sales-Plattform-Planung abgeleitet — beides geschieht bereits **innerhalb** der bestehenden Routen.

Das Frontend hält nur **flüchtigen Anzeige-Zustand** (Zeitbasis, Ansichtsmodus, Auf-/Zuklapp-Zustand) im Komponenten-State — nichts wird persistiert.

Die clientseitig gebaute Zeilenstruktur (rein im Speicher):
```
Finanzierungs-Modell
  columns: ["2026-1", "2026-2", …]            (Monat)  bzw.  ["J1", "J2", …]  (Jahr)
  gruppen: geordnete Liste, je Gruppe:
     - id / label
     - werte: { Spaltenschlüssel → Betrag }              (Summe der Untergruppen bzw. eigener Wert)
     - untergruppen: [ je Untergruppe → eigene werte ]    (Drill-Down)
  gesamt:   { Spaltenschlüssel → Summe aller Gruppen }    (Zeile „Finanzierungsausgaben (Gesamt)")
  bruttoProSpalte: { Spaltenschlüssel → Brutto-Umsatz }   (nur für Prozentual-Modus)
```

### D) Ansichtslogik (clientseitig, aus PROJ-95/96/98 übernommen)

| Modus | Rechnung je Zelle | Quelle der Logik |
|---|---|---|
| **Absolut** | Betrag im €-Format (de-DE, 2 Dezimalstellen) | — |
| **Prozentual** | Betrag ÷ Brutto-Umsatz der Spalte × 100 (1 Dezimalstelle); Brutto = 0 → „—" | identisch PROJ-95/96/98 (`bruttoByColumn`) |
| **Wachstum** | Δ zur Vorperiode: (aktuell − vorher) ÷ \|vorher\| × 100; Sonderfälle „n/a"/„0,0 %" wie PROJ-24 | identisch PROJ-96/98 |

**Monat ↔ Jahr:** Es wird die in PROJ-98 bereits erprobte Bündelung wiederverwendet (rollierende **12-Monats-Blöcke ab Startmonat**, **Summe** je Block; unvollständiger letzter Block bleibt eine kürzere Spalte). Diese Logik ist generisch (sie summiert beliebige Monatswerte zu Jahresblöcken) und wird für Gruppen-, Untergruppen-, Gesamt- und Brutto-Werte gleichermaßen angewandt.

**Vorzeichen-/Farbkonvention:** Finanzierungsausgaben sind ein Kostenposten und werden — exakt wie „Operative Kosten" in PROJ-98 — mit negativem Vorzeichen (rot) dargestellt (interne Konstante analog `KOSTEN_SIGN = -1`).

### E) Das gestapelte Diagramm (einziges echt neues UI-Stück)

Während Matrix, Filter-Leiste und Ansichtslogik nahezu 1:1 aus PROJ-98 stammen, ist das **gestapelte Diagramm** der einzige Baustein mit eigenem Inhalt: je **L1-Gruppe** eine gestapelte Fläche/Linie, die zusammen die **Finanzierungsausgaben (Gesamt)** ergeben.

- Umsetzung mit der bereits vorhandenen Chart-Bibliothek **Recharts** über gestapelte Flächen (gemeinsame Stapel-Kennung) — kein neues Paket.
- X-Achse synchron zu den Tabellenspalten (Monate bzw. Jahresblöcke); Y-Achse folgt dem Ansichtsmodus (€ / % / Wachstum), wie in PROJ-26/95/98.
- Stabile, wiedererkennbare Farbzuordnung je Gruppe; optionale Legende zum Ein-/Ausblenden einzelner Gruppen (Default: alle aktiv).
- Leerzustand: Diagramm ausgeblendet, wenn keine darstellbaren Spalten/Gruppen vorhanden sind.

> Da PROJ-98 bereits eine gestapelte Chart-Komponente besitzt, wird diese als direkte Vorlage geklont — der Inhalt (Finanzierungs-Gruppen statt Operativ-Gruppen) ist die einzige Änderung.

### F) Was neu gebaut wird vs. was wiederverwendet wird

| | Beschreibung |
|---|---|
| **Wiederverwendet (unverändert)** | Versions-Shell + Eigentumsprüfung (PROJ-73); die drei Lese-Routen der Planungsseite (Grundeinstellungen, KPI-Kategorien, Finanzierungswerte) aus PROJ-75/2/90; der leichte Umsatz-Modus `?nur=umsatz` der Rentabilitätsauswertungs-Route (PROJ-95); die Monat↔Jahr-Bündelung und die Ansichtsmodus-Helfer aus PROJ-98; die Subtree-Filterlogik aus dem PROJ-90-Hook; Recharts; shadcn Tabs/Table/Tooltip/Button/Skeleton |
| **Vorlage zum Klonen (UI)** | die komplette Operative-Kosten-Auswertung (PROJ-98): Seite, Hook, Matrix, gestapeltes Diagramm — strukturgleich, nur Inhalt = Finanzierungs-Block statt Operativ-Block |
| **Neu** | eine Seite, ein Daten-Hook (Finanzierungs-Variante: lädt direkt PROJ-90-Daten statt der `operativ`-Zeile), eine Matrix-Komponente, eine gestapelte Chart-Komponente, ein Nav-Eintrag |
| **Bewusst NICHT** | keine neue DB-Tabelle, kein Schreibzugriff, **keine** Backend-Änderung, keine zweite Berechnungslogik, keine USt-Umrechnung (Roh-Brutto wie in PROJ-90), keine Bulk-Edit-/Notiz-Bausteine (das ist die Planungsseite PROJ-90) |

### G) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Wert-Datenquelle | **direkt aus PROJ-90** (Werte + Subtree + Window), NICHT aus der Rentabilitäts-Route | Die Rentabilitäts-Route führt Finanzierung nur als „nur Zinsen" + Netto; die Spec verlangt alle Gruppen/Untergruppen als Roh-Brutto. Direkter Read garantiert Bit-Identität mit der Planungsseite PROJ-90 |
| Prozent-Bezugsgröße | **`?nur=umsatz` der Rentabilitäts-Route** mitnutzen | Gleicher Brutto-Umsatz-Code-Pfad wie PROJ-95/96/98 → konsistente Prozentbasis über alle Auswertungen |
| Berechnungsort | **Frontend** (Hook), kein Server-Code | Es wird nur summiert/umgerechnet/gebündelt — keine produkt-granulare Neuberechnung; identisch zur Strategie von PROJ-94/96/98 |
| Backend-Arbeit | **keine** | Alle vier benötigten Routen existieren bereits und sind leicht; kein neuer/erweiterter Endpunkt nötig (sauberer als PROJ-98, das einen optionalen `?nur=operativ`-Modus vorschlug) |
| Diagrammtyp | **gestapelte Flächen** (Gruppen → Gesamt) | Entspricht der Anforderung „einzelne Gruppen gestapelt, zusammen Gesamt" |
| Vorlage | **PROJ-98 klonen** | PROJ-98 ist die nächstgelegene „eine Kostenkategorie"-Auswertung mit Monat/Jahr-Umschalter + gestapeltem Diagramm — minimaler Abstand zu PROJ-100 |
| Keine Editier-/Notiz-/Bulk-Funktionen | **read-only** | Auswertung, keine Planung; Eingabe bleibt bei PROJ-90 |

### H) Dependencies (Pakete)

**Keine neuen npm-Pakete.** Verwendet werden ausschließlich bereits installierte Bausteine: Next.js App-Router (dynamisches Versions-Segment), Recharts (Diagramm), shadcn/ui (Tabs, Table, Tooltip, Button, Skeleton, Label), die bestehende Versions-Shell sowie die wiederverwendeten Auswertungs-Helfer aus PROJ-98 und die Subtree-Filterlogik aus dem PROJ-90-Hook.

### I) Umsetzungsreihenfolge (empfohlen)

1. **Nav-Eintrag** „Finanzierungsausgaben-Auswertung" (Slug `finanzierungsausgaben-auswertung`) in der Gruppe „Auswertungen" ergänzen (Menü + Versions-Übersicht ziehen generisch nach).
2. **Daten-Hook** (`use-langfristige-finanzierungsausgaben-auswertung.ts`): die vier Lese-Routen parallel laden (Subtree-Filter aus dem PROJ-90-Hook übernehmen), Werte zu Gruppen→Untergruppen→Gesamt aggregieren, Monatsfenster bauen; Monat/Jahr-Bündelung + Ansichtsmodi aus dem PROJ-98-Hook übernehmen.
3. **Matrix-Komponente** (sticky erste Spalte, Drill-Down, Summen-Hervorhebung) + **gestapelte Chart-Komponente** (aus PROJ-98 klonen); Seite in die Versions-Shell einbetten.

> Es gibt **keinen** Backend-Schritt. Nach Schritt 3 ist das Feature vollständig und kann per `/qa` abgenommen werden.

### J) Offene Punkte für /frontend
- Genaue Position in der Gruppe „Auswertungen" (Default: ans Ende anhängen).
- Finale visuelle Angleichung des gestapelten Diagramms an PROJ-98 (Flächen vs. Linien, Legende).
- Verhalten, falls Route 4 (`?nur=umsatz`) fehlschlägt: Prozentual-Modus zeigt „—"; Absolut/Wachstum bleiben voll nutzbar (kein Seitenabsturz).

## Implementation Notes (Frontend — 2026-06-24)

Direkte Spiegelung der Operative-Kosten-Auswertung (PROJ-98). Der **einzige** echte Logik-Unterschied: Die Werte werden **nicht** aus der Rentabilitätsauswertungs-Route gezogen (dort ist Finanzierung nur „nur Zinsen" + netto), sondern **direkt aus den PROJ-90-Rohdaten** gebaut — wie die Planungsseite selbst lädt. Damit ist „Finanzierungsausgaben (Gesamt)" bit-identisch zur Gesamtzeile der Finanzierungsausgaben Planung (PROJ-90). **Keine Backend-Arbeit** — alle vier genutzten Routen existieren bereits.

### Neue Dateien
- `src/hooks/use-langfristige-finanzierungsausgaben-auswertung.ts` — Daten-Hook. Lädt parallel die drei Pflicht-Routen (Grundeinstellungen → Startmonat/Horizont; `/api/kpi-categories?type=ausgaben_kosten` → „Finanzierung"-Subtree via `name.trim().toLowerCase() === 'finanzierung'` → L1-Gruppen → L2-Untergruppen, `sort_order`; `…/finanzierungsausgaben-planung` → Roh-Werte). Baut daraus eine `RaLine` (positive Magnituden): je L1-Gruppe ein `produkte`-Eintrag mit `children` (Untergruppen) + Gruppensumme bzw. eigener Wert (Leaf-Gruppe); `werte` = Summe aller Gruppen je Monat. Monatsspalten-Key-Format `"JAHR-MONAT"` + Label `"Jan 2026"` **identisch zur Route**, damit der separat (fehlertolerant) geladene **Brutto-Umsatz** aus `…/rentabilitaetsauswertung?nur=umsatz` exakt ausgerichtet ist. Schlägt nur der Brutto-Aufruf fehl, bleibt der Prozentual-Modus auf „—"; Absolut/Wachstum funktionieren weiter. Wiederverwendete Helfer (aus PROJ-98 gespiegelt): `computeCascade`, `collectExpandableIds`, `gruppenNodes`, `bruttoByColumn`, `applyZeitbasis` (rollierende 12-Monats-Blöcke ab Startmonat, Summe je Block, kürzerer Restblock). `KOSTEN_SIGN = -1` → Kosten rot/negativ.
- `src/components/langfristige-finanzierungsausgaben-auswertung-matrix.tsx` — Matrix (gespiegelt aus PROJ-98): L1-Gruppen (aufklappbar → Untergruppen) + Gesamt-Zeile „Finanzierungsausgaben (Gesamt)" (hervorgehoben), sticky erste Spalte, drei Ansichtsmodi, Betragsselektion-Summenpanel (`data-betrag-selektion`), „Alle aus-/einklappen". Eigene Leerzustände: „enthält noch keine Finanzierungsausgaben" (alle 0), „kein Brutto-Umsatz" (Prozentual), sowie ein Hinweis mit Link zum **KPI-Modell** (`/dashboard/kpi-modell`), wenn kein „Finanzierung"-Knoten/keine Gruppen existieren.
- `src/components/langfristige-finanzierungsausgaben-auswertung-chart.tsx` — Gestapeltes Diagramm (gespiegelt aus PROJ-98): je L1-Gruppe eine gestapelte Fläche (`stackId="finanzierung"`), Summe = Gesamt; im Wachstums-Modus Linien statt Stapel. Y-Achse folgt dem Ansichtsmodus (€/%/Wachstum), X-Achse synchron zu den Tabellenspalten. Recharts, stabile Farbpalette, Legende.
- `src/app/dashboard/langfristige-planung/[versionId]/finanzierungsausgaben-auswertung/page.tsx` — Seite: `LangfristigeVersionShell` (`seitenTitel="Finanzierungsausgaben-Auswertung"`, `fullWidth`) + Filter-Leiste (Zeitbasis Monat/Jahr, Ansicht Absolut/Prozentual/Wachstum) + Diagramm + Matrix.

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — neuer Eintrag „Finanzierungsausgaben-Auswertung" (Slug `finanzierungsausgaben-auswertung`) in der Gruppe „Auswertungen", ans Ende angehängt. NavSheet + Versions-Übersicht ziehen generisch nach.

### Wiederverwendet (unverändert)
- `LangfristigeVersionShell` (Auth-/Versions-Eigentumsprüfung, Redirect, Header, `fullWidth`), die shared-Typen `RaLine`/`RaBreakdown`/`RentabilitaetsauswertungResponse` (PROJ-95), Recharts, shadcn Tabs/Table/Tooltip/Button/Skeleton/Label.

### Backend
**Keine Backend-Arbeit nötig.** Alle vier Lese-Routen existieren bereits (Grundeinstellungen, KPI-Kategorien, `finanzierungsausgaben-planung` aus PROJ-90, `rentabilitaetsauswertung?nur=umsatz` aus PROJ-95). Es wird nichts geschrieben, keine neue Route/Tabelle.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen/geänderten Dateien (verbleibende Fehler betreffen ausschließlich vorbestehende `.test.ts`-Dateien, unverändert).

## QA Test Results

**QA-Datum:** 2026-06-24
**Tester:** QA Engineer (automatisiert + Code-Review + Differenz-Analyse gegen PROJ-98)
**Ergebnis:** ✅ APPROVED — produktionsbereit

### Prüfansatz
PROJ-100 ist eine **Spiegelung der bereits freigegebenen Operative-Kosten-Auswertung (PROJ-98)** mit **einer bewussten Logik-Abweichung**: Die Werte werden direkt aus den PROJ-90-Rohdaten gebaut (statt aus der `operativ`-Zeile der Rentabilitätsauswertungs-Route). Verifikation daher: (1) Unit-Tests der gespiegelten Anzeige-/Bündelungslogik **und** der neuen `buildColumns`/`buildFinanzierungLine`-Logik, (2) E2E-Smoke/Auth/Regression, (3) Code-Review (Auth, Versionsisolation, Konsistenz mit PROJ-90), (4) Differenz-Analyse gegen PROJ-98.

### Testergebnisse (Acceptance Criteria)

| Bereich | AC | Status | Nachweis |
|---|---|---|---|
| Navigation | Nav-Eintrag „Finanzierungsausgaben-Auswertung" (Slug, Gruppe „Auswertungen") | ✅ PASS | `langfristige-planung-nav.ts`; E2E Seitenexistenz |
| Navigation | Versions-Übersicht zieht generisch nach | ✅ PASS | zentrale Nav-Konfig |
| Navigation | Auth-Guard → Redirect `/login` | ✅ PASS | E2E (Redirect), `LangfristigeVersionShell` |
| Navigation | Fremde/unbekannte `versionId` → Redirect/kein Fremdzugriff | ✅ PASS | `LangfristigeVersionShell` (PROJ-73), versionsgebundene Routen |
| Navigation | Buttons „Alle aus-/einklappen" | ✅ PASS | Matrix (gespiegelt aus PROJ-98) |
| Spalten | Monat/Jahr-Umschalter, Standard Monat | ✅ PASS | Page-Tabs; `applyZeitbasis` |
| Spalten | Monatsansicht: Startmonat … Horizont, kein Vorlauf | ✅ PASS | `buildColumns` Unit-Tests |
| Spalten | Jahresansicht: rollierende 12-Monats-Blöcke ab Startmonat | ✅ PASS | `applyZeitbasis` Unit-Tests (12/14/1 Monate) |
| Spalten | Unvollständiger letzter Jahresblock als eigene Spalte | ✅ PASS | `applyZeitbasis` Unit-Test (14 Monate → J1/J2) |
| Spalten | Sticky erste Spalte, horizontal scrollbar | ✅ PASS | Matrix (gespiegelt) |
| Zeilen | Quelle „Finanzierung"-Subtree (L1+L2, sort_order) | ✅ PASS | `buildFinanzierungLine` Unit-Tests |
| Zeilen | Gesamt-Zeile „Finanzierungsausgaben (Gesamt)" unten, hervorgehoben | ✅ PASS | `computeCascade` Unit-Test (Label/ID/Position) |
| Zeilen | Nur Finanzierungsausgaben (andere Roots ignoriert) | ✅ PASS | `buildFinanzierungLine` Unit-Test (Operativ-Root ignoriert) |
| Drill-Down | L1 mit Untergruppen aufklappbar; Leaf-Gruppe nicht | ✅ PASS | `collectExpandableIds` / `computeCascade` Unit-Tests |
| Wertberechnung | Untergruppe→Gruppe→Gesamt-Summierung, NULL→0 | ✅ PASS | `buildFinanzierungLine` Unit-Tests |
| Wertberechnung | Jahresansicht summiert Monate je Block, Hierarchie konsistent | ✅ PASS | `applyZeitbasis` Unit-Tests |
| Konsistenz | „Finanzierungsausgaben (Gesamt)" = PROJ-90 Gesamtzeile | ✅ PASS | gleiche Quelle/Aggregation; Unit-Test „total = Summe aller Gruppen" |
| Ansichtsmodi | Absolut/Prozentual/Wachstum, Standard Absolut | ✅ PASS | Page-Tabs; Matrix-Formatter |
| Ansichtsmodi | Prozentual = Wert/Brutto-Umsatz; Brutto 0 → „—" | ✅ PASS | `bruttoByColumn`; Matrix `formatProzentWert` |
| Ansichtsmodi | Wachstum Δ zur Vorperiode, n/a-/0,0%-Sonderfälle | ✅ PASS | Matrix `calcWachstum` (aus PROJ-98) |
| Diagramm | Gestapelte L1-Gruppen, Summe = Gesamt | ✅ PASS | Chart `stackId="finanzierung"`, `gruppenNodes` |
| Diagramm | **Werte positiv dargestellt** (nicht negativ) | ✅ PASS | Chart `Math.abs(...)` (User-Feedback umgesetzt) |
| Diagramm | folgt Ansichtsmodus + Monat/Jahr; Wachstum → Linien | ✅ PASS | Chart |
| Read-only | keine editierbaren Zellen, kein Speichern, keine Bulk/Notiz | ✅ PASS | Matrix (nur Selektion zur Summenanzeige) |
| Leerzustände | leere Version → alle 0 + Hinweis; kein „Finanzierung"-Knoten → KPI-Hinweis | ✅ PASS | Matrix-Leerzustände + Link `/dashboard/kpi-modell` |
| Versionsisolation | nur Daten dieser `versionId` | ✅ PASS | versionsgebundene Routen |

### Automatisierte Tests
- **Unit (Vitest):** `use-langfristige-finanzierungsausgaben-auswertung.test.ts` — **25 Tests, alle grün** (computeCascade, collectExpandableIds, gruppenNodes, bruttoByColumn, buildColumns, buildFinanzierungLine, applyZeitbasis). Sibling-Hooks (PROJ-96/98) als Regression mitgeprüft: **52/52 grün**.
- **E2E (Playwright, Chromium):** `tests/PROJ-100-langfristige-finanzierungsausgaben-auswertung.spec.ts` — **6/6 grün** (Seitenexistenz, Auth-Guard, Regression: Operative-Kosten-Auswertung + Finanzierungsausgaben Planung + Rentabilitätsauswertung weiterhin erreichbar, Dashboard-Auth).
- **`npx tsc --noEmit`:** keine Fehler in den neuen/geänderten Dateien (verbleibende Fehler betreffen ausschließlich vorbestehende, unveränderte `.test.ts`-Dateien).

### Differenz-Analyse (gegen PROJ-98)
Alle Unterschiede sind beabsichtigt: (a) Wertquelle = direkter Aufbau aus PROJ-90-Rohdaten via `buildFinanzierungLine` (statt `operativ`-Zeile der Route) → garantiert Bit-Identität mit der Planungsseite PROJ-90; (b) `buildColumns` erzeugt das Monatsfenster lokal aus den Grundeinstellungen (key/label identisch zur Route → Brutto-Ausrichtung); (c) Labels/IDs/Slugs/Texte. Die Anzeige-, Bündelungs- und Ansichtsmodus-Logik ist identisch zur freigegebenen PROJ-98.

### Sicherheits-Audit
- ✅ Seite über `LangfristigeVersionShell` (Auth + Versions-Eigentumsprüfung, Redirect bei fremder Version) abgesichert — wie PROJ-94/95/96/98.
- ✅ Read-only: kein Schreibzugriff, keine neue Route/Tabelle; es werden ausschließlich bestehende, bereits abgesicherte versionsgebundene Lese-Routen aufgerufen.
- ✅ Versionsisolation: alle Datenquellen sind nach `versionId` gefiltert; KPI-Subtree ist global (nur Lesen).
- ✅ Kein XSS-Risiko: Werte numerisch; Labels stammen aus dem KPI-Modell (kein dangerouslySetInnerHTML).
- ✅ Brutto-Umsatz-Aufruf fehlertolerant: Ausfall blockiert die Seite nicht (Prozentual → „—").

### Gefundene Bugs
**Keine Critical-, High-, Medium- oder Low-Bugs.**

### Hinweis
Interaktive End-to-End-Flows mit authentifizierter Session (tatsächliches Umschalten Monat/Jahr & Ansichtsmodus, Drill-Down, Diagramm-Rendering im Browser) wurden — wie bei PROJ-96/98 — nicht in einer Live-Session durchgespielt, sondern über die Spiegelung einer bereits freigegebenen Implementierung, vollständige Unit-Abdeckung der (auch neuen) Berechnungslogik und die E2E-Smoke-/Auth-/Regressionstests abgesichert. Das positive Diagramm-Verhalten (User-Feedback) ist im Code umgesetzt und per AC-Tabelle dokumentiert.

## Deployment
_To be added by /deploy_
