import Link from 'next/link'

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h15m-6-6 6 6-6 6" />}
  </svg>
}

export function HulaWordmark() {
  return <span className="by-hula-wordmark">Hula<span>.</span></span>
}

export function ConceptLabel() {
  return <div className="by-concept">Concept preview by Hula <span>·</span> not a live Bilyonaryo product</div>
}

export function NewsHeader({ compact = false, onHome }: { compact?: boolean; onHome?: () => void }) {
  return <header className={`by-header${compact ? ' by-header-compact' : ''}`}>
    <div className="by-edition-line"><span>THE PHILIPPINES, IN PERSPECTIVE</span><span>PH EDITION</span></div>
    <Link className="by-wordmark" href="/bilyonaryo" aria-label="Bilyonaryo concept home" onClick={onHome}>Bilyonaryo<span>.</span></Link>
    <div className="by-masthead-bottom"><span>Independent minds. Informed views.</span><span className="by-partner">with <HulaWordmark /></span></div>
  </header>
}

export function PreviewFooter() {
  return <footer className="by-footer">
    <div><span className="by-footer-wordmark">Bilyonaryo<span> × </span><HulaWordmark /></span><span className="by-mono">A CONCEPT, IN CONTEXT.</span></div>
    <p>Real headlines. A new way to take a view.<br />Illustrative odds. Play points only.</p>
    <span className="by-footer-fine">An independent concept by Hula. No affiliation or endorsement implied.</span>
  </footer>
}
