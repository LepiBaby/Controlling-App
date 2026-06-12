import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import type { PlanbestelllaufAenderung, NeuePlanbestellung } from '@/lib/planbestelllauf-algorithmus'
import { generiereUndSpeichereBestellkosten } from '../../_utils'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateOrNull = z.string().regex(DATE_RE).nullable().optional()

const skuMengeSchema = z.object({
  sku_id: z.string().uuid(),
  sku_name: z.string(),
  menge_theoretisch: z.number().int().min(0),
  menge_nach_moq: z.number().int().min(0).optional(),
  menge_praktisch: z.number().int().min(0),
  begruendung_anpassung: z.string(),
  is_trigger: z.boolean().optional(),
})

const neuePlanbestellungSchema = z.object({
  temp_id: z.string(),
  produkt_ids: z.array(z.string().uuid()).min(1),
  produkt_namen: z.array(z.string()),
  bestelldatum: dateOrNull,
  produktionsstart_datum: dateOrNull,
  produktionsende_datum: dateOrNull,
  shippingdatum: dateOrNull,
  ankunftsdatum: dateOrNull,
  verfuegbarkeitsdatum: dateOrNull,
  sku_mengen: z.array(skuMengeSchema),
  warnungen: z.array(z.string()),
  container: z.array(z.enum(['20DC', '40HQ'])).optional(),
})

const neueDatenSchema = z.object({
  bestelldatum: z.string().regex(DATE_RE).optional(),
  produktionsstart_datum: z.string().regex(DATE_RE).optional(),
  produktionsende_datum: z.string().regex(DATE_RE).optional(),
  shippingdatum: z.string().regex(DATE_RE).optional(),
  ankunftsdatum: z.string().regex(DATE_RE).optional(),
  verfuegbarkeitsdatum: z.string().regex(DATE_RE).optional(),
  container: z.array(z.enum(['20DC', '40HQ'])).optional(),
  sku_mengen: z.array(z.object({
    sku_id: z.string().uuid(),
    menge_nach_moq: z.number().int().min(0).optional(),
    menge_praktisch: z.number().int().min(0),
    begruendung_anpassung: z.string(),
  })).optional(),
}).optional()

const aenderungSchema = z.object({
  bestellung_id: z.string().uuid(),
  produkt_namen: z.array(z.string()),
  aenderungsart: z.enum(['bestelldatum', 'menge', 'bestelldatum_und_menge', 'keine_aenderung', 'kein_bedarf', 'konsolidierung']),
  alt_wert: z.string(),
  neu_wert: z.string(),
  begruendung: z.string(),
  neue_daten: neueDatenSchema,
})

