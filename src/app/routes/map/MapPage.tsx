import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import type { Map as MaplibreMap, LngLatBoundsLike, PaddingOptions } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Deck, Layer, PickingInfo } from '@deck.gl/core'
import { Globe2, Map as MapIcon, PieChart, SlidersHorizontal } from 'lucide-react'
import { getFlightData, type Flight, type FlightSegment } from '@/data'
import { MAP_STYLE } from '@/lib/map/deckConfig'
import FlightChart from './FlightChart'
import { overlayOptions, type OverlayId } from './overlays/options'
import { useSegmentsLayer, findSelectedFlight } from './overlays/segments'
import { useAnimatedFlightsOverlay } from './overlays/animatedFlights'
import { useTrailsOverlay, type Trip } from './overlays/trails'
import { useAnalyticsLayer, type AnalyticsPickingInfo } from './overlays/analytics'
import OverlayPicker from './components/OverlayPicker'

import { useNavigate } from 'react-router-dom'

type MapWithCamera = MaplibreMap & {
  cameraForBounds?: (
    bounds: LngLatBoundsLike,
    options?: { padding?: number | PaddingOptions; maxZoom?: number }
  ) => { center?: maplibregl.LngLatLike; zoom: number }
}

const ZERO_PADDING: PaddingOptions = { top: 0, right: 0, bottom: 0, left: 0 }
const SEGMENT_FOCUS_PITCH = 32

const MODE_SUPPORT: Record<'globe' | 'mercator', ReadonlyArray<OverlayId>> = {
  globe: ['flights', 'trails'],
  mercator: ['segments', 'analytics', 'flights', 'trails'],
} as const

type ProjectionMode = keyof typeof MODE_SUPPORT
type DeckWithOptionalRedraw = Deck & { setNeedsRedraw?: (reason: string) => void }

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[0.75rem]">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  )
}

