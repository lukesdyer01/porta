export default function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <span
        className="size-6 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}
