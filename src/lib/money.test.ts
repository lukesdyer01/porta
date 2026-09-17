import { describe, expect, it } from 'vitest'
import { settle, type Balance } from './settle'
import { allocate, equalSplit, householdSplit } from './splits'

const sum = (ns: number[]) => ns.reduce((a, n) => a + n, 0)

describe('allocate', () => {
  it('never loses or invents a cent', () => {
    for (const total of [1, 2, 99, 100, 333, 1000, 3200_00, 10_01, 7]) {
      for (const n of [1, 2, 3, 4, 5, 7, 11]) {
        const parts = allocate(
          total,
          Array.from({ length: n }, () => 1),
        )
        expect(sum(parts), `${total}c across ${n}`).toBe(total)
      }
    }
  })

  it('splits $100 three ways as 33.34 / 33.33 / 33.33', () => {
    expect(allocate(10000, [1, 1, 1])).toEqual([3334, 3333, 3333])
  })

  it('gives a single person everything', () => {
    expect(allocate(777, [1])).toEqual([777])
  })

  it('handles a total too small to go round', () => {
    const parts = allocate(2, [1, 1, 1, 1, 1])
    expect(sum(parts)).toBe(2)
    expect(parts.filter((n) => n === 1)).toHaveLength(2)
  })

  it('is deterministic, so re-saving does not move the spare penny', () => {
    expect(allocate(10_00, [1, 1, 1])).toEqual(allocate(10_00, [1, 1, 1]))
  })

  it('respects uneven weights', () => {
    expect(allocate(10000, [3, 1])).toEqual([7500, 2500])
  })

  it('rejects weights that sum to zero', () => {
    expect(() => allocate(100, [0, 0])).toThrow()
  })
})

describe('equalSplit', () => {
  it('sums to the total and covers everyone', () => {
    const rows = equalSplit(10_01, ['a', 'b', 'c'])
    expect(rows).toHaveLength(3)
    expect(sum(rows.map((r) => r.shareCents))).toBe(10_01)
  })
})

describe('householdSplit', () => {
  it('charges one share per household, not per person', () => {
    // Four Kings and one solo guest: two households, so 50/50 — not 80/20.
    const rows = householdSplit(100_00, [
      { profileId: 'k1', householdId: 'kings' },
      { profileId: 'k2', householdId: 'kings' },
      { profileId: 'k3', householdId: 'kings' },
      { profileId: 'k4', householdId: 'kings' },
      { profileId: 'solo', householdId: 'daves' },
    ])
    const kings = rows.filter((r) => r.profileId.startsWith('k'))
    expect(sum(kings.map((r) => r.shareCents))).toBe(50_00)
    expect(rows.find((r) => r.profileId === 'solo')!.shareCents).toBe(50_00)
    expect(sum(rows.map((r) => r.shareCents))).toBe(100_00)
  })

  it('never merges two people who both have no household', () => {
    const rows = householdSplit(100_00, [
      { profileId: 'a', householdId: null },
      { profileId: 'b', householdId: null },
    ])
    expect(rows.map((r) => r.shareCents).sort()).toEqual([50_00, 50_00])
  })

  it('still reconciles when a household share divides unevenly', () => {
    const rows = householdSplit(100_01, [
      { profileId: 'a', householdId: 'h1' },
      { profileId: 'b', householdId: 'h1' },
      { profileId: 'c', householdId: 'h1' },
      { profileId: 'd', householdId: 'h2' },
    ])
    expect(sum(rows.map((r) => r.shareCents))).toBe(100_01)
  })
})

describe('settle', () => {
  const total = (ts: { amountCents: number }[]) => sum(ts.map((t) => t.amountCents))

  it('clears every balance', () => {
    const balances: Balance[] = [
      { profileId: 'a', netCents: 6000 },
      { profileId: 'b', netCents: -2000 },
      { profileId: 'c', netCents: -4000 },
    ]
    const ts = settle(balances)
    const net = new Map(balances.map((b) => [b.profileId, b.netCents]))
    for (const t of ts) {
      net.set(t.fromProfileId, net.get(t.fromProfileId)! + t.amountCents)
      net.set(t.toProfileId, net.get(t.toProfileId)! - t.amountCents)
    }
    for (const v of net.values()) expect(v).toBe(0)
  })

  it('uses at most n-1 transfers', () => {
    const balances: Balance[] = [
      { profileId: 'a', netCents: 10000 },
      { profileId: 'b', netCents: -3000 },
      { profileId: 'c', netCents: -3000 },
      { profileId: 'd', netCents: -4000 },
    ]
    expect(settle(balances).length).toBeLessThanOrEqual(balances.length - 1)
  })

  it('asks for nothing when everyone is square', () => {
    expect(settle([{ profileId: 'a', netCents: 0 }])).toEqual([])
    expect(settle([])).toEqual([])
  })

  it('moves exactly what is owed, no more', () => {
    const ts = settle([
      { profileId: 'a', netCents: 2500 },
      { profileId: 'b', netCents: -2500 },
    ])
    expect(total(ts)).toBe(2500)
    expect(ts).toHaveLength(1)
  })
})
