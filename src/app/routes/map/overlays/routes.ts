import { useMemo } from 'react'
import { ArcLayer } from '@deck.gl/layers'

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
}: {
  routes: RouteArcDatum[]
  isActive: boolean
  widthScale: number
}) {
  return useMemo(() => {
    if (!isActive || !routes.length) return null

    return new ArcLayer<RouteArcDatum>({
      id: 'flight-routes',
      data: routes,
      pickable: true,
      greatCircle: true,
      getSourcePosition: (d) => d.source,
      getTargetPosition: (d) => d.target,

      // ✨ Farbverlauf: türkis → violett, leicht transparent
      getSourceColor: () => [80, 200, 255, 180], // hellblau / türkis
      getTargetColor: () => [180, 130, 255, 220], // violett / lavendel

      getWidth: (d) => {
        const width = 2 + Math.sqrt(Math.max(d.distanceKm, 1)) * 0.18
        return Math.min(width, 16)
      },
      getHeight: () => 0.2,
      widthUnits: 'pixels',
      widthScale,
      opacity: 0.9,
    })
  }, [routes, isActive, widthScale])
}
