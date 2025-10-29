// Global flight data loader using Vite import.meta.glob
// Parses GeoJSON tracks and aligns optional meta.json per flight

const FEET_TO_METERS = 0.3048
const EARTH_RADIUS_KM = 6371

export type Point = {
  position: [number, number]
  altitudeFeet: number | null
  altitudeMeters: number
  speedKts: number | null
  speedMph: number | null
  verticalRateFpm: number | null
  timeLabel: string | null
  facility: string | null
  distanceKm?: number
}

export type Stats = { min: number | null; max: number | null; avg: number | null }

export type Flight = {
  id: string
  name: string
  origin: string | null
  destination: string | null
  pointCount: number
  distanceKm: number
  durationSeconds: number | null
  altitudeStats: Stats
  speedKtsStats: Stats
  speedMphStats: Stats
  verticalRateStats: Stats
  meta: unknown
  points: Point[]
}

export type FlightSegment = {
  id: string
  start: [number, number]
  end: [number, number]
  startAltitudeFeet: number
  startAltitudeMeters: number
  endAltitudeFeet: number
  endAltitudeMeters: number
  startSpeedKts: number | null
  endSpeedKts: number | null
  startTime: string | null
  endTime: string | null
  flightId: string
  name: string
  origin: string | null
  destination: string | null
}

export type FlightAggregates = {
  totalFlights: number
  totalDistanceKm: number
  totalDurationSeconds: number
  averageSpeedKts: number | null
  averageAltitudeFt: number | null
  maxAltitudeFt: number
  maxSpeedKts: number
}

export type FlightData = {
  flights: Flight[]
  flightSegments: FlightSegment[]
  aggregatedStats: FlightAggregates
  INITIAL_VIEW_STATE: {
    latitude: number
    longitude: number
    zoom: number
    maxZoom: number
    pitch: number
    maxPitch: number
    bearing: number
  }
}

function toNumber(rawValue: unknown): number | null {
  if (rawValue == null || rawValue === '') return null
  const normalized = String(rawValue).replace(/[^0-9+\-.,]/g, '').replace(',', '.')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function calcStats(values: Array<number | null | undefined>): Stats {
  const finiteValues = values.filter((v): v is number => Number.isFinite(v as number)) as number[]
  if (!finiteValues.length) return { min: null, max: null, avg: null }
  const min = Math.min(...finiteValues)
  const max = Math.max(...finiteValues)
  const sum = finiteValues.reduce((acc, v) => acc + v, 0)
  const avg = sum / finiteValues.length
  return { min, max, avg }
}

function mergeStats(primary?: Stats | null, fallback?: Stats | null): Stats {
  return {
    min: primary?.min ?? fallback?.min ?? null,
    max: primary?.max ?? fallback?.max ?? null,
    avg: primary?.avg ?? fallback?.avg ?? null,
  }
}

function extractAirportCodes(basename: string) {
  const tokens = basename
    .split('_')
    .flatMap((t) => t.split('-'))
    .map((t) => t.trim())
  const codes = tokens.filter((t) => /^[A-Z]{3,4}$/.test(t))
  return { origin: codes[0] ?? null, destination: codes[1] ?? null }
}

function centerOf(points: Array<{ latitude: number; longitude: number }>) {
  if (!points.length) return { latitude: 50, longitude: 8 }
  const sum = points.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 }
  )
  return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const radLat1 = toRadians(lat1)
  const radLat2 = toRadians(lat2)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

function computeTrackLength(points: Array<{ latitude: number; longitude: number }>) {
  let total = 0
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i]
    const next = points[i + 1]
    total += haversineDistanceKm(current.latitude, current.longitude, next.latitude, next.longitude)
  }
  return total
}

