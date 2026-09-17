import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabase'
import { averageRating, useReviews } from '../lib/trips'
import { btnPrimary, fieldClass } from './TripForm'
import { humanizeError } from '../lib/errors'

function Stars({
  value,
  onChange,
  size = 'size-5',
}: {
  value: number
  onChange?: (n: number) => void
  size?: string
}) {
  const readOnly = !onChange
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value)
        const star = (
          <Star
            className={`${size} ${filled ? 'fill-[color:var(--color-sunset-500)] text-[color:var(--color-sunset-500)]' : 'text-[color:var(--border)]'}`}
            aria-hidden="true"
          />
        )
        return readOnly ? (
          <span key={n}>{star}</span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? 0 : n)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            aria-pressed={filled}
            className="transition hover:scale-110"
          >
            {star}
          </button>
        )
      })}
    </span>
  )
}

export default function HouseReviews({ houseId }: { houseId: string }) {
  const { profile, isOrganizer } = useAuth()
  const qc = useQueryClient()
  const { data: reviews = [], isLoading } = useReviews(houseId)

  const mine = reviews.find((r) => r.profile_id === profile?.id)
  const [seeded, setSeeded] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (mine && seeded !== mine.id) {
    setSeeded(mine.id)
    setRating(mine.rating ?? 0)
    setComment(mine.comment ?? '')
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ['reviews', houseId] })

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not signed in.')
      const body = comment.trim()
      // The table rejects an empty review too; saying so here is friendlier
      // than surfacing a constraint name.
      if (rating === 0 && !body) throw new Error('Give it a star rating or write something.')

      const row = { rating: rating || null, comment: body || null }
      if (mine) {
        const { error } = await supabase.from('house_reviews').update(row).eq('id', mine.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('house_reviews')
          .insert({ ...row, house_id: houseId, profile_id: profile.id })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      setError(null)
      void refresh()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('house_reviews').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setSeeded(null)
      setRating(0)
      setComment('')
      void refresh()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const { avg, count } = averageRating(reviews)
  const others = reviews.filter((r) => r.profile_id !== profile?.id)

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-2 font-medium">
          <MessageSquare className="size-4" aria-hidden="true" />
          What everyone thought
        </h3>
        {count > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)]">
            <Stars value={avg} size="size-4" />
            {avg.toFixed(1)} · {count} {count === 1 ? 'rating' : 'ratings'}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        Worth renting again? Say so now, while you remember.
      </p>

      {/* ---- your own ---- */}
      <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Your rating</span>
          <Stars value={rating} onChange={setRating} />
          {rating > 0 && (
            <button
              type="button"
              onClick={() => setRating(0)}
              className="text-xs text-[color:var(--text-muted)] underline underline-offset-4"
            >
              clear
            </button>
          )}
        </div>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          placeholder="Great deck, tiny kitchen, book the corner unit next time…"
          className={`mt-3 resize-y ${fieldClass}`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className={btnPrimary}>
            {save.isPending ? 'Saving…' : mine ? 'Update' : 'Post'}
          </button>
          {mine && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete your review?')) remove.mutate(mine.id)
              }}
              className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-[color:var(--color-sunset-600)]">{error}</p>
        )}
      </div>

      {/* ---- everyone else ---- */}
      {isLoading && <p className="mt-4 text-sm text-[color:var(--text-muted)]">Loading…</p>}
      {!isLoading && others.length === 0 && (
        <p className="mt-4 text-sm text-[color:var(--text-muted)]">Nobody else has weighed in yet.</p>
      )}

      {others.length > 0 && (
        <ul className="mt-4 space-y-4">
          {others.map((r) => (
            <li key={r.id} className="border-t border-[color:var(--border)] pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{r.profile?.display_name ?? 'Someone'}</span>
                {r.rating != null && <Stars value={r.rating} size="size-3.5" />}
                {isOrganizer && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete ${r.profile?.display_name ?? 'this'} review?`)) remove.mutate(r.id)
                    }}
                    aria-label="Delete review"
                    className="ml-auto text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              {r.comment && (
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{r.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
