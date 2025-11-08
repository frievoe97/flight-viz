import type { MapFilterValues } from './types'
import type { OverlayId } from './overlays/options'
import type { ProjectionMode } from './hooks/useMapPageState'
import { createDefaultMapFilters } from './types'

type CameraState = {
  latitude: number
  longitude: number
  zoom: number
  bearing: number
  pitch: number
}

export type MapUrlState = {
  projectionMode?: ProjectionMode
  activeOverlay?: OverlayId
  flightSpeedMultiplier?: number
  trailSpeedMultiplier?: number
  trailLengthSeconds?: number
  segmentWidthScale?: number
  routeWidthScale?: number
  airportSizeScale?: number
  analyticsRadius?: number
  analyticsMetric?: 'alt' | 'count'
  selectedFlightId?: string | null
  mapFilters?: MapFilterValues
  camera?: CameraState
}

const MAP_KEYS = {
  projection: 'map_projection',
  overlay: 'map_overlay',
  flightSpeed: 'map_flightSpeed',
  trailSpeed: 'map_trailSpeed',
  trailLength: 'map_trailLength',
  segmentWidth: 'map_segmentWidth',
  routeWidth: 'map_routeWidth',
  airportSize: 'map_airportSize',
  analyticsRadius: 'map_analyticsRadius',
  analyticsMetric: 'map_analyticsMetric',
  selectedFlight: 'map_selectedFlight',
  filter: {
    startDate: 'map_filter_startDate',
    endDate: 'map_filter_endDate',
    originAirport: 'map_filter_originAirport',
    originCountry: 'map_filter_originCountry',
    destinationAirport: 'map_filter_destinationAirport',
    destinationCountry: 'map_filter_destinationCountry',
  },
  camera: {
    lat: 'map_lat',
    lon: 'map_lon',
    zoom: 'map_zoom',
    bearing: 'map_bearing',
    pitch: 'map_pitch',
  },
} as const

const clampOverlay = (value: string | null): OverlayId | undefined => {
  const allowed: OverlayId[] = [
    'segments',
    'analytics',
    'flights',
    'trails',
    'routes',
    'airports',
    'speed-columns',
    'climb-bursts',
  ]
  return allowed.includes(value as OverlayId) ? (value as OverlayId) : undefined
}

const clampProjection = (value: string | null): ProjectionMode | undefined => {
  return value === 'globe' || value === 'mercator' ? (value as ProjectionMode) : undefined
}

