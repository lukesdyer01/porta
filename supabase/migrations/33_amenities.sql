-- ===========================================================================
-- 33_amenities.sql — what each house actually has.
--
-- A shared vocabulary rather than free text per house. The whole point is
-- comparing years — "which houses had a private pool?" — and free text
-- fragments into "Grill", "grill" and "BBQ", which answers nothing.
-- ===========================================================================

create table if not exists public.amenities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 2 and 40),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Uniqueness on the lowered name, not the name. A plain unique constraint
-- would accept "Grill" and "grill" as two amenities and quietly defeat the
-- reason for having a shared list at all.
create unique index if not exists amenities_name_unique on public.amenities (lower(btrim(name)));

create table if not exists public.house_amenities (
  house_id   uuid not null references public.houses(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (house_id, amenity_id)
);

create index if not exists house_amenities_amenity_idx on public.house_amenities (amenity_id);

grant select, insert, update, delete on public.amenities       to authenticated;
grant select, insert, update, delete on public.house_amenities to authenticated;

alter table public.amenities       enable row level security;
alter table public.house_amenities enable row level security;

-- ---------------------------------------------------------------------------
-- Anyone may add an amenity: low risk, and it saves a text to an organizer.
-- Renaming or deleting one reaches across every house in every year — a delete
-- cascades the tick off all of them — so that sits with the owner.
-- ---------------------------------------------------------------------------
drop policy if exists amenities_select on public.amenities;
create policy amenities_select on public.amenities
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists amenities_insert on public.amenities;
create policy amenities_insert on public.amenities
  for insert to authenticated with check ( (select public.is_member()) );

drop policy if exists amenities_update on public.amenities;
create policy amenities_update on public.amenities
  for update to authenticated
  using ( (select public.is_owner()) ) with check ( (select public.is_owner()) );

drop policy if exists amenities_delete on public.amenities;
create policy amenities_delete on public.amenities
  for delete to authenticated using ( (select public.is_owner()) );

-- Ticking is open to every member, like the gate-code panel: whoever notices
-- the grill on the deck records it.
drop policy if exists house_amenities_select on public.house_amenities;
create policy house_amenities_select on public.house_amenities
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists house_amenities_insert on public.house_amenities;
create policy house_amenities_insert on public.house_amenities
  for insert to authenticated with check ( (select public.is_member()) );

drop policy if exists house_amenities_delete on public.house_amenities;
create policy house_amenities_delete on public.house_amenities
  for delete to authenticated using ( (select public.is_member()) );

-- ---------------------------------------------------------------------------
-- A starting vocabulary. on conflict so re-running changes nothing.
-- ---------------------------------------------------------------------------
insert into public.amenities (name, sort_order) values
  ('Private pool', 10),
  ('Community pool', 20),
  ('Hot tub', 30),
  ('Grill', 40),
  ('Golf cart', 50),
  ('Boat dock', 60),
  ('Beach access', 70),
  ('Washer & dryer', 80),
  ('Elevator', 90),
  ('Covered parking', 100),
  ('Outdoor shower', 110),
  ('Fire pit', 120),
  ('Pet friendly', 130),
  ('Kayaks', 140)
on conflict do nothing;
