-- ===========================================================================
-- 26_meals_claim.sql — you claim a night for your own household.
--
-- Meals were fully collaborative, so anyone could put any family on any night
-- and just as easily take a night off them. Claiming only means something if
-- nobody else can do it for you.
--
--   unclaimed night  -> anyone may take it (for their own household)
--   your night       -> you may edit the menu or give it back
--   someone else's   -> hands off, unless you are an organizer
--
-- Both clauses are needed and do different jobs: `using` decides which rows
-- you may touch at all, `with check` decides what they are allowed to look
-- like afterwards. Without the check you could claim an unclaimed night on
-- behalf of a household that is not yours.
-- ===========================================================================

drop policy if exists meals_insert on public.meals;
create policy meals_insert on public.meals
  for insert to authenticated
  with check (
    (select public.is_member())
    and created_by = (select auth.uid())
    and (
      (select public.is_organizer())
      or household_id is null
      or household_id = (select public.my_household_id())
    )
  );

drop policy if exists meals_modify on public.meals;
create policy meals_modify on public.meals
  for update to authenticated
  using (
    (select public.is_member())
    and (
      (select public.is_organizer())
      or household_id is null
      or household_id = (select public.my_household_id())
    )
  )
  with check (
    (select public.is_member())
    and (
      (select public.is_organizer())
      or household_id is null
      or household_id = (select public.my_household_id())
    )
  );

drop policy if exists meals_remove on public.meals;
create policy meals_remove on public.meals
  for delete to authenticated
  using (
    (select public.is_member())
    and (
      (select public.is_organizer())
      or household_id is null
      or household_id = (select public.my_household_id())
    )
  );
