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
      label: 'Erfasste Flüge',
      value: formatter.format(summary.totalFlights),
      hint: 'Gefilterte Datenmenge',
    },
    {
      label: 'Flugzeit',
      value: formatHours(summary.totalDurationHours),
      hint: 'Gesamte Flugstunden',
    },
    {
      label: 'Geflogene Distanz',
      value: formatDistance(summary.totalDistanceKm, formatter),
      hint: 'Kilometer gesamt',
    },
    {
      label: 'Einzigartige Routen',
      value: formatter.format(summary.uniqueRoutes),
      hint: 'Start → Ziel Kombinationen',
    },
    {
      label: 'Ø Reisegeschwindigkeit',
      value: formatSpeed(summary.avgSpeedKmH, formatter),
      hint: 'Über Flüge mit Daten',
    },
    {
      label: 'Ø Reiseflughöhe',
      value: formatAltitude(summary.avgAltitudeFt, formatter),
      hint: 'Über Flüge mit Daten',
    },
  ]

  return (
    <section className="rounded-xl border border-[color:var(--panel-border)] bg-[rgba(12,20,36,0.78)] p-4 text-white shadow-sm backdrop-blur">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
              {item.label}
            </div>
            <div className="text-xl font-semibold text-white/90">{item.value}</div>
            <div className="text-[0.7rem] text-white/50">{item.hint}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export type { SummaryMetrics }
