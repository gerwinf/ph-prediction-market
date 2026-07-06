'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { timeAgo } from '../../../lib/format/time-ago'
import { useSession } from '../../../lib/auth/use-session'
import { SignInModal } from '../../../components/auth/SignInModal'
import { track } from '../../../lib/analytics/track'
import { useLang } from '../../../lib/hits/i18n/LanguageProvider'
import { LangToggle } from '../../../components/hits/LangToggle'
import type { StringKey } from '../../../lib/hits/i18n/strings'

/* ────────────────────────────────────────────────────────────────────────
 * /hits/history — card history
 *
 * Lists the current identity's cards newest-first. Authed → user_id;
 * anon → device_id (server decides via the session cookie). Paginated
 * via /api/cards?limit&offset. Anon users get a "sign in to save" banner.
 * ──────────────────────────────────────────────────────────────────── */

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

const PATTERN_KEY: Record<string, StringKey> = {
  row: 'history.patternRow',
  col: 'history.patternCol',
  diag: 'history.patternDiag',
  full: 'history.patternFull',
}

export default function HistoryPage() {
  const router = useRouter()
  const auth = useSession()
  const { t, tx } = useLang()
  const [cards, setCards] = useState<HistoryCard[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

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
  }, [load])

  // Re-load when auth state settles (anon → authed switches the scope).
  useEffect(() => {
    if (!auth.loading) load(0, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.profile?.id])

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

        <h1 className="hits-history-title">{t('history.title')}</h1>

        {!auth.loading && !auth.profile && (
          <div className="hits-history-anon-banner">
            {t('history.anonPrefix')}
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
            {t('history.emptyPrefix')}
            <button className="hits-identity-link" onClick={() => router.push('/hits')}>
              {t('history.emptyLink')}
            </button>
          </div>
        ) : (
          <>
            <section className="hits-history-list">
              {cards.map((c) => (
                <div key={c.id} className="hits-history-row">
                  <div className="hits-history-row-main">
                    <div className="hits-history-row-label">{c.match_label}</div>
                    <div className="hits-history-row-meta">
                      {t('history.rowMeta', { ago: timeAgo(c.created_at), price: c.price_php })}
                    </div>
                  </div>
                  <div className="hits-history-row-result">
                    {c.won ? (
                      <span className="hits-history-win">
                        +₱{c.score.toLocaleString()}
                        <span className="hits-history-pattern">
                          {c.win_pattern
                            ? PATTERN_KEY[c.win_pattern]
                              ? t(PATTERN_KEY[c.win_pattern])
                              : c.win_pattern
                            : t('history.win')}
                        </span>
                      </span>
                    ) : (
                      <span className="hits-history-loss">—</span>
                    )}
                  </div>
                </div>
              ))}
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
