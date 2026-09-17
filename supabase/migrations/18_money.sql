-- ===========================================================================
-- 18_money.sql — expenses, splits and settling up.
--
-- Money is INTEGER CENTS everywhere. Floats drift, and a split that is a
-- hundredth of a cent off is a split that will not reconcile.
--
-- There is no server, so nothing stops a hand-written REST call from writing
-- splits that do not add up. The deferred constraint triggers below are what
-- actually make that impossible, and save_expense() is the only transaction
-- boundary the browser can get.
-- ===========================================================================

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  payer_id     uuid not null references public.profiles(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  category     public.expense_category not null default 'other',
  description  text not null default '' check (length(description) <= 300),
  incurred_on  date not null default (now() at time zone 'America/Chicago')::date,
  split_method public.split_method not null default 'equal',
  receipt_path text,
  created_by   uuid not null references public.profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists expenses_trip_idx  on public.expenses (trip_id, incurred_on desc);
create index if not exists expenses_payer_idx on public.expenses (payer_id);

-- One row per person the cost lands on. This is what "select which users to
-- split with" means: explicit, per-person, with the amount stored rather than
-- recomputed.
create table if not exists public.expense_splits (
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete restrict,
  share_cents integer not null check (share_cents >= 0),
  weight      numeric(6,3) not null default 1,
  primary key (expense_id, profile_id)
);

create index if not exists expense_splits_profile_idx on public.expense_splits (profile_id);

-- Cash that actually changed hands, so balances can be zeroed out.
create table if not exists public.settlements (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  from_profile_id uuid not null references public.profiles(id) on delete restrict,
  to_profile_id   uuid not null references public.profiles(id) on delete restrict,
  amount_cents    integer not null check (amount_cents > 0),
  settled_on      date not null default (now() at time zone 'America/Chicago')::date,
  method          text,
  note            text,
  created_by      uuid not null references public.profiles(id) on delete restrict,
  created_at      timestamptz not null default now(),
  constraint settlement_distinct_parties check (from_profile_id <> to_profile_id)
);

create index if not exists settlements_trip_idx on public.settlements (trip_id);

grant select, insert, update, delete on public.expenses       to authenticated;
grant select, insert, update, delete on public.expense_splits to authenticated;
grant select, insert, update, delete on public.settlements    to authenticated;

drop trigger if exists expenses_touch on public.expenses;
create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The invariant: an expense's splits always sum to its amount.
--
-- DEFERRABLE INITIALLY DEFERRED so the check runs at COMMIT — otherwise
-- rewriting a split set would trip halfway through, when the rows are
-- momentarily inconsistent by design.
-- ---------------------------------------------------------------------------
create or replace function public.assert_split_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense uuid := coalesce(new.expense_id, old.expense_id);
  v_amount  integer;
  v_sum     integer;
begin
  select amount_cents into v_amount from public.expenses where id = v_expense;
  if v_amount is null then return null; end if;  -- parent deleted; cascade in flight

  select coalesce(sum(share_cents), 0) into v_sum
    from public.expense_splits where expense_id = v_expense;

  if v_sum <> v_amount then
    raise exception 'Splits add up to %c but the expense is %c', v_sum, v_amount
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists expense_splits_total_check on public.expense_splits;
create constraint trigger expense_splits_total_check
  after insert or update or delete on public.expense_splits
  deferrable initially deferred
  for each row execute function public.assert_split_total();

create or replace function public.assert_expense_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_sum integer;
begin
  select coalesce(sum(share_cents), 0) into v_sum
    from public.expense_splits where expense_id = new.id;
  if v_sum <> new.amount_cents then
    raise exception 'The amount was changed to %c but the splits add up to %c',
      new.amount_cents, v_sum using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists expenses_total_check on public.expenses;
create constraint trigger expenses_total_check
  after insert or update of amount_cents on public.expenses
  deferrable initially deferred
  for each row execute function public.assert_expense_total();

-- ---------------------------------------------------------------------------
-- RLS. Collaborative for logistics, payer-owned for money: nobody edits the
-- receipt you paid for.
-- ---------------------------------------------------------------------------
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements    enable row level security;

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check ( (select public.is_member()) and created_by = (select auth.uid()) );

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update to authenticated
  using      ( payer_id = (select auth.uid()) or created_by = (select auth.uid())
               or (select public.is_organizer()) )
  with check ( payer_id = (select auth.uid()) or created_by = (select auth.uid())
               or (select public.is_organizer()) );

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete to authenticated
  using ( payer_id = (select auth.uid()) or created_by = (select auth.uid())
          or (select public.is_organizer()) );

drop policy if exists splits_select on public.expense_splits;
create policy splits_select on public.expense_splits
  for select to authenticated using ( (select public.is_member()) );

-- Splits inherit the parent expense's permissions.
drop policy if exists splits_write on public.expense_splits;
create policy splits_write on public.expense_splits
  for all to authenticated
  using ( exists (select 1 from public.expenses e
                   where e.id = expense_splits.expense_id
                     and ( e.payer_id = (select auth.uid())
                           or e.created_by = (select auth.uid())
                           or (select public.is_organizer()) )) )
  with check ( exists (select 1 from public.expenses e
                        where e.id = expense_splits.expense_id
                          and ( e.payer_id = (select auth.uid())
                                or e.created_by = (select auth.uid())
                                or (select public.is_organizer()) )) );

drop policy if exists settlements_select on public.settlements;
create policy settlements_select on public.settlements
  for select to authenticated using ( (select public.is_member()) );

drop policy if exists settlements_insert on public.settlements;
create policy settlements_insert on public.settlements
  for insert to authenticated
  with check ( (select public.is_member()) and created_by = (select auth.uid())
               and ( from_profile_id = (select auth.uid())
                     or to_profile_id = (select auth.uid())
                     or (select public.is_organizer()) ) );

drop policy if exists settlements_delete on public.settlements;
create policy settlements_delete on public.settlements
  for delete to authenticated
  using ( from_profile_id = (select auth.uid()) or to_profile_id = (select auth.uid())
          or (select public.is_organizer()) );
