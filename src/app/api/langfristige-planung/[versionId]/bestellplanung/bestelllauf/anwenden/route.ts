import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
// Überspringt den in Next 16 instabilen Static-Path-Pass (Worker-Crash).
export const dynamic = 'force-dynamic'

// PROJ-86: Ergebnisse des Bestelllaufs anwenden — akzeptierte Änderungen an
// bestehenden Bestellungen übernehmen/löschen und neue Bestellungen anlegen.
//
// Body-Shape ist an die KURZFRISTIGE anwenden-Route angeglichen, damit das
// Frontend die kurzfristige Wizard-UI 1:1 wiederverwenden kann:
//   - `akzeptierte_aenderungen[*].neue_daten` mit Datumsfeldern, `container[]`
//     und `sku_mengen[].menge_praktisch` (Produktebene: genau 1 Eintrag).
//     Fehlt `neue_daten` → die Bestellung wird gelöscht (kein_bedarf).
//   - `neue_planbestellungen[*]` mit `temp_id`, `produkt_ids`, Datumsfeldern,
//     `container[]` und `sku_mengen[0].menge_praktisch`.
// Rückgabe: `tempToReal` (temp_id → neue echte ID), damit das Frontend die
// Konsolidierungs-Speicherung referenzieren kann.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateOrNull = z.string().regex(DATE_RE).nullable().optional()
const containerArr = z.array(z.enum(['20DC', '40HQ'])).optional()

const skuMengeNeuSchema = z.object({
  sku_id: z.string().uuid(),
  sku_name: z.string().optional(),
  menge_theoretisch: z.number().int().min(0).optional(),
  menge_nach_moq: z.number().int().min(0).optional(),
  menge_praktisch: z.number().int().min(0),
  begruendung_anpassung: z.string().optional().default(''),
  is_trigger: z.boolean().optional(),
})

const neuePlanbestellungSchema = z.object({
  temp_id: z.string().min(1),
  produkt_ids: z.array(z.string().uuid()).min(1),
  produkt_namen: z.array(z.string()).optional(),
  bestelldatum: dateOrNull,
  produktionsstart_datum: dateOrNull,
  produktionsende_datum: dateOrNull,
  shippingdatum: dateOrNull,
  ankunftsdatum: dateOrNull,
  verfuegbarkeitsdatum: dateOrNull,
  sku_mengen: z.array(skuMengeNeuSchema).min(1),
  warnungen: z.array(z.string()).optional(),
  container: containerArr,
  konsolidiert_mit_temp_ids: z.array(z.string()).optional().default([]),
})

const neueDatenSchema = z
  .object({
    bestelldatum: z.string().regex(DATE_RE).optional(),
    produktionsstart_datum: z.string().regex(DATE_RE).optional(),
    produktionsende_datum: z.string().regex(DATE_RE).optional(),
    shippingdatum: z.string().regex(DATE_RE).optional(),
    ankunftsdatum: z.string().regex(DATE_RE).optional(),
    verfuegbarkeitsdatum: z.string().regex(DATE_RE).optional(),
    container: containerArr,
    sku_mengen: z
      .array(
        z.object({
          sku_id: z.string().uuid(),
          menge_theoretisch: z.number().int().min(0).optional(),
          menge_nach_moq: z.number().int().min(0).optional(),
          menge_praktisch: z.number().int().min(0),
          begruendung_anpassung: z.string().optional().default(''),
        }),
      )
      .optional(),
  })
  .optional()

const akzeptierteAenderungSchema = z.object({
  bestellung_id: z.string().uuid(),
  // `kein_bedarf` (fehlende neue_daten ODER explizites Flag) → löschen.
  loeschen: z.boolean().optional(),
  aenderungsart: z
    .enum(['bestelldatum', 'menge', 'bestelldatum_und_menge', 'keine_aenderung', 'kein_bedarf', 'konsolidierung'])
    .optional(),
  neue_daten: neueDatenSchema,
})

const BodySchema = z.object({
  akzeptierte_aenderungen: z.array(akzeptierteAenderungSchema).max(2000).optional().default([]),
  // Akzeptiert sowohl `neue_planbestellungen` (kurzfristiges Shape) als auch das
  // frühere `neue_bestellungen` zur Rückwärtskompatibilität.
  neue_planbestellungen: z.array(neuePlanbestellungSchema).max(2000).optional(),
  neue_bestellungen: z.array(neuePlanbestellungSchema).max(2000).optional(),
})

function containerCounts(container: Array<'20DC' | '40HQ'> | undefined): {
  anzahl_20dc: number
  anzahl_40hq: number
} {
  const arr = container ?? []
  return {
    anzahl_20dc: arr.filter((c) => c === '20DC').length,
    anzahl_40hq: arr.filter((c) => c === '40HQ').length,
  }
}

