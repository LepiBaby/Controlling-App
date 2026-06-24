# PROJ-62: Erstplanbestellung anlegen — Kurzfristige Planung

## Status: In Review
**Created:** 2026-06-10
**Last Updated:** 2026-06-10

## Implementation Notes (Frontend)
- **Neue Komponente**: `src/components/erstplanbestellung-dialog.tsx` — Dialog mit Produktauswahl, 6 Datumsfeldern (kaskadierend), SKU-Mengen-Tabelle, optionaler Konsolidierung und Notizfeld
- **Cascade-Logik**: Clientseitig als pure Funktion `cascadeFrom()` implementiert; `manualFlags` Set trackt manuell überschriebene Felder
- **Stammdaten-Laden**: 6 parallele Fetches beim Dialog-Öffnen (kpi-categories, lieferzeit, moq, moq-sku, hersteller-zuordnung, bestehende Planbestellungen)
- **Bestellplanung-Tabelle**: Button „Erstplanbestellung anlegen" + „Manuell"-Badge ergänzt
- **`herkunft` Feld**: In `Bestellung` Type als optional hinzugefügt; Badge-Rendering bereit — sichtbar nach Backend-Migration
- **Backend (fertig)**: DB-Migration + alle API-Routen aktualisiert (siehe unten)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Produkte (`level = 1`) und SKUs (`level = 2`)
- Requires: PROJ-59 (Produktinformationen) — Lieferzeit, MOQ als Vorausfüllung
- Requires: PROJ-60 (Bestellplanung) — bestehende Bestellplanung-Seite, DB-Schema und API-Endpunkte

---

## Übersicht

Auf der Seite „Bestellplanung" (PROJ-60), im Tab „Planbestellungen", erscheint neben dem bestehenden Button „Planbestelllauf durchführen" ein neuer Button **„Erstplanbestellung anlegen"**.

Dieser Button deckt den Sonderfall ab, dass ein **neues Produkt** zum allerersten Mal bestellt wird: Es existieren noch keine historischen Absatzzahlen, kein Lagerbestand und keine weiteren Grundlagedaten, auf die der Planbestelllauf-Algorithmus zurückgreifen könnte. Der Nutzer legt in einem klassischen Formular-Dialog alle Felder manuell an — dieselben Felder, die der Algorithmus ansonsten automatisch befüllen würde.

**Automatische Vorausfüllung aus Stammdaten:**  
Sind für das ausgewählte Produkt Lieferzeit-Daten in den Produktinformationen gepflegt, werden die 5 abhängigen Datumsfelder automatisch aus dem Bestelldatum + den Lieferzeit-Komponenten berechnet und vorausgefüllt. SKU-Mengen werden mit dem hinterlegten MOQ vorausgefüllt.

**Kaskadierende Datumsberechnung:**  
Ändert der Nutzer ein Datumsfeld, werden alle nachfolgenden Felder (die noch den automatisch berechneten Wert haben) entsprechend neu berechnet.

**Kennzeichnung in der Tabelle:**  
Manuell angelegte Bestellungen erhalten in der Planbestellungen-Tabelle ein Badge „Manuell", damit die Herkunft klar erkennbar ist.

---

## User Stories

