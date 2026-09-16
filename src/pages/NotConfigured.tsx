export default function NotConfigured() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Not connected yet</h1>
      <p className="mt-3 text-[color:var(--text-muted)] leading-relaxed">
        This build has no Supabase credentials, so there&rsquo;s nothing to sign in to. Add{' '}
        <code className="rounded bg-[color:var(--surface-sunk)] px-1.5 py-0.5 text-sm">
          VITE_SUPABASE_URL
        </code>{' '}
        and{' '}
        <code className="rounded bg-[color:var(--surface-sunk)] px-1.5 py-0.5 text-sm">
          VITE_SUPABASE_ANON_KEY
        </code>{' '}
        as repository secrets, then re-run the deploy.
      </p>
    </main>
  )
}
