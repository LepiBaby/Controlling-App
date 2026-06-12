# PROJ-63: Konsolidierung — Neubau (Kurzfristige Planung)

## Status: Architected
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-60 (Bestellplanung) — Basis-Seite, DB-Schema, Wizard, Algorithmus
- Requires: PROJ-62 (Erstplanbestellung) — Erstplanbestellung-Dialog wird bereinigt
- Requires: PROJ-59 (Produktinformationen) — Lieferzeit-Stammdaten für Datumskaskadierung; Container-Global und Containerkapazität je Produkt für Volumenberechnung; Hersteller-Zuordnung für Gruppen

---

## Übersicht

Die bisherige Konsolidierungslogik (automatische Erkennung im Algorithmus, Paar-Verknüpfungsmodell, optionale Angabe in der Erstplanbestellung) wird vollständig durch eine neue, manuelle Konsolidierungsfunktion ersetzt.

**Was sich ändert:**

| Bereich | Alt | Neu |
|---|---|---|
| Algorithmus | Erkennt Konsolidierungskandidaten automatisch (letzte Prüfung nach allen Produkten) | Keine Konsolidierungslogik — Algorithmus liefert ausschließlich Mengen und Daten |
| Wizard | 2 Schritte (Änderungen + Neue Bestellungen) | 3 Schritte (+Schritt 3: Konsolidierung) |
| Erstplanbestellung | Optionaler Konsolidierungsabschnitt | Komplett entfernt |
| DB-Modell | Paare (`bestellung_id_1`, `bestellung_id_2`) | Gruppen mit Snapshot und Container-Anteil je Mitglied |
| Auslösung | Automatisch nach Algorithmuslauf | Manuell: Nutzer wählt Bestellungen aus, klickt "Konsolidieren" |
| Rückgängig | Nicht möglich | Snapshot-basiertes Undo |

---

## User Stories

### Wizard Schritt 3: Konsolidierungsübersicht
- Als Nutzer möchte ich nach der Auswahl neuer Planbestellungen (Schritt 2) zu einem dritten Schritt "Konsolidierung" weitergehen, der mir alle Planbestellungen — bestehende aus der DB und neu ausgewählte aus Schritt 2 — in einer gemeinsamen Übersicht zeigt, damit ich Konsolidierungsmöglichkeiten beurteilen kann.
- Als Nutzer möchte ich die Planbestellungen je Hersteller gruppiert sehen, damit ich sofort erkenne, welche Produkte vom selben Hersteller kommen.
- Als Nutzer möchte ich innerhalb einer Herstellergruppe die Planbestellungen nach Prod.ende-Datum sortiert sehen, damit ich den Zeithorizont auf einen Blick überblicke.
- Als Nutzer möchte ich für jede Planbestellung die Containerauslastung angezeigt bekommen, damit ich sehe, ob Container-Kapazität ungenutzt bleibt.
- Als Nutzer möchte ich auf eine Planbestellung klicken, um die regulären Details zu öffnen (identisch mit dem Klick in der Haupttabelle).

### Konsolidierung durchführen
- Als Nutzer möchte ich mehrere Planbestellungen desselben Herstellers per Checkbox auswählen, damit ich anschließend "Konsolidieren" anklicken kann.
- Als Nutzer möchte ich, dass der Konsolidierungsalgorithmus die Restmengen (nicht in volle Container passende Anteile) aller ausgewählten Bestellungen volumetrisch zusammenfasst und auf einen gemeinsamen Container-Plan optimiert.
- Als Nutzer möchte ich, dass alle konsolidierten Bestellungen auf das Prod.ende-Datum der frühesten Bestellung angepasst werden, damit sie denselben Produktionsendtermin haben.
- Als Nutzer möchte ich die konsolidierten Bestellungen visuell als zusammengehörig dargestellt sehen (gemeinsamer Rahmen/Hintergrundfarbe).
- Als Nutzer möchte ich im Container-Badge sehen, welchen Anteil meines Containers diese Bestellung belegt (z.B. "1× 40HQ + 0,3× 40HQ").

### Konsolidierung aufheben
- Als Nutzer möchte ich eine bestehende Konsolidierung aufheben, indem ich alle Mitglieder der Gruppe auswähle und "Konsolidierung aufheben" klicke.
- Als Nutzer möchte ich, dass nach dem Aufheben alle Bestellungen exakt auf den Zustand vor der Konsolidierung zurückgesetzt werden (Stückzahlen, Datum, Container).

### Übersicht nach dem Speichern
- Als Nutzer möchte ich konsolidierte Planbestellungen in der Bestellplanung-Tabelle als zusammengehörig erkennen können.
- Als Nutzer möchte ich konsolidierte Bestellungen nur gemeinsam in "Laufende Bestellungen" umwandeln können — nicht einzeln.
- Als Nutzer möchte ich konsolidierte laufende Bestellungen nur gemeinsam als abgeschlossen markieren können.

