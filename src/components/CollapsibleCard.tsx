import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

/**
 * A card that remembers whether it was left open, per device.
 *
 * `defaultOpen` only applies the first time: once someone has opened or closed
 * it, that choice wins. localStorage throws in a private window and a
 * remembered preference is a nicety, so every access is guarded.
 */
export default function CollapsibleCard({
  id,
  icon,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string
  icon: ReactNode
  title: string
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const key = `porta:open:${id}`
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? defaultOpen : stored === '1'
    } catch {
      return defaultOpen
    }
  })

  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      /* not worth failing over */
    }
  }

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 p-5 text-left"
      >
        <span className="shrink-0">{icon}</span>
        <span className="shrink-0 font-medium">{title}</span>
        {summary && (
          <span className="truncate text-sm text-[color:var(--text-muted)]">{summary}</span>
        )}
        <ChevronDown
          className={`ml-auto size-4 shrink-0 text-[color:var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && <div className="border-t border-[color:var(--border)] px-5 pt-4 pb-5">{children}</div>}
    </section>
  )
}
