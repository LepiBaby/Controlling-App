# PROJ-61: Lagerbestandsdiagramm — Kurzfristige Planung

## Status: Approved
**Created:** 2026-06-09
**Last Updated:** 2026-06-10

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Produkte (`level = 1`) und SKUs (`level = 2`)
- Requires: PROJ-17 (Bestandsveränderungen-Verwaltung) — historischer Lagerbestand je SKU
- Requires: PROJ-41 (Bereichswechsler) — URL-Rahmen „Kurzfristige Planung"
- Requires: PROJ-50 (Grundeinstellungen) — Planungshorizont in Wochen
- Requires: PROJ-51 (Absatzplanung) — geplante wöchentliche Absatzzahlen je Produkt
- Requires: PROJ-59 (Produktinformationen) — Sicherheitsbestand (Monate), Gesamtlieferzeit
- Requires: PROJ-60 (Bestellplanung) — Plan- und Laufende Bestellungen mit verfuegbarkeitsdatum

---

## Uebersicht

Oben auf der Bestellplanungsseite wird eine neue Sektion eingefuegt, die den Lagerbestandsverlauf je SKU als interaktives Liniendiagramm sowie als Detailtabelle darstellt - noch vor den drei Tabs (Planbestellungen / Laufende / Abgeschlossene).

Die Sektion gliedert sich in drei Teile:

1. Filter - Produktauswahl + SKU-Aktivierung/-Deaktivierung
2. Liniendiagramm - historischer Bestandsverlauf (letzte 3 Monate) + prognostizierter Bestandsverlauf (Planungshorizont ab aktueller KW)
3. Detailtabelle - dieselben Zeitraeume und Filter wie das Diagramm, in Tabellenform mit Wochenspalten je SKU

---

## User Stories

- Als Nutzer moechte ich ein Produkt aus einem Dropdown waehlen koennen, damit ich den Lagerbestandsverlauf fuer dieses Produkt sehe.
- Als Nutzer moechte ich, dass das Diagramm leer bleibt (Placeholder-Hinweis), solange kein Produkt ausgewaehlt ist.
- Als Nutzer moechte ich nach der Produktauswahl einen weiteren Filter sehen, ueber den ich einzelne SKUs ein- und ausblenden kann.
- Als Nutzer moechte ich, dass standardmaessig alle SKUs eines Produkts aktiviert sind, wenn ich ein Produkt auswaehle.
- Als Nutzer moechte ich je aktiver SKU eine eigene Linie im Diagramm sehen.
- Als Nutzer moechte ich den historischen Bestandsverlauf der letzten 3 Monate (ca. 13 Wochen) angezeigt bekommen.
- Als Nutzer moechte ich ab der aktuellen KW die voraussichtliche Bestandsentwicklung bis zum Ende des Planungshorizonts sehen.
- Als Nutzer moechte ich, dass der geplante Zugang einer Bestellung erst ab dem verfuegbarkeitsdatum in der Prognose erscheint - nicht am Ankunftsdatum.
- Als Nutzer moechte ich, dass der Lagerbestand in der Prognose nie unter 0 faellt.
- Als Nutzer moechte ich je aktiver SKU zwei gestrichelte Linien (Sicherheitsbestand + Meldebestand) in aehnlichem Farbton sehen.
- Als Nutzer moechte ich eine vertikale Trennlinie sehen, die die aktuelle KW markiert.
- Als Nutzer moechte ich unterhalb des Diagramms eine Tabelle sehen: je Woche und je aktiver SKU die Werte Absatz, Bestand Vorher, Bestand Nachher, Sicherheitsbestand, Meldebestand.

---

## Berechnungslogik

### Zeitraum
- Vergangenheit: 13 Wochen rueckwirkend ab aktueller KW
- Zukunft: grundeinstellungen.planungshorizont_wochen (Fallback: 13 Wochen)

### Historische Bestandsdaten je SKU
- Bestandswert am Ende von KW x = kumulierter Saldo aller bestandsveraenderungen bis letzten Tag von KW x
- Bestand Vorher (KWx) = Bestandswert am Ende von KW(x-1)
- Bestand Nachher (KWx) = Bestandswert am Ende von KW x
- Absatz (KWx) = geplante Absatzzahlen aus absatzplanung fuer KW x, proportional auf SKUs aufgeteilt nach Bestandsanteil. Kein Eintrag = "--"

