# PROJ-102: Plan-Ist-Vergleich (Reporting)

## Status: Deployed
**Created:** 2026-06-28
**Last Updated:** 2026-06-28

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-20 (Rentabilitätsreport) — transaktionsbasierte Rentabilitäts-/COGS-Berechnung als **Ist**-Quelle (Wertberechnung: Direktbuchungen, Abschreibungen, Produktinvestitionen-Raten, Produktkosten-Bestand, Wertverlust, manuelle Sendungen)
- Requires: PROJ-27 (Deckungsbeitragsreport) — bestehende transaktionsbasierte **GuV-/DB-Kaskade** (Brutto-Umsatz → DB → … ), Vorlage/Quelle für die Ist-Spalte in Kaskadenform
- Requires: PROJ-24 (Rentabilitätsreport — Ansichtsmodi) — Definition der Prozent-Darstellung („Anteil am Brutto-Umsatz des Monats")
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — Liste der wählbaren Planversionen, versionsgebundenes Lesen
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — Startmonat/Planungshorizont der gewählten Version (bestimmt, welche Monate als Soll verfügbar sind)
- Requires: PROJ-95 (Rentabilitätsauswertung — Langfristige Planung) — feste GuV-Kaskade der gewählten Planversion als **Soll**-Quelle (Werte je Monat, Drill-Down bis Produkt)
- Vorlage (kein harter Require): PROJ-28 (Break-Even-Report) — Nav-Position (neuer Eintrag direkt darunter) und Reporting-Seitenmuster

## Übersicht

Eine neue Reporting-Seite **„Plan-Ist-Vergleich"** unter `/dashboard/reporting/plan-ist-vergleich`. Sie stellt die **Rentabilitätsrechnung** des Unternehmens als **Ist** (aus dem Reporting-Bereich, transaktionsbasiert) der **Rentabilitätsrechnung einer langfristigen Planversion** als **Soll** gegenüber — für **einen** vom Nutzer gewählten Monat.

Die Tabelle hat **drei Wertspalten**:

| Spalte | Inhalt |
|---|---|
| **Ist** | Wert aus dem Reporting (transaktionsbasiert) für den gewählten Monat. Oben prozentual (Anteil am Brutto-Umsatz **Ist** des Monats), darunter der absolute €-Betrag. |
| **Soll** | Wert aus der langfristigen Rentabilitätsauswertung der gewählten Planversion für denselben Monat. Oben prozentual (Anteil am Brutto-Umsatz **Soll** des Monats), darunter der absolute €-Betrag. |
| **Abweichung** | **Absolut = Ist − Soll**, darunter **prozentual = (Ist − Soll) / \|Soll\| × 100**. |

**Zeilenstruktur = feste GuV-Kaskade** (identisch zur langfristigen Rentabilitätsauswertung, PROJ-95):

```
Brutto-Umsatz
− Rabatte
− Rückerstattungen
− Umsatzsteuer
─────────────────────────────
= Netto-Umsatz
─────────────────────────────
− Produktkosten            (Summe der Unterzeilen)
    · Ware
    · Inspektion
    · Shipping
    · Zoll
    · Einlagerung
─────────────────────────────
= DB I
─────────────────────────────
− Vertriebskosten          (Summe der Unterzeilen)
    · Versand
    · Lagerung
    · Retouren
    · Ersatzteile / Kulanz
    · Verkaufsgebühren
─────────────────────────────
= DB II
─────────────────────────────
− Marketingkosten
= DB III
− Operative Kosten
= EBIT
− Investitionskosten
= EBIT nach Investitionen
− Finanzierungskosten (nur Zinsen)
= EBT
− Steuern (nur Ertragssteuern)
= Ergebnis
```

Jede berechnete Zeile ist — wie in den bestehenden Reports — **ausklappbar**: die Drill-Down-Ebenen (Kategorien, Gruppen, Untergruppen, Sales Plattformen, Produkte) entsprechen **genau der Struktur der bestehenden Reports**. Zwischensummen-Zeilen (Netto-Umsatz, DB I, DB II, DB III, EBIT, EBIT nach Investitionen, EBT, Ergebnis) sind nicht ausklappbar und visuell hervorgehoben.

> **Hinweis Soll-Quelle:** Die Soll-Werte sind die der langfristigen Rentabilitätsauswertung (PROJ-95) für den gewählten Monat. Diese Seite produziert die Kaskade bereits monatsweise; der Plan-Ist-Vergleich greift die Spalte des gewählten Monats heraus.
> **Hinweis Ist-Quelle:** Die Ist-Werte stammen aus der transaktionsbasierten Rentabilitäts-/Deckungsbeitragsberechnung des Reportings (PROJ-20/27), aufbereitet in derselben festen Kaskade.

## User Stories

- Als Controller möchte ich eine Plan-Ist-Vergleichsseite im Reporting öffnen können (linkes Menü + Dashboard, direkt unter dem Break-Even-Report), damit ich Soll und Ist an einer Stelle gegenüberstelle.
- Als Controller möchte ich oben auf der Seite eine bestehende Planversion als Soll wählen, damit ich gegen das gewünschte Szenario vergleiche.
- Als Controller möchte ich einen bestimmten Monat wählen, der für Ist **und** Soll gilt, damit beide Spalten denselben Zeitraum abbilden.
- Als Controller möchte ich je Zeile Ist und Soll jeweils prozentual (Anteil am Brutto-Umsatz) und darunter absolut sehen, damit ich Struktur und Höhe gleichzeitig erkenne.
- Als Controller möchte ich je Zeile die Abweichung absolut (Ist − Soll) und prozentual (bezogen auf Soll) sehen, damit ich Plan-Treue auf einen Blick beurteile.
- Als Controller möchte ich jede Kaskaden-Zeile bis auf Produkt-/Kategorieebene ausklappen, damit ich Abweichungsursachen nachvollziehe.

## Acceptance Criteria

### Seite & Navigation

- [ ] Seite erreichbar unter `/dashboard/reporting/plan-ist-vergleich`
- [ ] Nur für eingeloggte Nutzer zugänglich (Redirect zu `/login`, `?next`-Parameter bleibt erhalten)
- [ ] Im linken Reporting-Menü erscheint ein neuer Eintrag **„Plan-Ist-Vergleich"** direkt **unter „Break-Even-Report"** (zwischen Break-Even-Report und Liquiditätsreport)
- [ ] Auf dem Dashboard (`/dashboard`) erscheint eine Kachel/ein Eintrag **„Plan-Ist-Vergleich"** direkt **unter „Break-Even-Report"**

### Auswahl (Kopfleiste)

- [ ] Oben auf der Seite: **Planversions-Auswahl** (Dropdown mit allen bestehenden Planversionen des Nutzers) → bestimmt die **Soll**-Quelle
- [ ] Oben auf der Seite: **Monatsauswahl** (Monat + Jahr, z. B. `<input type="month">`) → gilt **gleichzeitig** für Ist und Soll
- [ ] Standardzustand beim Öffnen: keine Version / kein Monat vorausgewählt **oder** sinnvolle Defaults (erste Version, aktueller Monat) — in `/architecture` festzulegen
- [ ] Ändert der Nutzer Version oder Monat, aktualisieren sich beide Wertspalten und die Abweichung entsprechend
- [ ] Solange keine Planversion **und** kein Monat gewählt sind, zeigt die Tabelle einen Hinweis-/Leerzustand

### Zeilenstruktur (feste GuV-Kaskade)

- [ ] Die Zeilen sind **fest vorgegeben** in der oben gezeigten Reihenfolge (Brutto-Umsatz … Ergebnis), identisch zur langfristigen Rentabilitätsauswertung (PROJ-95)
- [ ] Zwischensummen-Zeilen (Netto-Umsatz, DB I, DB II, DB III, EBIT, EBIT nach Investitionen, EBT, Ergebnis) sind hervorgehoben (fett, Hintergrund, Trennlinie) und **nicht** ausklappbar
- [ ] Alle Zeilen sind dauerhaft sichtbar, auch wenn Ist und Soll beide 0 sind
- [ ] Es gibt **kein** konfigurierbares Reporting-Modell und keinen Konfigurations-Tab auf dieser Seite

### Ausklappbare Zeilen (Drill-Down)

- [ ] Jede berechnete (nicht-Zwischensummen-)Zeile ist ausklappbar
- [ ] Die Drill-Down-Ebenen (Kategorien, Gruppen, Untergruppen, Sales Plattformen, Produkte) entsprechen **genau der Struktur der bestehenden Reports** — auf jeder Ebene werden Ist, Soll und Abweichung analog zur Hauptzeile dargestellt
- [ ] Existiert ein Element (z. B. Produkt) nur auf einer Seite (Ist **oder** Soll), wird die fehlende Seite als 0 behandelt; die Zeile bleibt sichtbar und die Abweichung wird gegen 0 berechnet
- [ ] Globaler „Alle ausklappen / Alle einklappen"-Button vorhanden
- [ ] Expand/Collapse-Zustand bleibt erhalten, wenn nur die Version oder der Monat gewechselt wird

### Wertberechnung & Spalten

- [ ] **Ist-Spalte**: Wert je Zeile aus der transaktionsbasierten Rentabilitäts-/Deckungsbeitragsberechnung (PROJ-20/27) für den gewählten Monat
- [ ] **Soll-Spalte**: Wert je Zeile aus der langfristigen Rentabilitätsauswertung (PROJ-95) der gewählten Planversion für denselben Monat
- [ ] In Ist und Soll wird je Zelle **oben der Prozentwert**, **darunter der absolute €-Betrag** angezeigt
- [ ] **Prozentwert in Ist** = `Ist-Wert / Brutto-Umsatz Ist des Monats × 100` (1 Dezimalstelle, %); Brutto-Umsatz Ist = 0 → „—"
- [ ] **Prozentwert in Soll** = `Soll-Wert / Brutto-Umsatz Soll des Monats × 100` (1 Dezimalstelle, %); Brutto-Umsatz Soll = 0 → „—"
- [ ] **Abweichung absolut** = `Ist − Soll` (€, 2 Dezimalstellen)
- [ ] **Abweichung prozentual** = `(Ist − Soll) / |Soll| × 100` (1 Dezimalstelle, %); Soll = 0 → „—" bzw. „n/a"
- [ ] Soll-Werte stammen ausschließlich aus der gewählten `versionId` (keine Vermischung mit Ist-Transaktionen oder anderen Versionen)
- [ ] Liegt der gewählte Monat **außerhalb** des Planungsfensters der gewählten Version (Startmonat … Planungshorizont) → alle Soll-Werte 0 mit dezentem Hinweis; Ist wird trotzdem angezeigt

### Darstellung

- [ ] Positive Werte grün/schwarz, negative Werte (Kosten, negative Zwischensummen, negative Abweichungen) rot mit Minuszeichen
- [ ] Beträge im de-DE-Format mit 2 Dezimalstellen und € (z. B. „12.450,00 €"); 0 als „0,00 €" (nicht leer)
- [ ] Prozentwerte mit 1 Dezimalstelle und „%"
- [ ] Erste Spalte (Zeilenbeschriftung) ist `sticky left`; Tabelle bei Bedarf horizontal scrollbar
- [ ] Abweichungsspalte ist farblich/visuell als eigene Spalte erkennbar (Ist | Soll | Abweichung)

### Leer- & Fehlerzustände

- [ ] Keine Planversion gewählt → Hinweis „Bitte Planversion wählen"
- [ ] Kein Monat gewählt → Hinweis „Bitte Monat wählen"
- [ ] Keine Planversionen vorhanden → Hinweis mit Verweis auf die Langfristige Planung
- [ ] Eine der Quellen liefert einen Fehler → betroffene Spalte/Zeile zeigt Hinweis, die übrige Tabelle bleibt nutzbar (kein Seitenabsturz)

## Edge Cases

- Planversion ist leer/neu → alle Soll-Werte 0; Abweichung = Ist; prozentuale Abweichung „—" (Soll = 0)
- Gewählter Monat ohne Ist-Transaktionen → Ist-Werte 0; Soll wird angezeigt; Abweichung = −Soll
- Brutto-Umsatz Ist = 0 → Ist-Prozentspalte „—"; Soll-Prozentspalte unabhängig davon
- Brutto-Umsatz Soll = 0 → Soll-Prozentspalte „—"
- Soll-Zeilenwert = 0, Ist ≠ 0 → absolute Abweichung = Ist, prozentuale Abweichung „—"/„n/a"
- Produkt existiert in der Version, aber nicht in den Ist-Stammdaten (oder umgekehrt) → fehlende Seite = 0, Zeile bleibt sichtbar
- Monat außerhalb des Planungshorizonts der Version → Soll = 0 + Hinweis, Ist normal
- Negative Zwischensummen (z. B. negativer EBIT) in Ist oder Soll → rot, Vorzeichen-konform; Abweichung weiterhin Ist − Soll
- Version wird gewechselt → nur Soll-Spalte + Abweichung ändern sich; Ist bleibt (gleicher Monat)
- Sehr viele ausgeklappte Produkt-/Kategoriezeilen → Tabelle bleibt performant (eine Berechnung je Auswahl, Drill-Down clientseitig)

## Technical Requirements

- **URL:** `/dashboard/reporting/plan-ist-vergleich`
- **Auth:** `requireAuth()` in allen ggf. neuen API-Routen; Seite als Client Component im Reporting-Layout
- **Ist-Quelle:** transaktionsbasierte Kaskade aus dem Reporting (PROJ-20/27) — exakte Wiederverwendung der bestehenden Berechnung (`/api/reporting/rentabilitaet` bzw. `/api/reporting/deckungsbeitrag`), aufbereitet als feste GuV-Kaskade für den gewählten Monat
- **Soll-Quelle:** langfristige Rentabilitätsauswertung der gewählten Version (PROJ-95) — Werte des gewählten Monats; **keine** Neu-Implementierung der Kaskaden-Logik, sondern Wiederverwendung
- **Keine neue DB-Tabelle** — reine Lese-/Rechen-/Anzeigeschicht
- **Monat als gemeinsamer Filter** für beide Quellen; Soll ist auf das Planungsfenster der Version begrenzt
- **Performance:** ein Datenabruf je (Version, Monat); Drill-Down clientseitig auf bereits geladenen Daten
- Wiederverwendung bestehender Muster: Matrix/sticky erste Spalte/Drill-Down aus `reporting-rentabilitaet-matrix.tsx`; Prozent-Definition aus PROJ-24; shadcn `Table`, `Select`, `Button`, `Skeleton` (alle vorhanden)
- Responsive: 375px (mobil) bis 1440px (desktop)

### Offene Punkte für `/architecture`
- Exakte Ist-Kaskaden-Quelle: bestehende Deckungsbeitrags-/Rentabilitäts-Route wiederverwenden vs. neue Sammelroute, die beide Seiten (Ist + Soll) für einen Monat bündelt
- Default-Vorauswahl für Version und Monat
- Mapping/Abgleich der Drill-Down-Elemente zwischen Ist (global) und Soll (versionsgebunden), insb. Produkt-Identität
- Konsistenz der Umsatzsteuer-Logik zwischen Ist und Soll (gleiche Berechnungsbasis)
- Ob ein „Ohne Investitionen"-Filter (analog PROJ-25/95) ergänzt werden soll (aktuell **nicht** im Scope)

## Non-Goals
- Mehr-Monats-/Zeitraum-Vergleich (es wird genau **ein** Monat verglichen)
- Granularitäts-Umschalter (Quartal/Jahr)
- Editierbarkeit von Ist- oder Soll-Werten (rein anzeigend)
- „Ohne Investitionen"-Filter, Liniendiagramm, Absatztabelle (sofern nicht in `/architecture` ergänzt)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-28)

### Leitidee

Diese Seite **rechnet nichts Neues** — sie stellt zwei bereits existierende, QA-geprüfte Rentabilitätsrechnungen nebeneinander:

- **Soll** = die langfristige Rentabilitätsauswertung (PROJ-95) der gewählten Planversion. Sie liefert bereits die **feste GuV-Kaskade** (Brutto-Umsatz … Ergebnis) Monat für Monat.
- **Ist** = der Rentabilitätsreport aus dem Reporting (PROJ-20), transaktionsbasiert, für genau den gewählten Monat.

Beide Quellen werden **unverändert** wiederverwendet. Die neue Seite holt beide ab, ordnet die Ist-Werte den festen Kaskadenzeilen über **Namensgleichheit** zu, und berechnet je Zeile die Abweichung. Das garantiert, dass Ist und Soll **exakt** zu den jeweiligen Originalreports passen (keine abweichende Zweitberechnung).

> **Wichtigste Entscheidung: keine neue Server-/API-Route, keine neue Datenbanktabelle.** Die Seite ist eine reine Lese-/Vergleichs-/Anzeigeschicht auf zwei bestehenden Endpunkten. Da nur **ein** Monat verglichen wird, ist die Datenmenge klein und der Abgleich läuft komplett im Browser.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/reporting/plan-ist-vergleich   (NEUE Seite)
│
├── Kopfleiste
│   ├── Planversions-Auswahl   (Dropdown — Soll-Quelle)
│   ├── Monatsauswahl          (Monat+Jahr — gilt für Ist UND Soll)
│   └── Buttons „Alle ausklappen" | „Alle einklappen"
│
└── Plan-Ist-Vergleich-Matrix   (NEUE Hauptkomponente, read-only)
    ├── Kopf: [ Bezeichnung (sticky links) | Ist | Soll | Abweichung ]
    └── Feste GuV-Kaskade (Brutto-Umsatz … Ergebnis)
        ├── Zwischensummen-Zeilen (Netto-Umsatz, DB I/II/III, EBIT, EBT, Ergebnis) — hervorgehoben, nicht ausklappbar
        └── berechnete Zeilen — ausklappbar (Drill-Down, siehe D)
            └── je Zelle: oben Prozent, darunter Absolutbetrag
```

Die Tabellen-Mechanik (sticky erste Spalte, horizontales Scrollen, Ausklapp-Logik, Farb-/Währungsformatierung) wird **aus den bestehenden Report-Matrizen übernommen** (`reporting-rentabilitaet-matrix.tsx` als Vorlage; Kaskaden-/Subtotal-Berechnung aus PROJ-95).

### B) Datenfluss (in einfachen Worten)

```
1. Seite öffnet → lädt die Liste der Planversionen (bestehender Endpunkt).
2. Nutzer wählt Planversion + Monat (Standard: erste Version, aktueller Monat).
3. Die Seite holt parallel:
   a) SOLL: die langfristige Rentabilitätsauswertung der Version (liefert alle Monate)
            → der gewählte Monat wird als Spalte herausgegriffen
            → daraus wird die feste Kaskade inkl. Zwischensummen gerechnet (bestehende Logik)
   b) IST:  den Rentabilitätsreport für genau diesen einen Monat
            → liefert die nutzer-definierten Reporting-Modell-Positionen
