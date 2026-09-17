import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fromCents, toCents } from '../lib/trips'
import type { House } from '../lib/types'
import { btnGhost, btnPrimary, fieldClass, labelClass } from './TripForm'
import { humanizeError } from '../lib/errors'

export default function HouseForm({
  tripId,
  house,
  onDone,
}: {
  tripId: string
  house?: House | null
  onDone: () => void
}) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    name: house?.name ?? '',
    address_line1: house?.address_line1 ?? '',
    address_line2: house?.address_line2 ?? '',
    city: house?.city ?? 'Port Aransas',
    state: house?.state ?? 'TX',
    postal_code: house?.postal_code ?? '',
    lat: house?.lat != null ? String(house.lat) : '',
    lng: house?.lng != null ? String(house.lng) : '',
    rental_url: house?.rental_url ?? '',
    cost: fromCents(house?.cost_cents ?? null),
    bedrooms: house?.bedrooms != null ? String(house.bedrooms) : '',
    sleeps: house?.sleeps != null ? String(house.sleeps) : '',
    notes: house?.notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }))

  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  const save = useMutation({
    mutationFn: async () => {
      const lat = num(f.lat)
      const lng = num(f.lng)
      // The table enforces this too, but catching it here gives a sentence
      // instead of a constraint name.
      if ((lat === null) !== (lng === null))
        throw new Error('Give both latitude and longitude, or neither.')
      if (f.rental_url.trim() && !/^https?:\/\//i.test(f.rental_url.trim()))
        throw new Error('The rental link needs to start with http:// or https://')

      const row = {
        name: f.name.trim(),
        address_line1: f.address_line1.trim() || null,
        address_line2: f.address_line2.trim() || null,
        city: f.city.trim() || 'Port Aransas',
        state: f.state.trim() || 'TX',
        postal_code: f.postal_code.trim() || null,
        lat,
        lng,
        rental_url: f.rental_url.trim() || null,
        cost_cents: toCents(f.cost),
        bedrooms: num(f.bedrooms),
        sleeps: num(f.sleeps),
        notes: f.notes.trim() || null,
      }

      if (house) {
        const { error } = await supabase.from('houses').update(row).eq('id', house.id)
        if (error) throw new Error(error.message)
      } else {
        const { data: me } = await supabase.auth.getUser()
        const { error } = await supabase
          .from('houses')
          .insert({ ...row, trip_id: tripId, created_by: me.user!.id })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['house', tripId] })
      onDone()
    },
    onError: (e: Error) => setError(humanizeError(e)),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        save.mutate()
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="hname" className={labelClass}>
          House name
        </label>
        <input
          id="hname"
          value={f.name}
          onChange={set('name')}
          placeholder="e.g. Sandcastle on Beach Access 1-A"
          className={`mt-1.5 ${fieldClass}`}
        />
      </div>

      <div>
        <label htmlFor="a1" className={labelClass}>
          Address
        </label>
        <input id="a1" value={f.address_line1} onChange={set('address_line1')} className={`mt-1.5 ${fieldClass}`} />
        <input
          value={f.address_line2}
          onChange={set('address_line2')}
          placeholder="Unit / floor (optional)"
          className={`mt-2 ${fieldClass}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="city" className={labelClass}>City</label>
          <input id="city" value={f.city} onChange={set('city')} className={`mt-1.5 ${fieldClass}`} />
        </div>
        <div>
          <label htmlFor="state" className={labelClass}>State</label>
          <input id="state" value={f.state} onChange={set('state')} className={`mt-1.5 ${fieldClass}`} />
        </div>
        <div>
          <label htmlFor="zip" className={labelClass}>ZIP</label>
          <input id="zip" value={f.postal_code} onChange={set('postal_code')} className={`mt-1.5 ${fieldClass}`} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lat" className={labelClass}>Latitude</label>
          <input id="lat" inputMode="decimal" value={f.lat} onChange={set('lat')} placeholder="27.8339" className={`mt-1.5 ${fieldClass}`} />
        </div>
        <div>
          <label htmlFor="lng" className={labelClass}>Longitude</label>
          <input id="lng" inputMode="decimal" value={f.lng} onChange={set('lng')} placeholder="-97.0611" className={`mt-1.5 ${fieldClass}`} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-[color:var(--text-muted)]">
        Optional, and only used for the map of past houses. Right-click the spot in Google Maps
        and the coordinates are the first thing in the menu.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="cost" className={labelClass}>Total cost</label>
          <input id="cost" inputMode="decimal" value={f.cost} onChange={set('cost')} placeholder="3200" className={`mt-1.5 ${fieldClass}`} />
        </div>
        <div>
          <label htmlFor="bed" className={labelClass}>Bedrooms</label>
          <input id="bed" inputMode="numeric" value={f.bedrooms} onChange={set('bedrooms')} className={`mt-1.5 ${fieldClass}`} />
        </div>
        <div>
          <label htmlFor="sleeps" className={labelClass}>Sleeps</label>
          <input id="sleeps" inputMode="numeric" value={f.sleeps} onChange={set('sleeps')} className={`mt-1.5 ${fieldClass}`} />
        </div>
      </div>

      <div>
        <label htmlFor="url" className={labelClass}>Rental listing link</label>
        <input id="url" value={f.rental_url} onChange={set('rental_url')} placeholder="https://…" className={`mt-1.5 ${fieldClass}`} />
      </div>

      <div>
        <label htmlFor="hnotes" className={labelClass}>Notes</label>
        <textarea id="hnotes" rows={3} value={f.notes} onChange={set('notes')} className={`mt-1.5 resize-y ${fieldClass}`} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[color:var(--color-sunset-600)]">{error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className={btnPrimary}>
          {save.isPending ? 'Saving…' : house ? 'Save house' : 'Add house'}
        </button>
        <button type="button" onClick={onDone} className={btnGhost}>Cancel</button>
      </div>
    </form>
  )
}
