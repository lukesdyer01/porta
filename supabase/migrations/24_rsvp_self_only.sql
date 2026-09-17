-- ===========================================================================
-- 24_rsvp_self_only.sql — you RSVP for yourself, and only yourself.
--
-- The policies previously allowed two extra paths that no screen ever used:
-- a row with a guest_name and no profile_id, and an organizer answering on
-- anyone's behalf. Neither is wanted: an RSVP is a statement about yourself,
-- so nobody else gets to make it or change it — organizers included.
--
-- DELETE keeps an organizer path. That is cleanup, not answering for someone:
-- when a person leaves the family their row would otherwise sit on the roster
-- permanently with nobody able to remove it.
-- ===========================================================================

drop policy if exists rsvps_insert on public.rsvps;
create policy rsvps_insert on public.rsvps
  for insert to authenticated
  with check (
    (select public.is_member())
    and profile_id = (select auth.uid())
    and created_by = (select auth.uid())
  );

drop policy if exists rsvps_update on public.rsvps;
create policy rsvps_update on public.rsvps
  for update to authenticated
  using      ( profile_id = (select auth.uid()) )
  -- Without the same test in the check, you could hand your row to someone
  -- else by editing profile_id and answer for them that way.
  with check ( profile_id = (select auth.uid()) );

drop policy if exists rsvps_delete on public.rsvps;
create policy rsvps_delete on public.rsvps
  for delete to authenticated
  using ( profile_id = (select auth.uid()) or (select public.is_organizer()) );
