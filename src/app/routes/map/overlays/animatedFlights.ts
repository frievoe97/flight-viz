import { useEffect, useMemo, useRef, useState } from 'react'
import { ScenegraphLayer } from '@deck.gl/mesh-layers'
import type { ScenegraphLayerProps } from '@deck.gl/mesh-layers'
import type { Flight } from '@/data'
import type { Theme } from '@/lib/theme/useTheme'

const resolveModelAsset = (asset: string) => {
  const base = import.meta.env.BASE_URL ?? '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const trimmedAsset = asset.startsWith('/') ? asset.slice(1) : asset
  return `${normalizedBase}${trimmedAsset}`
}

const MODEL_URL_BY_THEME: Record<Theme, string> = {
  // light: resolveModelAsset('models/airplane_black_min.glb'),
  // dark: resolveModelAsset('models/airplane_white_min.glb'),
  light: resolveModelAsset('models/airplane_black.glb'),
  dark: resolveModelAsset('models/airplane_white.glb'),
}

const MODEL_COLOR_BY_THEME: Record<Theme, [number, number, number]> = {
  light: [25, 25, 25],
  dark: [240, 240, 240],
}

const ANIMATIONS: ScenegraphLayerProps['_animations'] = {
  '*': { speed: 1 },
}

const BASE_SPEED = 0.08
const SMOOTH = 0.35
const FLIGHT_FADE_WINDOW = 0.05
const TARGET_FPS = 30
const FRAME_INTERVAL = 1 / TARGET_FPS
const BASE_MODEL_SCALE = 20 // size at reference zoom before user scaling
const REFERENCE_ZOOM = 6
const MIN_ZOOM_FOR_SCALE = 1.5
const MAX_ZOOM_FOR_SCALE = 26
const PLANE_SIZE_RATIO_MIN = 0.4
const PLANE_SIZE_RATIO_MAX = 2.6
const MODEL_ROLL_OFFSET = 0

type FlightLite = Pick<Flight, 'id' | 'name' | 'points'>
type ProjectionMode = 'globe' | 'mercator'

type StateEntry = {
  position: [number, number, number]
  orientation: [number, number, number]
}

type LayerEntry = StateEntry & {
  id: string
  name: string
  opacity: number
}

/* -------------------- Geodesy helpers -------------------- */

const toRad = (v: number) => (v * Math.PI) / 180
const toDeg = (v: number) => (v * 180) / Math.PI

// Wrap longitude into [-180, 180)
const wrapLon = (lon: number) => {
  let x = lon
  while (x < -180) x += 360
  while (x >= 180) x -= 360
  return x
}

// Return lonB' so that delta = lonB' - lonA is in [-180, 180]
const unwrapLonToward = (lonA: number, lonB: number) => {
  let lonB2 = lonB
  const d = lonB2 - lonA
  if (d > 180) lonB2 -= 360
  else if (d < -180) lonB2 += 360
  return lonB2
}

/**
 * Initial bearing from A(lat1,lon1) to B(lat2,lon2) along great circle.
 * Uses longitudes unwrapped to shortest path to avoid jumps at the antimeridian.
 * Return in degrees, range [-180,180].
 */
const initialBearingDeg = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const lon2u = unwrapLonToward(lon1, lon2)
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lon2u - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return toDeg(Math.atan2(y, x)) // [-180, 180]
}

/* -------------------- Smoothing helpers -------------------- */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const lerpVec3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/* -------------------- Main hook -------------------- */

