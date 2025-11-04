import { useCallback, useEffect, useMemo, useState } from 'react'
import { getFlightData, type Flight } from '@/data'
import {
  UNKNOWN_LABEL,
  formatDateKey,
  formatDateLabel,
  formatDateTimeLabel,
  getAirportCode,
  getAirportOption,
  getCountryOption,
  getFlightStart,
  parseEuDateTime,
  truncateRouteLabel,
  type OptionValue,
} from '../lib/utils'

type FlightData = Awaited<ReturnType<typeof getFlightData>>

export type StatsPageView = 'overview' | 'flight'

export type Filters = {
  date: string
  origin: string
  destination: string
  originCountry: string
  destinationCountry: string
}

export type FilterOption = { value: string; label: string; count: number }

export type SankeyDatum = {
  nodes: Array<{ name: string }>
  links: Array<{ source: number; target: number; value: number; color: string; fill: string; stroke: string }>
}

export type SelectedFlightStats = {
  name: string
  originCode: string
  originLabel: string
  destinationCode: string
  destinationLabel: string
  originCountry: string
  destinationCountry: string
  departureLabel: string | null
  distanceKm: number | null
  durationSeconds: number | null
  avgAltitude: number | null
  maxAltitude: number | null
  avgSpeed: number | null
  pointCount: number
}

type SelectedFlightSeriesPoint = {
  distance: number
  altitude: number | null
  speed: number | null
  verticalRate: number | null
  timeMinutes: number
}