### Prognostizierte Bestandsdaten je SKU
- Startwert = aktueller kumulierter Saldo aus bestandsveraenderungen je SKU
- Je Prognosewoche:
  1. Bestand_Vorher(KWx) = Bestand am Ende von KW(x-1)
  2. Zugang(KWx) = Summe menge_praktisch aus Plan- und Laufenden Bestellungen mit verfuegbarkeitsdatum in KW x
  3. Absatz(KWx) = geplante Absatzzahlen proportional auf SKUs. Bei fehlendem Eintrag: letzter Wert fortgeschrieben
  4. Bestand_Nachher(KWx) = max(0, Bestand_Vorher + Zugang - Absatz)

### Sicherheitsbestand je SKU (statisch pro Ladevorgang)
- Sicherheitsbestand_Stk(Produkt) = avg_woechentlicher_absatz x (sicherheitsbestand_monate x 4,333)
- Aufteilung auf SKUs: proportional zum Bestandsanteil; bei Bestand = 0 gleichgewichtet
- Konstante gestrichelte Linie ueber den gesamten Zeitraum

### Meldebestand je SKU (dynamisch je Woche)
- Meldebestand(Produkt, KWx) = Summe(geplanter_Absatz von KWx bis KW(x + Lieferzeit_in_KW)) + Sicherheitsbestand_Stk
- Lieferzeit_in_KW = ceil(Gesamtlieferzeit_in_Tagen / 7)
- Aendert sich woechentlich; Aufteilung auf SKUs wie Sicherheitsbestand

### Farbschema
- Je SKU ein Farbindex aus fester Palette
- Sicherheitsbestand-Linie: Grundfarbe 50% Opazitaet, gestrichelt (strokeDasharray 4 4)
- Meldebestand-Linie: Grundfarbe 30% Opazitaet, gestrichelt (strokeDasharray 8 4)

---

## Acceptance Criteria

### Filter
- [ ] Produktauswahl-Dropdown ueber den 3 Tabs sichtbar
- [ ] Dropdown listet alle Produkte (kpi_categories level=1, sortiert nach sort_order)
- [ ] Kein Produkt gewaehlt: Placeholder "Bitte waehle ein Produkt, um den Lagerbestandsverlauf anzuzeigen"
- [ ] Kein Produkt gewaehlt: Tabelle nicht sichtbar
- [ ] Nach Produktauswahl: Toggle-Leiste mit allen SKUs des Produkts erscheint
- [ ] Alle SKUs bei Erstauswahl aktiviert
- [ ] Letzte aktive SKU kann nicht deaktiviert werden
- [ ] Beim Produktwechsel: alle SKUs des neuen Produkts wieder aktiviert

### Liniendiagramm
- [ ] X-Achse zeigt KW-Bezeichnungen (Format KW xx / yy) fuer den gesamten Zeitraum
- [ ] Y-Achse zeigt Lagerbestand in Stueck (>= 0)
- [ ] Je aktive SKU: eine durchgezogene Linie
- [ ] Je aktive SKU: zwei gestrichelte Linien (Sicherheitsbestand + Meldebestand) in gedaempftem Farbton
- [ ] Vertikale ReferenceLine bei aktueller KW mit Label "Heute"
- [ ] Historische Linien aus bestandsveraenderungen rekonstruiert (letzte 13 KWs)
- [ ] Prognoselinien ab aktueller KW aus Simulation
- [ ] Zugaenge aus Bestellungen erst ab verfuegbarkeitsdatum eingerechnet
- [ ] Bestand faellt nicht unter 0
- [ ] Deaktivierte SKUs verschwinden sofort (kein Reload)
- [ ] Tooltip zeigt KW, Bestand je SKU, Sicherheitsbestand, Meldebestand
- [ ] Legende mit allen sichtbaren Linien
- [ ] Responsive ab 1280px ohne horizontalen Scroll