- Als Nutzer möchte ich im Tab „Planbestellungen" neben dem „Planbestelllauf durchführen"-Button einen Button „Erstplanbestellung anlegen" sehen, damit ich eine erste manuelle Bestellung für ein neues Produkt anlegen kann, ohne auf Algorithmus-Daten angewiesen zu sein.
- Als Nutzer möchte ich in einem Formular-Dialog ein Produkt aus einem Dropdown auswählen, damit nur die relevanten SKUs und Stammdaten geladen werden.
- Als Nutzer möchte ich nach der Produktauswahl alle Datumsfelder automatisch berechnet bekommen (sofern Lieferzeit-Stammdaten gepflegt sind), damit ich nicht alles von Hand ausrechnen muss.
- Als Nutzer möchte ich, dass beim Ändern eines Datumsfelds alle nachfolgenden Felder automatisch angepasst werden (kaskadierend), damit die Zeitlogik erhalten bleibt.
- Als Nutzer möchte ich alle 6 Datumsfelder jederzeit manuell überschreiben können.
- Als Nutzer möchte ich pro SKU des gewählten Produkts ein Mengenfeld sehen, vorausgefüllt mit dem hinterlegten MOQ.
- Als Nutzer möchte ich optional eine Konsolidierung mit einer bestehenden Planbestellung desselben Herstellers angeben können.
- Als Nutzer möchte ich optional eine Notiz zur Bestellung hinterlegen können.
- Als Nutzer möchte ich manuell angelegte Bestellungen in der Tabelle mit einem Badge „Manuell" von Algorithmus-Bestellungen unterscheiden können.
- Als Nutzer möchte ich nach dem Anlegen eine Toast-Bestätigung sehen und die Bestellung sofort in der Tabelle finden.

---

## Acceptance Criteria

### Button & Dialog-Öffnung

- [ ] Im Tab „Planbestellungen" ist neben dem Button „Planbestelllauf durchführen" ein Button „Erstplanbestellung anlegen" sichtbar
- [ ] Klick auf den Button öffnet einen Dialog (shadcn `Dialog`)
- [ ] Der Dialog hat den Titel „Erstplanbestellung anlegen"
- [ ] Der Dialog enthält einen „Abbrechen"-Button, der den Dialog ohne Änderungen schließt

### Produktauswahl

- [ ] Das Formular enthält ein Pflicht-Dropdown „Produkt" mit allen verfügbaren Produkten (aus `kpi_categories` mit `type = 'produkte'`, `level = 1`, sortiert nach `sort_order`)
- [ ] Bevor ein Produkt ausgewählt wurde, sind alle anderen Felder ausgeblendet oder deaktiviert
- [ ] Nach Produktauswahl werden die SKUs des Produkts geladen und als Mengenzeilen angezeigt
- [ ] Nach Produktauswahl werden — sofern vorhanden — Lieferzeit- und MOQ-Stammdaten geladen und zur Vorausfüllung genutzt

### Datumsfelder (6 Felder)

- [ ] Das Formular enthält folgende 6 Datumsfelder: Bestelldatum (Pflicht), Produktionsstart, Produktionsende, Shippingdatum, Ankunftsdatum, Verfügbarkeitsdatum
- [ ] Bestelldatum ist standardmäßig auf das heutige Datum vorausgefüllt
- [ ] Sind für das gewählte Produkt Lieferzeit-Stammdaten gepflegt (`produktinformationen_lieferzeit`), werden die 5 abhängigen Felder beim Laden des Produkts automatisch berechnet:
  - Produktionsstart = Bestelldatum + Zwischenzeit (Tage)
  - Produktionsende = Produktionsstart + Produktionszeit (Tage)
  - Shippingdatum = Produktionsende (direkt nach Produktion, kein zusätzlicher Puffer)
  - Ankunftsdatum = Shippingdatum + Shipping-Zeit (Tage)
  - Verfügbarkeitsdatum = Ankunftsdatum + Entladungszeit (Tage)
- [ ] **Kaskadierende Neuberechnung:** Ändert der Nutzer ein Datumsfeld, werden alle nachfolgenden Felder automatisch neu berechnet (sofern sie noch den berechneten Wert tragen; manuell überschriebene Felder behalten ihren Wert)
- [ ] Alle 6 Datumsfelder sind manuell editierbar (DatePicker via Calendar + Popover — shadcn)
- [ ] Fehlen Lieferzeit-Stammdaten für das gewählte Produkt: Felder 2–6 bleiben leer, Nutzer muss manuell befüllen; ein Info-Hinweis erscheint: „Keine Lieferzeit-Stammdaten vorhanden — bitte alle Daten manuell eingeben"
- [ ] Ein Link im Info-Hinweis führt zur Seite „Produktinformationen → Tab Lieferzeit"

