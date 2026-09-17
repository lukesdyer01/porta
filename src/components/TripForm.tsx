import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Trip, TripStatus } from '../lib/types'
import { humanizeError } from '../lib/errors'

const STATUSES: TripStatus[] = ['planning', 'upcoming', 'active', 'archived']

export const fieldClass =
  'w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25'
export const labelClass = 'block text-sm font-medium'
export const btnPrimary =
  'rounded-lg bg-[color:var(--accent)] px-4 py-2.5 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
export const btnGhost =
  'rounded-lg border border-[color:var(--border)] px-4 py-2.5 font-medium transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50'

export default function TripForm({
  trip,
  onDone,
}: {
  trip?: Trip
  onDone: (year?: number) => void
}) {
  const qc = useQueryClient()
  const [year, setYear] = useState(String(trip?.year ?? new Date().getFullYear()))
  const [name, setName] = useState(trip?.name ?? '')
  const [start, setStart] = useState(trip?.start_date ?? '')
  const [end, setEnd] = useState(trip?.end_date ?? '')
  const [status, setStatus] = useState<TripStatus>(trip?.status ?? 'planning')
  const [notes, setNotes] = useState(trip?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const y = Number(year)
      if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new Error('Enter a year like 2026.')
      if (start && end && end < start) throw new Error('The end date is before the start date.')

      const row = {
        year: y,
        name: name.trim(),
        start_date: start || null,
        end_date: end || null,
        status,
        notes: notes.trim() || null,
      }

      if (trip) {
        const { error } = await supabase.from('trips').update(row).eq('id', trip.id)
        if (error) throw new Error(error.message)
      } else {
        const { data: me } = await supabase.auth.getUser()
        const { error } = await supabase
          .from('trips')
          .insert({ ...row, created_by: me.user!.id })
        if (error) {
          throw new Error(
            error.code === '23505' ? `There's already a ${y} trip.` : error.message,
          )
        }
      }
      return y
    },
    onSuccess: (y) => {
      void qc.invalidateQueries({ queryKey: ['trips'] })
      onDone(y)
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        save.mutate()
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="year" className={labelClass}>
            Year
          </label>
          <input
            id="year"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={`mt-1.5 ${fieldClass}`}
          />
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TripStatus)}
            className={`mt-1.5 ${fieldClass}`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="tname" className={labelClass}>
          Name <span className="font-normal text-[color:var(--text-muted)]">(optional)</span>
        </label>
        <input
          id="tname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 30th anniversary year"
          className={`mt-1.5 ${fieldClass}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="start" className={labelClass}>
            Arrive
          </label>
          <input
            id="start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={`mt-1.5 ${fieldClass}`}
          />
        </div>
        <div>
          <label htmlFor="end" className={labelClass}>
            Leave
          </label>
          <input
            id="end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={`mt-1.5 ${fieldClass}`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`mt-1.5 resize-y ${fieldClass}`}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[color:var(--color-sunset-600)]">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className={btnPrimary}>
          {save.isPending ? 'Saving…' : trip ? 'Save trip' : 'Create trip'}
        </button>
        <button type="button" onClick={() => onDone()} className={btnGhost}>
          Cancel
        </button>
      </div>
    </form>
  )
}
