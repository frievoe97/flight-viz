import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import MapGL from 'react-map-gl/maplibre' // ⟵ NICHT "Map" nennen
import * as maplibregl from 'maplibre-gl' // ⟵ Namespace-Import
import 'maplibre-gl/dist/maplibre-gl.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ScenegraphLayer } from '@deck.gl/mesh-layers'
import type { ScenegraphLayerProps } from '@deck.gl/mesh-layers'
import { FlyToInterpolator } from '@deck.gl/core'
import { getFlightData, type Flight } from '@/data'
import { MAP_STYLE } from '@/lib/map/deckConfig'

const MODEL_URL =
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/scenegraph-layer/airplane.glb'

const ANIMATIONS: ScenegraphLayerProps['_animations'] = {
  '*': { speed: 1 },
}

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

export default function FlightsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getFlightData>> | null>(null)
  const [viewState, setViewState] = useState<VS | null>(null)
  const rafRef = useRef(0)
  const tickRef = useRef(0)
  const [tick, setTick] = useState(0)
  const progressRef = useRef<Map<string, number>>(new Map())
  const dataRef = useRef<Awaited<ReturnType<typeof getFlightData>> | null>(null)

  useEffect(() => {
    getFlightData().then((d) => {
      setData(d)
      dataRef.current = d
      setViewState({
        longitude: d.INITIAL_VIEW_STATE.longitude,
        latitude: d.INITIAL_VIEW_STATE.latitude,
        zoom: Math.max(2.5, d.INITIAL_VIEW_STATE.zoom),
        bearing: d.INITIAL_VIEW_STATE.bearing,
        pitch: 0,
      })
    })
  }, [])

  // Build a stable list of flights with at least 2 points (no allocation each frame)
  const flightsBase = useMemo(() => {
    if (!data) return [] as Array<Pick<Flight, 'id' | 'name' | 'points'>>
    return data.flights
      .filter((f) => f.points.length >= 2)
      .map((f) => ({ id: f.id, name: f.name, points: f.points }))
  }, [data])

  // Initialize per-flight progress once and prune removed flights
  useEffect(() => {
    if (!flightsBase.length) return
    const setIds = new Set(flightsBase.map((f) => f.id))
    // initialize missing with randomized offsets to desync
    for (const f of flightsBase) {
      if (!progressRef.current.has(f.id)) {
        progressRef.current.set(f.id, Math.random())
      }
    }
    // prune stale ids
    for (const key of Array.from(progressRef.current.keys())) {
      if (!setIds.has(key)) progressRef.current.delete(key)
    }
  }, [flightsBase])

  useEffect(() => {
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const SPEED_FACTOR = 1.0 // change this to speed up or slow down globally
      const SPEED = 0.12 * SPEED_FACTOR // cycles per second
      const flights = flightsBase
      if (flights.length) {
        for (const f of flights) {
          const cur = progressRef.current.get(f.id) ?? Math.random() // desync starts
          let next = cur + dt * SPEED
          if (next >= 1) next = next % 1 // restart immediately after landing
          progressRef.current.set(f.id, next)
        }
      }
      tickRef.current += 1
      setTick((t) => t + 1)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [flightsBase])

  const layers = useMemo(() => {
    if (!data) return []
    // Build an entry per flight with current position interpolated along its path
    type Animated = {
      id: string
      name: string
      position: [number, number, number]
      orientation: [number, number, number]
    }

    const toRad = (v: number) => (v * Math.PI) / 180
    const bearingDeg = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const phi1 = toRad(lat1)
      const phi2 = toRad(lat2)
      const dLon = toRad(lon2 - lon1)
      const y = Math.sin(dLon) * Math.cos(phi2)
      const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon)
      return (Math.atan2(y, x) * 180) / Math.PI
    }

    const flights: Animated[] = flightsBase.map((f) => {
      const pts = f.points
      const last = pts[pts.length - 1]
      const steps = pts.length - 1
      const phase = progressRef.current.get(f.id) ?? 0
      const pathT = phase * steps
      const idx = Math.floor(pathT)
      const frac = pathT - idx
      const a = pts[Math.max(0, Math.min(idx, pts.length - 1))]
      const b = pts[Math.max(0, Math.min(idx + 1, pts.length - 1))]
      const lon = a.position[0] + (b.position[0] - a.position[0]) * frac
      const lat = a.position[1] + (b.position[1] - a.position[1]) * frac
      const alt =
        (a.altitudeMeters ?? 0) + ((b.altitudeMeters ?? 0) - (a.altitudeMeters ?? 0)) * frac
      const yaw = -bearingDeg(a.position[1], a.position[0], b.position[1], b.position[0])
      const dAlt = (b.altitudeMeters ?? 0) - (a.altitudeMeters ?? 0)
      const pitch = Math.max(-30, Math.min(30, (Math.atan2(dAlt, 1000) * 180) / Math.PI))
      return { id: f.id, name: f.name, position: [lon, lat, alt], orientation: [pitch, yaw, 90] }
    })

    return [
      new ScenegraphLayer<Animated>({
        id: 'flights-animated',
        data: flights,
        pickable: true,
        scenegraph: MODEL_URL,
        _animations: ANIMATIONS,
        sizeScale: 300,
        getId: (d) => d.id,
        getPosition: (d) => d.position,
        getOrientation: (d) => d.orientation,
        getFillColor: () => [255, 255, 255],
        updateTriggers: { getPosition: [tick], getOrientation: [tick] },
      }),
    ]
  }, [data, flightsBase, tick])

  if (!data || !viewState) return <div className="h-full w-full" />

  const deckStyle: Partial<CSSStyleDeclaration> = {
    position: 'absolute',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
  }

  return (
    <div className="relative h-full w-full" style={{ backgroundColor: 'var(--map-land)' }}>
      <DeckGL
        style={deckStyle}
        controller
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
        layers={layers}
        getTooltip={({ object }) => (object ? (object as any).name : null)}
      >
        <MapGL
          mapLib={maplibregl}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          interactive={false}
        />
      </DeckGL>
      <div className="absolute top-3 left-3">
        <button
          className="controls-btn rounded-md text-sm px-3 py-2 shadow"
          onClick={() =>
            setViewState((s) =>
              s
                ? {
                    ...s,
                    transitionDuration: 600,
                    transitionInterpolator: new FlyToInterpolator(),
                    longitude: data.INITIAL_VIEW_STATE.longitude,
                    latitude: data.INITIAL_VIEW_STATE.latitude,
                    zoom: Math.max(2.5, data.INITIAL_VIEW_STATE.zoom),
                    bearing: 0,
                    pitch: 0,
                  }
                : s
            )
          }
        >
          Reset view
        </button>
      </div>
    </div>
  )
}