### SKU-Mengen

- [ ] Nach Produktauswahl erscheint pro SKU des Produkts eine Zeile mit SKU-Name und einem Mengenfeld (Ganzzahl ≥ 0)
- [ ] Sind MOQ-Stammdaten für die SKU / das Produkt gepflegt (`produktinformationen_moq`), wird das Mengenfeld mit dem MOQ-Wert vorausgefüllt
- [ ] Fehlt ein MOQ-Wert, startet das Mengenfeld leer (Nutzer muss eingeben)
- [ ] `menge_theoretisch` wird als NULL gespeichert (keine Algorithmus-Schätzung für Erstbestellung)
- [ ] Mindestens eine SKU muss eine Menge > 0 haben (Validierung beim Speichern)

### Konsolidierung (optional)

- [ ] Das Formular enthält einen optionalen Bereich „Konsolidierung mit bestehender Planbestellung"
- [ ] Das Dropdown zeigt nur bestehende Planbestellungen, deren Produkt(e) denselben Hersteller haben wie das gewählte Produkt (aus `produktinformationen_hersteller_zuordnung`)
- [ ] Ist kein passender Hersteller gepflegt oder gibt es keine passenden Planbestellungen, ist der Bereich ausgegraut mit Hinweis
- [ ] Wird eine Konsolidierungs-Bestellung ausgewählt, erscheint ein Dropdown für die Containerart (20DC, 40DC, 40HQ)
- [ ] Die Konsolidierungsverknüpfung wird beim Speichern in `bestellungen_konsolidierungen` angelegt

### Notizen (optional)

- [ ] Das Formular enthält ein optionales Textfeld „Notizen" (mehrzeilig)

### Kennzeichnung in der Tabelle

- [ ] Manuell angelegte Bestellungen (Herkunft = `manuell`) erhalten in der Spalte der Planbestellungen-Tabelle ein Badge „Manuell"
- [ ] Das Badge unterscheidet sich optisch von algorithmus-erstellten Einträgen (kein Badge oder anderes Badge)
- [ ] Die DB-Tabelle `bestellungen` erhält eine neue Spalte `herkunft TEXT CHECK (herkunft IN ('algorithmus', 'manuell'))` (Migration erforderlich)
- [ ] Bestehende Einträge erhalten `herkunft = 'algorithmus'` als Default-Wert

### Speichern & Fehlerbehandlung

- [ ] Der „Anlegen"-Button ist deaktiviert, solange kein Produkt ausgewählt ist
- [ ] Beim Speichern wird validiert: Produkt ausgewählt ✓, Bestelldatum gesetzt ✓, mindestens eine SKU-Menge > 0 ✓
- [ ] Bei Validierungsfehler werden betroffene Felder rot markiert mit Fehlermeldung unterhalb
- [ ] Nach erfolgreichem Anlegen: Dialog schließt sich, Toast-Bestätigung „Erstplanbestellung wurde angelegt", Planbestellungen-Tabelle wird neu geladen
- [ ] Die Bestellung wird mit Status `plan` und `herkunft = 'manuell'` angelegt
- [ ] Die Bestellung wird über den bestehenden `POST /api/bestellplanung/bestellungen` Endpunkt angelegt (kein neuer Endpunkt nötig; Endpunkt wird um `herkunft`-Feld ergänzt)
- [ ] Bei Server-Fehler: Toast-Fehlermeldung, Dialog bleibt offen, Eingaben bleiben erhalten

---

## Edge Cases

