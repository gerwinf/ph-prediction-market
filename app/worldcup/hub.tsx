'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { type Contender } from '../../lib/worldcup/fixtures'
import { selectSpotlight, matchState, flagUrl, countdownParts, type Fixture } from '../../lib/worldcup/state'
import { allWcSlugs, matchHomePct, winnerPct, type PricesMap } from '../../lib/worldcup/odds'

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

      <Spotlight fixture={spotlight} now={now} prices={prices} onYes={setWaitlistFor} />

      <nav className="wc-tabs" aria-label="World Cup markets">
        <button className="wc-tab" data-active={tab === 'matches'} aria-pressed={tab === 'matches'} onClick={() => setTab('matches')}>
          Matches<span className="wc-tab-count">{gridFixtures.length}</span>
        </button>
        <button className="wc-tab" data-active={tab === 'winner'} aria-pressed={tab === 'winner'} onClick={() => setTab('winner')}>
          Who wins the Cup<span className="wc-tab-count">{contenders.length}</span>
        </button>
      </nav>

      {tab === 'matches'
        ? <MatchGrid fixtures={gridFixtures} now={now} prices={prices} onYes={setWaitlistFor} />
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
              <span className="wc-win-vol">Vol {r.vol}</span>
            </span>
            <span className="wc-win-prob">
              <span className="wc-win-pct">{r.pct}%</span>
              {r.delta !== 0 && (
                <span className="wc-win-delta" data-dir={r.delta > 0 ? 'up' : 'down'}>
                  {r.delta > 0 ? '▲' : '▼'} {Math.abs(r.delta)}
                </span>
              )}
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
// Group-stage codes ("A".."L") render as "Group A"; knockout stage names
// (e.g. "Round of 32", "Quarter-final") render as-is.
function groupLabel(group: string): string {
  return /^[A-Z]$/i.test(group) ? `Group ${group}` : group
}
function kickoffLabel(kickoffISO: string): string {
  const d = new Date(kickoffISO)
  const day = d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${time}`
}

function MatchGrid({
  fixtures, now, prices, onYes,
}: {
  fixtures: Fixture[]
  now: Date | null
  prices: PricesMap
  onYes: (c: string) => void
}) {
  if (fixtures.length === 0) return null
  return (
    <section className="wc-grid">
      <div className="wc-panel-note">Tap a team or draw to follow that market</div>
      <div className="wc-grid-list">
        {fixtures.map((f) => {
          const state = now ? matchState(f.kickoffISO, now) : 'scheduled'
          const homePct = matchHomePct(prices, f.slug, f.home.name, f.fallback.home)
          const drawPct = f.fallback.draw
          const awayPct = Math.max(0, 100 - homePct - drawPct)
          return (
            <article key={f.id} className="wc-mcard" data-state={state}>
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
                <button className="wc-codd wc-codd-team" onClick={() => onYes(`${f.home.name} to beat ${f.away.name}`)}>
                  <span className="wc-codd-lbl">{f.home.name}</span>
                  <span className="wc-codd-pct">{homePct}%</span>
                </button>
                <button className="wc-codd wc-codd-draw" onClick={() => onYes(`${f.home.name} v ${f.away.name} — Draw`)}>
                  <span className="wc-codd-lbl">Draw</span>
                  <span className="wc-codd-pct">{drawPct}%</span>
                </button>
                <button className="wc-codd wc-codd-team" onClick={() => onYes(`${f.away.name} to beat ${f.home.name}`)}>
                  <span className="wc-codd-lbl">{f.away.name}</span>
                  <span className="wc-codd-pct">{awayPct}%</span>
                </button>
              </div>
            </article>
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
function WaitlistModal({ context, onClose }: { context: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  // Dismiss on Escape and pull focus into the dialog when it opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'worldcup', why: context }),
      })
      setStatus(res.ok ? 'success' : 'error')
      if (res.ok) setEmail('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="wc-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wc-modal-card" role="dialog" aria-modal="true" aria-labelledby="wc-modal-title">
        <button className="wc-modal-x" onClick={onClose} aria-label="Close">×</button>
        <div className="wc-modal-eyebrow">World Cup 2026</div>
        <h3 className="wc-modal-title" id="wc-modal-title">{context}</h3>
        <p className="wc-modal-sub">
          We&apos;re pre-launch. Drop your email and we&apos;ll let you trade this market the moment we go live.
        </p>
        {status === 'success' ? (
          <div className="wc-modal-done">You&apos;re in — salamat! We&apos;ll be in touch.</div>
        ) : (
          <form className="wc-modal-form" onSubmit={submit}>
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.ph"
              disabled={status === 'loading'}
              required
            />
            <button type="submit" className="wc-cta-btn" disabled={status === 'loading' || !email.trim()}>
              {status === 'loading' ? 'Loading…' : 'Notify me →'}
            </button>
            {status === 'error' && <div className="wc-modal-err">Something broke. Try again.</div>}
          </form>
        )}
      </div>
    </div>
  )
}
