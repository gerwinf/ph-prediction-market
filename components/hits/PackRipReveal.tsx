'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../lib/hits/i18n/LanguageProvider'

/**
 * Booster pack — the tap-to-rip moment of the gacha reveal. This component is
 * ONLY the pack overlay; the cell cascade animates on the real board
 * (app/hits/[card_id], driven by buildRevealPlan) so the reveal lands exactly
 * where the card lives — no second grid, no position jump when it settles.
 *
 * Tap rips (with a quick tear animation); an idle pack auto-rips after 4s so
 * it can never stall the card. `onRip` fires once, after the tear.
 */

export function PackRipReveal({
  title,
  sublabel,
  onRip,
}: {
  title: string
  sublabel: string
  onRip: () => void
}) {
  const { t } = useLang()
  const [tearing, setTearing] = useState(false)
  const doneRef = useRef(false)

  const rip = () => {
    if (doneRef.current) return
    doneRef.current = true
    setTearing(true)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate?.(30) } catch { /* unsupported */ }
    }
    setTimeout(onRip, 380) // matches the hits-pack-tear animation
  }

  // Auto-rip so an idle pack never stalls the card.
  useEffect(() => {
    const t = setTimeout(rip, 4000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="hits-rip-backdrop"
      role="button"
      aria-label={t('rip.tap')}
      onClick={rip}
    >
      <div className="hits-rip-pack" data-tearing={tearing}>
        <div className="hits-rip-pack-shine" aria-hidden="true" />
        <div className="hits-rip-pack-word">
          HULA<br />PACK
        </div>
        <div className="hits-rip-pack-match">{title}</div>
        <div className="hits-rip-pack-sub">{sublabel}</div>
        <div className="hits-rip-pack-cta">{t('rip.tap')}</div>
      </div>
    </div>
  )
}
