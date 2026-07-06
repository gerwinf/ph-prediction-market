'use client'

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  detectBrowserLang,
  LANG_STORAGE_KEY,
  normalizeLang,
  translate,
  type Lang,
  type StringKey,
  type Vars,
} from './strings'

/* ────────────────────────────────────────────────────────────────────────
 * LanguageProvider — client-side EN ↔ TL state for /hits
 *
 * Renders 'en' on the server and first client paint (deterministic, no
 * hydration mismatch), then resolves the real choice in an effect:
 *   saved localStorage pref  →  auto-detect from navigator  →  'en'
 * TL users may see a brief English flash before the effect runs — the
 * accepted trade-off for staying SSR-safe on these client pages.
 *
 * The context default is 'en', so any consumer rendered OUTSIDE the
 * provider stays English rather than throwing.
 * ──────────────────────────────────────────────────────────────────────── */

type LangContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Plain-string translation with interpolation. */
  t: (key: StringKey, vars?: Vars) => string
  /** Rich translation: renders *emphasis* → <em> and \n → <br/>. */
  tx: (key: StringKey, vars?: Vars) => ReactNode
}

/**
 * Convert a string with the *emphasis* / \n markup convention into React
 * nodes. `*word*` → <em>word</em>, `\n` → <br/>. Plain strings pass
 * through as a single text node.
 */
export function renderRich(text: string): ReactNode {
  const lines = text.split('\n')
  return lines.map((line, lineIdx) => {
    const parts = line.split('*')
    return (
      <Fragment key={lineIdx}>
        {lineIdx > 0 && <br />}
        {parts.map((part, partIdx) =>
          // Odd segments were wrapped in asterisks → emphasize.
          partIdx % 2 === 1 ? <em key={partIdx}>{part}</em> : part
        )}
      </Fragment>
    )
  })
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key, vars) => translate('en', key, vars),
  tx: (key, vars) => renderRich(translate('en', key, vars)),
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  // Resolve the real language after mount: saved pref wins, else detect.
  useEffect(() => {
    const saved = normalizeLang(
      typeof window !== 'undefined' ? window.localStorage.getItem(LANG_STORAGE_KEY) : null
    )
    setLangState(saved ?? detectBrowserLang())
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANG_STORAGE_KEY, next)
    }
  }, [])

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      tx: (key, vars) => renderRich(translate(lang, key, vars)),
    }),
    [lang, setLang]
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  return useContext(LangContext)
}
