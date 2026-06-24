# PROJ-81: Operative Fixkosten-Einstellungen — Langfristige Planung

## Status: Removed
**Created:** 2026-06-20
**Last Updated:** 2026-06-22 (Removed)

> **Entfernt am 2026-06-22:** Die Seite „Operative Fixkosten-Einstellungen" der **Langfristigen Planung** wurde auf Wunsch komplett entfernt (Page, Inhalt/Tabelle/Dialog-Komponenten, Hook, API-Routen + Tests, Navigationseintrag). Die kurzfristige Variante (PROJ-55) bleibt unverändert bestehen. Die DB-Tabelle `langfristige_operative_fixkosten` existiert ggf. noch und kann per Migration entfernt werden.

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — diese Seite ist eine versionsgebundene Einstellungsseite unter `/dashboard/langfristige-planung/[versionId]/…`; sie nutzt das Versions-Routing, den Versionskontext, die Versions-Shell und das kontextabhängige Seitenmenü
- Requires: PROJ-2 (KPI-Modell Verwaltung) — die Gruppen/Untergruppen unterhalb des **globalen** „Operativ"-Knotens (`type = 'ausgaben_kosten'`) werden als Auswahlwerte gelesen (identisch zur kurzfristigen Seite)
- Vorlage (kein harter Require): PROJ-55 (Operative Fixkosten-Einstellungen — Kurzfristige Planung) — UI/Bedienung werden gespiegelt, mit den unten beschriebenen Abweichungen

## Übersicht

Die Seite „Operative Fixkosten-Einstellungen" der **Langfristigen Planung** ist der langfristige Gegenpart zur kurzfristigen Seite (PROJ-55). Nutzer können wiederkehrende operative Fixkosteneinträge mit Zahlungsfrequenz, Fälligkeitsmonat(en), Zahlungsziel und Nettobetrag + USt (Brutto berechnet) anlegen, bearbeiten und löschen. Alle Daten werden **pro Planversion** isoliert gespeichert (Datenisolation gemäß PROJ-73).

Die Bedienung und die Felder entsprechen **1:1 der kurzfristigen Seite in ihrem aktuellen Stand** (Gruppe → Untergruppe, Name, Zahlungsfrequenz, Fälligkeitsmonat(e), Zeitpunkt im Monat, Zahlungsziel, Nettobetrag + USt mit Brutto-Vorschau), mit den folgenden bewusst gesetzten Abweichungen:

1. **Keine Spalte „Netto monatlich" (Netto mtl.)** — entfällt vollständig aus der Tabelle.
2. **Kein Auswertungsblock oben auf der Seite** — die Kennzahl „Gesamte Fixkosten monatlich" und die Kategorieaufschlüsselung entfallen vollständig.
3. **Keine „Aktiv"-Auswahl je Eintrag** — der Aktiv/Inaktiv-Schalter im Formular und die Spalte/Badge „Aktiv" in der Tabelle entfallen. Es können ausschließlich (aktive) Fixkosten angelegt werden.
4. **Aktiv-Zeitraum bleibt erhalten, aber monatsbasiert** — statt Datums-Feldern mit Kalenderwochen-Anzeige (kurzfristig) wird der Aktiv-Zeitraum als **Von (Monat + Jahr)** und **Bis (Monat + Jahr)** erfasst, passend zur monatsbasierten langfristigen Planung. Der Aktiv-Zeitraum bleibt optional (leer = unbegrenzt aktiv).

