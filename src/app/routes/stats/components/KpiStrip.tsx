import type { SummaryMetrics } from '../hooks/useStatsPageState'

type KpiStripProps = {
  summary: SummaryMetrics
  formatter: Intl.NumberFormat
}

function formatDistance(value: number, formatter: Intl.NumberFormat) {
  if (value >= 100000) {
    return `${(value / 1000).toFixed(0)}k km`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k km`
  }
  return `${formatter.format(Math.round(value))} km`
}

function formatHours(value: number) {
  if (value >= 100) {
    return `${value.toFixed(0)} h`
  }
  return `${value.toFixed(1)} h`
}

function formatSpeed(value: number | null, formatter: Intl.NumberFormat) {
  if (value == null) return '–'
  return `${formatter.format(Math.round(value))} km/h`
}

function formatAltitude(value: number | null, formatter: Intl.NumberFormat) {
  if (value == null) return '–'
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k ft`
  }
  return `${formatter.format(Math.round(value))} ft`
}

export function KpiStrip({ summary, formatter }: KpiStripProps) {
  const items = [
    {
      label: 'Recorded flights',
      value: formatter.format(summary.totalFlights),
      hint: 'Filtered dataset size',
    },
    {
      label: 'Flight time',
      value: formatHours(summary.totalDurationHours),
      hint: 'Total flight hours',
    },
    {
      label: 'Distance flown',
      value: formatDistance(summary.totalDistanceKm, formatter),
      hint: 'Total kilometers',
    },
    {
      label: 'Unique routes',
      value: formatter.format(summary.uniqueRoutes),
      hint: 'Origin → destination combinations',
    },
    {
      label: 'Avg. cruise speed',
      value: formatSpeed(summary.avgSpeedKmH, formatter),
      hint: 'Across flights with data',
    },
    {
      label: 'Avg. cruise altitude',
      value: formatAltitude(summary.avgAltitudeFt, formatter),
      hint: 'Across flights with data',
    },
  ]

  return (
    <section
      className="rounded-xl border border-[color:var(--panel-border)] p-4 shadow-sm"
      style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--controls-fg)' }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="text-[0.6rem] uppercase tracking-[0.3em] opacity-60">
              {item.label}
            </div>
            <div className="text-xl font-semibold opacity-90">{item.value}</div>
            <div className="text-[0.7rem] opacity-60">{item.hint}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export type { SummaryMetrics }
