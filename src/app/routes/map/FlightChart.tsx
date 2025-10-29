import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

export type ChartPoint = { distanceKm: number; altitudeFt: number | null; speedKts: number | null }

export function FlightChart({ data }: { data: ChartPoint[] }) {
  if (!data?.length) return null
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
  const last = data[data.length - 1]
  const maxX = Number.isFinite(last?.distanceKm) ? (last.distanceKm as number) : data.length
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((i * maxX) / 4))

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 24, right: 12, bottom: 12, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="distanceKm"
            type="number"
            domain={[0, maxX]}
            ticks={ticks}
            tickFormatter={(v) => `${fmt.format(v)} km`}
            tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--panel-border)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="alt"
            orientation="left"
            tickFormatter={(v) => `${fmt.format(v)} ft`}
            allowDecimals={false}
            width={52}
            tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--panel-border)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="spd"
            orientation="right"
            tickFormatter={(v) => `${fmt.format(v)} kt`}
            allowDecimals={false}
            width={48}
            tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--panel-border)' }}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | string, name: string) => [
              fmt.format(typeof value === 'number' ? value : Number(value)),
              name === 'altitudeFt' ? 'Altitude (ft)' : 'Speed (kt)',
            ]}
            labelFormatter={(v) => `Distance: ${fmt.format(Number(v))} km`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--chart-axis)' }} />
          <Line
            yAxisId="alt"
            type="monotone"
            dataKey="altitudeFt"
            name="Altitude (ft)"
            stroke="var(--flight-altitude)"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            yAxisId="spd"
            type="monotone"
            dataKey="speedKts"
            name="Speed (kt)"
            stroke="var(--flight-speed)"
            dot={false}
            strokeWidth={1.5}
            opacity={0.9}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default FlightChart
