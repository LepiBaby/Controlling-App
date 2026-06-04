# PROJ-59: Produktinformationen — Kurzfristige Planung

## Status: In Progress
**Created:** 2026-06-04
**Last Updated:** 2026-06-04 (Backend)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer
- Requires: PROJ-2 (KPI-Modell Verwaltung) — Produkte (`kpi_categories` mit `type = 'produkte'`, `level = 1`) und SKUs (`level = 2`) müssen bereits gepflegt sein
- Requires: PROJ-41 (Bereichswechsler) — der Bereich „Kurzfristige Planung" muss als URL-Rahmen existieren

## Übersicht

Die Seite „Produktinformationen" fasst alle produktbezogenen Stammdaten für die kurzfristige Planung in einer zentralen Ansicht zusammen. Sie ist über die linke Navigation sowie als Kachel auf der Dashboard-Übersichtsseite des Bereichs „Kurzfristige Planung" erreichbar.

Die Seite besteht aus **7 Tabs** (analog zur KPI-Modell-Verwaltungsseite), zwischen denen der Nutzer frei wechseln kann:

1. **Hersteller** — Hersteller je Produkt verwalten
2. **MOQ** — Mindestbestellmenge je Produkt oder SKU pflegen
3. **Containerkapazität** — Paketmaße je Produkt + globale Containervolumen → automatische Kapazitätsberechnung
4. **Lieferzeit** — Zeiten je Produkt pflegen → automatische Gesamtzeit
5. **Zahlungskonditionen** — Zahlungsanteile in % und Zahlungsziele in Tagen je Produkt
6. **Produktkosten** — Globale Versand-/Inspektions-/Einlagerungskosten je Containerart + Warenkosten & Zollsatz je Produkt
7. **Bestandsverwaltung** — Sicherheitsbestand und Zielreichweite je Produkt

---

## User Stories

### Allgemein
- Als Nutzer möchte ich die Seite „Produktinformationen" über die linke Navigation im Bereich „Kurzfristige Planung" aufrufen können.
- Als Nutzer möchte ich auf der Dashboard-Übersichtsseite von „Kurzfristige Planung" eine Kachel „Produktinformationen" sehen.
- Als Nutzer möchte ich zwischen den 7 Tabs wechseln können, ohne die Seite neu zu laden.
- Als Nutzer möchte ich, dass meine Eingaben beim Verlassen eines Feldes automatisch gespeichert werden (kein manueller Speichern-Button).

### Tab Hersteller
- Als Nutzer möchte ich jedem Produkt einen Hersteller per Dropdown zuordnen können, damit die Beschaffungsquelle hinterlegt ist.
- Als Nutzer möchte ich im Dropdown alle bereits angelegten Hersteller sehen.
- Als Nutzer möchte ich direkt im Dropdown einen neuen Herstellernamen eingeben und bestätigen können, ohne ein separates Formular aufzurufen.

### Tab MOQ
- Als Nutzer möchte ich je Produkt wählen können, ob die MOQ auf Produkt- oder SKU-Ebene gepflegt wird.
- Als Nutzer möchte ich bei Produktebene ein einzelnes MOQ-Feld je Produkt befüllen können.
- Als Nutzer möchte ich bei SKU-Ebene die SKUs durch Aufklappen sehen und dort die MOQ je SKU eingeben.

### Tab Containerkapazität
- Als Nutzer möchte ich das maximale Ladevolumen je Containerart (20DC, 40DC, 40HQ) global hinterlegen, damit Kapazitäten berechnet werden können.
- Als Nutzer möchte ich je Produkt Länge, Breite und Höhe des Pakets in cm eingeben.
- Als Nutzer möchte ich automatisch das Stückvolumen (berechnet aus L × B × H in cm³) angezeigt bekommen.
- Als Nutzer möchte ich automatisch die Maximalkapazität je Containerart (Einheiten) angezeigt bekommen.

### Tab Lieferzeit
- Als Nutzer möchte ich je Produkt Produktionszeit, Zwischenzeit, Shipping-Zeit und Entladungszeit in Tagen eingeben.
- Als Nutzer möchte ich die automatisch berechnete Gesamtlieferzeit angezeigt bekommen.

### Tab Zahlungskonditionen
- Als Nutzer möchte ich je Produkt definieren, wie viel Prozent der Warenkosten vor Produktion, nach Produktion und nach Ankunft gezahlt werden (die drei Werte müssen zusammen 100 % ergeben).
- Als Nutzer möchte ich, sobald alle drei %-Felder befüllt sind, zusätzliche Felder für das Zahlungsziel in Tagen je Phase sehen.

### Tab Produktkosten
- Als Nutzer möchte ich globale Netto-Kosten für Shipping, Inspektion und Einlagerung je Containerart (20DC, 40DC, 40HQ) sowie das jeweilige Zahlungsziel in Tagen hinterlegen.
- Als Nutzer möchte ich das Zahlungsziel für Zollkosten global hinterlegen.
- Als Nutzer möchte ich je Produkt die Warenkosten und den Zollsatz in % pflegen.

### Tab Bestandsverwaltung
- Als Nutzer möchte ich je Produkt den Sicherheitsbestand (Einheiten) und die Zielreichweite in Monaten pflegen.

---

## Acceptance Criteria

### Navigation & Einstieg

- [ ] Die linke Navigation im Bereich „Kurzfristige Planung" enthält den Eintrag „Produktinformationen" → `/dashboard/kurzfristige-planung/produktinformationen`
- [ ] Auf `/dashboard/kurzfristige-planung` erscheint eine Kachel „Produktinformationen", die auf die Seite verlinkt
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Die Seite zeigt 7 Tabs: „Hersteller", „MOQ", „Containerkapazität", „Lieferzeit", „Zahlungskonditionen", „Produktkosten", „Bestandsverwaltung"
- [ ] Beim ersten Laden ist der erste Tab „Hersteller" automatisch aktiv

---

### Tab 1: Hersteller

