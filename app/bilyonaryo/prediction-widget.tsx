'use client'

import { useEffect, useRef, useState } from 'react'
import { handoffHref, payout, type Market, type Side } from '@/lib/bilyonaryo/content'
import { Arrow, HulaWordmark } from './ui'

export function ProbabilityBar({ yes }: { yes: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.3 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <div className="by-probability" ref={ref}>
    <div className="by-probability-labels"><span>Yes <strong>{yes}%</strong></span><span>No <strong>{100 - yes}%</strong></span></div>
    <div className="by-probability-track" role="img" aria-label={`Illustrative probability: Yes ${yes} percent, No ${100 - yes} percent`}><div className="by-probability-fill" style={{ width: `${visible ? yes : 0}%` }} /></div>
  </div>
}

export function SideButtons({ market, selected, onSelect }: { market: Market; selected?: Side; onSelect: (side: Side) => void }) {
  return <div className="by-side-buttons">{(['yes', 'no'] as Side[]).map((side) => <button type="button" className={`by-side by-side-${side}`} key={side} aria-pressed={selected ? selected === side : undefined} onClick={() => onSelect(side)}><span>{side === 'yes' ? 'Yes' : 'No'} <span aria-hidden="true">{selected === side ? '✓' : '+'}</span></span><strong>{side === 'yes' ? market.yes : 100 - market.yes}<small> pts</small></strong></button>)}</div>
}

export function PredictionWidget({ market }: { market: Market }) {
  const [side, setSide] = useState<Side | null>(null)
  const [stake, setStake] = useState(100)
  const dialog = useRef<HTMLDialogElement>(null)
  const [href, setHref] = useState('')

  useEffect(() => {
    if (!side) return
    const element = dialog.current
    if (!element) return
    setHref(handoffHref(market, side, window.location.hostname))
    element.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
    }
  }, [side, market])

  function close() {
    setSide(null)
  }

  return <>
    <section className="by-widget" aria-label="Make a prediction">
      <div className="by-widget-top"><span className="by-mono"><span className="by-orange-dot" />PREDICTION</span><span className="by-widget-powered">powered by <HulaWordmark /></span></div>
      <h2>{market.question}</h2>
      <ProbabilityBar yes={market.yes} />
      <SideButtons market={market} onSelect={(choice) => { setStake(100); setSide(choice) }} />
      <div className="by-widget-meta"><span>Resolves {market.resolves}</span><span>Illustrative odds</span></div>
      <div className="by-play-label"><span className="by-status-dot" />Preview · play points only · 100 pts per share</div>
    </section>
    <dialog ref={dialog} className="by-sheet" aria-labelledby="by-sheet-title" onCancel={close} onClose={close} onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right) close()
    }}>
      <div className="by-sheet-handle" />
      <div className="by-sheet-top"><span className="by-mono">YOUR PREDICTION</span><button className="by-close" type="button" aria-label="Close prediction" onClick={close}>×</button></div>
      <h2 id="by-sheet-title">You’re calling <span>{side === 'yes' ? 'Yes' : 'No'}.</span></h2>
      <p className="by-sheet-question">{market.question}</p>
      <div className="by-stake-label"><span>Your play points</span><span className="by-mono">PREVIEW ONLY</span></div>
      <div className="by-stakes" aria-label="Choose play points">{[100, 500, 1000].map((value) => <button type="button" key={value} aria-pressed={stake === value} onClick={() => setStake(value)}>{value.toLocaleString('en-US')}<span> pts</span></button>)}</div>
      <div className="by-payout"><span>Total return if you’re right<small>Includes your {stake.toLocaleString('en-US')} points</small></span><strong>{payout(stake, market, side || 'yes').toLocaleString('en-US')}<small> pts</small></strong></div>
      <a className="by-primary-button" href={href || '#'} target="_blank" rel="noopener noreferrer" onClick={() => dialog.current?.close()}>Continue on <HulaWordmark /><Arrow diagonal /></a>
      <p className="by-sheet-disclaimer">Opens the market on Hula. Nothing is traded.<br />Illustrative odds. No money, no account required.</p>
      <p className="by-sheet-concept">Concept preview by Hula · not a live Bilyonaryo product</p>
    </dialog>
  </>
}
