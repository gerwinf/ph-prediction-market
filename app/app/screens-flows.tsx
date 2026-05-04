'use client'

import { useEffect, useState } from 'react'
import { peso, pesoCents } from './data'
import { Wordmark, ScreenHeader } from './screens-main'
import { Sheet } from './screens-detail'

/* ---------------- Onboarding flow ---------------- */

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const next = () => setStep(s => s + 1)
  if (step === 0) return <Onb_Welcome onNext={next} />
  if (step === 1) return <Onb_Identifier onNext={next} />
  if (step === 2) return <Onb_Passkey onNext={next} />
  return <Onb_Done onDone={onDone} />
}

function Onb_Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 24px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
        <Wordmark size={56} style={{ marginBottom: 36 }} />
        <h1 style={{ fontSize: 34, fontWeight: 600, fontFamily: 'var(--serif)', letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--t-text)' }}>
          Trade what you<br />actually watch.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--t-text-2)', marginTop: 16, lineHeight: 1.55, maxWidth: 290 }}>
          Buy and sell shares on PBA, MLBB, World Cup and more. 1 share pays ₱1 if you&apos;re right. Sell anytime.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 32 }}>
          {[
            ['🇵🇭', 'Built for Philippines markets'],
            ['💸', 'Deposit pesos in 30 seconds'],
            ['🛡', 'Regulated peso rails. Daily reconciled.'],
          ].map(([e, t]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--t-surface)', border: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{e}</div>
              <p style={{ fontSize: 13, color: 'var(--t-text)' }}>{t}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ paddingBottom: 32 }}>
        <button onClick={onNext} className="tap" style={{ width: '100%', padding: 16, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 15, border: 'none' }}>Get started</button>
        <button className="tap" style={{ width: '100%', marginTop: 10, padding: 12, fontSize: 13, color: 'var(--t-text-2)', background: 'none', border: 'none' }}>I already have an account</button>
        <p style={{ fontSize: 10, color: 'var(--t-text-3)', textAlign: 'center', marginTop: 14 }}>Hula Pilipinas, Inc. · BSP-licensed via PDAX rails</p>
      </div>
    </div>
  )
}

function Onb_Identifier({ onNext }: { onNext: () => void }) {
  const [val, setVal] = useState('paolo@gmail.com')
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="" />
      <div style={{ flex: 1, padding: '0 24px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, fontFamily: 'var(--serif)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>What&apos;s your email or phone?</h2>
        <p style={{ fontSize: 13, color: 'var(--t-text-2)', marginTop: 12, lineHeight: 1.5 }}>One identifier — that&apos;s it. We&apos;ll use a passkey, no password.</p>
        <div style={{ marginTop: 28 }}>
          <input value={val} onChange={e => setVal(e.target.value)} style={{ width: '100%', padding: '14px 16px', background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 10, fontSize: 16, color: 'var(--t-text)', fontFamily: 'var(--mono)' }} />
          <p style={{ fontSize: 11, color: 'var(--t-text-3)', marginTop: 10 }}>We&apos;ll send a magic link if you ever lose your device.</p>
        </div>
      </div>
      <div style={{ padding: '12px 24px 32px' }}>
        <button onClick={onNext} className="tap" style={{ width: '100%', padding: 16, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 15, border: 'none' }}>Continue</button>
      </div>
    </div>
  )
}

function Onb_Passkey({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'scanning'>('intro')
  useEffect(() => {
    if (phase === 'scanning') {
      const id = setTimeout(() => onNext(), 1800)
      return () => clearTimeout(id)
    }
  }, [phase, onNext])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="" />
      <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ width: 88, height: 88, borderRadius: 22, background: 'var(--t-surface)', border: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, position: 'relative' }}>
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
            <path d="M21 4c-6 0-9 4-9 8v4c0 4 3 8 9 8s9-4 9-8v-4c0-4-3-8-9-8z" stroke="var(--t-gold)" strokeWidth="2" />
            <circle cx="21" cy="14" r="2.5" fill="var(--t-gold)" />
            <path d="M21 16v6" stroke="var(--t-gold)" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 38c0-6 5-10 11-10s11 4 11 10" stroke="var(--t-gold)" strokeWidth="2" strokeLinecap="round" opacity={phase === 'scanning' ? 1 : 0.3} />
          </svg>
          {phase === 'scanning' && <div style={{ position: 'absolute', inset: -6, borderRadius: 28, border: '2px solid var(--t-gold)', animation: 'pulse 1.2s ease-in-out infinite' }} />}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--serif)', lineHeight: 1.25 }}>{phase === 'scanning' ? 'Scanning your face…' : 'Set up Face ID'}</h2>
        <p style={{ fontSize: 13, color: 'var(--t-text-2)', marginTop: 8, maxWidth: 280, lineHeight: 1.5 }}>
          {phase === 'scanning'
            ? 'Hold still. We never store your biometrics.'
            : 'Your passkey replaces passwords. Face ID stays on your phone — we never see it.'}
        </p>
        {phase === 'intro' && (
          <div style={{ marginTop: 28, padding: 14, background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 10, maxWidth: 280, textAlign: 'left' }}>
            <p style={{ fontSize: 11, color: 'var(--t-text-2)', display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ color: 'var(--t-success)' }}>✓</span><span>Phishing-resistant — no password to leak</span></p>
            <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 6, display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ color: 'var(--t-success)' }}>✓</span><span>Synced via iCloud Keychain to your other devices</span></p>
          </div>
        )}
      </div>
      <div style={{ padding: '12px 24px 32px' }}>
        <button onClick={() => setPhase('scanning')} className="tap" disabled={phase === 'scanning'} style={{ width: '100%', padding: 16, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 15, opacity: phase === 'scanning' ? 0.6 : 1, border: 'none' }}>{phase === 'scanning' ? 'Authenticating…' : 'Use Face ID'}</button>
        {phase !== 'scanning' && <button className="tap" style={{ width: '100%', marginTop: 10, padding: 12, fontSize: 13, color: 'var(--t-text-2)', background: 'none', border: 'none' }}>Use device passcode instead</button>}
      </div>
    </div>
  )
}

