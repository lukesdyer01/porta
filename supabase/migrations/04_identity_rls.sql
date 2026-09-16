-- ===========================================================================
-- 04_identity_rls.sql — policies for households, profiles, allowed_emails.
-- ===========================================================================

alter table public.households    enable row level security;
alter table public.profiles      enable row level security;
alter table public.allowed_emails enable row level security;

-- Note on FORCE ROW LEVEL SECURITY: do NOT set it on `profiles`. Forcing RLS
-- applies policies to the table owner too, which would put is_member() straight
-- back into the recursion it was written to escape.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using ( (select public.is_member()) or id = (select auth.uid()) );
  -- The OR lets a signed-in but not-yet-approved person load their own row, so
  -- they see "your account is pending" instead of an empty screen.

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using      ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );
  -- Escalation to organizer is blocked by the column-level GRANT in
  -- 01_identity.sql, not here. Both layers are required.

-- ---------------------------------------------------------------------------
-- households — any member may create and rename; only organizers delete.
-- ---------------------------------------------------------------------------
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists households_insert on public.households;
create policy households_insert on public.households
  for insert to authenticated with check ( (select public.is_member()) );

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using      ( (select public.is_member()) )
  with check ( (select public.is_member()) );

drop policy if exists households_delete on public.households;
create policy households_delete on public.households
  for delete to authenticated using ( (select public.is_organizer()) );

-- ---------------------------------------------------------------------------
-- allowed_emails — organizers only. This list is who can enter the app at all.
-- ---------------------------------------------------------------------------
drop policy if exists allowed_emails_all on public.allowed_emails;
create policy allowed_emails_all on public.allowed_emails
  for all to authenticated
  using      ( (select public.is_organizer()) )
  with check ( (select public.is_organizer()) );
