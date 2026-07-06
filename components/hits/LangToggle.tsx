'use client'

import { useLang } from '../../lib/hits/i18n/LanguageProvider'
import { track } from '../../lib/analytics/track'

/* ────────────────────────────────────────────────────────────────────────
 * LangToggle — EN | TL pill for the /hits header
 *
 * One tap flips the language. Both segments are always visible; the active
 * one is highlighted. Lives in `hits-header-right` across all /hits pages.
 * ──────────────────────────────────────────────────────────────────────── */

const OPTIONS = [
  { code: 'en' as const, label: 'EN' },
  { code: 'tl' as const, label: 'TL' },
]

export function LangToggle() {
  const { lang, setLang } = useLang()

  return (
    <div className="hits-lang-toggle" role="group" aria-label="Language">
      {OPTIONS.map((opt) => {
        const active = lang === opt.code
        return (
          <button
            key={opt.code}
            type="button"
            className="hits-lang-opt"
            data-active={active}
            aria-pressed={active}
            onClick={() => {
              if (active) return
              setLang(opt.code)
              track('lang_changed', { lang: opt.code })
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
