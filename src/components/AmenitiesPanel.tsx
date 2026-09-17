import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useAmenities, useHouseAmenities } from '../lib/amenities'
import { humanizeError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { fieldClass } from './TripForm'

export default function AmenitiesPanel({ houseId }: { houseId: string }) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const { data: all = [], isLoading } = useAmenities()
  const { data: ticked = [] } = useHouseAmenities(houseId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const has = new Set(ticked)
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['house-amenities', houseId] })
    void qc.invalidateQueries({ queryKey: ['amenities-by-year'] })
  }

  const toggle = useMutation({
    mutationFn: async (amenityId: string) => {
      if (!profile) throw new Error('Not signed in.')
      if (has.has(amenityId)) {
        const { error } = await supabase
          .from('house_amenities')
          .delete()
          .eq('house_id', houseId)
          .eq('amenity_id', amenityId)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('house_amenities')
          .insert({ house_id: houseId, amenity_id: amenityId, added_by: profile.id })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const add = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not signed in.')
      const name = draft.trim()
      if (name.length < 2) throw new Error('Give it a name.')

      // Someone typing "grill" when "Grill" exists means the same thing, so
      // tick the existing one rather than reporting a duplicate at them.
      const existing = all.find((a) => a.name.toLowerCase() === name.toLowerCase())
      if (existing) {
        if (!has.has(existing.id)) await toggle.mutateAsync(existing.id)
        return
      }

      const { data, error } = await supabase
        .from('amenities')
        .insert({ name, sort_order: 500 })
        .select('id')
        .single()
      if (error) {
        // Lost a race with someone adding the same thing: find and tick it.
        if (error.code === '23505') {
          void qc.invalidateQueries({ queryKey: ['amenities'] })
          throw new Error('Someone just added that one — tick it in the list.')
        }
        throw new Error(error.message)
      }

      const { error: linkErr } = await supabase
        .from('house_amenities')
        .insert({ house_id: houseId, amenity_id: data.id, added_by: profile.id })
      if (linkErr) throw new Error(linkErr.message)
    },
    onSuccess: () => {
      setError(null)
      setDraft('')
      void qc.invalidateQueries({ queryKey: ['amenities'] })
      refresh()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const chosen = all.filter((a) => has.has(a.id))
  const busy = toggle.isPending || add.isPending

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <h3 className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4" aria-hidden="true" />
          What it has
        </h3>
        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v)
            setError(null)
          }}
          className="ml-auto flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
        >
          {editing ? <X className="size-3.5" aria-hidden="true" /> : <Pencil className="size-3.5" aria-hidden="true" />}
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {isLoading && <p className="mt-3 text-sm text-[color:var(--text-muted)]">Loading…</p>}

      {!isLoading && !editing && (
        chosen.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {chosen.map((a) => (
              <li
                key={a.id}
                className="rounded-full bg-[color:var(--color-gulf-100)] px-3 py-1 text-sm font-medium text-[color:var(--color-gulf-700)]"
              >
                {a.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[color:var(--text-muted)]">
            Nothing listed yet. Hit Edit and tick what the place has.
          </p>
        )
      )}

      {editing && (
        <>
          <ul className="mt-4 grid gap-1 sm:grid-cols-2">
            {all.map((a) => {
              const on = has.has(a.id)
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => toggle.mutate(a.id)}
                    disabled={busy}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
                      on
                        ? 'bg-[color:var(--color-gulf-100)] text-[color:var(--color-gulf-700)]'
                        : 'hover:bg-[color:var(--surface-sunk)]'
                    }`}
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded border ${
                        on
                          ? 'border-[color:var(--color-gulf-500)] bg-[color:var(--color-gulf-500)] text-white'
                          : 'border-[color:var(--border)]'
                      }`}
                    >
                      {on && <Check className="size-3" aria-hidden="true" />}
                    </span>
                    {a.name}
                  </button>
                </li>
              )
            })}
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              add.mutate()
            }}
            className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--border)] pt-4"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Something not listed, e.g. Crab traps"
              aria-label="Add an amenity"
              className={`min-w-44 flex-1 ${fieldClass}`}
            />
            <button
              type="submit"
              disabled={busy || draft.trim().length < 2}
              className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-2 text-sm transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add
            </button>
          </form>
          <p className="mt-2 text-xs text-[color:var(--text-muted)]">
            Anything you add here becomes available on every house, so past years can be compared.
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[color:var(--color-sunset-600)]">{error}</p>
      )}
    </section>
  )
}
