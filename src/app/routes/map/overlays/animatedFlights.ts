import { useEffect, useMemo, useRef, useState } from 'react'
import { ScenegraphLayer } from '@deck.gl/mesh-layers'
import type { ScenegraphLayerProps } from '@deck.gl/mesh-layers'
import type { Flight } from '@/data'

const MODEL_URL =
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/scenegraph-layer/airplane.glb'

// const MODEL_URL =
//   'https://raw.githubusercontent.com/frievoe97/share/ceeb32d86c621183200a44029162303e43329563/compressed.glb'

const ANIMATIONS: ScenegraphLayerProps['_animations'] = {
  '*': { speed: 1 },
}

const BASE_SPEED = 0.004
const SMOOTH = 0.35
const FLIGHT_FADE_WINDOW = 0.05
const TARGET_FPS = 20
const FRAME_INTERVAL = 1 / TARGET_FPS

type FlightLite = Pick<Flight, 'id' | 'name' | 'points'>

type StateEntry = {
  position: [number, number, number]
  orientation: [number, number, number]
}

type LayerEntry = StateEntry & {
  id: string
  name: string
  opacity: number
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const lerpVec3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

export function useAnimatedFlightsOverlay({
  flights,
  isActive,
  speedMultiplier,
}: {
  flights: FlightLite[]
  isActive: boolean
  speedMultiplier: number
}) {
  const progressRef = useRef<Map<string, number>>(new Map())
  const lastStateRef = useRef<Map<string, StateEntry>>(new Map())
  const rafRef = useRef(0)
  const accumulatorRef = useRef(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!flights.length) return
    const ids = new Set(flights.map((f) => f.id))
    for (const f of flights) {
      if (!progressRef.current.has(f.id)) {
        progressRef.current.set(f.id, Math.random())
      }
    }
    for (const key of Array.from(progressRef.current.keys())) {
      if (!ids.has(key)) progressRef.current.delete(key)
    }
  }, [flights])

  useEffect(() => {
    if (!isActive || !flights.length) return () => undefined
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      accumulatorRef.current += dt

      let updated = false
      while (accumulatorRef.current >= FRAME_INTERVAL) {
        const step = FRAME_INTERVAL * BASE_SPEED * speedMultiplier
        for (const f of flights) {
          const cur = progressRef.current.get(f.id) ?? Math.random()
          let next = cur + step
          if (next >= 1) next = next % 1
          if (next < cur) {
            lastStateRef.current.delete(f.id)
          }
          progressRef.current.set(f.id, next)
        }
        accumulatorRef.current -= FRAME_INTERVAL
        updated = true
      }

      if (updated) {
        setTick((t) => t + 1)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isActive, flights, speedMultiplier])

  const layer = useMemo(() => {
    if (!isActive || !flights.length) return null

    const entries: LayerEntry[] = flights.map((f) => {
      const pts = f.points
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

      const bearing = bearingDeg(a.position[1], a.position[0], b.position[1], b.position[0])

      // Deck.gl + airplane.glb: Yaw invertieren, Roll = 90°.
      const yaw = -bearing + 180

      // Optional etwas “realistischer”: Pitch aus Steigung zwischen A und B.
      // Nimm horizontale Distanz in Metern statt fixer 1000:
      const dAlt = (b.altitudeMeters ?? 0) - (a.altitudeMeters ?? 0)
      const dLon =
        (b.position[0] - a.position[0]) *
        Math.cos((Math.PI / 180) * ((a.position[1] + b.position[1]) / 2))
      const dLat = b.position[1] - a.position[1]
      const groundDeg = Math.sqrt(dLon * dLon + dLat * dLat)
      const metersPerDeg = 111320 // grob, reicht hier
      const groundMeters = groundDeg * metersPerDeg
      const pitch = Math.max(
        -30,
        Math.min(30, (Math.atan2(dAlt, Math.max(1, groundMeters)) * 180) / Math.PI)
      )

      const targetOri: [number, number, number] = [pitch, yaw, 90]

      const targetPos: [number, number, number] = [lon, lat, alt]
      // const targetOri: [number, number, number] = [pitch, yaw, 90]
      const prev = lastStateRef.current.get(f.id)
      const smoothPos = prev ? lerpVec3(prev.position, targetPos, SMOOTH) : targetPos
      const smoothOri = prev ? lerpVec3(prev.orientation, targetOri, SMOOTH) : targetOri
      lastStateRef.current.set(f.id, { position: smoothPos, orientation: smoothOri })

      let opacity = 1
      if (phase < FLIGHT_FADE_WINDOW) {
        opacity = Math.max(0, phase / FLIGHT_FADE_WINDOW)
      } else if (phase > 1 - FLIGHT_FADE_WINDOW) {
        opacity = Math.max(0, (1 - phase) / FLIGHT_FADE_WINDOW)
      }

      return { id: f.id, name: f.name, position: smoothPos, orientation: smoothOri, opacity }
    })

    return new ScenegraphLayer<LayerEntry>({
      id: 'flights-animated',
      data: entries,
      pickable: true,
      scenegraph: MODEL_URL,
      _animations: ANIMATIONS,
      sizeScale: 400,
      getPosition: (d) => d.position,
      getOrientation: (d) => d.orientation,
      getColor: (d) => [255, 255, 255, Math.round(d.opacity * 255)],
      updateTriggers: { getPosition: [tick], getOrientation: [tick], getColor: [tick] },
    })
  }, [isActive, flights, tick])

  return layer
}
