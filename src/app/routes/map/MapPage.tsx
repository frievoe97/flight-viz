import DeckGL from '@deck.gl/react'
import Map from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { INITIAL_VIEW_STATE, MAP_STYLE, MAP_INTERACTION } from '@/lib/map/deckConfig'

export default function MapPage() {
  return (
    // Der Wrapper definiert die Fläche
    <div className="relative h-full w-full">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE as any}
        controller={{ dragRotate: false }}
        layers={[]}
        // KEIN className: DeckGL kennt das nicht
        width="100%"
        height="100%"
        // style ist okay, aber hier nicht nötig
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
