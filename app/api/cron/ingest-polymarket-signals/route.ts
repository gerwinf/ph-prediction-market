/**
 * GET /api/cron/ingest-polymarket-signals
 *
 * First catalog signal source. Pulls the highest-volume active events from the
 * Polymarket Gamma API, maps each to a `binary` candidate market, and inserts
 * the new ones into the catalog for human review in /ops/markets.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (same as refresh-prices). Not wired
 * to Vercel Hobby cron (capped at once/day) — trigger manually or on Pro.
 *
 * Dedup: a candidate whose (kind, lower(title)) already exists for
 * source='signal:polymarket' (in ANY status) is skipped — so re-running never
 * duplicates the queue and never re-proposes an already-approved or already-
 * rejected market. Human-set scores are never touched.
 *
 * Response: { ok, inserted, skipped_dedup, skipped_volume, skipped_unparseable }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { ingestSignals } from '../../../../lib/catalog/maintain'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'cron_secret_unset' }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await ingestSignals(createAdminClient(), Date.now())
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'ingest_failed', message: e instanceof Error ? e.message : 'unknown' },
      { status: 502 },
    )
  }
}