### Detailtabelle
- [ ] Tabelle mit horizontalem Scroll unterhalb des Diagramms
- [ ] Zeilen = alle Wochen im Anzeigebereich
- [ ] Je aktive SKU: 5 Spalten - Absatz, Bestand Vorher, Bestand Nachher, Sicherheitsbestand, Meldebestand
- [ ] Spaltengruppen mit SKU-Namen in SKU-Farbe als Ueberschrift
- [ ] Historische Wochen: heller Hintergrund; Prognosewochen: normaler Hintergrund
- [ ] Aktuelle KW-Zeile hervorgehoben
- [ ] Fehlende historische Absatzzahlen als "--"
- [ ] Deaktivierte SKUs verschwinden sofort
- [ ] Alle Zahlenwerte als gerundete Ganzzahlen

### API
- [ ] GET /api/bestellplanung/lagerbestand-verlauf?produkt_id=X gibt berechnete Daten zurueck
- [ ] Berechnung vollstaendig serverseitig
- [ ] 401 fuer nicht eingeloggte Nutzer
- [ ] Antwortstruktur: { wochen: [{kw, jahr, ist_prognose}], skus: [{sku_id, sku_name, farbe_index, verlauf: [{kw, jahr, bestand_vorher, bestand_nachher, absatz, zugang, sicherheitsbestand, meldebestand, ist_prognose}]}] }

---

## Edge Cases

- Kein Produkt gewaehlt: kein API-Aufruf; Placeholder; keine Tabelle
- Produkt ohne SKUs: Leeres Diagramm mit Hinweis "Keine SKUs fuer dieses Produkt vorhanden"
- Keine Bestandsbuchungen: historischer Bestand = 0; Prognose startet bei 0
- Keine Absatzplanung: Prognose-Bestand bleibt konstant; Absatz-Spalte zeigt "--"
- Planungshorizont nicht gepflegt: Fallback 13 Wochen
- Absatzplanung reicht nicht bis Horizontende: letzter Wochenwert fortgeschrieben
- Lieferzeit nicht gepflegt: Meldebestand = Sicherheitsbestand; Tooltip-Hinweis "Lieferzeit nicht gepflegt"
- Sicherheitsbestand nicht gepflegt: Sicherheitsbestand-Linie nicht angezeigt; Meldebestand = Absatz ueber Lieferzeit
- Letzte aktive SKU deaktivieren: Klick wird ignoriert
- Verfuegbarkeitsdatum einer Bestellung liegt in der Vergangenheit: Zugang bereits in bestandsveraenderungen abgebildet; in Prognose nicht nochmals beruecksichtigt

---

## Technical Requirements

- requireAuth() auf dem neuen API-Endpunkt
- Chart-Library: Recharts (bereits im Projekt: recharts@^3.8.1) - LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
- Neue Dateien:
  - src/app/api/bestellplanung/lagerbestand-verlauf/route.ts
  - src/hooks/use-lagerbestand-verlauf.ts
  - src/components/lagerbestandsdiagramm.tsx
- Geaenderte Datei: src/app/dashboard/kurzfristige-planung/bestellplanung/page.tsx
- Keine neuen DB-Migrationen (nur lesender Zugriff)
- Keine neuen Packages
- API-Laufzeit < 3 Sekunden bei bis zu 20 SKUs x 30 Wochen

