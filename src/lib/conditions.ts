import { useQuery } from '@tanstack/react-query'
import { daysBetween, localToday } from './countdown'

/** Port Aransas, for houses with no coordinates recorded. */
export const PORT_A = { lat: 27.8339, lng: -97.0611 }
/** NOAA tide station: Port Aransas, Texas. */
const TIDE_STATION = '8775237'

/** Open-Meteo publishes 16 days; past that there is simply nothing to show. */
export const FORECAST_DAYS = 16

export interface DayWeather {
  date: string
  highF: number
  lowF: number
  rainChance: number
}

export interface Tide {
  time: string
  type: 'H' | 'L'
  feet: number
}

/**
 * Is this trip close enough to have a forecast?
 *
 * A July trip has no weather in January, and asking for it returns an empty
 * range rather than an error — so the check has to happen here or the block
 * renders empty with no explanation.
 */
export function forecastAvailable(startDate: string | null, now = new Date()): boolean {
  if (!startDate) return false
  return daysBetween(localToday(now), startDate) <= FORECAST_DAYS
}

const yyyymmdd = (iso: string) => iso.replace(/-/g, '')

export function useWeather(start: string | null, end: string | null, lat?: number, lng?: number) {
  const enabled = Boolean(start && end) && forecastAvailable(start)
  return useQuery({
    enabled,
    staleTime: 60 * 60_000,
    queryKey: ['weather', start, end, lat, lng],
    queryFn: async (): Promise<DayWeather[]> => {
      const p = new URLSearchParams({
        latitude: String(lat ?? PORT_A.lat),
        longitude: String(lng ?? PORT_A.lng),
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        temperature_unit: 'fahrenheit',
        timezone: 'America/Chicago',
        start_date: start!,
        end_date: end!,
      })
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`)
      if (!res.ok) throw new Error('forecast unavailable')
      const j = (await res.json()) as {
        daily?: {
          time?: string[]
          temperature_2m_max?: number[]
          temperature_2m_min?: number[]
          precipitation_probability_max?: (number | null)[]
        }
      }
      const d = j.daily
      if (!d?.time) return []
      return d.time.map((date, i) => ({
        date,
        highF: Math.round(d.temperature_2m_max?.[i] ?? 0),
        lowF: Math.round(d.temperature_2m_min?.[i] ?? 0),
        rainChance: Math.round(d.precipitation_probability_max?.[i] ?? 0),
      }))
    },
  })
}

/** Tides are astronomical, so they are predictable years ahead of the weather. */
export function useTides(start: string | null, end: string | null) {
  return useQuery({
    enabled: Boolean(start && end),
    staleTime: 12 * 60 * 60_000,
    queryKey: ['tides', start, end],
    queryFn: async (): Promise<Record<string, Tide[]>> => {
      const p = new URLSearchParams({
        station: TIDE_STATION,
        product: 'predictions',
        datum: 'MLLW',
        interval: 'hilo',
        units: 'english',
        time_zone: 'lst_ldt',
        format: 'json',
        begin_date: yyyymmdd(start!),
        end_date: yyyymmdd(end!),
      })
      const res = await fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${p}`)
      if (!res.ok) throw new Error('tides unavailable')
      const j = (await res.json()) as { predictions?: { t: string; v: string; type: string }[] }

      const byDay: Record<string, Tide[]> = {}
      for (const row of j.predictions ?? []) {
        const [date, time] = row.t.split(' ')
        if (!date) continue
        ;(byDay[date] ??= []).push({
          time: time ?? '',
          type: row.type === 'H' ? 'H' : 'L',
          feet: Number(row.v),
        })
      }
      return byDay
    },
  })
}
