import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPin, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import EventComments from '../components/EventComments'
import { btnGhost, btnPrimary, fieldClass, labelClass } from '../components/TripForm'
import { supabase } from '../lib/supabase'
import { dayLabel, timeLabel, useEvents } from '../lib/trips'
import type { EventKind, TripEvent } from '../lib/types'
import { usePageTitle } from '../lib/usePageTitle'
import { humanizeError } from '../lib/errors'
import { useTripContext } from '../trip/useTrip'

const KINDS: EventKind[] = ['activity', 'travel', 'birthday', 'reminder', 'chore', 'other']

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
  const { profile } = useAuth()
  const qc = useQueryClient()
  const { trip } = useTripContext()
  const { data: events = [], isLoading } = useEvents(trip?.id)

  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({
    title: '',
    event_date: trip?.start_date ?? '',
    start_time: '',
    end_time: '',
    kind: 'activity' as EventKind,
    location: '',
    description: '',
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }))

  const refresh = () => qc.invalidateQueries({ queryKey: ['events', trip?.id] })

  const add = useMutation({
    mutationFn: async () => {
      if (!trip || !profile) throw new Error('Not ready.')
      if (!f.title.trim()) throw new Error('Give it a title.')
      if (!f.event_date) throw new Error('Pick a date.')
      if (f.start_time && f.end_time && f.end_time < f.start_time)
        throw new Error('The end time is before the start time.')

      const { error } = await supabase.from('events').insert({
        trip_id: trip.id,
        title: f.title.trim(),
        event_date: f.event_date,
        start_time: f.start_time || null,
        end_time: f.end_time || null,
        all_day: !f.start_time,
        kind: f.kind,
        location: f.location.trim() || null,
        description: f.description.trim() || null,
        created_by: profile.id,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setError(null)
      setAdding(false)
      setF((p) => ({ ...p, title: '', start_time: '', end_time: '', location: '', description: '' }))
      void refresh()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

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
        <button onClick={() => setAdding((v) => !v)} className={`ml-auto ${btnGhost}`}>
          <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
          Add
        </button>
      </div>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        Everything that isn&rsquo;t dinner. Anyone can add or change anything here.
      </p>

      {adding && (
        <div className="mt-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
          <div className="space-y-4">
            <div>
              <label htmlFor="etitle" className={labelClass}>What is it?</label>
              <input id="etitle" value={f.title} onChange={set('title')}
                placeholder="Deep sea fishing charter" className={`mt-1.5 ${fieldClass}`} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="edate" className={labelClass}>Date</label>
                <input id="edate" type="date" value={f.event_date} onChange={set('event_date')}
                  className={`mt-1.5 ${fieldClass}`} />
              </div>
              <div>
                <label htmlFor="estart" className={labelClass}>Start</label>
                <input id="estart" type="time" value={f.start_time} onChange={set('start_time')}
                  className={`mt-1.5 ${fieldClass}`} />
              </div>
              <div>
                <label htmlFor="eend" className={labelClass}>End</label>
                <input id="eend" type="time" value={f.end_time} onChange={set('end_time')}
                  className={`mt-1.5 ${fieldClass}`} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ekind" className={labelClass}>Type</label>
                <select id="ekind" value={f.kind}
                  onChange={(e) => setF((p) => ({ ...p, kind: e.target.value as EventKind }))}
                  className={`mt-1.5 ${fieldClass}`}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="eloc" className={labelClass}>Where</label>
                <input id="eloc" value={f.location} onChange={set('location')}
                  placeholder="Fisherman's Wharf" className={`mt-1.5 ${fieldClass}`} />
              </div>
            </div>
            <div>
              <label htmlFor="edesc" className={labelClass}>Notes</label>
              <textarea id="edesc" rows={2} value={f.description} onChange={set('description')}
                className={`mt-1.5 resize-y ${fieldClass}`} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => add.mutate()} disabled={add.isPending} className={btnPrimary}>
                {add.isPending ? 'Adding…' : 'Add to the calendar'}
              </button>
              <button onClick={() => setAdding(false)} className={btnGhost}>Cancel</button>
            </div>
          </div>
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
            <ul className="mt-2 divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
              {byDay.get(d)!.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 p-4">
                  <div className="w-20 shrink-0 text-sm text-[color:var(--text-muted)]">
                    {e.all_day || !e.start_time
                      ? 'All day'
                      : `${timeLabel(e.start_time)}${e.end_time ? `–${timeLabel(e.end_time)}` : ''}`}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
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
                    <EventComments eventId={e.id} />
                  </div>
                  <button
                    onClick={() => { if (confirm(`Remove "${e.title}"?`)) remove.mutate(e.id) }}
                    aria-label={`Remove ${e.title}`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)]"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
