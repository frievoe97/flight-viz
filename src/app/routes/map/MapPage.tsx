import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { LineLayer } from '@deck.gl/layers'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import { PlusIcon, MinusIcon, ResetIcon } from '@radix-ui/react-icons'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getFlightData, type FlightSegment } from '@/data'
import { MAP_STYLE } from '@/lib/map/deckConfig'
import FlightChart from './FlightChart'

const FEET_TO_METERS = 0.3048
const VERTICAL_EXAGGERATION = 1
const SELECTED_HIGHLIGHT_COLOR: [number, number, number, number] = [249, 115, 22, 200]

export default function MapPage() {
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof getFlightData>> | null>(null)
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  const [viewState, setViewState] = useState<
    | { longitude: number; latitude: number; zoom: number; bearing: number; pitch: number }
    | null
  >(null)
  const mapRef = useRef<MapRef | null>(null)

  useEffect(() => {
    getFlightData().then((d) => {
      setData(d)
      setViewState({
        longitude: d.INITIAL_VIEW_STATE.longitude,
        latitude: d.INITIAL_VIEW_STATE.latitude,
        zoom: d.INITIAL_VIEW_STATE.zoom,
        bearing: d.INITIAL_VIEW_STATE.bearing,
        pitch: d.INITIAL_VIEW_STATE.pitch,
      })
    })
  }, [])

  useEffect(() => {
    if (!ready || !data) return
    const mapInstance = mapRef.current?.getMap?.()
    if (!mapInstance) return
    if (!selectedFlightId) {
      // Reset to initial view via viewState to avoid event loops
      setViewState({
        longitude: data.INITIAL_VIEW_STATE.longitude,
        latitude: data.INITIAL_VIEW_STATE.latitude,
        zoom: data.INITIAL_VIEW_STATE.zoom,
        bearing: data.INITIAL_VIEW_STATE.bearing,
        pitch: data.INITIAL_VIEW_STATE.pitch,
      })
      return
    }
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
    mapInstance.fitBounds(bounds, { padding: { top: 36, right: 48, bottom: 48, left: 48 }, duration: 700 })
  }, [ready, selectedFlightId, data, setViewState])

  const altitudeScale = useMemo(() => {
    if (!data) return 1
    return Math.max(1, data.aggregatedStats.maxAltitudeFt)
  }, [data])

  const layers = useMemo(() => {
    if (!data) return []
    return [
      new LineLayer<FlightSegment>({
        id: 'flight-paths',
        data: data.flightSegments,
        pickable: true,
        autoHighlight: true,
        highlightColor: SELECTED_HIGHLIGHT_COLOR,
        widthUnits: 'pixels',
        opacity: 0.8,
        getSourcePosition: (d) => {
          const zFt = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
          const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
          return [d.start[0], d.start[1], z]
        },
        getTargetPosition: (d) => {
          const zFt = Number.isFinite(d.endAltitudeFeet) ? d.endAltitudeFeet : d.startAltitudeFeet ?? 0
          const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
          return [d.end[0], d.end[1], z]
        },
        getColor: (d) => {
          const zFt = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
          const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
          const r = Math.max(0, Math.min(z / 10000, 1))
          return [255 * (1 - r * 2), 128 * r, 255 * r, 255 * (1 - 1 * r)]
        },
        getWidth: (d) => {
          if (d.flightId === selectedFlightId) return 6
          const value = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
          const ratio = Math.max(0, Math.min(value / altitudeScale, 1))
          return 3.5 + ratio * 3.5
        },
        parameters: { depthTest: true },
        updateTriggers: {
          getWidth: [selectedFlightId, altitudeScale],
          getColor: [VERTICAL_EXAGGERATION],
          getSourcePosition: [VERTICAL_EXAGGERATION],
          getTargetPosition: [VERTICAL_EXAGGERATION],
        },
      }),
    ]
  }, [data, selectedFlightId, altitudeScale])

  const getTooltip = ({ object }: { object?: FlightSegment | null }) => {
    if (!object) return null
    const startTime = object.startTime ?? 'Unknown'
    const endTime = object.endTime ?? 'Unknown'
    const altitudeText = Number.isFinite(object.startAltitudeFeet)
      ? `Altitude: ${new Intl.NumberFormat('en-US').format(object.startAltitudeFeet)} ft`
      : null
    const timeRange = startTime && endTime ? `${startTime} → ${endTime}` : startTime ?? null
    return [object.name, altitudeText, timeRange].filter(Boolean).join('\n')
  }

  if (!data || !viewState) return <div className="h-full w-full" />

  const selectedFlight = selectedFlightId ? data.flights.find((f) => f.id === selectedFlightId) ?? null : null
  const chartData = selectedFlight
    ? selectedFlight.points.map((p, index) => ({
        distanceKm: Number.isFinite(p.distanceKm as number) ? (p.distanceKm as number) : index,
        altitudeFt: p.altitudeFeet,
        speedKts: p.speedKts,
      }))
    : null

  return (
    <div className="h-full w-full grid" style={{ gridTemplateColumns: '20rem 1fr', gridTemplateRows: '1fr minmax(12rem, 16rem)' }}>
      <aside className="border-r p-3 overflow-auto" style={{ gridRow: '1 / span 2' }}>
        <div className="space-y-3">
          <div className="rounded-md border p-3">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total flights</div>
            <div className="text-2xl font-semibold">{data.aggregatedStats.totalFlights}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total distance</div>
            <div className="text-2xl font-semibold">{new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(data.aggregatedStats.totalDistanceKm)} km</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total time</div>
            <div className="text-2xl font-semibold">{Math.round((data.aggregatedStats.totalDurationSeconds / 3600) * 10) / 10} h</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Max altitude</div>
            <div className="text-2xl font-semibold">{new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(data.aggregatedStats.maxAltitudeFt)} ft</div>
          </div>
        </div>
      </aside>
      <div className="relative" style={{ gridRow: '1 / 2' }}>
        <DeckGL
          style={{ position: 'absolute', inset: 0 }}
          controller={{ dragRotate: true, touchRotate: true, inertia: 220, minZoom: 1.5, maxZoom: 12, maxPitch: 85 }}
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
          onViewStateChange={({ viewState: vs }) =>
            setViewState({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              longitude: (vs as any).longitude,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              latitude: (vs as any).latitude,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              zoom: (vs as any).zoom,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              bearing: (vs as any).bearing,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pitch: (vs as any).pitch,
            })
          }
          getTooltip={getTooltip}
          getCursor={({ isDragging, isHovering }: { isDragging: boolean; isHovering: boolean }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab')}
          onClick={({ object }: { object?: FlightSegment | null }) => setSelectedFlightId(object?.flightId ?? null)}
          >
          <Map
            ref={mapRef}
            mapLib={maplibregl}
            mapStyle={MAP_STYLE}
            attributionControl={false}
            interactive={false}
            maxPitch={85}
            onLoad={() => setReady(true)}
            style={{ width: '100%', height: '100%' }}
          >
          </Map>
        </DeckGL>
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            className="rounded-md border bg-[hsl(var(--background))] text-sm p-2 shadow"
            onClick={() => setViewState((s) => (s ? { ...s, zoom: s.zoom + 0.5 } : s))}
            aria-label="Zoom in"
          >
            <PlusIcon />
          </button>
          <button
            className="rounded-md border bg-[hsl(var(--background))] text-sm p-2 shadow"
            onClick={() => setViewState((s) => (s ? { ...s, zoom: s.zoom - 0.5 } : s))}
            aria-label="Zoom out"
          >
            <MinusIcon />
          </button>
          <button
            className="rounded-md border bg-[hsl(var(--background))] text-sm p-2 shadow"
            onClick={() =>
              setViewState({
                longitude: data.INITIAL_VIEW_STATE.longitude,
                latitude: data.INITIAL_VIEW_STATE.latitude,
                zoom: data.INITIAL_VIEW_STATE.zoom,
                bearing: data.INITIAL_VIEW_STATE.bearing,
                pitch: data.INITIAL_VIEW_STATE.pitch,
              })
            }
            aria-label="Reset view"
          >
            <ResetIcon />
          </button>
        </div>
      </div>
      <div className="border-t p-3 overflow-hidden" style={{ gridRow: '2 / 3' }}>
        {selectedFlight && chartData ? (
          <FlightChart data={chartData} />
        ) : (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">Select a flight to see chart.</div>
        )}
      </div>
    </div>
  )
}
