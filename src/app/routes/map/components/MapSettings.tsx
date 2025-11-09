import { Layers, Pause, Play, SlidersHorizontal } from 'lucide-react'
import OverlayPicker from './OverlayPicker'
import type { OverlayId } from '../overlays/options'

type MapSettingsProps = {
  settingsOpen: boolean
  layersOpen: boolean
  onToggleSettings: () => void
  onToggleLayers: () => void
  activeOverlay: OverlayId
  onOverlaySelect: (id: OverlayId) => void
  isFlights: boolean
  isTrails: boolean
  isSegments: boolean
  isAnalytics: boolean
  isRoutes: boolean
  isAirports: boolean
  // retained flags (no-op) for backwards compatibility
  isSpeedColumns: boolean
  isClimbBursts: boolean
  isMotionPaused: boolean
  flightSpeedMultiplier: number
  onFlightSpeedChange: (value: number) => void
  planeSizeScale: number
  onPlaneSizeChange: (value: number) => void
  trailSpeedMultiplier: number
  onTrailSpeedChange: (value: number) => void
  trailLengthSeconds: number
  onTrailLengthChange: (value: number) => void
  trailWidthScale: number
  onTrailWidthChange: (value: number) => void
  trailOpacity: number
  onTrailOpacityChange: (value: number) => void
  segmentWidthScale: number
  onSegmentWidthChange: (value: number) => void
  routeWidthScale: number
  onRouteWidthChange: (value: number) => void
  routeHeight: number
  onRouteHeightChange: (value: number) => void
  routeOpacity: number
  onRouteOpacityChange: (value: number) => void
  routeAnimate: boolean
  onRouteAnimateChange: (value: boolean) => void
  airportSizeScale: number
  onAirportSizeChange: (value: number) => void
  airportOpacity: number
  onAirportOpacityChange: (value: number) => void
  analyticsRadius: number
  onAnalyticsRadiusChange: (value: number) => void
  analyticsElevationScale: number
  onAnalyticsElevationScaleChange: (value: number) => void
  analyticsOpacity: number
  onAnalyticsOpacityChange: (value: number) => void
  analyticsMetric: 'alt' | 'speed' | 'count'
  onAnalyticsMetricChange: (metric: 'alt' | 'speed' | 'count') => void
  onToggleMotionPaused: () => void
}

const controlCardClass =
  'w-full rounded-md border px-3 py-2 text-xs space-y-2 shadow backdrop-blur-sm'