### Re-Run nach erneuter Planung
- Als Nutzer möchte ich beim erneuten Planbestelllauf (Re-Run) im Konsolidierungsschritt erkennen, welche Bestellungen vorher konsolidiert waren, damit ich ggf. dieselbe Gruppe neu konsolidieren kann.
- Als Nutzer möchte ich durch einen Hover auf das "!"-Symbol sehen, mit welchen Produkten eine Bestellung vorher konsolidiert war.

---

## Acceptance Criteria

### Algorithmus-Bereinigung

- [ ] `checkKonsolidierungen()` wird aus `planbestelllauf-algorithmus.ts` vollständig entfernt
- [ ] Der Rückgabetyp `NeuePlanbestellung` enthält kein `konsolidierungen`-Feld mehr
- [ ] Die API-Route `POST /api/bestellplanung/planbestelllauf` liefert keine Konsolidierungsfelder mehr
- [ ] Die API-Route `POST /api/bestellplanung/planbestelllauf/anwenden` schreibt keine Konsolidierungsdaten mehr

### Erstplanbestellung-Dialog (PROJ-62 Änderung)

- [ ] Der Abschnitt "Konsolidierung (optional)" ist im Erstplanbestellung-Dialog nicht mehr vorhanden
- [ ] Es werden beim Anlegen einer Erstplanbestellung keine `bestellungen_konsolidierungsmitglieder`-Einträge angelegt
- [ ] Die Zod-Validierung des `POST /api/bestellplanung/bestellungen` Endpunkts akzeptiert kein `konsolidierungen`-Feld mehr

### Wizard Schritt 3: Darstellung

- [ ] Nach Schritt 2 gibt es einen "Weiter →"-Button, der zu Schritt 3 führt
- [ ] Schritt 3 (Überschrift: "Konsolidierung") zeigt:
  - Alle Planbestellungen mit Status `plan` aus der DB
  - Alle in Schritt 2 durch den Nutzer ausgewählten neuen Planbestellungen (temp_ids)
- [ ] Planbestellungen sind nach Hersteller gruppiert (Gruppen-Header: Herstellername)
- [ ] Planbestellungen ohne zugeordneten Hersteller bilden eine eigene Gruppe "Kein Hersteller"
- [ ] Innerhalb jeder Gruppe: aufsteigend nach `produktionsende_datum` sortiert
- [ ] Das `produktionsende_datum` ist in der Karte **fett** und visuell hervorgehoben dargestellt

### Planbestellungs-Karte in Schritt 3

Jede Karte enthält:
- [ ] Produktname(n)
- [ ] Stückzahl-Badge: Summe `menge_praktisch` aller SKUs
- [ ] Container-Badge: Containerart(en) und -anteil (bei konsolidierten Bestellungen als Dezimalzahl, z.B. "1× 40HQ · 0,3× 40HQ")
- [ ] "Erstbestellung"-Badge bei `herkunft = 'manuell'`
- [ ] 4 Datumsfelder (read-only in dieser Ansicht): Bestelldatum, **Prod.ende** (fett), Shippingdatum, Verfügbarkeitsdatum
- [ ] Containerauslastungsanzeige (Fortschrittsbalken + Prozentzahl):

**Auslastungslogik:**
```
gesamtvolumen_m3 = Σ(menge_praktisch_sku × stueckvolumen_m3_sku) über alle SKUs der Bestellung
```
| Bedingung | Anzeige |
|---|---|
| gesamtvolumen_m3 < volumen_20dc_m3 | "X% von 20DC" (X = gesamtvolumen / volumen_20dc × 100) |
| volumen_20dc_m3 ≤ gesamtvolumen_m3 < volumen_40hq_m3 | "X% von 40HQ" |
| ≥ 1× volumen_40hq_m3 | Jeden vollen 40HQ als "100%" + Restvolumen nach obiger Logik |
| Volumendaten fehlen | "Volumen unbekannt" (Badge ausgegraut) |

- [ ] Klick auf Karte öffnet `BestellungDetailDialog` (identisch mit Klick in der Haupttabelle)

### Konsolidierung auslösen

- [ ] Jede Karte hat eine Checkbox (links oben)
- [ ] Sobald ≥ 2 Bestellungen **desselben Herstellers** ausgewählt sind: Button "Konsolidieren" erscheint rechts oben im Wizard-Header
- [ ] Bei Auswahl von Bestellungen aus verschiedenen Herstellergruppen: "Konsolidieren"-Button erscheint nicht; stattdessen Hinweistext "Nur Bestellungen desselben Herstellers können konsolidiert werden"
- [ ] Klick auf "Konsolidieren" führt den Konsolidierungsalgorithmus clientseitig aus (keine neue API-Anfrage für die Berechnung)
- [ ] Das Ergebnis (angepasste Stückzahlen, Container, Datum) wird sofort in der Ansicht angezeigt
- [ ] Konsolidierte Bestellungen werden visuell zusammengehörig dargestellt (gemeinsamer farbiger Rahmen / Hintergrundfarbe innerhalb der Herstellergruppe)

### Konsolidierungsalgorithmus (clientseitig)