- [ ] Die Seite zeigt eine Tabelle mit einer Zeile pro Produkt (`kpi_categories` mit `type = 'produkte'`, `level = 1`, sortiert nach `sort_order`)
- [ ] Spalten: **Produkt** (read-only), **Hersteller** (Dropdown)
- [ ] Das Dropdown zeigt alle bereits angelegten Hersteller (alphabetisch sortiert)
- [ ] Ist noch kein Hersteller zugeordnet, zeigt das Dropdown einen leeren Zustand / Platzhalter „Hersteller wählen oder anlegen"
- [ ] Der Nutzer kann im Dropdown-Suchfeld einen neuen Namen eingeben; ist dieser Name noch nicht vorhanden, erscheint die Option „Neu erstellen: [eingegebener Name]"
- [ ] Wählt der Nutzer „Neu erstellen: [Name]", wird der Hersteller angelegt und sofort dem Produkt zugeordnet — kein separates Formular, kein Reload
- [ ] Wählt der Nutzer einen bestehenden Hersteller, wird dieser sofort dem Produkt zugeordnet (Auto-Save)
- [ ] Gibt es keine Produkte im KPI-Modell, erscheint ein Hinweis mit Link zur KPI-Modell-Seite

---

### Tab 2: MOQ

- [ ] Die Seite zeigt eine Tabelle mit einer Zeile pro Produkt
- [ ] Spalten: **Produkt** (read-only), **Ebene** (Radio/Checkbox: „Produkt" | „SKU"), **MOQ**
- [ ] Standardwert für „Ebene" bei neuem Eintrag: „Produkt"
- [ ] Bei Auswahl **Produktebene**: Ein einzelnes Zahlenfeld für die MOQ wird in der Zeile angezeigt (Ganzzahl ≥ 1)
- [ ] Bei Auswahl **SKU-Ebene**: Das MOQ-Feld der Produktzeile wird ausgeblendet; stattdessen erscheint ein Aufklapp-Pfeil in der Produktzeile
- [ ] Nach Klick auf den Pfeil werden alle SKUs des Produkts (`kpi_categories` mit `parent_id = produkt_id`, `level = 2`, sortiert nach `sort_order`) als eingerückte Unterzeilen angezeigt
- [ ] Jede SKU-Unterzeile hat: **SKU-Name** (read-only), **MOQ-Feld** (Ganzzahl ≥ 1)
- [ ] Alle Felder werden bei `onBlur` automatisch gespeichert
- [ ] Gibt es keine Produkte im KPI-Modell, erscheint ein Hinweis mit Link zur KPI-Modell-Seite

---

### Tab 3: Containerkapazität

#### Globale Container-Volumina (oberer Bereich)

- [ ] Oben auf der Seite befindet sich ein Abschnitt „Container-Maximalvolumen" mit drei Feldern:
  - **20DC** (Dezimalzahl, m³, ≥ 0)
  - **40DC** (Dezimalzahl, m³, ≥ 0)
  - **40HQ** (Dezimalzahl, m³, ≥ 0)
- [ ] Die drei Felder werden bei `onBlur` automatisch gespeichert (1 globaler Eintrag pro Nutzer, Upsert)

#### Produkt-Paketmaße und berechnete Kapazitäten (unterer Bereich)

- [ ] Darunter befindet sich eine Tabelle mit einer Zeile pro Produkt
- [ ] Spalten:
  - **Produkt** (read-only)
  - **Länge (cm)** (editierbar, Dezimalzahl ≥ 0)
  - **Breite (cm)** (editierbar, Dezimalzahl ≥ 0)
  - **Höhe (cm)** (editierbar, Dezimalzahl ≥ 0)
  - **Stückvolumen (cm³)** (read-only, automatisch berechnet: L × B × H; wird nur angezeigt wenn alle 3 Maße vorhanden)
  - **Max. 20DC (Stk.)** (read-only, automatisch berechnet: Volumen_20DC_in_cm³ / Stückvolumen, abgerundet; wird nur angezeigt wenn alle 3 Maße und das Container-Volumen vorhanden)
  - **Max. 40DC (Stk.)** (read-only, analog)
  - **Max. 40HQ (Stk.)** (read-only, analog)
- [ ] Berechnete Felder (Stückvolumen, Max.-Kapazitäten) sind nicht vom Nutzer editierbar
- [ ] Paketmaße werden bei `onBlur` automatisch gespeichert
- [ ] Gibt es keine Produkte, erscheint ein Hinweis mit Link zur KPI-Modell-Seite

---

### Tab 4: Lieferzeit

- [ ] Die Seite zeigt eine Tabelle mit einer Zeile pro Produkt
- [ ] Spalten:
  - **Produkt** (read-only)
  - **Produktionszeit (Tage)** (editierbar, Ganzzahl ≥ 0)
  - **Zwischenzeit (Tage)** (editierbar, Ganzzahl ≥ 0)
  - **Shipping-Zeit (Tage)** (editierbar, Ganzzahl ≥ 0)
  - **Entladungszeit (Tage)** (editierbar, Ganzzahl ≥ 0)
  - **Gesamtzeit (Tage)** (read-only, automatisch summiert; wird angezeigt wenn mindestens ein Wert vorhanden)
- [ ] Die Gesamtzeit ist nicht editierbar
- [ ] Alle editierbaren Felder werden bei `onBlur` automatisch gespeichert
- [ ] Gibt es keine Produkte, erscheint ein Hinweis mit Link zur KPI-Modell-Seite

---

### Tab 5: Zahlungskonditionen

- [ ] Die Seite zeigt eine Tabelle mit einer Zeile pro Produkt
- [ ] Basissspalten (immer sichtbar):
  - **Produkt** (read-only)
  - **Vor Produktion (%)** (editierbar, Dezimalzahl 0–100)
  - **Nach Produktion (%)** (editierbar, Dezimalzahl 0–100)
  - **Nach Ankunft (%)** (editierbar, Dezimalzahl 0–100)
- [ ] Solange die Summe der drei %-Felder ≠ 100, erscheint eine Inline-Fehlermeldung in der Zeile: „Die Summe muss 100 % ergeben (aktuell: X %)"
- [ ] Speichern (Auto-Save bei `onBlur`) ist erst möglich, wenn die Summe exakt 100 % beträgt
- [ ] Sind alle drei %-Felder befüllt **und** die Summe = 100, erscheinen zusätzliche Spalten:
  - **Zahlungsziel Vor Produktion (Tage)** (editierbar, Ganzzahl ≥ 0)
  - **Zahlungsziel Nach Produktion (Tage)** (editierbar, Ganzzahl ≥ 0)
  - **Zahlungsziel Nach Ankunft (Tage)** (editierbar, Ganzzahl ≥ 0)
