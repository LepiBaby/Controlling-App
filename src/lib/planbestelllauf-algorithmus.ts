// Pure computation logic for the Planbestelllauf algorithm.
// No database access — all data is passed as parameters.

// ─── KW Utilities ─────────────────────────────────────────────────────────────

interface KwRef { year: number; week: number }

function dateToIsoWeek(date: Date): KwRef {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayOfWeek = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7),
  }
}

function isoWeekToMonday(kw: KwRef): Date {
  const jan4 = new Date(Date.UTC(kw.year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  return new Date(jan4.getTime() - (dow - 1) * 86_400_000 + (kw.week - 1) * 7 * 86_400_000)
}

function addKw(kw: KwRef, weeks: number): KwRef {
  const d = isoWeekToMonday(kw)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return dateToIsoWeek(d)
}

function kwKey(kw: KwRef): string {
  return `${kw.year}-${String(kw.week).padStart(2, '0')}`
}

function kwBefore(a: KwRef, b: KwRef): boolean {
  return a.year < b.year || (a.year === b.year && a.week < b.week)
}

function kwEqual(a: KwRef, b: KwRef): boolean {
  return a.year === b.year && a.week === b.week
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function fmtDE(isoDate: string | null | undefined): string {
  if (!isoDate) return '–'
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y}`
}

// ─── Input Types ───────────────────────────────────────────────────────────────

export interface SkuInput {
  sku_id: string
  sku_name: string
  aktueller_bestand: number
  moq_sku: number | null
  avg_wochenabsatz: number
}

export interface ProduktInput {
  produkt_id: string
  produkt_name: string
  skus: SkuInput[]
  pufferzeit_tage: number
  produktionszeit_tage: number
  zwischenzeit_tage: number
  shipping_zeit_tage: number
  entladungszeit_tage: number
  sicherheitsbestand_wochen: number
  zielreichweite_wochen: number
  moq_ebene: 'produkt' | 'sku'
  moq_gesamt: number | null
  hersteller_id: string | null
  stueckvolumen_cm3: number | null
  max_20dc: number | null
  max_40hq: number | null
}

export interface BestehendeBestellungInput {
  bestellung_id: string
  status: 'plan' | 'laufend'
  herkunft?: 'algorithmus' | 'manuell' | null
  bestelldatum: string | null
  produktionsstart_datum: string | null
  produktionsende_datum: string | null
  shippingdatum: string | null
  ankunftsdatum: string | null
  verfuegbarkeitsdatum: string | null
  produkt_ids: string[]
  sku_mengen: Array<{ sku_id: string; produkt_id: string; menge_praktisch: number; menge_theoretisch: number | null; menge_nach_moq?: number | null }>
}

export interface AlgorithmusInput {
  heute: Date
  planungshorizont_wochen: number
  produkte: ProduktInput[]
  absatzplanung: Array<{ produkt_id: string; sku_id?: string; kw_year: number; kw_number: number; menge: number }>
  bestehendeBestellungen: BestehendeBestellungInput[]
  // 'initial' (Standard): Algorithmus-Planbestellungen werden neu bewertet → Empfehlungen (Schritt 1).
  // 'rerun': zweiter Lauf nach den Entscheidungen aus Schritt 1 — ALLE übergebenen Bestellungen
  //          gelten als fix (Zulauf), es werden keine Empfehlungen erzeugt, nur neue Planbestellungen.
  modus?: 'initial' | 'rerun'
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface SkuMengeVorschlag {
  sku_id: string
  sku_name: string
  menge_theoretisch: number
  menge_nach_moq: number
  menge_praktisch: number
  begruendung_anpassung: string
  is_trigger?: boolean
}

export interface NeuePlanbestellung {
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
}

export interface PlanbestelllaufAenderung {
  bestellung_id: string
  produkt_ids: string[]
  produkt_namen: string[]
  aenderungsart: 'bestelldatum' | 'menge' | 'bestelldatum_und_menge' | 'keine_aenderung' | 'kein_bedarf' | 'konsolidierung'
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
    sku_mengen?: Array<{ sku_id: string; sku_name?: string; menge_theoretisch?: number; menge_nach_moq?: number; menge_praktisch: number; begruendung_anpassung: string }>
  }
}

export interface PlanbestelllaufErgebnis {
  aenderungen_bestehende: PlanbestelllaufAenderung[]
  neue_planbestellungen: NeuePlanbestellung[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeGesamtlieferzeit(p: ProduktInput): number {
  return p.pufferzeit_tage + p.produktionszeit_tage + p.zwischenzeit_tage +
    p.shipping_zeit_tage + p.entladungszeit_tage
}

function computeDates(bestelldatum: Date, p: ProduktInput): {
  bestelldatum: string
  produktionsstart_datum: string
  produktionsende_datum: string
  shippingdatum: string
  ankunftsdatum: string
  verfuegbarkeitsdatum: string
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
  }
}

// Per-SKU absatz maps
type SkuAbsatzMap = Map<string, Map<string, number>>   // sku_id → kwKey → menge
type SkuLastKnownMap = Map<string, { kw: KwRef; menge: number }>  // sku_id → last known

function buildSkuAbsatzMaps(
  absatzplanung: AlgorithmusInput['absatzplanung']
): { skuAbsatzMap: SkuAbsatzMap; skuLastKnownMap: SkuLastKnownMap } {
  const skuAbsatzMap: SkuAbsatzMap = new Map()
  const skuLastKnownMap: SkuLastKnownMap = new Map()

  for (const row of absatzplanung) {
    const skuId = row.sku_id
    if (!skuId) continue

    if (!skuAbsatzMap.has(skuId)) skuAbsatzMap.set(skuId, new Map())
    const key = kwKey({ year: row.kw_year, week: row.kw_number })
    skuAbsatzMap.get(skuId)!.set(key, row.menge ?? 0)

    const rowKw: KwRef = { year: row.kw_year, week: row.kw_number }
    const last = skuLastKnownMap.get(skuId)
    if (!last || kwBefore(last.kw, rowKw)) {
      skuLastKnownMap.set(skuId, { kw: rowKw, menge: row.menge ?? 0 })
    }
  }

  return { skuAbsatzMap, skuLastKnownMap }
}

function getAbsatzSku(
  skuId: string, kw: KwRef, skuAbsatzMap: SkuAbsatzMap, skuLastKnownMap: SkuLastKnownMap
): number {
  const skuMap = skuAbsatzMap.get(skuId)
  if (!skuMap) return 0

  const key = kwKey(kw)
  if (skuMap.has(key)) return skuMap.get(key)!

  // Fallback: use last known value for weeks beyond the planning horizon
  const last = skuLastKnownMap.get(skuId)
  if (!last) return 0
  if (!kwBefore(kw, last.kw)) return last.menge
  return 0
}

function computeMeldebestandSku(
  sku: SkuInput, produkt: ProduktInput, fromKw: KwRef,
  skuAbsatzMap: SkuAbsatzMap, skuLastKnownMap: SkuLastKnownMap
): number {
  const lieferzeitTage = computeGesamtlieferzeit(produkt)
  const lieferzeitWochen = Math.ceil(lieferzeitTage / 7)

  let absatzUberLieferzeit = 0
  let kw = fromKw
  for (let i = 0; i < lieferzeitWochen; i++) {
    absatzUberLieferzeit += getAbsatzSku(sku.sku_id, kw, skuAbsatzMap, skuLastKnownMap)
    kw = addKw(kw, 1)
  }

  const sicherheitsbestand = sku.avg_wochenabsatz * produkt.sicherheitsbestand_wochen
  return Math.ceil(absatzUberLieferzeit + sicherheitsbestand)
}

// ─── MOQ + Container optimization ─────────────────────────────────────────────

interface SkuMengenCalc {
  sku_id: string
  sku_name: string
  menge_theoretisch: number
  menge: number
  moq_gerundet: boolean
  begruendung: string[]
}

function applyMoqAdjustment(
  produkt: ProduktInput, initialMengen: SkuMengenCalc[]
): SkuMengenCalc[] {
  const result: SkuMengenCalc[] = initialMengen.map(m => ({ ...m, begruendung: [...m.begruendung] }))

  // 'produkt'-Ebene bedeutet: gleiche MOQ gilt je einzelner SKU (nicht als Gesamtsumme)
  for (const m of result) {
    const moq = produkt.moq_ebene === 'sku'
      ? (produkt.skus.find(s => s.sku_id === m.sku_id)?.moq_sku ?? 0)
      : (produkt.moq_gesamt ?? 0)

    if (moq > 0 && m.menge < moq) {
      const schwelle50 = Math.round(moq * 0.5)
      if (m.menge_theoretisch < moq * 0.5) {
        m.menge = 0
        m.begruendung.push(`Nicht bestellt: ${m.menge_theoretisch} < ${schwelle50} Stk. (50 % MOQ ${moq})`)
      } else {
        m.begruendung.push(`MOQ: ${m.menge_theoretisch}→${moq} Stk.`)
        m.menge = moq
        m.moq_gerundet = true
      }
    }
  }

  return result
}

function computeContainerPlan(
  total: number, max20dc: number, max40hq: number
): { targetTotal: number; containers: Array<'20DC' | '40HQ'>; begruendung: string } {
  const containers: Array<'20DC' | '40HQ'> = []
  const begruendungen: string[] = []
  let targetTotal = 0
  let remaining = total

  while (remaining > 0) {
    const schwelleHalb = max20dc / 2
    const schwelleAbrunden = max20dc * 1.3
    const schwelleMitte = (max20dc + max40hq) / 2

    // Nach mindestens einem gebuchten Container: Rest unter 20DC-Kapazität wird gestrichen —
    // ein weiterer kleiner Container ist nach ganzen Containerladungen wirtschaftlich nicht sinnvoll.
    if (containers.length > 0 && remaining < schwelleHalb) {
      begruendungen.push(`Rest ${remaining} Stk. gestrichen (unter ½ 20DC — nicht wirtschaftlich)`)
      break
    }

    if (remaining < schwelleHalb) {
      const target = Math.min(Math.round(remaining * 1.2), max20dc)
      targetTotal += target
      containers.push('20DC')
      begruendungen.push(`20DC ×1,2: ${remaining}→${target} Stk.`)
      remaining = 0
    } else if (remaining <= max20dc) {
      targetTotal += max20dc
      containers.push('20DC')
      begruendungen.push(`20DC: ${remaining}→${max20dc} Stk.`)
      remaining = 0
    } else if (remaining <= schwelleAbrunden) {
      targetTotal += max20dc
      containers.push('20DC')
      begruendungen.push(`20DC abgerundet: ${remaining}→${max20dc} Stk.`)
      remaining = 0
    } else if (remaining < schwelleMitte) {
      const target = Math.round(remaining * 1.2)
      const container = target <= max20dc ? '20DC' : '40HQ'
      targetTotal += target
      containers.push(container)
      begruendungen.push(`${container} ×1,2: ${remaining}→${target} Stk.`)
      remaining = 0
    } else {
      // At or above midpoint: book a full 40HQ and continue with remainder
      const restNach40hq = remaining - max40hq
      targetTotal += max40hq
      containers.push('40HQ')
      begruendungen.push(`40HQ: ${max40hq} Stk.${restNach40hq > 0 ? `, Rest ${restNach40hq} Stk.` : ''}`)
      remaining -= max40hq
    }
  }

  return { targetTotal, containers, begruendung: begruendungen.join('; ') }
}

function applyContainerOptimierung(
  produkt: ProduktInput, skuMengen: SkuMengenCalc[]
): { finalMengen: SkuMengenCalc[]; containers: Array<'20DC' | '40HQ'>; warnungen: string[] } {
  const max20dc = produkt.max_20dc
  const max40hq = produkt.max_40hq
  const warnungen: string[] = []

  if (!max20dc || !max40hq) {
    const fehlend: string[] = []
    if (produkt.stueckvolumen_cm3 == null) fehlend.push('Stückvolumen (cm³)')
    if (!max20dc) fehlend.push('max. 20DC-Kapazität')
    if (!max40hq) fehlend.push('max. 40HQ-Kapazität')
    warnungen.push(`Container-Optimierung übersprungen: Fehlende Stammdaten (${fehlend.join(', ')}) — bitte in Produktinformationen ergänzen.`)
    return { finalMengen: skuMengen, containers: [], warnungen }
  }

  const total = skuMengen.reduce((s, m) => s + m.menge, 0)
  if (total === 0) {
    return { finalMengen: skuMengen, containers: [], warnungen }
  }

  const { targetTotal, containers, begruendung } = computeContainerPlan(total, max20dc, max40hq)

  if (targetTotal === total) {
    return { finalMengen: skuMengen, containers, warnungen }
  }

  const updated = skuMengen.map(m => ({ ...m, begruendung: [...m.begruendung] }))
  const diff = targetTotal - total

  const getMoq = (skuId: string): number =>
    produkt.moq_ebene === 'sku'
      ? (produkt.skus.find(s => s.sku_id === skuId)?.moq_sku ?? 0)
      : (produkt.moq_gesamt ?? 0)

  const getFloor = (m: SkuMengenCalc): number => getMoq(m.sku_id)

  if (diff > 0) {
    // Upscale: scale from menge_theoretisch proportionally, floor at MOQ.
    // MOQ-rounded SKUs can also receive extra capacity if their theoretisch × ratio > MOQ.
    const totalTheoretical = updated.reduce((s, m) => s + m.menge_theoretisch, 0)
    const ratio = totalTheoretical > 0 ? targetTotal / totalTheoretical : 1

    for (const m of updated) {
      const moq = getMoq(m.sku_id)
      const scaled = Math.round(m.menge_theoretisch * ratio)
      const newMenge = moq > 0 ? Math.max(moq, scaled) : scaled
      if (newMenge !== m.menge) {
        if (moq > 0 && scaled < moq) {
          m.begruendung.push(`Skaliert: ${m.menge_theoretisch}→${moq} Stk. (MOQ-Boden)`)
        } else {
          m.begruendung.push(`Skaliert: ${m.menge_theoretisch}→${newMenge} Stk.`)
        }
      }
      m.menge = newMenge
    }

    let driftUp = targetTotal - updated.reduce((s, m) => s + m.menge, 0)
    if (driftUp !== 0) {
      const adjustable = [...updated]
        .filter(m => { const moq = getMoq(m.sku_id); return moq <= 0 || m.menge > moq })
        .sort((a, b) => b.menge_theoretisch - a.menge_theoretisch)

      if (driftUp > 0) {
        const first = adjustable[0] ?? updated.reduce((a, b) => (a.menge >= b.menge ? a : b))
        first.menge += driftUp
        first.begruendung.push(`Rundung: +${driftUp} Stk.`)
      } else {
        for (const m of adjustable) {
          if (driftUp === 0) break
          const moq = getMoq(m.sku_id)
          const floor = moq > 0 ? moq : 0
          const maxReduce = m.menge - floor
          if (maxReduce > 0) {
            const reduce = Math.min(-driftUp, maxReduce)
            m.menge -= reduce
            driftUp += reduce
            m.begruendung.push(`Rundung: −${reduce} Stk.`)
          }
        }
        if (driftUp !== 0) {
          const largest = updated.reduce((a, b) => (a.menge >= b.menge ? a : b))
          largest.menge += driftUp
          largest.begruendung.push(`Rundung: ${driftUp > 0 ? '+' : ''}${driftUp} Stk.`)
        }
      }
    }
    if (begruendung) warnungen.push(`Container: ${begruendung}`)
  } else {
    // Downscale: reduce proportionally, floor = max(menge_theoretisch, MOQ)
    const totalBeforeReduce = updated.reduce((s, m) => s + m.menge, 0)
    const reduktionsFaktor = targetTotal / totalBeforeReduce
    for (const m of updated) {
      const floor = getFloor(m)
      const scaledDown = Math.round(m.menge * reduktionsFaktor)
      const newMenge = Math.max(floor, scaledDown)
      if (newMenge !== m.menge) {
        if (scaledDown < floor) {
          m.begruendung.push(`Untergrenze: ${m.menge}→${floor} Stk.`)
        } else {
          m.begruendung.push(`Reduziert: ${m.menge}→${newMenge} Stk.`)
        }
      }
      m.menge = newMenge
    }
    if (begruendung) warnungen.push(`Container: ${begruendung}`)
    const newTotal = updated.reduce((s, m) => s + m.menge, 0)
    if (newTotal !== targetTotal) {
      let drift = targetTotal - newTotal
      if (drift < 0) {
        // Reduce further: SKUs with room above floor = max(theoretisch, MOQ)
        const reducible = [...updated]
          .filter(m => m.menge > getFloor(m))
          .sort((a, b) => (b.menge - getFloor(b)) - (a.menge - getFloor(a)))
        for (const m of reducible) {
          if (drift === 0) break
          const maxReduce = m.menge - getFloor(m)
          const reduce = Math.min(-drift, maxReduce)
          m.menge -= reduce
          drift += reduce
          m.begruendung.push(`Rundung: −${reduce} Stk.`)
        }
        if (drift !== 0) {
          const finalTotal = updated.reduce((s, m) => s + m.menge, 0)
          warnungen.push(`Container-Abweichung: ${finalTotal} Stk. (Ziel: ${targetTotal} Stk.) — alle SKUs am Minimum.`)
        }
      } else {
        const largest = updated.reduce((a, b) => (a.menge >= b.menge ? a : b))
        largest.menge += drift
        largest.begruendung.push(`Rundung: +${drift} Stk.`)
      }
    }
  }

  return { finalMengen: updated, containers, warnungen }
}

// ─── Simulate one product ──────────────────────────────────────────────────────

interface OrderResult {
  bestelldatum: Date
  ankunftKw: KwRef
  gesamtmenge: number
  neuePlanbestellung: NeuePlanbestellung
}

function simulateProdukt(
  produkt: ProduktInput,
  aktuelleKw: KwRef,
  horizonEndKw: KwRef,
  skuAbsatzMap: SkuAbsatzMap,
  skuLastKnownMap: SkuLastKnownMap,
  alleOffenDeliveriesBySku: Map<string, Array<{ kw: KwRef; menge: number }>>,
  tempIdCounter: { n: number },
): OrderResult[] {
  // Kalkulatorischer Bestand = Lagerbestandsposition: startet mit aktuellem Bestand PLUS allen
  // fest zugesagten, noch offenen Zuläufen (laufende Bestellungen + manuelle Planbestellungen).
  // So löst das Signal nicht zu früh aus, wenn bereits Ware unterwegs ist — analog zu neu im Lauf
  // erzeugten Planbestellungen, die ebenfalls sofort (bei Auslösung) auf kalk gebucht werden.
  const skuKalkulatorisch = new Map<string, number>()
  for (const sku of produkt.skus) {
    const offeneZulaeufe = (alleOffenDeliveriesBySku.get(sku.sku_id) ?? [])
      .filter(d => !kwBefore(d.kw, aktuelleKw))
      .reduce((sum, d) => sum + d.menge, 0)
    skuKalkulatorisch.set(sku.sku_id, sku.aktueller_bestand + offeneZulaeufe)
  }

  // Actual projected stock for theoretical demand (restbestand at ankunft)
  const skuActualStock = new Map<string, number>()
  for (const sku of produkt.skus) {
    skuActualStock.set(sku.sku_id, sku.aktueller_bestand)
  }

  // Future deliveries for actual stock projection
  const skuFutureDeliveries = new Map<string, Array<{ kw: KwRef; menge: number }>>()
  for (const sku of produkt.skus) {
    skuFutureDeliveries.set(sku.sku_id, [...(alleOffenDeliveriesBySku.get(sku.sku_id) ?? [])])
  }

  const orders: OrderResult[] = []
  let simKw = aktuelleKw

  while (kwBefore(simKw, horizonEndKw) || kwEqual(simKw, horizonEndKw)) {
    // Apply this week's arrivals and absatz to kalkulatorisch and actual stock
    for (const sku of produkt.skus) {
      const absatz = getAbsatzSku(sku.sku_id, simKw, skuAbsatzMap, skuLastKnownMap)
      let kalk = skuKalkulatorisch.get(sku.sku_id)!
      let s = skuActualStock.get(sku.sku_id)!
      for (const d of skuFutureDeliveries.get(sku.sku_id)!) {
        if (kwEqual(d.kw, simKw)) { s += d.menge }
      }
      const effectiveSales = Math.min(absatz, Math.max(0, s))
      skuKalkulatorisch.set(sku.sku_id, kalk - effectiveSales)
      skuActualStock.set(sku.sku_id, s - effectiveSales)
    }

    // Trigger: collect all SKUs whose kalkulatorischer Bestand <= Meldebestand
    const triggeringSkuIds = new Set<string>()
    for (const sku of produkt.skus) {
      const meldebestand = computeMeldebestandSku(sku, produkt, simKw, skuAbsatzMap, skuLastKnownMap)
      if (skuKalkulatorisch.get(sku.sku_id)! <= meldebestand) {
        triggeringSkuIds.add(sku.sku_id)
      }
    }

    if (triggeringSkuIds.size > 0) {
      const bestelldatumDate = isoWeekToMonday(simKw)
      const isInPast = bestelldatumDate < new Date()
      const actualBestelldatum = isInPast ? new Date() : bestelldatumDate

      const dates = computeDates(actualBestelldatum, produkt)
      const ankunftKw = dateToIsoWeek(new Date(dates.verfuegbarkeitsdatum + 'T00:00:00Z'))

      const zielreichweiteWochen = produkt.zielreichweite_wochen > 0
        ? produkt.zielreichweite_wochen : 12

      // Per-SKU theoretical demand based on actual projected stock at ankunftKw
      const initialSkuMengen: SkuMengenCalc[] = produkt.skus.map(sku => {
        let stockAtAnkunft = skuActualStock.get(sku.sku_id)!
        let kw2 = addKw(simKw, 1)
        while (kwBefore(kw2, ankunftKw)) {
          for (const d of skuFutureDeliveries.get(sku.sku_id)!) {
            if (kwEqual(d.kw, kw2)) stockAtAnkunft += d.menge
          }
          stockAtAnkunft -= Math.min(getAbsatzSku(sku.sku_id, kw2, skuAbsatzMap, skuLastKnownMap), Math.max(0, stockAtAnkunft))
          kw2 = addKw(kw2, 1)
        }
        for (const d of skuFutureDeliveries.get(sku.sku_id)!) {
          if (kwEqual(d.kw, ankunftKw)) stockAtAnkunft += d.menge
        }

        let absatzInZielreichweite = 0
        let kw3 = ankunftKw
        for (let i = 0; i < zielreichweiteWochen; i++) {
          absatzInZielreichweite += getAbsatzSku(sku.sku_id, kw3, skuAbsatzMap, skuLastKnownMap)
          kw3 = addKw(kw3, 1)
        }

        const theoretisch = Math.max(0, Math.round(absatzInZielreichweite - Math.max(0, stockAtAnkunft)))
        return {
          sku_id: sku.sku_id,
          sku_name: sku.sku_name,
          menge_theoretisch: theoretisch,
          menge: theoretisch,
          moq_gerundet: false,
          begruendung: [],
        }
      })

      const skusWithDemand = initialSkuMengen.filter(m => m.menge_theoretisch > 0)

      if (skusWithDemand.length === 0) {
        simKw = addKw(simKw, 1)
        continue
      }

      const totalTheoretical = skusWithDemand.reduce((s, m) => s + m.menge_theoretisch, 0)
      const skuMengenRaw = applyMoqAdjustment(produkt, skusWithDemand)
      const skusToOrder = skuMengenRaw.filter(m => m.menge > 0)
      const skusExcludedByMoq = skuMengenRaw.filter(m => m.menge === 0)

      if (skusToOrder.length === 0 || !skusToOrder.some(m => triggeringSkuIds.has(m.sku_id))) {
        simKw = addKw(simKw, 1)
        continue
      }

      // Capture menge after MOQ adjustment (before container optimization)
      const mengeNachMoqMap = new Map<string, number>()
      for (const m of skuMengenRaw) mengeNachMoqMap.set(m.sku_id, m.menge)

      const totalAfterMoq = skusToOrder.reduce((s, m) => s + m.menge, 0)
      const { finalMengen, containers, warnungen } = applyContainerOptimierung(produkt, skusToOrder)
      const gesamtmenge = finalMengen.reduce((s, m) => s + m.menge, 0)

      const allWarnungen: string[] = []
      if (totalAfterMoq !== totalTheoretical) allWarnungen.push(`MOQ: ${totalTheoretical}→${totalAfterMoq} Stk.`)
      allWarnungen.push(...warnungen)
      if (isInPast) allWarnungen.push(`Bestelldatum in Vergangenheit (${toDateStr(bestelldatumDate)}) → auf heute vorgezogen.`)
      if (!produkt.max_20dc) allWarnungen.push(`Container-Optimierung übersprungen: max_20DC fehlt (Produktinformationen prüfen).`)

      tempIdCounter.n++
      const tempId = `temp-${tempIdCounter.n}`

      const neuePlanbestellung: NeuePlanbestellung = {
        temp_id: tempId,
        produkt_ids: [produkt.produkt_id],
        produkt_namen: [produkt.produkt_name],
        ...dates,
        sku_mengen: [
          ...finalMengen.map(m => ({
            sku_id: m.sku_id,
            sku_name: m.sku_name,
            menge_theoretisch: m.menge_theoretisch,
            menge_nach_moq: mengeNachMoqMap.get(m.sku_id) ?? m.menge_theoretisch,
            menge_praktisch: m.menge,
            begruendung_anpassung: m.begruendung.join('; '),
            is_trigger: triggeringSkuIds.has(m.sku_id),
          })),
          ...skusExcludedByMoq.map(m => ({
            sku_id: m.sku_id,
            sku_name: m.sku_name,
            menge_theoretisch: m.menge_theoretisch,
            menge_nach_moq: 0,
            menge_praktisch: 0,
            begruendung_anpassung: m.begruendung.join('; '),
            is_trigger: triggeringSkuIds.has(m.sku_id),
          })),
        ],
        warnungen: allWarnungen,
        container: containers,
      }

      orders.push({ bestelldatum: actualBestelldatum, ankunftKw, gesamtmenge, neuePlanbestellung })

      // Add new order to delivery tracking and immediately boost kalk so simulation doesn't
      // re-trigger every week when lead time exceeds the remaining planning horizon.
      for (const m of finalMengen) {
        skuFutureDeliveries.get(m.sku_id)!.push({ kw: ankunftKw, menge: m.menge })
        skuKalkulatorisch.set(m.sku_id, skuKalkulatorisch.get(m.sku_id)! + m.menge)
      }
    }

    simKw = addKw(simKw, 1)
  }

  return orders
}

// ─── Compare with existing plan orders ────────────────────────────────────────

function buildAenderungen(
  optimalOrders: OrderResult[],
  bestehendePlanOrders: BestehendeBestellungInput[],
  produkt: ProduktInput,
): PlanbestelllaufAenderung[] {
  const aenderungen: PlanbestelllaufAenderung[] = []
  const claimedIndices = new Set<number>()

  for (const existing of bestehendePlanOrders) {
    if (!existing.bestelldatum) continue
    const existingDate = new Date(existing.bestelldatum + 'T00:00:00Z')
    const existingTotal = existing.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)

    let altContainer: Array<'20DC' | '40HQ'> | undefined
    if (produkt.max_20dc && produkt.max_40hq && existingTotal > 0) {
      const { containers } = computeContainerPlan(existingTotal, produkt.max_20dc, produkt.max_40hq)
      if (containers.length > 0) altContainer = containers
    }

    // Find closest UNCLAIMED optimal order
    let closest: OrderResult | null = null
    let closestIdx = -1
    let closestDiff = Infinity
    for (let i = 0; i < optimalOrders.length; i++) {
      if (claimedIndices.has(i)) continue
      const diff = Math.abs(optimalOrders[i].bestelldatum.getTime() - existingDate.getTime()) / 86_400_000
      if (diff < closestDiff) { closestDiff = diff; closest = optimalOrders[i]; closestIdx = i }
    }

    if (!closest) {
      aenderungen.push({
        bestellung_id: existing.bestellung_id,
        produkt_ids: [produkt.produkt_id],
        produkt_namen: [produkt.produkt_name],
        aenderungsart: 'kein_bedarf',
        alt_wert: `${existingTotal} Stk.`,
        neu_wert: '0 Stk.',
        begruendung: 'Kein Bedarf im Planungshorizont erkannt — Bestellung wird gelöscht.',
        alte_daten: {
          bestelldatum: existing.bestelldatum ?? undefined,
          produktionsstart_datum: existing.produktionsstart_datum ?? undefined,
          produktionsende_datum: existing.produktionsende_datum ?? undefined,
          shippingdatum: existing.shippingdatum ?? undefined,
          ankunftsdatum: existing.ankunftsdatum ?? undefined,
          verfuegbarkeitsdatum: existing.verfuegbarkeitsdatum ?? undefined,
          container: altContainer,
          sku_mengen: existing.sku_mengen.map(m => ({ sku_id: m.sku_id, menge_theoretisch: m.menge_theoretisch, menge_nach_moq: m.menge_nach_moq ?? null, menge_praktisch: m.menge_praktisch })),
        },
      })
      continue
    }

    // Claim this optimal order — no other existing order can match it
    claimedIndices.add(closestIdx)

    const newDates = closest.neuePlanbestellung
    const optimalTotal = closest.gesamtmenge
    const relDiff = existingTotal > 0 ? Math.abs(optimalTotal - existingTotal) / existingTotal : 1

    const datumGeaendert = closestDiff > 7
    const mengeGeaendert = relDiff > 0.15 && optimalTotal !== existingTotal

    if (!datumGeaendert && !mengeGeaendert) {
      aenderungen.push({
        bestellung_id: existing.bestellung_id,
        produkt_ids: [produkt.produkt_id],
        produkt_namen: [produkt.produkt_name],
        aenderungsart: 'keine_aenderung',
        alt_wert: existing.bestelldatum ?? '',
        neu_wert: existing.bestelldatum ?? '',
        begruendung: 'Keine Änderung notwendig.',
        alte_daten: {
          bestelldatum: existing.bestelldatum ?? undefined,
          produktionsstart_datum: existing.produktionsstart_datum ?? undefined,
          produktionsende_datum: existing.produktionsende_datum ?? undefined,
          shippingdatum: existing.shippingdatum ?? undefined,
          ankunftsdatum: existing.ankunftsdatum ?? undefined,
          verfuegbarkeitsdatum: existing.verfuegbarkeitsdatum ?? undefined,
          container: altContainer,
          sku_mengen: existing.sku_mengen.map(m => ({ sku_id: m.sku_id, menge_theoretisch: m.menge_theoretisch, menge_nach_moq: m.menge_nach_moq ?? null, menge_praktisch: m.menge_praktisch })),
        },
      })
      continue
    }

    const begruendungen: string[] = []
    if (datumGeaendert) begruendungen.push(`Bestelldatum verschoben: ${fmtDE(existing.bestelldatum)} → ${fmtDE(newDates.bestelldatum)} (${Math.round(closestDiff)} Tage)`)
    if (mengeGeaendert) begruendungen.push(`Menge: ${existingTotal} → ${optimalTotal} Stk. (${optimalTotal > existingTotal ? '+' : ''}${optimalTotal - existingTotal} Stk., ${Math.round(relDiff * 100)} %)`)

    aenderungen.push({
      bestellung_id: existing.bestellung_id,
      produkt_ids: [produkt.produkt_id],
      produkt_namen: [produkt.produkt_name],
      aenderungsart: datumGeaendert && mengeGeaendert ? 'bestelldatum_und_menge' : datumGeaendert ? 'bestelldatum' : 'menge',
      alt_wert: datumGeaendert ? existing.bestelldatum : `${existingTotal} Stk.`,
      neu_wert: datumGeaendert ? (newDates.bestelldatum ?? '') : `${optimalTotal} Stk.`,
      begruendung: begruendungen.join(' | '),
      alte_daten: {
        bestelldatum: existing.bestelldatum ?? undefined,
        produktionsstart_datum: existing.produktionsstart_datum ?? undefined,
        produktionsende_datum: existing.produktionsende_datum ?? undefined,
        shippingdatum: existing.shippingdatum ?? undefined,
        ankunftsdatum: existing.ankunftsdatum ?? undefined,
        verfuegbarkeitsdatum: existing.verfuegbarkeitsdatum ?? undefined,
        container: altContainer,
        sku_mengen: existing.sku_mengen.map(m => ({ sku_id: m.sku_id, menge_theoretisch: m.menge_theoretisch, menge_nach_moq: m.menge_nach_moq ?? null, menge_praktisch: m.menge_praktisch })),
      },
      warnungen: closest.neuePlanbestellung.warnungen,
      neue_daten: {
        bestelldatum: newDates.bestelldatum ?? undefined,
        produktionsstart_datum: newDates.produktionsstart_datum ?? undefined,
        produktionsende_datum: newDates.produktionsende_datum ?? undefined,
        shippingdatum: newDates.shippingdatum ?? undefined,
        ankunftsdatum: newDates.ankunftsdatum ?? undefined,
        verfuegbarkeitsdatum: newDates.verfuegbarkeitsdatum ?? undefined,
        container: closest.neuePlanbestellung.container.length > 0 ? closest.neuePlanbestellung.container : undefined,
        sku_mengen: newDates.sku_mengen.map(m => ({
          sku_id: m.sku_id,
          sku_name: m.sku_name,
          menge_theoretisch: m.menge_theoretisch,
          menge_nach_moq: m.menge_nach_moq,
          menge_praktisch: m.menge_praktisch,
          begruendung_anpassung: m.begruendung_anpassung,
        })),
      },
    })
  }

  return aenderungen
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function runPlanbestelllauf(input: AlgorithmusInput): PlanbestelllaufErgebnis {
  const { heute, planungshorizont_wochen, produkte, absatzplanung, bestehendeBestellungen } = input

  if (produkte.length === 0) {
    return { aenderungen_bestehende: [], neue_planbestellungen: [] }
  }

  const isRerun = (input.modus ?? 'initial') === 'rerun'

  const aktuelleKw = dateToIsoWeek(heute)
  const horizonEndKw = addKw(aktuelleKw, planungshorizont_wochen)

  const { skuAbsatzMap, skuLastKnownMap } = buildSkuAbsatzMaps(absatzplanung)

  // Kalkulatorischer Bestand: laufende Bestellungen (feste Commitments) und manuell angelegte
  // Planbestellungen (Erstplanbestellungen) als fixe Zugänge einbeziehen.
  // Algorithmus-Planbestellungen werden im 'initial'-Lauf bewusst ausgeschlossen, damit der
  // Algorithmus sie neu bewertet und via buildAenderungen Empfehlungen erzeugen kann.
  // Im 'rerun'-Lauf (nach den Entscheidungen aus Schritt 1) gelten ALLE übergebenen Bestellungen
  // als fix — der Nutzer hat über sie bereits entschieden; es werden nur noch neue Bestellungen
  // darauf aufgerechnet.
  const alleOffenBySku = new Map<string, Array<{ kw: KwRef; menge: number }>>()
  for (const b of bestehendeBestellungen) {
    if (!b.ankunftsdatum) continue
    const isFixed = isRerun || b.status === 'laufend' || (b.status === 'plan' && b.herkunft === 'manuell')
    if (!isFixed) continue
    const ankunftKw = dateToIsoWeek(new Date(b.ankunftsdatum + 'T00:00:00Z'))
    for (const sm of b.sku_mengen) {
      if (!alleOffenBySku.has(sm.sku_id)) alleOffenBySku.set(sm.sku_id, [])
      alleOffenBySku.get(sm.sku_id)!.push({ kw: ankunftKw, menge: sm.menge_praktisch })
    }
  }

  const produktById = new Map<string, ProduktInput>()
  for (const p of produkte) produktById.set(p.produkt_id, p)

  // Im 'rerun' werden keine bestehenden Planbestellungen neu bewertet (der Nutzer hat in Schritt 1
  // bereits entschieden) — die planOrdersByProdukt-Map bleibt leer, es entstehen keine Empfehlungen.
  const planOrdersByProdukt = new Map<string, BestehendeBestellungInput[]>()
  if (!isRerun) {
    for (const b of bestehendeBestellungen) {
      if (b.status !== 'plan') continue
      if (b.herkunft === 'manuell') continue  // Erstplanbestellungen bleiben unverändert
      for (const pid of b.produkt_ids) {
        if (!planOrdersByProdukt.has(pid)) planOrdersByProdukt.set(pid, [])
        planOrdersByProdukt.get(pid)!.push(b)
      }
    }
  }

  const neuePlanbestellungen: NeuePlanbestellung[] = []
  const aenderungen: PlanbestelllaufAenderung[] = []
  const tempIdCounter = { n: 0 }

  for (const produkt of produkte) {
    if (produkt.skus.length === 0) continue

    const alleOffenDeliveriesBySku = new Map<string, Array<{ kw: KwRef; menge: number }>>()
    for (const sku of produkt.skus) {
      alleOffenDeliveriesBySku.set(sku.sku_id, [...(alleOffenBySku.get(sku.sku_id) ?? [])])
    }

    const optimalOrders = simulateProdukt(
      produkt, aktuelleKw, horizonEndKw, skuAbsatzMap, skuLastKnownMap,
      alleOffenDeliveriesBySku, tempIdCounter,
    )

    const existingPlanOrders = planOrdersByProdukt.get(produkt.produkt_id) ?? []
    aenderungen.push(...buildAenderungen(optimalOrders, existingPlanOrders, produkt))

    if (optimalOrders.length === 0) continue

    const coveredOptimalIndices = new Set<number>()
    for (const existing of existingPlanOrders) {
      if (!existing.bestelldatum) continue
      const existingDate = new Date(existing.bestelldatum + 'T00:00:00Z')
      let closestIdx = -1, closestDiff = Infinity
      for (let i = 0; i < optimalOrders.length; i++) {
        if (coveredOptimalIndices.has(i)) continue
        const diff = Math.abs(optimalOrders[i].bestelldatum.getTime() - existingDate.getTime()) / 86_400_000
        if (diff < closestDiff) { closestDiff = diff; closestIdx = i }
      }
      if (closestIdx >= 0 && closestDiff <= 30) coveredOptimalIndices.add(closestIdx)
    }

    for (let i = 0; i < optimalOrders.length; i++) {
      if (!coveredOptimalIndices.has(i)) {
        neuePlanbestellungen.push(optimalOrders[i].neuePlanbestellung)
      }
    }
  }

  // Erstplanbestellungen (herkunft = 'manuell') erscheinen als keine_aenderung,
  // damit sie im Wizard-Schritt 1 sichtbar sind aber nie verändert werden.
  // Im 'rerun' werden keine Empfehlungen/Änderungseinträge erzeugt.
  for (const b of bestehendeBestellungen) {
    if (isRerun) break
    if (b.status !== 'plan' || b.herkunft !== 'manuell') continue
    const existingTotal = b.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)
    const produkt = b.produkt_ids.length > 0 ? produktById.get(b.produkt_ids[0]) : undefined
    let altContainer: Array<'20DC' | '40HQ'> | undefined
    if (produkt?.max_20dc && produkt?.max_40hq && existingTotal > 0) {
      const { containers } = computeContainerPlan(existingTotal, produkt.max_20dc, produkt.max_40hq)
      if (containers.length > 0) altContainer = containers
    }
    aenderungen.push({
      bestellung_id: b.bestellung_id,
      produkt_ids: b.produkt_ids,
      produkt_namen: b.produkt_ids.map(pid => produktById.get(pid)?.produkt_name ?? pid),
      aenderungsart: 'keine_aenderung',
      herkunft: 'manuell',
      alt_wert: b.bestelldatum ?? '',
      neu_wert: b.bestelldatum ?? '',
      begruendung: 'Erstplanbestellung — wird nicht durch den Algorithmus verändert.',
      alte_daten: {
        bestelldatum: b.bestelldatum ?? undefined,
        produktionsstart_datum: b.produktionsstart_datum ?? undefined,
        produktionsende_datum: b.produktionsende_datum ?? undefined,
        shippingdatum: b.shippingdatum ?? undefined,
        ankunftsdatum: b.ankunftsdatum ?? undefined,
        verfuegbarkeitsdatum: b.verfuegbarkeitsdatum ?? undefined,
        container: altContainer,
        sku_mengen: b.sku_mengen.map(m => ({
          sku_id: m.sku_id,
          menge_theoretisch: m.menge_theoretisch,
          menge_nach_moq: m.menge_nach_moq ?? null,
          menge_praktisch: m.menge_praktisch,
        })),
      },
    })
  }

  return { aenderungen_bestehende: aenderungen, neue_planbestellungen: neuePlanbestellungen }
}
