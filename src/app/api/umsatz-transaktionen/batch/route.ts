import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/supabase-server'

const MAX_BATCH_SIZE = 500

const itemSchema = z.object({
  leistungsdatum:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat (YYYY-MM-DD)'),
  betrag:             z.number().positive('Betrag muss größer als 0 sein'),
  kategorie_id:       z.string().uuid('Ungültige Kategorie-ID'),
  gruppe_id:          z.string().uuid().nullable().optional(),
  untergruppe_id:     z.string().uuid().nullable().optional(),
  sales_plattform_id: z.string().uuid().nullable().optional(),
  produkt_id:         z.string().uuid().nullable().optional(),
  beschreibung:       z.string().max(1000).nullable().optional(),
})

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

  const insertResults = await Promise.allSettled(
    validated.map(d =>
      supabase
        .from('umsatz_transaktionen')
        .insert({
          leistungsdatum:     d.leistungsdatum,
          betrag:             d.betrag,
          kategorie_id:       d.kategorie_id,
          gruppe_id:          d.gruppe_id ?? null,
          untergruppe_id:     d.untergruppe_id ?? null,
          sales_plattform_id: d.sales_plattform_id ?? null,
          produkt_id:         d.produkt_id ?? null,
          beschreibung:       d.beschreibung ?? null,
        })
        .select()
        .single()
    )
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
