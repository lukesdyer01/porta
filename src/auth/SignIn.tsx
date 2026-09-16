import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Step = 'email' | 'code'

/** Supabase phrases these for developers; the family needs plainer words. */
function humanize(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invite-only') || m.includes('not allowed') || m.includes('403'))
    return "That email isn't on the family list yet. Ask Luke to add it."
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts just now. Wait a minute and try again.'
  if (m.includes('expired'))
    return 'That code has expired. Send a new one.'
  if (m.includes('invalid') || m.includes('token'))
    return "That code didn't match. Check the digits and try again."
  return message
}

export default function SignIn() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    const address = email.trim().toLowerCase()
    if (!address) return

    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: address })
    setBusy(false)

    if (error) {
      setError(humanize(error.message))
      return
    }
    setEmail(address)
    setStep('code')
    setCooldown(60)
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    const token = code.replace(/\D/g, '')
    if (token.length < 6) return

    setBusy(true)
    setError(null)
    // No redirect, no session handoff between devices — this is why the code is
    // the primary path rather than the emailed link.
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    setBusy(false)

    if (error) {
      setError(humanize(error.message))
      setCode('')
      codeRef.current?.focus()
    }
    // On success the auth listener in AuthProvider swaps the screen out.
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-8">
        <p className="text-[color:var(--text-muted)] text-xs font-medium tracking-[0.2em] uppercase">
          Port Aransas
        </p>
        <h1 className="font-display mt-2 text-3xl leading-tight font-semibold">
          King Family Beach Week
        </h1>
      </header>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-6 shadow-sm">
        {step === 'email' ? (
          <form onSubmit={sendCode} noValidate>
            <label htmlFor="email" className="block text-sm font-medium">
              Your email address
            </label>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              We&rsquo;ll send you a 6-digit sign-in code.
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
              className="mt-3 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="mt-4 w-full rounded-lg bg-[color:var(--accent)] px-4 py-2.5 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <label htmlFor="code" className="block text-sm font-medium">
              Enter the code
            </label>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Sent to <span className="text-[color:var(--text)]">{email}</span>. It works on any
              device, so you can check email on your phone and type it here.
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">
              No code in the email? Tap the sign-in link in it instead &mdash; that works too,
              as long as you open it in this browser.
            </p>
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
              className="mt-3 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/25"
            />
            <button
              type="submit"
              disabled={busy || code.length < 6}
              className="mt-4 w-full rounded-lg bg-[color:var(--accent)] px-4 py-2.5 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Sign in'}
            </button>

            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
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
                onClick={() => void sendCode()}
                className="text-[color:var(--accent)] underline underline-offset-4 disabled:text-[color:var(--text-muted)] disabled:no-underline"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
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
