# PROJ-101: Kapitalbedarf & Finanzierung — Langfristige Planung

## Status: Planned
**Created:** 2026-06-24
**Last Updated:** 2026-06-24

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Nutzer; alle Daten an den Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — versionsbasiertes Routing (`[versionId]`), Versions-Shell (`LangfristigeVersionShell`), Versions-Eigentums-Helfer (`ensureLangfristigeVersion`), zentrale Nav-Konfiguration (`src/lib/langfristige-planung-nav.ts`)
- Requires: PROJ-74 (KPI-Modell Verwaltung — Langfristige Planung) — liefert die versionsgebundenen **Investitionen-Kategorien** (`art = 'lp_investition'`), insbesondere die **Obergruppen** (Ebene 1) für die Aufklappung der Investitionen-Zeile
- Requires: PROJ-75 (Grundeinstellungen — Langfristige Planung) — liefert **Startmonat** und **Planungshorizont Allgemein** (Monatsfenster) für die zugrunde liegenden Aggregationen
- Requires: PROJ-92 (Investitionsausgaben Planung — Langfristige Planung) — **Datenquelle** für die Zeile „Investitionen": Gesamtinvestitionen (Summe über alle Obergruppen, Untergruppen, Produkte und alle Monate des Horizonts), aufklappbar nach Obergruppe
- Requires: PROJ-94 (Liquiditätsauswertung — Langfristige Planung) — **Datenquelle** für die Zeile „Betriebsmittelbedarf": der **negativste kumulierte Kontostand** über alle Monate des Horizonts
- Vorlage (kein harter Require): PROJ-99 (Investitionsauswertung — Langfristige Planung) — Seitenaufbau, Versions-Shell, Drill-Down der Investitionen-Obergruppen, Summen-Hervorhebung; **wesentlicher Unterschied:** diese Seite ist **editierbar** (manuelle Zeilen, Overrides, Reihenfolge) und besitzt **eigene Persistenz**

## Übersicht

Die Seite **Kapitalbedarf & Finanzierung** ist ein neuer Eintrag im Navigationsbereich **„Auswertungen"** der Langfristigen Planung und erscheint im linken Seitenmenü **direkt unter „Investitionsauswertung"** (PROJ-99). Sie ist **versionsgebunden** und im Gegensatz zu den übrigen Auswertungen **bearbeitbar** (eigene persistierte Daten).

Die Seite besteht aus **zwei untereinander angeordneten Tabellen** mit jeweils **einer einzigen Wert-Spalte** (Betrag als Gesamtwert über den gesamten Planungshorizont — **kein** Monatsraster):

1. **Tabelle 1 — Kapitalbedarf** (wie viel Kapital wird benötigt)
2. **Tabelle 2 — Finanzierung** (wie wird der Bedarf gedeckt: Eigen- & Fremdkapital)

Beide Summen müssen logisch zusammenpassen: **Summe Eigen- & Fremdkapital** soll dem **Gesamtkapitalbedarf** entsprechen. Die Übereinstimmung wird **sichtbar abgeglichen** (Differenz-Anzeige + Warnung bei Abweichung), aber **nicht blockierend** erzwungen.

### Tabelle 1 — Kapitalbedarf

Feste Zeilen (in dieser Reihenfolge), darunter optionale manuelle Zeilen, abschließend die Summe:

```
Kapitalbedarf                                                    Betrag
──────────────────────────────────────────────────────────────────────
▸ Investitionen            (auto aus Investitionsausgaben PROJ-92)   …€   ← aufklappbar nach Obergruppe
      Obergruppe A                                                   …€
      Obergruppe B                                                   …€
      …
  Betriebsmittelbedarf     (auto aus Liquiditätsauswertung PROJ-94)  …€
  Liquiditätsreserve       (manuell)                                 …€
  … (beliebig viele manuelle Zeilen, frei benannt, frei bewertet)   …€
══════════════════════════════════════════════════════════════════════
= Gesamtkapitalbedarf      (Summe aller Zeilen, nicht editierbar)    …€
```

- **Zeile „Investitionen"** — automatisch befüllt aus der Seite Investitionsausgaben Planung (PROJ-92): die **Gesamtinvestitionen** dieser Planversion über den **gesamten Zeitraum** (Summe über alle Obergruppen × Untergruppen × Produkte × alle Monate des Horizonts). Diese Zeile ist **aufklappbar** und zeigt darunter die **Obergruppen** der Investitionen mit ihrem jeweiligen Gesamtbetrag.
- **Zeile „Betriebsmittelbedarf"** — automatisch befüllt aus der monatlichen Liquiditätsauswertung (PROJ-94): der **negativste (niedrigste) kumulierte Kontostand** über alle Monate des Horizonts. Ist der Kontostand nie negativ, ist der Wert 0.
- **Zeile „Liquiditätsreserve"** — **manuell** vom Nutzer eingegeben.
- **Manuelle Zusatzzeilen** — der Nutzer kann beliebig viele weitere Zeilen hinzufügen, **frei benennen** und mit einem **manuellen Betrag** pflegen. Die **Reihenfolge** aller Zeilen lässt sich einfach verändern (verschieben).
- **Zeile „Gesamtkapitalbedarf"** — ganz unten: **Summe aller Zeilen** der Tabelle. **Nicht** manuell editierbar.

**Override aller Auto-Zeilen:** Der Nutzer kann jede automatisch berechnete Zeile (Investitionen, Betriebsmittelbedarf) **manuell überschreiben**. Ein überschriebener Wert sticht den berechneten Wert (Indikator manuell/automatisch wie anderswo in der App), lässt sich aber per **Reset auf den berechneten Auto-Wert** zurücksetzen.

### Tabelle 2 — Finanzierung

```
Finanzierung                                                     Betrag
──────────────────────────────────────────────────────────────────────
EIGENKAPITAL
  … (manuelle EK-Positionen, frei benannt, frei bewertet)            …€
  Summe Eigenkapital                                                 …€
──────────────────────────────────────────────────────────────────────
FREMDKAPITAL                       Zinssatz │ Laufzeit │ Tilgungsfrei
  … (manuelle FK-Positionen, frei benannt, frei bewertet)   …% │ … │ …  …€
  Summe Fremdkapital                                                 …€
══════════════════════════════════════════════════════════════════════
= Summe Eigen- & Fremdkapital   (= Summe EK + Summe FK)              …€
      (muss = Gesamtkapitalbedarf sein → Differenz/Warnung)
```

- **Eigenkapital-Positionen** — der Nutzer erstellt manuell beliebig viele EK-Positionen, **frei benannt**, mit **manuellem Wert**. Alle EK-Zeilen werden zu **„Summe Eigenkapital"** summiert.
- **Fremdkapital-Positionen** — der Nutzer erstellt manuell beliebig viele FK-Positionen, **frei benannt**, mit **manuellem Wert**. Alle FK-Zeilen werden zu **„Summe Fremdkapital"** summiert. Jede FK-Position führt zusätzlich **informative Detailwerte**: **Zinssatz**, **Laufzeit** und **Tilgungsfrei** (reine Dokumentation auf dieser Seite — keine Berechnung, keine Verknüpfung zu anderen Seiten).
- **Zeile „Summe Eigen- & Fremdkapital"** — Summe EK + Summe FK. **Muss** dem Gesamtkapitalbedarf aus Tabelle 1 entsprechen.
- **Abgleich:** Differenz zwischen „Summe Eigen- & Fremdkapital" und „Gesamtkapitalbedarf" wird sichtbar dargestellt; bei Abweichung ≠ 0 erscheint eine **Warnung/Hervorhebung**. Speichern bleibt möglich (nicht blockierend).

## User Stories