- [ ] Die Zahlungsziel-Spalten sind auch editierbar und werden bei `onBlur` gespeichert
- [ ] Gibt es keine Produkte, erscheint ein Hinweis mit Link zur KPI-Modell-Seite

---

### Tab 6: Produktkosten

#### Globale Kosteneinstellungen (oberer Bereich)

- [ ] Oben auf der Seite befindet sich ein Abschnitt „Globale Kosten- und Zahlungsziel-Einstellungen" mit folgenden Feldern:

  **Shippingkosten (Netto):**
  - Shippingkosten 20DC (€, Dezimalzahl ≥ 0)
  - Shippingkosten 40DC (€, Dezimalzahl ≥ 0)
  - Shippingkosten 40HQ (€, Dezimalzahl ≥ 0)
  - Zahlungsziel Shipping (Tage, Ganzzahl ≥ 0)

  **Inspektionskosten (Netto):**
  - Inspektionskosten 20DC (€, Dezimalzahl ≥ 0)
  - Inspektionskosten 40DC (€, Dezimalzahl ≥ 0)
  - Inspektionskosten 40HQ (€, Dezimalzahl ≥ 0)
  - Zahlungsziel Inspektion (Tage, Ganzzahl ≥ 0)

  **Einlagerungskosten (Netto):**
  - Einlagerungskosten 20DC (€, Dezimalzahl ≥ 0)
  - Einlagerungskosten 40DC (€, Dezimalzahl ≥ 0)
  - Einlagerungskosten 40HQ (€, Dezimalzahl ≥ 0)
  - Zahlungsziel Einlagerung (Tage, Ganzzahl ≥ 0)

  **Zollkosten:**
  - Zahlungsziel Zoll (Tage, Ganzzahl ≥ 0)

- [ ] Alle globalen Felder werden bei `onBlur` automatisch gespeichert (1 globaler Eintrag pro Nutzer, Upsert)

#### Produktspezifische Kosten (unterer Bereich)

- [ ] Darunter befindet sich eine Tabelle mit einer Zeile pro Produkt
- [ ] Spalten:
  - **Produkt** (read-only)
  - **Warenkosten (€)** (editierbar, Dezimalzahl ≥ 0)
  - **Zollsatz (%)** (editierbar, Dezimalzahl 0–100)
- [ ] Felder werden bei `onBlur` automatisch gespeichert
- [ ] Gibt es keine Produkte, erscheint ein Hinweis mit Link zur KPI-Modell-Seite

---

### Tab 7: Bestandsverwaltung

- [ ] Die Seite zeigt eine Tabelle mit einer Zeile pro Produkt
- [ ] Spalten:
  - **Produkt** (read-only)
  - **Sicherheitsbestand (Stk.)** (editierbar, Ganzzahl ≥ 0)
  - **Zielreichweite (Monate)** (editierbar, Dezimalzahl ≥ 0, z. B. 1.5)
- [ ] Felder werden bei `onBlur` automatisch gespeichert
- [ ] Gibt es keine Produkte, erscheint ein Hinweis mit Link zur KPI-Modell-Seite

---

### Datenpersistenz (alle Tabs)

- [ ] Alle Änderungen werden automatisch gespeichert (kein globaler „Speichern"-Button)
- [ ] Optimistische Updates: Änderung erscheint sofort in der UI, wird im Hintergrund gespeichert
- [ ] Bei API-Fehler: Toast-Fehlermeldung, Rollback auf vorherigen Wert
- [ ] Beim nächsten Seitenaufruf sind alle gespeicherten Werte vorbelegt

---

### Datenbankschema

#### Tabelle `produktinformationen_hersteller`
- `id` UUID PK
- `name` TEXT NOT NULL
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`name`, `user_id`)
- RLS: Nutzer sieht und schreibt nur eigene Hersteller

#### Tabelle `produktinformationen_hersteller_zuordnung`
- `id` UUID PK
- `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
- `hersteller_id` UUID NOT NULL FK → `produktinformationen_hersteller` (ON DELETE SET NULL)
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`produkt_id`, `user_id`)
- RLS: Nutzer sieht und schreibt nur eigene Einträge

#### Tabelle `produktinformationen_moq`
- `id` UUID PK
- `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
- `ebene` TEXT NOT NULL CHECK IN ('produkt', 'sku') DEFAULT 'produkt'
- `moq` INTEGER CHECK (≥ 1) — NULL wenn SKU-Ebene
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`produkt_id`, `user_id`)
- RLS: Nutzer sieht und schreibt nur eigene Einträge

#### Tabelle `produktinformationen_moq_sku`
- `id` UUID PK
- `sku_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
- `moq` INTEGER CHECK (≥ 1) — NULL wenn noch nicht gepflegt
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`sku_id`, `user_id`)
- RLS: Nutzer sieht und schreibt nur eigene Einträge

#### Tabelle `produktinformationen_container_global`
- `id` UUID PK
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE) UNIQUE
- `volumen_20dc_m3` DECIMAL(10,4) — NULL wenn noch nicht gepflegt
- `volumen_40dc_m3` DECIMAL(10,4)
- `volumen_40hq_m3` DECIMAL(10,4)
- RLS: Nutzer sieht und schreibt nur eigenen Eintrag

#### Tabelle `produktinformationen_containerkapazitaet`
- `id` UUID PK
- `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
- `laenge_cm` DECIMAL(10,2) — NULL wenn noch nicht gepflegt
- `breite_cm` DECIMAL(10,2)
- `hoehe_cm` DECIMAL(10,2)
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`produkt_id`, `user_id`)
- RLS: Nutzer sieht und schreibt nur eigene Einträge
- Hinweis: Stückvolumen und Max.-Kapazitäten werden clientseitig berechnet und nicht in der DB gespeichert

