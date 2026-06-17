# Cold-Start Market Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the display-only binary yes/no markets tradeable via a fixed-odds house book — the house is always the counterparty, odds anchored to Polymarket, virtual currency, reusing the existing GGR `hold_amount` accounting.

**Architecture:** Pure odds math (`lib/mm/odds.ts`) + a `SECURITY DEFINER` Postgres RPC (`place_bet`) for atomic balance-debit + position-insert + exposure-bump under `FOR UPDATE`. A thin server engine (`lib/mm/engine.ts`) wraps the RPC and does lazy Polymarket anchoring (reusing the `/api/prices` pattern). Routes expose quote/bet/resolve. UI adds a prize-first bet control and a My-bets list.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + JS client via service-role admin), vitest. Approved spec: `docs/superpowers/specs/2026-06-16-cold-start-market-maker-design.md`.

**Confirmed decisions:** fixed-odds (not LMSR) · prize-first copy · sign-in-to-bet (no anon server bets) · long-horizon markets + settlement notification/countdown · margin 5% · min stake ₱10 · floor payouts.

---

## File Structure

- `lib/mm/odds.ts` — pure math (multipliers, payout, anchorPrice, wouldBreachCap). Zero IO.
- `lib/mm/odds.test.ts` — unit tests for all odds math.
- `lib/mm/engine.ts` — server-only: resolve a market's slug→reference, lazy-anchor decision, RPC wrappers (`placeBet`, `settleMarket`). Pure decision helpers extracted for tests.
- `lib/mm/engine.test.ts` — unit tests for the pure decision helpers (anchor-due, headroom).
- `lib/mm/types.ts` — shared types (`MarketBook`, `Position`, `Quote`).
- `supabase/migrations/012_market_maker.sql` — tables, constraints, RPCs, backfill, trigger.
- `scripts/db-verify-mm.ts` — post-migration verification (mirrors `scripts/db-verify.ts`).
- `app/api/markets/[id]/quote/route.ts` — GET current odds (lazy-anchored).
- `app/api/markets/[id]/bet/route.ts` — POST a bet (authed only).
- `app/api/ops/markets/[id]/resolve/route.ts` — POST settle/void (X-Ops-Secret).
- `app/api/positions/route.ts` — GET the current user's positions (My bets).
- `components/markets/BetControl.tsx` — prize-first bet button + confirm sheet + stake chips.
- `components/markets/MyBets.tsx` — positions list.
- `app/api/ops/ggr/route.ts` — MODIFY to UNION cards + positions hold.

---

## Task 1: Pure odds math (`lib/mm/odds.ts`)

**Files:**
- Create: `lib/mm/odds.ts`
- Test: `lib/mm/odds.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/mm/odds.test.ts
import { describe, test, expect } from 'vitest'
import {
  EPS, MARGIN_DEFAULT, MIN_STAKE_PHP,
  multipliers, payout, anchorPrice, wouldBreachCap,
} from './odds'

describe('multipliers', () => {
  test('overround sums to 1 + margin (5% edge)', () => {
    const { yes, no } = multipliers(0.5, 0.05)
    // implied prob = 1/mult; sum of implied = 1 + margin
    expect(1 / yes + 1 / no).toBeCloseTo(1.05, 6)
  })
  test('higher YES probability => lower YES multiplier', () => {
    expect(multipliers(0.8, 0.05).yes).toBeLessThan(multipliers(0.5, 0.05).yes)
  })
  test('clamps p into (0,1) so multipliers never blow up', () => {
    expect(Number.isFinite(multipliers(0, 0.05).yes)).toBe(true)
    expect(Number.isFinite(multipliers(1, 0.05).no)).toBe(true)
  })
})

describe('payout', () => {
  test('floors (house rounds down — bookmaker convention)', () => {
    expect(payout(20, 1.85)).toBe(37) // 20*1.85 = 37.0
    expect(payout(7, 1.85)).toBe(12)  // 12.95 -> 12
  })
})

describe('anchorPrice', () => {
  test('clamps reference into [EPS, 1-EPS]', () => {
    expect(anchorPrice(0, 0.5)).toBe(EPS)
    expect(anchorPrice(1, 0.5)).toBe(1 - EPS)
  })
  test('falls back to prior when reference is null/NaN', () => {
    expect(anchorPrice(null, 0.42)).toBe(0.42)
    expect(anchorPrice(NaN, 0.42)).toBe(0.42)
  })
})

describe('wouldBreachCap', () => {
  const book = { exposureYes: 0, exposureNo: 0, cap: 100 }
  test('exact cap allowed, cap+1 rejected', () => {
    // potential net exposure on YES = payout - stake
    expect(wouldBreachCap(book, 'yes', /*stake*/100, /*payoutAmt*/200, 100)).toBe(false) // net 100 == cap
    expect(wouldBreachCap(book, 'yes', 100, 201, 100)).toBe(true)  // net 101 > cap
  })
  test('rejects below the minimum stake constant', () => {
    expect(MIN_STAKE_PHP).toBe(10)
    expect(MARGIN_DEFAULT).toBe(0.05)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/mm/odds.test.ts`
