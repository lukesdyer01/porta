import type { Session } from '@supabase/supabase-js'
import { createContext } from 'react'
import type { Profile } from '../lib/types'

export interface AuthState {
  session: Session | null
  profile: Profile | null
  /** True until we know both whether there's a session and who it belongs to. */
  loading: boolean
  /** Signed in, but not on the invite list — shows the "pending" screen. */
  pending: boolean
  isOrganizer: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
