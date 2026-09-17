import { humanizeError } from '../lib/errors'

export default function Alert({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p
      role="alert"
      className="mt-4 rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm"
    >
      {humanizeError(error)}
    </p>
  )
}
