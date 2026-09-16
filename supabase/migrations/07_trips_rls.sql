-- ===========================================================================
-- 07_trips_rls.sql
--
-- Trips and houses are organizer-managed: they're settled once a year by
-- whoever books, and an accidental edit is annoying to reconstruct.
-- house_info is deliberately open to every member — the whole point is that
-- anyone can correct the wifi password the moment they find it wrong.
-- ===========================================================================

alter table public.trips      enable row level security;
alter table public.houses     enable row level security;
alter table public.house_info enable row level security;

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated using ( (select public.is_member()) );
drop policy if exists trips_write on public.trips;
create policy trips_write on public.trips
  for all to authenticated
  using      ( (select public.is_organizer()) )
  with check ( (select public.is_organizer()) );

drop policy if exists houses_select on public.houses;
create policy houses_select on public.houses
  for select to authenticated using ( (select public.is_member()) );
drop policy if exists houses_write on public.houses;
create policy houses_write on public.houses
  for all to authenticated
  using      ( (select public.is_organizer()) )
  with check ( (select public.is_organizer()) );

drop policy if exists house_info_select on public.house_info;
create policy house_info_select on public.house_info
  for select to authenticated using ( (select public.is_member()) );
drop policy if exists house_info_write on public.house_info;
create policy house_info_write on public.house_info
  for all to authenticated
  using      ( (select public.is_member()) )
  with check ( (select public.is_member()) );
