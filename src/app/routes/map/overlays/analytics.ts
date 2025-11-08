import { useMemo } from 'react'
import { HexagonLayer } from '@deck.gl/aggregation-layers'
import { lerpColor, colors } from '@/lib/theme/tokens'

type AnalyticsPoint = { position: [number, number]; altitudeFt: number; speedKmh: number | null; flightId: string }

export type AnalyticsPickingInfo = {
  elevationValue: number
  colorValue: number
  points?: unknown[]
}

export function useAnalyticsLayer({
  points,
  isActive,
  metric,
  radius,
  elevationScale = 20,
  opacity = 0.95,
}: {
  points: AnalyticsPoint[]
  isActive: boolean
  metric: 'alt' | 'count' | 'speed'
  radius: number
  elevationScale?: number
  opacity?: number
}) {
  return useMemo(() => {
    if (!isActive) return null
    const forward = Array.from({ length: 6 }, (_, i) => {
      const t = i / 5
      return lerpColor(colors.flight.low, colors.flight.high, t)
    }) as [number, number, number][]
    const reversed = [...forward].reverse() as [number, number, number][]
    const colorRange = metric === 'alt' ? reversed : forward

    return new HexagonLayer({
      id: 'hex-density',
      data: points,
      pickable: true,
      extruded: true,
      gpuAggregation: false,
      opacity,
      radius,
      elevationScale,
      // Ensure re-aggregation when the metric changes
      updateTriggers: {
        getElevationValue: [metric],
        getColorValue: [metric],
      },
      getPosition: (d: AnalyticsPoint) => d.position,
      getElevationValue: (pointsInBin: any[]) => {
        // Normalize deck.gl aggregator points to our source objects
        const items = pointsInBin.map((p) => ((p && p.source) ? (p.source as AnalyticsPoint) : (p as AnalyticsPoint)))
        if (metric === 'alt') {
          const vals = items.map((p) => p.altitudeFt).filter((v) => Number.isFinite(v))
          if (!vals.length) return 0
          return vals.reduce((a, b) => a + b, 0) / vals.length
        }
        if (metric === 'speed') {
          const vals = items
            .map((p) => (p.speedKmh == null ? null : Number(p.speedKmh)))
            .filter((v): v is number => Number.isFinite(v as number))
          if (!vals.length) return 0
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length
          return Math.max(0, Math.min(1200, avg))
        }
        // count unique flights
        return new Set(items.map((p) => p.flightId)).size
      },
      getColorValue: (pointsInBin: any[]) => {
        const items = pointsInBin.map((p) => ((p && p.source) ? (p.source as AnalyticsPoint) : (p as AnalyticsPoint)))
        // mirror elevation metric for color for consistent tooltips
        if (metric === 'alt') {
          const vals = items.map((p) => p.altitudeFt).filter((v) => Number.isFinite(v))
          if (!vals.length) return 0
          return vals.reduce((a, b) => a + b, 0) / vals.length
        }
        if (metric === 'speed') {
          const vals = items
            .map((p) => (p.speedKmh == null ? null : Number(p.speedKmh)))
            .filter((v): v is number => Number.isFinite(v as number))
          if (!vals.length) return 0
          return vals.reduce((a, b) => a + b, 0) / vals.length
        }
        return new Set(items.map((p) => p.flightId)).size
      },
      colorRange,
      material: true,
    })
  }, [points, isActive, metric, radius, elevationScale, opacity])
}