export default function MapPage() {
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

  const navigate = useNavigate()

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

  useEffect(() => {
    hasFitBoundsRef.current = false
  }, [data])

  const zoomToDataBounds = useCallback(() => {
    if (!data) return
    const map = mapRef.current?.getMap?.()
    if (!map) return
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
    hasFitBoundsRef.current = true
    map.fitBounds(bounds, {
      padding: { top: 48, right: 48, bottom: 48, left: 48 },
      duration: 0,
    })
  }, [data])

  const isSegments = activeOverlay === 'segments'
  const isFlights = activeOverlay === 'flights'
  const isTrails = activeOverlay === 'trails'
  const isAnalytics = activeOverlay === 'analytics'

  useEffect(() => {
    getFlightData().then((d) => {
      setData(d)
    })
  }, [])

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

    map.dragPan?.enable?.()
    map.scrollZoom?.enable?.()
    map.boxZoom?.enable?.()
    map.doubleClickZoom?.enable?.()
    map.touchZoomRotate?.enable?.()
    map.dragRotate?.enable?.()
    map.touchZoomRotate?.enableRotation?.()
    map.keyboard?.enable?.()

    requestDeckRedraw('projection-change')
  }, [ready, requestDeckRedraw])

  const applyProjection = useCallback(
    (mode: 'globe' | 'mercator') => {
      const map = mapRef.current?.getMap?.()
      if (!map) return
      const mercatorBearing = data?.INITIAL_VIEW_STATE?.bearing ?? 0
      const mercatorPitch = data?.INITIAL_VIEW_STATE?.pitch ?? 0
      map.setProjection?.({ type: mode })
      if (mode === 'globe') {
        map.setBearing(0)
        map.setPitch(0)
        map.setMaxPitch(0)
        map.dragPan?.enable?.()
        map.scrollZoom?.enable?.()
        map.boxZoom?.enable?.()
        map.doubleClickZoom?.enable?.()
        map.touchZoomRotate?.enable?.()
        map.touchZoomRotate?.disableRotation?.()
        map.dragRotate?.disable?.()
        map.keyboard?.disable?.()
      } else {
        map.setBearing(mercatorBearing)
        map.setPitch(mercatorPitch)
        map.setMaxPitch(85)
        map.dragPan?.enable?.()
        map.scrollZoom?.enable?.()
        map.boxZoom?.enable?.()
        map.doubleClickZoom?.enable?.()
        map.touchZoomRotate?.enable?.()
        map.dragRotate?.enable?.()
        map.touchZoomRotate?.enableRotation?.()
        map.keyboard?.enable?.()
      }
      requestDeckRedraw('projection-change')
    },
    [data, requestDeckRedraw]
  )

  useEffect(() => {
    if (!ready) return
    applyProjection(projectionMode)
  }, [ready, projectionMode, applyProjection])

  useEffect(() => {
    if (!ready || !data || hasFitBoundsRef.current) return
    zoomToDataBounds()
  }, [ready, data, zoomToDataBounds])

  const allowedOverlays = MODE_SUPPORT[projectionMode]
  const allowedOverlaySet = useMemo(() => new Set<OverlayId>(allowedOverlays), [allowedOverlays])

  useEffect(() => {
    if (!allowedOverlaySet.has(activeOverlay)) {
      const preferred = lastOverlayByMode.current[projectionMode]
      let fallback: OverlayId
      if (preferred && allowedOverlaySet.has(preferred)) {
        fallback = preferred
      } else {
        fallback = allowedOverlays[0] ?? 'flights'
      }
      setActiveOverlay(fallback)
    } else {
      lastOverlayByMode.current[projectionMode] = activeOverlay
    }
  }, [projectionMode, activeOverlay, allowedOverlaySet, allowedOverlays])

  const handleOverlaySelect = useCallback(
    (id: OverlayId) => {
      if (!allowedOverlaySet.has(id)) return
      setActiveOverlay(id)
    },
    [allowedOverlaySet]
  )

  const toggleProjection = useCallback(() => {
    setProjectionMode((prev) => {
      lastOverlayByMode.current[prev] = activeOverlay
      return prev === 'mercator' ? 'globe' : 'mercator'
    })
  }, [activeOverlay])

  useEffect(() => {
    if (activeOverlay === 'trails') {
      setTrailSpeedMultiplier(2)
      setTrailLengthSeconds(30)
    }
    if (activeOverlay === 'flights') {
      setFlightSpeedMultiplier(20)
    }
  }, [activeOverlay])

  const disabledOverlays = useMemo<OverlayId[]>(
    () => overlayOptions.map((option) => option.id).filter((id) => !allowedOverlaySet.has(id)),
    [allowedOverlaySet]
  )

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
    const deltaLon = endPoint.position[0] - startPoint.position[0]
    const deltaLat = endPoint.position[1] - startPoint.position[1]

    let bearing = mapInstance.getBearing?.() ?? 0
    if (projectionMode === 'mercator') {
      let raw = (Math.atan2(deltaLat, deltaLon) * 180) / Math.PI
      if (raw > 90) raw -= 180
      if (raw < -90) raw += 180
      bearing = raw
    }

    const padding = { top: 48, right: 120, bottom: 80, left: 120 }
    const camera = mapInstance.cameraForBounds?.(bounds as LngLatBoundsLike, {
      padding,
      maxZoom: 12,
    })

    const midLon = (startPoint.position[0] + endPoint.position[0]) / 2
    const midLat = (startPoint.position[1] + endPoint.position[1]) / 2
    const center = camera?.center
      ? maplibregl.LngLat.convert(camera.center)
      : new maplibregl.LngLat(midLon, midLat)

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
    projectionMode: projectionMode,
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

  if (!data) return <div className="h-full w-full" />

  const controlCardClass =
    'w-full rounded-md border bg-[var(--panel-bg)]/85 px-3 py-2 text-xs text-white space-y-2 shadow backdrop-blur-sm'

  const selectedFlight = isSegments ? findSelectedFlight(data?.flights, selectedFlightId) : null
  const chartData = selectedFlight
    ? selectedFlight.points.map((p, index) => ({
        distanceKm: Number.isFinite(p.distanceKm as number) ? (p.distanceKm as number) : index,
        altitudeFt: p.altitudeFeet,
        speedKts: p.speedKts,
      }))
    : null

  const gridTemplateRows =
    selectedFlight && chartData && isSegments ? '1fr minmax(12rem, 16rem)' : '1fr'

  return (
    <div className="h-full w-full grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows }}>
      <div className="relative" style={{ backgroundColor: 'var(--map-land)' }}>
        <MapGL
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          projection={projectionMode}
          maxPitch={projectionMode === 'globe' ? 0 : 85}
          initialViewState={{
            latitude: data.INITIAL_VIEW_STATE.latitude,
            longitude: data.INITIAL_VIEW_STATE.longitude,
            zoom: data.INITIAL_VIEW_STATE.zoom ?? 1,
            bearing: data.INITIAL_VIEW_STATE.bearing,
            pitch: data.INITIAL_VIEW_STATE.pitch,
            padding: ZERO_PADDING,
          }}
          onLoad={() => {
            setReady(true)
            applyProjection(projectionMode)
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl
            key={projectionMode}
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '1px solid var(--panel-border)',
              boxShadow: '0 6px 18px rgba(15, 23, 42, 0.45)',
            }}
            showCompass={projectionMode !== 'globe'}
            showZoom
            visualizePitch={projectionMode !== 'globe'}
          />
        </MapGL>

        <div className="absolute top-3 left-3 z-10">
          <button
            type="button"
            className="controls-btn rounded-full p-2 text-white shadow"
            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
            onClick={toggleProjection}
            aria-label={
              projectionMode === 'mercator'
                ? 'Zur Globus-Projektion wechseln'
                : 'Zur Mercator-Projektion wechseln'
            }
            title={
              projectionMode === 'mercator'
                ? 'Switch to Globe projection'
                : 'Switch to Mercator projection'
            }
          >
            {projectionMode === 'mercator' ? (
              <Globe2 className="h-5 w-5" aria-hidden />
            ) : (
              <MapIcon className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>

        <div className="absolute bottom-3 left-3 z-10">
          <button
            type="button"
            onClick={() => navigate('/stats')}
            className="controls-btn rounded-full p-2 text-white shadow"
            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
            aria-label="Statistiken öffnen"
            title="Statistiken"
          >
            <PieChart className="h-5 w-5 scale-110" aria-hidden />
          </button>
        </div>

        <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2">
          {settingsOpen ? (
            <div
              className="w-64 space-y-3 rounded-lg border bg-[#0f172a]/92 p-3 text-sm text-white shadow-lg backdrop-blur-md"
              style={{ borderColor: 'var(--panel-border)' }}
            >
              <OverlayPicker
                active={activeOverlay}
                onSelect={handleOverlaySelect}
                disabledOptions={disabledOverlays}
              />

              {isFlights ? (
                <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                      Flight speed
                    </span>
                    <span>{flightSpeedMultiplier.toFixed(0)}x</span>
                  </div>
                  <input
                    className="w-full accent-[var(--flight-speed)]"
                    type="range"
                    min={10}
                    max={30}
                    step={1}
                    value={flightSpeedMultiplier}
                    onChange={(event) => setFlightSpeedMultiplier(Number(event.target.value))}
                  />
                </div>
              ) : null}

              {isTrails ? (
                <>
                  <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                        Trail speed
                      </span>
                      <span>{trailSpeedMultiplier.toFixed(1)}x</span>
                    </div>
                    <input
                      className="w-full accent-[var(--flight-speed)]"
                      type="range"
                      min={0.2}
                      max={4}
                      step={0.1}
                      value={trailSpeedMultiplier}
                      onChange={(event) => setTrailSpeedMultiplier(Number(event.target.value))}
                    />
                  </div>
                  <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                        Trail length
                      </span>
                      <span>{Math.round(trailLengthSeconds)}s</span>
                    </div>
                    <input
                      className="w-full accent-[var(--flight-altitude)]"
                      type="range"
                      min={5}
                      max={120}
                      step={5}
                      value={trailLengthSeconds}
                      onChange={(event) => setTrailLengthSeconds(Number(event.target.value))}
                    />
                  </div>
                </>
              ) : null}

              {isSegments ? (
                <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                      Path width
                    </span>
                    <span>{segmentWidthScale.toFixed(1)}x</span>
                  </div>
                  <input
                    className="w-full accent-[var(--flight-speed)]"
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={segmentWidthScale}
                    onChange={(event) => setSegmentWidthScale(Number(event.target.value))}
                  />
                </div>
              ) : null}

              {isAnalytics ? (
                <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                      Hex radius
                    </span>
                    <span>{Math.round(analyticsRadius / 1000)} km</span>
                  </div>
                  <input
                    className="w-full accent-[var(--flight-speed)]"
                    type="range"
                    min={5000}
                    max={50000}
                    step={1000}
                    value={analyticsRadius}
                    onChange={(event) => setAnalyticsRadius(Number(event.target.value))}
                  />
                  <button
                    type="button"
                    className="controls-btn rounded-md text-xs px-3 py-1 w-full"
                    onClick={() => setAnalyticsMetric((m) => (m === 'alt' ? 'count' : 'alt'))}
                  >
                    Metric: {analyticsMetric === 'alt' ? 'Avg altitude' : 'Count'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="controls-btn rounded-full p-2 text-white shadow"
            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
            onClick={() => setSettingsOpen((prev) => !prev)}
            aria-expanded={settingsOpen}
            aria-label={settingsOpen ? 'Kartenoptionen schließen' : 'Kartenoptionen öffnen'}
            title="Kartenoptionen"
          >
            <SlidersHorizontal className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {isSegments && selectedFlight && chartData ? (
        <div
          className="border-t p-4"
          style={{
            backgroundColor: 'var(--map-land)',
            color: '#ffffff',
            borderColor: 'var(--panel-border)',
          }}
        >
          <div className="grid h-full gap-4" style={{ gridTemplateColumns: '18rem 1fr' }}>
            <div
              className="space-y-3 rounded-md border px-3 py-3 text-xs"
              style={{ borderColor: 'var(--panel-border)', backgroundColor: 'var(--panel-bg)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[0.7rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Selected flight
                  </div>
                  <div className="text-sm font-semibold text-white">{selectedFlight.name}</div>
                </div>
                <button
                  type="button"
                  className="controls-btn rounded-md px-2 py-1 text-[0.65rem]"
                  onClick={() => setSelectedFlightId(null)}
                >
                  Clear
                </button>
              </div>

              <div className="space-y-2">
                <InfoRow label="Distance" value={formatKm(selectedFlight.distanceKm, true)} />
                <InfoRow label="Duration" value={formatDuration(selectedFlight.durationSeconds)} />
                <InfoRow label="Avg altitude" value={formatFt(selectedFlight.altitudeStats?.avg)} />
                <InfoRow
                  label="Altitude range"
                  value={`${formatFt(selectedFlight.altitudeStats?.min)} – ${formatFt(selectedFlight.altitudeStats?.max)}`}
                />
              </div>
            </div>

            <div className="rounded-md border" style={{ borderColor: 'var(--panel-border)' }}>
              <FlightChart data={chartData} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
