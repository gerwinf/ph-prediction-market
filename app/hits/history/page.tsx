'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { timeAgo } from '../../../lib/format/time-ago'
import { useSession } from '../../../lib/auth/use-session'
import { SignInModal } from '../../../components/auth/SignInModal'
import { track } from '../../../lib/analytics/track'
import { generateCard, isFreeCell } from '../../../lib/hits/card-generator'
import { deriveBinderStats, binderHitIndices } from '../../../lib/hits/binder'
import { useLang } from '../../../lib/hits/i18n/LanguageProvider'
import { LangToggle } from '../../../components/hits/LangToggle'
import type { StringKey } from '../../../lib/hits/i18n/strings'

/* ────────────────────────────────────────────────────────────────────────
 * /hits/history — the binder
 *
 * The collection view: every card is a pocket with a mini 5×5 showing how it
 * filled in. Card generation is deterministic (id+type+match), so pockets
 * regenerate cells client-side and light them from the match's fired event
 * keys (/api/events) — same rule as the live card page. Data source is the
 * unchanged /api/cards (authed → user_id; anon → device_id scope).
 * ──────────────────────────────────────────────────────────────────────── */

type HistoryCard = {
  id: string
  match_id: string
  match_label: string
  card_type: 'sports' | 'daily'
  price_php: number
  won: boolean
  win_pattern: string | null
  score: number
  created_at: string
}

const PAGE = 20
// Distinct matches to fetch event keys for. Pockets beyond this cap render
// with only the free cell lit rather than issuing unbounded fetches.
const MAX_EVENT_MATCHES = 8

const PATTERN_KEY: Record<string, StringKey> = {
  row: 'history.patternRow',
  col: 'history.patternCol',
  diag: 'history.patternDiag',
  full: 'history.patternFull',
}

