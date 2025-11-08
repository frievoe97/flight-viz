import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Sankey,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import type { LinkProps as SankeyLinkProps } from 'recharts/types/chart/Sankey'
import { cn } from '@/lib/utils'
import { computeYAxisWidth, smartMargins } from '../lib/utils.ts'
import { ChartCard, DetailCard } from './Cards'
import type { SankeyDatum } from '../hooks/useStatsPageState'

// --------------------------------------------
// Types
// --------------------------------------------
export type OverviewDashboardProps = {
  flightsPerDay: Array<{ date: string; flights: number }>
  flightLengthHistogram: Array<{ label: string; flights: number }>
  speedByDay: Array<{ date: string; speed: number }>
  totalFlightTimeByDay: Array<{ date: string; hours: number }>
  topFlights: Array<{ name: string; label: string; distance: number }>
  sankeyData: SankeyDatum
  ignoreSameStartTarget: boolean
  onToggleIgnoreSameStartTarget: () => void
  flightsByHour: Array<{ label: string; flights: number }>
  flightsByWeekday: Array<{ label: string; flights: number }>
  durationHistogram: Array<{ label: string; flights: number }>
  distanceDurationPoints: Array<{ name: string; distance: number; hours: number }>
  topOrigins: Array<{ value: string; label: string; flights: number }>
  topDestinations: Array<{ value: string; label: string; flights: number }>
  topAircraftTypes: Array<{ label: string; flights: number }>
}

// --------------------------------------------
// Shared styles
// --------------------------------------------
const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'rgba(17, 24, 39, 0.88)',
  border: '1px solid var(--panel-border)',
  borderRadius: '0.75rem',
  color: '#fff',
  padding: '0.5rem 0.75rem',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.35)',
}
const tooltipLabelStyle: React.CSSProperties = { color: 'var(--chart-axis)' }

const BAR_CURSOR = { fill: 'rgba(56, 189, 248, 0.18)' }
const BAR_CURSOR_PURPLE = { fill: 'rgba(168, 85, 247, 0.18)' }
const LINE_CURSOR_SPEED = {
  stroke: 'rgba(56, 189, 248, 0.5)',
  strokeWidth: 1,
  strokeDasharray: '4 3',
}

// --------------------------------------------
// Helpers
// --------------------------------------------
function abbreviateType(label: string) {
  const noParen = label.replace(/\s*\(.*?\)\s*/g, '').trim()
  const max = 18
  return noParen.length > max ? `${noParen.slice(0, max)}…` : noParen
}