export type SummaryMetrics = {
  totalFlights: number
  totalDistanceKm: number
  totalDurationHours: number
  avgSpeedKmH: number | null
  avgAltitudeFt: number | null
  uniqueRoutes: number
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

const HISTOGRAM_BINS = 8
const MAX_SANKEY_LINKS = 6

export function useStatsPageState() {
  const [activeView, setActiveView] = useState<StatsPageView>('overview')
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
  const regionDisplayNames = useMemo(() => {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' })
    } catch (error) {
      console.warn('Intl.DisplayNames not supported in this environment', error)
      return null
    }
  }, [])

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
        const originValue = getAirportOption(flight, 'origin').value
        if (originValue !== criteria.origin) return false
      }
      if (!omitSet.has('destination') && criteria.destination !== 'all') {
        const destinationValue = getAirportOption(flight, 'destination').value
        if (destinationValue !== criteria.destination) return false
      }
      if (!omitSet.has('originCountry') && criteria.originCountry !== 'all') {
        const originCountryValue = getCountryOption(flight, 'origin', regionDisplayNames).value
        if (originCountryValue !== criteria.originCountry) return false
      }
      if (!omitSet.has('destinationCountry') && criteria.destinationCountry !== 'all') {
        const destinationCountryValue = getCountryOption(
          flight,
          'destination',
          regionDisplayNames
        ).value
        if (destinationCountryValue !== criteria.destinationCountry) return false
      }
      return true
    },
    [filters, regionDisplayNames]
  )

  const availableFilterOptions = useMemo(() => {
    const collectOptions = (key: keyof Filters, projector: (flight: Flight) => OptionValue) => {
      const counts = new Map<string, { label: string; count: number }>()
      flights.forEach((flight) => {
        if (!matchesFilters(flight, undefined, [key])) return
        const { value, label } = projector(flight)
        const resolvedValue = value || UNKNOWN_LABEL
        const resolvedLabel = label || resolvedValue
        const entry = counts.get(resolvedValue)
        if (entry) {
          entry.count += 1
        } else {
          counts.set(resolvedValue, { label: resolvedLabel, count: 1 })
        }
      })
      const entries = [...counts.entries()].sort((a, b) =>
        a[1].label.localeCompare(b[1].label, 'de', { sensitivity: 'base' })
      )
      const total = entries.reduce((sum, [, { count }]) => sum + count, 0)
      return [
        { value: 'all', label: 'All', count: total },
        ...entries.map(([value, { label, count }]) => ({ value, label, count })),
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
      origins: collectOptions('origin', (flight) => getAirportOption(flight, 'origin')),
      destinations: collectOptions('destination', (flight) => getAirportOption(flight, 'destination')),
      originCountries: collectOptions('originCountry', (flight) =>
        getCountryOption(flight, 'origin', regionDisplayNames)
      ),
      destinationCountries: collectOptions('destinationCountry', (flight) =>
        getCountryOption(flight, 'destination', regionDisplayNames)
      ),
    }
  }, [flights, matchesFilters, regionDisplayNames])

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
        const haystackParts = [
          flight.name,
          flight.id,
          getAirportCode(flight, 'origin'),
          getAirportCode(flight, 'destination'),
          getAirportOption(flight, 'origin').label,
          getAirportOption(flight, 'destination').label,
          flight.meta?.departureAirport?.name ?? null,
          flight.meta?.departureAirport?.city ?? null,
          flight.meta?.arrivalAirport?.name ?? null,
          flight.meta?.arrivalAirport?.city ?? null,
          flight.meta?.callsign ?? null,
          flight.meta?.aircraftRegistration ?? null,
        ]
        const haystack = haystackParts
          .filter((part): part is string => typeof part === 'string' && part.length > 0)
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

  const flightPickerOptions = useMemo(
    () =>
      filteredFlights.map((flight) => ({
        id: flight.id,
        label: formatFlightOptionLabel(flight),
      })),
    [filteredFlights]
  )

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

  const selectedFlightDisplay = useMemo(() => {
    if (!flightPickerOptions.length) return 'No flights available'
    const found = flightPickerOptions.find((option) => option.id === selectedFlightId)
    return found?.label ?? flightPickerOptions[0]?.label ?? 'Select flight'
  }, [flightPickerOptions, selectedFlightId])

  // Overview aggregations respect current filters
  const flightsPerDay = useMemo(() => {
    const counts = new Map<string, number>()
    filteredFlights.forEach((flight) => {
      const start = getFlightStart(flight)
      if (!start) return
      const key = formatDateKey(start)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ date: formatDateLabel(key), flights: count }))
  }, [filteredFlights])

  // Removed altitudeByDistance (not insightful enough)

  const flightLengthHistogram = useMemo(() => {
    const counts = new Map<string, number>()
    const bucketSize = 250
    filteredFlights.forEach((flight) => {
      const distance = Number.isFinite(flight.distanceKm) ? (flight.distanceKm as number) : null
      if (distance == null) return
      const bucket = Math.floor(distance / bucketSize)
      const label = `${bucket * bucketSize}-${(bucket + 1) * bucketSize}`
      counts.set(label, (counts.get(label) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => {
        const [startA] = a[0].split('-')
        const [startB] = b[0].split('-')
        return Number.parseInt(startA, 10) - Number.parseInt(startB, 10)
      })
      .map(([label, count]) => ({
        label: `${label} km`,
        flights: count,
      }))
  }, [filteredFlights])

  const speedByDay = useMemo(() => {
    const dayStats = new Map<string, { sum: number; count: number }>()
    filteredFlights.forEach((flight) => {
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
  }, [filteredFlights])

  const totalFlightTimeByDay = useMemo(() => {
    const totals = new Map<string, number>()
    filteredFlights.forEach((flight) => {
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
  }, [filteredFlights])

  const topFlights = useMemo(() => {
    return [...filteredFlights]
      .filter((flight) => Number.isFinite(flight.distanceKm))
      .sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0))
      .slice(0, 10)
      .map((flight) => ({
        name: flight.name,
        label: truncateRouteLabel(flight.name),
        distance: flight.distanceKm ?? 0,
      }))
  }, [filteredFlights])

  const sankeyData = useMemo<SankeyDatum>(() => {
    type Flow = { origin: OptionValue; destination: OptionValue; count: number }
    const flows = new Map<string, Flow>()

    filteredFlights.forEach((flight) => {
      const origin = getCountryOption(flight, 'origin', regionDisplayNames)
      const destination = getCountryOption(flight, 'destination', regionDisplayNames)

      if (ignoreSameStartTarget && origin.value === destination.value) return

      const key = `${origin.value}→${destination.value}`
      const existing = flows.get(key)
      if (existing) {
        existing.count += 1
      } else {
        flows.set(key, { origin, destination, count: 1 })
      }
    })

    const top = [...flows.values()].sort((a, b) => b.count - a.count).slice(0, MAX_SANKEY_LINKS)

    const originIndex = new Map<string, number>()
    const destinationIndex = new Map<string, number>()
    const nodes: Array<{ name: string }> = []

    top.forEach(({ origin, destination }) => {
      if (!originIndex.has(origin.value)) {
        originIndex.set(origin.value, nodes.length)
        nodes.push({ name: `${origin.label} • Origin` })
      }
      if (!destinationIndex.has(destination.value)) {
        destinationIndex.set(destination.value, nodes.length)
        nodes.push({ name: `${destination.label} • Destination` })
      }
    })

    const pickLinkColor = (originValue: string, destinationValue: string) => {
      const key = `${originValue}-${destinationValue}`
      const hash = key.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      return SANKEY_COLORS[hash % SANKEY_COLORS.length]
    }

    const links = top
      .map(({ origin, destination, count }) => {
        const source = originIndex.get(origin.value)
        const target = destinationIndex.get(destination.value)
        if (source == null || target == null) return null
        const color = pickLinkColor(origin.value, destination.value)
        return { source, target, value: count, color, fill: color, stroke: color }
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
  }, [filteredFlights, ignoreSameStartTarget, regionDisplayNames])

  // Additional, more insightful aggregations
  const flightsByHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, flights: 0 }))
    filteredFlights.forEach((flight) => {
      const start = getFlightStart(flight)
      if (!start) return
      const h = start.getUTCHours()
      buckets[h].flights += 1
    })
    return buckets.map((b) => ({ label: `${String(b.hour).padStart(2, '0')}:00`, flights: b.flights }))
  }, [filteredFlights])

  const flightsByWeekday = useMemo(() => {
    const names = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
    const counts = Array.from({ length: 7 }, (_, d) => ({ d, flights: 0 }))
    filteredFlights.forEach((flight) => {
      const start = getFlightStart(flight)
      if (!start) return
      counts[start.getUTCDay()].flights += 1
    })
    return counts.map((c) => ({ label: names[c.d], flights: c.flights }))
  }, [filteredFlights])

  const durationHistogram = useMemo(() => {
    const ranges = [0, 30, 60, 120, 240]
    const labels = ['0–30 min', '30–60 min', '1–2 h', '2–4 h', '4+ h']
    const counts = [0, 0, 0, 0, 0]
    filteredFlights.forEach((flight) => {
      const sec = flight.durationSeconds
      if (!Number.isFinite(sec as number)) return
      const min = (sec as number) / 60
      let idx = ranges.findIndex((start, i) => (ranges[i + 1] ? min >= start && min < ranges[i + 1] : false))
      if (idx === -1) idx = 4
      counts[idx] += 1
    })
    return labels.map((label, i) => ({ label, flights: counts[i] }))
  }, [filteredFlights])

  const distanceDurationPoints = useMemo(() => {
    return filteredFlights
      .filter((f) => Number.isFinite(f.distanceKm) && Number.isFinite(f.durationSeconds as number))
      .map((f) => ({ name: f.name, distance: f.distanceKm, hours: (f.durationSeconds as number) / 3600 }))
  }, [filteredFlights])

  const topOrigins = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    filteredFlights.forEach((flight) => {
      const { value, label } = getAirportOption(flight, 'origin')
      const key = value || UNKNOWN_LABEL
      counts.set(key, { label: label || key, count: (counts.get(key)?.count ?? 0) + 1 })
    })
    return [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([value, { label, count }]) => ({ value, label, flights: count }))
  }, [filteredFlights])

  const topDestinations = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    filteredFlights.forEach((flight) => {
      const { value, label } = getAirportOption(flight, 'destination')
      const key = value || UNKNOWN_LABEL
      counts.set(key, { label: label || key, count: (counts.get(key)?.count ?? 0) + 1 })
    })
    return [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([value, { label, count }]) => ({ value, label, flights: count }))
  }, [filteredFlights])

  const topAircraftTypes = useMemo(() => {
    const counts = new Map<string, number>()
    filteredFlights.forEach((flight) => {
      const type = flight.meta?.aircraftFriendlyType || flight.meta?.aircraftType || 'Unbekannt'
      counts.set(type, (counts.get(type) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, flights: count }))
  }, [filteredFlights])

  const selectedFlightSeries = useMemo<SelectedFlightSeriesPoint[]>(() => {
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
    const span = max - min || 1
    const binSize = span / HISTOGRAM_BINS
    const entries = Array.from({ length: HISTOGRAM_BINS }, (_, index) => {
      const start = min + index * binSize
      const end = index === HISTOGRAM_BINS - 1 ? max : min + (index + 1) * binSize
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
    const span = max - min || 1
    const binSize = span / HISTOGRAM_BINS
    const entries = Array.from({ length: HISTOGRAM_BINS }, (_, index) => {
      const start = min + index * binSize
      const end = index === HISTOGRAM_BINS - 1 ? max : min + (index + 1) * binSize
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

  const selectedFlightStats = useMemo<SelectedFlightStats | null>(() => {
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
    const originOption = getAirportOption(selectedFlight, 'origin')
    const destinationOption = getAirportOption(selectedFlight, 'destination')
    const start = getFlightStart(selectedFlight)
    const originCountryOption = getCountryOption(selectedFlight, 'origin', regionDisplayNames)
    const destinationCountryOption = getCountryOption(
      selectedFlight,
      'destination',
      regionDisplayNames
    )
    return {
      name: selectedFlight.name,
      originCode: originOption.value,
      originLabel: originOption.label,
      destinationCode: destinationOption.value,
      destinationLabel: destinationOption.label,
      originCountry: originCountryOption.label,
      destinationCountry: destinationCountryOption.label,
      departureLabel: start ? formatDateTimeLabel(start) : null,
      distanceKm,
      durationSeconds,
      avgAltitude,
      maxAltitude,
      avgSpeed,
      pointCount: selectedFlight.pointCount,
    }
  }, [regionDisplayNames, selectedFlight])

  const summary = useMemo<SummaryMetrics>(() => {
    if (!filteredFlights.length) {
      return {
        totalFlights: 0,
        totalDistanceKm: 0,
        totalDurationHours: 0,
        avgSpeedKmH: null,
        avgAltitudeFt: null,
        uniqueRoutes: 0,
      }
    }

    let distanceSum = 0
    let durationSum = 0
    let speedSum = 0
    let speedCount = 0
    let altitudeSum = 0
    let altitudeCount = 0
    const routes = new Set<string>()

    filteredFlights.forEach((flight) => {
      if (Number.isFinite(flight.distanceKm)) {
        distanceSum += flight.distanceKm as number
      }
      if (Number.isFinite(flight.durationSeconds)) {
        durationSum += flight.durationSeconds as number
      }
      if (Number.isFinite(flight.speedKtsStats.avg as number)) {
        speedSum += (flight.speedKtsStats.avg as number) * 1.852
        speedCount += 1
      }
      if (Number.isFinite(flight.altitudeStats.avg as number)) {
        altitudeSum += flight.altitudeStats.avg as number
        altitudeCount += 1
      }

      const origin = getAirportOption(flight, 'origin').value ?? flight.origin ?? UNKNOWN_LABEL
      const destination =
        getAirportOption(flight, 'destination').value ?? flight.destination ?? UNKNOWN_LABEL
      routes.add(`${origin}→${destination}`)
    })

    return {
      totalFlights: filteredFlights.length,
      totalDistanceKm: distanceSum,
      totalDurationHours: durationSum / 3600,
      avgSpeedKmH: speedCount ? speedSum / speedCount : null,
      avgAltitudeFt: altitudeCount ? altitudeSum / altitudeCount : null,
      uniqueRoutes: routes.size,
    }
  }, [filteredFlights])

  return {
    loading: !flightData,
    flights,
    filteredFlights,
    nf0,
    activeView,
    setActiveView,
    searchTerm,
    setSearchTerm,
    filterDate,
    setFilterDate,
    filterOrigin,
    setFilterOrigin,
    filterDestination,
    setFilterDestination,
    filterOriginCountry,
    setFilterOriginCountry,
    filterDestinationCountry,
    setFilterDestinationCountry,
    filters,
    availableFilterOptions,
    summary,
    flightsPerDay,
    flightLengthHistogram,
    speedByDay,
    totalFlightTimeByDay,
    topFlights,
    sankeyData,
    flightsByHour,
    flightsByWeekday,
    durationHistogram,
    distanceDurationPoints,
    topOrigins,
    topDestinations,
    topAircraftTypes,
    ignoreSameStartTarget,
    setIgnoreSameStartTarget,
    flightPickerOptions,
    selectedFlightId,
    setSelectedFlightId,
    selectedFlightDisplay,
    selectedFlightStats,
    selectedFlightSeries,
    selectedFlightAltitudeSeries,
    selectedFlightSpeedSeries,
    selectedFlightVerticalSeries,
    selectedFlightAltitudeHistogram,
    selectedFlightSpeedHistogram,
    flightAnimationKey,
  }
}

function formatFlightOptionLabel(flight: Flight) {
  const originCode = getAirportOption(flight, 'origin').value || UNKNOWN_LABEL
  const destinationCode = getAirportOption(flight, 'destination').value || UNKNOWN_LABEL
  const start = getFlightStart(flight)
  const timestamp = start ? formatDateTimeLabel(start) : null
  const base = `${originCode} → ${destinationCode}`
  return timestamp ? `${base} (${timestamp})` : base
}
