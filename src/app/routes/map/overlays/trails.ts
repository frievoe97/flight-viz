import { useEffect, useMemo, useRef, useState } from 'react'
import { TripsLayer } from '@deck.gl/geo-layers'
import { colors } from '@/lib/theme/tokens'

export type Trip = {
  id: string
  path: [number, number, number][]
  timestamps: number[]
  duration: number
}

const TRAIL_LENGTH_SECONDS = 45
const TRAIL_SPEED = 35

export function useTrailsOverlay({ trips, isActive }: { trips: Trip[]; isActive: boolean }) {
  const timeRef = useRef<Map<string, number>>(new Map())
  const rafRef = useRef(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!isActive || !trips.length) return () => undefined
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      for (const trip of trips) {
        const cur = timeRef.current.get(trip.id) ?? 0
        const next = trip.duration > 0 ? (cur + dt * TRAIL_SPEED) % trip.duration : 0
        timeRef.current.set(trip.id, next)
      }
      setTick((t) => t + 1)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isActive, trips])

  return useMemo(() => {
    if (!isActive || !trips.length) return [] as TripsLayer<Trip>[]
    void tick
    return trips.map(
      (trip) =>
        new TripsLayer<Trip>({
          id: `trail-${trip.id}`,
          data: [trip],
          pickable: false,
          getPath: (d) => d.path,
          getTimestamps: (d) => d.timestamps,
          currentTime: timeRef.current.get(trip.id) ?? 0,
          widthUnits: 'meters',
          getWidth: 300,
          widthMinPixels: 2,
          rounded: true,
          capRounded: true,
          fadeTrail: true,
          trailLength: Math.min(TRAIL_LENGTH_SECONDS, Math.max(1, trip.duration)),
          getColor: () => colors.flight.high,
        })
    )
  }, [isActive, trips, tick])
}
