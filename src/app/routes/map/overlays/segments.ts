import { useMemo } from 'react'
import { LineLayer } from '@deck.gl/layers'
import type { Flight, FlightSegment } from '@/data'
import { alpha, colors, lerpColor } from '@/lib/theme/tokens'

const FEET_TO_METERS = 0.3048
const VERTICAL_EXAGGERATION = 1

export function useSegmentsLayer({
  segments,
  isActive,
  selectedFlightId,
  hoveredFlightId,
  altitudeScale,
}: {
  segments: FlightSegment[]
  isActive: boolean
  selectedFlightId: string | null
  hoveredFlightId: string | null
  altitudeScale: number
}) {
  return useMemo(() => {
    if (!isActive) return null
    return new LineLayer<FlightSegment>({
      id: 'flight-segments',
      data: segments,
      pickable: true,
      autoHighlight: false,
      widthUnits: 'pixels',
      opacity: 1,
      getSourcePosition: (d) => {
        const zFt = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
        const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
        return [d.start[0], d.start[1], z]
      },
      getTargetPosition: (d) => {
        const zFt = Number.isFinite(d.endAltitudeFeet)
          ? d.endAltitudeFeet
          : (d.startAltitudeFeet ?? 0)
        const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
        return [d.end[0], d.end[1], z]
      },
      getColor: (d) => {
        const zFt = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
        const z = zFt * FEET_TO_METERS * VERTICAL_EXAGGERATION
        const ratio = Math.max(0, Math.min(z / 10000, 1))
        const base = lerpColor(colors.flight.low, colors.flight.high, ratio) as [
          number,
          number,
          number
        ]
        let a: number
        if (selectedFlightId) {
          a = d.flightId === selectedFlightId ? alpha.opaque : alpha.faded
        } else if (hoveredFlightId) {
          a = d.flightId === hoveredFlightId ? alpha.opaque : Math.round(255 * (1 - 0.8 * ratio))
        } else {
          a = Math.round(255 * (1 - 0.8 * ratio))
        }
        return [base[0], base[1], base[2], a]
      },
      getWidth: (d) => {
        if (d.flightId === selectedFlightId) return 6
        const value = Number.isFinite(d.startAltitudeFeet) ? d.startAltitudeFeet : 0
        const ratio = Math.max(0, Math.min(value / altitudeScale, 1))
        return 3.5 + ratio * 3.5
      },
      updateTriggers: {
        getWidth: [selectedFlightId, altitudeScale],
        getColor: [selectedFlightId, hoveredFlightId, altitudeScale],
      },
    })
  }, [segments, isActive, selectedFlightId, hoveredFlightId, altitudeScale])
}

export function findSelectedFlight(
  flights: Flight[] | undefined,
  selectedFlightId: string | null
) {
  if (!flights || !selectedFlightId) return null
  return flights.find((f) => f.id === selectedFlightId) ?? null
}