- **Produkt hat keine SKUs**: Nach Produktauswahl erscheint eine Fehlermeldung „Dieses Produkt hat keine SKUs. Bitte zuerst SKUs im KPI-Modell anlegen." — Anlegen-Button bleibt deaktiviert
- **Keine Lieferzeit-Stammdaten gepflegt**: Felder 2–6 bleiben leer, Info-Hinweis mit Link zu Produktinformationen erscheint; Nutzer kann trotzdem Bestellung anlegen, wenn er alle Felder manuell befüllt
- **Kein MOQ gepflegt**: Mengenfelder starten leer — keine Vorausfüllung; kein Blocker
- **Kaskadierende Datumsberechnung bei Änderung eines Zwischenfelds**: Ändert Nutzer z.B. Produktionsstart, werden Produktionsende, Shippingdatum, Ankunftsdatum, Verfügbarkeitsdatum neu berechnet. Felder, die der Nutzer davor manuell überschrieben hat, bleiben unberührt
- **Bestelldatum liegt in der Vergangenheit**: Erlaubt — keine Warnung; manuelle Eingabe bleibt uneingeschränkt
- **Produkt bereits mit bestehenden Bestellungen vorhanden (plan/laufend/abgeschlossen)**: Produkt erscheint nicht im Dropdown — Erstplanbestellung ist nur für Produkte ohne jegliche Bestellung möglich
- **Hersteller für gewähltes Produkt nicht gepflegt**: Konsolidierungsbereich zeigt Hinweis „Kein Hersteller hinterlegt — Konsolidierung nicht möglich"; Rest des Formulars bleibt nutzbar
- **Abbruch ohne Speichern**: Dialog schließt sich, alle Eingaben verworfen, keine DB-Änderung

---

## Technical Requirements

- Authentifizierung: Zugang über bestehende Auth-Guard-Logik der Bestellplanung-Seite
- **DB-Migration**: Neue Spalte `herkunft TEXT CHECK (herkunft IN ('algorithmus', 'manuell'))` in `bestellungen`; bestehende Zeilen erhalten `herkunft = 'algorithmus'` als Default
- **Kein neuer API-Endpunkt**: Bestehender `POST /api/bestellplanung/bestellungen` wird um das Feld `herkunft` ergänzt; bestehender `GET`-Endpunkt gibt `herkunft` zurück
- **Neue Komponente**: `src/components/erstplanbestellung-dialog.tsx` — Dialog mit Formular, Produktauswahl, Datumsfelder, SKU-Mengen, optionaler Konsolidierung
- **Kaskadierende Datumslogik**: Clientseitige pure Funktion (`addDays` aus `date-fns` / nativem JS); keine Server-Requests für Berechnungen
- **Stammdaten-Laden**: Lieferzeit via `GET /api/produktinformationen/lieferzeit`, MOQ via `GET /api/produktinformationen/moq` — beide bereits vorhanden aus PROJ-59
- **DatePicker**: Calendar + Popover (shadcn, bereits installiert) — konsistent mit Planbestelllauf-Wizard
- **Badge**: shadcn `Badge`-Komponente in der Planbestellungen-Tabelle (`bestellplanung-tabelle.tsx`)
- Bestehende Hooks und Typen aus PROJ-60 werden erweitert (nicht neu gebaut)

---

## Implementation Notes (Backend)
- **DB Migration**: `ALTER TABLE bestellungen ADD COLUMN herkunft TEXT CHECK (herkunft IN ('algorithmus', 'manuell')) DEFAULT 'algorithmus'`; bestehende Zeilen erhalten `'algorithmus'` durch Default
- **`_utils.ts`**: `herkunft` in `FullBestellung` Interface ergänzt
- **`GET /api/bestellplanung/bestellungen`**: SELECT um `herkunft` erweitert
- **`POST /api/bestellplanung/bestellungen`**: Zod-Schema + INSERT um `herkunft` erweitert (Default `'algorithmus'`)
- **`GET|PUT /api/bestellplanung/bestellungen/[id]`**: SELECT um `herkunft` erweitert
- **`POST /api/bestellplanung/planbestelllauf/anwenden`**: INSERT setzt explizit `herkunft: 'algorithmus'` für Algorithmus-Bestellungen
- **Tests**: 23 Unit Tests passing (2 neue Tests für `herkunft='manuell'` und `herkunft='ungueltig'`)

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

