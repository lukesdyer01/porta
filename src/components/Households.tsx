import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Home, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { humanizeError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useHouseholds, useMembers } from '../lib/trips'
import { btnPrimary, fieldClass } from './TripForm'

/** Enough distinct hues to tell families apart on a calendar at a glance. */
const SWATCHES = ['#1f8f89', '#e8734a', '#6fcdc6', '#cdb188', '#115856', '#d15a32', '#8a6fc4', '#4a8fd1']

export default function Households({ onError }: { onError: (m: string | null) => void }) {
  const qc = useQueryClient()
  const { data: households = [], isLoading } = useHouseholds()
  const { data: members = [] } = useMembers()
  const [draft, setDraft] = useState('')

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['households'] })
    void qc.invalidateQueries({ queryKey: ['members'] })
    void qc.invalidateQueries({ queryKey: ['admin-members'] })
  }
  const fail = (e: Error) => onError(humanizeError(e))

  const countIn = (id: string) => members.filter((m) => m.household_id === id).length

  const create = useMutation({
    mutationFn: async () => {
      const name = draft.trim()
      if (!name) throw new Error('Give it a name.')
      const { error } = await supabase.from('households').insert({
        name,
        color: SWATCHES[households.length % SWATCHES.length],
        sort_order: households.length,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      onError(null)
      setDraft('')
      refresh()
    },
    onError: fail,
  })

  const update = useMutation({
    mutationFn: async (v: { id: string; name?: string; color?: string }) => {
      const patch: Record<string, string> = {}
      if (v.name !== undefined) {
        const name = v.name.trim()
        if (!name) throw new Error('A household needs a name.')
        patch.name = name
      }
      if (v.color !== undefined) patch.color = v.color
      const { error } = await supabase.from('households').update(patch).eq('id', v.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      onError(null)
      refresh()
    },
    onError: fail,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('households').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      onError(null)
      refresh()
    },
    onError: fail,
  })

  const busy = create.isPending || update.isPending || remove.isPending

  return (
    <section className="mt-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
      <h3 className="flex items-center gap-2 font-medium">
        <Home className="size-4" aria-hidden="true" />
        Households
      </h3>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        The unit that cooks a dinner and takes a share of the house cost. People pick theirs on
        their own profile.
      </p>

      {isLoading && <p className="mt-3 text-sm text-[color:var(--text-muted)]">Loading…</p>}
      {!isLoading && households.length === 0 && (
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          None yet &mdash; the dinner rotation and per-family splits need these.
        </p>
      )}

      {households.length > 0 && (
        <ul className="mt-4 divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)]">
          {households.map((h) => {
            const n = countIn(h.id)
            return (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <label className="shrink-0" title="Colour on the calendar">
                  <span className="sr-only">Colour for {h.name}</span>
                  <input
                    type="color"
                    value={h.color}
                    onChange={(e) => update.mutate({ id: h.id, color: e.target.value })}
                    className="size-6 cursor-pointer rounded border border-[color:var(--border)] bg-transparent"
                  />
                </label>

                <input
                  defaultValue={h.name}
                  aria-label={`Rename ${h.name}`}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== h.name) update.mutate({ id: h.id, name: e.target.value })
                  }}
                  className="min-w-32 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-[color:var(--border)] focus:border-[color:var(--accent)] focus:bg-[color:var(--surface)] focus:outline-none"
                />

                <span className="shrink-0 text-xs text-[color:var(--text-muted)]">
                  {n === 0 ? 'nobody yet' : `${n} ${n === 1 ? 'person' : 'people'}`}
                </span>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    // Members and past dinner assignments are set to null, not
                    // deleted — worth saying so before it happens.
                    const warn =
                      n > 0
                        ? `Delete "${h.name}"? ${n} ${n === 1 ? 'person loses their' : 'people lose their'} household, and any dinners assigned to them become unassigned.`
                        : `Delete "${h.name}"?`
                    if (confirm(warn)) remove.mutate(h.id)
                  }}
                  aria-label={`Delete ${h.name}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate()
        }}
        className="mt-4 flex flex-wrap gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. The Kings"
          aria-label="New household name"
          className={`min-w-48 flex-1 ${fieldClass}`}
        />
        <button type="submit" disabled={busy || !draft.trim()} className={btnPrimary}>
          <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
          Add
        </button>
      </form>
    </section>
  )
}
