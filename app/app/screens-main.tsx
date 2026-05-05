'use client'

import { useEffect, useState, ReactNode, CSSProperties } from 'react'
import {
  HULA_MARKETS, HULA_CATEGORIES,
  HULA_POSITIONS_OPEN, HULA_POSITIONS_PENDING, HULA_POSITIONS_RESOLVED,
  peso, pesoCents,
  Market, Market3way, OpenPosition, PendingPosition, ResolvedPosition,
} from './data'

/* ---------------- Primitives ---------------- */

export function Wordmark({ size = 22, style = {} }: { size?: number; style?: CSSProperties }) {
  return (
    <span className="taya-wordmark" style={{ fontSize: size, ...style }}>
      Hula
    </span>
  )
}

export function StatusBar({ time = '9:41', dark = true }: { time?: string; dark?: boolean }) {
  const c = dark ? '#FAFAFA' : '#0A0A0B'
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 32px 6px', height: 54, pointerEvents: 'none' }}>
      <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: c }}>{time}</span>
      <div style={{ width: 126, height: 37 }} />
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c} /><rect x="4.5" y="5" width="3" height="6" rx="0.6" fill={c} /><rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill={c} /><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c} /></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="20" height="10" rx="2.8" stroke={c} strokeOpacity="0.5" fill="none" /><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c} /></svg>
      </div>
    </div>
  )
}

type TabId = 'markets' | 'portfolio' | 'wallet' | 'account'

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'markets', label: 'Markets', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 17V8l7-5 7 5v9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 17v-5h4v5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg> },
    { id: 'portfolio', label: 'Portfolio', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 13l4-4 3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M13 5h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { id: 'wallet', label: 'Wallet', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M14 11h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> },
    { id: 'account', label: 'Account', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.6" /><path d="M3.5 17c1-3.6 3.6-5.4 6.5-5.4s5.5 1.8 6.5 5.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg> },
  ]
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, paddingBottom: 22, paddingTop: 8, borderTop: '1px solid var(--t-border)', background: 'rgba(10,10,11,0.92)', backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)', display: 'flex', justifyContent: 'space-around' }}>
      {tabs.map(t => {
        const a = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)} className="tap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: a ? 'var(--t-gold)' : 'var(--t-text-2)', fontSize: 10, fontWeight: 500, letterSpacing: 0.2, padding: '4px 12px', background: 'none', border: 'none' }}>
            {t.icon}<span>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function useLiveTick(initial: number, range = 1, intervalMs = 2400, enabled = true): [number, number] {
  const [val, setVal] = useState(initial)
  const [dir, setDir] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      setVal(prev => {
        const next = Math.max(2, Math.min(98, Math.round(prev + (Math.random() - 0.5) * 2 * range)))
        setDir(next > prev ? 1 : next < prev ? -1 : 0)
        setTimeout(() => setDir(0), 600)
        return next
      })
    }, intervalMs + Math.random() * 1000)
    return () => clearInterval(id)
  }, [enabled, range, intervalMs])
  return [val, dir]
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '20px 16px 10px' }}>
      <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</h2>
      {action && <button onClick={onAction} style={{ fontSize: 12, color: 'var(--t-gold)', fontWeight: 500, background: 'none', border: 'none' }}>{action}</button>}
    </div>
  )
}

export function Skel({ w = '100%', h = 14, r = 4, style = {} }: { w?: string | number; h?: number; r?: number; style?: CSSProperties }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)', backgroundSize: '200% 100%', animation: 'skel 1.4s ease-in-out infinite', ...style }} />
}

export function TrustLine({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 10, color: 'var(--t-text-3)' }}>
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 0.5l4 1.5v3c0 2.5-1.7 4.4-4 4.5C3.2 9.4 1.5 7.5 1.5 5v-3l4-1.5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /><path d="M3.8 5.5l1.3 1.3 2.4-2.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>{children}</span>
    </div>
  )
}