function Onb_Done({ onDone }: { onDone: () => void }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 24px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--t-yes-bg)', border: '2px solid var(--t-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, animation: 'pop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 14l5 5 11-11" stroke="var(--t-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--serif)', letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>You&apos;re in.</h2>
        <p style={{ fontSize: 14, color: 'var(--t-text-2)', marginTop: 10, maxWidth: 280, lineHeight: 1.5 }}>Founding member <span className="mono" style={{ color: 'var(--t-gold)' }}>#312</span>. Add funds to start trading.</p>
        <div style={{ marginTop: 32, padding: 16, background: 'rgba(244,185,66,0.06)', border: '1px solid rgba(244,185,66,0.3)', borderRadius: 12, maxWidth: 290 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-gold)' }}>★ Founding bonus</p>
          <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 4 }}>₱100 trading credit on your first deposit.</p>
        </div>
      </div>
      <div style={{ paddingBottom: 32 }}>
        <button onClick={onDone} className="tap" style={{ width: '100%', padding: 16, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 15, border: 'none' }}>Add funds</button>
        <button onClick={onDone} className="tap" style={{ width: '100%', marginTop: 10, padding: 12, fontSize: 13, color: 'var(--t-text-2)', background: 'none', border: 'none' }}>Browse markets first</button>
      </div>
    </div>
  )
}

/* ---------------- Deposit / Withdraw sheets ---------------- */

function RouteOption({ id, sel, onSelect, title, sub, meta, badge }: { id: string; sel: string; onSelect: (id: string) => void; title: string; sub: string; meta: string; badge?: string }) {
  const a = sel === id
  return (
    <button onClick={() => onSelect(id)} className="tap" style={{ textAlign: 'left', padding: 14, borderRadius: 10, background: a ? 'rgba(244,185,66,0.06)' : 'var(--t-bg)', border: a ? '1px solid var(--t-gold)' : '1px solid var(--t-border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid', borderColor: a ? 'var(--t-gold)' : 'var(--t-border)', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {a && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--t-gold)' }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600 }}>{title}</p>
          {badge && <span style={{ padding: '1px 6px', fontSize: 9, fontWeight: 700, letterSpacing: 0.4, background: 'rgba(244,185,66,0.12)', color: 'var(--t-gold)', borderRadius: 3 }}>{badge}</span>}
        </div>
        <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 3 }}>{sub}</p>
        <p className="mono" style={{ fontSize: 10, color: 'var(--t-text-3)', marginTop: 4 }}>{meta}</p>
      </div>
    </button>
  )
}

