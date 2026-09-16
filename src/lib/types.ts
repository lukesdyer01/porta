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

export interface AdminMember {
  email: string
  note: string | null
  invited_role: MemberRole
  invited_at: string
  profile_id: string | null
  display_name: string | null
  profile_role: MemberRole | null
  is_active: boolean
  household_name: string | null
  has_signed_in: boolean
}

export interface AddMembersResult {
  added: string[]
  existing: string[]
  invalid: string[]
}
