'use client'

import { useState, ReactNode } from 'react'
import { Market, Market3way, peso } from './data'
import { ScreenHeader, SectionHeader, useLiveTick } from './screens-main'

/* ---------------- Order ticket / Receipt / Sheet ---------------- */

export type Trade = {
  market: Market
  side: 'YES' | 'NO'
  outcome3way: { id: string; label: string; sub: string; price: number } | null
  amount: number
  shares: number
  price: number
  action: 'BUY' | 'SELL'
}

export function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', animation: 'fadeIn 0.2s' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--t-surface)', borderTopLeftRadius: 24, borderTopRightRadius: 24, animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '88%', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--t-surface)', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--t-text-3)', position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }} />
          <h3 style={{ fontSize: 17, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} className="tap" style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--t-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1l-9 9" stroke="var(--t-text)" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function OrderTicket({ market, side, outcome3way, action, onClose, onConfirm }: { market: Market; side: 'YES' | 'NO'; outcome3way: Market3way['outcomes'][number] | null; action: 'BUY' | 'SELL'; onClose: () => void; onConfirm: (trade: Trade) => void }) {
  const [amount, setAmount] = useState(500)
  const isThree = market.type === '3way'
  const price = isThree && outcome3way ? outcome3way.price : (market.type === 'binary' ? (side === 'YES' ? market.yes : market.no) : 50)
  const shares = Math.floor((amount * 100) / price)
  const payout = shares
  const profit = payout - amount
  const slippage = 0.8
  const showSlippageWarn = slippage >= 5
  const balance = 8420.50
  const insufficient = amount > balance

  return (
    <Sheet onClose={onClose} title={`${action === 'BUY' ? 'Buy' : 'Sell'} ${isThree && outcome3way ? outcome3way.label : side}`}>
      <p className="mono" style={{ fontSize: 11, color: 'var(--t-text-3)', padding: '0 16px' }}>{market.id} · {market.title}</p>

      <div style={{ padding: '20px 16px 12px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginBottom: 6 }}>Amount</p>
        <p className="mono" style={{ fontSize: 44, fontWeight: 700, color: 'var(--t-text)' }}>{peso(amount)}</p>
        <p className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 4 }}>≈ {shares} shares @ {price}¢</p>
      </div>

      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 6, justifyContent: 'center' }}>
        {[100, 500, 1000, 2500].map(v => (
          <button key={v} onClick={() => setAmount(v)} className="tap" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: amount === v ? 'var(--t-gold)' : 'var(--t-surface)', color: amount === v ? '#0A0A0B' : 'var(--t-text)', border: '1px solid', borderColor: amount === v ? 'var(--t-gold)' : 'var(--t-border)' }}>{peso(v)}</button>
        ))}
      </div>

      <div style={{ padding: '14px 16px', background: 'var(--t-bg)', borderTop: '1px solid var(--t-border)', borderBottom: '1px solid var(--t-border)' }}>
        {[
          ['Avg fill price', `${price}¢`],
          ['Shares', shares.toLocaleString()],
          ['If wins, payout', peso(payout)],
          ['Profit if wins', peso(profit, { sign: true })],
          ['Slippage est.', `${slippage}%`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--t-text-2)' }}>{k}</span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

      {showSlippageWarn && (
        <div style={{ margin: '12px 16px', padding: 12, background: 'rgba(244,185,66,0.08)', border: '1px solid rgba(244,185,66,0.4)', borderRadius: 8, display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <p style={{ fontSize: 11, color: 'var(--t-gold)' }}>High slippage — your order may fill at a worse price. Reduce size or split the order.</p>
        </div>
      )}

      {insufficient && (
        <div style={{ margin: '12px 16px', padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8 }}>
          <p style={{ fontSize: 11, color: 'var(--t-danger)' }}>Not enough balance. Deposit ₱{(amount - balance).toFixed(0)} more.</p>
        </div>
      )}

      <div style={{ padding: '12px 16px 28px' }}>
        <button onClick={() => !insufficient && onConfirm({ market, side, outcome3way, amount, shares, price, action })} className="tap" disabled={insufficient} style={{ width: '100%', padding: 16, borderRadius: 12, background: insufficient ? 'var(--t-surface-2)' : 'var(--t-gold)', color: insufficient ? 'var(--t-text-3)' : '#0A0A0B', fontWeight: 600, fontSize: 15, border: 'none' }}>
          {insufficient ? 'Insufficient balance' : `Hold to confirm · ${action === 'BUY' ? 'Buy' : 'Sell'} ${peso(amount)}`}
        </button>
        <p style={{ fontSize: 10, color: 'var(--t-text-3)', textAlign: 'center', marginTop: 8 }}>You can sell anytime before {market.closes.replace('Closes ', '')}</p>
      </div>
    </Sheet>
  )
}

export function Receipt({ trade, onClose, onView }: { trade: Trade; onClose: () => void; onView: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--t-bg)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '40px 24px 0', textAlign: 'center', overflowY: 'auto' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--t-yes-bg)', border: '2px solid var(--t-success)', margin: '0 auto 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 14l5 5 11-11" stroke="var(--t-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, fontFamily: 'var(--serif)', letterSpacing: '-0.01em' }}>Order filled</h2>
        <p className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 6 }}>Confirmed · 12 sec</p>

        <div style={{ margin: '28px auto 0', maxWidth: 320, background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 14, padding: 18, textAlign: 'left' }}>
          <p className="mono" style={{ fontSize: 9, color: 'var(--t-text-3)', letterSpacing: 0.6 }}>{trade.market.id}</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{trade.market.title}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, background: trade.action === 'BUY' ? 'var(--t-yes-bg)' : 'var(--t-no-bg)', color: trade.action === 'BUY' ? 'var(--t-success)' : 'var(--t-danger)' }}>{trade.action}</span>
            <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'var(--t-surface-2)', color: 'var(--t-text)' }}>{trade.outcome3way ? trade.outcome3way.label.toUpperCase() : trade.side}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--t-border)', marginTop: 14, paddingTop: 14 }}>
            {[
              ['Filled at', `${trade.price}¢`],
              ['Shares', trade.shares.toLocaleString()],
              ['Cost', peso(trade.amount)],
              ['Payout if wins', peso(trade.shares)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: 12, color: 'var(--t-text-2)' }}>{k}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
          <button className="tap" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--t-border)', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: 'var(--t-border)' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--t-text-2)' }}>Receipt #4F2A-91C3</span>
            <span style={{ fontSize: 11, color: 'var(--t-gold)', display: 'flex', alignItems: 'center', gap: 4 }}>Audit trail <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 7L7 2M7 2H3M7 2v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg></span>
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--t-text-3)', marginTop: 18, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>You can sell anytime before {trade.market.closes.replace('Closes ', '')}. Funds settle automatically when the market resolves.</p>
      </div>
      <div style={{ padding: '12px 16px 28px', display: 'flex', gap: 8, borderTop: '1px solid var(--t-border)' }}>
        <button onClick={onView} className="tap" style={{ flex: 1, padding: 14, borderRadius: 12, background: 'var(--t-surface-2)', border: '1px solid var(--t-border)', color: 'var(--t-text)', fontWeight: 500, fontSize: 14 }}>View position</button>
        <button onClick={onClose} className="tap" style={{ flex: 1, padding: 14, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 14, border: 'none' }}>Done</button>
      </div>
    </div>
  )
}

