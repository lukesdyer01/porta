import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChefHat, Hand, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { humanizeError } from '../lib/errors'
import { fieldClass } from '../components/TripForm'
import { supabase } from '../lib/supabase'
import { dayLabel, tripDays, useMeals } from '../lib/trips'
import { usePageTitle } from '../lib/usePageTitle'
import { useTripContext } from '../trip/useTrip'

export default function Meals() {
  usePageTitle('Dinners')
  const { profile, isOrganizer } = useAuth()
  const qc = useQueryClient()
  const { trip } = useTripContext()
  const { data: meals = [], isLoading } = useMeals(trip?.id)

  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null)
  const byDate = new Map(meals.filter((m) => m.meal_type === 'dinner').map((m) => [m.meal_date, m]))

  const [error, setError] = useState<string | null>(null)
  const myHousehold = profile?.household_id ?? null

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
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['meals', trip?.id] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  if (!trip) return <p className="text-sm text-[color:var(--text-muted)]">No trip yet.</p>

  return (
    <div className="max-w-3xl">
      <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
        <ChefHat className="size-5" aria-hidden="true" />
        Dinner rotation
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        One family cooks each night. Claim whichever nights suit you &mdash; once a night is
        taken, only that family can change it.
      </p>

      {!myHousehold && !isOrganizer && (
        <p className="mt-4 rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3 text-sm">
          Set your household on your profile first &mdash; that&rsquo;s what claims the night.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm">
          {error}
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
            const claimedBy = meal?.household_id ?? null
            const mine = claimedBy != null && claimedBy === myHousehold
            const free = claimedBy == null
            // Matches the database rule: an unclaimed night, your own night, or
            // anything at all if you organise.
            const canEdit = isOrganizer || free || mine

            return (
              <li key={d} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-medium">{dayLabel(d)}</p>
                </div>

                <div className="flex min-w-44 items-center gap-2">
                  {free ? (
                    <button
                      type="button"
                      disabled={save.isPending || (!myHousehold && !isOrganizer)}
                      onClick={() => save.mutate({ date: d, householdId: myHousehold })}
                      title={!myHousehold ? 'Set your household on your profile first' : undefined}
                      className="flex items-center gap-1.5 rounded-lg border border-[color:var(--accent)] px-3 py-1.5 text-sm font-medium text-[color:var(--accent)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-contrast)] disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:text-[color:var(--text-muted)] disabled:hover:bg-transparent"
                    >
                      <Hand className="size-3.5" aria-hidden="true" />
                      Claim this night
                    </button>
                  ) : (
                    <>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium"
                        style={{
                          backgroundColor: `${meal?.household?.color ?? '#1f8f89'}22`,
                          color: meal?.household?.color ?? undefined,
                        }}
                      >
                        {meal?.household?.name ?? 'Claimed'}
                        {mine && <span className="text-xs opacity-70">(you)</span>}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          disabled={save.isPending}
                          onClick={() => save.mutate({ date: d, householdId: null })}
                          aria-label={`Give up ${dayLabel(d)}`}
                          title="Give this night back"
                          className="grid size-7 place-items-center rounded-full border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {canEdit ? (
                  <input
                    aria-label={`What's for dinner on ${dayLabel(d)}`}
                    defaultValue={meal?.title ?? ''}
                    placeholder="What's cooking?"
                    onBlur={(e) => {
                      if (e.target.value !== (meal?.title ?? ''))
                        save.mutate({ date: d, householdId: claimedBy, title: e.target.value })
                    }}
                    className={`min-w-40 flex-1 ${fieldClass}`}
                  />
                ) : (
                  <p className="min-w-40 flex-1 text-sm text-[color:var(--text-muted)]">
                    {meal?.title || <span className="italic">Not decided yet</span>}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