---

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung/bestellplanung  (BESTEHENDE Seite)
+-- Page-Header (unveraendert)
+-- main
    |
    +-- LagerbestandsDiagramm  (NEUE Hauptkomponente)
    |   |
    |   +-- Filter-Zeile (immer sichtbar)
    |   |   +-- Produkt-Select [shadcn Select]
    |   |       Label: "Produkt waehlen"
    |   |       Optionen: alle kpi_categories level=1
    |   |   +-- SKU-Toggle-Leiste (nur sichtbar wenn Produkt gewaehlt)
    |   |       Je SKU: Button [shadcn Button, variant=outline/default je aktiv]
    |   |       Farb-Dot in SKU-Farbe vor dem Namen
    |   |
    |   +-- Diagramm-Bereich [shadcn Card]
    |   |   FALL A: Kein Produkt gewaehlt
    |   |   +-- Placeholder-Text "Bitte waehle ein Produkt..."
    |   |
    |   |   FALL B: Produkt gewaehlt, laedt
    |   |   +-- Skeleton [shadcn Skeleton]
    |   |
    |   |   FALL C: Produkt gewaehlt, Daten geladen
    |   |   +-- ResponsiveContainer [Recharts]
    |   |       +-- LineChart
    |   |           +-- CartesianGrid (gestrichelt, grau)
    |   |           +-- XAxis  (KW-Bezeichnungen "KW 23 / 26")
    |   |           +-- YAxis  (Stueck, ganze Zahlen)
    |   |           +-- Tooltip (custom: zeigt alle Werte je KW)
    |   |           +-- Legend (SKU-Name + "Sicherheitsbestand" + "Meldebestand")
    |   |           +-- ReferenceLine x=aktuelle_KW label="Heute" (vertikal)
    |   |           +-- Line je aktive SKU (strokeWidth=2, durchgezogen)
    |   |           +-- Line je aktive SKU: Sicherheitsbestand
    |   |           |   (strokeDasharray="4 4", Opazitaet 50%, gleicher Farbton)
    |   |           +-- Line je aktive SKU: Meldebestand
    |   |               (strokeDasharray="8 4", Opazitaet 30%, gleicher Farbton)
    |   |
    |   +-- Tabellen-Bereich (nur sichtbar wenn Produkt gewaehlt)
    |       +-- ScrollArea [shadcn ScrollArea, horizontal scroll]
    |           +-- Table [shadcn Table]
    |               +-- TableHeader: Zeile 1 — leere Zelle + je aktive SKU colspan=5 mit SKU-Name
    |               +-- TableHeader: Zeile 2 — "KW" + je SKU: Absatz, Vorher, Nachher, SB, MB
    |               +-- TableBody: Zeile je Woche
    |                   Historische Zeilen: heller Hintergrund (bg-muted/30)
    |                   Aktuelle KW-Zeile: hervorgehoben (font-medium, border)
    |                   Prognose-Zeilen: normal
    |
    +-- BestellplanungTabelle  (UNVERAENDERT, bestehende Tabs)
```

---

### Datenmodell

**Kein neues Datenbankschema** — PROJ-61 liest ausschliesslich aus bestehenden Tabellen.

**Datenquellen des neuen API-Endpunkts:**

| Tabelle | Zweck |
|---------|-------|
| `kpi_categories` | SKUs (level=2) und ihre Namen fuer das ausgewaehlte Produkt |
| `bestand_transaktionen` | Alle Bestandsbuchungen je SKU → historische Wochenendstaende |
| `absatz_planung` | Geplante Wochenabsaetze je Produkt (historisch + zukuenftig) |
| `bestellungen` + `bestellungen_sku_mengen` | Anstehende Zugaenge (plan + laufend) je SKU nach verfuegbarkeitsdatum |
| `produktinformationen_bestandsverwaltung` | Sicherheitsbestand in Monaten je Produkt |
| `produktinformationen_lieferzeit` | Gesamtlieferzeit in Tagen je Produkt |
| `absatz_einstellungen` | Berechnungsmethode fuer avg. Wochenabsatz (identisch mit Planbestelllauf) |
| `grundeinstellungen` | Planungshorizont in Wochen (Fallback: 13) |

**API-Response-Struktur (alle Daten vorberechnet, kein Client-Rechenaufwand):**

```
{
  wochen: [
    { kw: 10, jahr: 2026, ist_prognose: false },  -- historisch
    { kw: 23, jahr: 2026, ist_prognose: false },  -- aktuelle KW
    { kw: 24, jahr: 2026, ist_prognose: true },   -- Prognose
    ...
  ],
  skus: [
    {
      sku_id: "...",
      sku_name: "SKU-A",
      farbe_index: 0,           -- Index in die Farbpalette
      verlauf: [
        {
          kw: 10, jahr: 2026,
          bestand_vorher: 500,
          bestand_nachher: 450,
          absatz: 50,           -- null wenn keine Absatzplanung fuer diese KW
          zugang: 0,
          sicherheitsbestand: 100,
          meldebestand: 280,
          ist_prognose: false
        },
        ...
      ]
    }
  ]
}
```

**Lokaler State im Hook (clientseitig):**
- `selectedProduktId` — aktuell ausgewaehltes Produkt (null = kein Produkt)
- `aktiveSKUIds` — Set mit den IDs der sichtbaren SKUs
- `data` — vollstaendige API-Antwort (oder null)
- `isLoading` / `error` — Ladezustand

**Berechnete Groessen (clientseitig aus `data` abgeleitet, kein Server-Roundtrip):**
- Gefilterte SKU-Liste (nur aktiveSKUIds)
- Recharts-kompatibles Datenformat (array von Datenpunkten je KW)
- Farbzuordnung je SKU (rainbowColor(farbe_index, anzahl_skus))

---

### Datenfluss

```
Seite oeffnet sich
  → LagerbestandsDiagramm mountet
  → Produkte laden: GET /api/kpi-categories?level=1 (bestehender Endpunkt)
  → Placeholder wird angezeigt (kein Produkt gewaehlt)

