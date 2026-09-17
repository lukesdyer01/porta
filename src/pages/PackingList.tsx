import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Hand, ListChecks, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { humanizeError } from '../lib/errors'
import { useTripItems } from '../lib/items'
import { isPastTrip } from '../lib/trips'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../lib/usePageTitle'
import type { ItemKind, TripItem } from '../lib/types'
import { useTripContext } from '../trip/useTrip'

const LISTS: { kind: ItemKind; title: string; hint: string; placeholder: string }[] = [
  { kind: 'bring', title: 'Bring', hint: 'Things somebody packs and hauls down.', placeholder: 'Cooler, beach chairs, the big griddle…' },
  { kind: 'buy', title: 'Buy', hint: 'Picked up once everyone is there.', placeholder: 'Ice, coffee, breakfast stuff…' },
]

export default function PackingList() {
  usePageTitle('Packing')
  const { profile, isOrganizer } = useAuth()
  const qc = useQueryClient()
  const { trip } = useTripContext()
  const { data: items = [], isLoading } = useTripItems(trip?.id)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const refresh = () => void qc.invalidateQueries({ queryKey: ['trip-items', trip?.id] })
  const fail = (e: Error) => setError(humanizeError(e))

  const add = useMutation({
    mutationFn: async (kind: ItemKind) => {
      if (!trip || !profile) throw new Error('Not ready.')
      const name = (drafts[kind] ?? '').trim()
      if (!name) throw new Error('Type something first.')
      const { error } = await supabase
        .from('trip_items')
        .insert({ trip_id: trip.id, kind, name, created_by: profile.id })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, kind) => {
      setError(null)
      setDrafts((p) => ({ ...p, [kind]: '' }))
      refresh()
    },
    onError: fail,
  })

  const patch = useMutation({
    mutationFn: async (v: { id: string; claimed_by?: string | null; done?: boolean }) => {
      const { id, ...fields } = v
      const { error } = await supabase.from('trip_items').update(fields).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: fail,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trip_items').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: fail,
  })

  if (!trip) return <p className="text-sm text-[color:var(--text-muted)]">No trip yet.</p>

  // Reachable by bookmark, or by switching the year while on this page. The
  // lists are hidden rather than shown read-only: a closed-out trip's leftover
  // "buy ice" reads as a task somebody still owes.
  if (isPastTrip(trip))
    return (
      <p className="max-w-3xl rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
        The {trip.year} trip is done — its packing and shopping lists are closed.
      </p>
    )

  const busy = add.isPending || patch.isPending || remove.isPending

  const row = (it: TripItem) => {
    const mine = it.claimed_by === profile?.id
    const free = it.claimed_by == null
    // Same rule as the dinner rotation: free, yours, or you organise.
    const canTouch = isOrganizer || free || mine

    return (
      <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <button
          type="button"
          disabled={busy || !canTouch}
          onClick={() => patch.mutate({ id: it.id, done: !it.done })}
          aria-label={it.done ? `Mark ${it.name} not done` : `Mark ${it.name} done`}
          aria-pressed={it.done}
          className={`grid size-5 shrink-0 place-items-center rounded border transition disabled:opacity-40 ${
            it.done
              ? 'border-[color:var(--color-gulf-500)] bg-[color:var(--color-gulf-500)] text-white'
              : 'border-[color:var(--border)] hover:bg-[color:var(--surface-sunk)]'
          }`}
        >
          {it.done && <Check className="size-3.5" aria-hidden="true" />}
        </button>

        <span
          className={`min-w-32 flex-1 text-sm ${it.done ? 'text-[color:var(--text-muted)] line-through' : ''}`}
        >
          {it.name}
        </span>

        {free ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch.mutate({ id: it.id, claimed_by: profile!.id })}
            className="flex items-center gap-1.5 rounded-full border border-[color:var(--accent)] px-2.5 py-1 text-xs font-medium text-[color:var(--accent)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-contrast)] disabled:opacity-50"
          >
            <Hand className="size-3" aria-hidden="true" />
            I&rsquo;ve got it
          </button>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-[color:var(--surface-sunk)] px-2.5 py-1 text-xs font-medium">
            {it.claimer?.display_name ?? 'Claimed'}
            {mine && <span className="opacity-70">(you)</span>}
            {canTouch && (
              <button
                type="button"
                disabled={busy}
                onClick={() => patch.mutate({ id: it.id, claimed_by: null })}
                aria-label={`Give up ${it.name}`}
                className="text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            )}
          </span>
        )}

        {canTouch && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm(`Remove "${it.name}"?`)) remove.mutate(it.id)
            }}
            aria-label={`Remove ${it.name}`}
            className="text-[color:var(--text-muted)] hover:text-[color:var(--text)] disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="max-w-3xl">
      <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
        <ListChecks className="size-5" aria-hidden="true" />
        Packing &amp; shopping
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        Add anything; claim what you&rsquo;ll handle. Once a thing is yours, only you can change it.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {isLoading && <p className="mt-5 text-sm text-[color:var(--text-muted)]">Loading…</p>}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {LISTS.map(({ kind, title, hint, placeholder }) => {
          const list = items.filter((i) => i.kind === kind)
          const done = list.filter((i) => i.done).length
          return (
            <section key={kind}>
              <h3 className="font-medium">
                {title}{' '}
                {list.length > 0 && (
                  <span className="font-normal text-[color:var(--text-muted)]">
                    &middot; {done} of {list.length}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{hint}</p>

              <ul className="mt-2 divide-y divide-[color:var(--border)] card">
                {list.length === 0 ? (
                  <li className="p-3 text-sm text-[color:var(--text-muted)]">Nothing yet.</li>
                ) : (
                  list.map(row)
                )}
              </ul>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  add.mutate(kind)
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  value={drafts[kind] ?? ''}
                  onChange={(e) => setDrafts((p) => ({ ...p, [kind]: e.target.value }))}
                  placeholder={placeholder}
                  aria-label={`Add to ${title}`}
                  className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                />
                <button
                  type="submit"
                  disabled={busy || !(drafts[kind] ?? '').trim()}
                  aria-label={`Add to ${title}`}
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color:var(--accent)] text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </form>
            </section>
          )
        })}
      </div>
    </div>
  )
}
