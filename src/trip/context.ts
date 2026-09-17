import { createContext } from 'react'
import type { Trip } from '../lib/types'

export interface TripContextValue {
  trips: Trip[]
  /** The trip every section on screen is scoped to. */
  trip: Trip | undefined
  year: number | null
  /** Switch year without leaving the section you're on. */
  setYear: (year: number) => void
  /** Build a link to another section that stays on this trip. */
  linkTo: (section: string) => string
  isLoading: boolean
  error: unknown
}

export const TripContext = createContext<TripContextValue | null>(null)

/** Sections that belong to one trip. `map` and `members` span all years. */
export const YEAR_SCOPED = new Set(['trip', 'meals', 'calendar', 'expenses', 'photos', 'journal'])

export function parsePath(pathname: string): { section: string; year: number | null } {
  const parts = pathname.split('/').filter(Boolean)
  const section = parts[0] ?? 'trip'
  const raw = parts[1]
  return {
    section: section === '' ? 'trip' : section,
    year: raw && /^\d{4}$/.test(raw) ? Number(raw) : null,
  }
}