const bodySchema = z.object({
  akzeptierte_aenderungen: z.array(aenderungSchema),
  neue_bestellungen: z.array(neuePlanbestellungSchema),
})

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { akzeptierte_aenderungen, neue_bestellungen } = parsed.data
  const now = new Date().toISOString()

  // ─── 1. Apply accepted changes to existing plan orders ───────────────────────
  for (const aend of akzeptierte_aenderungen as PlanbestelllaufAenderung[]) {
    const nd = aend.neue_daten
    if (!nd) {
      // Kein Bedarf: Planbestellung löschen
      await supabase
        .from('bestellungen')
        .delete()
        .eq('id', aend.bestellung_id)
        .eq('user_id', user!.id)
        .eq('status', 'plan')
      continue
    }

    const dateUpdate: Record<string, string | number | null | undefined> = {}
    const dateFields = ['bestelldatum', 'produktionsstart_datum', 'produktionsende_datum', 'shippingdatum', 'ankunftsdatum', 'verfuegbarkeitsdatum'] as const
    for (const f of dateFields) {
      if (nd[f] !== undefined) dateUpdate[f] = nd[f]
    }
    if (nd.container !== undefined) {
      dateUpdate.anzahl_40hq = nd.container.filter(c => c === '40HQ').length
      dateUpdate.anzahl_20dc = nd.container.filter(c => c === '20DC').length
    }

    if (Object.keys(dateUpdate).length > 0) {
      await supabase
        .from('bestellungen')
        .update({ ...dateUpdate, updated_at: now })
        .eq('id', aend.bestellung_id)
        .eq('user_id', user!.id)
    }

    if (nd.sku_mengen?.length) {
      for (const sm of nd.sku_mengen) {
        await supabase.from('bestellungen_sku_mengen').upsert({
          bestellung_id: aend.bestellung_id,
          user_id: user!.id,
          sku_id: sm.sku_id,
          menge_nach_moq: sm.menge_nach_moq ?? null,
          menge_praktisch: sm.menge_praktisch,
          begruendung_anpassung: sm.begruendung_anpassung,
        }, { onConflict: 'bestellung_id,sku_id' })
      }
    }
  }

  // ─── 2. Create new plan orders ───────────────────────────────────────────────
  const tempIdToRealId = new Map<string, string>()

  for (const nb of neue_bestellungen as NeuePlanbestellung[]) {
    const { data: bestellung, error: insertErr } = await supabase
      .from('bestellungen')
      .insert({
        user_id: user!.id,
        status: 'plan',
        herkunft: 'algorithmus',
        containerart: null,
        anzahl_40hq: (nb.container ?? []).filter(c => c === '40HQ').length,
        anzahl_20dc: (nb.container ?? []).filter(c => c === '20DC').length,
        bestelldatum: nb.bestelldatum ?? null,
        produktionsstart_datum: nb.produktionsstart_datum ?? null,
        produktionsende_datum: nb.produktionsende_datum ?? null,
        shippingdatum: nb.shippingdatum ?? null,
        ankunftsdatum: nb.ankunftsdatum ?? null,
        verfuegbarkeitsdatum: nb.verfuegbarkeitsdatum ?? null,
        notizen: null,
      })
      .select('id')
      .single()

    if (insertErr || !bestellung) continue

    const bid = bestellung.id
    tempIdToRealId.set(nb.temp_id, bid)

    if (nb.produkt_ids.length > 0) {
      await supabase.from('bestellungen_produkte').insert(
        nb.produkt_ids.map(pid => ({ bestellung_id: bid, produkt_id: pid, user_id: user!.id }))
      )
    }

    if (nb.sku_mengen.length > 0) {
      await supabase.from('bestellungen_sku_mengen').insert(
        nb.sku_mengen.map(sm => ({
          bestellung_id: bid,
          user_id: user!.id,
          sku_id: sm.sku_id,
          menge_theoretisch: sm.menge_theoretisch,
          menge_nach_moq: sm.menge_nach_moq ?? null,
          menge_praktisch: sm.menge_praktisch,
          begruendung_anpassung: sm.begruendung_anpassung || null,
          is_trigger: sm.is_trigger ?? false,
        }))
      )
    }
  }

  // Auto-generate Bestellkosten for all newly created plan orders
  if (tempIdToRealId.size > 0) {
    const neueBestellungenFuerKosten = (neue_bestellungen as NeuePlanbestellung[])
      .filter(nb => tempIdToRealId.has(nb.temp_id))
      .map(nb => ({
        id: tempIdToRealId.get(nb.temp_id)!,
        bestelldatum: nb.bestelldatum ?? null,
        produktionsende_datum: nb.produktionsende_datum ?? null,
        shippingdatum: nb.shippingdatum ?? null,
        ankunftsdatum: nb.ankunftsdatum ?? null,
        verfuegbarkeitsdatum: nb.verfuegbarkeitsdatum ?? null,
        anzahl_40hq: (nb.container ?? []).filter(c => c === '40HQ').length,
        anzahl_20dc: (nb.container ?? []).filter(c => c === '20DC').length,
        produkt_ids: nb.produkt_ids,
        sku_mengen: nb.sku_mengen.map(sm => ({ sku_id: sm.sku_id, menge_praktisch: sm.menge_praktisch })),
      }))

    await generiereUndSpeichereBestellkosten(supabase, user!.id, neueBestellungenFuerKosten)
  }

  // Return temp_id → real_id map so the frontend can reference created orders for consolidation
  const idMap: Record<string, string> = {}
  for (const [tempId, realId] of tempIdToRealId) {
    idMap[tempId] = realId
  }

  return NextResponse.json(idMap)
}
