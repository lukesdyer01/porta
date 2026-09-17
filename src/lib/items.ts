import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { TripItem } from './types'

export function useTripItems(tripId: string | undefined) {
  return useQuery({
    enabled: Boolean(tripId),
    queryKey: ['trip-items', tripId],
    queryFn: async (): Promise<TripItem[]> => {
      const { data, error } = await supabase
        .from('trip_items')
        // trip_items points at profiles twice (claimed_by and created_by), so
        // the foreign key has to be named or PostgREST refuses the embed.
        .select('id, trip_id, kind, name, claimed_by, done, claimer:profiles!trip_items_claimed_by_fkey(display_name)')
        .eq('trip_id', tripId!)
        .order('done')
        .order('created_at')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as TripItem[]
    },
  })
}
