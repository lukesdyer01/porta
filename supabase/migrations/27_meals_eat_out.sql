-- ===========================================================================
-- 27_meals_eat_out.sql — a night where nobody cooks.
--
-- "Nobody has claimed it yet" and "we're going out" looked identical before:
-- both were simply an unclaimed night, so an undecided night and a settled one
-- were indistinguishable.
--
-- The constraint states the thing that has to stay true: a night is either
-- somebody's to cook or a night out, never both. The existing claim policies
-- cover this for free — a night out has no household, so it stays editable by
-- anyone, exactly like an unclaimed one.
-- ===========================================================================

alter table public.meals
  add column if not exists eat_out boolean not null default false;

alter table public.meals
  drop constraint if exists meals_not_both_cook_and_out;

alter table public.meals
  add constraint meals_not_both_cook_and_out
  check (not (eat_out and household_id is not null));