4. Abgleich (Namensgleichheit): jede feste Kaskadenzeile sucht eine gleichnamige Ist-Position.
   - Treffer  → deren Ist-Wert füllt die Ist-Spalte
   - kein Treffer → Ist-Spalte zeigt „—"
5. Je Zeile: Abweichung = Ist − Soll (absolut) und (Ist − Soll) / |Soll| × 100 (prozentual).
6. Anzeige; Ausklappen passiert rein clientseitig auf den bereits geladenen Daten.
```

Wechselt der Nutzer **nur den Monat**, werden Ist (neuer Monat) und die Soll-Spalte neu bestimmt. Wechselt er **nur die Version**, wird Soll neu geladen, Ist bleibt (gleicher Monat).

### C) Namenszuordnung Ist → Kaskade (das Kernkonzept)

Die feste Kaskade hat bekannte Zeilenbezeichnungen (Brutto-Umsatz, Rabatte, Rückerstattungen, Umsatzsteuer, Netto-Umsatz, Produktkosten + Unterzeilen Ware/Inspektion/Shipping/Zoll/Einlagerung, DB I, Vertriebskosten + Unterzeilen Versand/Lagerung/Retouren/Ersatzteile-Kulanz/Verkaufsgebühren, DB II, Marketingkosten, DB III, Operative Kosten, EBIT, Investitionskosten, EBIT nach Investitionen, Finanzierungskosten, EBT, Steuern, Ergebnis).

- Der **Soll-Wert** jeder Zeile kommt aus der langfristigen Auswertung (inkl. der feinen Kostenzeilen).
- Der **Ist-Wert** jeder Zeile entsteht durch **case-insensitiven Namensvergleich** mit den Positionen des Reporting-Modells. Findet sich keine gleichnamige Ist-Position (typisch für die feinen Kostenzeilen wie „Versand", „Lagerung"), bleibt die Ist-Spalte dieser Zeile **leer („—")**; die Abweichung wird dann nicht berechnet.
- **Ist-Zwischensummen** (z. B. „DB I", „EBIT") werden **direkt** aus der gleichnamigen Ist-Summen-Position übernommen — sie werden **nicht** aus Teilzeilen aufkumuliert (da die Ist-Seite ggf. lückenhaft ist, wäre Aufkumulieren falsch). Die Soll-Zwischensummen entstehen wie gewohnt durch Kumulation der Soll-Kaskade.

> **Empfehlung an das Controlling-Team (PM-Hinweis):** Damit möglichst viele Zeilen einen Ist-Wert zeigen, sollten die Bezeichnungen im Reporting-Modell den Kaskaden-Zeilennamen entsprechen (z. B. eine Summen-Position „Netto-Umsatz", „DB I", „EBIT"). Das ist die einzige „Pflege", die der Vergleich braucht — ohne neue Konfigurationsseite.

### D) Drill-Down (Ausklappen)

Beim Ausklappen einer Zeile werden die Unterzeilen **beider** Seiten zusammengeführt — ebenfalls per Namensgleichheit:

- **Soll**-Unterzeilen folgen der Produkt-Aufschlüsselung der langfristigen Auswertung.
- **Ist**-Unterzeilen folgen der gewohnten Report-Hierarchie (Kategorie → Gruppe → Untergruppe → Sales Plattform → Produkt).
- Unterzeilen mit **gleichem Namen** (insb. **Produkte**) werden zu **einer** Vergleichszeile zusammengeführt (Ist | Soll | Abweichung). Existiert eine Unterzeile nur auf einer Seite, zeigt die andere Seite „—".
- So liegen vor allem die **Produkte** sauber nebeneinander (der wertvollste Vergleich); strukturell nur auf einer Seite vorhandene Zwischenebenen erscheinen mit einseitigen Werten.

### E) Spalten- & Zell-Darstellung

| Spalte | oben | darunter |
|---|---|---|
| **Ist** | Prozent = Ist-Wert / **Ist-Brutto-Umsatz des Monats** × 100 (1 Dezimalst.; „—" falls Ist-Brutto = 0 oder kein Ist-Wert) | Absolutbetrag in € |
| **Soll** | Prozent = Soll-Wert / **Soll-Brutto-Umsatz des Monats** × 100 (1 Dezimalst.; „—" falls Soll-Brutto = 0) | Absolutbetrag in € |
| **Abweichung** | Absolut = **Ist − Soll** (€) | Prozent = (Ist − Soll) / **\|Soll\|** × 100 (1 Dezimalst.; „—"/„n/a" falls Soll = 0) |

Farben: positiv grün/schwarz, negativ rot mit Minuszeichen; 0 als „0,00 €" (nicht leer). de-DE-Format, 2 Nachkommastellen für €, 1 für %.

### F) Monatsabgleich & Grenzfälle

- Der gewählte Monat (Format `YYYY-MM`) wird einerseits in den Ist-Report-Aufruf (von = bis = dieser Monat, Granularität „Monat") übersetzt, andererseits auf den passenden Monats-Schlüssel der Soll-Auswertung abgebildet.
- Liegt der Monat **außerhalb** des Planungsfensters der Version → die Soll-Spalte enthält für diesen Monat keine Werte → alle Soll-Zellen 0 mit dezentem Hinweis; Ist wird normal angezeigt.
- Liefert eine der beiden Quellen einen Fehler → die betroffene Spalte zeigt einen Hinweis, die Tabelle bleibt nutzbar (kein Seitenabsturz).

### G) Datenmodell

**Keine neue Datenbanktabelle.** Es werden ausschließlich bestehende, versionsgebundene bzw. transaktionsbasierte Daten gelesen. Die Seite speichert nichts.

Im Moment des Aufrufs entsteht (nur im Speicher) ein zusammengesetztes Vergleichsergebnis:

```
Vergleich (für den gewählten Monat)
  zeilen: feste, geordnete Kaskade, je Zeile:
     - bezeichnung / typ ('zeile' | 'zwischensumme')
     - ist:  Betrag | null        (null = keine gleichnamige Ist-Position)
     - soll: Betrag
     - abweichung_absolut, abweichung_prozent (oder null)
     - ist_prozent, soll_prozent  (Anteil am jeweiligen Brutto-Umsatz)
     - kinder: zusammengeführte Unterzeilen (Ist|Soll je Name)
