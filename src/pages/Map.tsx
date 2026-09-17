import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { divIcon, latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { money } from '../lib/trips'
import { supabase } from '../lib/supabase'

// Port Aransas, for when there is nothing plotted yet.
const FALLBACK: [number, number] = [27.8339, -97.0611]

interface Pin {
  id: string
  name: string
  lat: number
  lng: number
  cost_cents: number | null
  address_line1: string | null
  trip: { year: number } | null
}

/** Frame every pin once they load, instead of guessing a zoom level. */
function FitPins({ pins }: { pins: Pin[] }) {
  const map = useMap()
  if (pins.length === 1) {
    map.setView([pins[0].lat, pins[0].lng], 15)
  } else if (pins.length > 1) {
    map.fitBounds(latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [48, 48],
      maxZoom: 15,
    })
  }
  return null
}

export default function TripMap() {
  const { data: pins = [], isLoading } = useQuery({
    queryKey: ['house-pins'],
    queryFn: async (): Promise<Pin[]> => {
      const { data, error } = await supabase
        .from('houses')
        .select('id, name, lat, lng, cost_cents, address_line1, trip:trips(year)')
        .not('lat', 'is', null)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Pin[]
    },
  })

  const sorted = [...pins].sort((a, b) => (b.trip?.year ?? 0) - (a.trip?.year ?? 0))

  return (
    <div>
      <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
        <MapPin className="size-5" aria-hidden="true" />
        Every house
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">
        {pins.length === 0
          ? 'Add latitude and longitude to a house and it will appear here.'
          : `${pins.length} ${pins.length === 1 ? 'house' : 'houses'} plotted.`}
      </p>

      <div className="mt-5 h-[60vh] min-h-80 overflow-hidden rounded-xl border border-[color:var(--border)]">
        <MapContainer center={FALLBACK} zoom={13} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitPins pins={pins} />
          {pins.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              // Leaflet's default marker images break under a bundler; a
              // styled div avoids the broken-image problem entirely and lets
              // each pin show its year.
              icon={divIcon({
                className: '',
                html: `<div style="background:#115856;color:#fff;font:600 11px/1 system-ui;padding:5px 7px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap">${p.trip?.year ?? ''}</div>`,
                iconSize: [40, 22],
                iconAnchor: [20, 11],
              })}
            >
              <Popup>
                <strong>{p.trip?.year}</strong>
                {p.name ? ` · ${p.name}` : ''}
                {p.address_line1 && <div>{p.address_line1}</div>}
                {p.cost_cents != null && <div>{money(p.cost_cents)}</div>}
                {p.trip && (
                  <Link to={`/trip/${p.trip.year}`} className="underline">
                    Open {p.trip.year}
                  </Link>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {isLoading && <p className="mt-3 text-sm text-[color:var(--text-muted)]">Loading…</p>}

      {sorted.length > 0 && (
        <ul className="mt-5 divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
          {sorted.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
              <span className="w-12 shrink-0 font-display font-semibold">{p.trip?.year}</span>
              <span className="min-w-0 flex-1 truncate">{p.name || p.address_line1 || 'House'}</span>
              {p.cost_cents != null && (
                <span className="font-mono text-[color:var(--text-muted)]">{money(p.cost_cents)}</span>
              )}
              {p.trip && (
                <Link to={`/trip/${p.trip.year}`} className="text-[color:var(--accent)] hover:underline">
                  Open
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
