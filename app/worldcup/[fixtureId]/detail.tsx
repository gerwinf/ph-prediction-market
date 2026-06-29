'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { matchState, countdownParts, type Fixture } from '../../../lib/worldcup/state'
import { matchHomePct, type PricesMap } from '../../../lib/worldcup/odds'
import { fixtureVolLabel, resolutionText } from '../../../lib/worldcup/market'
import { Flag, WaitlistModal, groupLabel, kickoffLabel } from '../shared'

/* /worldcup/[fixtureId] — single match market page. Server-rendered fixture
 * (page.tsx) + best-effort live Polymarket overlay. CTA opens the waitlist
 * modal (no real bet flow yet). See
 * docs/superpowers/specs/2026-06-29-worldcup-market-detail-page-design.md. */

export default function MarketDetail({ fixture }: { fixture: Fixture }) {
  const [now, setNow] = useState<Date | null>(null)
  const [prices, setPrices] = useState<PricesMap>({})
  const [waitlistFor, setWaitlistFor] = useState<string | null>(null)

  // Defer `now` to mount (avoids hydration mismatch); tick for the countdown.
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Best-effort live odds for this fixture's slug. Any failure keeps fallbacks.
  useEffect(() => {
    if (!fixture.slug) return
    let cancelled = false
    fetch(`/api/prices?events=${fixture.slug}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: PricesMap) => { if (!cancelled) setPrices(data) })
      .catch(() => { /* keep fallbacks */ })
    return () => { cancelled = true }
  }, [fixture.slug])

  const state = now ? matchState(fixture.kickoffISO, now) : 'scheduled'
  const cd = now ? countdownParts(fixture.kickoffISO, now) : { d: 0, h: 0, m: 0, s: 0 }
  const homePct = matchHomePct(prices, fixture.slug, fixture.home.name, fixture.fallback.home)
  const drawPct = fixture.fallback.draw
  const awayPct = Math.max(0, 100 - homePct - drawPct)
  const vol = fixtureVolLabel(prices, fixture)

  const badge =
    state === 'live' ? <span className="wc-badge wc-badge-live"><i aria-hidden="true" /> LIVE</span>
    : state === 'final' ? <span className="wc-badge wc-badge-final">FULL TIME</span>
    : <span className="wc-badge wc-badge-soon" suppressHydrationWarning>
        {cd.d > 0 ? `${cd.d}d ` : ''}
        {String(cd.h).padStart(2, '0')}:{String(cd.m).padStart(2, '0')}:{String(cd.s).padStart(2, '0')}
      </span>

  return (
    <main className="hula-v2 wc">
      <header className="wc-header">
        <Link href="/worldcup" className="wc-back">← All matches</Link>
        <span className="wc-wordmark">World Cup <em>2026</em></span>
        <span className="wc-updated"><span className="wc-updated-dot" /> live odds</span>
      </header>

      {/* 1. Matchup header */}
      <section className="wc-detail-hero" data-state={state}>
        <div className="wc-detail-eyebrow">{groupLabel(fixture.group)} · {kickoffLabel(fixture.kickoffISO)}</div>
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
      </section>

      {/* 2. Odds panel — the action surface */}
      <section className="wc-detail-panel">
        <div className="wc-panel-note">Match result · price = chance · tap to follow</div>
        <div className="wc-odds-row">
          <button className="wc-odd wc-odd-home" onClick={() => setWaitlistFor(`${fixture.home.name} to beat ${fixture.away.name}`)}>
            <span className="wc-odd-lbl">{fixture.home.name}</span>
            <span className="wc-odd-pct">{homePct}%</span>
          </button>
          <button className="wc-odd wc-odd-draw" onClick={() => setWaitlistFor(`${fixture.home.name} v ${fixture.away.name} — Draw`)}>
            <span className="wc-odd-lbl">Draw</span>
            <span className="wc-odd-pct">{drawPct}%</span>
          </button>
          <button className="wc-odd wc-odd-away" onClick={() => setWaitlistFor(`${fixture.away.name} to beat ${fixture.home.name}`)}>
            <span className="wc-odd-lbl">{fixture.away.name}</span>
            <span className="wc-odd-pct">{awayPct}%</span>
          </button>
        </div>
      </section>

      {/* 3. Live volume */}
      <section className="wc-detail-stats">
        <div className="wc-detail-stat">
          <span className="wc-detail-stat-val">{vol.label}</span>
          <span className="wc-detail-stat-lbl">{vol.live ? 'Market volume · live' : 'Market volume · indicative'}</span>
        </div>
      </section>

      {/* 4. Market details / resolution */}
      <section className="wc-detail-rules">
        <h2 className="wc-detail-rules-title">How this market resolves</h2>
        <p className="wc-detail-rules-body">{resolutionText(fixture)}</p>
        <dl className="wc-detail-meta">
          <div><dt>Closes</dt><dd>{kickoffLabel(fixture.kickoffISO)}</dd></div>
          <div><dt>Source</dt><dd>{fixture.slug ? 'Live odds via Polymarket' : 'Curated odds'}</dd></div>
        </dl>
        <p className="wc-detail-disclaimer">21+ only · Pre-launch — no real bets yet</p>
      </section>

      {waitlistFor && <WaitlistModal context={waitlistFor} onClose={() => setWaitlistFor(null)} />}
    </main>
  )
}
