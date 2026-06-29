# PROJ-60: Bestellplanung — Kurzfristige Planung

## Status: In Progress
**Created:** 2026-06-05
**Last Updated:** 2026-06-05

## Implementation Notes (Backend)
- **DB Migration applied**: 4 tables — `bestellungen`, `bestellungen_produkte`, `bestellungen_sku_mengen`, `bestellungen_konsolidierungen` — all with RLS enabled
- **Algorithm**: `src/lib/planbestelllauf-algorithmus.ts` — pure TypeScript, no DB access; KW-arithmetic, Meldebestand, MOQ, container optimization, consolidation check
- **API Routes**:
  - `GET/POST /api/bestellplanung/bestellungen?status=` — list and create bestellungen
  - `GET/PUT/DELETE /api/bestellplanung/bestellungen/[id]` — single bestellung CRUD
  - `POST /api/bestellplanung/planbestelllauf` — runs algorithm, collects all required data from 10+ DB tables
  - `POST /api/bestellplanung/planbestelllauf/anwenden` — applies accepted changes + creates new plan bestellungen
- **Tests**: 20 unit tests passing for bestellungen routes

## Enhancement (2026-06-29): Bestellmenge & Bestellkosten bei laufenden Bestellungen editierbar
- Bisher waren `menge_praktisch` (SKU-Mengen) und Bestellkosten nur bei Planbestellungen (`status = 'plan'`) bearbeitbar, bei laufenden Bestellungen read-only.
- Neuer Flag `mengenKostenEditierbar = status === 'plan' || status === 'laufend'` in `src/components/bestellung-detail-dialog.tsx` schaltet jetzt:
  - die SKU-Mengen-Inputs (Praktisch + Konsolidierung) frei,
  - die `<BestellkostenTabelle>` editierbar (`readOnly={!mengenKostenEditierbar}`).
- Der Footer-Button bei laufenden Bestellungen ("Ist-Daten speichern" → "Speichern") persistiert jetzt zusätzlich die geänderten `sku_mengen` (vorher nur `draft`/IST-Daten). Aktiviert, sobald IST-Daten **oder** Mengen geändert wurden (`mengenDirty`).
- Backend: Status-Gate in den Kosten-Routen von `!== 'plan'` auf `!== 'plan' && !== 'laufend'` gelockert:
  - `POST /api/bestellplanung/bestellungen/[id]/kosten`
  - `PUT/DELETE .../kosten/[kostenId]` (PUT; DELETE hatte nie ein Status-Gate)
- Mengen-Persistenz via `PUT .../bestellungen/[id]` benötigte keine Änderung — die Route akzeptierte `sku_mengen` bereits statusunabhängig.
- Abgeschlossene Bestellungen bleiben vollständig read-only.

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Produkte (`level = 1`) und SKUs (`level = 2`)
- Requires: PROJ-17 (Bestandsveränderungen-Verwaltung) — aktueller Lagerbestand je SKU (kumulierter Saldo aller Transaktionen)
- Requires: PROJ-41 (Bereichswechsler) — URL-Rahmen „Kurzfristige Planung"
- Requires: PROJ-42 (Absatzeinstellungen) — Berechnungsmethode für den durchschnittlichen wöchentlichen Absatz (Grundlage für den Sicherheitsbestand)
- Requires: PROJ-50 (Grundeinstellungen) — Planungshorizont in Wochen
- Requires: PROJ-51 (Absatzplanung) — geplante wöchentliche Absatzzahlen je Produkt (summiert über alle Plattformen)
- Requires: PROJ-59 (Produktinformationen) — Gesamtlieferzeit, MOQ, Containerkapazitäten, Sicherheitsbestandlänge (Wochen), Zielreichweite (Monate), Hersteller-Zuordnung

---

## Übersicht

Die Seite „Bestellplanung" ermöglicht die systematische Planung und Verwaltung aller Produktbestellungen. Sie gliedert sich in drei Bereiche:

1. **Planbestellungen** — algorithmisch ermittelte oder manuell angelegte Bestellvorschläge
2. **Laufende Bestellungen** — bestätigte, aktive Bestellungen mit automatischer Statusverfolgung
3. **Abgeschlossene Bestellungen** — archivierte, fertiggestellte Bestellungen

Der Kernmechanismus ist der **Planbestelllauf-Algorithmus**, der auf Knopfdruck für alle Produkte im gesamten Planungshorizont automatisch ermittelt:
- Wann muss die nächste (und jede weitere) Bestellung aufgegeben werden
- Wie viel soll je SKU bestellt werden (theoretisch und praktisch)
- Ob Bestellungen verschiedener Produkte beim gleichen Hersteller konsolidiert werden können

---

## User Stories

### Seite & Navigation
- Als Nutzer möchte ich die Seite „Bestellplanung" über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite eine Kachel „Bestellplanung" sehen.
- Als Nutzer möchte ich zwischen den drei Bereichen (Planbestellungen, Laufende, Abgeschlossene) per Tab wechseln können.

