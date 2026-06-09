/**
 * GET /api/ops/markets?status=candidate
 *
 * Ops-only. Lists catalog markets (all statuses via the admin client),
 * optionally filtered by `?status=`, ordered by interest_score desc. Powers the
 * /ops/markets curation console.
 *
 * Auth: x-ops-secret header (see lib/ops/auth).
 */
import { NextResponse } from 'next/server'
import { opsAuthError } from '../../../../lib/ops/auth'
import { listMarkets } from '../../../../lib/catalog/ops'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: Request) {
  const authErr = opsAuthError(req)
  if (authErr) return authErr

  const status = new URL(req.url).searchParams.get('status') || undefined
  try {
    const markets = await listMarkets(status)
    return NextResponse.json({ ok: true, markets })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