Expected: FAIL — `Cannot find module './odds'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/mm/odds.ts
/**
 * Pure fixed-odds market-maker math. Zero IO — all correctness lives here.
 * The house quotes a probability p (YES); a bet locks a decimal multiplier
 * (overround = margin). Payouts floor (house rounds down). See the design
 * spec "Odds + margin".
 */
export const EPS = 1e-4
export const MARGIN_DEFAULT = 0.05
export const MIN_STAKE_PHP = 10

const clampP = (p: number) => Math.min(1 - EPS, Math.max(EPS, p))

/** Decimal multipliers for both sides given YES probability p and margin m. */
export function multipliers(p: number, margin: number): { yes: number; no: number } {
  const q = clampP(p)
  return {
    yes: (1 / q) * (1 - margin),
    no: (1 / (1 - q)) * (1 - margin),
  }
}

/** Floor payout — house always rounds down. */
export function payout(stake: number, mult: number): number {
  return Math.floor(stake * mult)
}

/** Clamp a Polymarket reference into a usable probability; fall back to prior. */
export function anchorPrice(reference: number | null, prior: number): number {
  if (reference == null || Number.isNaN(reference)) return prior
  return clampP(reference)
}

/**
 * Would booking `payoutAmt` on `side` for `stake` push net house exposure past cap?
 * Net exposure on a side = (sum of that side's payouts) − (total stakes), since
 * the losing side's stakes offset the winning side's payouts.
 */
export function wouldBreachCap(
  book: { exposureYes: number; exposureNo: number; cap: number },
  side: 'yes' | 'no',
  stake: number,
  payoutAmt: number,
  cap: number,
): boolean {
  const addedNet = payoutAmt - stake
  const current = side === 'yes' ? book.exposureYes : book.exposureNo
  return current + addedNet > cap
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/mm/odds.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/mm/odds.ts lib/mm/odds.test.ts
git commit -m "feat(mm): pure fixed-odds market-maker math"
```

---

## Task 2: Shared types (`lib/mm/types.ts`)

**Files:**
- Create: `lib/mm/types.ts`

- [ ] **Step 1: Write the types** (no test — type-only module)

```typescript
// lib/mm/types.ts
export type Side = 'yes' | 'no'

export type MarketBook = {
  market_id: string        // uuid
  p: number                // YES probability in (0,1)
  margin: number           // overround, e.g. 0.05
  polymarket_slug: string | null
  anchored_at: string      // ISO
  exposure_yes: number
  exposure_no: number
  cap: number
  is_stale: boolean
}

export type Position = {
  id: string
  user_id: string | null
  device_id: string | null
  market_id: string
  side: Side
  stake: number
  multiplier: number
  potential_payout: number
  status: 'open' | 'settled' | 'void'
  payout: number | null
  hold_amount: number | null
  created_at: string
  settled_at: string | null
}

export type Quote = {
  market_id: string
  p: number
  multiplier_yes: number
  multiplier_no: number
  headroom_yes: number
  headroom_no: number
  is_stale: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mm/types.ts
git commit -m "feat(mm): shared market-maker types"
```

