import { LanguageProvider } from '../../lib/hits/i18n/LanguageProvider'

/* ────────────────────────────────────────────────────────────────────────
 * /hits layout — wraps every /hits route in the EN ↔ TL LanguageProvider
 * so the header LangToggle and all copy stay in sync across pages.
 * ──────────────────────────────────────────────────────────────────────── */

export default function HitsLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}
