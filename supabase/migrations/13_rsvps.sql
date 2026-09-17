-- ===========================================================================
-- 13_rsvps.sql — who is coming each year, and gating the house codes on it.
-- ===========================================================================

create table if not exists public.rsvps (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips(id) on delete cascade,
  profile_id     uuid references public.profiles(id) on delete cascade,
  -- Family without an account (Grandma) still needs to show up in the roster
  -- and the headcount, so a row can name a guest instead of a profile.
  guest_name     text,
  status         public.rsvp_status not null default 'pending',
  adults         smallint not null default 0 check (adults between 0 and 40),
  kids           smallint not null default 0 check (kids between 0 and 40),
  headcount      smallint generated always as (adults + kids) stored,
  arrival_date   date,
  departure_date date,
  notes          text,
  created_by     uuid not null references public.profiles(id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint rsvp_identity
    check (num_nonnulls(profile_id, nullif(btrim(coalesce(guest_name, '')), '')) = 1),
  constraint rsvp_dates_ordered
    check (departure_date is null or arrival_date is null or departure_date >= arrival_date)
);

create unique index if not exists rsvps_one_per_member
  on public.rsvps (trip_id, profile_id) where profile_id is not null;
create index if not exists rsvps_trip_idx on public.rsvps (trip_id);

grant select, insert, update, delete on public.rsvps to authenticated;

drop trigger if exists rsvps_touch on public.rsvps;
create trigger rsvps_touch before update on public.rsvps
  for each row execute function public.touch_updated_at();

alter table public.rsvps enable row level security;

drop policy if exists rsvps_select on public.rsvps;
create policy rsvps_select on public.rsvps
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists rsvps_insert on public.rsvps;
create policy rsvps_insert on public.rsvps
  for insert to authenticated
  with check (
    (select public.is_member())
    and created_by = (select auth.uid())
    and ( profile_id = (select auth.uid())     -- yourself
          or profile_id is null                -- a guest you are bringing
          or (select public.is_organizer()) )  -- organizer filling in for someone
  );

drop policy if exists rsvps_update on public.rsvps;
create policy rsvps_update on public.rsvps
  for update to authenticated
  using      ( profile_id = (select auth.uid()) or created_by = (select auth.uid())
               or (select public.is_organizer()) )
  with check ( profile_id = (select auth.uid()) or created_by = (select auth.uid())
               or (select public.is_organizer()) );

drop policy if exists rsvps_delete on public.rsvps;
create policy rsvps_delete on public.rsvps
  for delete to authenticated
  using ( profile_id = (select auth.uid()) or created_by = (select auth.uid())
          or (select public.is_organizer()) );

-- ---------------------------------------------------------------------------
-- House codes now require an RSVP.
--
-- Signup is self-serve behind a shared code, so "any signed-in member" is a
-- looser door than it was when the allowlist was the only way in. Requiring a
-- yes for the year costs real attendees nothing — they RSVP anyway — and means
-- a stray account cannot read the gate code.
-- ---------------------------------------------------------------------------
create or replace function public.is_attending(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rsvps r
     where r.trip_id = p_trip_id
       and r.profile_id = (select auth.uid())
       and r.status = 'yes'
  );
$$;

revoke execute on function public.is_attending(uuid) from public, anon;
grant   execute on function public.is_attending(uuid) to authenticated;

drop policy if exists house_info_select on public.house_info;
drop policy if exists house_info_write  on public.house_info;

create policy house_info_select on public.house_info
  for select to authenticated
  using (
    (select public.is_member())
    and (
      (select public.is_organizer())
      or exists (
        select 1 from public.houses h
         where h.id = house_info.house_id
           and public.is_attending(h.trip_id)
      )
    )
  );

-- Same audience for writes: if you cannot see a code you have no business
-- editing it. Still collaborative among everyone who is actually going.
create policy house_info_write on public.house_info
  for all to authenticated
  using (
    (select public.is_member())
    and (
      (select public.is_organizer())
      or exists (select 1 from public.houses h
                  where h.id = house_info.house_id
                    and public.is_attending(h.trip_id))
    )
  )
  with check (
    (select public.is_member())
    and (
      (select public.is_organizer())
      or exists (select 1 from public.houses h
                  where h.id = house_info.house_id
                    and public.is_attending(h.trip_id))
    )
  );
