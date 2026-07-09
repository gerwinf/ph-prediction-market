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
import { useSession } from '../../../lib/auth/use-session'
import { SignInModal } from '../../../components/auth/SignInModal'
import { HitsMenu } from '../../../components/hits/HitsMenu'
import { HitsBrand } from '../../../components/hits/HitsBrand'
import { useLang } from '../../../lib/hits/i18n/LanguageProvider'
import { wcCodesFromMatchId } from '../../../lib/hits/feed-fifa'
import { WC_TEAMS } from '../../../lib/hits/players-wc'
import { PackRipReveal } from '../../../components/hits/PackRipReveal'
import { shouldShowRip, buildRevealPlan, revealDurationMs } from '../../../lib/hits/reveal'
import { readSession, writeSession, wouldExceedLimit, type HitsSession } from '../../../lib/hits/session'

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

/**
 * Short team codes for the scoreboard. World Cup fixture ids carry them
 * directly (wc-por-esp-… → POR/ESP); anything else falls back to the first
 * three letters of each side of the "Home vs Away" label.
 */
function teamCodes(matchId: string, matchLabel: string): [string, string] {
  const wc = wcCodesFromMatchId(matchId)
  if (wc) return wc
  const [h, a] = matchLabel.split(/\s+vs\.?\s+/i)
  const code = (s?: string) => (s ?? '').trim().slice(0, 3).toUpperCase() || '···'
  return [code(h), code(a)]
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

export function HitsCardClient({ params }: PageProps) {
  // Keyed remount: App Router reuses the page component instance across
  // card_id changes (shuffle / buy-another-pack navigate card → card), which
  // would carry over hitIndices/done/win state into the new card. The key
  // guarantees every card starts from a clean mount.
  return <HitsCardView key={params.card_id} params={params} />
}

function HitsCardView({ params }: PageProps) {
  const { card_id } = params
  const router = useRouter()
  const { t, tx } = useLang()
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
    search?.get('match') || (cardType === 'sports' ? 'wc-por-esp-2026-07-06' : 'daily-2026-07-20')

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
  // Pre-buy: a card bound to a not-yet-started game. We capture the fixture's
  // label + tip-off so the pre-game banner can say when cells will light up,
  // plus the running score for the scoreboard (null until the feed reports).
  const [fixtureInfo, setFixtureInfo] = useState<{
    matchLabel: string
    startsAt: string
    homeScore: number | null
    awayScore: number | null
  } | null>(null)
  // Demo scoreboard: running [home, away] carried on the sample timeline.
  const [demoScore, setDemoScore] = useState<[number, number] | null>(null)

  // Token balance + live wins ticker state.
  const [balance, setBalance] = useState(0)
  type LiveWin = { id: string; win_pattern: string; score: number; won_at: string }
  const [liveWins, setLiveWins] = useState<LiveWin[]>([])
  const wonPostedRef = useRef(false)
  const firstHitFiredRef = useRef(false)
  const [showCapture, setShowCapture] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const winA11y = useModalA11y({ isOpen: winShown !== null, onClose: () => setWinShown(null) })
  const auth = useSession()

  // Gacha reveal + post-rip upsell. `?new=1` marks a fresh acquisition (set by
  // every buy path); it's consumed once and stripped from the URL so a refresh
  // or a binder-open never re-rips. The strip shows even when the animation is
  // skipped (reduced motion / ?speed) — the upsell beat isn't motion-gated.
  // 'pack' → overlay with the booster pack; 'cascade' → cells animate onto
  // the REAL board (same grid, same position — no jump when it settles);
  // null → reveal finished. Testers lost the plot when the flourish faded in
  // 500ms on a separately-positioned overlay grid; the cascade now happens in
  // place and holds long enough to read.
  const [ripPhase, setRipPhase] = useState<'pack' | 'cascade' | null>(null)
  const ripping = ripPhase !== null
  const [postRip, setPostRip] = useState(false)
  const [session, setSession] = useState<HitsSession>({ day: '', spend: 0, cards: 0, limit: 0 })
  useEffect(() => {
    setSession(readSession())
    if (search?.get('new') !== '1') return
    const params = new URLSearchParams(search?.toString() ?? '')
    params.delete('new')
    router.replace(`/hits/${card_id}?${params.toString()}`, { scroll: false })
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (shouldShowRip({ isNew: true, speed, prefersReducedMotion })) {
      setRipPhase('pack')
      track('pack_rip_shown', { bet, type: cardType }, card_id)
    }
    setPostRip(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // In-place cascade: reveal order + per-cell delays over the real board.
  const revealPlan = useMemo(() => buildRevealPlan(card.cells), [card.cells])
  const revealByIdx = useMemo(() => {
    const m = new Map<number, { delayMs: number; rare: boolean }>()
    revealPlan.forEach((step) => m.set(step.idx, { delayMs: step.delayMs, rare: step.rare }))
    return m
  }, [revealPlan])
  const rareCount = useMemo(() => revealPlan.filter((step) => step.rare).length, [revealPlan])
  useEffect(() => {
    if (ripPhase !== 'cascade') return
    const timer = setTimeout(() => setRipPhase(null), revealDurationMs(revealPlan))
    return () => clearTimeout(timer)
  }, [ripPhase, revealPlan])

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

  // Fetch fixture status to drive the badge + final-stop. For a pre-bought
  // (scheduled) card we keep polling so the card auto-flips to LIVE the moment
  // ops tips the game off — no reload needed. During a live game the poll
  // keeps running to refresh the scoreboard (home/away score); it stops for
  // good once the game is final/canceled.
  useEffect(() => {
    if (!live || !matchId) return
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    const load = async () => {
      try {
        const res = await fetch(`/api/fixtures/${encodeURIComponent(matchId)}`, { cache: 'no-store' })
        const j = await res.json()
        if (cancelled || !j.ok || !j.fixture) return
        setMatchStatus(j.fixture.status as MatchStatus)
        setFixtureInfo({
          matchLabel: j.fixture.match_label,
          startsAt: j.fixture.starts_at,
          homeScore: j.fixture.home_score ?? null,
          awayScore: j.fixture.away_score ?? null,
        })
        // Nothing changes after the final whistle — stop the poll.
        if ((j.fixture.status === 'final' || j.fixture.status === 'canceled') && interval) {
          clearInterval(interval)
          interval = null
        }
      } catch {
        /* swallow — badge stays 'unknown' */
      }
    }

    load()
    interval = setInterval(load, 15000)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
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
          if (auth.profile) {
            // Authed: server already credited profiles.virtual_balance.
            // Refresh hook to pick up the new value; localStorage is
            // irrelevant for authed users.
            await auth.refresh()
          } else {
            // Anon: credit localStorage. Same behavior as before.
            setBalance(credit(j.payoutPhp))
          }
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
    // Same final-whistle guard as handleBuyPack — a re-roll on a finished
    // match would be a dead card.
    if (live && (matchStatus === 'final' || matchStatus === 'canceled')) {
      router.push('/hits')
      return
    }
    const result = debit(shuffleCost)
    if (!result.ok) return
    setBalance(result.newBalance)
    track('shuffle_used', { cost: shuffleCost, bet: card.pricePhp }, card_id)

    // Server issues the card id (board choice must not be client-controlled).
    // Fallback to a local id only if the API is unreachable — demo keeps working.
    let newId = newCardId()
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardType,
          pricePhp: card.pricePhp,
          matchId: live ? matchId : undefined,
        }),
      })
      if (res.status === 409) {
        const j = await res.json().catch(() => null)
        if (j?.error === 'match_final') {
          setBalance(credit(shuffleCost))
          router.push('/hits')
          return
        }
      }
      const j = await res.json().catch(() => null)
      if (j?.ok && typeof j.card?.id === 'string') newId = j.card.id
    } catch {
      /* swallow */
    }

    const params = new URLSearchParams({ bet: String(card.pricePhp), type: cardType })
    if (live) {
      params.set('live', '1')
      params.set('match', matchId)
    }
    // A shuffle is a re-pull: the replacement card rips again.
    params.set('new', '1')
    router.replace(`/hits/${newId}?${params.toString()}`)
  }

  // Demo timeline (only when not in live mode). Holds until the pack-rip
  // reveal finishes so the post-rip strip gets its window before the first
  // event lights a cell — the demo sim is client-local, so delaying its t0 is
  // harmless (live mode is server-driven and never held).
  useEffect(() => {
    if (live || ripping) return
    const timers: ReturnType<typeof setTimeout>[] = []

    sample.timeline.forEach((te) => {
      const fireAt = te.atMs / speed
      timers.push(
        setTimeout(() => {
          resolveEventByKey(te.eventId, te.gameClock, te.description)
          if (te.score) setDemoScore(te.score)
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
  }, [card_id, live, ripping])

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

    // FIFA-synced events carry the match minute + real commentary in the
    // payload; ops-fired events may not. Fall back to wall clock + key.
    type LiveEvent = {
      id: number
      event_key: string
      resolved_at: string
      payload?: { minute?: string; description?: string } | null
    }
    const clockOf = (ev: LiveEvent) => ev.payload?.minute || fmtClock(ev.resolved_at)
    const descOf = (ev: LiveEvent) => ev.payload?.description || ev.event_key

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/events?match=${encodeURIComponent(matchId)}&since=${sinceRef.current}`,
          { cache: 'no-store' }
        )
        const j = await res.json()
        if (cancelled || !j.ok || !Array.isArray(j.events)) return

        const newEvents = (j.events as LiveEvent[])
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
            resolveEventByKey(ev.event_key, clockOf(ev), descOf(ev))
            if (i < newEvents.length - 1) {
              await new Promise((r) => setTimeout(r, 200))
            }
          }
        } else {
          for (const ev of newEvents) {
            seenIdsRef.current.add(ev.id)
            if (ev.id > sinceRef.current) sinceRef.current = ev.id
            resolveEventByKey(ev.event_key, clockOf(ev), descOf(ev))
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
  // Scoreboard: live cards read the fixture row (fed by the FIFA sync), demo
  // cards read the annotated sample timeline. Daily cards have no score.
  const score: [number, number] | null = live
    ? fixtureInfo && fixtureInfo.homeScore !== null && fixtureInfo.awayScore !== null
      ? [fixtureInfo.homeScore, fixtureInfo.awayScore]
      : null
    : demoScore
  const [homeCode, awayCode] = teamCodes(
    matchId,
    fixtureInfo?.matchLabel ?? `${sample.home} vs ${sample.away}`
  )
  // Label shown before the fixture fetch returns. Derived from the match id
  // (available instantly) so a live card never flashes the demo sample's
  // "Portugal vs Spain" while loading. Demo cards keep the sample label.
  const matchLabelFallback = (() => {
    if (!live) return `${sample.home} vs ${sample.away}`
    const codes = wcCodesFromMatchId(matchId)
    if (codes) {
      const full = (c: string) =>
        (WC_TEAMS as Record<string, { full: string }>)[c]?.full ?? c
      return `${full(codes[0])} vs ${full(codes[1])}`
    }
    return `${homeCode} vs ${awayCode}`
  })()
  // Share URL carries ?ref=<card_id> so the receiving /hits/[id] page
  // can attribute the visit back to the sharing card → device_id (via
  // the cards table). Cleanest path to a K-factor without exposing the
  // HttpOnly device_id cookie to client JS.
  // It must ALSO carry the card's mode (type + live/match) — without those
  // the recipient of a live card lands in demo mode instead of the game.
  const shareUrl = (() => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams({ bet: String(bet), type: cardType, ref: card_id })
    if (live) {
      params.set('live', '1')
      params.set('match', matchId)
    }
    return `${window.location.origin}/hits/${card_id}?${params.toString()}`
  })()

  function handleShare() {
    track('share_clicked', { bet, type: cardType }, card_id)
    const shareText =
      cardType === 'daily'
        ? `Watch my Hula Hits card for ${meta.dateLabel}`
        : `Watch my Hula Hits card for ${fixtureInfo?.matchLabel ?? matchLabelFallback}`
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

  // Buy another pack — the upsell CTA on the post-rip strip and the
  // card-complete footer. A real purchase with the same guards as the landing
  // page: anon debits localStorage up front, daily-limit cap blocks the buy,
  // authed users are settled server-side (402 on insufficient balance).
  const displayBalance = auth.profile ? auth.profile.virtual_balance : balance
  const packBlocked =
    displayBalance < card.pricePhp || wouldExceedLimit(session, card.pricePhp)

  async function handleBuyPack(source: 'post_rip' | 'complete') {
    if (packBlocked) return
    // Game over — another card for THIS match could never light a cell.
    // Send the player to the entry page to pick the next game instead.
    if (live && (matchStatus === 'final' || matchStatus === 'canceled')) {
      track('another_card_redirected_final', { source }, card_id)
      router.push('/hits')
      return
    }
    track('another_card_clicked', { done, bet: card.pricePhp, source }, card_id)

    if (!auth.profile) {
      const result = debit(card.pricePhp)
      if (!result.ok) return
      setBalance(result.newBalance)
    }
    const nextSession = { ...session, spend: session.spend + card.pricePhp, cards: session.cards + 1 }
    writeSession(nextSession)
    setSession(nextSession)

    // Server issues the card id (board choice must not be client-controlled).
    // Fallback to a local id only if the API is unreachable — demo keeps working.
    let newId = newCardId()
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardType,
          pricePhp: card.pricePhp,
          matchId: live ? matchId : undefined,
        }),
      })
      if (res.status === 402) {
        await auth.refresh()
        return
      }
      if (res.status === 409) {
        const j = await res.json().catch(() => null)
        if (j?.error === 'match_final') {
          // Match flipped final between our status poll and the buy.
          // Refund the optimistic anon debit and bounce to the entry page.
          if (!auth.profile) setBalance(credit(card.pricePhp))
          router.push('/hits')
          return
        }
      }
      const j = await res.json().catch(() => null)
      if (j?.ok && typeof j.card?.id === 'string') newId = j.card.id
    } catch {
      /* swallow — page still routes, card_id seeds the client view */
    }
    const params = new URLSearchParams({ bet: String(card.pricePhp), type: cardType, new: '1' })
    if (live) {
      params.set('live', '1')
      params.set('match', matchId)
    }
    router.push(`/hits/${newId}?${params.toString()}`)
  }

  return (
    <main className="hula-v2 hits-dark">
      <div className="hits-shell">
        <header className="hits-header">
          <div className="hits-brand">
            <HitsBrand />
          </div>
          <div className="hits-header-right">
            {auth.loading ? (
              // Placeholder until authed vs anon is known — prevents the
              // localStorage balance flashing before the profile balance.
              <span className="hits-token-chip hits-token-chip-loading" aria-hidden="true">
                <span className="hits-token-chip-coin">₱</span>
                •••
              </span>
            ) : (
              <span
                className="hits-token-chip"
                data-low={(auth.profile ? auth.profile.virtual_balance : balance) < 100}
              >
                <span className="hits-token-chip-coin">₱</span>
                {(auth.profile ? auth.profile.virtual_balance : balance).toLocaleString()}
              </span>
            )}
            <HitsMenu
              profile={
                auth.profile
                  ? { displayName: auth.profile.display_name, email: auth.profile.email }
                  : null
              }
              onSignIn={() => {
                setShowSignIn(true)
                track('signin_opened', { from: '/hits/[card_id]' })
              }}
              onSignOut={() => auth.signOut()}
              items={[
                { key: 'new', label: t('menu.newCard'), onSelect: () => router.push('/hits') },
                {
                  key: 'binder',
                  label: t('menu.binder'),
                  onSelect: () => router.push('/hits/history'),
                },
              ]}
            />
          </div>
        </header>

        {live && liveWins.length > 0 && (
          <section className="hits-wins-ticker">
            {liveWins.slice(0, 5).map((w) => (
              <span key={w.id} className="hits-wins-chip">
                {t('card.playerWon', { score: w.score.toLocaleString(), ago: timeAgo(w.won_at) })}
              </span>
            ))}
          </section>
        )}

        <section className="hits-score">
          <div className="hits-score-top">
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
            <span className="hits-score-clock">
              {currentEvent ? currentEvent.clock : (cardType === 'daily' ? '06:00 AM' : 'KICK-OFF')}
            </span>
            <span className="hits-score-hits">{hitIndices.size - 1}/24</span>
          </div>
          {cardType === 'sports' && (
            <div className="hits-score-line" aria-label={`${homeCode} ${score?.[0] ?? 0}, ${awayCode} ${score?.[1] ?? 0}`}>
              <span className="hits-score-team">{homeCode}</span>
              {score ? (
                <span className="hits-score-nums">
                  <span className="hits-score-num">{score[0]}</span>
                  <span className="hits-score-sep">–</span>
                  <span className="hits-score-num">{score[1]}</span>
                </span>
              ) : (
                <span className="hits-score-vs">vs</span>
              )}
              <span className="hits-score-team">{awayCode}</span>
            </div>
          )}
          <div className="hits-score-event">
            {currentEvent
              ? currentEvent.desc
              : fixtureInfo?.matchLabel ?? matchLabelFallback}
          </div>
        </section>

        {live && matchStatus === 'scheduled' && (
          <section className="hits-pregame-banner">
            <strong>{fixtureInfo?.matchLabel ?? t('card.reserved')}</strong>
            <span>
              {fixtureInfo
                ? t('card.pregameWithTip', {
                    time: new Date(fixtureInfo.startsAt).toLocaleString('en-PH', {
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    }),
                  })
                : t('card.pregameNoTip')}
            </span>
          </section>
        )}

        <section className="hits-card-meta">
          <button
            type="button"
            className="hits-card-meta-binder"
            onClick={() => router.push('/hits/history')}
          >
            {t('menu.binder')} →
          </button>
          <span className="hits-card-meta-bet">{t('card.betSuffix', { amount: card.pricePhp })}</span>
          <span className="hits-card-meta-payout" data-zero={payout.payoutPhp === 0}>
            {payout.payoutPhp > 0 ? `+₱${payout.payoutPhp.toLocaleString()}` : '—'}
          </span>
        </section>

        {/* During the reveal the cascade animates THESE cells (same grid,
            same position — the board never jumps). 'pack' hides them behind
            the overlay; 'cascade' staggers them in, rares last. Tap skips. */}
        <section
          className="hits-card"
          data-rip-phase={ripPhase ?? undefined}
          onClick={ripPhase === 'cascade' ? () => setRipPhase(null) : undefined}
        >
          {card.cells.map((cell, idx) => {
            const isHit = hitIndices.has(idx)
            const isFree = isFreeCell(idx)
            const state = isFree ? 'free' : isHit ? 'hit' : 'pending'
            const step = ripPhase === 'cascade' ? revealByIdx.get(idx) : undefined
            return (
              <div
                key={idx}
                className="hits-cell"
                data-state={state}
                data-rarity={cell.rarity}
                data-just-hit={justHitIdx === idx}
                data-pattern-flash={flashPattern.has(idx)}
                data-reveal={step ? (step.rare ? 'rare' : 'common') : undefined}
                style={step ? { animationDelay: `${step.delayMs}ms` } : undefined}
              >
                {cell.label}
              </div>
            )
          })}
        </section>

        {ripPhase === 'cascade' && (
          <section className="hits-rip-under" aria-live="polite">
            {rareCount > 0 && (
              <div className="hits-rip-rare-note">{t('rip.rareNote', { n: rareCount })}</div>
            )}
            <div className="hits-rip-skip">{t('rip.skip')}</div>
          </section>
        )}

        {postRip && canShuffle && !done && !ripping ? (
          <section className="hits-postrip-strip">
            <div className="hits-postrip-q">{t('strip.q')}</div>
            <button className="hits-postrip-keep" onClick={() => setPostRip(false)}>
              {t('strip.keep')}
            </button>
            <div className="hits-postrip-row">
              <button
                className="hits-postrip-btn"
                onClick={handleShuffle}
                disabled={balance < shuffleCost}
              >
                {balance < shuffleCost
                  ? t('card.shuffleNoFunds', { cost: shuffleCost })
                  : t('strip.shuffle', { cost: shuffleCost })}
              </button>
              <button
                className="hits-postrip-btn"
                onClick={() => handleBuyPack('post_rip')}
                disabled={packBlocked}
              >
                {packBlocked ? t('strip.blocked') : t('strip.another', { price: card.pricePhp })}
              </button>
            </div>
          </section>
        ) : canShuffle && !ripping ? (
          <section className="hits-shuffle-row">
            <button
              className="hits-shuffle-btn"
              onClick={handleShuffle}
              disabled={balance < shuffleCost}
              title={t('card.shuffleTitle')}
            >
              {balance < shuffleCost
                ? t('card.shuffleNoFunds', { cost: shuffleCost })
                : t('card.shuffleDo', { cost: shuffleCost })}
            </button>
          </section>
        ) : null}

        <section className="private-payouts">
          <div className="private-payouts-title">
            {t('card.payoutsTitle', { amount: card.pricePhp })}
          </div>
          <div className="private-payouts-row">
            <span className="private-payouts-label">{t('card.payoutRowCol')}</span>
            <span className="private-payouts-amt">
              ₱{(card.pricePhp * MULTIPLIERS.row).toLocaleString()} <em style={{ fontStyle: 'normal', opacity: 0.55 }}>· {MULTIPLIERS.row}×</em>
            </span>
          </div>
          <div className="private-payouts-row">
            <span className="private-payouts-label">{t('card.payoutDiag')}</span>
            <span className="private-payouts-amt">
              ₱{(card.pricePhp * MULTIPLIERS.diag).toLocaleString()} <em style={{ fontStyle: 'normal', opacity: 0.55 }}>· {MULTIPLIERS.diag}×</em>
            </span>
          </div>
          <div className="private-payouts-row private-payouts-row-rollover">
            <span className="private-payouts-label">{t('card.payoutFull')}</span>
            <span className="private-payouts-amt">
              ₱{(card.pricePhp * MULTIPLIERS.full).toLocaleString()} <em style={{ fontStyle: 'normal', opacity: 0.55 }}>· {MULTIPLIERS.full}×</em>
            </span>
          </div>
          <div className="private-payouts-note">{t('card.payoutsNote')}</div>
        </section>

        {done ? (
          <section className="hits-active-actions hits-complete">
            <div className="hits-complete-note">
              {highestWinMult > 0 ? t('complete.noteWin') : t('complete.note')}
            </div>
            <button
              className="hits-replay-btn hits-complete-primary"
              onClick={() => handleBuyPack('complete')}
              disabled={packBlocked}
            >
              {packBlocked ? t('complete.blocked') : t('complete.buy', { price: card.pricePhp })}
            </button>
            <div className="hits-complete-row">
              <button className="hits-share-btn" onClick={handleShare}>
                {t('card.share')}
              </button>
              <button className="hits-share-btn" onClick={() => router.push('/hits/history')}>
                {t('complete.binder')}
              </button>
            </div>
          </section>
        ) : (
          <section className="hits-active-actions">
            <button className="hits-share-btn" onClick={handleShare}>
              {t('card.share')}
            </button>
            <button
              className="hits-replay-btn"
              onClick={() => handleBuyPack('complete')}
              disabled={packBlocked}
            >
              {packBlocked ? t('card.noTokens') : t('complete.buy', { price: card.pricePhp })}
            </button>
          </section>
        )}

        <p className="hits-foot">{tx('card.foot')}</p>
      </div>

      {ripPhase === 'pack' && (
        <PackRipReveal
          title={fixtureInfo?.matchLabel ?? matchLabelFallback}
          sublabel={meta.sublabel}
          onRip={() => setRipPhase('cascade')}
        />
      )}

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          redirectTo={`/hits/${card_id}?bet=${bet}${live ? `&live=1&match=${matchId}` : ''}`}
        />
      )}

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
              {winShown.kind === 'full' ? t('card.winBadgeJackpot') : t('card.winBadge')}
            </span>
            <h2 className="hits-win-h">
              {winShown.kind === 'full' ? (
                tx('card.winFull')
              ) : (
                <>{winShown.label}<em>.</em></>
              )}
            </h2>
            <div className="hits-win-pattern">
              {t('card.winMult', { mult: winShown.multiplier })}
            </div>
            <div className="hits-win-payout">
              <span className="hits-win-payout-amt">
                ₱{(card.pricePhp * winShown.multiplier).toLocaleString()}
              </span>
              <span className="hits-win-payout-mult">{t('card.youWin')}</span>
            </div>
            <button className="hits-win-close" onClick={() => setWinShown(null)}>
              {t('card.winClose')}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
