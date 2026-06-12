'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CONTENDERS, FIXTURES } from '../../lib/worldcup/fixtures'
import { selectSpotlight } from '../../lib/worldcup/state'
import { allWcSlugs, type PricesMap } from '../../lib/worldcup/odds'

/* ────────────────────────────────────────────────────────────────────────
 * /worldcup — World Cup 2026 prediction-market hub
 *
 * Pre-launch display showcase. Renders from curated fixtures (lib/worldcup),
 * overlays best-effort live Polymarket odds (/api/prices), and captures
 * waitlist signal on YES taps (/api/waitlist, source=worldcup). No settlement.
 *
 * "Obviously up-to-date" engine: real team flags (flagcdn) keyed to fixtures +
 * a ticking kickoff countdown + LIVE/FULL-TIME badges + an "updated today"
 * stamp. See docs/superpowers/specs/2026-06-12-worldcup-section-design.md.
 * ──────────────────────────────────────────────────────────────────────── */

export default function WorldCupHub() {
  const [now, setNow] = useState<Date | null>(null)
  const [prices, setPrices] = useState<PricesMap>({})
  const [waitlistFor, setWaitlistFor] = useState<string | null>(null)

  // Mount: capture `now` (deferred to client to avoid hydration mismatch) and
  // tick every second so countdowns + live/final transitions stay current.
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Best-effort live odds. Any failure keeps the curated fallbacks.
  useEffect(() => {
    const slugs = allWcSlugs(CONTENDERS, FIXTURES)
    if (slugs.length === 0) return
    let cancelled = false
    fetch(`/api/prices?events=${slugs.join(',')}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: PricesMap) => { if (!cancelled) setPrices(data) })
      .catch(() => { /* keep fallbacks */ })
    return () => { cancelled = true }
  }, [])

  const spotlight = useMemo(
    () => (now ? selectSpotlight(FIXTURES, now) : null),
    [now]
  )
  const gridFixtures = useMemo(
    () => FIXTURES.filter((f) => f.id !== spotlight?.id),
    [spotlight]
  )

  const updatedLabel = now
    ? now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    : '—'

  return (
    <main className="hula-v2 wc">
      <header className="wc-header">
        <Link href="/" className="wc-back">← Hula</Link>
        <span className="wc-wordmark">World Cup <em>2026</em></span>
        <span className="wc-updated" suppressHydrationWarning>
          <span className="wc-updated-dot" /> Updated {updatedLabel} · live odds
        </span>
      </header>

      <Spotlight fixture={spotlight} now={now} prices={prices} onYes={setWaitlistFor} />
      <WinnerLeaderboard prices={prices} onYes={setWaitlistFor} />
      <MatchGrid fixtures={gridFixtures} now={now} prices={prices} onYes={setWaitlistFor} />
      <CtaStrip />

      {waitlistFor && (
        <WaitlistModal context={waitlistFor} onClose={() => setWaitlistFor(null)} />
      )}

      <footer className="wc-foot">
        21+ only · <strong>Play smart</strong> · Live odds via Polymarket · Pre-launch — no real bets yet
      </footer>
    </main>
  )
}

// --- Stubs filled in Tasks 5–8 -------------------------------------------
function Spotlight(_: { fixture: import('../../lib/worldcup/state').Fixture | null; now: Date | null; prices: PricesMap; onYes: (c: string) => void }) {
  return <section className="wc-spotlight">spotlight</section>
}
function WinnerLeaderboard(_: { prices: PricesMap; onYes: (c: string) => void }) {
  return <section className="wc-leaderboard">leaderboard</section>
}
function MatchGrid(_: { fixtures: import('../../lib/worldcup/state').Fixture[]; now: Date | null; prices: PricesMap; onYes: (c: string) => void }) {
  return <section className="wc-grid">grid</section>
}
function CtaStrip() {
  return <section className="wc-cta">cta</section>
}
function WaitlistModal(_: { context: string; onClose: () => void }) {
  return null
}
