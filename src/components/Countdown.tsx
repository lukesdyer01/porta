import { PartyPopper, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { nextTripCountdown } from '../lib/countdown'
import { dateRange } from '../lib/trips'
import type { Trip } from '../lib/types'

export default function Countdown({ trips }: { trips: Trip[] }) {
  const c = nextTripCountdown(trips)
  if (c.state === 'none') return null

  const when = dateRange(c.trip.start_date, c.trip.end_date)

  const headline =
    c.state === 'upcoming'
      ? `${c.days} ${c.days === 1 ? 'day' : 'days'} to go`
      : c.state === 'today'
        ? "It's here"
        : `Day ${c.dayOf} of ${c.total}`

  const sub =
    c.state === 'upcoming'
      ? `until ${c.trip.year} at the beach`
      : c.state === 'today'
        ? `${c.trip.year} starts today`
        : `${c.trip.year} is happening now`

  const Icon = c.state === 'upcoming' ? Sun : PartyPopper

  return (
    <Link
      to={`/trip/${c.trip.year}`}
      className="flex items-center gap-4 rounded-xl border border-[color:var(--border)] bg-gradient-to-br from-[color:var(--color-sunset-300)]/25 to-[color:var(--color-gulf-100)]/40 px-5 py-4 transition hover:border-[color:var(--accent)]"
    >
      <Icon className="size-8 shrink-0 text-[color:var(--color-sunset-600)]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-display text-2xl leading-tight font-semibold">{headline}</p>
        <p className="text-sm text-[color:var(--text-muted)]">
          {sub}
          {when ? ` · ${when}` : ''}
        </p>
      </div>
    </Link>
  )
}
