# PROJ-36: Schnellbearbeitungsmodus für Transaktionstabellen

## Status: In Progress
**Created:** 2026-05-16
**Last Updated:** 2026-05-16

## Dependencies
- Requires: PROJ-3 (Umsatz-Transaktionen Eingabe) — bestehende Umsatz-Tabelle & API
- Requires: PROJ-4 (Einnahmen-Transaktionen Eingabe) — bestehende Einnahmen-Tabelle & API
- Requires: PROJ-5 (Ausgaben & Kosten-Transaktionen Eingabe) — bestehende Ausgaben/Kosten-Tabelle & API

## Overview
Ein Schnellbearbeitungsmodus, der es dem Nutzer ermöglicht, Transaktionen direkt in der Tabelle zu bearbeiten — ohne vorher den Stift-Icon anzuklicken und das Formular-Dialog zu öffnen. Verfügbar auf drei Seiten: Ausgaben & Kosten, Umsatz und Einnahmen.

## User Stories
- Als Controlling-Mitarbeiter möchte ich einen „Bearbeiten"-Button oben rechts auf der Seite anklicken, damit ich in den Schnellbearbeitungsmodus wechsle.
- Als Controlling-Mitarbeiter möchte ich im Schnellbearbeitungsmodus alle Felder einer Zeile direkt in der Tabelle bearbeiten, damit ich Korrekturen schnell ohne Umweg über ein Formular-Dialog vornehmen kann.
- Als Controlling-Mitarbeiter möchte ich, dass Änderungen automatisch gespeichert werden sobald ich ein Eingabefeld verlasse (Auto-Save on Blur), damit kein explizites Speichern nötig ist.
- Als Controlling-Mitarbeiter möchte ich sehen, wenn eine Eingabe ungültig ist (rote Markierung), damit ich weiß, welche Felder noch korrigiert werden müssen bevor sie gespeichert werden können.
- Als Controlling-Mitarbeiter möchte ich den Bearbeitungsmodus wieder deaktivieren können, damit die Tabelle zur normalen Ansicht zurückkehrt.

## Acceptance Criteria

### Bearbeitungsmodus-Toggle
- [ ] Auf den Seiten Ausgaben & Kosten, Umsatz und Einnahmen erscheint rechts oben ein Button „Bearbeiten" (Icon: Pencil oder ähnliches).
- [ ] Wenn der Button aktiv ist, wechselt er in einen „Fertig"-Zustand (visuell hervorgehoben, z. B. anderer Farbton oder Label „Bearbeiten beenden").
- [ ] Beim Aktivieren/Deaktivieren wird kein Neuladen der Seite ausgelöst.
- [ ] Der Zustand des Modus ist nur lokal (wird nicht persistiert) — beim Seitenwechsel ist der Modus standardmäßig deaktiviert.

### Inline-Bearbeitung der Tabellenzeilen
- [ ] Im Bearbeitungsmodus werden alle Zellen einer Zeile zu editierbaren Eingabefeldern umgewandelt.
- [ ] Eingabetypen je Feldtyp:
  - **Datum-Felder** (Leistungsdatum, Zahlungsdatum): `<input type="date">` oder DatePicker
  - **Betrag-Felder** (Betrag, Bruttobetrag, USt-Betrag): Numerisches Eingabefeld
  - **Textfelder** (Beschreibung): `<input type="text">`
  - **Dropdown-Felder** (Kategorie, Gruppe, Untergruppe, Sales Plattform, Produkt, Umsatzsteuer, Relevanz, Abschreibung): `<select>` oder Combobox analog zum Formular-Dialog
- [ ] Pflichtfelder sind im Bearbeitungsmodus genauso verpflichtend wie im Formular-Dialog.

