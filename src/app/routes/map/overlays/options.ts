export const overlayOptions = [
  { id: 'segments', label: 'Flight Segments', description: '3D paths with per-flight stats' },
  { id: 'flights', label: 'Animated Aircraft', description: 'Interpolated aircraft positions' },
  { id: 'trails', label: 'Trails', description: 'Altitude trails with fading history' },
  { id: 'analytics', label: 'Density', description: 'Hexagonal aggregation by altitude or count' },
] as const

export type OverlayId = (typeof overlayOptions)[number]['id']