### Planbestelllauf
- Als Nutzer möchte ich auf Knopfdruck einen Planbestelllauf starten, damit der Algorithmus alle Bestellzeitpunkte und -mengen für den gesamten Planungshorizont ermittelt.
- Als Nutzer möchte ich während des Algorithmuslaufs einen Ladescreen sehen.
- Als Nutzer möchte ich nach dem Lauf zuerst empfohlene Änderungen an bestehenden Planbestellungen sehen und diese einzeln akzeptieren oder ablehnen können.
- Als Nutzer möchte ich dann alle neu ermittelten Planbestellungen sehen, Details einsehen und manuell anpassen können, bevor ich auswähle welche davon angelegt werden.

### Planbestellungen verwalten
- Als Nutzer möchte ich alle Planbestellungen in einer Übersichtstabelle sehen.
- Als Nutzer möchte ich eine Planbestellung anklicken und alle Details (Datumsfelder, theoretische/praktische Mengen je SKU, Begründungen) einsehen und bearbeiten.
- Als Nutzer möchte ich eine Planbestellung in eine Laufende Bestellung umwandeln können.
- Als Nutzer möchte ich Planbestellungen löschen können.

### Laufende Bestellungen
- Als Nutzer möchte ich alle laufenden Bestellungen mit ihrem aktuellen Status (datumbasiert) in einer Übersicht sehen.
- Als Nutzer möchte ich eine laufende Bestellung anklicken und alle Details (read-only) einsehen.
- Als Nutzer möchte ich eine Laufende Bestellung als abgeschlossen markieren, damit sie in den Bereich „Abgeschlossene Bestellungen" wandert.
- Als Nutzer möchte ich Laufende Bestellungen löschen können.

### Abgeschlossene Bestellungen
- Als Nutzer möchte ich alle abgeschlossenen Bestellungen in einer Übersicht einsehen.
- Als Nutzer möchte ich eine Abgeschlossene Bestellung anklicken und alle Details (read-only) einsehen.
- Als Nutzer möchte ich Abgeschlossene Bestellungen löschen können.

---

## Algorithmus-Spezifikation: Planbestelllauf

### Eingabedaten

| Datenquelle | Felder | Verwendung |
|---|---|---|
| `absatzplanung` (PROJ-51) | Absatz je Produkt × KW (Summe über alle Plattformen) | Geplante wöchentliche Abgänge |
| `bestandsveraenderungen` (PROJ-17) | Kumulierter Saldo je SKU | Aktueller Lagerbestand |
| `produktinformationen_lieferzeit` | Produktionszeit + Zwischenzeit + Shipping-Zeit + Entladungszeit | Gesamtlieferzeit in Tagen |
| `produktinformationen_bestandsverwaltung` | `sicherheitsbestand` (Wochen), `zielreichweite_monate` | Safety-Stock-Dauer, Zielreichweite |
| `produktinformationen_moq` / `_moq_sku` | MOQ je Produkt oder SKU | Mindestbestellmenge |
| `produktinformationen_container_global` + `_containerkapazitaet` | Containervolumina + Paketmaße → berechnete Max.-Kapazitäten | Container-Optimierung |
| `produktinformationen_hersteller_zuordnung` | Hersteller je Produkt | Konsolidierungsprüfung |
| `absatz_einstellungen` (PROJ-42) | Berechnungsart je Plattform × Produkt | Methode für avg. Wochenabsatz |
| Bestehende `bestellungen` (Status = `plan` oder `laufend`) | Ankunftsdatum, SKU-Mengen | Bereits eingeplante Zugänge |

---

### Schritt 1: Meldebestand je Produkt berechnen

```
Meldebestand(Produkt) = Absatz_über_Lieferzeit + Sicherheitsbestand
```

**Absatz über Lieferzeit:**
- Gesamtlieferzeit in Wochen = ceil(Gesamtlieferzeit_in_Tagen ÷ 7)
- Summe der geplanten Absatzzahlen (aus der Absatzplanung) über diese Anzahl an Wochen ab heute

**Sicherheitsbestand:**
```
Sicherheitsbestand = avg_wöchentlicher_absatz × sicherheitsbestand_wochen
```
- `avg_wöchentlicher_absatz`: historischer Durchschnitt basierend auf der in den Absatzeinstellungen hinterlegten Berechnungsmethode (gleiche Logik wie bei der Absatzplanung-Vorbelegung), als Tagesdurchschnitt berechnet × 7
- `sicherheitsbestand_wochen`: Feld `sicherheitsbestand` aus `produktinformationen_bestandsverwaltung` (Einheit: Wochen)

**Beispiel:**
- Gesamtlieferzeit: 70 Tage = 10 Wochen
- Geplanter Absatz nächste 10 Wochen: 25 Stück/Woche → Summe = 250 Stück
- avg. Wochenabsatz historisch: 20 Stück
- Sicherheitsbestandlänge: 3 Wochen → Sicherheitsbestand = 60 Stück
- **Meldebestand = 310 Stück**

---

### Schritt 2: Bestellzeitpunkt ermitteln (Wochensimulation)

Für jede SKU des Produktes:
1. Start: aktueller Lagerbestand der SKU (kumulierter Saldo aus `bestandsveraenderungen`)
2. Woche für Woche vorwärts simulieren:
   - `Bestand_nächste_Woche = Bestand_diese_Woche − geplanter_Absatz_dieser_Woche`
   - Geplante Anlieferungen aus bestehenden Plan- und Laufenden Bestellungen zum Ankunftsdatum addieren
