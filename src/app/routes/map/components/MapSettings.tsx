import { SlidersHorizontal } from 'lucide-react'
import OverlayPicker from './OverlayPicker'
import type { OverlayId } from '../overlays/options'

type MapSettingsProps = {
  open: boolean
  onToggle: () => void
  activeOverlay: OverlayId
  onOverlaySelect: (id: OverlayId) => void
  isFlights: boolean
  isTrails: boolean
  isSegments: boolean
  isAnalytics: boolean
  flightSpeedMultiplier: number
  onFlightSpeedChange: (value: number) => void
  trailSpeedMultiplier: number
  onTrailSpeedChange: (value: number) => void
  trailLengthSeconds: number
  onTrailLengthChange: (value: number) => void
  segmentWidthScale: number
  onSegmentWidthChange: (value: number) => void
  analyticsRadius: number
  onAnalyticsRadiusChange: (value: number) => void
  analyticsMetric: 'alt' | 'count'
  onAnalyticsMetricToggle: () => void
}

const controlCardClass =
  'w-full rounded-md border bg-[var(--panel-bg)]/85 px-3 py-2 text-xs text-white space-y-2 shadow backdrop-blur-sm'

export function MapSettings({
  open,
  onToggle,
  activeOverlay,
  onOverlaySelect,
  isFlights,
  isTrails,
  isSegments,
  isAnalytics,
  flightSpeedMultiplier,
  onFlightSpeedChange,
  trailSpeedMultiplier,
  onTrailSpeedChange,
  trailLengthSeconds,
  onTrailLengthChange,
  segmentWidthScale,
  onSegmentWidthChange,
  analyticsRadius,
  onAnalyticsRadiusChange,
  analyticsMetric,
  onAnalyticsMetricToggle,
}: MapSettingsProps) {
  return (
    <div className="flex flex-col items-end gap-2">
      {open ? (
        <div
          className="w-64 space-y-3 rounded-lg border bg-[#0f172a]/92 p-3 text-sm text-white shadow-lg backdrop-blur-md"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <OverlayPicker active={activeOverlay} onSelect={onOverlaySelect} />

          {isFlights ? (
            <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Flight speed
                </span>
                <span>{flightSpeedMultiplier.toFixed(0)}x</span>
              </div>
              <input
                className="w-full accent-[var(--flight-speed)]"
                type="range"
                min={10}
                max={30}
                step={1}
                value={flightSpeedMultiplier}
                onChange={(event) => onFlightSpeedChange(Number(event.target.value))}
              />
            </div>
          ) : null}

          {isTrails ? (
            <>
              <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                    Trail speed
                  </span>
                  <span>{trailSpeedMultiplier.toFixed(1)}x</span>
                </div>
                <input
                  className="w-full accent-[var(--flight-speed)]"
                  type="range"
                  min={0.2}
                  max={4}
                  step={0.1}
                  value={trailSpeedMultiplier}
                  onChange={(event) => onTrailSpeedChange(Number(event.target.value))}
                />
              </div>
              <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                    Trail length
                  </span>
                  <span>{Math.round(trailLengthSeconds)}s</span>
                </div>
                <input
                  className="w-full accent-[var(--flight-altitude)]"
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={trailLengthSeconds}
                  onChange={(event) => onTrailLengthChange(Number(event.target.value))}
                />
              </div>
            </>
          ) : null}

          {isSegments ? (
            <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Path width
                </span>
                <span>{segmentWidthScale.toFixed(1)}x</span>
              </div>
              <input
                className="w-full accent-[var(--flight-speed)]"
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={segmentWidthScale}
                onChange={(event) => onSegmentWidthChange(Number(event.target.value))}
              />
            </div>
          ) : null}

          {isAnalytics ? (
            <div className={controlCardClass} style={{ borderColor: 'var(--panel-border)' }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Hex radius
                </span>
                <span>{Math.round(analyticsRadius / 1000)} km</span>
              </div>
              <input
                className="w-full accent-[var(--flight-speed)]"
                type="range"
                min={5000}
                max={50000}
                step={1000}
                value={analyticsRadius}
                onChange={(event) => onAnalyticsRadiusChange(Number(event.target.value))}
              />
              <button
                type="button"
                className="controls-btn rounded-md px-3 py-1 text-xs"
                onClick={onAnalyticsMetricToggle}
              >
                Metric: {analyticsMetric === 'alt' ? 'Avg altitude' : 'Count'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className="controls-btn rounded-full p-2 text-white [box-shadow:rgba(15,23,42,0.45)_0px_6px_18px]"
        style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Kartenoptionen schließen' : 'Kartenoptionen öffnen'}
        title="Kartenoptionen"
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden />
      </button>
    </div>
  )
}

export default MapSettings
