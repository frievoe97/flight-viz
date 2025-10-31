import { StatsLayout } from './components/StatsLayout'
import { StatsSidebar } from './components/StatsSidebar'
import { KpiStrip } from './components/KpiStrip'
import { OverviewDashboard } from './components/OverviewDashboard'
import { FlightDashboard } from './components/FlightDashboard'
import { useStatsPageState } from './hooks/useStatsPageState'

export default function StatsPage() {
  const state = useStatsPageState()

  if (state.loading) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-[var(--map-land)] text-white"
        style={{ backgroundColor: 'var(--map-land)' }}
      >
        <span className="text-sm uppercase tracking-[0.35em] text-white/70">
          Loading analytics…
        </span>
      </div>
    )
  }

  return (
    <StatsLayout
      sidebar={
        <StatsSidebar
          activeView={state.activeView}
          onActiveViewChange={(view) => state.setActiveView(view)}
          searchTerm={state.searchTerm}
          onSearchChange={(value) => state.setSearchTerm(value)}
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
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="border-b border-[color:var(--panel-border)] bg-[rgba(8,15,30,0.92)] px-6 py-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/80">
              {state.activeView === 'overview' ? 'Overview' : 'Single Flight'}
            </h2>
            <p className="text-xs text-white/60">
              {state.activeView === 'overview'
                ? 'Activity, altitude patterns, and performance metrics across every recorded flight.'
                : 'Telemetry breakdown for the selected mission with altitude, speed, and vertical rate insights.'}
            </p>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 flex-col gap-6 px-6 py-6">
          <KpiStrip summary={state.summary} formatter={state.nf0} />

          {state.activeView === 'overview' ? (
            <div className="flex-1 min-h-0 overflow-y-auto pb-6 pr-1">
              <OverviewDashboard
                flightsPerDay={state.flightsPerDay}
                altitudeByDistance={state.altitudeByDistance}
                flightLengthHistogram={state.flightLengthHistogram}
                speedByDay={state.speedByDay}
                totalFlightTimeByDay={state.totalFlightTimeByDay}
                topFlights={state.topFlights}
                sankeyData={state.sankeyData}
                ignoreSameStartTarget={state.ignoreSameStartTarget}
                onToggleIgnoreSameStartTarget={() =>
                  state.setIgnoreSameStartTarget((prev) => !prev)
                }
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <FlightDashboard
                nf0={state.nf0}
                flightAnimationKey={state.flightAnimationKey}
                selectedFlightId={state.selectedFlightId}
                setSelectedFlightId={state.setSelectedFlightId}
                selectedFlightDisplay={state.selectedFlightDisplay}
                flightPickerOptions={state.flightPickerOptions}
                selectedFlightStats={state.selectedFlightStats}
                selectedFlightAltitudeSeries={state.selectedFlightAltitudeSeries}
                selectedFlightSpeedSeries={state.selectedFlightSpeedSeries}
                selectedFlightVerticalSeries={state.selectedFlightVerticalSeries}
                selectedFlightAltitudeHistogram={state.selectedFlightAltitudeHistogram}
                selectedFlightSpeedHistogram={state.selectedFlightSpeedHistogram}
              />
            </div>
          )}
        </div>
      </div>
    </StatsLayout>
  )
}
