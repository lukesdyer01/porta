-- ===========================================================================
-- 32_households_owner.sql — households move up to the owner tier.
--
-- Any member could rename or create a household; only the Members screen being
-- organizer-gated kept that out of reach, and a UI gate is not a rule.
-- Households decide who cooks and how the house cost divides, so they belong
-- with the other people-shaped settings the owner holds.
--
-- Reading stays open to every member: the dinner rotation, the split picker
-- and the profile screen all need the list.
-- ===========================================================================

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists households_insert on public.households;
create policy households_insert on public.households
  for insert to authenticated with check ( (select public.is_owner()) );

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using      ( (select public.is_owner()) )
  with check ( (select public.is_owner()) );

drop policy if exists households_delete on public.households;
create policy households_delete on public.households
  for delete to authenticated using ( (select public.is_owner()) );
