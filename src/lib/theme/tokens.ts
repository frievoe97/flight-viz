export type RGB = [number, number, number]

// Global palette for maps and plots
export const colors = {
  // Map base (CSS still defines water/land)
  map: {
    water: '#2c353c',
    land: '#0e0e0e',
    panelBorder: '#39424a',
  },
  // Flight line gradient (low→high)
  flight: {
    low: [239, 68, 68] as RGB, // red   #ef4444
    high: [96, 165, 250] as RGB, // blue  #60a5fa
  },
  // Charts
  chart: {
    altitude: '#ef4444', // red, align with flight.highlights
    speed: '#60a5fa', // blue
    axis: 'var(--chart-axis)',
    grid: 'var(--chart-grid)',
  },
}

export const alpha = {
  opaque: 255,
  default: Math.round(0.8 * 255),
  faded: Math.round(0.3 * 255),
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  const tt = Math.max(0, Math.min(t, 1))
  return [
    Math.round(lerp(a[0], b[0], tt)),
    Math.round(lerp(a[1], b[1], tt)),
    Math.round(lerp(a[2], b[2], tt)),
  ]
}
