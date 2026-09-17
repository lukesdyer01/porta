import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { btnGhost, btnPrimary, fieldClass, labelClass } from '../components/TripForm'
import { supabase } from '../lib/supabase'
import { dayLabel } from '../lib/trips'
import { usePageTitle } from '../lib/usePageTitle'
import { humanizeError } from '../lib/errors'
import { useTripContext } from '../trip/useTrip'

interface Entry {
  id: string
  title: string
  body: string
  entry_date: string
  author_id: string
  author: { display_name: string } | null
}

export default function Journal() {
  usePageTitle('Journal')
  const { profile, isOrganizer } = useAuth()
  const qc = useQueryClient()
  const { trip } = useTripContext()

  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)

  const { data: entries = [], isLoading } = useQuery({
    enabled: Boolean(trip?.id),
    queryKey: ['journal', trip?.id],
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, title, body, entry_date, author_id, author:profiles(display_name)')
        .eq('trip_id', trip!.id)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Entry[]
    },
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['journal', trip?.id] })

  const reset = () => {
    setEditing(null)
    setTitle('')
    setBody('')
    setDate(new Date().toISOString().slice(0, 10))
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!trip || !profile) throw new Error('Not ready.')
      if (!title.trim() && !body.trim()) throw new Error('Write something first.')

      const row = { title: title.trim(), body: body.trim(), entry_date: date }
      if (editing && editing !== 'new') {
        const { error } = await supabase.from('journal_entries').update(row).eq('id', editing)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('journal_entries')
          .insert({ ...row, trip_id: trip.id, author_id: profile.id })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      setError(null)
      reset()
      void refresh()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('journal_entries').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void refresh(),
    onError: (e: Error) => setError(humanizeError(e)),
  })

  if (!trip) return <p className="text-sm text-[color:var(--text-muted)]">No trip yet.</p>

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
          <BookOpen className="size-5" aria-hidden="true" />
          Journal
        </h2>
        {editing === null && (
          <button onClick={() => setEditing('new')} className={`ml-auto ${btnGhost}`}>
            <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
            Write
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        What happened, who said what, the bit you&rsquo;ll forget by next summer.
      </p>

      {editing !== null && (
        <div className="mt-5 space-y-4 card p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="jtitle" className={labelClass}>Title</label>
              <input id="jtitle" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="The day the cart got stuck" className={`mt-1.5 ${fieldClass}`} />
            </div>
            <div>
              <label htmlFor="jdate" className={labelClass}>Date</label>
              <input id="jdate" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className={`mt-1.5 ${fieldClass}`} />
            </div>
          </div>
          <div>
            <label htmlFor="jbody" className={labelClass}>Entry</label>
            <textarea id="jbody" rows={8} value={body} onChange={(e) => setBody(e.target.value)}
              className={`mt-1.5 resize-y ${fieldClass}`} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => save.mutate()} disabled={save.isPending} className={btnPrimary}>
              {save.isPending ? 'Saving…' : editing === 'new' ? 'Post' : 'Save'}
            </button>
            <button onClick={reset} className={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {isLoading && <p className="mt-5 text-sm text-[color:var(--text-muted)]">Loading…</p>}
      {!isLoading && entries.length === 0 && editing === null && (
        <p className="mt-5 rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          Nothing written yet.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {entries.map((e) => (
          <article key={e.id} className="card p-5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              {e.title && <h3 className="font-display text-lg font-semibold">{e.title}</h3>}
              <p className="text-sm text-[color:var(--text-muted)]">
                {e.author?.display_name ?? 'Someone'} · {dayLabel(e.entry_date)}
              </p>
              {(e.author_id === profile?.id || isOrganizer) && (
                <span className="ml-auto flex gap-2">
                  {e.author_id === profile?.id && (
                    <button
                      onClick={() => {
                        setEditing(e.id)
                        setTitle(e.title)
                        setBody(e.body)
                        setDate(e.entry_date)
                      }}
                      aria-label="Edit entry"
                      className="text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm('Delete this entry?')) remove.mutate(e.id) }}
                    aria-label="Delete entry"
                    className="text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
            {e.body && (
              <p className="mt-3 leading-relaxed whitespace-pre-wrap">{e.body}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
