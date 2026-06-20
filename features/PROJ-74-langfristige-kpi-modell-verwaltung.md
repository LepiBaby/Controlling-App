# PROJ-74: KPI-Modell Verwaltung — Langfristige Planung

## Status: In Progress
**Created:** 2026-06-20
**Last Updated:** 2026-06-20

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — alle Seiten und Daten sind an den eingeloggten Nutzer gebunden
- Requires: PROJ-73 (Langfristige Planung — Planversionen & Navigation) — liefert Planversion-Container, versionsbasiertes Routing (`[versionId]`), Versions-Shell und das kontextabhängige Seitenmenü. Dieses Feature füllt die in PROJ-73 vorgesehene Stammdaten-Seite mit Inhalt.
- Vorlage (kein harter Require): PROJ-2 (KPI-Modell Verwaltung), PROJ-9 (Kategorie-Dimensionen), PROJ-10 (Kategorie-Anzeigebezeichnungen) — die globale KPI-Modell-Seite des Reporting-Bereichs dient als UI-/Bedienvorlage.

## Overview
Im Bereich **Langfristige Planung** wird die in PROJ-73 angelegte Stammdaten-Seite „Plattformen & Produkte" zu **„KPI-Modell Verwaltung"** ausgebaut und umbenannt. Sie ist die zentrale Stelle, an der pro Planversion die für die Planung benötigten Stammkategorien gepflegt werden.

Die Seite orientiert sich **stark an der globalen KPI-Modell-Verwaltung** (Reporting-Bereich), lässt aber bewusst Reiter und Felder weg, die in der Langfristigen Planung nicht gebraucht werden:

- **Keine** Reiter für Umsatz, Einnahmen, Ausgaben & Kosten (diese Kategorien werden — wo nötig — weiterhin global gelesen, nicht hier gepflegt).
- **Kein** Reiter Reporting-Modell.

Stattdessen hat die Seite vier Reiter, alle **pro Planversion** isoliert (anfangs leer, keine Übernahme aus anderen Versionen oder der Kurzfristigen Planung):

| Reiter | Struktur | Besonderheit ggü. global |
|--------|----------|--------------------------|
| **Sales Plattform** | flache Liste (Name) | identisch zur globalen Darstellung |
| **Produkte** | flache Liste (Name) | **keine** SKUs, **keine** USt-Sätze |
| **Marketingkanäle** | Gruppe → Untergruppe (2 Ebenen) | wie Ausgaben & Kosten, aber **ohne** Dimensionen, Anzeigebezeichnung und „Rentabilitätsreport ausschließen" |
| **Investitionen** | Gruppe → Untergruppe (2 Ebenen) | wie Marketingkanäle |

Marketingkanäle und Investitionen sind **neue** Kategoriearten, die nur in der Langfristigen Planung existieren und je Planversion gepflegt werden.

## User Stories
- Als Controller möchte ich innerhalb einer Planversion eine Seite „KPI-Modell Verwaltung" öffnen, damit ich alle Stammkategorien dieser Version an einer Stelle pflegen kann.
- Als Controller möchte ich pro Planversion eine eigene Liste von Sales Plattformen anlegen, umbenennen, löschen und sortieren, damit ich die Vertriebskanäle dieses Szenarios abbilden kann.
- Als Controller möchte ich pro Planversion eine eigene flache Produktliste pflegen (nur Namen, ohne SKUs und USt-Sätze), damit ich die Produkte des Szenarios planen kann, ohne Detaildaten pflegen zu müssen.
- Als Controller möchte ich pro Planversion Marketingkanäle in Gruppen und Untergruppen strukturieren, damit ich Marketingausgaben später differenziert planen kann.
- Als Controller möchte ich pro Planversion Investitionen in Gruppen und Untergruppen strukturieren, damit ich Investitionsvorhaben des Szenarios abbilden kann.
- Als Controller möchte ich, dass die KPI-Modell-Verwaltung jeder Planversion komplett eigene, anfangs leere Daten hat, damit sich Szenarien nicht gegenseitig beeinflussen.
- Als Controller möchte ich die Bedienung (Hinzufügen, Inline-Umbenennen, Löschen, Sortieren) genauso erleben wie in der globalen KPI-Modell-Verwaltung, damit ich mich nicht umgewöhnen muss.

