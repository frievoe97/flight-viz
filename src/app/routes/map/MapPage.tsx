import { useCallback, useEffect, useRef, useState } from 'react'
import MapGL, { NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import { useNavigate } from 'react-router-dom'
import { MAP_STYLE } from '@/lib/map/deckConfig'
import MapSettings from './components/MapSettings'
import ProjectionToggle from './components/ProjectionToggle'
import StatsShortcut from './components/StatsShortcut'
import FlightDetailsPanel from './components/FlightDetailsPanel'
import FilterMenu from './components/FilterMenu'
import { useMapPageState, MAP_PADDING } from './hooks/useMapPageState'
import type { MapFilterField } from './types'
import { Filter, RotateCcw } from 'lucide-react'

export default function MapPage() {
  const navigate = useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const controlPanelRef = useRef<HTMLDivElement | null>(null)
  const filterPanelRef = useRef<HTMLDivElement | null>(null)
  const {
    data,
    mapRef,
    projectionMode,
    activeOverlay,
    isFlights,
    isTrails,
    isSegments,
    isAnalytics,
    isRoutes,
    isAirports,
    settingsOpen,
    layersOpen,
    toggleSettingsPanel,
    toggleLayersPanel,
    handleOverlaySelect,
    handleMapLoad,
    handleMapMove,
    toggleProjection,
    toggleAnalyticsMetric,
    analyticsMetric,
    flightSpeedMultiplier,
    setFlightSpeedMultiplier,
    trailSpeedMultiplier,
    setTrailSpeedMultiplier,
    trailLengthSeconds,
    setTrailLengthSeconds,
    segmentWidthScale,
    setSegmentWidthScale,
    routeWidthScale,
    setRouteWidthScale,
    airportSizeScale,
    setAirportSizeScale,
    analyticsRadius,
    setAnalyticsRadius,
    selectedFlight,
    chartData,
    clearSelectedFlight,
    formatKm,
    formatFt,
    formatDuration,
    resetView,
    closeControlPanels,
    mapFilters,
    updateMapFilter,
    resetMapFilters,
    airportSuggestions,
    countrySuggestions,
    hasActiveFilters,
  } = useMapPageState()

  const handleFilterChange = useCallback(
    (field: MapFilterField, value: string) => {
      updateMapFilter(field, value)
    },
    [updateMapFilter]
  )

  const handleFilterReset = useCallback(() => {
    resetMapFilters()
  }, [resetMapFilters])

  useEffect(() => {
    if (!settingsOpen && !layersOpen && !filtersOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      const isInsideControls = controlPanelRef.current?.contains(target)
      const isInsideFilters = filterPanelRef.current?.contains(target)
      const isInsideControlPortal =
        target instanceof Element && !!target.closest('[data-map-portal="controls"]')

      if ((settingsOpen || layersOpen) && !isInsideControls && !isInsideControlPortal) {
        closeControlPanels()
      }

      if (filtersOpen && !isInsideFilters) {
        setFiltersOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [layersOpen, settingsOpen, filtersOpen, closeControlPanels])

  if (!data) return <div className="h-full w-full" />

  const gridTemplateRows =
    selectedFlight && chartData && isSegments ? '1fr minmax(12rem, 16rem)' : '1fr'

  return (
    <div className="h-full w-full grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows }}>
      <div className="relative" style={{ backgroundColor: 'var(--map-land)' }}>
        <MapGL
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          projection={projectionMode}
          maxPitch={projectionMode === 'globe' ? 0 : 85}
          initialViewState={{
            latitude: data.INITIAL_VIEW_STATE.latitude,
            longitude: data.INITIAL_VIEW_STATE.longitude,
            zoom: data.INITIAL_VIEW_STATE.zoom ?? 1,
            bearing: data.INITIAL_VIEW_STATE.bearing,
            pitch: data.INITIAL_VIEW_STATE.pitch,
            padding: MAP_PADDING,
          }}
          onLoad={handleMapLoad}
          onMove={({ viewState }) => handleMapMove(viewState)}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl
            key={projectionMode}
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '1px solid var(--panel-border)',
              boxShadow: '0 6px 18px rgba(15, 23, 42, 0.45)',
            }}
            showCompass={projectionMode !== 'globe'}
            showZoom
            visualizePitch={projectionMode !== 'globe'}
          />
        </MapGL>

        <div className="absolute top-3 left-3 z-10">
          <ProjectionToggle projectionMode={projectionMode} onToggle={toggleProjection} />
        </div>

        <div
          className="absolute right-3 z-10"
          style={{ top: projectionMode === 'globe' ? '5.3rem' : 'calc(5.3rem + 29px)' }}
        >
          <button
            type="button"
            className="controls-btn flex items-center gap-2 rounded-full px-2 py-2 text-xs font-semibold uppercase tracking-wide text-white [box-shadow:rgba(15,23,42,0.45)_0px_6px_18px]"
            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
            onClick={resetView}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div
          ref={filterPanelRef}
          className="absolute bottom-3 left-3 z-10 flex flex-col items-start gap-2"
        >
          {filtersOpen ? (
            <FilterMenu
              values={mapFilters}
              airportSuggestions={airportSuggestions}
              countrySuggestions={countrySuggestions}
              onFieldChange={handleFilterChange}
              onReset={handleFilterReset}
            />
          ) : null}

          <div className="flex items-center gap-2">
            <StatsShortcut onClick={() => navigate('/stats')} />
            <button
              type="button"
              className="controls-btn rounded-full p-2 text-white [box-shadow:rgba(15,23,42,0.45)_0px_6px_18px]"
              style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
              title="Filters"
            >
              <Filter
                className="h-5 w-5"
                aria-hidden
                style={hasActiveFilters ? { color: 'var(--flight-speed)' } : undefined}
              />
            </button>
          </div>
        </div>

        <div ref={controlPanelRef} className="absolute bottom-3 right-3 z-10">
          <MapSettings
            settingsOpen={settingsOpen}
            layersOpen={layersOpen}
            onToggleSettings={toggleSettingsPanel}
            onToggleLayers={toggleLayersPanel}
            activeOverlay={activeOverlay}
            onOverlaySelect={handleOverlaySelect}
            isFlights={isFlights}
            isTrails={isTrails}
            isSegments={isSegments}
            isAnalytics={isAnalytics}
            isRoutes={isRoutes}
            isAirports={isAirports}
            flightSpeedMultiplier={flightSpeedMultiplier}
            onFlightSpeedChange={(value) => setFlightSpeedMultiplier(value)}
            trailSpeedMultiplier={trailSpeedMultiplier}
            onTrailSpeedChange={(value) => setTrailSpeedMultiplier(value)}
            trailLengthSeconds={trailLengthSeconds}
            onTrailLengthChange={(value) => setTrailLengthSeconds(value)}
            segmentWidthScale={segmentWidthScale}
            onSegmentWidthChange={(value) => setSegmentWidthScale(value)}
            routeWidthScale={routeWidthScale}
            onRouteWidthChange={(value) => setRouteWidthScale(value)}
            airportSizeScale={airportSizeScale}
            onAirportSizeChange={(value) => setAirportSizeScale(value)}
            analyticsRadius={analyticsRadius}
            onAnalyticsRadiusChange={(value) => setAnalyticsRadius(value)}
            analyticsMetric={analyticsMetric}
            onAnalyticsMetricToggle={toggleAnalyticsMetric}
          />
        </div>
      </div>

      {isSegments && selectedFlight && chartData ? (
        <FlightDetailsPanel
          flight={selectedFlight}
          chartData={chartData}
          formatKm={formatKm}
          formatFt={formatFt}
          formatDuration={formatDuration}
          onClear={clearSelectedFlight}
        />
      ) : null}
    </div>
  )
}
