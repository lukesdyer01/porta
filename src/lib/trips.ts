import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { House, HouseInfo, Trip } from './types'

const TRIP_COLS = 'id, year, name, start_date, end_date, status, notes'
const HOUSE_COLS =
  'id, trip_id, name, address_line1, address_line2, city, state, postal_code, lat, lng, rental_url, rental_platform, cost_cents, bedrooms, sleeps, notes'

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await supabase
        .from('trips')
        .select(TRIP_COLS)
        .order('year', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as Trip[]
    },
  })
}

export function useHouse(tripId: string | undefined) {
  return useQuery({
    enabled: Boolean(tripId),
    queryKey: ['house', tripId],
    queryFn: async (): Promise<House | null> => {
      const { data, error } = await supabase
        .from('houses')
        .select(HOUSE_COLS)
        .eq('trip_id', tripId!)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as House | null) ?? null
    },
  })
}

export function useHouseInfo(houseId: string | undefined) {
  return useQuery({
    enabled: Boolean(houseId),
    queryKey: ['house-info', houseId],
    queryFn: async (): Promise<HouseInfo[]> => {
      const { data, error } = await supabase
        .from('house_info')
        .select('id, house_id, label, value, sort_order')
        .eq('house_id', houseId!)
        .order('sort_order')
        .order('label')
      if (error) throw new Error(error.message)
      return (data ?? []) as HouseInfo[]
    },
  })
}

/** Dollars in the UI, integer cents in the database — never floats for money. */
export const toCents = (dollars: string): number | null => {
  const n = Number(dollars.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && dollars.trim() !== '' ? Math.round(n * 100) : null
}

export const fromCents = (cents: number | null): string =>
  cents == null ? '' : (cents / 100).toFixed(2)

export const money = (cents: number | null): string =>
  cents == null
    ? '—'
    : (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function dateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  const fmt = (d: string, withYear: boolean) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    })
  if (start && end) return `${fmt(start, false)} – ${fmt(end, true)}`
  return fmt((start ?? end)!, true)
}