3. Sobald `Bestand ≤ Meldebestand(Produkt)`: diese Woche = Bestellzeitpunkt der SKU

**Bestellzeitpunkt des Produktes = frühester Bestellzeitpunkt aller SKUs des Produktes.**
Alle anderen SKUs des Produktes erhalten denselben Bestellzeitpunkt.

**Fehlende Absatzplanung:**
Reicht die Absatzplanung nicht weit genug in die Zukunft, werden die Absatzzahlen der letzten verfügbaren Woche fortgeschrieben.

---

### Schritt 3: Theoretische Bestellmenge je SKU

1. **Voraussichtliches Ankunftsdatum** = Bestellzeitpunkt + Gesamtlieferzeit (in Wochen)
2. **Zielreichweite in Wochen** = `zielreichweite_monate × 4.333`
3. **Geplanter Absatz in Zielreichweite** = Summe der Absatzplanung von Ankunfts-KW bis Ankunfts-KW + Zielreichweite
4. **Voraussichtlicher Restbestand bei Ankunft** = simulierter Bestand am Ankunftsdatum (nach Abzug aller geplanten Verkäufe bis dahin, inklusive Zugänge aus anderen Bestellungen)
5. **Theoretische Gesamtmenge(Produkt)** = max(0, Geplanter Absatz − Restbestand)

**Aufteilung auf SKUs:**
Da die Absatzplanung auf Produktebene läuft (keine SKU-Aufschlüsselung), wird die theoretische Gesamtmenge proportional zum aktuellen Bestandsanteil der SKU an der Produktgesamtmenge aufgeteilt. Wenn kein Bestand vorhanden ist, werden alle SKUs gleichgewichtet.

**Beispiel:**
- Bestellzeitpunkt KW4, Lieferzeit 12 Wochen → Ankunft KW16
- Zielreichweite 12 Wochen → Absatz KW16 bis KW28 summieren = 300 Stück
- Voraussichtlicher Restbestand in KW16: 50 Stück
- **Theoretische Gesamtmenge = 250 Stück**

---

### Schritt 4: Praktische Bestellmenge (MOQ + Containeroptimierung)

#### 4a. MOQ-Prüfung

Für jede SKU:
- Wenn `theoretische_menge < MOQ_dieser_SKU`: Menge wird auf MOQ aufgerundet
- SKU erhält Flag `moq_gerundet = true`
- MOQ aus `produktinformationen_moq` (Produkt- oder SKU-Ebene je nach Einstellung)

#### 4b. Containerkapazitäts-Optimierung

Gesamtmenge des Produktes = Summe aller SKU-Mengen nach MOQ-Anpassung.

Kapazitätsschwellen (aus Containerkapazitätsdaten):
- `max_20dc` = Containervolumen_20DC_in_cm³ ÷ Stückvolumen_in_cm³ (abgerundet)
- `max_40hq` = Containervolumen_40HQ_in_cm³ ÷ Stückvolumen_in_cm³ (abgerundet)
- `schwelle_abrunden` = `max_20dc × 1.3`
- `schwelle_mitte` = (`max_20dc` + `max_40hq`) ÷ 2

**Entscheidungsregeln:**

| Gesamtmenge | Aktion | Beispiel (20DC=1000, 40HQ=2200) |
|---|---|---|
| < `max_20dc` | Aufrunden auf `max_20dc` | < 1000 → 1000 |
| `max_20dc` ≤ Menge ≤ `schwelle_abrunden` | Abrunden auf `max_20dc` | 1000–1300 → 1000 |
| `schwelle_abrunden` < Menge < `schwelle_mitte` | Menge × 1,2 | 1300–1600 → × 1,2 |
| Menge ≥ `schwelle_mitte` | Aufrunden auf `max_40hq` | ≥ 1600 → 2200 |

**Aufrundungslogik bei Untergrenze (Gesamtmenge < max_20dc):**
1. Differenz = `max_20dc` − Gesamtmenge
2. SKUs mit Flag `moq_gerundet = true` werden NICHT weiter erhöht
3. Differenz wird proportional auf die verbleibenden SKUs (ohne MOQ-Flag) verteilt; Reihenfolge: SKU mit größter Menge zuerst
4. Falls alle SKUs MOQ-gerundet: alle SKUs gleichmäßig erhöhen bis `max_20dc` erreicht

#### 4c. Begründungstexte generieren

Je SKU wird ein Begründungstext erzeugt, der beschreibt, warum praktische Menge ≠ theoretische Menge:
- z.B. „MOQ-Anpassung: +150 Stück (MOQ = 200)"
- z.B. „Container-Optimierung: auf 20DC-Kapazität aufgerundet (+73 Stück)"
- z.B. „Container-Optimierung: ×1,2 Buffer → 780 Stück"

---

### Schritt 5: Konsolidierung prüfen

