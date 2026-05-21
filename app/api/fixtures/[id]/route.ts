/**
 * GET /api/fixtures/[id]
 *
 * Single fixture by id. Used by the active card page to determine the
 * LIVE / DEMO / FINAL badge + catch-up behavior.
 *
 * Response:
 *   200 { ok: true, fixture: { id, status, ... } }
 *   404 { ok: false, error: 'not_found' }
 *   500 { ok: false, error: 'db_error', message }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('match_fixtures')
    .select('id, card_type, match_label, starts_at, ends_at, status')
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

  return NextResponse.json({ ok: true, fixture: data })
}
