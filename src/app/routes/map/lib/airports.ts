import type { AirportMeta } from '@/data'

type FlightPoint = { position: [number, number]; altitudeFeet?: number | null }

export function resolveAirportPosition(
  airport: AirportMeta | null | undefined,
  point?: FlightPoint | null
) {
  const lon = airport?.lon ?? point?.position?.[0]
  const lat = airport?.lat ?? point?.position?.[1]
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return [lon as number, lat as number] as [number, number]
}

export function resolveAirportKey(
  airport: AirportMeta | null | undefined,
  position: [number, number] | null
): string | null {
  if (airport?.iata) return airport.iata
  if (airport?.icao) return airport.icao
  if (!position) return null
  const [lon, lat] = position
  return `${lon.toFixed(3)},${lat.toFixed(3)}`
}

const regionDisplay =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryNameCache = new Map<string, string>()

export const getCountryName = (code: string | null | undefined): string | null => {
  if (!code) return null
  const upper = code.toUpperCase()
  if (countryNameCache.has(upper)) return countryNameCache.get(upper) as string
  const resolved = regionDisplay?.of(upper) ?? upper
  countryNameCache.set(upper, resolved)
  return resolved
}

export const formatAirportLabel = (
  airport: AirportMeta | null | undefined,
  fallback?: string | null
) => {
  const name = airport?.name ?? fallback ?? airport?.iata ?? airport?.icao ?? 'Unknown airport'
  const codes = [airport?.iata, airport?.icao].filter(Boolean)
  const codePart = codes.length ? ` (${codes.join('/')})` : ''
  return `${name}${codePart}`
}

export const buildAirportTokens = (
  airport: AirportMeta | null | undefined,
  fallback: string | null | undefined
) => {
  const label = formatAirportLabel(airport, fallback)
  const codes = [airport?.iata, airport?.icao].filter(Boolean).join(' ')
  return [
    fallback,
    airport?.iata,
    airport?.icao,
    airport?.name,
    airport?.city,
    airport?.country,
    getCountryName(airport?.country),
    label,
    `${label} ${codes}`.trim(),
  ]
}

