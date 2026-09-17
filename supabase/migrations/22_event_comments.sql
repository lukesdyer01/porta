-- ===========================================================================
-- 22_event_comments.sql — a thread under each calendar event.
--
-- Deliberately a table per thing rather than one polymorphic comments table:
-- a generic (target_type, target_id) pair cannot carry a foreign key, so
-- deleting an event would silently orphan its comments. If photos or meals
-- want comments later, they get their own table and their own cascade.
-- ===========================================================================

create table if not exists public.event_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete restrict,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_comments_event_idx
  on public.event_comments (event_id, created_at);

grant select, insert, update, delete on public.event_comments to authenticated;

drop trigger if exists event_comments_touch on public.event_comments;
create trigger event_comments_touch before update on public.event_comments
  for each row execute function public.touch_updated_at();

alter table public.event_comments enable row level security;

drop policy if exists event_comments_select on public.event_comments;
create policy event_comments_select on public.event_comments
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists event_comments_insert on public.event_comments;
create policy event_comments_insert on public.event_comments
  for insert to authenticated
  with check ( (select public.is_member()) and author_id = (select auth.uid()) );

-- Author-owned, like the journal: the events themselves are collaborative, but
-- nobody rewrites what you said about one. The with-check also stops
-- authorship being reassigned on update.
drop policy if exists event_comments_update on public.event_comments;
create policy event_comments_update on public.event_comments
  for update to authenticated
  using      ( author_id = (select auth.uid()) )
  with check ( author_id = (select auth.uid()) );

drop policy if exists event_comments_delete on public.event_comments;
create policy event_comments_delete on public.event_comments
  for delete to authenticated
  using ( author_id = (select auth.uid()) or (select public.is_organizer()) );