**Eingabe:** N ausgewählte Planbestellungen mit bekannten `menge_praktisch` je SKU und `stueckvolumen_m3` je SKU sowie `volumen_20dc_m3` und `volumen_40hq_m3` aus den globalen Container-Einstellungen.

**Schritt 1 — Restvolumen je Bestellung berechnen:**
```
gesamtvolumen_m3_i = Σ(menge_praktisch_sku × stueckvolumen_m3_sku) für Bestellung i
volle_40hq_i = floor(gesamtvolumen_m3_i / volumen_40hq_m3)
rest_m3_i = gesamtvolumen_m3_i - (volle_40hq_i × volumen_40hq_m3)
```

- [ ] Volle 40HQ-Einheiten bleiben unverändert in der Bestellung
- [ ] Nur der Rest (`rest_m3_i`) wird in die gemeinsame Restberechnung eingebracht

**Schritt 2 — Gemeinsames Restvolumen:**
```
gesamt_rest_m3 = Σ(rest_m3_i über alle i)
```

**Schritt 3 — Container für Restvolumen bestimmen (gleiche Skalierungsregeln wie der Planbestelllauf-Algorithmus, aber auf m³-Basis):**

Dieselbe iterative Logik wie `computeContainerPlan()` im Algorithmus, mit:
- Schwelle halber 20DC: `volumen_20dc_m3 / 2`
- Schwelle Abrunden: `volumen_20dc_m3 × 1.3`
- Schwelle Mitte: `(volumen_20dc_m3 + volumen_40hq_m3) / 2`
- Ergebnis: `target_rest_m3`, `container_liste` (z.B. `['20DC']` oder `['40HQ', '20DC']`)

- [ ] Ist `gesamt_rest_m3 = 0`: Kein Restcontainer nötig; nur Datumsanpassung wird durchgeführt; Hinweis "Alle Bestellungen füllen exakt volle Container — nur Datum wird angepasst."

**Schritt 4 — Volumen und Container-Anteil je Bestellung zuweisen:**
```
volumen_anteil_i = rest_m3_i / gesamt_rest_m3
ziel_rest_m3_i = volumen_anteil_i × target_rest_m3
container_anteil_i = volumen_anteil_i (als Dezimalzahl, z.B. 0.3 für 30% eines Containers)
```

**Schritt 5 — Neue Stückzahl je SKU berechnen:**
```
für jede SKU k in Bestellung i:
  sku_volumen_anteil_k = (menge_praktisch_k × stueckvolumen_m3_k) / gesamtvolumen_m3_i
  neue_rest_stueck_k = round(ziel_rest_m3_i × sku_volumen_anteil_k / stueckvolumen_m3_k)
  neue_menge_praktisch_k = (volle_40hq_i × max_40hq_stueck) × sku_volumen_anteil_k + neue_rest_stueck_k
  begruendung_anpassung += "; Konsolidierung: ±X Stk. (Restmengen gemeinsamer Container)"
```

- [ ] MOQ-Untergrenze wird je SKU eingehalten: `neue_menge_praktisch_k ≥ moq_k`
- [ ] Runddifferenzen werden der SKU mit der größten Menge zugeschlagen

**Schritt 6 — Datumsanpassung:**
```
ziel_produktionsende = min(produktionsende_datum über alle ausgewählten Bestellungen)
```
Für jede ausgewählte Bestellung:
- Produktionsende → ziel_produktionsende
- Produktionsstart = Produktionsende − produktionszeit_tage
- Bestelldatum = Produktionsstart − pufferzeit_tage
- Shippingdatum = Produktionsende + zwischenzeit_tage
- Ankunftsdatum = Shippingdatum + shipping_zeit_tage
- Verfügbarkeitsdatum = Ankunftsdatum + entladungszeit_tage

- [ ] Lieferzeit-Stammdaten werden pro Produkt separat geladen (jede Bestellung hat ihr eigenes Produkt)
- [ ] Fehlt das Produktionsende-Datum bei einer Bestellung: Diese Bestellung wird bei der Datumsanpassung übersprungen; Hinweis "Prod.ende fehlt — Datum bitte manuell setzen"

### Konsolidierung aufheben

- [ ] Wenn alle Mitglieder einer bestehenden Konsolidierungsgruppe ausgewählt sind: Button "Konsolidierung aufheben" erscheint (ersetzt "Konsolidieren")
- [ ] Klick stellt exakt den gespeicherten Zustand vor der Konsolidierung wieder her für jede Bestellung:
  - Alle 6 Datumsfelder aus Snapshot
  - `menge_praktisch` je SKU aus Snapshot
  - `begruendung_anpassung` je SKU aus Snapshot
  - `containerart` aus Snapshot
- [ ] Die `bestellungen_konsolidierungsgruppe` wird gelöscht (CASCADE entfernt alle Mitglieder)
- [ ] Visuelle Zusammengehörigkeit wird sofort entfernt

### Speichern (am Ende von Schritt 3)