Für je zwei Produkte im gleichen Algorithmuslauf:
1. **Gleicher Hersteller** (aus `produktinformationen_hersteller_zuordnung`)
2. **Bestellzeitpunkte ≤ 30 Tage auseinander**
3. **Kombiniertes Volumen** = Σ(SKU-Menge × Stückvolumen je cm³) beider Produkte
4. Containerentscheidung für kombinierte Menge analog Schritt 4b, jedoch bezogen auf das Gesamtvolumen
5. Mengenaufteilung zwischen den Produkten: proportional zur theoretischen Einzelbestellmenge

**Ausgabe:** Konsolidierungsempfehlung mit Containerart und empfohlenen Mengen je Produkt, oder „Keine Konsolidierung sinnvoll" mit Begründung.

---

### Schritt 6: Wiederholung für den gesamten Planungshorizont

Nachdem für ein Produkt die erste Bestellung ermittelt wurde:
1. Simulation erneut starten: diesmal mit der Ankunftsmenge der ersten Bestellung als zukünftigen Zugang
2. Nächsten Bestellzeitpunkt simulieren, Menge berechnen, Konsolidierung prüfen
3. Wiederholen bis kein weiterer Bestellzeitpunkt innerhalb des Planungshorizonts liegt
4. **Planungshorizont** = `grundeinstellungen.planungshorizont_wochen` (Fallback: 13 Wochen)

---

### Schritt 7: Re-Run-Verhalten bei bestehenden Bestellungen

**Bestehende Planbestellungen:**
- Als zukünftige Zugänge in der Simulation berücksichtigt
- Für jede bestehende Planbestellung geprüft: Hat sich das optimale Bestelldatum oder die empfohlene Menge geändert?
- Wenn ja: Änderungsempfehlung im Dialog (Schritt 1 des Wizards)
- Nutzer entscheidet je Empfehlung: akzeptieren oder ablehnen

**Laufende Bestellungen:**
- Als fixe, unveränderliche Zugänge in der Simulation berücksichtigt (Ankunftsdatum + Mengen)
- Werden nicht als zu ändernde Positionen vorgeschlagen

---

## Planbestelllauf-Wizard (Dialog)

### Schritt 0: Algorithmus läuft
- Dialog öffnet sich beim Klick auf „Planbestelllauf durchführen"
- Ladeindikator / Spinner mit Text „Planbestelllauf wird durchgeführt…"
- Kein Abbrechen möglich während der Lauf läuft

