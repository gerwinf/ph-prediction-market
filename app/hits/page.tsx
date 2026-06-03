'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { newCardId } from '../../lib/hits/card-generator'
import { MULTIPLIERS } from '../../lib/hits/payouts'
import { type CardType } from '../../lib/hits/card-types'
import { readBalance, debit } from '../../lib/identity/token-balance'
import { track } from '../../lib/analytics/track'
import { useSession } from '../../lib/auth/use-session'
import { SignInModal } from '../../components/auth/SignInModal'
import { AccountMenu } from '../../components/hits/AccountMenu'

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
  const [balance, setBalance] = useState(0)
  const [showSignIn, setShowSignIn] = useState(false)
  const [fixturesLoaded, setFixturesLoaded] = useState(false)
  const auth = useSession()

  useEffect(() => {
    setSession(readSession())
    setBalance(readBalance())
    setMounted(true)
    track('page_view', { route: '/hits' })
  }, [])

  // Fetch fixtures on mount to determine mode. Prefer real PBA fixtures
  // over the demo-pba-perpetual fallback; only surface demo when no real
  // sports fixture is live.
  useEffect(() => {
    let cancelled = false
    fetch('/api/fixtures')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.ok) return
        const liveFixtures = (j.live as Fixture[]).filter((f) => f.card_type === 'sports')
        const realLive = liveFixtures.find((f) => !f.id.startsWith('demo-'))
        const demoLive = liveFixtures.find((f) => f.id.startsWith('demo-'))
        const sportsNext = (j.upcoming as Fixture[]).find((f) => f.card_type === 'sports')
        setLiveFixture(realLive ?? demoLive ?? null)
        setUpcomingFixture(sportsNext ?? null)
      })
      .catch(() => {
        /* silent — page falls back to demo-only */
      })
      .finally(() => {
        if (!cancelled) setFixturesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Displayed balance: prefer authed profile balance over localStorage when
  // signed in. Authed users see the cross-device truth; anon users see
  // localStorage. Falls back to localStorage during the brief loading
  // window (auth.loading=true).
  const displayBalance = auth.profile ? auth.profile.virtual_balance : balance
  const wouldExceedLimit =
    session.limit > 0 && session.spend + price > session.limit
  const wouldExceedBalance = displayBalance < price

  const shouldOfferLimit = session.cards >= 2 && session.limit === 0

  function handleBuy() {
    track('buy_clicked', { bet: price, type, mode: liveFixture ? 'live' : 'demo' })
    if (wouldExceedLimit || wouldExceedBalance) return
    if (shouldOfferLimit) {
      setShowLimitModal(true)
      return
    }
    completePurchase()
  }

  async function completePurchase(opts: { forceDemo?: boolean } = {}) {
    // Anonymous users debit localStorage upfront for optimistic UX. Authed
    // users let the server decide — server returns 402 if insufficient,
    // and we surface that without a phantom debit.
    if (!auth.profile) {
      const result = debit(price)
      if (!result.ok) return
      setBalance(result.newBalance)
    }

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

    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, cardType: type, pricePhp: price, matchId }),
      })
      if (res.status === 402) {
        // Authed user, insufficient balance. Refresh from server so the
        // chip reflects truth and bail.
        await auth.refresh()
        return
      }
      const j = await res.json().catch(() => null)
      if (j?.ok && j.balance !== null && typeof j.balance === 'number') {
        // Authed: server is the source of truth. Refresh hook profile
        // so the chip + downstream pages see the new value.
        await auth.refresh()
      }
      track(
        'card_purchased',
        { bet: price, type, mode: goLive ? 'live' : 'demo', match_id: matchId ?? null },
        cardId
      )
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
          <div className="hits-header-right">
            {mounted && (
              <span className="hits-token-chip" data-low={displayBalance < 100}>
                <span className="hits-token-chip-coin">₱</span>
                {displayBalance.toLocaleString()}
              </span>
            )}
            {mounted && (
              auth.loading ? null : auth.profile ? (
                <AccountMenu
                  displayName={auth.profile.display_name}
                  email={auth.profile.email}
                  onHistory={() => router.push('/hits/history')}
                  onSignOut={() => auth.signOut()}
                />
              ) : (
                <button
                  className="hits-back"
                  onClick={() => {
                    setShowSignIn(true)
                    track('signin_opened', { from: '/hits' })
                  }}
                >
                  Sign in
                </button>
              )
            )}
          </div>
        </header>

        {/* Identity eyebrow — visible value prop without gating */}
        {mounted && !auth.loading && (
          <div className="hits-identity-row">
            {auth.profile ? (
              <span className="hits-identity-authed">
                Hi, <strong>{auth.profile.display_name}</strong> · Tokens saved sa account ✓
              </span>
            ) : (
              <span className="hits-identity-anon">
                🔓 Playing as anon ·{' '}
                <button
                  type="button"
                  onClick={() => {
                    setShowSignIn(true)
                    track('signin_opened', { from: 'identity_eyebrow' })
                  }}
                  className="hits-identity-link"
                >
                  Sign in to save tokens →
                </button>
              </span>
            )}
          </div>
        )}

        {/* Hero card — single source of truth for "what am I playing" */}
        <section
          className="hits-hero"
          data-mode={
            type === 'daily'
              ? 'daily'
              : !fixturesLoaded
                ? 'loading'
                : isLive && liveFixture!.id.startsWith('demo-')
                  ? 'demo'
                  : isLive
                    ? 'live'
                    : isUpcoming
                      ? 'upcoming'
                      : 'fallback'
          }
        >
          {type === 'sports' && !fixturesLoaded ? (
            <>
              <div className="hits-hero-eyebrow hits-hero-skeleton-line" aria-hidden="true">
                &nbsp;
              </div>
              <div className="hits-hero-title hits-hero-skeleton-line" aria-hidden="true">
                &nbsp;
              </div>
              <div className="hits-hero-sub hits-hero-skeleton-line" aria-hidden="true">
                &nbsp;
              </div>
              <span className="sr-only">Loading game info…</span>
            </>
          ) : type === 'sports' && isLive ? (
            <>
              <div className="hits-hero-eyebrow">
                {liveFixture!.id.startsWith('demo-') ? (
                  <>DEMO · LIVE</>
                ) : (
                  <><span className="hits-hero-pulse" /> LIVE NA</>
                )}
              </div>
              <div className="hits-hero-title">{liveFixture!.match_label}</div>
              <div className="hits-hero-sub">
                {liveFixture!.id.startsWith('demo-')
                  ? 'Subukan habang naghihintay sa real game'
                  : 'Cells light up habang nangyayari ang laro'}
              </div>
            </>
          ) : type === 'sports' && isUpcoming ? (
            <>
              <div className="hits-hero-eyebrow">SUSUNOD NA LARO</div>
              <div className="hits-hero-title">{upcomingFixture!.match_label}</div>
              <div className="hits-hero-sub">{formatStartTime(upcomingFixture!.starts_at)}</div>
            </>
          ) : type === 'sports' ? (
            <>
              <div className="hits-hero-eyebrow">DEMO</div>
              <div className="hits-hero-title">Hula Demo Card</div>
              <div className="hits-hero-sub">Sample cells, no live game</div>
            </>
          ) : (
            <>
              <div className="hits-hero-eyebrow">MANILA · TODAY</div>
              <div className="hits-hero-title">Daily card</div>
              <div className="hits-hero-sub">
                {new Date().toLocaleDateString('en-PH', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                · 6 AM → MIDNIGHT
              </div>
            </>
          )}
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
              onClick={() => {
                setPrice(20)
                track('bet_amount_clicked', { bet: 20 })
              }}
            >
              <span className="hits-price-amt">₱20</span>
              <span className="hits-price-sub">card</span>
            </button>
            <button
              className="hits-price-btn"
              data-selected={price === 50}
              onClick={() => {
                setPrice(50)
                track('bet_amount_clicked', { bet: 50 })
              }}
            >
              <span className="hits-price-amt">₱50</span>
              <span className="hits-price-sub">Bigger wins</span>
            </button>
          </div>

          {wouldExceedBalance ? (
            <button className="hits-buy-btn" data-disabled="true" disabled>
              Walang tokens · balik bukas
            </button>
          ) : wouldExceedLimit ? (
            <button className="hits-buy-btn" data-disabled="true" disabled>
              Tigil muna · balik bukas
            </button>
          ) : (
            <button className="hits-buy-btn" onClick={handleBuy}>
              {type === 'daily'
                ? `Bumili ng daily card · ₱${price} →`
                : isLive
                  ? liveFixture!.id.startsWith('demo-')
                    ? `Subukan ang demo · ₱${price} →`
                    : `Sumali sa LIVE · ₱${price} →`
                  : `Bumili ng ₱${price} card →`}
            </button>
          )}

          {/* Type toggle as a secondary link, not a parallel tile */}
          <button
            type="button"
            className="hits-secondary-link"
            onClick={() => {
              const next = type === 'sports' ? 'daily' : 'sports'
              setType(next)
              track('card_type_selected', { type: next })
            }}
          >
            {type === 'sports' ? '→ Or play the daily card' : '← Back to sports'}
          </button>

          {isUpcoming && (
            <button
              className="hits-buy-secondary"
              onClick={() => completePurchase({ forceDemo: true })}
            >
              Play demo while you wait
            </button>
          )}

          <div className="hits-buy-meta">
            {type === 'daily'
              ? 'Daily card · all-day window · no real money yet'
              : isLive
                ? liveFixture!.id.startsWith('demo-')
                  ? 'Demo · auto-fired events · no real money yet'
                  : 'Live game · cells light up as it happens'
                : 'Demo only · no real money yet'}
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

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          redirectTo="/hits"
        />
      )}

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
