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

// ─── Input Types ───────────────────────────────────────────────────────────────

export interface SkuInput {
  sku_id: string
  sku_name: string
  aktueller_bestand: number
  moq_sku: number | null
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
  avg_wochenabsatz: number
}

export interface BestehendeBestellungInput {
  bestellung_id: string
  status: 'plan' | 'laufend'
  bestelldatum: string | null
  ankunftsdatum: string | null
  produkt_ids: string[]
  sku_mengen: Array<{ sku_id: string; produkt_id: string; menge_praktisch: number }>
}

export interface AlgorithmusInput {
  heute: Date
  planungshorizont_wochen: number
  produkte: ProduktInput[]
  absatzplanung: Array<{ produkt_id: string; kw_year: number; kw_number: number; menge: number }>
  bestehendeBestellungen: BestehendeBestellungInput[]
}

// ─── Output Types (must match use-planbestelllauf.ts shapes) ──────────────────

export interface SkuMengeVorschlag {
  sku_id: string
  sku_name: string
  menge_theoretisch: number
  menge_praktisch: number
  begruendung_anpassung: string
}

export interface WizardKonsolidierung {
  mit_temp_id?: string
  mit_bestellung_id?: string
  mit_produkt_namen: string[]
  containerart: string
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
  konsolidierungen: WizardKonsolidierung[]
  warnungen: string[]
}