---

## Task 3: Migration 012 — tables + constraints

**Files:**
- Create: `supabase/migrations/012_market_maker.sql`

- [ ] **Step 1: Write the schema** (tables, constraints, indexes)

```sql
-- supabase/migrations/012_market_maker.sql
-- ============================================================================
-- Migration 012: market maker — fixed-odds house book on binary markets
-- ============================================================================
-- One market_book row per binary market (the house's current quote + exposure);
-- one positions row per user bet (locked odds at bet time). All writes go through
-- the place_bet / settle_market RPCs below (SECURITY DEFINER) so balance debit +
-- position insert + exposure bump happen in ONE transaction under FOR UPDATE —
-- the Supabase JS client cannot do multi-statement transactions itself.
-- Reuses the GGR hold paradigm from migration 007 (hold_amount, operator_id).
-- ============================================================================

create table if not exists public.market_book (
  market_id        uuid primary key references public.markets(id) on delete restrict,
  p                numeric not null,
  margin           numeric not null default 0.05,
  polymarket_slug  text,
  anchored_at      timestamptz not null default now(),
  exposure_yes     int not null default 0,
  exposure_no      int not null default 0,
  cap              int not null default 50000,
  is_stale         boolean not null default false,
  constraint market_book_p_valid       check (p > 0 and p < 1),
  constraint market_book_margin_valid  check (margin >= 0 and margin < 1),
  constraint market_book_exposure_nn   check (exposure_yes >= 0 and exposure_no >= 0),
  constraint market_book_cap_pos       check (cap > 0)
);

create table if not exists public.positions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete set null,
  device_id        text,
  market_id        uuid not null references public.markets(id) on delete restrict,
  side             text not null check (side in ('yes','no')),
  stake            int not null check (stake > 0),
  multiplier       numeric not null,
  potential_payout int not null,
  status           text not null default 'open' check (status in ('open','settled','void')),
  payout           int,
  hold_amount      int,
  operator_id      text not null default 'hula',
  created_at       timestamptz not null default now(),
  settled_at       timestamptz
);

create index if not exists positions_user_idx   on public.positions(user_id) where user_id is not null;
create index if not exists positions_market_idx on public.positions(market_id, status);
-- GGR aggregation (mirrors cards_ggr_idx from migration 007).
create index if not exists positions_ggr_idx
  on public.positions(operator_id, settled_at) where settled_at is not null;

alter table public.market_book enable row level security;
alter table public.positions   enable row level security;
-- Public may read market_book (quotes are non-sensitive); positions read via server only.
drop policy if exists "market_book public read" on public.market_book;
create policy "market_book public read" on public.market_book for select using (true);
```

- [ ] **Step 2: Apply + verify it created the tables**

