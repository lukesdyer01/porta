export interface GeocodeHit {
  lat: number
  lng: number
  /** What the service thought you meant, so a wrong match is obvious. */
  label: string
}

export interface AddressParts {
  line1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}

/**
 * Look up coordinates with OpenStreetMap's Nominatim — free, no API key, and
 * the same data behind the map tiles already in use.
 *
 * Deliberately behind a button rather than firing as you type: Nominatim's
 * usage policy asks for at most one request a second and no bulk querying, and
 * a few addresses a year is well inside that. Browsers will not let us set a
 * User-Agent, but they send the page's Referer, which identifies the app.
 */
export async function geocode(
  parts: AddressParts,
  signal?: AbortSignal,
): Promise<GeocodeHit | null> {
  const q = [parts.line1, parts.city, parts.state, parts.postalCode]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ')

  if (q.length < 4) throw new Error('Fill in the address first.')

  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=1&q=' +
    encodeURIComponent(q)

  let res: Response
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch {
    throw new Error("Couldn't reach the lookup service. Check your connection.")
  }

  if (!res.ok) throw new Error('The lookup service is busy. Try again in a moment.')

  const rows = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[]
  const hit = rows?.[0]
  if (!hit?.lat || !hit?.lon) return null

  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return { lat, lng, label: hit.display_name ?? q }
}
