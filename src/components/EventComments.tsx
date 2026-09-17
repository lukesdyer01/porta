import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { humanizeError } from '../lib/errors'
import { supabase } from '../lib/supabase'

interface Comment {
  id: string
  body: string
  author_id: string
  created_at: string
  author: { display_name: string } | null
}

const when = (iso: string) => {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function EventComments({ eventId }: { eventId: string }) {
  const { profile, isOrganizer } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Counts come from a head request, so an unopened thread costs one cheap
  // query rather than pulling every comment on the calendar.
  const { data: count = 0 } = useQuery({
    queryKey: ['event-comment-count', eventId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('event_comments')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
      if (error) throw new Error(error.message)
      return count ?? 0
    },
  })

  const { data: comments = [], isLoading } = useQuery({
    enabled: open,
    queryKey: ['event-comments', eventId],
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from('event_comments')
        .select('id, body, author_id, created_at, author:profiles(display_name)')
        .eq('event_id', eventId)
        .order('created_at')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Comment[]
    },
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['event-comments', eventId] })
    void qc.invalidateQueries({ queryKey: ['event-comment-count', eventId] })
  }

  const post = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not signed in.')
      const text = body.trim()
      if (!text) throw new Error('Write something first.')
      const { error } = await supabase
        .from('event_comments')
        .insert({ event_id: eventId, author_id: profile.id, body: text })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setError(null)
      setBody('')
      refresh()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_comments').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: refresh,
    onError: (e: Error) => setError(humanizeError(e)),
  })

  return (
    <div className="mt-2 w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] transition hover:text-[color:var(--text)]"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {count === 0 ? 'Comment' : `${count} ${count === 1 ? 'comment' : 'comments'}`}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          {isLoading && <p className="text-sm text-[color:var(--text-muted)]">Loading…</p>}

          {!isLoading && comments.length === 0 && (
            <p className="text-sm text-[color:var(--text-muted)]">
              Nothing yet. First thoughts?
            </p>
          )}

          {comments.length > 0 && (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{c.author?.display_name ?? 'Someone'}</span>
                    <span className="text-xs text-[color:var(--text-muted)]">{when(c.created_at)}</span>
                    {(c.author_id === profile?.id || isOrganizer) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this comment?')) remove.mutate(c.id)
                        }}
                        aria-label="Delete comment"
                        className="ml-auto text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              post.mutate()
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
            />
            <button
              type="submit"
              disabled={post.isPending || !body.trim()}
              aria-label="Post comment"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color:var(--accent)] text-[color:var(--accent-contrast)] transition hover:opacity-90 disabled:opacity-50"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-2 text-sm text-[color:var(--color-sunset-600)]">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
