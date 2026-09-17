import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

const MIN_PASSWORD = 8

/** Supabase phrases these for developers; the family needs plainer words. */
function humanize(message: string): string {
  const m = message.toLowerCase()
  if (message.startsWith('NEEDS_CODE:')) return 'Enter the family code to create an account.'
  if (m.includes('family code')) return message
  if (m.includes('invalid login credentials'))
    return "That email and password don't match. Check both, or create an account."
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'That email already has an account. Sign in instead.'
  if (m.includes('password should be') || m.includes('password'))
    return `Passwords need at least ${MIN_PASSWORD} characters.`
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many tries just now. Wait a minute and try again.'
  if (m.includes('unable to validate email') || m.includes('invalid'))
    return "That doesn't look like a valid email address."
  return message
}

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signingUp = mode === 'signup'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const address = email.trim().toLowerCase()
    if (!address || password.length < (signingUp ? MIN_PASSWORD : 1)) return

    setBusy(true)
    setError(null)

    if (signingUp) {
      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: { data: { invite_code: inviteCode.trim() } },
      })
      setBusy(false)

      if (error) {
        setError(humanize(error.message))
        return
      }
      // Supabase hides whether an address exists by returning a user with no
      // identities rather than an error. Without this check, someone who
      // already has an account sees a silent no-op.
      if (data.user && data.user.identities?.length === 0) {
        setError('That email already has an account. Sign in instead.')
        setMode('signin')
        return
      }
      // A session comes back immediately — email confirmation is off — so the
      // listener in AuthProvider takes over from here.
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email: address, password })
    setBusy(false)
    if (error) setError(humanize(error.message))
  }

  const field =
    'w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-8">
        <p className="text-xs font-medium tracking-[0.2em] text-[color:var(--text-muted)] uppercase">
          Port Aransas
        </p>
        <h1 className="font-display mt-2 text-3xl leading-tight font-semibold">
          Family Beach Week
        </h1>
      </header>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-6 shadow-sm">
        {/* Mode switch */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-[color:var(--surface-sunk)] p-1">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === m
                  ? 'bg-[color:var(--surface-raised)] shadow-sm'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)]'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} noValidate>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`mt-1.5 ${field}`}
          />

          <div className="mt-4 flex items-baseline justify-between">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-xs text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={signingUp ? `At least ${MIN_PASSWORD} characters` : ''}
            className={`mt-1.5 ${field}`}
          />

          {signingUp && (
            <>
              <label htmlFor="invite" className="mt-4 block text-sm font-medium">
                Family code
              </label>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                Ask Luke if you don&rsquo;t have it.
              </p>
              <input
                id="invite"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={`mt-1.5 ${field}`}
              />
            </>
          )}

          <button
            type="submit"
            disabled={
              busy ||
              !email.trim() ||
              password.length < (signingUp ? MIN_PASSWORD : 1) ||
              (signingUp && !inviteCode.trim())
            }
            className="mt-6 w-full rounded-lg bg-[color:var(--accent)] px-4 py-2.5 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Just a moment…' : signingUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-[color:var(--text-muted)]">
        {signingUp ? 'You need the family code to join.' : 'No account yet? Create one above.'}
      </p>
    </main>
  )
}
