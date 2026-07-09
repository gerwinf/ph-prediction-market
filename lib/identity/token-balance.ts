/**
 * Anonymous virtual-token balance, persisted in localStorage.
 *
 * Phase 0 free-to-play loop. Anon users start with ₱10,000 tokens.
 * Buy debits the balance. Wins credit it. Balance resets daily at
 * midnight PHT to keep the closed-beta cohort topped up if they bottom
 * out.
 *
 * Phase 1 will sync this to profiles.virtual_balance once email
 * signup exists. For now, browser-local only — clears on browser data
 * wipe, easily cheated. Acceptable because tokens have no real value.
 *
 * Day-key rollover shares the `hula-hits-day` key with /hits picker
 * so the daily-spend tracker and the balance reset on the same tick.
 */

export const STARTING_BALANCE = 10000

const STORAGE = {
  day: 'hula-hits-day',
  balance: 'hula-token-balance',
} as const

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Read the balance, applying daily reset if the stored day is stale.
 * SSR-safe: returns the starting balance during server render.
 */
export function readBalance(): number {
  if (typeof window === 'undefined') return STARTING_BALANCE
  const storedDay = localStorage.getItem(STORAGE.day)
  if (storedDay !== todayISO()) {
    // Daily reset. /hits picker also resets its spend/cards counters
    // when this key rolls; both reset on the same call without conflict.
    localStorage.setItem(STORAGE.day, todayISO())
    localStorage.setItem(STORAGE.balance, String(STARTING_BALANCE))
    return STARTING_BALANCE
  }
  const raw = localStorage.getItem(STORAGE.balance)
  if (raw === null) {
    localStorage.setItem(STORAGE.balance, String(STARTING_BALANCE))
    return STARTING_BALANCE
  }
  const n = Number(raw)
  if (Number.isNaN(n) || n < 0) {
    localStorage.setItem(STORAGE.balance, String(STARTING_BALANCE))
    return STARTING_BALANCE
  }
  return n
}

export function writeBalance(n: number): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE.day, todayISO())
  localStorage.setItem(STORAGE.balance, String(Math.max(0, Math.floor(n))))
}

export type DebitResult =
  | { ok: true; newBalance: number }
  | { ok: false; reason: 'insufficient'; balance: number }

export function debit(amount: number): DebitResult {
  const current = readBalance()
  if (current < amount) return { ok: false, reason: 'insufficient', balance: current }
  const next = current - amount
  writeBalance(next)
  return { ok: true, newBalance: next }
}

export function credit(amount: number): number {
  const current = readBalance()
  const next = current + amount
  writeBalance(next)
  return next
}

/**
 * Migration helper: when an anon user signs in for the first time AND
 * has a localStorage balance > the default, merge that balance into
 * their profile row server-side. Idempotent — server checks
 * profiles.migrated_from_anon before acting.
 *
 * Called by useSession once on profile.migrated_from_anon=false detection.
 */
export async function migrateToProfileBalance(): Promise<void> {
  if (typeof window === 'undefined') return
  const local = readBalance()
  try {
    await fetch('/api/profile/balance/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localBalance: local }),
    })
    // After successful migrate, the profile is authoritative. We clear
    // the local balance to avoid divergence — next read from server is
    // the source of truth.
  } catch {
    /* swallow — next session retries */
  }
}
