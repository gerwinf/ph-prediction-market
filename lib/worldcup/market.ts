/* Pure helpers for the per-fixture market detail page (/worldcup/[id]).
 * Deterministic — no Date.now()/Math.random(), same input → same output. */

import type { Fixture } from './state'
import { liveVol, compressVol, formatPeso, type PricesMap } from './odds'

export function getFixtureById(fixtures: Fixture[], id: string): Fixture | null {
  return fixtures.find((f) => f.id === id) ?? null
}

export type VolLabel = { label: string; live: boolean }

// Live Polymarket volume when the fixture's slug resolves to a fresh row;
// otherwise a deterministic INDICATIVE figure derived from how competitive the
// match is (tighter odds → more interest). The derived USD proxy is fed through
// the SAME compression band as the live path (lib/worldcup/odds), so indicative
// labels read at the same peso scale as real ones. No clock, no randomness.
export function fixtureVolLabel(prices: PricesMap, fixture: Fixture): VolLabel {
  const live = liveVol(prices, fixture.slug, '')
  if (live) return { label: live, live: true }

  const spread = Math.abs(fixture.fallback.home - fixture.fallback.away) // 0..100
  const competitiveness = 1 - spread / 100 // 1 = coin-flip, 0 = blowout
  const usd = 200_000 * Math.pow(50, competitiveness) // ~₱200K..₱10M band
  return { label: formatPeso(compressVol(usd)), live: false }
}

export function resolutionText(fixture: Fixture): string {
  return `Resolves to the result of ${fixture.home.name} vs ${fixture.away.name} at full time (90 minutes plus stoppage). "Draw" settles if the score is level after 90 minutes.`
}
