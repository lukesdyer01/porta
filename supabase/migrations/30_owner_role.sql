-- ===========================================================================
-- 30_owner_role.sql — a tier above organizer.
--
-- Split from the migration that uses it on purpose: Postgres allows adding an
-- enum value inside a transaction but will not let the same transaction USE
-- it, and every migration runs in one. The value has to land and commit first.
-- ===========================================================================

alter type public.member_role add value if not exists 'owner';