export interface PlanbestelllaufAenderung {
  bestellung_id: string
  produkt_namen: string[]
  aenderungsart: 'bestelldatum' | 'menge' | 'konsolidierung'
  alt_wert: string
  neu_wert: string
  begruendung: string
  // Structured new values for the API to apply
  neue_daten?: {
    bestelldatum?: string
    produktionsstart_datum?: string
    produktionsende_datum?: string
    shippingdatum?: string
    ankunftsdatum?: string
    verfuegbarkeitsdatum?: string
    sku_mengen?: Array<{ sku_id: string; menge_praktisch: number; begruendung_anpassung: string }>
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

type AbsatzMap = Map<string, Map<string, number>> // produkt_id → kwKey → menge
type LastKnownMap = Map<string, { kw: KwRef; menge: number }> // produkt_id → last known absatz

function buildAbsatzMaps(
  absatzplanung: AlgorithmusInput['absatzplanung']
): { absatzMap: AbsatzMap; lastKnownMap: LastKnownMap } {
  const absatzMap: AbsatzMap = new Map()
  const lastKnownMap: LastKnownMap = new Map()

  for (const row of absatzplanung) {
    if (!absatzMap.has(row.produkt_id)) absatzMap.set(row.produkt_id, new Map())
    const key = kwKey({ year: row.kw_year, week: row.kw_number })
    const existing = absatzMap.get(row.produkt_id)!.get(key) ?? 0
    absatzMap.get(row.produkt_id)!.set(key, existing + (row.menge ?? 0))

    const rowKw: KwRef = { year: row.kw_year, week: row.kw_number }
    const last = lastKnownMap.get(row.produkt_id)
    if (!last || kwBefore(last.kw, rowKw)) {
      lastKnownMap.set(row.produkt_id, { kw: rowKw, menge: row.menge ?? 0 })
    }
  }

  return { absatzMap, lastKnownMap }
}

function getAbsatz(
  produktId: string, kw: KwRef, absatzMap: AbsatzMap, lastKnownMap: LastKnownMap
): number {
  const produktMap = absatzMap.get(produktId)
  if (!produktMap) return 0

  const key = kwKey(kw)
  if (produktMap.has(key)) return produktMap.get(key)!

  // Fallback: use last known value
  const last = lastKnownMap.get(produktId)
  if (!last) return 0

  // Only use fallback for weeks AFTER the last known week
  if (!kwBefore(kw, last.kw)) return last.menge
  return 0
}

function computeMeldebestand(
  produkt: ProduktInput, fromKw: KwRef,
  absatzMap: AbsatzMap, lastKnownMap: LastKnownMap
): number {
  const lieferzeitTage = computeGesamtlieferzeit(produkt)
  const lieferzeitWochen = Math.ceil(lieferzeitTage / 7)

  let absatzUberLieferzeit = 0
  let kw = fromKw
  for (let i = 0; i < lieferzeitWochen; i++) {
    absatzUberLieferzeit += getAbsatz(produkt.produkt_id, kw, absatzMap, lastKnownMap)
    kw = addKw(kw, 1)
  }

  const sicherheitsbestand = produkt.avg_wochenabsatz * produkt.sicherheitsbestand_wochen
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
  produkt: ProduktInput, theoretical: number
): SkuMengenCalc[] {
  const skus = produkt.skus
  if (skus.length === 0) return []

  // Split theoretical quantity proportionally by current stock
  const totalBestand = skus.reduce((s, sku) => s + sku.aktueller_bestand, 0)
  const result: SkuMengenCalc[] = skus.map(sku => {
    const share = totalBestand > 0
      ? sku.aktueller_bestand / totalBestand
      : 1 / skus.length
    const theor = Math.max(0, Math.round(theoretical * share))
    return { sku_id: sku.sku_id, sku_name: sku.sku_name, menge_theoretisch: theor, menge: theor, moq_gerundet: false, begruendung: [] }
  })

  // Apply MOQ
  if (produkt.moq_ebene === 'sku') {
    for (let i = 0; i < result.length; i++) {
      const moq = skus[i].moq_sku ?? 0
      if (moq > 0 && result[i].menge < moq) {
        result[i].begruendung.push(`MOQ-Anpassung: auf ${moq} aufgerundet (MOQ = ${moq})`)
        result[i].menge = moq
        result[i].moq_gerundet = true
      }
    }
  } else if (produkt.moq_ebene === 'produkt' && produkt.moq_gesamt) {
    const moqGesamt = produkt.moq_gesamt
    const currentTotal = result.reduce((s, m) => s + m.menge, 0)
    if (currentTotal < moqGesamt) {
      // Distribute moq_gesamt proportionally
      const diff = moqGesamt - currentTotal
      distributeAmongSkus(result, diff, false)
      result.forEach(m => { if (m.menge > m.menge_theoretisch) m.moq_gerundet = true })
    }
  }

  return result
}

function distributeAmongSkus(
  skuMengen: SkuMengenCalc[], diff: number, skipMoqGerundet: boolean
): void {
  const eligible = skipMoqGerundet
    ? skuMengen.filter(m => !m.moq_gerundet)
    : skuMengen
  if (eligible.length === 0) return

  const totalEligible = eligible.reduce((s, m) => s + m.menge, 0)
  let remaining = diff

  // Distribute proportionally, largest first
  const sorted = [...eligible].sort((a, b) => b.menge - a.menge)
  for (let i = 0; i < sorted.length; i++) {
    const share = totalEligible > 0
      ? sorted[i].menge / totalEligible
      : 1 / sorted.length
    const add = i === sorted.length - 1
      ? remaining
      : Math.round(diff * share)
    const target = skuMengen.find(m => m.sku_id === sorted[i].sku_id)!
    target.menge += add
    remaining -= add
  }
}

function applyContainerOptimierung(
  produkt: ProduktInput, skuMengen: SkuMengenCalc[]
): { finalMengen: SkuMengenCalc[]; containerart: 'plan' | '20DC' | '40HQ' | null; warnungen: string[] } {
  const max20dc = produkt.max_20dc
  const max40hq = produkt.max_40hq
  const warnungen: string[] = []

  if (!max20dc || !max40hq) {
    if (produkt.stueckvolumen_cm3 == null) {
      warnungen.push('Container-Optimierung übersprungen: Paketmaße nicht gepflegt.')
    }
    return { finalMengen: skuMengen, containerart: null, warnungen }
  }

  const total = skuMengen.reduce((s, m) => s + m.menge, 0)
  const schwelleAbrunden = max20dc * 1.3
  const schwelleMitte = (max20dc + max40hq) / 2

  let targetTotal: number
  let containerart: '20DC' | '40HQ'
  let begruendung: string

  if (total < max20dc) {
    targetTotal = max20dc
    containerart = '20DC'
    begruendung = `Container-Optimierung: auf 20DC-Kapazität aufgerundet (+${max20dc - total} Stk.)`
  } else if (total <= schwelleAbrunden) {
    targetTotal = max20dc
    containerart = '20DC'
    begruendung = total > max20dc
      ? `Container-Optimierung: auf 20DC-Kapazität abgerundet (−${total - max20dc} Stk.)`
      : ''
  } else if (total < schwelleMitte) {
    targetTotal = Math.round(total * 1.2)
    containerart = targetTotal <= max20dc ? '20DC' : '40HQ'
    begruendung = `Container-Optimierung: ×1,2 Buffer → ${targetTotal} Stk.`
  } else {
    targetTotal = max40hq
    containerart = '40HQ'
    begruendung = `Container-Optimierung: auf 40HQ-Kapazität aufgerundet (+${max40hq - total} Stk.)`
  }

  if (targetTotal === total) {
    return { finalMengen: skuMengen, containerart, warnungen }
  }

  const diff = targetTotal - total
  const updated = skuMengen.map(m => ({ ...m, begruendung: [...m.begruendung] }))

  if (diff > 0) {
    // Increase: skip moq_gerunded unless all are moq_gerunded
    const hasNonMoq = updated.some(m => !m.moq_gerundet)
    distributeAmongSkus(updated, diff, hasNonMoq)
    updated.forEach(m => { if (begruendung) m.begruendung.push(begruendung) })
  } else {
    // Decrease proportionally
    const totalBeforeReduce = updated.reduce((s, m) => s + m.menge, 0)
    for (const m of updated) {
      const newMenge = Math.max(0, Math.round(m.menge * (targetTotal / totalBeforeReduce)))
      if (newMenge !== m.menge && begruendung) m.begruendung.push(begruendung)
      m.menge = newMenge
    }
    // Fix rounding drift
    const newTotal = updated.reduce((s, m) => s + m.menge, 0)
    if (newTotal !== targetTotal) {
      const drift = targetTotal - newTotal
      const target = updated.reduce((a, b) => (a.menge >= b.menge ? a : b))
      target.menge += drift
    }
  }

  return { finalMengen: updated, containerart, warnungen }
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
  absatzMap: AbsatzMap,
  lastKnownMap: LastKnownMap,
  laufendDeliveries: Array<{ kw: KwRef; menge: number }>,
  tempIdCounter: { n: number },
): OrderResult[] {
  const lieferzeitTage = computeGesamtlieferzeit(produkt)
  const lieferzeitWochen = Math.ceil(lieferzeitTage / 7)

  let stock = produkt.skus.reduce((s, sku) => s + sku.aktueller_bestand, 0)
  const futureDeliveries: Array<{ kw: KwRef; menge: number }> = [...laufendDeliveries]
  const orders: OrderResult[] = []

  let simKw = aktuelleKw

  while (kwBefore(simKw, horizonEndKw) || kwEqual(simKw, horizonEndKw)) {
    const meldebestand = computeMeldebestand(produkt, simKw, absatzMap, lastKnownMap)

    // Search forward for next trigger
    let searchStock = stock
    let searchKw = simKw
    let triggerFound = false

    while (kwBefore(searchKw, horizonEndKw) || kwEqual(searchKw, horizonEndKw)) {
      // Add deliveries arriving this week
      for (const d of futureDeliveries) {
        if (kwEqual(d.kw, searchKw)) {
          searchStock += d.menge
        }
      }

      // Subtract weekly sales
      const sales = getAbsatz(produkt.produkt_id, searchKw, absatzMap, lastKnownMap)
      searchStock -= sales

      if (searchStock <= meldebestand) {
        // Bestellzeitpunkt found
        const bestelldatumDate = isoWeekToMonday(searchKw)
        const isInPast = bestelldatumDate < new Date()
        const actualBestelldatum = isInPast ? new Date() : bestelldatumDate

        const dates = computeDates(actualBestelldatum, produkt)
        const ankunftKw = dateToIsoWeek(new Date(dates.ankunftsdatum + 'T00:00:00Z'))

        // Compute theoretical quantity
        const zielreichweiteWochen = produkt.zielreichweite_wochen > 0
          ? produkt.zielreichweite_wochen
          : 12

        // Simulate stock at arrival
        let stockAtAnkunft = searchStock
        let kw2 = addKw(searchKw, 1)
        while (kwBefore(kw2, ankunftKw)) {
          for (const d of futureDeliveries) {
            if (kwEqual(d.kw, kw2)) stockAtAnkunft += d.menge
          }
          stockAtAnkunft -= getAbsatz(produkt.produkt_id, kw2, absatzMap, lastKnownMap)
          kw2 = addKw(kw2, 1)
        }

        // Sum planned absatz from ankunft to ankunft + zielreichweite
        let absatzInZielreichweite = 0
        let kw3 = ankunftKw
        for (let i = 0; i < zielreichweiteWochen; i++) {
          absatzInZielreichweite += getAbsatz(produkt.produkt_id, kw3, absatzMap, lastKnownMap)
          kw3 = addKw(kw3, 1)
        }

        const theoreticalTotal = Math.max(0, absatzInZielreichweite - Math.max(0, stockAtAnkunft))

        // Apply MOQ
        const skuMengenRaw = applyMoqAdjustment(produkt, theoreticalTotal)

        // Apply container optimization
        const { finalMengen, containerart, warnungen } = applyContainerOptimierung(produkt, skuMengenRaw)

        const gesamtmenge = finalMengen.reduce((s, m) => s + m.menge, 0)

        // Build warnungen
        const allWarnungen = [...warnungen]
        if (isInPast) {
          allWarnungen.push('Bestellzeitpunkt bereits überschritten — sofort bestellen.')
        }
        if (gesamtmenge === 0) {
          allWarnungen.push('Theoretische Bestellmenge ist 0 — Bestand deckt die gesamte Zielreichweite.')
        }
        if (!produkt.max_20dc) {
          allWarnungen.push('Container-Daten unvollständig — Container-Optimierung übersprungen.')
        }

        tempIdCounter.n++
        const tempId = `temp-${tempIdCounter.n}`

        const neuePlanbestellung: NeuePlanbestellung = {
          temp_id: tempId,
          produkt_ids: [produkt.produkt_id],
          produkt_namen: [produkt.produkt_name],
          ...dates,
          sku_mengen: finalMengen.map(m => ({
            sku_id: m.sku_id,
            sku_name: m.sku_name,
            menge_theoretisch: m.menge_theoretisch,
            menge_praktisch: m.menge,
            begruendung_anpassung: m.begruendung.join('; '),
          })),
          konsolidierungen: [],
          warnungen: allWarnungen,
          _containerart: containerart,
        } as NeuePlanbestellung & { _containerart: string | null }

        orders.push({ bestelldatum: actualBestelldatum, ankunftKw, gesamtmenge, neuePlanbestellung })

        // Add new order as future delivery for subsequent simulation
        futureDeliveries.push({ kw: ankunftKw, menge: gesamtmenge })

        // Continue from next week
        stock = searchStock
        simKw = addKw(searchKw, 1)
        triggerFound = true
        break
      }

      searchKw = addKw(searchKw, 1)
    }

    if (!triggerFound) break
  }

  return orders
}

// ─── Consolidation check ──────────────────────────────────────────────────────

function checkKonsolidierungen(
  alleBestellungen: Array<NeuePlanbestellung & { _containerart?: string | null }>,
  produktById: Map<string, ProduktInput>,
): void {
  const n = alleBestellungen.length

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = alleBestellungen[i]
      const b = alleBestellungen[j]
      if (!a.bestelldatum || !b.bestelldatum) continue

      // Same manufacturer check
      const herstellerA = a.produkt_ids.map(id => produktById.get(id)?.hersteller_id).filter(Boolean)[0]
      const herstellerB = b.produkt_ids.map(id => produktById.get(id)?.hersteller_id).filter(Boolean)[0]
      if (!herstellerA || !herstellerB || herstellerA !== herstellerB) continue

      // Date proximity check (≤30 days)
      const dA = new Date(a.bestelldatum + 'T00:00:00Z')
      const dB = new Date(b.bestelldatum + 'T00:00:00Z')
      const diffDays = Math.abs(dA.getTime() - dB.getTime()) / 86_400_000
      if (diffDays > 30) continue

      // Combined volume check
      const volA = computeBestellungVolumen(a, produktById)
      const volB = computeBestellungVolumen(b, produktById)
      const totalVol = volA + volB

      // Find global container volumes
      const firstProdA = produktById.get(a.produkt_ids[0])
      if (!firstProdA?.max_20dc || !firstProdA?.max_40hq) continue

      // Use volume-based container check
      const stueckvolA = firstProdA.stueckvolumen_cm3
      if (!stueckvolA) continue

      // Get container volumes from the first product's capacities
      // max_20dc = vol_20dc / stueck, max_40hq = vol_40hq / stueck
      // But total volume is mixed products — compare using total piece count
      const totalStueck = a.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)
        + b.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)

