-- ===========================================================================
-- 06_trips.sql — one trip per year, the house, and the codes everyone texts
-- about on arrival day.
-- ===========================================================================

create table if not exists public.trips (
  id         uuid primary key default gen_random_uuid(),
  year       integer not null unique check (year between 2000 and 2100),
  name       text not null default '',
  start_date date,
  end_date   date,
  status     public.trip_status not null default 'planning',
  notes      text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_ordered
    check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists trips_year_desc_idx on public.trips (year desc);

create table if not exists public.houses (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  name            text not null default '',
  address_line1   text,
  address_line2   text,
  city            text not null default 'Port Aransas',
  state           text not null default 'TX',
  postal_code     text,
  -- Plotted on the all-years map. Both or neither; a lone latitude is a bug.
  lat             numeric(9, 6) check (lat between -90 and 90),
  lng             numeric(9, 6) check (lng between -180 and 180),
  rental_url      text check (rental_url is null or rental_url ~* '^https?://'),
  rental_platform text,
  cost_cents      integer check (cost_cents is null or cost_cents >= 0),
  bedrooms        smallint check (bedrooms is null or bedrooms between 0 and 30),
  sleeps          smallint check (sleeps is null or sleeps between 0 and 60),
  notes           text,
  created_by      uuid not null references public.profiles(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint houses_latlng_together check ((lat is null) = (lng is null))
);

create index if not exists houses_trip_idx   on public.houses (trip_id);
create index if not exists houses_latlng_idx on public.houses (lat, lng) where lat is not null;

-- Gate code, pool code, wifi, trash day. Free-form label/value so a new house
-- with a quirk ("outdoor shower key") needs no migration.
create table if not exists public.house_info (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses(id) on delete cascade,
  label      text not null check (length(btrim(label)) between 1 and 60),
  value      text not null default '',
  sort_order smallint not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (house_id, label)
);

create index if not exists house_info_house_idx on public.house_info (house_id, sort_order);

drop trigger if exists trips_touch on public.trips;
create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();
drop trigger if exists houses_touch on public.houses;
create trigger houses_touch before update on public.houses
  for each row execute function public.touch_updated_at();
drop trigger if exists house_info_touch on public.house_info;
create trigger house_info_touch before update on public.house_info
  for each row execute function public.touch_updated_at();

-- Table-level grants. 00_prelude changes the schema's default privileges, so
-- state these explicitly rather than relying on what a new table inherits.
grant select, insert, update, delete on public.trips      to authenticated;
grant select, insert, update, delete on public.houses     to authenticated;
grant select, insert, update, delete on public.house_info to authenticated;