#### Tabelle `produktinformationen_lieferzeit`
- `id` UUID PK
- `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
- `produktionszeit_tage` INTEGER — NULL wenn noch nicht gepflegt
- `zwischenzeit_tage` INTEGER
- `shipping_zeit_tage` INTEGER
- `entladungszeit_tage` INTEGER
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`produkt_id`, `user_id`)
- RLS: Nutzer sieht und schreibt nur eigene Einträge
- Hinweis: Gesamtzeit wird clientseitig summiert und nicht in der DB gespeichert

#### Tabelle `produktinformationen_zahlungskonditionen`
- `id` UUID PK
- `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
- `vor_produktion_prozent` DECIMAL(5,2) — NULL wenn noch nicht gepflegt
- `nach_produktion_prozent` DECIMAL(5,2)
- `nach_ankunft_prozent` DECIMAL(5,2)
- `zahlungsziel_vor_produktion_tage` INTEGER — NULL wenn noch nicht gepflegt
- `zahlungsziel_nach_produktion_tage` INTEGER
- `zahlungsziel_nach_ankunft_tage` INTEGER
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`produkt_id`, `user_id`)
- RLS: Nutzer sieht und schreibt nur eigene Einträge

#### Tabelle `produktinformationen_kosten_global`
- `id` UUID PK
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE) UNIQUE
- `shipping_kosten_20dc` DECIMAL(10,2)
- `shipping_kosten_40dc` DECIMAL(10,2)
- `shipping_kosten_40hq` DECIMAL(10,2)
- `shipping_zahlungsziel_tage` INTEGER
- `inspektion_kosten_20dc` DECIMAL(10,2)
- `inspektion_kosten_40dc` DECIMAL(10,2)
- `inspektion_kosten_40hq` DECIMAL(10,2)
- `inspektion_zahlungsziel_tage` INTEGER
- `einlagerung_kosten_20dc` DECIMAL(10,2)
- `einlagerung_kosten_40dc` DECIMAL(10,2)
- `einlagerung_kosten_40hq` DECIMAL(10,2)
- `einlagerung_zahlungsziel_tage` INTEGER
- `zoll_zahlungsziel_tage` INTEGER
- RLS: Nutzer sieht und schreibt nur eigenen Eintrag