export function ScreenHeader({ onBack, title, subtitle, right }: { onBack?: () => void; title?: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 8px', gap: 10 }}>
      {onBack && (
        <button onClick={onBack} className="tap" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--t-surface)', border: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 1L3 7l6 6" stroke="var(--t-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <h1 style={{ fontSize: 17, fontWeight: 600, color: 'var(--t-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>}
        {subtitle && <p style={{ fontSize: 11, color: 'var(--t-text-2)' }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function EmptyState({ title, body, action, onAction, icon }: { title: string; body: string; action?: string; onAction?: () => void; icon?: ReactNode }) {
  return (
    <div style={{ padding: '40px 32px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--t-surface)', border: '1px solid var(--t-border)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-text-2)' }}>
        {icon || <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" /><path d="M11 7v5M11 15h0.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text)' }}>{title}</h3>
      <p style={{ fontSize: 12, color: 'var(--t-text-2)', marginTop: 6, lineHeight: 1.5 }}>{body}</p>
      {action && <button onClick={onAction} className="tap" style={{ marginTop: 16, padding: '10px 18px', borderRadius: 8, background: 'var(--t-gold)', color: '#0A0A0B', fontSize: 13, fontWeight: 600, border: 'none' }}>{action}</button>}
    </div>
  )
}

/* ---------------- Markets feed ---------------- */

function MarketCard({ m, onTap, density = 'comfortable' }: { m: Market; onTap: (m: Market) => void; density?: 'comfortable' | 'compact' }) {
  const compact = density === 'compact'
  const change = m.type === '3way' ? null : m.yes - m.prevYes
  return (
    <div className="tap" onClick={() => onTap(m)} style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 12, padding: compact ? 12 : 14, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--t-text-2)', fontWeight: 500 }}>{m.catLabel}</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--t-text-3)' }}>{m.id}</span>
      </div>
      <p style={{ fontSize: compact ? 14 : 15, fontWeight: 600, lineHeight: 1.3, marginBottom: compact ? 8 : 12, color: 'var(--t-text)' }}>{m.title}</p>

      {m.type === '3way' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {m.outcomes.map(o => (
            <button key={o.id} className="tap" style={{ padding: '10px 8px', background: 'var(--t-bg)', border: '1px solid var(--t-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 9, color: 'var(--t-text-2)', fontWeight: 600, letterSpacing: 0.5 }}>{o.sub}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text)', marginTop: 2 }}>{o.label}</span>
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-gold)', marginTop: 4 }}>{o.price}¢</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="tap" style={{ padding: compact ? '8px 10px' : '11px 12px', background: 'var(--t-yes-bg)', border: '1px solid var(--t-success)', color: 'var(--t-success)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
            <span>Yes</span><span className="mono">{m.yes}¢</span>
          </button>
          <button className="tap" style={{ padding: compact ? '8px 10px' : '11px 12px', background: 'var(--t-no-bg)', border: '1px solid var(--t-danger)', color: 'var(--t-danger)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
            <span>No</span><span className="mono">{m.no}¢</span>
          </button>
        </div>
      )}

      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 10, color: 'var(--t-text-3)' }}>
          <span className="mono">Vol {peso(m.volume)}</span>
          {change !== null && <span className="mono" style={{ color: change > 0 ? 'var(--t-success)' : change < 0 ? 'var(--t-danger)' : 'var(--t-text-3)' }}>{change > 0 ? '+' : ''}{change}¢ 24h</span>}
          <span className="mono">{m.closes.replace('Closes ', '')}</span>
        </div>
      )}
    </div>
  )
}

function FeaturedFootball({ m, onTap }: { m: Market3way; onTap: () => void }) {
  return (
    <div className="tap" onClick={onTap} style={{ background: 'linear-gradient(135deg, rgba(244,185,66,0.08), var(--t-surface))', border: '1px solid rgba(244,185,66,0.25)', borderRadius: 16, padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--t-gold)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>★ Launch market</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--t-text-3)' }}>{m.id}</span>
      </div>
      <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.25, fontFamily: 'var(--serif)', letterSpacing: '-0.01em' }}>{m.title}</p>
      <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 4, marginBottom: 14 }}>{m.subtitle}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {m.outcomes.map((o, i) => (
          <div key={o.id} style={{ padding: '10px 8px', background: i === 0 ? 'rgba(244,185,66,0.12)' : 'var(--t-bg)', border: i === 0 ? '1px solid rgba(244,185,66,0.5)' : '1px solid var(--t-border)', borderRadius: 8, textAlign: 'left' }}>
            <span style={{ fontSize: 9, color: 'var(--t-text-2)', fontWeight: 600, letterSpacing: 0.5 }}>{o.sub}</span>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{o.label}</p>
            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? 'var(--t-gold)' : 'var(--t-text)', marginTop: 4, display: 'block' }}>{o.price}¢</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 10, color: 'var(--t-text-3)' }}>
        <span className="mono">Vol {peso(m.volume)}</span>
        <span className="mono">{m.closes.replace('Closes ', '')}</span>
      </div>
    </div>
  )
}

