import { useEffect, useMemo, useState } from 'react'
import DeckGL from '@deck.gl/react'
import Map from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { HexagonLayer } from '@deck.gl/aggregation-layers'
import { getFlightData } from '@/data'
import { MAP_STYLE } from '@/lib/map/deckConfig'

type VS = {
  longitude: number
  latitude: number
  zoom: number
  bearing: number
  pitch: number
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getFlightData>> | null>(null)
  const [viewState, setViewState] = useState<VS | null>(null)
  const [metric, setMetric] = useState<'count' | 'alt'>('alt')

  useEffect(() => {
    getFlightData().then((d) => {
      setData(d)
      setViewState({
        longitude: d.INITIAL_VIEW_STATE.longitude,
        latitude: d.INITIAL_VIEW_STATE.latitude,
        zoom: Math.max(3, d.INITIAL_VIEW_STATE.zoom),
        bearing: 0,
        pitch: 35,
      })
    })
  }, [])

  const points = useMemo(() => {
    if (!data) return [] as Array<{ position: [number, number]; altitude: number }>
    const list: Array<{ position: [number, number]; altitude: number }> = []
    for (const f of data.flights) {
      for (const p of f.points) {
        list.push({ position: [p.position[0], p.position[1]], altitude: p.altitudeFeet ?? 0 })
      }
    }
    return list
  }, [data])

  const layers = useMemo(() => {
    if (!viewState) return []
    return [
      new HexagonLayer({
        id: 'hex-altitude-density',
        data: points,
        pickable: true,
        extruded: true,
        radius: 20000, // 20km bins
        elevationScale: 20,
        getPosition: (d: any) => d.position,
        getElevationWeight: (d: any) => (metric === 'alt' ? d.altitude || 0 : 1),
        elevationAggregation: metric === 'alt' ? 'MEAN' : 'SUM',
        getColorWeight: (d: any) => (metric === 'alt' ? d.altitude || 0 : 1),
        colorAggregation: metric === 'alt' ? 'MEAN' : 'SUM',
        colorRange: [
          [30, 58, 138],
          [37, 99, 235],
          [56, 189, 248],
          [168, 85, 247],
          [236, 72, 153],
        ],
        material: true,
      }),
    ]
  }, [points, viewState, metric])

  if (!viewState) return <div className="h-full w-full" />

  const deckStyle: Partial<CSSStyleDeclaration> = {
    position: 'absolute',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
  }

  return (
    <div className="relative h-full w-full" style={{ backgroundColor: 'var(--map-land)' }}>
      <DeckGL
        style={deckStyle}
        controller
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) =>
          setViewState({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            longitude: (vs as any).longitude,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            latitude: (vs as any).latitude,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            zoom: (vs as any).zoom,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            bearing: (vs as any).bearing,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pitch: (vs as any).pitch,
          })
        }
        layers={layers}
        getTooltip={({ object }) => {
          if (!object) return null
          const e = (object as any).elevationValue
          const c = (object as any).colorValue
          return metric === 'alt'
            ? `Avg altitude: ${Math.round(e)} ft\nSamples: ${c}`
            : `Count: ${c}`
        }}
      >
        <Map mapLib={maplibregl as unknown as any} mapStyle={MAP_STYLE} attributionControl={false} interactive={false} />
      </DeckGL>
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <button
          className="controls-btn rounded-md text-sm px-3 py-2 shadow"
          onClick={() => setMetric((m) => (m === 'alt' ? 'count' : 'alt'))}
        >
          Metric: {metric === 'alt' ? 'Avg altitude' : 'Count'}
        </button>
      </div>
    </div>
  )
}
