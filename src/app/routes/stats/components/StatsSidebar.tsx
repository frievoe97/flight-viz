import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { FilterPopover, SidebarButton, type StatsPageView } from './Filters'
import type { FilterOption } from '../hooks/useStatsPageState'

type FilterGroups = {
  dates: FilterOption[]
  origins: FilterOption[]
  destinations: FilterOption[]
  originCountries: FilterOption[]
  destinationCountries: FilterOption[]
}

type StatsSidebarProps = {
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
  className?: string
}

export function StatsSidebar({
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
  className,
}: StatsSidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col gap-6 border-r border-[color:var(--panel-border)] bg-[rgba(8,15,30,0.92)] px-5 py-6 text-white backdrop-blur',
        'md:w-80 lg:w-[22rem]',
        className
      )}
    >
      <div className="space-y-3">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.45em] text-white/90">
            Flight Analytics
          </h1>
          <p className="mt-2 text-[0.8rem] text-white/60 leading-relaxed">
            Compare overall air traffic activity or deep-dive into a single mission without losing
            the clean deck aesthetic from the map.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-2">
          <SidebarButton active={activeView === 'overview'} onClick={() => onActiveViewChange('overview')}>
            All Flights
          </SidebarButton>
          <SidebarButton active={activeView === 'flight'} onClick={() => onActiveViewChange('flight')}>
            Single Flight
          </SidebarButton>
        </nav>
        <div className="rounded-lg border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.65)] px-3 py-2 text-xs text-white/70">
          Showing <span className="font-semibold text-white">{filteredCount}</span> of{' '}
          <span className="font-semibold text-white">{totalCount}</span> flights
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[0.6rem] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            Search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Name, identifier, airport…"
            className="rounded-md border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.65)] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[rgba(56,189,248,0.45)]"
          />
        </label>

        <FilterPopover
          label="Date"
          value={filterDate}
          options={filterOptions.dates}
          onChange={onFilterDateChange}
        />
        <FilterPopover
          label="Origin Airport"
          value={filterOrigin}
          options={filterOptions.origins}
          onChange={onFilterOriginChange}
        />
        <FilterPopover
          label="Destination Airport"
          value={filterDestination}
          options={filterOptions.destinations}
          onChange={onFilterDestinationChange}
        />
        <FilterPopover
          label="Origin Country"
          value={filterOriginCountry}
          options={filterOptions.originCountries}
          onChange={onFilterOriginCountryChange}
        />
        <FilterPopover
          label="Destination Country"
          value={filterDestinationCountry}
          options={filterOptions.destinationCountries}
          onChange={onFilterDestinationCountryChange}
        />
      </div>

      <div className="mt-auto space-y-3 text-xs text-white/70">
        <p>
          Filters apply to both the overview metrics and the flight selector so you always explore
          a consistent subset of the dataset.
        </p>
        <Link
          to="/map"
          className="controls-btn block rounded-md border border-[color:var(--panel-border)] px-3 py-2 text-center text-sm font-semibold uppercase tracking-[0.3em] transition hover:bg-white/10"
        >
          Back to Map
        </Link>
      </div>
    </aside>
  )
}

export type { StatsSidebarProps }
