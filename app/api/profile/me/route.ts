/**
 * GET /api/profile/me
 *
 * Returns the current user's profile if they have a valid Supabase
 * session cookie. 401 if anonymous. Used by /hits + /hits/[card_id] to
 * decide whether to show "Sign in" or the user's display_name.
 *
 * Response:
 *   200 { ok: true, profile: { id, email, display_name, virtual_balance, ... } }
 *   401 { ok: false, error: 'unauthenticated' }
 *   500 { ok: false, error: 'db_error', message }
 *
 * No-store: this hits on every page mount; we want fresh data, not cached.
 */
import { NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  noStore()
  const supabase = createClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    return NextResponse.json(
      { ok: false, error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // Use admin client to read profile — RLS would also allow this via the
  // auth.uid() match, but admin keeps the path predictable. If the profile
  // row doesn't exist yet (first sign-in race), create it from the auth
  // user data.
  const admin = createAdminClient()
  const { data: profile, error: readErr } = await admin
    .from('profiles')
    .select('id, email, display_name, virtual_balance, locale, migrated_from_anon, created_at')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: readErr.message },
      { status: 500 }
    )
  }

  if (!profile) {
    // First-sign-in path: provision a profile row from the auth user.
    const email = userData.user.email ?? ''
    const displayName = email.split('@')[0] || 'Player'
    const { data: inserted, error: insertErr } = await admin
      .from('profiles')
      .insert({
        id: userData.user.id,
        email,
        display_name: displayName,
        locale: 'fil',
      })
      .select('id, email, display_name, virtual_balance, locale, migrated_from_anon, created_at')
      .single()

    if (insertErr) {
      return NextResponse.json(
        { ok: false, error: 'db_error', message: insertErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { ok: true, profile: inserted },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  return NextResponse.json(
    { ok: true, profile },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
