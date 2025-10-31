import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LinkProps as SankeyLinkProps } from 'recharts/types/chart/Sankey'
import { cn } from '@/lib/utils'
import { ChartCard, DetailCard } from './Cards'
import type { SankeyDatum } from '../hooks/useStatsPageState'

type OverviewDashboardProps = {
  flightsPerDay: Array<{ date: string; flights: number }>
  altitudeByDistance: Array<{
    bucketStart: number
    bucketEnd: number
    midpoint: number
    altitude: number
    sampleCount: number
  }>
  flightLengthHistogram: Array<{ label: string; flights: number }>
  speedByDay: Array<{ date: string; speed: number }>
  totalFlightTimeByDay: Array<{ date: string; hours: number }>
  topFlights: Array<{ name: string; label: string; distance: number }>
  sankeyData: SankeyDatum
  ignoreSameStartTarget: boolean
  onToggleIgnoreSameStartTarget: () => void
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
const BAR_CURSOR_PURPLE = { fill: 'rgba(168, 85, 247, 0.18)' }
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

export function OverviewDashboard({
  flightsPerDay,
  altitudeByDistance,
  flightLengthHistogram,
  speedByDay,
  totalFlightTimeByDay,
  topFlights,
  sankeyData,
  ignoreSameStartTarget,
  onToggleIgnoreSameStartTarget,
}: OverviewDashboardProps) {
  return (
    <div className="grid flex-1 min-h-0 gap-6 auto-rows-[minmax(260px,1fr)] grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 pb-4">
      <ChartCard
        title="Flights per Day"
        subtitle="Daily mission count across all flights"
        className="min-h-[280px]"
      >
        <BarChart data={flightsPerDay} margin={{ left: -18, right: 12, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
          <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            cursor={BAR_CURSOR}
            formatter={(value: number) => [`${value}`, 'Flights']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="flights" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard
        title="Avg Altitude by Distance"
        subtitle="50 km buckets • Mean altitude for all samples"
        className="min-h-[280px]"
      >
        <LineChart data={altitudeByDistance} margin={{ left: -12, right: 12, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 2" />
          <XAxis
            dataKey="midpoint"
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
              'Average altitude',
            ]}
            labelFormatter={(_, payload) => {
              const record = payload?.[0]?.payload as
                | { bucketStart: number; bucketEnd: number; sampleCount: number }
                | undefined
              if (!record) return ''
              const rangeLabel = `${Math.round(record.bucketStart)}–${Math.round(record.bucketEnd)} km`
              return `${rangeLabel} • ${record.sampleCount} samples`
            }}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Line
            type="monotone"
            dataKey="altitude"
            name="Average altitude"
            stroke="var(--flight-altitude)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartCard>

      <ChartCard
        title="Flight Length Distribution"
        subtitle="Histogram of recorded route lengths"
        className="min-h-[280px]"
      >
        <BarChart data={flightLengthHistogram} margin={{ left: -24, right: 16, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} interval={0} />
          <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            cursor={BAR_CURSOR}
            formatter={(value: number) => [`${value}`, 'Flights']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="flights" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Avg Speed" subtitle="Daily average speed (km/h)" className="min-h-[280px]">
        <LineChart data={speedByDay} margin={{ left: -12, right: 12, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 2" />
          <XAxis dataKey="date" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickFormatter={(value) => `${Math.round(value)} km/h`}
          />
          <Tooltip
            cursor={LINE_CURSOR_SPEED}
            formatter={(value: number) => [`${Math.round(value)} km/h`, 'Average speed']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Line
            type="monotone"
            dataKey="speed"
            stroke="var(--flight-speed)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartCard>

      <ChartCard
        title="Top 10 Longest Flights"
        subtitle="Distance in kilometres"
        className="min-h-[280px]"
      >
        <BarChart data={topFlights} layout="vertical" margin={{ left: 16, right: 24, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickFormatter={(value: number) => `${Math.round(value)} km`}
          />
          <YAxis
            dataKey="label"
            type="category"
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            width={160}
          />
          <Tooltip
            cursor={BAR_CURSOR_PURPLE}
            formatter={(value: number) => [`${Math.round(value).toLocaleString()} km`, 'Distance']}
            labelFormatter={(_value, payload) => payload?.[0]?.payload?.name ?? ''}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="distance" fill="var(--flight-altitude)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard
        title="Total Flight Time per Day"
        subtitle="Aggregated mission hours"
        className="min-h-[280px]"
      >
        <BarChart data={totalFlightTimeByDay} margin={{ left: -18, right: 8, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(1)} h`}
          />
          <Tooltip
            cursor={BAR_CURSOR}
            formatter={(value: number) => [`${value.toFixed(2)} hours`, 'Duration']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="hours" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <DetailCard
        title="Origin vs Destination Countries"
        subtitle="Sankey: top route flows by flight count"
        className="min-h-[320px]"
      >
        <div className="relative flex h-full w-full flex-1">
          <div className="absolute right-2 top-2 z-10" style={{ pointerEvents: 'none' }}>
            <button
              type="button"
              onClick={onToggleIgnoreSameStartTarget}
              className="flex items-center gap-3 rounded-full border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.82)] px-3 py-1.5 text-xs font-medium text-white shadow"
              style={{ pointerEvents: 'auto' }}
              aria-pressed={ignoreSameStartTarget}
            >
              <span className="whitespace-nowrap tracking-wide">Ignore same start/target</span>
              <span
                className={cn(
                  'relative inline-flex h-4 w-8 items-center rounded-full bg-white/15 transition-colors',
                  ignoreSameStartTarget ? 'bg-[var(--flight-speed)]/80' : 'bg-white/15'
                )}
              >
                <span
                  className={cn(
                    'absolute left-0.5 h-3 w-3 rounded-full bg-white transition-transform',
                    ignoreSameStartTarget ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </span>
            </button>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={sankeyData}
              nodePadding={10}
              nodeWidth={12}
              iterations={64}
              margin={{ left: 12, right: 12, top: 16, bottom: 16 }}
              link={(props) => <ColoredSankeyLink {...props} />}
              node={{ fill: 'rgba(15, 23, 42, 0.85)', stroke: 'var(--panel-border)' }}
              style={{ fontSize: '0.7rem' }}
            >
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as any
                  const value = p?.value ?? 0
                  const source = (p?.source?.name || '').replace(' • Origin', '')
                  const target = (p?.target?.name || '').replace(' • Destination', '')

                  if (p?.source && p?.target) {
                    return (
                      <div style={tooltipStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          {value.toLocaleString('de-DE')} flights
                        </div>
                        <div>
                          Start: <strong style={{ color: '#fff' }}>{source || '–'}</strong>
                        </div>
                        <div>
                          Ziel: <strong style={{ color: '#fff' }}>{target || '–'}</strong>
                        </div>
                      </div>
                    )
                  }

                  const nodeName = (p?.name || '')
                    .replace(' • Origin', '')
                    .replace(' • Destination', '')
                  return (
                    <div style={tooltipStyle}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{nodeName}</div>
                      <div>{value.toLocaleString('de-DE')} flights</div>
                    </div>
                  )
                }}
              />
            </Sankey>
          </ResponsiveContainer>
        </div>
      </DetailCard>
    </div>
  )
}

function ColoredSankeyLink(props: SankeyLinkProps & { d?: string }) {
  const { payload, linkWidth, sourceX, sourceY, targetX, targetY, d, ...rest } = props as any

  const color = (payload as { color?: string })?.color ?? 'var(--flight-speed)'

  const curvature = 0.5
  const dx = (targetX - sourceX) * curvature
  const path =
    d ??
    `M${sourceX},${sourceY} C${sourceX + dx},${sourceY} ${targetX - dx},${targetY} ${targetX},${targetY}`

  const width = Math.max(linkWidth ?? 1, 1)

  return (
    <path
      {...rest}
      d={path}
      stroke={color}
      fill={color}
      strokeWidth={width}
      fillOpacity={0.9}
      strokeOpacity={0.95}
    />
  )
}

export type { OverviewDashboardProps }