// --------------------------------------------
// Component
// --------------------------------------------
export function OverviewDashboard({
  flightsPerDay,
  flightLengthHistogram,
  speedByDay,
  totalFlightTimeByDay,
  topFlights,
  sankeyData,
  ignoreSameStartTarget,
  onToggleIgnoreSameStartTarget,
  flightsByHour,
  flightsByWeekday,
  durationHistogram,
  distanceDurationPoints,
  topOrigins,
  topDestinations,
  topAircraftTypes,
}: OverviewDashboardProps) {
  return (
    <div className="grid flex-1 min-h-0 gap-6 auto-rows-[minmax(260px,1fr)] grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 pb-4">
      {/* Flights per day */}
      <ChartCard
        title="Flights per day"
        subtitle="Daily mission count across all flights"
        className="min-h-[280px]"
      >
        <BarChart data={flightsPerDay} margin={smartMargins()} barCategoryGap={8} barGap={2}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
            domain={[0, 'dataMax + 1']}
          />
          <Tooltip
            cursor={BAR_CURSOR}
            formatter={(v: number) => [`${v}`, 'Flights']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="flights" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* Flights per hour */}
      <ChartCard title="Flights per hour" subtitle="Departure time (UTC)" className="min-h-[280px]">
        <BarChart data={flightsByHour} margin={smartMargins()} barCategoryGap={8} barGap={2}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={1}
          />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
            domain={[0, 'dataMax + 1']}
          />
          <Tooltip cursor={BAR_CURSOR} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
          <Bar dataKey="flights" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* Flight length distribution */}
      <ChartCard
        title="Flight length distribution"
        subtitle="Histogram of recorded route lengths"
        className="min-h-[280px]"
      >
        <BarChart
          data={flightLengthHistogram}
          margin={smartMargins({ right: 16 })}
          barCategoryGap={8}
          barGap={2}
        >
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={1}
          />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
            domain={[0, 'dataMax + 1']}
          />
          <Tooltip
            cursor={BAR_CURSOR}
            formatter={(v: number) => [`${v}`, 'Flights']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="flights" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* Avg. speed */}
      <ChartCard title="Avg. speed" subtitle="Daily average (km/h)" className="min-h-[280px]">
        <LineChart data={speedByDay} margin={smartMargins()}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 2" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, 'dataMax + 50']}
            tickFormatter={(v) => `${Math.round(v)} km/h`}
          />
          <Tooltip
            cursor={LINE_CURSOR_SPEED}
            formatter={(v: number) => [`${Math.round(v)} km/h`, 'Avg. speed']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Line
            type="monotone"
            dataKey="speed"
            stroke="var(--flight-speed)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ChartCard>

      {/* Top 10 longest flights (vertical bars) */}
      <ChartCard
        title="Top 10 longest flights"
        subtitle="Distance in kilometers"
        className="min-h-[280px]"
      >
        <BarChart
          data={topFlights}
          layout="vertical"
          margin={smartMargins({ left: 12, right: 24 })}
          barCategoryGap={8}
          barGap={2}
        >
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
            horizontal
            vertical={false}
          />
          <XAxis
            type="number"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, 'dataMax + 100']}
            allowDecimals={false}
            tickFormatter={(v: number) => `${Math.round(v).toLocaleString()} km`}
          />
          <YAxis
            dataKey="label"
            type="category"
            width={computeYAxisWidth(
              topFlights.map((d) => d.label),
              { min: 120 }
            )}
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
          />
          <Tooltip
            cursor={BAR_CURSOR_PURPLE}
            formatter={(v: number) => [`${Math.round(v).toLocaleString()} km`, 'Distance']}
            labelFormatter={(_v, p) => p?.[0]?.payload?.name ?? ''}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="distance" fill="var(--flight-altitude)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ChartCard>

      {/* Flight time per day */}
      <ChartCard
        title="Flight time per day"
        subtitle="Aggregated mission hours"
        className="min-h-[280px]"
      >
        <BarChart
          data={totalFlightTimeByDay}
          margin={smartMargins({ right: 8 })}
          barCategoryGap={8}
          barGap={2}
        >
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, 'dataMax + 0.5']}
            tickFormatter={(v) => `${v.toFixed(1)} h`}
          />
          <Tooltip
            cursor={BAR_CURSOR}
            formatter={(v: number) => [`${v.toFixed(2)} h`, 'Duration']}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Bar dataKey="hours" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* Flights per weekday */}
      <ChartCard
        title="Flights per weekday"
        subtitle="Departure day (UTC)"
        className="min-h-[280px]"
      >
        <BarChart data={flightsByWeekday} margin={smartMargins()} barCategoryGap={8} barGap={2}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
          />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
            domain={[0, 'dataMax + 1']}
          />
          <Tooltip cursor={BAR_CURSOR} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
          <Bar dataKey="flights" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* Flight duration distribution */}
      <ChartCard
        title="Flight duration distribution"
        subtitle="Buckets in minutes/hours"
        className="min-h-[280px]"
      >
        <BarChart data={durationHistogram} margin={smartMargins()} barCategoryGap={8} barGap={2}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
          />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
            domain={[0, 'dataMax + 1']}
          />
          <Tooltip cursor={BAR_CURSOR} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
          <Bar dataKey="flights" fill="var(--flight-altitude)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* Distance vs. duration */}
      <ChartCard title="Distance vs. duration" subtitle="km vs. hours" className="min-h-[280px]">
        <ScatterChart margin={smartMargins()}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="distance"
            name="Distance"
            type="number"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(v) => `${Math.round(v)} km`}
            domain={[0, 'dataMax + 100']}
          />
          <YAxis
            dataKey="hours"
            name="Duration"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(v) => `${v.toFixed(1)} h`}
            domain={[0, 'dataMax + 0.5']}
          />
          <ZAxis range={[80, 120]} />
          <Tooltip
            cursor={{ stroke: 'rgba(56,189,248,0.35)' }}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value: string | number, name: string) => {
              if (name === 'hours' && typeof value === 'number')
                return [`${value.toFixed(2)} h`, 'Duration']
              if (name === 'distance' && typeof value === 'number')
                return [`${Math.round(value)} km`, 'Distance']
              return [String(value), name]
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
          />
          <Scatter
            data={[...distanceDurationPoints].sort((a, b) => a.distance - b.distance)}
            fill="var(--flight-speed)"
          />
        </ScatterChart>
      </ChartCard>

      {/* Top origin airports */}
      <ChartCard title="Top origin airports" subtitle="Flights count" className="min-h-[280px]">
        <BarChart
          data={topOrigins}
          layout="vertical"
          margin={smartMargins({ left: 12, right: 24 })}
          barCategoryGap={8}
          barGap={2}
        >
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
            horizontal
            vertical={false}
          />
          <XAxis
            type="number"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, 'dataMax + 1']}
          />
          <YAxis
            dataKey="value"
            type="category"
            width={computeYAxisWidth(
              topOrigins.map((d) => d.value),
              { min: 72 }
            )}
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
          />
          <Tooltip
            cursor={BAR_CURSOR}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            labelFormatter={(_v, p) => p?.[0]?.payload?.label ?? ''}
          />
          <Bar dataKey="flights" fill="var(--flight-speed)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ChartCard>

      {/* Top destination airports */}
      <ChartCard
        title="Top destination airports"
        subtitle="Flights count"
        className="min-h-[280px]"
      >
        <BarChart
          data={topDestinations}
          layout="vertical"
          margin={smartMargins({ left: 12, right: 24 })}
          barCategoryGap={8}
          barGap={2}
        >
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
            horizontal
            vertical={false}
          />
          <XAxis
            type="number"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, 'dataMax + 1']}
          />
          <YAxis
            dataKey="value"
            type="category"
            width={computeYAxisWidth(
              topDestinations.map((d) => d.value),
              { min: 72 }
            )}
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
          />
          <Tooltip
            cursor={BAR_CURSOR}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            labelFormatter={(_v, p) => p?.[0]?.payload?.label ?? ''}
          />
          <Bar dataKey="flights" fill="var(--flight-altitude)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ChartCard>

      {/* Top aircraft types */}
      <ChartCard
        title="Top aircraft types"
        subtitle="Flights count (meta)"
        className="min-h-[280px]"
      >
        <BarChart
          data={topAircraftTypes}
          layout="vertical"
          margin={smartMargins({ left: 12, right: 24 })}
          barCategoryGap={8}
          barGap={2}
        >
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
            horizontal
            vertical={false}
          />
          <XAxis
            type="number"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={[0, 'dataMax + 1']}
          />
          <YAxis
            dataKey="label"
            type="category"
            width={computeYAxisWidth(
              topAircraftTypes.map((d) => abbreviateType(d.label)),
              { min: 140 }
            )}
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
            tickFormatter={(v: string) => abbreviateType(v)}
          />
          <Tooltip cursor={BAR_CURSOR} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
          <Bar dataKey="flights" fill="var(--flight-speed)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ChartCard>

      {/* Sankey */}
      <DetailCard
        title="Origin vs. destination countries"
        subtitle="Sankey: Top route flows by flight count"
        className="min-h-[320px]"
        actions={
          <button
            type="button"
            onClick={onToggleIgnoreSameStartTarget}
            className="flex items-center gap-3 rounded-full border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.82)] px-3 py-1.5 text-xs font-medium text-white shadow"
            aria-pressed={ignoreSameStartTarget}
          >
            <span className="whitespace-nowrap tracking-wide">
              Ignore identical origin/destination
            </span>
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
        }
      >
        <div className="relative flex h-full w-full flex-1">
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
                          {value.toLocaleString('en-US')} flights
                        </div>
                        <div>
                          Origin: <strong style={{ color: '#fff' }}>{source || '–'}</strong>
                        </div>
                        <div>
                          Destination: <strong style={{ color: '#fff' }}>{target || '–'}</strong>
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
                      <div>{value.toLocaleString('en-US')} flights</div>
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

