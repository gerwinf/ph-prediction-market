/**
 * Client-side analytics emitter.
 *
 * Fires funnel events to /api/analytics/track. Fire-and-forget — never
 * awaited, never blocks the UI, never surfaces errors. Analytics loss
 * is acceptable; freezing a buy click on a tracking timeout is not.
 *
 * Usage:
 *   track('card_purchased', { card_id: 'JJJ8YR', bet: 20 })
 *
 * The server reads device_id from cookie; we don't pass it from here.
 *
 * Coalesces `page_view` per pathname per session (sessionStorage) so a
 * client-side route push doesn't double-count.
 */

type Payload = Record<string, unknown>

const SESSION_VIEW_KEY = 'hula-viewed-paths'

export function track(eventType: string, payload?: Payload, cardId?: string): void {
  if (typeof window === 'undefined') return

  // Coalesce page_view per pathname per session.
  if (eventType === 'page_view') {
    const path = typeof window.location !== 'undefined' ? window.location.pathname : '/'
    try {
      const raw = window.sessionStorage.getItem(SESSION_VIEW_KEY)
      const seen: string[] = raw ? JSON.parse(raw) : []
      if (seen.includes(path)) return
      seen.push(path)
      window.sessionStorage.setItem(SESSION_VIEW_KEY, JSON.stringify(seen))
    } catch {
      /* sessionStorage unavailable — emit anyway, dupes are tolerable */
    }
  }

  const body: { event_type: string; card_id?: string; payload?: Payload } = {
    event_type: eventType,
  }
  if (cardId) body.card_id = cardId
  if (payload) body.payload = payload

  // keepalive lets the request survive page unload (e.g. clicking a
  // share link). No await — we don't care about the response.
  try {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
      cache: 'no-store',
    }).catch(() => {
      /* swallow — never let analytics break the user flow */
    })
  } catch {
    /* swallow */
  }
}
