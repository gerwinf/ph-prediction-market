/**
 * GET /api/cards/[id]
 *
 * Read a single card by id. Returns the row from public.cards plus
 * a hint for whether the requester is the original device owner.
 *
 * Response:
 *   200 { ok: true, card: {...}, ownedByThisDevice: boolean }
 *   404 { ok: false, error: 'not_found' }
 *   500 { ok: false, error: 'db_error', message: '...' }
 */
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { readDeviceId } from '../../../../lib/identity/device-id'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  noStore()
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'card_id_required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const deviceId = await readDeviceId()
  const ownedByThisDevice = !!deviceId && deviceId === data.device_id

  return NextResponse.json(
    { ok: true, card: data, ownedByThisDevice },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  )
}
