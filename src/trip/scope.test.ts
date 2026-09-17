import { describe, expect, it } from 'vitest'
import { parsePath, YEAR_SCOPED } from './context'

describe('parsePath', () => {
  it('reads the year out of a section path', () => {
    expect(parsePath('/meals/2025')).toEqual({ section: 'meals', year: 2025 })
    expect(parsePath('/trip/1999')).toEqual({ section: 'trip', year: 1999 })
  })
  it('treats the root as the trips index, not a single trip', () => {
    expect(parsePath('/')).toEqual({ section: 'trips', year: null })
    expect(parsePath('')).toEqual({ section: 'trips', year: null })
  })

  it('keeps the index unscoped and a single trip scoped', () => {
    expect(YEAR_SCOPED.has('trips')).toBe(false)
    expect(YEAR_SCOPED.has('trip')).toBe(true)
  })
  it('leaves the year null when the path has none', () => {
    expect(parsePath('/expenses')).toEqual({ section: 'expenses', year: null })
  })
  it('ignores a non-year second segment', () => {
    expect(parsePath('/members/anything')).toEqual({ section: 'members', year: null })
  })
  it('scopes exactly the per-trip sections', () => {
    for (const s of ['trip', 'meals', 'calendar', 'expenses', 'photos', 'journal'])
      expect(YEAR_SCOPED.has(s), s).toBe(true)
    for (const s of ['map', 'members', 'profile']) expect(YEAR_SCOPED.has(s), s).toBe(false)
  })
})

import { isPastTrip } from '../lib/trips'
import type { Trip } from '../lib/types'

const trip = (o: Partial<Trip>): Trip => ({
  id: 'x', year: 2026, name: '', start_date: null, end_date: null,
  status: 'planning', notes: null, ...o,
})

describe('isPastTrip', () => {
  const thisYear = new Date().getFullYear()

  it('treats an archived trip as past whatever its dates say', () => {
    expect(isPastTrip(trip({ status: 'archived', year: thisYear + 5 }))).toBe(true)
  })

  it('prefers the end date over the year', () => {
    // December of this year is not past just because it is the current year.
    expect(isPastTrip(trip({ year: thisYear, end_date: `${thisYear}-12-31` }))).toBe(false)
    expect(isPastTrip(trip({ year: thisYear, end_date: `${thisYear - 1}-07-08` }))).toBe(true)
  })

  it('falls back to the year when a backfilled trip has no dates', () => {
    expect(isPastTrip(trip({ year: thisYear - 1 }))).toBe(true)
    expect(isPastTrip(trip({ year: thisYear }))).toBe(false)
    expect(isPastTrip(trip({ year: thisYear + 1 }))).toBe(false)
  })

  it('is false when there is no trip', () => {
    expect(isPastTrip(undefined)).toBe(false)
  })
})
