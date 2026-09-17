import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import EventComments from '../components/EventComments'
import EventForm from '../components/EventForm'
import { btnGhost } from '../components/TripForm'
import { supabase } from '../lib/supabase'
import { dayLabel, timeLabel, useEvents } from '../lib/trips'
import type { EventKind, TripEvent } from '../lib/types'
import { usePageTitle } from '../lib/usePageTitle'
import { humanizeError } from '../lib/errors'
import { useTripContext } from '../trip/useTrip'

const KIND_STYLE: Record<EventKind, string> = {
  activity: 'bg-[color:var(--color-gulf-100)] text-[color:var(--color-gulf-700)]',
  travel: 'bg-[color:var(--color-sand-200)] text-[color:var(--color-ink-700)]',
  birthday: 'bg-[color:var(--color-sunset-300)]/40 text-[color:var(--color-sunset-600)]',
  reminder: 'bg-[color:var(--color-sand-200)] text-[color:var(--color-ink-700)]',
  chore: 'bg-[color:var(--color-sand-200)] text-[color:var(--color-ink-700)]',
  other: 'bg-[color:var(--color-sand-200)] text-[color:var(--color-ink-700)]',
}

export default function Calendar() {
  usePageTitle('Calendar')
  const { isOrganizer } = useAuth()
  const qc = useQueryClient()
  const { trip } = useTripContext()
  const { data: events = [], isLoading } = useEvents(trip?.id)

  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['events', trip?.id] })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void refresh(),
    onError: (e: Error) => setError(humanizeError(e)),
  })

  if (!trip) return <p className="text-sm text-[color:var(--text-muted)]">No trip yet.</p>

  // Agenda view: group by day. A month grid is mostly empty cells for a week
  // in one house, and unreadable on the phone this gets used on.
  const byDay = new Map<string, TripEvent[]>()
  for (const e of events) byDay.set(e.event_date, [...(byDay.get(e.event_date) ?? []), e])
  const days = [...byDay.keys()].sort()

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
          <CalendarDays className="size-5" aria-hidden="true" />
          What&rsquo;s happening
        </h2>
        {isOrganizer && (
          <button onClick={() => setAdding((v) => !v)} className={`ml-auto ${btnGhost}`}>
            <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
            Add
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        Everything that isn&rsquo;t dinner.{' '}
        {isOrganizer
          ? 'You can add and change these; everyone else can read and comment.'
          : 'An organizer sets these up — anyone can comment.'}
      </p>

      {adding && (
        <div className="mt-5 card p-5">
          <EventForm
            tripId={trip.id}
            defaultDate={trip.start_date}
            onDone={() => setAdding(false)}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {isLoading && <p className="mt-5 text-sm text-[color:var(--text-muted)]">Loading…</p>}
      {!isLoading && days.length === 0 && !adding && (
        <p className="mt-5 rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          Nothing on the calendar yet.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {days.map((d) => (
          <section key={d}>
            <h3 className="font-display text-sm font-semibold tracking-wide text-[color:var(--text-muted)] uppercase">
              {dayLabel(d)}
            </h3>
            <ul className="mt-2 divide-y divide-[color:var(--border)] card">
              {byDay.get(d)!.map((e) =>
                editingId === e.id ? (
                  <li key={e.id} className="p-4">
                    <EventForm tripId={trip.id} event={e} onDone={() => setEditingId(null)} />
                  </li>
                ) : (
                <li key={e.id} className="p-4">
                  {/* The comment thread is a sibling of this row rather than a
                      child of the text column. Nested inside it, the reply box
                      was sharing about 180px with a send button on a phone. */}
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium tracking-wide text-[color:var(--text-muted)] uppercase">
                        {e.all_day || !e.start_time
                          ? 'All day'
                          : `${timeLabel(e.start_time)}${e.end_time ? `–${timeLabel(e.end_time)}` : ''}`}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 font-medium">
                        {e.title}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_STYLE[e.kind]}`}>
                          {e.kind}
                        </span>
                      </p>
                      {e.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-[color:var(--text-muted)]">
                          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                          {e.location}
                        </p>
                      )}
                      {e.description && (
                        <p className="mt-1 text-sm whitespace-pre-wrap text-[color:var(--text-muted)]">
                          {e.description}
                        </p>
                      )}
                    </div>

                    {isOrganizer && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => {
                            setAdding(false)
                            setEditingId(e.id)
                          }}
                          aria-label={`Edit ${e.title}`}
                          className="grid size-8 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)]"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Remove "${e.title}"?`)) remove.mutate(e.id) }}
                          aria-label={`Remove ${e.title}`}
                          className="grid size-8 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)]"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>

                  <EventComments eventId={e.id} />
                </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