### Schritt 1: Empfohlene Änderungen (nur wenn bestehende Planbestellungen vorhanden)
- Überschrift: „Empfohlene Änderungen an bestehenden Planbestellungen"
- Liste aller empfohlenen Änderungen mit:
  - Betroffene Bestellung (Produkt, aktuelles Bestelldatum)
  - Art der Änderung: Bestelldatum, Menge, Konsolidierung
  - Aktueller Wert → Empfohlener Wert
  - Begründung (z.B. „Absatzplanung hat sich geändert")
  - Checkbox: „Akzeptieren" (Standard: angehakt)
- Button „Weiter" → Schritt 2

### Schritt 2: Neue Planbestellungen
- Überschrift: „Neue Planbestellungen"
- Liste aller neu ermittelten Bestellungen, je Eintrag:
  - **Kopfzeile:** Produkt(e), Bestelldatum, Produktionsende, Shippingdatum, Verfügbarkeitsdatum, Gesamtmenge (Stück)
  - **Aufklappbarer Detailbereich:**
    - Alle 6 Datumsfelder editierbar: Bestelldatum, Produktionsstart, Produktionsende, Shippingdatum, Ankunftsdatum, Verfügbarkeitsdatum
    - Tabelle SKU-Mengen: SKU-Name | Theoretische Menge (read-only) | Praktische Menge (editierbar, vorbelegt) | Begründungstext (read-only)
    - Konsolidierungen: Bestehende Konsolidierungsvorschläge anzeigen; Nutzer kann Konsolidierungen mit anderen neuen oder bestehenden Planbestellungen manuell hinzufügen/entfernen
  - Checkbox: „Anlegen" (Standard: angehakt)
- Button „Ausgewählte Planbestellungen anlegen" → schließt Dialog, legt gewählte Bestellungen an und übernimmt akzeptierte Änderungen an bestehenden

---

## Acceptance Criteria

### Navigation & Seite

- [ ] Linke Navigation enthält Eintrag „Bestellplanung" → `/dashboard/kurzfristige-planung/bestellplanung`
- [ ] Kachel „Bestellplanung" auf `/dashboard/kurzfristige-planung`
- [ ] Auth-Guard: nicht eingeloggte Nutzer werden zu `/login` weitergeleitet
- [ ] Seite zeigt 3 Tabs: „Planbestellungen", „Laufende Bestellungen", „Abgeschlossene Bestellungen"
- [ ] Beim ersten Laden ist Tab „Planbestellungen" aktiv

### Tab: Planbestellungen

- [ ] Button „Planbestelllauf durchführen" sichtbar
- [ ] Tabelle der vorhandenen Planbestellungen mit Spalten: Produkt(e), Bestelldatum, Ankunftsdatum, Gesamtmenge (Stück), Konsolidiert mit (falls zutreffend)
- [ ] Leerer Zustand wenn noch keine Planbestellungen vorhanden: Hinweistext „Noch keine Planbestellungen vorhanden. Führe einen Planbestelllauf durch."
- [ ] Klick auf eine Zeile öffnet Detail-Dialog mit allen Feldern
- [ ] Im Detail-Dialog sind alle Datumsfelder editierbar und alle praktischen Mengen je SKU editierbar
- [ ] Speichern im Detail-Dialog aktualisiert den Datensatz (inkl. Toast-Bestätigung)
- [ ] Button „In Laufende Bestellung umwandeln" im Detail-Dialog: Status ändert sich auf `laufend`, Bestellung wandert in Tab „Laufende Bestellungen"
- [ ] Button „Löschen" mit Bestätigungs-Prompt (shadcn `AlertDialog`)

### Tab: Laufende Bestellungen

- [ ] Tabelle mit Spalten: Produkt(e), Bestelldatum, Aktueller Status, Ankunftsdatum, Gesamtmenge
- [ ] Aktueller Status wird datumbasiert automatisch gesetzt:
  - „Bestellt" — vor Produktionsstart
  - „In Produktion" — zwischen Produktionsstart und Produktionsende
  - „Bereit zum Versand" — zwischen Produktionsende und Shippingdatum
  - „Unterwegs" — zwischen Shippingdatum und Ankunftsdatum
  - „In Einlagerung" — zwischen Ankunftsdatum und Verfügbarkeitsdatum
  - „Verfügbar" — ab Verfügbarkeitsdatum
- [ ] Klick auf Zeile öffnet Detail-Dialog (read-only — keine Bearbeitung möglich)
- [ ] Button „Als abgeschlossen markieren" im Detail-Dialog: Status → `abgeschlossen`, Abschluss-Datum = heute, Bestellung wandert in Tab „Abgeschlossene Bestellungen"
- [ ] Button „Löschen" mit Bestätigungs-Prompt

### Tab: Abgeschlossene Bestellungen

- [ ] Tabelle mit Spalten: Produkt(e), Bestelldatum, Ankunftsdatum, Abgeschlossen am, Gesamtmenge
- [ ] Klick auf Zeile öffnet Detail-Dialog (read-only)
- [ ] Button „Löschen" mit Bestätigungs-Prompt

### Planbestelllauf-Dialog

- [ ] Klick auf „Planbestelllauf durchführen" öffnet Modal-Dialog
- [ ] Ladescreen mit Spinner erscheint, solange Algorithmus läuft
- [ ] Schritt 1 erscheint nur, wenn bestehende Planbestellungen vorhanden sind
- [ ] Schritt 1: Je Änderungsempfehlung sind aktueller Wert, empfohlener Wert und Begründung sichtbar
- [ ] Schritt 1: Jede Änderungsempfehlung hat eine Checkbox (Standard: akzeptiert)
- [ ] Schritt 2: Jede neue Planbestellung zeigt in der Kopfzeile: Produkt(e), Bestelldatum, Produktionsende, Shippingdatum, Verfügbarkeitsdatum, Gesamtmenge
- [ ] Schritt 2: Aufgeklappter Detailbereich zeigt alle 6 Datumsfelder (editierbar), SKU-Mengen-Tabelle mit theoretischen (read-only) und praktischen Mengen (editierbar) sowie Begründungstexten
- [ ] Schritt 2: Konsolidierungsvorschläge sind sichtbar; Nutzer kann sie manuell ändern
- [ ] Schritt 2: Jede neue Bestellung hat eine Checkbox (Standard: angehakt)
- [ ] Klick auf „Ausgewählte Planbestellungen anlegen": legt die markierten Bestellungen an, übernimmt akzeptierte Änderungen, schließt Dialog

### Algorithmus-Korrektheit

- [ ] Meldebestand-Berechnung: Absatz über Lieferzeit + avg_Wochenabsatz × Sicherheitsbestandlänge_Wochen
- [ ] Bestellzeitpunkt = früheste simulierte Woche, in der Bestand ≤ Meldebestand (über alle SKUs)
- [ ] Alle SKUs eines Produktes erhalten denselben Bestellzeitpunkt (nach dem frühesten)
- [ ] Theoretische Menge = Absatz in Zielreichweite − Restbestand bei Ankunft; Minimum 0
- [ ] Wenn theoretische Menge = 0 oder negativ: Bestellmenge = MOQ
- [ ] MOQ-Anpassung: nur hochrunden wenn Menge < MOQ; SKU erhält `moq_gerundet`-Markierung
- [ ] Container-Schwellen korrekt: max_20dc × 1.3 = Abrundungsgrenze; (max_20dc + max_40hq) ÷ 2 = Mittelpunkt
- [ ] SKUs mit `moq_gerundet` werden bei Container-Hochrundung nicht weiter erhöht
- [ ] Konsolidierung nur bei gleichem Hersteller UND Bestellzeitpunkte ≤ 30 Tage auseinander
- [ ] Fehlende Absatzplanung am Horizontende: letzter bekannter Wochenwert wird fortgeschrieben
- [ ] Laufende Bestellungen werden als fixe Zugänge in der Simulation eingerechnet
- [ ] Mehrere Bestellungen pro Produkt im Planungshorizont: nach erster Bestellung erneut simulieren

---

## Datenbankschema

### Tabelle `bestellungen`
- `id` UUID PK
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- `status` TEXT NOT NULL CHECK (`status` IN ('plan', 'laufend', 'abgeschlossen'))
- `bestelldatum` DATE
- `produktionsstart_datum` DATE
- `produktionsende_datum` DATE
- `shippingdatum` DATE
- `ankunftsdatum` DATE
- `verfuegbarkeitsdatum` DATE
- `abgeschlossen_am` DATE
- `notizen` TEXT
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()
- RLS: Nutzer sieht und schreibt nur eigene Einträge

### Tabelle `bestellungen_produkte`
- `id` UUID PK
- `bestellung_id` UUID NOT NULL FK → `bestellungen` (ON DELETE CASCADE)
- `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE RESTRICT)
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`bestellung_id`, `produkt_id`)
- RLS: analog

### Tabelle `bestellungen_sku_mengen`
- `id` UUID PK
- `bestellung_id` UUID NOT NULL FK → `bestellungen` (ON DELETE CASCADE)
- `sku_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE RESTRICT)
- `menge_theoretisch` INTEGER — NULL bei manuell angelegten Bestellungen
- `menge_praktisch` INTEGER NOT NULL CHECK (`menge_praktisch` >= 0)
- `begruendung_anpassung` TEXT — Freitext-Begründung warum Praxis ≠ Theorie
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`bestellung_id`, `sku_id`)
- RLS: analog

