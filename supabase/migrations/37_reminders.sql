-- ===========================================================================
-- 37_reminders.sql — remember what has already been emailed.
--
-- The job runs every morning. Without a record of what went out, "the trip
-- starts in a week" would land in everyone's inbox every day for a week.
--
-- ref_date is what the reminder is ABOUT, not when it was sent: the trip's
-- start date for the RSVP and countdown nudges, the night in question for a
-- cooking reminder. That makes the unique constraint the whole dedupe rule.
-- ===========================================================================

create table if not exists public.reminders_sent (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  kind            text not null check (kind in ('rsvp', 'cooking', 'starts_soon')),
  recipient_email text not null,
  ref_date        date not null,
  sent_at         timestamptz not null default now(),
  unique (trip_id, kind, recipient_email, ref_date)
);

create index if not exists reminders_sent_trip_idx on public.reminders_sent (trip_id, kind);

-- RLS on with NO policies: this holds email addresses and only the scheduled
-- job, running as service_role, has any business reading or writing it.
-- service_role bypasses RLS; everybody else is refused by default.
alter table public.reminders_sent enable row level security;
revoke all on public.reminders_sent from anon, authenticated;
