import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { FilterPopover } from './Filters'
import type { StatsPageView, FilterOption } from '../hooks/useStatsPageState'
import { Map as MapIcon, LineChart, Plane, FilterX, Search as SearchIcon } from 'lucide-react'

type FilterGroups = {
  dates: FilterOption[]
  origins: FilterOption[]
  destinations: FilterOption[]
  originCountries: FilterOption[]
  destinationCountries: FilterOption[]
}

type TopbarProps = {
  activeView: StatsPageView
  onActiveViewChange: (view: StatsPageView) => void
  searchTerm: string
  onSearchChange: (value: string) => void
  filteredCount: number
  totalCount: number
  filterDate: string
  onFilterDateChange: (value: string) => void
  filterOrigin: string
  onFilterOriginChange: (value: string) => void
  filterDestination: string
  onFilterDestinationChange: (value: string) => void
  filterOriginCountry: string
  onFilterOriginCountryChange: (value: string) => void
  filterDestinationCountry: string
  onFilterDestinationCountryChange: (value: string) => void
  filterOptions: FilterGroups
  onResetFilters: () => void
  className?: string
}

export default function Topbar({
  activeView,
  onActiveViewChange,
  searchTerm,
  onSearchChange,
  filteredCount,
  totalCount,
  filterDate,
  onFilterDateChange,
  filterOrigin,
  onFilterOriginChange,
  filterDestination,
  onFilterDestinationChange,
  filterOriginCountry,
  onFilterOriginCountryChange,
  filterDestinationCountry,
  onFilterDestinationCountryChange,
  filterOptions,
  onResetFilters,
  className,
}: TopbarProps) {
  const counterText = useMemo(() => {
    return `Showing ${filteredCount.toLocaleString('en-US')} of ${totalCount.toLocaleString('en-US')} flights`
  }, [filteredCount, totalCount])

  return (
    <div
      className={cn(
        'rounded-xl border border-[color:var(--panel-border)] bg-[rgba(12,20,36,0.78)] p-3 text-white shadow-sm backdrop-blur',
        className
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/map"
            className="controls-btn inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] hover:bg-white/10"
            aria-label="Back to map"
            title="Back to map"
          >
            <MapIcon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Back to map</span>
          </Link>
          <SegmentedControl
            value={activeView}
            onChange={onActiveViewChange}
            options={[
              { value: 'overview', label: 'Overview', icon: <LineChart className="h-4 w-4" /> },
              { value: 'flight', label: 'Single flight', icon: <Plane className="h-4 w-4" /> },
            ]}
          />
          <div className="hidden md:block text-xs text-white/60">{counterText}</div>
        </div>

        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-end">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.65)] px-3 py-2 text-sm">
            <SearchIcon className="h-4 w-4 text-white/60" aria-hidden />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Name, identifier, airport…"
              className="min-w-0 flex-1 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={onResetFilters}
            className="controls-btn inline-flex items-center gap-2 rounded-md border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.65)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white hover:bg-white/10"
          >
            <FilterX className="h-4 w-4" aria-hidden />
            <span>Reset filters</span>
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <FilterPopover
          label="Date"
          value={filterDate}
          options={filterOptions.dates}
          onChange={onFilterDateChange}
        />
        <FilterPopover
          label="Origin airport"
          value={filterOrigin}
          options={filterOptions.origins}
          onChange={onFilterOriginChange}
        />
        <FilterPopover
          label="Destination airport"
          value={filterDestination}
          options={filterOptions.destinations}
          onChange={onFilterDestinationChange}
        />
        <FilterPopover
          label="Origin country"
          value={filterOriginCountry}
          options={filterOptions.originCountries}
          onChange={onFilterOriginCountryChange}
        />
        <FilterPopover
          label="Destination country"
          value={filterDestinationCountry}
          options={filterOptions.destinationCountries}
          onChange={onFilterDestinationCountryChange}
        />
      </div>

      <div className="mt-2 md:hidden text-[0.7rem] text-white/60">{counterText}</div>
    </div>
  )
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (val: T) => void
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.65)] p-1 text-xs">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              'px-3 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1.5',
              active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
            )}
          >
            {opt.icon ? opt.icon : null}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
