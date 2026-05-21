'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SAMPLE_MATCH } from '../../lib/bingo/sample-match'
import { newCardId } from '../../lib/bingo/card-generator'
import { MULTIPLIERS } from '../../lib/bingo/payouts'

/* ────────────────────────────────────────────────────────────────────────
 * /bingo — masa-tier live-event bingo entry page
 *
 * One-tap purchase flow. ₱20 or ₱50 card → routes to /bingo/[card_id].
 * No payment yet — purchase is fake. Tracks session spend in localStorage
 * so the responsible-bet-limit UX can fire after card #3.
 * Not linked from / — share URL manually for masa validation tests only.
 * ──────────────────────────────────────────────────────────────────────── */

const STORAGE = {
  day: 'hula-bingo-day',
  spend: 'hula-bingo-session-spend',
  cards: 'hula-bingo-session-cards',
  limit: 'hula-bingo-daily-limit',
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

export default function BingoEntry() {
  const router = useRouter()
  const [price, setPrice] = useState<20 | 50>(20)
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
    router.push(`/bingo/${cardId}?bet=${price}`)
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
      <div className="bingo-shell">
        <header className="bingo-header">
          <div className="bingo-brand">
            Hula <em>Bingo</em>
          </div>
          {mounted && session.limit > 0 ? (
            <span className="bingo-limit-chip">
              <span className="bingo-limit-chip-dot" />
              ₱{session.spend}/₱{session.limit} today
            </span>
          ) : (
            <span className="bingo-eyebrow">Demo</span>
          )}
        </header>

        <section className="bingo-match">
          <div className="bingo-match-league">{SAMPLE_MATCH.league}</div>
          <div className="bingo-match-teams">
            <div className="bingo-team">
              <div className="bingo-team-stripe" style={{ background: SAMPLE_MATCH.homeColor }} />
              <div className="bingo-team-name">{SAMPLE_MATCH.home}</div>
            </div>
            <div className="bingo-vs">vs</div>
            <div className="bingo-team">
              <div className="bingo-team-stripe" style={{ background: SAMPLE_MATCH.awayColor }} />
              <div className="bingo-team-name">{SAMPLE_MATCH.away}</div>
            </div>
          </div>
          <div className="bingo-match-when">{SAMPLE_MATCH.tipoff}</div>
        </section>

        <section className="bingo-purchase">
          <h1 className="bingo-purchase-h">
            Bili ng card.<br />Panóorin ang laro.<br /><em>Manalo ng pera.</em>
          </h1>
          <p className="bingo-purchase-sub">
            Every box is something that can happen in the game. Get 5 in a row and win.
            Fill the whole card and win big.
          </p>

          <div className="bingo-price-row">
            <button
              className="bingo-price-btn"
              data-selected={price === 20}
              onClick={() => setPrice(20)}
            >
              <span className="bingo-price-amt">₱20</span>
              <span className="bingo-price-sub">card</span>
            </button>
            <button
              className="bingo-price-btn"
              data-selected={price === 50}
              onClick={() => setPrice(50)}
            >
              <span className="bingo-price-amt">₱50</span>
              <span className="bingo-price-sub">Bigger wins</span>
            </button>
          </div>

          {wouldExceedLimit ? (
            <button className="bingo-buy-btn" data-disabled="true" disabled>
              Tigil muna · balik bukas
            </button>
          ) : (
            <button className="bingo-buy-btn" onClick={handleBuy}>
              Bumili ng ₱{price} card →
            </button>
          )}

          <div className="bingo-buy-meta">
            Demo only · no real money yet
          </div>
        </section>

        <section className="bingo-payouts">
          <div className="bingo-payouts-eyebrow">What you can win on a ₱{price} card</div>
          <div className="bingo-payouts-list">
            <div className="bingo-payout-row">
              <span className="bingo-payout-label">5 in a row</span>
              <span className="bingo-payout-mult">₱{(price * MULTIPLIERS.row).toLocaleString()}</span>
            </div>
            <div className="bingo-payout-row">
              <span className="bingo-payout-label">Corner to corner</span>
              <span className="bingo-payout-mult">₱{(price * MULTIPLIERS.diag).toLocaleString()}</span>
            </div>
            <div className="bingo-payout-row gold">
              <span className="bingo-payout-label">All boxes (jackpot)</span>
              <span className="bingo-payout-mult">₱{(price * MULTIPLIERS.full).toLocaleString()}</span>
            </div>
          </div>
        </section>

        <p className="bingo-foot">
          21+ only · <strong>Play smart</strong> · Need help? Call 8521-1542
        </p>
      </div>

      {showLimitModal && (
        <div className="bingo-limit-modal" onClick={(e) => e.target === e.currentTarget && skipLimit()}>
          <div className="bingo-limit-card">
            <h2 className="bingo-limit-h">
              Gumastos ka na ng ₱{session.spend} today. <em>Magtigil kailan?</em>
            </h2>
            <p className="bingo-limit-sub">
              Pick your stop. We&apos;ll block the buy button when you hit it. Resets tomorrow.
            </p>
            <div className="bingo-limit-opts">
              <button className="bingo-limit-opt" onClick={() => setLimit(100)}>
                <span>Tigil sa ₱100</span>
              </button>
              <button className="bingo-limit-opt bingo-limit-opt-rec" onClick={() => setLimit(300)}>
                <span>Tigil sa ₱300</span>
              </button>
              <button className="bingo-limit-opt" onClick={() => setLimit(500)}>
                <span>Tigil sa ₱500</span>
              </button>
              <button className="bingo-limit-opt" onClick={() => setLimit(1000)}>
                <span>Tigil sa ₱1,000</span>
              </button>
            </div>
            <button className="bingo-limit-skip" onClick={skipLimit}>
              Saka na
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
