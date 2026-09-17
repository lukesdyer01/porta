import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InviteCode } from '../lib/types'

export default function InviteCodes({ onError }: { onError: (m: string | null) => void }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['invite-codes'],
    queryFn: async (): Promise<InviteCode[]> => {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .order('active', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as InviteCode[]
    },
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['invite-codes'] })
  const fail = (e: Error) => onError(e.message)

  const create = useMutation({
    mutationFn: async () => {
      const code = draft.trim().toLowerCase()
      if (code.length < 4) throw new Error('A code needs at least 4 characters.')
      const { error } = await supabase.from('invite_codes').insert({ code })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      onError(null)
      setDraft('')
      void refresh()
    },
    onError: fail,
  })

  const toggle = useMutation({
    mutationFn: async (c: InviteCode) => {
      const { error } = await supabase
        .from('invite_codes')
        .update({ active: !c.active })
        .eq('code', c.code)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      onError(null)
      void refresh()
    },
    onError: fail,
  })

  const remove = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.from('invite_codes').delete().eq('code', code)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      onError(null)
      void refresh()
    },
    onError: fail,
  })

  const busy = create.isPending || toggle.isPending || remove.isPending
  const live = codes.filter((c) => c.active)

  return (
    <section className="mt-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
      <h3 className="flex items-center gap-2 font-medium">
        <KeyRound className="size-4" aria-hidden="true" />
        Family code
      </h3>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        Text this to the family and they can sign themselves up. Anyone who joins with it is
        added to the list below, so you can still remove them individually.
      </p>

      {isLoading && <p className="mt-3 text-sm text-[color:var(--text-muted)]">Loading…</p>}

      {!isLoading && live.length === 0 && (
        <p className="mt-3 text-sm text-[color:var(--color-sunset-600)]">
          No active code &mdash; nobody can sign themselves up right now.
        </p>
      )}

      {codes.length > 0 && (
        <ul className="mt-4 divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)]">
          {codes.map((c) => (
            <li key={c.code} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <code
                className={`font-mono text-base ${c.active ? '' : 'text-[color:var(--text-muted)] line-through'}`}
              >
                {c.code}
              </code>
              <span className="text-xs text-[color:var(--text-muted)]">
                used {c.uses}
                {c.max_uses ? ` of ${c.max_uses}` : ''}
                {c.active ? '' : ' · off'}
              </span>
              <button
                onClick={() => toggle.mutate(c)}
                disabled={busy}
                className="ml-auto rounded-lg border border-[color:var(--border)] px-3 py-1 text-sm transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
              >
                {c.active ? 'Turn off' : 'Turn on'}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete the code "${c.code}"? Anyone who already joined keeps access.`))
                    remove.mutate(c.code)
                }}
                disabled={busy}
                aria-label={`Delete code ${c.code}`}
                className="grid size-8 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="new code, e.g. beachweek"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-48 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-base outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25"
        />
        <button
          onClick={() => create.mutate()}
          disabled={busy || draft.trim().length < 4}
          className="rounded-lg bg-[color:var(--accent)] px-4 py-2 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add code
        </button>
      </div>
      <p className="mt-2 text-xs text-[color:var(--text-muted)]">
        Avoid anything guessable from this site &mdash; &ldquo;king&rdquo; is written on every page.
      </p>
    </section>
  )
}
