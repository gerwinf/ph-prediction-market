'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { type Contender } from '../../lib/worldcup/fixtures'
import { selectSpotlight, matchState, flagUrl, countdownParts, type Fixture } from '../../lib/worldcup/state'
import { allWcSlugs, matchHomePct, winnerPct, type PricesMap } from '../../lib/worldcup/odds'
import { Flag, WaitlistModal, groupLabel, kickoffLabel } from './shared'

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

export default function WorldCupHub({
  initialFixtures,
  initialContenders,
}: {
  initialFixtures: Fixture[]
  initialContenders: Contender[]
}) {
  const [now, setNow] = useState<Date | null>(null)
  const [prices, setPrices] = useState<PricesMap>({})
  const [waitlistFor, setWaitlistFor] = useState<string | null>(null)
  const [tab, setTab] = useState<'matches' | 'winner'>('matches')
  // Data is server-rendered (page.tsx) and passed in, so the first paint is
  // already correct — no client fetch, no flash of fallback content.
  const fixtures = initialFixtures
  const contenders = initialContenders

  // Mount: capture `now` (deferred to client to avoid hydration mismatch) and
  // tick every second so countdowns + live/final transitions stay current.
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Best-effort live odds. Any failure keeps the curated fallbacks.
  useEffect(() => {
    const slugs = allWcSlugs(contenders, fixtures)
    if (slugs.length === 0) return
    let cancelled = false
    fetch(`/api/prices?events=${slugs.join(',')}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: PricesMap) => { if (!cancelled) setPrices(data) })
      .catch(() => { /* keep fallbacks */ })
    return () => { cancelled = true }
  }, [fixtures, contenders])

  const spotlight = useMemo(
    () => (now ? selectSpotlight(fixtures, now) : null),
    [now, fixtures]
  )
  const gridFixtures = useMemo(
    () => fixtures.filter((f) => f.id !== spotlight?.id),
    [fixtures, spotlight]
  )

  const updatedLabel = now
    ? now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    : '—'

  return (
    <main className="hula-v2 wc">
      <h1 className="sr-only">World Cup 2026 prediction markets</h1>
      <header className="wc-header">
        <Link href="/" className="wc-back">← Hula</Link>
        <span className="wc-wordmark">World Cup <em>2026</em></span>
        <span className="wc-updated" suppressHydrationWarning>
          <span className="wc-updated-dot" /> Updated {updatedLabel} · live odds
        </span>
      </header>

      <Spotlight fixture={spotlight} now={now} prices={prices} />

      <nav className="wc-tabs" aria-label="World Cup markets">
        <button className="wc-tab" data-active={tab === 'matches'} aria-pressed={tab === 'matches'} onClick={() => setTab('matches')}>
          Matches<span className="wc-tab-count">{gridFixtures.length}</span>
        </button>
        <button className="wc-tab" data-active={tab === 'winner'} aria-pressed={tab === 'winner'} onClick={() => setTab('winner')}>
          Who wins the Cup<span className="wc-tab-count">{contenders.length}</span>
        </button>
      </nav>

      {tab === 'matches'
        ? <MatchGrid fixtures={gridFixtures} now={now} prices={prices} />
        : <WinnerLeaderboard contenders={contenders} prices={prices} onYes={setWaitlistFor} />}

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

function Spotlight({
  fixture, now, prices,
}: {
  fixture: Fixture | null
  now: Date | null
  prices: PricesMap
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
    <Link href={`/worldcup/${fixture.id}`} className="wc-spotlight-link">
      <section className="wc-spotlight" data-state={state}>
        <div className="wc-spotlight-eyebrow">
          {state === 'live' ? 'Happening now' : state === 'final' ? 'Latest result' : 'Up next'} · {groupLabel(fixture.group)}
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
          <span className="wc-odd wc-odd-home">
            <span className="wc-odd-lbl">{fixture.home.name}</span>
            <span className="wc-odd-pct">{homePct}%</span>
          </span>
          <span className="wc-odd wc-odd-draw">
            <span className="wc-odd-lbl">Draw</span>
            <span className="wc-odd-pct">{drawPct}%</span>
          </span>
          <span className="wc-odd wc-odd-away">
            <span className="wc-odd-lbl">{fixture.away.name}</span>
            <span className="wc-odd-pct">{awayPct}%</span>
          </span>
        </div>

        <div className="wc-spotlight-cta">View market →</div>
      </section>
    </Link>
  )
}
function WinnerLeaderboard({ contenders, prices, onYes }: { contenders: Contender[]; prices: PricesMap; onYes: (c: string) => void }) {
  // Overlay live odds, then sort high→low by the (live-or-fallback) pct.
  const rows = contenders
    .map((c) => ({ ...c, pct: winnerPct(prices, c.slug, c.fallbackPct) }))
    .sort((a, b) => b.pct - a.pct)

  return (
    <section className="wc-leaderboard">
      <div className="wc-panel-note">Champion market · price = chance · YES pays ₱100</div>
      <div className="wc-win-list">
        {rows.map((r, i) => (
          <div key={r.name} className="wc-win-row">
            <span className="wc-win-rank">{i + 1}</span>
            <img
              className="wc-win-flag"
              src={flagUrl(r.iso, 40)}
              alt={r.name}
              width={30}
              height={22}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
            />
            <span className="wc-win-id">
              <span className="wc-win-name">{r.name}</span>
              {r.slug && <span className="wc-win-vol">Live via Polymarket</span>}
            </span>
            <span className="wc-win-prob">
              <span className="wc-win-pct">{r.pct}%</span>
            </span>
            <span className="wc-win-bets">
              <button className="wc-bet wc-bet-yes" onClick={() => onYes(`${r.name} to win the World Cup — YES`)}>
                <span className="wc-bet-lbl">Yes</span>
                <span className="wc-bet-val">₱{r.pct}</span>
              </button>
              <button className="wc-bet wc-bet-no" onClick={() => onYes(`${r.name} to win the World Cup — NO`)}>
                <span className="wc-bet-lbl">No</span>
                <span className="wc-bet-val">₱{100 - r.pct}</span>
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
function MatchGrid({
  fixtures, now, prices,
}: {
  fixtures: Fixture[]
  now: Date | null
  prices: PricesMap
}) {
  if (fixtures.length === 0) return null
  return (
    <section className="wc-grid">
      <div className="wc-panel-note">Tap a match to open its market</div>
      <div className="wc-grid-list">
        {fixtures.map((f) => {
          const state = now ? matchState(f.kickoffISO, now) : 'scheduled'
          const homePct = matchHomePct(prices, f.slug, f.home.name, f.fallback.home)
          const drawPct = f.fallback.draw
          const awayPct = Math.max(0, 100 - homePct - drawPct)
          return (
            <Link key={f.id} href={`/worldcup/${f.id}`} className="wc-mcard-link">
              <article className="wc-mcard" data-state={state}>
                <div className="wc-mcard-top">
                  <span className="wc-mcard-group">{groupLabel(f.group)}</span>
                  <span className="wc-mcard-when">
                    {state === 'live' ? <span className="wc-badge wc-badge-live"><i aria-hidden="true" /> LIVE</span>
                     : state === 'final' ? 'Full time'
                     : kickoffLabel(f.kickoffISO)}
                  </span>
                </div>
                <div className="wc-mcard-teams">
                  <span className="wc-mcard-team">
                    <img className="wc-mcard-flag" src={flagUrl(f.home.iso, 40)} alt={f.home.name} width={26} height={20} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                    <span className="wc-mcard-name">{f.home.name}</span>
                  </span>
                  <span className="wc-mcard-team">
                    <img className="wc-mcard-flag" src={flagUrl(f.away.iso, 40)} alt={f.away.name} width={26} height={20} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                    <span className="wc-mcard-name">{f.away.name}</span>
                  </span>
                </div>
                <div className="wc-mcard-odds">
                  <span className="wc-codd wc-codd-team">
                    <span className="wc-codd-lbl">{f.home.name}</span>
                    <span className="wc-codd-pct">{homePct}%</span>
                  </span>
                  <span className="wc-codd wc-codd-draw">
                    <span className="wc-codd-lbl">Draw</span>
                    <span className="wc-codd-pct">{drawPct}%</span>
                  </span>
                  <span className="wc-codd wc-codd-team">
                    <span className="wc-codd-lbl">{f.away.name}</span>
                    <span className="wc-codd-pct">{awayPct}%</span>
                  </span>
                </div>
              </article>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
function CtaStrip() {
  return (
    <section className="wc-cta">
      <h2 className="wc-cta-title">Trade the World Cup. <em>Settled in pesos.</em></h2>
      <p className="wc-cta-sub">Get in before the final — founding members trade zero-fee for life.</p>
      <button className="wc-cta-btn" onClick={() => {
        const el = document.getElementById('wc-waitlist-anchor')
        el?.scrollIntoView({ behavior: 'smooth' })
      }}>
        Reserve your handle →
      </button>
      <span id="wc-waitlist-anchor" />
    </section>
  )
}