- [ ] Ein finaler "Übernehmen"-Button am Ende von Schritt 3 speichert in einem Schritt:
  1. Akzeptierte Änderungen an bestehenden Planbestellungen (aus Schritt 1)
  2. Neue Planbestellungen (aus Schritt 2)
  3. Konsolidierungsgruppen (aus Schritt 3): Gruppen anlegen, Mitglieder eintragen, bestellungen aktualisieren
  - Oder: Aufgehobene Konsolidierungen: Snapshot wiederherstellen, Gruppe löschen
- [ ] Ist keine Konsolidierung vorgenommen worden: Schritt 3 kann übersprungen werden ("Überspringen"-Button / direkt Übernehmen ohne Konsolidierungsänderung)

### Übersicht nach dem Speichern

**Planbestellungen-Tabelle:**
- [ ] Konsolidierte Bestellungen werden visuell als Gruppe dargestellt (z.B. farbiger Streifen links, gemeinsames Gruppen-Icon oder Einrückung)
- [ ] Das gleiche visuelle Gruppen-Pattern gilt für Tab "Laufende Bestellungen" und "Abgeschlossene Bestellungen"

**Status-Übergang (Plan → Laufend):**
- [ ] Klick auf "In Laufende Bestellung umwandeln" bei einer konsolidierten Planbestellung öffnet einen Hinweis-Dialog: "Diese Bestellung ist Teil einer Konsolidierungsgruppe (X weitere Bestellungen). Alle Bestellungen der Gruppe werden gemeinsam umgewandelt. Fortfahren?"
- [ ] Bestätigung wandelt alle Mitglieder der Gruppe gemeinsam um
- [ ] Ablehnen: keine Änderung

**Status-Übergang (Laufend → Abgeschlossen):**
- [ ] Analoges Verhalten wie Plan → Laufend

### Re-Run & Vorherige Konsolidierung Indikator

- [ ] Ein erneuter Planbestelllauf lädt bestehende Planbestellungen als `bestehendeBestellungen` — ohne Konsolidierungskontext
- [ ] Der Algorithmus behandelt jede Bestellung einzeln (bestehende Konsolidierungsgruppen werden ignoriert)
- [ ] In Schritt 3 (Konsolidierung): Planbestellungen, die Teil einer bestehenden Konsolidierungsgruppe sind, zeigen ein "!"-Symbol direkt neben der Checkbox
- [ ] Hover über "!": Tooltip "War konsolidiert mit: [Produktname A], [Produktname B]"
- [ ] Der Nutzer kann entscheiden: erneut konsolidieren (Checkbox setzen + "Konsolidieren") oder als unabhängig belassen

---

## Datenbankschema

### Entfernt: `bestellungen_konsolidierungen`
Die bisherige Paar-Tabelle wird durch das neue Gruppenmodell ersetzt. Migration entfernt die alte Tabelle nach Daten-Transformation (falls keine bestehenden Daten).

### Neu: `bestellungen_konsolidierungsgruppen`
```sql
CREATE TABLE bestellungen_konsolidierungsgruppen (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now()
);
-- RLS: Nutzer sieht und schreibt nur eigene Gruppen
```

### Neu: `bestellungen_konsolidierungsmitglieder`
```sql
CREATE TABLE bestellungen_konsolidierungsmitglieder (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gruppe_id       UUID NOT NULL REFERENCES bestellungen_konsolidierungsgruppen(id) ON DELETE CASCADE,
  bestellung_id   UUID NOT NULL REFERENCES bestellungen(id) ON DELETE CASCADE,
  container_anteil JSONB NOT NULL DEFAULT '{}',
  -- Beispiel: {"40HQ": 1.0, "20DC": 0.3}
  -- "Diese Bestellung belegt 1 vollen 40HQ + 30% eines weiteren 40HQ"
  snapshot_vor_konsolidierung JSONB NOT NULL,
  -- Speichert den Zustand vor der Konsolidierung (für Undo):
  -- {
  --   "bestelldatum": "2026-07-01",
  --   "produktionsstart_datum": "...",
  --   "produktionsende_datum": "...",
  --   "shippingdatum": "...",
  --   "ankunftsdatum": "...",
  --   "verfuegbarkeitsdatum": "...",
  --   "containerart": "40HQ",
  --   "sku_mengen": [
  --     {"sku_id": "uuid", "menge_praktisch": 800, "begruendung_anpassung": "..."}
  --   ]
  -- }
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(gruppe_id, bestellung_id)
);
-- RLS: analog
-- Index: bestellung_id für Abfrage "zu welcher Gruppe gehört Bestellung X?"
```

---

## API-Routen

### Neu: `POST /api/bestellplanung/konsolidierung`
Speichert eine Konsolidierungsgruppe und wendet die berechneten Änderungen auf die beteiligten Bestellungen an.

