'use client'

import { useState, useEffect, useMemo } from 'react'
import { addWeeks, subWeeks, getISOWeek, getISOWeekYear, startOfISOWeek } from 'date-fns'
import type { KpiCategory } from '@/hooks/use-kpi-categories'
import type { PlanungsWoche } from '@/hooks/use-absatzplanung'
import { istProduktverkaufe } from '@/hooks/use-einnahmenplanung'

export type { PlanungsWoche }
export type AuswertungGranularitaet = 'woche' | 'monat'

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// Names of the four ausgaben_kosten level-1 roots that have their OWN module.
// Everything else at level 1 belongs to the "Umsatzausgaben" module.
const EIGENE_AUSGABEN_ROOTS = ['operativ', 'finanzierung', 'steuern', 'produktinvestitionen']

// Composite id for a product/platform row under a leaf category.
function subId(leafId: string, childId: string): string {
  return `${leafId}>${childId}`
}

// ─── Week helpers ───────────────────────────────────────────────────────────

function berechneVergangenheitswochen(horizont: number, ref?: Date): PlanungsWoche[] {
  const today = ref ?? new Date()
  const result: PlanungsWoche[] = []
  for (let i = horizont; i >= 1; i--) {
    const d = startOfISOWeek(subWeeks(today, i))
    result.push({ year: getISOWeekYear(d), week: getISOWeek(d), label: `KW${String(getISOWeek(d)).padStart(2, '0')} / ${getISOWeekYear(d)}` })
  }
  return result
}

function berechneZukunftswochen(horizont: number, ref?: Date): PlanungsWoche[] {
  const today = ref ?? new Date()
  const result: PlanungsWoche[] = []
  for (let i = 0; i < horizont; i++) {
    const d = startOfISOWeek(addWeeks(today, i))
    result.push({ year: getISOWeekYear(d), week: getISOWeek(d), label: `KW${String(getISOWeek(d)).padStart(2, '0')} / ${getISOWeekYear(d)}` })
  }
  return result
}

function thursdayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const monday1 = new Date(jan4.getTime() - (dow - 1) * 86_400_000)
  return new Date(monday1.getTime() + (week - 1) * 7 * 86_400_000 + 3 * 86_400_000)
}

