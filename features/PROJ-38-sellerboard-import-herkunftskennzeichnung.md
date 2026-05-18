# PROJ-38: Sellerboard-Import-Herkunftskennzeichnung & Filter in Ausgaben-Tabelle

## Status: Architected
**Created:** 2026-05-18
**Last Updated:** 2026-05-18

## Dependencies
- Requires: PROJ-37 (Sellerboard Excel-Import) — der Import-Wizard setzt das neue Feld beim Speichern
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen Eingabe) — betrifft die Ausgaben-Tabelle und deren Datenmodell

---

## Übersicht

Transaktionen, die über den Sellerboard Excel-Import (PROJ-37) in `ausgaben_kosten_transaktionen` gespeichert werden, erhalten ein neues Datenbankfeld `import_source = 'sellerboard'`. Manuell erfasste oder über andere Wege importierte Transaktionen haben `import_source = null`.

In der Ausgaben & Kosten-Tabelle erscheint oberhalb der Tabelle ein **Toggle-Filter „Sellerboard-Import ausblenden"**. Wenn aktiv, werden alle Transaktionen mit `import_source = 'sellerboard'` aus der Tabellenansicht herausgefiltert. Das Feld selbst wird in keiner Spalte der Tabelle angezeigt.

---

## User Stories

- Als Controlling-Mitarbeiter möchte ich Sellerboard-Import-Transaktionen mit einem Klick in der Ausgaben-Tabelle ausblenden können, damit ich die Übersicht über manuell erfasste und anders importierte Transaktionen behalte.
- Als Controlling-Mitarbeiter möchte ich den Filter jederzeit wieder deaktivieren können, damit alle Transaktionen — inklusive der Sellerboard-Importe — wieder sichtbar sind.
- Als Controlling-Mitarbeiter möchte ich beim Ausblenden der Sellerboard-Importe sehen, wie viele Einträge gefiltert werden, damit ich weiss, wie viele Transaktionen gerade ausgeblendet sind.
- Als Entwickler möchte ich, dass das `import_source`-Feld beim Sellerboard-Import automatisch gesetzt wird, ohne dass der Nutzer davon etwas mitbekommt.

---

## Acceptance Criteria

### AC-1: Datenbankfeld `import_source`

- [ ] Die Tabelle `ausgaben_kosten_transaktionen` hat ein neues optionales Feld `import_source` (Typ: `text`, nullable, default: `null`)
- [ ] Bestehende Transaktionen (alle vor dieser Migration) haben `import_source = null`
- [ ] Das Feld ist in keiner API-Response zur Tabellenansicht sichtbar (keine neue Spalte im UI)
- [ ] Das Feld wird in der `GET /api/ausgaben-kosten-transaktionen`-Response mit ausgeliefert, damit der Client-seitige Filter darauf zugreifen kann — aber es erscheint in keiner Tabellenspalte

### AC-2: Sellerboard-Import setzt das Feld

- [ ] Wenn der Sellerboard-Import-Wizard (PROJ-37) Transaktionen per `POST /api/ausgaben-kosten-transaktionen/batch` speichert, wird für jede Ausgaben-Transaktion `import_source = 'sellerboard'` mitgeschickt
- [ ] Die Batch-API akzeptiert und speichert das Feld `import_source` (keine Validierungsfehler)
- [ ] Transaktionen, die manuell über das Formular oder den GMI-Import erfasst werden, erhalten kein `import_source` (bzw. `null`)

### AC-3: Filter-Toggle in der Ausgaben & Kosten-Tabelle

- [ ] Oberhalb der Ausgaben & Kosten-Tabelle (im Filter-Bereich, neben den bestehenden Filtern) erscheint ein Toggle-Button **„Sellerboard-Import ausblenden"**
- [ ] Standard-Zustand beim Seitenaufruf: Filter **inaktiv** (alle Transaktionen sichtbar)
- [ ] Bei aktiviertem Filter: Die API-Anfrage erhält den Parameter `excludeImportSource=sellerboard`; die Tabelle zeigt nur Transaktionen mit `import_source IS NULL` oder `import_source != 'sellerboard'`
- [ ] Der Filter-Zustand wird als URL-Parameter beibehalten (bei Seiten-Reload bleibt der Filter-Zustand erhalten), analog zu den bestehenden Datum-Filtern
- [ ] Wenn der Filter aktiv ist und Transaktionen ausgeblendet werden: Hinweistext unter/neben dem Toggle: **„X Sellerboard-Transaktionen ausgeblendet"**
- [ ] Gibt es keine Sellerboard-Transaktionen in der Ausgaben-Tabelle (kein einziger Eintrag mit `import_source = 'sellerboard'`): Der Toggle-Button wird **gar nicht angezeigt** (kein leerer Filter-Button)
- [ ] Bei deaktiviertem Filter: kein Hinweistext

