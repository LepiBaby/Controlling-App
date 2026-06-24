import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'
import { ensureLangfristigeVersion } from '@/lib/langfristige-version'

// Auth-geschützte, pro-Planversion dynamische Route — nie statisch generieren.
export const dynamic = 'force-dynamic'

// PROJ-86: Konsolidierung persistieren (versionsgebunden, Produktebene).
//
// Request-Form ist an die KURZFRISTIGE `konsolidieren`-Request angeglichen:
//   {
//     bestellung_ids: string[]                         // alle Gruppen-Mitglieder (≥ 2)
//     aenderungen: [{
//       bestellung_id, neue_daten{dates}, neue_sku_mengen[{sku_id, menge_praktisch, begruendung_anpassung}],
//       container_anteil: Record<string, number>,      // entgegengenommen; aktuell nicht persistiert (kein Spalten-Zwang)
//       snapshot_vor_konsolidierung: {...}             // entgegengenommen; aktuell nicht persistiert
//     }]
//   }
//
// Persistenz (mit bestehendem Schema, ohne Migration):
//   - Pro `aenderung`: Datums-/Mengen-/Container-Werte direkt auf der
//     `langfristige_bestellungen`-Zeile aktualisieren (Produktebene: genau ein
//     sku_mengen-Eintrag → menge_praktisch).
//   - Gruppen-Mitglieder paarweise (b1 < b2) in
//     `langfristige_bestellungen_konsolidierungen` speichern (containerart abgeleitet).
// Es gibt in der LP keine echte Gruppen-id-Spalte; eine Gruppe wird über die
// paarweisen Verknüpfungen repräsentiert (Aufheben siehe DELETE-Endpunkt).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateOrNull = z.string().regex(DATE_RE).nullable().optional()

const aenderungSchema = z.object({
  bestellung_id: z.string().uuid(),
  neue_daten: z
    .object({
      bestelldatum: dateOrNull,
      produktionsstart_datum: dateOrNull,
      produktionsende_datum: dateOrNull,
      shippingdatum: dateOrNull,
      ankunftsdatum: dateOrNull,
      verfuegbarkeitsdatum: dateOrNull,
    })
    .optional(),
  neue_sku_mengen: z
    .array(
      z.object({
        sku_id: z.string().uuid(),
        menge_praktisch: z.number().int().min(0),
        begruendung_anpassung: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),
  // container_anteil + snapshot werden entgegengenommen (kurzfristiges Shape),
  // aber im LP-Schema nicht persistiert (kein Status/Snapshot-Zwang).
  container_anteil: z.record(z.string(), z.number()).optional(),
  snapshot_vor_konsolidierung: z.unknown().optional(),
})

const PostSchema = z.object({
  bestellung_ids: z.array(z.string().uuid()).min(2),
  aenderungen: z.array(aenderungSchema).min(1),
})

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
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { bestellung_ids, aenderungen } = parsed.data

  // Alle Mitglieder müssen dem Nutzer + dieser Version gehören.
  const { data: check, error: checkErr } = await supabase
    .from('langfristige_bestellungen')
    .select('id, anzahl_20dc, anzahl_40hq, menge_praktisch, menge_vor_konsolidierung')
    .eq('user_id', user!.id)
    .eq('plan_version_id', versionId)
    .in('id', bestellung_ids)

  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 })
  const gefunden = (check ?? []) as Array<{
    id: string
    anzahl_20dc: number | null
    anzahl_40hq: number | null
    menge_praktisch: number
    menge_vor_konsolidierung: number | null
  }>
  if (gefunden.length !== bestellung_ids.length) {
    return NextResponse.json({ error: 'Eine oder mehrere Bestellungen nicht gefunden' }, { status: 404 })
  }
  const bestellungById = new Map(gefunden.map((g) => [g.id, g]))

  const now = new Date().toISOString()

  // Angepasste Mengen/Daten direkt auf den Bestellungen aktualisieren.
  for (const ae of aenderungen) {
    const patch: Record<string, unknown> = { updated_at: now }
    if (ae.neue_daten) {
      for (const [k, v] of Object.entries(ae.neue_daten)) {
        if (v !== undefined) patch[k] = v
      }
    }
    if (ae.neue_sku_mengen.length > 0) {
      const neueMenge = ae.neue_sku_mengen[0].menge_praktisch
      const aktuell = bestellungById.get(ae.bestellung_id)
      // Ursprüngliche Menge vor der Konsolidierung festhalten (einmalig), damit die
      // Detailansicht „Praktisch" (vorher) und „Konsolidierung" (nachher) zeigen kann.
      if (aktuell && neueMenge !== aktuell.menge_praktisch) {
        patch.menge_vor_konsolidierung = aktuell.menge_vor_konsolidierung ?? aktuell.menge_praktisch
      }
      patch.menge_praktisch = neueMenge
      const beg = ae.neue_sku_mengen[0].begruendung_anpassung
      if (beg != null) patch.begruendung = beg
    }
    // Anteiligen Container-Share persistieren (für die Container-Anzeige bei Konsolidierung).
    if (ae.container_anteil !== undefined) {
      patch.container_anteil = ae.container_anteil
    }

    if (Object.keys(patch).length > 1) {
      const { error: updErr } = await supabase
        .from('langfristige_bestellungen')
        .update(patch)
        .eq('user_id', user!.id)
        .eq('plan_version_id', versionId)
        .eq('id', ae.bestellung_id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  }

  // Containerart der Gruppe ableiten (40HQ falls irgendwo enthalten, sonst 20DC).
  const hat40 = gefunden.some((g) => (g.anzahl_40hq ?? 0) > 0)
  const hat20 = gefunden.some((g) => (g.anzahl_20dc ?? 0) > 0)
  const containerart = hat40 ? '40HQ' : hat20 ? '20DC' : null

  // Paarweise Verknüpfungen (b1 < b2, dedupliziert) anlegen.
  const ids = [...bestellung_ids].sort()
  const konsRows: Array<{
    user_id: string
    plan_version_id: string
    bestellung_id_1: string
    bestellung_id_2: string
    containerart: string | null
  }> = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      konsRows.push({
        user_id: user!.id,
        plan_version_id: versionId,
        bestellung_id_1: ids[i],
        bestellung_id_2: ids[j],
        containerart,
      })
    }
  }

  if (konsRows.length > 0) {
    const { error: insErr } = await supabase
      .from('langfristige_bestellungen_konsolidierungen')
      .insert(konsRows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, bestellung_ids: ids }, { status: 201 })
}
