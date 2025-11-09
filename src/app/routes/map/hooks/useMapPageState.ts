import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Deck, Layer, PickingInfo } from '@deck.gl/core'
import * as maplibregl from 'maplibre-gl'
import type { Map as MaplibreMap, LngLatBoundsLike, PaddingOptions } from 'maplibre-gl'
import { getFlightData, type Flight, type FlightSegment, type AirportMeta } from '@/data'
import { useSegmentsLayer, findSelectedFlight } from '../overlays/segments'
import { useAnimatedFlightsOverlay } from '../overlays/animatedFlights'
import { useTrailsOverlay, type Trip } from '../overlays/trails'
import { useAnalyticsLayer, type AnalyticsPickingInfo } from '../overlays/analytics'
import { useRoutesLayer, type RouteArcDatum } from '../overlays/routes'
import { useAirportHubsLayer, type AirportHubDatum } from '../overlays/airports'
import type { OverlayId } from '../overlays/options'
import {
  createDefaultMapFilters,
  type FilterSuggestion,
  type MapFilterField,
  type MapFilterValues,
} from '../types'
import { nf0, formatKm, formatFt, formatDuration } from '@/lib/format'
import {
  resolveAirportPosition,
  resolveAirportKey,
  formatAirportLabel,
  getCountryName,
} from '../lib/airports'
import {
  type NormalizedFilters,
  normalizeText,
  parseDateToMs,
  flightMatchesFilters,
} from '../lib/filters'
import type { Theme } from '@/lib/theme/useTheme'

type MapWithCamera = MaplibreMap & {
  cameraForBounds?: (
    bounds: LngLatBoundsLike,
    options?: { padding?: number | PaddingOptions; maxZoom?: number }
  ) => { center?: maplibregl.LngLatLike; zoom: number }
}

const ZERO_PADDING: PaddingOptions = { top: 0, right: 0, bottom: 0, left: 0 }
const SEGMENT_FOCUS_PITCH = 32
const toRad = (value: number) => (value * Math.PI) / 180
const toDeg = (value: number) => (value * 180) / Math.PI

type FlightPoint = Flight['points'][number]

const MODE_SUPPORT: Record<'globe' | 'mercator', ReadonlyArray<OverlayId>> = {
  globe: ['flights', 'trails', 'airports'],
  mercator: ['segments', 'analytics', 'flights', 'trails', 'routes', 'airports'],
} as const

export type ProjectionMode = keyof typeof MODE_SUPPORT
type DeckWithOptionalRedraw = Deck & { setNeedsRedraw?: (reason: string) => void }

// NormalizedFilters type is imported from ../lib/filters

// helpers moved to ../lib/filters and ../lib/airports

