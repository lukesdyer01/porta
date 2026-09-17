import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, User } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { humanizeError } from '../lib/errors'
import { prepareImage } from '../lib/images'
import { supabase } from '../lib/supabase'

const SIGN_TTL = 60 * 60

export default function AvatarUpload() {
  const { profile, refreshProfile } = useAuth()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: url } = useQuery({
    enabled: Boolean(profile?.avatar_path),
    queryKey: ['avatar', profile?.avatar_path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('photos')
        .createSignedUrl(profile!.avatar_path!, SIGN_TTL)
      if (error) throw new Error(error.message)
      return data.signedUrl
    },
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!profile) throw new Error('Not signed in.')
      const img = await prepareImage(file)
      const path = `avatars/${profile.id}/${crypto.randomUUID()}.${img.ext}`

      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(path, img.blob, { contentType: img.type })
      if (upErr) throw new Error(upErr.message)

      const previous = profile.avatar_path
      const { error: rowErr } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', profile.id)
      if (rowErr) {
        await supabase.storage.from('photos').remove([path])
        throw new Error(rowErr.message)
      }
      // Only bin the old file once the row points at the new one.
      if (previous) await supabase.storage.from('photos').remove([previous])
    },
    onSuccess: async () => {
      setError(null)
      await refreshProfile()
      void qc.invalidateQueries({ queryKey: ['avatar'] })
      void qc.invalidateQueries({ queryKey: ['members'] })
    },
    onError: (e: Error) => setError(humanizeError(e)),
    onSettled: () => setBusy(false),
  })

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {url ? (
          <img src={url} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <div className="grid size-16 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-sunk)]">
            <User className="size-6 text-[color:var(--text-muted)]" aria-hidden="true" />
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Change your photo"
          className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] transition hover:bg-[color:var(--surface-sunk)] disabled:opacity-50"
        >
          <Camera className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium">{busy ? 'Uploading…' : 'Your photo'}</p>
        <p className="text-sm text-[color:var(--text-muted)]">
          Helps everyone tell the roster apart.
        </p>
        {error && <p className="mt-1 text-sm text-[color:var(--color-sunset-600)]">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          setError(null)
          upload.mutate(file)
        }}
      />
    </div>
  )
}
