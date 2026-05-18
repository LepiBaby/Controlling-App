# PROJ-38: Sellerboard-Import-Herkunftskennzeichnung & Filter in Ausgaben-Tabelle

## Status: Planned
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