```

### H) Was neu gebaut wird vs. was wiederverwendet wird

| | Beschreibung |
|---|---|
| **Wiederverwendet (unverändert)** | Versionsliste (`GET /api/langfristige-planung/planversionen`); Soll-Quelle (`GET /api/langfristige-planung/[versionId]/rentabilitaetsauswertung`); Ist-Quelle (`GET /api/reporting/rentabilitaet`); Kaskaden-/Subtotal-Berechnung + Kaskaden-Definition aus PROJ-95 (`langfristige-rentabilitaetsauswertung-shared` / `use-langfristige-rentabilitaetsauswertung`); Prozent-Definition aus PROJ-24; shadcn `Select`, `Table`, `Button`, `Skeleton`, `<input type="month">` |
| **Vorlage zum Klonen (UI)** | `reporting-rentabilitaet-matrix.tsx` (sticky Spalte, Ausklappen, Farb-/Währungsformat) |
| **Neu** | Eine Seite, ein Daten-/Abgleich-Hook, eine Vergleichs-Matrix-Komponente (3 Spalten, zweizeilige Zellen), ein Nav-Eintrag, ein Dashboard-Eintrag |
| **Bewusst NICHT neu** | Keine neue API-Route, keine neue DB-Tabelle, keine Änderung an den Quellreports, keine neue Konfigurationsseite |

### I) Neue & geänderte Dateien (Richtwert)

| Datei | Zweck |
|---|---|
| `src/app/dashboard/reporting/plan-ist-vergleich/page.tsx` (neu) | Seite: Kopfleiste (Version + Monat + Ausklappen) + Vergleichs-Matrix |
| `src/hooks/use-plan-ist-vergleich.ts` (neu) | Version-/Monatszustand, paralleles Laden Ist+Soll, Namensabgleich, Abweichungs- und Prozentberechnung, Ausklappzustand |
| `src/components/plan-ist-vergleich-matrix.tsx` (neu) | 3-Spalten-Matrix, zweizeilige Zellen, sticky erste Spalte, Drill-Down |
| `src/components/nav-sheet.tsx` (geändert) | Neuer Reporting-Eintrag „Plan-Ist-Vergleich" direkt unter „Break-Even-Report" |
| `src/app/dashboard/page.tsx` (geändert) | Neuer Dashboard-Eintrag „Plan-Ist-Vergleich" direkt unter „Break-Even-Report" |

### J) Tech-Entscheidungen (begründet)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Berechnung | **Keine neue Server-Route** — bestehende Ist-/Soll-Endpunkte wiederverwenden, Abgleich im Browser | Garantiert Übereinstimmung mit den Originalreports; nur 1 Monat → kleine Datenmenge; weniger Code & Fehlerquellen |
| Ist→Kaskade | **Namensgleichheit** (case-insensitiv) | Vom Nutzer gewählt; kein neues Setup; nutzt das ohnehin GuV-ähnliche Reporting-Modell |
| Ist-Zwischensummen | **direkt** aus gleichnamiger Ist-Position, nicht kumuliert | Ist-Seite kann lückenhaft sein; Kumulation aus Teilzeilen wäre falsch |
| Drill-Down | Unterzeilen **per Name zusammenführen** (Produkte matchen sauber) | Erfüllt „gleiche Kategorien/Produkte wie in den Reports" so weit wie strukturell möglich |
| Monatswahl | `<input type="month">`, gilt für beide Seiten | Browser-nativ, liefert direkt `YYYY-MM`; ein gemeinsamer Filter |
| Versionswahl | shadcn `Select`, Quelle bestehende Versionsliste | Konsistent mit der Langfristigen Planung |
| Speicherung | **keine** (read-only) | Reine Auswertung; nichts zu persistieren |

### K) Abhängigkeiten (Pakete)

Keine neuen Pakete nötig — alle benötigten Bausteine (shadcn-Komponenten, Recharts falls später ein Diagramm gewünscht) sind bereits im Projekt vorhanden.

### Offene Punkte / Hinweise für `/frontend`
- Default-Vorauswahl: erste Planversion + aktueller Monat (anpassbar).
- Genaue Mapping-Feinheiten der Zeilennamen (z. B. „DB1" vs „DB I", „Umsatzsteuer" vs „USt") — tolerant vergleichen (Normalisierung von Leerzeichen/Schreibweise) empfohlen.
- „Ohne Investitionen"-Filter, Liniendiagramm und Absatztabelle sind **nicht** Teil dieses Scopes (siehe Non-Goals) — später ergänzbar, da beide Quellen die Daten liefern.

## Implementation Notes (Frontend — 2026-06-28)

Umgesetzt als reine Lese-/Vergleichsschicht **ohne neue API-Route und ohne neue DB-Tabelle** — exakt wie im Tech Design vorgesehen. Beide bestehenden Quellen werden geladen und clientseitig zur festen GuV-Kaskade zusammengeführt.

### Neue Dateien
- `src/hooks/use-plan-ist-vergleich.ts` — Versions-/Monatszustand, paralleles Laden von Soll (langfristige Rentabilitätsauswertung) und Ist (Rentabilitätsreport, ein Monat), Namensabgleich, Aufbau des Vergleichsbaums (`PivNode`), Brutto-Umsatz-Bezugsgrößen, Out-of-Window-Erkennung. Exporte: `usePlanIstVergleich`, `canonName`, Typen `PivNode`/`PlanIstVergleichModel`/`PlanVersion`.
- `src/components/plan-ist-vergleich-matrix.tsx` — 3-Spalten-Matrix (Ist | Soll | Abweichung), zweizeilige Zellen (Ist/Soll: oben % / unten €; Abweichung: oben € / unten %), sticky erste Spalte, horizontales Scrollen, Drill-Down mit „Alle ausklappen/einklappen", Lade-/Leerzustände.
- `src/app/dashboard/reporting/plan-ist-vergleich/page.tsx` — Seite: Kopfleiste mit Planversions-Dropdown (shadcn `Select`) + Monatswähler (`<input type="month">`), Hinweise (keine Versionen, Monat außerhalb Planungshorizont), Fehleranzeige, Matrix.

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — neuer Reporting-Eintrag „Plan-Ist-Vergleich" direkt unter „Break-Even-Report".
- `src/app/dashboard/page.tsx` — neue Dashboard-Kachel „Plan-Ist-Vergleich" direkt unter „Break-Even-Report".

### Wiederverwendung
- Soll-Kaskade über `computeCascade` + `RA_CASCADE` aus `use-langfristige-rentabilitaetsauswertung` (PROJ-95) und den Vertrag aus `langfristige-rentabilitaetsauswertung-shared`.
- Ist über `GET /api/reporting/rentabilitaet` (PROJ-20), Typen aus `use-reporting-rentabilitaet`.
- Versionsliste über `GET /api/langfristige-planung/planversionen`.

### Designentscheidungen / Details
- **Namensabgleich (`canonName`)**: lowercase, Umlaut-Auflösung (ä→ae …), Entfernen von Leer-/Sonderzeichen, plus DB-Alias-Mapping (`DB I`↔`db1`, `Deckungsbeitrag 1`↔`db1`, …). Zuverlässige Treffer u. a. für Brutto-Umsatz, Netto-Umsatz, DB I/II/III, EBIT, EBT, Ergebnis, Umsatzsteuer. Zeilen ohne gleichnamige Ist-Position → Ist-Zelle „—".
- **Ist-Zwischensummen** werden direkt aus der gleichnamigen Ist-Summen-Position übernommen (nicht aufkumuliert), Soll-Zwischensummen via `computeCascade`.
- **Drill-Down**: Soll-Produkt-Aufschlüsselung und Ist-Hierarchie (Kategorie→Gruppe→Untergruppe→Plattform→Produkt, einzelne Kategorie übersprungen wie im Report) werden per Namensgleichheit rekursiv zusammengeführt; einseitige Knoten zeigen „—" auf der fehlenden Seite.
- **Monatsschlüssel**: Ist nutzt `YYYY-MM` (gepaddet), Soll `YYYY-M` (ungepaddet) — Konvertierung im Hook. Monat außerhalb des Planungsfensters → alle Soll-Werte 0 + amber Hinweis.
- **Prozente**: Ist-% bezogen auf Ist-Brutto-Umsatz des Monats, Soll-% auf Soll-Brutto-Umsatz; Abweichung-% = (Ist − Soll)/|Soll| (mit Vorzeichen). Bezugsgröße 0 → „—".
- **Defaults**: erste Planversion + aktueller Monat.

### Scope-Hinweise
- Kein Liniendiagramm / keine Absatztabelle / kein „Ohne Investitionen"-Filter (Non-Goals dieser Iteration).

### Build & Tests
- `npx tsc --noEmit` ✅ — keine Typfehler in PROJ-102-Dateien (vorhandene Fehler liegen ausschließlich in unveränderten `*.test.ts`-Dateien).
- `npx next build` ✅ — Route `/dashboard/reporting/plan-ist-vergleich` erfolgreich gebaut.

### Fix 2026-06-28: Robustheit gegen Dev-Worker-Crash (EPIPE) + leere Defaults
- **Defaults entfernt** (Nutzerwunsch): Planversion und Monat sind beim Öffnen leer; Leerzustand „Bitte Planversion und Monat auswählen".
- **Dev-Worker-Problem:** Die Seite lädt zwei schwere `force-dynamic`-Routen (Soll = langfristige Rentabilitätsauswertung, Ist = Reporting-Rentabilität). Auf dieser Maschine sind diese tiefen dynamischen Routen unter `next.config.ts` → `experimental.cpus:1` anfällig für den dokumentierten EPIPE-Worker-Crash („Jest worker … exceeding retry limit"), v. a. nach vielen Tabs/Reloads (siehe `scripts/dev-epipe-guard.cjs`). Reines Dev-Phänomen — `next build` ist davon nicht betroffen.
- **Mitigation im Hook (`use-plan-ist-vergleich.ts`):** schwere Requests werden (a) **dedupliziert** (StrictMode feuert Effekte im Dev doppelt), (b) **serialisiert** (globale Promise-Kette → nie zwei dynamische Routen gleichzeitig) und (c) bei transienten 5xx **automatisch wiederholt** (Backoff; der Worker respawnt). Fehler-Surfacing verbessert (echte Servermeldung statt „load failed").
- **Hinweis:** Bei einem bereits abgestürzten Worker-Pool hilft nur ein Dev-Server-Neustart; danach laufen die (jetzt serialisierten/retryenden) Aufrufe stabil.

### Fix 2026-06-28: Produktkosten-Abweichung Ist ↔ Rentabilitätsreport (PostgREST-1000-Cap)
- **Symptom:** Ist-Produktkosten auf Plan-Ist (−6.743,08 € Juni) ≠ Rentabilitätsreport (−5.922,28 €), obwohl beide dieselbe Route `/api/reporting/rentabilitaet` nutzen. Alle anderen Zeilen identisch.
- **Ursache:** In `src/app/api/reporting/rentabilitaet/route.ts` war die `bestand_transaktionen`-Abfrage **nicht paginiert**. Über 12 Monate fielen **1016** Zeilen an → PostgREST cappt still bei 1000 → ~16 Zeilen (inkl. einiger Juni-Sendungen) wurden verworfen → die **Bestands-COGS (Produktkosten/Wertverlust/manuelle Sendungen) des Reports waren zu niedrig**. Die Plan-Ist-Seite lädt nur **einen** Monat (107 Zeilen, unter dem Cap) und war damit **korrekt/vollständig**.
- **Fix:** `bestand_transaktionen`-Abfrage in der Report-Route paginiert (gleiches `.range()`-Schleifenmuster wie `ausgaben_kosten_transaktionen`, inkl. `.order('id')`). Damit zeigt der Rentabilitätsreport jetzt den vollständigen Wert (−6.743,08 €) — **identisch** zur Plan-Ist-Seite. Betrifft auch die Wertverlust-/Manuelle-Sendungen-Zeilen über lange Zeiträume.
- **Hinweis:** Die anderen un-paginierten Abfragen der Route sind im aktuellen Datenbestand unkritisch (Umsatz 12 Mon = 533, Produktkosten-Zeiträume = 6, Abschreibungen = 4). Sibling-Reports (`deckungsbeitrag`, `break-even`) verwenden ggf. dasselbe Muster — separat prüfen.

### Fix 2026-06-28: Sales-Plattform-Ebene aus dem Drill-Down entfernen (Nutzerwunsch)
- Der Drill-Down bleibt hierarchisch wie in den Reports (**Kategorie → Gruppe → Untergruppe → Produkt**) — Untergruppen werden weiterhin angezeigt. **Nur die Sales-Plattform-Ebene** wird **nicht** mehr als eigene Zeile dargestellt: die Produkte einer Plattform werden direkt auf die Elternebene (i. d. R. Untergruppe) **hochgezogen** und je Produktname aggregiert (`istNodeToRawChildren`). Die Soll-Seite (langfristige Planung) hat ohnehin keine Plattform-Ebene und bleibt unverändert (`sollNodeToRaw`). Zusammenführung weiterhin per Namensgleichheit.

## QA Test Results
_To be added by /qa_

## Deployment

**Deployed:** 2026-06-28 — via Push auf `main` (Vercel Auto-Deploy, Projekt `controlling-app`).

Enthält außerdem einen projektweiten Pagination-Fix (PostgREST-1000-Cap): das DB-„Max Rows"-Limit wurde auf 50.000 angehoben, und folgende Routen wurden auf `fetchAllRows` umgestellt: `reporting/rentabilitaet` (bestand_transaktionen), `rentabilitaet`, `liquiditaet`, `reporting/absatz`, `abschreibungen`, `investitionen-abschreibungen`, `vermoegenswerte/vorschlaege`.
