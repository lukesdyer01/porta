import { LogOut, User } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useOnline } from '../lib/useOnline'

const NAV = [
  { to: '/', label: 'Trip', end: true },
  { to: '/meals', label: 'Dinners', end: false },
  { to: '/calendar', label: 'Calendar', end: false },
  { to: '/expenses', label: 'Money', end: false },
  { to: '/photos', label: 'Photos', end: false },
  { to: '/journal', label: 'Journal', end: false },
  { to: '/map', label: 'Map', end: false },
]
const ORGANIZER_NAV = [{ to: '/members', label: 'Members', end: false }]

export default function AppShell() {
  const { profile, signOut, isOrganizer } = useAuth()
  const online = useOnline()
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
            <p className="text-[10px] font-medium tracking-[0.18em] text-[color:var(--text-muted)] uppercase">
              Port Aransas
            </p>
            <h1 className="font-display truncate text-lg leading-tight font-semibold">
              King Family Beach Week
            </h1>
          </div>

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
                key={item.to}
                to={item.to}
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
