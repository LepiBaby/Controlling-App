# PROJ-64: Bestellkosten — Kurzfristige Planung

## Status: In Progress
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — KPI-Unterkategorien als Kostenkategorien
- Requires: PROJ-59 (Produktinformationen) — Zahlungskonditionen, Produktkosten, globale Kosteneinstellungen (Inspektion, Shipping, Einlagerung, Zoll)
- Requires: PROJ-60 (Bestellplanung) — `bestellungen`-Tabelle und `BestellungDetailDialog`
- Requires: PROJ-62 (Erstplanbestellung anlegen) — Container-Typ und -Anzahl je Bestellung

---

## Übersicht

Für jede Bestellung (Plan, laufend, abgeschlossen) können **Bestellkosten** (Zahlungspositionen) verwaltet werden. Diese werden beim Anlegen einer Planbestellung **automatisch** aus den im System hinterlegten Stammdaten berechnet und in der Datenbank gespeichert.

Die Bestellkosten werden im `BestellungDetailDialog` als Tabelle angezeigt — **nach dem Container-Abschnitt, vor dem Notizen-Feld**. Jeder Eintrag enthält: Datum (Zahlungsdatum), Kategorie (KPI-Unterkategorie), Nettobetrag und Begründung. Die Einträge sind aufsteigend nach Datum sortiert; eine Gesamtsumme wird unterhalb der Tabelle angezeigt.

Für Planbestellungen kann der Nutzer zusätzlich **manuell neue Einträge direkt in der Tabelle** (inline, ohne separaten Dialog) anlegen, bearbeiten und löschen.

---

## User Stories

### Automatische Kostengenerierung
- Als Nutzer möchte ich, dass beim Anlegen einer Planbestellung automatisch alle relevanten Zahlungspositionen (Ware, Inspektion, Shipping, Zoll, Einlagerung) aus den Stammdaten berechnet werden, damit ich diese nicht manuell einpflegen muss.
- Als Nutzer möchte ich, dass die generierten Zahlungsdaten exakt aus meinen hinterlegten Zahlungskonditionen und Produktkosteneinstellungen stammen.
- Als Nutzer möchte ich, dass fehlende Stammdaten (z.B. Warenkosten nicht gepflegt) nur den betreffenden Eintrag überspringen — alle anderen Kosten werden trotzdem generiert.

### Bestellkosten einsehen
- Als Nutzer möchte ich beim Öffnen einer beliebigen Bestellung alle zugehörigen Zahlungspositionen als Tabelle im Detail-Dialog sehen (nach Container-Abschnitt, vor Notizen).
- Als Nutzer möchte ich die Einträge aufsteigend nach Datum sortiert sehen, um einen zeitlichen Überblick über fällige Zahlungen zu erhalten.
- Als Nutzer möchte ich die Gesamtsumme aller Bestellkosten am Ende der Tabelle sehen.

### Manuelle Bestellkosten anlegen (nur Planbestellungen)
- Als Nutzer möchte ich im Detail-Dialog einer Planbestellung einen neuen Kosteneintrag direkt in der Tabelle anlegen können — ohne separaten Dialog oder Page-Navigation.
- Als Nutzer möchte ich als Kategorie aus einem Dropdown alle KPI-Unterkategorien unter der Kategorie „Produkt" wählen können.
- Als Nutzer möchte ich Datum, Nettobetrag und Begründung für den manuellen Eintrag eingeben können.
- Als Nutzer möchte ich beliebig viele manuelle Einträge nacheinander erstellen können.

### Einträge bearbeiten und löschen (nur Planbestellungen)
- Als Nutzer möchte ich im Detail-Dialog einer Planbestellung jeden Eintrag (automatisch und manuell generiert) bearbeiten und löschen können.
- Als Nutzer möchte ich bei laufenden und abgeschlossenen Bestellungen die Kosten nur lesen können (kein Bearbeiten, kein Löschen, kein manuelles Anlegen).

