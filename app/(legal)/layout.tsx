import Link from 'next/link'

// Shared frame for the legal pages (/terms, /privacy, /responsible-gaming).
// Content pages render prose inside .legal-prose; keep them plain server
// components so the pages are static and crawlable (ad-network reviewers
// follow these links from the landing footer).
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="hula-v2 legal-page">
      <nav className="nav shell">
        <div className="nav-l">
          <Link href="/" className="logo-lockup" style={{ textDecoration: 'none' }}>
            <span className="logo-mono">H</span>
            <span className="logo-wordmark">Hula<span className="dot">.</span></span>
          </Link>
        </div>
      </nav>
      <section className="section shell">
        <div className="legal-prose">{children}</div>
      </section>
      <footer className="foot">
        <div className="shell">
          <div className="foot-bottom">
            <span>© 2026 Hula Pilipinas, Inc. · Manila, PH</span>
            <span><Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/responsible-gaming">Responsible gaming</Link></span>
          </div>
        </div>
      </footer>
    </main>
  )
}
