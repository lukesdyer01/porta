-- ===========================================================================
-- 31_owner_powers.sql — what the owner can do that an organizer cannot.
--
-- Organizers keep running the trip: trips, houses, the calendar, invites,
-- households. Managing PEOPLE moves up a tier — who holds which role, and
-- editing someone else's name or household.
--
-- The reason role changes must be owner-only is concrete: if an organizer
-- could set roles, they could make themselves owner, and the tier would mean
-- nothing.
-- ===========================================================================

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.is_active
       and p.role = 'owner'
  );
$$;

-- Owner outranks organizer, so every existing organizer check keeps passing
-- for the owner rather than each one needing to name both roles.
create or replace function public.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.is_active
       and p.role in ('organizer', 'owner')
  );
$$;

revoke execute on function public.is_owner() from public, anon;
grant   execute on function public.is_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- Role changes: owner only, and the last owner cannot be demoted.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(
  target_email text,
  new_role     public.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(target_email));
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner can change roles.' using errcode = '42501';
  end if;

  if new_role <> 'owner'
     and (select count(*) from public.allowed_emails where role = 'owner') <= 1
     and exists (select 1 from public.allowed_emails where email = v_email and role = 'owner') then
    raise exception 'That is the only owner. Make someone else the owner first.'
      using errcode = 'check_violation';
  end if;

  update public.allowed_emails set role = new_role where email = v_email;
  update public.profiles        set role = new_role where email = v_email;

  if not exists (select 1 from public.allowed_emails where email = v_email) then
    raise exception 'No such member.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.admin_set_role(text, public.member_role) from public, anon;
grant   execute on function public.admin_set_role(text, public.member_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Editing someone else's details: owner only.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_profile(
  target_id      uuid,
  new_full_name  text,
  new_household  uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner can edit someone else''s details.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception 'No such member.' using errcode = 'no_data_found';
  end if;

  update public.profiles
     set full_name    = coalesce(btrim(new_full_name), ''),
         household_id = new_household
   where id = target_id;
end;
$$;

revoke execute on function public.admin_update_profile(uuid, text, uuid) from public, anon;
grant   execute on function public.admin_update_profile(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Removing an owner from the invite list would strip their access, which is a
-- way to unseat the owner without ever touching a role. Only an owner may.
-- ---------------------------------------------------------------------------
create or replace function public.protect_last_organizer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and not (select public.is_owner()) then
    raise exception 'Only the owner can remove the owner.' using errcode = '42501';
  end if;

  if old.role in ('organizer', 'owner')
     and (select count(*) from public.allowed_emails where role in ('organizer', 'owner')) <= 1 then
    raise exception 'That is the only organizer. Make someone else an organizer first.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;