export function MapSettings({
  settingsOpen,
  layersOpen,
  onToggleSettings,
  onToggleLayers,
  activeOverlay,
  onOverlaySelect,
  isFlights,
  isTrails,
  isSegments,
  isAnalytics,
  isRoutes,
  isAirports,
  isSpeedColumns: _isSpeedColumns,
  isClimbBursts: _isClimbBursts,
  isMotionPaused,
  flightSpeedMultiplier,
  onFlightSpeedChange,
  planeSizeScale,
  onPlaneSizeChange,
  trailSpeedMultiplier,
  onTrailSpeedChange,
  trailLengthSeconds,
  onTrailLengthChange,
  trailWidthScale,
  onTrailWidthChange,
  trailOpacity,
  onTrailOpacityChange,
  segmentWidthScale,
  onSegmentWidthChange,
  routeWidthScale,
  onRouteWidthChange,
  // routeHeight,
  // onRouteHeightChange,
  routeOpacity,
  onRouteOpacityChange,
  routeAnimate,
  onRouteAnimateChange,
  airportSizeScale,
  onAirportSizeChange,
  airportOpacity,
  onAirportOpacityChange,
  analyticsRadius,
  onAnalyticsRadiusChange,
  analyticsElevationScale,
  onAnalyticsElevationScaleChange,
  analyticsOpacity,
  onAnalyticsOpacityChange,
  analyticsMetric,
  onAnalyticsMetricChange,
  onToggleMotionPaused,
}: MapSettingsProps) {
  const motionButtonLabel = isMotionPaused ? 'Animationen fortsetzen' : 'Animationen pausieren'

  return (
    <div className="flex flex-col items-end gap-2">
      {layersOpen ? (
        <div
          className="w-64 space-y-3 rounded-lg border p-3 text-sm shadow-lg backdrop-blur-md"
          style={{
            borderColor: 'var(--panel-border)',
            backgroundColor: 'var(--panel-bg)',
            color: 'var(--controls-fg)',
          }}
        >
          <OverlayPicker active={activeOverlay} onSelect={onOverlaySelect} />
        </div>
      ) : null}

      {settingsOpen ? (
        <div
          className="w-64 space-y-3 rounded-lg border p-3 text-sm shadow-lg backdrop-blur-md"
          style={{
            borderColor: 'var(--panel-border)',
            backgroundColor: 'var(--panel-bg)',
            color: 'var(--controls-fg)',
          }}
        >
          {isFlights ? (
            <div
              className={controlCardClass}
              style={{
                borderColor: 'var(--panel-border)',
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--controls-fg)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Flight speed
                </span>
                <span>{flightSpeedMultiplier.toFixed(1)}x</span>
              </div>
              <input
                className="w-full accent-[var(--flight-speed)]"
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={flightSpeedMultiplier}
                onChange={(event) => onFlightSpeedChange(Number(event.target.value))}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Plane size
                </span>
                <span>{planeSizeScale.toFixed(1)}x</span>
              </div>
              <input
                className="w-full accent-[var(--flight-altitude)]"
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={planeSizeScale}
                onChange={(event) => onPlaneSizeChange(Number(event.target.value))}
              />
            </div>
          ) : null}

          {isTrails ? (
            <>
              <div
                className={controlCardClass}
                style={{
                  borderColor: 'var(--panel-border)',
                  backgroundColor: 'var(--panel-bg)',
                  color: 'var(--controls-fg)',
                }}
              >
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
                  max={2}
                  step={0.1}
                  value={trailSpeedMultiplier}
                  onChange={(event) => onTrailSpeedChange(Number(event.target.value))}
                />
              </div>
              <div
                className={controlCardClass}
                style={{
                  borderColor: 'var(--panel-border)',
                  backgroundColor: 'var(--panel-bg)',
                  color: 'var(--controls-fg)',
                }}
              >
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
              <div
                className={controlCardClass}
                style={{
                  borderColor: 'var(--panel-border)',
                  backgroundColor: 'var(--panel-bg)',
                  color: 'var(--controls-fg)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                    Trail width
                  </span>
                  <span>{trailWidthScale.toFixed(1)}x</span>
                </div>
                <input
                  className="w-full accent-[var(--flight-speed)]"
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={trailWidthScale}
                  onChange={(event) => onTrailWidthChange(Number(event.target.value))}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                    Opacity
                  </span>
                  <span>{Math.round(trailOpacity * 100)}%</span>
                </div>
                <input
                  className="w-full accent-[var(--flight-altitude)]"
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={trailOpacity}
                  onChange={(event) => onTrailOpacityChange(Number(event.target.value))}
                />
              </div>
            </>
          ) : null}

          {isSegments ? (
            <div
              className={controlCardClass}
              style={{
                borderColor: 'var(--panel-border)',
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--controls-fg)',
              }}
            >
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

          {isRoutes ? (
            <div
              className={controlCardClass}
              style={{
                borderColor: 'var(--panel-border)',
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--controls-fg)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Route width
                </span>
                <span>{routeWidthScale.toFixed(1)}x</span>
              </div>
              <input
                className="w-full accent-[var(--flight-speed)]"
                type="range"
                min={0.1}
                max={2}
                step={0.1}
                value={routeWidthScale}
                onChange={(event) => onRouteWidthChange(Number(event.target.value))}
              />
              <label className="mt-2 flex items-center gap-2 text-[0.8rem]">
                <input
                  type="checkbox"
                  checked={routeAnimate}
                  onChange={(e) => onRouteAnimateChange(e.target.checked)}
                />
                <span className="uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Animate
                </span>
              </label>
              {/* <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Route height
                </span>
                <span>{routeHeight.toFixed(2)}</span>
              </div>
              <input
                className="w-full accent-[var(--flight-altitude)]"
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={routeHeight}
                onChange={(event) => onRouteHeightChange(Number(event.target.value))}
              /> */}
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Opacity
                </span>
                <span>{Math.round(routeOpacity * 100)}%</span>
              </div>
              <input
                className="w-full accent-[var(--flight-altitude)]"
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={routeOpacity}
                onChange={(event) => onRouteOpacityChange(Number(event.target.value))}
              />
            </div>
          ) : null}

          {isAirports ? (
            <div
              className={controlCardClass}
              style={{
                borderColor: 'var(--panel-border)',
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--controls-fg)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Hub size
                </span>
                <span>{airportSizeScale.toFixed(1)}x</span>
              </div>
              <input
                className="w-full accent-[var(--flight-speed)]"
                type="range"
                min={0.6}
                max={2.4}
                step={0.1}
                value={airportSizeScale}
                onChange={(event) => onAirportSizeChange(Number(event.target.value))}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Opacity
                </span>
                <span>{Math.round(airportOpacity * 100)}%</span>
              </div>
              <input
                className="w-full accent-[var(--flight-altitude)]"
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={airportOpacity}
                onChange={(event) => onAirportOpacityChange(Number(event.target.value))}
              />
            </div>
          ) : null}

          {/* speed columns / climb bursts removed */}

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
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Hex height
                </span>
                <span>{analyticsElevationScale.toFixed(0)}</span>
              </div>
              <input
                className="w-full accent-[var(--flight-altitude)]"
                type="range"
                min={5}
                max={80}
                step={1}
                value={analyticsElevationScale}
                onChange={(event) => onAnalyticsElevationScaleChange(Number(event.target.value))}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-[0.7rem] text-[hsl(var(--muted-foreground))]">
                  Opacity
                </span>
                <span>{Math.round(analyticsOpacity * 100)}%</span>
              </div>
              <input
                className="w-full accent-[var(--flight-altitude)]"
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={analyticsOpacity}
                onChange={(event) => onAnalyticsOpacityChange(Number(event.target.value))}
              />
              <label className="block text-[0.7rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Metric
              </label>
              <select
                className="w-full rounded-md border border-[color:var(--panel-border)] bg-transparent px-2 py-1 text-sm"
                style={{ color: 'var(--controls-fg)' }}
                value={analyticsMetric}
                onChange={(e) =>
                  onAnalyticsMetricChange(e.target.value as 'alt' | 'speed' | 'count')
                }
              >
                <option value="alt">Avg altitude</option>
                <option value="speed">Avg speed</option>
                <option value="count">Count (unique flights)</option>
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="controls-btn rounded-full p-2"
          style={{
            backgroundColor: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
            boxShadow: 'var(--controls-shadow)',
          }}
          onClick={onToggleMotionPaused}
          aria-pressed={isMotionPaused}
          aria-label={motionButtonLabel}
          title={motionButtonLabel}
        >
          {isMotionPaused ? (
            <Play className="h-5 w-5" aria-hidden />
          ) : (
            <Pause className="h-5 w-5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          className="controls-btn rounded-full p-2"
          style={{
            backgroundColor: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
            boxShadow: 'var(--controls-shadow)',
          }}
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          aria-label={settingsOpen ? 'Kartenoptionen schließen' : 'Kartenoptionen öffnen'}
          title="Kartenoptionen"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
        </button>

        <button
          type="button"
          className="controls-btn rounded-full p-2"
          style={{
            backgroundColor: 'var(--panel-bg)',
            borderColor: 'var(--panel-border)',
            boxShadow: 'var(--controls-shadow)',
          }}
          onClick={onToggleLayers}
          aria-expanded={layersOpen}
          aria-label={layersOpen ? 'Layerauswahl schließen' : 'Layerauswahl öffnen'}
          title="Layerauswahl"
        >
          <Layers className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export default MapSettings
