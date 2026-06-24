'use client'

import { useState, useEffect, useMemo } from 'react'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import { istProduktverkaufe } from '@/hooks/use-einnahmenplanung'
import { DEFAULT_PLANUNGSHORIZONT_MONATE } from '@/hooks/use-langfristige-grundeinstellungen'

// PROJ-94: Read-only Liquiditätsauswertung der LANGFRISTIGEN Planung (pro Planversion).
// Klon der kurzfristigen Liquiditätsauswertung (PROJ-72), reduziert auf:
//   • NUR Monate (kein Wochen/Monats-Umschalter), NUR Soll (keine Ist-Spalten).
//   • Zeitfenster = Startmonat … Startmonat + Planungshorizont (allgemein).
//   • Kontostand-Startwert = Startkontostand aus den Grundeinstellungen der Version
//     (kein transaktionsbasierter Anfangsbestand).
//   • Versionsgebundene Datenquellen; Kategorien aus dem KPI-Modell DIESER Version
//     (Produkte/Plattformen/Investitionen) bzw. global (Einnahmen-/Ausgaben-Subtrees).
// Aggregiert die sechs langfristigen Planungsmodule (effektiver Soll = manuell ?? berechnet).

export interface PlanungsMonat {
  year: number
  month: number // 1–12
  label: string
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// Level-1 ausgaben_kosten Wurzeln, die ein EIGENES Modul haben → gehören NICHT zu Umsatzausgaben.
const EIGENE_AUSGABEN_ROOTS = ['operativ', 'finanzierung', 'steuern', 'produktinvestitionen']

function subId(leafId: string, childId: string): string {
  return `${leafId}>${childId}`
}
function leafMonthKey(leafId: string, year: number, month: number): string {
  return `${leafId}|${year}:${month}`
}

function buildMonate(startMonat: number, startJahr: number, horizont: number): PlanungsMonat[] {
  const months: PlanungsMonat[] = []
  let y = startJahr
  let m = startMonat
  for (let i = 0; i < horizont; i++) {
    months.push({ year: y, month: m, label: `${MONTH_LABELS[m - 1]} ${y}` })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return months
}

// ─── Datenspeicher (pro Abschnitt/Block) ──────────────────────────────────────

interface SubLeaf { id: string; name: string }

interface DataStore {
  sign: 1 | -1
  leafIds: Set<string>
  soll: Map<string, number>            // (leaf|composite) | monthKey -> rohe Magnitude (effektiver Soll)
  sollManual: Set<string>              // Schlüssel mit manuellem Override (blau), sonst auto (grau)
  notes: Map<string, string>
  subLeavesByLeaf: Map<string, SubLeaf[]>
}
type ModuleResult = Omit<DataStore, 'sign'>

function emptyModule(): ModuleResult {
  return { leafIds: new Set(), soll: new Map(), sollManual: new Set(), notes: new Map(), subLeavesByLeaf: new Map() }
}

// ─── View-Model ───────────────────────────────────────────────────────────────

export interface AuswertungColumn { key: string; label: string; sublabel?: string }
export type LiqZeitbasis = 'monat' | 'jahr'
export interface AuswertungCell {
  value: number | null
  indicator: 'gray' | 'blue' | null
  hasNote: boolean
  noteText: string | null
}
export type AuswertungRowKind =
  | 'section' | 'kategorie' | 'gruppe' | 'leaf' | 'sub'
  | 'gesamt-einnahmen' | 'gesamt-ausgaben' | 'cashflow' | 'kontostand'

export interface AuswertungRow {
  id: string
  kind: AuswertungRowKind
  label: string
  indent: number
  expandable: boolean
  groupKey?: string
  ancestorGroupKeys: string[]
  cells: Record<string, AuswertungCell>
}

export interface AuswertungViewModel {
  columns: AuswertungColumn[]
  rows: AuswertungRow[]
  expandableKeys: string[]
}

// Verdichtet die Monats-Spalten/-Zeilen auf rollierende 12-Monats-Blöcke ab dem
// Startmonat (KEINE Kalenderjahre). Fluss-Zeilen werden summiert; die kumulierte
// Kontostand-Zeile zeigt den Endbestand (letzter Monat des Blocks). Indikatorpunkte
// und Notizen entfallen in der Jahresansicht. Bei `zeitbasis === 'monat'` unverändert.
export function applyZeitbasisLiq(
  vm: { columns: AuswertungColumn[]; rows: AuswertungRow[]; expandableKeys: string[] },
  zeitbasis: LiqZeitbasis,
): { columns: AuswertungColumn[]; rows: AuswertungRow[]; expandableKeys: string[] } {
  if (zeitbasis === 'monat' || vm.columns.length === 0) return vm
  const cols = vm.columns
  const yearCols: AuswertungColumn[] = []
  const bucketKeys: string[][] = []
  for (let i = 0; i < cols.length; i += 12) {
    const bucket = cols.slice(i, i + 12)
    const n = Math.floor(i / 12) + 1
    yearCols.push({
      key: `J${n}`,
      label: `Jahr ${n}`,
      sublabel: bucket.length > 1 ? `${bucket[0].label} – ${bucket[bucket.length - 1].label}` : bucket[0].label,
    })
    bucketKeys.push(bucket.map(b => b.key))
  }
  const emptyCell: AuswertungCell = { value: null, indicator: null, hasNote: false, noteText: null }
  const rows = vm.rows.map(row => {
    if (row.kind === 'section') return { ...row, cells: {} }
    const isBalance = row.kind === 'kontostand'
    const cells: Record<string, AuswertungCell> = {}
    yearCols.forEach((yc, idx) => {
      const keys = bucketKeys[idx]
      if (isBalance) {
        // Kumuliert → Endbestand = letzter Monat mit Wert im Block.
        let val: number | null = null
        for (const k of keys) { const c = row.cells[k]; if (c && c.value !== null) val = c.value }
        cells[yc.key] = val === null ? emptyCell : { value: val, indicator: null, hasNote: false, noteText: null }
      } else {
        let sum = 0, any = false
        for (const k of keys) { const c = row.cells[k]; if (c && c.value !== null) { sum += c.value; any = true } }
        cells[yc.key] = any ? { value: Math.round(sum * 100) / 100, indicator: null, hasNote: false, noteText: null } : emptyCell
      }
    })
    return { ...row, cells }
  })
  return { columns: yearCols, rows, expandableKeys: vm.expandableKeys }
}

// ─── Fetch-Helfer ──────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url)
    if (!r.ok) return fallback
    return (await r.json()) as T
  } catch {
    return fallback
  }
}

