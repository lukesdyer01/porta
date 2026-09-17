export type MemberRole = 'member' | 'organizer' | 'owner'

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
  full_name: string | null
  display_name: string | null
  household_id: string | null
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

export interface InviteCode {
  code: string
  label: string | null
  active: boolean
  expires_at: string | null
  max_uses: number | null
  uses: number
  created_at: string
}

export type TripStatus = 'planning' | 'upcoming' | 'active' | 'archived'

export interface Trip {
  id: string
  year: number
  name: string
  start_date: string | null
  end_date: string | null
  status: TripStatus
  notes: string | null
}

export interface House {
  id: string
  trip_id: string
  name: string
  address_line1: string | null
  address_line2: string | null
  city: string
  state: string
  postal_code: string | null
  lat: number | null
  lng: number | null
  rental_url: string | null
  rental_platform: string | null
  cost_cents: number | null
  bedrooms: number | null
  sleeps: number | null
  notes: string | null
}

export interface HouseInfo {
  id: string
  house_id: string
  label: string
  value: string
  sort_order: number
}

export type RsvpStatus = 'yes' | 'no' | 'maybe' | 'pending'

export interface Rsvp {
  id: string
  trip_id: string
  profile_id: string | null
  guest_name: string | null
  status: RsvpStatus
  adults: number
  kids: number
  headcount: number
  arrival_date: string | null
  departure_date: string | null
  notes: string | null
  created_by: string
  profile: { display_name: string; household_id: string | null } | null
  /** Who typed it — differs from the person when the owner entered it. */
  adder: { display_name: string } | null
}

export interface HouseReview {
  id: string
  house_id: string
  profile_id: string
  rating: number | null
  comment: string | null
  updated_at: string
  profile: { display_name: string } | null
}

export type EventKind = 'activity' | 'travel' | 'birthday' | 'reminder' | 'chore' | 'other'

export interface Meal {
  id: string
  trip_id: string
  meal_date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  household_id: string | null
  eat_out: boolean
  title: string
  description: string | null
  household: { name: string; color: string } | null
}

export interface TripEvent {
  id: string
  trip_id: string
  title: string
  description: string | null
  kind: EventKind
  all_day: boolean
  event_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  url: string | null
}

export interface Amenity {
  id: string
  name: string
  sort_order: number
}
