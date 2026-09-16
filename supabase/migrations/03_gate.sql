-- ===========================================================================
-- 03_gate.sql — refuse signup for anyone not on the invite list.
--
-- This is the second of two layers. RLS (`is_active`) is what actually protects
-- the data; this hook simply stops junk auth.users rows from being created at
-- all, which keeps the account list clean and avoids burning the email quota on
-- strangers.
--
-- MANUAL STEP: register this in the Supabase dashboard under
--   Authentication -> Hooks -> Before User Created
-- The SQL alone does nothing until that hook is pointed at it.
-- ===========================================================================

create or replace function public.hook_restrict_signup(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(event -> 'user' ->> 'email');
begin
  if exists (select 1 from public.allowed_emails a where a.email = v_email) then
    return '{}'::jsonb;  -- empty object == allow
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message',   'This site is invite-only. Ask Luke to add your email address.'
    )
  );
end;
$$;

grant  execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup(jsonb) from authenticated, anon, public;
