# PROJ-104: Planversion duplizieren — Langfristige Planung

## Status: Approved
**Created:** 2026-07-03
**Last Updated:** 2026-07-03

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — Planversionen und ihre Daten sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — liefert den Planversions-Container und alle versionsgebundenen Datentabellen, die kopiert werden
- Bezug (kein harter Require): PROJ-103 (Planversionen-Ordner) — falls vorhanden, wird die Ordnerzuordnung des Originals mitübernommen
- Bezug: PROJ-74 bis PROJ-101 — sämtliche versionsgebundenen Einstellungs-, Planungs- und Auswertungsdaten dieser Features gehören zum kopierten Umfang

## Overview
Aktuell startet jede neue Planversion in der Langfristigen Planung komplett leer (PROJ-73). Wer ein bestehendes Szenario nur leicht abwandeln möchte (z.B. „Basisplan 2027" → „Basisplan 2027 – optimistisch"), müsste alle Einstellungen und Planwerte erneut von Hand eingeben.

Dieses Feature ermöglicht das **Duplizieren** einer bestehenden Planversion: Über das Dreipunktemenü einer Planversion wählt der Nutzer **„Duplizieren"**. Es wird eine **vollständige Kopie** der Version als **neue, eigenständige Planversion** angelegt — inklusive **aller** darin gepflegten Daten. Die Kopie und das Original sind danach vollständig unabhängig: Änderungen an der einen wirken sich nicht auf die andere aus.

