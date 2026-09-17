import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Amenity } from './types'

/** The shared vocabulary every house ticks from. */
export function useAmenities() {
  return useQuery({
    queryKey: ['amenities'],
    queryFn: async (): Promise<Amenity[]> => {
      const { data, error } = await supabase
        .from('amenities')
        .select('id, name, sort_order')
        .order('sort_order')
        .order('name')
      if (error) throw new Error(error.message)
      return (data ?? []) as Amenity[]
    },
  })
}

/** Which amenity ids this house has ticked. */
export function useHouseAmenities(houseId: string | undefined) {
  return useQuery({
    enabled: Boolean(houseId),
    queryKey: ['house-amenities', houseId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('house_amenities')
        .select('amenity_id')
        .eq('house_id', houseId!)
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => r.amenity_id as string)
    },
  })
}

export interface AmenityAcrossYears {
  id: string
  name: string
  years: number[]
}

/**
 * Every amenity with the years that had it — the payoff of a shared list.
 * One query; the grouping is trivial and not worth a database view.
 */
export function useAmenitiesByYear() {
  return useQuery({
    queryKey: ['amenities-by-year'],
    queryFn: async (): Promise<AmenityAcrossYears[]> => {
      const { data, error } = await supabase
        .from('house_amenities')
        .select('amenity:amenities(id, name, sort_order), house:houses(trip:trips(year))')
      if (error) throw new Error(error.message)

      const rows = (data ?? []) as unknown as {
        amenity: { id: string; name: string; sort_order: number } | null
        house: { trip: { year: number } | null } | null
      }[]

      const byId = new Map<string, AmenityAcrossYears & { sort: number }>()
      for (const r of rows) {
        const year = r.house?.trip?.year
        if (!r.amenity || year == null) continue
        const found = byId.get(r.amenity.id) ?? {
          id: r.amenity.id,
          name: r.amenity.name,
          sort: r.amenity.sort_order,
          years: [],
        }
        if (!found.years.includes(year)) found.years.push(year)
        byId.set(r.amenity.id, found)
      }

      return [...byId.values()]
        .map((a) => ({ ...a, years: a.years.sort((x, y) => y - x) }))
        // Most widely shared first: that is the useful reading order when
        // you're deciding what next year's house needs.
        .sort((a, b) => b.years.length - a.years.length || a.sort - b.sort)
        .map(({ id, name, years }) => ({ id, name, years }))
    },
  })
}
