import { describe, expect, it } from 'vitest'
import { parsePath, YEAR_SCOPED } from './context'

describe('parsePath', () => {
  it('reads the year out of a section path', () => {
    expect(parsePath('/meals/2025')).toEqual({ section: 'meals', year: 2025 })
    expect(parsePath('/trip/1999')).toEqual({ section: 'trip', year: 1999 })
  })
  it('treats the index as the trip section', () => {
    expect(parsePath('/')).toEqual({ section: 'trip', year: null })
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