export function DepositSheet({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<'amount' | 'route' | 'redirecting' | 'pending' | 'done'>('amount')
  const [amount, setAmount] = useState(2000)
  const [route, setRoute] = useState('pdax')

  useEffect(() => {
    if (step === 'redirecting') {
      const id = setTimeout(() => setStep('pending'), 1600)
      return () => clearTimeout(id)
    }
    if (step === 'pending') {
      const id = setTimeout(() => setStep('done'), 2400)
      return () => clearTimeout(id)
    }
  }, [step])

  if (step === 'amount') return (
    <Sheet onClose={onClose} title="Deposit pesos">
      <div style={{ padding: '24px 16px 12px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginBottom: 6 }}>Amount to deposit</p>
        <p className="mono" style={{ fontSize: 44, fontWeight: 700 }}>{peso(amount)}</p>
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[500, 1000, 2000, 5000, 10000].map(v => (
          <button key={v} onClick={() => setAmount(v)} className="tap" style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: amount === v ? 'var(--t-gold)' : 'var(--t-bg)', color: amount === v ? '#0A0A0B' : 'var(--t-text)', border: '1px solid', borderColor: amount === v ? 'var(--t-gold)' : 'var(--t-border)' }}>{peso(v)}</button>
        ))}
      </div>
      <div style={{ padding: '8px 16px 28px' }}>
        <button onClick={() => setStep('route')} className="tap" style={{ width: '100%', padding: 14, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 14, border: 'none' }}>Continue</button>
      </div>
    </Sheet>
  )

  if (step === 'route') return (
    <Sheet onClose={onClose} title="How are you funding this?">
      <p style={{ fontSize: 12, color: 'var(--t-text-2)', padding: '0 16px' }}>Hula moves your money via licensed partners. Pick a route.</p>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <RouteOption id="pdax" sel={route} onSelect={setRoute} title="PDAX" badge="Recommended" sub="GCash, Maya, BPI, UnionBank → PDAX → Hula" meta="Fee: 0% · Settles in 1–2 min · BSP-licensed" />
        <RouteOption id="card" sel={route} onSelect={setRoute} title="Credit / debit card" sub="Visa, Mastercard via licensed processor" meta="Fee: 2.9% · Settles instantly" />
      </div>
      <div style={{ margin: '0 16px 16px', padding: 12, background: 'var(--t-bg)', border: '1px solid var(--t-border)', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--t-text-2)' }}>You deposit</span>
          <span className="mono" style={{ fontWeight: 500 }}>{peso(amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
          <span style={{ color: 'var(--t-text-2)' }}>Fee</span>
          <span className="mono">{route === 'pdax' ? '₱0' : peso(Math.round(amount * 0.029))}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--t-border)' }}>
          <span style={{ color: 'var(--t-text)', fontWeight: 600 }}>You receive</span>
          <span className="mono" style={{ fontWeight: 700 }}>{peso(route === 'pdax' ? amount : amount - Math.round(amount * 0.029))}</span>
        </div>
      </div>
      <div style={{ padding: '0 16px 28px' }}>
        <button onClick={() => setStep('redirecting')} className="tap" style={{ width: '100%', padding: 14, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 14, border: 'none' }}>
          {route === 'pdax' ? 'Continue to PDAX →' : 'Pay with card →'}
        </button>
        <p style={{ fontSize: 10, color: 'var(--t-text-3)', textAlign: 'center', marginTop: 10 }}>You&apos;ll be returned here when done.</p>
      </div>
    </Sheet>
  )

  if (step === 'redirecting') return (
    <Sheet onClose={onClose} title="Redirecting…">
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--t-gold)', borderTopColor: 'transparent', margin: '0 auto 16px', animation: 'spin 0.9s linear infinite' }} />
        <p style={{ fontSize: 13, color: 'var(--t-text)' }}>Opening PDAX…</p>
        <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 4 }}>You&apos;ll come back here automatically.</p>
      </div>
    </Sheet>
  )

  if (step === 'pending') return (
    <Sheet onClose={onClose} title="Funds in transit">
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(244,185,66,0.10)', border: '2px solid var(--t-gold)', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 6v8l5 3" stroke="var(--t-gold)" strokeWidth="2.5" strokeLinecap="round" /><circle cx="14" cy="14" r="11" stroke="var(--t-gold)" strokeWidth="2" /></svg>
        </div>
        <p style={{ fontSize: 16, fontWeight: 600 }}>Crediting your wallet…</p>
        <p style={{ fontSize: 12, color: 'var(--t-text-2)', marginTop: 6 }}>Usually 1–2 minutes.</p>
        <p className="mono" style={{ fontSize: 10, color: 'var(--t-text-3)', marginTop: 14 }}>tx 0x91ab…7c2f</p>
      </div>
    </Sheet>
  )

  return (
    <Sheet onClose={onClose} title="">
      <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--t-yes-bg)', border: '2px solid var(--t-success)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 11l4 4 8-8" stroke="var(--t-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--serif)' }}>{peso(amount)} added</h3>
        <p style={{ fontSize: 12, color: 'var(--t-text-2)', marginTop: 6 }}>New balance · {pesoCents(8420.50 + amount)}</p>
      </div>
      <div style={{ padding: '0 16px 28px' }}>
        <button onClick={onComplete} className="tap" style={{ width: '100%', padding: 14, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 14, border: 'none' }}>Start trading</button>
      </div>
    </Sheet>
  )
}

