import { CalendarDays, ChefHat, Images, Menu, Palmtree, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MORE_SECTIONS, parsePath } from '../trip/context'
import { useTripContext } from '../trip/useTrip'
import MoreSheet from './MoreSheet'

const TABS = [
  // The index and a single trip are the same tab: you tap a year and push in.
  { key: 'trips', label: 'Trips', Icon: Palmtree, matches: ['trips', 'trip'] },
  { key: 'meals', label: 'Dinners', Icon: ChefHat, matches: ['meals'] },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays, matches: ['calendar'] },
  { key: 'expenses', label: 'Money', Icon: Receipt, matches: ['expenses'] },
  { key: 'photos', label: 'Photos', Icon: Images, matches: ['photos'] },
]

export default function TabBar() {
  const { linkTo } = useTripContext()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const { section } = parsePath(pathname)

  const moreActive = MORE_SECTIONS.includes(section)

  return (
    <>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />

      {/*
        Fixed, so it sits at the true viewport bottom and ignores the
        safe-area padding on <body>. Without its own bottom padding the labels
        land under the iPhone home indicator.
      */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-[color:var(--surface-raised)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {TABS.map(({ key, label, Icon, matches }) => {
            const active = matches.includes(section)
            return (
              <li key={key} className="flex-1">
                <Link
                  to={key === 'trips' ? '/' : linkTo(key)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                    active ? 'text-[color:var(--accent)]' : 'text-[color:var(--text-muted)]'
                  }`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            )
          })}

          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={`flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                moreActive || moreOpen
                  ? 'text-[color:var(--accent)]'
                  : 'text-[color:var(--text-muted)]'
              }`}
            >
              <Menu className="size-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
