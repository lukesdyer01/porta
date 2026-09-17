import type { Trip } from './types'

export type Countdown =
  | { state: 'upcoming'; trip: Trip; days: number }
  | { state: 'today'; trip: Trip }
  | { state: 'during'; trip: Trip; dayOf: number; total: number }
  | { state: 'none' }

/** Local calendar date as YYYY-MM-DD — not toISOString, which is UTC. */
export function localToday(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Whole days between two YYYY-MM-DD dates.
 *
 * Anchored at midday so a daylight-saving shift — which moves a midnight
 * anchor by an hour — cannot round the answer to the wrong day.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime()
  return Math.round((at(toIso) - at(fromIso)) / 86_400_000)
}

/**
 * The trip worth counting down to: one happening right now, otherwise the
 * soonest one still ahead. Trips with no start date can't be counted down to.
 */
export function nextTripCountdown(trips: Trip[], now = new Date()): Countdown {
  const today = localToday(now)
  const dated = trips.filter((t): t is Trip & { start_date: string } => Boolean(t.start_date))

  const ongoing = dated
    .filter((t) => t.start_date <= today && (t.end_date ?? t.start_date) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]

  if (ongoing) {
    if (ongoing.start_date === today) return { state: 'today', trip: ongoing }
    const end = ongoing.end_date ?? ongoing.start_date
    return {
      state: 'during',
      trip: ongoing,
      dayOf: daysBetween(ongoing.start_date, today) + 1,
      total: daysBetween(ongoing.start_date, end) + 1,
    }
  }

  const upcoming = dated
    .filter((t) => t.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]

  if (!upcoming) return { state: 'none' }
  return { state: 'upcoming', trip: upcoming, days: daysBetween(today, upcoming.start_date) }
}
