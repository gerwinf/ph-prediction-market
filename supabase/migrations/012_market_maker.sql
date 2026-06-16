-- ============================================================================
-- Migration 012: market maker — fixed-odds house book on binary markets
-- ============================================================================
-- One market_book row per binary market (the house's current quote + exposure);
-- one positions row per user bet (locked odds at bet time). All money-moving
-- writes go through the place_bet / settle_market RPCs below (SECURITY DEFINER)
-- so balance debit + position insert + exposure bump happen in ONE transaction
-- under FOR UPDATE — the Supabase JS client cannot do multi-statement
-- transactions itself (see the note in app/api/cards/route.ts). Reuses the GGR
-- hold paradigm from migration 007 (hold_amount, operator_id).
--
-- `margin` = expected house hold fraction: offered odds = fair * (1 - margin),
-- so a balanced book keeps exactly `margin` of stake in expectation.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
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
-- Public may read market_book (quotes are non-sensitive); positions are read via
-- the server only (admin client bypasses RLS), so no anon positions policy.
drop policy if exists "market_book public read" on public.market_book;
create policy "market_book public read" on public.market_book for select using (true);

-- ── place_bet: atomic debit + position insert + exposure bump ────────────────
-- Reads the already-anchored p under FOR UPDATE. The quote endpoint does the
-- lazy Polymarket anchor BEFORE this is called — this function never fetches
-- Polymarket (no network IO under the row lock). Raises typed exceptions the
-- route maps to 4xx.
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
  v_used   int;
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

  v_used := case when p_side = 'yes' then v_book.exposure_yes else v_book.exposure_no end;
  if v_used + v_added > v_book.cap then
    raise exception 'cap_breach:%', v_book.cap - v_used;
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