function parseEuDateTime(token: string | null | undefined) {
  if (!token) return null
  const parts = token.trim().split(/\s+/)
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

function normalizeMeta(metaRaw: unknown) {
  if (!metaRaw || typeof metaRaw !== 'object') return null
  const toNum = (v: unknown) => toNumber(v)
  const bboxRaw = metaRaw.bbox ?? null
  const bbox = bboxRaw
    ? {
        minLat: toNum(bboxRaw.min_lat),
        minLon: toNum(bboxRaw.min_lon),
        maxLat: toNum(bboxRaw.max_lat),
        maxLon: toNum(bboxRaw.max_lon),
      }
    : null
  return {
    startTimeBerlin: metaRaw.start_time_berlin ?? null,
    endTimeBerlin: metaRaw.end_time_berlin ?? null,
    durationSeconds: toNum(metaRaw.duration_seconds),
    trackLengthKm: toNum(metaRaw.track_length_km),
    bbox,
    points: metaRaw.points ? Number.parseInt(metaRaw.points, 10) : null,
    speedKts: { min: toNum(metaRaw.speed_kts_min), max: toNum(metaRaw.speed_kts_max), avg: toNum(metaRaw.speed_kts_avg) },
    speedMph: { min: toNum(metaRaw.speed_mph_min), max: toNum(metaRaw.speed_mph_max), avg: toNum(metaRaw.speed_mph_avg) },
    altitudeFt: { min: toNum(metaRaw.altitude_ft_min), max: toNum(metaRaw.altitude_ft_max), avg: toNum(metaRaw.altitude_ft_avg) },
    verticalRateFpm: { min: toNum(metaRaw.vertical_rate_fpm_min), max: toNum(metaRaw.vertical_rate_fpm_max), avg: toNum(metaRaw.vertical_rate_fpm_avg) },
  }
}

function buildFlight(path: string, geojsonSource: string, metaModules: Record<string, unknown>) {
  let geojson: unknown
  try {
    geojson = JSON.parse(geojsonSource)
  } catch (error) {
    console.warn(`Failed to parse GeoJSON for ${path}:`, error)
    return null
  }
  const filename = path.split('/').pop() ?? 'flight.geojson'
  const id = filename.replace(/\.geojson$/i, '')
  const { origin, destination } = extractAirportCodes(id)

  const metaKey = path.replace(/\.geojson$/i, '.meta.json')
  const metaRaw = metaModules[metaKey]
  const normalizedMeta = normalizeMeta(metaRaw)

  let feature: unknown = null
  const g: any = geojson as any
  if (g?.type === 'FeatureCollection') {
    const feats: unknown[] = Array.isArray(g.features) ? g.features : []
    feature = (feats.find((candidate: unknown) => (candidate as any)?.geometry?.type === 'LineString') as unknown) ?? null
  } else if (g?.type === 'Feature' && g.geometry?.type === 'LineString') {
    feature = g
  }
  if (!feature) return null

  const f: any = feature as any
  const coordinates: unknown[] = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates : []
  if (coordinates.length < 2) return null

  const properties: any = f.properties ?? {}
  const propArray = (key: string) => (Array.isArray(properties[key]) ? (properties[key] as unknown[]) : [])

  const altitudeArray = propArray('altitude_ft')
  const speedKtsArray = propArray('speed_kts')
  const speedMphArray = propArray('speed_mph')
  const verticalRateArray = propArray('vertical_rate_fpm')
  const facilityArray = propArray('reporting_facility')
  const timeArray = propArray('time_europe_berlin')

  const altitudeValues: number[] = []
  const speedKtsValues: number[] = []
  const speedMphValues: number[] = []
  const verticalRateValues: number[] = []
  const timestamps: number[] = []

  const points: Point[] = []
  for (let i = 0; i < coordinates.length; i += 1) {
    const coord: any = coordinates[i] as any
    const lon = Number(coord?.[0])
    const lat = Number(coord?.[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue

    const altitudeFeet = toNumber(altitudeArray[i])
    if (Number.isFinite(altitudeFeet)) altitudeValues.push(altitudeFeet as number)
    const altitudeMeters = Number.isFinite(altitudeFeet as number) ? (altitudeFeet as number) * FEET_TO_METERS : 0

    const speedKts = toNumber(speedKtsArray[i])
    if (Number.isFinite(speedKts)) speedKtsValues.push(speedKts as number)

    const speedMph = toNumber(speedMphArray[i])
    if (Number.isFinite(speedMph)) speedMphValues.push(speedMph as number)

    const verticalRateFpm = toNumber(verticalRateArray[i])
    if (Number.isFinite(verticalRateFpm)) verticalRateValues.push(verticalRateFpm as number)

    const timeLabel = typeof timeArray[i] === 'string' ? (timeArray[i] as string).trim() : null
    if (timeLabel) {
      const parsed = parseEuDateTime(timeLabel)
      if (parsed) timestamps.push(parsed.getTime())
    }

    const facilityRaw = typeof facilityArray[i] === 'string' ? (facilityArray[i] as string) : null
    const facility = facilityRaw ? facilityRaw.trim().replace(/\s+/g, ' ') : null

    points.push({ position: [lon, lat], altitudeFeet, altitudeMeters, speedKts, speedMph, verticalRateFpm, timeLabel, facility })
  }
  if (points.length < 2) return null

  let cumulativeDistanceKm = 0
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]
    if (i === 0) {
      point.distanceKm = 0
      continue
    }
    const previous = points[i - 1]
    cumulativeDistanceKm += haversineDistanceKm(previous.position[1], previous.position[0], point.position[1], point.position[0])
    point.distanceKm = cumulativeDistanceKm
  }

  const altitudeStats = calcStats(points.map((p) => p.altitudeFeet))
  const speedKtsStats = calcStats(points.map((p) => p.speedKts))
  const speedMphStats = calcStats(points.map((p) => p.speedMph))
  const verticalRateStats = calcStats(points.map((p) => p.verticalRateFpm))

  const { latitude, longitude } = centerOf(points.map((p) => ({ latitude: p.position[1], longitude: p.position[0] })))
  const positions = points.map((p) => ({ latitude: p.position[1], longitude: p.position[0] }))

  const name = (() => {
    const { origin, destination } = extractAirportCodes(id)
    return origin && destination ? `${origin} → ${destination}` : id
  })()
  const pointCount = points.length

  const distanceKm = normalizedMeta?.trackLengthKm ?? computeTrackLength(positions)
  const durationSeconds = normalizedMeta?.durationSeconds ?? (() => {
    const timestamps = points
      .map((p) => (p.timeLabel ? parseEuDateTime(p.timeLabel)?.getTime() ?? null : null))
      .filter((t): t is number => Number.isFinite(t as number))
    if (!timestamps.length) return null
    const first = timestamps[0]
    const last = timestamps[timestamps.length - 1]
    const delta = (last - first) / 1000
    return Number.isFinite(delta) && delta >= 0 ? delta : null
  })()

  const mergedAltitudeStats = mergeStats(normalizedMeta?.altitudeFt, altitudeStats)
  const mergedSpeedKtsStats = mergeStats(normalizedMeta?.speedKts, speedKtsStats)
  const mergedSpeedMphStats = mergeStats(normalizedMeta?.speedMph, speedMphStats)
  const mergedVerticalRateStats = mergeStats(normalizedMeta?.verticalRateFpm, verticalRateStats)

  const flight: Flight = {
    id,
    name,
    origin,
    destination,
    pointCount,
    distanceKm,
    durationSeconds,
    altitudeStats: mergedAltitudeStats,
    speedKtsStats: mergedSpeedKtsStats,
    speedMphStats: mergedSpeedMphStats,
    verticalRateStats: mergedVerticalRateStats,
    meta: normalizedMeta,
    points,
  }

  const segments: FlightSegment[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]
    const end = points[i + 1]
    segments.push({
      id: `${id}-${i}`,
      start: start.position,
      end: end.position,
      startAltitudeFeet: start.altitudeFeet ?? 0,
      startAltitudeMeters: start.altitudeMeters ?? 0,
      endAltitudeFeet: end.altitudeFeet ?? 0,
      endAltitudeMeters: end.altitudeMeters ?? 0,
      startSpeedKts: start.speedKts ?? null,
      endSpeedKts: end.speedKts ?? null,
      startTime: start.timeLabel ?? null,
      endTime: end.timeLabel ?? null,
      flightId: id,
      name,
      origin,
      destination,
    })
  }

  return { flight, segments, positions, center: { latitude, longitude } }
}

