import { StatsLayout } from './components/StatsLayout'
import Topbar from './components/Topbar'
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
    <StatsLayout>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="border-b border-[color:var(--panel-border)] bg-[rgba(8,15,30,0.92)] px-6 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/80">
                Statistiken
              </h1>
              <p className="text-xs text-white/60">
                Übersicht und Einzelflug‑Analyse mit klarer Filter‑Leiste, kompakten KPIs und gut lesbaren Charts.
              </p>
            </div>

            <Topbar
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
              onFilterDestinationCountryChange={(value) => state.setFilterDestinationCountry(value)}
              filterOptions={state.availableFilterOptions}
              onResetFilters={() => {
                state.setSearchTerm('')
                state.setFilterDate('all')
                state.setFilterOrigin('all')
                state.setFilterDestination('all')
                state.setFilterOriginCountry('all')
                state.setFilterDestinationCountry('all')
              }}
            />
          </div>
        </header>

        <div className="flex flex-1 min-h-0 flex-col gap-6 px-6 py-6">
          {state.filteredFlights.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="max-w-lg rounded-xl border border-[color:var(--panel-border)] bg-[rgba(12,20,36,0.78)] p-6 text-center text-white/80 shadow-sm">
                <div className="text-sm font-medium">Keine Ergebnisse</div>
                <p className="mt-2 text-[0.85rem] text-white/60">
                  Für die aktuelle Filter‑Kombination wurden keine Flüge gefunden. Passe die Filter an
                  oder setze sie zurück.
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
                  className="mt-4 controls-btn rounded-md border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.72)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-white hover:bg-white/10"
                >
                  Filter zurücksetzen
                </button>
              </div>
            </div>
          ) : (
            <>
              <KpiStrip summary={state.summary} formatter={state.nf0} />

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
            </>
          )}
        </div>
      </div>
    </StatsLayout>
  )
}
