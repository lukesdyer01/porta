import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { humanizeError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { EventKind, TripEvent } from '../lib/types'
import { btnGhost, btnPrimary, fieldClass, labelClass } from './TripForm'

const KINDS: EventKind[] = ['activity', 'travel', 'birthday', 'reminder', 'chore', 'other']

export default function EventForm({
  tripId,
  event,
  defaultDate,
  onDone,
}: {
  tripId: string
  /** Present when correcting an existing event rather than adding one. */
  event?: TripEvent
  defaultDate?: string | null
  onDone: () => void
}) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({
    title: event?.title ?? '',
    event_date: event?.event_date ?? defaultDate ?? '',
    start_time: event?.start_time?.slice(0, 5) ?? '',
    end_time: event?.end_time?.slice(0, 5) ?? '',
    kind: (event?.kind ?? 'activity') as EventKind,
    location: event?.location ?? '',
    description: event?.description ?? '',
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not signed in.')
      if (!f.title.trim()) throw new Error('Give it a title.')
      if (!f.event_date) throw new Error('Pick a date.')
      if (f.start_time && f.end_time && f.end_time < f.start_time)
        throw new Error('The end time is before the start time.')

      const row = {
        title: f.title.trim(),
        event_date: f.event_date,
        start_time: f.start_time || null,
        end_time: f.end_time || null,
        all_day: !f.start_time,
        kind: f.kind,
        location: f.location.trim() || null,
        description: f.description.trim() || null,
      }

      if (event) {
        const { error } = await supabase.from('events').update(row).eq('id', event.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('events')
          .insert({ ...row, trip_id: tripId, created_by: profile.id })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['events', tripId] })
      onDone()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  return (
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

      {error && (
        <p role="alert" className="rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button onClick={() => save.mutate()} disabled={save.isPending} className={btnPrimary}>
          {save.isPending ? 'Saving…' : event ? 'Save changes' : 'Add to the calendar'}
        </button>
        <button onClick={onDone} className={btnGhost}>Cancel</button>
      </div>
    </div>
  )
}