## User Stories
- Als Controller möchte ich eine bestehende Planversion über deren Dreipunktemenü mit „Duplizieren" komplett kopieren können, damit ich ein bewährtes Szenario als Ausgangsbasis für eine Variante nutze, statt von einer leeren Version zu starten.
- Als Controller möchte ich, dass die duplizierte Version **alle** Daten des Originals enthält (Einstellungen, Plandaten, Plattformen, Produkte, Notizen usw.), damit ich nur noch die gewünschten Stellen anpassen muss.
- Als Controller möchte ich, dass Original und Kopie danach vollständig getrennt sind, damit meine Anpassungen an der Kopie das Original nicht verändern (und umgekehrt).
- Als Controller möchte ich, dass die Kopie automatisch einen erkennbaren Namen erhält („… (Kopie)"), damit ich sie sofort vom Original unterscheiden kann, ohne einen Namen eintippen zu müssen.
- Als Controller möchte ich die duplizierte Version direkt in der Liste sehen und öffnen können, damit ich ohne Umwege weiterarbeiten kann.

## Acceptance Criteria

### Aktion „Duplizieren"
- [ ] Das Dreipunktemenü jeder Planversion (auf der Grundseite **und** innerhalb eines Ordners) enthält den Eintrag **„Duplizieren"**
- [ ] Ein Klick auf „Duplizieren" startet den Kopiervorgang ohne weiteren Pflicht-Dialog (Name wird automatisch vergeben, siehe unten)
- [ ] Während des Kopierens gibt es sichtbares Feedback (Ladezustand); nach Abschluss erscheint eine Erfolgsmeldung (Toast)
- [ ] Nach erfolgreichem Duplizieren erscheint die neue Version sofort in der Liste und ist sofort öffnenbar/bearbeitbar

### Namensvergabe der Kopie
- [ ] Die Kopie erhält automatisch den Namen des Originals mit dem Zusatz „ (Kopie)" (z.B. „Basisplan 2027" → „Basisplan 2027 (Kopie)")
- [ ] Existiert dieser Name bereits, wird automatisch hochgezählt: „ (Kopie 2)", „ (Kopie 3)" usw., bis ein eindeutiger Name gefunden ist
- [ ] Der erzeugte Name hält die bestehende Namensregel ein (eindeutig pro Nutzer, ≤ 100 Zeichen); ist der Basisname so lang, dass der Zusatz die Maximallänge sprengt, wird der Basisname passend gekürzt, damit ein gültiger, eindeutiger Name entsteht
- [ ] Der Nutzer kann die Kopie anschließend wie jede andere Version umbenennen (bestehende Umbenennen-Funktion, kein neuer Weg nötig)

### Kopierter Datenumfang (Vollkopie)
- [ ] Es werden **alle** versionsgebundenen Daten des Originals in die neue Version kopiert — u.a. Plattformen & Produkte, alle Einstellungsseiten, alle Planungsdaten und Zellen-Notizen, die per `plan_version_id` an die Version gebunden sind
- [ ] Interne Verweise zwischen kopierten Datensätzen (z.B. Plandaten, die auf eine versions-eigene Plattform/ein Produkt zeigen) werden so umgeschrieben, dass sie **innerhalb der Kopie** auf die kopierten Datensätze zeigen — nicht auf die Datensätze des Originals
- [ ] Verweise auf **globale** Daten (globales KPI-Kategoriemodell) bleiben als Verweis erhalten (dieses Modell wird nicht kopiert, nur mitgelesen — analog PROJ-73)
- [ ] Die Kopie liegt am **gleichen Ort** wie das Original: ordnerlos, wenn das Original ordnerlos ist; im selben Ordner, wenn das Original in einem Ordner liegt (Bezug PROJ-103)

### Unabhängigkeit von Original und Kopie
- [ ] Nach dem Duplizieren sind Original und Kopie vollständig entkoppelt: eine Änderung, Ergänzung oder Löschung in der Kopie verändert das Original **nicht** — und umgekehrt
- [ ] Das Löschen der Kopie lässt das Original unberührt; das Löschen des Originals lässt die Kopie unberührt
- [ ] Die kopierten Daten existieren ausschließlich in der Kopie und im Original — es entstehen keine geteilten/verknüpften Datensätze

### Sicherheit & Robustheit
- [ ] Nur der Besitzer einer Planversion kann sie duplizieren; das Duplizieren einer fremden/unbekannten `versionId` wird abgelehnt (behandelt wie nicht vorhanden)
- [ ] Der Kopiervorgang ist **atomar**: Schlägt er mitten im Kopieren fehl, bleibt **keine** halb befüllte Version zurück (entweder vollständige Kopie oder gar keine)

## Edge Cases
- **Duplizieren einer Version mit sehr vielen Daten:** Läuft vollständig durch; ggf. längere Ladezeit mit sichtbarem Feedback; keine Teilkopie bei Fehler.
- **Namenskollision der Kopie:** Automatisches Hochzählen „(Kopie 2/3/…)" bis ein eindeutiger Name entsteht.
- **Sehr langer Originalname (nahe 100 Zeichen):** Basisname wird gekürzt, damit „ (Kopie …)" passt und der Name gültig bleibt.
- **Original wird während des Kopierens (anderer Tab) gelöscht:** Sauberer Fehler-Hinweis, kein Absturz; entweder die Kopie ist bereits vollständig erstellt oder gar nicht (atomar).
- **Duplizieren einer Version in einem Ordner:** Kopie landet im selben Ordner; sofern der Ordner noch existiert. Existiert er nicht mehr, landet die Kopie ordnerlos auf der Grundseite (sauberer Fallback).
- **Duplizieren einer komplett leeren Version:** Ergibt eine ebenfalls leere Kopie mit „(Kopie)"-Namen — kein Fehler.
- **Mehrfaches Duplizieren derselben Version hintereinander:** Erzeugt „(Kopie)", „(Kopie 2)", „(Kopie 3)" usw., jeweils eigenständig.

## Technical Requirements
- **Backend nötig:** neuer Endpunkt zum Duplizieren einer Planversion (z.B. `POST /api/langfristige-planung/planversionen/[id]/duplicate`), der serverseitig die neue Version anlegt und **alle** per `plan_version_id` verknüpften Datensätze aller versionsgebundenen Tabellen kopiert
- **ID-Remapping:** Beim Kopieren müssen neue Primärschlüssel erzeugt und alle **internen** Fremdschlüssel (Verweise zwischen versions-eigenen Tabellen, z.B. Plandaten → Plattform/Produkt) auf die neuen IDs umgemappt werden; globale Verweise bleiben unverändert
- **Atomarität:** Kopiervorgang in einer Transaktion / serverseitig atomar, damit bei Fehlern keine halb kopierte Version zurückbleibt
- **Vollständigkeit:** Es muss ein verlässlicher Weg bestehen, **alle** versionsgebundenen Tabellen zu erfassen (Checkliste/Registry), damit beim Hinzufügen künftiger versionsgebundener Tabellen das Duplizieren mitgepflegt wird — Lücken würden zu unvollständigen Kopien führen
- **RLS/Sicherheit:** Eigentümerprüfung der Quell-Version serverseitig; alle kopierten Datensätze erhalten `user_id` des Nutzers
- **Validierung:** eindeutigen Namen serverseitig erzeugen und durchsetzen (case-insensitive, getrimmt, ≤ 100 Zeichen)
- **shadcn/ui first:** vorhandenes DropdownMenu der Planversion um „Duplizieren" erweitern; Toaster-Feedback wiederverwenden — keine Eigenbauten
- **Wiederverwendung:** `PlanversionenVerwaltung` und `use-planversionen`-Hook erweitern (neue `duplicate`-Aktion), bestehende Muster für optimistische Listenpflege/Fehlerbehandlung nutzen
- **Performance:** Duplizieren großer Versionen soll in vertretbarer Zeit abschließen; UI bleibt während des Vorgangs bedienbar bzw. zeigt klaren Ladezustand

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Duplizieren **in einen anderen** (vom Nutzer gewählten) Ordner statt an den Ort des Originals — bewusst ausgelagert (Standard: gleicher Ort)
- Duplizieren mit sofortiger Namens-Eingabe (Dialog) statt Auto-Name — bewusst ausgelagert (Standard: Auto-Name, danach umbenennbar)
- Duplizieren über Bereichsgrenzen hinweg (z.B. Kurzfristige → Langfristige Planung) — nicht Teil dieser Spec

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee
Duplizieren bedeutet: die Datenbank legt **eine neue Planversion** an und **kopiert jede Zeile**, die zur Ursprungsversion gehört, in die neue Version hinein. Weil die Langfristige Planung ihre Daten strikt pro Version in **vielen separaten Tabellen** ablegt (Fundament PROJ-73), ist Duplizieren im Kern ein **vollständiges, tiefes Kopieren über alle versionsgebundenen Tabellen** — mit einer wichtigen Feinheit: interne Verweise zwischen den kopierten Zeilen müssen auf die **neuen** Kopien umgebogen werden, damit die Kopie in sich geschlossen und vom Original unabhängig ist.

### A) Was genau kopiert wird — Bestandsaufnahme
Es gibt aktuell **43 versionsgebundene Tabellen** (alle tragen die Markierung „gehört zu Planversion X"). Sie zerfallen in drei Rollen:

**1) Versions-Stammdaten mit eigener Identität (müssen neue IDs bekommen und werden von anderen referenziert):**
```
- langfristige_kpi_kategorien   (Sales-Plattformen, Produkte, Marketingkanäle,
                                  Investitionskategorien u.a.; zusätzlich in sich
                                  verschachtelt über „übergeordnete Kategorie")
- langfristige_bestellungen      (einzelne Bestellungen der Bestellplanung)
- langfristige_produktinformationen_hersteller  (Herstellerliste)
```

**2) Tabellen, die auf diese Stammdaten verweisen (ihre Verweise müssen auf die Kopien zeigen):**
```
- fast alle Einstellungs- und Planungstabellen verweisen über
  „Produkt", „Sales-Plattform" bzw. „Marketingkanal" auf langfristige_kpi_kategorien
- langfristige_bestellungen_kosten          -> Bestellung
- langfristige_bestellungen_konsolidierungen -> zwei Bestellungen
- langfristige_produktinformationen_hersteller_zuordnung -> Hersteller (+ Produkt)
```

