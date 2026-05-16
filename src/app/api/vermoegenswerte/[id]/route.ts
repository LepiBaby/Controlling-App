import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  const { error: dbError } = await supabase
    .from('vermoegenswarte_snapshots')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