Request Body (Zod-validiert):
```json
{
  "bestellung_ids": ["uuid1", "uuid2"],
  "aenderungen": [
    {
      "bestellung_id": "uuid1",
      "neue_daten": {
        "bestelldatum": "2026-07-01",
        "produktionsstart_datum": "...",
        "produktionsende_datum": "...",
        "shippingdatum": "...",
        "ankunftsdatum": "...",
        "verfuegbarkeitsdatum": "..."
      },
      "neue_sku_mengen": [
        {"sku_id": "uuid", "menge_praktisch": 900, "begruendung_anpassung": "Konsolidierung: +100 Stk."}
      ],
      "container_anteil": {"40HQ": 0.3},
      "snapshot_vor_konsolidierung": { ... }
    }
  ]
}
```

Response: `{ "gruppe_id": "uuid", "success": true }`

### Neu: `DELETE /api/bestellplanung/konsolidierung/[gruppe_id]`
Hebt eine Konsolidierungsgruppe auf: Stellt Snapshot-Zustand aller Mitglieder wieder her (Daten + SKU-Mengen), löscht Gruppe (CASCADE entfernt Mitglieder).

### Geändert: `POST /api/bestellplanung/planbestelllauf/anwenden`
- Kein Schreiben von Konsolidierungsdaten mehr
- Nimmt `neue_bestellungen` und `akzeptierte_aenderungen` wie bisher, jedoch ohne `konsolidierungen`-Felder

### Geändert: `GET /api/bestellplanung/bestellungen`
Gibt zusätzlich zurück (für alle Status):
- `konsolidierungsgruppe_id: string | null`
- `konsolidierungspartner: Array<{ bestellung_id, produkt_namen }>` (für Tooltip im Re-Run-Indikator)
- `container_anteil: Record<string, number> | null`

---

## Edge Cases

- **Nur eine Bestellung ausgewählt**: "Konsolidieren"-Button erscheint nicht
- **Bestellungen unterschiedlicher Hersteller ausgewählt**: Hinweistext "Nur Bestellungen desselben Herstellers können konsolidiert werden"; Button bleibt inaktiv
- **Alle Reste = 0** (jede Bestellung füllt exakt volle Container): Konsolidierungsalgorithmus ändert keine Mengen; nur Datumsanpassung; Hinweis "Keine Restmengen — nur Datum wird angeglichen"
- **Fehlende Stückvolumen-Daten**: Bestellung kann nicht konsolidiert werden; wird in der Karte mit Hinweis markiert: "Stückvolumen fehlt — bitte in Produktinformationen ergänzen"; Checkbox deaktiviert
- **Fehlendes Prod.ende-Datum**: Bestellung kann nicht als "früheste" für Datumsanpassung herangezogen werden; Hinweis auf der Karte; Datum muss manuell gesetzt werden
- **Bereits konsolidierte Bestellung wird erneut konsolidiert**: Vorherige Konsolidierungsgruppe wird zuerst vollständig aufgehoben (Snapshot aller Mitglieder wird wiederhergestellt), dann neue Konsolidierung angewendet; Nutzer erhält Hinweis-Dialog: "Diese Bestellung ist bereits Teil einer Konsolidierungsgruppe. Die bisherige Konsolidierung wird aufgehoben und durch die neue ersetzt. Fortfahren?"
- **Konsolidierungsgruppe mit gelöschter Bestellung**: ON DELETE CASCADE entfernt Mitglied; falls Gruppe nur noch 1 Mitglied hat: Gruppe wird automatisch aufgelöst (kein Undo-Snapshot mehr verfügbar → Hinweis)
- **Status-Umwandlung einzeln versucht**: AlertDialog mit Hinweis, Aktion wird geblockt bis alle Mitglieder gemeinsam umgewandelt werden
- **Neue Planbestellung (temp_id) in Schritt 3 konsolidieren**: Die Konsolidierung speichert im Rahmen des finalen "Übernehmen"-Klicks zuerst die neue Bestellung (erhält echte UUID), dann die Konsolidierungsgruppe
- **Kein Hersteller für ein Produkt gepflegt**: Bestellung erscheint in Gruppe "Kein Hersteller"; Konsolidierung mit Bestellungen anderer Gruppen nicht möglich; Konsolidierung innerhalb der Gruppe "Kein Hersteller" ebenfalls nicht möglich (kein gemeinsamer Hersteller bestätigt)
- **Schritt 3 ohne Planbestellungen**: Wenn nach Schritt 2 weder bestehende noch neue Planbestellungen vorhanden sind, wird Schritt 3 übersprungen

---

## Technical Requirements

- Authentifizierung: `requireAuth()` auf allen neuen und geänderten API-Routen
- RLS auf beiden neuen Tabellen (Nutzer sieht nur eigene Gruppen und Mitglieder)
- Konsolidierungsalgorithmus läuft **clientseitig** (keine API für die Berechnung — nur für das Speichern)
- Snapshot-Größe: JSONB mit typischerweise 5–10 SKUs ≈ < 2 KB je Mitglied — kein Performance-Problem
- Die finale Speicheroperation (POST /api/bestellplanung/planbestelllauf/anwenden + POST /api/bestellplanung/konsolidierung) soll in einer koordinierten Sequenz ablaufen: erst Bestellungen anlegen, dann Konsolidierungsgruppen
- Neue Packages: keine (alle benötigten shadcn-Komponenten vorhanden; Tooltip, Progress für Auslastungsanzeige prüfen)

