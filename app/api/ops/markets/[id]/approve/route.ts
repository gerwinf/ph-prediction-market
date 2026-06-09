/**
 * POST /api/ops/markets/[id]/approve
 *
 * Ops-only. Approve a candidate: status → 'approved', stamps reviewed_by /
 * reviewed_at. The market then becomes public-readable and shows on the landing
 * grid / in the /hits pool.
 *
 * Auth: x-ops-secret header.
 */
import { NextResponse } from 'next/server'
import { opsAuthError } from '../../../../../../lib/ops/auth'
import { reviewMarket } from '../../../../../../lib/catalog/ops'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authErr = opsAuthError(req)
  if (authErr) return authErr

  try {
    const market = await reviewMarket(params.id, 'approved')
    if (!market) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, market })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
