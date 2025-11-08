import { Link } from 'react-router-dom'
import { Map as MapIcon, LineChart, Plane } from 'lucide-react'
import { StatsLayout } from './components/StatsLayout'
import Topbar, { SegmentedControl } from './components/Topbar'
import { KpiStrip } from './components/KpiStrip'
import { OverviewDashboard } from './components/OverviewDashboard'
import { FlightDashboard } from './components/FlightDashboard'
import { useStatsPageState } from './hooks/useStatsPageState'

export default function StatsPage() {
  const state = useStatsPageState()
  // const overviewCounterText = `Showing ${state.filteredFlights.length.toLocaleString('en-US')} of ${state.flights.length.toLocaleString('en-US')} flights`
  const overviewNavigationCard =
    state.activeView === 'overview' ? (
      <section
        className="rounded-xl border border-[color:var(--panel-border)] p-4 shadow-sm h-full"
        style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--controls-fg)' }}
      >
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.3em] opacity-60">Navigation</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                to="/map"
                className="controls-btn inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] hover:bg-[color:var(--panel-border)]/10"
              >
                <MapIcon className="h-4 w-4" aria-hidden />
                {/* <span className="hidden sm:inline">Back to map</span> */}
              </Link>
              <SegmentedControl
                value={state.activeView}
                onChange={(view) => state.setActiveView(view)}
                options={[
                  { value: 'overview', label: 'Overview', icon: <LineChart className="h-4 w-4" /> },
                  { value: 'flight', label: 'Single flight', icon: <Plane className="h-4 w-4" /> },
                ]}
              />
            </div>
          </div>
          {/* <div className="text-[0.7rem] text-white/60">{overviewCounterText}</div> */}
        </div>
      </section>
    ) : null

  if (state.loading) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ backgroundColor: 'var(--map-land)', color: 'var(--controls-fg)' }}
      >
        <span className="text-sm uppercase tracking-[0.35em] opacity-70">
          Loading analytics…
        </span>
      </div>
    )
  }

  return (
    <StatsLayout>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header
          className="border-b border-[color:var(--panel-border)] px-6 py-4"
          style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--controls-fg)' }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-sm font-semibold uppercase tracking-[0.35em] opacity-80">
                Statistics
              </h1>
              <p className="text-xs opacity-60">
                Overview and single-flight analysis with a clear filter bar, compact KPIs, and
                readable charts.
              </p>
            </div>

            {state.activeView === 'flight' ? (
              <Topbar
                activeView={state.activeView}
                onActiveViewChange={(view) => state.setActiveView(view)}
                filteredCount={state.filteredFlights.length}
                totalCount={state.flights.length}
                filterDate={state.filterDate}
                onFilterDateChange={(value) => state.setFilterDate(value)}
                filterOrigin={state.filterOrigin}
                onFilterOriginChange={(value) => state.setFilterOrigin(value)}
                filterDestination={state.filterDestination}
                onFilterDestinationChange={(value) => state.setFilterDestination(value)}
                filterOriginCountry={state.filterOriginCountry}
                onFilterOriginCountryChange={(value) => state.setFilterOriginCountry(value)}
                filterDestinationCountry={state.filterDestinationCountry}
                onFilterDestinationCountryChange={(value) =>
                  state.setFilterDestinationCountry(value)
                }
                filterOptions={state.availableFilterOptions}
                onResetFilters={() => {
                  state.setSearchTerm('')
                  state.setFilterDate('all')
                  state.setFilterOrigin('all')
                  state.setFilterDestination('all')
                  state.setFilterOriginCountry('all')
                  state.setFilterDestinationCountry('all')
                }}
                flightPickerOptions={state.flightPickerOptions}
                selectedFlightId={state.selectedFlightId}
                selectedFlightLabel={state.selectedFlightDisplay}
                onSelectFlight={(id) => state.setSelectedFlightId(id)}
              />
            ) : null}
          </div>
        </header>

        <div className="flex flex-1 min-h-0 flex-col gap-6 px-6 py-6">
          {state.filteredFlights.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div
                className="max-w-lg rounded-xl border border-[color:var(--panel-border)] p-6 text-center shadow-sm"
                style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--controls-fg)' }}
              >
                <div className="text-sm font-medium">No results</div>
                <p className="mt-2 text-[0.85rem] opacity-60">
                  No flights were found for the current filter combination. Adjust the filters or
                  reset them.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    state.setSearchTerm('')
                    state.setFilterDate('all')
                    state.setFilterOrigin('all')
                    state.setFilterDestination('all')
                    state.setFilterOriginCountry('all')
                    state.setFilterDestinationCountry('all')
                  }}
                  className="mt-4 controls-btn rounded-md border border-[color:var(--panel-border)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] hover:bg-[color:var(--panel-border)]/10"
                >
                  Reset filters
                </button>
              </div>
            </div>
          ) : (
            <>
              {state.activeView === 'overview' ? (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                  <div className="lg:w-72 xl:w-80">{overviewNavigationCard}</div>
                  <div className="flex-1">
                    <KpiStrip summary={state.summary} formatter={state.nf0} />
                  </div>
                </div>
              ) : (
                <KpiStrip summary={state.summary} formatter={state.nf0} />
              )}

              {state.activeView === 'overview' ? (
                <div className="flex-1 min-h-0 overflow-y-auto pb-6 pr-1">
                  <OverviewDashboard
                    flightsPerDay={state.flightsPerDay}
                    flightLengthHistogram={state.flightLengthHistogram}
                    speedByDay={state.speedByDay}
                    totalFlightTimeByDay={state.totalFlightTimeByDay}
                    topFlights={state.topFlights}
                    sankeyData={state.sankeyData}
                    ignoreSameStartTarget={state.ignoreSameStartTarget}
                    onToggleIgnoreSameStartTarget={() =>
                      state.setIgnoreSameStartTarget((prev) => !prev)
                    }
                    flightsByHour={state.flightsByHour}
                    flightsByWeekday={state.flightsByWeekday}
                    durationHistogram={state.durationHistogram}
                    distanceDurationPoints={state.distanceDurationPoints}
                    topOrigins={state.topOrigins}
                    topDestinations={state.topDestinations}
                    topAircraftTypes={state.topAircraftTypes}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <FlightDashboard
                    nf0={state.nf0}
                    flightAnimationKey={state.flightAnimationKey}
                    selectedFlightStats={state.selectedFlightStats}
                    selectedFlightAltitudeSeries={state.selectedFlightAltitudeSeries}
                    selectedFlightSpeedSeries={state.selectedFlightSpeedSeries}
                    selectedFlightVerticalSeries={state.selectedFlightVerticalSeries}
                    selectedFlightAltitudeHistogram={state.selectedFlightAltitudeHistogram}
                    selectedFlightSpeedHistogram={state.selectedFlightSpeedHistogram}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </StatsLayout>
  )
}
