/**
 * POST /api/ops/resolve
 *
 * Ops endpoint. Jade hits this during a live game to mark an event as
 * resolved — it writes a row to public.events. All active cards for
 * that match polling /api/events?match=X will see the new event and
 * light up the matching cell.
 *
 * Body: { matchId: string, eventKey: string, payload?: object }
 *
 * Auth: requires the caller to be a Supabase user with
 * raw_app_meta_data.ops = true. Set via SQL in the dashboard:
 *
 *   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"ops": true}'
 *   where email = 'jade@...';
 *
 * Response:
 *   200 { ok: true, event: { id, ... } }
 *   401 { ok: false, error: 'unauthorized' }
 *   403 { ok: false, error: 'not_ops' }
 *   400 { ok: false, error: 'invalid_body' | 'unknown_match' }
 *   500 { ok: false, error: 'db_error', message: '...' }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

type Body = {
  matchId?: string
  eventKey?: string
  payload?: Record<string, unknown>
}

export async function POST(req: Request) {
  // 1) Identify the caller via the session cookie.
  const jar = await cookies()
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: () => {
          /* read-only here */
        },
      },
    }
  )
  const { data: { user } } = await supabaseServer.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // 2) Check ops role. Stored in app_metadata (settable only by service
  //    role, so users can't escalate themselves).
  const isOps = (user.app_metadata as { ops?: boolean })?.ops === true
  if (!isOps) {
    return NextResponse.json({ ok: false, error: 'not_ops' }, { status: 403 })
  }

  // 3) Parse + validate body.
  let body: Body = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const { matchId, eventKey, payload } = body
  if (!matchId || typeof matchId !== 'string') {
    return NextResponse.json({ ok: false, error: 'match_id_required' }, { status: 400 })
  }
  if (!eventKey || typeof eventKey !== 'string') {
    return NextResponse.json({ ok: false, error: 'event_key_required' }, { status: 400 })
  }

  // 4) Write the event row using admin client (bypasses RLS).
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('events')
    .insert({
      match_id: matchId,
      event_key: eventKey,
      payload: payload ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { ok: false, error: 'unknown_match', message: `match_id=${matchId} not in match_fixtures` },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, event: data })
}
