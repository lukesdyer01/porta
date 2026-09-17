import { describe, expect, it } from 'vitest'
import { forecastAvailable, FORECAST_DAYS } from './conditions'

const on = (iso: string) => new Date(`${iso}T12:00:00`)

describe('forecastAvailable', () => {
  it('is false for a trip beyond the forecast window', () => {
    expect(forecastAvailable('2026-07-04', on('2026-01-01'))).toBe(false)
  })

  it('is true on the last day the forecast reaches', () => {
    // The boundary is the whole point: one day either side is the difference
    // between a working block and an empty one.
    expect(forecastAvailable('2026-07-17', on('2026-07-01'))).toBe(true)
    expect(forecastAvailable('2026-07-18', on('2026-07-01'))).toBe(false)
    expect(FORECAST_DAYS).toBe(16)
  })

  it('is true during the trip, when the start is already behind us', () => {
    expect(forecastAvailable('2026-07-04', on('2026-07-06'))).toBe(true)
  })

  it('is false when the trip has no dates', () => {
    expect(forecastAvailable(null)).toBe(false)
  })
})
