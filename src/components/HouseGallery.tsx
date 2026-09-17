import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { humanizeError } from '../lib/errors'
import { prepareImagePair } from '../lib/images'
import { supabase } from '../lib/supabase'

const SIGN_TTL = 60 * 60

interface Shot {
  id: string
  storage_path: string
  thumb_path: string | null
  sort_order: number
  uploaded_by: string
  url: string
}

export default function HouseGallery({ houseId, tripId }: { houseId: string; tripId: string }) {
  const { profile, isOrganizer } = useAuth()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: shots = [] } = useQuery({
    queryKey: ['house-photos', houseId],
    queryFn: async (): Promise<Shot[]> => {
      const { data, error } = await supabase
        .from('photos')
        .select('id, storage_path, thumb_path, sort_order, uploaded_by')
        .eq('house_id', houseId)
        .order('sort_order')
        .order('created_at')
      if (error) throw new Error(error.message)
      const rows = data ?? []
      if (rows.length === 0) return []

      // One signing call for the whole strip rather than one per photo.
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

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['house-photos', houseId] })
    // The trips index shows the first photo as the card image.
    void qc.invalidateQueries({ queryKey: ['trip-cards'] })
  }

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!profile) throw new Error('Not signed in.')
      let next = shots.length ? Math.max(...shots.map((s) => s.sort_order)) + 1 : 0
      const failures: string[] = []

      for (const [i, file] of files.entries()) {
        setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : 'Uploading…')
        try {
          const { full, thumb } = await prepareImagePair(file)
          const base = `trips/${tripId}/houses/${houseId}/${crypto.randomUUID()}`
          const path = `${base}.${full.ext}`

          const { error: upErr } = await supabase.storage
            .from('photos')
            .upload(path, full.blob, { contentType: full.type })
          if (upErr) throw new Error(upErr.message)

          let thumbPath: string | null = null
          if (thumb) {
            const tPath = `${base}.thumb.${thumb.ext}`
            const { error: tErr } = await supabase.storage
              .from('photos')
              .upload(tPath, thumb.blob, { contentType: thumb.type })
            if (!tErr) thumbPath = tPath
          }

          const { error: rowErr } = await supabase.from('photos').insert({
            house_id: houseId,
            trip_id: tripId,
            kind: 'house',
            storage_path: path,
            thumb_path: thumbPath,
            width: full.width,
            height: full.height,
            bytes: full.blob.size,
            sort_order: next++,
            uploaded_by: profile.id,
          })
          if (rowErr) {
            await supabase.storage.from('photos').remove([path, ...(thumbPath ? [thumbPath] : [])])
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
      refresh()
    },
  })

  const remove = useMutation({
    mutationFn: async (s: Shot) => {
      const { error } = await supabase.from('photos').delete().eq('id', s.id)
      if (error) throw new Error(error.message)
      await supabase.storage
        .from('photos')
        .remove([s.storage_path, ...(s.thumb_path ? [s.thumb_path] : [])])
    },
    onSuccess: () => {
      setIndex(0)
      refresh()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const makeCover = useMutation({
    mutationFn: async (s: Shot) => {
      // Sorting below the current lowest avoids renumbering the whole strip on
      // every change; smallint leaves room for far more of these than anyone
      // will ever do.
      const lowest = Math.min(...shots.map((x) => x.sort_order))
      const { error } = await supabase
        .from('photos')
        .update({ sort_order: lowest - 1 })
        .eq('id', s.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setIndex(0)
      stripRef.current?.scrollTo({ left: 0 })
      refresh()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const scrollTo = (i: number) => {
    const el = stripRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const current = shots[index]
  const canManage = isOrganizer || current?.uploaded_by === profile?.id
  const busy = upload.isPending || remove.isPending || makeCover.isPending

  return (
    <div className="mb-4">
      {shots.length > 0 && (
        <div className="relative">
          {/*
            Scroll-snap rather than a carousel library: swiping is what the
            browser already does on a touch screen, and it costs no bundle.
          */}
          <div
            ref={stripRef}
            onScroll={(e) => {
              const el = e.currentTarget
              const i = Math.round(el.scrollLeft / el.clientWidth)
              if (i !== index) setIndex(i)
            }}
            className="flex snap-x snap-mandatory overflow-x-auto rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {shots.map((s) => (
              <img
                key={s.id}
                src={s.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-[3/2] w-full shrink-0 snap-center object-cover"
              />
            ))}
          </div>

          {shots.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => scrollTo(Math.max(0, index - 1))}
                disabled={index === 0}
                aria-label="Previous photo"
                className="absolute top-1/2 left-2 hidden -translate-y-1/2 place-items-center rounded-full bg-black/40 p-1.5 text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-0 sm:grid"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollTo(Math.min(shots.length - 1, index + 1))}
                disabled={index === shots.length - 1}
                aria-label="Next photo"
                className="absolute top-1/2 right-2 hidden -translate-y-1/2 place-items-center rounded-full bg-black/40 p-1.5 text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-0 sm:grid"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>

              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
                {shots.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollTo(i)}
                    aria-label={`Photo ${i + 1} of ${shots.length}`}
                    aria-current={i === index}
                    className={`size-1.5 rounded-full transition ${
                      i === index ? 'w-4 bg-white' : 'bg-white/60'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

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

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-sm transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          {progress ?? (shots.length ? 'Add more photos' : 'Add photos')}
        </button>

        {current && canManage && index > 0 && (
          <button
            type="button"
            onClick={() => makeCover.mutate(current)}
            disabled={busy}
            className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)] disabled:opacity-50"
          >
            <Star className="size-3.5" aria-hidden="true" />
            Make this the cover
          </button>
        )}

        {current && canManage && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Remove this photo?')) remove.mutate(current)
            }}
            disabled={busy}
            className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)] disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Remove{shots.length > 1 ? ' this one' : ''}
          </button>
        )}

        {shots.length > 1 && (
          <span className="ml-auto text-xs text-[color:var(--text-muted)]">
            {index + 1} of {shots.length}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-[color:var(--color-sunset-600)]">{error}</p>
      )}
    </div>
  )
}
