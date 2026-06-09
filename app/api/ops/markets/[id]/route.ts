/**
 * PATCH /api/ops/markets/[id]
 *
 * Ops-only. Edit a market's title / category / interest_score / status /
 * payload. Status is one-way: moving a row back to 'candidate' is rejected
 * (candidates are a queue you leave, not return to).
 *
 * Body (all optional): { title?, category?, interest_score?, status?, payload? }
 * Auth: x-ops-secret header.
 */
import { NextResponse } from 'next/server'
import { opsAuthError } from '../../../../../lib/ops/auth'
import { updateMarket, type MarketPatch } from '../../../../../lib/catalog/ops'
import type { MarketStatus } from '../../../../../lib/catalog/types'

export const dynamic = 'force-dynamic'

const STATUSES: MarketStatus[] = ['candidate', 'approved', 'live', 'retired']

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const authErr = opsAuthError(req)
  if (authErr) return authErr

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const patch: MarketPatch = {}

  if ('title' in body) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ ok: false, error: 'invalid_title' }, { status: 400 })
    }
    patch.title = body.title.trim()
  }

  if ('category' in body) {
    if (body.category !== null && typeof body.category !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid_category' }, { status: 400 })
    }
    patch.category = body.category as string | null
  }

  if ('interest_score' in body) {
    const n = Number(body.interest_score)
    if (!Number.isInteger(n)) {
      return NextResponse.json({ ok: false, error: 'invalid_interest_score' }, { status: 400 })
    }
    patch.interest_score = n
  }

  if ('status' in body) {
    const s = body.status as MarketStatus
    if (!STATUSES.includes(s)) {
      return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
    }
    if (s === 'candidate') {
      return NextResponse.json({ ok: false, error: 'status_one_way' }, { status: 400 })
    }
    patch.status = s
  }

  if ('payload' in body) {
    if (typeof body.payload !== 'object' || body.payload === null || Array.isArray(body.payload)) {
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
    }
    patch.payload = body.payload as Record<string, unknown>
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  try {
    const market = await updateMarket(params.id, patch)
    if (!market) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, market })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
