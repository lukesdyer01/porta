-- ===========================================================================
-- 19_balances.sql — saving an expense atomically, and who owes whom.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- An expense and its splits must land together or not at all. The browser has
-- no transaction, so a crash between the two writes would leave an expense
-- whose splits do not add up — which the deferred trigger would then reject on
-- every later edit. This function is the transaction.
--
-- SECURITY INVOKER on purpose: RLS still applies to every statement inside, so
-- this grants no privilege the caller did not already have.
-- ---------------------------------------------------------------------------
create or replace function public.save_expense(
  p_expense jsonb,
  p_splits  jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id  uuid;
  v_sum integer;
  v_amt integer := (p_expense->>'amount_cents')::integer;
begin
  if p_splits is null or jsonb_array_length(p_splits) = 0 then
    raise exception 'Choose at least one person to split this with'
      using errcode = 'check_violation';
  end if;

  select coalesce(sum((s->>'share_cents')::integer), 0) into v_sum
    from jsonb_array_elements(p_splits) s;

  -- Say this plainly here; the deferred trigger's message is for developers.
  if v_sum <> v_amt then
    raise exception 'The shares add up to $%, but the expense is $%',
      to_char(v_sum / 100.0, 'FM999999990.00'), to_char(v_amt / 100.0, 'FM999999990.00')
      using errcode = 'check_violation';
  end if;

  insert into public.expenses as e
    (id, trip_id, payer_id, amount_cents, category, description,
     incurred_on, split_method, receipt_path, created_by)
  select
    coalesce((p_expense->>'id')::uuid, gen_random_uuid()),
    (p_expense->>'trip_id')::uuid,
    (p_expense->>'payer_id')::uuid,
    v_amt,
    coalesce((p_expense->>'category')::public.expense_category, 'other'),
    coalesce(p_expense->>'description', ''),
    coalesce((p_expense->>'incurred_on')::date, current_date),
    coalesce((p_expense->>'split_method')::public.split_method, 'equal'),
    nullif(p_expense->>'receipt_path', ''),
    auth.uid()
  on conflict (id) do update set
    payer_id     = excluded.payer_id,
    amount_cents = excluded.amount_cents,
    category     = excluded.category,
    description  = excluded.description,
    incurred_on  = excluded.incurred_on,
    split_method = excluded.split_method,
    receipt_path = excluded.receipt_path
  returning e.id into v_id;

  -- RLS filtered the row out rather than erroring: the caller may not edit it.
  if v_id is null then
    raise exception 'You can only edit an expense you paid for or entered'
      using errcode = '42501';
  end if;

  delete from public.expense_splits where expense_id = v_id;

  insert into public.expense_splits (expense_id, profile_id, share_cents, weight)
  select v_id,
         (s->>'profile_id')::uuid,
         (s->>'share_cents')::integer,
         coalesce((s->>'weight')::numeric, 1)
  from jsonb_array_elements(p_splits) s;

  return v_id;  -- deferred checks fire here, at COMMIT
end;
$$;

revoke execute on function public.save_expense(jsonb, jsonb) from public, anon;
grant   execute on function public.save_expense(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Balances.
--
-- security_invoker = true is NOT optional. A view runs as its OWNER by
-- default, and the owner bypasses RLS — a plain view over expenses would be a
-- data leak wearing a disguise.
-- ---------------------------------------------------------------------------
drop view if exists public.trip_balances;
create view public.trip_balances
with (security_invoker = true) as
with paid as (
  select trip_id, payer_id as profile_id, sum(amount_cents)::bigint as cents
    from public.expenses group by 1, 2
),
owed as (
  select e.trip_id, s.profile_id, sum(s.share_cents)::bigint as cents
    from public.expense_splits s
    join public.expenses e on e.id = s.expense_id
   group by 1, 2
),
sent as (
  select trip_id, from_profile_id as profile_id, sum(amount_cents)::bigint as cents
    from public.settlements group by 1, 2
),
received as (
  select trip_id, to_profile_id as profile_id, sum(amount_cents)::bigint as cents
    from public.settlements group by 1, 2
),
keys as (
  select trip_id, profile_id from paid
  union select trip_id, profile_id from owed
  union select trip_id, profile_id from sent
  union select trip_id, profile_id from received
)
select
  k.trip_id,
  k.profile_id,
  coalesce(p.cents, 0) as paid_cents,
  coalesce(o.cents, 0) as owed_cents,
  -- Positive: the group owes them. Negative: they owe the group.
  -- Handing over cash settles your debt, so it counts like paying.
  ( coalesce(p.cents,0) - coalesce(o.cents,0)
    + coalesce(s.cents,0) - coalesce(r.cents,0) )::bigint as net_cents
from keys k
left join paid     p using (trip_id, profile_id)
left join owed     o using (trip_id, profile_id)
left join sent     s using (trip_id, profile_id)
left join received r using (trip_id, profile_id);

revoke all on public.trip_balances from public, anon;
grant select on public.trip_balances to authenticated;
