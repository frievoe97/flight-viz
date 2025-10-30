import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import MapGL, { type MapRef } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import type { Map as MaplibreMap, LngLatBoundsLike, PaddingOptions } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  FlyToInterpolator,
  type TransitionInterpolator,
  type Layer,
  type PickingInfo,
  type MapViewState,
} from '@deck.gl/core'
import { PlusIcon, MinusIcon, ResetIcon } from '@radix-ui/react-icons'
import { getFlightData, type Flight, type FlightSegment } from '@/data'
import { MAP_STYLE } from '@/lib/map/deckConfig'
import FlightChart from './FlightChart'
import { viewSync, type ViewStateLite } from '@/lib/map/viewSync'
import type { OverlayId } from './overlays/options'
import { useAnimatedFlightsOverlay } from './overlays/animatedFlights'
import { useTrailsOverlay, type Trip } from './overlays/trails'
import { useSegmentsLayer, findSelectedFlight } from './overlays/segments'
import { useAnalyticsLayer, type AnalyticsPickingInfo } from './overlays/analytics'
import OverlayPicker from './components/OverlayPicker'

type VS = MapViewState & {
  transitionDuration?: number
  transitionInterpolator?: TransitionInterpolator | null
}

type MapWithCamera = MaplibreMap & {
  cameraForBounds?: (
    bounds: LngLatBoundsLike,
    options?: { padding?: number | PaddingOptions; maxZoom?: number }
  ) => { center?: maplibregl.LngLatLike; zoom: number }
}

type DeckViewState = {
  longitude: number
  latitude: number
  zoom: number
  bearing: number
  pitch: number
}

const normalizeViewState = (
  vs: MapViewState & {
    transitionDuration?: number
    transitionInterpolator?: TransitionInterpolator | null
  }
): VS => ({
  longitude: vs.longitude,
  latitude: vs.latitude,
  zoom: vs.zoom,
  bearing: vs.bearing ?? 0,
  pitch: vs.pitch ?? 0,
  transitionDuration: vs.transitionDuration,
  transitionInterpolator: vs.transitionInterpolator ?? undefined,
})

const toLite = (vs: VS): ViewStateLite => ({
  longitude: vs.longitude,
  latitude: vs.latitude,
  zoom: vs.zoom,
  bearing: vs.bearing ?? 0,
  pitch: vs.pitch ?? 0,
})

