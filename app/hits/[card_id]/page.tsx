'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { generateCard, isFreeCell } from '../../../lib/hits/card-generator'
import { bestPayout, detectWins } from '../../../lib/hits/payouts'
import { CARD_TYPES, resolveCardType } from '../../../lib/hits/card-types'
import type { WinPattern } from '../../../lib/hits/types'

/* ────────────────────────────────────────────────────────────────────────
 * /hits/[card_id] — active card watching the simulated match
 *
 * Timer-driven event resolution. Each timeline event has an atMs offset
 * from the moment this page mounted; matching cells light up; win patterns
 * pop a celebratory modal. No persistence — refresh restarts the sample.
 * Share URL is the deterministic card_id so anyone with the link sees the
 * same card.
 * ──────────────────────────────────────────────────────────────────────── */

type PageProps = { params: { card_id: string } }

export default function HitsCardPage({ params }: PageProps) {
  const { card_id } = params
  const router = useRouter()
  const search = useSearchParams()
  const bet = Number(search?.get('bet') || '20')
  // ?speed=N compresses the 90s timeline to 90s/N. Clamp 1-20 so a typo
  // can't break the page; cap at 20 because below ~4.5s total runtime the
  // cells flicker faster than the eye can register.
  const speed = Math.max(1, Math.min(20, Number(search?.get('speed') || '1')))
  const cardType = resolveCardType(search?.get('type'))
  const meta = CARD_TYPES[cardType]
  const sample = meta.sample

  const card = useMemo(() => generateCard(card_id, bet, cardType), [card_id, bet, cardType])

  const [hitIndices, setHitIndices] = useState<Set<number>>(new Set([12])) // free cell always in
  const [justHitIdx, setJustHitIdx] = useState<number | null>(null)
  const [currentEvent, setCurrentEvent] = useState<{ clock: string; desc: string } | null>(null)
  const [winShown, setWinShown] = useState<WinPattern | null>(null)
  const [highestWinMult, setHighestWinMult] = useState(0)
  const [done, setDone] = useState(false)
  const [flashPattern, setFlashPattern] = useState<Set<number>>(new Set())

  useEffect(() => {
    const t0 = Date.now()
    const timers: ReturnType<typeof setTimeout>[] = []

    sample.timeline.forEach((te) => {
      const fireAt = te.atMs / speed
      const timer = setTimeout(() => {
        const elapsedFromT0 = Date.now() - t0
        if (elapsedFromT0 < 0) return

        setCurrentEvent({ clock: te.gameClock, desc: te.description })

        // Find cells matching this event id, light them up
        const matchingIndices: number[] = []
        card.cells.forEach((cell, idx) => {
          if (cell.id === te.eventId) matchingIndices.push(idx)
        })

        if (matchingIndices.length > 0) {
          setHitIndices((prev) => {
            const next = new Set(prev)
            matchingIndices.forEach((i) => next.add(i))
            // Check wins on the new set
            const wins = detectWins(next)
            const previousWinMaxMult = highestWinMult
            const newBest = wins.reduce((m, w) => Math.max(m, w.multiplier), 0)
            if (newBest > previousWinMaxMult) {
              const winningPattern = wins.find((w) => w.multiplier === newBest)
              if (winningPattern) {
                setFlashPattern(new Set(winningPattern.cellIndices))
                setHighestWinMult(newBest)
                setTimeout(() => setWinShown(winningPattern), 700)
                setTimeout(() => setFlashPattern(new Set()), 1100)
              }
            }
            return next
          })
          // Light the first matching cell with the pop animation
          setJustHitIdx(matchingIndices[0])
          setTimeout(() => setJustHitIdx(null), 600)
        }
      }, fireAt)
      timers.push(timer)
    })

    // Mark done after final event fires
    const endTimer = setTimeout(() => {
      setDone(true)
    }, sample.durationMs / speed + 500)
    timers.push(endTimer)

    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card_id])

  const payout = bestPayout(hitIndices, card.pricePhp)
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/hits/${card_id}?bet=${bet}` : ''

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: `Hula Hits card ${card_id}`,
          text: `Watch my Hula hits card for ${sample.home} vs ${sample.away}`,
          url: shareUrl,
        })
        .catch(() => {})
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
    }
  }

  function handleReplay() {
    // Force remount by routing with a noop change
    router.refresh()
    window.location.reload()
  }

  return (
    <main className="hula-v2">
      <div className="hits-shell">
        <header className="hits-header">
          <div className="hits-brand">
            Hula <em>Hits</em>
          </div>
          <button className="hits-back" onClick={() => router.push('/hits')}>
            ← New card
          </button>
        </header>

        <section className="hits-ticker">
          <span className="hits-ticker-clock">
            {currentEvent ? currentEvent.clock : (cardType === 'daily' ? '06:00 AM' : 'TIP-OFF')}
          </span>
          <span className="hits-ticker-event">
            {currentEvent ? currentEvent.desc : `${sample.home} vs ${sample.away}`}
          </span>
          <span className="hits-ticker-score">
            {hitIndices.size - 1}/24
          </span>
        </section>

        <section className="hits-card-meta">
          <span className="hits-card-meta-id">{card_id}</span>
          <span className="hits-card-meta-bet">₱{card.pricePhp} bet</span>
          <span className="hits-card-meta-payout" data-zero={payout.payoutPhp === 0}>
            {payout.payoutPhp > 0 ? `+₱${payout.payoutPhp.toLocaleString()}` : '—'}
          </span>
        </section>

        <section className="hits-card">
          {card.cells.map((cell, idx) => {
            const isHit = hitIndices.has(idx)
            const isFree = isFreeCell(idx)
            const state = isFree ? 'free' : isHit ? 'hit' : 'pending'
            return (
              <div
                key={idx}
                className="hits-cell"
                data-state={state}
                data-just-hit={justHitIdx === idx}
                data-pattern-flash={flashPattern.has(idx)}
              >
                {cell.label}
              </div>
            )
          })}
        </section>

        <section className="hits-active-actions">
          <button className="hits-share-btn" onClick={handleShare}>
            Share card
          </button>
          <button className="hits-replay-btn" onClick={handleReplay}>
            {done ? 'Buy another →' : 'Ulit'}
          </button>
        </section>

        <p className="hits-foot">
          Demo. <strong>Real hits follows a real game.</strong>
        </p>
      </div>

      {winShown && (
        <div
          className="hits-win-backdrop"
          onClick={(e) => e.target === e.currentTarget && setWinShown(null)}
        >
          <div className="hits-win-card">
            <span className="hits-win-badge">
              {winShown.kind === 'full' ? 'Jackpot!' : 'Panalo ka!'}
            </span>
            <h2 className="hits-win-h">
              {winShown.kind === 'full' ? (
                <><em>Full card.</em></>
              ) : (
                <>{winShown.label}<em>.</em></>
              )}
            </h2>
            <div className="hits-win-pattern">
              {winShown.multiplier}× your bet
            </div>
            <div className="hits-win-payout">
              <span className="hits-win-payout-amt">
                ₱{(card.pricePhp * winShown.multiplier).toLocaleString()}
              </span>
              <span className="hits-win-payout-mult">you win</span>
            </div>
            <button className="hits-win-close" onClick={() => setWinShown(null)}>
              Tuloy laro
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
