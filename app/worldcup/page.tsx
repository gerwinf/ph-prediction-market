'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CONTENDERS, FIXTURES } from '../../lib/worldcup/fixtures'
import { selectSpotlight, matchState, flagUrl, countdownParts, type Fixture } from '../../lib/worldcup/state'
import { allWcSlugs, matchHomePct, type PricesMap } from '../../lib/worldcup/odds'

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
function Flag({ iso, name, size = 80 }: { iso: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className="wc-flag-chip" style={{ width: size, height: Math.round((size * 3) / 4) }}>{iso.toUpperCase()}</span>
  }
  return (
    <img
      className="wc-flag"
      src={flagUrl(iso, size)}
      alt={name}
      width={size}
      height={Math.round((size * 3) / 4)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function Spotlight({
  fixture, now, prices, onYes,
}: {
  fixture: Fixture | null
  now: Date | null
  prices: PricesMap
  onYes: (c: string) => void
}) {
  if (!fixture || !now) {
    return (
      <section className="wc-spotlight" data-empty="true">
        <div className="wc-spotlight-eyebrow">Next matchday</div>
        <div className="wc-spotlight-title">Schedule loading…</div>
      </section>
    )
  }

  const state = matchState(fixture.kickoffISO, now)
  const cd = countdownParts(fixture.kickoffISO, now)
  const homePct = matchHomePct(prices, fixture.slug, fixture.home.name, fixture.fallback.home)
  // Live overlay adjusts only the home probability (winner-style market). Draw
  // stays on the curated fallback and away is the remainder, so the three may not
  // sum to exactly 100 in edge cases — acceptable for this pre-launch display.
  const drawPct = fixture.fallback.draw
  const awayPct = Math.max(0, 100 - homePct - drawPct)

  const badge =
    state === 'live' ? <span className="wc-badge wc-badge-live"><i aria-hidden="true" /> LIVE</span>
    : state === 'final' ? <span className="wc-badge wc-badge-final">FULL TIME</span>
    : <span className="wc-badge wc-badge-soon">
        {cd.d > 0 ? `${cd.d}d ` : ''}
        {String(cd.h).padStart(2, '0')}:{String(cd.m).padStart(2, '0')}:{String(cd.s).padStart(2, '0')}
      </span>

  return (
    <section className="wc-spotlight" data-state={state}>
      <div className="wc-spotlight-eyebrow">
        {state === 'live' ? 'Happening now' : state === 'final' ? 'Latest result' : 'Up next'} · Group {fixture.group}
      </div>

      <div className="wc-spotlight-match">
        <div className="wc-team">
          <Flag iso={fixture.home.iso} name={fixture.home.name} size={160} />
          <span className="wc-team-name">{fixture.home.name}</span>
        </div>
        <div className="wc-spotlight-mid">{badge}<span className="wc-vs">vs</span></div>
        <div className="wc-team">
          <Flag iso={fixture.away.iso} name={fixture.away.name} size={160} />
          <span className="wc-team-name">{fixture.away.name}</span>
        </div>
      </div>

      {fixture.venue && <div className="wc-spotlight-venue">{fixture.venue}</div>}

      <div className="wc-odds-row">
        <button className="wc-odd wc-odd-home" onClick={() => onYes(`${fixture.home.name} to win`)}>
          <span className="wc-odd-lbl">{fixture.home.name}</span>
          <span className="wc-odd-pct">{homePct}%</span>
        </button>
        <button className="wc-odd wc-odd-draw" onClick={() => onYes(`${fixture.home.name} v ${fixture.away.name} — Draw`)}>
          <span className="wc-odd-lbl">Draw</span>
          <span className="wc-odd-pct">{drawPct}%</span>
        </button>
        <button className="wc-odd wc-odd-away" onClick={() => onYes(`${fixture.away.name} to win`)}>
          <span className="wc-odd-lbl">{fixture.away.name}</span>
          <span className="wc-odd-pct">{awayPct}%</span>
        </button>
      </div>
    </section>
  )
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
