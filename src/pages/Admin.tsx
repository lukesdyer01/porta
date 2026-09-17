import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import InviteCodes from '../components/InviteCodes'
import { parseEmails } from '../lib/parseEmails'
import { supabase } from '../lib/supabase'
import type { AddMembersResult, AdminMember } from '../lib/types'
import { usePageTitle } from '../lib/usePageTitle'
import { humanizeError } from '../lib/errors'

function useMembers() {
  return useQuery({
    queryKey: ['admin-members'],
    queryFn: async (): Promise<AdminMember[]> => {
      const { data, error } = await supabase
        .from('admin_members')
        .select('*')
        .order('has_signed_in', { ascending: false })
        .order('email')
      if (error) throw new Error(error.message)
      return (data ?? []) as AdminMember[]
    },
  })
}

export default function Admin() {
  usePageTitle('Members')
  const { isOrganizer, profile } = useAuth()
  const qc = useQueryClient()
  const { data: members = [], isLoading, error } = useMembers()

  const [paste, setPaste] = useState('')
  const [asOrganizer, setAsOrganizer] = useState(false)
  const [result, setResult] = useState<AddMembersResult | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const parsed = parseEmails(paste)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-members'] })

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_add_members', {
        emails: parsed,
        as_organizer: asOrganizer,
      })
      if (error) throw new Error(error.message)
      return data as AddMembersResult
    },
    onSuccess: (data) => {
      setResult(data)
      setProblem(null)
      setPaste('')
      setAsOrganizer(false)
      void refresh()
    },
    onError: (e: Error) => {
      setProblem(humanizeError(e))
      setResult(null)
    },
  })

  const setRole = useMutation({
    mutationFn: async (v: { email: string; role: 'member' | 'organizer' }) => {
      const { error } = await supabase.rpc('admin_set_role', {
        target_email: v.email,
        new_role: v.role,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setProblem(null)
      void refresh()
    },
    onError: (e: Error) => setProblem(humanizeError(e)),
  })

  const remove = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('allowed_emails').delete().eq('email', email)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setProblem(null)
      void refresh()
    },
    onError: (e: Error) => setProblem(humanizeError(e)),
  })

  if (!isOrganizer) {
    return (
      <div className="max-w-prose">
        <h2 className="font-display text-2xl font-semibold">Members</h2>
        <p className="mt-2 text-[color:var(--text-muted)]">
          Only trip organizers can manage who has access.
        </p>
      </div>
    )
  }

  const busy = invite.isPending || setRole.isPending || remove.isPending

  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-2xl font-semibold">Members</h2>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        Anyone on this list can sign in. Everyone else is turned away.
      </p>

      <InviteCodes onError={setProblem} />

      {/* ---- invite ---- */}
      <section className="mt-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
        <h3 className="flex items-center gap-2 font-medium">
          <UserPlus className="size-4" aria-hidden="true" />
          Invite people
        </h3>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          Paste any number of addresses &mdash; commas, one per line, or straight out of your
          contacts.
        </p>

        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={4}
          placeholder={'sue@example.com, bob@example.com\nMike Dyer <mike@example.com>'}
          className="mt-3 w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 font-mono text-sm outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25"
        />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={asOrganizer}
              onChange={(e) => setAsOrganizer(e.target.checked)}
              className="size-4 accent-[color:var(--accent)]"
            />
            Make them organizers
          </label>

          <span className="text-sm text-[color:var(--text-muted)]">
            {parsed.length === 0
              ? 'No addresses found yet'
              : `${parsed.length} address${parsed.length === 1 ? '' : 'es'} found`}
          </span>

          <button
            onClick={() => invite.mutate()}
            disabled={busy || parsed.length === 0}
            className="ml-auto rounded-lg bg-[color:var(--accent)] px-4 py-2 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {invite.isPending ? 'Inviting…' : 'Invite'}
          </button>
        </div>

        {result && (
          <div className="mt-4 space-y-1 text-sm" role="status">
            {result.added.length > 0 && (
              <p className="flex items-center gap-1.5 text-[color:var(--accent)]">
                <Check className="size-4" aria-hidden="true" />
                Invited {result.added.length}: {result.added.join(', ')}
              </p>
            )}
            {result.existing.length > 0 && (
              <p className="text-[color:var(--text-muted)]">
                Already on the list: {result.existing.join(', ')}
              </p>
            )}
            {result.invalid.length > 0 && (
              <p className="text-[color:var(--color-sunset-600)]">
                Didn&rsquo;t look like addresses: {result.invalid.join(', ')}
              </p>
            )}
          </div>
        )}
      </section>

      {problem && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm"
        >
          {problem}
        </p>
      )}

      {/* ---- list ---- */}
      <section className="mt-8">
        <h3 className="font-medium">
          On the list{' '}
          <span className="font-normal text-[color:var(--text-muted)]">({members.length})</span>
        </h3>

        {isLoading && <p className="mt-3 text-sm text-[color:var(--text-muted)]">Loading…</p>}
        {error && (
          <p className="mt-3 text-sm text-[color:var(--color-sunset-600)]">
            Couldn&rsquo;t load members: {humanizeError(error)}
          </p>
        )}

        <ul className="mt-3 divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
          {members.map((m) => {
            const isYou = m.email === profile?.email
            const organizer = (m.profile_role ?? m.invited_role) === 'organizer'

            return (
              <li key={m.email} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{m.display_name || m.email}</span>
                    {organizer && (
                      <ShieldCheck
                        className="size-4 shrink-0 text-[color:var(--accent)]"
                        aria-label="Organizer"
                      />
                    )}
                    {isYou && (
                      <span className="shrink-0 text-xs text-[color:var(--text-muted)]">you</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-[color:var(--text-muted)]">
                    {m.display_name ? `${m.email} · ` : ''}
                    {m.has_signed_in ? (m.household_name ?? 'No household yet') : 'Not signed in yet'}
                  </p>
                </div>

                <button
                  onClick={() =>
                    setRole.mutate({
                      email: m.email,
                      role: organizer ? 'member' : 'organizer',
                    })
                  }
                  disabled={busy}
                  className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-sm transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
                >
                  {organizer ? 'Make member' : 'Make organizer'}
                </button>

                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Remove ${m.email}? They lose access immediately. Anything they've written stays.`,
                      )
                    ) {
                      remove.mutate(m.email)
                    }
                  }}
                  disabled={busy}
                  aria-label={`Remove ${m.email}`}
                  className="grid size-8 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
