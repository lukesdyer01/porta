-- ===========================================================================
-- 29_admin_edit_profiles.sql — organizers can fix someone else's name and
-- household.
--
-- People set their own name and household, and nobody could correct them. In
-- practice a couple of family members never finish setting up, so the roster
-- shows an email prefix and the dinner rotation has nobody to claim a night.
--
-- This needs a function for the same reason role changes did: the column-level
-- grants let you update only your OWN row, and the profiles policy enforces
-- it. Those grants are what stop a member rewriting anyone they like, so
-- neither is relaxed — a definer function is the narrow exception.
-- ===========================================================================

-- The screen needs the raw name to edit and the id to pick a household.
-- CREATE OR REPLACE cannot insert a column mid-list, only append, so this
-- drops first. Nothing depends on the view but the Members screen.
drop view if exists public.admin_members;
create view public.admin_members
with (security_invoker = true) as
select
  a.email,
  a.note,
  a.role                       as invited_role,
  a.created_at                 as invited_at,
  p.id                         as profile_id,
  p.full_name,
  p.display_name,
  p.role                       as profile_role,
  coalesce(p.is_active, false) as is_active,
  p.household_id,
  h.name                       as household_name,
  (p.id is not null)           as has_signed_in
from public.allowed_emails a
left join public.profiles   p on p.email = a.email
left join public.households h on h.id = p.household_id;

revoke all on public.admin_members from public, anon;
grant select on public.admin_members to authenticated;

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
  if not (select public.is_organizer()) then
    raise exception 'Organizers only.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception 'No such member.' using errcode = 'no_data_found';
  end if;

  -- Deliberately does not touch role or is_active. Promotion goes through
  -- admin_set_role, which protects the last organizer; membership is derived
  -- from the invite list. Letting this write either would route around both.
  update public.profiles
     set full_name    = coalesce(btrim(new_full_name), ''),
         household_id = new_household
   where id = target_id;
end;
$$;

revoke execute on function public.admin_update_profile(uuid, text, uuid) from public, anon;
grant   execute on function public.admin_update_profile(uuid, text, uuid) to authenticated;
