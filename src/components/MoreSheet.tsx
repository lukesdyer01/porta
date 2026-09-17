import { BookOpen, LogOut, Map, User, Users, X } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useTripContext } from '../trip/useTrip'

export default function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isOrganizer, signOut } = useAuth()
  const { linkTo } = useTripContext()

  // Escape closes it, like any other dismissible layer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const items = [
    { to: linkTo('journal'), label: 'Journal', Icon: BookOpen },
    { to: '/map', label: 'Map', Icon: Map },
    ...(isOrganizer ? [{ to: '/members', label: 'Members', Icon: Users }] : []),
    { to: '/profile', label: 'Your profile', Icon: User },
  ]

  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/40"
      />

      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[color:var(--border)] bg-[color:var(--surface-raised)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      >
        <div className="flex items-center gap-3 px-5 pt-4 pb-2">
          <p className="font-display text-lg font-semibold">More</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid size-8 place-items-center rounded-full border border-[color:var(--border)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="px-2 pb-2">
          {items.map(({ to, label, Icon }) => (
            <li key={label}>
              <NavLink
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-base transition ${
                    isActive
                      ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                      : 'hover:bg-[color:var(--surface-sunk)]'
                  }`
                }
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              onClick={() => {
                onClose()
                void signOut()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base transition hover:bg-[color:var(--surface-sunk)]"
            >
              <LogOut className="size-5 shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
