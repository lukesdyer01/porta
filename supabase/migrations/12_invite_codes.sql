-- ===========================================================================
-- 12_invite_codes.sql — self-serve signup with a shared family code.
--
-- Restores what 08 added and 10 removed, with one change: codes are managed
-- from the Members screen rather than seeded by hand in SQL.
--
-- A redeemed code writes the new address into allowed_emails, so this adds
-- convenience without giving up per-person control — revoking someone stays a
-- one-row delete, and there is a record of who joined with which code.
-- ===========================================================================

create table if not exists public.invite_codes (
  code       text primary key
               check (code = lower(code) and length(code) between 4 and 64),
  label      text,
  active     boolean not null default true,
  expires_at timestamptz,
  max_uses   integer check (max_uses is null or max_uses > 0),
  uses       integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.invite_codes to authenticated;
alter table public.invite_codes enable row level security;

-- Organizers only. A member has no reason to read the codes out of the API,
-- and anon must never reach them.
drop policy if exists invite_codes_all on public.invite_codes;
create policy invite_codes_all on public.invite_codes
  for all to authenticated
  using      ( (select public.is_organizer()) )
  with check ( (select public.is_organizer()) );

-- ---------------------------------------------------------------------------
-- The signup gate.
--
-- VOLATILE, not STABLE: it writes — it bumps the use counter and records the
-- new member. Marking it stable makes those writes fail.
--
-- The payload exposes the client's metadata as `user_metadata`. The column it
-- eventually lands in is raw_user_meta_data, which is the wrong name to read
-- here; this was verified against a real Before User Created payload.
-- ---------------------------------------------------------------------------
create or replace function public.hook_restrict_signup(event jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
  v_code  text := lower(btrim(coalesce(
                    event -> 'user' -> 'user_metadata' ->> 'invite_code', '')));
begin
  if v_email = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400, 'message', 'We need an email address to sign you in.'));
  end if;

  -- Already invited by address, or joined with a code previously.
  if exists (select 1 from public.allowed_emails a where a.email = v_email) then
    return '{}'::jsonb;
  end if;

  if v_code = '' then
    -- The sign-in screen watches for this marker to reveal the code field, so
    -- returning members never have to see it.
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'NEEDS_CODE: Enter the family code to join. Ask Luke if you do not have it.'));
  end if;

  -- One statement covers validity, expiry, the use cap and the increment, so
  -- two people redeeming the last use at once cannot both succeed.
  update public.invite_codes
     set uses = uses + 1
   where code = v_code
     and active
     and (expires_at is null or expires_at > now())
     and (max_uses is null or uses < max_uses);

  if not found then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'That family code is not right. Check with Luke.'));
  end if;

  insert into public.allowed_emails (email, note)
  values (v_email, 'joined with code: ' || v_code)
  on conflict (email) do nothing;

  return '{}'::jsonb;
end;
$$;

grant  execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup(jsonb) from authenticated, anon, public;