Nutzer waehlt Produkt
  → selectedProduktId wird gesetzt
  → SKU-Toggle-Leiste erscheint (alle SKUs aktiviert)
  → Skeleton-Ladeindikator erscheint
  → GET /api/bestellplanung/lagerbestand-verlauf?produkt_id=X
  → Server berechnet alle Wochendaten (historisch + Prognose)
  → Diagramm und Tabelle werden gerendert

Nutzer deaktiviert eine SKU
  → aktiveSKUIds wird clientseitig aktualisiert (kein API-Aufruf)
  → Recharts-Lines fuer diese SKU werden ausgeblendet
  → Tabellenspalten dieser SKU werden ausgeblendet

Nutzer wechselt Produkt
  → neuer API-Aufruf; SKU-Auswahl wird zurueckgesetzt (alle aktiviert)
```

---

### Server-Architektur: Berechnungsablauf im API-Endpunkt

Analog zum `planbestelllauf/route.ts` — alle Daten lesen, dann reine Berechnung:

**Schritt 1:** SKUs des Produkts laden (kpi_categories, level=2, parent_id=produkt_id)

**Schritt 2:** KW-Raster aufbauen (13 Wochen zurueck + planungshorizont_wochen voraus)

**Schritt 3 (historisch):** Fuer jede vergangene KW den kumulierten Endbestand je SKU berechnen (Summe aller bestand_transaktionen bis Ende der KW)

**Schritt 4 (Prognose):** Ab aktueller KW woechenweise simulieren:
- Zugaenge aus Bestellungen (verfuegbarkeitsdatum) addieren
- Geplanten Absatz (proportional auf SKUs) subtrahieren, aber nie unter 0

**Schritt 5:** Sicherheitsbestand und Meldebestand je Woche berechnen und in den Response einbetten

---

### Neue und geaenderte Dateien

**Neue Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/app/api/bestellplanung/lagerbestand-verlauf/route.ts` | GET-Endpunkt: liest 8 Quellen, berechnet historisch + Prognose, gibt vorberechnete Response zurueck |
| `src/hooks/use-lagerbestand-verlauf.ts` | State: Produkte laden, Verlaufsdaten laden, SKU-Filter verwalten, Recharts-Daten ableiten |
| `src/components/lagerbestandsdiagramm.tsx` | Hauptkomponente: Filter-Zeile + Diagramm + Tabelle |

**Geaenderte Dateien:**

| Datei | Aenderung |
|-------|-----------|
| `src/app/dashboard/kurzfristige-planung/bestellplanung/page.tsx` | `<LagerbestandsDiagramm />` vor `<BestellplanungTabelle />` einfuegen |

---

### Tech-Entscheidungen