let cached: Promise<FlightData> | null = null

export async function getFlightData(): Promise<FlightData> {
  if (cached) return cached
  cached = (async () => {
    const geojsonModules = import.meta.glob('./raw/**/*.geojson', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>
    const metaModules = import.meta.glob('./raw/**/*.meta.json', { eager: true, import: 'default' }) as Record<string, unknown>

    const flights: Flight[] = []
    const flightSegments: FlightSegment[] = []
    const allPositions: Array<{ latitude: number; longitude: number }> = []

    const totals = {
      distanceKm: 0,
      durationSeconds: 0,
      maxAltitudeFeet: 0,
      maxSpeedKts: 0,
      speedKtsWeightedSum: 0,
      altitudeFtWeightedSum: 0,
      speedWeight: 0,
      altitudeWeight: 0,
    }

    for (const [path, geojson] of Object.entries(geojsonModules)) {
      const result = buildFlight(path, geojson, metaModules)
      if (!result) continue
      const { flight, segments, positions } = result
      flights.push(flight)
      flightSegments.push(...segments)
      allPositions.push(...positions)

      const distanceKm = Number.isFinite(flight.distanceKm) ? flight.distanceKm : 0
      totals.distanceKm += distanceKm
      const durationSeconds = Number.isFinite(flight.durationSeconds as number) ? (flight.durationSeconds as number) : 0
      totals.durationSeconds += durationSeconds
      const altitudeMax = Number.isFinite(flight.altitudeStats.max as number) ? (flight.altitudeStats.max as number) : 0
      totals.maxAltitudeFeet = Math.max(totals.maxAltitudeFeet, altitudeMax)
      const speedMax = Number.isFinite(flight.speedKtsStats.max as number) ? (flight.speedKtsStats.max as number) : 0
      totals.maxSpeedKts = Math.max(totals.maxSpeedKts, speedMax)

      const weight = (flight.meta?.points as number | null) ?? flight.pointCount ?? segments.length + 1
      if (Number.isFinite(flight.speedKtsStats.avg as number)) {
        totals.speedKtsWeightedSum += (flight.speedKtsStats.avg as number) * weight
        totals.speedWeight += weight
      }
      if (Number.isFinite(flight.altitudeStats.avg as number)) {
        totals.altitudeFtWeightedSum += (flight.altitudeStats.avg as number) * weight
        totals.altitudeWeight += weight
      }
    }

    const aggregatedStats: FlightAggregates = {
      totalFlights: flights.length,
      totalDistanceKm: totals.distanceKm,
      totalDurationSeconds: totals.durationSeconds,
      averageSpeedKts: totals.speedWeight > 0 ? totals.speedKtsWeightedSum / totals.speedWeight : null,
      averageAltitudeFt: totals.altitudeWeight > 0 ? totals.altitudeFtWeightedSum / totals.altitudeWeight : null,
      maxAltitudeFt: totals.maxAltitudeFeet,
      maxSpeedKts: totals.maxSpeedKts,
    }

    const { latitude, longitude } = centerOf(allPositions)
    const INITIAL_VIEW_STATE = { latitude, longitude, zoom: 3.2, maxZoom: 12, pitch: 0, maxPitch: 0, bearing: 0 }

    return { flights, flightSegments, aggregatedStats, INITIAL_VIEW_STATE }
  })()
  return cached
}

export default { getFlightData }