---

## Tech Design (Solution Architect)

### Überblick: Was sich ändert vs. was neu entsteht

| Datei | Typ | Änderung |
|---|---|---|
| `src/lib/planbestelllauf-algorithmus.ts` | Geändert | `checkKonsolidierungen()` entfernen; Algorithmus-Output enthält keine Konsolidierungsfelder mehr |
| `src/lib/konsolidierungs-algorithmus.ts` | **Neu** | Reine Berechnungslogik für Konsolidierung (clientseitig, kein DB-Zugriff) |
| `src/components/planbestelllauf-wizard.tsx` | Geändert | Neuer Schritt 3 (Konsolidierung); finaler Speicher-Schritt umgebaut |
| `src/components/konsolidierungs-schritt.tsx` | **Neu** | Schritt-3-Komponente mit Herstellergruppen, Karten, Auswahl-Logik |
| `src/components/konsolidierungs-karte.tsx` | **Neu** | Einzelne Planbestellungs-Karte mit Auslastungsbalken |
| `src/components/erstplanbestellung-dialog.tsx` | Geändert | Konsolidierungsabschnitt vollständig entfernen |
| `src/components/bestellplanung-tabelle.tsx` | Geändert | Gruppenindikator anzeigen; Status-Übergang via Gruppe blockieren |
| `src/hooks/use-planbestelllauf.ts` | Geändert | Typen bereinigen; `anwenden` gibt temp_id→real_id Map zurück |
| `src/hooks/use-bestellungen.ts` | Geändert | Typen auf neues Gruppenmodell umstellen; `changeStatusGruppe()` hinzufügen |
| `src/hooks/use-konsolidierung.ts` | **Neu** | `konsolidieren()` und `aufheben()` — ruft die neuen API-Routen auf |
| `src/app/api/bestellplanung/_utils.ts` | Geändert | `enrichBestellungen` auf neue Gruppen-Tabellen umstellen |
| `src/app/api/bestellplanung/planbestelllauf/route.ts` | Geändert | Produktstammdaten (Volumen, Hersteller, Lieferzeit) in Response aufnehmen für Schritt 3 |
| `src/app/api/bestellplanung/planbestelllauf/anwenden/route.ts` | Geändert | Konsolidierungsschreiben entfernen; temp_id→real_id Map im Response zurückgeben |
| `src/app/api/bestellplanung/bestellungen/route.ts` | Geändert | `konsolidierungsgruppe_id`, `konsolidierungspartner`, `container_anteil` im GET-Response |
| `src/app/api/bestellplanung/bestellungen/[id]/route.ts` | Geändert | PUT prüft Gruppenmitgliedschaft; blockiert Einzel-Statuswechsel wenn in Gruppe |
| `src/app/api/bestellplanung/konsolidierung/route.ts` | **Neu** | POST: Gruppe anlegen + Bestellungen anpassen |
| `src/app/api/bestellplanung/konsolidierung/[gruppe_id]/route.ts` | **Neu** | DELETE: Snapshot wiederherstellen + Gruppe löschen |

---

### Komponentenstruktur

```
PlanbestelllaufWizard  [Dialog — shadcn]
+-- Schritt 0: Ladescreen (unverändert)
+-- Schritt 1: Änderungsempfehlungen (unverändert)
+-- Schritt 2: Neue Planbestellungen (unverändert, nur Typen bereinigt)
+-- Schritt 3: Konsolidierung  ← NEU
    |
    +-- KonsolidierungsSchritt  [neue Komponente]
        |
        +-- [je Herstellergruppe]
        |   +-- Gruppen-Header (Herstellername + Anzahl Bestellungen)
        |   |
        |   +-- [je Planbestellung in der Gruppe]
        |       +-- KonsolidierungsKarte  [neue Komponente]
        |           +-- Checkbox  [shadcn]
        |           +-- "!"-Indikator mit Tooltip  [shadcn Tooltip]  (nur bei Re-Run)
        |           +-- Produktname + Badges (Stückzahl, Container, Erstbestellung)
        |           +-- 4 Datumsfelder read-only  (Bestelldatum, Prod.ende fett, Shipping, Verfügbar)
        |           +-- Containerauslastungsanzeige
        |               +-- Progress [shadcn]  + Prozenttext
        |               +-- Logik: je Auslastungsstufe andere Beschriftung
        |           +-- Klick → BestellungDetailDialog [bestehende Komponente]
        |
        +-- Konsolidierte Gruppe (visuell hervorgehoben)
        |   +-- Gemeinsamer farbiger Rahmen um alle Mitglieder
        |   +-- Gleiche Karten-Struktur wie oben
        |
        +-- Gruppe "Kein Hersteller" (falls vorhanden, am Ende)
        |
        +-- Aktionsbereich rechts oben  [sticky / im Header]
            +-- "Konsolidieren"-Button  (erscheint bei ≥ 2 gleicher Hersteller ausgewählt)
            +-- "Konsolidierung aufheben"-Button  (erscheint wenn alle Mitglieder einer Gruppe ausgewählt)
            +-- Hinweistext bei gemischter Herstellerauswahl
|
+-- Fußzeile Schritt 3:
    +-- "← Zurück"-Button
    +-- "Überspringen / Übernehmen"-Button  (speichert alles atomisch)
```

