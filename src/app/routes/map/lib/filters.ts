import type { Flight } from '@/data'
import { buildAirportTokens, getCountryName } from './airports'

export type NormalizedFilters = {
  startDateMs: number | null
  endDateMs: number | null
  originAirport: string | null
  originCountry: string | null
  destinationAirport: string | null
  destinationCountry: string | null
}

export const normalizeText = (value: string | null | undefined) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.length ? normalized : null
}

export const matchesTextFilter = (
  needle: string | null,
  candidates: Array<string | null | undefined>
): boolean => {
  if (!needle) return true
  const terms = needle
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
  if (!terms.length) return true

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeText(candidate)
    if (!normalizedCandidate) return false
    return terms.some((term) => normalizedCandidate.includes(term))
  })
}

export const parseDateToMs = (
  value: string | null | undefined,
  endOfDay = false
): number | null => {
  if (!value) return null
  const suffix = endOfDay ? 'T23:59:59Z' : 'T00:00:00Z'
  const parsed = Date.parse(`${value}${value.includes('T') ? '' : suffix}`)
  return Number.isFinite(parsed) ? parsed : null
}

export const parseUtcToMs = (value: string | null | undefined): number | null => {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const flightMatchesFilters = (flight: Flight, filters: NormalizedFilters): boolean => {
  const startTime = parseUtcToMs(flight.meta?.startTimeUtc) ?? parseUtcToMs(flight.meta?.endTimeUtc)
  if (filters.startDateMs && (startTime == null || startTime < filters.startDateMs)) return false
  if (filters.endDateMs && (startTime == null || startTime > filters.endDateMs)) return false

  const departureAirport = flight.meta?.departureAirport
  const arrivalAirport = flight.meta?.arrivalAirport
  const departureCountryName = getCountryName(departureAirport?.country)
  const arrivalCountryName = getCountryName(arrivalAirport?.country)

  if (
    !matchesTextFilter(filters.originAirport, buildAirportTokens(departureAirport, flight.origin))
  ) {
    return false
  }

  if (!matchesTextFilter(filters.originCountry, [departureAirport?.country, departureCountryName])) {
    return false
  }

  if (
    !matchesTextFilter(
      filters.destinationAirport,
      buildAirportTokens(arrivalAirport, flight.destination)
    )
  ) {
    return false
  }

  if (
    !matchesTextFilter(filters.destinationCountry, [arrivalAirport?.country, arrivalCountryName])
  ) {
    return false
  }

  return true
}