function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  const data = (raw as { data?: T[] })?.data
  return Array.isArray(data) ? data : []
}

interface ManuellerEintrag {
  kategorie_id: string
  produkt_id?: string | null
  jahr: number
  monat: number
  betrag_manuell?: number | null
  betrag?: number | null
}
interface BerEintrag { kategorie_id: string; produkt_id?: string | null; jahr: number; monat: number; wert: number }

function addNote(map: Map<string, string>, key: string, text: string) {
  map.set(key, map.has(key) ? `${map.get(key)}\n${text}` : text)
}

interface NoteEntry { first: string; mid: string | null; year: number; month: number; text: string }

async function fetchNoteEntries(versionId: string, seite: string): Promise<NoteEntry[]> {
  const raw = await fetchJson<{ data?: { zellen_schluessel: string; notiz_text: string }[] }>(
    `/api/langfristige-planung/${versionId}/planung-notizen?seite=${encodeURIComponent(seite)}`, { data: [] },
  )
  const out: NoteEntry[] = []
  for (const item of raw.data ?? []) {
    // Schlüsselformat: `${kategorieId}[:${produktId|plattformId}]:${jahr}:${monat}`
    const parts = item.zellen_schluessel.split(':')
    if (parts.length < 3) continue
    const month = Number(parts[parts.length - 1])
    const year = Number(parts[parts.length - 2])
    if (!Number.isFinite(month) || !Number.isFinite(year)) continue
    const first = parts[0]
    const mid = parts.length >= 4 ? parts[1] : null
    out.push({ first, mid, year, month, text: item.notiz_text })
  }
  return out
}

// Sammelt die Blatt-Kategorie-Ids eines benannten globalen Wurzelknotens (L1 → L2-Blätter, sonst L1).
function leafIdsForRoot(allKats: KpiCategory[], rootName: string): Set<string> {
  const root = allKats.find(k => k.level === 1 && k.name.trim().toLowerCase() === rootName)
  const out = new Set<string>()
  if (!root) return out
  for (const g of allKats.filter(k => k.parent_id === root.id)) {
    const children = allKats.filter(k => k.parent_id === g.id)
    if (children.length > 0) children.forEach(c => out.add(c.id))
    else out.add(g.id)
  }
  return out
}

// ─── Modul-Loader (versionsgebunden, monatsbasiert) ────────────────────────────

interface ManuellOnlyCfg {
  endpoint: string
  rootName: string
  noteSeite: string
  field: 'betrag' | 'betrag_manuell'
  // Optionaler Brutto-Faktor je Kategorie (z.B. Operativkosten: Netto → Brutto inkl. USt).
  grossUp?: (kategorieId: string) => number
}

// Operativ / Finanzierung: rein manuell (kein berechnet), globaler Subtree.
async function loadManuellOnlyModul(versionId: string, cfg: ManuellOnlyCfg, ausKats: KpiCategory[]): Promise<ModuleResult> {
  const [valRaw, noteEntries] = await Promise.all([
    fetchJson<unknown>(cfg.endpoint, []),
    fetchNoteEntries(versionId, cfg.noteSeite),
  ])
  const leafIds = leafIdsForRoot(ausKats, cfg.rootName)

  const soll = new Map<string, number>()
  const sollManual = new Set<string>()
  for (const e of asArray<ManuellerEintrag>(valRaw)) {
    let betrag = (cfg.field === 'betrag' ? e.betrag : e.betrag_manuell)
    if (betrag === null || betrag === undefined) continue
    if (!leafIds.has(e.kategorie_id)) continue
    if (cfg.grossUp) betrag = Math.round(betrag * cfg.grossUp(e.kategorie_id) * 100) / 100
    const k = leafMonthKey(e.kategorie_id, e.jahr, e.monat)
    soll.set(k, betrag)
    sollManual.add(k)
  }

  const notes = new Map<string, string>()
  for (const n of noteEntries) addNote(notes, leafMonthKey(n.first, n.year, n.month), n.text)

  return { leafIds, soll, sollManual, notes, subLeavesByLeaf: new Map() }
}

