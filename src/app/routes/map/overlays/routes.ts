import { useMemo } from 'react'
import { ArcLayer } from '@deck.gl/layers'
import type { Theme } from '@/lib/theme/useTheme'

export type RouteArcDatum = {
  id: string
  name: string
  source: [number, number]
  target: [number, number]
  avgAltitudeFt: number | null
  distanceKm: number
  originCode: string | null
  destinationCode: string | null
}

export function useRoutesLayer({
  routes,
  isActive,
  widthScale,
  height,
  opacity,
  theme,
}: {
  routes: RouteArcDatum[]
  isActive: boolean
  widthScale: number
  height: number
  opacity: number
  theme: Theme
}) {
  return useMemo(() => {
    if (!isActive || !routes.length) return null

    const baseColor =
      theme === 'dark'
        ? ([255, 255, 255, Math.round(opacity * 255)] as [number, number, number, number])
        : ([0, 0, 0, Math.round(opacity * 255)] as [number, number, number, number])

    return new ArcLayer<RouteArcDatum>({
      id: 'flight-routes',
      data: routes,
      pickable: true,
      greatCircle: true,
      opacity,
      getSourcePosition: (d) => d.source,
      getTargetPosition: (d) => d.target,
      getSourceColor: () => baseColor,
      getTargetColor: () => baseColor,

      getWidth: (d) => {
        const width = 0 + Math.sqrt(Math.max(d.distanceKm, 1)) * 0.18
        return Math.min(width, 16)
      },
      getHeight: () => height,
      widthUnits: 'pixels',
      widthScale: widthScale * 0.5,
    })
  }, [routes, isActive, widthScale, height, opacity, theme])
}