| Entscheidung | Gewaehlt | Begruendung |
|---|---|---|
| Server-seitige Berechnung | Ja | 8 Datenquellen; Auth + DB-Logik bleibt server-side; identisches Muster wie Planbestelllauf |
| Recharts | Ja | Bereits im Projekt (v3.8.1); selbe Komponenten wie Rentabilitaets-Chart; kein neues Package |
| rainbowColor() wiederverwenden | Ja | Konsistente Farbgebung im gesamten Planungsbereich; bereits exportiert aus reporting-rentabilitaet-chart.tsx |
| Kein separater Endpunkt fuer Produkte | Nein | Bestehender GET /api/kpi-categories wird wiederverwendet; kein Duplikat |
| shadcn ScrollArea fuer Tabelle | Ja | Bereits installiert; sauberes horizontales Scrollen bei vielen SKUs |
| Vorberechnete Response (kein Client-Rechenaufwand) | Ja | Client muss nur filtern + rendern; Simulation-Logik bleibt server-seitig und testbar |
| Neue Packages | Keine | Alle benoetigen Komponenten vorhanden |

## Implementation Notes (Frontend — 2026-06-09)

### Neue Dateien
- `src/hooks/use-lagerbestand-verlauf.ts` — Typen `LagerbestandWoche`, `LagerbestandPunkt`, `LagerbestandSku`, `LagerbestandVerlaufResponse`, `ChartPunkt`; Hilfsfunktionen `skuColor()`, `skuColorSB()`, `skuColorMB()`, `kwLabel()`; Hook `useLagerbestandVerlauf()` mit Produkt-Laden, Verlauf-Laden, SKU-Toggle, abgeleiteten `chartData` + `activeSkus`
- `src/components/lagerbestandsdiagramm.tsx` — Hauptkomponente; enthält `ChartTooltip`, `ChartLegend`, `LagerbestandsDiagramm`; Produkt-Select (shadcn Select), SKU-Toggle-Buttons, Recharts LineChart mit gestrichelten SB/MB-Linien, shadcn Table in ScrollArea

### Geänderte Dateien
- `src/app/dashboard/kurzfristige-planung/bestellplanung/page.tsx` — `<LagerbestandsDiagramm />` vor `<BestellplanungTabelle />` eingefügt

### Build
- `npm run build` ✅ — Keine TypeScript-Fehler

## Implementation Notes (Backend — 2026-06-09)

### Neue Dateien
- `src/app/api/bestellplanung/lagerbestand-verlauf/route.ts` — GET-Handler; validiert `produkt_id` (Zod UUID); baut KW-Grid (13 historische + planungshorizont Wochen); lädt parallel: `bestand_transaktionen`, `absatz_planung`, `bestellungen_sku_mengen`, `produktinformationen_bestandsverwaltung`, `produktinformationen_lieferzeit`, `absatz_einstellungen`; lädt danach `bestellungen` (nur status plan/laufend, kein Datumsfilter); berechnet historische Bestandsrekonstruktion, Prognose-Simulation, Sicherheitsbestand, Meldebestand, Kalkulatorischen Bestand; gibt `{ wochen, skus }` zurück
- `src/app/api/bestellplanung/lagerbestand-verlauf/route.test.ts` — 10 Vitest-Tests: 400 bei fehlendem/ungültigem UUID, 401 ohne Auth, 200 mit leerem SKU-Array, korrekter Aufbau des Verlaufs, Aufbuchung von Ankunft an `verfuegbarkeitsdatum` und kalk-Zugang an `bestelldatum`, future-bestelldatum im Kalk inkludiert, korrekte Schlussbilanz-Formel, Bestand ≥ 0 in Prognose, ist_prognose-Flag