### Felder je Seite (identisch mit den jeweiligen Formular-Dialogs)
**Ausgaben & Kosten:**
- Leistungsdatum (Pflicht), Zahlungsdatum (optional), Kategorie (Pflicht), Gruppe (bedingt), Untergruppe (bedingt), Sales Plattform (bedingt), Produkt (bedingt), Beschreibung (optional), Bruttobetrag in € (Pflicht), Umsatzsteuer (Pflicht), USt-Betrag in € (bedingt bei „individuell"), Relevanz (Pflicht), Abschreibung (optional)

**Umsatz:**
- Leistungsdatum (Pflicht), Betrag in € (Pflicht), Kategorie (Pflicht), Gruppe (bedingt), Untergruppe (bedingt), Sales Plattform (bedingt), Produkt (bedingt), Beschreibung (optional)

**Einnahmen:**
- Zahlungsdatum (Pflicht), Betrag in € (Pflicht), Kategorie (Pflicht), Gruppe (bedingt), Untergruppe (bedingt), Sales Plattform (bedingt), Produkt (bedingt), Beschreibung (optional)

### Auto-Save (Speichern beim Verlassen der Zelle)
- [ ] Wenn der Nutzer ein Eingabefeld verlässt (Blur-Event) und der neue Wert gültig ist, wird die Änderung sofort per PATCH/PUT an die API gesendet.
- [ ] Während des Speicherns wird die Zeile visuell als „wird gespeichert" markiert (z. B. leichte Opacity-Reduzierung oder Spinner in der Zeile).
- [ ] Nach erfolgreichem Speichern verschwindet die Markierung; die Tabellendaten werden aktualisiert.
- [ ] Bei einem API-Fehler wird eine Toast-Fehlermeldung angezeigt und der Feldwert auf den letzten gespeicherten Wert zurückgesetzt.

### Validierung (Rot markieren, Speichern blockieren)
- [ ] Ungültige Felder (leere Pflichtfelder, ungültige Beträge < 0, ungültiges Datumsformat) werden mit einem roten Rahmen und/oder rotem Hintergrund hervorgehoben.
- [ ] Solange ein Feld ungültig ist, wird kein API-Call ausgelöst — das Speichern ist für diese Zeile blockiert.
- [ ] Die Validierungsregeln entsprechen denen des Formular-Dialogs (gleiche Pflichtfelder, gleiche Wertebereiche).

### Bestehende Aktionen im Bearbeitungsmodus
- [ ] Der Löschen-Button (Trash2) bleibt im Bearbeitungsmodus sichtbar und funktionsfähig.
- [ ] Der Stift-Button (Pencil, öffnet Formular-Dialog) wird im Bearbeitungsmodus ausgeblendet (verhindert Überlappung der zwei Bearbeitungswege).

## Edge Cases
- **Bearbeitungsmodus + Paginierung**: Wenn der Nutzer während aktiver Änderungen die Seite wechselt, werden nicht gespeicherte ungültige Eingaben verworfen. Es erscheint keine explizite Warnung, da Auto-Save gültige Änderungen sofort speichert.
- **Bearbeitungsmodus + Sortierung/Filter**: Wenn der Nutzer im Bearbeitungsmodus einen Sortierklick oder einen Filter-Wechsel auslöst, wird die Tabelle neu geladen und eventuelle ungültige (nicht-gespeicherte) Eingaben gehen verloren. Die Sortier-/Filter-Steuerungen bleiben zugänglich.
- **Kategorie-Abhängigkeiten (Gruppe, Untergruppe etc.)**: Bei einer Kategorie-Änderung werden abhängige Felder (Gruppe, Untergruppe, Sales Plattform, Produkt) zurückgesetzt — analog zum bestehenden Formular-Dialog-Verhalten.
- **USt-Betrag Bedingtheit (Ausgaben)**: Das Feld „USt-Betrag in €" erscheint/verschwindet dynamisch abhängig vom Umsatzsteuer-Dropdown-Wert (= „individuell"), genauso wie im Formular-Dialog.
- **Gleichzeitige Bearbeitung mehrerer Zeilen**: Der Nutzer kann mehrere Zeilen gleichzeitig bearbeiten, da Auto-Save zeilenweise funktioniert. Es gibt keine Sperre einzelner Zeilen.
- **Sehr schmale Tabellen-Spalten**: Eingabefelder können bei engen Spalten überlaufen. Mindestbreiten oder horizontal scrollbare Tabelle müssen sichergestellt werden.
- **Offline / API nicht erreichbar**: Beim Speicher-Versuch schlägt der API-Call fehl; Toast-Fehlermeldung, Feld behält den (ungültigen) Wert und wird rot markiert bis der Nutzer erneut eine gültige Eingabe macht.

## Technical Requirements
- Alle drei Seiten teilen denselben Bearbeitungsmodus-Mechanismus (DRY: möglichst gemeinsam genutzte Logik via Hook oder Utility).
- Die bestehenden PATCH/PUT API-Endpoints der jeweiligen Transaktionen werden verwendet — kein neues Backend nötig.
- Keine Breaking Changes an den bestehenden Formular-Dialogen.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Rein frontend-seitiges Feature — kein neues Backend nötig. Die bestehenden PATCH-Endpoints (`/api/ausgaben-kosten-transaktionen/[id]`, `/api/umsatz-transaktionen/[id]`, `/api/einnahmen-transaktionen/[id]`) werden direkt wiederverwendet. Die Implementierung besteht aus drei Teilen: einem geteilten Hook für die Bearbeitungslogik, erweiterten Tabellen-Komponenten für Inline-Inputs, und einem Edit-Mode-Toggle-Button in den Seiten-Headern.

---

### Komponenten-Struktur

```
Ausgaben-/Umsatz-/Einnahmen-Seite (page.tsx — bestehend, leicht erweitert)
├── Header
│   ├── [bestehende Buttons: + Neue Transaktion, Excel importieren]
│   └── EditModeToggleButton (NEU)
│       ├── Zustand: inaktiv → Label "Bearbeiten", Icon Pencil
│       └── Zustand: aktiv  → Label "Bearbeiten beenden", Icon Check, andere Farbe
│
├── Filter-Bereich (unverändert)
│
└── Tabellen-Komponente (ausgaben-table.tsx etc. — erweitert)
    ├── Props: + editMode: boolean, onInlineUpdate: (id, fields) => Promise<void>
    ├── TableHeader (unverändert)
    └── TableBody → pro Zeile:
        ├── View-Modus (editMode=false): bestehende statische Zellenanzeige
        └── Edit-Modus (editMode=true): Inline-Eingabezeile
            ├── Datums-Felder → <input type="date">
            ├── Betrag-Felder → <input type="number" min="0">
            ├── Text-Felder → <input type="text">
            ├── Dropdown-Felder → <select> (Kategorie, Gruppe, Untergruppe,
            │   Sales Plattform, Produkt, USt-Satz, Relevanz, Abschreibung)
            └── Aktionen: Trash2-Button bleibt, Pencil-Button ausgeblendet
```

