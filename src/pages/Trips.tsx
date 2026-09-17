import { useQuery } from '@tanstack/react-query'
import { ImageOff, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import Countdown from '../components/Countdown'
import TripForm, { btnPrimary } from '../components/TripForm'
import { humanizeError } from '../lib/errors'
import { dateRange, isPastTrip, money, useTrips } from '../lib/trips'
import { usePageTitle } from '../lib/usePageTitle'
import { supabase } from '../lib/supabase'
import type { Trip } from '../lib/types'

const SIGN_TTL = 60 * 60

interface TripCard {
  houseName: string | null
  costCents: number | null
  imageUrl: string | null
}

/**
 * Everything the cards need, in a fixed number of round trips no matter how
 * many years exist: houses, then their photos, then ONE batch signing call.
 * Signing per card the way HousePhoto does would be a request per trip.
 */
function useTripCards(trips: Trip[]) {
  const ids = trips.map((t) => t.id).sort()
  return useQuery({
    enabled: ids.length > 0,
    queryKey: ['trip-cards', ids],
    queryFn: async (): Promise<Record<string, TripCard>> => {
      const { data: houses, error: hErr } = await supabase
        .from('houses')
        .select('id, trip_id, name, cost_cents')
        .in('trip_id', ids)
      if (hErr) throw new Error(hErr.message)

      const cards: Record<string, TripCard> = {}
      const houseToTrip = new Map<string, string>()
      for (const h of houses ?? []) {
        houseToTrip.set(h.id, h.trip_id)
        cards[h.trip_id] = { houseName: h.name || null, costCents: h.cost_cents, imageUrl: null }
      }

      const houseIds = [...houseToTrip.keys()]
      if (houseIds.length === 0) return cards

      const { data: photos, error: pErr } = await supabase
        .from('photos')
        .select('house_id, storage_path, sort_order')
        .in('house_id', houseIds)
        .order('sort_order')
      if (pErr) throw new Error(pErr.message)

      // Lowest sort_order wins; the query is ordered, so first seen is first.
      const firstPath = new Map<string, string>()
      for (const p of photos ?? []) {
        if (p.house_id && !firstPath.has(p.house_id)) firstPath.set(p.house_id, p.storage_path)
      }
      const paths = [...firstPath.values()]
      if (paths.length === 0) return cards

      const { data: signed, error: sErr } = await supabase.storage
        .from('photos')
        .createSignedUrls(paths, SIGN_TTL)
      if (sErr) throw new Error(sErr.message)

      const urls = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path!, s.signedUrl!]))
      for (const [houseId, path] of firstPath) {
        const tripId = houseToTrip.get(houseId)!
        const url = urls.get(path)
        if (cards[tripId] && url) cards[tripId].imageUrl = url
      }
      return cards
    },
  })
}

export default function Trips() {
  usePageTitle('Trips')
  const { isOrganizer } = useAuth()
  const navigate = useNavigate()
  const { data: trips = [], isLoading, error } = useTrips()
  const { data: cards = {} } = useTripCards(trips)
  const [creating, setCreating] = useState(false)

  if (isLoading) return <p className="text-sm text-[color:var(--text-muted)]">Loading…</p>
  if (error)
    return (
      <p className="text-sm text-[color:var(--color-sunset-600)]">
        Couldn&rsquo;t load trips: {humanizeError(error)}
      </p>
    )

  if (creating) {
    return (
      <div className="max-w-2xl">
        <h2 className="font-display text-2xl font-semibold">New trip</h2>
        <div className="mt-5">
          <TripForm
            onDone={(y) => {
              setCreating(false)
              if (y) navigate(`/trip/${y}`)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Only renders when there is a trip ahead or in progress. */}
      <div className="mb-6">
        <Countdown trips={trips} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold">Every year</h2>
        {isOrganizer && (
          <button onClick={() => setCreating(true)} className={`ml-auto ${btnPrimary}`}>
            <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
            New trip
          </button>
        )}
      </div>

      {trips.length === 0 ? (
        <p className="mt-5 rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          {isOrganizer
            ? 'No trips yet. Start with this year, then add past years whenever you dig up the details.'
            : 'An organizer needs to set up a trip first.'}
        </p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t) => {
            const card = cards[t.id]
            const when = dateRange(t.start_date, t.end_date)
            const past = isPastTrip(t)

            return (
              <li key={t.id}>
                <Link
                  to={`/trip/${t.year}`}
                  className="group block overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] transition hover:border-[color:var(--accent)]"
                >
                  {/* Fixed aspect either way, so a trip with no photo yet does
                      not collapse into a thin strip next to ones that have. */}
                  {card?.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-[3/2] w-full object-cover transition group-hover:opacity-95"
                    />
                  ) : (
                    <div className="grid aspect-[3/2] w-full place-items-center bg-[color:var(--surface-sunk)]">
                      <ImageOff
                        className="size-7 text-[color:var(--text-muted)] opacity-60"
                        aria-hidden="true"
                      />
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-display text-xl font-semibold">{t.year}</span>
                      {past && (
                        <span className="rounded-full bg-[color:var(--surface-sunk)] px-2 py-0.5 text-xs font-medium text-[color:var(--text-muted)]">
                          past
                        </span>
                      )}
                    </div>

                    {when && <p className="mt-0.5 text-sm text-[color:var(--text-muted)]">{when}</p>}

                    <p className="mt-2 truncate text-sm">
                      {card?.houseName || t.name || (
                        <span className="text-[color:var(--text-muted)]">No house recorded</span>
                      )}
                    </p>

                    {card?.costCents != null && (
                      <p className="mt-1 font-mono text-sm text-[color:var(--text-muted)]">
                        {money(card.costCents)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