## Acceptance Criteria

### Seite & Navigation
- [ ] Der Stammdaten-Eintrag aus PROJ-73, der bisher „Plattformen & Produkte" hieß, heißt jetzt **„KPI-Modell Verwaltung"** (Seitentitel, Nav-Eintrag, Breadcrumb, Übersichtskarte).
- [ ] Die Seite ist nur innerhalb eines Versionskontexts erreichbar (`/dashboard/langfristige-planung/[versionId]/...`) und respektiert die Zugriffs-/Versionsprüfung aus PROJ-73 (fremde/unbekannte `versionId` → Redirect zum Dashboard, kein Fremdzugriff).
- [ ] Die Seite zeigt genau vier Reiter in dieser Reihenfolge: **Sales Plattform**, **Produkte**, **Marketingkanäle**, **Investitionen**. Es gibt **keine** Reiter Umsatz, Einnahmen, Ausgaben & Kosten oder Reporting-Modell.

### Reiter „Sales Plattform" (flache Liste, pro Version)
- [ ] Zeigt eine flache Liste der Sales Plattformen der aktuellen Planversion.
- [ ] Neue Plattform anlegen (nur Name), bestehende Inline umbenennen, löschen.
- [ ] Reihenfolge per Drag-and-Drop sortierbar (wie globale Darstellung).
- [ ] Darstellung und Bedienung entsprechen 1:1 dem globalen Sales-Plattform-Reiter.
- [ ] Empty State, wenn noch keine Plattform vorhanden ist.

### Reiter „Produkte" (flache Liste, pro Version)
- [ ] Zeigt eine flache Liste der Produkte der aktuellen Planversion (nur Name).
- [ ] **Keine** SKU-Ebene/-Felder und **keine** USt-Satz-Felder vorhanden.
- [ ] Neues Produkt anlegen (nur Name), Inline umbenennen, löschen, per Drag-and-Drop sortieren.
- [ ] Empty State, wenn noch kein Produkt vorhanden ist.

### Reiter „Marketingkanäle" (Gruppe → Untergruppe, pro Version)
- [ ] Unterstützt genau **zwei** Ebenen: Gruppe (Ebene 1) und Untergruppe (Ebene 2). Keine dritte Ebene.
- [ ] Gruppen und Untergruppen können angelegt, inline umbenannt, gelöscht und sortiert werden (wie bei Ausgaben & Kosten).
- [ ] Eine Untergruppe gehört genau einer Gruppe; Sortierung erfolgt innerhalb der jeweiligen Ebene/Eltern.
- [ ] Es gibt **keine** Dimensionen-Konfiguration (kein Sales-Plattform-/Produkt-Pflicht-Toggle).
- [ ] Es gibt **keine** Anzeigebezeichnung (kein Kosten-/Ausgaben-Label).
- [ ] Es gibt **keine** Option „Rentabilitätsreport ausschließen".
- [ ] Empty State, wenn noch keine Gruppe vorhanden ist.

### Reiter „Investitionen" (Gruppe → Untergruppe, pro Version)
- [ ] Identische Struktur und Bedienung wie „Marketingkanäle" (2 Ebenen, kein Dimensionen-/Anzeigebezeichnung-/Ausschluss-Feature).
- [ ] Daten sind von den Marketingkanälen und allen anderen Reitern getrennt.
- [ ] Empty State, wenn noch keine Gruppe vorhanden ist.

### Versionsisolation
- [ ] Alle vier Reiter laden und speichern Daten ausschließlich für die aktuelle `versionId` des eingeloggten Nutzers.
- [ ] Eine neu angelegte Planversion zeigt auf allen vier Reitern **leere** Listen.
- [ ] Änderungen in Version A haben keinerlei Auswirkung auf Version B, andere Versionen oder die Kurzfristige Planung / das globale KPI-Modell.
- [ ] Beim Löschen einer Planversion (PROJ-73) werden alle Daten dieser vier Reiter kaskadierend mitgelöscht — keine verwaisten Datensätze.

