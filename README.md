# Hula

The Philippines' prediction market — *"the market for what happens next."* Pesos in, pesos out, on PBA, boxing, the World Cup, weather, showbiz, and the biggest stories of the day.

This repo started as a marketing landing page and has grown into the Phase 0 product surface: a public landing page, a masa-facing live-event game (`/hits`), a player-props prototype (`/picks`), operator dashboards, and a Polymarket-backed price oracle — all on Next.js 14 + Supabase.

## Stack

- **Framework:** Next.js 14 (App Router, `'use client'` pages) + TypeScript
- **Styling:** Tailwind CSS + a hand-rolled design system in `app/globals.css` (light "paper" theme)
- **Fonts:** Fraunces (wordmark/headlines) + Space Mono (all numbers)
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Auth:** Supabase email + password, plus Twilio Verify OTP routes
- **Live odds:** Polymarket Gamma API, cached in Postgres (`lib/oracle`)
- **Email:** Resend (waitlist audience + ops notifications)
- **Analytics:** `@vercel/analytics` + a `/api/analytics/track` event sink
- **Tests:** Vitest (`lib/oracle/*.test.ts`)

## Quick start

```bash
npm install
# create .env.local with at least the Supabase keys — see "Environment" below
npm run dev   # http://localhost:3000
```

Scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | Next.js ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

## Surfaces (routes)

| Route | What it is |
|---|---|
| `/` | Public marketing landing — live-odds ticker, featured card, market grid, waitlist capture |
| `/hits` | Masa-facing live-event **bingo card** product (the Phase 0 demand test). Card detail at `/hits/[card_id]`, history at `/hits/history` |
| `/picks` | PrizePicks-style **player-props** prototype — closed validation tool, not linked from `/` |
| `/app` | Phone-frame product simulator (internal UI prototype) |
| `/ops` | Manual live-ops dashboard (resolve events, toggle fixture status) |
| `/ops/ggr` | Gross Gaming Revenue dashboard |
| `/private/[gameId]/[playerSlug]` | Private prediction games |
| `/dev/signin` | Dev-only sign-in helper |

## Project structure

```
app/
├── layout.tsx              # Root layout, fonts, metadata/OG
├── page.tsx                # Landing page (ticker / hero / markets / how-it-works / footer)
├── globals.css             # Design system + all component styles
├── hits/ picks/ ops/ app/  # Product surfaces (see table above)
└── api/                    # 24 route handlers, incl:
    ├── waitlist/           # Email capture → Resend audience + notify
    ├── auth/               # email + OTP sign-in
    ├── cards/              # /hits card create / read / settle-on-won
    ├── fixtures/ events/   # live-event data + polling
    ├── ops/                # resolve, fixture-status, ggr
    ├── prices/             # live Polymarket odds (lazy-refreshed cache)
    └── cron/               # demo-tick, refresh-prices (manual triggers)

lib/
├── supabase/   # client (browser), server (cookie-bound), admin (service role), middleware
├── oracle/     # Polymarket price feed: polymarket.ts, refresh.ts, slugs.ts (+ tests)
├── hits/       # card generation, payouts, event pools, player data
├── auth/  identity/  analytics/  private-games/  format/  hooks/

supabase/migrations/        # 001–008 (schema, RLS, prices, GGR, mirror_prices, …)
```

## Environment

Create `.env.local` with:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=     # publishable / anon key
SUPABASE_SERVICE_ROLE_KEY=                # server-only; never expose to the browser

# Site (optional — defaults to https://hulaan.ph)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Twilio Verify OTP (optional — phone sign-in)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=

# Resend (optional — waitlist audience + ops notifications)
RESEND_API_KEY=
RESEND_AUDIENCE_ID=
RESEND_NOTIFY_FROM=
RESEND_NOTIFY_TO=

# Ops / cron (optional)
OPS_SHARED_SECRET=                         # gates the manual ops dashboard actions
CRON_SECRET=                               # Bearer token for /api/cron/* endpoints
```

The app fails soft when optional vars are missing (e.g. the waitlist still returns success without Resend), so you can run the landing page with only the Supabase keys.

## Database

Schema lives in `supabase/migrations/` (`001`–`008`). Migrations are applied **manually** in the Supabase SQL Editor — paste-ready copies for the recent ones are at the repo root as `MIGRATION_00X_RUN_ME.sql`. RLS is the access boundary; server-side writes use the service-role admin client (`lib/supabase/admin.ts`), which bypasses RLS.

## Live odds (Polymarket oracle)

The landing page shows **live market odds** (ticker, featured card, market grid) imported from Polymarket.

- Markets are pinned by **stable id** in `lib/oracle/slugs.ts` (`LIVE_MARKETS`) and fetched via `GET /markets/<id>`. Polymarket Gamma's `?search=` does **not** filter — use `?slug=` / `/markets/<id>` to curate, then pin the id.
- `GET /api/prices?events=<slug,slug>` reads the `mirror_prices` cache (migration 008) and **lazily refreshes** any slug older than the TTL (no sub-daily cron — Vercel Hobby caps cron at once/day). The table *is* the cache.
- `GET /api/cron/refresh-prices` (Bearer `CRON_SECRET`) force-warms all curated markets.
- Each landing-page row carries an optional `slug`; only globally-traded markets (World Cup, NBA, BTC/ETH, world events) go live — PH-local markets (PBA, MPL, showbiz, etc.) stay hardcoded.

To add a market: find it on polymarket.com → take the slug from the URL → `GET /markets?slug=<slug>` for its id → add to `LIVE_MARKETS` → tag the matching landing row.

## Testing

```bash
npm test
```

Unit tests cover the oracle (`lib/oracle/`): Gamma response parsing (both string formats), the volume floor, the lazy-refresh TTL decision, stale-preserve-on-failure, and the fetch-by-id path. Pure logic is tested directly; Supabase/fetch glue is exercised via the dev server.

## Deploy

Hosted on **Vercel** (`vercel.json`), auto-detected Next.js build. Set the environment variables above in the project settings. Custom domain `hulaan.ph` via Vercel → Settings → Domains.

> **Note:** Vercel Hobby caps cron at once-per-day, so scheduled jobs (price refresh, demo events) run lazily / on-demand instead of on a schedule. The `/api/cron/*` endpoints remain as manual or Pro-tier triggers.

## Design system

Light "paper" theme defined in `app/globals.css` `:root`:

- **Background:** `#f5f1e3` (cream) · surfaces on `#ffffff` paper with hairline `#0f2419` borders
- **Ink:** `#0f2419` → `#5a6a60` (primary → muted)
- **Accent:** `#e87a1e` (orange)
- **Type:** Fraunces for the wordmark/headlines, Space Mono for **all** numbers
- Subtle motion only; respects `prefers-reduced-motion`

## Brand

- Wordmark: "Hula" (Tagalog: *predict / guess*); domain `hulaan.ph` (*predict it*)
- Tagalog accent words used sparingly for the masa audience
- 21+ · responsible-play messaging is shipped on the product surfaces

---

© 2026 Hula. All rights reserved.
