/**
 * Supabase connection health check.
 *
 * GET /api/health/supabase
 *
 * Returns `{ ok: true, serverTime, connection: 'admin' | 'anon' }` if
 * the credentials are wired and the database is reachable.
 *
 * Use during build kickoff to verify .env.local credentials work
 * end-to-end before building anything that depends on the DB.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Cheapest connection test: list users (admin-only). If credentials are
    // wrong, this returns 401. If the project doesn't exist, network error.
    // If it works, we know admin client is fully wired.
    const probe = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (probe.error) {
      return NextResponse.json(
        { ok: false, error: probe.error.message, stage: 'auth-probe' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      serverTime: new Date().toISOString(),
      connection: 'admin',
      userCount: probe.data.users.length,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        stage: 'client-init',
      },
      { status: 500 }
    )
  }
}
