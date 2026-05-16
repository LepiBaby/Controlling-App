import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const MAX_BATCH_SIZE = 500

const UST_SAETZE = ['100', '19', '7', '0', 'individuell'] as const

const itemSchema = z.object({
  leistungsdatum:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
  zahlungsdatum:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  betrag_brutto:      z.number().positive('Bruttobetrag muss größer als 0 sein'),
  ust_satz:           z.enum(UST_SAETZE, { message: 'Ungültiger USt-Satz' }),
  ust_betrag:         z.number().min(0, 'USt-Betrag darf nicht negativ sein'),
  kategorie_id:       z.string().uuid('Ungültige Kategorie-ID'),
  gruppe_id:          z.string().uuid().nullable().optional(),
  untergruppe_id:     z.string().uuid().nullable().optional(),
  sales_plattform_id: z.string().uuid().nullable().optional(),
  produkt_id:         z.string().uuid().nullable().optional(),
  beschreibung:       z.string().max(1000).nullable().optional(),
  relevanz:           z.enum(['rentabilitaet', 'liquiditaet', 'beides'], { message: 'Ungültige Relevanz' }),
  abschreibung:       z.enum(['3_jahre', '5_jahre', '7_jahre', '10_jahre']).nullable().optional(),
})

function computeUstBetrag(brutto: number, ustSatz: string, ustBetragManual: number): number {
  if (ustSatz === '100') return brutto
  if (ustSatz === '19')  return Math.round(brutto * 19 / 119 * 100) / 100
  if (ustSatz === '7')   return Math.round(brutto * 7  / 107 * 100) / 100
  if (ustSatz === '0')   return 0
  return ustBetragManual
}

function computeNetto(brutto: number, ustSatz: string, ustBetrag: number): number {
  if (ustSatz === '100') return 0
  if (ustSatz === '19')  return Math.round((brutto - Math.round(brutto * 19 / 119 * 100) / 100) * 100) / 100
  if (ustSatz === '7')   return Math.round((brutto - Math.round(brutto * 7  / 107 * 100) / 100) * 100) / 100
  if (ustSatz === '0')   return brutto
  return Math.round((brutto - ustBetrag) * 100) / 100
}

export async function POST(request: Request) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 })
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Anfrage muss ein Array sein' }, { status: 400 })
  }

  if (body.length === 0) {
    return NextResponse.json({ error: 'Array darf nicht leer sein' }, { status: 400 })
  }

  if (body.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Maximal ${MAX_BATCH_SIZE} Transaktionen pro Import erlaubt` },
      { status: 400 }
    )
  }

  // Validate each item
  const validationErrors: { index: number; error: string }[] = []
  const validated: z.infer<typeof itemSchema>[] = []

  body.forEach((item, i) => {
    const result = itemSchema.safeParse(item)
    if (!result.success) {
      validationErrors.push({
        index: i,
        error: result.error.issues.map((e: { message: string }) => e.message).join('; '),
      })
    } else {
      validated.push(result.data)
    }
  })

  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: 'Validierungsfehler in einzelnen Zeilen', validationErrors },
      { status: 400 }
    )
  }

  // Insert rows concurrently with partial success tracking
  const insertResults = await Promise.allSettled(
    validated.map(d => {
      const ustBetrag   = computeUstBetrag(d.betrag_brutto, d.ust_satz, d.ust_betrag)
      const betragNetto = computeNetto(d.betrag_brutto, d.ust_satz, ustBetrag)

      return supabase
        .from('ausgaben_kosten_transaktionen')
        .insert({
          leistungsdatum:     d.leistungsdatum,
          zahlungsdatum:      d.zahlungsdatum ?? null,
          betrag_brutto:      d.betrag_brutto,
          betrag_netto:       betragNetto,
          ust_satz:           d.ust_satz,
          ust_betrag:         ustBetrag,
          kategorie_id:       d.kategorie_id,
          gruppe_id:          d.gruppe_id ?? null,
          untergruppe_id:     d.untergruppe_id ?? null,
          sales_plattform_id: d.sales_plattform_id ?? null,
          produkt_id:         d.produkt_id ?? null,
          beschreibung:       d.beschreibung ?? null,
          relevanz:           d.relevanz,
          abschreibung:       d.abschreibung ?? null,
        })
        .select()
        .single()
    })
  )

  const dbErrors: { index: number; error: string }[] = []
  let successCount = 0

  insertResults.forEach((result, i) => {
    if (result.status === 'rejected') {
      dbErrors.push({ index: i, error: String(result.reason) })
    } else if (result.value.error) {
      dbErrors.push({ index: i, error: result.value.error.message })
    } else {
      successCount++
    }
  })

  const errorCount = dbErrors.length

  if (successCount === 0) {
    return NextResponse.json(
      { error: 'Alle Transaktionen konnten nicht importiert werden', errors: dbErrors },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { successCount, errorCount, errors: dbErrors },
    { status: errorCount > 0 ? 207 : 201 }
  )
}
