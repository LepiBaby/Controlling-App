import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { roundTo2 } from '@/lib/abschreibung-utils'

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
  const { supabase, error } = await requireAuth()
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

  // ── 1. Parallel laden ─────────────────────────────────────────────────────

  const [
    { data: umsatzCats,   error: ucErr },
    { data: ausgabenCats, error: acErr },
    { data: produkteCats, error: pcErr },
    { data: umsatzRows,   error: uErr  },
    { data: vsRows,       error: vsErr },
  ] = await Promise.all([
    supabase
      .from('kpi_categories')
      .select('id, name, level, parent_id, sort_order, ist_abzugsposten')
      .eq('type', 'umsatz')
      .order('sort_order', { ascending: true }),
    supabase
      .from('kpi_categories')
      .select('id, name, level, parent_id, sort_order')
      .eq('type', 'ausgaben_kosten')
      .order('sort_order', { ascending: true }),
    supabase
      .from('kpi_categories')
      .select('id, name, ust_satz')
      .eq('type', 'produkte')
      .eq('level', 1),
    supabase
      .from('umsatz_transaktionen')
      .select('leistungsdatum, betrag, kategorie_id, gruppe_id, untergruppe_id, produkt_id')
      .gte('leistungsdatum', vonDate)
      .lte('leistungsdatum', bisDate),
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('leistungsdatum, ust_betrag, kategorie_id, gruppe_id, untergruppe_id')
      .gt('ust_betrag', 0)
      .not('leistungsdatum', 'is', null)
      .gte('leistungsdatum', vonDate)
      .lte('leistungsdatum', bisDate),
  ])

  if (ucErr) return NextResponse.json({ error: ucErr.message }, { status: 500 })
  if (acErr) return NextResponse.json({ error: acErr.message }, { status: 500 })
  if (pcErr) return NextResponse.json({ error: pcErr.message }, { status: 500 })
  if (uErr)  return NextResponse.json({ error: uErr.message  }, { status: 500 })
  if (vsErr) return NextResponse.json({ error: vsErr.message }, { status: 500 })

  // ── 2. Lookup-Maps ────────────────────────────────────────────────────────

  const umsatzCatById  = new Map((umsatzCats  ?? []).map(c => [c.id, c]))
  const ausgabenCatById = new Map((ausgabenCats ?? []).map(c => [c.id, c]))
  const produktById    = new Map((produkteCats ?? []).map(c => [c.id, c]))

  function buildChildren(
    cats: Array<{ id: string; parent_id: string | null; sort_order: number | null }>,
  ) {
    const map = new Map<string, string[]>()
    for (const c of [...cats].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
      if (c.parent_id) {
        if (!map.has(c.parent_id)) map.set(c.parent_id, [])
        map.get(c.parent_id)!.push(c.id)
      }
    }
    return map
  }

  const umsatzChildren   = buildChildren(umsatzCats  ?? [])
  const ausgabenChildren = buildChildren(ausgabenCats ?? [])

  // ── 3. Umsatzsteuer akkumulieren ──────────────────────────────────────────

  // key patterns: plain catId/grpId/ugrId; "${ugrId}:${prdId}", "${grpId}:${prdId}", "${catId}:${prdId}"
  const ustCatVals:  EntityMap = new Map()
  const ustGrpVals:  EntityMap = new Map()
  const ustUgrVals:  EntityMap = new Map()
  const ustPrdInUgr: EntityMap = new Map()  // produkt unter untergruppe
  const ustPrdInGrp: EntityMap = new Map()  // produkt unter gruppe (kein ugr)
  const ustPrdInCat: EntityMap = new Map()  // produkt unter kategorie (kein grp)

  for (const row of umsatzRows ?? []) {
    if (!row.leistungsdatum || !row.kategorie_id || !row.produkt_id) continue
    const prd = produktById.get(row.produkt_id)
    if (!prd || prd.ust_satz == null || Number(prd.ust_satz) <= 0) continue

    const isAbzug = !!umsatzCatById.get(row.kategorie_id)?.ist_abzugsposten
    const betrag  = isAbzug ? -Number(row.betrag) : Number(row.betrag)
    const period  = dateToPeriod(row.leistungsdatum, granularitaet)
    const ustSatz = Number(prd.ust_satz)
    // Brutto → USt herausrechnen: USt = Brutto × ust_satz / (100 + ust_satz)
    const ust = roundTo2(betrag * ustSatz / (100 + ustSatz))

    addTo(ustCatVals, row.kategorie_id, period, ust)
    if (row.gruppe_id)     addTo(ustGrpVals, row.gruppe_id, period, ust)
    if (row.untergruppe_id) addTo(ustUgrVals, row.untergruppe_id, period, ust)

    if (row.untergruppe_id) {
      addTo(ustPrdInUgr, `${row.untergruppe_id}:${row.produkt_id}`, period, ust)
    } else if (row.gruppe_id) {
      addTo(ustPrdInGrp, `${row.gruppe_id}:${row.produkt_id}`, period, ust)
    } else {
      addTo(ustPrdInCat, `${row.kategorie_id}:${row.produkt_id}`, period, ust)
    }
  }

  // ── 4. Vorsteuer akkumulieren ─────────────────────────────────────────────

  const vsCatVals: EntityMap = new Map()
  const vsGrpVals: EntityMap = new Map()
  const vsUgrVals: EntityMap = new Map()

  for (const row of vsRows ?? []) {
    if (!row.leistungsdatum || !row.kategorie_id || !row.ust_betrag) continue
    const period = dateToPeriod(row.leistungsdatum, granularitaet)
    const betrag = Number(row.ust_betrag)
    addTo(vsCatVals, row.kategorie_id, period, betrag)
    if (row.gruppe_id)      addTo(vsGrpVals, row.gruppe_id, period, betrag)
    if (row.untergruppe_id) addTo(vsUgrVals, row.untergruppe_id, period, betrag)
  }

  // ── 5. Response aufbauen ──────────────────────────────────────────────────

  function collectPrdInMap(parentKey: string, prdMap: EntityMap) {
    const prefix = `${parentKey}:`
    const seen   = new Set<string>()
    const result: { id: string; name: string; ust_satz: number; values: Record<string, number> }[] = []
    for (const key of prdMap.keys()) {
      if (!key.startsWith(prefix)) continue
      const prdId = key.slice(prefix.length)
      if (seen.has(prdId)) continue
      seen.add(prdId)
      const prd = produktById.get(prdId)
      if (!prd) continue
      result.push({ id: prdId, name: prd.name, ust_satz: Number(prd.ust_satz), values: getValues(prdMap, key, perioden) })
    }
    return result
  }

  function buildUstUntergruppe(ugrId: string) {
    const ugr = umsatzCatById.get(ugrId)
    if (!ugr) return null
    return {
      id: ugrId,
      name: ugr.name,
      values: getValues(ustUgrVals, ugrId, perioden),
      produkte: collectPrdInMap(ugrId, ustPrdInUgr),
    }
  }

  function buildUstGruppe(grpId: string) {
    const grp = umsatzCatById.get(grpId)
    if (!grp) return null
    const untergruppen = (umsatzChildren.get(grpId) ?? [])
      .filter(id => umsatzCatById.get(id)?.level === 3)
      .map(buildUstUntergruppe)
      .filter((x): x is NonNullable<typeof x> => x !== null)
    return {
      id: grpId,
      name: grp.name,
      values: getValues(ustGrpVals, grpId, perioden),
      untergruppen,
      produkte: untergruppen.length === 0 ? collectPrdInMap(grpId, ustPrdInGrp) : [],
    }
  }

  function buildUstKategorie(katId: string) {
    const kat = umsatzCatById.get(katId)
    if (!kat) return null
    const gruppen = (umsatzChildren.get(katId) ?? [])
      .filter(id => umsatzCatById.get(id)?.level === 2)
      .map(buildUstGruppe)
      .filter((x): x is NonNullable<typeof x> => x !== null)
    return {
      id: katId,
      name: kat.name,
      values: getValues(ustCatVals, katId, perioden),
      gruppen,
      produkte: gruppen.length === 0 ? collectPrdInMap(katId, ustPrdInCat) : [],
    }
  }

  function buildVsUntergruppe(ugrId: string) {
    const ugr = ausgabenCatById.get(ugrId)
    if (!ugr) return null
    return { id: ugrId, name: ugr.name, values: getValues(vsUgrVals, ugrId, perioden) }
  }

  function buildVsGruppe(grpId: string) {
    const grp = ausgabenCatById.get(grpId)
    if (!grp) return null
    const untergruppen = (ausgabenChildren.get(grpId) ?? [])
      .filter(id => ausgabenCatById.get(id)?.level === 3)
      .map(buildVsUntergruppe)
      .filter((x): x is NonNullable<typeof x> => x !== null)
    return { id: grpId, name: grp.name, values: getValues(vsGrpVals, grpId, perioden), untergruppen }
  }

  function buildVsKategorie(katId: string) {
    const kat = ausgabenCatById.get(katId)
    if (!kat) return null
    const gruppen = (ausgabenChildren.get(katId) ?? [])
      .filter(id => ausgabenCatById.get(id)?.level === 2)
      .map(buildVsGruppe)
      .filter((x): x is NonNullable<typeof x> => x !== null)
    return { id: katId, name: kat.name, values: getValues(vsCatVals, katId, perioden), gruppen }
  }

  const ustKategorien = (umsatzCats ?? [])
    .filter(c => c.level === 1)
    .map(c => buildUstKategorie(c.id))
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const vsKategorien = (ausgabenCats ?? [])
    .filter(c => c.level === 1)
    .map(c => buildVsKategorie(c.id))
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // Gesamtsummen
  const ustSumme = zeroValues(perioden)
  for (const kat of ustKategorien) {
    for (const p of perioden) ustSumme[p] = roundTo2(ustSumme[p] + (kat.values[p] ?? 0))
  }

  const vsSumme = zeroValues(perioden)
  for (const kat of vsKategorien) {
    for (const p of perioden) vsSumme[p] = roundTo2(vsSumme[p] + (kat.values[p] ?? 0))
  }

  const faelligeUst: Record<string, number> = {}
  for (const p of perioden) faelligeUst[p] = roundTo2(ustSumme[p] - vsSumme[p])

  return NextResponse.json({
    perioden,
    abzufuehrendeUst:   { kategorien: ustKategorien, summe: ustSumme },
    abziehbareVorsteuer: { kategorien: vsKategorien,  summe: vsSumme  },
    faelligeUst,
  })
}
