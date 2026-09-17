import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import ExpenseForm from '../components/ExpenseForm'
import { btnGhost, btnPrimary } from '../components/TripForm'
import { settle } from '../lib/settle'
import { supabase } from '../lib/supabase'
import { money, useBalances, useExpenses, useMembers } from '../lib/trips'
import { usePageTitle } from '../lib/usePageTitle'
import { humanizeError } from '../lib/errors'
import { useTripContext } from '../trip/useTrip'

export default function Expenses() {
  usePageTitle('Money')
  const { profile, isOrganizer } = useAuth()
  const qc = useQueryClient()
  const { trip } = useTripContext()

  const { data: expenses = [], isLoading } = useExpenses(trip?.id)
  const { data: balances = [] } = useBalances(trip?.id)
  const { data: members = [] } = useMembers()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const nameOf = useMemo(
    () => (id: string) => members.find((m) => m.id === id)?.display_name ?? 'Someone',
    [members],
  )

  const transfers = useMemo(
    () => settle(balances.map((b) => ({ profileId: b.profile_id, netCents: Number(b.net_cents) }))),
    [balances],
  )

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['expenses', trip?.id] })
      void qc.invalidateQueries({ queryKey: ['balances', trip?.id] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const markPaid = useMutation({
    mutationFn: async (t: { fromProfileId: string; toProfileId: string; amountCents: number }) => {
      if (!trip || !profile) throw new Error('Not ready.')
      const { error } = await supabase.from('settlements').insert({
        trip_id: trip.id,
        from_profile_id: t.fromProfileId,
        to_profile_id: t.toProfileId,
        amount_cents: t.amountCents,
        created_by: profile.id,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['balances', trip?.id] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  if (!trip) return <p className="text-sm text-[color:var(--text-muted)]">No trip yet.</p>

  const total = expenses.reduce((s, e) => s + e.amount_cents, 0)
  const mine = balances.find((b) => b.profile_id === profile?.id)

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
          <Receipt className="size-5" aria-hidden="true" />
          Expenses
        </h2>
        <button onClick={() => setAdding((v) => !v)} className={`ml-auto ${btnGhost}`}>
          <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
          Add
        </button>
      </div>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        {expenses.length === 0
          ? 'Nothing logged yet.'
          : `${money(total)} across ${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}.`}
      </p>

      {mine && (
        <p className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-4 py-3 text-sm">
          You paid <span className="font-medium">{money(Number(mine.paid_cents))}</span> and owe{' '}
          <span className="font-medium">{money(Number(mine.owed_cents))}</span> &mdash;{' '}
          {Number(mine.net_cents) === 0 ? (
            <span className="font-medium">you&rsquo;re square.</span>
          ) : Number(mine.net_cents) > 0 ? (
            <span className="font-medium text-[color:var(--accent)]">
              you&rsquo;re owed {money(Number(mine.net_cents))}.
            </span>
          ) : (
            <span className="font-medium text-[color:var(--color-sunset-600)]">
              you owe {money(-Number(mine.net_cents))}.
            </span>
          )}
        </p>
      )}

      {adding && (
        <div className="mt-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
          <ExpenseForm tripId={trip.id} onDone={() => setAdding(false)} />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {/* ---- settle up ---- */}
      {transfers.length > 0 && (
        <section className="mt-8">
          <h3 className="font-medium">Settling up</h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            The shortest way to square everyone &mdash; {transfers.length}{' '}
            {transfers.length === 1 ? 'payment' : 'payments'}, not one per expense.
          </p>
          <ul className="mt-3 divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
            {transfers.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 text-sm">
                <span className="font-medium">{nameOf(t.fromProfileId)}</span>
                <ArrowRight className="size-4 text-[color:var(--text-muted)]" aria-hidden="true" />
                <span className="font-medium">{nameOf(t.toProfileId)}</span>
                <span className="font-mono">{money(t.amountCents)}</span>
                {(t.fromProfileId === profile?.id || t.toProfileId === profile?.id || isOrganizer) && (
                  <button
                    onClick={() => markPaid.mutate(t)}
                    disabled={markPaid.isPending}
                    className="ml-auto rounded-lg border border-[color:var(--border)] px-3 py-1 text-xs transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
                  >
                    Mark paid
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- the list ---- */}
      {isLoading && <p className="mt-6 text-sm text-[color:var(--text-muted)]">Loading…</p>}

      {expenses.length > 0 && (
        <section className="mt-8">
          <h3 className="font-medium">Everything logged</h3>
          <ul className="mt-3 divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
            {expenses.map((e) => {
              const myShare = e.expense_splits.find((s) => s.profile_id === profile?.id)
              // Mirrors the update policy: payer, whoever entered it, or an
              // organizer. Checking only the payer hid edit from someone who
              // logged an expense on another person's behalf.
              const canEdit =
                isOrganizer || e.payer_id === profile?.id || e.created_by === profile?.id
              if (editingId === e.id) {
                return (
                  <li key={e.id} className="p-4">
                    <ExpenseForm
                      tripId={trip.id}
                      expense={e}
                      onDone={() => setEditingId(null)}
                    />
                  </li>
                )
              }

              return (
                <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{e.description || e.category.replace('_', ' ')}</p>
                    <p className="mt-0.5 text-sm text-[color:var(--text-muted)]">
                      {e.payer?.display_name ?? 'Someone'} paid · {e.incurred_on} ·{' '}
                      {e.expense_splits.length} way{e.expense_splits.length === 1 ? '' : 's'}
                      {myShare ? ` · your share ${money(myShare.share_cents)}` : ' · not your share'}
                    </p>
                  </div>
                  <span className="font-mono font-medium">{money(e.amount_cents)}</span>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => {
                          setAdding(false)
                          setEditingId(e.id)
                        }}
                        aria-label={`Edit ${e.description || 'expense'}`}
                        className="grid size-8 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)]"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${e.description || 'this expense'}"?`)) remove.mutate(e.id)
                        }}
                        aria-label="Delete expense"
                        className="grid size-8 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)]"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!isLoading && expenses.length === 0 && !adding && (
        <button onClick={() => setAdding(true)} className={`mt-6 ${btnPrimary}`}>
          <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
          Log the first expense
        </button>
      )}
    </div>
  )
}
