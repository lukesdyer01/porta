const YEAR = new Date().getFullYear()

export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-display text-[color:var(--text-muted)] text-sm tracking-[0.2em] uppercase">
        Port Aransas &middot; {YEAR}
      </p>
      <h1 className="font-display mt-3 text-4xl leading-tight font-semibold text-balance sm:text-5xl">
        King Family Beach Week
      </h1>
      <p className="mt-4 max-w-prose text-[color:var(--text-muted)] leading-relaxed">
        The house, the codes, who&rsquo;s coming, who&rsquo;s cooking, and what everyone owes &mdash;
        every year, in one place.
      </p>

      <div className="mt-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
        <p className="text-sm font-medium">Setting things up</p>
        <p className="mt-1 text-sm text-[color:var(--text-muted)] leading-relaxed">
          The site is deploying correctly. Sign-in and the {YEAR} trip come next.
        </p>
      </div>
    </main>
  )
}