**3) Reine Werte-/Einstellungstabellen ohne eigene Weiterverweise** (werden einfach mitkopiert, nur die Versionszugehörigkeit wird auf die neue Version gesetzt).

**Wichtig — was NICHT kopiert wird:**
```
- Das GLOBALE KPI-Kategoriemodell (kpi_categories) und andere globale Stammdaten:
  Diese werden von der Langfristigen Planung nur mitgelesen. Verweise darauf
  bleiben als Verweis erhalten (zeigen weiter auf dasselbe globale Objekt).
- Berechnete/abgeleitete Werte (z.B. „…-berechnet"-Auswertungen): entstehen live
  aus den kopierten Rohdaten und müssen nicht kopiert werden.
```

### B) Der Kopiervorgang (in Klartext, Reihenfolge)
```
1. Neue Planversion anlegen (Name automatisch, siehe C; Ordner = wie Original, siehe D).
2. Stammdaten mit Identität kopieren und dabei eine Umschlüssel-Tabelle führen
   (alt-ID -> neu-ID):
     a) langfristige_kpi_kategorien kopieren; danach die interne Verschachtelung
        („übergeordnete Kategorie") auf die neuen IDs umbiegen.
     b) langfristige_bestellungen kopieren (alt-ID -> neu-ID merken).
     c) langfristige_produktinformationen_hersteller kopieren (alt-ID -> neu-ID merken).
3. Alle übrigen versionsgebundenen Tabellen kopieren; beim Kopieren jeder Zeile:
     - Versionszugehörigkeit = neue Version
     - Verweise auf Produkt/Plattform/Marketingkanal, Bestellung, Hersteller
       über die Umschlüssel-Tabelle auf die neuen IDs setzen
     - Verweise auf GLOBALE Objekte unverändert lassen
4. Fertig: die neue Version ist in sich geschlossen und vollständig unabhängig.
```

