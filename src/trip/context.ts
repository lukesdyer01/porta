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
  /** False on Map and Members, which span every year. */
  sectionScoped: boolean
  isLoading: boolean
  error: unknown
}

export const TripContext = createContext<TripContextValue | null>(null)

/**
 * Sections that belong to one trip. `trips` (the index), `map` and `members`
 * all span every year, so they are deliberately absent.
 */
export const YEAR_SCOPED = new Set(['trip', 'meals', 'calendar', 'expenses', 'photos', 'journal', 'list'])

/** Sections that live behind the phone tab bar's "More" sheet. */
export const MORE_SECTIONS = ['journal', 'list', 'map', 'members', 'profile']

export function parsePath(pathname: string): { section: string; year: number | null } {
  const parts = pathname.split('/').filter(Boolean)
  // The root is the trips index, which covers every year — not a single trip.
  const section = parts[0] || 'trips'
  const raw = parts[1]
  return {
    section,
    year: raw && /^\d{4}$/.test(raw) ? Number(raw) : null,
  }
}
