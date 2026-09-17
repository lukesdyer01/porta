import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { prepareImagePair } from '../lib/images'
import { supabase } from '../lib/supabase'
import { customSplit, equalSplit, householdSplit, type SplitRow } from '../lib/splits'
import { fromCents, money, toCents, useMembers, useRsvps, type ExpenseRow, type Member } from '../lib/trips'
import { btnGhost, btnPrimary, fieldClass, labelClass } from './TripForm'
import { humanizeError } from '../lib/errors'

type Mode = 'equal' | 'household' | 'custom'

const CATEGORIES = [
  'house', 'golf_cart', 'groceries', 'dining',
  'activities', 'travel', 'supplies', 'fuel', 'other',
] as const

const catLabel = (c: string) => c.replace('_', ' ').replace(/^\w/, (m) => m.toUpperCase())

export default function ExpenseForm({
  tripId,
  expense,
  onDone,
}: {
  tripId: string
  /** Present when correcting an existing expense rather than logging a new one. */
  expense?: ExpenseRow
  onDone: () => void
}) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const { data: members = [] } = useMembers()
  const { data: rsvps = [] } = useRsvps(tripId)

  const [payer, setPayer] = useState(expense?.payer_id ?? profile?.id ?? '')
  const [amount, setAmount] = useState(expense ? fromCents(expense.amount_cents) : '')
  const [category, setCategory] = useState<string>(expense?.category ?? 'house')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [date, setDate] = useState(expense?.incurred_on ?? new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState<Mode>((expense?.split_method as Mode) ?? 'equal')
  const [picked, setPicked] = useState<Set<string>>(
    new Set(expense?.expense_splits.map((s) => s.profile_id) ?? []),
  )
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (expense?.expense_splits ?? []).map((s) => [s.profile_id, fromCents(s.share_cents)]),
    ),
  )
  const [error, setError] = useState<string | null>(null)
  const [receiptPath, setReceiptPath] = useState<string | null>(expense?.receipt_path ?? null)
  const [uploading, setUploading] = useState(false)
  const receiptRef = useRef<HTMLInputElement>(null)

  // Goes under trips/, which the existing storage policy already permits, and
  // through the same downscaling as every other photo — a receipt snapped on a
  // phone is no smaller than a beach photo.
  async function attachReceipt(file: File) {
    setUploading(true)
    setError(null)
    try {
      const { full } = await prepareImagePair(file)
      const path = `trips/${tripId}/receipts/${crypto.randomUUID()}.${full.ext}`
      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(path, full.blob, { contentType: full.type })
      if (upErr) throw new Error(upErr.message)
      setReceiptPath(path)
    } catch (e) {
      setError(humanizeError(e))
    } finally {
      setUploading(false)
    }
  }

  const totalCents = toCents(amount) ?? 0
  const goingIds = useMemo(
    () => new Set(rsvps.filter((r) => r.status === 'yes' && r.profile_id).map((r) => r.profile_id!)),
    [rsvps],
  )

  // Default to whoever RSVP'd yes — the common case — but never lock it: the
  // whole point is choosing exactly who a cost lands on.
  const [seeded, setSeeded] = useState(Boolean(expense))
  if (!seeded && members.length > 0) {
    setSeeded(true)
    setPicked(new Set(goingIds.size > 0 ? [...goingIds] : members.map((m) => m.id)))
  }

  const chosen = members.filter((m) => picked.has(m.id))

  const splits: SplitRow[] = useMemo(() => {
    if (chosen.length === 0 || totalCents <= 0) return []
    if (mode === 'equal') return equalSplit(totalCents, chosen.map((m) => m.id))
    if (mode === 'household')
      return householdSplit(
        totalCents,
        chosen.map((m) => ({ profileId: m.id, householdId: m.household_id })),
      )
    return customSplit(
      Object.fromEntries(chosen.map((m) => [m.id, toCents(custom[m.id] ?? '') ?? 0])),
    )
  }, [chosen, totalCents, mode, custom])

  const splitTotal = splits.reduce((s, r) => s + r.shareCents, 0)
  const off = totalCents - splitTotal

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not signed in.')
      if (totalCents <= 0) throw new Error('Enter an amount.')
      if (!payer) throw new Error('Who paid?')
      if (splits.length === 0) throw new Error('Choose at least one person to split with.')
      if (mode === 'custom' && off !== 0)
        throw new Error(
          `The shares add up to ${money(splitTotal)}, but the expense is ${money(totalCents)}.`,
        )

      const { error } = await supabase.rpc('save_expense', {
        p_expense: {
          // save_expense upserts on this, so an id turns the save into an edit.
          ...(expense ? { id: expense.id } : {}),
          trip_id: tripId,
          payer_id: payer,
          amount_cents: totalCents,
          category,
          description: description.trim(),
          incurred_on: date,
          split_method: mode,
          receipt_path: receiptPath,
        },
        p_splits: splits.map((s) => ({
          profile_id: s.profileId,
          share_cents: s.shareCents,
          weight: s.weight,
        })),
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses', tripId] })
      void qc.invalidateQueries({ queryKey: ['balances', tripId] })
      onDone()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const shareOf = (m: Member) => splits.find((s) => s.profileId === m.id)?.shareCents ?? 0

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="amt" className={labelClass}>Amount</label>
          <input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="3200.00" className={`mt-1.5 ${fieldClass}`} />
        </div>
        <div>
          <label htmlFor="payer" className={labelClass}>Who paid</label>
          <select id="payer" value={payer} onChange={(e) => setPayer(e.target.value)}
            className={`mt-1.5 ${fieldClass}`}>
            <option value="">Choose…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cat" className={labelClass}>Category</label>
          <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}
            className={`mt-1.5 ${fieldClass}`}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="edate" className={labelClass}>Date</label>
          <input id="edate" type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className={`mt-1.5 ${fieldClass}`} />
        </div>
      </div>

      <div>
        <label htmlFor="edesc" className={labelClass}>What was it?</label>
        <input id="edesc" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Beach house rental" className={`mt-1.5 ${fieldClass}`} />
      </div>

      <div>
        <input
          ref={receiptRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void attachReceipt(file)
          }}
        />
        {receiptPath ? (
          <p className="flex items-center gap-2 text-sm">
            <Paperclip className="size-4 text-[color:var(--accent)]" aria-hidden="true" />
            Receipt attached
            <button
              type="button"
              onClick={() => setReceiptPath(null)}
              aria-label="Remove the receipt"
              className="text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => receiptRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)] disabled:opacity-50"
          >
            <Paperclip className="size-3.5" aria-hidden="true" />
            {uploading ? 'Attaching…' : 'Attach a receipt'}
          </button>
        )}
      </div>

      {/* ---- split picker ---- */}
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
        <p className={labelClass}>Split between</p>

        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-[color:var(--surface-sunk)] p-1">
          {([
            ['equal', 'Evenly'],
            ['household', 'Per family'],
            ['custom', 'Custom'],
          ] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`rounded-md px-2 py-1.5 text-sm font-medium transition ${
                mode === m ? 'bg-[color:var(--surface-raised)] shadow-sm' : 'text-[color:var(--text-muted)]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'household' && (
          <p className="mt-2 text-xs text-[color:var(--text-muted)]">
            One share per family, however many of them are ticked &mdash; how the house cost
            actually splits.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={() => setPicked(new Set(members.map((m) => m.id)))}
            className="rounded-full border border-[color:var(--border)] px-2.5 py-1 hover:bg-[color:var(--surface-sunk)]">
            Everyone
          </button>
          {goingIds.size > 0 && (
            <button type="button" onClick={() => setPicked(new Set(goingIds))}
              className="rounded-full border border-[color:var(--border)] px-2.5 py-1 hover:bg-[color:var(--surface-sunk)]">
              Everyone going
            </button>
          )}
          <button type="button" onClick={() => setPicked(new Set())}
            className="rounded-full border border-[color:var(--border)] px-2.5 py-1 hover:bg-[color:var(--surface-sunk)]">
            Nobody
          </button>
        </div>

        <ul className="mt-3 divide-y divide-[color:var(--border)]">
          {members.map((m) => {
            const on = picked.has(m.id)
            return (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <input type="checkbox" checked={on} onChange={() => toggle(m.id)}
                  id={`pick-${m.id}`} className="size-4 accent-[color:var(--accent)]" />
                <label htmlFor={`pick-${m.id}`} className="min-w-0 flex-1 truncate text-sm">
                  {m.display_name}
                </label>
                {on && mode === 'custom' ? (
                  <input inputMode="decimal" value={custom[m.id] ?? ''}
                    onChange={(e) => setCustom((p) => ({ ...p, [m.id]: e.target.value }))}
                    placeholder="0.00"
                    className="w-24 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 py-1 text-right text-sm outline-none focus:border-[color:var(--accent)]" />
                ) : (
                  <span className="w-24 text-right font-mono text-sm text-[color:var(--text-muted)]">
                    {on ? money(shareOf(m)) : '—'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <div className="mt-3 flex items-baseline justify-between border-t border-[color:var(--border)] pt-3 text-sm">
          <span className="text-[color:var(--text-muted)]">
            {chosen.length} {chosen.length === 1 ? 'person' : 'people'}
          </span>
          <span className={off === 0 ? 'font-medium' : 'font-medium text-[color:var(--color-sunset-600)]'}>
            {money(splitTotal)}
            {off !== 0 && totalCents > 0 && ` · ${off > 0 ? money(off) + ' left' : money(-off) + ' over'}`}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button onClick={() => { setError(null); save.mutate() }} disabled={save.isPending}
          className={btnPrimary}>
          {save.isPending ? 'Saving…' : expense ? 'Save changes' : 'Save expense'}
        </button>
        <button onClick={onDone} className={btnGhost}>Cancel</button>
      </div>
    </div>
  )
}
