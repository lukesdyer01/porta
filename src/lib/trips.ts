import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Household, House, HouseInfo, HouseReview, Meal, Rsvp, Trip, TripEvent } from './types'

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

export function useRsvps(tripId: string | undefined) {
  return useQuery({
    enabled: Boolean(tripId),
    queryKey: ['rsvps', tripId],
    queryFn: async (): Promise<Rsvp[]> => {
      const { data, error } = await supabase
        .from('rsvps')
        .select(
          // rsvps points at profiles twice (profile_id and created_by), so the
          // foreign key has to be named or PostgREST refuses the embed with
          // PGRST201 and the whole roster query fails.
          'id, trip_id, profile_id, guest_name, status, adults, kids, headcount, arrival_date, departure_date, notes, profile:profiles!rsvps_profile_id_fkey(display_name, household_id)',
        )
        .eq('trip_id', tripId!)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Rsvp[]
    },
  })
}

export function useReviews(houseId: string | undefined) {
  return useQuery({
    enabled: Boolean(houseId),
    queryKey: ['reviews', houseId],
    queryFn: async (): Promise<HouseReview[]> => {
      const { data, error } = await supabase
        .from('house_reviews')
        .select('id, house_id, profile_id, rating, comment, updated_at, profile:profiles(display_name)')
        .eq('house_id', houseId!)
        .order('updated_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as HouseReview[]
    },
  })
}

/** Ratings are optional, so the average must ignore comment-only reviews. */
export function averageRating(reviews: HouseReview[]): { avg: number; count: number } {
  const rated = reviews.filter((r) => r.rating != null)
  if (rated.length === 0) return { avg: 0, count: 0 }
  return {
    avg: rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length,
    count: rated.length,
  }
}

export function useMeals(tripId: string | undefined) {
  return useQuery({
    enabled: Boolean(tripId),
    queryKey: ['meals', tripId],
    queryFn: async (): Promise<Meal[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select(
          'id, trip_id, meal_date, meal_type, household_id, title, description, household:households(name, color)',
        )
        .eq('trip_id', tripId!)
        .order('meal_date')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Meal[]
    },
  })
}

export function useEvents(tripId: string | undefined) {
  return useQuery({
    enabled: Boolean(tripId),
    queryKey: ['events', tripId],
    queryFn: async (): Promise<TripEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('id, trip_id, title, description, kind, all_day, event_date, start_time, end_time, location, url')
        .eq('trip_id', tripId!)
        .order('event_date')
        .order('start_time', { nullsFirst: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as TripEvent[]
    },
  })
}

export function useHouseholds() {
  return useQuery({
    queryKey: ['households'],
    queryFn: async (): Promise<Household[]> => {
      const { data, error } = await supabase
        .from('households')
        .select('id, name, color, sort_order')
        .order('sort_order')
        .order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as Household[]
    },
  })
}

/** Every date of the trip, so the rotation shows empty nights too. */
export function tripDays(start: string | null, end: string | null): string[] {
  if (!start || !end) return []
  const out: string[] = []
  const d = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  while (d <= last && out.length < 60) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export const dayLabel = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

export const timeLabel = (t: string | null) => {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: m ? '2-digit' : undefined })
}

export interface Member {
  id: string
  display_name: string
  household_id: string | null
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, household_id')
        .eq('is_active', true)
        .order('display_name')
      if (error) throw new Error(error.message)
      return (data ?? []) as Member[]
    },
  })
}

export interface ExpenseRow {
  id: string
  trip_id: string
  payer_id: string
  amount_cents: number
  category: string
  description: string
  incurred_on: string
  split_method: string
  receipt_path: string | null
  payer: { display_name: string } | null
  expense_splits: { profile_id: string; share_cents: number }[]
}

export function useExpenses(tripId: string | undefined) {
  return useQuery({
    enabled: Boolean(tripId),
    queryKey: ['expenses', tripId],
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select(
          'id, trip_id, payer_id, amount_cents, category, description, incurred_on, split_method, receipt_path, payer:profiles!expenses_payer_id_fkey(display_name), expense_splits(profile_id, share_cents)',
        )
        .eq('trip_id', tripId!)
        .order('incurred_on', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as ExpenseRow[]
    },
  })
}

export interface BalanceRow {
  trip_id: string
  profile_id: string
  paid_cents: number
  owed_cents: number
  net_cents: number
}

export function useBalances(tripId: string | undefined) {
  return useQuery({
    enabled: Boolean(tripId),
    queryKey: ['balances', tripId],
    queryFn: async (): Promise<BalanceRow[]> => {
      const { data, error } = await supabase
        .from('trip_balances')
        .select('trip_id, profile_id, paid_cents, owed_cents, net_cents')
        .eq('trip_id', tripId!)
      if (error) throw new Error(error.message)
      return (data ?? []) as BalanceRow[]
    },
  })
}

/**
 * Has this trip already happened?
 *
 * Prefer the end date, since a trip in December of the current year is not
 * past in January. Fall back to the year only when no dates are recorded,
 * which is common for backfilled trips.
 */
export function isPastTrip(trip: Trip | undefined): boolean {
  if (!trip) return false
  if (trip.status === 'archived') return true
  if (trip.end_date) return trip.end_date < new Date().toISOString().slice(0, 10)
  return trip.year < new Date().getFullYear()
}