export function MarketsScreen({ onMarketTap, density = 'comfortable', state = 'ok' }: { onMarketTap: (m: Market) => void; density?: 'comfortable' | 'compact'; state?: 'ok' | 'loading' | 'empty' }) {
  const [cat, setCat] = useState('all')
  const filtered = cat === 'all' ? HULA_MARKETS : HULA_MARKETS.filter(m => m.cat === cat)
  const featured = HULA_MARKETS[0] as Market3way

  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ padding: '8px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark size={26} />
        <button className="tap" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--t-surface)', border: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="var(--t-text-2)" strokeWidth="1.5" /><path d="M11 11l3 3" stroke="var(--t-text-2)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div style={{ padding: '4px 16px 12px' }}>
        <p style={{ fontSize: 13, color: 'var(--t-text-2)' }}>Balance</p>
        <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--t-text)' }}>₱8,420.50</span>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto' }}>
        {HULA_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} className="tap" style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', background: cat === c.id ? 'var(--t-gold)' : 'var(--t-surface)', color: cat === c.id ? '#0A0A0B' : 'var(--t-text)', border: cat === c.id ? '1px solid var(--t-gold)' : '1px solid var(--t-border)' }}>{c.label}</button>
        ))}
      </div>

      <SectionHeader title="World Cup 2026 · Featured" />
      <div style={{ padding: '0 16px' }}>
        <FeaturedFootball m={featured} onTap={() => onMarketTap(featured)} />
      </div>

      <SectionHeader title={cat === 'all' ? 'All markets' : `${cat} markets`} action="Sort: Volume" />
      {state === 'loading' ? (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ padding: 14, background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 12 }}>
              <Skel w={80} h={10} style={{ marginBottom: 10 }} />
              <Skel w="80%" h={14} style={{ marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 8 }}><Skel h={36} r={8} /><Skel h={36} r={8} /></div>
            </div>
          ))}
        </div>
      ) : state === 'empty' ? (
        <EmptyState title="No markets in this category yet" body="Check back soon — we add markets weekly. Want one we don't have? Suggest it." />
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.slice(cat === 'all' ? 1 : 0).map(m => <MarketCard key={m.id} m={m} onTap={onMarketTap} density={density} />)}
        </div>
      )}

      <div style={{ padding: '32px 16px 0', textAlign: 'center' }}>
        <TrustLine>BSP-licensed PDAX rails · On-chain settlement</TrustLine>
      </div>
    </div>
  )
}

/* ---------------- Portfolio ---------------- */

function Stat({ label, val, mono }: { label: string; val: string | number; mono?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: 'var(--t-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
      <p className={mono ? 'mono' : ''} style={{ fontSize: 14, fontWeight: 600 }}>{val}</p>
    </div>
  )
}