export function useMapPageState({ theme }: { theme: Theme }) {
  const [activeOverlay, setActiveOverlay] = useState<OverlayId>('trails')
  const [analyticsMetric, setAnalyticsMetric] = useState<'alt' | 'speed' | 'count'>('alt')
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof getFlightData>> | null>(null)
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  const [hoveredFlightId, setHoveredFlightId] = useState<string | null>(null)
  const [flightSpeedMultiplier, setFlightSpeedMultiplier] = useState(1)
  const [planeSizeScale, setPlaneSizeScale] = useState(1)
  const [trailSpeedMultiplier, setTrailSpeedMultiplier] = useState(2)
  const [trailLengthSeconds, setTrailLengthSeconds] = useState(30)
  const [trailWidthScale, setTrailWidthScale] = useState(1)
  const [trailOpacity, setTrailOpacity] = useState(0.85)
  const [segmentWidthScale, setSegmentWidthScale] = useState(1)
  const [routeWidthScale, setRouteWidthScale] = useState(1)
  const [routeHeight, setRouteHeight] = useState(0.2)
  const [routeOpacity, setRouteOpacity] = useState(0.9)
  const [routeAnimate, setRouteAnimate] = useState(true)
  const [airportSizeScale, setAirportSizeScale] = useState(1)
  const [airportOpacity, setAirportOpacity] = useState(0.95)
  const [analyticsRadius, setAnalyticsRadius] = useState(20000)
  const [analyticsElevationScale, setAnalyticsElevationScale] = useState(35)
  const [analyticsOpacity, setAnalyticsOpacity] = useState(0.95)
  const [isMotionPaused, setIsMotionPaused] = useState(false)
  // removed speed columns / climb bursts settings
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('globe')
  const [activeControlPanel, setActiveControlPanel] = useState<'layers' | 'settings' | null>(null)
  const [pendingOverlay, setPendingOverlay] = useState<OverlayId | null>(null)
  const [mapZoom, setMapZoom] = useState(0)
  const [mapFilters, setMapFilters] = useState<MapFilterValues>(createDefaultMapFilters)

  const mapRef = useRef<MapRef | null>(null)
  const deckOverlayRef = useRef<MapboxOverlay | null>(null)
  const lastOverlayByMode = useRef<Partial<Record<ProjectionMode, OverlayId>>>({
    mercator: 'segments',
    globe: 'trails',
  })
  const hasFitBoundsRef = useRef(false)
  const closeControlPanels = useCallback(() => setActiveControlPanel(null), [])
  const toggleMotionPaused = useCallback(() => setIsMotionPaused((prev) => !prev), [])

  const hasActiveFilters = useMemo(
    () => Object.values(mapFilters).some((value) => value.trim().length > 0),
    [mapFilters]
  )

  const normalizedFilters = useMemo<NormalizedFilters>(() => {
    return {
      startDateMs: parseDateToMs(mapFilters.startDate),
      endDateMs: parseDateToMs(mapFilters.endDate, true),
      originAirport: normalizeText(mapFilters.originAirport),
      originCountry: normalizeText(mapFilters.originCountry),
      destinationAirport: normalizeText(mapFilters.destinationAirport),
      destinationCountry: normalizeText(mapFilters.destinationCountry),
    }
  }, [mapFilters])

  const visibleFlights = useMemo(() => {
    if (!data?.flights) return [] as Flight[]
    if (!hasActiveFilters) return data.flights
    return data.flights.filter((flight) => flightMatchesFilters(flight, normalizedFilters))
  }, [data, normalizedFilters, hasActiveFilters])

  const visibleFlightIds = useMemo(() => {
    return new Set(visibleFlights.map((flight) => flight.id))
  }, [visibleFlights])

  const filteredSegments = useMemo(() => {
    if (!data?.flightSegments) return [] as FlightSegment[]
    if (!visibleFlightIds.size) return [] as FlightSegment[]
    return data.flightSegments.filter((segment) => visibleFlightIds.has(segment.flightId))
  }, [data, visibleFlightIds])

  const airportSuggestions = useMemo<FilterSuggestion[]>(() => {
    if (!data?.flights) return []
    const suggestions = new Map<string, FilterSuggestion>()
    const addSuggestion = (airport: AirportMeta | null | undefined, fallback?: string | null) => {
      if (!airport && !fallback) return
      const label = formatAirportLabel(airport, fallback)
      const codes = [airport?.iata, airport?.icao].filter(Boolean).join(' ')
      const searchKey = [label, airport?.city, airport?.country, codes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const id = `${airport?.iata ?? ''}-${airport?.icao ?? ''}-${label}`.toLowerCase()
      suggestions.set(id, {
        id,
        value: label,
        label,
        searchKey,
      })
    }

    for (const flight of data.flights) {
      addSuggestion(flight.meta?.departureAirport, flight.origin)
      addSuggestion(flight.meta?.arrivalAirport, flight.destination)
    }

    return Array.from(suggestions.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [data])

  const countrySuggestions = useMemo<FilterSuggestion[]>(() => {
    if (!data?.flights) return []
    const countries = new Set<string>()
    data.flights.forEach((flight) => {
      const departureCountry = flight.meta?.departureAirport?.country
      const arrivalCountry = flight.meta?.arrivalAirport?.country
      if (departureCountry) countries.add(departureCountry)
      if (arrivalCountry) countries.add(arrivalCountry)
    })
    return Array.from(countries)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => {
        const label = getCountryName(value) ?? value
        return {
          id: value.toLowerCase(),
          value: label,
          label,
          searchKey: `${value.toLowerCase()} ${label.toLowerCase()}`.trim(),
        }
      })
  }, [data])

  const updateMapFilter = useCallback((field: MapFilterField, value: string) => {
    setMapFilters((prev) => {
      if (prev[field] === value) return prev
      return { ...prev, [field]: value }
    })
  }, [])

  const applyMapFilters = useCallback((next: MapFilterValues) => {
    setMapFilters((prev) => {
      const keys = Object.keys(prev) as Array<keyof MapFilterValues>
      const changed = keys.some((key) => prev[key] !== next[key])
      if (!changed) return prev
      return { ...next }
    })
  }, [])

  const resetMapFilters = useCallback(() => {
    setMapFilters(createDefaultMapFilters())
  }, [])

  const requestDeckRedraw = useCallback((reason: string) => {
    const overlayWithDeck = deckOverlayRef.current as unknown as {
      deck?: DeckWithOptionalRedraw
    } | null
    overlayWithDeck?.deck?.setNeedsRedraw?.(reason)
  }, [])

  const isSegments = activeOverlay === 'segments'
  const isFlights = activeOverlay === 'flights'
  const isTrails = activeOverlay === 'trails'
  const isAnalytics = activeOverlay === 'analytics'
  const isRoutes = activeOverlay === 'routes'
  const isAirports = activeOverlay === 'airports'
  const isSpeedColumns = false
  const isClimbBursts = false

  useEffect(() => {
    getFlightData().then((d) => {
      setData(d)
      if (d?.INITIAL_VIEW_STATE?.zoom != null) {
        setMapZoom(d.INITIAL_VIEW_STATE.zoom)
      }
    })
  }, [])

  useEffect(() => {
    hasFitBoundsRef.current = false
  }, [data])

  const focusAllFlights = useCallback(
    (mode: ProjectionMode, { animate = true }: { animate?: boolean } = {}) => {
      if (!data) return
      const mapInstance = mapRef.current?.getMap?.() as MapWithCamera | undefined
      if (!mapInstance) return
      const flightsForBounds =
        visibleFlights.length > 0 ? visibleFlights : (data.flights ?? ([] as Flight[]))
      if (!flightsForBounds.length) return

      const bounds = new maplibregl.LngLatBounds()
      for (const flight of flightsForBounds) {
        for (const point of flight.points) {
          const [lon, lat] = point.position
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            bounds.extend([lon, lat])
          }
        }
      }
      if (bounds.isEmpty()) return

      const padding = { top: 48, right: 48, bottom: 48, left: 48 }
      const camera = mapInstance.cameraForBounds?.(bounds as LngLatBoundsLike, { padding })

      const targetCenter = camera?.center
        ? maplibregl.LngLat.convert(camera.center)
        : (() => {
            mapInstance.fitBounds(bounds, { padding, duration: 0 })
            return maplibregl.LngLat.convert(mapInstance.getCenter())
          })()

      const targetZoom = camera?.zoom ?? mapInstance.getZoom()
      const targetBearing = mode === 'mercator' ? data.INITIAL_VIEW_STATE.bearing : 0

      const rawPitch = Number.isFinite(data.INITIAL_VIEW_STATE.pitch)
        ? data.INITIAL_VIEW_STATE.pitch
        : 0
      const pitchBase = rawPitch > 0 ? rawPitch : 25
      const targetPitch = mode === 'mercator' ? Math.max(10, Math.min(pitchBase, 45)) : 0

      const duration = animate ? 900 : 0
      const easing = animate ? (t: number) => 1 - Math.pow(1 - t, 3) : undefined

      mapInstance.flyTo({
        center: targetCenter,
        zoom: targetZoom,
        bearing: targetBearing,
        pitch: targetPitch,
        duration,
        curve: 1.6,
        speed: 1.2,
        easing,
        essential: true,
      })

      setMapZoom(targetZoom)
      hasFitBoundsRef.current = true
    },
    [data, visibleFlights]
  )

  useEffect(() => {
    const mapInstance = mapRef.current?.getMap?.()
    return () => {
      if (mapInstance && deckOverlayRef.current) {
        deckOverlayRef.current.setProps({ layers: [] })
        mapInstance.removeControl(deckOverlayRef.current)
        mapInstance.dragRotate?.enable?.()
        mapInstance.touchZoomRotate?.enableRotation?.()
        mapInstance.touchZoomRotate?.enable?.()
        mapInstance.keyboard?.enable?.()
        mapInstance.doubleClickZoom?.enable?.()
        mapInstance.setMaxPitch(85)
      }
      deckOverlayRef.current?.finalize?.()
      deckOverlayRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isSegments) {
      setSelectedFlightId(null)
      setHoveredFlightId(null)
    }
  }, [isSegments])

  useEffect(() => {
    if (selectedFlightId && !visibleFlightIds.has(selectedFlightId)) {
      setSelectedFlightId(null)
    }
    if (hoveredFlightId && !visibleFlightIds.has(hoveredFlightId)) {
      setHoveredFlightId(null)
    }
  }, [selectedFlightId, hoveredFlightId, visibleFlightIds])

  const configureInteractions = useCallback((mode: ProjectionMode) => {
    const map = mapRef.current?.getMap?.()
    if (!map) return

    map.dragPan?.enable?.()
    map.scrollZoom?.enable?.()
    map.boxZoom?.enable?.()
    map.doubleClickZoom?.enable?.()

    map.dragRotate?.disable?.()
    map.touchZoomRotate?.enable?.()
    map.touchZoomRotate?.disableRotation?.()
    map.touchPitch?.disable?.()
    map.keyboard?.disable?.()

    if (mode === 'mercator') {
      map.dragRotate?.enable?.()
      map.touchZoomRotate?.enableRotation?.()
      map.touchPitch?.enable?.()
      map.keyboard?.enable?.()
    }
  }, [])

  const applyProjection = useCallback(
    (mode: ProjectionMode) => {
      const map = mapRef.current?.getMap?.()
      if (!map) return
      const mercatorBearing = data?.INITIAL_VIEW_STATE?.bearing ?? 0
      const mercatorPitch = data?.INITIAL_VIEW_STATE?.pitch ?? 0
      configureInteractions(mode)
      map.setProjection?.({ type: mode })
      const currentCenter = map.getCenter?.()
      const centerArray: [number, number] = currentCenter
        ? [currentCenter.lng, currentCenter.lat]
        : [0, 0]
      const currentZoom = map.getZoom?.() ?? 1
      if (mode === 'globe') {
        map.setMaxPitch(0)
      } else {
        map.setMaxPitch(85)
      }
      const targetBearing = mode === 'globe' ? 0 : mercatorBearing
      const targetPitch = mode === 'globe' ? 0 : mercatorPitch
      map.flyTo({
        center: centerArray,
        zoom: currentZoom,
        bearing: targetBearing,
        pitch: targetPitch,
        duration: 900,
        curve: 1.6,
        speed: 1.2,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        essential: true,
      })
      requestDeckRedraw('projection-change')
    },
    [configureInteractions, data, requestDeckRedraw]
  )

  useEffect(() => {
    if (!ready) return
    applyProjection(projectionMode)
  }, [ready, projectionMode, applyProjection])

  useEffect(() => {
    if (!ready || !data || hasFitBoundsRef.current) return
    focusAllFlights(projectionMode, { animate: false })
  }, [ready, data, projectionMode, focusAllFlights])

  const allowedOverlays = MODE_SUPPORT[projectionMode]
  const allowedOverlaySet = useMemo(() => new Set<OverlayId>(allowedOverlays), [allowedOverlays])
  const overlaySupportMap = useMemo(() => {
    const support = new Map<OverlayId, ProjectionMode[]>()
    ;(Object.entries(MODE_SUPPORT) as Array<[ProjectionMode, ReadonlyArray<OverlayId>]>).forEach(
      ([mode, overlays]) => {
        overlays.forEach((id) => {
          const typedId = id as OverlayId
          const existing = support.get(typedId)
          if (existing) {
            if (!existing.includes(mode)) existing.push(mode)
          } else {
            support.set(typedId, [mode])
          }
        })
      }
    )
    return support
  }, [])

  useEffect(() => {
    if (pendingOverlay && allowedOverlaySet.has(pendingOverlay)) {
      setPendingOverlay(null)
      if (pendingOverlay !== activeOverlay) {
        setActiveOverlay(pendingOverlay)
      }
      closeControlPanels()
      return
    }

    if (allowedOverlaySet.has(activeOverlay)) {
      lastOverlayByMode.current[projectionMode] = activeOverlay
      return
    }

    const preferred = lastOverlayByMode.current[projectionMode]
    const fallback =
      (preferred && allowedOverlaySet.has(preferred) && preferred) ||
      allowedOverlays[0] ||
      'flights'

    if (fallback !== activeOverlay) {
      setActiveOverlay(fallback)
    }
    if (pendingOverlay) {
      setPendingOverlay(null)
    }
  }, [
    projectionMode,
    activeOverlay,
    allowedOverlaySet,
    allowedOverlays,
    pendingOverlay,
    closeControlPanels,
  ])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current?.getMap?.()
    if (!map) return

    if (!deckOverlayRef.current) {
      const overlay = new MapboxOverlay({ interleaved: false })
      deckOverlayRef.current = overlay
      map.addControl(overlay)
      map.once('remove', () => overlay.finalize())
    }

    configureInteractions(projectionMode)
    requestDeckRedraw('projection-change')
  }, [ready, projectionMode, configureInteractions, requestDeckRedraw])

  const switchProjectionMode = useCallback(
    (next: ProjectionMode) => {
      setProjectionMode((prev) => {
        if (prev === next) return prev
        lastOverlayByMode.current[prev] = activeOverlay
        return next
      })
    },
    [activeOverlay]
  )

  const handleOverlaySelect = useCallback(
    (id: OverlayId) => {
      const activate = () => {
        setPendingOverlay(null)
        setActiveOverlay(id)
      }

      if (allowedOverlaySet.has(id)) {
        activate()
        return
      }
      const supports = overlaySupportMap.get(id) ?? []
      if (!supports.length) {
        activate()
        return
      }
      const desiredMode = supports.includes(projectionMode) ? projectionMode : supports[0]
      if (desiredMode === projectionMode) {
        activate()
        return
      }
      setPendingOverlay(id)
      switchProjectionMode(desiredMode)
    },
    [allowedOverlaySet, overlaySupportMap, projectionMode, switchProjectionMode]
  )

  useEffect(() => {
    if (activeOverlay === 'trails') {
      setTrailSpeedMultiplier(1)
      setTrailLengthSeconds(30)
    }
    if (activeOverlay === 'flights') {
      setFlightSpeedMultiplier(1)
    }
  }, [activeOverlay])

  useEffect(() => {
    if (!ready || !isSegments) return
    if (!selectedFlightId) return
    const mapInstance = mapRef.current?.getMap?.() as MapWithCamera | undefined
    if (!mapInstance) return

    const flight = visibleFlights.find((f) => f.id === selectedFlightId)
    if (!flight?.points?.length) return
    const bounds = new maplibregl.LngLatBounds()
    for (const p of flight.points) {
      const [lon, lat] = p.position
      if (Number.isFinite(lon) && Number.isFinite(lat)) bounds.extend([lon, lat])
    }
    if (bounds.isEmpty()) return
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    if (sw && ne && sw.lng === ne.lng && sw.lat === ne.lat) {
      const lngOffset = 0.05
      const latOffset = 0.05
      bounds.extend([sw.lng + lngOffset, sw.lat + latOffset])
      bounds.extend([sw.lng - lngOffset, sw.lat - latOffset])
    }

    const startPoint = flight.points[0]
    const endPoint = flight.points[flight.points.length - 1]
    const lonA = startPoint.position[0]
    const lonB = endPoint.position[0]
    const latA = startPoint.position[1]
    const latB = endPoint.position[1]
    const midLat = (latA + latB) / 2
    const deltaLon = (lonB - lonA) * Math.cos(toRad(midLat))
    const deltaLat = latB - latA

    let bearing = -toDeg(Math.atan2(deltaLat, deltaLon || 1e-6))
    if (!Number.isFinite(bearing)) {
      bearing = mapInstance.getBearing?.() ?? 0
    }
    if (bearing > 180) bearing -= 360
    if (bearing < -180) bearing += 360

    const padding = { top: 48, right: 120, bottom: 80, left: 120 }
    const camera = mapInstance.cameraForBounds?.(bounds as LngLatBoundsLike, {
      padding,
      maxZoom: 12,
      bearing,
    })

    const midLon = (startPoint.position[0] + endPoint.position[0]) / 2
    const center = camera?.center
      ? maplibregl.LngLat.convert(camera.center)
      : new maplibregl.LngLat(midLon, (latA + latB) / 2)

    mapInstance.easeTo({
      center,
      zoom: camera?.zoom ?? mapInstance.getZoom(),
      duration: 900,
      easing: (t) => t,
      bearing,
      pitch: projectionMode === 'mercator' ? SEGMENT_FOCUS_PITCH : 0,
    })
  }, [ready, visibleFlights, selectedFlightId, isSegments, projectionMode])

  const altitudeScale = useMemo(() => {
    let maxFromFlights = 0
    for (const flight of visibleFlights) {
      const stats = flight.altitudeStats
      const candidate = stats?.max ?? stats?.avg ?? stats?.min ?? null
      if (Number.isFinite(candidate as number)) {
        maxFromFlights = Math.max(maxFromFlights, candidate as number)
      }
    }
    if (maxFromFlights > 0) return maxFromFlights
    const fallback = data?.aggregatedStats?.maxAltitudeFt
    return Number.isFinite(fallback as number) ? Math.max(1, fallback as number) : 1
  }, [visibleFlights, data])

  const flightsBase = useMemo(() => {
    return visibleFlights
      .filter((f) => f.points.length >= 2)
      .map((f) => ({ id: f.id, name: f.name, points: f.points }))
  }, [visibleFlights])

  const flightsLayer = useAnimatedFlightsOverlay({
    flights: flightsBase,
    isActive: isFlights,
    speedMultiplier: flightSpeedMultiplier,
    projectionMode,
    zoom: mapZoom,
    planeScale: planeSizeScale,
    theme,
    isPaused: isMotionPaused,
  })

  const trips = useMemo<Trip[]>(() => {
    const out: Trip[] = []
    for (const f of visibleFlights) {
      if (f.points.length < 2) continue
      const path: [number, number, number][] = f.points.map((p) => [
        p.position[0],
        p.position[1],
        p.altitudeMeters ?? 0,
      ])
      const timestamps = f.points.map((_, idx) => idx)
      const duration = timestamps[timestamps.length - 1] || 0
      out.push({ id: f.id, path, timestamps, duration })
    }
    return out
  }, [visibleFlights])

  const trailLayers = useTrailsOverlay({
    trips,
    isActive: isTrails,
    speedMultiplier: trailSpeedMultiplier,
    trailLengthSeconds,
    widthScale: trailWidthScale,
    opacity: trailOpacity,
    isPaused: isMotionPaused,
    theme,
  })

  const analyticsPoints = useMemo(() => {
    const list: Array<{
      position: [number, number]
      altitudeFt: number
      speedKmh: number | null
      flightId: string
    }> = []
    for (const f of visibleFlights) {
      for (const p of f.points) {
        const speedKmh = Number.isFinite(p.speedKts as number)
          ? Math.round((p.speedKts as number) * 1.852)
          : null
        list.push({
          position: [p.position[0], p.position[1]],
          altitudeFt: p.altitudeFeet ?? 0,
          speedKmh,
          flightId: f.id,
        })
      }
    }
    return list
  }, [visibleFlights])

  const analyticsLayer = useAnalyticsLayer({
    points: analyticsPoints,
    isActive: isAnalytics,
    metric: analyticsMetric,
    radius: analyticsRadius,
    elevationScale: analyticsElevationScale,
    opacity: analyticsOpacity,
    isPaused: isMotionPaused,
  })

  // removed speed columns and climb bursts layers

  const routeArcs = useMemo<RouteArcDatum[]>(() => {
    const arcs: RouteArcDatum[] = []
    for (const flight of visibleFlights) {
      if (!flight.points.length) continue
      const startPoint = flight.points[0]
      const endPoint = flight.points[flight.points.length - 1]
      const source = resolveAirportPosition(flight.meta?.departureAirport, startPoint)
      const target = resolveAirportPosition(flight.meta?.arrivalAirport, endPoint)
      if (!source || !target) continue
      arcs.push({
        id: flight.id,
        name: flight.name,
        source,
        target,
        avgAltitudeFt: flight.altitudeStats?.avg ?? null,
        distanceKm: Number.isFinite(flight.distanceKm) ? (flight.distanceKm as number) : 0,
        originCode:
          flight.origin ??
          flight.meta?.departureAirport?.iata ??
          flight.meta?.departureAirport?.icao ??
          flight.meta?.departureAirport?.name ??
          null,
        destinationCode:
          flight.destination ??
          flight.meta?.arrivalAirport?.iata ??
          flight.meta?.arrivalAirport?.icao ??
          flight.meta?.arrivalAirport?.name ??
          null,
      })
    }
    return arcs
  }, [visibleFlights])

  const airportHubs = useMemo<AirportHubDatum[]>(() => {
    if (!visibleFlights.length) return []
    type HubAccumulator = AirportHubDatum & { altitudeSum: number; altitudeCount: number }
    const hubs = new Map<string, HubAccumulator>()
    const addAirport = (
      airport: AirportMeta | null | undefined,
      point: FlightPoint | undefined,
      context: { label: string | null; code: string | null; avgAltitudeFt: number | null }
    ) => {
      if (!point && !airport) return
      const position = resolveAirportPosition(airport, point ?? null)
      if (!position) return
      const key = resolveAirportKey(airport, position)
      if (!key) return
      const altitude = context.avgAltitudeFt
      const hasAltitude = Number.isFinite(altitude as number)
      const existing = hubs.get(key)
      if (existing) {
        existing.flights += 1
        if (hasAltitude) {
          existing.altitudeSum += altitude as number
          existing.altitudeCount += 1
        }
        return
      }
      hubs.set(key, {
        id: key,
        position,
        name: airport?.name ?? context.label,
        code: airport?.iata ?? airport?.icao ?? context.code,
        city: airport?.city ?? null,
        country: airport?.country ?? null,
        flights: 1,
        avgAltitudeFt: null,
        altitudeSum: hasAltitude ? ((altitude as number) ?? 0) : 0,
        altitudeCount: hasAltitude ? 1 : 0,
      })
    }
    visibleFlights.forEach((flight) => {
      if (!flight.points.length) return
      const avgAltitudeFt = flight.altitudeStats?.avg ?? null
      const departurePoint = flight.points[0]
      const arrivalPoint = flight.points[flight.points.length - 1]
      addAirport(flight.meta?.departureAirport, departurePoint, {
        label: flight.meta?.departureAirport?.name ?? flight.origin,
        code: flight.origin,
        avgAltitudeFt,
      })
      addAirport(flight.meta?.arrivalAirport, arrivalPoint, {
        label: flight.meta?.arrivalAirport?.name ?? flight.destination,
        code: flight.destination,
        avgAltitudeFt,
      })
    })
    return Array.from(hubs.values())
      .map(({ altitudeSum, altitudeCount, ...hub }) => ({
        ...hub,
        avgAltitudeFt: altitudeCount > 0 ? altitudeSum / altitudeCount : null,
      }))
      .sort((a, b) => b.flights - a.flights)
  }, [visibleFlights])

  const routesLayer = useRoutesLayer({
    routes: routeArcs,
    isActive: isRoutes,
    widthScale: routeWidthScale,
    height: routeHeight,
    opacity: routeOpacity,
    theme,
    animate: routeAnimate,
    isPaused: isMotionPaused,
  })

  const airportLayer = useAirportHubsLayer({
    hubs: airportHubs,
    isActive: isAirports,
    zoom: mapZoom,
    sizeScale: airportSizeScale,
    opacity: airportOpacity,
    theme,
  })

  const segmentsLayer = useSegmentsLayer({
    segments: filteredSegments,
    isActive: isSegments,
    selectedFlightId,
    hoveredFlightId,
    altitudeScale,
    widthScale: segmentWidthScale,
    theme,
  })

  const layers = useMemo(() => {
    const out: Layer[] = []
    if (segmentsLayer) out.push(segmentsLayer)
    if (flightsLayer) out.push(flightsLayer)
    if (trailLayers.length) out.push(...trailLayers)
    if (analyticsLayer) out.push(analyticsLayer)
    // speed columns / climb bursts removed
    if (routesLayer) {
      // routesLayer can be a single Layer or an array of Layers (animated)

      if (Array.isArray(routesLayer)) out.push(...routesLayer)
      else out.push(routesLayer)
    }
    if (airportLayer) out.push(airportLayer)
    return out
  }, [segmentsLayer, flightsLayer, trailLayers, analyticsLayer, routesLayer, airportLayer])

  // formatters moved to src/lib/format

  const getTooltip = useCallback(
    ({ object }: { object?: unknown | null }) => {
      if (!object) return null
      if (isSegments) {
        const seg = object as FlightSegment
        const startTime = seg.startTime ?? 'Unknown'
        const endTime = seg.endTime ?? 'Unknown'
        const altitudeText = Number.isFinite(seg.startAltitudeFeet)
          ? `Altitude: ${nf0.format(seg.startAltitudeFeet)} ft`
          : null
        const timeRange = startTime && endTime ? `${startTime} → ${endTime}` : startTime
        return [seg.name, altitudeText, timeRange].filter(Boolean).join('\n')
      }
      if (isFlights) {
        return (object as { name?: string }).name ?? null
      }
      if (isTrails) {
        return (object as Trip)?.id ?? null
      }
      if (isAnalytics) {
        const bin = object as AnalyticsPickingInfo & { points?: any[] }
        if (analyticsMetric === 'alt') {
          const samples = Array.isArray(bin.points) ? bin.points.length : undefined
          const lines = [`Avg altitude: ${nf0.format(Math.round(bin.elevationValue))} ft`]
          if (typeof samples === 'number') lines.push(`Samples: ${nf0.format(samples)}`)
          return lines.join('\n')
        }
        if (analyticsMetric === 'speed') {
          // Show exactly the aggregated value used for color/height
          const kmh = Math.max(0, Math.min(1200, Math.round(bin.colorValue)))
          return `Avg speed: ${nf0.format(kmh)} km/h`
        }
        // Count: compute unique flight IDs from bin.points to be robust
        let unique = 0
        if (Array.isArray((bin as any).points)) {
          const items = (bin as any).points.map((p: any) => (p && p.source ? p.source : p))
          const ids = new Set<string>()
          for (const it of items) {
            const id = it?.flightId
            if (typeof id === 'string' && id) ids.add(id)
          }
          unique = ids.size
        } else {
          // fallback to aggregated value
          unique = Math.max(0, Math.trunc(bin.colorValue))
        }
        return `Flights: ${unique}`
      }
      // speed columns removed
      if (isRoutes) {
        const arc = object as RouteArcDatum
        const routeLabel =
          arc.originCode && arc.destinationCode
            ? `${arc.originCode} → ${arc.destinationCode}`
            : arc.name
        const distanceText =
          Number.isFinite(arc.distanceKm) && arc.distanceKm > 0
            ? `Distance: ${nf0.format(Math.round(arc.distanceKm))} km`
            : null
        const altitudeText =
          Number.isFinite(arc.avgAltitudeFt as number) && arc.avgAltitudeFt
            ? `Avg altitude: ${nf0.format(Math.round(arc.avgAltitudeFt))} ft`
            : null
        return [routeLabel, arc.name, distanceText, altitudeText].filter(Boolean).join('\n')
      }
      if (isAirports) {
        const hub = object as AirportHubDatum
        const title = hub.code ?? hub.name ?? 'Airport'
        const location = hub.city
          ? hub.country
            ? `${hub.city}, ${hub.country}`
            : hub.city
          : (hub.country ?? null)
        const flightsText = `Flights: ${nf0.format(hub.flights)}`
        const altitudeText =
          Number.isFinite(hub.avgAltitudeFt as number) && hub.avgAltitudeFt
            ? `Avg cruise: ${nf0.format(Math.round(hub.avgAltitudeFt))} ft`
            : null
        return [title, location, flightsText, altitudeText].filter(Boolean).join('\n')
      }
      // climb bursts removed
      return null
    },
    [
      isSegments,
      nf0,
      isFlights,
      isTrails,
      isAnalytics,
      analyticsMetric,
      isSpeedColumns,
      isRoutes,
      isAirports,
      isClimbBursts,
    ]
  )

  const handleHover = useCallback(
    (info: PickingInfo<FlightSegment>) => {
      if (!isSegments) return
      setHoveredFlightId(info.object ? info.object.flightId : null)
    },
    [isSegments]
  )

  const handleClick = useCallback(
    (info: PickingInfo<FlightSegment>) => {
      if (!isSegments) return
      setSelectedFlightId(info.object ? info.object.flightId : null)
    },
    [isSegments]
  )

  useEffect(() => {
    if (!ready) return
    const overlay = deckOverlayRef.current
    if (!overlay) return
    overlay.setProps({
      layers,
      getTooltip,
      onHover: isSegments ? handleHover : undefined,
      onClick: isSegments ? handleClick : undefined,
    })
  }, [ready, layers, getTooltip, isSegments, handleHover, handleClick])

  const selectedFlight = isSegments ? findSelectedFlight(visibleFlights, selectedFlightId) : null
  const chartData = selectedFlight
    ? selectedFlight.points.map((p, index) => ({
        distanceKm: Number.isFinite(p.distanceKm as number) ? (p.distanceKm as number) : index,
        altitudeFt: Number.isFinite(p.altitudeFeet as number) ? (p.altitudeFeet as number) : null,
        speedKts: Number.isFinite(p.speedKts as number) ? (p.speedKts as number) : null,
      }))
    : null

  const handleMapLoad = useCallback(() => {
    // Mark map ready; projection is applied by effect on first ready=true
    setReady(true)
  }, [])

  const handleMapMove = useCallback((viewState: { zoom?: number }) => {
    if (typeof viewState.zoom === 'number') {
      setMapZoom(viewState.zoom)
    }
  }, [])

  const toggleProjection = useCallback(() => {
    switchProjectionMode(projectionMode === 'mercator' ? 'globe' : 'mercator')
  }, [projectionMode, switchProjectionMode])

  const toggleAnalyticsMetric = useCallback(() => {
    setAnalyticsMetric((m) => (m === 'alt' ? 'speed' : m === 'speed' ? 'count' : 'alt'))
  }, [])

  const resetView = useCallback(() => {
    focusAllFlights(projectionMode, { animate: true })
  }, [focusAllFlights, projectionMode])

  const focusOnLocation = useCallback(
    (
      position: [number, number],
      options?: { zoom?: number; bounds?: [number, number, number, number] }
    ) => {
      const mapInstance = mapRef.current?.getMap?.()
      if (!mapInstance) return
      const [lon, lat] = position
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return

      const currentZoom = mapInstance.getZoom()
      const fallbackZoom = options?.zoom ?? (projectionMode === 'globe' ? 4 : 8.5)
      let targetZoom = Math.max(currentZoom, fallbackZoom)
      let targetCenter: [number, number] = [lon, lat]

      if (options?.bounds && Array.isArray(options.bounds)) {
        const [minLon, minLat, maxLon, maxLat] = options.bounds
        if (
          [minLon, minLat, maxLon, maxLat].every(
            (value) => typeof value === 'number' && Number.isFinite(value)
          )
        ) {
          const padding = { top: 80, right: 80, bottom: 80, left: 80 }
          const camera = (mapInstance as MapWithCamera).cameraForBounds?.(
            [
              [minLon, minLat],
              [maxLon, maxLat],
            ],
            { padding }
          )
          if (camera?.center && typeof camera.zoom === 'number' && Number.isFinite(camera.zoom)) {
            const lngLat = maplibregl.LngLat.convert(camera.center)
            targetCenter = [lngLat.lng, lngLat.lat]
            targetZoom = camera.zoom
          }
        }
      }

      const targetPitch = projectionMode === 'mercator' ? Math.max(mapInstance.getPitch(), 35) : 0
      const targetBearing = projectionMode === 'mercator' ? mapInstance.getBearing() : 0

      mapInstance.flyTo({
        center: targetCenter,
        zoom: targetZoom,
        pitch: targetPitch,
        bearing: targetBearing,
        curve: 1.6,
        speed: 1.2,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        essential: true,
      })

      setMapZoom(targetZoom)
    },
    [projectionMode]
  )

  const settingsOpen = activeControlPanel === 'settings'
  const layersOpen = activeControlPanel === 'layers'

  const toggleSettingsPanel = useCallback(() => {
    setActiveControlPanel((prev) => (prev === 'settings' ? null : 'settings'))
  }, [])

  const toggleLayersPanel = useCallback(() => {
    setActiveControlPanel((prev) => (prev === 'layers' ? null : 'layers'))
  }, [])

  return {
    data,
    ready,
    mapRef,
    projectionMode,
    activeOverlay,
    isFlights,
    isTrails,
    isSegments,
    isAnalytics,
    isRoutes,
    isAirports,
    isSpeedColumns,
    isClimbBursts,
    isMotionPaused,
    settingsOpen,
    layersOpen,
    toggleSettingsPanel,
    toggleLayersPanel,
    handleOverlaySelect,
    handleMapLoad,
    handleMapMove,
    toggleProjection,
    toggleAnalyticsMetric,
    setAnalyticsMetric,
    analyticsMetric,
    flightSpeedMultiplier,
    setFlightSpeedMultiplier,
    planeSizeScale,
    setPlaneSizeScale,
    trailSpeedMultiplier,
    setTrailSpeedMultiplier,
    trailLengthSeconds,
    setTrailLengthSeconds,
    trailWidthScale,
    setTrailWidthScale,
    trailOpacity,
    setTrailOpacity,
    segmentWidthScale,
    setSegmentWidthScale,
    routeWidthScale,
    setRouteWidthScale,
    routeHeight,
    setRouteHeight,
    routeOpacity,
    setRouteOpacity,
    routeAnimate,
    setRouteAnimate,
    airportSizeScale,
    setAirportSizeScale,
    airportOpacity,
    setAirportOpacity,
    analyticsRadius,
    setAnalyticsRadius,
    analyticsElevationScale,
    setAnalyticsElevationScale,
    analyticsOpacity,
    setAnalyticsOpacity,
    // removed speed columns / climb bursts settings from public API
    selectedFlight,
    chartData,
    clearSelectedFlight: () => setSelectedFlightId(null),
    formatKm,
    formatFt,
    formatDuration,
    resetView,
    focusOnLocation,
    closeControlPanels,
    toggleMotionPaused,
    mapFilters,
    updateMapFilter,
    applyMapFilters,
    resetMapFilters,
    airportSuggestions,
    countrySuggestions,
    hasActiveFilters,
  }
}

export type UseMapPageStateReturn = ReturnType<typeof useMapPageState>
export const MAP_PADDING = ZERO_PADDING
