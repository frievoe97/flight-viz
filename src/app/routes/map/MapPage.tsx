import DeckGL from '@deck.gl/react'
import Map from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { INITIAL_VIEW_STATE, MAP_STYLE, MAP_INTERACTION } from '@/lib/map/deckConfig'

export default function MapPage() {
  return (
    <div className="h-full w-full">
      <DeckGL
        initialViewState={
          INITIAL_VIEW_STATE as unknown as {
            longitude: number
            latitude: number
            zoom: number
            bearing: number
            pitch: number
          }
        }
        controller={{ dragRotate: false }}
        layers={[]}
        style={{ position: 'relative', width: '100%', height: '100%' }}
      >
        <Map
          reuseMaps
          mapStyle={MAP_STYLE}
          initialViewState={INITIAL_VIEW_STATE}
          {...MAP_INTERACTION}
          style={{ width: '100%', height: '100%' }}
        />
      </DeckGL>
    </div>
  )
}
