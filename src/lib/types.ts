export type MemberRole = 'member' | 'organizer'

export interface Household {
  id: string
  name: string
  color: string
  sort_order: number
}

export interface Profile {
  id: string
  email: string
  full_name: string
  display_name: string
  avatar_path: string | null
  household_id: string | null
  role: MemberRole
  is_active: boolean
}
