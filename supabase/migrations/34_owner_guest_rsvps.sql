-- ===========================================================================
-- 34_owner_guest_rsvps.sql — the owner can add people who will never log in.
--
-- Migration 24 closed RSVPs to "yourself only", which also removed guest rows
-- and left family without accounts off the roster entirely. This restores
-- guests for the OWNER alone, and deliberately not the ability to answer for
-- a member: an RSVP about a person who can speak for themselves stays theirs.
--
-- The shape of a guest row is what enforces that split — profile_id IS NULL
-- with a name — so the policies can allow one without allowing the other.
-- ===========================================================================

drop policy if exists rsvps_insert on public.rsvps;
create policy rsvps_insert on public.rsvps
  for insert to authenticated
  with check (
    (select public.is_member())
    and created_by = (select auth.uid())
    and (
      profile_id = (select auth.uid())                         -- your own answer
      or (profile_id is null and (select public.is_owner()))   -- a guest you are adding
    )
  );

drop policy if exists rsvps_update on public.rsvps;
create policy rsvps_update on public.rsvps
  for update to authenticated
  using (
    profile_id = (select auth.uid())
    or (profile_id is null and (select public.is_owner()))
  )
  -- Repeating the test in the check is what stops a row changing sides: a
  -- member cannot turn their answer into a guest row, and the owner cannot
  -- turn a guest row into somebody's answer.
  with check (
    profile_id = (select auth.uid())
    or (profile_id is null and (select public.is_owner()))
  );

drop policy if exists rsvps_delete on public.rsvps;
create policy rsvps_delete on public.rsvps
  for delete to authenticated
  using ( profile_id = (select auth.uid()) or (select public.is_organizer()) );
