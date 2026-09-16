-- ===========================================================================
-- 02_helpers.sql — the membership checks every RLS policy calls.
--
-- THE RECURSION TRAP THIS EXISTS TO AVOID
--
-- The obvious policy is also a broken one:
--
--   create policy p on public.profiles for select to authenticated
--   using (exists (select 1 from public.profiles
--                  where id = auth.uid() and is_active));
--
-- That inner SELECT on `profiles` re-enters this very policy, forever:
--   ERROR 42P17: infinite recursion detected in policy for relation "profiles"
--
-- A SECURITY DEFINER function runs as its owner (postgres), who owns the table,
-- and table owners are exempt from RLS unless FORCE ROW LEVEL SECURITY is set.
-- So the lookup inside these functions evaluates no policy at all.
--
-- Two rules, both load-bearing:
--
--   1. `set search_path = ''` with fully-qualified names. Without it, someone
--      who can create objects could shadow `public.profiles` and hijack the
--      definer context. Supabase's linter flags this as
--      `function_search_path_mutable`.
--
--   2. Call these as `(select public.is_member())` in policies, never bare.
--      Wrapping in a subquery makes the planner evaluate it once per query
--      instead of once per row.
-- ===========================================================================

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.is_active
  );
$$;

create or replace function public.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.is_active
       and p.role = 'organizer'
  );
$$;

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.household_id from public.profiles p where p.id = (select auth.uid());
$$;

revoke execute on function public.is_member(), public.is_organizer(), public.my_household_id()
  from public, anon;
grant execute on function public.is_member(), public.is_organizer(), public.my_household_id()
  to authenticated;