interface RouteContext {
  params: Promise<{ versionId: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { versionId } = await params
  const versionError = await ensureLangfristigeVersion(supabase, user!.id, versionId)
  if (versionError) return versionError

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { akzeptierte_aenderungen } = parsed.data
  const neue = parsed.data.neue_planbestellungen ?? parsed.data.neue_bestellungen ?? []
  const now = new Date().toISOString()

  // Bestehende ALGORITHMUS-Bestellungen werden komplett ersetzt (neu kalkuliert):
  // erst alle löschen, dann die ausgewählten neu kalkulierten anlegen. Manuell
  // angelegte (laufende) Bestellungen bleiben unangetastet.
  const { error: clearErr } = await supabase
    .from('langfristige_bestellungen')
    .delete()
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .eq('herkunft', 'algorithmus')
  if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 })

  // 1. Akzeptierte Änderungen anwenden (in der LP idR leer — bestehende Bestellungen
  //    werden ignoriert/ersetzt; der Block bleibt für Rückwärtskompatibilität).
  for (const aend of akzeptierte_aenderungen) {
    const istLoeschen = aend.loeschen === true || aend.aenderungsart === 'kein_bedarf' || !aend.neue_daten

    if (istLoeschen) {
      const { error: delErr } = await supabase
        .from('langfristige_bestellungen')
        .delete()
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .eq('id', aend.bestellung_id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
      continue
    }

    const nd = aend.neue_daten!
    const patch: Record<string, unknown> = { updated_at: now, manuell_geaendert: false }
    const dateFields = [
      'bestelldatum',
      'produktionsstart_datum',
      'produktionsende_datum',
      'shippingdatum',
      'ankunftsdatum',
      'verfuegbarkeitsdatum',
    ] as const
    for (const f of dateFields) {
      if (nd[f] !== undefined) patch[f] = nd[f]
    }
    if (nd.container !== undefined) {
      const { anzahl_20dc, anzahl_40hq } = containerCounts(nd.container)
      patch.anzahl_20dc = anzahl_20dc
      patch.anzahl_40hq = anzahl_40hq
    }
    // Produktebene: genau ein sku_mengen-Eintrag → praktische Menge der Bestellung.
    if (nd.sku_mengen && nd.sku_mengen.length > 0) {
      patch.menge_praktisch = nd.sku_mengen[0].menge_praktisch
      if (nd.sku_mengen[0].begruendung_anpassung) patch.begruendung = nd.sku_mengen[0].begruendung_anpassung
    }

    const { error: updErr } = await supabase
      .from('langfristige_bestellungen')
      .update(patch)
      .eq('user_id', user!.id)
      .eq('plan_version_id', versionId)
      .eq('id', aend.bestellung_id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // 2. Neue Bestellungen anlegen; temp_id → echte ID merken.
  const idByTemp = new Map<string, string>()
  for (const nb of neue) {
    const sm = nb.sku_mengen[0]
    const { anzahl_20dc, anzahl_40hq } = containerCounts(nb.container)
    const { data, error: insErr } = await supabase
      .from('langfristige_bestellungen')
      .insert({
        user_id: user!.id,
        plan_version_id: versionId,
        // Produktebene: genau ein Produkt je Bestellung.
        produkt_id: nb.produkt_ids[0],
        bestelldatum: nb.bestelldatum ?? null,
        produktionsstart_datum: nb.produktionsstart_datum ?? null,
        produktionsende_datum: nb.produktionsende_datum ?? null,
        shippingdatum: nb.shippingdatum ?? null,
        ankunftsdatum: nb.ankunftsdatum ?? null,
        verfuegbarkeitsdatum: nb.verfuegbarkeitsdatum ?? null,
        menge_theoretisch: sm.menge_theoretisch ?? null,
        menge_nach_moq: sm.menge_nach_moq ?? null,
        menge_praktisch: sm.menge_praktisch,
        begruendung: sm.begruendung_anpassung || null,
        herkunft: 'algorithmus',
        manuell_geaendert: false,
        anzahl_20dc,
        anzahl_40hq,
      })
      .select('id')
      .single()
    if (insErr || !data) {
      return NextResponse.json({ error: insErr?.message ?? 'Anlegen fehlgeschlagen' }, { status: 500 })
    }
    idByTemp.set(nb.temp_id, data.id)
  }

  // tempToReal-Map zurückgeben (für die anschließende Konsolidierungs-Speicherung).
  const tempToReal: Record<string, string> = {}
  for (const [t, r] of idByTemp) tempToReal[t] = r

  return NextResponse.json({ ok: true, angelegt: idByTemp.size, tempToReal })
}
