import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { ABSCHREIBUNG_MONATE, addMonthsWithClamp, roundTo2 } from '@/lib/abschreibung-utils'

export async function GET(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const datum = searchParams.get('datum')

  if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return NextResponse.json({ error: 'datum muss im Format YYYY-MM-DD vorliegen' }, { status: 400 })
  }

  const datumMonth = datum.slice(0, 7) // YYYY-MM

  // ── 1. Alle Daten parallel laden ─────────────────────────────────────────

  const [
    { data: produkte,           error: prdErr    },
    { data: skus,               error: skuErr    },
    { data: endbestandRows,     error: bestErr   },
    { data: allPkZeitraeume,    error: pkzErr    },
    { data: allPkWerte,         error: pkwErr    },
    { data: offeneAusgaben,     error: ausErr    },
    { data: ausgabenKats,       error: ausKatErr },
    { data: einnahmenRows,      error: einErr    },
    { data: ausgabenLiquidRows, error: ausLiqErr },
    { data: einnahmenKats,      error: einKatErr },
    { data: allAusgaben,        error: allAusErr },
  ] = await Promise.all([
    // Produkte Level 1
    supabase
      .from('kpi_categories')
      .select('id, name, sort_order')
      .eq('type', 'produkte')
      .eq('level', 1)
      .order('sort_order', { ascending: true }),

    // SKUs (Level 2+) für Bestand-Lookup
    supabase
      .from('kpi_categories')
      .select('id, parent_id, sku_code')
      .eq('type', 'produkte')
      .neq('level', 1),

    // Endbestand je SKU zum Stichtag — serverseitig per DISTINCT ON ueber die
    // jeweils neueste Bestand-Transaktion. Unabhaengig von der Gesamtzahl der
    // Transaktionen (kein 1000-Zeilen-Limit, das aeltere Bestaende einfrieren wuerde).
    supabase.rpc('lagerwert_endbestand_je_sku', { p_stichtag: datum }),

    // Produktkosten-Zeitraeume gültig am Stichtag
    supabase
      .from('produktkosten_zeitraeume')
      .select('id, produkt_id, gueltig_von, gueltig_bis')
      .lte('gueltig_von', datum)
      .or(`gueltig_bis.gte.${datum},gueltig_bis.is.null`),

    // Produktkosten-Werte für die oben gefundenen Zeiträume
    supabase
      .from('produktkosten_werte')
      .select('zeitraum_id, wert'),

    // Offene Ausgaben ohne Zahlungsdatum für Verbindlichkeiten
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('betrag_brutto, kategorie_id')
      .is('zahlungsdatum', null),

    // Ausgaben-Kategorien Level 1 (um "Produkt"- und "Tilgungen"-Kategorien zu identifizieren)
    supabase
      .from('kpi_categories')
      .select('id, name, parent_id, level')
      .eq('type', 'ausgaben_kosten'),

    // Einnahmen (Zahlungsdaten) für Cash-Bestand und Fremdkapital — alle bis Stichtag
    supabase
      .from('einnahmen_transaktionen')
      .select('zahlungsdatum, betrag, kategorie_id')
      .not('zahlungsdatum', 'is', null)
      .lte('zahlungsdatum', datum),

    // Ausgaben (Zahlungsdatum) für Cash-Bestand — alle bis Stichtag
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('zahlungsdatum, betrag_brutto')
      .not('zahlungsdatum', 'is', null)
      .in('relevanz', ['liquiditaet', 'beides'])
      .lte('zahlungsdatum', datum),

    // Einnahmen-Kategorien (für Fremdkapital-Lookup)
    supabase
      .from('kpi_categories')
      .select('id, name, parent_id, level')
      .eq('type', 'einnahmen'),

    // Alle Ausgaben (kein Datumsfilter — Tilgungen haben oft kein leistungsdatum;
    // alle drei Kategorie-Ebenen mitladen, da Tilgungen auf Level 2/3 liegen können)
    supabase
      .from('ausgaben_kosten_transaktionen')
      .select('betrag_netto, kategorie_id, gruppe_id, untergruppe_id, abschreibung, leistungsdatum'),
  ])

  if (prdErr)    return NextResponse.json({ error: prdErr.message    }, { status: 500 })
  if (skuErr)    return NextResponse.json({ error: skuErr.message    }, { status: 500 })
  if (bestErr)   return NextResponse.json({ error: bestErr.message   }, { status: 500 })
  if (pkzErr)    return NextResponse.json({ error: pkzErr.message    }, { status: 500 })
  if (pkwErr)    return NextResponse.json({ error: pkwErr.message    }, { status: 500 })
  if (ausErr)    return NextResponse.json({ error: ausErr.message    }, { status: 500 })
  if (ausKatErr) return NextResponse.json({ error: ausKatErr.message }, { status: 500 })
  if (einErr)    return NextResponse.json({ error: einErr.message    }, { status: 500 })
  if (ausLiqErr) return NextResponse.json({ error: ausLiqErr.message }, { status: 500 })
  if (einKatErr) return NextResponse.json({ error: einKatErr.message }, { status: 500 })
  if (allAusErr) return NextResponse.json({ error: allAusErr.message }, { status: 500 })

  // ── 2. Lagerwert je Produkt berechnen ────────────────────────────────────

  const skuById = new Map<string, { id: string; parent_id: string | null; sku_code: string | null }>(
    (skus ?? []).map((s) => [s.id, s])
  )
  const produktIds = new Set((produkte ?? []).map((p) => p.id))

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

  const endbestandByProdukt = new Map<string, number>()
  for (const row of (endbestandRows ?? []) as Array<{ sku_id: string; endbestand: number | string }>) {
    const produktId = findProduktId(row.sku_id)
    if (!produktId) continue
    endbestandByProdukt.set(produktId, (endbestandByProdukt.get(produktId) ?? 0) + Number(row.endbestand))
  }

  const pkWertByZeitraum = new Map<string, number>()
  for (const pw of allPkWerte ?? []) {
    pkWertByZeitraum.set(pw.zeitraum_id, (pkWertByZeitraum.get(pw.zeitraum_id) ?? 0) + pw.wert)
  }

  const produktkostenByProdukt = new Map<string, number>()
  for (const pz of allPkZeitraeume ?? []) {
    produktkostenByProdukt.set(pz.produkt_id, pkWertByZeitraum.get(pz.id) ?? 0)
  }

  const lagerwerte: Record<string, number> = {}
  for (const p of produkte ?? []) {
    const endbestand = endbestandByProdukt.get(p.id) ?? 0
    const kosten = produktkostenByProdukt.get(p.id) ?? 0
    lagerwerte[p.id] = roundTo2(endbestand * kosten)
  }

  // ── 3. Verbindlichkeiten berechnen ───────────────────────────────────────

  const ausgabenKatsAll = ausgabenKats ?? []
  const produktAusgabenKat = ausgabenKatsAll.find(
    (c) => c.level === 1 && c.name.toLowerCase() === 'produkt'
  )

  const produktAusgabenIds = new Set<string>()
  if (produktAusgabenKat) {
    produktAusgabenIds.add(produktAusgabenKat.id)
    let changed = true
    while (changed) {
      changed = false
      for (const c of ausgabenKatsAll) {
        if (c.parent_id && produktAusgabenIds.has(c.parent_id) && !produktAusgabenIds.has(c.id)) {
          produktAusgabenIds.add(c.id)
          changed = true
        }
      }
    }
  }

  let verbindlichkeiten_llv = 0
  let verbindlichkeiten_sonstige = 0
  for (const tx of offeneAusgaben ?? []) {
    const betrag = Number(tx.betrag_brutto)
    if (produktAusgabenIds.has(tx.kategorie_id)) {
      verbindlichkeiten_llv = roundTo2(verbindlichkeiten_llv + betrag)
    } else {
      verbindlichkeiten_sonstige = roundTo2(verbindlichkeiten_sonstige + betrag)
    }
  }

  // ── 4. Darlehensverbindlichkeiten berechnen ──────────────────────────────

  // Fremdkapital-Kategorien in Einnahmen finden (case-insensitive nach "fremdkapital")
  const einnahmenKatsAll = einnahmenKats ?? []
  const fremdkapitalIds = new Set<string>()
  for (const c of einnahmenKatsAll) {
    if (c.name.toLowerCase().includes('fremdkapital')) fremdkapitalIds.add(c.id)
  }
  // Alle Descendants der gefundenen Kategorien ebenfalls inkludieren
  let fkChanged = true
  while (fkChanged) {
    fkChanged = false
    for (const d of einnahmenKatsAll) {
      if (d.parent_id && fremdkapitalIds.has(d.parent_id) && !fremdkapitalIds.has(d.id)) {
        fremdkapitalIds.add(d.id)
        fkChanged = true
      }
    }
  }

  let darlehensvb_fremdkapital = 0
  for (const r of einnahmenRows ?? []) {
    if (r.kategorie_id && fremdkapitalIds.has(r.kategorie_id)) {
      darlehensvb_fremdkapital = roundTo2(darlehensvb_fremdkapital + Number(r.betrag))
    }
  }

  // Tilgungs-Kategorien in Ausgaben finden (case-insensitive nach "tilgung")
  const tilgungIds = new Set<string>()
  for (const c of ausgabenKatsAll) {
    if (c.name.toLowerCase().includes('tilgung')) tilgungIds.add(c.id)
  }
  // Alle Descendants der gefundenen Kategorien ebenfalls inkludieren
  let tilChanged = true
  while (tilChanged) {
    tilChanged = false
    for (const d of ausgabenKatsAll) {
      if (d.parent_id && tilgungIds.has(d.parent_id) && !tilgungIds.has(d.id)) {
        tilgungIds.add(d.id)
        tilChanged = true
      }
    }
  }

  let darlehensvb_tilgungen = 0
  for (const tx of allAusgaben ?? []) {
    const isTilgung =
      (tx.kategorie_id   && tilgungIds.has(tx.kategorie_id))   ||
      (tx.gruppe_id      && tilgungIds.has(tx.gruppe_id))      ||
      (tx.untergruppe_id && tilgungIds.has(tx.untergruppe_id))
    if (isTilgung) {
      darlehensvb_tilgungen = roundTo2(darlehensvb_tilgungen + Number(tx.betrag_netto))
    }
  }

  const darlehensvb = roundTo2(Math.max(0, darlehensvb_fremdkapital - darlehensvb_tilgungen))

  // ── 5. Anlagevermögen berechnen ──────────────────────────────────────────

  let anlagevermoegen = 0
  for (const tx of allAusgaben ?? []) {
    if (!tx.abschreibung || !tx.leistungsdatum) continue
    // Nur Anlagegüter berücksichtigen, die bis zum Stichtag angeschafft wurden
    if (tx.leistungsdatum > datum) continue
    const monate = ABSCHREIBUNG_MONATE[tx.abschreibung as string]
    if (!monate) continue
    const betragNetto = Number(tx.betrag_netto ?? 0)
    if (betragNetto === 0) continue

    // Bruttowert des Anlageguts addieren
    anlagevermoegen = roundTo2(anlagevermoegen + betragNetto)

    // Kumulierte Abschreibungen bis Stichtag abziehen (gleiche Logik wie abschreibungen-Route)
    const baseRate = roundTo2(betragNetto / monate)
    const lastRate = roundTo2(betragNetto - baseRate * (monate - 1))
    let accumulated = 0
    for (let i = 0; i < monate; i++) {
      const rateDatum = addMonthsWithClamp(tx.leistungsdatum, i)
      if (rateDatum > datum) break
      accumulated = roundTo2(accumulated + (i === monate - 1 ? lastRate : baseRate))
    }
    anlagevermoegen = roundTo2(anlagevermoegen - accumulated)
  }

  // ── 6. Cash-Bestand berechnen ─────────────────────────────────────────────

  let cash_bestand = 0
  for (const r of einnahmenRows ?? []) {
    cash_bestand = roundTo2(cash_bestand + Number(r.betrag))
  }
  for (const r of ausgabenLiquidRows ?? []) {
    cash_bestand = roundTo2(cash_bestand - Number(r.betrag_brutto))
  }

  return NextResponse.json({
    lagerwerte,
    verbindlichkeiten_llv,
    verbindlichkeiten_sonstige,
    darlehensvb,
    darlehensvb_fremdkapital,
    darlehensvb_tilgungen,
    anlagevermoegen,
    cash_bestand,
    datum,
    datumMonth,
  })
}
