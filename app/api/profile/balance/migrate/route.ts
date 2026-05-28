/**
 * POST /api/profile/balance/migrate
 *
 * One-shot migration: when an anonymous user signs in for the first time
 * AND had a localStorage token balance, merge that balance into their
 * fresh profile row.
 *
 * Body: { localBalance: number }
 *
 * Rules:
 *   - Acts only if profiles.migrated_from_anon = false
 *   - AND profiles.virtual_balance is still the default 10000 (no real
 *     activity yet on this profile)
 *   - Result: virtual_balance = max(10000, localBalance), migrated_from_anon = true
 *   - Idempotent: subsequent calls no-op (flag already true)
 *
 * Why `max(10000, localBalance)`: we don't want to PUNISH a user who
 * happened to bottom out anonymously. The default 10000 floor preserves
 * the new-user welcome experience. If anon balance was higher (lucky
 * streak), preserve that.
 *
 * Auth required.
 */
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '../../../../../lib/supabase/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const DEFAULT_BALANCE = 10_000

export async function POST(req: Request) {
  noStore()
  const supabase = createClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }

  let body: { localBalance?: number } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const localBalance =
    typeof body.localBalance === 'number' && body.localBalance >= 0
      ? Math.round(body.localBalance)
      : 0

  const admin = createAdminClient()
  const { data: profile, error: readErr } = await admin
    .from('profiles')
    .select('virtual_balance, migrated_from_anon')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: readErr.message },
      { status: 500 }
    )
  }
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'profile_not_found' }, { status: 404 })
  }

  // Idempotent no-op: already migrated, or profile already has activity.
  if (profile.migrated_from_anon || profile.virtual_balance !== DEFAULT_BALANCE) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: profile.migrated_from_anon ? 'already_migrated' : 'profile_has_activity',
      balance: profile.virtual_balance,
    })
  }

  const merged = Math.max(DEFAULT_BALANCE, localBalance)

  const { error: updErr } = await admin
    .from('profiles')
    .update({ virtual_balance: merged, migrated_from_anon: true })
    .eq('id', userData.user.id)

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: updErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, balance: merged, migrated: true })
}
