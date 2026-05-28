/**
 * DELETE /api/ops/events/[id]
 *
 * Un-fire an event by deleting the row from public.events. Used by
 * the /ops console toggle UX — ops mistakenly fired an event and
 * wants to walk it back.
 *
 * Auth: shared secret in X-Ops-Secret header (same gate as
 * /api/ops/resolve).
 *
 * Response:
 *   200 { ok: true }
 *   401 { ok: false, error: 'bad_secret' }
 *   404 { ok: false, error: 'not_found' }
 *   500 { ok: false, error: 'db_error', message }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const expected = process.env.OPS_SHARED_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'no_secret_configured' },
      { status: 500 }
    )
  }
  const provided = req.headers.get('x-ops-secret') || ''
  if (!constantTimeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'bad_secret' }, { status: 401 })
  }

  const { id } = await ctx.params
  const numId = Number(id)
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error, count } = await admin
    .from('events')
    .delete({ count: 'exact' })
    .eq('id', numId)

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }
  if (!count) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
