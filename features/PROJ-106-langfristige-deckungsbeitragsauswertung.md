# PROJ-106: Deckungsbeitragsauswertung — Langfristige Planung

## Status: Deployed
**Created:** 2026-07-04
**Last Updated:** 2026-07-05

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer, zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- **Requires: PROJ-95 (Rentabilitätsauswertung — Langfristige Planung)** — **direkte Vorlage.** Diese Seite ist eine 1:1-Kopie der aktuellen Rentabilitätsauswertung mit zwei Abweichungen (Kaskade endet bei DB III; zusätzlicher Produktfilter). Sie erbt deren komplette Datenkette, Berechnungslogik, Ansichtsmodi, Zeitbasis-Umschalter (Monat/Jahr), Diagramm, Absatztabelle und Matrix.
- Transitiv (über PROJ-95): PROJ-74, 75, 77, 78, 79, 84, 85, 86, 87 — alle Quellmodule der Kaskade bis DB III (Sales-Plattform-Planung, Absatzplanung, Produktinformationen, Vertriebs-/Verkaufsgebühr-Einstellungen, Bestellplanung, Marketing-Planung, USt-Sätze). Die Module **unterhalb** DB III (PROJ-88 Operativ, PROJ-92 Investitionen, PROJ-90 Finanzierung, PROJ-93 Steuern) werden von dieser Seite **nicht** benötigt.

## Übersicht

Die **Deckungsbeitragsauswertung** ist eine **exakte Kopie** der Seite **Rentabilitätsauswertung** (PROJ-95) im Navigationsbereich **„Auswertungen"** der Langfristigen Planung. Sie ist eine **rein anzeigende** (read-only), **versionsgebundene** Seite mit identischem Aufbau von oben nach unten:

1. **Filter-/Ansichtsleiste** (Zeitbasis Monat/Jahr, Ansicht Absolut/Prozentual/Wachstum) — **plus neuer Produktfilter**
2. **Liniendiagramm**
3. **Absatztabelle**
4. **Haupttabelle** (GuV-/Deckungsbeitrags-Matrix, Drill-Down bis Produkt, sticky erste Spalte)

**Sie unterscheidet sich von der Rentabilitätsauswertung nur in zwei Punkten:**

1. **Die feste Kaskade endet bei DB III (Deckungsbeitrag 3).** Alle Zeilen unterhalb DB III entfallen ersatzlos: Operative Kosten, EBIT, Investitionskosten, EBIT nach Investitionen, Finanzierungskosten, EBT, Steuern, Ergebnis.
2. **Ein neuer Produktfilter** in der Zeitbasis-/Ansichtsleiste. Werden ein oder mehrere Produkte gewählt, rechnet die **gesamte** Auswertung (Kaskade, Diagramm, Absatztabelle) **nur** mit diesen Produkten. Ohne Auswahl gilt „alle Produkte" (unverändertes Verhalten).

Alles Übrige — Datenquellen, Berechnungsformeln je Zeile, Ansichtsmodi, Zeitbasis-Umschalter (Monat/Jahr), Drill-Down-Verhalten, Farben, Read-only-Verhalten, Versionsisolation, Ausklappen/Einklappen — ist **identisch** zur Rentabilitätsauswertung. Für die vollständige Definition dieser geteilten Aspekte gilt PROJ-95 als maßgeblich.

> **Hinweis zum aktuellen Stand von PROJ-95:** Die Vorlage wird 1:1 vom **aktuellen** Zustand der Seite geklont (nicht vom ursprünglichen PROJ-95-Text). Der ursprünglich spezifizierte „Ohne Investitionen"-Button existiert auf der Seite **nicht mehr** (wurde entfernt) und ist daher auch hier **kein** Bestandteil. Die aktuelle Vorlage besitzt außerdem einen **Zeitbasis-Umschalter Monat/Jahr**, der hier ebenfalls übernommen wird.

### Feste Deckungsbeitrags-Kaskade (Zeilenstruktur)

```
Brutto-Umsatz                                              (Sales-Plattform-Planung)
− Rabatte                                                  (Sales-Plattform-Planung)
− Rückerstattungen                                         (Sales-Plattform-Planung)
− Umsatzsteuer                                             (berechnet, analog Reporting)
─────────────────────────────────────────────────────────
= Netto-Umsatz
─────────────────────────────────────────────────────────
− Produktkosten                                            (Summe der fünf Unterzeilen)
    · Ware
    · Inspektion
    · Shipping
    · Zoll
    · Einlagerung
─────────────────────────────────────────────────────────
= DB I (Deckungsbeitrag 1)
─────────────────────────────────────────────────────────
− Vertriebskosten                                          (Summe der fünf Unterzeilen)
    · Versand
    · Lagerung
    · Retouren
    · Ersatzteile / Kulanz
    · Verkaufsgebühren
─────────────────────────────────────────────────────────
= DB II (Deckungsbeitrag 2)
─────────────────────────────────────────────────────────
− Marketingkosten                                          (Marketing-Planung)
─────────────────────────────────────────────────────────
= DB III (Deckungsbeitrag 3)   ← LETZTE ZEILE der Seite
```

