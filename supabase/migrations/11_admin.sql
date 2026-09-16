-- ===========================================================================
-- 11_admin.sql — what the organizer's member screen needs.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- One row per invited address, with whatever we know about the person.
--
-- security_invoker = true is NOT optional. A view runs as its OWNER by default,
-- and the owner (postgres) bypasses RLS entirely — a plain `create view` over
-- allowed_emails would expose the whole invite list to every signed-in member.
-- With invoker set, the caller's policies apply, so only organizers see rows.
-- ---------------------------------------------------------------------------
create or replace view public.admin_members
with (security_invoker = true) as
select
  a.email,
  a.note,
  a.role                       as invited_role,
  a.created_at                 as invited_at,
  p.id                         as profile_id,
  p.display_name,
  p.role                       as profile_role,
  coalesce(p.is_active, false) as is_active,
  h.name                       as household_name,
  (p.id is not null)           as has_signed_in
from public.allowed_emails a
left join public.profiles   p on p.email = a.email
left join public.households h on h.id = p.household_id;

revoke all on public.admin_members from public, anon;
grant select on public.admin_members to authenticated;

-- ---------------------------------------------------------------------------
-- Never let the project end up with nobody who can create a trip.
--
-- A trigger rather than a check inside the RPC, so it holds no matter which
-- path the delete came from — including a hand-written REST call.
-- ---------------------------------------------------------------------------
create or replace function public.protect_last_organizer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'organizer'
     and (select count(*) from public.allowed_emails where role = 'organizer') <= 1 then
    raise exception 'That is the only organizer. Make someone else an organizer first.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists allowed_emails_protect_last_organizer on public.allowed_emails;
create trigger allowed_emails_protect_last_organizer
  before delete on public.allowed_emails
  for each row execute function public.protect_last_organizer();

-- ---------------------------------------------------------------------------
-- Changing someone else's role needs a function: the column-level grants in
-- 01_identity.sql deliberately withhold `role` from authenticated, and the
-- profiles policy only allows self-updates. Both of those are what stop a
-- member promoting themselves, so neither should be relaxed.
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
  if not (select public.is_organizer()) then
    raise exception 'Organizers only.' using errcode = '42501';
  end if;

  if new_role <> 'organizer'
     and (select count(*) from public.allowed_emails where role = 'organizer') <= 1
     and exists (select 1 from public.allowed_emails
                  where email = v_email and role = 'organizer') then
    raise exception 'That is the only organizer. Make someone else an organizer first.'
      using errcode = 'check_violation';
  end if;

  update public.allowed_emails set role = new_role where email = v_email;
  update public.profiles        set role = new_role where email = v_email;

  if not found and not exists (select 1 from public.allowed_emails where email = v_email) then
    raise exception 'No such member.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.admin_set_role(text, public.member_role) from public, anon;
grant   execute on function public.admin_set_role(text, public.member_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Bulk invite. Takes whatever was pasted in, normalises it, and reports what
-- happened so the screen can say "4 added, 2 already there, 1 not an address".
-- ---------------------------------------------------------------------------
create or replace function public.admin_add_members(
  emails      text[],
  as_organizer boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw      text;
  v_email    text;
  v_added    text[] := '{}';
  v_existing text[] := '{}';
  v_invalid  text[] := '{}';
  v_role     public.member_role := case when as_organizer then 'organizer' else 'member' end;
begin
  if not (select public.is_organizer()) then
    raise exception 'Organizers only.' using errcode = '42501';
  end if;

  foreach v_raw in array coalesce(emails, '{}') loop
    v_email := lower(btrim(v_raw));
    continue when v_email = '';

    if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
      v_invalid := v_invalid || v_email;
      continue;
    end if;

    if exists (select 1 from public.allowed_emails a where a.email = v_email) then
      v_existing := v_existing || v_email;
      continue;
    end if;

    insert into public.allowed_emails (email, role, invited_by)
    values (v_email, v_role, (select auth.uid()));
    v_added := v_added || v_email;
  end loop;

  return jsonb_build_object(
    'added',    to_jsonb(v_added),
    'existing', to_jsonb(v_existing),
    'invalid',  to_jsonb(v_invalid));
end;
$$;

revoke execute on function public.admin_add_members(text[], boolean) from public, anon;
grant   execute on function public.admin_add_members(text[], boolean) to authenticated;
