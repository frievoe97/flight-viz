import { useEffect, useMemo, useRef, useState } from 'react'
import { TripsLayer } from '@deck.gl/geo-layers'
import { colors, lerpColor, type RGB } from '@/lib/theme/tokens'
import type { Theme } from '@/lib/theme/useTheme'

const ALTITUDE_COLOR_EXPONENT = 0.35
const TRAIL_COLOR_OVERRIDE_LIGHT: { low: RGB; high: RGB } = {
  low: [220, 56, 56],
  high: [32, 96, 196],
}

export type Trip = {
  id: string
  path: [number, number, number][]
  timestamps: number[]
  duration: number
}

const BASE_TRAIL_SPEED = 35
const BASE_TRAIL_WIDTH_METERS = 12
const BASE_TRAIL_WIDTH_PIXELS = 3

export function useTrailsOverlay({
  trips,
  isActive,
  speedMultiplier,
  trailLengthSeconds,
  heightScale = 3, // ← Faktor für die Z-Skalierung
  widthScale = 1,
  opacity = 0.85,
  isPaused = false,
  theme = 'dark',
}: {
  trips: Trip[]
  isActive: boolean
  speedMultiplier: number
  trailLengthSeconds: number
  heightScale?: number
  widthScale?: number
  opacity?: number
  isPaused?: boolean
  theme?: Theme
}) {
  const timeRef = useRef<Map<string, number>>(new Map())
  const rafRef = useRef(0)
  const [tick, setTick] = useState(0)

  const altitudeStats = useMemo(() => {
    if (!trips.length) {
      return {
        min: 0,
        max: 1,
        byTrip: new Map<string, number>(),
      }
    }
    let globalMin = Infinity
    let globalMax = -Infinity
    const byTrip = new Map<string, number>()
    for (const trip of trips) {
      if (!trip.path.length) continue
      let sum = 0
      let count = 0
      for (const [, , z] of trip.path) {
        if (!Number.isFinite(z)) continue
        globalMin = Math.min(globalMin, z)
        globalMax = Math.max(globalMax, z)
        sum += z
        count += 1
      }
      if (count) byTrip.set(trip.id, sum / count)
    }
    if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) {
      globalMin = 0
      globalMax = 1
    }
    if (globalMax === globalMin) {
      globalMax = globalMin + 1
    }
    return { min: globalMin, max: globalMax, byTrip }
  }, [trips])

  // Z-Werte vorab skaliert in die Daten mappen → getPath bleibt typsicher
  const scaledTrips = useMemo(() => {
    if (!trips.length) return trips
    return trips.map((t) => ({
      ...t,
      path: t.path.map(([x, y, z]) => [x, y, z * heightScale] as [number, number, number]),
    }))
  }, [trips, heightScale])

  useEffect(() => {
    if (!isActive || !trips.length || isPaused) return () => undefined
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      for (const trip of trips) {
        const cur = timeRef.current.get(trip.id) ?? 0
        const step = dt * BASE_TRAIL_SPEED * speedMultiplier
        const next = trip.duration > 0 ? (cur + step) % trip.duration : 0
        timeRef.current.set(trip.id, next)
      }
      setTick((t) => t + 1)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isActive, trips, speedMultiplier, isPaused])

  return useMemo(() => {
    if (!isActive || !scaledTrips.length) return [] as TripsLayer<Trip>[]
    void tick
    const widthMeters = BASE_TRAIL_WIDTH_METERS * Math.max(0.1, widthScale) ** 2
    const widthMinPixels = BASE_TRAIL_WIDTH_PIXELS * Math.max(0.5, widthScale)
    const widthMaxPixels = widthMinPixels * 4

    return scaledTrips.map(
      (trip) =>
        new TripsLayer<Trip>({
          id: `trail-${trip.id}`,
          data: [trip],
          pickable: false,
          opacity,
          getPath: (d) => d.path, // typsicher, keine Map-Operation im Accessor
          getTimestamps: (d) => d.timestamps,
          currentTime: timeRef.current.get(trip.id) ?? 0,
          widthUnits: 'meters',
          getWidth: widthMeters,
          widthMinPixels,
          widthMaxPixels,
          jointRounded: true,
          capRounded: true,
          fadeTrail: true,
          trailLength: Math.min(trailLengthSeconds, Math.max(1, trip.duration)),
          getColor: () => {
            const avgAltitude = altitudeStats.byTrip.get(trip.id) ?? altitudeStats.min
            const normalized =
              (avgAltitude - altitudeStats.min) / Math.max(1, altitudeStats.max - altitudeStats.min)
            const eased = Math.pow(Math.max(0, Math.min(1, normalized)), ALTITUDE_COLOR_EXPONENT)
            const palette =
              theme === 'light'
                ? (TRAIL_COLOR_OVERRIDE_LIGHT as { low: RGB; high: RGB })
                : colors.flight
            const [r, g, b] = lerpColor(palette.low, palette.high, eased)
            return [r, g, b]
          },
        })
    )
  }, [isActive, scaledTrips, trailLengthSeconds, widthScale, opacity, tick, altitudeStats, theme])
}
