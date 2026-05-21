-- Phase 0 RLS. All writes go through server routes using the
-- service-role admin client (which bypasses RLS). RLS here is
-- read-side defense-in-depth: client-side direct queries from anon
-- or authenticated roles only see what they're meant to.

-- ============================================================================
-- profiles
-- ============================================================================
alter table public.profiles enable row level security;

-- User can read their own full profile (incl. phone, balance, email).
create policy "profiles: self read"
  on public.profiles for select
  using (auth.uid() = id);

-- User can update their own profile (display_name, phone, locale).
-- Note: virtual_balance, email, id, created_at are not in the column
-- ALLOW list here because RLS doesn't restrict columns — the route
-- handler must strip those fields before .update() is called.
create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Public leaderboard exposes only display_name + virtual_balance.
-- Implemented via a security-invoker view + explicit grants below.

create or replace view public.leaderboard
with (security_invoker = on) as
select id, display_name, virtual_balance
from public.profiles;

-- The view inherits the table's RLS, so anon can't read all rows by
-- default. We need a separate policy that allows public read of the
-- TWO columns the view exposes — but RLS is row-level, not column.
-- Workaround: a security-definer function that returns the leaderboard
-- top-N, called from the route handler. Until then, /api/leaderboard
-- uses the admin client and selects the columns explicitly.

-- ============================================================================
-- match_fixtures
-- ============================================================================
alter table public.match_fixtures enable row level security;

-- Public read: anyone can see the schedule. Writes are admin-only.
create policy "match_fixtures: public read"
  on public.match_fixtures for select
  using (true);

-- ============================================================================
-- cards
-- ============================================================================
alter table public.cards enable row level security;

-- Authenticated user can read their own cards.
create policy "cards: self read"
  on public.cards for select
  to authenticated
  using (auth.uid() = user_id);

-- Public read of card display fields (for share-link landing pages
-- showing the original card to a friend). The route handler chooses
-- which columns to expose — this policy just allows the row through.
create policy "cards: public read for share view"
  on public.cards for select
  to anon
  using (true);

-- All writes (insert / update / delete) require service-role.
-- No policies for anon or authenticated insert/update → all denied.

-- ============================================================================
-- events
-- ============================================================================
alter table public.events enable row level security;

-- Public read: live event ticker needs this. Realtime subscriptions
-- on this table also work because of this policy.
create policy "events: public read"
  on public.events for select
  using (true);

-- Writes are admin-only (ops dashboard via server route).

-- ============================================================================
-- shares
-- ============================================================================
alter table public.shares enable row level security;

-- User can read their own shares (for "your viral score" feature).
create policy "shares: self read"
  on public.shares for select
  to authenticated
  using (auth.uid() = sharer_user_id);

-- Writes are admin-only (share-click attribution endpoint).

-- ============================================================================
-- analytics_events
-- ============================================================================
alter table public.analytics_events enable row level security;

-- No SELECT policies → only service-role can read. Phase 0 validation
-- queries run from the admin script or future /ops dashboard.

-- Writes are admin-only.
