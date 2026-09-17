-- ===========================================================================
-- 23_events_organizer_only.sql — organizers own the calendar.
--
-- Events were fully collaborative, alongside the dinner rotation. The calendar
-- turns out to be different: a booked charter or a reservation is not a thing
-- anyone should be able to move or delete.
--
-- Comments stay open to every member. Being able to ask "what time?" under an
-- event is the point of them, and a comment cannot change the plan.
-- Dinners stay collaborative too — that rotation is genuinely shared.
-- ===========================================================================

drop policy if exists events_select on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_modify on public.events;
drop policy if exists events_remove on public.events;

create policy events_select on public.events
  for select to authenticated
  using ( (select public.is_member()) );

create policy events_insert on public.events
  for insert to authenticated
  with check ( (select public.is_organizer()) and created_by = (select auth.uid()) );

create policy events_modify on public.events
  for update to authenticated
  using      ( (select public.is_organizer()) )
  with check ( (select public.is_organizer()) );

create policy events_remove on public.events
  for delete to authenticated
  using ( (select public.is_organizer()) );
