import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const FREQUENZEN = ['monatlich', 'quartalsweise', 'jaehrlich'] as const
const ZEITPUNKTE = ['anfang', 'mitte', 'ende'] as const
const UST_SAETZE = ['0', '7', '19', 'individuell'] as const

const Q1 = [1, 2, 3]
const Q2 = [4, 5, 6]
const Q3 = [7, 8, 9]
const Q4 = [10, 11, 12]

function berechneUstUndBrutto(
  netto: number,
  ustSatz: string,
  ustBetragIndividuell: number,
): { ust_betrag: number; bruttobetrag: number } {
  let ust_betrag: number
  if (ustSatz === '19') ust_betrag = Math.round(netto * 0.19 * 100) / 100
  else if (ustSatz === '7') ust_betrag = Math.round(netto * 0.07 * 100) / 100
  else if (ustSatz === 'individuell') ust_betrag = ustBetragIndividuell
  else ust_betrag = 0
  return { ust_betrag, bruttobetrag: Math.round((netto + ust_betrag) * 100) / 100 }
}

const bodySchema = z.object({
  kategorie_id: z.string().uuid(),
  untergruppe_id: z.string().uuid().nullable().optional().default(null),
  name: z.string().min(1).max(100).transform(s => s.trim()),
  zahlungsfrequenz: z.enum(FREQUENZEN),
  faelligkeits_monate: z.array(z.number().int().min(1).max(12)).default([]),
  zeitpunkt_im_monat: z.enum(ZEITPUNKTE),
  zahlungsziel_tage: z.number().int().min(0).max(365).nullable().optional().default(null),
  betrag_netto: z.number().positive().max(10_000_000),
  ust_satz: z.enum(UST_SAETZE),
  ust_betrag_individuell: z.number().min(0).optional().default(0),
  aktiv: z.boolean().default(true),
  aktiv_von: z.string().date().nullable().optional().default(null),
  aktiv_bis: z.string().date().nullable().optional().default(null),
}).superRefine((data, ctx) => {
  const { zahlungsfrequenz, faelligkeits_monate: m } = data

  if (data.ust_satz === 'individuell' && (!data.ust_betrag_individuell || data.ust_betrag_individuell <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Bei individuellem USt-Satz muss ein USt-Betrag > 0 angegeben werden.',
      path: ['ust_betrag_individuell'],
    })
  }

  if (zahlungsfrequenz === 'monatlich') return

  if (zahlungsfrequenz === 'jaehrlich') {
    if (m.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bei jährlicher Frequenz muss genau ein Fälligkeitsmonat angegeben werden.',
        path: ['faelligkeits_monate'],
      })
    }
    return
  }

  if (m.length !== 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Bei quartalsweiser Frequenz müssen genau vier Fälligkeitsmonate angegeben werden (je einer pro Quartal).',
      path: ['faelligkeits_monate'],
    })
    return
  }
  const hasQ1 = m.some(x => Q1.includes(x))
  const hasQ2 = m.some(x => Q2.includes(x))
  const hasQ3 = m.some(x => Q3.includes(x))
  const hasQ4 = m.some(x => Q4.includes(x))
  if (!hasQ1 || !hasQ2 || !hasQ3 || !hasQ4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Bei quartalsweiser Frequenz muss je ein Monat aus Q1 (1–3), Q2 (4–6), Q3 (7–9) und Q4 (10–12) angegeben werden.',
      path: ['faelligkeits_monate'],
    })
  }
})

function mapRow(row: Record<string, unknown> & {
  kpi_categories?: { name: string } | null
  untergruppe?: { name: string } | null
}) {
  const { kpi_categories, untergruppe, ...rest } = row
  return {
    ...rest,
    kategorie_name: kpi_categories?.name ?? '',
    untergruppe_name: untergruppe?.name ?? null,
  }
}

export async function GET() {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data, error: dbErr } = await supabase
    .from('operative_fixkosten_einstellungen')
    .select('*, kpi_categories!kategorie_id(name), untergruppe:kpi_categories!untergruppe_id(name)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(row => mapRow(row as Parameters<typeof mapRow>[0])))
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { ust_betrag_individuell, betrag_netto, ust_satz, ...rest } = parsed.data
  const { ust_betrag, bruttobetrag } = berechneUstUndBrutto(betrag_netto, ust_satz, ust_betrag_individuell)

  const { data, error: dbErr } = await supabase
    .from('operative_fixkosten_einstellungen')
    .insert({ ...rest, betrag_netto, ust_satz, ust_betrag, bruttobetrag, user_id: user!.id })
    .select('*, kpi_categories!kategorie_id(name), untergruppe:kpi_categories!untergruppe_id(name)')
    .single()

  if (dbErr || !data) {
    return NextResponse.json({ error: dbErr?.message ?? 'Einfügen fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(mapRow(data as Parameters<typeof mapRow>[0]), { status: 201 })
}