## Edge Cases
- **Doppelter Name auf derselben Ebene/im selben Elternknoten:** Verständliche Behandlung (entweder zugelassen wie in der globalen Verwaltung oder mit Hinweis abgelehnt — konsistent zur globalen KPI-Modell-Verwaltung umsetzen).
- **Leerer oder nur aus Leerzeichen bestehender Name:** Wird beim Anlegen/Umbenennen abgelehnt.
- **Löschen einer Gruppe mit Untergruppen (Marketingkanäle/Investitionen):** Klares Verhalten — Untergruppen werden mitgelöscht (mit Bestätigung), keine verwaisten Untergruppen.
- **Löschen einer Plattform/eines Produkts/einer Gruppe, die später in Planungsdaten referenziert wird:** In dieser Spec entstehen noch keine referenzierenden Planungsdaten; das Verhalten bei späterer Referenzierung wird in den jeweiligen Folge-Specs definiert.
- **Sehr lange Namen:** Werden auf eine sinnvolle Maximallänge begrenzt (Vorschlag: 100 Zeichen, analog globaler Verwaltung); Anzeige bricht das Layout nicht (Ellipsis).
- **Aufruf der Seite ohne gültigen Versionskontext / mit fremder `versionId`:** Redirect zum Dashboard (Verhalten aus PROJ-73), kein Absturz, kein Fremdzugriff.
- **Drag-and-Drop über Ebenengrenzen hinweg (Marketingkanäle/Investitionen):** Eine Untergruppe kann ggf. in eine andere Gruppe verschoben werden (wie global); eine Gruppe darf nicht unter eine Untergruppe rutschen.
- **Parallele Bearbeitung in mehreren Tabs/Versionen:** Funktioniert unabhängig, da der Kontext aus der URL (`versionId`) stammt.

## Technical Requirements (optional)
- **Backend nötig:** versionsspezifische Datenhaltung für Sales Plattformen, Produkte, Marketingkanäle (Gruppe/Untergruppe) und Investitionen (Gruppe/Untergruppe) — jeweils mit `plan_version_id`-Bezug (Foreign Key `ON DELETE CASCADE`) und an den Nutzer gebunden.
- **RLS:** Row Level Security auf allen neuen Tabellen; Zugriff nur auf eigene Daten; Versionszugehörigkeit serverseitig prüfen.
- **Validierung:** alle Eingaben (Name, IDs, Ebene/Eltern, Sortierung) serverseitig mit Zod validieren.
- **shadcn/ui first:** Tabs, Card, Button, Input, Dialog/AlertDialog wiederverwenden; bestehende KPI-Kategorie-Komponenten (Tree/Row) als Vorlage nutzen, keine Eigenbauten.
- **Wiederverwendung:** die globale KPI-Modell-UI (Tree/Row, Inline-Edit, Drag-and-Drop) als Vorlage; gemeinsame Logik möglichst teilen statt duplizieren, wo sinnvoll. Die versionsgebundenen Endpunkte filtern stets nach `versionId` + Nutzer.
- **Abkapselung:** keine Synchronisation mit dem globalen KPI-Modell oder der Kurzfristigen Planung.
- **Responsive:** funktioniert auf Mobil (375px) und Desktop (1440px).

