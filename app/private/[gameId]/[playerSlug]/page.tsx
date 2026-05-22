'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getPrivateGame,
  getPlayer,
  resolvePlayerCells,
} from '../../../../lib/private-games/registry'
import { HULA_FREE_ID } from '../../../../lib/private-games/types'
import type { Square } from '../../../../lib/private-games/types'
import { detectWins } from '../../../../lib/hits/payouts'
import type { WinPattern } from '../../../../lib/hits/types'

/* ────────────────────────────────────────────────────────────────────────
 * /private/[gameId]/[playerSlug] — founding-team dry-run card view
 *
 * Read-only spectator card. Ops-driven: cells light from /api/events
 * polled by match_id; predictions answered by ops via the /ops
 * Predictions editor (this page just renders them).
 *
 * Parallel to /hits/[card_id] — no shared file edits per spec rule.
 * ──────────────────────────────────────────────────────────────────── */

type Props = { params: { gameId: string; playerSlug: string } }

type EventRow = { id: number; event_key: string; payload: Record<string, unknown> | null; resolved_at: string }

export default function PrivateCardPage({ params }: Props) {
  const { gameId, playerSlug } = params
  const router = useRouter()

  const game = getPrivateGame(gameId)
  const player = game ? getPlayer(game, playerSlug) : null

  // Compute the 25 cells once. The list is stable per (game, player).
  const cells = useMemo<Square[]>(
    () => (game && player ? resolvePlayerCells(game, player) : []),
    [game, player]
  )

  const [predictionAnswers, setPredictionAnswers] = useState<Record<string, 'yes' | 'no'>>({})
  // Free cell (index 12) is always pre-lit.
  const freeIdx = cells.findIndex((c) => c.id === HULA_FREE_ID)
  const [hitIndices, setHitIndices] = useState<Set<number>>(() => new Set(freeIdx >= 0 ? [freeIdx] : []))
  const [justHitIdx, setJustHitIdx] = useState<number | null>(null)
  const [lastEvent, setLastEvent] = useState<{ key: string; ts: string } | null>(null)
  const [winShown, setWinShown] = useState<WinPattern | null>(null)
  const [highestWinMult, setHighestWinMult] = useState(0)
  const [flashPattern, setFlashPattern] = useState<Set<number>>(new Set())
  // Persistent "you have a win!" badge in the ticker once first achieved.
  const [bestWin, setBestWin] = useState<WinPattern | null>(null)

  // Fetch the card row (for prediction_answers).
  useEffect(() => {
    if (!game || !player) return
    const cardId = `priv-sake-okada-${player.slug}`
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/cards/${encodeURIComponent(cardId)}`, { cache: 'no-store' })
        const j = await res.json()
        if (cancelled || !j.ok) return
        const pa = (j.card?.prediction_answers as Record<string, 'yes' | 'no'>) ?? {}
        setPredictionAnswers(pa)
      } catch {
        /* swallow */
      }
    }
    tick()
    // Poll every 10s so ops-side changes show up without manual refresh.
    const interval = setInterval(tick, 10000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [game, player])

  // Live events poll. Full-list mode: each tick recomputes hitIndices
  // from scratch based on the current event list + prediction answers.
  // This means ops un-fire (DELETE /api/ops/events/:id) takes effect on
  // open player cards within ~3s — the deleted event drops out of the
  // poll response, and the cell un-lights on the next tick. Tracking
  // `prevHitsRef` lets us still trigger the pop animation when a NEW
  // cell appears.
  const prevHitsRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    if (!game) return
    let cancelled = false

    const fmtClock = (iso: string) => {
      const t = new Date(iso)
      return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`
    }

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/events?match=${encodeURIComponent(game.id)}`,
          { cache: 'no-store' }
        )
        const j = await res.json()
        if (cancelled || !j.ok || !Array.isArray(j.events)) return

        // Recompute the lit set from the FULL event list. Free cell
        // always in. Predictive cells require the player's stored
        // answer to match the event payload.answer.
        const nextHits = new Set<number>()
        if (freeIdx >= 0) nextHits.add(freeIdx)
        let latest: { key: string; ts: string } | null = null
        for (const ev of j.events as EventRow[]) {
          cells.forEach((cell, idx) => {
            if (cell.id !== ev.event_key) return
            if (cell.type === 'predictive') {
              const truth = (ev.payload?.answer as 'yes' | 'no' | undefined) ?? null
              const guess = predictionAnswers[cell.id]
              if (!truth || !guess || truth !== guess) return
            }
            nextHits.add(idx)
          })
          latest = { key: ev.event_key, ts: fmtClock(ev.resolved_at) }
        }

        // Pop-animate cells that are newly lit since last tick.
        const newlyLit: number[] = []
        nextHits.forEach((i) => {
          if (!prevHitsRef.current.has(i)) newlyLit.push(i)
        })
        prevHitsRef.current = nextHits

        setHitIndices(nextHits)
        if (newlyLit.length > 0) {
          setJustHitIdx(newlyLit[0])
          setTimeout(() => setJustHitIdx(null), 600)
        }
        if (latest) setLastEvent(latest)

        // Win detection: highest-multiplier completed pattern.
        const wins = detectWins(nextHits)
        if (wins.length > 0) {
          const best = wins.reduce((a, b) => (a.multiplier >= b.multiplier ? a : b))
          setBestWin(best)
          if (best.multiplier > highestWinMult) {
            setHighestWinMult(best.multiplier)
            setFlashPattern(new Set(best.cellIndices))
            setTimeout(() => setWinShown(best), 700)
            setTimeout(() => setFlashPattern(new Set()), 1100)
          }
        }
      } catch {
        /* swallow — next tick retries */
      }
    }
    tick()
    const interval = setInterval(tick, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, JSON.stringify(predictionAnswers), freeIdx])

  if (!game || !player) {
    return (
      <main style={shell}>
        <h1 style={h1}>Game not found</h1>
        <p style={muted}>
          Check the URL. Expected pattern: /private/&lt;game-id&gt;/&lt;player-slug&gt;
        </p>
        <button onClick={() => router.push('/hits')} style={btn}>← Back to /hits</button>
      </main>
    )
  }

  const observationalCells = cells.filter((c) => c.type === 'observational' && c.id !== HULA_FREE_ID)
  const markedObservational = observationalCells.filter((_, idx) => {
    const cellIdx = cells.findIndex((cc) => cc.id === observationalCells[idx].id)
    return cellIdx >= 0 && hitIndices.has(cellIdx)
  }).length

  return (
    <main className="hula-v2">
      <div className="hits-shell">
        <header className="hits-header">
          <div className="hits-brand">
            Hula <em>Private</em>
          </div>
          <button className="hits-back" onClick={() => router.push('/hits')}>
            ← /hits
          </button>
        </header>

        <section className="private-header">
          <h1 className="private-title">{game.title}</h1>
          <p className="private-player">
            <span className="private-player-name">{player.displayName}</span>
            <span className="private-player-score">
              {markedObservational} / {observationalCells.length} marked
            </span>
          </p>
        </section>

        <section className="hits-ticker">
          {bestWin ? (
            <span className="hits-mode-badge" data-status="live" style={{ background: '#d97706' }} onClick={() => setWinShown(bestWin)} title="Tap to view your win">
              🏆 {bestWin.kind === 'full' ? 'JACKPOT' : bestWin.kind === 'diag' ? 'CORNERS' : 'BINGO'}
            </span>
          ) : (
            <span className="hits-mode-badge" data-status="live">
              <span className="hits-mode-pulse" />
              PRIVATE
            </span>
          )}
          <span className="hits-ticker-clock">
            {lastEvent ? lastEvent.ts : '—'}
          </span>
          <span className="hits-ticker-event">
            {lastEvent ? lastEvent.key : 'Waiting for ops to fire events…'}
          </span>
        </section>

        <section className="hits-card">
          {cells.map((cell, idx) => {
            const isHit = hitIndices.has(idx)
            const isFree = cell.id === HULA_FREE_ID
            const isPredictive = cell.type === 'predictive'
            const answer = isPredictive ? predictionAnswers[cell.id] : undefined
            const state = isFree ? 'free' : isHit ? 'hit' : 'pending'
            return (
              <div
                key={`${idx}-${cell.id}`}
                className="hits-cell private-cell"
                data-state={state}
                data-just-hit={justHitIdx === idx}
                data-pattern-flash={flashPattern.has(idx)}
                data-predictive={isPredictive || undefined}
              >
                <div className="private-cell-label">{cell.label}</div>
                {isPredictive && (
                  <div
                    className="private-cell-pred-pill"
                    data-answer={answer ?? 'none'}
                  >
                    {answer ? answer.toUpperCase() : 'PREDICT'}
                  </div>
                )}
              </div>
            )
          })}
        </section>

        <p className="hits-foot">
          Dry run · ops drives the cells · score sa bar
        </p>
      </div>

      {winShown && (
        <div
          className="hits-win-backdrop"
          onClick={(e) => e.target === e.currentTarget && setWinShown(null)}
        >
          <div className="hits-win-card">
            <span className="hits-win-badge">
              {winShown.kind === 'full' ? 'Jackpot!' : 'Bingo!'}
            </span>
            <h2 className="hits-win-h">
              {winShown.kind === 'full' ? (
                <><em>Full card.</em></>
              ) : (
                <>{winShown.label}<em>.</em></>
              )}
            </h2>
            <div className="hits-win-pattern">
              {player.displayName}, claim it sa bar
            </div>
            <div className="hits-win-payout">
              {winShown.kind === 'full' ? (
                <>
                  <span className="hits-win-payout-amt">Jackpot rollover</span>
                  <span className="hits-win-payout-mult">
                    final amount calculated at the bar
                  </span>
                </>
              ) : (
                <>
                  <span className="hits-win-payout-amt">
                    ₱{game.payouts.firstBingoPhp.toLocaleString()} <em style={{ fontStyle: 'normal', opacity: 0.65 }}>/ ₱{game.payouts.secondBingoPhp.toLocaleString()}</em>
                  </span>
                  <span className="hits-win-payout-mult">
                    1st bingo / 2nd bingo · group decides at the bar
                  </span>
                </>
              )}
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

const shell: React.CSSProperties = {
  maxWidth: 480,
  margin: '40px auto',
  padding: '0 16px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, marginBottom: 8 }
const muted: React.CSSProperties = { color: '#888', fontSize: 14, marginBottom: 16 }
const btn: React.CSSProperties = {
  padding: '10px 16px',
  background: '#1a1a1a',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
}