      // Determine container type for combined order
      let containerart: '20DC' | '40HQ' | null = null
      if (totalStueck <= firstProdA.max_20dc) containerart = '20DC'
      else if (totalStueck <= firstProdA.max_40hq) containerart = '40HQ'

      if (!containerart) continue // Doesn't fit even in 40HQ

      // Add consolidation to both orders
      a.konsolidierungen.push({
        mit_temp_id: b.temp_id,
        mit_produkt_namen: b.produkt_namen,
        containerart,
      })
      b.konsolidierungen.push({
        mit_temp_id: a.temp_id,
        mit_produkt_namen: a.produkt_namen,
        containerart,
      })
    }
  }
}

function computeBestellungVolumen(
  bestellung: NeuePlanbestellung,
  produktById: Map<string, ProduktInput>,
): number {
  let vol = 0
  for (const id of bestellung.produkt_ids) {
    const p = produktById.get(id)
    if (!p?.stueckvolumen_cm3) continue
    const menge = bestellung.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)
    vol += menge * p.stueckvolumen_cm3
  }
  return vol
}

// ─── Compare with existing plan orders ────────────────────────────────────────

function buildAenderungen(
  optimalOrders: OrderResult[],
  bestehendePlanOrders: BestehendeBestellungInput[],
  produkt: ProduktInput,
): PlanbestelllaufAenderung[] {
  const aenderungen: PlanbestelllaufAenderung[] = []

  for (const existing of bestehendePlanOrders) {
    if (!existing.bestelldatum) continue

    const existingDate = new Date(existing.bestelldatum + 'T00:00:00Z')

    // Find closest optimal order by date
    let closest: OrderResult | null = null
    let closestDiff = Infinity
    for (const opt of optimalOrders) {
      const diff = Math.abs(opt.bestelldatum.getTime() - existingDate.getTime()) / 86_400_000
      if (diff < closestDiff) {
        closestDiff = diff
        closest = opt
      }
    }

    if (!closest) continue

    // Date change recommendation (>7 days difference)
    if (closestDiff > 7) {
      const newDates = closest.neuePlanbestellung
      aenderungen.push({
        bestellung_id: existing.bestellung_id,
        produkt_namen: [produkt.produkt_name],
        aenderungsart: 'bestelldatum',
        alt_wert: existing.bestelldatum,
        neu_wert: newDates.bestelldatum ?? '',
        begruendung: 'Bestellzeitpunkt hat sich aufgrund aktualisierter Absatzplanung oder Stammdaten geändert.',
        neue_daten: {
          bestelldatum: newDates.bestelldatum ?? undefined,
          produktionsstart_datum: newDates.produktionsstart_datum ?? undefined,
          produktionsende_datum: newDates.produktionsende_datum ?? undefined,
          shippingdatum: newDates.shippingdatum ?? undefined,
          ankunftsdatum: newDates.ankunftsdatum ?? undefined,
          verfuegbarkeitsdatum: newDates.verfuegbarkeitsdatum ?? undefined,
        },
      })
    }

    // Quantity change recommendation (>15% difference)
    const existingTotal = existing.sku_mengen.reduce((s, m) => s + m.menge_praktisch, 0)
    const optimalTotal = closest.gesamtmenge
    const relDiff = existingTotal > 0 ? Math.abs(optimalTotal - existingTotal) / existingTotal : 1
    if (relDiff > 0.15 && optimalTotal !== existingTotal) {
      aenderungen.push({
        bestellung_id: existing.bestellung_id,
        produkt_namen: [produkt.produkt_name],
        aenderungsart: 'menge',
        alt_wert: `${existingTotal} Stk.`,
        neu_wert: `${optimalTotal} Stk.`,
        begruendung: 'Bestellmenge hat sich aufgrund aktualisierter Absatzplanung geändert.',
        neue_daten: {
          sku_mengen: closest.neuePlanbestellung.sku_mengen.map(m => ({
            sku_id: m.sku_id,
            menge_praktisch: m.menge_praktisch,
            begruendung_anpassung: m.begruendung_anpassung,
          })),
        },
      })
    }
  }

  return aenderungen
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function runPlanbestelllauf(input: AlgorithmusInput): PlanbestelllaufErgebnis {
  const { heute, planungshorizont_wochen, produkte, absatzplanung, bestehendeBestellungen } = input

  if (produkte.length === 0) {
    return { aenderungen_bestehende: [], neue_planbestellungen: [] }
  }

  const aktuelleKw = dateToIsoWeek(heute)
  const horizonEndKw = addKw(aktuelleKw, planungshorizont_wochen)

  const { absatzMap, lastKnownMap } = buildAbsatzMaps(absatzplanung)

  // Build laufend deliveries per product
  const laufendByProdukt = new Map<string, Array<{ kw: KwRef; menge: number }>>()
  for (const b of bestehendeBestellungen) {
    if (b.status !== 'laufend' || !b.ankunftsdatum) continue
    const ankunftKw = dateToIsoWeek(new Date(b.ankunftsdatum + 'T00:00:00Z'))
    for (const sm of b.sku_mengen) {
      if (!laufendByProdukt.has(sm.produkt_id)) laufendByProdukt.set(sm.produkt_id, [])
      laufendByProdukt.get(sm.produkt_id)!.push({ kw: ankunftKw, menge: sm.menge_praktisch })
    }
  }

  // Build produktById map
  const produktById = new Map<string, ProduktInput>()
  for (const p of produkte) produktById.set(p.produkt_id, p)

  // Get existing plan orders per product
  const planOrdersByProdukt = new Map<string, BestehendeBestellungInput[]>()
  for (const b of bestehendeBestellungen) {
    if (b.status !== 'plan') continue
    for (const pid of b.produkt_ids) {
      if (!planOrdersByProdukt.has(pid)) planOrdersByProdukt.set(pid, [])
      planOrdersByProdukt.get(pid)!.push(b)
    }
  }

  const neuePlanbestellungen: NeuePlanbestellung[] = []
  const aenderungen: PlanbestelllaufAenderung[] = []
  const tempIdCounter = { n: 0 }

  for (const produkt of produkte) {
    if (produkt.skus.length === 0) continue

    const laufendDeliveries = laufendByProdukt.get(produkt.produkt_id) ?? []
    const optimalOrders = simulateProdukt(
      produkt, aktuelleKw, horizonEndKw, absatzMap, lastKnownMap,
      laufendDeliveries, tempIdCounter,
    )

    if (optimalOrders.length === 0) continue

    // Compare with existing plan orders
    const existingPlanOrders = planOrdersByProdukt.get(produkt.produkt_id) ?? []
    const produktAenderungen = buildAenderungen(optimalOrders, existingPlanOrders, produkt)
    aenderungen.push(...produktAenderungen)

    // Determine which optimal orders are "new" (not covered by existing plan orders)
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

  // Consolidation check
  const allForConsolidation = neuePlanbestellungen as Array<NeuePlanbestellung & { _containerart?: string | null }>
  checkKonsolidierungen(allForConsolidation, produktById)

  // Clean up internal fields
  for (const b of neuePlanbestellungen) {
    delete (b as unknown as Record<string, unknown>)._containerart
  }

  return { aenderungen_bestehende: aenderungen, neue_planbestellungen: neuePlanbestellungen }
}