```
BestellplanungTabelle  [bestehende Komponente — Änderungen]
+-- Tab "Planbestellungen"
|   +-- [konsolidierte Gruppen: visuell zusammengefasst]
|   |   +-- Gruppen-Markierung links (farbiger Streifen oder Icon)
|   |   +-- Jede Bestellung als eigene Zeile (bestehende Tabellen-Struktur)
|   +-- [nicht konsolidierte Bestellungen: unverändert]
|
+-- Tab "Laufende Bestellungen"  (analoges Gruppen-Pattern)
+-- Tab "Abgeschlossene Bestellungen"  (analoges Gruppen-Pattern)
```

---

### Datenmodell (neue Typen im Frontend)

**`Bestellung`-Typ** (erweitert in `use-bestellungen.ts`):
```
Bestellung hat neu:
- konsolidierungsgruppe_id: string | null   → zu welcher Gruppe gehört sie?
- konsolidierungspartner: Liste von { bestellung_id, produkt_namen }   → für Re-Run "!"-Tooltip
- container_anteil: { "40HQ": Dezimalzahl, "20DC": Dezimalzahl } | null   → Anteil am gemeinsamen Container
```

**`KonsolidierungsGruppe`** (lokaler Wizard-State):
```
Jede Gruppe im Schritt-3-State hat:
- temp_gruppe_id: string   → lokale ID vor dem Speichern
- mitglieder: Liste von Bestellungs-IDs (real oder temp_id)
- aenderungen: Liste von geplanten Mengen-/Datums-Änderungen je Mitglied
- snapshots: gespeicherter Zustand vor der Konsolidierung je Mitglied
```

**`ProduktStammdaten`** (neu in Algorithmus-Response, für Schritt-3-Berechnungen):
```
Je Produkt:
- hersteller_id + hersteller_name
- stueckvolumen_m3 (aus Länge × Breite × Höhe)
- max_20dc (Stück), max_40hq (Stück)   → für Restberechnung
- lieferzeit_tage (Puffer, Produktion, Zwischenzeit, Shipping, Entladung)   → für Datumskaskade
```

**`ContainerGlobal`** (neu im Algorithmus-Response):
```
- volumen_20dc_m3
- volumen_40hq_m3
```

---

### Datenfluss

```
Wizard öffnet sich
  → POST /api/bestellplanung/planbestelllauf
  → Algorithmus liefert zusätzlich:
       produkt_stammdaten (Hersteller, Volumen, Lieferzeit je Produkt)
       container_global (Containervolumina)
  → Wizard hält diese Daten für Schritt 3 im lokalen State

Schritt 3 öffnet sich
  → Bestehende Planbestellungen werden aus DB-State genommen
       (geladen beim Öffnen der Bestellplanung-Seite, bereits im Hook)
  → Neue Bestellungen kommen aus Schritt-2-State (temp_ids)
  → KonsolidierungsSchritt gruppiert nach hersteller_id,
       sortiert nach produktionsende_datum

Nutzer wählt ≥ 2 Bestellungen desselben Herstellers aus
  → "Konsolidieren"-Button erscheint
  → Klick ruft konsolidierungs-algorithmus.ts auf (reine Funktion, clientseitig):
       Eingabe: ausgewählte Bestellungen + ProduktStammdaten + ContainerGlobal
       Ausgabe: KonsolidierungsGruppe mit geplanten Änderungen

Ergebnis wird im lokalen Wizard-State gespeichert
  → KonsolidierungsKarten zeigen aktualisierte Stückzahlen + Container-Anteil-Badge

Nutzer klickt "Übernehmen" (finaler Button)
  → Sequenziell:
    1. POST /api/bestellplanung/planbestelllauf/anwenden
         → Neue Bestellungen werden angelegt
         → Response liefert Map: temp_id → real_id
    2. POST /api/bestellplanung/konsolidierung  (falls Konsolidierungen vorhanden)
         → Gruppen werden angelegt (mit real_ids für neue, vorhandenen ids für bestehende)
         → Snapshots + Änderungen werden geschrieben
         → Bestellungen werden aktualisiert (Mengen, Daten, containerart)
  → Wizard schließt sich
  → Bestellplanung-Tabelle lädt neu

Nutzer hebt Konsolidierung auf (in Schritt 3)
  → Alle Mitglieder der Gruppe werden ausgewählt
  → "Konsolidierung aufheben"-Button erscheint
  → Klick: Zustand im lokalen Wizard-State wird auf den gespeicherten Snapshot zurückgesetzt
  → Beim "Übernehmen": DELETE /api/bestellplanung/konsolidierung/[gruppe_id]
       → Snapshot-Daten werden auf die Bestellungen zurückgeschrieben
       → Gruppe + Mitglieder werden gelöscht (CASCADE)

Nutzer versucht einzelne Bestellung aus Gruppe in "Laufend" umzuwandeln
  → PUT /api/bestellplanung/bestellungen/[id] erkennt Gruppenmitgliedschaft
  → Gibt HTTP 409 zurück mit { error: "in_gruppe", gruppe_id, partner_namen }
  → Frontend zeigt AlertDialog: "Gesamte Gruppe gemeinsam umwandeln?"
  → Bestätigung: useBestellungen.changeStatusGruppe(gruppe_id, 'laufend')
       → Ruft für jedes Mitglied separat den bestehenden PUT-Endpunkt auf
```

