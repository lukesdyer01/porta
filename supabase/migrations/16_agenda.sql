-- ===========================================================================
-- 16_agenda.sql — the dinner rotation and the event calendar.
--
-- Dinners are claimed by HOUSEHOLD, not by person: cooking a beach-house
-- dinner is a family effort, and the rotation people actually care about is
-- "whose night is it".
--
-- Both tables are fully collaborative. Anyone can fix the schedule — that is
-- the point of a shared agenda, and an audit trail is overkill for a family.
-- ===========================================================================

create table if not exists public.meals (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  meal_date    date not null,
  meal_type    public.meal_type not null default 'dinner',
  household_id uuid references public.households(id) on delete set null,
  title        text not null default '',
  description  text,
  created_by   uuid not null references public.profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One dinner per night. Re-assigning edits the row instead of stacking
  -- duplicates nobody can tell apart.
  unique (trip_id, meal_date, meal_type)
);

create index if not exists meals_trip_date_idx on public.meals (trip_id, meal_date);

-- Optional named cooks within the household, for "Sue's doing the sides".
create table if not exists public.meal_cooks (
  meal_id    uuid not null references public.meals(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note       text,
  primary key (meal_id, profile_id)
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 140),
  description text,
  kind        public.event_kind not null default 'activity',
  all_day     boolean not null default false,
  event_date  date not null,
  start_time  time,
  end_time    time,
  location    text,
  url         text check (url is null or url ~* '^https?://'),
  created_by  uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_times_ordered check (end_time is null or start_time is null or end_time >= start_time)
);

create index if not exists events_trip_date_idx on public.events (trip_id, event_date, start_time);

grant select, insert, update, delete on public.meals      to authenticated;
grant select, insert, update, delete on public.meal_cooks to authenticated;
grant select, insert, update, delete on public.events     to authenticated;

drop trigger if exists meals_touch on public.meals;
create trigger meals_touch before update on public.meals
  for each row execute function public.touch_updated_at();
drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

alter table public.meals      enable row level security;
alter table public.meal_cooks enable row level security;
alter table public.events     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['meals','events'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format('drop policy if exists %1$s_insert on public.%1$I', t);
    execute format('drop policy if exists %1$s_modify on public.%1$I', t);
    execute format('drop policy if exists %1$s_remove on public.%1$I', t);

    execute format($f$create policy %1$s_select on public.%1$I
      for select to authenticated using ( (select public.is_member()) )$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$I
      for insert to authenticated
      with check ( (select public.is_member()) and created_by = (select auth.uid()) )$f$, t);
    execute format($f$create policy %1$s_modify on public.%1$I
      for update to authenticated
      using ( (select public.is_member()) ) with check ( (select public.is_member()) )$f$, t);
    execute format($f$create policy %1$s_remove on public.%1$I
      for delete to authenticated using ( (select public.is_member()) )$f$, t);
  end loop;
end $$;

drop policy if exists meal_cooks_all on public.meal_cooks;
create policy meal_cooks_all on public.meal_cooks
  for all to authenticated
  using ( (select public.is_member()) ) with check ( (select public.is_member()) );
