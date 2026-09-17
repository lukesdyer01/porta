import { ChevronRight, ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTripItems } from '../lib/items'

/** Keeps the list findable without spending a seventh slot in the tab bar. */
export default function PackingSummary({ tripId, year }: { tripId: string; year: number }) {
  const { data: items = [] } = useTripItems(tripId)
  const done = items.filter((i) => i.done).length
  const unclaimed = items.filter((i) => !i.claimed_by && !i.done).length

  return (
    <Link
      to={`/list/${year}`}
      className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-5 py-4 transition hover:border-[color:var(--accent)]"
    >
      <ListChecks className="size-5 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Packing &amp; shopping</p>
        <p className="text-sm text-[color:var(--text-muted)]">
          {items.length === 0
            ? 'Nothing on the list yet'
            : `${done} of ${items.length} sorted${unclaimed > 0 ? ` · ${unclaimed} still unclaimed` : ''}`}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
    </Link>
  )
}