function PositionCard({ p }: { p: OpenPosition }) {
  const pl = p.value - p.cost
  const positive = pl >= 0
  return (
    <div style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 600, flex: 1, paddingRight: 8 }}>{p.market}</p>
        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, background: p.outcome.includes('NO') ? 'var(--t-no-bg)' : 'var(--t-yes-bg)', color: p.outcome.includes('NO') ? 'var(--t-danger)' : 'var(--t-success)', height: 'fit-content', whiteSpace: 'nowrap' }}>{p.outcome}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)', display: 'block' }}>{p.shares} shares · avg {p.avgPrice}¢</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)' }}>now {p.currentPrice}¢</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{peso(p.value)}</p>
          <p className="mono" style={{ fontSize: 11, color: positive ? 'var(--t-success)' : 'var(--t-danger)', fontWeight: 600 }}>{peso(pl, { sign: true })}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="tap" style={{ flex: 1, padding: 9, borderRadius: 8, background: 'transparent', border: '1px solid var(--t-border)', color: 'var(--t-text)', fontSize: 12, fontWeight: 500 }}>Buy more</button>
        <button className="tap" style={{ flex: 1, padding: 9, borderRadius: 8, background: 'var(--t-gold)', color: '#0A0A0B', fontSize: 12, fontWeight: 600, border: 'none' }}>Sell now</button>
      </div>
    </div>
  )
}

function PendingPositionCard({ p }: { p: PendingPosition }) {
  return (
    <div style={{ background: 'var(--t-surface)', border: '1px solid rgba(244,185,66,0.3)', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{p.market}</p>
        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(244,185,66,0.15)', color: 'var(--t-gold)', height: 'fit-content', whiteSpace: 'nowrap' }}>SETTLING</span>
      </div>
      <span className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)', display: 'block' }}>{p.shares} shares · avg {p.avgPrice}¢ · cost {peso(p.cost)}</span>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, padding: 10, background: 'var(--t-bg)', borderRadius: 8, border: '1px solid var(--t-border)', alignItems: 'center' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--t-gold)', borderTopColor: 'transparent', animation: 'spin 0.9s linear infinite' }} />
        <p style={{ fontSize: 11, color: 'var(--t-text-2)' }}>{p.note}</p>
      </div>
    </div>
  )
}

