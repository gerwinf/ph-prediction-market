'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SAMPLE_MATCH } from '../../../lib/bingo/sample-match'
import { generateCard, isFreeCell } from '../../../lib/bingo/card-generator'
import { bestPayout, detectWins } from '../../../lib/bingo/payouts'
import type { WinPattern } from '../../../lib/bingo/types'

/* ────────────────────────────────────────────────────────────────────────
 * /bingo/[card_id] — active card watching the simulated match
 *
 * Timer-driven event resolution. Each timeline event has an atMs offset
 * from the moment this page mounted; matching cells light up; win patterns
 * pop a celebratory modal. No persistence — refresh restarts the sample.
 * Share URL is the deterministic card_id so anyone with the link sees the
 * same card.
 * ──────────────────────────────────────────────────────────────────────── */

type PageProps = { params: { card_id: string } }

const SPEED_MULT = 1 // 1 = full 90s; bump to 3 for fast demo

export default function BingoCardPage({ params }: PageProps) {
  const { card_id } = params
  const router = useRouter()
  const search = useSearchParams()
  const bet = Number(search?.get('bet') || '20')

  const card = useMemo(() => generateCard(card_id, bet), [card_id, bet])

  const [hitIndices, setHitIndices] = useState<Set<number>>(new Set([12])) // free cell always in
  const [justHitIdx, setJustHitIdx] = useState<number | null>(null)
  const [currentEvent, setCurrentEvent] = useState<{ clock: string; desc: string } | null>(null)
  const [winShown, setWinShown] = useState<WinPattern | null>(null)
  const [highestWinMult, setHighestWinMult] = useState(0)
  const [done, setDone] = useState(false)
  const [flashPattern, setFlashPattern] = useState<Set<number>>(new Set())
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const t0 = Date.now()
    const timers: ReturnType<typeof setTimeout>[] = []

    SAMPLE_MATCH.timeline.forEach((te) => {
      const fireAt = te.atMs / SPEED_MULT
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
    }, SAMPLE_MATCH.durationMs / SPEED_MULT + 500)
    timers.push(endTimer)

    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card_id])

  const payout = bestPayout(hitIndices, card.pricePhp)
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/bingo/${card_id}?bet=${bet}` : ''

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: `Hula Bingo card ${card_id}`,
          text: `Watch my Hula bingo card for ${SAMPLE_MATCH.home} vs ${SAMPLE_MATCH.away}`,
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
      <div className="bingo-shell">
        <header className="bingo-header">
          <div className="bingo-brand">
            Hula <em>Bingo</em>
          </div>
          <button className="bingo-back" onClick={() => router.push('/bingo')}>
            ← New card
          </button>
        </header>

        <section className="bingo-ticker">
          <span className="bingo-ticker-clock">
            {currentEvent ? currentEvent.clock : 'TIP-OFF'}
          </span>
          <span className="bingo-ticker-event">
            {currentEvent ? currentEvent.desc : `${SAMPLE_MATCH.home} vs ${SAMPLE_MATCH.away}`}
          </span>
          <span className="bingo-ticker-score">
            {hitIndices.size - 1}/24
          </span>
        </section>

        <section className="bingo-card-meta">
          <span className="bingo-card-meta-id">{card_id}</span>
          <span className="bingo-card-meta-bet">₱{card.pricePhp} bet</span>
          <span className="bingo-card-meta-payout" data-zero={payout.payoutPhp === 0}>
            {payout.payoutPhp > 0 ? `+₱${payout.payoutPhp.toLocaleString()}` : '—'}
          </span>
        </section>

        <section className="bingo-card">
          {card.cells.map((cell, idx) => {
            const isHit = hitIndices.has(idx)
            const isFree = isFreeCell(idx)
            const state = isFree ? 'free' : isHit ? 'hit' : 'pending'
            return (
              <div
                key={idx}
                className="bingo-cell"
                data-state={state}
                data-just-hit={justHitIdx === idx}
                data-pattern-flash={flashPattern.has(idx)}
              >
                {cell.label}
              </div>
            )
          })}
        </section>

        <section className="bingo-active-actions">
          <button className="bingo-share-btn" onClick={handleShare}>
            Share card
          </button>
          <button className="bingo-replay-btn" onClick={handleReplay}>
            {done ? 'Buy another →' : 'Replay sample'}
          </button>
        </section>

        <p className="bingo-foot">
          Simulated match · 90-second timeline · <strong>real bingo runs on a real game</strong>
        </p>
      </div>

      {winShown && (
        <div
          className="bingo-win-backdrop"
          onClick={(e) => e.target === e.currentTarget && setWinShown(null)}
        >
          <div className="bingo-win-card">
            <span className="bingo-win-badge">
              {winShown.kind === 'full' ? 'Jackpot' : 'Bingo'}
            </span>
            <h2 className="bingo-win-h">
              {winShown.kind === 'full' ? (
                <><em>Full card.</em></>
              ) : (
                <>{winShown.label}<em>.</em></>
              )}
            </h2>
            <div className="bingo-win-pattern">
              {winShown.multiplier}× your ₱{card.pricePhp} bet
            </div>
            <div className="bingo-win-payout">
              <span className="bingo-win-payout-amt">
                ₱{(card.pricePhp * winShown.multiplier).toLocaleString()}
              </span>
              <span className="bingo-win-payout-mult">payout</span>
            </div>
            <button className="bingo-win-close" onClick={() => setWinShown(null)}>
              Keep watching
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