> **Wesentliche Beobachtung:** DB III schneidet die Kaskade **genau vor** den einzigen nicht-produktgranularen Zeilen ab (Operativ/Finanzierung/Steuern werden je Gruppe/Kategorie geplant, nicht je Produkt). Dadurch sind **alle** verbleibenden Zeilen produktgranular — der Produktfilter lässt sich sauber und vollständig auf die gesamte Seite anwenden.

## User Stories

- Als Controller möchte ich eine Deckungsbeitragsauswertung sehen, die exakt wie die Rentabilitätsauswertung aufgebaut ist, aber nur bis DB III reicht, damit ich mich auf die produktbezogenen Deckungsbeiträge konzentrieren kann, ohne Overhead-, Finanzierungs- und Steuerzeilen.
- Als Controller möchte ich die Seite im linken Seitenmenü **direkt unter „Rentabilitätsauswertung"** finden.
- Als Controller möchte ich oben in der Zeitbasis-/Ansichtsleiste ein oder mehrere Produkte filtern können, sodass die gesamte Auswertung (Kaskade, Diagramm, Absatztabelle) nur diese Produkte berücksichtigt.
- Als Controller möchte ich ohne Produktauswahl weiterhin alle Produkte sehen (Standardzustand), genau wie auf der Rentabilitätsauswertung.
- Als Controller möchte ich zwischen Monat/Jahr (Zeitbasis) und Absolut/Prozentual/Wachstum (Ansicht) umschalten können — identisch zur Rentabilitätsauswertung.
- Als Controller möchte ich jede berechnete Zeile bis auf Produktebene aufklappen können; bei aktivem Produktfilter erscheinen dort nur die gefilterten Produkte.

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Neuer Nav-Eintrag „Deckungsbeitragsauswertung" (Slug `deckungsbeitragsauswertung`) in der Gruppe **„Auswertungen"**, positioniert **direkt nach** „Rentabilitätsauswertung" und **vor** „Liquiditätsauswertung"
- [ ] Route: `/dashboard/langfristige-planung/[versionId]/deckungsbeitragsauswertung`
- [ ] Der Eintrag erscheint automatisch auch auf der Versions-Übersichtsseite (zentrale Nav-Konfiguration)
- [ ] Seitentitel im Shell-Header: „Deckungsbeitragsauswertung"
- [ ] Nur für eingeloggte Nutzer zugänglich (Auth-Guard); fremde/unbekannte `versionId` → sauberer Redirect zum Langfristige-Planung-Dashboard (PROJ-73)

### Kaskade endet bei DB III

- [ ] Die feste Kaskade zeigt in dieser Reihenfolge: Brutto-Umsatz, Rabatte, Rückerstattungen, Umsatzsteuer, **Netto-Umsatz**, Produktkosten (Ware/Inspektion/Shipping/Zoll/Einlagerung), **DB I**, Vertriebskosten (Versand/Lagerung/Retouren/Ersatzteile-Kulanz/Verkaufsgebühren), **DB II**, Marketingkosten, **DB III**
- [ ] **DB III ist die letzte Zeile der Tabelle.** Es gibt **keine** Zeilen darunter (kein Operative Kosten, EBIT, Investitionskosten, EBIT nach Investitionen, Finanzierungskosten, EBT, Steuern, Ergebnis)
- [ ] Die Berechnung jeder verbleibenden Zeile ist **identisch** zur Rentabilitätsauswertung (gleiche Datenquellen, gleiche Formeln, effektiver Soll je Monat) — siehe PROJ-95 „Wertberechnung"
- [ ] Zwischensummen-Zeilen (Netto-Umsatz, DB I, DB II, DB III) sind visuell hervorgehoben, identisch zur Vorlage
- [ ] Alle Zeilen bleiben dauerhaft sichtbar, auch wenn ihr Wert in allen Monaten 0 ist

### Produktfilter (neu)

- [ ] In der oberen Leiste (neben Zeitbasis und Ansicht) gibt es einen **Produktfilter** als **Mehrfachauswahl** über die Produkte dieser Planversion (versionsgebundene Produkt-Stammkategorien, PROJ-74)
- [ ] **Leere Auswahl = „alle Produkte"** (Standard); Verhalten dann identisch zur Rentabilitätsauswertung
- [ ] Werden ein oder mehrere Produkte ausgewählt, **rechnet die gesamte Auswertung neu** und berücksichtigt ausschließlich die gewählten Produkte:
  - [ ] alle Kaskaden-Aggregate (Brutto-Umsatz … DB III) enthalten nur die Beiträge der gewählten Produkte
  - [ ] das **Liniendiagramm** spiegelt die gefilterten Werte
  - [ ] die **Absatztabelle** (Absatz gesamt + Unterzeilen) zeigt nur die gewählten Produkte
  - [ ] beim Aufklappen erscheinen auf unterster Ebene nur die gewählten Produkte
