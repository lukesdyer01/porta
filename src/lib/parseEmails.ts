/**
 * Pull addresses out of whatever got pasted in — a comma list, one per line, or
 * a copied mail-client string like `Sue <sue@x.com>, Bob <bob@y.com>`.
 * Extracting matches rather than splitting on a delimiter handles all of them.
 */
export function parseEmails(input: string): string[] {
  const found = input.match(/[^\s,;<>()"']+@[^\s,;<>()"']+/g) ?? []
  const seen = new Set<string>()
  for (const raw of found) {
    // Trailing punctuation survives the match when someone ends a line with a period.
    const email = raw.toLowerCase().replace(/[.,;]+$/, '')
    if (email) seen.add(email)
  }
  return [...seen]
}
