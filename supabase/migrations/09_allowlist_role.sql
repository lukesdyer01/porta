-- ===========================================================================
-- 09_allowlist_role.sql — let the invite list decide who is an organizer.
--
-- Without this, ensure_profile() creates every account as 'member', so a new
-- organizer needs a manual SQL UPDATE after their first sign-in -- exactly the
-- friction the invite code removed from signup. Worse, the very first person
-- in is a member, and members cannot create trips, so a fresh project has
-- nobody who can set one up.
-- ===========================================================================

alter table public.allowed_emails
  add column if not exists role public.member_role not null default 'member';

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
  v_role   public.member_role;
begin
  if v_id is null or v_email is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select true, a.role
    into v_active, v_role
    from public.allowed_emails a
   where a.email = v_email;

  v_active := coalesce(v_active, false);
  v_role   := coalesce(v_role, 'member');

  insert into public.profiles (id, email, is_active, role)
  values (v_id, v_email, v_active, v_role)
  on conflict (id) do update
     set email     = excluded.email,
         is_active = excluded.is_active;
     -- role is intentionally NOT updated here: promoting or demoting someone
     -- is a deliberate act, and re-deriving it on every sign-in would undo it.
end;
$$;

revoke execute on function public.ensure_profile() from public, anon;
grant   execute on function public.ensure_profile() to authenticated;
