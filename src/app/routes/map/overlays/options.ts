export const overlayOptions = [
  { id: 'segments', label: '3D Tracks', description: 'Segmented flight paths with stats' },
  { id: 'flights', label: 'Live Flights', description: 'Animated aircraft positions' },
  { id: 'trails', label: 'Altitude Trails', description: 'Fading height history' },
  { id: 'analytics', label: 'Hex Heatmap', description: 'Altitude or density analysis' },
  { id: 'routes', label: 'Route Arcs', description: 'Great-circle links origin -> destination' },
  { id: 'airports', label: 'Airport Hubs', description: 'Traffic bubbles per airport' },
  { id: 'speed-columns', label: 'Speed Towers', description: 'Extruded hotspots by cruise speed' },
  {
    id: 'climb-bursts',
    label: 'Climb Bursts',
    description: 'Highlights aggressive climb/descent moments',
  },
] as const

export type OverlayId = (typeof overlayOptions)[number]['id']