### C) Namensvergabe der Kopie
```
- Grundname = Name des Originals + " (Kopie)".
- Existiert dieser bereits: " (Kopie 2)", " (Kopie 3)", … bis eindeutig.
- Ist der Name dann länger als 100 Zeichen, wird der Grundname passend gekürzt,
  sodass der Zusatz hineinpasst und der Name gültig & eindeutig bleibt.
- Eindeutigkeit wird — wie bei „Anlegen/Umbenennen" — serverseitig erzwungen.
```

### D) Ort der Kopie (Bezug PROJ-103)
```
- Liegt das Original in einem Ordner, bekommt die Kopie dieselbe Ordner-Zugehörigkeit.
- Liegt das Original frei, liegt auch die Kopie frei auf der Grundseite.
- Existiert der Ordner im Moment des Kopierens nicht mehr, landet die Kopie sauber
  frei auf der Grundseite (Fallback, kein Fehler).
Hinweis: Funktioniert auch ohne PROJ-103 (dann gibt es nur „frei").
```

### E) Technischer Ansatz: eine atomare Datenbank-Routine
Der gesamte Kopiervorgang läuft als **eine einzige, in sich abgeschlossene Datenbank-Operation** (eine serverseitige Datenbank-Routine, die in **einer Transaktion** arbeitet). Das hat zwei Gründe:
- **Atomarität:** Entweder die Kopie entsteht vollständig — oder gar nicht. Bricht etwas ab, bleibt **keine** halbe Version zurück. (Ein Kopieren „Tabelle für Tabelle" über viele einzelne Netzwerkaufrufe könnte mittendrin abbrechen und Datenmüll hinterlassen — das wird so vermieden.)
- **Verlässliches Umschlüsseln:** Die alt→neu-ID-Zuordnung wird innerhalb derselben Operation gehalten, sodass alle Verweise konsistent umgebogen werden.

Nach außen bietet das Backend dafür **einen einzigen neuen Endpunkt** an („Version X duplizieren"), der Eigentum prüft, die Routine auslöst und die neue Version zurückgibt.

### F) Vollständigkeits-Sicherung (zentrale Registry) — kritisch
Damit die Kopie **nie unvollständig** ist, gibt es **eine einzige, zentrale Liste** aller versionsgebundenen Tabellen samt ihrer internen Verweisspalten — die **einzige Quelle der Wahrheit** für den Kopiervorgang. Wird künftig eine neue versionsgebundene Tabelle ergänzt (z.B. ein weiteres Planungsmodul), muss sie **an dieser einen Stelle** eingetragen werden, damit sie automatisch mitkopiert wird.
- Zusätzlich empfohlen: eine **automatische Prüfung** (Test/Selbstcheck), die die Datenbank nach Tabellen mit Versionsmarkierung durchsucht und meldet, falls eine Tabelle in der Registry fehlt. So fällt eine vergessene Tabelle sofort auf, statt still unvollständige Kopien zu erzeugen.

### G) Frontend (was sich ändert)
- Das bestehende Dreipunktemenü jeder Planversion (in `PlanversionenVerwaltung`) bekommt den Eintrag **„Duplizieren"**.
- Der Daten-Hook (`use-planversionen`) bekommt eine `duplicate`-Aktion (ruft den neuen Endpunkt, zeigt Ladezustand, fügt die neue Version optimistisch in die Liste ein, Erfolg/Fehler als Toast).
- Kein neuer Dialog nötig (Auto-Name); Umbenennen erfolgt danach über den bestehenden Weg.

### H) Tech-Entscheidungen (Begründung)
- **Tiefes serverseitiges Kopieren statt „Vorlagen light":** Die Produktanforderung ist eine echte, sofort bearbeitbare Vollkopie mit vollständiger Unabhängigkeit — das erfordert das Kopieren aller Rohdaten und das Umbiegen interner Verweise.
- **Atomare Datenbank-Routine statt App-seitiger Kopierschleife:** garantiert „ganz oder gar nicht" und hält die alt→neu-Zuordnung konsistent; deutlich robuster und schneller als viele Einzelaufrufe.
- **Zentrale Registry + Selbstcheck:** Die Datenmenge (43 Tabellen, wachsend) macht Vergessen zur größten Gefahr; eine einzige Pflegestelle plus automatische Vollständigkeitsprüfung ist die wirksamste Absicherung.
- **Globale Daten nicht kopieren:** Sie sind bewusst geteilt (nur lesend) — Kopieren würde Dubletten und Inkonsistenzen erzeugen.

### I) Abhängigkeiten (Pakete)
Keine neuen npm-Pakete. Verwendet werden: Supabase/Postgres (atomare Datenbank-Routine, RLS), Zod (Eingabe-/Eigentumsprüfung im Endpunkt), bestehende Frontend-Bausteine (DropdownMenu, Toast, `use-planversionen`).

### J) Umsetzungsreihenfolge (empfohlen)
1. Zentrale Registry der versionsgebundenen Tabellen + interner Verweisspalten aufbauen (inkl. Vollständigkeits-Selbstcheck gegen die Datenbank).
2. Atomare Kopier-Routine + neuen Duplizieren-Endpunkt (mit Eigentumsprüfung, Auto-Name, Ort-Übernahme).
3. Frontend: „Duplizieren" im Dreipunktemenü + `duplicate`-Aktion im Hook + Feedback.
4. Tests: Vollständigkeit (alle Tabellen mitkopiert), Unabhängigkeit (Änderung an Kopie lässt Original unberührt), korrektes Umschlüsseln interner Verweise, Namens-Hochzählen, Atomarität bei Fehler.

> Hinweis zum Zuschnitt: Der schwierige Teil ist Schritt 1–2 (vollständiges, korrektes, atomares Kopieren). Das Frontend (Schritt 3) ist klein. Der Aufwand steht und fällt mit der Registry-Vollständigkeit.

## Implementation Notes

### Frontend, 2026-07-03
Der „Duplizieren"-Einstieg und die Client-Aktion sind gebaut. Die eigentliche Kopier-Logik liegt im Backend (nächster Schritt) — die vom Frontend erwartete API ist unten beschrieben.

**Geänderte Dateien:**
- `src/hooks/use-planversionen.ts` — neue `duplicate(id)`-Aktion: `POST /api/langfristige-planung/planversionen/[id]/duplicate`, fügt die zurückgegebene neue Version optimistisch (alphabetisch einsortiert) in die Liste ein; Fehler via `PlanversionError` (Statuscode) wie die übrigen Aktionen.
- `src/components/planversionen-verwaltung.tsx` — Dreipunktemenü jeder Planversion (auf der Grundseite **und** im Ordner) um den Eintrag **„Duplizieren"** (Icon `Copy`) erweitert. `handleDuplicate` mit Ladezustand (`duplicatingId`): während des Kopierens zeigt die betroffene Karte „Wird dupliziert…" statt „Öffnen" und ist nicht anklickbar; Doppelklick verhindert (Menüeintrag disabled, solange eine Duplizierung läuft). Erfolg/Fehler als Toast. Die neue Version erscheint sofort in der Liste (Auto-Name „… (Kopie)" kommt vom Server).

**Design-Entscheidungen:**
- Kein Dialog beim Duplizieren (Auto-Name serverseitig); Umbenennen danach über den bestehenden Weg.
- Der Ladezustand ist bewusst pro Karte sichtbar, weil das Kopieren großer Versionen (viele Tabellen) einen Moment dauern kann; die restliche UI bleibt bedienbar.

**Erwartete API (für `/backend`):**
- `POST /api/langfristige-planung/planversionen/[id]/duplicate` → **201** mit der neuen `Planversion` (`{ id, name, ordner_id, created_at, updated_at }`).
  - Name automatisch: „<Original> (Kopie)", bei Kollision „(Kopie 2)", „(Kopie 3)" … (serverseitig eindeutig erzwungen, ≤ 100 Zeichen; Basisname bei Bedarf kürzen).
  - `ordner_id` = wie Original (gleicher Ordner; Fallback auf Grundseite, wenn Ordner nicht mehr existiert).
  - Kopiert **alle** versionsgebundenen Daten atomar; interne Verweise auf die Kopien umgemappt (siehe Tech Design).
  - `401` unauth, `404` bei fremder/unbekannter Quell-Version, Fehler als `{ error: string }`. Bei Abbruch bleibt **keine** halbe Version zurück (atomar).

**Hinweis:** Typecheck sauber für die geänderten Dateien. Bis der Endpunkt existiert, schlägt „Duplizieren" mit einem Fehler-Toast fehl — das löst sich mit dem `/backend`-Schritt.

### Backend (atomare Kopier-Funktion + Endpunkt), 2026-07-03
Die Vollkopie ist als **eine** atomare Datenbank-Funktion umgesetzt; der Endpunkt ruft sie nur auf.

**Datenbank (Supabase-Projekt „Controlling-App"):**
- Funktion `public.duplicate_langfristige_planversion(p_source_id uuid)` → gibt die neue `langfristige_planversionen`-Zeile zurück. `SECURITY INVOKER` (RLS + `auth.uid()` greifen), `SET search_path = public`.
- Ablauf (alles in **einer** Transaktion → ganz oder gar nicht):
  1. Eigentum/Existenz der Quell-Version prüfen (`auth.uid()`), sonst `P0002` → 404.
  2. Eindeutigen Auto-Namen bilden: „<Name> (Kopie)", bei Kollision „(Kopie 2/3/…)"; bei > 100 Zeichen wird der Basisname gekürzt.
  3. Neue Version anlegen (**gleicher `ordner_id`** wie Original → gleicher Ort, PROJ-103).
  4. **Tabellenliste dynamisch** aus dem Schema ermitteln (alle Tabellen mit `plan_version_id`) → keine zu pflegende Registry, künftige versionsgebundene Tabellen werden **automatisch** mitkopiert. Reihenfolge: Hubs zuerst (`langfristige_kpi_kategorien`, `…_hersteller`, `langfristige_bestellungen`), dann der Rest (FK-sicher).
  5. **Globale alt→neu-ID-Zuordnung** (Temp-Tabelle) für alle Zeilen aller versionsgebundenen Tabellen der Quelle. Die Zuordnung ist **ordnungserhaltend** (i-te kleinste alte ID → i-te kleinste neue ID) — dadurch bleiben ordnungsbasierte CHECKs wie `bestellung_id_1 < bestellung_id_2` (Konsolidierungen) gültig.
  6. Jede Tabelle per `INSERT … SELECT` kopieren; **jede** UUID-Spalte über die Zuordnung umbiegen (`plan_version_id` → neue Version, `user_id` unverändert, sonstige uuid → `COALESCE(map, original)`: interne Refs → Kopie, globale/fremde IDs bleiben). Das deckt auch **nicht als FK deklarierte** Referenzspalten ab (z.B. `kategorie_id`, `kpi_kategorie_id`, `quelle_id`, `produkt_id` ohne Constraint) — verhindert stille Cross-Version-Verweise.
- Security-Advisor nach der Migration: keine neue Warnung für die Funktion.

**API-Route:**
- `src/app/api/langfristige-planung/planversionen/[id]/duplicate/route.ts` — `POST`: `requireAuth` (401), UUID-Prüfung (400), ruft die RPC, `P0002`/`planversion_not_found` → 404, sonst 500; Erfolg → **201** mit der neuen Version.

**End-to-End-Verifikation gegen echte Daten** (Testkopie einer realen Version mit Daten, danach wieder gelöscht):
- **Vollständigkeit:** 35 Tabellen mit Daten, **963 Zeilen Quelle = 963 Zeilen Kopie**, alle Tabellen-Counts identisch.
- **Referenzielle Korrektheit:** **0** Referenzspalten der Kopie zeigen auf Quell-Zeilen (kein Cross-Version-Leak) — generisch über alle uuid-Spalten geprüft.
- **CHECK-Constraint** `bestellung_id_1 < bestellung_id_2`: nach ordnungserhaltender Zuordnung erfüllt.
- **Auto-Name:** 2. Duplikat korrekt „(Kopie 2)".
- **Atomarität:** einzelne DB-Funktion/Transaktion → bei Fehler keine halbe Version (im ersten Testlauf brach der CHECK-Fehler alles sauber ab, keine Reste).

**Tests:** `planversionen/[id]/duplicate/route.test.ts` — **6/6 grün** (201, 400 ungültige UUID, 404 via Code & Message, 500, 401). Typecheck sauber.

**Frontend-Anbindung:** Keine Änderung nötig — der in der Frontend-Iteration gebaute `duplicate`-Hook trifft exakt diesen Endpunkt. „Duplizieren" ist damit im Browser funktionsfähig.

## QA Test Results

**Getestet:** 2026-07-03 · **Methode:** Code-Audit gegen alle AC, Vitest-Integrationstests, tiefe DB-Verifikation (Vollständigkeit/Referenzen/Unabhängigkeit gegen echte Daten, Testkopien danach gelöscht), E2E-Auth/Regression (Playwright), Red-Team-Security-Audit.

### Zusammenfassung
- **Acceptance Criteria:** alle bestanden.
- **Automatisierte Tests:** 6/6 Route-Tests (`duplicate`) grün, 33/33 in den Planversionen-Suites, 3/3 E2E grün. Typecheck sauber.
- **Bugs:** 0 Critical · 0 High · 0 Medium · 3 Low.
- **Production-Ready:** **JA** (keine Critical/High-Bugs).

### Acceptance Criteria (alle ✅)
| Bereich | Ergebnis | Nachweis |
|---|---|---|
| „Duplizieren" im Dreipunktemenü (Grundseite & Ordner), Ladezustand, sofort in Liste | ✅ | Frontend-Audit; Karte zeigt „Wird dupliziert…", Menü disabled während Lauf |
| Auto-Name „(Kopie)", Kollision → „(Kopie 2/3…)" | ✅ | DB-Test: 1. Kopie „(Kopie)", 2. Kopie „(Kopie 2)" |
| Vollkopie **aller** versionsgebundenen Daten | ✅ | DB-Test: 35 Tabellen, **963 Zeilen Quelle = 963 Kopie**, alle Counts identisch |
| Interne Verweise auf die Kopie umgemappt (keine globalen kopiert) | ✅ | DB-Test: **0** Referenz-Leaks zur Quelle (generisch über alle uuid-Spalten) |
| Kopie am selben Ort wie Original (Ordner) | ✅ | Kopie übernahm `ordner_id` des Originals |
| Original & Kopie vollständig unabhängig (beидseitig) | ✅ | DB-Test: Kopie mutieren/löschen ⇒ Original unverändert & intakt |
| Nur Besitzer darf duplizieren; fremde/unbekannte Quelle → 404 | ✅ | DB-Test: fremder `auth.uid()` → `P0002`; Route → 404 |
| Atomar (keine halbe Version bei Fehler) | ✅ | Eine DB-Transaktion; erster CHECK-Fehler im Build brach sauber ab, keine Reste |

### Edge Cases (alle ✅)
- **Leere Version duplizieren:** Kopie ohne Daten, kein Fehler.
- **100-Zeichen-Name:** Kopie-Name auf genau 100 gekürzt, endet auf „ (Kopie)", gültig & eindeutig.
- **Version in Ordner:** Kopie landet im selben Ordner (Ordner existiert garantiert — FK `ON DELETE RESTRICT` verhindert Löschen belegter Ordner).
- **Ordnungsbasierter CHECK** `bestellung_id_1 < bestellung_id_2`: durch ordnungserhaltende ID-Zuordnung erfüllt.

### Security-Audit (Red Team)
- **Auth-Guard:** unauth `POST …/duplicate` → 307 `/login`, keine Kopie (live geprüft). ✅
- **Authorization:** Funktion prüft `user_id = auth.uid()`; fremde Version → `planversion_not_found` (404). Kopierte Zeilen behalten `user_id` des Nutzers; RLS + `user_id`-Filter greifen. ✅
- **`SECURITY INVOKER` + `SET search_path = public`:** kein Rechte-/Search-Path-Missbrauch; Security-Advisor ohne neue Warnung. ✅
- **Injektion:** Namen/Daten parametrisiert; dynamisches SQL nutzt `format('%I')`/`%L` (Identifier/Literal-Escaping) ausschließlich über Schema-Metadaten, keine Nutzereingaben in Struktur. ✅

### Regression
- Planversionen- & Ordner-Routen weiterhin grün (33 Tests). PROJ-103-Flows unberührt.
- Kurzfristige Planung weiterhin erreichbar (E2E).

### Gefundene Bugs (alle Low, nicht blockierend)
- **Low #1 — Zeitstempel der kopierten Datenzeilen:** Die 963 kopierten Datensätze behalten `created_at`/`updated_at` des Originals (die neue **Version** selbst bekommt frische Zeitstempel). Rein informativ; keine bekannte Logik sortiert Planungsdaten nach diesen Feldern. Falls „Erstellt am" der Kopie relevant würde, müssten diese Spalten beim Kopieren auf `now()` gesetzt werden.
- **Low #2 — Race bei parallelem Duplizieren derselben Version:** Zwei gleichzeitige Duplizier-Requests derselben Version könnten beide „(Kopie)" berechnen; einer scheitert am Unique-Index (23505) → 500 statt eleganter Weiterzählung. In der UI durch den `duplicatingId`-Guard verhindert (Menü disabled während Lauf); relevant nur bei direktem Parallel-API-Aufruf / zwei Tabs. Einzelnutzer-Kontext → sehr geringe Wahrscheinlichkeit.
- **Low #3 — Synchrone Kopie großer Versionen:** Das Kopieren läuft synchron im Request. Für aktuelle Größen (≈1000 Zeilen) unkritisch und mit sichtbarem Ladezustand; bei sehr großen Versionen könnte der Request spürbar dauern. Kein Fehler, nur Performance-Hinweis.

### Manuell/nicht automatisiert
Interaktive Ende-zu-Ende-Flows mit echter Session (Klick „Duplizieren", Kopie öffnen/bearbeiten) sind über Code-Audit + umfangreiche DB-Verifikation + Route-Tests abgedeckt; vollständige UI-Automatisierung erfordert eine authentifizierte Session (projektweite Konvention).

## Deployment
_To be added by /deploy_

## Deployment
_To be added by /deploy_
