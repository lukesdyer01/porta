import { useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTrips } from '../lib/trips'
import { parsePath, TripContext, YEAR_SCOPED, type TripContextValue } from './context'

export function TripProvider({ children }: { children: ReactNode }) {
  const { data: trips = [], isLoading, error } = useTrips()
  const location = useLocation()
  const navigate = useNavigate()

  const value = useMemo<TripContextValue>(() => {
    const { section, year: urlYear } = parsePath(location.pathname)

    // The URL wins when it names a year; otherwise fall back to the newest
    // trip, which is what people want the overwhelming majority of the time.
    const trip = urlYear ? trips.find((t) => t.year === urlYear) : trips[0]
    const year = trip?.year ?? urlYear ?? null

    return {
      trips,
      trip,
      year,
      isLoading,
      error,
      setYear: (next: number) => {
        const target = YEAR_SCOPED.has(section) ? section : 'trip'
        navigate(`/${target}/${next}`)
      },
      linkTo: (target: string) =>
        YEAR_SCOPED.has(target) && year ? `/${target}/${year}` : `/${target}`,
    }
  }, [trips, isLoading, error, location.pathname, navigate])

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}
