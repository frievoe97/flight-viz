import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { getFlightData, type Flight } from '@/data'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [flights, setFlights] = useState<Flight[]>([])
  const [totals, setTotals] = useState<{ distanceKm: number; durationSeconds: number; totalFlights: number; maxAltitudeFt: number } | null>(
    null
  )

  useEffect(() => {
    getFlightData().then((d) => {
      setFlights(d.flights)
      setTotals({
        distanceKm: d.aggregatedStats.totalDistanceKm,
        durationSeconds: d.aggregatedStats.totalDurationSeconds,
        totalFlights: d.aggregatedStats.totalFlights,
        maxAltitudeFt: d.aggregatedStats.maxAltitudeFt,
      })
      setLoading(false)
    })
  }, [])

  const nf0 = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }), [])
  const nf1 = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }), [])

  const topByDistance = useMemo(() => {
    return [...flights]
      .sort((a, b) => (b.distanceKm || 0) - (a.distanceKm || 0))
      .slice(0, 10)
      .map((f) => ({ name: f.name, km: Math.round(f.distanceKm) }))
  }, [flights])

  const cumulativeByDate = useMemo(() => {
    const items = flights
      .map((f) => ({
        date:
          (f.meta && typeof f.meta['startTimeBerlin'] === 'string'
            ? (f.meta['startTimeBerlin'] as string)
            : null) || '',
        km: f.distanceKm || 0,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    let acc = 0
    return items.map((i, idx) => {
      acc += i.km
      return { idx, date: i.date || `#${idx + 1}`, totalKm: Math.round(acc) }
    })
  }, [flights])

  const durationShare = useMemo(() => {
    const top = [...flights]
      .sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0))
      .slice(0, 6)
    const rest = flights.slice(6)
    const data = top.map((f) => ({ name: f.name, sec: f.durationSeconds || 0 }))
    const others = rest.reduce((s, f) => s + (f.durationSeconds || 0), 0)
    if (others > 0) data.push({ name: 'Others', sec: others })
    return data
  }, [flights])

  const pieColors = ['var(--flight-altitude)', 'var(--flight-speed)', '#60a5fa', '#f59e0b', '#10b981', '#ef4444', '#a3a3a3']

  if (loading || !totals)
    return <div className="h-full w-full flex items-center justify-center">Loading…</div>

  return (
    <div className="h-full w-full p-4 grid gap-4" style={{ gridTemplateRows: 'auto 1fr', backgroundColor: 'var(--map-land)', color: '#ffffff' }}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3">
          <div className="text-sm text-[var(--chart-axis)]">Total flights</div>
          <div className="text-2xl font-semibold">{totals.totalFlights}</div>
        </div>
        <div className="card p-3">
          <div className="text-sm text-[var(--chart-axis)]">Total distance</div>
          <div className="text-2xl font-semibold">{nf0.format(totals.distanceKm)} km</div>
        </div>
        <div className="card p-3">
          <div className="text-sm text-[var(--chart-axis)]">Total time</div>
          <div className="text-2xl font-semibold">{nf1.format(totals.durationSeconds / 3600)} h</div>
        </div>
        <div className="card p-3">
          <div className="text-sm text-[var(--chart-axis)]">Max altitude</div>
          <div className="text-2xl font-semibold">{nf0.format(totals.maxAltitudeFt)} ft</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0" style={{ gridAutoRows: 'minmax(280px, 1fr)' }}>
        <div className="card p-3 flex flex-col min-h-0">
          <div className="text-sm mb-2 text-[var(--chart-axis)]">Top flights by distance</div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topByDistance} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} hide />
                <YAxis tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={{ stroke: 'var(--panel-border)' }} tickLine={false} />
                <Tooltip formatter={(v: number) => [`${nf0.format(v)} km`, 'Distance']} />
                <Bar dataKey="km" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-3 flex flex-col min-h-0">
          <div className="text-sm mb-2 text-[var(--chart-axis)]">Cumulative distance</div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeByDate} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={{ stroke: 'var(--panel-border)' }} tickLine={false} />
                <Tooltip formatter={(v: number) => [`${nf0.format(v)} km`, 'Total']} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--chart-axis)' }} />
                <Line type="monotone" dataKey="totalKm" name="Total (km)" stroke="var(--flight-altitude)" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-3 flex flex-col min-h-0 xl:col-span-2">
          <div className="text-sm mb-2 text-[var(--chart-axis)]">Time share (top flights)</div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(v: number) => [`${nf1.format(v / 3600)} h`, 'Duration']} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--chart-axis)' }} />
                <Pie data={durationShare} dataKey="sec" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {durationShare.map((_, idx) => (
                    <Cell key={`c-${idx}`} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