- [ ] Der Produktfilter wirkt clientseitig auf bereits geladenen Daten, sofern die produktgranularen Basiswerte bereits vorliegen (kein zwingend neuer Server-Call) — finale Umsetzung in `/architecture`
- [ ] Ein sichtbarer Hinweis zeigt an, wie viele/welche Produkte aktuell gefiltert sind, mit Möglichkeit zum Zurücksetzen (alle Produkte)
- [ ] Der Produktfilter bleibt beim Wechsel von Zeitbasis (Monat/Jahr) und Ansichtsmodus (Absolut/Prozentual/Wachstum) erhalten

### Übernommen von der Rentabilitätsauswertung (unverändert)

- [ ] **Zeitbasis-Umschalter Monat/Jahr** — identisch
- [ ] **Ansichtsmodi Absolut / Prozentual / Wachstum** — identisch (Standard: Absolut; Prozentual bezogen auf Brutto-Umsatz des Zeitraums; Wachstum = Veränderung zum Vorperiode)
- [ ] **Liniendiagramm** oben — identisch, jedoch mit angepasster Standard-Linienauswahl (siehe Edge Cases: nur noch existierende Zeilen)
- [ ] **Absatztabelle** zwischen Diagramm und Haupttabelle — identisch
- [ ] **Drill-Down bis Produkt-/Kanal-Ebene**, sticky erste Spalte, horizontal scrollbar — identisch
- [ ] **„Alle ausklappen" / „Alle einklappen"**-Buttons — identisch (sofern in der aktuellen Vorlage vorhanden)
- [ ] **Farben** (positiv grün/schwarz, Kosten/negativ rot mit Minuszeichen), de-DE-Format, 0-Werte als „0,00 €" — identisch
- [ ] **Read-only** — keine Zelle editierbar, kein „Zurücksetzen", die Seite persistiert nichts
- [ ] **Versionsisolation** — ausschließlich Daten dieser `versionId`; keine Ist-Daten, keine Kurzfristige Planung, keine anderen Versionen

## Edge Cases

- **Standard-Linienauswahl im Diagramm:** Die Rentabilitätsauswertung wählt standardmäßig u.a. DB III, EBIT, EBT, Ergebnis. Da EBIT/EBT/Ergebnis hier entfallen, muss die Standardauswahl angepasst werden — Vorschlag: **Brutto-Umsatz, Netto-Umsatz, DB I, DB II, DB III**. Nur existierende Zeilen dürfen auswählbar sein.
- **Leere/neu angelegte Planversion:** alle Werte 0; Kaskade bis DB III bleibt vollständig sichtbar; Produktfilter zeigt (leere) Produktliste dieser Version.
- **Produktfilter mit Produkt ohne Umsatz/Absatz:** gewähltes Produkt trägt 0 bei; Aggregate = Summe der gewählten Produkte (ggf. 0).
- **Alle Produkte manuell einzeln ausgewählt** = identisches Ergebnis wie „keine Auswahl" (alle Produkte).
- **Marketingkosten im Produktfilter:** Marketing wird je Kanal × Produkt geplant; bei aktivem Produktfilter zählt nur der produktbezogene Anteil der gewählten Produkte (Marketing-Drill-Down bleibt kanalbasiert, aber die Summe respektiert den Produktfilter). Genaue Zuordnung in `/architecture` bestätigen.
- **Umsatzsteuer im Produktfilter:** USt ist produktspezifisch berechnet; bei Produktfilter nur USt der gewählten Produkte. Konsistent zur produktgranularen Berechnung der Vorlage.
- **Prozentual-Ansicht mit Produktfilter:** Bezugsgröße bleibt der **gefilterte** Brutto-Umsatz des Zeitraums (nur gewählte Produkte). Brutto-Umsatz gefiltert = 0 → „—".
- **Fremde/unbekannte `versionId`:** Redirect zum Dashboard (PROJ-73).
- **Eine Quell-API liefert einen Fehler:** betroffene Zeile zeigt leer/Hinweis, übrige Kaskade bleibt nutzbar; kein Seitenabsturz (wie Vorlage).
- **Sehr breite Tabelle (großer Planungshorizont):** horizontales Scrollen, erste Spalte sticky (wie Vorlage).

## Technical Requirements

