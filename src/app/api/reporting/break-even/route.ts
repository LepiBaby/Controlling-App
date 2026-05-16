import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { roundTo2 } from '@/lib/abschreibung-utils'

// ─── Schema ───────────────────────────────────────────────────────────────────

const querySchema = z.object({
  produkt_ids: z.string().min(1, 'produkt_ids ist erforderlich'),
  granularitaet: z.enum(['monat', 'quartal', 'jahr']).default('monat'),
})

type Granularitaet = 'monat' | 'quartal' | 'jahr'

// ─── Perioden-Utilities ───────────────────────────────────────────────────────

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
    produkt_ids: searchParams.get('produkt_ids') ?? '',
    granularitaet: searchParams.get('granularitaet') ?? 'monat',
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { granularitaet } = parsed.data
  const produktIds = parsed.data.produkt_ids.split(',').filter(Boolean)
  if (produktIds.length === 0) {
    return NextResponse.json({ error: 'Mindestens ein Produkt muss ausgewählt sein' }, { status: 400 })
  }

  // ── 1. Report-Positionen laden (nur in_break_even_report = true) ──────────

  const { data: rpRows, error: rpErr } = await supabase
    .from('report_positionen')
    .select('id, name, type, sort_order, investitionsbezogen')
    .eq('user_id', user!.id)
    .eq('in_break_even_report', true)
    .order('sort_order', { ascending: true })

  if (rpErr) return NextResponse.json({ error: rpErr.message }, { status: 500 })
  if (!rpRows || rpRows.length === 0) {
    return NextResponse.json({ perioden: [], positionen: [] })
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

  // ── 3. KPI-Kategorien + Transaktionen parallel laden ─────────────────────
  // Kein Datumsfilter — Zeitraum wird aus den Transaktionen ermittelt.
  // Nur Direktbuchungen mit produkt_id: keine Abschreibungen,
  // keine Bestandsberechnung, kein Wertverlust, keine manuellen Sendungen.

  const [
    { data: allCats,         error: catsErr },
    { data: plattformenCats, error: pltErr  },
    { data: produkteCats,    error: prdErr  },
    { data: umsatzRows,      error: uErr    },
    { data: ausgabenRows,    error: aErr    },
  ] = await Promise.all([
    supabase
      .from('kpi_categories')
      .select('id, name, type, level, parent_id, sort_order, sales_plattform_enabled, ist_abzugsposten')
      .in('type', ['umsatz', 'ausgaben_kosten']),
    supabase
      .from('kpi_categories')
      .select('id, name')
      .eq('type', 'sales_plattformen'),
    supabase
      .from('kpi_categories')
      .select('id, name')
      .eq('type', 'produkte')
      .eq('level', 1),
    supabase
      .from('umsatz_transaktionen')
      .select('leistungsdatum, betrag, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id')
      .in('produkt_id', produktIds),
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('leistungsdatum, betrag_netto, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id')
      .not('leistungsdatum', 'is', null)
      .is('abschreibung', null)
      .in('produkt_id', produktIds),
  ])

  if (catsErr) return NextResponse.json({ error: catsErr.message }, { status: 500 })
  if (pltErr)  return NextResponse.json({ error: pltErr.message  }, { status: 500 })
  if (prdErr)  return NextResponse.json({ error: prdErr.message  }, { status: 500 })
  if (uErr)    return NextResponse.json({ error: uErr.message    }, { status: 500 })
  if (aErr)    return NextResponse.json({ error: aErr.message    }, { status: 500 })

  // ── 3b. Produktinvestitionen-Transaktionen laden ─────────────────────────
  // Sequenziell nach Stage 3: produktinvestitionenCatId kommt aus allCats.
  // produkt_id-Filter analog zu umsatz/ausgaben: nur Transaktionen der gewählten Produkte.

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
      .in('produkt_id', produktIds)
    if (piErr2) return NextResponse.json({ error: piErr2.message }, { status: 500 })
    piRows = piData ?? []
  }

  // ── 4. Zeitraum aus Transaktionen ermitteln ───────────────────────────────
  // Nur Daten zählen, die tatsächlich in assignedCatIds landen und damit
  // in den Perioden-Werten erscheinen — sonst entstehen leere Randspalten.

  const allMonths: string[] = []
  for (const row of umsatzRows ?? []) {
    if (row.leistungsdatum && row.kategorie_id && assignedCatIds.has(row.kategorie_id))
      allMonths.push(row.leistungsdatum.slice(0, 7))
  }
  for (const row of ausgabenRows ?? []) {
    if (
      row.leistungsdatum && row.kategorie_id &&
      assignedCatIds.has(row.kategorie_id) &&
      row.kategorie_id !== produktinvestitionenCatId
    ) allMonths.push(row.leistungsdatum.slice(0, 7))
  }
  for (const row of piRows) {
    if (row.leistungsdatum) allMonths.push(row.leistungsdatum.slice(0, 7))
  }

  if (allMonths.length === 0) {
    return NextResponse.json({ perioden: [], positionen: [] })
  }

  allMonths.sort()
  const von = allMonths[0]
  const bis = allMonths[allMonths.length - 1]
  const perioden = generatePerioden(von, bis, granularitaet)

  // ── 5. Lookup-Maps aufbauen ───────────────────────────────────────────────

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

  // ── 6. Transaktionen akkumulieren (roh, per Periode) ─────────────────────

  const catVals: EntityMap = new Map()
  const grpVals: EntityMap = new Map()
  const ugrVals: EntityMap = new Map()
  const pltVals: EntityMap = new Map()
  const pltPrdVals: EntityMap = new Map()
  const prdGrpVals: EntityMap = new Map()
  const prdUgrVals: EntityMap = new Map()
  const piGrpPrdVals: EntityMap = new Map()
  const piUgrPrdVals: EntityMap = new Map()

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
    // Produkt ohne Plattform: direkt unter Gruppe/Untergruppe akkumulieren
    if (!pltId && prdId) {
      if (grpId) addTo(prdGrpVals, `${grpId}:${prdId}`, period, amount)
      if (ugrId) addTo(prdUgrVals, `${ugrId}:${prdId}`, period, amount)
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

  for (const row of piRows) {
    if (!row.leistungsdatum || !row.kategorie_id) continue
    const betragNetto = Number(row.betrag_netto ?? 0)
    if (betragNetto === 0) continue
    const amount = -betragNetto
    processTransaction(
      row.kategorie_id, row.gruppe_id, row.untergruppe_id,
      null, null, row.leistungsdatum, amount,
    )
    if (row.gruppe_id && row.produkt_id) {
      const p = dateToPeriod(row.leistungsdatum, granularitaet)
      addTo(piGrpPrdVals, `${row.gruppe_id}:${row.produkt_id}`, p, amount)
      if (row.untergruppe_id) {
        addTo(piUgrPrdVals, `${row.untergruppe_id}:${row.produkt_id}`, p, amount)
      }
    }
  }

  // ── 7. Positions-Werte berechnen ─────────────────────────────────────────

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

  // Summe-Positionen aus Positions-Werten berechnen
  for (const pos of rpRows) {
    if (pos.type !== 'summe') continue
    const vals = zeroValues(perioden)
    for (const refId of summeRefsByPosition.get(pos.id) ?? []) {
      const rv = positionValues.get(refId) ?? zeroValues(perioden)
      for (const p of perioden) vals[p] = roundTo2(vals[p] + (rv[p] ?? 0))
    }
    positionValues.set(pos.id, vals)
  }

  // ── 8. Hierarchischen Response aufbauen ───────────────────────────────────

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

  function collectPrdEntries(prefixMap: EntityMap, prefix: string) {
    const keys = [...prefixMap.keys()].filter(k => k.startsWith(`${prefix}:`))
    if (keys.length === 0) return undefined
    return keys
      .map(k => {
        const prdId = k.slice(prefix.length + 1)
        const prd = produktById.get(prdId)
        if (!prd) return null
        return { id: prdId, name: prd.name, values: getValues(prefixMap, k, perioden) }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }

  function buildUntergruppe(ugrId: string, spEnabled: boolean) {
    const ugr = catById.get(ugrId)
    if (!ugr) return null
    const produktePi  = collectPrdEntries(piUgrPrdVals, ugrId)
    const produkte    = collectPrdEntries(prdUgrVals,   ugrId)
    return {
      id: ugrId,
      name: ugr.name,
      values: getValues(ugrVals, ugrId, perioden),
      sales_plattformen: spEnabled ? buildPlattformen(ugrId) : [],
      ...(produktePi !== undefined ? { produkte_pi: produktePi } : {}),
      ...(produkte   !== undefined ? { produkte }               : {}),
    }
  }

  function buildGruppe(grpId: string, spEnabled: boolean) {
    const grp = catById.get(grpId)
    if (!grp) return null
    const untergruppen = (catChildren.get(grpId) ?? [])
      .filter(id => catById.get(id)?.level === 3)
      .map(id => buildUntergruppe(id, spEnabled))
      .filter(Boolean)
    const produktePi = collectPrdEntries(piGrpPrdVals, grpId)
    const produkte   = collectPrdEntries(prdGrpVals,   grpId)
    return {
      id: grpId,
      name: grp.name,
      values: getValues(grpVals, grpId, perioden),
      untergruppen,
      sales_plattformen: spEnabled && untergruppen.length === 0 ? buildPlattformen(grpId) : [],
      ...(produktePi !== undefined ? { produkte_pi: produktePi } : {}),
      ...(produkte   !== undefined ? { produkte }               : {}),
    }
  }

  function buildKategorie(katId: string) {
    const cat = catById.get(katId)
    if (!cat) return null
    const spEnabled = !!cat.sales_plattform_enabled
    const gruppen = (catChildren.get(katId) ?? [])
      .filter(id => catById.get(id)?.level === 2)
      .map(id => buildGruppe(id, spEnabled))
      .filter(Boolean)
    return {
      id: katId,
      name: cat.name,
      kpi_type: cat.type as 'umsatz' | 'ausgaben_kosten',
      values: getValues(catVals, katId, perioden),
      gruppen,
      sales_plattformen: spEnabled && gruppen.length === 0 ? buildPlattformen(katId) : [],
    }
  }

  const positionen = rpRows.map(pos => ({
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
  }))

  // ── 9. Periodenergebnis + Kumuliertes Ergebnis ───────────────────────────────
  // Periodenergebnis: letzte Summe + alle nachgelagerten Positionen (z.B. Produktinvestitionskosten)
  // Kumuliertes Ergebnis: laufende Summe des Periodenergebnisses über alle Perioden.

  const lastSummeIdx = rpRows.reduce((best, row, i) => row.type === 'summe' ? i : best, -1)
  const lastSumme = lastSummeIdx >= 0 ? rpRows[lastSummeIdx] : null

  if (lastSumme) {
    const bottomLine = zeroValues(perioden)
    const summeVals = positionValues.get(lastSumme.id) ?? zeroValues(perioden)
    for (const p of perioden) bottomLine[p] = roundTo2(bottomLine[p] + (summeVals[p] ?? 0))

    for (let i = lastSummeIdx + 1; i < rpRows.length; i++) {
      if (rpRows[i].type !== 'position') continue
      const pv = positionValues.get(rpRows[i].id) ?? zeroValues(perioden)
      for (const p of perioden) bottomLine[p] = roundTo2(bottomLine[p] + (pv[p] ?? 0))
    }

    const maxSortOrder = rpRows.reduce((max, r) => Math.max(max, r.sort_order ?? 0), 0)

    positionen.push({
      id: 'break-even-periodenergebnis',
      name: 'Periodenergebnis',
      type: 'summe',
      sort_order: maxSortOrder + 1,
      investitionsbezogen: false,
      values: { ...bottomLine },
      kategorien: [],
    })

    const kumuliertVals: Record<string, number> = {}
    let running = 0
    for (const p of perioden) {
      running = roundTo2(running + (bottomLine[p] ?? 0))
      kumuliertVals[p] = running
    }
    positionen.push({
      id: 'break-even-kumuliert',
      name: 'Kumuliertes Ergebnis',
      type: 'summe',
      sort_order: maxSortOrder + 2,
      investitionsbezogen: false,
      values: kumuliertVals,
      kategorien: [],
    })
  }

  return NextResponse.json({ perioden, positionen })
}
