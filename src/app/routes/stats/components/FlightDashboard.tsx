import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDuration } from '../lib/utils'
import { ChartCard, DetailCard } from './Cards'
import type { SelectedFlightStats } from '../hooks/useStatsPageState'

type SeriesPoint = {
  distance: number
  altitude: number | null
  speed: number | null
  verticalRate: number | null
  timeMinutes: number
}

type HistogramEntry = { label: string; samples: number }

type FlightDashboardProps = {
  nf0: Intl.NumberFormat
  flightAnimationKey: number
  selectedFlightStats: SelectedFlightStats | null
  selectedFlightAltitudeSeries: SeriesPoint[]
  selectedFlightSpeedSeries: SeriesPoint[]
  selectedFlightVerticalSeries: SeriesPoint[]
  selectedFlightAltitudeHistogram: HistogramEntry[]
  selectedFlightSpeedHistogram: HistogramEntry[]
}

const tooltipStyle = {
  backgroundColor: 'rgba(17, 24, 39, 0.88)',
  border: '1px solid var(--panel-border)',
  borderRadius: '0.75rem',
  color: '#fff',
  padding: '0.5rem 0.75rem',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.35)',
}

const tooltipLabelStyle = { color: 'var(--chart-axis)' }

const BAR_CURSOR = { fill: 'rgba(56, 189, 248, 0.18)' }
const LINE_CURSOR_SPEED = {
  stroke: 'rgba(56, 189, 248, 0.5)',
  strokeWidth: 1,
  strokeDasharray: '4 3',
}
const LINE_CURSOR_ALTITUDE = {
  stroke: 'rgba(168, 85, 247, 0.45)',
  strokeWidth: 1,
  strokeDasharray: '4 3',
}

