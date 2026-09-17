import { describe, expect, it } from 'vitest'
import { nextTripCountdown } from './countdown'
import type { Trip } from './types'
const t = (year: number, s: string | null, e: string | null): Trip => ({
  id: String(year), year, name: '', start_date: s, end_date: e, status: 'planning', notes: null,
})
// Exactly what is in the database right now.
const REAL = [
  t(2027, '2027-09-12', '2027-09-18'),
  t(2026, '2026-09-13', '2026-09-19'),
  t(2025, null, null),
  t(2024, '2024-09-09', '2024-09-15'),
  t(2023, '2023-09-21', '2023-09-26'),
]
const on = (iso: string) => new Date(`${iso}T12:00:00`)
describe('against the real trips', () => {
  it('says the 2026 trip is happening today', () => {
    expect(nextTripCountdown(REAL, on('2026-09-17'))).toMatchObject({ state: 'during', dayOf: 5, total: 7 })
  })
  it('counts the last day as still on', () => {
    expect(nextTripCountdown(REAL, on('2026-09-19'))).toMatchObject({ state: 'during', dayOf: 7, total: 7 })
  })
  it('flips to 2027 the day after it ends', () => {
    const c = nextTripCountdown(REAL, on('2026-09-20'))
    expect(c).toMatchObject({ state: 'upcoming', days: 357 })
    if (c.state === 'upcoming') expect(c.trip.year).toBe(2027)
  })
  it('ignores the 2025 trip that has no dates', () => {
    const c = nextTripCountdown(REAL, on('2026-09-20'))
    if (c.state === 'upcoming') expect(c.trip.year).not.toBe(2025)
  })
})
