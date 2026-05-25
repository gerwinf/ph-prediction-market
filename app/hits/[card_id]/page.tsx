'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { generateCard, isFreeCell, newCardId } from '../../../lib/hits/card-generator'
import { bestPayout, detectWins, MULTIPLIERS } from '../../../lib/hits/payouts'
import { CARD_TYPES, resolveCardType } from '../../../lib/hits/card-types'
import type { WinPattern } from '../../../lib/hits/types'
import { readBalance, credit, debit } from '../../../lib/identity/token-balance'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}

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

  // Live mode: ?live=1 means events come from /api/events (Jade firing
  // from /ops) instead of the canned sample timeline. ?match=X tells us
  // which match's events to poll.
  const live = search?.get('live') === '1'
  const matchId =
    search?.get('match') || (cardType === 'sports' ? 'pba-gin-ros-2026-05-24' : 'daily-2026-07-20')

  const card = useMemo(() => generateCard(card_id, bet, cardType), [card_id, bet, cardType])

  const [hitIndices, setHitIndices] = useState<Set<number>>(new Set([12])) // free cell always in
  const [justHitIdx, setJustHitIdx] = useState<number | null>(null)
  const [currentEvent, setCurrentEvent] = useState<{ clock: string; desc: string } | null>(null)
  const [winShown, setWinShown] = useState<WinPattern | null>(null)
  const [highestWinMult, setHighestWinMult] = useState(0)
  const [done, setDone] = useState(false)
  const [flashPattern, setFlashPattern] = useState<Set<number>>(new Set())
  // Match status drives the LIVE / DEMO / FINAL badge + whether the
  // poll keeps running after catch-up.
  type MatchStatus = 'scheduled' | 'live' | 'final' | 'canceled' | 'unknown'
  const [matchStatus, setMatchStatus] = useState<MatchStatus>(live ? 'unknown' : 'scheduled')

  // Token balance + live wins ticker state.
  const [balance, setBalance] = useState(0)
  type LiveWin = { id: string; win_pattern: string; score: number; won_at: string }
  const [liveWins, setLiveWins] = useState<LiveWin[]>([])
  const wonPostedRef = useRef(false)

  useEffect(() => {
    setBalance(readBalance())
  }, [])

  // Fetch fixture once when in live mode to drive the badge + final-stop.
  useEffect(() => {
    if (!live || !matchId) return
    let cancelled = false
    fetch(`/api/fixtures/${encodeURIComponent(matchId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.ok && j.fixture) setMatchStatus(j.fixture.status as MatchStatus)
      })
      .catch(() => {
        /* swallow — badge stays 'unknown' */
      })
    return () => {
      cancelled = true
    }
  }, [live, matchId])

  // Shared "an event happened" handler. Used by both the demo timeline
  // and the live poll. Lights matching cells, detects wins, drives the
  // ticker. Pure on the prev state; safe to call from anywhere.
  const resolveEventByKey = useCallback(
    (eventKey: string, clockLabel: string, description: string) => {
      setCurrentEvent({ clock: clockLabel, desc: description })

      const matchingIndices: number[] = []
      card.cells.forEach((cell, idx) => {
        if (cell.id === eventKey) matchingIndices.push(idx)
      })
      if (matchingIndices.length === 0) return

      setHitIndices((prev) => {
        const next = new Set(prev)
        matchingIndices.forEach((i) => next.add(i))
        const wins = detectWins(next)
        const newBest = wins.reduce((m, w) => Math.max(m, w.multiplier), 0)
        if (newBest > highestWinMult) {
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
      setJustHitIdx(matchingIndices[0])
      setTimeout(() => setJustHitIdx(null), 600)
    },
    [card.cells, highestWinMult]
  )

  // When a win pattern is shown, credit the balance + persist to DB.
  // Idempotent via wonPostedRef so re-renders don't double-credit.
  useEffect(() => {
    if (!winShown || wonPostedRef.current) return
    wonPostedRef.current = true

    const payoutPhp = card.pricePhp * winShown.multiplier
    setBalance(credit(payoutPhp))

    // Best-effort POST to record the win. Silent fail OK — the
    // client-side balance update is the source of truth for the user.
    fetch(`/api/cards/${encodeURIComponent(card_id)}/won`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: winShown.kind, payoutPhp }),
    }).catch(() => {
      /* swallow */
    })
  }, [winShown, card.pricePhp, card_id])

  // Live wins ticker: poll /api/wins for other players' wins on this
  // match. Only in live mode. 5s cadence — wins are rarer than events.
  useEffect(() => {
    if (!live || !matchId) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/wins?match=${encodeURIComponent(matchId)}`,
          { cache: 'no-store', credentials: 'include' }
        )
        const j = await res.json()
        if (!cancelled && j.ok && Array.isArray(j.wins)) setLiveWins(j.wins)
      } catch {
        /* swallow */
      }
    }
    tick()
    const interval = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [live, matchId])

  // Pay-to-shuffle: re-roll the card for half the price. Only allowed
  // before any event has lit a non-free cell (hitIndices.size === 1
  // means only the free cell at index 12).
  const canShuffle = hitIndices.size === 1
  const shuffleCost = Math.round(card.pricePhp / 2)

  async function handleShuffle() {
    if (!canShuffle) return
    const result = debit(shuffleCost)
    if (!result.ok) return
    setBalance(result.newBalance)

    const newId = newCardId()
    try {
      await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: newId,
          cardType,
          pricePhp: card.pricePhp,
          matchId: live ? matchId : undefined,
        }),
      })
    } catch {
      /* swallow */
    }

    const params = new URLSearchParams({ bet: String(card.pricePhp), type: cardType })
    if (live) {
      params.set('live', '1')
      params.set('match', matchId)
    }
    router.replace(`/hits/${newId}?${params.toString()}`)
  }

  // Demo timeline (only when not in live mode).
  useEffect(() => {
    if (live) return
    const timers: ReturnType<typeof setTimeout>[] = []

    sample.timeline.forEach((te) => {
      const fireAt = te.atMs / speed
      timers.push(
        setTimeout(() => {
          resolveEventByKey(te.eventId, te.gameClock, te.description)
        }, fireAt)
      )
    })

    timers.push(
      setTimeout(() => {
        setDone(true)
      }, sample.durationMs / speed + 500)
    )

    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card_id, live])

  // Live poll: when ?live=1, fetch /api/events every 3s and resolve any
  // events we haven't seen yet. `since` cursor keeps the response small.
  // Mid-game join: first poll returns N existing events — stagger them
  // at 200ms (effective speed=8) so the user sees the catch-up replay
  // instead of all cells lighting up at once. After catch-up, settle
  // into the normal 3s live cadence. If matchStatus is 'final' on
  // first poll, do the catch-up then stop polling entirely.
  const sinceRef = useRef(0)
  const seenIdsRef = useRef<Set<number>>(new Set())
  const firstPollDoneRef = useRef(false)
  useEffect(() => {
    if (!live || !matchId) return
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    const fmtClock = (iso: string) => {
      const t = new Date(iso)
      return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`
    }

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/events?match=${encodeURIComponent(matchId)}&since=${sinceRef.current}`,
          { cache: 'no-store' }
        )
        const j = await res.json()
        if (cancelled || !j.ok || !Array.isArray(j.events)) return

        const newEvents = (j.events as Array<{ id: number; event_key: string; resolved_at: string }>)
          .filter((ev) => !seenIdsRef.current.has(ev.id))

        if (newEvents.length === 0) return

        // First poll with multiple events = mid-game catch-up: stagger.
        // Subsequent polls or single-event first poll = fire immediately.
        const isCatchUp = !firstPollDoneRef.current && newEvents.length > 1

        if (isCatchUp) {
          for (let i = 0; i < newEvents.length; i++) {
            if (cancelled) return
            const ev = newEvents[i]
            seenIdsRef.current.add(ev.id)
            if (ev.id > sinceRef.current) sinceRef.current = ev.id
            resolveEventByKey(ev.event_key, fmtClock(ev.resolved_at), ev.event_key)
            if (i < newEvents.length - 1) {
              await new Promise((r) => setTimeout(r, 200))
            }
          }
        } else {
          for (const ev of newEvents) {
            seenIdsRef.current.add(ev.id)
            if (ev.id > sinceRef.current) sinceRef.current = ev.id
            resolveEventByKey(ev.event_key, fmtClock(ev.resolved_at), ev.event_key)
          }
        }

        firstPollDoneRef.current = true

        // Stop polling once a final match has been caught up — no point
        // hammering for events that won't change.
        if (matchStatus === 'final' && interval) {
          clearInterval(interval)
          interval = null
          setDone(true)
        }
      } catch {
        /* swallow — next tick will retry */
      }
    }

    tick()
    interval = setInterval(tick, 3000)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, matchId, matchStatus])

  const payout = bestPayout(hitIndices, card.pricePhp)
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/hits/${card_id}?bet=${bet}` : ''

  function handleShare() {
    const shareText =
      cardType === 'daily'
        ? `Watch my Hula Hits card for ${meta.dateLabel}`
        : `Watch my Hula Hits card for ${sample.home} vs ${sample.away}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: `Hula Hits card ${card_id}`,
          text: shareText,
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
          <div className="hits-header-right">
            <span className="hits-token-chip" data-low={balance < 100}>
              <span className="hits-token-chip-coin">₱</span>
              {balance.toLocaleString()}
            </span>
            <button className="hits-back" onClick={() => router.push('/hits')}>
              ← New
            </button>
          </div>
        </header>

        {live && liveWins.length > 0 && (
          <section className="hits-wins-ticker">
            {liveWins.slice(0, 5).map((w) => (
              <span key={w.id} className="hits-wins-chip">
                🎉 player won ₱{w.score.toLocaleString()} · {timeAgo(w.won_at)}
              </span>
            ))}
          </section>
        )}

        <section className="hits-ticker">
          {live ? (
            <span
              className="hits-mode-badge"
              data-status={matchStatus}
            >
              {matchStatus === 'live' && (
                <>
                  <span className="hits-mode-pulse" />
                  LIVE
                </>
              )}
              {matchStatus === 'final' && 'FINAL'}
              {matchStatus === 'scheduled' && 'PRE-GAME'}
              {(matchStatus === 'unknown' || matchStatus === 'canceled') && '...'}
            </span>
          ) : (
            <span className="hits-mode-badge" data-status="demo">DEMO</span>
          )}
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

        {canShuffle && (
          <section className="hits-shuffle-row">
            <button
              className="hits-shuffle-btn"
              onClick={handleShuffle}
              disabled={balance < shuffleCost}
              title="Generate a fresh card. Available only before any event lights up."
            >
              {balance < shuffleCost
                ? `Walang ₱${shuffleCost} para sa shuffle`
                : `Iba ang card · ₱${shuffleCost} tokens`}
            </button>
          </section>
        )}

        <section className="private-payouts">
          <div className="private-payouts-title">
            Premyo · ₱{card.pricePhp} bet
          </div>
          <div className="private-payouts-row">
            <span className="private-payouts-label">📏 Row / Column</span>
            <span className="private-payouts-amt">
              ₱{(card.pricePhp * MULTIPLIERS.row).toLocaleString()} <em style={{ fontStyle: 'normal', opacity: 0.55 }}>· {MULTIPLIERS.row}×</em>
            </span>
          </div>
          <div className="private-payouts-row">
            <span className="private-payouts-label">↘ Diagonal</span>
            <span className="private-payouts-amt">
              ₱{(card.pricePhp * MULTIPLIERS.diag).toLocaleString()} <em style={{ fontStyle: 'normal', opacity: 0.55 }}>· {MULTIPLIERS.diag}×</em>
            </span>
          </div>
          <div className="private-payouts-row private-payouts-row-rollover">
            <span className="private-payouts-label">💰 Full card jackpot</span>
            <span className="private-payouts-amt">
              ₱{(card.pricePhp * MULTIPLIERS.full).toLocaleString()} <em style={{ fontStyle: 'normal', opacity: 0.55 }}>· {MULTIPLIERS.full}×</em>
            </span>
          </div>
          <div className="private-payouts-note">
            Highest pattern pays. Free cell ay laging in. Wins credit your token balance instantly.
          </div>
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
