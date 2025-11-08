import { useMemo } from 'react'
import { ColumnLayer } from '@deck.gl/layers'
import { colors, lerpColor } from '@/lib/theme/tokens'

export type SpeedColumnDatum = {
  id: string
  position: [number, number]
  speedKts: number
  altitudeFt: number | null
  flightName: string
}

const MIN_SPEED_REFERENCE = 150
const MAX_SPEED_REFERENCE = 520

export function useSpeedColumnsLayer({
  samples,
  isActive,
  elevationScale,
}: {
  samples: SpeedColumnDatum[]
  isActive: boolean
  elevationScale: number
}) {
  return useMemo(() => {
    if (!isActive || !samples.length) return null
    return new ColumnLayer<SpeedColumnDatum>({
      id: 'speed-columns',
      data: samples,
      pickable: true,
      extruded: true,
      wireframe: false,
      diskResolution: 12,
      radius: 18000, // ≈18 km footprint per sample
      elevationScale,
      getPosition: (d) => d.position,
      getElevation: (d) => Math.max(d.speedKts, 0),
      getFillColor: (d) => {
        const speed = Math.max(MIN_SPEED_REFERENCE, Math.min(d.speedKts, MAX_SPEED_REFERENCE))
        const t =
          (speed - MIN_SPEED_REFERENCE) / Math.max(1, MAX_SPEED_REFERENCE - MIN_SPEED_REFERENCE)
        const base = lerpColor(colors.flight.low, colors.flight.high, t)
        return [...base, 220] as [number, number, number, number]
      },
      getLineColor: () => [255, 255, 255, 140],
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1,
      material: true,
    })
  }, [samples, isActive, elevationScale])
}
