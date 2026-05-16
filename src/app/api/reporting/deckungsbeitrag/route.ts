import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ABSCHREIBUNG_MONATE, addMonthsWithClamp, roundTo2 } from '@/lib/abschreibung-utils'

// ─── Schema ───────────────────────────────────────────────────────────────────

const querySchema = z.object({
  von: z.string().regex(/^\d{4}-\d{2}$/, 'von muss im Format YYYY-MM sein'),
  bis: z.string().regex(/^\d{4}-\d{2}$/, 'bis muss im Format YYYY-MM sein'),
  granularitaet: z.enum(['monat', 'quartal', 'jahr']).default('monat'),
  produkt_ids: z.string().optional(),
  plattform_ids: z.string().optional(),
})

type Granularitaet = 'monat' | 'quartal' | 'jahr'

// ─── Perioden-Utilities ───────────────────────────────────────────────────────

function monthEnd(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number)
  return `${yyyyMM}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

function dateToPeriod(date: string, gran: Granularitaet): string {
  const [year, month] = date.split('-')
  if (gran === 'monat') return `${year}-${month}`
  if (gran === 'quartal') return `${year}-Q${Math.ceil(parseInt(month, 10) / 3)}`
  return year
}

function generatePerioden(von: string, bis: string, gran: Granularitaet): string[] {
  const perioden: string[] = []
  const seen = new Set<string>()
  const [vonY, vonM] = von.split('-').map(Number)
  const [bisY, bisM] = bis.split('-').map(Number)
  let y = vonY, m = vonM
  while (y < bisY || (y === bisY && m <= bisM)) {
    const key = dateToPeriod(`${y}-${String(m).padStart(2, '0')}-01`, gran)
    if (!seen.has(key)) { seen.add(key); perioden.push(key) }
    m++
    if (m > 12) { m = 1; y++ }
  }
  return perioden
}

// ─── Akkumulator ─────────────────────────────────────────────────────────────

type PeriodMap = Map<string, number>
type EntityMap = Map<string, PeriodMap>

function addTo(map: EntityMap, id: string, period: string, amount: number) {
  if (!map.has(id)) map.set(id, new Map())
  const pm = map.get(id)!
  pm.set(period, roundTo2((pm.get(period) ?? 0) + amount))
}

function getValues(map: EntityMap, id: string, perioden: string[]): Record<string, number> {
  const pm = map.get(id)
  return Object.fromEntries(perioden.map(p => [p, roundTo2(pm?.get(p) ?? 0)]))
}

function zeroValues(perioden: string[]): Record<string, number> {
  return Object.fromEntries(perioden.map(p => [p, 0]))
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    von: searchParams.get('von'),
    bis: searchParams.get('bis'),
    granularitaet: searchParams.get('granularitaet') ?? 'monat',
    produkt_ids: searchParams.get('produkt_ids') ?? undefined,
    plattform_ids: searchParams.get('plattform_ids') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { von, bis, granularitaet } = parsed.data
  if (von > bis) {
    return NextResponse.json({ error: 'von muss <= bis sein' }, { status: 400 })
  }

  const produktIds = parsed.data.produkt_ids ? parsed.data.produkt_ids.split(',').filter(Boolean) : []
  const plattformIds = parsed.data.plattform_ids ? parsed.data.plattform_ids.split(',').filter(Boolean) : []

  const vonDate = `${von}-01`
  const bisDate = monthEnd(bis)
  const perioden = generatePerioden(von, bis, granularitaet)

  // ── 1. Report-Positionen laden (nur in_deckungsbeitragsreport = true) ──────

  const { data: rpRows, error: rpErr } = await supabase
    .from('report_positionen')
    .select('id, name, type, sort_order, investitionsbezogen')
    .eq('user_id', user!.id)
    .eq('in_deckungsbeitragsreport', true)
    .order('sort_order', { ascending: true })

  if (rpErr) return NextResponse.json({ error: rpErr.message }, { status: 500 })
  if (!rpRows || rpRows.length === 0) {
    return NextResponse.json({ perioden, positionen: [] })
  }

  const positionIds = rpRows.map(r => r.id)

  // ── 2. Kategorie-Zuweisungen + Summen-Refs laden ──────────────────────────

  const [
    { data: rpKatRows, error: rpKatErr },
    { data: rpSumRows, error: rpSumErr },
  ] = await Promise.all([
    supabase
      .from('report_position_kategorien')
      .select('report_position_id, kpi_category_id')
      .in('report_position_id', positionIds),
    supabase
      .from('report_summe_positionen')
      .select('report_position_id, referenced_position_id')
      .in('report_position_id', positionIds),
  ])

  if (rpKatErr) return NextResponse.json({ error: rpKatErr.message }, { status: 500 })
  if (rpSumErr) return NextResponse.json({ error: rpSumErr.message }, { status: 500 })

  const assignedCatIds = new Set<string>((rpKatRows ?? []).map(r => r.kpi_category_id))

  // ── 3. KPI-Kategorien + Transaktionen + Bestandsdaten parallel laden ──────
  // Umsatz, Ausgaben und Bestand werden mit Produkt/Plattform-Filter eingeschränkt.
  // Die Query-Builder werden inline im Promise.all-Array erstellt, damit die
  // Mock-Reihenfolge in Tests der Original-Rentabilitätsroute entspricht.

  const [
    { data: allCats,           error: catsErr },
    { data: plattformenCats,   error: pltErr  },
    { data: produkteCats,      error: prdErr  },
    { data: umsatzRows,        error: uErr    },
    { data: ausgabenRows,      error: aErr    },
    { data: abschreibungRows,  error: abErr   },
    { data: bestandTranRows,   error: btErr   },
    { data: produktkostenRows, error: pkErr   },
  ] = await Promise.all([
    supabase
      .from('kpi_categories')
      .select('id, name, type, level, parent_id, sort_order, sales_plattform_enabled, produkt_enabled, ist_abzugsposten')
      .in('type', ['umsatz', 'ausgaben_kosten']),
    supabase
      .from('kpi_categories')
      .select('id, name')
      .eq('type', 'sales_plattformen'),
    supabase
      .from('kpi_categories')
      .select('id, name, ust_satz')
      .eq('type', 'produkte')
      .eq('level', 1),
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('umsatz_transaktionen')
        .select('leistungsdatum, betrag, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id')
        .gte('leistungsdatum', vonDate)
        .lte('leistungsdatum', bisDate)
      if (produktIds.length > 0) q = q.in('produkt_id', produktIds)
      if (plattformIds.length > 0) q = q.in('sales_plattform_id', plattformIds)
      return q
    })(),
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('ausgaben_kosten_transaktionen')
        .select('leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id')
        .not('leistungsdatum', 'is', null)
        .is('abschreibung', null)
        .in('relevanz', ['rentabilitaet', 'beides'])
        .gte('leistungsdatum', vonDate)
        .lte('leistungsdatum', bisDate)
      if (produktIds.length > 0) q = q.in('produkt_id', produktIds)
      if (plattformIds.length > 0) q = q.in('sales_plattform_id', plattformIds)
      return q
    })(),
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id, abschreibung')
      .not('abschreibung', 'is', null)
      .not('leistungsdatum', 'is', null),
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('bestand_transaktionen')
        .select('datum, produkt_id, warenverluste, sendungen_manuell, bestand_sendungen(menge, plattform_id)')
        .gte('datum', vonDate)
        .lte('datum', bisDate)
        .not('produkt_id', 'is', null)
      if (produktIds.length > 0) q = q.in('produkt_id', produktIds)
      return q
    })(),
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('produktkosten_zeitraeume')
        .select('produkt_id, gueltig_von, gueltig_bis, produktkosten_werte(kategorie_id, wert)')
        .lte('gueltig_von', bisDate)
        .or(`gueltig_bis.is.null,gueltig_bis.gte.${vonDate}`)
      if (produktIds.length > 0) q = q.in('produkt_id', produktIds)
      return q
    })(),
  ])

  if (catsErr) return NextResponse.json({ error: catsErr.message }, { status: 500 })
  if (pltErr)  return NextResponse.json({ error: pltErr.message  }, { status: 500 })
  if (prdErr)  return NextResponse.json({ error: prdErr.message  }, { status: 500 })
  if (uErr)    return NextResponse.json({ error: uErr.message    }, { status: 500 })
  if (aErr)    return NextResponse.json({ error: aErr.message    }, { status: 500 })
  if (abErr)   return NextResponse.json({ error: abErr.message   }, { status: 500 })
  if (btErr)   return NextResponse.json({ error: btErr.message   }, { status: 500 })
  if (pkErr)   return NextResponse.json({ error: pkErr.message   }, { status: 500 })

  // ── 3b. Produktinvestitionen-Transaktionen laden ──────────────────────────

  const produktinvestitionenCatId = (allCats ?? []).find(
    c => c.type === 'ausgaben_kosten' && c.level === 1 && c.name?.toLowerCase() === 'produktinvestitionen'
  )?.id ?? null

  let piRows: Array<{
    leistungsdatum: string
    betrag_netto: number | string
    kategorie_id: string
    gruppe_id: string | null
    untergruppe_id: string | null
  }> = []

  if (produktinvestitionenCatId && assignedCatIds.has(produktinvestitionenCatId)) {
    const { data: piData, error: piErr2 } = await supabase
      .from('ausgaben_kosten_transaktionen')
      .select('leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id')
      .eq('kategorie_id', produktinvestitionenCatId)
      .is('abschreibung', null)
      .not('leistungsdatum', 'is', null)
    if (piErr2) return NextResponse.json({ error: piErr2.message }, { status: 500 })
    piRows = piData ?? []
  }

  // ── 4. Lookup-Maps aufbauen ───────────────────────────────────────────────

  const catById = new Map((allCats ?? []).map(c => [c.id, c]))
  const plattformById = new Map((plattformenCats ?? []).map(c => [c.id, c]))
  const produktById = new Map((produkteCats ?? []).map(c => [c.id, c]))

  const catChildren = new Map<string, string[]>()
  for (const c of (allCats ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    if (c.parent_id) {
      if (!catChildren.has(c.parent_id)) catChildren.set(c.parent_id, [])
      catChildren.get(c.parent_id)!.push(c.id)
    }
  }

  // ── 5. Transaktionen akkumulieren ─────────────────────────────────────────

  const catVals: EntityMap = new Map()
  const grpVals: EntityMap = new Map()
  const ugrVals: EntityMap = new Map()
  const pltVals: EntityMap = new Map()
  const pltPrdVals: EntityMap = new Map()

  function processTransaction(
    katId: string | null,
    grpId: string | null,
    ugrId: string | null,
    pltId: string | null,
    prdId: string | null,
    date: string,
    amount: number,
  ) {
    const period = dateToPeriod(date, granularitaet)
    if (katId) addTo(catVals, katId, period, amount)
    if (grpId) addTo(grpVals, grpId, period, amount)
    if (ugrId) addTo(ugrVals, ugrId, period, amount)
    for (const levelId of [katId, grpId, ugrId]) {
      if (!levelId) continue
      if (pltId) {
        addTo(pltVals, `${levelId}:${pltId}`, period, amount)
        if (prdId) addTo(pltPrdVals, `${levelId}:${pltId}:${prdId}`, period, amount)
      }
    }
  }

  for (const row of umsatzRows ?? []) {
    if (!row.leistungsdatum || !row.kategorie_id) continue
    if (!assignedCatIds.has(row.kategorie_id)) continue
    const isAbzug = !!catById.get(row.kategorie_id)?.ist_abzugsposten
    processTransaction(
      row.kategorie_id, row.gruppe_id, row.untergruppe_id,
      row.sales_plattform_id, row.produkt_id,
      row.leistungsdatum, isAbzug ? -Number(row.betrag) : Number(row.betrag),
    )
  }

  for (const row of ausgabenRows ?? []) {
    if (!row.leistungsdatum || !row.kategorie_id) continue
    if (!assignedCatIds.has(row.kategorie_id)) continue
    if (row.kategorie_id === produktinvestitionenCatId) continue
    processTransaction(
      row.kategorie_id, row.gruppe_id, row.untergruppe_id,
      row.sales_plattform_id, row.produkt_id,
      row.leistungsdatum, -Number(row.betrag_netto),
    )
  }

  for (const row of abschreibungRows ?? []) {
    if (!row.leistungsdatum || !row.kategorie_id) continue
    if (!assignedCatIds.has(row.kategorie_id)) continue
    const monate = ABSCHREIBUNG_MONATE[row.abschreibung as string]
    if (!monate) continue
    const betragNetto = Number(row.betrag_netto ?? 0)
    if (betragNetto === 0) continue
    const baseRate = roundTo2(betragNetto / monate)
    const lastRate = roundTo2(betragNetto - baseRate * (monate - 1))
    for (let i = 0; i < monate; i++) {
      const rateDatum = addMonthsWithClamp(row.leistungsdatum, i)
      if (rateDatum < vonDate || rateDatum > bisDate) continue
      processTransaction(
        row.kategorie_id, row.gruppe_id, row.untergruppe_id,
        null, null, rateDatum,
        -(i === monate - 1 ? lastRate : baseRate),
      )
    }
  }

  // ── 5b. Bestandsberechnung ────────────────────────────────────────────────

  const produktKatId = (allCats ?? []).find(
    c => c.type === 'ausgaben_kosten' && c.level === 1 && c.name?.toLowerCase() === 'produkt'
  )?.id ?? null

  if (produktKatId && assignedCatIds.has(produktKatId)) {
    type WertEntry = { kategorie_id: string; wert: number }
    type ZeitraumEntry = { von: string; bis: string | null; werte: WertEntry[] }
    const zeitraumByProdukt = new Map<string, ZeitraumEntry[]>()
    for (const tz of (produktkostenRows ?? []) as Array<{
      produkt_id: string; gueltig_von: string; gueltig_bis: string | null
      produktkosten_werte: Array<{ kategorie_id: string; wert: number }>
    }>) {
      if (!zeitraumByProdukt.has(tz.produkt_id)) zeitraumByProdukt.set(tz.produkt_id, [])
      zeitraumByProdukt.get(tz.produkt_id)!.push({
        von: tz.gueltig_von,
        bis: tz.gueltig_bis,
        werte: (tz.produktkosten_werte ?? []).map(w => ({ kategorie_id: w.kategorie_id, wert: Number(w.wert) })),
      })
    }

    for (const row of (bestandTranRows ?? []) as Array<{
      datum: string; produkt_id: string | null
      bestand_sendungen: Array<{ menge: number; plattform_id: string }>
    }>) {
      if (!row.produkt_id || !row.datum) continue
      const zeitraeume = zeitraumByProdukt.get(row.produkt_id) ?? []
      const matching = zeitraeume.find(z => z.von <= row.datum && (z.bis === null || z.bis >= row.datum))
      if (!matching) continue
      for (const sendung of row.bestand_sendungen ?? []) {
        if (plattformIds.length > 0 && !plattformIds.includes(sendung.plattform_id)) continue
        for (const wert of matching.werte) {
          if (!wert.kategorie_id) continue
          const cost = roundTo2(Number(sendung.menge) * wert.wert)
          if (cost === 0) continue
          processTransaction(
            produktKatId,
            wert.kategorie_id,
            null,
            sendung.plattform_id || null,
            row.produkt_id,
            row.datum,
            -cost,
          )
        }
      }
    }
  }

  // ── 5c. Wertverlust-Berechnung ────────────────────────────────────────────

  const wvKat = (allCats ?? []).find(
    c => c.type === 'ausgaben_kosten' && c.name?.toLowerCase() === 'wertverlust ware'
  )
  const wvGrpId = wvKat?.id ?? null
  const wvTopCatId = wvKat
    ? (wvKat.level === 1 ? wvKat.id : (wvKat.parent_id ?? null))
    : null

  const wvPrdVals: EntityMap = new Map()

  if (wvGrpId && wvTopCatId && assignedCatIds.has(wvTopCatId)) {
    const zeitraumWvByProdukt = new Map<string, Array<{ von: string; bis: string | null; sumWert: number }>>()
    for (const tz of (produktkostenRows ?? []) as Array<{
      produkt_id: string; gueltig_von: string; gueltig_bis: string | null
      produktkosten_werte: Array<{ wert: number }>
    }>) {
      if (!zeitraumWvByProdukt.has(tz.produkt_id)) zeitraumWvByProdukt.set(tz.produkt_id, [])
      const sumWert = roundTo2((tz.produktkosten_werte ?? []).reduce((s, w) => s + Number(w.wert), 0))
      zeitraumWvByProdukt.get(tz.produkt_id)!.push({ von: tz.gueltig_von, bis: tz.gueltig_bis, sumWert })
    }

    for (const row of (bestandTranRows ?? []) as Array<{
      datum: string; produkt_id: string | null; warenverluste: number | null
      bestand_sendungen: Array<{ menge: number; plattform_id: string }>
    }>) {
      if (!row.produkt_id || !row.datum) continue
      const wv = Number(row.warenverluste ?? 0)
      if (wv <= 0) continue
      const zeitraeume = zeitraumWvByProdukt.get(row.produkt_id) ?? []
      const matching = zeitraeume.find(z => z.von <= row.datum && (z.bis === null || z.bis >= row.datum))
      if (!matching || matching.sumWert === 0) continue
      const cost = roundTo2(wv * matching.sumWert)
      if (cost === 0) continue

      // Bei aktivem Plattform-Filter: Kosten proportional nach Sendungsvolumen aufteilen
      let effectiveCost = cost
      if (plattformIds.length > 0) {
        const sendungen = row.bestand_sendungen ?? []
        const totalMenge = sendungen.reduce((s, snd) => s + Number(snd.menge), 0)
        if (totalMenge === 0) continue
        const filteredMenge = sendungen
          .filter(snd => plattformIds.includes(snd.plattform_id))
          .reduce((s, snd) => s + Number(snd.menge), 0)
        effectiveCost = roundTo2(cost * filteredMenge / totalMenge)
        if (effectiveCost === 0) continue
      }

      const period = dateToPeriod(row.datum, granularitaet)
      addTo(catVals, wvTopCatId, period, -effectiveCost)
      if (wvGrpId !== wvTopCatId) addTo(grpVals, wvGrpId, period, -effectiveCost)
      addTo(wvPrdVals, row.produkt_id, period, -effectiveCost)
    }
  }

  // ── 5d. Manuelle-Sendungen-Berechnung ─────────────────────────────────────

  const msKat = (allCats ?? []).find(
    c => c.type === 'ausgaben_kosten' && c.name?.toLowerCase() === 'ersatzteile / kulanz'
  )
  const msGrpId = msKat?.id ?? null
  const msTopCatId = msKat
    ? (msKat.level === 1 ? msKat.id : (msKat.parent_id ?? null))
    : null

  const msPrdVals: EntityMap = new Map()

  if (msGrpId && msTopCatId && assignedCatIds.has(msTopCatId)) {
    const zeitraumMsByProdukt = new Map<string, Array<{ von: string; bis: string | null; sumWert: number }>>()
    for (const tz of (produktkostenRows ?? []) as Array<{
      produkt_id: string; gueltig_von: string; gueltig_bis: string | null
      produktkosten_werte: Array<{ wert: number }>
    }>) {
      if (!zeitraumMsByProdukt.has(tz.produkt_id)) zeitraumMsByProdukt.set(tz.produkt_id, [])
      const sumWert = roundTo2((tz.produktkosten_werte ?? []).reduce((s, w) => s + Number(w.wert), 0))
      zeitraumMsByProdukt.get(tz.produkt_id)!.push({ von: tz.gueltig_von, bis: tz.gueltig_bis, sumWert })
    }

    for (const row of (bestandTranRows ?? []) as Array<{
      datum: string; produkt_id: string | null; sendungen_manuell: number | null
      bestand_sendungen: Array<{ menge: number; plattform_id: string }>
    }>) {
      if (!row.produkt_id || !row.datum) continue
      const ms = Number(row.sendungen_manuell ?? 0)
      if (ms <= 0) continue
      const zeitraeume = zeitraumMsByProdukt.get(row.produkt_id) ?? []
      const matching = zeitraeume.find(z => z.von <= row.datum && (z.bis === null || z.bis >= row.datum))
      if (!matching || matching.sumWert === 0) continue
      const cost = roundTo2(ms * matching.sumWert)
      if (cost === 0) continue

      // Bei aktivem Plattform-Filter: Kosten proportional nach Sendungsvolumen aufteilen
      let effectiveCost = cost
      if (plattformIds.length > 0) {
        const sendungen = row.bestand_sendungen ?? []
        const totalMenge = sendungen.reduce((s, snd) => s + Number(snd.menge), 0)
        if (totalMenge === 0) continue
        const filteredMenge = sendungen
          .filter(snd => plattformIds.includes(snd.plattform_id))
          .reduce((s, snd) => s + Number(snd.menge), 0)
        effectiveCost = roundTo2(cost * filteredMenge / totalMenge)
        if (effectiveCost === 0) continue
      }

      const period = dateToPeriod(row.datum, granularitaet)
      addTo(catVals, msTopCatId, period, -effectiveCost)
      if (msGrpId !== msTopCatId) addTo(grpVals, msGrpId, period, -effectiveCost)
      addTo(msPrdVals, row.produkt_id, period, -effectiveCost)
    }
  }

  // ── 5e. Produktinvestitionen-Raten ────────────────────────────────────────

  const PI_MONATE = 12

  for (const row of piRows) {
    if (!row.leistungsdatum || !row.kategorie_id) continue
    const betragNetto = Number(row.betrag_netto ?? 0)
    if (betragNetto === 0) continue
    const baseRate = roundTo2(betragNetto / PI_MONATE)
    const lastRate = roundTo2(betragNetto - baseRate * (PI_MONATE - 1))
    for (let i = 0; i < PI_MONATE; i++) {
      const rateDatum = addMonthsWithClamp(row.leistungsdatum, i)
      if (rateDatum < vonDate || rateDatum > bisDate) continue
      processTransaction(
        row.kategorie_id, row.gruppe_id, row.untergruppe_id,
        null, null, rateDatum,
        -(i === PI_MONATE - 1 ? lastRate : baseRate),
      )
    }
  }

  // ── 5f. Umsatzsteuer-Berechnung ───────────────────────────────────────────

  const ustPrdNetBase: EntityMap = new Map()

  for (const row of umsatzRows ?? []) {
    if (!row.leistungsdatum || !row.kategorie_id || !row.produkt_id) continue
    const isAbzug = !!catById.get(row.kategorie_id)?.ist_abzugsposten
    const period = dateToPeriod(row.leistungsdatum, granularitaet)
    addTo(ustPrdNetBase, row.produkt_id, period, isAbzug ? -Number(row.betrag) : Number(row.betrag))
  }

  const ustPrdVals: EntityMap = new Map()

  for (const [prdId, periodMap] of ustPrdNetBase) {
    const prd = produktById.get(prdId)
    if (!prd || prd.ust_satz == null || Number(prd.ust_satz) <= 0) continue
    const ustSatz = Number(prd.ust_satz)
    for (const [period, netBase] of periodMap) {
      const ust = roundTo2(netBase * ustSatz / (100 + ustSatz))
      if (ust === 0) continue
      addTo(ustPrdVals, prdId, period, -ust)
    }
  }

  // ── 6. Positions-Werte berechnen ──────────────────────────────────────────

  const katsByPosition = new Map<string, string[]>()
  for (const r of rpKatRows ?? []) {
    if (!katsByPosition.has(r.report_position_id)) katsByPosition.set(r.report_position_id, [])
    katsByPosition.get(r.report_position_id)!.push(r.kpi_category_id)
  }

  const summeRefsByPosition = new Map<string, string[]>()
  for (const r of rpSumRows ?? []) {
    if (!summeRefsByPosition.has(r.report_position_id)) summeRefsByPosition.set(r.report_position_id, [])
    summeRefsByPosition.get(r.report_position_id)!.push(r.referenced_position_id)
  }

  const positionValues = new Map<string, Record<string, number>>()

  for (const pos of rpRows) {
    if (pos.type !== 'position') continue
    const vals = zeroValues(perioden)
    for (const katId of katsByPosition.get(pos.id) ?? []) {
      const kv = catVals.get(katId)
      if (!kv) continue
      for (const p of perioden) vals[p] = roundTo2(vals[p] + (kv.get(p) ?? 0))
    }
    positionValues.set(pos.id, vals)
  }

  for (const pos of rpRows) {
    if (pos.type !== 'umsatzsteuer') continue
    const vals = zeroValues(perioden)
    for (const [, pv] of ustPrdVals) {
      for (const p of perioden) vals[p] = roundTo2(vals[p] + (pv.get(p) ?? 0))
    }
    positionValues.set(pos.id, vals)
  }

  for (const pos of rpRows) {
    if (pos.type !== 'summe') continue
    const vals = zeroValues(perioden)
    for (const refId of summeRefsByPosition.get(pos.id) ?? []) {
      const rv = positionValues.get(refId) ?? zeroValues(perioden)
      for (const p of perioden) vals[p] = roundTo2(vals[p] + (rv[p] ?? 0))
    }
    positionValues.set(pos.id, vals)
  }

  // ── 7. Hierarchischen Response aufbauen ───────────────────────────────────

  function buildPlattformen(parentId: string) {
    const pltPrefix = `${parentId}:`
    const results: {
      id: string; name: string; values: Record<string, number>
      produkte: { id: string; name: string; values: Record<string, number> }[]
    }[] = []
    const seenPlt = new Set<string>()

    for (const key of pltVals.keys()) {
      if (!key.startsWith(pltPrefix)) continue
      const pltId = key.slice(pltPrefix.length)
      if (seenPlt.has(pltId)) continue
      seenPlt.add(pltId)
      const plt = plattformById.get(pltId)
      if (!plt) continue

      const prdPrefix = `${parentId}:${pltId}:`
      const produkte: { id: string; name: string; values: Record<string, number> }[] = []
      const seenPrd = new Set<string>()
      for (const prdKey of pltPrdVals.keys()) {
        if (!prdKey.startsWith(prdPrefix)) continue
        const prdId = prdKey.slice(prdPrefix.length)
        if (seenPrd.has(prdId)) continue
        seenPrd.add(prdId)
        const prd = produktById.get(prdId)
        if (!prd) continue
        produkte.push({ id: prdId, name: prd.name, values: getValues(pltPrdVals, prdKey, perioden) })
      }

      results.push({ id: pltId, name: plt.name, values: getValues(pltVals, key, perioden), produkte })
    }
    return results
  }

  function buildUntergruppe(ugrId: string, spEnabled: boolean) {
    const ugr = catById.get(ugrId)
    if (!ugr) return null
    return {
      id: ugrId,
      name: ugr.name,
      values: getValues(ugrVals, ugrId, perioden),
      sales_plattformen: spEnabled ? buildPlattformen(ugrId) : [],
    }
  }

  function buildGruppe(grpId: string, spEnabled: boolean, isProduktGruppe = false) {
    const grp = catById.get(grpId)
    if (!grp) return null
    const untergruppen = (catChildren.get(grpId) ?? [])
      .filter(id => catById.get(id)?.level === 3)
      .map(id => buildUntergruppe(id, spEnabled))
      .filter(Boolean)
    const hasPlt = isProduktGruppe && [...pltVals.keys()].some(k => k.startsWith(`${grpId}:`))

    const isWvGrp = grpId === wvGrpId && wvGrpId !== wvTopCatId
    const produkteWertverlust = isWvGrp
      ? [...wvPrdVals.entries()]
          .map(([prdId]) => {
            const prd = produktById.get(prdId)
            if (!prd) return null
            return { id: prdId, name: prd.name, values: getValues(wvPrdVals, prdId, perioden) }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : undefined

    const isMsGrp = grpId === msGrpId && msGrpId !== msTopCatId
    const produkteManuelleSendungen = isMsGrp
      ? [...msPrdVals.entries()]
          .map(([prdId]) => {
            const prd = produktById.get(prdId)
            if (!prd) return null
            return { id: prdId, name: prd.name, values: getValues(msPrdVals, prdId, perioden) }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : undefined

    return {
      id: grpId,
      name: grp.name,
      values: getValues(grpVals, grpId, perioden),
      untergruppen,
      sales_plattformen: (spEnabled || hasPlt) && untergruppen.length === 0 ? buildPlattformen(grpId) : [],
      ...(produkteWertverlust !== undefined ? { produkte_wertverlust: produkteWertverlust } : {}),
      ...(produkteManuelleSendungen !== undefined ? { produkte_manuelle_sendungen: produkteManuelleSendungen } : {}),
    }
  }

  function buildKategorie(katId: string) {
    const cat = catById.get(katId)
    if (!cat) return null
    const spEnabled = !!cat.sales_plattform_enabled
    const isProduktKat =
      cat.type === 'ausgaben_kosten' && cat.level === 1 && cat.name?.toLowerCase() === 'produkt'
    const gruppen = (catChildren.get(katId) ?? [])
      .filter(id => catById.get(id)?.level === 2)
      .map(id => buildGruppe(id, spEnabled, isProduktKat))
      .filter(Boolean)

    const isWvKat = katId === wvGrpId && wvGrpId === wvTopCatId
    const produkteWertverlust = isWvKat
      ? [...wvPrdVals.entries()]
          .map(([prdId]) => {
            const prd = produktById.get(prdId)
            if (!prd) return null
            return { id: prdId, name: prd.name, values: getValues(wvPrdVals, prdId, perioden) }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : undefined

    const isMsKat = katId === msGrpId && msGrpId === msTopCatId
    const produkteManuelleSendungen = isMsKat
      ? [...msPrdVals.entries()]
          .map(([prdId]) => {
            const prd = produktById.get(prdId)
            if (!prd) return null
            return { id: prdId, name: prd.name, values: getValues(msPrdVals, prdId, perioden) }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : undefined

    return {
      id: katId,
      name: cat.name,
      kpi_type: cat.type as 'umsatz' | 'ausgaben_kosten',
      values: getValues(catVals, katId, perioden),
      gruppen,
      sales_plattformen: spEnabled && gruppen.length === 0 ? buildPlattformen(katId) : [],
      ...(produkteWertverlust !== undefined ? { produkte_wertverlust: produkteWertverlust } : {}),
      ...(produkteManuelleSendungen !== undefined ? { produkte_manuelle_sendungen: produkteManuelleSendungen } : {}),
    }
  }

  const positionen = rpRows.map(pos => {
    if (pos.type === 'umsatzsteuer') {
      const ust_produkte = [...ustPrdVals.entries()]
        .map(([prdId]) => {
          const prd = produktById.get(prdId)
          if (!prd) return null
          return {
            id: prdId,
            name: prd.name,
            ust_satz: Number(prd.ust_satz),
            values: getValues(ustPrdVals, prdId, perioden),
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
      return {
        id: pos.id,
        name: pos.name,
        type: pos.type,
        sort_order: pos.sort_order,
        investitionsbezogen: pos.investitionsbezogen ?? false,
        values: positionValues.get(pos.id) ?? zeroValues(perioden),
        kategorien: [],
        ust_produkte,
      }
    }
    return {
      id: pos.id,
      name: pos.name,
      type: pos.type,
      sort_order: pos.sort_order,
      investitionsbezogen: pos.investitionsbezogen ?? false,
      values: positionValues.get(pos.id) ?? zeroValues(perioden),
      kategorien: pos.type === 'position'
        ? (katsByPosition.get(pos.id) ?? []).map(buildKategorie).filter(Boolean)
        : [],
      ...(pos.type === 'summe' ? { summe_refs: summeRefsByPosition.get(pos.id) ?? [] } : {}),
    }
  })

  return NextResponse.json({ perioden, positionen })
}