export function FlightDashboard({
  nf0,
  flightAnimationKey,
  selectedFlightStats,
  selectedFlightAltitudeSeries,
  selectedFlightSpeedSeries,
  selectedFlightVerticalSeries,
  selectedFlightAltitudeHistogram,
  selectedFlightSpeedHistogram,
}: FlightDashboardProps) {
  const flightAnimationStyle = useMemo(
    () => ({ animation: 'stats-fade-in 320ms ease', animationFillMode: 'both' }),
    [flightAnimationKey]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex-1 min-h-0 overflow-y-auto pb-6 pr-1">
        <div
          key={flightAnimationKey}
          className="grid min-h-0 gap-6 auto-rows-[minmax(260px,1fr)] grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 pb-2"
        >
          <DetailCard
            title="Flight data"
            subtitle={
              selectedFlightStats
                ? `${selectedFlightStats.originLabel} → ${selectedFlightStats.destinationLabel}`
                : 'Select a flight to view analytics'
            }
            className="min-h-[280px]"
            style={flightAnimationStyle}
          >
            {selectedFlightStats ? (
              <div className="flex flex-1 flex-col justify-between gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide opacity-60">Countries</div>
                  <div className="text-sm opacity-80">
                    {selectedFlightStats.originCountry} → {selectedFlightStats.destinationCountry}
                  </div>
                  {selectedFlightStats.departureLabel ? (
                    <div className="text-xs opacity-60">{selectedFlightStats.departureLabel}</div>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <StatItem
                    label="Distance"
                    value={
                      selectedFlightStats.distanceKm != null
                        ? `${nf0.format(Math.round(selectedFlightStats.distanceKm))} km`
                        : '–'
                    }
                  />
                  <StatItem
                    label="Dauer"
                    value={formatDuration(selectedFlightStats.durationSeconds)}
                  />
                  <StatItem
                    label="Avg. speed"
                    value={
                      selectedFlightStats.avgSpeed != null
                        ? `${nf0.format(Math.round(selectedFlightStats.avgSpeed))} km/h`
                        : '–'
                    }
                  />
                  <StatItem
                    label="Avg. altitude"
                    value={
                      selectedFlightStats.avgAltitude != null
                        ? `${nf0.format(Math.round(selectedFlightStats.avgAltitude))} ft`
                        : '–'
                    }
                  />
                  <StatItem
                    label="Maximum altitude"
                    value={
                      selectedFlightStats.maxAltitude != null
                        ? `${nf0.format(Math.round(selectedFlightStats.maxAltitude))} ft`
                        : '–'
                    }
                  />
                  <StatItem label="Samples" value={nf0.format(selectedFlightStats.pointCount)} />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm opacity-60">
                No flight selected
              </div>
            )}
          </DetailCard>

          <ChartCard
            title="Altitude profile"
            subtitle="Altitude in ft vs. distance in km"
            className="min-h-[280px]"
            style={flightAnimationStyle}
          >
            {selectedFlightAltitudeSeries.length ? (
              <AreaChart
                data={selectedFlightAltitudeSeries}
                margin={{ left: -12, right: 12, top: 12, bottom: 12 }}
              >
                <defs>
                  <linearGradient id="selected-flight-altitude" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--flight-altitude)" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="var(--flight-altitude)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 2" />
                <XAxis
                  dataKey="distance"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                  tickFormatter={(value: number) => `${Math.round(value)} km`}
                />
                <YAxis
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                  tickFormatter={(value: number) => `${Math.round(value / 1000)}k ft`}
                />
                <Tooltip
                  cursor={LINE_CURSOR_ALTITUDE}
                  formatter={(value: number) => [
                    `${Math.round(value).toLocaleString()} ft`,
                    'Altitude',
                  ]}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  labelFormatter={(value: number) => `${Math.round(value)} km`}
                />
                <Area
                  type="monotone"
                  dataKey="altitude"
                  name="Altitude"
                  stroke="var(--flight-altitude)"
                  strokeWidth={2}
                  fill="url(#selected-flight-altitude)"
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <EmptyState message="No altitude profile for this flight" />
            )}
          </ChartCard>

          <ChartCard
            title="Speed profile"
            subtitle="Speed in km/h along the route"
            className="min-h-[280px]"
            style={flightAnimationStyle}
          >
            {selectedFlightSpeedSeries.length ? (
              <LineChart
                data={selectedFlightSpeedSeries}
                margin={{ left: -12, right: 12, top: 12, bottom: 12 }}
              >
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 2" />
                <XAxis
                  dataKey="distance"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                  tickFormatter={(value: number) => `${Math.round(value)} km`}
                />
                <YAxis
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                  tickFormatter={(value: number) => `${Math.round(value)} km/h`}
                />
                <Tooltip
                  cursor={LINE_CURSOR_SPEED}
                  formatter={(value: number) => [`${Math.round(value)} km/h`, 'Speed']}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  labelFormatter={(value: number) => `${Math.round(value)} km`}
                />
                <Line
                  type="monotone"
                  dataKey="speed"
                  name="Speed"
                  stroke="var(--flight-speed)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            ) : (
              <EmptyState message="No speed values for this flight" />
            )}
          </ChartCard>

          <ChartCard
            title="Vertical speed"
            subtitle="Climb/descent rate in ft/min over time"
            className="min-h-[280px]"
            style={flightAnimationStyle}
          >
            {selectedFlightVerticalSeries.length ? (
              <LineChart
                data={selectedFlightVerticalSeries}
                margin={{ left: -12, right: 12, top: 12, bottom: 12 }}
              >
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 2" />
                <XAxis
                  dataKey="timeMinutes"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                  tickFormatter={(value: number) => `${Math.round(value)} min`}
                />
                <YAxis
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                  tickFormatter={(value: number) => `${Math.round(value)} ft/min`}
                />
                <Tooltip
                  cursor={LINE_CURSOR_ALTITUDE}
                  formatter={(value: number) => [
                    `${Math.round(value)} ft/min`,
                    'Vertikalgeschwindigkeit',
                  ]}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  labelFormatter={(value: number) => `${Math.round(value)} min`}
                />
                <Line
                  type="monotone"
                  dataKey="verticalRate"
                  name="Vertikalgeschwindigkeit"
                  stroke="var(--flight-altitude)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            ) : (
              <EmptyState message="No vertical speed for this flight" />
            )}
          </ChartCard>

          <ChartCard
            title="Altitude distribution"
            subtitle="Samples per altitude band"
            className="min-h-[280px]"
            style={flightAnimationStyle}
          >
            {selectedFlightAltitudeHistogram.length ? (
              <BarChart
                data={selectedFlightAltitudeHistogram}
                margin={{ left: -18, right: 12, top: 12, bottom: 12 }}
              >
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  interval={0}
                />
                <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  cursor={BAR_CURSOR}
                  formatter={(value: number) => [`${value}`, 'Stichproben']}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Bar dataKey="samples" fill="var(--flight-altitude)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <EmptyState message="No altitude values available" />
            )}
          </ChartCard>

          <ChartCard
            title="Geschwindigkeitsverteilung"
            subtitle="Stichproben pro Geschwindigkeitsband"
            className="min-h-[280px]"
            style={flightAnimationStyle}
          >
            {selectedFlightSpeedHistogram.length ? (
              <BarChart
                data={selectedFlightSpeedHistogram}
                margin={{ left: -18, right: 12, top: 12, bottom: 12 }}
              >
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  interval={0}
                />
                <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  cursor={BAR_CURSOR}
                  formatter={(value: number) => [`${value}`, 'Stichproben']}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Bar dataKey="samples" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <EmptyState message="Keine Geschwindigkeitswerte vorhanden" />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-wide opacity-60">{label}</div>
      <div className="text-sm font-medium opacity-90">{value}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm opacity-60">
      {message}
    </div>
  )
}