/* ---------------- Market detail variants ---------------- */

function Statline({ label, val }: { label: string; val: string | number }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 6px', borderRight: '1px solid var(--t-border)' }}>
      <p style={{ fontSize: 9, color: 'var(--t-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p className="mono" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{val}</p>
    </div>
  )
}

function PriceChart({ values, w = 361, h = 90 }: { values: number[]; w?: number; h?: number }) {
  const min = Math.min(...values) - 4
  const max = Math.max(...values) + 4
  const range = max - min
  const step = w / (values.length - 1)
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - ((v - min) / range) * h).toFixed(1)}`).join(' ')
  const areaPath = path + ` L ${w} ${h} L 0 ${h} Z`
  return (
    <div style={{ padding: '0 16px' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', display: 'block' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--t-gold)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--t-gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#chartGrad)" />
        <path d={path} fill="none" stroke="var(--t-gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--t-text-3)' }}>
        {['1H', '24H', '7D', '30D', 'ALL'].map(t => (
          <button key={t} className="tap" style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 500, background: t === '24H' ? 'var(--t-surface-2)' : 'transparent', color: t === '24H' ? 'var(--t-text)' : 'var(--t-text-2)', border: 'none' }}>{t}</button>
        ))}
      </div>
    </div>
  )
}

export type TradeStarter = (action: 'BUY' | 'SELL', outcome3way: Market3way['outcomes'][number] | null, side: 'YES' | 'NO') => void

export function MarketDetail_Trader({ market, onBack, onTrade, showVolume = true }: { market: Market; onBack: () => void; onTrade: TradeStarter; showVolume?: boolean }) {
  const isThree = market.type === '3way'
  const [selectedOutcome, setSelectedOutcome] = useState(isThree ? market.outcomes[0].id : null)
  const sel = isThree ? market.outcomes.find(o => o.id === selectedOutcome) : null
  const initial = isThree && sel ? sel.price : market.type === 'binary' ? market.yes : 50
  const [livePrice, dir] = useLiveTick(initial, 1, 2400, true)
  const [side, setSide] = useState<'YES' | 'NO'>('YES')

  return (
    <div key={selectedOutcome || 'binary'} style={{ paddingBottom: 130, position: 'relative' }}>
      <ScreenHeader onBack={onBack} title={market.catLabel} subtitle={market.subtitle} right={
        <button className="tap" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--t-surface)', border: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 5l3.5-3.5L10.5 5M7 1.5v9M2 11.5v.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-.5" stroke="var(--t-text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      } />

      <div style={{ padding: '4px 16px 16px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--serif)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{market.title}</h2>
      </div>

      {isThree && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {market.outcomes.map(o => {
              const a = selectedOutcome === o.id
              return (
                <button key={o.id} onClick={() => setSelectedOutcome(o.id)} className="tap" style={{ padding: '10px 6px', borderRadius: 8, background: a ? 'rgba(244,185,66,0.12)' : 'var(--t-surface)', border: a ? '1px solid var(--t-gold)' : '1px solid var(--t-border)', textAlign: 'left' }}>
                  <p style={{ fontSize: 9, color: 'var(--t-text-2)', fontWeight: 600, letterSpacing: 0.5 }}>{o.sub}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, marginTop: 2, color: 'var(--t-text)' }}>{o.label}</p>
                  <p className="mono" style={{ fontSize: 13, fontWeight: 700, color: a ? 'var(--t-gold)' : 'var(--t-text)', marginTop: 4 }}>{a ? livePrice : o.price}¢</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="mono" style={{ fontSize: 64, fontWeight: 700, fontFeatureSettings: '"tnum"', color: dir > 0 ? 'var(--t-success)' : dir < 0 ? 'var(--t-danger)' : 'var(--t-text)', transition: 'color 0.4s' }}>
            {livePrice}<span style={{ fontSize: 28, color: 'var(--t-text-2)' }}>¢</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--t-text-2)' }}>
            {isThree && sel ? `${sel.label} to win` : 'Yes price'}
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--t-text-3)', marginTop: 4 }}>
          <span className="mono" style={{ color: 'var(--t-success)' }}>● LIVE</span> · last tick {dir > 0 ? '+' : dir < 0 ? '−' : ''}1¢ · 1 share = ₱1 if it resolves
        </p>
      </div>

      <PriceChart values={market.type === '3way' && selectedOutcome ? market.movers[selectedOutcome] : market.type === 'binary' ? market.movers : []} />

      {showVolume && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, margin: '20px 16px 0', padding: '14px 0', background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 12 }}>
          <Statline label="Volume" val={peso(market.volume)} />
          <Statline label="Liquidity" val={peso(market.liquidity)} />
          <Statline label="Closes" val={market.closes.replace('Closes ', '')} />
        </div>
      )}

      <SectionHeader title="Resolution" />
      <div style={{ padding: '0 16px' }}>
        <div style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(244,185,66,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 0l1.6 4.4 4.4 1.6-4.4 1.6L7 12l-1.6-4.4L1 6l4.4-1.6L7 0z" fill="var(--t-gold)" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--t-text)' }}>{market.resolution}</p>
              <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 4 }}>This market settles automatically on-chain when the result is reported. Funds in your wallet within minutes.</p>
              <button className="tap" style={{ marginTop: 8, fontSize: 11, color: 'var(--t-gold)', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none' }}>
                Read full rules <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 7L7 2M7 2H3M7 2v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <SectionHeader title="Recent prints" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--t-surface)', border: '1px solid var(--t-border)', borderRadius: 12, margin: '0 16px', overflow: 'hidden' }}>
        {[
          { side: 'BUY', px: livePrice, sz: 250, t: '2s ago' },
          { side: 'BUY', px: livePrice - 1, sz: 80, t: '14s ago' },
          { side: 'SELL', px: livePrice - 1, sz: 320, t: '38s ago' },
          { side: 'BUY', px: livePrice - 2, sz: 1000, t: '1m ago' },
        ].map((t, i, arr) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 11, borderBottom: i < arr.length - 1 ? '1px solid var(--t-border)' : 'none' }}>
            <span className="mono" style={{ color: t.side === 'BUY' ? 'var(--t-success)' : 'var(--t-danger)', fontWeight: 600, width: 40 }}>{t.side}</span>
            <span className="mono" style={{ color: 'var(--t-text)', flex: 1 }}>{t.px}¢ × {t.sz}</span>
            <span className="mono" style={{ color: 'var(--t-text-3)' }}>{t.t}</span>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'rgba(10,10,11,0.92)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderTop: '1px solid var(--t-border)' }}>
        {!isThree && market.type === 'binary' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setSide('YES')} className="tap" style={{ flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: side === 'YES' ? 'var(--t-yes-bg)' : 'transparent', color: side === 'YES' ? 'var(--t-success)' : 'var(--t-text-2)', border: '1px solid', borderColor: side === 'YES' ? 'var(--t-success)' : 'var(--t-border)' }}>Yes {market.yes}¢</button>
            <button onClick={() => setSide('NO')} className="tap" style={{ flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: side === 'NO' ? 'var(--t-no-bg)' : 'transparent', color: side === 'NO' ? 'var(--t-danger)' : 'var(--t-text-2)', border: '1px solid', borderColor: side === 'NO' ? 'var(--t-danger)' : 'var(--t-border)' }}>No {market.no}¢</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onTrade('SELL', isThree && sel ? sel : null, side)} className="tap" style={{ flex: 1, padding: 14, borderRadius: 12, background: 'var(--t-surface-2)', border: '1px solid var(--t-border)', color: 'var(--t-text)', fontWeight: 500, fontSize: 14 }}>Sell</button>
          <button onClick={() => onTrade('BUY', isThree && sel ? sel : null, side)} className="tap" style={{ flex: 2, padding: 14, borderRadius: 12, background: 'var(--t-gold)', color: '#0A0A0B', fontWeight: 600, fontSize: 14, border: 'none' }}>
            Buy {isThree && sel ? sel.label : side} · {livePrice}¢
          </button>
        </div>
      </div>
    </div>
  )
}

export function MarketDetail_Kalshi({ market, onBack, onTrade }: { market: Market; onBack: () => void; onTrade: TradeStarter }) {
  const isThree = market.type === '3way'
  const [selOutcome, setSelOutcome] = useState(isThree ? market.outcomes[0].id : null)
  const sel = isThree ? market.outcomes.find(o => o.id === selOutcome) : null
  return (
    <div style={{ paddingBottom: 100, position: 'relative' }}>
      <ScreenHeader onBack={onBack} title={market.catLabel} />
      <div style={{ padding: '0 16px 16px' }}>
        <p className="mono" style={{ fontSize: 9, letterSpacing: 0.6, color: 'var(--t-text-3)' }}>{market.id}</p>
        <h2 style={{ fontSize: 19, fontWeight: 500, marginTop: 6, lineHeight: 1.3 }}>{market.title}</h2>
        <p style={{ fontSize: 11, color: 'var(--t-text-2)', marginTop: 6 }}>{market.subtitle}</p>
      </div>

      {isThree ? (
        <div style={{ padding: '0 16px' }}>
          {market.outcomes.map(o => (
            <button key={o.id} onClick={() => setSelOutcome(o.id)} className="tap" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: selOutcome === o.id ? 'var(--t-surface)' : 'transparent', border: '1px solid var(--t-border)', borderBottom: 'none' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 9, color: 'var(--t-text-3)', letterSpacing: 0.5, fontWeight: 600 }}>{o.sub}</p>
                <p style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{o.label}</p>
              </div>
              <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: selOutcome === o.id ? 'var(--t-gold)' : 'var(--t-text)' }}>{o.price}¢</span>
            </button>
          ))}
        </div>
      ) : market.type === 'binary' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--t-border)', border: '1px solid var(--t-border)', borderRadius: 8, overflow: 'hidden', margin: '0 16px' }}>
          <div style={{ padding: '20px 16px', background: 'var(--t-bg)', textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t-success)', letterSpacing: 0.6 }}>YES</p>
            <p className="mono" style={{ fontSize: 36, fontWeight: 600, color: 'var(--t-text)', marginTop: 4 }}>{market.yes}<span style={{ fontSize: 18, color: 'var(--t-text-2)' }}>¢</span></p>
          </div>
          <div style={{ padding: '20px 16px', background: 'var(--t-bg)', textAlign: 'center' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t-danger)', letterSpacing: 0.6 }}>NO</p>
            <p className="mono" style={{ fontSize: 36, fontWeight: 600, color: 'var(--t-text)', marginTop: 4 }}>{market.no}<span style={{ fontSize: 18, color: 'var(--t-text-2)' }}>¢</span></p>
          </div>
        </div>
      )}

      <SectionHeader title="Probability over time" />
      <PriceChart values={market.type === '3way' && selOutcome ? market.movers[selOutcome] : market.type === 'binary' ? market.movers : []} />

      <SectionHeader title="Market info" />
      <div style={{ padding: '0 16px' }}>
        {[
          ['Volume traded', peso(market.volume)],
          ['Liquidity', peso(market.liquidity)],
          ['Closes', market.closes.replace('Closes ', '')],
          ['Resolves via', market.resolution],
        ].map(([k, v], i, arr) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--t-border)' : 'none' }}>
            <span style={{ fontSize: 12, color: 'var(--t-text-2)' }}>{k}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--t-text)', textAlign: 'right', maxWidth: 220 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'rgba(10,10,11,0.92)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderTop: '1px solid var(--t-border)' }}>
        <button onClick={() => onTrade('BUY', sel || null, 'YES')} className="tap" style={{ width: '100%', padding: 14, borderRadius: 8, background: 'var(--t-text)', color: 'var(--t-bg)', fontWeight: 600, fontSize: 14, border: 'none' }}>
          Buy {isThree && sel ? sel.label : 'YES'} · {isThree && sel ? sel.price : market.type === 'binary' ? market.yes : 50}¢
        </button>
      </div>
    </div>
  )
}