const parseNumber = (value: string | null): number | undefined => {
  if (value == null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseFilters = (params: URLSearchParams): MapFilterValues => {
  const defaults = createDefaultMapFilters()
  return {
    startDate: params.get(MAP_KEYS.filter.startDate) ?? defaults.startDate,
    endDate: params.get(MAP_KEYS.filter.endDate) ?? defaults.endDate,
    originAirport: params.get(MAP_KEYS.filter.originAirport) ?? defaults.originAirport,
    originCountry: params.get(MAP_KEYS.filter.originCountry) ?? defaults.originCountry,
    destinationAirport:
      params.get(MAP_KEYS.filter.destinationAirport) ?? defaults.destinationAirport,
    destinationCountry:
      params.get(MAP_KEYS.filter.destinationCountry) ?? defaults.destinationCountry,
  }
}

const hasAnyFilterValue = (filters: MapFilterValues) =>
  Object.values(filters).some((value) => value.trim().length > 0)

export function parseMapUrlState(params: URLSearchParams): MapUrlState {
  const filters = parseFilters(params)
  const cameraLat = parseNumber(params.get(MAP_KEYS.camera.lat))
  const cameraLon = parseNumber(params.get(MAP_KEYS.camera.lon))
  const cameraZoom = parseNumber(params.get(MAP_KEYS.camera.zoom))
  const cameraBearing = parseNumber(params.get(MAP_KEYS.camera.bearing))
  const cameraPitch = parseNumber(params.get(MAP_KEYS.camera.pitch))

  const camera =
    cameraLat != null &&
    cameraLon != null &&
    cameraZoom != null &&
    cameraBearing != null &&
    cameraPitch != null
      ? {
          latitude: cameraLat,
          longitude: cameraLon,
          zoom: cameraZoom,
          bearing: cameraBearing,
          pitch: cameraPitch,
        }
      : undefined

  return {
    projectionMode: clampProjection(params.get(MAP_KEYS.projection)),
    activeOverlay: clampOverlay(params.get(MAP_KEYS.overlay)),
    flightSpeedMultiplier: parseNumber(params.get(MAP_KEYS.flightSpeed)),
    trailSpeedMultiplier: parseNumber(params.get(MAP_KEYS.trailSpeed)),
    trailLengthSeconds: parseNumber(params.get(MAP_KEYS.trailLength)),
    segmentWidthScale: parseNumber(params.get(MAP_KEYS.segmentWidth)),
    routeWidthScale: parseNumber(params.get(MAP_KEYS.routeWidth)),
    airportSizeScale: parseNumber(params.get(MAP_KEYS.airportSize)),
    analyticsRadius: parseNumber(params.get(MAP_KEYS.analyticsRadius)),
    analyticsMetric: params.get(MAP_KEYS.analyticsMetric) === 'count' ? 'count' : 'alt',
    selectedFlightId: params.get(MAP_KEYS.selectedFlight),
    mapFilters: hasAnyFilterValue(filters) ? filters : undefined,
    camera,
  }
}

export function buildMapUrlParams(state: MapUrlState): Record<string, string | null | undefined> {
  const updates: Record<string, string | null | undefined> = {}
  updates[MAP_KEYS.projection] = state.projectionMode ?? null
  updates[MAP_KEYS.overlay] = state.activeOverlay ?? null
  updates[MAP_KEYS.flightSpeed] =
    state.flightSpeedMultiplier != null ? String(state.flightSpeedMultiplier) : null
  updates[MAP_KEYS.trailSpeed] =
    state.trailSpeedMultiplier != null ? String(state.trailSpeedMultiplier) : null
  updates[MAP_KEYS.trailLength] =
    state.trailLengthSeconds != null ? String(state.trailLengthSeconds) : null
  updates[MAP_KEYS.segmentWidth] =
    state.segmentWidthScale != null ? String(state.segmentWidthScale) : null
  updates[MAP_KEYS.routeWidth] =
    state.routeWidthScale != null ? String(state.routeWidthScale) : null
  updates[MAP_KEYS.airportSize] =
    state.airportSizeScale != null ? String(state.airportSizeScale) : null
  updates[MAP_KEYS.analyticsRadius] =
    state.analyticsRadius != null ? String(state.analyticsRadius) : null
  updates[MAP_KEYS.analyticsMetric] = state.analyticsMetric ?? null
  updates[MAP_KEYS.selectedFlight] = state.selectedFlightId ?? null

  const filters = state.mapFilters ?? createDefaultMapFilters()
  updates[MAP_KEYS.filter.startDate] = filters.startDate || null
  updates[MAP_KEYS.filter.endDate] = filters.endDate || null
  updates[MAP_KEYS.filter.originAirport] = filters.originAirport || null
  updates[MAP_KEYS.filter.originCountry] = filters.originCountry || null
  updates[MAP_KEYS.filter.destinationAirport] = filters.destinationAirport || null
  updates[MAP_KEYS.filter.destinationCountry] = filters.destinationCountry || null

  if (state.camera) {
    updates[MAP_KEYS.camera.lat] = state.camera.latitude.toFixed(6)
    updates[MAP_KEYS.camera.lon] = state.camera.longitude.toFixed(6)
    updates[MAP_KEYS.camera.zoom] = state.camera.zoom.toFixed(4)
    updates[MAP_KEYS.camera.bearing] = state.camera.bearing.toFixed(2)
    updates[MAP_KEYS.camera.pitch] = state.camera.pitch.toFixed(2)
  } else {
    updates[MAP_KEYS.camera.lat] = null
    updates[MAP_KEYS.camera.lon] = null
    updates[MAP_KEYS.camera.zoom] = null
    updates[MAP_KEYS.camera.bearing] = null
    updates[MAP_KEYS.camera.pitch] = null
  }

  return updates
}

export type { CameraState }
