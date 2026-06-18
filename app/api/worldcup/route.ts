/**
 * GET /api/worldcup
 *
 * Public. Returns the World Cup section's data:
 *   { fixtures: Fixture[], contenders: Contender[] }
 *
 * Fixtures come from approved/live wc_fixture rows (sorted by kickoff);
 * contenders from approved/live wc_contender rows. When a kind's catalog read
 * is empty or errors, that kind falls back to the hardcoded data in
 * lib/worldcup/fixtures — so /worldcup always renders, exactly as it does today
 * when the catalog is untouched. The admin client stays server-side.
 */
import { NextResponse } from 'next/server'
import { fetchApprovedWcFixtures, fetchApprovedWcContenders } from '../../../lib/catalog/read'
import { FIXTURES, CONTENDERS } from '../../../lib/worldcup/fixtures'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  const [dbFixtures, dbContenders] = await Promise.all([
    fetchApprovedWcFixtures(),
    fetchApprovedWcContenders(),
  ])

  return NextResponse.json({
    fixtures: dbFixtures.length ? dbFixtures : FIXTURES,
    contenders: dbContenders.length ? dbContenders : CONTENDERS,
  })
}
