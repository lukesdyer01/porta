-- ===========================================================================
-- 17_rsvp_upsert.sql — let an RSVP be saved without a read-then-write race.
--
-- The client decided insert-vs-update from whatever the query cache held, so
-- changing your answer before the refetch landed tried a second INSERT and hit
--   duplicate key value violates unique constraint "rsvps_one_per_member"
--
-- An upsert removes the race, but ON CONFLICT cannot target a PARTIAL unique
-- index without repeating its predicate, which PostgREST has no way to send.
-- A plain unique constraint behaves identically here: Postgres treats NULLs as
-- distinct by default, so guest rows (profile_id IS NULL) still never collide
-- with each other.
-- ===========================================================================

drop index if exists public.rsvps_one_per_member;

alter table public.rsvps
  drop constraint if exists rsvps_one_per_member;

alter table public.rsvps
  add constraint rsvps_one_per_member unique (trip_id, profile_id);