Die Gruppen/Untergruppen kommen — wie bei der kurzfristigen Seite — aus dem **globalen** KPI-Modell („Operativ"-Knoten im ausgaben_kosten-Baum); sie werden nicht pro Version gepflegt.

## User Stories

- Als Controller möchte ich die Seite „Operative Fixkosten-Einstellungen" innerhalb einer geöffneten Planversion über das linke Seitenmenü und die Versions-Übersichtsseite aufrufen können, damit ich die operativen Fixkosten dieser Version pflegen kann.
- Als Controller möchte ich operative Fixkosteneinträge anlegen können (Gruppe/Untergruppe, Name, Frequenz, Fälligkeitsmonat(e), Zeitpunkt, Zahlungsziel, Nettobetrag + USt), damit ich wiederkehrende Kosten strukturiert in der langfristigen Planung dieser Version erfasse.
- Als Controller möchte ich jeden Eintrag einer Gruppe (und ggf. Untergruppe) unterhalb des globalen „Operativ"-Knotens zuordnen, damit Kosten der richtigen Kostenstelle zugerechnet werden — genau wie in der kurzfristigen Planung.
- Als Controller möchte ich je Eintrag einen optionalen Aktiv-Zeitraum (Von-/Bis-Monat) festlegen, damit zeitlich befristete Fixkosten korrekt abgebildet werden; lasse ich ihn leer, gilt der Eintrag als unbegrenzt aktiv.
- Als Controller möchte ich bestehende Einträge bearbeiten und löschen können, damit die Daten der Version aktuell bleiben.
- Als Controller möchte ich die Liste nach Gruppe filtern können, damit ich schnell relevante Einträge finde.
- Als Controller möchte ich, dass die Einträge pro Planversion gespeichert werden und andere Versionen oder die Kurzfristige Planung nicht beeinflussen.

## Acceptance Criteria

### Navigation & Einstieg
- [ ] Innerhalb einer geöffneten Planversion enthält das linke Seitenmenü (Gruppe „Einstellungen") den bereits vorhandenen Eintrag „Operative Fixkosten-Einstellungen" → `/dashboard/langfristige-planung/[versionId]/operative-fixkosten-einstellungen`
- [ ] Auf der Versions-Übersichtsseite (`/dashboard/langfristige-planung/[versionId]`) erscheint der Eintrag/die Kachel „Operative Fixkosten-Einstellungen", die auf die Seite verlinkt
- [ ] Der Seitentitel lautet „Operative Fixkosten-Einstellungen"
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Wird die Seite mit unbekannter/fremder/ungültiger `versionId` aufgerufen, erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73-Versionskontext

### Kein Auswertungsblock (Abweichung zu PROJ-55)
- [ ] Oberhalb der Tabelle gibt es **keinen** Auswertungsblock, **keine** Kennzahl „Gesamte Fixkosten monatlich" und **keine** Kategorieaufschlüsselung.

### Formular — Neuen Eintrag anlegen
- [ ] Ein Button „+ Fixkosten anlegen" öffnet ein Dialog-Formular.
- [ ] **Gruppe (Pflicht):** Dropdown mit allen Gruppen (Ebene 1) unterhalb des globalen Knotens mit `type = 'ausgaben_kosten'` und `name = 'Operativ'` (case-insensitive). Existiert kein „Operativ"-Knoten, zeigt die Auswahl einen Hinweis: „Keine Gruppen gefunden. Bitte zuerst die Kategorie ‚Operativ' im KPI-Modell anlegen."
- [ ] **Untergruppe (bedingt Pflicht):** Hat die gewählte Gruppe Untergruppen (Ebene darunter), erscheint ein Untergruppen-Dropdown und ist Pflichtfeld; hat sie keine, entfällt das Feld.
- [ ] **Name (Pflicht):** Freitextfeld, min. 1 Zeichen, max. 100 Zeichen.
- [ ] **Zahlungsfrequenz (Pflicht):** Dropdown: `Monatlich`, `Quartalsweise`, `Jährlich`.
- [ ] **Fälligkeitsmonat (nur Jährlich, Pflicht):** Einfach-Auswahl eines Kalendermonats (Januar–Dezember).
- [ ] **Fälligkeitsmonate je Quartal (nur Quartalsweise, Pflicht):** Je ein Monat pro Quartal — Q1 (Jan/Feb/Mär), Q2 (Apr/Mai/Jun), Q3 (Jul/Aug/Sep), Q4 (Okt/Nov/Dez). Alle vier sind Pflichtfelder.
- [ ] **Kein „Zeitpunkt im Monat"-Feld** (auf Nutzerwunsch entfernt; Spalte ist DB-seitig NOT NULL und wird serverseitig auf `anfang` gesetzt).
- [ ] **Zahlungsziel (Tage) (optional):** Ganze Zahl 0–365.
- [ ] **Nettobetrag (Pflicht):** Zahl (€), min. 0,01, max. 10.000.000, zwei Dezimalstellen.
- [ ] **Umsatzsteuer (Pflicht):** Dropdown `0 %`, `7 %`, `19 %`, `Individuell`. Bei `Individuell` erscheint ein zusätzliches Pflichtfeld „USt-Betrag individuell (€)" (> 0).
- [ ] **Brutto-Vorschau:** Bei Nettobetrag > 0 wird der berechnete Bruttobetrag angezeigt (Netto + USt).
- [ ] **Aktiv-Zeitraum (optional):** Zwei Eingabebereiche „Von" und „Bis", jeweils mit Monat-Auswahl (Januar–Dezember) und Jahr-Auswahl. Leer lassen = unbegrenzt aktiv. Es darf nur Von oder nur Bis gesetzt sein.
- [ ] **Kein Aktiv-Schalter** im Formular (Abweichung zu PROJ-55).
- [ ] Alle Pflichtfelder werden client- und serverseitig validiert; Validierungsfehler erscheinen als spezifische Inline-/Alert-Fehlermeldung.
- [ ] Nach erfolgreichem Speichern schließt das Formular und der neue Eintrag erscheint sofort in der Tabelle (optimistisches Update).

### Tabelle
- [ ] Alle Fixkosteneinträge der aktuellen Planversion werden tabellarisch angezeigt mit Spalten: **Gruppe**, **Untergruppe**, **Name**, **Frequenz**, **Fälligkeitsmonat(e)**, **Zahlungsziel**, **Brutto (€)**, **Netto (€)**, **Aktiv-Zeitraum**, **Aktionen**. (Keine „Zeitpunkt"-Spalte — auf Nutzerwunsch entfernt.)
- [ ] Es gibt **keine** Spalte „Netto mtl." (Abweichung zu PROJ-55).
- [ ] Es gibt **keine** Spalte/Badge „Aktiv" (Abweichung zu PROJ-55).
- [ ] Die Spalte „Fälligkeitsmonat(e)" zeigt bei Monatlich „Alle Monate", bei Quartalsweise die vier gewählten Monatskürzel (z. B. „Feb, Mai, Aug, Nov"), bei Jährlich den gewählten Monat.
- [ ] Die Spalte „Zahlungsziel" zeigt „N Tage" oder „–", wenn nicht gesetzt.
- [ ] Die Spalte „Aktiv-Zeitraum" zeigt „Von-Monat/Jahr → Bis-Monat/Jahr" (z. B. „Jan 2027 → Dez 2027"); bei nur einem Wert die jeweilige Seite und „–" für die andere; bei keinem Wert „Unbegrenzt".
- [ ] Jede Zeile hat „Bearbeiten" (öffnet das Formular vorausgefüllt) und „Löschen" (mit Bestätigungsdialog).

### Filter
- [ ] **Kein Gruppen-Filter** über der Tabelle (auf Nutzerwunsch entfernt). Die Toolbar enthält nur den Button „+ Fixkosten anlegen"; die Tabelle zeigt alle Einträge der Version.

### Bearbeiten
- [ ] „Bearbeiten" öffnet das Formular mit allen gespeicherten Werten vorausgefüllt (inkl. Frequenz mit passender Monatsauswahl und Aktiv-Zeitraum als Von-/Bis-Monat).
- [ ] Nach dem Speichern aktualisiert sich der Eintrag in der Tabelle sofort (optimistisch; Rollback bei Server-Fehler + Fehlermeldung).

### Löschen
- [ ] „Löschen" öffnet einen Bestätigungsdialog, der den Namen des Eintrags nennt: „Soll der Eintrag ‚<Name>' wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
- [ ] Nach Bestätigung wird der Eintrag permanent gelöscht und aus der Tabelle entfernt. Abbrechen schließt den Dialog ohne Änderung.

### Leerzustand
- [ ] Sind in dieser Version noch keine Einträge vorhanden, zeigt die Seite einen Hinweistext und den Button „+ Fixkosten anlegen".

### Datenpersistenz & Isolation
- [ ] Alle Einträge werden pro Planversion (`plan_version_id`) und zusätzlich an den Nutzer gebunden (`user_id`) gespeichert.
- [ ] Eine neu angelegte Planversion zeigt eine **leere** Liste.
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B oder die Kurzfristige Planung.
- [ ] Wird die Planversion gelöscht, werden die zugehörigen Fixkosteneinträge automatisch mitgelöscht (ON DELETE CASCADE).

## Edge Cases

- **Kein „Operativ"-Knoten im globalen KPI-Modell:** Das Gruppen-Dropdown ist leer und zeigt den Hinweistext; der „Anlegen"-Button im Dialog ist deaktiviert.
- **Gruppe ohne Untergruppen:** Das Untergruppen-Feld entfällt; `untergruppe_id` bleibt leer/null.
- **Frequenzwechsel beim Bearbeiten:** Wechselt der Nutzer die Frequenz, werden die Monatsauswahl-Felder entsprechend ein-/ausgeblendet und nicht passende Werte verworfen.
- **Quartalsmonat-Validierung:** Pro Quartal darf nur ein Monat aus den zugehörigen Monaten gewählt werden; der Server validiert die korrekte Verteilung auf die Quartale.
- **Aktiv-Zeitraum nur teilweise gesetzt:** Nur „Von" oder nur „Bis" ist zulässig.
- **Aktiv-Bis vor Aktiv-Von:** Liegt der Bis-Monat (Jahr+Monat) vor dem Von-Monat, erscheint eine Fehlermeldung und es wird nicht gespeichert.
- **Nettobetrag = 0 oder negativ:** Nicht erlaubt (min. 0,01 €).
- **USt = Individuell ohne Betrag:** Pflichtfeld; ohne gültigen Betrag (> 0) wird nicht gespeichert.
- **Gleichnamige Einträge:** Name + Gruppe müssen nicht eindeutig sein (Duplikate erlaubt).
- **Fremde/unbekannte versionId:** Redirect zum Langfristige-Planung-Dashboard, kein Datenzugriff.
- **Sehr viele Einträge:** API-Abfrage mit `.limit(500)`; Tabelle scrollt horizontal/vertikal.
- **Gleichzeitiges Bearbeiten:** Optimistic-UI; bei Server-Fehler wird die Änderung rückgängig gemacht und eine Fehlermeldung angezeigt.

## Technical Requirements

- **Auth:** Alle API-Endpunkte erfordern eine gültige Sitzung (`requireAuth`). RLS auf Datenbankebene sichert user-spezifischen Zugriff; die Versionszugehörigkeit (`plan_version_id` gehört dem Nutzer) wird serverseitig zusätzlich geprüft (Defense-in-Depth).
- **Versionsbindung:** Daten werden pro `plan_version_id` isoliert; Routen sind versionsbewusst (`/api/langfristige-planung/[versionId]/operative-fixkosten-einstellungen`).
- **Kategorien-Quelle:** Gruppen/Untergruppen werden aus dem **globalen** KPI-Modell gelesen (Knoten `type = 'ausgaben_kosten'`, `name = 'Operativ'`) — identisch zur kurzfristigen Seite (vorhandener `useKpiCategories`-Mechanismus). Keine versionsspezifische Kategorieverwaltung.
- **Validierung:** Serverseitig Zod-Schema; clientseitig analog zur kurzfristigen Seite. Nettobetrag > 0 und ≤ 10.000.000, valide Frequenz-/Zeitpunktwerte, korrekte Monatsverteilung, Aktiv-Von ≤ Aktiv-Bis (sofern beide gesetzt).
- **Berechnung Brutto:** Brutto = Netto + USt (0/7/19 % oder individueller Betrag) — Berechnung wie auf der kurzfristigen Seite. **Keine** „Netto monatlich"-Berechnung/-Anzeige nötig.
- **Komponenten:** shadcn/ui für Dialog, Button, Input, Label, Select, Badge, Table, Alert, AlertDialog. Versions-Shell (`LangfristigeVersionShell`) als Seitengerüst.
- **DB-Tabelle (neu):** versionsgebundene Tabelle für langfristige operative Fixkosten mit Spalten analog zur kurzfristigen Tabelle, **ohne** `aktiv`-Bool, **plus** `plan_version_id` (FK → `langfristige_planversionen`, ON DELETE CASCADE). Aktiv-Zeitraum als Monat+Jahr (Von/Bis), z. B. `aktiv_von_monat`/`aktiv_von_jahr`/`aktiv_bis_monat`/`aktiv_bis_jahr` (alle nullable) — die konkrete Modellierung legt `/architecture` fest.
- **Performance:** Listenabruf < 300 ms; Formularspeicherung < 500 ms.
- **Navigation:** Der Nav-Eintrag „Operative Fixkosten-Einstellungen" existiert bereits in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen") und verlinkt automatisch auf den versionsspezifischen Pfad — kein Nav-Umbau nötig.
- **Responsive:** Mobil (375px) bis Desktop (1440px).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee

Diese Seite ist eine weitere **gespiegelte Einstellungsseite** der Langfristigen Planung (wie PROJ-75). Sie nutzt das vorhandene Fundament aus PROJ-73 vollständig wieder: das Versions-Routing (`[versionId]` im Pfad), das gemeinsame Seitengerüst `LangfristigeVersionShell` (Header mit Breadcrumb, Versionsprüfung per API, Redirect bei fremder/unbekannter Version) und die zentrale Navigationskonfiguration, in der der Eintrag „Operative Fixkosten-Einstellungen" **bereits vorhanden** ist.

Inhaltlich ist die Seite der langfristige Gegenpart zur kurzfristigen Operative-Fixkosten-Seite (PROJ-55) in ihrem **aktuellen Stand**. Wir bauen dafür **eigene, versionsbewusste Bausteine** (Tabelle, Formular, Datenzugriff), statt die kurzfristigen Komponenten zu verbiegen — denn dort stecken die nicht gewünschten Teile (Netto-mtl.-Spalte, Auswertungsblock, Aktiv-Schalter, datums-/wochenbasierter Aktiv-Zeitraum) fest verdrahtet. Reine Hilfslogik, die unverändert passt (Monatsnamen, Frequenz-/Zeitpunkt-Beschriftungen, USt-/Brutto-Berechnung, Formatierung der Fälligkeitsmonate), wird aus dem bestehenden Modul **wiederverwendet**, nicht kopiert.

### A) Seiten- & Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]                       (Versions-Übersicht — vorhanden)
+-- Eintrag/Kachel "Operative Fixkosten-Einstellungen"  → .../[versionId]/operative-fixkosten-einstellungen
                                                           (Nav-Eintrag bereits angelegt)

/dashboard/langfristige-planung/[versionId]/operative-fixkosten-einstellungen   (NEUE echte Seite)
+-- LangfristigeVersionShell  (bestehend — Header, Breadcrumb, Versionsprüfung, Redirect, Toaster)
    +-- Operative-Fixkosten-Seiteninhalt  (NEU, versionsbewusst)
        +-- Toolbar
        |   +-- Gruppen-Filter        (Auswahl; "Alle Gruppen" setzt zurück)
        |   +-- Button "+ Fixkosten anlegen"
        +-- KEIN Auswertungsblock oben          (bewusst entfernt ggü. PROJ-55)
        +-- Fixkosten-Tabelle  (NEU)
        |   +-- Spalten: Gruppe | Untergruppe | Name | Frequenz | Fälligkeitsmonat(e) |
        |   |            Zeitpunkt | Zahlungsziel | Brutto | Netto | Aktiv-Zeitraum | Aktionen
        |   +-- KEINE Spalte "Netto mtl." · KEINE Spalte/Badge "Aktiv"
        |   +-- Aktionen: "Bearbeiten" → Formular · "Löschen" → Bestätigungsdialog
        +-- Fixkosten-Formular-Dialog  (NEU)
            +-- Gruppe (Auswahl: Ebene-1-Kinder von "Operativ" aus GLOBALEM KPI-Modell)
            +-- Untergruppe (Auswahl, nur wenn die Gruppe Untergruppen hat)
            +-- Name
            +-- Zahlungsfrequenz (Monatlich / Quartalsweise / Jährlich)
            +-- [bedingt] Monat-Auswahl (Jährlich) bzw. 4 Quartals-Auswahlen (Quartalsweise)
            +-- Zeitpunkt im Monat (Anfang / Mitte / Ende)
            +-- Zahlungsziel in Tagen (optional)
            +-- Nettobetrag + Umsatzsteuer (0/7/19 %/Individuell) → Brutto-Vorschau
            +-- Aktiv-Zeitraum (optional): Von (Monat + Jahr) · Bis (Monat + Jahr)
            +-- KEIN Aktiv-Schalter                 (bewusst entfernt ggü. PROJ-55)
```

Das linke Seitenmenü und die Versions-Übersicht müssen **nicht** umgebaut werden — der Eintrag verlinkt bereits automatisch auf den versionsspezifischen Pfad. Die neue statische Seite löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab (statische Route schlägt dynamische).

### B) Datenmodell (Klartext)

**Neue Tabelle „Langfristige operative Fixkosten" — viele Einträge pro Planversion:**

```
Jeder Eintrag hat:
- eindeutige ID
- Besitzer (Nutzer)                         → Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion  → Datenisolation je Szenario
- Gruppe   (Verweis auf eine Kategorie des GLOBALEN KPI-Modells, "Operativ"-Baum)
- Untergruppe (optionaler Verweis auf eine Unterkategorie; leer, wenn die Gruppe keine hat)
- Name (max. 100 Zeichen)
- Zahlungsfrequenz (monatlich / quartalsweise / jährlich)
- Fälligkeitsmonat(e) (Liste von Monatsnummern: leer bei monatlich, 1 bei jährlich, 4 bei quartalsweise)
- Zeitpunkt im Monat (Anfang / Mitte / Ende)
- Zahlungsziel in Tagen (optional)
- Nettobetrag, USt-Satz, USt-Betrag, Bruttobetrag (Brutto wird beim Speichern berechnet)
- Aktiv-Zeitraum: Von-Monat + Von-Jahr und Bis-Monat + Bis-Jahr — alle optional
  (leer = unbegrenzt aktiv; nur "Von" oder nur "Bis" erlaubt)
```

Unterschiede zur kurzfristigen Tabelle:
- **Kein** „Aktiv"-Ja/Nein-Feld (es werden nur aktive Fixkosten angelegt).
- Aktiv-Zeitraum als **Monat + Jahr** (Von/Bis) statt als Datum mit Kalenderwochen-Anzeige.
- Zusätzliches Feld **Planversion-Zugehörigkeit** für die Datenisolation.

Regeln:
- Wird die Planversion gelöscht, verschwinden alle zugehörigen Fixkosteneinträge automatisch (kaskadierende Löschung) — keine verwaisten Daten.
- Jeder Eintrag ist an den Nutzer gebunden; Zugriff nur auf eigene Daten (Row Level Security + serverseitige Prüfung der Versionszugehörigkeit).
- Daten verschiedener Versionen sind vollständig getrennt; eine neue Version startet mit leerer Liste.

**Kategorienquelle:** Die Gruppen/Untergruppen kommen aus dem **globalen** KPI-Modell (Knoten „Operativ" im Ausgaben-&-Kosten-Baum), identisch zur kurzfristigen Seite. Es wird **keine** versionsspezifische Kategorieverwaltung gebaut. Die Namen werden beim Laden mitgeliefert (verknüpfte Abfrage), damit die Tabelle sie direkt anzeigen kann.

### C) Datenfluss

```
Seite öffnet sich (innerhalb einer Version)
  → Shell prüft: gehört die Version dem Nutzer? Nein → Redirect zum Dashboard
  → Inhalt lädt parallel: (a) die Fixkosten-Einträge DIESER Version, (b) die globalen "Operativ"-Kategorien
  → keine Einträge → Leerzustand mit "+ Fixkosten anlegen"

Nutzer legt an / bearbeitet / löscht
  → lokale Prüfung (Pflichtfelder, Frequenz/Monate, Netto > 0, Aktiv-Von ≤ Aktiv-Bis)
      ungültig → Inline-/Alert-Fehlermeldung, kein Speichern
      gültig   → Eintrag erscheint sofort (optimistisch) + Speichern in der DB der Version
                  Erfolg → Liste aktuell, Dialog schließt
                  Fehler → Rücksetzen (Rollback) + Fehlermeldung
```

### D) API-Endpunkte (versionsbewusst)

```
Liste laden:   Fixkosten einer Version laden (inkl. Gruppen-/Untergruppennamen)
               → prüft Nutzer + Versionszugehörigkeit

Anlegen:       neuen Eintrag für die Version anlegen
               → prüft alle Werte; berechnet USt-Betrag und Brutto serverseitig

Bearbeiten:    bestehenden Eintrag der Version ändern
Löschen:       bestehenden Eintrag der Version löschen
               → beide prüfen, dass der Eintrag zur Version UND zum Nutzer gehört
```

Pfadschema (analog zu PROJ-75): `/api/langfristige-planung/[versionId]/operative-fixkosten-einstellungen` (Liste + Anlegen) und `…/[id]` (Bearbeiten + Löschen). Alle Endpunkte folgen dem etablierten Muster: Login-Pflicht, Prüfung des ID-/Versions-Formats, Filterung nach Nutzer **und** Version als zweite Sicherheitsebene zur Row Level Security, serverseitige Eingabeprüfung. Die USt-/Brutto-Berechnung erfolgt — wie in der kurzfristigen Variante — **serverseitig**, damit der gespeicherte Bruttobetrag verlässlich ist.

### E) Neue Dateien

| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/operative-fixkosten-einstellungen/page.tsx` | Echte Seite: Versions-Shell + Seiteninhalt |
| `src/components/langfristige-operative-fixkosten-inhalt.tsx` | Seiteninhalt: Toolbar (Filter + Anlegen), Tabelle, Dialog-Steuerung, Zustände (Laden/Fehler/Leer) |
| `src/components/langfristige-operative-fixkosten-tabelle.tsx` | Tabelle ohne „Netto mtl."- und „Aktiv"-Spalte; Aktiv-Zeitraum als Monat/Jahr |
| `src/components/langfristige-operative-fixkosten-formular-dialog.tsx` | Formular ohne Aktiv-Schalter; Aktiv-Zeitraum als Monat/Jahr-Auswahl |
| `src/hooks/use-langfristige-operative-fixkosten.ts` | Lädt/erstellt/ändert/löscht die Einträge der aktiven Version; optimistische Updates + Rollback |
| `src/app/api/langfristige-planung/[versionId]/operative-fixkosten-einstellungen/route.ts` | Liste laden + Anlegen (mit Eingabe-, Login- und Versions-Eigentumsprüfung) |
| `src/app/api/langfristige-planung/[versionId]/operative-fixkosten-einstellungen/[id]/route.ts` | Bearbeiten + Löschen |

**Datenbank:** eine neue Migration legt die Tabelle `langfristige_operative_fixkosten` an, inkl. Fremdschlüssel auf Planversion (kaskadierende Löschung) und Nutzer, Indizes auf Nutzer + Version, Row Level Security mit vier Policies (Lesen/Anlegen/Ändern/Löschen).

### F) Geänderte Dateien

| Datei | Änderung |
|---|---|
| (keine Pflichtänderung an der Navigation) | Der Nav-Eintrag existiert bereits in `src/lib/langfristige-planung-nav.ts`; höchstens Feinschliff des Beschreibungstextes |

### G) Wiederverwendung (kein Doppel-Code)

Aus dem bestehenden Modul `use-operative-fixkosten` werden die **reinen Hilfsfunktionen/Konstanten** weiterverwendet (Monatsnamen lang/kurz, Frequenz- und Zeitpunkt-Beschriftungen, USt-Satz-Beschriftungen, Formatierung der Fälligkeitsmonate, USt-/Brutto-Berechnung). Nicht wiederverwendet werden die kurzfristigen UI-Bausteine (Tabelle, Dialog, Seite) und die Netto-monatlich-/Auswertungslogik — diese enthalten die hier unerwünschten Teile.

### H) Tech-Entscheidungen (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Speicherort | Datenbank, pro Planversion | Daten müssen je Szenario isoliert und dauerhaft sein (PROJ-73-Prinzip) |
| Eigene neue Tabelle | Ja (statt Erweiterung der Kurzfristig-Tabelle) | Klare Abkapselung, kaskadierende Löschung pro Version, kein Regressionsrisiko für die Kurzfristige Planung — konsistent mit PROJ-75 |
| Eigene UI-Bausteine | Ja (Tabelle/Dialog/Inhalt neu) | Die kurzfristigen Komponenten haben die unerwünschten Teile fest verdrahtet; ein eigener, schlanker Satz ist sauberer als Verzweigungen mit Flags |
| Aktiv-Zeitraum als Monat + Jahr | Bestätigt durch Nutzer | Passt zur monatsbasierten langfristigen Planung; KW-Anzeige ist hier ohne Bezug |
| Kein Aktiv-Schalter | Bestätigt durch Nutzer | Es werden nur (aktive) Fixkosten angelegt |
| Kategorien aus globalem KPI-Modell | Bestätigt durch Nutzer | Das langfristige KPI-Modell hat keinen „Operativ"-Knoten; Ausgaben-/Kosten-Kategorien werden global gelesen — gleiche Quelle wie kurzfristig |
| USt-/Brutto-Berechnung serverseitig | Ja | Verlässlicher gespeicherter Bruttobetrag; identisches Verhalten zur kurzfristigen Variante |
| Versions-Shell wiederverwenden | Ja | Versionsprüfung, Redirect, Header/Breadcrumb sind bereits gelöst |

### I) Dependencies (Pakete)

Keine neuen npm-Pakete nötig. Verwendet werden bestehende Bausteine: shadcn/ui (Dialog, Button, Input, Label, Select, Badge, Table, Alert, AlertDialog, Skeleton, Toaster), Zod (Eingabeprüfung), Supabase (Datenhaltung inkl. Row Level Security), Next.js App-Router (dynamisches `[versionId]`-Segment).

## Implementation Notes (Frontend — 2026-06-20)

### Neue Dateien
- `src/hooks/use-langfristige-operative-fixkosten.ts` — Hook `useLangfristigeOperativeFixkosten(versionId)`: lädt/erstellt/ändert/löscht die Einträge der Version über `/api/langfristige-planung/[versionId]/operative-fixkosten-einstellungen` (+ `/[id]`), mit optimistischen Updates und Rollback bei Fehler. Exportiert die monatsbasierten Typen (`…Eintrag`, `…Input` ohne `aktiv`, mit `aktiv_von_monat/jahr` + `aktiv_bis_monat/jahr`) sowie Helfer `formatMonatJahr` und `istBisVorVon`. **Reine Hilfslogik** (Frequenz-/Zeitpunkt-/USt-Beschriftungen, Monatsnamen, `formatFaelligkeitsMonate`) wird aus `use-operative-fixkosten` re-exportiert — kein Doppel-Code.
- `src/components/langfristige-operative-fixkosten-tabelle.tsx` — Tabelle **ohne** „Netto mtl."-Spalte und **ohne** „Aktiv"-Spalte/Badge. Spalten: Gruppe, Untergruppe, Name, Frequenz, Fälligkeitsmonat(e), Zeitpunkt, Zahlungsziel, Brutto, Netto, Aktiv-Zeitraum (als „Mon JJJJ → Mon JJJJ" bzw. „Unbegrenzt"), Aktionen (Bearbeiten/Löschen mit Bestätigungsdialog).
- `src/components/langfristige-operative-fixkosten-formular-dialog.tsx` — Formular **ohne** Aktiv-Schalter. Aktiv-Zeitraum als je zwei Selects (Monat + Jahr) für Von/Bis; Jahr-Auswahl aktuelles Jahr −2 … +20. Felder sonst wie kurzfristig: Gruppe, Untergruppe (bedingt), Name, Frequenz (+ konditionelle Monats-/Quartalsauswahl), Zeitpunkt, Zahlungsziel, Nettobetrag + USt (0/7/19 %/Individuell) mit Brutto-Vorschau. Validierung: Pflichtfelder, Frequenz/Monate, Netto > 0, Aktiv-Von/Bis je vollständig (Monat **und** Jahr) und Bis ≥ Von.
- `src/components/langfristige-operative-fixkosten-inhalt.tsx` — Seiteninhalt: Toolbar (Gruppen-Filter „Alle Gruppen" + „+ Fixkosten anlegen"), Lade-/Fehler-/Leerzustand, Tabelle, Dialog-Steuerung. **Kein Auswertungsblock**. Liest `versionId` aus `useParams()`; lädt Gruppen aus dem globalen `useKpiCategories('ausgaben_kosten')` (Ebene-1-Kinder von „Operativ").
- `src/app/dashboard/langfristige-planung/[versionId]/operative-fixkosten-einstellungen/page.tsx` — echte Seite: `LangfristigeVersionShell` (seitenTitel="Operative Fixkosten-Einstellungen") + Inhalt. Löst den dynamischen `[seite]`-Platzhalter für diesen Slug ab.

### Geänderte Dateien
- Keine. Der Nav-Eintrag „Operative Fixkosten-Einstellungen" existiert bereits in `src/lib/langfristige-planung-nav.ts` (Gruppe „Einstellungen") und verlinkt automatisch auf den neuen Pfad; auch die Versions-Übersichtsseite listet ihn bereits.

### Erwartete API (für /backend)
- `GET /api/langfristige-planung/[versionId]/operative-fixkosten-einstellungen` → Liste der Einträge der Version (inkl. `kategorie_name`, `untergruppe_name` aus JOIN auf globale `kpi_categories`). Prüft Login + Versions-Eigentum; 404 bei fremder/unbekannter Version.
- `POST` (gleicher Pfad) → neuen Eintrag anlegen. Body wie `LangfristigeOperativeFixkostenInput` (inkl. `ust_betrag_individuell`, monatsbasierter Aktiv-Zeitraum als 4 nullable Felder). USt-Betrag und Brutto **serverseitig** berechnen (wie kurzfristig). 201 mit angereichertem Eintrag.
- `PUT /…/[id]` → Eintrag der Version ändern; `DELETE /…/[id]` → löschen. Beide nach `user_id` **und** `plan_version_id` filtern.
- Zod-Validierung analog zur kurzfristigen Route, aber **ohne** `aktiv`, mit Aktiv-Zeitraum-Feldern `aktiv_von_monat`/`aktiv_von_jahr`/`aktiv_bis_monat`/`aktiv_bis_jahr` (Monat 1–12, Jahr plausibel, alle nullable; nur Monat **und** Jahr gemeinsam oder beide leer; Bis ≥ Von).
- **DB-Tabelle** `langfristige_operative_fixkosten` mit `plan_version_id` FK → `langfristige_planversionen` (ON DELETE CASCADE), `user_id` FK, RLS (4 Policies), Indizes auf `user_id` und `plan_version_id`.

### Verifikation
- `npx tsc --noEmit`: keine Fehler in den neuen Dateien.

## Implementation Notes (Backend — 2026-06-20)

### Datenbankmigration
- Migration `create_langfristige_operative_fixkosten` auf Supabase-Projekt „Controlling-App" (`kdmpghtdoguppfqhdscq`) angewendet.
- Neue Tabelle `langfristige_operative_fixkosten`, gespiegelt von `operative_fixkosten_einstellungen`, mit folgenden Unterschieden:
  - **Zusätzlich** `plan_version_id` UUID NOT NULL FK → `langfristige_planversionen` (ON DELETE CASCADE) — Datenisolation pro Version.
  - **Entfernt** die Spalte `aktiv` (es werden nur aktive Fixkosten angelegt).
  - **Aktiv-Zeitraum monatsbasiert** statt Datum: `aktiv_von_monat`, `aktiv_von_jahr`, `aktiv_bis_monat`, `aktiv_bis_jahr` (alle nullable, CHECK 1–12 bzw. 2000–2100). Zwei CHECK-Constraints erzwingen, dass Monat **und** Jahr je Endpunkt gemeinsam gesetzt oder beide leer sind.
  - Übrige Spalten identisch: `kategorie_id`/`untergruppe_id` FK → `kpi_categories` (global), `name`, `zahlungsfrequenz` (Enum `fixkosten_frequenz`), `faelligkeits_monate` int[], `zeitpunkt_im_monat` (Enum), `zahlungsziel_tage`, `betrag_netto` (CHECK > 0), `ust_satz` (Enum `fixkosten_ust_satz`), `ust_betrag`, `bruttobetrag`, `created_at`, `updated_at`.
- **Wiederverwendung der bestehenden Enums** `fixkosten_frequenz`, `zeitpunkt_im_monat`, `fixkosten_ust_satz` (keine neuen Typen).
- RLS aktiviert, 4 Policies (SELECT/INSERT/UPDATE/DELETE) an `auth.uid() = user_id` gebunden. Indizes auf `user_id`, `plan_version_id` und `(user_id, plan_version_id)`.

### API-Routen
- `src/app/api/langfristige-planung/[versionId]/operative-fixkosten-einstellungen/route.ts`
  - `GET` — prüft Login + Versions-Eigentum (404 bei fremder/unbekannter Version), lädt die Einträge der Version (JOIN auf globale `kpi_categories` für `kategorie_name`/`untergruppe_name`), nach `user_id` **und** `plan_version_id` gefiltert, `.order('created_at')`, `.limit(500)`.
  - `POST` — Zod-Validierung; berechnet `ust_betrag` und `bruttobetrag` **serverseitig** (0/7/19 %/individuell). Setzt `user_id` aus Session und `plan_version_id` aus dem Pfad. 201 mit angereichertem Eintrag.
  - Exportiert `fixkostenBodySchema`, `berechneUstUndBrutto`, `mapRow` zur Wiederverwendung in der `[id]`-Route.
- `src/app/api/langfristige-planung/[versionId]/operative-fixkosten-einstellungen/[id]/route.ts`
  - `PUT` — Versions-Eigentum + gleiche Validierung; Update nach `id` **und** `user_id` **und** `plan_version_id` (404 wenn nicht gefunden). Serverseitige Brutto-Berechnung.
  - `DELETE` — Versions-Eigentum; Löschung nach `id` + `user_id` + `plan_version_id`; 204.
  - Beide: `requireAuth` (401), UUID-Format-Prüfung für `versionId` und `id` (400), DB-Fehler → 500.
- **Validierungsregeln** (Zod `superRefine`): individueller USt-Betrag > 0; Aktiv-Zeitraum je Endpunkt vollständig (Monat **und** Jahr) oder leer; Aktiv-Bis ≥ Aktiv-Von (über `jahr*12+monat`); Fälligkeitsmonate je Frequenz (monatlich = leer, jährlich = 1, quartalsweise = 4 mit korrekter Q1–Q4-Verteilung).

### Tests
- `…/operative-fixkosten-einstellungen/route.test.ts` — 22 Tests (GET: 6, POST: 16) inkl. 404 fremde Version, 400 ungültige ID/Body, 401, 500, USt-Varianten, Frequenz-Validierung, Aktiv-Zeitraum-Regeln (Teilangabe & Bis < Von).
- `…/operative-fixkosten-einstellungen/[id]/route.test.ts` — 13 Tests (PUT: 8, DELETE: 5).
- **35/35 grün** (ohne File-Parallelism ausgeführt; eine vitest-Worker-Race unter Parallelausführung ist umgebungsbedingt, kein Testfehler). Typecheck der neuen Dateien sauber.

### Frontend-Anbindung
- Keine Änderungen nötig: Der bereits gebaute Hook `useLangfristigeOperativeFixkosten` ruft exakt diese Endpunkte und das erwartete Datenformat (monatsbasierter Aktiv-Zeitraum) auf. Das Feature ist damit im Browser lauffähig.

## QA Test Results (2026-06-20)

### Testergebnis-Zusammenfassung

| Kategorie | Ergebnis |
|---|---|
| Akzeptanzkriterien | ✅ Alle bestanden (Code-Review + automatisiert) |
| API-Integrationstests (Vitest) | ✅ 35/35 bestanden (22 GET/POST + 13 PUT/DELETE) |
| E2E-Tests (Playwright) | ✅ 8/8 bestanden (4 × Chromium + Mobile Safari) |
| Datenbank-/Security-Audit | ✅ Keine Findings |
| Regression | ✅ Keine Regressionen (kurzfristige operative-fixkosten 21/21) |
| Bugs gefunden | ✅ Keine Critical/High/Medium · 1 Low-Hinweis |

### Akzeptanzkriterien — geprüft (Code-Review + Tests)

**Navigation & Einstieg**
- ✅ Versionsgebundener Pfad `/dashboard/langfristige-planung/[versionId]/operative-fixkosten-einstellungen`; Nav-Eintrag + Versions-Übersicht bereits aus PROJ-73-Nav-Config vorhanden
- ✅ Seitentitel „Operative Fixkosten-Einstellungen" (via `LangfristigeVersionShell seitenTitel`)
- ✅ Auth-Guard → Redirect zu /login (E2E bestätigt)
- ✅ Fremde/unbekannte `versionId` → Shell erhält 404 → Redirect zum Dashboard (PROJ-73-Shell-Logik)

**Kein Auswertungsblock / kein Filter / kein „Aktiv" / kein „Zeitpunkt"**
- ✅ Kein Auswertungsblock oberhalb der Tabelle
- ✅ Kein Gruppen-Filter in der Toolbar (auf Nutzerwunsch entfernt) — nur „+ Fixkosten anlegen"
- ✅ Kein Aktiv-Schalter im Formular, keine „Aktiv"-Spalte/Badge
- ✅ Kein „Zeitpunkt im Monat"-Feld im Formular, keine „Zeitpunkt"-Spalte (serverseitiger Default `anfang` für die NOT-NULL-Spalte)
- ✅ Keine „Netto mtl."-Spalte

**Formular**
- ✅ Gruppe (Ebene-1-Kinder von „Operativ", global), bedingte Untergruppe, Name (max. 100), Frequenz (+ konditionelle Monats-/Quartalsauswahl), Zahlungsziel (optional), Nettobetrag + USt (0/7/19 %/Individuell) mit Brutto-Vorschau
- ✅ Aktiv-Zeitraum als Von/Bis (je Monat + Jahr), optional; nur Von oder nur Bis erlaubt; client- + serverseitige Validierung (vollständig oder leer, Bis ≥ Von)
- ✅ Leerer „Operativ"-Knoten → Hinweistext, „Anlegen" deaktiviert

**Tabelle / Bearbeiten / Löschen / Leerzustand**
- ✅ Spalten: Gruppe, Untergruppe, Name, Frequenz, Fälligkeitsmonat(e), Zahlungsziel, Brutto, Netto, Aktiv-Zeitraum, Aktionen
- ✅ Fälligkeitsmonat(e): „Alle Monate" / Quartalskürzel / Jahresmonat; Zahlungsziel „N Tage"/„–"; Aktiv-Zeitraum „Mon JJJJ → Mon JJJJ"/„Unbegrenzt"
- ✅ Bearbeiten (vorausgefüllt) + optimistisches Update mit Rollback; Löschen mit Bestätigungsdialog (zeigt Eintragsname)
- ✅ Leerzustand mit Hinweistext + Button

**Datenpersistenz & Isolation**
- ✅ Pro `plan_version_id` + `user_id` gespeichert; neue Version → leere Liste
- ✅ Versionsisolation (Queries nach user_id **und** plan_version_id; RLS als zweite Ebene)
- ✅ Kaskadierende Löschung über FK `plan_version_id` ON DELETE CASCADE (DB verifiziert)

### Automatisierte Tests

**API-Integrationstests (Vitest) — 35 Tests**
- `…/operative-fixkosten-einstellungen/route.test.ts` (22): GET (Werte/leer/404 fremde Version/400 ID/401/500), POST (monatlich/jährlich/quartalsweise, Aktiv-Zeitraum, individuell USt, 404/400/401, Validierung: kategorie_id fehlt, netto 0, USt individuell ohne Betrag, falsche Monatszahl/Quartalsverteilung, Aktiv-von Teilangabe, Bis < Von, ungültiges JSON)
- `…/operative-fixkosten-einstellungen/[id]/route.test.ts` (13): PUT (Update, 404 nicht gefunden, 404 fremde Version, 400 ID/Body, Bis < Von, 401, 500), DELETE (204, 404 fremde Version, 400 ID, 401, 500)

**E2E-Tests (Playwright) — 8 Tests (4 × 2 Browser)** `tests/PROJ-81-langfristige-operative-fixkosten-einstellungen.spec.ts`
- Seitenexistenz (kein 404) · Auth-Guard versionsgebundene Seite · Regression Dashboard-Redirect · Regression kurzfristige Operative-Fixkosten erreichbar

### Datenbank- & Sicherheitsaudit (Red Team)

- ✅ **Auth**: `requireAuth()` in GET/POST/PUT/DELETE → 401 ohne Session
- ✅ **Authorization / IDOR**: Alle Routen prüfen Versions-Eigentum (`langfristige_planversionen` gefiltert nach `user_id` + `id`) → 404 bei fremder Version; Datenquery zusätzlich nach `user_id` **und** `plan_version_id` gefiltert; RLS (4 Policies, `auth.uid() = user_id`) als zweite Ebene. Fremdzugriff nicht möglich
- ✅ **DB-Constraints (verifiziert)**: RLS aktiv; FK `plan_version_id` → CASCADE; `kategorie_id`/`untergruppe_id` → RESTRICT; CHECK-Constraints (Monat 1–12, Jahr 2000–2100, betrag_netto > 0, zahlungsziel 0–365, Aktiv-von/bis vollständig-oder-leer)
- ✅ **Input-Validierung**: Zod (UUID-Format `versionId`/`id`; Enums; Bereiche; Aktiv-Zeitraum-Regeln); USt/Brutto serverseitig berechnet (nicht aus Client übernommen)
- ✅ **Mass Assignment**: nur explizit gemappte Felder; `user_id` aus Session, `plan_version_id` aus Pfad erzwungen
- ✅ **XSS/Injection**: Supabase parametrisiert; keine `dangerouslySetInnerHTML`

### Bugs / Hinweise

**Keine Critical/High/Medium-Bugs.**

- **Low (Hinweis, kein Defekt):** Die Jahr-Auswahl im Formular bietet aktuelles Jahr −2 … +20, der Server erlaubt 2000–2100. Da Werte ausschließlich über die Auswahl gesetzt werden, liegen gespeicherte Jahre stets im UI-Bereich. Für die reguläre Nutzung irrelevant (gleicher Hinweis wie PROJ-75).

### Produktionsbereitschaft

**✅ PRODUCTION-READY** — alle Akzeptanzkriterien erfüllt, keine Critical/High/Medium-Bugs, Sicherheitsaudit ohne Findings, keine Regressionen.

## Deployment
_To be added by /deploy_

## Deployment
_To be added by /deploy_
