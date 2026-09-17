-- ===========================================================================
-- 20_journal.sql — the group journal.
--
-- Author-owned, unlike the meals and calendar. Anyone can fix the dinner
-- schedule because that is shared logistics; nobody rewrites what you wrote.
-- ===========================================================================

create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete restrict,
  title      text not null default '',
  body       text not null default '' check (length(body) <= 50000),
  entry_date date not null default (now() at time zone 'America/Chicago')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_has_content
    check (nullif(btrim(title), '') is not null or nullif(btrim(body), '') is not null)
);

create index if not exists journal_trip_date_idx
  on public.journal_entries (trip_id, entry_date desc, created_at desc);

grant select, insert, update, delete on public.journal_entries to authenticated;

drop trigger if exists journal_touch on public.journal_entries;
create trigger journal_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

alter table public.journal_entries enable row level security;

drop policy if exists journal_select on public.journal_entries;
create policy journal_select on public.journal_entries
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists journal_insert on public.journal_entries;
create policy journal_insert on public.journal_entries
  for insert to authenticated
  with check ( (select public.is_member()) and author_id = (select auth.uid()) );

-- The with-check stops authorship being handed to someone else on update.
drop policy if exists journal_update on public.journal_entries;
create policy journal_update on public.journal_entries
  for update to authenticated
  using      ( author_id = (select auth.uid()) )
  with check ( author_id = (select auth.uid()) );

drop policy if exists journal_delete on public.journal_entries;
create policy journal_delete on public.journal_entries
  for delete to authenticated
  using ( author_id = (select auth.uid()) or (select public.is_organizer()) );
