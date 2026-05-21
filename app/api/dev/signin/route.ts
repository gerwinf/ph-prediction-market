/**
 * POST /api/dev/signin (DEV ONLY)
 *
 * Bypass the Supabase magic-link / verify dance entirely. Generate a
 * session for an email via the admin SDK, set the cookies on the
 * response, redirect to the requested path. The user is now signed
 * in — no inbox, no URL fragment, no token-prefetch race.
 *
 * Refuses to run when NODE_ENV === 'production' so this never leaks.
 *
 * Body: { email: string, redirectTo?: string }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'disabled_in_prod' }, { status: 403 })
  }

  let body: { email?: string; redirectTo?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ ok: false, error: 'email_required' }, { status: 400 })
  }

  // 1) Look up (or create) the user via admin.
  const admin = createAdminClient()
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) {
    return NextResponse.json({ ok: false, error: 'list_failed', message: listErr.message }, { status: 500 })
  }
  let user = list.users.find((u) => u.email?.toLowerCase() === email)
  if (!user) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (createErr || !created.user) {
      return NextResponse.json({ ok: false, error: 'create_failed', message: createErr?.message }, { status: 500 })
    }
    user = created.user
  }

  // 2) Mint a magic link, then extract the recovery token, then use the
  //    verify endpoint server-side to exchange for a session. Cleaner:
  //    use admin.auth.admin.generateLink with type='magiclink' and pull
  //    the hashed_token, then call auth.verifyOtp({token_hash}) on a
  //    server client bound to this response's cookies.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData.properties?.hashed_token) {
    return NextResponse.json({ ok: false, error: 'link_failed', message: linkErr?.message }, { status: 500 })
  }

  // 3) Bind a server client to the cookie jar, then verifyOtp to set
  //    the session cookies. The user is now signed in for this browser.
  const jar = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => jar.set(name, value, options))
        },
      },
    }
  )

  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  })
  if (verifyErr) {
    return NextResponse.json({ ok: false, error: 'verify_failed', message: verifyErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email, userId: user.id })
}
