import { useContext } from 'react'
import { TripContext } from './context'

export function useTripContext() {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTripContext must be used inside <TripProvider>')
  return ctx
}
