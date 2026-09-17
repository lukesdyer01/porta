import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Check, Pencil, Users } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { humanizeError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useRsvps } from '../lib/trips'
import type { Rsvp, RsvpStatus } from '../lib/types'

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
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const save = useMutation({
    mutationFn: async (next: RsvpStatus) => {
      if (!profile) throw new Error('Not signed in.')

      // An RSVP is just an answer now — one person, themselves. The headcount
      // columns stay in the table but nobody is asked to fill them in.
      const row = {
        trip_id: tripId,
        profile_id: profile.id,
        status: next,
        adults: next === 'no' ? 0 : 1,
        kids: 0,
      }

      // Upsert rather than branching on whether the cache knows about an
      // existing row: answering twice quickly used to fire a second INSERT and
      // trip the unique constraint.
      const { error } = await supabase
        .from('rsvps')
        .upsert({ ...row, created_by: profile.id }, { onConflict: 'trip_id,profile_id' })
      if (error) {
        throw new Error(
          error.code === '23505'
            ? 'Your answer was already saved — reload if it looks out of date.'
            : error.message,
        )
      }
    },
    onSuccess: () => {
      setError(null)
      setEditing(false)
      void qc.invalidateQueries({ queryKey: ['rsvps', tripId] })
      // Saying yes unlocks the house codes, so that panel has to refetch.
      void qc.invalidateQueries({ queryKey: ['house-info'] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const answered = Boolean(mine && mine.status !== 'pending')
  const showChoices = !past && (!answered || editing)

  const going = rsvps.filter((r) => r.status === 'yes')
  const maybe = rsvps.filter((r) => r.status === 'maybe')
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

      {showChoices && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {CHOICES.map((c) => {
            const active = mine?.status === c.value
            return (
              <button
                key={c.value}
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate(c.value)}
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
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[color:var(--color-sunset-600)]">{error}</p>
      )}

      <div className={past ? 'mt-4' : 'mt-6 border-t border-[color:var(--border)] pt-5'}>
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4" aria-hidden="true" />
          {past ? 'On the trip' : "Who's coming"}
          {going.length > 0 && (
            <span className="font-normal text-[color:var(--text-muted)]">
              &middot; {going.length} {going.length === 1 ? 'person' : 'people'}
            </span>
          )}
        </h4>

        {isLoading && <p className="mt-2 text-sm text-[color:var(--text-muted)]">Loading…</p>}
        {!isLoading && going.length === 0 && maybe.length === 0 && (
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            {past ? 'No answers were recorded for this trip.' : 'Nobody has answered yet.'}
          </p>
        )}

        {going.length > 0 && (
          <p className="mt-2 text-sm">{going.map(name).join(', ')}</p>
        )}

        {maybe.length > 0 && (
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Maybe: {maybe.map(name).join(', ')}
          </p>
        )}
      </div>
    </section>
  )
}
