'use client'

import { useState, ReactNode } from 'react'
import { Market, Market3way } from './data'
import {
  StatusBar, TabBar,
  MarketsScreen, PortfolioScreen, WalletScreen, AccountScreen,
} from './screens-main'
import {
  MarketDetail_Trader, OrderTicket, Receipt, Trade,
} from './screens-detail'
import { OnboardingFlow, DepositSheet, WithdrawSheet } from './screens-flows'

type TabId = 'markets' | 'portfolio' | 'wallet' | 'account'
type Route = { name: 'onboarding' } | { name: 'app' } | { name: 'detail'; market: Market }
type SheetState = null | 'order' | 'deposit' | 'withdraw' | { name: 'receipt'; trade: Trade }
type PendingTrade = { market: Market; action: 'BUY' | 'SELL'; outcome3way: Market3way['outcomes'][number] | null; side: 'YES' | 'NO' } | null

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="taya-phone-wrap">
      <div className="taya-phone">
        <div className="taya-notch" />
        <StatusBar dark />
        <div className="taya-screen" style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          {children}
        </div>
        <div className="taya-home-indicator" />
      </div>
      <style>{`
        .taya-phone-wrap {
          min-height: 100vh;
          background: radial-gradient(ellipse at top, #1a1a1f 0%, #0a0a0b 70%);
          display: flex; align-items: center; justify-content: center;
          padding: 0;
          color: var(--t-text);
          font-family: var(--sans);
        }
        .taya-phone {
          width: 100%;
          height: 100vh;
          background: #0A0A0B;
          position: relative;
          overflow: hidden;
        }
        .taya-notch { display: none; }
        .taya-home-indicator { display: none; }
        @media (min-width: 600px) {
          .taya-phone-wrap { padding: 32px 20px; }
          .taya-phone {
            width: 393px;
            height: 852px;
            border-radius: 48px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12), inset 0 0 0 8px #000;
          }
          .taya-notch {
            display: block;
            position: absolute; top: 11px; left: 50%;
            transform: translateX(-50%);
            width: 122px; height: 35px;
            border-radius: 22px; background: #000; z-index: 50;
          }
          .taya-home-indicator {
            display: block;
            position: absolute; bottom: 8px; left: 50%;
            transform: translateX(-50%);
            width: 134px; height: 5px;
            border-radius: 100px;
            background: rgba(255,255,255,0.6);
            z-index: 60;
          }
        }
      `}</style>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'onboarding' })
  const [activeTab, setActiveTab] = useState<TabId>('markets')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [pendingTrade, setPendingTrade] = useState<PendingTrade>(null)

  const openMarket = (m: Market) => setRoute({ name: 'detail', market: m })
  const startTrade = (action: 'BUY' | 'SELL', outcome3way: Market3way['outcomes'][number] | null, side: 'YES' | 'NO') => {
    if (route.name !== 'detail') return
    setPendingTrade({ market: route.market, action, outcome3way, side })
    setSheet('order')
  }
  const confirmTrade = (trade: Trade) => setSheet({ name: 'receipt', trade })
  const closeSheet = () => setSheet(null)

  return (
    <Phone>
      {route.name === 'onboarding' && (
        <OnboardingFlow onDone={() => setRoute({ name: 'app' })} />
      )}

      {route.name === 'app' && (
        <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
          {activeTab === 'markets' && <MarketsScreen onMarketTap={openMarket} />}
          {activeTab === 'portfolio' && <PortfolioScreen />}
          {activeTab === 'wallet' && <WalletScreen onDeposit={() => setSheet('deposit')} onWithdraw={() => setSheet('withdraw')} />}
          {activeTab === 'account' && <AccountScreen />}
        </div>
      )}

      {route.name === 'detail' && (
        <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
          <MarketDetail_Trader market={route.market} onBack={() => setRoute({ name: 'app' })} onTrade={startTrade} />
        </div>
      )}

      {route.name === 'app' && <TabBar active={activeTab} onChange={setActiveTab} />}

      {sheet === 'order' && pendingTrade && (
        <OrderTicket
          market={pendingTrade.market}
          side={pendingTrade.side}
          outcome3way={pendingTrade.outcome3way}
          action={pendingTrade.action}
          onClose={closeSheet}
          onConfirm={confirmTrade}
        />
      )}

      {sheet && typeof sheet === 'object' && sheet.name === 'receipt' && (
        <Receipt
          trade={sheet.trade}
          onClose={() => { setSheet(null); setRoute({ name: 'app' }); setActiveTab('markets') }}
          onView={() => { setSheet(null); setRoute({ name: 'app' }); setActiveTab('portfolio') }}
        />
      )}

      {sheet === 'deposit' && <DepositSheet onClose={closeSheet} onComplete={closeSheet} />}
      {sheet === 'withdraw' && <WithdrawSheet onClose={closeSheet} onComplete={closeSheet} />}
    </Phone>
  )
}