### Tabelle `bestellungen_konsolidierungen`
- `id` UUID PK
- `bestellung_id_1` UUID NOT NULL FK → `bestellungen` (ON DELETE CASCADE)
- `bestellung_id_2` UUID NOT NULL FK → `bestellungen` (ON DELETE CASCADE)
- `containerart` TEXT CHECK (`containerart` IN ('20DC', '40DC', '40HQ'))
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- CHECK (`bestellung_id_1` < `bestellung_id_2`)
- UNIQUE(`bestellung_id_1`, `bestellung_id_2`)
- RLS: analog

---

## API-Routen

### Planbestelllauf
- `POST /api/bestellplanung/planbestelllauf` — Algorithmus ausführen (serverseitig); Response: `{ aenderungen_bestehende: [...], neue_planbestellungen: [...] }`
- `POST /api/bestellplanung/planbestelllauf/anwenden` — Ausgewählte Ergebnisse des Laufs anwenden; Body: `{ akzeptierte_aenderungen: [...], neue_bestellungen: [...] }`

### Bestellungen CRUD
- `GET /api/bestellplanung/bestellungen?status=plan|laufend|abgeschlossen` — Bestellungen mit SKU-Mengen und Konsolidierungen laden
- `POST /api/bestellplanung/bestellungen` — Neue Bestellung manuell anlegen
- `GET /api/bestellplanung/bestellungen/[id]` — Einzelne Bestellung mit allen Details
- `PUT /api/bestellplanung/bestellungen/[id]` — Bestellung aktualisieren (Datumsfelder, Status, Mengen)
- `DELETE /api/bestellplanung/bestellungen/[id]` — Bestellung löschen (inkl. SKU-Mengen und Konsolidierungen per CASCADE)

---

## Edge Cases

- **Keine Absatzplanung vorhanden**: Algorithmus gibt leere Ergebnisliste zurück mit Hinweis „Keine Absatzdaten gefunden. Bitte zuerst die Absatzplanung befüllen."
- **Kein Lagerbestand in PROJ-17**: Bestand wird als 0 angenommen; Bestellzeitpunkt = sofort (aktuelle KW)
- **Keine Produktinformationen gepflegt** (fehlende Lieferzeit, MOQ, Containerkapazität): Betroffenes Produkt wird im Ergebnis mit Warnung „Unvollständige Stammdaten — manuelle Prüfung erforderlich" markiert; der Algorithmus läuft für die anderen Produkte weiter
- **Theoretische Menge ≤ 0** (Restbestand deckt gesamte Zielreichweite): Bestellmenge = MOQ (Mindestbestellung)
- **Bestellzeitpunkt liegt in der Vergangenheit** (Bestand bereits unter Meldebestand): Bestelldatum = heute; Hinweis „Bestellzeitpunkt bereits überschritten — sofort bestellen"
- **Absatzplanung nicht weit genug** für Zielreichweite nach Ankunft: letzter bekannter Wochenwert wird fortgeschrieben
- **Drei oder mehr Produkte beim gleichen Hersteller**: paarweise Konsolidierungsprüfung; System empfiehlt die Kombination mit dem günstigsten Container-Füllgrad
- **Konsolidierung zweier Produkte passt in keinen Container**: Empfehlung „Einzellieferung sinnvoller — keine Konsolidierung"
- **Manuelle Änderung einer Planbestellung + erneuter Lauf**: manuell geänderte Felder werden als „manuell überschrieben" gekennzeichnet; Algorithmus kann trotzdem Anpassung empfehlen, weist aber auf den manuellen Override hin
- **Container-Daten fehlen** (Paketmaße nicht gepflegt): Container-Optimierung wird übersprungen; Bestellung auf MOQ-Basis; Warnung im Ergebnis