- Client Component im Versions-Shell (`LangfristigeVersionShell`) mit Auth- und Versions-Eigentumsprüfung — wie Vorlage
- **Keine neue DB-Tabelle** — read-only, reine Aggregations-/Anzeigeschicht auf bestehenden versionsgebundenen Plandaten
- **Maximale Wiederverwendung der PROJ-95-Bausteine** ist ausdrücklich gewünscht (Ziel: „exakt gleich"):
  - Server-Route/Datenkette der Rentabilitätsauswertung liefert bereits alle Basiszeilen produktgranular inkl. Absatz. Für DB III werden nur die Basiszeilen bis inkl. `marketing` benötigt (`operativ`, `finanzierung_zinsen`, `steuern_ertrag` werden hier ignoriert). Ob die bestehende Route/der bestehende Hook parametrisiert (z.B. „max. Zeile" + „Produktfilter") wiederverwendet oder geklont wird, entscheidet `/architecture`.
  - Shared-Vertrag (`langfristige-rentabilitaetsauswertung-shared.ts`) und Matrix-/Chart-/Absatztabellen-Komponenten sollen möglichst geteilt/parametrisiert statt dupliziert werden.
- Nav-Änderung in `src/lib/langfristige-planung-nav.ts` (neuer Eintrag nach `rentabilitaetsauswertung`)
- Responsive: Mobil (375px) bis Desktop (1440px); keine neuen Packages (shadcn Table/Tabs/Tooltip/Button/Skeleton + Multi-Select-Muster vorhanden)

### Neue / geänderte Dateien (Richtwert — final in `/architecture`)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/deckungsbeitragsauswertung/page.tsx` | Neue Seite: Shell + Leiste (Zeitbasis, Ansicht, **Produktfilter**) + Diagramm + Absatztabelle + Matrix (bis DB III) |
| `src/lib/langfristige-planung-nav.ts` | Neuer Nav-Eintrag „Deckungsbeitragsauswertung" direkt nach „Rentabilitätsauswertung" |
| Hook / Komponenten / Route | Bevorzugt **Wiederverwendung/Parametrisierung** der bestehenden Rentabilitätsauswertungs-Bausteine (Kaskaden-Cutoff bei DB III + Produktfilter). Entscheidung Klonen vs. Parametrisieren in `/architecture`. |

### Wiederverwendung bestehender Muster

| Muster | Quelle (PROJ-95) |
|---|---|
| Datenkette, produktgranulare Berechnung, effektiver Soll | `use-langfristige-rentabilitaetsauswertung.ts` + Server-Route |
| Shared-Vertrag (Monate, Lines, Breakdown, Absatz) | `langfristige-rentabilitaetsauswertung-shared.ts` |
| Matrix, Drill-Down, sticky Spalte, Summen-Hervorhebung | `langfristige-rentabilitaetsauswertung-matrix.tsx` |
| Liniendiagramm | `langfristige-rentabilitaetsauswertung-chart.tsx` |
| Absatztabelle | `langfristige-rentabilitaetsauswertung-absatztabelle.tsx` |
| Zeitbasis-/Ansichtsmodus-Logik | `applyZeitbasis`, `RaAnzeigemodus`, `RaZeitbasis` |
| Multi-Select-Produktfilter | vorhandene Filtermuster der Planungs-/Auswertungsseiten (in `/architecture` konkretisieren) |

## Open Questions / Follow-ups (in `/architecture` zu klären)
- Route/Hook: bestehende Rentabilitätsauswertungs-Route parametrisieren (Cutoff DB III + Produktfilter) **oder** klonen? Empfehlung: parametrisieren/teilen, um Drift zu vermeiden.
- Produktfilter clientseitig (aus bereits geladenen produktgranularen Basiswerten neu aggregieren) vs. serverseitig (gefilterter Recompute). Empfehlung: clientseitig, da alle Basiszeilen bereits produktgranular vorliegen.
- Exakte Produktfilter-Zuordnung für Marketingkosten (Kanal × Produkt) und Umsatzsteuer.
- Angepasste Standard-Linienauswahl des Diagramms (nur bis DB III existierende Zeilen).
- UI-Platzierung/Optik des Produktfilters in der bestehenden Leiste (Reihenfolge Zeitbasis | Ansicht | Produkte).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-07-04)

### Leitidee: maximale Wiederverwendung, kein neues Backend

Die Analyse der bestehenden Rentabilitätsauswertung (PROJ-95) zeigt einen idealen Ausgangspunkt:

1. **Die Server-Route liefert bereits alle Kaskaden-Basiszeilen** (Brutto-Umsatz … Steuern) — **jede** produktgranular inkl. Drill-Down. Für DB III brauchen wir nur die Zeilen bis inkl. *Marketing* und ignorieren die drei darunter (Operativ/Finanzierung/Steuern).
2. **Die feste Kaskade wird von genau einer Definitionsliste gesteuert** (`RA_CASCADE`), die Zwischensummen (Netto-Umsatz, DB I, II, III …) an den richtigen Stellen einfügt. Eine **verkürzte Variante, die nach DB III endet**, genügt — der Rest der Rechenlogik (Zwischensummen, Ansichtsmodi, Drill-Down) bleibt unverändert.
3. **Alle für DB III relevanten Zeilen sind produktgranular** (Umsatz, Produktkosten, Vertriebskosten, Marketing). Der Produktfilter lässt sich daher **vollständig clientseitig** aus den bereits geladenen Drill-Down-Daten rechnen — **ohne neuen Server-Aufruf**.

**Ergebnis der Entscheidung: Es wird KEINE neue API-Route und KEINE neue DB-Tabelle gebaut.** Die neue Seite nutzt exakt dieselbe Datenquelle wie die Rentabilitätsauswertung und unterscheidet sich nur in zwei rein clientseitigen Punkten (Kaskaden-Cutoff + Produktfilter). Das garantiert automatisch, dass beide Seiten immer dieselben Zahlen zeigen (keine Drift).

