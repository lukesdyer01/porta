-- ===========================================================================
-- 00_prelude.sql — extensions, enums, and locking the anon role down.
--
-- Every migration here is written to be safely re-runnable: paste the whole
-- bundle again and it should succeed, not error on "already exists".
-- ===========================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- The publishable key is baked into a public GitHub Pages bundle, so treat
-- `anon` as hostile. It keeps USAGE on the schema — PostgREST needs that to
-- resolve ping() below — but gets no tables and no functions beyond the ones
-- granted by name.
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Functions are EXECUTE-able by PUBLIC by default, which would quietly include
-- anon. Default-deny instead; every callable function is granted explicitly.
alter default privileges in schema public revoke all on functions from public, anon;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.member_role as enum ('member', 'organizer');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.trip_status as enum ('planning', 'upcoming', 'active', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.rsvp_status as enum ('yes', 'no', 'maybe', 'pending');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.event_kind as enum ('activity', 'travel', 'birthday', 'reminder', 'chore', 'other');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.expense_category as enum ('house', 'golf_cart', 'groceries', 'dining', 'activities', 'travel', 'supplies', 'fuel', 'other');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.split_method as enum ('equal', 'custom', 'household');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.photo_kind as enum ('trip', 'house', 'journal');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Keep-alive. Free Supabase projects pause after 7 days of no activity, and
-- this app is idle ~51 weeks a year. A weekly GitHub Action calls ping() to
-- reset that timer. It writes a row, so it counts as genuine activity.
-- ---------------------------------------------------------------------------
create table if not exists public.heartbeat (
  id        boolean primary key default true check (id),
  last_ping timestamptz not null default now()
);

insert into public.heartbeat (id) values (true) on conflict (id) do nothing;

alter table public.heartbeat enable row level security;
-- Deliberately no policies: nobody reaches this through the REST API. ping()
-- is the only door, and it is SECURITY DEFINER so policies don't apply to it.

create or replace function public.ping()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.heartbeat set last_ping = now() where id returning last_ping;
$$;

-- Callable without a session: the cron job has no user to sign in as. The
-- worst it can do is bump one timestamp.
grant execute on function public.ping() to anon, authenticated;
