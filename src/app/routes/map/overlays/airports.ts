import { useMemo } from 'react'
import { ScatterplotLayer } from '@deck.gl/layers'
import type { Theme } from '@/lib/theme/useTheme'
// import { useTheme } from '@/lib/theme/useTheme'
// const { theme } = useTheme()

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

export function useAirportHubsLayer({
  hubs,
  isActive,
  zoom,
  sizeScale,
  opacity = 0.95,
  theme = 'dark',
}: {
  hubs: AirportHubDatum[]
  isActive: boolean
  zoom: number
  sizeScale: number
  opacity?: number
  theme?: Theme
}) {
  return useMemo(() => {
    if (!isActive || !hubs.length) return null

    const zoomFactor = Number.isFinite(zoom) ? Math.min(2.2, Math.max(0.3, (zoom - 1) / 5)) : 0.6

    return new ScatterplotLayer<AirportHubDatum>({
      id: 'airport-hubs',
      data: hubs,
      pickable: true,
      stroked: true,
      opacity,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      radiusMinPixels: 4,
      radiusMaxPixels: 48,
      getRadius: (d) => {
        const intensity = Math.sqrt(d.flights)
        const base = 6 + intensity * 3
        return base * zoomFactor
      },
      getFillColor: () =>
        theme === 'light'
          ? ([0, 0, 0, 210] as [number, number, number, number])
          : ([255, 255, 255, 210] as [number, number, number, number]),
      getLineColor: () => [255, 255, 255, 200] as [number, number, number, number],
      getLineWidth: (d) => (1 + Math.min(d.flights, 20) * 0.05) * sizeScale,
      radiusScale: sizeScale,
      updateTriggers: {
        getFillColor: [theme], // <— wichtig
      },
    })
  }, [hubs, isActive, zoom, sizeScale, opacity, theme])
}