#### Tabelle `produktinformationen_produktkosten`
- `id` UUID PK
- `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
- `warenkosten` DECIMAL(10,2) — NULL wenn noch nicht gepflegt
- `zollsatz_prozent` DECIMAL(5,2) — NULL wenn noch nicht gepflegt
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`produkt_id`, `user_id`)
- RLS: Nutzer sieht und schreibt nur eigene Einträge

#### Tabelle `produktinformationen_bestandsverwaltung`
- `id` UUID PK
- `produkt_id` UUID NOT NULL FK → `kpi_categories` (ON DELETE CASCADE)
- `sicherheitsbestand` INTEGER — NULL wenn noch nicht gepflegt
- `zielreichweite_monate` DECIMAL(5,2) — NULL wenn noch nicht gepflegt
- `user_id` UUID NOT NULL FK → `auth.users` (ON DELETE CASCADE)
- UNIQUE(`produkt_id`, `user_id`)
- RLS: Nutzer sieht und schreibt nur eigene Einträge

---

### API-Routen

#### Hersteller
- `GET /api/produktinformationen/hersteller` — alle Hersteller des Nutzers (alphabetisch)
- `POST /api/produktinformationen/hersteller` — neuen Hersteller anlegen; Body: `{ name }`; gibt neuen Hersteller zurück
- `GET /api/produktinformationen/hersteller-zuordnung` — alle Hersteller-Zuordnungen des Nutzers
- `PUT /api/produktinformationen/hersteller-zuordnung` — Hersteller einem Produkt zuordnen (Upsert); Body: `{ produkt_id, hersteller_id }`

#### MOQ
- `GET /api/produktinformationen/moq` — alle MOQ-Einstellungen des Nutzers (Produkt- und SKU-Ebene)
- `PUT /api/produktinformationen/moq` — Upsert Produkt-MOQ; Body: `{ produkt_id, ebene, moq? }`
- `PUT /api/produktinformationen/moq-sku` — Upsert SKU-MOQ; Body: `{ sku_id, moq? }`

#### Containerkapazität
- `GET /api/produktinformationen/container-global` — globale Container-Volumina des Nutzers
- `PUT /api/produktinformationen/container-global` — Upsert; Body: `{ volumen_20dc_m3?, volumen_40dc_m3?, volumen_40hq_m3? }`
- `GET /api/produktinformationen/containerkapazitaet` — Paketmaße aller Produkte des Nutzers
- `PUT /api/produktinformationen/containerkapazitaet` — Upsert; Body: `{ produkt_id, laenge_cm?, breite_cm?, hoehe_cm? }`

#### Lieferzeit
- `GET /api/produktinformationen/lieferzeit` — alle Lieferzeiten des Nutzers
- `PUT /api/produktinformationen/lieferzeit` — Upsert; Body: `{ produkt_id, produktionszeit_tage?, zwischenzeit_tage?, shipping_zeit_tage?, entladungszeit_tage? }`

#### Zahlungskonditionen
- `GET /api/produktinformationen/zahlungskonditionen` — alle Zahlungskonditionen des Nutzers
- `PUT /api/produktinformationen/zahlungskonditionen` — Upsert; Body: `{ produkt_id, vor_produktion_prozent?, nach_produktion_prozent?, nach_ankunft_prozent?, zahlungsziel_vor_produktion_tage?, zahlungsziel_nach_produktion_tage?, zahlungsziel_nach_ankunft_tage? }`; Serverseitige Validierung: Wenn alle drei %-Werte gesetzt, Summe = 100

#### Produktkosten
- `GET /api/produktinformationen/kosten-global` — globale Kosteneinstellungen des Nutzers
- `PUT /api/produktinformationen/kosten-global` — Upsert aller globalen Kostenfelder
- `GET /api/produktinformationen/produktkosten` — Warenkosten und Zollsatz aller Produkte des Nutzers
- `PUT /api/produktinformationen/produktkosten` — Upsert; Body: `{ produkt_id, warenkosten?, zollsatz_prozent? }`

#### Bestandsverwaltung
- `GET /api/produktinformationen/bestandsverwaltung` — alle Bestandsverwaltungs-Einstellungen des Nutzers
- `PUT /api/produktinformationen/bestandsverwaltung` — Upsert; Body: `{ produkt_id, sicherheitsbestand?, zielreichweite_monate? }`

---

## Edge Cases

### Allgemein
- **Keine Produkte im KPI-Modell**: Jeder Tab zeigt einen Hinweis mit Link zur KPI-Modell-Seite; keine Tabelle
- **Produkt wird aus KPI-Modell gelöscht**: `ON DELETE CASCADE` entfernt alle zugehörigen Einträge; beim nächsten Seitenaufruf ist die Zeile verschwunden
- **API-Fehler beim Auto-Save**: Toast-Fehlermeldung, Rollback auf vorherigen Wert; Nutzer kann es erneut versuchen

### Tab Hersteller
- **Herstellername bereits vorhanden**: Wird kein doppelter Eintrag angelegt; der bestehende Hersteller wird im Dropdown angezeigt und kann ausgewählt werden
- **Leerer Herstellername**: „Neu erstellen"-Option erscheint nicht; kein API-Aufruf
- **Hersteller wird angelegt, API schlägt fehl**: Toast-Fehlermeldung; Dropdown bleibt beim alten Wert

### Tab MOQ
- **Wechsel von Produktebene auf SKU-Ebene**: Der Produkt-MOQ-Wert wird in der DB auf NULL gesetzt; SKU-MOQ-Felder erscheinen leer
- **Wechsel von SKU-Ebene auf Produktebene**: SKU-MOQs bleiben in der DB erhalten, werden aber nicht mehr angezeigt bis zurückgewechselt wird
- **Produkt hat keine SKUs** (nur level=1, keine level=2-Kinder): Bei SKU-Ebene-Auswahl erscheint eine Meldung „Keine SKUs vorhanden. Bitte zuerst im KPI-Modell SKUs anlegen."

### Tab Containerkapazität
- **Nicht alle 3 Maße vorhanden**: Stückvolumen und Kapazitäten werden als „–" angezeigt (keine Berechnung mit unvollständigen Daten)
- **Container-Volumen noch nicht gepflegt**: Kapazitäten zeigen „–" an; Hinweis-Tooltip: „Bitte zuerst das Container-Maximalvolumen oben eintragen"
- **Stückvolumen = 0**: Division durch 0; Kapazität wird als „–" angezeigt

### Tab Zahlungskonditionen
- **Summe der 3 %-Felder ≠ 100**: Inline-Fehlermeldung; kein API-Aufruf; Zahlungsziel-Spalten bleiben ausgeblendet
- **Nur ein oder zwei %-Felder befüllt**: Zahlungsziel-Spalten bleiben ausgeblendet; keine Fehlermeldung bis alle drei Felder berührt wurden
- **Summe = 100, dann ein Wert geändert, Summe ≠ 100**: Zahlungsziel-Spalten werden ausgeblendet; Fehlermeldung erscheint

### Tab Produktkosten
- **Zollsatz = 0**: Gültiger Wert; keine Fehlermeldung

### Tab Bestandsverwaltung
- **Zielreichweite = 0**: Gültiger Wert; wird gespeichert

---

## Technical Requirements

- Authentifizierung erforderlich: `requireAuth()` in allen API-Routen
- RLS auf allen neuen Tabellen
- Neue Next.js-Seite: `src/app/dashboard/kurzfristige-planung/produktinformationen/page.tsx`
- Navigation erweitert: Eintrag „Produktinformationen" in der Navigationsgruppe „Kurzfristige Planung" in `nav-sheet.tsx`
- Dashboard-Kachel auf `src/app/dashboard/kurzfristige-planung/page.tsx`
- shadcn `Tabs`-Komponente für die 7 Tabs
- shadcn `Table`-Komponente für alle Tabellen
- shadcn `Input`-Komponente für alle Zahleneingaben
- Für den Hersteller-Dropdown: shadcn `Command` + `Popover` (Combobox-Pattern mit freier Texteingabe)
- shadcn `Checkbox` für die MOQ-Ebene-Auswahl (oder `RadioGroup`)
- shadcn `Collapsible` oder einfache `useState`-Logik für die aufklappbaren SKU-Zeilen im MOQ-Tab
- Berechnungen (Stückvolumen, Kapazitäten, Gesamtlieferzeit) erfolgen clientseitig; werden nicht in der DB gespeichert
- Kein Drag-and-Drop nötig (read-only Reihenfolge aus KPI-Modell)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard/kurzfristige-planung  (Landing-Seite — bereits vorhanden)
+-- Kachelraster (bereits vorhanden)
    +-- Kachel "Produktinformationen" (NEU) → /dashboard/kurzfristige-planung/produktinformationen

/dashboard/kurzfristige-planung/produktinformationen  (NEUE Seite)
+-- Page-Header (NavSheet + Seitentitel + LogoutButton — identisch mit allen anderen Einstellungsseiten)
+-- ProduktinformationenTabs  (NEUE Hauptkomponente)
    +-- Tabs [shadcn — 7 Tabs]
        |
        +-- Tab 1: "Hersteller"
        |   +-- HerstellerTabelle
        |       +-- Table [shadcn]
        |           +-- HerstellerZeile je Produkt
        |               +-- Produktname (read-only)
        |               +-- HerstellerCombobox (Command + Popover [shadcn])
        |                   +-- Suchfeld mit freier Texteingabe
        |                   +-- Liste bestehender Hersteller
        |                   +-- Option "Neu erstellen: [Name]" (nur wenn Name nicht existiert)
        |
        +-- Tab 2: "MOQ"
        |   +-- MoqTabelle
        |       +-- Table [shadcn]
        |           +-- MoqZeile je Produkt
        |               +-- Produktname (read-only)
        |               +-- Ebene-Auswahl (RadioGroup [shadcn]: "Produkt" | "SKU")
        |               +-- MOQ-Eingabefeld (nur bei Produktebene)
        |               +-- Aufklapp-Pfeil (nur bei SKU-Ebene, Collapsible [shadcn])
        |                   +-- MoqSkuZeile je SKU (eingerückt, nur aufgeklappt sichtbar)
        |                       +-- SKU-Name (read-only)
        |                       +-- MOQ-Eingabefeld
        |
        +-- Tab 3: "Containerkapazität"
        |   +-- ContainerGlobalFormular  (globale Volumina, Card-Container)
        |       +-- Eingabe: Maximalvolumen 20DC / 40DC / 40HQ in m³
        |   +-- ContainerkapazitaetTabelle
        |       +-- Table [shadcn]
        |           +-- ContainerkapazitaetZeile je Produkt
        |               +-- Produktname (read-only)
        |               +-- Länge / Breite / Höhe in cm (editierbar)
        |               +-- Stückvolumen in cm³ (read-only, clientseitig berechnet: L×B×H)
        |               +-- Max. 20DC / 40DC / 40HQ in Stk. (read-only, clientseitig berechnet)
        |
        +-- Tab 4: "Lieferzeit"
        |   +-- LieferzeitTabelle
        |       +-- Table [shadcn]
        |           +-- LieferzeitZeile je Produkt
        |               +-- Produktname (read-only)
        |               +-- Produktionszeit / Zwischenzeit / Shipping-Zeit / Entladungszeit (editierbar)
        |               +-- Gesamtzeit (read-only, clientseitig summiert)
        |
        +-- Tab 5: "Zahlungskonditionen"
        |   +-- ZahlungskonditionenTabelle
        |       +-- Table [shadcn]
        |           +-- ZahlungskonditionenZeile je Produkt
        |               +-- Produktname (read-only)
        |               +-- Vor Produktion % / Nach Produktion % / Nach Ankunft % (editierbar)
        |               +-- Fehlerzeile "Summe muss 100 % ergeben" (konditionell)
        |               +-- Zahlungsziel Vor Produktion / Nach Produktion / Nach Ankunft
        |                   (nur sichtbar wenn Summe = 100, editierbar)
        |
        +-- Tab 6: "Produktkosten"
        |   +-- ProduktkostenGlobalFormular  (Card-Container)
        |       +-- Shippingkosten 20DC / 40DC / 40HQ + Zahlungsziel Shipping
        |       +-- Inspektionskosten 20DC / 40DC / 40HQ + Zahlungsziel Inspektion
        |       +-- Einlagerungskosten 20DC / 40DC / 40HQ + Zahlungsziel Einlagerung
        |       +-- Zahlungsziel Zoll
        |   +-- ProduktkostenTabelle
        |       +-- Table [shadcn]
        |           +-- ProduktkostenZeile je Produkt
        |               +-- Produktname (read-only)
        |               +-- Warenkosten (€) / Zollsatz (%) (editierbar)
        |
        +-- Tab 7: "Bestandsverwaltung"
            +-- BestandsverwaltungTabelle
                +-- Table [shadcn]
                    +-- BestandsverwaltungZeile je Produkt
                        +-- Produktname (read-only)
                        +-- Sicherheitsbestand (Stk.) / Zielreichweite (Monate) (editierbar)
```