// Steuerausgaben: globaler "steuern"-Subtree, berechnet + manuell (Werte dürfen negativ sein).
async function loadSteuer(versionId: string, ausKats: KpiCategory[]): Promise<ModuleResult> {
  const endpoint = `/api/langfristige-planung/${versionId}/steuerausgaben`
  const [valRaw, berRaw, noteEntries] = await Promise.all([
    fetchJson<unknown>(endpoint, []),
    fetchJson<unknown>(`${endpoint}/berechnet`, { data: [] }),
    fetchNoteEntries(versionId, 'steuerausgaben'),
  ])
  const leafIds = leafIdsForRoot(ausKats, 'steuern')

  const manual = new Map<string, number>()
  for (const e of asArray<ManuellerEintrag>(valRaw)) {
    if (e.betrag_manuell === null || e.betrag_manuell === undefined) continue
    if (!leafIds.has(e.kategorie_id)) continue
    manual.set(leafMonthKey(e.kategorie_id, e.jahr, e.monat), e.betrag_manuell)
  }
  const ber = new Map<string, number>()
  for (const e of asArray<BerEintrag>(berRaw)) {
    if (!leafIds.has(e.kategorie_id)) continue
    ber.set(leafMonthKey(e.kategorie_id, e.jahr, e.monat), Number(e.wert))
  }

  const soll = new Map<string, number>()
  const sollManual = new Set<string>()
  for (const [k, v] of manual) { soll.set(k, v); sollManual.add(k) }
  for (const [k, v] of ber) { if (!soll.has(k)) soll.set(k, v) }

  const notes = new Map<string, string>()
  for (const n of noteEntries) addNote(notes, leafMonthKey(n.first, n.year, n.month), n.text)

  return { leafIds, soll, sollManual, notes, subLeavesByLeaf: new Map() }
}

