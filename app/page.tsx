'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Home() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const emailInputRef = useRef<HTMLInputElement>(null)
  const heroEmailRef = useRef<HTMLFormElement>(null)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const target = new Date('2026-06-11T00:00:00+08:00').getTime()
    const tick = () => {
      const diff = target - Date.now()
      if (diff <= 0) { setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const handleEmailSubmit = async (e: React.FormEvent, scrollTo?: React.RefObject<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        setStatus('success')
        setEmail('')
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch (err) {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const scrollToHeroEmail = () => {
    heroEmailRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut', delay: index * 0.08 },
    }),
  }

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text-primary">
      {/* Header with Logo */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 py-4 md:px-6 border-b border-brand-border/50 bg-brand-bg/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 40 40"
              className="w-8 h-8"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="20" cy="20" r="20" fill="#0A0A0B" />
              <text
                x="20"
                y="28"
                fontFamily="Fraunces, Georgia, serif"
                fontSize="28"
                fontWeight="600"
                textAnchor="middle"
                fill="#F4B942"
              >
                â
              </text>
            </svg>
            <span className="text-xl font-serif font-medium hidden sm:inline">
              Tay<span className="text-brand-accent">â</span>
            </span>
          </div>
          <nav className="flex gap-6 text-sm">
            <a href="#categories" className="text-brand-text-secondary hover:text-brand-text-primary transition-colors">
              Markets
            </a>
            <a href="#how-it-works" className="text-brand-text-secondary hover:text-brand-text-primary transition-colors">
              How it works
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 pt-32 pb-20 md:px-6 md:pt-40 md:pb-32">
        {/* Subtle background chart line */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
          <svg className="w-full h-full" viewBox="0 0 1000 300" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F4B942" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#F4B942" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 200 Q 250 150 500 100 T 1000 50"
              stroke="url(#chartGradient)"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>

        <div className="relative max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 md:mb-12"
          >
            <h1 className="font-serif text-5xl md:text-7xl font-medium tracking-tight leading-tight">
              Tay<span className="text-brand-accent">â</span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 md:mb-8"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-snug">
              Predict anything. From PBA to M-Series.
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8 md:mb-10"
          >
            <p className="text-lg md:text-xl text-brand-text-secondary leading-relaxed max-w-2xl">
              The Philippines' first prediction market. Stake your call on the moments that matter — local hoops, esports, pageants, the World Cup. Sell anytime before the result. Pesos in, pesos out.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-10 md:mb-12"
          >
            <p className="text-sm italic text-brand-accent">
              First 1,000 users get founding-member status + zero fees for life.
            </p>
          </motion.div>

          {/* Email Form */}
          <motion.form
            ref={heroEmailRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            onSubmit={handleEmailSubmit}
            className="mb-12 md:mb-16"
          >
            <div className="flex flex-col md:flex-row gap-3 md:gap-0">
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.ph"
                disabled={status === 'loading'}
                className="flex-1 px-4 py-4 md:py-3 bg-brand-surface border border-brand-border text-brand-text-primary placeholder-brand-text-secondary focus:outline-none focus:border-brand-accent transition-colors font-mono text-sm rounded-l-brand-input md:rounded-l-input md:rounded-r-none"
                required
              />
              <button
                type="submit"
                disabled={status === 'loading' || !email.trim()}
                className={`px-6 py-4 md:py-3 font-medium rounded-r-brand-input md:rounded-r-input md:rounded-l-none text-sm transition-all ${
                  status === 'success'
                    ? 'bg-brand-success text-brand-bg'
                    : status === 'error'
                    ? 'bg-brand-danger text-brand-text-primary'
                    : 'bg-brand-accent text-brand-bg hover:brightness-110 active:scale-98'
                } ${status === 'loading' ? 'opacity-75' : ''}`}
              >
                {status === 'loading' ? (
                  <span>Loading…</span>
                ) : status === 'success' ? (
                  <span>You're in.</span>
                ) : status === 'error' ? (
                  <span>Try again</span>
                ) : (
                  <span>Reserve handle →</span>
                )}
              </button>
            </div>
            {status === 'success' && (
              <p className="text-sm text-brand-success mt-3">We'll be in touch soon.</p>
            )}
          </motion.form>

          {/* Decorative Market Card - Desktop Only */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="hidden md:block max-w-md"
          >
            <div className="bg-brand-surface border border-brand-border rounded-card p-6">
              <p className="text-sm text-brand-text-secondary mb-4">Sample market</p>
              <p className="text-lg font-medium mb-6">Will Ginebra win the PBA Finals?</p>
              <div className="grid grid-cols-2 gap-3">
                <button className="py-3 bg-brand-success/10 border border-brand-success text-brand-success font-mono text-sm rounded-btn hover:bg-brand-success/20 transition-colors">
                  Yes 64¢
                </button>
                <button className="py-3 bg-brand-danger/10 border border-brand-danger text-brand-danger font-mono text-sm rounded-btn hover:bg-brand-danger/20 transition-colors">
                  No 36¢
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories Section */}
      <section id="categories" className="px-4 py-20 md:px-6 md:py-32 border-t border-brand-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                {
                  emoji: '🏀',
                  title: 'PBA & NBA',
                  desc: 'Every game. Every quarter. Every clutch moment.',
                },
                {
                  emoji: '🎮',
                  title: 'MLBB & Esports',
                  desc: 'MPL-PH, M-Series, every major bracket.',
                },
                {
                  emoji: '👑',
                  title: 'Culture & World',
                  desc: 'Pageants, awards nights, World Cup 2026. If it\'s predictable, it\'s tradeable.',
                },
              ].map((cat, idx) => (
                <motion.div
                  key={idx}
                  custom={idx}
                  variants={cardVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-50px' }}
                  className="bg-brand-surface border border-brand-border rounded-card p-6"
                >
                  <div className="text-3xl mb-4">{cat.emoji}</div>
                  <h3 className="text-xl font-semibold mb-2">{cat.title}</h3>
                  <p className="text-brand-text-secondary">{cat.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="px-4 py-20 md:px-6 md:py-32 border-t border-brand-border">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-semibold mb-16 md:mb-24"
          >
            Three steps. Peer-driven. Crowd-priced.
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              {[
                {
                  num: '01',
                  title: 'Pick a market.',
                  desc: 'Will Ginebra take the Finals? Will Echo win M7? Will the Philippines crown another Miss Universe?',
                },
                {
                  num: '02',
                  title: 'Take a side.',
                  desc: 'Yes or no. Price reflects what the crowd believes right now.',
                },
                {
                  num: '03',
                  title: 'Sell anytime.',
                  desc: 'Lock in profit before the final whistle. Cut losses. Or hold to resolution and let the crowd be right or wrong with you.',
                },
              ].map((step, idx) => (
                <motion.div
                  key={idx}
                  custom={idx}
                  variants={cardVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-50px' }}
                  className="flex flex-col"
                >
                  <div className="text-5xl font-mono font-bold text-brand-accent mb-4">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-brand-text-secondary">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center text-brand-text-secondary text-sm mt-16 md:mt-24"
          >
            Prices move because people move them.
          </motion.p>
        </div>
      </section>

      {/* Trust Frame Section */}
      <section id="trust" className="px-4 py-20 md:px-6 md:py-32 border-t border-brand-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="mb-12 md:mb-16"
          >
            <p className="text-xs font-mono font-semibold text-brand-accent uppercase tracking-widest mb-4">
              Why Tayâ
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Built right for Filipino bettors.
            </h2>
            <p className="text-brand-text-secondary mt-4 max-w-2xl">
              No offshore. No vanishing acts. Built with regulators, not around them.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                {
                  title: 'Regulated peso on-ramp',
                  desc: 'Your pesos move through PDAX, a BSP-licensed Philippine crypto exchange. Not an offshore wallet that disappears.',
                },
                {
                  title: 'Philippine lawyer in-house',
                  desc: 'Our legal co-founder leads the regulatory work. We are building Tayâ with PAGCOR, not around them.',
                },
                {
                  title: 'Funds held in segregated client accounts',
                  desc: 'Your pesos sit in a separate, named client account — not commingled with operator funds. Reconciled daily; independent attestation.',
                },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  custom={idx}
                  variants={cardVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-50px' }}
                  className="bg-brand-surface border border-brand-border rounded-card p-6"
                >
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-brand-text-secondary">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Preview / Demo Section */}
      <section id="preview" className="px-4 py-20 md:px-6 md:py-32 border-t border-brand-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="mb-12 md:mb-16"
          >
            <p className="text-xs font-mono font-semibold text-brand-accent uppercase tracking-widest mb-4">
              Preview
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              The app, six weeks before launch.
            </h2>
            <p className="text-brand-text-secondary mt-4 max-w-2xl">
              Mobile-first prediction market. Tap around — it&apos;s the real product flow with mock data: passkey signup, markets feed with the WC 2026 launch market, live price ticking, order ticket, on-chain receipt, portfolio, PDAX deposit and withdraw.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="taya-preview-wrap"
          >
            <div className="taya-preview-bezel">
              <iframe
                src="/app"
                title="Tayâ app preview"
                className="taya-preview-iframe"
                loading="lazy"
              />
            </div>
          </motion.div>

          <div className="text-center mt-10">
            <a
              href="/app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-accent text-brand-bg font-medium rounded-btn hover:brightness-110 active:scale-98 transition-all text-sm"
            >
              Open in fullscreen →
            </a>
            <p className="text-xs text-brand-text-secondary mt-4 max-w-md mx-auto">
              Demo only — settlements, balances and trades are simulated.
              Real product launches with WC 2026.
            </p>
          </div>
        </div>

        <style jsx>{`
          .taya-preview-wrap {
            display: flex;
            justify-content: center;
          }
          .taya-preview-bezel {
            width: 393px;
            max-width: 100%;
            height: 720px;
            border-radius: 36px;
            overflow: hidden;
            background: #0A0A0B;
            box-shadow:
              0 30px 60px rgba(0, 0, 0, 0.5),
              0 0 0 1px rgba(255, 255, 255, 0.06),
              inset 0 0 0 6px #000;
            position: relative;
          }
          .taya-preview-iframe {
            width: 100%;
            height: 100%;
            border: 0;
            display: block;
          }
          @media (max-width: 480px) {
            .taya-preview-bezel {
              height: 640px;
              border-radius: 28px;
              box-shadow:
                0 20px 40px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                inset 0 0 0 4px #000;
            }
          }
        `}</style>
      </section>

      {/* Launch Hook Section */}
      <section className="px-4 py-20 md:px-6 md:py-32 border-t border-brand-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-mono font-semibold text-brand-accent uppercase tracking-widest mb-4">
              First Event
            </p>
            <h2 className="text-4xl md:text-5xl font-serif font-medium mb-8">
              FIFA World Cup 2026
            </h2>

            {/* Countdown */}
            <div className="flex items-end gap-4 md:gap-6 mb-3">
              {[
                { value: countdown.days, label: 'days' },
                { value: countdown.hours, label: 'hrs' },
                { value: countdown.minutes, label: 'min' },
                { value: countdown.seconds, label: 'sec' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div className="font-mono text-4xl md:text-5xl font-bold text-brand-accent tabular-nums">
                    {String(value).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-brand-text-secondary mt-1 font-mono uppercase tracking-widest">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-brand-text-secondary mb-10 font-mono">until kick-off · Jun 11, 2026</p>

            {/* Sample WM markets */}
            <div className="grid gap-3 mb-10">
              {[
                { q: 'Will Argentina defend their title?', yes: 38, no: 62 },
                { q: 'Will Brazil win it all?', yes: 22, no: 78 },
                { q: 'Will a host nation reach the semifinals?', yes: 44, no: 56 },
              ].map(({ q, yes, no }) => (
                <div key={q} className="bg-brand-surface border border-brand-border rounded-card p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <p className="flex-1 text-sm font-medium">{q}</p>
                  <div className="flex gap-2 shrink-0">
                    <button className="px-4 py-2 bg-brand-success/10 border border-brand-success text-brand-success font-mono text-sm rounded-btn hover:bg-brand-success/20 transition-colors">
                      Yes {yes}¢
                    </button>
                    <button className="px-4 py-2 bg-brand-danger/10 border border-brand-danger text-brand-danger font-mono text-sm rounded-btn hover:bg-brand-danger/20 transition-colors">
                      No {no}¢
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={scrollToHeroEmail}
              className="px-6 py-4 bg-brand-accent text-brand-bg font-medium rounded-btn hover:brightness-110 transition-all text-sm"
            >
              Reserve your handle →
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-16 md:px-6 md:py-20 border-t border-brand-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-8">
          <p className="text-sm text-brand-text-secondary">
            Built in Manila. For Filipinos.
          </p>
          <div className="flex gap-8">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-accent hover:text-brand-text-primary transition-colors"
            >
              Twitter/X
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-accent hover:text-brand-text-primary transition-colors"
            >
              Instagram
            </a>
            <a
              href="mailto:hello@taya.ph"
              className="text-sm text-brand-accent hover:text-brand-text-primary transition-colors"
            >
              Email
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