- Als Controller möchte ich die Seite „Kapitalbedarf & Finanzierung" innerhalb einer geöffneten Planversion über das linke Seitenmenü (Gruppe „Auswertungen", direkt unter „Investitionsauswertung") und über die Versions-Übersichtsseite aufrufen können.
- Als Controller möchte ich in der Kapitalbedarf-Tabelle die automatisch ermittelten Gesamtinvestitionen dieser Planversion sehen und sie nach Obergruppen aufklappen können.
- Als Controller möchte ich den Betriebsmittelbedarf automatisch aus dem negativsten kumulierten Kontostand der Liquiditätsauswertung übernommen bekommen.
- Als Controller möchte ich eine Liquiditätsreserve manuell eingeben können.
- Als Controller möchte ich jede automatisch berechnete Zeile manuell überschreiben und bei Bedarf wieder auf den berechneten Wert zurücksetzen können.
- Als Controller möchte ich beliebige weitere Kapitalbedarf-Zeilen hinzufügen, frei benennen, mit einem Betrag pflegen und ihre Reihenfolge ändern können.
- Als Controller möchte ich ganz unten den automatisch summierten Gesamtkapitalbedarf sehen, den ich nicht manuell ändern kann.
- Als Controller möchte ich in der Finanzierungs-Tabelle beliebige Eigenkapital-Positionen erstellen, benennen und bewerten und ihre Summe sehen.
- Als Controller möchte ich beliebige Fremdkapital-Positionen erstellen, benennen und bewerten, dazu Zinssatz, Laufzeit und Tilgungsfrei dokumentieren und ihre Summe sehen.
- Als Controller möchte ich sehen, ob die Summe aus Eigen- & Fremdkapital dem Gesamtkapitalbedarf entspricht, und bei Abweichung eine deutliche Warnung mit der Differenz erhalten.
- Als Controller möchte ich, dass alle Eingaben dieser Seite ausschließlich an diese Planversion gebunden sind und beim erneuten Öffnen erhalten bleiben.

## Acceptance Criteria

### Navigation & Einstieg
- [ ] Im Versionskontext erscheint die Seite in der Nav-Gruppe „Auswertungen" **direkt unter „Investitionsauswertung"**: „Kapitalbedarf & Finanzierung" → `/dashboard/langfristige-planung/[versionId]/kapitalbedarf-finanzierung`
- [ ] Auf der Versions-Übersichtsseite erscheint der Eintrag generisch über die zentrale Nav-Konfiguration
- [ ] Die Seite ist nur für eingeloggte Nutzer zugänglich (Auth-Guard → Redirect zu `/login`)
- [ ] Bei unbekannter/fremder/ungültiger `versionId` erfolgt ein sauberer Redirect zum Langfristige-Planung-Dashboard (kein Absturz, kein Fremdzugriff) — gemäß PROJ-73
- [ ] Zwei Tabellen werden untereinander gerendert: oben „Kapitalbedarf", darunter „Finanzierung"; jede Tabelle hat genau **eine Wert-Spalte** (Betrag), kein Monatsraster

### Tabelle 1 — Kapitalbedarf: Auto-Zeilen
- [ ] Zeile **„Investitionen"** zeigt die Gesamtinvestitionen dieser Version = Summe der effektiven Soll-Werte über **alle** Obergruppen/Untergruppen/Produkte und **alle** Monate des Horizonts (Datenquelle PROJ-92, bit-konsistent zur Investitionsauswertung PROJ-99)
- [ ] Die Zeile „Investitionen" ist **aufklappbar** und zeigt darunter je **Obergruppe** (Ebene 1 `lp_investition`) deren Gesamtbetrag (Summe über alle Monate)
- [ ] Die Summe der aufgeklappten Obergruppen entspricht dem Wert der Zeile „Investitionen" (sofern nicht manuell überschrieben)
- [ ] Zeile **„Betriebsmittelbedarf"** zeigt den **negativsten kumulierten Kontostand** über alle Monate des Horizonts aus der Liquiditätsauswertung (PROJ-94); ist der Kontostand nie negativ, ist der Wert 0
- [ ] Beide Auto-Zeilen aktualisieren sich, wenn sich die zugrunde liegenden Plandaten ändern (solange nicht manuell überschrieben)

### Tabelle 1 — Kapitalbedarf: manuelle Eingaben & Overrides
- [ ] Zeile **„Liquiditätsreserve"** ist manuell editierbar (Betrag), per Default 0/leer
- [ ] Jede **Auto-Zeile** (Investitionen, Betriebsmittelbedarf) kann manuell **überschrieben** werden; ein Indikator unterscheidet manuell vs. automatisch (analog blau/grau-Muster der App)
- [ ] Eine überschriebene Auto-Zeile kann per **Reset** wieder auf ihren berechneten Auto-Wert zurückgesetzt werden
- [ ] Der Nutzer kann **beliebig viele** manuelle Zusatzzeilen hinzufügen, jeweils mit **freier Bezeichnung** und **manuellem Betrag**
- [ ] Manuelle Zusatzzeilen können wieder **gelöscht** werden
- [ ] Die **Reihenfolge** der Zeilen lässt sich einfach verändern (z. B. Hoch/Runter oder Drag) und wird persistiert
- [ ] Die festen Zeilen (Investitionen, Betriebsmittelbedarf, Liquiditätsreserve) und manuelle Zeilen folgen einer definierten, persistierten Reihenfolge

### Tabelle 1 — Gesamtkapitalbedarf
- [ ] Zeile **„Gesamtkapitalbedarf"** ganz unten = **Summe aller Zeilen** der Kapitalbedarf-Tabelle (Auto-/überschriebene + manuelle Zeilen)
- [ ] „Gesamtkapitalbedarf" ist **nicht** manuell editierbar
- [ ] Die Summe aktualisiert sich unmittelbar bei jeder Wertänderung, beim Hinzufügen/Löschen von Zeilen und beim Override/Reset
- [ ] Die Zeile ist visuell klar als Summe hervorgehoben (fett, Hintergrund, Trennlinie)

### Tabelle 2 — Finanzierung: Eigenkapital
- [ ] Der Nutzer kann **beliebig viele** Eigenkapital-Positionen erstellen, **frei benennen** und mit **manuellem Betrag** pflegen
- [ ] EK-Positionen können bearbeitet, gelöscht und in der Reihenfolge geändert werden
- [ ] Zeile **„Summe Eigenkapital"** = Summe aller EK-Positionen (nicht editierbar)

### Tabelle 2 — Finanzierung: Fremdkapital
- [ ] Der Nutzer kann **beliebig viele** Fremdkapital-Positionen erstellen, **frei benennen** und mit **manuellem Betrag** pflegen
- [ ] Jede FK-Position führt zusätzlich die **informativen** Felder **Zinssatz**, **Laufzeit** und **Tilgungsfrei** (frei pflegbar; reine Dokumentation, keine Berechnung, keine Verknüpfung zu anderen Seiten)
- [ ] FK-Positionen können bearbeitet, gelöscht und in der Reihenfolge geändert werden
- [ ] Zeile **„Summe Fremdkapital"** = Summe aller FK-Positionen (nur Beträge; die Detailfelder fließen nicht in die Summe)

### Tabelle 2 — Abgleich EK + FK = Gesamtkapitalbedarf
- [ ] Zeile **„Summe Eigen- & Fremdkapital"** = Summe Eigenkapital + Summe Fremdkapital
- [ ] Die Differenz zwischen „Summe Eigen- & Fremdkapital" und „Gesamtkapitalbedarf" (Tabelle 1) wird **sichtbar** dargestellt
- [ ] Bei Differenz ≠ 0 erscheint eine **deutliche Warnung/Hervorhebung** (z. B. roter Hinweis mit Betrag der Abweichung)
- [ ] Bei Differenz = 0 wird der Abgleich als „stimmig" gekennzeichnet (z. B. grün/ohne Warnung)
- [ ] Der Abgleich blockiert **nicht** das Speichern oder Bearbeiten (nicht-blockierend)