export function useAnimatedFlightsOverlay({
  flights,
  isActive,
  speedMultiplier,
  projectionMode,
  zoom,
  planeScale = 1,
  theme,
  isPaused = false,
}: {
  flights: FlightLite[]
  isActive: boolean
  speedMultiplier: number
  projectionMode: ProjectionMode
  zoom: number
  planeScale?: number
  theme: Theme
  isPaused?: boolean
}) {
  const progressRef = useRef<Map<string, number>>(new Map())
  const lastStateRef = useRef<Map<string, StateEntry>>(new Map())
  const rafRef = useRef(0)
  const accumulatorRef = useRef(0)
  const [tick, setTick] = useState(0)

  // keep progress map in sync with flights
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

  // animation loop (fixed update rate via accumulator)
  useEffect(() => {
    if (!isActive || !flights.length || isPaused) return () => undefined
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
            // looped -> reset smoothing to avoid long lerp across path start
            lastStateRef.current.delete(f.id)
          }
          progressRef.current.set(f.id, next)
        }
        accumulatorRef.current -= FRAME_INTERVAL
        updated = true
      }

      if (updated) setTick((t) => t + 1)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isActive, flights, speedMultiplier, isPaused])

  useEffect(() => {
    // Switching projection can introduce big jumps, so reset smoothing state.
    lastStateRef.current.clear()
  }, [projectionMode])

  const layer = useMemo(() => {
    if (!isActive || !flights.length) return null

    const modelUrl = MODEL_URL_BY_THEME[theme] ?? MODEL_URL_BY_THEME.dark
    const [colorR, colorG, colorB] = MODEL_COLOR_BY_THEME[theme] ?? MODEL_COLOR_BY_THEME.dark

    const zoomInput = Number.isFinite(zoom) ? (zoom as number) : REFERENCE_ZOOM
    const effectiveZoom = clamp(zoomInput, MIN_ZOOM_FOR_SCALE, MAX_ZOOM_FOR_SCALE)
    const counterScale = Math.pow(2, REFERENCE_ZOOM - effectiveZoom) // neutralizes camera zoom
    const zoomSpan = Math.max(0.0001, MAX_ZOOM_FOR_SCALE - MIN_ZOOM_FOR_SCALE)
    const zoomT = clamp((effectiveZoom - MIN_ZOOM_FOR_SCALE) / zoomSpan, 0, 1)
    const ratio = lerp(PLANE_SIZE_RATIO_MIN, PLANE_SIZE_RATIO_MAX, zoomT)
    const planeScaleWithZoom = Math.max(0.1, planeScale) * ratio
    const modelScale = BASE_MODEL_SCALE * counterScale * planeScaleWithZoom
    const scaleVector: [number, number, number] = [modelScale, modelScale, modelScale]

    const entries: LayerEntry[] = flights.map((f) => {
      const pts = f.points
      const steps = pts.length - 1
      const phase = progressRef.current.get(f.id) ?? 0
      const pathT = phase * Math.max(1, steps)
      const idx = Math.min(steps - 1, Math.max(0, Math.floor(pathT)))
      const frac = pathT - idx

      const a = pts[Math.max(0, Math.min(idx, pts.length - 1))]
      const b = pts[Math.max(0, Math.min(idx + 1, pts.length - 1))]

      // --- Antimeridian-safe interpolation of longitude ---
      const lonA = a.position[0]
      const lonBraw = b.position[0]
      const lonBunwrapped = unwrapLonToward(lonA, lonBraw)
      const lonInterpUnwrapped = lonA + (lonBunwrapped - lonA) * frac
      const lon = wrapLon(lonInterpUnwrapped)
      // ----------------------------------------------------

      const lat = a.position[1] + (b.position[1] - a.position[1]) * frac
      const alt =
        (a.altitudeMeters ?? 0) + ((b.altitudeMeters ?? 0) - (a.altitudeMeters ?? 0)) * frac

      // Bearing (great circle) – also using unwrapped longitudes
      const bearing = initialBearingDeg(a.position[1], lonA, b.position[1], lonBunwrapped)

      // Scenegraph orientation (Deck): [pitch, yaw, roll] in degrees.
      // Für die Globus-Projektion drehen wir um 180° (Z-Achse), damit die Modelle vorwärts zeigen.
      const MODEL_YAW_OFFSET = 0
      const projectionYawAdjustment = projectionMode === 'globe' ? 180 : 0
      const yaw = -bearing + MODEL_YAW_OFFSET + projectionYawAdjustment
      const roll = MODEL_ROLL_OFFSET

      // Pitch aus Höhenänderung und horizontaler Distanz (meter-genähert)
      const dAlt = (b.altitudeMeters ?? 0) - (a.altitudeMeters ?? 0)
      const latMid = (a.position[1] + b.position[1]) / 2
      const dLonDeg = (lonBunwrapped - lonA) * Math.cos(toRad(latMid)) // mercatorähnliche Skalierung
      const dLatDeg = b.position[1] - a.position[1]
      const groundDeg = Math.sqrt(dLonDeg * dLonDeg + dLatDeg * dLatDeg)
      const metersPerDeg = 111320
      const groundMeters = Math.max(1, groundDeg * metersPerDeg)
      const pitch = Math.max(-30, Math.min(30, toDeg(Math.atan2(dAlt, groundMeters))))

      const targetPos: [number, number, number] = [lon, lat, alt]
      const targetOri: [number, number, number] = [pitch, yaw, roll]

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
      id: `flights-animated-${theme}`,
      data: entries,
      pickable: true,
      scenegraph: modelUrl,
      _animations: ANIMATIONS,
      sizeScale: 1,
      getScale: () => scaleVector,
      getPosition: (d) => d.position,
      getOrientation: (d) => d.orientation,
      getColor: (d) => [colorR, colorG, colorB, Math.round(d.opacity * 255)],
      updateTriggers: {
        getPosition: [tick],
        getOrientation: [tick],
        getColor: [tick, colorR, colorG, colorB],
        getScale: [modelScale],
      },
    })
  }, [isActive, flights, tick, projectionMode, zoom, planeScale, theme, isPaused])

  return layer
}
