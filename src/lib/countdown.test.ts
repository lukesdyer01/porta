import { describe, expect, it } from 'vitest'
import { daysBetween, localToday, nextTripCountdown } from './countdown'
import type { Trip } from './types'

const trip = (o: Partial<Trip>): Trip => ({
  id: String(o.year ?? 'x'), year: 2026, name: '', start_date: null, end_date: null,
  status: 'planning', notes: null, ...o,
})

// Local noon, so these assertions don't depend on the machine's timezone.
const on = (iso: string) => new Date(`${iso}T12:00:00`)

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-07-01', '2026-07-08')).toBe(7)
    expect(daysBetween('2026-07-01', '2026-07-01')).toBe(0)
  })
  it('counts backwards as negative', () => {
    expect(daysBetween('2026-07-08', '2026-07-01')).toBe(-7)
  })
  it('crosses a daylight-saving boundary without slipping a day', () => {
    // US DST starts 2026-03-08; a midnight anchor loses an hour here.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })
  it('crosses a year boundary', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3)
  })
})

describe('localToday', () => {
  it('uses the local calendar date, not UTC', () => {
    // Late evening local time is already tomorrow in UTC for US zones.
    expect(localToday(new Date(2026, 6, 4, 23, 30))).toBe('2026-07-04')
  })
})

describe('nextTripCountdown', () => {
  const trips = [
    trip({ year: 2027, start_date: '2027-07-03', end_date: '2027-07-10' }),
    trip({ year: 2026, start_date: '2026-07-04', end_date: '2026-07-11' }),
    trip({ year: 2025, start_date: '2025-07-05', end_date: '2025-07-12' }),
  ]

  it('counts down to the soonest trip still ahead', () => {
    const c = nextTripCountdown(trips, on('2026-06-04'))
    expect(c.state).toBe('upcoming')
    if (c.state === 'upcoming') {
      expect(c.trip.year).toBe(2026)
      expect(c.days).toBe(30)
    }
  })

  it('says one day the day before', () => {
    const c = nextTripCountdown(trips, on('2026-07-03'))
    expect(c).toMatchObject({ state: 'upcoming', days: 1 })
  })

  it('switches to today on the first morning', () => {
    const c = nextTripCountdown(trips, on('2026-07-04'))
    expect(c.state).toBe('today')
  })

  it('reports which day of the trip it is, inclusive', () => {
    const c = nextTripCountdown(trips, on('2026-07-06'))
    expect(c).toMatchObject({ state: 'during', dayOf: 3, total: 8 })
  })

  it('still counts the final day as part of the trip', () => {
    expect(nextTripCountdown(trips, on('2026-07-11')).state).toBe('during')
  })

  it('moves to the next year once a trip ends', () => {
    const c = nextTripCountdown(trips, on('2026-07-12'))
    expect(c).toMatchObject({ state: 'upcoming' })
    if (c.state === 'upcoming') expect(c.trip.year).toBe(2027)
  })

  it('ignores trips with no start date', () => {
    expect(nextTripCountdown([trip({ year: 2030 })], on('2026-01-01')).state).toBe('none')
  })

  it('returns none when every trip is behind us', () => {
    expect(nextTripCountdown(trips, on('2028-01-01')).state).toBe('none')
  })

  it('treats a single-day trip with no end date as ending that day', () => {
    const one = [trip({ year: 2026, start_date: '2026-07-04' })]
    expect(nextTripCountdown(one, on('2026-07-04')).state).toBe('today')
    expect(nextTripCountdown(one, on('2026-07-05')).state).toBe('none')
  })
})
