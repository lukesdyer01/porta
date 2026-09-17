import { LogOut, User } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useOnline } from '../lib/useOnline'
import { useTripContext } from '../trip/useTrip'

const NAV = [
  { section: 'trip', label: 'Trip', end: false },
  { section: 'meals', label: 'Dinners', end: false },
  { section: 'calendar', label: 'Calendar', end: false },
  { section: 'expenses', label: 'Money', end: false },
  { section: 'photos', label: 'Photos', end: false },
  { section: 'journal', label: 'Journal', end: false },
  { section: 'map', label: 'Map', end: false },
]
const ORGANIZER_NAV = [{ section: 'members', label: 'Members', end: false }]

export default function AppShell() {
  const { profile, signOut, isOrganizer } = useAuth()
  const online = useOnline()
  const { trips, year, setYear, linkTo, sectionScoped } = useTripContext()
  const nav = isOrganizer ? [...NAV, ...ORGANIZER_NAV] : NAV

  return (
    <div className="flex min-h-dvh flex-col">
      {!online && (
        <p
          role="status"
          className="bg-[color:var(--color-sunset-500)] px-4 py-1.5 text-center text-sm text-white"
        >
          You&rsquo;re offline — changes won&rsquo;t save until the signal comes back.
        </p>
      )}
      <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--surface-raised)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-xl leading-tight font-semibold">
              {/* Map and Members cover every year, so a single year would be a
                  lie there — fall back to the app's name. */}
              {sectionScoped && year != null ? year : 'King Family Beach Week'}
            </h1>
          </div>

          {sectionScoped && trips.length > 1 && year != null && (
            <select
              aria-label="Switch year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="shrink-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]"
            >
              {trips.map((t) => (
                <option key={t.id} value={t.year}>
                  {t.year}
                </option>
              ))}
            </select>
          )}

          <NavLink
            to="/profile"
            aria-label="Your profile"
            title={profile?.display_name ?? 'Profile'}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)]"
          >
            <User className="size-4" aria-hidden="true" />
          </NavLink>

          <button
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-[color:var(--border)] transition hover:bg-[color:var(--surface-sunk)]"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/*
          Scrolls sideways rather than hiding on small screens. This was
          `hidden sm:flex`, which left a phone — the only device this is used on
          at the beach — with no navigation at all.
        */}
        <nav className="mx-auto max-w-5xl overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.section}
                to={linkTo(item.section)}
                end={item.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                      : 'hover:bg-[color:var(--surface-sunk)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