---

### Datenmodell

**9 neue Datenbanktabellen** — alle mit RLS (Nutzer sieht und schreibt nur eigene Daten):

| Tabelle | Zweck | Schlüssel |
|---------|-------|-----------|
| `produktinformationen_hersteller` | Liste aller angelegten Hersteller | `(name, user_id)` UNIQUE |
| `produktinformationen_hersteller_zuordnung` | Welches Produkt hat welchen Hersteller | `(produkt_id, user_id)` UNIQUE, FK zu `kpi_categories` ON DELETE CASCADE, FK zu `hersteller` ON DELETE CASCADE |
| `produktinformationen_moq` | MOQ-Ebene und MOQ-Wert je Produkt | `(produkt_id, user_id)` UNIQUE |
| `produktinformationen_moq_sku` | MOQ-Werte je SKU | `(sku_id, user_id)` UNIQUE |
| `produktinformationen_container_global` | Maximale Containervolumina (global, 1 Eintrag je Nutzer) | `user_id` UNIQUE |
| `produktinformationen_containerkapazitaet` | Paketmaße je Produkt | `(produkt_id, user_id)` UNIQUE |
| `produktinformationen_lieferzeit` | Zeiten je Produkt | `(produkt_id, user_id)` UNIQUE |
| `produktinformationen_zahlungskonditionen` | Zahlungsanteile + -ziele je Produkt | `(produkt_id, user_id)` UNIQUE |
| `produktinformationen_kosten_global` | Globale Kosten- und Zahlungsziel-Einstellungen (1 Eintrag je Nutzer) | `user_id` UNIQUE |
| `produktinformationen_produktkosten` | Warenkosten und Zollsatz je Produkt | `(produkt_id, user_id)` UNIQUE |
| `produktinformationen_bestandsverwaltung` | Sicherheitsbestand und Zielreichweite je Produkt | `(produkt_id, user_id)` UNIQUE |

**Berechnete Werte (nicht in der DB gespeichert):**
- Stückvolumen = Länge × Breite × Höhe (cm³) — clientseitig berechnet
- Max.-Kapazität je Containerart = Containervolumen (in cm³) ÷ Stückvolumen, abgerundet — clientseitig
- Gesamtlieferzeit = Summe aller 4 Zeitfelder — clientseitig summiert

---

### Datenfluss