export function WithdrawSheet({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<'form' | 'submitted'>('form')
  const [amount, setAmount] = useState(2000)
  useEffect(() => {
    if (step === 'submitted') {
      const id = setTimeout(() => onComplete(), 1800)
      return () => clearTimeout(id)
    }
  }, [step, onComplete])

  if (step === 'form') return (
    <Sheet onClose={onClose} title="Withdraw to PDAX">
      <p style={{ fontSize: 12, color: 'var(--t-text-2)', padding: '0 16px' }}>Funds go to your PDAX peso wallet, then on to your bank or e-wallet.</p>
      <div style={{ padding: '20px 16px 8px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginBottom: 6 }}>Amount</p>
        <p className="mono" style={{ fontSize: 40, fontWeight: 700 }}>{peso(amount)}</p>
        <p className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 4 }}>Available · {pesoCents(8420.50)}</p>
      </div>
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[500, 1000, 2000, 5000].map(v => (
          <button key={v} onClick={() => setAmount(v)} className="tap" style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: amount === v ? 'var(--t-gold)' : 'var(--t-bg)', color: amount === v ? '#0A0A0B' : 'var(--t-text)', border: '1px solid', borderColor: amount === v ? 'var(--t-gold)' : 'var(--t-border)' }}>{peso(v)}</button>
        ))}
        <button onClick={() => setAmount(8420)} className="tap" style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: 'var(--t-bg)', color: 'var(--t-text)', border: '1px solid var(--t-border)' }}>Max</button>
      </div>
      <div style={{ margin: '0 16px 16px', padding: 12, background: 'var(--t-bg)', border: '1px solid var(--t-border)', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--t-text-2)' }}>Fee</span>
          <span className="mono">₱0</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
          <span style={{ color: 'var(--t-text-2)' }}>Arrives in</span>
          <span className="mono">PDAX in 2 min · bank ~30 min</span>
        </div>
      </div>
      <div style={{ padding: '0 16px 28px' }}>
        <button onClick={() => setStep('submitted')} className="tap" style={{ width: '100%', padding: 14, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 14, border: 'none' }}>Withdraw {peso(amount)}</button>
      </div>
    </Sheet>
  )

  return (
    <Sheet onClose={onClose} title="Withdrawal in progress">
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--t-gold)', borderTopColor: 'transparent', margin: '0 auto 16px', animation: 'spin 0.9s linear infinite' }} />
        <p style={{ fontSize: 14, fontWeight: 600 }}>{peso(amount)} on the way</p>
        <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 6 }}>Track in Wallet activity</p>
      </div>
    </Sheet>
  )
}
