import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabase'
import type { Household } from '../lib/types'

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [households, setHouseholds] = useState<Household[]>([])
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [householdId, setHouseholdId] = useState(profile?.household_id ?? '')
  const [newHousehold, setNewHousehold] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    void supabase
      .from('households')
      .select('id, name, color, sort_order')
      .order('sort_order')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('Failed to load households:', error.message)
        setHouseholds((data as Household[]) ?? [])
      })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    setBusy(true)
    setStatus(null)

    let targetHousehold: string | null = householdId || null

    // Creating a household and joining it is one intent, so do both here
    // rather than making it a separate screen.
    const name = newHousehold.trim()
    if (name) {
      const { data, error } = await supabase
        .from('households')
        .insert({ name })
        .select('id')
        .single()

      if (error) {
        setBusy(false)
        setStatus({ kind: 'error', text: `Couldn't create that household: ${error.message}` })
        return
      }
      targetHousehold = data.id
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), household_id: targetHousehold })
      .eq('id', profile.id)

    setBusy(false)

    if (error) {
      setStatus({ kind: 'error', text: `Couldn't save: ${error.message}` })
      return
    }

    setNewHousehold('')
    if (targetHousehold) setHouseholdId(targetHousehold)
    await refreshProfile()
    setStatus({ kind: 'ok', text: 'Saved.' })
  }

  if (!profile) return null

  return (
    <div className="max-w-md">
      <h2 className="font-display text-2xl font-semibold">Your profile</h2>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">{profile.email}</p>

      <form onSubmit={save} className="mt-6 space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Luke Dyer"
            autoComplete="name"
            className="mt-1.5 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2.5 text-base outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25"
          />
        </div>

        <div>
          <label htmlFor="household" className="block text-sm font-medium">
            Household
          </label>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Who you cook and split the house cost with.
          </p>
          <select
            id="household"
            value={householdId}
            onChange={(e) => setHouseholdId(e.target.value)}
            disabled={Boolean(newHousehold.trim())}
            className="mt-1.5 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2.5 text-base outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25 disabled:opacity-50"
          >
            <option value="">No household yet</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>

          <input
            value={newHousehold}
            onChange={(e) => setNewHousehold(e.target.value)}
            placeholder="…or add a new one, e.g. The Kings"
            className="mt-2 w-full rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[color:var(--accent)] px-4 py-2.5 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>

        {status && (
          <p
            role="status"
            className={`text-sm ${status.kind === 'error' ? 'text-[color:var(--color-sunset-600)]' : 'text-[color:var(--text-muted)]'}`}
          >
            {status.text}
          </p>
        )}
      </form>
    </div>
  )
}