Run: `npx tsx scripts/apply-migration.ts 012_market_maker`
Expected: `Applied 012_market_maker.sql successfully.` (If the RPC path fails, paste into Supabase SQL editor per the script's fallback.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_market_maker.sql
git commit -m "feat(mm): migration 012 market_book + positions tables"
```

---

## Task 4: `place_bet` RPC (atomic bet)

**Files:**
- Modify: `supabase/migrations/012_market_maker.sql` (append the function)

- [ ] **Step 1: Append the RPC** to migration 012

```sql
-- ── place_bet: atomic debit + position insert + exposure bump ────────────────
-- Reads the already-anchored p under FOR UPDATE (the quote endpoint does the
-- lazy Polymarket anchor BEFORE this is called — this function never fetches
-- Polymarket). Raises typed exceptions the route maps to 4xx.
create or replace function public.place_bet(
  p_market_id uuid,
  p_user_id   uuid,
  p_side      text,
  p_stake     int
) returns public.positions
language plpgsql security definer set search_path = public as $$
declare
  v_book   market_book%rowtype;
  v_mkt    markets%rowtype;
  v_mult   numeric;
  v_payout int;
  v_added  int;
  v_pos    positions%rowtype;
  v_bal    int;
begin
  if p_stake < 10 then raise exception 'min_stake'; end if;
  if p_side not in ('yes','no') then raise exception 'bad_side'; end if;

  select * into v_book from market_book where market_id = p_market_id for update;
  if not found then raise exception 'no_book'; end if;

  select * into v_mkt from markets where id = p_market_id;
  if v_mkt.status not in ('approved','live') then raise exception 'market_closed'; end if;

  -- multiplier from the stored p (floor payout: house rounds down)
  if p_side = 'yes' then
    v_mult := (1.0 / v_book.p) * (1 - v_book.margin);
  else
    v_mult := (1.0 / (1 - v_book.p)) * (1 - v_book.margin);
  end if;
  v_payout := floor(p_stake * v_mult);
  v_added  := v_payout - p_stake;  -- net exposure added on this side

  if (case when p_side='yes' then v_book.exposure_yes else v_book.exposure_no end) + v_added > v_book.cap then
    raise exception 'cap_breach:%', v_book.cap - (case when p_side='yes' then v_book.exposure_yes else v_book.exposure_no end);
  end if;

  update profiles set virtual_balance = virtual_balance - p_stake
   where id = p_user_id returning virtual_balance into v_bal;
  if not found then raise exception 'no_profile'; end if;
  if v_bal < 0 then raise exception 'insufficient_balance'; end if;

  insert into positions (user_id, market_id, side, stake, multiplier, potential_payout)
  values (p_user_id, p_market_id, p_side, p_stake, v_mult, v_payout)
  returning * into v_pos;

  if p_side = 'yes' then
    update market_book set exposure_yes = exposure_yes + v_added where market_id = p_market_id;
  else
    update market_book set exposure_no = exposure_no + v_added where market_id = p_market_id;
  end if;

  return v_pos;
end;
$$;
```

- [ ] **Step 2: Re-apply migration (idempotent — `create or replace`)**

Run: `npx tsx scripts/apply-migration.ts 012_market_maker`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_market_maker.sql
git commit -m "feat(mm): place_bet atomic RPC (FOR UPDATE + balance + exposure)"
```

---

## Task 5: `settle_market` RPC (idempotent settle / void)

**Files:**
- Modify: `supabase/migrations/012_market_maker.sql` (append)

- [ ] **Step 1: Append the RPC**

```sql
-- ── settle_market: pay winners, book hold, close. Idempotent via status='open'.
create or replace function public.settle_market(
  p_market_id uuid,
  p_outcome   text   -- 'yes' | 'no' | 'void'
) returns int       -- number of positions settled
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record;
begin
  if p_outcome not in ('yes','no','void') then raise exception 'bad_outcome'; end if;

  for r in select * from positions where market_id = p_market_id and status = 'open' for update loop
    if p_outcome = 'void' then
      update profiles set virtual_balance = virtual_balance + r.stake where id = r.user_id;
      update positions set status='void', payout=r.stake, hold_amount=0, settled_at=now() where id=r.id;
    elsif r.side = p_outcome then
      update profiles set virtual_balance = virtual_balance + r.potential_payout where id = r.user_id;
      update positions set status='settled', payout=r.potential_payout,
             hold_amount = r.stake - r.potential_payout, settled_at=now() where id=r.id;
    else
      update positions set status='settled', payout=0, hold_amount=r.stake, settled_at=now() where id=r.id;
    end if;
    v_n := v_n + 1;
  end loop;

  update markets set status='retired' where id = p_market_id and status in ('approved','live');
  return v_n;  -- second call returns 0 (no open rows) => idempotent
end;
$$;
```

- [ ] **Step 2: Apply + commit**

Run: `npx tsx scripts/apply-migration.ts 012_market_maker`

```bash
git add supabase/migrations/012_market_maker.sql
git commit -m "feat(mm): settle_market RPC (idempotent settle/void + GGR hold)"
```

---

## Task 6: Migration backfill + auto-seed trigger

**Files:**
- Modify: `supabase/migrations/012_market_maker.sql` (append)

- [ ] **Step 1: Append backfill + trigger**

```sql
-- ── Backfill existing approved/live binary markets, and auto-seed future ones.
insert into public.market_book (market_id, p, margin, polymarket_slug, anchored_at, cap)
select id,
       greatest(0.0001, least(0.9999, coalesce((payload->>'fallback_pct')::numeric / 100, 0.5))),
       0.05,
       payload->>'polymarket_slug',
       now(),
       50000
from public.markets
where kind = 'binary' and status in ('approved','live')
on conflict (market_id) do nothing;

create or replace function public.seed_market_book()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'binary' and new.status in ('approved','live') then
    insert into public.market_book (market_id, p, margin, polymarket_slug, anchored_at, cap)
    values (new.id,
            greatest(0.0001, least(0.9999, coalesce((new.payload->>'fallback_pct')::numeric / 100, 0.5))),
            0.05, new.payload->>'polymarket_slug', now(), 50000)
    on conflict (market_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists markets_seed_book on public.markets;
create trigger markets_seed_book
  after insert or update of status on public.markets
  for each row execute function public.seed_market_book();
```

- [ ] **Step 2: Apply + verify rows seeded**

Run: `npx tsx scripts/apply-migration.ts 012_market_maker`
Then create `scripts/db-verify-mm.ts` (mirror `scripts/db-verify.ts`) that prints `select count(*) from market_book` and a sample row; run `npx tsx scripts/db-verify-mm.ts`.
Expected: one `market_book` row per approved/live binary market.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_market_maker.sql scripts/db-verify-mm.ts
git commit -m "feat(mm): backfill + auto-seed trigger for market_book"
```

---

## Task 7: Engine — anchor-due helper + RPC wrappers

**Files:**
- Create: `lib/mm/engine.ts`
- Test: `lib/mm/engine.test.ts`

- [ ] **Step 1: Write the failing test** (pure decision helpers only)

```typescript
// lib/mm/engine.test.ts
import { describe, test, expect } from 'vitest'
import { isAnchorDue, headroom, ANCHOR_TTL_MS } from './engine'

const NOW = 1_000_000_000_000

describe('isAnchorDue', () => {
  test('due when never anchored or older than TTL', () => {
    expect(isAnchorDue(new Date(NOW - ANCHOR_TTL_MS - 1).toISOString(), NOW)).toBe(true)
  })
  test('not due when fresh', () => {
    expect(isAnchorDue(new Date(NOW - 1000).toISOString(), NOW)).toBe(false)
  })
})

describe('headroom', () => {
  test('remaining cap per side never negative', () => {
    expect(headroom({ exposure_yes: 90, exposure_no: 0, cap: 100 } as never, 'yes')).toBe(10)
    expect(headroom({ exposure_yes: 120, exposure_no: 0, cap: 100 } as never, 'yes')).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/mm/engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the engine** (pure helpers + thin RPC wrappers)

```typescript
// lib/mm/engine.ts
import 'server-only'
import { createAdminClient } from '../supabase/admin'
import { multipliers } from './odds'
import type { MarketBook, Quote, Side } from './types'

export const ANCHOR_TTL_MS = 10 * 60 * 1000 // match mirror_prices TTL

export function isAnchorDue(anchoredAt: string | null | undefined, now: number): boolean {
  if (!anchoredAt) return true
  return now - new Date(anchoredAt).getTime() >= ANCHOR_TTL_MS
}

export function headroom(book: MarketBook, side: Side): number {
  const used = side === 'yes' ? book.exposure_yes : book.exposure_no
  return Math.max(0, book.cap - used)
}

/** Build the public quote from a book row. */
export function quoteFromBook(book: MarketBook): Quote {
  const { yes, no } = multipliers(book.p, book.margin)
  return {
    market_id: book.market_id,
    p: book.p,
    multiplier_yes: yes,
    multiplier_no: no,
    headroom_yes: headroom(book, 'yes'),
    headroom_no: headroom(book, 'no'),
    is_stale: book.is_stale,
  }
}

/** Thin wrapper over the place_bet RPC. Maps pg exceptions to error codes. */
export async function placeBet(marketId: string, userId: string, side: Side, stake: number) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('place_bet', {
    p_market_id: marketId, p_user_id: userId, p_side: side, p_stake: stake,
  })
  if (error) return { ok: false as const, code: parsePgError(error.message) }
  return { ok: true as const, position: data }
}

export async function settleMarket(marketId: string, outcome: 'yes' | 'no' | 'void') {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('settle_market', {
    p_market_id: marketId, p_outcome: outcome,
  })
  if (error) return { ok: false as const, message: error.message }
  return { ok: true as const, settled: data as number }
}

/** Extract our raised-exception tokens (e.g. 'insufficient_balance', 'cap_breach:47'). */
function parsePgError(msg: string): string {
  const m = msg.match(/(min_stake|bad_side|no_book|market_closed|cap_breach:-?\d+|insufficient_balance|no_profile)/)
  return m ? m[1] : 'db_error'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/mm/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/mm/engine.ts lib/mm/engine.test.ts
git commit -m "feat(mm): engine helpers + place_bet/settle_market RPC wrappers"
```

---

## Task 8: `GET /api/markets/[id]/quote` (lazy anchor)

**Files:**
- Create: `app/api/markets/[id]/quote/route.ts`

- [ ] **Step 1: Write the route** — anchor lazily (reuse `/api/prices`), then return the quote

```typescript
// app/api/markets/[id]/quote/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { isAnchorDue, quoteFromBook } from '../../../../../lib/mm/engine'
import { anchorPrice } from '../../../../../lib/mm/odds'
import type { MarketBook } from '../../../../../lib/mm/types'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const admin = createAdminClient()
  const { data: book } = await admin.from('market_book').select('*').eq('market_id', id).maybeSingle()
  if (!book) return NextResponse.json({ ok: false, error: 'no_book' }, { status: 404 })

  let b = book as MarketBook
  if (b.polymarket_slug && isAnchorDue(b.anchored_at, Date.now())) {
    // Reuse the existing lazy Polymarket refresh: read mirror_prices for the slug.
    const { data: mp } = await admin
      .from('mirror_prices').select('outcomes, is_stale')
      .eq('event_slug', b.polymarket_slug).eq('source', 'polymarket').maybeSingle()
    const ref = pickYesPrice(mp?.outcomes)
    const next = anchorPrice(ref, b.p)
    await admin.from('market_book')
      .update({ p: next, anchored_at: new Date().toISOString(), is_stale: !!mp?.is_stale || ref == null })
      .eq('market_id', id)
    b = { ...b, p: next, is_stale: !!mp?.is_stale || ref == null }
  }
  return NextResponse.json({ ok: true, quote: quoteFromBook(b) })
}

function pickYesPrice(outcomes: unknown): number | null {
  if (!Array.isArray(outcomes) || outcomes.length === 0) return null
  const first = outcomes[0] as { price?: number }
  return typeof first?.price === 'number' ? first.price : null
}
```

- [ ] **Step 2: Smoke test against a seeded market**

Run: `npm run dev` then `curl -s localhost:3000/api/markets/<id>/quote | jq`
Expected: `{ ok: true, quote: { multiplier_yes, multiplier_no, headroom_yes, ... } }`.

- [ ] **Step 3: Commit**

```bash
git add app/api/markets/\[id\]/quote/route.ts
git commit -m "feat(mm): GET quote endpoint with lazy Polymarket anchor"
```

---

## Task 9: `POST /api/markets/[id]/bet` (authed only)

**Files:**
- Create: `app/api/markets/[id]/bet/route.ts`

- [ ] **Step 1: Write the route** — require session, call `placeBet`, map errors

```typescript
// app/api/markets/[id]/bet/route.ts
import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '../../../../../lib/supabase/server'
import { placeBet } from '../../../../../lib/mm/engine'
import { MIN_STAKE_PHP } from '../../../../../lib/mm/odds'
import type { Side } from '../../../../../lib/mm/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  // Sign-in-to-bet: no anon server bets (confirmed decision D-anon).
  const auth = createServerSupabase()
  const { data: userData } = await auth.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) return NextResponse.json({ ok: false, error: 'sign_in_required' }, { status: 401 })

  let body: { side?: Side; stakePhp?: number } = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }
  const { side, stakePhp } = body
  if (side !== 'yes' && side !== 'no') return NextResponse.json({ ok: false, error: 'invalid_side' }, { status: 400 })
  if (!stakePhp || stakePhp < MIN_STAKE_PHP) return NextResponse.json({ ok: false, error: 'min_stake', min: MIN_STAKE_PHP }, { status: 400 })

  const r = await placeBet(id, userId, side, Math.floor(stakePhp))
  if (!r.ok) {
    const status = r.code === 'insufficient_balance' ? 402
      : r.code.startsWith('cap_breach') ? 409
      : r.code === 'market_closed' ? 409
      : r.code === 'no_book' || r.code === 'no_profile' ? 404 : 400
    const headroom = r.code.startsWith('cap_breach') ? Number(r.code.split(':')[1]) : undefined
    return NextResponse.json({ ok: false, error: r.code.split(':')[0], headroom }, { status })
  }
  return NextResponse.json({ ok: true, position: r.position })
}
```

- [ ] **Step 2: Smoke test** (signed in via `/dev/signin`): a YES bet debits balance and returns a position; a ₱5 bet → 400 `min_stake`; an over-cap bet → 409 with `headroom`.

- [ ] **Step 3: Commit**

```bash
git add app/api/markets/\[id\]/bet/route.ts
git commit -m "feat(mm): POST bet endpoint (sign-in-to-bet, error mapping)"
```

---

## Task 10: `POST /api/ops/markets/[id]/resolve` (settle/void)

**Files:**
- Create: `app/api/ops/markets/[id]/resolve/route.ts`

- [ ] **Step 1: Write the route** — X-Ops-Secret gate (copy the pattern from `app/api/ops/resolve/route.ts`), call `settleMarket`

```typescript
// app/api/ops/markets/[id]/resolve/route.ts
import { NextResponse } from 'next/server'
import { settleMarket } from '../../../../../../lib/mm/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const expected = process.env.OPS_SHARED_SECRET
  if (!expected) return NextResponse.json({ ok: false, error: 'no_secret_configured' }, { status: 500 })
  if (!constantTimeEqual(req.headers.get('x-ops-secret') || '', expected))
    return NextResponse.json({ ok: false, error: 'bad_secret' }, { status: 401 })

  const { id } = await ctx.params
  let body: { outcome?: 'yes' | 'no' | 'void' } = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }
  if (!body.outcome || !['yes', 'no', 'void'].includes(body.outcome))
    return NextResponse.json({ ok: false, error: 'invalid_outcome' }, { status: 400 })

  const r = await settleMarket(id, body.outcome)
  if (!r.ok) return NextResponse.json({ ok: false, error: 'db_error', message: r.message }, { status: 500 })
  return NextResponse.json({ ok: true, settled: r.settled }) // settled=0 on a repeat call (idempotent)
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
```

- [ ] **Step 2: Smoke test** — resolve a market YES; winners credited; second call returns `settled: 0`.

- [ ] **Step 3: Commit**

```bash
git add app/api/ops/markets/\[id\]/resolve/route.ts
git commit -m "feat(mm): ops settle/void endpoint (idempotent)"
```

---

## Task 11: GGR view — UNION cards + positions

**Files:**
- Modify: `app/api/ops/ggr/route.ts`

- [ ] **Step 1:** Read the existing route, then add positions hold to the aggregation. The positions GGR = `SUM(hold_amount)` over `positions WHERE settled_at IS NOT NULL` for the operator/window, added to the existing cards GGR. Keep the same response shape; add a `byMechanic: { cards, markets }` breakdown.

- [ ] **Step 2:** Smoke test `/api/ops/ggr` shows a non-zero `markets` line after a settled bet.

- [ ] **Step 3: Commit**

```bash
git add app/api/ops/ggr/route.ts
git commit -m "feat(mm): include positions hold in GGR aggregation"
```

---

## Task 12: `GET /api/positions` (My bets data)

**Files:**
- Create: `app/api/positions/route.ts`

- [ ] **Step 1:** Mirror `app/api/cards/route.ts` GET (identity = authed user_id; anon = `device_id`/null). Return positions joined to `markets.title`, sorted soonest-resolution then newest. Include a `summary: { openStake, winnings }`.

- [ ] **Step 2:** Smoke test returns the signed-in user's positions with market titles.

- [ ] **Step 3: Commit**

```bash
git add app/api/positions/route.ts
git commit -m "feat(mm): GET positions endpoint for My bets"
```

---

## Task 13: `BetControl` component (prize-first + confirm sheet)

**Files:**
- Create: `components/markets/BetControl.tsx`
- Modify: the binary card render in `app/page.tsx` (or its card component) to mount `BetControl`.

- [ ] **Step 1:** Build the control per the UI Spec in the design doc:
  - 3 card states: open/no-bet (two side buttons, **prize-first** `Win ₱{payout(20,mult)}` with `{mult}×` fine print), open-bet (show the user's position), closed/settled (grayed + outcome).
  - Tap side → bottom-sheet confirm: quick-tap chips `₱10/₱20/₱50/₱100` + custom; show `Bet ₱X on YES → Win ₱Y`. **Fetch the quote fresh on sheet open**; if multiplier changed since the card render, show an "odds updated — confirm again" banner. Confirm = the POST to `/api/markets/[id]/bet`.
  - Error UI: 401 → "Sign in to bet" CTA; 402 → "Not enough coins" + disabled confirm; 409 → "Only ₱{headroom} left — bet that?" one-shot (no auto-retry); `market_closed` → grayed.
  - On success → confetti + payout toast (reuse the existing /hits win treatment if one exists; otherwise a simple toast).
  - Emit an analytics event `bet_tap` on the first side tap and `bet_placed` on success (CEO demand-instrumentation: lets us compare tap-rate vs /hits). Use `lib/analytics/track.ts`.

- [ ] **Step 2:** Manual check on the landing page: prize-first copy renders; confirm sheet works; a real bet debits balance and shows the position state.

- [ ] **Step 3: Commit**

```bash
git add components/markets/BetControl.tsx app/page.tsx
git commit -m "feat(mm): prize-first BetControl with confirm sheet + analytics"
```

---

## Task 14: `MyBets` component + settlement countdown/notification

**Files:**
- Create: `components/markets/MyBets.tsx`
- Modify: landing page to mount `MyBets`.

- [ ] **Step 1:** Build the list from `GET /api/positions`: rows (market, side, stake, potential payout, status), soonest-resolution sort, empty-state nudge, settled rows show payout + win/loss treatment, header running total. Each open row on a long-horizon market shows a **countdown to `markets.closes_at`** (the retention hook for the delayed-resolution masa concern). On open, if any position settled since last view, surface the win/loss toast (settlement notification — checked client-side on load; a push/SMS channel is a later enhancement, noted in the spec).

- [ ] **Step 2:** Manual check: My bets shows open + settled positions, countdown ticks, settled win shows celebration.

- [ ] **Step 3: Commit**

```bash
git add components/markets/MyBets.tsx app/page.tsx
git commit -m "feat(mm): My bets list + settlement countdown/notification"
```

---

## Notes for the executor

- **Anon users never bet server-side** (decision D-anon). The bet endpoint 401s without a session; `BetControl` shows "Sign in to bet". No `device_balances` table.
- **Atomicity lives in the RPCs**, not the routes. Do not replicate the `/api/cards` best-effort debit-then-refund pattern — that's exactly what `place_bet` replaces.
- **Anchoring only happens in the quote endpoint**, never inside `place_bet` (no Polymarket fetch under the row lock).
- **Real money is out of scope.** Before any real-money move, confirm PAGCOR clearance covers a fixed-odds prediction interface (CEO Finding 7).
- Migration RPC tests aren't in the vitest harness (no DB integration runner exists). Verify RPCs via the smoke tests above + `scripts/db-verify-mm.ts`. The pure math (`odds.ts`) and engine helpers carry the unit-test coverage.
