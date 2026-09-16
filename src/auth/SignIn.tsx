import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Step = 'email' | 'sent'

/** Supabase phrases these for developers; the family needs plainer words. */
function humanize(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invite-only') || m.includes('not allowed') || m.includes('403'))
    return "That email isn't on the family list. Ask Luke to add it."
  if (m.includes('rate limit') || m.includes('too many') || m.includes('after'))
    return 'Too many tries just now. Wait a minute and try again.'
  if (m.includes('expired') || m.includes('invalid or has expired'))
    return 'That link has expired. Send a new one below.'
  if (m.includes('invalid') || m.includes('token'))
    return "That didn't work. Send yourself a new link below."
  return message
}

/**
 * A failed link lands back here with the reason in the URL fragment. Without
 * reading it, an expired link just silently redisplays this form and the
 * person has no idea what went wrong.
 */
function errorFromUrl(): string | null {
  const hash = window.location.hash
  const at = hash.indexOf('error')
  if (at === -1) return null
  const params = new URLSearchParams(hash.slice(hash.indexOf('#') + 1).replace(/^\/?\??/, ''))
  const desc = params.get('error_description') ?? params.get('error')
  if (!desc) return null
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return humanize(desc.replace(/\+/g, ' '))
}

// Read once at page load, not in an effect: the fragment is consumed and
// cleared immediately, and this must not re-run on re-render.
const initialUrlError = errorFromUrl()

export default function SignIn() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialUrlError)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    if (showCode) codeRef.current?.focus()
  }, [showCode])

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    const address = email.trim().toLowerCase()
    if (!address) return

    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        // Send people back to THIS page. Relying on the project's Site URL
        // instead means a stale value there drops the /porta/ path and lands
        // them on a GitHub 404.
        emailRedirectTo: window.location.href.split('#')[0],
      },
    })
    setBusy(false)

    if (error) {
      setError(humanize(error.message))
      return
    }
    setEmail(address)
    setStep('sent')
    setCooldown(60)
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    const token = code.replace(/\D/g, '')
    if (token.length < 6) return

    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    setBusy(false)

    if (error) {
      setError(humanize(error.message))
      setCode('')
      codeRef.current?.focus()
    }
    // On success the listener in AuthProvider swaps this screen out.
  }

  const field =
    'w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25'
  const primary =
    'w-full rounded-lg bg-[color:var(--accent)] px-4 py-2.5 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-8">
        <p className="text-xs font-medium tracking-[0.2em] text-[color:var(--text-muted)] uppercase">
          Port Aransas
        </p>
        <h1 className="font-display mt-2 text-3xl leading-tight font-semibold">
          King Family Beach Week
        </h1>
      </header>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-6 shadow-sm">
        {step === 'email' ? (
          <form onSubmit={send} noValidate>
            <label htmlFor="email" className="block text-sm font-medium">
              Your email address
            </label>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              We&rsquo;ll email you a link that signs you straight in.
            </p>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`mt-3 ${field}`}
            />
            <button type="submit" disabled={busy || !email.trim()} className={`mt-4 ${primary}`}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        ) : (
          <div>
            <h2 className="font-display text-xl font-semibold">Check your email</h2>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">
              We sent a sign-in link to{' '}
              <span className="text-[color:var(--text)]">{email}</span>. Open it{' '}
              <strong className="font-medium text-[color:var(--text)]">in this browser</strong> and
              you&rsquo;re in.
            </p>

            <div className="mt-5 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setShowCode(false)
                  setCode('')
                  setError(null)
                }}
                className="text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
              >
                Use a different email
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || busy}
                onClick={() => void send()}
                className="text-[color:var(--accent)] underline underline-offset-4 disabled:text-[color:var(--text-muted)] disabled:no-underline"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
              </button>
            </div>

            {/* Kept out of the way: the emailed code only exists once custom
                SMTP is configured, so leading with it would send most people
                hunting for something that isn't there. */}
            {showCode ? (
              <form onSubmit={verify} className="mt-6 border-t border-[color:var(--border)] pt-5">
                <label htmlFor="code" className="block text-sm font-medium">
                  Six-digit code
                </label>
                <input
                  id="code"
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className={`mt-2 text-center font-mono text-2xl tracking-[0.4em] ${field}`}
                />
                <button type="submit" disabled={busy || code.length < 6} className={`mt-3 ${primary}`}>
                  {busy ? 'Checking…' : 'Sign in with code'}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCode(true)}
                className="mt-5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
              >
                My email has a 6-digit code instead
              </button>
            )}
          </div>
        )}

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
        This site is invite-only.
      </p>
    </main>
  )
}
