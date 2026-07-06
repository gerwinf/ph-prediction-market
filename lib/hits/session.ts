/**
 * Per-day spend/limit session (localStorage) — shared by the /hits landing
 * page and the card page's buy-another-pack CTAs so the daily limit guards
 * hold everywhere a purchase can start. Extracted verbatim from
 * app/hits/page.tsx when the post-rip upsell moved buying onto the card page.
 */

export const STORAGE = {
  day: 'hula-hits-day',
  spend: 'hula-hits-session-spend',
  cards: 'hula-hits-session-cards',
  limit: 'hula-hits-daily-limit',
}

export type HitsSession = { day: string; spend: number; cards: number; limit: number }

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function readSession(): HitsSession {
  if (typeof window === 'undefined') return { day: todayISO(), spend: 0, cards: 0, limit: 0 }
  const day = localStorage.getItem(STORAGE.day) || todayISO()
  if (day !== todayISO()) {
    localStorage.setItem(STORAGE.day, todayISO())
    localStorage.setItem(STORAGE.spend, '0')
    localStorage.setItem(STORAGE.cards, '0')
    localStorage.removeItem(STORAGE.limit)
    return { day: todayISO(), spend: 0, cards: 0, limit: 0 }
  }
  return {
    day,
    spend: Number(localStorage.getItem(STORAGE.spend) || 0),
    cards: Number(localStorage.getItem(STORAGE.cards) || 0),
    limit: Number(localStorage.getItem(STORAGE.limit) || 0),
  }
}

export function writeSession(s: { spend: number; cards: number; limit: number }) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE.day, todayISO())
  localStorage.setItem(STORAGE.spend, String(s.spend))
  localStorage.setItem(STORAGE.cards, String(s.cards))
  if (s.limit > 0) localStorage.setItem(STORAGE.limit, String(s.limit))
}

/** True when buying `price` more would break the user's self-set daily cap. */
export function wouldExceedLimit(s: HitsSession, price: number): boolean {
  return s.limit > 0 && s.spend + price > s.limit
}
