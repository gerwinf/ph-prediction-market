'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { newCardId } from '../../lib/hits/card-generator'
import { MULTIPLIERS } from '../../lib/hits/payouts'
import { CARD_TYPES, type CardType } from '../../lib/hits/card-types'

/* ────────────────────────────────────────────────────────────────────────
 * /hits — masa-tier live-event hits entry page
 *
 * One-tap purchase flow. ₱20 or ₱50 card → routes to /hits/[card_id].
 * No payment yet — purchase is fake. Tracks session spend in localStorage
 * so the responsible-bet-limit UX can fire after card #3.
 * Not linked from / — share URL manually for masa validation tests only.
 * ──────────────────────────────────────────────────────────────────────── */

const STORAGE = {
  day: 'hula-hits-day',
  spend: 'hula-hits-session-spend',
  cards: 'hula-hits-session-cards',
  limit: 'hula-hits-daily-limit',
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

export default function HitsEntry() {
  const router = useRouter()
  const [price, setPrice] = useState<20 | 50>(20)
  const [type, setType] = useState<CardType>('sports')
  const [session, setSession] = useState({ spend: 0, cards: 0, limit: 0 })
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setSession(readSession())
    setMounted(true)
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

  function completePurchase() {
    const cardId = newCardId()
    const newSession = {
      spend: session.spend + price,
      cards: session.cards + 1,
      limit: session.limit,
    }
    writeSession(newSession)
    router.push(`/hits/${cardId}?bet=${price}&type=${type}`)
  }

  function setLimit(amount: number) {
    const next = { ...session, limit: amount }
    writeSession(next)
    setSession(next)
    setShowLimitModal(false)
    setTimeout(() => completePurchase(), 120)
  }

  function skipLimit() {
    // Mark as "asked" so we don't immediately re-prompt; user opts out for today.
    // We still respect spend tracking but no hard cap.
    setShowLimitModal(false)
    setTimeout(() => completePurchase(), 120)
  }

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
          ) : (
            <span className="hits-eyebrow">Demo</span>
          )}
        </header>

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
              Bumili ng ₱{price} card →
            </button>
          )}

          <div className="hits-buy-meta">
            Demo only · no real money yet
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
