import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { Link } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  Sankey,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import type { LinkProps as SankeyLinkProps } from 'recharts/types/chart/Sankey'
import { getFlightData, type Flight } from '@/data'
import { cn } from '@/lib/utils'

type FlightData = Awaited<ReturnType<typeof getFlightData>>

type CardProps = {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  style?: CSSProperties
}

type ChartCardProps = CardProps

const tooltipStyle = {
  backgroundColor: 'rgba(17, 24, 39, 0.88)',
  border: '1px solid var(--panel-border)',
  borderRadius: '0.5rem',
  color: '#fff',
  padding: '0.5rem 0.75rem',
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

const SANKEY_COLORS = [
  '#38bdf8',
  '#a855f7',
  '#f97316',
  '#22c55e',
  '#facc15',
  '#f43f5e',
  '#0ea5e9',
  '#c084fc',
  '#fb7185',
  '#14b8a6',
  '#eab308',
  '#8b5cf6',
]

const UNKNOWN_LABEL = 'Unknown'

type Filters = {
  date: string
  origin: string
  destination: string
  originCountry: string
  destinationCountry: string
}

type FilterOption = { value: string; label: string; count: number }

function Card({ title, subtitle, children, className, style }: CardProps) {
  return (
    <div
      className={cn(
        'card flex min-h-0 flex-col gap-3 rounded-xl border px-1 py-1 text-white shadow-sm',
        className
      )}
      style={{
        backgroundColor: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        ...(style ?? {}),
      }}
    >
      <header className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/90">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </div>
  )
}

function ChartCard({ title, subtitle, children, className, style }: ChartCardProps) {
  return (
    <Card title={title} subtitle={subtitle} className={cn('min-h-0', className)} style={style}>
      <div className="relative flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function DetailCard({ title, subtitle, children, className, style }: CardProps) {
  return (
    <Card title={title} subtitle={subtitle} className={cn('min-h-0', className)} style={style}>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  )
}

function parseEuDateTime(raw: string | null | undefined) {
  if (!raw) return null
  const parts = raw.trim().split(/\s+/)
  if (parts.length < 2) return null
  const [datePart, timePart] = parts
  const dateTokens = datePart.split('.')
  const timeTokens = timePart.split(':')
  if (dateTokens.length !== 3 || timeTokens.length < 2) return null
  const day = Number.parseInt(dateTokens[0], 10)
  const month = Number.parseInt(dateTokens[1], 10)
  const year = Number.parseInt(dateTokens[2], 10)
  const hour = Number.parseInt(timeTokens[0], 10)
  const minute = Number.parseInt(timeTokens[1], 10)
  const second = Number.parseInt(timeTokens[2] ?? '0', 10)
  if ([day, month, year, hour, minute, second].some((n) => !Number.isFinite(n))) return null
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

function getMetaDateString(flight: Flight, key: 'startTimeBerlin' | 'endTimeBerlin') {
  if (!flight.meta || typeof flight.meta !== 'object') return null
  const value = (flight.meta as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function getFlightStart(flight: Flight) {
  const fromMeta = parseEuDateTime(getMetaDateString(flight, 'startTimeBerlin'))
  if (fromMeta) return fromMeta
  const firstTimestamp = flight.points.find((p) => p.timeLabel)?.timeLabel
  return parseEuDateTime(firstTimestamp ?? undefined)
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function formatDateLabel(key: string) {
  const [year, month, day] = key.split('-').map((token) => Number.parseInt(token, 10))
  if ([year, month, day].some((n) => !Number.isFinite(n))) return key
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(2)}`
}

function airportCodeToCountry(code: string | null | undefined) {
  if (!code) return UNKNOWN_LABEL
  const prefix = code.slice(0, 2).toUpperCase()
  switch (prefix) {
    case 'EB':
      return 'Belgium'
    case 'ED':
      return 'Germany'
    case 'EG':
      return 'United Kingdom'
    case 'EH':
      return 'Netherlands'
    case 'EP':
      return 'Poland'
    case 'LD':
      return 'Croatia'
    case 'LE':
      return 'Spain'
    case 'LF':
      return 'France'
    case 'LI':
      return 'Italy'
    case 'LM':
      return 'Malta'
    case 'LT':
      return 'Turkey'
    default:
      return UNKNOWN_LABEL
  }
}

function truncateRouteLabel(label: string) {
  return label.length > 11 ? `${label.slice(0, 11)}…` : label
}

function formatDuration(seconds: number | null) {
  if (!Number.isFinite(seconds as number)) return '–'
  const total = Math.round(seconds as number)
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours === 0 && minutes === 0) return '< 1 min'
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
}

function SidebarButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'w-full rounded-lg border px-3 py-2 text-left text-sm font-medium uppercase tracking-wide transition-colors',
        active
          ? 'bg-[var(--panel-bg)] text-white border-[color:var(--panel-border)] shadow'
          : 'text-[hsl(var(--muted-foreground))] border-transparent hover:bg-white/5'
      )}
      style={{ borderColor: active ? 'var(--panel-border)' : 'transparent' }}
    >
      {children}
    </button>
  )
}

function FilterPopover({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: FilterOption[]
  onChange: (next: string) => void
}) {
  const selected = options.find((option) => option.value === value) ?? options[0] ?? null
  const triggerLabel = selected ? `${selected.label} (${selected.count})` : 'No options'
  const disabled = options.length <= 1

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.65rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'controls-btn flex items-center justify-between rounded-md px-3 py-2 text-sm transition focus:outline-none focus:ring-2',
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-white/10 focus:ring-[rgba(56,189,248,0.45)]'
            )}
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', borderColor: 'var(--panel-border)' }}
          >
            <span className="truncate">{triggerLabel}</span>
            <span aria-hidden className="text-xs text-[hsl(var(--muted-foreground))]">
              ▼
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            className="w-64 rounded-lg border bg-[#0f172a]/95 backdrop-blur-md shadow-lg"
            style={{ borderColor: 'var(--panel-border)' }}
          >
            <div className="max-h-64 overflow-y-auto p-2 text-sm text-white">
              {options.map((option) => {
                const isActive = option.value === value
                return (
                  <Popover.Close asChild key={option.value}>
                    <button
                      type="button"
                      onClick={() => onChange(option.value)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors',
                        isActive ? 'bg-white/10' : 'hover:bg-white/10'
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {option.count}
                      </span>
                    </button>
                  </Popover.Close>
                )
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

export default function StatsPage() {
  const [activeView, setActiveView] = useState<'overview' | 'flight'>('overview')
  const [flightData, setFlightData] = useState<FlightData | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDate, setFilterDate] = useState<string>('all')
  const [filterOrigin, setFilterOrigin] = useState<string>('all')
  const [filterDestination, setFilterDestination] = useState<string>('all')
  const [filterOriginCountry, setFilterOriginCountry] = useState<string>('all')
  const [filterDestinationCountry, setFilterDestinationCountry] = useState<string>('all')
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
  const [flightAnimationKey, setFlightAnimationKey] = useState(0)
  const [ignoreSameStartTarget, setIgnoreSameStartTarget] = useState<boolean>(true)

  useEffect(() => {
    getFlightData().then((data) => setFlightData(data))
  }, [])

  const flights = flightData?.flights ?? []
  const nf0 = useMemo(() => new Intl.NumberFormat('de-DE'), [])

  const filters = useMemo<Filters>(
    () => ({
      date: filterDate,
      origin: filterOrigin,
      destination: filterDestination,
      originCountry: filterOriginCountry,
      destinationCountry: filterDestinationCountry,
    }),
    [filterDate, filterOrigin, filterDestination, filterOriginCountry, filterDestinationCountry]
  )

  const matchesFilters = useCallback(
    (flight: Flight, overrides?: Partial<Filters>, omit: Array<keyof Filters> = []) => {
      const criteria = { ...filters, ...overrides }
      const omitSet = new Set(omit)

      if (!omitSet.has('date') && criteria.date !== 'all') {
        const start = getFlightStart(flight)
        if (!start || formatDateKey(start) !== criteria.date) return false
      }
      if (!omitSet.has('origin') && criteria.origin !== 'all') {
        const origin = flight.origin ?? UNKNOWN_LABEL
        if (origin !== criteria.origin) return false
      }
      if (!omitSet.has('destination') && criteria.destination !== 'all') {
        const destination = flight.destination ?? UNKNOWN_LABEL
        if (destination !== criteria.destination) return false
      }
      if (!omitSet.has('originCountry') && criteria.originCountry !== 'all') {
        if (airportCodeToCountry(flight.origin) !== criteria.originCountry) return false
      }
      if (!omitSet.has('destinationCountry') && criteria.destinationCountry !== 'all') {
        if (airportCodeToCountry(flight.destination) !== criteria.destinationCountry) return false
      }
      return true
    },
    [filters]
  )

  const availableFilterOptions = useMemo(() => {
    const collectOptions = (key: keyof Filters, projector: (flight: Flight) => string | null) => {
      const counts = new Map<string, number>()
      flights.forEach((flight) => {
        if (!matchesFilters(flight, undefined, [key])) return
        const value = projector(flight) ?? UNKNOWN_LABEL
        counts.set(value, (counts.get(value) ?? 0) + 1)
      })
      const entries = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'))
      const total = entries.reduce((sum, [, count]) => sum + count, 0)
      return [
        { value: 'all', label: 'All', count: total },
        ...entries.map(([value, count]) => ({
          value,
          label: value,
          count,
        })),
      ]
    }

    const datesCounts = new Map<string, number>()
    flights.forEach((flight) => {
      if (!matchesFilters(flight, undefined, ['date'])) return
      const start = getFlightStart(flight)
      if (!start) return
      const key = formatDateKey(start)
      datesCounts.set(key, (datesCounts.get(key) ?? 0) + 1)
    })
    const dateEntries = [...datesCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const dateTotal = dateEntries.reduce((sum, [, count]) => sum + count, 0)
    const dates: FilterOption[] = [
      { value: 'all', label: 'All', count: dateTotal },
      ...dateEntries.map(([value, count]) => ({
        value,
        label: formatDateLabel(value),
        count,
      })),
    ]

    return {
      dates,
      origins: collectOptions('origin', (flight) => flight.origin ?? UNKNOWN_LABEL),
      destinations: collectOptions('destination', (flight) => flight.destination ?? UNKNOWN_LABEL),
      originCountries: collectOptions('originCountry', (flight) =>
        airportCodeToCountry(flight.origin)
      ),
      destinationCountries: collectOptions('destinationCountry', (flight) =>
        airportCodeToCountry(flight.destination)
      ),
    }
  }, [flights, matchesFilters])

  useEffect(() => {
    if (
      filterDate !== 'all' &&
      !availableFilterOptions.dates.some((option) => option.value === filterDate)
    ) {
      setFilterDate('all')
    }
  }, [availableFilterOptions.dates, filterDate])

  useEffect(() => {
    if (
      filterOrigin !== 'all' &&
      !availableFilterOptions.origins.some((option) => option.value === filterOrigin)
    ) {
      setFilterOrigin('all')
    }
  }, [availableFilterOptions.origins, filterOrigin])

  useEffect(() => {
    if (
      filterDestination !== 'all' &&
      !availableFilterOptions.destinations.some((option) => option.value === filterDestination)
    ) {
      setFilterDestination('all')
    }
  }, [availableFilterOptions.destinations, filterDestination])

  useEffect(() => {
    if (
      filterOriginCountry !== 'all' &&
      !availableFilterOptions.originCountries.some((option) => option.value === filterOriginCountry)
    ) {
      setFilterOriginCountry('all')
    }
  }, [availableFilterOptions.originCountries, filterOriginCountry])

  useEffect(() => {
    if (
      filterDestinationCountry !== 'all' &&
      !availableFilterOptions.destinationCountries.some(
        (option) => option.value === filterDestinationCountry
      )
    ) {
      setFilterDestinationCountry('all')
    }
  }, [availableFilterOptions.destinationCountries, filterDestinationCountry])

  const filteredFlights = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return flights
      .filter((flight) => {
        if (!matchesFilters(flight)) return false
        if (!search) return true
        const haystack = [flight.name, flight.id, flight.origin, flight.destination]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(search)
      })
      .sort((a, b) => {
        const startA = getFlightStart(a)?.getTime() ?? 0
        const startB = getFlightStart(b)?.getTime() ?? 0
        return startB - startA
      })
  }, [flights, matchesFilters, searchTerm])

  useEffect(() => {
    if (!filteredFlights.length) {
      setSelectedFlightId(null)
      return
    }
    setSelectedFlightId((prev) => {
      if (prev && filteredFlights.some((flight) => flight.id === prev)) return prev
      return filteredFlights[0]?.id ?? null
    })
  }, [filteredFlights])

  useEffect(() => {
    setFlightAnimationKey((prev) => prev + 1)
  }, [selectedFlightId])

  const selectedFlight = useMemo(
    () => filteredFlights.find((flight) => flight.id === selectedFlightId) ?? null,
    [filteredFlights, selectedFlightId]
  )

  const flightsPerDay = useMemo(() => {
    const counts = new Map<string, number>()
    flights.forEach((flight) => {
      const start = getFlightStart(flight)
      if (!start) return
      const key = formatDateKey(start)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ date: formatDateLabel(key), flights: count }))
  }, [flights])

  const altitudeByDistance = useMemo(() => {
    const bucketSizeKm = 50
    const buckets = new Map<
      number,
      {
        sum: number
        count: number
      }
    >()
    flights.forEach((flight) => {
      flight.points.forEach((point) => {
        if (
          !Number.isFinite(point.altitudeFeet as number) ||
          !Number.isFinite(point.distanceKm as number)
        )
          return
        const bucket = Math.floor((point.distanceKm as number) / bucketSizeKm) * bucketSizeKm
        const record = buckets.get(bucket) ?? { sum: 0, count: 0 }
        record.sum += point.altitudeFeet as number
        record.count += 1
        buckets.set(bucket, record)
      })
    })
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, { sum, count }]) => ({
        bucketStart: bucket,
        bucketEnd: bucket + bucketSizeKm,
        midpoint: bucket + bucketSizeKm / 2,
        altitude: count > 0 ? sum / count : 0,
        sampleCount: count,
      }))
  }, [flights])

  const flightLengthHistogram = useMemo(() => {
    const distances = flights
      .map((flight) => flight.distanceKm)
      .filter((value): value is number => Number.isFinite(value))
    if (!distances.length) return []
    const min = Math.min(...distances)
    const max = Math.max(...distances)
    if (min === max) {
      return [{ label: `${Math.round(min)} km`, flights: distances.length }]
    }
    const binCount = Math.min(12, Math.max(6, Math.ceil(Math.sqrt(distances.length))))
    const binSize = (max - min) / binCount || 1
    const bins = Array.from({ length: binCount }, (_, index) => {
      const start = min + index * binSize
      const end = index === binCount - 1 ? max : min + (index + 1) * binSize
      return { start, end, count: 0 }
    })
    distances.forEach((distance) => {
      const index = Math.min(bins.length - 1, Math.floor((distance - min) / (binSize || 1)))
      bins[index].count += 1
    })
    return bins.map(({ start, end, count }) => ({
      label: `${Math.round(start)}–${Math.round(end)} km`,
      flights: count,
    }))
  }, [flights])

  const speedByDay = useMemo(() => {
    const dayStats = new Map<string, { sum: number; count: number }>()
    flights.forEach((flight) => {
      const start = getFlightStart(flight)
      if (!start) return
      const speed = flight.speedKtsStats.avg
      if (!Number.isFinite(speed as number)) return
      const key = formatDateKey(start)
      const entry = dayStats.get(key) ?? { sum: 0, count: 0 }
      entry.sum += (speed as number) * 1.852
      entry.count += 1
      dayStats.set(key, entry)
    })
    return [...dayStats.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, { sum, count }]) => ({
        date: formatDateLabel(key),
        speed: count > 0 ? sum / count : 0,
      }))
  }, [flights])

  const totalFlightTimeByDay = useMemo(() => {
    const totals = new Map<string, number>()
    flights.forEach((flight) => {
      const start = getFlightStart(flight)
      if (!start) return
      const duration = flight.durationSeconds
      if (!Number.isFinite(duration as number)) return
      const key = formatDateKey(start)
      totals.set(key, (totals.get(key) ?? 0) + (duration as number))
    })
    return [...totals.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, seconds]) => ({
        date: formatDateLabel(key),
        hours: seconds / 3600,
      }))
  }, [flights])

  const topFlights = useMemo(() => {
    return [...flights]
      .filter((flight) => Number.isFinite(flight.distanceKm))
      .sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0))
      .slice(0, 10)
      .map((flight) => ({
        name: flight.name,
        label: truncateRouteLabel(flight.name),
        distance: flight.distanceKm ?? 0,
      }))
  }, [flights])

  const sankeyData = useMemo(() => {
    const flows = new Map<string, number>()

    flights.forEach((flight) => {
      const origin = airportCodeToCountry(flight.origin)
      const destination = airportCodeToCountry(flight.destination)

      if (ignoreSameStartTarget && origin === destination) return // ← hier wird gefiltert

      const key = `${origin}→${destination}`
      flows.set(key, (flows.get(key) ?? 0) + 1)
    })

    const MAX_LINKS = 6
    const top = [...flows.entries()]
      .map(([key, value]) => {
        const [origin, destination] = key.split('→')
        return { origin, destination, value }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_LINKS)

    const origins = Array.from(new Set(top.map((f) => f.origin)))
    const destinations = Array.from(new Set(top.map((f) => f.destination)))

    const originIndex = new Map<string, number>()
    const destinationIndex = new Map<string, number>()
    const nodes: Array<{ name: string }> = []

    origins.forEach((o) => {
      originIndex.set(o, nodes.length)
      nodes.push({ name: `${o} • Origin` })
    })
    destinations.forEach((d) => {
      destinationIndex.set(d, nodes.length)
      nodes.push({ name: `${d} • Destination` })
    })

    const pickLinkColor = (origin: string, destination: string) => {
      const key = `${origin}-${destination}`
      const hash = key.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      return SANKEY_COLORS[hash % SANKEY_COLORS.length]
    }

    const links = top
      .map(({ origin, destination, value }) => {
        const source = originIndex.get(origin)
        const target = destinationIndex.get(destination)
        if (source == null || target == null) return null
        const color = pickLinkColor(origin, destination)
        return { source, target, value, color, fill: color, stroke: color }
      })
      .filter(
        (
          x
        ): x is {
          source: number
          target: number
          value: number
          color: string
          fill: string
          stroke: string
        } => x !== null
      )

    return { nodes, links }
  }, [flights, ignoreSameStartTarget]) // ← Flag als Dependency

  const selectedFlightSeries = useMemo(() => {
    if (!selectedFlight) return []
    const fallbackStep =
      Number.isFinite(selectedFlight.distanceKm) && selectedFlight.points.length > 1
        ? (selectedFlight.distanceKm as number) / (selectedFlight.points.length - 1)
        : 1
    const baseTimestamp =
      selectedFlight.points
        .map((point) => parseEuDateTime(point.timeLabel)?.getTime() ?? null)
        .find((value) => Number.isFinite(value as number)) ?? null
    return selectedFlight.points.map((point, index) => {
      const distance = Number.isFinite(point.distanceKm as number)
        ? (point.distanceKm as number)
        : fallbackStep * index
      const altitude = Number.isFinite(point.altitudeFeet as number)
        ? (point.altitudeFeet as number)
        : null
      const speed = Number.isFinite(point.speedKts as number)
        ? (point.speedKts as number) * 1.852
        : null
      const verticalRate = Number.isFinite(point.verticalRateFpm as number)
        ? (point.verticalRateFpm as number)
        : null
      const timestamp = parseEuDateTime(point.timeLabel)?.getTime() ?? null
      const timeMinutes =
        baseTimestamp != null && timestamp != null ? (timestamp - baseTimestamp) / 60000 : index
      return { distance, altitude, speed, verticalRate, timeMinutes }
    })
  }, [selectedFlight])

  const selectedFlightAltitudeSeries = useMemo(
    () => selectedFlightSeries.filter((entry) => entry.altitude != null),
    [selectedFlightSeries]
  )

  const selectedFlightSpeedSeries = useMemo(
    () => selectedFlightSeries.filter((entry) => entry.speed != null),
    [selectedFlightSeries]
  )

  const selectedFlightVerticalSeries = useMemo(
    () => selectedFlightSeries.filter((entry) => entry.verticalRate != null),
    [selectedFlightSeries]
  )

  const selectedFlightAltitudeHistogram = useMemo(() => {
    const values = selectedFlightSeries
      .map((entry) => entry.altitude)
      .filter((value): value is number => Number.isFinite(value as number))
    if (!values.length) return []
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (min === max) {
      return [{ label: `${Math.round(min)} ft`, samples: values.length }]
    }
    const bins = 8
    const span = max - min || 1
    const binSize = span / bins
    const entries = Array.from({ length: bins }, (_, index) => {
      const start = min + index * binSize
      const end = index === bins - 1 ? max : min + (index + 1) * binSize
      return { start, end, count: 0 }
    })
    values.forEach((value) => {
      const index = Math.min(entries.length - 1, Math.floor((value - min) / (binSize || 1)))
      entries[index].count += 1
    })
    return entries.map(({ start, end, count }) => ({
      label: `${Math.round(start / 1000)}k–${Math.round(end / 1000)}k ft`,
      samples: count,
    }))
  }, [selectedFlightSeries])

  const selectedFlightSpeedHistogram = useMemo(() => {
    const values = selectedFlightSeries
      .map((entry) => entry.speed)
      .filter((value): value is number => Number.isFinite(value as number))
    if (!values.length) return []
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (min === max) {
      return [{ label: `${Math.round(min)} km/h`, samples: values.length }]
    }
    const bins = 8
    const span = max - min || 1
    const binSize = span / bins
    const entries = Array.from({ length: bins }, (_, index) => {
      const start = min + index * binSize
      const end = index === bins - 1 ? max : min + (index + 1) * binSize
      return { start, end, count: 0 }
    })
    values.forEach((value) => {
      const index = Math.min(entries.length - 1, Math.floor((value - min) / (binSize || 1)))
      entries[index].count += 1
    })
    return entries.map(({ start, end, count }) => ({
      label: `${Math.round(start)}–${Math.round(end)} km/h`,
      samples: count,
    }))
  }, [selectedFlightSeries])

  const selectedFlightStats = useMemo(() => {
    if (!selectedFlight) return null
    const distanceKm = Number.isFinite(selectedFlight.distanceKm)
      ? (selectedFlight.distanceKm as number)
      : null
    const durationSeconds = Number.isFinite(selectedFlight.durationSeconds as number)
      ? (selectedFlight.durationSeconds as number)
      : null
    const avgAltitude = Number.isFinite(selectedFlight.altitudeStats.avg as number)
      ? (selectedFlight.altitudeStats.avg as number)
      : null
    const maxAltitude = Number.isFinite(selectedFlight.altitudeStats.max as number)
      ? (selectedFlight.altitudeStats.max as number)
      : null
    const avgSpeed = Number.isFinite(selectedFlight.speedKtsStats.avg as number)
      ? (selectedFlight.speedKtsStats.avg as number) * 1.852
      : null
    return {
      name: selectedFlight.name,
      origin: selectedFlight.origin ?? UNKNOWN_LABEL,
      destination: selectedFlight.destination ?? UNKNOWN_LABEL,
      originCountry: airportCodeToCountry(selectedFlight.origin),
      destinationCountry: airportCodeToCountry(selectedFlight.destination),
      distanceKm,
      durationSeconds,
      avgAltitude,
      maxAltitude,
      avgSpeed,
      pointCount: selectedFlight.pointCount,
    }
  }, [selectedFlight])

  const flightAnimationStyle = useMemo<CSSProperties>(
    () => ({ animation: 'stats-fade-in 320ms ease', animationFillMode: 'both' }),
    [flightAnimationKey]
  )

  if (!flightData) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ backgroundColor: 'var(--map-land)', color: '#ffffff' }}
      >
        <span className="text-sm uppercase tracking-[0.35em] text-white/70">
          Loading analytics…
        </span>
      </div>
    )
  }

  return (
    <div className="h-full w-full" style={{ backgroundColor: 'var(--map-land)' }}>
      <div className="grid h-full w-full grid-cols-[16rem_minmax(0,1fr)]">
        <aside
          className="flex h-full flex-col gap-6 border-r px-5 py-6"
          style={{ borderColor: 'var(--panel-border)', backgroundColor: 'rgba(15,23,42,0.65)' }}
        >
          <div className="space-y-2 text-white">
            <h1 className="text-lg font-semibold uppercase tracking-[0.3em] text-white/90">
              Flight Analytics
            </h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
              Explore aggregated insights or drill into a single flight. Choose the view and filters
              that suit your question.
            </p>
          </div>
          <nav className="space-y-2">
            <SidebarButton
              active={activeView === 'overview'}
              onClick={() => setActiveView('overview')}
            >
              All Flights
            </SidebarButton>
            <SidebarButton active={activeView === 'flight'} onClick={() => setActiveView('flight')}>
              Single Flight
            </SidebarButton>
          </nav>
          <div className="mt-auto">
            <Link
              to="/map"
              className="controls-btn block rounded-md border px-3 py-2 text-center text-sm font-medium uppercase tracking-wide transition hover:bg-white/10"
              style={{ borderColor: 'var(--panel-border)', backgroundColor: 'rgba(15,23,42,0.65)' }}
            >
              Back to Map
            </Link>
          </div>
        </aside>

        <main className="flex h-full min-h-0 flex-col px-6 py-6">
          {activeView === 'overview' ? (
            <section className="flex h-full min-h-0 flex-col gap-4 text-white">
              <header className="flex flex-shrink-0 flex-col gap-1">
                <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
                  Overview
                </h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Activity, altitude patterns, and performance metrics across every recorded flight.
                </p>
              </header>
              <div className="grid h-full min-h-0 gap-4 auto-rows-[minmax(0,1fr)] grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                <ChartCard
                  title="Flights per Day"
                  subtitle="Daily mission count across all flights"
                >
                  <BarChart
                    data={flightsPerDay}
                    margin={{ left: -18, right: 8, top: 12, bottom: 8 }}
                  >
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                      allowDecimals={false}
                    />
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
                >
                  <LineChart
                    data={altitudeByDistance}
                    margin={{ left: -12, right: 12, top: 12, bottom: 8 }}
                  >
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 2" />
                    <XAxis
                      dataKey="midpoint"
                      tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                      tickFormatter={(value) => `${Math.round(value)} km`}
                    />
                    <YAxis
                      tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                      tickFormatter={(value) => `${Math.round(value / 1000)}k ft`}
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
                >
                  <BarChart
                    data={flightLengthHistogram}
                    margin={{ left: -24, right: 16, top: 12, bottom: 8 }}
                  >
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={BAR_CURSOR}
                      formatter={(value: number) => [`${value}`, 'Flights']}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar dataKey="flights" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartCard>

                <ChartCard title="Avg Speed" subtitle="Daily average speed (km/h)">
                  <LineChart
                    data={speedByDay}
                    margin={{ left: -12, right: 12, top: 12, bottom: 8 }}
                  >
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

                <ChartCard title="Top 10 Longest Flights" subtitle="Distance in kilometres">
                  <BarChart
                    data={topFlights}
                    layout="vertical"
                    margin={{ left: 16, right: 24, top: 12, bottom: 12 }}
                  >
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                      tickFormatter={(value) => `${Math.round(value)} km`}
                    />
                    <YAxis
                      dataKey="label"
                      type="category"
                      tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                      width={140}
                    />
                    <Tooltip
                      cursor={BAR_CURSOR_PURPLE}
                      formatter={(value: number) => [
                        `${Math.round(value).toLocaleString()} km`,
                        'Distance',
                      ]}
                      labelFormatter={(_value, payload) => payload?.[0]?.payload?.name ?? ''}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar dataKey="distance" fill="var(--flight-altitude)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartCard>

                <ChartCard title="Total Flight Time per Day" subtitle="Aggregated mission hours">
                  <BarChart
                    data={totalFlightTimeByDay}
                    margin={{ left: -18, right: 8, top: 12, bottom: 8 }}
                  >
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

                <ChartCard
                  title="Origin vs Destination Countries"
                  subtitle="Sankey: top route flows by flight count"
                >
                  {/* Wrapper ist bereits relative → Overlay möglich */}
                  <div className="relative w-full h-full">
                    {/* Switch oben rechts */}
                    <div
                      className="absolute right-2 top-2 z-10 flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
                      style={{
                        backgroundColor: 'rgba(15,23,42,0.75)',
                        borderColor: 'var(--panel-border)',
                      }}
                    >
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-[var(--flight-speed)]"
                          checked={ignoreSameStartTarget}
                          onChange={(e) => setIgnoreSameStartTarget(e.target.checked)}
                        />
                        Ignore same start and target
                      </label>
                    </div>

                    {/* Chart füllt den Container via ResponsiveContainer */}
                    <Sankey
                      data={sankeyData}
                      nodePadding={10}
                      nodeWidth={10}
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
                              <div
                                style={{
                                  backgroundColor: 'rgba(17,24,39,0.96)',
                                  border: '1px solid #334155',
                                  borderRadius: '0.5rem',
                                  color: '#fff',
                                  padding: '0.5rem 0.75rem',
                                  boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
                                }}
                              >
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
                            <div
                              style={{
                                backgroundColor: 'rgba(17,24,39,0.96)',
                                border: '1px solid #334155',
                                borderRadius: '0.5rem',
                                color: '#fff',
                                padding: '0.5rem 0.75rem',
                                boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
                              }}
                            >
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>{nodeName}</div>
                              <div>{value.toLocaleString('de-DE')} flights</div>
                            </div>
                          )
                        }}
                      />
                    </Sankey>
                  </div>
                </ChartCard>

                <DetailCard title="Custom Insight" subtitle="Placeholder for future analysis">
                  <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                    Coming soon
                  </div>
                </DetailCard>

                <DetailCard title="Compare Scenarios" subtitle="Placeholder for additional charts">
                  <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                    Coming soon
                  </div>
                </DetailCard>
              </div>
            </section>
          ) : (
            <section className="flex h-full min-h-0 flex-col gap-4 text-white">
              <header className="flex flex-shrink-0 flex-col gap-1">
                <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
                  Single Flight
                </h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Filter by date, route, or country and pick a flight to review detailed metrics.
                </p>
              </header>

              <div
                className="flex flex-shrink-0 flex-col gap-3 rounded-xl border px-1 py-1"
                style={{
                  borderColor: 'var(--panel-border)',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>
                    Showing {filteredFlights.length} of {flights.length} flights
                  </span>
                  <span>
                    Search looks at flight name, identifier, and origin/destination airports.
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-3">
                    <span className="text-[0.65rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      Search
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Name, identifier, airport…"
                      className="rounded-md border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[rgba(56,189,248,0.45)]"
                      style={{
                        borderColor: 'var(--panel-border)',
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                      }}
                    />
                  </div>
                  <FilterPopover
                    label="Date"
                    value={filterDate}
                    options={availableFilterOptions.dates}
                    onChange={setFilterDate}
                  />
                  <FilterPopover
                    label="Origin Airport"
                    value={filterOrigin}
                    options={availableFilterOptions.origins}
                    onChange={setFilterOrigin}
                  />
                  <FilterPopover
                    label="Destination Airport"
                    value={filterDestination}
                    options={availableFilterOptions.destinations}
                    onChange={setFilterDestination}
                  />
                  <FilterPopover
                    label="Origin Country"
                    value={filterOriginCountry}
                    options={availableFilterOptions.originCountries}
                    onChange={setFilterOriginCountry}
                  />
                  <FilterPopover
                    label="Destination Country"
                    value={filterDestinationCountry}
                    options={availableFilterOptions.destinationCountries}
                    onChange={setFilterDestinationCountry}
                  />
                  <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-3">
                    <span className="text-[0.65rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      Select Flight
                    </span>
                    <div
                      className="rounded-md border bg-[#0f172a]/60 px-3 py-2"
                      style={{ borderColor: 'var(--panel-border)' }}
                    >
                      <select
                        value={selectedFlightId ?? ''}
                        onChange={(event) => setSelectedFlightId(event.target.value || null)}
                        disabled={!filteredFlights.length}
                        className="w-full bg-transparent text-sm text-white focus:outline-none"
                      >
                        {filteredFlights.length ? null : <option value="">No flights found</option>}
                        {filteredFlights.map((flight) => (
                          <option
                            className="bg-[var(--panel-bg)] text-black"
                            key={flight.id}
                            value={flight.id}
                          >
                            {flight.name} ({flight.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div
                key={flightAnimationKey}
                className="grid flex-1 min-h-0 gap-4 auto-rows-[minmax(0,1fr)] grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              >
                <DetailCard
                  title="Flight Details"
                  subtitle={
                    selectedFlightStats
                      ? `${selectedFlightStats.origin} → ${selectedFlightStats.destination}`
                      : 'Select a flight to view statistics'
                  }
                  style={flightAnimationStyle}
                >
                  {selectedFlightStats ? (
                    <div className="flex flex-1 flex-col justify-between gap-4 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Countries
                        </div>
                        <div className="text-sm text-white">
                          {selectedFlightStats.originCountry} →{' '}
                          {selectedFlightStats.destinationCountry}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-[0.65rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            Distance
                          </div>
                          <div className="text-white">
                            {selectedFlightStats.distanceKm != null
                              ? `${nf0.format(Math.round(selectedFlightStats.distanceKm))} km`
                              : '–'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[0.65rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            Duration
                          </div>
                          <div className="text-white">
                            {formatDuration(selectedFlightStats.durationSeconds)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[0.65rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            Avg. Speed
                          </div>
                          <div className="text-white">
                            {selectedFlightStats.avgSpeed != null
                              ? `${nf0.format(Math.round(selectedFlightStats.avgSpeed))} km/h`
                              : '–'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[0.65rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            Avg. Altitude
                          </div>
                          <div className="text-white">
                            {selectedFlightStats.avgAltitude != null
                              ? `${nf0.format(Math.round(selectedFlightStats.avgAltitude))} ft`
                              : '–'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[0.65rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            Max Altitude
                          </div>
                          <div className="text-white">
                            {selectedFlightStats.maxAltitude != null
                              ? `${nf0.format(Math.round(selectedFlightStats.maxAltitude))} ft`
                              : '–'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[0.65rem] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            Samples
                          </div>
                          <div className="text-white">
                            {nf0.format(selectedFlightStats.pointCount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                      No flight selected
                    </div>
                  )}
                </DetailCard>

                {selectedFlightAltitudeSeries.length ? (
                  <ChartCard
                    title="Altitude Profile"
                    subtitle="Altitude in ft plotted against distance in km"
                    style={flightAnimationStyle}
                  >
                    <AreaChart
                      data={selectedFlightAltitudeSeries}
                      margin={{ left: -12, right: 12, top: 12, bottom: 8 }}
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
                        tickFormatter={(value) => `${Math.round(value)} km`}
                      />
                      <YAxis
                        tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        tickFormatter={(value) => `${Math.round(value / 1000)}k ft`}
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
                  </ChartCard>
                ) : (
                  <DetailCard
                    title="Altitude Profile"
                    subtitle="No altitude samples available"
                    style={flightAnimationStyle}
                  >
                    <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                      No altitude profile for this flight
                    </div>
                  </DetailCard>
                )}

                {selectedFlightSpeedSeries.length ? (
                  <ChartCard
                    title="Speed Profile"
                    subtitle="Speed in km/h along the route"
                    style={flightAnimationStyle}
                  >
                    <LineChart
                      data={selectedFlightSpeedSeries}
                      margin={{ left: -12, right: 12, top: 12, bottom: 8 }}
                    >
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 2" />
                      <XAxis
                        dataKey="distance"
                        tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        tickFormatter={(value) => `${Math.round(value)} km`}
                      />
                      <YAxis
                        tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        tickFormatter={(value) => `${Math.round(value)} km/h`}
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
                  </ChartCard>
                ) : (
                  <DetailCard
                    title="Speed Profile"
                    subtitle="No speed samples available"
                    style={flightAnimationStyle}
                  >
                    <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                      No speed measurements for this flight
                    </div>
                  </DetailCard>
                )}

                {selectedFlightVerticalSeries.length ? (
                  <ChartCard
                    title="Vertical Rate"
                    subtitle="Climb/descent in ft/min across time"
                    style={flightAnimationStyle}
                  >
                    <LineChart
                      data={selectedFlightVerticalSeries}
                      margin={{ left: -12, right: 12, top: 12, bottom: 8 }}
                    >
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 2" />
                      <XAxis
                        dataKey="timeMinutes"
                        tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        tickFormatter={(value) => `${Math.round(value)} min`}
                      />
                      <YAxis
                        tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        tickFormatter={(value) => `${Math.round(value)} ft/min`}
                      />
                      <Tooltip
                        cursor={LINE_CURSOR_ALTITUDE}
                        formatter={(value: number) => [
                          `${Math.round(value)} ft/min`,
                          'Vertical rate',
                        ]}
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        labelFormatter={(value: number) => `${Math.round(value)} min`}
                      />
                      <Line
                        type="monotone"
                        dataKey="verticalRate"
                        name="Vertical rate"
                        stroke="var(--flight-altitude)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ChartCard>
                ) : (
                  <DetailCard
                    title="Vertical Rate"
                    subtitle="No climb/descent data"
                    style={flightAnimationStyle}
                  >
                    <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                      No vertical rate values for this flight
                    </div>
                  </DetailCard>
                )}

                {selectedFlightAltitudeHistogram.length ? (
                  <ChartCard
                    title="Altitude Distribution"
                    subtitle="Sample count per altitude band"
                    style={flightAnimationStyle}
                  >
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
                      <YAxis
                        tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={BAR_CURSOR}
                        formatter={(value: number) => [`${value}`, 'Samples']}
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                      <Bar dataKey="samples" fill="var(--flight-altitude)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartCard>
                ) : (
                  <DetailCard
                    title="Altitude Distribution"
                    subtitle="Not enough altitude samples"
                    style={flightAnimationStyle}
                  >
                    <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                      No altitude values recorded
                    </div>
                  </DetailCard>
                )}

                {selectedFlightSpeedHistogram.length ? (
                  <ChartCard
                    title="Speed Distribution"
                    subtitle="Sample count per speed band"
                    style={flightAnimationStyle}
                  >
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
                      <YAxis
                        tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={BAR_CURSOR}
                        formatter={(value: number) => [`${value}`, 'Samples']}
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                      <Bar dataKey="samples" fill="var(--flight-speed)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartCard>
                ) : (
                  <DetailCard
                    title="Speed Distribution"
                    subtitle="Not enough speed samples"
                    style={flightAnimationStyle}
                  >
                    <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                      No speed values recorded
                    </div>
                  </DetailCard>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
function ColoredSankeyLink(props: SankeyLinkProps & { d?: string }) {
  const { payload, linkWidth, sourceX, sourceY, targetX, targetY, d, ...rest } = props as any

  const color = (payload as { color?: string })?.color ?? 'var(--flight-speed)'

  // Falls Recharts doch einen d-Pfad liefert, nimm den; sonst selbst bauen
  const curvature = 0.5
  const dx = (targetX - sourceX) * curvature
  const path =
    d ??
    `M${sourceX},${sourceY} C${sourceX + dx},${sourceY} ${targetX - dx},${targetY} ${targetX},${targetY}`

  const width = Math.max(linkWidth ?? 1, 1) // kein künstliches 6px-Minimum

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
