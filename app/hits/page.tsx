'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { newCardId } from '../../lib/hits/card-generator'
import { MULTIPLIERS } from '../../lib/hits/payouts'
import { CARD_TYPES, type CardType } from '../../lib/hits/card-types'

/* ────────────────────────────────────────────────────────────────────────
 * /hits — masa-tier live-event hits entry page
 *
 * Fixture-aware. Queries /api/fixtures on mount and picks the entry
 * mode based on schedule state:
 *   - live fixture exists      → Buy routes to ?live=1&match=X (live mode)
 *   - upcoming fixture within 8h → demo CTA + "next game" preview
 *   - no fixtures in window    → demo only (legacy behavior)
 *
 * Demo mode stays accessible from a secondary "play demo" button when
 * a fixture is upcoming. Share URLs without ?live still play the demo.
 * ──────────────────────────────────────────────────────────────────────── */

const STORAGE = {
  day: 'hula-hits-day',
  spend: 'hula-hits-session-spend',
  cards: 'hula-hits-session-cards',
  limit: 'hula-hits-daily-limit',
}

type Fixture = {
  id: string
  card_type: 'sports' | 'daily'
  match_label: string
  starts_at: string
  ends_at: string | null
  status: 'scheduled' | 'live' | 'final' | 'canceled'
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function readSession() {
  if (typeof window === 'undefined') return { day: todayISO(), spend: 0, cards: 0, limit: 0 }
  const day = localStorage.getItem(STORAGE.day) || todayISO()
  if (day !== todayISO()) {
    localStorage.setItem(STORAGE.day, todayISO())
    localStorage.setItem(STORAGE.spend, '0')
    localStorage.setItem(STORAGE.cards, '0')
    localStorage.removeItem(STORAGE.limit)
    return { day: todayISO(), spend: 0, cards: 0, limit: 0 }
  }
  return {
    day,
    spend: Number(localStorage.getItem(STORAGE.spend) || 0),
    cards: Number(localStorage.getItem(STORAGE.cards) || 0),
    limit: Number(localStorage.getItem(STORAGE.limit) || 0),
  }
}

function writeSession(s: { spend: number; cards: number; limit: number }) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE.day, todayISO())
  localStorage.setItem(STORAGE.spend, String(s.spend))
  localStorage.setItem(STORAGE.cards, String(s.cards))
  if (s.limit > 0) localStorage.setItem(STORAGE.limit, String(s.limit))
}

function formatStartTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === d.toDateString()
  const day = sameDay ? 'Today' : tomorrow ? 'Tomorrow' : d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${time}`
}

export default function HitsEntry() {
  const router = useRouter()
  const [price, setPrice] = useState<20 | 50>(20)
  const [type, setType] = useState<CardType>('sports')
  const [session, setSession] = useState({ spend: 0, cards: 0, limit: 0 })
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [liveFixture, setLiveFixture] = useState<Fixture | null>(null)
  const [upcomingFixture, setUpcomingFixture] = useState<Fixture | null>(null)

  useEffect(() => {
    setSession(readSession())
    setMounted(true)
  }, [])

  // Fetch fixtures on mount to determine mode.
  useEffect(() => {
    let cancelled = false
    fetch('/api/fixtures')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.ok) return
        const sportsLive = (j.live as Fixture[]).find((f) => f.card_type === 'sports')
        const sportsNext = (j.upcoming as Fixture[]).find((f) => f.card_type === 'sports')
        setLiveFixture(sportsLive ?? null)
        setUpcomingFixture(sportsNext ?? null)
      })
      .catch(() => {
        /* silent — page falls back to demo-only */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const wouldExceedLimit =
    session.limit > 0 && session.spend + price > session.limit

  const shouldOfferLimit = session.cards >= 2 && session.limit === 0

  function handleBuy() {
    if (wouldExceedLimit) return
    if (shouldOfferLimit) {
      setShowLimitModal(true)
      return
    }
    completePurchase()
  }

  async function completePurchase(opts: { forceDemo?: boolean } = {}) {
    const cardId = newCardId()
    const newSession = {
      spend: session.spend + price,
      cards: session.cards + 1,
      limit: session.limit,
    }
    writeSession(newSession)

    // Decide mode: only sports cards can go live (daily card stays
    // demo for now). Daily/forceDemo always stays demo.
    const goLive = !opts.forceDemo && type === 'sports' && liveFixture !== null
    const matchId = goLive ? liveFixture!.id : undefined

    // Best-effort persistence.
    try {
      await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, cardType: type, pricePhp: price, matchId }),
      })
    } catch (err) {
      console.error('[hits] /api/cards POST failed:', err)
    }

    const params = new URLSearchParams({ bet: String(price), type })
    if (goLive && matchId) {
      params.set('live', '1')
      params.set('match', matchId)
    }
    router.push(`/hits/${cardId}?${params.toString()}`)
  }

  function setLimit(amount: number) {
    const next = { ...session, limit: amount }
    writeSession(next)
    setSession(next)
    setShowLimitModal(false)
    setTimeout(() => completePurchase(), 120)
  }

  function skipLimit() {
    setShowLimitModal(false)
    setTimeout(() => completePurchase(), 120)
  }

  // Determine eyebrow + secondary CTA based on fixture state.
  const isLive = liveFixture !== null && type === 'sports'
  const isUpcoming = !isLive && upcomingFixture !== null && type === 'sports'

  return (
    <main className="hula-v2">
      <div className="hits-shell">
        <header className="hits-header">
          <div className="hits-brand">
            Hula <em>Hits</em>
          </div>
          {mounted && session.limit > 0 ? (
            <span className="hits-limit-chip">
              <span className="hits-limit-chip-dot" />
              ₱{session.spend}/₱{session.limit} today
            </span>
          ) : isLive ? (
            <span className="hits-eyebrow hits-eyebrow-live">
              <span className="hits-eyebrow-pulse" />
              LIVE NOW
            </span>
          ) : (
            <span className="hits-eyebrow">Demo</span>
          )}
        </header>

        {isLive && (
          <div className="hits-live-banner">
            <div className="hits-live-banner-label">Laro ngayon</div>
            <div className="hits-live-banner-title">{liveFixture!.match_label}</div>
          </div>
        )}

        {isUpcoming && (
          <div className="hits-upcoming-banner">
            <div className="hits-upcoming-banner-label">Next game</div>
            <div className="hits-upcoming-banner-title">{upcomingFixture!.match_label}</div>
            <div className="hits-upcoming-banner-when">{formatStartTime(upcomingFixture!.starts_at)}</div>
          </div>
        )}

        <div className="hits-today-eyebrow">Ang laro ngayon</div>
        <section className="hits-type-row">
          {(['sports', 'daily'] as const).map((t) => {
            const meta = CARD_TYPES[t]
            const m = meta.sample
            const selected = type === t
            return (
              <button
                key={t}
                className="hits-type-tile"
                data-selected={selected}
                data-kind={t}
                onClick={() => setType(t)}
              >
                <div className="hits-type-label">
                  <span className="hits-type-dot" /> {meta.label}
                </div>
                {t === 'sports' ? (
                  <div className="hits-type-anchor">
                    <div className="hits-type-anchor-head">{meta.sublabel}</div>
                    <div className="hits-type-anchor-vs">
                      <div className="hits-type-side">
                        <div className="hits-team-stripe" style={{ background: m.homeColor }} />
                        <div className="hits-type-side-name">{m.home}</div>
                      </div>
                      <span className="hits-type-vs">vs</span>
                      <div className="hits-type-side">
                        <div className="hits-team-stripe" style={{ background: m.awayColor }} />
                        <div className="hits-type-side-name">{m.away}</div>
                      </div>
                    </div>
                    <div className="hits-type-when">{meta.tagline}</div>
                  </div>
                ) : (
                  <div className="hits-type-anchor hits-type-anchor-daily">
                    <div className="hits-type-anchor-head">{meta.sublabel}</div>
                    <div className="hits-type-daily-stripe" />
                    <div className="hits-type-daily-date">
                      <svg
                        className="hits-type-daily-sun"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="4" fill="currentColor" />
                        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                          <line x1="12" y1="2" x2="12" y2="5" />
                          <line x1="12" y1="19" x2="12" y2="22" />
                          <line x1="2" y1="12" x2="5" y2="12" />
                          <line x1="19" y1="12" x2="22" y2="12" />
                          <line x1="4.9" y1="4.9" x2="6.9" y2="6.9" />
                          <line x1="17.1" y1="17.1" x2="19.1" y2="19.1" />
                          <line x1="4.9" y1="19.1" x2="6.9" y2="17.1" />
                          <line x1="17.1" y1="6.9" x2="19.1" y2="4.9" />
                        </g>
                      </svg>
                      <span>{meta.dateLabel}</span>
                    </div>
                    <div className="hits-type-when">{meta.windowLabel}</div>
                  </div>
                )}
              </button>
            )
          })}
        </section>

        <section className="hits-purchase">
          <h1 className="hits-purchase-h">
            Bili ng card.<br />Panóorin ang laro.<br /><em>Manalo ng pera.</em>
          </h1>
          <p className="hits-purchase-sub">
            Every box is something that can happen in the game. Get 5 in a row and win.
            Fill the whole card and win big.
          </p>

          <div className="hits-price-row">
            <button
              className="hits-price-btn"
              data-selected={price === 20}
              onClick={() => setPrice(20)}
            >
              <span className="hits-price-amt">₱20</span>
              <span className="hits-price-sub">card</span>
            </button>
            <button
              className="hits-price-btn"
              data-selected={price === 50}
              onClick={() => setPrice(50)}
            >
              <span className="hits-price-amt">₱50</span>
              <span className="hits-price-sub">Bigger wins</span>
            </button>
          </div>

          {wouldExceedLimit ? (
            <button className="hits-buy-btn" data-disabled="true" disabled>
              Tigil muna · balik bukas
            </button>
          ) : (
            <button className="hits-buy-btn" onClick={handleBuy}>
              {isLive
                ? `Sumali sa LIVE · ₱${price} →`
                : `Bumili ng ₱${price} card →`}
            </button>
          )}

          {isUpcoming && (
            <button
              className="hits-buy-secondary"
              onClick={() => completePurchase({ forceDemo: true })}
            >
              Play demo while you wait
            </button>
          )}

          <div className="hits-buy-meta">
            {isLive ? 'Live game · cells light up as it happens' : 'Demo only · no real money yet'}
          </div>
        </section>

        <section className="hits-payouts">
          <div className="hits-payouts-eyebrow">What you can win on a ₱{price} card</div>
          <div className="hits-payouts-list">
            <div className="hits-payout-row">
              <span className="hits-payout-label">5 in a row</span>
              <span className="hits-payout-mult">₱{(price * MULTIPLIERS.row).toLocaleString()}</span>
            </div>
            <div className="hits-payout-row">
              <span className="hits-payout-label">Corner to corner</span>
              <span className="hits-payout-mult">₱{(price * MULTIPLIERS.diag).toLocaleString()}</span>
            </div>
            <div className="hits-payout-row gold">
              <span className="hits-payout-label">All boxes (jackpot)</span>
              <span className="hits-payout-mult">₱{(price * MULTIPLIERS.full).toLocaleString()}</span>
            </div>
          </div>
        </section>

        <p className="hits-foot">
          21+ only · <strong>Play smart</strong> · Need help? Call 8521-1542
        </p>
      </div>

      {showLimitModal && (
        <div className="hits-limit-modal" onClick={(e) => e.target === e.currentTarget && skipLimit()}>
          <div className="hits-limit-card">
            <h2 className="hits-limit-h">
              Gumastos ka na ng ₱{session.spend} today. <em>Magtigil kailan?</em>
            </h2>
            <p className="hits-limit-sub">
              Pick your stop. We&apos;ll block the buy button when you hit it. Resets tomorrow.
            </p>
            <div className="hits-limit-opts">
              <button className="hits-limit-opt" onClick={() => setLimit(100)}>
                <span>Tigil sa ₱100</span>
              </button>
              <button className="hits-limit-opt hits-limit-opt-rec" onClick={() => setLimit(300)}>
                <span>Tigil sa ₱300</span>
              </button>
              <button className="hits-limit-opt" onClick={() => setLimit(500)}>
                <span>Tigil sa ₱500</span>
              </button>
              <button className="hits-limit-opt" onClick={() => setLimit(1000)}>
                <span>Tigil sa ₱1,000</span>
              </button>
            </div>
            <button className="hits-limit-skip" onClick={skipLimit}>
              Saka na
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
