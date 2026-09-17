-- ===========================================================================
-- 28_photo_thumbs.sql — a small copy for the grid.
--
-- The gallery downloaded full-size images to draw them as squares a couple of
-- hundred pixels wide, so opening the page pulled megabytes to show thumbnails.
-- Uploads now store a second, small file and the grid uses that; the lightbox
-- still loads the full one.
--
-- Nullable on purpose: photos uploaded before this have no thumbnail and the
-- grid falls back to the full image rather than showing nothing.
-- ===========================================================================

alter table public.photos
  add column if not exists thumb_path text;
