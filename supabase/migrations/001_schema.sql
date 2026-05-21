-- Phase 0 schema. Tables for: identity, fixtures, cards, events,
-- viral attribution, analytics. Writes go through server routes using
-- the service-role admin client; RLS is read-only defense-in-depth
-- (see 002_rls.sql).

-- ============================================================================
-- profiles: extends auth.users with app-level fields
-- ============================================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  phone_e164      text,
  phone_verified  boolean not null default false,
  display_name    text not null,
  locale          text not null default 'fil',
  virtual_balance int not null default 10000,
  created_at      timestamptz not null default now()
);

create index profiles_phone_idx on public.profiles(phone_e164) where phone_e164 is not null;

-- ============================================================================
-- match_fixtures: 64 WC matches + post-WC daily slots
-- ============================================================================
-- id format examples:
--   'wc-grp-a-1'        WC group stage match 1 of group A
--   'wc-r16-1'          WC round-of-16 match 1
--   'daily-2026-07-20'  daily card for 2026-07-20
create table public.match_fixtures (
  id            text primary key,
  card_type     text not null check (card_type in ('sports', 'daily')),
  match_label   text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  status        text not null default 'scheduled'
                check (status in ('scheduled', 'live', 'final', 'canceled')),
  created_at    timestamptz not null default now()
);

create index match_fixtures_starts_at_idx on public.match_fixtures(starts_at);
create index match_fixtures_status_idx on public.match_fixtures(status);

-- ============================================================================
-- cards: every card ever issued, anon or claimed
-- ============================================================================
-- Anonymous cards have user_id = NULL and a device_id cookie value.
-- On email signup, server route migrates matching device_id rows to
-- the new user_id.
create table public.cards (
  id            text primary key,
  user_id       uuid references public.profiles(id) on delete set null,
  device_id     text,
  match_id      text not null references public.match_fixtures(id),
  card_type     text not null check (card_type in ('sports', 'daily')),
  board_seed    bigint not null,
  cells         jsonb not null,
  score         int not null default 0,
  won           boolean not null default false,
  win_pattern   text,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index cards_user_id_idx on public.cards(user_id) where user_id is not null;
create index cards_device_id_idx on public.cards(device_id) where device_id is not null;
create index cards_match_id_idx on public.cards(match_id);
create index cards_created_at_idx on public.cards(created_at desc);

-- ============================================================================
-- events: per-match event log written by ops dashboard during live games
-- ============================================================================
create table public.events (
  id           bigserial primary key,
  match_id     text not null references public.match_fixtures(id),
  event_key    text not null,
  payload      jsonb,
  resolved_at  timestamptz not null default now()
);

create index events_match_id_idx on public.events(match_id, resolved_at);

-- ============================================================================
-- shares: viral attribution (K-factor)
-- ============================================================================
create table public.shares (
  id                   bigserial primary key,
  source_card_id       text not null references public.cards(id),
  sharer_user_id       uuid references public.profiles(id),
  channel              text,
  created_at           timestamptz not null default now(),
  opened_at            timestamptz,
  attributed_card_id   text references public.cards(id)
);

create index shares_source_card_idx on public.shares(source_card_id);
create index shares_attributed_idx on public.shares(attributed_card_id)
  where attributed_card_id is not null;

-- ============================================================================
-- analytics_events: append-only event log for D1/D7 retention, share rate
-- ============================================================================
create table public.analytics_events (
  id          bigserial primary key,
  event_type  text not null,
  user_id     uuid references public.profiles(id),
  device_id   text,
  card_id     text references public.cards(id) on delete set null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index analytics_events_type_idx on public.analytics_events(event_type);
create index analytics_events_user_id_idx on public.analytics_events(user_id)
  where user_id is not null;
create index analytics_events_device_id_idx on public.analytics_events(device_id)
  where device_id is not null;
create index analytics_events_created_at_idx on public.analytics_events(created_at desc);

-- ============================================================================
-- auto-create profile on auth.users insert
-- ============================================================================
-- When Supabase Auth creates a new user (via magic-link click), this
-- trigger creates a matching public.profiles row with display_name
-- defaulted to the email prefix. The route handler can update it later
-- if the user picks a different display name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
