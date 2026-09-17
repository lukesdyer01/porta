export interface SplitRow {
  profileId: string
  shareCents: number
  weight: number
}

/**
 * Largest-remainder allocation.
 *
 * $100 three ways is 33.34 / 33.33 / 33.33, never 33.33 × 3 with a cent
 * vanishing. Leftover cents go to the largest fractional parts, ties broken by
 * index so the same inputs always produce the same output — re-saving an
 * expense must not shuffle who carries the extra penny.
 */
export function allocate(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, w) => a + w, 0)
  if (weights.length === 0) return []
  if (sum <= 0) throw new Error('Split weights must be positive.')

  const exact = weights.map((w) => (totalCents * w) / sum)
  const floors = exact.map(Math.floor)
  let remainder = totalCents - floors.reduce((a, n) => a + n, 0)

  const order = exact
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx)

  const out = [...floors]
  for (let k = 0; remainder > 0; k++, remainder--) out[order[k % order.length].idx] += 1
  return out
}

export function equalSplit(totalCents: number, profileIds: string[]): SplitRow[] {
  const cents = allocate(
    totalCents,
    profileIds.map(() => 1),
  )
  return profileIds.map((profileId, i) => ({ profileId, shareCents: cents[i], weight: 1 }))
}

/**
 * One share per household — how the house cost actually splits. Check all four
 * Kings and they still carry a single family share between them.
 */
export function householdSplit(
  totalCents: number,
  selected: { profileId: string; householdId: string | null }[],
): SplitRow[] {
  const groups = new Map<string, string[]>()
  for (const s of selected) {
    // Nobody without a household gets merged with anyone else without one.
    const key = s.householdId ?? `solo:${s.profileId}`
    groups.set(key, [...(groups.get(key) ?? []), s.profileId])
  }

  const keys = [...groups.keys()]
  const perHousehold = allocate(
    totalCents,
    keys.map(() => 1),
  )

  return keys.flatMap((key, hIdx) => {
    const members = groups.get(key)!
    const within = allocate(
      perHousehold[hIdx],
      members.map(() => 1),
    )
    return members.map((profileId, i) => ({
      profileId,
      shareCents: within[i],
      weight: 1 / members.length,
    }))
  })
}

export function customSplit(entries: Record<string, number>): SplitRow[] {
  return Object.entries(entries).map(([profileId, cents]) => ({
    profileId,
    shareCents: cents,
    weight: 1,
  }))
}
