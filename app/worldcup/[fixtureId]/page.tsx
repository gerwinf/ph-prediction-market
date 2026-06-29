import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { fetchApprovedWcFixtures } from '../../../lib/catalog/read'
import { FIXTURES } from '../../../lib/worldcup/fixtures'
import { getFixtureById } from '../../../lib/worldcup/market'
import MarketDetail from './detail'

/* /worldcup/[fixtureId] — server shell. Resolves the fixture from the
 * operator-curated catalog (DB → hardcoded FIXTURES fallback, same posture as
 * the hub) on the server, so the first paint is correct. 404s on unknown ids. */

export const dynamic = 'force-dynamic'

const loadFixture = cache(async (id: string) => {
  const db = await fetchApprovedWcFixtures()
  const fixtures = db.length ? db : FIXTURES
  return getFixtureById(fixtures, id)
})

export async function generateMetadata(
  { params }: { params: { fixtureId: string } },
): Promise<Metadata> {
  const fixture = await loadFixture(params.fixtureId)
  if (!fixture) return { title: 'World Cup 2026 markets | Hula' }
  const matchup = `${fixture.home.name} vs ${fixture.away.name}`
  return {
    title: `${matchup} — World Cup 2026 | Hula`,
    description: `Live prediction-market odds for ${matchup}. Trade the World Cup on Hula.`,
  }
}

export default async function MarketPage({ params }: { params: { fixtureId: string } }) {
  const fixture = await loadFixture(params.fixtureId)
  if (!fixture) return notFound()
  return <MarketDetail fixture={fixture} />
}
