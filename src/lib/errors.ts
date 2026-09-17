/**
 * Turn database and network errors into something a family member can act on.
 *
 * Postgres and PostgREST messages name constraints and columns — accurate, and
 * useless to someone standing in a kitchen wondering why their expense will
 * not save.
 */
export function humanizeError(err: unknown): string {
  const raw =
    typeof err === 'string' ? err : err instanceof Error ? err.message : String(err ?? 'Something went wrong.')
  const m = raw.toLowerCase()

  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed'))
    return 'No connection. Check your signal and try again.'
  if (m.includes('jwt') || m.includes('expired') || m.includes('invalid token'))
    return 'Your sign-in expired. Reload the page and sign in again.'

  // 42501 / RLS: the row was filtered out rather than erroring, so "not found"
  // and "not allowed" arrive looking the same.
  if (m.includes('permission denied') || m.includes('42501') || m.includes('row-level security'))
    return "You don't have permission to change that."
  if (m.includes('duplicate key') || m.includes('23505')) return 'That already exists.'
  if (m.includes('violates foreign key') || m.includes('23503'))
    return "Something it refers to is missing — reload and try again."
  if (m.includes('violates check constraint') || m.includes('23514'))
    return "That value isn't allowed."
  if (m.includes('splits add up') || m.includes('shares add up')) return raw // already plain
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Wait a minute.'

  return raw
}
