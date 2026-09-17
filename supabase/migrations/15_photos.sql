-- ===========================================================================
-- 15_photos.sql — image storage, starting with the house photo.
--
-- The bucket is PRIVATE and read through signed URLs. A public bucket would be
-- a permanent unauthenticated link to the family's photos, guessable or not.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos', 'photos', false, 26214400,
  array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid references public.trips(id) on delete cascade,
  house_id     uuid references public.houses(id) on delete cascade,
  kind         public.photo_kind not null default 'trip',
  storage_path text not null unique,
  caption      text,
  -- Stored at upload so the grid can reserve space and not jump as images
  -- load; there is no server to probe dimensions later.
  width        integer,
  height       integer,
  bytes        integer,
  sort_order   smallint not null default 0,
  uploaded_by  uuid not null references public.profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  constraint photos_has_owner check (trip_id is not null or house_id is not null)
);

create index if not exists photos_house_idx on public.photos (house_id, sort_order)
  where house_id is not null;
create index if not exists photos_trip_idx on public.photos (trip_id, sort_order, created_at desc);

grant select, insert, update, delete on public.photos to authenticated;
alter table public.photos enable row level security;

-- House photos are just a picture of the house, so every member sees them.
-- Deliberately NOT gated on RSVP the way the door codes are.
drop policy if exists photos_select on public.photos;
create policy photos_select on public.photos
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists photos_insert on public.photos;
create policy photos_insert on public.photos
  for insert to authenticated
  with check ( (select public.is_member()) and uploaded_by = (select auth.uid()) );

drop policy if exists photos_update on public.photos;
create policy photos_update on public.photos
  for update to authenticated
  using      ( uploaded_by = (select auth.uid()) or (select public.is_organizer()) )
  with check ( uploaded_by = (select auth.uid()) or (select public.is_organizer()) );

drop policy if exists photos_delete on public.photos;
create policy photos_delete on public.photos
  for delete to authenticated
  using ( uploaded_by = (select auth.uid()) or (select public.is_organizer()) );

-- ---------------------------------------------------------------------------
-- Storage object policies. Paths look like:
--   trips/{trip_id}/houses/{house_id}/{uuid}.webp
-- ---------------------------------------------------------------------------
drop policy if exists "photos read"   on storage.objects;
drop policy if exists "photos insert" on storage.objects;
drop policy if exists "photos update" on storage.objects;
drop policy if exists "photos delete" on storage.objects;

create policy "photos read" on storage.objects
  for select to authenticated
  using ( bucket_id = 'photos' and (select public.is_member()) );

create policy "photos insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (select public.is_member())
    and (storage.foldername(name))[1] = 'trips'
    and owner_id = (select auth.uid())::text
  );

create policy "photos update" on storage.objects
  for update to authenticated
  using      ( bucket_id = 'photos'
               and (owner_id = (select auth.uid())::text or (select public.is_organizer())) )
  with check ( bucket_id = 'photos'
               and (owner_id = (select auth.uid())::text or (select public.is_organizer())) );

create policy "photos delete" on storage.objects
  for delete to authenticated
  using ( bucket_id = 'photos'
          and (owner_id = (select auth.uid())::text or (select public.is_organizer())) );
