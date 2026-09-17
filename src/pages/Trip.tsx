import { ExternalLink, Home as HomeIcon, MapPin, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import DeleteTrip from '../components/DeleteTrip'
import HouseForm from '../components/HouseForm'
import HousePhoto from '../components/HousePhoto'
import HouseReviews from '../components/HouseReviews'
import HouseInfoPanel from '../components/HouseInfoPanel'
import RsvpCard from '../components/RsvpCard'
import TripForm, { btnGhost, btnPrimary } from '../components/TripForm'
import { dateRange, isPastTrip, money, useHouse } from '../lib/trips'
import { useTripContext } from '../trip/useTrip'
import { usePageTitle } from '../lib/usePageTitle'
import { humanizeError } from '../lib/errors'

export default function Trip() {
  usePageTitle('Trip')
  const navigate = useNavigate()
  const { isOrganizer } = useAuth()
  const { trips, trip, year: yearParam, isLoading, error } = useTripContext()

  const [creating, setCreating] = useState(false)
  const [editingTrip, setEditingTrip] = useState(false)
  const [editingHouse, setEditingHouse] = useState(false)

  const { data: house } = useHouse(trip?.id)

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

  if (trips.length === 0) {
    return (
      <div className="max-w-prose">
        <h2 className="font-display text-2xl font-semibold">No trips yet</h2>
        <p className="mt-2 text-[color:var(--text-muted)]">
          {isOrganizer
            ? 'Start with this year, then add past years whenever you dig up the details.'
            : 'An organizer needs to set up this year’s trip first.'}
        </p>
        {isOrganizer && (
          <button onClick={() => setCreating(true)} className={`mt-5 ${btnPrimary}`}>
            <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
            Create a trip
          </button>
        )}
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="max-w-prose">
        <h2 className="font-display text-2xl font-semibold">No {yearParam} trip</h2>
        <button onClick={() => navigate('/')} className={`mt-4 ${btnGhost}`}>
          Go to the latest trip
        </button>
      </div>
    )
  }

  const when = dateRange(trip.start_date, trip.end_date)

  return (
    <div className="max-w-3xl">
      {/* ---- trip header ---- */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* The header already says the year, so lead with whatever else
              identifies this trip and only fall back to the year. */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold">
              {trip.name || when || trip.year}
            </h2>
            {trip.status !== 'active' && (
              <span className="rounded-full bg-[color:var(--surface-sunk)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--text-muted)]">
                {trip.status}
              </span>
            )}
          </div>
          {trip.name && when && (
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{when}</p>
          )}
        </div>


        {isOrganizer && (
          <button onClick={() => setCreating(true)} className={btnGhost} title="New trip">
            <Plus className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {trip.notes && (
        <p className="mt-4 rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {trip.notes}
        </p>
      )}

      {isOrganizer && (
        <div className="mt-4">
          {editingTrip ? (
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
              <TripForm trip={trip} onDone={() => setEditingTrip(false)} />
            </div>
          ) : (
            <button
              onClick={() => setEditingTrip(true)}
              className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit trip details
            </button>
          )}
        </div>
      )}

      {/* ---- rsvp ---- */}
      <div className="mt-8">
        <RsvpCard tripId={trip.id} past={isPastTrip(trip)} />
      </div>

      {/* ---- house ---- */}
      <section className="mt-8">
        <h3 className="flex items-center gap-2 font-medium">
          <HomeIcon className="size-4" aria-hidden="true" />
          The house
        </h3>

        {editingHouse ? (
          <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
            <HouseForm tripId={trip.id} house={house} onDone={() => setEditingHouse(false)} />
          </div>
        ) : house ? (
          <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
            <HousePhoto houseId={house.id} tripId={trip.id} />
            {house.name && <p className="font-display text-lg font-semibold">{house.name}</p>}

            {house.address_line1 && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(
                  [house.address_line1, house.address_line2, house.city, house.state, house.postal_code]
                    .filter(Boolean)
                    .join(', '),
                )}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex items-start gap-1.5 text-sm text-[color:var(--accent)] hover:underline"
              >
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {house.address_line1}
                  {house.address_line2 ? `, ${house.address_line2}` : ''}
                  <br />
                  {house.city}, {house.state} {house.postal_code}
                </span>
              </a>
            )}

            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {house.cost_cents != null && (
                <div>
                  <dt className="text-[color:var(--text-muted)]">Cost</dt>
                  <dd className="font-medium">{money(house.cost_cents)}</dd>
                </div>
              )}
              {house.bedrooms != null && (
                <div>
                  <dt className="text-[color:var(--text-muted)]">Bedrooms</dt>
                  <dd className="font-medium">{house.bedrooms}</dd>
                </div>
              )}
              {house.sleeps != null && (
                <div>
                  <dt className="text-[color:var(--text-muted)]">Sleeps</dt>
                  <dd className="font-medium">{house.sleeps}</dd>
                </div>
              )}
            </dl>

            {house.rental_url && (
              <a
                href={house.rental_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-[color:var(--accent)] hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                View the listing
              </a>
            )}

            {house.notes && (
              <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--text-muted)]">
                {house.notes}
              </p>
            )}

            {isOrganizer && (
              <button
                onClick={() => setEditingHouse(true)}
                className="mt-4 flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit house
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-[color:var(--border)] p-5">
            <p className="text-sm text-[color:var(--text-muted)]">
              No house recorded for {trip.year} yet.
            </p>
            {isOrganizer && (
              <button onClick={() => setEditingHouse(true)} className={`mt-3 ${btnPrimary}`}>
                <Plus className="mr-1.5 inline size-4" aria-hidden="true" />
                Add the house
              </button>
            )}
          </div>
        )}
      </section>

      {/* ---- codes ---- */}
      {house && (
        <div className="mt-6">
          <HouseInfoPanel houseId={house.id} tripId={trip.id} />
        </div>
      )}

      {/* ---- ratings ---- */}
      {house && (
        <div className="mt-6">
          <HouseReviews houseId={house.id} />
        </div>
      )}

      {isOrganizer && <DeleteTrip trip={trip} />}
    </div>
  )
}
