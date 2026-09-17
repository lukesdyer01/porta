import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHouseInfo } from '../lib/trips'
import type { HouseInfo } from '../lib/types'
import { btnPrimary, fieldClass } from './TripForm'

/** Starting points so nobody stares at an empty panel wondering what goes here. */
const SUGGESTIONS = ['Gate code', 'Door code', 'Pool code', 'Wifi network', 'Wifi password', 'Trash day']

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard is blocked in some mobile browsers; the value is on
          // screen anyway, so failing quietly is better than an alert.
        }
      }}
      aria-label={`Copy ${value}`}
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)]"
    >
      {copied ? (
        <Check className="size-4 text-[color:var(--accent)]" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
    </button>
  )
}

export default function HouseInfoPanel({ houseId }: { houseId: string }) {
  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useHouseInfo(houseId)
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['house-info', houseId] })

  const add = useMutation({
    mutationFn: async () => {
      const l = label.trim()
      if (!l) throw new Error('Give it a label.')
      const { data: me } = await supabase.auth.getUser()
      const { error } = await supabase.from('house_info').insert({
        house_id: houseId,
        label: l,
        value: value.trim(),
        sort_order: rows.length,
        updated_by: me.user!.id,
      })
      if (error) {
        throw new Error(error.code === '23505' ? `There's already a "${l}".` : error.message)
      }
    },
    onSuccess: () => {
      setLabel('')
      setValue('')
      setError(null)
      void refresh()
    },
    onError: (e: Error) => setError(e.message),
  })

  const update = useMutation({
    mutationFn: async (r: HouseInfo) => {
      const { error } = await supabase
        .from('house_info')
        .update({ value: r.value })
        .eq('id', r.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void refresh(),
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('house_info').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void refresh(),
    onError: (e: Error) => setError(e.message),
  })

  const unused = SUGGESTIONS.filter(
    (s) => !rows.some((r) => r.label.toLowerCase() === s.toLowerCase()),
  )

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
      <div className="flex items-center gap-2">
        <h3 className="flex items-center gap-2 font-medium">
          <KeyRound className="size-4" aria-hidden="true" />
          Codes &amp; wifi
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

      {!isLoading && rows.length === 0 && !editing && (
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          Nothing here yet. Hit Edit to add the gate code, wifi and anything else worth having
          on your phone.
        </p>
      )}

      {rows.length > 0 && (
        <dl className="mt-4 divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)]">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <dt className="w-32 shrink-0 text-sm text-[color:var(--text-muted)]">{r.label}</dt>
              {editing ? (
                <input
                  defaultValue={r.value}
                  onBlur={(e) => {
                    if (e.target.value !== r.value) update.mutate({ ...r, value: e.target.value })
                  }}
                  className="flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 font-mono text-sm outline-none focus:border-[color:var(--accent)]"
                />
              ) : (
                <dd className="flex-1 font-mono text-base break-all">{r.value || '—'}</dd>
              )}
              {editing ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove "${r.label}"?`)) remove.mutate(r.id)
                  }}
                  aria-label={`Remove ${r.label}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)]"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              ) : (
                r.value && <CopyButton value={r.value} />
              )}
            </div>
          ))}
        </dl>
      )}

      {editing && (
        <div className="mt-4 border-t border-[color:var(--border)] pt-4">
          {unused.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {unused.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLabel(s)}
                  className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs transition hover:bg-[color:var(--surface-sunk)]"
                >
                  <Plus className="mr-1 inline size-3" aria-hidden="true" />
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label"
              className={`min-w-32 flex-1 ${fieldClass}`}
            />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value"
              className={`min-w-32 flex-1 ${fieldClass}`}
            />
            <button
              type="button"
              onClick={() => add.mutate()}
              disabled={add.isPending || !label.trim()}
              className={btnPrimary}
            >
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-[color:var(--text-muted)]">
            Anyone signed in can edit these &mdash; so whoever finds the wifi password first can
            just fix it.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[color:var(--color-sunset-600)]">{error}</p>
      )}
    </section>
  )
}
