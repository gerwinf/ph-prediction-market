'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameEvent } from '../../lib/hits/types'
import { buildRevealPlan, revealDurationMs } from '../../lib/hits/reveal'
import { useLang } from '../../lib/hits/i18n/LanguageProvider'

/**
 * Booster-pack reveal — the gacha "pull" moment played over a freshly bought
 * card. Purely presentational: renders the already-generated cells; changes
 * nothing about generation, event timing, or hit detection.
 *
 * Phases: pack (tap to rip; auto-rips after 4s) → cascade (commons snap in
 * fast, rares flip last with a holo flourish) → onDone. Tap anywhere during
 * the cascade skips straight to onDone.
 */

type Phase = 'pack' | 'cascade'

export function PackRipReveal({
  cells,
  title,
  sublabel,
  onDone,
}: {
  cells: GameEvent[]
  title: string
  sublabel: string
  onDone: () => void
}) {
  const { t } = useLang()
  const [phase, setPhase] = useState<Phase>('pack')
  const plan = useMemo(() => buildRevealPlan(cells), [cells])
  const doneRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    timersRef.current.forEach((t) => clearTimeout(t))
    onDone()
  }

  // Auto-rip so an idle pack never stalls the card.
  useEffect(() => {
    if (phase !== 'pack') return
    const t = setTimeout(() => setPhase('cascade'), 4000)
    return () => clearTimeout(t)
  }, [phase])

  // Cascade complete → done.
  useEffect(() => {
    if (phase !== 'cascade') return
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate?.(30) } catch { /* unsupported */ }
    }
    const t = setTimeout(finish, revealDurationMs(plan))
    timersRef.current.push(t)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plan])

  const delayByIdx = useMemo(() => {
    const m = new Map<number, { delayMs: number; rare: boolean }>()
    plan.forEach((s) => m.set(s.idx, { delayMs: s.delayMs, rare: s.rare }))
    return m
  }, [plan])

  return (
    <div
      className="hits-rip-backdrop"
      role="button"
      aria-label={phase === 'pack' ? t('rip.tap') : t('rip.skip')}
      onClick={() => (phase === 'pack' ? setPhase('cascade') : finish())}
    >
      {phase === 'pack' ? (
        <div className="hits-rip-pack">
          <div className="hits-rip-pack-shine" aria-hidden="true" />
          <div className="hits-rip-pack-word">
            HULA<br />PACK
          </div>
          <div className="hits-rip-pack-match">{title}</div>
          <div className="hits-rip-pack-sub">{sublabel}</div>
          <div className="hits-rip-pack-cta">{t('rip.tap')}</div>
        </div>
      ) : (
        <div className="hits-rip-stage">
          <div className="hits-rip-grid">
            {cells.map((cell, idx) => {
              const step = delayByIdx.get(idx)
              return (
                <div
                  key={idx}
                  className="hits-rip-cell"
                  data-rare={step?.rare === true}
                  data-free={cell.id === 'free'}
                  style={{ animationDelay: `${step?.delayMs ?? 0}ms` }}
                >
                  {cell.label}
                </div>
              )
            })}
          </div>
          <div className="hits-rip-skip">{t('rip.skip')}</div>
        </div>
      )}
    </div>
  )
}