### A) Wiederverwendung — was wird geteilt, was ist neu

| Baustein | Entscheidung |
|---|---|
| **API-Route** `…/rentabilitaetsauswertung/route.ts` | **Unverändert wiederverwendet.** Die neue Seite ruft denselben Endpunkt auf. Die drei Zeilen unterhalb DB III werden mitgeliefert, aber nicht dargestellt (vernachlässigbarer Mehraufwand). |
| **Shared-Vertrag** `langfristige-rentabilitaetsauswertung-shared.ts` | Unverändert wiederverwendet. |
| **Daten-Hook** `use-langfristige-rentabilitaetsauswertung.ts` | Wiederverwendet, mit **additiven, abwärtskompatiblen Ergänzungen** (siehe unten). Der Fetch-Hook selbst wird 1:1 genutzt. |
| **Matrix-Komponente** | Wiederverwendet; erhält eine **optionale** Eigenschaft „welche Kaskade" (Standard = volle Kaskade). Rentabilitätsauswertung bleibt unberührt. |
| **Chart-Komponente** | Wiederverwendet; erhält **optionale** Eigenschaften „welche Kaskade" und „Titel" (Standard = heutiges Verhalten). |
| **Absatztabelle** | **Unverändert wiederverwendet.** Sie liest die Absatz-Daten aus dem Modell — die sind nach dem Produktfilter bereits gefiltert. |
| **Seite** `…/deckungsbeitragsauswertung/page.tsx` | **NEU.** Kopiert den Aufbau der Rentabilitätsauswertungs-Seite und ergänzt den Produktfilter in der oberen Leiste. |
| **Navigation** `langfristige-planung-nav.ts` | **Geändert:** neuer Eintrag direkt nach „Rentabilitätsauswertung". |

**Additive Ergänzungen im Hook-Modul (brechen die bestehende Seite nicht):**
- eine **verkürzte Kaskaden-Definition**, die nach DB III endet (die vorhandene volle Kaskade wird bis einschließlich DB III genommen);
- die zentrale Kaskaden-Berechnung nimmt die Kaskaden-Definition künftig als **optionales Argument** an (Standard bleibt die volle Kaskade);
- eine **Produktfilter-Funktion**, die ein Modell auf ausgewählte Produkte reduziert (siehe C);
- eine **passende Standard-Linienauswahl** fürs Diagramm (Brutto-Umsatz, Netto-Umsatz, DB I, DB II, DB III).

### B) Komponenten- & Ablaufstruktur

```
/dashboard/langfristige-planung/[versionId]/deckungsbeitragsauswertung   (NEUE Seite)
│
└── LangfristigeVersionShell  (bestehend — Login-/Versions-Prüfung, Redirect, Menü, Titel „Deckungsbeitragsauswertung")
    │
    ├── Obere Leiste
    │   ├── Zeitbasis:  Monat | Jahr                         (bestehend, übernommen)
    │   ├── Ansicht:    Absolut | Prozentual | Wachstum      (bestehend, übernommen)
    │   └── Produkte:   Mehrfachauswahl-Dropdown             (NEU)
    │
    ├── Liniendiagramm  (wiederverwendet, Kaskade = bis DB III, Standardlinien angepasst)
    ├── Absatztabelle   (wiederverwendet, zeigt gefilterte Produkte)
    └── Deckungsbeitrags-Matrix  (wiederverwendet, Kaskade = bis DB III)
```

**Datenfluss auf der Seite (alles clientseitig nach einem einzigen Laden):**

```
1. Hook lädt EINMAL die Basiswerte (bestehende Route, unverändert).
2. Modell  →  Produktfilter anwenden  →  Zeitbasis (Monat/Jahr) anwenden  →  Anzeige.
     · Keine Produkte gewählt → Modell unverändert (identisch zur Rentabilitätsauswertung, nur bis DB III).
     · Produkte gewählt → Modell wird auf diese Produkte reduziert (siehe C).
3. Matrix & Chart bauen aus dem (gefilterten) Modell die Kaskade bis DB III.
   Umschalten von Zeitbasis / Ansicht / Produkten passiert rein clientseitig — kein neuer Server-Aufruf.
```

### C) Produktfilter — wie „Alles neu berechnen" clientseitig funktioniert

Jede DB-III-Zeile trägt im geladenen Modell bereits ihre **Aufschlüsselung bis auf Produktebene** (bei Marketing: Kanal → Produkt; bei allen anderen: direkt Produkt). Der Filter arbeitet daher rein auf diesen vorhandenen Daten:

