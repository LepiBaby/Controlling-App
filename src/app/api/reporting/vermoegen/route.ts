import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function safeDiv(num: number, den: number): number | null {
  if (den === 0) return null
  return r2(num / den)
}

// Returns the 3 calendar months immediately before the snapshot month
// e.g. datum = "2026-05-15" → ["2026-02", "2026-03", "2026-04"]
function prev3Months(datum: string): string[] {
  const [y, m] = datum.slice(0, 7).split('-').map(Number)
  return [3, 2, 1].map((offset) => {
    let mm = m - offset
    let yy = y
    if (mm <= 0) { mm += 12; yy-- }
    return `${yy}-${String(mm).padStart(2, '0')}`
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Snapshot = {
  id: string
  datum: string
  verbindlichkeiten_llv: number
  verbindlichkeiten_sonstige: number
  darlehensvb: number
  cash_bestand: number
  anlagevermoegen: number
  lagerwerte: { produkt_id: string | null; lagerwert: number }[]
  transitwerte: { produkt_id: string | null; transitwert: number }[]
  forderungen: { plattform_id: string | null; betrag: number }[]
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const [
    { data: snapshots,     error: snapErr  },
    { data: produkte,      error: prdErr   },
    { data: skus,          error: skuErr   },
    { data: allBestand,    error: bestErr  },
    { data: allPkZraeume,  error: pkzErr   },
    { data: allPkWerte,    error: pkwErr   },
  ] = await Promise.all([
    supabase
      .from('vermoegenswarte_snapshots')
      .select(`
        id, datum,
        verbindlichkeiten_llv, verbindlichkeiten_sonstige,
        darlehensvb, cash_bestand, anlagevermoegen,
        lagerwerte:vermoegenswarte_lagerwerte(produkt_id, lagerwert),
        transitwerte:vermoegenswarte_transitwerte(produkt_id, transitwert),
        forderungen:vermoegenswarte_forderungen(plattform_id, betrag)
      `)
      .order('datum', { ascending: false })
      .limit(1000),

    supabase
      .from('kpi_categories')
      .select('id')
      .eq('type', 'produkte')
      .eq('level', 1)
      .limit(200),

    supabase
      .from('kpi_categories')
      .select('id, parent_id')
      .eq('type', 'produkte')
      .neq('level', 1)
      .limit(2000),

    supabase
      .from('bestand_transaktionen')
      .select('sku_id, datum, sendungen_manuell, sendungen:bestand_sendungen(menge)')
      .limit(10000),

    supabase
      .from('produktkosten_zeitraeume')
      .select('id, produkt_id, gueltig_von, gueltig_bis')
      .limit(1000),

    supabase
      .from('produktkosten_werte')
      .select('zeitraum_id, wert')
      .limit(10000),
  ])

  if (snapErr)  return NextResponse.json({ error: snapErr.message  }, { status: 500 })
  if (prdErr)   return NextResponse.json({ error: prdErr.message   }, { status: 500 })
  if (skuErr)   return NextResponse.json({ error: skuErr.message   }, { status: 500 })
  if (bestErr)  return NextResponse.json({ error: bestErr.message  }, { status: 500 })
  if (pkzErr)   return NextResponse.json({ error: pkzErr.message   }, { status: 500 })
  if (pkwErr)   return NextResponse.json({ error: pkwErr.message   }, { status: 500 })

  if (!snapshots || snapshots.length === 0) {
    return NextResponse.json({ latest: null, series: [] })
  }

  // ── SKU → Produkt mapping ────────────────────────────────────────────────────

  const produktIds = new Set((produkte ?? []).map((p) => p.id))
  const skuById = new Map((skus ?? []).map((s) => [s.id, s]))

  function findProduktId(skuId: string): string | null {
    const sku = skuById.get(skuId)
    if (!sku) return null
    if (sku.parent_id && produktIds.has(sku.parent_id)) return sku.parent_id
    if (sku.parent_id) {
      const parent = skuById.get(sku.parent_id)
      if (parent?.parent_id && produktIds.has(parent.parent_id)) return parent.parent_id
    }
    return null
  }

  // ── Sendungen per Produkt per Kalendermonat ──────────────────────────────────
  // Map: produkt_id → month (YYYY-MM) → total sendungen (Stück)

  const sendungenByProduktMonth = new Map<string, Map<string, number>>()

  for (const bt of allBestand ?? []) {
    const produktId = findProduktId(bt.sku_id)
    if (!produktId) continue
    const month = (bt.datum as string).slice(0, 7)
    const plattformSendungen = (bt.sendungen ?? []).reduce(
      (s: number, snd: { menge: number }) => s + (snd.menge ?? 0), 0
    )
    const total = plattformSendungen + (bt.sendungen_manuell ?? 0)
    if (!sendungenByProduktMonth.has(produktId)) {
      sendungenByProduktMonth.set(produktId, new Map())
    }
    const monthMap = sendungenByProduktMonth.get(produktId)!
    monthMap.set(month, (monthMap.get(month) ?? 0) + total)
  }

  // ── Produktkosten per Produkt per Datum ──────────────────────────────────────

  const pkWertByZeitraum = new Map<string, number>()
  for (const pw of allPkWerte ?? []) {
    pkWertByZeitraum.set(pw.zeitraum_id, (pkWertByZeitraum.get(pw.zeitraum_id) ?? 0) + pw.wert)
  }

  function getProduktkosten(produktId: string, datum: string): number {
    for (const pz of allPkZraeume ?? []) {
      if (pz.produkt_id !== produktId) continue
      if (pz.gueltig_von > datum) continue
      if (pz.gueltig_bis && pz.gueltig_bis < datum) continue
      return pkWertByZeitraum.get(pz.id) ?? 0
    }
    return 0
  }

  function getAvgMonatssendungen(produktId: string, datum: string): number {
    const months = prev3Months(datum)
    const monthMap = sendungenByProduktMonth.get(produktId)
    if (!monthMap) return 0
    const total = months.reduce((s, mo) => s + (monthMap.get(mo) ?? 0), 0)
    return total / 3
  }

  // ── KPIs pro Snapshot berechnen ───────────────────────────────────────────────

  const series = (snapshots as Snapshot[]).map((snap) => {
    // Basisgrößen
    const lager = r2((snap.lagerwerte ?? []).reduce((s, lw) => s + Number(lw.lagerwert), 0))
    const transit = r2((snap.transitwerte ?? []).reduce((s, tw) => s + Number(tw.transitwert), 0))
    const warenkapital = r2(lager + transit)
    const gesamt_forderungen = r2((snap.forderungen ?? []).reduce((s, f) => s + Number(f.betrag), 0))
    const verb_ll = Number(snap.verbindlichkeiten_llv)
    const verb_sonstige = Number(snap.verbindlichkeiten_sonstige)
    const darlehen = Number(snap.darlehensvb)
    const cash = Number(snap.cash_bestand)
    const anlagevermoegen = Number(snap.anlagevermoegen)

    // Lagerreichweite: Warenkapital / Σ(Ø-Monatssendungen × Produktkosten)
    let lrNenner = 0
    for (const produktId of produktIds) {
      const kosten = getProduktkosten(produktId, snap.datum)
      if (kosten <= 0) continue
      const avgSendungen = getAvgMonatssendungen(produktId, snap.datum)
      lrNenner = r2(lrNenner + avgSendungen * kosten)
    }

    // Waren-KPIs
    const lager_anteil = warenkapital === 0 ? null : safeDiv(lager, warenkapital)
    const warenkapitalbindung = r2(warenkapital - verb_ll)
    const wqNenner = r2(warenkapital + gesamt_forderungen + cash - verb_ll - verb_sonstige)
    const warenbindungsquote = wqNenner === 0 ? null : safeDiv(warenkapitalbindung, wqNenner)
    const lagerreichweite = lrNenner === 0 ? null : safeDiv(warenkapital, lrNenner)

    // Liquiditäts-KPIs
    const working_capital = r2(warenkapital + cash + gesamt_forderungen - verb_ll - verb_sonstige)
    const liqNenner = r2(verb_ll + verb_sonstige)
    const cash_ratio = safeDiv(cash, liqNenner)
    const quick_ratio = safeDiv(r2(cash + gesamt_forderungen), liqNenner)
    const current_ratio = safeDiv(r2(cash + gesamt_forderungen + warenkapital), liqNenner)

    // Vermögens-KPIs
    const eigenkapital = r2(warenkapital + gesamt_forderungen + cash + anlagevermoegen)
    const fremdkapital = r2(verb_ll + verb_sonstige + darlehen)
    const gesamtvermoegen = r2(eigenkapital + fremdkapital)
    const ek_quote = safeDiv(eigenkapital, gesamtvermoegen)
    const fk_quote = safeDiv(fremdkapital, gesamtvermoegen)
    const cash_quote = safeDiv(cash, gesamtvermoegen)

    return {
      datum: snap.datum,
      lager, transit, warenkapital, gesamt_forderungen,
      verb_ll, verb_sonstige, darlehen, cash, anlagevermoegen,
      lager_anteil, warenkapitalbindung, warenbindungsquote, lagerreichweite,
      working_capital, cash_ratio, quick_ratio, current_ratio,
      eigenkapital, fremdkapital, gesamtvermoegen, ek_quote, fk_quote, cash_quote,
    }
  })

  // Aufsteigend für Charts (neuester = letztes Element)
  const seriesAsc = [...series].sort((a, b) => a.datum.localeCompare(b.datum))
  const latest = seriesAsc.length > 0 ? seriesAsc[seriesAsc.length - 1] : null

  return NextResponse.json({ latest, series: seriesAsc })
}
