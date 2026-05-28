-- ============================================================================
-- Migration 005: profiles.migrated_from_anon
-- ============================================================================
-- One-shot flag for the anonymous-to-authed balance migration. When a user
-- signs in for the first time on a device that has localStorage token
-- balance > 10000 (the default), we merge that anonymous balance into
-- their fresh profile row. The flag prevents repeat merges (e.g. user
-- signs in, plays a few rounds, signs out, then signs in again with a
-- different localStorage state — only the first sign-in migrates).
--
-- Idempotent rule: act only if migrated_from_anon = false AND
-- virtual_balance is still the default 10000. After: flag = true, balance
-- = max(10000, localBalance). See app/api/profile/balance/migrate/route.ts.
-- ============================================================================

alter table public.profiles
  add column if not exists migrated_from_anon boolean not null default false;
