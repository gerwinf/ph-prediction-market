/**
 * POST /api/analytics/track
 *
 * Fire-and-forget funnel event writer. Inserts a row into
 * `public.analytics_events`. Used by the client-side
 * `lib/analytics/track.ts` helper at every funnel beat across /hits
 * and /hits/[card_id].
 *
 * Body: { event_type: string, card_id?: string, payload?: object }
 *
 * Always returns 200 { ok: true } unless the body is unparseable.
 * Analytics loss is acceptable — never block the user flow on a
 * tracking failure.
 *
 * Auth: anonymous. device_id read from `hula_device_id` cookie. If the
 * cookie is missing (first visit before it's been set), we create it
 * here so the very-first page_view still ties to a stable id.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { getOrCreateDeviceId } from '../../../../lib/identity/device-id'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type Body = {
  event_type?: string
  card_id?: string
  payload?: Record<string, unknown>
}

// Soft cap on payload size to keep the table sane. Anything bigger is
// almost certainly a bug on the client.
const MAX_PAYLOAD_BYTES = 4096

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const eventType = typeof body.event_type === 'string' ? body.event_type.slice(0, 64) : null
  if (!eventType) {
    return NextResponse.json({ ok: false, error: 'event_type_required' }, { status: 400 })
  }

  const cardId =
    typeof body.card_id === 'string' && body.card_id.length <= 40 ? body.card_id : null

  let payload: Record<string, unknown> | null = null
  if (body.payload && typeof body.payload === 'object') {
    const json = JSON.stringify(body.payload)
    payload = json.length <= MAX_PAYLOAD_BYTES ? body.payload : { _truncated: true }
  }

  const deviceId = await getOrCreateDeviceId()
  const supabase = createAdminClient()

  // Best-effort insert. Don't surface the error to the client — we'd
  // rather lose an event than block the user flow on a tracking
  // failure. The error will show up in Supabase logs if there's a real
  // problem (e.g. table missing, RLS misconfig).
  await supabase.from('analytics_events').insert({
    event_type: eventType,
    device_id: deviceId,
    card_id: cardId,
    payload: payload,
  })

  return NextResponse.json({ ok: true })
}
