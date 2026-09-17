import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Without this, one thrown render error leaves a blank white page with no
 * explanation and no way back — on a phone, at the beach, with no devtools.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
        <h1 className="font-display text-2xl font-semibold">That didn&rsquo;t load</h1>
        <p className="mt-3 text-[color:var(--text-muted)] leading-relaxed">
          Something went wrong on this screen. Reloading usually sorts it.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-[color:var(--accent)] px-4 py-2.5 font-medium text-[color:var(--accent-contrast)] transition hover:opacity-90"
          >
            Reload
          </button>
          <button
            onClick={() => {
              window.location.hash = '#/'
              window.location.reload()
            }}
            className="rounded-lg border border-[color:var(--border)] px-4 py-2.5 font-medium transition hover:bg-[color:var(--surface-sunk)]"
          >
            Back to the trip
          </button>
        </div>
        <details className="mt-6 text-xs text-[color:var(--text-muted)]">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{this.state.error.message}</pre>
        </details>
      </main>
    )
  }
}
