-- ===========================================================================
-- 00_prelude.sql — extensions, enums, and locking the anon role out entirely.
-- ===========================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- The publishable key is baked into a public GitHub Pages bundle, so treat the
-- `anon` role as hostile: it gets nothing in `public` by default. Every real
-- capability is granted to `authenticated` and gated further by RLS.
revoke all on schema public from anon;
grant usage on schema public to authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role      as enum ('member', 'organizer');
create type public.trip_status      as enum ('planning', 'upcoming', 'active', 'archived');
create type public.rsvp_status      as enum ('yes', 'no', 'maybe', 'pending');
create type public.meal_type        as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.event_kind       as enum ('activity', 'travel', 'birthday', 'reminder', 'chore', 'other');
create type public.expense_category as enum ('house', 'golf_cart', 'groceries', 'dining', 'activities', 'travel', 'supplies', 'fuel', 'other');
create type public.split_method     as enum ('equal', 'custom', 'household');
create type public.photo_kind       as enum ('trip', 'house', 'journal');

-- ---------------------------------------------------------------------------
-- Keep-alive. Free Supabase projects pause after 7 days of no activity, and
-- this app is idle ~51 weeks a year. A weekly GitHub Action calls ping() to
-- reset that timer. It writes a single row, so it counts as real activity —
-- a read against an empty table might not.
-- ---------------------------------------------------------------------------
create table public.heartbeat (
  id        boolean primary key default true check (id),
  last_ping timestamptz not null default now()
);
insert into public.heartbeat (id) values (true) on conflict do nothing;

alter table public.heartbeat enable row level security;
-- No policies: nobody reads this through the API. ping() is the only door,
-- and it is SECURITY DEFINER so it bypasses the (empty) policy set.

create or replace function public.ping()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.heartbeat set last_ping = now() where id returning last_ping;
$$;

-- Callable without a session, because the cron job has no user to sign in as.
-- Worst case abuse is bumping one timestamp.
grant execute on function public.ping() to anon, authenticated;
