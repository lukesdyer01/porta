import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { prepareImagePair } from '../lib/images'
import { supabase } from '../lib/supabase'
import { humanizeError } from '../lib/errors'

const SIGN_TTL = 60 * 60

interface PhotoRow {
  id: string
  storage_path: string
  thumb_path: string | null
  width: number | null
  height: number | null
  uploaded_by: string
}

export default function HousePhoto({ houseId, tripId }: { houseId: string; tripId: string }) {
  const { profile, isOrganizer } = useAuth()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: photo } = useQuery({
    queryKey: ['house-photo', houseId],
    queryFn: async (): Promise<(PhotoRow & { url: string }) | null> => {
      const { data, error } = await supabase
        .from('photos')
        .select('id, storage_path, thumb_path, width, height, uploaded_by')
        .eq('house_id', houseId)
        .order('sort_order')
        .limit(1)
      if (error) throw new Error(error.message)
      const row = (data ?? [])[0] as PhotoRow | undefined
      if (!row) return null

      // The bucket is private, so every view needs a fresh signed URL.
      const { data: signed, error: signErr } = await supabase.storage
        .from('photos')
        .createSignedUrl(row.storage_path, SIGN_TTL)
      if (signErr) throw new Error(signErr.message)
      return { ...row, url: signed.signedUrl }
    },
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!profile) throw new Error('Not signed in.')
      const { full, thumb } = await prepareImagePair(file)
      const base = `trips/${tripId}/houses/${houseId}/${crypto.randomUUID()}`
      const path = `${base}.${full.ext}`

      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(path, full.blob, { contentType: full.type, upsert: false })
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
        uploaded_by: profile.id,
      })
      if (rowErr) {
        // Don't strand a file nothing points at.
        await supabase.storage.from('photos').remove([path, ...(thumbPath ? [thumbPath] : [])])
        throw new Error(rowErr.message)
      }

      // One photo per house for now: drop whatever it replaced.
      if (photo) {
        await supabase.from('photos').delete().eq('id', photo.id)
        await supabase.storage
          .from('photos')
          .remove([photo.storage_path, ...(photo.thumb_path ? [photo.thumb_path] : [])])
      }
    },
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['house-photo', houseId] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
    onSettled: () => setBusy(false),
  })

  const remove = useMutation({
    mutationFn: async () => {
      if (!photo) return
      const { error } = await supabase.from('photos').delete().eq('id', photo.id)
      if (error) throw new Error(error.message)
      await supabase.storage
        .from('photos')
        .remove([photo.storage_path, ...(photo.thumb_path ? [photo.thumb_path] : [])])
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['house-photo', houseId] }),
    onError: (e: Error) => setError(humanizeError(e)),
  })

  const canEdit = isOrganizer || photo?.uploaded_by === profile?.id || !photo

  return (
    <div>
      {photo && (
        <img
          src={photo.url}
          alt="The beach house"
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          className="mb-4 aspect-[3/2] w-full rounded-lg object-cover"
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // let the same file be re-picked after an error
          if (!file) return
          setBusy(true)
          setError(null)
          upload.mutate(file)
        }}
      />

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-sm transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            {busy ? 'Uploading…' : photo ? 'Replace photo' : 'Add a photo'}
          </button>
          {photo && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove this photo?')) remove.mutate()
              }}
              className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)] underline underline-offset-4 hover:text-[color:var(--text)]"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-[color:var(--color-sunset-600)]">{error}</p>
      )}
    </div>
  )
}