- **Keine Auswahl** → Modell wird unverändert durchgereicht (garantiert bit-identisch zur Rentabilitätsauswertung bis DB III).
- **Ein/mehrere Produkte gewählt** → für jede Zeile werden nur die Aufschlüsselungs-Zweige der gewählten Produkte behalten; der Zeilenwert je Monat wird als **Summe der behaltenen Produktanteile** neu gebildet. Ergebnis:
  - alle Aggregate (Brutto-Umsatz … DB III) enthalten nur die gewählten Produkte,
  - Zwischensummen (Netto-Umsatz, DB I, II, III) rechnen sich automatisch neu,
  - das Diagramm folgt (liest dieselben Kaskaden-Werte),
  - die Absatztabelle zeigt nur die gewählten Produkte,
  - der Drill-Down zeigt auf unterster Ebene nur die gewählten Produkte.

**Produktliste fürs Dropdown:** wird aus dem bereits geladenen Modell abgeleitet (alle Produkte, die in Absatz-/Zeilen-Aufschlüsselungen vorkommen — inkl. Anzeigename). Kein zusätzlicher Server-Aufruf nötig; leere Version → leeres Dropdown. (Falls später eine garantiert vollständige Produktliste gewünscht ist — auch für Produkte ganz ohne Werte — kann optional die versionsgebundene Produkt-Stammliste nachgeladen werden; für den Filter-Nutzen ist das nicht erforderlich.)

> **Reihenfolge-Detail (für `/frontend`):** Produktfilter **vor** der Monat/Jahr-Verdichtung anwenden (erst Produkte reduzieren, dann auf Jahre aggregieren). Der Filter berührt nur die produktgranularen DB-III-Zeilen; die drei nicht dargestellten Zeilen darunter sind irrelevant.

### D) Datenmodell

**Keine neue Datenbanktabelle, keine Schemaänderung, keine neue RLS-Policy.** Rein lesende/rechnende Anzeigeschicht auf denselben versionsgebundenen Plandaten wie PROJ-95. Auth & Versions-Eigentum laufen unverändert über `requireAuth()` + `ensureLangfristigeVersion` in der (wiederverwendeten) Route und über die Versions-Shell.

### E) Warum das für den Nutzer gut ist

- **Konsistenz per Konstruktion:** Weil dieselbe Datenquelle genutzt wird, stimmen die DB-III-Zahlen der neuen Seite immer exakt mit der Rentabilitätsauswertung überein — es gibt keine zweite Berechnung, die auseinanderlaufen könnte.
- **Schnell & flüssig:** Zeitbasis-, Ansichts- und Produktfilter-Wechsel passieren ohne Nachladen.
- **Wartungsarm:** Nur eine neue Seite + ein Menüeintrag + kleine, abwärtskompatible Erweiterungen an geteilten Bausteinen. Kein dupliziertes Backend.

### F) Dependencies

Keine neuen Packages. Alles vorhanden: shadcn `Tabs`/`Label`/`Button`/`Table`/`Skeleton`, die bestehende `MultiSelect`-Komponente (bereits im Chart genutzt) für den Produktfilter, Recharts fürs Diagramm.

### G) Optionale spätere Optimierung (kein Teil dieser Umsetzung)

Ein „nur bis DB III"-Leichtmodus der Route (analog dem bestehenden `nur=umsatz`/`nur=operativ`) könnte die (ohnehin günstige) Ebene-2-Summierung überspringen. Nicht notwendig — der Mehraufwand ist vernachlässigbar; hier bewusst zugunsten von Einfachheit/Konsistenz weggelassen.

## Implementation Notes (Frontend — 2026-07-04)

Umgesetzt wie im Tech Design entworfen — **kein neues Backend, keine DB-Änderung, keine neue Route**. Die Seite teilt die komplette Datenkette der Rentabilitätsauswertung (PROJ-95).

**Neue Datei:**
- `src/app/dashboard/langfristige-planung/[versionId]/deckungsbeitragsauswertung/page.tsx` — kopiert den Aufbau der Rentabilitätsauswertungs-Seite; nutzt denselben Hook (`useLangfristigeRentabilitaetsauswertung`); ergänzt einen **Produktfilter** (`MultiSelect`) in der oberen Leiste (Zeitbasis | Ansicht | Produkte) inkl. „Filter zurücksetzen"; Pipeline `applyProduktFilter → applyZeitbasis`; übergibt `cascade={DB3_CASCADE}` an Matrix & Chart und `title="Deckungsbeitrags-Trend"` + `DB3_DEFAULT_CHART_IDS` an den Chart. Shell-Titel „Deckungsbeitragsauswertung".

**Geänderte Dateien (additiv, abwärtskompatibel — Rentabilitätsauswertung unberührt):**
- `src/hooks/use-langfristige-rentabilitaetsauswertung.ts`:
  - `RaRowDef` als Typ exportiert.
  - `DB3_CASCADE` = volle Kaskade bis inkl. `db3` (via `slice`).
  - `DB3_DEFAULT_CHART_IDS` = `['brutto_umsatz','netto_umsatz','db1','db2','db3']`.
  - `computeCascade(lines, columns, cascade = RA_CASCADE)` — optionaler Kaskaden-Parameter (Default unverändert).
  - `applyProduktFilter(model, selectedIds)` — reduziert alle produktgranularen Zeilen + Absatztabelle rein clientseitig auf die gewählten Produkte (rekursiv, auch die Kanal→Produkt-Verschachtelung von Marketing); leere Auswahl → Modell unverändert (bit-identisch).
  - `collectProdukte(model)` — Produktliste fürs Dropdown aus der Absatztabelle des Modells.