```
Seite öffnet sich
  → Alle Produkte (kpi_categories, type=produkte, level=1) werden geladen
  → Tab "Hersteller" ist aktiv; Hook lädt alle Hersteller + alle Hersteller-Zuordnungen
  → Jeder Tab-Wechsel lädt die Daten des neuen Tabs (lazy, nur beim ersten Aktivieren)

Nutzer ändert einen Wert (editierbares Feld)
  → Optimistisches Update: Wert erscheint sofort in der UI
  → onBlur → Validierung prüft Eingabe (Wertebereich, Summe, etc.)
  → Gültig → PUT/POST an die zuständige API-Route
  → API-Fehler → Toast "Konnte nicht gespeichert werden.", Rollback auf vorherigen Wert

Tab "Hersteller" — Combobox
  → Nutzer tippt Namen → Command-Komponente filtert bestehende Hersteller live
  → Name existiert nicht → Option "Neu erstellen: [Name]" erscheint
  → Klick auf "Neu erstellen" → POST Hersteller anlegen, dann PUT Zuordnung setzen
  → Klick auf bestehenden Hersteller → PUT Zuordnung setzen (Upsert)

Tab "MOQ" — Ebene wechseln
  → Wechsel auf SKU → PUT setzt Produkt-MOQ auf NULL; SKU-Zeilen aufklappbar
  → Wechsel auf Produkt → PUT setzt Ebene zurück; SKU-MOQs bleiben in DB erhalten

Tab "Containerkapazität"
  → Nutzer ändert ein Maß → Stückvolumen und Kapazitäten werden sofort clientseitig neu berechnet
  → onBlur → Speichern per API

Tab "Zahlungskonditionen"
  → Nutzer ändert einen %-Wert → Summe wird clientseitig geprüft
  → Summe ≠ 100 → Fehlermeldung, kein API-Aufruf, Zahlungsziel-Spalten ausgeblendet
  → Summe = 100 → Zahlungsziel-Spalten erscheinen; onBlur → Speichern
```

---

### API-Endpunkte (Übersicht)

Alle unter dem Präfix `/api/produktinformationen/`:

| Route | Methoden | Zweck |
|-------|----------|-------|
| `hersteller` | GET, POST | Liste laden / neuen Hersteller anlegen |
| `hersteller-zuordnung` | GET, PUT | Zuordnungen laden / Hersteller einem Produkt zuordnen (Upsert) |
| `moq` | GET, PUT | Produkt-MOQ-Einstellungen laden / speichern (Upsert) |
| `moq-sku` | PUT | SKU-MOQ speichern (Upsert) |
| `container-global` | GET, PUT | Globale Containervolumina laden / speichern (Upsert) |
| `containerkapazitaet` | GET, PUT | Paketmaße laden / speichern (Upsert) |
| `lieferzeit` | GET, PUT | Lieferzeiten laden / speichern (Upsert) |
| `zahlungskonditionen` | GET, PUT | Zahlungskonditionen laden / speichern (Upsert) |
| `kosten-global` | GET, PUT | Globale Kosteneinstellungen laden / speichern (Upsert) |
| `produktkosten` | GET, PUT | Warenkosten + Zollsatz laden / speichern (Upsert) |
| `bestandsverwaltung` | GET, PUT | Bestandseinstellungen laden / speichern (Upsert) |

Alle Routen: `requireAuth()` + Zod-Validierung der Eingaben.

