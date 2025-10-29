import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { LineLayer } from '@deck.gl/layers'
import Map, { NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getFlightData, type FlightSegment } from '@/data'
import { MAP_STYLE } from '@/lib/map/deckConfig'

const FEET_TO_METERS = 0.3048
const VERTICAL_EXAGGERATION = 1
const SELECTED_HIGHLIGHT_COLOR: [number, number, number, number] = [249, 115, 22, 200]

export default function MapPage() {
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof getFlightData>> | null>(null)
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  const mapRef = useRef<MapRef | null>(null)

  useEffect(() => {
    getFlightData().then((d) => setData(d))
  }, [])

  useEffect(() => {
    if (!ready || !data) return
    const mapInstance = mapRef.current?.getMap?.()
    if (!mapInstance) return
    if (!selectedFlightId) {
      mapInstance.easeTo({
        center: [data.INITIAL_VIEW_STATE.longitude, data.INITIAL_VIEW_STATE.latitude],
        zoom: data.INITIAL_VIEW_STATE.zoom,
        bearing: data.INITIAL_VIEW_STATE.bearing,
        duration: 600,
      })
      return
    }
    const flight = data.flights.find((f) => f.id === selectedFlightId)
    if (!flight?.points?.length) return
    const bounds = new maplibregl.LngLatBounds()
    for (const p of flight.points) {
      const [lon, lat] = p.position
      if (Number.isFinite(lon) && Number.isFinite(lat)) bounds.extend([lon, lat])
    }
    if (bounds.isEmpty()) return
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    if (sw && ne && sw.lng === ne.lng && sw.lat === ne.lat) {
      const lngOffset = 0.05
      const latOffset = 0.05
      bounds.extend([sw.lng + lngOffset, sw.lat + latOffset])
      bounds.extend([sw.lng - lngOffset, sw.lat - latOffset])
    }
    mapInstance.fitBounds(bounds, { padding: { top: 36, right: 48, bottom: 48, left: 48 }, duration: 700 })
  }, [ready, selectedFlightId, data])

  const altitudeScale = useMemo(() => {
    if (!data) return 1
    return Math.max(1, data.aggregatedStats.maxAltitudeFt)
  }, [data])

  const layers = useMemo(() => {
    if (!data) return []
    return [
      new LineLayer<FlightSegment>({
        id: 'flight-paths',
        data: data.flightSegments,
        pickable: true,
        autoHighlight: true,
        highlightColor: SELECTED_HIGHLIGHT_COLOR,
        widthUnits: 'pixels',
        opacity: 0.8,
        getSourcePosition: (d) => {
          const zFt = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
          const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
          return [d.start[0], d.start[1], z]
        },
        getTargetPosition: (d) => {
          const zFt = Number.isFinite(d.endAltitudeFeet) ? d.endAltitudeFeet : d.startAltitudeFeet ?? 0
          const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
          return [d.end[0], d.end[1], z]
        },
        getColor: (d) => {
          const zFt = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
          const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
          const r = Math.max(0, Math.min(z / 10000, 1))
          return [255 * (1 - r * 2), 128 * r, 255 * r, 255 * (1 - 1 * r)]
        },
        getWidth: (d) => {
          if (d.flightId === selectedFlightId) return 6
          const value = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
          const ratio = Math.max(0, Math.min(value / altitudeScale, 1))
          return 3.5 + ratio * 3.5
        },
        parameters: { depthTest: true },
        updateTriggers: {
          getWidth: [selectedFlightId, altitudeScale],
          getColor: [VERTICAL_EXAGGERATION],
          getSourcePosition: [VERTICAL_EXAGGERATION],
          getTargetPosition: [VERTICAL_EXAGGERATION],
        },
      }),
    ]
  }, [data, selectedFlightId, altitudeScale])

  const getTooltip = ({ object }: { object?: FlightSegment | null }) => {
    if (!object) return null
    const startTime = object.startTime ?? 'Unknown'
    const endTime = object.endTime ?? 'Unknown'
    const altitudeText = Number.isFinite(object.startAltitudeFeet)
      ? `Altitude: ${new Intl.NumberFormat('en-US').format(object.startAltitudeFeet)} ft`
      : null
    const timeRange = startTime && endTime ? `${startTime} → ${endTime}` : startTime ?? null
    return [object.name, altitudeText, timeRange].filter(Boolean).join('\n')
  }

  if (!data) return <div className="h-full w-full" />

  return (
    <div className="relative h-full w-full">
      <DeckGL
        style={{ position: 'absolute', inset: 0 }}
        controller={{ dragRotate: true, touchRotate: true, inertia: 220, minZoom: 1.5, maxZoom: 12, maxPitch: 85 }}
        parameters={{
          blendColorOperation: 'add',
          blendColorSrcFactor: 'src-alpha',
          blendColorDstFactor: 'one',
          blendAlphaOperation: 'add',
          blendAlphaSrcFactor: 'one-minus-dst-alpha',
          blendAlphaDstFactor: 'one',
        }}
        layers={layers}
        initialViewState={data.INITIAL_VIEW_STATE as unknown as { longitude: number; latitude: number; zoom: number; bearing: number; pitch: number }}
        getTooltip={getTooltip}
        getCursor={({ isDragging, isHovering }: { isDragging: boolean; isHovering: boolean }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab')}
        onClick={({ object }: { object?: FlightSegment | null }) => setSelectedFlightId(object?.flightId ?? null)}
      >
        <Map
          ref={mapRef}
          reuseMaps
          mapLib={maplibregl}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          dragPan={false}
          dragRotate={false}
          scrollZoom={false}
          doubleClickZoom={false}
          keyboard={false}
          touchPitch={false}
          touchZoomRotate={false}
          maxPitch={85}
          onLoad={() => setReady(true)}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-right" visualizePitch showCompass showZoom />
        </Map>
      </DeckGL>
    </div>
  )
}
