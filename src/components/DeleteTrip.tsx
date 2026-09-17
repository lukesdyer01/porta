import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { humanizeError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { Trip } from '../lib/types'

const count = async (table: string, column: string, value: string) => {
  const { count: n } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
  return n ?? 0
}

export default function DeleteTrip({ trip }: { trip: Trip }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const remove = useMutation({
    mutationFn: async () => {
      // Say what will actually be lost. Everything below hangs off the trip by
      // ON DELETE CASCADE, so "delete the trip" quietly means all of this.
      const [photos, expenses, events, journal, rsvps] = await Promise.all([
        count('photos', 'trip_id', trip.id),
        count('expenses', 'trip_id', trip.id),
        count('events', 'trip_id', trip.id),
        count('journal_entries', 'trip_id', trip.id),
        count('rsvps', 'trip_id', trip.id),
      ])

      const lines = [
        photos && `${photos} photo${photos === 1 ? '' : 's'}`,
        expenses && `${expenses} expense${expenses === 1 ? '' : 's'}`,
        events && `${events} calendar event${events === 1 ? '' : 's'}`,
        journal && `${journal} journal ${journal === 1 ? 'entry' : 'entries'}`,
        rsvps && `${rsvps} RSVP${rsvps === 1 ? '' : 's'}`,
      ].filter(Boolean) as string[]

      const detail = lines.length
        ? `\n\nThis also deletes ${lines.join(', ')}, the house and its codes.`
        : ''

      if (
        !confirm(
          `Delete the ${trip.year} trip?${detail}\n\nThis cannot be undone. Type-check yourself: this is permanent.`,
        )
      ) {
        return { cancelled: true }
      }

      // Gather the storage paths BEFORE the row goes: the photos rows cascade
      // away with it, and the files themselves do not, so this is the last
      // chance to know what to clean up.
      const { data: files } = await supabase
        .from('photos')
        .select('storage_path')
        .eq('trip_id', trip.id)
      const paths = (files ?? []).map((f) => f.storage_path).filter(Boolean)

      const { error } = await supabase.from('trips').delete().eq('id', trip.id)
      if (error) throw new Error(error.message)

      // After the row, so a failure here leaves unused files rather than rows
      // pointing at images that no longer exist.
      if (paths.length) await supabase.storage.from('photos').remove(paths)

      return { cancelled: false }
    },
    onSuccess: (r) => {
      if (r?.cancelled) return
      setError(null)
      void qc.invalidateQueries()
      navigate('/')
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  return (
    <div className="mt-8 border-t border-[color:var(--border)] pt-6">
      <button
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        className="flex items-center gap-1.5 text-sm text-[color:var(--color-sunset-600)] underline underline-offset-4 disabled:opacity-50"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        {remove.isPending ? 'Deleting…' : `Delete the ${trip.year} trip`}
      </button>
      <p className="mt-1 text-xs text-[color:var(--text-muted)]">
        Removes the house, codes, RSVPs, meals, calendar, expenses, photos and journal for this
        year.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[color:var(--color-sunset-600)]">{error}</p>
      )}
    </div>
  )
}