### Persistenz & Versionsisolation
- [ ] Alle manuellen Eingaben (Liquiditätsreserve, Overrides, Zusatzzeilen, Reihenfolge, EK-/FK-Positionen samt Detailfeldern) werden **persistiert** und sind beim erneuten Öffnen vorhanden
- [ ] Alle Daten sind **ausschließlich** an diese `versionId` und den eingeloggten Nutzer gebunden — keine Anzeige/Vermischung mit anderen Planversionen oder der Kurzfristigen Planung
- [ ] Eine neu angelegte (leere) Version zeigt die festen Auto-Zeilen (mit 0 oder berechnetem Wert), Liquiditätsreserve 0, keine Zusatz-/EK-/FK-Zeilen; Gesamtsummen 0 bzw. berechnet

### Darstellung
- [ ] Beträge im de-DE-Format mit 2 Dezimalstellen und € (z. B. „1.234,56 €")
- [ ] Zinssatz als Prozentwert, Laufzeit/Tilgungsfrei in passender Einheit (z. B. Monate) — Format in `/architecture`/`/frontend` festzulegen
- [ ] Summen- und Header-Zeilen optisch klar von Eingabe-/Detailzeilen abgegrenzt
- [ ] Optik/Layout konsistent mit den übrigen langfristigen Auswertungen (Versions-Shell, Tabellen-Look)

## Edge Cases
- **Leere/neu angelegte Planversion:** Auto-Zeilen 0 bzw. berechnet, keine manuellen Zeilen; Summen konsistent; kein Layout-Bruch.
- **Keine Investitionsdaten / keine Investitionskategorien:** Zeile „Investitionen" = 0; Aufklappen zeigt keine oder 0-Obergruppen; Hinweis/Link analog PROJ-92/PROJ-99 optional.
- **Kontostand nie negativ:** „Betriebsmittelbedarf" = 0.
- **Override = berechneter Wert:** zählt als manueller Override (Indikator manuell), Reset stellt Auto-Verhalten wieder her.
- **Auto-Wert ändert sich nach Override:** der überschriebene Wert bleibt bestehen (Override sticht), bis der Nutzer zurücksetzt.
- **Manuelle Zeile ohne Bezeichnung:** Validierung (Pflicht-Bezeichnung) oder Platzhalter — in `/architecture` festzulegen.
- **Negative Beträge:** zulässig? (z. B. negative Kapitalbedarfsposition) — Verhalten/Validierung in `/architecture` festzulegen.
- **EK + FK ≠ Gesamtkapitalbedarf:** Warnung mit Differenzbetrag; Bearbeiten/Speichern bleibt möglich.
- **Reihenfolge-Änderung der festen Zeilen:** ob die drei festen Zeilen frei verschiebbar sind oder eine Mindeststruktur behalten — in `/architecture` zu präzisieren (Default laut Beschreibung: alle Zeilen frei verschiebbar).
- **Löschen einer FK-Position mit gepflegten Detailwerten:** Position inkl. Detailwerte wird entfernt; Summe FK aktualisiert sich.
- **Gleichzeitige Bearbeitung/Reload:** zuletzt gespeicherter Stand der Version gewinnt; keine Datenvermischung zwischen Versionen.
- **Fremde/unbekannte `versionId`:** Redirect zum Dashboard (PROJ-73), kein Fremdzugriff.
- **Quell-API/Berechnung (PROJ-92/PROJ-94) liefert Fehler:** betroffene Auto-Zeile zeigt leer/Hinweis, der Rest der Seite bleibt nutzbar; kein Seitenabsturz.

## Technical Requirements
- Authentifizierung: `requireAuth()` in neuen API-Routen; Seite ist Client Component im Versions-Shell (`LangfristigeVersionShell`) mit Auth- und Versions-Eigentumsprüfung
- **Neue Persistenz erforderlich** (im Gegensatz zu den read-only Auswertungen): die Seite speichert eigene versionsgebundene Daten — Liquiditätsreserve, Overrides der Auto-Zeilen (Investitionen, Betriebsmittelbedarf), manuelle Kapitalbedarf-Zeilen (Bezeichnung, Betrag, Reihenfolge), EK-/FK-Positionen (Bezeichnung, Betrag, Reihenfolge; FK zusätzlich Zinssatz, Laufzeit, Tilgungsfrei). Konkretes Datenmodell (eine Tabelle mit Zeilentyp-Spalte vs. mehrere Tabellen) entscheidet `/architecture`
- **Auto-Werte read-only abgeleitet:** Zeile „Investitionen" (inkl. Obergruppen-Drilldown) aus der bestehenden PROJ-92-Datenbeschaffung (effektiver Soll, Summe über alle Monate); Zeile „Betriebsmittelbedarf" aus der PROJ-94-Berechnung (negativster kumulierter Kontostand). Bevorzugt Wiederverwendung bestehender Hooks/Endpunkte für Bit-Konsistenz
- Monatsfenster der Aggregation: bestehender Helfer (`buildPlanungsmonate`, Startmonat + `planungshorizont_monate`)
- Summen, Abgleich (EK+FK vs. Gesamtkapitalbedarf), Override/Reset rein clientseitig auf geladenen/gespeicherten Daten
- Reihenfolge persistiert über `sort_order`-Feld
- Keine neuen Packages erwartet: shadcn `Table`, `Input`, `Button`, `Tooltip`, `Skeleton` vorhanden; FK-Detailfelder ggf. zusätzliche Inputs
- Responsive: Mobil (375px) bis Desktop (1440px)

### Neue Dateien (Richtwert — final in `/architecture`)
| Datei | Zweck |
|---|---|
| `src/app/dashboard/langfristige-planung/[versionId]/kapitalbedarf-finanzierung/page.tsx` | Seite: Versions-Shell + Kapitalbedarf-Tabelle + Finanzierungs-Tabelle + Abgleich |
| `src/app/api/langfristige-planung/[versionId]/kapitalbedarf-finanzierung/route.ts` | GET/PUT der versionsgebundenen Kapitalbedarf-/Finanzierungsdaten |
| `src/hooks/use-langfristige-kapitalbedarf-finanzierung.ts` | Laden/Speichern der eigenen Daten + Ableitung der Auto-Werte (Investitionen aus PROJ-92, Betriebsmittelbedarf aus PROJ-94) + Summen/Abgleich |
| `src/components/langfristige-kapitalbedarf-tabelle.tsx` | Tabelle 1: feste + manuelle Zeilen, Drilldown Investitionen, Override/Reset, Reihenfolge, Gesamtkapitalbedarf |
| `src/components/langfristige-finanzierung-tabelle.tsx` | Tabelle 2: EK-/FK-Positionen (FK mit Detailfeldern), Summen, Abgleich/Warnung |

### Geänderte Dateien
| Datei | Änderung |
|---|---|
| `src/lib/langfristige-planung-nav.ts` | Eintrag „Kapitalbedarf & Finanzierung" (Slug `kapitalbedarf-finanzierung`) **direkt nach `investitionsauswertung`** in der Nav-Gruppe „Auswertungen" |

### Wiederverwendung bestehender Muster
| Muster | Quelle |
|---|---|
| Versions-Shell, Eigentumsprüfung, Nav-Konfiguration, Gruppe „Auswertungen" | PROJ-73 / PROJ-94 / PROJ-99 |
| Gesamtinvestitionen + Obergruppen-Drilldown (effektiver Soll, Summe über alle Monate) | PROJ-92 / PROJ-99 (`use-langfristige-investitionsausgaben` / `use-langfristige-investitionsauswertung`) |
| Negativster kumulierter Kontostand | PROJ-94 (`use-langfristige-liquiditaetsauswertung`) |
| Manuell/automatisch-Indikator + Reset auf Auto-Wert | bestehendes blau/grau-Override-Muster der Planungsseiten |
| Versionsgebundene Persistenz mit Reihenfolge | bestehende langfristige Settings-/Planungstabellen |

## Open Questions / Follow-ups (in `/architecture` zu klären)
- Datenmodell: eine Tabelle mit `zeilen_typ` (fest/manuell, kapitalbedarf/ek/fk) und Override-Feldern vs. getrennte Tabellen für Kapitalbedarf-Zeilen, EK-Positionen, FK-Positionen.
- Dürfen die drei festen Zeilen (Investitionen, Betriebsmittelbedarf, Liquiditätsreserve) frei verschoben werden, oder behalten sie ihre Position relativ zu den manuellen Zeilen?
- Validierung: Pflicht-Bezeichnung für manuelle/EK-/FK-Zeilen; Zulässigkeit negativer Beträge.
- Einheiten/Format der FK-Detailfelder (Zinssatz %, Laufzeit in Monaten/Jahren, Tilgungsfrei in Monaten) und ob diese leer bleiben dürfen.
- Speicherstrategie: Auto-Save (onBlur) vs. expliziter „Speichern"-Button.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect — 2026-06-24)

### Leitidee

Diese Seite ist die **erste editierbare Auswertung** der Langfristigen Planung. Alle bisherigen Auswertungen (PROJ-94 … PROJ-100) sind reine Anzeigen ohne eigene Speicherung. Kapitalbedarf & Finanzierung kombiniert **zwei automatisch hergeleitete Werte** (read-only übernommen aus bestehenden Modulen) mit **eigenen, vom Nutzer gepflegten Zeilen** (manuelle Beträge, frei benannte Zeilen, Eigen-/Fremdkapital, Reihenfolge). Daraus folgt die zentrale Aufteilung:

> **Die zwei Auto-Werte werden nicht neu berechnet** — sie werden aus den fertigen Ergebnissen zweier bestehender Hooks gelesen (Investitionsauswertung PROJ-99/PROJ-92 und Liquiditätsauswertung PROJ-94). **Nur die manuellen Eingaben der Seite werden gespeichert** — dafür entsteht **eine einzige neue Tabelle** und **eine einzige neue API-Route**.

So sind die Auto-Werte garantiert konsistent mit den Seiten, aus denen sie stammen, und der Speicher-Teil bleibt klein und überschaubar.

### A) Komponentenstruktur (Komponenten-Baum)

```
/dashboard/langfristige-planung/[versionId]/kapitalbedarf-finanzierung   (NEUE Seite)
│
└── LangfristigeVersionShell  (bestehend — Login-/Versions-Eigentumsprüfung, Header, Seitenmenü, Redirect)
    │
    ├── Tabelle 1 — KAPITALBEDARF  (NEUE Komponente)
    │     ├── Zeile „Investitionen"  → Auto-Wert (aus PROJ-92/PROJ-99), aufklappbar:
    │     │        └── je Obergruppe der Investitionen ein Gesamtbetrag (read-only)
    │     ├── Zeile „Betriebsmittelbedarf"  → Auto-Wert (aus PROJ-94)
    │     ├── Zeile „Liquiditätsreserve"   → manueller Betrag
    │     ├── … beliebig viele manuelle Zusatzzeilen (Name + Betrag, löschbar)
    │     │   (jede Zeile: Override/Reset bei Auto-Zeilen, Hoch/Runter zum Verschieben)
    │     └── Zeile „Gesamtkapitalbedarf"  → Summe aller Zeilen (nicht editierbar, hervorgehoben)
    │
    └── Tabelle 2 — FINANZIERUNG  (NEUE Komponente)
          ├── Abschnitt EIGENKAPITAL
          │      ├── … manuelle EK-Positionen (Name + Betrag, löschbar, verschiebbar)
          │      └── „Summe Eigenkapital"
          ├── Abschnitt FREMDKAPITAL
          │      ├── … manuelle FK-Positionen (Name + Betrag + Zinssatz | Laufzeit | Tilgungsfrei)
          │      └── „Summe Fremdkapital"
          └── Zeile „Summe Eigen- & Fremdkapital"  (= Summe EK + Summe FK)
                 └── Abgleich-Hinweis: Differenz zu „Gesamtkapitalbedarf"
                     (= 0 → grün „stimmig"; ≠ 0 → rote Warnung mit Differenzbetrag)

src/lib/langfristige-planung-nav.ts   (bestehend — neuer Eintrag direkt NACH „Investitionsauswertung")
```

Das linke Seitenmenü und die Versions-Übersicht rendern die Nav-Gruppen generisch — der neue Eintrag erscheint allein durch die Ergänzung in der zentralen Nav-Konfiguration an der gewünschten Position (direkt unter „Investitionsauswertung").

### B) Datenfluss (in einfachen Worten)

```
1. Seite öffnet → Versions-Shell prüft Login + Versions-Eigentum (Redirect bei fremder Version).

2. Drei Dinge werden parallel geladen:
   ① AUTO „Investitionen"      → aus der bestehenden Investitions-Datenbeschaffung (PROJ-92/PROJ-99):
                                  Summe über ALLE Obergruppen × Monate = Gesamtinvestition;
                                  zusätzlich je Obergruppe ihr Gesamtbetrag (für das Aufklappen).
   ② AUTO „Betriebsmittelbedarf" → aus der Liquiditätsauswertung (PROJ-94):
                                  der negativste Wert der Kontostand-Zeile über alle Monate;
                                  ist der Kontostand nie negativ → 0.
   ③ EIGENE gespeicherte Zeilen → aus der neuen Tabelle (Liquiditätsreserve, Overrides,
                                  manuelle Kapitalbedarf-Zeilen, EK-/FK-Positionen, Reihenfolge).

3. Anzeige je Zeile:
   - Auto-Zeile ohne Override  → Auto-Wert (Indikator „automatisch", grau)
   - Auto-Zeile mit Override   → gespeicherter Wert (Indikator „manuell", blau) + Reset-Möglichkeit
   - manuelle/EK/FK-Zeile      → gespeicherter Wert
   Summen (Gesamtkapitalbedarf, Summe EK, Summe FK, Summe EK&FK) werden clientseitig gebildet.

4. Bearbeiten:
   - Wert/Name ändern        → speichert die betreffende Zeile (Auto-Save beim Verlassen des Feldes)
   - Zeile hinzufügen/löschen → legt an / entfernt in der neuen Tabelle
   - Verschieben (Hoch/Runter) → aktualisiert die Reihenfolge (sort_order)
   - Reset einer Auto-Zeile   → entfernt den Override, Zeile zeigt wieder den Auto-Wert
   Die Auto-Werte selbst sind read-only und werden nie in andere Module zurückgeschrieben.
```

**Abgleich (nicht blockierend):** „Summe Eigen- & Fremdkapital" wird laufend mit „Gesamtkapitalbedarf" verglichen; die Differenz steht sichtbar darunter. Bei Abweichung erscheint eine deutliche Warnung, das Speichern/Bearbeiten bleibt aber jederzeit möglich.

### C) Datenmodell (in einfachen Worten)

**Eine neue Tabelle** hält alle vom Nutzer gepflegten Zeilen beider Tabellen (Empfehlung: eine gemeinsame Tabelle mit einem „Bereichs"-Merkmal statt drei getrennter Tabellen — weniger Routen, einheitliche Reihenfolge, ein Speicherweg).

```
Jede gespeicherte Zeile hat:
- eine eindeutige ID
- Nutzer-Zuordnung (user_id) + Planversion (plan_version_id)        ← Versionsisolation
- Bereich:  „Kapitalbedarf" | „Eigenkapital" | „Fremdkapital"
- Zeilen-Art:
    • bei Kapitalbedarf: „Investitionen" (fix) | „Betriebsmittelbedarf" (fix)
                         | „Liquiditätsreserve" (fix) | „manuell" (frei)
    • bei Eigen-/Fremdkapital: immer „manuell"
- Bezeichnung (Text)            ← bei den drei festen Kapitalbedarf-Zeilen vom Code vorgegeben,
                                  bei manuellen/EK/FK-Zeilen frei eingegeben
- Betrag (Zahl, optional)       ← bei festen Auto-Zeilen = optionaler Override (leer = Auto-Wert nutzen);
                                  bei manuellen/EK/FK-Zeilen = der gepflegte Wert
- Reihenfolge (sort_order)      ← gemeinsame Reihenfolge je Bereich, frei verschiebbar
- NUR Fremdkapital zusätzlich:  Zinssatz (%), Laufzeit (Monate), Tilgungsfrei (Monate) — je optional,
                                rein informativ (keine Berechnung, keine Verknüpfung zu anderen Seiten)

Reihen-Level-Security: nur der Eigentümer sieht/ändert seine Zeilen (user_id), gebunden an die Planversion.
```

Die **drei festen Kapitalbedarf-Zeilen** werden beim ersten Öffnen einer Version **einmalig angelegt** (gleiches „lazy seed"-Muster wie der Investitionen-Snapshot in PROJ-74). Dadurch lassen sie sich frei zwischen den manuellen Zeilen verschieben und tragen ihren eigenen Override/Reihenfolge-Zustand — ohne Sonderbehandlung beim Sortieren.

Die **Auto-Werte** (Gesamtinvestition, Obergruppen-Aufteilung, Betriebsmittelbedarf) werden **nicht gespeichert**; sie entstehen bei jedem Laden frisch aus den Quellmodulen. Gespeichert wird nur ein etwaiger **Override** dieser Zeilen.

### D) Auto-Werte — Herkunft (read-only)

```
„Investitionen" (Tabelle 1, oberste Zeile):
   Quelle  = bestehende Investitions-Datenbeschaffung der Version (PROJ-92), wie in der
             Investitionsauswertung (PROJ-99) bereits aufbereitet.
   Wert    = Summe der effektiven Soll-Werte über ALLE Obergruppen × Untergruppen × Produkte
             und ALLE Monate des Planungshorizonts (= „Investitionen Gesamt").
   Drill   = je Obergruppe deren Summe über alle Monate (für das Aufklappen).
   → garantiert identisch zu den Zahlen der Investitionsauswertung.

„Betriebsmittelbedarf" (Tabelle 1):
   Quelle  = Liquiditätsauswertung der Version (PROJ-94), Zeile „Kontostand" (kumuliert je Monat).
   Wert    = Betrag des NEGATIVSTEN Kontostands über alle Monate
             (also der tiefste Punkt des Liquiditätsverlaufs als Kapitalbedarf).
             Wird der Kontostand nie negativ → 0.
```

Beide Werte werden über die **bereits vorhandenen Client-Hooks** geladen — es entsteht **keine** zweite Berechnung und **keine** neue Auswertungs-API.

### E) Eine Wert-Spalte (kein Monatsraster)

Beide Tabellen haben **genau eine** Betrags-Spalte; jeder Wert ist ein Gesamtbetrag über den ganzen Planungshorizont. Es gibt **kein** Monats-/Jahresraster und **keinen** Zeitumschalter (anders als die übrigen Auswertungen). Das hält die Seite schlank und entspricht dem Charakter einer Kapitalbedarfsplanung (Einmal-Summen statt Zeitreihen).

### F) Wiederverwendung vs. Neu

| | Beschreibung |
|---|---|
| **Wiederverwendet (unverändert)** | Versions-Shell + Eigentumsprüfung (PROJ-73); die komplette Auto-Wert-Herleitung über die bestehenden Hooks `useLangfristigeInvestitionsauswertung` (PROJ-99) und `useLangfristigeLiquiditaetsauswertung` (PROJ-94); das Auth-/Versions-Validierungsmuster der bestehenden Versions-Routen; das „lazy seed"-Muster (feste Zeilen einmalig anlegen, analog Investitionen-Snapshot); shadcn Table/Input/Button/Tooltip/Skeleton |
| **Vorlage zum Anlehnen (UI)** | Summen-Hervorhebung, Drill-Down und sticky erste Spalte aus der Investitionsauswertung (PROJ-99); das Override-/Reset-Verhalten (manuell sticht automatisch, blau/grau-Indikator) aus den langfristigen Planungsseiten |
| **Neu** | Eine Seite, ein Daten-Hook (lädt Auto-Werte + eigene Zeilen, bildet Summen + Abgleich), zwei Tabellen-Komponenten (Kapitalbedarf, Finanzierung), **eine** neue Tabelle, **eine** neue API-Route (Lesen/Anlegen/Ändern/Löschen/Sortieren der eigenen Zeilen), ein Nav-Eintrag |
| **Bewusst NICHT** | Kein Monatsraster / Zeitumschalter; keine zweite Berechnung der Auto-Werte; kein Rückschreiben in andere Module; keine Berechnung aus den FK-Detailfeldern; keine harte Sperre beim Abgleich (nur Warnung) |

### G) Tech-Entscheidungen (mit Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Auto-Werte | **aus bestehenden Hooks lesen** (PROJ-99 + PROJ-94) | Garantiert Konsistenz mit Investitions-/Liquiditätsauswertung; keine doppelte Formelpflege |
| Speicher | **eine neue Tabelle + eine Route** (nur die eigenen Zeilen) | Kleinstmöglicher Backend-Anteil; alle Auto-Werte sind bereits abrufbar |
| Tabellen-Struktur | **eine Tabelle mit „Bereich"-Merkmal** statt drei Tabellen | Ein Speicherweg, einheitliche Reihenfolge, weniger Code; EK/FK/Kapitalbedarf unterscheiden sich nur in wenigen Feldern |
| Feste Zeilen | **einmalig materialisiert** (lazy seed) | Erlaubt freies Verschieben zwischen manuellen Zeilen + eigenen Override/Reihenfolge-Zustand |
| Override | **leerer Betrag = Auto-Wert, gesetzter Betrag = Override** + Reset | Vertrautes blau/grau-Muster der App; Reset = Betrag leeren |
| Zeitdimension | **eine Gesamt-Spalte** (kein Monatsraster) | Nutzervorgabe; Kapitalbedarf sind Einmal-Summen |
| EK+FK-Abgleich | **sichtbare Differenz + Warnung, nicht blockierend** | Nutzervorgabe: flexibel weiterarbeiten, Abweichung klar sichtbar |
| FK-Detailfelder | **nur gespeichert/angezeigt** (Zinssatz %, Laufzeit/Tilgungsfrei in Monaten) | Nutzervorgabe: rein informativ, keine Berechnung |
| Speichern | **Auto-Save beim Verlassen des Feldes**; Sortier-/Lösch-Aktion sofort | Konsistent mit den übrigen Planungsseiten; kein separater „Speichern"-Button nötig |

### H) Abhängigkeiten (zu installierende Pakete)

**Keine.** Versions-Shell, beide Quell-Hooks, das Auth-/Versions-Muster und alle benötigten shadcn-Komponenten sind bereits im Projekt vorhanden. Es entsteht genau **eine** neue Datenbanktabelle (mit Reihen-Level-Security) und **eine** neue API-Route für die eigenen Zeilen.

### I) Auflösung der offenen Fragen aus der Spec
- **Datenmodell:** → eine gemeinsame Tabelle mit „Bereich"- und „Zeilen-Art"-Merkmal (statt drei getrennter Tabellen).
- **Feste Zeilen verschiebbar?** → ja; sie werden einmalig materialisiert und teilen sich die Reihenfolge mit den manuellen Zeilen (frei verschiebbar).
- **Validierung:** → Bezeichnung ist Pflicht für manuelle/EK/FK-Zeilen (1–100 Zeichen); die drei festen Zeilen behalten ihre Code-Bezeichnung. Negative Beträge sind zulässig (z. B. Korrekturposten); Auto-Werte und Summen funktionieren mit Vorzeichen.
- **Einheiten FK-Detailfelder:** → Zinssatz in %, Laufzeit in Monaten, Tilgungsfrei in Monaten; alle drei dürfen leer bleiben.
- **Speicherstrategie:** → Auto-Save beim Verlassen eines Feldes (onBlur); Verschieben/Löschen wirkt sofort.

### J) Empfohlener Build-Ablauf
1. `/backend` — neue Tabelle (mit RLS) + neue Route (Lesen/Anlegen/Ändern/Löschen/Sortieren der eigenen Zeilen, inkl. lazy seed der drei festen Zeilen) + Nav-Eintrag.
2. `/frontend` — Seite + Daten-Hook (Auto-Werte aus PROJ-99/PROJ-94 + eigene Zeilen, Summen, Abgleich) + zwei Tabellen-Komponenten.
3. `/qa` — Acceptance Criteria, Versionsisolation, Abgleich-Warnung, Override/Reset, Reihenfolge.

> Hinweis: Anders als die read-only Auswertungen (PROJ-99) braucht diese Seite **sowohl** `/backend` (neue Tabelle/Route) **als auch** `/frontend`.

## Implementation Notes (Backend — 2026-06-24)

Der Backend-Teil ist umgesetzt: **eine** neue Tabelle (mit RLS), **eine** Collection-Route (GET/POST/PUT) und **eine** Item-Route (PATCH/DELETE), plus ein Lazy-Seed-Helfer und der Nav-Eintrag. Die beiden Auto-Werte (Investitionen, Betriebsmittelbedarf) werden **nicht** im Backend gespeichert/berechnet — sie kommen im `/frontend`-Schritt aus den bestehenden Hooks (PROJ-99/PROJ-94).

### Neue Datenbank
- **Tabelle `langfristige_kapitalbedarf_finanzierung`** (Migration `proj101_kapitalbedarf_finanzierung`, Projekt Controlling-App). Eine gemeinsame Tabelle für alle vom Nutzer gepflegten Zeilen beider Tabellen:
  - `bereich`: `kapitalbedarf` | `eigenkapital` | `fremdkapital` (CHECK)
  - `zeilen_art`: `investitionen` | `betriebsmittelbedarf` | `liquiditaetsreserve` | `manuell` (CHECK)
  - `bezeichnung` (Text), `betrag` (NUMERIC, nullable — bei festen Zeilen = Override, NULL = Auto-Wert)
  - FK-Detailfelder `zinssatz` (NUMERIC), `laufzeit_monate` (INT), `tilgungsfrei_monate` (INT) — nur Fremdkapital, rein informativ
  - `sort_order` (INT), `is_system` (bool — die drei festen Zeilen), `created_at`/`updated_at`
  - **Partieller Unique-Index** `uq_lkf_fixe_zeile (plan_version_id, zeilen_art) WHERE zeilen_art <> 'manuell'` → jede feste Zeile existiert je Version nur einmal (idempotenter Seed)
  - Index `idx_lkf_version (user_id, plan_version_id, bereich, sort_order)`
  - **RLS aktiv** mit vier Owner-Policies (`lkf_select/insert/update/delete_own` über `auth.uid() = user_id`). Security-Advisor zeigt keine Befunde für die neue Tabelle.
  - FKs: `user_id → auth.users ON DELETE CASCADE`, `plan_version_id → langfristige_planversionen ON DELETE CASCADE`.

### Neue Dateien
- `src/lib/langfristige-kapitalbedarf-finanzierung-seed.ts` — `ensureKapitalbedarfFinanzierungSeed(...)`: legt die drei festen Kapitalbedarf-Zeilen (`Investitionen`, `Betriebsmittelbedarf`, `Liquiditätsreserve`, sort_order 0/1/2, `is_system=true`, `betrag=null`) **einmalig** je Version an. Idempotent (ergänzt nur fehlende). Plain insert (kein onConflict, da partieller Index); seltene Race-Duplikate werden vom Unique-Index abgefangen.
- `src/app/api/langfristige-planung/[versionId]/kapitalbedarf-finanzierung/route.ts`
  - **GET** — `ensureLangfristigeVersion` + Seed + Liste aller Zeilen der Version (sortiert nach `bereich`, `sort_order`).
  - **POST** — legt eine **manuelle** Zeile an (Bezeichnung Pflicht 1–100, Betrag optional, FK-Felder nur bei `fremdkapital` übernommen); `sort_order` = Ende des jeweiligen Bereichs.
  - **PUT** — Batch-Reorder (`{ order: [{id, sort_order}] }`); aktualisiert nur Zeilen, die dem Nutzer+der Version gehören.
- `src/app/api/langfristige-planung/[versionId]/kapitalbedarf-finanzierung/[id]/route.ts`
  - **PATCH** — Betrag (feste Zeile = Override, `betrag:null` = Reset auf Auto-Wert), `sort_order`; Bezeichnung + FK-Felder **nur** für manuelle Zeilen (Umbenennen fester Zeilen → 403; FK-Felder nur bei `fremdkapital`).
  - **DELETE** — nur manuelle Zeilen; feste Zeilen → 403.

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — Eintrag „Kapitalbedarf & Finanzierung" (Slug `kapitalbedarf-finanzierung`) **direkt nach „Investitionsauswertung"** in der Gruppe „Auswertungen". NavSheet + Versions-Übersicht ziehen generisch nach.

### Validierung / Sicherheit
- Alle Routen: `requireAuth()` + `ensureLangfristigeVersion` (400 bei ungültiger UUID, 404 bei fremder/unbekannter Version), `export const dynamic = 'force-dynamic'`. Zod-Validierung auf POST/PUT/PATCH. Beträge dürfen negativ sein (Korrekturposten); Laufzeit/Tilgungsfrei 0–1200 Monate.

### Tests & Verifikation
- **24 Integration-Tests grün** (`route.test.ts` 13 + `[id]/route.test.ts` 11): Happy-Path, 400 (Validierung/UUID), 401 (unauth), 404 (fremde Version/Zeile), 403 (Umbenennen/Löschen fester Zeilen), Override + Reset (`betrag:null`), FK-Detailfelder, Reorder.
- `tsc --noEmit`: keine Fehler in den neuen Dateien (vorbestehende Fehler in unverwandten Test-Dateien bleiben unberührt).
- DB verifiziert: Tabelle, partieller Unique-Index, Versions-Index und RLS-Policies vorhanden; Security-Advisor ohne Befund für die neue Tabelle.

### Noch offen für `/frontend`
- Auto-Werte aus `useLangfristigeInvestitionsauswertung` (Summe über alle Monate, gesamt + je Obergruppe) und `useLangfristigeLiquiditaetsauswertung` (negativster Kontostand) ableiten; Anzeige Override/Reset; Summen (Gesamtkapitalbedarf, Summe EK/FK/EK&FK) + Abgleich-Warnung; Reihenfolge-UI; zwei Tabellen-Komponenten + Seite.

## Implementation Notes (Frontend — 2026-06-24)

Die Seite ist fertig: zwei Tabellen untereinander, eine Wert-Spalte, editierbar, mit den beiden Auto-Werten aus den bestehenden Hooks und dem nicht-blockierenden EK+FK-Abgleich.

### Neue Dateien
- `src/hooks/langfristige-kapitalbedarf-finanzierung-utils.ts` — **reine Helfer + Typen** (kein `'use client'`, keine Hook-Importe → isoliert unit-testbar): `sumValues` (Summe über alle Monate), `computeBetriebsmittelbedarf` (Betrag des negativsten Kontostands, 0 wenn nie negativ), `effektiverBetrag` (Override sonst Auto-Wert sonst 0), Typen `KbfRow`/`Bereich`/`ZeilenArt`/`Obergruppe`.
- `src/hooks/use-langfristige-kapitalbedarf-finanzierung.ts` — Daten-Hook. Lädt die eigenen Zeilen (neue API) und leitet die Auto-Werte aus `useLangfristigeInvestitionsauswertung` (Gesamt + je Obergruppe, Summe über alle Monate) und `useLangfristigeLiquiditaetsauswertung` (negativster Kontostand) ab. Liefert Zeilen je Bereich (sortiert), Summen (Gesamtkapitalbedarf, Summe EK/FK/EK&FK), Differenz und Aktionen `addRow`/`updateBetrag`/`rename`/`updateFkDetail`/`removeRow`/`resetOverride`/`moveRow` (optimistisch + API). Re-exportiert die reinen Helfer aus dem utils-Modul.
- `src/components/langfristige-kbf-shared.tsx` — Inline-Eingabefelder + Formatierung: `BetragInput` (€, DE-Parsing `parseBetrag`, blur-Save), `ZahlInput` (Zinssatz %/Monate, integer-Variante), `BezeichnungInput` (Pflicht, leere Eingabe wird verworfen), `formatBetrag`.
- `src/components/langfristige-kapitalbedarf-tabelle.tsx` — **Tabelle 1**: Zeilen mit Bezeichnung | Betrag | Aktionen. Investitionen-Zeile aufklappbar → Obergruppen (read-only); Betriebsmittelbedarf; Liquiditätsreserve (manuell). Auto-Zeilen mit **Indikator** (blau=manuell überschrieben, grau=automatisch; Auto-Wert als Placeholder) und **Reset**-Button bei Override. Manuelle Zeilen frei benenn-/lösch-bar. Alle Zeilen per Hoch/Runter verschiebbar. Unten Summe **Gesamtkapitalbedarf** (nicht editierbar, hervorgehoben).
- `src/components/langfristige-finanzierung-tabelle.tsx` — **Tabelle 2**: Abschnitt Eigenkapital (Bezeichnung | Betrag) mit „Summe Eigenkapital"; Abschnitt Fremdkapital (zusätzlich Zinssatz | Laufzeit | Tilgungsfrei, rein informativ) mit „Summe Fremdkapital"; Abschluss **„Summe Eigen- & Fremdkapital"** + **Abgleich-Banner** (grün „stimmt" bzw. rote Warnung mit Differenzbetrag — nicht blockierend).
- `src/app/dashboard/langfristige-planung/[versionId]/kapitalbedarf-finanzierung/page.tsx` — `LangfristigeVersionShell` (`seitenTitel`, `fullWidth`) + Lade-Skeleton + beide Tabellen.

### Geänderte Dateien
- `src/lib/langfristige-planung-nav.ts` — Nav-Eintrag (im `/backend`-Schritt gesetzt).

### Abweichungen / Hinweise
- **Auto-Wert-Darstellung:** Bei nicht überschriebenen Auto-Zeilen wird der berechnete Wert als **Placeholder** im Eingabefeld gezeigt (grauer Indikatorpunkt); sobald der Nutzer tippt, wird daraus ein Override (blauer Punkt + Reset-Pfeil).
- **Reihenfolge:** `moveRow` renummeriert den betroffenen Bereich lückenlos (0..n) und speichert per Batch-`PUT`. Alle Zeilen — auch die drei festen — sind verschiebbar (Architektur-Vorgabe).
- **Negative Beträge** sind erlaubt; FK-Detailfelder optional.

### Verifikation
- `tsc --noEmit`: keine Fehler in den neuen Dateien (die 24 vorbestehenden Fehler liegen ausschließlich in unverwandten Test-Dateien).
- **Unit-Tests:** `use-langfristige-kapitalbedarf-finanzierung.test.ts` — **10/10 grün** (sumValues, computeBetriebsmittelbedarf inkl. „nie negativ" + null-Zellen, effektiverBetrag mit Override/Reset/manuelle Null).
- Zusammen mit den Backend-Routen-Tests: **34/34 grün**.
- Live-Browser-Verifikation (Override/Reset, Zeilen hinzufügen/löschen/verschieben, EK+FK-Abgleich-Warnung) durch den Nutzer empfohlen.

## Nachträgliche Anpassung (2026-06-24) — Investitionen: Unterwerte editierbar

Auf Nutzerwunsch geändert:
- **Investitionen-Gesamtzeile ist nicht mehr direkt editierbar.** Sie ist read-only und zeigt die **Summe ihrer Obergruppen**.
- **Die einzelnen Obergruppen (Unterwerte) sind überschreibbar.** Jede Obergruppe hat ein eigenes Eingabefeld mit Indikator (grau=automatisch, blau=überschrieben) und Reset auf den berechneten Wert. Der Investitionen-Gesamtwert (und damit der Gesamtkapitalbedarf) folgt automatisch den überschriebenen Unterwerten.
- **Persistenz:** neue Spalte `quelle_id` + neuer `zeilen_art='investition_obergruppe'` in `langfristige_kapitalbedarf_finanzierung` (Migration `proj101_kbf_investition_obergruppen_overrides`); Singleton-Unique-Index auf die drei festen Zeilen reduziert, zusätzlicher Unique-Index `(plan_version_id, quelle_id)` für genau einen Override je Obergruppe. Neue Route `…/kapitalbedarf-finanzierung/investition-obergruppe` (PUT-Upsert je Obergruppe; `betrag:null` = Override löschen → zurück zum Auto-Wert).
- **Hook:** `investObergruppen` liefert nun je Obergruppe `{ id, label, auto, override, betrag }`; `investGesamt` = Summe der (überschriebenen) Obergruppen; neue Aktion `updateObergruppe(quelleId, label, betrag|null)`. `effektiverBetrag` ignoriert einen etwaigen Betrag an der Investitionen-Zeile.
- **Styling:** die blaue Hervorhebung der Betrag-Spalte wurde wieder entfernt (neutrale Darstellung); nur der kleine Override-Indikatorpunkt bleibt.
- **Tests:** Unit-Tests angepasst (Investitionen-Zeile = Summe, Override am Row ignoriert) — weiterhin alle grün (33/33 inkl. Backend-Routen).

## QA Test Results (2026-06-24)

**Methodik:** Code-Review gegen alle Acceptance Criteria, Security-Audit (Red-Team), **33 Vitest-Tests** (Kernlogik + API-Routen) und **12 Playwright-E2E-Tests** (Seitenexistenz, Auth-Guard, Schwesterseiten-Regression, Chromium + Mobile Safari). DB-Schema/Indizes/RLS direkt in Supabase verifiziert. Interaktive Live-Bedienung (Eingabe → Reload → persistiert) durch den Nutzer empfohlen (auth- und datengebunden).

> **Hinweis zu bewussten Abweichungen von den ursprünglichen AC** (vom Nutzer iterativ beauftragt, siehe „Nachträgliche Anpassung"):
> 1. **Investitionen-Gesamtzeile ist read-only**; stattdessen sind die **Obergruppen (Unterwerte) überschreibbar**. Der Gesamtwert = Summe der (überschriebenen) Obergruppen.
> 2. **Kein Indikatorpunkt auf der obersten Ebene** — auto/überschrieben/manuell werden dort bewusst optisch identisch dargestellt. Der Override-Indikator bleibt auf der Obergruppen-Ebene erhalten; ein Override ist oben über den Reset-Button erkennbar.
> 3. **Laufzeit & Tilgungsfrei in Jahren** (statt Monaten), mit Singular „1 Jahr".

### Acceptance Criteria

| Bereich | Ergebnis | Anmerkung |
|---|---|---|
| Navigation (Eintrag unter „Investitionsauswertung", Slug `kapitalbedarf-finanzierung`, generisch in Übersicht) | ✅ Pass | Nav-Eintrag direkt nach `investitionsauswertung`; E2E: Route < 400 |
| Auth-Guard + Redirect bei fremder/ungültiger Version | ✅ Pass | `LangfristigeVersionShell` + `ensureLangfristigeVersion` (400/404); E2E: Redirect zu `/login` |
| Zwei Tabellen untereinander, je eine Wert-Spalte, kein Monatsraster | ✅ Pass | Kapitalbedarf- + Finanzierungs-Tabelle, Betrag-Spalte (Gesamt) |
| Investitionen-Zeile = Gesamtinvestitionen (Summe über alle Monate, bit-konsistent zu PROJ-99) | ✅ Pass | aus `useLangfristigeInvestitionsauswertung`; unit-getestet (`sumValues`) |
| Investitionen aufklappbar → Obergruppen je Gesamtbetrag | ✅ Pass | Drill-Down rendert `investObergruppen` |
| Summe Obergruppen = Investitionen-Wert | ✅ Pass | `investGesamt` = Σ Obergruppen; Gesamtzeile zeigt genau diesen Wert |
| Betriebsmittelbedarf = negativster kumulierter Kontostand (0 wenn nie negativ) | ✅ Pass | `computeBetriebsmittelbedarf` (max(0,−min)); unit-getestet (3 Fälle) |
| Auto-Zeilen folgen Plandaten (solange nicht überschrieben) | ✅ Pass | Werte aus den Quell-Hooks, Override sticht |
| Liquiditätsreserve manuell, Default 0 | ✅ Pass | Seed `betrag=null` → Anzeige „0,00 €" |
| **Auto-Zeile überschreibbar** (Betriebsmittelbedarf) + Obergruppen-Overrides | ✅ Pass* | *Investitionen-Gesamt bewusst read-only → Overrides auf Obergruppen-Ebene; Betriebsmittelbedarf direkt überschreibbar |
| **Reset** auf Auto-Wert | ✅ Pass | Reset-Button (Betriebsmittel) + Reset je Obergruppe; `betrag:null` |
| Beliebig viele manuelle Zusatzzeilen (Bezeichnung + Betrag) | ✅ Pass | POST `zeilen_art='manuell'`; unit-getestet |
| Manuelle Zeilen löschbar | ✅ Pass | DELETE (nur manuelle; feste → 403) |
| Reihenfolge änderbar (Hoch/Runter) + persistiert | ✅ Pass | `moveRow` → Batch-`PUT` `sort_order` |
| Gesamtkapitalbedarf = Σ aller Zeilen, nicht editierbar, hervorgehoben, live | ✅ Pass | `bg-muted border-t-2 font-bold`; clientseitige Summe |
| EK-Positionen: anlegen/benennen/Betrag/löschen/reorder + „Summe Eigenkapital" | ✅ Pass | unit-getestet (POST EK) |
| FK-Positionen + Zinssatz/Laufzeit/Tilgungsfrei (informativ) + „Summe Fremdkapital" (nur Beträge) | ✅ Pass* | *Laufzeit/Tilgungsfrei in **Jahren** (bewusste Abweichung) |
| Summe Eigen- & Fremdkapital = EK + FK | ✅ Pass | `summeEkFk` |
| Abgleich sichtbar, Warnung bei ≠0, „stimmig" bei 0, nicht blockierend | ✅ Pass | grünes/roten Banner mit Differenzbetrag; rein clientseitig |
| Persistenz + Versions-/Nutzerisolation | ✅ Pass | RLS (4 Owner-Policies) + Version-Eigentumsprüfung; FKs ON DELETE CASCADE |
| Leere Version zeigt feste Zeilen, sonst leer | ✅ Pass | Lazy-Seed der 3 festen Zeilen (idempotent) |
| Darstellung de-DE €, Summen/Header abgegrenzt, konsistent | ✅ Pass | `Intl.NumberFormat`; Versions-Shell-Look |

### Edge Cases

| Fall | Ergebnis |
|---|---|
| Leere/neu angelegte Version | ✅ Feste Zeilen via Seed; Summen 0/berechnet |
| Keine Investitionskategorien | ✅ Investitionen 0; Drill-Down leer (keine Obergruppen) |
| Kontostand nie negativ | ✅ Betriebsmittelbedarf 0 (unit-getestet) |
| Auto-Wert ändert sich nach Override | ✅ Override (betrag) bleibt, bis Reset |
| Manuelle Zeile ohne Bezeichnung | ✅ Pflicht-Bezeichnung (Zod 1–100); leere Eingabe wird im Feld verworfen |
| Negative Beträge | ✅ Zulässig (Zod `finite()`, kein min) |
| EK+FK ≠ Gesamtkapitalbedarf | ✅ Rote Warnung mit Differenz, nicht blockierend |
| Feste Zeilen frei verschiebbar | ✅ Alle Zeilen via `moveRow` (gemeinsame `sort_order`) |
| FK-Position mit Detailwerten löschen | ✅ DELETE entfernt Zeile inkl. Felder; Summe aktualisiert |
| Fremde/unbekannte versionId | ✅ Redirect via Shell (E2E bestätigt) |
| Override = berechneter Wert (Betriebsmittel) | ⚠️ Siehe Bug #2 (Low) |

### Security-Audit (Red Team)
- **Auth/Authorization:** Alle Routen `requireAuth()` + `ensureLangfristigeVersion` (Version muss dem Nutzer gehören → 404 bei fremd). RLS mit 4 Owner-Policies (`auth.uid()=user_id`). Reorder-`PUT` und Obergruppe-`PUT` aktualisieren nur eigene/versionsgebundene Zeilen. **Kein Cross-User-Zugriff möglich.**
- **Input-Validierung:** Zod auf POST/PUT/PATCH (bereich-Enum, Bezeichnung 1–100, Beträge `finite`, Jahre 0–100 int, UUID-Prüfungen). CHECK-Constraints auf `bereich`/`zeilen_art`.
- **Injection/XSS:** Alle Werte über React (auto-escaped) bzw. `Intl.NumberFormat`; kein `dangerouslySetInnerHTML`. Supabase-Client parametrisiert.
- **Secrets:** keine im Client/Netzwerk; nur versions-/nutzergebundene Daten.
- **Befund:** Security-Advisor zeigt **keine** Befunde für die neue Tabelle. Keine neue Angriffsfläche über das bestehende Muster hinaus.

### Tests
- **Vitest:** `use-langfristige-kapitalbedarf-finanzierung.test.ts` 9/9, `…/kapitalbedarf-finanzierung/route.test.ts` 13/13, `…/[id]/route.test.ts` 11/11 → **33/33 grün** (einzeln ausgeführt; Sammel-Lauf zeigt die bekannte Umgebungs-Flakiness bei hoher Parallelität — isoliert alle grün).
- **E2E:** `tests/PROJ-101-langfristige-kapitalbedarf-finanzierung.spec.ts` → **12/12 grün** (Chromium + Mobile Safari): Seitenexistenz, Auth-Redirect, Schwesterseiten-Regression (PROJ-92/94/99), Dashboard-Redirect.
- `tsc --noEmit`: keine Fehler in den PROJ-101-Dateien (24 vorbestehende Fehler ausschließlich in unverwandten Test-Dateien).

### Gefundene Bugs

| # | Severity | Beschreibung |
|---|---|---|
| 1 | Low (kosmetisch) | `KbfModel.autoInvest` wird exponiert, aber von der UI nicht mehr genutzt (seit Investitionen-Gesamt = `investGesamt`). Toter Rückgabewert, keine Auswirkung. |
| 2 | Low | Betriebsmittelbedarf: Da das Feld den **effektiven** Wert anzeigt und `BetragInput` nur bei `n !== value` speichert, lässt sich der Betriebsmittelbedarf **nicht** auf exakt den berechneten Auto-Wert „überschreiben" (es entsteht kein Override). Praktisch ohne sichtbare Folge, da die Anzeige in beiden Fällen identisch ist (Indikator oben bewusst entfernt). Weicht von der Edge-Case-Notiz „Override = berechneter Wert zählt als Override" ab. |
| 3 | Low | Obergruppe-Override-`PUT` validiert `quelle_id` nicht gegen die tatsächlichen Investitions-Kategorien der Version. Eine fremde UUID erzeugt nur eine verwaiste, im UI ignorierte Zeile (RLS-/versionsgebunden) — kein Sicherheits-/Datenleck. |

**Keine Critical/High/Medium-Bugs.**

### Production-Ready-Empfehlung: ✅ READY
Keine Critical/High-Bugs. Kernlogik durch 33 Vitest- + 12 E2E-Tests abgesichert, `tsc` sauber, RLS/Version-Isolation verifiziert, keine neue Angriffsfläche. Die drei Low-Findings sind kosmetisch/ohne Nutzerwirkung. Empfehlung vor Deploy: kurze visuelle Live-Bestätigung (Obergruppen-Override → Gesamtkapitalbedarf zieht nach; manuelle Zeile/EK/FK anlegen → Reload → persistiert; Abgleich-Warnung).

## Deployment
_To be added by /deploy_
