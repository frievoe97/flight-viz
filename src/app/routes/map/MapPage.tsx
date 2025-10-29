import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { LineLayer } from '@deck.gl/layers'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import { PlusIcon, MinusIcon, ResetIcon } from '@radix-ui/react-icons'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getFlightData, type FlightSegment } from '@/data'
import { MAP_STYLE } from '@/lib/map/deckConfig'
import { FlyToInterpolator } from '@deck.gl/core'
import FlightChart from './FlightChart'

const FEET_TO_METERS = 0.3048
const VERTICAL_EXAGGERATION = 1
const SELECTED_HIGHLIGHT_COLOR: [number, number, number, number] = [249, 115, 22, 200]

export default function MapPage() {
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof getFlightData>> | null>(null)
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  type VS = {
    longitude: number
    latitude: number
    zoom: number
    bearing: number
    pitch: number
    transitionDuration?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transitionInterpolator?: any
  }
  const [viewState, setViewState] = useState<VS | null>(null)
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
    mapInstance.fitBounds(bounds, {
      padding: { top: 36, right: 48, bottom: 48, left: 48 },
      duration: 700,
    })
  }, [ready, selectedFlightId, data, setViewState])

  const altitudeScale = useMemo(() => {
    if (!data) return 1
    return Math.max(1, data.aggregatedStats.maxAltitudeFt)
  }, [data])

  const deckStyle: Partial<CSSStyleDeclaration> = {
    position: 'absolute',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
  }

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
          const zFt = Number.isFinite(d.endAltitudeFeet)
            ? d.endAltitudeFeet
            : (d.startAltitudeFeet ?? 0)
          const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
          return [d.end[0], d.end[1], z]
        },
        getColor: (d) => {
          const zFt = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
          const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
          const r = Math.max(0, Math.min(z / 10000, 1))
          return [255 * (1 - r * 2), 128 * r, 255 * r, 255 * (1 - 1 * 0.8 * r)]
        },
        getWidth: (d) => {
          if (d.flightId === selectedFlightId) return 6
          const value = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
          const ratio = Math.max(0, Math.min(value / altitudeScale, 1))
          return 3.5 + ratio * 3.5
        },
        // use defaults for WebGL parameters
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
    const timeRange = startTime && endTime ? `${startTime} → ${endTime}` : (startTime ?? null)
    return [object.name, altitudeText, timeRange].filter(Boolean).join('\n')
  }

  if (!data || !viewState) return <div className="h-full w-full" />

  const selectedFlight = selectedFlightId
    ? (data.flights.find((f) => f.id === selectedFlightId) ?? null)
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

  return (
    <div
      className="h-full w-full grid"
      style={{ gridTemplateColumns: '20rem 1fr', gridTemplateRows: '1fr minmax(12rem, 16rem)' }}
    >
      <aside className="panel border-r p-3 overflow-auto" style={{ gridRow: '1 / span 2' }}>
        <div className="space-y-3">
          <div className="card p-1">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total flights</div>
            <div className="text-2xl font-semibold">{data.aggregatedStats.totalFlights}</div>
          </div>
          <div className="card p-1">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total distance</div>
            <div className="text-2xl font-semibold">
              {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
                data.aggregatedStats.totalDistanceKm
              )}{' '}
              km
            </div>
          </div>
          <div className="card p-1">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total time</div>
            <div className="text-2xl font-semibold">
              {Math.round((data.aggregatedStats.totalDurationSeconds / 3600) * 10) / 10} h
            </div>
          </div>
          <div className="card p-1">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Max altitude</div>
            <div className="text-2xl font-semibold">
              {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
                data.aggregatedStats.maxAltitudeFt
              )}{' '}
              ft
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {selectedFlight ? selectedFlight.name : 'Flight details'}
              </h3>
              {selectedFlight ? (
                <button
                  type="button"
                  className="text-xs underline underline-offset-2"
                  onClick={() => setSelectedFlightId(null)}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {selectedFlight ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div className="contents">
                  <dt className="text-[hsl(var(--muted-foreground))]">Distance</dt>
                  <dd className="justify-self-end">{formatKm(selectedFlight.distanceKm, true)}</dd>
                </div>
                <div className="contents">
                  <dt className="text-[hsl(var(--muted-foreground))]">Duration</dt>
                  <dd className="justify-self-end">
                    {formatDuration(selectedFlight.durationSeconds)}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-[hsl(var(--muted-foreground))]">Avg altitude</dt>
                  <dd className="justify-self-end">
                    {formatFt(selectedFlight.altitudeStats?.avg)}
                  </dd>
                </div>
                <div className="contents">
                  <dt className="text-[hsl(var(--muted-foreground))]">Altitude range</dt>
                  <dd className="justify-self-end">
                    {formatFt(selectedFlight.altitudeStats?.min)} →{' '}
                    {formatFt(selectedFlight.altitudeStats?.max)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Select a flight on the map to view details.
              </p>
            )}
          </div>
        </div>
      </aside>
      <div className="relative" style={{ gridRow: '1 / 2', backgroundColor: 'var(--map-land)' }}>
        <DeckGL
          style={deckStyle}
          controller
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
          getCursor={({ isDragging, isHovering }: { isDragging: boolean; isHovering: boolean }) =>
            isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'
          }
          onClick={({ object }: { object?: FlightSegment | null }) =>
            setSelectedFlightId(object?.flightId ?? null)
          }
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
          ></Map>
        </DeckGL>
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            className="controls-btn rounded-md text-sm p-2 shadow"
            onClick={() =>
              setViewState((s) =>
                s
                  ? {
                      ...s,
                      zoom: s.zoom + 0.5,
                      transitionDuration: 500,
                      transitionInterpolator: new FlyToInterpolator(),
                    }
                  : s
              )
            }
            aria-label="Zoom in"
          >
            <PlusIcon />
          </button>
          <button
            className="controls-btn rounded-md text-sm p-2 shadow"
            onClick={() =>
              setViewState((s) =>
                s
                  ? {
                      ...s,
                      zoom: s.zoom - 0.5,
                      transitionDuration: 500,
                      transitionInterpolator: new FlyToInterpolator(),
                    }
                  : s
              )
            }
            aria-label="Zoom out"
          >
            <MinusIcon />
          </button>
          <button
            className="controls-btn rounded-md text-sm p-2 shadow"
            onClick={() =>
              setViewState({
                longitude: data.INITIAL_VIEW_STATE.longitude,
                latitude: data.INITIAL_VIEW_STATE.latitude,
                zoom: data.INITIAL_VIEW_STATE.zoom,
                bearing: data.INITIAL_VIEW_STATE.bearing,
                pitch: data.INITIAL_VIEW_STATE.pitch,
                transitionDuration: 600,
                transitionInterpolator: new FlyToInterpolator(),
              })
            }
            aria-label="Reset view"
          >
            <ResetIcon />
          </button>
        </div>
      </div>
      <div
        className="border-t p-0 overflow-hidden"
        style={{
          gridRow: '2 / 3',
          backgroundColor: 'var(--map-land)',
          color: '#ffffff',
          borderColor: 'var(--panel-border)',
        }}
      >
        {selectedFlight && chartData ? (
          <FlightChart data={chartData} />
        ) : (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            Select a flight to see chart.
          </div>
        )}
      </div>
    </div>
  )
}
