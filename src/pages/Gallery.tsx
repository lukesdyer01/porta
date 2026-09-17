import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { prepareImage } from '../lib/images'
import { supabase } from '../lib/supabase'

import { usePageTitle } from '../lib/usePageTitle'
import { humanizeError } from '../lib/errors'
import { useTripContext } from '../trip/useTrip'

const SIGN_TTL = 60 * 60

interface Shot {
  id: string
  storage_path: string
  caption: string | null
  width: number | null
  height: number | null
  uploaded_by: string
  url: string
}

export default function Gallery() {
  usePageTitle('Photos')
  const { profile, isOrganizer } = useAuth()
  const qc = useQueryClient()
  const { trip } = useTripContext()

  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Shot | null>(null)

  const { data: shots = [], isLoading } = useQuery({
    enabled: Boolean(trip?.id),
    queryKey: ['gallery', trip?.id],
    queryFn: async (): Promise<Shot[]> => {
      const { data, error } = await supabase
        .from('photos')
        .select('id, storage_path, caption, width, height, uploaded_by')
        .eq('trip_id', trip!.id)
        .eq('kind', 'trip')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw new Error(error.message)
      const rows = data ?? []
      if (rows.length === 0) return []

      // One request for every URL. Signing per photo would be dozens of
      // round-trips on a page that is already image-heavy.
      const { data: signed, error: sErr } = await supabase.storage
        .from('photos')
        .createSignedUrls(rows.map((r) => r.storage_path), SIGN_TTL)
      if (sErr) throw new Error(sErr.message)

      const urls = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path!, s.signedUrl!]))
      return rows
        .filter((r) => urls.has(r.storage_path))
        .map((r) => ({ ...r, url: urls.get(r.storage_path)! })) as Shot[]
    },
  })

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!profile || !trip) throw new Error('Not ready.')
      const failures: string[] = []

      for (const [i, file] of files.entries()) {
        setProgress(`Uploading ${i + 1} of ${files.length}…`)
        try {
          const img = await prepareImage(file)
          const path = `trips/${trip.id}/gallery/${crypto.randomUUID()}.${img.ext}`
          const { error: upErr } = await supabase.storage
            .from('photos')
            .upload(path, img.blob, { contentType: img.type })
          if (upErr) throw new Error(upErr.message)

          const { error: rowErr } = await supabase.from('photos').insert({
            trip_id: trip.id,
            kind: 'trip',
            storage_path: path,
            width: img.width,
            height: img.height,
            bytes: img.blob.size,
            uploaded_by: profile.id,
          })
          if (rowErr) {
            await supabase.storage.from('photos').remove([path])
            throw new Error(rowErr.message)
          }
        } catch (e) {
          // One bad photo shouldn't abandon the rest of the batch.
          failures.push(`${file.name}: ${(e as Error).message}`)
        }
      }
      if (failures.length) throw new Error(failures.join(' · '))
    },
    onSuccess: () => setError(null),
    onError: (e: Error) => setError(humanizeError(e)),
    onSettled: () => {
      setProgress(null)
      void qc.invalidateQueries({ queryKey: ['gallery', trip?.id] })
    },
  })

  const remove = useMutation({
    mutationFn: async (s: Shot) => {
      const { error } = await supabase.from('photos').delete().eq('id', s.id)
      if (error) throw new Error(error.message)
      await supabase.storage.from('photos').remove([s.storage_path])
    },
    onSuccess: () => {
      setOpen(null)
      void qc.invalidateQueries({ queryKey: ['gallery', trip?.id] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  if (!trip) return <p className="text-sm text-[color:var(--text-muted)]">No trip yet.</p>

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold">Photos</h2>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-2 text-sm transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          {progress ?? 'Add photos'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) {
            setError(null)
            upload.mutate(files)
          }
        }}
      />

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-[color:var(--color-sunset-300)] bg-[color:var(--color-sunset-500)]/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {isLoading && <p className="mt-4 text-sm text-[color:var(--text-muted)]">Loading…</p>}
      {!isLoading && shots.length === 0 && (
        <p className="mt-4 rounded-lg bg-[color:var(--surface-sunk)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          No photos from {trip.year} yet.
        </p>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {shots.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => setOpen(s)}
              className="block w-full overflow-hidden rounded-lg"
              aria-label={s.caption ?? 'Open photo'}
            >
              <img
                src={s.url}
                alt={s.caption ?? ''}
                loading="lazy"
                width={s.width ?? undefined}
                height={s.height ?? undefined}
                className="aspect-square w-full object-cover transition hover:opacity-90"
              />
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
        >
          <img
            src={open.url}
            alt={open.caption ?? ''}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
          {(isOrganizer || open.uploaded_by === profile?.id) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Delete this photo?')) remove.mutate(open)
              }}
              aria-label="Delete photo"
              className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm text-white backdrop-blur"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
