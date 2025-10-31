import FlightChart from '../FlightChart'
import type { Flight } from '@/data'
import InfoRow from './InfoRow'

type ChartDatum = {
  distanceKm: number
  altitudeFt: number | null
  speedKts: number | null
}

type FlightDetailsPanelProps = {
  flight: Flight
  chartData: ChartDatum[]
  formatKm: (value?: number | null, precise?: boolean) => string
  formatFt: (value?: number | null) => string
  formatDuration: (value?: number | null) => string
  onClear: () => void
}

export function FlightDetailsPanel({
  flight,
  chartData,
  formatKm,
  formatFt,
  formatDuration,
  onClear,
}: FlightDetailsPanelProps) {
  return (
    <div
      className="border-t p-4"
      style={{
        backgroundColor: 'var(--map-land)',
        color: '#ffffff',
        borderColor: 'var(--panel-border)',
      }}
    >
      <div className="grid h-full gap-4" style={{ gridTemplateColumns: '18rem 1fr' }}>
        <div
          className="space-y-3 rounded-md border px-3 py-3 text-xs"
          style={{ borderColor: 'var(--panel-border)', backgroundColor: 'var(--panel-bg)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Selected flight
              </div>
              <div className="text-sm font-semibold text-white">{flight.name}</div>
            </div>
            <button
              type="button"
              className="controls-btn rounded-md px-2 py-1 text-[0.65rem]"
              onClick={onClear}
            >
              Clear
            </button>
          </div>

          <div className="space-y-2">
            <InfoRow label="Distance" value={formatKm(flight.distanceKm, true)} />
            <InfoRow label="Duration" value={formatDuration(flight.durationSeconds)} />
            <InfoRow label="Avg altitude" value={formatFt(flight.altitudeStats?.avg)} />
            <InfoRow
              label="Altitude range"
              value={`${formatFt(flight.altitudeStats?.min)} – ${formatFt(flight.altitudeStats?.max)}`}
            />
          </div>
        </div>

        <div className="rounded-md border" style={{ borderColor: 'var(--panel-border)' }}>
          <FlightChart data={chartData} />
        </div>
      </div>
    </div>
  )
}

export default FlightDetailsPanel