---

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `src/app/dashboard/kurzfristige-planung/produktinformationen/page.tsx` | Neue Seite (Client Component, Header + ProduktinformationenTabs) |
| `src/components/produktinformationen-tabs.tsx` | Hauptkomponente: 7 Tabs + alle Tab-Inhalte |
| `src/hooks/use-produktinformationen-hersteller.ts` | State: Hersteller-Liste + Zuordnungen laden, Hersteller anlegen, Zuordnung upsert |
| `src/hooks/use-produktinformationen-moq.ts` | State: MOQ (Produkt + SKU) laden, Ebene wechseln, MOQ upsert |
| `src/hooks/use-produktinformationen-container.ts` | State: Containervolumina global + Paketmaße je Produkt laden + upsert |
| `src/hooks/use-produktinformationen-lieferzeit.ts` | State: Lieferzeiten laden + upsert |
| `src/hooks/use-produktinformationen-zahlungskonditionen.ts` | State: Zahlungskonditionen laden + upsert (inkl. Summen-Validierung) |
| `src/hooks/use-produktinformationen-produktkosten.ts` | State: Globale Kosten + Produktkosten laden + upsert |
| `src/hooks/use-produktinformationen-bestandsverwaltung.ts` | State: Bestandseinstellungen laden + upsert |
| `src/app/api/produktinformationen/hersteller/route.ts` | GET + POST |
| `src/app/api/produktinformationen/hersteller-zuordnung/route.ts` | GET + PUT |
| `src/app/api/produktinformationen/moq/route.ts` | GET + PUT |
| `src/app/api/produktinformationen/moq-sku/route.ts` | PUT |
| `src/app/api/produktinformationen/container-global/route.ts` | GET + PUT |
| `src/app/api/produktinformationen/containerkapazitaet/route.ts` | GET + PUT |
| `src/app/api/produktinformationen/lieferzeit/route.ts` | GET + PUT |
| `src/app/api/produktinformationen/zahlungskonditionen/route.ts` | GET + PUT |
| `src/app/api/produktinformationen/kosten-global/route.ts` | GET + PUT |
| `src/app/api/produktinformationen/produktkosten/route.ts` | GET + PUT |
| `src/app/api/produktinformationen/bestandsverwaltung/route.ts` | GET + PUT |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/nav-sheet.tsx` | Eintrag „Produktinformationen" → `/dashboard/kurzfristige-planung/produktinformationen` in `KURZFRISTIGE_PLANUNG_NAV_GROUPS` ergänzen |
| `src/app/dashboard/kurzfristige-planung/page.tsx` | Neue Kachel „Produktinformationen" im Kachelraster ergänzen |

---

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Eine Seite mit 7 Tabs | Ja | Alle Daten beziehen sich auf dieselben Produkte aus dem KPI-Modell; eine Seite vermeidet Kontextwechsel |
| Berechnungen clientseitig | Ja | Stückvolumen, Kapazitäten und Gesamtzeit sind rein mathematische Ableitungen — keine Persistenz nötig, kein Server-Roundtrip erforderlich |
| Hersteller-Combobox (Command + Popover) | Ja | Erlaubt freie Texteingabe mit gleichzeitiger Suche und Inline-Anlage; bereits im Projekt vorhanden (`src/components/ui/command.tsx`) |
| Separate API-Route je Tab-Thema | Ja | Hält jede Route klein und fokussiert; vereinfacht Zod-Validierung und Tests; folgt dem bestehenden Muster im Projekt |
| SKU-Aufklappen via Collapsible | Ja | Bereits installiert (`src/components/ui/collapsible.tsx`); kein zusätzliches Package nötig |
| 9 separate DB-Tabellen statt 1 große | Ja | Jede Tabelle hat unterschiedliche Felder und Schreibmuster; vermeidet NULL-Spalten in einer breiten Tabelle; leichtere Erweiterbarkeit je Bereich |
| Neue Packages | Keine | Alle benötigten shadcn-Komponenten bereits installiert (Tabs, Table, Input, Command, Popover, Collapsible, RadioGroup, Checkbox) |

## Implementation Notes (Frontend — 2026-06-04)

### Neue Dateien
- `src/hooks/use-produktinformationen-hersteller.ts` — Typen `Hersteller`, `HerstellerZuordnung`; Hook `useProduktinformationenHersteller()` mit Laden beider Endpoints, `getZuordnung()`, `createAndAssign()`, `assignHersteller()` mit optimistischem Update + Rollback
- `src/hooks/use-produktinformationen-moq.ts` — Typen `MoqEbene`, `MoqEinstellung`, `MoqSkuEinstellung`; Hook mit getrennten States für Produkt-MOQ und SKU-MOQ, `getMoqEinstellung()`, `getMoqSkuEinstellung()`, `upsertMoq()`, `upsertMoqSku()`
- `src/hooks/use-produktinformationen-container.ts` — Typen + Hilfsfunktionen `berechneStueckvolumen()`, `berechneMaxKapazitaet()`; Hook mit globalem ContainerVolumen + Paketmaßen, `getKapazitaet()`, `upsertContainerGlobal()`, `upsertKapazitaet()`
- `src/hooks/use-produktinformationen-lieferzeit.ts` — Typ `Lieferzeit`; Hilfsfunktion `berechneGesamtzeit()`; Hook mit `getLieferzeit()`, `upsert()`
- `src/hooks/use-produktinformationen-zahlungskonditionen.ts` — Typ `Zahlungskonditionen`; Hilfsfunktionen `isProzentSummeGueltig()`, `alleProzentGesetzt()`; Hook mit `getKonditionen()`, `upsert()`
- `src/hooks/use-produktinformationen-produktkosten.ts` — Typen `KostenGlobal`, `Produktkosten`; Hook mit globalem und produktspezifischem State, `getProduktkosten()`, `upsertKostenGlobal()`, `upsertProduktkosten()`
- `src/hooks/use-produktinformationen-bestandsverwaltung.ts` — Typ `BestandsverwaltungEinstellung`; Hook mit `getEinstellung()`, `upsert()`
- `src/components/produktinformationen-tabs.tsx` — Alle 7 Tab-Komponenten in einer Datei; `ProduktinformationenTabs` als Export; Combobox-Pattern (Command + Popover) für Hersteller-Tab; aufklappbare SKU-Zeilen für MOQ-Tab; clientseitige Berechnung für Container- und Lieferzeit-Tab; konditionelle Zahlungsziel-Spalten für Zahlungskonditionen-Tab; Card-Formulare für globale Einstellungen in Container- und Produktkosten-Tab
- `src/app/dashboard/kurzfristige-planung/produktinformationen/page.tsx` — Client Component, Header + `ProduktinformationenTabs` + `Toaster`

### Geänderte Dateien
- `src/components/nav-sheet.tsx` — Eintrag „Produktinformationen" → `/dashboard/kurzfristige-planung/produktinformationen` in `KURZFRISTIGE_PLANUNG_NAV_GROUPS` ergänzt
- `src/app/dashboard/kurzfristige-planung/page.tsx` — Kachel „Produktinformationen" im Einstellungs-Grid ergänzt

### Build
- `npm run build` ✅ — Route `/dashboard/kurzfristige-planung/produktinformationen` korrekt in der Build-Ausgabe, keine TypeScript-Fehler

## Implementation Notes (Backend)

### Supabase Migration
Alle 11 Tabellen in einer Migration `proj_59_produktinformationen` erstellt:
- `produktinformationen_hersteller` — Hersteller-Stammdaten mit `UNIQUE(user_id, name)`
- `produktinformationen_hersteller_zuordnung` — Hersteller→Produkt-Zuordnung mit `UNIQUE(user_id, produkt_id)`
- `produktinformationen_moq` — MOQ auf Produktebene mit enum-Check `('produkt', 'sku')`
- `produktinformationen_moq_sku` — MOQ auf SKU-Ebene
- `produktinformationen_container_global` — Globale Containervolumen mit `UNIQUE(user_id)`
- `produktinformationen_containerkapazitaet` — Paketmaße je Produkt
- `produktinformationen_lieferzeit` — Lieferzeiten je Produkt
- `produktinformationen_zahlungskonditionen` — Zahlungskonditionen je Produkt
- `produktinformationen_kosten_global` — Globale Kosten-Stammdaten mit `UNIQUE(user_id)`
- `produktinformationen_produktkosten` — Warenkosten & Zollsatz je Produkt
- `produktinformationen_bestandsverwaltung` — Sicherheitsbestand & Zielreichweite je Produkt

Alle Tabellen: RLS aktiviert, ALL-Policy `auth.uid() = user_id`, Indexes auf `user_id` und `produkt_id`/`sku_id`.

### API Routes (11 Routen)
Alle unter `src/app/api/produktinformationen/`:
- `hersteller/` — GET (Liste), POST (Erstellen, 409 bei Duplikat)
- `hersteller-zuordnung/` — GET, PUT (Upsert, `hersteller_id` nullable)
- `moq/` — GET, PUT (Upsert, `ebene` enum validation)
- `moq-sku/` — GET, PUT (Upsert)
- `container-global/` — GET (`maybeSingle`), PUT (Upsert `onConflict: user_id`)
- `containerkapazitaet/` — GET, PUT (Upsert)
- `lieferzeit/` — GET, PUT (Upsert)
- `zahlungskonditionen/` — GET, PUT (Upsert)
- `kosten-global/` — GET (`maybeSingle`), PUT (Upsert `onConflict: user_id`)
- `produktkosten/` — GET, PUT (Upsert)
- `bestandsverwaltung/` — GET, PUT (Upsert)

Pattern: `requireAuth()` → `{ user, supabase, error }`, Zod-Validierung, Upsert mit `onConflict`.

### Tests
- 11 Testdateien, 84 Tests — alle bestanden ✅
- Happy path, Validation (400), Auth (401), DB-Fehler (500) je Route

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