export default function MapPage() {
  const [activeOverlay, setActiveOverlay] = useState<OverlayId>('segments')
  const [analyticsMetric, setAnalyticsMetric] = useState<'alt' | 'count'>('alt')
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof getFlightData>> | null>(null)
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  const [hoveredFlightId, setHoveredFlightId] = useState<string | null>(null)
  const [viewState, setViewState] = useState<VS | null>(null)

  const mapRef = useRef<MapRef | null>(null)
  const viewRef = useRef<VS | null>(null)
  useEffect(() => {
    viewRef.current = viewState
  }, [viewState])

  const isSegments = activeOverlay === 'segments'
  const isFlights = activeOverlay === 'flights'
  const isTrails = activeOverlay === 'trails'
  const isAnalytics = activeOverlay === 'analytics'

  useEffect(() => {
    getFlightData().then((d) => {
      setData(d)
      const synced = viewSync.get()
      const initial = normalizeViewState(
        synced ?? {
          longitude: d.INITIAL_VIEW_STATE.longitude,
          latitude: d.INITIAL_VIEW_STATE.latitude,
          zoom: d.INITIAL_VIEW_STATE.zoom,
          bearing: d.INITIAL_VIEW_STATE.bearing,
          pitch: d.INITIAL_VIEW_STATE.pitch,
        }
      )
      setViewState(initial)
      viewSync.set(toLite(initial))
    })
  }, [])

  useEffect(() => {
    return viewSync.subscribe((vs: ViewStateLite) => {
      const normalized = normalizeViewState(vs)
      setViewState(normalized)
    })
  }, [])

  useEffect(() => {
    if (!isSegments) {
      setSelectedFlightId(null)
      setHoveredFlightId(null)
    }
  }, [isSegments])

  const altitudeScale = useMemo(() => {
    if (!data) return 1
    return Math.max(1, data.aggregatedStats.maxAltitudeFt)
  }, [data])

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

    const camera = mapInstance.cameraForBounds?.(bounds as LngLatBoundsLike, {
      padding: { top: 36, right: 48, bottom: 48, left: 48 },
      maxZoom: 12,
    })
    if (camera?.center) {
      const center = maplibregl.LngLat.convert(camera.center)
      const next = normalizeViewState({
        longitude: center.lng,
        latitude: center.lat,
        zoom: camera.zoom ?? viewRef.current?.zoom ?? data.INITIAL_VIEW_STATE.zoom,
        bearing: viewRef.current?.bearing ?? data.INITIAL_VIEW_STATE.bearing,
        pitch: viewRef.current?.pitch ?? data.INITIAL_VIEW_STATE.pitch,
        transitionDuration: 700,
        transitionInterpolator: new FlyToInterpolator(),
      })
      setViewState(next)
      viewSync.set(toLite(next))
    }
  }, [ready, data, selectedFlightId, isSegments])

  const flightsBase = useMemo(() => {
    if (!data) return [] as Array<Pick<Flight, 'id' | 'name' | 'points'>>
    return data.flights
      .filter((f) => f.points.length >= 2)
      .map((f) => ({ id: f.id, name: f.name, points: f.points }))
  }, [data])

  const flightsLayer = useAnimatedFlightsOverlay({ flights: flightsBase, isActive: isFlights })

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

  const trailLayers = useTrailsOverlay({ trips, isActive: isTrails })

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
  })

  const segmentsLayer = useSegmentsLayer({
    segments: data?.flightSegments ?? [],
    isActive: isSegments,
    selectedFlightId,
    hoveredFlightId,
    altitudeScale,
  })

  const layers = useMemo(() => {
    const out: Layer[] = []
    if (segmentsLayer) out.push(segmentsLayer)
    if (flightsLayer) out.push(flightsLayer)
    if (trailLayers.length) out.push(...trailLayers)
    if (analyticsLayer) out.push(analyticsLayer)
    return out
  }, [segmentsLayer, flightsLayer, trailLayers, analyticsLayer])

  if (!data || !viewState) return <div className="h-full w-full" />

  const selectedFlight = isSegments
    ? findSelectedFlight(data?.flights, selectedFlightId)
    : null
  const chartData = selectedFlight
    ? selectedFlight.points.map((p, index) => ({
        distanceKm: Number.isFinite(p.distanceKm as number) ? (p.distanceKm as number) : index,
        altitudeFt: p.altitudeFeet,
        speedKts: p.speedKts,
      }))
    : null

  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
  const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
  const formatKm = (v?: number | null, precise = false) =>
    Number.isFinite(v as number) ? `${(precise ? nf1 : nf0).format(v as number)} km` : '–'
  const formatFt = (v?: number | null) =>
    Number.isFinite(v as number) ? `${nf0.format(v as number)} ft` : '–'
  const formatDuration = (seconds?: number | null) => {
    if (!Number.isFinite(seconds as number)) return '–'
    const total = Math.floor((seconds as number) / 60)
    const h = Math.floor(total / 60)
    const m = total % 60
    return h > 0 ? `${h} h ${m} min` : `${m} min`
  }

  const getTooltip = ({ object }: { object?: unknown | null }) => {
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
  }

  const handleHover = isSegments
    ? (info: PickingInfo<FlightSegment>) =>
        setHoveredFlightId(info.object ? info.object.flightId : null)
    : undefined

  const handleClick = isSegments
    ? (info: PickingInfo<FlightSegment>) =>
        setSelectedFlightId(info.object ? info.object.flightId : null)
    : undefined

  const deckStyle: Partial<CSSStyleDeclaration> = {
    position: 'absolute',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
  }

  const gridTemplateRows = selectedFlight && chartData && isSegments ? '1fr minmax(12rem, 16rem)' : '1fr'

  return (
    <div className="h-full w-full grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows }}>
      <div className="relative" style={{ backgroundColor: 'var(--map-land)' }}>
        <DeckGL
          style={deckStyle}
          controller={{
            dragPan: true,
            dragRotate: true,
            touchZoom: true,
            touchRotate: true,
            keyboard: true,
            inertia: 300,
          }}
          parameters={{
            blendColorOperation: 'add',
            blendColorSrcFactor: 'src-alpha',
            blendColorDstFactor: 'one',
            blendAlphaOperation: 'add',
            blendAlphaSrcFactor: 'one-minus-dst-alpha',
            blendAlphaDstFactor: 'one',
          }}
          layers={layers}
          viewState={viewState}
          onViewStateChange={({ viewState: vs }) => {
            const typed = vs as DeckViewState
            const next = normalizeViewState(typed)
            setViewState(next)
            viewSync.set(toLite(next))
          }}
          getTooltip={getTooltip}
          getCursor={({ isDragging, isHovering }: { isDragging: boolean; isHovering: boolean }) =>
            isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'
          }
          onHover={handleHover}
          onClick={handleClick}
        >
          <MapGL
            ref={mapRef}
            mapLib={maplibregl}
            mapStyle={MAP_STYLE}
            attributionControl={false}
            interactive={false}
            maxPitch={85}
            onLoad={() => setReady(true)}
            style={{ width: '100%', height: '100%' }}
          ></MapGL>
        </DeckGL>

        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <OverlayPicker active={activeOverlay} onSelect={(id) => setActiveOverlay(id)} />
          {isAnalytics ? (
            <button
              type="button"
              className="controls-btn rounded-md text-xs px-3 py-1"
              onClick={() => setAnalyticsMetric((m) => (m === 'alt' ? 'count' : 'alt'))}
            >
              Metric: {analyticsMetric === 'alt' ? 'Avg altitude' : 'Count'}
            </button>
          ) : null}
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            className="controls-btn rounded-md text-sm p-2 shadow"
            onClick={() =>
              setViewState((s) => {
                if (!s) return s
                const next = normalizeViewState({
                  ...s,
                  zoom: s.zoom + 0.5,
                  transitionDuration: 500,
                  transitionInterpolator: new FlyToInterpolator(),
                })
                viewSync.set(toLite(next))
                return next
              })
            }
            aria-label="Zoom in"
          >
            <PlusIcon />
          </button>
          <button
            className="controls-btn rounded-md text-sm p-2 shadow"
            onClick={() =>
              setViewState((s) => {
                if (!s) return s
                const next = normalizeViewState({
                  ...s,
                  zoom: s.zoom - 0.5,
                  transitionDuration: 500,
                  transitionInterpolator: new FlyToInterpolator(),
                })
                viewSync.set(toLite(next))
                return next
              })
            }
            aria-label="Zoom out"
          >
            <MinusIcon />
          </button>
          <button
            className="controls-btn rounded-md text-sm p-2 shadow"
            onClick={() =>
              setViewState((s) => {
                if (!data) return s
                const base = {
                  longitude: data.INITIAL_VIEW_STATE.longitude,
                  latitude: data.INITIAL_VIEW_STATE.latitude,
                  zoom: data.INITIAL_VIEW_STATE.zoom,
                  bearing: data.INITIAL_VIEW_STATE.bearing,
                  pitch: data.INITIAL_VIEW_STATE.pitch,
                  transitionDuration: 600,
                  transitionInterpolator: new FlyToInterpolator(),
                }
                const next = normalizeViewState(base)
                viewSync.set(toLite(next))
                return next
              })
            }
            aria-label="Reset view"
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      {isSegments && selectedFlight && chartData ? (
        <div
          className="border-t p-0 overflow-hidden"
          style={{
            backgroundColor: 'var(--map-land)',
            color: '#ffffff',
            borderColor: 'var(--panel-border)',
          }}
        >
          <div className="grid gap-0 h-full" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <div className="p-3 overflow-auto border-r" style={{ borderColor: 'var(--panel-border)' }}>
              <div className="text-sm font-semibold mb-2">{selectedFlight.name}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div className="contents">
                  <dt className="text-[hsl(var(--muted-foreground))]">Distance</dt>
                  <dd className="justify-self-end">{formatKm(selectedFlight.distanceKm, true)}</dd>
                </div>
                <div className="contents">
                  <dt className="text-[hsl(var(--muted-foreground))]">Duration</dt>
                  <dd className="justify-self-end">{formatDuration(selectedFlight.durationSeconds)}</dd>
                </div>
                <div className="contents">
                  <dt className="text-[hsl(var(--muted-foreground))]">Avg altitude</dt>
                  <dd className="justify-self-end">{formatFt(selectedFlight.altitudeStats?.avg)}</dd>
                </div>
                <div className="contents">
                  <dt className="text-[hsl(var(--muted-foreground))]">Altitude range</dt>
                  <dd className="justify-self-end">
                    {formatFt(selectedFlight.altitudeStats?.min)} → {formatFt(selectedFlight.altitudeStats?.max)}
                  </dd>
                </div>
              </dl>
              <div className="mt-3">
                <button
                  type="button"
                  className="controls-btn rounded-md text-xs px-2 py-1"
                  onClick={() => setSelectedFlightId(null)}
                >
                  Clear selection
                </button>
              </div>
            </div>
            <div className="p-0 overflow-hidden">
              <FlightChart data={chartData} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
