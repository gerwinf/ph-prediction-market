/**
 * GET /api/wins?match=<match_id>&excludeDevice=<device_id>
 *
 * Recent winning cards for a match, anonymized. Feeds the live wins
 * ticker on active card pages. Last 5, newest first.
 *
 * `excludeDevice` filters out wins from the requester's own device so
 * the user never sees themselves as social proof. Passed from the
 * client via cookie value (read by the active-card page directly).
 *
 * Response:
 *   200 { ok: true, wins: [{ id, win_pattern, score, won_at }] }
 *   400 { ok: false, error: 'match_required' }
 *   500 { ok: false, error: 'db_error', message }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { readDeviceId } from '../../../lib/identity/device-id'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const matchId = url.searchParams.get('match')
  if (!matchId) {
    return NextResponse.json({ ok: false, error: 'match_required' }, { status: 400 })
  }

  // Self-filter via the requester's device_id cookie. Caller can also
  // override with ?excludeDevice= for testing or for non-cookied envs.
  const excludeDevice = url.searchParams.get('excludeDevice') ?? (await readDeviceId())

  const admin = createAdminClient()
  let query = admin
    .from('cards')
    .select('id, win_pattern, score, claimed_at, created_at, device_id')
    .eq('match_id', matchId)
    .eq('won', true)
    .order('claimed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(8)

  if (excludeDevice) {
    query = query.neq('device_id', excludeDevice)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: error.message },
      { status: 500 }
    )
  }

  // Slim shape sent to client — don't leak device_id.
  const wins = (data ?? []).slice(0, 5).map((c) => ({
    id: c.id,
    win_pattern: c.win_pattern,
    score: c.score,
    won_at: c.claimed_at ?? c.created_at,
  }))

  return NextResponse.json(
    { ok: true, wins },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    }
  )
}
