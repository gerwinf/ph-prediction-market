'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getPrivateGame,
  getPlayer,
  resolvePlayerCells,
} from '../../../../lib/private-games/registry'
import { HULA_FREE_ID } from '../../../../lib/private-games/types'
import type { Square } from '../../../../lib/private-games/types'

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

  // Process an event firing — light matching cells. Observational
  // squares: light any cell where cell.id === event_key. Predictive
  // squares: only light if the player's stored answer matches the
  // payload.answer.
  const resolveEvent = useCallback(
    (eventKey: string, payload: Record<string, unknown> | null, ts: string) => {
      setLastEvent({ key: eventKey, ts })
      const matching: number[] = []
      cells.forEach((cell, idx) => {
        if (cell.id !== eventKey) return
        if (cell.type === 'predictive') {
          const truth = (payload?.answer as 'yes' | 'no' | undefined) ?? null
          const guess = predictionAnswers[cell.id]
          if (!truth || !guess || truth !== guess) return
        }
        matching.push(idx)
      })
      if (matching.length === 0) return
      setHitIndices((prev) => {
        const next = new Set(prev)
        matching.forEach((i) => next.add(i))
        return next
      })
      setJustHitIdx(matching[0])
      setTimeout(() => setJustHitIdx(null), 600)
    },
    [cells, predictionAnswers]
  )

  // Live events poll. 3s cadence matching /hits/[id].
  const sinceRef = useRef(0)
  const seenIdsRef = useRef<Set<number>>(new Set())
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
          `/api/events?match=${encodeURIComponent(game.id)}&since=${sinceRef.current}`,
          { cache: 'no-store' }
        )
        const j = await res.json()
        if (cancelled || !j.ok || !Array.isArray(j.events)) return
        for (const ev of j.events as EventRow[]) {
          if (seenIdsRef.current.has(ev.id)) continue
          seenIdsRef.current.add(ev.id)
          if (ev.id > sinceRef.current) sinceRef.current = ev.id
          resolveEvent(ev.event_key, ev.payload, fmtClock(ev.resolved_at))
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
  }, [game, resolveEvent])

  // Re-run resolve when predictionAnswers updates — any past predictive
  // events that the player's new answer matches should light. We do
  // this by resetting seen-ids + the since cursor, then the next poll
  // re-fetches and replays.
  useEffect(() => {
    sinceRef.current = 0
    seenIdsRef.current = new Set()
    // hitIndices for the free cell stays; predictive lights re-derive
    // on the next poll cycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(predictionAnswers)])

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
          <span className="hits-mode-badge" data-status="live">
            <span className="hits-mode-pulse" />
            PRIVATE
          </span>
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