function ResolvedPositionCard({ p }: { p: ResolvedPosition }) {
  const won = p.status === 'won'
  return (
    <div style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 600, flex: 1, paddingRight: 8 }}>{p.market}</p>
        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: won ? 'var(--t-yes-bg)' : 'var(--t-no-bg)', color: won ? 'var(--t-success)' : 'var(--t-danger)' }}>{won ? 'WON' : 'LOST'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)', display: 'block' }}>{p.outcome} · {p.shares} shares</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--t-text-3)' }}>Settled {p.settledAt}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{peso(p.payout)}</p>
          <p className="mono" style={{ fontSize: 11, color: won ? 'var(--t-success)' : 'var(--t-danger)', fontWeight: 600 }}>{peso(p.profit, { sign: true })}</p>
        </div>
      </div>
      <button className="tap" style={{ marginTop: 10, fontSize: 11, color: 'var(--t-gold)', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none' }}>
        View receipt
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 7L7 2M7 2H3M7 2v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}

export function PortfolioScreen({ state = 'ok' }: { state?: 'ok' | 'empty' }) {
  const [tab, setTab] = useState<'open' | 'pending' | 'resolved'>('open')
  if (state === 'empty') {
    return (
      <div style={{ paddingBottom: 96 }}>
        <ScreenHeader title="Portfolio" />
        <EmptyState title="Make your first prediction" body="Open positions show up here. P&L updates live as prices move." action="Browse markets" />
      </div>
    )
  }
  const totalCost = HULA_POSITIONS_OPEN.reduce((s, p) => s + p.cost, 0)
  const totalValue = HULA_POSITIONS_OPEN.reduce((s, p) => s + p.value, 0)
  const pl = totalValue - totalCost
  const plPct = ((pl / totalCost) * 100).toFixed(1)

  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ padding: '12px 16px 4px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--serif)', letterSpacing: '-0.02em' }}>Portfolio</h1>
      </div>

      <div style={{ margin: '12px 16px', padding: 18, background: 'var(--t-surface)', borderRadius: 14, border: '1px solid var(--t-border)' }}>
        <p style={{ fontSize: 11, color: 'var(--t-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open value</p>
        <span className="mono" style={{ fontSize: 30, fontWeight: 700 }}>{peso(totalValue)}</span>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <span className="mono" style={{ color: pl >= 0 ? 'var(--t-success)' : 'var(--t-danger)', fontWeight: 600 }}>{pl >= 0 ? '▲' : '▼'} {peso(pl, { sign: true })} ({plPct}%)</span>
          <span className="mono" style={{ color: 'var(--t-text-2)', marginLeft: 12 }}>since open</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--t-border)' }}>
          <Stat label="Open" val={HULA_POSITIONS_OPEN.length} />
          <Stat label="Pending" val={HULA_POSITIONS_PENDING.length} />
          <Stat label="Cost basis" val={peso(totalCost)} mono />
        </div>
      </div>

      <div style={{ padding: '4px 16px 12px', display: 'flex', gap: 6 }}>
        {([{ id: 'open', l: 'Open' }, { id: 'pending', l: 'Pending' }, { id: 'resolved', l: 'Resolved' }] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="tap" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: tab === t.id ? 'var(--t-surface-2)' : 'transparent', color: tab === t.id ? 'var(--t-text)' : 'var(--t-text-2)', border: '1px solid var(--t-border)' }}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'open' && HULA_POSITIONS_OPEN.map(p => <PositionCard key={p.id} p={p} />)}
        {tab === 'pending' && HULA_POSITIONS_PENDING.map(p => <PendingPositionCard key={p.id} p={p} />)}
        {tab === 'resolved' && HULA_POSITIONS_RESOLVED.map(p => <ResolvedPositionCard key={p.id} p={p} />)}
      </div>
    </div>
  )
}

/* ---------------- Wallet ---------------- */

export function WalletScreen({ onDeposit, onWithdraw }: { onDeposit: () => void; onWithdraw: () => void }) {
  const activity = [
    { t: 'Deposit', d: 'PDAX → Hula', a: '+₱2,000.00', when: 'Today 8:42 AM', pos: true, hash: '0x4f2a…91c3' },
    { t: 'Buy', d: 'Ginebra YES @ 58¢', a: '−₱1,160.00', when: 'Yesterday', pos: false, hash: '0x8b3e…5a40' },
    { t: 'Settled', d: 'Lakers Game 7 NO · won', a: '+₱6,000.00', when: '3 days ago', pos: true, hash: '0x12bc…77d0' },
    { t: 'Withdraw', d: 'Hula → PDAX → BPI', a: '−₱5,000.00', when: '5 days ago', pos: false, hash: '0xa19f…0ee2' },
  ]
  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ padding: '12px 16px 4px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--serif)', letterSpacing: '-0.02em' }}>Wallet</h1>
      </div>

      <div style={{ margin: '8px 16px 16px', padding: 18, background: 'linear-gradient(135deg, rgba(244,185,66,0.10), var(--t-surface))', borderRadius: 14, border: '1px solid rgba(244,185,66,0.25)' }}>
        <p style={{ fontSize: 11, color: 'var(--t-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available balance</p>
        <p className="mono" style={{ fontSize: 34, fontWeight: 700, marginTop: 4 }}>{pesoCents(8420.50)}</p>
        <p className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 2 }}>+ {peso(18000)} in open positions</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          <button onClick={onDeposit} className="tap" style={{ padding: 12, borderRadius: 10, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 13, border: 'none' }}>+ Deposit</button>
          <button onClick={onWithdraw} className="tap" style={{ padding: 12, borderRadius: 10, background: 'transparent', border: '1px solid var(--t-border)', color: 'var(--t-text)', fontWeight: 500, fontSize: 13 }}>Withdraw</button>
        </div>
      </div>

      <SectionHeader title="Recent activity" />
      <div style={{ margin: '0 16px', background: 'var(--t-surface)', borderRadius: 12, border: '1px solid var(--t-border)', overflow: 'hidden' }}>
        {activity.map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderBottom: i < activity.length - 1 ? '1px solid var(--t-border)' : 'none', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 500 }}>{t.t} <span style={{ color: 'var(--t-text-2)', fontWeight: 400 }}>· {t.d}</span></p>
              <p className="mono" style={{ fontSize: 10, color: 'var(--t-text-3)', marginTop: 2 }}>{t.when} · {t.hash}</p>
            </div>
            <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: t.pos ? 'var(--t-success)' : 'var(--t-text)' }}>{t.a}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '24px 16px 0', textAlign: 'center' }}>
        <TrustLine>Settlement via PDAX (BSP-licensed) · Segregated client custody, daily reconciled</TrustLine>
      </div>
    </div>
  )
}