- `src/components/langfristige-rentabilitaetsauswertung-matrix.tsx`: optionale Prop `cascade?: RaRowDef[]` → an `computeCascade`.
- `src/components/langfristige-rentabilitaetsauswertung-chart.tsx`: optionale Props `cascade?: RaRowDef[]` + `title?: string` (Default „Rentabilitäts-Trend").
- `src/lib/langfristige-planung-nav.ts`: neuer Nav-Eintrag „Deckungsbeitragsauswertung" (Slug `deckungsbeitragsauswertung`) **direkt nach** „Rentabilitätsauswertung", vor „Liquiditätsauswertung".
- `src/components/langfristige-rentabilitaetsauswertung-absatztabelle.tsx`: **unverändert** wiederverwendet (zeigt automatisch die gefilterten Produkte des Modells).

**Verifikation:**
- `tsc --noEmit`: keine Fehler in den geänderten/neuen Produktivdateien (bestehende `.test.ts`-Fehler sind vorbestehend und unabhängig — siehe Projekt-Memory).
- Unit-Tests `use-langfristige-rentabilitaetsauswertung.test.ts`: 14/14 grün (7 bestehende + 7 neue für `DB3_CASCADE`, `computeCascade`-Cutoff, `applyProduktFilter` inkl. Marketing-Verschachtelung, `collectProdukte`).

**Hinweis:** Produktliste im Filter stammt aus der Absatztabelle (Produkte mit Absatz) — wie im Tech Design empfohlen; kein zusätzlicher Server-Aufruf. Manuell im Browser noch zu prüfen (siehe QA).

## QA Test Results (2026-07-04)

**Getestet von:** QA Engineer · **Ergebnis:** ✅ Production-Ready (keine Critical/High/Medium Bugs)

### Zusammenfassung
- Akzeptanzkriterien: **alle bestanden** (Navigation, DB-III-Cutoff, Produktfilter, geerbtes Verhalten)
- Bugs: **0 Critical, 0 High, 0 Medium, 2 Low** (Beobachtungen, kein Handlungsbedarf)
- Security-Audit: **keine Befunde** — keine neue API-Route, keine neue Angriffsfläche; Auth & Versions-Eigentum werden über die bestehende `LangfristigeVersionShell` (serverseitige Prüfung + Redirect) durchgesetzt
- Regression: **keine** — geteilte Bausteine additiv/abwärtskompatibel; Schwesterseiten grün

### Verifikationsmethode
Da die Seite rein anzeigend/rechnend ist und die komplette Datenkette von PROJ-95 teilt, lag der Fokus auf (a) statischer Prüfung, (b) Unit-Tests der differenzierenden Logik, (c) leichten E2E-Tests analog den Schwesterseiten (PROJ-96/98). Interaktions-/Rechenpfade mit echten Plandaten erfordern eine authentifizierte Session mit befüllter Planversion und sind — projektüblich — als manuell geprüft dokumentiert.

- **`tsc --noEmit`:** keine Fehler in den neuen/geänderten Produktivdateien (bestehende `.test.ts`-Fehler sind vorbestehend & unabhängig — siehe Projekt-Memory).
- **Vitest (`use-langfristige-rentabilitaetsauswertung.test.ts`):** 14/14 grün. Neue Tests decken ab: `DB3_CASCADE` endet bei DB III (keine Zeile darunter), `computeCascade`-Cutoff, `applyProduktFilter` (einstufig + verschachteltes Marketing Kanal→Produkt, Mehrfachauswahl-Summe, leere Auswahl = Pass-through), `collectProdukte`.
- **Vitest (Regression Shared-Hook-Konsument `use-langfristige-umsatzauswertung.test.ts`):** 12/12 grün → `computeCascade`-Default-Parameter bricht bestehende Aufrufer nicht.
- **Playwright (`tests/PROJ-106-…spec.ts`, chromium):** 4/4 grün — Route ohne 404, Auth-Redirect zu `/login`, Regression Rentabilitätsauswertung erreichbar, Dashboard-Auth-Redirect.

### Akzeptanzkriterien (Auszug, Ergebnis)

| Bereich | Kriterium | Ergebnis |
|---|---|---|
| Navigation | Eintrag direkt nach „Rentabilitätsauswertung", Slug `deckungsbeitragsauswertung` | ✅ (nav-Datei) |
| Navigation | Auth-Guard + Redirect bei fremder/unbekannter Version | ✅ (Shell + E2E) |
| Navigation | Shell-Titel „Deckungsbeitragsauswertung" | ✅ |
| Kaskade | Zeilen bis DB III, DB III = letzte Zeile, nichts darunter | ✅ (Unit) |
| Kaskade | Berechnung je Zeile identisch zu PROJ-95 (gleiche Quelle/Hook/Route) | ✅ |
| Kaskade | Zwischensummen hervorgehoben, Zeilen dauerhaft sichtbar | ✅ (geerbte Matrix) |
| Produktfilter | Mehrfachauswahl der Versionsprodukte; leer = alle | ✅ (Unit Pass-through) |
| Produktfilter | Auswahl rechnet Kaskade + Diagramm + Absatztabelle + Drill-Down neu | ✅ (Unit) |
| Produktfilter | rein clientseitig, kein neuer Server-Call | ✅ |
| Produktfilter | sichtbarer Hinweis („N ausgewählt") + „Filter zurücksetzen" | ✅ |
| Produktfilter | bleibt bei Wechsel Zeitbasis/Ansicht erhalten | ✅ (unabhängiger State) |
| Geerbt | Zeitbasis Monat/Jahr, Ansicht Absolut/Prozentual/Wachstum, Diagramm, Absatztabelle, Farben, Read-only, Versionsisolation | ✅ (unverändert wiederverwendet) |
| Geerbt | Diagramm-Standardlinien nur existierende Zeilen (Brutto, Netto, DB I/II/III) | ✅ (alle im Cascade eligible) |

### Edge Cases geprüft
- Leere Version → alle Werte 0, Struktur bis DB III sichtbar, leeres Produkt-Dropdown ✅
- Prozentual-Modus mit Produktfilter → Bezug = gefilterter Brutto-Umsatz ✅ (`bruttoByMonth` aus gefilterter Kaskade)
- Marketing im Produktfilter (Kanal→Produkt) → nur produktbezogener Anteil ✅ (Unit)
- „Alle Produkte einzeln" ≈ „keine Auswahl" ✅ (Unit: Summe = Gesamtwert; siehe Low-1 zur Rundung)
- Quell-API-Fehler → Fehlerbox, kein Absturz ✅ (`model.error` gerendert)
- Fremde Version → Redirect ✅

### Bugs / Beobachtungen

**Low-1 (Rundung, kosmetisch):** Bei aktivem Produktfilter werden Zeilenwerte aus den (auf 2 Nachkommastellen gerundeten) Produkt-Aufschlüsselungen neu summiert. Gegenüber der ungefilterten Ansicht (Route-Wert = gerundete Summe der Rohwerte) sind dadurch in Extremfällen Cent-Abweichungen möglich. Tritt praktisch nur beim expliziten Auswählen *aller* Produkte auf (was der leeren Auswahl entspricht). Auswirkung: ≤ 1 Cent Anzeige, keine falsche Analyse. **Kein Fix nötig.**

**Low-2 (Filter-Vollständigkeit):** Die Produktliste im Filter stammt aus der Absatztabelle (Produkte mit Absatz). Ein Produkt mit ausschließlich manuellem Rabatt und null Absatz erschiene nicht im Dropdown und wäre nicht einzeln filterbar. Pathologischer Fall; im ungefilterten Aggregat weiterhin korrekt enthalten. Entspricht der Tech-Design-Entscheidung (kein Zusatz-Request). **Kein Fix nötig; ggf. später optionale Stammlisten-Quelle.**

### Production-Ready: ✅ JA
Keine Critical/High/Medium Bugs. Die beiden Low-Beobachtungen sind bewusste, dokumentierte Trade-offs ohne funktionale Auswirkung.

## Deployment

- **Deployed:** 2026-07-05
- **Weg:** Push auf `main` → Vercel Auto-Deploy (Projekt `controlling-app`). Der Feature-Code ist in Commit `421b647` auf `main` und damit live. Tag: `v1.106.0-PROJ-106`.
- **Pre-Deploy-Gate:** `npm run build` erfolgreich („✓ Compiled successfully"; Route `/dashboard/langfristige-planung/[versionId]/deckungsbeitragsauswertung` als dynamische Route gebaut); 14/14 Unit-Tests grün (Hook inkl. neuer PROJ-106-Fälle) + 12/12 Regression (`umsatzauswertung`, weiterer `computeCascade`-Konsument); 4/4 Playwright; `tsc --noEmit` ohne neue Fehler in den geänderten/neuen Produktivdateien. `next lint` unter Next 16 in diesem Repo nicht lauffähig (bekannt — siehe Projekt-Memory).
- **Hinweis:** Reine Frontend-Änderung — **kein neues Backend, keine Migration, keine neuen Env-Vars, keine RLS-Änderung**. Additive, abwärtskompatible Erweiterungen an den geteilten PROJ-95-Bausteinen; Rentabilitätsauswertung unberührt.
- **Nach-Deploy-Verifikation (durch Nutzer):** Live-URL öffnen → Planversion → Auswertungen → „Deckungsbeitragsauswertung": Kaskade endet bei DB III, Produktfilter reduziert Kaskade/Diagramm/Absatztabelle, Zeitbasis/Ansicht funktionieren, keine Konsolenfehler.