function monthKeyOf(kw: PlanungsWoche): { key: string; label: string } {
  const d = thursdayOfISOWeek(kw.year, kw.week)
  return {
    key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
    label: `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  }
}

function kwKey(year: number, week: number): string {
  return `${year}:${week}`
}
function leafKwKey(leafId: string, year: number, week: number): string {
  return `${leafId}|${year}:${week}`
}

// ─── Normalized data store ────────────────────────────────────────────────────

interface SubLeaf { id: string; name: string }

interface DataStore {
  sign: 1 | -1                              // +1 einnahmen, -1 ausgaben
  leafIds: Set<string>                      // category ids that carry data (value-bearing level per module)
  ist: Map<string, number>                  // (leaf or composite) | kw -> raw magnitude (past)
  soll: Map<string, number>                 // (leaf or composite) | kw -> raw magnitude (future, effective)
  sollManual: Set<string>                   // keys that are a manual override (blue), else auto (gray)
  notes: Map<string, string>                // keys with note text
  subLeavesByLeaf: Map<string, SubLeaf[]>   // leafId -> product/platform rows
}

function emptyStore(sign: 1 | -1): DataStore {
  return { sign, leafIds: new Set(), ist: new Map(), soll: new Map(), sollManual: new Set(), notes: new Map(), subLeavesByLeaf: new Map() }
}

type ModuleResult = Omit<DataStore, 'sign'>

// ─── View model ──────────────────────────────────────────────────────────────

export interface AuswertungColumn {
  key: string
  label: string
  subLabel: 'Ist' | 'Soll'
  isPast: boolean
  isFirstSoll: boolean
  monthLabel?: string
}

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

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url)
    if (!r.ok) return fallback
    return (await r.json()) as T
  } catch {
    return fallback
  }
}

function pastRangeParams(v: PlanungsWoche[]): string | null {
  if (v.length === 0) return null
  return `?von_kw=${v[0].week}&von_jahr=${v[0].year}&bis_kw=${v[v.length - 1].week}&bis_jahr=${v[v.length - 1].year}`
}

function berRangeParams(all: PlanungsWoche[], ersteZukunft?: PlanungsWoche): string | null {
  if (all.length === 0) return null
  let p = `?von_kw=${all[0].week}&von_jahr=${all[0].year}&bis_kw=${all[all.length - 1].week}&bis_jahr=${all[all.length - 1].year}`
  if (ersteZukunft) p += `&erste_zukunftskw=${ersteZukunft.week}&erste_zukunftsjahr=${ersteZukunft.year}`
  return p
}

interface ManuellerEintrag {
  kategorie_id: string
  produkt_id?: string | null
  kw_year: number
  kw_number: number
  betrag_manuell: number | null
  ist_berechnet?: boolean | null
}
interface IstEintrag { kategorie_id: string; produkt_id?: string | null; kw_year: number; kw_number: number; betrag: number }
interface BerEintrag { kategorie_id: string; produkt_id?: string | null; kw_year: number; kw_number: number; wert: number }

function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  const data = (raw as { data?: T[] })?.data
  return Array.isArray(data) ? data : []
}

interface NoteEntry { first: string; mid: string | null; year: number; week: number; text: string }

async function fetchNoteEntries(seite: string): Promise<NoteEntry[]> {
  const raw = await fetchJson<{ data?: { zellen_schluessel: string; notiz_text: string }[] }>(
    `/api/planung-notizen?seite=${encodeURIComponent(seite)}`, { data: [] },
  )
  const out: NoteEntry[] = []
  for (const item of raw.data ?? []) {
    // key format: `${kategorieId}[:${produktId}]:${year}:${week}`
    const parts = item.zellen_schluessel.split(':')
    if (parts.length < 3) continue
    const week = Number(parts[parts.length - 1])
    const year = Number(parts[parts.length - 2])
    if (!Number.isFinite(week) || !Number.isFinite(year)) continue
    const first = parts[0]
    const mid = parts.length >= 4 ? parts[1] : null
    out.push({ first, mid, year, week, text: item.notiz_text })
  }
  return out
}

function addNote(map: Map<string, string>, key: string, text: string) {
  map.set(key, map.has(key) ? `${map.get(key)}\n${text}` : text)
}

// Collect the set of leaf category ids a "named root" module owns.
function leafIdsForRoot(allKats: KpiCategory[], rootName: string): Set<string> {
  const root = allKats.find(k => k.name.trim().toLowerCase() === rootName)
  const out = new Set<string>()
  if (!root) return out
  for (const g of allKats.filter(k => k.parent_id === root.id)) {
    const children = allKats.filter(k => k.parent_id === g.id)
    if (children.length > 0) children.forEach(c => out.add(c.id))
    else out.add(g.id)
  }
  return out
}

// ─── Generic ausgaben module loaders (no product breakdown) ────────────────────

interface AusgabenCfg {
  endpoint: string
  rootName: string
  noteSeite: string
  hasBerechnet: boolean
}

async function loadAusgabenModul(cfg: AusgabenCfg, allKats: KpiCategory[], vWochen: PlanungsWoche[], zWochen: PlanungsWoche[]): Promise<ModuleResult> {
  const allWochen = [...vWochen, ...zWochen]
  const istP = pastRangeParams(vWochen)
  const berP = berRangeParams(allWochen, zWochen[0])

  const [istRaw, berRaw] = await Promise.all([
    istP ? fetchJson<unknown>(`${cfg.endpoint}/ist-tatsaechlich${istP}`, { data: [] }) : Promise.resolve({ data: [] }),
    cfg.hasBerechnet && berP ? fetchJson<unknown>(`${cfg.endpoint}/berechnet${berP}`, { data: [] }) : Promise.resolve({ data: [] }),
  ])
  const valRaw = await fetchJson<unknown>(cfg.endpoint, { data: [] })
  const noteEntries = await fetchNoteEntries(cfg.noteSeite)

  const leafIds = leafIdsForRoot(allKats, cfg.rootName)

  const ist = new Map<string, number>()
  for (const e of asArray<IstEintrag>(istRaw)) {
    const k = leafKwKey(e.kategorie_id, e.kw_year, e.kw_number)
    ist.set(k, (ist.get(k) ?? 0) + Number(e.betrag))
  }

  const ber = new Map<string, number>()
  for (const e of asArray<BerEintrag>(berRaw)) {
    const k = leafKwKey(e.kategorie_id, e.kw_year, e.kw_number)
    ber.set(k, (ber.get(k) ?? 0) + Number(e.wert))
  }

  const futureSet = new Set(zWochen.map(kw => kwKey(kw.year, kw.week)))
  const manual = new Map<string, number>()
  for (const e of asArray<ManuellerEintrag>(valRaw)) {
    if (e.betrag_manuell === null) continue
    if (!futureSet.has(kwKey(e.kw_year, e.kw_number))) continue
    if (e.ist_berechnet === false) manual.set(leafKwKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag_manuell)
  }

  const soll = new Map<string, number>()
  const sollManual = new Set<string>()
  for (const leafId of leafIds) {
    for (const zw of zWochen) {
      const k = leafKwKey(leafId, zw.year, zw.week)
      if (manual.has(k)) { soll.set(k, manual.get(k)!); sollManual.add(k) }
      else if (ber.has(k)) { soll.set(k, ber.get(k)!) }
    }
  }

  const notes = new Map<string, string>()
  for (const n of noteEntries) addNote(notes, leafKwKey(n.first, n.year, n.week), n.text)

  return { leafIds, ist, soll, sollManual, notes, subLeavesByLeaf: new Map() }
}

// Produktinvestitionsausgaben — manual only, no berechnet
async function loadProduktinvest(allKats: KpiCategory[], vWochen: PlanungsWoche[], zWochen: PlanungsWoche[]): Promise<ModuleResult> {
  const istP = pastRangeParams(vWochen)
  const [valRaw, istRaw] = await Promise.all([
    fetchJson<unknown>('/api/produktinvestitions-planung', { data: [] }),
    istP ? fetchJson<unknown>(`/api/produktinvestitions-planung/ist-tatsaechlich${istP}`, { data: [] }) : Promise.resolve({ data: [] }),
  ])
  const noteEntries = await fetchNoteEntries('produktinvestitionsausgaben')
  const leafIds = leafIdsForRoot(allKats, 'produktinvestitionen')

  const ist = new Map<string, number>()
  for (const e of asArray<IstEintrag>(istRaw)) {
    const k = leafKwKey(e.kategorie_id, e.kw_year, e.kw_number)
    ist.set(k, (ist.get(k) ?? 0) + Number(e.betrag))
  }

  const futureSet = new Set(zWochen.map(kw => kwKey(kw.year, kw.week)))
  const soll = new Map<string, number>()
  const sollManual = new Set<string>()
  for (const e of asArray<ManuellerEintrag>(valRaw)) {
    if (e.betrag_manuell === null) continue
    if (!futureSet.has(kwKey(e.kw_year, e.kw_number))) continue
    const k = leafKwKey(e.kategorie_id, e.kw_year, e.kw_number)
    soll.set(k, e.betrag_manuell)
    sollManual.add(k)
  }

  const notes = new Map<string, string>()
  for (const n of noteEntries) addNote(notes, leafKwKey(n.first, n.year, n.week), n.text)

  return { leafIds, ist, soll, sollManual, notes, subLeavesByLeaf: new Map() }
}

// Umsatzausgaben — everything except the four own roots; values per (kat, produkt) → product sub-rows
async function loadUmsatzausgaben(allKats: KpiCategory[], produktNames: Map<string, string>, vWochen: PlanungsWoche[], zWochen: PlanungsWoche[]): Promise<ModuleResult> {
  const allWochen = [...vWochen, ...zWochen]
  const istP = pastRangeParams(vWochen)
  const berP = berRangeParams(allWochen, zWochen[0])

  const [istRaw, berRaw] = await Promise.all([
    istP ? fetchJson<unknown>(`/api/umsatzausgaben-planung/ist-tatsaechlich${istP}`, { data: [] }) : Promise.resolve({ data: [] }),
    berP ? fetchJson<unknown>(`/api/umsatzausgaben-planung/berechnet${berP}`, { data: [] }) : Promise.resolve({ data: [] }),
  ])
  const valRaw = await fetchJson<unknown>('/api/umsatzausgaben-planung', { data: [] })
  const noteEntries = await fetchNoteEntries('umsatzausgaben')

  const ownRootIds = new Set(allKats.filter(k => EIGENE_AUSGABEN_ROOTS.includes(k.name.trim().toLowerCase())).map(k => k.id))
  const level1 = allKats.filter(k => k.level === 1 && !ownRootIds.has(k.id))
  const leafIds = new Set<string>()
  for (const l1 of level1) {
    const children = allKats.filter(k => k.parent_id === l1.id)
    if (children.length > 0) children.forEach(c => leafIds.add(c.id))
    else leafIds.add(l1.id)
  }

  const ist = new Map<string, number>()
  const subProds = new Map<string, Set<string>>()   // leafId -> set of produktIds
  function noteSub(leafId: string, prodId: string) {
    if (!subProds.has(leafId)) subProds.set(leafId, new Set())
    subProds.get(leafId)!.add(prodId)
  }
  for (const e of asArray<IstEintrag>(istRaw)) {
    if (!leafIds.has(e.kategorie_id)) continue
    ist.set(leafKwKey(e.kategorie_id, e.kw_year, e.kw_number), (ist.get(leafKwKey(e.kategorie_id, e.kw_year, e.kw_number)) ?? 0) + Number(e.betrag))
    if (e.produkt_id) {
      const ck = leafKwKey(subId(e.kategorie_id, e.produkt_id), e.kw_year, e.kw_number)
      ist.set(ck, (ist.get(ck) ?? 0) + Number(e.betrag))
      noteSub(e.kategorie_id, e.produkt_id)
    }
  }

  const berProd = new Map<string, number>()
  const prodByKatKw = new Map<string, Set<string>>()
  function addProd(katId: string, prodId: string, y: number, w: number) {
    const lk = leafKwKey(katId, y, w)
    if (!prodByKatKw.has(lk)) prodByKatKw.set(lk, new Set())
    prodByKatKw.get(lk)!.add(prodId)
  }
  for (const e of asArray<BerEintrag>(berRaw)) {
    if (!leafIds.has(e.kategorie_id)) continue
    const prod = e.produkt_id ?? '∅'
    berProd.set(`${e.kategorie_id}:${prod}:${e.kw_year}:${e.kw_number}`, Number(e.wert))
    addProd(e.kategorie_id, prod, e.kw_year, e.kw_number)
    if (e.produkt_id) noteSub(e.kategorie_id, e.produkt_id)
  }

  const futureSet = new Set(zWochen.map(kw => kwKey(kw.year, kw.week)))
  const manProd = new Map<string, number>()
  const manKatKw = new Set<string>()
  const manProdKatKw = new Set<string>()   // composite leaf|kw with manual override at product level
  for (const e of asArray<ManuellerEintrag>(valRaw)) {
    if (e.betrag_manuell === null) continue
    if (!leafIds.has(e.kategorie_id)) continue
    if (!futureSet.has(kwKey(e.kw_year, e.kw_number))) continue
    if (e.ist_berechnet === false) {
      const prod = e.produkt_id ?? '∅'
      manProd.set(`${e.kategorie_id}:${prod}:${e.kw_year}:${e.kw_number}`, e.betrag_manuell)
      manKatKw.add(leafKwKey(e.kategorie_id, e.kw_year, e.kw_number))
      addProd(e.kategorie_id, prod, e.kw_year, e.kw_number)
      if (e.produkt_id) {
        noteSub(e.kategorie_id, e.produkt_id)
        manProdKatKw.add(leafKwKey(subId(e.kategorie_id, e.produkt_id), e.kw_year, e.kw_number))
      }
    }
  }

  const soll = new Map<string, number>()
  const sollManual = new Set<string>()
  for (const leafId of leafIds) {
    for (const zw of zWochen) {
      const lk = leafKwKey(leafId, zw.year, zw.week)
      const prods = prodByKatKw.get(lk)
      if (!prods) continue
      let sum = 0, any = false
      for (const prod of prods) {
        const pk = `${leafId}:${prod}:${zw.year}:${zw.week}`
        const v = manProd.has(pk) ? manProd.get(pk)! : berProd.get(pk)
        if (v !== undefined) {
          sum += v; any = true
          if (prod !== '∅') {
            const ck = leafKwKey(subId(leafId, prod), zw.year, zw.week)
            soll.set(ck, v)
            if (manProd.has(pk)) sollManual.add(ck)
          }
        }
      }
      if (any) soll.set(lk, sum)
      if (manKatKw.has(lk)) sollManual.add(lk)
    }
  }

  // product sub-rows per leaf (sorted by name)
  const subLeavesByLeaf = new Map<string, SubLeaf[]>()
  for (const [leafId, prodSet] of subProds) {
    const subs = [...prodSet]
      .map(pid => ({ id: subId(leafId, pid), name: produktNames.get(pid) ?? pid }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    if (subs.length > 0) subLeavesByLeaf.set(leafId, subs)
  }

  const notes = new Map<string, string>()
  for (const n of noteEntries) {
    if (n.mid) {
      // product-level note → ONLY on the product sub-row, never on the parent group
      addNote(notes, leafKwKey(subId(n.first, n.mid), n.year, n.week), n.text)
    } else {
      addNote(notes, leafKwKey(n.first, n.year, n.week), n.text)
    }
  }
  void manProdKatKw

  return { leafIds, ist, soll, sollManual, notes, subLeavesByLeaf }
}

// Einnahmen — Produktverkäufe Soll per platform → platform sub-rows
async function loadEinnahmen(allKats: KpiCategory[], plattformNames: Map<string, string>, vWochen: PlanungsWoche[], zWochen: PlanungsWoche[], vergangenheitsHorizont: number): Promise<ModuleResult> {
  const istP = pastRangeParams(vWochen)
  const [istRaw, pvRaw] = await Promise.all([
    istP ? fetchJson<unknown>(`/api/einnahmen-planung/ist-tatsaechlich${istP}`, []) : Promise.resolve([]),
    fetchJson<unknown>(`/api/einnahmen-planung/produktverkaeufe-berechnet?vergangenheit_horizont=${vergangenheitsHorizont}`, []),
  ])
  const valRaw = await fetchJson<unknown>('/api/einnahmen-planung', [])
  const noteEntries = await fetchNoteEntries('einnahmenplanung')

  const pvKat = allKats.find(k => k.level === 1 && istProduktverkaufe(k.name))
  const pvKatId = pvKat?.id ?? null
  const plattformIds = new Set(plattformNames.keys())

  const leafIds = new Set<string>()
  for (const l1 of allKats.filter(k => k.level === 1)) {
    const children = allKats.filter(k => k.parent_id === l1.id && k.level === 2)
    if (children.length > 0) children.forEach(c => leafIds.add(c.id))
    else leafIds.add(l1.id)
  }

  const ist = new Map<string, number>()
  for (const e of asArray<IstEintrag>(istRaw)) {
    ist.set(leafKwKey(e.kategorie_id, e.kw_year, e.kw_number), Number(e.betrag))
  }

  const allowedFuture = new Set(zWochen.map(kw => kwKey(kw.year, kw.week)))
  // produktverkaeufe Soll per platform per KW (auto-calculated)
  const pvByPltKw = new Map<string, number>()    // `${pltId}:${year}:${week}`
  const pvWeeksWithAuto = new Set<string>()       // `${year}:${week}` that have any auto pv
  for (const e of asArray<{ kw_year: number; kw_number: number; sales_plattform_id: string; wert: number }>(pvRaw)) {
    const kk = kwKey(e.kw_year, e.kw_number)
    if (!allowedFuture.has(kk)) continue
    pvByPltKw.set(`${e.sales_plattform_id}:${kk}`, (pvByPltKw.get(`${e.sales_plattform_id}:${kk}`) ?? 0) + Number(e.wert))
    pvWeeksWithAuto.add(kk)
  }

  // All saved einnahmen_planung values (future weeks). einnahmen_planung has NO
  // ist_berechnet flag — auto-saved Produktverkäufe values (total + per-platform,
  // stored with kategorie_id = platform id) carry a betrag_manuell and are
  // indistinguishable by column from manual entries.
  const savedMap = new Map<string, number>()
  for (const e of asArray<ManuellerEintrag>(valRaw)) {
    if (e.betrag_manuell === null) continue
    if (!allowedFuture.has(kwKey(e.kw_year, e.kw_number))) continue
    savedMap.set(leafKwKey(e.kategorie_id, e.kw_year, e.kw_number), e.betrag_manuell)
  }

  const soll = new Map<string, number>()
  const sollManual = new Set<string>()
  const pvPlatformsWithData = new Set<string>()

  for (const leafId of leafIds) {
    for (const zw of zWochen) {
      const lk = leafKwKey(leafId, zw.year, zw.week)
      if (leafId === pvKatId) {
        let sum = 0, any = false, anyManual = false
        for (const pltId of plattformIds) {
          const auto = pvByPltKw.get(`${pltId}:${kwKey(zw.year, zw.week)}`)
          const saved = savedMap.get(leafKwKey(pltId, zw.year, zw.week))
          let eff: number | undefined
          let manualFlag = false
          // Exactly like the Einnahmenplanung page: an auto value (from
          // produktverkaeufe-berechnet) is shown grey; a saved value in a week
          // WITHOUT an auto value is a genuine manual override shown blue.
          if (auto !== undefined) {
            eff = auto
          } else if (saved !== undefined) {
            eff = saved
            manualFlag = true
          }
          if (eff !== undefined) {
            sum += eff; any = true
            pvPlatformsWithData.add(pltId)
            const ck = leafKwKey(subId(pvKatId, pltId), zw.year, zw.week)
            soll.set(ck, eff)
            if (manualFlag) { sollManual.add(ck); anyManual = true }
          }
        }
        // Produktverkäufe total = sum of platform effectives (auto unless any platform overridden)
        if (any) { soll.set(lk, sum); if (anyManual) sollManual.add(lk) }
      } else {
        // non-Produktverkäufe einnahmen are always manual (no auto source) → blue
        const saved = savedMap.get(lk)
        if (saved !== undefined) { soll.set(lk, saved); sollManual.add(lk) }
      }
    }
  }
  void pvWeeksWithAuto

  // Show ALL platforms structurally under Produktverkäufe, exactly like the
  // Einnahmenplanung page (platforms appear whenever the category exists, even
  // when a given platform has no Soll value in the window).
  void pvPlatformsWithData
  const subLeavesByLeaf = new Map<string, SubLeaf[]>()
  if (pvKatId && plattformIds.size > 0) {
    const subs = [...plattformIds]
      .map(pid => ({ id: subId(pvKatId, pid), name: plattformNames.get(pid) ?? pid }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    subLeavesByLeaf.set(pvKatId, subs)
  }

  const notes = new Map<string, string>()
  for (const n of noteEntries) {
    if (pvKatId && plattformIds.has(n.first)) {
      // platform-level note → ONLY on the platform sub-row, never on Produktverkäufe
      addNote(notes, leafKwKey(subId(pvKatId, n.first), n.year, n.week), n.text)
    } else {
      addNote(notes, leafKwKey(n.first, n.year, n.week), n.text)
    }
  }

  return { leafIds, ist, soll, sollManual, notes, subLeavesByLeaf }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiquiditaetsauswertung(referenceDate?: Date) {
  const [granularitaet, setGranularitaet] = useState<AuswertungGranularitaet>('woche')
  const [vWochen, setVWochen] = useState<PlanungsWoche[]>([])
  const [zWochen, setZWochen] = useState<PlanungsWoche[]>([])
  const [einKats, setEinKats] = useState<KpiCategory[]>([])
  const [ausKats, setAusKats] = useState<KpiCategory[]>([])
  const [einData, setEinData] = useState<DataStore>(() => emptyStore(1))
  const [ausData, setAusData] = useState<DataStore>(() => emptyStore(-1))
  const [anfangsbestand, setAnfangsbestand] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const grund = await fetchJson<{ planungshorizont_wochen?: number; vergangenheitshorizont_wochen?: number }>(
          '/api/grundeinstellungen', {},
        )
        const planungsHorizont = grund?.planungshorizont_wochen ?? 13
        const vergangenheitsHorizont = grund?.vergangenheitshorizont_wochen ?? 13

        const v = berechneVergangenheitswochen(vergangenheitsHorizont, referenceDate)
        const z = berechneZukunftswochen(planungsHorizont, referenceDate)
        if (cancelled) return
        setVWochen(v)
        setZWochen(z)

        const [ausgabenKats, einnahmenKats, produkteKats, plattformenKats] = await Promise.all([
          fetchJson<KpiCategory[]>('/api/kpi-categories?type=ausgaben_kosten', []),
          fetchJson<KpiCategory[]>('/api/kpi-categories?type=einnahmen', []),
          fetchJson<KpiCategory[]>('/api/kpi-categories?type=produkte', []),
          fetchJson<KpiCategory[]>('/api/kpi-categories?type=sales_plattformen', []),
        ])
        const aus = Array.isArray(ausgabenKats) ? ausgabenKats : []
        const ein = Array.isArray(einnahmenKats) ? einnahmenKats : []
        const produktNames = new Map((Array.isArray(produkteKats) ? produkteKats : []).map(p => [p.id, p.name]))
        const plattformNames = new Map(
          (Array.isArray(plattformenKats) ? plattformenKats : []).filter(p => p.level === 1).map(p => [p.id, p.name]),
        )

        // Phase 1: all modules whose persisted Soll values feed the Umsatzsteuer
        // calculation. Their `berechnet` routes upsert fresh Soll into their planung
        // tables. We must let these finish BEFORE steuer runs, otherwise the steuer
        // berechnet would read partially-written tables (race) and produce a
        // different Umsatzsteuer than the Steuerausgaben page.
        const [einnahmen, umsatz, operativ, produktinvest, finanzierung, anfRaw] = await Promise.all([
          loadEinnahmen(ein, plattformNames, v, z, vergangenheitsHorizont),
          loadUmsatzausgaben(aus, produktNames, v, z),
          loadAusgabenModul({ endpoint: '/api/operative-planung', rootName: 'operativ', noteSeite: 'operative-ausgaben', hasBerechnet: true }, aus, v, z),
          loadProduktinvest(aus, v, z),
          loadAusgabenModul({ endpoint: '/api/finanzierungs-planung', rootName: 'finanzierung', noteSeite: 'finanzierungs-ausgaben', hasBerechnet: true }, aus, v, z),
          fetchJson<{ anfangsbestand?: number }>(
            v.length > 0 ? `/api/liquiditaetsauswertung/anfangsbestand?vor_jahr=${v[0].year}&vor_kw=${v[0].week}` : '/api/liquiditaetsauswertung/anfangsbestand',
            {},
          ),
        ])

        // Phase 2: steuer LAST — its berechnet reads the now freshly-persisted Soll
        // of einnahmen/umsatz/operative/finanzierung to compute Umsatzsteuer
        // (Zahllast − Vorsteuer), exactly like the Steuerausgaben page.
        const steuer = await loadAusgabenModul(
          { endpoint: '/api/steuerausgaben-planung', rootName: 'steuern', noteSeite: 'steuerausgaben', hasBerechnet: true }, aus, v, z,
        )

        if (cancelled) return

        const merged = emptyStore(-1)
        for (const m of [umsatz, operativ, produktinvest, finanzierung, steuer]) {
          for (const id of m.leafIds) merged.leafIds.add(id)
          for (const [k, val] of m.ist) merged.ist.set(k, val)
          for (const [k, val] of m.soll) merged.soll.set(k, val)
          for (const k of m.sollManual) merged.sollManual.add(k)
          for (const [k, t] of m.notes) addNote(merged.notes, k, t)
          for (const [leaf, subs] of m.subLeavesByLeaf) merged.subLeavesByLeaf.set(leaf, subs)
        }

        setEinKats(ein)
        setAusKats(aus)
        setEinData({ sign: 1, ...einnahmen })
        setAusData(merged)
        setAnfangsbestand(Number(anfRaw?.anfangsbestand ?? 0))
      } catch {
        if (!cancelled) setError('Fehler beim Laden der Liquiditätsauswertung.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [referenceDate])

  // ─── Build view model ──────────────────────────────────────────────────────

  const viewModel = useMemo<AuswertungViewModel>(() => {
    interface BaseCol { key: string; label: string; isPast: boolean; kw: PlanungsWoche; monthKey: string; monthLabel: string }
    const baseCols: BaseCol[] = []
    for (const kw of vWochen) {
      const m = monthKeyOf(kw)
      baseCols.push({ key: `p-${kw.year}-${kw.week}`, label: kw.label, isPast: true, kw, monthKey: m.key, monthLabel: m.label })
    }
    for (const kw of zWochen) {
      const m = monthKeyOf(kw)
      baseCols.push({ key: `f-${kw.year}-${kw.week}`, label: kw.label, isPast: false, kw, monthKey: m.key, monthLabel: m.label })
    }

    const columns: AuswertungColumn[] = []
    const colKws: Record<string, { kws: PlanungsWoche[]; isPast: boolean }> = {}
    if (granularitaet === 'woche') {
      for (const b of baseCols) {
        columns.push({ key: b.key, label: b.label, subLabel: b.isPast ? 'Ist' : 'Soll', isPast: b.isPast, isFirstSoll: false, monthLabel: b.monthLabel })
        colKws[b.key] = { kws: [b.kw], isPast: b.isPast }
      }
    } else {
      for (const b of baseCols) {
        const ckey = `${b.isPast ? 'p' : 'f'}-${b.monthKey}`
        if (!colKws[ckey]) {
          colKws[ckey] = { kws: [], isPast: b.isPast }
          columns.push({ key: ckey, label: b.monthLabel, subLabel: b.isPast ? 'Ist' : 'Soll', isPast: b.isPast, isFirstSoll: false, monthLabel: b.monthLabel })
        }
        colKws[ckey].kws.push(b.kw)
      }
    }
    const firstSoll = columns.find(c => !c.isPast)
    if (firstSoll) firstSoll.isFirstSoll = true

    const rows: AuswertungRow[] = []
    const expandableKeys: string[] = []
    if (vWochen.length === 0 && zWochen.length === 0) {
      return { columns, rows, expandableKeys }
    }

    type Getter = (col: AuswertungColumn) => AuswertungCell

    function leafCell(data: DataStore, id: string, col: AuswertungColumn): AuswertungCell {
      const { kws } = colKws[col.key]
      let sum = 0, any = false, blue = false, gray = false, hasNote = false
      const noteParts: string[] = []
      for (const kw of kws) {
        const lk = leafKwKey(id, kw.year, kw.week)
        const raw = col.isPast ? data.ist.get(lk) : data.soll.get(lk)
        if (raw !== undefined) {
          sum += raw; any = true
          if (!col.isPast) { if (data.sollManual.has(lk)) blue = true; else gray = true }
        }
        const note = data.notes.get(lk)
        if (note) { hasNote = true; noteParts.push(note) }
      }
      return {
        value: any ? sum * data.sign : null,
        indicator: col.isPast ? null : (blue ? 'blue' : gray ? 'gray' : null),
        hasNote,
        noteText: noteParts.length > 0 ? noteParts.join('\n') : null,
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

    // recursive hierarchy over the KPI tree
    function buildNode(
      node: KpiCategory,
      allKats: KpiCategory[],
      data: DataStore,
      depth: number,
      ancestors: string[],
      sectionKey: string,
    ): { rows: AuswertungRow[]; getters: Getter[] } {
      const children = allKats.filter(k => k.parent_id === node.id).sort((a, b) => a.sort_order - b.sort_order)
      const isLeaf = data.leafIds.has(node.id) || children.length === 0

      if (isLeaf) {
        const leafGetter: Getter = col => leafCell(data, node.id, col)
        // product/platform sub-rows (the loader already decides which to include:
        // products are data-driven, platforms are structural like the source page)
        const subs = data.subLeavesByLeaf.get(node.id) ?? []
        if (!hasAny(leafGetter) && subs.length === 0) return { rows: [], getters: [] }

        if (subs.length > 0) {
          const groupKey = `${sectionKey}:${node.id}`
          const childAncestors = [...ancestors, groupKey]
          expandableKeys.push(groupKey)
          // This node aggregates its product/platform sub-rows → show the summed value
          // but NO indicator dot and NO note (both are maintained on the sub-rows).
          const aggGetter: Getter = col => {
            const c = leafGetter(col)
            return { value: c.value, indicator: null, hasNote: false, noteText: null }
          }
          const header: AuswertungRow = {
            id: `leaf-${sectionKey}-${node.id}`,
            kind: depth === 1 ? 'kategorie' : depth === 2 ? 'gruppe' : 'leaf',
            label: node.name,
            indent: depth,
            expandable: true,
            groupKey,
            ancestorGroupKeys: ancestors,
            cells: cellsFor(aggGetter),
          }
          const subRows: AuswertungRow[] = subs.map(s => ({
            id: `sub-${sectionKey}-${s.id}`,
            kind: 'sub' as const,
            label: s.name,
            indent: depth + 1,
            expandable: false,
            ancestorGroupKeys: childAncestors,
            cells: cellsFor(col => leafCell(data, s.id, col)),
          }))
          return { rows: [header, ...subRows], getters: [leafGetter] }
        }

        return {
          rows: [{
            id: `leaf-${sectionKey}-${node.id}`,
            kind: depth === 1 ? 'kategorie' : depth === 2 ? 'gruppe' : 'leaf',
            label: node.name,
            indent: depth,
            expandable: false,
            ancestorGroupKeys: ancestors,
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
        label: node.name,
        indent: depth,
        expandable: true,
        groupKey,
        ancestorGroupKeys: ancestors,
        cells: cellsFor(sumGetter(getters)),
      }
      return { rows: [header, ...childRows], getters }
    }

    function buildSection(allKats: KpiCategory[], data: DataStore, sectionKey: string): Getter[] {
      const roots = allKats.filter(k => k.level === 1).sort((a, b) => a.sort_order - b.sort_order)
      const all: Getter[] = []
      for (const root of roots) {
        const r = buildNode(root, allKats, data, 1, [], sectionKey)
        rows.push(...r.rows)
        all.push(...r.getters)
      }
      return all
    }

    rows.push({ id: 'section-einnahmen', kind: 'section', label: 'EINNAHMEN', indent: 0, expandable: false, ancestorGroupKeys: [], cells: {} })
    const einGetters = buildSection(einKats, einData, 'ein')
    rows.push({ id: 'gesamt-einnahmen', kind: 'gesamt-einnahmen', label: 'Gesamt Einnahmen', indent: 0, expandable: false, ancestorGroupKeys: [], cells: cellsFor(sumGetter(einGetters)) })

    rows.push({ id: 'section-ausgaben', kind: 'section', label: 'AUSGABEN', indent: 0, expandable: false, ancestorGroupKeys: [], cells: {} })
    const ausGetters = buildSection(ausKats, ausData, 'aus')
    rows.push({ id: 'gesamt-ausgaben', kind: 'gesamt-ausgaben', label: 'Gesamt Ausgaben', indent: 0, expandable: false, ancestorGroupKeys: [], cells: cellsFor(sumGetter(ausGetters)) })

    const einSum = sumGetter(einGetters)
    const ausSum = sumGetter(ausGetters)
    const cashflowCells: Record<string, AuswertungCell> = {}
    const kontostandCells: Record<string, AuswertungCell> = {}
    let kumuliert = anfangsbestand
    for (const col of columns) {
      const cf = (einSum(col).value ?? 0) + (ausSum(col).value ?? 0)
      kumuliert += cf
      cashflowCells[col.key] = { value: cf, indicator: null, hasNote: false, noteText: null }
      kontostandCells[col.key] = { value: kumuliert, indicator: null, hasNote: false, noteText: null }
    }
    rows.push({ id: 'cashflow', kind: 'cashflow', label: 'Cashflow der Periode', indent: 0, expandable: false, ancestorGroupKeys: [], cells: cashflowCells })
    rows.push({ id: 'kontostand', kind: 'kontostand', label: 'Kontostand', indent: 0, expandable: false, ancestorGroupKeys: [], cells: kontostandCells })

    return { columns, rows, expandableKeys }
  }, [granularitaet, vWochen, zWochen, einKats, ausKats, einData, ausData, anfangsbestand])

  const isEmpty = !loading && !error && einData.leafIds.size === 0 && ausData.leafIds.size === 0

  return {
    granularitaet,
    setGranularitaet,
    vWochen,
    zWochen,
    loading,
    error,
    isEmpty,
    ...viewModel,
  }
}