## Open Questions / Follow-ups (nicht Teil dieser Spec)
- Verwendung der hier gepflegten Marketingkanäle/Investitionen in nachgelagerten Planungs- und Auswertungsseiten der Langfristigen Planung (eigene Specs).
- Verhalten beim Löschen referenzierter Stammdaten, sobald Planungsdaten darauf verweisen.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Leitidee
Diese Seite ist fast vollständig eine **Wiederverwendung** der bereits existierenden globalen KPI-Modell-Verwaltung. Die dortige Baum-/Listen-UI (Hinzufügen, Inline-Umbenennen, Löschen mit Bestätigung, Drag-and-Drop-Sortieren, Ein-/Ausklappen) ist bereits **vollständig parametrierbar**: Sie akzeptiert eine maximale Ebenentiefe und schaltet Zusatzfunktionen (SKU-Felder, USt-Sätze, Dimensionen, Anzeigebezeichnungen, „Rentabilitätsreport ausschließen") nur dann ein, wenn die jeweilige Funktion explizit mitgegeben wird. Für PROJ-74 lassen wir diese Zusatzfunktionen einfach **weg** — es ist also **keine Änderung an der bestehenden UI-Komponente** nötig.

Der einzige echte Neubau ist die **Datenhaltung pro Planversion**: Während die globale Verwaltung gegen die globale Kategorientabelle arbeitet, braucht die Langfristige Planung eine eigene, **versionsgebundene** Ablage (jede Planversion hat eigene, anfangs leere Listen). Es gibt keinerlei Verbindung zum globalen KPI-Modell oder zur Kurzfristigen Planung.

### A) Seiten- & Navigationsstruktur (Komponenten-Baum)
```
KPI-Modell Verwaltung  (innerhalb einer geöffneten Planversion)
+-- Versions-Gerüst (bestehend: lädt/prüft Version, Header mit Breadcrumb, Seitenmenü)
+-- Reiter-Leiste (Tabs)
    +-- Reiter "Sales Plattform"   -> Liste (1 Ebene)         [+ hinzufügen, umbenennen, löschen, sortieren]
    +-- Reiter "Produkte"          -> Liste (1 Ebene, nur Name) [+ hinzufügen, umbenennen, löschen, sortieren]
    +-- Reiter "Marketingkanäle"   -> Baum (2 Ebenen: Gruppe > Untergruppe)
    +-- Reiter "Investitionen"     -> Baum (2 Ebenen: Gruppe > Untergruppe)
```
- Jeder Reiter nutzt **dieselbe** bestehende Baum-/Listen-Komponente, nur mit unterschiedlicher Ebenentiefe (1 bzw. 2) und ohne die Zusatzfunktionen.
- Die Seite wird in das bestehende Versions-Gerüst der Langfristigen Planung eingebettet (es übernimmt Laden/Prüfen der Version, Header, Seitenmenü, Redirect bei fremder/unbekannter Version).

### B) Navigations-Anpassung (Umbenennung)
- Der bestehende Stammdaten-Menüeintrag „Plattformen & Produkte" (aus PROJ-73) wird zu **„KPI-Modell Verwaltung"** umbenannt — Beschriftung, Beschreibungstext und die interne Seiten-Adresse (Slug) werden angepasst, damit Menü, Breadcrumb und Übersichtskarte konsistent sind. Dies ist eine reine Umbenennung an einer zentralen Stelle (die Navigations-Konfiguration), keine Strukturänderung.

### C) Datenmodell (in Klartext)
**Eine neue Tabelle „Langfristige KPI-Kategorien" (pro Planversion):**
```
Je Eintrag:
- eindeutige ID
- Besitzer (Nutzer)            -> Zugriffsschutz
- Zugehörigkeit zu genau EINER Planversion  -> Isolation
- Art: "Sales Plattform" | "Produkt" | "Marketingkanal" | "Investition"
- Übergeordneter Eintrag (leer = oberste Ebene)  -> nur für Marketing/Investition genutzt
- Ebene (1 oder 2)
- Name
- Sortierreihenfolge
```
- **Bewusst NICHT enthalten:** SKU-Code, USt-Satz, Dimensionen-Schalter, Anzeigebezeichnungen, „Rentabilitätsreport ausschließen". Diese Felder existieren nur im globalen Modell und werden hier nicht gebraucht.
- Sales Plattform und Produkt benutzen nur Ebene 1 (flache Liste, kein übergeordneter Eintrag).
- Marketingkanal und Investition benutzen Ebene 1 (Gruppe) und Ebene 2 (Untergruppe).

**Isolations- & Löschregeln:**
```
- Jeder Eintrag hängt an genau einer Planversion und einem Nutzer.
- Löscht man eine Planversion (PROJ-73), werden alle zugehörigen Einträge automatisch
  mitgelöscht (kaskadierend) — keine verwaisten Datensätze.
- Löscht man eine Gruppe (Marketing/Investition), werden ihre Untergruppen mitgelöscht.
- Daten verschiedener Versionen sind vollständig getrennt.
```

### D) Server-Schnittstellen (Endpunkte, versions- & nutzergebunden)
Es entsteht ein neuer, versionsbewusster Endpunkt-Satz unter der Langfristig-Struktur, der die vier Arten in einer Tabelle verwaltet (Filter nach Planversion + Nutzer + Art):
- Einträge einer Art einer Version **lesen**
- Eintrag **anlegen** (Art, Name, Ebene, ggf. übergeordneter Eintrag, Sortierung)
- Eintrag **ändern** (umbenennen, neue Sortierung, ggf. neues Eltern-Element beim Verschieben)
- Eintrag **löschen** (inkl. Untergruppen)

Jeder Zugriff prüft serverseitig, dass die Planversion dem eingeloggten Nutzer gehört; andernfalls kein Zugriff. Eingaben werden serverseitig validiert (Name nicht leer, Ebene/Art zulässig, Eltern-Element gehört zur selben Version & Art).

### E) Wiederverwendung im Detail
| Baustein | Status | Anmerkung |
|----------|--------|-----------|
| Baum-/Listen-UI inkl. Drag-and-Drop, Inline-Edit, Lösch-Bestätigung, Add-Formular | **unverändert wiederverwenden** | bereits über Ebenentiefe + optionale Funktionen parametrierbar |
| Versions-Gerüst (Laden/Prüfen der Version, Header, Seitenmenü) | **unverändert wiederverwenden** | aus PROJ-73 |
| Daten-Hook (Lade-/Änderungslogik der Kategorien) | **neue, versionsbewusste Variante** | wie der bestehende Hook, aber gegen die versionsgebundenen Endpunkte; ohne die Zusatzfunktionen |
| Reiter-Leiste (Tabs), Lösch-Dialog | **bestehende shadcn/ui-Bausteine** | analog zur globalen Seite |
| Datentabelle + Endpunkte | **Neubau** | versions-/nutzergebunden, eigene Art-Werte |

### F) Tech-Entscheidungen (Begründung)
- **Bestehende UI ohne Änderung wiederverwenden:** Die Baumkomponente ist bereits so gebaut, dass Zusatzfunktionen optional sind — durch Weglassen entstehen exakt die gewünschten „abgespeckten" Reiter, ohne Code-Duplikat und ohne Regressionsrisiko für die globale Seite.
- **Eine gemeinsame Tabelle mit Art-Unterscheidung** (statt vier Tabellen): spiegelt das bewährte globale Modell, hält die Endpunkte einfach und die kaskadierende Löschung pro Version trivial.
- **Separate, versionsgebundene Ablage** (statt Erweiterung des globalen Modells): erfüllt die in PROJ-73 festgelegte vollständige Abkapselung; jede Planversion hat eigene Plattform-/Produkt-/Marketing-/Investitions-Welten.
- **Zugriffsschutz doppelt** (Versionseigentum serverseitig + nutzergebundene Zeilen): konsistent mit dem Sicherheitsmuster der bestehenden Langfristig-Tabellen.

### G) Abhängigkeiten (Pakete)
- Keine neuen npm-Pakete nötig. Wiederverwendet werden: die bestehende KPI-Baum-/Listen-Komponente (inkl. Drag-and-Drop), shadcn/ui (Tabs, Card, Dialog/AlertDialog, Button, Input), Zod (Validierung), Supabase (Datenhaltung inkl. Zeilensicherheit), das Versions-Gerüst und die Navigations-Konfiguration aus PROJ-73.

### H) Umsetzungsreihenfolge (empfohlen)
1. Neue versionsgebundene Tabelle „Langfristige KPI-Kategorien" + Endpunkte (lesen/anlegen/ändern/löschen), nutzer- & versionsgesichert.
2. Versionsbewusste Daten-Hook-Variante (analog zum bestehenden Kategorien-Hook, ohne Zusatzfunktionen).
3. Neue Seite mit vier Reitern, eingebettet ins Versions-Gerüst, unter Wiederverwendung der bestehenden Baum-/Listen-UI (Ebenentiefe 1 bzw. 2).
4. Navigations-Eintrag umbenennen (Slug/Label/Beschreibung „KPI-Modell Verwaltung").

> Hinweis: Da UI und Versions-Gerüst bereits existieren, liegt der eigentliche Aufwand in Schritt 1–2 (Datenhaltung/Endpunkte); Schritt 3–4 sind überwiegend Verdrahtung.

## Implementation Notes

### Frontend (UI + versionsgebundener Daten-Hook), 2026-06-20
Die Seite und die Verdrahtung sind gebaut; die eigentliche Datenhaltung/API folgt mit `/backend`. Bis dahin zeigt jeder Reiter sauber den Lade-Fehlerzustand (kein Absturz); das Versions-Gerüst selbst lädt korrekt über die bestehende PROJ-73-API.

**Maximale Wiederverwendung:** Die globale KPI-Baum-/Zeilen-UI wurde **unverändert** wiederverwendet. Die „abgespeckten" Reiter entstehen allein dadurch, dass die optionalen Funktions-Callbacks (SKU, USt, Dimensionen, Anzeigebezeichnungen, Rentabilitäts-Ausschluss) **nicht** mitgegeben werden, und durch die Ebenentiefe (`maxLevel` 1 bzw. 2).

**Neue Dateien:**
- `src/hooks/use-langfristige-kpi-kategorien.ts` — versionsbewusste Variante von `useKpiCategories`. Lädt/ändert gegen `/api/langfristige-planung/[versionId]/kpi-kategorien`, bildet die API-Datensätze auf die gemeinsame `KpiCategory`-Form ab (ungenutzte Felder defaulten) und bietet nur die Struktur-Operationen (anlegen, umbenennen, löschen, hoch/runter, umsortieren, umhängen). Wiederverwendet die reinen Helfer `buildTree`/`removeWithDescendants`/`countDescendants` aus dem Basis-Hook.
- `src/app/dashboard/langfristige-planung/[versionId]/kpi-modell-verwaltung/page.tsx` — vier Reiter (Sales Plattform, Produkte, Marketingkanäle, Investitionen), eingebettet ins `LangfristigeVersionShell`. Sales Plattform/Produkte = flach (`maxLevel 1`), Marketingkanäle/Investitionen = Gruppe→Untergruppe (`maxLevel 2`). Lösch-Bestätigung via `AlertDialog` (zählt betroffene Untergruppen).

**Geänderte Dateien:**
- `src/hooks/use-kpi-categories.ts` — `CategoryType`-Union **additiv** um die vier Langfristig-Arten (`lp_sales_plattform`, `lp_produkt`, `lp_marketingkanal`, `lp_investition`) erweitert, damit die versionsgebundenen Datensätze dieselbe `KpiCategory`-Form teilen. Globaler Hook/globale Seite verwenden diese Werte nie; der einzige typbasierte Zweig in der Zeile (`type === 'produkte'`) bleibt korrekt (keine SKU-UI für die neuen Arten).
- `src/components/kpi-category-tree.tsx` — optionaler Prop `addPlaceholder` (Default = bisheriger Text, globale Seite unverändert), damit die flachen Reiter passende Platzhalter zeigen („Neue Sales Plattform…", „Neue Gruppe…").
- `src/lib/langfristige-planung-nav.ts` — Stammdaten-Eintrag von Slug `plattformen-produkte` / „Plattformen & Produkte" auf `kpi-modell-verwaltung` / **„KPI-Modell Verwaltung"** umbenannt (Label, Slug, Beschreibung). Menü, Breadcrumb und Übersichtskarte ziehen automatisch nach.

**Qualität:** `tsc --noEmit` ohne neue Fehler (verbleibende Fehler liegen ausschließlich in vorbestehenden Testdateien); `next lint` sauber für die geänderten/neuen Dateien.

**Erwartete API (für `/backend`):** versions- & nutzergesichert; bei fremder/unbekannter `versionId` kein Zugriff. Datensatzform: `{ id, plan_version_id, art, parent_id, name, level, sort_order }` mit `art ∈ { lp_sales_plattform, lp_produkt, lp_marketingkanal, lp_investition }`.
- `GET /api/langfristige-planung/[versionId]/kpi-kategorien?art=<art>` → `Record[]` (flach, beliebige Sortierung — Baum wird clientseitig gebaut)
- `POST /api/langfristige-planung/[versionId]/kpi-kategorien` `{ art, name, parent_id, level, sort_order }` → `Record` (400 bei leerem Namen, Fehlertext in `{ error }`)
- `PATCH /api/langfristige-planung/[versionId]/kpi-kategorien/[id]` `{ name? | sort_order? | parent_id? | level? }` → `Record`
- `DELETE /api/langfristige-planung/[versionId]/kpi-kategorien/[id]` → `{ success: true }` (löscht Untergruppen kaskadierend)

Neue Tabelle empfohlen: `langfristige_kpi_kategorien` mit `plan_version_id` → `langfristige_planversionen` (`ON DELETE CASCADE`), `user_id`, `art`, `parent_id` (self-FK, `ON DELETE CASCADE`), `name`, `level`, `sort_order`; RLS analog zu `langfristige_planversionen`. Eingaben serverseitig mit Zod validieren; `parent_id` muss zur selben Version & `art` gehören.

### Backend (Tabelle + versionsgebundene API), 2026-06-20
Datenhaltung und API sind implementiert; die Frontend-Anbindung erfolgte bereits im Frontend-Schritt (ruft exakt diese Endpunkte/Datensatzform), daher keine weiteren Frontend-Änderungen nötig.

**Datenbank (Supabase-Projekt „Controlling-App", Migration `create_langfristige_kpi_kategorien`):**
- Neue Tabelle `langfristige_kpi_kategorien`: `id`, `user_id` → `auth.users` (ON DELETE CASCADE), `plan_version_id` → `langfristige_planversionen` (ON DELETE CASCADE → kaskadierende Löschung pro Planversion), `art` (CHECK ∈ {lp_sales_plattform, lp_produkt, lp_marketingkanal, lp_investition}), `parent_id` (self-FK ON DELETE CASCADE → Untergruppen werden mitgelöscht), `name` (CHECK 1–100 Zeichen getrimmt), `level` (CHECK ∈ {1,2}), `sort_order`, `created_at`, `updated_at`.
- RLS aktiviert, 4 Policies (SELECT/INSERT/UPDATE/DELETE) mit `auth.uid() = user_id` (strenger als das bestehende `USING(true)`-Muster älterer Tabellen).
- Indizes: `(plan_version_id, art, sort_order)`, `(parent_id)`, `(user_id)`.
- `get_advisors` (security): keine neue Warnung für die Tabelle.

**API-Routen (versions- & nutzergesichert; fremde/unbekannte `versionId` → 404, kein Fremdzugriff):**
- `src/app/api/langfristige-planung/[versionId]/kpi-kategorien/route.ts` — `GET` (Liste je `art`, nach `sort_order`) + `POST` (anlegen). Validierung: flache Arten nur Ebene 1 ohne Eltern; Ebene/Eltern-Konsistenz; Eltern muss zur selben Version & Art gehören und Ebene 1 sein; Duplikat-Name auf gleicher Ebene → 409.
- `src/app/api/langfristige-planung/[versionId]/kpi-kategorien/[id]/route.ts` — `PATCH` (umbenennen/sortieren/umhängen; lädt Bestand für Art-Bezug, validiert Eltern beim Umhängen, verhindert Selbst-Elternschaft) + `DELETE` (Existenz-/Eigentumsprüfung → 404, sonst Löschung inkl. Untergruppen via Cascade).
- Alle Routen: `requireAuth` (401), Zod-Validierung, Queries zusätzlich nach `user_id` + `plan_version_id` gefiltert (Defense-in-Depth zur RLS), Fehler als `{ error: string }`.

**Tests:** `…/kpi-kategorien/route.test.ts` (GET/POST) + `…/[id]/route.test.ts` (PATCH/DELETE) — **23/23 grün** (Happy Path, 400/401/404/409, Eltern-/Ebenen-Validierung). KPI-Gesamtsuite (global + neu) **108/108 grün** → additive Änderungen (CategoryType, `addPlaceholder`) regressionsfrei. Typecheck ohne neue Fehler.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
