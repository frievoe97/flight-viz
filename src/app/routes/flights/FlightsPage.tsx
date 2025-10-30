import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import Map from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
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
  const [, forceTick] = useState(0)
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

  useEffect(() => {
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const SPEED = 0.12 // cycles per second
      const flights = dataRef.current?.flights ?? []
      if (flights.length) {
        for (const f of flights) {
          const cur = progressRef.current.get(f.id) ?? Math.random() // desync starts
          let next = cur + dt * SPEED
          if (next >= 1) next = next % 1 // restart immediately after landing
          progressRef.current.set(f.id, next)
        }
      }
      tickRef.current += 1
      forceTick(t => t + 1)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const layers = useMemo(() => {
    if (!data) return []
    // Build an entry per flight with current position interpolated along its path
    type Animated = { id: string; name: string; position: [number, number, number] }

    const flights: Animated[] = data.flights.map((f: Flight) => {
      const pts = f.points
      if (pts.length === 0) return { id: f.id, name: f.name, position: [0, 0, 0] }
      // total distance by last point's distanceKm or points length
      const last = pts[pts.length - 1]
      const total = Number.isFinite(last.distanceKm as number)
        ? ((last.distanceKm as number) > 0 ? (last.distanceKm as number) : pts.length - 1)
        : pts.length - 1
      const phase = progressRef.current.get(f.id) ?? 0
      const pathT = total > 0 ? phase * total : phase * (pts.length - 1)
      const idx = Math.floor(pathT)
      const frac = pathT - idx
      const a = pts[Math.max(0, Math.min(idx, pts.length - 1))]
      const b = pts[Math.max(0, Math.min(idx + 1, pts.length - 1))]
      const lon = (a.position[0] + (b.position[0] - a.position[0]) * frac)
      const lat = (a.position[1] + (b.position[1] - a.position[1]) * frac)
      const alt = ((a.altitudeMeters ?? 0) + ((b.altitudeMeters ?? 0) - (a.altitudeMeters ?? 0)) * frac)
      return { id: f.id, name: f.name, position: [lon, lat, alt] }
    })

    return [
      new ScenegraphLayer<Animated>({
        id: 'flights-animated',
        data: flights,
        pickable: true,
        scenegraph: MODEL_URL,
        _animations: ANIMATIONS,
        sizeScale: 60,
        getPosition: (d) => d.position,
        getOrientation: () => [0, 0, 90],
        getFillColor: () => [255, 255, 255],
        updateTriggers: { getPosition: [tickRef.current] },
      }),
    ]
  }, [data])

  if (!data || !viewState) return <div className="h-full w-full" />

  const deckStyle: Partial<CSSStyleDeclaration> = {
    position: 'absolute',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
  }

  return (
    <div className="h-full w-full" style={{ backgroundColor: 'var(--map-land)' }}>
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
        <Map mapLib={maplibregl} mapStyle={MAP_STYLE} attributionControl={false} interactive={false} />
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