export default function BinderPage() {
  const router = useRouter()
  const auth = useSession()
  const { t, tx } = useLang()
  const [cards, setCards] = useState<HistoryCard[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  // matchId → fired event keys; matchId set of currently-live fixtures.
  const [eventKeys, setEventKeys] = useState<Record<string, string[]>>({})
  const [liveMatchIds, setLiveMatchIds] = useState<Set<string>>(new Set())

  const load = useCallback(async (nextOffset: number, append: boolean) => {
    try {
      const res = await fetch(`/api/cards?limit=${PAGE}&offset=${nextOffset}`, {
        cache: 'no-store',
      })
      const j = await res.json()
      if (j.ok) {
        setCards((prev) => (append ? [...prev, ...j.cards] : j.cards))
        setHasMore(j.hasMore)
        setOffset(nextOffset)
      }
    } catch {
      /* swallow — empty state covers it */
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    track('page_view', { route: '/hits/history' })
    load(0, false)
    // Which fixtures are live right now → pulsing pockets.
    fetch('/api/fixtures')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && Array.isArray(j.live)) {
          setLiveMatchIds(new Set((j.live as { id: string }[]).map((f) => f.id)))
        }
      })
      .catch(() => { /* pockets just don't pulse */ })
  }, [load])

  // Re-load when auth state settles (anon → authed switches the scope).
  useEffect(() => {
    if (!auth.loading) load(0, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.profile?.id])

  // Fetch fired event keys per distinct match so mini-grids light accurately.
  useEffect(() => {
    const distinct = Array.from(new Set(cards.map((c) => c.match_id)))
      .filter((m) => !(m in eventKeys))
      .slice(0, MAX_EVENT_MATCHES)
    if (distinct.length === 0) return
    let cancelled = false
    Promise.all(
      distinct.map(async (m) => {
        try {
          const res = await fetch(`/api/events?match=${encodeURIComponent(m)}`, { cache: 'no-store' })
          const j = await res.json()
          const keys = j.ok && Array.isArray(j.events)
            ? (j.events as { event_key: string }[]).map((e) => e.event_key)
            : []
          return [m, keys] as const
        } catch {
          return [m, []] as const
        }
      })
    ).then((pairs) => {
      if (cancelled) return
      setEventKeys((prev) => ({ ...prev, ...Object.fromEntries(pairs) }))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards])

  const stats = useMemo(() => deriveBinderStats(cards), [cards])

  function openCard(c: HistoryCard) {
    track('binder_pocket_opened', { won: c.won }, c.id)
    const params = new URLSearchParams({ bet: String(c.price_php), type: c.card_type })
    // A pocket on a live fixture opens the live view; anything else opens the
    // demo/replay view. Never ?new=1 — binder opens don't re-rip.
    if (liveMatchIds.has(c.match_id)) {
      params.set('live', '1')
      params.set('match', c.match_id)
    }
    router.push(`/hits/${c.id}?${params.toString()}`)
  }

  return (
    <main className="hula-v2">
      <div className="hits-shell">
        <header className="hits-header">
          <div className="hits-brand">
            Hula <em>Hits</em>
          </div>
          <div className="hits-header-right">
            <LangToggle />
            <button className="hits-back" onClick={() => router.push('/hits')}>
              {t('history.back')}
            </button>
          </div>
        </header>

        <div className="hits-binder-head">
          <h1 className="hits-history-title">{t('binder.title')}</h1>
          <div className="hits-binder-stats">
            <span className="hits-binder-stat">
              <b>{stats.cards}</b> {t('binder.statCards')}
            </span>
            <span className="hits-binder-stat">
              <b>{stats.wins}</b> {t('binder.statWins')}
            </span>
            <span className="hits-binder-stat">
              <b>₱{stats.totalWon.toLocaleString()}</b> {t('binder.statWon')}
            </span>
          </div>
        </div>

        {!auth.loading && !auth.profile && (
          <div className="hits-history-anon-banner">
            {t('binder.anonPrefix')}
            <button
              type="button"
              className="hits-identity-link"
              onClick={() => {
                setShowSignIn(true)
                track('signin_opened', { from: '/hits/history' })
              }}
            >
              {t('history.anonLink')}
            </button>
          </div>
        )}

        {loading ? (
          <div className="hits-history-empty">{t('common.loading')}</div>
        ) : cards.length === 0 ? (
          <div className="hits-history-empty">
            {t('binder.emptyPrefix')}
            <button className="hits-identity-link" onClick={() => router.push('/hits')}>
              {t('binder.emptyLink')}
            </button>
          </div>
        ) : (
          <>
            <section className="hits-binder-grid">
              {cards.map((c) => {
                const cells = generateCard(c.id, c.price_php, c.card_type, c.match_id).cells
                const hits = binderHitIndices(cells, new Set(eventKeys[c.match_id] ?? []))
                const isLive = liveMatchIds.has(c.match_id) && !c.won
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="hits-pocket"
                    data-won={c.won}
                    data-live={isLive}
                    onClick={() => openCard(c)}
                  >
                    {c.won ? (
                      <span className="hits-pocket-ribbon">₱{c.score.toLocaleString()}</span>
                    ) : isLive ? (
                      <span className="hits-pocket-live">{t('binder.live')}</span>
                    ) : (
                      <span className="hits-pocket-miss">—</span>
                    )}
                    <span className="hits-pocket-label">{c.match_label}</span>
                    <span className="hits-pocket-meta">
                      {timeAgo(c.created_at)} · ₱{c.price_php}
                      {c.won && c.win_pattern
                        ? ` · ${PATTERN_KEY[c.win_pattern] ? t(PATTERN_KEY[c.win_pattern]) : c.win_pattern}`
                        : ''}
                    </span>
                    <span className="hits-pocket-mini" aria-hidden="true">
                      {cells.map((_, idx) => (
                        <i
                          key={idx}
                          data-state={
                            isFreeCell(idx) ? 'free' : hits.has(idx) ? 'hit' : 'pending'
                          }
                        />
                      ))}
                    </span>
                  </button>
                )
              })}
            </section>

            {hasMore && (
              <button
                className="hits-history-more"
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true)
                  load(offset + PAGE, true)
                }}
              >
                {loadingMore ? t('common.loading') : t('history.loadMore')}
              </button>
            )}
          </>
        )}

        <p className="hits-foot">{tx('common.foot')}</p>
      </div>

      {showSignIn && (
        <SignInModal onClose={() => setShowSignIn(false)} redirectTo="/hits/history" />
      )}
    </main>
  )
}
