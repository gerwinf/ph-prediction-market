'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { newCardId } from '../../lib/hits/card-generator'
import { MULTIPLIERS } from '../../lib/hits/payouts'
import { type CardType } from '../../lib/hits/card-types'
import { readBalance, debit, credit } from '../../lib/identity/token-balance'
import { track } from '../../lib/analytics/track'
import { useSession } from '../../lib/auth/use-session'
import { SignInModal } from '../../components/auth/SignInModal'
import { HitsMenu } from '../../components/hits/HitsMenu'
import { HitsBrand } from '../../components/hits/HitsBrand'
import { readSession, writeSession } from '../../lib/hits/session'
import { useLang } from '../../lib/hits/i18n/LanguageProvider'

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

type Fixture = {
  id: string
  card_type: 'sports' | 'daily'
  match_label: string
  starts_at: string
  ends_at: string | null
  status: 'scheduled' | 'live' | 'final' | 'canceled'
  venue: string | null
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
  const { t, tx } = useLang()
  const [price, setPrice] = useState<20 | 50>(20)
  const [type, setType] = useState<CardType>('sports')
  const [session, setSession] = useState({ spend: 0, cards: 0, limit: 0 })
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [liveFixture, setLiveFixture] = useState<Fixture | null>(null)
  const [upcomingFixtures, setUpcomingFixtures] = useState<Fixture[]>([])
  // Which upcoming game the user has picked to pre-buy. Null → the nearest
  // upcoming game (upcomingFixtures[0]) is the default target.
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [showSignIn, setShowSignIn] = useState(false)
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
        // Only fixtures with a real /hits event pool are shown: World Cup
        // (id `wc-…`, football pool) and PBA (id `pba-…`, basketball pool).
        // Any other prefix would fall back to a mismatched pool — a broken
        // card — so hide it until it has its own pool.
        const sportsUpcoming = (j.upcoming as Fixture[])
          .filter((f) => f.card_type === 'sports' && (f.id.startsWith('wc-') || f.id.startsWith('pba-')))
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        setLiveFixture(realLive ?? demoLive ?? null)
        setUpcomingFixtures(sportsUpcoming)
      })
      .catch(() => {
        /* silent — page falls back to demo-only */
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

  // Hero/buy target. A live fixture from the API is either a real game or the
  // always-on demo-pba-perpetual filler; split them so real upcoming games
  // (pre-buy) surface ABOVE the demo. Preference: the user's explicit pick →
  // real live game → nearest real upcoming → demo filler.
  const liveIsDemo = liveFixture?.id.startsWith('demo-') ?? false
  const realLive = liveFixture && !liveIsDemo ? liveFixture : null
  const demoFixture = liveFixture && liveIsDemo ? liveFixture : null
  const explicitPick = upcomingFixtures.find((f) => f.id === selectedFixtureId) ?? null
  const heroFixture =
    type === 'sports'
      ? explicitPick ?? realLive ?? upcomingFixtures[0] ?? demoFixture ?? null
      : null
  const heroIsDemo = heroFixture?.id.startsWith('demo-') ?? false
  const isLive = heroFixture !== null && heroFixture.status === 'live'
  const isUpcoming = heroFixture !== null && heroFixture.status === 'scheduled'
  // The upcoming game highlighted in the list (the one the main Buy will reserve).
  const activeUpcomingId = isUpcoming ? heroFixture!.id : null

  function handleBuy() {
    track('buy_clicked', {
      bet: price,
      type,
      mode: !heroFixture ? 'demo' : heroFixture.status === 'live' ? 'live' : 'prebuy',
    })
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

    const newSession = {
      spend: session.spend + price,
      cards: session.cards + 1,
      limit: session.limit,
    }
    writeSession(newSession)

    // Decide mode: only sports cards bind to a fixture (daily stays demo for
    // now). Binds to the hero fixture — whether it's live (join now) or
    // scheduled (pre-buy: the card sits dormant and lights up at tip-off).
    // forceDemo always stays demo.
    const goLive = !opts.forceDemo && type === 'sports' && heroFixture !== null
    const matchId = goLive ? heroFixture!.id : undefined

    // Server issues the card id (board choice must not be client-controlled).
    // Fallback to a local id only if the API is unreachable — demo keeps working.
    let cardId = newCardId()
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardType: type, pricePhp: price, matchId }),
      })
      if (res.status === 402) {
        // Authed user, insufficient balance. Refresh from server so the
        // chip reflects truth and bail.
        await auth.refresh()
        return
      }
      const j = await res.json().catch(() => null)
      if (res.status === 409 && j?.error === 'match_final') {
        // Fixture flipped final between page load and the buy. Refund the
        // optimistic anon debit; the fixtures refetch on next visit will
        // drop the dead game from the list.
        if (!auth.profile) setBalance(credit(price))
        return
      }
      if (j?.ok && typeof j.card?.id === 'string') cardId = j.card.id
      if (j?.ok && j.balance !== null && typeof j.balance === 'number') {
        // Authed: server is the source of truth. Refresh hook profile
        // so the chip + downstream pages see the new value.
        await auth.refresh()
      }
      track(
        'card_purchased',
        {
          bet: price,
          type,
          mode: goLive ? (heroFixture!.status === 'live' ? 'live' : 'prebuy') : 'demo',
          match_id: matchId ?? null,
        },
        cardId
      )
    } catch (err) {
      console.error('[hits] /api/cards POST failed:', err)
    }

    // ?new=1 marks the fresh acquisition — the card page consumes it once to
    // play the pack-rip reveal, then strips it from the URL.
    const params = new URLSearchParams({ bet: String(price), type, new: '1' })
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

  return (
    <main className="hula-v2 hits-dark">
      <div className="hits-shell">
        <header className="hits-header">
          <Link href="/" className="hits-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
            <HitsBrand />
          </Link>
          <div className="hits-header-right">
            {mounted && (
              auth.loading ? (
                // Don't show a number until we know authed vs anon — avoids
                // flashing the localStorage balance then snapping to profile.
                <span className="hits-token-chip hits-token-chip-loading" aria-hidden="true">
                  <span className="hits-token-chip-coin">₱</span>
                  •••
                </span>
              ) : (
                <span className="hits-token-chip" data-low={displayBalance < 100}>
                  <span className="hits-token-chip-coin">₱</span>
                  {displayBalance.toLocaleString()}
                </span>
              )
            )}
            <HitsMenu
              profile={
                auth.profile
                  ? { displayName: auth.profile.display_name, email: auth.profile.email }
                  : null
              }
              onSignIn={() => {
                setShowSignIn(true)
                track('signin_opened', { from: '/hits' })
              }}
              onSignOut={() => auth.signOut()}
              items={[
                {
                  key: 'binder',
                  label: t('menu.binder'),
                  onSelect: () => router.push('/hits/history'),
                },
              ]}
            />
          </div>
        </header>

        <section className="hits-purchase">
          <h1 className="hits-purchase-h">{tx('entry.purchaseH')}</h1>

          {/* Slim match strip — only when a REAL game is live or upcoming.
              Demo needs no context panel; the buy button says it all. */}
          {type === 'sports' && heroFixture && !heroIsDemo && (isLive || isUpcoming) && (
            <div className="hits-strip">
              <span className="hits-strip-badge" data-live={isLive}>
                {isLive ? (
                  <>
                    <span className="hits-hero-pulse" /> {t('entry.heroLiveBadge')}
                  </>
                ) : (
                  t('entry.heroUpcomingEyebrow')
                )}
              </span>
              <span className="hits-strip-label">{heroFixture.match_label}</span>
              {isUpcoming && (
                <span className="hits-strip-when">{formatStartTime(heroFixture.starts_at)}</span>
              )}
            </div>
          )}

          <p className="hits-purchase-sub">{t('entry.purchaseSub')}</p>

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
              <span className="hits-price-sub">{t('entry.priceCard')}</span>
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
              <span className="hits-price-sub">{t('entry.priceBigger')}</span>
            </button>
          </div>

          {wouldExceedBalance ? (
            <button className="hits-buy-btn" data-disabled="true" disabled>
              {t('entry.buyNoTokens')}
            </button>
          ) : wouldExceedLimit ? (
            <button className="hits-buy-btn" data-disabled="true" disabled>
              {t('entry.buyLimitReached')}
            </button>
          ) : (
            <button className="hits-buy-btn" onClick={handleBuy}>
              {type === 'daily'
                ? t('entry.buyDaily', { price })
                : isLive
                  ? heroIsDemo
                    ? t('entry.buyDemo', { price })
                    : t('entry.buyLive', { price })
                  : isUpcoming
                    ? t('entry.buyReserve', { price })
                    : t('entry.buyFallback', { price })}
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
            {type === 'sports' ? t('entry.toggleToDaily') : t('entry.toggleToSports')}
          </button>

          {isUpcoming && (
            <button
              className="hits-buy-secondary"
              onClick={() => completePurchase({ forceDemo: true })}
            >
              {t('entry.playDemoWhileWait')}
            </button>
          )}

        </section>

        {/* Upcoming PBA games — pick one to reserve a card before tip-off. */}
        {type === 'sports' && upcomingFixtures.length > 0 && (
          <section className="hits-upcoming">
            <div className="hits-upcoming-eyebrow">{t('entry.upcomingEyebrow')}</div>
            <div className="hits-upcoming-list">
              {upcomingFixtures.map((f) => {
                const active = f.id === activeUpcomingId
                return (
                  <button
                    key={f.id}
                    type="button"
                    className="hits-upcoming-row"
                    data-active={active}
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedFixtureId(f.id)
                      track('upcoming_selected', { match_id: f.id })
                    }}
                  >
                    <span className="hits-upcoming-info">
                      <span className="hits-upcoming-teams">{f.match_label}</span>
                      <span className="hits-upcoming-when">
                        {formatStartTime(f.starts_at)}
                        {f.venue ? ` · ${f.venue}` : ''}
                      </span>
                    </span>
                    <span className="hits-upcoming-cta">{active ? t('entry.reserveActive') : t('entry.reserve')}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section className="hits-payouts">
          <div className="hits-payouts-eyebrow">{t('entry.payoutsEyebrow', { price })}</div>
          <div className="hits-payouts-list">
            <div className="hits-payout-row">
              <span className="hits-payout-label">{t('entry.payout5row')}</span>
              <span className="hits-payout-mult">₱{(price * MULTIPLIERS.row).toLocaleString()}</span>
            </div>
            <div className="hits-payout-row">
              <span className="hits-payout-label">{t('entry.payoutCorner')}</span>
              <span className="hits-payout-mult">₱{(price * MULTIPLIERS.diag).toLocaleString()}</span>
            </div>
            <div className="hits-payout-row gold">
              <span className="hits-payout-label">{t('entry.payoutJackpot')}</span>
              <span className="hits-payout-mult">₱{(price * MULTIPLIERS.full).toLocaleString()}</span>
            </div>
          </div>
        </section>

        <p className="hits-foot">{tx('common.foot')}</p>
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
              {tx('entry.limitH', { spend: session.spend })}
            </h2>
            <p className="hits-limit-sub">{t('entry.limitSub')}</p>
            <div className="hits-limit-opts">
              <button className="hits-limit-opt" onClick={() => setLimit(100)}>
                <span>{t('entry.limitStop', { amount: (100).toLocaleString() })}</span>
              </button>
              <button className="hits-limit-opt hits-limit-opt-rec" onClick={() => setLimit(300)}>
                <span>{t('entry.limitStop', { amount: (300).toLocaleString() })}</span>
              </button>
              <button className="hits-limit-opt" onClick={() => setLimit(500)}>
                <span>{t('entry.limitStop', { amount: (500).toLocaleString() })}</span>
              </button>
              <button className="hits-limit-opt" onClick={() => setLimit(1000)}>
                <span>{t('entry.limitStop', { amount: (1000).toLocaleString() })}</span>
              </button>
            </div>
            <button className="hits-limit-skip" onClick={skipLimit}>
              {t('common.later')}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
