-- ===========================================================================
-- 21_avatars.sql — profile pictures.
--
-- Same bucket as photos, under avatars/{user_id}/. The existing insert policy
-- only allows the trips/ prefix, so avatars need their own rule: you may write
-- inside your own folder and nobody else's.
-- ===========================================================================

drop policy if exists "avatars insert" on storage.objects;
create policy "avatars insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (select public.is_member())
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and owner_id = (select auth.uid())::text
  );

drop policy if exists "avatars modify" on storage.objects;
create policy "avatars modify" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists "avatars remove" on storage.objects;
create policy "avatars remove" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
