import type { MapProps } from '@vis.gl/react-maplibre'

export const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json'

export const INITIAL_VIEW_STATE: MapProps['initialViewState'] = {
  latitude: 0,
  longitude: 0,
  zoom: 2,
  bearing: 0,
  pitch: 0,
}

export const MAP_INTERACTION: Partial<MapProps> = {
  dragRotate: false,
  touchZoomRotate: false,
}
