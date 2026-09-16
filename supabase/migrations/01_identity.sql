-- ===========================================================================
-- 01_identity.sql — households, the invite allowlist, and profiles.
--
-- Ordering matters: households <- profiles <- allowed_emails, so every foreign
-- key can be declared inline without a second ALTER pass.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Households. The unit that cooks a dinner and takes a share of the house cost.
-- ---------------------------------------------------------------------------
create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 80),
  color      text not null default '#1f8f89'
               check (color ~* '^#[0-9a-f]{6}$'),  -- for calendar + map legends
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles. One row per login, created automatically by the trigger below.
--
-- `is_active` is the gate every RLS policy checks. It is derived from
-- `allowed_emails` and must never be writable by the user it describes.
-- ---------------------------------------------------------------------------
create table public.profiles (
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

create index profiles_household_idx on public.profiles (household_id);
create index profiles_active_idx    on public.profiles (is_active) where is_active;

-- Column-level grants, and why they are not optional:
-- RLS filters *rows*, not *columns*. A policy saying "you may update your own
-- profile" would otherwise let anyone set role='organizer' or is_active=true on
-- themselves. These grants are the only thing preventing that.
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_path, household_id) on public.profiles to authenticated;
-- No INSERT: only the auth trigger creates profiles.
-- No DELETE: removal cascades from auth.users.

-- ---------------------------------------------------------------------------
-- The invite allowlist. Source of truth for "is this person family?".
-- ---------------------------------------------------------------------------
create table public.allowed_emails (
  email      text primary key
               check (email = lower(email) and position('@' in email) > 1),
  note       text,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

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

create trigger households_touch before update on public.households
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Populating profiles from auth.users
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(new.email);
begin
  insert into public.profiles (id, email, full_name, is_active)
  values (
    new.id,
    v_email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    exists (select 1 from public.allowed_emails a where a.email = v_email)
  )
  on conflict (id) do update set email = excluded.email;
  return new;
exception when others then
  -- Never abort signup with an opaque "Database error saving new user". A
  -- profile we failed to create can be repaired; a login nobody can complete
  -- is a support call in the middle of vacation week.
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile in step if the address changes in Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email     = lower(new.email),
         is_active = exists (
           select 1 from public.allowed_emails a where a.email = lower(new.email)
         )
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Allowlist changes take effect immediately, in both directions.
--
-- Deriving is_active from the allowlist (rather than reading the allowlist in
-- every policy) means revoking someone applies on their very next query — no
-- waiting for a token to expire.
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

create trigger allowed_emails_sync
  after insert or delete on public.allowed_emails
  for each row execute function public.sync_allowed_email();
