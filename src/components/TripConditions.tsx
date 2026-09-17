import { CloudRain, Waves } from 'lucide-react'
import { useTides, useWeather } from '../lib/conditions'
import { localToday } from '../lib/countdown'
import { dayLabel } from '../lib/trips'
import type { House, Trip } from '../lib/types'
import CollapsibleCard from './CollapsibleCard'

const hhmm = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  const am = h < 12
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')}${am ? 'am' : 'pm'}`
}

export default function TripConditions({ trip, house }: { trip: Trip; house?: House | null }) {
  // Once a trip is under way its earlier days are history. Asking only from
  // today also stops both fetches hauling back days nobody will look at.
  const today = localToday()
  const hasRange = Boolean(trip.start_date && trip.end_date && trip.end_date >= today)
  const from = hasRange ? (trip.start_date! > today ? trip.start_date! : today) : null
  const to = hasRange ? trip.end_date : null

  const { data: weather = [] } = useWeather(
    from,
    to,
    house?.lat ?? undefined,
    house?.lng ?? undefined,
  )
  const { data: tides = {} } = useTides(from, to)

  // Belt and braces: a free service is at liberty to return a wider range
  // than it was asked for.
  const days = [...new Set([...weather.map((w) => w.date), ...Object.keys(tides)])]
    .filter((d) => d >= today)
    .sort()

  // Both feeds are somebody else's service. Nothing to show is not an error
  // worth putting on screen — it is just a quiet gap.
  if (days.length === 0) return null

  const byDate = new Map(weather.map((w) => [w.date, w]))

  // Collapsed, the header still has to be worth reading: today's numbers if
  // there are any, otherwise how many days it covers.
  const todayIso = new Date().toISOString().slice(0, 10)
  const peek = byDate.get(todayIso) ?? byDate.get(days[0])
  const summary = peek
    ? `${peek.highF}° / ${peek.lowF}°${peek.rainChance > 15 ? ` · ${peek.rainChance}% rain` : ''}`
    : `${days.length} ${days.length === 1 ? 'day' : 'days'}`

  return (
    <CollapsibleCard
      id="conditions"
      icon={<Waves className="size-4" aria-hidden="true" />}
      title="Weather & tides"
      summary={summary}
    >
      <ul className="divide-y divide-[color:var(--border)]">
        {days.map((d) => {
          const w = byDate.get(d)
          const t = tides[d] ?? []
          return (
            <li key={d} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="w-24 shrink-0 font-medium">{dayLabel(d)}</span>

              {w ? (
                <span className="flex items-center gap-2">
                  <span className="font-mono">
                    {w.highF}&deg; / {w.lowF}&deg;
                  </span>
                  {w.rainChance > 15 && (
                    <span className="flex items-center gap-1 text-[color:var(--text-muted)]">
                      <CloudRain className="size-3.5" aria-hidden="true" />
                      {w.rainChance}%
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs text-[color:var(--text-muted)]">no forecast yet</span>
              )}

              {t.length > 0 && (
                <span className="flex flex-wrap gap-x-2 text-[color:var(--text-muted)]">
                  {t.map((x, i) => (
                    <span key={i} className="font-mono text-xs">
                      {x.type === 'H' ? 'High' : 'Low'} {hhmm(x.time)}
                    </span>
                  ))}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-xs text-[color:var(--text-muted)]">
        Forecast from Open-Meteo; tides from NOAA station 8775237, Port Aransas.
      </p>
    </CollapsibleCard>
  )
}
