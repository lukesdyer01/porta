import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Check, Pencil, Users } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabase'
import { dateRange, useRsvps } from '../lib/trips'
import type { Rsvp, RsvpStatus } from '../lib/types'
import { btnPrimary, fieldClass, labelClass } from './TripForm'
import { humanizeError } from '../lib/errors'

const CHOICES: { value: RsvpStatus; label: string }[] = [
  { value: 'yes', label: "I'm in" },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Not this year' },
]

const ANSWERED: Record<string, string> = {
  yes: "You're in",
  maybe: "You're a maybe",
  no: "You're out this year",
}

export default function RsvpCard({ tripId, past = false }: { tripId: string; past?: boolean }) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const { data: rsvps = [], isLoading } = useRsvps(tripId)

  const mine = rsvps.find((r) => r.profile_id === profile?.id)
  const [status, setStatus] = useState<RsvpStatus>('pending')
  const [adults, setAdults] = useState('1')
  const [kids, setKids] = useState('0')
  const [arrival, setArrival] = useState('')
  const [departure, setDeparture] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Once you've answered, the form collapses to a summary until you ask for
  // it back — there is nothing left to do with it and it crowds the roster.
  const [editing, setEditing] = useState(false)

  // Seed the form once the saved RSVP arrives. Adjusting during render rather
  // than in an effect: React re-runs this component immediately without
  // painting the stale values first, and it cannot loop because `seeded`
  // advances to the row id.
  const [seeded, setSeeded] = useState<string | null>(null)
  if (mine && seeded !== mine.id) {
    setSeeded(mine.id)
    setStatus(mine.status)
    setAdults(String(mine.adults))
    setKids(String(mine.kids))
    setArrival(mine.arrival_date ?? '')
    setDeparture(mine.departure_date ?? '')
    setNotes(mine.notes ?? '')
  }

  const save = useMutation({
    mutationFn: async ({ next }: { next: RsvpStatus; done: boolean }) => {
      if (!profile) throw new Error('Not signed in.')
      if (arrival && departure && departure < arrival)
        throw new Error('Your leave date is before your arrive date.')

      const row = {
        trip_id: tripId,
        profile_id: profile.id,
        status: next,
        // Someone who isn't coming shouldn't keep padding the headcount.
        adults: next === 'no' ? 0 : Number(adults || 0),
        kids: next === 'no' ? 0 : Number(kids || 0),
        arrival_date: arrival || null,
        departure_date: departure || null,
        notes: notes.trim() || null,
      }

      // Upsert rather than branching on whether the cache happens to know
      // about an existing row: changing your answer twice quickly used to fire
      // a second INSERT and trip the unique constraint.
      const { error } = await supabase
        .from('rsvps')
        .upsert({ ...row, created_by: profile.id }, { onConflict: 'trip_id,profile_id' })
      if (error) {
        throw new Error(
          error.code === '23505'
            ? 'Your RSVP was already saved — reload if it looks out of date.'
            : error.message,
        )
      }
    },
    onSuccess: (_data, v) => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['rsvps', tripId] })
      // Saying yes unlocks the house codes, so that panel has to refetch.
      void qc.invalidateQueries({ queryKey: ['house-info'] })
      // Picking "I'm in" still needs headcount and dates, so only collapse
      // once the answer is actually complete.
      if (v.done) setEditing(false)
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const answered = Boolean(mine && mine.status !== 'pending')
  const showForm = !past && (!answered || editing)

  const going = rsvps.filter((r) => r.status === 'yes')
  const maybe = rsvps.filter((r) => r.status === 'maybe')
  const heads = going.reduce((s, r) => s + r.headcount, 0)

  const name = (r: Rsvp) => r.guest_name ?? r.profile?.display_name ?? 'Someone'

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
      <h3 className="flex items-center gap-2 font-medium">
        <CalendarCheck className="size-4" aria-hidden="true" />
        {past ? 'Who came' : 'Are you coming?'}
      </h3>

      {!past && answered && !editing && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3">
          <Check className="size-4 shrink-0 text-[color:var(--accent)]" aria-hidden="true" />
          <span className="font-medium">{ANSWERED[mine!.status] ?? 'Answered'}</span>
          {mine!.status !== 'no' && (
            <span className="text-sm text-[color:var(--text-muted)]">
              {mine!.headcount} {mine!.headcount === 1 ? 'person' : 'people'}
              {dateRange(mine!.arrival_date, mine!.departure_date)
                ? ` · ${dateRange(mine!.arrival_date, mine!.departure_date)}`
                : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Change
          </button>
        </div>
      )}

      {showForm && (
      <div className="mt-3 flex flex-wrap gap-2">
        {CHOICES.map((c) => {
          const active = status === c.value
          return (
            <button
              key={c.value}
              type="button"
              disabled={save.isPending}
              onClick={() => {
                setStatus(c.value)
                // "Not this year" needs no further detail, so it completes here.
                save.mutate({ next: c.value, done: c.value === 'no' })
              }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                active
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                  : 'border-[color:var(--border)] hover:bg-[color:var(--surface-sunk)]'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>
      )}

      {showForm && status !== 'no' && status !== 'pending' && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="adults" className={labelClass}>Adults</label>
              <input id="adults" inputMode="numeric" value={adults}
                onChange={(e) => setAdults(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className={`mt-1.5 ${fieldClass}`} />
            </div>
            <div>
              <label htmlFor="kids" className={labelClass}>Kids</label>
              <input id="kids" inputMode="numeric" value={kids}
                onChange={(e) => setKids(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className={`mt-1.5 ${fieldClass}`} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="arr" className={labelClass}>Arrive</label>
              <input id="arr" type="date" value={arrival} onChange={(e) => setArrival(e.target.value)}
                className={`mt-1.5 ${fieldClass}`} />
            </div>
            <div>
              <label htmlFor="dep" className={labelClass}>Leave</label>
              <input id="dep" type="date" value={departure} onChange={(e) => setDeparture(e.target.value)}
                className={`mt-1.5 ${fieldClass}`} />
            </div>
          </div>
          <div>
            <label htmlFor="rnotes" className={labelClass}>
              Notes <span className="font-normal text-[color:var(--text-muted)]">(optional)</span>
            </label>
            <input id="rnotes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Driving down Saturday, bringing the smoker" className={`mt-1.5 ${fieldClass}`} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => save.mutate({ next: status, done: true })}
              disabled={save.isPending}
              className={btnPrimary}
            >
              {save.isPending ? 'Saving…' : answered ? 'Save changes' : 'Save my details'}
            </button>
            {answered && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-[color:var(--color-sunset-600)]">{error}</p>}

      {/* ---- roster ---- */}
      <div className={past ? 'mt-4' : 'mt-6 border-t border-[color:var(--border)] pt-5'}>
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4" aria-hidden="true" />
          {past ? 'On the trip' : "Who's coming"}
          {heads > 0 && (
            <span className="font-normal text-[color:var(--text-muted)]">
              &middot; {heads} {heads === 1 ? 'person' : 'people'}
            </span>
          )}
        </h4>

        {isLoading && <p className="mt-2 text-sm text-[color:var(--text-muted)]">Loading…</p>}
        {!isLoading && going.length === 0 && maybe.length === 0 && (
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            {past ? 'No RSVPs were recorded for this trip.' : 'Nobody has RSVP’d yet.'}
          </p>
        )}

        {going.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {going.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{name(r)}</span>
                <span className="text-[color:var(--text-muted)]">
                  {r.headcount} {r.headcount === 1 ? 'person' : 'people'}
                  {r.kids > 0 ? ` (${r.adults} adult${r.adults === 1 ? '' : 's'}, ${r.kids} kid${r.kids === 1 ? '' : 's'})` : ''}
                  {dateRange(r.arrival_date, r.departure_date) ? ` · ${dateRange(r.arrival_date, r.departure_date)}` : ''}
                </span>
                {r.notes && <span className="w-full text-[color:var(--text-muted)] italic">{r.notes}</span>}
              </li>
            ))}
          </ul>
        )}

        {maybe.length > 0 && (
          <p className="mt-3 text-sm text-[color:var(--text-muted)]">
            Maybe: {maybe.map(name).join(', ')}
          </p>
        )}
      </div>
    </section>
  )
}
