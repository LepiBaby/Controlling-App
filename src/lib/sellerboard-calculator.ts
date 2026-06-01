import { KpiCategory } from '@/hooks/use-kpi-categories'
import { SellerboardAggregatedRow } from './sellerboard-parser'

export type KpiType =
  | 'brutto_umsatz'
  | 'rabatte'
  | 'rueckerstattungen'
  | 'amazon_ads'
  | 'verkaufsgebuehr'
  | 'retourenkosten'
  | 'plattformgebuehren'

export type RowType = 'umsatz' | 'ausgaben'

export interface SellerboardImportRow {
  _id: string
  rowType: RowType
  kpiType: KpiType
  leistungsdatum: string
  zahlungsdatum: string
  kategorieId: string
  gruppeId: string | null
  untergruppeId: string | null
  salesPlattformId: string | null
  produktId: string | null
  beschreibung: string
  betragNetto: number
  betragBrutto: number
  ustBetrag: number
  hatWarnung: boolean
  warnungText: string | null
  hatFehler: boolean
  fehlerText: string | null
}

export const KPI_TYPE_LABELS: Record<KpiType, string> = {
  brutto_umsatz: 'Brutto-Umsatz',
  rabatte: 'Rabatte',
  rueckerstattungen: 'Rückerstattungen',
  amazon_ads: 'Amazon Ads',
  verkaufsgebuehr: 'Verkaufsgebühr',
  retourenkosten: 'Retourenkosten',
  plattformgebuehren: 'Plattformgebühren',
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function findByName(kategorien: KpiCategory[], level: 1 | 2 | 3, name: string, parentId?: string | null): KpiCategory | undefined {
  return kategorien.find(c =>
    c.level === level &&
    c.name.toLowerCase() === name.toLowerCase() &&
    (parentId === undefined || c.parent_id === parentId)
  )
}

export interface CalculatorInput {
  aggregatedRows: SellerboardAggregatedRow[]
  retourenkostenByMonth: Record<string, Record<string, number>> // monthKey (YYYY-MM) → productId → netto
  amazonFeePerMonth: Record<string, number> // monthKey (YYYY-MM) → netto
  ausgabenKategorien: KpiCategory[]
  umsatzKategorien: KpiCategory[]
  salesPlattformen: KpiCategory[]
}

export function calculateSellerboardRows(input: CalculatorInput): SellerboardImportRow[] {
  const { aggregatedRows, retourenkostenByMonth, amazonFeePerMonth, ausgabenKategorien, umsatzKategorien, salesPlattformen } = input

  // Amazon sales platform
  const amazonPlattform = salesPlattformen.find(p => p.name.toLowerCase().includes('amazon'))
  const amazonId = amazonPlattform?.id ?? null

  // Ausgaben category IDs (by name path)
  const marketingKat = findByName(ausgabenKategorien, 1, 'Marketing')
  const amazonAdsGruppe = marketingKat ? findByName(ausgabenKategorien, 2, 'Amazon Ads', marketingKat.id) : undefined

  const vertriebKat = findByName(ausgabenKategorien, 1, 'Vertrieb')
  const verkaufsgebuehrenGruppe = vertriebKat ? findByName(ausgabenKategorien, 2, 'Verkaufsgebühren', vertriebKat.id) : undefined
  const retourenGruppe = vertriebKat ? findByName(ausgabenKategorien, 2, 'Retouren', vertriebKat.id) : undefined

  const operativKat = findByName(ausgabenKategorien, 1, 'Operativ')
  const salesMarketingGruppe = operativKat ? findByName(ausgabenKategorien, 2, 'Sales & Marketing', operativKat.id) : undefined
  const plattformgebuehrenUntergruppe = salesMarketingGruppe ? findByName(ausgabenKategorien, 3, 'Plattformgebühren', salesMarketingGruppe.id) : undefined

  // Umsatz category IDs (by name match, try variations)
  const bruttoUmsatzKat = findByName(umsatzKategorien, 1, 'Brutto-Umsatz')
    ?? findByName(umsatzKategorien, 1, 'Brutto Umsatz')
    ?? findByName(umsatzKategorien, 1, 'Bruttoumsatz')
    ?? findByName(umsatzKategorien, 1, 'Umsatz')
    ?? umsatzKategorien.find(c => c.level === 1 && c.name.toLowerCase().includes('umsatz') && !c.name.toLowerCase().includes('steuer'))
  const rabatteKat = findByName(umsatzKategorien, 1, 'Rabatte')
    ?? findByName(umsatzKategorien, 1, 'Rabatt')
  const rueckKat = findByName(umsatzKategorien, 1, 'Rückerstattungen')
    ?? findByName(umsatzKategorien, 1, 'Rückerstattung')
    ?? findByName(umsatzKategorien, 1, 'Erstattungen')

  // Product name lookup map
  const productNames = new Map<string, string>()
  for (const agg of aggregatedRows) {
    if (!productNames.has(agg.productId)) productNames.set(agg.productId, agg.productName)
  }

  const rows: SellerboardImportRow[] = []

  // Retourenkosten — ganz oben, eine Zeile pro Monat × Produkt (Datum = 1. des Monats)
  for (const [monthKey, productMap] of Object.entries(retourenkostenByMonth)) {
    const firstOfMonth = `${monthKey}-01`
    for (const [productId, netto] of Object.entries(productMap)) {
      if (netto <= 0) continue
      const productName = productNames.get(productId) ?? productId
      rows.push({
        _id: `retourenkosten-${monthKey}-${productId}`,
        rowType: 'ausgaben',
        kpiType: 'retourenkosten',
        leistungsdatum: firstOfMonth,
        zahlungsdatum: firstOfMonth,
        kategorieId: vertriebKat?.id ?? '',
        gruppeId: retourenGruppe?.id ?? null,
        untergruppeId: null,
        salesPlattformId: amazonId,
        produktId: productId,
        beschreibung: `Retourenkosten – ${productName} – ${monthKey}`,
        betragNetto: r2(netto),
        betragBrutto: r2(netto * 1.19),
        ustBetrag: r2(netto * 0.19),
        hatWarnung: false,
        warnungText: null,
        hatFehler: !vertriebKat,
        fehlerText: !vertriebKat ? "Kategorie 'Vertrieb' nicht im KPI-Modell gefunden" : null,
      })
    }
  }

  // Plattformgebühren — ganz oben, eine Zeile pro Monat (Datum = 1. des Monats)
  for (const [monthKey, netto] of Object.entries(amazonFeePerMonth)) {
    if (netto <= 0) continue
    const firstOfMonth = `${monthKey}-01`
    rows.push({
      _id: `plattformgebuehren-${monthKey}`,
      rowType: 'ausgaben',
      kpiType: 'plattformgebuehren',
      leistungsdatum: firstOfMonth,
      zahlungsdatum: firstOfMonth,
      kategorieId: operativKat?.id ?? '',
      gruppeId: salesMarketingGruppe?.id ?? null,
      untergruppeId: plattformgebuehrenUntergruppe?.id ?? null,
      salesPlattformId: amazonId,
      produktId: null,
      beschreibung: `Produktunabhängige Amazongebühren – ${monthKey}`,
      betragNetto: r2(netto),
      betragBrutto: r2(netto * 1.19),
      ustBetrag: r2(netto * 0.19),
      hatWarnung: false,
      warnungText: null,
      hatFehler: !operativKat || !salesMarketingGruppe,
      fehlerText: !operativKat
        ? "Kategorie 'Operativ' nicht im KPI-Modell gefunden"
        : !salesMarketingGruppe
          ? "Gruppe 'Sales & Marketing' nicht gefunden"
          : null,
    })
  }

  for (const agg of aggregatedRows) {
    // --- Umsatz rows ---
    const bruttoUmsatz = r2(agg.salesOrganic + agg.salesPPC)
    rows.push(makeUmsatz(bruttoUmsatz, bruttoUmsatzKat, agg, 'brutto_umsatz', amazonId, 'Brutto-Umsatz'))

    const rabatte = r2(Math.abs(agg.promoValue))
    rows.push(makeUmsatz(rabatte, rabatteKat, agg, 'rabatte', amazonId, 'Rabatte'))

    const rueck = r2(Math.abs(agg.refundPrincipal + agg.refundPromotion))
    rows.push(makeUmsatz(rueck, rueckKat, agg, 'rueckerstattungen', amazonId, 'Rückerstattungen'))

    // --- Ausgaben rows ---
    const amazonAdsNetto = r2(Math.abs(agg.sponsoredProducts + agg.sponsoredDisplay + agg.sponsoredBrands + agg.sponsoredBrandsVideo))
    rows.push(makeAusgaben(
      amazonAdsNetto,
      marketingKat, amazonAdsGruppe, undefined,
      agg, 'amazon_ads', amazonId, 'Amazon Ads',
    ))

    const verkaufsNetto = r2(-(agg.commission + agg.refundCommission + agg.refundRefundCommission + agg.shippingHB))
    rows.push(makeAusgaben(
      verkaufsNetto,
      vertriebKat, verkaufsgebuehrenGruppe, undefined,
      agg, 'verkaufsgebuehr', amazonId, 'Verkaufsgebühr',
    ))
  }

  return rows
}

function makeUmsatz(
  betrag: number,
  kat: KpiCategory | undefined,
  agg: SellerboardAggregatedRow,
  kpiType: KpiType,
  amazonId: string | null,
  label: string,
): SellerboardImportRow {
  const hatFehler = !kat
  return {
    _id: `${kpiType}-${agg.productId}-${agg.date}`,
    rowType: 'umsatz',
    kpiType,
    leistungsdatum: agg.date,
    zahlungsdatum: agg.date,
    kategorieId: kat?.id ?? '',
    gruppeId: null,
    untergruppeId: null,
    salesPlattformId: amazonId,
    produktId: agg.productId,
    beschreibung: `${label} – ${agg.productName} – ${agg.date}`,
    betragNetto: betrag,
    betragBrutto: betrag,
    ustBetrag: 0,
    hatWarnung: false,
    warnungText: null,
    hatFehler,
    fehlerText: hatFehler ? `Umsatz-Kategorie '${label}' nicht gefunden` : null,
  }
}

function makeAusgaben(
  netto: number,
  kat: KpiCategory | undefined,
  gruppe: KpiCategory | undefined,
  untergruppe: KpiCategory | undefined,
  agg: SellerboardAggregatedRow,
  kpiType: KpiType,
  amazonId: string | null,
  label: string,
  warnungText: string | null = null,
): SellerboardImportRow {
  const hatFehler = !kat
  const istGutschrift = netto < 0
  const effektiveWarnung = istGutschrift
    ? 'Kostengutschrift: Commission-Rückerstattung übersteigt Gebühren dieses Tages'
    : warnungText
  return {
    _id: `${kpiType}-${agg.productId}-${agg.date}`,
    rowType: 'ausgaben',
    kpiType,
    leistungsdatum: agg.date,
    zahlungsdatum: agg.date,
    kategorieId: kat?.id ?? '',
    gruppeId: gruppe?.id ?? null,
    untergruppeId: untergruppe?.id ?? null,
    salesPlattformId: amazonId,
    produktId: agg.productId,
    beschreibung: `${label} – ${agg.productName} – ${agg.date}`,
    betragNetto: netto,
    betragBrutto: r2(netto * 1.19),
    ustBetrag: r2(netto * 0.19),
    hatWarnung: effektiveWarnung !== null,
    warnungText: effektiveWarnung,
    hatFehler,
    fehlerText: hatFehler ? `Ausgaben-Kategorie '${label}' nicht im KPI-Modell gefunden` : null,
  }
}
