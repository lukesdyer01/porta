-- ===========================================================================
-- 35_owner_rsvps_members.sql — the owner can answer for a member too.
--
-- Guests alone were not enough: nothing stopped typing the name of somebody
-- who already has an account, which put a phantom second copy of them on the
-- roster and double-counted them. Picking the real person fixes that, but it
-- means the owner setting an answer for someone who can speak for themselves.
--
-- The member always wins in the end — their own update policy is unchanged, so
-- they can correct whatever was entered for them. And created_by already
-- records who typed it, so the roster can say an answer was entered by someone
-- else rather than presenting it as the person's own words.
-- ===========================================================================

drop policy if exists rsvps_insert on public.rsvps;
create policy rsvps_insert on public.rsvps
  for insert to authenticated
  with check (
    (select public.is_member())
    and created_by = (select auth.uid())
    and (
      profile_id = (select auth.uid())   -- your own answer
      or (select public.is_owner())      -- the owner, for a member or a guest
    )
  );

drop policy if exists rsvps_update on public.rsvps;
create policy rsvps_update on public.rsvps
  for update to authenticated
  using      ( profile_id = (select auth.uid()) or (select public.is_owner()) )
  -- A member still cannot hand their row to anyone else: the first branch
  -- pins it to them, and they do not satisfy the second.
  with check ( profile_id = (select auth.uid()) or (select public.is_owner()) );

drop policy if exists rsvps_delete on public.rsvps;
create policy rsvps_delete on public.rsvps
  for delete to authenticated
  using ( profile_id = (select auth.uid()) or (select public.is_organizer()) );