**QA Datum:** 2026-06-10
**Tester:** Claude QA Engineer
**Status: APPROVED — keine Critical/High Bugs**

### Automatisierte Tests
- **Vitest Unit/Integration:** 33/33 ✅ (`src/app/api/bestellplanung/**`)
- **Playwright E2E:** 8/8 ✅ (`tests/PROJ-62-erstplanbestellung.spec.ts`)

### Acceptance Criteria

| Kriterium | Status |
|-----------|--------|
| Button "Erstplanbestellung anlegen" neben "Planbestelllauf durchführen" | ✅ Pass |
| Klick öffnet Dialog mit korrektem Titel | ✅ Pass |
| "Abbrechen"-Button schließt Dialog | ✅ Pass |
| Produktdropdown zeigt nur Produkte ohne bestehende Bestellungen | ✅ Pass |
| Leerer Zustand: korrekte Meldung je nach Ursache | ✅ Pass |
| Felder vor Produktauswahl ausgeblendet | ✅ Pass |
| Bestelldatum = heute vorausgefüllt | ✅ Pass |
| Datumsfelder aus Lieferzeit-Stammdaten berechnet | ✅ Pass |
| Kaskadierende Neuberechnung bei Datumsänderung | ✅ Pass |
| Manuell gesetzte Felder werden nicht überschrieben | ✅ Pass |
| Info-Hinweis wenn keine Lieferzeit-Stammdaten | ✅ Pass |
| SKU-Mengenzeilen mit MOQ-Vorausfüllung | ✅ Pass |
| Gesamtsumme unter SKU-Tabelle (live) | ✅ Pass |
| Containerart-Dropdown (20DC / 40HQ) als Pflichtfeld | ✅ Pass |
| Konsolidierungs-Abschnitt nach Hersteller gefiltert | ✅ Pass |
| Optionales Notizfeld | ✅ Pass |
| Anlegen-Button deaktiviert ohne Produkt | ✅ Pass |
| Validierung mit Fehlermeldungen | ✅ Pass |
| Toast-Bestätigung + Dialog schließt + Tabelle lädt neu | ✅ Pass |
| herkunft=manuell in DB gespeichert | ✅ Pass |
| containerart in DB gespeichert | ✅ Pass |
| "Manuell"-Badge in Planbestellungen-Tabelle | ✅ Pass |

### Edge Cases

| Edge Case | Status |
|-----------|--------|
| Produkt ohne SKUs: Fehlermeldung, Button bleibt deaktiviert | ✅ Pass |
| Keine Lieferzeit-Stammdaten: Felder leer + Info-Hinweis | ✅ Pass |
| Kein MOQ gepflegt: Mengenfelder leer | ✅ Pass |
| Hersteller nicht gepflegt: Konsolidierung nicht möglich | ✅ Pass |
| Alle Produkte haben Bestellungen: korrekte Meldung im Dropdown | ✅ Pass |
| Abbruch ohne Speichern: keine DB-Änderung | ✅ Pass |

### Bugs

| # | Schwere | Beschreibung |
|---|---------|--------------|
| 1 | Low | Im Konsolidierungs-Containerart-Dropdown erscheint 40DC als Option, obwohl das Haupt-Containerart-Dropdown nur 20DC/40HQ anbietet. Inkonsistent, kein Blocker. |

### Security Audit
- ✅ Auth-Guard: API gibt 401 ohne Session
- ✅ `user_id` serverseitig aus Auth-Session, nicht aus Request-Body
- ✅ DB-CHECK-Constraint auf `containerart` und `herkunft`
- ✅ Zod-Validierung auf allen POST-Feldern
- ✅ RLS via bestehende `bestellungen`-Policy

### Produktions-Empfehlung: **READY** ✅
Keine Critical/High Bugs. Low-Bug #1 (40DC in Konsolidierungs-Dropdown) kann in einem Folge-Sprint behoben werden.

## Deployment
_To be added by /deploy_