### AC-4: API-Unterstützung für den Filter

- [ ] `GET /api/ausgaben-kosten-transaktionen` unterstützt den optionalen Query-Parameter `excludeImportSource` (Wert: `sellerboard`)
- [ ] Bei gesetztem Parameter werden Transaktionen mit `import_source = 'sellerboard'` aus der Ergebnismenge und aus dem `total`-Zähler ausgeschlossen
- [ ] Die Summenzeilen (Brutto-Summe, Netto-Summe) werden ebenfalls nur auf Basis der gefilterten Transaktionen berechnet
- [ ] Bestehende Filter (Datum, Kategorie, etc.) bleiben unverändert und kombinierbar mit dem neuen Filter

---

## Edge Cases

- **Keine Sellerboard-Transaktionen vorhanden:** Der Toggle-Button wird nicht angezeigt — kein unnötiges UI-Element
- **Filter aktiv, aber alle Sellerboard-Transaktionen gelöscht:** Die Tabelle zeigt alle verbleibenden Transaktionen; der Hinweistext zeigt „0 Sellerboard-Transaktionen ausgeblendet" — oder der Toggle verschwindet, wenn keine mehr vorhanden sind
- **Kombination mit anderen Filtern:** `excludeImportSource` kombiniert sich additiv mit Datum-Filter, Kategorie-Filter etc. (AND-Verknüpfung)
- **Paginierung mit aktivem Filter:** `total` und Seitenanzahl beziehen sich auf die gefilterte Menge; kein Off-by-one bei Seitenwechsel
- **Manuell bearbeitete Sellerboard-Transaktion:** Das `import_source`-Feld bleibt bei Bearbeitung einer bestehenden Transaktion unverändert (kein Überschreiben mit `null` beim Update)
- **GMI-Import (PROJ-35):** Transaktionen vom GMI-Import erhalten weiterhin `import_source = null` — keine Änderung an der GMI-Batch-API

---

## Technical Requirements

- **Datenbankfeld:** `import_source text NULL` in `ausgaben_kosten_transaktionen` — Supabase-Migration nötig
- **API-Parameter:** `excludeImportSource` als optionaler Query-Parameter in `GET /api/ausgaben-kosten-transaktionen`
- **Filter-Persistenz:** Toggle-Zustand als URL-Query-Parameter (z.B. `?excludeSellerboard=true`), analog zu bestehenden Filter-Parametern
- **Keine neue Tabellenspalte:** Das Feld wird in der Tabellenansicht nicht dargestellt
- **Keine neuen npm-Pakete**
- **RLS:** Das Feld unterliegt denselben Row-Level-Security-Regeln wie alle anderen Felder der Tabelle

---

## Tech Design (Solution Architect)

### Übersicht der Änderungen

Vier Bereiche werden angefasst — kein neues Paket, keine neue Komponente, keine neue Tabelle:

```
Datenbank (Supabase Migration)
+-- ausgaben_kosten_transaktionen
    +-- Neues Feld: import_source (Text, nullable, default null)

Backend
+-- GET /api/ausgaben-kosten-transaktionen  (erweitert)
|   +-- Neuer Query-Param: excludeImportSource=sellerboard
|   +-- Neue Response-Felder: sellerboardCount
+-- POST /api/ausgaben-kosten-transaktionen/batch  (erweitert)
    +-- Neues optionales Schema-Feld: import_source

Hook (use-ausgaben-kosten-transaktionen.ts)  (erweitert)
+-- AusgabenKostenTransaktion: + import_source: string | null
+-- AusgabenFilter: + excludeSellerboard?: boolean
+-- fetchData: sendet excludeImportSource wenn aktiv
+-- Rückgabe: + sellerboardCount: number

Frontend (ausgaben/page.tsx)  (erweitert)
+-- Filter-Bereich
|   +-- Toggle-Button "Sellerboard-Import ausblenden"
|       (nur sichtbar wenn sellerboardCount > 0)
|   +-- Hinweistext "X Sellerboard-Transaktionen ausgeblendet"
|       (nur wenn Filter aktiv und sellerboardCount > 0)
+-- SellerboardImportWizard: sendet import_source: 'sellerboard'
    bei ausgaben-Batch-Items
```

---

### Datenbankfeld

