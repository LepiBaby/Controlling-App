import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

// ─── Schema ───────────────────────────────────────────────────────────────────

const querySchema = z.object({
  von: z.string().regex(/^\d{4}-\d{2}$/, 'von muss im Format YYYY-MM sein'),
  bis: z.string().regex(/^\d{4}-\d{2}$/, 'bis muss im Format YYYY-MM sein'),
  granularitaet: z.enum(['woche', 'monat', 'quartal', 'jahr']).default('monat'),
})

type Granularitaet = 'woche' | 'monat' | 'quartal' | 'jahr'

// ─── Perioden-Utilities ───────────────────────────────────────────────────────

function monthEnd(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number)
  return `${yyyyMM}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // move to Thursday of the week
  const year = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${year}-KW${String(weekNo).padStart(2, '0')}`
}

function dateToPeriod(date: string, gran: Granularitaet): string {
  if (gran === 'woche') return isoWeekKey(date)
  const [year, month] = date.split('-')
  if (gran === 'monat') return `${year}-${month}`
  if (gran === 'quartal') return `${year}-Q${Math.ceil(parseInt(month, 10) / 3)}`
  return year
}

function generatePerioden(von: string, bis: string, gran: Granularitaet): string[] {
  const perioden: string[] = []
  const seen = new Set<string>()

  if (gran === 'woche') {
    const [vonY, vonM] = von.split('-').map(Number)
    const [bisY, bisM] = bis.split('-').map(Number)
    const lastDay = new Date(bisY, bisM, 0).getDate()
    const current = new Date(Date.UTC(vonY, vonM - 1, 1))
    const end = new Date(Date.UTC(bisY, bisM - 1, lastDay))
    // Start from Monday of the week containing the first day
    const dow = current.getUTCDay() || 7
    current.setUTCDate(current.getUTCDate() - (dow - 1))
    while (current <= end) {
      const key = isoWeekKey(current.toISOString().slice(0, 10))
      if (!seen.has(key)) { seen.add(key); perioden.push(key) }
      current.setUTCDate(current.getUTCDate() + 7)
    }
    return perioden
  }

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

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Akkumulator ─────────────────────────────────────────────────────────────

type PeriodMap = Map<string, number>
type EntityMap = Map<string, PeriodMap>

function addTo(map: EntityMap, id: string, period: string, amount: number) {
  if (!map.has(id)) map.set(id, new Map())
  const pm = map.get(id)!
  pm.set(period, roundTo2((pm.get(period) ?? 0) + amount))
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

  function getValues(map: EntityMap, id: string): Record<string, number> {
    const pm = map.get(id)
    return Object.fromEntries(perioden.map(p => [p, roundTo2(pm?.get(p) ?? 0)]))
  }

  // ── 1. Alle Daten parallel laden ──────────────────────────────────────────

  const [
    { data: allEinnahmenCats, error: einKatErr },
    { data: allAusgabenCats,  error: ausKatErr },
    { data: plattformenCats,  error: pltErr    },
    { data: produkteCats,     error: prdErr    },
    { data: einnahmenRows,    error: einErr    },
    { data: ausgabenRows,     error: ausErr    },
    { data: preEinnahmen,     error: preEinErr },
    { data: preAusgaben,      error: preAusErr },
  ] = await Promise.all([
    supabase
      .from('kpi_categories')
      .select('id, name, level, parent_id, sort_order, sales_plattform_enabled')
      .eq('type', 'einnahmen')
      .order('sort_order', { ascending: true }),
    supabase
      .from('kpi_categories')
      .select('id, name, ausgaben_label, level, parent_id, sort_order, sales_plattform_enabled')
      .eq('type', 'ausgaben_kosten')
      .order('sort_order', { ascending: true }),
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
      .from('einnahmen_transaktionen')
      .select('zahlungsdatum, betrag, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id')
      .gte('zahlungsdatum', vonDate)
      .lte('zahlungsdatum', bisDate),
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('zahlungsdatum, betrag_brutto, kategorie_id, gruppe_id, untergruppe_id, sales_plattform_id, produkt_id')
      .not('zahlungsdatum', 'is', null)
      .in('relevanz', ['liquiditaet', 'beides'])
      .gte('zahlungsdatum', vonDate)
      .lte('zahlungsdatum', bisDate),
    // Alle Einnahmen vor dem Zeitraum für Anfangsbestand
    supabase
      .from('einnahmen_transaktionen')
      .select('betrag')
      .lt('zahlungsdatum', vonDate),
    // Alle Ausgaben vor dem Zeitraum für Anfangsbestand
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('betrag_brutto')
      .not('zahlungsdatum', 'is', null)
      .in('relevanz', ['liquiditaet', 'beides'])
      .lt('zahlungsdatum', vonDate),
  ])

  if (einKatErr) return NextResponse.json({ error: einKatErr.message }, { status: 500 })
  if (ausKatErr) return NextResponse.json({ error: ausKatErr.message }, { status: 500 })
  if (pltErr)    return NextResponse.json({ error: pltErr.message    }, { status: 500 })
  if (prdErr)    return NextResponse.json({ error: prdErr.message    }, { status: 500 })
  if (einErr)    return NextResponse.json({ error: einErr.message    }, { status: 500 })
  if (ausErr)    return NextResponse.json({ error: ausErr.message    }, { status: 500 })
  if (preEinErr) return NextResponse.json({ error: preEinErr.message }, { status: 500 })
  if (preAusErr) return NextResponse.json({ error: preAusErr.message }, { status: 500 })

  const anfangsbestand = roundTo2(
    (preEinnahmen ?? []).reduce((s, r) => s + Number(r.betrag), 0) +
    (preAusgaben  ?? []).reduce((s, r) => s - Number(r.betrag_brutto), 0)
  )

  // ── 2. Lookup-Maps & Kinder-Maps aufbauen ─────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const einCatById = new Map<string, any>((allEinnahmenCats ?? []).map(c => [c.id, c]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ausCatById = new Map<string, any>((allAusgabenCats ?? []).map(c => [c.id, c]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plattformById = new Map<string, any>((plattformenCats ?? []).map(c => [c.id, c]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const produktById = new Map<string, any>((produkteCats ?? []).map(c => [c.id, c]))

  const einChildren = new Map<string, string[]>()
  const ausChildren = new Map<string, string[]>()
  for (const c of [...(allEinnahmenCats ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    if (c.parent_id) {
      if (!einChildren.has(c.parent_id)) einChildren.set(c.parent_id, [])
      einChildren.get(c.parent_id)!.push(c.id)
    }
  }
  for (const c of [...(allAusgabenCats ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    if (c.parent_id) {
      if (!ausChildren.has(c.parent_id)) ausChildren.set(c.parent_id, [])
      ausChildren.get(c.parent_id)!.push(c.id)
    }
  }

  // ── 3. Transaktionen akkumulieren ─────────────────────────────────────────

  const catVals: EntityMap = new Map()
  const grpVals: EntityMap = new Map()
  const ugrVals: EntityMap = new Map()
  const pltVals: EntityMap = new Map()        // key: `${levelId}:${pltId}`
  const pltPrdVals: EntityMap = new Map()     // key: `${levelId}:${pltId}:${prdId}`
  const directPrdVals: EntityMap = new Map()  // key: `${levelId}:${prdId}` (kein pltId)

  function accumulate(
    katId: string | null, grpId: string | null, ugrId: string | null,
    pltId: string | null, prdId: string | null,
    period: string, amount: number,
  ) {
    if (katId) addTo(catVals, katId, period, amount)
    if (grpId) addTo(grpVals, grpId, period, amount)
    if (ugrId) addTo(ugrVals, ugrId, period, amount)
    for (const levelId of [katId, grpId, ugrId]) {
      if (!levelId) continue
      if (pltId) {
        addTo(pltVals, `${levelId}:${pltId}`, period, amount)
        if (prdId) addTo(pltPrdVals, `${levelId}:${pltId}:${prdId}`, period, amount)
      } else if (prdId) {
        // Direktes Produkt ohne Plattform (z.B. Produktinvestitionen)
        addTo(directPrdVals, `${levelId}:${prdId}`, period, amount)
      }
    }
  }

  for (const row of einnahmenRows ?? []) {
    if (!row.zahlungsdatum || !row.kategorie_id) continue
    const period = dateToPeriod(row.zahlungsdatum, granularitaet)
    accumulate(
      row.kategorie_id, row.gruppe_id ?? null, row.untergruppe_id ?? null,
      row.sales_plattform_id ?? null, row.produkt_id ?? null,
      period, Number(row.betrag),
    )
  }

  for (const row of ausgabenRows ?? []) {
    if (!row.zahlungsdatum || !row.kategorie_id) continue
    const period = dateToPeriod(row.zahlungsdatum, granularitaet)
    accumulate(
      row.kategorie_id, row.gruppe_id ?? null, row.untergruppe_id ?? null,
      row.sales_plattform_id ?? null, row.produkt_id ?? null,
      period, -Number(row.betrag_brutto),
    )
  }

  // ── 4. Hierarchie aufbauen ────────────────────────────────────────────────

  type Blatt = { id: string; name: string; values: Record<string, number> }

  function buildPlattformen(parentId: string) {
    const prefix = `${parentId}:`
    const results: Array<{ id: string; name: string; values: Record<string, number>; produkte: Blatt[] }> = []
    const seenPlt = new Set<string>()

    for (const key of pltVals.keys()) {
      if (!key.startsWith(prefix)) continue
      const pltId = key.slice(prefix.length)
      if (seenPlt.has(pltId)) continue
      seenPlt.add(pltId)
      const plt = plattformById.get(pltId)
      if (!plt) continue

      const prdPrefix = `${parentId}:${pltId}:`
      const produkte: Blatt[] = []
      const seenPrd = new Set<string>()
      for (const prdKey of pltPrdVals.keys()) {
        if (!prdKey.startsWith(prdPrefix)) continue
        const prdId = prdKey.slice(prdPrefix.length)
        if (seenPrd.has(prdId)) continue
        seenPrd.add(prdId)
        const prd = produktById.get(prdId)
        if (!prd) continue
        produkte.push({ id: prdId, name: prd.name, values: getValues(pltPrdVals, prdKey) })
      }

      results.push({ id: pltId, name: plt.name, values: getValues(pltVals, key), produkte })
    }
    return results
  }

  // Direkte Produkte (ohne Plattform) für einen übergeordneten Knoten
  function buildDirectProdukte(parentId: string): Blatt[] {
    const prefix = `${parentId}:`
    const results: Blatt[] = []
    const seenPrd = new Set<string>()
    for (const key of directPrdVals.keys()) {
      if (!key.startsWith(prefix)) continue
      const prdId = key.slice(prefix.length)
      if (seenPrd.has(prdId)) continue
      seenPrd.add(prdId)
      const prd = produktById.get(prdId)
      if (!prd) continue
      results.push({ id: prdId, name: prd.name, values: getValues(directPrdVals, key) })
    }
    return results
  }

  function buildUntergruppe(ugrId: string, isAusgaben: boolean, spEnabled: boolean) {
    const cat = (isAusgaben ? ausCatById : einCatById).get(ugrId)
    if (!cat) return null
    const name = isAusgaben ? (cat.ausgaben_label ?? cat.name) : cat.name
    const sales_plattformen = spEnabled ? buildPlattformen(ugrId) : []
    const produkte = sales_plattformen.length === 0 ? buildDirectProdukte(ugrId) : []
    return {
      id: ugrId,
      name,
      values: getValues(ugrVals, ugrId),
      sales_plattformen,
      produkte,
    }
  }

  function buildGruppe(grpId: string, isAusgaben: boolean, spEnabled: boolean) {
    const catByIdMap = isAusgaben ? ausCatById : einCatById
    const childrenMap = isAusgaben ? ausChildren : einChildren
    const cat = catByIdMap.get(grpId)
    if (!cat) return null
    const name = isAusgaben ? (cat.ausgaben_label ?? cat.name) : cat.name
    const untergruppen = (childrenMap.get(grpId) ?? [])
      .filter(id => catByIdMap.get(id)?.level === 3)
      .map(id => buildUntergruppe(id, isAusgaben, spEnabled))
      .filter((x): x is NonNullable<typeof x> => x !== null)
    let sales_plattformen: ReturnType<typeof buildPlattformen> = []
    let produkte: Blatt[] = []
    if (untergruppen.length === 0) {
      sales_plattformen = spEnabled ? buildPlattformen(grpId) : []
      if (sales_plattformen.length === 0) produkte = buildDirectProdukte(grpId)
    }
    return {
      id: grpId,
      name,
      values: getValues(grpVals, grpId),
      untergruppen,
      sales_plattformen,
      produkte,
    }
  }

  function buildKategorie(katId: string, isAusgaben: boolean) {
    const catByIdMap = isAusgaben ? ausCatById : einCatById
    const childrenMap = isAusgaben ? ausChildren : einChildren
    const cat = catByIdMap.get(katId)
    if (!cat) return null
    const name = isAusgaben ? (cat.ausgaben_label ?? cat.name) : cat.name
    const spEnabled = !!cat.sales_plattform_enabled
    const gruppen = (childrenMap.get(katId) ?? [])
      .filter(id => catByIdMap.get(id)?.level === 2)
      .map(id => buildGruppe(id, isAusgaben, spEnabled))
      .filter((x): x is NonNullable<typeof x> => x !== null)
    let sales_plattformen: ReturnType<typeof buildPlattformen> = []
    let produkte: Blatt[] = []
    if (gruppen.length === 0) {
      sales_plattformen = spEnabled ? buildPlattformen(katId) : []
      if (sales_plattformen.length === 0) produkte = buildDirectProdukte(katId)
    }
    return {
      id: katId,
      name,
      kpi_type: isAusgaben ? 'ausgaben_kosten' as const : 'einnahmen' as const,
      values: getValues(catVals, katId),
      gruppen,
      sales_plattformen,
      produkte,
    }
  }

  const einnahmenLevel1 = (allEinnahmenCats ?? []).filter(c => c.level === 1)
  const ausgabenLevel1  = (allAusgabenCats ?? []).filter(c => c.level === 1)

  const einnahmenKategorien = einnahmenLevel1
    .map(kat => buildKategorie(kat.id, false))
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const ausgabenKategorien = ausgabenLevel1
    .map(kat => buildKategorie(kat.id, true))
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // ── 5. Gesamt + Cashflow + Kontostand ─────────────────────────────────────

  const gesamt_einnahmen: Record<string, number> = {}
  const gesamt_ausgaben:  Record<string, number> = {}
  const cashflow:         Record<string, number> = {}
  const kontostand:       Record<string, number> = {}

  let kumuliert = anfangsbestand
  for (const p of perioden) {
    const einnahmen = roundTo2(einnahmenKategorien.reduce((s, k) => s + (k.values[p] ?? 0), 0))
    const ausgaben  = roundTo2(ausgabenKategorien.reduce((s, k)  => s + (k.values[p] ?? 0), 0))
    const cf = roundTo2(einnahmen + ausgaben)
    kumuliert = roundTo2(kumuliert + cf)
    gesamt_einnahmen[p] = einnahmen
    gesamt_ausgaben[p]  = ausgaben
    cashflow[p]         = cf
    kontostand[p]       = kumuliert
  }

  return NextResponse.json({
    perioden,
    einnahmen_kategorien: einnahmenKategorien,
    ausgaben_kategorien:  ausgabenKategorien,
    gesamt_einnahmen,
    gesamt_ausgaben,
    cashflow,
    kontostand,
  })
}
