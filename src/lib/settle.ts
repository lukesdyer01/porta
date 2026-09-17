export interface Balance {
  profileId: string
  netCents: number
}

export interface Transfer {
  fromProfileId: string
  toProfileId: string
  amountCents: number
}

/**
 * Greedy minimum cash flow: repeatedly match the largest debtor against the
 * largest creditor. At most n-1 transfers, so nobody sends five Venmos.
 *
 * Finding the true minimum is the partition problem and NP-hard. For a family
 * of twenty the greedy result is optimal or off by one transfer, which is not
 * worth an exponential search.
 */
export function settle(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.netCents - b.netCents)
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.netCents - a.netCents)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const amountCents = Math.min(-debtors[i].netCents, creditors[j].netCents)
    if (amountCents > 0) {
      transfers.push({
        fromProfileId: debtors[i].profileId,
        toProfileId: creditors[j].profileId,
        amountCents,
      })
    }
    debtors[i].netCents += amountCents
    creditors[j].netCents -= amountCents
    if (debtors[i].netCents === 0) i++
    if (creditors[j].netCents === 0) j++
  }
  return transfers
}
