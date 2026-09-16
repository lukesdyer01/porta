-- ===========================================================================
-- 10_remove_invite_codes.sql — back to invite-by-email only.
--
-- Self-serve signup with a shared code is removed. The email allowlist is the
-- sole way in: an address is either on it or it is not. Fewer moving parts,
-- and no shared secret to leak, screenshot or rotate.
-- ===========================================================================

drop table if exists public.invite_codes;

create or replace function public.hook_restrict_signup(event jsonb)
returns jsonb
language plpgsql
stable                      -- allowlist-only: this no longer writes anything
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message',   'We need an email address to sign you in.'));
  end if;

  if exists (select 1 from public.allowed_emails a where a.email = v_email) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message',   'This site is invite-only. Ask Luke to add your email address.'));
end;
$$;

grant  execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup(jsonb) from authenticated, anon, public;
