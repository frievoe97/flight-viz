import type { Flight } from '@/data'

export const UNKNOWN_LABEL = 'Unknown'

export type AirportRole = 'origin' | 'destination'

export type OptionValue = { value: string; label: string }

export function parseEuDateTime(raw: string | null | undefined) {
  if (!raw) return null
  const parts = raw.trim().split(/\s+/)
  if (parts.length < 2) return null
  const [datePart, timePart] = parts
  const dateTokens = datePart.split('.')
  const timeTokens = timePart.split(':')
  if (dateTokens.length !== 3 || timeTokens.length < 2) return null
  const day = Number.parseInt(dateTokens[0], 10)
  const month = Number.parseInt(dateTokens[1], 10)
  const year = Number.parseInt(dateTokens[2], 10)
  const hour = Number.parseInt(timeTokens[0], 10)
  const minute = Number.parseInt(timeTokens[1], 10)
  const second = Number.parseInt(timeTokens[2] ?? '0', 10)
  if ([day, month, year, hour, minute, second].some((n) => !Number.isFinite(n))) return null
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

export function getMetaDateString(flight: Flight, key: 'startTimeBerlin' | 'endTimeBerlin') {
  if (!flight.meta) return null
  return flight.meta[key]
}

export function getAirportMeta(flight: Flight, role: AirportRole) {
  if (!flight.meta) return null
  return role === 'origin' ? flight.meta.departureAirport : flight.meta.arrivalAirport
}

export function getAirportCode(flight: Flight, role: AirportRole): string | null {
  const airport = getAirportMeta(flight, role)
  const fallback = role === 'origin' ? flight.origin : flight.destination
  const candidates = [airport?.iata, airport?.icao, fallback]
  for (const candidate of candidates) {
    if (!candidate) continue
    const trimmed = candidate.trim()
    if (trimmed) return trimmed
  }
  return null
}

export function getAirportOption(flight: Flight, role: AirportRole): OptionValue {
  const airport = getAirportMeta(flight, role)
  const code = getAirportCode(flight, role)
  const value = code ?? UNKNOWN_LABEL
  if (!airport) {
    return { value, label: value }
  }
  const descriptor = [airport.name, airport.city]
    .map((token) => (typeof token === 'string' ? token.trim() : ''))
    .filter(Boolean)
    .join(', ')
  if (!descriptor) return { value, label: value }
  if (value === UNKNOWN_LABEL) return { value, label: descriptor }
  return { value, label: `${value} • ${descriptor}` }
}

export function formatCountryLabel(codeOrName: string, displayNames: Intl.DisplayNames | null) {
  const trimmed = codeOrName.trim()
  if (!trimmed) return UNKNOWN_LABEL
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase()
    const label = displayNames?.of(upper)
    return label ?? upper
  }
  return trimmed
}

export function getCountryOption(
  flight: Flight,
  role: AirportRole,
  displayNames: Intl.DisplayNames | null
): OptionValue {
  const airport = getAirportMeta(flight, role)
  const countryRaw = typeof airport?.country === 'string' ? airport?.country : null
  if (!countryRaw) {
    return { value: UNKNOWN_LABEL, label: UNKNOWN_LABEL }
  }
  const normalized = countryRaw.length === 2 ? countryRaw.toUpperCase() : countryRaw
  return {
    value: normalized,
    label: formatCountryLabel(normalized, displayNames),
  }
}

export function getFlightStart(flight: Flight) {
  const fromMeta = parseEuDateTime(getMetaDateString(flight, 'startTimeBerlin'))
  if (fromMeta) return fromMeta
  const firstTimestamp = flight.points.find((p) => p.timeLabel)?.timeLabel
  return parseEuDateTime(firstTimestamp ?? undefined)
}

export function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function formatDateLabel(key: string) {
  const [year, month, day] = key.split('-').map((token) => Number.parseInt(token, 10))
  if ([year, month, day].some((n) => !Number.isFinite(n))) return key
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(2)}`
}

export function truncateRouteLabel(label: string) {
  return label.length > 11 ? `${label.slice(0, 11)}…` : label
}

export function formatDuration(seconds: number | null) {
  if (!Number.isFinite(seconds as number)) return '–'
  const total = Math.round(seconds as number)
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours === 0 && minutes === 0) return '< 1 min'
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
}

export function formatDateTimeLabel(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${day}.${month}.${year} ${hours}:${minutes}`
}
