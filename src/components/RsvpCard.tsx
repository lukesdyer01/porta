import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Check, Pencil, Plus, UserPlus, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { humanizeError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useMembers, useRsvps } from '../lib/trips'
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
  const { profile, isOwner } = useAuth()
  const qc = useQueryClient()
  const { data: rsvps = [], isLoading } = useRsvps(tripId)
  const { data: allMembers = [] } = useMembers()

  const mine = rsvps.find((r) => r.profile_id === profile?.id)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestNote, setGuestNote] = useState('')

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

  // Family who will never log in still belong on the roster. Only the owner
  // may add them, and only as guests — a member's own answer stays theirs.
  const addToRoster = useMutation({
    mutationFn: async (target: { memberId?: string; guestName?: string }) => {
      if (!profile) throw new Error('Not signed in.')
      const { error } = await supabase.from('rsvps').upsert(
        {
          trip_id: tripId,
          profile_id: target.memberId ?? null,
          guest_name: target.memberId ? null : (target.guestName ?? '').trim(),
          status: 'yes',
          adults: 1,
          kids: 0,
          notes: guestNote.trim() || null,
          created_by: profile.id,
        },
        // A member may already have answered no; upserting turns that into the
        // yes being recorded rather than failing on the unique constraint.
        { onConflict: 'trip_id,profile_id' },
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setError(null)
      setGuestName('')
      setGuestNote('')
      void qc.invalidateQueries({ queryKey: ['rsvps', tripId] })
      void qc.invalidateQueries({ queryKey: ['house-info'] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  // Notes get corrected more often than they get written — "arrives Thursday"
  // becomes "arrives Friday" — so they save on blur rather than behind a form.
  const setGuestNoteOn = useMutation({
    mutationFn: async (v: { id: string; note: string }) => {
      const { error } = await supabase
        .from('rsvps')
        .update({ notes: v.note.trim() || null })
        .eq('id', v.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['rsvps', tripId] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const removeGuest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rsvps').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['rsvps', tripId] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  // Members who match what's typed and are not already on the roster.
  const onRoster = new Set(rsvps.map((r) => r.profile_id).filter(Boolean) as string[])
  const query = guestName.trim().toLowerCase()
  const matches =
    query.length >= 2
      ? allMembers
          .filter((m) => !onRoster.has(m.id) && m.display_name.toLowerCase().includes(query))
          .slice(0, 6)
      : []

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

        {going.some((r) => r.profile_id) && (
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {going
              .filter((r) => r.profile_id)
              .map((r) => (
                <li key={r.id}>
                  {name(r)}
                  {/* An answer someone else typed should not read as the
                      person's own. They can change it whenever they like. */}
                  {r.created_by !== r.profile_id && (
                    <span className="ml-1 text-xs text-[color:var(--text-muted)]">
                      (added by {r.adder?.display_name ?? 'someone'})
                    </span>
                  )}
                </li>
              ))}
          </ul>
        )}

        {going.some((r) => !r.profile_id) && (
          <ul className="mt-3 space-y-2">
            {going
              .filter((r) => !r.profile_id)
              .map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-[color:var(--surface-sunk)] px-3 py-2"
                >
                  <span className="text-sm font-medium">{name(r)}</span>
                  <span className="text-xs text-[color:var(--text-muted)]">guest</span>

                  {isOwner && !past ? (
                    <input
                      defaultValue={r.notes ?? ''}
                      placeholder="Add a note"
                      aria-label={`Note about ${name(r)}`}
                      onBlur={(e) => {
                        if (e.target.value !== (r.notes ?? ''))
                          setGuestNoteOn.mutate({ id: r.id, note: e.target.value })
                      }}
                      className="min-w-32 flex-1 rounded-md border border-transparent bg-transparent px-2 py-0.5 text-sm hover:border-[color:var(--border)] focus:border-[color:var(--accent)] focus:bg-[color:var(--surface)] focus:outline-none"
                    />
                  ) : (
                    r.notes && (
                      <span className="min-w-32 flex-1 text-sm text-[color:var(--text-muted)] italic">
                        {r.notes}
                      </span>
                    )
                  )}

                  {isOwner && !past && (
                    <button
                      type="button"
                      onClick={() => removeGuest.mutate(r.id)}
                      aria-label={`Remove ${name(r)}`}
                      className="ml-auto text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}

        {isOwner && !past && (
          <div className="mt-4 border-t border-[color:var(--border)] pt-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <UserPlus className="size-4" aria-hidden="true" />
              Add someone to the roster
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Search family, or type a name"
                aria-label="Search for someone to add"
                className="min-w-44 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <input
                value={guestNote}
                onChange={(e) => setGuestNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Note about this person"
                className="min-w-44 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
              />
            </div>

            {/* Real accounts first: picking one avoids a second copy of
                somebody who is already on the roster under their own name. */}
            {matches.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={addToRoster.isPending}
                      onClick={() => addToRoster.mutate({ memberId: m.id })}
                      className="flex items-center gap-1.5 rounded-full border border-[color:var(--accent)] px-3 py-1 text-sm font-medium text-[color:var(--accent)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-contrast)] disabled:opacity-50"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      {m.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {guestName.trim().length >= 2 && (
              <button
                type="button"
                disabled={addToRoster.isPending}
                onClick={() => addToRoster.mutate({ guestName })}
                className="mt-2 flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)] disabled:opacity-50"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add &ldquo;{guestName.trim()}&rdquo; as a guest instead
              </button>
            )}

            <p className="mt-2 text-xs text-[color:var(--text-muted)]">
              Family with an account are shown above &mdash; pick them rather than typing a name,
              or they end up on the roster twice. They can change whatever you put down.
            </p>
          </div>
        )}

      </div>
    </section>
  )
}
