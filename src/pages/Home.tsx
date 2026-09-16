import { useAuth } from '../auth/useAuth'

export default function Home() {
  const { profile } = useAuth()
  const firstName = profile?.display_name?.split(' ')[0] ?? 'there'

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">Hey {firstName}</h2>
      <p className="mt-2 max-w-prose text-[color:var(--text-muted)] leading-relaxed">
        You&rsquo;re signed in. The {new Date().getFullYear()} trip, the house and its codes, and
        everyone&rsquo;s RSVP land here next.
      </p>
    </div>
  )
}
