import { LogOut, User } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/**
 * Nav grows as phases land. Keep this list short enough to fit a phone's
 * bottom bar without scrolling — that's where it will actually be used.
 */
const NAV = [{ to: '/', label: 'Trip', end: true }]
const ORGANIZER_NAV = [{ to: '/members', label: 'Members', end: false }]

export default function AppShell() {
  const { profile, signOut, isOrganizer } = useAuth()
  const nav = isOrganizer ? [...NAV, ...ORGANIZER_NAV] : NAV

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--surface-raised)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium tracking-[0.18em] text-[color:var(--text-muted)] uppercase">
              Port Aransas
            </p>
            <h1 className="font-display truncate text-lg leading-tight font-semibold">
              King Family Beach Week
            </h1>
          </div>

          <nav className="hidden gap-1 sm:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                      : 'hover:bg-[color:var(--surface-sunk)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

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
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
