'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { generateCard, isFreeCell, newCardId } from '../../../lib/hits/card-generator'
import { bestPayout, detectWins, MULTIPLIERS } from '../../../lib/hits/payouts'
import { CARD_TYPES, resolveCardType } from '../../../lib/hits/card-types'
import type { WinPattern } from '../../../lib/hits/types'
import { readBalance, credit, debit } from '../../../lib/identity/token-balance'
import { track } from '../../../lib/analytics/track'
import { ContactCaptureModal } from '../../../components/hits/ContactCaptureModal'
import { useModalA11y } from '../../../lib/hooks/useModalA11y'

const CAPTURE_KEY = 'hula-captured'
const CARD_COUNT_KEY = 'hula-hits-session-cards'

function shouldShowCapture(): boolean {
  if (typeof window === 'undefined') return false
  if (window.localStorage.getItem(CAPTURE_KEY) === '1') return false
  return true
}

function markCaptureShown() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CAPTURE_KEY, '1')
}

function sessionCardCount(): number {
  if (typeof window === 'undefined') return 0
  return Number(window.localStorage.getItem(CARD_COUNT_KEY) || 0)
}

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

  // Pass matchId so the client-side generator picks the same
  // match-aware pool the server used when /api/cards stored the row.
  // Always pass matchId — even in demo mode the server uses the same
  // DEFAULT_MATCH_BY_TYPE fallback, so client + server agree on the
  // pool. The pool-builder falls back to CANDIDATE_EVENTS for unknown
  // match ids, so this is safe.
  const card = useMemo(
    () => generateCard(card_id, bet, cardType, matchId),
    [card_id, bet, cardType, matchId]
  )

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
  const firstHitFiredRef = useRef(false)
  const [showCapture, setShowCapture] = useState(false)
  const winA11y = useModalA11y({ isOpen: winShown !== null, onClose: () => setWinShown(null) })

  useEffect(() => {
    setBalance(readBalance())
    track('card_opened', { bet, type: cardType, mode: live ? 'live' : 'demo', match_id: live ? matchId : null }, card_id)
    // If URL has ?ref=<card_id>, record the referral landing. Ref points
    // to the sharing user's card, which ties back to their device_id via
    // the cards table — no PII exposed client-side.
    const ref = search?.get('ref')
    if (ref) track('referral_visit', { ref }, card_id)

    // Threshold trigger: if this is the player's 3rd+ card this session
    // and they haven't been captured yet, surface the modal on mount.
    // (Win-trigger lives in the winShown effect below.)
    if (shouldShowCapture() && sessionCardCount() >= 3) {
      markCaptureShown()
      setShowCapture(true)
      track('contact_capture_shown', { trigger: 'card_count_3' }, card_id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // First non-free cell lighting up — landmark event for the funnel.
      if (!firstHitFiredRef.current) {
        firstHitFiredRef.current = true
        track('first_cell_lit', { event_key: eventKey }, card_id)
      }

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
  // Server is now the source of truth for payoutPhp: POST with empty body,
  // server recomputes from cells + events, returns canonical payoutPhp.
  // Client trusts the response, not the local winShown.multiplier.
  useEffect(() => {
    if (!winShown || wonPostedRef.current) return
    wonPostedRef.current = true

    // Optimistic UI: track the win event using the client-visible
    // multiplier so analytics reflects what the user actually saw.
    track(
      'win_shown',
      { kind: winShown.kind, multiplier: winShown.multiplier, bet: card.pricePhp },
      card_id
    )

    // Win-trigger for contact capture: queue it to appear after the user
    // dismisses the win modal (or alongside it, layered). Once-per-device
    // gating handled by the localStorage flag. markCaptureShown() lives
    // INSIDE the setTimeout so a user who closes the tab during the 1.8s
    // window doesn't get the flag set without ever seeing the modal.
    if (shouldShowCapture()) {
      setTimeout(() => {
        if (!shouldShowCapture()) return
        markCaptureShown()
        setShowCapture(true)
        track('contact_capture_shown', { trigger: 'win', kind: winShown.kind }, card_id)
      }, 1800)
    }

    // POST the claim with an empty body. Server recomputes payout from
    // cells + events. On 409 (no_win_yet — events haven't propagated
    // server-side yet), retry once after 1.5s; if still 409, accept the
    // cosmetic mismatch — the modal already showed locally, leaderboard
    // just won't see this card. Better than crediting a fake balance.
    const claimWin = async (attempt = 1): Promise<void> => {
      try {
        const res = await fetch(`/api/cards/${encodeURIComponent(card_id)}/won`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
        const j = await res.json().catch(() => null)
        if (res.status === 409 && attempt === 1) {
          // Events likely haven't propagated. One retry then give up.
          setTimeout(() => claimWin(2), 1500)
          return
        }
        if (j?.ok && typeof j.payoutPhp === 'number') {
          // Server-canonical credit. Replaces the client-side multiplier
          // path entirely.
          setBalance(credit(j.payoutPhp))
        }
      } catch {
        /* swallow — leaderboard miss is acceptable Phase 0 */
      }
    }
    claimWin()
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
    track('shuffle_used', { cost: shuffleCost, bet: card.pricePhp }, card_id)

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
  // Share URL carries ?ref=<card_id> so the receiving /hits/[id] page
  // can attribute the visit back to the sharing card → device_id (via
  // the cards table). Cleanest path to a K-factor without exposing the
  // HttpOnly device_id cookie to client JS.
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/hits/${card_id}?bet=${bet}&ref=${card_id}`
      : ''

  function handleShare() {
    track('share_clicked', { bet, type: cardType }, card_id)
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
        .then(() => track('share_completed', { method: 'native' }, card_id))
        .catch(() => {})
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
      track('share_completed', { method: 'clipboard' }, card_id)
    }
  }

  function handleReplay() {
    track('replay_clicked', { done }, card_id)
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

      {showCapture && (
        <ContactCaptureModal
          cardId={card_id}
          bet={card.pricePhp}
          winPattern={winShown?.kind}
          onClose={() => setShowCapture(false)}
        />
      )}

      {winShown && (
        <div
          className="hits-win-backdrop"
          onClick={(e) => e.target === e.currentTarget && setWinShown(null)}
        >
          <div ref={winA11y.containerRef} {...winA11y.dialogProps} className="hits-win-card">
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