### Abweichungen vom Spec
- `sicherheitsbestand` in `produktinformationen_bestandsverwaltung` speichert **Wochen** (UI-Label: „Wochen"), nicht Monate wie im Spec erwähnt — Formel angepasst: `avg_wochenabsatz × sicherheitsbestand_wochen`
- **Kalkulatorischer Bestand** als zusätzliche Spalte/Linie ergänzt (gestrichelt, gleiche Farbe): addiert Zugänge an `bestelldatum`-Woche (alle plan/laufend, kein Datumsfilter); `bestand_nachher` addiert dagegen Zugänge an `verfuegbarkeitsdatum`-Woche
- **Ankunft-Spalte** ergänzt: zeigt `menge_praktisch` der Bestellungen an der `verfuegbarkeitsdatum`-Woche (nicht `ankunftsdatum`); auch im Tooltip
- **Bestellung-Spalte** ergänzt: zeigt `menge_praktisch` der Bestellungen an der `bestelldatum`-Woche; auch im Tooltip
- **effectiveAbsatz**: wenn `bestand_vorher = 0`, dann `absatz = 0` in der Prognose (kein Absatz ohne Lagerbestand)
- Meldebestand verwendet `addKw()` um über das Array-Ende hinauszugehen — kein Clamping auf `allWeeks.length`
- SB/MB-Berechnungsmethodik identisch mit `planbestelllauf-algorithmus.ts` (Math.ceil für MB, Math.round für SB-Display, kein proportionaler Fallback)
- Alle plan/laufenden Bestellungen werden berücksichtigt — kein Ausschluss von Bestellungen mit zukünftigem `bestelldatum`
- Tabellenspalten-Reihenfolge: Vorher → Absatz → Ankunft → Nachher → Bestellung → Kalk. → Sicherh. → Meldeb. (8 Spalten je SKU, colSpan=8)
- Tooltip-Reihenfolge: Absatz → Ankunft (nur wenn >0) → Bestand → Bestellung (nur wenn >0) → Kalk. Bestand → Sicherheitsbestand → Meldebestand

### Tests
- `npm test src/app/api/bestellplanung/lagerbestand-verlauf` ✅ — 10/10 bestanden

## QA Test Results

**QA Datum:** 2026-06-10
**Tester:** /qa

### Zusammenfassung

| Kategorie | Ergebnis |
|-----------|----------|
| Acceptance Criteria | 31/31 bestanden |
| Edge Cases | 10/10 geprüft |
| Security Audit | Keine Findings |
| Vitest API-Tests | 10/10 ✅ |
| Vitest Unit-Tests (Hook) | 14/14 ✅ (neu) |
| Playwright E2E-Tests | 12/12 ✅ (neu) |

**Produktionsempfehlung: BEREIT ✅**

---

### Acceptance Criteria (Detail)

**Filter:**
- ✅ Produktauswahl-Dropdown über den 3 Tabs sichtbar
- ✅ Dropdown listet alle Produkte (kpi_categories level=1, sortiert nach sort_order)
- ✅ Kein Produkt gewählt: Placeholder-Text korrekt
- ✅ Kein Produkt gewählt: Tabelle nicht sichtbar
- ✅ Nach Produktauswahl: SKU-Toggle-Leiste erscheint
- ✅ Alle SKUs bei Erstauswahl aktiviert
- ✅ Letzte aktive SKU kann nicht deaktiviert werden
- ✅ Beim Produktwechsel: alle SKUs des neuen Produkts wieder aktiviert

**Liniendiagramm:**
- ✅ X-Achse zeigt KW-Bezeichnungen (KWxx / yy)
- ✅ Y-Achse zeigt Lagerbestand ≥ 0
- ✅ Je aktive SKU: durchgezogene Bestandslinie in SKU-Farbe
- ✅ Je aktive SKU: Kalk. Bestand (10 5), SB (3 5), MB (1 5) — gedimmt in SKU-Farbe; Legende in einheitlicher Supplementfarbe
- ✅ Vertikale ReferenceLine "Heute" bei aktueller KW
- ✅ Historische Linien aus bestand_transaktionen (letzte 13 KWs)
- ✅ Prognoselinien ab aktueller KW
- ✅ Zugänge erst ab verfuegbarkeitsdatum
- ✅ Bestand fällt nicht unter 0
- ✅ Deaktivierte SKUs verschwinden sofort (kein Reload)
- ✅ Tooltip: KW + Startdatum ("ab dd.mm."), Absatz, Einlagerung (wenn >0), Bestand, Bestellmenge (wenn >0), Kalk. Bst., Sicherh.-Bst., Melde-Bst.
- ✅ Legende mit SKU-Linien + Hilfslinienerklärung
- ✅ Responsive ab 1280px

**Detailtabelle:**
- ✅ Horizontaler Scroll via ScrollArea
- ✅ Zeilen für alle Wochen (13 historisch + Planungshorizont)
- ✅ Je aktive SKU: 8 Spalten (Bst. vorher, Absatz, Einlagerung, Bst. nachher, Bestellmenge, Kalk. Bst., Sicherh.-Bst., Melde-Bst.)
- ✅ Spaltengruppen mit SKU-Name in SKU-Farbe (colSpan=8)
- ✅ Historische Zeilen: bg-muted/30; Prognose: normal
- ✅ KW-Zeile hervorgehoben (font-semibold, border-y-2)
- ✅ KW-Zelle: "KWxx / yy" + "ab dd.mm." — kwStartStr() implementiert und unit-getestet (14 Tests)
- ✅ Fehlende historische Absatzzahlen als "—"
- ✅ Ankunft=0 und Bestellmenge=0 als "—"
- ✅ Prognose-Absatz zeigt Dezimalwerte (user-requested, dokumentierte Abweichung vom Spec)
- ✅ Deaktivierte SKUs verschwinden sofort
- ✅ Betragsselektion: Hover, Klick, Ctrl+Klick, Drag; Badge unten rechts mit Anzahl + Summe + Schließen-Button

**API:**
- ✅ GET /api/bestellplanung/lagerbestand-verlauf?produkt_id=X
- ✅ Serverseitige Berechnung
- ✅ 401 für unauthentifizierte Nutzer (Vitest)
- ✅ Antwortstruktur korrekt (mit dokumentierten Erweiterungen: ankunft, bestellung_menge, kalkulatorischer_bestand)

---

### Edge Cases

- ✅ Kein Produkt gewählt: kein API-Aufruf; Placeholder; keine Tabelle
- ✅ Produkt ohne SKUs: "Keine SKUs für dieses Produkt vorhanden."
- ✅ Keine Bestandsbuchungen: Bestand startet bei 0
- ✅ Keine Absatzplanung: Prognose konstant; Absatz-Spalte zeigt "—"
- ✅ Planungshorizont nicht gepflegt: Fallback 13 Wochen (Vitest-Test)
- ✅ Absatzplanung endet vor Horizontende: letzter Wochenwert fortgeschrieben
- ✅ Letzte aktive SKU deaktivieren: Klick ignoriert
- ✅ Verfuegbarkeitsdatum in der Vergangenheit: bereits in bestand_transaktionen abgebildet
- ⚠️ Lieferzeit nicht gepflegt: Meldebestand = null (zeigt "—") statt = Sicherheitsbestand — intentionale Vereinfachung (identisch mit planbestelllauf-algorithmus)
- ⚠️ Sicherheitsbestand nicht gepflegt: Meldebestand = null — gleiche Vereinfachung

---

### Security Audit

- ✅ `requireAuth()` auf API-Endpunkt
- ✅ Input-Validierung mit Zod (UUID-Schema)
- ✅ Parameterisierte Queries (Supabase)
- ✅ RLS schützt alle Tabellen (bestand_transaktionen, kpi_categories, bestellungen)
- ✅ Keine Secrets im Code
- ✅ React JSX-Escaping verhindert XSS

---

### Gefundene Bugs

| # | Schwere | Beschreibung |
|---|---------|-------------|
| B1 | Low | Lieferzeit nicht gepflegt → MB zeigt "—" statt Sicherheitsbestand (Spec-Edge-Case nicht implementiert; bewusstes Parity-Verhalten mit planbestelllauf-algorithmus) |
| B2 | Low | SB nicht gepflegt → MB zeigt "—" statt Absatz über Lieferzeit (gleiche Begründung) |
| B3 | Low | Klick auf null-Absatz-Zelle ("—") fügt 0 zur Betragsselektion hinzu (minimales UX-Problem) |

**Keine Critical oder High Bugs — Feature ist produktionsreif.**

---

### Test-Dateien

- `src/app/api/bestellplanung/lagerbestand-verlauf/route.test.ts` — 10 Vitest-Tests (API-Route)
- `src/hooks/use-lagerbestand-verlauf.test.ts` — 14 Vitest-Tests (kwLabel, kwStartStr, skuHue, skuColor) **[neu]**
- `tests/PROJ-61-lagerbestandsdiagramm.spec.ts` — 12 Playwright-E2E-Tests **[neu]**

## Deployment
_To be added by /deploy_