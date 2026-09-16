-- ===========================================================================
-- 01_identity.sql — households, the invite allowlist, and profiles.
--
-- Ordering matters: households <- profiles <- allowed_emails, so every foreign
-- key can be declared inline.
--
-- WHY THERE IS NO TRIGGER ON auth.users
--
-- The usual Supabase pattern hangs an AFTER INSERT trigger on auth.users to
-- mirror each new account into `profiles`. That is no longer possible: the
-- `postgres` role does not own auth.users, so CREATE TRIGGER on it fails with
--   ERROR 42501: must be owner of relation users
-- and because the SQL editor runs a script in one transaction, that single
-- failure silently rolls back every table in the file.
--
-- Instead the client calls ensure_profile() right after sign-in. Supabase now
-- recommends this direction anyway, and it has a real advantage: it re-syncs
-- is_active on every call, so adding someone to the allowlist and having them
-- press "Check again" is enough to let them in.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Households. The unit that cooks a dinner and takes a share of the house cost.
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 80),
  color      text not null default '#1f8f89' check (color ~* '^#[0-9a-f]{6}$'),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles. `is_active` is the gate every RLS policy checks. It is derived
-- from allowed_emails and must never be writable by the person it describes.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique check (email = lower(email)),
  full_name    text not null default '',
  display_name text generated always as
                 (coalesce(nullif(btrim(full_name), ''), split_part(email, '@', 1))) stored,
  avatar_path  text,
  household_id uuid references public.households(id) on delete set null,
  role         public.member_role not null default 'member',
  is_active    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_household_idx on public.profiles (household_id);
create index if not exists profiles_active_idx    on public.profiles (is_active) where is_active;

-- Column-level grants, and why they are not optional:
-- RLS filters *rows*, not *columns*. A policy saying "you may update your own
-- profile" would otherwise let anyone set role='organizer' or is_active=true
-- on themselves. These grants are the only thing preventing that.
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_path, household_id) on public.profiles to authenticated;
-- No INSERT: only ensure_profile() creates rows, and it runs as the owner.
-- No DELETE: removal cascades from auth.users.

-- ---------------------------------------------------------------------------
-- The invite allowlist. Source of truth for "is this person family?".
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email      text primary key
               check (email = lower(email) and position('@' in email) > 1),
  note       text,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.allowed_emails to authenticated;
grant select, insert, update on public.households to authenticated;
grant delete on public.households to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists households_touch on public.households;
create trigger households_touch before update on public.households
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- ensure_profile() — called by the app immediately after sign-in.
--
-- SECURITY DEFINER so it can write columns the caller is not granted, and so
-- it bypasses the profiles policies while creating the very row those policies
-- depend on.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := (select auth.uid());
  v_email  text := lower(nullif((select auth.jwt() ->> 'email'), ''));
  v_active boolean;
begin
  if v_id is null or v_email is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  v_active := exists (select 1 from public.allowed_emails a where a.email = v_email);

  insert into public.profiles (id, email, is_active)
  values (v_id, v_email, v_active)
  on conflict (id) do update
     set email     = excluded.email,
         is_active = excluded.is_active;
end;
$$;

revoke execute on function public.ensure_profile() from public, anon;
grant   execute on function public.ensure_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Allowlist changes take effect immediately, in both directions.
--
-- This trigger is on our own table, so it is allowed — unlike one on
-- auth.users. Deriving is_active here (rather than reading the allowlist in
-- every policy) means revoking someone applies on their very next query, with
-- no waiting for a token to expire.
-- ---------------------------------------------------------------------------
create or replace function public.sync_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles set is_active = false where email = old.email;
    return old;
  end if;

  update public.profiles set is_active = true where email = new.email;
  return new;
end;
$$;

drop trigger if exists allowed_emails_sync on public.allowed_emails;
create trigger allowed_emails_sync
  after insert or delete on public.allowed_emails
  for each row execute function public.sync_allowed_email();