---

## Technical Requirements

- Authentifizierung: `requireAuth()` auf allen API-Routen
- RLS auf allen 4 neuen Tabellen
- Algorithmus läuft vollständig serverseitig (POST /api/bestellplanung/planbestelllauf)
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/bestellplanung/page.tsx`
- Navigation: Eintrag „Bestellplanung" in `nav-sheet.tsx` unter der Gruppe „Kurzfristige Planung"
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx`
- shadcn `Tabs` für die 3 Bereiche
- shadcn `Dialog` für den Planbestelllauf-Wizard und Bestellungs-Details
- shadcn `AlertDialog` für Lösch-Bestätigungen
- shadcn `Table` für alle Übersichten
- shadcn `Checkbox` für die Auswahlspalten im Wizard
- Laufzeit Algorithmus: bei bis zu 20 Produkten × 52 Wochen erwartet < 10 Sekunden

---

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung/bestellplanung  (NEUE Seite)
+-- Page-Header (NavSheet + Seitentitel + LogoutButton — wie alle anderen Seiten)
+-- BestellplanungTabelle  (NEUE Hauptkomponente)
    +-- Tabs [shadcn — 3 Tabs]
        |
        +-- Tab 1: „Planbestellungen"
        |   +-- Button „Planbestelllauf durchführen"
        |   +-- Table [shadcn]
        |   |   +-- Spalten: Produkt(e), Bestelldatum, Ankunftsdatum,
        |   |                 Gesamtmenge, Konsolidiert mit, Aktionen
        |   +-- Leerer Zustand (wenn keine Planbestellungen)
        |
        +-- Tab 2: „Laufende Bestellungen"
        |   +-- Table [shadcn]
        |   |   +-- Spalten: Produkt(e), Bestelldatum, Status-Badge,
        |   |                 Ankunftsdatum, Gesamtmenge, Aktionen
        |   +-- Leerer Zustand
        |
        +-- Tab 3: „Abgeschlossene Bestellungen"
            +-- Table [shadcn]
            |   +-- Spalten: Produkt(e), Bestelldatum, Ankunftsdatum,
            |                 Abgeschlossen am, Gesamtmenge, Aktionen
            +-- Leerer Zustand

PlanbestelllaufWizard  (NEUE Komponente — Dialog [shadcn])
    +-- Schritt 0: Ladescreen
    |   +-- Spinner + Text „Planbestelllauf wird durchgeführt…"
    |
    +-- Schritt 1: Änderungsempfehlungen  (nur wenn Planbestellungen vorhanden)
    |   +-- Liste der Empfehlungen
    |       +-- Je Eintrag: Produkt | Änderungsart | Alt → Neu | Begründung | Checkbox
    |   +-- Button „Weiter"
    |
    +-- Schritt 2: Neue Planbestellungen
        +-- Je Bestellung: aufklappbares Panel [Collapsible — shadcn]
        |   +-- Kopfzeile: Checkbox | Produkt(e) | Bestelldatum | Produktionsende
        |   |               Shippingdatum | Verfügbarkeitsdatum | Gesamtmenge
        |   +-- Detailbereich (aufgeklappt):
        |       +-- 6 Datumsfelder [DatePicker = Calendar + Popover — shadcn]
        |       +-- SKU-Mengen-Tabelle [shadcn Table]
        |       |   +-- SKU | Theor. Menge (read-only) | Prakt. Menge (editierbar) | Begründung
        |       +-- Konsolidierungen: Anzeige + Dropdown zum Hinzufügen/Entfernen
        +-- Button „Ausgewählte Planbestellungen anlegen"

BestellungDetailDialog  (NEUE Komponente — Dialog [shadcn])
    +-- 6 Datumsfelder (editierbar bei Planbestellungen, read-only sonst)
    +-- SKU-Mengen-Tabelle (editierbar bei Planbestellungen, read-only sonst)
    +-- Konsolidierungsanzeige
    +-- Fußzeile mit kontextabhängigen Buttons:
        +-- Planbestellung: „Speichern" + „In Laufende Bestellung umwandeln" + „Löschen"
        +-- Laufende Bestellung: „Als abgeschlossen markieren" + „Löschen"
        +-- Abgeschlossene Bestellung: nur „Löschen"
    +-- AlertDialog [shadcn] für Lösch-Bestätigung
```

---

### Datenmodell

**4 neue Datenbanktabellen — alle mit RLS (Nutzer sieht und schreibt nur eigene Daten):**

| Tabelle | Zweck | Schlüssel |
|---|---|---|
| `bestellungen` | Kopfdaten: Status + 6 Datumsfelder + Notizen | `(id, user_id)` |
| `bestellungen_produkte` | Welche Produkte gehören zur Bestellung | `(bestellung_id, produkt_id, user_id)` UNIQUE |
| `bestellungen_sku_mengen` | Theor. + Prakt. Menge je SKU + Begründungstext | `(bestellung_id, sku_id, user_id)` UNIQUE |
| `bestellungen_konsolidierungen` | Verbindet zwei konsolidierte Bestellungen + Containerart | `(bestellung_id_1, bestellung_id_2)` UNIQUE |

**Berechneter Wert (nicht gespeichert):**
- Aktueller Lieferstatus bei Laufenden Bestellungen: clientseitig aus den Datumsfeldern + `Date.now()` berechnet

---

### Datenfluss

```
Seite öffnet sich
  → Tab „Planbestellungen" aktiv
  → useBestellungen('plan') → GET /api/bestellplanung/bestellungen?status=plan
  → Andere Tabs: lazy laden (nur beim ersten Aktivieren)

