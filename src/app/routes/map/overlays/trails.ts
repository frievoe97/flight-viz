import { useEffect, useMemo, useRef, useState } from 'react'
import { TripsLayer } from '@deck.gl/geo-layers'
import { colors } from '@/lib/theme/tokens'

export type Trip = {
  id: string
  path: [number, number, number][]
  timestamps: number[]
  duration: number
}

const BASE_TRAIL_SPEED = 35

export function useTrailsOverlay({
  trips,
  isActive,
  speedMultiplier,
  trailLengthSeconds,
  heightScale = 3, // ← Faktor für die Z-Skalierung
}: {
  trips: Trip[]
  isActive: boolean
  speedMultiplier: number
  trailLengthSeconds: number
  heightScale?: number
}) {
  const timeRef = useRef<Map<string, number>>(new Map())
  const rafRef = useRef(0)
  const [tick, setTick] = useState(0)

  // Z-Werte vorab skaliert in die Daten mappen → getPath bleibt typsicher
  const scaledTrips = useMemo(() => {
    if (!trips.length) return trips
    return trips.map((t) => ({
      ...t,
      path: t.path.map(([x, y, z]) => [x, y, z * heightScale] as [number, number, number]),
    }))
  }, [trips, heightScale])

  useEffect(() => {
    if (!isActive || !trips.length) return () => undefined
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
  }, [isActive, trips, speedMultiplier])

  return useMemo(() => {
    if (!isActive || !scaledTrips.length) return [] as TripsLayer<Trip>[]
    void tick
    return scaledTrips.map(
      (trip) =>
        new TripsLayer<Trip>({
          id: `trail-${trip.id}`,
          data: [trip],
          pickable: false,
          getPath: (d) => d.path, // typsicher, keine Map-Operation im Accessor
          getTimestamps: (d) => d.timestamps,
          currentTime: timeRef.current.get(trip.id) ?? 0,
          widthUnits: 'meters',
          getWidth: 300,
          widthMinPixels: 2,
          rounded: true,
          capRounded: true,
          fadeTrail: true,
          trailLength: Math.min(trailLengthSeconds, Math.max(1, trip.duration)),
          getColor: () => colors.flight.high,
        })
    )
  }, [isActive, scaledTrips, trailLengthSeconds, tick])
}