**Tabelle:** `ausgaben_kosten_transaktionen`
**Neues Feld:** `import_source` — Text, nullable, kein Default-Wert (bestehende Zeilen = `NULL`)
**Migration:** Einfaches `ALTER TABLE ... ADD COLUMN` via Supabase-Migrations-Skript
**RLS:** Keine eigene Policy nötig — das Feld fällt automatisch unter die bestehenden RLS-Regeln der Tabelle

---

### Backend: GET-Endpoint erweitert

Der bestehende Endpoint erhält zwei Erweiterungen:

**Neuer Query-Parameter `excludeImportSource`:**
- Wenn `excludeImportSource=sellerboard`: Beide DB-Queries (Paginierungs-Query + Summen-Query) filtern Zeilen mit `import_source = 'sellerboard'` heraus
- `total` und Summen (Brutto/Netto) beziehen sich dann nur auf die verbleibenden Transaktionen

**Neues Response-Feld `sellerboardCount`:**
- Immer vorhanden — unabhängig davon, ob `excludeImportSource` gesetzt ist
- Wert: Anzahl Transaktionen mit `import_source = 'sellerboard'` unter allen aktuellen anderen Filtern (Datum, Kategorie etc.)
- Erfordert eine dritte, leichtgewichtige Count-Query (nur `.count()`, kein Daten-Laden)
- Zweck: UI entscheidet anhand dieses Werts, ob Toggle angezeigt wird und wie viele Einträge versteckt sind

---

### Backend: Batch-Endpoint erweitert

Das Zod-Validierungsschema in `POST /api/ausgaben-kosten-transaktionen/batch` erhält:
- Neues optionales Feld `import_source` (Text, nullable)
- Beim Insert wird das Feld als `import_source: d.import_source ?? null` mitgeschrieben
- Der GMI-Import schickt das Feld nicht mit → landet als `null` in der DB (kein Breaking Change)

---

### Hook: use-ausgaben-kosten-transaktionen.ts

**Typänderungen:**
- `AusgabenKostenTransaktion` bekommt `import_source: string | null`
- `AusgabenFilter` bekommt `excludeSellerboard?: boolean`

**fetchData-Erweiterung:**
- Wenn `filter.excludeSellerboard === true`: Param `excludeImportSource=sellerboard` wird an den GET-Request angehängt

**Neuer Rückgabewert:**
- `sellerboardCount: number` — direkt aus der API-Response gelesen, im State gehalten

**Filter-Reset:**
- `setFilter({})` setzt auch `excludeSellerboard` zurück → Sellerboard-Transaktionen wieder sichtbar

---

### Frontend: ausgaben/page.tsx

**Toggle-Button:**
- Platzierung: im bestehenden Filter-Bereich (`flex flex-wrap items-end gap-4`), nach den Kategorie-Filtern, vor dem „Filter zurücksetzen"-Button
- Sichtbar nur wenn `sellerboardCount > 0` (sonst kein leeres UI-Element)
- Visueller Zustand: `variant="outline"` (inaktiv) vs. `variant="secondary"` + farbige Hervorhebung (aktiv)
- Klick: ruft `setFilter({ ...filter, excludeSellerboard: !filter.excludeSellerboard })` auf

**Hinweistext:**
- Erscheint nur wenn `filter.excludeSellerboard === true && sellerboardCount > 0`
- Text: `„${sellerboardCount} Sellerboard-Transaktionen ausgeblendet"`
- Platzierung: als kleiner Badge oder Inline-Text direkt neben dem Toggle-Button

**SellerboardImportWizard:**
- In `sellerboard-import-wizard.tsx`: beim Aufbau der Ausgaben-Batch-Items wird `import_source: 'sellerboard'` zum jeweiligen Objekt hinzugefügt
- Keine sichtbare UI-Änderung im Wizard

---

### Was nicht gebaut wird

- Keine neue Komponente
- Kein neues npm-Paket
- Keine URL-Persistenz (konsistent mit allen anderen Filtern auf dieser Seite)
- Kein `import_source`-Feld in `umsatz_transaktionen`
- Kein `import_source`-Feld in der Tabellenansicht (weder Spalte noch Tooltip)
- Kein Bearbeiten des Felds durch den Nutzer

---

### Reihenfolge der Implementierung

1. Supabase-Migration (DB-Feld hinzufügen)
2. Batch-API erweitern (Schema + Insert)
3. GET-API erweitern (Filter + sellerboardCount)
4. Hook erweitern (Typen, fetchData, sellerboardCount)
5. SellerboardImportWizard: import_source mitsenden
6. ausgaben/page.tsx: Toggle-Button + Hinweistext

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
