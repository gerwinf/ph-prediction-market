import type { GameEvent } from './types'

/**
 * Pack-rip reveal plan — pure logic for components/hits/PackRipReveal.
 *
 * The reveal is presentation only: it renders the already-generated cells.
 * Commons/uncommons cascade in first (fast stagger, board order), rares flip
 * last with a holo flourish (slow stagger) — the "pull" beat.
 */

export type RevealStep = { idx: number; delayMs: number; rare: boolean }

const COMMON_STAGGER_MS = 55
const RARE_STAGGER_MS = 550
const RARE_GAP_MS = 500 // beat of anticipation before the first rare flips

export function buildRevealPlan(cells: GameEvent[]): RevealStep[] {
  const commons: number[] = []
  const rares: number[] = []
  cells.forEach((cell, idx) => {
    // Free cell reveals with the commons.
    if (cell.rarity === 'rare' && cell.id !== 'free') rares.push(idx)
    else commons.push(idx)
  })

  const steps: RevealStep[] = []
  commons.forEach((idx, i) => {
    steps.push({ idx, delayMs: i * COMMON_STAGGER_MS, rare: false })
  })
  const commonsDone = commons.length * COMMON_STAGGER_MS
  rares.forEach((idx, i) => {
    steps.push({ idx, delayMs: commonsDone + RARE_GAP_MS + i * RARE_STAGGER_MS, rare: true })
  })
  return steps
}

/** Total runtime of a reveal plan (last step + a hold so the rare glow is
 * readable before the board goes live — testers missed the flourish at 500ms). */
export function revealDurationMs(plan: RevealStep[]): number {
  const last = plan.reduce((m, s) => Math.max(m, s.delayMs), 0)
  return last + 1600
}

/**
 * Should the pack-rip play at all? Only on a fresh acquisition (?new=1),
 * and skipped for reduced-motion users and sped-up demo runs (?speed>1 is
 * a QA/dev fast path — the rip would just be in the way).
 */
export function shouldShowRip(opts: {
  isNew: boolean
  speed: number
  prefersReducedMotion: boolean
}): boolean {
  return opts.isNew && opts.speed <= 1 && !opts.prefersReducedMotion
}
