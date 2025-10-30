import { useMemo } from 'react'
import { HexagonLayer } from '@deck.gl/aggregation-layers'
import { lerpColor, colors } from '@/lib/theme/tokens'

type AnalyticsPoint = { position: [number, number]; altitude: number }

export type AnalyticsPickingInfo = {
  elevationValue: number
  colorValue: number
}

export function useAnalyticsLayer({
  points,
  isActive,
  metric,
}: {
  points: AnalyticsPoint[]
  isActive: boolean
  metric: 'alt' | 'count'
}) {
  return useMemo(() => {
    if (!isActive) return null
    const colorRange = Array.from({ length: 6 }, (_, i) => {
      const t = i / 5
      return lerpColor(colors.flight.low, colors.flight.high, t)
    }) as [number, number, number][]

    return new HexagonLayer({
      id: 'hex-density',
      data: points,
      pickable: true,
      extruded: true,
      radius: 15000,
      elevationScale: 20,
      getPosition: (d: AnalyticsPoint) => d.position,
      getElevationWeight: (d: AnalyticsPoint) => (metric === 'alt' ? d.altitude || 0 : 1),
      elevationAggregation: metric === 'alt' ? 'MEAN' : 'SUM',
      getColorWeight: (d: AnalyticsPoint) => (metric === 'alt' ? d.altitude || 0 : 1),
      colorAggregation: metric === 'alt' ? 'MEAN' : 'SUM',
      colorRange,
      material: true,
    })
  }, [points, isActive, metric])
}