// --------------------------------------------
// Custom colored Sankey link
// --------------------------------------------
function ColoredSankeyLink(props: SankeyLinkProps & { d?: string }) {
  const {
    payload,
    linkWidth,
    sourceX,
    sourceY,
    targetX,
    targetY,
    d,
    // Recharts internal props we don't want to forward to DOM
    // (intentionally omitted in the returned element)
    sourceControlX: _sourceControlX,
    sourceControlY: _sourceControlY,
    targetControlX: _targetControlX,
    targetControlY: _targetControlY,
    // whitelisted DOM props
    onMouseEnter,
    onMouseLeave,
    onClick,
    className,
    style,
  } = props as any

  const color = (payload as { color?: string })?.color ?? 'var(--flight-speed)'
  const curvature = 0.5
  const dx = (targetX - sourceX) * curvature
  const path =
    d ??
    `M${sourceX},${sourceY} C${sourceX + dx},${sourceY} ${targetX - dx},${targetY} ${targetX},${targetY}`
  const width = Math.max(linkWidth ?? 1, 1)

  return (
    <path
      d={path}
      stroke={color}
      fill={color}
      strokeWidth={width}
      fillOpacity={0.9}
      strokeOpacity={0.95}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={className}
      style={style}
    />
  )
}

export default OverviewDashboard
