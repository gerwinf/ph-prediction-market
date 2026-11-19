'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { PREVIEW_HOST, type Market, type Side } from '@/lib/bilyonaryo/content'
import { Arrow, ConceptLabel, HulaWordmark } from '../../bilyonaryo/ui'
import { ProbabilityBar, SideButtons } from '../../bilyonaryo/prediction-widget'

function Waitlist() {
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state === 'saving') return
    const data = new FormData(event.currentTarget)
    setState('saving')
    setError('')
    try {
      const response = await fetch('/api/bilyonaryo/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.get('name'), email: data.get('email') }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save your details. Please try again.')
      setState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect. Please try again.')
      setState('error')
    }
  }

  return <section className="by-waitlist" aria-labelledby="waitlist-heading">
    <span className="by-mono by-orange-text">BE EARLY. HAVE A SAY.</span>
    <h2 id="waitlist-heading">Your next good call starts here.</h2>
    {state === 'success' ? <div className="by-waitlist-success" role="status"><span aria-hidden="true">✓</span><h3>You’re on the list.</h3><p>Your name and email are saved. We’ll let you know when Hula opens.</p></div> : <>
      <p>Reserve your handle. Be first to know when Hula opens.</p>
      <form onSubmit={submit}>
        <label htmlFor="by-name">Your name / preferred handle</label>
        <input id="by-name" name="name" autoComplete="nickname" placeholder="e.g. juandelacruz" required minLength={2} maxLength={64} disabled={state === 'saving'} />
        <label htmlFor="by-email">Email address</label>
        <input id="by-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} disabled={state === 'saving'} aria-describedby={error ? 'by-waitlist-error' : undefined} />
        {error && <p className="by-form-error" id="by-waitlist-error" role="alert">{error}</p>}
        <button className="by-primary-button" type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Saving your spot…' : 'Reserve your handle'}<Arrow /></button>
      </form>
      <p className="by-waitlist-fine">Only your name and email are saved. No account is created.<br />Handle availability will be confirmed at launch.</p>
    </>}
  </section>
}

export function MarketPreview({ market, initialSide }: { market: Market; initialSide: Side }) {
  const [side, setSide] = useState<Side>(initialSide)
  const [backHref, setBackHref] = useState(`/bilyonaryo/story/${market.id}`)

  useEffect(() => {
    if (window.location.hostname === 'hulaan.ph' || window.location.hostname === 'www.hulaan.ph') {
      setBackHref(`https://${PREVIEW_HOST}/story/${market.id}`)
    }
  }, [market.id])

  return <div className="by-shell by-market-shell">
    <ConceptLabel />
    <div className="by-market-paper">
      <header className="by-market-header"><Link href="/" aria-label="Hula home"><HulaWordmark /></Link><a href={backHref} className="by-via">via <strong>Bilyonaryo</strong><Arrow diagonal /></a></header>
      <div className="by-trading-banner"><span className="by-orange-dot" /><strong>A look at what’s next.</strong> Trading opens later.</div>
      <main className="by-market-main">
        <a className="by-back" href={backHref}><span aria-hidden="true">←</span> Back to the story</a>
        <div className="by-market-eyebrow"><span className="by-mono">{market.section.toUpperCase()} / THE PHILIPPINES</span><span className="by-preview-tag">PREVIEW</span></div>
        <h1>{market.question}</h1>
        <p className="by-market-deadline">Resolves {market.resolves} <span>·</span> Philippine time</p>
        <section className="by-market-selection" aria-label="Your illustrative prediction">
          <div className="by-market-selection-label"><span className="by-mono">THE CURRENT OUTLOOK</span><span>Illustrative odds</span></div>
          <ProbabilityBar yes={market.yes} />
          <SideButtons market={market} selected={side} onSelect={setSide} />
          <p className="by-selection-note" role="status"><span>Your view: <strong>{side === 'yes' ? 'Yes' : 'No'}</strong></span><span>Play points only · nothing is traded</span></p>
        </section>
        <section className="by-rules" aria-labelledby="rules-heading">
          <h2 id="rules-heading">How this resolves</h2>
          <p>{market.rules}</p>
          <a href={market.resolutionUrl} target="_blank" rel="noopener noreferrer"><span className="by-mono">RESOLUTION SOURCE</span><span>{market.resolutionSource}<Arrow diagonal /></span></a>
        </section>
        <Waitlist />
      </main>
      <footer className="by-market-footer"><HulaWordmark /><p>The market for what happens next.</p><span className="by-mono">ILLUSTRATIVE ODDS · PLAY POINTS ONLY</span></footer>
    </div>
  </div>
}
