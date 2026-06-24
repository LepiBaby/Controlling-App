// PROJ-86: Reine Berechnungslogik für den Bestelllauf der Langfristigen Planung.
// Vollständig eigenständig — KEIN Import aus dem kurzfristigen
// `planbestelllauf-algorithmus.ts`. Arbeitet rein auf Produktebene (keine SKUs).
//
// Es wird über den GESAMTEN allgemeinen Planungshorizont geprüft und je Produkt
// werden bei Bedarf MEHRERE Bestellungen ermittelt (Wochensimulation auf Basis
// der Lagerposition / des kalkulatorischen Bestands = on-hand + bereits
// eingeplante, noch nicht eingetroffene Bestellungen). Sicherheitsbestand =
// Ø-Monatsabsatz über alle geplanten Monate × Monate; Meldebestand = realer
// Absatz über die Lieferzeit (Monat für Monat aus der Absatzplanung) + Sicherheitsbestand.
//
// Kein DB-Zugriff — alle Daten werden als Parameter übergeben (unit-testbar).

const TAGE_PRO_MONAT = 365.25 / 12 // ≈ 30,4375
const MS_PRO_TAG = 86_400_000

// ─── Datums-Helfer ──────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PRO_TAG)
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()))
}

function tageImMonat(jahr: number, monat0: number): number {
  return new Date(Date.UTC(jahr, monat0 + 1, 0)).getUTCDate()
}

// ─── Absatz-Helfer (reale Monatswerte aus der Absatzplanung) ────────────────────

// Durchschnittlicher Monatsabsatz über ALLE geplanten Monate (Schnitt der
// Monatssummen). Ohne Map → Fallback (Start-Monats-Wert).
function avgMonatsabsatz(map: Map<string, number> | undefined, fallback: number): number {
  if (map && map.size > 0) {
    let summe = 0
    for (const v of map.values()) summe += v
    return summe / map.size
  }
  return fallback
}