// Generischer Produkt-Modul-Loader (Umsatzausgaben + Investitionsausgaben):
// Werte je (kategorie_id, produkt_id) → Produkt-Unterzeilen; effektiv = manuell ?? berechnet.
async function loadProduktModul(
  versionId: string, endpoint: string, noteSeite: string, leafIds: Set<string>,
  produktNames: Map<string, string>, produktOrder: Map<string, number>,
): Promise<ModuleResult> {
  const [valRaw, berRaw, noteEntries] = await Promise.all([
    fetchJson<unknown>(endpoint, []),
    fetchJson<unknown>(`${endpoint}/berechnet`, { data: [] }),
    fetchNoteEntries(versionId, noteSeite),
  ])

  const PROD_NONE = '∅'
  const berProd = new Map<string, number>()       // `${kat}:${prod}:${y}:${m}` -> wert
  const prodByKatMonth = new Map<string, Set<string>>()
  const subProds = new Map<string, Set<string>>()  // leafId -> produktIds (mit Daten)
  function addProd(katId: string, prodId: string, y: number, m: number) {
    const lk = leafMonthKey(katId, y, m)
    if (!prodByKatMonth.has(lk)) prodByKatMonth.set(lk, new Set())
    prodByKatMonth.get(lk)!.add(prodId)
  }
  function noteSub(leafId: string, prodId: string) {
    if (!subProds.has(leafId)) subProds.set(leafId, new Set())
    subProds.get(leafId)!.add(prodId)
  }

  for (const e of asArray<BerEintrag>(berRaw)) {
    if (!leafIds.has(e.kategorie_id)) continue
    const prod = e.produkt_id ?? PROD_NONE
    berProd.set(`${e.kategorie_id}:${prod}:${e.jahr}:${e.monat}`, Number(e.wert))
    addProd(e.kategorie_id, prod, e.jahr, e.monat)
    if (e.produkt_id) noteSub(e.kategorie_id, e.produkt_id)
  }

  const manProd = new Map<string, number>()
  const manKatMonth = new Set<string>()
  for (const e of asArray<ManuellerEintrag>(valRaw)) {
    if (e.betrag_manuell === null || e.betrag_manuell === undefined) continue
    if (!leafIds.has(e.kategorie_id)) continue
    const prod = e.produkt_id ?? PROD_NONE
    manProd.set(`${e.kategorie_id}:${prod}:${e.jahr}:${e.monat}`, e.betrag_manuell)
    manKatMonth.add(leafMonthKey(e.kategorie_id, e.jahr, e.monat))
    addProd(e.kategorie_id, prod, e.jahr, e.monat)
    if (e.produkt_id) noteSub(e.kategorie_id, e.produkt_id)
  }

  const soll = new Map<string, number>()
  const sollManual = new Set<string>()
  for (const [lk, prods] of prodByKatMonth) {
    // lk = `${leafId}|${y}:${m}` → leafId + y:m zerlegen
    const sep = lk.indexOf('|')
    const leafId = lk.slice(0, sep)
    const [yStr, mStr] = lk.slice(sep + 1).split(':')
    const y = Number(yStr), m = Number(mStr)
    let sum = 0, any = false
    for (const prod of prods) {
      const pk = `${leafId}:${prod}:${y}:${m}`
      const v = manProd.has(pk) ? manProd.get(pk)! : berProd.get(pk)
      if (v !== undefined) {
        sum += v; any = true
        if (prod !== PROD_NONE) {
          const ck = leafMonthKey(subId(leafId, prod), y, m)
          soll.set(ck, v)
          if (manProd.has(pk)) sollManual.add(ck)
        }
      }
    }
    if (any) soll.set(lk, sum)
    if (manKatMonth.has(lk)) sollManual.add(lk)
  }

  const subLeavesByLeaf = new Map<string, SubLeaf[]>()
  for (const [leafId, prodSet] of subProds) {
    // Reihenfolge der Produkte = Reihenfolge im KPI-Modell (sort_order); ohne Werte erscheint ein Produkt nicht.
    const subs = [...prodSet]
      .sort((a, b) => (produktOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (produktOrder.get(b) ?? Number.MAX_SAFE_INTEGER))
      .map(pid => ({ id: subId(leafId, pid), name: produktNames.get(pid) ?? pid }))
    if (subs.length > 0) subLeavesByLeaf.set(leafId, subs)
  }

  const notes = new Map<string, string>()
  for (const n of noteEntries) {
    if (n.mid) addNote(notes, leafMonthKey(subId(n.first, n.mid), n.year, n.month), n.text)
    else addNote(notes, leafMonthKey(n.first, n.year, n.month), n.text)
  }

  return { leafIds, soll, sollManual, notes, subLeavesByLeaf }
}

// Einnahmen: globaler einnahmen-Baum; Produktverkäufe → Plattform-Unterzeilen (auto), sonst manuell.
async function loadEinnahmen(
  versionId: string, einKats: KpiCategory[], plattformNames: Map<string, string>, plattformOrder: Map<string, number>,
): Promise<ModuleResult> {
  const endpoint = `/api/langfristige-planung/${versionId}/einnahmen-planung`
  const [valRaw, pvRaw, noteEntries] = await Promise.all([
    fetchJson<unknown>(endpoint, []),
    fetchJson<unknown>(`${endpoint}/produktverkaeufe-berechnet`, []),
    fetchNoteEntries(versionId, 'einnahmenplanung'),
  ])

  const pvKat = einKats.find(k => k.level === 1 && istProduktverkaufe(k.name))
  const pvKatId = pvKat?.id ?? null
  const plattformIds = new Set(plattformNames.keys())

  const leafIds = new Set<string>()
  for (const l1 of einKats.filter(k => k.level === 1)) {
    const children = einKats.filter(k => k.parent_id === l1.id && k.level === 2)
    if (children.length > 0) children.forEach(c => leafIds.add(c.id))
    else leafIds.add(l1.id)
  }

  // Auto-Produktverkäufe je Plattform × Monat.
  const pvByPltMonth = new Map<string, number>()  // `${pltId}:${y}:${m}`
  for (const e of asArray<{ jahr: number; monat: number; sales_plattform_id: string; wert: number }>(pvRaw)) {
    const key = `${e.sales_plattform_id}:${e.jahr}:${e.monat}`
    pvByPltMonth.set(key, (pvByPltMonth.get(key) ?? 0) + Number(e.wert))
  }

  // Gespeicherte (manuelle) Einnahmen-Werte je Kategorie × Monat.
  const savedMap = new Map<string, number>()
  for (const e of asArray<ManuellerEintrag>(valRaw)) {
    if (e.betrag_manuell === null || e.betrag_manuell === undefined) continue
    savedMap.set(leafMonthKey(e.kategorie_id, e.jahr, e.monat), e.betrag_manuell)
  }

  const soll = new Map<string, number>()
  const sollManual = new Set<string>()

  // Produktverkäufe: Plattform-Unterzeilen (auto grau) + Summe; manueller Total-Override (blau) sticht.
  if (pvKatId) {
    const monthsSeen = new Set<string>()
    for (const key of pvByPltMonth.keys()) {
      const idx = key.indexOf(':')
      monthsSeen.add(key.slice(idx + 1)) // `${y}:${m}`
    }
    // auch Monate mit manuellem Total-Override berücksichtigen
    for (const k of savedMap.keys()) {
      if (k.startsWith(`${pvKatId}|`)) monthsSeen.add(k.slice(k.indexOf('|') + 1))
    }
    for (const ym of monthsSeen) {
      const [yStr, mStr] = ym.split(':')
      const y = Number(yStr), m = Number(mStr)
      let sum = 0, any = false
      for (const pltId of plattformIds) {
        const auto = pvByPltMonth.get(`${pltId}:${y}:${m}`)
        if (auto !== undefined) {
          sum += auto; any = true
          soll.set(leafMonthKey(subId(pvKatId, pltId), y, m), auto)
        }
      }
      const override = savedMap.get(leafMonthKey(pvKatId, y, m))
      if (override !== undefined) {
        soll.set(leafMonthKey(pvKatId, y, m), override); sollManual.add(leafMonthKey(pvKatId, y, m))
      } else if (any) {
        soll.set(leafMonthKey(pvKatId, y, m), sum)
      }
    }
  }

  // Nicht-Produktverkäufe: gespeicherte Werte sind immer manuell (blau).
  for (const [k, v] of savedMap) {
    const sep = k.indexOf('|')
    const leafId = k.slice(0, sep)
    if (leafId === pvKatId) continue
    if (!leafIds.has(leafId)) continue
    soll.set(k, v); sollManual.add(k)
  }

  // Plattformen strukturell unter Produktverkäufe anzeigen (alle Plattformen der Version),
  // in der Reihenfolge des KPI-Modells (sort_order).
  const subLeavesByLeaf = new Map<string, SubLeaf[]>()
  if (pvKatId && plattformIds.size > 0) {
    const subs = [...plattformIds]
      .sort((a, b) => (plattformOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (plattformOrder.get(b) ?? Number.MAX_SAFE_INTEGER))
      .map(pid => ({ id: subId(pvKatId, pid), name: plattformNames.get(pid) ?? pid }))
    subLeavesByLeaf.set(pvKatId, subs)
  }

  const notes = new Map<string, string>()
  for (const n of noteEntries) {
    if (pvKatId && plattformIds.has(n.first)) addNote(notes, leafMonthKey(subId(pvKatId, n.first), n.year, n.month), n.text)
    else addNote(notes, leafMonthKey(n.first, n.year, n.month), n.text)
  }

  return { leafIds, soll, sollManual, notes, subLeavesByLeaf }
}

// ─── Kategorie-Subset-Helfer ───────────────────────────────────────────────────

// Alle Nachfahren-Ids eines Knotens (inkl. Knoten selbst).
function subtreeIds(allKats: KpiCategory[], rootId: string): Set<string> {
  const out = new Set<string>([rootId])
  let added = true
  while (added) {
    added = false
    for (const k of allKats) {
      if (k.parent_id && out.has(k.parent_id) && !out.has(k.id)) { out.add(k.id); added = true }
    }
  }
  return out
}

// ─── Hook ───────────────────────────────────────────────────────────────────

interface Block { sectionKey: string; kats: KpiCategory[]; store: DataStore }

export function useLangfristigeLiquiditaetsauswertung(versionId: string) {
  const [monate, setMonate] = useState<PlanungsMonat[]>([])
  const [einKats, setEinKats] = useState<KpiCategory[]>([])
  const [ausBlocks, setAusBlocks] = useState<Block[]>([])
  const [einStore, setEinStore] = useState<DataStore>(() => ({ sign: 1, ...emptyModule() }))
  const [startkontostand, setStartkontostand] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!versionId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const grund = await fetchJson<{
          startmonat_monat?: number; startmonat_jahr?: number
          startkontostand?: number; planungshorizont_monate?: number
        }>(`/api/langfristige-planung/${versionId}/grundeinstellungen`, {})
        const now = new Date()
        const horizont = grund.planungshorizont_monate ?? DEFAULT_PLANUNGSHORIZONT_MONATE
        const startMonat = grund.startmonat_monat ?? now.getMonth() + 1
        const startJahr = grund.startmonat_jahr ?? now.getFullYear()
        const months = buildMonate(startMonat, startJahr, horizont)
        if (cancelled) return
        setMonate(months)
        setStartkontostand(Number(grund.startkontostand ?? 0))

        const [einnahmenKats, ausgabenKats, produkteRaw, plattformenRaw, investitionenRaw, marketingkanaeleRaw, ustSaetzeRaw, ustEbeneRaw] = await Promise.all([
          fetchJson<KpiCategory[]>('/api/kpi-categories?type=einnahmen', []),
          fetchJson<KpiCategory[]>('/api/kpi-categories?type=ausgaben_kosten', []),
          fetchJson<{ id: string; name: string; sort_order?: number }[]>(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_produkt`, []),
          fetchJson<{ id: string; name: string; sort_order?: number }[]>(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_sales_plattform`, []),
          fetchJson<{ id: string; name: string; parent_id?: string | null; level?: number; sort_order?: number }[]>(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_investition`, []),
          fetchJson<{ id: string; name: string; sort_order?: number }[]>(`/api/langfristige-planung/${versionId}/kpi-kategorien?art=lp_marketingkanal`, []),
          fetchJson<{ kategorie_id: string; ebene: number; ust_satz: number | null }[]>(`/api/langfristige-planung/${versionId}/steuereinstellungen/kategorie-saetze`, []),
          fetchJson<Record<string, 1 | 2>>(`/api/langfristige-planung/${versionId}/steuereinstellungen/ebene-auswahl`, {}),
        ])
        const ein = Array.isArray(einnahmenKats) ? einnahmenKats : []
        const aus = Array.isArray(ausgabenKats) ? ausgabenKats : []
        // Produkte/Plattformen in KPI-Modell-Reihenfolge (sort_order) → Namen + Reihenfolge-Index.
        const produkteSorted = (Array.isArray(produkteRaw) ? produkteRaw : []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        const plattformenSorted = (Array.isArray(plattformenRaw) ? plattformenRaw : []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        const produktNames = new Map(produkteSorted.map(p => [p.id, p.name]))
        const produktOrder = new Map(produkteSorted.map((p, i) => [p.id, i]))
        const plattformNames = new Map(plattformenSorted.map(p => [p.id, p.name]))
        const plattformOrder = new Map(plattformenSorted.map((p, i) => [p.id, i]))

        // Version-Investitionen als KpiCategory-ähnlicher Baum (für die Hierarchie).
        const invRaw: KpiCategory[] = (Array.isArray(investitionenRaw) ? investitionenRaw : []).map(r => ({
          id: r.id, type: 'ausgaben_kosten', parent_id: r.parent_id ?? null, name: r.name,
          level: r.level ?? 1, sort_order: r.sort_order ?? 0,
          sku_code: null, ust_satz: null, ist_abzugsposten: null, anzeige_bezeichnung: null,
          rentabilitaet_ausschluss: null, dimension_1: null, dimension_2: null, is_system: null,
        } as unknown as KpiCategory))
        // Blatt-Ebene Investitionen = L2-Untergruppen (aus der ORIGINAL-Struktur, vor dem Umhängen).
        const invLeafIds = new Set<string>()
        for (const l1 of invRaw.filter(k => k.level === 1)) {
          const children = invRaw.filter(k => k.parent_id === l1.id)
          if (children.length > 0) children.forEach(c => invLeafIds.add(c.id))
          else invLeafIds.add(l1.id)
        }
        // Alle Investitionen unter EINE Gruppe „Investitionen" hängen; die im KPI-Modell
        // hinterlegten Übergruppen werden dadurch zu Untergruppen darunter.
        const INV_ROOT_ID = '__lp_investitionen_root__'
        const invRootNode = {
          id: INV_ROOT_ID, type: 'ausgaben_kosten', parent_id: null, name: 'Investitionen',
          level: 1, sort_order: 0, sku_code: null, ust_satz: null, ist_abzugsposten: null,
          anzeige_bezeichnung: null, rentabilitaet_ausschluss: null, dimension_1: null, dimension_2: null, is_system: null,
        } as unknown as KpiCategory
        // Übergruppen (vormals L1) unter den neuen Wurzelknoten hängen und auf L2 setzen,
        // damit buildSection sie NICHT zusätzlich als eigene Oberkategorie rendert.
        const invKats: KpiCategory[] = [
          invRootNode,
          ...invRaw.map((k): KpiCategory => (k.parent_id === null ? { ...k, parent_id: INV_ROOT_ID, level: 2 } : k)),
        ]

        // Umsatzausgaben-Blattmenge: alle L2 (bzw. L1-Blätter) außerhalb der vier eigenen Wurzeln.
        const ownRootIds = new Set(aus.filter(k => k.level === 1 && EIGENE_AUSGABEN_ROOTS.includes(k.name.trim().toLowerCase())).map(k => k.id))
        const umsatzLeafIds = new Set<string>()
        for (const l1 of aus.filter(k => k.level === 1 && !ownRootIds.has(k.id))) {
          const children = aus.filter(k => k.parent_id === l1.id)
          if (children.length > 0) children.forEach(c => umsatzLeafIds.add(c.id))
          else umsatzLeafIds.add(l1.id)
        }

        // Marketing-Sonderfall (wie die Umsatzausgaben-Quellseite): die Untergruppen der
        // „Marketing"-L1 sind die versionsgebundenen Marketingkanäle (lp_marketingkanal),
        // und die berechneten Werte sind nach Kanal-ID verschlüsselt — NICHT nach globaler
        // Kategorie. Daher injizieren wir die Kanäle als synthetische L2-Knoten unter
        // „Marketing" und nehmen ihre IDs in die Blattmenge auf.
        const marketingkanaele = (Array.isArray(marketingkanaeleRaw) ? marketingkanaeleRaw : [])
          .slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        const marketingL1 = aus.find(k => k.level === 1 && !ownRootIds.has(k.id) && k.name.toLowerCase().includes('marketing'))
        const marketingKanalKats: KpiCategory[] = []
        if (marketingL1) {
          umsatzLeafIds.delete(marketingL1.id) // Marketing-L1 ist kein Blatt, sondern Container der Kanäle
          for (const mk of marketingkanaele) {
            umsatzLeafIds.add(mk.id)
            marketingKanalKats.push({
              id: mk.id, type: 'ausgaben_kosten', parent_id: marketingL1.id, name: mk.name,
              level: 2, sort_order: mk.sort_order ?? 0, sku_code: null, ust_satz: null,
              ist_abzugsposten: null, anzeige_bezeichnung: null, rentabilitaet_ausschluss: null,
              dimension_1: null, dimension_2: null, is_system: null,
            } as unknown as KpiCategory)
          }
        }

        // USt-Satz-Auflösung (wie steuerausgaben/berechnet, getUstSatzHierarchisch):
        // Operativkosten sind NETTO (exkl. USt) — für die Liquiditätssicht (Cash-Out)
        // wird der USt-Satz aufgeschlagen (Brutto = Netto × (1 + Satz/100)).
        const ustRateMap = new Map<string, number>()
        for (const r of (Array.isArray(ustSaetzeRaw) ? ustSaetzeRaw : [])) {
          if (r.ust_satz != null) ustRateMap.set(`${r.kategorie_id}:${r.ebene}`, Number(r.ust_satz))
        }
        const ustEbeneMap: Record<string, 1 | 2> = (ustEbeneRaw && typeof ustEbeneRaw === 'object' && !Array.isArray(ustEbeneRaw)) ? ustEbeneRaw : {}
        const parentMap = new Map<string, string>()
        for (const k of aus) if (k.parent_id) parentMap.set(k.id, k.parent_id)
        function findL1Ancestor(katId: string): string {
          let id = katId
          while (parentMap.has(id)) id = parentMap.get(id)!
          return id
        }
        // Hierarchischer USt-Satz (Prozent): Gesamt → L1-Satz; Aufgeteilt → erster :2-Satz von katId aufwärts.
        function getUstSatzHierarchisch(katId: string): number {
          const l1Id = findL1Ancestor(katId)
          const selectedEbene = ustEbeneMap[l1Id] ?? 1
          if (selectedEbene === 1) return ustRateMap.get(`${l1Id}:1`) ?? 0
          let id: string | undefined = katId
          while (id) {
            const rate = ustRateMap.get(`${id}:2`)
            if (rate != null) return rate
            id = parentMap.get(id)
          }
          return 0
        }
        const operativGrossUp = (katId: string) => 1 + getUstSatzHierarchisch(katId) / 100

        // Phase 1: Module, deren Soll in die Umsatzsteuer-Berechnung einfließt.
        const [einnahmen, umsatz, operativ, investitionen, finanzierung] = await Promise.all([
          loadEinnahmen(versionId, ein, plattformNames, plattformOrder),
          loadProduktModul(versionId, `/api/langfristige-planung/${versionId}/umsatzausgaben`, 'umsatzausgaben', umsatzLeafIds, produktNames, produktOrder),
          loadManuellOnlyModul(versionId, { endpoint: `/api/langfristige-planung/${versionId}/operativekosten-planung`, rootName: 'operativ', noteSeite: 'operativekosten-planung', field: 'betrag', grossUp: operativGrossUp }, aus),
          loadProduktModul(versionId, `/api/langfristige-planung/${versionId}/investitionsausgaben-planung`, 'investitionsausgaben-planung', invLeafIds, produktNames, produktOrder),
          loadManuellOnlyModul(versionId, { endpoint: `/api/langfristige-planung/${versionId}/finanzierungsausgaben-planung`, rootName: 'finanzierung', noteSeite: 'finanzierungsausgaben-planung', field: 'betrag' }, aus),
        ])
        // Phase 2: Steuerausgaben zuletzt — liest die frischen Soll-Werte der anderen Module (Umsatzsteuer).
        const steuer = await loadSteuer(versionId, aus)

        if (cancelled) return

        // Kategorie-Subsets je Ausgaben-Block (in der vom Spec gewünschten Reihenfolge).
        const operativRoot = aus.find(k => k.level === 1 && k.name.trim().toLowerCase() === 'operativ')
        const finanzierungRoot = aus.find(k => k.level === 1 && k.name.trim().toLowerCase() === 'finanzierung')
        const steuernRoot = aus.find(k => k.level === 1 && k.name.trim().toLowerCase() === 'steuern')
        const operativKats = operativRoot ? aus.filter(k => subtreeIds(aus, operativRoot.id).has(k.id)) : []
        const finanzierungKats = finanzierungRoot ? aus.filter(k => subtreeIds(aus, finanzierungRoot.id).has(k.id)) : []
        const steuernKats = steuernRoot ? aus.filter(k => subtreeIds(aus, steuernRoot.id).has(k.id)) : []
        // Umsatzausgaben-Kategorien: alle Kategorien, deren L1-Vorfahre keine eigene Wurzel ist,
        // plus die synthetischen Marketingkanal-Untergruppen unter „Marketing".
        const ownDescendants = new Set<string>()
        for (const rid of ownRootIds) for (const id of subtreeIds(aus, rid)) ownDescendants.add(id)
        const umsatzKatsFinal = [...aus.filter(k => !ownDescendants.has(k.id)), ...marketingKanalKats]

        const blocks: Block[] = [
          { sectionKey: 'aus-umsatz', kats: umsatzKatsFinal, store: { sign: -1, ...umsatz } },
          { sectionKey: 'aus-operativ', kats: operativKats, store: { sign: -1, ...operativ } },
          { sectionKey: 'aus-investitionen', kats: invKats, store: { sign: -1, ...investitionen } },
          { sectionKey: 'aus-finanzierung', kats: finanzierungKats, store: { sign: -1, ...finanzierung } },
          { sectionKey: 'aus-steuern', kats: steuernKats, store: { sign: -1, ...steuer } },
        ]

        setEinKats(ein)
        setEinStore({ sign: 1, ...einnahmen })
        setAusBlocks(blocks)
      } catch {
        if (!cancelled) setError('Fehler beim Laden der Liquiditätsauswertung.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [versionId])

  // ─── View-Model bauen ──────────────────────────────────────────────────────

  const viewModel = useMemo<AuswertungViewModel>(() => {
    const columns: AuswertungColumn[] = monate.map(m => ({ key: `${m.year}-${m.month}`, label: m.label }))
    const colMonth: Record<string, PlanungsMonat> = {}
    monate.forEach(m => { colMonth[`${m.year}-${m.month}`] = m })

    const rows: AuswertungRow[] = []
    const expandableKeys: string[] = []
    if (monate.length === 0) return { columns, rows, expandableKeys }

    type Getter = (col: AuswertungColumn) => AuswertungCell

    function leafCell(data: DataStore, id: string, col: AuswertungColumn): AuswertungCell {
      const m = colMonth[col.key]
      const lk = leafMonthKey(id, m.year, m.month)
      const raw = data.soll.get(lk)
      const note = data.notes.get(lk)
      let indicator: 'gray' | 'blue' | null = null
      if (raw !== undefined) indicator = data.sollManual.has(lk) ? 'blue' : 'gray'
      return {
        value: raw !== undefined ? raw * data.sign : null,
        indicator,
        hasNote: !!note,
        noteText: note ?? null,
      }
    }
    function cellsFor(getter: Getter): Record<string, AuswertungCell> {
      return Object.fromEntries(columns.map(c => [c.key, getter(c)]))
    }
    function sumGetter(getters: Getter[]): Getter {
      return (col: AuswertungColumn) => {
        let sum = 0, any = false
        for (const g of getters) {
          const v = g(col).value
          if (v !== null) { sum += v; any = true }
        }
        return { value: any ? sum : null, indicator: null, hasNote: false, noteText: null }
      }
    }
    function hasAny(getter: Getter): boolean {
      return columns.some(c => getter(c).value !== null)
    }

    function buildNode(node: KpiCategory, allKats: KpiCategory[], data: DataStore, depth: number, ancestors: string[], sectionKey: string): { rows: AuswertungRow[]; getters: Getter[] } {
      const children = allKats.filter(k => k.parent_id === node.id).sort((a, b) => a.sort_order - b.sort_order)
      const isLeaf = data.leafIds.has(node.id) || children.length === 0

      if (isLeaf) {
        const leafGetter: Getter = col => leafCell(data, node.id, col)
        const subs = data.subLeavesByLeaf.get(node.id) ?? []
        if (!hasAny(leafGetter) && subs.length === 0) return { rows: [], getters: [] }

        if (subs.length > 0) {
          const groupKey = `${sectionKey}:${node.id}`
          const childAncestors = [...ancestors, groupKey]
          expandableKeys.push(groupKey)
          const aggGetter: Getter = col => {
            const c = leafGetter(col)
            return { value: c.value, indicator: null, hasNote: false, noteText: null }
          }
          const header: AuswertungRow = {
            id: `leaf-${sectionKey}-${node.id}`,
            kind: depth === 1 ? 'kategorie' : depth === 2 ? 'gruppe' : 'leaf',
            label: node.name, indent: depth, expandable: true, groupKey, ancestorGroupKeys: ancestors,
            cells: cellsFor(aggGetter),
          }
          const subRows: AuswertungRow[] = subs.map(s => ({
            id: `sub-${sectionKey}-${s.id}`, kind: 'sub' as const, label: s.name,
            indent: depth + 1, expandable: false, ancestorGroupKeys: childAncestors,
            cells: cellsFor(col => leafCell(data, s.id, col)),
          }))
          return { rows: [header, ...subRows], getters: [leafGetter] }
        }

        return {
          rows: [{
            id: `leaf-${sectionKey}-${node.id}`,
            kind: depth === 1 ? 'kategorie' : depth === 2 ? 'gruppe' : 'leaf',
            label: node.name, indent: depth, expandable: false, ancestorGroupKeys: ancestors,
            cells: cellsFor(leafGetter),
          }],
          getters: [leafGetter],
        }
      }

      const groupKey = `${sectionKey}:${node.id}`
      const childAncestors = [...ancestors, groupKey]
      const childRows: AuswertungRow[] = []
      const getters: Getter[] = []
      for (const c of children) {
        const r = buildNode(c, allKats, data, depth + 1, childAncestors, sectionKey)
        childRows.push(...r.rows)
        getters.push(...r.getters)
      }
      if (getters.length === 0) return { rows: [], getters: [] }

      expandableKeys.push(groupKey)
      const header: AuswertungRow = {
        id: `node-${sectionKey}-${node.id}`,
        kind: depth === 1 ? 'kategorie' : 'gruppe',
        label: node.name, indent: depth, expandable: true, groupKey, ancestorGroupKeys: ancestors,
        cells: cellsFor(sumGetter(getters)),
      }
      return { rows: [header, ...childRows], getters }
    }

    const emptyCell: AuswertungCell = { value: null, indicator: null, hasNote: false, noteText: null }

    function buildSection(allKats: KpiCategory[], data: DataStore, sectionKey: string): Getter[] {
      const roots = allKats.filter(k => k.level === 1).sort((a, b) => a.sort_order - b.sort_order)
      const all: Getter[] = []
      for (const root of roots) {
        const r = buildNode(root, allKats, data, 1, [], sectionKey)
        if (r.rows.length > 0) {
          rows.push(...r.rows)
          all.push(...r.getters)
        } else {
          // Jede Oberkategorie (L1) wird IMMER angezeigt — auch ohne Werte (leere Zeile).
          rows.push({
            id: `node-${sectionKey}-${root.id}`,
            kind: 'kategorie',
            label: root.name,
            indent: 1,
            expandable: false,
            ancestorGroupKeys: [],
            cells: Object.fromEntries(columns.map(c => [c.key, emptyCell])),
          })
        }
      }
      return all
    }

    // EINNAHMEN
    rows.push({ id: 'section-einnahmen', kind: 'section', label: 'EINNAHMEN', indent: 0, expandable: false, ancestorGroupKeys: [], cells: {} })
    const einGetters = buildSection(einKats, einStore, 'ein')
    rows.push({ id: 'gesamt-einnahmen', kind: 'gesamt-einnahmen', label: 'Gesamt Einnahmen', indent: 0, expandable: false, ancestorGroupKeys: [], cells: cellsFor(sumGetter(einGetters)) })

    // AUSGABEN (fünf Blöcke in Spec-Reihenfolge)
    rows.push({ id: 'section-ausgaben', kind: 'section', label: 'AUSGABEN', indent: 0, expandable: false, ancestorGroupKeys: [], cells: {} })
    const ausGetters: Getter[] = []
    for (const block of ausBlocks) {
      const g = buildSection(block.kats, block.store, block.sectionKey)
      ausGetters.push(...g)
    }
    rows.push({ id: 'gesamt-ausgaben', kind: 'gesamt-ausgaben', label: 'Gesamt Ausgaben', indent: 0, expandable: false, ancestorGroupKeys: [], cells: cellsFor(sumGetter(ausGetters)) })

    // Cashflow + Kontostand
    const einSum = sumGetter(einGetters)
    const ausSum = sumGetter(ausGetters)
    const cashflowCells: Record<string, AuswertungCell> = {}
    const kontostandCells: Record<string, AuswertungCell> = {}
    let kumuliert = startkontostand
    for (const col of columns) {
      const cf = (einSum(col).value ?? 0) + (ausSum(col).value ?? 0)
      kumuliert += cf
      cashflowCells[col.key] = { value: cf, indicator: null, hasNote: false, noteText: null }
      kontostandCells[col.key] = { value: kumuliert, indicator: null, hasNote: false, noteText: null }
    }
    rows.push({ id: 'cashflow', kind: 'cashflow', label: 'Cashflow der Periode', indent: 0, expandable: false, ancestorGroupKeys: [], cells: cashflowCells })
    rows.push({ id: 'kontostand', kind: 'kontostand', label: 'Kontostand', indent: 0, expandable: false, ancestorGroupKeys: [], cells: kontostandCells })

    return { columns, rows, expandableKeys }
  }, [monate, einKats, ausBlocks, einStore, startkontostand])

  const isEmpty = !loading && !error && einStore.leafIds.size === 0 && ausBlocks.every(b => b.store.leafIds.size === 0)

  return { monate, loading, error, isEmpty, ...viewModel }
}
