-- ===========================================================================
-- 36_trip_items.sql — what to bring and what to buy.
--
-- The claiming rules are copied from 26_meals_claim.sql rather than
-- reinvented: an unclaimed item is anyone's to take, your own is yours to
-- change or release, someone else's is theirs unless you organise. Same shape,
-- already tested, and the family already understands claiming from dinners.
-- ===========================================================================

create table if not exists public.trip_items (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  kind       text not null check (kind in ('bring', 'buy')),
  name       text not null check (length(btrim(name)) between 1 and 120),
  claimed_by uuid references public.profiles(id) on delete set null,
  done       boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_items_trip_idx on public.trip_items (trip_id, kind, created_at);

grant select, insert, update, delete on public.trip_items to authenticated;

drop trigger if exists trip_items_touch on public.trip_items;
create trigger trip_items_touch before update on public.trip_items
  for each row execute function public.touch_updated_at();

alter table public.trip_items enable row level security;

drop policy if exists trip_items_select on public.trip_items;
create policy trip_items_select on public.trip_items
  for select to authenticated using ( (select public.is_member()) );

-- Anyone may add to the list; claiming is what is controlled.
drop policy if exists trip_items_insert on public.trip_items;
create policy trip_items_insert on public.trip_items
  for insert to authenticated
  with check (
    (select public.is_member())
    and created_by = (select auth.uid())
    and (
      (select public.is_organizer())
      or claimed_by is null
      or claimed_by = (select auth.uid())
    )
  );

drop policy if exists trip_items_modify on public.trip_items;
create policy trip_items_modify on public.trip_items
  for update to authenticated
  using (
    (select public.is_member())
    and (
      (select public.is_organizer())
      or claimed_by is null
      or claimed_by = (select auth.uid())
    )
  )
  with check (
    (select public.is_member())
    and (
      (select public.is_organizer())
      or claimed_by is null
      or claimed_by = (select auth.uid())
    )
  );

drop policy if exists trip_items_remove on public.trip_items;
create policy trip_items_remove on public.trip_items
  for delete to authenticated
  using (
    (select public.is_member())
    and (
      (select public.is_organizer())
      or claimed_by is null
      or claimed_by = (select auth.uid())
    )
  );
