import { useAuth } from '../auth/useAuth'

export default function Pending() {
  const { profile, session, signOut, refreshProfile } = useAuth()
  const address = profile?.email ?? session?.user.email

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Almost there</h1>
      <p className="mt-3 text-[color:var(--text-muted)] leading-relaxed">
        You&rsquo;re signed in as <span className="text-[color:var(--text)]">{address}</span>, but
        that address isn&rsquo;t on the family list yet. Ask Luke to add it, then check again.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => void refreshProfile()}
          className="rounded-lg bg-[color:var(--accent)] px-4 py-2.5 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90"
        >
          Check again
        </button>
        <button
          onClick={() => void signOut()}
          className="rounded-lg border border-[color:var(--border)] px-4 py-2.5 font-medium transition hover:bg-[color:var(--surface-sunk)]"
        >
          Sign out
        </button>
      </div>
    </main>
  )
}