---

## Acceptance Criteria

### Auto-Generierung beim Anlegen einer Planbestellung

- [ ] Beim Anlegen einer Planbestellung (via Planbestelllauf oder manuell via PROJ-62) werden automatisch Kosten-Einträge serverseitig generiert und in `bestellungen_kosten` gespeichert
- [ ] Die Generierung verwendet: `produktinformationen_produktkosten`, `produktinformationen_zahlungskonditionen`, `produktinformationen_kosten_global` und die Container-Daten der Bestellung (aus PROJ-62)
- [ ] Jeder auto-generierte Eintrag wird mit `ist_automatisch = true` gespeichert
- [ ] Fehlende Stammdaten führen dazu, dass nur der betreffende Eintrag übersprungen wird; die übrigen werden normal generiert

#### Kategorie Ware (bis zu 3 Einträge pro Produkt)

- [ ] Gesamtkosten Ware (je Produkt) = `warenkosten` (€/Stück) × Summe der praktischen SKU-Mengen dieses Produkts in der Bestellung
- [ ] Eintrag **„Ware — Vor Produktion"** wird angelegt, wenn `vor_produktion_prozent > 0`:
  - Betrag = Gesamtkosten Ware × (vor_produktion_prozent ÷ 100)
  - Datum = `bestelldatum` + `zahlungsziel_vor_produktion_tage` Tage
  - Begründung: automatisch (z.B. „250 Stück × 12,50 €/Stück × 30% = 937,50 €")
- [ ] Eintrag **„Ware — Nach Produktion"** wird angelegt, wenn `nach_produktion_prozent > 0`:
  - Betrag = Gesamtkosten Ware × (nach_produktion_prozent ÷ 100)
  - Datum = `shippingdatum` + `zahlungsziel_nach_produktion_tage` Tage
  - Begründung: analog
- [ ] Eintrag **„Ware — Nach Ankunft"** wird angelegt, wenn `nach_ankunft_prozent > 0`:
  - Betrag = Gesamtkosten Ware × (nach_ankunft_prozent ÷ 100)
  - Datum = `ankunftsdatum` + `zahlungsziel_nach_ankunft_tage` Tage
  - Begründung: analog
- [ ] Ist das Zahlungsverhältnis 100%/0%/0%, entsteht nur 1 Eintrag; bei 50%/30%/20% entstehen 3 Einträge
- [ ] Bei konsolidierten Bestellungen mit mehreren Produkten wird je Produkt eine eigene Ware-Berechnung durchgeführt (separate Einträge pro Produkt)

#### Kategorie Inspektion (1 Eintrag)

- [ ] Betrag = Σ über alle Containerarten (Anzahl Container dieser Art × `inspektion_kosten_[art]`)
- [ ] Datum = `produktionsende_datum` + `inspektion_zahlungsziel_tage` Tage
- [ ] Begründung: automatisch (z.B. „1 × 40HQ (1.800 €) + 1 × 20DC (900 €)")
- [ ] Eintrag wird nur angelegt wenn Container-Daten der Bestellung vorhanden sind und mindestens ein Inspektionskostenwert > 0

#### Kategorie Shipping (1 Eintrag)

- [ ] Betrag = Σ über alle Containerarten (Anzahl Container dieser Art × `shipping_kosten_[art]`)
- [ ] Datum = `ankunftsdatum` + `shipping_zahlungsziel_tage` Tage
- [ ] Begründung: analog zu Inspektion
- [ ] Eintrag wird nur angelegt wenn Container-Daten vorhanden und mindestens ein Shippingkostenwert > 0

#### Kategorie Zoll (1 Eintrag)

- [ ] Zoll-Basis = Gesamtkosten Ware (alle Produkte summiert) + Shipping-Betrag
- [ ] Betrag = Zoll-Basis × (Zollsatz ÷ 100); bei mehreren Produkten: Zollsatz je Produkt auf seinen Warenanteil anwenden und summieren
- [ ] Datum = `ankunftsdatum` + `zoll_zahlungsziel_tage` Tage
- [ ] Begründung: automatisch (z.B. „Zollsatz 8% auf 3.125 € Ware + 2.700 € Shipping")
- [ ] Eintrag wird nur angelegt wenn Zollsatz > 0 und Zoll-Basis > 0

#### Kategorie Einlagerung (1 Eintrag)

- [ ] Betrag = Σ über alle Containerarten (Anzahl Container dieser Art × `einlagerung_kosten_[art]`)
- [ ] Datum = `verfuegbarkeitsdatum` + `einlagerung_zahlungsziel_tage` Tage
- [ ] Begründung: analog zu Inspektion
- [ ] Eintrag wird nur angelegt wenn Container-Daten vorhanden und mindestens ein Einlagerungskostenwert > 0

### Kategorie-Matching für Auto-Generierung

- [ ] Das System sucht für jede der 5 Kostenkategorien eine passende KPI-Unterkategorie im KPI-Modell des Nutzers anhand des Namens (Trim, case-insensitiv): „Ware", „Inspektion", „Shipping", „Zoll", „Einlagerung"
- [ ] Die gesuchte Kategorie muss eine Unterkategorie (child) einer KPI-Kategorie mit dem Namen „Produkt" sein
- [ ] Wird keine passende Kategorie gefunden, wird der Eintrag übersprungen (kein Fehler, kein Blockieren)

### Anzeige im `BestellungDetailDialog`

- [ ] Die Bestellkosten-Tabelle erscheint in allen drei Detail-Dialogen (Planbestellung, Laufende, Abgeschlossene) — nach dem Container-Abschnitt, vor dem Notizen-Feld
- [ ] Tabellenstruktur:
  - Spalte **Datum** (Zahlungsdatum, Format `TT.MM.YYYY`)
  - Spalte **Kategorie** (KPI-Kategoriename; wenn Kategorie gelöscht: „–")
  - Spalte **Nettobetrag** (€, 2 Nachkommastellen, rechtsbündig)
  - Spalte **Begründung**
  - Spalte **Aktionen** (nur bei Planbestellungen sichtbar)
- [ ] Einträge sind aufsteigend nach Datum sortiert
- [ ] Summenzeile am Ende der Tabelle: „Gesamt" + Summe aller Nettobeträge (rechtsbündig)
- [ ] Leerer Zustand (keine Einträge): Hinweistext „Keine Bestellkosten vorhanden"
- [ ] Bei laufenden und abgeschlossenen Bestellungen: keine Aktions-Spalte, kein „Hinzufügen"-Button

### Manuelle Einträge anlegen (nur Planbestellungen)

- [ ] Unterhalb der Tabelle befindet sich ein Button „+ Kosteneintrag hinzufügen"
- [ ] Klick fügt eine neue editierbare Zeile am Ende der Tabelle ein (inline — kein separater Dialog)
- [ ] Die neue Zeile enthält Eingabefelder für:
  - **Datum**: Datepicker (Pflichtfeld)
  - **Kategorie**: Dropdown mit allen KPI-Unterkategorien der Kategorie „Produkt" des Nutzers (Pflichtfeld)
  - **Nettobetrag**: Zahlenfeld in € (Pflichtfeld, ≥ 0)
  - **Begründung**: Textfeld (optional)
- [ ] In der Zeile gibt es einen „Hinzufügen"-Button und ein „×"-Symbol zum Abbrechen
- [ ] Klick auf „Hinzufügen" (oder Enter): validiert die Pflichtfelder, speichert den Eintrag, ordnet ihn sortiert in die Tabelle ein
- [ ] Klick auf „×": verwirft die neue Zeile ohne Speichern
- [ ] Manuelle Einträge werden mit `ist_automatisch = false` gespeichert
- [ ] Mehrere manuelle Einträge können nacheinander (nicht gleichzeitig) angelegt werden

### Bearbeiten und Löschen (nur Planbestellungen)

- [ ] Jede Zeile in der Aktions-Spalte zeigt Bearbeiten- und Löschen-Icons
- [ ] Klick auf Bearbeiten: alle 4 Felder der Zeile werden inline editierbar (selbes Layout wie neue Zeile)
- [ ] „Speichern"-Button und „×"-Abbrechen sind in der Bearbeiten-Zeile sichtbar
- [ ] Klick auf Speichern: Änderungen werden persistiert, Zeile kehrt zur Read-Ansicht zurück
- [ ] Klick auf Löschen: shadcn `AlertDialog` mit Bestätigung erscheint; nach Bestätigung wird der Eintrag gelöscht
- [ ] Nach Speichern oder Löschen wird die Tabelle neu sortiert und die Summe aktualisiert

---

## Datenbankschema

### Neue Tabelle `bestellungen_kosten`

| Spalte | Typ | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `bestellung_id` | UUID | NOT NULL, FK → `bestellungen` (ON DELETE CASCADE) |
| `kpi_kategorie_id` | UUID | FK → `kpi_categories` (ON DELETE SET NULL) — NULL wenn Kategorie gelöscht |
| `datum` | DATE | NOT NULL — Zahlungsdatum |
| `nettobetrag` | DECIMAL(12,2) | NOT NULL, CHECK ≥ 0 |
| `begruendung` | TEXT | NULL erlaubt |
| `ist_automatisch` | BOOLEAN | NOT NULL DEFAULT false |
| `user_id` | UUID | NOT NULL, FK → `auth.users` (ON DELETE CASCADE) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

- RLS aktiviert: Nutzer sieht und schreibt nur eigene Einträge (`auth.uid() = user_id`)
- Index auf `bestellung_id` und `user_id`

---

## API-Routen

| Route | Methode | Beschreibung |
|---|---|---|
| `/api/bestellplanung/bestellungen/[id]/kosten` | GET | Alle Kosten einer Bestellung laden, sortiert nach `datum` ASC |
| `/api/bestellplanung/bestellungen/[id]/kosten` | POST | Manuellen Eintrag anlegen; Body: `{ kpi_kategorie_id, datum, nettobetrag, begruendung? }` |
| `/api/bestellplanung/bestellungen/[id]/kosten/[kostenId]` | PUT | Eintrag aktualisieren; Body: `{ kpi_kategorie_id?, datum?, nettobetrag?, begruendung? }` |
| `/api/bestellplanung/bestellungen/[id]/kosten/[kostenId]` | DELETE | Eintrag löschen |

Die **automatische Generierung** läuft serverseitig als interner Schritt innerhalb der bestehenden Bestellungs-Anlagelogik (kein eigener öffentlicher Endpunkt). Sie wird aufgerufen:
- in `POST /api/bestellplanung/bestellungen/planbestelllauf/anwenden` nach dem Anlegen jeder neuen Planbestellung
- in `POST /api/bestellplanung/bestellungen` beim manuellen Anlegen einer Planbestellung (PROJ-62)

---

## Edge Cases

- **Fehlende Zahlungskonditionen**: Keine „Ware"-Einträge werden generiert; optionaler Hinweis im Bestellkosten-Bereich der Bestellung.
- **Fehlende Warenkosten (€/Stück = NULL)**: Keine „Ware"-Einträge werden generiert.
- **Fehlendes Datum in der Bestellung** (z.B. kein Shippingdatum): Der Eintrag, dessen Datum auf diesem Feld basiert, wird übersprungen; alle anderen Einträge werden normal generiert.
- **Fehlende globale Kosteneinstellungen** (Inspektion/Shipping/Einlagerungskosten = NULL): Die betreffenden Einträge werden übersprungen.
- **Fehlende Container-Daten der Bestellung**: Inspektion, Shipping und Einlagerung können nicht berechnet werden; alle drei Einträge werden übersprungen.
- **KPI-Kategorie nicht gefunden** (kein Match für „Ware" etc.): Dieser Eintrag wird übersprungen; kein Fehler, kein Abbruch der übrigen Generierung.
- **KPI-Kategorie nachträglich gelöscht**: `kpi_kategorie_id` bleibt NULL (ON DELETE SET NULL); der Eintrag bleibt mit Betrag erhalten und zeigt „–" in der Kategorie-Spalte.
- **Zahlungsziel = 0 Tage**: Gültiger Wert; Zahlungsdatum = Basisdatum (z.B. Bestelldatum + 0 Tage = Bestelldatum selbst).
- **Zollsatz = 0**: Kein Zoll-Eintrag wird angelegt (Betrag wäre 0).
- **Stammdaten ändern sich nach der Generierung**: Auto-generierte Einträge werden **nicht automatisch aktualisiert**. Der Nutzer kann Einträge manuell bearbeiten oder löschen und — wenn er eine neue Planbestellung anlegt — werden die neuen Werte verwendet.
- **Bestellung wird von Plan → Laufend umgewandelt**: Bestellkosten bleiben unverändert erhalten; werden im Detail-Dialog read-only.
- **Konsolidierte Bestellung mit mehreren Produkten**: Ware wird je Produkt separat berechnet; Inspektion, Shipping, Einlagerung und Zoll werden auf Bestellebene (gesamte Containermenge) berechnet.
- **Betrag = 0 nach Berechnung** (z.B. Warenkosten = 0): Eintrag wird trotzdem angelegt (Betrag 0 ist gültig und für Transparenz sinnvoll).
- **Kategorie-Dropdown leer** (keine KPI-Unterkategorien unter „Produkt"): Button „+ Kosteneintrag hinzufügen" ist deaktiviert mit Tooltip „Keine Kostenkategorien im KPI-Modell vorhanden. Bitte zuerst Unterkategorien unter 'Produkt' anlegen."

---

## Technical Requirements

- `requireAuth()` auf allen API-Routen
- RLS auf `bestellungen_kosten`
- Auto-Generierungslogik serverseitig in einer reinen Hilfsfunktion (ohne DB-Zugriff außerhalb der API-Route), analog zur Algorithmus-Trennung in PROJ-60
- Kategorie-Dropdown für manuelle Einträge: `kpi_categories` wo `parent.name ILIKE 'Produkt'` (child-Kategorien der Produkt-Kategorie des Nutzers)
- shadcn `AlertDialog` für Lösch-Bestätigungen
- Optimistische Updates im Frontend; bei API-Fehler Toast + Rollback
- Bestellkosten-Abschnitt im `BestellungDetailDialog` (PROJ-60) als eigenständige Subkomponente, die den `bestellung_id`-Prop entgegennimmt

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
BestellungDetailDialog  (BESTEHEND, geändert — src/components/bestellung-detail-dialog.tsx)
+-- Datumsfelder-Sektion  (unverändert)
+-- SKU-Mengen-Tabelle  (unverändert)
+-- Container-Sektion  (unverändert)
+-- Konsolidierungspartner-Sektion  (unverändert)
+-- BestellkostenTabelle  (NEU — eigene Datei, eingebunden per Props)
|   +-- Abschnittsüberschrift „Bestellkosten"
|   +-- Table [shadcn]
|   |   +-- Kopfzeile: Datum | Kategorie | Nettobetrag | Begründung | Aktionen
|   |   +-- Zeile je Kosteneintrag
|   |   |   +-- Read-Modus (Standard): Datum | Kategoriename | Betrag | Begründung | [Bearbeiten] [Löschen]
|   |   |   +-- Edit-Modus (inline): DatePicker | Select | Input | Input | [Speichern] [×]
|   |   +-- Neue-Eintrag-Zeile (nur im Anlage-Modus): 4 Felder + [Hinzufügen] [×]
|   |   +-- Summenzeile: „Gesamt" + Summe aller Nettobeträge
|   +-- Button „+ Kosteneintrag hinzufügen" (nur bei Planbestellungen)
|   +-- AlertDialog [shadcn] für Löschbestätigung
+-- Notizen-Feld  (unverändert)
+-- DialogFooter  (unverändert)
```

---

### Datenmodell

**1 neue Datenbanktabelle — mit RLS (Nutzer sieht und schreibt nur eigene Daten):**

| Tabelle | Zweck | Schlüssel |
|---|---|---|
| `bestellungen_kosten` | Zahlungspositionen je Bestellung | `(bestellung_id, user_id)` |

**Felder je Eintrag:** Zahlungsdatum, KPI-Kategorie (Referenz), Nettobetrag, Begründung (Freitext), Auto-Flag (unterscheidet auto-generierte von manuellen Einträgen)

**Berechnete Werte (nicht gespeichert):**
- Gesamtsumme aller Bestellkosten: clientseitig summiert, nicht persistiert
- Sortierung nach Datum: clientseitig aus geladenen Daten

**Wo kommen Container-Daten her?**
Die Felder `anzahl_40hq` und `anzahl_20dc` sind bereits auf der `bestellungen`-Tabelle gespeichert (PROJ-62) und stehen in der `FullBestellung`-Struktur zur Verfügung — kein zusätzlicher Datenbankzugriff für die Generierung notwendig.

---

### Datenfluss

```
Dialog öffnet sich (beliebiger Bestellungsstatus)
  → BestellkostenTabelle erhält bestellungId + readOnly-Prop
  → useBestellungKosten(bestellungId) → GET /api/bestellplanung/bestellungen/[id]/kosten
  → Einträge werden sortiert nach Datum angezeigt

Nutzer klickt „+ Kosteneintrag hinzufügen" (nur Planbestellung)
  → neue editierbare Zeile erscheint inline unten in der Tabelle
  → Nutzer füllt: Datum (DatePicker) | Kategorie (Select) | Betrag (Input) | Begründung (Input)
  → Klick „Hinzufügen" → POST /api/bestellplanung/bestellungen/[id]/kosten
  → optimistisches Update: Zeile erscheint sofort sortiert in der Tabelle

Nutzer klickt Bearbeiten-Icon
  → Zeile wechselt in Edit-Modus (inline editierbar)
  → Klick Speichern → PUT /api/bestellplanung/bestellungen/[id]/kosten/[kostenId]
  → Zeile kehrt in Read-Modus zurück, Summe aktualisiert

Nutzer klickt Löschen-Icon
  → AlertDialog erscheint → DELETE /api/bestellplanung/bestellungen/[id]/kosten/[kostenId]
  → optimistisches Entfernen aus der Liste

Planbestellung wird neu angelegt (via Planbestelllauf oder manuell)
  → POST /api/bestellplanung/bestellungen (oder planbestelllauf/anwenden)
  → Server: nach dem Anlegen der Bestellung wird intern generiereBestellkosten() aufgerufen
  → generiereBestellkosten() ist eine reine Funktion: erhält alle Stammdaten + Bestellungsdaten,
    gibt Liste von Kosten-Einträgen zurück — ohne DB-Zugriff
  → Server schreibt die generierten Einträge in bestellungen_kosten
  → nächstes Öffnen des Dialogs lädt die generierten Kosten
```

---

### Server-Architektur: Generierungslogik

Analog zur Trennung in PROJ-60 (Algorithmus vs. API-Route):

**`src/lib/bestellkosten-generierung.ts`** — reine Berechnungslogik
- Erhält alle nötigen Stammdaten als Parameter (keine DB-Aufrufe)
- Berechnet alle bis zu 7 Einträge (3× Ware, Inspektion, Shipping, Zoll, Einlagerung)
- Gibt eine Liste von Kosten-Objekten zurück (zum Einfügen bereit)
- Keine Seiteneffekte → einfach unit-testbar

**Integration in bestehende API-Routen:**
- `POST /api/bestellplanung/bestellungen` — nach dem Einfügen der Bestellung: Stammdaten laden, `generiereBestellkosten()` aufrufen, Ergebnis in `bestellungen_kosten` schreiben
- `POST /api/bestellplanung/planbestelllauf/anwenden` — nach dem Anlegen jeder neuen Planbestellung: identischer Aufruf

---

### API-Endpunkte (Übersicht)

| Route | Methoden | Zweck |
|---|---|---|
| `/api/bestellplanung/bestellungen/[id]/kosten` | GET, POST | Kosten laden / manuellen Eintrag anlegen |
| `/api/bestellplanung/bestellungen/[id]/kosten/[kostenId]` | PUT, DELETE | Eintrag aktualisieren / löschen |

Alle Routen: `requireAuth()` + RLS-Schutz + Zod-Validierung der Eingaben.

---

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/components/bestellkosten-tabelle.tsx` | Bestellkosten-Subkomponente: Tabelle mit inline Edit/Add + AlertDialog |
| `src/hooks/use-bestellung-kosten.ts` | State: Kosten laden + CRUD (add, update, delete) mit optimistischem Update |
| `src/lib/bestellkosten-generierung.ts` | Reine Berechnungsfunktion für auto-generierte Kosten (kein DB-Zugriff) |
| `src/app/api/bestellplanung/bestellungen/[id]/kosten/route.ts` | GET + POST |
| `src/app/api/bestellplanung/bestellungen/[id]/kosten/[kostenId]/route.ts` | PUT + DELETE |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/bestellung-detail-dialog.tsx` | `<BestellkostenTabelle>` zwischen Konsolidierungspartner und Notizen einfügen |
| `src/app/api/bestellplanung/bestellungen/route.ts` | POST: nach Bestellung anlegen `generiereBestellkosten()` aufrufen und Kosten speichern |
| `src/app/api/bestellplanung/planbestelllauf/anwenden/route.ts` | POST: je neuer Planbestellung `generiereBestellkosten()` aufrufen und Kosten speichern |

---

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Bestellkosten als eigenständige Subkomponente | Ja | Hält `bestellung-detail-dialog.tsx` (901 Zeilen) überschaubar; klare Props-Grenze (`bestellungId` + `readOnly`) |
| Lazy Loading der Kosten | Ja | Kosten werden erst geladen wenn der Dialog geöffnet wird — nicht beim Laden der Bestellungsliste; spart unnötige API-Calls |
| Generierung als reine Funktion getrennt | Ja | Einfach unit-testbar ohne DB-Mocking; konsistent mit PROJ-60 Algorithmus-Muster |
| Container-Daten aus `bestellungen` direkt | Ja | `anzahl_40hq` / `anzahl_20dc` sind bereits auf der Bestellung (PROJ-62/63); kein separater Lookup nötig |
| Kein eigener Endpunkt für Generierung | Ja | Generierung ist ein interner Serverseitenablauf, kein aufrufbarer Client-Endpunkt; verhindert unbeabsichtigte Doppel-Generierung |
| Inline-Editing ohne Dialog | Ja | Wie in der Spec gefordert; shadcn `Select`, `Input` und `Calendar`+`Popover` für DatePicker sind alle vorhanden |
| `ON DELETE SET NULL` für kpi_kategorie_id | Ja | Eintrag bleibt auch nach Kategorie-Löschung erhalten (Betrag und Datum); kein Datenverlust |
| Optimistisches Update | Ja | Konsistent mit dem Pattern aller anderen Seiten im Projekt |
| Neue Packages | Keine | Alle benötigten shadcn-Komponenten bereits installiert: Table, AlertDialog, Select, Input, Calendar, Popover, Button, Separator |

## Backend Implementation Notes

**Implementiert:** 2026-06-12

### Was gebaut wurde

- **DB-Migration `proj_64_bestellkosten`**: Tabelle `bestellungen_kosten` mit RLS, FK zu `bestellungen` (ON DELETE CASCADE) und `kpi_categories` (ON DELETE SET NULL)
- **`src/lib/bestellkosten-generierung.ts`**: Pure Funktion ohne DB-Zugriff — `generiereBestellkosten()` berechnet alle 5 Kostenkategorien (Ware, Inspektion, Shipping, Zoll, Einlagerung) auf Basis der Stammdaten
- **`src/app/api/bestellplanung/bestellungen/[id]/kosten/route.ts`**: GET (Liste mit aufgelösten Kategorienamen), POST (neuer Manuell-Eintrag, nur bei status='plan')
- **`src/app/api/bestellplanung/bestellungen/[id]/kosten/[kostenId]/route.ts`**: PUT (Eintrag aktualisieren, nur bei status='plan'), DELETE (Eintrag löschen, jeder Status)
- **`src/app/api/bestellplanung/_utils.ts`**: `generiereUndSpeichereBestellkosten()` — lädt alle nötigen Stammdaten, ruft `generiereBestellkosten()` auf, batch-inserted
- Integration in POST `bestellungen/route.ts` und `planbestelllauf/anwenden/route.ts`

### Abweichungen vom Spec
- **Einlagerung**: Die Kategorie "Einlagerung" existiert nicht im Live-KPI-Modell (nur Ware, Zoll, Shipping, Inspektion, Wertverlust Ware als Kinder von "Produkt"). Einlagerung wird bei Generierung still übersprungen, falls keine passende Kategorie gefunden wird — kein Fehler.
- **Timezone-Fix in `addTage()`**: UTC-sichere Datumsberechnung (`T00:00:00Z` + `setUTCDate`) statt lokaler Zeit

### Tests
- `src/lib/bestellkosten-generierung.test.ts`: 15 Tests aller Berechnungsregeln
- `src/app/api/bestellplanung/bestellungen/[id]/kosten/route.test.ts`: 11 Tests (GET + POST)
- `src/app/api/bestellplanung/bestellungen/[id]/kosten/[kostenId]/route.test.ts`: 9 Tests (PUT + DELETE)
- Alle 35 Tests grün

## Frontend Implementation Notes

**Implementiert:** 2026-06-12

### Was gebaut wurde

- **`src/hooks/use-bestellung-kosten.ts`**: Hook mit `kosten`, `loading`, `error`, `add`, `update`, `remove`. Optimistische Updates für update/remove mit automatischem Rollback bei API-Fehler. Daten werden beim Dialog-Öffnen geladen (Component-Mount).
- **`src/components/bestellkosten-tabelle.tsx`**: Inline-Edit-Tabelle mit InlineDatePicker (Popover+Calendar), Kategorie-Select (Kinder von "Produkt" unter ausgaben_kosten), Nettobetrag-Input und Begründung. AlertDialog für Löschbestätigung. Tooltip bei leerem Kategorie-Dropdown. Gesamtsumme-Footer.
- **`src/components/bestellung-detail-dialog.tsx`**: Import und Einbindung von `<BestellkostenTabelle>` nach dem Konsolidierungspartner-Abschnitt, vor dem Notizen-Feld. `readOnly={!isEditable}` — nur Planbestellungen können bearbeitet werden.

### Verhalten
- Alle drei Dialog-Typen (Plan, laufend, abgeschlossen) zeigen die Tabelle
- Nur Planbestellungen haben Edit/Delete-Buttons und "+ Kosteneintrag hinzufügen"
- Kategorie-Dropdown zeigt Kinder der "Produkt"-Kategorie (type: ausgaben_kosten) aus dem KPI-Modell
- Immer nur ein Inline-Formular gleichzeitig (Adding und Editing sind wechselseitig exklusiv)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
