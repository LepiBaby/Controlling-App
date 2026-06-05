import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import type { PlanbestelllaufAenderung, NeuePlanbestellung } from '@/lib/planbestelllauf-algorithmus'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateOrNull = z.string().regex(DATE_RE).nullable().optional()

const skuMengeSchema = z.object({
  sku_id: z.string().uuid(),
  sku_name: z.string(),
  menge_theoretisch: z.number().int().min(0),
  menge_praktisch: z.number().int().min(0),
  begruendung_anpassung: z.string(),
})

const konsolidierungSchema = z.object({
  mit_temp_id: z.string().optional(),
  mit_bestellung_id: z.string().uuid().optional(),
  mit_produkt_namen: z.array(z.string()),
  containerart: z.string(),
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
  konsolidierungen: z.array(konsolidierungSchema),
  warnungen: z.array(z.string()),
})

const neueDatenSchema = z.object({
  bestelldatum: z.string().regex(DATE_RE).optional(),
  produktionsstart_datum: z.string().regex(DATE_RE).optional(),
  produktionsende_datum: z.string().regex(DATE_RE).optional(),
  shippingdatum: z.string().regex(DATE_RE).optional(),
  ankunftsdatum: z.string().regex(DATE_RE).optional(),
  verfuegbarkeitsdatum: z.string().regex(DATE_RE).optional(),
  sku_mengen: z.array(z.object({
    sku_id: z.string().uuid(),
    menge_praktisch: z.number().int().min(0),
    begruendung_anpassung: z.string(),
  })).optional(),
}).optional()

const aenderungSchema = z.object({
  bestellung_id: z.string().uuid(),
  produkt_namen: z.array(z.string()),
  aenderungsart: z.enum(['bestelldatum', 'menge', 'konsolidierung']),
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
    if (!nd) continue

    const dateUpdate: Record<string, string | null | undefined> = {}
    const dateFields = ['bestelldatum', 'produktionsstart_datum', 'produktionsende_datum', 'shippingdatum', 'ankunftsdatum', 'verfuegbarkeitsdatum'] as const
    for (const f of dateFields) {
      if (nd[f] !== undefined) dateUpdate[f] = nd[f]
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
        bestelldatum: nb.bestelldatum ?? null,
        produktionsstart_datum: nb.produktionsstart_datum ?? null,
        produktionsende_datum: nb.produktionsende_datum ?? null,
        shippingdatum: nb.shippingdatum ?? null,
        ankunftsdatum: nb.ankunftsdatum ?? null,
        verfuegbarkeitsdatum: nb.verfuegbarkeitsdatum ?? null,
        notizen: nb.warnungen.length > 0 ? nb.warnungen.join('\n') : null,
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
          menge_praktisch: sm.menge_praktisch,
          begruendung_anpassung: sm.begruendung_anpassung || null,
        }))
      )
    }
  }

  // ─── 3. Create konsolidierungen ──────────────────────────────────────────────
  for (const nb of neue_bestellungen as NeuePlanbestellung[]) {
    const myId = tempIdToRealId.get(nb.temp_id)
    if (!myId) continue

    for (const k of nb.konsolidierungen) {
      let otherId: string | undefined
      if (k.mit_temp_id) {
        otherId = tempIdToRealId.get(k.mit_temp_id)
      } else if (k.mit_bestellung_id) {
        otherId = k.mit_bestellung_id
      }
      if (!otherId) continue

      const [id1, id2] = [myId, otherId].sort()
      const containerart = (['20DC', '40DC', '40HQ'] as const).includes(k.containerart as '20DC' | '40DC' | '40HQ')
        ? k.containerart as '20DC' | '40DC' | '40HQ'
        : '20DC'

      await supabase.from('bestellungen_konsolidierungen').upsert({
        bestellung_id_1: id1,
        bestellung_id_2: id2,
        containerart,
        user_id: user!.id,
      }, { onConflict: 'bestellung_id_1,bestellung_id_2' })
    }
  }

  return NextResponse.json({ success: true, erstellt: tempIdToRealId.size })
}
