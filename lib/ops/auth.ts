/**
 * Shared ops auth gate — the same shared-secret pattern as
 * app/api/ops/resolve/route.ts, factored out so the catalog ops routes reuse it.
 *
 * Secret is set via OPS_SHARED_SECRET; callers send it in the `x-ops-secret`
 * header. Constant-time compare avoids timing-based extraction (defensive,
 * low-stakes for the closed-beta phase).
 */
import { NextResponse } from 'next/server'

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/**
 * Returns an error `NextResponse` when the request is unauthorized (no secret
 * configured → 500, bad/missing header → 401), or `null` when authorized.
 */
export function opsAuthError(req: Request): NextResponse | null {
  const expected = process.env.OPS_SHARED_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'no_secret_configured', message: 'Set OPS_SHARED_SECRET in env' },
      { status: 500 },
    )
  }
  const provided = req.headers.get('x-ops-secret') || ''
  if (!constantTimeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'bad_secret' }, { status: 401 })
  }
  return null
}