---

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Konsolidierungsalgorithmus clientseitig | Ja | Kein DB-Zugriff nötig für die Berechnung; Stammdaten kommen aus der Algorithmus-Response; ermöglicht sofortiges Preview ohne API-Roundtrip; einfach testbar als pure Funktion |
| Stammdaten in Algorithmus-Response aufnehmen | Ja | Daten (Hersteller, Volumen, Lieferzeit) werden bereits in `planbestelllauf/route.ts` geladen — kein zweiter API-Call nötig; Response wächst moderat (je Produkt ca. 5 Felder) |
| Sequenzielles Speichern (anwenden → konsolidierung) | Ja | Neue Bestellungen brauchen echte UUIDs bevor die Konsolidierungsgruppe angelegt werden kann; Schritt 1 kann scheitern ohne Schritt 2 zu beeinflussen; Retry von Schritt 2 alleine möglich |
| JSONB-Snapshot für Undo | Ja | 5–10 SKUs × wenige Felder ≈ < 2 KB; kein separates Versions-Schema nötig; flexibel für spätere Felderweiterungen |
| Gruppen-Modell statt Paare | Ja | N-Way-Konsolidierung (3+ Bestellungen) aus dem Start unterstützt; Undo skaliert linear mit Mitgliederzahl; DB-Struktur ist selbsterklärend |
| Blockierung Einzel-Statuswechsel via API (HTTP 409) | Ja | Konsistenz-Enforcement auf Server-Seite — verhindert inkonsistenten State auch bei direkten API-Aufrufen; Frontend reagiert mit erklärendem Dialog |
| Bestehende `BestellungDetailDialog`-Komponente wiederverwenden | Ja | Bereits vorhanden; Klick in Schritt 3 öffnet exakt denselben Dialog wie in der Haupttabelle; kein Code-Duplizierung |
| `Progress`-Komponente für Auslastungsbalken | Ja | shadcn `Progress` bereits installiert (`src/components/ui/progress.tsx`) |
| `Tooltip`-Komponente für "!"-Indikator | Ja | shadcn `Tooltip` bereits installiert (`src/components/ui/tooltip.tsx`) |
| Neue Packages | Keine | Alle benötigten Komponenten vorhanden |

---

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/lib/konsolidierungs-algorithmus.ts` | Reine Berechnungslogik (Restvolumen, Container, Datumskaskade) |
| `src/components/konsolidierungs-schritt.tsx` | Wizard-Schritt-3-Komponente |
| `src/components/konsolidierungs-karte.tsx` | Einzelne Planbestellungs-Karte mit Auslastungsanzeige |
| `src/hooks/use-konsolidierung.ts` | API-Calls für Konsolidierung anlegen und aufheben |
| `src/app/api/bestellplanung/konsolidierung/route.ts` | POST: Gruppe erstellen + Bestellungen aktualisieren |
| `src/app/api/bestellplanung/konsolidierung/[gruppe_id]/route.ts` | DELETE: Undo über Snapshot |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/planbestelllauf-algorithmus.ts` | `checkKonsolidierungen` + zugehörige Typen entfernen |
| `src/components/planbestelllauf-wizard.tsx` | Schritt 3 einbauen; finaler Speicher-Flow umbauen |
| `src/components/erstplanbestellung-dialog.tsx` | Konsolidierungs-State + -UI entfernen |
| `src/components/bestellplanung-tabelle.tsx` | Gruppen-Visualisierung + Status-Constraint-Dialog |
| `src/hooks/use-planbestelllauf.ts` | Typen bereinigen; `anwenden()` gibt temp_id→real_id zurück |
| `src/hooks/use-bestellungen.ts` | `Konsolidierung`-Typ ersetzen; `changeStatusGruppe()` hinzufügen |
| `src/app/api/bestellplanung/_utils.ts` | Auf neue Gruppen-Tabellen umstellen |
| `src/app/api/bestellplanung/planbestelllauf/route.ts` | Produktstammdaten in Response aufnehmen |
| `src/app/api/bestellplanung/planbestelllauf/anwenden/route.ts` | Konsolidierungsschreiben entfernen; temp_id→real_id Response |
| `src/app/api/bestellplanung/bestellungen/route.ts` | Gruppen-Felder im GET-Response ergänzen |
| `src/app/api/bestellplanung/bestellungen/[id]/route.ts` | Gruppen-Check + HTTP 409 bei Einzel-Statuswechsel |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