/* ---------------- Account ---------------- */

function ListGroup({ children }: { children: ReactNode }) {
  return <div style={{ margin: '0 16px', background: 'var(--t-surface)', borderRadius: 12, border: '1px solid var(--t-border)', overflow: 'hidden' }}>{children}</div>
}

function ListRow({ icon, title, detail, badge }: { icon: string; title: string; detail?: string; badge?: string }) {
  return (
    <div className="tap" style={{ display: 'flex', alignItems: 'center', padding: '13px 14px', borderBottom: '1px solid var(--t-border)', gap: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--t-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500 }}>{title}</p>
        {detail && <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 1 }}>{detail}</p>}
      </div>
      {badge && <span style={{ fontSize: 9, color: 'var(--t-text-3)', fontStyle: 'italic' }}>{badge}</span>}
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="var(--t-text-3)" strokeWidth="1.4" strokeLinecap="round" /></svg>
    </div>
  )
}

export function AccountScreen() {
  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ padding: '12px 16px 4px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--serif)', letterSpacing: '-0.02em' }}>Account</h1>
      </div>

      <div style={{ margin: '12px 16px 4px', padding: 16, background: 'var(--t-surface)', borderRadius: 14, border: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #F4B942, #B8860B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0A0A0B', fontSize: 18 }}>P</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>Paolo M.</p>
          <p className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)' }}>paolo@gmail.com</p>
          <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 7px', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, background: 'rgba(244,185,66,0.12)', color: 'var(--t-gold)', borderRadius: 4 }}>★ FOUNDING MEMBER #312</span>
        </div>
      </div>

      <SectionHeader title="Settings" />
      <ListGroup>
        <ListRow icon="🔐" title="Passkey & security" detail="FaceID enrolled" />
        <ListRow icon="📧" title="Notifications" detail="Email + in-app" />
        <ListRow icon="🆔" title="KYC status" detail="Not required" badge="Optional for >₱50k/mo" />
      </ListGroup>

      <SectionHeader title="Trust & verification" />
      <ListGroup>
        <ListRow icon="🛡" title="BSP-licensed PDAX" detail="See license" />
        <ListRow icon="⚖" title="Philippine legal counsel" detail="Domingo Dimayuga & Co." />
        <ListRow icon="🔒" title="Audit trail" detail="Reconciled daily · attested monthly" />
      </ListGroup>

      <SectionHeader title="Help" />
      <ListGroup>
        <ListRow icon="❓" title="How Hula works" detail="3-min read" />
        <ListRow icon="💬" title="Contact support" detail="hello@hulaan.ph" />
        <ListRow icon="📜" title="Terms · Privacy" />
      </ListGroup>

      <div style={{ padding: '24px 16px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: 'var(--t-text-3)' }}>Hula v0.9.2 · Built in Manila</p>
      </div>
    </div>
  )
}