Nutzer klickt „Planbestelllauf durchführen"
  → PlanbestelllaufWizard öffnet sich
  → Ladescreen erscheint
  → usePlanbestelllauf() → POST /api/bestellplanung/planbestelllauf
  → Server liest 9 Datenquellen, ruft reine Berechnungsfunktion auf
  → Response: { aenderungen_bestehende, neue_planbestellungen }
  → Wizard zeigt Schritt 1 (wenn Planbestellungen vorhanden) oder direkt Schritt 2
  → Nutzer trifft Auswahl und passt Mengen/Daten an
  → Klick „Anlegen" → POST /api/bestellplanung/planbestelllauf/anwenden
  → Server schreibt in DB
  → Wizard schließt, Tab-Daten werden neu geladen

Nutzer klickt auf Tabellenzeile
  → BestellungDetailDialog öffnet sich (Daten aus lokalem State)
  → Planbestellung editierbar: optimistisches Update + PUT /api/bestellplanung/bestellungen/[id]
  → Statuswechsel: PUT mit neuem Status, Eintrag wechselt Tab

Nutzer löscht Bestellung
  → AlertDialog erscheint → DELETE /api/bestellplanung/bestellungen/[id]
  → Optimistisches Entfernen aus lokalem State
```

---

### Server-Architektur: Algorithmus

Aufgeteilt in zwei Dateien:

**`src/lib/planbestelllauf-algorithmus.ts`** — Reine Berechnungslogik
- Alle Stammdaten als Parameter (keine DB-Aufrufe)
- Führt alle 7 Algorithmus-Schritte durch
- Gibt `{ aenderungen_bestehende, neue_planbestellungen }` zurück
- Keine Seiteneffekte → einfach unit-testbar

**`src/app/api/bestellplanung/planbestelllauf/route.ts`** — API-Route
- Liest alle benötigten Daten aus der DB (9 Quellen)
- Ruft die reine Berechnungsfunktion auf
- Gibt Ergebnis zurück — schreibt NICHT in die DB

---

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/kurzfristige-planung/bestellplanung/page.tsx` | Neue Seite |
| `src/components/bestellplanung-tabelle.tsx` | Hauptkomponente: 3 Tabs + Tabellen |
| `src/components/planbestelllauf-wizard.tsx` | Mehrstufiger Wizard-Dialog |
| `src/components/bestellung-detail-dialog.tsx` | Detail-/Bearbeitungs-Dialog (alle 3 Status) |
| `src/hooks/use-bestellungen.ts` | State: Bestellungen laden + CRUD je Status-Tab |
| `src/hooks/use-planbestelllauf.ts` | State: Algorithmus starten, Ergebnisse halten, Anwenden |
| `src/lib/planbestelllauf-algorithmus.ts` | Reine Algorithmus-Berechnungslogik (kein DB-Zugriff) |
| `src/app/api/bestellplanung/planbestelllauf/route.ts` | POST: Algorithmus ausführen |
| `src/app/api/bestellplanung/planbestelllauf/anwenden/route.ts` | POST: Ergebnisse anwenden |
| `src/app/api/bestellplanung/bestellungen/route.ts` | GET + POST |
| `src/app/api/bestellplanung/bestellungen/[id]/route.ts` | GET + PUT + DELETE |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/nav-sheet.tsx` | Eintrag „Bestellplanung" in der Navigationsgruppe „Kurzfristige Planung" |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Neue Kachel „Bestellplanung" |

---

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Algorithmus serverseitig | Ja | Greift auf 9 Datenquellen zu; Auth + DB-Logik bleibt server-side; Client bekommt nur Ergebnis |
| Algorithmus als reine Funktion getrennt | Ja | Saubere Trennung von DB-Logik und Berechnung; einfach unit-testbar ohne Mocking |
| Kein Hintergrund-Job-System | Bewusst | Bei bis zu 20 Produkten × 52 Wochen < 10 Sek.; kein Redis/Queue-Overhead nötig |
| DatePicker via Calendar + Popover | Ja | Beide shadcn-Komponenten bereits installiert; kein neues Package |
| Collapsible für Wizard-Bestellungen | Ja | Bereits installiert; gleiches Pattern wie `fulfillment-crowd-import-wizard.tsx` |
| BestellungDetailDialog — eine Komponente für alle 3 Status | Ja | Vermeidet Code-Duplizierung; read-only-Modus per Prop gesteuert |
| Optimistisches Update | Ja | Konsistent mit dem Pattern aller anderen Seiten im Projekt |
| Neue Packages | Keine | Alle benötigten shadcn-Komponenten vorhanden: Tabs, Dialog, AlertDialog, Table, Checkbox, Collapsible, Calendar, Popover, Badge, Progress |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_