// Geplanter Absatz eines Monats (Summe über Plattformen). Ohne Map → Fallback.
function monatsabsatzAm(map: Map<string, number> | undefined, fallback: number, date: Date): number {
  if (map) return map.get(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`) ?? 0
  return fallback
}

// Geplanter Absatz über ein Tagesfenster (z. B. die Lieferzeit), Monat für Monat
// anteilig aus den realen Absatzplanungs-Werten — „jeden Monat einzeln".
function absatzInFenster(
  map: Map<string, number> | undefined,
  fallback: number,
  fromDate: Date,
  tage: number,
): number {
  if (tage <= 0) return 0
  let total = 0
  let rest = tage
  let cursor = new Date(fromDate.getTime())
  while (rest > 0) {
    const jahr = cursor.getUTCFullYear()
    const monat0 = cursor.getUTCMonth()
    const dim = tageImMonat(jahr, monat0)
    const tagImMonat = cursor.getUTCDate() // 1..dim
    const tageBisMonatsende = dim - tagImMonat + 1
    const nimm = Math.min(rest, tageBisMonatsende)
    const monatsTotal = map ? map.get(`${jahr}-${monat0 + 1}`) ?? 0 : fallback
    total += (monatsTotal / dim) * nimm
    rest -= nimm
    cursor = addDays(cursor, nimm)
  }
  return total
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

// ─── Eingabe-Typen ──────────────────────────────────────────────────────────────

export interface ProduktInput {
  produkt_id: string
  produkt_name: string
  aktueller_bestand: number
  /** Geplanter Absatz im Start-Planungsmonat (Summe über alle Plattformen).
   *  Wird als Fallback genutzt, wenn keine Monats-Map vorliegt (z. B. in Tests). */
  monatsabsatz: number
  /** Geplanter Absatz je Monat (Summe über Plattformen), Schlüssel `${jahr}-${monat}`.
   *  Basis für Ø-Sicherheitsbestand und monatsweisen Meldebestand. */
  monatsabsatz_map?: Map<string, number>
  /** Gesamtlieferzeit-Bestandteile in Tagen. */
  pufferzeit_tage: number
  produktionszeit_tage: number
  zwischenzeit_tage: number
  shipping_zeit_tage: number
  entladungszeit_tage: number
  /** Sicherheitsbestand in Monaten (PROJ-77-Definition). */
  sicherheitsbestand_monate: number
  /** Zielreichweite in Monaten. */
  zielreichweite_monate: number
  moq: number | null
  hersteller_id: string | null
  stueckvolumen_cm3: number | null
  max_20dc: number | null
  max_40hq: number | null
}

export interface BestehendeBestellungInput {
  bestellung_id: string
  produkt_id: string
  herkunft: 'algorithmus' | 'manuell' | null
  manuell_geaendert: boolean
  bestelldatum: string | null
  /** PROJ-86: zusätzliche aktuelle Datumsfelder, damit `alte_daten` im Re-Run
   *  vollständig (analog kurzfristig) gefüllt werden können. */
  produktionsstart_datum?: string | null
  produktionsende_datum?: string | null
  shippingdatum?: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  menge_praktisch: number
  /** Aktuelle theoretische Menge der Bestellung (für `alte_daten.sku_mengen`). */
  menge_theoretisch?: number | null
  /** Aktuell gespeicherte Containeranzahl (für `alte_daten.container[]`). */
  anzahl_20dc?: number
  anzahl_40hq?: number
}

export interface AlgorithmusInput {
  /** Erster Tag des Start-Planungsmonats. */
  startMonat: Date
  /** Allgemeiner Planungshorizont in Monaten ab Startmonat. */
  horizontMonate: number
  /** Heutiges Datum (für „Bestellzeitpunkt überschritten"). */
  heute: Date
  produkte: ProduktInput[]
  bestehendeBestellungen: BestehendeBestellungInput[]
}

// ─── Ausgabe-Typen ──────────────────────────────────────────────────────────────
//
// PROJ-86: Die Ausgabestrukturen spiegeln EXAKT die kurzfristigen Shapes
// (NeuePlanbestellung / PlanbestelllaufAenderung / SkuMengeVorschlag) aus
// `src/hooks/use-planbestelllauf.ts`, damit das Frontend die kurzfristige
// Wizard-UI (inkl. Konsolidierungs-Schritt) 1:1 wiederverwenden kann.
//
// Auf Produktebene gibt es genau EINEN `sku_mengen`-Eintrag je Bestellung,
// dabei gilt `sku_id = produkt_id` und `sku_name = produkt_name`.

/** Interne, kompakte Datumstruktur des Algorithmus (vor dem Output-Mapping). */
export interface BestelllaufDaten {
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  menge_theoretisch: number | null
  /** Menge nach MOQ-Rundung, aber VOR der Container-Optimierung. */
  menge_nach_moq: number
  menge_praktisch: number
  begruendung: string
  anzahl_20dc: number
  anzahl_40hq: number
}

/** Spiegel von SkuMengeVorschlag (kurzfristig). Auf Produktebene: sku_id = produkt_id. */
export interface SkuMengeVorschlag {
  sku_id: string
  sku_name: string
  menge_theoretisch: number
  menge_nach_moq: number
  menge_praktisch: number
  begruendung_anpassung: string
  is_trigger?: boolean
}

/** Spiegel von NeuePlanbestellung (kurzfristig). Genau 1 sku_mengen-Eintrag. */
export interface NeueBestellung {
  temp_id: string
  produkt_ids: string[]
  produkt_namen: string[]
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  sku_mengen: SkuMengeVorschlag[]
  warnungen: string[]
  container: Array<'20DC' | '40HQ'>
  /** PROJ-86: interne Konsolidierungs-Verknüpfung (Frontend baut eigene Gruppen). */
  konsolidiert_mit_temp_ids: string[]
}

export type AenderungsArt =
  | 'bestelldatum'
  | 'menge'
  | 'bestelldatum_und_menge'
  | 'kein_bedarf'
  | 'keine_aenderung'
  | 'konsolidierung'

/** Spiegel von PlanbestelllaufAenderung (kurzfristig). */
export interface BestellungAenderung {
  bestellung_id: string
  produkt_ids: string[]
  produkt_namen: string[]
  aenderungsart: AenderungsArt
  herkunft?: 'algorithmus' | 'manuell'
  alt_wert: string
  neu_wert: string
  begruendung: string
  warnungen?: string[]
  alte_daten?: {
    bestelldatum?: string
    produktionsstart_datum?: string
    produktionsende_datum?: string
    shippingdatum?: string
    ankunftsdatum?: string
    verfuegbarkeitsdatum?: string
    container?: Array<'20DC' | '40HQ'>
    sku_mengen?: Array<{ sku_id: string; menge_theoretisch: number | null; menge_nach_moq?: number | null; menge_praktisch: number }>
  }
  neue_daten?: {
    bestelldatum?: string
    produktionsstart_datum?: string
    produktionsende_datum?: string
    shippingdatum?: string
    ankunftsdatum?: string
    verfuegbarkeitsdatum?: string
    container?: Array<'20DC' | '40HQ'>
    sku_mengen?: Array<{ sku_id: string; sku_name?: string; menge_theoretisch?: number; menge_nach_moq?: number; menge_praktisch: number; begruendung_anpassung: string; is_trigger?: boolean }>
  }
}

export interface BestelllaufErgebnis {
  aenderungen_bestehende: BestellungAenderung[]
  neue_bestellungen: NeueBestellung[]
}

// ─── Output-Mapping-Helfer ──────────────────────────────────────────────────────

/** anzahl_20dc/anzahl_40hq → container[] (n× '40HQ', m× '20DC'). */
function buildContainerArray(anzahl_20dc: number, anzahl_40hq: number): Array<'20DC' | '40HQ'> {
  const result: Array<'20DC' | '40HQ'> = []
  for (let i = 0; i < anzahl_40hq; i++) result.push('40HQ')
  for (let i = 0; i < anzahl_20dc; i++) result.push('20DC')
  return result
}

// ─── Helfer ─────────────────────────────────────────────────────────────────────

function gesamtlieferzeitTage(p: ProduktInput): number {
  return (
    p.pufferzeit_tage +
    p.produktionszeit_tage +
    p.zwischenzeit_tage +
    p.shipping_zeit_tage +
    p.entladungszeit_tage
  )
}

function computeDates(bestelldatum: Date, p: ProduktInput): {
  bestelldatum: string
  produktionsstart_datum: string
  produktionsende_datum: string
  shippingdatum: string
  ankunftsdatum: string
  verfuegbarkeitsdatum: string
  verfuegbarkeitDate: Date
} {
  const produktionsstart = addDays(bestelldatum, p.pufferzeit_tage)
  const produktionsende = addDays(produktionsstart, p.produktionszeit_tage)
  const shipping = addDays(produktionsende, p.zwischenzeit_tage)
  const ankunft = addDays(shipping, p.shipping_zeit_tage)
  const verfuegbar = addDays(ankunft, p.entladungszeit_tage)
  return {
    bestelldatum: toDateStr(bestelldatum),
    produktionsstart_datum: toDateStr(produktionsstart),
    produktionsende_datum: toDateStr(produktionsende),
    shippingdatum: toDateStr(shipping),
    ankunftsdatum: toDateStr(ankunft),
    verfuegbarkeitsdatum: toDateStr(verfuegbar),
    verfuegbarkeitDate: verfuegbar,
  }
}

interface Zugang {
  zeit: number // ms
  menge: number
}

// Container-Optimierung (Schwellen analog kurzfristig, hier eigenständig
// nachgebaut und auf Produktebene direkt angewandt). `cap20`/`cap40` und `total`
// sind in derselben Einheit (Stück bei Einzelprodukt, cm³ bei Konsolidierung).
function planContainers(
  total: number,
  cap20: number,
  cap40: number,
): { target: number; anzahl_20dc: number; anzahl_40hq: number; begruendung: string } {
  let anzahl_20dc = 0
  let anzahl_40hq = 0
  let target = 0
  let remaining = total
  const teile: string[] = []

  while (remaining > 0) {
    const schwelleHalb = cap20 / 2
    const schwelleAbrunden = cap20 * 1.3
    const schwelleMitte = (cap20 + cap40) / 2

    if ((anzahl_20dc > 0 || anzahl_40hq > 0) && remaining < schwelleHalb) {
      teile.push(`Rest unter ½ 20DC gestrichen`)
      break
    }

    if (remaining < schwelleHalb) {
      const t = Math.min(remaining * 1.2, cap20)
      target += t
      anzahl_20dc++
      teile.push(`20DC ×1,2`)
      remaining = 0
    } else if (remaining <= cap20) {
      target += cap20
      anzahl_20dc++
      teile.push(`20DC aufgefüllt`)
      remaining = 0
    } else if (remaining <= schwelleAbrunden) {
      target += cap20
      anzahl_20dc++
      teile.push(`20DC abgerundet`)
      remaining = 0
    } else if (remaining < schwelleMitte) {
      const t = remaining * 1.2
      if (t <= cap20) {
        target += t
        anzahl_20dc++
      } else {
        target += t
        anzahl_40hq++
      }
      teile.push(`×1,2 Buffer`)
      remaining = 0
    } else {
      target += cap40
      anzahl_40hq++
      teile.push(`40HQ`)
      remaining -= cap40
    }
  }

  return { target, anzahl_20dc, anzahl_40hq, begruendung: teile.join(', ') }
}

interface OptimalOrder {
  daten: BestelllaufDaten
  warnungen: string[]
  bestelldatumDate: Date
}

// Berechnet aus einer (theoretischen) Wunschmenge die praktische Bestellmenge:
// MOQ-Rundung, dann Container-Optimierung (Produktebene). Die Zwischenstufe
// „nach MOQ" (vor Container-Optimierung) wird getrennt geliefert.
function praktischeMenge(
  p: ProduktInput,
  theoretischInput: number,
): {
  menge_theoretisch: number
  menge_nach_moq: number
  menge_praktisch: number
  anzahl_20dc: number
  anzahl_40hq: number
  begruendung: string
  warnungen: string[]
} {
  const moq = p.moq ?? 0
  const begruendungen: string[] = []
  const warnungen: string[] = []

  let theoretisch = Math.max(0, Math.round(theoretischInput))
  let menge = theoretisch

  // Theoretische Menge ≤ 0 → MOQ (Mindestbestellung).
  if (theoretisch <= 0) {
    menge = moq > 0 ? moq : 0
    if (moq > 0) begruendungen.push(`Restbestand deckt Zielreichweite — Mindestbestellung (MOQ ${moq}).`)
    theoretisch = 0
  }

  // MOQ-Rundung.
  if (moq > 0 && menge > 0 && menge < moq) {
    begruendungen.push(`MOQ-Anpassung: ${menge} → ${moq} Stk.`)
    menge = moq
  }

  // Menge nach MOQ (vor Container-Optimierung) festhalten — das ist „Nach MOQ".
  const mengeNachMoq = menge

  // Container-Optimierung (Produktebene).
  let anzahl_20dc = 0
  let anzahl_40hq = 0
  if (menge > 0) {
    if (p.max_20dc && p.max_40hq) {
      const plan = planContainers(menge, p.max_20dc, p.max_40hq)
      if (plan.target !== menge) {
        begruendungen.push(`Container-Optimierung: ${menge} → ${Math.round(plan.target)} Stk. (${plan.begruendung}).`)
        menge = Math.round(plan.target)
      }
      anzahl_20dc = plan.anzahl_20dc
      anzahl_40hq = plan.anzahl_40hq
    } else {
      warnungen.push('Container-Optimierung übersprungen: Container-Volumen oder Paketmaße fehlen.')
    }
  }

  return {
    menge_theoretisch: theoretisch,
    menge_nach_moq: mengeNachMoq,
    menge_praktisch: menge,
    anzahl_20dc,
    anzahl_40hq,
    begruendung: begruendungen.join(' '),
    warnungen,
  }
}

// Ermittelt für ein Produkt ALLE Bestellungen über den gesamten allgemeinen
// Planungshorizont. Wochensimulation auf Basis der „Lagerposition" (kalkulatorischer
// Bestand = on-hand + bereits eingeplante, noch nicht eingetroffene Bestellungen):
// fällt die Position ≤ Meldebestand, wird bestellt und die Bestellmenge sofort der
// Position hinzugerechnet, damit nicht jede Woche erneut bestellt wird.
function computeOrdersForProdukt(
  p: ProduktInput,
  fixeZugaenge: Zugang[],
  startMonat: Date,
  horizonEnd: Date,
  heute: Date,
): OptimalOrder[] {
  const map = p.monatsabsatz_map
  const fallback = p.monatsabsatz
  const avg = avgMonatsabsatz(map, fallback)
  if (avg <= 0) return []

  const leadTage = gesamtlieferzeitTage(p)
  // Sicherheitsbestand = Ø-Monatsabsatz (über ALLE geplanten Monate) × Monate.
  const sicherheitsbestand = avg * Math.max(0, p.sicherheitsbestand_monate)
  // Meldebestand(t) = realer Absatz über die Lieferzeit ab t + Sicherheitsbestand.
  const meldebestandAm = (d: Date): number =>
    absatzInFenster(map, fallback, d, leadTage) + sicherheitsbestand
  // Wöchentlicher Verbrauch = realer Monatsabsatz / Tage des Monats × 7.
  const wochenverbrauchAm = (d: Date): number =>
    (monatsabsatzAm(map, fallback, d) / tageImMonat(d.getUTCFullYear(), d.getUTCMonth())) * 7

  const zielreichweiteMonate = p.zielreichweite_monate > 0 ? p.zielreichweite_monate : 1
  const zielreichweiteTage = zielreichweiteMonate * TAGE_PRO_MONAT

  // Zugänge (vorhandene fixe + im Lauf neu eingeplante), nach Ankunftszeit.
  const deliveries: Zugang[] = [...fixeZugaenge]
  const applied = new Set<number>()
  let onHand = p.aktueller_bestand
  // Vorhandene fixe Zugänge zählen ab Start als „on-order" (kalkulatorischer Bestand).
  let onOrder = fixeZugaenge.reduce((s, z) => s + z.menge, 0)

  const orders: OptimalOrder[] = []
  const MAX_BESTELLUNGEN = 120 // Sicherheitskappe gegen Endlosschleifen

  for (let i = 0; orders.length < MAX_BESTELLUNGEN; i++) {
    const t = startMonat.getTime() + i * 7 * MS_PRO_TAG
    if (t > horizonEnd.getTime()) break
    const d = new Date(t)

    // Ankünfte dieser Woche: von on-order zu on-hand.
    for (let k = 0; k < deliveries.length; k++) {
      if (!applied.has(k) && deliveries[k].zeit <= t) {
        onHand += deliveries[k].menge
        onOrder -= deliveries[k].menge
        applied.add(k)
      }
    }
    // Verbrauch dieser Woche (realer Monatsabsatz).
    onHand = Math.max(0, onHand - wochenverbrauchAm(d))

    // Lagerposition (kalkulatorischer Bestand) = on-hand + on-order.
    const position = onHand + onOrder
    if (position > meldebestandAm(d)) continue

    // ── Bestellung auslösen ──
    const inVergangenheit = d < heute
    const bestellDate = inVergangenheit ? heute : d
    const warnungen: string[] = []
    if (inVergangenheit || i === 0) {
      warnungen.push('Bestellzeitpunkt bereits überschritten — möglichst sofort bestellen.')
    }
    const dates = computeDates(bestellDate, p)
    const ankunftTime = dates.verfuegbarkeitDate.getTime()

    // Restbestand bei Ankunft: on-hand bis zur Ankunft projizieren (mit bereits
    // geplanten Zugängen, OHNE die hier neu erzeugte Bestellung).
    let rest = onHand
    const restApplied = new Set(applied)
    const wochenBisAnkunft = Math.max(0, Math.ceil((ankunftTime - bestellDate.getTime()) / (7 * MS_PRO_TAG)))
    for (let j = 1; j <= wochenBisAnkunft; j++) {
      const tj = bestellDate.getTime() + j * 7 * MS_PRO_TAG
      for (let k = 0; k < deliveries.length; k++) {
        if (!restApplied.has(k) && deliveries[k].zeit <= tj) {
          rest += deliveries[k].menge
          restApplied.add(k)
        }
      }
      rest = Math.max(0, rest - wochenverbrauchAm(new Date(tj)))
    }

    // Theoretische Menge = geplanter Absatz über die Zielreichweite AB dem
    // Verfügbarkeitsdatum (Monat für Monat tagesanteilig aus der realen
    // Absatzplanung) − Restbestand bei Verfügbarkeit.
    const absatzZielreichweite = absatzInFenster(map, fallback, dates.verfuegbarkeitDate, zielreichweiteTage)
    const pm = praktischeMenge(p, absatzZielreichweite - rest)
    warnungen.push(...pm.warnungen)

    orders.push({
      bestelldatumDate: bestellDate,
      warnungen,
      daten: {
        bestelldatum: dates.bestelldatum,
        produktionsstart_datum: dates.produktionsstart_datum,
        produktionsende_datum: dates.produktionsende_datum,
        shippingdatum: dates.shippingdatum,
        ankunftsdatum: dates.ankunftsdatum,
        verfuegbarkeitsdatum: dates.verfuegbarkeitsdatum,
        menge_theoretisch: pm.menge_theoretisch,
        menge_nach_moq: pm.menge_nach_moq,
        menge_praktisch: pm.menge_praktisch,
        begruendung: pm.begruendung,
        anzahl_20dc: pm.anzahl_20dc,
        anzahl_40hq: pm.anzahl_40hq,
      },
    })

    // Neue Bestellung sofort als on-order einplanen (kalkulatorischer Bestand steigt).
    onOrder += pm.menge_praktisch
    deliveries.push({ zeit: ankunftTime, menge: pm.menge_praktisch })
  }

  return orders
}

// Fixe Zugänge je Produkt aus bestehenden Bestellungen (Ankunftsmenge zum
// Verfügbarkeitsdatum). `nurManuell` schließt Algorithmus-Bestellungen aus, damit
// diese im Re-Run neu bewertet werden.
function zugaengeFuerProdukt(
  produktId: string,
  bestehende: BestehendeBestellungInput[],
  nurManuell: boolean,
): Zugang[] {
  const result: Zugang[] = []
  for (const b of bestehende) {
    if (b.produkt_id !== produktId) continue
    if (nurManuell && b.herkunft !== 'manuell') continue
    const datum = parseDate(b.verfuegbarkeitsdatum ?? b.ankunftsdatum)
    if (!datum) continue
    result.push({ zeit: datum.getTime(), menge: b.menge_praktisch })
  }
  return result
}

// ─── Konsolidierung (Produktebene, gleicher Hersteller, ≤ 30 Tage) ──────────────

function konsolidiere(neue: NeueBestellung[]): void {
  const KONSOLIDIERUNG_TAGE = 30
  for (let i = 0; i < neue.length; i++) {
    for (let j = i + 1; j < neue.length; j++) {
      const a = neue[i]
      const b = neue[j]
      const aDatum = parseDate(a.bestelldatum)
      const bDatum = parseDate(b.bestelldatum)
      if (!aDatum || !bDatum) continue
      const tageDiff = Math.abs(aDatum.getTime() - bDatum.getTime()) / MS_PRO_TAG
      if (tageDiff > KONSOLIDIERUNG_TAGE) continue
      // gleicher Hersteller wird beim Aufbau (siehe runLangfristigerBestelllauf)
      // über die Gruppierung sichergestellt — hier nur Datumsnähe prüfen.
      if (!a.konsolidiert_mit_temp_ids.includes(b.temp_id))
        a.konsolidiert_mit_temp_ids.push(b.temp_id)
      if (!b.konsolidiert_mit_temp_ids.includes(a.temp_id))
        b.konsolidiert_mit_temp_ids.push(a.temp_id)
    }
  }
}

// Baut eine NeueBestellung aus einer berechneten Optimal-Bestellung
// (Produktebene: genau ein sku_mengen-Eintrag, sku_id = produkt_id).
function buildNeueBestellung(optimal: OptimalOrder, p: ProduktInput, tempId: string): NeueBestellung {
  return {
    temp_id: tempId,
    produkt_ids: [p.produkt_id],
    produkt_namen: [p.produkt_name],
    bestelldatum: optimal.daten.bestelldatum,
    produktionsstart_datum: optimal.daten.produktionsstart_datum,
    produktionsende_datum: optimal.daten.produktionsende_datum,
    shippingdatum: optimal.daten.shippingdatum,
    ankunftsdatum: optimal.daten.ankunftsdatum,
    verfuegbarkeitsdatum: optimal.daten.verfuegbarkeitsdatum,
    sku_mengen: [
      {
        sku_id: p.produkt_id,
        sku_name: p.produkt_name,
        menge_theoretisch: optimal.daten.menge_theoretisch ?? 0,
        menge_nach_moq: optimal.daten.menge_nach_moq,
        menge_praktisch: optimal.daten.menge_praktisch,
        begruendung_anpassung: optimal.daten.begruendung,
        is_trigger: true,
      },
    ],
    warnungen: optimal.warnungen,
    container: buildContainerArray(optimal.daten.anzahl_20dc, optimal.daten.anzahl_40hq),
    konsolidiert_mit_temp_ids: [],
  }
}

// ─── Haupt-Export ────────────────────────────────────────────────────────────────

export function runLangfristigerBestelllauf(input: AlgorithmusInput): BestelllaufErgebnis {
  const { startMonat, horizontMonate, heute, produkte, bestehendeBestellungen } = input

  // Ende des Betrachtungsfensters = Startmonat + allgemeiner Planungshorizont.
  const horizonEnd = addMonths(startMonat, Math.max(1, horizontMonate))

  const neue_bestellungen: NeueBestellung[] = []
  const aenderungen_bestehende: BestellungAenderung[] = []
  let tempCounter = 0

  for (const p of produkte) {
    // Bestehende Algorithmus-Bestellungen werden IGNORIERT und komplett neu
    // kalkuliert; NUR manuell angelegte (laufende) Bestellungen zählen als fixe
    // Zugänge. Es gibt daher keine Änderungsempfehlungen — alle berechneten
    // Bestellungen sind neue Bestellungen.
    const fixeZugaenge = zugaengeFuerProdukt(p.produkt_id, bestehendeBestellungen, true)
    const optimalOrders = computeOrdersForProdukt(p, fixeZugaenge, startMonat, horizonEnd, heute)

    for (const optimal of optimalOrders) {
      tempCounter++
      neue_bestellungen.push(buildNeueBestellung(optimal, p, `temp-${tempCounter}`))
    }
  }

  // Konsolidierung: gleiche Hersteller-Gruppen, Bestelldaten ≤ 30 Tage auseinander.
  const herstellerById = new Map(produkte.map((p) => [p.produkt_id, p.hersteller_id]))
  const gruppen = new Map<string, NeueBestellung[]>()
  for (const nb of neue_bestellungen) {
    const hid = herstellerById.get(nb.produkt_ids[0]) ?? null
    if (!hid) continue
    if (!gruppen.has(hid)) gruppen.set(hid, [])
    gruppen.get(hid)!.push(nb)
  }
  for (const gruppe of gruppen.values()) {
    if (gruppe.length >= 2) konsolidiere(gruppe)
  }

  return { aenderungen_bestehende, neue_bestellungen }
}

// ─── Lagerbestandsverlauf (für das Chart) ───────────────────────────────────────

export interface VerlaufMonat {
  label: string
  jahr: number
  monat: number
  /** Bestand zu Monatsanfang (Carry-in, vor Einlagerung). */
  bestand_vorher: number
  /** Bestand zu Monatsende = vorher + Einlagerung − Absatz. */
  bestand_nachher: number
  /** Kalkulatorischer Bestand = Bestand nachher + offene (bereits bestellte, aber
   *  noch nicht verfügbare) Bestellmengen. */
  kalkulatorischer_bestand: number
  sicherheitsbestand: number | null
  meldebestand: number | null
  /** Einlagerung = Zugänge (Ankunft) dieses Monats. */
  ankunft: number
  bestellmenge: number
  absatz: number
  ist_start: boolean
}

const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// Monatsbasierter Verlauf für ein Produkt: Startbestand fällt mit dem je Monat
// geplanten Absatz (aus der Absatzplanung, Summe über Plattformen); gespeicherte
// Bestellungen erhöhen den Bestand zum Verfügbarkeitsmonat.
// Sicherheitsbestand = Ø-Monatsabsatz × Monate (konstante Referenzlinie);
// Meldebestand variiert je Monat = realer Absatz über die Lieferzeit ab diesem
// Monat + Sicherheitsbestand.
// `monatsAbsatzMap` (Schlüssel `${jahr}-${monat}`) liefert die realen Monatswerte;
// fehlt sie, wird die konstante Start-Monats-Rate verwendet (z. B. in Unit-Tests).
export function computeLagerbestandVerlauf(
  p: ProduktInput,
  alleBestellungen: BestehendeBestellungInput[],
  startMonat: Date,
  horizontMonate: number,
  monatsAbsatzMap?: Map<string, number>,
): { monate: VerlaufMonat[]; start_label: string } {
  const map = monatsAbsatzMap
  const fallback = p.monatsabsatz
  const avg = avgMonatsabsatz(map, fallback)
  const hatBedarf = avg > 0
  const leadTage = gesamtlieferzeitTage(p)
  const sicherheitsbestand = hatBedarf ? avg * Math.max(0, p.sicherheitsbestand_monate) : null

  // Zugänge je Monat (Verfügbarkeitsdatum) + Bestellmenge je Bestellmonat.
  const zugangByMonat = new Map<string, number>()
  const bestellByMonat = new Map<string, number>()
  // Offene Bestellungen für den kalkulatorischen Bestand: vom Bestellmonat (inkl.)
  // bis zum Verfügbarkeitsmonat (exkl.) gilt die Menge als „bestellt, noch nicht da".
  const offeneOrders: Array<{ abIndex: number; bisIndex: number; menge: number }> = []
  for (const b of alleBestellungen) {
    if (b.produkt_id !== p.produkt_id) continue
    const v = parseDate(b.verfuegbarkeitsdatum ?? b.ankunftsdatum)
    if (v) {
      const key = `${v.getUTCFullYear()}-${v.getUTCMonth() + 1}`
      zugangByMonat.set(key, (zugangByMonat.get(key) ?? 0) + b.menge_praktisch)
    }
    const o = parseDate(b.bestelldatum)
    if (o) {
      const key = `${o.getUTCFullYear()}-${o.getUTCMonth() + 1}`
      bestellByMonat.set(key, (bestellByMonat.get(key) ?? 0) + b.menge_praktisch)
    }
    if (o && v) {
      offeneOrders.push({
        abIndex: o.getUTCFullYear() * 12 + o.getUTCMonth(),
        bisIndex: v.getUTCFullYear() * 12 + v.getUTCMonth(),
        menge: b.menge_praktisch,
      })
    }
  }

  const monate: VerlaufMonat[] = []
  // Fenster: vom Startmonat über den allgemeinen Planungshorizont (genau N Monate).
  const startJahr = startMonat.getUTCFullYear()
  const startMonatNr = startMonat.getUTCMonth() + 1
  const anzahl = Math.max(1, horizontMonate)
  let bestand = p.aktueller_bestand

  for (let i = 0; i < anzahl; i++) {
    const m0 = startMonatNr - 1 + i // 0-basiert ab Vormonat? nein: ab Start
    const datum = new Date(Date.UTC(startJahr, startMonatNr - 1 + i, 1))
    const jahr = datum.getUTCFullYear()
    const monat = datum.getUTCMonth() + 1
    const key = `${jahr}-${monat}`
    void m0

    const zugang = zugangByMonat.get(key) ?? 0
    const bestellmenge = bestellByMonat.get(key) ?? 0
    // Realer Monatsabsatz (aus der Absatzplanung) für Anzeige und Verbrauch;
    // ohne Map → konstante Start-Monats-Rate.
    const absatzMonat = monatsabsatzAm(map, fallback, datum)
    // Bestand vorher (Monatsanfang) → + Einlagerung − Absatz → Bestand nachher.
    const vorher = bestand
    const nachher = Math.max(0, vorher + zugang - absatzMonat)
    // Kalkulatorischer Bestand = Bestand nachher + offene Bestellmengen, die in
    // diesem Monat bereits bestellt, aber noch nicht eingetroffen sind.
    const monatsIndex = jahr * 12 + (monat - 1)
    const offeneMenge = offeneOrders.reduce(
      (s, o) => (o.abIndex <= monatsIndex && monatsIndex < o.bisIndex ? s + o.menge : s),
      0,
    )
    // Meldebestand für diesen Monat: realer Absatz über die Lieferzeit ab dem
    // Monatsersten + Sicherheitsbestand.
    const meldebestandMonat = hatBedarf
      ? absatzInFenster(map, fallback, datum, leadTage) + (sicherheitsbestand ?? 0)
      : null
    monate.push({
      label: `${MONATSNAMEN[monat - 1]} ${String(jahr).slice(2)}`,
      jahr,
      monat,
      bestand_vorher: Math.round(vorher),
      bestand_nachher: Math.round(nachher),
      kalkulatorischer_bestand: Math.round(nachher + offeneMenge),
      sicherheitsbestand: sicherheitsbestand != null ? Math.round(sicherheitsbestand) : null,
      meldebestand: meldebestandMonat != null ? Math.round(meldebestandMonat) : null,
      ankunft: zugang,
      bestellmenge,
      absatz: Math.round(absatzMonat * 100) / 100,
      ist_start: i === 0,
    })
    bestand = nachher
  }

  const start_label = `${MONATSNAMEN[startMonatNr - 1]} ${String(startJahr).slice(2)}`
  return { monate, start_label }
}
