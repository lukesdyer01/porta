import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChefHat } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fieldClass } from '../components/TripForm'
import { supabase } from '../lib/supabase'
import { dayLabel, tripDays, useHouseholds, useMeals, useTrips } from '../lib/trips'

export default function Meals() {
  const { year } = useParams()
  const { profile } = useAuth()
  const qc = useQueryClient()
  const { data: trips = [] } = useTrips()
  const trip = year ? trips.find((t) => String(t.year) === year) : trips[0]
  const { data: meals = [], isLoading } = useMeals(trip?.id)
  const { data: households = [] } = useHouseholds()

  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null)
  const byDate = new Map(meals.filter((m) => m.meal_type === 'dinner').map((m) => [m.meal_date, m]))

  const save = useMutation({
    mutationFn: async (v: { date: string; householdId: string | null; title?: string }) => {
      if (!trip || !profile) throw new Error('Not ready.')
      const existing = byDate.get(v.date)
      if (existing) {
        const patch =
          v.title === undefined
            ? { household_id: v.householdId }
            : { title: v.title, household_id: existing.household_id }
        const { error } = await supabase.from('meals').update(patch).eq('id', existing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('meals').insert({
          trip_id: trip.id,
          meal_date: v.date,
          meal_type: 'dinner',
          household_id: v.householdId,
          title: v.title ?? '',
          created_by: profile.id,
        })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['meals', trip?.id] }),
  })

  if (!trip) return <p className="text-sm text-[color:var(--text-muted)]">No trip yet.</p>

  return (
    <div className="max-w-3xl">
      <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
        <ChefHat className="size-5" aria-hidden="true" />
        Dinner rotation
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        One family cooks each night. Claim a night, or put your name down for someone else&rsquo;s.
      </p>

      {households.length === 0 && (
        <p className="mt-4 rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3 text-sm">
          No households yet &mdash; everyone needs to set theirs on the profile screen before the
          rotation makes sense.
        </p>
      )}

      {days.length === 0 ? (
        <p className="mt-4 rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          Set the trip&rsquo;s arrive and leave dates and every night will show up here.
        </p>
      ) : isLoading ? (
        <p className="mt-4 text-sm text-[color:var(--text-muted)]">Loading…</p>
      ) : (
        <ul className="mt-5 divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
          {days.map((d) => {
            const meal = byDate.get(d)
            return (
              <li key={d} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-medium">{dayLabel(d)}</p>
                </div>

                <select
                  aria-label={`Who cooks on ${dayLabel(d)}`}
                  value={meal?.household_id ?? ''}
                  onChange={(e) => save.mutate({ date: d, householdId: e.target.value || null })}
                  className="min-w-40 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
                >
                  <option value="">Nobody yet</option>
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>

                <input
                  aria-label={`What's for dinner on ${dayLabel(d)}`}
                  defaultValue={meal?.title ?? ''}
                  placeholder="What's cooking?"
                  onBlur={(e) => {
                    if (e.target.value !== (meal?.title ?? ''))
                      save.mutate({ date: d, householdId: meal?.household_id ?? null, title: e.target.value })
                  }}
                  className={`min-w-40 flex-1 ${fieldClass}`}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
