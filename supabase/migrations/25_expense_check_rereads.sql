-- ===========================================================================
-- 25_expense_check_rereads.sql — make the deferred amount check read current
-- state instead of the row it was queued with.
--
-- assert_expense_total compared `new.amount_cents` against the splits. A
-- deferred trigger captures `new` when it is QUEUED but runs its body at
-- COMMIT, so editing an expense twice inside one transaction compared the
-- first amount against the final splits and failed on a perfectly valid edit.
--
-- Each REST call is its own transaction today, so this did not fire in the
-- app — but it is a false failure waiting for anything that batches, and a
-- check that reads stale state is not really checking the invariant.
-- Re-reading the row makes it hold whatever order the writes arrive in.
-- ===========================================================================

create or replace function public.assert_expense_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount integer;
  v_sum    integer;
begin
  -- Read the row as it stands now, not as it was when this was queued.
  select amount_cents into v_amount from public.expenses where id = new.id;
  if v_amount is null then return null; end if;  -- deleted since; cascade handles it

  select coalesce(sum(share_cents), 0) into v_sum
    from public.expense_splits where expense_id = new.id;

  if v_sum <> v_amount then
    raise exception 'The expense is %c but the shares add up to %c', v_amount, v_sum
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;
