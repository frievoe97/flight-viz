import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Deck, Layer, PickingInfo } from '@deck.gl/core'
import * as maplibregl from 'maplibre-gl'
import type { Map as MaplibreMap, LngLatBoundsLike, PaddingOptions } from 'maplibre-gl'
import { getFlightData, type Flight, type FlightSegment } from '@/data'
import { useSegmentsLayer, findSelectedFlight } from '../overlays/segments'
import { useAnimatedFlightsOverlay } from '../overlays/animatedFlights'
import { useTrailsOverlay, type Trip } from '../overlays/trails'
import { useAnalyticsLayer, type AnalyticsPickingInfo } from '../overlays/analytics'
import type { OverlayId } from '../overlays/options'

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

const MODE_SUPPORT: Record<'globe' | 'mercator', ReadonlyArray<OverlayId>> = {
  globe: ['flights', 'trails'],
  mercator: ['segments', 'analytics', 'flights', 'trails'],
} as const

type ProjectionMode = keyof typeof MODE_SUPPORT
type DeckWithOptionalRedraw = Deck & { setNeedsRedraw?: (reason: string) => void }

export function useMapPageState() {
  const [activeOverlay, setActiveOverlay] = useState<OverlayId>('trails')
  const [analyticsMetric, setAnalyticsMetric] = useState<'alt' | 'count'>('alt')
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof getFlightData>> | null>(null)
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  const [hoveredFlightId, setHoveredFlightId] = useState<string | null>(null)
  const [flightSpeedMultiplier, setFlightSpeedMultiplier] = useState(20)
  const [trailSpeedMultiplier, setTrailSpeedMultiplier] = useState(2)
  const [trailLengthSeconds, setTrailLengthSeconds] = useState(30)
  const [segmentWidthScale, setSegmentWidthScale] = useState(1)
  const [analyticsRadius, setAnalyticsRadius] = useState(20000)
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('globe')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingOverlay, setPendingOverlay] = useState<OverlayId | null>(null)
  const [mapZoom, setMapZoom] = useState(0)

  const mapRef = useRef<MapRef | null>(null)
  const deckOverlayRef = useRef<MapboxOverlay | null>(null)
  const lastOverlayByMode = useRef<Partial<Record<ProjectionMode, OverlayId>>>({
    mercator: 'segments',
    globe: 'trails',
  })
  const hasFitBoundsRef = useRef(false)

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

      const bounds = new maplibregl.LngLatBounds()
      for (const flight of data.flights) {
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

      const duration = animate ? 800 : 0
      const easing = animate ? (t: number) => 1 - Math.pow(1 - t, 3) : undefined

      mapInstance.easeTo({
        center: targetCenter,
        zoom: targetZoom,
        bearing: targetBearing,
        pitch: targetPitch,
        duration,
        easing,
        padding: ZERO_PADDING,
      })

      setMapZoom(targetZoom)
      hasFitBoundsRef.current = true
    },
    [data]
  )

  useEffect(() => {
    return () => {
      const map = mapRef.current?.getMap?.()
      if (map && deckOverlayRef.current) {
        deckOverlayRef.current.setProps({ layers: [] })
        map.removeControl(deckOverlayRef.current)
        map.dragRotate?.enable?.()
        map.touchZoomRotate?.enableRotation?.()
        map.touchZoomRotate?.enable?.()
        map.keyboard?.enable?.()
        map.doubleClickZoom?.enable?.()
        map.setMaxPitch(85)
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
      if (mode === 'globe') {
        map.setBearing(0)
        map.setPitch(0)
        map.setMaxPitch(0)
      } else {
        map.setBearing(mercatorBearing)
        map.setPitch(mercatorPitch)
        map.setMaxPitch(85)
      }
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
      setSettingsOpen(false)
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
  }, [projectionMode, activeOverlay, allowedOverlaySet, allowedOverlays, pendingOverlay])

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
      if (allowedOverlaySet.has(id)) {
        setPendingOverlay(null)
        setActiveOverlay(id)
        setSettingsOpen(false)
        return
      }
      const supports = overlaySupportMap.get(id) ?? []
      if (!supports.length) {
        setPendingOverlay(null)
        setActiveOverlay(id)
        setSettingsOpen(false)
        return
      }
      const desiredMode = supports.includes(projectionMode) ? projectionMode : supports[0]
      if (desiredMode === projectionMode) {
        setPendingOverlay(null)
        setActiveOverlay(id)
        setSettingsOpen(false)
        return
      }
      setPendingOverlay(id)
      switchProjectionMode(desiredMode)
    },
    [allowedOverlaySet, overlaySupportMap, projectionMode, switchProjectionMode]
  )

  useEffect(() => {
    if (activeOverlay === 'trails') {
      setTrailSpeedMultiplier(2)
      setTrailLengthSeconds(30)
    }
    if (activeOverlay === 'flights') {
      setFlightSpeedMultiplier(20)
    }
  }, [activeOverlay])

  useEffect(() => {
    if (!ready || !data || !isSegments) return
    const mapInstance = mapRef.current?.getMap?.() as MapWithCamera | undefined
    if (!mapInstance) return
    if (!selectedFlightId) return

    const flight = data.flights.find((f) => f.id === selectedFlightId)
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
  }, [ready, data, selectedFlightId, isSegments, projectionMode])

  const altitudeScale = useMemo(() => {
    if (!data) return 1
    return Math.max(1, data.aggregatedStats.maxAltitudeFt)
  }, [data])

  const flightsBase = useMemo(() => {
    if (!data) return [] as Array<Pick<Flight, 'id' | 'name' | 'points'>>
    return data.flights
      .filter((f) => f.points.length >= 2)
      .map((f) => ({ id: f.id, name: f.name, points: f.points }))
  }, [data])

  const flightsLayer = useAnimatedFlightsOverlay({
    flights: flightsBase,
    isActive: isFlights,
    speedMultiplier: flightSpeedMultiplier,
    projectionMode,
    zoom: mapZoom,
  })

  const trips = useMemo<Trip[]>(() => {
    if (!data) return []
    const out: Trip[] = []
    for (const f of data.flights) {
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
  }, [data])

  const trailLayers = useTrailsOverlay({
    trips,
    isActive: isTrails,
    speedMultiplier: trailSpeedMultiplier,
    trailLengthSeconds,
  })

  const analyticsPoints = useMemo(() => {
    if (!data) return [] as Array<{ position: [number, number]; altitude: number }>
    const list: Array<{ position: [number, number]; altitude: number }> = []
    for (const f of data.flights) {
      for (const p of f.points) {
        list.push({ position: [p.position[0], p.position[1]], altitude: p.altitudeFeet ?? 0 })
      }
    }
    return list
  }, [data])

  const analyticsLayer = useAnalyticsLayer({
    points: analyticsPoints,
    isActive: isAnalytics,
    metric: analyticsMetric,
    radius: analyticsRadius,
  })

  const segmentsLayer = useSegmentsLayer({
    segments: data?.flightSegments ?? [],
    isActive: isSegments,
    selectedFlightId,
    hoveredFlightId,
    altitudeScale,
    widthScale: segmentWidthScale,
  })

  const layers = useMemo(() => {
    const out: Layer[] = []
    if (segmentsLayer) out.push(segmentsLayer)
    if (flightsLayer) out.push(flightsLayer)
    if (trailLayers.length) out.push(...trailLayers)
    if (analyticsLayer) out.push(analyticsLayer)
    return out
  }, [segmentsLayer, flightsLayer, trailLayers, analyticsLayer])

  const nf0 = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }), [])
  const nf1 = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }), [])

  const formatKm = useCallback(
    (v?: number | null, precise = false) =>
      Number.isFinite(v as number) ? `${(precise ? nf1 : nf0).format(v as number)} km` : '–',
    [nf0, nf1]
  )
  const formatFt = useCallback(
    (v?: number | null) => (Number.isFinite(v as number) ? `${nf0.format(v as number)} ft` : '–'),
    [nf0]
  )
  const formatDuration = useCallback((seconds?: number | null) => {
    if (!Number.isFinite(seconds as number)) return '–'
    const total = Math.floor((seconds as number) / 60)
    const h = Math.floor(total / 60)
    const m = total % 60
    return h > 0 ? `${h} h ${m} min` : `${m} min`
  }, [])

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
        const bin = object as AnalyticsPickingInfo
        return analyticsMetric === 'alt'
          ? `Avg altitude: ${nf0.format(Math.round(bin.elevationValue))} ft\nSamples: ${bin.colorValue}`
          : `Count: ${bin.colorValue}`
      }
      return null
    },
    [isSegments, nf0, isFlights, isTrails, isAnalytics, analyticsMetric]
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

  const selectedFlight = isSegments ? findSelectedFlight(data?.flights, selectedFlightId) : null
  const chartData = selectedFlight
    ? selectedFlight.points.map((p, index) => ({
        distanceKm: Number.isFinite(p.distanceKm as number) ? (p.distanceKm as number) : index,
        altitudeFt: Number.isFinite(p.altitudeFeet as number) ? (p.altitudeFeet as number) : null,
        speedKts: Number.isFinite(p.speedKts as number) ? (p.speedKts as number) : null,
      }))
    : null

  const handleMapLoad = useCallback(() => {
    setReady(true)
    applyProjection(projectionMode)
  }, [applyProjection, projectionMode])

  const handleMapMove = useCallback((viewState: { zoom?: number }) => {
    if (typeof viewState.zoom === 'number') {
      setMapZoom(viewState.zoom)
    }
  }, [])

  const toggleProjection = useCallback(() => {
    switchProjectionMode(projectionMode === 'mercator' ? 'globe' : 'mercator')
  }, [projectionMode, switchProjectionMode])

  const toggleAnalyticsMetric = useCallback(() => {
    setAnalyticsMetric((m) => (m === 'alt' ? 'count' : 'alt'))
  }, [])

  const resetView = useCallback(() => {
    focusAllFlights(projectionMode, { animate: true })
  }, [focusAllFlights, projectionMode])

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
    settingsOpen,
    setSettingsOpen,
    handleOverlaySelect,
    handleMapLoad,
    handleMapMove,
    toggleProjection,
    toggleAnalyticsMetric,
    analyticsMetric,
    flightSpeedMultiplier,
    setFlightSpeedMultiplier,
    trailSpeedMultiplier,
    setTrailSpeedMultiplier,
    trailLengthSeconds,
    setTrailLengthSeconds,
    segmentWidthScale,
    setSegmentWidthScale,
    analyticsRadius,
    setAnalyticsRadius,
    selectedFlight,
    chartData,
    clearSelectedFlight: () => setSelectedFlightId(null),
    formatKm,
    formatFt,
    formatDuration,
    resetView,
  }
}

export type UseMapPageStateReturn = ReturnType<typeof useMapPageState>
export const MAP_PADDING = ZERO_PADDING
