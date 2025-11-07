import { useMemo } from 'react'
import { ScatterplotLayer } from '@deck.gl/layers'

export type AirportHubDatum = {
  id: string
  position: [number, number]
  name: string | null
  code: string | null
  city: string | null
  country: string | null
  flights: number
  avgAltitudeFt: number | null
}

const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value))
const MAX_REFERENCE_ALTITUDE_FT = 45000

export function useAirportHubsLayer({
  hubs,
  isActive,
  zoom,
  sizeScale,
}: {
  hubs: AirportHubDatum[]
  isActive: boolean
  zoom: number
  sizeScale: number
}) {
  return useMemo(() => {
    if (!isActive || !hubs.length) return null
    const zoomFactor = Number.isFinite(zoom) ? Math.min(2.2, Math.max(0.3, (zoom - 1) / 5)) : 0.6
    return new ScatterplotLayer<AirportHubDatum>({
      id: 'airport-hubs',
      data: hubs,
      pickable: true,
      stroked: true,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      radiusMinPixels: 4,
      radiusMaxPixels: 48,
      opacity: 0.95,
      getRadius: (d) => {
        const intensity = Math.sqrt(d.flights)
        const base = 6 + intensity * 3
        return base * zoomFactor
      },
      getFillColor: (d) => {
        const ratio = Math.max(
          0,
          Math.min(
            (d.avgAltitudeFt ?? MAX_REFERENCE_ALTITUDE_FT / 3) / MAX_REFERENCE_ALTITUDE_FT,
            1
          )
        )
        const r = clamp(80 + ratio * 120)
        const g = clamp(140 + ratio * 40)
        const b = clamp(220 - ratio * 80)
        return [Math.round(r), Math.round(g), Math.round(b), 210]
      },
      getLineColor: () => [255, 255, 255, 200],
      getLineWidth: (d) => (1 + Math.min(d.flights, 20) * 0.05) * sizeScale,
      radiusScale: sizeScale,
    })
  }, [hubs, isActive, zoom, sizeScale])
}
