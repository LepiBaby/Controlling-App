import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ABSCHREIBUNG_MONATE, addMonthsWithClamp, roundTo2 } from '@/lib/abschreibung-utils'

// ─── Schema ───────────────────────────────────────────────────────────────────

const querySchema = z.object({
  von: z.string().regex(/^\d{4}-\d{2}$/, 'von muss im Format YYYY-MM sein'),
  bis: z.string().regex(/^\d{4}-\d{2}$/, 'bis muss im Format YYYY-MM sein'),
  granularitaet: z.enum(['monat', 'quartal', 'jahr']).default('monat'),
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
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { von, bis, granularitaet } = parsed.data
  if (von > bis) {
    return NextResponse.json({ error: 'von muss <= bis sein' }, { status: 400 })
  }

  const vonDate = `${von}-01`
  const bisDate = monthEnd(bis)
  const perioden = generatePerioden(von, bis, granularitaet)

  // ── 1. Report-Positionen laden ────────────────────────────────────────────

  const { data: rpRows, error: rpErr } = await supabase
    .from('report_positionen')
    .select('id, name, type, sort_order, investitionsbezogen')
    .eq('user_id', user!.id)
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
      .select('id, name, type, level, parent_id, sort_order, sales_plattform_enabled, produkt_enabled, ist_abzugsposten, exclude_from_rentabilitaet')
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
    supabase
      .from('umsatz_transaktionen')
      .select('leistungsdatum, betrag, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id')
      .gte('leistungsdatum', vonDate)
      .lte('leistungsdatum', bisDate),
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id')
      .not('leistungsdatum', 'is', null)
      .is('abschreibung', null)
      .in('relevanz', ['rentabilitaet', 'beides'])
      .gte('leistungsdatum', vonDate)
      .lte('leistungsdatum', bisDate),
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id, abschreibung')
      .not('abschreibung', 'is', null)
      .not('leistungsdatum', 'is', null),
    supabase
      .from('bestand_transaktionen')
      .select('datum, produkt_id, warenverluste, sendungen_manuell, bestand_sendungen(menge, plattform_id)')
      .gte('datum', vonDate)
      .lte('datum', bisDate)
      .not('produkt_id', 'is', null),
    supabase
      .from('produktkosten_zeitraeume')
      .select('produkt_id, gueltig_von, gueltig_bis, produktkosten_werte(kategorie_id, wert)')
      .lte('gueltig_von', bisDate)
      .or(`gueltig_bis.is.null,gueltig_bis.gte.${vonDate}`),
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
  // Sequenziell nach Stage 3: produktinvestitionenCatId kommt aus allCats.
  // Ohne Datumsfilter geladen — Raten können außerhalb des Buchungsmonats fallen.

  const produktinvestitionenCatId = (allCats ?? []).find(
    c => c.type === 'ausgaben_kosten' && c.level === 1 && c.name?.toLowerCase() === 'produktinvestitionen'
  )?.id ?? null

  let piRows: Array<{
    leistungsdatum: string
    betrag_netto: number | string
    kategorie_id: string
    gruppe_id: string | null
    untergruppe_id: string | null
    produkt_id: string | null
  }> = []

  if (produktinvestitionenCatId && assignedCatIds.has(produktinvestitionenCatId)) {
    const { data: piData, error: piErr2 } = await supabase
      .from('ausgaben_kosten_transaktionen')
      .select('leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id, produkt_id')
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

  const excludedFromRentabilitaet = new Set<string>(
    (allCats ?? []).filter(c => c.exclude_from_rentabilitaet).map(c => c.id)
  )

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
  // Plattform totals: key = "${katId/grpId/ugrId}:${pltId}"
  const pltVals: EntityMap = new Map()
  // Produkt-within-Plattform totals: key = "${katId/grpId/ugrId}:${pltId}:${prdId}"
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
    if (
      (katId && excludedFromRentabilitaet.has(katId)) ||
      (grpId && excludedFromRentabilitaet.has(grpId)) ||
      (ugrId && excludedFromRentabilitaet.has(ugrId))
    ) return
    const period = dateToPeriod(date, granularitaet)
    if (katId) addTo(catVals, katId, period, amount)
    if (grpId) addTo(grpVals, grpId, period, amount)
    if (ugrId) addTo(ugrVals, ugrId, period, amount)
    // Accumulate platform/product breakdown at every KPI level independently
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

  // ── 5b. Bestandsberechnung: Sendungen × Stückkosten je Kostenkategorie ───────

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

  // ── 5c. Wertverlust-Berechnung: warenverluste × Σ(produktkosten_werte.wert) ──
  // WV-Kategorie kann Ebene 1 (direkt zugewiesen) ODER Ebene 2 (Kind-Kategorie) sein.

  const wvKat = (allCats ?? []).find(
    c => c.type === 'ausgaben_kosten' && c.name?.toLowerCase() === 'wertverlust ware'
  )
  // wvGrpId: ID der WV-Kategorie selbst (für den Drill-Down in buildGruppe/buildKategorie)
  const wvGrpId = wvKat?.id ?? null
  // wvTopCatId: Ebene-1-Kategorie, die in assignedCatIds geprüft wird und catVals bekommt
  const wvTopCatId = wvKat
    ? (wvKat.level === 1 ? wvKat.id : (wvKat.parent_id ?? null))
    : null

  // produkt_id → period → betrag (für produkte_wertverlust Drill-Down)
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
      const period = dateToPeriod(row.datum, granularitaet)
      addTo(catVals, wvTopCatId, period, -cost)
      // Bei Ebene-2-Kategorie auch auf Gruppen-Ebene akkumulieren
      if (wvGrpId !== wvTopCatId) addTo(grpVals, wvGrpId, period, -cost)
      addTo(wvPrdVals, row.produkt_id, period, -cost)
    }
  }

  // ── 5d. Manuelle-Sendungen-Berechnung: sendungen_manuell × Σ(produktkosten_werte.wert) ──

  const msKat = (allCats ?? []).find(
    c => c.type === 'ausgaben_kosten' && c.name?.toLowerCase() === 'ersatzteile / kulanz'
  )
  const msGrpId = msKat?.id ?? null
  const msTopCatId = msKat
    ? (msKat.level === 1 ? msKat.id : (msKat.parent_id ?? null))
    : null

  const msPrdVals: EntityMap = new Map()
  const piGrpPrdVals: EntityMap = new Map()
  const piUgrPrdVals: EntityMap = new Map()

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
      const period = dateToPeriod(row.datum, granularitaet)
      addTo(catVals, msTopCatId, period, -cost)
      if (msGrpId !== msTopCatId) addTo(grpVals, msGrpId, period, -cost)
      addTo(msPrdVals, row.produkt_id, period, -cost)
    }
  }

  // ── 5e. Produktinvestitionen-Raten (12 Monate fix, analog PROJ-15) ────────

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
      const rate = -(i === PI_MONATE - 1 ? lastRate : baseRate)
      processTransaction(
        row.kategorie_id, row.gruppe_id, row.untergruppe_id,
        null, null, rateDatum, rate,
      )
      if (row.gruppe_id && row.produkt_id) {
        const p = dateToPeriod(rateDatum, granularitaet)
        addTo(piGrpPrdVals, `${row.gruppe_id}:${row.produkt_id}`, p, rate)
        if (row.untergruppe_id) {
          addTo(piUgrPrdVals, `${row.untergruppe_id}:${row.produkt_id}`, p, rate)
        }
      }
    }
  }

  // ── 5f. Umsatzsteuer-Berechnung: Netto-Basis je Produkt × USt-Satz ──────────

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
      // Nettoumsatz × USt-Satz / 100
      const ust = roundTo2(netBase * ustSatz / 100)
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

  // Plattformen mit verschachtelten Produkten für einen KPI-Knoten aufbauen
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
    const piUgrPrefix = `${ugrId}:`
    const piUgrPrdKeys = [...piUgrPrdVals.keys()].filter(k => k.startsWith(piUgrPrefix))
    const produktePi = piUgrPrdKeys.length > 0
      ? piUgrPrdKeys
          .map(k => {
            const prdId = k.slice(piUgrPrefix.length)
            const prd = produktById.get(prdId)
            if (!prd) return null
            return { id: prdId, name: prd.name, values: getValues(piUgrPrdVals, k, perioden) }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : undefined
    return {
      id: ugrId,
      name: ugr.name,
      values: getValues(ugrVals, ugrId, perioden),
      sales_plattformen: spEnabled ? buildPlattformen(ugrId) : [],
      ...(produktePi !== undefined ? { produkte_pi: produktePi } : {}),
    }
  }

  function buildGruppe(grpId: string, spEnabled: boolean, isProduktGruppe = false) {
    const grp = catById.get(grpId)
    if (!grp) return null
    const untergruppen = (catChildren.get(grpId) ?? [])
      .filter(id => catById.get(id)?.level === 3)
      .filter(id => !excludedFromRentabilitaet.has(id))
      .map(id => buildUntergruppe(id, spEnabled))
      .filter(Boolean)
    const hasPlt = isProduktGruppe && [...pltVals.keys()].some(k => k.startsWith(`${grpId}:`))

    // WV auf Ebene 2: Produkte als Drill-Down dieser Gruppe
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

    // MS auf Ebene 2: Produkte als Drill-Down dieser Gruppe
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

    // PI auf Ebene 2: Produkte als Drill-Down dieser Gruppe
    const piGrpPrefix = `${grpId}:`
    const piPrdKeys = [...piGrpPrdVals.keys()].filter(k => k.startsWith(piGrpPrefix))
    const produktePi = piPrdKeys.length > 0
      ? piPrdKeys
          .map(k => {
            const prdId = k.slice(piGrpPrefix.length)
            const prd = produktById.get(prdId)
            if (!prd) return null
            return { id: prdId, name: prd.name, values: getValues(piGrpPrdVals, k, perioden) }
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
      ...(produktePi !== undefined ? { produkte_pi: produktePi } : {}),
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
      .filter(id => !excludedFromRentabilitaet.has(id))
      .map(id => buildGruppe(id, spEnabled, isProduktKat))
      .filter(Boolean)

    // WV auf Ebene 1: Produkte als Drill-Down dieser Kategorie
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

    // MS auf Ebene 1: Produkte als Drill-Down dieser Kategorie
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
