import { useMemo } from 'react'
import { ScatterplotLayer } from '@deck.gl/layers'
import { colors } from '@/lib/theme/tokens'

export type ClimbBurstDatum = {
  id: string
  position: [number, number]
  verticalRateFpm: number
  altitudeFt: number | null
  speedKts: number | null
  flightName: string
}

const climbColor: [number, number, number, number] = [
  colors.flight.high[0],
  colors.flight.high[1],
  colors.flight.high[2],
  230,
]
const descentColor: [number, number, number, number] = [
  colors.flight.low[0],
  colors.flight.low[1],
  colors.flight.low[2],
  230,
]

export function useClimbBurstsLayer({
  samples,
  isActive,
  minMagnitude,
}: {
  samples: ClimbBurstDatum[]
  isActive: boolean
  minMagnitude: number
}) {
  return useMemo(() => {
    if (!isActive || !samples.length) return null
    return new ScatterplotLayer<ClimbBurstDatum>({
      id: 'climb-bursts',
      data: samples,
      pickable: true,
      stroked: true,
      filled: true,
      opacity: 0.95,
      billboard: true,
      radiusUnits: 'meters',
      radiusMinPixels: 4,
      radiusMaxPixels: 48,
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1,
      getPosition: (d) => d.position,
      getFillColor: (d) => (d.verticalRateFpm >= 0 ? climbColor : descentColor),
      getLineColor: () => [255, 255, 255, 200],
      getRadius: (d) => {
        const magnitude = Math.abs(d.verticalRateFpm)
        const excess = Math.max(0, magnitude - minMagnitude)
        return 4000 + excess * 2.2
      },
      updateTriggers: {
        getRadius: [minMagnitude],
      },
    })
  }, [samples, isActive, minMagnitude])
}
