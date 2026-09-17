-- ===========================================================================
-- 14_house_reviews.sql — rate and comment on the house.
--
-- The point is next year's booking: "was this one worth repeating?" is
-- impossible to answer from memory a year later, and currently lives in a
-- group text nobody can find.
-- ===========================================================================

create table if not exists public.house_reviews (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating     smallint check (rating between 1 and 5),
  comment    text check (length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review each, edited in place, rather than a thread of restatements.
  unique (house_id, profile_id),
  -- A row with neither a rating nor a comment says nothing.
  constraint review_has_content
    check (rating is not null or nullif(btrim(coalesce(comment, '')), '') is not null)
);

create index if not exists house_reviews_house_idx on public.house_reviews (house_id);

grant select, insert, update, delete on public.house_reviews to authenticated;

drop trigger if exists house_reviews_touch on public.house_reviews;
create trigger house_reviews_touch before update on public.house_reviews
  for each row execute function public.touch_updated_at();

alter table public.house_reviews enable row level security;

-- Everyone reads every review: the whole value is seeing them side by side.
drop policy if exists house_reviews_select on public.house_reviews;
create policy house_reviews_select on public.house_reviews
  for select to authenticated using ( (select public.is_member()) );

-- Author-owned, like the journal. Nobody rewrites your opinion — and the
-- with-check on update stops handing authorship to someone else.
drop policy if exists house_reviews_insert on public.house_reviews;
create policy house_reviews_insert on public.house_reviews
  for insert to authenticated
  with check ( (select public.is_member()) and profile_id = (select auth.uid()) );

drop policy if exists house_reviews_update on public.house_reviews;
create policy house_reviews_update on public.house_reviews
  for update to authenticated
  using      ( profile_id = (select auth.uid()) )
  with check ( profile_id = (select auth.uid()) );

drop policy if exists house_reviews_delete on public.house_reviews;
create policy house_reviews_delete on public.house_reviews
  for delete to authenticated
  using ( profile_id = (select auth.uid()) or (select public.is_organizer()) );