---

### Geteilter Hook: `useInlineEdit<T>`

Ein generischer React-Hook, der die gesamte Inline-Bearbeitungslogik kapselt und von allen drei Tabellen genutzt wird:

**Was der Hook verwaltet:**
- **Draft-Zustand** — für jede Zeile (identifiziert per ID) wird eine Kopie der aktuellen Feldwerte gehalten, solange der Nutzer sie bearbeitet
- **Validierungsfehler** — pro Zeile eine Map von Feldname → Fehlermeldung
- **Speicher-Status** — pro Zeile ein Zustand (idle / saving / error), der den Lade-Spinner steuert
- **Blur-Handler** — beim Verlassen eines Feldes: validieren → wenn gültig, API-PATCH auslösen; wenn ungültig, Feld rot markieren

**Ablauf eines Auto-Save:**
```
Nutzer verlässt Feld (Blur)
  → Validierung prüfen
  ├── Ungültig: Feld rot markieren, kein API-Call
  └── Gültig: PATCH-Request senden
        ├── Während Speichern: Zeile halbtransparent + Spinner
        ├── Erfolg: Draft-Zustand zurücksetzen, Tabelle aktualisiert
        └── Fehler: Toast-Fehlermeldung, Feldwert auf letzten gespeicherten Wert zurücksetzen
```

---

### Validierungsregeln (identisch mit Formular-Dialog)

| Feld | Regel |
|------|-------|
| Leistungsdatum / Zahlungsdatum | Pflichtfeld (je nach Seite), gültiges Datum |
| Betrag / Bruttobetrag | Pflichtfeld, > 0 |
| USt-Betrag | ≥ 0, nur sichtbar wenn USt-Satz = „individuell" |
| Kategorie | Pflichtfeld, muss aus Liste stammen |
| Relevanz (Ausgaben) | Pflichtfeld, einer der drei Werte |
| Beschreibung | Optional, max. 1000 Zeichen |
| Gruppe/Untergruppe | Bedingt — nur wenn übergeordnetes Feld gesetzt |

---

### Kategorie-Abhängigkeiten im Edit-Modus
Bei einer Änderung des Kategorie-Dropdowns werden Gruppe, Untergruppe, Sales Plattform und Produkt automatisch zurückgesetzt (auf `null`). Das gleiche gilt für Gruppe → Untergruppe. Dies spiegelt das Verhalten des bestehenden Formular-Dialogs wider und verhindert inkonsistente Datenkombinationen.

---

### Datenfluss (kein neues Backend)

```
Seite (page.tsx)
  editMode: boolean (lokaler useState)
  updateTransaktion(id, fields) ← bestehende Hook-Funktion
    ↓ ruft auf
  PATCH /api/ausgaben-kosten-transaktionen/[id]  (bestehend)
  PATCH /api/umsatz-transaktionen/[id]           (bestehend)
  PATCH /api/einnahmen-transaktionen/[id]        (bestehend)
```

Die `updateTransaktion`-Funktion existiert bereits in allen drei Hooks (`useAusgabenKostenTransaktionen`, `useUmsatzTransaktionen`, `useEinnahmenTransaktionen`) und wird unverändert wiederverwendet.

---

### Dateien, die geändert werden

| Datei | Änderung |
|-------|----------|
| `src/hooks/use-inline-edit.ts` | NEU — geteilter Hook für Inline-Bearbeitungslogik |
| `src/components/ausgaben-table.tsx` | Erweitert um `editMode`-Prop + Inline-Inputs pro Zeile |
| `src/components/umsatz-table.tsx` | Erweitert um `editMode`-Prop + Inline-Inputs pro Zeile |
| `src/components/einnahmen-table.tsx` | Erweitert um `editMode`-Prop + Inline-Inputs pro Zeile |
| `src/app/dashboard/ausgaben/page.tsx` | Toggle-Button + `editMode`-State + Props an Tabelle |
| `src/app/dashboard/umsatz/page.tsx` | Toggle-Button + `editMode`-State + Props an Tabelle |
| `src/app/dashboard/einnahmen/page.tsx` | Toggle-Button + `editMode`-State + Props an Tabelle |

**Keine Änderungen an:** Form-Dialogs, API-Routes, Datenbankschema, RLS-Policies.

---

### Pakete / Dependencies
Keine neuen Pakete nötig — alle benötigten UI-Primitiven (Input, Select, Button, Toast) sind bereits installiert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
